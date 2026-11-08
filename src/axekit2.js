// Bênçãos do Machado de Duas Mãos — 2ª leva (lista do dono, 04/11/2026).
// Machadada forte: Fenda (rachadura que joga para cima), Corte ao Meio (as metades voam), Decapitar (o corpo
// anda sem rumo batendo nos aliados), Desmembrar (sem o braço da arma, só morde).
// Destruição: Derrubar Pilar (usa o Demolidor, demolish.js), Estilhaços de Escudo, Faíscas.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { audio } from './audio.js';
import { instance } from './assets.js';
import { isAxe } from './axekit.js';
import { AXE3_STATES, axe3EnemyTick, axe3LeaveState } from './axekit3.js';
import { LANCE_STATES, lanceEnemyTick, lanceLeaveState } from './lancekit2.js';
import { FIST_STATES, fistEnemyTick, fistLeaveState } from './fistkit2.js';
import { ORB_STATES, arcEnemyTick, arcLeaveState } from './arcstates.js';
import { ELE_STATES, eleEnemyTick, eleLeaveState } from './elestates.js';
import { FIRE_STATES, fireEnemyTick, fireLeaveState } from './firestates.js';
import { ROGUE_STATES, rogueEnemyTick, rogueLeaveState } from './roguestates.js';

export const AXE2 = {
  fissure: { len: 9, speed: 20, width: 0.9, damage: 18, air: 0.75, height: 2.4, land: 0.5, fade: 1.6 },
  halve: { damage: 20, side: 7, up: 3.5, fly: 0.7, r: 1.1, lie: 1.2, sink: 0.6 },
  decap: { at: 0.3, time: 3, swing: 1.0, reach: 2.4, mul: 1.5, speed: 0.6 },
  bite: { mul: 0.5 },
  shards: { n: 7, speed: 13, range: 6, damage: 12, r: 0.6 },
  sparks: { r: 2.6, burn: 3, burnDps: 5 },
};

const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);

// Mordida de quem perdeu o braço da arma (Desmembrar).
const BITE = { clip: 'Melee_1H_Attack_Stab', speed: 1.3, hit: 0.45, aim: 0.3, end: 0.85, reach: 1.9, arc: 90, lunge: 1.0, bite: true };

// Estados próprios do esqueleto (enemies.js chama axeEnemyTick).
export const AXE_STATES = new Set(['headless', 'axeAir', ...AXE3_STATES, ...LANCE_STATES, ...FIST_STATES, ...ORB_STATES, ...ELE_STATES, ...FIRE_STATES, ...ROGUE_STATES]); // + Investida Bruta (derrubado) e Grito de Guerra (com medo)

// ---------- Decapitar (antes do dano: o golpe arranca a cabeça em vez de ferir) ----------
export function axeDecap(c, p, e, step) {
  const w = W(p);
  if (!step.heavy || !w.decap || !isAxe(p) || e.data.boss || e.undead || e.headless || !e.alive) return false;
  if (e.hp > e.maxHp * AXE2.decap.at || e.state === 'spawn' || e.frozenT > 0) return false;
  e.releaseToken();
  e.headless = { t: AXE2.decap.time, by: p, ang: e.facing, turn: 0, next: 0.35, swing: -1, hit: false };
  e.vel.set(0, 0, 0);
  e.setState('headless');
  hideParts(e, /_(Head|Skull|Jaw|Eyes|Hat|Hood|Helmet)$/);
  // A cabeça voa girando.
  const sk = instance('props/crypt/skull.gltf');
  sk.scale.setScalar(0.8 * (e.group.scale.x || 1));
  sk.position.set(e.position.x, 2.1, e.position.z);
  const a = p.facing + (Math.random() - 0.5) * 1.2;
  c.debris.add(sk, v3(Math.sin(a) * 4, 7, Math.cos(a) * 4), v3(10, 6, 8));
  c.vfx.sparks(v3(e.position.x, 2.0, e.position.z), 0xffffff, 14);
  c.text.add('Decapitado!', e.position, 'crit', 3.6);
  audio.play('crunch', e.position.x, e.position.z, { v: 1.2 });
  c.shakeFor(p, 0.2);
  if (c.log) c.log({ type: 'axeDecap', enemy: e });
  return true;
}

