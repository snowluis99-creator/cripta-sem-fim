// Bênçãos novas da Rapieira do Ladino (lista do dono, 07/11/2026): as regras. O visual está em rapprops.js.
// Sem import de combat.js: o combate cria o kit (combat.rap) e chama os ganchos; player.js chama
// rapStartDodge / rapStepTick / rapPress / rapHoldCheck / rapStateTick / rapReset; rogue.js chama onParry/deflect;
// abilities.js chama capeCharge / capeLeap / capeLand.
// Rapieira: combo de 3 (estocada, corte em cone, estocada forte). "Contra-golpe" = o golpe logo depois de aparar (p.parryCrit).
import * as THREE from 'three';
import { audio } from './audio.js';
import { statDamage } from './runstats.js';
import { setFlash } from './characters.js';
import { ghostFencer, leftDagger, pistol, muzzleFlash, streak, streak2, ghostRapier, signMark, setSign, weakPoint, slowOverlay, glowSprite, dispose } from './rapprops.js';

export const RAP = {
  slow: { t: 1, scale: 0.2 },                                   // Câmera Lenta: 1 s com os outros a 20% da velocidade
  sing: { r: 3.6, t: 0.5 },                                     // Lâmina Cantante
  dagger: { dmg: 6, delay: 0.07 },                              // Punhal de Canhota
  ghost: { r: 8, dmg: 14, hit: 0.3, life: 1.0 },                // Espadachim Fantasma
  guard: { still: 1 },                                          // En Garde: 1 s parado
  chain: { t: 1 },                                              // Aparar em Cadeia: 1 s
  step: { dist: 3.0, time: 0.2, atk: 0.05 },                    // Passo de Esgrima
  bravado: { r: 5, t: 1, bow: 0.65 },                           // Bravata
  coin: 3,                                                      // Aplausos: ouro por aparada
  cape: { stun: 2, bossStun: 1, extra: 16 },                    // Capa do Toureiro
  sign: { need: 3, t: 3, dmg: 24 },                             // Assinatura: 3 marcas = sangra 24 em 3 s
  weak: { every: 4, life: 1.8, range: 12, mul: 2.5, stun: 1.2, line: 5, w: 0.9 }, // Ponto Fraco
  surgeon: { need: 3 },                                         // Precisão Cirúrgica
  fleche: { run: 0.3, dist: 7.5, time: 0.3, w: 1.1, dmg: 12, cd: 1.2, pose: 0.32 }, // Estocada Relâmpago
  flurry: { delay: 0.2, every: 0.085, dmg: 3, max: 3, anim: 0.15, arc: 22 }, // Chuva de Estocadas
  waltz: { add: 0.6, max: 5 },                                  // Valsa: +60% de empurrão por passo
  echo: { delay: 0.5, mul: 0.6 },                               // Golpe Fantasma
  musket: { every: 3, dmg: 30, push: 22, range: 16, show: 0.5 }, // Mosqueteiro
  riposte: { t: 0.5, cd: 20, base: 10, stun: 1.5, bossStun: 0.75, slow: 1.5, w: 0.9, strike: 0.32, extra: 0.6 }, // Ripostar (W da Fiora)
};
const DEG = Math.PI / 180;
const GOLD = 0xffe27a, BLUE = 0x9fe0ff;
const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const isRap = (p) => !!(p && p.heroId === 'rogue' && p.hero && p.hero.weaponId === 'rapieira');
const has = (p, k) => isRap(p) && !!W(p)[k];
const STAB = 'Melee_1H_Attack_Stab';
const FLECHE_STEP = { damage: RAP.fleche.dmg, rapExtra: true, heavy: true, stab: true };
const FLURRY_STEP = { damage: RAP.flurry.dmg, rapExtra: true, stab: true };
// Reverência (Bravata), por cima do Idle_A: [x, y, z] relativo por osso. Ajustada olhando screenshots.
const BOW = { spine: [0.35, 0, 0], chest: [0.28, 0, 0], head: [0.2, 0, 0], upperarmr: [0, 0, -1.1], lowerarmr: [0, 0, -0.3], upperarml: [0.9, 0, 0.6], lowerarml: [0, -1.4, 0] };
const BOW_BONES = Object.keys(BOW);
let K = null;
const isStab = (step) => !!(step && (step.stab || step.clip === STAB));

// ---------- Herói (player.js) ----------

// Passo de Esgrima: o rolamento vira um passo curto e rápido para trás ou para o lado (true = já começou).
export function rapStartDodge(p) {
  if (!K || !has(p, 'rStep')) return false;
  const S = RAP.step, d = p.dodgeDir;
  if (p.ctl && p.ctl.moveDir) p.ctl.moveDir(d); else d.set(0, 0, 0);
  const f = p.facing;
  let rel;
  if (d.lengthSq() < 0.01) rel = Math.PI; // parado: para trás
  else { d.normalize(); rel = wrap(Math.atan2(d.x, d.z) - f); if (Math.abs(rel) < 60 * DEG) rel = Math.PI; } // para a frente vira para trás
  const a = f + rel;
  d.set(Math.sin(a), 0, Math.cos(a));
  const clip = Math.abs(rel) > 135 * DEG ? 'Dodge_Backward' : rel > 0 ? 'Dodge_Left' : 'Dodge_Right';
  if (p.clearRoll) p.clearRoll();
  p.setState('dodge');
  p.combo = 0; p.queued = false; p.setGlow(0);
  p.rapStep = { t: 0, atk: false, clip };
  p.anim.play(clip, { once: true, restart: true, fade: 0.05, speed: 2.4 });
  audio.play('dodge', p.position.x, p.position.z, { v: 0.7 });
  if (p.stats.w.dodgeDmg || p.stats.w.dodgeCrit) p.wbDodgeT = 1.8;
  if (p.onDodge) p.onDodge(p, 'start');
  K.log({ type: 'rapStep', clip });
  return true;
}
// Passo de Esgrima, a cada quadro (estado 'dodge'). Devolve 'attack', 'end' ou nada.
export function rapStepTick(p, dt, world, input) {
  const S = RAP.step, st = p.rapStep;
  if (input && input.attack && input.attack()) st.atk = true;
  const speed = S.dist * (p.stats.dodgeMul || 1) / S.time;
  if (p.stateTime < S.time) p.move(p.dodgeDir.x, p.dodgeDir.z, speed * dt, world);
  if (st.atk && p.stateTime >= S.atk) { p.rapStep = null; p.dodgeCooldown = p.hero.dodge.cooldown; if (p.onDodge) p.onDodge(p, 'end'); return 'attack'; }
  if (p.stateTime >= S.time) { p.rapStep = null; p.dodgeCooldown = p.hero.dodge.cooldown; if (p.onDodge) p.onDodge(p, 'end'); return 'end'; }
  return null;
}

// Estocada Relâmpago: correndo, o ataque vira um avanço longo (true = começou).
export function rapPress(p) {
  if (!K || !has(p, 'rFleche') || p.state !== 'run' || !(p.rapRunT >= RAP.fleche.run) || p.rapFlecheCd > 0) return false;
  return K.startFleche(p);
}

