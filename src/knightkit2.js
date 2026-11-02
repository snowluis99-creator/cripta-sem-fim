// Espada e Escudo, 2ª leva (pedido do dono, 02/11/2026):
// - Duelo Sagrado: ao começar a luta da sala, você desafia o inimigo mais forte. Um círculo dourado prende os dois
//   e ninguém entra (nem golpes, nem flechas) até um cair.
// - Vassalo: o último esqueleto de cada onda se rende, ajoelha e luta do seu lado até o fim da sala.
// - Mesa Virada: barris, mesas e caixotes na frente do escudo são chutados (bloqueio ou pancada de escudo) e viram projéteis.
// - Cavalo Fantasma: rolar invoca um cavalo espectral; você galopa por 2 s atropelando tudo.
// - Espada Amaldiçoada: a espada pede um tipo de inimigo por sala. Obedeceu: prêmio. Ignorou: ela te machuca.
import * as THREE from 'three';
import { audio } from './audio.js';
import { ENEMIES } from './enemies.js';
import { undeadDied } from './undead.js';
import { isKit } from './knightkit.js';

export const KIT2 = {
  duel: { minR: 4, maxR: 6.5, pad: 1.6 },
  vassal: { kneel: 1.3 },
  table: { speed: 15, range: 12, damage: 22, splash: 1.5, reach: 2.4, arc: 70 },
  horse: { time: 2, speed: 10.5, damage: 10, iframes: 0.4, seat: 1.02, scale: 1.2 },
  curse: { want: 3, gold: 60, heal: 30, ult: 3, punish: 15 },
};

const KICKABLE = /barrel|keg|table|crate|box|chair|bench|trunk|stool/;
const PLURAL = { minion: 'lacaios', warrior: 'guerreiros', archer: 'arqueiros', mage: 'magos', assassin: 'assassinos' };
const SINGULAR = { minion: 'Lacaio', warrior: 'Guerreiro', archer: 'Arqueiro', mage: 'Mago', assassin: 'Assassino' };
const GOLD = 0xffd36a, GHOST = 0x8fe3ff, CURSE = 0xb066ff;

let C = null;
const W = (p) => (p && p.stats && p.stats.w) || {};
const has = (p, k) => !!(p && isKit(p) && W(p)[k] && p.state !== 'dead');
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const kitOf = (p) => p.kit || (p.kit = { sword: 'hand', shield: 'hand' });

// ---------- Ganchos chamados pelo herói (player.js) ----------

// Rolar: Cavalo Fantasma (devolve true se montou).
export function kit2StartDodge(p) {
  if (!C || !has(p, 'horse')) return false;
  C.kit2.mount(p);
  return true;
}

// Galopando. Devolve 'attack' se o jogador atacou (desmonta e golpeia).
export function kit2HorseTick(p, dt, world, input, move) {
  return C ? C.kit2.horseTick(p, dt, world, input, move) : 'end';
}

// Levantou o escudo: Mesa Virada (chuta o objeto da frente em vez de bloquear). Devolve true se chutou.
export function kit2TryKick(p) {
  if (!C || !has(p, 'table') || W(p).swap || kitOf(p).shield !== 'hand') return false;
  return C.kit2.kick(p, true);
}

// ---------- Coisas da sala ----------

export class KnightKit2 {
  constructor(combat) {
    C = combat;
    this.c = combat;
    this.waves = null;   // run.js liga
    this.duel = null;
    this.flying = [];    // Mesa Virada: objetos voando
    this.curse = null;   // Espada Amaldiçoada: pedido da sala
    this.roomSeq = 0;
    this.vassalKey = null;
    this.duelDone = false;
  }

  get scene() { return this.c.scene; }
  log(o) { if (this.c.log) this.c.log(o); }
  owner(key) { return this.c.players.find((p) => has(p, key)) || null; }

