// Rapieira do Ladino, 3ª leva de bênçãos (lista do dono, 08/11/2026): as regras. O visual está em rapprops2.js.
// Espetinho, Já Está Morto, Constelação, Linha e Agulha, Touché!, Pistola de Pederneira, Um por Todos, Xeque-Mate.
// Sem import de combat.js: o combate cria o kit (combat.rap2) e chama os ganchos (strike, afterStrike, hold,
// onHit, onKill, onHurt, takenMul, dmgMul, tick, clear). player.js chama applyRap2 / rap2Reset.
import * as THREE from 'three';
import { audio } from './audio.js';
import { ENEMIES } from './enemies.js';
import { ghostFencer, pistol, muzzleFlash, streak, streak2 } from './rapprops.js';
import { holeMark, starMark, thinLine, setLine, starFill, scoreBoard, setScore, crownMesh, musketHat, glowSprite, dispose, dizzyStars, spinStars } from './rapprops2.js';

export const RAP2 = {
  skewer: { max: 3, hold: 6, slots: [0.95, 1.35, 1.75], chest: 0.7, y: 0.55, speed: 22, range: 12, hitDmg: 18, crashDmg: 18, stun: 0.9 }, // Espetinho
  delay: { wait: 1.0, mul: 1.5, holes: 8, click: 0.22 },                       // Já Está Morto: 1 s sem atacar = clic
  stars: { max: 5, wait: 1.0, life: 6, base: 10, per: 5, edge: 0.7, stun: 0.6, merge: 0.8 }, // Constelação
  thread: { life: 6, max: 6, time: 0.22, base: 10, per: 4, stun: 1.0 },        // Linha e Agulha
  touche: { need: 5, boss: 5, bossPct: 0.2 },                                  // Touché! (acerto dele zera o placar)
  light: { every: 0.085, arc: 140, extra: 0.4 },                               // Velocidade da Luz
  dance: { t: 3, boss: 1.5, spin: 0.45 },                                      // Vem Dançar
  pistol: { dmg: 22, range: 6.5, arc: 30, push: 22, recoil: 30, show: 0.45 },  // Pistola de Pederneira
  musk: { max: 2, side: 1.5, mul: 0.5, fly: 0.45 },                            // Um por Todos
  crown: { hp: 30, mul: 0.3 },                                                 // Xeque-Mate: +30 vida e 30% em tudo
};
const DEG = Math.PI / 180;
const GOLD = 0xffe27a, RED = 0xff3048, BLUE = 0x9fe0ff;
const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const isRap = (p) => !!(p && p.heroId === 'rogue' && p.hero && p.hero.weaponId === 'rapieira');
const has = (p, k) => isRap(p) && !!W(p)[k];
const PISTOL_STEP = { clip: 'Ranged_1H_Shoot', speed: 1.7, hit: 0.3, end: 0.62, lunge: 0, damage: RAP2.pistol.dmg, rap2: 'pistol' };
// Velocidade da Luz: o golpe em si (a 1ª estocada sai no tempo do golpe; as outras, uma por inimigo, em seguida).
const LIGHT_STEP = { clip: 'Melee_1H_Attack_Stab', speed: 2.4, hit: 0.2, end: 0.5, window: 0.62, lunge: 0, damage: 6, rap2: 'light' };
const LIGHT_HIT = { damage: 6, stab: true, rap2: 'lightHit' };
const BUSY = new Set(['held', 'thrown', 'spawn', 'rage', 'dead', 'spinMove', 'spinGather', 'spin', 'roll', 'hop', 'leap', 'lanceHeld', 'lanceFly', 'fistHeld', 'fistFly']);
const ATTACKING = new Set(['attack', 'rapFlurry', 'rapLunge', 'rapRiposte']);
let K2 = null;

// ---------- Herói (player.js) ----------
// Pistola de Pederneira: o combo ganha um 4º golpe (tiro à queima-roupa) depois da estocada forte.
// Velocidade da Luz: um golpe novo antes do golpe forte (estocadas rápidas em quem está de costas).
export function applyRap2(p) {
  if (!isRap(p)) return;
  const h = p.hero, w = W(p);
  if (w.rLight && !h.combo.some((s) => s.rap2 === 'light')) {
    const hi = h.combo.findIndex((s) => s.heavy);
    if (hi > 0) { h.combo.splice(hi, 0, { ...LIGHT_STEP }); h.heavyIdx = hi + 1; }
  }
  if (!w.rPistol || h.combo.some((s) => s.rap2 === 'pistol')) return;
  const n = h.combo.length - 1;
  h.combo[n] = { ...h.combo[n], window: h.combo[n].window ?? 0.45 };
  h.combo.push({ ...PISTOL_STEP });
}
// Troca de arma/herói, partida nova.
export function rap2Reset(p) {
  if (K2) K2.dropFor(p);
  p.rap2AtkT = 0; p.rap2Stars = null; p.rap2SkSeq = -1;
}
export const rap2Mul = (p) => (p && p.rapCrown ? 1 + RAP2.crown.mul : 1); // Xeque-Mate: velocidade de ataque/movimento

export class Rap2Kit {
  constructor(c) {
    this.c = c; K2 = this;
    this.scene = c.scene;
    this.time = 0;
    this.later = [];
    this.bodies = [];            // Espetinho: {p, e, slot, phase: held|fly, t, dx, dz, dist, hit}
    this.holes = new Map();      // Já Está Morto: e -> {by, dmg, n, marks[]}
    this.threads = [];           // Linha e Agulha: {e, by, t}
    this.lines = [];             // linhas vermelhas desenhadas
    this.pulls = [];             // puxões em andamento
    this.scores = new Map();     // Touché!: e -> {me, him, s, by, seq}
    this.musk = new Map();       // Um por Todos: p -> [esquerda, direita]
    this.pistols = new Map();    // Pistola: p -> {g}
    this.king = null;            // Xeque-Mate: {e, g}
    this.kingDone = false;
    this.crowns = new Map();     // coroa na cabeça do herói
    this.dizzy = new Set();      // Vem Dançar: inimigos tontos
  }
  log(o) { if (this.c.log) this.c.log(o); }
  dmg(p, n) { return Math.max(1, Math.round(n * ((p && p.stats && p.stats.damageMul) || 1))); }
  rm(o) { if (o) { o.removeFromParent(); dispose(o); } }
  foes(x, z, r, skip = null) {
    return this.c.enemies.filter((o) => o !== skip && o.targetable && !o.undead && !(o.data && o.data.phantom)
      && Math.hypot(o.position.x - x, o.position.z - z) <= r + o.data.radius);
  }
  backstab(p, e) { return Math.abs(wrap(Math.atan2(p.position.x - e.position.x, p.position.z - e.position.z) - e.facing)) > 110 * DEG; }
  stun(e, t) {
    if (e.state === 'hurt' && (e.stunTime - e.t) >= t) return true;
    return !!(e.daze && e.daze(t));
  }

  // ---------- Ganchos do combate ----------
  // Golpe com efeito próprio (playerStrike). true = tratou (Pistola).
  strike(p, step) {
    if (step.rap2 === 'light' && isRap(p)) return this.lightStart(p, step);
    if (step.rap2 !== 'pistol' || !isRap(p)) return false;
    this.shoot(p, step);
    this.muskStrike(p, step);
    return true;
  }

