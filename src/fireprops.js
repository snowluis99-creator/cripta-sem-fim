// Cajado de Fogo (lista do dono, 07/11/2026): as coisas que ficam na sala.
// Bolas de fogo (tochas, salamandra, faísca), fogo no chão (rastro, lava, poça do barril), fumaça, rachaduras do
// Vulcão, fogos de artifício, Anel de Chamas, Salamandra e a fênix do Voo da Fênix.
// Quem decide QUANDO criar é o firekit.js; aqui só nascem, vivem e somem.
import * as THREE from 'three';
import { audio } from './audio.js';
import { getGlowTexture } from './dungeon/builder.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ORANGE = 0xff7a2a, LAVA = 0xff4a10;
const patchGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
const crackGeo = new THREE.BoxGeometry(1, 0.02, 0.1).translate(0.5, 0, 0);

export function glow(color, size, opacity = 1, additive = true) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, transparent: true, opacity }));
  s.scale.setScalar(size);
  return s;
}
function dispose(o) {
  o.traverse((m) => { if (m.material) m.material.dispose(); });
}

// Salamandra: corpo em gomos, cabeça, rabo e 4 patinhas (feita em código).
function makeSalamander() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xd8401a, emissive: 0xff5a10, emissiveIntensity: 0.55, roughness: 0.6 });
  const belly = new THREE.MeshStandardMaterial({ color: 0xffb040, emissive: 0xff8a20, emissiveIntensity: 0.6, roughness: 0.6 });
  const segs = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.2 - i * 0.025, 10, 8), i % 2 ? belly : skin);
    s.scale.set(1, 0.7, 1.3);
    s.position.set(0, 0.2, -i * 0.3);
    g.add(s); segs.push(s);
  }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin);
  head.scale.set(1.05, 0.75, 1.35); head.position.set(0, 0.24, 0.3);
  const black = new THREE.MeshBasicMaterial({ color: 0x1a0a00 });
  for (const sx of [-0.1, 0.1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), black); eye.position.set(sx, 0.08, 0.1); head.add(eye); }
  g.add(head);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.9, 7), skin);
  tail.rotation.x = -Math.PI / 2; tail.position.set(0, 0.17, -1.3);
  g.add(tail);
  const legs = [];
  for (const [x, z] of [[-0.2, 0.05], [0.2, 0.05], [-0.18, -0.6], [0.18, -0.6]]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.08), skin);
    l.position.set(x, 0.08, z); g.add(l); legs.push(l);
  }
  const back = glow(0xff9a30, 0.9, 0.55); back.position.set(0, 0.45, -0.3); g.add(back);
  g.userData = { segs, head, tail, legs, back };
  g.scale.setScalar(1.5); // maior: dá para ver de longe
  return g;
}

// Fênix do Voo da Fênix: corpo brilhante, duas asas de fogo e a cauda.
function wingGeo(side) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.quadraticCurveTo(side * 0.8, 0.5, side * 1.6, 0.35); s.lineTo(side * 1.25, 0.05);
  s.lineTo(side * 1.45, -0.15); s.lineTo(side * 0.95, -0.12); s.lineTo(side * 1.05, -0.38); s.quadraticCurveTo(side * 0.5, -0.2, 0, -0.15);
  return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
}
function makePhoenix() {
  const g = new THREE.Group();
  const mat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const wl = new THREE.Mesh(wingGeo(-1), mat(0xff4a0a, 0.8)), wr = new THREE.Mesh(wingGeo(1), mat(0xff4a0a, 0.8));
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.9), mat(0xff7a1a, 0.7));
  g.add(wl, wr, tail, glow(0xffd070, 1.1, 0.9), glow(0xff3a00, 3.4, 0.45));
  g.userData = { wl, wr };
  g.scale.setScalar(1.4);
  return g;
}

export class FireProps {
  constructor(c) {
    this.c = c;
    this.balls = []; this.patches = []; this.clouds = []; this.cracks = []; this.rings = []; this.salas = []; this.fuses = [];
  }
  log(o) { if (this.c.log) this.c.log(o); }
  get scene() { return this.c.scene; }
  add(o) { this.scene.add(o); return o; }
  drop(o) { this.scene.remove(o); dispose(o); }

