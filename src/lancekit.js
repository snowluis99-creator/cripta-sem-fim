// Bênçãos da Lança de Duas Mãos do Cavaleiro (lista do dono, 06/11/2026) — lado do herói e ganchos do combate.
// Distância: Ponta Doce (ponta = crítico, de perto só empurra), Pregar na Parede, Contra-Carga, Muralha de Pontas.
// Arremessar e puxar: Arpão, Espetinho, Lança Bumerangue, Lança Cravada.
// Movimento: Salto com Vara, Salto do Dragão, Âncora.
// Sala: Estandarte de Guerra, Cemitério de Lanças, Para-raios, Espinhos de Pedra.
// Ritmo: Estocada Fantasma, Mil Lanças, Molinete. Diferentes: Lança de Troféus, Domador. (+ Lança do Dragão, wbhooks.js)
// As coisas que ficam na sala (lança voando, cravada, bandeiras, espinhos...) ficam em lancekit2.js.
import * as THREE from 'three';
import { audio } from './audio.js';

export const LANCE = {
  sweet: { tip: 0.62, near: 0.34, push: 12 },            // Ponta Doce: frações do alcance (da borda do inimigo)
  nail: { time: 2, boss: 0.5 },                          // Pregar na Parede
  counter: { mul: 3, daze: 1.2, boss: 0.5 },             // Contra-Carga
  wall: { still: 1, cd: 0.7, arc: 22 },                  // Muralha de Pontas: parado 1 s; cada inimigo a cada 0,7 s
  harpoon: { range: 14 },                                // Arpão
  skewer: { hold: 5, speed: 18, range: 12, r: 0.9, dmg: 22 }, // Espetinho
  boomer: { out: 9, speed: 20, back: 24, r: 1.1, catch: 1.0, back_mul: 0.7 }, // Lança Bumerangue
  plant: { dist: 7, speed: 24, r: 2.4, tick: 0.6, dmg: 5, pick: 1.4, daze: 0.35 }, // Lança Cravada
  vault: { range: 4.5, arc: 40, time: 0.5, h: 1.8, ready: 1.2 }, // Salto com Vara
  dragon: { after: 0.4, dist: 3.6, time: 0.6, h: 2.4, r: 3.0, dmg: 30, rest: 0.25 }, // Salto do Dragão
  anchor: { r: 3.2, push: 15, rad: 1.1 },                // Âncora
  banner: { time: 6, r: 3.5, speed: 1.35, heal: 1, every: 0.5 }, // Estandarte de Guerra
  grave: { r: 0.8, dmg: 8, rearm: 1.5, life: 15, max: 8, daze: 0.3 }, // Cemitério de Lanças
  rod: { every: 5, dmg: 20, daze: 0.5 },                 // Para-raios
  spikes: { from: 1.6, len: 11, gap: 0.9, speed: 22, r: 1.0, dmg: 14, daze: 0.5 }, // Espinhos de Pedra
  ghost: { delay: 0.5, mul: 0.6, w: 0.55 },              // Estocada Fantasma
  flurry: { n: 7, gap: 0.07, mul: 0.45 },               // Mil Lanças
  molinete: { r: 2.8, dmg: 8 },                          // Molinete
  trophy: { max: 3, dmg: 18, r: 2.4, fly: 0.55, dist: 6 }, // Lança de Troféus
  tame: { hp: 0.4 },                                     // Domador: com 40% da vida ou menos
};

let C = null;
export const setLanceCombat = (c) => { C = c; };
const W = (p) => (p && p.stats && p.stats.w) || {};
export const isLance = (p) => !!(p && p.heroId === 'knight' && p.hero && p.hero.weaponId === 'lanca');
const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// Estocada de verdade (não arremesso, soco, raio...).
const isStab = (step, ctx = {}) => !ctx.ranged && !ctx.spell && !step.kit && !step.lanceFx;

