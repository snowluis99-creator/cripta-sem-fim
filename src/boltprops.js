// Visual das bênçãos novas da Besta do Ladino (lista do dono, 07/11/2026): barrinha de recarga, gancho e corda,
// rede, estaca da âncora, armadilha de urso, sino, fogo no chão, torre (besta montada), mira, virotes da chuva.
// Só aparência; as regras estão em boltkit.js.
import * as THREE from 'three';
import { instance } from './assets.js';
import { glowSprite, dispose } from './rogueprops.js';

export { dispose, glowSprite };
export const BOLT_MODEL = 'weapons/heroes/arrow_crossbow.gltf';
export const XBOW_MODEL = 'weapons/heroes/crossbow_1handed.gltf';
const addMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const lam = (color, emissive = 0x000000) => new THREE.MeshLambertMaterial({ color, emissive });

// Modelo com material próprio (a geometria é a do modelo carregado: não é apagada no dispose).
function model(path, scale, tint = null, emissive = null, opacity = 1) {
  const m = instance(path);
  m.scale.setScalar(scale);
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.userData.keep = true;
    o.material = o.material.clone();
    if (tint != null) o.material.color = new THREE.Color(tint);
    if (emissive != null) { o.material.emissive = new THREE.Color(emissive); o.material.emissiveIntensity = 0.9; }
    if (opacity < 1) { o.material.transparent = true; o.material.opacity = opacity; o.material.depthWrite = false; }
  });
  return m;
}

// Virote solto (ponta para +Z do grupo). ghost: azulado e transparente (Eco, Divisor, torre).
export function boltMesh(color = null, ghost = false) {
  const g = new THREE.Group();
  const a = model(BOLT_MODEL, 1.8, ghost ? 0x9fe8ff : null, color, ghost ? 0.7 : 1);
  a.rotation.x = -Math.PI / 2; // virote: ponta em -Y no modelo
  g.add(a);
  if (color != null) g.add(glowSprite(color, 1.0, 0.6));
  return g;
}

// ---------- Recarga Perfeita: barrinha sobre a cabeça ----------
const barMat = (color, opacity) => new THREE.SpriteMaterial({ color, transparent: true, opacity, depthWrite: false, depthTest: false });
export function reloadBar(zoneA, zoneB) {
  const W = 1.8, H = 0.2, g = new THREE.Group();
  const bg = new THREE.Sprite(barMat(0x14100c, 0.85)); bg.scale.set(W + 0.1, H + 0.1, 1);
  const zone = new THREE.Sprite(barMat(0xffc83a, 0.95)); zone.center.set(0, 0.5);
  zone.scale.set(W * (zoneB - zoneA), H, 1); zone.position.x = -W / 2 + W * zoneA;
  const fill = new THREE.Sprite(barMat(0x7a6a58, 0.8)); fill.center.set(0, 0.5); fill.position.x = -W / 2; fill.scale.set(0.001, H * 0.55, 1);
  const cur = new THREE.Sprite(barMat(0xffffff, 1)); cur.scale.set(0.07, H + 0.16, 1);
  for (const s of [bg, zone, fill, cur]) { s.renderOrder = 20; g.add(s); }
  g.userData = { W, fill, cur, zone, bg };
  return g;
}
export function setReloadBar(g, k, state) {
  const u = g.userData;
  u.fill.scale.x = Math.max(0.001, u.W * k);
  u.cur.position.x = -u.W / 2 + u.W * k;
  if (state === 'ok') { u.zone.material.color.setHex(0xfff2a0); u.cur.material.color.setHex(0xffe060); }
  if (state === 'bad') { u.zone.material.color.setHex(0x6a5030); u.cur.material.color.setHex(0xff4030); u.bg.material.color.setHex(0x3a0c08); }
}

// ---------- Gancho e corda ----------
export function hookMesh() {
  const g = new THREE.Group();
  const metal = lam(0x8c96a4, 0x1a1e24);
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6).rotateX(Math.PI / 2), metal);
  g.add(shank);
  for (let i = 0; i < 3; i++) { // três pontas curvas
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 5, 10, Math.PI * 0.9), metal);
    c.rotation.set(0, Math.PI / 2, 0); c.rotateX(i / 3 * Math.PI * 2);
    c.position.z = 0.22;
    g.add(c);
  }
  g.add(glowSprite(0xcfe4ff, 0.6, 0.35));
  return g;
}

