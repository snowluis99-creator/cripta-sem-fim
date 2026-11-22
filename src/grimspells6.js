// Grimório Ancestral, lote 4 (22/11/2026), parte 1: Gravidade Esmagadora, Salão de Espelhos, Rasgo na Realidade,
// Anel Planetário e Terremoto. Mesmo formato do lote 1 (grimspells.js): { id, name, color, cast(K, p) }.
// Números em l1bless.js (L1.grim). A lista completa (SPELLS) é montada em grimkit.js.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { audio } from './audio.js';
import { grimTex, handsPoint, VIOLET, GOLD, PALE } from './grimlook.js';
import { GRIM as G, v3, rnd, VOID, addMat, flatGeo, floorGlow, grab, release } from './grimspells.js';
import { aimDir, wallEnd } from './grimspells2.js';

const CRYS = 0xb9a8ff, RIFT = 0xd06bff, ROCK = 0xff9a4a, EARTH = 0xc8873a;
const foesIn = (K, x, z, r) => K.foes().filter((e) => Math.hypot(e.position.x - x, e.position.z - z) <= r + e.data.radius);
const sprite = (K, color, tex = null, add = true) => { const s = K.vfx.sprite(tex || K.vfx.sparkTex, add); s.material.color.setHex(color); return s; };
const living = (K) => K.c.enemies.filter((e) => e.alive && !e.undead && !e.data.phantom);

// ---------- 29) Gravidade Esmagadora ----------
// A sala inteira afunda: anéis de pressão descem do teto em cima de cada inimigo, que vai sendo achatado no chão.
function crushGravity(K, p) {
  const C = G.crush, B = K.bounds(), x0 = p.position.x, z0 = p.position.z;
  K.ui.tint('rgba(30,0,60,0.95)', 0.7, 99, 'rgba(40,0,80,0.2)');
  K.ui.flash(p, true); K.shake(p, 0.6);
  audio.play('mechSlam', x0, z0, { v: 1.1 }); audio.play('boom', x0, z0, { v: 0.8 });
  K.text('Gravidade ×10!', p.position, 'crit', 3.4);
  for (let i = 0; i < 40; i++) { // poeira caindo rápido do teto pela sala
    const s = sprite(K, i % 2 ? 0xc9b6ff : VIOLET, i % 3 ? K.vfx.dustTex : null, i % 3 === 0), sx = rnd(-B.x, B.x), sz = rnd(-B.z, B.z), sc = rnd(0.12, 0.3), d = rnd(0, 0.8);
    K.vfx.add(s, C.dur, (o, k) => { const kk = (k * 3 + d) % 1; o.position.set(sx, 9 * (1 - kk), sz); o.scale.set(sc * 0.4, sc * 3, 1); o.material.opacity = 0.8 * (1 - kk); });
  }
  const held = [];
  for (const e of living(K)) {
    const s0 = e.group.scale.clone(), x = e.position.x, z = e.position.z;
    const h = { e, s0, x, z, boss: !!e.data.boss };
    if (h.boss) { e.daze && e.daze(C.dur * 0.6); }
    else if (grab(e)) e.grimSpin = { crush: true }; else continue;
    h.ring = floorGlow(K, x, z, e.data.radius + 1, VIOLET, C.dur + 0.4, 0.6, grimTex().circle);
    held.push(h);
  }
  let pulse = 0;
  const squash = (h, k) => { const e = h.e; if (!e.alive) return; e.group.scale.set(h.s0.x * (1 + 0.45 * k), h.s0.y * (1 - (1 - C.squash) * k), h.s0.z * (1 + 0.45 * k)); };
  const restore = () => { for (const h of held) h.e.group.scale.copy(h.s0); };
  K.effect({ dur: C.dur, onFrame: (dt, ef) => {
    const n = Math.min(C.pulses, Math.floor(ef.t / (C.dur / C.pulses)) + 1);
    if (n > pulse) { // nova onda de pressão: anéis descem do teto sobre cada um
      pulse = n;
      K.shake(p, 0.35 + 0.15 * n); audio.play('thump', x0, z0, { v: 0.8 + 0.1 * n }); K.glow(x0, z0, VIOLET, 30);
      for (const h of held) {
        const e = h.e; if (!e.alive) continue;
        const x = e.position.x, z = e.position.z, r = e.data.radius + 1.2;
        for (let j = 0; j < 3; j++) {
          const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.09, 6, 28).rotateX(Math.PI / 2), addMat(j ? VIOLET : PALE, 0.9));
          K.vfx.add(m, 0.35 + j * 0.08, (o, k) => { o.position.set(x, 7 * (1 - k * k) + 0.1, z); o.scale.setScalar(1 + 0.6 * (1 - k)); o.material.opacity = 0.9 * Math.min(1, k * 4); });
        }
        K.later(0.35, () => { K.fx.crack(x, z, 1.2 + 0.5 * n, 3, VIOLET); K.fx.shock(x, z, 2 + 0.6 * n, VIOLET, 0.3); K.vfx.dust(v3(x, 0.1, z), v3(0, 0.3, 0), 5); });
      }
    }
    const k = Math.min(1, ef.t / C.dur);
    for (const h of held) {
      const e = h.e;
      if (!e.alive) continue;
      squash(h, Math.min(1, k * 1.15) ** 0.7);
      if (!h.boss && e.state === 'lanceFly') { e.position.set(h.x + Math.sin(ef.t * 60) * 0.03, 0, h.z); }
    }
  }, onEnd: () => {
    K.ui.tintOff(); K.ui.flash(p, true); K.shake(p, 0.9);
    audio.play('mechSlam', x0, z0, { v: 1.2 }); audio.play('bigShatter', x0, z0, { v: 0.6 });
    for (const h of held) {
      const e = h.e;
      if (!e.alive) continue;
      const x = e.position.x, z = e.position.z;
      K.fx.impact(x, z, 0.7, VIOLET); K.fx.rocks(x, z, 6, 0.8);
      h.e.group.scale.copy(h.s0);
      if (h.boss) K.hurt(e, C.boss, 0, 1, 'dmg big', p);
      else if (e.state === 'lanceFly' && e.grimSpin && e.grimSpin.crush) { e.grimSpin = null; release(K, e, 0, 0, 0, C.dmg, p); }
    }
    K.log({ type: 'grimCrush', n: held.length });
  }, onClear: () => { K.ui.tintOff(); restore(); for (const h of held) if (!h.boss && h.e.alive && h.e.state === 'lanceFly') { h.e.grimSpin = null; release(K, h.e, 0, 0, 0, 0, p); } } });
}

