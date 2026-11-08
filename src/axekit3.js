// Bênçãos do Machado de Duas Mãos — 3ª leva (lista do dono, 06/11/2026).
// Força: Imparável (giro/machadada sem ser interrompido; quem encosta é empurrado), Investida Bruta (correr 1 s e
// atacar = ombrada que derruba e emenda a machadada), Arrastar a Lâmina (segurar o ataque andando acumula força),
// Grito de Guerra (3 abates seguidos: os inimigos perto fogem de medo).
// Truques: Pancada de Cabo (atacar logo depois de rolar), Machado como Escudo (segurar o ataque parado segura
// flechas e magias), Arremesso Serra (a machadada joga o machado, que fica girando no chão; o herói luta com socos).
// Diferentes: Futebol de Crânio (crânios no chão viram bola), Machado Faminto (4 s sem acertar: o machado puxa).
import * as THREE from 'three';
import { audio } from './audio.js';
import { instance } from './assets.js';
import { isAxe } from './axekit.js';
import { lineClear, navDir, checkStuck } from './brain.js';

export const AXE3 = {
  unstop: { push: 10, iframes: 0.25 },
  charge: { run: 1.0, dot: 0.93, reach: 2.6, arc: 160, down: 1.1, bump: 0.5 },
  drag: { delay: 0.2, min: 0.4, full: 2.0, speed: 0.8, r0: 2.6, r1: 3.8, d0: 16, d1: 42, push: 14 },
  warcry: { kills: 3, gap: 3.5, r: 9, time: 2, unarmed: 6, fetch: 6, grab: 0.7, slow: 0.7 },
  rollBash: { daze: 2 },
  pommel: { after: 0.45, reach: 2.4, arc: 110, off: 1.2, push: 11 },
  guard: { arc: 80 },
  saw: { dist: 4.5, fly: 20, time: 2, r: 1.8, tick: 0.25, dmg: 6, back: 21, backDmg: 14, backR: 1.2, catchR: 1.0 },
  punch: { reach: 2.1, arc: 120 },
  skull: { kick: 1.0, speed: 15, r: 0.75, damage: 16, max: 6, life: 25, aim: 14, fly: 1.6 },
  hunger: { time: 4, range: 14, speed: 24, max: 0.9, stun: 0.6, safe: 2 },
};

const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const DEG = Math.PI / 180;
const handy = (p) => isAxe(p) && !p.axeAway && !p.axeSaw; // machado na mão

// Golpes especiais (não fazem parte do combo normal; player.xstep).
export const CHARGE_STEP = { clip: 'Melee_Block_Attack', speed: 1.25, hit: 0.32, end: 0.6, window: 0.34, lunge: 2.8, damage: 12, kit: 'axeCharge', auto: true, keepFacing: true };
export const POMMEL_STEP = { clip: 'Melee_2H_Attack_Stab', speed: 1.8, hit: 0.3, end: 0.55, window: 0.32, lunge: 0.3, damage: 6, kit: 'axePommel' };
export const PUNCHES = [
  { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 1.35, hit: 0.35, end: 0.72, window: 0.4, lunge: 0.25, damage: 8, kit: 'axePunch', punch: 0 },
  { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 1.6, hit: 0.35, end: 0.72, window: 0.4, lunge: 0.25, damage: 8, kit: 'axePunch', punch: 1 },
  { clip: 'Melee_Unarmed_Attack_Kick', speed: 1.25, hit: 0.42, end: 0.82, lunge: 0.4, damage: 14, kit: 'axePunch', punch: 2, kick: true },
];

// Estados próprios do esqueleto (enemies.js -> axekit2.js -> aqui).
export const AXE3_STATES = ['axeDown', 'axeFear', 'axeFetch'];

// ---------- Herói ----------

// Imparável: girando ou na machadada forte (e na ombrada), nada interrompe.
export function axe3Unstoppable(p) {
  if (!isAxe(p) || !W(p).unstoppable || p.axeSaw) return false;
  if (p.state === 'spin') return true;
  if (p.state !== 'attack') return false;
  const s = p.xstep || p.hero.combo[p.combo];
  return !!s && (s.arc === 360 || !!s.heavy || s.kit === 'axeCharge');
}

// Machado longe (Arremesso Serra): os golpes viram socos.
export function axe3Override(p) {
  if (!p.axeSaw || !isAxe(p)) return null;
  if (p.combo >= PUNCHES.length) p.combo = 0;
  return PUNCHES[p.combo];
}
export const axe3Last = (p, xs) => (xs.punch == null ? true : xs.punch === PUNCHES.length - 1);

// Apertou o ataque (parado, correndo ou no fim do rolamento): Investida Bruta ou Maestria.
export function axe3Press(p, camera, fromDodge = false) {
  if (!handy(p)) return false;
  const w = W(p);
  if (w.maestry && (fromDodge || (p.axeSinceDodge ?? 9) <= AXE3.pommel.after)) { // Maestria: 1º golpe depois de rolar sai 2× mais rápido
    p.axeSinceDodge = 9;
    p.combo = 0;
    p.maestryNext = true;
    p.startAttack(camera);
    if (C) { C.text.add('Maestria!', p.position, 'crit', 2.6); if (C.log) C.log({ type: 'axeMaestry' }); }
    return true;
  }
  if (w.charge && !fromDodge && (p.axeRunT || 0) >= AXE3.charge.run) {
    p.axeRunT = 0;
    p.combo = 0;
    p.facing = Math.atan2(p.axeRunDir.x, p.axeRunDir.z); // a ombrada vai para onde ele corria
    p.axeChargeHits = new Set();
    p.startAttack(camera, CHARGE_STEP);
    if (C && C.log) C.log({ type: 'axeCharge' });
    return true;
  }
  return false;
}

