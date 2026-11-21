// Velocidade Rasga-Tempo (lendária da Lança, 12/11/2026): as regras do T-Rex. combat.rex = RexKit.
// Dados em l1bless.js (L1.rex), modelo em rex.js, efeitos (portal, tela trincada, fogo, barra) em rexfx.js.
// Fases: wait (acabou de pegar a bênção) -> spin (o Cavaleiro gira a lança) -> crack (a tela trinca e o portal abre)
// -> emerge (o T-Rex sai do portal) -> roar -> lick (lambida) -> board (o Cavaleiro monta) -> play
// -> morph (com 250 de vida: vira o dragão negro) -> play -> dying -> fly (o Cavaleiro cai de pé) -> acabou.
// No play: com inimigos o T-Rex anda e ataca sozinho (mordida, estraçalhar; dragão: cuspida de fogo); sem inimigos
// o jogador anda com ele. O Cavaleiro ataca lá de cima para onde mirar, com as bênçãos dele (combat.playerStrike).
// Ganchos: player.js (rexPlayerTick antes da máquina de estados; invencível nas cenas; não rola; reset; placeAt),
// combat.js (hit = todo dano no herói vai para o T-Rex; striking = golpe do bicho, sem bênçãos; tick; clear),
// main.js (câmera afastada; Backspace dá a bênção para testar).
import * as THREE from 'three';
import { audio } from './audio.js';
import { L1 } from './l1bless.js';
import { makeRex } from './rex.js';
import { RexFx, RexUi, makePortal } from './rexfx.js';
import { MechFx } from './mechfx.js';
import { mountedClip, getClip } from './animation.js';

const X = L1.rex;
const GREEN = 0x9dff7a, FIRE = 0xff6a1a, HOT = 0xfff0c0, PURPLE = 0xb040ff;
const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };
const tA = new THREE.Vector3(), tB = new THREE.Vector3();
const INTRO = ['spin', 'crack', 'emerge', 'roar', 'lick', 'board'];
const SEAT_Y = -0.42; // o modelo do Cavaleiro (pés no chão) fica abaixo da sela para ele sentar nela

let C = null;

export const rexOn = (p) => !!(p && p.rex);
export const rexPlaying = (p) => !!(p && p.rex && p.rex.phase === 'play');
// Cenas (chegada, transformação, explosão): nada machuca o Cavaleiro nem o T-Rex.
export const rexInvuln = (p) => !!(p && p.rex && p.rex.phase !== 'play' && p.rex.phase !== 'wait');
export function rexZoom(p) {
  const m = p && p.rex;
  if (!m || m.phase === 'wait') return 1;
  if (m.phase === 'spin') return 1.04;
  if (m.phase === 'crack' || m.phase === 'emerge' || m.phase === 'roar' || m.phase === 'lick') return 1.14;
  if (m.phase === 'dying' || m.phase === 'fly' || m.phase === 'morph') return 1.28;
  return X.zoom;
}

// ---------- Cavaleiro na sela ----------
function seatKnight(p, v) {
  const k = 1 / (v.g.scale.x || 1); // o Cavaleiro fica do tamanho normal em cima do bicho grande
  v.seat.add(p.model);
  p.model.position.set(0, SEAT_Y * k, 0); p.model.rotation.set(0, 0, 0); p.model.scale.setScalar(k);
}
const newRex = (p) => makeRex({ cloth: p.cape, scale: X.scale });
let MOUTH = 0; // até onde vai a boca, à frente do centro (medido no modelo)
function mouthAhead() { if (!MOUTH) { const v = makeRex({ scale: X.scale }); MOUTH = v.mouthAhead; v.dispose(); } return MOUTH; }
function unseatKnight(p) {
  if (p.model.parent !== p.group) p.group.add(p.model);
  p.model.position.set(0, 0, 0); p.model.rotation.set(0, 0, 0); p.model.scale.setScalar(1);
}

// Tira o T-Rex de cena sem explosão (recomeço, troca de herói/arma, volta para a Taverna).
export function rexReset(p) {
  const m = p && p.rex;
  if (p) p.rexUsed = false;
  if (!m) return;
  unseatKnight(p);
  if (m.v) { if (m.v.g.parent) m.v.g.parent.remove(m.v.g); m.v.dispose(); }
  if (m.portal) m.portal.dispose();
  if (m.r0 && p.hero) p.hero.radius = m.r0;
  if (C) C.dropShots(p);
  p.rex = null;
  p.position.y = 0;
  if (C && C.ui.owner === p) { C.ui.show(false); C.ui.owner = null; }
}

export class RexKit {
  constructor(c) {
    this.c = c; C = this;
    this.fx = new RexFx(c.vfx);
    this.mfx = new MechFx(c.vfx);
    this.ui = new RexUi();
    this.striking = false; // golpe do T-Rex/dragão: nenhuma bênção interfere (combat.killed olha isto)
    this.shots = [];       // bolas de fogo voando
    this.light = null;
  }
  log(o) { if (this.c.log) this.c.log(o); }
  get scene() { return this.c.vfx.scene; }
  shake(p, a) { this.c.shakeFor(p, a); }
  text(t, pos, cls, h) { this.c.text.add(t, pos, cls, h); }
  mine(p) { return p === this.c.player; }
  foes() { return this.c.enemies.filter((e) => e.targetable && e.alive && !e.undead); }

  glowLight(pos, k, color) {
    if (!this.light) { this.light = new THREE.PointLight(0xff6a2a, 0, 14, 1.5); this.scene.add(this.light); }
    if (pos) this.light.position.copy(pos);
    if (color != null) this.light.color.setHex(color);
    this.light.intensity += (k - this.light.intensity) * 0.2;
  }

