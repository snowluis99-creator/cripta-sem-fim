// Bênçãos do Cajado Elétrico — o que fica na sala: cargas da Polaridade, poças, torres, nuvem, fios da Rede,
// inimigos em Sobrecarga/ionizados, Blecaute, rastro do Passo Relâmpago, ossos voando, barras do Gerador e da Bateria,
// e o raio contínuo do Arco Voltaico. Números em elekit.js (ELE). Cada conjuração de raio passa por
// beginCast -> onRay/onJump/onStrikePoint -> endCast (magic.js).
import * as THREE from 'three';
import { audio } from './audio.js';
import { getGlowTexture } from './dungeon/builder.js';
import { spellHit } from './magic.js';
import { ELE, EW, isEle, setEleCombat } from './elekit.js';

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const BLUE = 0x7fd8ff, WHITE = 0xbff0ff, PLUS = 0xff5a4a, MINUS = 0x4a8aff;
const MOVABLE = ['chase', 'attack', 'hurt', 'block', 'recover'];
const movable = (e) => !!(e && e.alive && !e.data.boss && !e.undead && !e.immune && !(e.frozenT > 0) && MOVABLE.includes(e.state));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

const LINE_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const DISC_GEO = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2);
const CRYSTAL_GEO = new THREE.OctahedronGeometry(0.42, 0);
const PUFF_GEO = new THREE.SphereGeometry(1, 10, 8);
const BONE_GEO = new THREE.BoxGeometry(0.08, 0.08, 0.42);
const SHARED = new Set([LINE_GEO, DISC_GEO, CRYSTAL_GEO, PUFF_GEO, BONE_GEO]);

const addMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  s.scale.setScalar(size);
  return s;
}
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
function dispose(o) {
  o.traverse((x) => {
    if (x.material) (Array.isArray(x.material) ? x.material : [x.material]).forEach((m) => m.dispose());
    if (x.geometry && !SHARED.has(x.geometry)) x.geometry.dispose();
  });
}
const fx = (dmg) => ({ damage: dmg, heavy: false, eleFx: true }); // dano de efeito (não é "raio": não conta para cargas)

export class EleKit {
  constructor(combat) {
    setEleCombat(combat);
    this.c = combat;
    this.time = 0;
    this.cur = null;     // conjuração em andamento
    this.polFlip = 1;
    this.charged = new Set(); this.overloaded = new Set(); this.ionized = new Set();
    this.puddles = []; this.towers = []; this.wires = []; this.trails = []; this.bounces = []; this.bones = [];
    this.clouds = new Map(); this.batFx = new Map(); this.genFx = new Map();
    this.black = null;   // Blecaute em andamento
    this.built = null;   // sala atual (tochas)
  }

  get scene() { return this.c.scene; }
  log(o) { if (this.c.log) this.c.log(o); }
  setRoom(built) { this.endBlackout(); this.built = built; }
  zap(p, e, dmg, nx = 0, nz = 1, stagger = false) {
    if (!e || !e.targetable) return false;
    return this.c.damageEnemy(p, e, fx(dmg), nx, nz, { spell: true, noStagger: !stagger });
  }

  // ---------- Conjuração (magic.lightningCast) ----------
  beginCast(p, step) {
    const w = EW(p), combo = p.hero.combo, idx = combo.indexOf(step), last = idx === combo.length - 1;
    let s = step;
    if (w.eGen && p.eleGen > 0.05) { // Gerador: solta a energia guardada
      const k = p.eleGen, mul = 1 + ELE.gen.mul * k;
      s = { ...step, damage: step.damage * mul, cast: { ...step.cast, color: 0xfff4b0 } };
      this.c.text.add(`Gerador ${Math.round(k * 100)}%!`, p.position, 'crit', 3.4);
      this.c.vfx.ring(v3(p.position.x, 0, p.position.z), BLUE, 1.2 + k * 1.5);
      this.log({ type: 'eleGen', k, mul });
      p.eleGen = 0;
    }
    this.cur = { p, step: s, idx, last, hits: [], jumps: [], width: s === step ? 0.22 : 0.22 + 0.25 * (s.damage / step.damage - 1) };
    return this.cur;
  }

  endCast(tok) {
    if (!tok) return;
    this.cur = null;
    const p = tok.p, w = EW(p), c = this.c;
    const hits = [...new Set(tok.hits)].filter((e) => e.alive);
    if (w.eMag && hits.length > 1) this.magnet(hits);
    if (w.ePing && tok.hits.length > 1) this.queuePing(p, tok);
    if (w.eFriend) this.friendShock(p, tok);
    if (!tok.last) return;
    if (w.eIon) this.ionJump(p, tok);
    if (w.ePulse) this.pulse(p);
    if (w.eTesla) this.addTower(p);
    if (w.eCloud) this.addCloud(p);
    if (w.eBlack && !(p.eleBlackCd > 0)) this.blackout(p);
    void c;
  }

