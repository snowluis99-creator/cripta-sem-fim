// Visual das bênçãos novas das Garras do Ladino (lista do dono, 07/11/2026): contorno vermelho (Faro de Sangue),
// garra fantasma gigante (Tigre Fantasma), riscos brilhando no chão (Marcas de Garra), poça de sangue, fera fantasma
// (Matilha: lobo fantasma), garradas, brilho das garras afiadas e do modo fera. Só aparência; as regras estão em clawkit.js.
import * as THREE from 'three';
import { glowSprite, dispose } from './rogueprops.js';

export { dispose, glowSprite };
const addMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

// ---------- Contorno vermelho (casca de trás do próprio corpo, um pouco inchada) ----------
export const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: 0xff1a2a, side: THREE.BackSide, transparent: true, opacity: 0.9, depthWrite: false });
OUTLINE_MAT.userData.keep = true;
OUTLINE_MAT.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * 0.075;');
};
OUTLINE_MAT.customProgramCacheKey = () => 'clawOutline';

export function addOutline(model) {
  const list = [];
  model.traverse((o) => { if (o.isSkinnedMesh && !o.userData.clawOutline) list.push(o); });
  return list.map((o) => {
    const m = new THREE.SkinnedMesh(o.geometry, OUTLINE_MAT);
    m.userData.clawOutline = true;
    m.bind(o.skeleton, o.bindMatrix);
    m.position.copy(o.position); m.quaternion.copy(o.quaternion); m.scale.copy(o.scale);
    m.frustumCulled = false;
    m.renderOrder = -1;
    o.parent.add(m);
    return m;
  });
}
export function removeOutline(list) { for (const m of list) m.removeFromParent(); } // geometria e material são do corpo / compartilhados

// ---------- Tigre Fantasma: garra gigante que desce do alto ----------
export function ghostClaw() {
  const g = new THREE.Group();
  const blade = addMat(0xffb070, 0.9), edge = addMat(0xff4a2a, 0.35);
  for (let i = -1; i <= 1; i++) {
    // ")" curvados lado a lado, de frente para a câmera (o grupo não gira com o Ladino)
    const arc = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.13, 6, 18, Math.PI * 0.42), blade);
    arc.rotation.set(0, 0, -Math.PI * 0.21);
    arc.position.set(i * 0.62 - 1.9, 1.7 - Math.abs(i) * 0.25, 0);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.22, 6, 18, Math.PI * 0.42), edge);
    glow.rotation.copy(arc.rotation); glow.position.copy(arc.position);
    g.add(glow, arc);
  }
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), addMat(0xff7a4a, 0.35));
  palm.scale.set(1.5, 0.7, 1); palm.position.y = 3.2;
  const glow = glowSprite(0xff6a3a, 3.2, 0.3); glow.position.y = 2.2;
  g.add(palm, glow);
  g.rotation.x = 0.5; // inclina para a câmera
  return g;
}

// ---------- Marcas de Garra: três riscos brilhando no chão ----------
export function clawMarks(len, gap, w) {
  const g = new THREE.Group();
  const mat = addMat(0xff4a3a, 0.85), core = addMat(0xffe0b0, 0.9);
  for (let i = -1; i <= 1; i++) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, len).rotateX(-Math.PI / 2), mat);
    s.position.set(i * gap, 0.06, len / 2);
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.35, len * 0.94).rotateX(-Math.PI / 2), core);
    c.position.set(i * gap, 0.07, len / 2);
    g.add(s, c);
  }
  g.userData.mats = [mat, core];
  return g;
}

// ---------- Poça de sangue ----------
export function bloodPuddle(r) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xb3101f, transparent: true, opacity: 0.85, depthWrite: false });
  for (let i = 0; i < 4; i++) {
    const rr = r * (i ? 0.35 + Math.random() * 0.25 : 1);
    const m = new THREE.Mesh(new THREE.CircleGeometry(rr, 18).rotateX(-Math.PI / 2), mat);
    if (i) { const a = Math.random() * Math.PI * 2; m.position.set(Math.sin(a) * r * 0.85, 0, Math.cos(a) * r * 0.85); }
    g.add(m);
  }
  const shine = new THREE.Mesh(new THREE.CircleGeometry(r * 0.3, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff6a7a, transparent: true, opacity: 0.35, depthWrite: false }));
  shine.position.set(r * 0.25, 0.005, -r * 0.2);
  g.add(shine);
  g.position.y = 0.11; // acima das juntas do piso
  g.userData.mat = mat;
  return g;
}

