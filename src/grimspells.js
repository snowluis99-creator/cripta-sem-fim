// Grimório Ancestral (lendária do Cajado Arcano): as magias do livro. Cada uma: { id, name, color, cast(K, p) }.
// K = GrimKit (grimkit.js): K.hurt (dano sem bênção nenhuma), K.foes, K.aim (melhor ponto), K.effect (efeito que dura),
// K.fx (MechFx), K.vfx, K.glow (luz colorida). Números em l1bless.js (L1.grim).
// Lote 1 (12/11/2026): Meteoro, Inferno, Era do Gelo, Julgamento, Buraco Negro, Apagar da Existência, Supernova,
// Espadas de Luz, Tornado e Mão Divina. Lote 2 em grimspells2.js (fogo/gelo) e grimspells3.js (gelo/raio); a lista
// completa (SPELLS) é montada em grimkit.js.
import * as THREE from 'three';
import { audio } from './audio.js';
import { L1 } from './l1bless.js';
import { grimTex, GOLD, PALE, VIOLET } from './grimlook.js';

const G = L1.grim;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);
const FIRE = 0xff6a1a, EMBER = 0xffb040, ICE = 0x9fe8ff, HOLY = 0xffe9a0, VOID = 0x8a2cff;
const addMat = (color, op = 1, map = null, side = THREE.FrontSide) => new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side });
const flatGeo = () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

// Decalque no chão (brilho colorido) que dura e some.
function floorGlow(K, x, z, r, color, life, op = 0.6, map = null) {
  const m = new THREE.Mesh(flatGeo(), addMat(color, 0, map || K.vfx.sparkTex));
  m.position.set(x, 0.08, z); m.scale.setScalar(r * 2); m.renderOrder = 2;
  K.vfx.add(m, life, (o, k) => { o.material.opacity = op * Math.min(1, k * 8) * (k > 0.8 ? (1 - k) / 0.2 : 1); });
  return m;
}
// Chama (sprite) que tremula no lugar.
function flame(K, x, z, size, life, color = FIRE) {
  const s = K.vfx.sprite(K.vfx.sparkTex); s.material.color.setHex(color);
  const ph = Math.random() * 7, h = rnd(0.6, 1.1);
  s.position.set(x, size * 0.45, z);
  K.vfx.add(s, life, (o, k, dt) => {
    const f = 0.75 + 0.25 * Math.sin(ph + k * life * 14) + 0.1 * Math.random();
    o.scale.set(size * 0.8 * f, size * h * 1.5 * f, 1);
    o.position.y = size * 0.55 * f;
    o.material.opacity = Math.min(1, k * life * 4) * (k > 0.85 ? (1 - k) / 0.15 : 1) * 0.9;
  });
}
// Faíscas/brasas subindo.
const embers = (K, x, y, z, n, spread, color, up = 3) => K.fx.embers(v3(x, y, z), n, spread, color, up);

// Fica preso no estado "lanceFly" (sem corpo, ninguém mexe nele: quem mexe é a magia). Chefes não.
function grab(e) {
  if (!e.alive || e.data.boss || e.immune || e.data.phantom || e.frozenT > 0) return false;
  e.releaseToken && e.releaseToken();
  if (e.atk && e.state === 'attack' && e.endAttack) e.endAttack();
  if (e.vel) e.vel.set(0, 0, 0);
  e.setState('lanceFly');
  e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.5 });
  return true;
}
function release(K, e, nx, nz, push, dmg, p) {
  if (!e.alive || e.state !== 'lanceFly') return;
  e.position.y = 0;
  if (e.model) { e.model.rotation.x = 0; e.model.rotation.z = 0; }
  e.setState('hurt'); e.stunTime = 0.7;
  if (K.c.world) K.c.world.resolveCircle(e.position, e.data.radius);
  if (e.vel) e.vel.set(nx, 0, nz).multiplyScalar(push);
  if (dmg > 0) K.hurt(e, dmg, nx, nz, 'dmg big', p);
}

