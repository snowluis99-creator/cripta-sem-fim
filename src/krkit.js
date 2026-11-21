// Bênçãos RARAS do Cavaleiro, lote 1 (lista do dono, 11/11/2026): os efeitos.
// Dados e textos em krbless.js (números em KR). combat.kr = KRKit. Partes do herói (andar bloqueando, Investida,
// giro do Recuem!, carga da Âncora, velocidade da Adaptação) ficam nas funções exportadas no fim.
import * as THREE from 'three';
import { audio } from './audio.js';
import { KR, lv } from './krbless.js';
import { useShield, spendShield, repairShield, shieldMax } from './shield.js';
import { kitCanBlock } from './knightkit.js';

const W = (p) => (p && p.stats && p.stats.w) || {};
const wpn = (p, id) => !!(p && p.heroId === 'knight' && p.hero && p.hero.weaponId === id);
const idxOf = (p, step) => (p && p.hero && step ? p.hero.combo.indexOf(step) : -1);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const anyKr = (w) => { for (const k in w) if (k.startsWith('kr')) return true; return false; };
export const krS = (p) => p.krs || (p.krs = { blocks: [], respKey: null, recuemUsed: false, caboCd: 0, gt: 0, at: 0, anc: null, ball: null, guard: false, spinT: 0, adaptOn: false, auraT: 0 });
const shieldHero = (p) => p && p.heroId === 'knight' && p.hero && !p.hero.noShield;
export const adaptOn = (p) => !!(W(p).krAdapt && wpn(p, 'espada') && shieldHero(p) && !(p.shield > 0));
const flailOf = (p) => p && p.weapon && p.weapon.userData && p.weapon.userData.flail;
const lash = (p, x, y, z) => { const f = flailOf(p); if (f && (!f.lash || f.lash.kr)) f.lash = { x, y, z, k: 1, kr: true }; };
const unlash = (p) => { const f = flailOf(p); if (f && f.lash && f.lash.kr) f.lash = null; };

let C = null; // o kit da partida (para as funções do herói)

export class KRKit {
  constructor(c) {
    this.c = c; C = this;
    this.t = 0;
    this.room = 0;
  }
  log(o) { if (this.c.log) this.c.log(o); }
  get players() { return this.c.players; }
  waveKey() { const wv = this.c.kit2 && this.c.kit2.waves; return `${this.room}:${wv ? wv.wave : 0}`; }

  // ---------- Antes do dano: Adaptação ----------
  damage(p, e, step) {
    if (!p || !p.hero || !adaptOn(p)) return { mul: 1, crit: false };
    return { mul: 1 + KR.adapt.dmg, crit: false };
  }

