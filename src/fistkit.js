// Bênçãos da Manopla e Escudo de Antebraço do Cavaleiro (lista do dono, 06/11/2026) — lado do herói e ganchos do combate.
// Agarrar: Arremesso, Suplex, Escudo de Carne, Quebra-Escudo. Fazer voar: Strike, Pinball, Soco Sísmico.
// Alcance: Soco de Vento, Punho Foguete, Investida de Punho, Corrente de Nocautes.
// Tempo e defesa: Pegar no Ar, Gingado, Contragolpe Relâmpago. Ritmo: Soco Carregado, Contador de Combo, Pavio.
// Diferentes: Desmontar, Duelo, Saco de Pancadas. O que fica na sala (corpos voando, disco, foguete...) fica em fistkit2.js.
import * as THREE from 'three';
import { audio } from './audio.js';
import { knockDown } from './axekit3.js';

export const FIST = {
  grab: { reach: 2.7, arc: 130 },                                  // quem dá para agarrar (Arremesso, Suplex)
  toss: { speed: 18, dist: 9, path: 12, land: 1.0 },              // Arremesso: dano de quem está no caminho; ao cair = golpe forte
  suplex: { time: 0.4, back: 1.7, h: 2.6, r: 3.0, mul: 1.5, aoe: 0.7, down: 1.0 },
  meat: { delay: 0.11, reach: 3.2, time: 2, dist: 1.45, speed: 0.6, kickAt: 0.2, kickEnd: 0.62, after: 1.0, kickSpeed: 20, kickDist: 10, kickPath: 12, kickLand: 14 }, // Escudo de Carne (atacar bloqueando) + chute final
  disc: { speed: 21, hits: 4, dmg: 18, seek: 8, r: 0.7, life: 3 },    // Quebra-Escudo
  strike: { speed: 17, dist: 10, dmg: 14 },                         // Strike: corpo nocauteado voando
  pinball: { wall: 2.4, in: 15, out: 11, dmg: 6, near: 0.8, hold: 0.8 },
  quake: { r: 3.6, sit: 1.0, boss: 0.4 },                           // Soco Sísmico
  wind: { speed: 20, life: 0.25, mul: 0.6 },                        // Soco de Vento: chega a ~5
  rocket: { speed: 24, range: 14, back: 28, r: 2.6, dmg: 30 },      // Punho Foguete
  dash: { after: 0.45, range: 9, arc: 55, speed: 26, near: 2.2 },   // Investida de Punho
  chain: { range: 8, time: 0.38, h: 1.7 },                          // Corrente de Nocautes
  catchT: 0.35, catchMul: 2,                                        // Pegar no Ar: janela e força da devolução
  sway: { time: 4, push: 3.5, daze: 1.2, boss: 0.4 },               // Gingado
  zap: { window: 0.3, reach: 4.5 },                                 // Contragolpe Relâmpago
  charge: { delay: 0.11, full: 1.4, min: 0.15, dmg0: 10, dmg1: 34, d0: 2, d1: 12, speed: 18, path: 10 }, // Soco Carregado
  combo: { every: 10, r: 4, dmg: 20, push: 12 },                    // Contador de Combo
  fuse: { max: 5, dmg: 6 },                                         // Pavio: dano por faísca
  bag: { n: 8, gap: 2.5, r: 3.5, dmg: 25, boss: 40 },               // Saco de Pancadas
  duel: { time: 4 },                                                // Duelo
};

let C = null;
export const setFistCombat = (c) => { C = c; };
const W = (p) => (p && p.stats && p.stats.w) || {};
export const isFist = (p) => !!(p && p.heroId === 'knight' && p.hero && p.hero.weaponId === 'manopla');
const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// Soco de verdade (não raio, onda, disco...).
const isPunch = (step, r = {}) => !r.ranged && !r.spell && !step.fistFx;
export const grabbable = (e) => !!(e && e.alive && e.targetable && !e.data.boss && !e.undead && !e.data.phantom && !e.finale && !(e.frozenT > 0) && e.data.radius <= 1.3);