  // ---- Sala nova (run.enter, depois de começar as ondas) ----
  roomStart(node) {
    this.roomSeq++;
    this.vassalKey = null;
    this.duelDone = false;
    this.curse = null;
    const p = this.owner('curse');
    if (!p || !node || !node.waves) return;
    const total = {};
    for (const wave of node.waves) for (const [t, n] of wave) {
      if (!ENEMIES[t] || ENEMIES[t].boss || ENEMIES[t].phantom) continue;
      total[t] = (total[t] || 0) + (this.waves && this.waves.opts ? this.waves.count(t, n) : n);
    }
    const types = Object.keys(total);
    if (!types.length) return;
    const type = types[Math.floor(Math.random() * types.length)];
    this.curse = { p, type, need: Math.min(KIT2.curse.want, total[type]), got: 0, done: false, said: false, t: 1.4, fx: 0 };
  }

  // ---- Sala limpa (run.roomCleared) ----
  roomClear() {
    for (const e of this.c.enemies) {
      if (!e.vassal || !e.alive) continue;
      this.c.text.add('Às ordens!', e.position, 'heal', 2.8);
      this.c.vfx.ring(v3(e.position.x, 0, e.position.z), GOLD, 1.4);
      e.die(); undeadDied(this.c, e);
    }
    const k = this.curse;
    if (k && k.said && !k.done && k.p.state !== 'dead') {
      const p = k.p, dmg = Math.min(KIT2.curse.punish, Math.max(0, Math.ceil(p.hp) - 1));
      if (dmg > 0) { p.hp -= dmg; p.hurtFlash = 1; this.c.text.add(`-${dmg}`, p.position, 'hurt'); if (this.c.hurtFor) this.c.hurtFor(p, dmg); }
      this.c.text.add('A espada te castiga!', p.position, 'bleed', 3.4);
      this.c.vfx.sparks(v3(p.position.x, 1.3, p.position.z), CURSE, 16);
      audio.play('hurt', p.position.x, p.position.z);
      if (this.c.hud) this.c.hud.banner('A espada: “Você me ignorou…”', 'small');
      this.log({ type: 'cursePunish', dmg });
    }
    this.curse = null;
    this.endDuel(false);
  }

  // ---- Inimigo morreu (combat.killed) ----
  onKill(e) {
    const k = this.curse;
    if (!k || k.done || e.type !== k.type) return;
    k.got++;
    const p = k.p;
    this.log({ type: 'curseKill', got: k.got });
    if (k.got < k.need) { this.c.text.add(`${SINGULAR[k.type] || e.data.name} ${k.got}/${k.need}`, p.position, 'bleed', 2.8); return; }
    k.done = true;
    const kinds = ['gold', 'heal', 'ult'];
    const pick = kinds[Math.floor(Math.random() * kinds.length)];
    let txt;
    if (pick === 'gold') { p.gold += KIT2.curse.gold; if (p === this.c.player && this.c.hud) this.c.hud.setGold(p.gold); txt = `+${KIT2.curse.gold} de ouro`; }
    else if (pick === 'heal') { const h = p.heal ? p.heal(KIT2.curse.heal) : 0; txt = `+${h} de vida`; }
    else { p.ult = Math.min(p.ultNeed || 10, (p.ult || 0) + KIT2.curse.ult); txt = `+${KIT2.curse.ult} na ultimate`; }
    this.c.text.add(`A espada está satisfeita! ${txt}`, p.position, 'gold', 3.4);
    this.c.vfx.burst(p.position, CURSE);
    audio.play('select', p.position.x, p.position.z);
    if (this.c.hud) this.c.hud.banner(`A espada: “Muito bem!” (${txt})`, 'small');
    this.log({ type: 'curseReward', pick });
  }

