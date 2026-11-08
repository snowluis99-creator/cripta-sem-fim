// Bênçãos novas das Duas Adagas do Ladino (lista do dono, 07/11/2026): as regras. O visual está em rogueprops.js;
// os esqueletos perdidos/cegos, em roguestates.js. Sem import de combat.js: o combate cria o kit (combat.rogue2) e
// chama os ganchos; player.js chama rogueStartDodge / rogueReset.
import * as THREE from 'three';
import { audio } from './audio.js';
import { statDamage } from './runstats.js';
import { stuckDagger, flyingBlade, ghostDagger, strawDummy, flaskMesh, iconSprite, groundRing, cloud, glowSprite, dispose, KNIFE_MODEL, FLASK_COLORS } from './rogueprops.js';

export const DAG = {
  smoke: { r: 9, lost: 1.5, cd: 3, cloud: 2.4 },            // Bomba de Fumaça
  sub: { cd: 10, back: 3, time: 2, iframes: 0.6 },           // Substituição
  vanish: 1,                                                 // Sumir no Abate
  sand: 2,                                                   // Areia nos Olhos
  exec: { hp: 0.3, back: 110 },                              // Execução Silenciosa
  shadow: { range: 8, cone: 32 },                            // Passo das Sombras
  rollCut: 7,                                                // Cambalhota Cortante
  perfect: { early: 0.16, range: 4.5, dmg: 12, off: 0.9 },   // Esquiva Perfeita
  stuck: 3,                                                  // Adaga Cravada
  fan: { n: 8, speed: 17, life: 0.32, dmg: 5 },              // Leque de Facas
  orbit: { n: 2, r: 1.55, spin: 5, hitR: 0.7, dmg: 4, cd: 0.45 }, // Lâminas Voadoras
  pick: { chance: 0.12, gold: 3 },                           // Batedor de Carteira
  flask: { chance: 0.25, life: 14, pickR: 1.15, poison: 4, fire: 4, smokeR: 3 }, // Bolsos Fundos
  mark: { mul: 0.3, jump: 14 },                              // Marca da Morte
  first: 1,                                                  // Primeiro Sangue
  mercy: { hp: 0.25, r: 3.5, heal: 5 },                      // Golpe de Misericórdia
  poison: { t: 3, dps: 2, para: 5, paraT: 1, cloudR: 2.6, cloudT: 2 }, // Veneno Paralisante / Veneno de Cobra
};
const DEG = Math.PI / 180;
const GREEN = 0x7dff4a, SAND = 0xe8d49a, RED = 0xff3040;
const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const isDag = (p) => !!(p && p.heroId === 'rogue' && p.hero && p.hero.weaponId === 'adagas');
const has = (p, k) => isDag(p) && !!W(p)[k];
const ROLL_STEP = { damage: DAG.rollCut, rogueExtra: true };
const KNIFE_STEP = { damage: DAG.fan.dmg, rogueExtra: true };
const AUTO_STEP = { damage: DAG.perfect.dmg, rogueExtra: true };
let K = null;

// Rolamento: Bomba de Fumaça e Passo das Sombras (true = virou teleporte, sem rolar).
export function rogueStartDodge(p) {
  if (!K || !isDag(p)) return false;
  p.rogueDodgeId = (p.rogueDodgeId || 0) + 1;
  if (p.rogueRollHit) p.rogueRollHit.clear();
  if (has(p, 'dSmoke')) K.smokeBomb(p);
  return has(p, 'dShadow') ? K.shadowStep(p) : false;
}
// Troca de arma/herói, partida nova.
export function rogueReset(p) {
  p.vanishT = 0; p.rogueSubCd = 0; p.rogueSmokeCd = 0; p.rogueFlask = null;
  if (K) K.dropFor(p);
}

