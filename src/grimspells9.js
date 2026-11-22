// Grimório Ancestral, lote 5 (22/11/2026), parte 2 — as "absurdas": Martelo dos Deuses, Dia do Juízo, Fonte da Vida,
// Roleta do Caos e APOCALIPSE. Mesmo formato do lote 1 (grimspells.js): { id, name, color, cast(K, p) }. Números em
// l1bless.js (L1.grim). Roleta e Apocalipse soltam outras magias do livro (K.spells, montado em grimkit.js).
import * as THREE from 'three';
import { audio } from './audio.js';
import { grimTex, castCircle, GOLD, PALE, VIOLET } from './grimlook.js';
import { GRIM as G, v3, rnd, HOLY, FIRE, addMat, flatGeo, floorGlow } from './grimspells.js';
import { aimDir } from './grimspells2.js';

const THUNDER = 0x9fd8ff, LIFE = 0x9dffb0, BLOOD = 0xff3a2a;
const sprite = (K, color, tex = null, add = true) => { const s = K.vfx.sprite(tex || K.vfx.sparkTex, add); s.material.color.setHex(color); return s; };
const living = (K) => K.c.enemies.filter((e) => e.alive && !e.undead && !e.data.phantom);

// ---------- 45) Martelo dos Deuses ----------
// Um martelo colossal (cabeça de pedra com faixas de ouro e runas) despenca do céu em cima do grupo maior, achata tudo
// embaixo, deixa os de perto tontos e fica cravado um instante antes de subir de volta.
function makeHammer() {
  const stone = new THREE.MeshStandardMaterial({ color: 0x8c8a96, emissive: 0x2a2440, emissiveIntensity: 0.5, roughness: 0.7, metalness: 0.3, flatShading: true });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xb07010, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.8 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a24, emissive: 0x1a0c04, emissiveIntensity: 0.4, roughness: 0.9 });
  const rune = new THREE.MeshBasicMaterial({ color: THUNDER });
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.6, 2.8), stone); head.position.y = 1.3; g.add(head);
  for (const sx of [-1.9, 1.9]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.75, 2.95), gold); band.position.set(sx, 1.3, 0); g.add(band); }
  for (const sx of [-2.65, 2.65]) { const face = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 2.4), gold); face.position.set(sx, 1.3, 0); g.add(face); }
  for (const sz of [-1.42, 1.42]) { const r = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.04), rune); r.position.set(0, 1.3, sz); g.add(r); const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 0.04), rune); r2.position.set(0, 1.3, sz); g.add(r2); }
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 8, 10), wood); handle.position.y = 2.6 + 4; g.add(handle);
  for (const y of [4.2, 6.6, 9]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 10), gold); w.position.y = y; g.add(w); }
  const pom = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), gold); pom.position.y = 11; g.add(pom);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: K_spark(), color: THUNDER, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(9, 6, 1); glow.position.y = 1.3; g.add(glow);
  return { g, mats: [stone, gold, wood, rune], glow, rune };
}
let SPARK = null;
const K_spark = () => SPARK;
function godHammer(K, p) {
  const H = G.hammer, t = K.aim(p, H.r), x = t.x, z = t.z;
  SPARK = K.vfx.sparkTex;
  const hm = makeHammer();
  hm.g.rotation.x = -0.45; hm.g.scale.setScalar(1.25); // cabo inclinado para trás: dá para ver o martelo de cima
  K.scene.add(hm.g);
  K.ui.tint('rgba(10,20,50,0.9)', 0.5, H.fall + 0.6, 'rgba(120,180,255,0.1)');
  K.fx.rune(x, z, H.r, H.fall + 0.2); K.fx.skyBeam(x, z, 2.2, H.fall + 0.1, THUNDER);
  const shadow = new THREE.Mesh(flatGeo(), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })); shadow.position.set(x, 0.09, z);
  K.vfx.add(shadow, H.fall + 0.2, (o, k) => { o.scale.set(6.5 * (0.3 + 0.7 * k), 1, 3.5 * (0.3 + 0.7 * k)); o.material.opacity = 0.6 * k; });
  audio.play('thunder', x, z, { v: 1.3 }); audio.play('mechFall', x, z, { v: 1 });
  K.text('MARTELO DOS DEUSES!', p.position, 'crit', 3.6);
  let hit = false, gone = false, arcT = 0;
  const life = H.fall + H.stay + 0.6;
  const cleanup = () => { if (gone) return; gone = true; K.scene.remove(hm.g); for (const m of hm.mats) m.dispose(); hm.glow.material.dispose(); };
  K.effect({ dur: life, onFrame: (dt, ef) => {
    const T = ef.t;
    if (T < H.fall) { // despenca girando devagar, com raios em volta
      const k = T / H.fall, kk = k * k * k;
      hm.g.position.set(x, 30 * (1 - kk), z); hm.g.rotation.z = 0.25 * (1 - k) * Math.sin(T * 6); hm.g.rotation.y = 1.5 * (1 - k) * (1 - k);
      arcT -= dt;
      if (arcT <= 0) { arcT = 0.06; const y = hm.g.position.y + 1.3; K.vfx.lightning(v3(x + rnd(-3, 3), y + rnd(0, 3), z + rnd(-2, 2)), v3(x + rnd(-2.8, 2.8), y + rnd(-1, 1), z + rnd(-1.4, 1.4)), THUNDER, 0.2); }
      return;
    }
    if (!hit) { hit = true; hm.g.position.set(x, 0, z); hm.g.rotation.z = 0; hm.g.rotation.y = 0; slam(); }
    if (T > H.fall + H.stay) { const k = (T - H.fall - H.stay) / 0.6; hm.g.position.y = k * k * 25; hm.glow.material.opacity = 0.5 * (1 - k); }
    else { hm.g.position.y = -0.4 * Math.max(0, 1 - (T - H.fall) / 0.15); hm.rune.color.setHSL(0.57, 1, 0.6 + 0.3 * Math.sin(T * 20)); }
  }, onEnd: cleanup, onClear: cleanup });
  function slam() {
    K.fx.impact(x, z, 2.2, THUNDER); K.fx.impact(x, z, 1.4, GOLD);
    K.fx.crack(x, z, H.r + 1.5, 7, THUNDER);
    K.fx.shock(x, z, H.dazeR, PALE, 0.8);
    K.fx.rocks(x, z, 26, 1.6);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; K.vfx.lightning(v3(x, 1, z), v3(x + Math.cos(a) * H.r, 0.2, z + Math.sin(a) * H.r), THUNDER, 0.3); }
    K.ui.flash(p); K.glow(x, z, THUNDER, 100); K.shake(p, 1.3);
    audio.play('mechSlam', x, z, { v: 1.4 }); audio.play('boom', x, z, { v: 1.2 }); audio.play('thunder', x, z, { v: 1 });
    for (const e of K.foes()) {
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      if (d <= H.r + e.data.radius) { K.hurt(e, H.dmg, dx / d, dz / d, 'dmg big', p); if (e.alive && e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(14); }
      else if (d <= H.dazeR && e.daze && !e.data.boss) { e.daze(H.daze); K.text('Tonto!', e.position, 'block', 2.5); }
    }
    K.log({ type: 'grimHammer' });
  }
}

