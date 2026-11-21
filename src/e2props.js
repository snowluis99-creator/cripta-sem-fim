// Peças visuais das bênçãos ÉPICAS, lote 2 (e2kit.js): crânio do Disfarce, marcas em cima dos inimigos
// (Destruição, X do Sniper, coração do Cupido), mira vermelha, e as telas: Tempo de Bala, lua e o tempo do Sniper.
import * as THREE from 'three';
import { instance } from './assets.js';
import { findBone } from './characters.js';
import { getGlowTexture } from './dungeon/builder.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const add = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

// ---------- Disfarce: o crânio do esqueleto na cabeça do Ladino ----------
export function wearSkull(p) {
  const model = p.model;
  const head = findBone(model, 'head') || findBone(model, 'Head');
  let m;
  try { m = instance('props/crypt/skull.gltf'); } catch { m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8e0c8 })); }
  if (!head) { m.position.y = 2.0; m.scale.setScalar(0.85); p.model.add(m); return m; }
  model.updateMatrixWorld(true);
  const ws = head.getWorldScale(v3(0, 0, 0)).x / Math.max(1e-6, p.group.getWorldScale(v3(0, 0, 0)).x);
  m.scale.setScalar(SKULL_FIT.scale / ws);
  m.position.set(0, SKULL_FIT.y / ws, SKULL_FIT.z / ws);
  m.name = 'E2_Skull';
  head.add(m);
  return m;
}
export const SKULL_FIT = { scale: 1.28, y: -0.02, z: 0.1 }; // cobre o rosto (o crânio menor sumia dentro da cabeça)

// ---------- Marcas em cima da cabeça ----------
// kind: 'mark' (Destruição: lâmina dourada), 'x' (Sniper: X vermelho), 'heart' (Cupido: coração rosa)
export function headMark(e, kind) {
  const g = new THREE.Group();
  const sc = e.group.scale.x || 1;
  if (kind === 'x') {
    const mat = add(0xff2020, 0.95);
    for (const a of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.95), mat);
      bar.rotation.z = a;
      g.add(bar);
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xff2020, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 }));
    glow.scale.setScalar(0.9);
    g.add(glow);
  } else if (kind === 'heart') {
    const s = new THREE.Shape();
    s.moveTo(0, -0.32);
    s.bezierCurveTo(-0.05, -0.25, -0.42, -0.05, -0.36, 0.14);
    s.bezierCurveTo(-0.3, 0.33, -0.06, 0.34, 0, 0.16);
    s.bezierCurveTo(0.06, 0.34, 0.3, 0.33, 0.36, 0.14);
    s.bezierCurveTo(0.42, -0.05, 0.05, -0.25, 0, -0.32);
    const h = new THREE.Mesh(new THREE.ShapeGeometry(s, 12), new THREE.MeshBasicMaterial({ color: 0xff4f9a, side: THREE.DoubleSide }));
    h.scale.setScalar(1.5);
    g.add(h);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xff6fb0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
    glow.scale.setScalar(1.6);
    g.add(glow);
  } else { // Destruição: losango dourado
    const d = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
    d.scale.y = 1.6;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xffb030, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
    glow.scale.setScalar(0.9);
    g.add(d, glow);
  }
  g.position.y = (kind === 'heart' ? 2.95 : 2.7) / sc;
  g.scale.setScalar(1 / sc);
  g.userData.kind = kind;
  e.group.add(g);
  return g;
}
// Faz a marca olhar para a câmera e pulsar.
export function animMark(g, t, camera) {
  if (!g) return;
  if (camera) g.quaternion.copy(camera.quaternion);
  const base = 1 / (g.parent && g.parent.scale.x ? g.parent.scale.x : 1);
  const k = g.userData.kind === 'heart' ? 1 + 0.18 * Math.abs(Math.sin(t * 6)) : 1 + 0.08 * Math.sin(t * 8);
  g.scale.setScalar(base * k);
}
export function dropMark(g) { if (g && g.parent) g.parent.remove(g); }

// ---------- Sniper: mira vermelha no chão ----------
export function makeCrosshair(r) {
  const g = new THREE.Group();
  const mat = add(0xff2a2a, 0.9);
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.08, r, 40).rotateX(-Math.PI / 2), mat);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(r * 0.3 - 0.05, r * 0.3, 24).rotateX(-Math.PI / 2), mat);
  g.add(ring, ring2);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.08, r * 0.55).rotateX(-Math.PI / 2), mat);
    bar.position.set(Math.sin(a) * r * 0.75, 0, Math.cos(a) * r * 0.75);
    bar.rotation.y = a;
    g.add(bar);
  }
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10).rotateX(-Math.PI / 2), mat);
  g.add(dot);
  g.position.y = 0.1;
  return g;
}
// Linha do tiro (some sozinha).
export function shotLine(a, b) {
  const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
  const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff4040, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
  return l;
}

