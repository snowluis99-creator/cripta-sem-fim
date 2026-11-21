// Velocidade Rasga-Tempo (lendária da Lança, pedido do dono, 12/11/2026): o Tiranossauro Rex que sai do portal.
// Os 3 dinossauros da pasta assets_novos são estátuas (500 mil triângulos, sem esqueleto e sem animação), então
// ele é montado em código, peça por peça, no estilo do jogo: corpo verde com o dorso mais escuro e barriga clara,
// cabeçona com dentes, olhos, língua e mandíbula que abre, bracinhos, pernas fortes com 3 dedos, cauda em 7 partes
// e sela de cavaleiro nas costas. Na 2ª forma (dragão negro) a pele escurece, os olhos e a boca brilham, os espinhos
// das costas crescem e aparecem as asas de morcego. A "pose" é calculada a cada quadro (parado, andando, mordida,
// estraçalhar, rugido, lambida, cuspida, voo, ajoelhado, morrendo).
import * as THREE from 'three';
import { makeBlobShadow } from './characters.js';

export const REX_DIM = { hip: 2.6, saddle: 3.95, head: 4.6, length: 9 };

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const seg = (k, a, b) => clamp01((k - a) / (b - a));
const bell = (k, a, b) => Math.sin(seg(k, a, b) * Math.PI);
const UP = new THREE.Vector3(0, 1, 0);

// Cores: verde (T-Rex) e negro (dragão).
const COLORS = {
  skin: [0x74c54a, 0x2a2232], back: [0x3f8a2a, 0x150f1b], belly: [0xe6da94, 0x3d3043],
  scute: [0x2f5a1f, 0x7a1418], claw: [0xf1e9d2, 0x1a1418], mouth: [0x8c2c2c, 0xff6a1a],
};