export class RogueKit2 {
  constructor(c) {
    this.c = c; K = this;
    this.scene = c.scene;
    this.decoys = []; this.flasks = []; this.flies = []; this.clouds = [];
    this.orbits = new Map(); this.skulls = new Map(); this.marks = new Map(); this.flaskFx = new Map();
  }
  log(o) { if (this.c.log) this.c.log(o); }
  dmg(p, n) { return Math.max(1, Math.round(n * ((p && p.stats && p.stats.damageMul) || 1))); }
  owner(k) { return this.c.players.find((p) => p.state !== 'dead' && has(p, k)) || null; }
  near(x, z, r, skip = null) {
    let best = null, bd = r;
    for (const e of this.c.enemies) {
      if (e === skip || !e.targetable || e.undead || (e.data && e.data.phantom)) continue;
      const d = Math.hypot(e.position.x - x, e.position.z - z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  rm(o) { if (o) { this.scene.remove(o); dispose(o); } }

  // ---------- Esqueletos: perdido (fumaça) e cego (areia) ----------
  canState(e) { return e.alive && !e.data.boss && !e.undead && !(e.frozenT > 0) && ['chase', 'attack', 'hurt', 'block', 'rogueLost', 'rogueBlind'].includes(e.state); }
  lose(e, t, from) {
    if (!this.canState(e)) return false;
    if (e.state === 'rogueBlind') return false;
    e.releaseToken();
    const away = from ? Math.atan2(e.position.x - from.x, e.position.z - from.z) : Math.random() * Math.PI * 2;
    e.rogueSt = { t, ang: away + (Math.random() - 0.5) * 2, turn: 0.4 };
    if (e.state !== 'rogueLost') { e.setState('rogueLost'); this.c.text.add('?', e.position, 'miss', 3.2); }
    return true;
  }
  blind(e, t) {
    e.blindT = Math.max(e.blindT || 0, t);
    this.c.vfx.sparks(v3(e.position.x, 1.9 * (e.group.scale.y || 1), e.position.z), SAND, 12);
    this.c.text.add('Cego!', e.position, 'miss', 3.3);
    this.log({ type: 'rogueBlind', enemy: e });
    if (!this.canState(e)) return;
    e.releaseToken();
    e.rogueSt = { t, ang: Math.random() * Math.PI * 2, turn: 0.3, swing: 0.35, swinging: 0 };
    e.setState('rogueBlind');
  }
  blindSwing(e) { this.log({ type: 'rogueBlindSwing', enemy: e }); audio.play('swing', e.position.x, e.position.z, { v: 0.5 }); }

  // ---------- Inimigo atacando o herói: cego erra, desarmado só empurra ----------
  foeMiss(e, p, opts) {
    const src = opts.shooter || e;
    if (!src || src.undead) return false;
    if (src.blindT > 0 && !opts.contact) {
      this.c.text.add('Errou!', p.position, 'miss');
      this.log({ type: 'rogueBlindMiss', enemy: src });
      return true;
    }
    if (src.rogueDisarmed && !opts.shooter) {
      if (opts.contact) return true;
      if (!p.invulnerable) {
        const dx = p.position.x - e.position.x, dz = p.position.z - e.position.z, d = Math.hypot(dx, dz) || 1;
        p.vel.set(dx / d, 0, dz / d).multiplyScalar(8);
        this.c.text.add('Empurrão', p.position, 'miss');
      }
      this.log({ type: 'rogueShove', enemy: e });
      return true;
    }
    return false;
  }

  // ---------- Bomba de Fumaça ----------
  smokeBomb(p) {
    const S = DAG.smoke;
    if (p.rogueSmokeCd > 0) return;
    p.rogueSmokeCd = S.cd;
    cloud(this.c.vfx, p.position.x, p.position.z, S.cloud, S.lost + 0.4, 0x8a8f9c);
    this.c.vfx.puff(p.position);
    audio.play('hiss', p.position.x, p.position.z, { v: 0.8 });
    let n = 0;
    for (const e of this.c.enemies) {
      const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
      if ((d <= S.r || e.target === p) && this.lose(e, S.lost, p.position)) n++;
    }
    this.log({ type: 'rogueSmoke', n });
  }

  // ---------- Passo das Sombras ----------
  shadowStep(p) {
    const S = DAG.shadow, c = this.c, wd = c.world;
    const dir = p.dodgeDir;
    if (p.ctl) p.ctl.moveDir(dir);
    if (dir.lengthSq() === 0) dir.set(Math.sin(p.facing), 0, Math.cos(p.facing)); else dir.normalize();
    const da = Math.atan2(dir.x, dir.z);
    let best = null, bd = S.range;
    for (const e of c.enemies) {
      if (!e.targetable || e.undead) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz);
      if (d > bd || Math.abs(wrap(Math.atan2(dx, dz) - da)) > S.cone * DEG) continue;
      bd = d; best = e;
    }
    if (!best) return false;
    const gap = best.data.radius + p.hero.radius + 0.25, r = p.hero.radius * 0.9;
    let spot = null;
    for (const off of [0, 0.6, -0.6, 1.2, -1.2]) { // atrás dele; se tiver parede, um pouco de lado
      const a = best.facing + Math.PI + off;
      const x = best.position.x + Math.sin(a) * gap, z = best.position.z + Math.cos(a) * gap;
      if (!wd || !wd.blocked(x, z, r)) { spot = { x, z }; break; }
    }
    if (!spot) return false;
    const x0 = p.position.x, z0 = p.position.z;
    c.vfx.smoke(v3(x0, 0.6, z0), 0x3a2a55, 10);
    p.position.x = spot.x; p.position.z = spot.z;
    if (wd) wd.resolveCircle(p.position, p.hero.radius);
    p.facing = Math.atan2(best.position.x - p.position.x, best.position.z - p.position.z); p.group.rotation.y = p.facing;
    c.vfx.smoke(v3(p.position.x, 0.6, p.position.z), 0x3a2a55, 10);
    p.iframes = Math.max(p.iframes || 0, 0.35);
    p.combo = 0; p.queued = false;
    p.setState('idle'); p.anim.play(p.hero.anims.idle, { fade: 0.1 });
    p.dodgeCooldown = p.hero.dodge.cooldown;
    audio.play('dodge', p.position.x, p.position.z);
    c.text.add('Nas costas!', p.position, 'crit', 3.2);
    this.log({ type: 'rogueShadow', enemy: best, d: Math.hypot(p.position.x - x0, p.position.z - z0) });
    return true;
  }

  // ---------- Esquiva Perfeita (combat.hitPlayer, golpe que pegou o Ladino rolando) ----------
  perfectDodge(p, e) {
    const P = DAG.perfect;
    if (!has(p, 'dPerfect') || p.state !== 'dodge' || p.stateTime > P.early || p.roguePerfectId === p.rogueDodgeId) return;
    if (!e || !e.alive || !e.targetable || e.undead) return;
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
    if (d > P.range + e.data.radius) return;
    p.roguePerfectId = p.rogueDodgeId;
    const c = this.c;
    c.vfx.sector(p.position, Math.atan2(dx, dz), d + 0.8, 0.3, 0xe8f4ff);
    c.text.add('Esquiva perfeita!', p.position, 'crit', 3.6);
    const r = c.damageEnemy(p, e, AUTO_STEP, dx / d, dz / d);
    if (e.alive && e.offBalance && e.offBalance(dx / d, dz / d, P.off, 3)) c.text.add('Exposto!', e.position, 'hurt', 3.2);
    c.addHitstop(0.07);
    audio.play('hit', e.position.x, e.position.z);
    this.log({ type: 'roguePerfect', enemy: e, r });
  }

  // ---------- Substituição (combat.hitPlayer, antes do dano) ----------
  substitute(p, e, opts) {
    const S = DAG.sub, c = this.c, wd = c.world;
    if (!has(p, 'dSub') || opts.contact || p.rogueSubCd > 0 || p.state === 'dead') return false;
    p.rogueSubCd = S.cd;
    const src = opts.shooter || e;
    let dx = p.position.x - src.position.x, dz = p.position.z - src.position.z, d = Math.hypot(dx, dz);
    if (d < 0.01) { dx = -Math.sin(p.facing); dz = -Math.cos(p.facing); d = 1; }
    dx /= d; dz /= d;
    const g = strawDummy();
    g.position.set(p.position.x, 0, p.position.z);
    g.rotation.y = p.facing;
    this.scene.add(g);
    const dec = { decoy: true, ally: true, alive: true, state: 'idle', t: S.time, g, position: g.position, radius: 0.5, hero: { radius: 0.5 }, facing: p.facing, navVel: { x: 0, z: 0 }, by: p, hits: 0, shake: 0 };
    dec.hit = (n) => {
      dec.hits++; dec.shake = 0.25;
      c.text.add(String(Math.max(1, Math.round(n))), dec.position, 'miss', 2.0);
      c.vfx.sparks(v3(dec.position.x, 1.4, dec.position.z), 0xe8c76a, 6);
      audio.play('thump', dec.position.x, dec.position.z, { v: 0.6 });
      this.log({ type: 'rogueDecoyHit' });
    };
    this.decoys.push(dec);
    c.vfx.smoke(v3(p.position.x, 0.8, p.position.z), 0xc8c8c8, 14);
    const x0 = p.position.x, z0 = p.position.z, r = p.hero.radius * 0.9;
    let x = x0, z = z0;
    for (let s = 0.25; s <= S.back + 1e-6; s += 0.25) {
      const nx = x0 + dx * s, nz = z0 + dz * s;
      if (wd && wd.blocked(nx, nz, r)) break;
      x = nx; z = nz;
    }
    p.position.x = x; p.position.z = z;
    if (wd) wd.resolveCircle(p.position, p.hero.radius);
    p.vel.set(0, 0, 0);
    p.iframes = Math.max(p.iframes || 0, S.iframes);
    if (p.state === 'attack' || p.state === 'hurt' || p.state === 'stagger') { p.combo = 0; p.queued = false; p.setState('idle'); p.anim.play(p.hero.anims.idle, { fade: 0.1 }); }
    c.vfx.smoke(v3(p.position.x, 0.8, p.position.z), 0x8a8f9c, 8);
    audio.play('dodge', p.position.x, p.position.z, { v: 1.2 });
    c.text.add('Substituição!', dec.position, 'crit', 3.4);
    // Quem estava atrás do Ladino passa a mirar o boneco já.
    for (const o of c.enemies) if (o.alive && !o.data.boss && o.target === p) o.target = dec;
    this.log({ type: 'rogueSub', back: Math.hypot(x - x0, z - z0) });
    return true;
  }
  decoyFor(e) {
    if (!this.decoys.length || e.data.boss) return null;
    return this.decoys.find((d) => d.alive) || null;
  }
  // Golpe de esqueleto: se ele mira o boneco e o boneco está no alcance, acerta o boneco.
  decoyStrike(e, inReach, dmg) {
    const t = e.target;
    if (t && t.decoy && t.alive && inReach(t.position, t.radius)) t.hit(dmg);
  }

  // ---------- Golpe do Ladino ----------
  // Antes do dano (combat.damageEnemy): Execução Silenciosa.
  beforeHit(p, e, step, nx, nz, opts) {
    if (!has(p, 'dExec') || opts.ranged || step.rogueExtra || e.data.boss || !e.alive || e.hp >= e.maxHp * DAG.exec.hp) return false;
    const a = Math.atan2(p.position.x - e.position.x, p.position.z - e.position.z);
    if (Math.abs(wrap(a - e.facing)) <= DAG.exec.back * DEG) return false;
    return this.execute(p, e, nx, nz, 'Execução!', 'rogueExec');
  }
  execute(p, e, nx, nz, label, type) {
    const c = this.c;
    e.lastHitBy = p;
    const n = Math.max(1, Math.ceil(e.hp));
    const died = e.takeDamage(n, nx, nz, 6, true);
    c.text.add(`${n}!`, e.position, 'dmg big');
    c.text.add(label, e.position, 'crit', 3.8);
    c.vfx.sparks(v3(e.position.x, 1.3, e.position.z), RED, 18);
    c.vfx.sector(p.position, Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z), 2.4, 0.35, 0xff5060);
    c.addHitstop(0.12);
    c.shakeFor(p, 0.25);
    audio.play('hitHeavy', e.position.x, e.position.z);
    this.log({ type, enemy: e, died });
    if (died) c.killed(e, nx, nz, p);
    return died ? 'kill' : 'hit';
  }

  // No momento do golpe (antes de procurar quem acertou): Leque de Facas e Golpe de Misericórdia.
  onSwing(p, step) {
    if (!isDag(p) || !step.heavy) return;
    const w = W(p);
    if (w.dMercy) {
      let best = null, bd = DAG.mercy.r;
      for (const e of this.skulls.keys()) {
        const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) - e.data.radius;
        if (e.targetable && d < bd) { bd = d; best = e; }
      }
      if (best) {
        const dx = best.position.x - p.position.x, dz = best.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
        this.execute(p, best, dx / d, dz / d, 'Misericórdia!', 'rogueMercy');
        const got = p.heal ? p.heal(DAG.mercy.heal) : 0;
        if (got) this.c.text.add(`+${got}`, p.position, 'heal small');
      }
    }
    if (w.dFan) {
      const F = DAG.fan;
      for (let i = 0; i < F.n; i++) {
        const a = p.facing + (i / F.n) * Math.PI * 2;
        const g = flyingBlade(KNIFE_MODEL, 0.7, 0xdfe8ff);
        g.position.set(p.position.x + Math.sin(a) * 0.5, 1.0, p.position.z + Math.cos(a) * 0.5);
        g.rotation.y = a;
        this.scene.add(g);
        this.flies.push({ kind: 'knife', g, p, vx: Math.sin(a) * F.speed, vz: Math.cos(a) * F.speed, life: F.life });
      }
      audio.play('swing', p.position.x, p.position.z, { v: 0.9 });
      this.log({ type: 'rogueFan' });
    }
  }