// Golpes especiais (fora do combo).
export const DASH_STEP = { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 1.6, hit: 0.3, end: 0.64, lunge: 0.3, damage: 12, keepFacing: true, pushMul: 1.5 };
export const LEAP_STEP = { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 1.8, hit: 0.22, end: 0.6, lunge: 0.15, damage: 12, keepFacing: true };
export const CHARGE_STEP = { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 1.5, hit: 0.3, end: 0.75, lunge: 0.5, damage: 10, kit: 'fistBig', keepFacing: true };
export const COUNTER_STEP = { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 2.2, hit: 0.3, end: 0.6, lunge: 0.1, damage: 12, kit: 'fistCounter', keepFacing: true };

// ---------- Combo ----------

// O golpe forte (4º) muda conforme a bênção (só uma destas vem: Arremesso, Suplex, Soco Sísmico, Punho Foguete).
export function applyFist(p) {
  if (!isFist(p)) return;
  const h = p.hero, w = W(p);
  const i = h.combo.findIndex((s) => s.heavy);
  if (i < 0) return;
  const s = h.combo[i];
  if (w.fistToss) h.combo[i] = { ...s, clip: 'Throw', speed: 1.5, hit: 0.42, end: 0.78, lunge: 0.3, kit: 'fistToss' };
  else if (w.suplex) h.combo[i] = { ...s, clip: 'Melee_2H_Attack_Chop', speed: 1.1, hit: 0.45, end: 0.95, lunge: 0.2, kit: 'fistSuplex' };
  else if (w.quake) h.combo[i] = { ...s, clip: 'Melee_2H_Attack_Chop', speed: 1.3, hit: 0.5, end: 0.85, lunge: 0.1, kit: 'fistQuake' };
  else if (w.rocket) h.combo[i] = { ...s, clip: 'Melee_Unarmed_Attack_Punch_A', speed: 1.2, hit: 0.36, end: 0.72, lunge: 0.1, kit: 'fistRocket' };
  if (p.weapon) p.weapon.visible = !p.fistRocketOut;
}

// Troca de arma/herói, nova partida: tudo volta ao normal.
export function fistReset(p) {
  if (C && C.fist) C.fist.dropFor(p);
  p.fistRocketOut = false; p.fistDisc = false; p.fistCaught = null; p.fistSway = 0; p.fistSwaySeq = -1;
  p.fistHits = 0; p.fistDuel = null; p.fistLeapReq = false; p.fistAir = null; p.fistHold = null; p.fistDis = null;
  p.fistPower = 0; p.fistCounterE = null; p.fistSinceDodge = 9;
  if (p.weapon && isFist(p)) p.weapon.visible = true;
}

// Inimigo mais perto na frente (dentro do alcance e do arco).
export function nearestFront(c, p, reach, arc, ok = (e) => e.targetable) {
  let best = null, bd = Infinity;
  for (const e of c.enemies) {
    if (!ok(e)) continue;
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz);
    if (d > reach + e.data.radius || (arc < 360 && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > arc / 2 * DEG) || d >= bd) continue;
    best = e; bd = d;
  }
  return best;
}

// Golpes com efeito próprio. Devolve true se cuidou do golpe (sem o soco normal).
export function fistStrike(c, p, step) {
  if (!step.kit || !isFist(p)) return false;
  const F = c.fist, G = FIST.grab;
  switch (step.kit) {
    case 'fistToss': { const e = nearestFront(c, p, G.reach, G.arc, grabbable); if (!e) return false; F.toss(p, e, step); return true; }
    case 'fistSuplex': { const e = nearestFront(c, p, G.reach, G.arc, grabbable); if (!e) return false; F.suplex(p, e, step); return true; }
    case 'fistQuake': F.quake(p, step); return true;
    case 'fistRocket': if (p.fistRocketOut) return false; F.fireRocket(p, step); return true;
    case 'fistBig': F.bigPunch(p, step); return true;
    case 'fistCounter': F.zapPunch(p, step); return true;
  }
  return false;
}

// ---------- Dano ----------

// Antes do dano (Quebra-Escudo): o soco arranca o escudo do esqueleto.
export function fistBeforeHit(c, p, e, step) {
  if (!isFist(p) || !W(p).shieldRip || p.fistDisc || step.fistFx) return;
  if (!e.data.shield || e.shieldBroken || e.data.boss || !e.alive) return;
  c.fist.ripShield(p, e);
}