// ---------- 30) Salão de Espelhos ----------
// 6 cópias de cristal da Maga em volta dela: fazem os mesmos movimentos que ela e atiram estilhaços nos inimigos.
const crystalMat = () => new THREE.MeshStandardMaterial({ color: 0xe6dcff, emissive: 0x5a3cff, emissiveIntensity: 0.45, metalness: 0.55, roughness: 0.12, transparent: true, opacity: 0.82, flatShading: true });
function makeMirror(p) {
  const m = SkeletonUtils.clone(p.model), mat = crystalMat();
  const bones = new Map(); p.model.traverse((o) => { if (o.isBone) bones.set(o.name, o); });
  const pairs = [];
  m.traverse((o) => {
    if (o.isBone && bones.has(o.name)) pairs.push([o, bones.get(o.name)]);
    if (o.isSprite || o.isPoints) o.visible = false;
    if (o.isMesh && !o.isSkinnedMesh && o.material && o.material.isMeshBasicMaterial) o.visible = false; // brilho das mãos
    else if (o.isMesh) { o.material = mat; o.castShadow = false; }
  });
  const g = new THREE.Group(); g.add(m);
  m.position.copy(p.model.position); m.quaternion.copy(p.model.quaternion); m.scale.copy(p.model.scale);
  const halo = new THREE.Mesh(flatGeo(), addMat(CRYS, 0.5, grimTex().circle)); halo.position.y = 0.08; halo.scale.setScalar(1.8); g.add(halo);
  return { g, m, mat, pairs, halo };
}
function shardBolt(K, p, from, e) {
  const S = G.mirror, geo = new THREE.OctahedronGeometry(0.22, 0).scale(0.6, 0.6, 2.4);
  const m = new THREE.Mesh(geo, addMat(0xffffff, 1)), glow = sprite(K, CRYS); glow.scale.setScalar(1.2);
  m.add(glow); m.position.copy(from); K.scene.add(m);
  let gone = false, trailT = 0;
  const end = () => { if (!gone) { gone = true; K.scene.remove(m); } };
  K.effect({ dur: 1.4, onFrame: (dt, ef) => {
    if (gone) return;
    const tx = e.position.x, tz = e.position.z, ty = 1.1;
    const dx = tx - m.position.x, dy = ty - m.position.y, dz = tz - m.position.z, d = Math.hypot(dx, dy, dz) || 0.01;
    const st = S.speed * dt;
    m.lookAt(tx, ty, tz);
    trailT -= dt; if (trailT <= 0) { trailT = 0.03; const t = sprite(K, CRYS); t.position.copy(m.position); K.vfx.add(t, 0.2, (q, k) => { q.scale.setScalar(0.5 * (1 - k)); q.material.opacity = 1 - k; }); }
    if (d <= st + e.data.radius * 0.5 || !e.alive) {
      if (e.alive && e.targetable) { K.hurt(e, S.dmg, dx / d, dz / d, 'dmg', p, true); K.vfx.sparks(v3(tx, ty, tz), CRYS, 6); audio.play('hit', tx, tz, { v: 0.35 }); }
      ef.dur = ef.t; end(); return;
    }
    m.position.x += dx / d * st; m.position.y += dy / d * st; m.position.z += dz / d * st;
  }, onEnd: end, onClear: end });
}
function mirrorHall(K, p) {
  const S = G.mirror, x0 = p.position.x, z0 = p.position.z;
  if (!p.model) return;
  K.ui.flash(p, true);
  audio.play('bigShatter', x0, z0, { v: 0.6 }); audio.play('bell', x0, z0, { v: 0.9 }); audio.play('summon', x0, z0, { v: 0.6 });
  const copies = [];
  for (let i = 0; i < S.n; i++) {
    const c = makeMirror(p), a = (i / S.n) * Math.PI * 2;
    c.a = a; c.fire = S.every * (0.2 + i / S.n); c.target = null;
    c.g.position.set(x0 + Math.sin(a) * S.r, 0, z0 + Math.cos(a) * S.r); c.g.scale.setScalar(0.01);
    K.scene.add(c.g); copies.push(c);
    K.fx.pillar(c.g.position.x, c.g.position.z, 4, 1, CRYS, 0.45); K.vfx.sparks(v3(c.g.position.x, 1, c.g.position.z), 0xffffff, 8);
  }
  let gone = false, spin = 0;
  const cleanup = () => { if (gone) return; gone = true; for (const c of copies) { K.scene.remove(c.g); c.mat.dispose(); } };
  K.effect({ dur: S.dur, onFrame: (dt, ef) => {
    const px = p.position.x, pz = p.position.z;
    const foes = K.foes().filter((e) => Math.hypot(e.position.x - px, e.position.z - pz) <= S.range).sort((a, b) => Math.hypot(a.position.x - px, a.position.z - pz) - Math.hypot(b.position.x - px, b.position.z - pz));
    spin += dt * 0.5;
    const grow = Math.min(1, ef.t / 0.3), fade = ef.t > S.dur - 0.3 ? (S.dur - ef.t) / 0.3 : 1;
    for (const c of copies) {
      for (const [b, o] of c.pairs) { b.position.copy(o.position); b.quaternion.copy(o.quaternion); b.scale.copy(o.scale); }
      const a = c.a + spin, x = px + Math.sin(a) * S.r, z = pz + Math.cos(a) * S.r;
      c.g.position.set(x, 0, z); c.g.scale.setScalar(grow);
      // Cada cópia mira um inimigo diferente (os mais perto da Maga primeiro); sem ninguém, olha para onde a Maga olha.
      const best = foes.length ? foes[copies.indexOf(c) % foes.length] : null;
      const face = best ? Math.atan2(best.position.x - x, best.position.z - z) : p.facing;
      c.g.rotation.y = face;
      c.mat.opacity = 0.82 * fade; c.mat.emissiveIntensity = 0.55 + 0.4 * Math.max(0, c.fire < 0.12 ? 1 - c.fire / 0.12 : 0);
      c.halo.rotation.y += dt * 2; c.halo.material.opacity = 0.5 * fade;
      c.fire -= dt;
      if (c.fire <= 0 && best && ef.t < S.dur - 0.25) {
        c.fire = S.every;
        const hp = v3(x + Math.sin(face) * 0.6, 1.35, z + Math.cos(face) * 0.6);
        shardBolt(K, p, hp, best);
        K.fx.flare(hp, 1.3, CRYS, 0.12);
        if (Math.random() < 0.4) audio.play('zap', x, z, { v: 0.25 });
      }
    }
    K.glow(px, pz, CRYS, 10);
  }, onEnd: () => {
    for (const c of copies) { // as cópias estilhaçam: cacos voam em quem estiver perto
      const x = c.g.position.x, z = c.g.position.z;
      K.fx.flare(v3(x, 1.2, z), 3, CRYS, 0.25); K.vfx.sparks(v3(x, 1.2, z), 0xffffff, 12); K.fx.shock(x, z, S.shatterR, CRYS, 0.3);
      for (const e of foesIn(K, x, z, S.shatterR)) { const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01; K.hurt(e, S.shatter, dx / d, dz / d, 'dmg', p, true); }
    }
    audio.play('bigShatter', p.position.x, p.position.z, { v: 1 });
    cleanup();
  }, onClear: cleanup });
  K.log({ type: 'grimMirror', n: copies.length });
}

