// Forma Final (lendária da Espada e Escudo, pedido do dono, 12/11/2026): o robô gigante de espada e escudo.
// Não há modelo de robô leve nos assets (os da pasta assets_novos têm até 44 MB e não mexem braços e pernas),
// então ele é montado em código, peça por peça, no estilo do jogo: armadura de aço e ouro, elmo de cavaleiro com
// viseira acesa, núcleo brilhando no peito, cabine de vidro (o Cavaleiro vai sentado dentro), capa, espada de
// energia e escudo-torre. As juntas (quadril, joelho, cintura giratória, ombro, cotovelo, punho) são movidas por
// uma "pose" calculada a cada quadro (parado, andando, golpes, bloqueio, pancada, ajoelhado), então a mesma
// função desenha o robô no computador do anfitrião e na tela do Jogador 2.
import * as THREE from 'three';
import { makeBlobShadow } from './characters.js';

export const MECH_DIM = { hipY: 3.3, waistY: 3.75, shoulderY: 2.35, shoulderX: 2.05, arm: 1.5, blade: 4.3, height: 7.9 };

const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };
const seg = (k, a, b) => clamp01((k - a) / (b - a));

// Caixa que afina para cima (tx, tz = quanto sobra da largura/profundidade no topo).
function taper(w, h, d, tx = 1, tz = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * tx); p.setZ(i, p.getZ(i) * tz); }
  g.computeVertexNormals();
  return g;
}

