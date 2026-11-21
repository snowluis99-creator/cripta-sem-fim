// Peças visuais das bênçãos ÉPICAS, lote 1 (e1kit.js): poço do Chute Espartano, bola do Meteoro e o círculo
// de mira, o Yeti do Gelo Ancestral e a tela preta do Levante.
import * as THREE from 'three';
import { makeCharacter, findBone } from './characters.js';
import { Animator } from './animation.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- Chute Espartano: poço escuro no chão ----------
export function makePit(r) {
  const g = new THREE.Group();
  const hole = new THREE.Mesh(new THREE.CircleGeometry(r, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x030202 }));
  hole.position.y = 0.03;
  const inner = new THREE.Mesh(new THREE.RingGeometry(r * 0.55, r, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0.85, depthWrite: false }));
  inner.position.y = 0.035;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.13, 6, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5b4a3c, roughness: 1 }));
  rim.position.y = 0.05;
  // pedrinhas soltas em volta
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6d5d4f, roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4, d = r + 0.2 + Math.random() * 0.35;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09 + Math.random() * 0.1), stoneMat);
    s.position.set(Math.sin(a) * d, 0.06, Math.cos(a) * d);
    g.add(s);
  }
  g.add(hole, inner, rim);
  return g;
}

// ---------- Meteoro: bola de ferro gigante pegando fogo ----------
export function makeMeteorBall(r = 1.4) {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3236, metalness: 0.6, roughness: 0.45, emissive: new THREE.Color(0xff5a14), emissiveIntensity: 0.35 });
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), iron);
  g.add(ball);
  const spikeGeo = new THREE.ConeGeometry(r * 0.22, r * 0.55, 6);
  const dirs = [];
  for (let i = 0; i < 14; i++) { // pontos espalhados pela esfera (espiral)
    const y = 1 - (i + 0.5) / 14 * 2, rr = Math.sqrt(1 - y * y), a = i * 2.39996;
    dirs.push(v3(Math.cos(a) * rr, y, Math.sin(a) * rr));
  }
  for (const d of dirs) {
    const s = new THREE.Mesh(spikeGeo, iron);
    s.position.copy(d).multiplyScalar(r * 1.05);
    s.quaternion.setFromUnitVectors(v3(0, 1, 0), d);
    g.add(s);
  }
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(r * 1.55, 18, 12), glowMat);
  g.add(glow);
  const core = new THREE.Mesh(new THREE.SphereGeometry(r * 1.2, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
  g.add(core);
  g.userData = { ball, glow, core, iron };
  return g;
}

// Círculo de mira do Meteoro (o jogador move).
export function makeTarget(r) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.18, r, 48).rotateX(-Math.PI / 2), mat);
  const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff3a0a, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
  const cross = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.16, r * 0.45).rotateX(-Math.PI / 2), mat);
    const a = (i / 4) * Math.PI * 2;
    bar.position.set(Math.sin(a) * r * 0.62, 0, Math.cos(a) * r * 0.62);
    bar.rotation.y = a;
    cross.add(bar);
  }
  g.add(fill, ring, cross);
  g.position.y = 0.12;
  g.userData = { ring, fill, cross };
  return g;
}

// ---------- Gelo Ancestral: o Yeti (o Bárbaro coberto de pelo branco, bem maior) ----------
export function makeYeti(scale) {
  const { group, model } = makeCharacter('heroes/Barbarian.glb');
  model.traverse((o) => {
    if (!o.isMesh) return;
    const m = (Array.isArray(o.material) ? o.material[0] : o.material).clone();
    m.map = null;
    m.color = new THREE.Color(0xeaf6ff);
    if (m.emissive) { m.emissive = new THREE.Color(0x4a86b0); m.emissiveIntensity = 0.32; }
    if ('roughness' in m) m.roughness = 0.95;
    o.material = m;
  });
  // Olhos azuis brilhando e chifres de gelo.
  const head = findBone(model, 'head') || findBone(model, 'Head');
  if (head) {
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x7fe4ff });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), eyeMat);
      eye.position.set(s * 0.16, 0.42, 0.36);
      head.add(eye);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0xbfeaff, emissive: new THREE.Color(0x3a8ac0), emissiveIntensity: 0.4, roughness: 0.3 }));
      horn.position.set(s * 0.34, 0.85, 0);
      horn.rotation.z = -s * 0.5;
      head.add(horn);
    }
  }
  // Pelos espetados nos ombros e nas costas.
  const furMat = new THREE.MeshStandardMaterial({ color: 0xf4fbff, roughness: 1 });
  const chest = findBone(model, 'chest') || findBone(model, 'spine');
  if (chest) {
    for (let i = 0; i < 10; i++) {
      const a = -1.3 + (i / 9) * 2.6;
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 5), furMat);
      tuft.position.set(Math.sin(a) * 0.5, 0.35 + Math.random() * 0.15, -Math.cos(a) * 0.32);
      tuft.rotation.set(-0.9 + Math.random() * 0.3, 0, Math.sin(a) * 0.8);
      chest.add(tuft);
    }
  }
  group.scale.setScalar(scale);
  const anim = new Animator(model);
  return { group, model, anim };
}

