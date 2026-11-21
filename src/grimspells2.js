// Grimório Ancestral, lote 2 (13/11/2026), parte 1: Chuva de Meteoros, Sol em Miniatura, Fênix, Pilares de Chamas,
// Cometa Gelado e Prisão de Cristal. Mesmo formato do lote 1 (grimspells.js): { id, name, color, cast(K, p) }.
// Números em l1bless.js (L1.grim). A lista completa das magias é montada em grimkit.js.
import * as THREE from 'three';
import { audio } from './audio.js';
import { grimTex, handsPoint } from './grimlook.js';
import { GRIM as G, v3, rnd, FIRE, EMBER, ICE, addMat, flatGeo, floorGlow, flame, embers, grab, release, windTex } from './grimspells.js';

const SUN = 0xfff2c4, CYAN = 0x4ab0ff;
const foesIn = (K, x, z, r) => K.foes().filter((e) => Math.hypot(e.position.x - x, e.position.z - z) <= r + e.data.radius);
const sprite = (K, color, tex = null) => { const s = K.vfx.sprite(tex || K.vfx.sparkTex); s.material.color.setHex(color); return s; };

// Último ponto livre andando em linha reta (para na parede ou na borda da sala).
export function wallEnd(K, x, z, dx, dz, max = 40, r = 0.5) {
  const B = K.bounds(); let ex = x, ez = z;
  for (let s = 0.5; s <= max; s += 0.5) {
    const nx = x + dx * s, nz = z + dz * s;
    if (Math.abs(nx) > B.x - 0.3 || Math.abs(nz) > B.z - 0.3 || (K.c.world && K.c.world.blocked(nx, nz, r))) break;
    ex = nx; ez = nz;
  }
  return { x: ex, z: ez, d: Math.hypot(ex - x, ez - z) };
}
// Joga o inimigo para o alto e ele cai sozinho (estado lanceFly; grim.clear solta quem ficou no ar).
export function launch(K, e, h, t, p) {
  if (!grab(e)) return false;
  e.grimSpin = { launch: true };
  K.effect({ dur: t, onFrame: (dt, ef) => {
    if (!e.alive || e.state !== 'lanceFly') return;
    const k = ef.t / t; e.position.y = 4 * h * k * (1 - k); e.group.rotation.y += dt * 9; if (e.model) e.model.rotation.x = -0.5 * Math.sin(k * Math.PI);
  }, onEnd: () => { e.grimSpin = null; release(K, e, 0, 0, 0, 0, p); } });
  return true;
}
// Mira: direção da Maga para o grupo de inimigos (ou para a frente, se não tem ninguém).
export function aimDir(K, p, r) {
  const t = K.aim(p, r), dx = t.x - p.position.x, dz = t.z - p.position.z;
  const a = K.foes().length && Math.hypot(dx, dz) > 0.5 ? Math.atan2(dx, dz) : p.facing;
  return { a, dx: Math.sin(a), dz: Math.cos(a), t };
}
// Cristal (prisma de 6 lados com ponta).
let CRY = null;
function crystal(r, h, mat) {
  if (!CRY) CRY = { body: new THREE.CylinderGeometry(1, 1, 1, 6), tip: new THREE.ConeGeometry(1, 1, 6) };
  const g = new THREE.Group();
  const b = new THREE.Mesh(CRY.body, mat); b.scale.set(r, h * 0.78, r); b.position.y = h * 0.39; g.add(b);
  const t = new THREE.Mesh(CRY.tip, mat); t.scale.set(r, h * 0.22, r); t.position.y = h * 0.78 + h * 0.11; g.add(t);
  return g;
}
const iceMat = (op = 0.6) => new THREE.MeshStandardMaterial({ color: 0xbdeeff, emissive: 0x2a8fff, emissiveIntensity: 0.55, transparent: true, opacity: op, roughness: 0.05, metalness: 0.25, flatShading: true, depthWrite: false });

