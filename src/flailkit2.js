// Mangual e Escudo, 2ª leva (lista do dono, 09/11/2026): as regras. O visual está em flailprops2.js.
// Laço de Ferro, Algemas, Strike!, Bola Faminta, Bola de Ossos, Cometa, Martelo Olímpico, Bola no Poste,
// Bola de Canhão, Gaiola de Correntes, Sino da Catedral, Escudo Coletor, Panela de Pressão, Hidra.
// Sem import de combat.js: o combate cria o kit (combat.flail2) e chama os ganchos (strike, afterStrike, onHit,
// onKill, onBlock, onHurt, dmgMul, rangeMul, tick, afterMove, clear). player.js chama as funções do herói
// (flail2HoldCheck, flail2Press, flail2BlockPress, flail2StartDodge, flail2StateTick, flail2Reset).
import * as THREE from 'three';
import { audio } from './audio.js';
import { instance } from './assets.js';
import { getClip } from './animation.js';
import { isFlail } from './flailkit.js';
import { knockDown } from './axekit3.js';
import { grabbable } from './fistkit.js';
import { sitDown } from './fistkit2.js';
import { dizzyStars, spinStars, dispose } from './rapprops2.js';
import { rope, setRope, spikeBall, faceParts, cageMesh, bellMesh, meteorMesh, targetRing, stuckShot, slickDisc } from './flailprops2.js';

export const FLAIL2 = {
  lasso: { r: 2.3, time: 1.1, turn: 0.42, hit: 10, speed: 20, dist: 9, path: 12, land: 14 },          // Laço de Ferro
  cuffs: { life: 5, max: 3.6, every: 1.4, yank: 13, bump: 6, stun: 0.7, share: 0.5, pairs: 3 },      // Algemas
  bowl: { speed: 15, dist: 3.5, path: 8, window: 1.2, need: 5, coins: 5 },                          // Strike!
  hungry: { idle: 2, range: 4.2, every: 1.2, dmg: 8, pull: 6, out: 0.14, hold: 0.06, back: 0.18 },  // Bola Faminta
  bones: { max: 10, range: 0.03, dmg: 0.05, size: 0.07, lose: 2 },                                  // Bola de Ossos
  comet: { red: 4, white: 8, max: 10, wait: 1.5, decay: 2, fall: 1.0, dmg: 30, r: 3, ahead: 5, reach: 9 }, // Cometa
  hammer: { delay: 0.22, r0: 1.7, r1: 2.9, turns: 3, dizzyAt: 4.5, dizzy: 1.0, t0: 0.7, t1: 0.35, hit: 6, hitPer: 3, move: 0.45,
    speed: 22, d0: 4, dPer: 2, fly: 10, flyPer: 4, back: 18, grab: 1.3, drag: 3, drop: 8, dropStun: 1.0, life: 6, leash: 13 }, // Martelo Olímpico
  pole: { turns: 2, time: 0.9, rMin: 1.8, rMax: 3.4, kick: 10, reach: 3.6, cd: 2.5 },                // Bola no Poste
  cannon: { dist: 7.5, min: 1.5, out: 0.12, speed: 26, r: 2.0, dmg: 10, path: 6 },                    // Bola de Canhão
  cage: { r: 4.2, life: 5, cd: 10, ahead: 1.2 },                                                    // Gaiola de Correntes
  bell: { cd: 6, rush: 2.0, speed: 7, near: 2.6, stun: 1.5, boss: 0.6, show: 0.9 },                 // Sino da Catedral
  collect: { max: 6, fan: 70, speed: 22, dmg: 10 },                                                 // Escudo Coletor
  steam: { need: 5, r: 4, push: 14, stun: 0.4, life: 4, sit: 1.4, again: 2.5 },                     // Panela de Pressão
  hydra: { heads: 3, reach: 9, out: 0.22, hold: 0.05, back: 0.25, dmg: 12, miss: 5, chain: 0.55 },  // Hidra
};
const SPIN = 'Melee_2H_Attack_Spinning';
export const FLAIL2_STATES = ['flailSpin', 'flailFly', 'flailOrbit', 'flailDizzy'];
export const BELL_STEP = { clip: 'Melee_Block_Attack', speed: 1.4, hit: 0.35, end: 0.8, lunge: 0, damage: 0, keepFacing: true, flail2: 'bell' };
const BUSY = new Set(['held', 'thrown', 'spawn', 'rage', 'dead', 'spinMove', 'spinGather', 'spin', 'roll', 'hop', 'leap', 'headless', 'axeAir', 'axeDown', 'tpOut', 'tpIn', 'lanceHeld', 'lanceFly', 'fistHeld', 'fistFly', 'fistSit']);
const DEG = Math.PI / 180;
const W = (p) => (p && p.stats && p.stats.w) || {};
const has = (p, k) => isFlail(p) && !!W(p)[k];
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const tmp = new THREE.Vector3();
const canGrab = (e) => grabbable(e) && !BUSY.has(e.state);
let K = null;

// ---------- Herói (player.js) ----------
const F = (p) => p.f2 || (p.f2 = { hits: [], seq: -1, heat: 0, heatIdle: 9, heatSeq: -1, idleT: 0, biteT: 0, bones: [], bellCd: 0, cageCd: 0, poleCd: 0, pressure: 0, shots: [] });

// Troca de arma/herói, partida nova: solta tudo que estava com o herói.
export function flail2Reset(p) {
  if (K) K.dropFor(p);
  const f = p.f2;
  if (f) { for (const m of f.bones) m.removeFromParent(); for (const s of f.shots) s.m.removeFromParent(); }
  const fl = p.weapon && p.weapon.userData.flail;
  if (fl) { // bola volta ao normal (Bola de Ossos / Cometa)
    fl.ball.scale.setScalar(1);
    const body = fl.ball.children[0];
    if (body && body.material && body.material.emissive) { body.material.emissive.setHex(0x000000); body.material.emissiveIntensity = 1; }
  }
  p.f2 = null;
}

// Segurando o ataque no 1º golpe: Martelo Olímpico (gira e solta a bola).
export function flail2HoldCheck(p, input) {
  if (!K || !has(p, 'fHammer') || p.xstep || p.combo !== 0) return false;
  if (p.stateTime < FLAIL2.hammer.delay || !(input.attackHeld && input.attackHeld())) return false;
  if (F(p).ball) return false;
  return K.startHammer(p);
}
// Apertou o ataque parado/andando: com a bola do Martelo lá fora, puxa de volta (não ataca).
export function flail2Press(p) {
  if (!K || !isFlail(p)) return false;
  const b = p.f2 && p.f2.ball;
  if (!b) return false;
  if (b.phase !== 'back') K.pullBack(p);
  return true;
}
// Atacar bloqueando: Sino da Catedral (se a recarga deixar).
export function flail2BlockPress(p, camera) {
  if (!K || !has(p, 'fBell') || F(p).bellCd > 0) return false;
  p.combo = 0;
  p.startAttack(camera, BELL_STEP);
  return true;
}
// Rolar: Bola de Canhão (joga a bola e é puxado até ela).
export function flail2StartDodge(p) {
  if (!K || !has(p, 'fCannon') || F(p).ball || F(p).spin) return false;
  return K.startCannon(p);
}
export const flail2Invuln = (p) => p.state === 'flailFly' || p.state === 'flailOrbit';
// Estados próprios (girando, voando atrás da bola, em volta do poste, tonto). 'end' = acabou.
export function flail2StateTick(p, dt, world, input, move, camera) {
  if (!K || !p.f2) return 'end';
  if (p.state === 'flailSpin') return K.spinTick(p, dt, world, input, move, camera);
  if (p.state === 'flailFly') return K.flyTick(p, dt, world);
  if (p.state === 'flailOrbit') return K.orbitTick(p, dt, world);
  if (p.state === 'flailDizzy') return p.stateTime >= FLAIL2.hammer.dizzy ? 'end' : null;
  return 'end';
}

