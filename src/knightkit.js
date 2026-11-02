// Bênçãos que mudam o jeito de jogar com a Espada e Escudo do Cavaleiro (pedido do dono, 02/11/2026).
// Arremesso (escudo voa no 4º golpe), Espada Arremessada (golpe forte atira a espada; o golpe forte sem ela a chama
// de volta), Bilhar de Ossos (rebatidos viram bolas), Trenó de Escudo (rolar vira deslizar), Escudo Plantado
// (segurar o bloqueio finca o escudo como parede), Corrente no Escudo (bloquear puxa o inimigo da frente),
// Mãos Trocadas (escudo ataca, espada defende) e Rastro Fantasma (cada golpe corta de novo 1 s depois).
// Podem ser pegas juntas: o combo é montado conforme o que está na mão (espada, escudo, os dois ou nenhum).
import * as THREE from 'three';
import { audio } from './audio.js';
import { instance } from './assets.js';
import { findBone } from './characters.js';
import { shieldVisual } from './shield.js';

export const KIT = {
  shieldThrow: { speed: 20, range: 13, damage: 14, pick: 1.5 },
  swordThrow: { speed: 24, range: 10, damage: 24, pick: 1.5, recallSpeed: 30, recallDamage: 16 },
  billiard: { speed: 16, time: 0.6, wallDamage: 25, hitDamage: 12, depth: 3 },
  sled: { speed: 11.5, max: 2.2, min: 0.25, damage: 8, iframes: 0.3 },
  plant: { hold: 1.0, pick: 2.2 },
  hook: { range: 9, speed: 32, pull: 24, cooldown: 2 },
  swap: { counter: 12, arc: 110 },
  trail: { delay: 1, mul: 0.6 },
};

// Combos sem a espada na mão: pancadas de escudo (o escudo ataca) ou socos (mãos vazias).
const BASH = [
  { clip: 'Melee_Block_Attack', speed: 1.5, hit: 0.4, end: 0.75, window: 0.42, lunge: 0.4, damage: 8, pushMul: 3, bash: true },
  { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 1.4, hit: 0.38, end: 0.62, window: 0.4, lunge: 0.4, damage: 8, pushMul: 3, bash: true },
  { clip: 'Melee_Block_Attack', speed: 1.1, hit: 0.42, end: 0.8, lunge: 0.6, damage: 14, heavy: true, pushMul: 3, offBal: true, bash: true },
];
const FISTS = [
  { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 1.5, hit: 0.38, end: 0.62, window: 0.4, lunge: 0.3, damage: 5 },
  { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 1.7, hit: 0.38, end: 0.62, window: 0.4, lunge: 0.3, damage: 5 },
  { clip: 'Melee_Unarmed_Attack_Kick', speed: 1.3, hit: 0.4, end: 0.75, lunge: 0.4, damage: 9, heavy: true },
];

let C = null; // o combate (um só no jogo)
const W = (p) => (p && p.stats && p.stats.w) || {};
export const isKit = (p) => !!(p && p.heroId === 'knight' && p.hero && p.hero.weaponId === 'espada');
const kitOf = (p) => p.kit || (p.kit = { sword: 'hand', shield: 'hand' });
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- Combo e mãos ----------

// Monta o combo conforme as bênçãos e o que está na mão. Chamado sempre que o herói é refeito.
export function applyKit(p) {
  if (!isKit(p)) return;
  const h = p.hero, w = W(p), k = kitOf(p);
  const sword = k.sword === 'hand', shield = k.shield === 'hand', swap = !!w.swap;
  const atk = swap ? (shield ? 'shield' : sword ? 'sword' : 'fist') : (sword ? 'sword' : shield ? 'shield' : 'fist');
  let combo = atk === 'sword' ? h.combo.map((s) => ({ ...s }))
    : atk === 'shield' ? BASH.map((s) => ({ ...s, damage: swap ? Math.round(s.damage * 1.25) : s.damage }))
      : FISTS.map((s) => ({ ...s }));
  const hi = Math.max(0, combo.findIndex((c) => c.heavy));
  if (w.swordThrow) {
    if (sword) combo[hi] = { ...combo[hi], clip: 'Throw', speed: 1.7, hit: 0.42, end: 0.72, lunge: 0.2, kit: 'throwSword' };
    else combo[hi] = { ...combo[hi], kit: 'recallSword' };
  }
  if (w.shieldThrow && shield) {
    combo[combo.length - 1] = { ...combo[combo.length - 1], window: combo[combo.length - 1].window ?? 0.45 };
    combo.push({ clip: 'Throw', speed: 1.8, hit: 0.42, end: 0.72, lunge: 0.2, damage: KIT.shieldThrow.damage, kit: 'throwShield' });
  }
  h.combo = combo;
  h.heavyIdx = hi;
  h.block = { ...h.block, arc: swap ? KIT.swap.arc : 150 };
  if (p.combo >= combo.length) p.combo = 0;
  swapHands(p, swap);
  handVisual(p);
}

