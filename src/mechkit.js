// Forma Final (lendária da Espada e Escudo, 12/11/2026): as regras do robô gigante. combat.mech = MechKit.
// Dados em l1bless.js (L1.mech), modelo em mech.js, efeitos em mechfx.js.
// Fases: wait (acabou de pegar a bênção) -> call (o Cavaleiro chama; runa e coluna de luz) -> drop (o robô cai do
// céu) -> board (o Cavaleiro pula para a cabine) -> rise (levanta, raio na espada) -> play -> dying (explosões,
// ejeta o Cavaleiro) -> acabou (uma vez por partida).
// Ganchos: player.js (mechPlayerTick antes da máquina de estados; invencível nas cenas; não rola; reset; placeAt),
// combat.js (hit = todo dano no herói vai para o robô; tick; clear), main.js (câmera afastada), coop/replica (rede).
import * as THREE from 'three';
import { audio } from './audio.js';
import { L1 } from './l1bless.js';
import { makeMech, MECH_DIM } from './mech.js';
import { MechFx, makeTrail } from './mechfx.js';
import { shieldVisual } from './shield.js';

const M = L1.mech;
const GOLD = 0xffc850, HOT = 0xfff0c0, EMBER = 0xff7a1e;
const DEG = Math.PI / 180;
const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (k) => { k = clamp01(k); return k * k * (3 - 2 * k); };
const tA = new THREE.Vector3(), tB = new THREE.Vector3();
const KNIGHT_SCALE = 0.62;
const PHASES = ['wait', 'call', 'drop', 'board', 'rise', 'play', 'dying', 'fly'];

let C = null; // o kit da partida

export const mechOn = (p) => !!(p && p.mech);
export const mechPlaying = (p) => !!(p && p.mech && p.mech.phase === 'play');
// Nas cenas (chegada e explosão) nada machuca o Cavaleiro.
export const mechInvuln = (p) => !!(p && p.mech && p.mech.phase !== 'play' && p.mech.phase !== 'wait');
// Câmera: quanto afastar (1 = normal).
export function mechZoom(p) {
  const m = p && p.mech;
  if (!m || m.phase === 'wait') return 1;
  if (m.phase === 'call') return 1.12;
  if (m.phase === 'dying' || m.phase === 'fly') return 1.25;
  return M.zoom;
}

// ---------- Cavaleiro na cabine ----------
function hideArms(p, hide) {
  if (p.weapon) p.weapon.visible = !hide;
  if (hide) { if (p.shieldMesh) p.shieldMesh.visible = false; } else shieldVisual(p);
}
export function seatKnight(p, v) {
  v.seat.add(p.model);
  p.model.position.set(0, 0, 0); p.model.rotation.set(0, 0, 0);
  p.model.scale.setScalar(KNIGHT_SCALE / (v.g.scale.x || 1));
  hideArms(p, true);
}
export function unseatKnight(p) {
  if (p.model.parent !== p.group) p.group.add(p.model);
  p.model.position.set(0, 0, 0); p.model.rotation.set(0, 0, 0); p.model.scale.setScalar(1);
  hideArms(p, false);
}

// Tira o robô de cena sem explosão (recomeço, troca de herói, volta para a Taverna).
export function mechReset(p) {
  const m = p && p.mech;
  p.mechUsed = false;
  if (!m) return;
  unseatKnight(p);
  if (m.v) { if (m.v.g.parent) m.v.g.parent.remove(m.v.g); m.v.dispose(); }
  if (m.trail) m.trail.dispose();
  if (m.r0 && p.hero) p.hero.radius = m.r0;
  p.mech = null;
  p.position.y = 0;
  if (C) C.ui.show(p, false, true);
}

