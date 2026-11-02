// Bênçãos do Machado de Duas Mãos do Cavaleiro (lista do dono, 02/11/2026) — 1ª leva.
// Fio Pesado (acertar vários aumenta o dano), Giro Voraz (giro invulnerável), Sede de Batalha (abates da sala),
// Braços de Ferro (execução no golpe forte), Racha-Crânios (abate paralisa os vizinhos), Redemoinho (o giro
// rebate projéteis), Arremesso Mortal (4º golpe: o machado vai e volta), Pião (giro sem parar), Tornado (o giro
// puxa), Giro Crescente (o giro cresce na sala) e Rolagem Giratória (rolar gira cortando).
import * as THREE from 'three';
import { audio } from './audio.js';
import { instance } from './assets.js';

export const AXE = {
  spinGuard: 0.5,                 // Giro Voraz: s de invulnerabilidade por nível
  multiTime: 2,                   // Fio Pesado: duração do bônus
  killDazeR: 3.2,                 // Racha-Crânios: raio
  whirlR: 2.6,                    // Redemoinho: raio em que o giro rebate projéteis
  throw: { damage: 30, out: 8, speed: 17, back: 21, r: 1.25, catch: 1.0 }, // Arremesso Mortal
  top: { move: 0.4, max: 8 },    // Pião: velocidade andando (× normal) e tempo máximo
  tornado: { extra: 2.2, keep: 1.3 }, // Tornado: alcance além do giro e distância em que ficam
  grow: { per: 0.06, max: 0.8 },  // Giro Crescente: +6% por inimigo acertado, até +80%
  roll: { mul: 0.6, r: 2.4 },     // Rolagem Giratória: 60% do dano do giro, raio
};

let C = null;
const W = (p) => (p && p.stats && p.stats.w) || {};
export const isAxe = (p) => !!(p && p.heroId === 'knight' && p.hero && p.hero.weaponId === 'machado');
const isSpinStep = (s) => !!(s && s.arc === 360);
const giroOf = (p) => p.hero.combo.find(isSpinStep);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- Combo ----------

// Arremesso Mortal: o combo ganha um 4º golpe (depois da machadada forte) que arremessa o machado.
export function applyAxe(p) {
  if (!isAxe(p)) return;
  const w = W(p), h = p.hero;
  if (w.axeThrow) {
    const n = h.combo.length - 1;
    h.combo[n] = { ...h.combo[n], window: h.combo[n].window ?? 0.5 };
    h.combo.push({ clip: 'Throw', speed: 1.5, hit: 0.42, end: 0.75, lunge: 0.15, damage: AXE.throw.damage, kit: 'axeThrow' });
  }
  if (p.axeAway && p.weapon) p.weapon.visible = false;
}

// Troca de arma/herói, nova partida: o machado volta para a mão.
export function axeReset(p) {
  if (C) C.axe.dropFor(p);
  p.axeAway = false;
  p.axeGrow = 0; p.axeKills = 0; p.axeMultiT = 0;
  if (p.weapon) p.weapon.visible = true;
}

// Começou um golpe. Giro Voraz: o giro deixa invulnerável.
export function axeOnStart(p, step) {
  if (!isAxe(p)) return;
  const w = W(p);
  if (isSpinStep(step) && w.spinGuard) p.iframes = Math.max(p.iframes || 0, w.spinGuard);
}

// Golpe com efeito próprio. Devolve true se o golpe foi trocado (arremesso: não tem corte).
export function axeStrike(combat, p, step) {
  if (step.kit !== 'axeThrow' || !isAxe(p)) return false;
  if (!p.axeAway) combat.axe.throwAxe(p, step);
  return true;
}

// Alcance do golpe (Giro Crescente: o giro cresce a cada inimigo acertado na sala).
export function axeRangeMul(p, step) {
  if (!isAxe(p) || !isSpinStep(step) || !W(p).spinGrow) return 1;
  return 1 + Math.min(AXE.grow.max, (p.axeGrow || 0) * AXE.grow.per);
}