// Depois do dano (wbhooks.wbOnHit, antes de sair quando morreu).
export function fistOnHit(c, p, e, step, r) {
  if (!isFist(p) || !isPunch(step, r)) return;
  const w = W(p), F = c.fist, died = r.died || !e.alive;
  // Contador de Combo: cada acerto conta; a cada 10, onda de choque.
  if (w.comboCount) F.countHit(p);
  // Gingado: o soco carregado pela esquiva empurra longe e atordoa (todos que o mesmo golpe pegar).
  let swayed = false;
  if ((p.fistSway > 0 || p.fistSwaySeq === p.swingSeq) && w.sway) {
    p.fistSway = 0; p.fistSwaySeq = p.swingSeq; swayed = true;
    if (!died) {
      const S = FIST.sway;
      e.daze(e.data.boss ? S.boss : S.daze);
      e.vel.set(r.nx, 0, r.nz).multiplyScalar(5 * S.push * Math.max(0.4, e.data.knockback ?? 1) * (e.data.boss ? 0.3 : 1));
      c.text.add('Gingado!', e.position, 'crit', 3.6);
      c.vfx.sparks(new THREE.Vector3(e.position.x, 1.2, e.position.z), 0x9fe8ff, 14);
      if (c.log) c.log({ type: 'fistSway', enemy: e });
    }
  }
  // Desmontar: o combo inteiro (4 golpes) no mesmo esqueleto.
  if (w.dismantle && !p.xstep) {
    const idx = p.combo, seq = p.swingSeq, ch = p.fistDis;
    if (idx === 0) { if (!ch || ch.seq !== seq) p.fistDis = { e, n: 1, seq }; }
    else if (ch && ch.seq !== seq && ch.e === e && ch.n === idx) { ch.n++; ch.seq = seq; }
    else if (!ch || ch.seq !== seq) p.fistDis = null;
    const d = p.fistDis;
    if (step.heavy && d && d.e === e && d.n === p.hero.combo.length && !died) { p.fistDis = null; F.dismantle(p, e, r.nx, r.nz); }
  }
  // Saco de Pancadas: 8 socos seguidos no mesmo esqueleto.
  if (w.punchBag && !died) {
    e.fistBag = (e.fistBagT > 0 ? e.fistBag || 0 : 0) + 1; e.fistBagT = FIST.bag.gap;
    if (e.fistBag >= FIST.bag.n) { e.fistBag = 0; F.bagBurst(p, e, r.nx, r.nz); return; }
    if (e.fistBag >= 3) c.text.add(`×${e.fistBag}`, e.position, 'miss', 3.0);
  }
  if (died) {
    if (step.heavy && w.strike && !e.data.boss && !e.finale && !e.undead) F.launch(p, e, r.nx, r.nz, { dead: true, speed: FIST.strike.speed, distTotal: FIST.strike.dist, path: FIST.strike.dmg, label: 'Strike!' });
    if (w.koChain && p.state === 'attack') p.fistLeapReq = true; // Corrente de Nocautes
    return;
  }
  // Pavio: cada soco gruda uma faísca (o golpe forte detona).
  if (w.fuse && !step.heavy) F.addFuse(p, e);
  // Duelo: o golpe forte desafia.
  if (w.duel && step.heavy && !e.undead && (!p.fistDuel || !p.fistDuel.e.alive)) F.startDuel(p, e);
  // Pinball: socado contra a parede, volta quicando para o próximo soco.
  if (w.pinball && !swayed && !e.data.boss && !e.undead) F.tryPinball(p, e, r.nx, r.nz);
}

// No momento do golpe (antes de procurar quem acertou).
export function fistOnSwing(c, p, step) {
  if (!isFist(p)) return;
  const w = W(p), F = c.fist;
  if (p.fistCaught && !step.fistFx) F.throwCaught(p); // Pegar no Ar: devolve
  if (p.fistSway > 0 && w.sway) p.fistSwaySeq = p.swingSeq; // Gingado: este golpe é o carregado
  if (!step.heavy) return;
  if (w.fuse) F.detonate(p);
  if (w.wind) {
    const a = p.facing, W2 = FIST.wind;
    c.projectiles.fire(p.position.x + Math.sin(a) * 1.0, p.position.z + Math.cos(a) * 1.0, a, {
      speed: W2.speed, damage: Math.max(1, Math.round(step.damage * W2.mul * p.stats.damageMul)), kind: 'wave', color: 0xcfefff, hits: 'hero', pierce: true,
      height: 0.9, life: W2.life, scale: 1.2, owner: p,
    });
    if (c.log) c.log({ type: 'fistWind' });
  }
  if (p.fistDisc) F.throwDisc(p);
}

