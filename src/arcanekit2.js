// Bênçãos do Cajado Arcano — o que fica na sala: minas, orbes em órbita, runas do Triângulo, estrelas da Constelação,
// bolhas, inimigos flutuando/encolhidos, bombas da Ressonância, orbes da Carga Paciente, camadas da Armadura,
// a Gêmea Arcana, a bomba do Piscar, veneno do Caos. Números em arcanekit.js (ARC).
import * as THREE from 'three';
import { audio } from './audio.js';
import { getGlowTexture } from './dungeon/builder.js';
import { makeCharacter, attachWeapon } from './characters.js';
import { Animator } from './animation.js';
import { statDamage } from './runstats.js';
import { spellHit, boltImpact } from './magic.js';
import { ARC, W, isArc, setArcCombat, fireOrbs } from './arcanekit.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const DEG = Math.PI / 180;
const PURPLE = 0xb070ff, LILAC = 0xd59bff, STAR = 0xfff0a0;
const CONTROL = ['chase', 'attack', 'hurt', 'block', 'recover'];
const canControl = (e) => !!(e && e.alive && !e.data.boss && !e.undead && !e.immune && !(e.frozenT > 0) && CONTROL.includes(e.state));

// Peças compartilhadas (nunca descartadas).
const ORB_GEO = new THREE.SphereGeometry(0.32, 12, 10);
const BUBBLE_GEO = new THREE.SphereGeometry(1, 20, 14);
const LINE_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const RUNE_RING = new THREE.RingGeometry(0.55, 0.72, 32).rotateX(-Math.PI / 2);
const RUNE_TRI = new THREE.RingGeometry(0.28, 0.4, 3).rotateX(-Math.PI / 2);
const SHARD_GEO = new THREE.OctahedronGeometry(0.13, 0);
const SHARED = new Set([ORB_GEO, BUBBLE_GEO, LINE_GEO, RUNE_RING, RUNE_TRI, SHARD_GEO]);

const add = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  s.scale.setScalar(size);
  return s;
}
function orbMesh(color, s = 1) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(ORB_GEO, new THREE.MeshBasicMaterial({ color: 0xffffff })));
  g.add(glow(color, 1.7));
  g.scale.setScalar(s);
  return g;
}
function runeMesh() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(RUNE_RING, add(LILAC, 0.85)), new THREE.Mesh(RUNE_TRI, add(LILAC, 0.9)));
  const s = glow(LILAC, 1.8, 0.6); s.position.y = 0.25; g.add(s);
  return g;
}
const ribbon = (color, opacity = 0.8) => new THREE.Mesh(LINE_GEO, add(color, opacity));
// Faixa reta deitada de A até B na altura y.
function placeSeg(m, a, b, y, width) {
  const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 0.01;
  m.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
  m.rotation.y = Math.atan2(dx, dz);
  m.scale.set(width, 1, len);
}
function segDist(px, pz, a, b) {
  const vx = b.x - a.x, vz = b.z - a.z, l2 = vx * vx + vz * vz || 1e-6;
  const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (pz - a.z) * vz) / l2));
  return Math.hypot(px - (a.x + vx * t), pz - (a.z + vz * t));
}
function dispose(o, geo = true) {
  o.traverse((x) => {
    if (x.material) (Array.isArray(x.material) ? x.material : [x.material]).forEach((m) => m.dispose());
    if (geo && x.geometry && !SHARED.has(x.geometry)) x.geometry.dispose();
  });
}

const RUNE_STEP = { damage: ARC.rune.dmg, heavy: false, arcFx: true };
const BLINK_STEP = { damage: ARC.blink.dmg, heavy: false, cast: { type: 'bolt', blast: ARC.blink.r, color: LILAC, speed: 1, size: 1 } };

export class ArcaneKit {
  constructor(combat) {
    setArcCombat(combat);
    this.c = combat;
    this.time = 0;
    this.mines = []; this.orbits = []; this.bubbles = []; this.bombs = []; this.blinks = []; this.links = [];
    this.runes = new Map(); this.runeTick = new Map(); this.lineMeshes = new Map();
    this.twins = new Map(); this.armorFx = new Map(); this.chargeFx = new Map();
    this.starred = new Set(); this.shrunk = new Set(); this.poisoned = new Set();
    this.linkTick = 0;
  }
  get scene() { return this.c.scene; }
  log(o) { if (this.c.log) this.c.log(o); }

