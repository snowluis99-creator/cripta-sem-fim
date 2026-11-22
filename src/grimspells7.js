// Grimório Ancestral, lote 4 (22/11/2026), parte 2: Raízes Ancestrais, Tsunami, Névoa Venenosa, Enxame e Golem
// Ancestral. Mesmo formato do lote 1 (grimspells.js): { id, name, color, cast(K, p) }. Números em l1bless.js (L1.grim).
import * as THREE from 'three';
import { audio } from './audio.js';
import { grimTex, handsPoint, VIOLET, GOLD } from './grimlook.js';
import { GRIM as G, v3, rnd, addMat, flatGeo, floorGlow, grab, release } from './grimspells.js';
import { aimDir } from './grimspells2.js';

const WOOD = 0x5a3a1e, LEAF = 0x7dff6a, SEA = 0x2f8fff, FOAM = 0xe8f8ff, POISON = 0x8aff3a, BAT = 0xb46bff, STONE = 0xb8ae9e, RUNE = 0x7fe8ff;
const foesIn = (K, x, z, r) => K.foes().filter((e) => Math.hypot(e.position.x - x, e.position.z - z) <= r + e.data.radius);
const sprite = (K, color, tex = null, add = true) => { const s = K.vfx.sprite(tex || K.vfx.sparkTex, add); s.material.color.setHex(color); return s; };
const living = (K) => K.c.enemies.filter((e) => e.alive && !e.undead && !e.data.phantom);

// ---------- 34) Raízes Ancestrais ----------
// Montinhos de terra correm da Maga até cada inimigo; raízes grossas brotam e se enrolam nele, apertando.
const barkMat = () => new THREE.MeshStandardMaterial({ color: WOOD, emissive: 0x1a3a08, emissiveIntensity: 0.35, roughness: 1, flatShading: true });
function coilGeo(r, h, turns, thick) {
  const pts = [];
  for (let i = 0; i <= 60; i++) { const k = i / 60, a = k * turns * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r * (1 - 0.25 * k), k * h, Math.sin(a) * r * (1 - 0.25 * k))); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, thick, 6, false);
}
function rootsGrab(K, p) {
  const R = G.roots, foes = living(K), x0 = p.position.x, z0 = p.position.z;
  audio.play('rise', x0, z0, { v: 1.1 }); audio.play('creak', x0, z0, { v: 1 });
  K.fx.crack(x0, z0, 2.5, 3, LEAF);
  if (!foes.length) { for (let i = 0; i < 6; i++) { const a = rnd(0, 6.28); K.fx.rocks(x0 + Math.cos(a) * 3, z0 + Math.sin(a) * 3, 3, 0.6); } return; }
  const mat = barkMat();
  for (const e of foes) {
    const tx = e.position.x, tz = e.position.z, d = Math.hypot(tx - x0, tz - z0), steps = Math.max(2, Math.round(d / 1.2));
    for (let i = 1; i <= steps; i++) { // terra levantando no caminho
      const k = i / steps, x = x0 + (tx - x0) * k, z = z0 + (tz - z0) * k;
      K.later(R.grow * k, () => { K.fx.rocks(x, z, 2, 0.5); K.vfx.dust(v3(x, 0.1, z), v3(0, 0.6, 0), 2); });
    }
    K.later(R.grow, () => coil(K, p, e, mat));
  }
}
function coil(K, p, e, mat) {
  const R = G.roots;
  if (!e.alive) return;
  const boss = !!e.data.boss, sc = boss ? 1.6 : 1, x = e.position.x, z = e.position.z, rr = (e.data.radius + 0.25) * sc;
  const g = new THREE.Group(); g.position.set(x, 0, z); K.scene.add(g);
  const roots = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(coilGeo(rr + i * 0.08, (2.2 + i * 0.3) * sc, 1.6 + i * 0.3, (0.16 - i * 0.03) * sc), mat);
    m.rotation.y = (i / 3) * Math.PI * 2; m.geometry.setDrawRange(0, 0); g.add(m); roots.push(m);
  }
  for (let i = 0; i < 4; i++) { // folhinhas brilhando nas raízes
    const s = sprite(K, LEAF); const a = rnd(0, 6.28), h = rnd(0.5, 2) * sc; s.position.set(Math.cos(a) * rr, h, Math.sin(a) * rr); s.scale.setScalar(0.35); g.add(s);
  }
  K.fx.rocks(x, z, 8, 0.9); K.fx.crack(x, z, rr + 1, 3, LEAF); K.vfx.dust(v3(x, 0.1, z), v3(0, 1, 0), 6);
  audio.play('grab', x, z, { v: 0.7 }); audio.play('creak', x, z, { v: 0.6 });
  const held = !boss && grab(e);
  if (held) e.grimSpin = { roots: true }; else if (e.daze) e.daze(R.hold);
  K.text('Preso!', e.position, 'block', 3);
  const per = Math.round((boss ? R.boss : R.dmg) / R.squeezes);
  let sq = 0, gone = false;
  const cleanup = () => { if (!gone) { gone = true; K.scene.remove(g); } };
  const free = () => { if (held && e.alive && e.state === 'lanceFly' && e.grimSpin && e.grimSpin.roots) { e.grimSpin = null; release(K, e, 0, 0, 0, 0, p); } };
  K.effect({ dur: R.hold + 0.4, onFrame: (dt, ef) => {
    const t = ef.t, k = Math.min(1, t / 0.35);
    for (const m of roots) m.geometry.setDrawRange(0, Math.floor(m.geometry.index.count * k / 6) * 6);
    const pulse = 1 - 0.12 * Math.max(0, Math.sin(t * Math.PI * R.squeezes / R.hold * 2));
    g.scale.set(pulse, 1, pulse);
    if (t > R.hold) { const f = (t - R.hold) / 0.4; g.position.y = -2.5 * f * f; }
    if (held && e.alive && e.state === 'lanceFly' && e.grimSpin && e.grimSpin.roots) { e.position.set(x + Math.sin(t * 45) * 0.04, 0.15 * k, z); if (e.model) e.model.rotation.z = Math.sin(t * 9) * 0.08; }
    const n = Math.min(R.squeezes, Math.floor((t - 0.35) / ((R.hold - 0.35) / R.squeezes)) + 1);
    if (t > 0.35 && n > sq) { // aperta
      sq = n;
      const last = sq >= R.squeezes;
      audio.play('crunch', x, z, { v: 0.5 + 0.15 * sq }); K.vfx.sparks(v3(x, 1.2, z), LEAF, 6);
      if (held && e.alive && e.state === 'lanceFly') { if (last) { e.grimSpin = null; release(K, e, 0, 0, 0, R.dmg, p); } else K.text('Crack!', e.position, 'bleed', 2.5); } // preso: o dano sai todo no último aperto
      else if (e.alive) K.hurt(e, per, 0, 1, 'dmg', p, true);
      if (last) { K.fx.shock(x, z, rr + 1.5, LEAF, 0.3); K.text('Esmagado!', v3(x, 0, z), 'crit', 3); }
    }
  }, onEnd: () => { free(); cleanup(); }, onClear: () => { free(); cleanup(); } });
}

