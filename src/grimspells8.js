// Grimório Ancestral, lote 5 (22/11/2026), parte 1 — as "absurdas": Miniatura, Marionetes, Conversão, Bomba-Relógio e
// Teto Desabando. Mesmo formato do lote 1 (grimspells.js): { id, name, color, cast(K, p) }. Números em l1bless.js
// (L1.grim). Marionetes usa os ganchos do Eclipse (grimkit.js: blindTarget/blindStrike; cego não acerta a Maga).
// Conversão usa o morto-vivo da Maga (undead.js: grimConvert = golpe fixo + visual dourado).
import * as THREE from 'three';
import { audio } from './audio.js';
import { setFlash } from './characters.js';
import { grimTex, handsPoint, GOLD } from './grimlook.js';
import { GRIM as G, v3, rnd, HOLY, flatGeo, floorGlow } from './grimspells.js';

const PINK = 0xff7ad8, STRING = 0xfff0b0, BOMB = 0xff5a2a, ROCK = 0x8a7a68;
const sprite = (K, color, tex = null, add = true) => { const s = K.vfx.sprite(tex || K.vfx.sparkTex, add); s.material.color.setHex(color); return s; };
const living = (K) => K.c.enemies.filter((e) => e.alive && !e.undead && !e.data.phantom);
const hurtAround = (K, x, z, r, dmg, p, skip = null, cls = 'dmg big') => {
  for (const e of K.foes()) {
    if (e === skip) continue;
    const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
    if (d <= r + e.data.radius) K.hurt(e, dmg, dx / d, dz / d, cls, p);
  }
};

// ---------- 40) Miniatura ----------
// Pó de estrelas cor-de-rosa cai em cada inimigo, que encolhe até virar um bonequinho de 1 de vida (e quase sem força).
// Chefe: encolhe um pouco por um tempo e perde uma parte da vida.
function miniature(K, p) {
  const list = living(K);
  audio.play('blessing', p.position.x, p.position.z, { v: 1.1 }); audio.play('spell', p.position.x, p.position.z, { v: 0.8 });
  K.ui.tint('rgba(255,120,220,0.6)', 0.25, 1.2, 'rgba(255,200,255,0)');
  if (!list.length) { for (let i = 0; i < 20; i++) K.vfx.sparks(v3(p.position.x + rnd(-4, 4), 1, p.position.z + rnd(-4, 4)), PINK, 3); return; }
  list.forEach((e, i) => K.later(0.08 * i, () => shrink(K, p, e)));
  K.log({ type: 'grimMini', n: list.length });
}
function shrink(K, p, e) {
  const M = G.mini;
  if (!e.alive || e.grimTiny) return;
  const boss = !!e.data.boss, s0 = e.group.scale.x || 1, to = s0 * (boss ? M.bossScale : M.scale), x = e.position.x, z = e.position.z;
  // Brilho caindo do alto + nuvenzinha de "puf".
  for (let i = 0; i < 14; i++) {
    const s = sprite(K, i % 3 ? PINK : 0xffffff), ox = rnd(-0.7, 0.7), oz = rnd(-0.7, 0.7), y0 = rnd(3, 5.5), sc = rnd(0.12, 0.3);
    K.vfx.add(s, M.shrink, (o, k) => { o.position.set(e.position.x + ox * (1 - k), y0 * (1 - k) + 0.4, e.position.z + oz * (1 - k)); o.scale.setScalar(sc * (1 + Math.sin(k * 20) * 0.3)); o.material.opacity = 1 - k * 0.6; });
  }
  floorGlow(K, x, z, 1.4, PINK, M.shrink + 0.4, 0.6, grimTex().circle);
  audio.play('select', x, z, { v: 0.8 });
  e.grimTiny = boss ? 'boss' : true;
  if (!boss) { e.noGrave = true; e.dmgScale = (e.dmgScale || 1) * M.dmgMul; e.damage = Math.max(1, Math.round(e.data.damage * e.dmgScale)); }
  let done = false;
  K.effect({ dur: M.shrink, onFrame: (dt, ef) => {
    if (!e.alive) return;
    const k = ef.t / M.shrink, kk = k * k * (3 - 2 * k), wob = 1 + Math.sin(k * 30) * 0.08 * (1 - k);
    e.group.scale.setScalar((s0 + (to - s0) * kk) * wob);
  }, onEnd: () => {
    if (done) return; done = true;
    if (!e.alive) return;
    e.group.scale.setScalar(to);
    K.fx.flare(v3(e.position.x, 0.6, e.position.z), 2.2, PINK, 0.25); K.vfx.sparks(v3(e.position.x, 0.5, e.position.z), PINK, 10);
    audio.play('zap', e.position.x, e.position.z, { v: 0.4 });
    if (boss) {
      K.hurt(e, Math.round(e.maxHp * M.boss), 0, 1, 'dmg big', p);
      K.text('Encolheu!', e.position, 'crit', 3);
      K.later(M.bossDur, () => { if (e.grimTiny === 'boss') { e.grimTiny = null; if (e.alive) { e.group.scale.setScalar(s0); K.vfx.sparks(v3(e.position.x, 1, e.position.z), PINK, 8); } } });
      return;
    }
    e.hp = Math.min(e.hp, 1);
    K.text('1', e.position, 'crit', 1.6); K.text('Bonequinho!', e.position, 'block', 2.2);
  } });
}