// ---------- Barra de vida do robô e cena (letras, faixas pretas) ----------
class MechUi {
  constructor() { this.el = null; this.shown = false; this.hp = -1; this.chip = 1; }
  build() {
    if (this.el || typeof document === 'undefined') return;
    const st = document.createElement('style');
    st.textContent = `
#mechbar { position:fixed; left:50%; bottom:74px; transform:translate(-50%, 30px); width:min(520px, 78vw); opacity:0; pointer-events:none; z-index:7; transition:opacity .35s, transform .35s; font-family:Georgia, serif; }
#mechbar.show { opacity:1; transform:translate(-50%, 0); }
#mechbar .top { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:4px; color:#ffe2a8; text-shadow:0 1px 2px #000, 0 0 10px rgba(255,170,40,.6); }
#mechbar .name { font:bold 15px Georgia, serif; letter-spacing:.22em; text-transform:uppercase; }
#mechbar .name b { color:#ffc24a; margin-right:8px; font-size:17px; }
#mechbar .num { font:bold 14px Georgia, serif; }
#mechbar .bar { position:relative; height:16px; background:linear-gradient(#1a130c, #0c0906); border:2px solid #b8862a; box-shadow:0 0 0 1px #000, 0 0 14px rgba(255,170,40,.35), inset 0 0 6px #000; transform:skewX(-14deg); overflow:hidden; }
#mechbar .chip { position:absolute; left:0; top:0; bottom:0; background:#fff3d0; }
#mechbar .fill { position:absolute; left:0; top:0; bottom:0; background:linear-gradient(#fff0b0, #ffc24a 35%, #d98a14 75%, #9a5a08); box-shadow:0 0 12px rgba(255,190,70,.9); }
#mechbar .fill::after { content:""; position:absolute; inset:0; background:repeating-linear-gradient(90deg, transparent 0 25px, rgba(0,0,0,.45) 25px 27px); }
#mechbar.low .fill { background:linear-gradient(#ffb0a0, #ff5a3a 35%, #c0260f 75%, #7a1206); box-shadow:0 0 12px rgba(255,80,50,.9); animation:mechlow .45s infinite alternate; }
#mechbar.hit .bar { animation:mechhit .22s; }
#mechbar .hint { margin-top:6px; text-align:center; font:bold 13px Georgia, serif; letter-spacing:.12em; color:#fff3c8; text-shadow:0 1px 2px #000, 0 0 12px #ffb030; opacity:0; transition:opacity .15s; }
#mechbar.armed .hint { opacity:1; animation:mecharm .5s infinite alternate; }
@keyframes mechlow { to { filter:brightness(1.5); } }
@keyframes mechhit { 0% { transform:skewX(-14deg) translate(0,0); filter:brightness(2.4); } 30% { transform:skewX(-14deg) translate(-5px,2px); } 60% { transform:skewX(-14deg) translate(4px,-2px); } 100% { transform:skewX(-14deg); } }
@keyframes mecharm { to { transform:scale(1.07); } }
#mechcine { position:fixed; inset:0; pointer-events:none; z-index:6; }
#mechcine .dim { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 45%, rgba(10,6,0,0) 18%, rgba(4,2,0,.82) 78%); opacity:0; transition:opacity .5s; }
#mechcine .bars::before, #mechcine .bars::after { content:""; position:absolute; left:0; right:0; height:0; background:#000; transition:height .45s cubic-bezier(.2,.8,.2,1); }
#mechcine .bars::before { top:0; } #mechcine .bars::after { bottom:0; }
#mechcine.on .dim { opacity:1; } #mechcine.on .bars::before, #mechcine.on .bars::after { height:9vh; }
#mechcine .title { position:absolute; left:0; right:0; top:19%; text-align:center; opacity:0; font-family:"Titulo", Georgia, serif; }
#mechcine .title .t1 { font-size:clamp(40px, 9.5vw, 104px); letter-spacing:.14em; text-transform:uppercase; color:#ffe9b0; background:linear-gradient(#fffbe6, #ffd36a 45%, #c97c12); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; filter:drop-shadow(0 0 18px rgba(255,170,40,.95)) drop-shadow(0 3px 0 #3a1c00); }
#mechcine .title .t2 { margin-top:2px; font:bold clamp(12px, 1.9vw, 20px) Georgia, serif; letter-spacing:.5em; color:#ffc24a; text-shadow:0 1px 3px #000, 0 0 10px #ff9a20; }
#mechcine .title.go { animation:mechtitle 2.3s cubic-bezier(.15,.85,.25,1) forwards; }
#mechcine .flash { position:absolute; inset:0; background:#fff6da; opacity:0; }
#mechcine .flash.go { animation:mechflash .5s ease-out; }
@keyframes mechtitle { 0% { opacity:0; transform:scale(2.3); letter-spacing:.5em; } 12% { opacity:1; transform:scale(1); } 78% { opacity:1; transform:scale(1.04); } 100% { opacity:0; transform:scale(1.1); } }
@keyframes mechflash { 0% { opacity:.85; } 100% { opacity:0; } }`;
    document.head.appendChild(st);
    const bar = (this.el = document.createElement('div')); bar.id = 'mechbar';
    bar.innerHTML = '<div class="top"><span class="name"><b>♜</b>Forma Final</span><span class="num"></span></div><div class="bar"><div class="chip"></div><div class="fill"></div></div><div class="hint">SOLTE O BLOQUEIO: PANCADA!</div>';
    const cine = (this.cine = document.createElement('div')); cine.id = 'mechcine';
    cine.innerHTML = '<div class="dim"></div><div class="bars"></div><div class="flash"></div><div class="title"><div class="t1">Forma Final</div><div class="t2">LENDÁRIA</div></div>';
    document.body.appendChild(cine); document.body.appendChild(bar);
    this.fill = bar.querySelector('.fill'); this.chipEl = bar.querySelector('.chip'); this.num = bar.querySelector('.num');
  }
  mine(p) { return !C || !C.c || p === C.c.player; }
  show(p, on, force = false) {
    if (!force && !this.mine(p)) return;
    this.build(); if (!this.el) return;
    this.el.classList.toggle('show', on); this.shown = on;
    if (!on) { this.el.classList.remove('armed', 'low'); this.letterbox(p, false, true); }
  }
  set(hp, max, armed, dt = 0.016) {
    this.build(); if (!this.el) return;
    const k = clamp01(hp / max);
    if (this.hp >= 0 && hp < this.hp) { this.el.classList.remove('hit'); void this.el.offsetWidth; this.el.classList.add('hit'); }
    this.hp = hp;
    this.chip = k > this.chip ? k : Math.max(k, this.chip - dt * 0.35);
    this.fill.style.width = `${k * 100}%`; this.chipEl.style.width = `${this.chip * 100}%`;
    this.num.textContent = `${Math.max(0, Math.ceil(hp))} / ${max}`;
    this.el.classList.toggle('low', k < 0.3); this.el.classList.toggle('armed', !!armed);
  }
  letterbox(p, on, force = false) { if (!force && !this.mine(p)) return; this.build(); if (this.cine) this.cine.classList.toggle('on', on); }
  title(p) { if (!this.mine(p)) return; this.build(); if (!this.cine) return; const t = this.cine.querySelector('.title'); t.classList.remove('go'); void t.offsetWidth; t.classList.add('go'); }
  flash(p) { if (!this.mine(p)) return; this.build(); if (!this.cine) return; const f = this.cine.querySelector('.flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
}

export class MechKit {
  constructor(c) {
    this.c = c; C = this;
    this.fx = new MechFx(c.vfx);
    this.ui = new MechUi();
    this.light = null;
    this.wrecks = 0;
    this.striking = false;
  }
  log(o) { if (this.c.log) this.c.log(o); }
  get scene() { return this.c.vfx.scene; }
  shake(p, a) { this.c.shakeFor(p, a); }
  text(t, pos, cls, h) { this.c.text.add(t, pos, cls, h); }

  // Luz do núcleo: criada uma vez (ligar/desligar luzes obriga o jogo a refazer os materiais).
  glowLight(pos, k) {
    if (!this.light) { this.light = new THREE.PointLight(0xffb040, 0, 17, 1.5); this.scene.add(this.light); }
    this.light.position.copy(pos); this.light.intensity += (k - this.light.intensity) * 0.2;
  }

  // ---------- Chamada ----------
  canSummon(p) {
    return !!W(p).mechForm && !p.mechUsed && !p.mech && p.heroId === 'knight' && p.hero && p.hero.weaponId === 'espada'
      && (p.state === 'idle' || p.state === 'run') && !p.frozen && !p.choosing && this.c.world;
  }
  summon(p) {
    const world = this.c.world;
    // Ponto de pouso: de preferência "acima" do Cavaleiro na tela (o robô fica de frente para a câmera).
    let land = null;
    for (const [dx, dz] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {
      const q = v3(p.position.x + dx * 3.8, 0, p.position.z + dz * 3.8);
      world.resolveCircle(q, 1.7);
      const d = Math.hypot(q.x - p.position.x, q.z - p.position.z);
      if (d > 2.6) { land = q; break; }
      if (!land || d > land.d) { land = q; land.d = d; }
    }
    const m = (p.mech = {
      phase: 'call', t: 0, hp: M.hp, max: M.hp, land, v: null, trail: null,
      face: Math.atan2(p.position.x - land.x, p.position.z - land.z), // o robô olha para o Cavaleiro
      combo: 0, comboT: 0, atk: null, queued: false, block: false, blockK: 0, armed: false, armedT: 0,
      walk: 0, phaseA: 0, steps: 0, from: 0, hurtT: 0, ambT: 0, popT: 0, r0: p.hero.radius, attached: false, ticked: false, swordLit: false,
      start: p.position.clone(),
    });
    p.setState('mech'); p.combo = 0; p.queued = false; p.setGlow(0); p.vel.set(0, 0, 0); p.clearRoll();
    p.facing = Math.atan2(land.x - p.position.x, land.z - p.position.z); p.group.rotation.y = p.facing;
    p.anim.play('Cheering', { fade: 0.12, restart: true });
    const v = (m.v = makeMech({ cape: p.cape }));
    v.g.scale.setScalar(M.scale); v.g.visible = false; v.eyeOn = 0; v.glowK = 0.15; v.energy = 0;
    m.trail = makeTrail(this.scene);
    const T = M.summon;
    this.fx.rune(land.x, land.z, 3.6, T.call + T.drop + 0.25);
    this.fx.skyBeam(land.x, land.z, 1.5, T.call + T.drop + 0.2);
    this.fx.embers(v3(p.position.x, 0.4, p.position.z), 14, 1.2, GOLD, 4);
    this.c.vfx.ring(p.position, GOLD, 2.2);
    audio.play('mechCall', p.position.x, p.position.z);
    this.text('FORMA FINAL!', p.position, 'big', 3.6);
    this.ui.letterbox(p, true);
    this.log({ type: 'mechCall' });
  }

  // Dano do robô num inimigo: sempre 150, sem bônus de bênção (decisão do dono).
  damage(p, e, nx, nz) {
    if (!e.targetable || e.immune) return false;
    if (this.c.kit2 && this.c.kit2.duelBlocks(p, e)) return false;
    e.lastHitBy = p;
    this.striking = true; // nenhuma bênção interfere nos golpes do robô (combat.killed olha isto)
    let died = false;
    try {
      died = e.takeDamage(M.dmg, nx, nz, e.data.boss ? 1 : 3.6, true);
      this.text(String(M.dmg), e.position, 'crit', 2.8);
      this.c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), GOLD, 8);
      this.log({ type: 'mechHit', enemy: e, dmg: M.dmg, died });
      if (died) this.c.killed(e, nx, nz, p);
    } finally { this.striking = false; }
    return true;
  }

  // Onda em volta (pouso e explosão final): 150 em quem estiver perto.
  blast(p, x, z, r) {
    let n = 0;
    for (const e of [...this.c.enemies]) {
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      if (d > r + e.data.radius) continue;
      if (this.damage(p, e, dx / d, dz / d)) n++;
    }
    if (this.c.props) this.c.props.strikeArc({ position: { x, z }, facing: 0 }, r, Math.PI);
    return n;
  }

  // ---------- Golpes ----------
  startAttack(p, i, camera) {
    const m = p.mech, st = i === 3 ? M.bash : M.steps[i];
    m.atk = { i, t: 0, dur: st.dur, hitK: st.hit, hit: false, swish: false, aim: i === 3 ? p.facing : p.aimAngle(camera) };
    m.from = m.v.pose().twist; m.queued = false; m.block = false;
    if (i === 3) { m.armed = false; m.armedT = 0; audio.play('mechServo', p.position.x, p.position.z); } else m.combo = (i + 1) % 3;
    this.log({ type: 'mechAtk', i });
  }

  strike(p, a) {
    const m = p.mech, c = this.c, f = p.facing, fx = Math.sin(f), fz = Math.cos(f), px = p.position.x, pz = p.position.z;
    let hits = 0;
    if (a.i < 2) { // cortes largos
      const half = (M.arc / 2) * DEG;
      for (const e of [...c.enemies]) {
        const dx = e.position.x - px, dz = e.position.z - pz, d = Math.hypot(dx, dz) || 0.01;
        if (d > M.range + e.data.radius) continue;
        if (d > 2.4 && Math.abs(wrap(Math.atan2(dx, dz) - f)) > half) continue;
        if (this.damage(p, e, dx / d, dz / d)) hits++;
      }
      this.sweepShots(p, M.range, half);
      if (c.props) c.props.strikeArc(p, M.range, half);
      this.fx.slash(px, pz, f, M.range, half, a.i === 0 ? 1 : -1);
      this.shake(p, 0.3 + Math.min(0.3, hits * 0.05));
      if (hits) { c.addHitstop(0.07); audio.play('mechHit', px, pz); }
    } else if (a.i === 2) { // de cima para baixo: impacto + fenda
      const S = M.slam, bd = c.world && c.world.bounds;
      let ix = px + fx * S.ahead, iz = pz + fz * S.ahead, len = S.len; // o impacto e a fenda ficam dentro da sala
      if (bd) { ix = Math.max(-bd.x, Math.min(bd.x, ix)); iz = Math.max(-bd.z, Math.min(bd.z, iz)); }
      if (bd) while (len > 2 && (Math.abs(ix + fx * len) > bd.x || Math.abs(iz + fz * len) > bd.z)) len -= 0.5;
      for (const e of [...c.enemies]) {
        const dx = e.position.x - px, dz = e.position.z - pz;
        const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx), r = e.data.radius;
        const inBlast = Math.hypot(e.position.x - ix, e.position.z - iz) <= S.r + r;
        const inLine = along >= 0.5 && along <= S.ahead + len + r && side <= S.half + r;
        if (!inBlast && !inLine) continue;
        const ox = e.position.x - ix, oz = e.position.z - iz, od = Math.hypot(ox, oz) || 0.01;
        if (this.damage(p, e, inBlast ? ox / od : fx, inBlast ? oz / od : fz)) hits++;
      }
      this.sweepShots(p, S.ahead + S.r, 0.9);
      if (c.props) c.props.strikeArc(p, S.ahead + len, 0.16, { x: ix, z: iz }, S.r);
      this.fx.impact(ix, iz, 1.25);
      if (len > 2.4) this.fx.fissure(ix + fx * 1.2, iz + fz * 1.2, f, len - 1.2);
      this.fx.pillar(ix, iz, 9, 2.4, HOT, 0.5);
      this.shake(p, 0.95); c.addHitstop(hits ? 0.12 : 0.06);
      audio.play('mechSlam', ix, iz);
    } else { // pancada de escudo: atordoa todos em volta
      const B = M.bash, sx = px + fx * 2.6, sz = pz + fz * 2.6;
      for (const e of [...c.enemies]) {
        if (!e.alive || e.undead) continue;
        const dx = e.position.x - px, dz = e.position.z - pz, d = Math.hypot(dx, dz) || 0.01;
        if (d > B.r + e.data.radius) continue;
        if (c.kit2 && c.kit2.duelBlocks(p, e)) continue;
        const t = e.data.boss ? B.boss : B.daze;
        if (!e.daze || !e.daze(t)) continue;
        if (!e.data.boss && e.vel) e.vel.set(dx / d, 0, dz / d).multiplyScalar(B.push * Math.max(0.5, e.data.knockback || 1));
        this.text('Atordoado!', e.position, 'block', 3.0);
        hits++;
        this.log({ type: 'mechStun', enemy: e, t });
      }
      this.sweepShots(p, B.r, Math.PI);
      this.fx.impact(sx, sz, 1.1);
      this.fx.shock(px, pz, B.r, GOLD, 0.6); this.fx.shock(px, pz, B.r * 0.7, HOT, 0.45, 0.3);
      this.shake(p, 0.8); c.addHitstop(0.08);
      audio.play('mechSlam', sx, sz); audio.play('mechBlock', sx, sz);
      this.log({ type: 'mechBash', hits });
    }
    this.log({ type: 'mechStrike', i: a.i, hits });
    return hits;
  }

