// Visual da 3ª leva de bênçãos da Rapieira (lista do dono, 08/11/2026): furos brilhando (Já Está Morto),
// estrelas e figura (Constelação), linha vermelha (Linha e Agulha), placar (Touché!), coroa (Xeque-Mate),
// chapéu dos mosqueteiros (Um por Todos). Só aparência; as regras estão em rapkit2.js.
import * as THREE from 'three';
import { glowSprite, dispose } from './rogueprops.js';

export { glowSprite, dispose };
const addMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

// ---------- Já Está Morto: furo brilhando no corpo ----------
export function holeMark() {
  const g = new THREE.Group();
  const halo = glowSprite(0xff3040, 0.55, 0.75), core = glowSprite(0xffffff, 0.2, 1);
  halo.material.depthTest = false; core.material.depthTest = false;
  halo.renderOrder = 6; core.renderOrder = 6;
  g.add(halo, core);
  g.userData.halo = halo; g.userData.core = core;
  return g;
}

// ---------- Constelação: estrela no ar ----------
export function starMark() {
  const g = new THREE.Group();
  const halo = glowSprite(0xffd86a, 1.3, 0.7), core = glowSprite(0xffffff, 0.45, 1);
  g.add(halo, core);
  const rays = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.07, i % 2 ? 0.7 : 1.15), addMat(0xfff4c0, 0.9));
    b.rotation.z = i * Math.PI / 4;
    rays.add(b);
  }
  g.add(rays);
  g.userData.rays = rays; g.userData.halo = halo;
  return g;
}

// Linha reta e fina (deitada ao longo do eixo Z, comprimento 1). Serve para a constelação e a linha vermelha.
const lineGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateX(Math.PI / 2);
lineGeo.userData.keep = true;
export function thinLine(color, opacity = 0.9) {
  return new THREE.Mesh(lineGeo, addMat(color, opacity));
}
// Coloca uma linha de (x1,z1) até (x2,z2) na altura y, com largura w.
export function setLine(m, x1, z1, x2, z2, y, w) {
  const dx = x2 - x1, dz = z2 - z1, d = Math.hypot(dx, dz) || 0.001;
  m.position.set(x1, y, z1);
  m.rotation.set(0, Math.atan2(dx, dz), 0);
  m.scale.set(w, 1, d);
}

// Figura da constelação: polígono dourado no chão.
export function starFill(pts) {
  const shape = new THREE.Shape(pts.map((q) => new THREE.Vector2(q.x, -q.z)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, addMat(0xffd86a, 0.35));
  m.position.y = 0.06;
  return m;
}

// ---------- Touché!: placar em cima do inimigo ----------
function scoreCanvas() {
  const c = document.createElement('canvas');
  c.width = 192; c.height = 72;
  return c;
}
function drawScore(c, me, him) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(15,12,8,0.78)';
  g.strokeStyle = 'rgba(255,226,122,0.9)';
  g.lineWidth = 4;
  g.beginPath();
  if (g.roundRect) g.roundRect(4, 4, 184, 64, 14); else g.rect(4, 4, 184, 64);
  g.fill(); g.stroke();
  g.font = 'bold 46px Georgia, serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ffe27a'; g.fillText(String(me), 66, 39);
  g.fillStyle = '#b8b0a0'; g.font = 'bold 34px Georgia, serif'; g.fillText('/ ' + String(him), 128, 41); // him = pontos para o Touché
}
export function scoreBoard() {
  const c = scoreCanvas();
  drawScore(c, 0, 5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
  s.scale.set(2.4, 0.9, 1);
  s.renderOrder = 7;
  s.userData.canvas = c;
  return s;
}
export function setScore(s, me, him) {
  drawScore(s.userData.canvas, me, him);
  s.material.map.needsUpdate = true;
}

// ---------- Xeque-Mate: coroa dourada ----------
export function crownMesh() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc83a, metalness: 0.8, roughness: 0.25, emissive: 0x6a4a00, emissiveIntensity: 0.6 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.18, 14, 1, true), gold);
  band.material.side = THREE.DoubleSide;
  g.add(band);
  const gems = [0xff3050, 0x40a0ff, 0x40ff80];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 5), gold);
    spike.position.set(Math.sin(a) * 0.31, 0.19, Math.cos(a) * 0.31);
    g.add(spike);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), gold);
    ball.position.set(Math.sin(a) * 0.31, 0.31, Math.cos(a) * 0.31);
    g.add(ball);
    if (i % 2 === 0) {
      const gem = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: gems[i / 2] }));
      gem.position.set(Math.sin(a + Math.PI / 6) * 0.33, 0.0, Math.cos(a + Math.PI / 6) * 0.33);
      g.add(gem);
    }
  }
  const glow = glowSprite(0xffd060, 1.1, 0.35);
  glow.position.y = 0.12;
  g.add(glow);
  g.userData.glow = glow;
  return g;
}

// ---------- Um por Todos: chapéu de mosqueteiro (aba larga e pluma) ----------
export function musketHat() {
  const g = new THREE.Group();
  const felt = new THREE.MeshBasicMaterial({ color: 0x3a5a9a, transparent: true, opacity: 0.85, depthWrite: false });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 16), felt);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.3, 12), felt);
  top.position.y = 0.16;
  const plume = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4a5a, transparent: true, opacity: 0.9, depthWrite: false }));
  plume.scale.set(0.35, 0.5, 1.6); plume.position.set(0.22, 0.3, -0.12); plume.rotation.x = 0.5;
  brim.rotation.z = 0.12;
  g.add(brim, top, plume);
  g.userData.mats = [felt, plume.material];
  return g;
}

// ---------- Vem Dançar: estrelinhas girando em cima da cabeça (tonto) ----------
let starTex = null;
function starTexture() {
  if (starTex) return starTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32);
  g.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 27, a = i * Math.PI / 5 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath();
  g.fillStyle = '#ffe24a'; g.fill();
  g.lineWidth = 4; g.strokeStyle = '#7a4a00'; g.stroke();
  starTex = new THREE.CanvasTexture(c); starTex.colorSpace = THREE.SRGBColorSpace;
  return starTex;
}
export function dizzyStars(n = 5) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), transparent: true, depthWrite: false }));
    s.scale.setScalar(0.34);
    s.userData.a = i / n * Math.PI * 2;
    g.add(s);
  }
  g.userData.dizzy = true;
  return g;
}
// Gira as estrelinhas (t em segundos).
export function spinStars(g, t) {
  for (const s of g.children) {
    const a = s.userData.a + t * 4.2;
    s.position.set(Math.cos(a) * 0.5, 0.08 * Math.sin(a * 2), Math.sin(a) * 0.5);
  }
}