// ---------- 2) Chuva de Meteoros ----------
function rainRock(K, p, x, z, s, side) {
  const R = G.rain, r = R.r * s, fall = R.fall * (s > 1 ? 1.35 : 1);
  const rock = new THREE.Group();
  const core = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75 * s, 1), new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.9, emissive: 0xff4a10, emissiveIntensity: 1, flatShading: true }));
  rock.add(core);
  const aura = sprite(K, FIRE); aura.scale.setScalar(3.4 * s); rock.add(aura);
  const from = v3(x + side * 9 * s, 16 + 4 * s, z - 5), to = v3(x, 0.5, z);
  const warn = new THREE.Mesh(flatGeo(), addMat(0xff3010, 0, grimTex().circle)); warn.position.set(x, 0.1, z);
  K.vfx.add(warn, fall, (o, k, dt) => { o.scale.setScalar(r * 2 * (0.3 + 0.7 * k)); o.rotation.y += dt * 3; o.material.opacity = 0.2 + 0.55 * k; });
  let trailT = 0, done = false;
  K.vfx.add(rock, fall, (o, k, dt) => {
    o.position.lerpVectors(from, to, k * k);
    core.rotation.x += dt * 5; core.rotation.y += dt * 4;
    trailT -= dt;
    if (trailT <= 0) { trailT = 0.03; K.fx.flare(o.position.clone(), rnd(1.6, 2.6) * s, Math.random() < 0.5 ? FIRE : EMBER, 0.3); if (Math.random() < 0.3) K.fx.smoke(o.position.clone(), 1, 0.45 * s); }
    if (k >= 1 && !done) { done = true; boom(); }
  });
  function boom() {
    K.fx.impact(x, z, 0.75 * s, FIRE);
    K.fx.explosion(v3(x, 1, z), 1.4 * s);
    K.fx.pillar(x, z, 6 * s, 1.6 * s, EMBER, 0.5);
    K.glow(x, z, FIRE, 45 * s);
    K.shake(p, 0.32 * s);
    audio.play('rexExplode', x, z, { v: 0.55 * s });
    const dmg = R.dmg * (s > 1 ? R.big : 1);
    for (const e of foesIn(K, x, z, r)) {
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      K.hurt(e, dmg, dx / d, dz / d, 'dmg big', p);
      if (e.alive && e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(9 * s);
    }
    floorGlow(K, x, z, r * 0.8, FIRE, R.burn, 0.5);
    for (let i = 0; i < 3 + 3 * (s > 1); i++) { const a = rnd(0, 6.28), rr = rnd(0.3, r * 0.7); flame(K, x + Math.cos(a) * rr, z + Math.sin(a) * rr, rnd(0.9, 1.5) * s, R.burn); }
    K.effect({ dur: R.burn, tick: R.tick, onTick: () => { for (const e of foesIn(K, x, z, r * 0.8)) K.hurt(e, R.burnDmg, 0, 0, 'dmg', p, true); } });
  }
}
function meteorRain(K, p) {
  const R = G.rain, B = K.bounds(), side = p.position.x > 0 ? -1 : 1;
  K.ui.tint('rgba(150,25,0,0.9)', 0.8, R.over + R.fall + 0.9, 'rgba(120,20,0,0.22)');
  audio.play('fireRoar', p.position.x, p.position.z, { v: 1.3 });
  audio.play('thunder', p.position.x, p.position.z, { v: 0.7 });
  K.glow(p.position.x, p.position.z, FIRE, 40);
  // Um meteoro em cima de cada inimigo; o resto cai espalhado pela sala. O último é gigante, no grupo maior.
  const pts = K.foes().slice(0, R.n - 3).map((e) => [e.position.x + rnd(-0.6, 0.6), e.position.z + rnd(-0.6, 0.6)]);
  for (let tries = 0; pts.length < R.n - 1 && tries < 200; tries++) {
    const x = rnd(-B.x + 1.5, B.x - 1.5), z = rnd(-B.z + 1.5, B.z - 1.5);
    if (K.c.world && K.c.world.blocked(x, z, 0.5)) continue;
    if (pts.some(([a, b]) => Math.hypot(a - x, b - z) < 3)) continue;
    pts.push([x, z]);
  }
  pts.sort(() => Math.random() - 0.5);
  pts.forEach(([x, z], i) => K.later(0.1 + (i / pts.length) * R.over + rnd(0, 0.06), () => rainRock(K, p, x, z, 1, side)));
  K.later(R.over + 0.15, () => { const t = K.aim(p, R.r * R.big); rainRock(K, p, t.x, t.z, R.big, side); });
}