  // A lâmina destrói flechas e magias no caminho.
  sweepShots(p, range, half) {
    const L = this.c.projectiles && this.c.projectiles.list;
    if (!L) return;
    for (let i = L.length - 1; i >= 0; i--) {
      const a = L[i];
      if (!a || a.hits !== 'player' || a.stuck >= 0) continue;
      const dx = a.x - p.position.x, dz = a.z - p.position.z, d = Math.hypot(dx, dz);
      if (d > range + a.r || (d > 1.5 && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > half)) continue;
      this.c.smashOne(p, a);
    }
  }

  // ---------- Dano recebido: vai todo para o robô ----------
  // Devolve undefined se o herói não está no robô (o jogo segue normal).
  hit(p, e, base, opts = {}) {
    const m = p.mech;
    if (!m || m.phase === 'wait') return undefined;
    if (m.phase !== 'play' || p.ultTime > 0 || this.c.godMech) return false;
    const dx = p.position.x - e.position.x, dz = p.position.z - e.position.z, d = Math.hypot(dx, dz) || 0.001;
    const nx = dx / d, nz = dz / d;
    if (opts.contact) { // esbarrão: o robô nem sente; o esqueleto é que sai da frente
      if (e.vel && e.data && !e.data.boss && e.alive) e.vel.set(-nx, 0, -nz).multiplyScalar(5);
      return false;
    }
    const guarding = m.block || (m.atk && m.atk.i === 3 && !m.atk.hit);
    if (guarding && Math.abs(wrap(Math.atan2(-nx, -nz) - p.facing)) <= (M.block.arc / 2) * DEG) {
      m.armed = true; m.armedT = M.block.armed; m.v.shieldHit = 0.6;
      const at = v3(p.position.x - nx * 2.7, 3.2, p.position.z - nz * 2.7);
      this.c.vfx.sparks(at, HOT, 14); this.fx.flare(at, 2.6, GOLD, 0.2);
      this.text('Bloqueou!', p.position, 'block', 6.5);
      audio.play('mechBlock', p.position.x, p.position.z);
      this.shake(p, 0.1);
      if (e.alive && e.offBalance && !opts.noRepel && !opts.bossSkill) e.offBalance(-nx, -nz, 0.9, 11);
      this.log({ type: 'mechBlock', enemy: e });
      return true;
    }
    const dmg = Math.max(1, Math.round(base));
    m.hp -= dmg; m.hurtT = 0.25;
    m.v.flash(1);
    this.c.vfx.sparks(v3(p.position.x - nx * 1.3, 3.6, p.position.z - nz * 1.3), EMBER, 10);
    this.text(String(dmg), p.position, 'hurt', 6.2);
    audio.play('mechHurt', p.position.x, p.position.z);
    this.shake(p, 0.14);
    this.log({ type: 'mechHurt', dmg, hp: m.hp });
    if (m.hp <= 0) this.destroy(p);
    return true;
  }

