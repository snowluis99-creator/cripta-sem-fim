// Gigante de Aço (lendária da Manopla): ringue de luz da chegada e a tela (faixas de cinema, título, barra de vida
// do robô com a contagem do nocaute). As regras ficam em giantkit.js e o modelo em giant.js.
import * as THREE from 'three';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };

// Lona do ringue: quadrado azul com borda dourada e uma estrela no meio (pintado em canvas).
let canvasTex = null;
function ringTexture() {
  if (canvasTex) return canvasTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 10, 128, 128, 180);
  gr.addColorStop(0, 'rgba(90,170,255,0.55)'); gr.addColorStop(1, 'rgba(20,60,160,0.35)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,214,110,1)'; g.lineWidth = 12; g.strokeRect(8, 8, 240, 240);
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.strokeRect(22, 22, 212, 212);
  g.fillStyle = 'rgba(255,214,110,0.9)'; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 22 : 54; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); }
  g.closePath(); g.fill();
  canvasTex = new THREE.CanvasTexture(c);
  return canvasTex;
}

// Ringue de luz: lona, 4 postes dourados com luz em cima e 3 cordas (vermelha, branca, azul) em cada lado.
export function makeRing(scene, x, z, face, half = 3.4) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; scene.add(g);
  const mats = [];
  const add = (m) => { m.transparent = true; mats.push({ m, o: m.opacity }); return m; };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2), add(new THREE.MeshBasicMaterial({ map: ringTexture(), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 })));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.06; g.add(floor);
  const postMat = add(new THREE.MeshStandardMaterial({ color: 0xf2c14e, emissive: 0x8a5a00, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 }));
  const capMat = add(new THREE.MeshBasicMaterial({ color: 0xfff0b0 }));
  const ropeMats = [0xff3a3a, 0xffffff, 0x3a7aff].map((c) => add(new THREE.MeshBasicMaterial({ color: c, opacity: 0.95 })));
  const corners = [[-half, -half], [half, -half], [half, half], [-half, half]];
  const posts = [];
  for (const [px, pz] of corners) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 2.0, 10), postMat); post.position.set(px, 1.0, pz); g.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), capMat); cap.position.set(px, 2.05, pz); g.add(cap);
    posts.push(post, cap);
  }
  const ropes = [];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    const len = Math.hypot(bx - ax, bz - az);
    [0.75, 1.25, 1.75].forEach((y, j) => {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, len, 6), ropeMats[j]);
      r.position.set((ax + bx) / 2, y, (az + bz) / 2);
      r.rotation.z = Math.PI / 2; r.rotation.y = -Math.atan2(bz - az, bx - ax);
      g.add(r); ropes.push(r);
    });
  }
  const light = new THREE.PointLight(0x9fd0ff, 0, 16, 1.5); light.position.set(0, 4, 0); g.add(light);
  const ring = {
    g, open: 0,
    // open 0..1: postes sobem do chão e as cordas aparecem; depois some aos poucos.
    update(k) {
      ring.open = k;
      const s = smooth(k);
      g.scale.set(1, Math.max(0.001, s), 1);
      for (const it of mats) it.m.opacity = it.o * s;
      light.intensity = 6 * s;
    },
    dispose() {
      scene.remove(g);
      g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      for (const it of mats) it.m.dispose();
    },
  };
  ring.update(0);
  return ring;
}