// ---------- 5) Sol em Miniatura ----------
let RAYS = null;
function raysTex() {
  if (RAYS) return RAYS;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.translate(128, 128);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + Math.random() * 0.1, len = 70 + Math.random() * 56, w = 0.05 + Math.random() * 0.05;
    const gr = g.createRadialGradient(0, 0, 20, 0, 0, len); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(Math.cos(a - w) * 30, Math.sin(a - w) * 30); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.lineTo(Math.cos(a + w) * 30, Math.sin(a + w) * 30); g.fill();
  }
  RAYS = new THREE.CanvasTexture(c); RAYS.colorSpace = THREE.SRGBColorSpace;
  return RAYS;
}
function miniSun(K, p) {
  const S = G.sun, start = handsPoint(p), aim0 = K.aim(p, S.r), H = 3.9;
  const pos = v3(start.x, start.y, start.z), goal = v3(aim0.x, H, aim0.z);
  const g = new THREE.Group(); g.position.copy(pos);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color: 0xffe08a })); g.add(core);
  const l1 = new THREE.Mesh(new THREE.SphereGeometry(1.2, 28, 18), addMat(0xff8a20, 0.32)); g.add(l1);
  const l2 = new THREE.Mesh(new THREE.SphereGeometry(1.5, 28, 18), addMat(FIRE, 0.18)); g.add(l2);
  const corona = sprite(K, FIRE); corona.scale.setScalar(6.5); g.add(corona);
  const rays = sprite(K, 0xffb040, raysTex()); rays.scale.setScalar(9); g.add(rays);
  const rays2 = sprite(K, FIRE, raysTex()); rays2.scale.setScalar(6.5); g.add(rays2);
  let ef0 = null;
  const alive = (o) => { if (ef0 && !K.effects.includes(ef0)) o.visible = false; }; // magia cancelada (sala nova): some
  K.vfx.add(g, S.rise + S.dur + 0.02, alive);
  // Coluna de calor até o chão e o chão em brasa embaixo.
  const col = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0), addMat(FIRE, 0, windTex(), THREE.DoubleSide));
  K.vfx.add(col, S.rise + S.dur, alive);
  const fl = new THREE.Mesh(flatGeo(), addMat(0xff7a20, 0, K.vfx.sparkTex)); fl.renderOrder = 2;
  K.vfx.add(fl, S.rise + S.dur, alive);
  const rune = new THREE.Mesh(flatGeo(), addMat(EMBER, 0, grimTex().circle));
  K.vfx.add(rune, S.rise + S.dur, alive);
  audio.play('charge', start.x, start.z, { v: 1.1 }); audio.play('fireRoar', start.x, start.z, { v: 0.8 });
  let aimT = 0, crackT = 0, emT = 0;
  ef0 = K.effect({ dur: S.rise + S.dur, tick: S.tick, onTick: (ef) => {
    if (ef.t < S.rise) return;
    for (const e of foesIn(K, g.position.x, g.position.z, S.r)) { K.hurt(e, S.tickDmg, 0, 0, 'dmg', p, true); if (Math.random() < 0.4) embers(K, e.position.x, 1, e.position.z, 3, 0.4, FIRE, 4); }
  }, onFrame: (dt, ef) => {
    const T = ef.t, end = S.rise + S.dur;
    if (T < S.rise) { const k = T / S.rise, kk = 1 - (1 - k) ** 3; g.position.lerpVectors(pos, goal, kk); g.scale.setScalar(0.15 + 0.85 * kk); }
    else { // segue devagar o grupo de inimigos
      aimT -= dt; if (aimT <= 0) { aimT = 0.4; const t = K.aim(p, S.r); goal.set(t.x, H, t.z); }
      const dx = goal.x - g.position.x, dz = goal.z - g.position.z, d = Math.hypot(dx, dz);
      if (d > 0.1) { g.position.x += dx / d * Math.min(d, S.follow * dt); g.position.z += dz / d * Math.min(d, S.follow * dt); }
      const left = end - T, grow = 1 + 0.5 * (T - S.rise) / S.dur;
      const pulse = left < 0.9 ? 1 - 0.35 * (1 - left / 0.9) + 0.12 * Math.sin(T * 60) : 1 + 0.04 * Math.sin(T * 9);
      g.scale.setScalar(grow * pulse);
      g.position.y = H + Math.sin(T * 2) * 0.15;
    }
    l1.scale.setScalar(1 + 0.05 * Math.sin(T * 13)); l2.scale.setScalar(1 + 0.08 * Math.sin(T * 7 + 1));
    rays.material.rotation += dt * 0.5; rays2.material.rotation -= dt * 0.8;
    corona.material.opacity = 0.45 + 0.15 * Math.sin(T * 17);
    const on = T < S.rise ? T / S.rise : 1, x = g.position.x, z = g.position.z;
    col.position.set(x, 0, z); col.scale.set(S.r * 0.45 * g.scale.x / 1.3, g.position.y, S.r * 0.45 * g.scale.x / 1.3); col.material.opacity = 0.2 * on; col.rotation.y += dt * 2;
    fl.position.set(x, 0.07, z); fl.scale.setScalar(S.r * 2.3); fl.material.opacity = 0.6 * on * (0.9 + 0.1 * Math.sin(T * 25));
    rune.position.set(x, 0.09, z); rune.scale.setScalar(S.r * 2); rune.rotation.y -= dt * 0.7; rune.material.opacity = 0.45 * on;
    K.glow(x, z, 0xffa040, 24 + 8 * Math.sin(T * 20));
    emT -= dt; if (emT <= 0 && T > S.rise) { emT = 0.05; embers(K, x + rnd(-S.r, S.r) * 0.7, 0.2, z + rnd(-S.r, S.r) * 0.7, 2, 0.4, Math.random() < 0.5 ? EMBER : FIRE, 5); }
    crackT -= dt; if (crackT <= 0 && T > S.rise) { crackT = 0.8; K.fx.crack(x + rnd(-2, 2), z + rnd(-2, 2), 1.6, 3, FIRE); }
  }, onEnd: () => {
    const x = g.position.x, z = g.position.z;
    K.fx.flare(v3(x, 3, z), 24, 0xffffff, 0.5);
    K.fx.flare(v3(x, 2, z), 15, FIRE, 0.8);
    K.fx.shock(x, z, S.boomR, EMBER, 0.7);
    K.fx.shock(x, z, S.boomR * 0.6, 0xffffff, 0.45, 0.25);
    K.fx.shock(x, z, S.boomR * 1.35, FIRE, 1.0, 0.3);
    K.fx.pillar(x, z, 18, 4.5, SUN, 0.7);
    K.fx.crack(x, z, 6, 7, FIRE);
    K.fx.rocks(x, z, 26, 1.5);
    K.fx.explosion(v3(x, 2, z), 3);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28, r = rnd(1, S.boomR * 0.7); flame(K, x + Math.cos(a) * r, z + Math.sin(a) * r, rnd(1.2, 2), 1.8); }
    K.ui.flash(p); K.ui.tint('rgba(255,120,0,0.8)', 0.5, 0.5);
    K.glow(x, z, SUN, 100);
    K.shake(p, 1.1);
    audio.play('mechExplode', x, z, { v: 1.3 }); audio.play('fireRoar', x, z, { v: 1 });
    for (const e of foesIn(K, x, z, S.boomR)) {
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      K.hurt(e, S.boom, dx / d, dz / d, 'dmg big', p);
      if (e.alive && e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(16);
    }
  } });
}

