// Velocidade Rasga-Tempo (lendária da Lança): efeitos próprios — disco de vento da lança girando, tela trincada,
// portal para a floresta pré-histórica (pintado na hora em um canvas), baba da lambida, bola de fogo do dragão,
// barra de vida do T-Rex e a cena (faixas pretas + título). Os efeitos de chão/fumaça reaproveitam o MechFx.
import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function seeded(seed) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- A paisagem do outro lado do portal ----------
let forestTex = null;
export function forestTexture() {
  if (forestTex) return forestTex;
  forestTex = canvasTex(512, 640, (g, W, H) => {
    const r = seeded(7);
    // Céu de fim de tarde.
    const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, '#5fb8ef'); sky.addColorStop(0.55, '#a9dcf0'); sky.addColorStop(1, '#ffe2a0');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // Sol.
    const sun = g.createRadialGradient(W * 0.68, H * 0.4, 4, W * 0.68, H * 0.4, 120);
    sun.addColorStop(0, 'rgba(255,250,220,1)'); sun.addColorStop(0.18, 'rgba(255,236,170,0.9)'); sun.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = sun; g.fillRect(0, 0, W, H);
    // Vulcão com fumaça e montanhas ao fundo.
    g.fillStyle = '#8a8fb8';
    g.beginPath(); g.moveTo(0, H * 0.58); g.lineTo(W * 0.12, H * 0.45); g.lineTo(W * 0.24, H * 0.5); g.lineTo(W * 0.4, H * 0.36); g.lineTo(W * 0.46, H * 0.36); g.lineTo(W * 0.62, H * 0.52); g.lineTo(W * 0.8, H * 0.44); g.lineTo(W, H * 0.55); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.fillStyle = '#ff9a40'; g.beginPath(); g.ellipse(W * 0.43, H * 0.362, 16, 4, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(110,100,120,${0.55 - i * 0.05})`; g.beginPath(); g.arc(W * 0.43 + i * 9 + r() * 8, H * 0.33 - i * 16, 14 + i * 5, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#6b7aa0';
    g.beginPath(); g.moveTo(0, H * 0.62); for (let x = 0; x <= W; x += 32) g.lineTo(x, H * 0.56 + Math.sin(x * 0.03) * 10 + r() * 8); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    // Pterossauros no céu.
    g.strokeStyle = '#3a3048'; g.lineWidth = 3; g.lineCap = 'round';
    for (const [x, y, s] of [[W * 0.22, H * 0.2, 1], [W * 0.3, H * 0.26, 0.7], [W * 0.82, H * 0.16, 0.85]]) {
      g.beginPath(); g.moveTo(x - 22 * s, y - 6 * s); g.quadraticCurveTo(x - 8 * s, y - 12 * s, x, y); g.quadraticCurveTo(x + 8 * s, y - 12 * s, x + 22 * s, y - 6 * s); g.stroke();
    }
    // Camadas de mata (do fundo para a frente: mais escura e maior).
    const layers = [['#3f8a6a', 0.66, 40, 0.6], ['#2f7350', 0.72, 55, 0.8], ['#215c3a', 0.8, 70, 1]];
    for (const [col, y0, sz, k] of layers) {
      g.fillStyle = col;
      for (let x = -20; x < W + 40; x += sz * 0.7) { g.beginPath(); g.arc(x + r() * 12, H * y0 + r() * 14, sz * (0.6 + r() * 0.5), 0, Math.PI * 2); g.fill(); }
      g.fillRect(0, H * y0, W, H);
      // Palmeiras.
      for (let i = 0; i < 2; i++) {
        const px = W * (0.1 + r() * 0.8), base = H * (y0 + 0.08), top = base - 120 * k;
        g.strokeStyle = '#5a4128'; g.lineWidth = 8 * k; g.beginPath(); g.moveTo(px, base); g.quadraticCurveTo(px + 20 * k, (base + top) / 2, px + 6 * k, top); g.stroke();
        g.strokeStyle = col; g.lineWidth = 9 * k;
        for (let f = 0; f < 7; f++) { const a = -Math.PI / 2 + (f - 3) * 0.45; g.beginPath(); g.moveTo(px + 6 * k, top); g.quadraticCurveTo(px + 6 * k + Math.cos(a) * 40 * k, top + Math.sin(a) * 30 * k - 10, px + 6 * k + Math.cos(a) * 70 * k, top + Math.sin(a) * 18 * k + 26 * k); g.stroke(); }
      }
    }
    // Raios de sol entre as árvores.
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = W * (0.45 + i * 0.1);
      const gr = g.createLinearGradient(x, H * 0.38, x - 160, H);
      gr.addColorStop(0, 'rgba(255,240,180,0.22)'); gr.addColorStop(1, 'rgba(255,240,180,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x, H * 0.38); g.lineTo(x + 14, H * 0.38); g.lineTo(x - 120, H); g.lineTo(x - 190, H); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    // Samambaias gigantes na frente.
    const fern = (x, y, a, len, w) => {
      g.strokeStyle = '#174a26'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y);
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len; g.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 - 30, ex, ey); g.stroke();
      g.fillStyle = '#2f8a3c';
      for (let i = 1; i < 12; i++) {
        const t = i / 12, cx = x + (ex - x) * t, cy = y + (ey - y) * t - Math.sin(t * Math.PI) * 30, l = w * (1 - t * 0.7);
        for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + Math.cos(a + s * 1.2) * l * 0.5, cy + Math.sin(a + s * 1.2) * l * 0.5, l * 0.5, l * 0.16, a + s * 1.2, 0, Math.PI * 2); g.fill(); }
      }
    };
    fern(-10, H, -0.9, 230, 60); fern(W + 10, H, -2.2, 240, 64); fern(W * 0.3, H + 10, -1.3, 170, 48); fern(W * 0.75, H + 10, -1.9, 160, 44);
    // Borda: brilho verde-água do rasgo (o centro fica limpo).
    const edge = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.56);
    edge.addColorStop(0, 'rgba(120,255,220,0)'); edge.addColorStop(0.7, 'rgba(120,255,220,0.35)'); edge.addColorStop(1, 'rgba(230,255,250,1)');
    g.fillStyle = edge; g.fillRect(0, 0, W, H);
  });
  return forestTex;
}

let swirlTex = null;
function swirlTexture() {
  if (swirlTex) return swirlTex;
  swirlTex = canvasTex(256, 256, (g, S) => {
    const c = S / 2; g.translate(c, c);
    for (let i = 0; i < 14; i++) {
      g.rotate((Math.PI * 2) / 14);
      const gr = g.createLinearGradient(0, -c * 0.78, 0, -c);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = gr; g.lineWidth = 5 + (i % 3) * 3; g.beginPath(); g.arc(0, 0, c * (0.84 + (i % 4) * 0.035), -0.2, 0.55 + (i % 3) * 0.2); g.stroke();
    }
  });
  return swirlTex;
}

let streakTex = null;
function streakTexture() {
  if (streakTex) return streakTex;
  streakTex = canvasTex(256, 256, (g, S) => {
    const c = S / 2; g.translate(c, c);
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, rr = c * (0.45 + Math.random() * 0.5), len = 0.5 + Math.random() * 1.2;
      g.strokeStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.6})`; g.lineWidth = 1.5 + Math.random() * 4;
      g.beginPath(); g.arc(0, 0, rr, a, a + len); g.stroke();
    }
  });
  return streakTex;
}