// Esconde partes do modelo (cabeça, braço). Escalar o osso não serve: a animação desfaz.
function hideParts(e, re) {
  e.model.traverse((o) => { if (o.isMesh && re.test(o.name)) o.visible = false; });
}

// ---------- Depois do dano ----------
export function axe2OnHit(c, p, e, step, died, nx, nz) {
  if (!isAxe(p) || !step.heavy) return;
  const w = W(p);
  if (died) {
    if (w.halve && !e.data.boss && !e.halved) c.axe2.split(e, p);
    return;
  }
  if (!e.alive) return;
  if (w.dismember && !e.data.boss && !e.disarmed) dismember(c, p, e, nx, nz);
  if (w.shieldShards && e.data.shield && !e.shieldBroken && !e.data.boss) c.breakEnemyShield(e, nx, nz, p);
}

// Desmembrar: o braço da arma cai; ele perde as habilidades e só tenta morder.
function dismember(c, p, e, nx, nz) {
  e.disarmed = true;
  const right = e.data.weapons && e.data.weapons.right && e.weapons[0] !== e.shieldMesh ? e.weapons[0] : null;
  if (right) { e.weapons.splice(0, 1); c.debris.drop(right, nx, nz); }
  hideParts(e, /_ArmRight$/);
  const bone = instance('props/crypt/bone_A.gltf');
  bone.position.set(e.position.x, 1.4, e.position.z);
  c.debris.add(bone, v3(nx * 3 + (Math.random() - 0.5) * 2, 5, nz * 3 + (Math.random() - 0.5) * 2), v3(12, 4, 9));
  const dmg = e.data.damage || 10; // enemyStrike multiplica pela dificuldade
  e.data = { ...e.data, ranged: null, attack: { ...BITE, damage: Math.max(1, Math.round(dmg * AXE2.bite.mul)) }, attackRange: 1.6 };
  e.abilities = false;
  if (e.atk && e.state === 'attack') e.endAttack();
  c.text.add('Desarmado!', e.position, 'hurt', 3.4);
  c.vfx.sparks(v3(e.position.x, 1.4, e.position.z), 0xffffff, 10);
  if (c.log) c.log({ type: 'axeDismember', enemy: e });
}

// Estilhaços de Escudo: os pedaços do escudo quebrado voam e acertam os vizinhos.
export function axeShieldShards(c, e, p) {
  if (!p || !isAxe(p) || !W(p).shieldShards) return;
  c.axe2.shards(e, p);
}

// ---------- No golpe (depois de procurar quem acertou): Fenda e Faíscas ----------
export function axe2AfterStrike(c, p, step, range, blocked) {
  if (!isAxe(p)) return;
  const w = W(p);
  const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
  if (step.heavy && w.fissure) c.axe2.crack(p, p.position.x + fx * 1.2, p.position.z + fz * 1.2, fx, fz);
  if (w.sparks) {
    let n = 0;
    for (const e of blocked) if (n < 2) { c.axe2.sparkBurst(p, e.position.x - fx * 0.5, e.position.z - fz * 0.5, 'shield'); n++; }
    if (n < 2 && c.world) for (const k of [0.45, 0.7, 0.95]) {
      const wx = p.position.x + fx * range * k, wz = p.position.z + fz * range * k;
      if (!c.world.blocked(wx, wz, 0.2)) continue;
      const back = Math.max(0.3, range * k - 0.6);
      c.axe2.sparkBurst(p, p.position.x + fx * back, p.position.z + fz * back, 'wall');
      break;
    }
  }
}

// ---------- Estados do esqueleto ----------
export function axeEnemyTick(e, dt, ctx) {
  if (e.state === 'headless') return headlessTick(e, dt, ctx);
  if (e.state === 'axeAir') return airTick(e, dt, ctx);
  if (LANCE_STATES.includes(e.state)) return lanceEnemyTick(e, dt, ctx); // Lança: espetado / voando
  if (FIST_STATES.includes(e.state)) return fistEnemyTick(e, dt, ctx); // Manopla: agarrado / voando / sentado
  if (ORB_STATES.includes(e.state)) return arcEnemyTick(e, dt, ctx); // Cajado Arcano: Levitar / Bolha
  if (ELE_STATES.includes(e.state)) return eleEnemyTick(e, dt, ctx); // Cajado Elétrico: Blecaute / Marionete
  if (FIRE_STATES.includes(e.state)) return fireEnemyTick(e, dt, ctx); // Cajado de Fogo: Pânico
  if (ROGUE_STATES.includes(e.state)) return rogueEnemyTick(e, dt, ctx); // Duas Adagas: Bomba de Fumaça / Areia nos Olhos
  return axe3EnemyTick(e, dt, ctx);
}