// ---------- 6) Fênix ----------
let FEATHER = null;
function featherTex() {
  if (FEATHER) return FEATHER;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 256, 0, 0);
  gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.35, 'rgba(255,220,120,0.95)'); gr.addColorStop(0.75, 'rgba(255,140,40,0.7)'); gr.addColorStop(1, 'rgba(255,60,10,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(32, 256); g.bezierCurveTo(0, 190, 4, 60, 32, 0); g.bezierCurveTo(60, 60, 64, 190, 32, 256); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 256); g.lineTo(32, 20); g.stroke();
  FEATHER = new THREE.CanvasTexture(c); FEATHER.colorSpace = THREE.SRGBColorSpace;
  return FEATHER;
}
function makePhoenix(K) {
  const g = new THREE.Group(), tex = featherTex();
  const fGeo = (w, L) => new THREE.PlaneGeometry(w, L).rotateX(-Math.PI / 2).translate(0, 0, -L / 2); // base na origem, ponta para trás
  const feather = (w, L, color, op = 0.95) => new THREE.Mesh(fGeo(w, L), addMat(color, op, tex, THREE.DoubleSide));
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffc040 })); body.scale.set(0.8, 0.7, 1.7); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshBasicMaterial({ color: 0xfff0b0 })); head.position.set(0, 0.2, 0.85); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff })); beak.position.set(0, 0.17, 1.2); g.add(beak);
  for (let i = 0; i < 3; i++) { const c = feather(0.22, 0.9, EMBER); c.position.set(0, 0.35, 0.8); c.rotation.set(0.5 + i * 0.25, (i - 1) * 0.4, 0); g.add(c); } // crista
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.25, 0.1, 0.1); g.add(pivot);
    for (let i = 0; i < 8; i++) {
      const L = 2.6 - i * 0.12, sw = 0.05 + i * 0.13;
      const f = feather(0.62, L, [0xffe080, 0xffa030, FIRE][i % 3]);
      f.rotation.y = -side * (Math.PI / 2 - sw); f.position.z = -i * 0.06; pivot.add(f);
    }
    wings.push({ pivot, side });
  }
  for (let i = 0; i < 5; i++) { const f = feather(0.45, 3.2 - Math.abs(i - 2) * 0.4, i % 2 ? FIRE : EMBER); f.position.z = -0.55; f.rotation.y = (i - 2) * 0.17; g.add(f); } // cauda
  const halo = sprite(K, FIRE); halo.scale.setScalar(4.5); halo.material.opacity = 0.6; g.add(halo);
  g.scale.setScalar(2.1);
  return { g, wings, halo };
}
function phoenix(K, p) {
  const F = G.phoenix, bird = makePhoenix(K), start = handsPoint(p);
  const st = { x: start.x, z: start.z, y: 1.8, head: p.facing, target: null, hits: 0, last: new Map(), finale: -1, alone: 0 };
  bird.g.position.set(st.x, st.y, st.z);
  K.fx.flare(start.clone(), 5, FIRE, 0.4); embers(K, start.x, start.y, start.z, 20, 0.6, EMBER, 4);
  audio.play('phoenixCry', st.x, st.z, { v: 1.3 }); audio.play('fireRoar', st.x, st.z, { v: 0.7 });
  let flapT = 0, trailT = 0, groundT = 0, gone = false;
  let ef0 = null;
  K.vfx.add(bird.g, F.maxT + 2, (o, k, dt) => {
    if (gone || (ef0 && !K.effects.includes(ef0))) { o.visible = false; return; }
    flapT += dt * 13;
    for (const w of bird.wings) w.pivot.rotation.z = w.side * (0.15 + 0.55 * Math.sin(flapT));
    bird.halo.material.opacity = 0.45 + 0.2 * Math.sin(flapT * 1.7);
  });
  const burn = (e) => K.effect({ dur: F.burn, tick: 0.5, onTick: () => { if (e.alive) { K.hurt(e, F.burnDmg, 0, 0, 'dmg', p, true); embers(K, e.position.x, 1, e.position.z, 3, 0.4, FIRE, 3); } } });
  ef0 = K.effect({ dur: F.maxT + 1.6, onFrame: (dt, ef) => {
    if (gone) return;
    const fin = st.finale >= 0;
    if (!fin) {
      const foes = K.foes();
      if (!st.target || !st.target.targetable) { // próxima presa: quem foi menos queimado, depois o mais perto
        st.target = null; let best = Infinity;
        for (const e of foes) { const n = st.last.has(e) ? 1 : 0, d = Math.hypot(e.position.x - st.x, e.position.z - st.z); const s = n * 100 + d; if (s < best && !(st.last.get(e) > ef.t - 0.6)) { best = s; st.target = e; } }
      }
      let tx, tz;
      if (st.target) { tx = st.target.position.x; tz = st.target.position.z; st.alone = 0; }
      else { st.alone += dt; const a = ef.t * 2.2; tx = p.position.x + Math.cos(a) * 3.5; tz = p.position.z + Math.sin(a) * 3.5; if (st.alone > 1.6 && !foes.length) st.finale = ef.t; }
      const want = Math.atan2(tx - st.x, tz - st.z);
      let diff = want - st.head; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      st.head += Math.max(-F.turn * dt, Math.min(F.turn * dt, diff));
      st.x += Math.sin(st.head) * F.speed * dt; st.z += Math.cos(st.head) * F.speed * dt;
      const B = K.bounds(); st.x = Math.max(-B.x + 1, Math.min(B.x - 1, st.x)); st.z = Math.max(-B.z + 1, Math.min(B.z - 1, st.z));
      st.y = 2.3 + Math.sin(ef.t * 6) * 0.25;
      for (const e of foesIn(K, st.x, st.z, F.r)) { // atravessa o inimigo queimando
        if (st.last.get(e) > ef.t - 0.6) continue;
        st.last.set(e, ef.t); st.hits++;
        K.hurt(e, F.dmg, Math.sin(st.head), Math.cos(st.head), 'dmg big', p);
        if (e.alive) burn(e);
        K.fx.explosion(v3(e.position.x, 1.3, e.position.z), 1.1);
        K.fx.shock(e.position.x, e.position.z, 3, FIRE, 0.35);
        for (let i = 0; i < 6; i++) loosePlume(K, e.position.x, 1.5, e.position.z);
        audio.play('fireSpit', e.position.x, e.position.z, { v: 0.8 });
        K.text(`${st.hits}/${F.hits}`, e.position, 'crit', 3.4);
        if (e === st.target) st.target = null;
        if (st.hits >= F.hits) { st.finale = ef.t; audio.play('phoenixCry', st.x, st.z, { v: 1.2 }); break; }
      }
      if (ef.t > F.maxT) st.finale = ef.t;
    } else { // sobe girando e explode em penas de fogo
      const T = ef.t - st.finale;
      st.head += dt * 7; st.y += dt * 7;
      st.x += Math.sin(st.head) * 4 * dt; st.z += Math.cos(st.head) * 4 * dt;
      if (T > 0.75) {
        gone = true; ef.dur = ef.t;
        const x = st.x, z = st.z;
        K.fx.flare(v3(x, st.y, z), 14, FIRE, 0.6); K.fx.flare(v3(x, st.y, z), 8, 0xffffff, 0.3);
        K.fx.shock(x, z, F.finalR * 1.5, FIRE, 0.7); K.fx.shock(x, z, F.finalR, EMBER, 0.45, 0.25);
        for (let i = 0; i < 30; i++) loosePlume(K, x, st.y, z, true);
        for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.28; flame(K, x + Math.cos(a) * 2, z + Math.sin(a) * 2, 1.4, 1.5); }
        K.glow(x, z, FIRE, 80); K.shake(p, 0.6);
        audio.play('fireRoar', x, z, { v: 1.2 }); audio.play('boom', x, z, { v: 0.8 });
        for (const e of foesIn(K, x, z, F.finalR)) { const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01; K.hurt(e, F.final, dx / d, dz / d, 'dmg big', p); }
        return;
      }
    }
    bird.g.position.set(st.x, st.y, st.z);
    bird.g.rotation.set(fin ? -0.7 : 0, st.head, fin ? 0.5 : -Math.max(-0.6, Math.min(0.6, (st.head - (bird.lastHead ?? st.head)) / Math.max(dt, 1e-3) * 0.08)));
    bird.lastHead = st.head;
    K.glow(st.x, st.z, FIRE, 22);
    trailT -= dt; if (trailT <= 0) { trailT = 0.022; const s = sprite(K, Math.random() < 0.5 ? FIRE : EMBER); s.position.set(st.x + rnd(-0.3, 0.3), st.y + rnd(-0.2, 0.2), st.z + rnd(-0.3, 0.3)); const sc = rnd(1, 1.8); K.vfx.add(s, 0.45, (o, k) => { o.scale.setScalar(sc * (1 - k * 0.7)); o.material.opacity = 0.9 * (1 - k); o.position.y += 0.02; }); }
    groundT -= dt; if (groundT <= 0 && !fin) { groundT = 0.09; flame(K, st.x, st.z, rnd(0.6, 1), 0.9); }
    if (Math.random() < 0.12) audio.play('wingFlap', st.x, st.z, { v: 0.4 });
  } });
}
// Pena de fogo solta (voa, gira e apaga).
function loosePlume(K, x, y, z, big = false) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1).rotateX(-Math.PI / 2), addMat(Math.random() < 0.5 ? FIRE : EMBER, 1, featherTex(), THREE.DoubleSide));
  m.position.set(x, y, z);
  const sp = big ? rnd(5, 11) : rnd(3, 6), a = rnd(0, 6.28), vel = v3(Math.cos(a) * sp, rnd(-1, 4), Math.sin(a) * sp), spin = v3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8));
  K.vfx.add(m, rnd(0.7, 1.3), (o, k, dt) => { o.position.addScaledVector(vel, dt); vel.multiplyScalar(Math.exp(-2.5 * dt)); vel.y -= 2 * dt; o.rotation.x += spin.x * dt; o.rotation.y += spin.y * dt; o.rotation.z += spin.z * dt; o.material.opacity = 1 - k; });
}

