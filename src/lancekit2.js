// Bênçãos da Lança — o que fica na sala: lança voando (Bumerangue) ou cravada (Lança Cravada), esqueleto na ponta
// (Espetinho), lanças fantasmas (Estocada Fantasma, Cemitério, Pregar na Parede), bandeiras, espinhos, crânios-bomba,
// raio do Para-raios, rajada do Mil Lanças, chute da Âncora, Salto do Dragão, guarda da Muralha e o Domador.
import * as THREE from 'three';
import { audio } from './audio.js';
import { instance } from './assets.js';
import { LANCE, isLance, setLanceCombat, lancePlayerTick } from './lancekit.js';
import { LANCE_FX, v3, lying, standing, dispose } from './lancekit3.js';

// Estados do esqueleto (enemies.js via axekit2.js): na ponta da lança / voando como projétil.
export const LANCE_STATES = ['lanceHeld', 'lanceFly'];
let C = null;
export function lanceEnemyTick() {} // quem mexe neles é o LanceKit.update
export function lanceLeaveState(e, from) {
  if (!LANCE_STATES.includes(from)) return;
  e.position.y = 0; // a lista de corpos (LanceKit.bodies) se arruma sozinha no update
  if (e.model) e.model.rotation.x = 0;
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class LanceKit {
  constructor(combat) {
    C = combat; this.c = combat;
    setLanceCombat(combat);
    this.time = 0;
    this.boomers = []; this.planted = []; this.bodies = []; this.nails = new Map(); this.ghosts = [];
    this.graves = []; this.banners = []; this.spikes = []; this.bombs = []; this.flurries = [];
    this.guards = new Map(); this.anchors = new Map(); this.mounts = new Map(); this.flashes = [];
  }
  get scene() { return this.c.scene; }
  get world() { return this.c.world; }
  log(o) { if (this.c.log) this.c.log(o); }
  rehand(p) { if (p.state === 'attack') p.lanceDirty = true; else p.rebuildHero(); if (p.weapon) p.weapon.visible = !p.lanceAway && !p.axeAway; }

  // ---------- Lança Bumerangue ----------
  throwBoomer(p, step) {
    p.axeAway = true;
    if (p.weapon) p.weapon.visible = false;
    const g = new THREE.Group(), spin = lying(); g.add(spin);
    const a = p.facing;
    g.position.set(p.position.x + Math.sin(a) * 0.9, 1.1, p.position.z + Math.cos(a) * 0.9);
    this.scene.add(g);
    this.boomers.push({ p, g, spin, phase: 'out', dx: Math.sin(a), dz: Math.cos(a), dist: 0, hitOut: new Set(), hitBack: new Set(), step });
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.2 });
    this.c.text.add('Bumerangue!', p.position, 'crit', 3.0);
    this.log({ type: 'lanceBoomer' });
  }
  cut(it, set, dx, dz, mul) {
    const c = this.c, g = it.g;
    for (const e of [...c.enemies]) {
      if (!e.targetable || set.has(e)) continue;
      if (Math.hypot(e.position.x - g.position.x, e.position.z - g.position.z) > LANCE.boomer.r + e.data.radius) continue;
      set.add(e);
      c.damageEnemy(it.p, e, { ...it.step, kit: null, damage: it.step.damage * mul }, dx, dz, { ranged: true });
      if (c.log) c.log({ type: 'lanceBoomerHit', enemy: e, back: mul < 1 });
    }
    c.props.hitAt(g.position.x, g.position.z, it.p);
  }

  // ---------- Lança Cravada ----------
  throwPlant(p, step) {
    p.lanceAway = 'planted';
    this.rehand(p);
    const g = lying(); const a = p.facing;
    g.rotation.y = a;
    g.position.set(p.position.x + Math.sin(a) * 0.9, 1.1, p.position.z + Math.cos(a) * 0.9);
    this.scene.add(g);
    this.planted.push({ p, g, phase: 'fly', dx: Math.sin(a), dz: Math.cos(a), dist: 0, hit: new Set(), step, tick: 0.3, t: 0 });
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.2 });
    this.c.text.add('Cravou!', p.position, 'crit', 3.0);
    this.log({ type: 'lancePlant' });
  }
  land(it) {
    dispose(it.g);
    const g = standing(); g.rotation.y = Math.atan2(it.dx, it.dz); g.children[0].rotation.z = 0.18; // só a lança inclina (o anel fica no chão)
    g.position.set(it.g.position.x, 0, it.g.position.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(LANCE.plant.r - 0.12, LANCE.plant.r, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.position.y = 0.12; g.add(ring);
    this.scene.add(g);
    it.g = g; it.ring = ring; it.phase = 'ground';
    this.c.vfx.dust(v3(g.position.x, 0.1, g.position.z), v3(0, 0, 0), 8);
    audio.play('thump', g.position.x, g.position.z, { v: 1 });
    this.log({ type: 'lanceLanded' });
  }
  pickPlanted(it) {
    const p = it.p;
    this.planted.splice(this.planted.indexOf(it), 1);
    dispose(it.g);
    p.lanceAway = null;
    this.rehand(p);
    this.c.text.add('Pegou a lança!', p.position, 'block', 3.0);
    audio.play('thump', p.position.x, p.position.z, { v: 0.6 });
    this.log({ type: 'lancePick' });
  }

  // ---------- Espetinho ----------
  skewer(p, e) {
    if (!e.alive) return;
    e.releaseToken();
    if (e.atk && e.state === 'attack' && e.endAttack) e.endAttack();
    e.vel.set(0, 0, 0);
    e.setState('lanceHeld');
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.5 });
    p.lanceHeld = e;
    this.bodies.push({ p, e, phase: 'held', t: 0 });
    this.c.text.add('Espetado!', e.position, 'crit', 3.4);
    audio.play('crunch', e.position.x, e.position.z, { v: 0.8 });
    this.log({ type: 'lanceSkewer', enemy: e });
  }
  throwBody(p) {
    const b = this.bodies.find((o) => o.p === p && o.phase === 'held');
    p.lanceHeld = null;
    if (!b) return;
    b.phase = 'fly'; b.t = 0; b.dist = 0;
    b.dx = Math.sin(p.facing); b.dz = Math.cos(p.facing);
    b.e.setState('lanceFly');
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.1 });
    this.c.text.add('Arremessou!', p.position, 'crit', 3.0);
    this.log({ type: 'lanceBodyThrow' });
  }
  dropBody(b, stun = 0.5) {
    const e = b.e;
    b.leaving = true;
    this.bodies.splice(this.bodies.indexOf(b), 1);
    if (b.p.lanceHeld === e) b.p.lanceHeld = null;
    if (!e.alive) return;
    e.setState('hurt'); e.stunTime = stun;
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05 });
    this.world.resolveCircle(e.position, e.data.radius);
  }
  bodyImpact(b, o) {
    const c = this.c, p = b.p, e = b.e, S = LANCE.skewer;
    const dmg = Math.round(S.dmg * p.stats.damageMul);
    c.vfx.heavyImpact(v3(e.position.x, 0, e.position.z), 0.9);
    audio.play('crunch', e.position.x, e.position.z, { v: 1.1 });
    c.shakeFor(p, 0.2);
    this.dropBody(b, 0.8);
    if (o) {
      c.bonusDamage(o, dmg, b.dx, b.dz, 'dmg big', p);
      if (o.alive && o.offBalance && !o.data.boss) o.offBalance(b.dx, b.dz, 0.8, 9);
      c.text.add('Strike!', o.position, 'crit', 3.4);
    }
    c.bonusDamage(e, dmg, -b.dx, -b.dz, 'dmg big', p);
    this.log({ type: 'lanceBodyHit', enemy: o || null });
  }

  // ---------- Mil Lanças ----------
  flurry(p) {
    const e = p.lanceFlurryE;
    p.lanceFlurryE = null;
    if (!e) return;
    this.flurries.push({ p, e, i: 0, t: LANCE.flurry.gap });
    this.log({ type: 'lanceFlurry', enemy: e });
  }

  // ---------- Âncora ----------
  showAnchor(p, on) {
    let g = this.anchors.get(p);
    if (on && p.lanceAnchor) {
      if (!g) { g = standing(false, 0.55); this.anchors.set(p, g); }
      g.position.set(p.lanceAnchor.x, 0, p.lanceAnchor.z);
      g.rotation.set(0.12, p.facing, 0);
      this.scene.add(g);
      this.c.vfx.dust(v3(p.lanceAnchor.x, 0.1, p.lanceAnchor.z), v3(0, 0, 0), 6);
    } else if (g) dispose(g);
  }
  anchorKick(p, step) {
    const c = this.c, an = p.lanceAnchor || { x: p.position.x, z: p.position.z }, A = LANCE.anchor;
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - an.x, dz = e.position.z - an.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > A.r + e.data.radius) continue;
      c.damageEnemy(p, e, { ...step }, dx / d, dz / d);
      if (e.alive && e.vel && LANCE_STATES.indexOf(e.state) < 0) e.vel.set(dx / d, 0, dz / d).multiplyScalar(A.push * Math.max(0.3, e.data.knockback ?? 1) * (e.data.boss ? 0.3 : 1));
      n++;
    }
    c.vfx.ring(v3(an.x, 0, an.z), 0xffd36a, A.r);
    c.vfx.dust(v3(an.x, 0.1, an.z), v3(0, 0, 0), 12);
    audio.play(n ? 'hitHeavy' : 'spin', an.x, an.z);
    c.shakeFor(p, 0.25);
    if (n) c.addHitstop(0.08);
    this.log({ type: 'lanceAnchor', n });
  }

  // ---------- Domador ----------
  tame(p, e) {
    const d = e.data, c = this.c;
    e.data = { ...d, attackRange: d.ranged ? d.attackRange : Math.max(d.attackRange || 0, 2.0), voice: undefined };
    e.undead = p; e.tamed = true;
    e.noGrave = true; e.noUltCharge = true; e.provokedBy = null; e.darkMark = null;
    if (e.darkFx) { e.darkFx.s.visible = false; e.darkFx.skull.visible = false; }
    e.releaseToken();
    e.vel.set(0, 0, 0);
    e.hp = Math.max(e.hp, Math.round(e.maxHp * 0.5));
    e.setState('hurt'); e.stunTime = 0.6;
    for (const o of c.enemies) if (o.target === e) o.target = null;
    c.vfx.ring(v3(e.position.x, 0, e.position.z), 0x7dff8a, 1.6);
    c.vfx.smoke(e.position, 0x7dff8a, 8);
    c.text.add('Domado!', e.position, 'heal', 3.4);
    audio.play('rise', e.position.x, e.position.z);
    this.log({ type: 'lanceTame', enemy: e });
  }

  // ---------- Salto do Dragão ----------
  dragonSlam(p) {
    const c = this.c, D = LANCE.dragon, x = p.position.x + Math.sin(p.facing) * 0.8, z = p.position.z + Math.cos(p.facing) * 0.8;
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      if (d > D.r + e.data.radius) continue;
      c.damageEnemy(p, e, { clip: 'Jump_Full_Short', damage: D.dmg, heavy: true, kit: 'lanceDragon', pushMul: 1.3 }, dx / d, dz / d);
      n++;
    }
    c.vfx.heavyImpact(v3(x, 0, z), 1.6);
    c.vfx.ring(v3(x, 0, z), 0xff9a3a, D.r);
    c.vfx.dust(v3(x, 0.1, z), v3(0, 0, 0), 14);
    audio.play('boom', x, z, { v: 1 });
    c.shakeFor(p, 0.4);
    if (n) c.addHitstop(0.1);
    this.log({ type: 'lanceSlam', n });
  }

  // ---------- Muralha de Pontas ----------
  wallTick(p, dt) {
    const c = this.c, R = p.hero.attackRange * (p.stats.rangeMul || 1), arc = LANCE.wall.arc * Math.PI / 180;
    let g = this.guards.get(p);
    if (!g) {
      g = new THREE.Mesh(new THREE.CircleGeometry(1, 20, -Math.PI / 2 - arc, arc * 2).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0x7fd6ff, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      this.guards.set(p, g);
    }
    if (!g.parent) this.scene.add(g);
    g.position.set(p.position.x, 0.08, p.position.z); g.rotation.y = p.facing; g.scale.setScalar(R);
    g.material.opacity = 0.18 + 0.08 * Math.sin(this.time * 6);
    if (p.lanceWallAnim > 0 && (p.lanceWallAnim -= dt) <= 0) p.anim.play(p.hero.anims.idle, { fade: 0.15 });
    for (const e of [...c.enemies]) {
      if (!e.targetable || (e.lanceWallAt || 0) > this.time) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > R + e.data.radius || Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > arc) continue;
      e.lanceWallAt = this.time + LANCE.wall.cd;
      p.swingSeq = (p.swingSeq || 0) + 1;
      p.anim.play('Melee_2H_Attack_Stab', { once: true, restart: true, fade: 0.04, speed: 1.8 });
      p.lanceWallAnim = 0.4;
      audio.play('swing', p.position.x, p.position.z);
      c.damageEnemy(p, e, { ...p.hero.combo[0], lanceAuto: true }, dx / d, dz / d);
      c.addHitstop(0.04);
      this.log({ type: 'lanceWallStab', enemy: e });
    }
  }
  wallOff(p) { const g = this.guards.get(p); if (g && g.parent) dispose(g); }

  // ---------- A cada quadro ----------
  update(dt) {
    const c = this.c;
    this.time += dt;
    for (const p of c.players) {
      lancePlayerTick(c, p, dt);
      if (p.lanceDirty && p.state !== 'attack') { p.lanceDirty = false; p.rebuildHero(); if (p.weapon) p.weapon.visible = !p.lanceAway && !p.axeAway; }
      if (p.state === 'dead' || !isLance(p)) for (const it of [...this.planted]) if (it.p === p && p.state === 'dead') this.pickPlanted(it);
    }
    this.updateBoomers(dt);
    this.updatePlanted(dt);
    this.updateBodies(dt);
    this.updateMisc(dt);
  }

  updateBoomers(dt) {
    const c = this.c, T = LANCE.boomer;
    for (let i = this.boomers.length - 1; i >= 0; i--) {
      const it = this.boomers[i], p = it.p, g = it.g;
      it.spin.rotation.y += dt * 20;
      if (p.state === 'dead' || !c.players.includes(p)) { this.removeBoomer(it); continue; }
      if (it.phase === 'out') {
        const s = T.speed * dt, nx = g.position.x + it.dx * s, nz = g.position.z + it.dz * s;
        if (this.world.blocked(nx, nz, 0.2)) { it.phase = 'back'; c.vfx.sparks(v3(g.position.x, 1.1, g.position.z), 0xffe6a0, 8); audio.play('block', g.position.x, g.position.z, { v: 0.6 }); }
        else { g.position.x = nx; g.position.z = nz; it.dist += s; if (it.dist >= T.out) it.phase = 'back'; }
        this.cut(it, it.hitOut, it.dx, it.dz, 1);
      } else {
        const dx = p.position.x - g.position.x, dz = p.position.z - g.position.z, d = Math.hypot(dx, dz) || 0.001;
        if (d <= T.catch + T.back * dt) { this.removeBoomer(it); audio.play('thump', p.position.x, p.position.z, { v: 0.6 }); this.log({ type: 'lanceCatch' }); continue; }
        g.position.x += dx / d * T.back * dt; g.position.z += dz / d * T.back * dt;
        this.cut(it, it.hitBack, dx / d, dz / d, T.back_mul);
      }
      if (Math.random() < dt * 12) audio.play('swing', g.position.x, g.position.z, { v: 0.35 });
    }
  }
  removeBoomer(it) {
    const i = this.boomers.indexOf(it);
    if (i >= 0) this.boomers.splice(i, 1);
    dispose(it.g);
    if (!this.boomers.some((o) => o.p === it.p)) { it.p.axeAway = false; if (it.p.weapon) it.p.weapon.visible = !it.p.lanceAway; }
  }

  updatePlanted(dt) {
    const c = this.c, P = LANCE.plant;
    for (const it of [...this.planted]) {
      const p = it.p;
      if (it.phase === 'fly') {
        const s = P.speed * dt / 3;
        let stop = false;
        for (let k = 0; k < 3 && !stop; k++) {
          const nx = it.g.position.x + it.dx * s, nz = it.g.position.z + it.dz * s;
          if (this.world.blocked(nx, nz, 0.25)) { c.props.hitAt(nx, nz, p); stop = true; break; }
          it.g.position.x = nx; it.g.position.z = nz; it.dist += s;
          for (const e of [...c.enemies]) {
            if (!e.targetable || it.hit.has(e) || Math.hypot(e.position.x - nx, e.position.z - nz) > 0.6 + e.data.radius) continue;
            it.hit.add(e);
            c.damageEnemy(p, e, { ...it.step, kit: null }, it.dx, it.dz, { ranged: true });
          }
          if (it.dist >= P.dist) stop = true;
        }
        if (stop) this.land(it);
        continue;
      }
      it.t += dt;
      if (it.ring) it.ring.material.opacity = 0.25 + 0.15 * Math.sin(it.t * 5);
      if (p.state !== 'dead' && Math.hypot(p.position.x - it.g.position.x, p.position.z - it.g.position.z) <= P.pick) { this.pickPlanted(it); continue; }
      if ((it.tick -= dt) > 0) continue;
      it.tick = P.tick;
      const top = v3(it.g.position.x, 1.5, it.g.position.z);
      let n = 0;
      for (const e of [...c.enemies]) {
        if (!e.targetable) continue;
        const dx = e.position.x - top.x, dz = e.position.z - top.z, d = Math.hypot(dx, dz) || 0.01;
        if (d > P.r + e.data.radius) continue;
        c.vfx.bolt(top, v3(e.position.x, 1.2, e.position.z), 0x9fdcff);
        c.bonusDamage(e, Math.max(1, Math.round(P.dmg * p.stats.damageMul)), dx / d, dz / d, 'burn', p);
        if (e.alive && e.daze && !e.data.boss) e.daze(P.daze);
        n++;
      }
      if (n) { audio.play('zap', top.x, top.z, { v: 0.6 }); this.log({ type: 'lanceShock', n }); }
    }
  }

  updateBodies(dt) {
    const c = this.c, S = LANCE.skewer;
    for (const b of [...this.bodies]) {
      const p = b.p, e = b.e;
      b.t += dt;
      if (!e.alive || !LANCE_STATES.includes(e.state)) { this.bodies.splice(this.bodies.indexOf(b), 1); if (p.lanceHeld === e) p.lanceHeld = null; continue; }
      if (b.phase === 'held') {
        const ok = p.state !== 'dead' && p.state !== 'hurt' && p.state !== 'dodge' && p.state !== 'stagger' && p.state !== 'rooted' && isLance(p);
        if (!ok || b.t > S.hold || e.state !== 'lanceHeld') { this.dropBody(b); continue; }
        const a = p.facing;
        e.position.x = p.position.x + Math.sin(a) * 2.3; e.position.z = p.position.z + Math.cos(a) * 2.3;
        e.position.y = 0.7 + 0.05 * Math.sin(b.t * 8);
        e.facing = a + Math.PI; e.group.rotation.y = e.facing;
        e.model.rotation.x = -0.35;
        e.vel.set(0, 0, 0);
        continue;
      }
      // Voando.
      const s = S.speed * dt / 3;
      let done = false;
      for (let k = 0; k < 3 && !done; k++) {
        const nx = e.position.x + b.dx * s, nz = e.position.z + b.dz * s;
        if (this.world.blocked(nx, nz, e.data.radius * 0.7)) { this.bodyImpact(b, null); done = true; break; }
        e.position.x = nx; e.position.z = nz; b.dist += s;
        for (const o of c.enemies) {
          if (o === e || !o.targetable) continue;
          if (Math.hypot(o.position.x - nx, o.position.z - nz) > o.data.radius + e.data.radius) continue;
          this.bodyImpact(b, o); done = true; break;
        }
        if (!done && b.dist >= S.range) { this.dropBody(b, 0.6); done = true; }
      }
      if (done) continue;
      e.position.y = 1.0;
      e.model.rotation.x = -1.2;
      e.vel.set(0, 0, 0);
    }
  }

  // Troca de arma / nova partida: tudo deste herói some e a lança volta para a mão.
  dropFor(p) {
    for (const it of [...this.boomers]) if (it.p === p) this.removeBoomer(it);
    for (const it of [...this.planted]) if (it.p === p) { this.planted.splice(this.planted.indexOf(it), 1); dispose(it.g); }
    for (const b of [...this.bodies]) if (b.p === p) this.dropBody(b);
    this.flurries = this.flurries.filter((f) => f.p !== p);
    this.wallOff(p);
    const an = this.anchors.get(p); if (an) dispose(an);
    const m = this.mounts.get(p); if (m) { m.forEach(dispose); this.mounts.delete(p); }
    p.axeAway = false;
  }

  // Troca de sala: tudo que está na sala some; lança cravada/voando volta para a mão (os crânios ficam).
  clear() {
    for (const it of [...this.boomers]) this.removeBoomer(it);
    for (const it of [...this.planted]) { const p = it.p; dispose(it.g); this.planted.splice(this.planted.indexOf(it), 1); p.lanceAway = null; this.rehand(p); }
    for (const b of [...this.bodies]) this.dropBody(b);
    for (const [, n] of this.nails) dispose(n.g);
    this.nails.clear();
    for (const x of [...this.ghosts, ...this.graves, ...this.banners, ...this.flashes]) dispose(x.g);
    for (const ln of this.spikes) for (const cn of (ln.cones || [])) dispose(cn.m);
    for (const b of this.bombs) dispose(b.m);
    this.ghosts = []; this.graves = []; this.banners = []; this.flashes = []; this.spikes = []; this.bombs = []; this.flurries = [];
    for (const p of this.c.players) { p.bannerBoost = 1; p.lanceHeld = null; p.lanceFlurry = null; this.wallOff(p); }
  }
}

// Efeitos na sala (lancekit3.js): pregados, raio, fantasmas, espinhos, crânios, cemitério, bandeiras.
Object.assign(LanceKit.prototype, LANCE_FX);