  destroy(p) {
    const m = p.mech;
    if (!m || m.phase !== 'play') return;
    m.hp = 0; m.phase = 'dying'; m.t = 0; m.atk = null; m.block = false; m.armed = false; m.popT = 0;
    if (m.trail) m.trail.clear();
    audio.play('mechDown', p.position.x, p.position.z);
    this.text('Robô em colapso!', p.position, 'hurt', 7);
    this.c.addHitstop(0.1); this.shake(p, 0.6);
    this.log({ type: 'mechDown' });
  }

  // ---------- A cada quadro (cenas, luz, barra) ----------
  tick(dt) {
    const c = this.c;
    let lit = 0, lightAt = null;
    for (const p of c.players) {
      if (!p.mech) {
        if (this.canSummon(p)) { p.mechWait = (p.mechWait || 0) + dt; if (p.mechWait >= M.summon.wait) { p.mechWait = 0; this.summon(p); } } else p.mechWait = 0;
        continue;
      }
      const m = p.mech, v = m.v, T = M.summon;
      if (p.state === 'dead') { mechReset(p); p.mechUsed = true; continue; }
      m.t += dt;
      m.hurtT = Math.max(0, m.hurtT - dt);
      if (m.phase === 'call') {
        if (Math.random() < dt * 30) this.fx.embers(v3(m.land.x, 0.2, m.land.z), 1, 2.6, GOLD, 5);
        if (m.t >= T.call) {
          m.phase = 'drop'; m.t = 0;
          this.scene.add(v.g); v.g.visible = true; v.g.position.set(m.land.x, 46, m.land.z); v.g.rotation.y = m.face;
          v.snap({ mode: 'fall' });
          audio.play('mechFall', m.land.x, m.land.z);
        }
      } else if (m.phase === 'drop') {
        const k = clamp01(m.t / T.drop);
        v.g.position.y = 46 * (1 - k * k);
        v.update(dt, { mode: 'fall', yaw: m.face });
        this.fx.embers(v3(m.land.x, v.g.position.y + 2, m.land.z), 3, 1.3, EMBER, 9);
        this.fx.flare(v3(m.land.x, v.g.position.y + 0.5, m.land.z), 3.2, EMBER, 0.16);
        if (k >= 1) { // POUSO
          m.phase = 'board'; m.t = 0; v.g.position.y = 0;
          v.snap({ mode: 'kneel' }); v.flash(1, 1, 0.8, 0.5);
          this.fx.impact(m.land.x, m.land.z, 1.7);
          this.fx.shock(m.land.x, m.land.z, 11, GOLD, 0.75);
          this.fx.smoke(v3(m.land.x, 0.3, m.land.z), 6, 1.1);
          for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.fx.pillar(m.land.x + Math.sin(a) * 3.1, m.land.z + Math.cos(a) * 3.1, 5 + Math.random() * 3, 0.7, i % 2 ? HOT : GOLD, 0.55); }
          this.blast(p, m.land.x, m.land.z, M.land.r);
          this.shake(p, 1.1); c.addHitstop(0.12);
          audio.play('mechLand', m.land.x, m.land.z);
          this.ui.flash(p);
          p.anim.play('Jump_Full_Long', { once: true, restart: true, fade: 0.08, speed: 1.17 / T.board });
          m.jumpFrom = p.position.clone();
          this.log({ type: 'mechLand' });
        }
      } else if (m.phase === 'board') {
        const k = clamp01(m.t / T.board), open = smooth(clamp01(m.t / 0.3)), jk = clamp01((k - 0.18) / 0.82);
        v.update(dt, { mode: 'kneel', canopy: open, yaw: m.face });
        v.g.updateMatrixWorld(true);
        v.seat.getWorldPosition(tA);
        const e = smooth(jk);
        p.position.set(m.jumpFrom.x + (tA.x - m.jumpFrom.x) * e, tA.y * e + Math.sin(jk * Math.PI) * 2.2, m.jumpFrom.z + (tA.z - m.jumpFrom.z) * e);
        p.model.scale.setScalar(1 - (1 - KNIGHT_SCALE) * e);
        if (Math.random() < dt * 20) this.fx.steam(v3(m.land.x + (Math.random() - 0.5) * 3, 0.4, m.land.z + (Math.random() - 0.5) * 3), v3(0, 1, 0), 1, 1.2);
        if (k >= 1) { // sentou: daqui em diante o herói É o robô
          m.phase = 'rise'; m.t = 0;
          p.position.set(m.land.x, 0, m.land.z); p.facing = m.face; p.group.rotation.y = m.face;
          p.group.add(v.g); v.g.position.set(0, 0, 0); v.g.rotation.y = 0; m.attached = true;
          seatKnight(p, v);
          p.anim.play('Sit_Chair_Idle', { fade: 0.1, restart: true });
          audio.play('mechPower', p.position.x, p.position.z);
          this.log({ type: 'mechBoard' });
        }
      } else if (m.phase === 'rise') {
        const k = clamp01(m.t / T.rise);
        v.eyeOn = k < 0.3 ? (Math.sin(k * 150) > 0 ? 1 : 0.15) * clamp01(k / 0.3) : 1; // viseira acende piscando
        v.glowK = Math.min(1, 0.15 + k * 2.4);
        v.update(dt, { mode: 'rise', k, yaw: p.facing, canopy: 1 - smooth(clamp01(m.t / 0.35)) });
        if (Math.random() < dt * 14) this.fx.steam(this.ventPos(p), v3(0, 1.5, 0), 1, 1.3);
        if (!m.swordLit && k >= 0.56) { // raio na espada
          m.swordLit = true;
          v.g.updateMatrixWorld(true); v.tip.getWorldPosition(tA); v.base.getWorldPosition(tB);
          for (let i = 0; i < 3; i++) c.vfx.lightning(v3(tA.x + (Math.random() - 0.5) * 5, 44, tA.z + (Math.random() - 0.5) * 5), tA.clone(), i ? GOLD : HOT, i ? 0.3 : 0.6);
          this.fx.flare(tA.clone(), 9, HOT, 0.4); this.fx.flare(tB.clone(), 5, GOLD, 0.5);
          this.fx.shock(p.position.x, p.position.z, 13, GOLD, 0.8); this.fx.shock(p.position.x, p.position.z, 8, HOT, 0.55, 0.3);
          this.fx.embers(tB.clone(), 22, 1.6, GOLD, 5);
          this.fx.crack(p.position.x, p.position.z, 4.2, 6);
          this.shake(p, 0.9);
          audio.play('thunder', p.position.x, p.position.z); audio.play('mechRoar', p.position.x, p.position.z);
          this.ui.flash(p); this.ui.title(p);
          this.log({ type: 'mechIgnite' });
        }
        if (m.swordLit) v.energy = Math.min(1, v.energy + dt * 3.5);
        if (k >= 1) {
          m.phase = 'play'; m.t = 0; v.eyeOn = 1; v.glowK = 1; v.energy = 1;
          this.ui.letterbox(p, false); this.ui.show(p, true); this.ui.chip = 1; this.ui.hp = -1;
          this.log({ type: 'mechReady' });
        }
      } else if (m.phase === 'play') {
        if (!m.ticked) v.update(dt, { mode: 'play', walk: 0, block: 0, atk: null, yaw: p.facing }); // cena (ultimate, chefe): parado
        m.ticked = false;
        // Fumaça e faíscas quando está avariado.
        const hk = m.hp / m.max;
        v.hpK = hk;
        m.ambT -= dt;
        if (m.ambT <= 0) {
          m.ambT = hk < 0.3 ? 0.16 : hk < 0.6 ? 0.45 : 1.1;
          if (hk < 0.6) { const at = this.partPos(p); this.fx.smoke(at, 1, 0.5); if (hk < 0.3 || Math.random() < 0.4) c.vfx.sparks(at, EMBER, 4); }
          else this.fx.steam(this.ventPos(p), v3(0, 1.2, 0), 1, 0.9);
        }
        if (m.armed) { m.armedT -= dt; if (m.armedT <= 0) m.armed = false; }
        v.armed += ((m.armed ? 1 : 0) - v.armed) * Math.min(1, dt * 10);
      } else if (m.phase === 'dying') {
        const D = M.dying, k = clamp01(m.t / D.burn);
        v.hpK = 0; v.glowK = 1 - k * 0.5; v.energy = Math.max(0, 1 - k * 1.6);
        v.update(dt, { mode: 'dying', k, yaw: p.facing });
        m.popT -= dt;
        if (m.popT <= 0) { // explosões pelo corpo
          m.popT = 0.16 - k * 0.08;
          const at = this.partPos(p);
          this.fx.explosion(at, 0.55 + k * 0.5); v.flash(0.16, 1, 0.3, 0.08);
          audio.play('boom', at.x, at.z, { v: 0.5 }); this.shake(p, 0.18 + k * 0.2);
        }
        if (k >= 1) this.explode(p);
      } else if (m.phase === 'fly') { // o Cavaleiro ejetado
        const k = clamp01(m.t / M.dying.fly), e = k;
        p.position.set(m.ej.from.x + (m.ej.to.x - m.ej.from.x) * e, m.ej.from.y * (1 - e) + Math.sin(k * Math.PI) * 3.2, m.ej.from.z + (m.ej.to.z - m.ej.from.z) * e);
        p.model.rotation.x = -k * Math.PI * 2;
        if (Math.random() < dt * 40) this.fx.embers(p.position.clone(), 1, 0.3, EMBER, 1);
        if (k >= 1) this.finish(p);
      }
      if (m.phase !== 'gone' && p.mech && v.g.visible) {
        v.g.updateMatrixWorld(true); v.core.getWorldPosition(tA);
        lightAt = tA.clone(); lit = Math.max(lit, (m.phase === 'drop' ? 30 : 14) * v.glowK + v.flashV * 20);
      }
      if (p.mech && this.ui.mine(p)) this.ui.set(m.hp, m.max, m.armed && m.phase === 'play', dt);
    }
    if (this.light || lightAt) this.glowLight(lightAt || this.light.position, lit);
  }

  ventPos(p) { const v = p.mech.v; v.g.updateMatrixWorld(true); const o = v.vents[Math.random() < 0.5 ? 0 : 1]; return o.localToWorld(v3(0, 1.1, 0)); }
  partPos(p) { const v = p.mech.v; v.g.updateMatrixWorld(true); const o = v.parts[Math.floor(Math.random() * v.parts.length)]; return o.getWorldPosition(v3(0, 0, 0)); }

  // Explosão final: as peças voam, quem está perto leva 150 e o Cavaleiro é ejetado para trás.
  explode(p) {
    const m = p.mech, v = m.v, c = this.c, scene = this.scene, x = p.position.x, z = p.position.z;
    v.g.updateMatrixWorld(true);
    v.seat.getWorldPosition(tA);
    const from = tA.clone();
    const back = p.facing + Math.PI, to = v3(x + Math.sin(back) * 4.2, 0, z + Math.cos(back) * 4.2);
    if (c.world) c.world.resolveCircle(to, m.r0 || 0.6);
    // Cavaleiro sai da cabine.
    unseatKnight(p);
    if (p.hero) p.hero.radius = m.r0;
    // O robô fica no mundo e se desmancha.
    scene.attach(v.g);
    const center = v3(x, 3.6, z);
    for (const part of v.parts) {
      scene.attach(part);
      const base = part.material;
      part.material = base.clone(); part.material.transparent = true;
      if (base.userData.e && part.material.emissive) { part.material.emissive.copy(base.userData.e); part.material.emissiveIntensity = base.userData.ei || 0; } // cor de verdade da peça (sem o clarão)
      const dir = part.position.clone().sub(center); dir.y = Math.abs(dir.y) * 0.4 + 0.5; dir.normalize();
      const vel = dir.multiplyScalar(7 + Math.random() * 10); vel.y += 6 + Math.random() * 9;
      const spin = v3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12), s0 = part.scale.clone();
      c.vfx.items.push({ obj: part, life: 2.4 + Math.random() * 0.8, age: 0, tick: (o, k, dt) => {
        vel.y -= 28 * dt; o.position.addScaledVector(vel, dt);
        if (o.position.y < 0.4) { o.position.y = 0.4; vel.y *= -0.4; vel.x *= 0.65; vel.z *= 0.65; spin.multiplyScalar(0.6); }
        o.rotation.x += spin.x * dt; o.rotation.y += spin.y * dt; o.rotation.z += spin.z * dt;
        if (k > 0.75) { o.material.opacity = 1 - (k - 0.75) / 0.25; o.scale.copy(s0).multiplyScalar(1 - (k - 0.75) * 0.6); }
      } });
    }
    scene.remove(v.g);
    c.vfx.items.push({ obj: new THREE.Object3D(), life: 3.6, age: 0, tick: (o, k) => { if (k >= 1) v.dispose(); } }); // libera o modelo depois que as peças somem
    this.fx.explosion(center, 2.4); this.fx.explosion(v3(x, 1.5, z), 1.8); this.fx.explosion(v3(x, 5.8, z), 1.6);
    this.fx.impact(x, z, 1.9, EMBER);
    this.fx.shock(x, z, 13, HOT, 0.8); this.fx.shock(x, z, 9, EMBER, 0.6, 0.3);
    this.fx.pillar(x, z, 16, 3.2, HOT, 0.7);
    this.fx.smoke(v3(x, 1, z), 12, 1.5);
    this.fx.embers(center, 30, 3, EMBER, 6);
    const n = this.blast(p, x, z, M.boom.r);
    this.shake(p, 1.2); c.addHitstop(0.14);
    audio.play('mechExplode', x, z);
    this.ui.flash(p); this.ui.show(p, false);
    this.text('Robô destruído!', { x, z }, 'big', 5);
    if (m.trail) { m.trail.dispose(); m.trail = null; }
    m.phase = 'fly'; m.t = 0; m.ej = { from, to }; m.attached = false;
    p.position.copy(from);
    p.anim.play('Jump_Idle', { fade: 0.05, restart: true });
    this.wrecks++;
    this.log({ type: 'mechExplode', hits: n });
  }

  finish(p) {
    const m = p.mech;
    p.mech = null; p.mechUsed = true;
    p.position.y = 0; p.model.rotation.set(0, 0, 0);
    if (p.hero) p.hero.radius = m.r0;
    p.iframes = Math.max(p.iframes, 2);
    p.setState('idle'); p.anim.play(p.hero.anims.idle, { fade: 0.15 });
    this.c.vfx.dust(p.position, v3(0, 1, 0), 8);
    audio.play('dodge', p.position.x, p.position.z);
    this.log({ type: 'mechEnd' });
  }

  // Sala nova: os efeitos somem com o vfx; o robô continua no herói.
  clear() {
    for (const p of this.c.players) {
      const m = p.mech;
      if (!m) continue;
      if (m.trail) m.trail.clear();
      // Cena interrompida pela troca de sala (não deveria acontecer): termina do jeito mais simples.
      if (m.phase === 'call' || m.phase === 'drop' || m.phase === 'board') { mechReset(p); p.setState('idle'); }
      else if (m.phase === 'dying' || m.phase === 'fly') { mechReset(p); p.mechUsed = true; p.setState('idle'); }
    }
  }

  // ---------- Controle do robô (chamado pelo herói, com os comandos do jogador) ----------
  playerTick(p, dt, world, input, move, camera) {
    const m = p.mech, v = m.v;
    if (p.state === 'cine') return false; // ultimate / cena do chefe: a cena manda
    if (p.state !== 'mech') p.setState('mech'); // nada tira o Cavaleiro do robô (empurrão, agarrão, círculo)
    p.vel.set(0, 0, 0); p.grabImmune = 1; p.combo = 0;
    if (m.phase !== 'play') { if (m.phase === 'board' || m.phase === 'fly' || m.attached) p.group.rotation.y = p.facing; return true; }
    if (p.hero.radius !== M.radius) p.hero.radius = M.radius; // (as bênçãos de arma refazem os dados do herói)
    hideArms(p, true);
    m.ticked = true;
    const atkPress = input.attack(), blockHeld = input.blocking();
    let moving = move.lengthSq() > 0, speed = p.hero.moveSpeed * M.speed, want = p.facing, turn = M.turn;
    // Escudo: segurar defende; soltar depois de defender um golpe = pancada.
    if (!m.atk) {
      if (m.block && (!blockHeld || atkPress)) {
        m.block = false;
        if (m.armed) this.startAttack(p, 3, camera);
        else if (atkPress) this.startAttack(p, m.combo, camera);
      } else if (!m.block && blockHeld) { m.block = true; audio.play('mechServo', p.position.x, p.position.z, { v: 0.6 }); }
      else if (!m.block && atkPress) this.startAttack(p, m.combo, camera);
    } else if (atkPress) m.queued = true;
    m.blockK += ((m.block ? 1 : 0) - m.blockK) * Math.min(1, dt * 12);

    const a = m.atk;
    let trailOn = false;
    if (a) {
      a.t += dt;
      const k = a.t / a.dur;
      if (k < 0.3) { want = a.aim; turn = 11; } else turn = 0;
      speed *= k < 0.75 ? 0.18 : 0.6;
      if (a.i < 3) {
        if (!a.swish && k >= 0.28) { a.swish = true; audio.play('mechSwing', p.position.x, p.position.z); }
        trailOn = a.i === 2 ? k > 0.4 && k < 0.6 : k > 0.27 && k < 0.63;
      }
      if (!a.hit && k >= a.hitK) { a.hit = true; this.strike(p, a); }
      if (a.i < 3 && a.hit && m.queued && k >= 0.74) this.startAttack(p, m.combo, camera);
      else if (k >= 1) { m.atk = null; m.comboT = 0.7; m.queued = false; }
    } else {
      if (m.comboT > 0) { m.comboT -= dt; if (m.comboT <= 0) m.combo = 0; }
      if (m.block) { want = p.aimAngle(camera); turn = 9; speed *= M.block.move; }
      else if (moving) want = Math.atan2(move.x, move.z);
    }
    // Anda (passos pesados).
    if (moving && speed > 0.01) {
      const dist = speed * dt, n = Math.max(1, Math.ceil(dist / 0.25));
      for (let i = 0; i < n; i++) { p.position.x += move.x * dist / n; p.position.z += move.z * dist / n; world.resolveCircle(p.position, M.wall); }
      const before = Math.floor(m.phaseA / Math.PI + 0.5);
      m.phaseA += (dist / 2.5) * Math.PI;
      if (Math.floor(m.phaseA / Math.PI + 0.5) !== before) this.footfall(p, m.steps++);
    } else world.resolveCircle(p.position, M.wall);
    m.walk += ((moving && !a ? 1 : moving ? 0.35 : 0) - m.walk) * Math.min(1, dt * 8);
    if (turn > 0) p.facing += wrap(want - p.facing) * (1 - Math.exp(-turn * dt));
    p.group.rotation.y = p.facing;
    v.update(dt, { mode: 'play', walk: m.walk, phase: m.phaseA, atk: a ? a.i : null, k: a ? a.t / a.dur : 0, from: m.from, block: m.blockK, yaw: p.facing });
    // Rastro da espada.
    if (m.trail) {
      if (trailOn) { p.group.updateMatrixWorld(true); v.base.getWorldPosition(tA); v.tip.getWorldPosition(tB); }
      m.trail.update(dt, trailOn, tA, tB);
    }
    return true;
  }

  footfall(p, n) {
    const m = p.mech, L = m.v.legs[n % 2];
    p.group.updateMatrixWorld(true);
    L.ankle.getWorldPosition(tA);
    this.c.vfx.dust(v3(tA.x, 0, tA.z), v3(0, 1, 0), 5);
    this.fx.shock(tA.x, tA.z, 1.5, 0xd8c8a8, 0.3, 0.12);
    if (n % 2 === 0) this.fx.crack(tA.x, tA.z, 1.0, 2.2, EMBER);
    this.shake(p, 0.07);
    audio.play('mechStep', tA.x, tA.z);
  }

  // ---------- Rede (co-op pela internet): o que a tela do Jogador 2 precisa para desenhar o robô ----------
  netEntry(p) {
    const m = p && p.mech;
    if (!m || !m.v) return 0;
    const v = m.v, r2 = (n) => Math.round(n * 100) / 100, a = m.atk;
    return [PHASES.indexOf(m.phase), r2(m.t), Math.ceil(m.hp), m.max, a ? a.i : -1, a ? r2(a.t / a.dur) : 0, a ? a.dur : 1, r2(m.blockK), r2(m.walk), m.armed ? 1 : 0, r2(m.from),
      r2(m.land.x), r2(m.land.z), r2(m.face), r2(v.energy), p.cape || 0];
  }
}