// ---------- 7) Pilares de Chamas ----------
function firePillars(K, p) {
  const P = G.pillars, { a, dx, dz } = aimDir(K, p, 2.5);
  const x0 = p.position.x + dx * 1.4, z0 = p.position.z + dz * 1.4, end = wallEnd(K, x0, z0, dx, dz, 40, 0.6);
  const n = Math.max(3, Math.floor(end.d / P.step) + 1), hit = new Set(), pts = [];
  audio.play('fireRoar', x0, z0, { v: 1.3 });
  // Risco de brasa correndo no chão na frente dos pilares.
  const line = new THREE.Mesh(flatGeo(), addMat(EMBER, 1)); line.rotation.y = a;
  const len = (n - 1) * P.step, runT = (n - 1) * P.delay;
  K.vfx.add(line, runT + 1.2, (o, k) => { const kk = Math.min(1, (k * (runT + 1.2)) / Math.max(runT, 0.01)); o.scale.set(0.6 * (1 - k * 0.6), 1, Math.max(0.01, len * kk)); o.position.set(x0 + dx * len * kk / 2, 0.1, z0 + dz * len * kk / 2); o.material.opacity = 0.9 * (1 - k); });
  const pillar = (x, z, i, last) => {
    const s = last ? 1.5 : 1;
    K.fx.pillar(x, z, P.h * s, P.r * 1.1 * s, FIRE, 0.9);
    K.fx.pillar(x, z, P.h * 0.8 * s, P.r * 0.6 * s, EMBER, 0.75);
    K.fx.pillar(x, z, P.h * 0.6 * s, P.r * 0.25 * s, 0xfff0c0, 0.5);
    for (let j = 0; j < 5; j++) { // labaredas subindo em espiral
      const sp = sprite(K, j % 2 ? FIRE : EMBER), ph = rnd(0, 6.28), sc = rnd(1.8, 2.8) * s, h0 = j * 1.3;
      K.vfx.add(sp, 0.85, (o, k) => { o.position.set(x + Math.cos(ph + k * 8) * 0.5, h0 + k * 5, z + Math.sin(ph + k * 8) * 0.5); o.scale.set(sc * (1 - k * 0.5), sc * 1.5 * (1 - k * 0.3), 1); o.material.opacity = Math.min(1, k * 8) * (1 - k); });
    }
    K.fx.crack(x, z, 1.7 * s, 4, FIRE); K.fx.rocks(x, z, 3, 0.9);
    K.fx.flare(v3(x, 1.2, z), 3.5 * s, FIRE, 0.3);
    embers(K, x, 1, z, 8, 0.8, EMBER, 6);
    floorGlow(K, x, z, P.r, FIRE, P.burn, 0.5);
    flame(K, x + rnd(-0.4, 0.4), z + rnd(-0.4, 0.4), rnd(1.2, 1.8), P.burn);
    K.glow(x, z, FIRE, 30);
    if (i % 2 === 0) audio.play('fireSpit', x, z, { v: 0.7 });
    if (i % 3 === 0) K.shake(p, 0.25);
    for (const e of foesIn(K, x, z, P.r)) {
      if (hit.has(e)) continue; hit.add(e);
      K.hurt(e, P.dmg, dx, dz, 'dmg big', p);
      if (e.alive && !e.data.boss) launch(K, e, 3.2, 0.85, p);
    }
    pts.push([x, z]);
  };
  const px = -dz, pz = dx;
  for (let i = 0; i < n; i++) {
    const d = i * P.step, j = rnd(-0.3, 0.3), x = x0 + dx * d + px * j, z = z0 + dz * d + pz * j;
    K.later(i * P.delay, () => pillar(x, z, i, false));
  }
  // Chegou na parede: erupção maior.
  K.later(n * P.delay + 0.05, () => {
    const x = end.x, z = end.z;
    pillar(x, z, n, true);
    K.fx.impact(x, z, 1.2, FIRE); K.fx.explosion(v3(x, 1.4, z), 2.2);
    K.fx.shock(x, z, P.endR * 1.4, FIRE, 0.6);
    K.shake(p, 0.6); audio.play('rexExplode', x, z, { v: 1 });
    for (const e of foesIn(K, x, z, P.endR)) { const ex = e.position.x - x, ez = e.position.z - z, d = Math.hypot(ex, ez) || 0.01; K.hurt(e, P.endDmg, ex / d, ez / d, 'dmg big', p); }
  });
  K.effect({ dur: n * P.delay + P.burn, tick: P.tick, onTick: () => {
    for (const e of K.foes()) if (pts.some(([x, z]) => Math.hypot(e.position.x - x, e.position.z - z) <= P.r * 0.8 + e.data.radius)) K.hurt(e, P.tickDmg, 0, 0, 'dmg', p, true);
  } });
}