// Correndo: conta o tempo na mesma direção (Investida Bruta).
export function axe3Run(p, dt, dir, moving) {
  if (!moving || !W(p).charge || !handy(p)) { p.axeRunT = 0; return; }
  const d = p.axeRunDir || (p.axeRunDir = new THREE.Vector3());
  const len = Math.hypot(dir.x, dir.z) || 1, x = dir.x / len, z = dir.z / len;
  if (p.axeRunT > 0 && d.x * x + d.z * z >= AXE3.charge.dot) p.axeRunT += dt;
  else { p.axeRunT = dt; d.set(x, 0, z); }
  if (p.axeRunT >= AXE3.charge.run && !p.axeChargeReady) { p.axeChargeReady = true; if (C) C.text.add('Investida!', p.position, 'crit', 2.6); }
  if (p.axeRunT < AXE3.charge.run) p.axeChargeReady = false;
  if (p.axeChargeReady && C && Math.random() < dt * 14) C.vfx.dust(v3(p.position.x, 0.1, p.position.z), v3(-x, 0, -z), 1);
}

// Começou um combo do zero segurando o ataque: vira Arrastar a Lâmina (andando) ou Machado como Escudo (parado).
export function axe3HoldCheck(p, input, step) {
  const w = W(p);
  if (!(w.drag || w.axeGuard) || !handy(p) || p.xstep || p.combo !== 0 || p.hitDone || !p.axeFresh) return false;
  if (p.stateTime < AXE3.drag.delay || !(input.attackHeld && input.attackHeld())) return false;
  p.setState('axeHold');
  p.axeHold = { mode: null, charge: 0, spark: 0 };
  p.queued = false;
  p.setGlow(0);
  if (C && C.log) C.log({ type: 'axeHold' });
  return true;
}

// Segurando o ataque. Devolve 'heavy' (soltou com força acumulada), 'end' (soltou sem força) ou nada.
export function axe3HoldTick(p, dt, world, input, move, camera) {
  const h = p.axeHold, w = W(p), D = AXE3.drag;
  const moving = move.lengthSq() > 0;
  const held = input.attackHeld ? input.attackHeld() : false;
  if (!held) {
    setHoldPose(p, null);
    if (h.charge >= D.min && w.drag) { p.axeDragPower = Math.min(1, h.charge / D.full); return 'heavy'; }
    return 'end';
  }
  const mode = moving && w.drag ? 'drag' : (w.axeGuard ? 'guard' : 'drag');
  if (mode !== h.mode) {
    h.mode = mode;
    setHoldPose(p, mode);
    if (mode === 'guard') {
      p.anim.play('Melee_2H_Idle', { fade: 0.1 });
      if (C) C.text.add('Guarda!', p.position, 'block', 2.4);
    }
  }
  if (mode === 'guard') {
    const a = p.aimAngle(camera);
    p.facing += wrap(a - p.facing) * Math.min(1, dt * 14);
    return null;
  }
  // Arrastando: anda mais devagar, o machado raspa no chão e solta faíscas.
  if (moving) {
    p.move(move.x, move.z, p.hero.moveSpeed * p.moveMul * D.speed * dt, world);
    const want = Math.atan2(move.x, move.z);
    p.facing += wrap(want - p.facing) * Math.min(1, dt * 10);
    h.charge = Math.min(D.full, h.charge + dt);
    p.anim.play('Walking_A', { speed: 0.9 });
    h.spark -= dt;
    if (h.spark <= 0 && C) {
      h.spark = 0.05;
      const t = tipPos(p);
      C.vfx.sparks(t, h.charge >= D.full ? 0xffe27a : 0xffa040, 2 + Math.round(h.charge * 2));
      if (Math.random() < 0.3) audio.play('spikes', t.x, t.z, { v: 0.25 });
    }
  } else p.anim.play(p.hero.anims.idle, { fade: 0.15 });
  p.setGlow(h.charge / D.full * 0.8);
  return null;
}

// Pose do machado segurando: arrastando (lâmina para baixo, atrás) ou de escudo (lâmina larga na frente).
function setHoldPose(p, mode) {
  const wpn = p.weapon;
  if (!wpn) return;
  if (!wpn.userData.axeRest) wpn.userData.axeRest = { r: wpn.rotation.clone(), p: wpn.position.clone() };
  const r = wpn.userData.axeRest;
  wpn.rotation.copy(r.r); wpn.position.copy(r.p);
  if (mode === 'drag') { wpn.rotation.x += 2.1; }
  else if (mode === 'guard') { wpn.rotation.x += 1.57; wpn.rotation.z += 0.6; } // lâmina larga atravessada na frente do corpo
}

function tipPos(p) {
  const wpn = p.weapon;
  if (!wpn) return v3(p.position.x, 0.1, p.position.z);
  const t = wpn.localToWorld(v3(0, (p.hero.weapons.right.tip || 1.2) * 0.85, 0));
  t.y = Math.max(0.08, Math.min(t.y, 0.3));
  return t;
}

// Machado como Escudo: a lâmina segura flechas e magias que vêm pela frente. Devolve true se segurou.
export function axe3GuardShot(c, p, a, dx, dz) {
  if (p.state !== 'axeHold' || !p.axeHold || p.axeHold.mode !== 'guard') return false;
  const from = Math.atan2(-dx, -dz);
  if (Math.abs(wrap(from - p.facing)) > AXE3.guard.arc * DEG) return false;
  c.vfx.sparks(v3(a.x, a.g ? a.g.position.y : 1.2, a.z), 0xffe6a0, 12);
  audio.play('block', a.x, a.z, { v: 0.9 });
  c.text.add('Defendeu!', p.position, 'block');
  if (c.log) c.log({ type: 'axeGuard', kind: a.kind });
  return true;
}

