// Gigante de Aço (lendária da Manopla, 12/11/2026): as regras do robô boxeador. combat.giant = GiantKit.
// Dados em l1bless.js (L1.giant), modelo em giant.js, ringue e tela em giantfx.js.
// Fases: wait (acabou de pegar a bênção) -> ring (o ringue de luz sobe, sino) -> drop (o robô cai do céu)
// -> rise (levanta) -> bump (soquinho de punho com o Cavaleiro) -> play <-> ko (30 s no chão, levanta aos poucos).
// No play: o robô anda sozinho atrás do inimigo de maior prioridade (magos > arqueiros > guardas > esqueletinhos >
// chefe) e COPIA o Cavaleiro: cada golpe do Cavaleiro vira um soco do robô (60, sem bênçãos; o último do combo é o
// cruzado que arremessa o inimigo contra os outros), defender = guarda fechada (não leva dano), rolar = esquiva.
// Os inimigos podem escolher o robô como alvo (alvo falso `bot`, em combat.pickTarget) e o golpe/flecha deles vai
// nele (combat.enemyStrike / hitPlayer / projectiles). Sala nova: ele cai do céu atrás do Cavaleiro.
// Ganchos: player.js (giantOnAttack no startAttack; reset), combat.js (tick, after, clear, alvo, dano), projectiles.js
// (flechas), main.js (câmera; Backspace dá a bênção para testar).
import * as THREE from 'three';
import { audio } from './audio.js';
import { L1 } from './l1bless.js';
import { makeGiant } from './giant.js';
import { makeRing, GiantUi } from './giantfx.js';
import { MechFx } from './mechfx.js';

const G = L1.giant, I = G.intro;
const BLUE = 0x6fc8ff, GOLD = 0xffd36a, RED = 0xff4a4a;
const DEG = Math.PI / 180;
const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };
const tA = new THREE.Vector3(), tB = new THREE.Vector3();
const INTRO = ['ring', 'drop', 'rise', 'bump'];
const DODGES = new Set(['dodge', 'r2Step']); // rolamento e Gingado: o robô esquiva junto
// Prioridade de alvo (pedido do dono): magos > arqueiros > guardas > esqueletinhos > chefe.
const rank = (e) => (e.data.boss ? 5 : e.type === 'mage' ? 1 : e.type === 'archer' ? 2 : e.type === 'warrior' ? 3 : 4);

let C = null;

// Onde fica a luva direita no soquinho de punho (medida no modelo, em relação ao centro do robô).
let BUMP = null;
function bumpGlove() {
  if (BUMP) return BUMP;
  const v = makeGiant({ scale: G.scale });
  v.snap({ mode: 'bump', k: 1 });
  const q = v.glovePos(1, new THREE.Vector3());
  BUMP = { x: q.x, z: q.z };
  v.dispose();
  return BUMP;
}

export const giantOn = (p) => !!(p && p.giant);
export const giantZoom = (p) => (p && p.giant && p.giant.phase !== 'wait' ? G.zoom : 1);

// Nova partida / troca de herói ou arma / volta para a Taverna: sem robô.
export function giantReset(p) {
  const m = p && p.giant;
  if (p) p.giantUsed = false;
  if (!m) return;
  if (INTRO.includes(m.phase) && p.state === 'cine') p.exitCine();
  if (C) C.drop(m);
  p.giant = null;
  if (C && C.ui.owner === p) { C.ui.show(false); C.ui.owner = null; }
}

// Chamado pelo herói em todo golpe que começa (player.startAttack): o robô copia.
export function giantOnAttack(p) {
  const m = p && p.giant;
  if (!m || m.phase !== 'play') return;
  const n = (p.hero && p.hero.combo && p.hero.combo.length) || 4;
  const i = p.combo || 0;
  m.pending = i >= n - 1 ? 3 : i % 3;
}

export class GiantKit {
  constructor(c) {
    this.c = c; C = this;
    this.fx = new MechFx(c.vfx);
    this.ui = new GiantUi();
    this.striking = false; // soco do robô: nenhuma bênção interfere (combat.killed olha isto)
    this.flying = [];      // inimigos arremessados pelo cruzado
  }
  log(o) { if (this.c.log) this.c.log(o); }
  get scene() { return this.c.vfx.scene; }
  shake(p, a) { this.c.shakeFor(p, a); }
  text(t, pos, cls, h) { this.c.text.add(t, pos, cls, h); }
  mine(p) { return p === this.c.player; }
  foes() { return this.c.enemies.filter((e) => e.targetable && e.alive && !e.undead && !e.data.phantom); }
  drop(m) {
    if (m.v) { if (m.v.g.parent) m.v.g.parent.remove(m.v.g); m.v.dispose(); m.v = null; }
    if (m.ring) { m.ring.dispose(); m.ring = null; }
  }

