// Visual das bênçãos novas das Kunais (lista do dono, 07/11/2026): selo explosivo, estrepes, fio cortante,
// corrente viva, kunai fantasma, fogos do Grand Finale, sombra pregada. Só aparência; as regras estão em kunaikit.js.
import * as THREE from 'three';
import { getGlowTexture } from './dungeon/builder.js';
import { ghostDagger, glowSprite, dispose } from './rogueprops.js';

export { dispose };
const addMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

// Selo explosivo: papel vermelho com runa, girando em cima da kunai caída (fica preso no grupo dela).
let sealTex = null;
function talismanTexture() { // papel com runa vermelha (desenhado uma vez)
  if (sealTex) return sealTex;
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 96;
  const x = cv.getContext('2d');
  x.fillStyle = '#f2e6c8'; x.fillRect(8, 4, 48, 88);
  x.strokeStyle = '#c81e1e'; x.lineWidth = 5;
  x.beginPath(); x.arc(32, 34, 13, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.moveTo(32, 50); x.lineTo(32, 84); x.moveTo(20, 64); x.lineTo(44, 64); x.stroke();
  sealTex = new THREE.CanvasTexture(cv); sealTex.colorSpace = THREE.SRGBColorSpace;
  return sealTex;
}
export function sealTag() {
  const g = new THREE.Group();
  const mat = new THREE.SpriteMaterial({ map: talismanTexture(), transparent: true, depthWrite: false });
  const paper = new THREE.Sprite(mat);
  paper.scale.set(0.55, 0.82, 1);
  paper.position.y = 0.85;
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.3, 36).rotateX(-Math.PI / 2), addMat(0xff3a2a, 0.5));
  ring.position.y = -0.08;
  const glow = glowSprite(0xff4a2a, 1.4, 0.6);
  glow.position.y = 0.85;
  g.add(glow, paper, ring);
  g.userData = { paper, ring, glow };
  return g;
}

// Estrepes: pontinhas de metal em volta da kunai caída.
export function caltrops() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x9aa4b0, emissive: 0x203040 });
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + Math.random() * 0.5, r = 0.45 + Math.random() * 0.45;
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 4), mat);
    s.position.set(Math.sin(a) * r, -0.05, Math.cos(a) * r);
    s.rotation.set(Math.random() * 0.6 - 0.3, Math.random() * 3, Math.random() * 0.6 - 0.3);
    g.add(s);
  }
  return g;
}

// Ligação entre dois pontos (fio cortante ou corrente viva): uma faixa fina que brilha.
export class Links {
  constructor(scene, color, width, y) {
    this.scene = scene; this.color = color; this.width = width; this.y = y;
    this.pool = []; this.used = 0;
    this.geo = new THREE.BoxGeometry(1, 1, 1);
  }
  begin() { this.used = 0; }
  add(ax, az, bx, bz, ay = this.y, by = this.y) {
    let m = this.pool[this.used];
    if (!m) {
      m = new THREE.Group();
      const core = new THREE.Mesh(this.geo, addMat(this.color, 0.95));
      const halo = new THREE.Mesh(this.geo, addMat(this.color, 0.25));
      halo.scale.set(3, 3, 1);
      m.add(core, halo);
      this.scene.add(m);
      this.pool.push(m);
    }
    this.used++;
    m.visible = true;
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dy, dz) || 0.01;
    m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    m.scale.set(this.width, this.width, len);
    m.lookAt(bx, by, bz);
    const k = 0.75 + 0.25 * Math.sin(performance.now() / 60 + this.used);
    m.children[0].material.opacity = 0.95 * k;
  }
  end() { for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false; }
  clear() { for (const m of this.pool) { this.scene.remove(m); dispose(m); } this.pool = []; this.used = 0; }
}

// Kunai fantasma (Kunai Fantasma e Grand Finale): adaga azul transparente.
export function ghostKunai(color = 0x6fd8ff) {
  const g = ghostDagger();
  g.scale.setScalar(0.8);
  if (color !== 0x6fd8ff) g.traverse((o) => { if (o.isSprite) o.material.color = new THREE.Color(color); });
  return g;
}

// Brilho dourado (kunai do Malabarista) colado na kunai voando.
// Brilho vermelho da kunai cravada (Sanguessuga).
export function bloodGlow() { return glowSprite(0xff2040, 1.6, 0.8); }

export function goldGlow() { return glowSprite(0xffd24a, 1.8, 0.85); }

// Sombra pregada: círculo escuro no chão embaixo do inimigo, com a kunai fincada.
export function pinShadow() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x120818, transparent: true, opacity: 0.75, depthWrite: false }));
  disc.position.y = 0.06;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 28).rotateX(-Math.PI / 2), addMat(0x8a5aff, 0.7));
  ring.position.y = 0.07;
  g.add(disc, ring);
  g.userData.ring = ring;
  return g;
}

// Fogos de artifício (Grand Finale): faíscas coloridas que sobem e abrem no ar.
const FW = [0xff4a6a, 0xffd24a, 0x6fe3ff, 0x9aff6a, 0xd06aff];
export function fireworks(vfx, x, z) {
  for (let k = 0; k < 5; k++) {
    const c = FW[k % FW.length];
    const at = new THREE.Vector3(x + (Math.random() - 0.5) * 2.4, 2.4 + Math.random() * 1.6, z + (Math.random() - 0.5) * 2.4);
    vfx.sparks(at, c, 14);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: c, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.copy(at);
    s.scale.setScalar(0.4);
    vfx.add(s, 0.6, (o, t) => { o.scale.setScalar(0.4 + t * 5); o.material.opacity = 0.9 * (1 - t); });
  }
}