// Golpes com efeito próprio (ombrada, cabo, socos). Devolve true se cuidou do golpe.
export function axe3Strike(c, p, step) {
  if (!step.kit || !isAxe(p)) return false;
  const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
  const area = (reach, arc, fn) => {
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.001;
      if (d > reach + e.data.radius || Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > arc / 2 * DEG) continue;
      if (fn(e, dx / d, dz / d) !== false) n++;
    }
    return n;
  };
  let n = 0;
  if (step.kit === 'axeCharge') {
    n = area(AXE3.charge.reach, AXE3.charge.arc, (e, nx, nz) => chargeHit(c, p, e, nx, nz));
    c.vfx.dust(v3(p.position.x + fx, 0.1, p.position.z + fz), v3(fx, 0, fz), 10);
    c.shakeFor(p, 0.22);
    audio.play(n ? 'headThud' : 'swing', p.position.x, p.position.z);
  } else if (step.kit === 'axePommel') {
    n = area(AXE3.pommel.reach, AXE3.pommel.arc, (e, nx, nz) => {
      if (p.axePommelHit) return false;
      p.axePommelHit = true; // a cutucada acerta 1 só (o mais perto vem primeiro na faixa)
      const shield = !!(e.data.shield && !e.shieldBroken);
      if (e.offBalance && e.offBalance(nx, nz, AXE3.pommel.off, AXE3.pommel.push)) c.text.add(shield ? 'Baixou o escudo!' : 'Desequilibrado!', e.position, 'hurt', 3.2);
      c.damageEnemy(p, e, step, nx, nz);
      if (c.log) c.log({ type: 'axePommel', enemy: e, shield });
    });
    p.axePommelHit = false;
    audio.play(n ? 'thump' : 'swing', p.position.x, p.position.z);
  } else if (step.kit === 'axePunch') {
    n = area(AXE3.punch.reach, AXE3.punch.arc, (e, nx, nz) => { c.damageEnemy(p, e, { ...step, pushMul: step.kick ? 1.6 : 1 }, nx, nz); });
    audio.play(n ? 'hit' : 'swing', p.position.x, p.position.z, { v: 0.8 });
    if (c.log) c.log({ type: 'axePunch', n, kick: !!step.kick });
  } else return false;
  c.props.strikeArc(p, 2.2, 60 * DEG, null, 0);
  if (n) c.addHitstop(0.05);
  return true;
}

// Ombrada: derruba (chefe só cambaleia) e já fica pronto para a machadada.
function chargeHit(c, p, e, nx, nz) {
  if (p.axeChargeHits && p.axeChargeHits.has(e)) return false;
  if (p.axeChargeHits) p.axeChargeHits.add(e);
  if (e.offBalance && !e.data.boss) e.offBalance(nx, nz, 0.3, 4); // abre a guarda do escudo
  const r = c.damageEnemy(p, e, CHARGE_STEP, nx, nz);
  if (r === 'kill' || !e.alive) return true;
  if (!e.data.boss && knockDown(e, nx, nz)) c.text.add('Derrubado!', e.position, 'crit', 3.4);
  if (c.log) c.log({ type: 'axeChargeHit', enemy: e, down: e.state === 'axeDown' });
  return true;
}

// Depois do golpe normal: Arrastar a Lâmina (machadada explode) e Arremesso Serra (o machado sai voando).
export function axe3AfterStrike(c, p, step) {
  if (!isAxe(p) || !step.heavy) return;
  const w = W(p), fx = Math.sin(p.facing), fz = Math.cos(p.facing);
  if (p.axeDragPower > 0) {
    const k = p.axeDragPower, D = AXE3.drag;
    p.axeDragPower = 0;
    const x = p.position.x + fx * 1.6, z = p.position.z + fz * 1.6, r = D.r0 + (D.r1 - D.r0) * k;
    const dmg = Math.round((D.d0 + (D.d1 - D.d0) * k) * p.stats.damageMul);
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.001;
      if (d > r + e.data.radius) continue;
      c.bonusDamage(e, dmg, dx / d, dz / d, 'dmg big', p);
      if (e.alive && e.vel) e.vel.set(dx / d, 0, dz / d).multiplyScalar(D.push * (e.data.knockback || 1));
      n++;
    }
    c.vfx.heavyImpact(v3(x, 0, z), 1.2 + k);
    c.vfx.ring(v3(x, 0, z), 0xffa040, r);
    c.vfx.sparks(v3(x, 0.6, z), 0xffe27a, 30);
    audio.play('boom', x, z, { v: 0.8 + k * 0.4 });
    c.shakeFor(p, 0.3 + k * 0.2);
    c.text.add(k >= 1 ? 'EXPLOSÃO!' : 'Explosão!', p.position, 'crit', 3.6);
    if (c.log) c.log({ type: 'axeDragBlast', n, k, dmg });
  }
  if (w.sawThrow && handy(p)) c.axe3.throwSaw(p);
}

export function axe3OnHit(c, p, e) { if (isAxe(p)) p.axeHunger = 0; }

// Inimigo destruído pelo herói: Grito de Guerra (sequência) e Futebol de Crânio (crânio no chão).
export function axe3OnKill(c, e, by) {
  if (!isAxe(by)) return;
  const w = W(by);
  by.axeHunger = 0;
  if (w.warcry) {
    by.axeStreak = by.axeStreakT > 0 ? (by.axeStreak || 0) + 1 : 1;
    by.axeStreakT = AXE3.warcry.gap;
    if (by.axeStreak >= AXE3.warcry.kills) { by.axeStreak = 0; by.axeStreakT = 0; c.axe3.warcry(by); }
  }
  if (w.skullBall && !e.data.boss && !e.undead && !e.headless) c.axe3.dropSkull(e, by);
}

// ---------- Esqueleto ----------

export function knockDown(e, nx, nz) {
  if (!e.alive || e.immune || e.frozenT > 0 || e.undead) return false;
  if (['held', 'thrown', 'spawn', 'rage', 'dead', 'spinMove', 'spinGather', 'spin', 'roll', 'hop', 'headless', 'axeAir', 'axeDown'].includes(e.state)) return false;
  e.releaseToken();
  e.setState('axeDown');
  e.down = { t: 0, total: AXE3.charge.down };
  e.vel.set(nx, 0, nz).multiplyScalar(6);
  e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.6 });
  return true;
}

export function fear(e, p, t) {
  if (!e.alive || e.immune || e.frozenT > 0 || e.undead || e.data.boss) return false;
  if (['held', 'thrown', 'spawn', 'rage', 'dead', 'roll', 'hop', 'headless', 'axeAir', 'axeDown', 'tpOut', 'tpIn'].includes(e.state)) return false;
  e.releaseToken();
  if (e.atk && e.state === 'attack' && e.endAttack) e.endAttack();
  e.setState('axeFear');
  e.fear = { t, run: AXE3.warcry.time, from: p, ang: Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z) };
  e.anim.play(e.data.anims.walk, { fade: 0.1, speed: (e.data.walkAnimSpeed || 1) * 1.7 });
  return true;
}