// ---------- Defesa (combat.hitPlayer / projectiles) ----------

// Duelo: os outros não machucam. Desmontar: sem arma, só empurra. Devolve true se o golpe não entra.
export function fistIgnore(c, e, p, opts = {}) {
  const src = opts.shooter || e;
  if (src && src.fistDisarmed) {
    if (!opts.contact && src.position) {
      const dx = p.position.x - src.position.x, dz = p.position.z - src.position.z, d = Math.hypot(dx, dz) || 1;
      if (!p.invulnerable) { p.vel.set(dx / d, 0, dz / d).multiplyScalar(8); c.text.add('Empurrão', p.position, 'miss'); }
      if (c.log) c.log({ type: 'fistShove', enemy: src });
    }
    return true;
  }
  const D = p.fistDuel;
  if (D && D.e.alive && src !== D.e && c.enemies.includes(src)) { if (c.log) c.log({ type: 'fistDuelBlock', enemy: src }); return true; }
  return false;
}

// Contragolpe Relâmpago: bloqueou no instante certo → não gasta o escudo e devolve um soco na hora.
export function fistGuard(c, p, e, opts = {}) {
  if (!isFist(p) || !W(p).zap || p.state !== 'block' || p.stateTime > FIST.zap.window) return null;
  if (opts.contact || opts.shooter || !e || !e.alive || !c.enemies.includes(e)) return null;
  p.fistCounterE = e;
  p.counterAtk = { a: Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z), step: COUNTER_STEP };
  c.vfx.bolt(new THREE.Vector3(p.position.x, 1.4, p.position.z), new THREE.Vector3(e.position.x, 1.3, e.position.z), 0x9fdcff);
  c.text.add('Relâmpago!', p.position, 'crit', 3.4);
  if (c.log) c.log({ type: 'fistZap', enemy: e });
  return 'parry';
}

// Pegar no Ar: escudinho levantado no instante certo pega a flecha/magia. Devolve true se pegou.
export function fistCatch(c, p, a, dx, dz) {
  if (!isFist(p) || !W(p).catchShot || p.fistCaught || p.state !== 'block' || p.stateTime > FIST.catchT) return false;
  if (!p.blocksFrom(a.x - dx * 3, a.z - dz * 3)) return false;
  p.fistCaught = { kind: a.kind === 'wave' ? 'orb' : a.kind, color: a.color, damage: a.damage || 8, scale: Math.min(1.4, a.scale || 1) };
  c.fist.showCaught(p, true);
  c.vfx.sparks(new THREE.Vector3(a.x, 1.3, a.z), 0xffe27a, 12);
  c.text.add('Pegou no ar!', p.position, 'crit', 3.4);
  audio.play('block', p.position.x, p.position.z, { v: 0.7 });
  if (c.log) c.log({ type: 'fistCatch', kind: a.kind });
  return true;
}

// Gingado: escapou rolando de um golpe → o próximo soco sai carregado.
export function fistSway(c, p) {
  if (!isFist(p) || !W(p).sway) return;
  if (!(p.fistSway > 0)) c.text.add('Gingado pronto!', p.position, 'crit', 3.2);
  p.fistSway = FIST.sway.time;
  if (c.log) c.log({ type: 'fistSwayReady' });
}

// ---------- Herói: segurar o ataque, investida, saltos ----------

// Escudo de Carne: atacar enquanto bloqueia agarra o esqueleto mais perto (player.js, estado block). true = agarrou.
export function fistMeatPress(p) {
  if (!C || !isFist(p) || !W(p).meat) return false;
  let best = null, bd = FIST.meat.reach;
  for (const e of C.enemies) {
    if (!grabbable(e)) continue;
    const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) - e.data.radius;
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) return false;
  p.setState('fistMeat');
  p.fistHold = { t: 0 };
  p.queued = false;
  p.combo = 0;
  p.facing = Math.atan2(best.position.x - p.position.x, best.position.z - p.position.z);
  C.fist.grabMeat(p, best);
  p.anim.play(p.hero.anims.blocking, { fade: 0.1 });
  return true;
}