  // Depois do golpe normal (playerStrike): mosqueteiros repetem, estrela, golpe forte puxa/arremessa.
  afterStrike(p, step, hits) {
    if (!isRap(p) || step.musk || step.rapExtra) return;
    void hits;
    this.muskStrike(p, step);
    if (has(p, 'rStars')) this.addStar(p);
    if (step.heavy && has(p, 'rSkewer')) this.launch(p);
    if (step.heavy && has(p, 'rThread')) this.pull(p);
  }

  // Já Está Morto: o dano fica guardado no furo (true = não tira vida agora).
  hold(p, e, dmg, step, opts) {
    if (!has(p, 'rDelay') || step.musk || (opts && (opts.ranged || opts.spell)) || e.immune) return false;
    let H = this.holes.get(e);
    if (!H) { H = { by: p, dmg: 0, n: 0, marks: [] }; this.holes.set(e, H); }
    H.dmg += dmg; H.n++; H.by = p;
    if (H.marks.length < RAP2.delay.holes) {
      const m = holeMark();
      const sc = 1 / (e.group.scale.x || 1);
      m.position.set((Math.random() - 0.5) * 0.7, 0.9 + Math.random() * 0.8, (Math.random() - 0.5) * 0.5 + 0.2);
      m.scale.setScalar(sc);
      m.userData.ph = Math.random() * 6;
      e.group.add(m);
      H.marks.push(m);
    }
    this.c.text.add(`(${dmg})`, e.position, 'miss', 2.2);
    this.log({ type: 'rapHold', enemy: e, dmg, total: H.dmg });
    return true;
  }

  // Depois do dano (wbOnHit).
  onHit(p, e, step, r) {
    if (!isRap(p) || step.musk) return;
    const w = W(p);
    if (e.alive) e.rap2Back = this.backstab(p, e);
    if (w.rCrown && this.king && this.king.e === e) e.rap2Back = this.backstab(p, e);
    if (w.rTouche && !(step.rapExtra && !step.heavy)) this.point(p, e);
    if (step.rap2 === 'lightHit') return;
    if (r.died || !e.alive) return;
    if (w.rSkewer && !step.heavy && !step.rapExtra && step.rap2 !== 'pistol' && p.rap2SkSeq !== p.swingSeq && this.canSkewer(p, e)) { this.skewer(p, e); return; }
    if (w.rThread && e.targetable) this.thread(p, e);
  }

  // Inimigo derrotado (combat.killed).
  onKill(e, by) {
    if (this.king && this.king.e === e) this.kingDied(e, by);
    const S = this.scores.get(e); if (S) { this.rm(S.s); this.scores.delete(e); }
    const H = this.holes.get(e); if (H) { for (const m of H.marks) this.rm(m); this.holes.delete(e); }
    if (by && has(by, 'rMusk') && by.state !== 'dead' && !e.undead && !(e.data && e.data.phantom)) this.spawnMusk(by, e);
  }

  // O herói tomou dano (combat.hitPlayer): Touché! (ponto dele), mosqueteiros somem, espeto cai.
  onHurt(p, e) {
    if (!isRap(p)) return;
    if (W(p).rTouche && e && e.alive && e.data && this.c.enemies.includes(e)) this.pointFoe(p, e);
    const M = this.musk.get(p);
    if (M && M.some(Boolean)) {
      for (let i = 0; i < M.length; i++) if (M[i]) { this.c.vfx.smoke(v3(M[i].g.position.x, 0.8, M[i].g.position.z), BLUE, 10); this.removeMusk(M[i]); M[i] = null; }
      this.c.text.add('Os mosqueteiros sumiram!', p.position, 'hurt', 3.6);
      this.log({ type: 'rapMuskGone' });
    }
  }
  // Xeque-Mate: dano recebido e dano causado com a coroa.
  takenMul(p) { return p && p.rapCrown ? 1 - RAP2.crown.mul : 1; }
  dmgMul(p) { return p && p.rapCrown ? 1 + RAP2.crown.mul : 1; }

  // ---------- Pistola de Pederneira ----------
  shoot(p, step) {
    const c = this.c, P = RAP2.pistol;
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    let t = null, bd = Infinity;
    for (const e of c.enemies) {
      if (!e.targetable) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.001;
      if (d > P.range + e.data.radius || Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > P.arc * DEG) continue;
      if (d < bd) { bd = d; t = e; }
    }
    const mx = p.position.x + fx * 0.9, mz = p.position.z + fz * 0.9;
    const fl = muzzleFlash(); fl.position.set(mx, 1.3, mz);
    c.vfx.add(fl, 0.14, (o, k) => { o.scale.setScalar(1 + k * 1.4); o.children.forEach((s) => { s.material.opacity = 1 - k; }); });
    c.vfx.smoke(v3(mx, 1.25, mz), 0xb8b8b8, 10);
    audio.play('pistol', p.position.x, p.position.z);
    audio.play('boom', p.position.x, p.position.z, { v: 0.5 });
    c.shakeFor(p, 0.25);
    c.text.add('BANG!', p.position, 'crit', 4.0);
    // coice: o Ladino é jogado para trás
    p.vel.set(-fx, 0, -fz).multiplyScalar(P.recoil);
    const len = t ? Math.max(0.5, bd - 0.9) : P.range;
    const tr = streak(0xffe6a0, 0.9);
    tr.position.set(mx, 1.3, mz); tr.rotation.y = p.facing; tr.scale.set(0.08, 1, len);
    c.vfx.add(tr, 0.16, (o, k) => { o.material.opacity = 0.9 * (1 - k); });
    if (!t) { this.log({ type: 'rapPistol', hit: false }); return; }
    const dx = t.position.x - p.position.x, dz = t.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
    c.vfx.sparks(v3(t.position.x, 1.2, t.position.z), 0xffd070, 16);
    const r = c.damageEnemy(p, t, step, dx / d, dz / d);
    if (t.alive && r !== 'blocked') {
      if (t.offBalance && !t.data.boss) t.offBalance(dx / d, dz / d, 0.8, P.push);
      else if (t.vel) t.vel.set(dx / d, 0, dz / d).multiplyScalar(P.push * 0.25);
    }
    c.addHitstop(0.07);
    this.log({ type: 'rapPistol', hit: true, enemy: t, r });
  }
  // Pistola na mão direita (a rapieira some) enquanto o 4º golpe dura.
  syncPistol(p) {
    const want = p.state === 'attack' && !p.xstep && p.hero.combo[p.combo] && p.hero.combo[p.combo].rap2 === 'pistol';
    let gun = this.pistols.get(p);
    if (want && !gun && p.model) {
      const bone = p.model.getObjectByName('handslotr');
      if (bone) { gun = { g: pistol() }; gun.g.rotation.x = -Math.PI / 2; gun.g.scale.setScalar(1.3); bone.add(gun.g); this.pistols.set(p, gun); }
    }
    if (!want && gun) { this.rm(gun.g); this.pistols.delete(p); }
    if (p.weapon) p.weapon.visible = !this.pistols.has(p);
  }