// ---------- 1) Meteoro ----------
function meteor(K, p) {
  const M = G.meteor, t = K.aim(p, M.r), x = t.x, z = t.z;
  const rock = new THREE.Group();
  const core = new THREE.Mesh(new THREE.DodecahedronGeometry(1.25, 1), new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.9, emissive: 0xff4a10, emissiveIntensity: 0.9, flatShading: true }));
  rock.add(core);
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.vfx.sparkTex, color: FIRE, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  aura.scale.setScalar(5); rock.add(aura);
  const side = x > 0 ? -1 : 1, from = v3(x + side * 11, 17, z - 3), to = v3(x, 0.6, z);
  // Aviso no chão: círculo vermelho crescendo.
  const warn = new THREE.Mesh(flatGeo(), addMat(0xff3010, 0, grimTex().circle));
  warn.position.set(x, 0.1, z);
  K.vfx.add(warn, M.fall, (o, k, dt) => { o.scale.setScalar(M.r * 2 * (0.3 + 0.7 * k)); o.rotation.y += dt * 2; o.material.opacity = 0.25 + 0.5 * k; });
  let trailT = 0;
  K.vfx.add(rock, M.fall, (o, k, dt) => {
    const kk = k * k;
    o.position.lerpVectors(from, to, kk);
    core.rotation.x += dt * 4; core.rotation.y += dt * 3;
    trailT -= dt;
    if (trailT <= 0) {
      trailT = 0.02;
      K.fx.flare(o.position.clone(), rnd(2, 3.4), Math.random() < 0.5 ? FIRE : EMBER, 0.35);
      if (Math.random() < 0.5) K.fx.smoke(o.position.clone(), 1, 0.6);
    }
    if (k >= 1) impact();
  });
  audio.play('fireRoar', x, z, { v: 0.9 });
  let done = false;
  function impact() {
    if (done) return; done = true;
    K.fx.impact(x, z, 1.5, FIRE);
    K.fx.explosion(v3(x, 1.2, z), 2.4);
    K.fx.pillar(x, z, 9, 2.6, EMBER, 0.6);
    K.fx.crack(x, z, 4.2, 6, FIRE);
    K.fx.rocks(x, z, 16, 1.3);
    K.glow(x, z, FIRE, 70);
    K.shake(p, 0.7);
    audio.play('rexExplode', x, z, { v: 1.1 });
    for (const e of K.foes()) {
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      if (d > M.r + e.data.radius) continue;
      K.hurt(e, M.dmg, dx / d, dz / d, 'dmg big', p);
      if (e.alive && e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(12);
    }
    // Cratera em chamas.
    floorGlow(K, x, z, M.r * 0.9, FIRE, M.burn, 0.55);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, r = rnd(0.5, M.r * 0.8); flame(K, x + Math.cos(a) * r, z + Math.sin(a) * r, rnd(1, 1.8), M.burn); }
    K.effect({ dur: M.burn, tick: M.tick, onTick: () => {
      embers(K, x, 0.3, z, 6, M.r * 0.7, EMBER, 4);
      for (const e of K.foes()) if (Math.hypot(e.position.x - x, e.position.z - z) <= M.r * 0.9 + e.data.radius) K.hurt(e, M.burnDmg, 0, 0, 'dmg', p, true);
    } });
  }
}

// ---------- 2) Inferno ----------
function inferno(K, p) {
  const I = G.inferno, B = K.bounds(), x0 = p.position.x, z0 = p.position.z;
  const R = Math.hypot(B.x, B.z) * 1.1;
  K.fx.shock(x0, z0, R, FIRE, 0.9);
  K.fx.shock(x0, z0, R * 0.7, EMBER, 0.7, 0.25);
  K.fx.flare(v3(x0, 1.2, z0), 9, FIRE, 0.5);
  K.glow(x0, z0, FIRE, 60);
  K.shake(p, 0.5);
  audio.play('fireRoar', x0, z0, { v: 1.4 });
  audio.play('boom', x0, z0, { v: 0.7 });
  // O chão da sala inteira pega fogo (a onda vai acendendo do centro para fora).
  const floor = new THREE.Mesh(flatGeo(), addMat(0xff4a10, 0));
  floor.position.set(0, 0.06, 0); floor.scale.set(B.x * 2, 1, B.z * 2);
  K.vfx.add(floor, I.dur, (o, k) => { o.material.opacity = 0.22 * Math.min(1, k * 6) * (k > 0.85 ? (1 - k) / 0.15 : 1) * (0.85 + 0.15 * Math.sin(k * 60)); });
  const step = 2.2;
  for (let gx = -B.x + 1; gx <= B.x - 1; gx += step) for (let gz = -B.z + 1; gz <= B.z - 1; gz += step) {
    const fx = gx + rnd(-0.8, 0.8), fz = gz + rnd(-0.8, 0.8);
    if (K.c.world && K.c.world.blocked(fx, fz, 0.3)) continue;
    const delay = Math.hypot(fx - x0, fz - z0) / 18;
    K.later(delay, () => flame(K, fx, fz, rnd(1.1, 2.0), I.dur - delay, Math.random() < 0.3 ? EMBER : FIRE));
  }
  for (const e of K.foes()) K.hurt(e, I.dmg, 0, 0, 'dmg', p);
  K.effect({ dur: I.dur, tick: I.tick, onTick: () => {
    for (let i = 0; i < 4; i++) embers(K, rnd(-B.x, B.x), 0.3, rnd(-B.z, B.z), 3, 0.5, EMBER, 4);
    for (const e of K.foes()) { K.hurt(e, I.tickDmg, 0, 0, 'dmg', p, true); if (Math.random() < 0.5) embers(K, e.position.x, 1, e.position.z, 3, 0.4, FIRE, 3); }
  }, onFrame: () => K.glow(p.position.x, p.position.z, FIRE, 10) });
}

