// Efeitos "na hora" das bênçãos exclusivas de arma (weaponbless.js). Chamados pelo combate.
import * as THREE from 'three';
import { audio } from './audio.js';
import { axeDamageMul, axeOnHit, axeOnKill } from './axekit.js';
import { axe3OnKill } from './axekit3.js';
import { flailOnHit, flailTick, flailCounterTarget, isFlail, LASH_STEP } from './flailkit.js';
import { lanceDamage, lanceOnHit, lanceOnSwing, lanceOnKill } from './lancekit.js';
import { fistOnHit, fistOnSwing } from './fistkit.js';
import { rapDamage } from './rapkit.js';

const W = (p) => (p && p.stats && p.stats.w) || {};
const healP = (combat, p, n) => {
  if (!(n > 0) || p.state === 'dead') return;
  const got = p.heal(Math.round(n));
  if (got) combat.text.add(`+${got}`, p.position, 'heal small');
};
const healCd = (combat, p, n) => { // cura limitada (no máximo a cada 0,3 s)
  if (!(n > 0) || (p.wbHealCd || 0) > 0) return;
  p.wbHealCd = 0.3;
  healP(combat, p, n);
};

// Multiplicador de dano e crítico extra para um acerto do herói p no inimigo e.
export function wbDamage(p, e, step, ctx) {
  const w = W(p);
  let mul = 1;
  if (e.markT > 0) mul *= 1 + (e.markMul || 0); // Marca Arcana / Maldição (vale para todos os heróis)
  if (w.vsStun && (e.state === 'hurt' || e.offBalanceT > 0 || e.frozenT > 0)) mul *= 1 + w.vsStun;
  if (w.vsFull && e.hp >= e.maxHp) mul *= 1 + w.vsFull;
  if (w.vsBig && (e.data.boss || e.data.shield)) mul *= 1 + w.vsBig;
  if (w.eShort && ctx.spell && e.data.shield && !e.shieldBroken) mul *= 2; // Curto-Circuito (Cajado Elétrico): choque em dobro
  if (w.vsBurn && e.burn > 0) mul *= 1 + w.vsBurn;
  if (w.vsBleed && e.bleedStacks > 0) mul *= 1 + w.vsBleed;
  if (w.vsSlow && (e.slow > 0 || e.frozenT > 0)) mul *= 1 + w.vsSlow;
  if (w.lowHpDmg && p.hp < p.maxHp * 0.5) mul *= 1 + w.lowHpDmg;
  if (w.dodgeDmg && p.wbDodgeT > 0) mul *= 1 + w.dodgeDmg;
  if (w.killRamp && p.rampStacks > 0) mul *= 1 + w.killRamp * p.rampStacks;
  if (w.parryDmg && p.parryCrit) mul *= 1 + w.parryDmg;
  mul *= axeDamageMul(p); // Machado: Fio Pesado, Sede de Batalha
  if (w.backDmg && ctx.backstab) mul *= 1 + w.backDmg;
  if (e.rogueMarkBy === p) mul *= 1.3; // Marca da Morte (Duas Adagas)
  if (e.bDivT > 0) mul *= 1.15; // Divindade (Besta): marcado pela flecha espectral
  const ld = lanceDamage(p, e, step, ctx); // Lança: Ponta Doce, Contra-Carga, Salto com Vara
  if (ld) mul *= ld.mul;
  const rd = rapDamage(p, e, step); // Rapieira: Ponto Fraco
  if (rd) mul *= rd.mul;
  return { mul, critMul: w.critDmg || 0, forceCrit: !!(w.dodgeCrit && p.wbDodgeT > 0) || !!(ld && ld.forceCrit) || !!(rd && rd.forceCrit), pushOnly: !!(ld && ld.pushOnly) };
}

