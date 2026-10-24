// Montagem de personagens: modelo + armas nas mãos + sombra.
import * as THREE from 'three';
import { instance } from './assets.js';
import { makeFlail } from './flail.js';
import { makeWeaponFx, tintWeapon } from './weaponfx.js';

// O GLTFLoader tira os pontos dos nomes ("handslot.r" vira "handslotr").
export function findBone(root, name) {
  return root.getObjectByName(name) || root.getObjectByName(name.replace(/\./g, ''));
}

export function attachWeapon(model, boneName, weapon) {
  const bone = findBone(model, boneName);
  if (!bone) throw new Error(`Osso não encontrado: ${boneName}`);
  const w = buildWeapon(weapon);
  if (weapon.scale) w.scale.setScalar(weapon.scale);
  w.rotation.set(...weapon.rot.map((d) => THREE.MathUtils.degToRad(d)));
  bone.add(w);
  return w;
}

// Modelo da arma com os enfeites: dourada (gold), cor (tint) e brilhos da Maga (fx). Sem escala/rotação.
export function buildWeapon(weapon) {
  const w = weapon.flail ? makeFlail() : instance(weapon.model);
  if (weapon.gold) goldify(w);
  if (weapon.tint) tintWeapon(w, weapon.tint);
  if (weapon.fx) {
    const fx = makeWeaponFx(weapon.fx, weapon.tip || 1);
    fx.traverse((o) => { o.userData.fxPart = true; });
    w.add(fx);
    w.userData.fx = fx;
  }
  return w;
}

// Arma dourada e levemente brilhante (Manopla). glowBase guarda o brilho próprio para voltar
// depois do brilho laranja do golpe forte.
export const GOLD_GLOW = { color: 0xffa62a, intensity: 0.4 };
export function goldify(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material.clone();
    m.color = new THREE.Color(0xffc94a);
    m.metalness = 0.35;
    m.roughness = 0.32;
    m.emissive = new THREE.Color(GOLD_GLOW.color);
    m.emissiveIntensity = GOLD_GLOW.intensity;
    m.userData.glowBase = GOLD_GLOW;
    o.material = m;
  });
  obj.userData.gold = true;
  return obj;
}

let shadowTex = null;
// Sombra redonda falsa (bem mais barata que sombra de verdade).
export function makeBlobShadow(size = 1.6) {
  if (!shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.06;
  m.renderOrder = 1;
  return m;
}

// Dá a cada personagem materiais próprios (o clone compartilha os materiais) para poder piscar.
// Devolve { mats, eyes }: todos os materiais e os dos olhos (esqueletos têm a malha "Eyes").
export function makeFlashable(model) {
  const mats = [], eyes = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    mats.push(o.material);
    if (/Eyes$/.test(o.name)) eyes.push(o.material);
  });
  return { mats, eyes };
}

// Pisca (0..1) numa cor; usa o brilho próprio (emissive) do material.
export function setFlash(mats, v, r = 1, g = 1, b = 1) {
  for (const m of mats) {
    if (!m.emissive) continue;
    m.emissive.setRGB(r, g, b);
    m.emissiveIntensity = v;
  }
}

export function makeCharacter(modelPath) {
  const group = new THREE.Group();
  const model = instance(modelPath);
  model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; } });
  group.add(model);
  group.add(makeBlobShadow());
  return { group, model };
}