  // ---------- Chamada ----------
  canSummon(p) {
    return !!W(p).rexForm && !p.rexUsed && !p.rex && p.heroId === 'knight' && p.hero && p.hero.weaponId === 'lanca'
      && (p.state === 'idle' || p.state === 'run') && !p.frozen && !p.choosing && this.c.world;
  }
  summon(p) {
    const world = this.c.world;
    // Portal: de preferência "acima" do Cavaleiro na tela (fica de frente para a câmera), com espaço para o T-Rex.
    let best = null;
    for (const [dx, dz] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {
      for (const dist of [10, 8.5, 7]) {
        const q = v3(p.position.x + dx * dist, 0, p.position.z + dz * dist), q0 = q.clone();
        world.resolveCircle(q, 1.6);
        const sd = mouthAhead() + 0.5; // a cabeça para em cima do Cavaleiro (para a lambida)
        const stop = v3(p.position.x + dx * sd, 0, p.position.z + dz * sd), s0 = stop.clone();
        world.resolveCircle(stop, X.radius);
        const err = q.distanceTo(q0) + stop.distanceTo(s0) * 2 + (dz === -1 ? 0 : 0.6) + (10 - dist) * 0.3;
        if (!best || err < best.err) best = { err, dx, dz, q: q0, stop, dist };
      }
      if (best && best.err < 0.05) break;
    }
    const { dx, dz } = best;
    const face = Math.atan2(-dx, -dz); // o portal e o T-Rex olham para o Cavaleiro
    const m = (p.rex = {
      phase: 'spin', t: 0, hp: X.hp, max: X.hp, dark: false, v: null, portal: null,
      portalAt: best.q, stop: best.stop, face, from: v3(best.q.x + dx * (mouthAhead() + 0.3), 0, best.q.z + dz * (mouthAhead() + 0.3)),
      walk: 0, phaseA: 0, steps: 0, act: null, bites: 0, target: null, stuck: 0, side: 0, sideDir: 1, lastD: 0,
      katk: null, kcombo: 0, kcomboT: 0, kqueued: false, kyaw: 0, r0: p.hero.radius, attached: false, ticked: false,
      spitCd: 0, ambT: 0, flapT: 0, roared: false, licked: false, closed: false, popT: 0,
    });
    p.setState('rex'); p.combo = 0; p.queued = false; p.setGlow(0); p.vel.set(0, 0, 0); p.clearRoll();
    p.facing = Math.atan2(dx, dz); p.group.rotation.y = p.facing; // olha para onde o portal vai abrir
    p.anim.play('Melee_2H_Attack_Spinning', { fade: 0.12, restart: true, speed: 1.7 });
    this.fx.whirl(p, X.intro.spin + 0.25);
    audio.play('rexWhirl', p.position.x, p.position.z);
    this.text('VELOCIDADE RASGA-TEMPO!', p.position, 'big', 3.6);
    if (this.mine(p)) { this.ui.owner = p; this.ui.letterbox(true); }
    this.log({ type: 'rexCall' });
  }

  // Dano do T-Rex num inimigo: valor fixo, sem bônus de bênção (decisão do dono: bênçãos só nos golpes do Cavaleiro).
  damage(p, e, dmg, nx, nz, opts = {}) {
    if (!e.targetable || e.immune) return false;
    if (this.c.kit2 && this.c.kit2.duelBlocks(p, e)) return false;
    e.lastHitBy = p;
    this.striking = true;
    let died = false;
    try {
      died = e.takeDamage(dmg, nx, nz, opts.push ?? (e.data.boss ? 0.8 : 3), true, !!opts.noStagger);
      this.text(String(dmg), e.position, opts.cls || 'crit', 2.8);
      if (opts.burn && !died) { e.burn = opts.burn; e.burnDps = X.spit.burnDps; e.burnTick = 0.5; e.burnBy = p; }
      this.log({ type: 'rexHit', enemy: e, dmg, died, kind: opts.kind || 'bite' });
      if (died) this.c.killed(e, nx, nz, p);
    } finally { this.striking = false; }
    return true;
  }
  blast(p, x, z, r, dmg, opts = {}) {
    let n = 0;
    for (const e of [...this.c.enemies]) {
      if (e.undead) continue;
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      if (d > r + e.data.radius) continue;
      if (this.damage(p, e, dmg, dx / d, dz / d, opts)) n++;
    }
    if (this.c.props) this.c.props.strikeArc({ position: { x, z }, facing: 0 }, r, Math.PI);
    return n;
  }

  // ---------- Dano recebido: vai todo para o T-Rex ----------
  // Devolve undefined se o herói não está no T-Rex (o jogo segue normal).
  hit(p, e, base, opts = {}) {
    const m = p.rex;
    if (!m || m.phase === 'wait') return undefined;
    if (m.phase !== 'play' || p.ultTime > 0 || this.c.godRex) return false;
    const dx = p.position.x - e.position.x, dz = p.position.z - e.position.z, d = Math.hypot(dx, dz) || 0.001;
    const nx = dx / d, nz = dz / d;
    if (opts.contact) { // esbarrão: o T-Rex nem sente; o esqueleto é que sai da frente
      if (e.vel && e.data && !e.data.boss && e.alive) e.vel.set(-nx, 0, -nz).multiplyScalar(5);
      return false;
    }
    const dmg = Math.max(1, Math.round(base));
    m.hp -= dmg;
    m.v.flash(0.9, 1, 0.55, 0.45);
    this.c.vfx.sparks(v3(p.position.x - nx * 1.2, 2.8 + m.v.lift.position.y, p.position.z - nz * 1.2), m.dark ? PURPLE : 0xff4030, 8);
    this.text(String(dmg), p.position, 'hurt', 5.6);
    audio.play('rexHurt', p.position.x, p.position.z);
    this.shake(p, 0.12);
    this.log({ type: 'rexHurt', dmg, hp: m.hp });
    // Com 250 vira o dragão (a transformação sempre acontece: o golpe que passaria disso para no 250).
    if (!m.dark && m.hp <= X.morphAt) { m.hp = X.morphAt; this.startMorph(p); }
    else if (m.dark && m.hp <= 0) this.die(p);
    return true;
  }

  startMorph(p) {
    const m = p.rex;
    this.endAct(p);
    m.phase = 'morph'; m.t = 0; m.katk = null;
    if (m.v) m.v.update(0, { mode: 'morph', k: 0 });
    audio.play('rexMorph', p.position.x, p.position.z);
    this.shake(p, 0.6); this.c.addHitstop(0.1);
    this.text('Ele está mudando...', p.position, 'big', 6.5);
    if (this.mine(p)) this.ui.letterbox(true);
    this.log({ type: 'rexMorph' });
  }

  die(p) {
    const m = p.rex;
    if (!m || m.phase !== 'play') return;
    this.endAct(p);
    m.hp = 0; m.phase = 'dying'; m.t = 0; m.katk = null; m.popT = 0;
    audio.play('rexRoar', p.position.x, p.position.z, { v: 0.8 });
    this.text('O dragão vai explodir!', p.position, 'hurt', 7);
    this.c.addHitstop(0.1); this.shake(p, 0.6);
    this.log({ type: 'rexDown' });
  }

  // Termina uma ação do T-Rex (solta quem estava na boca).
  endAct(p) {
    const m = p.rex, a = m && m.act;
    if (!a) return;
    if (a.held && a.held.alive) { a.held.position.y = 0; a.held.heldByRex = false; }
    m.act = null;
  }

  // ---------- A cada quadro (cenas, transformação, explosão, luz, barra) ----------
  tick(dt) {
    const c = this.c;
    let lit = 0, lightAt = null, lightCol = null;
    for (const p of c.players) {
      if (!p.rex) {
        if (this.canSummon(p)) { p.rexWait = (p.rexWait || 0) + dt; if (p.rexWait >= X.intro.wait) { p.rexWait = 0; this.summon(p); } } else p.rexWait = 0;
        continue;
      }
      const m = p.rex, I = X.intro;
      if (p.state === 'dead') { rexReset(p); p.rexUsed = true; continue; }
      m.t += dt;
      if (m.portal) {
        const open = m.phase === 'crack' ? smooth(m.t / I.crack) : m.phase === 'board' ? 1 - smooth((m.t - I.board * 0.45) / (I.board * 0.5)) : 1;
        m.portal.update(dt, open);
        if (open > 0.3 && Math.random() < dt * 30) this.fx.leaves(m.portal, 1);
        lightAt = tA.set(m.portalAt.x, 3, m.portalAt.z).clone(); lit = 0; lightCol = GREEN;
      }
      if (m.phase === 'spin') {
        if (Math.random() < dt * 24) c.vfx.dust(v3(p.position.x + (Math.random() - 0.5) * 4, 0, p.position.z + (Math.random() - 0.5) * 4), v3(0, 1, 0), 1);
        if (m.t > I.spin * 0.5) this.shake(p, 0.05 + (m.t / I.spin) * 0.12);
        if (m.t >= I.spin) { // A TELA TRINCA
          m.phase = 'crack'; m.t = 0;
          m.portal = makePortal(this.scene, m.portalAt.x, m.portalAt.z, m.face);
          if (this.mine(p)) { this.ui.crack(); this.ui.flash(); }
          audio.play('rexCrack', p.position.x, p.position.z); audio.play('portalOpen', m.portalAt.x, m.portalAt.z);
          this.shake(p, 0.9); c.addHitstop(0.12);
          p.anim.play('Melee_2H_Idle', { fade: 0.15, restart: true });
          this.log({ type: 'rexCrack' });
        }
      } else if (m.phase === 'crack') {
        if (m.t >= I.crack) {
          m.phase = 'emerge'; m.t = 0;
          const v = (m.v = newRex(p));
          this.scene.add(v.g); v.g.position.copy(m.from); v.g.rotation.y = m.face;
          v.clip(m.portal.plane);
          v.snap({ mode: 'idle' });
          this.log({ type: 'rexEmerge' });
        }
      } else if (m.phase === 'emerge') {
        const k = clamp01(m.t / I.emerge), v = m.v;
        const e = k; // passo firme e constante
        v.g.position.set(m.from.x + (m.stop.x - m.from.x) * e, 0, m.from.z + (m.stop.z - m.from.z) * e);
        const dist = Math.hypot(m.stop.x - m.from.x, m.stop.z - m.from.z) / I.emerge;
        const before = Math.floor(m.phaseA / Math.PI + 0.5);
        m.phaseA += dt * dist / 2.6 * Math.PI;
        if (Math.floor(m.phaseA / Math.PI + 0.5) !== before && k > 0.15) this.footfall(p, m.v, m.steps++);
        v.update(dt, { mode: 'walk', walk: 1 - smooth((k - 0.85) / 0.15), phase: m.phaseA });
        if (k >= 1) { m.phase = 'roar'; m.t = 0; }
      } else if (m.phase === 'roar') {
        const k = clamp01(m.t / I.roar);
        m.v.update(dt, { mode: 'roar', k });
        if (!m.roared && k > 0.18) {
          m.roared = true;
          audio.play('rexRoar', m.stop.x, m.stop.z);
          this.shake(p, 0.8);
          this.mfx.shock(m.stop.x, m.stop.z, 9, 0xd8ffd0, 0.6);
          c.vfx.dust(v3(m.stop.x, 0, m.stop.z), v3(0, 1, 0), 10);
          // O rugido deixa os esqueletos em volta tontos (sem dano).
          for (const e of [...c.enemies]) if (!e.undead && !e.data.boss && Math.hypot(e.position.x - m.stop.x, e.position.z - m.stop.z) < 9 && e.daze) e.daze(1.2);
          p.anim.play('Hit_A', { once: true, restart: true, fade: 0.08 });
        }
        if (k >= 1) { m.phase = 'lick'; m.t = 0; p.anim.play('Melee_2H_Idle', { fade: 0.2 }); }
      } else if (m.phase === 'lick') {
        const k = clamp01(m.t / I.lick);
        m.v.update(dt, { mode: 'lick', k });
        if (!m.licked && k > 0.42) {
          m.licked = true;
          m.v.g.updateMatrixWorld(true); m.v.tongueTip.getWorldPosition(tA);
          this.fx.slime(v3(p.position.x, 1.9, p.position.z), 12);
          this.text('Lambida!', p.position, 'big', 4.2);
          audio.play('rexLick', p.position.x, p.position.z);
          p.anim.play('Hit_B', { once: true, restart: true, fade: 0.06 });
        }
        if (k >= 1) {
          m.phase = 'board'; m.t = 0;
          p.anim.play('Jump_Full_Long', { once: true, restart: true, fade: 0.08, speed: 1.17 / I.board });
          m.jumpFrom = p.position.clone();
        }
      } else if (m.phase === 'board') {
        const k = clamp01(m.t / I.board), jk = clamp01((k - 0.12) / 0.88), v = m.v;
        v.update(dt, { mode: 'kneel', k: Math.sin(k * Math.PI) });
        v.g.updateMatrixWorld(true); v.seat.getWorldPosition(tA);
        const e = smooth(jk);
        p.position.set(m.jumpFrom.x + (tA.x - m.jumpFrom.x) * e, (tA.y + SEAT_Y) * e + Math.sin(jk * Math.PI) * 2.6, m.jumpFrom.z + (tA.z - m.jumpFrom.z) * e);
        p.facing = Math.atan2(tA.x - m.jumpFrom.x, tA.z - m.jumpFrom.z) || p.facing; p.group.rotation.y = p.facing;
        if (!m.closed && k > 0.9) { m.closed = true; if (this.mine(p)) this.ui.flash(); audio.play('portalOpen', m.portalAt.x, m.portalAt.z, { v: 0.5 }); }
        if (k >= 1) this.mount(p, true);
      } else if (m.phase === 'play') {
        if (!m.ticked && m.v) m.v.update(dt, { mode: 'idle', walk: 0 }); // cena (ultimate, chefe): parado
        m.ticked = false;
        this.ambient(p, dt);
      } else if (m.phase === 'morph') {
        const k = clamp01(m.t / X.morph), v = m.v;
        v.dark = smooth(k / 0.6); v.wingK = smooth((k - 0.25) / 0.6);
        v.update(dt, { mode: 'morph', k, walk: 0 });
        if (Math.random() < dt * 40) { v.g.updateMatrixWorld(true); v.body.getWorldPosition(tA); this.fx.shadowSmoke(tA, 2, 1.3); }
        if (!m.roared2 && k > 0.55) {
          m.roared2 = true;
          audio.play('rexRoar', p.position.x, p.position.z); audio.play('wingFlap', p.position.x, p.position.z);
          this.mfx.shock(p.position.x, p.position.z, 11, PURPLE, 0.7); this.mfx.shock(p.position.x, p.position.z, 7, FIRE, 0.5, 0.3);
          c.vfx.dust(v3(p.position.x, 0, p.position.z), v3(0, 1, 0), 14);
          this.shake(p, 0.9);
          if (this.mine(p)) { this.ui.flash(); this.ui.title('Dragão das Trevas', 'SEGUNDA FORMA', true); }
        }
        if (k >= 1) {
          m.phase = 'play'; m.t = 0; m.dark = true; v.dark = 1; v.wingK = 1; m.spitCd = 0.3;
          if (this.mine(p)) this.ui.letterbox(false);
          this.log({ type: 'rexDragon' });
        }
      } else if (m.phase === 'dying') {
        const k = clamp01(m.t / X.dying), v = m.v;
        v.update(dt, { mode: 'dying', k });
        v.glow = k * 2;
        m.popT -= dt;
        if (m.popT <= 0) { // fogo saindo pelo corpo
          m.popT = 0.15 - k * 0.07;
          const pt = v.parts[Math.floor(Math.random() * v.parts.length)];
          pt.getWorldPosition(tA);
          this.mfx.flare(tA.clone(), 3 + k * 2, FIRE, 0.3); c.vfx.sparks(tA.clone(), FIRE, 6);
          v.flash(0.22, 1, 0.3, 0.05);
          audio.play('boom', tA.x, tA.z, { v: 0.45 }); this.shake(p, 0.15 + k * 0.2);
        }
        if (k >= 1) this.explode(p);
      } else if (m.phase === 'fly') { // o Cavaleiro cai de pé
        const k = clamp01(m.t / X.fly);
        p.position.set(m.ej.from.x + (m.ej.to.x - m.ej.from.x) * k, m.ej.from.y * (1 - k) + Math.sin(k * Math.PI) * 2.8, m.ej.from.z + (m.ej.to.z - m.ej.from.z) * k);
        p.model.rotation.x = -k * Math.PI * 2;
        if (Math.random() < dt * 40) this.mfx.embers(p.position.clone(), 1, 0.3, FIRE, 1);
        if (k >= 1) this.finish(p);
      }
      if (p.rex && p.rex.v && (p.rex.phase === 'play' || p.rex.phase === 'morph' || p.rex.phase === 'dying')) {
        const vv = p.rex.v; vv.g.updateMatrixWorld(true); vv.head.getWorldPosition(tB);
        if (p.rex.dark || p.rex.phase === 'dying') { lightAt = tB.clone(); lit = Math.max(lit, 9 + vv.glow * 12); lightCol = FIRE; }
      }
      if (p.rex && this.mine(p) && (p.rex.phase === 'play' || p.rex.phase === 'morph' || p.rex.phase === 'dying')) this.ui.set(p.rex.hp, p.rex.max, p.rex.dark || p.rex.phase === 'morph', dt);
    }
    if (this.light || lightAt) this.glowLight(lightAt, lit, lightCol);
    this.ui.frame();
    this.tickShots(dt);
  }

  // Monta: daqui em diante o herói É o T-Rex (o Cavaleiro vai sentado na sela).
  mount(p, title) {
    const m = p.rex, v = m.v;
    m.phase = 'play'; m.t = 0;
    v.clip(null);
    if (m.portal) { m.portal.dispose(); m.portal = null; }
    p.position.set(v.g.position.x, 0, v.g.position.z); p.facing = m.face; p.group.rotation.y = m.face;
    p.group.add(v.g); v.g.position.set(0, 0, 0); v.g.rotation.y = 0; m.attached = true;
    seatKnight(p, v);
    p.anim.play(mountedClip('Melee_2H_Idle'), { fade: 0.1, restart: true });
    if (this.mine(p)) {
      this.ui.letterbox(false); this.ui.show(true); this.ui.chip = 1; this.ui.hp = -1;
      if (title) this.ui.title('Velocidade Rasga-Tempo', 'LENDÁRIA');
    }
    audio.play('rexRoar', p.position.x, p.position.z, { v: 0.6 });
    this.log({ type: 'rexReady' });
  }

  // Sala nova no meio da cena: termina do jeito mais simples (já montado).
  skipIntro(p) {
    const m = p.rex;
    if (!m.v) { m.v = newRex(p); this.scene.add(m.v.g); }
    m.v.g.position.set(p.position.x, 0, p.position.z); m.face = p.facing;
    this.mount(p, false);
  }

  // Fumaça do dragão, passos, bater de asas.
  ambient(p, dt) {
    const m = p.rex, v = m.v;
    if (!v) return;
    m.ambT -= dt;
    if (m.dark && m.ambT <= 0) { m.ambT = 0.12; v.g.updateMatrixWorld(true); v.body.getWorldPosition(tA); this.fx.shadowSmoke(tA, 1, 0.9); }
    if (m.dark) {
      m.flapT += dt * 7.5;
      if (m.flapT > Math.PI * 2) { m.flapT -= Math.PI * 2; audio.play('wingFlap', p.position.x, p.position.z, { v: 0.5 }); this.c.vfx.dust(v3(p.position.x, 0, p.position.z), v3(0, 1, 0), 3); }
    }
  }

  footfall(p, v, n) {
    const L = v.legs[n % 2];
    v.g.updateMatrixWorld(true); L.foot.getWorldPosition(tA);
    this.c.vfx.dust(v3(tA.x, 0, tA.z), v3(0, 1, 0), 4);
    this.mfx.shock(tA.x, tA.z, 1.3, 0xd8c8a8, 0.28, 0.12);
    this.shake(p, 0.06);
    audio.play('rexStep', tA.x, tA.z);
  }

  // Explosão final: o dragão explode em fogo, quem está perto leva 150 e fica queimando; o Cavaleiro cai de pé.
  explode(p) {
    const m = p.rex, v = m.v, c = this.c, scene = this.scene, x = p.position.x, z = p.position.z;
    v.g.updateMatrixWorld(true); v.seat.getWorldPosition(tA);
    const from = v3(tA.x, Math.max(0.5, tA.y + SEAT_Y), tA.z);
    const back = p.facing + Math.PI, to = v3(x + Math.sin(back) * 3.6, 0, z + Math.cos(back) * 3.6);
    if (c.world) c.world.resolveCircle(to, m.r0 || 0.6);
    unseatKnight(p);
    if (p.hero) p.hero.radius = m.r0;
    // As partes grandes voam pegando fogo e somem.
    scene.attach(v.g);
    const center = v3(x, 3, z);
    for (const part of v.parts) {
      scene.attach(part);
      part.material = part.material.clone(); part.material.transparent = true;
      part.material.color.setHex(0x1c1216); part.material.emissive = new THREE.Color(0xff5a10); part.material.emissiveIntensity = 1.2; // carvão em brasa
      const dir = part.position.clone().sub(center); dir.y = Math.abs(dir.y) * 0.4 + 0.5; dir.normalize();
      const vel = dir.multiplyScalar(3 + Math.random() * 4); vel.y += 4 + Math.random() * 4;
      const spin = v3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10), s0 = part.scale.clone();
      c.vfx.items.push({ obj: part, life: 1.0 + Math.random() * 0.4, age: 0, tick: (o, k, dt) => {
        vel.y -= 26 * dt; o.position.addScaledVector(vel, dt);
        if (o.position.y < 0.4) { o.position.y = 0.4; vel.y *= -0.35; vel.x *= 0.6; vel.z *= 0.6; }
        o.rotation.x += spin.x * dt; o.rotation.y += spin.y * dt; o.rotation.z += spin.z * dt;
        o.material.emissiveIntensity = 1.2 * (1 - k);
        o.scale.copy(s0).multiplyScalar(Math.max(0.01, 1 - k * k)); // vira cinza e some
        if (k > 0.6) o.material.opacity = 1 - (k - 0.6) / 0.4;
        if (Math.random() < 0.15) this.mfx.embers(o.position.clone(), 1, 0.2, FIRE, 1);
      } });
    }
    scene.remove(v.g);
    c.vfx.items.push({ obj: new THREE.Object3D(), life: 2.6, age: 0, tick: (o, k) => { if (k >= 1) v.dispose(); } });
    for (const [dy, s] of [[3, 2.6], [1.2, 2.0], [5, 1.8]]) this.mfx.explosion(v3(x, dy, z), s);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; this.mfx.flare(v3(x + Math.sin(a) * 3.5, 1, z + Math.cos(a) * 3.5), 4, i % 2 ? FIRE : 0xffb030, 0.5); }
    this.mfx.impact(x, z, 1.8, FIRE);
    this.mfx.shock(x, z, X.boom.r * 1.7, FIRE, 0.8); this.mfx.shock(x, z, X.boom.r, PURPLE, 0.6, 0.3);
    this.mfx.pillar(x, z, 15, 3.4, FIRE, 0.7);
    this.mfx.smoke(v3(x, 1, z), 12, 1.5);
    this.mfx.embers(center, 34, 3, FIRE, 6);
    const n = this.blast(p, x, z, X.boom.r, X.boom.dmg, { burn: X.boom.burn, kind: 'boom', push: 6 });
    this.shake(p, 1.2); c.addHitstop(0.14);
    audio.play('rexExplode', x, z);
    if (this.mine(p)) { this.ui.flash(); this.ui.show(false); }
    this.text('O dragão explodiu!', { x, z }, 'big', 5);
    m.phase = 'fly'; m.t = 0; m.ej = { from, to }; m.attached = false; m.v = null;
    p.position.copy(from);
    p.anim.play('Jump_Idle', { fade: 0.05, restart: true });
    this.log({ type: 'rexExplode', hits: n });
  }

  finish(p) {
    const m = p.rex;
    p.rex = null; p.rexUsed = true;
    p.position.y = 0; p.model.rotation.set(0, 0, 0);
    if (p.hero) p.hero.radius = m.r0;
    p.iframes = Math.max(p.iframes, 2);
    p.setState('idle'); p.anim.play(p.hero.anims.idle, { fade: 0.15 });
    this.c.vfx.dust(p.position, v3(0, 1, 0), 8);
    audio.play('dodge', p.position.x, p.position.z);
    if (this.ui.owner === p) this.ui.owner = null;
    this.log({ type: 'rexEnd' });
  }

  clear() {
    for (const p of this.c.players) {
      const m = p.rex;
      if (!m) continue;
      this.endAct(p);
      if (INTRO.includes(m.phase)) this.skipIntro(p);
      else if (m.phase === 'morph') { m.phase = 'play'; m.dark = true; m.v.dark = 1; m.v.wingK = 1; if (this.mine(p)) this.ui.letterbox(false); }
      else if (m.phase === 'dying' || m.phase === 'fly') { rexReset(p); p.rexUsed = true; p.setState('idle'); }
    }
    this.dropShots();
  }

  // ---------- Bolas de fogo ----------
  dropShots(p = null) {
    for (let i = this.shots.length - 1; i >= 0; i--) { const s = this.shots[i]; if (!p || s.p === p) { s.fb.dispose(); this.shots.splice(i, 1); } }
  }
  fire(p, target) {
    const m = p.rex, v = m.v;
    p.group.updateMatrixWorld(true); v.head.localToWorld(tA.set(0, -0.1, 1.7));
    const from = tA.clone();
    const tx = target ? target.position.x : p.position.x + Math.sin(p.facing) * 10, tz = target ? target.position.z : p.position.z + Math.cos(p.facing) * 10;
    const dir = v3(tx - from.x, 0.9 - from.y, tz - from.z), dist = dir.length(); dir.normalize();
    const fb = this.fx.fireball(); fb.g.position.copy(from);
    this.shots.push({ p, fb, pos: from, vel: dir.multiplyScalar(X.spit.speed), t: 0, life: Math.max(0.3, dist / X.spit.speed + 0.15), target });
    this.mfx.flare(from.clone(), 3.2, FIRE, 0.25);
    audio.play('fireSpit', from.x, from.z);
    this.log({ type: 'rexSpit' });
  }
  tickShots(dt) {
    const c = this.c;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.t += dt; s.pos.addScaledVector(s.vel, dt); s.fb.g.position.copy(s.pos); s.fb.tick(dt, s.t);
      if (Math.random() < dt * 50) this.mfx.embers(s.pos.clone(), 1, 0.25, Math.random() < 0.5 ? FIRE : 0xffc040, 1);
      let boom = s.t >= s.life || s.pos.y <= 0.3;
      if (!boom) for (const e of c.enemies) { if (e.targetable && !e.undead && Math.hypot(e.position.x - s.pos.x, e.position.z - s.pos.z) < e.data.radius + 0.7) { boom = true; break; } }
      if (!boom && c.world) { const q = v3(s.pos.x, 0, s.pos.z), q0 = q.clone(); c.world.resolveCircle(q, 0.3); if (q.distanceTo(q0) > 0.05) boom = true; }
      if (!boom) continue;
      const x = s.pos.x, z = s.pos.z;
      s.fb.dispose(); this.shots.splice(i, 1);
      const n = this.blast(s.p, x, z, X.spit.r, X.spit.dmg, { burn: X.spit.burn, kind: 'fire', cls: 'burn', push: 2.5 });
      this.mfx.explosion(v3(x, 1, z), 1.1);
      this.mfx.shock(x, z, X.spit.r * 1.4, FIRE, 0.45);
      this.mfx.crack(x, z, 2.2, 3, FIRE);
      c.vfx.flameCone(v3(x, 0.1, z), 0, X.spit.r, Math.PI, FIRE, true);
      audio.play('boom', x, z, { v: 0.8 });
      if (n) c.addHitstop(0.04);
      this.shake(s.p, 0.18);
      this.log({ type: 'rexBoom', hits: n });
    }
  }

  // ---------- Golpes do Cavaleiro (lá de cima, para onde mirar, com as bênçãos dele) ----------
  knightStep(p, i) {
    const combo = p.hero.combo || [];
    const base = combo[Math.min(i, combo.length - 1)] || { clip: 'Melee_2H_Attack_Stab', speed: 1.4, hit: 0.27, end: 0.55, damage: 13 };
    const st = { ...base };
    for (const k of ['kit', 'throw', 'cast', 'xstep', 'auto']) delete st[k]; // arremessos e golpes especiais não saem de cima do T-Rex
    if (!st.clip || !/^Melee_/.test(st.clip)) st.clip = 'Melee_2H_Attack_Stab';
    return st;
  }
  knightStart(p, camera) {
    const m = p.rex, i = m.kcombo, st = this.knightStep(p, i);
    const speed = (st.speed || 1) * (p.atkSpeed || 1), dur = getClip(st.clip).duration / speed;
    m.katk = { i, t: 0, dur, hit: (st.hit ?? 0.4) * dur, end: (st.end ?? 0.8) * dur, aim: p.aimAngle(camera), done: false, st };
    m.kqueued = false;
    m.kcombo = (i + 1) % Math.max(1, (p.hero.combo || [1, 1, 1]).length);
    p.anim.play(mountedClip(st.clip), { once: true, restart: true, fade: 0.05, speed });
    audio.play(st.heavy ? 'swingHeavy' : 'swing', p.position.x, p.position.z);
    p.swingSeq = (p.swingSeq || 0) + 1;
    this.log({ type: 'rexKnightAtk', i });
  }
  knightStrike(p, a) {
    const f0 = p.facing, st = p.stats, rm = st.rangeMul;
    p.facing = a.aim; st.rangeMul = rm * X.reach;
    try { this.c.playerStrike(p, a.st); } finally { p.facing = f0; st.rangeMul = rm; }
    this.log({ type: 'rexKnightHit', i: a.i });
  }

  // ---------- Ações do T-Rex ----------
  startAct(p, kind, target) {
    const m = p.rex;
    const D = kind === 'spit' ? X.spit : kind === 'shred' ? X.shred : X.bite;
    m.act = { kind, t: 0, dur: D.dur, target, hit: false, hits: 0, held: null };
    if (kind === 'shred' && target && target.alive && !target.data.boss && target.daze && target.daze(D.dur + 0.2)) { m.act.held = target; target.heldByRex = true; }
    if (kind === 'bite' || kind === 'shred') audio.play('rexBite', p.position.x, p.position.z, { v: 0.6 });
    this.log({ type: 'rexAct', kind });
  }
  mouthPos(p, out) { const v = p.rex.v; p.group.updateMatrixWorld(true); return v.head.localToWorld(out.set(0, -0.3, 1.25)); }
  actTick(p, dt) {
    const m = p.rex, a = m.act, c = this.c;
    a.t += dt;
    const k = a.t / a.dur;
    if (a.kind === 'bite') {
      if (!a.hit && k >= X.bite.hit) {
        a.hit = true;
        const fx = Math.sin(p.facing), fz = Math.cos(p.facing), M = mouthAhead(), mx = p.position.x + fx * M, mz = p.position.z + fz * M;
        let n = 0;
        for (const e of [...c.enemies]) { // tudo na frente do T-Rex, do peito até a boca
          if (e.undead || !e.targetable) continue;
          const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, r = e.data.radius;
          const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
          if (along < 0.3 || along > M + r + 0.9 || side > X.bite.side + r) continue;
          if (this.damage(p, e, X.bite.dmg, fx, fz, { kind: 'bite' })) n++;
        }
        if (c.props) c.props.strikeArc(p, M + 1, 0.4);
        this.mouthPos(p, tA); c.vfx.sparks(tA.clone(), 0xffffff, 6);
        audio.play(n ? 'hitHeavy' : 'swingHeavy', mx, mz);
        audio.play('rexBite', mx, mz);
        if (n) { c.addHitstop(0.06); this.shake(p, 0.2); m.bites++; }
      }
    } else if (a.kind === 'shred') {
      const e = a.held;
      if (e && e.alive) { this.mouthPos(p, tA); e.position.set(tA.x, Math.max(0, tA.y - 1.3), tA.z); e.vel && e.vel.set(0, 0, 0); }
      const marks = [0.3, 0.55, 0.8];
      while (a.hits < marks.length && k >= marks[a.hits]) {
        a.hits++;
        const t = a.target;
        if (t && t.alive && t.targetable) {
          const last = a.hits === marks.length;
          const dmg = Math.round(X.shred.dmg / marks.length);
          const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
          if (last && e && e.alive) { e.position.y = 0; e.heldByRex = false; a.held = null; }
          this.damage(p, t, dmg, fx, fz, { kind: 'shred', push: last ? 9 : 0.1, noStagger: !last });
          this.mouthPos(p, tA); c.vfx.sparks(tA.clone(), 0xffe0e0, 10);
          if (last) this.text('Estraçalhou!', t.position, 'crit', 3.6);
          audio.play('rexShred', p.position.x, p.position.z);
          this.shake(p, 0.22); c.addHitstop(0.05);
        }
      }
    } else if (a.kind === 'spit') {
      if (!a.hit && k >= X.spit.hit) { a.hit = true; this.fire(p, a.target && a.target.alive ? a.target : null); }
    }
    if (k >= 1) { this.endAct(p); if (a.kind === 'spit') m.spitCd = X.spit.cd; }
  }

  // ---------- Controle (chamado pelo herói a cada quadro) ----------
  playerTick(p, dt, world, input, move, camera) {
    const m = p.rex, c = this.c;
    if (p.state === 'cine') return false; // ultimate / cena do chefe: a cena manda
    if (p.state !== 'rex') p.setState('rex'); // nada tira o Cavaleiro de cima (empurrão, agarrão, círculo)
    p.vel.set(0, 0, 0); p.grabImmune = 1; p.combo = 0;
    if (m.phase !== 'play') {
      if (m.attached) p.group.rotation.y = p.facing;
      if (m.phase === 'morph' || m.phase === 'dying') world.resolveCircle(p.position, X.wall);
      return true;
    }
    const v = m.v;
    if (p.hero.radius !== X.radius) p.hero.radius = X.radius; // (as bênçãos de arma refazem os dados do herói)
    m.ticked = true;
    // --- Cavaleiro: ataca para onde mirar ---
    const atkPress = input.attack();
    if (!m.katk && atkPress) this.knightStart(p, camera);
    else if (m.katk && atkPress) m.kqueued = true;
    let yawWant = 0;
    if (m.katk) {
      const a = m.katk; a.t += dt;
      if (a.t < a.dur * 0.3) a.aim = p.aimAngle(camera);
      yawWant = wrap(a.aim - p.facing);
      if (!a.done && a.t >= a.hit) { a.done = true; this.knightStrike(p, a); }
      if (a.done && m.kqueued && a.t >= a.end) this.knightStart(p, camera);
      else if (a.t >= a.dur) { m.katk = null; m.kcomboT = 0.8; p.anim.play(mountedClip('Melee_2H_Idle'), { fade: 0.15 }); }
    } else if (m.kcomboT > 0) { m.kcomboT -= dt; if (m.kcomboT <= 0) m.kcombo = 0; }
    m.kyaw += wrap(yawWant - m.kyaw) * (1 - Math.exp(-(m.katk ? 22 : 6) * dt));
    p.model.rotation.y = m.kyaw;
    // --- T-Rex ---
    if (m.spitCd > 0) m.spitCd -= dt;
    const foes = this.foes();
    let want = p.facing, mx = 0, mz = 0, speed = p.hero.moveSpeed * (m.dark ? X.flySpeed : X.speed), turn = X.turn, look = 0;
    if (m.act) {
      this.actTick(p, dt, world);
      const t = m.act && m.act.target;
      if (t && t.alive && m.act && m.act.t < m.act.dur * 0.45) want = Math.atan2(t.position.x - p.position.x, t.position.z - p.position.z);
      else turn = 0;
      speed = 0;
    } else if (foes.length) { // sozinho: vai atrás do inimigo mais perto
      let t = m.target;
      if (!t || !t.alive || !t.targetable || t.undead) t = null;
      let best = null, bd = Infinity;
      for (const e of foes) { const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z); if (d < bd) { bd = d; best = e; } }
      if (!t || (best !== t && bd < Math.hypot(t.position.x - p.position.x, t.position.z - p.position.z) - 2.5)) t = best;
      m.target = t;
      const dx = t.position.x - p.position.x, dz = t.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      want = Math.atan2(dx, dz);
      const off = Math.abs(wrap(want - p.facing));
      look = wrap(want - p.facing);
      if (m.dark) { // dragão: mantém distância e cospe fogo
        if (m.spitCd <= 0 && d <= X.spit.max && off < 0.45) this.startAct(p, 'spit', t);
        else if (d > X.spit.keep + 1) { mx = dx / d; mz = dz / d; }
        else if (d < X.spit.keep - 2.5) { mx = -dx / d; mz = -dz / d; want = Math.atan2(dx, dz); speed *= 0.7; }
      } else {
        const reach = mouthAhead() + t.data.radius + 0.5;
        if (d <= reach && off < 0.45) {
          const shred = (m.bites + 1) % X.shred.every === 0;
          this.startAct(p, shred ? 'shred' : 'bite', t);
        } else if (d > reach - 0.4) { mx = dx / d; mz = dz / d; speed *= off > 1.2 ? 0.35 : 1; }
      }
      // Preso num pilar: dá um passo de lado.
      if (mx || mz) {
        if (m.side > 0) { m.side -= dt; const sx = -mz * m.sideDir, sz = mx * m.sideDir; mx = mx * 0.3 + sx; mz = mz * 0.3 + sz; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l; }
        m.stuck += dt;
        if (m.stuck > 0.8) { if (m.lastD - d < 0.4) { m.side = 0.7; m.sideDir = Math.random() < 0.5 ? -1 : 1; } m.stuck = 0; m.lastD = d; }
      }
    } else { // sem inimigos: o jogador guia
      m.target = null;
      if (move.lengthSq() > 0) { mx = move.x; mz = move.z; want = Math.atan2(move.x, move.z); }
    }
    // Anda (passos pesados; voando, sem passos).
    const moving = (mx || mz) && speed > 0.01;
    if (moving) {
      const dist = speed * dt * (m.act ? 0 : 1), n = Math.max(1, Math.ceil(dist / 0.25));
      for (let i = 0; i < n; i++) { p.position.x += mx * dist / n; p.position.z += mz * dist / n; world.resolveCircle(p.position, X.wall); }
      const before = Math.floor(m.phaseA / Math.PI + 0.5);
      m.phaseA += (dist / 2.6) * Math.PI;
      if (!m.dark && Math.floor(m.phaseA / Math.PI + 0.5) !== before) this.footfall(p, v, m.steps++);
    } else world.resolveCircle(p.position, X.wall);
    m.walk += ((moving ? 1 : 0) - m.walk) * Math.min(1, dt * 8);
    if (turn > 0) p.facing += wrap(want - p.facing) * (1 - Math.exp(-turn * dt));
    p.group.rotation.y = p.facing;
    const a = m.act;
    v.update(dt, { mode: a ? a.kind : 'walk', k: a ? a.t / a.dur : 0, walk: m.walk, phase: m.phaseA, look: a ? 0 : look * 0.7 });
    return true;
  }
}

// Chamado pelo herói a cada quadro. Devolve true se o T-Rex cuidou do quadro.
export function rexPlayerTick(p, dt, world, input, move, camera) {
  if (!p.rex || !C) return false;
  if (p.rex.phase === 'wait') return false;
  // Cenas antes de montar: o Cavaleiro fica parado (a cena mexe nele).
  if (INTRO.includes(p.rex.phase)) { if (p.state !== 'rex') p.setState('rex'); p.vel.set(0, 0, 0); return true; }
  return C.playerTick(p, dt, world, input, move, camera);
}
