// Bênçãos ÉPICAS, lote 1 (lista do dono, 11/11/2026): os efeitos.
// Dados e textos em e1bless.js (números em E1). combat.e1 = E1Kit. Partes do herói (Levante, modo do Lenhador,
// carga do Bastão do Rei Macaco, voo do Meteoro, chute) ficam nas funções exportadas no fim.
import * as THREE from 'three';
import { audio } from './audio.js';
import { E1 } from './e1bless.js';
import { fear } from './axekit3.js';
import { setFlash } from './characters.js';
import { makePit, makeMeteorBall, makeTarget, makeYeti, levanteUi } from './e1props.js';

const W = (p) => (p && p.stats && p.stats.w) || {};
const wpn = (p, hero, id) => !!(p && p.heroId === hero && p.hero && p.hero.weaponId === id);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const e1S = (p) => p.e1s || (p.e1s = { lenHits: 0, frenzyT: 0, smokeT: 0, giant: 0, giantK: 0, metKills: 0, met: null, levante: 0, levTries: 0, staff: null, kick: null, hits: [], seq: -1 });
const anyE1 = (w) => { for (const k in w) if (k.startsWith('e1')) return true; return false; };
const NO_PIT = ['held', 'thrown', 'spawn', 'rage', 'dead', 'roll', 'hop', 'tpOut', 'tpIn', 'headless', 'e1Pit', 'lanceHeld', 'lanceFly', 'fistHeld', 'fistFly'];

let C = null; // o kit da partida (para as funções do herói)

export class E1Kit {
  constructor(c) {
    this.c = c; C = this;
    this.t = 0;
    this.pits = [];     // Chute Espartano: { g, x, z, t, life, e }
    this.yeti = null;   // Gelo Ancestral
    this.yetiCd = 0;
  }
  log(o) { if (this.c.log) this.c.log(o); }
  get players() { return this.c.players; }
  bounds() { const b = this.c.world && this.c.world.bounds; return b || { x: 12, z: 10 }; }

  // ---------- Antes do dano: Levante (+25% por vez) e Sangue de Gigante (+5% por abate) ----------
  damage(p) {
    const s = p.e1s;
    if (!s) return null;
    const mul = (1 + E1.levante.dmg * s.levante) * (1 + E1.gigante.per * s.giant);
    return mul === 1 ? null : { mul };
  }

  // ---------- Cada inimigo acertado por um golpe corpo a corpo ----------
  onHit(p, e, step, r) {
    const w = W(p);
    if (!anyE1(w)) return;
    const s = e1S(p);
    if (s.seq !== p.swingSeq) { s.seq = p.swingSeq; s.hits = []; }
    s.hits.push({ e, r });
    // Lenhador Obstinado: conta os acertos do 1º golpe do combo.
    if (w.e1Lenhador && wpn(p, 'knight', 'machado') && !(s.frenzyT > 0) && !p.xstep && p.hero.combo.indexOf(step) === 0) {
      s.lenHits++;
      if (s.lenHits >= E1.lenhador.hits) { s.lenHits = 0; this.frenzy(p); }
    }
  }

  // ---------- Depois do golpe inteiro: Berço de Newton, Chute Espartano ----------
  afterStrike(p, step, hits) {
    const w = W(p), s = p.e1s;
    if (!s || !step.heavy || s.seq !== p.swingSeq || !s.hits.length) return;
    if (w.e1Newton && wpn(p, 'knight', 'mangual')) this.newton(p, step, s.hits);
    if (w.e1Chute && wpn(p, 'knight', 'lanca')) {
      const h = s.hits.find((x) => x.r !== 'blocked' && x.e.alive && !x.e.undead);
      if (h) s.kick = { t: 0, e: h.e };
    }
  }