let hexTex = null;
function shieldFieldTex() {
  if (hexTex) return hexTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 3;
  const r = 16, h = r * Math.sqrt(3);
  for (let row = -1; row < 7; row++) for (let col = -1; col < 5; col++) {
    const x = col * r * 3 + (row % 2 ? r * 1.5 : 0), y = row * h / 2;
    g.beginPath();
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.stroke();
  }
  hexTex = new THREE.CanvasTexture(c);
  hexTex.wrapS = hexTex.wrapT = THREE.RepeatWrapping;
  return hexTex;
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
// Todos os ângulos em radianos. Braço solto aponta para baixo; ombro com x negativo levanta o braço para a frente.
const BASE = {
  bodyY: 0, pitch: 0, twist: 0, lean: 0.03, headYaw: 0, headPitch: 0,
  rShX: -0.28, rShZ: -0.16, rElX: -1.3, rWrX: -1.2, roll: 0,
  lShX: -0.2, lShZ: 0.2, lElX: -1.15,
  hipL: 0, kneeL: 0, hipR: 0, kneeR: 0,
  sx: 2.85, sy: 1.15, sz: 0.25, sry: 1.2, srx: 0,
  canopy: 0,
};
const KNEEL = {
  bodyY: -1.5, pitch: 0, twist: 0, lean: 0.34, headYaw: 0, headPitch: 0.45,
  rShX: -0.5, rShZ: -0.3, rElX: -0.5, rWrX: -0.1, roll: 0,
  lShX: -0.35, lShZ: 0.3, lElX: -0.7,
  hipL: -1.3, kneeL: 1.9, hipR: 0.25, kneeR: 1.5,
  sx: 2.75, sy: 0.55, sz: 0.5, sry: 1.05, srx: 0,
  canopy: 0,
};
const BLOCK = { rShX: -0.45, rShZ: -0.35, rElX: -1.0, rWrX: -1.5, lShX: -1.15, lShZ: -0.55, lElX: -0.9, sx: 0.15, sy: 1.25, sz: 2.4, sry: 0, twist: 0, lean: 0.1, bodyY: -0.22 };
const SWEEP = { rShX: -0.92, rShZ: -0.2, rElX: -0.08, rWrX: -0.04, roll: Math.PI / 2, bodyY: -0.32, lean: 0.1 };
const ARC = 1.9; // meia volta da cintura no corte (o corte varre ~200°)

function mix(out, a, b, k) { for (const key in b) out[key] = lerp(a[key] ?? out[key], b[key], k); return out; }

// Pose pedida para o estado s: { mode, walk, phase, atk, k, block, t }.
// mode: 'play' | 'kneel' | 'rise' (k 0..1) | 'dying' (k 0..1) | 'fall'
function targetPose(s, P) {
  Object.assign(P, BASE);
  const t = s.t || 0;
  if (s.mode === 'kneel' || s.mode === 'fall') { Object.assign(P, KNEEL); P.canopy = s.canopy || 0; if (s.mode === 'fall') { P.rShX = -2.6; P.rElX = -0.2; P.rWrX = 0.1; P.lShZ = 0.9; P.headPitch = 0.2; } return P; }
  if (s.mode === 'dying') {
    const k = smooth(s.k);
    mix(P, BASE, KNEEL, k);
    P.headPitch = 0.6 * k; P.rShX = lerp(BASE.rShX, 0.1, k); P.rElX = lerp(BASE.rElX, -0.15, k); P.rWrX = lerp(BASE.rWrX, 0.3, k);
    P.twist = Math.sin(t * 31) * 0.05 * (1 - k * 0.5); P.pitch = Math.sin(t * 23) * 0.03;
    return P;
  }
  if (s.mode === 'rise') {
    // 0..0,45 levanta; 0,45..0,8 espada para o céu; 0,8..1 volta para a guarda.
    const up = smooth(seg(s.k, 0, 0.45));
    mix(P, KNEEL, BASE, up);
    const raise = smooth(seg(s.k, 0.4, 0.58)) * (1 - smooth(seg(s.k, 0.84, 1)));
    P.rShX = lerp(P.rShX, -2.95, raise); P.rShZ = lerp(P.rShZ, -0.12, raise); P.rElX = lerp(P.rElX, -0.1, raise); P.rWrX = lerp(P.rWrX, 0.08, raise);
    P.headPitch = lerp(P.headPitch, -0.35, raise); P.lean = lerp(P.lean, -0.12, raise);
    P.lShZ = lerp(P.lShZ, 0.55, raise);
    P.canopy = 0;
    return P;
  }
  // ---- jogando ----
  const breath = Math.sin(t * 1.7);
  P.bodyY += breath * 0.04; P.lean += breath * 0.008; P.rShZ += breath * 0.02; P.lShZ -= breath * 0.02;
  const w = s.walk || 0;
  if (w > 0.01) {
    const a = s.phase || 0, sw = Math.sin(a);
    P.hipL = -sw * 0.52 * w; P.hipR = sw * 0.52 * w;
    P.kneeL = Math.max(0, Math.cos(a)) * 0.95 * w; P.kneeR = Math.max(0, -Math.cos(a)) * 0.95 * w;
    P.bodyY += -Math.abs(Math.cos(a)) * 0.16 * w;
    P.pitch = 0.05 * w; P.twist = sw * 0.09 * w;
    P.rShX += sw * 0.1 * w; P.lShX += -sw * 0.16 * w;
    P.sz += sw * 0.12 * w;
  }
  const b = s.block || 0;
  if (b > 0.001) mix(P, P, BLOCK, b);
  const k = s.k || 0;
  if (s.atk === 0 || s.atk === 1) { // cortes largos: a cintura gira como uma torre
    const dir = s.atk === 0 ? 1 : -1;
    const inK = smooth(seg(k, 0, 0.2)), cut = smooth(seg(k, 0.3, 0.58)), outK = smooth(seg(k, 0.8, 1));
    const pose = inK * (1 - outK);
    mix(P, P, SWEEP, pose);
    const from = lerp(s.from || 0, -ARC * dir, smooth(seg(k, 0, 0.3)));
    P.twist = lerp(lerp(from, ARC * dir, cut), ARC * dir * 0.55, outK);
    P.pitch = 0.06 * pose; P.headYaw = -P.twist * 0.45;
    P.hipL = -0.3 * pose; P.hipR = 0.34 * pose; P.kneeL = 0.5 * pose; P.kneeR = 0.45 * pose; // base aberta
    P.rWrX = lerp(P.rWrX, -0.04 + Math.sin(cut * Math.PI) * 0.1, pose);
  } else if (s.atk === 2) { // golpe de cima para baixo
    const up = smooth(seg(k, 0, 0.36)), down = seg(k, 0.44, 0.56), hold = 1 - smooth(seg(k, 0.82, 1));
    const d2 = down * down;
    P.twist = lerp(s.from || 0, 0, smooth(seg(k, 0, 0.25)));
    P.rShX = lerp(lerp(BASE.rShX, -3.05, up), -0.74, d2); P.rShZ = lerp(BASE.rShZ, -0.08, up);
    P.rElX = lerp(BASE.rElX, -0.12, up); P.rWrX = lerp(BASE.rWrX, lerp(0.25, -0.05, d2), up);
    P.lean = lerp(lerp(BASE.lean, -0.24, up), 0.46, d2); P.bodyY = lerp(lerp(0, 0.12, up), -0.62, d2);
    P.hipL = lerp(0, -0.55, d2); P.kneeL = lerp(0, 0.85, d2); P.hipR = lerp(0, 0.3, d2); P.kneeR = lerp(0, 0.75, d2);
    P.headPitch = lerp(-0.3 * up, 0.25, d2);
    P.lShX = lerp(BASE.lShX, 0.35, up * (1 - d2)); P.sry = lerp(BASE.sry, 1.5, up);
    if (hold < 1) { const r = 1 - hold; for (const key in BASE) P[key] = lerp(P[key], BASE[key], r); }
  } else if (s.atk === 3) { // pancada de escudo no chão
    const up = smooth(seg(k, 0, 0.3)), down = seg(k, 0.36, 0.48), out = smooth(seg(k, 0.78, 1));
    const d2 = down * down;
    mix(P, P, BLOCK, 1);
    P.sy = lerp(lerp(BLOCK.sy, 2.7, up), -1.15, d2); P.sz = lerp(BLOCK.sz, 2.75, d2); P.srx = lerp(-0.25 * up, 0.12, d2);
    P.lShX = lerp(lerp(BLOCK.lShX, -2.3, up), -0.75, d2); P.lElX = lerp(BLOCK.lElX, -0.3, d2);
    P.lean = lerp(lerp(0.1, -0.2, up), 0.5, d2); P.bodyY = lerp(lerp(-0.2, 0.15, up), -0.85, d2);
    P.hipL = lerp(0, -0.7, d2); P.kneeL = lerp(0, 1.1, d2); P.hipR = lerp(0, 0.35, d2); P.kneeR = lerp(0, 0.95, d2);
    P.headPitch = 0.3 * d2;
    if (out > 0) for (const key in BASE) P[key] = lerp(P[key], BASE[key], out);
  }
  return P;
}

// ---------- Modelo ----------
export function makeMech(opts = {}) {
  const D = MECH_DIM;
  const flashMats = [];
  const std = (color, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.25, flatShading: true, ...o });
    m.userData.e = m.emissive.clone(); m.userData.ei = m.emissiveIntensity;
    flashMats.push(m); return m;
  };
  const steel = std(0xb4bfd4);
  const plate = std(0x8791a8);
  const dark = std(0x333a4a, { roughness: 0.7 });
  const gold = std(0xf2c14e, { emissive: 0x7a4a00, emissiveIntensity: 0.5, metalness: 0.45, roughness: 0.35 });
  const cloth = std(opts.cape ?? 0xb3262b, { roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffd67a });
  const eye = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xffc763, emissive: 0xff9a2a, emissiveIntensity: 0.35, transparent: true, opacity: 0.26, roughness: 0.1, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const bladeMat = std(0xdfe7f5, { metalness: 0.5, roughness: 0.25, emissive: 0xffb040, emissiveIntensity: 0 });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const fieldMat = new THREE.MeshBasicMaterial({ map: shieldFieldTex(), color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

  const g = new THREE.Group();
  const parts = []; // peças grandes (voam na explosão)
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, big = false) => {
    const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); parent.add(o);
    if (big) parts.push(o);
    return o;
  };
  const grp = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  const shadow = makeBlobShadow(7.5); g.add(shadow);

  // Corpo inteiro (sobe e desce com o passo; ajoelha).
  const body = grp(g, 0, D.hipY, 0);
  add(body, taper(2.1, 0.75, 1.35, 0.8, 0.9), dark, 0, 0.05, 0, true);          // bacia
  add(body, taper(0.9, 0.9, 0.5, 0.6, 1), gold, 0, -0.2, 0.72);                  // placa da frente
  add(body, box(2.3, 0.16, 1.45), gold, 0, 0.36, 0);                             // cinto
  for (const s of [-1, 1]) { // saiote de placas
    const t = add(body, taper(0.85, 1.15, 0.2, 0.75, 1), plate, 1.02 * s, -0.42, 0.55); t.rotation.set(-0.12, 0, 0.1 * s);
    const sd = add(body, taper(0.2, 1.05, 1.05, 1, 0.75), plate, 1.25 * s, -0.4, -0.05); sd.rotation.z = 0.14 * s;
    add(body, box(0.9, 0.1, 0.24), gold, 1.02 * s, -0.95, 0.6);
  }

  // Pernas.
  const legs = [];
  for (const s of [1, -1]) { // +x = esquerda
    const hip = grp(body, 0.82 * s, -0.05, 0);
    add(hip, new THREE.SphereGeometry(0.5, 8, 6), dark);
    add(hip, taper(0.8, 1.35, 0.9, 1.12, 1.1), steel, 0, -0.72, 0, true);          // coxa
    add(hip, taper(0.5, 0.9, 0.2, 0.8, 1), gold, 0, -0.62, 0.5);
    const knee = grp(hip, 0, -1.4, 0);
    add(knee, new THREE.CylinderGeometry(0.38, 0.38, 0.95, 8).rotateZ(Math.PI / 2), dark);
    const cap = add(knee, new THREE.SphereGeometry(0.46, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), gold, 0, 0.02, 0.2); cap.scale.set(1, 1.15, 0.8);
    add(knee, taper(1.0, 1.4, 1.1, 0.72, 0.75), steel, 0, -0.78, 0.02, true);        // canela (larga embaixo)
    add(knee, box(0.16, 0.9, 0.08), glow, 0, -0.75, 0.47);                          // risco de luz
    add(knee, box(1.06, 0.14, 1.16), gold, 0, -1.3, 0.02);
    const ankle = grp(knee, 0, -1.45, 0);
    add(ankle, taper(1.15, 0.45, 1.75, 0.82, 0.8), dark, 0, -0.2, 0.22, true);       // pé
    add(ankle, taper(1.0, 0.3, 0.6, 0.8, 0.6), gold, 0, -0.26, 1.0);                 // biqueira
    legs.push({ hip, knee, ankle, s });
  }

  // Tronco: cintura giratória.
  const torso = grp(body, 0, D.waistY - D.hipY, 0);
  add(torso, new THREE.CylinderGeometry(0.72, 0.85, 0.62, 10), dark, 0, 0.3, 0);
  add(torso, new THREE.TorusGeometry(0.8, 0.07, 6, 16).rotateX(Math.PI / 2), glow, 0, 0.12, 0);
  // Peito em volta da cabine: costas, laterais, base e teto.
  add(torso, taper(3.1, 2.15, 1.05, 0.9, 0.9), steel, 0, 1.68, -0.5, true);
  for (const s of [-1, 1]) {
    add(torso, taper(0.82, 2.15, 1.1, 0.85, 0.85), steel, 1.14 * s, 1.68, 0.5, true);
    const pl = add(torso, taper(0.7, 1.5, 0.16, 0.7, 1), gold, 1.14 * s, 1.75, 1.08); pl.rotation.z = -0.1 * s;
    add(torso, box(0.1, 1.2, 0.1), glow, 0.8 * s, 1.72, 1.06); // moldura acesa da cabine
  }
  add(torso, taper(1.5, 0.55, 1.1, 1, 1), plate, 0, 0.88, 0.5);
  add(torso, taper(1.5, 0.42, 1.1, 0.9, 0.85), steel, 0, 2.52, 0.5);
  add(torso, box(1.5, 0.08, 0.1), glow, 0, 2.3, 1.06);
  // Núcleo (reator) embaixo da cabine.
  const core = grp(torso, 0, 0.9, 1.06);
  add(core, new THREE.CylinderGeometry(0.34, 0.34, 0.1, 12).rotateX(Math.PI / 2), dark);
  const coreGem = add(core, new THREE.OctahedronGeometry(0.24, 0), glow, 0, 0, 0.08);
  const coreRing = add(core, new THREE.TorusGeometry(0.36, 0.05, 6, 16), gold, 0, 0, 0.05);
  const coreHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc050, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  coreHalo.scale.setScalar(2.2); coreHalo.position.z = 0.25; core.add(coreHalo);
  // Cabine: assento (onde o Cavaleiro senta) e vidro que abre para cima.
  const seat = grp(torso, 0, 1.12, 0.38);
  add(torso, box(1.3, 1.0, 0.12), dark, 0, 1.7, 0.02);
  const canopy = grp(torso, 0, 2.3, 1.04);
  add(canopy, box(1.5, 1.2, 0.05), glass, 0, -0.6, 0);
  add(canopy, box(0.07, 1.2, 0.07), gold, 0, -0.6, 0.02);
  add(canopy, box(1.5, 0.07, 0.07), gold, 0, -1.18, 0.02);
  // Gola e costas (reatores).
  add(torso, taper(1.5, 0.4, 1.3, 0.75, 0.8), dark, 0, 2.9, -0.05);
  const vents = [];
  for (const s of [-1, 1]) {
    const v = grp(torso, 0.85 * s, 2.25, -1.05); v.rotation.set(-0.5, 0, -0.18 * s);
    add(v, new THREE.CylinderGeometry(0.3, 0.42, 1.5, 8), dark, 0, 0.3, 0);
    add(v, new THREE.CylinderGeometry(0.24, 0.24, 0.08, 8), glow, 0, 1.06, 0);
    add(v, new THREE.TorusGeometry(0.33, 0.06, 6, 10).rotateX(Math.PI / 2), gold, 0, 1.02, 0);
    vents.push(v);
  }
  // Capa: tiras encadeadas que balançam.
  const cape = [];
  let cp = grp(torso, 0, 2.75, -1.08); cp.rotation.x = 0.22;
  for (let i = 0; i < 5; i++) {
    const sg = grp(cp, 0, i ? -0.92 : 0, 0);
    const w0 = 2.5 - i * 0.12, w1 = 2.5 - (i + 1) * 0.12;
    const m = add(sg, taper(w1, 0.92, 0.05, w0 / w1, 1), cloth, 0, -0.46, 0);
    if (i === 4) add(sg, box(w1, 0.1, 0.07), gold, 0, -0.9, 0);
    m.userData.cape = true;
    cape.push(sg); cp = sg;
  }

  // Cabeça: elmo de cavaleiro com viseira acesa, crista e penacho.
  const head = grp(torso, 0, 3.12, 0.08);
  add(head, taper(1.0, 0.95, 1.1, 0.78, 0.82), steel, 0, 0.42, 0, true);
  add(head, taper(0.6, 0.6, 0.3, 0.5, 1), plate, 0, 0.2, 0.58);                    // focinheira
  const visor = add(head, box(0.78, 0.13, 0.06), eye, 0, 0.56, 0.5);
  add(head, box(0.1, 0.42, 0.06), eye, 0, 0.42, 0.52).scale.set(1, 1, 1);
  const crest = add(head, taper(0.14, 0.5, 1.25, 1, 0.55), gold, 0, 1.08, -0.05);
  for (const s of [-1, 1]) { const h = add(head, new THREE.ConeGeometry(0.14, 0.95, 5), gold, 0.52 * s, 0.98, -0.1); h.rotation.set(-0.3, 0, -0.5 * s); }
  const plume = [];
  let pp = grp(head, 0, 1.28, -0.5); pp.rotation.x = -1.0;
  for (let i = 0; i < 4; i++) {
    const sg = grp(pp, 0, i ? 0.5 : 0, 0);
    add(sg, new THREE.ConeGeometry(0.22 - i * 0.035, 0.62, 5), cloth, 0, 0.28, 0);
    plume.push(sg); pp = sg;
  }
  const eyeHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd070, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  eyeHalo.scale.set(2.4, 1.0, 1); eyeHalo.position.set(0, 0.55, 0.62); head.add(eyeHalo);

  // Braços. s = +1 esquerda (escudo), -1 direita (espada).
  const arms = {};
  for (const s of [1, -1]) {
    const sh = grp(torso, D.shoulderX * s, D.shoulderY, 0);
    const pad = add(sh, new THREE.SphereGeometry(0.95, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.62), steel, 0.12 * s, 0.1, 0, true); pad.scale.set(1.05, 0.9, 1.15);
    add(sh, new THREE.TorusGeometry(0.93, 0.09, 6, 14).rotateX(Math.PI / 2), gold, 0.12 * s, -0.12, 0).scale.set(1.05, 1.15, 1);
    const spike = add(sh, new THREE.ConeGeometry(0.2, 0.8, 5), gold, 0.55 * s, 0.85, 0); spike.rotation.z = -0.55 * s;
    add(sh, box(0.62, 1.45, 0.62), dark, 0, -0.75, 0, true);                         // braço
    const el = grp(sh, 0, -D.arm, 0);
    add(el, new THREE.SphereGeometry(0.42, 8, 6), gold);
    add(el, taper(0.95, 1.45, 0.95, 0.72, 0.72), steel, 0, -0.78, 0, true);           // manopla (larga no punho)
    add(el, box(1.0, 0.16, 1.0), gold, 0, -1.25, 0);
    add(el, box(0.12, 0.8, 0.08), glow, -0.42 * s, -0.75, 0);
    const hand = grp(el, 0, -D.arm, 0);
    add(hand, box(0.62, 0.5, 0.62), dark, 0, -0.2, 0);
    arms[s > 0 ? 'l' : 'r'] = { sh, el, hand };
  }

  // Espada: a lâmina segue a linha do braço (aponta para -Y da mão).
  const sword = grp(arms.r.hand, 0, -0.2, 0);
  add(sword, new THREE.CylinderGeometry(0.11, 0.11, 1.1, 8), dark, 0, 0.1, 0);
  add(sword, new THREE.OctahedronGeometry(0.22, 0), gold, 0, 0.72, 0);
  add(sword, taper(0.3, 0.26, 1.9, 1, 0.7), gold, 0, -0.5, 0).rotation.z = Math.PI;       // guarda
  add(sword, new THREE.OctahedronGeometry(0.2, 0), glow, 0, -0.5, 0);
  const blade = grp(sword, 0, -0.62, 0);
  const bladeGeo = taper(0.16, D.blade, 0.62, 0.6, 0.05); bladeGeo.translate(0, D.blade / 2, 0); bladeGeo.rotateZ(Math.PI);
  add(blade, bladeGeo, bladeMat, 0, 0, 0, true);
  const fuller = box(0.19, D.blade * 0.78, 0.12); fuller.translate(0, -D.blade * 0.42, 0);
  add(blade, fuller, glow);
  const edgeGeo = new THREE.PlaneGeometry(1.25, D.blade + 0.5); edgeGeo.translate(0, -(D.blade + 0.5) / 2 + 0.1, 0); edgeGeo.rotateY(Math.PI / 2);
  const edge = add(blade, edgeGeo, edgeMat);
  const edge2Geo = new THREE.PlaneGeometry(0.7, D.blade + 0.3); edge2Geo.translate(0, -(D.blade + 0.3) / 2 + 0.1, 0);
  add(blade, edge2Geo, edgeMat);
  const tip = grp(blade, 0, -D.blade, 0);
  const base = grp(blade, 0, -0.2, 0);

  // Escudo-torre (preso ao tronco; a pose leva do lado do corpo para a frente).
  const shield = grp(torso, BASE.sx, BASE.sy, BASE.sz);
  const SH = 4.1, SW = 2.7;
  const shGeo = new THREE.CylinderGeometry(2.6, 2.6, SH, 9, 1, true, -SW / 5.2, SW / 2.6); shGeo.translate(0, 0, -2.45);
  const sFace = add(shield, shGeo, steel, 0, 0, 0, true); sFace.material = std(0x9aa5bd, { side: THREE.DoubleSide });
  const rimGeo = new THREE.CylinderGeometry(2.64, 2.64, 0.2, 9, 1, true, -SW / 5.2, SW / 2.6); rimGeo.translate(0, 0, -2.45);
  for (const y of [SH / 2, -SH / 2, 0]) add(shield, rimGeo, gold, 0, y, 0).material = gold;
  add(shield, taper(0.5, 2.3, 0.14, 0.4, 1), gold, 0, 0.1, 0.19);                   // brasão: espada
  add(shield, box(1.3, 0.3, 0.14), gold, 0, 0.75, 0.17);
  const emblem = add(shield, new THREE.OctahedronGeometry(0.26, 0), glow, 0, 0.75, 0.27);
  for (const s of [-1, 1]) add(shield, new THREE.ConeGeometry(0.18, 0.7, 5), gold, 0.75 * s, -SH / 2 - 0.3, 0.02).rotation.z = Math.PI;
  const fieldGeo = new THREE.CylinderGeometry(3.3, 3.3, SH + 1.4, 16, 1, true, -0.72, 1.44); fieldGeo.translate(0, 0, -2.75);
  const field = add(shield, fieldGeo, fieldMat, 0, 0, 0); field.renderOrder = 4;
  shield.rotation.order = 'YXZ';

  g.traverse((o) => { if (o.isMesh && o !== shadow) { o.castShadow = false; o.receiveShadow = false; } });

  // ---------- Estado ----------
  const P = { ...BASE }, T = { ...BASE };
  const v = {
    g, parts, seat, tip, base, torso, head, body, shield, core, vents, legs,
    energy: 0, hpK: 1, flashV: 0, flashC: [1, 1, 1], time: 0, eyeOn: 1, armed: 0, shieldHit: 0, capeSwing: 0, lastYaw: null, glowK: 1,
  };
  const ROT = (o, x, y, z) => { o.rotation.set(x, y, z); };

  v.pose = () => P;
  v.snap = (s) => { targetPose(s, T); Object.assign(P, T); apply(0, s); };
  // Atualiza a pose e os brilhos. s: ver targetPose (+ speed: 0..1 andando, yaw: rotação do corpo no mundo).
  v.update = (dt, s) => {
    v.time += dt;
    targetPose({ ...s, t: v.time }, T);
    const fast = s.atk != null && s.atk >= 0;
    const r = 1 - Math.exp(-(fast ? 34 : s.mode === 'play' ? 13 : 9) * dt);
    for (const key in T) P[key] += (T[key] - P[key]) * r;
    apply(dt, s);
  };

  function apply(dt, s) {
    body.position.y = D.hipY + P.bodyY;
    body.rotation.x = P.pitch;
    torso.rotation.set(P.lean, P.twist, 0);
    head.rotation.set(P.headPitch, P.headYaw, 0);
    arms.r.sh.rotation.set(P.rShX, 0, P.rShZ); arms.r.el.rotation.x = P.rElX; sword.rotation.x = P.rWrX; sword.rotation.y = P.roll;
    arms.l.sh.rotation.set(P.lShX, 0, P.lShZ); arms.l.el.rotation.x = P.lElX;
    for (const L of legs) {
      const h = L.s > 0 ? P.hipL : P.hipR, k = L.s > 0 ? P.kneeL : P.kneeR;
      L.hip.rotation.x = h; L.knee.rotation.x = k; L.ankle.rotation.x = -(h + k) - P.pitch;
    }
    shield.position.set(P.sx, P.sy, P.sz); shield.rotation.set(P.srx, P.sry, 0);
    canopy.rotation.x = -(s.canopy ?? P.canopy) * 1.9;
    // Capa e penacho: balançam com o passo, com o giro da cintura e com o vento.
    const t = v.time, sp = (s.walk || 0);
    const yaw = (s.yaw ?? 0) + P.twist;
    const dy = v.lastYaw == null ? 0 : Math.atan2(Math.sin(yaw - v.lastYaw), Math.cos(yaw - v.lastYaw));
    v.lastYaw = yaw;
    v.capeSwing += ((dt > 0 ? dy / dt : 0) * 0.05 - v.capeSwing) * Math.min(1, dt * 6);
    cape.forEach((c, i) => {
      c.rotation.x = (i ? 0.06 : 0) + sp * 0.2 + Math.sin(t * 2.4 - i * 0.8) * (0.05 + sp * 0.1) + (i ? Math.abs(v.capeSwing) * 0.12 : 0) - P.lean * (i ? 0 : 1);
      c.rotation.z = Math.sin(t * 1.6 - i * 0.6) * 0.03 + v.capeSwing * (i ? 0.16 : 0.08);
    });
    plume.forEach((c, i) => { c.rotation.x = (i ? -0.22 : 0) + Math.sin(t * 5 - i * 0.9) * 0.1 - sp * 0.08; c.rotation.z = Math.sin(t * 3.1 - i) * 0.08 + v.capeSwing * 0.2; });
    // Brilhos: núcleo, olhos, lâmina e campo do escudo. Pouca vida: vermelho e piscando.
    const low = v.hpK < 0.3 ? 1 : 0, pulse = 0.82 + 0.18 * Math.sin(t * (low ? 14 : 3.2));
    const on = v.glowK * (low ? 0.75 + 0.25 * Math.sin(t * 22) : 1);
    const hot = low ? 0.35 : 1;
    glow.color.setRGB(1 * pulse * on, lerp(0.25, 0.84, hot) * pulse * on, lerp(0.12, 0.48, hot) * pulse * on);
    const eo = v.eyeOn * (v.hpK < 0.3 && Math.sin(t * 37) > 0.75 ? 0.3 : 1);
    eye.color.setRGB(1 * eo, lerp(0.3, 0.92, hot) * eo, lerp(0.2, 0.66, hot) * eo);
    eyeHalo.material.opacity = 0.85 * eo; eyeHalo.material.color.setRGB(1, lerp(0.25, 0.8, hot), lerp(0.15, 0.4, hot));
    coreHalo.material.opacity = (0.55 + 0.3 * pulse) * on; coreHalo.material.color.copy(eyeHalo.material.color);
    coreHalo.scale.setScalar(2.0 + pulse * 0.6);
    coreGem.rotation.y += dt * 2.5; coreGem.rotation.x += dt * 1.3; coreRing.rotation.z -= dt * 1.5;
    emblem.rotation.y += dt * 2;
    const en = v.energy;
    edgeMat.opacity = en * (0.5 + 0.12 * Math.sin(t * 27) + (s.atk != null && s.atk >= 0 && s.atk < 3 ? 0.3 : 0));
    edge.scale.set(1, 1, 0.85 + 0.2 * Math.sin(t * 19));
    bladeMat.emissiveIntensity = en * (0.7 + (s.atk != null && s.atk >= 0 && s.atk < 3 ? 0.9 : 0));
    const blk = Math.max(s.block || 0, s.atk === 3 ? 1 : 0);
    fieldMat.opacity += ((blk > 0.5 ? 0.3 + v.armed * 0.28 + 0.08 * Math.sin(t * 9) : 0) + v.shieldHit - fieldMat.opacity) * Math.min(1, dt * 14);
    v.shieldHit = Math.max(0, (v.shieldHit || 0) - dt * 3);
    fieldMat.map.offset.y = t * 0.25;
    fieldMat.color.setRGB(1, v.armed ? 0.95 : 0.82, v.armed ? 0.75 : 0.48);
    // Clarão ao apanhar (branco) ou em alerta (vermelho).
    v.flashV = Math.max(0, v.flashV - dt * 4.5);
    const f = v.flashV;
    for (const m of flashMats) {
      if (m === bladeMat) continue;
      m.emissive.setRGB(lerp(m.userData.e.r, v.flashC[0], f), lerp(m.userData.e.g, v.flashC[1], f), lerp(m.userData.e.b, v.flashC[2], f));
      m.emissiveIntensity = lerp(m.userData.ei, 1.1, f);
    }
  }
  v.flash = (amt = 1, r = 1, gg = 0.9, b = 0.8) => { v.flashV = Math.max(v.flashV, amt); v.flashC = [r, gg, b]; };
  v.setOpacity = (o) => { for (const m of flashMats) { m.transparent = o < 1; m.opacity = o; } };
  v.dispose = () => {
    g.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
    for (const m of [...flashMats, glow, eye, glass, edgeMat, fieldMat, coreHalo.material, eyeHalo.material]) m.dispose();
  };
  v.snap({ mode: 'kneel' });
  return v;
}