  // ---------- Espetinho ----------
  canSkewer(p, e) {
    if (!e.alive || !e.targetable || e.data.boss || e.data.phantom || e.finale || e.undead || BUSY.has(e.state)) return false;
    return this.bodies.filter((b) => b.p === p && b.phase === 'held').length < RAP2.skewer.max;
  }
  skewer(p, e) {
    p.rap2SkSeq = p.swingSeq;
    e.releaseToken && e.releaseToken();
    if (e.atk && e.state === 'attack' && e.endAttack) e.endAttack();
    e.vel.set(0, 0, 0);
    e.setState('lanceHeld');
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.5 });
    const used = new Set(this.bodies.filter((b) => b.p === p && b.phase === 'held').map((b) => b.slot));
    let slot = 0; while (used.has(slot)) slot++;
    this.bodies.push({ p, e, slot, phase: 'held', t: 0 });
    const n = this.bodies.filter((b) => b.p === p && b.phase === 'held').length;
    this.c.text.add(n > 1 ? `Espetinho ×${n}` : 'Espetado!', e.position, 'crit', 3.4);
    audio.play('crunch', e.position.x, e.position.z, { v: 0.8 });
    this.log({ type: 'rapSkewer', enemy: e, n });
  }
  launch(p) {
    const held = this.bodies.filter((b) => b.p === p && b.phase === 'held');
    if (!held.length) return;
    const dx = Math.sin(p.facing), dz = Math.cos(p.facing);
    for (const b of held) { b.phase = 'fly'; b.t = 0; b.dist = 0; b.dx = dx; b.dz = dz; b.hit = new Set(); b.e.setState('lanceFly'); }
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.2 });
    this.c.text.add(held.length > 1 ? `Espetinho voador ×${held.length}!` : 'Arremessou!', p.position, 'crit', 3.6);
    this.c.shakeFor(p, 0.15);
    this.log({ type: 'rapSkewerThrow', n: held.length });
  }
  // Espetinho: o esqueleto fica atravessado pelo meio do peito, ao longo da lâmina, e acompanha a espada.
  // O 1º afunda até perto do punho; os outros ficam mais para a ponta.
  placeHeld(b) {
    const S = RAP2.skewer, p = b.p, e = b.e, wp = p.weapon;
    const sc = e.group.scale.x || 1;
    const d = S.slots[b.slot] ?? S.slots[S.slots.length - 1];
    const sink = Math.min(1, b.t / 0.12); // escorrega para dentro da lâmina logo depois de espetar
    const along = (p.hero.weapons && p.hero.weapons.right && p.hero.weapons.right.tip) || 1.9;
    let x, y, z;
    if (wp && wp.visible !== false) {
      wp.updateWorldMatrix(true, false);
      const pt = (this._v ||= new THREE.Vector3()).set(0, along - (along - d) * sink, 0);
      wp.localToWorld(pt);
      x = pt.x; y = pt.y; z = pt.z;
      const base = (this._v2 ||= new THREE.Vector3()).set(0, 0, 0); wp.localToWorld(base);
      // a lâmina de lado: o corpo fica de frente para o punho
      const bx = x - base.x, bz = z - base.z;
      e.facing = Math.hypot(bx, bz) > 0.05 ? Math.atan2(-bx, -bz) : p.facing + Math.PI;
    } else {
      const a = p.facing; x = p.position.x + Math.sin(a) * (0.7 + d); z = p.position.z + Math.cos(a) * (0.7 + d); y = 1.2;
      e.facing = a + Math.PI;
    }
    e.position.x = x; e.position.z = z;
    e.position.y = Math.max(-0.15, y - S.chest * sc); // o peito na lâmina (sem afundar no chão)
    e.group.rotation.y = e.facing;
    if (e.model) { e.model.rotation.x = 0.12; e.model.rotation.z = 0.05 * Math.sin(b.t * 5 + b.slot * 2); } // mole, pendurado
    e.vel.set(0, 0, 0);
  }
  dropBody(b, stun) {
    const e = b.e;
    const i = this.bodies.indexOf(b); if (i >= 0) this.bodies.splice(i, 1);
    e.position.y = 0; if (e.model) { e.model.rotation.x = 0; e.model.rotation.z = 0; }
    if (!e.alive) return;
    e.setState('hurt'); e.stunTime = stun;
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05 });
    if (this.c.world) { this.c.world.resolveCircle(e.position, e.data.radius); this.c.world.clampInside(e.position, e.data.radius); }
  }
  crashBody(b) {
    const c = this.c, p = b.p, e = b.e;
    c.vfx.heavyImpact(v3(e.position.x, 0, e.position.z), 0.7);
    audio.play('crunch', e.position.x, e.position.z, { v: 1.0 });
    this.dropBody(b, RAP2.skewer.stun);
    if (e.alive) c.bonusDamage(e, this.dmg(p, RAP2.skewer.crashDmg), -b.dx, -b.dz, 'dmg big', p);
  }
  tickBodies(dt) {
    const c = this.c, S = RAP2.skewer, wd = c.world;
    for (const b of [...this.bodies]) {
      const p = b.p, e = b.e;
      b.t += dt;
      if (!e.alive || (e.state !== 'lanceHeld' && e.state !== 'lanceFly')) { const i = this.bodies.indexOf(b); if (i >= 0) this.bodies.splice(i, 1); continue; }
      if (b.phase === 'held') {
        // rolar solta o espeto (08/11, pedido do dono)
        const ok = p.state !== 'dead' && p.state !== 'hurt' && p.state !== 'stagger' && p.state !== 'rooted' && p.state !== 'dodge' && isRap(p) && has(p, 'rSkewer');
        if (!ok || b.t > S.hold) {
          if (p.state === 'dodge' && e.alive) { this.c.text.add('Soltou!', e.position, 'miss', 2.6); this.log({ type: 'rapSkewerDrop', why: 'dodge' }); }
          this.dropBody(b, 0.5); continue;
        }
        this.placeHeld(b); // a posição certa vem em afterMove (depois de tudo se mexer)
        continue;
      }
      // voando: todos juntos, como um projétil só; atravessa os inimigos e para na parede
      const step = S.speed * dt / 3;
      let done = false;
      for (let k = 0; k < 3 && !done; k++) {
        const nx = e.position.x + b.dx * step, nz = e.position.z + b.dz * step;
        const out = wd && wd.bounds && (Math.abs(nx) > wd.bounds.x - e.data.radius || Math.abs(nz) > wd.bounds.z - e.data.radius);
        if ((wd && wd.blocked(nx, nz, e.data.radius * 0.7)) || out) { this.crashBody(b); done = true; break; }
        e.position.x = nx; e.position.z = nz; b.dist += step;
        for (const o of [...c.enemies]) {
          if (o === e || !o.targetable || b.hit.has(o)) continue;
          if (Math.hypot(o.position.x - nx, o.position.z - nz) > o.data.radius + e.data.radius) continue;
          b.hit.add(o);
          c.bonusDamage(o, this.dmg(p, S.hitDmg), b.dx, b.dz, 'dmg big', p);
          if (o.alive && o.offBalance && !o.data.boss) o.offBalance(b.dx, b.dz, 0.8, 10);
          c.vfx.sparks(v3(o.position.x, 1.1, o.position.z), 0xffb050, 10);
          c.text.add('Strike!', o.position, 'crit', 3.2);
          c.addHitstop(0.03);
          this.log({ type: 'rapSkewerHit', enemy: o });
        }
        if (b.dist >= S.range) { this.crashBody(b); done = true; }
      }
      if (done) continue;
      e.position.y = 0.9;
      if (e.model) e.model.rotation.x = -1.2;
      e.vel.set(0, 0, 0);
    }
  }

  // ---------- Já Está Morto ----------
  tickHoles(dt) {
    for (const [e, H] of [...this.holes]) {
      if (!e.alive || !this.c.enemies.includes(e)) { for (const m of H.marks) this.rm(m); this.holes.delete(e); continue; }
      for (const m of H.marks) { const k = 0.75 + 0.25 * Math.sin(this.time * 9 + m.userData.ph); m.userData.halo.material.opacity = 0.75 * k; }
    }
    for (const p of this.c.players) {
      if (ATTACKING.has(p.state)) p.rap2AtkT = this.time;
      if (p.rap2Click || !has(p, 'rDelay')) continue;
      let any = false;
      for (const H of this.holes.values()) if (H.by === p) { any = true; break; }
      if (!any || this.time - (p.rap2AtkT || 0) < RAP2.delay.wait) continue;
      // clic... e os furos abrem
      p.rap2Click = true;
      audio.play('reload', p.position.x, p.position.z, { v: 1.2 });
      this.c.text.add('clic', p.position, 'miss', 3.2);
      this.log({ type: 'rapClick' });
      this.later.push({ t: RAP2.delay.click, fn: () => this.release(p) });
    }
  }
  release(p) {
    const c = this.c;
    p.rap2Click = false;
    let n = 0, total = 0;
    for (const [e, H] of [...this.holes]) {
      if (H.by !== p) continue;
      for (const m of H.marks) { c.vfx.sparks(m.getWorldPosition(new THREE.Vector3()), RED, 6); this.rm(m); }
      this.holes.delete(e);
      if (!e.alive) continue;
      const dmg = Math.max(1, Math.round(H.dmg * RAP2.delay.mul));
      // dano direto (o espetado/voando também abre)
      e.lastHitBy = p;
      const died = e.takeDamage(dmg, 0, 1, 1, true);
      c.text.add(`${dmg}!`, e.position, 'dmg big', 2.6);
      c.text.add('?!', e.position, 'miss', 3.4);
      c.vfx.sparks(v3(e.position.x, 1.3, e.position.z), RED, 14);
      if (died) c.killed(e, 0, 1, p);
      n++; total += dmg;
    }
    if (!n) return;
    c.text.add('Você já está morto.', p.position, 'crit', 4.2);
    audio.play('crunch', p.position.x, p.position.z, { v: 1.2 });
    audio.play('hitHeavy', p.position.x, p.position.z);
    c.addHitstop(0.08);
    c.shakeFor(p, 0.3);
    this.log({ type: 'rapRelease', n, total });
  }

  // ---------- Constelação ----------
  addStar(p) {
    const S = RAP2.stars, c = this.c;
    const L = p.rap2Stars || (p.rap2Stars = { list: [], last: 0 });
    const range = p.hero.attackRange * (p.stats.rangeMul || 1) * 0.85;
    const pos = v3(p.position.x + Math.sin(p.facing) * range, 0, p.position.z + Math.cos(p.facing) * range);
    if (c.world) c.world.clampInside(pos, 0.3);
    L.last = this.time;
    const near = L.list.find((s) => Math.hypot(s.x - pos.x, s.z - pos.z) < S.merge);
    if (near) { near.age = 0; near.pulse = 0.3; return; }
    const g = starMark();
    g.position.set(pos.x, 1.3, pos.z);
    this.scene.add(g);
    L.list.push({ x: pos.x, z: pos.z, g, age: 0, pulse: 0.3 });
    // linha fina até a estrela anterior (vai desenhando a figura)
    const prev = L.list[L.list.length - 2];
    if (prev) { const ln = thinLine(GOLD, 0.5); setLine(ln, prev.x, prev.z, pos.x, pos.z, 1.3, 0.05); this.scene.add(ln); L.list[L.list.length - 1].ln = ln; }
    audio.play('blessing', pos.x, pos.z, { v: 0.3 });
    this.log({ type: 'rapStar', n: L.list.length });
    if (L.list.length >= S.max) this.form(p);
  }
  tickStars(dt) {
    const S = RAP2.stars;
    for (const p of this.c.players) {
      const L = p.rap2Stars;
      if (!L || !L.list.length) continue;
      if (!has(p, 'rStars') || p.state === 'dead') { this.dropStars(L); continue; }
      for (let i = L.list.length - 1; i >= 0; i--) {
        const s = L.list[i];
        s.age += dt; s.pulse = Math.max(0, (s.pulse || 0) - dt);
        const k = 1 + s.pulse * 2 + 0.08 * Math.sin(this.time * 6 + i);
        s.g.scale.setScalar(k);
        s.g.userData.rays.rotation.z += dt * 0.8;
        if (s.age > S.life) { this.rm(s.g); this.rm(s.ln); L.list.splice(i, 1); }
      }
      if (L.list.length >= 3 && this.time - L.last >= S.wait) this.form(p);
    }
  }
  dropStars(L) { for (const s of L.list) { this.rm(s.g); this.rm(s.ln); } L.list.length = 0; }
  form(p) {
    const S = RAP2.stars, c = this.c, L = p.rap2Stars;
    const pts = L.list.map((s) => ({ x: s.x, z: s.z }));
    const n = pts.length;
    const hull = convexHull(pts);
    // figura: linhas douradas entre as estrelas de fora + polígono no chão
    const fx = [];
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i], b = hull[(i + 1) % hull.length];
      if (hull.length === 2 && i === 1) break;
      const ln = thinLine(0xfff0b0, 0.95); setLine(ln, a.x, a.z, b.x, b.z, 1.3, 0.12); fx.push(ln);
      const gl = thinLine(GOLD, 0.6); setLine(gl, a.x, a.z, b.x, b.z, 0.08, 0.3); fx.push(gl);
    }
    if (hull.length >= 3) fx.push(starFill(hull));
    for (const o of fx) c.vfx.add(o, 0.7, (m, k) => { m.material.opacity = (m.userData.o0 ??= m.material.opacity) * (1 - k); });
    for (const s of L.list) { c.vfx.sparks(v3(s.x, 1.3, s.z), GOLD, 10); this.rm(s.g); this.rm(s.ln); }
    L.list.length = 0;
    const dmg = this.dmg(p, S.base + S.per * n);
    let hit = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable || e.undead) continue;
      const q = { x: e.position.x, z: e.position.z };
      const inside = hull.length >= 3 && inConvex(hull, q);
      let edge = Infinity;
      for (let i = 0; i < hull.length; i++) edge = Math.min(edge, segDist(q, hull[i], hull[(i + 1) % hull.length]));
      if (!inside && edge > S.edge + e.data.radius) continue;
      c.bonusDamage(e, dmg, 0, 1, 'dmg big', p, true);
      if (e.alive) this.stun(e, S.stun);
      c.vfx.sparks(v3(e.position.x, 1.4, e.position.z), 0xfff4c0, 10);
      hit++;
    }
    c.text.add(`Constelação de ${n}!`, p.position, 'crit', 4.0);
    audio.play('zap', p.position.x, p.position.z, { v: 0.8 });
    audio.play('blessing', p.position.x, p.position.z, { v: 0.7 });
    if (hit) c.addHitstop(0.06);
    this.log({ type: 'rapConstellation', n, hit, dmg });
  }

  // ---------- Linha e Agulha ----------
  thread(p, e) {
    const T = RAP2.thread;
    const o = this.threads.find((x) => x.e === e && x.by === p);
    if (o) { o.t = T.life; return; }
    this.threads.push({ e, by: p, t: T.life });
    const mine = this.threads.filter((x) => x.by === p);
    if (mine.length > T.max) this.threads.splice(this.threads.indexOf(mine[0]), 1);
    this.c.text.add('Costurado!', e.position, 'bleed', 2.8);
    this.c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), RED, 6);
    this.log({ type: 'rapThread', enemy: e, n: Math.min(mine.length, T.max) });
  }
  pull(p) {
    const c = this.c, T = RAP2.thread;
    const list = this.threads.filter((x) => x.by === p && x.e.alive && x.e.targetable).map((x) => x.e);
    if (list.length < 2) return;
    this.threads = this.threads.filter((x) => x.by !== p);
    const boss = list.find((e) => e.data.boss);
    const cx = boss ? boss.position.x : list.reduce((a, e) => a + e.position.x, 0) / list.length;
    const cz = boss ? boss.position.z : list.reduce((a, e) => a + e.position.z, 0) / list.length;
    const items = list.map((e) => ({ e, x0: e.position.x, z0: e.position.z }));
    for (const it of items) if (!it.e.data.boss) this.stun(it.e, T.time + 0.3);
    this.pulls.push({ p, items, cx, cz, t: 0 });
    c.text.add('Puxou a linha!', p.position, 'crit', 3.6);
    audio.play('grab', p.position.x, p.position.z, { v: 0.9 });
    this.log({ type: 'rapPull', n: list.length });
  }
  tickPulls(dt) {
    const c = this.c, T = RAP2.thread;
    for (const P of [...this.pulls]) {
      P.t += dt;
      const k = Math.min(1, P.t / T.time), kk = k * k;
      for (const it of P.items) {
        const e = it.e;
        if (!e.alive || e.data.boss) continue;
        const dx = it.x0 - P.cx, dz = it.z0 - P.cz, d = Math.hypot(dx, dz) || 0.001;
        const stop = Math.min(d, e.data.radius * 0.9);
        const tx = P.cx + dx / d * stop, tz = P.cz + dz / d * stop;
        e.position.x = it.x0 + (tx - it.x0) * kk; e.position.z = it.z0 + (tz - it.z0) * kk;
        e.vel.set(0, 0, 0);
      }
      // linhas encolhendo até o centro
      if (k >= 1) {
        this.pulls.splice(this.pulls.indexOf(P), 1);
        const n = P.items.length, dmg = this.dmg(P.p, T.base + T.per * (n - 1));
        for (const it of P.items) {
          const e = it.e;
          if (!e.alive) continue;
          if (c.world) c.world.resolveCircle(e.position, e.data.radius);
          c.bonusDamage(e, dmg, 0, 1, 'dmg big', P.p);
          if (e.alive) this.stun(e, T.stun);
        }
        c.vfx.heavyImpact(v3(P.cx, 0, P.cz), 1.0);
        c.vfx.sparks(v3(P.cx, 1.2, P.cz), RED, 20);
        audio.play('crunch', P.cx, P.cz, { v: 1.2 });
        audio.play('thump', P.cx, P.cz);
        c.shakeFor(P.p, 0.25);
        c.addHitstop(0.07);
        c.text.add(`Costurou ${n}!`, { x: P.cx, z: P.cz }, 'crit', 3.8);
        this.log({ type: 'rapPullHit', n, dmg });
      }
    }
  }
  tickThreads(dt) {
    for (let i = this.threads.length - 1; i >= 0; i--) {
      const o = this.threads[i];
      o.t -= dt;
      if (o.t <= 0 || !o.e.alive || !o.e.targetable || !has(o.by, 'rThread')) this.threads.splice(i, 1);
    }
    // linhas: do Ladino (ponta da rapieira) até o último costurado, e de um costurado ao outro
    const segs = [];
    for (const p of this.c.players) {
      const mine = this.threads.filter((x) => x.by === p);
      if (!mine.length) continue;
      const r = p.hero.attackRange * 0.5;
      let ax = p.position.x + Math.sin(p.facing) * r, az = p.position.z + Math.cos(p.facing) * r;
      for (let i = mine.length - 1; i >= 0; i--) { const e = mine[i].e; segs.push([ax, az, e.position.x, e.position.z]); ax = e.position.x; az = e.position.z; }
    }
    for (const P of this.pulls) {
      for (const it of P.items) segs.push([P.cx, P.cz, it.e.position.x, it.e.position.z]);
    }
    while (this.lines.length < segs.length) { const m = thinLine(0xff2a3a, 1); m.material.blending = THREE.NormalBlending; m.material.depthTest = false; m.renderOrder = 5; this.scene.add(m); this.lines.push(m); }
    for (let i = 0; i < this.lines.length; i++) {
      const m = this.lines[i];
      if (i >= segs.length) { m.visible = false; continue; }
      m.visible = true;
      const [x1, z1, x2, z2] = segs[i];
      setLine(m, x1, z1, x2, z2, 1.15 + 0.03 * Math.sin(this.time * 7 + i), 0.13);
    }
  }

  // ---------- Touché! ----------
  score(e, p) {
    let S = this.scores.get(e);
    if (!S) { S = { me: 0, him: 0, s: scoreBoard(), by: p, seq: -1 }; this.scene.add(S.s); this.scores.set(e, S); }
    this.placeScore(e, S);
    return S;
  }
  placeScore(e, S) { // acima da cabeça
    const sc = e.group.scale.x || 1;
    S.s.position.set(e.position.x, 3.5 * sc + e.position.y, e.position.z - 0.3 * sc);
  }
  point(p, e) {
    const T = RAP2.touche, c = this.c;
    const S = this.score(e, p);
    if (S.seq === p.swingSeq) return; // 1 toque por golpe
    S.seq = p.swingSeq; S.by = p;
    S.me++;
    const need = e.data.boss ? T.boss : T.need;
    setScore(S.s, S.me, RAP2.touche.need);
    S.pop = 0.25;
    this.log({ type: 'rapTouch', enemy: e, me: S.me, him: S.him });
    if (S.me < need) return;
    S.me = 0; S.him = 0;
    this.later.push({ t: 0.06, fn: () => {
      setScore(S.s, 0, RAP2.touche.need);
      if (!e.alive || !e.targetable) return;
      c.text.add('TOUCHÉ!', e.position, 'crit', 4.6);
      c.vfx.sparks(v3(e.position.x, 1.6, e.position.z), GOLD, 22);
      c.vfx.ring(v3(e.position.x, 0.1, e.position.z), GOLD, 2.2);
      audio.play('bell', e.position.x, e.position.z);
      c.addHitstop(0.1);
      c.shakeFor(p, 0.25);
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
      if (e.data.boss) c.bonusDamage(e, Math.max(1, Math.round(e.maxHp * T.bossPct)), dx / d, dz / d, 'dmg big', p);
      else c.bonusDamage(e, Math.max(1, Math.ceil(e.hp)), dx / d, dz / d, 'dmg big', p);
      this.log({ type: 'rapTouche', enemy: e, boss: !!e.data.boss });
    } });
  }
  // Acerto dele: o placar dele volta a zero (08/11, pedido do dono).
  pointFoe(p, e) {
    const c = this.c;
    const S = this.score(e, p);
    S.pop = 0.25;
    if (S.me > 0) { c.text.add('Placar zerado!', e.position, 'hurt', 3.6); this.log({ type: 'rapToucheLost', enemy: e }); }
    S.me = 0; S.him = 0;
    setScore(S.s, S.me, RAP2.touche.need);
    this.log({ type: 'rapTouchFoe', enemy: e, me: S.me, him: S.him });
  }
  tickScores(dt) {
    for (const [e, S] of [...this.scores]) {
      if (!e.alive || !this.c.enemies.includes(e) || !has(S.by, 'rTouche')) { this.rm(S.s); this.scores.delete(e); continue; }
      this.placeScore(e, S);
      S.pop = Math.max(0, (S.pop || 0) - dt);
      const k = 1 + S.pop * 1.6;
      S.s.scale.set(2.4 * k, 0.9 * k, 1);
    }
  }

  // ---------- Um por Todos ----------
  spawnMusk(p, from) {
    const M = this.musk.get(p) || (this.musk.set(p, [null, null]), this.musk.get(p));
    const i = M.findIndex((m) => !m);
    if (i < 0) return;
    const f = ghostFencer(p.hero);
    const hat = musketHat();
    hat.position.y = 2.3; f.g.add(hat);
    f.g.position.set(from.position.x, 0, from.position.z);
    this.scene.add(f.g);
    M[i] = { ...f, hat, side: i === 0 ? -1 : 1, k: 0, x0: from.position.x, z0: from.position.z, name: '', id: -1 };
    this.c.vfx.smoke(v3(from.position.x, 0.8, from.position.z), BLUE, 12);
    this.c.text.add(i === 0 ? 'Um por todos!' : 'Todos por um!', p.position, 'crit', 3.8);
    audio.play('summon', p.position.x, p.position.z, { v: 0.6 });
    this.log({ type: 'rapMusk', n: M.filter(Boolean).length });
  }
  removeMusk(m) {
    this.scene.remove(m.g);
    m.mats.forEach((x) => x.dispose());
    this.rm(m.hat);
  }
  muskSpot(p, m, out) {
    const a = p.facing, S = RAP2.musk.side * m.side;
    out.set(p.position.x + Math.cos(a) * S, 0, p.position.z - Math.sin(a) * S);
    const wd = this.c.world;
    if (wd) { wd.resolveCircle(out, 0.35); wd.clampInside(out, 0.35); }
    return out;
  }
  tickMusk(dt) {
    const spot = (this._spot ||= new THREE.Vector3());
    for (const [p, M] of this.musk) {
      const gone = p.state === 'dead' || !has(p, 'rMusk');
      for (let i = 0; i < M.length; i++) {
        const m = M[i];
        if (!m) continue;
        if (gone) { this.removeMusk(m); M[i] = null; continue; }
        m.k = Math.min(1, m.k + dt / RAP2.musk.fly);
        this.muskSpot(p, m, spot);
        const kk = 1 - (1 - m.k) * (1 - m.k);
        m.g.position.set(m.x0 + (spot.x - m.x0) * kk, (p.group.position.y || 0) + (1 - m.k) * 0.8, m.z0 + (spot.z - m.z0) * kk);
        m.g.rotation.y = p.group.rotation.y;
        // repete a animação do Ladino, no mesmo tempo
        const src = p.anim.current;
        if (src) {
          if (m.name !== p.anim.currentName || m.id !== p.anim.playId) {
            m.name = p.anim.currentName; m.id = p.anim.playId;
            m.anim.play(m.name, { once: p.anim.netOnce, restart: true, fade: 0.06, speed: src.timeScale });
          }
          if (m.anim.current) { m.anim.current.time = src.time; m.anim.current.timeScale = src.timeScale; }
          m.anim.update(dt);
        }
        const op = 0.45 * Math.min(1, m.k * 2) + 0.06 * Math.sin(this.time * 8 + i * 2);
        for (const x of m.mats) x.opacity = op;
      }
    }
  }
  // Os mosqueteiros repetem o golpe, cada um do seu lugar (metade do dano).
  muskStrike(p, step) {
    const M = this.musk.get(p);
    if (!M || !M.some((m) => m && m.k >= 0.6)) return;
    const c = this.c, h = p.hero;
    const pistolShot = step.rap2 === 'pistol';
    const range = pistolShot ? RAP2.pistol.range : h.attackRange * (p.stats.rangeMul || 1);
    const arc = (pistolShot ? RAP2.pistol.arc : (step.arc || h.attackArc) / 2) * DEG;
    const single = (h.single && !step.cone) || pistolShot;
    const mstep = { ...step, damage: Math.max(1, Math.round(step.damage * RAP2.musk.mul)), rapExtra: true, musk: true };
    for (const m of M) {
      if (!m || m.k < 0.6) continue;
      const ox = m.g.position.x, oz = m.g.position.z;
      if (pistolShot) {
        const fl = muzzleFlash(); fl.position.set(ox + Math.sin(p.facing) * 0.9, 1.3, oz + Math.cos(p.facing) * 0.9);
        c.vfx.add(fl, 0.12, (o, k) => { o.scale.setScalar(0.8 + k); o.children.forEach((s) => { s.material.opacity = 0.8 * (1 - k); }); });
      } else if (step.cone) c.vfx.sector(m.g.position, p.facing, range, arc, BLUE);
      else {
        const s = streak2(BLUE, 0.7);
        s.position.set(ox, 1.15, oz); s.rotation.y = p.facing; s.scale.set(0.12, 0.12, range);
        c.vfx.add(s, 0.16, (o, k) => { for (const x of o.userData.mats) x.opacity = 0.7 * (1 - k); });
      }
      const cand = [];
      for (const e of c.enemies) {
        if (!e.targetable) continue;
        const dx = e.position.x - ox, dz = e.position.z - oz, d = Math.hypot(dx, dz) || 0.001;
        if (d <= range + e.data.radius && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) <= arc) cand.push([d, e, dx / d, dz / d]);
      }
      cand.sort((a, b) => a[0] - b[0]);
      const pick = single ? cand.slice(0, 1 + ((p.stats.w && p.stats.w.pierceMelee) || 0)) : cand;
      for (const [, e, nx, nz] of pick) { c.damageEnemy(p, e, mstep, nx, nz); c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), BLUE, 6); }
      this.log({ type: 'rapMuskHit', n: pick.length, side: m.side });
    }
  }

  // ---------- Xeque-Mate ----------
  pickKing() {
    const c = this.c;
    const list = c.waveList;
    let best = null;
    if (list && list.length) {
      let bt = null, bh = -1;
      for (const wv of list) for (const [type] of wv) { const hp = (ENEMIES[type] && ENEMIES[type].hp) || 0; if (hp > bh) { bh = hp; bt = type; } }
      best = c.enemies.find((e) => e.type === bt && e.alive && e.targetable && !e.undead && !(e.data && e.data.phantom)) || null;
    } else {
      let bh = -1;
      for (const e of c.enemies) if (e.alive && e.targetable && !e.undead && !(e.data && e.data.phantom) && e.maxHp > bh) { bh = e.maxHp; best = e; }
    }
    if (!best) return;
    const g = crownMesh();
    g.position.y = 2.55;
    best.group.add(g);
    this.king = { e: best, g };
    this.kingDone = true;
    c.text.add('O Rei!', best.position, 'gold', 3.8);
    c.vfx.sparks(v3(best.position.x, 2.6, best.position.z), GOLD, 14);
    audio.play('blessing', best.position.x, best.position.z, { v: 0.5 });
    this.log({ type: 'rapKing', enemy: best });
  }
  kingDied(e, by) {
    const c = this.c, K = this.king;
    this.king = null;
    const back = !!(by && has(by, 'rCrown') && (e.rap2Back || this.backstab(by, e))); // derrotado pelas costas
    this.rm(K.g);
    if (!back) {
      c.text.add('A coroa caiu...', e.position, 'miss', 3.4);
      this.log({ type: 'rapKingLost' });
      return;
    }
    this.giveCrown(by);
  }
  giveCrown(p) {
    const c = this.c, Cr = RAP2.crown;
    if (p.rapCrown) return;
    p.rapCrown = true;
    p.hp = Math.min(p.maxHp, p.hp + Cr.hp);
    const g = crownMesh();
    g.position.y = 2.5;
    p.group.add(g);
    this.crowns.set(p, g);
    c.text.add('Xeque-mate!', p.position, 'crit', 4.6);
    c.text.add(`+${Cr.hp}`, p.position, 'heal');
    c.vfx.ring(v3(p.position.x, 0.1, p.position.z), GOLD, 3);
    c.vfx.sparks(v3(p.position.x, 2.6, p.position.z), GOLD, 22);
    audio.play('warcry', p.position.x, p.position.z, { v: 0.6 });
    audio.play('bell', p.position.x, p.position.z);
    c.shakeFor(p, 0.2);
    this.log({ type: 'rapCrown' });
  }
  takeCrown(p) {
    if (!p.rapCrown) return;
    p.rapCrown = false;
    const g = this.crowns.get(p); if (g) { this.rm(g); this.crowns.delete(p); }
    if (p.hp > p.maxHp) p.hp = p.maxHp;
  }
  tickKing() {
    const c = this.c;
    const owner = c.players.find((p) => p.state !== 'dead' && has(p, 'rCrown'));
    if (this.king) {
      const e = this.king.e;
      if (!e.alive || !c.enemies.includes(e)) { if (!e.alive) this.kingDied(e, e.lastHitBy); else { this.rm(this.king.g); this.king = null; } }
      else this.king.g.rotation.y += 0.02;
    } else if (owner && !this.kingDone) this.pickKing();
    for (const [p, g] of this.crowns) { g.rotation.y += 0.015; g.position.y = 2.5 + 0.04 * Math.sin(this.time * 3); g.visible = p.state !== 'dead'; }
  }

  // ---------- Velocidade da Luz ----------
  // Inimigos de costas no alcance do golpe (na frente, num leque largo), do mais perto ao mais longe.
  lightTargets(p) {
    const L = RAP2.light, range = p.hero.attackRange * ((p.stats && p.stats.rangeMul) || 1) + L.extra;
    const out = [];
    for (const e of this.c.enemies) {
      if (!e.targetable || e.undead || (e.data && e.data.phantom)) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.001;
      if (d > range + e.data.radius || Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > L.arc / 2 * DEG) continue;
      if (!this.backstab(p, e)) continue;
      out.push([d, e]);
    }
    return out.sort((u, v) => u[0] - v[0]).map((x) => x[1]);
  }
  // O golpe da Velocidade da Luz (true = tratou). Ninguém de costas: vira uma estocada normal.
  lightStart(p, step) {
    void step;
    const list = this.lightTargets(p);
    if (!list.length) { this.log({ type: 'rapLight', n: 0 }); return false; }
    p.rap2Light = { list, i: 0, t: 0 };
    this.c.text.add(list.length > 1 ? `Velocidade da Luz ×${list.length}!` : 'Velocidade da Luz!', p.position, 'crit', 3.4);
    this.lightStab(p);
    this.log({ type: 'rapLight', n: list.length });
    return true;
  }
  // Uma estocada rapidíssima no próximo da lista (vira para ele, risco de luz até o alvo).
  lightStab(p) {
    const H = p.rap2Light, c = this.c, e = H.list[H.i++];
    H.t = RAP2.light.every / (p.atkSpeed || 1);
    if (!e || !e.alive || !e.targetable) return;
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.001;
    p.facing = Math.atan2(dx, dz); p.group.rotation.y = p.facing;
    p.anim.play(LIGHT_STEP.clip, { once: true, restart: true, speed: 3.2, fade: 0.02 });
    p.swingSeq = (p.swingSeq || 0) + 1;
    const fx = dx / d, fz = dz / d;
    const tr = streak(0xfff6c8, 1);
    tr.position.set(p.position.x + fx * 0.5, 1.15, p.position.z + fz * 0.5); tr.rotation.y = p.facing; tr.scale.set(0.09, 1, Math.max(0.4, d - 0.3));
    c.vfx.add(tr, 0.14, (o, k) => { o.material.opacity = 1 - k; o.scale.x = 0.09 * (1 - k * 0.7); });
    const fl = glowSprite(0xfff2b0, 1.3, 0.9); fl.position.set(e.position.x, 1.2, e.position.z);
    c.vfx.add(fl, 0.16, (o, k) => { o.material.opacity = 0.9 * (1 - k); o.scale.setScalar(1.3 + k); });
    c.damageEnemy(p, e, LIGHT_HIT, fx, fz);
    if (e.alive && e.vel) e.vel.multiplyScalar(0.3); // quase não empurra
    c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), GOLD, 8);
    audio.play('swing', p.position.x, p.position.z, { v: 0.6 });
    c.addHitstop(0.02);
    this.log({ type: 'rapLightStab', enemy: e });
  }
  tickLight(dt) {
    for (const p of this.c.players) {
      const H = p.rap2Light;
      if (!H) continue;
      if (p.state !== 'attack' || !isRap(p)) { p.rap2Light = null; continue; }
      H.t -= dt;
      if (H.t <= 0) { if (H.i < H.list.length) this.lightStab(p); else p.rap2Light = null; }
    }
  }

  // ---------- Vem Dançar ----------
  // O corte (2º golpe) acertou alguém que já estava de costas? (perguntado antes do dano)
  wantsDance(p, e) {
    return has(p, 'rDance') && e.alive && !e.undead && !(e.data && e.data.phantom) && !e.rap2Dizzy && this.backstab(p, e);
  }
  // Gira 360° e fica tonto (parado, sem fazer nada). true = deu certo.
  dance(p, e) {
    const D = RAP2.dance, t = (e.data.boss ? D.boss : D.t) + D.spin;
    if (!e.alive || !e.daze || !e.daze(t)) return false;
    const a = Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z); // termina de costas
    const stars = dizzyStars();
    this.scene.add(stars);
    e.rap2Dizzy = { t: 0, total: t, a, a0: e.facing, stars, head: null };
    e.turnedT = t + 0.6;
    this.dizzy.add(e);
    this.c.text.add('Vem dançar!', e.position, 'crit', 3.4);
    audio.play('dodge', e.position.x, e.position.z, { v: 0.7 });
    this.log({ type: 'rapDance', enemy: e, t });
    return true;
  }
  endDizzy(e) {
    const Z = e.rap2Dizzy;
    if (Z) { this.rm(Z.stars); if (e.model) { e.model.rotation.x = 0; e.model.rotation.z = 0; } }
    e.rap2Dizzy = null; this.dizzy.delete(e);
  }
  tickDizzy(dt) {
    const D = RAP2.dance;
    for (const e of [...this.dizzy]) {
      const Z = e.rap2Dizzy;
      if (!Z) { this.dizzy.delete(e); continue; }
      Z.t += dt;
      if (!e.alive || !this.c.enemies.includes(e) || e.state !== 'hurt' || Z.t >= Z.total) {
        if (e.alive && e.state === 'hurt' && Z.t >= Z.total) { e.stunTime = e.t; }
        this.endDizzy(e); continue;
      }
      e.stunTime = Math.max(e.stunTime, e.t + (Z.total - Z.t)); // outro golpe não acorda ele
      if (Z.t < D.spin) { const k = Z.t / D.spin; e.facing = Z.a0 + (wrap(Z.a - Z.a0) + Math.PI * 2) * (1 - (1 - k) * (1 - k)); }
      else {
        e.facing = Z.a;
        if (!Z.idle) { Z.idle = true; e.anim.play(e.data.anims.idle, { fade: 0.2, speed: 0.45 }); }
      }
      e.group.rotation.y = e.facing;
    }
  }
  // Depois de tudo se mexer e das animações (combat.update): espeto na lâmina, cabeça rodando dos tontos.
  afterMove() {
    for (const b of this.bodies) if (b.phase === 'held' && b.e.alive) this.placeHeld(b);
    const D = RAP2.dance;
    for (const e of this.dizzy) {
      const Z = e.rap2Dizzy;
      if (!Z) continue;
      const sc = e.group.scale.x || 1;
      const amp = Z.t < D.spin ? 0 : Math.min(1, (Z.t - D.spin) / 0.3) * Math.min(1, Math.max(0, Z.total - Z.t) / 0.3);
      const w = Z.t * 5.5;
      // cambaleando: o corpo balança em círculo e a cabeça roda
      if (e.model) { e.model.rotation.x = 0.08 * amp * Math.sin(w); e.model.rotation.z = 0.08 * amp * Math.cos(w); }
      if (Z.head === null) { Z.head = false; if (e.model) e.model.traverse((o) => { if (!Z.head && o.isBone && /^head/i.test(o.name)) Z.head = o; }); }
      if (Z.head && amp > 0) {
        const q = (this._q ||= new THREE.Quaternion()).setFromEuler((this._eu ||= new THREE.Euler()).set(0.32 * amp * Math.sin(w), 0, 0.32 * amp * Math.cos(w)));
        Z.head.quaternion.multiply(q);
      }
      Z.stars.position.set(e.position.x, e.position.y + 2.75 * sc, e.position.z);
      Z.stars.visible = Z.t > D.spin * 0.6;
      spinStars(Z.stars, Z.t);
    }
  }

  // ---------- A cada quadro ----------
  tick(dt) {
    this.time += dt;
    for (let i = this.later.length - 1; i >= 0; i--) { const L = this.later[i]; L.t -= dt; if (L.t <= 0) { this.later.splice(i, 1); L.fn(); } }
    for (const p of this.c.players) {
      if (isRap(p) || this.pistols.has(p)) this.syncPistol(p);
      if (!isRap(p)) this.dropFor(p, true);
    }
    this.tickLight(dt);
    this.tickDizzy(dt);
    this.tickBodies(dt);
    this.tickHoles(dt);
    this.tickStars(dt);
    this.tickThreads(dt);
    this.tickPulls(dt);
    this.tickScores(dt);
    this.tickMusk(dt);
    this.tickKing();
  }

  // Tira o que é do herói (trocou de arma, partida nova). keepCrown: a coroa vale até o fim da sala.
  dropFor(p, keepCrown = false) {
    for (const b of [...this.bodies]) if (b.p === p) this.dropBody(b, 0.4);
    const M = this.musk.get(p);
    if (M) { for (const m of M) if (m) this.removeMusk(m); this.musk.delete(p); }
    const gun = this.pistols.get(p); if (gun) { this.rm(gun.g); this.pistols.delete(p); if (p.weapon) p.weapon.visible = true; }
    if (p.rap2Stars) this.dropStars(p.rap2Stars);
    this.threads = this.threads.filter((x) => x.by !== p);
    if (!keepCrown) this.takeCrown(p);
  }
  // Sala nova: tudo some (a coroa também).
  clear() {
    for (const b of [...this.bodies]) this.dropBody(b, 0);
    this.bodies.length = 0;
    for (const [e, H] of this.holes) { for (const m of H.marks) this.rm(m); void e; }
    this.holes.clear();
    for (const S of this.scores.values()) this.rm(S.s);
    this.scores.clear();
    for (const m of this.lines) this.rm(m);
    this.lines.length = 0;
    this.threads.length = 0; this.pulls.length = 0; this.later.length = 0;
    for (const [, M] of this.musk) for (const m of M) if (m) this.removeMusk(m);
    this.musk.clear();
    if (this.king) { this.rm(this.king.g); this.king = null; }
    this.kingDone = false;
    for (const e of [...this.dizzy]) this.endDizzy(e);
    for (const p of this.c.players) {
      this.takeCrown(p);
      if (p.rap2Stars) this.dropStars(p.rap2Stars);
      p.rap2Click = false;
      p.rap2Light = null;
    }
  }
}

// ---------- Geometria (Constelação) ----------
function convexHull(pts) {
  const P = pts.map((q) => ({ x: q.x, z: q.z })).sort((a, b) => a.x - b.x || a.z - b.z);
  if (P.length < 3) return P;
  const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lo = [], up = [];
  for (const q of P) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = P.length - 1; i >= 0; i--) { const q = P[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop();
  const h = lo.concat(up);
  return h.length >= 2 ? h : P.slice(0, 2);
}
function inConvex(h, q) {
  let sign = 0;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    const cr = (b.x - a.x) * (q.z - a.z) - (b.z - a.z) * (q.x - a.x);
    if (Math.abs(cr) < 1e-9) continue;
    const s = Math.sign(cr);
    if (!sign) sign = s; else if (s !== sign) return false;
  }
  return true;
}
function segDist(q, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz || 1e-9;
  const t = Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.z - a.z) * dz) / L));
  return Math.hypot(q.x - (a.x + dx * t), q.z - (a.z + dz * t));
}
export const _geo = { convexHull, inConvex, segDist };