// ---------- 3) Era do Gelo ----------
function iceAge(K, p) {
  const I = G.ice, B = K.bounds(), x0 = p.position.x, z0 = p.position.z, R = Math.hypot(B.x, B.z) * 1.1;
  K.fx.shock(x0, z0, R, ICE, 1.0);
  K.fx.shock(x0, z0, R * 0.6, PALE, 0.7, 0.25);
  K.fx.flare(v3(x0, 1.2, z0), 8, ICE, 0.5);
  K.glow(x0, z0, ICE, 60);
  audio.play('iceWave', x0, z0, { v: 1.4 });
  audio.play('bigShatter', x0, z0, { v: 0.6 });
  // Chão vira gelo.
  const floor = new THREE.Mesh(flatGeo(), addMat(0x6fc8ff, 0, K.vfx.iceTex));
  floor.position.set(0, 0.07, 0); floor.scale.set(B.x * 2.4, 1, B.z * 2.4);
  K.vfx.add(floor, I.freeze + 0.8, (o, k) => { o.material.opacity = 0.35 * Math.min(1, k * 5) * (k > 0.8 ? (1 - k) / 0.2 : 1); });
  // Neve caindo na sala.
  for (let i = 0; i < 60; i++) {
    const s = K.vfx.sprite(K.vfx.iceTex); const sx = rnd(-B.x, B.x), sz = rnd(-B.z, B.z), y0 = rnd(4, 9), sp = rnd(1.5, 3), sc = rnd(0.12, 0.28);
    s.position.set(sx, y0, sz);
    K.vfx.add(s, I.freeze, (o, k) => { o.position.y = Math.max(0.1, y0 - sp * k * I.freeze); o.position.x = sx + Math.sin(k * 12 + sx) * 0.3; o.scale.setScalar(sc); o.material.opacity = k > 0.8 ? (1 - k) / 0.2 : 1; });
  }
  const shard = new THREE.ConeGeometry(0.28, 1.6, 5);
  for (const e of K.foes()) {
    const d = Math.hypot(e.position.x - x0, e.position.z - z0);
    K.later(d / 30, () => {
      if (!e.alive) return;
      K.hurt(e, I.dmg, 0, 0, 'dmg', p);
      if (e.alive && e.freeze) e.freeze(e.data.boss ? I.boss : I.freeze, K.c);
      // Cristais de gelo brotando em volta.
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + rnd(-0.3, 0.3), r = e.data.radius + rnd(0.2, 0.6), h = rnd(0.8, 1.6);
        const m = new THREE.Mesh(shard, new THREE.MeshStandardMaterial({ color: 0xbfefff, emissive: 0x3a9fff, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, roughness: 0.2 }));
        m.position.set(e.position.x + Math.cos(a) * r, 0, e.position.z + Math.sin(a) * r);
        m.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        K.vfx.add(m, I.freeze, (o, k) => { const up = Math.min(1, k * I.freeze * 6); o.scale.set(1, h * up, 1); o.position.y = 0.8 * h * up * 0.5; o.material.opacity = 0.85 * (k > 0.85 ? (1 - k) / 0.15 : 1); });
      }
      K.vfx.sparks(v3(e.position.x, 1.2, e.position.z), 0xdff6ff, 10);
    });
  }
}

// ---------- 4) Julgamento ----------
function judgment(K, p) {
  const J = G.judgment, foes = K.foes();
  K.ui.dim(0.9);
  audio.play('thunder', p.position.x, p.position.z, { v: 1.5 });
  K.fx.skyBeam(p.position.x, p.position.z, 1.2, 0.5, HOLY);
  const strike = (x, z, e) => {
    K.fx.skyBeam(x, z, 1.6, 0.55, HOLY);
    for (let i = 0; i < 2; i++) K.vfx.lightning(v3(x + rnd(-1.5, 1.5), 16, z + rnd(-1.5, 1.5)), v3(x, 0.3, z), i ? 0xffffff : GOLD, i ? 0.25 : 0.45);
    K.fx.shock(x, z, 3, HOLY, 0.45);
    K.fx.crack(x, z, 1.8, 4, GOLD);
    K.fx.flare(v3(x, 1.2, z), 4, HOLY, 0.3);
    K.vfx.sparks(v3(x, 1, z), GOLD, 10);
    audio.play('zap', x, z, { v: 0.8 });
    if (e && e.alive) K.hurt(e, J.dmg, 0, 1, 'dmg big', p);
  };
  if (!foes.length) { for (let i = 0; i < 6; i++) { const a = rnd(0, 6.28), r = rnd(3, 8); K.later(i * 0.07, () => strike(p.position.x + Math.cos(a) * r, p.position.z + Math.sin(a) * r)); } return; }
  foes.forEach((e, i) => K.later(0.12 + i * 0.05, () => { if (e.alive) strike(e.position.x, e.position.z, e); }));
  K.later(0.12, () => { K.shake(p, 0.6); K.glow(p.position.x, p.position.z, HOLY, 70); });
}