  // ---------- Alvo falso para os inimigos ----------
  // Robôs de pé (combat.pickTarget põe na lista de alvos possíveis).
  bots() {
    const out = [];
    for (const p of this.c.players) { const m = p.giant; if (m && m.phase === 'play' && m.v) out.push(m.bot); }
    return out;
  }
  makeBot(p, m) {
    return {
      giantBot: true, owner: p, position: m.pos, state: 'idle', navVel: { x: 0, z: 0 }, data: { radius: G.body },
      get alive() { return !!(p.giant === m && m.phase === 'play'); },
      get facing() { return m.facing; },
      get hp() { return m.hp; }, get maxHp() { return m.max; },
    };
  }
  isBot(t) { return !!(t && t.giantBot); }

  // Golpe de inimigo que mira o robô (combat.hitPlayer / enemyStrike). Devolve true se o golpe foi para ele.
  enemyHit(e, base, opts = {}) {
    const t = opts.target || e.target;
    if (!this.isBot(t)) return false;
    if (opts.contact) return true; // esbarrão no robô: nada
    const m = t.owner.giant;
    if (!m || m.phase !== 'play') return true;
    const d = Math.hypot(m.pos.x - e.position.x, m.pos.z - e.position.z);
    if (d < (e.data.attackRange || 2) + 2 + G.body) this.hurt(t.owner, base, e.position.x, e.position.z);
    return true;
  }
  // Flecha/magia inimiga passando pelo robô (projectiles.js). Devolve true se acertou.
  shot(a, dx, dz) {
    for (const p of this.c.players) {
      const m = p.giant;
      if (!m || m.phase !== 'play' || !m.v) continue;
      if (Math.hypot(m.pos.x - a.x, m.pos.z - a.z) >= G.body + (a.r || 0.3)) continue;
      this.hurt(p, a.damage, a.x - dx * 3, a.z - dz * 3);
      return true;
    }
    return false;
  }
  // Dano no robô (bloqueando ou esquivando: nada).
  hurt(p, base, fx, fz) {
    const m = p.giant;
    if (!m || m.phase !== 'play' || this.c.godGiant) return;
    if (m.weave) { this.text('Esquivou!', m.pos, 'miss', 5); return; }
    m.v.g.updateMatrixWorld(true); m.v.headPos(tA);
    if (m.block) {
      this.c.vfx.sparks(v3(m.pos.x + (fx - m.pos.x) * 0.25, 3.2, m.pos.z + (fz - m.pos.z) * 0.25), BLUE, 10);
      this.text('Defendeu!', m.pos, 'block', 5.2);
      audio.play('block', m.pos.x, m.pos.z);
      this.log({ type: 'giantBlock' });
      return;
    }
    const dmg = Math.max(1, Math.round(base));
    m.hp -= dmg;
    m.v.flash(0.9, 1, 0.35, 0.3);
    this.c.vfx.sparks(v3(m.pos.x, 3, m.pos.z), 0xff6a4a, 8);
    this.text(String(dmg), m.pos, 'hurt', 5.4);
    audio.play('mechHurt', m.pos.x, m.pos.z, { v: 0.6 });
    this.log({ type: 'giantHurt', dmg, hp: m.hp });
    if (m.hp <= 0) this.knockOut(p);
  }

