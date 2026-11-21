// Grimório Ancestral, lote 2 (13/11/2026), parte 2: Nevasca, Floresta de Lanças, Tempestade e Raio Sem Fim.
// Mesmo formato do lote 1 (grimspells.js): { id, name, color, cast(K, p) }. Números em l1bless.js (L1.grim).
import * as THREE from 'three';
import { audio } from './audio.js';
import { handsPoint } from './grimlook.js';
import { GRIM as G, v3, rnd, ICE, addMat, flatGeo, floorGlow, windTex } from './grimspells.js';
import { aimDir } from './grimspells2.js';

const BOLT = 0x9fd8ff, SNOW = 0xeef8ff;
const foesIn = (K, x, z, r) => K.foes().filter((e) => Math.hypot(e.position.x - x, e.position.z - z) <= r + e.data.radius);
const sprite = (K, color, tex = null) => { const s = K.vfx.sprite(tex || K.vfx.sparkTex); s.material.color.setHex(color); return s; };

// ---------- 11) Nevasca ----------
function blizzard(K, p) {
  const N = G.blizzard, g = new THREE.Group(); g.position.copy(p.position);
  // Nuvem de neve girando em volta da Maga (pontos).
  const n = 460, pos = new Float32Array(n * 3), st = [];
  for (let i = 0; i < n; i++) st.push({ a: rnd(0, 6.28), r: rnd(0.9, N.r), h: rnd(0.1, 3.8), sp: rnd(2.5, 5.5), ph: rnd(0, 6.28) });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: K.vfx.iceTex, color: SNOW, size: 0.42, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; g.add(pts);
  const winds = [];
  for (const [r, h, op, spd] of [[N.r * 0.45, 3.4, 0.35, 7], [N.r * 0.75, 2.8, 0.3, -5], [N.r, 2.1, 0.24, 4]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, h, 30, 1, true).translate(0, h / 2, 0), new THREE.MeshBasicMaterial({ map: windTex(), color: 0xdff2ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    g.add(m); winds.push({ m, op, spd });
  }
  const frost = new THREE.Mesh(flatGeo(), addMat(0x9fdcff, 0, K.vfx.iceTex)); frost.position.y = 0.07; frost.scale.setScalar(N.r * 2.3); g.add(frost);
  // Lâminas de gelo girando em volta (cortam quem chegar perto).
  const blades = [], bGeo = new THREE.ConeGeometry(0.16, 1.4, 4).rotateZ(Math.PI / 2);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(bGeo, new THREE.MeshStandardMaterial({ color: 0xdff6ff, emissive: 0x3a9fff, emissiveIntensity: 0.8, transparent: true, opacity: 0, flatShading: true }));
    g.add(m); blades.push({ m, a: (i / 8) * 6.28, r: N.r * (i % 2 ? 0.62 : 0.88), h: 0.9 + (i % 3) * 0.35 });
  }
  audio.play('iceWave', p.position.x, p.position.z, { v: 1.3 }); audio.play('spin', p.position.x, p.position.z, { v: 0.9 });
  let T = 0, whooshT = 1.2;
  K.vfx.add(g, N.dur + 0.05, (o, k, dt) => {
    T += dt;
    const on = Math.min(1, T / 0.4) * Math.min(1, (N.dur - T) / 0.5);
    o.position.set(p.position.x, 0, p.position.z);
    for (let i = 0; i < n; i++) { const s = st[i]; s.a += s.sp / Math.max(1, s.r) * dt * 2.2; pos[i * 3] = Math.cos(s.a) * s.r; pos[i * 3 + 1] = s.h + Math.sin(T * 3 + s.ph) * 0.3; pos[i * 3 + 2] = Math.sin(s.a) * s.r; }
    geo.attributes.position.needsUpdate = true;
    pts.material.opacity = 0.95 * on;
    for (const w of winds) { w.m.rotation.y += dt * w.spd; w.m.material.opacity = w.op * on; }
    frost.material.opacity = 0.45 * on; frost.rotation.y -= dt;
    for (const b of blades) { b.a += dt * 5; b.m.position.set(Math.cos(b.a) * b.r, b.h, Math.sin(b.a) * b.r); b.m.rotation.y = -b.a; b.m.material.opacity = on; }
    whooshT -= dt; if (whooshT <= 0) { whooshT = 1.3; audio.play('spin', p.position.x, p.position.z, { v: 0.5 }); }
  });
  K.effect({ dur: N.dur, tick: N.tick, onTick: () => {
    for (const e of foesIn(K, p.position.x, p.position.z, N.r)) {
      K.hurt(e, N.tickDmg, 0, 0, 'dmg', p, true);
      if (Math.random() < 0.35) K.vfx.sparks(v3(e.position.x, 1.2, e.position.z), 0xdff6ff, 4);
      if (!(e.frozenT > 0)) { e.grimChill = (e.grimChill || 0) + N.tick; if (e.grimChill >= N.chill && e.alive && e.freeze) { e.grimChill = 0; e.freeze(e.data.boss ? N.freeze * 0.4 : N.freeze, K.c); } }
    }
  }, onFrame: (dt) => {
    const x = p.position.x, z = p.position.z;
    K.glow(x, z, ICE, 14);
    for (const e of foesIn(K, x, z, N.r)) { // o vento arrasta em volta dela
      if (e.data.boss || e.frozenT > 0 || e.state === 'lanceFly') continue;
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      e.position.x += (-dz / d) * N.swirl * dt; e.position.z += (dx / d) * N.swirl * dt;
      if (K.c.world) K.c.world.resolveCircle(e.position, e.data.radius);
    }
  } });
}

// ---------- 12) Floresta de Lanças ----------
let SPEAR = null;
function spearForest(K, p) {
  const S = G.spears, { a } = aimDir(K, p, 4), x0 = p.position.x, z0 = p.position.z, B = K.bounds();
  if (!SPEAR) SPEAR = new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0);
  const hit = new Set();
  audio.play('iceWave', x0, z0, { v: 1.2 }); K.shake(p, 0.4); K.glow(x0, z0, ICE, 50);
  const spear = (x, z, ang, i) => {
    const h = rnd(2.1, 3.3) * (1 + i * 0.05), r = rnd(0.24, 0.36), lean = rnd(0.12, 0.38);
    const m = new THREE.Mesh(SPEAR, new THREE.MeshStandardMaterial({ color: 0xcff4ff, emissive: 0x3a9fff, emissiveIntensity: 0.65, transparent: true, opacity: 0.92, roughness: 0.08, metalness: 0.2, flatShading: true }));
    const gl = new THREE.Mesh(SPEAR, addMat(ICE, 0.35));
    for (const o of [m, gl]) { o.position.set(x, 0, z); o.rotation.set(Math.cos(ang) * lean, rnd(0, 6.28), -Math.sin(ang) * lean); }
    const life = S.stay + 0.35;
    let broke = false;
    K.vfx.add(m, life, (o, k) => {
      const T = k * life, up = Math.min(1, T / 0.12), sink = T > S.stay ? (T - S.stay) / 0.35 : 0;
      const sy = h * (1 - (1 - up) ** 3) * (1 - sink);
      o.scale.set(r, Math.max(0.01, sy), r); gl.scale.set(r * 1.35, Math.max(0.01, sy * 1.05), r * 1.35);
      o.material.opacity = 0.92 * (1 - sink); gl.material.opacity = 0.35 * (1 - sink) * (1 - k * 0.5);
      if (sink > 0 && !broke) { broke = true; K.vfx.sparks(v3(x, 0.8, z), 0xdff6ff, 4); }
    });
    K.vfx.add(gl, life, () => {});
    K.fx.crack(x, z, 0.9, 3, ICE);
    floorGlow(K, x, z, 1.0, ICE, S.stay, 0.45, K.vfx.iceTex);
    if (Math.random() < 0.4) K.vfx.sparks(v3(x, 0.6, z), 0xdff6ff, 4);
    for (const e of foesIn(K, x, z, S.r)) { // empalado e congelado
      if (hit.has(e)) continue; hit.add(e);
      K.hurt(e, S.dmg, Math.sin(ang), Math.cos(ang), 'dmg big', p);
      if (e.alive && e.freeze) e.freeze(e.data.boss ? S.freeze * 0.4 : S.freeze, K.c);
      K.fx.flare(v3(e.position.x, 1.2, e.position.z), 2.6, ICE, 0.25);
    }
  };
  for (let i = 0; i < S.rows; i++) {
    const d = S.first + i * S.step, m = Math.max(2, Math.round((2 * S.half * d) / S.gap));
    K.later(i * S.delay, () => { audio.play('spikes', x0 + Math.sin(a) * d, z0 + Math.cos(a) * d, { v: 0.7 }); if (i % 2) K.shake(p, 0.2); });
    for (let j = 0; j < m; j++) {
      const ang = a - S.half + ((j + 0.5) / m) * 2 * S.half + rnd(-0.05, 0.05), dd = d + rnd(-0.35, 0.35);
      const x = x0 + Math.sin(ang) * dd, z = z0 + Math.cos(ang) * dd;
      if (Math.abs(x) > B.x - 0.5 || Math.abs(z) > B.z - 0.5 || (K.c.world && K.c.world.blocked(x, z, 0.3))) continue;
      K.later(i * S.delay + rnd(0, 0.03), () => spear(x, z, ang, i));
    }
  }
}