// Cordas: pedaços finos marrons (um por corda, reaproveitados a cada quadro).
export class Ropes {
  constructor(scene, color = 0x8a6a3a, width = 0.06) {
    this.scene = scene; this.pool = []; this.used = 0; this.width = width;
    this.geo = new THREE.BoxGeometry(1, 1, 1);
    this.mat = lam(color, 0x1a1208);
  }
  begin() { this.used = 0; }
  add(ax, ay, az, bx, by, bz) {
    let m = this.pool[this.used];
    if (!m) { m = new THREE.Mesh(this.geo, this.mat); this.scene.add(m); this.pool.push(m); }
    this.used++;
    m.visible = true;
    const len = Math.hypot(bx - ax, by - ay, bz - az) || 0.01;
    m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    m.scale.set(this.width, this.width, len);
    m.lookAt(bx, by, bz);
  }
  end() { for (let i = this.used; i < this.pool.length; i++) this.pool[i].visible = false; }
  clear() { this.begin(); this.end(); }
}

// Linha de mira (Mira de Atirador): faixa vermelha que brilha.
export function laserLine() {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  const core = new THREE.Mesh(geo, addMat(0xff3030, 0.9));
  const halo = new THREE.Mesh(geo, addMat(0xff2020, 0.25));
  core.scale.set(0.05, 0.05, 1); halo.scale.set(0.2, 0.2, 1);
  g.add(core, halo);
  const dot = glowSprite(0xff4040, 0.9, 0.9);
  g.add(dot);
  g.userData = { core, halo, dot };
  return g;
}
export function setLaser(g, x, z, a, len, t) {
  const u = g.userData;
  g.position.set(x, 1.25, z); g.rotation.set(0, a, 0);
  u.core.scale.z = len; u.halo.scale.z = len; u.dot.position.set(0, 0, len);
  const k = 0.75 + 0.25 * Math.sin(t * 14);
  u.core.material.opacity = 0.9 * k; u.halo.material.opacity = 0.25 * k;
}

// ---------- Rede ----------
export function netMesh(r) {
  const g = new THREE.Group();
  const mat = lam(0xb89a62, 0x2a2010);
  const geo = new THREE.BoxGeometry(1, 0.05, 0.05);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = -r + (i + 0.5) * (2 * r / n), half = Math.sqrt(Math.max(0, r * r - t * t));
    const a = new THREE.Mesh(geo, mat); a.scale.x = half * 2; a.position.set(0, 0.12, t); g.add(a);
    const b = new THREE.Mesh(geo, mat); b.scale.x = half * 2; b.position.set(t, 0.13, 0); b.rotation.y = Math.PI / 2; g.add(b);
  }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 5, 32).rotateX(Math.PI / 2), mat);
  rim.position.y = 0.12; g.add(rim);
  for (let i = 0; i < 6; i++) { // pesinhos na borda
    const a = i / 6 * Math.PI * 2;
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), lam(0x5a5a62));
    w.position.set(Math.sin(a) * r, 0.12, Math.cos(a) * r); g.add(w);
  }
  return g;
}

// ---------- Âncora: estaca no chão ----------
export function stake() {
  const g = new THREE.Group();
  const b = boltMesh(null);
  b.rotation.x = Math.PI / 2 - 0.25; // cravado quase de pé, ponta para baixo
  b.position.y = 0.45;
  g.add(b);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 5, 12).rotateX(Math.PI / 2), lam(0x8c96a4));
  ring.position.y = 0.75; g.add(ring);
  return g;
}