// Mãos Trocadas: o escudo vai para a mão direita (ataca) e a espada para a esquerda (defende).
function swapHands(p, on) {
  if (!p.weapon || !p.shieldMesh || !p.model) return;
  const k = kitOf(p);
  const swapped = k.swapMesh === p.weapon;
  if (on === swapped) return;
  const r = findBone(p.model, 'handslot.r'), l = findBone(p.model, 'handslot.l');
  if (!r || !l) return;
  (on ? l : r).add(p.weapon);
  (on ? r : l).add(p.shieldMesh);
  // Espada na esquerda: lâmina para cima (a mão esquerda é espelhada).
  p.weapon.rotation.set(0, on ? Math.PI : 0, 0);
  p.shieldMesh.rotation.set(0, on ? Math.PI : 0, 0);
  k.swapMesh = on ? p.weapon : null;
}

function handVisual(p) {
  const k = kitOf(p);
  if (p.weapon) p.weapon.visible = k.sword === 'hand';
  p.shieldAway = k.shield !== 'hand';
  shieldVisual(p);
}

// Dá para levantar a guarda? (Mãos Trocadas: quem defende é a espada.)
export function kitCanBlock(p) {
  if (!isKit(p)) return true;
  const k = kitOf(p);
  return W(p).swap ? k.sword === 'hand' : k.shield === 'hand';
}
export const kitSwordGuard = (p) => isKit(p) && !!W(p).swap && kitOf(p).sword === 'hand';

// Mudou o que está na mão: refaz o combo (no meio de um golpe, espera ele acabar).
function rehand(p) {
  handVisual(p);
  if (p.state === 'attack') { kitOf(p).dirty = true; return; }
  p.rebuildHero();
}

// Tudo volta para a mão (troca de sala, nova partida, troca de arma).
export function kitReset(p) {
  const k = kitOf(p);
  if (C) C.kit.dropFor(p);
  k.sword = 'hand'; k.shield = 'hand'; k.dirty = false; k.hookCd = 0;
  if (p.state === 'sled') endSled(p);
  handVisual(p);
}

// ---------- Golpes ----------

// Golpe do herói com efeito do kit. Devolve true se o golpe foi trocado (arremesso: não tem corte).
export function kitStrike(combat, p, step) {
  if (!step.kit || !isKit(p)) return false;
  const kit = combat.kit;
  if (step.kit === 'throwShield' && kitOf(p).shield === 'hand') { kit.throwShield(p, step); return true; }
  if (step.kit === 'throwSword' && kitOf(p).sword === 'hand') { kit.throwSword(p, step); return true; }
  if (step.kit === 'recallSword') kit.recallSword(p, step);
  return false;
}

// Rastro Fantasma: o corte fica brilhando e corta de novo 1 s depois.
export function kitOnSwing(combat, p, step, range, arc) {
  if (!isKit(p) || !W(p).trail || step.kit) return;
  combat.kit.addTrail(p, step, range, arc);
}