// Depois do dano: curas, sangramento, marca, lentidão, raio, 2º impacto...
export function wbOnHit(combat, p, e, step, r) {
  const w = W(p);
  if (combat.rogue2) combat.rogue2.onHit(p, e, step, r); // Duas Adagas (roguekit.js)
  if (combat.claw2) combat.claw2.onHit(p, e, step, r); // Garras (clawkit.js)
  if (combat.rap) combat.rap.onHit(p, e, step, r); // Rapieira (rapkit.js)
  if (combat.rap2) combat.rap2.onHit(p, e, step, r); // Rapieira, 3ª leva (rapkit2.js)
  if (!Object.keys(w).length) return;
  const { dmg, died, crit, spell, nx, nz } = r;
  if (p.wbDodgeT > 0 && (w.dodgeDmg || w.dodgeCrit)) p.wbDodgeT = Math.min(p.wbDodgeT, w.dodgeCrit ? p.wbDodgeT : 0.05); // Pés Ligeiros: vale para este golpe
  if (crit) {
    healP(combat, p, w.critHeal);
    if (w.critHaste) p.hasteT = 2;
  }
  healCd(combat, p, w.hitHeal);
  if (e.burn > 0) healCd(combat, p, w.burnHeal);
  if (e.bleedStacks > 0) healCd(combat, p, w.bleedHeal);
  if (step.heavy) healP(combat, p, w.healH);
  if (step.arc === 360) healP(combat, p, w.spinHeal);
  axeOnHit(combat, p, e, step, died); // Braços de Ferro
  lanceOnHit(combat, p, e, step, r); // Lança: Contra-Carga, Pregar, Para-raios, Mil Lanças, Espetinho, Domador, Estandarte
  fistOnHit(combat, p, e, step, r); // Manopla: Combo, Gingado, Desmontar, Saco, Strike, Corrente, Pavio, Duelo, Pinball
  if (died || !e.alive) return;
  if (w.burnHit) { e.burn = 3 + (w.burnTime || 0); e.burnDps = Math.max(e.burnDps || 0, w.burnHit * p.stats.damageMul); e.burnTick = 0.5; e.burnBy = p; }
  if (w.slowHit) e.slow = Math.max(e.slow || 0, w.slowHit);
  if (step.heavy && w.slowH) e.slow = Math.max(e.slow || 0, w.slowH);
  if (w.markHit) { e.markT = 3; e.markMul = Math.max(e.markMul || 0, w.markHit); }
  if (w.bleedHit && Math.random() < w.bleedHit) addBleed(combat, p, e, 1);
  if (w.freezeChance && spell && !step.heavy && !e.data.boss && e.freeze && Math.random() < w.freezeChance) e.freeze(1.2, combat);
  flailOnHit(combat, p, e, step); // Mangual: Estrela da Manhã, Impacto Sísmico, Corrente Enroscada
  if (w.stun && e.state === 'hurt' && e.t === 0) e.stunTime *= 1 + w.stun;
  if (step.heavy && w.heavyOff && e.offBalance && e.offBalance(nx, nz, 0.6, 4)) combat.text.add('Desequilibrado!', e.position, 'hurt', 3.2);
  if (step.heavy && w.heavyChain && p.chainSwing !== p.swingSeq) { p.chainSwing = p.swingSeq; combat.chainLightning(e, w.heavyChain, p); }
  let twice = 0;
  if (step.heavy && w.twiceH) twice = Math.max(twice, w.twiceH);
  if (w.twice) twice = Math.max(twice, w.twice);
  if (w.twiceChance && Math.random() < w.twiceChance) twice = Math.max(twice, 0.5);
  if (crit && w.critTwice) twice = Math.max(twice, w.critTwice);
  if (twice && e.alive && e.targetable) {
    combat.vfx.sparks(new THREE.Vector3(e.position.x, 1.3, e.position.z), spell ? 0x9dffc8 : 0xffe6a0, 6);
    combat.bonusDamage(e, Math.max(1, Math.round(dmg * twice)), nx, nz, 'dmg', p);
  }
  // Pancada (Espada e Escudo): o golpe forte atordoa 1 s (2 s no máximo). Por último: o 2º impacto não encurta.
  if (step.heavy && w.heavyDaze && e.alive && e.daze && e.daze(e.data.boss ? Math.min(0.5, w.heavyDaze) : w.heavyDaze)) combat.text.add('Atordoado!', e.position, 'hurt', 3.2);
}