// Golpes especiais.
export const PUNCHES = [
  { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 1.35, hit: 0.35, end: 0.72, window: 0.4, lunge: 0.25, damage: 8, kit: 'lancePunch' },
  { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 1.6, hit: 0.35, end: 0.72, window: 0.4, lunge: 0.25, damage: 8, kit: 'lancePunch' },
  { clip: 'Melee_Unarmed_Attack_Kick', speed: 1.25, hit: 0.42, end: 0.82, lunge: 0.4, damage: 14, kit: 'lancePunch', kick: true, heavy: true },
];
export const SKEWER_THROW = { clip: 'Throw', speed: 1.6, hit: 0.4, end: 0.7, lunge: 0.1, damage: 22, kit: 'lanceSkewerThrow', keepFacing: false };
export const FLURRY_STEP = { clip: 'Melee_2H_Attack_Stab', speed: 1.0, hit: 0.05, end: 0.62, lunge: 0.2, damage: 0, kit: 'lanceFlurry', keepFacing: true };
export const MOLINETE_STEP = { clip: 'Melee_2H_Attack_Spinning', speed: 1.1, hit: 0.35, end: 0.95, lunge: 0, damage: 8, kit: 'lanceMolinete', keepFacing: true };

// ---------- Combo ----------

// Monta o golpe forte conforme as bênçãos. Sem a lança na mão (cravada): socos.
export function applyLance(p) {
  if (!isLance(p)) return;
  const h = p.hero, w = W(p);
  if (p.lanceAway === 'planted') {
    h.combo = PUNCHES.map((s) => ({ ...s }));
    h.heavyIdx = 2;
  } else {
    const i = h.combo.findIndex((s) => s.heavy);
    const s = h.combo[i];
    if (i >= 0 && w.lanceBoomer) h.combo[i] = { ...s, clip: 'Throw', speed: 1.5, hit: 0.42, end: 0.75, lunge: 0.15, kit: 'lanceBoomer' };
    else if (i >= 0 && w.lancePlant) h.combo[i] = { ...s, clip: 'Throw', speed: 1.5, hit: 0.42, end: 0.75, lunge: 0.15, kit: 'lancePlant' };
    else if (i >= 0 && w.anchor) h.combo[i] = { ...s, clip: 'Melee_Unarmed_Attack_Kick', speed: 0.7, hit: 0.55, end: 0.95, lunge: 0, kit: 'lanceAnchor' };
  }
  if (p.combo >= h.combo.length) p.combo = 0;
  if (p.weapon) p.weapon.visible = !p.lanceAway && !p.axeAway;
}

// Troca de arma/herói, nova partida: a lança volta para a mão.
export function lanceReset(p) {
  if (C && C.lance) C.lance.dropFor(p);
  p.lanceAway = null; p.lanceHeld = null; p.lanceFlurry = null; p.lanceChain = null;
  p.lanceRod = 0; p.lanceStill = 0; p.lanceReadyT = 0; p.lanceSkulls = 0; p.bannerBoost = 1;
  if (p.lanceAnchor) endAnchor(p);
  if (p.weapon && isLance(p)) p.weapon.visible = true;
}

// Espetinho: com um esqueleto na ponta, o próximo ataque arremessa o corpo.
export function lanceOverride(p) {
  if (!isLance(p) || !p.lanceHeld) return null;
  return SKEWER_THROW;
}

// Começou um golpe (Âncora: crava a lança e gira em volta dela).
export function lanceOnStart(p, step) {
  if (!isLance(p)) return;
  if (step.kit === 'lanceAnchor' && C) {
    const a = p.facing, A = LANCE.anchor;
    const x = p.position.x + Math.sin(a) * A.rad, z = p.position.z + Math.cos(a) * A.rad;
    p.lanceAnchor = { x, z, a0: Math.atan2(p.position.x - x, p.position.z - z), step };
    if (p.weapon) p.weapon.visible = false;
    C.lance.showAnchor(p, true);
    audio.play('thump', x, z, { v: 0.7 });
  }
}
function endAnchor(p) {
  p.lanceAnchor = null;
  if (C) C.lance.showAnchor(p, false);
  if (p.weapon && !p.lanceAway && !p.axeAway) p.weapon.visible = true;
}

