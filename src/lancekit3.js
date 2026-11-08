// Bênçãos da Lança — efeitos que ficam na sala (métodos do LanceKit, lancekit2.js): Pregar na Parede, Para-raios,
// Estocada Fantasma, Espinhos de Pedra, Lança de Troféus, Cemitério de Lanças, Estandarte de Guerra e o update deles.
import * as THREE from 'three';
import { audio } from './audio.js';
import { instance } from './assets.js';
import { LANCE } from './lancekit.js';

const SPEAR = 'weapons/extra/spear_A.gltf';
const SKULL = 'props/crypt/skull.gltf';
export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const GHOST_MAT = new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
const STONE_MAT = new THREE.MeshLambertMaterial({ color: 0xb3a999 });
const SPIKE_GEO = new THREE.ConeGeometry(0.32, 1.3, 6).translate(0, 0.65, 0);
const FLAG_MAT = new THREE.MeshStandardMaterial({ color: 0xc8202a, side: THREE.DoubleSide, roughness: 0.8 });
const FLAG_GEO = new THREE.PlaneGeometry(0.85, 0.6, 6, 1).translate(0.45, 0, 0);

// Lança (modelo): deitada apontando para +Z (centro no meio do cabo), ou em pé com a ponta enterrada.
export function lying(ghost = false, scale = 1) {
  const g = new THREE.Group(), m = instance(SPEAR);
  m.rotation.x = Math.PI / 2; m.position.z = -1.05 * scale; m.scale.setScalar(scale);
  if (ghost) m.traverse((o) => { if (o.isMesh) { o.material = GHOST_MAT.clone(); o.material.userData.ghost = true; } });
  g.add(m);
  return g;
}
export function standing(ghost = false, bury = 0.45, scale = 1) {
  const g = new THREE.Group(), m = instance(SPEAR);
  m.rotation.x = Math.PI; m.position.y = (2.1 - bury) * scale; m.scale.setScalar(scale);
  if (ghost) m.traverse((o) => { if (o.isMesh) { o.material = GHOST_MAT.clone(); o.material.userData.ghost = true; } });
  g.add(m);
  return g;
}
export const fade = (g, k) => g.traverse((o) => { if (o.isMesh && o.material.transparent) o.material.opacity = 0.55 * k; });
export const dispose = (g) => {
  if (!g) return;
  if (g.parent) g.parent.remove(g);
  g.traverse((o) => { if (o.isMesh && o.material && o.material.userData && o.material.userData.ghost) o.material.dispose(); });
};


