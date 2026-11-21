// Bênção de Odin (lendária do Machado): o visual do Deus do Trovão no Cavaleiro.
// Capa vermelha, elmo com asas, olhos acesos, machado azul cheio de raios, anel de energia nos pés.
// Tudo fica preso no próprio modelo do herói (sobrevive à troca de sala) e sai com thorUndress (nova partida).
import * as THREE from 'three';
import { findBone } from './characters.js';

export const BLUE = 0x6fcbff, WHITE = 0xe8f6ff, CAPE_RED = 0xa3161c;
const rnd = (a, b) => a + Math.random() * (b - a);

// Pena: folha comprida, larga no meio e fina na ponta (desenhada no plano XY, apontando para +Y).
let featherGeo = null;
function feather() {
  if (featherGeo) return featherGeo;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.16, 0.18, 0.14, 0.62, 0.02, 1);
  s.bezierCurveTo(-0.08, 0.66, -0.12, 0.22, 0, 0);
  featherGeo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false, curveSegments: 6 });
  featherGeo.translate(0, 0, -0.015);
  return featherGeo;
}

const wingMat = () => new THREE.MeshStandardMaterial({ color: 0xf4f8ff, roughness: 0.5, metalness: 0.1, emissive: 0x5d8cd6, emissiveIntensity: 0.45, side: THREE.DoubleSide });
const glowMat = (color, op = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending });

// Uma asa: 4 penas em leque. side = +1 (direita) ou -1 (esquerda), no espaço "do personagem" (x = lado, y = cima, z = frente).
function makeWing(side, mat) {
  const g = new THREE.Group();
  const geo = feather();
  [[0, 1.0, 0.0], [1, 0.86, 0.32], [2, 0.72, 0.62], [3, 0.58, 0.9]].forEach(([i, len, ang]) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(0.62, len * 1.0, 1);
    // aberta para o lado, para cima e para trás, em leque (bem visível de cima)
    m.rotation.set(-0.25 - ang * 0.6, 0, side * (-0.95 - i * 0.06));
    m.position.set(0, 0, -i * 0.025);
    g.add(m);
  });
  return g;
}

// Converte uma direção do mundo para o espaço local de um osso (só a rotação).
function dirToLocal(bone, v) {
  const q = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
  return v.clone().applyQuaternion(q).normalize();
}

// Veste o Cavaleiro de Thor. Guarda o que muda para desfazer depois.
export function thorDress(p) {
  if (p.thorLook) return p.thorLook;
  const L = (p.thorLook = { capes: [], parts: [], glow: [], t: 0, crackle: 0 });
  const model = p.model;
  // Capa: vermelho forte (guarda o material original).
  model.traverse((o) => {
    if (!o.isMesh || !/cape/i.test(o.name)) return;
    L.capes.push({ o, mat: o.material });
    const m = o.material.clone(); m.map = null; m.color = new THREE.Color(CAPE_RED);
    if (m.emissive) { m.emissive.setHex(0x3a0204); m.emissiveIntensity = 0.5; }
    o.material = m;
  });
  // Elmo com asas e olhos acesos (presos no osso da cabeça, alinhados com o corpo agora).
  const head = findBone(model, 'head');
  if (head) {
    const keep = p.group.rotation.y;
    // Pose de referência (em pé, cabeça reta): a animação volta no próximo quadro.
    let skin = null; model.traverse((o) => { if (o.isSkinnedMesh && !skin) skin = o; });
    if (skin) skin.skeleton.pose();
    p.group.rotation.y = 0; p.group.updateMatrixWorld(true);
    const ws = head.getWorldScale(new THREE.Vector3()).x / Math.max(1e-6, p.group.getWorldScale(new THREE.Vector3()).x);
    const up = dirToLocal(head, new THREE.Vector3(0, 1, 0)), fwd = dirToLocal(head, new THREE.Vector3(0, 0, 1));
    const side = new THREE.Vector3().crossVectors(up, fwd).normalize(); // esquerda do personagem
    const basis = new THREE.Matrix4().makeBasis(side.clone().negate(), up, fwd); // x = direita, y = cima, z = frente
    const rig = new THREE.Group();
    rig.quaternion.setFromRotationMatrix(basis);
    rig.scale.setScalar(1 / (ws || 1));
    head.add(rig);
    const wm = wingMat();
    for (const s of [1, -1]) {
      const w = makeWing(s, wm);
      w.position.set(s * 0.46, 0.38, -0.05);
      rig.add(w);
    }
    // Olhos: dois pontos azuis na frente do elmo.
    const eyeGeo = new THREE.SphereGeometry(0.05, 8, 6);
    const eyeMat = glowMat(0xbfe9ff, 1);
    for (const s of [1, -1]) {
      const e = new THREE.Mesh(eyeGeo, eyeMat);
      e.position.set(s * 0.15, 0.2, 0.5);
      e.scale.set(1.5, 0.75, 0.6);
      rig.add(e);
      const halo = new THREE.Mesh(eyeGeo, glowMat(BLUE, 0.45));
      halo.position.copy(e.position); halo.scale.setScalar(2.6);
      rig.add(halo);
    }
    L.parts.push(rig); L.rig = rig;
    p.group.rotation.y = keep; p.group.updateMatrixWorld(true);
  }
  // Anel de energia nos pés.
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 48), glowMat(BLUE, 0.5));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08;
  p.group.add(ring); L.parts.push(ring); L.ring = ring;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.05, 40), glowMat(0x2a6cff, 0.16));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06;
  p.group.add(disc); L.parts.push(disc); L.disc = disc;
  thorAxeGlow(p);
  return L;
}