  // ---------- Bolas de fogo: seguem o alvo (target) ou fazem um arco até um ponto (to + arc) ----------
  ball(o) {
    const m = new THREE.Group();
    m.add(glow(o.color ?? ORANGE, o.size ?? 0.9, 0.95), glow(0xfff0c0, (o.size ?? 0.9) * 0.35, 1));
    m.position.set(o.from.x, o.from.y ?? 1.2, o.from.z);
    this.add(m);
    const b = { ...o, m, t: 0, spark: 0, x0: o.from.x, y0: o.from.y ?? 1.2, z0: o.from.z };
    if (o.to) b.dur = Math.max(0.25, Math.hypot(o.to.x - o.from.x, o.to.z - o.from.z) / o.speed);
    this.balls.push(b);
    return b;
  }
  updateBalls(dt) {
    for (const b of [...this.balls]) {
      b.t += dt; b.spark -= dt;
      const pos = b.m.position;
      let hit = false;
      if (b.to) {
        const k = Math.min(1, b.t / b.dur), ty = b.to.y ?? 0.3;
        pos.set(b.x0 + (b.to.x - b.x0) * k, b.y0 + (ty - b.y0) * k + (b.arc || 0) * 4 * k * (1 - k), b.z0 + (b.to.z - b.z0) * k);
        hit = k >= 1;
      } else {
        const t = b.target;
        if (t && t.alive) b.last = { x: t.position.x, z: t.position.z };
        const aim = b.last || { x: pos.x, z: pos.z };
        const dx = aim.x - pos.x, dy = 1.1 - pos.y, dz = aim.z - pos.z, d = Math.hypot(dx, dy, dz);
        const st = b.speed * dt;
        if (d <= st + 0.25 || b.t > 3) hit = true;
        else pos.set(pos.x + (dx / d) * st, pos.y + (dy / d) * st, pos.z + (dz / d) * st);
      }
      if (b.spark <= 0) { b.spark = 0.035; this.c.vfx.sparks(pos.clone(), b.trail ?? b.color ?? ORANGE, 1); }
      if (!hit) continue;
      this.balls.splice(this.balls.indexOf(b), 1);
      this.drop(b.m);
      if (b.onHit) b.onHit(pos.x, pos.z, b.target && b.target.alive ? b.target : null);
    }
  }