  // ---------- Duelo Sagrado ----------
  startDuel(p) {
    this.duelDone = true;
    const foes = this.c.enemies.filter((e) => e.alive && !e.undead && !e.finale && !e.data.boss && !e.data.phantom);
    if (!foes.length) return;
    const dist = (e) => Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
    foes.sort((a, b) => (b.maxHp - a.maxHp) || (dist(a) - dist(b)));
    const e = foes[0], D = KIT2.duel;
    let R = Math.min(D.maxR, Math.max(D.minR, dist(e) / 2 + D.pad));
    let x = (p.position.x + e.position.x) / 2, z = (p.position.z + e.position.z) / 2;
    const b = this.c.world.bounds;
    if (b) {
      R = Math.min(R, b.x - 0.2, b.z - 0.2);
      x = Math.max(-b.x + R, Math.min(b.x - R, x));
      z = Math.max(-b.z + R, Math.min(b.z - R, z));
    }
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.16, R, 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.position.y = 0.05;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.8, 64, 1, true).translate(0, 0.9, 0),
      new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    g.add(ring, wall);
    this.scene.add(g);
    this.duel = { p, e, x, z, R, g, ring, wall, t: 0, warn: 0 };
    this.c.text.add('Duelo!', e.position, 'crit', 3.6);
    this.c.vfx.ring(v3(e.position.x, 0, e.position.z), GOLD, 1.6);
    audio.play('select', p.position.x, p.position.z);
    if (this.c.hud) this.c.hud.banner(`Duelo Sagrado: ${e.data.name}`, 'small');
    this.log({ type: 'duelStart', enemy: e });
  }

  endDuel(won) {
    const d = this.duel;
    if (!d) return;
    this.scene.remove(d.g);
    this.duel = null;
    if (won) {
      this.c.text.add('Duelo vencido!', d.p.position, 'gold', 3.4);
      this.c.vfx.burst(v3(d.x, 0, d.z), GOLD);
      audio.play('clear', d.p.position.x, d.p.position.z, { v: 0.5 });
    }
    this.log({ type: 'duelEnd', won });
  }

  inDuel(o) { const d = this.duel; return !!d && (o === d.p || o === d.e); }

  // Golpe atravessando o círculo (de fora para dentro ou de dentro para fora)? Então não vale.
  duelBlocks(a, b) {
    const d = this.duel;
    if (!d || !a || !b) return false;
    if (this.inDuel(a) === this.inDuel(b)) return false;
    if ((d.warn || 0) <= 0) {
      d.warn = 0.5;
      const o = this.inDuel(b) ? a : b;
      if (o && o.position) this.c.vfx.sparks(v3(o.position.x, 1.2, o.position.z), GOLD, 8);
    }
    this.log({ type: 'duelBlocked' });
    return true;
  }

  keepIn(pos, r) {
    const d = this.duel, dx = pos.x - d.x, dz = pos.z - d.z, dist = Math.hypot(dx, dz), max = d.R - r - 0.05;
    if (dist <= max) return;
    pos.x = d.x + dx / dist * max; pos.z = d.z + dz / dist * max;
  }

  keepOut(pos, r) {
    const d = this.duel, dx = pos.x - d.x, dz = pos.z - d.z, dist = Math.hypot(dx, dz), min = d.R + r + 0.05;
    if (dist >= min) return false;
    const nx = dist > 0.01 ? dx / dist : 1, nz = dist > 0.01 ? dz / dist : 0;
    pos.x = d.x + nx * min; pos.z = d.z + nz * min;
    this.c.world.resolveCircle(pos, r);
    return true;
  }

  // Depois de todos andarem (combat.update): prende os dois dentro e empurra os outros para fora.
  afterMove() {
    const d = this.duel;
    if (!d) return;
    if (!d.e.alive || d.e.undead || !this.c.enemies.includes(d.e) || d.p.state === 'dead') { this.endDuel(!d.e.alive && d.p.state !== 'dead'); return; }
    this.keepIn(d.p.position, d.p.hero.radius);
    this.keepIn(d.e.position, d.e.data.radius);
    for (const o of this.c.enemies) if (o !== d.e && o.alive) this.keepOut(o.position, o.data.radius);
    for (const o of this.c.players) if (o !== d.p && o.state !== 'dead') this.keepOut(o.position, o.hero.radius);
    if (this.c.merchant && this.c.merchant.alive && this.c.merchant.position) this.keepOut(this.c.merchant.position, this.c.merchant.radius || 0.5);
    // Flechas e magias não atravessam a parede dourada.
    const L = this.c.projectiles.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const a = L[i];
      const inside = Math.hypot(a.x - d.x, a.z - d.z) < d.R;
      if (a._duelIn === undefined || a._duelSeq !== this.roomSeq) { a._duelIn = inside; a._duelSeq = this.roomSeq; continue; }
      if (a._duelIn !== inside && a.stuck < 0) {
        this.c.vfx.sparks(v3(a.x, a.g.position.y, a.z), GOLD, 10);
        audio.play('block', a.x, a.z, { v: 0.6 });
        this.c.projectiles.remove(i);
        this.log({ type: 'duelProjectile' });
      }
    }
  }

  // ---------- Vassalo ----------
  waveSize() {
    const w = this.waves;
    if (!w || !w.waves || !w.waves[w.wave]) return 0;
    return w.waves[w.wave].reduce((s, [t, n]) => s + w.count(t, n), 0);
  }

  checkVassal() {
    const w = this.waves, p = this.owner('vassal');
    if (!p || !w || w.state !== 'fighting' || w.queue.length) return;
    const key = `${this.roomSeq}:${w.wave}`;
    if (this.vassalKey === key) return;
    const hostile = this.c.enemies.filter((e) => (e.alive || e.finale) && !e.undead);
    if (hostile.length !== 1) return;
    const e = hostile[0];
    if (e.data.boss || e.data.phantom || e.finale || this.inDuel(e) || this.waveSize() < 2) { this.vassalKey = key; return; }
    if (!e.targetable || e.state === 'held' || e.state === 'thrown' || e.frozenT > 0) return; // espera poder se render
    this.vassalKey = key;
    this.surrender(e, p);
  }

  surrender(e, p) {
    const d = e.data;
    e.data = { ...d, attackRange: d.ranged ? d.attackRange : Math.max(d.attackRange || 0, 2.0), voice: undefined };
    e.undead = p; e.vassal = true;
    e.noGrave = true; e.noUltCharge = true; e.provokedBy = null; e.darkMark = null;
    if (e.darkFx) { e.darkFx.s.visible = false; e.darkFx.skull.visible = false; }
    if (e.releaseToken) e.releaseToken();
    e.vel.set(0, 0, 0);
    e.hp = Math.max(e.hp, Math.round(e.maxHp * 0.5)); // levanta com pelo menos metade da vida
    e.setState('hurt');
    e.stunTime = KIT2.vassal.kneel;
    e.anim.play('Crouching', { fade: 0.2, restart: true });
    this.c.text.add('Rendeu-se!', e.position, 'gold', 3.4);
    this.c.vfx.ring(v3(e.position.x, 0, e.position.z), GOLD, 1.6);
    this.c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), GOLD, 14);
    audio.play('rise', e.position.x, e.position.z);
    this.log({ type: 'vassal', enemy: e });
  }

  // ---------- Mesa Virada ----------
  // Procura um objeto que dá para chutar na frente do herói e chuta. fromGuard: levantou o escudo (anima a pancada).
  kick(p, fromGuard) {
    const T = KIT2.table, props = this.c.props;
    let best = null, bd = Infinity;
    for (const b of props.list) {
      if (b.broken || !KICKABLE.test(b.name)) continue;
      const dx = b.x - p.position.x, dz = b.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > T.reach + b.r || Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > T.arc / 2 * Math.PI / 180) continue;
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return false;
    const b = best;
    props.kickOut(b);
    const obj = b.obj;
    this.scene.attach(obj);
    obj.visible = true;
    const a = p.facing;
    const it = { b, obj, p, dx: Math.sin(a), dz: Math.cos(a), x: b.x, z: b.z, y0: obj.position.y, dist: 0, spin: 0 };
    this.flying.push(it);
    if (fromGuard) p.emote('Melee_Block_Attack', { speed: 1.9, end: 0.55 });
    p.facing = a;
    this.c.vfx.dust(v3(b.x, 0, b.z), v3(-it.dx, 0, -it.dz), 6);
    audio.play('swingHeavy', b.x, b.z);
    this.c.text.add('Chutou!', p.position, 'crit', 3.0);
    this.log({ type: 'tableKick', name: b.name });
    return true;
  }

  updateFlying(dt) {
    const T = KIT2.table, c = this.c;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const it = this.flying[i];
      const step = T.speed * dt;
      let hit = false;
      for (let s = 0; s < 3 && !hit; s++) {
        const nx = it.x + it.dx * step / 3, nz = it.z + it.dz * step / 3;
        if (c.world.blocked(nx, nz, Math.min(0.4, it.b.r))) { c.props.hitAt(nx, nz, it.p); hit = true; break; }
        it.x = nx; it.z = nz; it.dist += step / 3;
        for (const e of c.enemies) {
          if (!e.targetable) continue;
          if (Math.hypot(e.position.x - nx, e.position.z - nz) <= e.data.radius + Math.max(0.35, it.b.r * 0.8)) { hit = true; break; }
        }
        if (it.dist >= T.range) hit = true;
      }
      it.spin += dt * 9;
      it.obj.position.set(it.x, it.y0 + 0.5 + Math.sin(Math.min(1, it.dist / T.range) * Math.PI) * 0.6, it.z);
      it.obj.rotation.x = it.spin; it.obj.rotation.y += dt * 3;
      if (!hit) continue;
      this.flying.splice(i, 1);
      // Explode em lascas: dano em quem estiver perto do impacto.
      let n = 0;
      for (const e of [...c.enemies]) {
        if (!e.targetable) continue;
        const dx = e.position.x - it.x, dz = e.position.z - it.z, d = Math.hypot(dx, dz) || 0.01;
        if (d > T.splash + e.data.radius) continue;
        if (this.duelBlocks(it.p, e)) continue;
        const ux = d > 0.05 ? dx / d : it.dx, uz = d > 0.05 ? dz / d : it.dz;
        c.bonusDamage(e, Math.round(T.damage * it.p.stats.damageMul), ux, uz, 'dmg big', it.p);
        if (e.alive && !e.data.boss && e.offBalance) e.offBalance(ux, uz, 0.7, 9);
        n++;
      }
      this.scene.remove(it.obj);
      c.props.kickBurst(it.b, it.x, it.z, it.dx, it.dz, it.p);
      c.vfx.heavyImpact(v3(it.x, 0, it.z), 0.6);
      this.log({ type: 'tableHit', hits: n });
    }
  }

  // ---------- Cavalo Fantasma ----------
  mount(p) {
    const k = kitOf(p), H = KIT2.horse;
    const dir = new THREE.Vector3();
    if (p.ctl) p.ctl.moveDir(dir);
    if (dir.lengthSq() > 0) p.facing = Math.atan2(dir.x, dir.z);
    p.setState('horse');
    p.combo = 0;
    p.setGlow(0);
    p.iframes = Math.max(p.iframes, H.iframes);
    k.horseHits = new Set();
    if (!k.horse) { k.horse = makeHorse(); k.horse.g.scale.setScalar(H.scale); }
    p.group.add(k.horse.g);
    k.horse.g.visible = true;
    k.horseOn = true;
    p.model.position.set(0, H.seat, 0.05);
    p.anim.play('Sit_Chair_Idle', { fade: 0.08, restart: true });
    this.c.vfx.smoke(p.position, GHOST, 10);
    audio.play('dodge', p.position.x, p.position.z);
    audio.play('rise', p.position.x, p.position.z, { v: 0.6 });
    this.c.text.add('Cavalo Fantasma!', p.position, 'crit', 3.0);
    this.log({ type: 'horseStart' });
  }

  dismount(p) {
    const k = kitOf(p);
    if (!k.horseOn) return;
    k.horseOn = false;
    if (k.horse) p.group.remove(k.horse.g);
    p.model.position.set(0, 0, 0);
    p.dodgeCooldown = p.hero.dodge.cooldown;
    this.c.vfx.smoke(p.position, GHOST, 8);
    this.log({ type: 'horseEnd' });
  }

  horseTick(p, dt, world, input, move) {
    const k = kitOf(p), H = KIT2.horse;
    const moving = move.lengthSq() > 0;
    if (moving) p.facing += wrap(Math.atan2(move.x, move.z) - p.facing) * Math.min(1, dt * 5);
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    p.move(fx, fz, H.speed * dt, world);
    // Galope: pernas e um balanço leve.
    const ph = p.stateTime * 15;
    if (k.horse) {
      const L = k.horse.legs;
      L[0].rotation.x = Math.sin(ph) * 0.8; L[1].rotation.x = Math.sin(ph + 0.6) * 0.8;
      L[2].rotation.x = Math.sin(ph + Math.PI) * 0.8; L[3].rotation.x = Math.sin(ph + Math.PI + 0.6) * 0.8;
      k.horse.g.position.y = Math.abs(Math.sin(ph * 0.5)) * 0.12;
      k.horse.g.rotation.x = Math.sin(ph) * 0.04;
      const fade = Math.min(1, (H.time - p.stateTime) / 0.3);
      for (const m of k.horse.mats) m.opacity = 0.55 * Math.max(0.2, fade);
    }
    p.model.position.y = H.seat + (k.horse ? k.horse.g.position.y : 0);
    // Atropela.
    for (const e of [...this.c.enemies]) {
      if (!e.targetable || k.horseHits.has(e)) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > e.data.radius + p.hero.radius + 0.55) continue;
      if (this.duelBlocks(p, e)) continue;
      k.horseHits.add(e);
      // Joga para o lado e para a frente.
      const side = (dx * fz - dz * fx) >= 0 ? 1 : -1;
      const ux = fx * 0.6 + fz * side * 0.8, uz = fz * 0.6 - fx * side * 0.8, ul = Math.hypot(ux, uz) || 1;
      this.c.bonusDamage(e, Math.round(H.damage * p.stats.damageMul), ux / ul, uz / ul, 'dmg', p);
      if (e.alive && !e.data.boss && e.offBalance) e.offBalance(ux / ul, uz / ul, 0.8, 12);
      this.c.vfx.sparks(v3(e.position.x, 1.1, e.position.z), GHOST, 8);
      audio.play('hit', e.position.x, e.position.z);
      this.log({ type: 'horseHit', enemy: e });
    }
    this.c.props.strikeArc(p, 1.3, 0.9); // passa por cima dos objetos quebráveis
    if (Math.random() < dt * 25) this.c.vfx.sparks(v3(p.position.x - fx * 0.9, 0.4, p.position.z - fz * 0.9), GHOST, 2);
    if (input.attack()) { this.dismount(p); return 'attack'; }
    if (p.stateTime >= H.time) { this.dismount(p); return 'end'; }
    return null;
  }

  // ---------- Quadro a quadro ----------
  update(dt) {
    const c = this.c;
    for (const p of c.players) if (p.kit && p.kit.horseOn && p.state !== 'horse') this.dismount(p); // apanhou/morreu montado
    if (this.duel) {
      const d = this.duel;
      d.t += dt; d.warn = Math.max(0, (d.warn || 0) - dt);
      d.ring.material.opacity = 0.65 + 0.25 * Math.sin(d.t * 5);
      d.wall.material.opacity = 0.12 + 0.06 * Math.sin(d.t * 3);
    }
    // Duelo: começa quando a 1ª onda terminou de nascer.
    const w = this.waves, dp = this.owner('duel');
    if (dp && !this.duel && !this.duelDone && w && w.state === 'fighting' && !w.queue.length && w.wave === 0) {
      if (c.enemies.some((e) => e.alive && !e.undead && e.targetable)) this.startDuel(dp);
    }
    this.checkVassal();
    if (this.flying.length) this.updateFlying(dt);
    // Espada Amaldiçoada: anuncia o pedido e solta faíscas roxas enquanto não for atendida.
    const k = this.curse;
    if (k && k.p.state !== 'dead') {
      if (!k.said && (k.t -= dt) <= 0) {
        k.said = true;
        const name = PLURAL[k.type] || `${ENEMIES[k.type].name.toLowerCase()}s`;
        c.text.add(`“Quero ${name}!”`, k.p.position, 'bleed', 3.6);
        if (c.hud) c.hud.banner(`A espada fala: “Quero ${name}!” (${k.need})`, 'small');
        c.vfx.sparks(v3(k.p.position.x, 1.4, k.p.position.z), CURSE, 14);
        audio.play('rise', k.p.position.x, k.p.position.z, { v: 0.5 });
        this.log({ type: 'curseAsk', kind: k.type, need: k.need });
      }
      if (k.said && !k.done && (k.fx -= dt) <= 0 && k.p.weapon && k.p.weapon.visible) {
        k.fx = 0.25;
        const wp = k.p.weapon.getWorldPosition(new THREE.Vector3());
        c.vfx.sparks(wp, CURSE, 1);
      }
    }
  }

  clear() {
    for (const it of this.flying) this.scene.remove(it.obj);
    this.flying.length = 0;
    if (this.duel) { this.scene.remove(this.duel.g); this.duel = null; }
    for (const p of this.c.players) if (p.kit && p.kit.horseOn) { if (p.state === 'horse') { p.setState('idle'); p.anim.play(p.hero.anims.idle, { fade: 0.1 }); } this.dismount(p); }
  }
}