// ---------- Levante: tela preta com o botão de ataque ----------
let lv = null;
function levanteEl() {
  if (lv) return lv;
  const st = document.createElement('style');
  st.textContent = `.e1lev{position:fixed;inset:0;background:radial-gradient(circle at 50% 55%,rgba(30,8,4,.9),rgba(0,0,0,.97) 70%);z-index:7;display:none;
      flex-direction:column;align-items:center;justify-content:center;gap:18px;font-family:inherit;color:#ffe6c0;pointer-events:none;user-select:none}
    .e1lev.on{display:flex}
    .e1lev .t1{font-size:clamp(22px,4vw,42px);letter-spacing:.12em;font-weight:800;text-shadow:0 0 18px #ff6a2a,0 0 2px #000}
    .e1lev .t2{font-size:clamp(13px,1.8vw,18px);opacity:.85}
    .e1lev .btn{width:clamp(90px,14vw,150px);height:clamp(90px,14vw,150px);border-radius:50%;border:5px solid #ffd36a;display:flex;align-items:center;justify-content:center;
      font-size:clamp(30px,5vw,58px);background:radial-gradient(circle,#7a3a12,#2a0e04);box-shadow:0 0 30px #ff8a2a;transition:transform .05s}
    .e1lev .btn.hit{transform:scale(.86);box-shadow:0 0 60px #ffd36a}
    .e1lev .bar{width:min(60vw,520px);height:22px;border:3px solid #ffd36a;border-radius:12px;overflow:hidden;background:#1a0a04}
    .e1lev .fill{height:100%;width:0;background:linear-gradient(90deg,#ff6a1a,#ffd36a)}
    .e1lev .time{font-size:clamp(16px,2.4vw,26px);font-weight:700}
    .e1lev.win{background:radial-gradient(circle,rgba(255,220,140,.75),rgba(0,0,0,0) 70%);transition:background .3s}
    .e1lev.lose .btn{border-color:#555;box-shadow:none;filter:grayscale(1)}`;
  document.head.appendChild(st);
  lv = document.createElement('div');
  lv.className = 'e1lev';
  lv.innerHTML = '<div class="t1">LEVANTE!</div><div class="t2">pelos que acreditam em você</div><div class="btn">✊</div><div class="bar"><div class="fill"></div></div><div class="time"></div><div class="t2 help">Aperte o ATAQUE sem parar!</div>';
  document.body.appendChild(lv);
  return lv;
}
export const levanteUi = {
  show(need) { const el = levanteEl(); el.className = 'e1lev on'; el.querySelector('.fill').style.width = '0%'; el.querySelector('.time').textContent = `0 / ${need}`; },
  set(count, need, left) {
    const el = levanteEl();
    el.querySelector('.fill').style.width = `${Math.min(100, (count / need) * 100)}%`;
    el.querySelector('.time').textContent = `${count} / ${need}   ·   ${Math.max(0, left).toFixed(1).replace('.', ',')} s`;
  },
  press() { const b = levanteEl().querySelector('.btn'); b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 60); },
  result(win) { const el = levanteEl(); el.classList.add(win ? 'win' : 'lose'); el.querySelector('.t1').textContent = win ? 'DE PÉ!' : 'CAIU...'; },
  hide() { const el = levanteEl(); el.className = 'e1lev'; el.querySelector('.t1').textContent = 'LEVANTE!'; },
};
