// Grimório Ancestral (lendária do Cajado Arcano, 12/11/2026): combat.grim = GrimKit. Números em l1bless.js (L1.grim),
// visual em grimlook.js, magias em grimspells.js (lote 1), grimspells2.js e grimspells3.js (lote 2), grimspells4.js e
// grimspells5.js (lote 3), grimspells6.js e grimspells7.js (lote 4), grimspells8.js e grimspells9.js (lote 5).
// - Fases: (pegou a bênção) -> intro (cena: o livro desce do teto, abre, as páginas voam, o cajado se desfaz) -> play.
// - Atacar: o golpe vira uma conjuração (grimOverride); no impacto sai 1 magia sorteada do livro (strike). As magias saem
//   de um "saco" embaralhado: todas aparecem antes de alguma repetir. Nada avisa qual vem (decisão do dono).
// - Escudo em 360°: flechas, virotes, orbes e magias voltam em quem atirou, sem gastar nada (shot); habilidades mágicas
//   de chefe (explosão do Necromante, chuva de crânios) são anuladas (hit). Golpe corpo a corpo passa normal.
// - Rolar: teleporte (grimStartDodge). Nenhuma outra bênção vale: o dano das magias passa por hurt() com "striking"
//   ligado (combat.killed não chama Sede de Sangue, Ceifador etc.) e não usa multiplicador nenhum.
// Ganchos: player.js (startAttack, startDodge, reset), combat.js (playerStrike, hitPlayer, killed, update, clear),
// projectiles.js (tiro chegando na Maga), main.js (tecla Backspace), necro.js (magic: true).
import * as THREE from 'three';
import { audio } from './audio.js';
import { L1 } from './l1bless.js';
import { MechFx } from './mechfx.js';
import { SPELLS1, grimRelease } from './grimspells.js';
import { SPELLS2 } from './grimspells2.js';
import { SPELLS3 } from './grimspells3.js';
import { SPELLS4 } from './grimspells4.js';
import { SPELLS5 } from './grimspells5.js';
import { SPELLS6 } from './grimspells6.js';
import { SPELLS7 } from './grimspells7.js';
import { SPELLS8 } from './grimspells8.js';
import { SPELLS9 } from './grimspells9.js';
import { VIOLET, GOLD, PALE, grimTex, makeBook, setBookOpen, bookTick, grimDress, grimUndress, grimLookTick, grimShieldFlash, castCircle, flipPage, flyingPage, handsPoint } from './grimlook.js';

const G = L1.grim;
export const SPELLS = [...SPELLS1, ...SPELLS2, ...SPELLS3, ...SPELLS4, ...SPELLS5, ...SPELLS6, ...SPELLS7, ...SPELLS8, ...SPELLS9]; // lotes 1 a 5 (50 magias)
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);
const W = (p) => (p && p.stats && p.stats.w) || {};
const isArcane = (p) => !!(p && p.heroId === 'mage' && p.hero && p.hero.weaponId === 'cajado');

let C = null;

export const grimOn = (p) => !!(p && p.grim && p.grim.phase === 'play');
const grimHas = (p) => !!W(p).grimForm && isArcane(p);

// Conjurações (alternam). A velocidade não muda com bênçãos (nenhuma vale com o Grimório).
const STEPS = [
  { clip: 'Ranged_Magic_Spellcasting', speed: 0.72, hit: 0.3, end: 0.56, window: 0.3, lunge: 0, damage: 0, kit: 'grim' },
  { clip: 'Ranged_Magic_Shoot', speed: 0.95, hit: 0.26, end: 0.6, window: 0.3, lunge: 0, damage: 0, kit: 'grim' },
];
export function grimOverride(p) {
  if (!grimOn(p)) return null;
  const g = p.grim;
  const base = STEPS[(g.n = (g.n || 0) + 1) % 2];
  return { ...base, speed: base.speed * G.cast.speed / (p.atkSpeed || 1) };
}
export function grimStartDodge(p) {
  if (!grimOn(p) || !C) return false;
  return C.blink(p);
}
export function grimReset(p) {
  if (p.grim && p.grim.phase === 'intro' && p.state === 'cine') p.exitCine();
  if (p.grim && p.grim.book && p.grim.book.g.parent) p.grim.book.g.parent.remove(p.grim.book.g);
  p.grim = null;
  grimUndress(p);
  if (C) C.ui.show(p, false);
}