// ---------- 5) Buraco Negro ----------
function blackHole(K, p) {
  const H = G.hole, t = K.aim(p, 6), x = t.x, z = t.z, y = 1.7;
  const g = new THREE.Group(); g.position.set(x, y, z);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  g.add(ball);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), addMat(VOID, 0.55, null, THREE.BackSide)); g.add(halo);
  const diskTex = K.vfx.ringTex;
  const disk = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), addMat(0xff8a3a, 0.9, diskTex, THREE.DoubleSide)); disk.rotation.x = -Math.PI / 2 + 0.35; g.add(disk);
  const disk2 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), addMat(VOID, 0.9, diskTex, THREE.DoubleSide)); disk2.rotation.x = -Math.PI / 2 + 0.35; g.add(disk2);
  const swirl = new THREE.Mesh(flatGeo(), addMat(0x5a10c0, 0, grimTex().circle)); swirl.position.set(x, 0.09, z);
  K.vfx.add(swirl, H.dur + 0.4, (o, k, dt) => { o.scale.setScalar(H.r * 2 * Math.min(1, k * 4)); o.rotation.y -= dt * 3; o.material.opacity = 0.5 * (k > 0.85 ? (1 - k) / 0.15 : 1); });
  audio.play('portalOpen', x, z, { v: 1.2 });
  let sz = 0, pT = 0, collapsing = false;
  K.vfx.add(g, H.dur + 0.35, (o, k, dt) => {
    const T = k * (H.dur + 0.35);
    if (T < H.dur) sz = Math.min(1.25, sz + dt * 3); else { collapsing = true; sz = Math.max(0.01, sz - dt * 6); }
    ball.scale.setScalar(sz); halo.scale.setScalar(sz * (1 + 0.08 * Math.sin(T * 20)));
    disk.scale.setScalar(sz * 5.2); disk2.scale.setScalar(sz * 4.2);
    disk.rotation.z += dt * 5; disk2.rotation.z -= dt * 7;
    pT -= dt;
    if (!collapsing && pT <= 0) { // poeira e luz sendo sugadas em espiral
      pT = 0.03;
      const a = rnd(0, 6.28), r = rnd(5, H.r), s = K.vfx.sprite(K.vfx.sparkTex); s.material.color.setHex(Math.random() < 0.5 ? VOID : 0xff9a50);
      const sc = rnd(0.2, 0.45);
      K.vfx.add(s, 0.7, (q, kk) => { const rr = r * (1 - kk), aa = a + kk * 5; q.position.set(x + Math.cos(aa) * rr, y + (1 - kk) * rnd(-0.5, 0.5), z + Math.sin(aa) * rr); q.scale.setScalar(sc * (1 - kk * 0.6)); q.material.opacity = Math.min(1, kk * 4); });
    }
  });
  K.effect({ dur: H.dur, tick: H.tick, onTick: () => {
    for (const e of K.foes()) if (Math.hypot(e.position.x - x, e.position.z - z) <= H.r + e.data.radius) K.hurt(e, H.tickDmg, 0, 0, 'dmg', p, true);
  }, onFrame: (dt) => {
    K.glow(x, z, VOID, 18);
    for (const e of K.foes()) { // puxa todo mundo para o centro (chefe só um pouco)
      const dx = x - e.position.x, dz = z - e.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > H.r + e.data.radius || d < 0.5) continue;
      if (!e.data.boss && e.state !== 'hurt') e.daze && e.daze(H.dur);
      const sp = H.pull * (e.data.boss ? 0.2 : 1) * (0.5 + 0.5 * (1 - d / H.r));
      e.position.x += dx / d * Math.min(d - 0.4, sp * dt); e.position.z += dz / d * Math.min(d - 0.4, sp * dt);
      if (e.vel) e.vel.set(0, 0, 0);
    }
  }, onEnd: () => K.later(0.3, () => { // colapso: implosão
    K.fx.flare(v3(x, y, z), 12, PALE, 0.35);
    K.fx.shock(x, z, H.boomR * 1.4, VOID, 0.6);
    K.fx.shock(x, z, H.boomR, 0xff9a50, 0.45, 0.25);
    K.fx.crack(x, z, 3.5, 5, VOID);
    K.fx.rocks(x, z, 14, 1.1);
    K.vfx.sparks(v3(x, 1.5, z), VOID, 20);
    K.glow(x, z, VOID, 80);
    K.shake(p, 0.8);
    audio.play('boom', x, z, { v: 1.3 }); audio.play('bigShatter', x, z, { v: 0.8 });
    for (const e of K.foes()) {
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      if (d > H.boomR + e.data.radius) continue;
      K.hurt(e, H.boom, dx / d, dz / d, 'dmg big', p);
      if (e.alive && e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(14);
    }
  }) });
}