  // Berço de Newton: os da fila não se mexem; só o último voa, com o dano somado de todos.
  newton(p, step, hits) {
    const c = this.c, N = E1.newton;
    let first = null, fd = Infinity;
    for (const h of hits) {
      if (h.r === 'blocked' || !h.e.alive || h.e.undead) continue;
      const d = Math.hypot(h.e.position.x - p.position.x, h.e.position.z - p.position.z);
      if (d < fd) { fd = d; first = h.e; }
    }
    if (!first) return;
    const dx = first.position.x - p.position.x, dz = first.position.z - p.position.z, d0 = Math.hypot(dx, dz) || 0.01;
    const ux = dx / d0, uz = dz / d0;
    // Fila: inimigos atrás do primeiro, na mesma linha, cada um a no máximo N.gap do anterior.
    const cand = [];
    for (const o of c.enemies) {
      if (o === first || !o.targetable || o.undead) continue;
      const rx = o.position.x - first.position.x, rz = o.position.z - first.position.z;
      const along = rx * ux + rz * uz, side = Math.abs(rx * uz - rz * ux);
      if (along > 0.2 && side <= N.width + o.data.radius * 0.5) cand.push([along, o]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const line = [first];
    let last = 0;
    for (const [along, o] of cand) {
      if (along - last > N.gap || line.length >= N.max) break;
      line.push(o); last = along;
    }
    if (line.length < 2) return;
    const end = line[line.length - 1];
    const each = step.damage * p.stats.damageMul;
    const total = Math.max(1, Math.round(each * line.length));
    // Os da frente ficam parados (a força passa por eles).
    for (const o of line.slice(0, -1)) {
      o.vel.set(0, 0, 0);
      c.vfx.sparks(v3(o.position.x, 1.2, o.position.z), 0xd8c8ff, 8);
    }
    for (let i = 0; i < line.length - 1; i++) { // o "estalo" passando de um para o outro
      const a = line[i].position, b = line[i + 1].position;
      c.vfx.lightning(v3(a.x, 1.1, a.z), v3(b.x, 1.1, b.z), 0xd8c8ff, 0.12);
    }
    audio.play('shieldBlock', first.position.x, first.position.z, { v: 1.1 });
    audio.play('hitHeavy', end.position.x, end.position.z, { v: 1.2 });
    c.text.add('Berço de Newton!', first.position, 'crit', 3.6);
    c.bonusDamage(end, total, ux, uz, 'dmg big', p);
    if (end.alive && !end.data.boss && c.fist) c.fist.launch(p, end, ux, uz, { speed: N.speed, distTotal: N.fly, path: Math.round(step.damage), land: 0 });
    else if (end.alive && end.offBalance) end.offBalance(ux, uz, 0.8, 18);
    c.addHitstop(0.08); c.shakeFor(p, 0.3);
    this.log({ type: 'e1Newton', n: line.length, dmg: total, last: end, first });
  }

  // ---------- Inimigo derrotado: Sangue de Gigante, Meteoro ----------
  onKill(e, by) {
    if (!by || !by.hero) return;
    const w = W(by);
    if (!anyE1(w)) return;
    const s = e1S(by);
    if (w.e1Gigante && wpn(by, 'knight', 'machado') && s.giant < E1.gigante.max) {
      s.giant++;
      by.hp = Math.min(by.maxHp, by.hp + E1.gigante.hp);
      if (s.giant === E1.gigante.max) this.c.text.add('Gigante!', by.position, 'crit', 3.8);
      this.log({ type: 'e1Grow', n: s.giant });
    }
    if (w.e1Meteoro && wpn(by, 'knight', 'mangual') && by.state !== 'e1Meteor' && s.metKills < E1.meteoro.kills) {
      s.metKills++;
      const left = E1.meteoro.kills - s.metKills;
      if (left === 5 || left === 0) this.c.text.add(left ? `Meteoro: falta ${left}` : 'Meteoro pronto!', by.position, 'gold', 3.4);
    }
  }

  // ---------- Herói tomou dano: Sangue de Gigante encolhe ----------
  onHurt(p) {
    const s = p.e1s;
    if (!s || !(s.giant > 0)) return;
    s.giant--;
    if (p.hp > p.maxHp) p.hp = p.maxHp;
    this.log({ type: 'e1Shrink', n: s.giant });
  }

  // ---------- Lenhador Obstinado ----------
  frenzy(p) {
    const s = e1S(p), c = this.c;
    s.frenzyT = E1.lenhador.time;
    c.text.add('Obstinado!', p.position, 'crit', 3.8);
    c.vfx.burst(p.position, 0xff3a1a);
    audio.play('warcry', p.position.x, p.position.z, { v: 0.9 });
    c.shakeFor(p, 0.25);
    this.log({ type: 'e1Frenzy' });
  }

  // ---------- Meteoro ----------
  meteorReady(p) {
    const s = p.e1s;
    if (!s || !W(p).e1Meteoro || !wpn(p, 'knight', 'mangual') || s.metKills < E1.meteoro.kills) return false;
    if (!['idle', 'run', 'attack', 'block', 'hurt'].includes(p.state)) return false;
    return this.c.enemies.some((e) => e.targetable && !e.undead);
  }
  startMeteor(p) {
    const s = e1S(p), c = this.c;
    s.metKills = 0;
    p.combo = 0; p.queued = false; p.vel.set(0, 0, 0);
    if (p.clearRoll) p.clearRoll();
    p.setGlow(0);
    p.setState('e1Meteor');
    p.anim.play('Melee_2H_Attack_Spinning', { restart: true, fade: 0.06, speed: 1.6 });
    s.met = { phase: 'spin', t: 0, ball: null, target: null, fled: new Set(), spot: { position: v3(p.position.x, 0, p.position.z) } };
    c.text.add('Meteoro!', p.position, 'crit', 4.0);
    audio.play('spin', p.position.x, p.position.z, { v: 1.2 });
    this.log({ type: 'e1MeteorStart' });
  }
  // A cada quadro do voo (no lugar do update do herói). Devolve 'end' quando acabou.
  meteorTick(p, dt, world, input) {
    const s = p.e1s, M = s && s.met, E = E1.meteoro, c = this.c;
    if (!M) return 'end';
    M.t += dt;
    const top = 18;
    if (M.phase === 'spin') {
      if (Math.random() < dt * 30) { const a = Math.random() * 6.28; c.vfx.sparks(v3(p.position.x + Math.sin(a) * 1.4, 1.3, p.position.z + Math.cos(a) * 1.4), 0xb9a2ff, 2); }
      if (M.t >= E.spin) { M.phase = 'up'; M.t = 0; c.vfx.dust(v3(p.position.x, 0.1, p.position.z), v3(0, 1, 0), 14); c.vfx.ring(v3(p.position.x, 0.2, p.position.z), 0xb9a2ff, 3); audio.play('dodge', p.position.x, p.position.z, { v: 1.2 }); }
      return null;
    }
    if (M.phase === 'up') {
      const k = Math.min(1, M.t / E.up);
      p.model.position.y = top * k * k;
      if (M.t >= E.up) {
        M.phase = 'aim'; M.t = 0;
        p.model.visible = false;
        M.target = makeTarget(E.r);
        M.target.position.set(p.position.x, 0.12, p.position.z);
        c.scene.add(M.target);
        c.text.add('Escolha onde cair!', p.position, 'gold', 3.6);
      }
      return null;
    }
    if (M.phase === 'aim') {
      const mv = v3(0, 0, 0);
      if (input && input.moveDir) input.moveDir(mv);
      if (mv.lengthSq() > 0) { mv.normalize(); p.move(mv.x, mv.z, E.aimSpeed * dt, world); }
      M.spot.position.set(p.position.x, 0, p.position.z);
      M.target.position.set(p.position.x, 0.12, p.position.z);
      const pulse = 1 + 0.06 * Math.sin(M.t * 14);
      M.target.scale.setScalar(pulse);
      M.target.userData.cross.rotation.y += dt * 2.5;
      // Os inimigos tentam fugir do alvo (chefes não).
      for (const e of c.enemies) {
        if (M.fled.has(e) || e.undead || !e.alive) continue;
        if (fear(e, M.spot, E.aim - M.t + E.fall + 0.3)) M.fled.add(e);
      }
      if (M.t >= E.aim || (M.t > 0.4 && input && input.attack && input.attack())) { // atacar = cair agora
        M.phase = 'fall'; M.t = 0;
        M.ball = makeMeteorBall(1.5);
        c.scene.add(M.ball);
        p.model.visible = true;
        p.facing = 0; p.group.rotation.y = 0; // de frente para a câmera, montado na bola
        audio.play('fireRoar', p.position.x, p.position.z, { v: 0.9 });
        p.anim.play('Melee_Unarmed_Idle', { fade: 0.05 });
      }
      return null;
    }
    if (M.phase === 'fall') { // vem do fundo da sala, em diagonal, e cai no círculo
      const k = Math.min(1, M.t / E.fall), y = 11 * (1 - k * k), back = 9 * (1 - k);
      M.ball.position.set(p.position.x, y + 1.5, p.position.z - back);
      p.model.position.z = -back;
      M.ball.rotation.x += dt * 9; M.ball.rotation.z += dt * 5;
      p.model.position.y = y + 3.2;
      M.target.position.set(p.position.x, 0.12, p.position.z);
      M.target.scale.setScalar(1 + 0.15 * Math.sin(M.t * 30));
      for (let i = 0; i < 3; i++) c.vfx.sparks(v3(p.position.x + (Math.random() - 0.5) * 2, y + 1.5 + Math.random() * 2.5, p.position.z + (Math.random() - 0.5) * 2), Math.random() < 0.5 ? 0xff7a1a : 0xffd060, 2);
      if (M.t >= E.fall) { p.model.position.z = 0; this.impact(p); M.phase = 'land'; M.t = 0; }
      return null;
    }
    if (M.phase === 'land') {
      const k = Math.min(1, M.t / E.land);
      if (M.ball) { M.ball.scale.setScalar(1 - k); M.ball.position.y = 1.5 * (1 - k); }
      p.model.position.y = 3.2 * (1 - k) * (1 - k);
      if (M.t >= E.land) { this.endMeteor(p); return 'end'; }
      return null;
    }
    return 'end';
  }
  impact(p) {
    const c = this.c, E = E1.meteoro, x = p.position.x, z = p.position.z;
    let killedN = 0, bossN = 0;
    for (const e of [...c.enemies]) {
      if (!e.alive || e.undead) continue;
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      if (d > E.r + e.data.radius) {
        if (d < E.r + 3 && e.offBalance && e.targetable) e.offBalance(dx / d, dz / d, 0.6, 12); // a onda empurra quem ficou perto
        continue;
      }
      if (!e.targetable && e.state !== 'axeFear') continue;
      if (e.data.boss) { c.bonusDamage(e, Math.max(1, Math.round(e.maxHp * E.boss)), dx / d, dz / d, 'dmg big', p); bossN++; continue; }
      e.lastHitBy = p;
      e.hp = 0; e.die();
      c.text.add('Esmagado!', e.position, 'crit', 3.2);
      c.killed(e, dx / d, dz / d, p);
      killedN++;
    }
    const at = v3(x, 0, z);
    c.vfx.heavyImpact(at, 3);
    c.vfx.ring(at, 0xff7a1a, E.r + 1.5);
    c.vfx.ring(at, 0xffd060, E.r);
    c.vfx.flameCone(v3(x, 0.6, z), 0, E.r, Math.PI, 0xff7a2a, true);
    c.vfx.dust(at, v3(0, 1, 0), 24);
    for (let i = 0; i < 24; i++) { const a = Math.random() * 6.28, r = Math.random() * E.r; c.vfx.sparks(v3(x + Math.sin(a) * r, 0.5 + Math.random(), z + Math.cos(a) * r), Math.random() < 0.5 ? 0xff7a1a : 0xffd060, 2); }
    audio.play('boom', x, z, { v: 1.4 });
    audio.play('thump', x, z, { v: 1.4 });
    c.shakeFor(p, 0.8);
    c.addHitstop(0.12);
    p.anim.play('Melee_1H_Attack_Chop', { once: true, restart: true, fade: 0.05, speed: 1.4 });
    this.log({ type: 'e1MeteorHit', killed: killedN, boss: bossN, x, z });
  }
  endMeteor(p) {
    const s = p.e1s, M = s && s.met, c = this.c;
    if (M) {
      if (M.ball) c.scene.remove(M.ball);
      if (M.target) c.scene.remove(M.target);
    }
    if (s) s.met = null;
    if (p.model) { p.model.position.y = 0; p.model.position.z = 0; p.model.visible = true; }
  }

  // ---------- Chute Espartano ----------
  kickTick(p, s, dt) {
    const K = s.kick;
    K.t += dt;
    if (!K.started) {
      if (K.t < E1.chute.delay) return;
      if (!K.e.alive || p.state === 'dead' || !['attack', 'idle', 'run'].includes(p.state)) { s.kick = null; return; }
      K.started = true; K.t = 0;
      const e = K.e;
      p.facing = Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z); p.group.rotation.y = p.facing;
      p.combo = 0; p.queued = false;
      p.setState('e1Kick');
      p.anim.play('Melee_Unarmed_Attack_Kick', { once: true, restart: true, fade: 0.05, speed: 1.7 });
      return;
    }
    if (p.state !== 'e1Kick') { s.kick = null; return; } // apanhou no meio do chute
    if (!K.kicked && K.t >= E1.chute.kick * 0.45) { K.kicked = true; this.kick(p, K.e); s.kick = null; }
  }
  kick(p, e) {
    const c = this.c, K = E1.chute;
    if (!e.alive) return;
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
    const ux = dx / d, uz = dz / d;
    if (d > p.hero.attackRange * p.stats.rangeMul + 2.5) return; // longe demais: o chute não alcança
    audio.play('hitHeavy', e.position.x, e.position.z, { v: 1.1 });
    c.vfx.sparks(v3(e.position.x - ux * 0.4, 1.0, e.position.z - uz * 0.4), 0xffe6a0, 12);
    c.text.add('Isto é... um chute!', p.position, 'crit', 3.6);
    if (e.data.boss || NO_PIT.includes(e.state) || !e.targetable) {
      if (e.offBalance) e.offBalance(ux, uz, 0.6, 16);
      this.log({ type: 'e1KickPush', enemy: e });
      return;
    }
    // O poço abre logo atrás dele.
    const pos = v3(e.position.x + ux * K.back, 0, e.position.z + uz * K.back);
    if (c.world) c.world.clampInside(pos, K.pit + 0.3);
    const g = makePit(K.pit);
    g.position.set(pos.x, 0, pos.z);
    g.scale.setScalar(0.01);
    c.scene.add(g);
    const pit = { g, x: pos.x, z: pos.z, t: 0, life: 9, e, open: 0 };
    this.pits.push(pit);
    c.vfx.dust(v3(pos.x, 0.1, pos.z), v3(0, 1, 0), 14);
    audio.play('crunch', pos.x, pos.z, { v: 1.0 });
    c.shakeFor(p, 0.25);
    e.releaseToken();
    if (e.atk && e.state === 'attack' && e.endAttack) e.endAttack();
    e.vel.set(0, 0, 0);
    e.e1Pit = { pit, phase: 'slide', t: 0, x0: e.position.x, z0: e.position.z, minion: e.type === 'minion', by: p };
    e.setState('e1Pit');
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.6 });
    this.log({ type: 'e1Kick', enemy: e, minion: e.type === 'minion' });
  }
  // Esqueleto no poço (estado e1Pit; chamado pelo update do esqueleto).
  pitTick(e, dt) {
    const P = e.e1Pit, c = this.c, K = E1.chute;
    if (!P) { e.setState('chase'); return; }
    P.t += dt;
    if (P.phase === 'slide') {
      const k = Math.min(1, P.t / 0.18);
      e.position.x = P.x0 + (P.pit.x - P.x0) * k; e.position.z = P.z0 + (P.pit.z - P.z0) * k;
      if (k >= 1) { P.phase = 'fall'; P.t = 0; audio.play('swingHeavy', e.position.x, e.position.z, { v: 0.6 }); }
      return;
    }
    if (P.phase === 'fall') {
      const k = Math.min(1, P.t / 0.45);
      e.model.position.y = -2.8 * k * k;
      e.model.rotation.x = -0.6 * k;
      if (k < 1) return;
      e.group.visible = false;
      if (P.minion) { // lacaio: cai e some
        c.text.add('Caiu no poço!', e.position, 'crit', 3.0);
        c.vfx.dust(v3(e.position.x, 0.2, e.position.z), v3(0, 1, 0), 10);
        audio.play('bones', e.position.x, e.position.z, { v: 0.7 });
        e.e1Pit = null;
        e.lastHitBy = P.by;
        e.hp = 0;
        e.shattered = true; // sem ossos voando: ele ficou lá embaixo
        e.die();
        e.group.visible = false;
        c.killed(e, 0, 1, P.by);
        P.pit.e = null;
        this.log({ type: 'e1PitKill', enemy: e });
        return;
      }
      P.phase = 'under'; P.t = 0;
      this.log({ type: 'e1PitFall', enemy: e });
      return;
    }
    if (P.phase === 'under') {
      if (P.t < K.under) return;
      P.phase = 'climb'; P.t = 0;
      const a = Math.random() * Math.PI * 2;
      const pos = v3(P.pit.x + Math.sin(a) * (K.pit + 0.5), 0, P.pit.z + Math.cos(a) * (K.pit + 0.5));
      if (c.world) c.world.resolveCircle(pos, e.data.radius);
      e.position.x = pos.x; e.position.z = pos.z;
      e.facing = a; e.group.rotation.y = a;
      e.group.visible = true;
      e.model.rotation.x = 0;
      e.anim.play('Skeletons_Awaken_Floor', { once: true, restart: true, fade: 0.05, speed: 2.2 });
      return;
    }
    if (P.phase === 'climb') {
      const k = Math.min(1, P.t / 0.5);
      e.model.position.y = -2.2 * (1 - k);
      if (k < 1) return;
      e.model.position.y = 0;
      e.e1Pit = null;
      P.pit.e = null;
      const dmg = Math.max(1, Math.round(e.maxHp * K.hp));
      e.setState('hurt'); e.stunTime = 0.35;
      e.anim.play(e.data.anims.idle, { fade: 0.15 });
      e.hp -= dmg; e.flash = 1; e.lastHitBy = P.by;
      c.text.add(`${dmg}`, e.position, 'dmg big', 2.6);
      c.text.add('Voltou do poço!', e.position, 'hurt', 3.4);
      if (e.hp <= 0) { e.die(); c.killed(e, 0, 1, P.by); }
      this.log({ type: 'e1PitClimb', enemy: e, dmg });
    }
  }

  // ---------- Gelo Ancestral: o Yeti ----------
  yetiOwner() { return this.players.find((p) => W(p).e1Yeti && wpn(p, 'mage', 'gelo') && p.state !== 'dead'); }
  frozenFoes() { return this.c.enemies.filter((e) => e.alive && !e.undead && e.frozenT > 0 && e.state !== 'e1Pit'); }
  spawnYeti(owner) {
    const c = this.c, Y = E1.yeti, b = this.bounds();
    const fz = this.frozenFoes();
    let cx = 0; for (const e of fz) cx += e.position.x; cx /= Math.max(1, fz.length);
    const x = Math.max(-b.x + 1.8, Math.min(b.x - 1.8, cx));
    const ye = makeYeti(Y.scale);
    ye.group.position.set(x, 0, -b.z - 3.5);
    ye.group.rotation.y = 0;
    c.scene.add(ye.group);
    ye.anim.play('Jump_Full_Long', { once: true, restart: true, fade: 0, speed: 0.9 });
    this.yeti = { ...ye, owner, phase: 'jump', t: 0, from: { x, z: -b.z - 3.5 }, to: { x, z: -b.z + 1.8 }, target: null, hit: false, facing: 0 };
    audio.play('warcry', x, -b.z, { v: 1.2 });
    c.text.add('Gelo Ancestral!', owner.position, 'crit', 3.8);
    this.log({ type: 'e1Yeti', frozen: fz.length });
  }
  yetiTick(dt) {
    const Y = this.yeti, c = this.c, E = E1.yeti, b = this.bounds();
    Y.t += dt;
    Y.anim.update(dt);
    const pos = Y.group.position;
    const face = (a) => { Y.facing += wrap(a - Y.facing) * Math.min(1, dt * 10); Y.group.rotation.y = Y.facing; };
    if (Y.phase === 'jump' || Y.phase === 'jumpOut') {
      const k = Math.min(1, Y.t / E.jump);
      pos.x = Y.from.x + (Y.to.x - Y.from.x) * k; pos.z = Y.from.z + (Y.to.z - Y.from.z) * k;
      pos.y = 6.5 * Math.sin(Math.PI * k) + (Y.phase === 'jump' ? 0 : 0);
      face(Math.atan2(Y.to.x - Y.from.x, Y.to.z - Y.from.z));
      if (k < 1) return;
      pos.y = 0;
      if (Y.phase === 'jumpOut') { c.scene.remove(Y.group); this.yeti = null; this.yetiCd = E.cd; this.log({ type: 'e1YetiGone' }); return; }
      c.vfx.dust(v3(pos.x, 0.1, pos.z), v3(0, 1, 0), 16);
      c.vfx.ring(v3(pos.x, 0.2, pos.z), 0xbff0ff, 3);
      audio.play('thump', pos.x, pos.z, { v: 1.3 });
      c.shakeFor(Y.owner, 0.35);
      Y.phase = 'hunt'; Y.t = 0;
      return;
    }
    if (Y.phase === 'attack') {
      const pr = Y.anim.progress();
      if (!Y.hit && pr >= 0.45) {
        Y.hit = true;
        const e = Y.target;
        if (e && e.alive && e.targetable) {
          const dx = e.position.x - pos.x, dz = e.position.z - pos.z, d = Math.hypot(dx, dz) || 0.01;
          c.bonusDamage(e, Math.max(1, Math.round(E.dmg * Y.owner.stats.damageMul)), dx / d, dz / d, 'dmg big', Y.owner);
          c.vfx.sparks(v3(e.position.x, 1.3, e.position.z), 0xcff4ff, 18);
          c.vfx.ring(v3(e.position.x, 0.2, e.position.z), 0xbff0ff, 1.6);
          audio.play('hitHeavy', e.position.x, e.position.z, { v: 1.2 });
          c.shakeFor(Y.owner, 0.2);
          this.log({ type: 'e1YetiHit', enemy: e });
        }
      }
      if (pr >= 0.92) { Y.phase = 'hunt'; Y.t = 0; }
      return;
    }
    if (Y.phase === 'hunt') {
      let best = null, bd = Infinity;
      for (const e of this.frozenFoes()) {
        if (!e.targetable) continue;
        const d = Math.hypot(e.position.x - pos.x, e.position.z - pos.z);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) { Y.phase = 'leave'; Y.t = 0; Y.anim.play('Running_A', { fade: 0.15 }); return; }
      Y.target = best;
      const dx = best.position.x - pos.x, dz = best.position.z - pos.z;
      face(Math.atan2(dx, dz));
      if (bd <= E.hitR + best.data.radius) {
        Y.phase = 'attack'; Y.hit = false; Y.t = 0;
        Y.anim.play('Melee_2H_Attack_Chop', { once: true, restart: true, fade: 0.08, speed: 1.35 });
        return;
      }
      const st = Math.min(bd, E.speed * dt);
      pos.x += dx / bd * st; pos.z += dz / bd * st;
      if (c.world) c.world.resolveCircle(pos, 0.9);
      Y.anim.play('Running_A', { fade: 0.15, speed: 1.2 });
      return;
    }
    if (Y.phase === 'leave') { // corre até a parede do fundo e pula para fora
      const gx = Math.max(-b.x + 1.8, Math.min(b.x - 1.8, pos.x)), gz = -b.z + 1.6;
      const dx = gx - pos.x, dz = gz - pos.z, d = Math.hypot(dx, dz);
      if (this.frozenFoes().some((e) => e.targetable)) { Y.phase = 'hunt'; return; } // mais um congelou: volta
      if (d < 0.4 || Y.t > 3) {
        Y.phase = 'jumpOut'; Y.t = 0;
        Y.from = { x: pos.x, z: pos.z }; Y.to = { x: pos.x, z: -b.z - 3.5 };
        Y.anim.play('Jump_Full_Long', { once: true, restart: true, fade: 0.05, speed: 0.9 });
        return;
      }
      face(Math.atan2(dx, dz));
      const st = Math.min(d, E.speed * dt);
      pos.x += dx / d * st; pos.z += dz / d * st;
    }
  }

  // ---------- Sala nova ----------
  roomStart() {
    this.clearThings();
    for (const p of this.players) {
      const s = p.e1s;
      if (!s) continue;
      if (s.met) { this.endMeteor(p); if (p.state === 'e1Meteor') { p.setState('idle'); p.anim.play(p.hero.anims.idle, { fade: 0.1 }); } }
      s.kick = null;
    }
  }
  clearThings() {
    for (const pt of this.pits) this.c.scene.remove(pt.g);
    this.pits.length = 0;
    if (this.yeti) { this.c.scene.remove(this.yeti.group); this.yeti = null; }
    this.yetiCd = 0;
  }

  tick(dt) {
    this.t += dt;
    const c = this.c;
    for (const p of this.players) {
      const s = p.e1s, w = W(p);
      if (!s && !anyE1(w)) continue;
      const S = e1S(p);
      // Lenhador Obstinado: pisca em vermelho e solta fumaça.
      if (S.frenzyT > 0) {
        S.frenzyT -= dt;
        if (p.state === 'dead') S.frenzyT = 0;
        if (S.frenzyT > 0) {
          setFlash(p.bodyMats, 0.35 + 0.3 * Math.sin(this.t * 22), 1, 0.15, 0.1);
          if ((S.smokeT -= dt) <= 0) { S.smokeT = 0.1; c.vfx.smoke(v3(p.position.x + (Math.random() - 0.5) * 0.6, 2.2, p.position.z + (Math.random() - 0.5) * 0.6), 0x6a6460, 2); }
        } else { setFlash(p.bodyMats, 0); c.text.add('Cansou...', p.position, 'miss', 3.2); this.log({ type: 'e1FrenzyEnd' }); }
      }
      // Sangue de Gigante: o tamanho vai até o número de abates.
      const want = 1 + E1.gigante.per * (S.giant || 0);
      if (Math.abs(S.giantK - want) > 0.001 || (S.giantK === 0 && want !== 1)) {
        S.giantK = S.giantK ? S.giantK + (want - S.giantK) * Math.min(1, dt * 6) : want;
        if (p.model) p.model.scale.setScalar(S.giantK);
      }
      // Meteoro pronto: sai assim que houver inimigo na sala.
      if (S.metKills >= E1.meteoro.kills && !S.met && this.meteorReady(p)) this.startMeteor(p);
      if (S.kick) this.kickTick(p, S, dt);
      // Bastão do Rei Macaco: largou a carga no meio (apanhou, rolou...): a lança volta ao normal.
      if (S.staff && p.state !== 'e1Staff') staffReset(p);
    }
    // Poços: abrem rápido, ficam enquanto alguém está lá embaixo e fecham.
    for (let i = this.pits.length - 1; i >= 0; i--) {
      const pt = this.pits[i];
      pt.t += dt;
      if (pt.e && (!pt.e.alive || pt.e.state !== 'e1Pit')) pt.e = null;
      const closing = !pt.e && pt.t > 1.2;
      pt.open = closing ? Math.max(0, pt.open - dt * 2.5) : Math.min(1, pt.open + dt * 8);
      pt.g.scale.setScalar(Math.max(0.01, pt.open));
      if (closing && pt.open <= 0) { c.scene.remove(pt.g); this.pits.splice(i, 1); }
    }
    // Gelo Ancestral.
    if (this.yetiCd > 0) this.yetiCd -= dt;
    if (this.yeti) this.yetiTick(dt);
    else if (this.yetiCd <= 0) {
      const o = this.yetiOwner();
      if (o && this.frozenFoes().length >= E1.yeti.need) this.spawnYeti(o);
    }
  }

  clear() {
    this.clearThings();
    for (const p of this.players) {
      const s = p.e1s;
      if (!s) continue;
      if (s.met) this.endMeteor(p);
      s.kick = null; s.frenzyT = 0;
      if (s.staff) staffReset(p);
    }
    levanteUi.hide();
  }
}