// ---------- 14) Tempestade ----------
function storm(K, p) {
  const S = G.storm, B = K.bounds();
  K.ui.tint('rgba(3,8,30,0.95)', 0.85, S.dur + 0.3, 'rgba(5,12,40,0.42)');
  audio.play('thunder', p.position.x, p.position.z, { v: 1.5 });
  K.ui.flash(p, true);
  // Nuvens escuras rodando no alto da sala.
  for (let i = 0; i < 16; i++) {
    const c = K.vfx.sprite(K.vfx.dustTex, false); c.material.color.setHex(i % 3 ? 0x1c2030 : 0x2a3048);
    const cx = rnd(-B.x, B.x), cz = rnd(-B.z - 3, B.z), cy = rnd(5.5, 7.5), sc = rnd(6, 10), drift = rnd(-1, 1), rot = rnd(-0.3, 0.3);
    K.vfx.add(c, S.dur + 0.5, (o, k, dt) => { o.position.set(cx + drift * k * 4, cy, cz); o.scale.setScalar(sc * (0.8 + 0.2 * k)); o.material.rotation += rot * dt; o.material.opacity = 0.4 * Math.min(1, k * 8) * (k > 0.85 ? (1 - k) / 0.15 : 1); });
  }
  // Chuva caindo.
  const rain = new THREE.Group(), drops = [];
  for (let i = 0; i < 170; i++) { const d = sprite(K, 0xb8ccff); d.scale.set(0.06, 1.5, 1); d.position.set(rnd(-B.x, B.x), rnd(0, 10), rnd(-B.z, B.z)); rain.add(d); drops.push(d); }
  K.vfx.add(rain, S.dur + 0.3, (o, k, dt) => { for (const d of drops) { d.position.y -= 22 * dt; if (d.position.y < 0) { d.position.y += 10; if (Math.random() < 0.1) K.vfx.sparks(v3(d.position.x, 0.1, d.position.z), 0x9fb8ff, 1); } d.material.opacity = 0.7 * Math.min(1, k * 8) * (k > 0.9 ? (1 - k) / 0.1 : 1); } });
  let n = 0;
  const strike = (x, z, big) => {
    const r = big ? S.bigR : S.r;
    K.vfx.lightning(v3(x + rnd(-2.5, 2.5), 16, z + rnd(-2.5, 2.5)), v3(x, 0.2, z), big ? 0xffffff : BOLT, big ? 0.7 : 0.38);
    if (big) K.vfx.lightning(v3(x + rnd(-3, 3), 16, z + rnd(-3, 3)), v3(x, 0.2, z), BOLT, 0.4);
    K.fx.shock(x, z, r * 1.3, BOLT, 0.35); K.fx.crack(x, z, r * 0.6, 3, BOLT);
    K.fx.flare(v3(x, 1, z), big ? 7 : 3.5, 0xdff2ff, 0.25);
    K.vfx.sparks(v3(x, 0.5, z), BOLT, big ? 14 : 6);
    K.glow(x, z, 0xbfe6ff, big ? 70 : 35);
    audio.play('zap', x, z, { v: big ? 1 : 0.55 });
    if (big) { audio.play('thunder', x, z, { v: 1.1 }); K.shake(p, 0.5); K.ui.flash(p, true); K.fx.rocks(x, z, 8, 1); K.fx.pillar(x, z, 10, 1.6, BOLT, 0.4); }
    for (const e of foesIn(K, x, z, r)) {
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      K.hurt(e, S.dmg * (big ? S.big : 1), dx / d, dz / d, big ? 'dmg big' : 'dmg', p);
    }
  };
  K.effect({ dur: S.dur, tick: S.every, onTick: () => {
    n++;
    const big = n % S.bigEvery === 0, foes = K.foes();
    if (foes.length && (big || Math.random() < 0.75)) {
      const e = big ? foes.reduce((a, b) => (b.hp > a.hp ? b : a)) : foes[Math.floor(Math.random() * foes.length)];
      strike(e.position.x + rnd(-0.4, 0.4), e.position.z + rnd(-0.4, 0.4), big);
    } else {
      for (let t = 0; t < 10; t++) { const x = rnd(-B.x + 1, B.x - 1), z = rnd(-B.z + 1, B.z - 1); if (K.c.world && K.c.world.blocked(x, z, 0.3)) continue; strike(x, z, big); break; }
    }
  } });
}