  // Depois do dano (wbOnHit): tudo que acontece num acerto das adagas.
  onHit(p, e, step, r) {
    if (!isDag(p)) return;
    const w = W(p), c = this.c, { died, nx, nz } = r;
    if (w.dPick && Math.random() < DAG.pick.chance) this.coin(p, e);
    if (p.rogueFlask) this.useFlask(p, e);
    const st = e.rogueStuck;
    if (st && st.by === p && st.ready && e.alive && !died) { // Adaga Cravada: cada golpe gira a adaga
      st.twist = 0.25;
      c.bonusDamage(e, this.dmg(p, DAG.stuck), nx, nz, 'bleed', p, true);
      this.log({ type: 'rogueTwist', enemy: e });
    }
    if (died || !e.alive) return;
    if (w.dFirst && !e.rogueTouched) {
      if (e.daze(e.data.boss ? 0.5 : DAG.first)) c.text.add('Primeiro sangue!', e.position, 'hurt', 3.3);
      this.log({ type: 'rogueFirst', enemy: e });
    }
    e.rogueTouched = true;
    if (step.heavy && !step.rogueExtra) {
      if (w.dSand) this.blind(e, DAG.sand);
      if (w.dDisarm) this.disarm(e, nx, nz);
      if (w.dStuck && !e.rogueStuck) this.stick(p, e);
      if (w.dMark) this.setMark(p, e);
    }
    if (w.dPara || w.dCobra) this.poison(e, p, DAG.poison.t);
    if (w.dPara) {
      e.rogueParaN = (e.rogueParaN || 0) + 1;
      if (e.rogueParaN >= DAG.poison.para) {
        e.rogueParaN = 0;
        if (e.daze(e.data.boss ? 0.4 : DAG.poison.paraT)) {
          c.text.add('Paralisado!', e.position, 'poison', 3.3);
          c.vfx.sparks(v3(e.position.x, 1.3, e.position.z), GREEN, 14);
        }
        this.log({ type: 'rogueParalyze', enemy: e });
      }
    }
  }

