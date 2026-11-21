// Bênçãos RARAS, lote 2 (lista do dono, 11/11/2026): os efeitos.
// Dados e textos em r2bless.js (números em R2). combat.r2 = R2Kit. Partes do herói (Leveza, Gingado, Jab de Guarda,
// andar atacando, adagas arremessadas) ficam nas funções exportadas no fim.
import * as THREE from 'three';
import { audio } from './audio.js';
import { R2, lv } from './r2bless.js';
import { repairShield, shieldMax } from './shield.js';
import { stuckDagger, flyingBlade } from './rogueprops.js';
import { kcDodge } from './kckit.js';

const W = (p) => (p && p.stats && p.stats.w) || {};
const wpn = (p, hero, id) => !!(p && p.heroId === hero && p.hero && p.hero.weaponId === id);
const idxOf = (p, step) => (p && p.hero && step ? p.hero.combo.indexOf(step) : -1);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const DEG = Math.PI / 180;
const anyR2 = (w) => { for (const k in w) if (k.startsWith('r2')) return true; return false; };
export const r2S = (p) => p.r2s || (p.r2s = { eg: null, cl: null, roundUsed: false, roundT: 0, arCd: 0, jab: null, jabCd: 0, keep: null, side: 1, knives: [] });

// Passos próprios
const JAB = { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 2.4, hit: 0.3, end: 0.6, lunge: 0, damage: R2.jab.dmg, arc: R2.jab.arc, r2Jab: true };
const THROW = { clip: 'Throw', speed: 2.1, hit: 0.44, end: 0.68, window: 0.46, lunge: 0, damage: 7, r2Throw: true };
const PUNCH = [
  { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 2.2, hit: 0.36, end: 0.6, window: 0.4, lunge: 0.3, damage: R2.prof.punch, r2Punch: true },
  { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 2.5, hit: 0.36, end: 0.6, window: 0.4, lunge: 0.3, damage: R2.prof.punch, r2Punch: true },
];

let C = null; // o kit da partida (para as funções do herói)

export class R2Kit {
  constructor(c) {
    this.c = c; C = this;
    this.t = 0;
  }
  log(o) { if (this.c.log) this.c.log(o); }
  get players() { return this.c.players; }

  // ---------- Golpe trocado: Proficiência (arremesso da adaga) ----------
  strike(p, step) {
    if (!step || !step.r2Throw) return false;
    this.throwKnife(p);
    return true;
  }

  // ---------- Cada inimigo acertado por um golpe corpo a corpo ----------
  onHit(p, e, step, r) {
    const w = W(p);
    if (!anyR2(w)) return;
    if (wpn(p, 'rogue', 'rapieira')) {
      const i = idxOf(p, step);
      // Estocada de 3 Dedos: a 1ª estocada pode virar o inimigo de costas.
      if (w.r2Dedos && i === 0 && r === 'hit' && e.alive && Math.random() < lv(R2.dedos, w.r2Dedos)) {
        this.c.turnAway(p, e);
        this.c.text.add('3 Dedos!', p.position, 'crit', 3.0);
        this.log({ type: 'r2Dedos', enemy: e });
      }
      // En Garde: os 3 golpes do combo no mesmo inimigo.
      if (w.r2Garde && (r === 'hit' || r === 'blocked')) this.garde(p, e, i);
    }
    // Clinch: socos seguidos no mesmo inimigo.
    if (w.r2Clinch && wpn(p, 'knight', 'manopla') && r === 'hit' && e.alive && !e.data.boss && !e.undead) {
      const s = r2S(p), G = R2.clinch;
      if (s.cl && s.cl.e === e && this.t - s.cl.last <= G.gap) s.cl.last = this.t;
      else {
        s.cl = { e, start: this.t, last: this.t };
        this.c.text.add('Clinch!', e.position, 'crit', 3.0);
        this.log({ type: 'r2Clinch', enemy: e });
      }
    }
  }
  garde(p, e, i) {
    const s = r2S(p), G = R2.engarde;
    if (i === 0) { s.eg = { e, n: 1, t: this.t }; return; }
    if (!s.eg || s.eg.e !== e || s.eg.n !== i || this.t - s.eg.t > G.gap) return;
    s.eg.n = i + 1; s.eg.t = this.t;
    if (s.eg.n < 3) return;
    s.eg = null;
    if (!e.alive || e.data.boss || e.rogueDisarmed || e.undead || !this.c.rogue2) return;
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
    this.c.rogue2.disarm(e, dx / d, dz / d);
    this.c.text.add('En Garde!', p.position, 'crit', 3.8);
    this.c.vfx.sparks(v3(e.position.x, 1.3, e.position.z), 0xffe27a, 16);
    this.log({ type: 'r2Garde', enemy: e });
  }