// ---------- 41) Marionetes ----------
// Uma cruzeta de luz aparece em cima de cada inimigo, com fios presos na cabeça e nas mãos: eles andam aos trancos e se
// atacam entre si por 6 s (mesma regra do Eclipse: nunca acertam a Maga; arqueiros atiram nos outros). Chefe: tonto.
let CROSS = null;
function makeControl() {
  if (!CROSS) CROSS = { bar: new THREE.BoxGeometry(1.5, 0.09, 0.09), bar2: new THREE.BoxGeometry(0.09, 0.09, 1.1), knob: new THREE.SphereGeometry(0.08, 6, 4) };
  const mat = new THREE.MeshStandardMaterial({ color: 0xc89a5a, emissive: 0xffc860, emissiveIntensity: 0.9, roughness: 0.6 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(CROSS.bar, mat)); g.add(new THREE.Mesh(CROSS.bar2, mat));
  for (const [x, z] of [[-0.75, 0], [0.75, 0], [0, 0.55], [0, -0.55]]) { const k = new THREE.Mesh(CROSS.knob, mat); k.position.set(x, 0, z); g.add(k); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: grimTex().circle, color: GOLD, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
  glow.scale.setScalar(2.2); g.add(glow);
  return { g, mat };
}
function puppets(K, p) {
  const P = G.puppet, list = living(K);
  audio.play('bladeSing', p.position.x, p.position.z, { v: 0.9 }); audio.play('creak', p.position.x, p.position.z, { v: 0.8 });
  K.ui.tint('rgba(40,20,0,0.9)', 0.45, 99, 'rgba(255,200,120,0.08)');
  K.text('Dancem!', p.position, 'crit', 3.2);
  const ctl = [];
  for (const e of list) {
    if (e.data.boss) { e.daze && e.daze(P.boss); K.text('Preso nos fios!', e.position, 'block', 3); continue; }
    e.grimBlindT = P.dur; e.grimBlindPick = 0; e.grimPuppet = true;
    const c = makeControl();
    c.g.position.set(e.position.x, P.h + 4, e.position.z); K.scene.add(c.g);
    const pos = new Float32Array(3 * 2 * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: STRING, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    lines.frustumCulled = false; K.scene.add(lines);
    ctl.push({ e, c, lines, pos, ph: rnd(0, 6.28), jerk: 0 });
  }
  const off = () => {
    for (const o of ctl) {
      o.e.grimBlindT = 0; o.e.betrayLeft = 0; o.e.grimBlindSpot = null; o.e.grimPuppet = false;
      if (o.e.model) { o.e.model.rotation.z = 0; o.e.model.position.y = 0; }
      K.scene.remove(o.c.g); o.c.mat.dispose(); K.scene.remove(o.lines); o.lines.geometry.dispose(); o.lines.material.dispose();
    }
    ctl.length = 0;
  };
  K.effect({ dur: P.dur, onFrame: (dt, ef) => {
    const k = ef.t;
    for (const o of ctl) {
      const e = o.e, a = e.facing, cx = Math.cos(a), sx = Math.sin(a);
      if (e.alive) { e.grimBlindT = P.dur - k; e.betrayLeft = e.grimBlindT; }
      // Trancos: a cada pouco a cruzeta dá um puxão e o boneco pula.
      o.jerk -= dt; if (o.jerk <= 0) { o.jerk = rnd(0.35, 0.7); o.kick = 1; }
      o.kick = Math.max(0, (o.kick || 0) - dt * 5);
      const hy = P.h + 0.35 * Math.sin(k * 3 + o.ph) + 0.5 * o.kick, drop = Math.min(1, k * 4);
      o.c.g.position.set(e.position.x, hy + 4 * (1 - drop), e.position.z);
      o.c.g.rotation.set(0.25 * Math.sin(k * 4 + o.ph) + 0.3 * o.kick, a, 0.25 * Math.cos(k * 3.4 + o.ph));
      if (e.alive && e.model) { e.model.rotation.z = 0.18 * Math.sin(k * 7 + o.ph); e.model.position.y = 0.25 * o.kick / (e.group.scale.x || 1); }
      // Fios: da cruzeta até a cabeça e as duas mãos.
      const s = e.group.scale.x || 1, ex = e.position.x, ez = e.position.z, top = o.c.g.position;
      const pts = [[0, 0, 2.3 * s], [-0.75, 0.55 * s, 1.35 * s], [0.75, -0.55 * s, 1.35 * s]];
      pts.forEach(([bx, side, y], i) => {
        const tx = top.x + cx * bx, tz = top.z - sx * bx; // ponta da cruzeta
        const hx = ex + cx * side * (i ? 1 : 0), hz = ez - sx * side * (i ? 1 : 0);
        o.pos.set([tx, top.y, tz, hx, y, hz], i * 6);
      });
      o.lines.geometry.attributes.position.needsUpdate = true;
      o.lines.material.opacity = e.alive ? 0.7 + 0.3 * Math.sin(k * 10 + o.ph) : Math.max(0, o.lines.material.opacity - dt * 2);
    }
    K.glow(p.position.x, p.position.z, GOLD, 5);
  }, onEnd: () => { off(); K.ui.tintOff(); audio.play('bladeSing', p.position.x, p.position.z, { v: 0.5 }); }, onClear: () => { off(); K.ui.tintOff(); } });
  K.log({ type: 'grimPuppet', n: ctl.length });
}

// ---------- 42) Conversão ----------
// Um raio dourado sai das mãos da Maga no inimigo mais forte da sala (chefes não): ganha auréola, vida cheia em dobro e
// passa a lutar por ela até o fim da sala. Sem inimigo comum: o raio vai no chefe e machuca.
function conversion(K, p) {
  const V = G.convert, list = living(K).filter((e) => e.state !== 'spawn' || e.targetable);
  const commons = list.filter((e) => !e.data.boss && !e.immune);
  const target = commons.length ? commons.reduce((a, b) => (b.maxHp > a.maxHp || (b.maxHp === a.maxHp && b.hp > a.hp) ? b : a)) : list.find((e) => e.data.boss);
  const hp = handsPoint(p);
  audio.play('charge', hp.x, hp.z, { v: 1 });
  if (!target) { K.fx.flare(hp, 3, HOLY, 0.3); K.vfx.sparks(hp, GOLD, 12); return; }
  const boss = !!target.data.boss;
  if (!boss) { target.daze && target.daze(V.beam + 0.2); }
  // Raio dourado das mãos até ele.
  K.effect({ dur: V.beam, tick: 0.05, onTick: () => {
    const h = handsPoint(p), t = v3(target.position.x, 1.3 * (target.group.scale.x || 1), target.position.z);
    K.vfx.lightning(h, t, GOLD, 0.35);
    K.vfx.sparks(t, HOLY, 3);
  }, onFrame: () => K.glow(target.position.x, target.position.z, GOLD, 25) });
  K.later(V.beam, () => {
    if (!target.alive) return;
    const x = target.position.x, z = target.position.z;
    K.fx.skyBeam(x, z, 1.4, 0.7, HOLY); K.fx.shock(x, z, 3, GOLD, 0.45); K.fx.flare(v3(x, 1.3, z), 5, HOLY, 0.35);
    K.vfx.sparks(v3(x, 1.3, z), GOLD, 18); K.ui.flash(p, true);
    audio.play('bell', x, z, { v: 1 }); audio.play('blessing', x, z, { v: 0.7 });
    if (boss) { K.hurt(target, V.boss, 0, 1, 'dmg big', p); target.daze && target.daze(1.5); K.text('Resistiu!', target.position, 'block', 3); return; }
    convert(K, p, target);
  });
}
function convert(K, p, e) {
  const V = G.convert, c = K.c, d = e.data;
  e.data = { ...d, attackRange: d.ranged ? d.attackRange : Math.max(d.attackRange || 0, 2.0), voice: undefined };
  e.undead = p; e.grimConvert = true;
  e.noGrave = true; e.noUltCharge = true; e.provokedBy = null; e.darkMark = null; e.betrayLeft = 0; e.grudgeT = 0; e.grimBlindT = 0;
  if (e.darkFx) { e.darkFx.s.visible = false; e.darkFx.skull.visible = false; }
  e.releaseToken && e.releaseToken();
  if (e.vel) e.vel.set(0, 0, 0);
  e.maxHp = Math.round(e.maxHp * V.hpMul); e.hp = e.maxHp;
  if (e.frozenT > 0) { e.frozenT = 0; if (e.iceBlock) e.iceBlock.visible = false; }
  if (e.state !== 'lanceFly') { e.setState('hurt'); e.stunTime = 0.4; }
  for (const o of c.enemies) { if (o.target === e) o.target = null; if (o.provokedBy === e) o.provokedBy = null; }
  // Auréola em cima da cabeça.
  const sc = e.group.scale.x || 1;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 6, 24), new THREE.MeshBasicMaterial({ color: GOLD }));
  halo.rotation.x = Math.PI / 2; halo.position.y = 2.65 / sc; halo.scale.setScalar(1 / sc); e.group.add(halo);
  const gl = sprite(K, HOLY); gl.material.opacity = 0.45; gl.scale.setScalar(1.3 / sc); gl.position.y = 2.65 / sc; e.group.add(gl);
  e.grimHalo = { halo, gl };
  setFlash(e.bodyMats, 0.5, 1, 0.8, 0.3);
  K.text('Convertido!', e.position, 'heal', 3.4);
  K.log({ type: 'grimConvert', enemy: e });
}

// ---------- 43) Bomba-Relógio ----------
// Cada inimigo ganha uma bomba acesa em cima da cabeça, pisca vermelho e incha; 2 s depois todos explodem (e a
// explosão de um pega quem estiver perto).
let BOMBGEO = null;
function makeBomb() {
  if (!BOMBGEO) BOMBGEO = { ball: new THREE.SphereGeometry(0.32, 14, 10), cap: new THREE.CylinderGeometry(0.1, 0.12, 0.14, 8), fuse: new THREE.CylinderGeometry(0.025, 0.025, 0.3, 4) };
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.4, metalness: 0.4, emissive: 0x400000, emissiveIntensity: 0.5 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(BOMBGEO.ball, dark));
  const cap = new THREE.Mesh(BOMBGEO.cap, dark); cap.position.y = 0.33; g.add(cap);
  const fuse = new THREE.Mesh(BOMBGEO.fuse, new THREE.MeshBasicMaterial({ color: 0xd8c090 })); fuse.position.set(0.05, 0.5, 0); fuse.rotation.z = -0.4; g.add(fuse);
  const spark = new THREE.Sprite(new THREE.SpriteMaterial({ map: grimTex().circle, color: 0xffd060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  spark.position.set(0.12, 0.66, 0); spark.scale.setScalar(0.45); g.add(spark);
  return { g, dark, spark };
}
function timeBomb(K, p) {
  const T = G.bomb, list = living(K);
  audio.play('reload', p.position.x, p.position.z, { v: 1 }); audio.play('spell', p.position.x, p.position.z, { v: 0.7 });
  K.text('Tic... tac...', p.position, 'crit', 3);
  if (!list.length) return;
  const bombs = [];
  for (const e of list) {
    const b = makeBomb(), sc = e.group.scale.x || 1;
    b.g.position.y = 2.75 / sc; b.g.scale.setScalar(1.15 / sc); e.group.add(b.g);
    bombs.push({ e, b, s0: e.model ? e.model.scale.clone() : null, boom: false });
    K.vfx.sparks(v3(e.position.x, 2.6, e.position.z), BOMB, 6);
  }
  let beep = 0, count = 3;
  const detach = (o) => { if (o.b.g.parent) o.b.g.parent.remove(o.b.g); o.b.dark.dispose(); if (o.s0 && o.e.model) o.e.model.scale.copy(o.s0); };
  K.effect({ dur: T.fuse, onFrame: (dt, ef) => {
    const k = ef.t / T.fuse, rate = 2 + k * 12;
    beep -= dt;
    if (beep <= 0) { beep = 1 / rate; audio.play('select', p.position.x, p.position.z, { v: 0.25 + 0.3 * k }); }
    const n = Math.ceil((1 - k) * 3);
    if (n < count && n > 0) { count = n; for (const o of bombs) if (o.e.alive) K.text(String(n), o.e.position, 'crit', 1.6); }
    for (const o of bombs) {
      if (!o.e.alive) continue;
      o.b.spark.scale.setScalar(0.35 + 0.25 * Math.random());
      o.b.g.rotation.z = Math.sin(ef.t * 20) * 0.15 * k;
      if (o.s0 && o.e.model) { const sw = 1 + 0.28 * k + 0.06 * Math.sin(ef.t * rate * 3); o.e.model.scale.set(o.s0.x * sw, o.s0.y * (1 + 0.12 * k), o.s0.z * sw); }
      setFlash(o.e.bodyMats, 0.15 + 0.55 * k * (0.5 + 0.5 * Math.sin(ef.t * rate * 6)), 1, 0.25, 0.1);
    }
  }, onEnd: () => {
    K.shake(p, 1); K.ui.flash(p, true);
    audio.play('rexExplode', p.position.x, p.position.z, { v: 1.2 }); audio.play('boom', p.position.x, p.position.z, { v: 1 });
    const spots = bombs.filter((o) => o.e.alive).map((o) => ({ o, x: o.e.position.x, z: o.e.position.z }));
    for (const o of bombs) detach(o);
    spots.forEach(({ o, x, z }, i) => K.later(i * 0.04, () => {
      K.fx.explosion(v3(x, 1.2, z), 1.6); K.fx.impact(x, z, 1, BOMB); K.fx.crack(x, z, 2.2, 3, BOMB); K.fx.rocks(x, z, 6, 0.9);
      K.glow(x, z, BOMB, 60);
      if (o.e.alive) K.hurt(o.e, o.e.data.boss ? T.boss : T.dmg, 0, 1, 'dmg big', p);
      hurtAround(K, x, z, T.r, T.splash, p, o.e, 'dmg');
    }));
    K.log({ type: 'grimBomb', n: spots.length });
  }, onClear: () => { for (const o of bombs) detach(o); } });
}

// ---------- 44) Teto Desabando ----------
// A sala treme, cai poeira e o teto desaba: pedras gigantes caem em cima de cada inimigo (e algumas a mais pela sala).
let ROCKGEO = null;
function ceilingCollapse(K, p) {
  const C = G.ceiling, B = K.bounds(), x0 = p.position.x, z0 = p.position.z, list = living(K);
  if (!ROCKGEO) ROCKGEO = new THREE.DodecahedronGeometry(1, 0);
  K.text('O TETO VAI CAIR!', p.position, 'crit', 3.4);
  audio.play('rexCrack', x0, z0, { v: 1.2 }); audio.play('creak', x0, z0, { v: 1 });
  K.later(0.15, () => audio.play('noise', x0, z0, { v: 0.6 }));
  for (let i = 0; i < 45; i++) { // poeira e pedrinhas caindo do teto
    const s = sprite(K, 0xbfae98, K.vfx.dustTex, false), sx = rnd(-B.x, B.x), sz = rnd(-B.z, B.z), d = rnd(0, C.over), sc = rnd(0.25, 0.7);
    s.material.opacity = 0;
    K.vfx.add(s, C.over + C.fall + 0.6, (o, k) => { const T = k * (C.over + C.fall + 0.6) - d; if (T < 0) return; const kk = Math.min(1, T / 1.1); o.position.set(sx, 9 * (1 - kk), sz); o.scale.set(sc, sc * 2, 1); o.material.opacity = 0.5 * (1 - kk); });
  }
  // Onde cai: em cima de cada inimigo (chefe leva 2) e o resto espalhado.
  const spots = [];
  for (const e of list) { spots.push({ e }); if (e.data.boss) spots.push({ e }); }
  while (spots.length < C.n) {
    let x = rnd(-B.x + 1.5, B.x - 1.5), z = rnd(-B.z + 1.5, B.z - 1.5);
    if (Math.hypot(x - x0, z - z0) < 3) { x = -x; z = -z; }
    spots.push({ x, z });
  }
  const mat = new THREE.MeshStandardMaterial({ color: ROCK, roughness: 1, flatShading: true, emissive: 0x1a120a, emissiveIntensity: 0.5 });
  let n = 0;
  spots.slice(0, Math.max(C.n, list.length + 1)).forEach((s, i) => K.later(i * (C.over / Math.max(1, spots.length)) + (s.e ? 0 : 0.2), () => {
    let x = s.e ? s.e.position.x + rnd(-0.4, 0.4) : s.x, z = s.e ? s.e.position.z + rnd(-0.4, 0.4) : s.z;
    if (Math.hypot(x - p.position.x, z - p.position.z) < 1.8 && !s.e) return;
    dropRock(K, p, x, z, mat, s.e && s.e.data.boss ? 1.7 : rnd(1.1, 1.5), () => { if (++n === 1) K.shake(p, 0.6); });
  }));
  K.effect({ dur: C.over + C.fall + 0.3, tick: 0.12, onTick: () => K.shake(p, 0.18) });
  K.log({ type: 'grimCeiling', n: spots.length });
}
function dropRock(K, p, x, z, mat, size, onLand) {
  const C = G.ceiling;
  const rock = new THREE.Mesh(ROCKGEO, mat); rock.scale.set(size * rnd(0.9, 1.2), size * rnd(0.8, 1.05), size * rnd(0.9, 1.2));
  rock.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6));
  const sh = new THREE.Mesh(flatGeo(), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })); sh.position.set(x, 0.09, z);
  K.vfx.add(sh, C.fall, (o, k) => { o.scale.setScalar(size * 2.2 * (0.4 + 0.6 * k)); o.material.opacity = 0.55 * k; });
  const warn = floorGlow(K, x, z, C.r, 0xff6a3a, C.fall, 0.45, grimTex().circle);
  warn.material.color.setHex(0xff6a3a);
  let landed = false, sinkT = 0;
  const life = C.fall + C.stay;
  K.vfx.add(rock, life, (o, k, dt) => {
    const T = k * life;
    if (T < C.fall) { const kk = T / C.fall; o.position.set(x, 12 - (12 - size * 0.8) * kk * kk, z); o.rotation.x += dt * 3; return; }
    if (!landed) {
      landed = true; onLand();
      o.position.set(x, size * 0.8, z);
      K.fx.impact(x, z, 1.1, 0xd8b890); K.fx.rocks(x, z, 12, 1.1); K.fx.crack(x, z, C.r + 0.6, 4, 0xffa060); K.vfx.dust(v3(x, 0.2, z), v3(0, 1, 0), 10);
      K.fx.smoke(v3(x, 0.5, z), 5, 1.4);
      audio.play('headThud', x, z, { v: 0.9 }); audio.play('crunch', x, z, { v: 0.7 });
      hurtAround(K, x, z, C.r, C.dmg, p);
      for (const e of K.foes()) if (!e.data.boss && e.alive && e.vel && Math.hypot(e.position.x - x, e.position.z - z) <= C.r + 1.5) { const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01; e.vel.set(dx / d, 0, dz / d).multiplyScalar(8); }
    }
    // Fica um tempo no chão e depois afunda.
    if (T > life - 0.6) { sinkT += dt; o.position.y = size * 0.8 - sinkT * 3; }
  });
}

export const SPELLS8 = [
  { id: 'miniatura', name: 'Miniatura', color: PINK, cast: miniature },
  { id: 'marionetes', name: 'Marionetes', color: GOLD, cast: puppets },
  { id: 'conversao', name: 'Conversão', color: HOLY, cast: conversion },
  { id: 'bomba', name: 'Bomba-Relógio', color: BOMB, cast: timeBomb },
  { id: 'teto', name: 'Teto Desabando', color: 0xd8b890, cast: ceilingCollapse },
];