  // ---------- Chamada ----------
  canSummon(p) {
    return !!W(p).giantForm && !p.giantUsed && !p.giant && p.heroId === 'knight' && p.hero && p.hero.weaponId === 'manopla'
      && (p.state === 'idle' || p.state === 'run') && !p.frozen && !p.choosing && this.c.world;
  }
  // Lugar livre na frente do Cavaleiro (de preferência para onde ele olha; senão os outros lados).
  spot(p, dist, r, angles = null) {
    const world = this.c.world;
    let best = null;
    for (const a of angles || [0, Math.PI / 2, -Math.PI / 2, Math.PI, Math.PI / 4, -Math.PI / 4].map((d) => p.facing + d)) {
      const q = v3(p.position.x + Math.sin(a) * dist, 0, p.position.z + Math.cos(a) * dist), q0 = q.clone();
      world.resolveCircle(q, r);
      const err = q.distanceTo(q0) + (best ? 0.3 : 0);
      if (!best || err < best.err) best = { err, q };
      if (err < 0.05) break;
    }
    return best.q;
  }
  summon(p) {
    // Do lado do Cavaleiro (leste ou oeste), para a câmera mostrar os dois lado a lado no soquinho de punho.
    const side = Math.sin(p.facing) >= 0 ? Math.PI / 2 : -Math.PI / 2;
    const free = this.spot(p, I.dist, 1.6, [side, -side, Math.PI, 0]);
    // O robô para onde a luva dele (no soquinho) fica a 1,3 do Cavaleiro.
    const dir = Math.atan2(free.x - p.position.x, free.z - p.position.z), face = dir + Math.PI; // o robô olha para o Cavaleiro
    const bg = bumpGlove(), tx = p.position.x + Math.sin(dir) * 1.3, tz = p.position.z + Math.cos(dir) * 1.3;
    const at = v3(tx - (bg.x * Math.cos(face) + bg.z * Math.sin(face)), 0, tz - (-bg.x * Math.sin(face) + bg.z * Math.cos(face)));
    this.c.world.resolveCircle(at, G.wall);
    const m = (p.giant = {
      p, phase: 'ring', t: 0, hp: G.hp, max: G.hp, v: null, ring: null, pos: at.clone(), facing: face, bounds: this.c.world.bounds, // bounds = objeto novo a cada sala
      act: null, pending: null, weave: null, block: false, lastState: p.state, target: null, retarget: 0,
      walk: 0, phaseA: 0, steps: 0, stuck: 0, side: 0, sideDir: 1, lastD: 0, ko: null, cheer: 0, hadFoes: false, dropIn: null,
      bumped: false, rang: false, landed: false,
    });
    m.bot = this.makeBot(p, m);
    p.enterCine();
    p.facing = Math.atan2(at.x - p.position.x, at.z - p.position.z); p.group.rotation.y = p.facing;
    p.anim.play('Melee_Unarmed_Idle', { fade: 0.15 });
    m.ring = makeRing(this.scene, (at.x + p.position.x) / 2, (at.z + p.position.z) / 2, face);
    if (this.mine(p)) { this.ui.owner = p; this.ui.letterbox(true); }
    this.text('GIGANTE DE AÇO!', p.position, 'big', 3.6);
    this.log({ type: 'giantCall' });
  }

  // ---------- A cada quadro ----------
  tick(dt) {
    const c = this.c;
    for (const p of c.players) {
      if (!p.giant) {
        if (this.canSummon(p)) { p.giantWait = (p.giantWait || 0) + dt; if (p.giantWait >= I.wait) { p.giantWait = 0; this.summon(p); } } else p.giantWait = 0;
        continue;
      }
      const m = p.giant;
      m.t += dt;
      if (c.world && c.world.bounds && m.bounds !== c.world.bounds) this.newRoom(p); // sala nova
      if (m.ring && m.phase === 'play') { // o ringue some depois da chegada
        m.ringOut = (m.ringOut || 0) + dt;
        m.ring.update(1 - m.ringOut / I.out);
        if (m.ringOut >= I.out) { m.ring.dispose(); m.ring = null; }
      }
      if (m.phase === 'ring') {
        m.ring.update(m.t / I.ring);
        if (!m.rang && m.t > 0.15) { m.rang = true; audio.play('ringBell', m.pos.x, m.pos.z); if (this.mine(p)) this.ui.ding('DING! DING!'); }
        if (m.t >= I.ring) {
          m.phase = 'drop'; m.t = 0;
          const v = (m.v = makeGiant({ scale: G.scale }));
          this.scene.add(v.g); v.g.position.set(m.pos.x, I.sky, m.pos.z); v.g.rotation.y = m.facing;
          v.snap({ mode: 'drop', k: 0 });
          audio.play('mechPower', m.pos.x, m.pos.z, { v: 0.6 });
        }
      } else if (m.phase === 'drop') {
        const k = clamp01(m.t / I.drop);
        m.v.g.position.y = I.sky * (1 - k * k);
        m.v.update(dt, { mode: 'drop', k: k * 0.75 });
        if (Math.random() < dt * 30) this.fx.embers(v3(m.pos.x, m.v.g.position.y + 2, m.pos.z), 1, 0.6, BLUE, -2);
        if (k >= 1) { this.land(p, true); m.phase = 'rise'; m.t = 0; }
      } else if (m.phase === 'rise') {
        const k = clamp01(m.t / I.rise);
        m.v.update(dt, { mode: k < 0.35 ? 'drop' : 'guard', k: 1 });
        if (k >= 1) { m.phase = 'bump'; m.t = 0; }
      } else if (m.phase === 'bump') this.bumpTick(p, dt);
      else if (m.phase === 'ko') this.koTick(p, dt);
      if (m.v && m.phase !== 'play') this.place(m);
      if (this.mine(p) && (m.phase === 'play' || m.phase === 'ko')) this.ui.set(m.phase === 'ko' ? m.max * clamp01(m.ko.t / G.ko) : m.hp, m.max, m.phase === 'ko' ? G.ko - m.ko.t : null, dt);
    }
    this.tickFlying(dt);
  }
  place(m) { m.v.g.position.x = m.pos.x; m.v.g.position.z = m.pos.z; m.v.g.rotation.y = m.facing; }