// Depois de procurar quem acertou: Fio Pesado, Giro Crescente, Tornado.
export function axeAfterStrike(combat, p, step, hits, range) {
  if (!isAxe(p)) return;
  const w = W(p);
  if (w.multiHit && hits > 1) {
    p.axeMultiT = AXE.multiTime;
    p.axeMultiBonus = w.multiHit * hits;
    combat.text.add(`Fio Pesado +${Math.round(p.axeMultiBonus * 100)}%`, p.position, 'crit', 3.4);
  }
  if (!isSpinStep(step)) return;
  if (w.spinGrow) {
    const before = axeRangeMul(p, step);
    p.axeGrow = (p.axeGrow || 0) + hits;
    combat.vfx.ring(v3(p.position.x, 0, p.position.z), 0xffb070, range);
    if (axeRangeMul(p, step) > before + 0.001 && combat.log) combat.log({ type: 'axeGrow', mul: axeRangeMul(p, step) });
  }
  if (w.tornado) combat.axe.tornado(p, range);
}

// Multiplicador de dano (Fio Pesado e Sede de Batalha).
export function axeDamageMul(p) {
  if (!isAxe(p)) return 1;
  const w = W(p);
  let m = 1;
  if (p.axeMultiT > 0) m *= 1 + (p.axeMultiBonus || 0);
  if (w.roomRamp && p.axeKills > 0) m *= 1 + w.roomRamp * p.axeKills;
  return m;
}

// Depois do dano. Braços de Ferro: o golpe forte executa quem ficou com pouca vida.
export function axeOnHit(combat, p, e, step, died) {
  if (!isAxe(p) || died || !e.alive) return;
  const w = W(p);
  if (step.heavy && w.execute && !e.data.boss && e.hp > 0 && e.hp <= e.maxHp * w.execute) {
    combat.text.add('Executado!', e.position, 'crit', 3.4);
    combat.vfx.sparks(v3(e.position.x, 1.3, e.position.z), 0xff3b3b, 14);
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
    combat.bonusDamage(e, Math.ceil(e.hp), dx / d, dz / d, 'dmg big', p);
    if (combat.log) combat.log({ type: 'axeExecute', enemy: e });
  }
}

// Inimigo destruído pelo herói: Sede de Batalha e Racha-Crânios.
export function axeOnKill(combat, e, by) {
  if (!isAxe(by)) return;
  const w = W(by);
  if (w.roomRamp) by.axeKills = (by.axeKills || 0) + 1;
  if (w.killDaze) {
    let n = 0;
    for (const o of combat.enemies) {
      if (o === e || !o.alive || !o.targetable || !o.daze) continue;
      if (Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) > AXE.killDazeR + o.data.radius) continue;
      if (o.daze(o.data.boss ? Math.min(0.5, w.killDaze) : w.killDaze)) { combat.text.add('Paralisado!', o.position, 'hurt', 3.2); n++; }
    }
    if (n) combat.vfx.ring(v3(e.position.x, 0, e.position.z), 0xffd36a, AXE.killDazeR);
    if (n && combat.log) combat.log({ type: 'axeDaze', n });
  }
}

// Rolar: Rolagem Giratória (gira com o machado em vez da cambalhota).
export function axeStartDodge(p) {
  p.axeRoll = isAxe(p) && !!W(p).rollSpin && !p.axeAway;
  if (!p.axeRoll) return false;
  p.axeRollHits = new Set();
  p.anim.play('Melee_2H_Attack_Spinning', { once: true, restart: true, fade: 0.04, speed: 0.67 / p.hero.dodge.time });
  return true;
}
export function axeApplyRoll(p, t) {
  const k = Math.min(Math.max(t, 0), 1);
  p.model.rotation.set(0, k * Math.PI * 2, 0);
  p.model.position.set(0, 0, 0);
}

// ---------- Pião ----------

// No fim do giro com o ataque apertado e segurando: continua girando (devolve true se começou).
export function axeTryTop(p, step, input) {
  if (!isAxe(p) || !isSpinStep(step) || !W(p).spinTop) return false;
  const held = input.attackHeld ? input.attackHeld() : true;
  if (!held) return false;
  p.setState('spin');
  p.topLoop = 0; p.topHit = false; p.topT = 0;
  p.queued = false;
  playTop(p);
  if (C && C.log) C.log({ type: 'axeTop' });
  return true;
}
function playTop(p) {
  const g = giroOf(p);
  p.anim.play(g.clip, { once: true, restart: true, fade: 0.03, speed: g.speed * p.atkSpeed });
  audio.play('swing', p.position.x, p.position.z);
}
// Girando: anda devagar, cada volta acerta de novo. Solta o botão: a volta termina e sai a machadada forte.
// Devolve 'heavy' (fazer o golpe forte) ou nada.
export function axeTopTick(p, dt, world, input, tmpMove) {
  const g = giroOf(p);
  const T = p.anim.current.getClip().duration / (g.speed * p.atkSpeed);
  p.topT += dt;
  const loopT = p.topT - p.topLoop * T;
  if (tmpMove.lengthSq() > 0) p.move(tmpMove.x, tmpMove.z, p.hero.moveSpeed * p.moveMul * AXE.top.move * dt, world);
  if (!p.topHit && loopT >= T * g.hit) { p.topHit = true; if (p.onHit) p.onHit(p, g); }
  if (loopT >= T) {
    const held = input.attackHeld ? input.attackHeld() : false;
    if (!held || p.topT >= AXE.top.max) return 'heavy';
    p.topLoop++; p.topHit = false;
    playTop(p);
  }
  return null;
}
// O herói está girando (para o Redemoinho).
export function axeSpinning(p) {
  if (p.state === 'spin') return true;
  if (p.state !== 'attack') return false;
  const s = p.hero.combo[p.combo];
  return isSpinStep(s) && p.stateTime < 0.72 / (s.speed * (p.atkSpeed || 1));
}