// ---------- 15) Raio Sem Fim ----------
function endlessBolt(K, p) {
  const R = G.chain, hits = new Map();
  let from = handsPoint(p), cur = null, n = 0, done = false;
  audio.play('charge', p.position.x, p.position.z, { v: 0.8 }); audio.play('zap', p.position.x, p.position.z, { v: 1.2 });
  K.fx.flare(from.clone(), 3, BOLT, 0.3);
  K.effect({ dur: R.max * R.every + 1, tick: R.every, onTick: (ef) => {
    if (done) return;
    const foes = K.foes(), d2 = (e) => Math.hypot(e.position.x - from.x, e.position.z - from.z);
    const opts = foes.filter((e) => e !== cur && d2(e) <= R.range);
    let next = opts.length ? opts.reduce((a, b) => ((hits.get(b) || 0) * 100 + d2(b) < (hits.get(a) || 0) * 100 + d2(a) ? b : a)) : null;
    if (!next && cur && cur.targetable) next = cur; // sobrou um só: o raio volta do céu nele
    if (!next || n >= R.max) {
      done = true; ef.dur = ef.t;
      K.fx.shock(from.x, from.z, 3, BOLT, 0.4); K.fx.flare(from.clone(), 4, 0xffffff, 0.3);
      if (n >= 8) K.text(`${n} saltos!`, v3(from.x, 0, from.z), 'crit', 3.6);
      return;
    }
    const to = v3(next.position.x, 1.2, next.position.z);
    const src = next === cur ? v3(to.x + rnd(-2, 2), 15, to.z + rnd(-2, 2)) : from;
    K.vfx.lightning(src, to, BOLT, 0.5); K.vfx.lightning(src, to, 0xffffff, 0.2); K.vfx.beamLine(src, to, BOLT, 0.55);
    K.fx.flare(to.clone(), 2.4, 0xdff2ff, 0.2); K.fx.shock(to.x, to.z, 2, BOLT, 0.25);
    K.glow(to.x, to.z, 0xbfe6ff, 30);
    n++; hits.set(next, (hits.get(next) || 0) + 1);
    const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, dz) || 0.01;
    K.hurt(next, R.dmg + R.grow * (n - 1), dx / d, dz / d, n % 5 === 0 ? 'dmg big' : 'dmg', p);
    if (n % 5 === 0) K.text(`Raio x${n}!`, next.position, 'crit', 3.2);
    audio.play('zap', to.x, to.z, { v: 0.6 });
    if (n % 7 === 0) audio.play('thunder', to.x, to.z, { v: 0.6 });
    from = to; cur = next;
  } });
}

export const SPELLS3 = [
  { id: 'nevasca', name: 'Nevasca', color: ICE, cast: blizzard },
  { id: 'lancas', name: 'Floresta de Lanças', color: ICE, cast: spearForest },
  { id: 'tempestade', name: 'Tempestade', color: BOLT, cast: storm },
  { id: 'raio', name: 'Raio Sem Fim', color: BOLT, cast: endlessBolt },
];