  // Pouso: tremor, poeira, onda azul; os esqueletos em volta ficam tontos (sem dano).
  land(p, big) {
    const m = p && p.giant;
    if (!m || !big) return;
    const x = m.pos.x, z = m.pos.z;
    m.v.g.position.y = 0;
    this.fx.shock(x, z, 8, BLUE, 0.55); this.fx.shock(x, z, 4, 0xffffff, 0.35, 0.3);
    this.fx.impact(x, z, 1.1, BLUE); this.fx.rocks(x, z, 8, 0.7); this.fx.crack(x, z, 2.4, 3, BLUE);
    this.c.vfx.dust(v3(x, 0, z), v3(0, 1, 0), 12);
    audio.play('mechStep', x, z, { v: 1.4 }); audio.play('boom', x, z, { v: 0.7 });
    this.shake(p, 0.7); this.c.addHitstop(0.08);
    for (const e of this.c.enemies) if (!e.undead && e.alive && !e.data.boss && e.daze && Math.hypot(e.position.x - x, e.position.z - z) < 7) e.daze(1.0);
    this.log({ type: 'giantLand' });
  }

  // Soquinho de punho: o robô abaixa e estica a luva; o Cavaleiro bate nela.
  bumpTick(p, dt) {
    const m = p.giant, k = m.t / I.bump, v = m.v;
    const reach = smooth(k / 0.45) * (1 - smooth((k - 0.78) / 0.22));
    v.update(dt, { mode: reach > 0.02 ? 'bump' : 'guard', k: reach });
    if (!m.punched && k > 0.3) { m.punched = true; p.anim.play('Melee_Unarmed_Attack_Punch_A', { once: true, restart: true, fade: 0.06, speed: 1.1 }); }
    if (!m.bumped && k > 0.5) {
      m.bumped = true;
      v.glovePos(1, tA);
      this.fx.flare(tA.clone(), 3.2, GOLD, 0.3); this.fx.shock(tA.x, tA.z, 3, GOLD, 0.4, tA.y);
      this.c.vfx.sparks(tA.clone(), GOLD, 16);
      audio.play('clang', tA.x, tA.z); audio.play('ringBell', tA.x, tA.z, { v: 0.7 });
      this.shake(p, 0.25); this.c.addHitstop(0.07);
      if (this.mine(p)) { this.ui.flash(); this.ui.title('Gigante de Aço', 'LENDÁRIA'); }
      this.log({ type: 'giantBump' });
    }
    if (k >= 1) this.startPlay(p);
  }
  startPlay(p) {
    const m = p.giant;
    m.phase = 'play'; m.t = 0; m.ringOut = 0;
    if (p.state === 'cine') p.exitCine();
    if (this.mine(p)) { this.ui.letterbox(false); this.ui.show(true); this.ui.chip = 1; this.ui.hp = -1; }
    this.log({ type: 'giantReady' });
  }

  // ---------- Nocaute ----------
  knockOut(p) {
    const m = p.giant;
    m.hp = 0; m.phase = 'ko'; m.ko = { t: 0, sparkT: 0, rang: false }; m.act = null; m.weave = null; m.block = false; m.pending = null;
    audio.play('giantKO', m.pos.x, m.pos.z);
    this.text('NOCAUTE!', m.pos, 'big', 6);
    this.shake(p, 0.5); this.c.addHitstop(0.1);
    this.log({ type: 'giantKO' });
  }
  koTick(p, dt) {
    const m = p.giant, K = m.ko, v = m.v;
    K.t += dt;
    const rise = smooth((K.t - G.rise[0]) / (G.rise[1] - G.rise[0]));
    v.update(dt, { mode: 'ko', k: K.t / 0.9, rise, flick: K.t > 3 && Math.random() < 0.04 ? 0.5 : 0 });
    if (!K.rang && K.t > 0.85) { // caiu no chão
      K.rang = true;
      this.c.vfx.dust(v3(m.pos.x, 0, m.pos.z), v3(0, 1, 0), 14);
      this.fx.shock(m.pos.x, m.pos.z, 5, 0xd8c8a8, 0.4);
      audio.play('mechStep', m.pos.x, m.pos.z, { v: 1.3 });
      this.shake(p, 0.4);
    }
    K.sparkT -= dt;
    if (K.t > 1 && rise < 0.05 && K.sparkT <= 0) { // faíscas e fumaça saindo do robô caído
      K.sparkT = 0.5 + Math.random() * 0.7;
      const a = m.facing + Math.PI + (Math.random() - 0.5) * 0.8, r = 0.8 + Math.random() * 2.4;
      const q = v3(m.pos.x + Math.sin(a) * r, 0.9, m.pos.z + Math.cos(a) * r);
      this.c.vfx.sparks(q, BLUE, 6); this.fx.smoke(q, 2, 0.6);
    }
    if (K.t >= G.ko) { // de pé, vida cheia
      m.phase = 'play'; m.hp = m.max; m.ko = null; m.t = 0;
      v.flash(1, 0.6, 0.9, 1);
      this.fx.shock(m.pos.x, m.pos.z, 7, BLUE, 0.6); this.fx.pillar(m.pos.x, m.pos.z, 9, 2.4, BLUE, 0.5);
      audio.play('mechPower', m.pos.x, m.pos.z, { v: 0.8 }); audio.play('ringBell', m.pos.x, m.pos.z, { v: 0.6 });
      this.text('DE PÉ!', m.pos, 'big', 6);
      this.log({ type: 'giantUp' });
    }
  }