  coin(p, e) {
    const at = v3(e.position.x, 0, e.position.z);
    if (this.c.onCoin) this.c.onCoin(at, DAG.pick.gold);
    else p.gold = (p.gold || 0) + DAG.pick.gold;
    this.c.text.add('Moeda!', e.position, 'gold', 2.8);
    audio.play('gold', at.x, at.z, { v: 0.6 });
    this.log({ type: 'rogueCoin' });
  }

  disarm(e, nx, nz) {
    if (e.data.boss || e.rogueDisarmed || e.undead) return;
    const wpn = e.weapons.find((x) => x !== e.shieldMesh && !(e.data.shield && x === e.weapons[1]));
    e.rogueDisarmed = true;
    if (wpn) { e.weapons.splice(e.weapons.indexOf(wpn), 1); this.c.debris.drop(wpn, nx, nz); }
    this.c.text.add('Desarmado!', e.position, 'block', 3.4);
    audio.play('metal', e.position.x, e.position.z);
    this.log({ type: 'rogueDisarm', enemy: e });
  }

  stick(p, e) {
    const sc = e.group.scale.x || 1;
    const g = stuckDagger(sc);
    g.rotation.y = wrap(Math.atan2(p.position.x - e.position.x, p.position.z - e.position.z) - e.facing); // do lado de onde veio o golpe
    e.group.add(g);
    e.rogueStuck = { by: p, g, ready: false, twist: 0 };
    this.c.text.add('Cravada!', e.position, 'bleed', 3.2);
    this.log({ type: 'rogueStick', enemy: e });
  }