  // ---------- Fogo no chão (Rastro de Chamas, lava do Vulcão, poça do barril) ----------
  patch(x, z, r, life, kind, by, hurt) {
    const m = new THREE.Mesh(patchGeo, new THREE.MeshBasicMaterial({ color: kind === 'lava' ? LAVA : ORANGE, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(x, 0.06 + Math.random() * 0.01, z); m.scale.setScalar(r);
    this.add(m);
    const pt = { x, z, r, life, age: 0, kind, by, hurt, tick: 0.15, m, fx: 0 };
    this.patches.push(pt);
    return pt;
  }
  inFire(x, z, pad = 0) {
    if (this.patches.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + pad)) return true;
    return (this.c.fireFields || []).some((f) => Math.hypot(x - f.x, z - f.z) < f.r + pad); // Inferno
  }
  updatePatches(dt) {
    for (const f of [...this.patches]) {
      f.age += dt; f.tick -= dt; f.fx -= dt;
      const left = f.life - f.age;
      f.m.material.opacity = Math.min(1, f.age * 6, left * 2) * (0.38 + 0.12 * Math.sin(f.age * 17 + f.x));
      if (left <= 0) { this.patches.splice(this.patches.indexOf(f), 1); this.drop(f.m); continue; }
      if (f.fx <= 0) {
        f.fx = 0.12 / Math.max(0.5, f.r);
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * f.r;
        this.c.vfx.flameCone(v3(f.x + Math.sin(a) * rr, 0.2, f.z + Math.cos(a) * rr), 0, 0.2, Math.PI, f.kind === 'lava' ? LAVA : ORANGE, false);
      }
      if (f.tick > 0 || !f.hurt) continue;
      f.tick = 0.5;
      for (const e of [...this.c.enemies]) {
        if (!e.targetable || e.undead) continue;
        if (Math.hypot(e.position.x - f.x, e.position.z - f.z) > f.r + e.data.radius * 0.6) continue;
        f.hurt(e);
      }
    }
  }

  // ---------- Fumaça ----------
  cloud(x, z, r, life) {
    const g = new THREE.Group();
    const parts = [];
    for (let i = 0; i < 5; i++) {
      const s = glow(i % 2 ? 0x8a847c : 0xa8a298, r * (1.3 + Math.random() * 0.5), 0, false);
      const a = Math.random() * Math.PI * 2, rr = Math.random() * r * 0.55;
      s.position.set(Math.sin(a) * rr, 0.7 + Math.random() * 1.0, Math.cos(a) * rr);
      g.add(s); parts.push({ s, vy: 0.2 + Math.random() * 0.3, sz: s.scale.x });
    }
    g.position.set(x, 0, z);
    this.add(g);
    const cl = { x, z, r, life, age: 0, g, parts };
    this.clouds.push(cl);
    return cl;
  }
  inSmoke(x, z) { return this.clouds.some((cl) => cl.age < cl.life && Math.hypot(x - cl.x, z - cl.z) < cl.r); }
  updateClouds(dt) {
    for (const cl of [...this.clouds]) {
      cl.age += dt;
      const k = cl.age / cl.life;
      if (k >= 1) { this.clouds.splice(this.clouds.indexOf(cl), 1); this.drop(cl.g); continue; }
      for (const p of cl.parts) {
        p.s.position.y += p.vy * dt;
        p.s.scale.setScalar(p.sz * (0.8 + k * 0.5));
        p.s.material.opacity = 0.6 * Math.min(1, cl.age * 4) * (1 - k * k);
      }
    }
  }

  // ---------- Vulcão: rachadura que jorra lava várias vezes ----------
  crack(x, z, V, by, erupt) {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(crackGeo, new THREE.MeshBasicMaterial({ color: LAVA, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.y = (i / 7) * Math.PI * 2 + Math.random() * 0.5;
      m.scale.set(V.r * (0.7 + Math.random() * 0.5), 1, 1 + Math.random());
      g.add(m);
    }
    g.add(glow(LAVA, V.r * 1.4, 0.6));
    g.position.set(x, 0.05, z);
    this.add(g);
    const ck = { x, z, g, left: V.n, next: V.first, gap: V.gap, by, erupt, age: 0, end: V.first + V.gap * (V.n - 1) + 0.6 };
    this.cracks.push(ck);
    audio.play('crunch', x, z, { v: 0.7 });
    return ck;
  }
  updateCracks(dt) {
    for (const ck of [...this.cracks]) {
      ck.age += dt; ck.next -= dt;
      ck.g.children.forEach((m) => { if (m.material) m.material.opacity = 0.55 + 0.35 * Math.sin(ck.age * 14); });
      if (ck.left > 0 && ck.next <= 0) {
        ck.left--; ck.next = ck.gap;
        this.lavaColumn(ck.x, ck.z);
        ck.erupt(ck);
      }
      if (ck.age >= ck.end) { this.cracks.splice(this.cracks.indexOf(ck), 1); this.drop(ck.g); }
    }
  }
  lavaColumn(x, z) {
    const vfx = this.c.vfx;
    for (let i = 0; i < 14; i++) {
      const s = glow(Math.random() < 0.4 ? 0xffd060 : LAVA, 0.6 + Math.random() * 0.5);
      s.position.set(x + (Math.random() - 0.5) * 0.6, 0.2, z + (Math.random() - 0.5) * 0.6);
      const vel = v3((Math.random() - 0.5) * 2.5, 6 + Math.random() * 5, (Math.random() - 0.5) * 2.5);
      vfx.add(s, 0.55 + Math.random() * 0.25, (o, k, d) => { o.position.addScaledVector(vel, d); vel.y -= 16 * d; o.material.opacity = 1 - k; });
    }
    vfx.heavyImpact(v3(x, 0, z), 0.7);
    audio.play('boom', x, z, { v: 0.45 });
  }

  // ---------- Fogos de artifício: estouro colorido ----------
  burst(x, z, color, r) {
    const vfx = this.c.vfx;
    for (const col of [color, 0xffffff, color]) vfx.sparks(v3(x, 1.6, z), col, 10);
    for (let i = 0; i < 16; i++) {
      const s = glow(i % 3 ? color : 0xffffff, 0.45);
      s.position.set(x, 1.8, z);
      const a = (i / 16) * Math.PI * 2, el = (Math.random() - 0.3) * 1.2;
      const vel = v3(Math.sin(a) * 5, 2 + el * 3, Math.cos(a) * 5);
      vfx.add(s, 0.7, (o, k, d) => { o.position.addScaledVector(vel, d); vel.y -= 7 * d; vel.multiplyScalar(1 - 1.5 * d); o.material.opacity = 1 - k; });
    }
    vfx.ring(v3(x, 0, z), color, r);
  }

  // ---------- Anel de Chamas: bolas de fogo girando em volta da Maga ----------
  orbit(p, R) {
    const old = this.rings.find((o) => o.p === p);
    if (old) { old.t = R.time; return old; }
    const balls = [];
    for (let i = 0; i < R.n; i++) { const b = new THREE.Group(); b.add(glow(ORANGE, 1.0), glow(0xfff0c0, 0.35)); this.add(b); balls.push(b); }
    const o = { p, t: R.time, a: 0, balls, cd: new Map(), R };
    this.rings.push(o);
    return o;
  }
  updateRings(dt, onHit) {
    for (const o of [...this.rings]) {
      o.t -= dt; o.a += o.R.spin * dt;
      const p = o.p;
      if (o.t <= 0 || p.state === 'dead') { this.rings.splice(this.rings.indexOf(o), 1); o.balls.forEach((b) => this.drop(b)); continue; }
      for (const [e, t] of o.cd) { if (t - dt <= 0) o.cd.delete(e); else o.cd.set(e, t - dt); }
      o.balls.forEach((b, i) => {
        const a = o.a + (i / o.balls.length) * Math.PI * 2;
        b.position.set(p.position.x + Math.sin(a) * o.R.r, 1.0, p.position.z + Math.cos(a) * o.R.r);
        if (Math.random() < dt * 20) this.c.vfx.sparks(b.position.clone(), ORANGE, 1);
        for (const e of [...this.c.enemies]) {
          if (!e.targetable || e.undead || o.cd.has(e)) continue;
          if (Math.hypot(e.position.x - b.position.x, e.position.z - b.position.z) > e.data.radius + o.R.hitR) continue;
          o.cd.set(e, o.R.cd);
          onHit(p, e, b.position);
        }
      });
    }
  }

  // ---------- Salamandra: segue a Maga ----------
  salamander(p) {
    let s = this.salas.find((o) => o.p === p);
    if (s) return s;
    const g = makeSalamander();
    const a = p.facing + Math.PI * 0.8;
    g.position.set(p.position.x + Math.sin(a) * 1.4, 0, p.position.z + Math.cos(a) * 1.4);
    this.add(g);
    s = { p, g, cd: 0.6, t: 0, facing: p.facing, spitT: 0 };
    this.salas.push(s);
    this.c.vfx.sparks(v3(g.position.x, 0.5, g.position.z), ORANGE, 12);
    return s;
  }
  dropSalamander(s) { this.salas.splice(this.salas.indexOf(s), 1); this.drop(s.g); }
  moveSalamander(s, dt) {
    const p = s.p, g = s.g, u = g.userData;
    s.t += dt;
    const side = Math.sin(p.facing + Math.PI / 2), sideZ = Math.cos(p.facing + Math.PI / 2);
    const tx = p.position.x - Math.sin(p.facing) * 1.2 + side * 0.9, tz = p.position.z - Math.cos(p.facing) * 1.2 + sideZ * 0.9;
    const dx = tx - g.position.x, dz = tz - g.position.z, d = Math.hypot(dx, dz);
    let moving = false;
    if (d > 0.25) {
      const sp = Math.min(d * 4, 9) * dt;
      g.position.x += (dx / d) * Math.min(sp, d); g.position.z += (dz / d) * Math.min(sp, d);
      if (s.spitT <= 0) s.facing += Math.atan2(Math.sin(Math.atan2(dx, dz) - s.facing), Math.cos(Math.atan2(dx, dz) - s.facing)) * Math.min(1, dt * 10);
      moving = true;
    }
    if (s.spitT > 0) s.spitT -= dt;
    g.rotation.y = s.facing;
    const w = moving ? Math.sin(s.t * 16) : Math.sin(s.t * 3) * 0.3;
    u.segs.forEach((seg, i) => { seg.position.x = w * 0.08 * (i - 1); });
    u.tail.position.x = -w * 0.15; u.tail.rotation.y = w * 0.4;
    u.legs.forEach((l, i) => { l.position.y = 0.08 + (moving ? Math.max(0, Math.sin(s.t * 16 + (i % 2 ? Math.PI : 0))) * 0.07 : 0); });
    u.back.material.opacity = 0.45 + 0.15 * Math.sin(s.t * 9);
  }
  headPos(s) {
    const a = s.facing;
    return { x: s.g.position.x + Math.sin(a) * 0.45, y: 0.35, z: s.g.position.z + Math.cos(a) * 0.45 };
  }

  // ---------- Fênix (Voo da Fênix) ----------
  phoenix() { return this.add(makePhoenix()); }
  flapPhoenix(m, p, t) {
    m.position.set(p.position.x, 1.1 + Math.sin(t * 9) * 0.1, p.position.z);
    m.rotation.y = p.facing;
    const f = Math.sin(t * 22) * 0.6;
    m.userData.wl.rotation.z = f; m.userData.wr.rotation.z = -f;
  }

  update(dt, ringHit) {
    this.updateBalls(dt);
    this.updatePatches(dt);
    this.updateClouds(dt);
    this.updateCracks(dt);
    this.updateRings(dt, ringHit);
  }

  clear() {
    for (const b of this.balls) this.drop(b.m);
    for (const f of this.patches) this.drop(f.m);
    for (const cl of this.clouds) this.drop(cl.g);
    for (const ck of this.cracks) this.drop(ck.g);
    for (const o of this.rings) o.balls.forEach((b) => this.drop(b));
    for (const s of this.salas) this.drop(s.g);
    for (const f of this.fuses) if (f.flame) this.drop(f.flame);
    this.balls = []; this.patches = []; this.clouds = []; this.cracks = []; this.rings = []; this.salas = []; this.fuses = [];
  }
}