export function addBleed(combat, p, e, n) {
  e.bleedStacks = (e.bleedStacks || 0) + n;
  e.bleedBy = p;
  combat.text.add(e.bleedStacks > 1 ? `Sangramento ×${e.bleedStacks}` : 'Sangrando!', e.position, 'bleed', 3.0);
}

// No momento do golpe (corpo a corpo), antes de procurar quem acertou.
export function wbOnSwing(combat, p, step) {
  p.swingSeq = (p.swingSeq || 0) + 1;
  const w = W(p);
  if (combat.rogue2) combat.rogue2.onSwing(p, step); // Duas Adagas: Leque de Facas, Golpe de Misericórdia
  if (combat.claw2) combat.claw2.onSwing(p, step); // Garras: Rugido, Cortes de Vento, Marcas, Tigre, Afiar
  lanceOnSwing(combat, p, step); // Lança: Estocada Fantasma, Arpão, Espinhos de Pedra, Troféus
  fistOnSwing(combat, p, step); // Manopla: Pavio, Soco de Vento, disco, Pegar no Ar
  if (step.heavy && w.fireLine) { // Lança do Dragão
    const a = p.facing;
    combat.projectiles.fire(p.position.x + Math.sin(a) * 1.2, p.position.z + Math.cos(a) * 1.2, a, {
      speed: 18, damage: Math.round(w.fireLine * p.stats.damageMul), kind: 'wave', color: 0xff7a2a, hits: 'hero', pierce: true,
      height: 0.8, life: 0.55, scale: 1.3, owner: p, burn: 4,
    });
  }
}

// Inimigo destruído pelo herói.
export function wbOnKill(combat, e, by) {
  const w = W(by);
  if (combat.rogue2) combat.rogue2.onKill(e, by); // Duas Adagas: adaga cravada, marca, cobra, sumir, frasco
  if (combat.claw2) combat.claw2.onKill(e, by); // Garras: Matilha
  axeOnKill(combat, e, by); // Sede de Batalha, Racha-Crânios
  axe3OnKill(combat, e, by); // Grito de Guerra, Futebol de Crânio
  lanceOnKill(combat, e, by); // Lança: Cemitério de Lanças, Lança de Troféus
  if (w.killRamp) { by.rampStacks = Math.min(10, (by.rampStacks || 0) + 1); by.rampT = 6; }
  if (w.spreadBurn && e.burn > 0 && !e.burstFire) { // Contágio
    e.burstFire = true;
    const at = new THREE.Vector3(e.position.x, 0, e.position.z);
    combat.vfx.flameCone(new THREE.Vector3(at.x, 0.8, at.z), 0, 1.6, Math.PI, 0xff7a2a, true);
    combat.vfx.ring(at, 0xff7a2a, 2.4);
    audio.play('boom', at.x, at.z, { v: 0.6 });
    for (const o of [...combat.enemies]) {
      if (o === e || !o.targetable) continue;
      const dx = o.position.x - at.x, dz = o.position.z - at.z, d = Math.hypot(dx, dz);
      if (d > 2.4 + o.data.radius) continue;
      combat.bonusDamage(o, Math.round(w.spreadBurn * by.stats.damageMul), dx / (d || 1), dz / (d || 1), 'burn', by);
      if (o.alive) { o.burn = 3 + (w.burnTime || 0); o.burnDps = Math.max(o.burnDps || 0, 3 * by.stats.damageMul); o.burnTick = 0.5; o.burnBy = by; }
    }
  }
}

// Estilhaçou um congelado (Cajado de Gelo).
export function wbOnShatter(combat, p, e) {
  const w = W(p);
  if (combat.ice2) combat.ice2.onShatter(p, e); // Floco Gigante, Estalagmites, Cristais
  if (!w.frostNova) return;
  const at = new THREE.Vector3(e.position.x, 0, e.position.z);
  combat.vfx.ring(at, 0x8fe3ff, 2.6);
  combat.vfx.sparks(new THREE.Vector3(at.x, 1, at.z), 0xcff4ff, 16);
  for (const o of [...combat.enemies]) {
    if (o === e || !o.targetable) continue;
    const dx = o.position.x - at.x, dz = o.position.z - at.z, d = Math.hypot(dx, dz);
    if (d > 2.6 + o.data.radius) continue;
    combat.bonusDamage(o, Math.round(w.frostNova * p.stats.damageMul), dx / (d || 1), dz / (d || 1), 'block', p);
    if (o.alive) o.slow = Math.max(o.slow || 0, 2.5);
  }
  if (combat.log) combat.log({ type: 'frostNova' });
}

