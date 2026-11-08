// Espada e Escudo, 2ª leva (pedido do dono, 02/11/2026):
// - Duelo Sagrado: a cada onda (menos na sala do chefe), você desafia o inimigo mais forte. Um círculo dourado prende
//   os dois e ninguém entra (nem golpes, nem flechas) até um cair. Vencer conserta o escudo e cura 10 (04/11).
// - Vassalo: o último esqueleto de cada onda se rende, ajoelha e luta do seu lado até o fim da sala. O da última onda
//   vai junto e luta na próxima sala também (04/11).
// - Mesa Virada: barris, mesas e caixotes na frente do escudo são chutados (bloqueio ou pancada de escudo) e viram projéteis.
// - Cavalo Fantasma: rolar invoca um cavalo espectral; você galopa por 2 s sem levar dano, atropelando tudo. Quem é
//   atropelado fica enterrado até 2 s depois de desmontar. Recarga de 20 s (04/11).
// - Espada Amaldiçoada: a espada escolhe o tipo do 1º inimigo a cair na sala. Acertou: prêmio. Errou: ela te machuca.
import * as THREE from 'three';
import { audio } from './audio.js';
import { ENEMIES } from './enemies.js';
import { undeadDied } from './undead.js';
import { isKit, kitGuardRoll } from './knightkit.js';
import { repairShield, spendShield } from './shield.js';
import { addVassalGear } from './vassalgear.js';
import { makeHorse } from './horse.js';

