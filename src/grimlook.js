// Grimório Ancestral (lendária do Cajado Arcano): o visual da Maga. O livro flutuando nas costas (feito em código),
// as mãos acesas, o círculo mágico que sai das mãos a cada magia e o escudo arcano em volta dela.
// O livro, as mãos e o escudo ficam presos no herói (sobrevivem à troca de sala) e saem com grimUndress.
import * as THREE from 'three';
import { findBone } from './characters.js';

export const VIOLET = 0xb06bff, GOLD = 0xffd27a, PALE = 0xf3e6ff;
const rnd = (a, b) => a + Math.random() * (b - a);

function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Letras antigas inventadas (traços e pontos).
function glyph(g, x, y, s, seed) {
  let k = seed;
  const r = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
  g.beginPath();
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const ax = x + (r() - 0.5) * s, ay = y + (r() - 0.5) * s, bx = x + (r() - 0.5) * s, by = y + (r() - 0.5) * s;
    if (r() < 0.35) { g.moveTo(ax + s * 0.12, ay); g.arc(ax, ay, s * 0.12, 0, Math.PI * 2); } else { g.moveTo(ax, ay); g.quadraticCurveTo(x, y, bx, by); }
  }
  g.stroke();
}

// Círculo mágico: anéis, letras antigas girando, estrela de 7 pontas e um olho no meio.
function circleTexture() {
  return canvasTex(512, (g, S) => {
    const c = S / 2;
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
    for (const [rad, w] of [[246, 7], [228, 2.5], [176, 4], [160, 1.5], [70, 3]]) { g.lineWidth = w; g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); g.stroke(); }
    g.lineWidth = 2.6;
    for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; glyph(g, c + Math.cos(a) * 202, c + Math.sin(a) * 202, 26, i * 7 + 3); }
    g.lineWidth = 3.5; g.beginPath();
    for (let i = 0; i <= 7; i++) { const a = -Math.PI / 2 + (i * 3 / 7) * Math.PI * 2; const x = c + Math.cos(a) * 160, y = c + Math.sin(a) * 160; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i / 7) * Math.PI * 2; g.beginPath(); g.arc(c + Math.cos(a) * 176, c + Math.sin(a) * 176, 10, 0, Math.PI * 2); g.fill(); }
    g.lineWidth = 4; g.beginPath(); g.ellipse(c, c, 46, 24, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(c, c, 14, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(c, c, 0, c, c, 90); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
}

// Página do livro: papel antigo com letras e uma figura no meio.
function pageTexture() {
  return canvasTex(128, (g, S) => {
    g.fillStyle = '#efe0bd'; g.fillRect(0, 0, S, S);
    const gr = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(90,50,10,0.45)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#5a2a6a'; g.lineWidth = 1.6;
    for (let row = 0; row < 9; row++) for (let col = 0; col < 6; col++) glyph(g, 14 + col * 19, 12 + row * 13, 9, row * 31 + col * 5 + 1);
    g.strokeStyle = '#8a3dc8'; g.lineWidth = 2.2; g.beginPath(); g.arc(S / 2, S / 2, 20, 0, Math.PI * 2); g.stroke();
    g.beginPath(); for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i * 2 / 5) * Math.PI * 2; i ? g.lineTo(S / 2 + Math.cos(a) * 18, S / 2 + Math.sin(a) * 18) : g.moveTo(S / 2 + Math.cos(a) * 18, S / 2 + Math.sin(a) * 18); } g.stroke();
  });
}

// Letras brilhando sobre as páginas abertas.
function runesTexture() {
  return canvasTex(256, (g, S) => {
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 26; i++) glyph(g, rnd(30, S - 30), rnd(30, S - 30), 30, i * 13 + 5);
    g.lineWidth = 4; g.beginPath(); g.arc(S / 2, S / 2, 70, 0, Math.PI * 2); g.stroke();
  });
}

