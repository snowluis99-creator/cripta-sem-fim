// Combate: quem acerta quem, dano, empurrão, pausa no impacto (hitstop), números de dano e tremida.
import * as THREE from 'three';
import { Enemy } from './enemies.js';
import { Hazards } from './hazards.js';
import { Projectiles } from './projectiles.js';
import { audio } from './audio.js';
import { BossFinale } from './finale.js';
import { useShield } from './shield.js';
import { vanishPhantom, GHOST_STATES } from './shadow.js';
import { castSpell } from './magic.js';

const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const tmp = new THREE.Vector3();

// Ajustes de "sensação" do combate.
// Esbarrão perdoado (Manopla): grace = tempo em que o mesmo encostão não conta; window = até quando um 2º machuca.
const BUMP = { grace: 0.5, window: 1.6, push: 3 };

export const FEEL = {
  hitstop: 0.055,       // pausa num golpe normal (s)
  hitstopHeavy: 0.11,   // pausa no golpe forte
  hitstopKill: 0.03,    // extra quando mata
  hitstopHurt: 0.08,    // quando o herói apanha
  shakeHit: 0.1,
  shakeHeavy: 0.35,
  shakeHurt: 0.3,
  push: 5,              // empurrão de golpe normal
  pushHeavy: 10,
  heavyRadius: 2.3,     // área do golpe forte em volta do ponto de impacto
};

// Números de dano (HTML por cima do jogo: nítido e barato).
class FloatingText {
  constructor() {
    this.layer = document.getElementById('fxtext');
    this.items = [];
  }

  add(text, pos, cls, height = 2.4) {
    const el = document.createElement('div');
    el.className = `ft ${cls}`;
    el.textContent = text;
    this.layer.appendChild(el);
    const say = cls.includes('say');
    const drift = say ? 0 : (Math.random() - 0.5) * 0.8;
    this.items.push({ el, x: pos.x + drift, y: height, z: pos.z, age: 0, life: say ? 2.6 : cls.includes('big') ? 1.0 : 0.8, rise: say ? 0.5 : 1.4, say });
  }