export function axe3EnemyTick(e, dt, ctx) {
  if (e.state === 'axeDown') {
    const d = e.down, fall = 0.18, rise = 0.3;
    d.t += dt;
    if (d.slip) { // Poça de Sangue (Garras): escorrega, se debate e cai de costas
      const S1 = 0.32, S2 = 0.23; // escorregando / caindo
      let rx = 0, rz = 0;
      if (d.t < S1) {
        const u = d.t / S1;
        rz = 0.32 * Math.sin(d.t * 30) * (1 - u * 0.4);   // perdendo o equilíbrio
        rx = 0.22 * Math.sin(u * Math.PI);                 // joga o corpo para a frente...
      } else if (d.t < S1 + S2) {
        const u = (d.t - S1) / S2;
        rx = -1.45 * u * u; rz = 0.1 * (1 - u);            // ...e cai de costas, cada vez mais rápido
      } else if (d.t > d.total - rise) rx = -1.45 * Math.max(0, (d.total - d.t) / rise);
      else { const u = d.t - S1 - S2; rx = -1.45 + (u < 0.25 ? 0.12 * Math.sin(u / 0.25 * Math.PI) : 0); } // quique no chão
      e.model.rotation.x = rx; e.model.rotation.z = rz;
      if (d.t >= S1 + S2 && !d.landed) { d.landed = true; e.vel.set(0, 0, 0); if (ctx && ctx.combat && ctx.combat.vfx) ctx.combat.vfx.puff(e.position); }
    } else {
      const k = d.t < fall ? d.t / fall : d.t > d.total - rise ? Math.max(0, (d.total - d.t) / rise) : 1;
      e.model.rotation.x = -k * 1.45;
    }
    if (d.t >= d.total) {
      e.model.rotation.x = 0; e.model.rotation.z = 0; e.down = null;
      e.setState('hurt'); e.stunTime = 0.12;
      e.anim.play(e.data.anims.idle, { fade: 0.15 });
    }
    return;
  }
  if (e.state === 'axeFear') {
    const f = e.fear, d = e.data;
    f.t -= dt;
    f.run -= dt;
    if (f.t <= 0 || !f.from) {
      e.fear = null;
      if (e.warDrop && ctx.combat.axe3) { ctx.combat.axe3.startFetch(e); return; }
      e.setState('chase'); e.anim.play(d.anims.idle, { fade: 0.15 }); return;
    }
    // Fuga: escolhe um ponto livre longe do herói (de tempos em tempos) e anda até ele.
    // Encurralado (nenhum ponto melhor): fica parado tremendo de medo, olhando o herói (antes ficava raspando na parede).
    const fx = f.from.position.x, fz = f.from.position.z, r = d.radius;
    const sp = (d.speed || 3) * (f.run > 0 ? 1.15 : AXE3.warcry.slow) * dt; // depois da corrida: vai se afastando devagar, sem arma
    f.re = (f.re ?? 0) - dt;
    if (f.re <= 0 || !f.goal) {
      f.re = 0.4 + Math.random() * 0.15;
      const here = Math.hypot(e.position.x - fx, e.position.z - fz);
      let best = null, bs = here + 0.6;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        for (const dist of [3.2, 1.8]) {
          const x = e.position.x + Math.sin(a) * dist, z = e.position.z + Math.cos(a) * dist;
          if (ctx.world.blocked(x, z, r * 1.6) || !lineClear(ctx.world, e.position.x, e.position.z, x, z, r)) continue;
          const sc = Math.hypot(x - fx, z - fz) + Math.cos(wrap(a - f.ang)) * 0.8; // prefere seguir para o mesmo lado
          if (sc > bs) { bs = sc; best = { x, z, a }; }
          break;
        }
      }
      f.goal = best;
    }
    let moved = false;
    if (f.goal) {
      const gx = f.goal.x - e.position.x, gz = f.goal.z - e.position.z, gd = Math.hypot(gx, gz);
      if (gd < 0.25) f.re = 0;
      else {
        const want = Math.atan2(gx, gz);
        f.ang += wrap(want - f.ang) * Math.min(1, dt * 8);
        const step = Math.min(sp, gd), nx = e.position.x + Math.sin(f.ang) * step, nz = e.position.z + Math.cos(f.ang) * step;
        if (!ctx.world.blocked(nx, nz, r)) { e.position.x = nx; e.position.z = nz; moved = true; }
        else f.re = 0; // bateu: escolhe outro ponto no próximo quadro
        e.facing = f.ang;
      }
    }
    if (!moved) {
      const look = Math.atan2(fx - e.position.x, fz - e.position.z);
      e.facing += wrap(look - e.facing) * Math.min(1, dt * 6);
      e.anim.play(d.anims.idle, { speed: 1.6 });
    } else e.anim.play(d.anims.walk, { speed: (d.walkAnimSpeed || 1) * (f.run > 0 ? 1.7 : 1) });
    if (f.run > 0 && Math.random() < dt * 3) ctx.combat.vfx.sparks(v3(e.position.x, 2.3, e.position.z), 0xb0d8ff, 1);
    return;
  }
  if (e.state === 'axeFetch' && ctx.combat.axe3) ctx.combat.axe3.fetchTick(e, dt, ctx);
}

export function axe3LeaveState(e, from) {
  if (from === 'axeDown') { e.model.rotation.x = 0; e.model.rotation.z = 0; e.down = null; }
  if (from === 'axeFear') e.fear = null;
  if (from === 'axeFetch') e.fetch = null;
}

// ---------- Coisas na sala ----------
let C = null;
export const axe3DashTick = (p, dt, world) => (C ? C.axe3.dashTick(p, dt, world) : true);

export class AxeKit3 {
  constructor(combat) {
    C = combat;
    this.c = combat;
    this.saws = [];   // { p, g, spin, phase: 'out'|'saw'|'back', x, z, tx, tz, t, tick, hit: Set }
    this.skulls = []; // { m, state: 'rest'|'fly', vx, vz, t, p, life }
    this.dropped = []; // Grito de Guerra: armas largadas no chão { e, items: [{ obj, parent, pos, quat, scale }], x, z, vy, y, t }
    this.pulls = [];   // Machado Faminto: { p, e, t, line }
  }