// Sem cabeça: anda sem rumo e golpeia quem estiver perto (só os outros esqueletos).
function headlessTick(e, dt, ctx) {
  const h = e.headless, c = ctx.combat, d = e.data, D = AXE2.decap;
  h.t -= dt;
  if (h.t <= 0) {
    e.headless = null;
    e.hp = 0;
    e.die();
    c.killed(e, Math.sin(e.facing), Math.cos(e.facing), h.by);
    return;
  }
  if (h.swing >= 0) {
    h.swing += dt;
    const pr = e.anim.progress();
    if (!h.hit && pr >= 0.55) {
      h.hit = true;
      let n = 0;
      const dmg = Math.max(1, Math.round((e.damage || d.damage || 10) * D.mul));
      for (const o of [...c.enemies]) {
        if (o === e || !o.targetable || o.undead) continue;
        const dx = o.position.x - e.position.x, dz = o.position.z - e.position.z, dd = Math.hypot(dx, dz) || 0.01;
        if (dd > D.reach + o.data.radius) continue;
        c.bonusDamage(o, dmg, dx / dd, dz / dd, 'dmg', h.by);
        c.vfx.sparks(v3(o.position.x, 1.2, o.position.z), 0xffe6a0, 6);
        n++;
      }
      audio.play(n ? 'hit' : 'swing', e.position.x, e.position.z);
      if (c.log) c.log({ type: 'axeHeadlessHit', enemy: e, n });
    }
    if (pr >= 0.9) { h.swing = -1; h.next = D.swing; e.anim.play(d.anims.walk, { fade: 0.15, speed: d.walkAnimSpeed || 1 }); }
    return;
  }
  // Andando sem rumo (mais pesado para um lado, como quem não enxerga).
  h.turn -= dt; h.next -= dt;
  if (h.turn <= 0) { h.ang += (Math.random() - 0.5) * 2.6; h.turn = 0.4 + Math.random() * 0.6; }
  const sp = (d.speed || 3) * D.speed * dt;
  const nx = e.position.x + Math.sin(h.ang) * sp, nz = e.position.z + Math.cos(h.ang) * sp;
  if (ctx.world.blocked(nx, nz, d.radius)) { h.ang += Math.PI * (0.6 + Math.random() * 0.8); h.turn = 0.5; }
  else { e.position.x = nx; e.position.z = nz; }
  e.facing = h.ang + Math.sin(h.t * 9) * 0.25; // cambaleando
  e.anim.play(d.anims.walk, { speed: d.walkAnimSpeed || 1 });
  if (h.next <= 0) {
    // Golpeia para o lado de quem estiver mais perto (às vezes acerta, às vezes o vento).
    let best = null, bd = 3.2;
    for (const o of c.enemies) {
      if (o === e || !o.targetable || o.undead) continue;
      const dd = Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z);
      if (dd < bd) { bd = dd; best = o; }
    }
    if (best) h.ang = Math.atan2(best.position.x - e.position.x, best.position.z - e.position.z);
    e.facing = h.ang;
    h.swing = 0; h.hit = false;
    e.anim.play(d.attack.clip, { once: true, restart: true, fade: 0.08, speed: (d.attack.speed || 1) * 1.1 });
  }
}

// Fenda: jogado para cima, cai atordoado.
function airTick(e, dt, ctx) {
  const a = e.air, F = AXE2.fissure;
  a.t += dt;
  const k = Math.min(1, a.t / F.air);
  e.position.y = 4 * F.height * k * (1 - k);
  e.model.rotation.x = -k * Math.PI * 2 * a.spin;
  if (k >= 1) {
    e.air = null;
    e.position.y = 0; e.model.rotation.x = 0;
    e.setState('hurt');
    e.stunTime = F.land;
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05 });
    ctx.combat.vfx.dust(v3(e.position.x, 0.1, e.position.z), v3(0, 0, 0), 6);
    audio.play('thump', e.position.x, e.position.z, { v: 0.6 });
  }
}

