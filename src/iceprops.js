// Cajado de Gelo (lista do dono, 07/11/2026): as coisas que ficam na sala.
// Estátua de gelo, Parede de Gelo, Estalagmites, Granizo, Cristais, Boneco de Neve, Pista de Gelo, Neblina e o Iglu.
// Quem decide QUANDO criar é o icekit.js; aqui só nascem, vivem e somem.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { audio } from './audio.js';
import { getGlowTexture } from './dungeon/builder.js';
import { makeIceBlock } from './magic.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const ICE_MAT = new THREE.MeshStandardMaterial({ color: 0xbfe9ff, emissive: 0x3a8fd0, emissiveIntensity: 0.35, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.88 });
const SNOW_MAT = new THREE.MeshStandardMaterial({ color: 0xf4fbff, roughness: 0.9, emissive: 0x9fc8e8, emissiveIntensity: 0.12 });
const wallGeo = new THREE.BoxGeometry(0.9, 1.9, 0.75);
const spikeGeo = new THREE.ConeGeometry(0.24, 1.4, 6).translate(0, 0.7, 0);
const hailGeo = new THREE.IcosahedronGeometry(0.17, 0);
const crystalGeo = new THREE.OctahedronGeometry(0.3, 0);
const ballGeo = new THREE.SphereGeometry(0.16, 8, 6);
const CRYSTAL_MAT = new THREE.MeshStandardMaterial({ color: 0x9ff0ff, emissive: 0x3fd0ff, emissiveIntensity: 0.9, roughness: 0.1, transparent: true, opacity: 0.92 });

function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  s.scale.setScalar(size);
  return s;
}

function makeSnowman() {
  const g = new THREE.Group();
  const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), SNOW_MAT); b1.position.y = 0.5;
  const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), SNOW_MAT); b2.position.y = 1.25;
  const head = new THREE.Group(); head.position.y = 1.82;
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 9), SNOW_MAT));
  const black = new THREE.MeshBasicMaterial({ color: 0x151515 });
  for (const sx of [-0.1, 0.1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), black); eye.position.set(sx, 0.07, 0.26); head.add(eye); }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 6), new THREE.MeshStandardMaterial({ color: 0xff8a2a })); nose.rotation.x = Math.PI / 2; nose.position.set(0, 0, 0.38); head.add(nose);
  const wood = new THREE.MeshStandardMaterial({ color: 0x6a4424 });
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 5), wood);
    const piv = new THREE.Group(); piv.position.set(sx * 0.32, 1.35, 0); piv.rotation.z = sx * -1.0; arm.position.y = 0.37; piv.add(arm); g.add(piv); arms.push(piv);
  }
  g.add(b1, b2, head);
  g.userData = { head, arms };
  return g;
}

export class IceProps {
  constructor(c) {
    this.c = c;
    this.statues = []; this.walls = []; this.spikes = []; this.hail = []; this.stones = [];
    this.crystals = []; this.snowmen = []; this.balls = []; this.rinks = []; this.fogs = [];
  }
  log(o) { if (this.c.log) this.c.log(o); }
  get scene() { return this.c.scene; }

  addRect(x0, z0, x1, z1) {
    const w = this.c.world;
    w.addRect(x0, z0, x1, z1);
    const r = w.rects[w.rects.length - 1];
    r.ice = true; // as magias da Maga passam por cima do gelo dela (collision.js / projectiles.js)
    return r;
  }
  dropRects(list) {
    const w = this.c.world;
    for (const r of list || []) { const k = w.rects.indexOf(r); if (k >= 0) { w.rects.splice(k, 1); w.version = (w.version || 0) + 1; } }
  }

