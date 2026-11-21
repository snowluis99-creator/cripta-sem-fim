// Gigante de Aço (lendária da Manopla, pedido do dono, 12/11/2026): o robô boxeador gigante, montado em código.
// Peças no estilo do jogo (flat shading): couraça de aço azul-escuro com frisos dourados, luvas de boxe vermelhas
// enormes com punho branco, protetor de cabeça vermelho, viseira e núcleo do peito azuis acesos, calção de boxe.
// As juntas (quadril, joelho, cintura, ombro, cotovelo, pescoço) vêm de uma "pose" calculada a cada quadro:
// guarda (balançando), andar, jab, direto, gancho de baixo, cruzado, guarda fechada, esquiva, nocaute (caído de
// costas e levantando aos poucos), soquinho de punho na chegada e comemoração.
import * as THREE from 'three';
import { makeBlobShadow } from './characters.js';

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };
const seg = (k, a, b) => clamp01((k - a) / (b - a));
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export const GIANT_DIM = { hipY: 2.1, thigh: 0.95, shin: 0.95, shoulderY: 1.62, shoulderX: 1.18, upper: 0.8, fore: 0.72, height: 5.1 };

// Caixa que muda de largura em cima (tx, tz = quanto da largura/profundidade sobra no topo).
function taper(w, h, d, tx = 1, tz = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * tx); p.setZ(i, p.getZ(i) * tz); }
  g.computeVertexNormals();
  return g;
}

let haloTex = null;
function glowTexture() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}

// ---------- Poses ----------
// Ângulos em radianos. Braço solto aponta para baixo; ombro com x negativo levanta o braço para a frente;
// cotovelo com x negativo dobra o antebraço para a frente/cima. Z do ombro: positivo abre o braço para fora.
const GUARD = {
  lift: 0, tilt: 0, roll: 0, bend: 0.28, twist: 0, lean: 0.12, side: 0, headX: 0.05, headY: 0,
  lShX: -0.62, lShZ: -0.22, lShY: 0, lElX: -2.2, rShX: -0.5, rShZ: -0.22, rShY: 0, rElX: -2.3,
  lHip: 0, lKnee: 0, rHip: 0, rKnee: 0, eye: 1,
};
const BLOCK = { bend: 0.4, lean: 0.22, headX: 0.3, lShX: -1.05, lShZ: -0.42, lShY: -0.25, lElX: -2.35, rShX: -1.05, rShZ: -0.42, rShY: -0.25, rElX: -2.35 };
const LYING = { lift: 0.62, tilt: -Math.PI / 2, roll: 0, bend: 0, twist: 0, lean: 0, side: 0, headX: -0.2, headY: 0.5, lShX: -0.3, lShZ: 1.1, lShY: 0, lElX: -0.4, rShX: -0.2, rShZ: -1.3, rShY: 0, rElX: -0.6, lHip: -0.15, lKnee: 0.4, rHip: 0.1, rKnee: 0.05, eye: 0 };
const KNEEL = { lift: 0, tilt: 0, roll: 0, bend: 0, twist: 0.1, lean: 0.45, side: 0, headX: 0.4, headY: 0, lShX: -0.9, lShZ: 0.2, lShY: 0, lElX: -0.6, rShX: 0.1, rShZ: -0.35, rShY: 0, rElX: -0.4, lHip: -1.45, lKnee: 1.6, rHip: 0.35, rKnee: 1.95, kneelY: -0.95, eye: 0.6 };

function mix(out, a, b, k) { for (const key in b) out[key] = lerp(a[key] ?? out[key] ?? 0, b[key], k); return out; }