// ================= Herói (player.js) =================
export const e1Frenzy = (p) => !!(p.e1s && p.e1s.frenzyT > 0);
export const e1Invuln = (p) => e1Frenzy(p) || p.state === 'e1Meteor';
export const e1CanDodge = (p) => !e1Frenzy(p) && p.state !== 'e1Meteor' && p.state !== 'e1Staff';
export const e1RangeMul = (p) => (p.e1s && p.e1s.giant ? 1 + E1.gigante.per * p.e1s.giant : 1);
export const e1HpBonus = (p) => (p.e1s && p.e1s.giant ? E1.gigante.hp * p.e1s.giant : 0);
export function e1AtkMul(p) {
  const s = p.e1s;
  if (!s) return 1;
  return (1 + E1.levante.spd * s.levante) * (1 - E1.gigante.spd * (s.giant || 0)) * (s.frenzyT > 0 ? 1 + E1.lenhador.spd : 1);
}
export const e1FrenzyMove = () => E1.lenhador.move;

// Levante (Manopla): no lugar de morrer, a tela preta com o botão de ataque. true = o desafio começou.
export function e1Die(p) {
  if (!W(p).e1Levante || !wpn(p, 'knight', 'manopla') || !p.onScene || p.state === 'ultCine') return false;
  const s = e1S(p), L = E1.levante;
  s.levTries++;
  const need = L.need0 + L.needAdd * (s.levTries - 1);
  let count = 0, done = null, doneAt = 0, rose = false;
  const startDelay = 0.35;
  p.hp = 0;
  p.onScene({
    p, time: L.time + startDelay + 2, zoom: 0.55, actors: [],
    start() {
      p.combo = 0; p.queued = false; p.vel.set(0, 0, 0);
      if (p.clearRoll) p.clearRoll();
      p.setGlow(0);
      p.setState('ultCine');
      p.anim.play(p.hero.anims.death, { once: true, restart: true, fade: 0.06, speed: 1.4 });
      levanteUi.show(need);
      audio.play('heroDeath', p.position.x, p.position.z, { v: 0.7 });
      if (C) C.log({ type: 'e1LevanteStart', need });
    },
    tick(t) {
      if (done) {
        if (done === 'win' && !rose && t >= doneAt + 0.2) { rose = true; levanteUi.hide(); p.anim.play('Lie_StandUp', { once: true, restart: true, fade: 0.1, speed: 1.5 }); }
        return;
      }
      const inp = p.input;
      if (t > startDelay && inp && inp.attack && inp.attack()) { count++; levanteUi.press(); audio.play('hit', p.position.x, p.position.z, { v: 0.35 }); }
      const left = L.time - Math.max(0, t - startDelay);
      levanteUi.set(count, need, left);
      if (count >= need) { done = 'win'; doneAt = t; this.time = t + 1.3; levanteUi.result(true); audio.play('warcry', p.position.x, p.position.z, { v: 1.0 }); }
      else if (left <= 0) { done = 'lose'; doneAt = t; this.time = t + 0.7; levanteUi.result(false); }
    },
    end() {
      levanteUi.hide();
      if (done === 'win') {
        s.levante++;
        p.hp = Math.round(p.maxHp / 2);
        p.iframes = Math.max(p.iframes || 0, L.inv);
        p.setState('idle');
        p.anim.play(p.hero.anims.idle, { fade: 0.2 });
        if (C) {
          C.c.text.add('Levante!', p.position, 'crit', 4.0);
          C.c.vfx.burst(p.position, 0xffd36a);
          C.c.vfx.ring(v3(p.position.x, 0.2, p.position.z), 0xffd36a, 3.5);
          C.log({ type: 'e1LevanteWin', n: s.levante, count, need });
        }
        return;
      }
      if (C) C.log({ type: 'e1LevanteLose', count, need });
      p.e1Dying = true;
      p.die();
      p.e1Dying = false;
    },
  });
  return true;
}