  // ---------- Herói tomou dano: Segundo Round ----------
  onHurt(p) {
    const w = W(p);
    if (!w.r2Round || !wpn(p, 'knight', 'manopla') || p.state === 'dead' || p.hp <= 0 || p.hp >= p.maxHp * R2.round.below) return;
    const s = r2S(p);
    if (s.roundUsed) return;
    s.roundUsed = true;
    const c = this.c;
    p.iframes = Math.max(p.iframes || 0, R2.round.inv);
    s.roundT = R2.round.inv;
    const n = repairShield(p, shieldMax(p));
    c.vfx.ring(v3(p.position.x, 0.3, p.position.z), 0xffd36a, 5);
    c.vfx.burst(p.position, 0xffd36a);
    audio.play('warcry', p.position.x, p.position.z, { v: 0.9 });
    audio.play('shieldBlock', p.position.x, p.position.z, { v: 1.0 });
    c.text.add('Segundo Round!', p.position, 'crit', 3.8);
    this.log({ type: 'r2Round', shield: n });
  }

  // ---------- Barreira rebateu um tiro: Defesa Ardente ----------
  onReflect(p, a) {
    if (!W(p).r2Ardente || !wpn(p, 'mage', 'fogo')) return;
    a.r2Fire = true;
    this.c.vfx.sparks(v3(a.x, 1.3, a.z), 0xff7a2a, 12);
    // o tiro fica alaranjado
    if (a.g) a.g.traverse((o) => { if (o.material && o.material.color) { o.material = o.material.clone(); o.material.color.setHex(0xff7a2a); } });
    this.log({ type: 'r2ArdenteOn', kind: a.kind });
  }
  // O tiro rebatido acertou alguém.
  onReflectHit(a, e) {
    if (!a.r2Fire || !e.alive || !this.c.fire2) return;
    const p = a.by, A = R2.ardente;
    this.c.fire2.ignite(e, p, A.dps * (p && p.stats ? p.stats.damageMul : 1), A.t);
    this.c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), 0xff7a2a, 12);
    this.c.text.add('Queimando!', e.position, 'crit', 2.8);
    this.log({ type: 'r2ArdenteHit', enemy: e });
  }

  // Sala nova: Segundo Round volta; as adagas voltam para a mão.
  roomStart() {
    for (const p of this.players) {
      const s = r2S(p);
      s.roundUsed = false; s.eg = null; s.cl = null; s.keep = null;
      this.returnKnives(p);
    }
  }

  tick(dt) {
    this.t += dt;
    const c = this.c;
    for (const p of this.players) {
      const s = p.r2s, w = W(p);
      if (!s && !anyR2(w)) continue;
      const S = r2S(p);
      if (S.jabCd > 0) S.jabCd -= dt;
      if (S.keep && (S.keep.t -= dt) <= 0) S.keep = null;
      if (S.jab) this.jabTick(p, S, dt);
      if (S.cl) this.clinchTick(p, S);
      if (S.roundT > 0) { S.roundT -= dt; if (Math.random() < 0.4) c.vfx.sparks(v3(p.position.x, 1.0, p.position.z), 0xffd36a, 2); }
      if (w.r2Ar && wpn(p, 'mage', 'fogo') && p.state !== 'dead') this.hotAir(p, S, dt);
      if (S.knives.length) this.knivesTick(p, S, dt);
      this.handsVisible(p, S);
    }
  }

  // Ar Quente: derrete o 1º tiro que chegar perto (com recarga).
  hotAir(p, s, dt) {
    if (s.arCd > 0) { s.arCd -= dt; return; }
    const c = this.c, A = R2.ar;
    const L = c.projectiles.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const a = L[i];
      if (!a || a.hits !== 'player' || (a.stuck != null && a.stuck >= 0)) continue;
      if (Math.hypot(a.x - p.position.x, a.z - p.position.z) > A.r + (a.r || 0)) continue;
      const hot = c.enemies.filter((e) => e.alive && e.burn > 0).length;
      s.arCd = hot >= A.hot ? A.cdHot : A.cd;
      const at = v3(a.x, a.g ? a.g.position.y : 1.2, a.z);
      c.vfx.sparks(at, 0xff7a2a, 14);
      c.vfx.sparks(at, 0xffd080, 8);
      audio.play('hiss', a.x, a.z, { v: 0.6 });
      c.text.add('Derreteu!', { x: a.x, z: a.z }, 'crit', 2.6);
      c.projectiles.removeA(a);
      this.log({ type: 'r2Melt', kind: a.kind, hot, cd: s.arCd });
      return;
    }
  }

  // Clinch: o inimigo não ataca enquanto os socos continuam (até 2 s).
  clinchTick(p, s) {
    const cl = s.cl, e = cl.e, G = R2.clinch;
    if (!e.alive || this.t - cl.last > G.gap) { s.cl = null; return; }
    if (this.t - cl.start > G.max) return; // passou de 2 s: ele volta a atacar (até a sequência quebrar)
    if ((e.state === 'attack' || e.state === 'aim') && !e.hitDone) { e.endAttack(); this.log({ type: 'r2ClinchStop', enemy: e }); }
    e.cooldown = Math.max(e.cooldown || 0, 0.3);
    if (Math.random() < 0.15) this.c.vfx.sparks(v3(e.position.x, 1.6, e.position.z), 0xffd36a, 2);
  }

  // Jab de Guarda: o soco sai sem baixar o escudo.
  jabTick(p, s, dt) {
    const J = s.jab;
    J.t += dt;
    if (!J.done && J.t >= R2.jab.hit) {
      J.done = true;
      if (p.state === 'block') { this.c.playerStrike(p, JAB); this.log({ type: 'r2Jab' }); }
    }
    if (J.t >= R2.jab.cd) {
      s.jab = null;
      if (p.state === 'block') p.anim.play(p.hero.anims.blocking, { fade: 0.08 });
    }
  }

  // ---------- Proficiência: adagas arremessadas ----------
  throwKnife(p) {
    const s = r2S(p), c = this.c, P = R2.prof;
    const side = s.knives.some((k) => k.side === 'right') ? 'left' : 'right';
    if (s.knives.length >= 2) return;
    // mira: o inimigo mais perto da frente (até 25°)
    let a = p.facing, best = null, bd = Infinity;
    for (const e of c.enemies) {
      if (!e.targetable) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz);
      if (d > P.range || Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > 25 * DEG) continue;
      if (d < bd) { bd = d; best = e; }
    }
    if (best) a = Math.atan2(best.position.x - p.position.x, best.position.z - p.position.z);
    const g = flyingBlade(undefined, 1.1, 0xbfe6ff);
    g.rotation.y = a;
    const x = p.position.x + Math.sin(a) * 0.7, z = p.position.z + Math.cos(a) * 0.7;
    g.position.set(x, 1.2, z);
    c.scene.add(g);
    s.knives.push({ side, state: 'fly', g, x, z, dx: Math.sin(a), dz: Math.cos(a), dist: 0, e: null, sg: null });
    audio.play('swing', p.position.x, p.position.z, { v: 0.8 });
    this.log({ type: 'r2Throw', side, target: best });
  }
  knivesTick(p, s, dt) {
    const c = this.c, P = R2.prof;
    for (let i = s.knives.length - 1; i >= 0; i--) {
      const k = s.knives[i];
      if (k.state === 'fly') {
        const step = P.speed * dt;
        for (let j = 0; j < 3 && k.state === 'fly'; j++) {
          const nx = k.x + k.dx * step / 3, nz = k.z + k.dz * step / 3;
          if (c.world && c.world.blocked(nx, nz, 0.1)) { this.ground(k, k.x, k.z); break; }
          k.x = nx; k.z = nz; k.dist += step / 3;
          for (const e of [...c.enemies]) {
            if (!e.targetable) continue;
            if (Math.hypot(e.position.x - k.x, e.position.z - k.z) > e.data.radius + 0.3) continue;
            const base = (p.hero.combo[0] && p.hero.combo[0].damage) || 7;
            const r = c.damageEnemy(p, e, { ...THROW, damage: base, r2Knife: true }, k.dx, k.dz);
            c.vfx.sparks(v3(k.x, 1.2, k.z), 0xdfe8ff, 10);
            if (e.alive && r !== 'blocked') this.stickIn(k, e);
            else this.ground(k, k.x, k.z);
            this.log({ type: 'r2KnifeHit', enemy: e, r });
            break;
          }
          if (k.state === 'fly' && k.dist >= P.range) this.ground(k, k.x, k.z);
        }
        if (k.state === 'fly') k.g.position.set(k.x, 1.2, k.z);
      } else if (k.state === 'stuck') {
        const e = k.e;
        if (!e.alive || !c.enemies.includes(e)) { this.ground(k, e.position.x, e.position.z); continue; }
        if (p.state !== 'dead' && Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) <= P.pick + e.data.radius) this.pickUp(p, s, i, 'enemy');
      } else if (k.state === 'ground') {
        if (p.state !== 'dead' && Math.hypot(k.x - p.position.x, k.z - p.position.z) <= P.pick) this.pickUp(p, s, i, 'ground');
        else if (k.g) k.g.rotation.y += dt * 1.5;
      }
    }
  }
  stickIn(k, e) {
    k.state = 'stuck'; k.e = e;
    this.c.scene.remove(k.g); k.g = null;
    const sc = e.group.scale.x || 1;
    const g = stuckDagger(sc);
    g.rotation.y = wrap(Math.atan2(-k.dx, -k.dz) - e.facing) + (k.side === 'left' ? 0.5 : -0.5);
    e.group.add(g);
    k.sg = g;
    this.c.text.add('Cravada!', e.position, 'bleed', 3.0);
  }
  ground(k, x, z) {
    if (k.sg) { k.sg.removeFromParent(); k.sg = null; }
    if (!k.g) { k.g = flyingBlade(undefined, 1.1, 0xbfe6ff); this.c.scene.add(k.g); }
    k.state = 'ground'; k.e = null; k.x = x; k.z = z;
    k.g.position.set(x, 0.25, z);
    k.g.rotation.set(0, Math.random() * 6.28, 0);
    this.log({ type: 'r2KnifeGround' });
  }
  pickUp(p, s, i, from) {
    const k = s.knives[i];
    if (k.sg) k.sg.removeFromParent();
    if (k.g) this.c.scene.remove(k.g);
    s.knives.splice(i, 1);
    this.c.text.add('Adaga de volta', p.position, 'miss', 2.6);
    audio.play('metal', p.position.x, p.position.z, { v: 0.5 });
    this.log({ type: 'r2KnifeBack', from });
  }
  returnKnives(p) {
    const s = p.r2s;
    if (!s) return;
    for (const k of s.knives) { if (k.sg) k.sg.removeFromParent(); if (k.g) this.c.scene.remove(k.g); }
    s.knives = [];
    this.handsVisible(p, s);
  }
  handsVisible(p, s) {
    const out = (side) => s.knives.some((k) => k.side === side);
    const r = !out('right'), l = !out('left');
    if (p.weapon && p.weapon.visible !== r) p.weapon.visible = r;
    if (p.offhand && p.offhand.visible !== l) p.offhand.visible = l;
  }

  clear() {
    for (const p of this.players) {
      if (!p.r2s) continue;
      this.returnKnives(p);
      p.r2s.cl = null; p.r2s.jab = null; p.r2s.keep = null; p.r2s.eg = null;
    }
  }
}