export function makeRex(opts = {}) {
  const D = REX_DIM;
  const flashMats = [];
  const std = (color, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.02, ...o });
    m.userData.e = m.emissive.clone(); m.userData.ei = m.emissiveIntensity;
    flashMats.push(m); return m;
  };
  const skin = std(COLORS.skin[0], { emissive: 0x0c1a06, emissiveIntensity: 1 });
  const back = std(COLORS.back[0]);
  const belly = std(COLORS.belly[0]);
  const scute = std(COLORS.scute[0], { roughness: 0.6 });
  const claw = std(COLORS.claw[0], { roughness: 0.45 });
  const mouth = std(COLORS.mouth[0], { roughness: 0.6, emissive: 0xff5010, emissiveIntensity: 0 });
  const tongueM = std(0xd8626e, { roughness: 0.35 });
  const leather = std(0x6a3f22, { roughness: 0.85 });
  const gold = std(0xe8b84a, { emissive: 0x4a3000, emissiveIntensity: 0.4, metalness: 0.45, roughness: 0.35 });
  const cloth = std(opts.cloth ?? 0x8a1e1e, { roughness: 0.9, side: THREE.DoubleSide });
  const eyeW = new THREE.MeshBasicMaterial({ color: 0xfff6dc });
  const pupil = new THREE.MeshBasicMaterial({ color: 0x1a120a });
  const wingMat = std(0x4a1f55, { roughness: 0.7, side: THREE.DoubleSide, emissive: 0x6a1030, emissiveIntensity: 0.45 });
  const boneMat = std(0x1e1622, { roughness: 0.6 });

  const g = new THREE.Group();
  const parts = []; // pedaços grandes (somem voando na explosão)
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, big = false) => {
    const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); parent.add(o);
    if (big) parts.push(o);
    return o;
  };
  const grp = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
  const sph = (r, sx = 1, sy = 1, sz = 1, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz);
  // Cilindro de a até b (afinando de ra para rb).
  const limb = (parent, a, b, ra, rb, m, big = false) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const o = add(parent, new THREE.CylinderGeometry(rb, ra, len, 12), m, 0, 0, 0, big);
    o.position.copy(a).addScaledVector(d, 0.5);
    o.quaternion.setFromUnitVectors(UP, d.normalize());
    return o;
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const shadow = makeBlobShadow(6.8); g.add(shadow);
  shadow.scale.z = 1.6; // corpo comprido

  // "lift": tudo menos a sombra (o dragão levita).
  const lift = grp(g, 0, 0, 0);

  // ---------- Corpo ----------
  const body = grp(lift, 0, D.hip, -0.15);
  body.scale.x = 1.22; // mais largo: de cima (câmera do jogo) parece mais forte
  add(body, sph(1, 1.05, 1.0, 1.6), skin, 0, 0.3, 0.15, true);             // tronco comprido
  add(body, sph(0.95, 1.0, 1.05, 1.1), skin, 0, 0.5, 1.3, true);           // peito
  add(body, sph(0.9, 0.86, 0.7, 1.55), belly, 0, -0.08, 0.6);              // barriga clara
  add(body, sph(0.92, 0.9, 0.52, 1.65), back, 0, 0.78, 0.3);               // dorso escuro
  // Escamas grossas do dorso (no dragão viram espinhos vermelhos).
  const spikes = [];
  for (let i = 0; i < 7; i++) {
    const z = -1.0 + i * 0.42, y = 1.18 - Math.abs(z - 0.4) * 0.12;
    const s = add(body, new THREE.ConeGeometry(0.16, 0.36, 5), scute, 0, y, z);
    s.rotation.x = -0.35; s.userData.base = 1 - Math.abs(i - 3) * 0.08; spikes.push(s);
  }

  // Sela (o Cavaleiro vai sentado aqui): couro, borda dourada e manta dos dois lados.
  const saddle = grp(body, 0, 1.3, 0.35);
  add(saddle, new THREE.CylinderGeometry(0.46, 0.46, 0.62, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(1, 0.5, 1), leather, 0, 0.05, 0);
  add(saddle, new THREE.BoxGeometry(0.98, 0.05, 0.7), gold, 0, -0.06, 0);
  add(saddle, new THREE.BoxGeometry(0.18, 0.32, 0.14), leather, 0, 0.18, 0.36); // arção da frente
  add(saddle, new THREE.SphereGeometry(0.08, 8, 6), gold, 0, 0.36, 0.38);
  for (const sd of [-1, 1]) {
    const c = add(saddle, new THREE.BoxGeometry(0.04, 0.62, 0.74), cloth, 0.53 * sd, -0.32, 0); c.rotation.z = 0.22 * sd;
    const t = add(saddle, new THREE.BoxGeometry(0.05, 0.06, 0.76), gold, 0.6 * sd, -0.62, 0); t.rotation.z = 0.22 * sd;
    // Estribo.
    limb(saddle, V(0.5 * sd, -0.2, 0.05), V(0.62 * sd, -0.95, 0.12), 0.02, 0.02, leather);
    add(saddle, new THREE.TorusGeometry(0.09, 0.025, 6, 10), gold, 0.62 * sd, -1.0, 0.12);
  }
  const seat = grp(saddle, 0, 0.12, -0.02);

  // ---------- Pescoço e cabeça ----------
  const neck = grp(body, 0, 0.8, 1.95);
  limb(neck, V(0, -0.15, -0.25), V(0, 0.6, 0.75), 0.62, 0.48, skin, true);
  add(neck, sph(0.5, 0.95, 0.75, 1.1), back, 0, 0.42, 0.25);
  const head = grp(neck, 0, 0.78, 0.95);
  add(head, sph(0.7, 0.95, 0.92, 1.0), skin, 0, 0.16, 0.05, true);           // crânio
  add(head, new THREE.CapsuleGeometry(0.5, 0.8, 6, 14).rotateX(Math.PI / 2).scale(0.96, 0.92, 1), skin, 0, 0.06, 0.95); // focinho alto (cara de T-Rex)
  add(head, sph(0.5, 0.92, 0.42, 1.25), back, 0, 0.42, 0.6);                    // topo da cabeça escuro
  for (const s of [-1, 1]) {
    const brow = add(head, new THREE.BoxGeometry(0.3, 0.14, 0.46), back, 0.38 * s, 0.6, 0.36); brow.rotation.set(0.15, 0, -0.3 * s);
    add(head, new THREE.SphereGeometry(0.15, 12, 10), eyeW, 0.5 * s, 0.42, 0.42);
    add(head, new THREE.SphereGeometry(0.08, 10, 8), pupil, 0.58 * s, 0.43, 0.48);
    add(head, new THREE.SphereGeometry(0.06, 6, 5), pupil, 0.22 * s, 0.38, 1.6); // narinas
    // Dentes de cima (apontando para baixo).
    for (let i = 0; i < 7; i++) {
      const t = add(head, new THREE.ConeGeometry(0.065 - i * 0.003, 0.24, 5), claw, (0.42 - i * 0.014) * s, -0.3, 0.42 + i * 0.17);
      t.rotation.x = Math.PI;
    }
  }
  add(head, new THREE.ConeGeometry(0.07, 0.24, 5).rotateX(Math.PI), claw, 0, -0.3, 1.58); // dente da frente
  // Mandíbula (abre para baixo).
  const jaw = grp(head, 0, -0.26, 0.1);
  add(jaw, new THREE.CapsuleGeometry(0.4, 0.85, 6, 12).rotateX(Math.PI / 2).scale(0.92, 0.6, 1), skin, 0, -0.2, 0.8);
  add(jaw, sph(0.36, 0.95, 0.55, 1.1), belly, 0, -0.28, 0.45); // papo claro
  add(jaw, sph(0.46, 0.76, 0.16, 1.3), mouth, 0, -0.02, 0.78); // dentro da boca
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) add(jaw, new THREE.ConeGeometry(0.055, 0.19, 5), claw, (0.33 - i * 0.014) * s, 0.06, 0.45 + i * 0.17);
  // Língua (estica na lambida).
  const tongue = grp(jaw, 0, 0.02, 0.35);
  const tongueMesh = add(tongue, new THREE.CapsuleGeometry(0.13, 0.8, 4, 10).rotateX(Math.PI / 2).translate(0, 0, 0.5).scale(1.45, 0.45, 1), tongueM);
  const tongueTip = grp(tongue, 0, 0, 1.0);

  // Bracinhos (ridículos e bravos).
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = grp(body, 0.72 * s, 0.15, 1.85);
    limb(sh, V(0, 0, 0), V(0.05 * s, -0.35, 0.22), 0.13, 0.1, skin);
    const el = grp(sh, 0.05 * s, -0.35, 0.22);
    limb(el, V(0, 0, 0), V(0, -0.08, 0.32), 0.09, 0.07, skin);
    for (const c of [-1, 1]) { const k = add(el, new THREE.ConeGeometry(0.035, 0.14, 4), claw, 0.04 * c, -0.1, 0.38); k.rotation.x = Math.PI / 2 + 0.4; }
    arms.push({ sh, el, s });
  }

  // ---------- Pernas ----------
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = grp(lift, 0.98 * s, D.hip + 0.15, -0.35);
    add(hip, sph(0.62, 1.0, 1.2, 1.05), skin, 0.05 * s, -0.42, 0.12, true); // coxa grossa
    const knee = grp(hip, 0, -1.0, 0.38);
    limb(knee, V(0, 0, 0), V(0, -0.92, -0.42), 0.32, 0.2, skin);
    const ankle = grp(knee, 0, -0.92, -0.42);
    limb(ankle, V(0, 0, 0), V(0, -0.55, 0.16), 0.18, 0.14, skin);
    const foot = grp(ankle, 0, -0.58, 0.16);
    add(foot, sph(0.26, 1.1, 0.45, 1.25), skin, 0, 0.02, 0.08);
    for (const c of [-1, 0, 1]) {
      limb(foot, V(c * 0.13, 0, 0.1), V(c * 0.24, -0.03, 0.5), 0.09, 0.07, skin);
      const k = add(foot, new THREE.ConeGeometry(0.06, 0.2, 5), claw, c * 0.26, -0.03, 0.6); k.rotation.x = Math.PI / 2;
    }
    legs.push({ hip, knee, ankle, foot, s });
  }

  // ---------- Cauda ----------
  const tail = [];
  let parent = body, r0 = 0.82;
  const tailLen = [0.95, 0.95, 0.9, 0.85, 0.8, 0.72, 0.6];
  let tz = -1.25;
  for (let i = 0; i < tailLen.length; i++) {
    const L = tailLen[i], r1 = Math.max(0.08, r0 * 0.74);
    const seg = grp(parent, 0, i === 0 ? 0.32 : 0, i === 0 ? tz : -tailLen[i - 1]);
    add(seg, new THREE.CylinderGeometry(r1, r0, L, 12).rotateX(-Math.PI / 2).translate(0, 0, -L / 2), skin, 0, 0, 0, i < 3);
    add(seg, sph(r0 * 0.98, 1, 1, 1, 12, 8), skin, 0, 0, 0);
    add(seg, new THREE.CylinderGeometry(r1 * 0.55, r0 * 0.55, L, 8).rotateX(-Math.PI / 2).translate(0, r0 * 0.5, -L / 2), back, 0, 0, 0); // faixa escura
    if (i < 5) { const sc = add(seg, new THREE.ConeGeometry(0.12 * (1 - i * 0.12), 0.26, 5), scute, 0, r0 * 0.9, -L * 0.5); sc.rotation.x = -0.5; sc.userData.base = 0.8 - i * 0.1; spikes.push(sc); }
    tail.push(seg); parent = seg; r0 = r1;
  }

  // ---------- Asas (dragão) ----------
  const wings = [];
  for (const s of [-1, 1]) {
    const root = grp(body, 0.7 * s, 1.0, 1.0);
    const fold = grp(root, 0, 0, 0);
    const E = V(1.7 * s, 0.65, -0.15), H = V(3.5 * s, 0.75, -0.6);
    const T1 = V(4.5 * s, 0.2, -1.5), T2 = V(3.7 * s, 0.0, -2.4), T3 = V(2.3 * s, 0.05, -2.5), B = V(0.2 * s, 0, -1.7);
    limb(fold, V(0, 0, 0), E, 0.13, 0.1, boneMat); limb(fold, E, H, 0.1, 0.07, boneMat);
    for (const T of [T1, T2, T3]) limb(fold, H, T, 0.05, 0.025, boneMat);
    add(fold, new THREE.ConeGeometry(0.08, 0.35, 5), claw, H.x + 0.12 * s, H.y + 0.2, H.z + 0.1).rotation.z = -0.5 * s;
    const pts = [V(0, 0, 0), E, H, T1, T2, T3, B];
    const pos = [];
    for (let i = 1; i < pts.length - 1; i++) for (const p of [pts[0], pts[i], pts[i + 1]]) pos.push(p.x, p.y, p.z);
    // Membrana um pouco curvada para dentro entre os dedos.
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); mg.computeVertexNormals();
    add(fold, mg, wingMat);
    root.scale.setScalar(0.001); root.visible = false;
    wings.push({ root, fold, s });
  }

  g.traverse((o) => { if (o.isMesh && o !== shadow) { o.castShadow = false; o.receiveShadow = false; } });

  // ---------- Estado / pose ----------
  // P = pose atual (vai suavemente até T = pose pedida).
  const BASE = { bodyY: 0, pitch: 0, roll: 0, neckX: 0, headX: 0, headYaw: 0, jaw: 0.06, tongue: 0, crouch: 0, armX: 0, flyH: 0, tuck: 0 };
  const P = { ...BASE }, T = { ...BASE };
  const v = {
    g, lift, body, head, jaw, neck, seat, tongueTip, parts, legs, wings, tail,
    time: 0, flashV: 0, flashC: [1, 1, 1], dark: 0, wingK: 0, hpK: 1, glow: 0,
  };
  const darkCol = new THREE.Color(), cA = new THREE.Color(), cB = new THREE.Color();
  const baseCol = new Map([[skin, COLORS.skin], [back, COLORS.back], [belly, COLORS.belly], [scute, COLORS.scute], [claw, COLORS.claw], [mouth, COLORS.mouth]]);
  let darkDone = -1;
  function applyDark() {
    const k = v.dark;
    if (Math.abs(k - darkDone) < 0.002) return;
    darkDone = k;
    for (const [m, [a, b]] of baseCol) { cA.setHex(a); cB.setHex(b); m.color.copy(cA).lerp(cB, k); }
    eyeW.color.setRGB(1, lerp(0.96, 0.18, k), lerp(0.86, 0.06, k));
    pupil.color.setRGB(lerp(0.1, 1, k), lerp(0.07, 0.75, k), lerp(0.04, 0.2, k));
  }
  v.pose = () => P;

  // s: { mode, walk, phase, k, look (yaw relativo da cabeça) }
  function target(s, out) {
    Object.assign(out, BASE);
    const t = v.time, k = s.k || 0, w = s.walk || 0;
    out.headYaw = Math.max(-0.6, Math.min(0.6, s.look || 0));
    out.neckX = Math.sin(t * 1.7) * 0.04; // respiração
    out.jaw = 0.06 + Math.max(0, Math.sin(t * 0.9)) * 0.05;
    out.pitch = -0.04 + w * 0.06;
    out.headX = -w * 0.08;
    out.flyH = v.wingK > 0.5 ? 1.5 + Math.sin(t * 3.5) * 0.25 : 0;
    out.tuck = v.wingK;
    switch (s.mode) {
      case 'bite':
        out.neckX = lerp(-0.35, 0.55, seg(k, 0.32, 0.5)) * (1 - seg(k, 0.65, 1));
        out.headX = lerp(-0.25, 0.25, seg(k, 0.32, 0.5)) * (1 - seg(k, 0.65, 1));
        out.jaw = k < 0.42 ? lerp(0.1, 1.0, seg(k, 0, 0.3)) : lerp(1.0, 0.0, seg(k, 0.42, 0.5));
        out.pitch = 0.12 * bell(k, 0.3, 0.75);
        break;
      case 'shred':
        out.neckX = 0.45; out.headX = 0.15 + Math.sin(t * 38) * 0.08;
        out.headYaw = Math.sin(t * 26) * 0.55 * (1 - seg(k, 0.8, 1));
        out.jaw = k > 0.82 ? lerp(0.12, 0.9, seg(k, 0.82, 0.9)) : 0.12;
        out.roll = Math.sin(t * 26) * 0.06; out.pitch = 0.1;
        break;
      case 'roar':
        out.neckX = -0.45 * bell(k, 0, 1.1); out.headX = -0.5 * bell(k, 0.05, 1.05) + Math.sin(t * 50) * 0.04 * bell(k, 0.2, 0.9);
        out.jaw = 1.15 * bell(k, 0.05, 1.05); out.crouch = 0.25 * bell(k, 0, 1); out.armX = -0.8 * bell(k, 0.1, 1);
        break;
      case 'lick':
        out.neckX = 0.55 * bell(k, 0, 1.05); out.headX = 0.35 * bell(k, 0, 1.05);
        out.jaw = 0.55 * bell(k, 0.05, 1); out.tongue = bell(k, 0.15, 0.95);
        out.crouch = 0.35 * bell(k, 0, 1.05);
        break;
      case 'spit':
        out.neckX = k < 0.4 ? -0.35 * seg(k, 0, 0.4) : lerp(-0.35, 0.3, seg(k, 0.4, 0.5)) * (1 - seg(k, 0.6, 1));
        out.headX = k < 0.4 ? -0.3 * seg(k, 0, 0.4) : 0.1;
        out.jaw = k < 0.38 ? 0.2 : 1.1 * (1 - seg(k, 0.6, 1));
        break;
      case 'kneel':
        out.crouch = 0.8 * (s.k ?? 1); out.neckX = 0.3 * (s.k ?? 1); out.headX = 0.1;
        break;
      case 'morph':
        out.neckX = -0.55 * bell(k, 0, 1); out.headX = -0.4 * bell(k, 0, 1);
        out.jaw = 1.2 * bell(k, 0.05, 1); out.crouch = 0.3 * bell(k, 0, 0.5); out.roll = Math.sin(t * 30) * 0.04 * bell(k, 0, 0.6);
        out.flyH = 1.5 * seg(k, 0.55, 1);
        break;
      case 'dying':
        out.neckX = 0.5 * k; out.headX = 0.4 * k + Math.sin(t * 20) * 0.1 * (1 - k); out.jaw = 0.7;
        out.roll = Math.sin(t * 9) * 0.12 * k; out.crouch = 0.5 * k; out.flyH = (v.wingK > 0.5 ? 1.5 : 0) * (1 - k * 0.6);
        break;
      default: break;
    }
    if (w > 0.05 && s.mode !== 'shred') { out.headX += Math.sin((s.phase || 0) * 2) * 0.05 * w; }
  }

  v.update = (dt, s) => {
    v.time += dt;
    target(s, T);
    const fast = s.mode === 'bite' || s.mode === 'shred' || s.mode === 'spit';
    const r = 1 - Math.exp(-(fast ? 26 : 10) * dt);
    for (const key in T) P[key] += (T[key] - P[key]) * r;
    apply(dt, s);
  };
  v.snap = (s) => { target(s, T); Object.assign(P, T); apply(0, s); };

  function apply(dt, s) {
    const t = v.time, w = s.walk || 0, ph = s.phase || 0, fly = v.wingK;
    lift.position.y = P.flyH;
    // Corpo: sobe e desce com o passo, abaixa no rugido/lambida, inclina.
    const bob = Math.abs(Math.sin(ph)) * 0.14 * w * (1 - fly);
    body.position.y = D.hip - P.crouch * 0.9 + bob;
    body.rotation.set(P.pitch + fly * 0.12, 0, P.roll + Math.sin(ph) * 0.04 * w);
    neck.rotation.set(P.neckX, P.headYaw * 0.4, 0);
    head.rotation.set(P.headX, P.headYaw * 0.6, 0);
    jaw.rotation.x = P.jaw * 0.75;
    tongue.scale.set(1, 1, 0.35 + P.tongue * 1.9);
    tongue.rotation.x = -0.15 * P.tongue + Math.sin(t * 18) * 0.25 * P.tongue;
    tongue.rotation.y = Math.sin(t * 13) * 0.2 * P.tongue;
    tongueMesh.visible = P.tongue > 0.02 || P.jaw > 0.4;
    for (const a of arms) { a.sh.rotation.x = -0.4 + P.armX + Math.sin(t * 2.2 + a.s) * 0.08; a.el.rotation.x = 0.6 + Math.sin(t * 3 + a.s) * 0.1; }
    // Pernas: passo alternado (no voo encolhem); ajoelhado dobra.
    for (const L of legs) {
      const p2 = ph + (L.s > 0 ? 0 : Math.PI);
      const swing = Math.sin(p2) * 0.55 * w * (1 - fly);
      const lifted = Math.max(0, -Math.cos(p2)) * 0.7 * w * (1 - fly);
      const cr = P.crouch;
      L.hip.position.y = D.hip + 0.15 - cr * 0.9 + bob;
      L.hip.rotation.x = swing - cr * 0.55 - fly * 0.7;
      L.knee.rotation.x = lifted + cr * 0.95 + fly * 1.3;
      L.ankle.rotation.x = -(swing - cr * 0.55) * 0.6 - lifted * 0.9 - cr * 0.55 + fly * 0.2;
      L.foot.rotation.x = -L.ankle.rotation.x * 0.5 - L.knee.rotation.x * 0.3 - L.hip.rotation.x * 0.2 + fly * 0.5;
    }
    // Cauda: balança (mais andando), levanta um pouco no fim.
    tail.forEach((sg, i) => {
      sg.rotation.y = Math.sin(t * (2 + w * 3) - i * 0.6) * (0.07 + w * 0.06 + fly * 0.04) * (1 + i * 0.15) + Math.sin(ph) * 0.05 * w;
      sg.rotation.x = (i === 0 ? 0.05 : -0.04) + Math.sin(t * 1.7 - i * 0.5) * 0.02 + (s.mode === 'roar' ? 0.06 * Math.sin(t * 30 - i) : 0);
    });
    // Asas: aparecem no dragão e batem.
    for (const W of wings) {
      const k = v.wingK;
      W.root.visible = k > 0.01;
      W.root.scale.setScalar(Math.max(0.001, k));
      const flap = fly > 0.5 ? Math.sin(t * 7.5) * 0.55 : 0;
      W.root.rotation.set(-0.1, W.s * (0.2 - k * 0.15), W.s * (flap + 0.15 + (1 - k) * 1.2));
      W.fold.rotation.y = W.s * (1 - k) * 0.9;
    }
    // Espinhos crescem no dragão.
    for (const sp of spikes) sp.scale.set(1 + v.dark * 0.4, (sp.userData.base || 1) * (1 + v.dark * 1.6), 1 + v.dark * 0.4);
    // Cor (verde → negro) e brilhos.
    applyDark();
    const glow = v.dark * (0.7 + 0.3 * Math.sin(t * 6)) + v.glow;
    mouth.emissiveIntensity = glow * 1.3; mouth.userData.ei = mouth.emissiveIntensity;
    scute.emissive.setRGB(0.9 * v.dark, 0.15 * v.dark, 0.05 * v.dark); scute.emissiveIntensity = 0.6 + 0.3 * Math.sin(t * 5); scute.userData.e.copy(scute.emissive); scute.userData.ei = scute.emissiveIntensity;
    // Clarão ao apanhar.
    v.flashV = Math.max(0, v.flashV - dt * 4.5);
    const f = v.flashV;
    for (const m of flashMats) {
      m.emissive.setRGB(lerp(m.userData.e.r, v.flashC[0], f), lerp(m.userData.e.g, v.flashC[1], f), lerp(m.userData.e.b, v.flashC[2], f));
      m.emissiveIntensity = lerp(m.userData.ei, 0.9, f);
    }
  }
  v.flash = (amt = 1, r = 1, gg = 0.9, b = 0.8) => { v.flashV = Math.max(v.flashV, amt); v.flashC = [r, gg, b]; };
  // Clipping (saindo do portal): só desenha o que já passou do plano.
  v.clip = (plane) => { for (const m of [...flashMats, eyeW, pupil]) { m.clippingPlanes = plane ? [plane] : null; m.needsUpdate = true; } };
  v.dispose = () => {
    g.traverse((o) => { if (o.isMesh && o.geometry && o !== shadow) o.geometry.dispose(); });
    for (const m of [...flashMats, eyeW, pupil]) m.dispose();
  };
  v.snap({ mode: 'idle' });
  g.scale.setScalar(opts.scale || 1);
  // Onde fica a boca (no corpo parado, olhando para +z): o kit mede alcance da mordida e a lambida por isto.
  g.updateMatrixWorld(true);
  const mp = head.localToWorld(new THREE.Vector3(0, -0.3, 1.25));
  v.mouthAhead = mp.z; v.mouthY = mp.y;
  return v;
}