// Escudo do Cavaleiro bloqueou um golpe de e.
export function wbOnBlock(combat, p, e, nx, nz) {
  const w = W(p);
  healP(combat, p, w.blockHeal);
  if (w.bashDmg && e.alive && e.targetable) combat.bonusDamage(e, Math.round(w.bashDmg * p.stats.damageMul), -nx, -nz, 'dmg', p);
  // Reflexo (Mangual): contra-ataque automático no inimigo mais perto (player.js faz o golpe).
  if (w.autoCounter && isFlail(p) && p.state !== 'dead') { // Reflexo (Mangual): lança a bola no inimigo mais distante
    const t = flailCounterTarget(combat, p);
    if (t) { p.flailLashTarget = t; p.counterAtk = { a: Math.atan2(t.position.x - p.position.x, t.position.z - p.position.z), step: LASH_STEP }; }
  }
}

// Rapieira aparou um golpe.
export function wbOnParry(combat, p) {
  const w = W(p);
  healP(combat, p, w.parryHeal);
  if (w.parryAoe) {
    combat.vfx.ring(new THREE.Vector3(p.position.x, 0, p.position.z), 0xffe27a, w.parryAoe);
    for (const e of combat.enemies) {
      if (!e.alive || !e.targetable || !e.offBalance) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
      if (d > w.parryAoe + e.data.radius) continue;
      if (e.offBalance(dx / d, dz / d, 0.8, 6)) combat.text.add('Desequilibrado!', e.position, 'hurt', 3.2);
    }
  }
}

// Círculos de fogo no chão (Inferno) e os tempos das bênçãos no herói.
export function wbTick(combat, dt) {
  for (const p of combat.players) {
    if (p.wbHealCd > 0) p.wbHealCd -= dt;
    if (p.hasteT > 0) p.hasteT -= dt;
    if (p.wbDodgeT > 0) p.wbDodgeT -= dt;
    if (p.rampT > 0) { p.rampT -= dt; if (p.rampT <= 0) p.rampStacks = 0; }
  }
  flailTick(combat, dt); // Mangual: marcas e correntes
  const f = combat.fireFields || (combat.fireFields = []);
  for (let i = f.length - 1; i >= 0; i--) {
    const z = f[i];
    z.age += dt; z.tick -= dt;
    if (z.age >= z.life) { f.splice(i, 1); continue; }
    if (Math.random() < dt * 14) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * z.r;
      combat.vfx.flameCone(new THREE.Vector3(z.x + Math.sin(a) * r, 0.3, z.z + Math.cos(a) * r), 0, 0.25, Math.PI, 0xff7a2a, false);
    }
    if (z.tick > 0) continue;
    z.tick = 0.5;
    for (const e of [...combat.enemies]) {
      if (!e.targetable) continue;
      if (Math.hypot(e.position.x - z.x, e.position.z - z.z) > z.r + e.data.radius) continue;
      e.burnBy = z.by;
      combat.burnDamage(e, z.dmg);
      if (e.alive) { e.burn = Math.max(e.burn || 0, 1.5); e.burnDps = Math.max(e.burnDps || 0, z.dmg); e.burnTick = 0.5; }
    }
  }
}

export function addFireField(combat, p, x, z, r) {
  (combat.fireFields || (combat.fireFields = [])).push({ x, z, r, age: 0, life: 3, tick: 0.25, dmg: Math.max(1, Math.round(3 * p.stats.damageMul)), by: p });
  combat.vfx.ring(new THREE.Vector3(x, 0, z), 0xff5a1a, r);
}
