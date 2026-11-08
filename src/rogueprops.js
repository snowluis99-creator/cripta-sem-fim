// Coisas que as bênçãos novas das Duas Adagas põem na sala (só o visual): boneco de palha, frascos, adaga cravada,
// adagas fantasmas, facas do leque, nuvens de fumaça/veneno, caveira e marca sobre a cabeça.
import * as THREE from 'three';
import { instance } from './assets.js';
import { getGlowTexture } from './dungeon/builder.js';

export const DAGGER_MODEL = 'weapons/heroes/dagger.gltf';
export const KNIFE_MODEL = 'weapons/extra/dagger_A.gltf';
export const FLASK_MODEL = 'dungeon/bottle_B_green.gltf';
export const FLASK_COLORS = { poison: 0x7dff4a, smoke: 0xb8bcc8, fire: 0xff7a2a };

const add = (o) => new THREE.MeshBasicMaterial({ color: o, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
export const glowSprite = (color, size = 1, opacity = 0.7) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
};

export function dispose(o) {
  o.traverse((m) => {
    if (m.geometry && !m.geometry.userData.keep) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => { if (!x.userData.keep) x.dispose(); });
  });
}

// Modelo de arma com material próprio (para pintar/brilhar sem mexer no original).
function weaponModel(path, scale, tint, emissive, opacity = 1) {
  const m = instance(path);
  m.scale.setScalar(scale);
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    if (tint != null) o.material.color = new THREE.Color(tint);
    if (emissive != null) { o.material.emissive = new THREE.Color(emissive); o.material.emissiveIntensity = 0.8; }
    if (opacity < 1) { o.material.transparent = true; o.material.opacity = opacity; o.material.depthWrite = false; }
  });
  return m;
}

// Adaga cravada no inimigo (presa no grupo dele, na altura do peito, com a ponta para dentro).
export function stuckDagger(scale) {
  const g = new THREE.Group();
  const d = weaponModel(DAGGER_MODEL, 1.1 / scale, null, 0x401010);
  d.rotation.x = Math.PI / 2 + 0.5; // lâmina entrando nas costas/peito
  d.position.set(0, 0, -0.3 / scale);
  g.add(d);
  g.position.set(0, 1.25 / scale, 0);
  g.userData.blade = d;
  return g;
}

// Adaga voando de volta para a mão (ou faca do leque): ponta para a frente (+Z).
export function flyingBlade(path = DAGGER_MODEL, scale = 1, glow = 0xbfe6ff) {
  const g = new THREE.Group();
  const d = weaponModel(path, scale, null, glow === null ? null : 0x203040);
  d.rotation.x = Math.PI / 2;
  g.add(d);
  if (glow !== null) g.add(glowSprite(glow, 0.8 * scale, 0.5));
  return g;
}

// Adaga fantasma (Lâminas Voadoras): azul, transparente, brilhando.
export function ghostDagger() {
  const g = new THREE.Group();
  const d = weaponModel(DAGGER_MODEL, 1.25, 0x9fe8ff, 0x3ab8ff, 0.75);
  d.rotation.x = Math.PI / 2;
  g.add(d, glowSprite(0x6fd8ff, 1.3, 0.55));
  return g;
}

// Boneco de palha (Substituição).
export function strawDummy() {
  const g = new THREE.Group();
  const straw = new THREE.MeshLambertMaterial({ color: 0xd9b45a });
  const sack = new THREE.MeshLambertMaterial({ color: 0xb38b5a });
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b4426 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.0, 6), wood); pole.position.y = 0.5;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.95, 8), straw); body.position.y = 1.3;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.1, 8), wood); belt.position.y = 1.1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), sack); head.position.y = 2.0;
  const arms = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 6), straw); arms.rotation.z = Math.PI / 2; arms.position.y = 1.55;
  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.2), wood); cross.position.set(0.1, 2.05, 0.28);
  const cross2 = cross.clone(); cross2.position.x = -0.1;
  for (const m of [pole, body, belt, head, arms, cross, cross2]) { m.castShadow = true; g.add(m); }
  // Fios de palha soltos.
  for (let i = 0; i < 8; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.03), straw);
    const a = (i / 8) * Math.PI * 2;
    s.position.set(Math.sin(a) * 0.4, 0.86, Math.cos(a) * 0.4); s.rotation.set(Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4);
    g.add(s);
  }
  return g;
}

// Frasco no chão (Bolsos Fundos): garrafa pintada + brilho da cor.
export function flaskMesh(kind) {
  const g = new THREE.Group();
  const col = FLASK_COLORS[kind];
  const b = instance(FLASK_MODEL);
  b.scale.setScalar(1.15);
  b.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color = new THREE.Color(col); o.material.emissive = new THREE.Color(col); o.material.emissiveIntensity = 0.35; } });
  const inner = new THREE.Group(); inner.add(b);
  g.add(inner, glowSprite(col, 1.6, 0.6));
  g.userData.inner = inner;
  return g;
}

// Ícone com um caractere (caveira, marca) — sprite de canvas, sempre virado para a câmera.
const iconCache = new Map();
export function iconSprite(ch, color, size = 0.9) {
  const key = `${ch}|${color}`;
  let tex = iconCache.get(key);
  if (!tex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.font = 'bold 100px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#000'; x.shadowBlur = 14;
    x.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    x.fillText(ch, 64, 70);
    tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.userData.keep = true;
    iconCache.set(key, tex);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  s.scale.setScalar(size);
  s.renderOrder = 10;
  return s;
}

// Marca no chão (anel fino girando) — Marca da Morte.
export function groundRing(color, r) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.82, r, 32).rotateX(-Math.PI / 2), add(color));
  m.material.opacity = 0.75; m.material.side = THREE.DoubleSide;
  m.position.y = 0.08;
  return m;
}

// Nuvem (fumaça cinza ou veneno verde): várias bolas macias que crescem e somem. vfx.add cuida do tempo.
export function cloud(vfx, x, z, r, life, color, dark = true) {
  const n = Math.round(6 + r * 4);
  for (let i = 0; i < n; i++) {
    const s = vfx.sprite(vfx.dustTex, !dark);
    s.material.color.setHex(color);
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r * 0.8;
    s.position.set(x + Math.sin(a) * d, 0.5 + Math.random() * 1.4, z + Math.cos(a) * d);
    const size = 1.6 + Math.random() * 1.2, drift = (Math.random() - 0.5) * 0.6, op = dark ? 0.85 : 0.7;
    vfx.add(s, life * (0.75 + Math.random() * 0.35), (o, k, dt) => {
      o.position.y += drift * dt + 0.25 * dt;
      o.scale.setScalar(size * (0.6 + 0.8 * Math.min(1, k * 4)));
      o.material.opacity = op * (k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1);
    });
  }
}