// Escudo: favos hexagonais (some no centro, forte na borda).
function hexTexture() {
  return canvasTex(256, (g, S) => {
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    const r = 14, h = r * Math.sqrt(3);
    for (let y = -h; y < S + h; y += h) for (let x = -r, i = 0; x < S + r * 2; x += r * 1.5, i++) {
      const cy = y + (i % 2 ? h / 2 : 0);
      g.beginPath();
      for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2; k ? g.lineTo(x + Math.cos(a) * r, cy + Math.sin(a) * r) : g.moveTo(x + Math.cos(a) * r, cy + Math.sin(a) * r); }
      g.stroke();
    }
  });
}

let TEX = null;
export const grimTex = () => TEX || (TEX = { circle: circleTexture(), page: pageTexture(), runes: runesTexture(), hex: hexTexture() });

const add = (color, op = 1, map = null, side = THREE.FrontSide) => new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side });

// ---------- O livro ----------
// Grupo: capas (couro vinho com cantoneiras de ouro), blocos de páginas, letras brilhando e uma página que vira.
// open(k): 0 = fechado, 1 = aberto. As capas giram em volta da lombada (eixo Z local).
export function makeBook() {
  const T = grimTex();
  const g = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: 0x5a1630, roughness: 0.65, metalness: 0.1, emissive: 0x2a0418, emissiveIntensity: 0.6 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffcf6a, roughness: 0.3, metalness: 0.9, emissive: 0x6a4a10, emissiveIntensity: 0.9 });
  const paper = new THREE.MeshStandardMaterial({ color: 0xf2e4c4, roughness: 0.9, map: T.page });
  const W = 0.62, D = 0.86;
  const halves = [];
  for (const s of [1, -1]) {
    const hinge = new THREE.Group(); g.add(hinge);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, D), leather); cover.position.x = s * W / 2; hinge.add(cover);
    for (const cz of [-1, 1]) { const tr = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.16), gold); tr.position.set(s * (W - 0.08), 0.005, cz * (D / 2 - 0.08)); hinge.add(tr); }
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), new THREE.MeshBasicMaterial({ color: VIOLET })); gem.position.set(s * W / 2, -0.04, 0); gem.scale.set(1, 0.5, 1); hinge.add(gem);
    const block = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.07, D - 0.06), paper); block.position.set(s * (W / 2 - 0.01), 0.06, 0); hinge.add(block);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, D - 0.1).rotateX(-Math.PI / 2), add(VIOLET, 0.0, T.runes)); glow.position.set(s * (W / 2 - 0.01), 0.1, 0); hinge.add(glow);
    halves.push({ hinge, s, glow });
  }
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, D, 10), leather); spine.rotation.x = Math.PI / 2; spine.position.y = -0.01; g.add(spine);
  // Página que vira (presa na lombada).
  const flipPivot = new THREE.Group(); flipPivot.position.y = 0.1; g.add(flipPivot);
  const flip = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.08, D - 0.08).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf6ead0, map: T.page, side: THREE.DoubleSide, roughness: 0.9 }));
  flip.position.x = (W - 0.08) / 2; flipPivot.add(flip);
  // Brilho embaixo do livro.
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.runes, color: VIOLET, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(1.8); halo.position.y = -0.05; g.add(halo);
  const book = { g, halves, flipPivot, halo, open: 0, flipT: 1, glow: 0 };
  setBookOpen(book, 0);
  return book;
}
export function setBookOpen(b, k) {
  b.open = k;
  const a = (1 - k) * (Math.PI / 2 - 0.02); // fechado: as duas capas de pé, uma contra a outra
  for (const h of b.halves) {
    h.hinge.rotation.z = h.s * a;
    h.glow.material.opacity = k * (0.35 + b.glow * 0.65);
  }
  b.flipPivot.visible = k > 0.85;
}
// Vira uma página (rápido) — a cada magia.
export const flipPage = (b) => { b.flipT = 0; b.glow = 1; };
export function bookTick(b, dt, t) {
  if (b.flipT < 1) { b.flipT = Math.min(1, b.flipT + dt * 3.2); b.flipPivot.rotation.z = b.flipT * Math.PI; }
  else b.flipPivot.rotation.z = 0;
  b.glow = Math.max(0, b.glow - dt * 1.6);
  b.halo.material.opacity = 0.25 + 0.12 * Math.sin(t * 3) + b.glow * 0.5;
  b.halo.scale.setScalar(1.6 + b.glow * 1.2);
  setBookOpen(b, b.open);
}