// ================= Herói (player.js) =================
// Leveza (Rapieira): movimento e rolagem dobram.
export const r2MoveMul = (p) => (W(p).r2Leve && wpn(p, 'rogue', 'rapieira') ? R2.leveza.move : 1);
export const r2RollMul = (p) => (W(p).r2Leve && wpn(p, 'rogue', 'rapieira') ? R2.leveza.roll : 1);

// Conjuração Ágil (Cajado Arcano): anda atacando e atira logo depois de rolar.
export const r2CastMove = (p) => !!(W(p).r2Agil && wpn(p, 'mage', 'cajado'));
export const r2DodgeCancel = (p) => (r2CastMove(p) ? R2.agil.cancel : 0);

// Proficiência (Duas Adagas): sem ninguém no alcance arremessa; sem adagas, socos.
export function r2Override(p) {
  if (!W(p).r2Prof || !wpn(p, 'rogue', 'adagas') || !C) return null;
  const s = r2S(p);
  const hand = 2 - s.knives.length;
  const reach = p.hero.attackRange * (p.stats.rangeMul || 1) + 0.6;
  const near = C.c.enemies.some((e) => e.targetable && Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) <= reach + e.data.radius);
  if (!near && hand > 0) return THROW;
  if (hand > 0) return null;
  s.punchI = ((s.punchI || 0) + 1) % PUNCH.length;
  return PUNCH[s.punchI];
}