// ---------- Telas (HTML por cima do jogo) ----------
let css = false;
function style() {
  if (css) return;
  css = true;
  const st = document.createElement('style');
  st.textContent = `
    .e2bt{position:fixed;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity .25s;
      background:radial-gradient(circle at 50% 50%,rgba(120,200,255,0) 45%,rgba(40,90,160,.42) 100%);mix-blend-mode:normal}
    .e2bt.on{opacity:1}
    .e2bt .lbl{position:absolute;top:13%;left:50%;transform:translateX(-50%);font:800 clamp(16px,2.6vw,30px) system-ui,sans-serif;
      letter-spacing:.2em;color:#cfeeff;text-shadow:0 0 14px #3aa0ff,0 0 2px #000}
    .e2bt .bar{position:absolute;top:calc(13% + clamp(26px,3.6vw,42px));left:50%;transform:translateX(-50%);width:min(36vw,300px);height:6px;border-radius:3px;background:rgba(0,0,0,.4)}
    .e2bt .fill{height:100%;border-radius:3px;background:#8fd8ff;box-shadow:0 0 8px #3aa0ff}
    .e2moon{position:fixed;right:clamp(10px,2.4vw,34px);bottom:22%;height:52%;width:clamp(44px,6vw,74px);pointer-events:none;z-index:4;display:none}
    .e2moon.on{display:block}
    .e2moon .track{position:absolute;left:50%;top:0;bottom:0;width:2px;transform:translateX(-50%);background:linear-gradient(#ffffff22,#ffffff05)}
    .e2moon .m{position:absolute;left:50%;width:clamp(36px,5vw,62px);height:clamp(36px,5vw,62px);transform:translate(-50%,50%);border-radius:50%;
      background:radial-gradient(circle at 38% 36%,#fffbe8,#e8dcb0 55%,#b8a878 100%);box-shadow:0 0 18px 4px rgba(255,240,190,.35);transition:bottom .35s ease-out}
    .e2moon .m:after{content:'';position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 70% 64%,rgba(120,100,60,.35) 0 10%,transparent 11%),radial-gradient(circle at 30% 70%,rgba(120,100,60,.3) 0 7%,transparent 8%)}
    .e2moon.full .m{background:radial-gradient(circle at 40% 38%,#ffd0b0,#ff6a4a 60%,#9a1a10 100%);box-shadow:0 0 34px 10px rgba(255,80,40,.6)}
    .e2moon .n{position:absolute;left:50%;bottom:-26px;transform:translateX(-50%);font:700 13px system-ui,sans-serif;color:#f4ecd0;text-shadow:0 0 3px #000;white-space:nowrap}
    .e2sn{position:fixed;bottom:86px;left:50%;transform:translateX(-50%);pointer-events:none;z-index:5;display:none;text-align:center;
      font:800 clamp(15px,2.2vw,26px) system-ui,sans-serif;color:#ffd0d0;text-shadow:0 0 10px #ff2020,0 0 2px #000;letter-spacing:.12em}
    .e2sn.on{display:block}
    .e2sn .t{font-size:1.5em;color:#fff}
    .e2sniper-vig{position:fixed;inset:0;pointer-events:none;z-index:4;display:none;background:radial-gradient(circle at 50% 50%,transparent 55%,rgba(60,0,0,.5) 100%)}
    .e2sniper-vig.on{display:block}`;
  document.head.appendChild(st);
}
function el(cls, html) {
  style();
  const d = document.createElement('div');
  d.className = cls;
  d.innerHTML = html;
  document.body.appendChild(d);
  return d;
}

let bt = null;
export const bulletUi = {
  show() { if (!bt) bt = el('e2bt', '<div class="lbl">TEMPO DE BALA</div><div class="bar"><div class="fill"></div></div>'); bt.classList.add('on'); },
  set(k) { if (bt) bt.querySelector('.fill').style.width = `${Math.max(0, Math.min(1, k)) * 100}%`; },
  hide() { if (bt) bt.classList.remove('on'); },
  get on() { return !!(bt && bt.classList.contains('on')); },
};

let moon = null;
export const moonUi = {
  set(k, n, need, full) {
    if (!moon) moon = el('e2moon', '<div class="track"></div><div class="m"></div><div class="n"></div>');
    moon.classList.add('on');
    moon.classList.toggle('full', !!full);
    moon.querySelector('.m').style.bottom = `${Math.max(0, Math.min(1, k)) * 100}%`;
    moon.querySelector('.n').textContent = full ? 'LUA CHEIA' : `${n}/${need}`;
  },
  hide() { if (moon) moon.classList.remove('on'); },
  get on() { return !!(moon && moon.classList.contains('on')); },
};

let sn = null, vig = null;
export const sniperUi = {
  show() {
    if (!sn) sn = el('e2sn', '<div>SNIPER</div><div class="t"></div>');
    if (!vig) vig = el('e2sniper-vig', '');
    sn.classList.add('on'); vig.classList.add('on');
  },
  set(t) { if (sn) sn.querySelector('.t').textContent = t > 0 ? `${t.toFixed(1)} s` : '—'; },
  hide() { if (sn) sn.classList.remove('on'); if (vig) vig.classList.remove('on'); },
  get on() { return !!(sn && sn.classList.contains('on')); },
};

export function hideAllUi() { bulletUi.hide(); moonUi.hide(); sniperUi.hide(); }