// ---------- Veste a Maga ----------
// Livro nas costas (preso no grupo do herói, gira com ela), mãos acesas (presas nos ossos das mãos), escudo em volta.
export function grimDress(p) {
  if (p.grimLook) return p.grimLook;
  const L = (p.grimLook = { t: 0, hands: [], book: null, shield: null, hit: 0 });
  const book = makeBook();
  setBookOpen(book, 1);
  book.g.position.set(-0.85, 2.9, -0.75);
  book.g.rotation.set(0.28, 0.4, 0); // aberto e quase deitado: a câmera (de cima) vê as páginas
  book.g.scale.setScalar(1.45);
  p.group.add(book.g);
  L.book = book;
  // Mãos acesas.
  for (const name of ['handslot.r', 'handslot.l']) {
    const bone = findBone(p.model, name);
    if (!bone) continue;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: grimTex().runes, color: VIOLET, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ color: PALE, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    const ws = bone.getWorldScale(new THREE.Vector3()).x || 1;
    const holder = new THREE.Group(); holder.scale.setScalar(1 / ws); bone.add(holder);
    holder.add(s); holder.add(core);
    s.scale.setScalar(0.7); core.scale.setScalar(0.2);
    L.hands.push({ bone, holder, s, core });
  }
  // Escudo arcano: bolha de favos + borda clara, girando devagar.
  const T = grimTex();
  const sh = new THREE.Group(); sh.position.y = 1.05;
  const hex = new THREE.Mesh(new THREE.SphereGeometry(1.35, 28, 18), add(VIOLET, 0.22, T.hex, THREE.DoubleSide));
  T.hex.wrapS = T.hex.wrapT = THREE.RepeatWrapping; T.hex.repeat.set(4, 2);
  const rim = new THREE.Mesh(new THREE.SphereGeometry(1.38, 28, 18), add(0x7a3cff, 0.08, null, THREE.BackSide));
  sh.add(hex); sh.add(rim);
  p.group.add(sh);
  L.shield = { g: sh, hex, rim };
  if (p.weapon) p.weapon.visible = false;
  return L;
}

export function grimUndress(p) {
  const L = p.grimLook;
  if (!L) return;
  if (L.book && L.book.g.parent) L.book.g.parent.remove(L.book.g);
  for (const h of L.hands) if (h.holder.parent) h.holder.parent.remove(h.holder);
  if (L.shield && L.shield.g.parent) L.shield.g.parent.remove(L.shield.g);
  if (p.weapon) p.weapon.visible = true;
  p.grimLook = null;
}

// A cada quadro: livro flutuando, mãos pulsando, escudo girando (e piscando quando segura algo).
export function grimLookTick(p, dt) {
  const L = p.grimLook;
  if (!L) return;
  L.t += dt;
  const t = L.t;
  if (p.weapon && p.weapon.visible) p.weapon.visible = false; // arma refeita (troca de sala): some de novo
  if (L.book) {
    L.book.g.position.y = 2.9 + Math.sin(t * 2.1) * 0.12;
    L.book.g.rotation.z = Math.sin(t * 1.3) * 0.08;
    bookTick(L.book, dt, t);
  }
  const casting = p.state === 'attack';
  for (const h of L.hands) {
    const k = 0.75 + 0.25 * Math.sin(t * 9 + (h === L.hands[0] ? 0 : 2));
    h.s.material.opacity = (casting ? 1 : 0.7) * k;
    h.s.scale.setScalar((casting ? 1.1 : 0.7) * (0.9 + 0.2 * k));
    h.s.material.rotation += dt * 2;
    h.core.scale.setScalar(casting ? 0.34 : 0.22);
  }
  if (L.shield) {
    L.hit = Math.max(0, L.hit - dt * 2.5);
    L.shield.g.rotation.y += dt * 0.35;
    L.shield.hex.material.opacity = 0.16 + 0.05 * Math.sin(t * 2.5) + L.hit * 0.7;
    L.shield.rim.material.opacity = 0.07 + L.hit * 0.35;
    const s = 1 + L.hit * 0.12;
    L.shield.g.scale.setScalar(s);
  }
}
export const grimShieldFlash = (p) => { if (p.grimLook) p.grimLook.hit = 1; };