export class FlailKit2 {
  constructor(c) {
    this.c = c; K = this;
    this.time = 0;
    this.cuffs = [];      // Algemas: {a, b, t, yank, bumpT, m}
    this.bowls = [];      // Strike!: {p, set, pre, t, done}
    this.meteors = [];    // Cometa: {p, x, z, t, m, ring}
    this.cages = [];      // Gaiola: {x, z, r, t, inside, m}
    this.slicks = [];     // Panela de Pressão: {x, z, r, t, m, cd}
    this.heads = [];      // Hidra: {p, e, x, z, t, hit, m, rope}
    this.bells = [];      // sino em cima do herói: {p, m, t}
    this.falls = [];      // crânios caindo da bola: {m, vy, t}
    this.extra = new Map(); // Hidra: cabeças extras penduradas (visual) p -> [{m, rope, pos, prev}]
    this.faces = new Map(); // Bola Faminta: p -> grupo dos olhos
  }
  get scene() { return this.c.scene; }
  log(o) { if (this.c.log) this.c.log(o); }
  dmg(p, n) { return Math.max(1, Math.round(n * ((p && p.stats && p.stats.damageMul) || 1) * this.dmgMul(p))); }
  flail(p) { return p.weapon && p.weapon.userData.flail; }
  hand(p, out = tmp) {
    const g = p.weapon, f = g && g.userData.flail;
    if (!f) return out.set(p.position.x, 1.1, p.position.z);
    g.updateWorldMatrix(true, false);
    return out.copy(f.anchor).applyMatrix4(g.matrixWorld);
  }
  // Ponta da corrente (bola) num ponto do mundo (k = 1: lá; 0: na mão).
  lash(p, x, y, z, k = 1) { const f = this.flail(p); if (!f) return; f.lash = { x, y, z, k: Math.max(0.0001, k) }; F(p).lashOwn = true; }
  unlash(p) { const f = this.flail(p); if (f && F(p).lashOwn) f.lash = null; if (p.f2) p.f2.lashOwn = false; }
  foes(x, z, r, skip = null) {
    return this.c.enemies.filter((o) => o !== skip && o.targetable && !o.undead && !(o.data && o.data.phantom) && Math.hypot(o.position.x - x, o.position.z - z) <= r + o.data.radius);
  }
  hold(e) { // agarrado (Laço, Martelo): sem corpo, quem mexe é o kit
    e.releaseToken();
    if (e.atk && e.state === 'attack' && e.endAttack) e.endAttack();
    e.vel.set(0, 0, 0);
    e.setState('fistHeld');
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.4 });
  }
  release(e, stun = 0.6) {
    if (!e.alive || e.state !== 'fistHeld') return;
    e.position.y = 0;
    e.setState('hurt'); e.stunTime = stun;
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05 });
    this.c.world.resolveCircle(e.position, e.data.radius);
  }
  knock(e, nx, nz, boss = 0.4) {
    if (!e.alive) return;
    if (e.data.boss) { e.daze(boss); return; }
    knockDown(e, nx, nz);
  }

  // ---------- Ganchos do combate ----------
  strike(p, step) {
    if (step.flail2 === 'bell' && isFlail(p)) { this.ring(p); return true; }
    return false;
  }
  // Depois do dano (wbOnHit).
  onHit(p, e, step, r) {
    // Algemas: o parceiro de corrente leva metade (vale para qualquer herói).
    const pr = this.cuffs.find((c) => c.a === e || c.b === e);
    if (pr && r.dmg > 0 && !step.cuffShare) {
      const o = pr.a === e ? pr.b : pr.a;
      if (o.alive && o.targetable) this.c.bonusDamage(o, Math.max(1, Math.round(r.dmg * FLAIL2.cuffs.share)), r.nx || 0, r.nz || 1, 'dmg', p);
    }
    if (!isFlail(p) || step.flail2) return;
    const f = F(p);
    if (f.seq !== p.swingSeq) { f.seq = p.swingSeq; f.hits = []; }
    f.hits.push(e);
    if (has(p, 'fComet') && f.heatSeq !== p.swingSeq) { f.heatSeq = p.swingSeq; f.heat = Math.min(FLAIL2.comet.max, f.heat + 1); }
    f.heatIdle = 0;
  }
  // Fim do golpe normal (playerStrike).
  afterStrike(p, step, hits) {
    if (!isFlail(p) || step.flail2) return;
    void hits;
    const f = F(p), w = W(p);
    const list = f.seq === p.swingSeq ? f.hits.filter((e) => e.alive) : [];
    if (w.fCuffs) this.cuff(p, list);
    if (!step.heavy) return;
    if (w.fBowl) this.bowl(p, list);
    if (w.fCollect && f.shots.length) this.fireShots(p);
    if (w.fComet && f.heat >= FLAIL2.comet.white) this.comet(p);
    if (w.fCage && f.cageCd <= 0) this.cage(p);
    if (w.fHydra) this.hydra(p, step);
    if (p.state !== 'attack') return;
    if (w.fPole && f.poleCd <= 0 && this.startPole(p, list)) return;
    if (w.fLasso) this.startLasso(p, list);
  }
  onKill(e, by) {
    if (!by || !has(by, 'fBones') || e.undead || (e.data && e.data.phantom)) return;
    this.addSkull(by);
  }
  // Bloqueio do Cavaleiro (hitPlayer): flechas presas no escudo, pressão da panela.
  onBlock(p, e, opts, res) {
    if (!isFlail(p)) return;
    const f = F(p), w = W(p);
    if (w.fCollect && opts.shooter && f.shots.length < FLAIL2.collect.max) this.stick(p, opts.shooter);
    if (w.fSteam && res !== 'break') {
      f.pressure++;
      if (f.pressure >= FLAIL2.steam.need) this.steam(p);
      else this.c.text.add(`Pressão ${f.pressure}/${FLAIL2.steam.need}`, p.position, 'block', 2.6);
    }
  }
  onHurt(p) {
    if (!isFlail(p) || !p.f2 || !p.f2.bones.length) return;
    const n = Math.min(FLAIL2.bones.lose, p.f2.bones.length);
    for (let i = 0; i < n; i++) this.dropSkull(p);
    this.c.text.add(n > 1 ? `-${n} crânios` : '-1 crânio', p.position, 'miss', 2.6);
  }
  dmgMul(p) { return p && p.f2 && has(p, 'fBones') ? 1 + FLAIL2.bones.dmg * p.f2.bones.length : 1; }
  rangeMul(p) { return p && p.f2 && has(p, 'fBones') ? 1 + FLAIL2.bones.range * p.f2.bones.length : 1; }

  // ---------- Laço de Ferro ----------
  startLasso(p, list) {
    let best = null, bd = Infinity;
    for (const e of list) {
      if (!canGrab(e)) continue;
      const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return false;
    this.hold(best);
    const f = F(p);
    f.spin = { mode: 'lasso', e: best, t: 0, hit: new Set([best]), prev: null, turns: 0 };
    p.setState('flailSpin');
    p.setGlow(0);
    p.anim.play(SPIN, { fade: 0.06, speed: this.spinSpeed(FLAIL2.lasso.turn) });
    this.c.text.add('Laço!', best.position, 'crit', 3.4);
    audio.play('grab', p.position.x, p.position.z);
    this.log({ type: 'flailLasso', enemy: best });
    return true;
  }
  spinSpeed(turn) { let d = 0.67; try { d = getClip(SPIN).duration; } catch { /* sem o clipe */ } return d / turn; }
  // Direção (no chão) da mão do herói em relação ao corpo. Segue o giro da animação.
  handDir(p) {
    const h = this.hand(p);
    let dx = h.x - p.position.x, dz = h.z - p.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) { dx = Math.sin(p.facing); dz = Math.cos(p.facing); } else { dx /= d; dz /= d; }
    return { dx, dz };
  }
  countTurn(s, dx, dz) {
    const a = Math.atan2(dx, dz);
    if (s.prev != null) s.turns += Math.abs(wrap(a - s.prev)) / (Math.PI * 2);
    s.prev = a;
  }

  spinTick(p, dt, world, input, move, camera) {
    const f = F(p), s = f.spin;
    if (!s) return 'end';
    s.t += dt;
    const { dx, dz } = this.handDir(p);
    this.countTurn(s, dx, dz);
    if (s.mode === 'lasso') {
      const L = FLAIL2.lasso, e = s.e;
      if (!e.alive || e.state !== 'fistHeld') { f.spin = null; this.unlash(p); return 'end'; }
      e.position.x = p.position.x + dx * L.r; e.position.z = p.position.z + dz * L.r; e.position.y = 0.55;
      e.facing = Math.atan2(dx, dz) + Math.PI; e.group.rotation.y = e.facing;
      e.model.rotation.x = -0.6;
      this.lash(p, e.position.x, 1.1, e.position.z);
      for (const o of this.foes(e.position.x, e.position.z, e.data.radius + 0.25, e)) {
        if (s.hit.has(o)) continue;
        s.hit.add(o);
        const ox = o.position.x - p.position.x, oz = o.position.z - p.position.z, od = Math.hypot(ox, oz) || 1;
        this.c.bonusDamage(o, this.dmg(p, L.hit), ox / od, oz / od, 'dmg', p);
        this.knock(o, ox / od, oz / od);
        this.c.vfx.sparks(v3(o.position.x, 1.0, o.position.z), 0xffe6a0, 10);
        audio.play('hitHeavy', o.position.x, o.position.z, { v: 0.8 });
        this.log({ type: 'flailLassoHit', enemy: o });
      }
      if (s.t < L.time) return null;
      // Solta: arremessa para onde o jogador mira.
      const a = camera ? p.aimAngle(camera) : p.facing;
      p.facing = a;
      e.model.rotation.x = 0;
      e.position.x = p.position.x + Math.sin(a) * 1.3; e.position.z = p.position.z + Math.cos(a) * 1.3; e.position.y = 0;
      f.spin = null;
      this.unlash(p);
      this.c.fist.launch(p, e, Math.sin(a), Math.cos(a), { speed: L.speed, distTotal: L.dist, path: L.path, land: L.land, label: 'Lá vai!' });
      this.c.shakeFor(p, 0.25);
      this.log({ type: 'flailLassoThrow', enemy: e, turns: s.turns });
      return 'end';
    }
    // Martelo Olímpico: gira enquanto segura o ataque.
    const H = FLAIL2.hammer, k = Math.min(1, s.turns / H.turns);
    p.anim.play(SPIN, { speed: this.spinSpeed(H.t0 + (H.t1 - H.t0) * k) });
    if (move && move.lengthSq() > 0) p.move(move.x, move.z, p.hero.moveSpeed * H.move * dt, world);
    const R = H.r0 + (H.r1 - H.r0) * k;
    const bx = p.position.x + dx * R, bz = p.position.z + dz * R;
    this.lash(p, bx, 0.9, bz);
    const half = Math.floor(s.turns * 2);
    for (const o of this.foes(bx, bz, 0.55)) {
      if ((s.hitAt.get(o) ?? -1) >= half) continue;
      s.hitAt.set(o, half);
      const ox = o.position.x - p.position.x, oz = o.position.z - p.position.z, od = Math.hypot(ox, oz) || 1;
      this.c.bonusDamage(o, this.dmg(p, H.hit + H.hitPer * Math.min(H.turns, Math.floor(s.turns))), ox / od, oz / od, 'dmg', p);
      if (o.alive) o.vel.set(ox / od, 0, oz / od).multiplyScalar(8 * (o.data.knockback ?? 1));
      this.c.vfx.sparks(v3(o.position.x, 1.0, o.position.z), 0xffe6a0, 8);
      audio.play('hit', o.position.x, o.position.z);
      this.log({ type: 'flailHammerHit', enemy: o, turns: s.turns });
    }
    if (s.t > (s.whoosh || 0)) { s.whoosh = s.t + 0.75 * (H.t0 + (H.t1 - H.t0) * k); audio.play('swing', p.position.x, p.position.z, { v: 0.5 + k * 0.6 }); }
    const held = input && input.attackHeld && input.attackHeld();
    if (s.turns >= H.dizzyAt) { // girou demais: solta para qualquer lado e fica tonto
      this.throwBall(p, Math.random() * Math.PI * 2, s.turns);
      f.spin = null;
      p.setState('flailDizzy');
      p.anim.play(p.hero.anims.hit, { once: true, restart: true, fade: 0.08, speed: 0.5 });
      this.dizzy(p);
      this.c.text.add('Tonto!', p.position, 'hurt', 3.4);
      this.log({ type: 'flailDizzy' });
      return null;
    }
    if (held) return null;
    const a = camera ? p.aimAngle(camera) : p.facing;
    p.facing = a;
    this.throwBall(p, a, s.turns);
    f.spin = null;
    return 'end';
  }
  startHammer(p) {
    const f = F(p);
    f.spin = { mode: 'hammer', t: 0, prev: null, turns: 0, hitAt: new Map() };
    p.setState('flailSpin');
    p.queued = false;
    p.setGlow(0);
    p.anim.play(SPIN, { fade: 0.08, speed: this.spinSpeed(FLAIL2.hammer.t0) });
    this.c.text.add('Martelo!', p.position, 'crit', 3.2);
    this.log({ type: 'flailHammer' });
    return true;
  }
  // A bola sai voando presa pela corrente e fica no chão até puxar de volta.
  throwBall(p, a, turns) {
    const H = FLAIL2.hammer, f = F(p), n = Math.min(H.turns, turns);
    const h = this.hand(p);
    f.ball = { phase: 'out', x: h.x, z: h.z, y: 1.0, dx: Math.sin(a), dz: Math.cos(a), dist: 0, max: H.d0 + H.dPer * n,
      dmg: this.dmg(p, H.fly + H.flyPer * n), hit: new Set(), t: 0, drag: [] };
    this.c.text.add(n >= H.turns ? 'LÁ VAI!' : 'Lá vai!', p.position, 'crit', 3.2);
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.2 });
    this.log({ type: 'flailHammerThrow', turns, max: f.ball.max });
  }
  pullBack(p) {
    const b = F(p).ball;
    if (!b || b.phase === 'back') return;
    b.phase = 'back'; b.t = 0;
    audio.play('swing', p.position.x, p.position.z);
    this.log({ type: 'flailHammerPull' });
  }
  ballTick(p, dt) {
    const f = p.f2, b = f && f.ball;
    if (!b) return;
    const H = FLAIL2.hammer, c = this.c;
    b.t += dt;
    if (p.state === 'dead' || !isFlail(p)) { this.dropBall(p); return; }
    if (b.phase === 'out') {
      const step = H.speed * dt;
      const steps = Math.max(1, Math.ceil(step / 0.3));
      for (let i = 0; i < steps; i++) {
        const nx = b.x + b.dx * step / steps, nz = b.z + b.dz * step / steps;
        if (c.world.blocked(nx, nz, 0.25)) { b.phase = 'rest'; b.t = 0; c.vfx.sparks(v3(b.x, 0.6, b.z), 0xffe6a0, 8); audio.play('crunch', b.x, b.z, { v: 0.7 }); break; }
        b.x = nx; b.z = nz; b.dist += step / steps;
        for (const o of this.foes(b.x, b.z, 0.5)) {
          if (b.hit.has(o)) continue;
          b.hit.add(o);
          c.bonusDamage(o, b.dmg, b.dx, b.dz, 'dmg big', p);
          this.knock(o, b.dx, b.dz);
          c.vfx.sparks(v3(o.position.x, 1.0, o.position.z), 0xffc070, 12);
          audio.play('hitHeavy', o.position.x, o.position.z);
          this.log({ type: 'flailHammerBall', enemy: o });
        }
        if (b.dist >= b.max) { b.phase = 'rest'; b.t = 0; c.vfx.dust(v3(b.x, 0.1, b.z), v3(0, 0, 0), 8); audio.play('thump', b.x, b.z); break; }
      }
      b.y = Math.max(0.3, 1.0 - b.dist / Math.max(1, b.max) * 0.7);
    } else if (b.phase === 'rest') {
      b.y = 0.3;
      const dx = b.x - p.position.x, dz = b.z - p.position.z, d = Math.hypot(dx, dz);
      if (d > H.leash) { b.x = p.position.x + dx / d * H.leash; b.z = p.position.z + dz / d * H.leash; } // arrastada pela corrente
      if (b.t >= H.life) this.pullBack(p);
    } else { // volta para a mão arrastando quem estiver no caminho
      const h = this.hand(p);
      const dx = h.x - b.x, dz = h.z - b.z, d = Math.hypot(dx, dz) || 0.001;
      const step = Math.min(d, H.back * dt);
      b.x += dx / d * step; b.z += dz / d * step; b.y = 0.6;
      if (b.drag.length < H.drag) {
        for (const o of this.foes(b.x, b.z, H.grab)) {
          if (b.drag.length >= H.drag || b.drag.includes(o) || !canGrab(o)) continue;
          this.hold(o);
          b.drag.push(o);
          c.text.add('Arrastado!', o.position, 'hurt', 3.0);
          this.log({ type: 'flailHammerDrag', enemy: o });
        }
      }
      b.drag.forEach((o, i) => {
        if (!o.alive || o.state !== 'fistHeld') return;
        const a = i * 2.1;
        o.position.x = b.x + Math.sin(a) * 0.6; o.position.z = b.z + Math.cos(a) * 0.6; o.position.y = 0.2;
        o.model.rotation.x = -1.2;
      });
      if (d < 1.4) this.finishBall(p);
    }
    if (f.ball) this.lash(p, b.x, b.y, b.z);
  }
  finishBall(p) {
    const b = p.f2.ball, c = this.c, H = FLAIL2.hammer;
    p.f2.ball = null;
    this.unlash(p);
    const a = p.facing;
    b.drag.forEach((o, i) => {
      if (!o.alive || o.state !== 'fistHeld') return;
      o.model.rotation.x = 0;
      const s = (i - (b.drag.length - 1) / 2) * 1.0;
      o.position.x = p.position.x + Math.sin(a) * 1.6 + Math.cos(a) * s; o.position.z = p.position.z + Math.cos(a) * 1.6 - Math.sin(a) * s;
      this.release(o, H.dropStun);
      c.bonusDamage(o, this.dmg(p, H.drop), Math.sin(a), Math.cos(a), 'dmg', p);
    });
    if (b.drag.length) { c.vfx.dust(v3(p.position.x + Math.sin(a) * 1.6, 0.1, p.position.z + Math.cos(a) * 1.6), v3(0, 0, 0), 10); audio.play('thump', p.position.x, p.position.z); }
    this.log({ type: 'flailHammerBack', n: b.drag.length });
  }
  dropBall(p) {
    const b = p.f2 && p.f2.ball;
    if (!b) return;
    for (const o of b.drag) { if (o.model) o.model.rotation.x = 0; this.release(o, 0.4); }
    p.f2.ball = null;
    this.unlash(p);
  }
  dizzy(p) {
    const g = dizzyStars(5);
    this.scene.add(g);
    this.bells.push({ p, m: g, t: 0, life: FLAIL2.hammer.dizzy, stars: true });
  }

  // ---------- Bola no Poste ----------
  startPole(p, list) {
    const P = FLAIL2.pole;
    let ctr = null;
    const boss = list.find((e) => e.alive && e.data.boss);
    if (boss) ctr = { e: boss, x: boss.position.x, z: boss.position.z, r: boss.data.radius };
    else {
      let bd = Infinity;
      for (const s of (this.c.demo && this.c.demo.list) || []) {
        if (s.down) continue;
        const dx = s.x - p.position.x, dz = s.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
        if (d - (s.r || 0.5) > P.reach || Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > 80 * DEG) continue;
        if (d < bd) { bd = d; ctr = { x: s.x, z: s.z, r: s.r || 0.5 }; }
      }
    }
    if (!ctr) return false;
    const d = Math.hypot(p.position.x - ctr.x, p.position.z - ctr.z);
    const f = F(p);
    f.poleCd = P.cd;
    f.orbit = { ...ctr, t: 0, R: Math.max(P.rMin + ctr.r * 0.5, Math.min(P.rMax + ctr.r * 0.5, d)), a0: Math.atan2(p.position.x - ctr.x, p.position.z - ctr.z), hit: new Set() };
    p.setState('flailOrbit');
    p.setGlow(0);
    p.iframes = Math.max(p.iframes, P.time + 0.15);
    p.anim.play('Running_A', { fade: 0.06, speed: 1.8 });
    this.c.text.add('Gira!', p.position, 'crit', 3.2);
    audio.play('grab', p.position.x, p.position.z);
    this.log({ type: 'flailPole', boss: !!ctr.e });
    return true;
  }
  orbitTick(p, dt, world) {
    const f = F(p), o = f.orbit, P = FLAIL2.pole, c = this.c;
    if (!o) return 'end';
    o.t += dt;
    if (o.e) { if (!o.e.alive) { f.orbit = null; this.unlash(p); return 'end'; } o.x = o.e.position.x; o.z = o.e.position.z; }
    const k = Math.min(1, o.t / P.time), a = o.a0 + Math.PI * 2 * P.turns * k;
    p.position.x = o.x + Math.sin(a) * o.R; p.position.z = o.z + Math.cos(a) * o.R;
    world.resolveCircle(p.position, p.hero.radius);
    p.facing = a + Math.PI / 2;
    this.lash(p, o.x, 1.2, o.z);
    for (const e of this.foes(p.position.x, p.position.z, p.hero.radius + 0.45, o.e)) {
      if (o.hit.has(e)) continue;
      o.hit.add(e);
      const ox = e.position.x - o.x, oz = e.position.z - o.z, od = Math.hypot(ox, oz) || 1;
      c.bonusDamage(e, this.dmg(p, P.kick), ox / od, oz / od, 'dmg', p);
      if (e.alive && canGrab(e)) c.fist.launch(p, e, ox / od, oz / od, { speed: 14, distTotal: 3.5, path: 6, land: 0, label: 'Chute!' });
      else if (e.alive) e.daze(0.4);
      c.vfx.sparks(v3(e.position.x, 1.0, e.position.z), 0xffe6a0, 10);
      audio.play('hitHeavy', e.position.x, e.position.z, { v: 0.8 });
      this.log({ type: 'flailPoleKick', enemy: e });
    }
    if (k < 1) return null;
    f.orbit = null;
    this.unlash(p);
    return 'end';
  }

  // ---------- Bola de Canhão ----------
  startCannon(p) {
    const C = FLAIL2.cannon, world = this.c.world;
    const mv = tmp.set(0, 0, 0);
    if (p.ctl && p.ctl.moveDir) p.ctl.moveDir(mv);
    const a = mv.lengthSq() > 0 ? Math.atan2(mv.x, mv.z) : p.facing;
    const dx = Math.sin(a), dz = Math.cos(a);
    let d = 0;
    while (d < C.dist && !world.blocked(p.position.x + dx * (d + 0.3), p.position.z + dz * (d + 0.3), p.hero.radius * 0.8)) d += 0.3;
    if (d < C.min) return false;
    const f = F(p);
    f.fly = { t: 0, sx: p.position.x, sz: p.position.z, tx: p.position.x + dx * d, tz: p.position.z + dz * d, dx, dz, hit: new Set(), pulled: false };
    p.facing = a;
    p.setState('flailFly');
    p.combo = 0;
    p.setGlow(0);
    p.anim.play('Throw', { once: true, restart: true, fade: 0.05, speed: 2.4 });
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.1 });
    this.log({ type: 'flailCannon', dist: d });
    return true;
  }
  flyTick(p, dt, world) {
    const f = F(p), y = f.fly, C = FLAIL2.cannon, c = this.c;
    if (!y) return 'end';
    y.t += dt;
    p.iframes = Math.max(p.iframes, 0.1);
    if (y.t < C.out) { this.lash(p, y.tx, 0.6, y.tz, y.t / C.out); return null; }
    if (!y.pulled) { y.pulled = true; p.anim.play('Jump_Idle', { fade: 0.06 }); }
    this.lash(p, y.tx, 0.6, y.tz);
    const dx = y.tx - p.position.x, dz = y.tz - p.position.z, d = Math.hypot(dx, dz);
    const before = { x: p.position.x, z: p.position.z };
    if (d > 0.5) p.move(dx / d, dz / d, Math.min(d, C.speed * dt), world);
    const moved = Math.hypot(p.position.x - before.x, p.position.z - before.z);
    for (const e of this.foes(p.position.x, p.position.z, p.hero.radius + 0.2)) {
      if (y.hit.has(e)) continue;
      y.hit.add(e);
      c.bonusDamage(e, this.dmg(p, C.path), y.dx, y.dz, 'dmg', p);
    }
    if (d > 0.5 && (moved > 0.01 || y.t < C.out + 0.05) && y.t < 1.2) return null;
    // Chegou: a pancada no chão derruba quem estiver em volta.
    const at = v3(p.position.x, 0, p.position.z);
    for (const e of this.foes(at.x, at.z, C.r)) {
      const ex = e.position.x - at.x, ez = e.position.z - at.z, ed = Math.hypot(ex, ez) || 1;
      c.bonusDamage(e, this.dmg(p, C.dmg), ex / ed, ez / ed, 'dmg', p);
      this.knock(e, ex / ed, ez / ed, 0.5);
    }
    c.vfx.heavyImpact(at, 0.9);
    c.vfx.ring(v3(at.x, 0.12, at.z), 0xffd36a, C.r);
    c.vfx.dust(v3(at.x, 0.1, at.z), v3(0, 0, 0), 12);
    audio.play('hitHeavy', at.x, at.z, { v: 1.1 });
    c.shakeFor(p, 0.3);
    f.fly = null;
    this.unlash(p);
    p.dodgeCooldown = p.hero.dodge.cooldown;
    this.log({ type: 'flailCannonLand' });
    return 'end';
  }

  // ---------- Algemas ----------
  cuff(p, list) {
    const C = FLAIL2.cuffs;
    if (this.cuffs.length >= C.pairs) return;
    const free = list.filter((e) => e.alive && !e.data.boss && !e.undead && !this.cuffs.some((c) => c.a === e || c.b === e));
    if (free.length < 2) return;
    let best = null, bd = Infinity;
    for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
      const d = Math.hypot(free[i].position.x - free[j].position.x, free[i].position.z - free[j].position.z);
      if (d < bd) { bd = d; best = [free[i], free[j]]; }
    }
    const m = rope(0xa9b4c4, 0.045);
    this.scene.add(m);
    this.cuffs.push({ a: best[0], b: best[1], t: C.life, yank: 0.6, bumpT: 0, m, by: p });
    for (const e of best) this.c.text.add('Algemado!', e.position, 'block', 3.0);
    audio.play('grab', best[0].position.x, best[0].position.z, { v: 0.7 });
    this.log({ type: 'flailCuffs', a: best[0], b: best[1] });
  }
  cuffTick(dt) {
    const C = FLAIL2.cuffs, c = this.c;
    for (const k of [...this.cuffs]) {
      const { a, b } = k;
      k.t -= dt;
      if (k.t <= 0 || !a.alive || !b.alive || !c.enemies.includes(a) || !c.enemies.includes(b)) {
        c.vfx.sparks(v3((a.position.x + b.position.x) / 2, 1.0, (a.position.z + b.position.z) / 2), 0xcfd8e6, 8);
        this.rm(k.m); this.cuffs.splice(this.cuffs.indexOf(k), 1); continue;
      }
      const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z, d = Math.hypot(dx, dz) || 0.01;
      const free = (e) => !BUSY.has(e.state) || e.state === 'axeDown';
      if (d > C.max) { // corrente esticada: puxa os dois
        const pull = (d - C.max) * 6;
        if (free(a)) a.vel.addScaledVector(v3(dx / d, 0, dz / d), pull * dt * 10);
        if (free(b)) b.vel.addScaledVector(v3(-dx / d, 0, -dz / d), pull * dt * 10);
      }
      k.yank -= dt;
      if (k.yank <= 0) { // tranco: um vai de encontro ao outro
        k.yank = C.every; k.bumpT = 0.45;
        if (free(a)) a.vel.set(dx / d, 0, dz / d).multiplyScalar(C.yank);
        if (free(b)) b.vel.set(-dx / d, 0, -dz / d).multiplyScalar(C.yank);
        audio.play('grab', a.position.x, a.position.z, { v: 0.5 });
      }
      if (k.bumpT > 0) {
        k.bumpT -= dt;
        if (d < a.data.radius + b.data.radius + 0.35) {
          k.bumpT = 0;
          const mid = v3((a.position.x + b.position.x) / 2, 1.5, (a.position.z + b.position.z) / 2);
          for (const e of [a, b]) {
            const s = e === a ? -1 : 1;
            c.bonusDamage(e, this.dmg(k.by, C.bump), s * dx / d, s * dz / d, 'dmg', k.by);
            if (e.alive) e.daze(C.stun);
          }
          c.text.add('Cabeçada!', mid, 'crit', 3.2);
          c.vfx.sparks(mid, 0xffffff, 14);
          audio.play('headThud', mid.x, mid.z, { v: 1.1 });
          this.log({ type: 'flailHeadbutt', a, b });
        }
      }
      setRope(k.m, v3(a.position.x, 1.0 + a.position.y, a.position.z), v3(b.position.x, 1.0 + b.position.y, b.position.z));
    }
  }

  // ---------- Strike! ----------
  bowl(p, list) {
    const B = FLAIL2.bowl, c = this.c;
    const pre = new Set(c.enemies.filter((e) => e.state === 'axeDown' || e.state === 'fistFly'));
    const set = new Set();
    for (const e of list) {
      if (!e.alive) continue;
      if (e.data.boss) { e.daze(0.5); continue; }
      if (!canGrab(e)) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
      if (c.fist.launch(p, e, dx / d, dz / d, { speed: B.speed, distTotal: B.dist, path: B.path, land: 0 })) set.add(e);
    }
    if (!set.size) return;
    this.bowls.push({ p, set, pre, t: 0, done: false });
    this.log({ type: 'flailBowl', n: set.size });
  }
  bowlTick(dt) {
    const B = FLAIL2.bowl, c = this.c;
    for (const s of [...this.bowls]) {
      s.t += dt;
      for (const e of c.enemies) if (!s.pre.has(e) && (e.state === 'axeDown' || e.state === 'fistFly')) s.set.add(e);
      if (!s.done && s.set.size >= B.need) {
        s.done = true;
        const p = s.p;
        c.text.add('STRIKE!', p.position, 'crit', 4.6);
        audio.play('gold', p.position.x, p.position.z, { v: 1.3 });
        audio.play('blessing', p.position.x, p.position.z, { v: 0.8 });
        c.vfx.ring(v3(p.position.x, 0.15, p.position.z), 0xffe27a, 5);
        if (c.onCoin) for (let i = 0; i < B.coins; i++) {
          const a = i / B.coins * Math.PI * 2;
          c.onCoin(v3(p.position.x + Math.sin(a) * 1.6, 0, p.position.z + Math.cos(a) * 1.6), 3);
        }
        this.log({ type: 'flailStrike', n: s.set.size });
      }
      if (s.t >= B.window) this.bowls.splice(this.bowls.indexOf(s), 1);
    }
  }

  // ---------- Bola Faminta / Cometa / Ossos / Hidra (visual da bola) ----------
  playerTick(p, dt) {
    const f = F(p), w = W(p), fl = this.flail(p);
    f.bellCd = Math.max(0, f.bellCd - dt); f.cageCd = Math.max(0, f.cageCd - dt); f.poleCd = Math.max(0, f.poleCd - dt);
    if (f.spin && p.state !== 'flailSpin') this.abortSpin(p);
    if (f.fly && p.state !== 'flailFly') { f.fly = null; this.unlash(p); }
    if (f.orbit && p.state !== 'flailOrbit') { f.orbit = null; this.unlash(p); }
    this.ballTick(p, dt);
    // Bola Faminta
    const act = p.state === 'attack' || FLAIL2_STATES.includes(p.state) || f.ball;
    f.idleT = act ? 0 : f.idleT + dt;
    f.biteT -= dt;
    this.syncFace(p, !!w.fHungry);
    if (w.fHungry) this.hungryTick(p, dt);
    // Cometa: a bola esquenta com golpes seguidos e esfria parada.
    f.heatIdle += dt;
    if (f.heatIdle > FLAIL2.comet.wait) f.heat = Math.max(0, f.heat - FLAIL2.comet.decay * dt);
    if (fl && w.fComet) this.heatLook(p, f, fl, dt);
    // Panela de Pressão: vapor saindo do escudo quando está quase cheia.
    if (w.fSteam && f.pressure >= FLAIL2.steam.need - 2 && p.shieldMesh) {
      f.puff = (f.puff || 0) - dt;
      if (f.puff <= 0) { f.puff = 0.35; p.shieldMesh.getWorldPosition(tmp); this.c.vfx.smoke(tmp.clone(), 0xf0f4ff, 3); }
    }
    this.hydraLook(p, !!w.fHydra, dt);
  }
  hungryTick(p, dt) {
    const f = F(p), H = FLAIL2.hungry, c = this.c, fl = this.flail(p);
    const face = this.faces.get(p), jaw = face && face.getObjectByName('jaw');
    if (f.bite) {
      const b = f.bite, e = b.e;
      b.t += dt;
      if (e.alive) { b.x = e.position.x; b.z = e.position.z; }
      const k = b.t < H.out ? b.t / H.out : b.t < H.out + H.hold ? 1 : Math.max(0, 1 - (b.t - H.out - H.hold) / H.back);
      if (jaw) jaw.rotation.x = b.t < H.out ? -0.5 : 0.1;
      if (!b.hit && b.t >= H.out) {
        b.hit = true;
        if (e.alive && e.targetable) {
          const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
          c.bonusDamage(e, this.dmg(p, H.dmg), dx / d, dz / d, 'dmg', p);
          if (e.alive) e.daze(0.3);
          c.text.add('Nhac!', e.position, 'crit', 3.0);
          c.vfx.sparks(v3(e.position.x, 1.1, e.position.z), 0xff6a6a, 8);
          audio.play('crunch', e.position.x, e.position.z, { v: 0.8 });
          if (p.state === 'idle' || p.state === 'run' || p.state === 'block') p.vel.set(dx / d, 0, dz / d).multiplyScalar(H.pull); // a coleira puxa o dono
          this.log({ type: 'flailBite', enemy: e });
        }
      }
      if (b.t >= H.out + H.hold + H.back) { f.bite = null; this.unlash(p); return; }
      this.lash(p, b.x, 1.0, b.z, k);
      return;
    }
    if (jaw) jaw.rotation.x = 0.12 * Math.sin(this.time * 6);
    if (fl && fl.lash && !f.lashOwn) return; // a bola está ocupada (Reflexo)
    if (f.idleT < H.idle || f.biteT > 0 || p.state === 'dead' || p.state === 'cine') return;
    let best = null, bd = H.range;
    for (const e of c.enemies) {
      if (!e.targetable || e.undead) continue;
      const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) - e.data.radius;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return;
    f.biteT = H.every;
    f.bite = { e: best, t: 0, hit: false, x: best.position.x, z: best.position.z };
    audio.play('swing', p.position.x, p.position.z, { v: 0.6 });
  }
  syncFace(p, on) {
    const fl = this.flail(p);
    let g = this.faces.get(p);
    if (g && (!on || !fl || g.parent !== fl.ball)) { g.removeFromParent(); this.faces.delete(p); g = null; }
    if (on && fl && !g) { g = faceParts(); fl.ball.add(g); this.faces.set(p, g); }
    if (g) { // a cara olha para a frente do herói (a bola balança, mas os olhos ficam virados para fora)
      p.group.getWorldQuaternion(g.quaternion);
      const q = fl.ball.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      g.quaternion.premultiply(q);
    }
  }
  heatLook(p, f, fl, dt) {
    const body = fl.ball.children[0];
    if (!body || !body.material || !body.material.emissive) return;
    const C = FLAIL2.comet, h = f.heat;
    if (h >= C.white) { body.material.emissive.setHex(0xfff2d0); body.material.emissiveIntensity = 2.4; }
    else if (h >= C.red) { body.material.emissive.setHex(0xff3010); body.material.emissiveIntensity = 0.6 + (h - C.red) / (C.white - C.red) * 1.0; }
    else { body.material.emissive.setHex(0xff3010); body.material.emissiveIntensity = h / C.red * 0.3; }
    if (h >= C.red) {
      f.ember = (f.ember || 0) - dt;
      if (f.ember <= 0) { f.ember = h >= C.white ? 0.06 : 0.16; fl.ball.getWorldPosition(tmp); this.c.vfx.sparks(tmp.clone(), h >= C.white ? 0xfff0c0 : 0xff6020, 2); }
    }
  }
  comet(p) {
    const C = FLAIL2.comet, c = this.c, f = F(p);
    f.heat = 0;
    // Mira: o grupo de inimigos mais cheio na frente; sem ninguém, um pouco à frente.
    let tx = p.position.x + Math.sin(p.facing) * C.ahead, tz = p.position.z + Math.cos(p.facing) * C.ahead, most = 0;
    for (const e of c.enemies) {
      if (!e.targetable || e.undead) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z;
      if (Math.hypot(dx, dz) > C.reach || Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > 100 * DEG) continue;
      const n = this.foes(e.position.x, e.position.z, C.r).length;
      if (n > most) { most = n; tx = e.position.x; tz = e.position.z; }
    }
    const m = meteorMesh(), ring = targetRing(C.r);
    m.position.set(tx - 3, 14, tz + 2);
    ring.position.set(tx, 0.06, tz);
    this.scene.add(m); this.scene.add(ring);
    this.meteors.push({ p, x: tx, z: tz, t: 0, m, ring, sx: tx - 3, sz: tz + 2 });
    c.text.add('COMETA!', p.position, 'crit', 3.8);
    audio.play('fireRoar', p.position.x, p.position.z, { v: 0.9 });
    this.log({ type: 'flailComet', x: tx, z: tz });
  }
  meteorTick(dt) {
    const C = FLAIL2.comet, c = this.c;
    for (const m of [...this.meteors]) {
      m.t += dt;
      const k = Math.min(1, m.t / C.fall);
      m.m.position.set(m.sx + (m.x - m.sx) * k, 14 * (1 - k * k) + 0.4 * k, m.sz + (m.z - m.sz) * k);
      m.m.rotation.x += dt * 9;
      m.ring.material.opacity = 0.35 + 0.35 * Math.sin(m.t * 18);
      if (Math.random() < 0.6) c.vfx.sparks(m.m.position.clone(), 0xffb050, 2);
      if (k < 1) continue;
      const at = v3(m.x, 0, m.z), p = m.p;
      for (const e of this.foes(at.x, at.z, C.r)) {
        const ex = e.position.x - at.x, ez = e.position.z - at.z, ed = Math.hypot(ex, ez) || 1;
        c.bonusDamage(e, this.dmg(p, C.dmg), ex / ed, ez / ed, 'dmg big', p);
        this.knock(e, ex / ed, ez / ed, 0.6);
      }
      c.vfx.heavyImpact(at, 1.7);
      c.vfx.ring(v3(at.x, 0.12, at.z), 0xff9040, C.r);
      c.vfx.dust(v3(at.x, 0.1, at.z), v3(0, 0, 0), 18);
      c.vfx.sparks(v3(at.x, 0.8, at.z), 0xffd080, 24);
      audio.play('boom', at.x, at.z, { v: 1.0 });
      c.shakeFor(p, 0.5);
      c.addHitstop(0.08);
      this.rm(m.m); this.rm(m.ring);
      this.meteors.splice(this.meteors.indexOf(m), 1);
      this.log({ type: 'flailCometHit', x: at.x, z: at.z });
    }
  }
  addSkull(p) {
    const f = F(p), fl = this.flail(p), B = FLAIL2.bones;
    if (!fl || f.bones.length >= B.max) return;
    let m;
    try { m = instance('props/crypt/skull.gltf'); } catch { m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe8e0c8 })); }
    m.scale.setScalar(0.3);
    const d = v3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    m.position.copy(d).multiplyScalar(0.2);
    m.quaternion.setFromUnitVectors(v3(0, 0, 1), d);
    fl.ball.add(m);
    f.bones.push(m);
    fl.ball.scale.setScalar(1 + B.size * f.bones.length);
    this.c.text.add(`Crânio ${f.bones.length}/${B.max}`, p.position, 'gold', 2.6);
    this.log({ type: 'flailSkull', n: f.bones.length });
  }
  dropSkull(p) {
    const f = F(p), fl = this.flail(p);
    const m = f.bones.pop();
    if (!m) return;
    const at = m.getWorldPosition(new THREE.Vector3());
    m.removeFromParent();
    m.position.copy(at); m.scale.setScalar(0.3 * (fl ? fl.ball.scale.x : 1));
    this.scene.add(m);
    this.falls.push({ m, vy: 2, vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, t: 0 });
    if (fl) fl.ball.scale.setScalar(1 + FLAIL2.bones.size * f.bones.length);
    this.log({ type: 'flailSkullLost', n: f.bones.length });
  }
  hydraLook(p, on, dt) {
    let ex = this.extra.get(p);
    const fl = this.flail(p);
    if (ex && (!on || !fl)) { for (const h of ex) { this.rm(h.m); this.rm(h.rope); } this.extra.delete(p); ex = null; }
    if (!on || !fl) return;
    if (!ex) {
      ex = [0, 1].map(() => { const m = spikeBall(0.17); const r = rope(0x9aa3ad, 0.025); this.scene.add(m); this.scene.add(r); return { m, rope: r, pos: null, prev: null }; });
      this.extra.set(p, ex);
    }
    const out = this.heads.some((h) => h.p === p);
    const anchor = this.hand(p, new THREE.Vector3()), L = FLAIL2.hydra.chain * (fl.ball.scale.x || 1);
    ex.forEach((h, i) => {
      h.m.visible = h.rope.visible = !out;
      const side = (i ? 1 : -1) * 0.18, a = p.facing + Math.PI / 2;
      const ax = anchor.x + Math.sin(a) * side, az = anchor.z + Math.cos(a) * side;
      if (!h.pos || dt <= 0 || dt > 0.2) { h.pos = v3(ax, anchor.y - L, az); h.prev = h.pos.clone(); }
      else {
        const vx = (h.pos.x - h.prev.x) * 0.98, vy = (h.pos.y - h.prev.y) * 0.98, vz = (h.pos.z - h.prev.z) * 0.98;
        h.prev.copy(h.pos);
        h.pos.x += vx; h.pos.y += vy - 18 * dt * dt; h.pos.z += vz;
        const dx = h.pos.x - ax, dy = h.pos.y - anchor.y, dz = h.pos.z - az, d = Math.hypot(dx, dy, dz) || 1e-4;
        if (d > L) { h.pos.set(ax + dx / d * L, anchor.y + dy / d * L, az + dz / d * L); }
        if (h.pos.y < 0.2) h.pos.y = 0.2;
      }
      h.m.position.copy(h.pos);
      setRope(h.rope, v3(ax, anchor.y, az), h.pos);
    });
  }

  // ---------- Hidra ----------
  hydra(p, step) {
    const Hy = FLAIL2.hydra, c = this.c;
    void step;
    const list = c.enemies.filter((e) => e.targetable && !e.undead && Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) <= Hy.reach)
      .sort((u, v) => Math.hypot(u.position.x - p.position.x, u.position.z - p.position.z) - Math.hypot(v.position.x - p.position.x, v.position.z - p.position.z));
    for (let i = 0; i < Hy.heads; i++) {
      const e = list[i] || null;
      const a = p.facing + (i - 1) * 40 * DEG;
      const x = e ? e.position.x : p.position.x + Math.sin(a) * Hy.miss, z = e ? e.position.z : p.position.z + Math.cos(a) * Hy.miss;
      const m = spikeBall(0.2), r = rope(0x9aa3ad, 0.03);
      this.scene.add(m); this.scene.add(r);
      this.heads.push({ p, e, x, z, t: -i * 0.04, hit: false, m, rope: r });
    }
    c.text.add('Hidra!', p.position, 'crit', 3.2);
    this.log({ type: 'flailHydra', n: Math.min(Hy.heads, list.length) });
  }
  headTick(dt) {
    const Hy = FLAIL2.hydra, c = this.c;
    for (const h of [...this.heads]) {
      h.t += dt;
      const p = h.p;
      if (h.e && h.e.alive && !h.hit) { h.x = h.e.position.x; h.z = h.e.position.z; }
      const t = Math.max(0, h.t);
      const k = t < Hy.out ? t / Hy.out : t < Hy.out + Hy.hold ? 1 : Math.max(0, 1 - (t - Hy.out - Hy.hold) / Hy.back);
      const a = this.hand(p, new THREE.Vector3());
      const arc = Math.sin(k * Math.PI) * 0.8;
      const pos = v3(a.x + (h.x - a.x) * k, a.y + (1.0 - a.y) * k + arc, a.z + (h.z - a.z) * k);
      h.m.position.copy(pos); h.m.rotation.x += dt * 12;
      setRope(h.rope, a, pos);
      if (!h.hit && t >= Hy.out) {
        h.hit = true;
        const e = h.e;
        if (e && e.alive && e.targetable && c.enemies.includes(e)) {
          const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
          c.damageEnemy(p, e, { damage: Hy.dmg, flail2: 'hydra' }, dx / d, dz / d);
          c.vfx.sparks(v3(e.position.x, 1.1, e.position.z), 0xffe0a0, 10);
          audio.play('hitHeavy', e.position.x, e.position.z, { v: 0.7 });
          this.log({ type: 'flailHydraHit', enemy: e });
        }
      }
      if (t >= Hy.out + Hy.hold + Hy.back || p.state === 'dead') { this.rm(h.m); this.rm(h.rope); this.heads.splice(this.heads.indexOf(h), 1); }
    }
  }

  // ---------- Gaiola de Correntes ----------
  cage(p) {
    const G = FLAIL2.cage, c = this.c, f = F(p);
    f.cageCd = G.cd;
    const x = p.position.x + Math.sin(p.facing) * G.ahead, z = p.position.z + Math.cos(p.facing) * G.ahead;
    const inside = new Set(c.enemies.filter((e) => e.alive && !e.undead && Math.hypot(e.position.x - x, e.position.z - z) < G.r));
    const m = cageMesh(G.r);
    m.position.set(x, -1.6, z);
    this.scene.add(m);
    this.cages.push({ x, z, r: G.r, t: G.life, age: 0, inside, m, p });
    c.text.add('Gaiola!', p.position, 'crit', 3.4);
    audio.play('spikes', x, z, { v: 1.0 });
    c.vfx.dust(v3(x, 0.1, z), v3(0, 0, 0), 16);
    this.log({ type: 'flailCage', n: inside.size, x, z });
  }
  cageTick(dt) {
    for (const g of [...this.cages]) {
      g.t -= dt; g.age += dt;
      const up = Math.min(1, g.age / 0.2), down = Math.min(1, g.t / 0.3);
      g.m.position.y = -1.6 * (1 - Math.min(up, Math.max(0, down)));
      const glow = g.m.getObjectByName('glow');
      if (glow) glow.material.opacity = 0.35 + 0.2 * Math.sin(this.time * 8);
      if (g.t <= 0) { this.rm(g.m); this.cages.splice(this.cages.indexOf(g), 1); }
    }
  }
  // Inimigos de dentro não saem; os de fora não entram (o herói passa livre).
  cageClamp() {
    for (const g of this.cages) {
      if (g.t <= 0.05) continue;
      for (const e of this.c.enemies) {
        if (!e.alive || e.undead || ['fistHeld', 'fistFly', 'lanceHeld', 'lanceFly', 'held', 'thrown'].includes(e.state)) continue;
        const dx = e.position.x - g.x, dz = e.position.z - g.z, d = Math.hypot(dx, dz) || 0.001, r = e.data.radius;
        if (g.inside.has(e)) { if (d > g.r - r * 0.6) { e.position.x = g.x + dx / d * (g.r - r * 0.6); e.position.z = g.z + dz / d * (g.r - r * 0.6); if (e.vel.x * dx + e.vel.z * dz > 0) e.vel.set(0, 0, 0); } }
        else if (d < g.r + r * 0.6) { e.position.x = g.x + dx / d * (g.r + r * 0.6); e.position.z = g.z + dz / d * (g.r + r * 0.6); if (e.vel.x * dx + e.vel.z * dz < 0) e.vel.set(0, 0, 0); }
      }
    }
  }

  // ---------- Sino da Catedral ----------
  ring(p) {
    const B = FLAIL2.bell, c = this.c, f = F(p);
    f.bellCd = B.cd;
    const at = v3(p.position.x, 0.2, p.position.z);
    audio.play('bell', at.x, at.z, { v: 1.6 });
    audio.play('thump', at.x, at.z, { v: 0.9 });
    c.vfx.ring(at, 0xffd36a, 3); c.vfx.ring(at, 0xffd36a, 6); c.vfx.ring(at, 0xffe9a0, 10);
    c.text.add('DONG!', p.position, 'crit', 4.0);
    c.shakeFor(p, 0.2);
    let n = 0;
    for (const e of c.enemies) {
      if (!e.alive || e.undead || !e.targetable) continue;
      e.f2Bell = { by: p, t: B.rush }; n++;
    }
    const m = bellMesh();
    this.scene.add(m);
    this.bells.push({ p, m, t: 0, life: B.show });
    this.log({ type: 'flailBell', n });
  }
  bellTick(dt) {
    const B = FLAIL2.bell, c = this.c;
    for (const e of c.enemies) {
      const b = e.f2Bell;
      if (!b) continue;
      b.t -= dt;
      if (b.t <= 0 || !e.alive || !b.by || b.by.state === 'dead') { e.f2Bell = null; continue; }
      const p = b.by, dx = p.position.x - e.position.x, dz = p.position.z - e.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d < B.near + e.data.radius) {
        e.f2Bell = null;
        if (e.daze(e.data.boss ? B.boss : B.stun)) { c.text.add('Atordoado!', e.position, 'hurt', 3.0); c.vfx.sparks(v3(e.position.x, 1.8, e.position.z), 0xffe27a, 8); this.log({ type: 'flailBellStun', enemy: e }); }
        continue;
      }
      if (e.state === 'chase' || e.state === 'idle' || e.state === 'block') { // vem correndo
        e.vel.set(dx / d, 0, dz / d).multiplyScalar(B.speed * Math.max(0.4, e.data.knockback ?? 1));
        e.facing = Math.atan2(dx, dz);
      }
    }
    for (const b of [...this.bells]) {
      b.t += dt;
      const p = b.p;
      if (b.stars) { b.m.position.set(p.position.x, 2.5, p.position.z); spinStars(b.m, b.t); }
      else {
        b.m.position.set(p.position.x, 2.7 + Math.min(1, b.t * 8) * 0.2, p.position.z);
        b.m.rotation.z = Math.sin(b.t * 18) * 0.5 * Math.max(0, 1 - b.t / b.life);
        b.m.scale.setScalar(Math.min(1, b.t * 10) * (b.t > b.life - 0.15 ? Math.max(0, (b.life - b.t) / 0.15) : 1));
      }
      if (b.t >= b.life) { this.rm(b.m); this.bells.splice(this.bells.indexOf(b), 1); }
    }
  }

  // ---------- Escudo Coletor ----------
  stick(p, shooter) {
    const f = F(p), sh = p.shieldMesh;
    const kind = shooter && shooter.data && shooter.data.ranged && !/mage|necro/i.test(shooter.type || '') ? 'arrow' : 'orb';
    const m = stuckShot(kind, 0xb070ff);
    if (sh) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.22;
      m.position.set(Math.sin(a) * r, Math.cos(a) * r + 0.05, 0.08);
      m.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.4; m.rotation.z = (Math.random() - 0.5) * 0.4;
      m.scale.setScalar(1 / Math.max(0.01, sh.getWorldScale(tmp).x));
      sh.add(m);
    }
    f.shots.push({ m, kind });
    this.c.text.add(`Guardou ${f.shots.length}/${FLAIL2.collect.max}`, p.position, 'block', 2.6);
    this.log({ type: 'flailCollect', n: f.shots.length });
  }
  fireShots(p) {
    const f = F(p), C = FLAIL2.collect, c = this.c, n = f.shots.length;
    for (let i = 0; i < n; i++) {
      const s = f.shots[i];
      const a = p.facing + (n > 1 ? (i / (n - 1) - 0.5) * C.fan * DEG : 0);
      c.projectiles.fire(p.position.x + Math.sin(a) * 0.9, p.position.z + Math.cos(a) * 0.9, a, {
        speed: C.speed, damage: this.dmg(p, C.dmg), kind: s.kind === 'arrow' ? 'arrow' : 'orb', color: 0xb070ff, hits: 'hero', pierce: true, height: 1.1, life: 0.9, owner: p, silent: true,
      });
      s.m.removeFromParent();
    }
    f.shots.length = 0;
    audio.play('arrow', p.position.x, p.position.z, { v: 1.2 });
    c.text.add('Devolveu!', p.position, 'crit', 3.2);
    this.log({ type: 'flailCollectFire', n });
  }

  // ---------- Panela de Pressão ----------
  steam(p) {
    const S = FLAIL2.steam, c = this.c, f = F(p);
    f.pressure = 0;
    const at = v3(p.position.x, 0, p.position.z);
    let n = 0;
    for (const e of this.foes(at.x, at.z, S.r)) {
      const dx = e.position.x - at.x, dz = e.position.z - at.z, d = Math.hypot(dx, dz) || 1;
      if (e.data.boss) { e.daze(0.4); continue; }
      if (e.daze(S.stun)) e.vel.set(dx / d, 0, dz / d).multiplyScalar(S.push * Math.max(0.4, e.data.knockback ?? 1));
      n++;
    }
    c.vfx.smoke(v3(at.x, 1.0, at.z), 0xf4f8ff, 30);
    c.vfx.ring(v3(at.x, 0.15, at.z), 0xdff4ff, S.r);
    audio.play('iceWave', at.x, at.z, { v: 1.0 });
    audio.play('boom', at.x, at.z, { v: 0.5 });
    c.text.add('PSSSHHH!', p.position, 'crit', 3.8);
    c.shakeFor(p, 0.25);
    const m = slickDisc(S.r);
    m.position.set(at.x, 0.04, at.z);
    this.scene.add(m);
    this.slicks.push({ x: at.x, z: at.z, r: S.r, t: S.life, m, cd: new Map() });
    this.log({ type: 'flailSteam', n });
  }
  slickTick(dt) {
    const S = FLAIL2.steam, c = this.c;
    for (const s of [...this.slicks]) {
      s.t -= dt;
      s.m.material.opacity = 0.32 * Math.min(1, s.t / 0.5) * (0.8 + 0.2 * Math.sin(this.time * 5));
      if (s.t <= 0) { this.rm(s.m); this.slicks.splice(this.slicks.indexOf(s), 1); continue; }
      if (Math.random() < dt * 6) c.vfx.smoke(v3(s.x + (Math.random() - 0.5) * s.r * 1.4, 0.3, s.z + (Math.random() - 0.5) * s.r * 1.4), 0xf4f8ff, 1);
      for (const e of c.enemies) {
        if (!e.alive || e.undead || e.data.boss || !e.targetable) continue;
        if (Math.hypot(e.position.x - s.x, e.position.z - s.z) > s.r) continue;
        if ((s.cd.get(e) || 0) > this.time) continue;
        if (sitDown(e, S.sit)) {
          s.cd.set(e, this.time + S.again);
          c.text.add('Escorregou!', e.position, 'hurt', 3.0);
          c.vfx.dust(v3(e.position.x, 0.1, e.position.z), v3(0, 0, 0), 5);
          this.log({ type: 'flailSlip', enemy: e });
        }
      }
    }
  }

  // ---------- A cada quadro ----------
  tick(dt) {
    this.time += dt;
    for (const p of this.c.players) { if (isFlail(p)) this.playerTick(p, dt); else if (p.f2) this.cleanPlayer(p); }
    this.cuffTick(dt);
    this.bowlTick(dt);
    this.meteorTick(dt);
    this.headTick(dt);
    this.cageTick(dt);
    this.bellTick(dt);
    this.slickTick(dt);
    for (const s of [...this.falls]) {
      s.t += dt; s.vy -= 14 * dt;
      s.m.position.x += s.vx * dt; s.m.position.z += s.vz * dt; s.m.position.y = Math.max(0.05, s.m.position.y + s.vy * dt);
      s.m.rotation.x += dt * 6;
      if (s.t > 1.4) { s.m.removeFromParent(); this.falls.splice(this.falls.indexOf(s), 1); }
    }
  }
  afterMove() { this.cageClamp(); }

  abortSpin(p) {
    const s = p.f2 && p.f2.spin;
    if (!s) return;
    if (s.mode === 'lasso' && s.e) { if (s.e.model) s.e.model.rotation.x = 0; this.release(s.e, 0.6); }
    p.f2.spin = null;
    this.unlash(p);
  }
  cleanPlayer(p) { this.dropFor(p); }
  // Troca de arma/herói ou fim: solta o que estava com este herói.
  dropFor(p) {
    if (!p.f2) return;
    this.abortSpin(p);
    this.dropBall(p);
    p.f2.fly = null; p.f2.orbit = null; p.f2.bite = null;
    this.unlash(p);
    const g = this.faces.get(p); if (g) { g.removeFromParent(); this.faces.delete(p); }
    const ex = this.extra.get(p); if (ex) { for (const h of ex) { this.rm(h.m); this.rm(h.rope); } this.extra.delete(p); }
  }
  rm(o) { if (o) { o.removeFromParent(); dispose(o); } }
  clear() {
    for (const p of this.c.players) if (p.f2) { this.abortSpin(p); this.dropBall(p); p.f2.fly = null; p.f2.orbit = null; p.f2.bite = null; this.unlash(p); p.f2.hits = []; }
    for (const k of this.cuffs) this.rm(k.m);
    for (const m of this.meteors) { this.rm(m.m); this.rm(m.ring); }
    for (const h of this.heads) { this.rm(h.m); this.rm(h.rope); }
    for (const g of this.cages) this.rm(g.m);
    for (const s of this.slicks) this.rm(s.m);
    for (const b of this.bells) this.rm(b.m);
    for (const s of this.falls) s.m.removeFromParent();
    for (const e of this.c.enemies) e.f2Bell = null;
    this.cuffs = []; this.bowls = []; this.meteors = []; this.heads = []; this.cages = []; this.slicks = []; this.bells = []; this.falls = [];
  }
}