// ---------- Coisas na sala (machado voando) ----------

export class AxeKit {
  constructor(combat) {
    C = combat;
    this.c = combat;
    this.items = []; // machado arremessado: { p, g, spin, phase: 'out'|'back', dx, dz, dist, hitOut, hitBack }
  }

  get scene() { return this.c.scene; }

  throwAxe(p, step) {
    p.axeAway = true;
    if (p.weapon) p.weapon.visible = false;
    const mesh = instance(p.hero.weapons.right.model);
    const g = new THREE.Group(), spin = new THREE.Group();
    g.add(spin); spin.add(mesh);
    mesh.rotation.z = Math.PI / 2; // deitado, girando como uma hélice
    mesh.position.x = -0.6;
    const a = p.facing;
    g.position.set(p.position.x + Math.sin(a) * 0.9, 1.1, p.position.z + Math.cos(a) * 0.9);
    this.scene.add(g);
    this.items.push({ p, g, spin, phase: 'out', dx: Math.sin(a), dz: Math.cos(a), dist: 0, hitOut: new Set(), hitBack: new Set(), step });
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.2 });
    this.c.text.add('Arremessou!', p.position, 'crit', 3.0);
    if (this.c.log) this.c.log({ type: 'axeThrow' });
  }

  // Tornado: puxa os inimigos em volta para perto do herói.
  tornado(p, range) {
    const R = AXE.tornado;
    let n = 0;
    for (const e of this.c.enemies) {
      if (!e.alive || !e.targetable || e.data.boss || e.undead || !e.vel) continue;
      const dx = p.position.x - e.position.x, dz = p.position.z - e.position.z, d = Math.hypot(dx, dz) || 0.001;
      if (d > range + R.extra + e.data.radius) continue;
      const pull = Math.max(0, d - (p.hero.radius + e.data.radius + R.keep * 0.5));
      e.vel.set(dx / d, 0, dz / d).multiplyScalar(pull * 9); // o atrito dos inimigos leva ~1/9 da velocidade em distância
      n++;
    }
    if (n) {
      this.c.vfx.ring(v3(p.position.x, 0, p.position.z), 0xbfe6ff, range + R.extra);
      this.c.vfx.dust(v3(p.position.x, 0.1, p.position.z), v3(0, 0, 0), 10);
    }
    if (this.c.log) this.c.log({ type: 'axeTornado', n });
  }

  // Redemoinho: rebate (sem gastar nada) o projétil para quem atirou.
  reflect(a, p) {
    const c = this.c;
    a.hits = 'reflected';
    a.by = p;
    a.bounces = 0;
    a.hitSet = new Set();
    a.homing = 0;
    const o = a.owner;
    a.target = o && o.targetable && c.enemies.includes(o) ? o : null;
    const sp = Math.max(a.speed || Math.hypot(a.vx, a.vz), 14) * 1.25;
    const ang = a.target ? Math.atan2(a.target.position.x - a.x, a.target.position.z - a.z) : Math.atan2(-a.vx, -a.vz);
    a.vx = Math.sin(ang) * sp; a.vz = Math.cos(ang) * sp;
    a.g.rotation.y = ang;
    a.life = 3; a.age = 0;
    c.vfx.sparks(v3(a.x, 1.3, a.z), 0xffd9a0, 12);
    audio.play('block', a.x, a.z, { v: 0.7 });
    c.text.add('Rebateu!', p.position, 'block');
    if (c.log) c.log({ type: 'axeReflect', kind: a.kind, owner: o });
  }

  update(dt) {
    const c = this.c;
    for (const p of c.players) {
      if (p.axeMultiT > 0) p.axeMultiT -= dt;
      if (!isAxe(p)) continue;
      const w = W(p);
      // Redemoinho: projéteis que chegam perto do giro voltam.
      if (w.whirl && axeSpinning(p)) {
        for (const a of [...c.projectiles.list]) {
          if (!a || a.hits !== 'player' || a.stuck >= 0) continue;
          if (Math.hypot(a.x - p.position.x, a.z - p.position.z) > AXE.whirlR + a.r) continue;
          this.reflect(a, p);
        }
      }
      // Rolagem Giratória: corta quem estiver em volta (cada um 1 vez por rolamento).
      if (p.state === 'dodge' && p.axeRoll) {
        const g = giroOf(p);
        for (const e of [...c.enemies]) {
          if (!e.targetable || p.axeRollHits.has(e)) continue;
          const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.001;
          if (d > AXE.roll.r + e.data.radius) continue;
          p.axeRollHits.add(e);
          c.damageEnemy(p, e, { clip: g.clip, damage: g.damage * AXE.roll.mul, rollSpin: true }, dx / d, dz / d);
          if (c.log) c.log({ type: 'axeRollHit', enemy: e });
        }
        if (Math.random() < dt * 30) c.vfx.sparks(v3(p.position.x, 0.9, p.position.z), 0xffe6a0, 2);
      }
    }
    // Machado arremessado: vai, gira e volta para a mão.
    const T = AXE.throw;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], p = it.p, g = it.g;
      it.spin.rotation.y += dt * 22;
      if (p.state === 'dead' || !c.players.includes(p)) { this.remove(it); continue; }
      if (it.phase === 'out') {
        const step = T.speed * dt;
        const nx = g.position.x + it.dx * step, nz = g.position.z + it.dz * step;
        if (c.world.blocked(nx, nz, 0.2)) { it.phase = 'back'; c.vfx.sparks(v3(g.position.x, 1.1, g.position.z), 0xffe6a0, 8); audio.play('block', g.position.x, g.position.z, { v: 0.6 }); }
        else { g.position.x = nx; g.position.z = nz; it.dist += step; if (it.dist >= T.out) it.phase = 'back'; }
        this.cut(it, it.hitOut, it.dx, it.dz);
      } else {
        const dx = p.position.x - g.position.x, dz = p.position.z - g.position.z, d = Math.hypot(dx, dz) || 0.001;
        if (d <= T.catch + T.back * dt) { this.catchAxe(it); continue; }
        g.position.x += dx / d * T.back * dt; g.position.z += dz / d * T.back * dt;
        this.cut(it, it.hitBack, dx / d, dz / d);
      }
      if (Math.random() < dt * 12) audio.play('swing', g.position.x, g.position.z, { v: 0.35 });
    }
  }

  // Corta quem estiver no caminho (cada inimigo 1 vez na ida e 1 vez na volta).
  cut(it, set, dx, dz) {
    const c = this.c, g = it.g;
    for (const e of [...c.enemies]) {
      if (!e.targetable || set.has(e)) continue;
      if (Math.hypot(e.position.x - g.position.x, e.position.z - g.position.z) > AXE.throw.r + e.data.radius) continue;
      set.add(e);
      c.damageEnemy(it.p, e, it.step, dx, dz, { ranged: true });
    }
    c.props.hitAt(g.position.x, g.position.z, it.p);
  }

  catchAxe(it) {
    const p = it.p;
    this.remove(it);
    p.axeAway = false;
    if (p.weapon) p.weapon.visible = true;
    audio.play('thump', p.position.x, p.position.z, { v: 0.6 });
    if (this.c.log) this.c.log({ type: 'axeCatch' });
  }

  remove(it) {
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
    if (it.g.parent) it.g.parent.remove(it.g);
    if (!this.items.some((o) => o.p === it.p)) { it.p.axeAway = false; if (it.p.weapon) it.p.weapon.visible = true; }
  }

  dropFor(p) { for (const it of [...this.items]) if (it.p === p) this.remove(it); }

  // Troca de sala / nova partida: tudo volta para a mão; Giro Crescente e Sede de Batalha zeram.
  clear() { for (const it of [...this.items]) this.remove(it); }
  roomStart() { for (const p of this.c.players) { p.axeGrow = 0; p.axeKills = 0; } }
}