// Machado azul (o brilho do golpe forte continua laranja e volta para o azul depois).
export function thorAxeGlow(p) {
  const L = p.thorLook;
  if (!L || !p.glowMats) return;
  for (const m of p.glowMats) {
    if (L.glow.some((g) => g.m === m)) continue;
    L.glow.push({ m, base: m.userData.glowBase, em: m.emissive.getHex(), ei: m.emissiveIntensity });
    m.userData.glowBase = { color: 0x2f8cff, intensity: 0.9 };
    m.emissive.setHex(0x2f8cff); m.emissiveIntensity = 0.9;
  }
}

export function thorUndress(p) {
  const L = p.thorLook;
  if (!L) return;
  for (const c of L.capes) c.o.material = c.mat;
  for (const o of L.parts) if (o.parent) o.parent.remove(o);
  for (const g of L.glow) { g.m.userData.glowBase = g.base; g.m.emissive.setHex(g.em); g.m.emissiveIntensity = g.ei; }
  p.thorLook = null;
}

// A cada quadro: anel pulsando e raiozinhos estalando em volta do machado.
const tA = new THREE.Vector3(), tB = new THREE.Vector3();
export function thorLookTick(p, dt, vfx, busy) {
  const L = p.thorLook;
  if (!L) return;
  L.t += dt;
  const k = 0.5 + 0.5 * Math.sin(L.t * 7);
  if (L.ring) { L.ring.material.opacity = 0.32 + 0.3 * k; L.ring.scale.setScalar(1 + 0.06 * k); L.ring.rotation.z += dt * 1.5; }
  if (L.disc) L.disc.material.opacity = 0.1 + 0.08 * k;
  if (!vfx || !p.weapon || !p.weapon.visible || p.state === 'dead') return;
  L.crackle -= dt;
  if (L.crackle > 0) return;
  L.crackle = busy ? rnd(0.05, 0.1) : rnd(0.12, 0.28);
  // Ponto ao longo da lâmina (a arma aponta para +Y no osso da mão).
  p.weapon.updateWorldMatrix(true, false);
  const tip = (p.hero.weapons.right && p.hero.weapons.right.tip) || 1.3;
  tA.set(rnd(-0.25, 0.25), tip * rnd(0.55, 1.0), rnd(-0.1, 0.1)).applyMatrix4(p.weapon.matrixWorld);
  tB.copy(tA).add(new THREE.Vector3(rnd(-0.6, 0.6), rnd(-0.5, 0.4), rnd(-0.6, 0.6)));
  vfx.lightning(tA.clone(), tB.clone(), BLUE, 0.1);
}