// Saiu de um estado no meio (morreu, congelou...): volta ao chão.
export function axeLeaveState(e, from) {
  if (from === 'axeAir') { e.position.y = 0; e.model.rotation.x = 0; e.air = null; }
  axe3LeaveState(e, from);
  lanceLeaveState(e, from);
  fistLeaveState(e, from);
  arcLeaveState(e, from);
  eleLeaveState(e, from);
  fireLeaveState(e, from);
  rogueLeaveState(e, from);
}

// ---------- Coisas na sala ----------
const CRACK_DARK = new THREE.MeshBasicMaterial({ color: 0x140b06 });
const CRACK_GLOW = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
const CRACK_GEO = new THREE.BoxGeometry(0.6, 0.04, 0.62);
const GLOW_GEO = new THREE.BoxGeometry(0.24, 0.05, 0.6);
const SHARD_GEO = new THREE.BoxGeometry(0.26, 0.06, 0.34);
const SHARD_MAT = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });

export class AxeKit2 {
  constructor(combat) {
    this.c = combat;
    this.cracks = [];  // { p, x, z, dx, dz, dist, segs: [], hit: Set, done, t }
    this.halves = [];  // { g, plane, local, vel, axis, t, hit: Set, p }
    this.shardList = []; // { m, x, z, dx, dz, dist, p, src }
    this.burstCd = new Map();
  }

  get scene() { return this.c.scene; }

  // Fenda: a rachadura corre em linha reta e joga para cima quem estiver no caminho.
  crack(p, x, z, dx, dz) {
    this.cracks.push({ p, x, z, dx, dz, dist: 0, segs: [], hit: new Set(), done: false, t: 0, lastSeg: -1 });
    this.c.vfx.dust(v3(x, 0.1, z), v3(dx, 0, dz), 10);
    audio.play('boom', x, z, { v: 0.7 });
    if (this.c.log) this.c.log({ type: 'axeFissure' });
  }

  addSeg(cr, x, z) {
    const g = new THREE.Group();
    const dark = new THREE.Mesh(CRACK_GEO, CRACK_DARK);
    const glow = new THREE.Mesh(GLOW_GEO, CRACK_GLOW.clone());
    dark.position.y = 0.02; glow.position.y = 0.04;
    g.add(dark); g.add(glow);
    g.position.set(x + (Math.random() - 0.5) * 0.15, 0, z + (Math.random() - 0.5) * 0.15);
    g.rotation.y = Math.atan2(cr.dx, cr.dz) + (Math.random() - 0.5) * 0.7;
    g.scale.set(0.8 + Math.random() * 0.6, 1, 1);
    this.scene.add(g);
    cr.segs.push({ g, glow: glow.material });
  }