// Golpes com efeito próprio. Devolve true se cuidou do golpe (sem a estocada normal).
export function lanceStrike(c, p, step) {
  if (!step.kit || !isLance(p)) return false;
  const L = c.lance;
  switch (step.kit) {
    case 'lanceBoomer': if (!p.axeAway) L.throwBoomer(p, step); return true;
    case 'lancePlant': if (!p.lanceAway) L.throwPlant(p, step); return true;
    case 'lanceSkewerThrow': L.throwBody(p); return true;
    case 'lanceFlurry': L.flurry(p); return true;
    case 'lanceMolinete': area(c, p, LANCE.molinete.r, 360, (e, nx, nz) => c.damageEnemy(p, e, { ...step, damage: LANCE.molinete.dmg, lanceFx: true }, nx, nz)); return true;
    case 'lanceAnchor': L.anchorKick(p, step); return true;
    case 'lancePunch': {
      const n = area(c, p, 2.1, 120, (e, nx, nz) => c.damageEnemy(p, e, { ...step, heavy: false, pushMul: step.kick ? 1.6 : 1 }, nx, nz));
      audio.play(n ? 'hit' : 'swing', p.position.x, p.position.z, { v: 0.8 });
      c.props.strikeArc(p, 2.2, 60 * DEG, null, 0);
      if (n) c.addHitstop(0.05);
      if (c.log) c.log({ type: 'lancePunch', n });
      return true;
    }
  }
  return false;
}
function area(c, p, reach, arc, fn) {
  let n = 0;
  for (const e of [...c.enemies]) {
    if (!e.targetable) continue;
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.001;
    if (d > reach + e.data.radius || (arc < 360 && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > arc / 2 * DEG)) continue;
    fn(e, dx / d, dz / d); n++;
  }
  return n;
}

// ---------- Dano ----------

// Multiplicadores da estocada (wbhooks.wbDamage). pushOnly: de perto, Ponta Doce só empurra.
export function lanceDamage(p, e, step, ctx = {}) {
  if (!isLance(p)) return null;
  const w = W(p), out = { mul: 1, forceCrit: false, pushOnly: false };
  const stab = isStab(step, ctx) || step.lanceAuto;
  if (!stab) return out;
  if (w.counterCharge && (e.state === 'charge' || e.state === 'leap')) { out.mul *= LANCE.counter.mul; e.lanceCounter = true; }
  if (w.sweet) {
    const R = p.hero.attackRange * (p.stats.rangeMul || 1);
    const edge = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) - e.data.radius;
    if (edge >= R * LANCE.sweet.tip) { out.forceCrit = true; e.lanceSweet = true; }
    else if (edge < R * LANCE.sweet.near && !e.lanceCounter) out.pushOnly = true;
  }
  if (p.lanceReadyT > 0) { out.forceCrit = true; p.lanceReadyT = 0; } // Salto com Vara: pronto para golpear
  return out;
}

// Ponta Doce de perto: só empurra (sem dano). Devolve 'hit'.
export function lanceShove(c, p, e, step, nx, nz) {
  const kb = Math.max(0.4, e.data.knockback ?? 1);
  e.vel.set(nx, 0, nz).multiplyScalar(LANCE.sweet.push * kb);
  if (!e.data.boss && e.state !== 'attack' && e.hitReact) e.hitReact();
  c.text.add('Empurrou!', e.position, 'miss', 2.6);
  audio.play('thump', e.position.x, e.position.z, { v: 0.6 });
  if (c.log) c.log({ type: 'lanceShove', enemy: e });
  lanceAfterPush(c, p, e, nx, nz, LANCE.sweet.push * kb);
  return 'hit';
}

// Depois da estocada empurrar: Pregar na Parede.
export function lanceAfterPush(c, p, e, nx, nz, push) {
  if (!W(p).nail || !e.alive || e.undead || !c.world) return;
  const travel = push / 9 + 0.35, r = e.data.radius;
  let wall = -1;
  for (let d = r * 0.6; d <= r + travel; d += 0.15) {
    if (c.world.blocked(e.position.x + nx * d, e.position.z + nz * d, 0.05)) { wall = d; break; }
  }
  if (wall < 0) return;
  if (!e.daze || !e.daze(e.data.boss ? LANCE.nail.boss : LANCE.nail.time)) return;
  const k = Math.max(0, wall - r - 0.02);
  e.position.x += nx * k; e.position.z += nz * k;
  e.vel.set(0, 0, 0);
  c.lance.nail(e, nx, nz, e.stunTime);
  c.text.add('Pregado!', e.position, 'crit', 3.4);
  audio.play('thump', e.position.x, e.position.z, { v: 1.1 });
  c.shakeFor(p, 0.15);
  if (c.log) c.log({ type: 'lanceNail', enemy: e });
}