// Escudo segurou um golpe. Mãos Trocadas: a espada apara (não gasta o escudo) e contra-ataca sozinha.
export function kitGuard(combat, p, e, nx, nz, opts) {
  if (!kitSwordGuard(p)) return null;
  if (e && e.alive && e.targetable && !opts.contact && Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) < 4) {
    combat.vfx.sector(p.position, p.facing, 2.4, 0.9, 0xcfe4ff);
    combat.bonusDamage(e, Math.round(KIT.swap.counter * p.stats.damageMul), -nx, -nz, 'dmg big', p);
    combat.text.add('Contra-ataque!', p.position, 'crit', 3.2);
    if (combat.log) combat.log({ type: 'kitCounter', enemy: e });
  }
  return 'parry';
}

// Inimigo rebatido pelo escudo: Bilhar de Ossos.
export function kitOnRepel(combat, p, e, dx, dz) {
  if (!isKit(p) || !W(p).billiard || e.data.boss) return;
  combat.kit.launch(e, dx, dz, p, 0);
}

// Começou a bloquear: Corrente no Escudo (gancho) e pegar o escudo plantado de volta.
export function kitOnGuard(p) {
  if (!C || !isKit(p)) return;
  const w = W(p), k = kitOf(p);
  if (w.hook && !(k.hookCd > 0)) { k.hookCd = KIT.hook.cooldown; C.kit.fireHook(p); }
}

// Apertou o bloqueio: perto do escudo plantado, pega de volta (devolve true).
export function kitTryPickup(p) {
  if (!C || !isKit(p) || kitOf(p).shield !== 'planted' || kitOf(p).plantLock) return false;
  return C.kit.pickPlanted(p);
}

// Segurando o bloqueio: Escudo Plantado finca o escudo depois de um tempo (devolve true: saiu do bloqueio).
export function kitBlockTick(p) {
  if (!C || !isKit(p)) return false;
  const w = W(p), k = kitOf(p);
  if (!w.plant || w.swap || k.shield !== 'hand' || p.stateTime < KIT.plant.hold || p.shield <= 0) return false;
  C.kit.plantShield(p);
  return true;
}

// Rolar: Trenó de Escudo (desliza sentado no escudo). Devolve true se começou o trenó.
export function kitStartDodge(p) {
  if (!C || !isKit(p) || !W(p).sled || kitOf(p).shield !== 'hand') return false;
  const k = kitOf(p);
  p.setState('sled');
  p.combo = 0;
  p.iframes = Math.max(p.iframes, KIT.sled.iframes);
  k.sledHits = new Set();
  k.shield = 'sled';
  handVisual(p);
  C.kit.showSled(p, true);
  p.anim.play('Sit_Floor_Idle', { fade: 0.08, restart: true });
  audio.play('dodge', p.position.x, p.position.z);
  return true;
}

// Trenó: anda na direção do controle (vira devagar), atropela quem encostar, acaba ao soltar o botão,
// bater na parede ou passar do tempo.
export function kitSledTick(p, dt, world, input, tmpMove) {
  const k = kitOf(p), S = KIT.sled;
  const moving = tmpMove.lengthSq() > 0;
  if (moving) {
    const want = Math.atan2(tmpMove.x, tmpMove.z);
    p.facing += wrap(want - p.facing) * Math.min(1, dt * 4);
  }
  const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
  const bx = p.position.x, bz = p.position.z;
  p.move(fx, fz, S.speed * dt, world);
  const moved = Math.hypot(p.position.x - bx, p.position.z - bz);
  if (C) {
    for (const e of [...C.enemies]) {
      if (!e.targetable || k.sledHits.has(e)) continue;
      const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
      if (d > e.data.radius + p.hero.radius + 0.25) continue;
      k.sledHits.add(e);
      const sx = e.position.x - p.position.x, sz = e.position.z - p.position.z, sd = Math.hypot(sx, sz) || 1;
      C.bonusDamage(e, Math.round(S.damage * p.stats.damageMul), sx / sd, sz / sd, 'dmg', p);
      if (e.alive && !e.data.boss && e.offBalance) e.offBalance(sx / sd, sz / sd, 0.7, 10);
      audio.play('hit', e.position.x, e.position.z);
      if (C.log) C.log({ type: 'sledHit', enemy: e });
    }
    if (Math.random() < dt * 20) C.vfx.sparks(v3(p.position.x - fx * 0.5, 0.2, p.position.z - fz * 0.5), 0xffd9a0, 2);
  }
  const held = input.dodgeHeld ? input.dodgeHeld() : p.stateTime < 1.2;
  const crashed = p.stateTime > 0.1 && moved < S.speed * dt * 0.3;
  if (p.stateTime >= S.max || (p.stateTime >= S.min && !held) || crashed) {
    endSled(p);
    p.setState(moving ? 'run' : 'idle');
    p.anim.play(moving ? p.hero.anims.run : p.hero.anims.idle, { fade: 0.12 });
  }
}