  update(dt, camera) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      const k = it.age / it.life;
      if (k >= 1) { it.el.remove(); this.items.splice(i, 1); continue; }
      tmp.set(it.x, it.y + it.rise * (1 - (1 - k) ** 2), it.z).project(camera);
      const sx = (tmp.x * 0.5 + 0.5) * innerWidth, sy = (-tmp.y * 0.5 + 0.5) * innerHeight;
      const pop = it.say ? (k < 0.06 ? 0.7 + (k / 0.06) * 0.3 : 1) : k < 0.12 ? 0.6 + (k / 0.12) * 0.7 : 1.3 - Math.min((k - 0.12) * 1.5, 0.3);
      it.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%) scale(${pop.toFixed(3)})`;
      it.el.style.opacity = k > (it.say ? 0.85 : 0.7) ? ((1 - k) / (it.say ? 0.15 : 0.3)).toFixed(2) : '1';
    }
  }

  clear() { this.items.forEach((it) => it.el.remove()); this.items.length = 0; }
}

export class Combat {
  constructor({ scene, player, world, vfx, debris, cam, hud }) {
    Object.assign(this, { scene, player, world, vfx, debris, cam, hud });
    this.enemies = [];
    this.players = [player]; // co-op: [anfitrião, Jogador 2]
    this.text = new FloatingText();
    this.hitstop = 0;
    this.attackers = 0;
    this.maxAttackers = Infinity; // todos os esqueletos podem atacar ao mesmo tempo (pedido do dono)
    this.kills = 0;
    this.ice = [];           // poças de gelo: { x, z, r, age, life }
    this.onKill = null;
    this.onSummon = null;    // chefe invocando esqueletos: (chefe, lista)
    this.log = null;
    this.hazards = new Hazards(scene, vfx, this.text);
    this.hazards.world = world;
    this.projectiles = new Projectiles(scene, this); // flechas dos arqueiros, do Guardião e do mercador
    this.merchant = null;    // o Mercador (na sala dele): pode apanhar e revidar
    this.graves = [];        // restos de esqueletos (o Mago Esqueleto revive)
    this.finale = new BossFinale(this); // morte com cena do Rei Skullbone
  }

  // Heróis vivos (co-op: os dois).
  get alivePlayers() { return this.players.filter((p) => p.state !== 'dead'); }

  // Herói vivo mais perto de (x, z). Sem ninguém vivo: o primeiro.
  nearestPlayer(x, z) {
    let best = null, bd = Infinity;
    for (const p of this.alivePlayers) {
      const d = Math.hypot(p.position.x - x, p.position.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best || this.players[0];
  }

  // Quem o esqueleto persegue: o herói mais perto (troca de alvo só de vez em quando, com folga).
  pickTarget(e, dt) {
    const alive = this.alivePlayers;
    if (alive.length <= 1) return alive[0] || this.players[0];
    e.retarget = (e.retarget || 0) - dt;
    const cur = e.target;
    if (cur && alive.includes(cur) && e.retarget > 0) return cur;
    e.retarget = 1 + Math.random();
    const dist = (p) => Math.hypot(p.position.x - e.position.x, p.position.z - e.position.z);
    let best = alive.reduce((a, b) => (dist(a) <= dist(b) ? a : b));
    if (cur && alive.includes(cur) && dist(cur) < dist(best) + 2.5) best = cur;
    return best;
  }

  // Mago/Necromante revivendo um esqueleto caído.
  reviveGrave(g) {
    const i = this.graves.indexOf(g);
    if (i < 0) return null;
    this.graves.splice(i, 1);
    const p = this.nearestPlayer(g.x, g.z).position;
    const e = this.spawn(g.type, g.x, g.z, {
      revived: true, spawnAnim: 'Skeletons_Death_Resurrect', hpScale: g.hpScale, dmgScale: g.dmgScale,
      facing: Math.atan2(p.x - g.x, p.z - g.z),
    });
    this.vfx.beam(e.position);
    this.vfx.smoke(e.position, 0x7dff8a, 8);
    this.text.add('Reviveu!', e.position, 'heal', 2.8);
    if (this.log) this.log({ type: 'revived', enemy: e });
    return e;
  }

  // Reflexo: escapou rolando -> golpes mais rápidos por 3 s.
  reflex(p = this.player) {
    if (!p.stats.reflex) return;
    if (!(p.reflexTime > 0)) this.text.add('Reflexo!', p.position, 'crit', 3.4);
    p.reflexTime = 3;
  }

  // Dano do herói que não vem do golpe direto (raio, explosão, onda). Não atordoa os resistentes.
  bonusDamage(e, dmg, nx, nz, cls = 'dmg', by = null) {
    if (!e.targetable || e.immune) return;
    if (by) e.lastHitBy = by;
    const died = e.takeDamage(dmg, nx, nz, 2, false, !!(by && by.hero && by.hero.caster));
    this.text.add(String(dmg), e.position, cls, 2.0);
    if (this.log) this.log({ type: 'bonus', enemy: e, dmg, died });
    if (died) this.killed(e, nx, nz);
  }

  // Corrente de Raios: pula para os esqueletos mais perto.
  chainLightning(from, n, p = this.player) {
    let cur = from;
    const done = new Set([from]);
    for (let i = 0; i < n; i++) {
      let best = null, bd = 6;
      for (const o of this.enemies) {
        if (done.has(o) || !o.targetable) continue;
        const d = Math.hypot(o.position.x - cur.position.x, o.position.z - cur.position.z);
        if (d < bd) { bd = d; best = o; }
      }
      if (!best) break;
      done.add(best);
      this.vfx.bolt(new THREE.Vector3(cur.position.x, 1.3, cur.position.z), new THREE.Vector3(best.position.x, 1.3, best.position.z));
      const dx = best.position.x - cur.position.x, dz = best.position.z - cur.position.z, d = Math.hypot(dx, dz) || 1;
      cur = best;
      this.bonusDamage(best, Math.round(12 * p.stats.damageMul), dx / d, dz / d, 'burn', p);
    }
  }

  // Ossos Explosivos.
  boneBlast(pos, dmg, p = this.player) {
    const at = new THREE.Vector3(pos.x, 0, pos.z);
    this.vfx.heavyImpact(at, 1.1);
    this.vfx.sparks(new THREE.Vector3(pos.x, 1, pos.z), 0xffd36a, 10);
    for (const o of [...this.enemies]) {
      if (!o.targetable) continue;
      const dx = o.position.x - pos.x, dz = o.position.z - pos.z, d = Math.hypot(dx, dz);
      if (d > 2.6 + o.data.radius) continue;
      this.bonusDamage(o, Math.round(dmg * p.stats.damageMul), dx / (d || 1), dz / (d || 1), 'dmg', p);
    }
  }

  // Eco do Golpe: onda que sai para a frente e atravessa os esqueletos.
  echoWave(p, dmg) {
    const a = p.facing;
    this.projectiles.fire(p.position.x + Math.sin(a) * 1.2, p.position.z + Math.cos(a) * 1.2, a, {
      speed: 16, damage: dmg, kind: 'wave', color: 0xffd36a, hits: 'hero', pierce: true, height: 0.6, life: 0.7, scale: 1.6, owner: p,
    });
  }

  spawn(type, x, z, opts) {
    const e = new Enemy(type, x, z, opts);
    e.id = (this.enemySeq = (this.enemySeq || 0) + 1); // co-op: identifica o esqueleto na rede
    e.dmgScale = opts?.dmgScale || 1;
    e.hpScale = opts?.hpScale || 1;
    e.damage = Math.round(e.data.damage * e.dmgScale);
    e.combat = this;
    this.scene.add(e.group);
    this.enemies.push(e);
    return e;
  }

  // Vivos (o chefe no meio da cena de morte conta: a sala só termina quando a cena acaba).
  get aliveCount() { return this.enemies.filter((e) => e.alive || e.finale).length; }

  addHitstop(t) { this.hitstop = Math.max(this.hitstop, t); }

  // Devolve o dt da simulação (0 durante o hitstop).
  simDt(dt) {
    if (this.hitstop > 0) { this.hitstop -= dt; return 0; }
    return dt;
  }

  // Golpe do herói (chamado no momento do impacto do golpe).
  playerStrike(p, step) {
    const h = p.hero;
    if (step.cast) { castSpell(this, p, step); return; } // Maga: a magia sai daqui (magic.js)
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    const st = p.stats;
    const range = h.attackRange * st.rangeMul;
    // Ponto do impacto: um pouco à frente (lança: bem mais longe; manopla: mais perto).
    const reach = Math.min(1.7, range * 0.65) + (h.single ? range * 0.3 : 0);
    const impact = new THREE.Vector3(p.position.x + fx * reach, 0, p.position.z + fz * reach);
    const blastMul = (step.blastMul || 1) * st.heavyRadiusMul;
    const heavyRadius = h.single ? 0 : FEEL.heavyRadius * blastMul; // lança: o golpe forte também acerta só 1
    const arc = (step.arc || h.attackArc) / 2 * DEG;
    if (step.heavy) { this.vfx.heavyImpact(impact, h.single ? 0.6 : blastMul); this.shakeFor(p, FEEL.shakeHeavy); }
    let hits = 0, kills = 0;
    // Lança: só o inimigo mais perto dentro da faixa da frente.
    let only = null;
    if (h.single) {
      let best = Infinity;
      for (const e of this.enemies) {
        if (!e.targetable) continue;
        const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, dist = Math.hypot(dx, dz) || 0.001;
        if (dist <= range + e.data.radius && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) <= arc && dist < best) { best = dist; only = e; }
      }
    }
    if (step.heavy && st.echo > 0) this.echoWave(p, Math.round(st.echo * st.damageMul));
    for (const e of [...this.enemies]) {
      if (!e.targetable) continue;
      if (h.single && e !== only) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const inArc = dist <= range + e.data.radius
        && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) <= arc;
      const inBlast = step.heavy && Math.hypot(e.position.x - impact.x, e.position.z - impact.z) <= heavyRadius + e.data.radius;
      if (!inArc && !inBlast) continue;
      const r = this.damageEnemy(p, e, step, dx / dist, dz / dist);
      if (r) { hits++; if (r === 'kill') kills++; }
    }
    this.endCounter(p, hits);
    // O Mercador também apanha do herói (e revida).
    const m = this.merchant;
    if (m && m.alive && !(h.single && only)) {
      const dx = m.position.x - p.position.x, dz = m.position.z - p.position.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const inArc = dist <= range + m.radius && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) <= arc;
      const inBlast = step.heavy && Math.hypot(m.position.x - impact.x, m.position.z - impact.z) <= heavyRadius + m.radius;
      if (inArc || inBlast) {
        m.hit(Math.round(step.damage * st.damageMul * (0.9 + Math.random() * 0.2)), p);
        hits++;
      }
    }
    if (this.log) this.log({ type: 'swing', hits, heavy: !!step.heavy });
    if (hits) {
      audio.play(step.heavy ? 'hitHeavy' : 'hit', impact.x, impact.z);
      this.addHitstop((step.heavy ? FEEL.hitstopHeavy : FEEL.hitstop) + (kills ? FEEL.hitstopKill : 0));
      if (!step.heavy) this.shakeFor(p, FEEL.shakeHit + kills * 0.08);
    }
  }

  // Contra-Ataque usado (o golpe inteiro dobrou o dano).
  endCounter(p, hits) {
    if (p.counterReady && hits) { p.counterReady = false; this.text.add('Contra-ataque!', p.position, 'crit', 3.4); }
  }

  // Um esqueleto atingido por um golpe (ou magia) do herói. Devolve 'kill' | 'hit' | 'blocked' | 'immune' (false = nada).
  // opts.spell: magia da Maga (o escudo do Guerreiro também segura, menos a magia forte).
  damageEnemy(p, e, step, nx, nz, opts = {}) {
    if (!e.targetable) return false;
    const st = p.stats;
    e.lastHitBy = p;
    const chest = new THREE.Vector3(e.position.x, 1.2, e.position.z);
    if (e.immune) {
      // Imune (Rei Skullbone indo para o meio da sala): o golpe bate e não tira vida.
      audio.play('block', e.position.x, e.position.z);
      this.vfx.sparks(chest.set(e.position.x - nx * 0.8, 1.6, e.position.z - nz * 0.8), 0xffd36a, 10);
      this.text.add('Imune!', e.position, 'miss', 2.4 + 1.6 * (e.group.scale.x - 1));
      this.addHitstop(0.03);
      if (this.log) this.log({ type: 'immune', enemy: e });
      return 'immune';
    }
    if (!step.heavy && e.shieldCovers(p.position.x, p.position.z)) {
      // Escudo do Guerreiro: sem dano. Magia não para o esqueleto (ele segue andando com o escudo levantado).
      if (!opts.spell) e.blockHit(nx, nz);
      audio.play('block', e.position.x, e.position.z);
      this.vfx.sparks(chest.set(e.position.x - nx * 0.6, 1.2, e.position.z - nz * 0.6), 0xcfe4ff, 8);
      this.text.add('Bloqueou!', e.position, 'block');
      this.addHitstop(0.04);
      this.shakeFor(p, 0.08);
      if (this.log) this.log({ type: 'blocked', enemy: e });
      return 'blocked';
    }
    // Contra-Ataque: o golpe depois de um bloqueio dá dano dobrado.
    const counter = p.counterReady ? 2 : 1;
    const baseMul = st.damageMul * (st.fury && p.lowHp ? 1.6 : 1) * (1 + st.reaperStacks * 0.02) * counter;
    const guardBreak = step.heavy && e.data.staggerOnlyHeavy && e.shieldCovers(p.position.x, p.position.z);
    const crit = Math.random() < st.critChance;
    const exec = st.execute > 0 && e.hp < e.maxHp * 0.3 ? 1 + st.execute : 1;
    const dmg = Math.round(step.damage * baseMul * exec * (crit ? 2 : 1) * (0.9 + Math.random() * 0.2));
    const push = (step.heavy ? FEEL.pushHeavy * st.heavyPushMul : FEEL.push) * (opts.spell ? 0.6 : 1);
    const died = e.takeDamage(dmg, nx, nz, push, step.heavy, !!opts.spell);
    this.text.add(crit ? `${dmg}!` : String(dmg), e.position, step.heavy || crit ? 'dmg big' : 'dmg');
    if (crit) this.text.add('Crítico!', e.position, 'crit', 3.4);
    if (step.heavy && st.burnDps > 0 && !died) { e.burn = 3; e.burnDps = st.burnDps; e.burnTick = 0.5; e.burnBy = p; }
    if (guardBreak && !opts.spell) this.text.add('Guarda quebrada!', e.position, 'block', 3.3);
    if (!opts.spell) this.vfx.sparks(chest, step.heavy ? 0xffb050 : 0xffffff, step.heavy ? 10 : 6);
    if (this.log) this.log({ type: 'hit', enemy: e, dmg, died, spell: !!opts.spell });
    if (died) this.killed(e, nx, nz, p);
    if (crit && st.chain > 0) this.chainLightning(e, st.chain + 1, p);
    return died ? 'kill' : 'hit';
  }

  // Dano do fogo (Lâmina Flamejante): não atordoa nem empurra.
  burnDamage(e, dmg) {
    if (e.immune) return;
    e.hp -= dmg;
    e.flash = Math.max(e.flash, 0.4);
    this.text.add(String(dmg), e.position, 'burn', 2.0);
    this.vfx.sparks(new THREE.Vector3(e.position.x, 1.0, e.position.z), 0xff6a1a, 4);
    if (e.hp <= 0) { e.die(); this.killed(e, 0, 1, e.burnBy); }
  }

  // Tremida só na tela de um jogador (co-op: o outro não treme com o golpe do parceiro).
  shakeFor(p, amount) { if (p && p.ux) p.ux.shake(amount); else this.cam.shake(amount); }

  // by = herói que matou (ouro, Sede de Sangue e Ceifador vão para ele).
  killed(e, nx, nz, by = null) {
    if (e.data.phantom) { vanishPhantom(e, this); return; } // cópia do Ceifador: só fumaça
    this.kills++;
    by = by || e.lastHitBy || this.player;
    const st = by.stats;
    if (st.reaper && st.reaperStacks < 25) st.reaperStacks++;
    // Restos que o Mago Esqueleto pode reviver (só uma vez por esqueleto; chefes não).
    if (!e.revived && !e.data.boss && !e.noGrave) this.graves.push({ type: e.type, x: e.position.x, z: e.position.z, age: 0, hpScale: e.hpScale, dmgScale: e.dmgScale });
    if (st.boneBlast > 0 && !e.blasted) { e.blasted = true; this.boneBlast(e.position, st.boneBlast, by); }
    // Chefe morreu: os esqueletos invocados desmoronam juntos.
    if (e.data.final || e.data.finale) {
      this.graves.length = 0;
      for (const o of this.enemies) if (o !== e && o.alive) { o.noGrave = true; o.blasted = true; o.die(); this.killed(o, 0, 1, by); }
      this.projectiles.clear();
      this.hazards.clear();
    }
    if (st.lifeOnKill > 0 && by.state !== 'dead' && by.hp < by.maxHp) {
      const before = by.hp;
      by.hp = Math.min(by.maxHp, by.hp + st.lifeOnKill);
      this.text.add(`+${by.hp - before}`, by.position, 'heal small');
    }
    // A arma cai da mão e alguns ossos voam na hora; o corpo desmorona com a animação.
    for (const w of e.weapons) this.debris.drop(w, nx, nz);
    e.weapons.length = 0;
    e.deathTimer = 0;
    audio.play('crunch', e.position.x, e.position.z);
    // Rei Skullbone: em vez de desmontar na hora, a cena (vai até o herói, perde a cabeça, agarra...).
    if (e.data.finale && !this.finale.active) this.finale.start(e, by);
    if (this.onKill) this.onKill(e, by);
  }

  // Ataque de um esqueleto (no momento do impacto).
  enemyStrike(e) {
    const a = e.atk || e.data.attack;
    const dmg = a.damage ? Math.round(a.damage * e.dmgScale) : e.damage;
    const inReach = (pos, r) => {
      const dx = pos.x - e.position.x, dz = pos.z - e.position.z;
      return Math.hypot(dx, dz) <= a.reach + r && Math.abs(wrap(Math.atan2(dx, dz) - e.facing)) <= (a.arc / 2) * DEG;
    };
    // O golpe pode pegar o Mercador sem querer (ele revida).
    const m = this.merchant;
    if (m && m.alive && inReach(m.position, m.radius)) m.hit(dmg, e);
    // O golpe pega qualquer herói no alcance (co-op: pode pegar os dois).
    for (const p of this.alivePlayers) if (inReach(p.position, p.hero.radius)) this.hitPlayer(e, dmg, { target: p });
  }

  // Flecha do Mercador acertou um esqueleto.
  merchantShot(e, dmg, nx, nz) {
    const died = e.takeDamage(dmg, nx, nz, FEEL.push, false);
    this.text.add(String(dmg), e.position, 'dmg');
    this.vfx.sparks(new THREE.Vector3(e.position.x, 1.2, e.position.z), 0x7dff8a, 8);
    if (this.log) this.log({ type: 'merchantShot', enemy: e, dmg, died });
    if (died) this.killed(e, nx, nz, e.lastHitBy);
  }

  // Dano no herói vindo do inimigo (golpe, investida, giro, encostar, flecha). opts: { push, noRepel, contact, unDodgeable }
  // opts.target = qual herói (co-op); sem ele, o alvo do esqueleto.
  hitPlayer(e, base, opts = {}) {
    const p = opts.target || (e.target && this.players.includes(e.target) ? e.target : this.player);
    if (p.state === 'dead') return false;
    // unDodgeable (giro do Guardião enfurecido): rolar não salva, só o escudo.
    if (p.invulnerable && !(opts.unDodgeable && p.state === 'dodge')) {
      if (p.state === 'dodge' && !opts.contact) { this.text.add('Esquivou!', p.position, 'miss'); this.reflex(p); audio.play('miss', p.position.x, p.position.z); }
      if (this.log) this.log({ type: 'dodged' });
      return false;
    }
    const dx = p.position.x - e.position.x, dz = p.position.z - e.position.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;
    if (p.blocksFrom(e.position.x, e.position.z)) {
      // Bloqueio do Cavaleiro: protege 100% do dano, mas gasta o escudo (quebra depois de 10 bloqueios).
      const res = useShield(p, this, e);
      p.blockedHit(0, nx, nz);
      if (p.stats.counter) p.counterReady = true;
      if (p.stats.thorns > 0 && e.alive && !opts.contact) {
        // Escudo de Espinhos: devolve dano ao atacante.
        e.hp -= p.stats.thorns;
        e.flash = 1;
        this.text.add(String(p.stats.thorns), e.position, 'dmg');
        if (e.hp <= 0) { e.die(); this.killed(e, -nx, -nz, p); }
      }
      // Aparar: atordoa o atacante (chefes também, um pouco).
      if (res === 'parry' && e.alive && e.repelled && !opts.noRepel) { e.repelled(-nx, -nz); if (e.data.boss) e.stunTime = 0.35; }
      else if (e.alive && !opts.noRepel && !e.data.boss) e.repelled(-nx, -nz);
      this.vfx.sparks(new THREE.Vector3(p.position.x - nx * 0.7, 1.3, p.position.z - nz * 0.7), res === 'parry' ? 0xffe27a : 0xcfe4ff, res === 'parry' ? 16 : 10);
      if (res !== 'break') this.text.add(res === 'parry' ? 'Aparou!' : 'Bloqueou!', p.position, res === 'parry' ? 'crit' : 'block');
      this.addHitstop(res === 'parry' ? 0.09 : 0.06);
      this.shakeFor(p, 0.12);
      this.hurtFor(p, 0.2);
      if (res === 'break') { p.setState('hurt'); p.anim.play(p.hero.anims.hit, { once: true, speed: 1.6, fade: 0.05, restart: true }); }
      if (this.log) this.log({ type: 'blockedHero', dmg: 0, res });
      return true;
    }
    // Escudo Espectral: anula o golpe.
    if (p.spectralReady) {
      p.spectralCd = 12;
      p.iframes = Math.max(p.iframes, 0.4);
      this.text.add('Anulado!', p.position, 'block');
      this.vfx.burst(p.position, 0x8fd0ff);
      if (this.log) this.log({ type: 'spectral' });
      return false;
    }
    const dmg = Math.max(1, Math.round(base * p.stats.damageTaken));
    p.hurt(dmg, nx, nz, opts.push);
    this.text.add(String(dmg), p.position, opts.contact ? 'hurt small' : 'hurt');
    this.addHitstop(opts.contact ? 0.04 : FEEL.hitstopHurt);
    this.shakeFor(p, opts.contact ? 0.15 : FEEL.shakeHurt);
    this.hurtFor(p, opts.contact ? 0.6 : 1);
    if (this.log) this.log({ type: opts.contact ? 'contact' : 'heroHit', dmg, enemy: e });
    return true;
  }

  // Manopla (bumpGuard): o 1º esbarrão não machuca. Depois dele, 0,5 s em que o mesmo encostão não conta
  // e até 1,6 s em que um 2º esbarrão machuca normalmente. Só vale para encostar (golpes/investidas machucam sempre).
  bumpForgiven(p, e) {
    if (!p.hero.bumpGuard) return false;
    if (p.bumpGrace > 0) return true;
    if (p.bumpWindow > 0) { p.bumpWindow = 0; return false; }
    p.bumpGrace = BUMP.grace;
    p.bumpWindow = BUMP.window;
    if (e) { // empurrãozinho para desgrudar (sem atordoar)
      const dx = p.position.x - e.position.x, dz = p.position.z - e.position.z, d = Math.hypot(dx, dz) || 1;
      p.vel.set(dx / d, 0, dz / d).multiplyScalar(BUMP.push);
    }
    this.text.add('Esbarrão', p.position, 'miss');
    if (this.log) this.log({ type: 'bumpForgiven' });
    return true;
  }

  hurtFor(p, amount) { if (p.ux) p.ux.hurt(amount); else this.hud.hurt(amount); }

  // Corpos se empurrando (sem ficar uns dentro dos outros).
  separate() {
    const list = this.enemies.filter((e) => e.alive && e.state !== 'spawn' && e.state !== 'leap');
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z;
        const min = a.data.radius + b.data.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), push = (min - d) / 2;
        a.position.x -= (dx / d) * push; a.position.z -= (dz / d) * push;
        b.position.x += (dx / d) * push; b.position.z += (dz / d) * push;
      }
      // Herói: durante o rolamento atravessa os esqueletos. Invisível/na sombra: passa por ele sem encostar.
      if (GHOST_STATES.has(a.state)) continue;
      for (const p of this.players) {
        if (p.state === 'dodge' || p.state === 'dead') continue;
        const dx = a.position.x - p.position.x, dz = a.position.z - p.position.z;
        const min = a.data.radius + p.hero.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-6) continue;
        // Encostar num esqueleto machuca (pouco).
        if (a.abilities && a.data.contact && a.state !== 'leap' && a.state !== 'attack' && a.targetable && !p.invulnerable) { // atacando: quem machuca é o golpe
          if (!this.bumpForgiven(p, a)) this.hitPlayer(a, Math.round(a.data.contact * a.dmgScale), { contact: true, push: 6, noRepel: true, target: p });
        }
        const d = Math.sqrt(d2), push = min - d;
        a.position.x += (dx / d) * push * 0.75; a.position.z += (dz / d) * push * 0.75;
        p.position.x -= (dx / d) * push * 0.25; p.position.z -= (dz / d) * push * 0.25;
      }
    }
    // Os dois heróis também não ficam um dentro do outro (mas não se machucam).
    if (this.players.length > 1) {
      const [a, b] = this.players;
      if (a.state !== 'dead' && b.state !== 'dead' && a.state !== 'dodge' && b.state !== 'dodge') {
        const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z;
        const min = a.hero.radius + b.hero.radius, d = Math.hypot(dx, dz);
        if (d < min && d > 1e-4) {
          const push = (min - d) / 2;
          a.position.x -= (dx / d) * push; a.position.z -= (dz / d) * push;
          b.position.x += (dx / d) * push; b.position.z += (dz / d) * push;
        }
      }
    }
  }

  // Ninguém atravessa o Mercador (ele é empurrado por ninguém: fica no lugar).
  separateMerchant() {
    const m = this.merchant;
    if (!m) return;
    const bodies = this.enemies.filter((e) => e.alive && e.state !== 'spawn' && e.state !== 'leap')
      .map((e) => ({ pos: e.position, r: e.data.radius }));
    for (const p of this.players) if (p.state !== 'dodge') bodies.push({ pos: p.position, r: p.hero.radius });
    for (const b of bodies) {
      const dx = b.pos.x - m.position.x, dz = b.pos.z - m.position.z;
      const min = m.radius + b.r, d = Math.hypot(dx, dz);
      if (d >= min || d < 1e-6) continue;
      b.pos.x += (dx / d) * (min - d); b.pos.z += (dz / d) * (min - d);
    }
  }

  update(dt) {
    const ctx = { player: this.player, world: this.world, combat: this };
    // Gelo no chão (Rastro de Gelo): deixa os esqueletos lentos.
    for (let i = this.ice.length - 1; i >= 0; i--) {
      const z = this.ice[i];
      z.age += dt;
      if (z.age >= z.life) { this.ice.splice(i, 1); continue; }
      for (const e of this.enemies) {
        if (e.alive && Math.hypot(e.position.x - z.x, e.position.z - z.z) < z.r + e.data.radius) e.slow = 1.5;
      }
    }
    for (let i = this.graves.length - 1; i >= 0; i--) if ((this.graves[i].age += dt) > 14) this.graves.splice(i, 1);
    for (const e of this.enemies) {
      if (e.alive) e.target = this.pickTarget(e, dt);
      ctx.player = e.target || this.player;
      e.update(dt, ctx);
    }
    this.separate();
    this.separateMerchant();
    if (this.merchant) this.merchant.update(dt);
    this.hazards.update(dt, this.players);
    this.projectiles.update(dt);
    this.finale.update(dt);
    // Trava de segurança: ninguém fica fora da sala (salto, investida, cena do chefe...).
    const w = this.world;
    if (w && w.bounds) {
      for (const e of this.enemies) w.clampInside(e.position, e.data.radius);
      for (const p of this.players) w.clampInside(p.position, p.hero.radius);
    }
    // Mortos: desmontam em ossos e somem.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.alive || e.finale) continue;
      e.deathTimer = (e.deathTimer || 0) + dt;
      if (!e.shattered && e.deathTimer >= 0.75) {
        e.shattered = true;
        e.group.visible = false;
        const by = e.lastHitBy || this.player;
        const dx = e.position.x - by.position.x, dz = e.position.z - by.position.z;
        const d = Math.hypot(dx, dz) || 1;
        this.debris.skeleton(e.position, dx / d, dz / d, e.type !== 'minion');
        this.vfx.puff(e.position);
        audio.play('bones', e.position.x, e.position.z);
      }
      if (e.deathTimer > 1.2) { this.scene.remove(e.group); this.enemies.splice(i, 1); }
    }
  }

  clear() {
    this.finale.cancel();
    for (const e of this.enemies) { if (e.boneSword) { e.boneSword.shatter(true); e.boneSword = null; } this.scene.remove(e.group); }
    this.enemies.length = 0;
    this.attackers = 0;
    this.ice.length = 0;
    this.hazards.clear();
    this.projectiles.clear();
    this.merchant = null;
    this.graves.length = 0;
    this.text.clear();
    this.hitstop = 0;
  }
}