// Segurando o ataque no começo do 1º soco: Soco Carregado.
export function fistHoldCheck(p, input) {
  const w = W(p);
  if (!isFist(p) || !w.chargePunch || p.xstep || p.combo !== 0 || p.hitDone) return false;
  if (p.stateTime < FIST.charge.delay || !(input.attackHeld && input.attackHeld())) return false;
  p.setState('fistCharge');
  p.fistHold = { t: 0, k: 0, spark: 0 };
  p.queued = false;
  p.anim.play('Melee_Unarmed_Attack_Punch_A', { once: true, restart: true, fade: 0.06, speed: 0.6 });
  if (C) { C.text.add('Carregando...', p.position, 'miss', 3.0); if (C.log) C.log({ type: 'fistCharge' }); }
  return true;
}

// Segurando: Soco Carregado / Escudo de Carne. Devolve um golpe para começar, 'end' ou nada.
export function fistHoldTick(p, dt, world, input, move, camera) {
  const H = p.fistHold;
  if (!H) return 'end';
  H.t += dt;
  const moving = move.lengthSq() > 0;
  const aim = p.aimAngle(camera);
  if (p.state === 'fistMeat') {
    if (moving) p.move(move.x, move.z, p.hero.moveSpeed * p.moveMul * FIST.meat.speed * dt, world);
    p.facing += wrap(aim - p.facing) * Math.min(1, dt * 10);
    if (!C || !C.fist.meatOf(p)) { p.fistHold = null; return 'end'; }
    if (H.t >= FIST.meat.time) { // acabou o tempo: chuta o esqueleto para longe
      p.setState('fistKick');
      p.fistHold = { t: 0, kicked: false };
      p.iframes = Math.max(p.iframes, FIST.meat.kickEnd + FIST.meat.after);
      p.anim.play('Melee_Unarmed_Attack_Kick', { once: true, restart: true, fade: 0.06, speed: 1.3 });
    }
    return null;
  }
  if (p.state === 'fistKick') { // chute do Escudo de Carne: sem levar dano durante e por 1 s depois
    const M = FIST.meat;
    if (!H.kicked && H.t >= M.kickAt) { H.kicked = true; if (C) C.fist.kickMeat(p); }
    return H.t >= M.kickEnd ? (p.fistHold = null, 'end') : null;
  }
  // Soco Carregado: a mão para no alto e brilha cada vez mais.
  const F = FIST.charge;
  if (p.anim.current && p.anim.progress() > 0.22) p.anim.current.timeScale = 0;
  if (moving) p.move(move.x, move.z, p.hero.moveSpeed * p.moveMul * 0.35 * dt, world);
  p.facing += wrap(aim - p.facing) * Math.min(1, dt * 10);
  H.k = Math.min(1, H.t / F.full);
  p.setGlow(0.2 + 0.8 * H.k);
  H.spark -= dt;
  if (C && H.spark <= 0) { H.spark = 0.12; C.vfx.sparks(new THREE.Vector3(p.position.x + Math.sin(p.facing) * 0.6, 1.2, p.position.z + Math.cos(p.facing) * 0.6), H.k >= 1 ? 0xffe27a : 0xffa040, 2 + Math.round(H.k * 4)); }
  const held = input.attackHeld ? input.attackHeld() : false;
  if (held) return null;
  p.fistHold = null;
  p.fistPower = H.t < F.min ? 0 : H.k;
  p.facing = aim;
  return CHARGE_STEP;
}

// Atacou logo depois de rolar: Investida de Punho (devolve true se saiu correndo para o inimigo).
export function fistPress(p, camera, fromDodge = false) {
  if (!C || !isFist(p) || !W(p).fistDash) return false;
  if (!fromDodge && !((p.fistSinceDodge ?? 9) <= FIST.dash.after)) return false;
  p.fistSinceDodge = 9;
  const D = FIST.dash, a = p.aimAngle(camera);
  const face = p.facing; p.facing = a;
  const e = nearestFront(C, p, D.range, D.arc * 2);
  p.facing = face;
  if (!e) return false;
  const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) - e.data.radius - p.hero.radius;
  p.facing = Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z);
  if (d <= D.near - 1) { p.combo = 0; p.startAttack(null, DASH_STEP); return true; }
  p.setState('fistDash');
  p.combo = 0;
  p.fistAir = { kind: 'dash', e, t: 0 };
  p.anim.play(p.hero.anims.run, { fade: 0.05, speed: 1.8 });
  audio.play('dodge', p.position.x, p.position.z);
  C.text.add('Investida!', p.position, 'crit', 3.0);
  if (C.log) C.log({ type: 'fistDash', enemy: e });
  return true;
}