// Cavalo espectral feito de blocos (não há modelo de cavalo nos assets): azul, meio transparente e brilhando.
function makeHorse() {
  const mats = [];
  const mat = () => { const m = new THREE.MeshStandardMaterial({ color: 0xa8ecff, emissive: 0x3aa8ff, emissiveIntensity: 1.1, transparent: true, opacity: 0.55, depthWrite: false, roughness: 0.6 }); mats.push(m); return m; };
  const m = mat(), dark = mat();
  dark.color.setHex(0x5fc8ff); dark.emissive.setHex(0x1f6fd0);
  const g = new THREE.Group();
  const box = (w, h, d, mm = m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mm);
  const body = box(0.6, 0.55, 1.45); body.position.set(0, 1.05, 0); g.add(body);
  const chest = box(0.56, 0.5, 0.4); chest.position.set(0, 1.08, 0.62); g.add(chest);
  const neck = box(0.32, 0.7, 0.34); neck.position.set(0, 1.42, 0.82); neck.rotation.x = 0.55; g.add(neck);
  const head = box(0.3, 0.3, 0.62); head.position.set(0, 1.74, 1.08); head.rotation.x = 0.35; g.add(head);
  for (const s of [-1, 1]) { const ear = box(0.07, 0.16, 0.07); ear.position.set(0.1 * s, 1.95, 0.9); g.add(ear); }
  const mane = box(0.1, 0.62, 0.22, dark); mane.position.set(0, 1.6, 0.7); mane.rotation.x = 0.55; g.add(mane);
  const tail = box(0.12, 0.7, 0.14, dark); tail.position.set(0, 0.98, -0.8); tail.rotation.x = -0.5; g.add(tail);
  const legs = [];
  for (const [x, z] of [[-0.2, 0.55], [0.2, 0.55], [-0.2, -0.55], [0.2, -0.55]]) {
    const pivot = new THREE.Group(); pivot.position.set(x, 0.85, z);
    const leg = box(0.15, 0.85, 0.15); leg.position.y = -0.42; pivot.add(leg);
    const hoof = box(0.17, 0.1, 0.19, dark); hoof.position.y = -0.84; pivot.add(hoof);
    g.add(pivot); legs.push(pivot);
  }
  g.traverse((o) => { if (o.isMesh) o.renderOrder = 2; });
  return { g, legs, mats };
}