// ---------- Matilha: lobo fantasma (low-poly, pelo escuro, olhos e aura vermelhos) ----------
// Olhando para +z. Juntas em grupos (pernas com joelho, pescoço, cabeça, mandíbula, rabo) para a animação (animWolf).
export function ghostWolf() {
  const g = new THREE.Group(), body = new THREE.Group();
  const std = (color, emissive = 0x3a0610, ei = 0.55) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, emissive, emissiveIntensity: ei });
  const fur = std(0x6a6f82, 0x3a0812, 0.3), light = std(0xd0d2de, 0x2a0810, 0.15), dark = std(0x2c2e38, 0x5a0a14, 0.45);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3a3a }), nose = std(0x101014, 0, 0);
  const mesh = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m; };
  // Corpo: peito alto, quadril mais baixo, barriga clara.
  body.add(mesh(new THREE.IcosahedronGeometry(0.42, 1), fur, 0, 0.84, 0.32, 0.85, 0.95, 1.05));
  body.add(mesh(new THREE.IcosahedronGeometry(0.36, 1), fur, 0, 0.78, -0.42, 0.8, 0.85, 1.05));
  body.add(mesh(new THREE.CapsuleGeometry(0.3, 0.55, 3, 7).rotateX(Math.PI / 2), fur, 0, 0.79, -0.04, 0.85, 0.9, 1));
  body.add(mesh(new THREE.IcosahedronGeometry(0.3, 1), light, 0, 0.7, 0.45, 0.75, 0.8, 0.8)); // peito claro
  const back = mesh(new THREE.BoxGeometry(0.22, 0.1, 0.95), dark, 0, 1.1, -0.05); back.rotation.x = 0.1; body.add(back); // faixa escura nas costas
  // Juba em volta do pescoço.
  for (let i = 0; i < 7; i++) {
    const a = -1.3 + i * (2.6 / 6);
    const c = mesh(new THREE.ConeGeometry(0.11, 0.34, 4), i % 2 ? dark : fur, Math.sin(a) * 0.32, 1.02 + Math.cos(a) * 0.08, 0.52 - Math.abs(Math.sin(a)) * 0.05);
    c.rotation.set(-1.0, 0, -a * 0.9); body.add(c);
  }
  // Pescoço + cabeça (focinho, nariz, mandíbula que abre, orelhas, olhos).
  const neck = new THREE.Group(); neck.position.set(0, 0.98, 0.55); body.add(neck);
  const nk = mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.42, 7), fur, 0, 0.05, 0.14); nk.rotation.x = 1.15; neck.add(nk);
  const head = new THREE.Group(); head.position.set(0, 0.14, 0.36); neck.add(head);
  head.add(mesh(new THREE.IcosahedronGeometry(0.27, 1), fur, 0, 0, 0, 0.95, 0.82, 1.05));
  const snout = mesh(new THREE.CylinderGeometry(0.08, 0.15, 0.44, 6).rotateX(Math.PI / 2), light, 0, -0.07, 0.34); head.add(snout);
  head.add(mesh(new THREE.IcosahedronGeometry(0.055, 0), nose, 0, -0.03, 0.57));
  const jaw = new THREE.Group(); jaw.position.set(0, -0.12, 0.08); head.add(jaw);
  jaw.add(mesh(new THREE.BoxGeometry(0.16, 0.05, 0.38), light, 0, -0.02, 0.24));
  [-1, 1].forEach((sd) => { // dentes
    const t = mesh(new THREE.ConeGeometry(0.018, 0.06, 4), std(0xf0ece0, 0x000000, 0), sd * 0.05, -0.12, 0.48); t.rotation.x = Math.PI; head.add(t);
  });
  const ears = [-1, 1].map((sd) => { const e = mesh(new THREE.ConeGeometry(0.09, 0.27, 4), dark, sd * 0.14, 0.25, -0.05); e.rotation.set(-0.15, 0, -sd * 0.25); head.add(e); return e; });
  [-1, 1].forEach((sd) => { head.add(mesh(new THREE.SphereGeometry(0.035, 6, 5), eyeMat, sd * 0.11, 0.06, 0.22)); });
  const eyeGlow = glowSprite(0xff2a2a, 0.55, 0.9); eyeGlow.position.set(0, 0.06, 0.26); head.add(eyeGlow);
  // Pernas: ombro/quadril -> joelho -> pata.
  const legs = [[-0.2, 0.78, 0.42, 1], [0.2, 0.78, 0.42, 1], [-0.19, 0.74, -0.48, -1], [0.19, 0.74, -0.48, -1]].map(([x, y, z, front]) => {
    const up = new THREE.Group(); up.position.set(x, y, z);
    up.add(mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.38, 6), fur, 0, -0.19, 0));
    const low = new THREE.Group(); low.position.set(0, -0.38, 0); up.add(low);
    low.add(mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.36, 6), front > 0 ? fur : dark, 0, -0.18, 0));
    low.add(mesh(new THREE.BoxGeometry(0.14, 0.07, 0.19), dark, 0, -0.36, 0.05));
    body.add(up);
    return { up, low, front };
  });
  // Rabo peludo em 2 partes.
  const tail = new THREE.Group(); tail.position.set(0, 0.88, -0.72); body.add(tail);
  tail.add(mesh(new THREE.IcosahedronGeometry(0.15, 1), fur, 0, 0, -0.25, 0.9, 0.9, 2.0));
  const tail2 = new THREE.Group(); tail2.position.set(0, 0, -0.5); tail.add(tail2);
  tail2.add(mesh(new THREE.IcosahedronGeometry(0.13, 1), dark, 0, 0, -0.12, 0.9, 0.9, 1.6));
  // Aura vermelha e sombra no chão.
  const glow = glowSprite(0xff2a3a, 2.0, 0.22); glow.position.y = 0.9;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.scale.set(0.8, 1, 1.5); shadow.position.y = 0.03;
  g.add(shadow, body, glow);
  g.scale.setScalar(1.15);
  const mats = [fur, light, dark, eyeMat, nose];
  g.userData = { body, neck, head, jaw, ears, legs, tail, tail2, glow, eyeGlow, shadow, mats, run: 0 };
  return g;
}