  // Ponto onde o raio acertou (ou terminou sem acertar): Poça Elétrica.
  onStrikePoint(p, x, z) {
    if (!EW(p).ePud) return;
    const P = ELE.pud;
    while (this.puddles.length >= P.max) this.dropPuddle(this.puddles[0]);
    const g = new THREE.Group();
    const disc = new THREE.Mesh(DISC_GEO, addMat(BLUE, 0.35)); disc.scale.setScalar(P.r); disc.position.y = 0.06;
    const core = new THREE.Mesh(DISC_GEO, addMat(WHITE, 0.25)); core.scale.setScalar(P.r * 0.5); core.position.y = 0.07;
    g.add(disc, core);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.puddles.push({ p, x, z, g, disc, t: P.t, tick: 0.15 });
  }
  dropPuddle(u) { this.puddles.splice(this.puddles.indexOf(u), 1); this.scene.remove(u.g); dispose(u.g); }
  updatePuddles(dt) {
    const P = ELE.pud;
    for (const u of [...this.puddles]) {
      u.t -= dt; u.tick -= dt;
      u.disc.material.opacity = 0.25 + 0.2 * Math.random() * Math.min(1, u.t);
      if (u.t <= 0) { this.dropPuddle(u); continue; }
      if (Math.random() < dt * 6) this.c.vfx.sparks(v3(u.x + (Math.random() - 0.5) * P.r, 0.2, u.z + (Math.random() - 0.5) * P.r), BLUE, 2);
      if (u.tick > 0) continue;
      u.tick = P.tick;
      for (const e of [...this.c.enemies]) {
        if (!e.targetable || Math.hypot(e.position.x - u.x, e.position.z - u.z) > P.r + e.data.radius * 0.6) continue;
        if (this.zap(u.p, e, P.dmg)) this.log({ type: 'elePuddle', enemy: e });
      }
    }
  }

  // Raio pulou de A para B (corrente ou Atravessar): Rede Elétrica.
  onJump(p, a, b) {
    if (this.cur) this.cur.jumps.push([a, b]);
    if (!EW(p).eNet || !a || !b || a === b) return;
    const N = ELE.net;
    const old = this.wires.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (old) { old.t = N.t; return; }
    while (this.wires.length >= N.max) this.dropWire(this.wires[0]);
    const m = new THREE.Mesh(LINE_GEO, addMat(BLUE, 0.9));
    this.scene.add(m);
    this.wires.push({ p, a, b, m, t: N.t, tick: N.tick, pa: a.position.clone(), pb: b.position.clone() });
    this.log({ type: 'eleWire' });
  }
  dropWire(x) { this.wires.splice(this.wires.indexOf(x), 1); this.scene.remove(x.m); x.m.material.dispose(); }
  updateWires(dt) {
    const N = ELE.net;
    for (const x of [...this.wires]) {
      x.t -= dt; x.tick -= dt;
      if (x.a.alive) x.pa.copy(x.a.position);
      if (x.b.alive) x.pb.copy(x.b.position);
      if (x.t <= 0 || (!x.a.alive && !x.b.alive)) { this.dropWire(x); continue; }
      placeSeg(x.m, x.pa, x.pb, 1.3, 0.06 + 0.1 * Math.random());
      x.m.material.opacity = 0.5 + 0.5 * Math.random();
      if (x.tick > 0) continue;
      x.tick = N.tick;
      for (const e of [...this.c.enemies]) {
        if (e === x.a || e === x.b || !e.targetable) continue;
        if (segDist(e.position.x, e.position.z, x.pa, x.pb) > e.data.radius + 0.25) continue;
        if (this.zap(x.p, e, N.dmg)) {
          this.c.vfx.sparks(v3(e.position.x, 1.3, e.position.z), BLUE, 5);
          this.log({ type: 'eleWireHit', enemy: e });
        }
      }
    }
  }

