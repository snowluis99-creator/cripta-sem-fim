// Combate: quem acerta quem, dano, empurrão, pausa no impacto (hitstop), números de dano e tremida.
import { statDamage, statKill } from './runstats.js';
import { Breakables } from './props.js';
import { coopDamageMul, coopAfterHit, coopTakeCrit, coopTakenMul, coopAngel, coopOnHurt } from './coopbless.js';
import * as THREE from 'three';
import { tactics } from './brain.js';
import { Enemy } from './enemies.js';
import { Hazards } from './hazards.js';
import { Projectiles } from './projectiles.js';
import { audio } from './audio.js';
import { BossFinale } from './finale.js';
import { useShield } from './shield.js';
import { vanishPhantom, GHOST_STATES } from './shadow.js';
import { castSpell } from './magic.js';
import { markDark, onEnemyKilled, undeadTarget, undeadHit, hitUndead, undeadDied, undeadTick, undeadLook } from './undead.js';
import { wbDamage, wbOnHit, wbOnSwing, wbOnKill, wbOnShatter, wbOnBlock, wbTick } from './wbhooks.js';
import { KnightKit, kitStrike, kitOnSwing, kitGuard, kitOnRepel } from './knightkit.js';
import { KnightKit2 } from './knightkit2.js';
import { AxeKit, axeStrike, axeRangeMul, axeAfterStrike } from './axekit.js';

const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const tmp = new THREE.Vector3();

// Ajustes de "sensação" do combate.
// Esbarrão perdoado (Manopla): grace = tempo em que o mesmo encostão não conta; window = até quando um 2º machuca.
const BUMP = { grace: 0.5, window: 1.6, push: 3 };
// Escudo do Cavaleiro rebatendo um golpe: o inimigo fica desequilibrado (mesmos números do escudo do Guerreiro).
const SHIELD_BASH = { time: 0.6, push: 9 };
// Choque do Escudo: todo bloqueio do Cavaleiro atordoa de leve quem está em volta (raio) e empurra um pouco.
const SHIELD_SHOCK = { radius: 3.2, stun: 0.55, push: 5 };