// ---------- 31) Rasgo na Realidade ----------
let RIFTTEX = null;
function riftTex() { // fenda recortada: miolo preto (o vazio), borda violeta brilhante
  if (RIFTTEX) return RIFTTEX;
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d'), top = [], bot = [];
  for (let i = 0; i <= 32; i++) { const x = (i / 32) * 512, w = Math.sin((i / 32) * Math.PI) ** 0.7 * 54; top.push([x, 64 - w * (0.6 + Math.random() * 0.4)]); bot.push([x, 64 + w * (0.6 + Math.random() * 0.4)]); }
  const path = () => { g.beginPath(); g.moveTo(...top[0]); for (const q of top) g.lineTo(...q); for (const q of [...bot].reverse()) g.lineTo(...q); g.closePath(); };
  g.shadowColor = '#e08bff'; g.shadowBlur = 22; g.fillStyle = '#c86bff'; path(); g.fill();
  g.shadowBlur = 0; g.save(); g.translate(0, 64); g.scale(1, 0.72); g.translate(0, -64); g.fillStyle = '#05000a'; path(); g.fill(); g.restore();
  g.strokeStyle = 'rgba(255,240,255,0.9)'; g.lineWidth = 2; path(); g.stroke();
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${200 + Math.random() * 55},${180 + Math.random() * 75},255,${0.5 + Math.random() * 0.5})`; g.fillRect(40 + Math.random() * 430, 52 + Math.random() * 24, 2, 2); } // estrelas lá dentro
  RIFTTEX = new THREE.CanvasTexture(c); RIFTTEX.colorSpace = THREE.SRGBColorSpace;
  return RIFTTEX;
}
function realityRift(K, p) {
  const R = G.rift, { a } = aimDir(K, p, 3), dx = Math.sin(a), dz = Math.cos(a);
  const hp = handsPoint(p), x0 = hp.x, z0 = hp.z;
  const w = wallEnd(K, x0, z0, dx, dz, 40, 0.3), len = Math.max(6, w.d + 0.5);
  const cx = x0 + dx * len / 2, cz = z0 + dz * len / 2;
  // Risco fino de luz que corta o ar; depois abre em fenda.
  const mat = new THREE.MeshBasicMaterial({ map: riftTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  sheet.position.set(cx, 1.6, cz); sheet.rotation.y = a - Math.PI / 2; sheet.scale.set(0.01, 0.05, 1);
  const glowM = addMat(RIFT, 0.6, K.vfx.sparkTex, THREE.DoubleSide), glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowM);
  glow.position.copy(sheet.position); glow.rotation.copy(sheet.rotation); glow.position.y = 1.6;
  const floor = new THREE.Mesh(flatGeo(), addMat(RIFT, 0.8)); floor.position.set(cx, 0.1, cz); floor.rotation.y = a; floor.scale.set(0.2, 1, len);
  K.scene.add(sheet); K.scene.add(glow); K.scene.add(floor);
  audio.play('bladeSing', x0, z0, { v: 1.2 }); audio.play('portalOpen', cx, cz, { v: 1 });
  K.ui.flash(p, true); K.shake(p, 0.5);
  const hit = new Set();
  let gone = false, cut = false, crackT = 0;
  const cleanup = () => { if (!gone) { gone = true; K.scene.remove(sheet); K.scene.remove(glow); K.scene.remove(floor); mat.dispose(); } };
  const inLine = (e, extra = 0) => { const ex = e.position.x - x0, ez = e.position.z - z0, al = ex * dx + ez * dz, side = Math.abs(ex * dz - ez * dx); return al > -0.5 && al < len + 0.5 && side <= R.w + e.data.radius + extra; };
  const total = R.open + R.stay + 0.3;
  K.effect({ dur: total, onFrame: (dt, ef) => {
    const t = ef.t;
    const L = t < R.open * 0.5 ? len * (t / (R.open * 0.5)) : len;
    const H = t < R.open * 0.5 ? 0.06 : t < R.open + R.stay ? Math.min(3.4, 0.06 + 3.4 * (t - R.open * 0.5) / (R.open * 0.5)) : Math.max(0.01, 3.4 * (1 - (t - R.open - R.stay) / 0.3));
    const along = L / 2;
    sheet.position.set(x0 + dx * along, 1.6, z0 + dz * along); sheet.scale.set(L, H * (1 + 0.04 * Math.sin(t * 30)), 1);
    glow.position.copy(sheet.position); glow.scale.set(L * 1.08, H * 2.2 + 0.4, 1); glowM.opacity = 0.5 + 0.2 * Math.sin(t * 20);
    floor.position.set(x0 + dx * along, 0.1, z0 + dz * along); floor.scale.set(0.15 + H * 0.4, 1, L); floor.material.opacity = 0.8;
    K.glow(x0 + dx * along, z0 + dz * along, RIFT, 40);
    crackT -= dt; if (crackT <= 0 && t < R.open + R.stay) { crackT = 0.08; const s = rnd(0, L); K.vfx.sparks(v3(x0 + dx * s, rnd(0.5, 3), z0 + dz * s), Math.random() < 0.5 ? RIFT : 0xffffff, 3); }
    if (t >= R.open * 0.5 && !cut) { // a lâmina de luz parte quem está na linha
      cut = true;
      audio.play('swingHeavy', cx, cz, { v: 1 }); audio.play('zap', cx, cz, { v: 0.8 });
      for (const e of K.foes()) if (inLine(e)) { hit.add(e); K.hurt(e, R.dmg, dz, -dx, 'dmg big', p); K.fx.flare(v3(e.position.x, 1.3, e.position.z), 2.5, RIFT, 0.2); K.vfx.sparks(v3(e.position.x, 1.3, e.position.z), 0xffffff, 10); }
    }
    if (cut && t < R.open + R.stay) for (const e of K.foes()) { // a fenda aberta puxa quem está perto
      if (e.data.boss || !inLine(e, 4)) continue;
      const ex = e.position.x - x0, ez = e.position.z - z0, s = ex * dz - ez * dx, sg = Math.sign(s) || 1;
      if (Math.abs(s) < 0.4) continue;
      e.position.x -= dz * sg * R.pull * dt; e.position.z += dx * sg * R.pull * dt;
      if (e.vel) e.vel.set(0, 0, 0);
    }
  }, onEnd: () => {
    // A fenda fecha de uma vez: estalo e quem está na linha leva de novo.
    K.ui.flash(p, true); K.shake(p, 0.6);
    audio.play('bigShatter', cx, cz, { v: 0.8 }); audio.play('boom', cx, cz, { v: 0.7 });
    for (let s = 0; s <= len; s += 2) K.fx.flare(v3(x0 + dx * s, 1.5, z0 + dz * s), 2.6, RIFT, 0.2);
    for (const e of K.foes()) if (inLine(e)) K.hurt(e, R.close, dz, -dx, 'dmg', p);
    cleanup();
    K.log({ type: 'grimRift', n: hit.size });
  }, onClear: cleanup });
}

// ---------- 32) Anel Planetário ----------
function planetRock(r) {
  const g = new THREE.Group();
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color: 0x9a7ac8, emissive: 0x7a3aff, emissiveIntensity: 0.9, roughness: 0.7, flatShading: true }));
  g.add(rock);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.6, r * 0.12, 4, 24).rotateX(Math.PI / 2.4), addMat(GOLD, 0.8)); g.add(ring);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: grimTex().circle, color: VIOLET, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 })); aura.scale.setScalar(r * 3.2); g.add(aura);
  return { g, rock, ring };
}
function planetRing(K, p) {
  const R = G.ring, x0 = p.position.x, z0 = p.position.z;
  audio.play('summon', x0, z0, { v: 1 }); audio.play('spin', x0, z0, { v: 0.8 });
  K.fx.shock(x0, z0, R.r + 1, VIOLET, 0.5);
  const rocks = [];
  for (let i = 0; i < R.n; i++) { const big = i % 3 === 0, pr = planetRock(big ? 1.0 : 0.7); pr.big = big; pr.a = (i / R.n) * Math.PI * 2; pr.h = 1.2 + (i % 2) * 0.5; pr.g.scale.setScalar(0.01); K.scene.add(pr.g); rocks.push(pr); }
  const band = new THREE.Mesh(new THREE.RingGeometry(R.r - 0.5, R.r + 0.5, 64).rotateX(-Math.PI / 2), addMat(VIOLET, 0.25, null, THREE.DoubleSide)); K.scene.add(band);
  const last = new Map();
  let gone = false, ang = 0, whoosh = 0;
  const cleanup = () => { if (gone) return; gone = true; for (const r of rocks) K.scene.remove(r.g); K.scene.remove(band); };
  K.effect({ dur: R.dur, onFrame: (dt, ef) => {
    const px = p.position.x, pz = p.position.z, grow = Math.min(1, ef.t / 0.4);
    ang += R.spin * dt;
    band.position.set(px, 0.9, pz); band.rotation.y += dt; band.material.opacity = 0.25 * grow;
    whoosh -= dt; if (whoosh <= 0) { whoosh = 0.5; audio.play('swing', px, pz, { v: 0.4 }); }
    K.glow(px, pz, VIOLET, 10);
    for (const r of rocks) {
      const a = r.a + ang, x = px + Math.sin(a) * R.r * grow, z = pz + Math.cos(a) * R.r * grow;
      r.g.position.set(x, r.h + Math.sin(ef.t * 3 + r.a) * 0.15, z); r.g.scale.setScalar(grow);
      r.rock.rotation.x += dt * 2; r.rock.rotation.y += dt * 3; r.ring.rotation.z += dt;
      if (Math.random() < 0.2) { const t = sprite(K, r.big ? GOLD : VIOLET); t.position.copy(r.g.position); K.vfx.add(t, 0.35, (q, k) => { q.scale.setScalar(0.6 * (1 - k)); q.material.opacity = 0.7 * (1 - k); }); }
      for (const e of foesIn(K, x, z, r.big ? 1.2 : 0.9)) {
        if ((last.get(e) || -9) > ef.t - R.cd) continue;
        last.set(e, ef.t);
        const dx = e.position.x - px, dz = e.position.z - pz, d = Math.hypot(dx, dz) || 0.01;
        K.hurt(e, R.dmg, dx / d, dz / d, 'dmg', p);
        K.vfx.sparks(v3(e.position.x, 1.2, e.position.z), GOLD, 6); audio.play('hit', x, z, { v: 0.45 });
        if (e.alive && e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(R.push);
      }
    }
  }, onEnd: () => {
    // As rochas saem disparadas: cada uma voa no inimigo mais perto e explode.
    const foes = K.foes();
    rocks.forEach((r, i) => {
      const from = r.g.position.clone();
      let tx, tz;
      const e = foes.length ? foes[i % foes.length] : null;
      if (e) { tx = e.position.x; tz = e.position.z; } else { const a = Math.atan2(from.x - p.position.x, from.z - p.position.z); tx = from.x + Math.sin(a) * 6; tz = from.z + Math.cos(a) * 6; }
      K.scene.remove(r.g); K.vfx.add(r.g, 0.35, (o, k) => { o.position.set(from.x + (tx - from.x) * k, from.y * (1 - k) + 0.4, from.z + (tz - from.z) * k); }, );
      K.later(0.35, () => {
        K.fx.flare(v3(tx, 0.8, tz), 2.6, VIOLET, 0.2); K.fx.shock(tx, tz, R.boomR * 1.3, GOLD, 0.3); K.fx.rocks(tx, tz, 4, 0.6);
        for (const o of foesIn(K, tx, tz, R.boomR)) { const dx = o.position.x - tx, dz = o.position.z - tz, d = Math.hypot(dx, dz) || 0.01; K.hurt(o, R.boom, dx / d, dz / d, 'dmg', p); }
      });
    });
    audio.play('boom', p.position.x, p.position.z, { v: 0.6 });
    K.later(0.4, cleanup);
  }, onClear: cleanup });
}

// ---------- 33) Terremoto ----------
function earthquake(K, p) {
  const Q = G.quake, B = K.bounds(), x0 = p.position.x, z0 = p.position.z;
  audio.play('rexCrack', x0, z0, { v: 1.2 }); audio.play('mechSlam', x0, z0, { v: 1 });
  K.text('TERREMOTO!', p.position, 'crit', 3.4);
  let n = 0;
  // Tremores: a sala inteira chacoalha, racha e solta pedras do teto.
  K.effect({ dur: Q.every * Q.tremors + 0.05, tick: Q.every, onTick: () => {
    n++;
    K.shake(p, 0.6 + 0.2 * n); audio.play('boom', x0, z0, { v: 0.7 }); audio.play('crunch', x0, z0, { v: 0.6 });
    for (let i = 0; i < 6; i++) { const x = rnd(-B.x + 1, B.x - 1), z = rnd(-B.z + 1, B.z - 1); K.fx.crack(x, z, rnd(1.5, 3), 4, EARTH); K.fx.rocks(x, z, 3, 0.7); }
    for (const e of K.foes()) { K.hurt(e, Q.tremorDmg, 0, 1, 'dmg', p, true); K.vfx.dust(v3(e.position.x, 0.1, e.position.z), v3(0, 0.5, 0), 3); }
  }, onFrame: () => { if (Math.random() < 0.5) K.shake(p, 0.25); } });
  // Depois o chão se abre embaixo de cada um.
  K.later(Q.every * Q.tremors + 0.15, () => { // depois do último tremor
    for (const e of living(K)) openPit(K, p, e);
    K.shake(p, 1); audio.play('rexCrack', x0, z0, { v: 1 });
  });
}
function openPit(K, p, e) {
  const Q = G.quake;
  if (!e.alive) return;
  const boss = !!e.data.boss, x = e.position.x, z = e.position.z, r = e.data.radius + 0.7;
  const pit = new THREE.Mesh(flatGeo(), new THREE.MeshBasicMaterial({ map: grimTex().circle, color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
  pit.position.set(x, 0.09, z); pit.renderOrder = 3; K.scene.add(pit);
  const lava = floorGlow(K, x, z, r + 0.6, ROCK, Q.sink + Q.hold + 0.8, 0.55);
  K.fx.crack(x, z, r + 1.4, 4, ROCK); K.fx.rocks(x, z, 8, 1); K.fx.smoke(v3(x, 0.3, z), 5, 1.2);
  // Lascas do chão levantadas em volta do buraco.
  const slabs = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + rnd(-0.2, 0.2), s = new THREE.Mesh(new THREE.BoxGeometry(rnd(0.6, 1), 0.25, rnd(0.5, 0.8)), new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1, flatShading: true })); s.position.set(x + Math.cos(a) * (r + 0.3), 0.05, z + Math.sin(a) * (r + 0.3)); s.rotation.y = -a; s.userData.a = a; K.scene.add(s); slabs.push(s); }
  const fell = !boss && grab(e);
  if (fell) e.grimSpin = { quake: true }; else if (e.daze) e.daze(Q.sink + Q.hold);
  K.text(fell ? 'Caiu na fenda!' : 'Abalado!', e.position, 'bleed', 3);
  let done = false;
  const cleanup = () => { K.scene.remove(pit); for (const s of slabs) K.scene.remove(s); };
  const T = Q.sink + Q.hold;
  K.effect({ dur: T + 0.5, onFrame: (dt, ef) => {
    const t = ef.t, open = t < T ? Math.min(1, t / 0.2) : Math.max(0, 1 - (t - T) / 0.25);
    pit.scale.setScalar(r * 2.2 * open); pit.material.opacity = 0.92 * Math.min(1, t / 0.15);
    for (const s of slabs) { s.rotation.z = 0.6 * open; s.position.y = 0.05 + 0.25 * open; }
    if (fell && e.alive && e.state === 'lanceFly' && e.grimSpin && e.grimSpin.quake) {
      const k = Math.min(1, t / Q.sink);
      e.position.set(x + Math.sin(t * 40) * 0.05 * (1 - k), -3 * k * k, z);
      if (e.model) e.model.rotation.x = 0.4 * k;
    }
    if (t >= T && !done) { // o chão fecha: quem não aguenta fica lá embaixo
      done = true;
      K.fx.shock(x, z, r + 1.5, EARTH, 0.35); K.fx.rocks(x, z, 8, 1); K.vfx.dust(v3(x, 0.1, z), v3(0, 1, 0), 8);
      audio.play('headThud', x, z, { v: 0.9 });
      if (!e.alive) return;
      if (fell && e.state === 'lanceFly' && e.grimSpin && e.grimSpin.quake) {
        e.grimSpin = null; e.noGrave = true; e.group.visible = false;
        release(K, e, 0, 0, 0, 0, p);
        K.hurt(e, Q.dmg, 0, 1, 'dmg big', p);
        if (!e.alive) K.text('Engolido pela terra!', v3(x, 0, z), 'crit', 3.2);
        else { e.noGrave = false; e.group.visible = true; K.fx.smoke(v3(x, 0.4, z), 6, 1); K.text('Escapou!', e.position, 'block', 3); }
      } else K.hurt(e, boss ? Q.boss : Q.dmg, 0, 1, 'dmg big', p);
    }
  }, onEnd: cleanup, onClear: () => { cleanup(); if (fell && e.alive && e.state === 'lanceFly') { e.grimSpin = null; e.group.visible = true; release(K, e, 0, 0, 0, 0, p); } } });
}

export const SPELLS6 = [
  { id: 'esmagadora', name: 'Gravidade Esmagadora', color: VIOLET, cast: crushGravity },
  { id: 'espelhos', name: 'Salão de Espelhos', color: CRYS, cast: mirrorHall },
  { id: 'rasgo', name: 'Rasgo na Realidade', color: RIFT, cast: realityRift },
  { id: 'anel', name: 'Anel Planetário', color: GOLD, cast: planetRing },
  { id: 'terremoto', name: 'Terremoto', color: EARTH, cast: earthquake },
];