function endSled(p) {
  const k = kitOf(p);
  if (k.shield === 'sled') k.shield = 'hand';
  handVisual(p);
  if (C) C.kit.showSled(p, false);
}

// ---------- Coisas soltas na sala (escudo voando/no chão, espada, gancho, bolas, rastros) ----------

export class KnightKit {
  constructor(combat) {
    C = combat;
    this.c = combat;
    this.items = [];   // { kind: 'shield'|'sword', p, mesh, phase: 'fly'|'ground'|'recall', ... }
    this.balls = [];   // Bilhar de Ossos
    this.hooks = [];   // Corrente no Escudo
    this.trails = [];  // Rastro Fantasma
    this.sleds = new Map();
  }

  get scene() { return this.c.scene; }

  // ---- Escudo arremessado (Arremesso) ----
  throwShield(p, step) {
    const k = kitOf(p), T = KIT.shieldThrow;
    k.shield = 'thrown';
    rehand(p);
    const mesh = instance(p.hero.weapons.left.model);
    const g = new THREE.Group(); g.add(mesh);
    mesh.rotation.x = -Math.PI / 2;
    const a = p.facing;
    g.position.set(p.position.x + Math.sin(a) * 0.8, 1.2, p.position.z + Math.cos(a) * 0.8);
    this.scene.add(g);
    this.items.push({ kind: 'shield', p, g, mesh, phase: 'fly', dx: Math.sin(a), dz: Math.cos(a), dist: 0, step });
    audio.play('swingHeavy', p.position.x, p.position.z);
    if (this.c.log) this.c.log({ type: 'kitThrowShield' });
  }