// Corrente de Nocautes: salta até o próximo inimigo perto (devolve true se saltou).
export function fistStartLeap(p) {
  if (!C) return false;
  let best = null, bd = FIST.chain.range;
  for (const e of C.enemies) {
    if (!e.targetable || e.undead) continue;
    const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
    if (d < bd + e.data.radius) { bd = d - e.data.radius; best = e; }
  }
  if (!best) return false;
  const ta = Math.atan2(best.position.x - p.position.x, best.position.z - p.position.z);
  const back = best.data.radius + p.hero.radius + 0.55;
  let tx = best.position.x - Math.sin(ta) * back, tz = best.position.z - Math.cos(ta) * back;
  if (C.world.blocked(tx, tz, p.hero.radius)) { tx = p.position.x; tz = p.position.z; }
  p.setState('fistLeap');
  p.combo = 0;
  p.facing = ta;
  p.fistAir = { kind: 'leap', e: best, fx: p.position.x, fz: p.position.z, tx, tz, t: 0, T: FIST.chain.time };
  p.anim.play('Jump_Full_Short', { once: true, restart: true, fade: 0.05, speed: 1.17 / FIST.chain.time * 0.9 });
  audio.play('dodge', p.position.x, p.position.z);
  C.text.add('Nocaute em cadeia!', p.position, 'crit', 3.2);
  if (C.log) C.log({ type: 'fistLeap', enemy: best });
  return true;
}

// Correndo / saltando até o inimigo. Devolve um golpe para começar, 'end' ou nada.
export function fistAirTick(p, dt, world) {
  const A = p.fistAir;
  if (!A) return 'end';
  A.t += dt;
  const e = A.e;
  if (A.kind === 'dash') {
    if (!e || !e.alive || A.t > 0.6) { p.fistAir = null; return e && e.alive ? DASH_STEP : 'end'; }
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
    p.facing = Math.atan2(dx, dz);
    if (d - e.data.radius - p.hero.radius <= FIST.dash.near - 1) { p.fistAir = null; return DASH_STEP; }
    const before = p.position.clone();
    p.move(dx / d, dz / d, Math.min(FIST.dash.speed * dt, d - e.data.radius - p.hero.radius), world);
    if (C && Math.random() < dt * 20) C.vfx.dust(new THREE.Vector3(p.position.x, 0.1, p.position.z), new THREE.Vector3(0, 0, 0), 1);
    if (p.position.distanceTo(before) < 0.01) { p.fistAir = null; return DASH_STEP; } // parede no caminho
    return null;
  }
  const k = Math.min(1, A.t / A.T);
  p.position.x = A.fx + (A.tx - A.fx) * k; p.position.z = A.fz + (A.tz - A.fz) * k;
  p.model.position.y = FIST.chain.h * 4 * k * (1 - k);
  if (e && e.alive) p.facing = Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z);
  if (k < 1) return null;
  p.model.position.y = 0;
  world.resolveCircle(p.position, p.hero.radius);
  p.fistAir = null;
  if (C) C.vfx.dust(new THREE.Vector3(p.position.x, 0.1, p.position.z), new THREE.Vector3(0, 0, 0), 5);
  return LEAP_STEP;
}

// A cada quadro (FistKit.update): tempos, salto da Corrente, Gingado brilhando.
export function fistPlayerTick(c, p, dt) {
  if (p.fistSinceDodge !== undefined && p.fistSinceDodge < 9 && p.state !== 'dodge') p.fistSinceDodge += dt;
  if (p.state === 'dodge') p.fistSinceDodge = 0;
  if (p.fistSway > 0) {
    p.fistSway -= dt;
    if (Math.random() < dt * 12) c.vfx.sparks(new THREE.Vector3(p.position.x + Math.sin(p.facing + 0.5) * 0.5, 1.1, p.position.z + Math.cos(p.facing + 0.5) * 0.5), 0x9fe8ff, 1);
  }
  if (p.fistLeapReq) {
    if (p.state === 'dead' || !isFist(p)) p.fistLeapReq = false;
    else if (p.state !== 'attack' || p.hitDone) { p.fistLeapReq = false; if (p.state === 'attack' || p.state === 'idle' || p.state === 'run') fistStartLeap(p); }
  }
}

// Esqueleto no chão sentado (Soco Sísmico) / derrubado (Arremesso, Strike, Suplex).
export { knockDown };