// Depois do dano (wbhooks.wbOnHit, antes de sair quando morreu).
export function lanceOnHit(c, p, e, step, r) {
  if (!isLance(p)) return;
  const w = W(p), stab = isStab(step, r) || step.lanceAuto;
  const died = r.died || !e.alive;
  // Contra-Carga: parou a investida/o salto.
  if (e.lanceCounter) {
    e.lanceCounter = false;
    c.text.add('Contra-Carga!', e.position, 'crit', 3.6);
    if (!died && e.daze) e.daze(e.data.boss ? LANCE.counter.boss : LANCE.counter.daze);
    c.vfx.sparks(new THREE.Vector3(e.position.x, 1.3, e.position.z), 0xffe27a, 16);
    if (c.log) c.log({ type: 'lanceCounter', enemy: e, dmg: r.dmg });
  }
  if (e.lanceSweet) { e.lanceSweet = false; if (r.crit) { c.text.add('Ponta Doce!', e.position, 'crit', 3.8); if (c.log) c.log({ type: 'lanceSweet', enemy: e }); } }
  // Para-raios: a cada 5 estocadas que acertam.
  if (w.rod && (stab || step.lanceFx === 'flurry')) {
    p.lanceRod = (p.lanceRod || 0) + 1;
    if (p.lanceRod >= LANCE.rod.every) { p.lanceRod = 0; c.lance.rodBolt(p, e); }
  }
  // Mil Lanças: os 3 golpes do combo no mesmo inimigo.
  if (w.flurry && stab && !p.xstep && !step.lanceAuto) {
    const idx = p.combo, seq = p.swingSeq;
    const ch = p.lanceChain;
    if (idx === 0) p.lanceChain = { e, n: 1, seq };
    else if (ch && ch.seq !== seq && ch.e === e && ch.n === idx) { ch.n++; ch.seq = seq; }
    else if (!ch || ch.seq !== seq) p.lanceChain = null;
    if (step.heavy && p.lanceChain && p.lanceChain.n === 3 && !died) { p.lanceFlurry = e; p.lanceChain = null; }
  }
  if (stab && !died && !step.heavy) lanceAfterPush(c, p, e, r.nx, r.nz, 5 * (e.data.knockback ?? 1));
  if (!step.heavy) return;
  // Golpe forte (estocada ou lança arremessada).
  if (died) { if (w.banner) c.lance.addBanner(p, e.position.x, e.position.z); return; }
  if (w.tame && !e.data.boss && !e.undead && !e.data.phantom && !e.finale && e.hp <= e.maxHp * LANCE.tame.hp) { c.lance.tame(p, e); return; }
  if (stab && w.skewer && !p.lanceHeld && !e.data.boss && !e.data.phantom && !e.finale) { c.lance.skewer(p, e); return; }
  if (stab && !w.harpoon) lanceAfterPush(c, p, e, r.nx, r.nz, 10 * (e.data.knockback ?? 1));
}

// No momento do golpe (antes de procurar quem acertou).
export function lanceOnSwing(c, p, step) {
  if (!isLance(p)) return;
  const w = W(p);
  if (w.ghostStab && !step.kit) c.lance.ghostStab(p, step);
  if (!step.heavy || step.kit === 'lancePunch') return;
  if (w.harpoon) c.kit.fireHook(p, { range: LANCE.harpoon.range });
  if (w.spikes) c.lance.spikeLine(p);
  if (p.lanceSkulls > 0) c.lance.throwSkulls(p);
}

// Inimigo destruído pelo herói com a lança: Cemitério de Lanças e Lança de Troféus.
export function lanceOnKill(c, e, by) {
  if (!isLance(by)) return;
  const w = W(by);
  if (w.graves) c.lance.addGrave(by, e.position.x, e.position.z);
  if (w.trophy && (by.lanceSkulls || 0) < LANCE.trophy.max) { by.lanceSkulls = (by.lanceSkulls || 0) + 1; c.lance.mountSkulls(by); }
}

// ---------- Herói: rolar, saltar, guarda ----------