export const KIT2 = {
  duel: { minR: 4, maxR: 6.5, pad: 1.6, heal: 10 },
  vassal: { kneel: 1.3, scene: 2.6, walk: 0.5, gap: 1.35, kneelClip: 'Skeletons_Awaken_Floor', kneelFrom: 0.42, kneelAt: 0.5, swordClip: 'Melee_1H_Attack_Chop', swordAt: 0.45, touch: 1.25, dub: 1.55 },
  table: { speed: 15, range: 12, damage: 22, splash: 1.5, reach: 2.4, arc: 70 },
  horse: { time: 2, speed: 10.5, damage: 10, iframes: 0.4, seat: 1.02, scale: 1.2, buryAfter: 2, sink: 0.75 },
  curse: { gold: 60, heal: 30, ult: 3, punish: 15 },
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

// Segurando o bloqueio + rolar: Cavalo Fantasma (devolve true se montou). Sem recarga: gasta 1 carga do escudo.
export function kit2StartDodge(p) {
  if (!C || !has(p, 'horse') || !kitGuardRoll(p)) return false; // sem segurar o bloqueio: rolamento normal
  spendShield(p, C);
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
    this.duelKey = null;
    this.carry = null;   // Vassalo da última onda: vai para a próxima sala
    this.buried = [];    // Cavalo Fantasma: enterrados
  }

  get scene() { return this.c.scene; }
  log(o) { if (this.c.log) this.c.log(o); }
  owner(key) { return this.c.players.find((p) => has(p, key)) || null; }

  // ---- Sala nova (run.enter, depois de começar as ondas) ----
  roomStart(node) {
    this.roomSeq++;
    this.vassalKey = null;
    this.duelKey = null;
    this.curse = null;
    this.bringVassals(node);
    const p = this.owner('curse');
    if (!p || !node || !node.waves) return;
    // Pedido (05/11): o PRIMEIRO inimigo derrotado na sala tem que ser de um tipo sorteado da 1ª onda.
    const types = [];
    for (const [t] of node.waves[0] || []) {
      if (!ENEMIES[t] || ENEMIES[t].boss || ENEMIES[t].phantom || types.includes(t)) continue;
      types.push(t);
    }
    if (!types.length) return;
    const type = types[Math.floor(Math.random() * types.length)];
    this.curse = { p, type, done: false, said: false, t: 0.6, fx: 0 };
  }

  // ---- Sala limpa (run.roomCleared) ----
  roomClear() {
    const carry = [];
    for (const e of this.c.enemies) {
      if (!e.vassal || !e.alive) continue;
      // O que se rendeu nesta sala vai junto para a próxima; o que veio da sala anterior se despede.
      if (!carry.length && !e.carried && e.undead && e.undead.state !== 'dead' && has(e.undead, 'vassal')) {
        carry.push({ type: e.type, hp: e.hp, p: e.undead, hpScale: e.hpScale, dmgScale: e.dmgScale });
        this.c.text.add('Vou com você!', e.position, 'gold', 3.0);
        continue;
      }
      this.c.text.add('Às ordens!', e.position, 'heal', 2.8);
      this.c.vfx.ring(v3(e.position.x, 0, e.position.z), GOLD, 1.4);
      e.die(); undeadDied(this.c, e);
    }
    this.carry = carry.length ? { list: carry, seq: this.roomSeq } : null;
    this.curse = null;
    this.endDuel(false);
  }

  // ---- Inimigo morreu (combat.killed) ----
  // Só vale o primeiro derrotado depois do pedido: era do tipo pedido = prêmio; não era = castigo na hora.
  onKill(e) {
    const k = this.curse;
    if (!k || k.done || !k.said || e.vassal) return;
    k.done = true;
    if (e.type === k.type) this.curseReward(k);
    else this.cursePunish(k, e);
  }

  curseReward(k) {
    const p = k.p;
    this.log({ type: 'curseKill', got: 1 });
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

  cursePunish(k, e) {
    const p = k.p;
    if (p.state === 'dead') return;
    const dmg = Math.min(KIT2.curse.punish, Math.max(0, Math.ceil(p.hp) - 1)); // nunca mata
    if (dmg > 0) { p.hp -= dmg; p.hurtFlash = 1; this.c.text.add(`-${dmg}`, p.position, 'hurt'); if (this.c.hurtFor) this.c.hurtFor(p, dmg); }
    this.c.text.add('A espada te castiga!', p.position, 'bleed', 3.4);
    this.c.vfx.sparks(v3(p.position.x, 1.3, p.position.z), CURSE, 16);
    audio.play('hurt', p.position.x, p.position.z);
    const was = (SINGULAR[e.type] || e.data.name || '').toLowerCase();
    if (this.c.hud) this.c.hud.banner(`A espada: “Eu pedi outro, não um ${was}!”`, 'small');
    this.log({ type: 'cursePunish', dmg });
  }

  // Sala nova: o vassalo da última onda entra junto com o herói (logo atrás dele).
  bringVassals(node) {
    const k = this.carry;
    this.carry = null;
    if (!k || k.seq !== this.roomSeq - 1 || !node || node.kind === 'tavern') return;
    k.list.forEach((v, i) => {
      const p = v.p;
      if (!p || p.state === 'dead' || !has(p, 'vassal') || !ENEMIES[v.type]) return;
      const a = p.facing + Math.PI + (i - (k.list.length - 1) / 2) * 0.7;
      const x = p.position.x + Math.sin(a) * 1.6, z = p.position.z + Math.cos(a) * 1.6;
      const e = this.c.spawn(v.type, x, z, { facing: p.facing, hpScale: v.hpScale, dmgScale: v.dmgScale });
      this.c.world.resolveCircle(e.position, e.data.radius);
      this.surrender(e, p, true);
      e.hp = Math.max(1, Math.min(e.maxHp, v.hp));
    });
  }

  // ---------- Duelo Sagrado ----------
  startDuel(p) {
    const w = this.waves;
    this.duelKey = `${this.roomSeq}:${w ? w.wave : 0}`;
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
      const p = d.p;
      this.c.text.add('Duelo vencido!', p.position, 'gold', 3.4);
      // Prêmio: escudo novo e +10 de vida.
      const fixed = p.hero && p.hero.block ? repairShield(p) : 0;
      const h = p.heal ? p.heal(KIT2.duel.heal) : 0;
      if (h) this.c.text.add(`+${h}`, p.position, 'heal');
      if (fixed) this.c.text.add('Escudo consertado!', p.position, 'block', 2.6);
      this.log({ type: 'duelReward', heal: h, fixed });
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
    // Só 1 vassalo vivo por vez (04/11).
    if (this.c.enemies.some((e) => e.vassal && e.alive)) { this.vassalKey = key; return; }
    const hostile = this.c.enemies.filter((e) => (e.alive || e.finale) && !e.undead);
    if (hostile.length !== 1) return;
    const e = hostile[0];
    if (e.data.boss || e.data.phantom || e.finale || this.inDuel(e) || this.waveSize() < 2) { this.vassalKey = key; return; }
    if (!e.targetable || e.state === 'held' || e.state === 'thrown' || e.frozenT > 0) return; // espera poder se render
    this.vassalKey = key;
    this.surrender(e, p);
  }

  surrender(e, p, carried = false) {
    const d = e.data;
    e.data = { ...d, attackRange: d.ranged ? d.attackRange : Math.max(d.attackRange || 0, 2.0), voice: undefined };
    e.undead = p; e.vassal = true;
    e.noGrave = true; e.noUltCharge = true; e.provokedBy = null; e.darkMark = null;
    if (e.darkFx) { e.darkFx.s.visible = false; e.darkFx.skull.visible = false; }
    if (e.releaseToken) e.releaseToken();
    e.vel.set(0, 0, 0);
    e.hp = Math.max(e.hp, Math.round(e.maxHp * 0.5)); // levanta com pelo menos metade da vida
    e.carried = carried;
    e.setState('hurt');
    e.stunTime = carried ? 0.3 : KIT2.vassal.kneel;
    this.log({ type: 'vassal', enemy: e });
    if (carried) {
      addVassalGear(e);
      this.c.text.add('Vassalo!', e.position, 'gold', 3.4);
      this.c.vfx.ring(v3(e.position.x, 0, e.position.z), GOLD, 1.6);
      return;
    }
    // Cena: o jogo congela, o esqueleto ajoelha na frente do herói e é nomeado cavaleiro com a espada na cabeça.
    if (this.c.ult && this.c.ult.scene) { this.c.ult.scene(this.knightScene(e, p)); return; }
    addVassalGear(e);
    this.c.text.add('Rendeu-se!', e.position, 'gold', 3.4);
  }

  // Cena do Vassalo (ultimate.js: scene). O herói fica parado; o esqueleto vem até ele, ajoelha,
  // o herói encosta a espada na cabeça dele e ele levanta de capa e ombreiras.
  knightScene(e, p) {
    const V = KIT2.vassal, c = this.c;
    const st = { touched: false, dubbed: false, kneel: false, sword: false };
    const hold = (anim, clip, at) => { const a = anim.current; if (a && anim.currentName === clip && a.time >= a.getClip().duration * at) a.timeScale = 0; };
    return {
      p, time: V.scene, zoom: 0.5, actors: [e],
      start() {
        // Lado: o esqueleto fica ao lado do herói (de perfil para a câmera), do lado em que já estava.
        let s = Math.sign(e.position.x - p.position.x) || 1;
        const free = (x) => !c.world.blocked(x, p.position.z, e.data.radius);
        if (!free(p.position.x + s * V.gap) && free(p.position.x - s * V.gap)) s = -s;
        st.from = e.position.clone();
        st.to = v3(p.position.x + s * V.gap, 0, p.position.z);
        c.world.resolveCircle(st.to, e.data.radius);
        this.focus = v3((p.position.x + st.to.x) / 2, 0, p.position.z);
        p.combo = 0; p.queued = false; p.vel.set(0, 0, 0);
        if (p.clearRoll) p.clearRoll();
        p.setState('ultCine');
        p.facing = s > 0 ? Math.PI / 2 : -Math.PI / 2; p.group.rotation.y = p.facing;
        p.anim.play(p.hero.anims.idle, { fade: 0.1 });
        e.facing = Math.atan2(p.position.x - st.to.x, p.position.z - st.to.z);
        e.group.rotation.y = Math.atan2(st.to.x - st.from.x, st.to.z - st.from.z) || e.facing;
        e.anim.play('Skeletons_Walking', { fade: 0.1, restart: true, speed: 1.6 });
        if (c.hud) c.hud.banner('O último esqueleto se rende!', 'small');
        audio.play('rise', e.position.x, e.position.z, { v: 0.7 });
      },
      tick(t) {
        if (t < V.walk) {
          const k = t / V.walk;
          e.position.lerpVectors(st.from, st.to, k * k * (3 - 2 * k));
        } else if (!st.kneel) {
          st.kneel = true;
          e.position.copy(st.to);
          e.group.rotation.y = e.facing;
          const ka = e.anim.play(V.kneelClip, { once: true, restart: true, fade: 0.2, speed: 0.8 });
          ka.time = ka.getClip().duration * V.kneelFrom; // começa já de joelhos (o começo do clipe é deitado)
          c.vfx.dust(v3(e.position.x, 0, e.position.z), v3(0, 1, 0), 6);
        }
        if (st.kneel) hold(e.anim, V.kneelClip, V.kneelAt);
        if (!st.sword && t >= V.walk + 0.15) {
          st.sword = true;
          p.anim.play(V.swordClip, { once: true, restart: true, fade: 0.12, speed: 0.75 });
        }
        if (st.sword) hold(p.anim, V.swordClip, V.swordAt);
        if (!st.touched && t >= V.touch) {
          st.touched = true;
          c.vfx.sparks(v3(e.position.x, 1.0, e.position.z), GOLD, 16);
          audio.play('block', e.position.x, e.position.z, { v: 0.45 });
          c.text.add('Eu te nomeio cavaleiro!', p.position, 'gold', 3.6);
        }
        if (!st.dubbed && t >= V.dub) {
          st.dubbed = true;
          addVassalGear(e);
          c.vfx.ring(v3(e.position.x, 0, e.position.z), GOLD, 1.6);
          c.vfx.burst(e.position.clone(), GOLD);
          audio.play('select', e.position.x, e.position.z, { v: 0.6 });
          c.text.add('Vassalo!', e.position, 'gold', 3.4);
        }
      },
      end() {
        if (!st.dubbed) addVassalGear(e);
        e.position.copy(st.to);
        if (e.alive) {
          e.setState('hurt');
          e.stunTime = e.t + 0.35;
          e.anim.play(e.data.anims.idle || 'Skeletons_Idle', { fade: 0.25 });
        }
        if (p.state !== 'dead') {
          p.setState('idle');
          p.anim.play(p.hero.anims.idle, { fade: 0.2 });
        }
        c.log && c.log({ type: 'vassalScene', enemy: e });
      },
    };
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
    // Enterrados: continuam presos até 2 s depois de desmontar.
    for (const b of this.buried) if (b.p === p) b.t = Math.min(b.t, KIT2.horse.buryAfter);
    this.c.vfx.smoke(p.position, GHOST, 8);
    this.log({ type: 'horseEnd' });
  }

  horseTick(p, dt, world, input, move) {
    const k = kitOf(p), H = KIT2.horse;
    const moving = move.lengthSq() > 0;
    if (moving) p.facing += wrap(Math.atan2(move.x, move.z) - p.facing) * Math.min(1, dt * 5);
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    p.move(fx, fz, H.speed * dt, world);
    // Galope (horse.js): pernas em 4 tempos, corpo, pescoço, crina e cauda.
    const bob = k.horse ? k.horse.animate(p.stateTime, Math.min(1, (H.time - p.stateTime) / 0.3)) : 0;
    p.model.position.y = H.seat + bob * H.scale;
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
      if (e.alive && !e.data.boss) this.bury(e, p, H.time - p.stateTime + H.buryAfter);
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

  // Cavalo Fantasma: o atropelado afunda no chão e fica preso (t = tempo que falta).
  bury(e, p, t) {
    const old = this.buried.find((b) => b.e === e);
    if (old) { old.t = Math.max(old.t, t); return; }
    e.vel.set(0, 0, 0);
    if (e.daze) e.daze(t);
    this.buried.push({ e, p, t, sink: 0 });
    this.c.text.add('Enterrado!', e.position, 'block', 3.0);
    this.c.vfx.dust(v3(e.position.x, 0, e.position.z), v3(0, 1, 0), 8);
    this.log({ type: 'buried', enemy: e });
  }

  updateBuried(dt) {
    const H = KIT2.horse;
    for (let i = this.buried.length - 1; i >= 0; i--) {
      const b = this.buried[i], e = b.e;
      const riding = b.p && b.p.state === 'horse' && kitOf(b.p).horseOn;
      if (!riding) b.t -= dt;
      const done = b.t <= 0 || !e.alive || !this.c.enemies.includes(e) || e.state === 'held' || e.state === 'thrown';
      b.sink = done ? Math.max(0, b.sink - dt * 3) : Math.min(1, b.sink + dt * 6);
      if (e.model) e.model.position.y = -H.sink * b.sink;
      if (done) {
        if (b.sink <= 0) { if (e.model) e.model.position.y = 0; this.buried.splice(i, 1); }
        continue;
      }
      e.vel.set(0, 0, 0);
      // Levou outro golpe (o atordoamento curto troca o nosso): continua preso.
      if (e.state !== 'hurt') { if (!e.daze || !e.daze(b.t)) continue; }
      else if (e.stunTime - e.t < b.t) e.stunTime = e.t + b.t;
    }
  }

  // ---------- Quadro a quadro ----------
  update(dt) {
    const c = this.c;
    for (const p of c.players) {
      const k = p.kit;
    }
    if (this.buried.length) this.updateBuried(dt);
    for (const p of c.players) if (p.kit && p.kit.horseOn && p.state !== 'horse') this.dismount(p); // apanhou/morreu montado
    if (this.duel) {
      const d = this.duel;
      d.t += dt; d.warn = Math.max(0, (d.warn || 0) - dt);
      d.ring.material.opacity = 0.65 + 0.25 * Math.sin(d.t * 5);
      d.wall.material.opacity = 0.12 + 0.06 * Math.sin(d.t * 3);
    }
    // Duelo: começa quando cada onda termina de nascer (menos com chefe na sala).
    const w = this.waves, dp = this.owner('duel');
    if (dp && !this.duel && w && w.state === 'fighting' && !w.queue.length && w.wave >= 0 && this.duelKey !== `${this.roomSeq}:${w.wave}`) {
      if (c.enemies.some((e) => e.alive && e.data.boss)) this.duelKey = `${this.roomSeq}:${w.wave}`;
      else if (c.enemies.some((e) => e.alive && !e.undead && e.targetable)) this.startDuel(dp);
    }
    this.checkVassal();
    if (this.flying.length) this.updateFlying(dt);
    // Espada Amaldiçoada: anuncia o pedido e solta faíscas roxas enquanto não for atendida.
    const k = this.curse;
    if (k && k.p.state !== 'dead') {
      if (!k.said && (k.t -= dt) <= 0) {
        k.said = true;
        const name = (SINGULAR[k.type] || ENEMIES[k.type].name).toLowerCase();
        c.text.add(`“O primeiro: um ${name}!”`, k.p.position, 'bleed', 3.6);
        if (c.hud) c.hud.banner(`A espada fala: “O primeiro a cair tem que ser um ${name}!”`, 'small');
        c.vfx.sparks(v3(k.p.position.x, 1.4, k.p.position.z), CURSE, 14);
        audio.play('rise', k.p.position.x, k.p.position.z, { v: 0.5 });
        this.log({ type: 'curseAsk', kind: k.type });
      }
      if (k.said && !k.done && (k.fx -= dt) <= 0 && k.p.weapon && k.p.weapon.visible) {
        k.fx = 0.25;
        const wp = k.p.weapon.getWorldPosition(new THREE.Vector3());
        c.vfx.sparks(wp, CURSE, 1);
      }
    }
  }

  clear() {
    for (const b of this.buried) if (b.e.model) b.e.model.position.y = 0;
    this.buried.length = 0;
    for (const it of this.flying) this.scene.remove(it.obj);
    this.flying.length = 0;
    if (this.duel) { this.scene.remove(this.duel.g); this.duel = null; }
    for (const p of this.c.players) if (p.kit && p.kit.horseOn) { if (p.state === 'horse') { p.setState('idle'); p.anim.play(p.hero.anims.idle, { fade: 0.1 }); } this.dismount(p); }
  }
}