// Ponto entre as duas mãos (no mundo); sem ossos: na frente do peito.
export function handsPoint(p) {
  const L = p.grimLook, v = new THREE.Vector3();
  if (L && L.hands.length) {
    for (const h of L.hands) v.add(h.bone.getWorldPosition(new THREE.Vector3()));
    v.multiplyScalar(1 / L.hands.length);
    v.x += Math.sin(p.facing) * 0.35; v.z += Math.cos(p.facing) * 0.35;
    if (v.y < 0.8) v.y = 1.2;
    return v;
  }
  return v.set(p.position.x + Math.sin(p.facing) * 0.8, 1.25, p.position.z + Math.cos(p.facing) * 0.8);
}

// Círculo mágico que sai das mãos ao conjurar: de pé, virado para onde ela mira (inclinado para a câmera ver),
// cresce girando e some. Um segundo círculo menor gira ao contrário. color = cor do elemento da magia.
export function castCircle(vfx, p, color = VIOLET, size = 1.6) {
  const at = handsPoint(p), T = grimTex();
  const geo = new THREE.PlaneGeometry(1, 1);
  const mk = (c, sz, spin, life, op) => {
    const holder = new THREE.Group();
    holder.position.copy(at);
    holder.rotation.order = 'YXZ';
    holder.rotation.y = p.facing; holder.rotation.x = -0.55; // de pé, inclinado para cima
    const m = new THREE.Mesh(geo, add(c, op, T.circle, THREE.DoubleSide));
    holder.add(m);
    vfx.add(holder, life, (o, k, dt) => {
      const grow = 1 - (1 - Math.min(1, k * 3.5)) ** 3;
      m.scale.setScalar(sz * (0.2 + 0.8 * grow) * (1 + k * 0.15));
      m.rotation.z += dt * spin;
      m.material.opacity = op * (k < 0.7 ? 1 : (1 - k) / 0.3);
    });
  };
  mk(color, size, 3.2, 0.6, 0.95);
  mk(GOLD, size * 0.62, -5, 0.5, 0.8);
  mk(PALE, size * 1.25, 1.2, 0.45, 0.35);
  // Faíscas saindo do círculo para a frente.
  for (let i = 0; i < 10; i++) {
    const s = vfx.sprite(vfx.sparkTex); s.material.color.setHex(i % 2 ? color : GOLD); s.position.copy(at);
    const sp = rnd(4, 9), a = p.facing + rnd(-0.5, 0.5);
    const vel = new THREE.Vector3(Math.sin(a) * sp, rnd(-0.5, 2.5), Math.cos(a) * sp), sz = rnd(0.12, 0.3);
    vfx.add(s, rnd(0.3, 0.55), (o, k, dt) => { o.position.addScaledVector(vel, dt); vel.multiplyScalar(Math.exp(-4 * dt)); o.scale.setScalar(sz * (1 - k)); o.material.opacity = 1 - k; });
  }
}

// Página solta voando (cena de entrada): papel girando em espiral em volta da Maga.
export function flyingPage(vfx, cx, cz, a0, r0, life) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.92), new THREE.MeshStandardMaterial({ color: 0xf6ead0, map: grimTex().page, side: THREE.DoubleSide, roughness: 0.9, emissive: 0x3a1a50, emissiveIntensity: 0.6, transparent: true }));
  const spin = new THREE.Vector3(rnd(-6, 6), rnd(-6, 6), rnd(-6, 6)), h0 = rnd(0.4, 1.2), up = rnd(1.8, 4.2), turns = rnd(1.2, 2.2) * (Math.random() < 0.5 ? 1 : -1);
  vfx.add(m, life, (o, k, dt) => {
    const a = a0 + k * turns * Math.PI * 2, r = r0 * (0.4 + k * 1.4);
    o.position.set(cx + Math.cos(a) * r, h0 + up * k, cz + Math.sin(a) * r);
    o.rotation.x += spin.x * dt; o.rotation.y += spin.y * dt; o.rotation.z += spin.z * dt;
    o.material.opacity = k > 0.75 ? (1 - k) / 0.25 : 1;
  });
}