  // ---------- Estátua: clone de gelo de quem morreu; inimigo que encosta congela e o clone quebra ----------
  statue(e, cfg) { // cfg = ICE.statue (life, freeze, touch)
    const g = new THREE.Group();
    g.position.set(e.position.x, 0, e.position.z);
    g.rotation.y = e.facing;
    g.scale.copy(e.group.scale);
    const m = SkeletonUtils.clone(e.model);
    m.traverse((o) => { if (o.isMesh) { o.material = ICE_MAT; o.castShadow = false; } });
    m.position.y = 0; m.rotation.x = 0;
    g.add(m);
    this.scene.add(g);
    this.statues.push({ g, t: 0, life: cfg.life, cfg, x: e.position.x, z: e.position.z, r: e.data.radius, src: e });
    this.c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), 0xcff4ff, 12);
    this.c.text.add('Clone de gelo!', e.position, 'block', 3.0);
    this.log({ type: 'iceStatue', enemy: e });
  }
  breakStatue(i) {
    const s = this.statues[i];
    this.statues.splice(i, 1);
    this.scene.remove(s.g);
    this.c.vfx.sparks(v3(s.x, 1.2, s.z), 0xcff4ff, 18);
    this.c.vfx.puff(v3(s.x, 0, s.z));
    audio.play('bigShatter', s.x, s.z, { v: 0.5 });
  }

  // ---------- Parede de Gelo: na frente da Maga, segura inimigos e flechas ----------
  wall(p, cfg) {
    for (const w of this.walls.filter((o) => o.p === p)) this.endWall(w, true); // uma parede por vez
    const a = p.facing, fx = Math.sin(a), fz = Math.cos(a), sx = Math.cos(a), sz = -Math.sin(a);
    const cx = p.position.x + fx * cfg.dist, cz = p.position.z + fz * cfg.dist;
    const g = new THREE.Group();
    const rects = [], blocks = [];
    const n = cfg.blocks, gap = cfg.width / n;
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * gap;
      const x = cx + sx * o, z = cz + sz * o, r = gap * 0.5;
      rects.push(this.addRect(x - r, z - r, x + r, z + r));
      const b = new THREE.Mesh(wallGeo, ICE_MAT);
      b.position.set(x, -1, z); b.rotation.y = a + (Math.random() - 0.5) * 0.25;
      b.scale.y = 0.85 + Math.random() * 0.3;
      g.add(b); blocks.push(b);
    }
    this.scene.add(g);
    const it = { p, g, blocks, rects, t: 0, life: cfg.time, x: cx, z: cz };
    this.walls.push(it);
    this.c.vfx.ring(v3(cx, 0, cz), 0x8fe3ff, cfg.width / 2);
    audio.play('iceWave', cx, cz, { v: 0.7 });
    this.log({ type: 'iceWall', x: cx, z: cz });
    return it;
  }
  endWall(w, quick = false) {
    const i = this.walls.indexOf(w);
    if (i < 0) return;
    this.walls.splice(i, 1);
    this.dropRects(w.rects);
    this.scene.remove(w.g);
    for (const b of w.blocks) this.c.vfx.sparks(v3(b.position.x, 1, b.position.z), 0xcff4ff, quick ? 3 : 6);
    if (!quick) audio.play('thaw', w.x, w.z);
  }

  // ---------- Estalagmites: estacas de gelo brotam em volta ----------
  spikeRing(x, z, cfg, by, skip) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const list = [];
    for (let i = 0; i < cfg.n; i++) {
      const a = (i / cfg.n) * Math.PI * 2 + Math.random() * 0.4, r = cfg.r * (0.7 + Math.random() * 0.4);
      const m = new THREE.Mesh(spikeGeo, ICE_MAT);
      m.position.set(Math.sin(a) * r, -1.5, Math.cos(a) * r);
      m.rotation.set((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4);
      m.scale.setScalar(0.8 + Math.random() * 0.5);
      g.add(m); list.push(m);
    }
    this.scene.add(g);
    this.spikes.push({ g, list, t: -cfg.delay, done: false, x, z, cfg, by, skip });
  }

  // ---------- Granizo: pedras de gelo caindo em volta da Maga ----------
  startHail(p, cfg) {
    const old = this.hail.find((h) => h.p === p);
    if (old) { old.t = cfg.time; return; }
    this.hail.push({ p, t: cfg.time, next: 0, cfg });
    this.log({ type: 'iceHail' });
  }

  // ---------- Cristais: pegar cura ----------
  crystal(x, z, cfg) {
    if (this.crystals.length >= 8) return;
    const g = new THREE.Group();
    const m = new THREE.Mesh(crystalGeo, CRYSTAL_MAT); m.scale.set(1, 1.6, 1);
    g.add(m, glow(0x7fe8ff, 1.3, 0.7));
    g.position.set(x, 0.6, z);
    this.scene.add(g);
    this.crystals.push({ g, m, x, z, t: 0, cfg });
    this.log({ type: 'iceCrystal' });
  }

  // ---------- Boneco de Neve aliado ----------
  snowman(e, p, cfg) {
    const g = makeSnowman();
    g.position.set(e.position.x, 0, e.position.z);
    g.rotation.y = e.facing;
    g.scale.setScalar(0.01);
    this.scene.add(g);
    this.snowmen.push({ g, p, t: 0, cd: 0.6, cfg, x: e.position.x, z: e.position.z, throwT: 0 });
    this.c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), 0xffffff, 14);
    this.c.text.add('Boneco de Neve!', e.position, 'heal', 3.0);
    this.log({ type: 'iceSnowman', enemy: e });
  }

  // ---------- Pista de Gelo ----------
  rink(x, z, cfg) {
    this.rinks.push({ x, z, r: cfg.r, t: 0, life: cfg.life });
    this.c.vfx.ice(v3(x, 0, z), cfg.r, cfg.life);
    this.c.vfx.ice(v3(x, 0, z), cfg.r * 0.7, cfg.life);
    this.log({ type: 'iceRink', x, z });
  }
  inRink(x, z, pad = 0) { return this.rinks.some((k) => Math.hypot(x - k.x, z - k.z) < k.r + pad); }

  // ---------- Neblina ----------
  fog(x, z, cfg) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const parts = [];
    for (let i = 0; i < 16; i++) { // nuvem baixa azul-acinzentada
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * cfg.r * 0.8;
      const s = glow(i % 3 ? 0x9fb0c2 : 0xb8c6d4, 1, 0);
      s.material.blending = THREE.NormalBlending;
      s.position.set(Math.sin(a) * r, 0.3 + Math.random() * 1.1, Math.cos(a) * r);
      g.add(s); parts.push({ s, base: 2.2 + Math.random() * 1.6, sp: (Math.random() - 0.5) * 0.4 });
    }
    this.scene.add(g);
    this.fogs.push({ g, parts, t: 0, life: cfg.time, x, z, r: cfg.r });
  }

  // ---------- Iglu (o bloco em volta da Maga) ----------
  igloo(p) {
    const b = makeIceBlock(1.0, 2.9);
    b.position.set(p.position.x, 0, p.position.z);
    this.scene.add(b);
    return b;
  }

  update(dt) {
    const c = this.c;
    // Estátuas
    for (let i = this.statues.length - 1; i >= 0; i--) {
      const s = this.statues[i];
      s.t += dt;
      if (s.t >= s.life) { this.breakStatue(i); continue; }
      // Inimigo encostou no clone: congela e o clone quebra.
      const S = s.cfg;
      const e = c.enemies.find((o) => o !== s.src && o.alive && !o.undead && !o.data.phantom && !(o.frozenT > 0)
        && Math.hypot(o.position.x - s.x, o.position.z - s.z) < o.data.radius + s.r + S.touch);
      if (!e) continue;
      e.freeze(S.freeze * (e.data.boss ? 0.25 : 1), c);
      c.text.add('Congelou!', e.position, 'block', 3.0);
      this.log({ type: 'iceStatueTrap', enemy: e });
      this.breakStatue(i);
    }
    // Paredes: sobem rápido, ficam e derretem
    for (const w of [...this.walls]) {
      w.t += dt;
      const up = Math.min(1, w.t / 0.18);
      const sink = w.t > w.life - 0.3 ? (w.t - (w.life - 0.3)) * 4 : 0;
      for (const b of w.blocks) b.position.y = -1 * b.scale.y + up * 1.95 * b.scale.y - sink;
      if (w.t >= w.life) this.endWall(w);
    }
    // Estalagmites
    for (let i = this.spikes.length - 1; i >= 0; i--) {
      const s = this.spikes[i];
      s.t += dt;
      if (s.t < 0) continue;
      const k = Math.min(1, s.t / 0.12), sink = s.t > 1.1 ? (s.t - 1.1) * 3 : 0;
      for (const m of s.list) m.position.y = -1.5 + k * 1.5 - sink;
      if (!s.done) {
        s.done = true;
        audio.play('spikes', s.x, s.z);
        c.vfx.ring(v3(s.x, 0, s.z), 0x8fe3ff, s.cfg.hitR);
        let n = 0;
        for (const o of [...c.enemies]) {
          if (o === s.skip || !o.targetable) continue;
          const dx = o.position.x - s.x, dz = o.position.z - s.z, d = Math.hypot(dx, dz) || 0.01;
          if (d > s.cfg.hitR + o.data.radius) continue;
          c.bonusDamage(o, Math.max(1, Math.round(s.cfg.dmg * s.by.stats.damageMul)), dx / d, dz / d, 'block', s.by);
          if (o.alive) o.slow = Math.max(o.slow || 0, s.cfg.slow);
          n++;
        }
        this.log({ type: 'iceSpikes', n });
      }
      if (s.t > 1.5) { this.scene.remove(s.g); this.spikes.splice(i, 1); }
    }
    // Granizo
    for (let i = this.hail.length - 1; i >= 0; i--) {
      const h = this.hail[i], cfg = h.cfg;
      h.t -= dt; h.next -= dt;
      if (h.t <= 0 || h.p.state === 'dead') { this.hail.splice(i, 1); continue; }
      while (h.next <= 0) {
        h.next += cfg.every;
        const px = h.p.position.x, pz = h.p.position.z;
        const near = c.enemies.filter((o) => o.targetable && Math.hypot(o.position.x - px, o.position.z - pz) < cfg.r);
        let x, z;
        if (near.length && Math.random() < 0.65) { const o = near[Math.floor(Math.random() * near.length)]; x = o.position.x + (Math.random() - 0.5) * 0.8; z = o.position.z + (Math.random() - 0.5) * 0.8; }
        else { const a = Math.random() * Math.PI * 2, r = 1 + Math.sqrt(Math.random()) * (cfg.r - 1); x = px + Math.sin(a) * r; z = pz + Math.cos(a) * r; }
        const m = new THREE.Mesh(hailGeo, ICE_MAT);
        m.position.set(x, 9, z);
        this.scene.add(m);
        this.stones.push({ m, x, z, t: 0, fall: cfg.fall, p: h.p, cfg });
      }
    }
    for (let i = this.stones.length - 1; i >= 0; i--) {
      const s = this.stones[i];
      s.t += dt;
      const k = Math.min(1, s.t / s.fall);
      s.m.position.y = 9 * (1 - k * k) + 0.15;
      s.m.rotation.x += dt * 9; s.m.rotation.z += dt * 7;
      if (k < 1) continue;
      this.scene.remove(s.m); this.stones.splice(i, 1);
      c.vfx.sparks(v3(s.x, 0.3, s.z), 0xe4f6ff, 4);
      for (const o of [...c.enemies]) {
        if (!o.targetable || Math.hypot(o.position.x - s.x, o.position.z - s.z) > s.cfg.hitR + o.data.radius) continue;
        const dx = o.position.x - s.p.position.x, dz = o.position.z - s.p.position.z, d = Math.hypot(dx, dz) || 1;
        c.bonusDamage(o, Math.max(1, Math.round(s.cfg.dmg * s.p.stats.damageMul)), dx / d, dz / d, 'block', s.p);
        this.log({ type: 'iceHailHit', enemy: o });
      }
    }
    // Cristais: giram, quem passa perto pega
    for (let i = this.crystals.length - 1; i >= 0; i--) {
      const k = this.crystals[i];
      k.t += dt;
      k.m.rotation.y += dt * 2.5;
      k.g.position.y = 0.6 + Math.sin(k.t * 3) * 0.12;
      const who = c.players.find((p) => p.state !== 'dead' && Math.hypot(p.position.x - k.x, p.position.z - k.z) < k.cfg.pick);
      if (who || k.t > k.cfg.life) {
        this.scene.remove(k.g); this.crystals.splice(i, 1);
        if (!who) continue;
        const got = who.heal(k.cfg.heal);
        if (got) c.text.add(`+${got}`, who.position, 'heal');
        c.vfx.sparks(v3(k.x, 0.8, k.z), 0x7fe8ff, 10);
        audio.play('heal', k.x, k.z, { v: 0.6 });
        this.log({ type: 'iceCrystalPick', heal: got });
      }
    }
    // Bonecos de neve: jogam bolas no inimigo mais perto
    for (let i = this.snowmen.length - 1; i >= 0; i--) {
      const s = this.snowmen[i], cfg = s.cfg;
      s.t += dt; s.cd -= dt; s.throwT = Math.max(0, s.throwT - dt);
      s.g.scale.setScalar(Math.min(1, s.t / 0.25));
      s.g.userData.arms[1].rotation.z = -1.0 + s.throwT * 4;
      if (s.t >= cfg.time) {
        this.scene.remove(s.g); this.snowmen.splice(i, 1);
        c.vfx.sparks(v3(s.x, 1, s.z), 0xffffff, 16); c.vfx.puff(v3(s.x, 0, s.z));
        audio.play('thaw', s.x, s.z);
        continue;
      }
      let best = null, bd = cfg.range;
      for (const o of c.enemies) {
        if (!o.targetable) continue;
        const d = Math.hypot(o.position.x - s.x, o.position.z - s.z);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) s.g.rotation.y = Math.atan2(best.position.x - s.x, best.position.z - s.z);
      if (!best || s.cd > 0) continue;
      s.cd = cfg.every; s.throwT = 0.25;
      const a = s.g.rotation.y;
      const m = new THREE.Mesh(ballGeo, SNOW_MAT);
      const bx = s.x + Math.sin(a) * 0.5, bz = s.z + Math.cos(a) * 0.5;
      m.position.set(bx, 1.4, bz);
      this.scene.add(m);
      this.balls.push({ m, x: bx, z: bz, vx: Math.sin(a) * cfg.speed, vz: Math.cos(a) * cfg.speed, t: 0, target: best, p: s.p, cfg });
      audio.play('swing', s.x, s.z, { v: 0.4 });
    }
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.t += dt;
      if (b.target && b.target.targetable) { // segue o alvo de leve
        const want = Math.atan2(b.target.position.x - b.x, b.target.position.z - b.z), sp = Math.hypot(b.vx, b.vz);
        const cur = Math.atan2(b.vx, b.vz); let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d));
        const na = cur + Math.max(-6 * dt, Math.min(6 * dt, d)); b.vx = Math.sin(na) * sp; b.vz = Math.cos(na) * sp;
      }
      b.x += b.vx * dt; b.z += b.vz * dt;
      b.m.position.set(b.x, 1.4 - b.t * 0.8, b.z);
      const hit = c.enemies.find((o) => o.targetable && Math.hypot(o.position.x - b.x, o.position.z - b.z) < o.data.radius + 0.25);
      if (hit || b.t > 1.6 || c.world.blocked(b.x, b.z, 0.05, true)) {
        this.scene.remove(b.m); this.balls.splice(i, 1);
        c.vfx.sparks(v3(b.x, 1.2, b.z), 0xffffff, 6);
        if (!hit) continue;
        const sp = Math.hypot(b.vx, b.vz) || 1;
        c.bonusDamage(hit, Math.max(1, Math.round(b.cfg.dmg * b.p.stats.damageMul)), b.vx / sp, b.vz / sp, 'block', b.p);
        if (hit.alive) hit.slow = Math.max(hit.slow || 0, b.cfg.slow);
        this.log({ type: 'iceSnowball', enemy: hit });
      }
    }
    // Pista de Gelo: some sozinha
    for (let i = this.rinks.length - 1; i >= 0; i--) if ((this.rinks[i].t += dt) >= this.rinks[i].life) this.rinks.splice(i, 1);
    // Neblina
    for (let i = this.fogs.length - 1; i >= 0; i--) {
      const f = this.fogs[i];
      f.t += dt;
      const k = f.t / f.life;
      for (const q of f.parts) { q.s.scale.setScalar(q.base * (1 + k * 0.25)); q.s.position.x += q.sp * dt; q.s.material.opacity = 0.7 * Math.min(1, f.t * 5) * (1 - k * k * k); }
      if (k >= 1) { this.scene.remove(f.g); this.fogs.splice(i, 1); }
    }
  }

  clear() {
    for (const s of this.statues) this.scene.remove(s.g);
    for (const w of this.walls) { this.dropRects(w.rects); this.scene.remove(w.g); }
    for (const l of [this.spikes, this.crystals, this.snowmen, this.fogs]) for (const o of l) this.scene.remove(o.g);
    for (const l of [this.stones, this.balls]) for (const o of l) this.scene.remove(o.m);
    for (const l of [this.statues, this.walls, this.spikes, this.hail, this.stones, this.crystals, this.snowmen, this.balls, this.rinks, this.fogs]) l.length = 0;
  }
}