  // ---------- Sala nova: cai do céu atrás do Cavaleiro ----------
  newRoom(p) {
    const m = p.giant;
    m.bounds = this.c.world.bounds;
    if (INTRO.includes(m.phase)) { // sala nova no meio da cena: termina do jeito mais simples
      if (m.ring) { m.ring.dispose(); m.ring = null; }
      if (!m.v) { m.v = makeGiant({ scale: G.scale }); this.scene.add(m.v.g); }
      this.startPlay(p);
    }
    const back = this.spot({ position: p.position, facing: p.facing + Math.PI }, G.follow.back, 1.4);
    m.pos.copy(back); m.facing = p.facing; m.act = null; m.weave = null; m.target = null;
    if (m.v) { this.place(m); m.v.g.position.y = m.phase === 'play' ? I.sky * 0.6 : 0; }
    if (m.phase === 'play') m.dropIn = { t: 0 };
  }

  // ---------- Soco do robô (valor fixo, sem bênçãos) ----------
  damage(p, e, dmg, nx, nz, opts = {}) {
    if (!e.targetable || e.immune) return false;
    if (this.c.kit2 && this.c.kit2.duelBlocks(p, e)) return false;
    e.lastHitBy = p;
    this.striking = true;
    let died = false;
    try {
      died = e.takeDamage(dmg, nx, nz, opts.push ?? (e.data.boss ? 0.8 : 3.5), true, !!opts.noStagger);
      this.text(String(dmg), e.position, opts.cls || 'crit', 2.8);
      this.log({ type: 'giantHit', enemy: e, dmg, died, kind: opts.kind || 'punch' });
      if (died) this.c.killed(e, nx, nz, p);
    } finally { this.striking = false; }
    return true;
  }
  startPunch(p, which) {
    const m = p.giant;
    if (m.act && !m.act.done) this.strike(p, m.act); // o anterior ainda não tinha batido: bate agora
    const dur = G.punch[which];
    m.act = { kind: 'punch', which, t: 0, dur, done: false };
    m.weave = null;
    audio.play(which === 3 ? 'mechSwing' : 'swingHeavy', m.pos.x, m.pos.z, { v: which === 3 ? 0.8 : 0.6 });
    this.log({ type: 'giantPunch', which });
  }
  // Quem está na frente do robô, no alcance do soco.
  inArc(m) {
    const fx = Math.sin(m.facing), fz = Math.cos(m.facing), out = [];
    for (const e of this.c.enemies) {
      if (e.undead || !e.targetable) continue;
      const dx = e.position.x - m.pos.x, dz = e.position.z - m.pos.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > G.reach + e.data.radius) continue;
      if (Math.abs(wrap(Math.atan2(dx, dz) - m.facing)) > G.arc * DEG + Math.atan2(e.data.radius, d)) continue;
      out.push({ e, d, nx: dx / d, nz: dz / d, along: dx * fx + dz * fz });
    }
    return out.sort((a, b) => a.d - b.d);
  }
  strike(p, a) {
    const m = p.giant, c = this.c;
    a.done = true;
    const hits = this.inArc(m);
    const glove = m.v.glovePos(a.which === 0 || a.which === 2 ? 0 : 1, tA).clone();
    let n = 0;
    if (a.which === 3 && hits.length) { // cruzado: o 1º voa como bola de boliche
      const h = hits[0];
      if (this.launch(p, h.e, Math.sin(m.facing), Math.cos(m.facing))) hits.shift();
      n++;
    }
    for (const h of hits) if (this.damage(p, h.e, G.dmg, h.nx, h.nz, { kind: 'punch' })) n++;
    if (c.props) c.props.strikeArc({ position: m.pos, facing: m.facing }, G.reach, G.arc * DEG);
    c.vfx.sparks(glove, n ? 0xffffff : BLUE, n ? 10 : 4);
    if (n) {
      this.fx.flare(glove, a.which === 3 ? 3 : 1.8, a.which === 3 ? GOLD : BLUE, 0.2);
      audio.play('hitHeavy', glove.x, glove.z); if (a.which === 3) audio.play('boom', glove.x, glove.z, { v: 0.5 });
      c.addHitstop(a.which === 3 ? 0.08 : 0.035); this.shake(p, a.which === 3 ? 0.3 : 0.12);
    }
    this.log({ type: 'giantStrike', which: a.which, hits: n });
  }
  // Cruzado: o inimigo voa para a frente e derruba quem estiver no caminho (chefe não voa: só apanha).
  launch(p, e, dx, dz) {
    if (e.data.boss || e.finale || e.immune || e.data.phantom) return false;
    e.releaseToken && e.releaseToken();
    if (e.atk && e.state === 'attack' && e.endAttack) e.endAttack();
    if (e.vel) e.vel.set(0, 0, 0);
    e.setState('lanceFly'); // sem corpo, ninguém mexe nele (quem mexe é o GiantKit)
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.6 });
    e.lastHitBy = p;
    this.flying.push({ p, e, dx, dz, dist: 0, hit: new Set([e]), t: 0, n: 0 });
    this.text('BOLICHE!', e.position, 'crit', 3.6);
    this.log({ type: 'giantBowl', enemy: e });
    return true;
  }
  tickFlying(dt) {
    const c = this.c, B = G.bowl;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i], e = f.e;
      if (!e.alive || e.state !== 'lanceFly') { this.flying.splice(i, 1); continue; }
      f.t += dt;
      const step = Math.min(B.speed * dt, B.max - f.dist);
      const q = v3(e.position.x + f.dx * step, 0, e.position.z + f.dz * step), q0 = q.clone();
      if (c.world) c.world.resolveCircle(q, e.data.radius);
      const wall = q.distanceTo(q0) > 0.05;
      e.position.x = q.x; e.position.z = q.z; e.position.y = 0.5 + Math.sin(Math.min(1, f.dist / B.max) * Math.PI) * 0.6;
      f.dist += step;
      if (e.model) e.model.rotation.x -= dt * 14;
      if (Math.random() < dt * 30) c.vfx.dust(v3(e.position.x, 0, e.position.z), v3(-f.dx, 1, -f.dz), 1);
      for (const o of [...c.enemies]) { // pinos do boliche
        if (f.hit.has(o) || o.undead || !o.targetable) continue;
        const ox = o.position.x - e.position.x, oz = o.position.z - e.position.z, d = Math.hypot(ox, oz);
        if (d > B.r + o.data.radius + e.data.radius) continue;
        f.hit.add(o); f.n++;
        const side = (ox * f.dz - oz * f.dx) >= 0 ? 1 : -1, nx = f.dx * 0.6 + f.dz * side * 0.8, nz = f.dz * 0.6 - f.dx * side * 0.8;
        this.damage(f.p, o, G.dmg, nx, nz, { kind: 'pin', push: o.data.boss ? 1 : B.push });
        if (o.alive && !o.data.boss && o.daze) o.daze(B.daze);
        c.vfx.sparks(v3(o.position.x, 1.2, o.position.z), GOLD, 8);
        audio.play('bones', o.position.x, o.position.z);
      }
      if (wall || f.dist >= B.max - 1e-3) {
        this.flying.splice(i, 1);
        e.position.y = 0; if (e.model) e.model.rotation.x = 0;
        e.setState('hurt'); e.stunTime = 0.5;
        if (wall) { this.fx.shock(e.position.x, e.position.z, 2.5, 0xd8c8a8, 0.35); this.fx.rocks(e.position.x, e.position.z, 5, 0.5); audio.play('hitHeavy', e.position.x, e.position.z); }
        this.damage(f.p, e, G.dmg, f.dx, f.dz, { kind: 'bowl', push: 2 });
        if (f.n >= 2) this.text(f.n >= 3 ? 'STRIKE!' : 'SPARE!', e.position, 'big', 3.8);
        this.log({ type: 'giantBowlEnd', pins: f.n, wall });
      }
    }
  }

  // ---------- O robô em jogo (chamado em combat.update, antes dos inimigos andarem) ----------
  play(dt) {
    for (const p of this.c.players) {
      const m = p.giant;
      if (!m || m.phase !== 'play' || !m.v) continue;
      this.brain(p, m, dt);
    }
  }
  pickTarget(m, foes) {
    let best = null, bs = Infinity;
    for (const e of foes) {
      const d = Math.hypot(e.position.x - m.pos.x, e.position.z - m.pos.z);
      const s = rank(e) * 1000 + d;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }
  brain(p, m, dt) {
    const c = this.c, world = c.world, v = m.v;
    // Caindo do céu na sala nova.
    if (m.dropIn) {
      m.dropIn.t += dt;
      const k = clamp01(m.dropIn.t / (I.drop * 0.8));
      v.g.position.y = I.sky * 0.6 * (1 - k * k);
      v.update(dt, { mode: 'drop', k: k * 0.75 });
      if (k >= 1) { m.dropIn = null; this.land(p, true); }
      return;
    }
    // Copia o Cavaleiro: golpe, guarda, rolamento.
    if (m.pending != null) { const w = m.pending; m.pending = null; this.startPunch(p, w); }
    m.block = p.state === 'block';
    if (DODGES.has(p.state) && !DODGES.has(m.lastState)) {
      const rel = p.dodgeDir && p.dodgeDir.lengthSq() ? wrap(Math.atan2(p.dodgeDir.x, p.dodgeDir.z) - m.facing) : 0;
      m.weave = { t: 0, dir: rel >= 0 ? 1 : -1 }; m.act = null;
      audio.play('dodge', m.pos.x, m.pos.z, { v: 0.7 });
      this.log({ type: 'giantWeave' });
    }
    m.lastState = p.state;
    const foes = this.foes();
    if (foes.length) m.hadFoes = true;
    else if (m.hadFoes) { m.hadFoes = false; m.cheer = 1.8; } // sala limpa: comemora
    if (m.cheer > 0) m.cheer -= dt;
    // Alvo.
    m.retarget -= dt;
    if (!m.target || !m.target.alive || !m.target.targetable || m.retarget <= 0) { m.target = foes.length ? this.pickTarget(m, foes) : null; m.retarget = 0.5; }
    const t = m.target;
    let want = m.facing, mx = 0, mz = 0, speed = G.speed, turn = G.turn;
    if (m.weave) { // esquiva: desliza para o lado
      m.weave.t += dt;
      const k = m.weave.t / G.weave.dur;
      const sx = Math.cos(m.facing) * m.weave.dir, sz = -Math.sin(m.facing) * m.weave.dir;
      const sp = (G.weave.dist / G.weave.dur) * Math.sin(clamp01(k) * Math.PI) * 1.57;
      m.pos.x += sx * sp * dt; m.pos.z += sz * sp * dt; world.resolveCircle(m.pos, G.wall);
      v.update(dt, { mode: 'weave', k, dir: m.weave.dir });
      if (k >= 1) m.weave = null;
      this.syncBot(m, 0, 0);
      return;
    }
    if (m.act) {
      const a = m.act;
      a.t += dt;
      const k = a.t / a.dur;
      if (t && k < G.hitAt) { const d = Math.hypot(t.position.x - m.pos.x, t.position.z - m.pos.z); if (d < 8) want = Math.atan2(t.position.x - m.pos.x, t.position.z - m.pos.z); turn = 22; }
      else turn = 0;
      if (k > 0.2 && k < G.hitAt && t && Math.hypot(t.position.x - m.pos.x, t.position.z - m.pos.z) > G.reach * 0.75) { // passo à frente no soco
        const ls = (G.lunge / (a.dur * (G.hitAt - 0.2)));
        m.pos.x += Math.sin(m.facing) * ls * dt; m.pos.z += Math.cos(m.facing) * ls * dt; world.resolveCircle(m.pos, G.wall);
      }
      if (!a.done && k >= G.hitAt) this.strike(p, a);
      if (k >= 1) m.act = null;
      speed = 0;
    } else if (t) { // vai atrás do alvo
      const dx = t.position.x - m.pos.x, dz = t.position.z - m.pos.z, d = Math.hypot(dx, dz) || 0.01;
      want = Math.atan2(dx, dz);
      const stop = G.reach - 0.4 + t.data.radius * 0.5;
      if (d > stop) { mx = dx / d; mz = dz / d; }
      if (m.block) speed *= 0.4;
    } else { // sem inimigos: fica atrás do Cavaleiro
      const F = G.follow, back = p.facing + Math.PI;
      const gx = p.position.x + Math.sin(back) * F.back + Math.cos(p.facing) * F.side, gz = p.position.z + Math.cos(back) * F.back - Math.sin(p.facing) * F.side;
      const dx = gx - m.pos.x, dz = gz - m.pos.z, d = Math.hypot(dx, dz);
      if (d > F.near) { mx = dx / d; mz = dz / d; want = Math.atan2(dx, dz); speed *= d > 7 ? 1.25 : 1; }
      else want = p.facing;
    }
    // Preso num pilar: passo de lado.
    if (mx || mz) {
      if (m.side > 0) { m.side -= dt; const sx = -mz * m.sideDir, sz = mx * m.sideDir; mx = mx * 0.3 + sx; mz = mz * 0.3 + sz; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l; }
      const dd = t ? Math.hypot(t.position.x - m.pos.x, t.position.z - m.pos.z) : 0;
      m.stuck += dt;
      if (m.stuck > 0.8) { if (t && m.lastD - dd < 0.4) { m.side = 0.7; m.sideDir = Math.random() < 0.5 ? -1 : 1; } m.stuck = 0; m.lastD = dd; }
    }
    const moving = (mx || mz) && speed > 0.01;
    let vx = 0, vz = 0;
    if (moving) {
      const dist = speed * dt, n = Math.max(1, Math.ceil(dist / 0.25));
      for (let i = 0; i < n; i++) { m.pos.x += mx * dist / n; m.pos.z += mz * dist / n; world.resolveCircle(m.pos, G.wall); }
      vx = mx * speed; vz = mz * speed;
      const before = Math.floor(m.phaseA / Math.PI + 0.5);
      m.phaseA += (dist / 1.9) * Math.PI;
      if (Math.floor(m.phaseA / Math.PI + 0.5) !== before) this.footfall(p, m);
    } else world.resolveCircle(m.pos, G.wall);
    m.walk += ((moving ? 1 : 0) - m.walk) * Math.min(1, dt * 8);
    if (turn > 0) m.facing += wrap(want - m.facing) * (1 - Math.exp(-turn * dt));
    this.place(m);
    const a = m.act;
    const mode = a ? 'punch' : m.block ? 'block' : m.cheer > 0 && !foes.length ? 'cheer' : 'guard';
    v.update(dt, { mode, which: a && a.which, k: a ? clamp01(a.t / a.dur) : 1, walk: m.walk, phase: m.phaseA });
    this.syncBot(m, vx, vz);
  }
  syncBot(m, vx, vz) { m.bot.navVel.x = vx; m.bot.navVel.z = vz; m.bot.state = m.act ? 'attack' : 'idle'; }
  footfall(p, m) {
    this.c.vfx.dust(v3(m.pos.x, 0, m.pos.z), v3(0, 1, 0), 2);
    audio.play('mechStep', m.pos.x, m.pos.z, { v: 0.5 });
    if ((m.steps = (m.steps || 0) + 1) % 2 === 0) this.shake(p, 0.03);
  }

  // Depois dos inimigos andarem: ninguém entra no corpo do robô; o robô não fica em cima do Cavaleiro.
  after() {
    const c = this.c;
    for (const p of c.players) {
      const m = p.giant;
      if (!m || !m.v || (m.phase !== 'play' && m.phase !== 'ko')) continue;
      for (const e of c.enemies) {
        if (!e.alive || e.undead || e.state === 'lanceFly' || e.state === 'spawn') continue;
        const dx = e.position.x - m.pos.x, dz = e.position.z - m.pos.z, d = Math.hypot(dx, dz), min = G.body + e.data.radius;
        if (d >= min || d < 1e-4) continue;
        if (e.data.boss) { m.pos.x -= (dx / d) * (min - d); m.pos.z -= (dz / d) * (min - d); }
        else { e.position.x += (dx / d) * (min - d); e.position.z += (dz / d) * (min - d); }
      }
      if (m.phase === 'play') {
        const dx = m.pos.x - p.position.x, dz = m.pos.z - p.position.z, d = Math.hypot(dx, dz), min = G.body + (p.hero ? p.hero.radius : 0.6);
        if (d < min && d > 1e-4) { m.pos.x += (dx / d) * (min - d); m.pos.z += (dz / d) * (min - d); }
        if (c.world) c.world.resolveCircle(m.pos, G.wall);
        this.place(m);
      }
    }
  }

  clear() {
    for (const f of this.flying) { const e = f.e; if (e.alive) { e.position.y = 0; if (e.model) e.model.rotation.x = 0; } }
    this.flying.length = 0;
    for (const p of this.c.players) { const m = p.giant; if (m) { m.act = null; m.weave = null; m.target = null; m.pending = null; } }
  }
}