// ---------- 6) Apagar da Existência ----------
function erase(K, p) {
  const E = G.erase, foes = K.foes();
  if (!foes.length) { K.fx.rune(p.position.x, p.position.z, 2, 0.8); return; }
  const target = foes.reduce((a, b) => ((b.data.boss ? 1e6 : 0) + b.hp > (a.data.boss ? 1e6 : 0) + a.hp ? b : a));
  const boss = !!(target.data.boss || target.immune || target.data.phantom);
  const x = target.position.x, z = target.position.z, model = target.model, s0 = model ? model.scale.clone() : null;
  K.text('APAGAR', target.position, 'crit', 3.6);
  audio.play('spell', x, z, { v: 1.2 }); audio.play('summon', x, z, { v: 0.8 });
  // Runa branca no chão e coluna de luz que vai apagando o inimigo de baixo para cima.
  const rune = new THREE.Mesh(flatGeo(), addMat(0xffffff, 0, grimTex().circle)); rune.position.set(x, 0.1, z);
  K.vfx.add(rune, E.dur + 0.3, (o, k, dt) => { o.scale.setScalar(3.6 * Math.min(1, k * 5)); o.rotation.y += dt * 4; o.material.opacity = 0.9 * (k > 0.8 ? (1 - k) / 0.2 : 1); });
  K.fx.skyBeam(x, z, 1.3, E.dur + 0.2, 0xffffff);
  const hold = { x, z };
  if (!boss) { target.daze && target.daze(E.dur + 0.5); }
  let bitT = 0;
  K.effect({ dur: E.dur, onFrame: (dt, ef) => {
    const k = ef.t / E.dur;
    if (!target.alive) return;
    if (!boss) { target.position.x = hold.x; target.position.z = hold.z; if (target.vel) target.vel.set(0, 0, 0); }
    target.flash = 1;
    if (model && !boss) model.scale.set(s0.x * (1 - k * 0.92), s0.y * (1 + k * 0.6), s0.z * (1 - k * 0.92)); // esticado e fino, sumindo
    bitT -= dt;
    if (bitT <= 0) { // pedacinhos dele virando luz e subindo
      bitT = 0.025;
      const s = K.vfx.sprite(Math.random() < 0.5 ? grimTex().runes : K.vfx.sparkTex); s.material.color.setHex(Math.random() < 0.6 ? 0xffffff : 0x111111);
      if (Math.random() < 0.4) s.material.blending = THREE.NormalBlending;
      const ox = rnd(-0.6, 0.6), oz = rnd(-0.6, 0.6), y0 = rnd(0.2, 2.4), sc = rnd(0.12, 0.3);
      K.vfx.add(s, 0.9, (q, kk) => { q.position.set(x + ox * (1 - kk), y0 + kk * 4, z + oz * (1 - kk)); q.scale.setScalar(sc * (1 - kk)); q.material.opacity = 1 - kk; });
    }
  }, onEnd: () => {
    if (model && s0) model.scale.copy(s0);
    K.fx.flare(v3(x, 1.3, z), 9, 0xffffff, 0.4);
    K.fx.shock(x, z, 4, 0xffffff, 0.4);
    K.glow(x, z, 0xffffff, 70);
    K.shake(p, 0.4);
    audio.play('bigShatter', x, z, { v: 1 });
    if (!target.alive) return;
    if (boss) { K.hurt(target, Math.round(target.maxHp * E.boss), 0, 1, 'dmg big', p); K.text('Parte dele deixou de existir!', target.position, 'crit', 4); return; }
    K.text('APAGADO DA EXISTÊNCIA', target.position, 'crit', 3.8);
    target.noGrave = true; target.blasted = true;
    if (target.weapons) { for (const w of target.weapons) if (w.parent) w.parent.remove(w); target.weapons.length = 0; }
    K.hurt(target, Math.ceil(target.hp) + 1, 0, 1, 'dmg big', p);
    target.group.visible = false; // não sobra nada (nem corpo, nem arma, nem túmulo)
  } });
}