// Chuva de Estocadas: segurando o ataque na 1ª estocada do combo (true = virou a chuva).
export function rapHoldCheck(p, input) {
  if (!K || !has(p, 'rFlurry') || p.xstep || p.combo !== 0) return false;
  if (p.stateTime < RAP.flurry.delay || !(input.attackHeld && input.attackHeld())) return false;
  p.setState('rapFlurry');
  p.rapFlurry = { t: 0, next: 0, anim: 0 };
  p.queued = false;
  if (K.c) K.c.text.add('Chuva de Estocadas!', p.position, 'crit', 3.2);
  K.log({ type: 'rapFlurry' });
  return true;
}

// Ripostar (botão direito da Rapieira, 07/11 noite — igual ao W da Fiora do LoL): por 0,5 s nega todo o dano
// recebido; depois estoca na direção da mira e devolve o dano negado aos inimigos na linha do alcance.
// Atordoa se negou algum golpe; senão, deixa lento. Recarga de 20 s. true = começou.
export function rapRiposte(p, camera) {
  if (!K || !has(p, 'rRiposte')) return false;
  if (p.rapRipCd > 0) return false;
  return K.startRiposte(p, camera);
}
export const rapHasRiposte = (p) => !!K && has(p, 'rRiposte');

// Estados próprios: rapLunge (Estocada Relâmpago), rapFlurry (Chuva de Estocadas), rapBow (Bravata), rapRiposte.
// Devolve 'end' ou nada.
export function rapStateTick(p, dt, world, input, camera) {
  if (!K) { p.rapAir = null; return 'end'; }
  if (p.state === 'rapRiposte') return K.riposteTick(p, dt, camera);
  if (p.state === 'rapLunge') return K.flecheTick(p, dt, world);
  if (p.state === 'rapFlurry') return K.flurryTick(p, dt, input, camera);
  if (p.state === 'rapBow') {
    if (p.stateTime >= RAP.bravado.bow) { p.rapPose = null; return 'end'; }
    return null;
  }
  return 'end';
}

// Troca de arma/herói, partida nova.
export function rapReset(p) {
  p.rapStep = null; p.rapAir = null; p.rapFlurry = null; p.rapPose = null;
  p.rapGuard = false; p.rapStill = 0; p.rapChainT = 0; p.rapRunT = 0; p.rapFlecheCd = 0;
  p.rapWaltz = 0; p.rapWaltzArmed = false; p.rapParryN = 0; p.rapSurg = null; p.rapRip = null; p.rapRipCd = 0;
  if (K) K.dropFor(p);
}

export class RapKit {
  constructor(c) {
    this.c = c; K = this;
    this.scene = c.scene;
    this.slowT = 0;
    this.ghosts = []; this.echoes = []; this.later = []; this.signs = new Map(); this.weak = null; this.weakCd = RAP.weak.every;
    this.daggers = new Map(); this.pistols = new Map(); this.guardFx = new Map();
    this.time = 0;
  }
  log(o) { if (this.c.log) this.c.log(o); }
  dmg(p, n) { return Math.max(1, Math.round(n * ((p && p.stats && p.stats.damageMul) || 1))); }
  owner(k) { return this.c.players.find((p) => p.state !== 'dead' && has(p, k)) || null; }
  rm(o) { if (o) { o.removeFromParent(); dispose(o); } }
  foes(x, z, r, skip = null) {
    return this.c.enemies.filter((o) => o !== skip && o.targetable && !o.undead && !(o.data && o.data.phantom)
      && Math.hypot(o.position.x - x, o.position.z - z) <= r + o.data.radius);
  }
  nearest(x, z, r, skip = null) {
    let best = null, bd = Infinity;
    for (const o of this.foes(x, z, r, skip)) { const d = Math.hypot(o.position.x - x, o.position.z - z); if (d < bd) { bd = d; best = o; } }
    return best;
  }

  // Atordoa por t s (sem encurtar quem já está atordoado por mais tempo, ex.: o atacante aparado).
  stun(e, t) {
    if (e.state === 'hurt' && (e.stunTime - e.t) >= t) return true;
    return !!(e.daze && e.daze(t));
  }

  // Câmera Lenta: velocidade dos inimigos e dos tiros (o Ladino não fica lento).
  foeScale() { return this.slowT > 0 ? RAP.slow.scale : 1; }

  // ---------- Aparar ----------
  // En Garde / Aparar em Cadeia: o golpe é aparado sozinho (combat.hitPlayer, antes da esquiva/iframes).
  canAuto(p) {
    if (!isRap(p) || p.state === 'dead' || p.state === 'dodge' || p.state === 'cine') return false;
    const w = W(p);
    return !!((w.rChain && p.rapChainT > 0) || (w.rGuard && p.rapGuard));
  }
  autoParry(p, e, opts) {
    if (opts.contact || !this.canAuto(p) || !this.c.rogue) return false;
    return this.c.rogue.tryParry(p, e, { ...opts, auto: p.rapChainT > 0 && W(p).rChain ? 'chain' : 'guard' });
  }
  autoParryShot(p, a, dx, dz) {
    if (!this.canAuto(p) || !this.c.rogue) return false;
    const src = { position: new THREE.Vector3(a.x - dx * 3, 0, a.z - dz * 3), alive: false, data: {} };
    return this.c.rogue.tryParry(p, src, { shot: true, proj: a, auto: p.rapChainT > 0 && W(p).rChain ? 'chain' : 'guard' });
  }

  // Rebater: a flecha/magia aparada volta para quem atirou (com 50% a mais de dano).
  deflect(a, p) {
    a.hits = 'reflected';
    a.by = p;
    a.damage = Math.round(a.damage * 1.5);
    a.bounces = 0;
    a.hitSet = new Set();
    a.homing = 0;
    const c = this.c, o = a.owner;
    a.target = o && o.targetable && c.enemies.includes(o) ? o : null;
    const sp = Math.max(a.speed || Math.hypot(a.vx, a.vz), 14) * 1.4;
    const ang = a.target ? Math.atan2(a.target.position.x - a.x, a.target.position.z - a.z) : Math.atan2(-a.vx, -a.vz);
    a.vx = Math.sin(ang) * sp; a.vz = Math.cos(ang) * sp;
    a.g.rotation.y = ang;
    a.life = 3; a.age = 0;
    a.x = p.position.x + Math.sin(ang) * (p.hero.radius + a.r + 0.2); a.z = p.position.z + Math.cos(ang) * (p.hero.radius + a.r + 0.2);
    c.vfx.sparks(v3(a.x, 1.3, a.z), GOLD, 14);
    c.text.add('Rebateu!', p.position, 'crit', 3.0);
    this.log({ type: 'rapDeflect', owner: o });
  }