const NO_BODY = new Set(['spawn', 'leap', 'held', 'thrown', 'roll', 'hop']); // sem corpo (não empurra nem é empurrado)
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
    this.props = new Breakables(this);  // barris, caixas, baús... que quebram (props.js)
    this.axe = new AxeKit(this);         // bênçãos do Machado: machado arremessado, Redemoinho, Rolagem Giratória (axekit.js)
    this.kit = new KnightKit(this);     // bênçãos da Espada e Escudo: escudo/espada arremessados, gancho, bolas (knightkit.js)
    this.kit2 = new KnightKit2(this);   // 2ª leva: Duelo Sagrado, Vassalo, Mesa Virada, Cavalo Fantasma, Espada Amaldiçoada
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
    if (e.undead) return undeadTarget(this, e); // morto-vivo da Maga: o inimigo mais perto
    // Apanhou de um morto-vivo: vai atrás dele (só depois de apanhar).
    if (e.provokedBy) { if (e.provokedBy.alive) return e.provokedBy; e.provokedBy = null; }
    // Ladino invisível (bomba de fumaça): os esqueletos procuram outro alvo, se houver.
    const seen = this.alivePlayers.filter((p) => !(p.stealth > 0));
    const alive = [...(seen.length ? seen : this.alivePlayers)];
    // Mercador contratado: os esqueletos comuns também vão atrás dele (chefes não).
    const m = this.merchant;
    if (m && m.ally && m.alive && m.state !== 'leave' && m.state !== 'gone' && !e.data.boss) alive.push(m);
    if (alive.length <= 1) return alive[0] || this.players[0];
    e.retarget = (e.retarget || 0) - dt;
    // Chefe no co-op: não fica preso num herói só. A cada 4–6 s troca para o outro
    // (de preferência o mais machucado), para os dois precisarem se defender.
    if (e.data.boss) {
      const cur = e.target;
      if (cur && alive.includes(cur) && e.retarget > 0) return cur;
      e.retarget = 4 + Math.random() * 2;
      const others = alive.filter((p) => p !== cur && !p.ally);
      if (!others.length) return cur && alive.includes(cur) ? cur : alive[0];
      const frac = (p) => (p.hp ?? 1) / (p.maxHp || 1);
      return others.reduce((a, b) => (frac(a) <= frac(b) ? a : b));
    }
    const cur = e.target;
    if (cur && alive.includes(cur) && e.retarget > 0) return cur;
    e.retarget = 1 + Math.random();
    const dist = (p) => Math.hypot(p.position.x - e.position.x, p.position.z - e.position.z) + (p.ally ? 1.5 : 0);
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
  // Também arma o Contra-Ataque (escapou rolando -> o próximo golpe dá mais dano).
  reflex(p = this.player) {
    if (p.stats.counter > 0) p.counterReady = true;
    if (!p.stats.reflex) return;
    if (p.reflexCombo !== 'armed') this.text.add('Reflexo!', p.position, 'crit', 3.4);
    p.reflexCombo = 'armed'; // vale para o próximo combo inteiro (player.js)
  }

  // Esquiva Envolvente: escapou de um projétil rolando -> +1 na ultimate (no máximo 1 vez por minuto).
  dodgeUlt(p) {
    if (!p.stats.dodgeUlt || p.dodgeUltCd > 0 || p.ultTime > 0 || p.ultCasting || p.state === 'dead') return;
    if ((p.ult || 0) >= p.ultNeed) return;
    p.dodgeUltCd = 60;
    p.ult = Math.min(p.ultNeed, (p.ult || 0) + 1);
    this.text.add('+1 Ultimate', p.position, 'crit', 3.2);
    if (this.log) this.log({ type: 'dodgeUlt' });
  }

  // Saque Rápido: rolando por dentro de um inimigo causa dano (cada inimigo 1 vez por rolamento).
  rollStrikes() {
    for (const p of this.players) {
      const n = p.stats.rollDmg;
      if (!(n > 0) || p.state !== 'dodge') continue;
      const hitSet = p.rollHits || (p.rollHits = new Set());
      for (const e of this.enemies) {
        if (!e.targetable || e.immune || hitSet.has(e)) continue;
        const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
        if (d > e.data.radius + p.hero.radius + 0.1) continue;
        hitSet.add(e);
        this.bonusDamage(e, n, p.dodgeDir.x, p.dodgeDir.z, 'dmg', p);
        if (this.log) this.log({ type: 'rollHit', enemy: e, dmg: n });
      }
    }
  }

  // Dano do herói que não vem do golpe direto (raio, explosão, onda). Não atordoa os resistentes.
  bonusDamage(e, dmg, nx, nz, cls = 'dmg', by = null) {
    if (!e.targetable || e.immune) return;
    if (by && this.kit2.duelBlocks(by, e)) return; // Duelo Sagrado
    if (by) e.lastHitBy = by;
    if (e.frozenT > 0) dmg *= 2; // congelado: dano dobrado em qualquer ataque
    if (e.acidT > 0) dmg = Math.round(dmg * (1 + (e.acidMul || 0))); // Chuva Ácida
    const died = e.takeDamage(dmg, nx, nz, 2, false);
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
  get aliveCount() { return this.enemies.filter((e) => (e.alive || e.finale) && !e.undead).length; } // mortos-vivos da Maga não contam

  addHitstop(t) { this.hitstop = Math.max(this.hitstop, t); }

  // Devolve o dt da simulação (0 durante o hitstop).
  simDt(dt) {
    if (this.hitstop > 0) { this.hitstop -= dt; return 0; }
    return dt;
  }

  // Golpe do herói (chamado no momento do impacto do golpe).
  playerStrike(p, step) {
    const h = p.hero;
    wbOnSwing(this, p, step); // bênçãos de arma que saem no golpe (Lança do Dragão)
    if (kitStrike(this, p, step)) return; // Espada e Escudo: arremessa o escudo/a espada em vez de cortar
    if (axeStrike(this, p, step)) return; // Machado: Arremesso Mortal
    if (step.cast) { castSpell(this, p, step); return; } // Maga: a magia sai daqui (magic.js)
    if (step.throw) { if (this.rogue) this.rogue.fire(p, step); return; } // Ladino: kunai / virote (rogue.js)
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    const st = p.stats;
    const range = h.attackRange * st.rangeMul * axeRangeMul(p, step); // Giro Crescente
    // Ponto do impacto: um pouco à frente (lança: bem mais longe; manopla: mais perto).
    const single = h.single && !step.cone; // 2º golpe da Rapieira: cone na frente (acerta todos dentro)
    const reach = Math.min(1.7, range * 0.65) + (single ? range * 0.3 : 0);
    const impact = new THREE.Vector3(p.position.x + fx * reach, 0, p.position.z + fz * reach);
    const blastMul = (step.blastMul || 1) * st.heavyRadiusMul;
    const heavyRadius = single ? 0 : FEEL.heavyRadius * blastMul; // lança: o golpe forte também acerta só 1
    const arc = (step.arc || h.attackArc) / 2 * DEG;
    if (step.heavy) { this.vfx.heavyImpact(impact, single ? 0.6 : blastMul); this.shakeFor(p, FEEL.shakeHeavy); }
    let hits = 0, kills = 0;
    // Lança: só o inimigo mais perto dentro da faixa da frente.
    // Perfurar/Duelista (bênçãos): acerta também os próximos atrás do primeiro.
    let only = null, onlySet = null;
    if (single) {
      const cand = [];
      for (const e of this.enemies) {
        if (!e.targetable) continue;
        const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, dist = Math.hypot(dx, dz) || 0.001;
        if (dist <= range + e.data.radius && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) <= arc) cand.push([dist, e]);
      }
      cand.sort((a, b) => a[0] - b[0]);
      onlySet = new Set(cand.slice(0, 1 + ((st.w && st.w.pierceMelee) || 0)).map((c) => c[1]));
      only = cand.length ? cand[0][1] : null;
    }
    if (step.heavy && st.echo > 0) this.echoWave(p, Math.round(st.echo * st.damageMul));
    if (step.cone) this.vfx.sector(p.position, p.facing, range, arc, 0xffe27a);
    kitOnSwing(this, p, step, range, arc); // Rastro Fantasma
    if (step.bash && p.stats.w && p.stats.w.table) this.kit2.kick(p, false); // Mesa Virada: a pancada de escudo chuta o objeto da frente
    // Ladino: os golpes destroem flechas e magias (agora e por um instante depois do impacto).
    if (p.heroId === 'rogue') { p.swipe = { t: 0.14, range: range + 0.4, arc: arc + 20 * DEG }; this.swipeProjectiles(p); }
    for (const e of [...this.enemies]) {
      if (!e.targetable) continue;
      if (single && !onlySet.has(e)) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const inArc = dist <= range + e.data.radius
        && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) <= arc;
      const inBlast = step.heavy && Math.hypot(e.position.x - impact.x, e.position.z - impact.z) <= heavyRadius + e.data.radius;
      if (!inArc && !inBlast) continue;
      const r = this.damageEnemy(p, e, step, dx / dist, dz / dist);
      if (r) { hits++; if (r === 'kill') kills++; }
      if (r === 'hit' && step.turnAround && e.alive) this.turnAway(p, e); // Rapieira: vira o inimigo de costas
    }
    this.props.strikeArc(p, range, arc, step.heavy ? impact : null, heavyRadius); // objetos quebráveis
    this.endCounter(p, hits);
    axeAfterStrike(this, p, step, hits, range); // Machado: Fio Pesado, Giro Crescente, Tornado
    p.sneakCrit = false; p.parryCrit = false; // ataque furtivo / contra-golpe da Rapieira: vale só para este golpe
    // O Mercador também apanha do herói (e revida).
    const m = this.merchant;
    if (m && m.alive && !m.ally && !(single && only)) { // contratado: os heróis não acertam nele
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

  // Rapieira (2º golpe): o inimigo acertado fica de costas para o herói.
  turnAway(p, e) {
    if (e.data.boss && e.immune) return;
    const a = Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z);
    e.facing = a; e.group.rotation.y = a;
    e.turnedT = (e.state === 'hurt' ? Math.max(0, e.stunTime - e.t) : 0) + 0.6; // não vira de volta na hora (enemies.js)
    this.text.add('De costas!', e.position, 'miss', 3.0);
    if (this.log) this.log({ type: 'turnedAway', enemy: e });
  }

  // Ladino: golpe corpo a corpo destrói projéteis de inimigos dentro do alcance do golpe.
  swipeProjectiles(p) {
    const w = p.swipe;
    if (!w || w.t <= 0) return 0;
    let n = 0;
    const L = this.projectiles.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const a = L[i];
      if (!a || a.hits !== 'player' || a.stuck >= 0) continue;
      const dx = a.x - p.position.x, dz = a.z - p.position.z, d = Math.hypot(dx, dz);
      if (d > w.range + a.r || (d > 0.9 && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > w.arc)) continue;
      this.smashOne(p, a); n++;
    }
    return n;
  }

  // Kunai/virote do Ladino voando: destrói projéteis de inimigos que encostar.
  smashProjectiles(p, x, z, r) {
    let n = 0;
    const L = this.projectiles.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const a = L[i];
      if (!a || a.hits !== 'player' || a.stuck >= 0) continue;
      if (Math.hypot(a.x - x, a.z - z) > r + a.r) continue;
      this.smashOne(p, a); n++;
    }
    return n;
  }

  smashOne(p, a) {
    const at = new THREE.Vector3(a.x, a.g.position.y, a.z);
    this.vfx.sparks(at, a.kind === 'arrow' ? 0xffe6a0 : (a.color ?? 0xc890ff), 12);
    audio.play('block', a.x, a.z, { v: 0.6 });
    this.text.add('Destruiu!', { x: a.x, z: a.z }, 'block', 2.2);
    this.projectiles.removeA(a);
    if (this.log) this.log({ type: 'smashed', kind: a.kind, p });
  }

  // Contra-Ataque usado (o golpe inteiro dobrou o dano).
  endCounter(p, hits) {
    if (p.counterReady && hits) { p.counterReady = false; this.text.add('Contra-ataque!', p.position, 'crit', 3.4); }
    if (p.openerReady && hits) p.openerReady = false; // Quebra-Gelo: só o 1º ataque da sala
  }

  // Um esqueleto atingido por um golpe (ou magia) do herói. Devolve 'kill' | 'hit' | 'blocked' | 'immune' (false = nada).
  // opts.spell: magia da Maga (o escudo do Guerreiro também segura, menos a magia forte).
  damageEnemy(p, e, step, nx, nz, opts = {}) {
    if (!e.targetable) return false;
    if (this.kit2.duelBlocks(p, e)) return false; // Duelo Sagrado: não atravessa o círculo
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
    const w = st.w || {};
    const heavyLike = step.heavy || !!w.guardBreak; // Esmaga-Guarda: todo golpe conta como forte contra a guarda
    if (!heavyLike && e.shieldCovers(p.position.x, p.position.z)) {
      // Escudo do Guerreiro: sem dano. Magia não para o esqueleto (ele segue andando com o escudo levantado).
      if (!opts.spell || opts.staggers) e.blockHit(nx, nz);
      audio.play('block', e.position.x, e.position.z);
      // Guerreiro: o escudo rebate o golpe e joga o herói para trás, sem defesa por um instante (e ele aproveita).
      const bash = e.data.shield && e.data.shield.bash;
      if (bash && !opts.spell && !opts.ranged && p.staggerBack && p.staggerBack(nx, nz, bash.time, bash.push)) {
        e.cooldown = Math.min(e.cooldown, 0.1);
        this.text.add('Desequilibrado!', p.position, 'hurt', 3.2);
        this.shakeFor(p, 0.18);
        if (this.log) this.log({ type: 'bashed', enemy: e });
      }
      this.vfx.sparks(chest.set(e.position.x - nx * 0.6, 1.2, e.position.z - nz * 0.6), 0xcfe4ff, 8);
      this.text.add('Bloqueou!', e.position, 'block');
      this.addHitstop(0.04);
      this.shakeFor(p, 0.08);
      if (this.log) this.log({ type: 'blocked', enemy: e });
      return 'blocked';
    }
    // Contra-Ataque: o golpe depois de um bloqueio dá dano dobrado.
    // Contra-Ataque: o golpe depois de escapar rolando dá mais dano. Quebra-Gelo: 1º ataque da sala.
    // Fúria: com 10% de vida ou menos. Poder Acumulado: 2 combos com dano dobrado depois da ultimate.
    const counter = p.counterReady ? 1 + st.counter : 1;
    const opener = p.openerReady && st.opener > 0 ? 1 + st.opener : 1;
    const rage = st.rage > 0 && p.hp <= p.maxHp * 0.1 ? 1 + st.rage : 1;
    const power = p.powerActive ? 2 : 1;
    const baseMul = st.damageMul * (st.fury && p.lowHp ? 1.6 : 1) * (st.domeFury && p.ultTime > 0 ? 1.6 : 1) * (1 + Math.min(0.75, st.reaperStacks * 0.02)) * counter * opener * rage * power;
    const guardBreak = step.heavy && e.data.staggerOnlyHeavy && e.shieldCovers(p.position.x, p.position.z);
    // Crítico: chance das bênçãos + a do herói (Ladino 25%). Sempre crítico: Precisão Invejável (ultimate do Ladino),
    // saindo da fumaça, logo depois de aparar, e a Rapieira acertando pelas costas.
    const backstab = !!(p.hero.backstab && !opts.ranged && e.alive && Math.abs(wrap(Math.atan2(p.position.x - e.position.x, p.position.z - e.position.z) - e.facing)) > 110 * DEG);
    const crit = backstab || opts.forceCrit || p.sneakCrit || p.parryCrit || (p.heroId === 'rogue' && p.ultTime > 0)
      || coopTakeCrit(p) || Math.random() < st.critChance + (p.hero.crit || 0); // co-op: Vingança
    const exec = st.execute > 0 && e.hp < e.maxHp * 0.3 ? 1 + st.execute : 1;
    const wb = wbDamage(p, e, step, { backstab });
    const crit2 = crit || wb.forceCrit;
    const critMul = ((st.lethalCrit && p.heroId === 'rogue' && p.ultTime > 0 ? 3 : 2) + wb.critMul) * (st.critDmgMul || 1); // Golpe Letal / bênçãos de arma / Olho do Carrasco
    // Congelado: TODO ataque nele dá dano dobrado (pedido do dono, 30/10). O 1º "estilhaça" (efeitos das bênçãos do Gelo).
    const frozenHit = e.frozenT > 0;
    const shatter = frozenHit && !e.shattered;
    if (shatter) e.shattered = true;
    const vuln = (e.offBalanceT > 0 ? 1.25 : 1) * (e.acidT > 0 ? 1 + (e.acidMul || 0) : 1) * coopDamageMul(this, p, e); // Chuva Ácida // desequilibrado: +25%; co-op: Laço/Marca
    // Perfect: soma +2 (+4) por golpe que acertou, até tomar dano (teto +30 / +60).
    const perfect = st.perfect > 0 ? Math.min(st.perfect * 15, (p.perfectStacks || 0) * st.perfect) : 0;
    const dmg = Math.max(1, Math.round(step.damage * baseMul * exec * vuln * wb.mul * (crit2 ? critMul : 1) * (frozenHit ? 2 + (shatter ? w.shatter || 0 : 0) : 1) * (0.9 + Math.random() * 0.2) + perfect));
    if (st.perfect > 0 && p.perfectSwing !== p.swingSeq) { p.perfectSwing = p.swingSeq; p.perfectStacks = (p.perfectStacks || 0) + 1; }
    const push = (step.heavy ? FEEL.pushHeavy * st.heavyPushMul : FEEL.push) * (opts.spell ? 0.6 : 1) * (1 + (w.pushMul || 0)) * (step.pushMul || 1); // pancada de escudo: empurra longe
    const died = e.takeDamage(dmg, nx, nz, push, heavyLike, (!!opts.spell && !opts.staggers) || !!opts.noStagger);
    if (step.offBal && !died && e.offBalance && e.offBalance(nx, nz, 0.6, push)) this.text.add('Desequilibrado!', e.position, 'hurt', 3.2); // pancada forte de escudo
    // Frenesi: o último golpe do combo deixa atordoado mais tempo.
    if (step.heavy && st.heavyStun > 0 && !died && e.state === 'hurt' && e.stunTime > 0) e.stunTime *= 1 + st.heavyStun;
    // Potência: o último golpe do combo arranca o escudo (chefes não).
    if (step.heavy && st.shieldBreak && !died && e.data.shield && !e.shieldBroken && !e.data.boss) this.breakEnemyShield(e, nx, nz);
    if (shatter) { this.text.add('Estilhaçou!', e.position, 'crit', 3.4); this.vfx.sparks(new THREE.Vector3(e.position.x, 1.2, e.position.z), 0xcff4ff, 14); if (this.log) this.log({ type: 'shatter', enemy: e, dmg }); }
    else if (frozenHit) this.text.add('Congelado ×2', e.position, 'crit', 2.6);
    if (shatter) wbOnShatter(this, p, e);
    this.text.add(crit2 ? `${dmg}!` : String(dmg), e.position, step.heavy || crit2 ? 'dmg big' : 'dmg');
    if (crit2) this.text.add(backstab ? 'Pelas costas!' : 'Crítico!', e.position, 'crit', 3.4);
    // Garras: todo 5º golpe soma +1 de sangramento; o inimigo perde 1 de vida por sangramento sempre que atacar, até morrer.
    if (step.bleed && !died) { e.bleedStacks = (e.bleedStacks || 0) + step.bleed.stacks; e.bleedBy = p; this.text.add(e.bleedStacks > 1 ? `Sangramento ×${e.bleedStacks}` : 'Sangrando!', e.position, 'bleed', 3.0); }
    if (step.heavy && st.burnDps > 0 && !died) { e.burn = 3; e.burnDps = st.burnDps; e.burnTick = 0.5; e.burnBy = p; }
    if (guardBreak && !opts.spell && !opts.noStagger) this.text.add('Guarda quebrada!', e.position, 'block', 3.3);
    if (!opts.spell) this.vfx.sparks(chest, step.heavy ? 0xffb050 : 0xffffff, step.heavy ? 10 : 6);
    if (this.log) this.log({ type: 'hit', enemy: e, dmg, died, spell: !!opts.spell });
    if (opts.ranged) this.endCounter(p, 1); // kunai/virote: o bônus do próximo golpe vale para este acerto
    if (died) this.killed(e, nx, nz, p);
    else coopAfterHit(this, p, e); // co-op: Marca do Caçador
    wbOnHit(this, p, e, step, { dmg, died, crit: crit2, spell: !!opts.spell, nx, nz }); // bênçãos exclusivas da arma
    if (crit2 && st.chain > 0) this.chainLightning(e, st.chain + 1, p);
    return died ? 'kill' : 'hit';
  }

  // Potência: o escudo do esqueleto cai da mão e ele fica sem guarda até o fim.
  breakEnemyShield(e, nx, nz) {
    e.shieldBroken = true;
    const sh = e.shieldMesh || e.weapons[1];
    if (sh) { const i = e.weapons.indexOf(sh); if (i >= 0) e.weapons.splice(i, 1); this.debris.drop(sh, nx, nz); }
    this.text.add('Escudo quebrado!', e.position, 'block', 3.3);
    this.vfx.sparks(new THREE.Vector3(e.position.x, 1.2, e.position.z), 0xcfe4ff, 14);
    audio.play('block', e.position.x, e.position.z);
    if (this.log) this.log({ type: 'shieldBroken', enemy: e });
  }

  // Sangramento (Garras do Ladino): dano na hora em que o inimigo ataca, em vermelho.
  bleedDamage(e, dmg) {
    if (e.immune) return;
    const bw = e.bleedBy && e.bleedBy.stats && e.bleedBy.stats.w;
    if (bw && bw.bleedDmg) dmg = Math.round(dmg * (1 + bw.bleedDmg)); // Hemofilia
    statDamage(e, dmg, e.hp);
    e.hp -= dmg;
    e.flash = Math.max(e.flash, 0.4);
    this.text.add(String(dmg), e.position, 'bleed', 2.0);
    this.vfx.sparks(new THREE.Vector3(e.position.x, 1.0, e.position.z), 0xc8102e, 4);
    if (this.log) this.log({ type: 'bleed', enemy: e, dmg });
    if (e.hp <= 0) { e.die(); this.killed(e, 0, 1, e.bleedBy); return; }
    // Garras: cada vez que o sangramento ativa, o inimigo sente como um golpe (atordoa) e o sangramento sobe +1.
    if (e.hitReact) e.hitReact();
    e.bleedStacks = (e.bleedStacks || 0) + 1;
  }

  // Dano do fogo (Lâmina Flamejante): não atordoa nem empurra.
  burnDamage(e, dmg) {
    if (e.immune) return;
    statDamage(e, dmg, e.hp);
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
    if (e.undead) { undeadDied(this, e); return; } // morto-vivo da Maga: só desmorona
    onEnemyKilled(this, e); // marcado pelo Cajado das Trevas: levanta do lado da Maga
    this.kit2.onKill(e); // Espada Amaldiçoada: conta o tipo pedido
    this.kills++;
    by = by || e.lastHitBy || this.player;
    statKill(e, by); // estatísticas da descida
    const st = by.stats;
    // Ultimate: cada inimigo derrotado pelo herói enche 1 (não conta durante a ultimate dele).
    if (by.hero && !e.noUltCharge && !(by.ultTime > 0) && !by.ultCasting && by.state !== 'dead') by.ult = Math.min(by.ultNeed, (by.ult || 0) + 1);
    if (st.reaper && st.reaperStacks < 38) st.reaperStacks++; // +2% cada, até +75%
    // Restos que o Mago Esqueleto pode reviver (só uma vez por esqueleto; chefes não).
    if (!e.revived && !e.data.boss && !e.noGrave) this.graves.push({ type: e.type, x: e.position.x, z: e.position.z, age: 0, hpScale: e.hpScale, dmgScale: e.dmgScale });
    if (st.boneBlast > 0 && !e.blasted) { e.blasted = true; this.boneBlast(e.position, st.boneBlast, by); }
    // Chefe morreu: os esqueletos invocados desmoronam juntos.
    if (e.data.final || e.data.finale) {
      this.graves.length = 0;
      for (const o of this.enemies) if (o !== e && o.alive) { o.noGrave = true; o.blasted = true; o.noUltCharge = true; o.die(); this.killed(o, 0, 1, by); }
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
    if (by.hero) wbOnKill(this, e, by);
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
    // Morto-vivo da Maga: o golpe pega os inimigos no alcance (nunca os heróis).
    if (e.undead) {
      for (const o of [...this.enemies]) if (!o.undead && o.targetable && inReach(o.position, o.data.radius)) undeadHit(this, e, o, dmg);
      return;
    }
    // Inimigo que está brigando com um morto-vivo: o golpe pega ele.
    if (e.target && e.target.undead && e.target.alive && inReach(e.target.position, e.target.data.radius)) hitUndead(this, e.target, dmg, e.position.x, e.position.z);
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
    if (died) e.noUltCharge = true; // abate do mercador não enche a ultimate
    if (died) this.killed(e, nx, nz, e.lastHitBy);
  }

  // Dano no herói vindo do inimigo (golpe, investida, giro, encostar, flecha). opts: { push, noRepel, contact, unDodgeable }
  // opts.target = qual herói (co-op); sem ele, o alvo do esqueleto.
  hitPlayer(e, base, opts = {}) {
    // Morto-vivo da Maga: nunca machuca os heróis; o golpe (salto, investida...) vai no inimigo que ele persegue.
    if (e.undead) {
      const t = e.target;
      if (!opts.contact && t && !t.undead && t.targetable && Math.hypot(t.position.x - e.position.x, t.position.z - e.position.z) < (e.data.attackRange || 2) + 2) undeadHit(this, e, t, base);
      return false;
    }
    // Inimigo mirando um morto-vivo: o golpe vai nele (se estiver perto), nunca no herói longe.
    if ((opts.target || e.target) && (opts.target || e.target).undead) {
      const u = opts.target || e.target;
      if (u.alive && !opts.contact && Math.hypot(u.position.x - e.position.x, u.position.z - e.position.z) < (e.data.attackRange || 2) + 2) hitUndead(this, u, base, e.position.x, e.position.z);
      return false;
    }
    // Esqueleto mirando o mercador contratado: o golpe vai nele (se estiver perto), nunca no herói longe.
    if (!opts.target && e.target && e.target.ally) {
      const m = e.target;
      if (m.alive && Math.hypot(m.position.x - e.position.x, m.position.z - e.position.z) < (e.data.attackRange || 2) + 3) m.hit(Math.round(base * (opts.contact ? 0.5 : 1)), e);
      return false;
    }
    const p = opts.target || (e.target && this.players.includes(e.target) ? e.target : this.player);
    if (p.state === 'dead') return false;
    if (this.kit2.duelBlocks(e, p)) return false; // Duelo Sagrado: golpe de fora do círculo não entra
    // unDodgeable (giro do Guardião enfurecido): rolar não salva, só o escudo.
    if (p.invulnerable && !(opts.unDodgeable && p.state === 'dodge')) {
      if (p.state === 'dodge' && !opts.contact) { this.text.add('Esquivou!', p.position, 'miss'); this.reflex(p); audio.play('miss', p.position.x, p.position.z); }
      if (this.log) this.log({ type: 'dodged' });
      return false;
    }
    // Rapieira: aparar no instante exato (rogue.js). Errou o tempo: o golpe entra normal.
    if (this.rogue && this.rogue.tryParry(p, e, opts)) return false;
    // Ladino: 10% de chance de desviar de qualquer golpe (não vale para encostão/armadilha).
    const evade = (p.hero.evade || 0) + (p.stats.evade || 0); // Furtivo soma com o desvio do Ladino
    if (evade > 0 && !opts.contact && !this.noEvade && Math.random() < evade) {
      this.text.add('Desviou!', p.position, 'miss');
      audio.play('miss', p.position.x, p.position.z);
      p.iframes = Math.max(p.iframes || 0, 0.15);
      if (this.log) this.log({ type: 'evaded' });
      return false;
    }
    const dx = p.position.x - e.position.x, dz = p.position.z - e.position.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;
    // Barreira da Maga: não segura golpes, mas segura as habilidades de chefe (giro da Lâmina dos Mortos, arremesso,
    // explosão do Necromante, chuva de crânios). Projéteis ela rebate (projectiles.js).
    const reflectBlock = !!(p.hero.block && p.hero.block.reflect);
    if (reflectBlock && opts.bossSkill && p.state === 'block' && p.shield > 0) {
      const res = useShield(p, this, e); // gasta 1 da barreira (igual ao escudo)
      p.blockedHit(0, nx, nz);
      this.vfx.sparks(new THREE.Vector3(p.position.x - nx * 0.7, 1.3, p.position.z - nz * 0.7), 0x9fd8ff, 14);
      if (res !== 'break') this.text.add('Bloqueou!', p.position, 'block');
      this.addHitstop(0.06); this.shakeFor(p, 0.12);
      if (res === 'break') { p.setState('hurt'); p.anim.play(p.hero.anims.hit, { once: true, speed: 1.6, fade: 0.05, restart: true }); }
      if (this.log) this.log({ type: 'blockedHero', dmg: 0, res: 'barrier' });
      return true;
    }
    if (!reflectBlock && p.blocksFrom(e.position.x, e.position.z)) {
      // Bloqueio do Cavaleiro: protege 100% do dano, mas gasta o escudo (quebra depois de 10 bloqueios).
      const res = kitGuard(this, p, e, nx, nz, opts) || useShield(p, this, e); // Mãos Trocadas: a espada apara e contra-ataca
      p.blockedHit(0, nx, nz);
      if (p.stats.thorns > 0 && e.alive && !opts.contact) {
        // Escudo de Espinhos: devolve dano ao atacante.
        statDamage(e, p.stats.thorns, e.hp);
        e.hp -= p.stats.thorns;
        e.flash = 1;
        this.text.add(String(p.stats.thorns), e.position, 'dmg');
        if (e.hp <= 0) { e.die(); this.killed(e, -nx, -nz, p); }
      }
      // Escudo do Cavaleiro: rebate quem atacou e deixa desequilibrado (igual ao herói batendo no escudo do Guerreiro).
      // Aparar (bênção): fica atordoado mais tempo.
      if (e.alive && e.offBalance && !opts.noRepel && !opts.contact && !opts.bossSkill) {
        const bash = SHIELD_BASH, more = 1 + ((p.stats.w && p.stats.w.bashStun) || 0); // Rebate Brutal
        if (e.offBalance(-nx, -nz, (res === 'parry' ? bash.time * 1.6 : bash.time) * more, bash.push)) {
          this.text.add('Desequilibrado!', e.position, 'hurt', 3.2);
          if (this.log) this.log({ type: 'offBalance', enemy: e });
          kitOnRepel(this, p, e, -nx, -nz); // Bilhar de Ossos
        }
      } else if (res === 'parry' && e.alive && e.repelled && !opts.noRepel) { e.repelled(-nx, -nz); if (e.data.boss) e.stunTime = 0.35; }
      if (!opts.contact) wbOnBlock(this, p, e, nx, nz); // Escudo Pesado, Guarda Curativa...
      if (res !== 'break') this.shieldShock(p, e);
      this.vfx.sparks(new THREE.Vector3(p.position.x - nx * 0.7, 1.3, p.position.z - nz * 0.7), res === 'parry' ? 0xffe27a : 0xcfe4ff, res === 'parry' ? 16 : 10);
      if (res !== 'break') this.text.add(res === 'parry' ? 'Aparou!' : 'Bloqueou!', p.position, res === 'parry' ? 'crit' : 'block');
      this.addHitstop(res === 'parry' ? 0.09 : 0.06);
      this.shakeFor(p, 0.12);
      this.hurtFor(p, 0.2);
      if (res === 'break') { p.setState('hurt'); p.anim.play(p.hero.anims.hit, { once: true, speed: 1.6, fade: 0.05, restart: true }); }
      if (this.log) this.log({ type: 'blockedHero', dmg: 0, res });
      return true;
    }
    // Poção Concentrada: a proteção da poção anula o próximo dano.
    if (p.potionGuard) {
      p.potionGuard = false;
      p.iframes = Math.max(p.iframes, 0.4);
      this.text.add('Anulado!', p.position, 'block');
      this.vfx.burst(p.position, 0x7dff8a);
      if (this.log) this.log({ type: 'potionGuard' });
      return false;
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
    let dmg = Math.max(1, Math.round(base * p.stats.damageTaken * coopTakenMul(this, p))); // co-op: Escudo Partilhado
    dmg = coopAngel(this, p, dmg); // co-op: Anjo da Guarda segura a queda
    if (dmg <= 0) return true;
    p.hurt(dmg, nx, nz, opts.push);
    coopOnHurt(this, p); // co-op: Vingança
    this.text.add(String(dmg), p.position, opts.contact ? 'hurt small' : 'hurt');
    this.addHitstop(opts.contact ? 0.04 : FEEL.hitstopHurt);
    this.shakeFor(p, opts.contact ? 0.15 : FEEL.shakeHurt);
    this.hurtFor(p, opts.contact ? 0.6 : 1);
    if (this.log) this.log({ type: opts.contact ? 'contact' : 'heroHit', dmg, enemy: e });
    return true;
  }

  // Manopla (bumpGuard): o 1º esbarrão não machuca. Depois dele, 0,5 s em que o mesmo encostão não conta
  // e até 1,6 s em que um 2º esbarrão machuca normalmente. Só vale para encostar (golpes/investidas machucam sempre).
  // Choque do Escudo: atordoa de leve (e afasta) os esqueletos em volta do Cavaleiro a cada bloqueio. Chefes não.
  shieldShock(p, src) {
    const S = SHIELD_SHOCK, pos = p.position;
    let n = 0;
    for (const o of this.enemies) {
      if (!o.targetable || o.data.boss || o.undead || o.ally) continue;
      const dx = o.position.x - pos.x, dz = o.position.z - pos.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > S.radius + o.data.radius) continue;
      if (o.state === 'hurt' && o.stunTime >= S.stun) continue; // já atordoado por mais tempo (ex.: rebatido)
      if (o.daze(S.stun)) { o.vel.set(dx / d, 0, dz / d).multiplyScalar(S.push * (o.data.knockback || 1)); n++; }
    }
    this.vfx.ring(new THREE.Vector3(pos.x, 0.15, pos.z), 0x9fd0ff, S.radius);
    if (n && this.log) this.log({ type: 'shieldShock', n, src });
  }

  bumpForgiven(p, e) {
    if (!p.hero.bumpGuard) return false;
    // Co-op: com a Manopla o Cavaleiro nunca toma dano de esbarrão.
    if (this.players.length > 1) {
      if (p.bumpGrace <= 0) { p.bumpGrace = 1.2; this.text.add('Esbarrão', p.position, 'miss'); if (this.log) this.log({ type: 'bumpForgiven' }); }
      return true;
    }
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
    const list = this.enemies.filter((e) => e.alive && !NO_BODY.has(e.state));
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z;
        const min = (a.data.radius + b.data.radius) * 1.08; // um pouco de folga: dois esqueletos nunca parecem um só
        let d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        if (d2 < 1e-6) { // exatamente no mesmo lugar: separa para um lado qualquer
          const ang = (i * 2.39996 + j) % (Math.PI * 2);
          b.position.x += Math.sin(ang) * min * 0.5; b.position.z += Math.cos(ang) * min * 0.5;
          continue;
        }
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
        if (a.abilities && a.data.contact && a.state !== 'attack' && a.state !== 'grab' && a.targetable && !p.invulnerable) { // atacando: quem machuca é o golpe
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
    if (!m || !m.alive || m.ally) return; // contratado: anda e rola, ninguém fica preso nele
    const bodies = this.enemies.filter((e) => e.alive && !NO_BODY.has(e.state))
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
    wbTick(this, dt); // bênçãos de arma: tempos e círculos de fogo
    this.axe.update(dt); // Machado: machado voando, Redemoinho, Rolagem Giratória
    this.kit.update(dt); // Espada e Escudo: escudo/espada soltos, gancho, bolas de osso, rastros
    this.kit2.update(dt); // 2ª leva: duelo, vassalo, objetos chutados, pedido da espada
    for (const p of this.players) if (p.swipe && p.swipe.t > 0) { p.swipe.t -= dt; this.swipeProjectiles(p); }
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
    undeadTick(this, dt); // Cajado das Trevas: marcados levantando, mortos-vivos sem inimigos desmoronam
    for (const e of this.enemies) if (e.alive) e.target = this.pickTarget(e, dt);
    tactics(this, dt); // brain.js: velocidade dos heróis e vagas do cerco
    for (const e of this.enemies) {
      ctx.player = e.target || this.player;
      e.update(dt, ctx);
    }
    undeadLook(this);
    this.separate();
    this.rollStrikes();
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
    this.kit2.afterMove(); // Duelo Sagrado: os dois presos no círculo, os outros do lado de fora
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
    this.props.clear();
    this.kit.clear();
    this.axe.clear();
    this.kit2.clear();
    for (const e of this.enemies) { if (e.boneSword) { e.boneSword.shatter(true); e.boneSword = null; } this.scene.remove(e.group); }
    this.enemies.length = 0;
    if (this.raising) this.raising.length = 0;
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