  // ---------- Pancada de Cajado ----------
  staffBash(p, step) {
    const c = this.c, A = ARC.bash;
    let near = null, nd = Infinity;
    for (const e of c.enemies) {
      if (!e.targetable) continue;
      const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
      if (d <= A.near + e.data.radius && d < nd) { near = e; nd = d; }
    }
    if (!near) return false;
    p.facing = Math.atan2(near.position.x - p.position.x, near.position.z - p.position.z);
    p.group.rotation.y = p.facing;
    const st = { damage: Math.max(A.min, step.damage * A.mul), heavy: false, pushMul: A.push, arcBash: true };
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > A.reach + e.data.radius) continue;
      if (e !== near && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > A.arc / 2 * DEG) continue;
      const r = c.damageEnemy(p, e, st, dx / d, dz / d);
      if (!r) continue;
      n++;
      if (r === 'hit' && e.alive && e.daze) e.daze(e.data.boss ? A.boss : A.daze);
    }
    c.vfx.sector(p.position, p.facing, A.reach, A.arc / 2 * DEG, LILAC);
    c.vfx.sparks(v3(near.position.x, 1.2, near.position.z), LILAC, 12);
    c.text.add('Pancada!', p.position, 'crit', 3.4);
    audio.play('hitHeavy', p.position.x, p.position.z);
    c.addHitstop(0.06); c.shakeFor(p, 0.15);
    c.endCounter(p, n);
    this.log({ type: 'arcBash', n, enemy: near });
    return true;
  }

  // ---------- Orbe que errou (fim do alcance ou parede) ----------
  // 'hover' = Fusão (fica parado no ar esperando o próximo); 'keep' = Órbita (o orbe continua, fora da lista);
  // 'done' = virou mina / explodiu; false = some normal.
  miss(a, why) {
    const p = a.arcP;
    if (!p || !isArc(p) || !a.step) return false;
    const w = W(p), cst = a.step.cast;
    if (cst.blast || a.grind) return false;
    if (why === 'wall') { const sp = Math.hypot(a.vx, a.vz) || 1; a.x -= a.vx / sp * 0.5; a.z -= a.vz / sp * 0.5; }
    if (w.aFuse && !a.hovered && why === 'end') { // Fusão: espera 0,7 s no ar para o próximo orbe alcançar
      a.hovered = a.hover = true; a.life = 0.7; a.vx *= 0.02; a.vz *= 0.02; a.noSteer = true;
      return 'hover';
    }
    if (w.aOrbit) { this.addOrbit(p, a); return 'keep'; }
    if (w.aMine) { this.addMine(p, a); return 'done'; }
    if (w.aBurst && why === 'end') {
      boltImpact(this.c, { x: a.x, z: a.z, vx: a.vx || 0, vz: a.vz || 1, owner: p, arcP: p, castId: a.castId, comboIdx: -1,
        step: { ...a.step, cast: { ...cst, blast: ARC.burst.r, pull: 0 } } }, null);
      audio.play('boom', a.x, a.z, { v: 0.4 });
      this.log({ type: 'arcBurst' });
      return 'done';
    }
    return false;
  }

  // ---------- Órbita ----------
  addOrbit(p, a) {
    const mine = this.orbits.filter((o) => o.p === p);
    if (mine.length >= ARC.orbit.max) this.dropOrbit(mine[0]);
    this.orbits.push({ p, g: a.g, step: a.step, t: ARC.orbit.t, phase: 'back', x: a.x, z: a.z, ang: 0, cd: new Map(), r: Math.max(0.35, a.r) });
    this.log({ type: 'arcOrbit' });
  }
  dropOrbit(o) {
    const i = this.orbits.indexOf(o);
    if (i >= 0) this.orbits.splice(i, 1);
    this.scene.remove(o.g); dispose(o.g);
  }
  updateOrbits(dt) {
    const c = this.c, O = ARC.orbit;
    for (const o of [...this.orbits]) {
      const p = o.p;
      o.t -= dt;
      if (o.t <= 0 || p.state === 'dead') { c.vfx.sparks(v3(o.x, 1.25, o.z), PURPLE, 6); this.dropOrbit(o); continue; }
      if (o.phase === 'back') {
        const dx = p.position.x - o.x, dz = p.position.z - o.z, d = Math.hypot(dx, dz) || 0.01;
        if (d <= O.r + 0.25) { o.phase = 'orbit'; o.ang = Math.atan2(o.x - p.position.x, o.z - p.position.z); }
        else { const s = Math.min(d - O.r, O.back * dt); o.x += dx / d * s; o.z += dz / d * s; }
      }
      if (o.phase === 'orbit') {
        o.ang += O.spin * dt;
        o.x = p.position.x + Math.sin(o.ang) * O.r; o.z = p.position.z + Math.cos(o.ang) * O.r;
      }
      o.g.position.set(o.x, 1.25, o.z);
      for (const [e, t] of [...o.cd]) { if (t - dt <= 0) o.cd.delete(e); else o.cd.set(e, t - dt); }
      for (const e of [...c.enemies]) {
        if (!e.targetable || o.cd.has(e)) continue;
        const dx = e.position.x - o.x, dz = e.position.z - o.z, d = Math.hypot(dx, dz) || 0.01;
        if (d > o.r + e.data.radius + 0.15) continue;
        o.cd.set(e, O.cd);
        if (spellHit(c, p, e, o.step, dx / d, dz / d)) {
          c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), PURPLE, 6);
          audio.play('hit', e.position.x, e.position.z, { v: 0.6 });
          this.log({ type: 'arcOrbitHit', enemy: e });
        }
      }
    }
  }

  // ---------- Mina Arcana ----------
  addMine(p, a) {
    const mine = this.mines.filter((m) => m.p === p);
    if (mine.length >= ARC.mine.max) this.dropMine(mine[0]);
    const g = orbMesh(a.color ?? PURPLE, 0.7);
    g.position.set(a.x, 0.35, a.z);
    this.scene.add(g);
    this.mines.push({ p, step: a.step, x: a.x, z: a.z, g, t: ARC.mine.life, arm: ARC.mine.arm, age: 0 });
    this.log({ type: 'arcMine' });
  }
  dropMine(m) {
    const i = this.mines.indexOf(m);
    if (i >= 0) this.mines.splice(i, 1);
    this.scene.remove(m.g); dispose(m.g);
  }
  updateMines(dt) {
    const c = this.c, M = ARC.mine;
    for (const m of [...this.mines]) {
      m.t -= dt; m.arm -= dt; m.age += dt;
      m.g.scale.setScalar(0.7 * (1 + 0.18 * Math.sin(m.age * 6)));
      if (m.t <= 0 || m.p.state === 'dead') { this.dropMine(m); continue; }
      if (m.arm > 0) continue;
      const e = c.enemies.find((en) => en.targetable && Math.hypot(en.position.x - m.x, en.position.z - m.z) <= M.trig + en.data.radius);
      if (!e) continue;
      this.dropMine(m);
      c.text.add('Mina!', e.position, 'crit', 3.0);
      boltImpact(c, { x: m.x, z: m.z, vx: 0, vz: 1, owner: m.p, arcP: m.p, comboIdx: -1, mine: true,
        step: { ...m.step, heavy: false, damage: m.step.damage * M.mul, cast: { ...m.step.cast, blast: M.r, pull: 0 } } }, null);
      audio.play('boom', m.x, m.z, { v: 0.6 });
      this.log({ type: 'arcMineBoom', enemy: e });
    }
  }

  // ---------- Triângulo Arcano ----------
  addRune(p) {
    const list = this.runes.get(p) || [];
    const g = runeMesh();
    g.position.set(p.position.x, 0.08, p.position.z);
    this.scene.add(g);
    list.push({ x: p.position.x, z: p.position.z, g });
    while (list.length > ARC.rune.max) { const o = list.shift(); this.scene.remove(o.g); dispose(o.g); }
    this.runes.set(p, list);
    this.rebuildLines(p);
    this.c.vfx.ring(v3(p.position.x, 0, p.position.z), LILAC, 1.2);
    this.log({ type: 'arcRune', n: list.length });
  }
  rebuildLines(p) {
    for (const m of this.lineMeshes.get(p) || []) { this.scene.remove(m); m.material.dispose(); }
    const list = this.runes.get(p) || [], out = [];
    if (list.length === 3) {
      for (let i = 0; i < 3; i++) {
        const m = ribbon(LILAC, 0.7);
        placeSeg(m, list[i], list[(i + 1) % 3], 0.14, ARC.rune.w);
        this.scene.add(m); out.push(m);
      }
    }
    this.lineMeshes.set(p, out);
  }
  updateRunes(dt) {
    const c = this.c, R = ARC.rune;
    for (const [p, list] of this.runes) {
      for (const r of list) r.g.rotation.y += dt * 0.8;
      for (const m of this.lineMeshes.get(p) || []) m.material.opacity = 0.55 + 0.3 * Math.sin(this.time * 9 + m.position.x);
      if (list.length < 3) continue;
      const t = (this.runeTick.get(p) || 0) - dt;
      if (t > 0) { this.runeTick.set(p, t); continue; }
      this.runeTick.set(p, R.tick);
      for (const e of [...c.enemies]) {
        if (!e.targetable) continue;
        let hit = false;
        for (let i = 0; i < 3 && !hit; i++) hit = segDist(e.position.x, e.position.z, list[i], list[(i + 1) % 3]) <= R.w / 2 + e.data.radius;
        if (!hit) continue;
        const r = c.damageEnemy(p, e, RUNE_STEP, 0, 1, { spell: true, noStagger: true });
        if (!r) continue;
        if (e.alive) e.slow = Math.max(e.slow || 0, R.slow);
        c.vfx.sparks(v3(e.position.x, 0.6, e.position.z), LILAC, 4);
        this.log({ type: 'arcRuneHit', enemy: e });
      }
    }
  }

  // ---------- Acertos de magia (estrelas, veneno) ----------
  onSpellHit(p, e, step) {
    if (!isArc(p) || !e.alive) return;
    if (W(p).aStars) { // Constelação
      e.arcStarT = ARC.star.t; e.arcStarBy = p;
      if (!e.arcStarFx) {
        const sc = e.group.scale.x || 1, s = glow(STAR, 0.9 / sc);
        s.position.y = 2.9 / sc;
        e.group.add(s); e.arcStarFx = s;
      }
      this.starred.add(e);
    }
    if (step.cast && step.cast.poison) { // Caos Arcano: veneno
      if (!(e.arcPoisonT > 0)) this.c.text.add('Envenenado!', e.position, 'heal', 3.0);
      e.arcPoisonT = 4; e.arcPoisonBy = p; e.arcPoisonTick = e.arcPoisonTick || 0.5;
      this.poisoned.add(e);
    }
  }
  unstar(e) {
    this.starred.delete(e);
    e.arcStarT = 0;
    if (e.arcStarFx) { e.group.remove(e.arcStarFx); e.arcStarFx.material.dispose(); e.arcStarFx = null; }
  }
  updateStars(dt) {
    const c = this.c, S = ARC.star, list = [];
    for (const e of [...this.starred]) {
      e.arcStarT -= dt;
      if (!e.alive || e.arcStarT <= 0 || !c.enemies.includes(e)) { this.unstar(e); continue; }
      if (e.arcStarFx) e.arcStarFx.material.rotation += dt * 2;
      if (e.targetable) list.push(e);
    }
    const pairs = [];
    const d = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
    for (const e of list) {
      const near = list.filter((o) => o !== e && d(o, e) <= S.range).sort((a, b) => d(a, e) - d(b, e)).slice(0, S.links);
      for (const o of near) if (!pairs.some(([a, b]) => (a === o && b === e) || (a === e && b === o))) pairs.push([e, o]);
    }
    while (this.links.length < pairs.length) { const m = ribbon(STAR, 0.85); this.scene.add(m); this.links.push(m); }
    this.links.forEach((m, i) => {
      m.visible = i < pairs.length;
      if (m.visible) placeSeg(m, pairs[i][0].position, pairs[i][1].position, 1.4, 0.1 + 0.08 * Math.random());
    });
    this.pairs = pairs.length;
    this.linkTick -= dt;
    if (this.linkTick > 0 || !pairs.length) return;
    this.linkTick = S.tick;
    const hurt = new Map();
    for (const [a, b] of pairs) { hurt.set(a, (hurt.get(a) || 0) + 1); hurt.set(b, (hurt.get(b) || 0) + 1); }
    for (const [e, n] of hurt) {
      if (!e.targetable || !e.arcStarBy) continue;
      c.damageEnemy(e.arcStarBy, e, { damage: S.dmg * n, heavy: false, arcFx: true }, 0, 1, { spell: true, noStagger: true });
      c.vfx.sparks(v3(e.position.x, 1.4, e.position.z), STAR, 4);
    }
    this.log({ type: 'arcStarLink', pairs: pairs.length });
  }

  // ---------- Orbe grande: Bolha, Levitar, Encolher, Troca de Lugar, Repulsor ----------
  heavyFx(p, e, a) {
    const w = W(p);
    if (!e.alive) return;
    if (w.aBubble) this.bubble(p, e, a.castId);
    else if (w.aLevit) this.levitate(p, e);
    if (w.aShrink) this.shrink(p, e);
    if (w.aSwap) this.swap(p, e, a.tok);
  }

  bubble(p, e, castId) {
    if (e.arcBubble) { e.arcBubble.t = ARC.bubble.t; return; }
    if (!canControl(e)) return;
    e.releaseToken(); e.vel.set(0, 0, 0);
    e.setState('orbBubble');
    const g = new THREE.Mesh(BUBBLE_GEO, new THREE.MeshBasicMaterial({ color: LILAC, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
    const r = e.data.radius + 0.75;
    g.scale.setScalar(r);
    this.scene.add(g);
    const b = { t: ARC.bubble.t, castId, by: p, g, e, r, age: 0 };
    e.arcBubble = b; this.bubbles.push(b);
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.3 });
    this.c.text.add('Bolha!', e.position, 'block', 3.2);
    this.log({ type: 'arcBubble', enemy: e });
  }
  release(e, stun) {
    e.setState('hurt'); // arcLeaveState: volta ao chão e solta a bolha
    e.stunTime = stun;
    e.anim.play(e.data.anims.idle, { fade: 0.15 });
  }
  pop(e) {
    const b = e.arcBubble, c = this.c, p = b.by, R = ARC.bubble.r;
    const at = v3(e.position.x, 0, e.position.z);
    this.release(e, 0.4);
    const dmg = Math.max(1, Math.round(ARC.bubble.dmg * p.stats.damageMul));
    let n = 0;
    for (const o of [...c.enemies]) {
      if (!o.targetable) continue;
      const dx = o.position.x - at.x, dz = o.position.z - at.z, d = Math.hypot(dx, dz);
      if (d > R + o.data.radius) continue;
      c.bonusDamage(o, dmg, d > 0.05 ? dx / d : 0, d > 0.05 ? dz / d : 1, 'dmg', p);
      n++;
    }
    c.vfx.heavyImpact(at, 1.1); c.vfx.ring(at, LILAC, R); c.vfx.sparks(v3(at.x, 1.2, at.z), 0xffffff, 16);
    audio.play('boom', at.x, at.z, { v: 0.7 });
    c.text.add('Estourou!', e.position, 'crit', 3.4);
    c.shakeFor(p, 0.12);
    this.log({ type: 'arcBubblePop', n, enemy: e });
  }
  updateBubbles() {
    for (const b of [...this.bubbles]) {
      const e = b.e;
      if (b.gone || !e.alive || e.arcBubble !== b) {
        this.c.vfx.sparks(v3(e.position.x, 1.1, e.position.z), LILAC, 8);
        this.scene.remove(b.g); b.g.material.dispose();
        this.bubbles.splice(this.bubbles.indexOf(b), 1);
        continue;
      }
      b.age = 3 - b.t;
      b.g.position.set(e.position.x, e.position.y + 1.1, e.position.z);
      b.g.scale.setScalar(b.r * (1 + 0.05 * Math.sin(b.age * 7)));
      b.g.material.opacity = b.t < 0.6 ? 0.3 * (0.5 + 0.5 * Math.sin(b.age * 30)) : 0.3;
    }
  }

  levitate(p, e) {
    if (e.state === 'orbFloat' || !canControl(e)) return;
    e.releaseToken(); e.vel.set(0, 0, 0);
    e.setState('orbFloat');
    e.arcLev = { t: 0, total: ARC.lev.t, by: p, vy: 0 };
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.4 });
    this.c.text.add('Levitando!', e.position, 'block', 3.2);
    this.c.vfx.sparks(v3(e.position.x, 0.4, e.position.z), LILAC, 10);
    this.log({ type: 'arcLev', enemy: e });
  }

  // Estados do esqueleto (arcstates.js).
  enemyTick(e, dt) {
    const c = this.c;
    if (e.state === 'orbBubble') {
      const b = e.arcBubble;
      if (!b) { this.release(e, 0.05); return; }
      b.t -= dt;
      e.vel.set(0, 0, 0);
      e.position.y = Math.min(0.4, e.position.y + dt * 1.2);
      if (b.t <= 0) this.release(e, 0.25);
      return;
    }
    if (e.state !== 'orbFloat') return;
    const L = e.arcLev;
    if (!L) { this.release(e, 0.05); return; }
    L.t += dt;
    e.vel.set(0, 0, 0);
    if (L.t < L.total) {
      const want = ARC.lev.h + Math.sin(L.t * 3) * 0.15;
      e.position.y += (want - e.position.y) * Math.min(1, dt * 6);
      if (e.model) e.model.rotation.z = Math.sin(L.t * 2.2) * 0.3;
      return;
    }
    L.vy -= 32 * dt;
    e.position.y += L.vy * dt;
    if (e.position.y > 0) return;
    const by = L.by;
    this.release(e, 0.6);
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05 });
    const dmg = Math.max(1, Math.round(ARC.lev.dmg * by.stats.damageMul));
    c.text.add('Queda!', e.position, 'crit', 3.0);
    c.vfx.dust(v3(e.position.x, 0.1, e.position.z), v3(0, 0, 0), 8);
    c.vfx.ring(v3(e.position.x, 0, e.position.z), 0xcfc0ff, 1.4);
    audio.play('thump', e.position.x, e.position.z);
    c.bonusDamage(e, dmg, 0, 1, 'dmg', by);
    this.log({ type: 'arcLevLand', enemy: e, dmg });
  }

  shrink(p, e) {
    if (!e.alive || e.data.boss || e.undead) return;
    if (!this.shrunk.has(e)) e.arcBase = e.group.scale.x || 1;
    e.arcShrinkT = ARC.shrink.t;
    e.slow = Math.max(e.slow || 0, ARC.shrink.t);
    this.shrunk.add(e);
    this.c.text.add('Encolheu!', e.position, 'block', 3.2);
    this.log({ type: 'arcShrink', enemy: e });
  }
  updateShrinks(dt) {
    for (const e of [...this.shrunk]) {
      const base = e.arcBase || 1;
      if (e.arcShrinkT > 0) e.arcShrinkT -= dt;
      const want = e.arcShrinkT > 0 && e.alive ? base * ARC.shrink.k : base;
      const s = e.group.scale.x + (want - e.group.scale.x) * Math.min(1, dt * 8);
      e.group.scale.setScalar(s);
      if (!(e.arcShrinkT > 0) && Math.abs(s - base) < 0.01) { e.group.scale.setScalar(base); e.arcShrinkT = 0; this.shrunk.delete(e); }
    }
  }
  // Encolhido: causa metade do dano (golpes e disparos).
  enemyDmgMul(e) { return e && e.arcShrinkT > 0 ? 0.5 : 1; }

  swap(p, e, tok) {
    if (!tok || tok.swapped || !e.alive || e.undead) return;
    tok.swapped = true;
    const c = this.c, px = p.position.x, pz = p.position.z;
    c.vfx.beamLine(v3(px, 1.2, pz), v3(e.position.x, 1.2, e.position.z), LILAC, 0.4);
    p.position.x = e.position.x; p.position.z = e.position.z;
    e.position.x = px; e.position.z = pz; e.vel.set(0, 0, 0);
    if (c.world) { c.world.resolveCircle(p.position, p.hero.radius); c.world.resolveCircle(e.position, e.data.radius); }
    p.iframes = Math.max(p.iframes || 0, ARC.swap.iframes);
    c.vfx.smoke(v3(px, 0.5, pz), PURPLE, 10); c.vfx.smoke(v3(p.position.x, 0.5, p.position.z), PURPLE, 10);
    c.text.add('Troca!', p.position, 'crit', 3.4);
    audio.play('orb', px, pz);
    this.log({ type: 'arcSwap', enemy: e });
  }

  repel(p, x, z) {
    const c = this.c, R = ARC.repel;
    let n = 0;
    for (const e of c.enemies) {
      if (!e.alive || e.undead || e.immune) continue;
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz);
      if (d > R.r + e.data.radius) continue;
      const nx = d > 0.05 ? dx / d : Math.sin(p.facing), nz = d > 0.05 ? dz / d : Math.cos(p.facing);
      const k = e.data.boss ? 0.25 : Math.max(e.data.knockback ?? 1, 0.6);
      if (!e.data.boss && e.daze) e.daze(R.daze);
      e.vel.set(nx, 0, nz).multiplyScalar(R.push * k);
      n++;
    }
    c.vfx.ring(v3(x, 0, z), 0xe8dcff, R.r); c.vfx.ring(v3(x, 0, z), LILAC, R.r * 0.6);
    this.log({ type: 'arcRepel', n });
  }

  // ---------- Orbe acertou / explodiu (magic.boltImpact) ----------
  onBolt(a, target, hits) {
    const p = a.owner;
    if (!isArc(p) || !a.step) return;
    const w = W(p), heavy = !!a.step.heavy;
    if (hits > 0 && w.aArmor) this.addArmor(p);
    let popped = false;
    if (target && target.arcBubble && target.arcBubble.castId !== a.castId) { this.pop(target); popped = true; }
    if (target && heavy && !a.grind && !popped && target.alive) this.heavyFx(p, target, a);
    if (heavy && w.aRepel && !a.mine) this.repel(p, a.x, a.z);
    if (target && w.aRes && a.comboIdx >= 0) this.resonate(p, target, a.comboIdx);
  }

  // ---------- Esfera Moedora ----------
  grindTick(a, dt) {
    const G = ARC.grind, c = this.c, p = a.arcP;
    a.grind.tick -= dt;
    if (a.grind.tick > 0) return;
    a.grind.tick = G.tick;
    if (!a.grindStep) a.grindStep = { ...a.step, heavy: false, damage: Math.max(1, a.step.damage * G.mul), cast: { ...a.step.cast, blast: 0, pull: 0, pierce: 0 } };
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - a.x, dz = e.position.z - a.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > a.r + e.data.radius + 0.3) continue;
      const first = !a.hitSet.has(e);
      a.hitSet.add(e);
      if (spellHit(c, p, e, a.grindStep, dx / d, dz / d)) n++;
      if (first && e.alive) { if (W(p).aArmor) this.addArmor(p); this.heavyFx(p, e, a); }
    }
    if (n) {
      c.vfx.sparks(v3(a.x, 1.25, a.z), LILAC, 6);
      audio.play('hit', a.x, a.z, { v: 0.5 });
      this.log({ type: 'arcGrind', n });
    }
  }

  // ---------- Ressonância ----------
  resonate(p, e, idx) {
    const R = p.arcRes;
    if (!R || !R[idx]) return;
    R[idx].add(e);
    if (e.arcBombed || !e.alive || !R.every((s) => s.has(e))) return;
    e.arcBombed = true;
    const g = glow(0xff9bff, 2.2);
    g.position.set(e.position.x, 1.2, e.position.z);
    this.scene.add(g);
    this.bombs.push({ e, p, t: ARC.res.t, g, x: e.position.x, z: e.position.z });
    this.c.text.add('Ressonância!', e.position, 'crit', 3.4);
    audio.play('orb', e.position.x, e.position.z);
    this.log({ type: 'arcResonance', enemy: e });
  }
  updateBombs(dt) {
    const c = this.c, R = ARC.res;
    for (const b of [...this.bombs]) {
      b.t -= dt;
      if (b.e.alive) { b.x = b.e.position.x; b.z = b.e.position.z; }
      b.g.position.set(b.x, 1.2, b.z);
      b.g.scale.setScalar(2.2 * (1 + 0.35 * Math.sin((R.t - b.t) * 28)));
      if (b.t > 0) continue;
      this.bombs.splice(this.bombs.indexOf(b), 1);
      this.scene.remove(b.g); b.g.material.dispose();
      b.e.arcBombed = false;
      const at = v3(b.x, 0, b.z), dmg = Math.max(1, Math.round(R.dmg * b.p.stats.damageMul));
      let n = 0;
      for (const o of [...c.enemies]) {
        if (!o.targetable) continue;
        const dx = o.position.x - at.x, dz = o.position.z - at.z, d = Math.hypot(dx, dz);
        if (d > R.r + o.data.radius) continue;
        c.bonusDamage(o, dmg, d > 0.05 ? dx / d : 0, d > 0.05 ? dz / d : 1, 'dmg', b.p);
        n++;
      }
      c.vfx.heavyImpact(at, 1.3); c.vfx.ring(at, 0xff9bff, R.r); c.vfx.sparks(v3(at.x, 1.2, at.z), 0xffd0ff, 18);
      audio.play('boom', at.x, at.z);
      c.shakeFor(b.p, 0.2);
      this.log({ type: 'arcResBoom', n });
    }
  }

  // ---------- Armadura Arcana ----------
  addArmor(p) { p.arcArmor = Math.min(ARC.armor.max, (p.arcArmor || 0) + 1); }
  absorb(p, dmg) {
    const n = p.arcArmor || 0;
    if (!n || dmg <= 0 || !isArc(p)) return dmg;
    const use = Math.min(n, Math.ceil(dmg / ARC.armor.per));
    p.arcArmor = n - use;
    const saved = Math.min(dmg, use * ARC.armor.per);
    this.c.text.add(`Mana −${saved}`, p.position, 'block');
    this.c.vfx.sparks(v3(p.position.x, 1.3, p.position.z), LILAC, 10);
    this.log({ type: 'arcArmor', saved, left: p.arcArmor });
    return dmg - saved;
  }
  updateArmorFx(dt) {
    for (const p of this.c.players) {
      const n = isArc(p) && W(p).aArmor && p.state !== 'dead' ? (p.arcArmor || 0) : 0;
      let fx = this.armorFx.get(p);
      if (!n && !fx) continue;
      if (!fx) {
        fx = new THREE.Group();
        for (let i = 0; i < ARC.armor.max; i++) {
          const m = new THREE.Mesh(SHARD_GEO, add(0xc9a6ff, 0.9));
          const a = (i / ARC.armor.max) * Math.PI * 2;
          m.position.set(Math.sin(a) * 0.95, 1.3, Math.cos(a) * 0.95);
          fx.add(m);
        }
        this.scene.add(fx); this.armorFx.set(p, fx);
      }
      fx.visible = n > 0;
      fx.position.set(p.position.x, 0, p.position.z);
      fx.rotation.y += dt * 2.2;
      fx.children.forEach((m, i) => { m.visible = i < n; m.rotation.x += dt * 3; m.rotation.y += dt * 2; });
    }
  }

  // ---------- Carga Paciente ----------
  updateCharge(dt) {
    const P = ARC.patient;
    for (const p of this.c.players) {
      const on = isArc(p) && W(p).aPatient && p.state !== 'dead';
      if (on) {
        if (p.state === 'attack') p.arcIdle = 0;
        else {
          p.arcIdle = (p.arcIdle || 0) + dt;
          if ((p.arcCharge || 0) < P.max && p.arcIdle >= P.wait + (p.arcCharge || 0) * P.every) {
            p.arcCharge = (p.arcCharge || 0) + 1;
            this.c.vfx.sparks(v3(p.position.x, 1.9, p.position.z), LILAC, 5);
            this.log({ type: 'arcCharge', n: p.arcCharge });
          }
        }
      }
      const n = on ? (p.arcCharge || 0) : 0;
      let fx = this.chargeFx.get(p);
      if (!n && !fx) continue;
      if (!fx) {
        fx = new THREE.Group();
        for (let i = 0; i < P.max; i++) fx.add(orbMesh(PURPLE, 0.45));
        this.scene.add(fx); this.chargeFx.set(p, fx);
      }
      fx.visible = n > 0;
      fx.position.set(p.position.x, 0, p.position.z);
      fx.children.forEach((o, i) => {
        o.visible = i < n;
        const a = this.time * 2.4 + (i / P.max) * Math.PI * 2;
        o.position.set(Math.sin(a) * 1.15, 1.9 + 0.12 * Math.sin(this.time * 4 + i), Math.cos(a) * 1.15);
      });
    }
  }
  fireCharge(p, tok) {
    const n = p.arcCharge || 0;
    if (!n) return;
    p.arcCharge = 0; p.arcIdle = 0;
    const f = p.facing;
    fireOrbs(this.c, p, p.hero.combo[0], p.position.x + Math.sin(f) * 0.9, p.position.z + Math.cos(f) * 0.9, f, { ...tok, idx: -1 }, n);
    this.c.text.add(`Carga ×${n}!`, p.position, 'crit', 3.2);
    audio.play('orb', p.position.x, p.position.z);
    this.log({ type: 'arcChargeFire', n });
  }

  // ---------- Fusão e Devorador (antes de os projéteis andarem) ----------
  grow(a, k, dmgK, max) {
    a.scale = Math.min(max, a.scale * k);
    a.r = 0.35 * a.scale;
    a.g.scale.setScalar(a.scale);
    a.step = { ...a.step, damage: a.step.damage * dmgK };
  }
  fuse(a, b) {
    const F = ARC.fuse, keep = a.hover && !b.hover ? b : a, other = keep === a ? b : a;
    const base = other.step.heavy && !keep.step.heavy ? other.step : keep.step;
    keep.step = { ...base, damage: keep.step.damage + other.step.damage };
    keep.scale = Math.min(F.max, Math.max(keep.scale, other.scale) * F.grow);
    keep.r = 0.35 * keep.scale;
    keep.g.scale.setScalar(keep.scale);
    keep.life = Math.max(keep.life, 0.25);
    keep.fused = (keep.fused || 0) + (other.fused || 0) + 1;
    keep.fuseTo = null;
    if (!keep.hover) { const sp = keep.speed || 20, k = sp / (Math.hypot(keep.vx, keep.vz) || 1); keep.vx *= k; keep.vz *= k; }
    this.c.projectiles.removeA(other);
    this.c.vfx.sparks(v3(keep.x, 1.25, keep.z), 0xffffff, 12);
    this.c.text.add('Fusão!', v3(keep.x, 0, keep.z), 'crit', 2.8);
    this.log({ type: 'arcFuse', scale: keep.scale, dmg: keep.step.damage });
  }
  prepass() {
    const c = this.c, L = c.projectiles.list;
    if (!L.length) return;
    const spells = L.filter((a) => a.hits === 'spell' && a.arcP && !a.grind && isArc(a.arcP));
    if (!spells.length) return;
    for (const a of spells) { // Devorador: engole flechas e magias dos esqueletos
      if (!W(a.arcP).aDevour) continue;
      for (const o of [...L]) {
        if (o.hits !== 'player' || o.stuck >= 0 || !L.includes(a)) continue;
        if (Math.hypot(o.x - a.x, o.z - a.z) > a.r + o.r + 0.3) continue;
        c.projectiles.removeA(o);
        this.grow(a, ARC.devour.grow, ARC.devour.dmg, ARC.devour.max);
        c.vfx.sparks(v3(a.x, 1.25, a.z), LILAC, 8);
        c.text.add('Devorou!', v3(a.x, 0, a.z), 'block', 2.6);
        this.log({ type: 'arcDevour', kind: o.kind });
      }
    }
    const F = ARC.fuse;
    for (const a of spells) { // Fusão: dois orbes que se tocam viram um maior; o de trás corre atrás do da frente
      if (!L.includes(a) || !W(a.arcP).aFuse || a.hover) continue;
      let lead = null, ld = Infinity, merged = false;
      for (const b of spells) {
        if (b === a || b.arcP !== a.arcP || !L.includes(b)) continue;
        const d = Math.hypot(b.x - a.x, b.z - a.z);
        if (d <= (a.r + b.r) * 1.05) { this.fuse(a, b); merged = true; break; }
        if ((b.age >= a.age || b.hover) && d < F.seek && d < ld) { lead = b; ld = d; }
      }
      if (merged || !L.includes(a)) continue;
      const sp = a.speed || Math.hypot(a.vx, a.vz);
      if (lead) {
        a.fuseTo = lead;
        const ang = Math.atan2(lead.x - a.x, lead.z - a.z);
        a.vx = Math.sin(ang) * sp * F.boost; a.vz = Math.cos(ang) * sp * F.boost;
        a.g.rotation.y = ang;
        a.life = Math.max(a.life, ld / (sp * F.boost) + 0.05); // alcança antes de sumir
      } else if (a.fuseTo) {
        a.fuseTo = null;
        const k = sp / (Math.hypot(a.vx, a.vz) || 1); a.vx *= k; a.vz *= k;
      }
    }
  }

  // ---------- Gêmea Arcana ----------
  spawnTwin(p) {
    const T = ARC.twin;
    const old = this.twins.get(p);
    if (old) { old.t = T.t; return; }
    const { group, model } = makeCharacter(p.hero.model);
    const ws = p.hero.weapons || {};
    if (ws.right) { try { attachWeapon(model, 'handslot.r', ws.right); } catch { /* sem a arma: só o corpo */ } }
    const mats = [];
    model.traverse((o) => {
      if (!o.isMesh || o.userData.fxPart) return;
      o.material = new THREE.MeshBasicMaterial({ color: 0xc58cff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      mats.push(o.material);
    });
    const f = p.facing, sx = Math.cos(f), sz = -Math.sin(f), wd = this.c.world;
    let x = p.position.x + sx * T.side, z = p.position.z + sz * T.side;
    if (wd && wd.blocked(x, z, 0.5)) { x = p.position.x - sx * T.side; z = p.position.z - sz * T.side; }
    if (wd && wd.blocked(x, z, 0.5)) { x = p.position.x; z = p.position.z; }
    group.position.set(x, 0, z);
    group.rotation.y = f;
    this.scene.add(group);
    const anim = new Animator(model);
    anim.play(p.hero.anims.idle);
    this.twins.set(p, { p, g: group, model, anim, mats, t: T.t, age: 0 });
    this.c.vfx.smoke(v3(x, 0.6, z), PURPLE, 12);
    this.c.text.add('Gêmea!', p.position, 'crit', 3.4);
    this.log({ type: 'arcTwin' });
  }
  twinsCast(p, step, tok) {
    const tw = this.twins.get(p);
    if (!tw) return;
    const f = p.facing, x = tw.g.position.x + Math.sin(f) * 0.9, z = tw.g.position.z + Math.cos(f) * 0.9;
    tw.g.rotation.y = f;
    tw.anim.play(step.clip, { once: true, restart: true, speed: step.speed * (p.atkSpeed || 1), fade: 0.08,
      onFinish: () => tw.anim.play(p.hero.anims.idle, { fade: 0.15 }) });
    fireOrbs(this.c, p, step, x, z, f, { ...tok, twin: true, swapped: false });
    this.log({ type: 'arcTwinCast' });
  }
  dropTwin(p) {
    const tw = this.twins.get(p);
    if (!tw) return;
    this.scene.remove(tw.g);
    tw.mats.forEach((m) => m.dispose());
    this.twins.delete(p);
  }
  updateTwins(dt) {
    for (const [p, tw] of [...this.twins]) {
      tw.t -= dt; tw.age += dt;
      tw.anim.update(dt);
      const op = 0.5 * Math.min(1, tw.age / 0.25, Math.max(0, tw.t) / 0.4);
      for (const m of tw.mats) m.opacity = op;
      if (tw.t <= 0 || p.state === 'dead') { this.c.vfx.smoke(v3(tw.g.position.x, 0.6, tw.g.position.z), PURPLE, 8); this.dropTwin(p); }
    }
  }

  // ---------- Piscar ----------
  blink(p) {
    const c = this.c, B = ARC.blink, wd = c.world;
    if (p.ctl) p.ctl.moveDir(p.dodgeDir);
    if (p.dodgeDir.lengthSq() === 0) p.dodgeDir.set(Math.sin(p.facing), 0, Math.cos(p.facing)); else p.dodgeDir.normalize();
    const dx = p.dodgeDir.x, dz = p.dodgeDir.z, x0 = p.position.x, z0 = p.position.z, r = p.hero.radius * 0.8;
    const dist = B.dist * (p.stats.dodgeMul || 1);
    let x = x0, z = z0;
    for (let s = 0.25; s <= dist + 1e-6; s += 0.25) {
      const nx = x0 + dx * s, nz = z0 + dz * s;
      if (wd && wd.blocked(nx, nz, r)) break;
      x = nx; z = nz;
    }
    const g = orbMesh(LILAC, 1.2);
    g.position.set(x0, 1.0, z0);
    this.scene.add(g);
    this.blinks.push({ p, x: x0, z: z0, g, t: B.t, age: 0 });
    c.vfx.smoke(v3(x0, 0.6, z0), PURPLE, 12);
    p.position.x = x; p.position.z = z;
    if (wd) wd.resolveCircle(p.position, p.hero.radius);
    p.facing = Math.atan2(dx, dz); p.group.rotation.y = p.facing;
    c.vfx.smoke(v3(p.position.x, 0.6, p.position.z), PURPLE, 12);
    c.vfx.sparks(v3(p.position.x, 1.2, p.position.z), LILAC, 10);
    p.iframes = Math.max(p.iframes || 0, 0.3);
    p.combo = 0; p.queued = false;
    p.setState('idle'); p.anim.play(p.hero.anims.idle, { fade: 0.1 });
    p.dodgeCooldown = p.hero.dodge.cooldown;
    audio.play('dodge', p.position.x, p.position.z);
    this.log({ type: 'arcBlink', d: Math.hypot(p.position.x - x0, p.position.z - z0) });
    return true;
  }
  updateBlinks(dt) {
    for (const b of [...this.blinks]) {
      b.t -= dt; b.age += dt;
      b.g.scale.setScalar(1.2 * (1 + 0.3 * Math.sin(b.age * 22)));
      if (b.t > 0) continue;
      this.blinks.splice(this.blinks.indexOf(b), 1);
      this.scene.remove(b.g); dispose(b.g);
      boltImpact(this.c, { x: b.x, z: b.z, vx: 0, vz: 1, owner: b.p, arcP: b.p, comboIdx: -1, step: BLINK_STEP }, null);
      audio.play('boom', b.x, b.z, { v: 0.7 });
      this.log({ type: 'arcBlinkBoom' });
    }
  }

  // ---------- Veneno (Caos Arcano) ----------
  updatePoison(dt) {
    const c = this.c;
    for (const e of [...this.poisoned]) {
      if (!e.alive || !(e.arcPoisonT > 0)) { this.poisoned.delete(e); continue; }
      e.arcPoisonT -= dt; e.arcPoisonTick -= dt;
      if (e.arcPoisonTick > 0 || e.immune) continue;
      e.arcPoisonTick = 0.5;
      const by = e.arcPoisonBy, n = Math.max(1, Math.round(1.5 * (by ? by.stats.damageMul : 1)));
      statDamage(e, n, e.hp);
      e.hp -= n; e.flash = Math.max(e.flash, 0.4);
      c.text.add(String(n), e.position, 'heal small', 2.0);
      c.vfx.sparks(v3(e.position.x, 1.0, e.position.z), 0x7dff5a, 4);
      if (c.log) c.log({ type: 'arcPoison', enemy: e, dmg: n });
      if (e.hp <= 0) { e.die(); c.killed(e, 0, 1, by); }
    }
  }

  update(dt) {
    this.time += dt;
    this.updateCharge(dt);
    this.updateArmorFx(dt);
    this.updateOrbits(dt);
    this.updateMines(dt);
    this.updateRunes(dt);
    this.updateStars(dt);
    this.updateBubbles(dt);
    this.updateShrinks(dt);
    this.updateBombs(dt);
    this.updateTwins(dt);
    this.updateBlinks(dt);
    this.updatePoison(dt);
  }

  // Troca de arma/herói: tira o que é dessa heroína.
  dropFor(p) {
    this.dropTwin(p);
    for (const o of this.orbits.filter((x) => x.p === p)) this.dropOrbit(o);
    for (const m of this.mines.filter((x) => x.p === p)) this.dropMine(m);
    for (const r of this.runes.get(p) || []) { this.scene.remove(r.g); dispose(r.g); }
    this.runes.delete(p); this.rebuildLines(p); this.lineMeshes.delete(p);
    for (const b of this.blinks.filter((x) => x.p === p)) { this.scene.remove(b.g); dispose(b.g); this.blinks.splice(this.blinks.indexOf(b), 1); }
    for (const fx of [this.armorFx.get(p), this.chargeFx.get(p)]) if (fx) fx.visible = false;
  }

  // Troca de sala: tudo some (a Armadura e a Carga começam do zero em cada sala).
  clear() {
    for (const p of [...this.twins.keys()]) this.dropTwin(p);
    for (const o of [...this.orbits]) this.dropOrbit(o);
    for (const m of [...this.mines]) this.dropMine(m);
    for (const [p, list] of this.runes) { for (const r of list) { this.scene.remove(r.g); dispose(r.g); } this.runes.set(p, []); this.rebuildLines(p); }
    this.runes.clear(); this.runeTick.clear(); this.lineMeshes.clear();
    for (const m of this.links) { this.scene.remove(m); m.material.dispose(); }
    this.links = [];
    for (const b of this.bubbles) { this.scene.remove(b.g); b.g.material.dispose(); }
    this.bubbles = [];
    for (const b of this.bombs) { this.scene.remove(b.g); b.g.material.dispose(); }
    this.bombs = [];
    for (const b of this.blinks) { this.scene.remove(b.g); dispose(b.g); }
    this.blinks = [];
    for (const e of this.starred) if (e.arcStarFx) { e.group.remove(e.arcStarFx); e.arcStarFx.material.dispose(); e.arcStarFx = null; }
    this.starred.clear(); this.shrunk.clear(); this.poisoned.clear();
    for (const fx of [...this.armorFx.values(), ...this.chargeFx.values()]) { this.scene.remove(fx); dispose(fx); }
    this.armorFx.clear(); this.chargeFx.clear();
    for (const p of this.c.players || []) { p.arcArmor = 0; p.arcCharge = 0; p.arcIdle = 0; }
  }
}