// ---------- 47) Dia do Juízo ----------
// O céu fica dourado e uma muralha de luz desce do céu numa ponta da sala e varre até a outra; quem ela atravessa é
// julgado (um golpe enorme só uma vez). Passa pela Maga sem machucar.
let DOOMTEX = null;
function doomTex() {
  if (DOOMTEX) return DOOMTEX;
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 256, 0, 0);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,240,180,0.9)'); gr.addColorStop(0.6, 'rgba(255,210,120,0.45)'); gr.addColorStop(1, 'rgba(255,200,100,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`; g.fillRect(Math.random() * 64, 0, 1 + Math.random() * 3, 256); }
  DOOMTEX = new THREE.CanvasTexture(c); DOOMTEX.colorSpace = THREE.SRGBColorSpace; DOOMTEX.wrapS = THREE.RepeatWrapping;
  return DOOMTEX;
}
function doomsday(K, p) {
  const D = G.doom, B = K.bounds(), { a } = aimDir(K, p, 4);
  const ax = Math.abs(Math.sin(a)) > Math.abs(Math.cos(a)), sg = ax ? Math.sign(Math.sin(a)) || 1 : Math.sign(Math.cos(a)) || 1;
  const lim = (ax ? B.x : B.z) - 0.5, span = 2 * (ax ? B.z : B.x) + 2, from = -sg * lim, to = sg * lim;
  const dur = (to - from) * sg / D.speed;
  K.ui.tint('rgba(255,200,80,0.75)', 0.35, D.warn + dur + 0.4, 'rgba(255,255,220,0.1)');
  K.text('DIA DO JUÍZO!', p.position, 'crit', 3.8);
  audio.play('bell', p.position.x, p.position.z, { v: 1.2 }); audio.play('summon', p.position.x, p.position.z, { v: 0.8 });
  const g = new THREE.Group(); g.rotation.y = ax ? 0 : Math.PI / 2; K.scene.add(g);
  const mk = (w, op, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(span, 12), addMat(c, op, doomTex(), THREE.DoubleSide)); m.position.y = 6; m.rotation.y = Math.PI / 2; m.scale.x = 1; m.userData.w = w; g.add(m); return m; };
  const walls = [mk(1, 0.45, 0xffffff), mk(1, 0.3, HOLY)];
  walls[1].position.x = -0.5 * sg; walls[0].position.x = 0.3 * sg;
  const core = new THREE.Mesh(new THREE.BoxGeometry(D.w, 12, span), addMat(HOLY, 0.1)); core.position.y = 6; g.add(core);
  const floor = new THREE.Mesh(flatGeo(), addMat(0xfff0b0, 0.9)); floor.position.y = 0.1; floor.scale.set(D.w * 1.6, 1, span); g.add(floor);
  const judged = new Set();
  let gone = false, sparkT = 0, front = from;
  const cleanup = () => { if (gone) return; gone = true; K.scene.remove(g); g.traverse((o) => { if (o.material) o.material.dispose(); if (o.geometry) o.geometry.dispose(); }); };
  const along = (e) => (ax ? e.position.x : e.position.z);
  K.effect({ dur: D.warn + dur + 0.5, onFrame: (dt, ef) => {
    const t = ef.t - D.warn;
    if (t < 0) { // desce do céu na ponta da sala
      const k = ef.t / D.warn; front = from;
      g.position.set(ax ? front : 0, 14 * (1 - k * k), ax ? 0 : front);
      return;
    }
    const k = Math.min(1, t / dur), fade = t > dur ? Math.max(0, 1 - (t - dur) / 0.5) : 1;
    front = from + (to - from) * k;
    g.position.set(ax ? front : 0, 0, ax ? 0 : front);
    for (const w of walls) { w.material.map.offset.x += dt * 0.3; w.material.opacity = (w === walls[0] ? 0.45 : 0.3) * fade * (0.85 + 0.15 * Math.sin(ef.t * 30)); }
    core.material.opacity = 0.1 * fade; floor.material.opacity = 0.6 * fade;
    if (t >= dur) return;
    K.shake(p, 0.15);
    sparkT -= dt;
    if (sparkT <= 0) { // brasas douradas no chão por onde passa + marca queimada
      sparkT = 0.06;
      const q = rnd(-span / 2, span / 2), px = ax ? front : q, pz = ax ? q : front;
      K.fx.embers(v3(px, 0.3, pz), 3, 0.5, GOLD, 5);
      floorGlow(K, ax ? front : rnd(-B.x, B.x), ax ? rnd(-B.z, B.z) : front, 1.2, GOLD, 1.6, 0.35);
      K.glow(ax ? front : p.position.x, ax ? p.position.z : front, HOLY, 30);
    }
    for (const e of living(K)) {
      if (judged.has(e) || !e.targetable) continue;
      if ((along(e) - front) * sg > e.data.radius) continue;
      judged.add(e);
      const x = e.position.x, z = e.position.z;
      K.fx.skyBeam(x, z, 1.3, 0.5, HOLY); K.fx.shock(x, z, 2.6, GOLD, 0.4); K.vfx.sparks(v3(x, 1.2, z), HOLY, 12);
      audio.play('zap', x, z, { v: 0.8 });
      K.hurt(e, e.data.boss ? D.boss : D.dmg, ax ? sg : 0, ax ? 0 : sg, 'dmg big', p);
      if (e.alive && e.daze && !e.data.boss) e.daze(0.6);
      K.text('Julgado!', e.position, 'crit', 2.8);
    }
  }, onEnd: () => { cleanup(); K.ui.tintOff(); K.log({ type: 'grimDoom', n: judged.size }); }, onClear: () => { cleanup(); K.ui.tintOff(); } });
}

// ---------- 48) Fonte da Vida ----------
// Uma fonte de luz verde e dourada jorra da Maga: ela (e o parceiro, no co-op) recupera toda a vida, e 3 ondas de luz
// saem dela pela sala queimando os inimigos.
function lifeFount(K, p) {
  const F = G.fount, x0 = p.position.x, z0 = p.position.z;
  audio.play('heal', x0, z0, { v: 1.3 }); audio.play('blessing', x0, z0, { v: 1 });
  K.text('FONTE DA VIDA!', p.position, 'crit', 3.4);
  for (const q of K.c.players) {
    if (!q || q.state === 'dead' || !q.heal) continue;
    const h = q.heal(q.maxHp);
    K.text(h > 0 ? `+${h}` : 'Vida cheia!', q.position, 'heal', 3);
    K.fx.pillar(q.position.x, q.position.z, 6, 1.3, LIFE, 0.8);
  }
  K.log({ type: 'grimFount', hp: p.hp, max: p.maxHp });
  K.ui.tint('rgba(40,160,80,0.6)', 0.3, F.waves * F.every + 1, 'rgba(200,255,200,0)');
  floorGlow(K, x0, z0, 3, LIFE, F.waves * F.every + 1.5, 0.7, grimTex().circle);
  // A fonte: coluna de luz e gotas de luz subindo e caindo em volta da Maga.
  K.fx.pillar(x0, z0, 12, 2, LIFE, F.waves * F.every + 0.8);
  K.effect({ dur: F.waves * F.every + 0.8, tick: 0.03, onTick: () => {
    const px = p.position.x, pz = p.position.z;
    for (let i = 0; i < 2; i++) {
      const s = sprite(K, Math.random() < 0.6 ? LIFE : GOLD), a = rnd(0, 6.28), sp = rnd(1.5, 3.2), up = rnd(7, 10), sc = rnd(0.15, 0.32);
      K.vfx.add(s, 1.3, (o, k) => { const T = k * 1.3; o.position.set(px + Math.cos(a) * sp * T, 2.4 + up * T - 9 * T * T, pz + Math.sin(a) * sp * T); o.scale.setScalar(sc); o.material.opacity = 1 - k * k; });
    }
  }, onFrame: () => K.glow(p.position.x, p.position.z, LIFE, 25) });
  for (let w = 0; w < F.waves; w++) K.later(w * F.every + 0.15, () => wave(K, p, w));
}
function wave(K, p, w) {
  const F = G.fount, x = p.position.x, z = p.position.z, life = F.r / F.speed, hit = new Set();
  K.fx.shock(x, z, F.r, w % 2 ? GOLD : LIFE, life); K.fx.shock(x, z, F.r * 0.9, 0xffffff, life * 0.9, 0.3);
  audio.play('spell', x, z, { v: 0.8 });
  K.effect({ dur: life, onFrame: (dt, ef) => {
    const r = F.r * (1 - (1 - ef.t / life) ** 3);
    for (const e of K.foes()) {
      if (hit.has(e)) continue;
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      if (d > r + e.data.radius) continue;
      hit.add(e);
      K.hurt(e, F.dmg, dx / d, dz / d, 'burn', p);
      K.vfx.sparks(v3(e.position.x, 1.2, e.position.z), w % 2 ? GOLD : LIFE, 8);
    }
  } });
}

// ---------- 49) Roleta do Caos ----------
// Uma roleta mágica aparece em cima da Maga, gira e para: saem 3 magias sorteadas do livro de uma vez.
let WHEEL = null;
const WCOL = ['#ff6a1a', '#9fe8ff', '#ffd27a', '#8a2cff', '#7dff6a', '#ff7ad8', '#7fd8ff', '#ff3a2a'];
function wheelTex() {
  if (WHEEL) return WHEEL;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), n = WCOL.length;
  for (let i = 0; i < n; i++) {
    g.fillStyle = WCOL[i]; g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, 118, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2); g.closePath(); g.fill();
    g.save(); g.translate(128, 128); g.rotate(((i + 0.5) / n) * Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = 'bold 30px Georgia'; g.textAlign = 'center'; g.fillText('?', 78, 10); g.restore();
  }
  g.strokeStyle = '#2a1040'; g.lineWidth = 3;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * 118, 128 + Math.sin(a) * 118); g.stroke(); }
  g.lineWidth = 10; g.strokeStyle = '#ffd27a'; g.beginPath(); g.arc(128, 128, 120, 0, 6.29); g.stroke();
  g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(128, 128, 18, 0, 6.29); g.fill();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(128 + Math.cos(a) * 120, 128 + Math.sin(a) * 120, 4, 0, 6.29); g.fill(); }
  WHEEL = new THREE.CanvasTexture(c); WHEEL.colorSpace = THREE.SRGBColorSpace;
  return WHEEL;
}
const NO_CHAIN = new Set(['roleta', 'apocalipse']);
function chaosWheel(K, p) {
  const C = G.chaos;
  const pool = K.spells.filter((s) => !NO_CHAIN.has(s.id)).sort(() => Math.random() - 0.5).slice(0, C.n);
  audio.play('spin', p.position.x, p.position.z, { v: 1 }); audio.play('reload', p.position.x, p.position.z, { v: 0.6 });
  K.text('Roleta do Caos!', p.position, 'crit', 3);
  const wheel = new THREE.Sprite(new THREE.SpriteMaterial({ map: wheelTex(), transparent: true, depthWrite: false, depthTest: false })); wheel.renderOrder = 6;
  const pin = sprite(K, 0xffffff, grimTex().circle); pin.material.depthTest = false; pin.renderOrder = 7;
  let rot = 0, tickT = 0;
  K.vfx.add(wheel, C.spin + 0.5, (o, k, dt) => {
    const T = k * (C.spin + 0.5), sp = T < C.spin ? 22 * (1 - T / C.spin) ** 2 : 0;
    rot += sp * dt; o.material.rotation = rot;
    o.position.set(p.position.x, 6.8, p.position.z); o.scale.setScalar(3.2 * Math.min(1, T * 6) * (T > C.spin ? 1 + (T - C.spin) * 0.6 : 1));
    o.material.opacity = T > C.spin ? Math.max(0, 1 - (T - C.spin) / 0.5) : 1;
    tickT -= sp * dt; if (tickT <= 0 && sp > 0.5) { tickT = Math.PI / 4; audio.play('select', p.position.x, p.position.z, { v: 0.3 }); }
  });
  K.vfx.add(pin, C.spin + 0.5, (o, k) => { o.position.set(p.position.x, 8.5, p.position.z); o.scale.setScalar(0.6); o.material.opacity = k > 0.8 ? (1 - k) / 0.2 : 1; });
  K.later(C.spin, () => { K.ui.flash(p, true); audio.play('bell', p.position.x, p.position.z, { v: 0.9 }); K.fx.flare(v3(p.position.x, 6.8, p.position.z), 5, GOLD, 0.35); });
  pool.forEach((sp, i) => K.later(C.spin + 0.1 + i * C.gap, () => {
    castCircle(K.vfx, p, sp.color, 2.4);
    K.text(`${sp.name}!`, p.position, 'big', 3.2);
    K.log({ type: 'grimChaos', id: sp.id });
    sp.cast(K, p);
  }));
  K.log({ type: 'grimWheel', ids: pool.map((s) => s.id) });
}

// ---------- 50) APOCALIPSE ----------
// O fim do mundo: céu vermelho, e ao mesmo tempo Buraco Negro, Chuva de Meteoros, Tempestade e Inferno. No fim, a sala
// inteira explode.
const APOC = ['buraco', 'chuva', 'tempestade', 'inferno'];
function apocalypse(K, p) {
  const A = G.apoc, B = K.bounds(), x0 = p.position.x, z0 = p.position.z;
  K.ui.flash(p); K.shake(p, 1.2);
  K.text('APOCALIPSE', p.position, 'crit', 4.5);
  audio.play('mechRoar', x0, z0, { v: 1.2 }); audio.play('thunder', x0, z0, { v: 1.4 }); audio.play('fireRoar', x0, z0, { v: 1.2 });
  K.fx.shock(x0, z0, 14, BLOOD, 1); K.fx.pillar(x0, z0, 16, 3, BLOOD, 0.8);
  APOC.forEach((id, i) => K.later(0.12 * i, () => { const sp = K.spells.find((s) => s.id === id); if (sp) { sp.cast(K, p); K.log({ type: 'grimChaos', id }); } }));
  K.later(0.6, () => K.ui.tint('rgba(110,0,0,0.95)', 0.6, A.dur - 0.6, 'rgba(255,60,0,0.15)'));
  // Céu rachando: raios vermelhos e brasas caindo o tempo todo.
  K.effect({ dur: A.dur, tick: 0.18, onTick: () => {
    const x = rnd(-B.x, B.x), z = rnd(-B.z, B.z);
    K.vfx.lightning(v3(x + rnd(-2, 2), 16, z + rnd(-2, 2)), v3(x, 0.2, z), BLOOD, 0.3);
    K.fx.embers(v3(rnd(-B.x, B.x), 6, rnd(-B.z, B.z)), 4, 2, FIRE, -2);
    if (Math.random() < 0.3) K.shake(p, 0.3);
  } });
  K.later(A.dur, () => { // a sala inteira explode
    const x = p.position.x, z = p.position.z;
    K.ui.flash(p); K.shake(p, 1.6);
    K.fx.flare(v3(x, 2, z), 22, 0xffffff, 0.5); K.fx.flare(v3(x, 2, z), 16, BLOOD, 0.8);
    K.fx.shock(x, z, Math.hypot(B.x, B.z) * 1.2, BLOOD, 1); K.fx.shock(x, z, Math.hypot(B.x, B.z), GOLD, 0.8, 0.3);
    for (let i = 0; i < 10; i++) { const ex = rnd(-B.x, B.x), ez = rnd(-B.z, B.z); K.later(i * 0.04, () => { K.fx.explosion(v3(ex, 1, ez), 1.8); K.fx.crack(ex, ez, 3, 6, FIRE); }); }
    K.glow(x, z, BLOOD, 120);
    audio.play('mechExplode', x, z, { v: 1.4 }); audio.play('boom', x, z, { v: 1.4 });
    for (const e of K.foes()) { const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01; K.hurt(e, e.data.boss ? A.finalBoss : A.final, dx / d, dz / d, 'dmg big', p); if (e.alive && e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(16); }
    K.text('FIM DO MUNDO!', p.position, 'crit', 4);
    K.log({ type: 'grimApoc' });
  });
}

export const SPELLS9 = [
  { id: 'martelo', name: 'Martelo dos Deuses', color: THUNDER, cast: godHammer },
  { id: 'juizo', name: 'Dia do Juízo', color: HOLY, cast: doomsday },
  { id: 'fonte', name: 'Fonte da Vida', color: LIFE, cast: lifeFount },
  { id: 'roleta', name: 'Roleta do Caos', color: VIOLET, cast: chaosWheel },
  { id: 'apocalipse', name: 'APOCALIPSE', color: BLOOD, cast: apocalypse },
];