  launch(e, p) {
    if (e.data.boss || !e.alive || e.frozenT > 0 || e.state === 'axeAir' || e.state === 'headless') return false;
    if (e.state === 'spawn' || e.state === 'held' || e.state === 'thrown' || e.state === 'spinMove' || e.state === 'spin' || e.state === 'spinGather') return false;
    e.releaseToken();
    e.vel.set(0, 0, 0);
    e.setState('axeAir');
    e.air = { t: 0, spin: Math.random() < 0.5 ? 1 : 0.5 };
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.7 });
    return true;
  }

  // Corte ao Meio: o esqueleto vira duas metades que voam para os lados.
  split(e, p) {
    e.halved = true;
    const c = this.c;
    e.group.updateMatrixWorld(true);
    const sx = Math.cos(p.facing), sz = -Math.sin(p.facing); // lado do herói
    for (const s of [1, -1]) {
      const n = v3(sx * s, 0, sz * s);
      const g = new THREE.Group();
      g.position.set(e.position.x, 0, e.position.z);
      g.rotation.y = e.facing;
      g.scale.copy(e.group.scale);
      const m = SkeletonUtils.clone(e.model);
      const plane = new THREE.Plane(n.clone(), -(n.x * e.position.x + n.z * e.position.z));
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone();
        if (o.material.emissive) o.material.emissive.setHex(0);
        o.material.clippingPlanes = [plane];
        o.material.clipShadows = true;
        o.material.side = THREE.DoubleSide;
      });
      g.add(m);
      this.scene.add(g);
      g.updateMatrixWorld(true);
      const local = plane.clone().applyMatrix4(g.matrixWorld.clone().invert());
      const axis = new THREE.Vector3().crossVectors(UP, n).normalize(); // tomba para fora
      this.halves.push({ g, plane, local, vel: v3(n.x * AXE2.halve.side, AXE2.halve.up, n.z * AXE2.halve.side), axis, tilt: 0, t: 0, hit: new Set([e]), p, n, q0: g.quaternion.clone() });
    }
    e.group.visible = false;
    e.shattered = true; // sem a chuva de ossos
    c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), 0xffffff, 18);
    c.text.add('Ao meio!', e.position, 'crit', 3.6);
    audio.play('bigShatter', e.position.x, e.position.z, { v: 0.7 });
    if (c.log) c.log({ type: 'axeHalve', enemy: e });
  }

  // Estilhaços de Escudo.
  shards(e, p) {
    const A = AXE2.shards, off = Math.random() * Math.PI * 2;
    for (let i = 0; i < A.n; i++) {
      const a = off + i / A.n * Math.PI * 2;
      const m = new THREE.Mesh(SHARD_GEO, SHARD_MAT);
      m.position.set(e.position.x, 1.1, e.position.z);
      m.rotation.set(Math.random() * 6, a, Math.random() * 6);
      this.scene.add(m);
      this.shardList.push({ m, x: e.position.x, z: e.position.z, dx: Math.sin(a), dz: Math.cos(a), dist: 0, p, src: e });
    }
    this.c.text.add('Estilhaços!', e.position, 'crit', 3.8);
    if (this.c.log) this.c.log({ type: 'axeShards', enemy: e });
  }

  // Faíscas: quem estiver perto pega fogo.
  sparkBurst(p, x, z, kind) {
    const c = this.c, S = AXE2.sparks;
    c.vfx.sparks(v3(x, 1.0, z), 0xffb040, 22);
    c.vfx.sparks(v3(x, 0.6, z), 0xff6a1a, 12);
    audio.play('block', x, z, { v: 0.8 });
    let n = 0;
    for (const e of c.enemies) {
      if (!e.alive || e.immune || e.undead) continue;
      if (Math.hypot(e.position.x - x, e.position.z - z) > S.r + e.data.radius) continue;
      e.burn = Math.max(e.burn || 0, S.burn); e.burnDps = Math.max(e.burnDps || 0, S.burnDps * p.stats.damageMul); e.burnTick = 0.5; e.burnBy = p;
      c.text.add('Queimando!', e.position, 'burn', 2.8);
      n++;
    }
    if (c.log) c.log({ type: 'axeSparks', kind, n });
  }

  update(dt) {
    const c = this.c, F = AXE2.fissure;
    // Rachaduras.
    for (let i = this.cracks.length - 1; i >= 0; i--) {
      const cr = this.cracks[i];
      cr.t += dt;
      if (!cr.done) {
        const step = F.speed * dt;
        const nd = Math.min(F.len, cr.dist + step);
        const hx = cr.x + cr.dx * nd, hz = cr.z + cr.dz * nd;
        if (c.world && c.world.blocked(hx, hz, 0.1)) { c.props.hitAt(hx, hz, cr.p); if (c.world.blocked(hx, hz, 0.1)) cr.done = true; } // quebra o que for quebrável; parede para
        if (!cr.done) {
          cr.dist = nd;
          const segN = Math.floor(cr.dist / 0.5);
          while (cr.lastSeg < segN) { cr.lastSeg++; this.addSeg(cr, cr.x + cr.dx * cr.lastSeg * 0.5, cr.z + cr.dz * cr.lastSeg * 0.5); }
          if (Math.random() < dt * 25) c.vfx.dust(v3(hx, 0.1, hz), v3(cr.dx, 0, cr.dz), 2);
          for (const e of [...c.enemies]) {
            if (!e.targetable || cr.hit.has(e)) continue;
            const rx = e.position.x - cr.x, rz = e.position.z - cr.z;
            const along = rx * cr.dx + rz * cr.dz, side = Math.abs(rx * cr.dz - rz * cr.dx);
            if (along < -0.5 || along > cr.dist + e.data.radius || side > F.width + e.data.radius) continue;
            cr.hit.add(e);
            c.bonusDamage(e, Math.round(F.damage * cr.p.stats.damageMul), 0, 0, 'dmg big', cr.p);
            const up = this.launch(e, cr.p); // depois do dano: o Arqueiro rola no 1º golpe, e o salto vence a cambalhota
            if (up) c.text.add('Pra cima!', e.position, 'crit', 3.4);
            if (c.log) c.log({ type: 'axeFissureHit', enemy: e, up });
          }
          c.props.hitAt(hx, hz, cr.p);
          if (cr.dist >= F.len) cr.done = true;
        }
      }
      const fade = cr.done ? Math.max(0, 1 - (cr.t - cr.dist / F.speed) / F.fade) : 1;
      for (const s of cr.segs) { s.glow.opacity = 0.9 * fade; s.g.scale.y = 1; s.g.position.y = fade > 0.4 ? 0 : -(0.4 - fade) * 0.3; }
      if (cr.done && fade <= 0) { for (const s of cr.segs) this.scene.remove(s.g); this.cracks.splice(i, 1); }
    }
    // Metades voando.
    const H = AXE2.halve;
    for (let i = this.halves.length - 1; i >= 0; i--) {
      const h = this.halves[i], g = h.g;
      h.t += dt;
      if (g.position.y > 0 || h.vel.y > 0) {
        h.vel.y -= 22 * dt;
        g.position.addScaledVector(h.vel, dt);
        if (c.world && c.world.blocked(g.position.x, g.position.z, 0.3)) { g.position.x -= h.vel.x * dt; g.position.z -= h.vel.z * dt; h.vel.x *= -0.2; h.vel.z *= -0.2; }
        if (g.position.y <= 0) { g.position.y = 0; h.vel.set(0, 0, 0); c.vfx.dust(v3(g.position.x, 0.1, g.position.z), v3(0, 0, 0), 5); audio.play('bones', g.position.x, g.position.z, { v: 0.6 }); }
        if (h.t < H.fly) {
          for (const o of [...c.enemies]) {
            if (!o.targetable || h.hit.has(o)) continue;
            if (Math.hypot(o.position.x - g.position.x, o.position.z - g.position.z) > H.r + o.data.radius) continue;
            h.hit.add(o);
            c.bonusDamage(o, Math.round(H.damage * h.p.stats.damageMul), h.n.x, h.n.z, 'dmg big', h.p);
            c.vfx.sparks(v3(o.position.x, 1.2, o.position.z), 0xffffff, 8);
            audio.play('hit', o.position.x, o.position.z);
            if (c.log) c.log({ type: 'axeHalfHit', enemy: o });
          }
        }
      }
      h.tilt = Math.min(Math.PI / 2, h.tilt + dt * 5);
      g.quaternion.setFromAxisAngle(h.axis, h.tilt).multiply(h.q0);
      const after = h.t - H.fly - H.lie;
      if (after > 0) g.position.y = -after / H.sink * 1.2;
      g.updateMatrixWorld(true);
      h.plane.copy(h.local).applyMatrix4(g.matrixWorld);
      if (after >= H.sink) { this.scene.remove(g); this.halves.splice(i, 1); }
    }
    // Estilhaços.
    const A = AXE2.shards;
    for (let i = this.shardList.length - 1; i >= 0; i--) {
      const s = this.shardList[i], step = A.speed * dt;
      s.dist += step;
      const nx = s.m.position.x + s.dx * step, nz = s.m.position.z + s.dz * step;
      s.m.rotation.x += dt * 14; s.m.rotation.z += dt * 9;
      let done = s.dist >= A.range || (c.world && c.world.blocked(nx, nz, 0.05));
      if (!done) {
        s.m.position.x = nx; s.m.position.z = nz;
        for (const o of [...c.enemies]) {
          if (o === s.src || !o.targetable) continue;
          if (Math.hypot(o.position.x - nx, o.position.z - nz) > A.r + o.data.radius) continue;
          const dmg = Math.round(A.damage * s.p.stats.damageMul);
          c.bonusDamage(o, dmg, s.dx, s.dz, 'dmg', s.p);
          c.vfx.sparks(v3(o.position.x, 1.1, o.position.z), 0xcfe4ff, 6);
          if (c.log) c.log({ type: 'axeShardHit', enemy: o });
          done = true; break;
        }
      }
      if (done) { this.scene.remove(s.m); this.shardList.splice(i, 1); }
    }
  }

  clear() {
    for (const cr of this.cracks) for (const s of cr.segs) this.scene.remove(s.g);
    for (const h of this.halves) this.scene.remove(h.g);
    for (const s of this.shardList) this.scene.remove(s.m);
    this.cracks.length = 0; this.halves.length = 0; this.shardList.length = 0;
  }
}