// ---------- 7) Supernova ----------
function supernova(K, p) {
  const N = G.nova;
  audio.play('charge', p.position.x, p.position.z, { v: 1.2 });
  const core = K.vfx.sprite(K.vfx.sparkTex); core.material.color.setHex(0xfff2c0);
  K.vfx.add(core, N.charge, (o, k) => { o.position.set(p.position.x, 1.3, p.position.z); o.scale.setScalar(0.5 + k * 3.5); o.material.opacity = 0.6 + 0.4 * Math.random(); });
  for (let i = 0; i < 40; i++) { // luz sendo puxada para dentro dela
    const a = rnd(0, 6.28), r = rnd(4, 9), h = rnd(0, 3), s = K.vfx.sprite(K.vfx.sparkTex); s.material.color.setHex(i % 3 ? GOLD : VIOLET);
    const sc = rnd(0.15, 0.35);
    K.vfx.add(s, N.charge, (o, k) => { const rr = r * (1 - k); o.position.set(p.position.x + Math.cos(a + k * 2) * rr, 1.3 + (h - 1.3) * (1 - k), p.position.z + Math.sin(a + k * 2) * rr); o.scale.setScalar(sc); o.material.opacity = Math.min(1, k * 3); });
  }
  K.later(N.charge, () => {
    const x = p.position.x, z = p.position.z;
    K.fx.flare(v3(x, 1.4, z), 18, 0xffffff, 0.45);
    K.fx.flare(v3(x, 1.4, z), 12, GOLD, 0.7);
    K.fx.shock(x, z, N.r, GOLD, 0.7);
    K.fx.shock(x, z, N.r * 0.75, 0xffffff, 0.5, 0.25);
    K.fx.shock(x, z, N.r * 1.25, VIOLET, 0.9, 0.3);
    K.fx.pillar(x, z, 14, 3.5, PALE, 0.6);
    K.fx.crack(x, z, 5, 6, GOLD);
    K.fx.rocks(x, z, 20, 1.5);
    K.vfx.sparks(v3(x, 1.4, z), GOLD, 26);
    K.ui.flash(p);
    K.glow(x, z, GOLD, 90);
    K.shake(p, 0.9);
    audio.play('mechExplode', x, z, { v: 1.2 });
    for (const e of K.foes()) {
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      if (d > N.r + e.data.radius) continue;
      K.hurt(e, N.dmg, dx / d, dz / d, 'dmg big', p);
      if (e.alive && e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(N.push);
    }
  });
}

// ---------- 8) Espadas de Luz ----------
let swordGeo = null;
function makeSword() {
  if (!swordGeo) {
    const blade = new THREE.CylinderGeometry(0.02, 0.14, 2.4, 4).translate(0, -1.2, 0); // ponta para baixo
    const guard = new THREE.BoxGeometry(0.75, 0.1, 0.14).translate(0, 0.02, 0);
    const grip = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6).translate(0, 0.32, 0);
    const pom = new THREE.SphereGeometry(0.09, 8, 6).translate(0, 0.6, 0);
    swordGeo = [blade, guard, grip, pom];
  }
  const g = new THREE.Group();
  swordGeo.forEach((geo, i) => g.add(new THREE.Mesh(geo, addMat(i === 0 ? 0xfff6d8 : GOLD, 0.95))));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: K_spark, color: HOLY, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(0.9, 3, 1); glow.position.y = -0.8; g.add(glow);
  return g;
}
let K_spark = null;
function swords(K, p) {
  const S = G.swords, foes = K.foes();
  K_spark = K.vfx.sparkTex;
  audio.play('bladeSing', p.position.x, p.position.z, { v: 1.1 });
  K.fx.skyBeam(p.position.x, p.position.z, 1, 0.4, HOLY);
  for (let i = 0; i < S.n; i++) {
    const e = foes.length ? foes[i % foes.length] : null;
    const a = p.facing + rnd(-0.7, 0.7), r = rnd(2.5, 9);
    const delay = (i / S.n) * S.over;
    K.later(delay, () => {
      const tx = e && e.alive ? e.position.x + rnd(-0.5, 0.5) : p.position.x + Math.sin(a) * r;
      const tz = e && e.alive ? e.position.z + rnd(-0.5, 0.5) : p.position.z + Math.cos(a) * r;
      const sw = makeSword(), tilt = rnd(-0.25, 0.25), yaw = rnd(0, 6.28), fall = 0.22;
      sw.scale.setScalar(1.45);
      sw.rotation.set(tilt, yaw, 0);
      let landed = false;
      K.vfx.add(sw, 2.6, (o, k) => {
        const T = k * 2.6;
        if (T < fall) { o.position.set(tx, 2.8 + 16 * (1 - T / fall), tz); return; }
        o.position.set(tx, 2.6, tz); // cravada no chão
        if (!landed) {
          landed = true;
          K.fx.shock(tx, tz, 1.8, HOLY, 0.3); K.fx.flare(v3(tx, 0.8, tz), 2.4, HOLY, 0.2); K.vfx.sparks(v3(tx, 0.4, tz), GOLD, 5);
          K.fx.crack(tx, tz, 0.9, 3, GOLD);
          audio.play('hit', tx, tz, { v: 0.6 });
          for (const f of K.foes()) if (Math.hypot(f.position.x - tx, f.position.z - tz) <= S.r + f.data.radius) K.hurt(f, S.dmg, 0, 1, 'dmg', p);
        }
        const fade = k > 0.8 ? (1 - k) / 0.2 : 1;
        o.traverse((m) => { if (m.material) m.material.opacity = 0.95 * fade; });
      });
    });
  }
}