// Rolar na direção de um inimigo: Salto com Vara (devolve true se saltou).
export function lanceStartDodge(p) {
  if (!C || !isLance(p) || !W(p).vault || p.lanceAway || p.axeAway) return false;
  const V = LANCE.vault, dir = new THREE.Vector3();
  p.ctl.moveDir(dir);
  if (dir.lengthSq() === 0) dir.set(Math.sin(p.facing), 0, Math.cos(p.facing)); else dir.normalize();
  const a = Math.atan2(dir.x, dir.z);
  let best = null, bd = Infinity;
  for (const e of C.enemies) {
    if (!e.targetable || e.data.radius > 1.3) continue;
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz);
    if (d > V.range + e.data.radius || Math.abs(wrap(Math.atan2(dx, dz) - a)) > V.arc * DEG || d >= bd) continue;
    best = e; bd = d;
  }
  if (!best) return false;
  const back = best.data.radius + p.hero.radius + 0.5;
  const ta = Math.atan2(best.position.x - p.position.x, best.position.z - p.position.z);
  const tx = best.position.x + Math.sin(ta) * back, tz = best.position.z + Math.cos(ta) * back;
  if (C.world.blocked(tx, tz, p.hero.radius)) return false;
  p.setState('lanceVault');
  p.combo = 0;
  p.facing = ta;
  p.lanceAir = { kind: 'vault', fx: p.position.x, fz: p.position.z, tx, tz, t: 0, T: V.time, h: V.h, e: best, atk: false };
  p.anim.play('Jump_Full_Short', { once: true, restart: true, fade: 0.06, speed: 1.17 / V.time * 0.9 });
  audio.play('dodge', p.position.x, p.position.z);
  C.text.add('Salto com Vara!', p.position, 'crit', 3.0);
  if (C.log) C.log({ type: 'lanceVault', enemy: best });
  return true;
}

// Atacou logo depois de rolar: Salto do Dragão (devolve true se saltou).
export function lancePress(p, camera, fromDodge = false) {
  if (!C || !isLance(p) || !W(p).dragonLeap || p.lanceAway || p.axeAway || p.lanceHeld) return false;
  if (!fromDodge && !((p.lanceSinceDodge ?? 9) <= LANCE.dragon.after)) return false;
  p.lanceSinceDodge = 9;
  const D = LANCE.dragon;
  const a = p.aimAngle(camera);
  let dist = D.dist, tx, tz;
  for (; dist > 0.2; dist -= 0.3) {
    tx = p.position.x + Math.sin(a) * dist; tz = p.position.z + Math.cos(a) * dist;
    if (!C.world.blocked(tx, tz, p.hero.radius)) break;
  }
  if (dist <= 0.2) { tx = p.position.x; tz = p.position.z; }
  p.setState('lanceLeap');
  p.combo = 0;
  p.facing = a;
  p.lanceAir = { kind: 'dragon', fx: p.position.x, fz: p.position.z, tx, tz, t: 0, T: D.time, h: D.h, landed: false };
  p.anim.play('Jump_Full_Short', { once: true, restart: true, fade: 0.05, speed: 1.17 / D.time * 0.85 });
  audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.2 });
  C.text.add('Salto do Dragão!', p.position, 'crit', 3.2);
  if (C.log) C.log({ type: 'lanceLeap' });
  return true;
}

// No ar (Salto com Vara / Salto do Dragão). Devolve 'attack' (atacar já), 'end' ou nada.
export function lanceAirTick(p, dt, world, input) {
  const A = p.lanceAir;
  if (!A) return 'end';
  A.t += dt;
  if (input && input.attack && input.attack()) A.atk = true;
  const k = Math.min(1, A.t / A.T);
  if (!A.landed) {
    p.position.x = A.fx + (A.tx - A.fx) * k; p.position.z = A.fz + (A.tz - A.fz) * k;
    p.model.position.y = A.h * 4 * k * (1 - k);
    if (A.kind === 'dragon') p.model.rotation.x = k > 0.6 ? (k - 0.6) / 0.4 * 0.5 : 0; // inclina para cravar
  }
  if (k < 1) return null;
  if (!A.landed) {
    A.landed = true;
    p.model.position.y = 0; p.model.rotation.x = 0;
    world.resolveCircle(p.position, p.hero.radius);
    if (A.kind === 'vault') {
      const e = A.e;
      if (e && e.alive) p.facing = Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z);
      p.group.rotation.y = p.facing;
      p.lanceReadyT = LANCE.vault.ready;
      p.dodgeCooldown = p.hero.dodge.cooldown;
      if (C) C.vfx.dust(new THREE.Vector3(p.position.x, 0.1, p.position.z), new THREE.Vector3(0, 0, 0), 5);
    } else if (C) {
      C.lance.dragonSlam(p);
      p.anim.play('Melee_2H_Attack_Stab', { once: true, restart: true, fade: 0.04, speed: 1.6 });
      A.rest = LANCE.dragon.rest;
      return null;
    }
  }
  if (A.kind === 'dragon' && (A.rest -= dt) > 0) return null;
  const atk = A.atk;
  p.lanceAir = null;
  return atk ? 'attack' : 'end';
}