// Bastão do Rei Macaco (Lança): segurando o 1º golpe, começa a crescer a lança. true = começou.
export function e1HoldCheck(p, input) {
  if (!W(p).e1Macaco || !wpn(p, 'knight', 'lanca') || p.xstep || p.combo !== 0 || p.hitDone) return false;
  if (p.stateTime < E1.macaco.hold || !(input.attackHeld && input.attackHeld())) return false;
  const s = e1S(p);
  p.setState('e1Staff');
  p.queued = false;
  s.staff = { t: 0, k: 0, full: false, phase: 'grow', base: p.weapon ? p.weapon.scale.clone() : null };
  p.anim.play('Melee_2H_Idle', { fade: 0.1 });
  if (C) { C.c.text.add('Cresça!', p.position, 'miss', 3.0); C.log({ type: 'e1StaffStart' }); }
  return true;
}
function staffScale(p, k) {
  const S = p.e1s && p.e1s.staff;
  if (!p.weapon || !S || !S.base) return;
  const M = E1.macaco.max;
  p.weapon.scale.set(S.base.x * (1 + 0.35 * k), S.base.y * (1 + (M - 1) * k), S.base.z * (1 + 0.35 * k));
}
function staffReset(p) {
  const S = p.e1s && p.e1s.staff;
  if (S && S.base && p.weapon) p.weapon.scale.copy(S.base);
  if (p.e1s) p.e1s.staff = null;
  p.setGlow(0);
}