  setMark(p, e) {
    const old = this.marks.get(p);
    if (old && old.e === e) return;
    if (old) { old.e.rogueMarkBy = null; this.rm(old.ring); this.rm(old.icon); }
    e.rogueMarkBy = p;
    const ring = groundRing(RED, e.data.radius + 0.45), icon = iconSprite('◎', RED, 0.9);
    this.scene.add(ring, icon);
    this.marks.set(p, { e, ring, icon });
    this.c.text.add('Marcado!', e.position, 'hurt', 3.3);
    this.log({ type: 'rogueMark', enemy: e });
  }

  poison(e, p, t) {
    if (!e.alive || e.undead) return;
    if (!(e.poisonT > 0)) { e.poisonTick = 0.5; this.c.text.add('Envenenado!', e.position, 'poison', 3.0); }
    e.poisonT = Math.max(e.poisonT || 0, t);
    e.poisonDps = Math.max(e.poisonT > 0 ? e.poisonDps || 0 : 0, DAG.poison.dps * ((p.stats && p.stats.damageMul) || 1));
    e.poisonBy = p;
  }
  poisonDamage(e, n) {
    if (e.immune || !e.alive) return;
    statDamage(e, n, e.hp);
    e.hp -= n;
    e.flash = Math.max(e.flash, 0.3);
    this.c.text.add(String(n), e.position, 'poison', 2.0);
    this.c.vfx.sparks(v3(e.position.x, 1.0, e.position.z), GREEN, 4);
    this.log({ type: 'roguePoison', enemy: e, dmg: n });
    if (e.hp <= 0) { e.die(); this.c.killed(e, 0, 1, e.poisonBy); }
  }