// s = { mode, k, t, walk, phase, guard, which }
// mode: 'guard' | 'punch' (which 0..3, k 0..1) | 'block' | 'weave' (k, dir) | 'ko' (k: 0 = caindo, depois deitado; rise 0..1)
//       | 'drop' (k: caindo do céu, aterrissa agachado) | 'bump' (k) | 'cheer' (t)
function targetPose(s, P) {
  Object.assign(P, GUARD); P.kneelY = 0;
  const t = s.t || 0;
  // Balanço de boxeador (sobe e desce, troca o peso).
  const bob = Math.sin(t * 5.2);
  P.bend += 0.05 * bob; P.side = 0.04 * Math.sin(t * 2.6); P.lShX += 0.05 * bob; P.rShX -= 0.05 * bob;
  const w = s.walk || 0;
  if (w > 0.01) { // andar: pernas alternando, tronco firme
    const ph = s.phase || 0, sw = Math.sin(ph) * 0.55 * w;
    P.lHip = -sw; P.rHip = sw; P.lKnee = Math.max(0, Math.sin(ph + 1.4)) * 0.75 * w; P.rKnee = Math.max(0, Math.sin(ph + 1.4 + Math.PI)) * 0.75 * w;
    P.twist = Math.sin(ph) * 0.12 * w; P.lean += 0.08 * w;
  }
  if (s.mode === 'block') { mix(P, P, BLOCK, clamp01(s.k ?? 1)); P.bend += 0.03 * bob; return P; }
  if (s.mode === 'punch') {
    const k = s.k, wind = smooth(seg(k, 0, 0.3)), hit = smooth(seg(k, 0.28, 0.46)), back = smooth(seg(k, 0.6, 1));
    const out = hit * (1 - back);
    if (s.which === 0) { // jab de esquerda
      P.lShX = lerp(lerp(GUARD.lShX, -0.4, wind), -1.52, out); P.lShZ = lerp(GUARD.lShZ, -0.12, out); P.lElX = lerp(lerp(GUARD.lElX, -2.4, wind), -0.08, out);
      P.twist = lerp(-0.12 * wind, -0.35, out); P.lean += 0.12 * out;
    } else if (s.which === 1) { // direto de direita
      P.rShX = lerp(lerp(GUARD.rShX, -0.3, wind), -1.55, out); P.rShZ = lerp(GUARD.rShZ, -0.1, out); P.rElX = lerp(lerp(GUARD.rElX, -2.4, wind), -0.05, out);
      P.twist = lerp(0.25 * wind, 0.55, out); P.lean += 0.15 * out; P.lShX = lerp(GUARD.lShX, -0.8, out);
    } else if (s.which === 2) { // gancho de baixo (uppercut) de esquerda
      P.bend += 0.35 * wind * (1 - out); P.lean += 0.2 * wind - 0.25 * out;
      P.lShX = lerp(lerp(GUARD.lShX, 0.1, wind), -2.4, out); P.lShZ = lerp(GUARD.lShZ, -0.15, out); P.lElX = lerp(lerp(GUARD.lElX, -1.7, wind), -1.35, out);
      P.twist = lerp(0.2 * wind, -0.4, out); P.headX -= 0.2 * out;
    } else { // cruzado de direita (o "boliche"): arma bem para trás e explode para a frente
      const W2 = smooth(seg(k, 0, 0.36)), H2 = smooth(seg(k, 0.34, 0.5)), O = H2 * (1 - smooth(seg(k, 0.7, 1)));
      P.rShX = lerp(lerp(GUARD.rShX, 0.25, W2), -1.45, O); P.rShZ = lerp(lerp(GUARD.rShZ, 0.65, W2), -0.05, O); P.rShY = lerp(0.4 * W2, -0.2, O);
      P.rElX = lerp(lerp(GUARD.rElX, -1.2, W2), -0.1, O);
      P.twist = O > 0 ? lerp(-0.7 * W2, 0.65, O) : -0.7 * W2 * (1 - back);
      P.lean += 0.05 * W2 + 0.25 * O; P.bend += 0.12 * W2; P.lShX = lerp(GUARD.lShX, -0.9, O);
      P.lHip = -0.35 * O; P.rHip = 0.3 * O; P.rKnee = 0.3 * O;
    }
    return P;
  }
  if (s.mode === 'weave') { // esquiva: abaixa e balança o tronco para o lado
    const k = Math.sin(clamp01(s.k) * Math.PI), d = s.dir || 1;
    mix(P, P, BLOCK, k * 0.7);
    P.bend += 0.55 * k; P.side = -0.45 * k * d; P.roll = -0.12 * k * d; P.lean += 0.2 * k;
    return P;
  }
  if (s.mode === 'drop') { // caindo do céu: pernas juntas, braços para cima; no fim, agachado
    const land = smooth(seg(s.k, 0.75, 1));
    P.bend = lerp(0.1, 0.95, land); P.lean = lerp(-0.05, 0.4, land);
    P.lShX = lerp(-2.7, -0.5, land); P.rShX = lerp(-2.7, -0.1, land); P.lElX = lerp(-0.3, -1.5, land); P.rElX = lerp(-0.3, -1.2, land);
    P.lShZ = lerp(0.3, 0.25, land); P.rShZ = lerp(-0.3, -0.3, land);
    return P;
  }
  if (s.mode === 'bump') { // abaixa e estica o punho para o Cavaleiro bater
    const k = smooth(s.k);
    P.bend = lerp(GUARD.bend, 0.95, k); P.lean = lerp(GUARD.lean, 0.62, k); P.headX = lerp(0.05, 0.25, k);
    P.rShX = lerp(GUARD.rShX, -0.62, k); P.rShZ = lerp(GUARD.rShZ, -0.12, k); P.rElX = lerp(GUARD.rElX, -0.25, k);
    P.lShX = lerp(GUARD.lShX, -0.2, k); P.lElX = lerp(GUARD.lElX, -1.4, k);
    return P;
  }
  if (s.mode === 'cheer') { // braços para cima, comemorando
    const a = Math.sin(t * 7) * 0.15;
    P.lShX = -2.8 + a; P.rShX = -2.8 - a; P.lShZ = 0.35; P.rShZ = -0.35; P.lElX = -0.5; P.rElX = -0.5; P.bend = 0.15 + 0.1 * Math.abs(Math.sin(t * 7)); P.headX = -0.25;
    return P;
  }
  if (s.mode === 'ko') {
    // k: tempo de queda (0..1); rise: 0..1 (deitado -> de joelho -> em pé).
    const fall = smooth(s.k ?? 1), r = s.rise || 0;
    if (r <= 0) {
      mix(P, GUARD, LYING, fall);
      if (fall >= 1) { P.headY = 0.5 + 0.1 * Math.sin(t * 1.3); P.rElX += 0.08 * Math.sin(t * 2.1); }
      P.eye = (1 - fall) + (s.flick || 0);
      return P;
    }
    const a = smooth(seg(r, 0, 0.55)), b = smooth(seg(r, 0.55, 1));
    if (a < 1) { mix(P, { ...GUARD, ...LYING }, { ...GUARD, ...KNEEL }, a); P.eye = lerp(0, 0.6, a); return P; }
    mix(P, { ...GUARD, ...KNEEL }, GUARD, b); P.eye = lerp(0.6, 1, b);
    return P;
  }
  return P;
}