// Estados do herói: e1Staff (lança crescendo / varrendo), e1Meteor (voo), e1Kick (chute). 'end' = acabou.
export function e1StateTick(p, dt, world, input, move, camera) {
  if (p.state === 'e1Meteor') return C ? C.meteorTick(p, dt, world, input) : 'end';
  if (p.state === 'e1Kick') return p.stateTime >= E1.chute.kick ? 'end' : null;
  const s = p.e1s, S = s && s.staff, Mq = E1.macaco;
  if (!S) return 'end';
  S.t += dt;
  if (S.phase === 'grow') {
    if (move.lengthSq() > 0) p.move(move.x, move.z, p.hero.moveSpeed * p.moveMul * Mq.move * dt, world);
    const aim = p.aimAngle(camera);
    p.facing += wrap(aim - p.facing) * Math.min(1, dt * 10);
    p.group.rotation.y = p.facing;
    if (input.attackHeld && input.attackHeld()) {
      S.k = Math.min(1, S.t / Mq.grow);
      staffScale(p, S.k * S.k * (3 - 2 * S.k));
      p.setGlow(S.full ? 0.6 + 0.4 * Math.sin(S.t * 20) : S.k * 0.6);
      if (S.k >= 1 && !S.full) {
        S.full = true;
        if (C) { C.c.text.add(`${Mq.max}×!`, p.position, 'crit', 3.6); C.c.vfx.burst(p.position, 0xffd36a); C.log({ type: 'e1StaffFull' }); }
        audio.play('charge', p.position.x, p.position.z);
      }
      return null;
    }
    if (!S.full) { // soltou antes: não funciona
      if (C) C.c.text.add('Pequena demais!', p.position, 'miss', 3.0);
      staffReset(p);
      return 'end';
    }
    S.phase = 'sweep'; S.t = 0; S.hit = false;
    p.anim.play('Melee_2H_Attack_Spinning', { once: true, restart: true, fade: 0.04, speed: 1.2 });
    audio.play('spin', p.position.x, p.position.z, { v: 1.3 });
    return null;
  }
  if (S.phase === 'sweep') {
    if (!S.hit && S.t >= 0.18 && C) { S.hit = true; C.sweep(p); }
    if (S.t >= Mq.spin) { S.phase = 'shrink'; S.t = 0; }
    return null;
  }
  // encolhendo de volta
  const k = Math.max(0, 1 - S.t / 0.25);
  staffScale(p, k);
  if (k <= 0) { staffReset(p); return 'end'; }
  return null;
}
// A varrida: acerta todos os inimigos dentro do alcance gigante (em volta).
E1Kit.prototype.sweep = function sweep(p) {
  const c = this.c, Mq = E1.macaco, h = p.hero;
  const heavy = h.combo[Math.max(0, h.heavyIdx)];
  const R = h.attackRange * p.stats.rangeMul * Mq.max;
  const step = { ...heavy, damage: heavy.damage * Mq.mul, heavy: true, arc: 360 };
  let n = 0;
  for (const e of [...c.enemies]) {
    if (!e.targetable) continue;
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
    if (d > R + e.data.radius) continue;
    if (c.damageEnemy(p, e, step, dx / d, dz / d)) n++;
  }
  c.vfx.sector(p.position, p.facing, R, Math.PI, 0x7fd6ff);
  c.vfx.ring(v3(p.position.x, 0.3, p.position.z), 0xffd36a, R * 0.45);
  c.vfx.dust(v3(p.position.x, 0.1, p.position.z), v3(0, 0, 0), 18);
  c.props.strikeArc(p, R, Math.PI, null, 0);
  c.text.add('Bastão do Rei Macaco!', p.position, 'crit', 3.8);
  if (n) { audio.play('hitHeavy', p.position.x, p.position.z, { v: 1.3 }); c.addHitstop(0.08); }
  c.shakeFor(p, 0.5);
  this.log({ type: 'e1Sweep', n, R });
};
