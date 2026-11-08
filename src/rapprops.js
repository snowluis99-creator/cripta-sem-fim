// Visual das bênçãos novas da Rapieira do Ladino (lista do dono, 07/11/2026): espadachim fantasma, pistola,
// punhal da mão esquerda, marcas da Assinatura, ponto fraco brilhando, rapieira fantasma, rastros de estocada,
// tela da Câmera Lenta. Só aparência; as regras estão em rapkit.js.
import * as THREE from 'three';
import { glowSprite, dispose } from './rogueprops.js';
import { makeCharacter, attachWeapon } from './characters.js';
import { instance } from './assets.js';
import { Animator } from './animation.js';

export { dispose, glowSprite };
export const RAPIER_MODEL = 'weapons/extra/sword_C.gltf';
export const DAGGER_MODEL = 'weapons/heroes/dagger.gltf';
const addMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

// ---------- Espadachim Fantasma: cópia do Ladino, azul-clara e transparente, com a rapieira ----------
export function ghostFencer(hero) {
  const { group, model } = makeCharacter(hero.model);
  if (group.children[1]) group.remove(group.children[1]); // sem sombra
  const ws = hero.weapons || {};
  if (ws.right) { try { attachWeapon(model, 'handslot.r', ws.right); } catch { /* sem a arma: só o corpo */ } }
  const mats = [];
  model.traverse((o) => {
    if (!o.isMesh || o.userData.fxPart) return;
    o.material = new THREE.MeshBasicMaterial({ color: 0x8fd4ff, transparent: true, opacity: 0, depthWrite: false });
    mats.push(o.material);
  });
  const anim = new Animator(model);
  return { g: group, model, anim, mats };
}

// ---------- Punhal de Canhota: punhal na mão esquerda ----------
export function leftDagger(model) {
  try { return attachWeapon(model, 'handslot.l', { model: DAGGER_MODEL, rot: [0, 0, 0], scale: 1.0 }); } catch { return null; }
}

// ---------- Mosqueteiro: pistola de pederneira (feita de peças simples) ----------
export function pistol() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x5a5d66, metalness: 0.7, roughness: 0.35 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b3e1f, roughness: 0.7 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xd4a640, metalness: 0.6, roughness: 0.3 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.55, 8), metal);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.05, 0.22);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.24), wood);
  body.position.set(0, 0.02, -0.02);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.1), wood);
  grip.position.set(0, -0.12, -0.12); grip.rotation.x = -0.45;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), brass);
  cap.position.set(0, -0.22, -0.17);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 10), brass);
  ring.position.set(0, 0.05, 0.47);
  const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.04), metal);
  hammer.position.set(0, 0.1, -0.08); hammer.rotation.x = -0.4;
  g.add(barrel, body, grip, cap, ring, hammer);
  g.userData.muzzle = new THREE.Vector3(0, 0.05, 0.5);
  return g;
}

// Clarão do tiro.
export function muzzleFlash() {
  const g = new THREE.Group();
  g.add(glowSprite(0xffd070, 1.4, 0.95), glowSprite(0xffffff, 0.6, 0.9));
  return g;
}

// Rastro reto e fino (tiro, estocada, avanço). Deitado ao longo do eixo Z (comprimento 1).
const lineGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateX(Math.PI / 2);
lineGeo.userData.keep = true;
export function streak(color = 0xffe27a, opacity = 0.9) {
  const m = new THREE.Mesh(lineGeo, addMat(color, opacity));
  return m;
}
// Rastro em pé (visto de lado também): dois planos cruzados.
export function streak2(color = 0xffe27a, opacity = 0.9) {
  const g = new THREE.Group();
  const a = streak(color, opacity), b = streak(color, opacity);
  b.rotation.z = Math.PI / 2;
  g.add(a, b);
  g.userData.mats = [a.material, b.material];
  return g;
}

// ---------- Rapieira fantasma (Golpe Fantasma) ----------
export function ghostRapier() {
  const g = new THREE.Group();
  let w;
  try { w = instance(RAPIER_MODEL); } catch { w = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.6), new THREE.MeshBasicMaterial()); }
  const mats = [];
  w.traverse((o) => {
    if (!o.isMesh) return;
    o.material = new THREE.MeshBasicMaterial({ color: 0xa8e4ff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    mats.push(o.material);
  });
  // a lâmina do modelo aponta para cima (+Y): deita para a frente (+Z)
  w.rotation.x = Math.PI / 2;
  w.position.z = -0.4;
  g.add(w);
  const glow = glowSprite(0x9fe0ff, 0.9, 0.6);
  g.add(glow);
  g.userData.mats = mats;
  g.userData.glow = glow;
  return g;
}

// ---------- Assinatura: riscos brilhando em cima do inimigo (1, 2 ou 3) ----------
const signTex = [];
function signTexture(n, lit) {
  const k = n * 2 + (lit ? 1 : 0);
  if (signTex[k]) return signTex[k];
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = 24 + i * 40;
    g.strokeStyle = lit ? 'rgba(255,90,90,0.55)' : 'rgba(255,220,120,0.45)';
    g.lineWidth = 16;
    g.beginPath(); g.moveTo(x - 6, 52); g.lineTo(x + 14, 12); g.stroke();
    g.strokeStyle = lit ? '#ffe0e0' : '#fff2c0';
    g.lineWidth = 6;
    g.beginPath(); g.moveTo(x - 6, 52); g.lineTo(x + 14, 12); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return (signTex[k] = t);
}
export function signMark() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture(1, false), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  s.scale.set(1.2, 0.6, 1);
  s.renderOrder = 5;
  return s;
}
export function setSign(s, n, lit) {
  s.material.map = signTexture(Math.max(1, Math.min(3, n)), lit);
  s.material.needsUpdate = true;
}

// ---------- Ponto Fraco: estrela brilhando no peito do inimigo ----------
export function weakPoint() {
  const g = new THREE.Group();
  const core = glowSprite(0xffffff, 0.55, 1);
  const halo = glowSprite(0xffe066, 1.5, 0.75);
  core.material.depthTest = false; halo.material.depthTest = false;
  core.renderOrder = 6; halo.renderOrder = 6;
  const cross = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 1.0), addMat(0xfff4b0, 0.9));
    b.material.depthTest = false; b.renderOrder = 6;
    b.rotation.z = i * Math.PI / 2;
    cross.add(b);
  }
  g.add(halo, core, cross);
  g.userData.cross = cross; g.userData.halo = halo;
  return g;
}

// ---------- Câmera Lenta: bordas da tela azuladas ----------
let slowDiv = null;
export function slowOverlay(on) {
  if (typeof document === 'undefined') return;
  if (!slowDiv) {
    slowDiv = document.createElement('div');
    slowDiv.id = 'rapSlow';
    Object.assign(slowDiv.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '5', opacity: '0', transition: 'opacity 0.12s',
      background: 'radial-gradient(ellipse at center, rgba(120,170,255,0) 45%, rgba(70,110,200,0.38) 80%, rgba(30,50,120,0.6) 100%)',
      boxShadow: 'inset 0 0 80px rgba(160,200,255,0.35)',
    });
    document.body.appendChild(slowDiv);
  }
  slowDiv.style.opacity = on ? '1' : '0';
}