  // ---------- Golpe trocado: Ataque Inesperado (devolve true = o golpe já foi feito aqui) ----------
  strike(p, step) {
    const w = W(p);
    if (!w.krInesp || !wpn(p, 'mangual') || p.xstep || idxOf(p, step) !== 0) return false;
    if (Math.random() >= lv(KR.inesp, w.krInesp)) return false;
    this.spin360(p, step);
    return true;
  }
  spin360(p, step) {
    const c = this.c, h = p.hero, st = p.stats;
    const range = h.attackRange * st.rangeMul * c.flail2.rangeMul(p) * c.kc.rangeMul(p);
    const sp = { ...step, arc: 360 };
    c.vfx.sector(p.position, p.facing, range, Math.PI, 0xb9a2ff);
    c.vfx.ring(v3(p.position.x, 0.3, p.position.z), 0xd8c8ff, range);
    audio.play('spin', p.position.x, p.position.z, { v: 0.9 });
    let hits = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.001;
      if (d > range + e.data.radius) continue;
      if (c.damageEnemy(p, e, sp, dx / d, dz / d)) hits++;
    }
    c.props.strikeArc(p, range, Math.PI, null, 0);
    krS(p).spinT = 0.3; // o corpo dá uma volta (a bola passa em volta)
    c.text.add('Inesperado!', p.position, 'crit', 3.2);
    if (hits) { audio.play('hit', p.position.x, p.position.z); c.addHitstop(0.05); }
    c.kc.afterStrike(p, sp, hits);
    this.log({ type: 'krSpin360', hits });
  }

  // ---------- Depois do golpe inteiro: Postura Firme ----------
  afterStrike(p, step, hits) {
    const w = W(p);
    if (!w.krPostura || !step.heavy || !wpn(p, 'espada') || !shieldHero(p)) return;
    if (p.shield >= shieldMax(p) || Math.random() >= KR.postura) return;
    if (repairShield(p, 1) > 0) { this.c.text.add('Escudo +1', p.position, 'heal', 3.0); this.log({ type: 'krPostura' }); }
  }

  // ---------- Escudo segurou um golpe: Guarda Total ----------
  onBlock(p, e, opts, res) {
    const w = W(p);
    if (!w.krTotal || !wpn(p, 'espada') || opts.contact) return;
    const s = krS(p);
    s.blocks = s.blocks.filter((t) => this.t - t <= KR.total.win);
    s.blocks.push(this.t);
    if (s.blocks.length >= KR.total.n) { s.blocks = []; this.slam(p); }
  }
  slam(p) {
    const c = this.c, T = KR.total;
    let n = 0;
    for (const o of c.enemies) {
      if (!o.alive || o.undead) continue;
      if (o.daze && o.daze(o.data.boss ? T.bossStun : T.stun)) n++;
    }
    c.vfx.heavyImpact(v3(p.position.x, 0, p.position.z), 1.6);
    c.vfx.ring(v3(p.position.x, 0.2, p.position.z), 0xffe27a, 9);
    c.vfx.ring(v3(p.position.x, 0.2, p.position.z), 0xcfe4ff, 5);
    audio.play('thump', p.position.x, p.position.z, { v: 1.2 });
    audio.play('shieldBlock', p.position.x, p.position.z, { v: 1.3 });
    c.shakeFor(p, 0.4);
    c.text.add('Escudo no chão!', p.position, 'crit', 3.6);
    this.log({ type: 'krSlam', n });
  }

  // ---------- Resposta Rápida: o 1º golpe da onda é bloqueado sozinho (true = segurou) ----------
  autoBlock(p, e, nx, nz, opts) {
    const w = W(p);
    if (!w.krResp || !wpn(p, 'espada') || !shieldHero(p) || opts.contact || !(p.shield > 0) || !kitCanBlock(p)) return false;
    const s = krS(p), key = this.waveKey();
    if (s.respKey === key) return false;
    s.respKey = key;
    const c = this.c;
    const res = useShield(p, c, e);
    audio.play('shieldBlock', p.position.x, p.position.z);
    p.vel.set(nx, 0, nz).multiplyScalar(3);
    p.iframes = Math.max(p.iframes || 0, 0.3);
    c.vfx.sparks(v3(p.position.x - nx * 0.7, 1.3, p.position.z - nz * 0.7), 0xffe27a, 14);
    if (res !== 'break') c.text.add('Bloqueio automático!', p.position, 'block', 3.2);
    c.addHitstop(0.06); c.shakeFor(p, 0.12);
    this.onBlock(p, e, opts, res);
    this.log({ type: 'krAutoBlock', res });
    return true;
  }

  // ---------- Cabo de Guarda (true = o esbarrão não machuca) ----------
  bumper(p, e) { return this.cabo(p, e); }
  cabo(p, e) {
    const w = W(p);
    if (!w.krCabo || !wpn(p, 'lanca') || p.state === 'dead' || !e.targetable || e.undead) return false;
    const s = krS(p);
    if (s.caboCd > 0) return false;
    s.caboCd = KR.cabo.cd;
    const c = this.c, K = KR.cabo;
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
    const nx = dx / d, nz = dz / d;
    c.vfx.sparks(v3(e.position.x - nx * 0.4, 1.2, e.position.z - nz * 0.4), 0x7fd6ff, 10);
    audio.play('hitHeavy', e.position.x, e.position.z, { v: 0.8 });
    c.text.add('Cabo de Guarda!', p.position, 'crit', 3.2);
    c.bonusDamage(e, Math.max(1, Math.round(K.dmg * p.stats.damageMul)), nx, nz, 'dmg', p);
    if (e.alive) {
      const far = Math.max(1.5, K.reach - d);
      const flew = !e.data.boss && c.fist && c.fist.launch(p, e, nx, nz, { speed: 18, distTotal: far, path: 2, land: 0 });
      if (!flew && e.offBalance) e.offBalance(nx, nz, 0.5, 14);
    }
    this.log({ type: 'krCabo', enemy: e });
    return true;
  }

  // ---------- Herói tomou dano: Recuem! ----------
  onHurt(p) {
    const w = W(p);
    if (!w.krRecuem || !wpn(p, 'lanca') || p.state === 'dead' || p.hp <= 0 || p.hp >= p.maxHp * KR.recuem.below) return;
    const s = krS(p);
    if (s.recuemUsed) return;
    s.recuemUsed = true;
    const c = this.c, R = KR.recuem;
    p.iframes = Math.max(p.iframes || 0, R.iframes);
    p.krFly = { kind: 'spin', t: 0, T: R.spin };
    p.combo = 0;
    p.setState('krSpin');
    p.anim.play('Melee_2H_Attack_Spinning', { once: true, restart: true, fade: 0.05, speed: 1.0 });
    let n = 0;
    const dmg = Math.max(1, Math.round(R.dmg * p.stats.damageMul));
    for (const e of [...c.enemies]) {
      if (!e.targetable || e.undead || (e.data && e.data.phantom)) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      const nx = dx / d, nz = dz / d;
      const flew = !e.data.boss && c.fist && c.fist.launch(p, e, nx, nz, { speed: 24, distTotal: 60, path: 3, land: dmg });
      if (!flew && e.offBalance) e.offBalance(nx, nz, 0.8, 16);
      n++;
    }
    c.vfx.ring(v3(p.position.x, 0.3, p.position.z), 0x7fd6ff, 9);
    c.vfx.ring(v3(p.position.x, 0.3, p.position.z), 0xffffff, 4);
    c.vfx.dust(v3(p.position.x, 0.1, p.position.z), v3(0, 0, 0), 14);
    audio.play('spin', p.position.x, p.position.z, { v: 1.2 });
    audio.play('warcry', p.position.x, p.position.z, { v: 0.8 });
    c.shakeFor(p, 0.4);
    c.text.add('Recuem!', p.position, 'crit', 3.8);
    this.log({ type: 'krRecuem', n });
  }

  // Sala nova: Recuem! volta, onda conta de novo, bola volta para a mão.
  roomStart() {
    this.room++;
    for (const p of this.players) {
      const s = krS(p);
      s.recuemUsed = false; s.blocks = []; s.ball = null; s.anc = null;
      unlash(p);
    }
  }

  tick(dt) {
    this.t += dt;
    const c = this.c;
    for (const e of c.enemies) if (e.krGuardT > 0) e.krGuardT -= dt;
    for (const p of this.players) {
      const s = p.krs, w = W(p);
      if (!s && !anyKr(w)) continue;
      const S = krS(p);
      if (S.caboCd > 0) S.caboCd -= dt;
      if (S.spinT > 0 && p.model) { // Ataque Inesperado: o corpo dá uma volta
        S.spinT -= dt;
        p.model.rotation.y = S.spinT > 0 ? (1 - S.spinT / 0.3) * Math.PI * 2 : 0;
      }
      // Adaptação: avisa quando liga e solta brasas enquanto está sem escudo.
      const on = adaptOn(p);
      if (on !== S.adaptOn) {
        S.adaptOn = on;
        if (on && p.state !== 'dead') { c.text.add('Adaptação!', p.position, 'crit', 3.6); c.vfx.burst(p.position, 0xff6a3a); this.log({ type: 'krAdapt' }); }
      }
      if (on && (S.auraT -= dt) <= 0) { S.auraT = 0.35; c.vfx.sparks(v3(p.position.x, 0.6, p.position.z), 0xff6a3a, 3); }
      // Cabo de Guarda: quem chegou colado (mesmo sem esbarrar) leva a pancada.
      if (w.krCabo && S.caboCd <= 0 && wpn(p, 'lanca') && p.state !== 'dead') {
        for (const e of c.enemies) {
          if (!e.targetable || e.undead) continue;
          if (Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) > p.hero.radius + e.data.radius + KR.cabo.gap) continue;
          this.cabo(p, e); break;
        }
      }
      if (wpn(p, 'mangual')) this.flailTick(p, S, w, dt);
    }
  }

  // Mangual: bola de guarda, carga e voo da Âncora de Ferro.
  flailTick(p, s, w, dt) {
    const c = this.c;
    if (s.anc && p.state !== 'block') { // largou o bloqueio carregando: lança se já carregou, senão cancela
      const A = s.anc; s.anc = null;
      if (A.t >= KR.ancora.tap) this.launch(p, A.t);
    }
    if (s.ball) { this.ballTick(p, s, dt); return; }
    if (s.anc) { // carregando: a bola gira por cima da cabeça, cada vez mais rápido
      const k = Math.min(1, Math.max(0, (s.anc.t - KR.ancora.tap) / (KR.ancora.full - KR.ancora.tap)));
      s.at += dt * (6 + 14 * k);
      lash(p, p.position.x + Math.sin(s.at) * 1.25, 2.1, p.position.z + Math.cos(s.at) * 1.25);
      s.guard = true;
      if (k >= 1 && !s.anc.full) { s.anc.full = true; c.text.add('Carga máxima!', p.position, 'crit', 3.0); }
      return;
    }
    if (w.krBolaG && p.state === 'block') { // Bola de Guarda: balança atrás, de um lado para o outro
      const G = KR.bolaG;
      s.gt += dt;
      const th = p.facing + Math.PI + Math.sin(s.gt * G.speed) * G.swing;
      const bx = p.position.x + Math.sin(th) * G.r, bz = p.position.z + Math.cos(th) * G.r;
      lash(p, bx, 0.9, bz);
      s.guard = true;
      for (const e of [...c.enemies]) {
        if (!e.targetable || e.undead || e.krGuardT > 0) continue;
        if (Math.hypot(e.position.x - bx, e.position.z - bz) > G.hit + e.data.radius) continue;
        e.krGuardT = G.cd;
        const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
        c.vfx.sparks(v3(bx, 1.0, bz), 0xb9a2ff, 10);
        audio.play('hitHeavy', bx, bz, { v: 0.7 });
        c.bonusDamage(e, Math.max(1, Math.round(G.dmg * p.stats.damageMul)), dx / d, dz / d, 'dmg', p);
        if (e.alive && e.offBalance) e.offBalance(dx / d, dz / d, G.daze, G.push);
        c.text.add('Bola de Guarda!', e.position, 'crit', 3.0);
        this.log({ type: 'krGuardBall', enemy: e });
      }
      return;
    }
    if (s.guard) { s.guard = false; unlash(p); }
  }
  launch(p, held) {
    const A = KR.ancora, s = krS(p), c = this.c;
    const k = Math.min(1, Math.max(0, (held - A.tap) / (A.full - A.tap)));
    const dx = Math.sin(p.facing), dz = Math.cos(p.facing);
    s.ball = {
      x: p.position.x + dx * 0.8, z: p.position.z + dz * 0.8, dx, dz, dist: 0, max: A.d0 + (A.d1 - A.d0) * k,
      dmg: Math.max(1, Math.round(A.dmg * (1 + A.extra * k) * p.stats.damageMul)), back: false, k,
    };
    s.guard = true;
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.1 });
    c.text.add(k >= 1 ? 'Âncora de Ferro!' : 'Âncora!', p.position, 'crit', 3.2);
    this.log({ type: 'krAnchor', k, max: s.ball.max });
  }
  ballTick(p, s, dt) {
    const B = s.ball, A = KR.ancora, c = this.c;
    if (!B.back) {
      const step = A.speed * dt;
      for (let i = 0; i < 3 && !B.back; i++) {
        const nx = B.x + B.dx * step / 3, nz = B.z + B.dz * step / 3;
        if (c.world && c.world.blocked(nx, nz, 0.2)) { B.back = true; c.vfx.sparks(v3(B.x, 0.8, B.z), 0xffe6a0, 8); audio.play('crunch', B.x, B.z, { v: 0.6 }); break; }
        B.x = nx; B.z = nz; B.dist += step / 3;
        for (const e of [...c.enemies]) {
          if (!e.targetable || e.undead) continue;
          if (Math.hypot(e.position.x - B.x, e.position.z - B.z) > 0.45 + e.data.radius) continue;
          c.vfx.sparks(v3(B.x, 1.0, B.z), 0xb9a2ff, 14);
          audio.play('hitHeavy', B.x, B.z, { v: 1.0 });
          c.bonusDamage(e, B.dmg, B.dx, B.dz, 'dmg big', p);
          if (e.alive && e.offBalance) e.offBalance(B.dx, B.dz, 0.6, 10);
          c.addHitstop(0.05);
          B.back = true;
          this.log({ type: 'krAnchorHit', enemy: e, dmg: B.dmg, dist: B.dist });
          break;
        }
        if (B.dist >= B.max) B.back = true;
      }
    } else {
      const hx = p.position.x, hz = p.position.z;
      const dx = hx - B.x, dz = hz - B.z, d = Math.hypot(dx, dz) || 0.001;
      if (d < 1.2 || p.state === 'dead') { s.ball = null; s.guard = false; unlash(p); this.log({ type: 'krAnchorBack' }); return; }
      const step = Math.min(d, A.back * dt);
      B.x += dx / d * step; B.z += dz / d * step;
    }
    lash(p, B.x, 0.8, B.z);
  }

  clear() {
    for (const p of this.players) {
      if (!p.krs) continue;
      p.krs.ball = null; p.krs.anc = null; p.krs.guard = false; p.krs.blocks = [];
      unlash(p);
      if (p.model && p.krs.spinT > 0) { p.krs.spinT = 0; p.model.rotation.y = 0; }
    }
  }
}