// ---------- Tela: faixas de cinema, título, escurecer, clarão ----------
class GrimUi {
  build() {
    if (this.el || typeof document === 'undefined') return;
    const st = document.createElement('style');
    st.textContent = `
#grimcine { position:fixed; inset:0; pointer-events:none; z-index:6; }
#grimcine .dim { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 45%, rgba(30,8,50,0) 12%, rgba(10,2,22,.9) 80%); opacity:0; transition:opacity .45s; }
#grimcine .bars::before, #grimcine .bars::after { content:""; position:absolute; left:0; right:0; height:0; background:#000; transition:height .4s cubic-bezier(.2,.8,.2,1); }
#grimcine .bars::before { top:0; } #grimcine .bars::after { bottom:0; }
#grimcine.on .dim { opacity:1; } #grimcine.on .bars::before, #grimcine.on .bars::after { height:9vh; }
#grimcine .shade { position:absolute; inset:0; background:#05010c; opacity:0; transition:opacity .12s; }
#grimcine .shade.on { opacity:.55; transition:opacity .08s; }
#grimcine .title { position:absolute; left:0; right:0; top:16%; text-align:center; opacity:0; font-family:"Titulo", Georgia, serif; }
#grimcine .title .t1 { font-size:clamp(34px, 8vw, 92px); letter-spacing:.1em; text-transform:uppercase; background:linear-gradient(#fff6dc, #ffd27a 40%, #b06bff 75%, #5a1cae); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; filter:drop-shadow(0 0 18px rgba(176,107,255,.95)) drop-shadow(0 3px 0 #1a0630); }
#grimcine .title .t2 { margin-top:2px; font:bold clamp(12px, 1.9vw, 20px) Georgia, serif; letter-spacing:.45em; color:#f0dcff; text-shadow:0 1px 3px #000, 0 0 10px #b06bff; }
#grimcine .title.go { animation:grimtitle 2.6s cubic-bezier(.15,.85,.25,1) forwards; }
#grimcine .tint { position:absolute; inset:0; opacity:0; transition:opacity .6s; }
#grimcine .flash { position:absolute; inset:0; background:#f4e8ff; opacity:0; }
#grimcine .flash.go { animation:grimflash .5s ease-out; }
#grimcine .flash.soft.go { animation:grimflash2 .3s ease-out; }
@keyframes grimtitle { 0% { opacity:0; transform:scale(2.2); letter-spacing:.6em; } 12% { opacity:1; transform:scale(1); } 80% { opacity:1; transform:scale(1.04); } 100% { opacity:0; transform:scale(1.1); } }
@keyframes grimflash { 0% { opacity:.9; } 100% { opacity:0; } }
@keyframes grimflash2 { 0% { opacity:.35; } 100% { opacity:0; } }`;
    document.head.appendChild(st);
    const el = (this.el = document.createElement('div')); el.id = 'grimcine';
    el.innerHTML = '<div class="dim"></div><div class="tint"></div><div class="shade"></div><div class="bars"></div><div class="flash"></div><div class="title"><div class="t1">Grimório Ancestral</div><div class="t2">50 MAGIAS · LENDÁRIA</div></div>';
    document.body.appendChild(el);
  }
  mine(p) { return !C || !C.c || !p || p === C.c.player; }
  show(p, on) { if (!this.mine(p)) return; this.build(); if (this.el) this.el.classList.toggle('on', on); }
  title(p) { if (!this.mine(p)) return; this.build(); if (!this.el) return; const t = this.el.querySelector('.title'); t.classList.remove('go'); void t.offsetWidth; t.classList.add('go'); }
  flash(p, soft = false) { if (!this.mine(p)) return; this.build(); if (!this.el) return; const f = this.el.querySelector('.flash'); f.classList.toggle('soft', soft); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  // Céu da sala tingido (Chuva de Meteoros: vermelho; Tempestade: azul-escuro) por t segundos.
  tint(color, op, t, center = 'rgba(0,0,0,0)') { this.build(); if (!this.el) return; const d = this.el.querySelector('.tint'); d.style.background = `radial-gradient(ellipse at 50% 45%, ${center} 10%, ${color} 100%)`; d.style.opacity = op; clearTimeout(this.tintT); this.tintT = setTimeout(() => { d.style.opacity = 0; }, t * 1000); }
  tintOff() { if (this.el) { clearTimeout(this.tintT); this.el.querySelector('.tint').style.opacity = 0; } }
  dim(t) { this.build(); if (!this.el) return; const s = this.el.querySelector('.shade'); s.classList.add('on'); clearTimeout(this.dimT); this.dimT = setTimeout(() => s.classList.remove('on'), t * 1000); }
}

export class GrimKit {
  constructor(c) {
    this.c = c; C = this;
    this.fx = new MechFx(c.vfx);
    this.ui = new GrimUi();
    this.effects = [];   // magias que duram: { t, dur, tick, tt, onTick, onFrame, onEnd }
    this.timers = [];    // { t, fn }
    this.light = null;
    this.striking = false;
    this.clock = 0; this.lastCast = -99; // tempo de jogo (as fotos de teste usam)
    this.fallen = [];    // inimigos que morreram nesta sala (Exército das Sombras)
    this.spells = SPELLS; // Roleta do Caos e APOCALIPSE soltam outras magias
  }
  get vfx() { return this.c.vfx; }
  get scene() { return this.c.vfx.scene; }
  log(o) { if (this.c.log) this.c.log(o); }
  text(t, pos, cls, h) { this.c.text.add(t, pos, cls, h); }
  shake(p, a) { this.c.shakeFor(p, a); }
  bounds() { const b = this.c.world && this.c.world.bounds; return b || { x: 12, z: 12 }; }
  later(t, fn) { if (t <= 0) fn(); else this.timers.push({ t, fn }); }
  effect(o) { const ef = { t: 0, tt: 0, ...o }; this.effects.push(ef); return ef; }
  foes() { return this.c.enemies.filter((e) => e.targetable && !e.undead); }
  // Dano das magias: fixo, sem bênção nenhuma (striking avisa o combat.killed).
  hurt(e, dmg, nx, nz, cls, p, small = false) {
    if (!e || !e.targetable) return;
    this.striking = true;
    try { this.c.bonusDamage(e, Math.round(dmg), nx, nz, cls, p, small); } finally { this.striking = false; }
  }
  // Luz colorida (uma só, criada uma vez) que pisca onde a magia explode e vai apagando.
  glow(x, z, color, v) {
    if (!this.light) { this.light = new THREE.PointLight(VIOLET, 0, 16, 1.5); this.scene.add(this.light); }
    if (this.light.parent !== this.scene) this.scene.add(this.light);
    this.light.position.set(x, 2.5, z);
    this.light.color.setHex(color);
    this.light.intensity = Math.max(this.light.intensity, v);
  }
  // Melhor ponto para a magia de área: o grupo de inimigos com mais gente (de preferência à frente). Sem ninguém:
  // um pouco à frente da Maga.
  aim(p, r) {
    const foes = this.foes(), fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    let best = null, bs = -Infinity;
    for (const e of foes) {
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > G.reach) continue;
      let n = 0, sx = 0, sz = 0;
      for (const o of foes) if (Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) <= r) { n++; sx += o.position.x; sz += o.position.z; }
      const score = n + 0.8 * ((dx * fx + dz * fz) / d) + (e.data.boss ? 1.5 : 0);
      if (score > bs) { bs = score; best = { x: sx / n, z: sz / n }; }
    }
    if (best) return best;
    const B = this.bounds();
    return { x: Math.max(-B.x + 1, Math.min(B.x - 1, p.position.x + fx * 6)), z: Math.max(-B.z + 1, Math.min(B.z - 1, p.position.z + fz * 6)) };
  }

  // ---------- Transformação ----------
  begin(p) {
    p.grim = { phase: 'intro', t: 0, n: 0, step: 0, bag: [], book: null, bookFrom: null };
    p.enterCine();
    p.anim.play('Ranged_Magic_Summon', { once: true, fade: 0.15, restart: true, speed: 0.6 });
    this.ui.show(p, true);
    const a = p.facing, bx = p.position.x + Math.sin(a) * 1.7, bz = p.position.z + Math.cos(a) * 1.7;
    const book = makeBook();
    book.g.position.set(bx, 14, bz); book.g.rotation.set(0, a + Math.PI / 2, 0);
    book.g.scale.setScalar(2.6);
    this.scene.add(book.g);
    p.grim.book = book; p.grim.bx = bx; p.grim.bz = bz;
    this.fx.skyBeam(bx, bz, 1.6, G.intro.book + 0.3, VIOLET);
    audio.play('summon', bx, bz, { v: 1.2 });
    audio.play('bell', bx, bz, { v: 0.7 });
    this.text('GRIMÓRIO ANCESTRAL!', p.position, 'big', 3.8);
    this.log({ type: 'grimBegin' });
  }
  introTick(p, dt) {
    const g = p.grim, I = G.intro, book = g.book;
    g.t += dt;
    const t1 = I.book, t2 = t1 + I.open, t3 = t2 + I.staff, t4 = t3 + I.pages;
    p.aimForward && p.aimForward();
    if (g.t < t1) { // o livro desce do teto, fechado, girando
      const k = g.t / t1, kk = 1 - (1 - k) ** 3;
      book.g.position.y = 14 - (14 - 2.3) * kk;
      book.g.rotation.y += dt * (4 * (1 - k) + 0.5);
      bookGlow(this, book, g.t);
      if (Math.random() < 0.5) this.fx.embers(book.g.position.clone(), 2, 0.6, GOLD, 1.5);
    } else if (g.t < t2) { // abre de uma vez: clarão, título, onda, páginas voando
      if (g.step < 1) {
        g.step = 1;
        this.ui.flash(p); this.ui.title(p);
        this.fx.shock(g.bx, g.bz, 9, VIOLET, 0.7); this.fx.shock(g.bx, g.bz, 5, GOLD, 0.45, 0.25);
        this.fx.flare(book.g.position.clone(), 8, PALE, 0.4);
        this.glow(g.bx, g.bz, VIOLET, 60);
        this.shake(p, 0.5);
        audio.play('portalOpen', g.bx, g.bz, { v: 1.1 }); audio.play('thunder', g.bx, g.bz, { v: 0.6 });
        for (let i = 0; i < 26; i++) flyingPage(this.vfx, p.position.x, p.position.z, (i / 26) * Math.PI * 2, rnd(1.2, 2.4), rnd(1.4, 2.2));
        // A onda empurra os inimigos e deixa todos tontos (sem dano).
        for (const e of this.foes()) {
          const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
          if (d > 9) continue;
          if (e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(13 * Math.max(0.4, 1 - d / 9));
          if (e.daze) e.daze(e.data.boss ? 0.5 : 1.4);
        }
      }
      const k = (g.t - t1) / I.open;
      setBookOpen(book, Math.min(1, k * 2.2));
      book.g.rotation.y += dt * 0.6;
      book.g.rotation.x = -0.5 * Math.min(1, k * 2);
      book.g.position.y = 2.3 + Math.sin(g.t * 3) * 0.1;
      bookGlow(this, book, g.t);
      if (book.flipT >= 1 && Math.random() < 0.25) flipPage(book);
      bookTick(book, dt, g.t); setBookOpen(book, Math.min(1, k * 2.2));
    } else if (g.t < t3) { // o cajado se desfaz em luz; as mãos acendem
      if (g.step < 2) {
        g.step = 2;
        const L = grimDress(p); L.book.g.visible = false; if (L.shield) L.shield.g.visible = false;
        const hp = handsPoint(p);
        this.fx.flare(hp, 3, VIOLET, 0.4);
        for (let i = 0; i < 3; i++) this.vfx.sparks(hp, i ? VIOLET : GOLD, 12);
        this.fx.embers(hp, 18, 0.5, VIOLET, 3);
        audio.play('bigShatter', p.position.x, p.position.z, { v: 0.7 });
        p.anim.play('Ranged_Magic_Spellcasting', { once: true, fade: 0.12, restart: true, speed: 0.6 });
        castCircle(this.vfx, p, VIOLET, 2.4);
        this.text('O cajado se desfez...', p.position, 'block', 3.2);
      }
      book.g.position.y = 2.3 + Math.sin(g.t * 3) * 0.1;
      bookGlow(this, book, g.t); bookTick(book, dt, g.t);
    } else if (g.t < t4) { // escudo nasce; o livro vai para as costas dela
      if (g.step < 3) {
        g.step = 3;
        const L = p.grimLook; if (L && L.shield) L.shield.g.visible = true; grimShieldFlash(p);
        this.fx.shock(p.position.x, p.position.z, 4, VIOLET, 0.5);
        audio.play('spell', p.position.x, p.position.z, { v: 1 });
        g.bookFrom = { pos: book.g.position.clone(), quat: book.g.quaternion.clone(), s: book.g.scale.x };
      }
      const k = (g.t - t3) / I.pages, kk = k * k * (3 - 2 * k);
      const L = p.grimLook;
      if (L && L.book) {
        p.group.updateMatrixWorld(true);
        const to = L.book.g.getWorldPosition(new THREE.Vector3()), tq = L.book.g.getWorldQuaternion(new THREE.Quaternion());
        book.g.position.lerpVectors(g.bookFrom.pos, to, kk);
        book.g.quaternion.slerpQuaternions(g.bookFrom.quat, tq, kk);
        book.g.scale.setScalar(g.bookFrom.s + (1 - g.bookFrom.s) * kk);
      }
    } else this.finishIntro(p);
  }
  finishIntro(p) {
    const g = p.grim;
    if (!g) return;
    if (g.book && g.book.g.parent) g.book.g.parent.remove(g.book.g);
    g.book = null;
    const L = grimDress(p);
    L.book.g.visible = true; if (L.shield) L.shield.g.visible = true;
    g.phase = 'play';
    this.ui.show(p, false);
    if (p.state === 'cine') p.exitCine();
    this.log({ type: 'grimPlay' });
  }

  tick(dt) {
    const c = this.c;
    this.clock += dt;
    for (const p of c.players) {
      if (!grimHas(p)) { if (p.grim || p.grimLook) grimReset(p); continue; }
      if (!p.grim) {
        const ok = (p.state === 'idle' || p.state === 'run') && !p.frozen && !p.choosing && c.world;
        if (ok) this.begin(p);
        continue;
      }
      if (p.grim.phase === 'intro') this.introTick(p, dt);
      else if (!p.grimLook) grimDress(p);
      grimLookTick(p, dt);
    }
    // Magias que duram e magias atrasadas.
    for (const tm of [...this.timers]) { tm.t -= dt; if (tm.t <= 0) { this.timers.splice(this.timers.indexOf(tm), 1); tm.fn(); } }
    for (const ef of [...this.effects]) {
      ef.t += dt;
      if (ef.onFrame) ef.onFrame(dt, ef);
      if (ef.tick) { ef.tt += dt; while (ef.tt >= ef.tick) { ef.tt -= ef.tick; if (ef.onTick) ef.onTick(ef); } }
      if (ef.t >= ef.dur) { this.effects.splice(this.effects.indexOf(ef), 1); if (ef.onEnd) ef.onEnd(ef); }
    }
    if (this.light) this.light.intensity *= Math.exp(-5 * dt);
  }

  // ---------- Conjurar ----------
  strike(p, step) {
    if (!grimOn(p) || !step || step.kit !== 'grim') return false;
    const g = p.grim;
    if (!g.bag.length) { // saco embaralhado: todas saem antes de repetir
      g.bag = SPELLS.map((s) => s.id).sort(() => Math.random() - 0.5);
      if (g.last && g.bag[g.bag.length - 1] === g.last && g.bag.length > 1) g.bag.unshift(g.bag.pop());
    }
    const id = (window.__grimForce && window.__grimForce()) || g.bag.pop();
    const sp = SPELLS.find((s) => s.id === id) || SPELLS[0];
    g.last = sp.id;
    this.cast(p, sp);
    return true;
  }
  cast(p, sp) {
    castCircle(this.vfx, p, sp.color, 2.8);
    if (p.grimLook && p.grimLook.book) flipPage(p.grimLook.book);
    this.text(`${sp.name}!`, p.position, 'big', 3.4);
    audio.play('spell', p.position.x, p.position.z, { v: 0.9 });
    this.glow(p.position.x, p.position.z, sp.color, 20);
    this.lastCast = this.clock;
    this.log({ type: 'grimCast', id: sp.id });
    sp.cast(this, p);
  }

  // ---------- Teleporte (rolamento) ----------
  blink(p) {
    const wd = this.c.world;
    if (p.ctl) p.ctl.moveDir(p.dodgeDir);
    if (p.dodgeDir.lengthSq() === 0) p.dodgeDir.set(Math.sin(p.facing), 0, Math.cos(p.facing)); else p.dodgeDir.normalize();
    const dx = p.dodgeDir.x, dz = p.dodgeDir.z, x0 = p.position.x, z0 = p.position.z, r = p.hero.radius * 0.8;
    let x = x0, z = z0;
    for (let s = 0.25; s <= G.blink.dist + 1e-6; s += 0.25) {
      const nx = x0 + dx * s, nz = z0 + dz * s;
      if (wd && wd.blocked(nx, nz, r)) break;
      x = nx; z = nz;
    }
    p.position.x = x; p.position.z = z;
    if (wd) wd.resolveCircle(p.position, p.hero.radius);
    for (const [px, pz, out] of [[x0, z0, true], [p.position.x, p.position.z, false]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: grimTex().circle, color: VIOLET, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.position.set(px, 0.1, pz);
      this.vfx.add(m, 0.5, (o, k, d) => { o.scale.setScalar(2.6 * (out ? 1 - k * 0.6 : 0.4 + k * 0.8)); o.rotation.y += d * 6; o.material.opacity = 1 - k; });
      this.fx.pillar(px, pz, 4, 0.9, out ? VIOLET : PALE, 0.35);
      this.fx.flare(v3(px, 1.1, pz), 2.2, VIOLET, 0.25);
      this.fx.embers(v3(px, 0.8, pz), 8, 0.5, out ? VIOLET : GOLD, 3);
    }
    const n = Math.max(2, Math.round(Math.hypot(p.position.x - x0, p.position.z - z0) / 0.8));
    for (let i = 1; i < n; i++) { // rastro de letras brilhando no caminho
      const k = i / n, s = this.vfx.sprite(grimTex().runes); s.material.color.setHex(i % 2 ? VIOLET : GOLD);
      s.position.set(x0 + (p.position.x - x0) * k, 1.1, z0 + (p.position.z - z0) * k);
      this.vfx.add(s, 0.35 + k * 0.2, (o, kk) => { o.scale.setScalar(0.7 * (1 - kk)); o.material.opacity = 1 - kk; });
    }
    p.facing = Math.atan2(dx, dz); p.group.rotation.y = p.facing;
    p.iframes = Math.max(p.iframes || 0, G.blink.iframes);
    p.combo = 0; p.queued = false; p.clearRoll(); p.setGlow(0);
    if (p.state !== 'idle' && p.state !== 'run') p.setState('idle');
    p.anim.play(p.hero.anims.idle, { fade: 0.08 });
    p.dodgeCooldown = p.hero.dodge.cooldown;
    audio.play('spell', p.position.x, p.position.z, { v: 0.8 });
    if (p.onDodge) { p.onDodge(p, 'start'); p.onDodge(p, 'end'); }
    this.log({ type: 'grimBlink', d: Math.hypot(p.position.x - x0, p.position.z - z0) });
    return true;
  }

  // ---------- Escudo ----------
  // Projétil chegando na Maga: volta em quem atirou (mesmo dano, sem gastar nada). true = cuidou dele.
  shot(p, a) {
    if (!grimOn(p) || a.hits === 'reflected') return false;
    const c = this.c;
    a.hits = 'reflected'; a.by = p; a.bounces = 0; a.hitSet = new Set(); a.homing = 0;
    const o = a.owner;
    a.target = o && o.targetable && c.enemies.includes(o) ? o : null;
    const sp = Math.max(a.speed || Math.hypot(a.vx, a.vz), 14) * 1.3;
    const ang = a.target ? Math.atan2(a.target.position.x - a.x, a.target.position.z - a.z) : Math.atan2(-a.vx, -a.vz);
    a.vx = Math.sin(ang) * sp; a.vz = Math.cos(ang) * sp;
    if (a.g) a.g.rotation.y = ang;
    a.life = 3; a.age = 0;
    a.x = p.position.x + Math.sin(ang) * 1.5; a.z = p.position.z + Math.cos(ang) * 1.5;
    grimShieldFlash(p);
    this.vfx.sparks(v3(a.x, 1.3, a.z), VIOLET, 12);
    this.fx.flare(v3(a.x, 1.3, a.z), 1.6, VIOLET, 0.2);
    this.text('Refletiu!', p.position, 'block');
    audio.play('shieldBlock', p.position.x, p.position.z, { v: 0.7 });
    this.log({ type: 'grimReflect', kind: a.kind, owner: o });
    return true;
  }
  // Golpe chegando na Maga: magia (explosão do Necromante, chuva de crânios, tiro) é anulada; físico passa.
  hit(p, e, base, opts) {
    if (e && e.grimBlindT > 0 && !opts.shooter) return false; // Eclipse: cego não acerta a Maga
    if (!grimOn(p) || !(opts.magic || opts.shooter)) return undefined;
    grimShieldFlash(p);
    this.vfx.sparks(v3(p.position.x, 1.3, p.position.z), VIOLET, 14);
    this.text('Anulou!', p.position, 'block');
    audio.play('shieldBlock', p.position.x, p.position.z, { v: 0.8 });
    this.log({ type: 'grimBlock' });
    return false;
  }

  // ---------- Exército das Sombras / Eclipse (ganchos em combat.js e undead.js) ----------
  onDeath(e) { // combat.killed: guarda onde o inimigo caiu (chefes e cópias não)
    if (e.undead || e.data.boss || e.data.phantom || e.grimShade) return;
    this.fallen.push({ type: e.type, x: e.position.x, z: e.position.z, facing: e.facing });
    if (this.fallen.length > 40) this.fallen.shift();
  }
  shadeHit(u, o) { // golpe de uma sombra (ou de um convertido): dano fixo, sem bênção, e o inimigo passa a brigar com ela
    const p = u.undead, dx = o.position.x - u.position.x, dz = o.position.z - u.position.z, d = Math.hypot(dx, dz) || 1;
    o.provokedBy = u;
    this.vfx.sparks(v3(o.position.x, 1.2, o.position.z), VIOLET, 6);
    audio.play('hit', o.position.x, o.position.z, { v: 0.6 });
    this.hurt(o, u.grimConvert ? L1.grim.convert.dmg : L1.grim.army.dmg, dx / d, dz / d, 'dmg', p && p.hero ? p : null);
    this.log({ type: 'grimShadeHit', enemy: o });
  }
  blindTarget(e, dt = 1 / 60) { // combat.pickTarget: cego ataca o inimigo mais perto (troca de vez em quando); sozinho, anda à toa
    if (!(e.grimBlindT > 0) || !e.alive || e.data.boss) return null;
    e.grimBlindPick = (e.grimBlindPick || 0) - (dt || 0);
    const cur = e.grimBlindFoe;
    if (cur && cur.alive && cur.targetable && e.grimBlindPick > 0) return cur;
    e.grimBlindPick = 1.2 + Math.random();
    const near = this.c.enemies.filter((o) => o !== e && o.alive && !o.undead && o.targetable)
      .sort((a, b) => Math.hypot(a.position.x - e.position.x, a.position.z - e.position.z) - Math.hypot(b.position.x - e.position.x, b.position.z - e.position.z));
    if (near.length) { e.grimBlindFoe = near[Math.random() < 0.75 ? 0 : Math.min(1, near.length - 1)]; return e.grimBlindFoe; }
    e.grimBlindFoe = null;
    const a = Math.random() * 6.28, B = this.bounds();
    const spot = e.grimBlindSpot || (e.grimBlindSpot = { position: new THREE.Vector3(), state: 'dead', facing: 0 });
    spot.position.set(Math.max(-B.x + 1, Math.min(B.x - 1, e.position.x + Math.cos(a) * 4)), 0, Math.max(-B.z + 1, Math.min(B.z - 1, e.position.z + Math.sin(a) * 4)));
    return spot;
  }
  blindStrike(e, inReach, dmg) { // combat.enemyStrike: o golpe do cego pega o inimigo que ele persegue (nunca a Maga)
    if (!(e.grimBlindT > 0) || e.data.boss) return false;
    const t = e.target;
    if (t && t !== e && t.alive && t.targetable && !t.undead && t.data && inReach(t.position, t.data.radius)) {
      const dx = t.position.x - e.position.x, dz = t.position.z - e.position.z, d = Math.hypot(dx, dz) || 1;
      this.vfx.sparks(v3(t.position.x, 1.2, t.position.z), VIOLET, 8);
      audio.play('hit', t.position.x, t.position.z, { v: 0.7 });
      this.hurt(t, Math.max(1, Math.round(dmg * L1.grim.eclipse.mul)), dx / d, dz / d, 'dmg', null);
      this.log({ type: 'grimBlindHit', enemy: t, by: e });
    }
    return true;
  }

  clear() {
    this.fallen.length = 0;
    for (const e of this.c.enemies) if (e.state === 'lanceFly' && e.grimSpin) { e.grimSpin = null; grimRelease(this, e, 0, 1, 0, 0, null); }
    for (const ef of this.effects) if (ef.onClear) ef.onClear(ef);
    this.effects.length = 0;
    this.timers.length = 0;
    this.ui.tintOff();
    for (const p of this.c.players) if (p.grim && p.grim.phase === 'intro') this.finishIntro(p);
  }
}

// Brilho do livro na cena de entrada (luz violeta pulsando no livro).
function bookGlow(k, book, t) {
  const pos = book.g.position;
  k.glow(pos.x, pos.z, VIOLET, 14 + 6 * Math.sin(t * 12));
  book.glow = Math.max(book.glow, 0.6 + 0.4 * Math.sin(t * 6));
}