  // ---------- Bolsos Fundos ----------
  useFlask(p, e) {
    const kind = p.rogueFlask, c = this.c, F = DAG.flask;
    p.rogueFlask = null;
    if (kind === 'poison') { this.poison(e, p, F.poison); c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), GREEN, 14); }
    if (kind === 'fire' && e.alive) { e.burn = Math.max(e.burn || 0, 3); e.burnDps = Math.max(e.burnDps || 0, F.fire * p.stats.damageMul); e.burnTick = 0.5; e.burnBy = p; c.vfx.flameCone(v3(e.position.x, 0.8, e.position.z), 0, 1.2, Math.PI, 0xff7a2a, false); c.text.add('Fogo!', e.position, 'burn', 3.2); }
    if (kind === 'smoke') {
      cloud(c.vfx, e.position.x, e.position.z, F.smokeR * 0.8, DAG.smoke.lost + 0.4, 0x8a8f9c);
      for (const o of c.enemies) if (Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) <= F.smokeR + o.data.radius) this.lose(o, DAG.smoke.lost, p.position);
    }
    audio.play(kind === 'fire' ? 'fireRoar' : 'hiss', e.position.x, e.position.z, { v: 0.6 });
    this.log({ type: 'rogueFlaskUse', kind });
  }

  // ---------- Inimigo destruído ----------
  onKill(e, by) {
    const c = this.c;
    if (e.rogueStuck) { // a adaga volta voando para o Ladino
      const st = e.rogueStuck; e.rogueStuck = null;
      st.g.removeFromParent(); dispose(st.g);
      if (st.by && st.by.state !== 'dead') {
        const g = flyingBlade(undefined, 1.1, 0xffe0a0);
        g.position.set(e.position.x, 1.3, e.position.z);
        this.scene.add(g);
        this.flies.push({ kind: 'back', g, p: st.by, t: 0, x0: e.position.x, z0: e.position.z });
        this.log({ type: 'rogueStuckBack' });
      }
    }
    // Marca da Morte: pula para o inimigo mais perto.
    const mb = e.rogueMarkBy;
    if (mb) {
      e.rogueMarkBy = null;
      const m = this.marks.get(mb);
      if (m) { this.rm(m.ring); this.rm(m.icon); this.marks.delete(mb); }
      const nx = has(mb, 'dMark') ? this.near(e.position.x, e.position.z, DAG.mark.jump, e) : null;
      if (nx) {
        c.vfx.bolt(v3(e.position.x, 1.6, e.position.z), v3(nx.position.x, 1.6, nx.position.z), 0xff3040);
        this.setMark(mb, nx);
        this.log({ type: 'rogueMarkJump', enemy: nx });
      }
    }
    // Veneno de Cobra: nuvem de veneno.
    if (e.poisonT > 0 && has(e.poisonBy, 'dCobra')) {
      const P = DAG.poison;
      cloud(c.vfx, e.position.x, e.position.z, P.cloudR * 0.8, P.cloudT, 0x5fc23a);
      this.clouds.push({ x: e.position.x, z: e.position.z, t: P.cloudT, tick: 0, by: e.poisonBy });
      audio.play('hiss', e.position.x, e.position.z, { v: 0.7 });
      this.log({ type: 'rogueCobra' });
    }
    e.poisonT = 0;
    if (!by || !isDag(by)) return;
    const w = W(by);
    if (w.dVanish && by.state !== 'dead') {
      by.vanishT = Math.max(by.vanishT || 0, DAG.vanish);
      c.vfx.smoke(v3(by.position.x, 0.8, by.position.z), 0x55596a, 8);
      c.text.add('Sumiu!', by.position, 'miss', 3.2);
      for (const o of c.enemies) if (o !== e && o.target === by) this.lose(o, DAG.vanish, by.position); // ninguém ataca ele
      this.log({ type: 'rogueVanish' });
    }
    if (w.dFlask && Math.random() < DAG.flask.chance) this.dropFlask(e.position.x, e.position.z);
  }
  dropFlask(x, z, kind = ['poison', 'smoke', 'fire'][Math.floor(Math.random() * 3)]) {
    const g = flaskMesh(kind);
    g.position.set(x, 0.1, z);
    this.scene.add(g);
    const f = { kind, g, x, z, t: DAG.flask.life, age: 0 };
    this.flasks.push(f);
    this.c.text.add('Frasco!', { x, z }, 'gold', 2.6);
    this.log({ type: 'rogueFlaskDrop', kind });
    return f;
  }

  // ---------- A cada quadro ----------
  tick(dt) {
    const c = this.c, T = performance.now() / 1000;
    this.time = (this.time || 0) + dt;
    for (const p of c.players) {
      if (p.vanishT > 0) p.vanishT -= dt;
      if (p.rogueSubCd > 0) p.rogueSubCd -= dt;
      if (p.rogueSmokeCd > 0) p.rogueSmokeCd -= dt;
      if (!isDag(p)) { this.dropFor(p); continue; }
      const w = W(p);
      // Cortar Flechas: o golpe inteiro corta projéteis em volta (não só o instante do impacto).
      if (w.dCut && p.state === 'attack') p.swipe = { t: 0.05, range: p.hero.attackRange * (p.stats.rangeMul || 1) + 1.6, arc: Math.PI + 0.1 }; // de qualquer lado
      if (w.dRollCut && p.state === 'dodge') this.rollCut(p);
      this.orbit(p, dt, !!w.dOrbit && p.state !== 'dead');
      // Frasco guardado: brilho da cor em cima da cabeça.
      let fx = this.flaskFx.get(p);
      if (p.rogueFlask && !fx) { fx = glowSprite(FLASK_COLORS[p.rogueFlask], 0.9, 0.85); this.scene.add(fx); this.flaskFx.set(p, fx); fx.userData.kind = p.rogueFlask; }
      if (fx && (!p.rogueFlask || fx.userData.kind !== p.rogueFlask)) { this.rm(fx); this.flaskFx.delete(p); }
      else if (fx) fx.position.set(p.position.x, 2.9 + 0.08 * Math.sin(T * 6), p.position.z);
    }
    // Boneco de palha.
    for (const d of [...this.decoys]) {
      d.t -= dt;
      if (d.shake > 0) { d.shake -= dt; d.g.rotation.z = Math.sin(d.shake * 60) * 0.12; } else d.g.rotation.z = 0;
      if (d.t > 0) continue;
      d.alive = false;
      c.vfx.smoke(v3(d.position.x, 1, d.position.z), 0xd9b45a, 12);
      c.vfx.puff(d.position);
      this.rm(d.g);
      this.decoys.splice(this.decoys.indexOf(d), 1);
      this.log({ type: 'rogueDecoyEnd', hits: d.hits });
    }
    // Frascos no chão.
    for (const f of [...this.flasks]) {
      f.t -= dt; f.age += dt;
      f.g.userData.inner.position.y = 0.15 + 0.12 * Math.sin(f.age * 4);
      f.g.userData.inner.rotation.y += dt * 1.5;
      const p = c.players.find((q) => isDag(q) && q.state !== 'dead' && has(q, 'dFlask') && Math.hypot(q.position.x - f.x, q.position.z - f.z) <= DAG.flask.pickR);
      if (p) {
        p.rogueFlask = f.kind;
        c.text.add({ poison: 'Frasco de veneno!', smoke: 'Frasco de fumaça!', fire: 'Frasco de fogo!' }[f.kind], p.position, 'gold', 3.2);
        audio.play('potion', f.x, f.z, { v: 0.7 });
        this.log({ type: 'rogueFlaskPick', kind: f.kind });
      }
      if (p || f.t <= 0) { this.rm(f.g); this.flasks.splice(this.flasks.indexOf(f), 1); }
    }
    this.tickFlies(dt);
    // Veneno nos inimigos e nuvens da Cobra.
    for (const e of [...c.enemies]) {
      if (e.blindT > 0) e.blindT -= dt;
      if (!(e.poisonT > 0) || !e.alive) continue;
      e.poisonT -= dt; e.poisonTick -= dt;
      if (Math.random() < dt * 5) c.vfx.sparks(v3(e.position.x, 1.5, e.position.z), GREEN, 1);
      if (e.poisonTick <= 0) { e.poisonTick = 0.5; this.poisonDamage(e, Math.max(1, Math.round(e.poisonDps * 0.5))); }
    }
    for (const z of [...this.clouds]) {
      z.t -= dt; z.tick -= dt;
      if (z.t <= 0) { this.clouds.splice(this.clouds.indexOf(z), 1); continue; }
      if (z.tick > 0) continue;
      z.tick = 0.25;
      for (const e of c.enemies) {
        if (!e.targetable || e.undead || e.poisonT > 0) continue;
        if (Math.hypot(e.position.x - z.x, e.position.z - z.z) > DAG.poison.cloudR + e.data.radius) continue;
        this.poison(e, z.by, DAG.poison.t);
        this.log({ type: 'rogueCobraHit', enemy: e });
      }
    }
    // Adagas cravadas: prontas para girar depois do golpe que as cravou.
    for (const e of c.enemies) {
      const st = e.rogueStuck;
      if (!st) continue;
      if (!e.alive && !e.finale) { this.onKill(e, null); continue; }
      st.ready = true;
      if (st.twist > 0) { st.twist -= dt; st.g.userData.blade.rotation.z += dt * 30; }
    }
    // Golpe de Misericórdia: caveira sobre quem está com pouca vida.
    const mercy = this.owner('dMercy');
    for (const e of c.enemies) {
      const low = mercy && e.alive && e.targetable && !e.data.boss && !e.undead && e.hp < e.maxHp * DAG.mercy.hp;
      let s = this.skulls.get(e);
      if (low && !s) { s = iconSprite('☠', 0xf0ece0, 0.95); this.scene.add(s); this.skulls.set(e, s); this.log({ type: 'rogueSkull', enemy: e }); }
      if (!low && s) { this.rm(s); this.skulls.delete(e); }
      else if (s) s.position.set(e.position.x, 2.75 * (e.group.scale.y || 1) + 0.1 * Math.sin(T * 5), e.position.z);
    }
    for (const [e, s] of this.skulls) if (!c.enemies.includes(e)) { this.rm(s); this.skulls.delete(e); }
    // Marca da Morte: acompanha o marcado.
    for (const [p, m] of this.marks) {
      if (!c.enemies.includes(m.e) || (!m.e.alive && !m.e.finale)) { if (m.e.alive === false && m.e.rogueMarkBy) this.onKill(m.e, null); else { this.rm(m.ring); this.rm(m.icon); this.marks.delete(p); } continue; }
      m.ring.position.set(m.e.position.x, 0.08, m.e.position.z); m.ring.rotation.y += dt * 2;
      m.icon.position.set(m.e.position.x, 3.0 * (m.e.group.scale.y || 1) + 0.1 * Math.sin(T * 4), m.e.position.z);
    }
  }

  // Cambalhota Cortante: corta quem o rolamento atravessar (cada inimigo uma vez por rolamento).
  rollCut(p) {
    const set = p.rogueRollHit || (p.rogueRollHit = new Set());
    for (const e of [...this.c.enemies]) {
      if (!e.targetable || e.undead || set.has(e)) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > e.data.radius + p.hero.radius + 0.35) continue;
      set.add(e);
      this.c.vfx.sparks(v3(e.position.x, 1.1, e.position.z), 0xffffff, 8);
      this.c.damageEnemy(p, e, ROLL_STEP, dx / d, dz / d);
      this.log({ type: 'rogueRollCut', enemy: e });
    }
  }

  // Lâminas Voadoras: duas adagas fantasmas girando em volta.
  orbit(p, dt, on) {
    let o = this.orbits.get(p);
    if (!on) { if (o) { o.g.forEach((g) => this.rm(g)); this.orbits.delete(p); } return; }
    const O = DAG.orbit;
    if (!o) { o = { ang: 0, g: [] }; for (let i = 0; i < O.n; i++) { const g = ghostDagger(); this.scene.add(g); o.g.push(g); } this.orbits.set(p, o); }
    o.ang += O.spin * dt;
    o.g.forEach((g, i) => {
      const a = o.ang + (i / O.n) * Math.PI * 2;
      const x = p.position.x + Math.sin(a) * O.r, z = p.position.z + Math.cos(a) * O.r;
      g.position.set(x, 1.15, z);
      g.rotation.y = a + Math.PI / 2;
      for (const e of [...this.c.enemies]) {
        if (!e.targetable || e.undead) continue;
        if ((e.rogueOrbCd || 0) > this.time) continue;
        if (Math.hypot(e.position.x - x, e.position.z - z) > O.hitR + e.data.radius) continue;
        e.rogueOrbCd = this.time + O.cd;
        const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
        this.c.vfx.sparks(v3(x, 1.15, z), 0x9fe8ff, 5);
        this.c.bonusDamage(e, this.dmg(p, O.dmg), dx / d, dz / d, 'dmg', p, true);
        this.log({ type: 'rogueOrbitHit', enemy: e });
      }
    });
  }

  tickFlies(dt) {
    const c = this.c;
    for (const f of [...this.flies]) {
      let done = false;
      if (f.kind === 'knife') {
        f.life -= dt;
        f.g.position.x += f.vx * dt; f.g.position.z += f.vz * dt;
        const x = f.g.position.x, z = f.g.position.z;
        if (f.life <= 0 || (c.world && c.world.blocked(x, z, 0.1))) done = true;
        else for (const e of [...c.enemies]) {
          if (!e.targetable || e.undead) continue;
          if (Math.hypot(e.position.x - x, e.position.z - z) > e.data.radius + 0.35) continue;
          const sp = Math.hypot(f.vx, f.vz) || 1;
          c.damageEnemy(f.p, e, KNIFE_STEP, f.vx / sp, f.vz / sp, { ranged: true });
          c.vfx.sparks(v3(x, 1.0, z), 0xffffff, 5);
          this.log({ type: 'rogueKnifeHit', enemy: e });
          done = true; break;
        }
      } else { // adaga voltando para a mão
        f.t += dt;
        const k = Math.min(1, f.t / 0.45), p = f.p;
        f.g.position.set(f.x0 + (p.position.x - f.x0) * k, 1.3 + Math.sin(k * Math.PI) * 1.2, f.z0 + (p.position.z - f.z0) * k);
        f.g.rotation.y = Math.atan2(p.position.x - f.x0, p.position.z - f.z0);
        if (k >= 1) { done = true; c.vfx.sparks(v3(p.position.x, 1.3, p.position.z), 0xffe0a0, 6); audio.play('block', p.position.x, p.position.z, { v: 0.4 }); }
      }
      if (done) { this.rm(f.g); this.flies.splice(this.flies.indexOf(f), 1); }
    }
  }

  // Tira o que é do herói (trocou de arma, morreu, partida nova).
  dropFor(p) {
    const o = this.orbits.get(p); if (o) { o.g.forEach((g) => this.rm(g)); this.orbits.delete(p); }
    const fx = this.flaskFx.get(p); if (fx) { this.rm(fx); this.flaskFx.delete(p); }
    const m = this.marks.get(p); if (m) { if (m.e) m.e.rogueMarkBy = null; this.rm(m.ring); this.rm(m.icon); this.marks.delete(p); }
  }
  clear() {
    for (const d of this.decoys) this.rm(d.g);
    for (const f of this.flasks) this.rm(f.g);
    for (const f of this.flies) this.rm(f.g);
    for (const s of this.skulls.values()) this.rm(s);
    for (const [, m] of this.marks) { this.rm(m.ring); this.rm(m.icon); }
    this.decoys.length = 0; this.flasks.length = 0; this.flies.length = 0; this.clouds.length = 0;
    this.skulls.clear(); this.marks.clear();
  }
}