// Jab de Guarda (Manopla): atacar bloqueando (true = usou o clique).
export function r2JabPress(p) {
  if (!W(p).r2Jab || !wpn(p, 'knight', 'manopla') || !C) return false;
  const s = r2S(p);
  if (s.jab || s.jabCd > 0) return true; // ainda no soco anterior: ignora o clique, mas não baixa a guarda
  s.jab = { t: 0, done: false };
  s.jabCd = R2.jab.cd;
  p.anim.play(JAB.clip, { once: true, restart: true, fade: 0.04, speed: JAB.speed });
  audio.play('swing', p.position.x, p.position.z, { v: 0.7 });
  return true;
}

// Gingado (Manopla): rolar vira um passinho lateral que guarda o combo (true = começou).
export function r2StartDodge(p) {
  if (!W(p).r2Ging || !wpn(p, 'knight', 'manopla') || !C) return false;
  const s = r2S(p), G = R2.ging, len = p.hero.combo.length;
  let next = 0;
  if (p.state === 'attack' && !p.xstep) next = p.hitDone ? (p.combo + 1) % len : p.combo;
  else if (s.keep) next = s.keep.combo;
  const d = p.dodgeDir;
  if (p.ctl && p.ctl.moveDir) p.ctl.moveDir(d); else d.set(0, 0, 0);
  const f = p.facing;
  let sideSign;
  if (d.lengthSq() > 0.01) {
    const rel = wrap(Math.atan2(d.x, d.z) - f);
    sideSign = Math.abs(rel) > 10 * DEG && Math.abs(rel) < 170 * DEG ? Math.sign(rel) : (s.side = -s.side);
  } else sideSign = (s.side = -s.side);
  const a = f + sideSign * Math.PI / 2;
  d.set(Math.sin(a), 0, Math.cos(a));
  if (p.clearRoll) p.clearRoll();
  p.setState('dodge');
  p.combo = next; p.queued = false; p.setGlow(0);
  p.r2Step = { t: 0, atk: false, next };
  p.anim.play(sideSign > 0 ? 'Dodge_Left' : 'Dodge_Right', { once: true, restart: true, fade: 0.04, speed: 2.8 });
  audio.play('dodge', p.position.x, p.position.z, { v: 0.6 });
  if (p.onDodge) p.onDodge(p, 'start');
  kcDodge(p, 'start'); // Esquiva de Boxe continua valendo
  C.log({ type: 'r2Ging', next, side: sideSign });
  return true;
}
// Gingado, a cada quadro (estado 'dodge'). Devolve 'attack', 'end' ou nada.
export function r2StepTick(p, dt, world, input) {
  const G = R2.ging, st = p.r2Step;
  if (input && input.attack && input.attack()) st.atk = true;
  if (p.stateTime < G.time) p.move(p.dodgeDir.x, p.dodgeDir.z, G.dist / G.time * dt, world);
  const done = st.atk ? p.stateTime >= 0.06 : p.stateTime >= G.time;
  if (!done) return null;
  p.r2Step = null;
  p.dodgeCooldown = G.cd;
  if (p.onDodge) p.onDodge(p, 'end');
  if (st.atk) { p.combo = st.next; return 'attack'; }
  r2S(p).keep = { combo: st.next, t: G.keep };
  return 'end';
}
// Atacar parado/correndo: depois do Gingado o combo continua de onde estava.
export function r2Combo(p) {
  const s = p.r2s;
  if (!s || !s.keep) return 0;
  const n = s.keep.combo; s.keep = null;
  return n < p.hero.combo.length ? n : 0;
}