// ================= Herói (player.js) =================
// Passo de Guarda: velocidade andando com o escudo levantado (0 = parado).
export function krBlockMove(p) {
  return W(p).krPasso && wpn(p, 'espada') ? p.hero.moveSpeed * KR.passo : 0;
}
// Guarda Total: o escudo cobre todos os lados.
export const krAllSides = (p) => !!(W(p).krTotal && wpn(p, 'espada'));
// Adaptação: golpes mais rápidos sem o escudo.
export const krAtkMul = (p) => (adaptOn(p) ? 1 + KR.adapt.spd : 1);
export const krInvuln = (p) => p.state === 'krBash' || p.state === 'krSpin';

// Âncora de Ferro: atacar bloqueando começa a carregar (true = usou o clique).
export function krBlockPress(p) {
  const w = W(p);
  if (!w.krAncora || !wpn(p, 'mangual')) return false;
  const s = krS(p);
  if (s.ball) return false;
  s.anc = { t: 0 };
  return true;
}
// Segurando o ataque no bloqueio (true = está carregando / soltou agora).
export function krBlockHold(p, input, dt, camera) {
  const s = p.krs, A = s && s.anc;
  if (!A) return false;
  if (input.attackHeld()) { A.t += dt; return true; }
  s.anc = null;
  if (A.t < KR.ancora.tap) { p.combo = 0; p.startAttack(camera); return true; } // toque rápido: golpe normal
  if (C) C.launch(p, A.t);
  return true;
}