// Molinete: apertou o ataque logo depois do golpe forte (devolve true se começou).
export function lanceFollow(p, step, xs, camera) {
  if (!isLance(p) || xs || !step.heavy || !W(p).molinete || p.lanceAway || p.axeAway || p.lanceFlurry) return false;
  p.combo = 0;
  p.startAttack(camera, MOLINETE_STEP);
  if (C) { C.text.add('Molinete!', p.position, 'crit', 3.0); if (C.log) C.log({ type: 'lanceMolinete' }); }
  return true;
}

// A cada quadro (lancekit2 → LanceKit.update): Muralha, Mil Lanças, Âncora, tempos.
export function lancePlayerTick(c, p, dt) {
  if (p.lanceReadyT > 0) p.lanceReadyT -= dt;
  if (p.lanceSinceDodge !== undefined && p.lanceSinceDodge < 9 && p.state !== 'dodge') p.lanceSinceDodge += dt;
  if (p.lanceAnchor) {
    const s = p.xstep || p.hero.combo[p.combo];
    if (p.state !== 'attack' || !s || s.kit !== 'lanceAnchor') endAnchor(p);
    else {
      const an = p.lanceAnchor, A = LANCE.anchor;
      const dur = (p.anim.current ? p.anim.current.getClip().duration : 1) * (s.end || 0.95) / (s.speed * (p.atkSpeed || 1));
      const k = Math.min(1, p.stateTime / dur);
      const ang = an.a0 + k * Math.PI * 2;
      p.position.x = an.x + Math.sin(ang) * A.rad; p.position.z = an.z + Math.cos(ang) * A.rad;
      c.world.resolveCircle(p.position, p.hero.radius);
      p.facing = ang + Math.PI / 2; p.group.rotation.y = p.facing;
    }
  }
  if (!isLance(p)) { p.lanceStill = 0; return; }
  const w = W(p);
  // Mil Lanças: o golpe forte acertou o mesmo inimigo dos 2 primeiros → rajada.
  if (p.lanceFlurry) {
    const s = p.xstep || p.hero.combo[p.combo];
    if (p.state !== 'attack' || !s || !s.heavy || !p.lanceFlurry.alive) { if (!(p.state === 'attack' && s && s.heavy)) p.lanceFlurry = null; }
    else if (p.hitDone) { p.lanceFlurryE = p.lanceFlurry; p.lanceFlurry = null; p.combo = 0; p.startAttack(null, FLURRY_STEP); c.text.add('Mil Lanças!', p.position, 'crit', 3.6); }
  }
  // Molinete girando: rebate flechas e magias.
  if (p.state === 'attack' && p.xstep === MOLINETE_STEP) {
    for (const a of [...c.projectiles.list]) {
      if (!a || a.hits !== 'player' || a.stuck >= 0) continue;
      if (Math.hypot(a.x - p.position.x, a.z - p.position.z) > LANCE.molinete.r + a.r) continue;
      c.axe.reflect(a, p);
      if (c.log) c.log({ type: 'lanceReflect' });
    }
  }
  // Muralha de Pontas: parado 1 s com a lança apontada.
  if (w.spearWall && p.state === 'idle' && !p.lanceAway && !p.axeAway && !p.lanceHeld) {
    const was = p.lanceStill || 0;
    p.lanceStill = was + dt;
    if (was < LANCE.wall.still && p.lanceStill >= LANCE.wall.still) { c.text.add('Em guarda!', p.position, 'block', 3.0); if (c.log) c.log({ type: 'lanceGuard' }); }
    if (p.lanceStill >= LANCE.wall.still) c.lance.wallTick(p, dt);
  } else { p.lanceStill = 0; c.lance.wallOff(p); }
}