// ---------- Portal ----------
// x, z: centro no chão; face: para onde ele "olha" (ângulo, como o facing dos personagens).
export function makePortal(scene, x, z, face) {
  const W = 2.0, H = 2.65, Y = 2.85;
  const root = new THREE.Group(); root.position.set(x, 0, z); root.rotation.y = face; scene.add(root);
  const tilt = new THREE.Group(); tilt.position.y = Y; tilt.rotation.x = -0.28; root.add(tilt);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ map: forestTexture(), side: THREE.DoubleSide, transparent: true }));
  inner.scale.set(W, H, 1); tilt.add(inner);
  const ringMat = new THREE.MeshBasicMaterial({ map: swirlTexture(), color: 0x8affd8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ringMat); ring.position.z = 0.02; tilt.add(ring);
  const ring2 = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ringMat.clone()); ring2.material.color.setHex(0xffffff); ring2.position.z = 0.03; tilt.add(ring2);
  const glowMat = new THREE.SpriteMaterial({ map: softGlow(), color: 0x7dffd0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Sprite(glowMat); glow.position.y = Y; root.add(glow);
  // Luz da floresta derramada no chão.
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: softGlow(), color: 0x9dffb0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  spill.position.set(0, 0.06, 1.6); root.add(spill);
  const light = new THREE.PointLight(0x9affc8, 0, 14, 1.4); light.position.set(0, Y, 1.5); root.add(light);
  const n = new THREE.Vector3(Math.sin(face), 0, Math.cos(face));
  const plane = new THREE.Plane(n.clone(), -(n.x * x + n.z * z) + 0.05);
  const P = {
    root, plane, n, open: 0, t: 0,
    // k: 0 = fechado, 1 = aberto. Abre como um rasgo: primeiro na vertical, depois na largura.
    update(dt, k) {
      P.t += dt; P.open = k;
      const ky = clamp01(k * 2.2), kx = clamp01((k - 0.25) / 0.75);
      const sx = Math.max(0.02, kx * kx * (3 - 2 * kx)), sy = Math.max(0.02, ky * ky * (3 - 2 * ky));
      tilt.scale.set(sx, sy, 1);
      inner.material.opacity = clamp01(k * 3);
      ring.scale.set(W * 1.18, H * 1.15, 1); ring2.scale.set(W * 1.08, H * 1.06, 1);
      ring.rotation.z = P.t * 2.4; ring2.rotation.z = -P.t * 3.6;
      ring.material.opacity = 0.9 * sy; ring2.material.opacity = 0.55 * sy;
      glow.scale.set(W * 5 * sx + 1, H * 3.2 * sy + 1, 1); glowMat.opacity = 0.5 * sy;
      spill.scale.set(W * 4.2 * sx, 1, 4.5); spill.material.opacity = 0.55 * sx;
      light.intensity = 26 * sx;
      // Paisagem "respira" um pouco (parece outro mundo de verdade, não uma foto).
      inner.material.map.offset.x = Math.sin(P.t * 0.6) * 0.01;
    },
    dispose() {
      scene.remove(root);
      inner.geometry.dispose(); inner.material.dispose(); ring.geometry.dispose(); ringMat.dispose(); ring2.geometry.dispose(); ring2.material.dispose();
      glowMat.dispose(); spill.geometry.dispose(); spill.material.dispose(); light.dispose();
    },
  };
  P.update(0, 0);
  return P;
}

let glowTex = null;
function softGlow() {
  if (glowTex) return glowTex;
  glowTex = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  return glowTex;
}

// ---------- Efeitos no mundo ----------
export class RexFx {
  constructor(vfx) { this.vfx = vfx; }

  // Disco de vento: a lança girando tão rápido que vira um borrão.
  whirl(target, life) {
    const mk = (color, op) => new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: streakTexture(), color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const a = mk(0xcff8ff, 0.9), b = mk(0x7fd6ff, 0.6);
    const o = new THREE.Group(); o.add(a); o.add(b);
    this.vfx.add(o, life, (obj, k, dt) => {
      obj.position.set(target.position.x, 1.75 + Math.sin(k * 30) * 0.05, target.position.z);
      const grow = 1.6 + 3.4 * Math.min(1, k * 1.6);
      a.scale.set(grow, 1, grow); b.scale.set(grow * 1.25, 1, grow * 1.25);
      a.rotation.y -= dt * (18 + k * 50); b.rotation.y -= dt * (11 + k * 35);
      a.material.opacity = 0.9 * Math.min(1, k * 4) * (k > 0.9 ? (1 - k) * 10 : 1); b.material.opacity = a.material.opacity * 0.6;
    });
  }

  // Folhas e pólen saindo do portal.
  leaves(P, n = 3) {
    for (let i = 0; i < n; i++) {
      const s = this.vfx.sprite(this.vfx.sparkTex, i % 2 === 0); s.material.color.setHex(i % 2 ? 0x6fd36a : 0xfff0a0);
      const wx = P.root.position.x, wz = P.root.position.z, side = rnd(-1.6, 1.6);
      s.position.set(wx + P.n.z * side, rnd(1, 4.6), wz - P.n.x * side);
      const vel = new THREE.Vector3(P.n.x * rnd(2, 5) + rnd(-1, 1), rnd(-0.5, 1.2), P.n.z * rnd(2, 5) + rnd(-1, 1)), sz = rnd(0.12, 0.3), ph = Math.random() * 6;
      this.vfx.add(s, rnd(0.9, 1.6), (o, k, dt) => { o.position.addScaledVector(vel, dt); o.position.y += Math.sin(ph + k * 12) * dt * 0.8; o.scale.setScalar(sz); o.material.opacity = 1 - k; });
    }
  }

  // Baba da lambida.
  slime(pos, n = 8) {
    for (let i = 0; i < n; i++) {
      const s = this.vfx.sprite(this.vfx.dustTex, false); s.material.color.setHex(0xb8f0a0);
      s.position.set(pos.x + rnd(-0.3, 0.3), pos.y + rnd(-0.2, 0.3), pos.z + rnd(-0.3, 0.3));
      const vel = new THREE.Vector3(rnd(-1.5, 1.5), rnd(0.5, 3), rnd(-1.5, 1.5)), sz = rnd(0.2, 0.42);
      this.vfx.add(s, rnd(0.6, 1.0), (o, k, dt) => { vel.y -= 12 * dt; o.position.addScaledVector(vel, dt); if (o.position.y < 0.1) { o.position.y = 0.1; vel.set(0, 0, 0); } o.scale.setScalar(sz * (1 + k * 0.5)); o.material.opacity = 0.85 * (1 - k); });
    }
  }

  // Fumaça roxa do dragão (sobe das costas).
  shadowSmoke(pos, n = 2, size = 1) {
    for (let i = 0; i < n; i++) {
      const s = this.vfx.sprite(this.vfx.dustTex, false); s.material.color.setHex(i % 2 ? 0x2a1030 : 0x401848);
      s.position.set(pos.x + rnd(-0.6, 0.6), pos.y + rnd(-0.3, 0.3), pos.z + rnd(-0.6, 0.6));
      const vel = new THREE.Vector3(rnd(-0.5, 0.5), rnd(0.8, 2), rnd(-0.5, 0.5)), sz = rnd(0.8, 1.5) * size;
      this.vfx.add(s, rnd(0.7, 1.2), (o, k, dt) => { o.position.addScaledVector(vel, dt); o.scale.setScalar(sz * (0.6 + k)); o.material.opacity = 0.6 * (1 - k) * Math.min(1, k * 6); });
    }
  }

  // Bola de fogo: núcleo claro + chama + rastro. Devolve o objeto (o kit move).
  fireball() {
    const g = new THREE.Group();
    const core = this.vfx.sprite(this.vfx.sparkTex); core.material.color.setHex(0xfff2c0); core.scale.setScalar(1.1);
    const flame = this.vfx.sprite(this.vfx.sparkTex); flame.material.color.setHex(0xff6a1a); flame.scale.setScalar(2.2);
    const dark = this.vfx.sprite(this.vfx.sparkTex); dark.material.color.setHex(0xb02060); dark.scale.setScalar(2.9); dark.material.opacity = 0.5;
    g.add(dark); g.add(flame); g.add(core);
    this.vfx.scene.add(g);
    return {
      g,
      tick: (dt, t) => { flame.scale.setScalar(2.1 + Math.sin(t * 40) * 0.25); core.scale.setScalar(1.0 + Math.sin(t * 55) * 0.15); },
      dispose: () => { this.vfx.scene.remove(g); for (const s of [core, flame, dark]) s.material.dispose(); },
    };
  }
}

// ---------- Tela: barra de vida, faixas de cinema, título, trinca ----------
export class RexUi {
  constructor() { this.el = null; this.hp = -1; this.chip = 1; this.owner = null; }
  build() {
    if (this.el || typeof document === 'undefined') return;
    const st = document.createElement('style');
    st.textContent = `
#rexbar { position:fixed; left:50%; bottom:74px; transform:translate(-50%, 30px); width:min(520px, 78vw); opacity:0; pointer-events:none; z-index:7; transition:opacity .35s, transform .35s; font-family:Georgia, serif; }
#rexbar.show { opacity:1; transform:translate(-50%, 0); }
#rexbar .top { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:4px; color:#d8ffc8; text-shadow:0 1px 2px #000, 0 0 10px rgba(80,255,120,.55); }
#rexbar .name { font:bold 15px Georgia, serif; letter-spacing:.22em; text-transform:uppercase; }
#rexbar .name b { color:#8aff6a; margin-right:8px; font-size:17px; }
#rexbar .num { font:bold 14px Georgia, serif; }
#rexbar .bar { position:relative; height:16px; background:linear-gradient(#0e180c, #070c06); border:2px solid #5aa83a; box-shadow:0 0 0 1px #000, 0 0 14px rgba(90,255,90,.3), inset 0 0 6px #000; transform:skewX(-14deg); overflow:hidden; }
#rexbar .chip { position:absolute; left:0; top:0; bottom:0; background:#f0ffe0; }
#rexbar .fill { position:absolute; left:0; top:0; bottom:0; background:linear-gradient(#d8ffb0, #7fdc4a 35%, #3f9a22 75%, #1f5a0e); box-shadow:0 0 12px rgba(120,255,80,.8); }
#rexbar .mark { position:absolute; left:50%; top:-3px; bottom:-3px; width:3px; background:#1a0a1e; box-shadow:0 0 6px #c040ff; }
#rexbar .fill::after { content:""; position:absolute; inset:0; background:repeating-linear-gradient(90deg, transparent 0 25px, rgba(0,0,0,.4) 25px 27px); }
#rexbar.dark .top { color:#f2d0ff; text-shadow:0 1px 2px #000, 0 0 10px rgba(200,60,255,.7); }
#rexbar.dark .name b { color:#ff5a3a; }
#rexbar.dark .bar { border-color:#8a3aa8; box-shadow:0 0 0 1px #000, 0 0 14px rgba(200,60,255,.45), inset 0 0 6px #000; }
#rexbar.dark .fill { background:linear-gradient(#ffb090, #ff5a2a 35%, #a01a3a 75%, #4a0a30); box-shadow:0 0 12px rgba(255,80,60,.9); }
#rexbar.dark .mark { display:none; }
#rexbar.hit .bar { animation:rexhit .22s; }
@keyframes rexhit { 0% { transform:skewX(-14deg) translate(0,0); filter:brightness(2.4); } 30% { transform:skewX(-14deg) translate(-5px,2px); } 60% { transform:skewX(-14deg) translate(4px,-2px); } 100% { transform:skewX(-14deg); } }
#rexcine { position:fixed; inset:0; pointer-events:none; z-index:6; }
#rexcine .dim { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 45%, rgba(0,10,6,0) 20%, rgba(0,6,4,.8) 80%); opacity:0; transition:opacity .5s; }
#rexcine .bars::before, #rexcine .bars::after { content:""; position:absolute; left:0; right:0; height:0; background:#000; transition:height .45s cubic-bezier(.2,.8,.2,1); }
#rexcine .bars::before { top:0; } #rexcine .bars::after { bottom:0; }
#rexcine.on .dim { opacity:1; } #rexcine.on .bars::before, #rexcine.on .bars::after { height:9vh; }
#rexcine canvas { position:absolute; inset:0; width:100%; height:100%; opacity:0; }
#rexcine .title { position:absolute; left:0; right:0; top:17%; text-align:center; opacity:0; font-family:"Titulo", Georgia, serif; }
#rexcine .title .t1 { font-size:clamp(34px, 7.6vw, 88px); letter-spacing:.1em; text-transform:uppercase; background:linear-gradient(#f4fff0, #9dff7a 45%, #2f9a3a); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; filter:drop-shadow(0 0 18px rgba(80,255,160,.9)) drop-shadow(0 3px 0 #06300e); }
#rexcine .title .t2 { margin-top:2px; font:bold clamp(12px, 1.9vw, 20px) Georgia, serif; letter-spacing:.5em; color:#ffd36a; text-shadow:0 1px 3px #000, 0 0 10px #ffb030; }
#rexcine .title.dark .t1 { background:linear-gradient(#fff0ff, #d070ff 40%, #ff4a2a); -webkit-background-clip:text; background-clip:text; filter:drop-shadow(0 0 18px rgba(200,40,255,.9)) drop-shadow(0 3px 0 #2a0020); }
#rexcine .title.go { animation:rextitle 2.4s cubic-bezier(.15,.85,.25,1) forwards; }
#rexcine .flash { position:absolute; inset:0; background:#eafff4; opacity:0; }
#rexcine .flash.go { animation:rexflash .5s ease-out; }
@keyframes rextitle { 0% { opacity:0; transform:scale(2.3); } 12% { opacity:1; transform:scale(1); } 78% { opacity:1; transform:scale(1.04); } 100% { opacity:0; transform:scale(1.1); } }
@keyframes rexflash { 0% { opacity:.9; } 100% { opacity:0; } }`;
    document.head.appendChild(st);
    const bar = (this.el = document.createElement('div')); bar.id = 'rexbar';
    bar.innerHTML = '<div class="top"><span class="name"><b>✺</b><i>T-Rex</i></span><span class="num"></span></div><div class="bar"><div class="chip"></div><div class="fill"></div><div class="mark"></div></div>';
    const cine = (this.cine = document.createElement('div')); cine.id = 'rexcine';
    cine.innerHTML = '<div class="dim"></div><div class="bars"></div><canvas></canvas><div class="flash"></div><div class="title"><div class="t1"></div><div class="t2"></div></div>';
    document.body.appendChild(cine); document.body.appendChild(bar);
    this.fill = bar.querySelector('.fill'); this.chipEl = bar.querySelector('.chip'); this.num = bar.querySelector('.num'); this.nameEl = bar.querySelector('.name i');
    this.canvas = cine.querySelector('canvas');
  }
  show(on) { this.build(); if (!this.el) return; this.el.classList.toggle('show', on); if (!on) this.letterbox(false); }
  set(hp, max, dark, dt = 0.016) {
    this.build(); if (!this.el) return;
    const k = clamp01(hp / max);
    if (this.hp >= 0 && hp < this.hp) { this.el.classList.remove('hit'); void this.el.offsetWidth; this.el.classList.add('hit'); }
    this.hp = hp;
    this.chip = k > this.chip ? k : Math.max(k, this.chip - dt * 0.35);
    this.fill.style.width = `${k * 100}%`; this.chipEl.style.width = `${this.chip * 100}%`;
    this.num.textContent = `${Math.max(0, Math.ceil(hp))} / ${max}`;
    this.el.classList.toggle('dark', !!dark);
    const nm = dark ? 'Dragão das Trevas' : 'T-Rex';
    if (this.nameEl.textContent !== nm) this.nameEl.textContent = nm;
  }
  letterbox(on) { this.build(); if (this.cine) this.cine.classList.toggle('on', on); }
  title(t1, t2, dark = false) {
    this.build(); if (!this.cine) return;
    const t = this.cine.querySelector('.title'); t.querySelector('.t1').textContent = t1; t.querySelector('.t2').textContent = t2;
    t.classList.toggle('dark', dark); t.classList.remove('go'); void t.offsetWidth; t.classList.add('go');
  }
  flash() { this.build(); if (!this.cine) return; const f = this.cine.querySelector('.flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  // A tela trinca: rachaduras de vidro saindo de um ponto, com cacos claros.
  crack() {
    this.build(); if (!this.canvas) return;
    const c = this.canvas, W = (c.width = Math.round(innerWidth)), H = (c.height = Math.round(innerHeight)), g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.42, R = Math.hypot(W, H) * 0.6;
    const r = seeded(Math.floor(Math.random() * 1000) + 3);
    const rays = [];
    const N = 15;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + (r() - 0.5) * 0.3, pts = [[cx, cy]];
      let x = cx, y = cy, len = R * (0.55 + r() * 0.5), d = 0, ang = a;
      while (d < len) { const st = 18 + r() * 40; ang += (r() - 0.5) * 0.35; x += Math.cos(ang) * st; y += Math.sin(ang) * st; d += st; pts.push([x, y]); }
      rays.push(pts);
    }
    // Cacos (polígonos claros entre dois raios, perto do centro).
    for (let i = 0; i < N; i++) {
      if (r() < 0.45) continue;
      const A = rays[i], B = rays[(i + 1) % N], j = 1 + Math.floor(r() * 3), k2 = Math.min(A.length - 1, j + 2), k3 = Math.min(B.length - 1, j + 2);
      g.fillStyle = `rgba(220,255,245,${0.06 + r() * 0.12})`;
      g.beginPath(); g.moveTo(A[j][0], A[j][1]); g.lineTo(A[k2][0], A[k2][1]); g.lineTo(B[k3][0], B[k3][1]); g.lineTo(B[Math.min(B.length - 1, j)][0], B[Math.min(B.length - 1, j)][1]); g.fill();
    }
    // Anéis (vidro estilhaçado em volta do impacto).
    const ring = (rad) => { g.beginPath(); rays.forEach((p, i) => { const q = p[Math.min(p.length - 1, Math.round(rad / 30))]; if (i === 0) g.moveTo(q[0], q[1]); else g.lineTo(q[0], q[1]); }); g.closePath(); g.stroke(); };
    const lines = (w, col, blur) => {
      g.strokeStyle = col; g.lineWidth = w; g.shadowColor = col; g.shadowBlur = blur; g.lineJoin = 'round';
      for (const p of rays) { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
      // Galhos.
      for (const p of rays) for (let i = 2; i < p.length - 1; i += 3) {
        const [x, y] = p[i], a = r() * Math.PI * 2, l = 20 + r() * 60;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.lineTo(x + Math.cos(a + 0.4) * l * 1.6, y + Math.sin(a + 0.4) * l * 1.6); g.stroke();
      }
      ring(70); ring(160);
    };
    lines(5, 'rgba(0,30,20,0.55)', 0);
    lines(2.2, 'rgba(235,255,250,0.95)', 12);
    g.shadowBlur = 0;
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, 90); core.addColorStop(0, 'rgba(255,255,255,0.95)'); core.addColorStop(1, 'rgba(160,255,220,0)');
    g.fillStyle = core; g.beginPath(); g.arc(cx, cy, 90, 0, Math.PI * 2); g.fill();
    this.crackT0 = performance.now();
    this.frame();
  }
  // A trinca abre de dentro para fora num instante, fica um pouco e some (tempo real, chamado a cada quadro).
  frame() {
    if (this.crackT0 == null || !this.canvas) return;
    const k = (performance.now() - this.crackT0) / 1500;
    const st = this.canvas.style;
    if (k >= 1) { st.opacity = '0'; this.crackT0 = null; return; }
    st.clipPath = `circle(${(75 * Math.min(1, k / 0.07)).toFixed(1)}% at 50% 42%)`;
    st.opacity = String(k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45);
  }
}