// ---------- Armadilha de urso ----------
export function bearTrap() {
  const g = new THREE.Group();
  const metal = lam(0x6c727c, 0x14161a);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.08, 10), metal);
  base.position.y = 0.04; g.add(base);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.03, 20), lam(0x4a4e56));
  plate.position.y = 0.02; g.add(plate);
  const jaws = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group(); pivot.position.set(0, 0.06, 0); pivot.rotation.y = s > 0 ? 0 : Math.PI;
    const jaw = new THREE.Group();
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 5, 16, Math.PI), metal);
    arc.rotation.x = -Math.PI / 2; jaw.add(arc);
    for (let i = 1; i < 8; i++) { // dentes
      const a = i / 8 * Math.PI;
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), lam(0xc8ccd4, 0x202020));
      t.position.set(Math.cos(a) * 0.6, 0.1, Math.sin(a) * 0.6); jaw.add(t);
    }
    pivot.add(jaw); g.add(pivot);
    jaws.push(jaw);
  }
  g.userData = { jaws, open: 0 };
  setTrapOpen(g, 1);
  return g;
}
// 1 = aberta (deitada no chão), 0 = fechada (mandíbulas de pé, mordendo).
export function setTrapOpen(g, k) {
  for (const j of g.userData.jaws) j.rotation.x = -(1 - k) * Math.PI / 2;
  g.userData.open = k;
}

// ---------- Sino ----------
export function bellMesh() {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.08 + 0.3 * t * t + 0.05 * t, 0.5 - t * 0.5)); }
  const bell = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), new THREE.MeshLambertMaterial({ color: 0xe8b84a, emissive: 0x4a3008, side: THREE.DoubleSide }));
  const swing = new THREE.Group(); swing.position.y = 1.55;
  bell.position.y = -0.5; swing.add(bell);
  const clap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), lam(0x6a5030)); clap.position.y = -0.48; swing.add(clap);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 6), lam(0x6a4a2a)); post.position.y = 0.8;
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), lam(0x6a4a2a)); top.position.y = 1.6;
  g.add(post, top, swing, glowSprite(0xffd060, 1.4, 0.4));
  g.children[3].position.y = 1.3;
  g.userData = { swing };
  return g;
}

// ---------- Fogo no chão (Rastro Incendiário) ----------
export function flame() {
  const s = glowSprite(Math.random() < 0.5 ? 0xff7a2a : 0xffa040, 0.9 + Math.random() * 0.4, 0.8);
  s.position.y = 0.35;
  return s;
}

// ---------- Fumaça (Bomba de Fumaça / Roleta) ----------
export function smokeDisc(r) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x8a8f9c, transparent: true, opacity: 0.35, depthWrite: false }));
  m.position.y = 0.06;
  return m;
}

// ---------- Torre (Besta Montada) ----------
export function turretMesh() {
  const g = new THREE.Group();
  const wood = lam(0x6a4a2a, 0x140c06);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.25, 6), wood);
    leg.position.set(Math.sin(a) * 0.32, 0.55, Math.cos(a) * 0.32);
    leg.rotation.set(Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45);
    g.add(leg);
  }
  const head = new THREE.Group(); head.position.y = 1.15;
  const xb = model(XBOW_MODEL, 1.7);
  head.add(xb);
  const glow = glowSprite(0xffc46a, 1.2, 0.35); glow.position.z = 0.6; head.add(glow);
  g.add(head);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.95, 32).rotateX(-Math.PI / 2), addMat(0xffc46a, 0.5));
  ring.position.y = 0.06; g.add(ring);
  g.userData = { head, xb, ring };
  return g;
}

// ---------- Chuva de Virotes: alvo no chão ----------
export function rainMarker(r) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.18, r, 40).rotateX(-Math.PI / 2), addMat(0xff4a3a, 0.9));
  const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 40).rotateX(-Math.PI / 2), addMat(0xff4a3a, 0.15));
  const cross = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 20).rotateX(-Math.PI / 2), addMat(0xff8a6a, 0.9));
  for (const m of [ring, fill, cross]) { m.position.y = 0.08; g.add(m); }
  g.userData = { ring, fill };
  return g;
}

// Prego: virote atravessado no inimigo, cravado na parede atrás dele.
export function nailBolt() {
  const g = boltMesh(0xffc46a);
  g.children[0].scale.setScalar(2.2);
  return g;
}