// ---------- Modelo ----------
export function makeGiant(opts = {}) {
  const D = GIANT_DIM;
  const flashMats = [];
  const std = (color, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.35, flatShading: true, ...o });
    m.userData.e = m.emissive.clone(); m.userData.ei = m.emissiveIntensity;
    flashMats.push(m); return m;
  };
  const armor = std(0x5a7aa8, { emissive: 0x16284a, emissiveIntensity: 0.7 });
  const steel = std(0xb9c3d3);
  const joint = std(0x262c38, { roughness: 0.75 });
  const gold = std(0xf2c14e, { emissive: 0x7a4a00, emissiveIntensity: 0.45, metalness: 0.5, roughness: 0.3 });
  const red = std(0xd5242c, { roughness: 0.42, metalness: 0.15, emissive: 0x3a0000, emissiveIntensity: 0.4 });
  const white = std(0xf1ede4, { roughness: 0.6, metalness: 0.05 });
  const shorts = std(opts.shorts ?? 0x1c3f9a, { roughness: 0.8, metalness: 0.05 });
  const glowCol = new THREE.Color(0x6fe8ff);
  const eye = new THREE.MeshBasicMaterial({ color: glowCol.clone() });
  const halo = (size, color) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(size); return s;
  };
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = null) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; if (parent) parent.add(m); return m; };

  const g = new THREE.Group(); g.name = 'giant';
  const shadow = makeBlobShadow(4.2 * (opts.scale || 1)); g.add(shadow);
  const inner = new THREE.Group(); inner.scale.setScalar(opts.scale || 1); g.add(inner); // tamanho do robô
  const tiltG = new THREE.Group(); inner.add(tiltG);            // tomba o robô inteiro (nocaute) a partir dos pés
  const rollG = new THREE.Group(); tiltG.add(rollG);        // balanço para o lado (esquiva)
  const body = new THREE.Group(); rollG.add(body);          // sobe e desce (dobra das pernas)
  body.position.y = D.hipY;

  // Quadril + calção de boxe com faixa dourada.
  mesh(taper(1.35, 0.62, 0.86, 1.08, 1.05), shorts, 0, -0.05, 0, body);
  mesh(new THREE.BoxGeometry(1.48, 0.2, 0.96), gold, 0, 0.3, 0, body);
  const legs = [];
  for (const sx of [1, -1]) {
    const hip = new THREE.Group(); hip.position.set(0.42 * sx, -0.18, 0); body.add(hip);
    mesh(new THREE.BoxGeometry(0.62, 0.42, 0.7), shorts, 0, -0.12, 0, hip); // perna do calção
    mesh(taper(0.5, D.thigh, 0.56, 1.15, 1.1), armor, 0, -D.thigh / 2 - 0.05, 0, hip);
    const knee = new THREE.Group(); knee.position.y = -D.thigh - 0.05; hip.add(knee);
    mesh(new THREE.SphereGeometry(0.27, 10, 8), joint, 0, 0, 0, knee);
    mesh(new THREE.BoxGeometry(0.34, 0.26, 0.2), steel, 0, 0, 0.22, knee); // joelheira
    mesh(taper(0.46, D.shin, 0.52, 1.18, 1.1), armor, 0, -D.shin / 2, 0, knee);
    mesh(new THREE.BoxGeometry(0.5, 0.36, 0.56), white, 0, -D.shin + 0.08, 0, knee); // bota de boxe (cano)
    const foot = new THREE.Group(); foot.position.y = -D.shin; knee.add(foot);
    mesh(new THREE.BoxGeometry(0.56, 0.24, 0.9), white, 0, -0.08, 0.15, foot);
    mesh(new THREE.BoxGeometry(0.58, 0.07, 0.92), joint, 0, -0.18, 0.15, foot);
    legs.push({ hip, knee, foot });
  }

  // Cintura (gira) e tronco.
  const waist = new THREE.Group(); waist.position.y = 0.32; body.add(waist);
  mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.42, 10), joint, 0, 0.15, 0, waist);
  mesh(taper(1.25, 0.55, 0.82, 1.15, 1.08), armor, 0, 0.55, 0, waist); // barriga
  for (const sx of [-0.25, 0.25]) for (const y of [0.42, 0.66]) mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), steel, sx, y, 0.44, waist); // gomos
  const chest = mesh(taper(1.7, 1.15, 1.0, 1.32, 1.12), armor, 0, 1.38, 0, waist);
  mesh(new THREE.BoxGeometry(2.0, 0.16, 1.02), gold, 0, 1.9, 0.02, waist); // friso dos ombros
  mesh(taper(1.25, 0.8, 0.12, 1.25, 1), steel, 0, 1.4, 0.56, waist); // placa do peito
  const core = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 16), eye, 0, 1.38, 0.63, waist); core.rotation.x = Math.PI / 2; core.castShadow = false;
  mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 18), gold, 0, 1.38, 0.64, waist);
  const coreHalo = halo(1.5, 0x6fe8ff); coreHalo.position.set(0, 1.38, 0.75); waist.add(coreHalo);
  // Costas: dois exaustores.
  for (const sx of [-0.42, 0.42]) { const ex = mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.6, 8), joint, sx, 1.7, -0.55, waist); ex.rotation.x = -0.35; }

  // Cabeça com protetor vermelho, viseira azul e grade da boca.
  const neck = new THREE.Group(); neck.position.y = 1.98; waist.add(neck);
  mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.3, 8), joint, 0, 0.08, 0, neck);
  const head = new THREE.Group(); head.position.y = 0.2; neck.add(head);
  mesh(taper(0.72, 0.72, 0.74, 0.9, 0.92), steel, 0, 0.36, 0.02, head);
  mesh(taper(0.86, 0.34, 0.86, 0.82, 0.86), red, 0, 0.66, -0.02, head); // topo do protetor
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.14, 0.5, 0.62), red, 0.43 * sx, 0.42, -0.02, head); // protetor das orelhas
  mesh(new THREE.BoxGeometry(0.88, 0.1, 0.12), white, 0, 0.56, 0.38, head); // faixa da testa
  const visor = mesh(new THREE.BoxGeometry(0.6, 0.12, 0.06), eye, 0, 0.4, 0.4, head); visor.castShadow = false;
  const eyeHalo = halo(1.1, 0x6fe8ff); eyeHalo.position.set(0, 0.4, 0.48); head.add(eyeHalo);
  for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.05, 0.16, 0.04), joint, -0.15 + i * 0.1, 0.15, 0.4, head);

  // Braços: ombreira, braço, cotovelo, antebraço e a luva de boxe.
  const arms = [];
  for (const sx of [1, -1]) {
    const sh = new THREE.Group(); sh.position.set(D.shoulderX * sx, D.shoulderY, 0); waist.add(sh);
    sh.rotation.order = 'YXZ';
    mesh(new THREE.SphereGeometry(0.42, 10, 8), armor, 0, 0, 0, sh);
    const pad = mesh(taper(0.75, 0.32, 0.8, 0.7, 0.75), steel, 0.12 * sx, 0.25, 0, sh); pad.rotation.z = -0.25 * sx;
    mesh(new THREE.BoxGeometry(0.6, 0.08, 0.66), gold, 0.12 * sx, 0.1, 0, sh).rotation.z = -0.25 * sx;
    mesh(taper(0.38, D.upper, 0.4, 1.12, 1.12), joint, 0, -D.upper / 2, 0, sh);
    mesh(new THREE.BoxGeometry(0.44, D.upper * 0.6, 0.3), armor, 0, -D.upper / 2, 0.08, sh);
    const el = new THREE.Group(); el.position.y = -D.upper; sh.add(el);
    mesh(new THREE.SphereGeometry(0.24, 10, 8), joint, 0, 0, 0, el);
    mesh(taper(0.36, D.fore, 0.38, 1.3, 1.3), armor, 0, -D.fore / 2, 0, el);
    const glove = new THREE.Group(); glove.position.y = -D.fore - 0.08; el.add(glove);
    mesh(new THREE.CylinderGeometry(0.33, 0.3, 0.26, 12), white, 0, 0.05, 0, glove); // punho branco
    mesh(new THREE.TorusGeometry(0.33, 0.04, 6, 14), gold, 0, -0.06, 0, glove).rotation.x = Math.PI / 2;
    const ball = mesh(new THREE.SphereGeometry(0.5, 14, 10), red, 0, -0.42, 0.06, glove); ball.scale.set(0.92, 1.05, 1.0);
    mesh(new THREE.SphereGeometry(0.22, 10, 8), red, 0.3 * sx, -0.28, 0.24, glove); // dedão
    const lace = mesh(new THREE.BoxGeometry(0.12, 0.3, 0.06), white, 0, -0.08, -0.33, glove); lace.castShadow = false;
    arms.push({ sh, el, glove, sx });
  }

  const v = {
    g, body, waist, neck, head, arms, legs, core, tiltG, rollG,
    get gloves() { return [arms[0].glove, arms[1].glove]; },
    P: { ...GUARD, kneelY: 0 }, tmp: { ...GUARD, kneelY: 0 }, flashV: 0, flashC: [1, 1, 1], time: 0, glow: 1,
  };
  // Aplica uma pose nas juntas.
  const apply = (P) => {
    tiltG.position.y = P.lift; tiltG.rotation.x = P.tilt; rollG.rotation.z = P.roll;
    const b = P.bend, L = D.thigh + 0.05, S = D.shin;
    const drop = L * (1 - Math.cos(b)) + S * (1 - Math.cos(b)) * 0.5;
    body.position.y = D.hipY - drop + (P.kneelY || 0);
    body.position.z = 0;
    const [lL, rL] = legs;
    lL.hip.rotation.x = -b * 0.75 + P.lHip; lL.knee.rotation.x = b * 1.5 + P.lKnee; lL.foot.rotation.x = -b * 0.75 - P.lHip * 0.3 - P.lKnee * 0.5;
    rL.hip.rotation.x = -b * 0.75 + P.rHip; rL.knee.rotation.x = b * 1.5 + P.rKnee; rL.foot.rotation.x = -b * 0.75 - P.rHip * 0.3 - P.rKnee * 0.5;
    lL.hip.rotation.z = 0.06; rL.hip.rotation.z = -0.06;
    waist.rotation.set(P.lean, P.twist, P.side);
    neck.rotation.set(P.headX - P.lean * 0.6, P.headY - P.twist * 0.5, -P.side * 0.5);
    const [la, ra] = arms;
    la.sh.rotation.set(P.lShX, P.lShY * la.sx, P.lShZ * la.sx); la.el.rotation.x = P.lElX; // y e z: positivo = para fora
    ra.sh.rotation.set(P.rShX, P.rShY * ra.sx, P.rShZ * ra.sx); ra.el.rotation.x = P.rElX;
    // Luvas olham para a frente do antebraço.
    la.glove.rotation.x = 0; ra.glove.rotation.x = 0;
  };
  // Pose desejada; suaviza a não ser nos golpes.
  v.update = (dt, s = {}) => {
    v.time += dt;
    const T = targetPose({ ...s, t: v.time }, v.tmp);
    const rate = s.mode === 'punch' || s.mode === 'weave' || s.snap ? 1 : 1 - Math.exp(-(s.mode === 'ko' ? 6 : 14) * dt);
    for (const k in T) v.P[k] = lerp(v.P[k] ?? T[k], T[k], rate);
    apply(v.P);
    // Olhos e núcleo: pulsam; apagados no nocaute.
    const e = clamp01(v.P.eye) * v.glow;
    const pulse = 0.85 + 0.15 * Math.sin(v.time * 6);
    eye.color.copy(glowCol).multiplyScalar(0.25 + 0.75 * e * pulse);
    coreHalo.material.opacity = 0.9 * e * pulse; eyeHalo.material.opacity = 0.8 * e;
    shadow.visible = v.P.tilt > -0.3;
    v.flashV = Math.max(0, v.flashV - dt * 4.5);
    const f = v.flashV;
    for (const m of flashMats) {
      m.emissive.setRGB(lerp(m.userData.e.r, v.flashC[0], f), lerp(m.userData.e.g, v.flashC[1], f), lerp(m.userData.e.b, v.flashC[2], f));
      m.emissiveIntensity = lerp(m.userData.ei, 1.1, f);
    }
  };
  v.snap = (s = {}) => { v.update(0, { ...s, snap: true }); };
  v.flash = (amt = 1, r = 1, gg = 0.9, b = 0.8) => { v.flashV = Math.max(v.flashV, amt); v.flashC = [r, gg, b]; };
  v.glovePos = (i, out = v3(0, 0, 0)) => { g.updateMatrixWorld(true); return arms[i].glove.localToWorld(out.set(0, -0.45, 0.1)); };
  v.headPos = (out = v3(0, 0, 0)) => { g.updateMatrixWorld(true); return head.localToWorld(out.set(0, 0.5, 0)); };
  v.dispose = () => {
    g.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    for (const m of [...flashMats, eye, coreHalo.material, eyeHalo.material]) m.dispose();
  };
  v.snap({ mode: 'guard' });
  return v;
}