// ---------- 9) Cometa Gelado ----------
let SHARD = null;
function iceSpike(K, x, z, h, life, lean = 0.35, ang = rnd(0, 6.28)) {
  if (!SHARD) SHARD = new THREE.ConeGeometry(0.26, 1, 5).translate(0, 0.5, 0);
  const m = new THREE.Mesh(SHARD, new THREE.MeshStandardMaterial({ color: 0xcff4ff, emissive: 0x3a9fff, emissiveIntensity: 0.6, transparent: true, opacity: 0.9, roughness: 0.1, flatShading: true }));
  m.position.set(x, 0, z); m.rotation.set(Math.cos(ang) * lean, 0, -Math.sin(ang) * lean);
  let broke = false;
  K.vfx.add(m, life, (o, k) => {
    const T = k * life, up = Math.min(1, T * 9);
    o.scale.set(1, h * (1 - (1 - up) ** 3), 1);
    if (k > 0.85) { o.material.opacity = 0.9 * (1 - k) / 0.15; if (!broke) { broke = true; K.vfx.sparks(v3(x, 0.6, z), 0xdff6ff, 4); } }
  });
}
function iceComet(K, p) {
  const C = G.comet, { a, dx, dz } = aimDir(K, p, C.r);
  const back = wallEnd(K, p.position.x, p.position.z, -dx, -dz, 40, 0.3), fwd = wallEnd(K, p.position.x, p.position.z, dx, dz, 40, 0.6);
  const from = v3(back.x, 10, back.z), to = v3(fwd.x, 1.3, fwd.z);
  const total = Math.hypot(to.x - from.x, to.z - from.z), dur = Math.max(0.5, total / C.speed);
  const g = new THREE.Group(); g.rotation.y = a;
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: 0xe6f8ff, emissive: CYAN, emissiveIntensity: 0.9, flatShading: true, roughness: 0.1, metalness: 0.3 }));
  g.add(core);
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 1), addMat(ICE, 0.35)); g.add(shell);
  const halo = sprite(K, ICE, K.vfx.iceTex); halo.scale.setScalar(6); g.add(halo);
  const tailGeo = (r, L) => new THREE.ConeGeometry(r, L, 18, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -L / 2);
  const tail = new THREE.Mesh(tailGeo(1.25, 8), addMat(ICE, 0.55, windTex(), THREE.DoubleSide)); g.add(tail);
  const tail2 = new THREE.Mesh(tailGeo(0.6, 5), addMat(0xffffff, 0.6, windTex(), THREE.DoubleSide)); g.add(tail2);
  audio.play('iceWave', from.x, from.z, { v: 1.3 }); audio.play('spin', from.x, from.z, { v: 0.8 });
  const hit = new Set(); let prev = null, acc = 0, done = false, side = 1;
  K.vfx.add(g, dur, (o, k, dt) => {
    const x = from.x + (to.x - from.x) * k, z = from.z + (to.z - from.z) * k;
    const y = k < 0.3 ? 10 - 8.7 * Math.sin((k / 0.3) * Math.PI / 2) : 1.3 + Math.sin(k * 40) * 0.1;
    o.position.set(x, y, z);
    o.rotation.x = k < 0.3 ? 0.5 * (1 - k / 0.3) : 0;
    core.rotation.x += dt * 9; core.rotation.z += dt * 7; shell.rotation.y -= dt * 4;
    tail.material.map.offset.x -= dt * 3;
    K.glow(x, z, ICE, 30);
    if (Math.random() < 0.6) { const s = sprite(K, Math.random() < 0.5 ? ICE : 0xffffff, K.vfx.iceTex); s.position.set(x + rnd(-0.8, 0.8), y + rnd(-0.6, 0.6), z + rnd(-0.8, 0.8)); const sc = rnd(0.3, 0.8); K.vfx.add(s, 0.6, (q, kk) => { q.scale.setScalar(sc * (1 - kk)); q.material.opacity = 1 - kk; q.position.y -= 0.01; }); }
    // Rastro congelado no chão (um pedaço a cada 0,7 m depois que o cometa desce).
    if (y < 3.5) {
      if (prev) acc += Math.hypot(x - prev.x, z - prev.z);
      prev = { x, z };
      while (acc >= 0.7) {
        acc -= 0.7; side = -side;
        const sx = x - dx * acc, sz = z - dz * acc;
        floorGlow(K, sx, sz, 1.9, ICE, 4, 0.5, K.vfx.iceTex);
        iceSpike(K, sx - dz * side * rnd(1.2, 2.2), sz + dx * side * rnd(1.2, 2.2), rnd(0.9, 1.8), rnd(2.6, 3.4), 0.4, Math.atan2(-dz * side, dx * side));
        if (Math.random() < 0.5) K.vfx.sparks(v3(sx, 0.5, sz), 0xdff6ff, 3);
      }
    }
    if (y < 3.2) for (const e of foesIn(K, x, z, C.r)) {
      if (hit.has(e)) continue; hit.add(e);
      K.hurt(e, C.dmg, dx, dz, 'dmg big', p);
      if (e.alive && e.freeze) e.freeze(e.data.boss ? C.boss : C.freeze, K.c);
      K.fx.flare(v3(e.position.x, 1.2, e.position.z), 3, ICE, 0.3);
    }
    if (k >= 1 && !done) { done = true; boom(x, z); }
  });
  function boom(x, z) {
    K.fx.shock(x, z, C.boomR * 1.5, ICE, 0.7); K.fx.shock(x, z, C.boomR, 0xffffff, 0.45, 0.25);
    K.fx.flare(v3(x, 1.4, z), 10, 0xffffff, 0.4); K.fx.flare(v3(x, 1.4, z), 7, ICE, 0.6);
    K.fx.crack(x, z, 3.5, 5, ICE);
    for (let i = 0; i < 12; i++) { const aa = (i / 12) * 6.28, r = rnd(0.8, C.boomR * 0.8); iceSpike(K, x + Math.cos(aa) * r, z + Math.sin(aa) * r, rnd(1.4, 2.6), rnd(2.5, 3.2), 0.5, aa); }
    K.vfx.sparks(v3(x, 1.2, z), 0xdff6ff, 24);
    K.glow(x, z, ICE, 80); K.shake(p, 0.7);
    audio.play('bigShatter', x, z, { v: 1.2 }); audio.play('iceWave', x, z, { v: 0.8 });
    for (const e of foesIn(K, x, z, C.boomR)) {
      K.hurt(e, C.boom, dx, dz, 'dmg big', p);
      if (e.alive && e.freeze) e.freeze(e.data.boss ? C.boss : C.freeze, K.c);
    }
  }
}