  // Aparou (rogue.js, tryParry). e = quem atacou (projétil: e.alive = false), opts.proj = o projétil.
  onParry(p, e, opts) {
    if (!isRap(p)) return;
    const w = W(p), c = this.c, auto = opts.auto;
    const melee = !!(e && e.alive && e.targetable && !opts.shot && e.data);
    if (auto === 'guard') { p.rapGuard = false; p.rapStill = 0; c.text.add('En Garde!', p.position, 'crit', 3.8); this.log({ type: 'rapGuardParry' }); }
    if (auto === 'chain') { c.text.add('Em cadeia!', p.position, 'crit', 3.8); this.log({ type: 'rapChainParry' }); }
    if (w.rChain && !auto) p.rapChainT = RAP.chain.t;
    p.rapParryOk = true;
    p.rapParryN = (p.rapParryN || 0) + 1;
    if (w.rWaltz) p.rapWaltzArmed = true;
    if (w.rSlow) {
      this.slowT = RAP.slow.t; slowOverlay(true);
      c.text.add('Câmera Lenta!', p.position, 'crit', 4.2);
      this.log({ type: 'rapSlow' });
    }
    if (w.rDisarm && melee && !e.data.boss && !e.rogueDisarmed && c.rogue2) {
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
      c.rogue2.disarm(e, dx / d, dz / d);
      this.log({ type: 'rapDisarm', enemy: e });
    }
    if (w.rSing) this.sing(p);
    if (w.rDagger && melee) this.later.push({ t: RAP.dagger.delay, fn: () => this.daggerCut(p, e) });
    if (w.rGhost) this.spawnGhost(p, melee ? e : null);
    if (w.rApplause) {
      const at = v3(p.position.x + (Math.random() - 0.5) * 0.8, 0, p.position.z + (Math.random() - 0.5) * 0.8);
      if (c.onCoin) c.onCoin(at, RAP.coin); else p.gold = (p.gold || 0) + RAP.coin;
      c.text.add('Bravo!', p.position, 'gold', 3.0);
      audio.play('gold', at.x, at.z, { v: 0.6 });
      this.log({ type: 'rapApplause' });
    }
    if (w.rMusket && p.rapParryN % RAP.musket.every === 0) this.later.push({ t: 0.12, fn: () => this.shoot(p) });
  }

  // Lâmina Cantante: onda que atordoa os inimigos perto.
  sing(p) {
    const c = this.c, S = RAP.sing;
    const at = v3(p.position.x, 0.2, p.position.z);
    c.vfx.ring(at, GOLD, S.r);
    this.later.push({ t: 0.08, fn: () => c.vfx.ring(at, 0xfff6d0, S.r * 0.75) });
    this.later.push({ t: 0.16, fn: () => c.vfx.ring(at, GOLD, S.r * 0.5) });
    // a lâmina vibra: brilho na ponta
    if (p.weapon) {
      const s = glowSprite(0xfff2b0, 0.9, 0.9);
      s.position.y = 1.2;
      p.weapon.add(s);
      c.vfx.items.push({ obj: s, life: 0.45, age: 0, tick: (o, k) => { o.material.opacity = 0.9 * (1 - k); o.scale.setScalar(0.9 + 0.5 * Math.sin(k * 40)); if (k >= 1) o.removeFromParent(); } });
    }
    let n = 0;
    for (const e of this.foes(p.position.x, p.position.z, S.r)) if (this.stun(e, S.t)) { n++; c.text.add('Atordoado!', e.position, 'hurt', 2.8); }
    audio.play('bladeSing', p.position.x, p.position.z);
    this.log({ type: 'rapSing', n });
  }