// ---------- 9) Tornado ----------
let WIND = null;
function windTex() { // listras de vento (claras e transparentes) para o funil
  if (WIND) return WIND;
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const y = Math.random() * 64, w = 40 + Math.random() * 140, x = Math.random() * 256, a = 0.25 + Math.random() * 0.6;
    const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = gr; g.lineWidth = 2 + Math.random() * 5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + (Math.random() - 0.5) * 6); g.stroke();
  }
  WIND = new THREE.CanvasTexture(c); WIND.wrapS = THREE.RepeatWrapping; WIND.colorSpace = THREE.SRGBColorSpace;
  return WIND;
}
function tornado(K, p) {
  const T = G.tornado, pos = v3(p.position.x + Math.sin(p.facing) * 2.5, 0, p.position.z + Math.cos(p.facing) * 2.5);
  const g = new THREE.Group(); g.position.copy(pos);
  const layers = [];
  const streak = windTex();
  for (let i = 0; i < 8; i++) {
    const h = 1.25, y = i * 1.0, rb = 0.45 + i * 0.36, rt = rb + 0.36;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 22, 1, true), new THREE.MeshBasicMaterial({ map: streak, color: i % 2 ? 0xe6e0f6 : 0xb7a8e0, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }));
    m.position.y = y + h / 2; m.rotation.y = i; g.add(m); layers.push(m);
  }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.25, 8, 16, 1, true), addMat(VIOLET, 0.35, streak, THREE.DoubleSide)); core.position.y = 4; g.add(core); layers.push(core);
  const debris = [];
  for (let i = 0; i < 10; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rnd(0.12, 0.3), 0), new THREE.MeshLambertMaterial({ color: 0x4a4650 })); g.add(r); debris.push({ m: r, a: rnd(0, 6.28), h: rnd(0.5, 6), r: rnd(0.8, 2.4), sp: rnd(4, 8) }); }
  audio.play('spin', pos.x, pos.z, { v: 1.2 }); audio.play('rexWhirl', pos.x, pos.z, { v: 0.8 });
  const held = new Set();
  let dustT = 0, wander = p.facing;
  K.vfx.add(g, T.dur + 0.4, (o, k, dt) => {
    const grow = Math.min(1, k * 6) * (k > 0.92 ? (1 - k) / 0.08 : 1);
    o.scale.set(grow, grow, grow);
    layers.forEach((m, i) => { m.rotation.y += dt * (7 + i * 1.2); m.material.opacity = (i === layers.length - 1 ? 0.35 : 0.62) + 0.12 * Math.sin(k * 40 + i); });
    for (const d of debris) { d.a += d.sp * dt; d.m.position.set(Math.cos(d.a) * d.r, d.h, Math.sin(d.a) * d.r); d.m.rotation.x += dt * 5; }
    dustT -= dt;
    if (dustT <= 0) { dustT = 0.08; K.vfx.dust(o.position.clone(), v3(0, 1, 0), 2); }
  });
  K.effect({ dur: T.dur, tick: T.tick, onTick: () => {
    for (const e of K.foes()) if (e.data.boss && Math.hypot(e.position.x - g.position.x, e.position.z - g.position.z) <= T.r + e.data.radius) K.hurt(e, T.tickDmg, 0, 0, 'dmg', p, true);
    for (const e of held) e.grimPending = (e.grimPending || 0) + T.tickDmg;
  }, onFrame: (dt, ef) => {
    // Anda atrás do grupo de inimigos mais perto, balançando.
    const foes = K.foes().filter((e) => !held.has(e));
    let tx = null, tz = null, best = Infinity;
    for (const e of foes) { const d = Math.hypot(e.position.x - g.position.x, e.position.z - g.position.z); if (d < best) { best = d; tx = e.position.x; tz = e.position.z; } }
    if (tx !== null) wander = Math.atan2(tx - g.position.x, tz - g.position.z) + Math.sin(ef.t * 3) * 0.5; else wander += Math.sin(ef.t * 2) * dt * 2;
    const nx = g.position.x + Math.sin(wander) * T.speed * dt, nz = g.position.z + Math.cos(wander) * T.speed * dt;
    if (!K.c.world || !K.c.world.blocked(nx, nz, 1)) { g.position.x = nx; g.position.z = nz; } else wander += Math.PI * 0.6;
    // Suga quem encostar (chefes só levam dano).
    for (const e of foes) if (!e.data.boss && Math.hypot(e.position.x - g.position.x, e.position.z - g.position.z) <= T.r + e.data.radius && grab(e)) { held.add(e); e.grimSpin = { a: rnd(0, 6.28), h: rnd(1, 4.5), r: rnd(0.7, 1.6) }; K.text('Sugado!', e.position, 'block', 3); }
    for (const e of held) { // girando dentro do tornado
      if (!e.alive || e.state !== 'lanceFly') { held.delete(e); continue; }
      const s = e.grimSpin; s.a += dt * 8; s.h = Math.min(5, s.h + dt * 0.6);
      e.position.set(g.position.x + Math.cos(s.a) * s.r, s.h, g.position.z + Math.sin(s.a) * s.r);
      e.group.rotation.y += dt * 12; if (e.model) e.model.rotation.x = -0.6;
    }
  }, onEnd: () => {
    for (const e of held) { const a = rnd(0, 6.28), dmg = (e.grimPending || 0) + T.toss; e.grimPending = 0; release(K, e, Math.cos(a), Math.sin(a), 16, dmg, p); }
    held.clear();
    K.vfx.dust(g.position.clone(), v3(0, 1, 0), 10);
  } });
}