// ---------- Divindade: entidade espectral arqueira (roxa, translúcida, com contorno escuro e olhos dourados) ----------
// Figura própria (não é cópia de nenhum personagem): tronco de armadura com costelas, ombreiras com espinho,
// elmo com chifres e crista, chamas roxas em volta e um arco grande. Olha para +z (a direção do tiro).
const DIV_FILL = 0x9a4dff, DIV_LINE = 0x22063a, DIV_EYE = 0xffd23a;
function divMats() {
  const fill = addMat(DIV_FILL, 0.2); fill.userData.op = 0.2;
  const bright = addMat(0xc89bff, 0.55); bright.userData.op = 0.55;
  const flame = addMat(0x8a3dff, 0.14); flame.userData.op = 0.14;
  const line = new THREE.LineBasicMaterial({ color: DIV_LINE, transparent: true, opacity: 0.9, depthWrite: false }); line.userData.op = 0.9;
  const eye = new THREE.MeshBasicMaterial({ color: DIV_EYE, transparent: true, opacity: 1 }); eye.userData.op = 1;
  return { fill, bright, flame, line, eye };
}
// Peça translúcida com o contorno desenhado por cima (parece traço de desenho).
function divPart(parent, geo, M, mat = M.fill, edge = true) {
  const m = new THREE.Mesh(geo, mat);
  if (edge) m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), M.line));
  parent.add(m);
  return m;
}
// Cilindro entre dois pontos (braços).
function divLimb(parent, a, b, r, M) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const m = divPart(parent, new THREE.CylinderGeometry(r * 0.85, r, len, 8), M);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
export function divineSpirit() {
  const M = divMats(), g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  // base em chamas (sem pernas: flutua)
  const skirt = divPart(body, new THREE.ConeGeometry(1.35, 2.4, 10, 1, true), M);
  skirt.rotation.x = Math.PI; skirt.position.y = 1.5;
  // tronco com costelas
  const torso = divPart(body, new THREE.SphereGeometry(1, 12, 10), M);
  torso.scale.set(1.25, 1.35, 0.85); torso.position.y = 3.0;
  for (let i = 0; i < 4; i++) {
    const rib = divPart(body, new THREE.TorusGeometry(0.98 - i * 0.06, 0.035, 4, 18, Math.PI * 0.85), M, M.bright, false);
    rib.rotation.set(Math.PI / 2, 0, Math.PI * 0.075 + Math.PI); rib.scale.set(1.2, 0.85, 1);
    rib.position.set(0, 2.45 + i * 0.32, 0.05);
  }
  // ombreiras com espinho
  for (const s of [1, -1]) {
    const pad = divPart(body, new THREE.SphereGeometry(0.75, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M);
    pad.position.set(1.3 * s, 3.65, 0); pad.scale.set(1.15, 0.7, 1); pad.rotation.z = -0.45 * s;
    const spike = divPart(body, new THREE.ConeGeometry(0.18, 0.9, 6), M);
    spike.position.set(1.75 * s, 4.15, -0.1); spike.rotation.z = -0.7 * s;
  }
  // cabeça, elmo com crista e chifres, olhos dourados
  const head = new THREE.Group(); head.position.y = 4.45; body.add(head);
  const skull = divPart(head, new THREE.SphereGeometry(0.5, 10, 8), M); skull.scale.set(0.9, 1, 0.95);
  const crest = divPart(head, new THREE.ConeGeometry(0.2, 1.1, 6), M); crest.position.set(0, 0.75, -0.1); crest.rotation.x = -0.25;
  for (const s of [1, -1]) {
    const horn = divPart(head, new THREE.TorusGeometry(0.6, 0.07, 5, 12, Math.PI * 0.55), M);
    horn.position.set(0.12 * s, 0.05, 0.1); horn.rotation.set(0, s > 0 ? 0 : Math.PI, 0.1);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 5), M.eye);
    eye.scale.set(1.5, 0.7, 0.6); eye.position.set(0.17 * s, 0.02, 0.44); eye.rotation.z = 0.35 * s;
    head.add(eye);
    const glow = glowSprite(DIV_EYE, 0.45, 0.8); glow.position.copy(eye.position); head.add(glow);
  }
  // arco grande (vertical, na frente) e flecha
  const bowC = new THREE.Vector3(0.55, 3.4, 0.2), R = 1.6, arc = Math.PI * 0.75;
  const bowG = new THREE.Group(); bowG.position.copy(bowC); bowG.rotation.y = -Math.PI / 2; body.add(bowG);
  const bow = divPart(bowG, new THREE.TorusGeometry(R, 0.07, 5, 26, arc), M, M.bright);
  bow.rotation.z = -arc / 2;
  const ey = Math.sin(arc / 2) * R, ez = Math.cos(arc / 2) * R;
  const sGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, ey, ez), new THREE.Vector3(0, 0, -0.6), new THREE.Vector3(0, -ey, ez)]);
  const string = new THREE.Line(sGeo, M.line); string.position.copy(bowC); body.add(string);
  const arrow = new THREE.Group(); arrow.position.set(bowC.x, bowC.y, -0.6 + bowC.z); body.add(arrow);
  const shaft = divPart(arrow, new THREE.CylinderGeometry(0.04, 0.04, 2.8, 6), M, M.bright, false); shaft.rotation.x = Math.PI / 2; shaft.position.z = 1.4;
  const tip = divPart(arrow, new THREE.ConeGeometry(0.13, 0.4, 6), M, M.bright, false); tip.rotation.x = Math.PI / 2; tip.position.z = 2.9;
  // braços: um segura o arco, o outro puxa a corda
  divLimb(body, new THREE.Vector3(1.25, 3.55, 0.1), new THREE.Vector3(bowC.x, bowC.y, bowC.z + R), 0.26, M);
  divLimb(body, new THREE.Vector3(-1.25, 3.55, 0.1), new THREE.Vector3(bowC.x - 0.1, bowC.y + 0.05, bowC.z - 0.6), 0.26, M);
  const fist = divPart(body, new THREE.SphereGeometry(0.3, 8, 6), M); fist.position.set(bowC.x, bowC.y, bowC.z + R);
  // chamas em volta
  const flames = [];
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.4, 6, 1, true), M.flame);
    f.position.set(Math.sin(a) * 1.45, 2.3 + (i % 3) * 0.45, Math.cos(a) * 1.0 - 0.2);
    body.add(f); flames.push({ f, ph: i * 1.7 });
  }
  const aura = glowSprite(0x8a3dff, 6.5, 0.35); aura.material.userData.op = 0.35; aura.position.set(0, 3.0, -0.4); body.add(aura);
  g.userData = { body, flames, string, sGeo, arrow, ey, ez, bowC };
  g.traverse((o) => { o.renderOrder = 5; });
  animDivine(g, 0, 0);
  return g;
}
// k: 0..1 da vida da entidade. Aparece rápido, solta a flecha, some devagar.
export function animDivine(g, k, time) {
  const u = g.userData;
  const a = k < 0.12 ? k / 0.12 : k > 0.55 ? Math.max(0, 1 - (k - 0.55) / 0.45) : 1;
  u.body.scale.setScalar(0.65 + 0.35 * Math.min(1, k / 0.12));
  u.body.position.y = 0.3 * Math.sin(time * 3) * 0.3 + (k > 0.55 ? (k - 0.55) * 1.2 : 0);
  g.traverse((o) => { const m = o.material; if (m && m.userData && m.userData.op != null) m.opacity = m.userData.op * a; });
  // corda: puxada até soltar (k = 0.1), depois volta para o arco e a flecha some
  const pull = k < 0.1 ? -0.6 : Math.max(0, -0.6 + (k - 0.1) * 12) ;
  const z = Math.min(u.ez, pull + 0.0);
  const pos = u.sGeo.attributes.position; pos.setZ(1, k < 0.1 ? -0.6 : Math.min(u.ez, z)); pos.needsUpdate = true;
  u.arrow.visible = k < 0.1;
  for (const { f, ph } of u.flames) { f.scale.set(1, 0.75 + 0.35 * Math.sin(time * 9 + ph), 1); }
}
// Flecha de luz roxa (no lugar do virote invisível). Some sozinha quando o virote some.
export function divineArrow() {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), addMat(0xe6ccff, 0.95)); core.rotation.x = Math.PI / 2;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 6), addMat(0xe6ccff, 0.95)); tip.rotation.x = Math.PI / 2; tip.position.z = 1.55;
  const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.02, 4.2, 8, 1, true), addMat(0x9a4dff, 0.45)); trail.rotation.x = -Math.PI / 2; trail.position.z = -1.6;
  const glow = glowSprite(0xb060ff, 1.6, 0.8); glow.position.z = 1.2;
  g.add(core, tip, trail, glow);
  g.traverse((o) => { if (o.material) o.userData.op = o.material.opacity; });
  g.userData.divineArrow = true;
  return g;
}