export const LANCE_FX = {
  // ---------- Pregar na Parede ----------
  nail(e, nx, nz, t) {
    let n = this.nails.get(e);
    if (!n) {
      const g = lying(true);
      g.position.set(e.position.x, 1.1, e.position.z);
      g.rotation.y = Math.atan2(nx, nz);
      g.children[0].position.z -= 0.75; // a ponta passa pelo corpo e entra na parede
      this.scene.add(g);
      n = { g };
      this.nails.set(e, n);
    }
    n.x = e.position.x; n.z = e.position.z; n.t = t;
  },

  // ---------- Para-raios ----------
  rodBolt(p, e) {
    const c = this.c, x = e.position.x, z = e.position.z;
    c.vfx.lightning(v3(x + 0.3, 11, z - 0.2), v3(x, 1.2, z), 0xbfe6ff, 0.3);
    c.vfx.ring(v3(x, 0, z), 0xbfe6ff, 1.4);
    audio.play('zap', x, z, { v: 1.2 });
    c.shakeFor(p, 0.15);
    c.text.add('Raio!', e.position, 'crit', 3.6);
    const dx = x - p.position.x, dz = z - p.position.z, d = Math.hypot(dx, dz) || 1;
    if (e.targetable) c.bonusDamage(e, Math.round(LANCE.rod.dmg * p.stats.damageMul), dx / d, dz / d, 'burn', p);
    if (e.alive && e.daze && !e.data.boss) e.daze(LANCE.rod.daze);
    this.log({ type: 'lanceRod', enemy: e });
  },

  // ---------- Estocada Fantasma ----------
  ghostStab(p, step) {
    const range = p.hero.attackRange * (p.stats.rangeMul || 1);
    const g = lying(true); const a = p.facing;
    g.rotation.y = a;
    g.position.set(p.position.x + Math.sin(a) * 0.5, 1.15, p.position.z + Math.cos(a) * 0.5);
    fade(g, 0.25);
    this.scene.add(g);
    this.ghosts.push({ p, g, x: p.position.x, z: p.position.z, a, range, dmg: step.damage * LANCE.ghost.mul, t: 0, fired: false });
  },

  // ---------- Espinhos de Pedra ----------
  spikeLine(p) {
    const S = LANCE.spikes, a = p.facing;
    const line = { p, a, x: p.position.x, z: p.position.z, d: S.from, hit: new Set(), done: false };
    this.spikes.push(line);
    audio.play('spikes', p.position.x, p.position.z, { v: 1 });
    this.log({ type: 'lanceSpikes' });
  },

  // ---------- Lança de Troféus ----------
  mountSkulls(p) {
    let list = this.mounts.get(p);
    if (!list) { list = []; this.mounts.set(p, list); }
    while (list.length > (p.lanceSkulls || 0)) dispose(list.pop());
    if (!p.weapon) return;
    while (list.length < (p.lanceSkulls || 0)) {
      const s = instance(SKULL);
      s.scale.setScalar(0.8);
      s.position.set(0, 1.05 + list.length * 0.32, 0);
      s.rotation.y = list.length * 1.7;
      p.weapon.add(s);
      list.push(s);
    }
  },
  throwSkulls(p) {
    const n = p.lanceSkulls || 0, T = LANCE.trophy;
    p.lanceSkulls = 0;
    this.mountSkulls(p);
    for (let i = 0; i < n; i++) {
      const a = p.facing + (i - (n - 1) / 2) * 0.35, dist = T.dist + (i % 2) * 0.8;
      let tx = p.position.x + Math.sin(a) * dist, tz = p.position.z + Math.cos(a) * dist;
      for (let k = dist; k > 1 && this.world.blocked(tx, tz, 0.3); k -= 0.5) { tx = p.position.x + Math.sin(a) * k; tz = p.position.z + Math.cos(a) * k; }
      const m = instance(SKULL); m.scale.setScalar(0.8);
      const fx = p.position.x + Math.sin(p.facing) * 1.2, fz = p.position.z + Math.cos(p.facing) * 1.2;
      m.position.set(fx, 2.2, fz);
      this.scene.add(m);
      this.bombs.push({ p, m, fx, fz, tx, tz, t: 0, T: T.fly + i * 0.06 });
    }
    if (n) { this.c.text.add('Troféus!', p.position, 'crit', 3.2); this.log({ type: 'lanceSkulls', n }); }
  },

  // ---------- Cemitério de Lanças ----------
  addGrave(p, x, z) {
    const G = LANCE.grave;
    while (this.graves.length >= G.max) dispose(this.graves.shift().g);
    const g = standing(true, 0.6, 0.8);
    g.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * 6, (Math.random() - 0.5) * 0.3);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.graves.push({ p, g, x, z, t: 0, cd: 0.6 });
    this.log({ type: 'lanceGrave' });
  },

  // ---------- Estandarte de Guerra ----------
  addBanner(p, x, z) {
    const B = LANCE.banner, g = standing(false, 0.5);
    const flag = new THREE.Mesh(FLAG_GEO, FLAG_MAT); flag.position.set(0.05, 1.3, 0); g.add(flag);
    const ring = new THREE.Mesh(new THREE.RingGeometry(B.r - 0.15, B.r, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.position.y = 0.12; g.add(ring);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.banners.push({ p, g, flag, ring, x, z, t: 0, tick: 0 });
    this.c.text.add('Estandarte!', { x, z }, 'gold', 3.4);
    audio.play('thump', x, z, { v: 0.9 });
    this.log({ type: 'lanceBanner' });
  },

  updateMisc(dt) {
    const c = this.c;
    // Pregados.
    for (const [e, n] of this.nails) {
      n.t -= dt;
      if (!e.alive || e.state !== 'hurt' || n.t <= 0) { dispose(n.g); this.nails.delete(e); continue; }
      e.position.x = n.x; e.position.z = n.z; e.vel.set(0, 0, 0);
      if (n.t < 0.3) fade(n.g, n.t / 0.3);
    }
    for (const fl of [...this.flashes]) { fl.t += dt; if (fl.t >= 0.18) { dispose(fl.g); this.flashes.splice(this.flashes.indexOf(fl), 1); } else fade(fl.g, 1 - fl.t / 0.18); }
    // Mil Lanças.
    for (const f of [...this.flurries]) {
      f.t -= dt;
      if (f.t > 0) continue;
      f.t = LANCE.flurry.gap;
      const p = f.p, e = f.e, s0 = p.hero.combo[0];
      if (!e.targetable || f.i >= LANCE.flurry.n || p.state === 'dead') { this.flurries.splice(this.flurries.indexOf(f), 1); continue; }
      f.i++;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      const g = lying(true, 0.9); g.rotation.y = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.2;
      g.position.set(p.position.x + dx / d * (d * 0.5), 1.0 + Math.random() * 0.5, p.position.z + dz / d * (d * 0.5));
      this.scene.add(g);
      this.flashes.push({ g, t: 0 });
      p.anim.play('Melee_2H_Attack_Stab', { once: true, restart: true, fade: 0.02, speed: 4 });
      c.damageEnemy(p, e, { ...s0, damage: s0.damage * LANCE.flurry.mul, lanceFx: 'flurry', pushMul: 0.15 }, dx / d, dz / d);
      audio.play('hit', e.position.x, e.position.z, { v: 0.5 });
    }
    // Estocadas fantasmas.
    for (const gh of [...this.ghosts]) {
      gh.t += dt;
      const D = LANCE.ghost.delay;
      if (!gh.fired && gh.t < D) { fade(gh.g, 0.25 + 0.5 * gh.t / D); continue; }
      if (!gh.fired) {
        gh.fired = true;
        const fx = Math.sin(gh.a), fz = Math.cos(gh.a);
        let n = 0;
        for (const e of [...c.enemies]) {
          if (!e.targetable) continue;
          const dx = e.position.x - gh.x, dz = e.position.z - gh.z, along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
          if (along < 0 || along > gh.range + e.data.radius || side > LANCE.ghost.w + e.data.radius) continue;
          c.bonusDamage(e, Math.max(1, Math.round(gh.dmg * gh.p.stats.damageMul)), fx, fz, 'dmg', gh.p);
          c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), 0x8fe3ff, 6);
          n++;
        }
        audio.play('swing', gh.x, gh.z, { v: 0.6 });
        this.log({ type: 'lanceGhost', n });
      }
      const k = (gh.t - D) / 0.3;
      if (k >= 1) { dispose(gh.g); this.ghosts.splice(this.ghosts.indexOf(gh), 1); continue; }
      const push = Math.min(1, k * 4) * 1.6;
      gh.g.position.set(gh.x + Math.sin(gh.a) * (0.5 + push), 1.15, gh.z + Math.cos(gh.a) * (0.5 + push));
      fade(gh.g, 1 - k);
    }
    // Cemitério de Lanças.
    const G = LANCE.grave;
    for (const gr of [...this.graves]) {
      gr.t += dt;
      if (gr.t > G.life) { dispose(gr.g); this.graves.splice(this.graves.indexOf(gr), 1); continue; }
      if (gr.t > G.life - 1) fade(gr.g, G.life - gr.t);
      if ((gr.cd -= dt) > 0) continue;
      for (const e of [...c.enemies]) {
        if (!e.targetable || Math.hypot(e.position.x - gr.x, e.position.z - gr.z) > G.r + e.data.radius) continue;
        gr.cd = G.rearm;
        c.vfx.sparks(v3(gr.x, 0.6, gr.z), 0x8fe3ff, 10);
        audio.play('hit', gr.x, gr.z, { v: 0.6 });
        c.bonusDamage(e, Math.round(G.dmg * gr.p.stats.damageMul), 0, 1, 'dmg', gr.p);
        if (e.alive && e.daze && !e.data.boss) e.daze(G.daze);
        this.log({ type: 'lanceGraveHit', enemy: e });
        break;
      }
    }
    // Estandartes.
    const B = LANCE.banner;
    for (const p of c.players) p.bannerBoost = 1;
    for (const bn of [...this.banners]) {
      bn.t += dt;
      if (bn.t >= B.time) { dispose(bn.g); this.banners.splice(this.banners.indexOf(bn), 1); continue; }
      bn.flag.rotation.y = 0.3 * Math.sin(bn.t * 5);
      bn.ring.material.opacity = 0.2 + 0.12 * Math.sin(bn.t * 4);
      bn.tick -= dt;
      const tick = bn.tick <= 0;
      if (tick) bn.tick = B.every;
      for (const p of c.players) {
        if (p.state === 'dead' || Math.hypot(p.position.x - bn.x, p.position.z - bn.z) > B.r) continue;
        p.bannerBoost = B.speed;
        if (tick && p.hp < p.maxHp) { const h = p.heal(B.heal); if (h) c.text.add(`+${h}`, p.position, 'heal small'); }
      }
    }
    // Espinhos de Pedra.
    const S = LANCE.spikes;
    for (const ln of [...this.spikes]) {
      if (ln.done) { if (!ln.cones.length) this.spikes.splice(this.spikes.indexOf(ln), 1); }
      ln.cones = ln.cones || [];
      if (!ln.done) {
        ln.d += S.speed * dt;
        while (!ln.done && (ln.next ?? S.from) <= ln.d) {
          const at = ln.next ?? S.from;
          ln.next = at + S.gap;
          const x = ln.x + Math.sin(ln.a) * at, z = ln.z + Math.cos(ln.a) * at;
          if (at > S.len || this.world.blocked(x, z, 0.2)) { ln.done = true; break; }
          for (let k = 0; k < 3; k++) {
            const m = new THREE.Mesh(SPIKE_GEO, STONE_MAT);
            m.position.set(x + (Math.random() - 0.5) * 0.6, -1.3, z + (Math.random() - 0.5) * 0.6);
            m.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * 6, (Math.random() - 0.5) * 0.4);
            m.scale.setScalar(0.7 + Math.random() * 0.5);
            this.scene.add(m);
            ln.cones.push({ m, t: 0 });
          }
          c.vfx.dust(v3(x, 0.1, z), v3(0, 0, 0), 3);
          for (const e of [...c.enemies]) {
            if (!e.targetable || ln.hit.has(e) || Math.hypot(e.position.x - x, e.position.z - z) > S.r + e.data.radius) continue;
            ln.hit.add(e);
            c.bonusDamage(e, Math.round(S.dmg * ln.p.stats.damageMul), Math.sin(ln.a), Math.cos(ln.a), 'dmg', ln.p);
            if (e.alive && e.daze && !e.data.boss) e.daze(S.daze);
            this.log({ type: 'lanceSpikeHit', enemy: e });
          }
        }
      }
      for (let i = ln.cones.length - 1; i >= 0; i--) {
        const cn = ln.cones[i];
        cn.t += dt;
        cn.m.position.y = cn.t < 0.12 ? -1.3 + 1.3 * (cn.t / 0.12) : cn.t < 0.8 ? 0 : -1.3 * Math.min(1, (cn.t - 0.8) / 0.3);
        if (cn.t > 1.1) { dispose(cn.m); ln.cones.splice(i, 1); }
      }
    }
    // Crânios-bomba.
    const T = LANCE.trophy;
    for (const b of [...this.bombs]) {
      b.t += dt;
      const k = Math.min(1, b.t / b.T);
      b.m.position.set(b.fx + (b.tx - b.fx) * k, 2.2 * (1 - k) + 3 * k * (1 - k) + 0.3 * k, b.fz + (b.tz - b.fz) * k);
      b.m.rotation.x += dt * 10;
      if (k < 1) continue;
      dispose(b.m);
      this.bombs.splice(this.bombs.indexOf(b), 1);
      c.vfx.heavyImpact(v3(b.tx, 0, b.tz), 1.0);
      c.vfx.sparks(v3(b.tx, 0.8, b.tz), 0xffb050, 14);
      audio.play('boom', b.tx, b.tz, { v: 0.7 });
      let n = 0;
      for (const e of [...c.enemies]) {
        if (!e.targetable) continue;
        const dx = e.position.x - b.tx, dz = e.position.z - b.tz, d = Math.hypot(dx, dz) || 0.01;
        if (d > T.r + e.data.radius) continue;
        c.bonusDamage(e, Math.round(T.dmg * b.p.stats.damageMul), dx / d, dz / d, 'dmg big', b.p);
        if (e.alive && e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(8 * (e.data.knockback ?? 1));
        n++;
      }
      this.log({ type: 'lanceSkullBoom', n });
    }
  },

};