// Chamado pelo herói a cada quadro. Devolve true se o robô cuidou do quadro.
export function mechPlayerTick(p, dt, world, input, move, camera) {
  if (!p.mech || !C) return false;
  if (p.mech.phase === 'wait') return false;
  return C.playerTick(p, dt, world, input, move, camera);
}

// ---------- Tela do Jogador 2 (replica.js): desenha o robô a partir do que o anfitrião manda ----------
export function mechNetDraw(rep, p, e, dt, mine) {
  let d = p.mechNet;
  if (!e) {
    if (d) { // sumiu (explodiu ou a partida recomeçou)
      unseatKnight(p);
      if (d.v.g.parent) d.v.g.parent.remove(d.v.g);
      d.v.dispose(); d.trail.dispose(); p.mechNet = null;
      if (mine && d.ui) { d.ui.show(p, false, true); }
    }
    return false;
  }
  const [ph, t, hp, max, atk, k, dur, blockK, walk, armed, from, lx, lz, face, energy, cape] = e;
  const phase = PHASES[ph] || 'play', scene = rep.scene, T = M.summon;
  if (!d) {
    d = p.mechNet = { v: makeMech({ cape: cape || undefined }), trail: makeTrail(scene), k: 0, atk: -1, phaseA: 0, attached: false, ui: mine ? (C ? C.ui : new MechUi()) : null };
    d.v.g.scale.setScalar(M.scale);
  }
  const v = d.v;
  if (atk !== d.atk || Math.abs(k - d.k) > 0.2) d.k = k; else d.k = Math.max(d.k, Math.min(1, d.k + dt / (dur || 1)));
  d.atk = atk;
  v.hpK = hp / max; v.energy = energy; v.armed += ((armed ? 1 : 0) - v.armed) * Math.min(1, dt * 10);
  const attach = phase === 'rise' || phase === 'play' || phase === 'dying';
  if (attach !== d.attached || !v.g.parent) {
    d.attached = attach;
    if (attach) { p.group.add(v.g); v.g.position.set(0, 0, 0); v.g.rotation.y = 0; seatKnight(p, v); }
    else { unseatKnight(p); scene.add(v.g); v.g.position.set(lx, 0, lz); v.g.rotation.y = face; }
  }
  v.g.visible = phase !== 'wait' && phase !== 'call' && phase !== 'fly';
  if (phase === 'drop') { const kk = clamp01(t / T.drop); v.g.position.y = 46 * (1 - kk * kk); v.update(dt, { mode: 'fall', yaw: face }); }
  else if (phase === 'board') { v.g.position.y = 0; v.update(dt, { mode: 'kneel', canopy: 1, yaw: face }); }
  else if (phase === 'rise') { v.eyeOn = 1; v.glowK = 1; v.update(dt, { mode: 'rise', k: clamp01(t / T.rise), yaw: p.facing }); }
  else if (phase === 'dying') { v.update(dt, { mode: 'dying', k: clamp01(t / M.dying.burn), yaw: p.facing }); }
  else if (phase === 'play') {
    v.eyeOn = 1; v.glowK = 1;
    d.phaseA += dt * walk * (p.hero.moveSpeed * M.speed / 2.5) * Math.PI;
    v.update(dt, { mode: 'play', walk, phase: d.phaseA, atk: atk >= 0 ? atk : null, k: d.k, from, block: blockK, yaw: p.facing });
    const on = atk >= 0 && atk < 3 && (atk === 2 ? d.k > 0.4 && d.k < 0.6 : d.k > 0.27 && d.k < 0.63);
    if (on) { p.group.updateMatrixWorld(true); v.base.getWorldPosition(tA); v.tip.getWorldPosition(tB); }
    d.trail.update(dt, on, tA, tB);
  }
  if (attach) hideArms(p, true);
  if (mine && d.ui) { d.ui.show(p, phase === 'play', true); if (phase === 'play') d.ui.set(hp, max, armed, dt); }
  return true;
}