export class GiantUi {
  constructor() { this.el = null; this.hp = -1; this.chip = 1; this.owner = null; }
  build() {
    if (this.el || typeof document === 'undefined') return;
    const st = document.createElement('style');
    st.textContent = `
#giantbar { position:fixed; left:50%; bottom:74px; transform:translate(-50%, 30px); width:min(520px, 78vw); opacity:0; pointer-events:none; z-index:7; transition:opacity .35s, transform .35s; font-family:Georgia, serif; }
#giantbar.show { opacity:1; transform:translate(-50%, 0); }
#giantbar .top { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:4px; color:#d6ecff; text-shadow:0 1px 2px #000, 0 0 10px rgba(90,190,255,.6); }
#giantbar .name { font:bold 15px Georgia, serif; letter-spacing:.22em; text-transform:uppercase; }
#giantbar .name b { color:#ff4a4a; margin-right:8px; font-size:17px; }
#giantbar .num { font:bold 14px Georgia, serif; }
#giantbar .bar { position:relative; height:16px; background:linear-gradient(#0c1220, #060910); border:2px solid #3a7ad8; box-shadow:0 0 0 1px #000, 0 0 14px rgba(70,160,255,.35), inset 0 0 6px #000; transform:skewX(-14deg); overflow:hidden; }
#giantbar .chip { position:absolute; left:0; top:0; bottom:0; background:#f0f6ff; }
#giantbar .fill { position:absolute; left:0; top:0; bottom:0; background:linear-gradient(#d6f4ff, #6fc8ff 35%, #2b6fd6 75%, #142e6a); box-shadow:0 0 12px rgba(100,200,255,.8); }
#giantbar .fill::after { content:""; position:absolute; inset:0; background:repeating-linear-gradient(90deg, transparent 0 25px, rgba(0,0,0,.4) 25px 27px); }
#giantbar.ko .top { color:#ffd0c8; text-shadow:0 1px 2px #000, 0 0 10px rgba(255,80,60,.7); }
#giantbar.ko .bar { border-color:#a83a3a; }
#giantbar.ko .fill { background:linear-gradient(#9aa4b4, #5d6878 50%, #2c3440); box-shadow:none; }
#giantbar.ko .num { color:#ffb0a0; animation:giantko 1s infinite; }
@keyframes giantko { 50% { opacity:.45; } }
#giantbar.hit .bar { animation:gianthit .22s; }
@keyframes gianthit { 0% { transform:skewX(-14deg) translate(0,0); filter:brightness(2.4); } 30% { transform:skewX(-14deg) translate(-5px,2px); } 60% { transform:skewX(-14deg) translate(4px,-2px); } 100% { transform:skewX(-14deg); } }
#giantcine { position:fixed; inset:0; pointer-events:none; z-index:6; }
#giantcine .dim { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 45%, rgba(0,6,20,0) 25%, rgba(0,4,14,.75) 82%); opacity:0; transition:opacity .5s; }
#giantcine .bars::before, #giantcine .bars::after { content:""; position:absolute; left:0; right:0; height:0; background:#000; transition:height .45s cubic-bezier(.2,.8,.2,1); }
#giantcine .bars::before { top:0; } #giantcine .bars::after { bottom:0; }
#giantcine.on .dim { opacity:1; } #giantcine.on .bars::before, #giantcine.on .bars::after { height:9vh; }
#giantcine .title { position:absolute; left:0; right:0; top:15%; text-align:center; opacity:0; font-family:"Titulo", Georgia, serif; }
#giantcine .title .t1 { font-size:clamp(34px, 7.6vw, 88px); letter-spacing:.1em; text-transform:uppercase; background:linear-gradient(#ffffff, #bfe6ff 40%, #3a8cff 70%, #ff4a4a); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; filter:drop-shadow(0 0 18px rgba(80,170,255,.9)) drop-shadow(0 3px 0 #0a1a40); }
#giantcine .title .t2 { margin-top:2px; font:bold clamp(12px, 1.9vw, 20px) Georgia, serif; letter-spacing:.5em; color:#ffd36a; text-shadow:0 1px 3px #000, 0 0 10px #ffb030; }
#giantcine .title.go { animation:gianttitle 2.6s cubic-bezier(.15,.85,.25,1) forwards; }
#giantcine .ding { position:absolute; left:0; right:0; top:34%; text-align:center; font:900 clamp(26px, 5vw, 60px) Georgia, serif; color:#fff3c0; letter-spacing:.15em; text-shadow:0 0 14px #ffb030, 0 3px 0 #6a3a00; opacity:0; }
#giantcine .ding.go { animation:giantding .9s ease-out forwards; }
#giantcine .flash { position:absolute; inset:0; background:#eaf4ff; opacity:0; }
#giantcine .flash.go { animation:giantflash .45s ease-out; }
@keyframes gianttitle { 0% { opacity:0; transform:scale(2.3); } 12% { opacity:1; transform:scale(1); } 78% { opacity:1; transform:scale(1.04); } 100% { opacity:0; transform:scale(1.1); } }
@keyframes giantding { 0% { opacity:0; transform:scale(.6) rotate(-6deg); } 20% { opacity:1; transform:scale(1.15) rotate(3deg); } 70% { opacity:1; transform:scale(1); } 100% { opacity:0; transform:scale(1.05); } }
@keyframes giantflash { 0% { opacity:.85; } 100% { opacity:0; } }`;
    document.head.appendChild(st);
    const bar = (this.el = document.createElement('div')); bar.id = 'giantbar';
    bar.innerHTML = '<div class="top"><span class="name"><b>✊</b><i>Gigante de Aço</i></span><span class="num"></span></div><div class="bar"><div class="chip"></div><div class="fill"></div></div>';
    const cine = (this.cine = document.createElement('div')); cine.id = 'giantcine';
    cine.innerHTML = '<div class="dim"></div><div class="bars"></div><div class="flash"></div><div class="ding"></div><div class="title"><div class="t1"></div><div class="t2"></div></div>';
    document.body.appendChild(cine); document.body.appendChild(bar);
    this.fill = bar.querySelector('.fill'); this.chipEl = bar.querySelector('.chip'); this.num = bar.querySelector('.num');
  }
  show(on) { this.build(); if (!this.el) return; this.el.classList.toggle('show', on); if (!on) this.letterbox(false); }
  // ko = segundos que faltam para levantar (ou null).
  set(hp, max, ko, dt = 0.016) {
    this.build(); if (!this.el) return;
    const k = clamp01(hp / max);
    if (this.hp >= 0 && hp < this.hp - 0.5 && ko == null) { this.el.classList.remove('hit'); void this.el.offsetWidth; this.el.classList.add('hit'); }
    this.hp = hp;
    this.chip = k > this.chip || ko != null ? k : Math.max(k, this.chip - dt * 0.35);
    this.fill.style.width = `${k * 100}%`; this.chipEl.style.width = `${this.chip * 100}%`;
    this.num.textContent = ko != null ? `NOCAUTE · levanta em ${Math.max(0, Math.ceil(ko))} s` : `${Math.max(0, Math.ceil(hp))} / ${max}`;
    this.el.classList.toggle('ko', ko != null);
  }
  letterbox(on) { this.build(); if (this.cine) this.cine.classList.toggle('on', on); }
  title(t1, t2) {
    this.build(); if (!this.cine) return;
    const t = this.cine.querySelector('.title'); t.querySelector('.t1').textContent = t1; t.querySelector('.t2').textContent = t2;
    t.classList.remove('go'); void t.offsetWidth; t.classList.add('go');
  }
  ding(text) {
    this.build(); if (!this.cine) return;
    const d = this.cine.querySelector('.ding'); d.textContent = text;
    d.classList.remove('go'); void d.offsetWidth; d.classList.add('go');
  }
  flash() { this.build(); if (!this.cine) return; const f = this.cine.querySelector('.flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
}