  get scene() { return this.c.scene; }

  // ---- Grito de Guerra ----
  warcry(p) {
    const c = this.c, R = AXE3.warcry;
    let n = 0;
    for (const e of c.enemies) {
      if (!e.targetable) continue;
      if (Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) > R.r + e.data.radius) continue;
      if (fear(e, p, R.unarmed)) { this.dropWeapons(e, p); c.text.add('Largou a arma!', e.position, 'hurt', 3.0); n++; }
    }
    c.vfx.ring(v3(p.position.x, 0, p.position.z), 0xff5030, R.r * 0.5);
    c.vfx.ring(v3(p.position.x, 0, p.position.z), 0xff8040, R.r);
    c.vfx.sparks(v3(p.position.x, 2.0, p.position.z), 0xff6030, 20);
    c.text.add('GRITO DE GUERRA!', p.position, 'crit', 4.2);
    audio.play('warcry', p.position.x, p.position.z);
    c.shakeFor(p, 0.35);
    if (c.log) c.log({ type: 'axeWarcry', n });
  }

  // Larga as armas no chão (o escudo fica). Guarda onde estavam presas para devolver igualzinho.
  dropWeapons(e, p) {
    if (e.warDrop) return;
    const items = [];
    for (const w of [...(e.weapons || [])]) {
      if (w === e.shieldMesh && e.data.shield) continue; // escudo não é arma
      if (!w.parent) continue;
      items.push({ obj: w, parent: w.parent, pos: w.position.clone(), quat: w.quaternion.clone(), scale: w.scale.clone() });
    }
    if (!items.length) { e.warDrop = { items, x: e.position.x, z: e.position.z }; return; }
    const ang = Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z);
    const x = e.position.x - Math.sin(ang) * 0.6, z = e.position.z - Math.cos(ang) * 0.6; // cai para o lado do herói
    const drop = { e, items, x, z, t: 0 };
    items.forEach((it, i) => {
      this.scene.attach(it.obj);
      it.y0 = it.obj.position.y; it.vy = 3.5 + Math.random();
      it.fx = x + (i - (items.length - 1) / 2) * 0.5; it.fz = z;
      it.sx = it.obj.position.x; it.sz = it.obj.position.z;
      it.spin = (Math.random() - 0.5) * 8;
    });
    e.warDrop = drop;
    e.weapons = (e.weapons || []).filter((w) => !items.some((it) => it.obj === w));
    this.dropped.push(drop);
    audio.play('block', x, z, { v: 0.6 });
  }

  // Depois dos 6 s: vai buscar a arma.
  startFetch(e) {
    const D = e.warDrop;
    if (!D || !D.items || !D.items.length) { e.warDrop = null; e.setState('chase'); e.anim.play(e.data.anims.idle, { fade: 0.15 }); return; }
    e.setState('axeFetch');
    e.fetch = { t: 0, grab: -1 };
    e.anim.play(e.data.anims.walk, { fade: 0.15, speed: e.data.walkAnimSpeed || 1 });
    this.c.text.add('Vai pegar a arma!', e.position, 'block', 3.0);
  }

  fetchTick(e, dt, ctx) {
    const f = e.fetch, D = e.warDrop, d = e.data, R = AXE3.warcry;
    if (!f || !D) { e.setState('chase'); return; }
    f.t += dt;
    if (f.grab >= 0) { // abaixado pegando
      f.grab += dt;
      if (f.grab >= R.grab) { this.giveBack(e); e.setState('chase'); e.anim.play(d.anims.idle, { fade: 0.2 }); }
      return;
    }
    const dx = D.x - e.position.x, dz = D.z - e.position.z, dist = Math.hypot(dx, dz);
    if (dist <= d.radius + 0.5 || f.t >= R.fetch) { // chegou (ou demorou demais: pega assim mesmo)
      f.grab = 0;
      e.facing = Math.atan2(dx, dz);
      e.anim.play('PickUp', { once: true, restart: true, fade: 0.1, speed: 1.3 });
      return;
    }
    const dir = navDir(e, ctx.world, D.x, D.z, { x: D.x, z: D.z }, dt); // segue o caminho da sala (não raspa na parede)
    if (dir) {
      const sp = Math.min((d.speed || 3) * dt, dist), a = Math.atan2(dir[0], dir[1]);
      e.position.x += dir[0] * sp; e.position.z += dir[1] * sp;
      ctx.world.resolveCircle(e.position, d.radius);
      checkStuck(e, dt, sp);
      e.facing += wrap(a - e.facing) * Math.min(1, dt * 10);
    }
    e.anim.play(d.anims.walk, { speed: d.walkAnimSpeed || 1 });
  }

  // Devolve as armas para a mão, do jeito que estavam.
  giveBack(e) {
    const D = e.warDrop;
    if (!D) return;
    for (const it of D.items || []) {
      it.parent.add(it.obj);
      it.obj.position.copy(it.pos); it.obj.quaternion.copy(it.quat); it.obj.scale.copy(it.scale);
      if (e.weapons && !e.weapons.includes(it.obj)) e.weapons.unshift(it.obj);
    }
    e.warDrop = null;
    const i = this.dropped.indexOf(D);
    if (i >= 0) this.dropped.splice(i, 1);
    if (this.c.log) this.c.log({ type: 'axeRearm', enemy: e });
  }

  // Dono morreu ou a sala acabou: a arma some do chão.
  removeDrop(D) {
    for (const it of D.items) if (it.obj.parent === this.scene) this.scene.remove(it.obj);
    const i = this.dropped.indexOf(D);
    if (i >= 0) this.dropped.splice(i, 1);
    if (D.e) D.e.warDrop = null;
  }

  updateDropped(dt) {
    for (const D of [...this.dropped]) {
      const e = D.e;
      if (!e.alive || !this.c.enemies.includes(e)) { this.removeDrop(D); continue; }
      D.t += dt;
      for (const it of D.items) { // cai girando e fica deitada no chão
        if (it.obj.parent !== this.scene || it.done) continue;
        const k = Math.min(1, D.t / 0.45);
        it.vy -= 14 * dt;
        it.obj.position.y = Math.max(0.12, it.obj.position.y + it.vy * dt);
        it.obj.position.x = it.sx + (it.fx - it.sx) * k; it.obj.position.z = it.sz + (it.fz - it.sz) * k;
        it.obj.rotation.y += it.spin * dt;
        if (k >= 1 && it.obj.position.y <= 0.12) {
          it.done = true;
          it.obj.rotation.set(-Math.PI / 2, it.obj.rotation.y, 0, 'YXZ');
          it.obj.position.y = 0.12;
        }
      }
      // Alguém tirou ele do medo/da busca (congelou, foi arremessado...): volta a fugir ou a buscar.
      if (['chase', 'attack', 'block'].includes(e.state)) {
        if (e.state === 'attack' && e.endAttack) e.endAttack();
        const left = AXE3.warcry.unarmed - D.t;
        if (left > 0.1) { const p = this.c.players.find((q) => q.state !== 'dead') || this.c.players[0]; if (!(p && fear(e, p, left))) this.startFetch(e); }
        else this.startFetch(e);
      }
    }
  }

  // ---- Arremesso Serra ----
  throwSaw(p) {
    const c = this.c, S = AXE3.saw;
    p.axeSaw = true;
    if (p.weapon) p.weapon.visible = false;
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    let dist = S.dist;
    for (let d = 0.5; d <= S.dist; d += 0.25) if (c.world.blocked(p.position.x + fx * d, p.position.z + fz * d, 0.3)) { dist = Math.max(0.8, d - 0.5); break; }
    const mesh = instance(p.hero.weapons.right.model);
    const g = new THREE.Group(), spin = new THREE.Group();
    g.add(spin); spin.add(mesh);
    mesh.position.y = -0.55; // gira em volta do meio do cabo
    g.position.set(p.position.x + fx * 0.8, 1.2, p.position.z + fz * 0.8);
    g.rotation.y = p.facing;
    this.scene.add(g);
    this.saws.push({ p, g, spin, phase: 'out', tx: p.position.x + fx * dist, tz: p.position.z + fz * dist, t: 0, tick: 0, hit: new Set(), fx, fz });
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.2 });
    c.text.add('Serra!', p.position, 'crit', 3.0);
    if (c.log) c.log({ type: 'axeSaw' });
  }

  // ---- Futebol de Crânio ----
  dropSkull(e, p) {
    if (this.skulls.length >= AXE3.skull.max) this.removeSkull(this.skulls[0]);
    const m = instance('props/crypt/skull.gltf');
    m.scale.setScalar(0.9);
    const a = Math.random() * Math.PI * 2;
    m.position.set(e.position.x + Math.sin(a) * 0.4, 0, e.position.z + Math.cos(a) * 0.4);
    m.rotation.y = Math.random() * 6;
    this.scene.add(m);
    this.skulls.push({ m, state: 'rest', vx: 0, vz: 0, t: 0, p, life: AXE3.skull.life, roll: 0 });
    if (this.c.log) this.c.log({ type: 'axeSkullDrop' });
  }

  kick(s, p) {
    const c = this.c, K = AXE3.skull;
    let best = null, bd = K.aim;
    for (const e of c.enemies) {
      if (!e.targetable) continue;
      const d = Math.hypot(e.position.x - s.m.position.x, e.position.z - s.m.position.z);
      if (d < bd) { bd = d; best = e; }
    }
    const a = best ? Math.atan2(best.position.x - s.m.position.x, best.position.z - s.m.position.z) : p.facing;
    s.state = 'fly'; s.t = 0; s.vx = Math.sin(a) * K.speed; s.vz = Math.cos(a) * K.speed; s.p = p; s.target = best;
    c.vfx.dust(v3(s.m.position.x, 0.1, s.m.position.z), v3(s.vx, 0, s.vz), 4);
    audio.play('headThud', s.m.position.x, s.m.position.z, { v: 0.8 });
    c.text.add('Chute!', p.position, 'gold', 2.6);
    if (c.log) c.log({ type: 'axeSkullKick', target: best });
  }

  removeSkull(s) {
    const i = this.skulls.indexOf(s);
    if (i >= 0) this.skulls.splice(i, 1);
    if (s.m.parent) s.m.parent.remove(s.m);
  }

  update(dt) {
    const c = this.c;
    for (const p of c.players) {
      if (p.axeStreakT > 0) p.axeStreakT -= dt;
      p.axeSinceDodge = (p.axeSinceDodge ?? 9) + dt;
      if (p.state !== 'axeHold' && p.weapon && p.weapon.userData.axeRest) setHoldPose(p, null);
      if (!isAxe(p)) continue;
      const w = W(p);
      // Imparável: girando, um brilho vermelho em volta.
      if (w.unstoppable && axe3Unstoppable(p) && Math.random() < dt * 20) c.vfx.sparks(v3(p.position.x, 0.4 + Math.random() * 1.4, p.position.z), 0xff5a3a, 1);
      // Investida Bruta (nova): rolar por dentro de um esqueleto com escudo deixa ele parado 2 s.
      if (w.rollBash && p.state === 'dodge') {
        const hit = p.axeBashSet || (p.axeBashSet = new Set());
        for (const e of c.enemies) {
          if (!e.targetable || hit.has(e) || !e.data.shield || e.shieldBroken) continue;
          if (Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) > e.data.radius + p.hero.radius + 0.1) continue;
          hit.add(e);
          const t = e.data.boss ? 0.5 : AXE3.rollBash.daze;
          if (e.daze && e.daze(t)) {
            c.text.add('Atordoado!', e.position, 'crit', 3.2);
            c.vfx.sparks(v3(e.position.x, 2.2, e.position.z), 0xfff0a0, 8);
            audio.play('thump', e.position.x, e.position.z);
            if (c.log) c.log({ type: 'axeRollBash', enemy: e });
          }
        }
      } else if (p.axeBashSet && p.axeBashSet.size) p.axeBashSet.clear();
      // Investida Bruta (antiga, sem bênção): ombrada passando por cima de quem estiver no caminho.
      if (p.state === 'attack' && p.xstep && p.xstep.kit === 'axeCharge' && !p.hitDone) {
        for (const e of [...c.enemies]) {
          if (!e.targetable || p.axeChargeHits.has(e)) continue;
          const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.001;
          if (d > p.hero.radius + e.data.radius + AXE3.charge.bump) continue;
          chargeHit(c, p, e, dx / d, dz / d);
        }
      }
      // Machado Faminto: 4 s sem acertar ninguém com inimigos na sala, o machado puxa o herói.
      if (w.hungry && handy(p) && c.enemies.some((e) => e.targetable)) {
        if (!['cine', 'dead', 'axeDash', 'emote', 'drink'].includes(p.state)) p.axeHunger = (p.axeHunger || 0) + dt;
        if (p.axeHunger >= AXE3.hunger.time - 1 && Math.random() < dt * 10) c.vfx.sparks(tipPos(p).setY(1.2), 0xb03030, 1);
        if (p.axeHunger >= AXE3.hunger.time && !this.pulls.some((q) => q.p === p)) this.hungerPull(p);
      } else p.axeHunger = 0;
    }
    this.updatePulls(dt);
    this.updateDropped(dt);
    this.updateSaws(dt);
    this.updateSkulls(dt);
  }

  // Machado Faminto: o machado puxa o inimigo mais perto até o herói (chefes não).
  hungerPull(p) {
    const c = this.c, H = AXE3.hunger;
    let best = null, bd = H.range;
    for (const e of c.enemies) {
      if (!e.targetable || e.data.boss || e.frozenT > 0 || e.immune) continue;
      if (['held', 'thrown', 'spawn', 'rage', 'headless', 'axeAir'].includes(e.state)) continue;
      const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
      if (d < bd) { bd = d; best = e; }
    }
    p.axeHunger = 0;
    if (!best) return;
    const e = best;
    e.releaseToken();
    if (e.atk && e.state === 'attack' && e.endAttack) e.endAttack();
    e.setState('hurt'); e.stunTime = 5; e.vel.set(0, 0, 0);
    e.hookSafe = p; e.hookSafeT = 99; // não machuca no esbarrão enquanto vem (e 2 s depois)
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05 });
    const mat = new THREE.MeshBasicMaterial({ color: 0xc02a2a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5), mat);
    this.scene.add(line);
    this.pulls.push({ p, e, t: 0, line });
    c.text.add('O machado tem fome!', p.position, 'hurt', 3.4);
    c.text.add('Puxado!', e.position, 'crit', 3.0);
    audio.play('charge', p.position.x, p.position.z);
    if (c.log) c.log({ type: 'axeHunger', enemy: e });
  }

  updatePulls(dt) {
    const c = this.c, H = AXE3.hunger;
    for (const q of [...this.pulls]) {
      const { p, e } = q;
      q.t += dt;
      const dx = p.position.x - e.position.x, dz = p.position.z - e.position.z, d = Math.hypot(dx, dz) || 0.001;
      const want = p.hero.radius + e.data.radius + 0.5;
      const done = !e.alive || p.state === 'dead' || e.frozenT > 0 || d <= want || q.t >= H.max;
      if (done) {
        if (e.alive) {
          e.hookSafe = p; e.hookSafeT = H.safe;
          if (e.state === 'hurt') e.stunTime = e.t + H.stun; // atordoado um instante: não emenda um golpe na hora
          c.vfx.sparks(v3(e.position.x, 2.2, e.position.z), 0xfff0a0, 6);
        }
        this.endPull(q);
        continue;
      }
      if (e.state === 'hurt') e.stunTime = e.t + 5;
      const s = Math.min(d - want, H.speed * dt);
      e.position.x += dx / d * s; e.position.z += dz / d * s;
      c.world.resolveCircle(e.position, e.data.radius);
      e.facing = Math.atan2(dx, dz);
      if (Math.random() < dt * 30) c.vfx.dust(v3(e.position.x, 0.1, e.position.z), v3(-dx / d, 0, -dz / d), 1);
      const t = tipPos(p);
      const lx = e.position.x - t.x, lz = e.position.z - t.z;
      q.line.position.set(t.x, 1.1, t.z);
      q.line.rotation.y = Math.atan2(lx, lz);
      q.line.scale.set(1, 1, Math.max(0.01, Math.hypot(lx, lz)));
    }
  }

  endPull(q) {
    this.scene.remove(q.line);
    q.line.geometry.dispose(); q.line.material.dispose();
    const i = this.pulls.indexOf(q);
    if (i >= 0) this.pulls.splice(i, 1);
  }

  // Herói sendo puxado. Devolve true quando acabou.
  dashTick(p, dt, world) {
    const d = p.axeDash, H = AXE3.hunger, e = d && d.e;
    if (!d) return true;
    d.t += dt;
    if (!e || !e.alive || d.t >= H.max) { p.axeDash = null; return true; }
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, dist = Math.hypot(dx, dz) || 0.001;
    p.facing = Math.atan2(dx, dz);
    const go = Math.min(H.speed * dt, dist - H.stop);
    if (go > 0) p.move(dx / dist, dz / dist, go, world);
    if (Math.random() < dt * 30) this.c.vfx.dust(v3(p.position.x, 0.1, p.position.z), v3(-dx / dist, 0, -dz / dist), 1);
    if (dist - H.stop <= 0.05) { p.axeDash = null; return true; }
    return false;
  }

  updateSaws(dt) {
    const c = this.c, S = AXE3.saw;
    for (let i = this.saws.length - 1; i >= 0; i--) {
      const s = this.saws[i], p = s.p, g = s.g;
      if (p.state === 'dead' || !c.players.includes(p)) { this.removeSaw(s); continue; }
      s.t += dt;
      if (s.phase === 'out') {
        s.spin.rotation.x += dt * 20;
        const dx = s.tx - g.position.x, dz = s.tz - g.position.z, d = Math.hypot(dx, dz);
        const step = S.fly * dt;
        if (d <= step) {
          g.position.set(s.tx, 0.55, s.tz);
          s.phase = 'saw'; s.t = 0; s.tick = 0;
          c.vfx.dust(v3(s.tx, 0.1, s.tz), v3(0, 0, 0), 10);
          audio.play('thump', s.tx, s.tz, { v: 0.9 });
        } else { g.position.x += dx / d * step; g.position.z += dz / d * step; g.position.y = 1.2 - 0.65 * (1 - d / S.dist); }
      } else if (s.phase === 'saw') {
        s.spin.rotation.x += dt * 30; // gira em pé, cravado no chão, como uma serra
        if (Math.random() < dt * 40) c.vfx.sparks(v3(g.position.x + (Math.random() - 0.5) * 0.4, 0.15, g.position.z + (Math.random() - 0.5) * 0.4), 0xffb040, 2);
        if (Math.random() < dt * 8) c.vfx.dust(v3(g.position.x, 0.1, g.position.z), v3(s.fx, 0, s.fz), 1);
        s.tick -= dt;
        if (s.tick <= 0) {
          s.tick = S.tick;
          let n = 0;
          for (const e of [...c.enemies]) {
            if (!e.targetable) continue;
            const dx = e.position.x - g.position.x, dz = e.position.z - g.position.z, d = Math.hypot(dx, dz) || 0.001;
            if (d > S.r + e.data.radius) continue;
            c.bonusDamage(e, Math.max(1, Math.round(S.dmg * p.stats.damageMul)), dx / d, dz / d, 'dmg', p);
            n++;
          }
          if (n && c.log) c.log({ type: 'axeSawHit', n });
          audio.play(n ? 'hit' : 'spin', g.position.x, g.position.z, { v: 0.5 });
          c.props.hitAt(g.position.x, g.position.z, p);
        }
        if (s.t >= S.time) { s.phase = 'back'; audio.play('swingHeavy', g.position.x, g.position.z); }
      } else {
        s.spin.rotation.x += dt * 22;
        const dx = p.position.x - g.position.x, dz = p.position.z - g.position.z, d = Math.hypot(dx, dz) || 0.001;
        g.position.y += (1.2 - g.position.y) * Math.min(1, dt * 8);
        g.rotation.y = Math.atan2(dx, dz);
        if (d <= S.catchR + S.back * dt) { this.catchSaw(s); continue; }
        g.position.x += dx / d * S.back * dt; g.position.z += dz / d * S.back * dt;
        for (const e of [...c.enemies]) {
          if (!e.targetable || s.hit.has(e)) continue;
          if (Math.hypot(e.position.x - g.position.x, e.position.z - g.position.z) > S.backR + e.data.radius) continue;
          s.hit.add(e);
          c.bonusDamage(e, Math.round(S.backDmg * p.stats.damageMul), dx / d, dz / d, 'dmg big', p);
        }
      }
    }
  }

  catchSaw(s) {
    const p = s.p;
    this.removeSaw(s);
    audio.play('thump', p.position.x, p.position.z, { v: 0.6 });
    this.c.text.add('Machado de volta!', p.position, 'gold', 2.6);
    if (this.c.log) this.c.log({ type: 'axeSawCatch' });
  }

  removeSaw(s) {
    const i = this.saws.indexOf(s);
    if (i >= 0) this.saws.splice(i, 1);
    if (s.g.parent) s.g.parent.remove(s.g);
    const p = s.p;
    if (!this.saws.some((o) => o.p === p)) {
      p.axeSaw = false;
      if (p.weapon && !p.axeAway) p.weapon.visible = true;
      // socando no meio: o golpe atual termina como soco; o próximo já é com o machado
      if (p.combo >= p.hero.combo.length) p.combo = 0;
    }
  }

  updateSkulls(dt) {
    const c = this.c, K = AXE3.skull;
    for (let i = this.skulls.length - 1; i >= 0; i--) {
      const s = this.skulls[i], m = s.m;
      if (s.state === 'rest') {
        s.life -= dt;
        if (s.life <= 0) { this.removeSkull(s); continue; }
        if (s.life < 1) m.position.y = -(1 - s.life) * 0.4;
        for (const p of c.players) {
          if (p.state === 'dead' || p.state === 'dodge' || !W(p).skullBall) continue;
          if (Math.hypot(p.position.x - m.position.x, p.position.z - m.position.z) > K.kick) continue;
          this.kick(s, p); break;
        }
        continue;
      }
      // Voando (rolando pelo chão).
      s.t += dt;
      const nx = m.position.x + s.vx * dt, nz = m.position.z + s.vz * dt;
      m.rotation.x += dt * 18;
      m.position.y = Math.abs(Math.sin(s.t * 9)) * 0.35 * Math.max(0, 1 - s.t);
      if (c.world.blocked(nx, nz, 0.2) || s.t >= K.fly) { this.breakSkull(s); continue; }
      m.position.x = nx; m.position.z = nz;
      for (const e of [...c.enemies]) {
        if (!e.targetable) continue;
        if (Math.hypot(e.position.x - nx, e.position.z - nz) > K.r + e.data.radius) continue;
        const sp = Math.hypot(s.vx, s.vz) || 1;
        c.bonusDamage(e, Math.round(K.damage * s.p.stats.damageMul), s.vx / sp, s.vz / sp, 'dmg big', s.p);
        if (e.alive && e.daze) e.daze(0.4);
        c.text.add('Gol!', e.position, 'gold', 3.4);
        if (c.log) c.log({ type: 'axeSkullHit', enemy: e });
        this.breakSkull(s);
        break;
      }
    }
  }

  breakSkull(s) {
    const m = s.m;
    this.c.vfx.sparks(v3(m.position.x, 0.4, m.position.z), 0xf2ead8, 10);
    audio.play('crunch', m.position.x, m.position.z, { v: 0.8 });
    this.removeSkull(s);
  }

  clear() {
    for (const q of [...this.pulls]) this.endPull(q);
    for (const D of [...this.dropped]) this.removeDrop(D);
    for (const s of [...this.saws]) this.removeSaw(s);
    for (const s of [...this.skulls]) this.removeSkull(s);
  }
}