// Investida de Escudo: rolar com o escudo levantado (true = começou).
export function krStartDodge(p) {
  const w = W(p);
  if (!w.krInvest || !wpn(p, 'espada') || p.state !== 'block' || !(p.shield > 0) || !kitCanBlock(p) || !C) return false;
  const d = v3(0, 0, 0);
  if (p.ctl && p.ctl.moveDir) p.ctl.moveDir(d);
  if (d.lengthSq() === 0) d.set(Math.sin(p.facing), 0, Math.cos(p.facing)); else d.normalize();
  spendShield(p, C.c);
  const I = KR.invest;
  p.krFly = { kind: 'bash', dx: d.x, dz: d.z, t: 0, T: I.dist / I.speed };
  p.facing = Math.atan2(d.x, d.z); p.group.rotation.y = p.facing;
  p.combo = 0;
  p.setState('krBash');
  p.anim.play(p.hero.anims.blocking, { fade: 0.06 });
  audio.play('dodge', p.position.x, p.position.z);
  C.c.text.add('Investida!', p.position, 'crit', 3.2);
  C.c.vfx.dust(v3(p.position.x, 0.1, p.position.z), v3(-d.x, 0, -d.z), 8);
  C.log({ type: 'krBash' });
  return true;
}

// Investida de Escudo / giro do Recuem!. Devolve 'end' quando acabou.
export function krStateTick(p, dt, world) {
  const F = p.krFly;
  if (!F) return 'end';
  F.t += dt;
  if (F.kind === 'rest' || F.kind === 'spin') { if (F.t >= F.T) { p.krFly = null; return 'end'; } return null; }
  // Investida: avança com o escudo na frente.
  const I = KR.invest, c = C && C.c;
  const step = I.speed * dt;
  const x0 = p.position.x, z0 = p.position.z;
  p.move(F.dx, F.dz, step, world);
  const moved = Math.hypot(p.position.x - x0, p.position.z - z0);
  if (c) {
    c.smashProjectiles(p, p.position.x + F.dx * 0.9, p.position.z + F.dz * 0.9, 1.3); // segura as flechas no caminho
    if (F.t > 0.05 && Math.random() < 0.5) c.vfx.dust(v3(p.position.x, 0.1, p.position.z), v3(-F.dx, 0, -F.dz), 2);
    for (const e of [...c.enemies]) {
      if (!e.targetable || e.undead) continue;
      const rx = e.position.x - p.position.x, rz = e.position.z - p.position.z, d = Math.hypot(rx, rz) || 0.01;
      if (d > p.hero.radius + e.data.radius + I.reach || rx * F.dx + rz * F.dz < -0.2) continue;
      const stun = e.data.boss ? I.bossStun : I.stun;
      if (e.daze && e.daze(stun)) { e.vel.set(F.dx, 0, F.dz).multiplyScalar(6); c.text.add('Atordoado!', e.position, 'hurt', 3.2); }
      c.vfx.sparks(v3(p.position.x + F.dx * 0.8, 1.3, p.position.z + F.dz * 0.8), 0xffe27a, 16);
      audio.play('shieldBlock', p.position.x, p.position.z, { v: 1.3 });
      audio.play('hitHeavy', e.position.x, e.position.z, { v: 0.8 });
      c.addHitstop(0.07); c.shakeFor(p, 0.2);
      C.log({ type: 'krBashHit', enemy: e, stun });
      p.krFly = { kind: 'rest', t: 0, T: 0.15 };
      return null;
    }
  }
  if (F.t >= F.T || moved < step * 0.3) { p.krFly = { kind: 'rest', t: 0, T: 0.08 }; return null; }
  return null;
}