// ---------- 36) Tsunami ----------
// Uma onda gigante nasce na parede atrás da Maga e varre a sala até a parede da frente, levando os inimigos junto
// e esmagando todos contra a parede. Passa por cima da Maga sem machucar.
let WAVETEX = null;
function waveTex() { // água: listras de espuma por cima, azul escuro embaixo
  if (WAVETEX) return WAVETEX;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(240,252,255,1)'); gr.addColorStop(0.12, 'rgba(150,215,255,0.95)'); gr.addColorStop(0.45, 'rgba(40,140,230,0.85)'); gr.addColorStop(1, 'rgba(10,50,120,0.75)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.35})`; g.fillRect(Math.random() * 64, Math.random() * 256, 2 + Math.random() * 8, 1 + Math.random() * 3); }
  WAVETEX = new THREE.CanvasTexture(c); WAVETEX.colorSpace = THREE.SRGBColorSpace; WAVETEX.wrapS = THREE.RepeatWrapping;
  return WAVETEX;
}
function makeWave(span, h) {
  // Perfil da crista (curvada para a frente, +z local) varrido ao longo de x.
  const prof = [];
  for (let i = 0; i <= 14; i++) { const k = i / 14, a = k * Math.PI * 1.15; prof.push([Math.sin(a) * h * 0.38 - (1 - k) * h * 0.25, h * (k < 0.8 ? k / 0.8 : 1) * (0.55 + 0.45 * Math.sin(Math.min(1, k) * Math.PI / 2))]); }
  const cols = 24, pos = [], uv = [], idx = [];
  for (let c = 0; c <= cols; c++) for (let r = 0; r < prof.length; r++) {
    const x = (c / cols - 0.5) * span, wob = Math.sin(c * 1.3) * 0.25;
    pos.push(x, prof[r][1] + wob * (r / prof.length), prof[r][0]); uv.push(c / cols * span / 4, 1 - r / (prof.length - 1));
  }
  const R = prof.length;
  for (let c = 0; c < cols; c++) for (let r = 0; r < R - 1; r++) { const a = c * R + r, b = (c + 1) * R + r; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: waveTex(), color: 0xffffff, emissive: 0x0a3a80, emissiveIntensity: 0.6, transparent: true, opacity: 0.88, roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  const g = new THREE.Group(); g.add(m);
  return { g, m, mat };
}
function tsunami(K, p) {
  const T = G.wave, B = K.bounds(), { a } = aimDir(K, p, 4);
  // A onda corre num dos 4 sentidos da sala (o mais perto da mira), para cobrir a sala de parede a parede.
  const ax = Math.abs(Math.sin(a)) > Math.abs(Math.cos(a)), sg = ax ? Math.sign(Math.sin(a)) || 1 : Math.sign(Math.cos(a)) || 1;
  const lim = (ax ? B.x : B.z) - 0.8, span = 2 * (ax ? B.z : B.x) + 2;
  const dx = ax ? sg : 0, dz = ax ? 0 : sg;
  const from = -sg * (lim + 1), to = sg * lim;
  const w = makeWave(span, T.h);
  w.g.rotation.y = Math.atan2(dx, dz);
  K.scene.add(w.g);
  audio.play('iceWave', p.position.x, p.position.z, { v: 1.3 }); audio.play('noise', p.position.x, p.position.z, { v: 0.8 });
  K.text('TSUNAMI!', p.position, 'crit', 3.4); K.ui.tint('rgba(0,40,90,0.9)', 0.4, 99);
  const carried = new Map();
  let gone = false, splashT = 0, front = from;
  const dur = Math.abs(to - from) / T.speed;
  const cleanup = () => { if (gone) return; gone = true; K.scene.remove(w.g); w.mat.dispose(); w.m.geometry.dispose(); K.ui.tintOff(); };
  const along = (e) => (ax ? e.position.x : e.position.z);
  K.effect({ dur: dur + 0.6, onFrame: (dt, ef) => {
    const t = ef.t, k = Math.min(1, t / dur);
    front = from + (to - from) * k;
    const grow = Math.min(1, t / 0.3), sink = t > dur ? Math.max(0.01, 1 - (t - dur) / 0.6) : 1;
    w.g.position.set(ax ? front : 0, 0, ax ? 0 : front); w.g.scale.set(1, grow * sink, 1);
    w.mat.map.offset.x += dt * 0.5; w.mat.opacity = 0.88 * Math.min(1, sink * 1.4);
    if (Math.random() < 0.6) K.shake(p, 0.2);
    splashT -= dt;
    if (splashT <= 0 && t < dur) { // espuma e respingos na crista
      splashT = 0.05;
      for (let i = 0; i < 3; i++) {
        const s = sprite(K, i ? FOAM : SEA, i ? K.vfx.dustTex : null, true), q = rnd(-span / 2, span / 2), hx = ax ? front + sg * 0.6 : q, hz = ax ? q : front + sg * 0.6, hy = T.h * rnd(0.7, 1.05), sc = rnd(0.5, 1.2);
        K.vfx.add(s, 0.5, (o, kk) => { o.position.set(hx + dx * kk * 1.5, hy + kk * 0.8 - kk * kk * 2, hz + dz * kk * 1.5); o.scale.setScalar(sc * (1 + kk)); o.material.opacity = 0.8 * (1 - kk); });
      }
      K.glow(ax ? front : p.position.x, ax ? p.position.z : front, SEA, 15);
    }
    if (t >= dur) return;
    for (const e of living(K)) { // quem a crista alcança é levado junto
      if (carried.has(e) || !e.alive) continue;
      if ((along(e) - front) * sg > 0.6) continue;
      if (e.data.boss) { carried.set(e, { boss: true }); K.hurt(e, Math.round(T.boss / 2), dx, dz, 'dmg big', p); e.daze && e.daze(1); continue; }
      if (!grab(e)) continue;
      e.grimSpin = { wave: true };
      carried.set(e, { q: ax ? e.position.z : e.position.x, off: rnd(0.3, 1.2), h: rnd(0.8, 2.2), spin: rnd(4, 9) });
      audio.play('hit', e.position.x, e.position.z, { v: 0.5 });
    }
    for (const [e, c] of carried) {
      if (c.boss) { if (e.alive && (along(e) - front) * sg < 0.8) { e.position.x += dx * T.speed * 0.25 * dt; e.position.z += dz * T.speed * 0.25 * dt; if (K.c.world) K.c.world.resolveCircle(e.position, e.data.radius); } continue; }
      if (!e.alive || e.state !== 'lanceFly' || !e.grimSpin || !e.grimSpin.wave) continue;
      const pos = front - sg * c.off;
      if (ax) e.position.set(pos, c.h + Math.sin(t * 6 + c.off) * 0.3, c.q); else e.position.set(c.q, c.h + Math.sin(t * 6 + c.off) * 0.3, pos);
      e.group.rotation.y += dt * c.spin; if (e.model) e.model.rotation.x = Math.sin(t * 5 + c.off) * 1.2;
    }
  }, onEnd: () => {
    cleanup();
    K.shake(p, 1); K.ui.flash(p, true); audio.play('boom', p.position.x, p.position.z, { v: 1 }); audio.play('headThud', p.position.x, p.position.z, { v: 1 });
    for (const [e, c] of carried) { // esmagados na parede
      if (!e.alive) continue;
      if (c.boss) { K.hurt(e, Math.round(T.boss / 2), dx, dz, 'dmg big', p); continue; }
      if (e.state !== 'lanceFly' || !e.grimSpin || !e.grimSpin.wave) continue;
      const x = e.position.x, z = e.position.z;
      K.fx.shock(x, z, 2.2, SEA, 0.35); K.vfx.sparks(v3(x, 1, z), FOAM, 8); K.fx.rocks(x, z, 4, 0.7);
      e.grimSpin = null; release(K, e, -dx, -dz, 4, T.dmg, p);
    }
    floorGlow(K, ax ? to : 0, ax ? 0 : to, 4, SEA, 1.5, 0.35);
    K.log({ type: 'grimWave', n: carried.size });
  }, onClear: () => { for (const [e, c] of carried) if (!c.boss && e.alive && e.state === 'lanceFly') { e.grimSpin = null; release(K, e, 0, 0, 0, 0, p); } cleanup(); } });
}

// ---------- 37) Névoa Venenosa ----------
function poisonFog(K, p) {
  const F = G.fog, B = K.bounds(), x0 = p.position.x, z0 = p.position.z;
  audio.play('noise', x0, z0, { v: 0.7 }); audio.play('summon', x0, z0, { v: 0.6 });
  K.ui.tint('rgba(40,90,0,0.85)', 0.45, 99, 'rgba(60,120,0,0.15)');
  K.text('Névoa venenosa!', p.position, 'crit', 3.2);
  // Nuvem verde: sai das mãos e toma a sala inteira, baixinha, rolando devagar.
  const hp = handsPoint(p);
  for (let i = 0; i < 70; i++) {
    const s = sprite(K, i % 4 ? 0x5aa020 : POISON, K.vfx.dustTex, i % 4 === 0), tx = rnd(-B.x, B.x), tz = rnd(-B.z, B.z), sc = rnd(2.5, 5), d = rnd(0, 0.6), ph = rnd(0, 6.28);
    s.material.opacity = 0;
    K.vfx.add(s, F.dur + 0.8, (o, k) => {
      const T = k * (F.dur + 0.8), spread = Math.min(1, Math.max(0, (T - d) / F.rise));
      o.position.set(hp.x + (tx - hp.x) * spread + Math.sin(T * 0.6 + ph) * 0.8, 0.5 + 0.6 * Math.sin(T + ph) * 0.3 + (1 - spread), hp.z + (tz - hp.z) * spread + Math.cos(T * 0.5 + ph) * 0.8);
      o.scale.setScalar(sc * (0.3 + 0.7 * spread)); o.material.rotation += 0.004;
      o.material.opacity = (i % 4 ? 0.55 : 0.3) * Math.min(1, spread * 2) * (k > 0.88 ? (1 - k) / 0.12 : 1);
    });
  }
  let n = 0;
  K.effect({ dur: F.dur, tick: F.tick, onTick: () => {
    n++;
    for (const e of K.foes()) {
      K.hurt(e, F.dmg, 0, 1, 'burn', p, true);
      for (let j = 0; j < 2; j++) { // bolhas verdes subindo
        const b = sprite(K, POISON), bx = e.position.x + rnd(-0.4, 0.4), bz = e.position.z + rnd(-0.4, 0.4), by = rnd(1, 2), sc = rnd(0.15, 0.3);
        K.vfx.add(b, 0.7, (o, k) => { o.position.set(bx, by + k * 1.2, bz); o.scale.setScalar(sc * (1 + k)); o.material.opacity = 0.9 * (1 - k); });
      }
      if (n % 4 === 1 && !e.data.boss && Math.random() < 0.5 && e.daze) { e.daze(0.4); K.text('*cof*', e.position, 'block', 2.5); } // tosse
    }
    if (n % 3 === 0) audio.play('noise', x0, z0, { v: 0.25 });
  }, onEnd: () => K.later(0.7, () => K.ui.tintOff()), onClear: () => K.ui.tintOff() });
}

// ---------- 38) Enxame ----------
// Morcegos arcanos saem do livro, cobrem os inimigos e vão mordendo; quem morre libera os morcegos para outro.
let BATGEO = null;
function makeBat(mat, eyeMat) {
  if (!BATGEO) {
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.1, 0.55, 0.05, 0.05, 0.45, 0, -0.25, 0, 0, -0.12, 0.55, 0.05, 0.05, 0.45, 0, -0.25], 3)); wing.computeVertexNormals();
    BATGEO = { body: new THREE.SphereGeometry(0.11, 6, 5).scale(1, 0.9, 1.4), wing, eye: new THREE.SphereGeometry(0.025, 4, 3) };
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(BATGEO.body, mat));
  const L = new THREE.Mesh(BATGEO.wing, mat), Rw = new THREE.Mesh(BATGEO.wing, mat); Rw.scale.x = -1;
  const lw = new THREE.Group(), rw = new THREE.Group(); lw.add(L); rw.add(Rw); g.add(lw); g.add(rw);
  for (const sx of [-0.04, 0.04]) { const e = new THREE.Mesh(BATGEO.eye, eyeMat); e.position.set(sx, 0.03, 0.13); g.add(e); }
  return { g, lw, rw };
}
function swarm(K, p) {
  const S = G.swarm, hp = handsPoint(p);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a0a2a, emissive: 0x5a1aa0, emissiveIntensity: 0.7, roughness: 0.6, side: THREE.DoubleSide, flatShading: true });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff5ad8 });
  audio.play('wingFlap', hp.x, hp.z, { v: 1.2 }); audio.play('summon', hp.x, hp.z, { v: 0.7 });
  const bats = [];
  for (let i = 0; i < S.n; i++) {
    const b = makeBat(mat, eyeMat);
    b.p = v3(hp.x + rnd(-0.3, 0.3), hp.y + rnd(-0.2, 0.3), hp.z + rnd(-0.3, 0.3)); b.v = v3(rnd(-4, 4), rnd(1, 4), rnd(-4, 4));
    b.ph = rnd(0, 6.28); b.r = rnd(0.5, 1.1); b.h = rnd(0.8, 2.2); b.sp = rnd(2.5, 4.5) * (Math.random() < 0.5 ? -1 : 1); b.target = null; b.g.scale.setScalar(rnd(0.9, 1.4));
    b.g.position.copy(b.p); K.scene.add(b.g); bats.push(b);
  }
  let gone = false, flapT = 0;
  const cleanup = () => { if (gone) return; gone = true; for (const b of bats) K.scene.remove(b.g); mat.dispose(); eyeMat.dispose(); };
  const assign = () => { // reparte os morcegos entre os inimigos vivos
    const foes = K.foes();
    bats.forEach((b, i) => { if (!b.target || !b.target.alive || !b.target.targetable) b.target = foes.length ? foes[i % foes.length] : null; });
  };
  assign();
  K.effect({ dur: S.dur + 0.8, tick: S.tick, onTick: (ef) => {
    if (ef.t > S.dur) return;
    assign();
    const on = new Map();
    for (const b of bats) if (b.target && b.p.distanceTo(v3(b.target.position.x, b.p.y, b.target.position.z)) < 1.8) on.set(b.target, (on.get(b.target) || 0) + 1);
    for (const [e, n] of on) { K.hurt(e, Math.max(1, Math.round(S.bite * n)), 0, 1, 'bleed', p, true); if (Math.random() < 0.4) K.vfx.sparks(v3(e.position.x, 1.4, e.position.z), BAT, 3); }
  }, onFrame: (dt, ef) => {
    const back = ef.t > S.dur, home = handsPoint(p);
    flapT -= dt; if (flapT <= 0) { flapT = 0.45; audio.play('wingFlap', p.position.x, p.position.z, { v: 0.35 }); }
    for (const b of bats) {
      let tx, ty, tz;
      if (back) { tx = home.x; ty = home.y; tz = home.z; }
      else if (b.target) { const a = b.ph + ef.t * b.sp; tx = b.target.position.x + Math.cos(a) * b.r; tz = b.target.position.z + Math.sin(a) * b.r; ty = b.h + Math.sin(ef.t * 5 + b.ph) * 0.3; }
      else { const a = b.ph + ef.t * b.sp; tx = p.position.x + Math.cos(a) * 3; tz = p.position.z + Math.sin(a) * 3; ty = 2.5; }
      const f = back ? 9 : 7;
      b.v.x += ((tx - b.p.x) * f - b.v.x * 2.2) * dt; b.v.y += ((ty - b.p.y) * f - b.v.y * 2.2) * dt; b.v.z += ((tz - b.p.z) * f - b.v.z * 2.2) * dt;
      b.p.addScaledVector(b.v, dt);
      b.g.position.copy(b.p); b.g.rotation.y = Math.atan2(b.v.x, b.v.z);
      const fl = Math.sin(ef.t * 28 + b.ph) * 0.9; b.lw.rotation.z = fl; b.rw.rotation.z = -fl;
      if (back) { const d = b.p.distanceTo(home); b.g.scale.setScalar(Math.min(1.2, d / 2)); }
    }
  }, onEnd: cleanup, onClear: cleanup });
  K.log({ type: 'grimSwarm', n: bats.length });
}

// ---------- 39) Golem Ancestral ----------
// Golem de pedra com runas acesas: sobe do chão e luta pela Maga até o fim da sala (soco e, a cada 4, pancada no chão).
// Ninguém consegue machucar o golem; some quando a sala termina.
function makeGolem() {
  const stone = new THREE.MeshStandardMaterial({ color: STONE, emissive: 0x3a3226, emissiveIntensity: 0.6, roughness: 1, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x7a7068, emissive: 0x241e18, emissiveIntensity: 0.6, roughness: 1, flatShading: true });
  const rune = new THREE.MeshBasicMaterial({ color: RUNE });
  const box = (w, h, d, m = stone) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const rock = (r, m = stone) => new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), m);
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const hips = new THREE.Group(); hips.position.y = 1.5; body.add(hips);
  const torso = box(2.1, 1.6, 1.3); torso.position.y = 1.0; torso.rotation.x = 0.12; hips.add(torso);
  const chestRune = box(0.6, 0.6, 0.06, rune); chestRune.position.set(0, 1.1, 0.67); chestRune.rotation.z = Math.PI / 4; hips.add(chestRune);
  const chestGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: grimTex().circle, color: RUNE, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 })); chestGlow.position.set(0, 1.1, 0.75); chestGlow.scale.setScalar(1.3); hips.add(chestGlow);
  const back = rock(0.7, dark); back.position.set(0.3, 1.7, -0.4); hips.add(back);
  const head = new THREE.Group(); head.position.set(0, 2.0, 0.25); hips.add(head);
  const skull = box(0.75, 0.6, 0.7); head.add(skull);
  for (const sx of [-0.18, 0.18]) { const e = box(0.2, 0.11, 0.06, rune); e.position.set(sx, 0.05, 0.36); head.add(e); }
  const arm = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * 1.3, 1.5, 0); hips.add(sh);
    const pad = rock(0.55, dark); sh.add(pad);
    const up = box(0.6, 1.1, 0.6); up.position.y = -0.7; sh.add(up);
    const el = new THREE.Group(); el.position.y = -1.3; sh.add(el);
    const fore = box(0.7, 1.0, 0.7); fore.position.y = -0.45; el.add(fore);
    const fist = box(0.95, 0.8, 0.95, dark); fist.position.y = -1.1; el.add(fist);
    const r = box(0.06, 0.6, 0.05, rune); r.position.set(side * 0.36, -0.45, 0); el.add(r);
    return { sh, el };
  };
  const leg = (side) => {
    const l = new THREE.Group(); l.position.set(side * 0.55, 0, 0); hips.add(l);
    const th = box(0.75, 0.9, 0.75); th.position.y = -0.45; l.add(th);
    const ft = box(0.9, 0.55, 1.1, dark); ft.position.set(0, -1.2, 0.1); l.add(ft);
    return l;
  };
  const L = arm(1), R = arm(-1);
  return { g, body, hips, head, L, R, legL: leg(1), legR: leg(-1), runeMat: rune, mats: [stone, dark, rune] };
}
const golems = [];
function golem(K, p) {
  const O = G.golem, B = K.bounds();
  while (golems.length >= O.max) { const old = golems.shift(); old.crumble(); }
  let x = p.position.x + Math.sin(p.facing) * 2.5, z = p.position.z + Math.cos(p.facing) * 2.5;
  x = Math.max(-B.x + 1.5, Math.min(B.x - 1.5, x)); z = Math.max(-B.z + 1.5, Math.min(B.z - 1.5, z));
  if (K.c.world && K.c.world.blocked(x, z, 1)) { x = p.position.x; z = p.position.z; }
  const G0 = makeGolem(), pos = v3(x, 0, z);
  G0.g.position.set(x, -4, z); G0.g.scale.setScalar(O.scale); G0.g.rotation.y = p.facing; K.scene.add(G0.g);
  K.fx.crack(x, z, 3, 5, RUNE); K.fx.rocks(x, z, 14, 1.1); K.fx.smoke(v3(x, 0.3, z), 8, 1.6);
  K.shake(p, 0.8); audio.play('rexCrack', x, z, { v: 1.1 }); audio.play('mechRoar', x, z, { v: 0.6 });
  K.text('GOLEM ANCESTRAL!', p.position, 'crit', 3.6);
  const st = { pos, face: p.facing, t: 0, cd: 0.6, swing: 0, side: 1, n: 0, walk: 0, target: null, gone: false, hitDone: false };
  const self = {
    st,
    crumble() { // desmancha em pedras
      if (st.gone) return; st.gone = true;
      K.fx.rocks(st.pos.x, st.pos.z, 18, 1.2); K.fx.smoke(v3(st.pos.x, 1, st.pos.z), 10, 1.8); audio.play('crunch', st.pos.x, st.pos.z, { v: 0.8 });
      K.scene.remove(G0.g); for (const m of G0.mats) m.dispose();
      const i = golems.indexOf(self); if (i >= 0) golems.splice(i, 1);
      if (self.ef) self.ef.dur = 0;
    },
  };
  golems.push(self);
  const strike = (slam) => {
    const fx = Math.sin(st.face), fz = Math.cos(st.face), hx = st.pos.x + fx * O.reach * 0.8, hz = st.pos.z + fz * O.reach * 0.8;
    if (slam) {
      K.fx.impact(hx, hz, 0.8, RUNE); K.shake(p, 0.7); audio.play('mechSlam', hx, hz, { v: 1 });
      for (const e of foesIn(K, hx, hz, O.slamR)) { const dx = e.position.x - hx, dz = e.position.z - hz, d = Math.hypot(dx, dz) || 0.01; K.hurt(e, O.slam, dx / d, dz / d, 'dmg big', p); if (e.alive && e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(10); }
    } else {
      K.fx.flare(v3(hx, 1.4, hz), 2, RUNE, 0.15); K.fx.rocks(hx, hz, 3, 0.6); audio.play('hitHeavy', hx, hz, { v: 0.9 });
      for (const e of K.foes()) {
        const dx = e.position.x - st.pos.x, dz = e.position.z - st.pos.z, d = Math.hypot(dx, dz) || 0.01;
        if (d > O.reach + e.data.radius || (dx * fx + dz * fz) / d < 0.3) continue;
        K.hurt(e, O.punch, dx / d, dz / d, 'dmg big', p);
        K.vfx.sparks(v3(e.position.x, 1.3, e.position.z), RUNE, 8);
        if (e.alive && e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(9);
      }
    }
    K.log({ type: 'grimGolemHit', slam });
  };
  self.ef = K.effect({ dur: 1e9, onFrame: (dt, ef) => {
    if (st.gone) { ef.dur = 0; return; }
    st.t += dt;
    const k = Math.min(1, st.t / O.rise);
    if (k < 1) { // subindo do chão
      G0.g.position.set(st.pos.x + Math.sin(st.t * 40) * 0.05, -4 * (1 - k) ** 2, st.pos.z);
      G0.hips.rotation.x = 0.5 * (1 - k); G0.L.sh.rotation.x = -2.6 * (1 - k); G0.R.sh.rotation.x = -2.6 * (1 - k);
      if (Math.random() < 0.3) K.fx.rocks(st.pos.x, st.pos.z, 2, 0.7);
      if (k >= 0.999) { K.fx.shock(st.pos.x, st.pos.z, 4, RUNE, 0.4); audio.play('mechRoar', st.pos.x, st.pos.z, { v: 0.8 }); }
      return;
    }
    G0.runeMat.color.setHSL(0.52, 1, 0.55 + 0.15 * Math.sin(st.t * 4));
    // Alvo: inimigo mais perto; sem ninguém, fica atrás da Maga.
    const foes = K.foes();
    let tgt = null, bd = Infinity;
    for (const e of foes) { const d = Math.hypot(e.position.x - st.pos.x, e.position.z - st.pos.z) - e.data.radius; if (d < bd) { bd = d; tgt = e; } }
    let gx, gz, near;
    if (tgt) { gx = tgt.position.x; gz = tgt.position.z; near = bd <= O.reach * 0.85; }
    else { gx = p.position.x - Math.sin(p.facing) * 2.5; gz = p.position.z - Math.cos(p.facing) * 2.5; near = Math.hypot(gx - st.pos.x, gz - st.pos.z) < 1; }
    const want = Math.atan2(gx - st.pos.x, gz - st.pos.z);
    let da = Math.atan2(Math.sin(want - st.face), Math.cos(want - st.face));
    st.face += Math.max(-O.turn * dt, Math.min(O.turn * dt, da));
    st.cd -= dt;
    let moving = false;
    if (st.swing > 0) { // golpeando
      const D = st.slam ? 0.85 : 0.55, s = 1 - st.swing / D, arm = st.side > 0 ? G0.L : G0.R;
      if (st.slam) { const up = s < 0.55 ? s / 0.55 : 1 - (s - 0.55) / 0.45; G0.L.sh.rotation.x = G0.R.sh.rotation.x = -2.8 * up; G0.hips.rotation.x = s < 0.55 ? -0.25 * up : 0.45 * (1 - (s - 0.55) / 0.45); }
      else { const ext = s < 0.4 ? -0.6 * (s / 0.4) : s < 0.6 ? -0.6 + 2.2 * ((s - 0.4) / 0.2) : 1.6 * (1 - (s - 0.6) / 0.4); arm.sh.rotation.x = -ext; arm.el.rotation.x = -0.6 * Math.max(0, 1 - ext); G0.hips.rotation.y = st.side * 0.3 * Math.sin(s * Math.PI); }
      if (!st.hitDone && s >= (st.slam ? 0.62 : 0.5)) { st.hitDone = true; strike(st.slam); }
      st.swing -= dt;
      if (st.swing <= 0) { G0.hips.rotation.set(0, 0, 0); G0.L.sh.rotation.x = G0.R.sh.rotation.x = 0; G0.L.el.rotation.x = G0.R.el.rotation.x = 0; }
    } else if (tgt && near && Math.abs(da) < 0.5 && st.cd <= 0) {
      st.n++; st.slam = st.n % O.slamEvery === 0; st.side = -st.side; st.swing = st.slam ? 0.85 : 0.55; st.hitDone = false; st.cd = O.cd;
      audio.play(st.slam ? 'mechSwing' : 'swingHeavy', st.pos.x, st.pos.z, { v: 0.9 });
    } else if (!near) { // anda
      moving = true;
      const sp = O.speed * dt;
      st.pos.x += Math.sin(st.face) * sp; st.pos.z += Math.cos(st.face) * sp;
      if (K.c.world) K.c.world.resolveCircle(st.pos, 1.0);
      st.pos.x = Math.max(-B.x + 1, Math.min(B.x - 1, st.pos.x)); st.pos.z = Math.max(-B.z + 1, Math.min(B.z - 1, st.pos.z));
    }
    st.walk += moving ? dt * 7 : 0;
    const sw = moving ? Math.sin(st.walk) : 0;
    G0.legL.rotation.x = sw * 0.5; G0.legR.rotation.x = -sw * 0.5;
    if (st.swing <= 0) { G0.L.sh.rotation.x = -sw * 0.35; G0.R.sh.rotation.x = sw * 0.35; }
    G0.g.position.set(st.pos.x, moving ? Math.abs(Math.cos(st.walk)) * 0.12 : 0, st.pos.z); G0.g.rotation.y = st.face;
    if (moving && Math.abs(Math.cos(st.walk)) < 0.08 && !st.stepped) { st.stepped = true; K.shake(p, 0.12); audio.play('mechStep', st.pos.x, st.pos.z, { v: 0.4 }); K.vfx.dust(v3(st.pos.x, 0.1, st.pos.z), v3(0, 0.4, 0), 2); }
    else if (Math.abs(Math.cos(st.walk)) > 0.3) st.stepped = false;
  }, onClear: () => self.crumble() });
  K.log({ type: 'grimGolem' });
}
export const grimGolems = () => golems;

export const SPELLS7 = [
  { id: 'raizes', name: 'Raízes Ancestrais', color: LEAF, cast: rootsGrab },
  { id: 'tsunami', name: 'Tsunami', color: SEA, cast: tsunami },
  { id: 'nevoa', name: 'Névoa Venenosa', color: POISON, cast: poisonFog },
  { id: 'enxame', name: 'Enxame', color: BAT, cast: swarm },
  { id: 'golem', name: 'Golem Ancestral', color: RUNE, cast: golem },
];