// ---------- 10) Prisão de Cristal ----------
function crystalPrison(K, p) {
  const P = G.prison, foes = K.foes().filter((e) => Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) <= G.reach);
  const target = foes.length ? foes.reduce((a, b) => ((b.data.boss ? 1e6 : 0) + b.maxHp > (a.data.boss ? 1e6 : 0) + a.maxHp ? b : a)) : null;
  const pt = target ? target.position.clone() : v3(p.position.x + Math.sin(p.facing) * 5, 0, p.position.z + Math.cos(p.facing) * 5);
  const boss = !!(target && target.data.boss), dur = boss ? P.boss : P.dur, x = pt.x, z = pt.z;
  const sc = target ? Math.max(1, target.group.scale.x || 1) : 1, rad = target ? target.data.radius : 0.6;
  if (target) { if (target.freeze) target.freeze(dur + 0.2, K.c); if (target.vel) target.vel.set(0, 0, 0); K.text('PRESO NO CRISTAL!', target.position, 'crit', 3.8); }
  audio.play('iceWave', x, z, { v: 1.2 }); audio.play('bigShatter', x, z, { v: 0.5 });
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const mats = [];
  const mat = () => { const m = iceMat(0.68); m.emissiveIntensity = 0.8; mats.push(m); return m; };
  const big = crystal(rad + 0.55, 3.6 * sc, mat()); g.add(big); // o inimigo fica dentro deste
  const outer = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * 6.28 + rnd(-0.2, 0.2), r = rad + rnd(0.5, 1.1), h = rnd(1.4, 3.2) * sc;
    const c = crystal(rnd(0.22, 0.45) * sc, h, mat()); c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    c.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45); g.add(c); outer.push(c);
  }
  const glow = sprite(K, ICE, K.vfx.iceTex); glow.scale.setScalar(6 * sc); glow.position.y = 1.6 * sc; g.add(glow);
  const rune = new THREE.Mesh(flatGeo(), addMat(ICE, 0, grimTex().circle)); rune.position.set(x, 0.09, z);
  K.vfx.add(rune, dur + 0.3, (o, k, dt) => { o.scale.setScalar((rad + 2.5) * 2 * Math.min(1, k * 6)); o.rotation.y += dt * 2; o.material.opacity = 0.7 * (k > 0.85 ? (1 - k) / 0.15 : 1); });
  floorGlow(K, x, z, rad + 2.2, ICE, dur + 0.5, 0.5, K.vfx.iceTex);
  let cr1 = false, cr2 = false, sparkT = 0, broke = false;
  K.vfx.add(g, dur, (o, k, dt) => {
    const T = k * dur, grow = 1 - (1 - Math.min(1, T / 0.3)) ** 3;
    o.scale.set(1, grow, 1);
    const shake = k > 0.5 ? (k - 0.5) * 0.25 : 0;
    o.position.set(x + rnd(-shake, shake), 0, z + rnd(-shake, shake));
    for (const m of mats) m.emissiveIntensity = 0.8 + (k > 0.6 ? 0.9 * (k - 0.6) / 0.4 * (0.6 + 0.4 * Math.sin(T * 50)) : 0);
    glow.material.opacity = 0.5 + 0.5 * k;
    if (target && target.alive && !boss) { target.position.x = x; target.position.z = z; }
    sparkT -= dt; if (sparkT <= 0) { sparkT = 0.08; const s = sprite(K, 0xffffff, K.vfx.iceTex); s.position.set(x + rnd(-1.2, 1.2) * sc, rnd(0.3, 3.2) * sc, z + rnd(-1.2, 1.2) * sc); K.vfx.add(s, 0.35, (q, kk) => { q.scale.setScalar(0.45 * Math.sin(kk * Math.PI)); }); }
    if (!cr1 && k > 0.55) { cr1 = true; audio.play('rexCrack', x, z, { v: 0.8 }); K.vfx.sparks(v3(x, 1.5, z), 0xdff6ff, 10); }
    if (!cr2 && k > 0.8) { cr2 = true; audio.play('rexCrack', x, z, { v: 1 }); K.vfx.sparks(v3(x, 2, z), 0xdff6ff, 14); K.fx.flare(v3(x, 1.6, z), 3, ICE, 0.2); }
    if (k >= 1 && !broke) { broke = true; shatter(); }
  });
  function shatter() {
    K.fx.flare(v3(x, 1.6, z), 12, 0xffffff, 0.4); K.fx.flare(v3(x, 1.6, z), 8, ICE, 0.6);
    K.fx.shock(x, z, P.r * 1.2, ICE, 0.6); K.fx.shock(x, z, P.r * 0.6, 0xffffff, 0.4, 0.25);
    K.fx.crack(x, z, 3, 5, ICE);
    K.vfx.sparks(v3(x, 1.5, z), 0xdff6ff, 30);
    K.glow(x, z, ICE, 90); K.shake(p, 0.8); K.ui.flash(p, true);
    audio.play('bigShatter', x, z, { v: 1.4 }); audio.play('iceWave', x, z, { v: 0.7 });
    // Estilhaços voando para todo lado (e um em cada inimigo por perto).
    const dirs = [];
    for (let i = 0; i < P.shards; i++) dirs.push((i / P.shards) * 6.28 + rnd(-0.1, 0.1));
    const others = foesIn(K, x, z, P.r).filter((e) => e !== target);
    for (const e of others) dirs.push(Math.atan2(e.position.x - x, e.position.z - z));
    for (const a of dirs) shard(K, x, z, a, P.r);
    if (target && target.alive) {
      K.hurt(target, P.dmg, 0, 1, 'dmg big', p);
      if (target.alive && target.frozenT > 0) { target.frozenT = 0.01; }
    }
    for (const e of others) {
      if (!e.alive) continue;
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      K.later(d / 26, () => { if (e.alive) { K.hurt(e, P.shardDmg, dx / d, dz / d, 'dmg big', p); if (e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(8); } });
    }
  }
}
let SHARD_GEO = null;
function shard(K, x, z, a, range) {
  if (!SHARD_GEO) SHARD_GEO = new THREE.OctahedronGeometry(0.3, 0).scale(0.5, 0.5, 2);
  const m = new THREE.Mesh(SHARD_GEO, new THREE.MeshStandardMaterial({ color: 0xdff6ff, emissive: CYAN, emissiveIntensity: 0.8, transparent: true, flatShading: true }));
  const y0 = rnd(0.6, 2.2), sp = 26, life = range / sp, spin = rnd(-12, 12);
  m.rotation.y = a;
  K.vfx.add(m, life, (o, k, dt) => { const d = k * range; o.position.set(x + Math.sin(a) * d, y0 - k * 0.6, z + Math.cos(a) * d); o.rotation.z += spin * dt; o.material.opacity = k > 0.8 ? (1 - k) / 0.2 : 1; });
}

export const SPELLS2 = [
  { id: 'chuva', name: 'Chuva de Meteoros', color: FIRE, cast: meteorRain },
  { id: 'sol', name: 'Sol em Miniatura', color: EMBER, cast: miniSun },
  { id: 'fenix', name: 'Fênix', color: FIRE, cast: phoenix },
  { id: 'pilares', name: 'Pilares de Chamas', color: FIRE, cast: firePillars },
  { id: 'cometa', name: 'Cometa Gelado', color: ICE, cast: iceComet },
  { id: 'prisao', name: 'Prisão de Cristal', color: ICE, cast: crystalPrison },
];