// Pose do lobo a cada quadro. a = { move (0..1), atk: null | { kind: 'swipeR'|'swipeL'|'bite', k (0..1) }, air: null | k (0..1) }.
export function animWolf(g, a, dt) {
  const u = g.userData, L = u.legs;
  u.run += dt * (a.move > 0.1 ? 15 : 3);
  const ph = u.run, mv = a.move;
  // Galope: pares dianteiros e traseiros alternados; o corpo sobe e desce.
  const gallop = (i) => Math.sin(ph + (i < 2 ? 0 : Math.PI * 0.9) + (i % 2) * 0.5);
  L.forEach((l, i) => {
    const s = gallop(i);
    l.up.rotation.x = s * 0.75 * mv;
    l.low.rotation.x = (l.front > 0 ? Math.max(0, -s) * 0.9 : -Math.max(0, s) * 0.9) * mv;
  });
  u.body.position.y = mv * Math.abs(Math.sin(ph)) * 0.09;
  u.body.rotation.x = mv * Math.sin(ph) * 0.06;
  u.body.rotation.z = 0;
  u.body.position.z = 0;
  u.neck.rotation.set(-0.15 * mv + Math.sin(ph * 0.5) * 0.03, 0, 0);
  u.head.rotation.set(0.15 * mv, 0, 0);
  u.jaw.rotation.x = 0.06;
  u.tail.rotation.set(-0.55 + mv * 0.4, Math.sin(ph * (mv > 0.1 ? 0.5 : 0.3)) * 0.35, 0);
  u.tail2.rotation.set(-0.2, Math.sin(ph * 0.5 + 1) * 0.3, 0);
  u.ears.forEach((e, i) => { e.rotation.x = -0.15 - mv * 0.35; });
  const at = a.atk;
  if (at) {
    const k = at.k, up = Math.sin(Math.min(1, k / 0.45) * Math.PI * 0.5), down = k < 0.45 ? 0 : Math.min(1, (k - 0.45) / 0.3);
    if (at.kind === 'bite') { // avança o corpo e morde
      const lunge = k < 0.4 ? -k / 0.4 * 0.25 : Math.min(1, (k - 0.4) / 0.15) * 0.45 - Math.max(0, k - 0.7) * 1.2;
      u.body.position.z = lunge;
      u.body.rotation.x = k < 0.4 ? -0.15 * k / 0.4 : 0.12;
      u.neck.rotation.x = k < 0.4 ? -0.4 * k / 0.4 : 0.35;
      u.jaw.rotation.x = k < 0.45 ? 0.75 * k / 0.45 : 0.75 * (1 - Math.min(1, (k - 0.45) / 0.1));
      L[2].up.rotation.x = L[3].up.rotation.x = 0.35; L[0].up.rotation.x = L[1].up.rotation.x = -0.5 * (k < 0.5 ? 1 : 1 - (k - 0.5) * 2);
    } else { // fica de pé nas patas de trás e rasga com a pata da frente
      const r = at.kind === 'swipeR' ? 0 : 1, o = 1 - r, sgn = r ? 1 : -1;
      u.body.rotation.x = -0.55 * up * (1 - down * 0.7);
      u.body.position.y = 0.28 * up * (1 - down);
      u.body.rotation.z = sgn * 0.12 * up;
      u.neck.rotation.x = 0.25 * up;
      u.jaw.rotation.x = 0.4 * up;
      L[r].up.rotation.x = -2.0 * up + down * 2.3; L[r].up.rotation.z = sgn * (0.4 * up - down * 0.9);
      L[r].low.rotation.x = 0.9 * up - down * 0.6;
      L[o].up.rotation.x = -0.9 * up; L[o].low.rotation.x = 0.8 * up;
      L[2].up.rotation.x = L[3].up.rotation.x = 0.5 * up; L[2].low.rotation.x = L[3].low.rotation.x = -0.5 * up;
    }
  } else { L.forEach((l) => { l.up.rotation.z = 0; }); }
  if (a.air != null) { // pulo: estica as patas para a frente e para trás
    const k = a.air;
    u.body.rotation.x = -0.35 + k * 0.6;
    L[0].up.rotation.x = L[1].up.rotation.x = -1.1; L[0].low.rotation.x = L[1].low.rotation.x = 0.2;
    L[2].up.rotation.x = L[3].up.rotation.x = 1.0; L[2].low.rotation.x = L[3].low.rotation.x = -0.3;
    u.jaw.rotation.x = 0.7 * Math.min(1, k * 2);
    u.neck.rotation.x = 0.2;
    u.tail.rotation.x = -0.1;
  }
  u.shadow.material.opacity = 0.35 * (a.air != null ? 1 - Math.sin(a.air * Math.PI) * 0.6 : 1);
}
export function fadeWolf(g, f) {
  for (const m of g.userData.mats) { m.transparent = f < 1; m.opacity = f; }
  g.userData.glow.material.opacity = 0.22 * f; g.userData.eyeGlow.material.opacity = 0.9 * f;
}

// Garrada (lobo / Investida do Leão): 3 riscos curvos vermelhos que aparecem e somem.
export function slashFx(size = 1, color = 0xff3a4a) {
  const g = new THREE.Group();
  const blade = addMat(0xffe0d0, 0.95), edge = addMat(color, 0.6);
  for (let i = -1; i <= 1; i++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.75 * size, 0.035 * size, 4, 14, Math.PI * 0.55), blade);
    arc.position.set(i * 0.22 * size, 0, 0); arc.rotation.z = Math.PI * 0.22;
    const gl = new THREE.Mesh(new THREE.TorusGeometry(0.75 * size, 0.09 * size, 4, 14, Math.PI * 0.55), edge);
    gl.position.copy(arc.position); gl.rotation.copy(arc.rotation);
    g.add(gl, arc);
  }
  g.userData.mats = [blade, edge];
  return g;
}

// ---------- Brilho vermelho nas garras afiadas / modo fera ----------
export function whetGlow() { return glowSprite(0xff3040, 0.7, 0.9); }
export function beastGlow() { return glowSprite(0xff2a2a, 3.2, 0.45); }