// ---------- 10) Mão Divina ----------
function makeHand() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xc77a10, emissiveIntensity: 0.7, roughness: 0.35, metalness: 0.5, transparent: true, opacity: 1 });
  const palm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 2.4), mat); g.add(palm);
  const fing = (x, z, len, ang) => { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, len, 4, 8), mat); f.rotation.x = Math.PI / 2; f.position.set(x, 0, z + len / 2 + 1.1); f.rotation.y = ang; g.add(f); };
  fing(-0.9, 0, 1.5, 0.08); fing(-0.3, 0.1, 1.8, 0.02); fing(0.3, 0.1, 1.7, -0.02); fing(0.9, 0, 1.3, -0.08);
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.2, 4, 8), mat); th.rotation.z = Math.PI / 2; th.rotation.y = -0.6; th.position.set(-1.8, 0, -0.2); g.add(th);
  const wrist = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 2.6, 12), mat); wrist.rotation.x = Math.PI / 2; wrist.position.z = -2.3; g.add(wrist);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: K_spark, color: HOLY, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(6); glow.material.opacity = 0.5; g.add(glow);
  g.scale.setScalar(1.35);
  return { g, mat, glow };
}
function divineHand(K, p) {
  const H = G.hand, t = K.aim(p, H.r), x = t.x, z = t.z;
  K_spark = K.vfx.sparkTex;
  const hand = makeHand();
  // Palma para baixo, dedos apontando para longe da Maga.
  hand.g.rotation.y = Math.atan2(x - p.position.x, z - p.position.z);
  K.fx.skyBeam(x, z, 1.6, H.fall + 0.2, HOLY);
  const shadow = new THREE.Mesh(flatGeo(), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false })); shadow.position.set(x, 0.09, z);
  K.vfx.add(shadow, H.fall + 0.3, (o, k) => { o.scale.set(6 * k + 1, 1, 7 * k + 1); o.material.opacity = 0.45 * Math.min(1, k * 1.5) * (k > 0.85 ? (1 - k) / 0.15 : 1); });
  K.fx.rune(x, z, H.r, H.fall + 0.3);
  audio.play('bell', x, z, { v: 1 });
  let hit = false;
  const life = H.fall + 1.1;
  K.vfx.add(hand.g, life, (o, k) => {
    const T = k * life;
    if (T < H.fall) { const kk = T / H.fall; o.position.set(x, 22 - 20.6 * kk * kk, z); }
    else if (T < H.fall + 0.45) { o.position.set(x, 1.4, z); if (!hit) { hit = true; slam(); } }
    else { const kk = (T - H.fall - 0.45) / 0.65; o.position.set(x, 1.4 + kk * 12, z); hand.mat.opacity = 1 - kk; hand.glow.material.opacity = 0.5 * (1 - kk); }
  });
  function slam() {
    K.fx.impact(x, z, 2, GOLD);
    K.fx.crack(x, z, 5.5, 7, GOLD);
    K.fx.shock(x, z, H.r * 2, HOLY, 0.6);
    K.fx.rocks(x, z, 22, 1.5);
    K.fx.flare(v3(x, 1.5, z), 12, HOLY, 0.4);
    K.ui.flash(p, true);
    K.glow(x, z, GOLD, 90);
    K.shake(p, 1.0);
    audio.play('mechSlam', x, z, { v: 1.3 }); audio.play('boom', x, z, { v: 1 });
    for (const e of K.foes()) {
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      if (d <= H.r + e.data.radius) K.hurt(e, H.dmg, dx / d, dz / d, 'dmg big', p);
      else if (d <= H.r * 2 && e.daze && !e.data.boss) e.daze(1.0); // o chão treme: quem está perto fica tonto
    }
  }
}

export const SPELLS1 = [
  { id: 'meteoro', name: 'Meteoro', color: FIRE, cast: meteor },
  { id: 'inferno', name: 'Inferno', color: FIRE, cast: inferno },
  { id: 'gelo', name: 'Era do Gelo', color: ICE, cast: iceAge },
  { id: 'julgamento', name: 'Julgamento', color: GOLD, cast: judgment },
  { id: 'buraco', name: 'Buraco Negro', color: VOID, cast: blackHole },
  { id: 'apagar', name: 'Apagar da Existência', color: 0xffffff, cast: erase },
  { id: 'supernova', name: 'Supernova', color: GOLD, cast: supernova },
  { id: 'espadas', name: 'Espadas de Luz', color: HOLY, cast: swords },
  { id: 'tornado', name: 'Tornado', color: 0xcfc3e8, cast: tornado },
  { id: 'mao', name: 'Mão Divina', color: GOLD, cast: divineHand },
];
export { release as grimRelease };
// Ajudantes usados pelos outros lotes (grimspells2.js, grimspells3.js).
export { G as GRIM, v3, rnd, FIRE, EMBER, ICE, HOLY, VOID, addMat, flatGeo, floorGlow, flame, embers, grab, release, windTex };