  // Punhal de Canhota: corte rápido de punhal no atacante.
  daggerCut(p, e) {
    const c = this.c;
    if (!e || !e.targetable || p.state === 'dead') return;
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
    const s = streak2(0xd8f0ff, 0.95);
    s.position.set(p.position.x + dx / d * 0.4, 1.15, p.position.z + dz / d * 0.4);
    s.rotation.y = Math.atan2(dx, dz) + 0.5;
    s.scale.set(0.12, 0.12, Math.min(2.2, d + 0.4));
    c.vfx.add(s, 0.18, (o, k) => { for (const m of o.userData.mats) m.opacity = 0.95 * (1 - k); });
    c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), 0xd8f0ff, 8);
    c.bonusDamage(e, this.dmg(p, RAP.dagger.dmg), dx / d, dz / d, 'dmg', p);
    audio.play('hit', e.position.x, e.position.z, { v: 0.6 });
    this.log({ type: 'rapDagger', enemy: e });
  }

  // Espadachim Fantasma: aparece perto de outro inimigo e dá um contra-golpe.
  spawnGhost(p, attacker) {
    const c = this.c, G = RAP.ghost;
    const t = this.nearest(p.position.x, p.position.z, G.r, attacker) || (attacker && attacker.targetable ? attacker : null);
    if (!t) return;
    const f = ghostFencer(p.hero);
    // fica do lado do inimigo que está virado para o Ladino (perto, a 1,4)
    const a = Math.atan2(p.position.x - t.position.x, p.position.z - t.position.z) + (Math.random() < 0.5 ? 0.9 : -0.9);
    const R = t.data.radius + 1.1;
    let x = t.position.x + Math.sin(a) * R, z = t.position.z + Math.cos(a) * R;
    if (c.world && c.world.blocked(x, z, 0.4)) { x = t.position.x + (p.position.x - t.position.x) * 0.5; z = t.position.z + (p.position.z - t.position.z) * 0.5; }
    f.g.position.set(x, 0, z);
    f.g.rotation.y = Math.atan2(t.position.x - x, t.position.z - z);
    this.scene.add(f.g);
    f.anim.play(STAB, { once: true, restart: true, speed: 1.1, fade: 0 });
    c.vfx.smoke(v3(x, 0.6, z), BLUE, 10);
    this.ghosts.push({ ...f, e: t, by: p, age: 0, hit: false });
    c.text.add('Espadachim Fantasma!', p.position, 'crit', 3.6);
    this.log({ type: 'rapGhost', enemy: t });
  }

  // Mosqueteiro: tiro de pistola no inimigo mais perto.
  shoot(p) {
    const c = this.c, M = RAP.musket;
    if (p.state === 'dead') return;
    const t = this.nearest(p.position.x, p.position.z, M.range);
    // pistola na mão esquerda por um instante
    let gun = this.pistols.get(p);
    if (!gun && p.model) {
      const bone = p.model.getObjectByName('handslotl');
      if (bone) { gun = { g: pistol(), t: 0 }; gun.g.rotation.x = -Math.PI / 2; bone.add(gun.g); this.pistols.set(p, gun); }
    }
    if (gun) gun.t = M.show;
    const a = t ? Math.atan2(t.position.x - p.position.x, t.position.z - p.position.z) : p.facing;
    const mx = p.position.x + Math.sin(a) * 0.9, mz = p.position.z + Math.cos(a) * 0.9;
    const fl = muzzleFlash(); fl.position.set(mx, 1.25, mz);
    c.vfx.add(fl, 0.14, (o, k) => { o.scale.setScalar(1 + k); o.children.forEach((s) => { s.material.opacity = 1 - k; }); });
    c.vfx.smoke(v3(mx, 1.2, mz), 0xb8b8b8, 8);
    audio.play('pistol', p.position.x, p.position.z);
    audio.play('boom', p.position.x, p.position.z, { v: 0.5 });
    c.shakeFor(p, 0.2);
    c.text.add('BANG!', p.position, 'crit', 4.0);
    if (!t) { this.log({ type: 'rapShot', hit: false }); return; }
    const dx = t.position.x - p.position.x, dz = t.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
    const tr = streak(0xffe6a0, 0.9);
    tr.position.set(mx, 1.25, mz); tr.rotation.y = a; tr.scale.set(0.07, 1, Math.max(0.5, d - 0.9));
    c.vfx.add(tr, 0.16, (o, k) => { o.material.opacity = 0.9 * (1 - k); });
    c.vfx.sparks(v3(t.position.x, 1.2, t.position.z), 0xffd070, 14);
    c.bonusDamage(t, this.dmg(p, M.dmg), dx / d, dz / d, 'dmg big', p);
    if (t.alive && t.offBalance && !t.data.boss) t.offBalance(dx / d, dz / d, 0.7, M.push);
    else if (t.alive && t.vel) t.vel.set(dx / d, 0, dz / d).multiplyScalar(M.push * 0.3);
    c.addHitstop(0.06);
    this.log({ type: 'rapShot', hit: true, enemy: t });
  }

  // ---------- Golpe da rapieira ----------
  // Chamado por wbDamage: multiplicador e crítico (Ponto Fraco).
  damage(p, e, step) {
    const W0 = this.weak;
    if (!isRap(p) || !W0 || W0.e !== e || !W(p).rWeak || step.rapExtra || !isStab(step)) return null;
    W0.hitNow = p.swingSeq;
    return { mul: RAP.weak.mul, forceCrit: true };
  }

  // Depois do dano (wbOnHit).
  onHit(p, e, step, r) {
    if (!isRap(p)) return;
    const w = W(p), c = this.c, { died, nx, nz } = r;
    // Precisão Cirúrgica (estocadas seguidas no mesmo inimigo, acertando ou no escudo)
    if (w.rSurgeon && isStab(step)) this.surgeon(p, e); // a Chuva de Estocadas também conta
    if (step.rapExtra) return;
    const first = p.rapSwing !== p.swingSeq;
    p.rapSwing = p.swingSeq;
    // Ponto Fraco acertado: golpe perfeito que atravessa e atordoa.
    if (this.weak && this.weak.e === e && this.weak.hitNow === p.swingSeq) this.weakHit(p, e, nx, nz, died);
    // Valsa: contra-golpe depois de aparar empurra mais longe a cada passo.
    if (w.rWaltz && p.parryCrit && first) {
      if (p.rapWaltzArmed) { p.rapWaltzArmed = false; p.rapWaltz = Math.min(RAP.waltz.max, (p.rapWaltz || 0) + 1); }
      if (p.rapWaltz > 0 && e.alive && e.vel) {
        e.vel.multiplyScalar(1 + RAP.waltz.add * p.rapWaltz);
        c.text.add(`Valsa ×${p.rapWaltz}`, p.position, 'crit', 3.0);
        this.log({ type: 'rapWaltz', n: p.rapWaltz });
      }
    }
    // Bravata: matou com o contra-golpe.
    if (w.rBravado && died && p.parryCrit && !p.rapBowDone) { p.rapBowDone = true; this.later.push({ t: 0.05, fn: () => this.bravado(p) }); }
    // Golpe Fantasma: ataque pelas costas = outra estocada meio segundo depois.
    if (w.rEcho && !died && e.alive && this.backstab(p, e)) this.addEcho(p, e, r.dmg);
    // Assinatura: o 3º golpe risca uma marca.
    if (w.rSign && step.heavy && !died && e.alive && !e.undead) this.sign(p, e);
  }
  backstab(p, e) {
    return Math.abs(wrap(Math.atan2(p.position.x - e.position.x, p.position.z - e.position.z) - e.facing)) > 110 * DEG;
  }

  // Golpe batido no escudo (combat.damageEnemy): Precisão Cirúrgica também conta.
  onBlocked(p, e, step) {
    if (!has(p, 'rSurgeon') || !isStab(step)) return;
    this.surgeon(p, e);
  }
  surgeon(p, e) {
    if (p.rapSurgSeq === p.swingSeq) return; // 1 por golpe (a chuva conta cada estocada: cada uma é um golpe)
    p.rapSurgSeq = p.swingSeq;
    const S = p.rapSurg && p.rapSurg.e === e ? p.rapSurg : (p.rapSurg = { e, n: 0 });
    S.n++;
    if (S.n < RAP.surgeon.need || e.rapPierced) return;
    S.n = 0;
    e.rapPierced = true;
    const c = this.c;
    c.text.add('Armadura furada!', e.position, 'crit', 3.6);
    c.vfx.sparks(v3(e.position.x, 1.3, e.position.z), 0xcfe4ff, 16);
    if (e.shieldMesh) e.shieldMesh.traverse((o) => { if (o.isMesh && o.material && !o.userData.rapDull) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.45); o.userData.rapDull = true; } });
    audio.play('block', e.position.x, e.position.z, { v: 1.2 });
    this.log({ type: 'rapPierce', enemy: e });
  }

  // Depois do golpe (combat.playerStrike): Valsa recomeça se o golpe errou.
  afterStrike(p, step, hits) {
    if (!isRap(p) || step.rapExtra) return;
    if (!hits && p.rapWaltz > 0) { p.rapWaltz = 0; p.rapWaltzArmed = false; this.log({ type: 'rapWaltzReset', why: 'miss' }); }
    p.rapBowDone = false;
  }

  // Ponto Fraco acertado.
  weakHit(p, e, nx, nz, died) {
    const c = this.c, Wk = RAP.weak;
    this.dropWeak(true);
    c.text.add('PERFEITO!', e.position, 'crit', 4.4);
    c.vfx.sparks(v3(e.position.x, 1.3, e.position.z), 0xffffff, 22);
    c.addHitstop(0.08);
    c.shakeFor(p, 0.2);
    if (!died && e.alive) this.stun(e, Wk.stun);
    // atravessa: acerta os que estão atrás, na mesma linha
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    const s = streak2(0xfff2c0, 0.95);
    s.position.set(e.position.x, 1.2, e.position.z); s.rotation.y = p.facing; s.scale.set(0.1, 0.1, Wk.line);
    c.vfx.add(s, 0.25, (o, k) => { for (const m of o.userData.mats) m.opacity = 0.95 * (1 - k); });
    let n = 0;
    for (const o of this.foes(e.position.x, e.position.z, Wk.line + 1, e)) {
      const dx = o.position.x - e.position.x, dz = o.position.z - e.position.z;
      const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (along < 0 || along > Wk.line + o.data.radius || side > Wk.w + o.data.radius) continue;
      c.bonusDamage(o, this.dmg(p, 14), fx, fz, 'dmg', p);
      if (o.alive) this.stun(o, Wk.stun);
      n++;
    }
    audio.play('hitHeavy', e.position.x, e.position.z);
    this.log({ type: 'rapWeakHit', enemy: e, n });
  }

  // Golpe Fantasma: estocada que acerta de novo.
  addEcho(p, e, dmg) {
    const g = ghostRapier();
    const a = Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z);
    g.position.set(e.position.x - Math.sin(a) * 1.4, 1.2, e.position.z - Math.cos(a) * 1.4);
    g.rotation.y = a;
    this.scene.add(g);
    this.echoes.push({ g, e, by: p, t: 0, a, dmg: Math.max(1, Math.round((dmg || 6) * RAP.echo.mul)), done: false });
    this.log({ type: 'rapEcho', enemy: e });
  }

  // Assinatura: marca no inimigo; com 3, brilha e sangra muito.
  sign(p, e) {
    const c = this.c, S = RAP.sign;
    let m = this.signs.get(e);
    if (!m) { const s = signMark(); this.scene.add(s); m = { s, n: 0, lit: 0, by: p, bleed: 0, tick: 0 }; this.signs.set(e, m); }
    if (m.lit > 0) return; // já sangrando: as marcas voltam depois
    m.n++;
    setSign(m.s, m.n, false);
    c.vfx.sparks(v3(e.position.x, 1.9, e.position.z), GOLD, 8);
    c.text.add(m.n >= S.need ? 'Assinado!' : `Marca ${m.n}`, e.position, 'crit', 3.0);
    this.log({ type: 'rapSign', enemy: e, n: m.n });
    if (m.n >= S.need) {
      m.lit = S.t; m.bleed = S.dmg * ((p.stats && p.stats.damageMul) || 1); m.tick = 0; m.by = p;
      setSign(m.s, 3, true);
      c.text.add('Sangrando muito!', e.position, 'bleed', 3.4);
      audio.play('crunch', e.position.x, e.position.z, { v: 0.6 });
      this.log({ type: 'rapSignBleed', enemy: e });
    }
  }

  // Bravata: reverência e os inimigos em volta ficam atordoados de espanto.
  bravado(p) {
    const c = this.c, B = RAP.bravado;
    if (p.state === 'dead') return;
    let n = 0;
    for (const e of this.foes(p.position.x, p.position.z, B.r)) if (this.stun(e, B.t)) { n++; c.text.add('?!', e.position, 'miss', 3.0); }
    if (['idle', 'run', 'attack'].includes(p.state)) {
      p.setState('rapBow');
      p.combo = 0; p.queued = false; p.setGlow(0);
      p.iframes = Math.max(p.iframes || 0, B.bow);
      p.rapPose = 'bow';
      p.anim.play('Idle_A', { fade: 0.08, restart: true });
    }
    c.text.add('Bravata!', p.position, 'crit', 4.0);
    c.vfx.ring(v3(p.position.x, 0.2, p.position.z), GOLD, B.r);
    audio.play('warcry', p.position.x, p.position.z, { v: 0.5 });
    this.log({ type: 'rapBravado', n });
  }

  // ---------- Estocada Relâmpago ----------
  // ---------- Ripostar ----------
  startRiposte(p, camera) {
    const Rp = RAP.riposte, c = this.c;
    const a = p.aimAngle(camera);
    p.setState('rapRiposte');
    p.combo = 0; p.queued = false; p.setGlow(0.9); p.vel.set(0, 0, 0);
    p.facing = a; p.group.rotation.y = a;
    p.rapRipCd = Rp.cd;
    p.iframes = Math.max(p.iframes || 0, Rp.t + 0.05);
    p.anim.play(p.hero.anims.blockStart || 'Melee_Block', { once: true, restart: true, speed: 2.6, fade: 0.04 });
    const fx = glowSprite(0xfff0a0, 2.4, 0.0);
    fx.position.set(p.position.x + Math.sin(a) * 0.7, 1.3, p.position.z + Math.cos(a) * 0.7);
    this.scene.add(fx);
    p.rapRip = { t: 0, phase: 'guard', stored: 0, n: 0, a, fx };
    c.vfx.ring(v3(p.position.x, 0.1, p.position.z), GOLD, 1.6);
    audio.play('swing', p.position.x, p.position.z, { v: 0.8 });
    c.text.add('Ripostar!', p.position, 'crit', 3.2);
    this.log({ type: 'rapRiposte' });
    return true;
  }
  // Golpe (ou tiro) que chegou durante a guarda: negado e guardado para devolver. true = negou.
  riposteCatch(p, dmg, src) {
    const Rr = p && p.rapRip;
    if (!Rr || p.state !== 'rapRiposte' || Rr.phase !== 'guard') return false;
    Rr.stored += Math.max(0, Math.round(dmg || 0)); Rr.n++;
    const c = this.c, sx = src && src.position ? src.position.x : p.position.x + Math.sin(p.facing), sz = src && src.position ? src.position.z : p.position.z + Math.cos(p.facing);
    const dx = sx - p.position.x, dz = sz - p.position.z, d = Math.hypot(dx, dz) || 1;
    c.vfx.sparks(v3(p.position.x + dx / d * 0.7, 1.4, p.position.z + dz / d * 0.7), GOLD, 14);
    c.text.add('Negado!', p.position, 'block', 3.0);
    audio.play('shieldBlock', p.position.x, p.position.z, { v: 1.1 });
    c.addHitstop(0.05);
    this.log({ type: 'rapRipCatch', dmg, stored: Rr.stored });
    return true;
  }
  riposteTick(p, dt, camera) {
    const Rp = RAP.riposte, Rr = p.rapRip, c = this.c;
    if (!Rr) return 'end';
    Rr.t += dt;
    if (Rr.phase === 'guard') {
      // segura a pose de guarda e acompanha a mira
      if (p.anim.current && p.anim.progress() >= 0.6) p.anim.current.timeScale = 0;
      const a = p.aimAngle(camera); p.facing = a; p.group.rotation.y = a; Rr.a = a;
      Rr.fx.position.set(p.position.x + Math.sin(a) * 0.7, 1.3, p.position.z + Math.cos(a) * 0.7);
      Rr.fx.material.opacity = 0.35 + 0.25 * Math.sin(Rr.t * 30) + Math.min(0.3, Rr.n * 0.1);
      if (Rr.t >= Rp.t) this.riposteStrike(p);
      return null;
    }
    if (Rr.t >= Rp.strike) { p.setGlow(0); p.rapRip = null; return 'end'; }
    return null;
  }
  riposteStrike(p) {
    const Rp = RAP.riposte, Rr = p.rapRip, c = this.c;
    Rr.phase = 'strike'; Rr.t = 0;
    this.rm(Rr.fx); Rr.fx = null;
    const a = Rr.a, fx = Math.sin(a), fz = Math.cos(a);
    const len = (p.hero.attackRange || 3.4) * ((p.stats && p.stats.rangeMul) || 1) + Rp.extra;
    p.anim.play(STAB, { once: true, restart: true, speed: 2.2, fade: 0.04 });
    const s = streak2(GOLD, 0.8);
    s.position.set(p.position.x, 1.2, p.position.z); s.rotation.y = a; s.scale.set(0.5, 0.5, len);
    c.vfx.add(s, 0.3, (o, kk) => { for (const m of o.userData.mats) m.opacity = 0.8 * (1 - kk); });
    const step = { damage: this.dmg(p, Rp.base) + Rr.stored, rapExtra: true, heavy: true, stab: true, riposte: true };
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable || e.undead) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z;
      const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (along < -0.3 || along > len + e.data.radius || side > Rp.w + e.data.radius) continue;
      n++;
      const r = c.damageEnemy(p, e, step, fx, fz);
      c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), GOLD, 12);
      if (e.alive && r !== 'blocked') {
        if (Rr.n > 0) { if (this.stun(e, e.data.boss ? Rp.bossStun : Rp.stun)) c.text.add('Atordoado!', e.position, 'hurt', 2.8); }
        else e.slow = Math.max(e.slow || 0, Rp.slow);
      }
    }
    audio.play(n ? 'hitHeavy' : 'swingHeavy', p.position.x, p.position.z);
    if (n) { c.addHitstop(0.06); c.shakeFor(p, 0.18); }
    if (Rr.stored > 0) c.text.add(`Devolveu ${Rr.stored}!`, p.position, 'crit', 3.6);
    this.log({ type: 'rapRipStrike', n, stored: Rr.stored, caught: Rr.n, dmg: step.damage });
  }

  startFleche(p) {
    const F = RAP.fleche, c = this.c, wd = c.world;
    const d = (this._dir ||= new THREE.Vector3());
    if (p.ctl && p.ctl.moveDir) p.ctl.moveDir(d); else d.set(0, 0, 0);
    const a = d.lengthSq() > 0.01 ? Math.atan2(d.x, d.z) : p.facing;
    const dist = F.dist;
    const probe = (this._probe ||= new THREE.Vector3()).copy(p.position);
    const fx = Math.sin(a), fz = Math.cos(a), n = Math.max(1, Math.ceil(dist / 0.25));
    for (let i = 0; i < n; i++) { probe.x += fx * dist / n; probe.z += fz * dist / n; if (wd) { wd.resolveCircle(probe, p.hero.radius); wd.clampInside(probe, p.hero.radius); } }
    p.setState('rapLunge');
    p.combo = 0; p.queued = false; p.setGlow(0.8); p.vel.set(0, 0, 0);
    p.facing = a; p.group.rotation.y = a;
    p.rapFlecheCd = F.cd;
    p.iframes = Math.max(p.iframes || 0, F.time + 0.08);
    p.rapAir = { t: 0, fx: p.position.x, fz: p.position.z, tx: probe.x, tz: probe.z, a, hit: new Set(), trail: 0 };
    p.anim.play(STAB, { once: true, restart: true, speed: 2.2, fade: 0.04 });
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.2 });
    c.text.add('Fleche!', p.position, 'crit', 3.4);
    this.log({ type: 'rapFleche' });
    return true;
  }
  flecheTick(p, dt, world) {
    const F = RAP.fleche, A = p.rapAir, c = this.c;
    if (!A) return 'end';
    A.t += dt;
    // segura o braço esticado
    if (p.anim.currentName === STAB && p.anim.progress() >= F.pose && p.anim.current) p.anim.current.timeScale = 0;
    const k = Math.min(1, A.t / F.time);
    const ox = p.position.x, oz = p.position.z;
    p.position.x = A.fx + (A.tx - A.fx) * k; p.position.z = A.fz + (A.tz - A.fz) * k;
    // rastro dourado
    A.trail -= dt;
    if (A.trail <= 0) {
      A.trail = 0.03;
      const s = streak2(GOLD, 0.6);
      const len = Math.max(0.2, Math.hypot(p.position.x - A.fx, p.position.z - A.fz));
      s.position.set(A.fx, 1.1, A.fz); s.rotation.y = A.a; s.scale.set(0.35, 0.35, len);
      c.vfx.add(s, 0.22, (o, kk) => { for (const m of o.userData.mats) m.opacity = 0.6 * (1 - kk); });
    }
    // acerta todos no caminho (cada um uma vez)
    const fx = Math.sin(A.a), fz = Math.cos(A.a);
    for (const e of c.enemies) {
      if (!e.targetable || A.hit.has(e)) continue;
      const dx = e.position.x - A.fx, dz = e.position.z - A.fz;
      const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      const done = Math.hypot(p.position.x - A.fx, p.position.z - A.fz) + 0.9;
      if (along < -0.3 || along > done || side > F.w + e.data.radius) continue;
      A.hit.add(e);
      c.damageEnemy(p, e, FLECHE_STEP, fx, fz);
      c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), GOLD, 10);
      c.addHitstop(0.03);
    }
    if (k >= 1) {
      if (p.anim.current) p.anim.current.timeScale = 1.6;
      p.setGlow(0);
      p.rapAir = null;
      if (A.hit.size) audio.play('hitHeavy', p.position.x, p.position.z);
      this.log({ type: 'rapFlecheEnd', n: A.hit.size, d: Math.hypot(p.position.x - A.fx, p.position.z - A.fz) });
      return 'end';
    }
    void ox; void oz; void world;
    return null;
  }

  // ---------- Chuva de Estocadas ----------
  flurryTick(p, dt, input, camera) {
    const F = RAP.flurry, H = p.rapFlurry, c = this.c;
    if (!H) return 'end';
    H.t += dt; H.next -= dt; H.anim -= dt;
    const held = input && input.attackHeld && input.attackHeld();
    if (!held || H.t >= F.max) { p.rapFlurry = null; return 'end'; }
    if (camera !== undefined && p.aimAngle) { const aim = p.aimAngle(camera); p.facing += wrap(aim - p.facing) * Math.min(1, dt * 8); }
    if (H.anim <= 0) { H.anim = F.anim; p.anim.play(STAB, { once: true, restart: true, speed: 3.4, fade: 0.03 }); }
    if (H.next <= 0) {
      H.next = F.every / (p.atkSpeed || 1);
      p.swingSeq = (p.swingSeq || 0) + 1;
      const range = p.hero.attackRange * (p.stats.rangeMul || 1), arc = F.arc * DEG, fx = Math.sin(p.facing), fz = Math.cos(p.facing);
      // estocada rápida: risco fino na frente (um pouco para cada lado)
      const off = (Math.random() - 0.5) * 0.5, ox = Math.cos(p.facing) * off, oz = -Math.sin(p.facing) * off;
      const s = streak(0xfff2c0, 0.85);
      s.position.set(p.position.x + fx * 0.6 + ox, 1.1 + (Math.random() - 0.5) * 0.4, p.position.z + fz * 0.6 + oz);
      s.rotation.y = p.facing; s.scale.set(0.05, 1, range - 0.4);
      c.vfx.add(s, 0.1, (o, k) => { o.material.opacity = 0.85 * (1 - k); });
      // alvo: o mais perto na frente (+ Duelista)
      const cand = [];
      for (const e of c.enemies) {
        if (!e.targetable) continue;
        const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.001;
        if (d <= range + e.data.radius && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) <= arc) cand.push([d, e, dx / d, dz / d]);
      }
      cand.sort((u, v) => u[0] - v[0]);
      for (const [, e, nx, nz] of cand.slice(0, 1 + (W(p).pierceMelee || 0))) {
        c.damageEnemy(p, e, FLURRY_STEP, nx, nz);
        if (e.alive && e.vel) e.vel.multiplyScalar(0.35); // quase não empurra (continua na frente)
      }
      audio.play('swing', p.position.x, p.position.z, { v: 0.5 });
      this.log({ type: 'rapFlurryStab', n: Math.min(cand.length, 1 + (W(p).pierceMelee || 0)) });
    }
    return null;
  }

  // ---------- Capa do Toureiro (abilities.js) ----------
  capeOf(e) {
    const t = e && e.target;
    return t && t.hero && has(t, 'rCape') && t.state !== 'dead' ? t : null;
  }
  // Investida que errou o Ladino: continua até a parede. Devolve true para seguir correndo.
  capeCharge(e, missed) {
    if (!this.capeOf(e)) return false;
    if (missed && !e.rapCape) { e.rapCape = true; e.chargeLeft = Math.max(e.chargeLeft, RAP.cape.extra); this.c.text.add('Olé!', e.target.position, 'crit', 3.4); this.log({ type: 'rapOle', enemy: e, z: +e.position.z.toFixed(1), left: e.chargeLeft }); }
    return !!e.rapCape;
  }
  // Fim da investida: se passou direto, bate na parede atordoado. true = tratou.
  capeCrash(e, wall) {
    if (!e.rapCape) return false;
    e.rapCape = false;
    if (!wall) return false;
    this.crash(e);
    return true;
  }
  crash(e) {
    const c = this.c, C = RAP.cape;
    e.releaseToken && e.releaseToken();
    e.setState('hurt');
    e.stunTime = e.data.boss ? C.bossStun : C.stun;
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.7 });
    if (e.cd && e.data.charge) e.cd.charge = Math.max(e.cd.charge || 0, 3);
    c.vfx.dust(e.position, v3(0, 0, 0), 10);
    c.vfx.sparks(v3(e.position.x, 1.6, e.position.z), 0xffffff, 10);
    c.cam.shake(0.2);
    audio.play('thump', e.position.x, e.position.z);
    c.text.add('Bateu na parede!', e.position, 'hurt', 3.6);
    this.log({ type: 'rapCrash', enemy: e });
  }
  // Salto contra o Ladino: passa por cima dele e vai até a parede. Devolve o ponto de queda ou null.
  capeLeap(e, ctx) {
    e.rapCapeLeap = false;
    const h = this.capeOf(e);
    if (!h || e.data.boss) return null;
    const wd = this.c.world;
    let dx = h.position.x - e.position.x, dz = h.position.z - e.position.z;
    const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const r = e.data.radius + 0.1;
    let x = h.position.x, z = h.position.z, last = null;
    for (let s = 0.5; s <= 18; s += 0.5) {
      const nx = h.position.x + dx * s, nz = h.position.z + dz * s;
      if (wd && (wd.blocked(nx, nz, r) || (wd.bounds && (Math.abs(nx) > wd.bounds.x - r || Math.abs(nz) > wd.bounds.z - r)))) break;
      x = nx; z = nz; last = s;
    }
    if (last == null || last < 1) return null;
    e.rapCapeLeap = true;
    this.c.text.add('Olé!', h.position, 'crit', 3.4);
    this.log({ type: 'rapOleLeap', enemy: e });
    void ctx;
    return { x, z };
  }
  // Fim do salto passado: bate na parede. true = tratou.
  capeLand(e) {
    if (!e.rapCapeLeap) return false;
    e.rapCapeLeap = false;
    e.group.position.y = 0;
    this.crash(e);
    return true;
  }

  // ---------- A cada quadro ----------
  tick(dt) {
    const c = this.c;
    this.time += dt;
    if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) { this.slowT = 0; slowOverlay(false); this.log({ type: 'rapSlowEnd' }); } }
    for (let i = this.later.length - 1; i >= 0; i--) { const L = this.later[i]; L.t -= dt; if (L.t <= 0) { this.later.splice(i, 1); L.fn(); } }
    for (const p of c.players) {
      if (p.rapFlecheCd > 0) p.rapFlecheCd -= dt;
      if (p.rapRipCd > 0) p.rapRipCd -= dt;
      if (p.rapRip && p.state !== 'rapRiposte') { if (p.rapRip.fx) this.rm(p.rapRip.fx); p.rapRip = null; p.setGlow(0); }
      if (p.rapChainT > 0) p.rapChainT -= dt;
      if (p.rapStep && p.state !== 'dodge') p.rapStep = null;
      if (p.rapFlurry && p.state !== 'rapFlurry') p.rapFlurry = null;
      if (p.rapAir && p.state !== 'rapLunge') p.rapAir = null;
      if (p.rapPose && p.state !== 'rapBow') p.rapPose = null;
      if (p.rapPose) this.applyPose(p);
      if (!isRap(p)) { this.dropFor(p); continue; }
      const w = W(p);
      // correndo há quanto tempo (Estocada Relâmpago)
      p.rapRunT = p.state === 'run' ? (p.rapRunT || 0) + dt : 0;
      // Valsa: aparar que falhou ou dano tomado = recomeça
      if (p.state === 'parry') p.rapInParry = true;
      else if (p.rapInParry) { p.rapInParry = false; if (!p.rapParryOk && p.rapWaltz > 0) { p.rapWaltz = 0; p.rapWaltzArmed = false; this.log({ type: 'rapWaltzReset', why: 'parry' }); } p.rapParryOk = false; }
      if (p.rapHp != null && p.hp < p.rapHp && p.rapWaltz > 0) { p.rapWaltz = 0; p.rapWaltzArmed = false; this.log({ type: 'rapWaltzReset', why: 'hurt' }); }
      p.rapHp = p.hp;
      // En Garde: parado 1 s com a rapieira apontada
      if (w.rGuard && p.state === 'idle') {
        p.rapStill = (p.rapStill || 0) + dt;
        if (!p.rapGuard && p.rapStill >= RAP.guard.still) {
          p.rapGuard = true;
          p.anim.play(STAB, { once: true, restart: true, speed: 1.3, fade: 0.2 });
          c.text.add('En Garde', p.position, 'miss', 3.0);
          this.log({ type: 'rapGuard' });
        }
        if (p.rapGuard && p.anim.currentName === STAB && p.anim.current && p.anim.progress() >= 0.3) p.anim.current.timeScale = 0;
      } else { p.rapStill = 0; if (p.rapGuard) { p.rapGuard = false; if (p.anim.currentName === STAB && p.anim.current && p.anim.current.timeScale === 0) p.anim.current.timeScale = 1; } }
      this.guardGlow(p);
      // Punhal de Canhota: punhal na mão esquerda
      this.syncDagger(p, !!w.rDagger);
      // pistola some
      const gun = this.pistols.get(p);
      if (gun) { gun.t -= dt; if (gun.t <= 0) { this.rm(gun.g); this.pistols.delete(p); } }
    }
    this.tickGhosts(dt);
    this.tickEchoes(dt);
    this.tickSigns(dt);
    this.tickWeak(dt);
  }

  applyPose(p) {
    if (p.rapPose !== 'bow' || !p.model) return;
    const bones = p.rapBones || (p.rapBones = {});
    if (!bones.ready) { p.model.traverse((o) => { if (o.isBone && BOW_BONES.includes(o.name)) bones[o.name] = o; }); bones.ready = true; }
    const k = Math.min(1, p.stateTime / 0.15) * Math.min(1, Math.max(0, (RAP.bravado.bow - p.stateTime) / 0.15));
    for (const [name, eu] of Object.entries(BOW)) {
      const b = bones[name];
      if (!b) continue;
      const q = (this._q ||= new THREE.Quaternion()).setFromEuler((this._e ||= new THREE.Euler()).set(eu[0] * k, eu[1] * k, eu[2] * k));
      b.quaternion.multiply(q);
    }
    p.model.updateMatrixWorld(true);
  }

  guardGlow(p) {
    let s = this.guardFx.get(p);
    if (p.rapGuard && p.weapon) {
      if (!s) { s = glowSprite(0xfff0a0, 0.7, 0.8); s.position.y = 1.7; p.weapon.add(s); this.guardFx.set(p, s); }
      s.material.opacity = 0.55 + 0.35 * Math.sin(this.time * 9);
    } else if (s) { this.rm(s); this.guardFx.delete(p); }
  }

  syncDagger(p, want) {
    let d = this.daggers.get(p);
    if (d && (!want || d.model !== p.model)) { this.rm(d.g); this.daggers.delete(p); d = null; }
    if (want && !d && p.model) { const g = leftDagger(p.model); if (g) this.daggers.set(p, { g, model: p.model }); }
  }

  tickGhosts(dt) {
    const c = this.c, G = RAP.ghost;
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const f = this.ghosts[i];
      f.age += dt;
      f.anim.update(dt);
      const op = 0.6 * Math.min(1, f.age / 0.12, Math.max(0, G.life - f.age) / 0.3);
      for (const m of f.mats) m.opacity = op;
      if (!f.hit && f.age >= G.hit) {
        f.hit = true;
        const e = f.e;
        if (e && e.targetable) {
          const dx = e.position.x - f.g.position.x, dz = e.position.z - f.g.position.z, d = Math.hypot(dx, dz) || 1;
          c.bonusDamage(e, this.dmg(f.by, G.dmg), dx / d, dz / d, 'dmg big', f.by);
          if (e.alive) this.stun(e, 0.4);
          c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), BLUE, 12);
          c.text.add('Contra-golpe!', e.position, 'crit', 3.2);
          audio.play('hit', e.position.x, e.position.z);
          this.log({ type: 'rapGhostHit', enemy: e });
        }
      }
      if (f.age >= G.life) { c.vfx.smoke(v3(f.g.position.x, 0.6, f.g.position.z), BLUE, 6); this.scene.remove(f.g); f.mats.forEach((m) => m.dispose()); this.ghosts.splice(i, 1); }
    }
  }

  tickEchoes(dt) {
    const c = this.c, E = RAP.echo;
    for (let i = this.echoes.length - 1; i >= 0; i--) {
      const o = this.echoes[i];
      o.t += dt;
      const e = o.e;
      if (e && e.alive) {
        const a = o.done ? o.a : Math.atan2(e.position.x - (o.g.position.x), e.position.z - (o.g.position.z));
        o.a = a; o.g.rotation.y = a;
        const back = o.t < E.delay ? 1.4 - 0.3 * (o.t / E.delay) : 1.1 - Math.min(1, (o.t - E.delay) / 0.07) * 1.0;
        if (!o.done) { o.g.position.x = e.position.x - Math.sin(a) * back; o.g.position.z = e.position.z - Math.cos(a) * back; }
      }
      const fade = o.t < 0.1 ? o.t / 0.1 : o.done ? Math.max(0, 1 - (o.t - E.delay) / 0.25) : 1;
      for (const m of o.g.userData.mats) m.opacity = 0.8 * fade;
      o.g.userData.glow.material.opacity = 0.6 * fade;
      if (!o.done && o.t >= E.delay + 0.07) {
        o.done = true;
        if (e && e.targetable) {
          c.bonusDamage(e, o.dmg, Math.sin(o.a), Math.cos(o.a), 'dmg', o.by);
          c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), BLUE, 10);
          audio.play('hit', e.position.x, e.position.z, { v: 0.6 });
          this.log({ type: 'rapEchoHit', enemy: e, dmg: o.dmg });
        }
      }
      if (o.t >= E.delay + 0.35) { this.rm(o.g); this.echoes.splice(i, 1); }
    }
  }

  tickSigns(dt) {
    const c = this.c;
    for (const [e, m] of [...this.signs]) {
      if (!e.alive || !this.c.enemies.includes(e)) { this.rm(m.s); this.signs.delete(e); continue; }
      const sc = e.group.scale.x || 1;
      m.s.position.set(e.position.x, 1.35 * sc, e.position.z + 0.5 * sc); // riscos no peito, do lado da câmera
      if (m.lit > 0) {
        m.lit -= dt;
        m.s.material.opacity = 0.75 + 0.25 * Math.sin(this.time * 14);
        m.s.scale.set(1.35, 0.68, 1);
        m.tick -= dt;
        if (m.tick <= 0) {
          m.tick = 0.5;
          const n = Math.max(1, Math.round(m.bleed / (RAP.sign.t / 0.5)));
          if (!e.immune) {
            statDamage(e, n, e.hp);
            e.hp -= n; e.flash = Math.max(e.flash, 0.4);
            c.text.add(String(n), e.position, 'bleed', 2.0);
            c.vfx.sparks(v3(e.position.x, 1.0, e.position.z), 0xc8102e, 6);
            this.log({ type: 'rapSignTick', enemy: e, dmg: n });
            if (e.hp <= 0) { e.die(); c.killed(e, 0, 1, m.by); }
          }
        }
        if (m.lit <= 0) { m.lit = 0; m.n = 0; this.rm(m.s); this.signs.delete(e); }
      }
    }
  }

  tickWeak(dt) {
    const c = this.c, Wk = RAP.weak;
    const p = this.owner('rWeak');
    if (!p) { this.dropWeak(false); this.weakCd = Wk.every; return; }
    if (this.weak) {
      const o = this.weak;
      o.t -= dt;
      if (!o.e.alive || !o.e.targetable || o.t <= 0) { this.dropWeak(false); return; }
      const sc = o.e.group.scale.x || 1;
      o.g.position.set(o.e.position.x, 1.25 * sc, o.e.position.z);
      const k = 0.85 + 0.25 * Math.sin(this.time * 18);
      o.g.scale.setScalar(k);
      o.g.userData.cross.rotation.z += dt * 3;
      return;
    }
    this.weakCd -= dt;
    if (this.weakCd > 0) return;
    // inimigo mais perto (de preferência na frente do Ladino)
    let best = null, bs = Infinity;
    for (const e of this.foes(p.position.x, p.position.z, Wk.range)) {
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z;
      const s = Math.hypot(dx, dz) + Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) * 2;
      if (s < bs) { bs = s; best = e; }
    }
    if (!best) { this.weakCd = 0.5; return; }
    const g = weakPoint();
    this.scene.add(g);
    this.weak = { e: best, g, t: Wk.life, hitNow: -1 };
    c.vfx.sparks(v3(best.position.x, 1.3, best.position.z), 0xffffff, 6);
    audio.play('blessing', best.position.x, best.position.z, { v: 0.35 });
    this.log({ type: 'rapWeak', enemy: best });
  }
  dropWeak(hit) {
    if (!this.weak) return;
    this.rm(this.weak.g);
    this.weak = null;
    this.weakCd = RAP.weak.every - (hit ? 0 : 0);
  }

  // Tira o que é do herói (trocou de arma, morreu, partida nova).
  dropFor(p) {
    const d = this.daggers.get(p); if (d) { this.rm(d.g); this.daggers.delete(p); }
    const g = this.pistols.get(p); if (g) { this.rm(g.g); this.pistols.delete(p); }
    const s = this.guardFx.get(p); if (s) { this.rm(s); this.guardFx.delete(p); }
  }
  clear() {
    for (const f of this.ghosts) { this.scene.remove(f.g); f.mats.forEach((m) => m.dispose()); }
    for (const o of this.echoes) this.rm(o.g);
    for (const m of this.signs.values()) this.rm(m.s);
    this.ghosts.length = 0; this.echoes.length = 0; this.later.length = 0; this.signs.clear();
    this.dropWeak(false);
    this.weakCd = RAP.weak.every;
    if (this.slowT > 0) { this.slowT = 0; slowOverlay(false); }
  }
}

// Ponto Fraco (wbDamage em wbhooks.js): multiplicador e crítico garantido.
export function rapDamage(p, e, step) { return K ? K.damage(p, e, step) : null; }