  // ---------- Cada raio que acerta um inimigo (magic.spellHit) ----------
  onRay(p, e, step, r) {
    const w = EW(p), c = this.c;
    if (this.cur && this.cur.p === p) this.cur.hits.push(e);
    if (r === 'kill' || !e.alive) {
      if (w.eBones) this.throwBones(p, e);
      return;
    }
    if (w.eBat) p.eleBat = Math.min(ELE.bat.max, (p.eleBat || 0) + 1); // Bateria
    if (w.ePol) this.charge(p, e);
    if (w.eIon) this.ionize(e);
    if (w.eOver && !(e.eleOverT > 0)) { // Sobrecarga
      e.eleHits = (e.eleHits || 0) + 1;
      if (e.eleHits >= ELE.over.hits) {
        e.eleHits = 0; e.eleOverT = ELE.over.t; e.eleOverBy = p; e.eleOverAt = e.position.clone();
        this.overloaded.add(e);
        c.text.add('Sobrecarga!', e.position, 'crit', 3.4);
        this.log({ type: 'eleOverload', enemy: e });
      }
    }
    if (w.eShort && e.data.shield && !e.shieldBroken) { // Curto-Circuito: o escudo passa o choque para quem encosta
      const from = v3(e.position.x, 1.2, e.position.z);
      for (const o of [...c.enemies]) {
        if (o === e || !o.targetable) continue;
        const d = Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z);
        if (d > e.data.radius + o.data.radius + ELE.short.touch) continue;
        c.vfx.bolt(from, v3(o.position.x, 1.2, o.position.z), BLUE);
        if (this.zap(p, o, step.damage, (o.position.x - e.position.x) / (d || 1), (o.position.z - e.position.z) / (d || 1), true)) this.log({ type: 'eleShortPass', enemy: o });
      }
    }
    if (w.ePup) this.puppet(p, e); // Marionete
  }

  // ---------- Polaridade ----------
  charge(p, e) {
    if (!e.elePol) {
      this.polFlip = -this.polFlip;
      e.elePol = this.polFlip;
      const sc = e.group.scale.x || 1, s = glow(e.elePol > 0 ? PLUS : MINUS, 1.0 / sc, 0.95);
      s.position.y = 2.9 / sc;
      e.group.add(s); e.elePolFx = s;
    }
    e.elePolT = ELE.pol.t; e.elePolBy = p;
    this.charged.add(e);
  }
  uncharge(e) {
    this.charged.delete(e);
    e.elePol = 0; e.elePolT = 0;
    if (e.elePolFx) { e.group.remove(e.elePolFx); e.elePolFx.material.dispose(); e.elePolFx = null; }
  }
  updateCharges(dt) {
    const P = ELE.pol, c = this.c, list = [];
    for (const e of [...this.charged]) {
      e.elePolT -= dt;
      if (!e.alive || e.elePolT <= 0 || !c.enemies.includes(e)) { this.uncharge(e); continue; }
      if (e.elePolFx) e.elePolFx.scale.setScalar((1.0 + 0.15 * Math.sin(this.time * 12)) / (e.group.scale.x || 1));
      if (e.targetable) list.push(e);
    }
    const bang = new Set();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (bang.has(a) || bang.has(b)) continue;
        const dx = b.position.x - a.position.x, dz = b.position.z - a.position.z, d = Math.hypot(dx, dz) || 0.01;
        if (d > P.range) continue;
        const nx = dx / d, nz = dz / d;
        if (a.elePol !== b.elePol) { // opostos: se puxam e batem um no outro
          if (d <= a.data.radius + b.data.radius + 0.3) {
            bang.add(a); bang.add(b);
            const by = a.elePolBy || b.elePolBy;
            this.zap(by, a, P.dmg, -nx, -nz, true); this.zap(by, b, P.dmg, nx, nz, true);
            for (const e of [a, b]) if (e.alive && !e.data.boss && e.daze) e.daze(P.daze);
            const mid = v3((a.position.x + b.position.x) / 2, 1.3, (a.position.z + b.position.z) / 2);
            c.vfx.sparks(mid, 0xffffff, 14); c.vfx.ring(v3(mid.x, 0, mid.z), BLUE, 1.6);
            audio.play('hitHeavy', mid.x, mid.z, { v: 0.8 });
            c.text.add('Pá!', mid, 'crit', 3.0);
            this.log({ type: 'elePolBang', a, b });
            continue;
          }
          if (movable(a)) a.vel.addScaledVector(v3(nx, 0, nz), P.pull * dt);
          if (movable(b)) b.vel.addScaledVector(v3(-nx, 0, -nz), P.pull * dt);
        } else if (d < P.repel) { // iguais: se empurram
          if (movable(a)) a.vel.addScaledVector(v3(-nx, 0, -nz), P.push * dt);
          if (movable(b)) b.vel.addScaledVector(v3(nx, 0, nz), P.push * dt);
        }
      }
    }
    for (const e of bang) this.uncharge(e); // a batida gasta as cargas
  }

  // ---------- Ímã ----------
  magnet(hits) {
    const M = ELE.mag;
    let cx = 0, cz = 0;
    for (const e of hits) { cx += e.position.x; cz += e.position.z; }
    cx /= hits.length; cz /= hits.length;
    let n = 0;
    for (const e of hits) {
      if (!movable(e)) continue;
      const dx = cx - e.position.x, dz = cz - e.position.z, d = Math.hypot(dx, dz);
      if (d < 0.3) continue;
      e.vel.set(dx / d, 0, dz / d).multiplyScalar(Math.min(M.max, d * M.k));
      n++;
    }
    if (n) this.c.vfx.ring(v3(cx, 0, cz), BLUE, 1.4);
    this.log({ type: 'eleMagnet', n });
  }

  // ---------- Ping-Pong: o raio volta para quem já acertou ----------
  // Os quiques quase não empurram: senão os dois se afastam e o quique para.
  queuePing(p, tok) {
    const G = ELE.ping;
    const lastHit = tok.hits[tok.hits.length - 1];
    this.bounces.push({ p, step: { ...tok.step, damage: tok.step.damage * G.mul, pushMul: 0.15 }, from: lastHit, left: G.n, t: G.gap, chain: (tok.step.cast && tok.step.cast.chain) || 3 });
  }
  updateBounces(dt) {
    for (const b of [...this.bounces]) {
      b.t -= dt;
      if (b.t > 0) continue;
      const from = b.from;
      let best = null, bd = Infinity;
      if (from && from.alive) {
        for (const o of this.c.enemies) {
          if (o === from || !o.targetable) continue;
          const d = dist(o.position, from.position);
          if (d <= b.chain + o.data.radius && d < bd) { bd = d; best = o; }
        }
      }
      if (!best) { this.bounces.splice(this.bounces.indexOf(b), 1); continue; }
      this.c.vfx.lightning(v3(from.position.x, 1.3, from.position.z), v3(best.position.x, 1.3, best.position.z), BLUE, 0.16);
      const dx = best.position.x - from.position.x, dz = best.position.z - from.position.z, d = Math.hypot(dx, dz) || 1;
      spellHit(this.c, b.p, best, b.step, dx / d, dz / d);
      audio.play('zap', best.position.x, best.position.z, { v: 0.5 });
      this.log({ type: 'elePing', enemy: best });
      b.from = best; b.left--; b.t = ELE.ping.gap;
      if (b.left <= 0) this.bounces.splice(this.bounces.indexOf(b), 1);
    }
  }

  // ---------- Ionizar ----------
  ionize(e) {
    e.eleIonT = ELE.ion.t;
    if (!e.eleIonFx) {
      const sc = e.group.scale.x || 1, s = glow(BLUE, 2.2 / sc, 0.35);
      s.position.y = 1.2 / sc;
      e.group.add(s); e.eleIonFx = s;
    }
    this.ionized.add(e);
  }
  unionize(e) {
    this.ionized.delete(e);
    e.eleIonT = 0;
    if (e.eleIonFx) { e.group.remove(e.eleIonFx); e.eleIonFx.material.dispose(); e.eleIonFx = null; }
  }
  updateIons(dt) {
    for (const e of [...this.ionized]) {
      e.eleIonT -= dt;
      if (!e.alive || e.eleIonT <= 0 || !this.c.enemies.includes(e)) { this.unionize(e); continue; }
      if (e.eleIonFx) e.eleIonFx.material.opacity = 0.2 + 0.25 * Math.random();
    }
  }
  ionJump(p, tok) {
    const range = (tok.step.cast && tok.step.cast.chain) || 3, done = new Set();
    let n = 0;
    for (const src of [...this.ionized]) {
      if (!src.alive || !src.targetable) continue;
      for (const o of [...this.c.enemies]) {
        if (o === src || done.has(o) || !o.targetable) continue;
        const dx = o.position.x - src.position.x, dz = o.position.z - src.position.z, d = Math.hypot(dx, dz) || 0.01;
        if (d > range + o.data.radius) continue;
        done.add(o);
        this.c.vfx.lightning(v3(src.position.x, 1.3, src.position.z), v3(o.position.x, 1.3, o.position.z), BLUE, 0.15);
        if (spellHit(this.c, p, o, tok.step, dx / d, dz / d)) n++;
      }
    }
    this.log({ type: 'eleIonJump', n });
  }

  // ---------- Pulso Magnético ----------
  pulse(p) {
    const c = this.c, L = c.projectiles.list;
    let n = 0;
    for (const a of [...L]) {
      if (!a || a.hits !== 'player' || a.stuck >= 0) continue;
      c.axe.reflect(a, p);
      n++;
    }
    c.vfx.ring(v3(p.position.x, 0, p.position.z), BLUE, 6);
    c.vfx.ring(v3(p.position.x, 0, p.position.z), WHITE, 3.5);
    if (n) c.text.add('Pulso Magnético!', p.position, 'crit', 3.6);
    this.log({ type: 'elePulse', n });
  }

  // ---------- Torre Tesla ----------
  addTower(p) {
    const T = ELE.tesla, mine = this.towers.filter((x) => x.p === p);
    if (mine.length >= T.max) this.dropTower(mine[0]);
    const a = p.facing, x0 = p.position.x + Math.sin(a) * 1.3, z0 = p.position.z + Math.cos(a) * 1.3;
    const wd = this.c.world, x = wd && wd.blocked(x0, z0, 0.3) ? p.position.x : x0, z = wd && wd.blocked(x0, z0, 0.3) ? p.position.z : z0;
    const g = new THREE.Group();
    const cr = new THREE.Mesh(CRYSTAL_GEO, new THREE.MeshBasicMaterial({ color: 0xd8f6ff }));
    cr.scale.set(0.8, 1.6, 0.8); cr.position.y = 0.9;
    const gl = glow(BLUE, 2.4, 0.8); gl.position.y = 1.0;
    const base = new THREE.Mesh(DISC_GEO, addMat(BLUE, 0.4)); base.scale.setScalar(0.7); base.position.y = 0.05;
    g.add(cr, gl, base);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.towers.push({ p, x, z, g, cr, gl, t: T.t, tick: 0.25 });
    this.c.vfx.sparks(v3(x, 0.8, z), BLUE, 12);
    this.log({ type: 'eleTower' });
  }
  dropTower(t) { this.towers.splice(this.towers.indexOf(t), 1); this.scene.remove(t.g); dispose(t.g); this.c.vfx.sparks(v3(t.x, 1, t.z), BLUE, 8); }
  updateTowers(dt) {
    const T = ELE.tesla;
    for (const t of [...this.towers]) {
      t.t -= dt; t.tick -= dt;
      t.cr.rotation.y += dt * 2;
      t.gl.material.opacity = 0.5 + 0.4 * Math.random();
      if (t.t <= 0) { this.dropTower(t); continue; }
      if (t.tick > 0) continue;
      t.tick = T.tick;
      const near = this.c.enemies.filter((e) => e.targetable && Math.hypot(e.position.x - t.x, e.position.z - t.z) <= T.range + e.data.radius)
        .sort((a, b) => Math.hypot(a.position.x - t.x, a.position.z - t.z) - Math.hypot(b.position.x - t.x, b.position.z - t.z)).slice(0, T.n);
      for (const e of near) {
        this.c.vfx.lightning(v3(t.x, 1.6, t.z), v3(e.position.x, 1.2, e.position.z), BLUE, 0.14);
        const dx = e.position.x - t.x, dz = e.position.z - t.z, d = Math.hypot(dx, dz) || 1;
        this.zap(t.p, e, T.dmg, dx / d, dz / d, true);
      }
      if (near.length) { audio.play('zap', t.x, t.z, { v: 0.5 }); this.log({ type: 'eleTowerZap', n: near.length }); }
    }
  }

  // ---------- Nuvem Pessoal ----------
  addCloud(p) {
    const old = this.clouds.get(p);
    if (old) { old.t = ELE.cloud.t; return; }
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x5a6070, emissive: 0x1a2a3a, transparent: true, opacity: 0.32, depthWrite: false }); // bem transparente: não tampa os inimigos
    for (const [x, y, z, s] of [[0, 0, 0, 0.75], [0.7, -0.05, 0.1, 0.55], [-0.7, -0.05, -0.05, 0.6], [0.25, 0.3, -0.25, 0.5], [-0.3, 0.25, 0.3, 0.5]]) {
      const m = new THREE.Mesh(PUFF_GEO, mat); m.position.set(x, y, z); m.scale.set(s, s * 0.75, s); g.add(m);
    }
    const gl = glow(BLUE, 2.2, 0.0); g.add(gl);
    g.position.set(p.position.x, ELE.cloud.h, p.position.z);
    g.scale.setScalar(0.75);
    this.scene.add(g);
    this.clouds.set(p, { p, g, gl, mat, t: ELE.cloud.t, tick: 0.3 });
    this.c.text.add('Nuvem!', p.position, 'crit', 3.4);
    this.log({ type: 'eleCloud' });
  }
  dropCloud(p) {
    const k = this.clouds.get(p);
    if (!k) return;
    this.scene.remove(k.g); dispose(k.g);
    this.clouds.delete(p);
  }
  updateClouds(dt) {
    const N = ELE.cloud;
    for (const [p, k] of [...this.clouds]) {
      k.t -= dt; k.tick -= dt;
      if (k.t <= 0 || p.state === 'dead') { this.c.vfx.smoke(v3(k.g.position.x, N.h, k.g.position.z), 0x8890a0, 8); this.dropCloud(p); continue; }
      const f = 1 - Math.exp(-6 * dt);
      k.g.position.x += (p.position.x - 0.6 - k.g.position.x) * f;
      k.g.position.z += (p.position.z + 0.2 - k.g.position.z) * f;
      k.g.position.y = N.h + Math.sin(this.time * 2) * 0.12;
      k.g.rotation.y += dt * 0.6;
      k.gl.material.opacity = Math.max(0, k.gl.material.opacity - dt * 3);
      k.mat.opacity = 0.32 * Math.min(1, k.t / 0.4);
      if (k.tick > 0) continue;
      let best = null, bd = Infinity;
      for (const e of this.c.enemies) {
        if (!e.targetable) continue;
        const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
        if (d <= N.range + e.data.radius && d < bd) { bd = d; best = e; }
      }
      if (!best) { k.tick = 0.15; continue; }
      k.tick = N.tick;
      k.gl.material.opacity = 0.9;
      this.c.vfx.lightning(k.g.position.clone(), v3(best.position.x, 1.2, best.position.z), WHITE, 0.18);
      this.zap(p, best, N.dmg, 0, 1, true);
      audio.play('zap', best.position.x, best.position.z, { v: 0.6 });
      this.log({ type: 'eleCloudZap', enemy: best });
    }
  }

  // ---------- Marionete ----------
  puppet(p, e) {
    if (!e.alive || e.data.boss || e.undead || e.immune || e.state !== 'hurt' || (e.elePupAt || -99) > this.time) return;
    let best = null, bd = ELE.pup.reach + 1.2;
    for (const o of this.c.enemies) {
      if (o === e || !o.targetable || o.undead) continue;
      const d = Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) - o.data.radius;
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) return;
    e.elePupAt = this.time + ELE.pup.cd;
    e.releaseToken();
    e.setState('elePuppet');
    e.elePup = { t: 0, target: best, hit: false, by: p, reach: ELE.pup.reach, dmg: Math.max(1, Math.round(e.damage || e.data.damage || 8)) };
    const a = e.data.attack;
    e.anim.play(a.clip, { once: true, restart: true, fade: 0.05, speed: (a.speed || 1) * 1.4 });
    this.c.text.add('Marionete!', e.position, 'crit', 3.2);
    this.c.vfx.sparks(v3(e.position.x, 1.5, e.position.z), BLUE, 8);
    this.log({ type: 'elePuppet', enemy: e, target: best });
  }

  // ---------- Sobrecarga ----------
  updateOverloads(dt) {
    const O = ELE.over, c = this.c;
    for (const e of [...this.overloaded]) {
      e.eleOverT -= dt;
      if (e.alive) e.eleOverAt.copy(e.position);
      if (e.alive && Math.random() < dt * 14) c.vfx.sparks(v3(e.position.x, 0.6 + Math.random() * 1.6, e.position.z), Math.random() < 0.5 ? BLUE : 0xffffff, 3);
      if (e.alive) e.flash = Math.max(e.flash, 0.3 + 0.4 * Math.random());
      if (e.eleOverT > 0) continue;
      this.overloaded.delete(e);
      const at = e.eleOverAt, by = e.eleOverBy;
      e.eleOverT = 0;
      c.vfx.heavyImpact(v3(at.x, 0, at.z), O.r / 2.3);
      c.vfx.ring(v3(at.x, 0, at.z), BLUE, O.r);
      c.vfx.sparks(v3(at.x, 1.2, at.z), 0xffffff, 18);
      audio.play('boom', at.x, at.z, { v: 0.8 });
      let n = 0;
      for (const o of [...c.enemies]) {
        if (!o.targetable) continue;
        const dx = o.position.x - at.x, dz = o.position.z - at.z, d = Math.hypot(dx, dz) || 0.01;
        if (d > O.r + o.data.radius) continue;
        if (this.zap(by, o, O.dmg, dx / d, dz / d, true)) n++;
      }
      this.log({ type: 'eleOverBoom', n });
    }
  }

  // ---------- Blecaute ----------
  blackout(p) {
    const c = this.c, B = ELE.black;
    p.eleBlackCd = B.cd;
    let n = 0;
    for (const e of c.enemies) {
      if (!e.alive || e.data.boss || e.undead || e.immune || e.frozenT > 0 || !MOVABLE.includes(e.state)) continue;
      e.releaseToken();
      e.setState('eleLost');
      e.eleLost = { t: B.t * (0.85 + Math.random() * 0.3), ang: Math.random() * Math.PI * 2, turn: 0, speed: B.speed };
      n++;
    }
    if (!this.black) {
      const built = this.built, torches = built && built.torches;
      const lamp = torches ? torches.find((t) => t.sprite && t.light.visible) : null;
      this.black = { t: B.t, p, lamp, save: lamp ? { pos: lamp.light.position.clone(), color: lamp.light.color.getHex(), dist: lamp.light.distance } : null };
      if (lamp) { lamp.borrowed = true; lamp.light.color.setHex(0x9fe4ff); lamp.light.distance = 10; }
    } else { this.black.t = B.t; this.black.p = p; }
    c.text.add('Blecaute!', p.position, 'crit', 3.8);
    audio.play('zap', p.position.x, p.position.z, { v: 1.2 });
    this.log({ type: 'eleBlackout', n });
  }
  updateBlackout(dt) {
    const B = this.black, built = this.built;
    const target = B ? 0 : 1;
    if (built && built.light) {
      const k = built.light;
      k.dim += (target - k.dim) * Math.min(1, dt * (B ? 10 : 3));
      if (Math.abs(k.dim - target) < 0.01) k.dim = target;
    }
    if (!B) return;
    B.t -= dt;
    const p = B.p;
    if (B.lamp && built && built.group) {
      const wp = v3(p.position.x, 2.4, p.position.z);
      built.group.worldToLocal(wp);
      B.lamp.light.position.copy(wp);
      B.lamp.light.intensity = 18 + 3 * Math.sin(this.time * 20);
    }
    if (B.t <= 0) this.endBlackout();
  }
  endBlackout() {
    const B = this.black;
    if (!B) return;
    if (B.lamp && B.save) {
      B.lamp.borrowed = false;
      B.lamp.light.position.copy(B.save.pos); B.lamp.light.color.setHex(B.save.color); B.lamp.light.distance = B.save.dist;
    }
    this.black = null;
  }

  // ---------- Passo Relâmpago ----------
  dash(p) {
    const c = this.c, D = ELE.dash, wd = c.world;
    if (p.ctl) p.ctl.moveDir(p.dodgeDir);
    if (p.dodgeDir.lengthSq() === 0) p.dodgeDir.set(Math.sin(p.facing), 0, Math.cos(p.facing)); else p.dodgeDir.normalize();
    const dx = p.dodgeDir.x, dz = p.dodgeDir.z, x0 = p.position.x, z0 = p.position.z, r = p.hero.radius * 0.8;
    const len = D.dist * (p.stats.dodgeMul || 1);
    let x = x0, z = z0;
    for (let s = 0.25; s <= len + 1e-6; s += 0.25) {
      const nx = x0 + dx * s, nz = z0 + dz * s;
      if (wd && wd.blocked(nx, nz, r)) break;
      x = nx; z = nz;
    }
    p.position.x = x; p.position.z = z;
    if (wd) wd.resolveCircle(p.position, p.hero.radius);
    const a = { x: x0, z: z0 }, b = { x: p.position.x, z: p.position.z };
    c.vfx.lightning(v3(x0, 1.1, z0), v3(b.x, 1.1, b.z), BLUE, 0.3);
    // Quem estava no caminho leva o choque na hora.
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable || segDist(e.position.x, e.position.z, a, b) > e.data.radius + 0.6) continue;
      if (this.zap(p, e, D.hit, dx, dz, true)) n++;
    }
    // Rastro no chão.
    const m = new THREE.Mesh(LINE_GEO, addMat(BLUE, 0.7));
    placeSeg(m, a, b, 0.07, D.w);
    this.scene.add(m);
    this.trails.push({ p, a, b, m, t: D.t, tick: D.tick });
    p.facing = Math.atan2(dx, dz); p.group.rotation.y = p.facing;
    p.iframes = Math.max(p.iframes || 0, 0.3);
    p.combo = 0; p.queued = false;
    p.setState('idle'); p.anim.play(p.hero.anims.idle, { fade: 0.1 });
    p.dodgeCooldown = p.hero.dodge.cooldown;
    audio.play('zap', p.position.x, p.position.z, { v: 1.1 });
    this.log({ type: 'eleDash', d: Math.hypot(b.x - x0, b.z - z0), n });
    return true;
  }
  updateTrails(dt) {
    const D = ELE.dash;
    for (const tr of [...this.trails]) {
      tr.t -= dt; tr.tick -= dt;
      tr.m.material.opacity = Math.min(0.7, tr.t) * (0.6 + 0.4 * Math.random());
      if (tr.t <= 0) { this.trails.splice(this.trails.indexOf(tr), 1); this.scene.remove(tr.m); tr.m.material.dispose(); continue; }
      if (tr.tick > 0) continue;
      tr.tick = D.tick;
      for (const e of [...this.c.enemies]) {
        if (!e.targetable || segDist(e.position.x, e.position.z, tr.a, tr.b) > e.data.radius + D.w / 2) continue;
        if (this.zap(tr.p, e, D.dmg)) { this.c.vfx.sparks(v3(e.position.x, 0.4, e.position.z), BLUE, 4); this.log({ type: 'eleTrail', enemy: e }); }
      }
    }
  }

  // ---------- Para-choque (combat.separate): true = o choque segura o esbarrão ----------
  bumper(p, e) {
    if (!isEle(p) || !EW(p).eBump) return false;
    if ((e.eleBumpAt || -99) > this.time) return true;
    const B = ELE.bump;
    e.eleBumpAt = this.time + B.cd;
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01, nx = dx / d, nz = dz / d;
    this.zap(p, e, B.dmg, nx, nz, false);
    if (e.alive) {
      if (!e.data.boss && e.daze) e.daze(B.daze);
      e.vel.set(nx, 0, nz).multiplyScalar(B.push * (e.data.boss ? 0.3 : Math.max(0.6, e.data.knockback ?? 1)));
    }
    this.c.vfx.sparks(v3(p.position.x + nx * 0.6, 1.1, p.position.z + nz * 0.6), BLUE, 12);
    audio.play('zap', p.position.x, p.position.z, { v: 0.7 });
    this.log({ type: 'eleBump', enemy: e });
    return true;
  }

  // ---------- Bateria (combat.hitPlayer): a Maga tomou dano ----------
  onHurt(p, e) {
    if (!isEle(p) || !EW(p).eBat || !(p.eleBat > 0)) return;
    if (!e || !e.targetable || e.undead || !this.c.enemies.includes(e)) return;
    const n = p.eleBat, dmg = n * ELE.bat.per;
    p.eleBat = 0;
    this.c.vfx.lightning(v3(p.position.x, 1.4, p.position.z), v3(e.position.x, 1.2, e.position.z), WHITE, 0.3);
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
    this.zap(p, e, dmg, dx / d, dz / d, true);
    this.c.text.add(`Bateria ×${n}!`, p.position, 'crit', 3.4);
    audio.play('zap', p.position.x, p.position.z, { v: 1.2 });
    this.log({ type: 'eleBattery', n, dmg, enemy: e });
  }

  // ---------- Ossos Magnéticos ----------
  throwBones(p, dead) {
    const B = ELE.bones, from = dead.position;
    let best = null, bd = B.range;
    for (const o of this.c.enemies) {
      if (o === dead || !o.targetable) continue;
      const d = dist(o.position, from);
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) return;
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xf2ecd8 });
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(BONE_GEO, mat);
      m.position.set((i - 1) * 0.22, (i % 2) * 0.15, 0); m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      g.add(m);
    }
    g.add(glow(BLUE, 1.6, 0.8));
    g.position.set(from.x, 1.2, from.z);
    this.scene.add(g);
    this.bones.push({ p, g, target: best, t: B.life });
    this.log({ type: 'eleBones', target: best });
  }
  updateBones(dt) {
    const B = ELE.bones;
    for (const b of [...this.bones]) {
      b.t -= dt;
      const tg = b.target;
      const done = () => { this.bones.splice(this.bones.indexOf(b), 1); this.scene.remove(b.g); dispose(b.g); };
      if (b.t <= 0 || !tg || !tg.targetable) { done(); continue; }
      const dx = tg.position.x - b.g.position.x, dz = tg.position.z - b.g.position.z, d = Math.hypot(dx, dz) || 0.01;
      b.g.rotation.x += dt * 14; b.g.rotation.y += dt * 9;
      if (d <= tg.data.radius + 0.3) {
        this.zap(b.p, tg, B.dmg, dx / d, dz / d, true);
        this.c.vfx.sparks(v3(tg.position.x, 1.2, tg.position.z), 0xffffff, 10);
        audio.play('crunch', tg.position.x, tg.position.z, { v: 0.7 });
        this.log({ type: 'eleBonesHit', enemy: tg });
        done(); continue;
      }
      const s = Math.min(d, B.speed * dt);
      b.g.position.x += dx / d * s; b.g.position.z += dz / d * s;
    }
  }

  // ---------- Choque Amigo (co-op) ----------
  friendShock(p, tok) {
    const F = ELE.friend, range = (tok.step.cast && tok.step.cast.chain) || 3;
    for (const o of this.c.players) {
      if (o === p || o.state === 'dead' || (o.eleFriendAt || -99) > this.time) continue;
      const src = tok.hits.find((e) => dist(e.position, o.position) <= range + o.hero.radius);
      if (!src) continue;
      o.eleFriendAt = this.time + F.cd;
      o.eleHasteT = F.haste;
      const h = o.heal(F.heal);
      this.c.vfx.lightning(v3(src.position.x, 1.3, src.position.z), v3(o.position.x, 1.3, o.position.z), 0x9dffb0, 0.16);
      if (h) this.c.text.add(`+${h}`, o.position, 'heal');
      this.c.text.add('Choque Amigo!', o.position, 'crit', 3.2);
      this.log({ type: 'eleFriend', heal: h });
    }
  }

  // ---------- Arco Voltaico (player.js: estado eleBeam) ----------
  beamTick(p, dt) {
    const A = ELE.arc, b = p.eleBeam, c = this.c;
    b.t += dt; b.tick -= dt; b.snd -= dt;
    const range = p.hero.attackRange * (p.stats.rangeMul || 1);
    let t = b.target;
    if (t && (!t.targetable || dist(t.position, p.position) > range * A.reach + t.data.radius)) t = b.target = null;
    if (!t) {
      let bs = Infinity;
      for (const e of c.enemies) {
        if (!e.targetable) continue;
        const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz);
        if (d > range + e.data.radius) continue;
        const da = Math.abs(wrap(Math.atan2(dx, dz) - p.facing));
        if (da > 1.1 && d > 1.4) continue;
        const sc = d + da * 4;
        if (sc < bs) { bs = sc; t = e; }
      }
      b.target = t;
    }
    if (t) {
      const want = Math.atan2(t.position.x - p.position.x, t.position.z - p.position.z);
      p.facing += wrap(want - p.facing) * (1 - Math.exp(-10 * dt));
      p.group.rotation.y = p.facing;
    }
    if (b.tick > 0) return;
    b.tick = A.tick;
    const mul = Math.min(A.max, 1 + b.t * A.ramp);
    const fx0 = Math.sin(p.facing), fz0 = Math.cos(p.facing);
    const from = v3(p.position.x + fx0 * 0.55, 1.75, p.position.z + fz0 * 0.55);
    if (b.snd <= 0) { b.snd = 0.36; audio.play('zap', p.position.x, p.position.z, { v: 0.4 + 0.15 * mul }); }
    if (!t) { c.vfx.lightning(from, v3(p.position.x + fx0 * range, 1.1, p.position.z + fz0 * range), BLUE, 0.12); return; }
    c.vfx.lightning(from, v3(t.position.x, 1.2, t.position.z), mul >= A.max ? 0xeaffff : BLUE, 0.12 + 0.06 * mul);
    const dx = t.position.x - p.position.x, dz = t.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
    c.damageEnemy(p, t, fx(A.dmg * mul), dx / d, dz / d, { spell: true, noStagger: true });
    if (t.alive) t.slow = Math.max(t.slow || 0, 0.5);
    this.log({ type: 'eleArc', mul, enemy: t });
  }

  // ---------- Barras do Gerador e da Bateria ----------
  fxRing(map, p, n, y, r, size, color) {
    let g = map.get(p);
    if (!g) {
      g = new THREE.Group();
      for (let i = 0; i < n; i++) {
        const s = glow(color, size, 0.9);
        const a = (i / n) * Math.PI * 2;
        s.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
        g.add(s);
      }
      this.scene.add(g);
      map.set(p, g);
    }
    return g;
  }
  updatePlayers(dt) {
    for (const p of this.c.players) {
      if (p.eleBlackCd > 0) p.eleBlackCd -= dt;
      if (p.eleHasteT > 0) p.eleHasteT -= dt;
      const w = EW(p), ele = isEle(p);
      // Gerador: andar sem parar enche a barra; parada, ela esvazia.
      if (ele && w.eGen && p.state !== 'dead') {
        const lp = p.eleLastPos || (p.eleLastPos = p.position.clone());
        const moved = Math.hypot(p.position.x - lp.x, p.position.z - lp.z) > 0.5 * dt;
        lp.copy(p.position);
        if (moved && (p.state === 'run' || p.state === 'dodge')) p.eleGen = Math.min(1, (p.eleGen || 0) + dt / ELE.gen.fill);
        else if (p.state === 'idle') p.eleGen = Math.max(0, (p.eleGen || 0) - dt * ELE.gen.drain);
        const g = this.fxRing(this.genFx, p, 12, 0.12, 0.85, 0.4, BLUE);
        g.position.set(p.position.x, 0, p.position.z);
        const lit = Math.floor((p.eleGen || 0) * 12 + 1e-6);
        g.children.forEach((s, i) => { s.visible = i < lit; s.material.opacity = p.eleGen >= 1 ? 0.6 + 0.4 * Math.random() : 0.85; });
        g.visible = true;
      } else { const g = this.genFx.get(p); if (g) g.visible = false; }
      // Bateria: faíscas girando na cintura (uma por carga).
      if (ele && w.eBat && p.state !== 'dead') {
        const g = this.fxRing(this.batFx, p, ELE.bat.max, 1.0, 0.75, 0.32, 0xeaffff);
        g.position.set(p.position.x, 0, p.position.z);
        g.rotation.y += dt * 3;
        g.children.forEach((s, i) => { s.visible = i < (p.eleBat || 0); });
        g.visible = true;
      } else { const g = this.batFx.get(p); if (g) g.visible = false; }
    }
  }

  update(dt) {
    this.time += dt;
    this.updatePlayers(dt);
    this.updateCharges(dt);
    this.updatePuddles(dt);
    this.updateWires(dt);
    this.updateBounces(dt);
    this.updateIons(dt);
    this.updateTowers(dt);
    this.updateClouds(dt);
    this.updateOverloads(dt);
    this.updateBlackout(dt);
    this.updateTrails(dt);
    this.updateBones(dt);
  }

  // Troca de arma/herói: tira o que é dessa heroína.
  dropFor(p) {
    this.dropCloud(p);
    for (const t of this.towers.filter((x) => x.p === p)) this.dropTower(t);
    for (const u of this.puddles.filter((x) => x.p === p)) this.dropPuddle(u);
    for (const x of this.wires.filter((y) => y.p === p)) this.dropWire(x);
    for (const m of [this.genFx.get(p), this.batFx.get(p)]) if (m) m.visible = false;
    if (this.black && this.black.p === p) this.endBlackout();
  }

  // Troca de sala: tudo some.
  clear() {
    for (const p of [...this.clouds.keys()]) this.dropCloud(p);
    for (const t of [...this.towers]) this.dropTower(t);
    for (const u of [...this.puddles]) this.dropPuddle(u);
    for (const x of [...this.wires]) this.dropWire(x);
    for (const tr of this.trails) { this.scene.remove(tr.m); tr.m.material.dispose(); }
    this.trails = [];
    for (const b of this.bones) { this.scene.remove(b.g); dispose(b.g); }
    this.bones = [];
    for (const e of [...this.charged]) this.uncharge(e);
    for (const e of [...this.ionized]) this.unionize(e);
    this.overloaded.clear();
    this.bounces = [];
    this.endBlackout();
    if (this.built && this.built.light) this.built.light.dim = 1;
    this.cur = null;
  }
}