  // ---- Espada arremessada ----
  throwSword(p, step) {
    const k = kitOf(p);
    k.sword = 'away';
    rehand(p);
    const mesh = instance(p.hero.weapons.right.model);
    const g = new THREE.Group(), spin = new THREE.Group();
    g.add(spin); spin.add(mesh);
    mesh.position.y = -0.55; // gira pelo meio da lâmina
    const a = p.facing;
    g.rotation.y = a;
    g.position.set(p.position.x + Math.sin(a) * 0.8, 1.2, p.position.z + Math.cos(a) * 0.8);
    this.scene.add(g);
    this.items.push({ kind: 'sword', p, g, spin, mesh, phase: 'fly', dx: Math.sin(a), dz: Math.cos(a), dist: 0, step, hit: new Set() });
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.2 });
    this.c.text.add('Arremessou!', p.position, 'crit', 3.0);
    if (this.c.log) this.c.log({ type: 'kitThrowSword' });
  }

  recallSword(p, step) {
    const it = this.items.find((o) => o.kind === 'sword' && o.p === p && o.phase === 'ground');
    if (!it) return;
    it.phase = 'recall'; it.hit = new Set(); it.step = step;
    it.spin.rotation.set(0, 0, 0);
    audio.play('swing', it.g.position.x, it.g.position.z);
    this.c.text.add('Volta, espada!', p.position, 'crit', 3.0);
    if (this.c.log) this.c.log({ type: 'kitRecall' });
  }

  // ---- Escudo Plantado ----
  plantShield(p) {
    const k = kitOf(p), w = this.c.world;
    const a = p.facing, fx = Math.sin(a), fz = Math.cos(a);
    const x = p.position.x + fx * 1.0, z = p.position.z + fz * 1.0;
    const mesh = instance(p.hero.weapons.left.model);
    mesh.scale.setScalar(2.2); // o escudo cresce e vira uma parede
    const g = new THREE.Group(); g.add(mesh);
    g.position.set(x, 1.2, z);
    g.rotation.y = a;
    this.scene.add(g);
    // Parede: 3 quadradinhos ao longo do escudo (a colisão só tem retângulos alinhados).
    const rects = [];
    const sx = Math.cos(a), sz = -Math.sin(a);
    for (const o of [-0.7, 0, 0.7]) {
      const cx = x + sx * o, cz = z + sz * o, r = 0.42;
      w.addRect(cx - r, cz - r, cx + r, cz + r);
      rects.push(w.rects[w.rects.length - 1]);
    }
    k.shield = 'planted';
    k.plantLock = true; // só pega de volta depois de soltar o bloqueio
    rehand(p);
    p.setState('idle');
    p.anim.play(p.hero.anims.idle, { fade: 0.15 });
    this.items.push({ kind: 'shield', p, g, mesh, phase: 'planted', rects, x, z });
    this.c.vfx.heavyImpact(v3(x, 0, z), 0.8);
    audio.play('crunch', x, z);
    this.c.text.add('Escudo fincado!', p.position, 'block', 3.0);
    if (this.c.log) this.c.log({ type: 'kitPlant' });
  }

  pickPlanted(p) {
    const it = this.items.find((o) => o.p === p && o.phase === 'planted');
    if (!it || Math.hypot(it.x - p.position.x, it.z - p.position.z) > KIT.plant.pick) return false;
    this.remove(it);
    kitOf(p).shield = 'hand';
    rehand(p);
    audio.play('shieldBlock', p.position.x, p.position.z);
    this.c.text.add('Escudo de volta!', p.position, 'block', 2.8);
    return true;
  }

  // ---- Corrente no Escudo ----
  fireHook(p) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xb8c4d6 });
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5), mat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat);
    this.scene.add(line); this.scene.add(head);
    this.hooks.push({ p, line, head, a: p.facing, len: 0, phase: 'out', e: null });
    audio.play('swing', p.position.x, p.position.z);
  }

  // ---- Bilhar de Ossos ----
  launch(e, dx, dz, p, depth) {
    if (!e.alive || e.data.boss || this.balls.some((b) => b.e === e)) return;
    const d = Math.hypot(dx, dz) || 1;
    e.vel.set(0, 0, 0);
    if (e.state !== 'hurt') { e.releaseToken(); e.setState('hurt'); e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05 }); }
    e.stunTime = e.t + 5;
    this.balls.push({ e, dx: dx / d, dz: dz / d, speed: KIT.billiard.speed * (depth ? 0.8 : 1), t: 0, p, depth, hit: new Set([e]) });
    if (this.c.log) this.c.log({ type: 'kitBall', enemy: e, depth });
  }

  // ---- Rastro Fantasma ----
  addTrail(p, step, range, arc) {
    const geo = new THREE.CircleGeometry(1, 24, -Math.PI / 2 - arc, arc * 2).rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.position.set(p.position.x, 0.6, p.position.z);
    m.rotation.y = p.facing;
    m.scale.setScalar(range);
    this.scene.add(m);
    this.trails.push({ p, m, x: p.position.x, z: p.position.z, a: p.facing, range, arc, t: 0, dmg: Math.max(1, Math.round(step.damage * KIT.trail.mul)), heavy: !!step.heavy });
  }

  showSled(p, on) {
    let s = this.sleds.get(p);
    if (on && !s) {
      s = instance(p.hero.weapons.left.model);
      s.rotation.x = -Math.PI / 2;
      s.position.set(0, 0.12, 0.1);
      s.scale.setScalar(1.3);
      p.group.add(s);
      this.sleds.set(p, s);
    } else if (!on && s) { p.group.remove(s); this.sleds.delete(p); }
  }

  remove(it) {
    this.scene.remove(it.g);
    if (it.rects) for (const r of it.rects) { const i = this.c.world.rects.indexOf(r); if (i >= 0) { this.c.world.rects.splice(i, 1); this.c.world.version = (this.c.world.version || 0) + 1; } }
    const i = this.items.indexOf(it);
    if (i >= 0) this.items.splice(i, 1);
  }

  // Sala nova / nova partida: tudo volta para a mão.
  dropFor(p) {
    for (const it of [...this.items]) if (it.p === p) this.remove(it);
    for (const h of [...this.hooks]) if (h.p === p) this.endHook(h);
    this.showSled(p, false);
  }

  clear() {
    for (const it of [...this.items]) this.remove(it);
    for (const h of [...this.hooks]) this.endHook(h);
    for (const t of this.trails) this.scene.remove(t.m);
    this.trails.length = 0;
    this.balls.length = 0;
    for (const p of this.c.players) if (p.kit) { p.kit.sword = 'hand'; if (p.kit.shield !== 'sled') p.kit.shield = 'hand'; if (isKit(p)) { handVisual(p); if (p.state !== 'attack') p.rebuildHero(); else p.kit.dirty = true; } }
  }

  endHook(h) {
    this.scene.remove(h.line); this.scene.remove(h.head);
    const i = this.hooks.indexOf(h);
    if (i >= 0) this.hooks.splice(i, 1);
  }

  // Inimigo encostou num ponto (x, z, raio r)?
  enemyAt(x, z, r, skip) {
    for (const e of this.c.enemies) {
      if (!e.targetable || (skip && skip.has(e))) continue;
      if (Math.hypot(e.position.x - x, e.position.z - z) <= e.data.radius + r) return e;
    }
    return null;
  }

  update(dt) {
    const c = this.c, world = c.world;
    for (const p of c.players) {
      const k = p.kit;
      if (!k) continue;
      if (k.hookCd > 0) k.hookCd -= dt;
      if (k.plantLock && !(p.ctl && p.ctl.blocking())) k.plantLock = false; // soltou o botão depois de fincar
      if (k.shield === 'sled' && p.state !== 'sled') endSled(p); // apanhou/morreu no meio do trenó
      if (k.dirty && p.state !== 'attack') { k.dirty = false; p.rebuildHero(); }
    }
    // Escudo e espada.
    for (const it of [...this.items]) {
      const p = it.p, g = it.g;
      if (it.phase === 'fly') {
        const T = it.kind === 'shield' ? KIT.shieldThrow : KIT.swordThrow;
        const stepLen = T.speed * dt;
        let stop = false;
        for (let s = 0; s < 3 && !stop; s++) {
          const nx = g.position.x + it.dx * stepLen / 3, nz = g.position.z + it.dz * stepLen / 3;
          if (world.blocked(nx, nz, 0.3)) { c.props.hitAt(nx, nz, p); stop = true; break; }
          g.position.x = nx; g.position.z = nz; it.dist += stepLen / 3;
          if (it.kind === 'shield') {
            const e = this.enemyAt(nx, nz, 0.45);
            if (e) {
              c.damageEnemy(p, e, { ...it.step, kit: null }, it.dx, it.dz, { ranged: true });
              if (e.alive && e.offBalance) e.offBalance(it.dx, it.dz, 0.8, 8);
              audio.play('shieldBlock', nx, nz, { v: 1.2 });
              stop = true;
            }
          } else {
            let e;
            while ((e = this.enemyAt(nx, nz, 0.55, it.hit))) {
              it.hit.add(e);
              c.damageEnemy(p, e, { ...it.step, damage: KIT.swordThrow.damage, kit: null }, it.dx, it.dz, { ranged: true });
            }
          }
          if (it.dist >= T.range) stop = true;
        }
        if (it.kind === 'shield') it.mesh.rotation.z += dt * 18;
        else it.spin.rotation.x += dt * 20;
        if (stop) this.land(it);
      } else if (it.phase === 'ground') {
        it.t = (it.t || 0) + dt;
        if (it.ring) it.ring.material.opacity = 0.35 + 0.25 * Math.sin(it.t * 6);
        if (it.fall > 0) { it.fall = Math.max(0, it.fall - dt * 4); g.position.y = it.restY + it.fall * 1.0; }
        const T = it.kind === 'shield' ? KIT.shieldThrow : KIT.swordThrow;
        if (p.state !== 'dead' && Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) <= T.pick) this.pickUp(it);
      } else if (it.phase === 'recall') {
        const tx = p.position.x, tz = p.position.z;
        const dx = tx - g.position.x, dz = tz - g.position.z, d = Math.hypot(dx, dz) || 0.001;
        const stepLen = Math.min(d, KIT.swordThrow.recallSpeed * dt);
        g.position.x += dx / d * stepLen; g.position.z += dz / d * stepLen;
        g.position.y += (1.2 - g.position.y) * Math.min(1, dt * 10);
        g.rotation.y = Math.atan2(dx, dz);
        it.spin.rotation.x += dt * 24;
        let e;
        while ((e = this.enemyAt(g.position.x, g.position.z, 0.6, it.hit))) {
          it.hit.add(e);
          c.damageEnemy(p, e, { ...it.step, damage: KIT.swordThrow.recallDamage, heavy: false, kit: null }, dx / d, dz / d, { ranged: true });
        }
        if (d < 0.9) this.pickUp(it);
      }
    }
    // Gancho.
    for (const h of [...this.hooks]) {
      const p = h.p, H = KIT.hook;
      if (p.state === 'dead') { this.endHook(h); continue; }
      const ox = p.position.x, oz = p.position.z;
      let hx, hz;
      if (h.phase === 'out') {
        h.len += H.speed * dt;
        hx = ox + Math.sin(h.a) * h.len; hz = oz + Math.cos(h.a) * h.len;
        const e = this.enemyAt(hx, hz, 0.5);
        if (e) {
          h.e = e; h.phase = 'pull';
          audio.play('hit', hx, hz);
          if (e.data.boss || e.frozenT > 0) { e.daze && e.daze(0.3); c.text.add('Preso!', e.position, 'block', 3.0); this.endHook(h); continue; }
          e.releaseToken(); e.setState('hurt'); e.stunTime = 5; e.vel.set(0, 0, 0);
          e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05 });
          c.text.add('Puxou!', e.position, 'crit', 3.0);
          if (c.log) c.log({ type: 'kitHook', enemy: e });
        } else if (h.len >= H.range || world.blocked(hx, hz, 0.1)) { this.endHook(h); continue; }
      }
      if (h.phase === 'pull') {
        const e = h.e;
        if (!e.alive || e.frozenT > 0) { this.endHook(h); continue; }
        const dx = ox - e.position.x, dz = oz - e.position.z, d = Math.hypot(dx, dz) || 0.001;
        const want = p.hero.radius + e.data.radius + 0.6;
        if (d <= want) {
          e.stunTime = e.t + 0.2;
          if (e.offBalance) e.offBalance(-dx / d, -dz / d, 0.9, 1);
          this.endHook(h); continue;
        }
        const s = Math.min(d - want, H.pull * dt);
        e.position.x += dx / d * s; e.position.z += dz / d * s;
        world.resolveCircle(e.position, e.data.radius);
        hx = e.position.x; hz = e.position.z;
      }
      const len = Math.hypot(hx - ox, hz - oz);
      h.line.position.set(ox, 1.1, oz);
      h.line.rotation.y = Math.atan2(hx - ox, hz - oz);
      h.line.scale.set(1, 1, Math.max(0.01, len));
      h.head.position.set(hx, 1.1, hz);
    }
    // Bolas de osso.
    const B = KIT.billiard;
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i], e = b.e;
      b.t += dt;
      if (!e.alive || e.frozenT > 0) { this.balls.splice(i, 1); continue; }
      e.vel.set(0, 0, 0);
      const s = b.speed * dt;
      const nx = e.position.x + b.dx * s, nz = e.position.z + b.dz * s;
      e.group.rotation.y += dt * 14; // rodopiando
      if (world.blocked(nx, nz, e.data.radius * 0.8)) {
        c.props.hitAt(nx, nz, b.p);
        c.vfx.heavyImpact(v3(e.position.x, 0, e.position.z), 0.7);
        audio.play('crunch', e.position.x, e.position.z);
        c.text.add('Na parede!', e.position, 'crit', 3.2);
        c.bonusDamage(e, Math.round(B.wallDamage * b.p.stats.damageMul), -b.dx, -b.dz, 'dmg big', b.p);
        if (c.log) c.log({ type: 'kitWall', enemy: e });
        this.endBall(b, i); continue;
      }
      e.position.x = nx; e.position.z = nz;
      for (const o of c.enemies) {
        if (!o.targetable || b.hit.has(o)) continue;
        const dx = o.position.x - e.position.x, dz = o.position.z - e.position.z, d = Math.hypot(dx, dz) || 0.01;
        if (d > o.data.radius + e.data.radius + 0.1) continue;
        b.hit.add(o);
        c.bonusDamage(o, Math.round(B.hitDamage * b.p.stats.damageMul), dx / d, dz / d, 'dmg', b.p);
        c.vfx.sparks(v3(o.position.x, 1.1, o.position.z), 0xffe6a0, 10);
        audio.play('hit', o.position.x, o.position.z);
        if (c.log) c.log({ type: 'kitBallHit', enemy: o });
        if (b.depth + 1 < B.depth && o.alive) this.launch(o, dx / d + b.dx * 0.5, dz / d + b.dz * 0.5, b.p, b.depth + 1);
        b.speed *= 0.7;
      }
      if (b.t >= B.time || b.speed < 4) this.endBall(b, i);
    }
    // Rastros.
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.t += dt;
      t.m.material.opacity = 0.18 + 0.25 * (t.t / KIT.trail.delay);
      if (t.t < KIT.trail.delay) continue;
      this.trails.splice(i, 1);
      this.scene.remove(t.m);
      c.vfx.sector(v3(t.x, 0, t.z), t.a, t.range, t.arc, 0x9fd8ff);
      audio.play('swing', t.x, t.z, { v: 0.7 });
      let n = 0;
      for (const e of [...c.enemies]) {
        if (!e.targetable) continue;
        const dx = e.position.x - t.x, dz = e.position.z - t.z, d = Math.hypot(dx, dz) || 0.01;
        if (d > t.range + e.data.radius || Math.abs(wrap(Math.atan2(dx, dz) - t.a)) > t.arc) continue;
        c.bonusDamage(e, Math.round(t.dmg * t.p.stats.damageMul), dx / d, dz / d, 'dmg', t.p);
        c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), 0x9fd8ff, 6);
        n++;
      }
      if (c.log) c.log({ type: 'kitTrail', hits: n });
    }
  }

  endBall(b, i) {
    this.balls.splice(i, 1);
    const e = b.e;
    if (e.alive && e.state === 'hurt') { e.stunTime = e.t + 0.4; e.offBalanceT = Math.max(e.offBalanceT || 0, 0.8); }
  }

  // Caiu no chão (bateu em alguém, na parede ou acabou o alcance): fica lá até o herói buscar.
  land(it) {
    it.phase = 'ground';
    const g = it.g;
    g.position.x -= it.dx * 0.3; g.position.z -= it.dz * 0.3;
    this.c.world.resolveCircle(g.position, 0.4);
    if (it.kind === 'shield') { it.mesh.rotation.set(-Math.PI / 2, 0, 0.4); it.restY = 0.18; }
    else { it.spin.rotation.set(Math.PI * 0.86, 0, 0); it.mesh.position.y = -0.2; it.restY = 1.0; }
    it.fall = 1;
    g.position.y = it.restY + 1;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.position.y = 0.06 - g.position.y;
    g.add(ring); it.ring = ring;
    ring.onBeforeRender = () => { ring.position.y = 0.06 - g.position.y; };
    audio.play('block', g.position.x, g.position.z);
    if (this.c.log) this.c.log({ type: 'kitLand', kind: it.kind });
  }

  pickUp(it) {
    const p = it.p, k = kitOf(p);
    this.remove(it);
    if (it.kind === 'shield') k.shield = 'hand'; else k.sword = 'hand';
    rehand(p);
    audio.play(it.kind === 'shield' ? 'shieldBlock' : 'swing', p.position.x, p.position.z);
    this.c.text.add(it.kind === 'shield' ? 'Escudo de volta!' : 'Espada de volta!', p.position, 'block', 2.8);
    if (this.c.log) this.c.log({ type: 'kitPick', kind: it.kind });
  }
}
