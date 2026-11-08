// Bênçãos da Manopla — o que fica na sala: esqueletos voando (Arremesso, Strike, Soco Carregado), agarrados (Suplex,
// Escudo de Carne), quicando na parede (Pinball), sentados (Soco Sísmico), disco de escudo (Quebra-Escudo), Punho
// Foguete, faíscas do Pavio, círculo do Duelo, contador do Combo, Desmontar e Saco de Pancadas.
import * as THREE from 'three';
import { audio } from './audio.js';
import { instance } from './assets.js';
import { goldify } from './characters.js';
import { getClip } from './animation.js';
import { statDamage } from './runstats.js';
import { FIST, isFist, setFistCombat, fistPlayerTick, knockDown } from './fistkit.js';

// Estados do esqueleto (enemies.js via axekit2.js): agarrado / voando / sentado no chão.
export const FIST_STATES = ['fistHeld', 'fistFly', 'fistSit'];
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const BUSY = ['held', 'thrown', 'spawn', 'rage', 'dead', 'spinMove', 'spinGather', 'spin', 'roll', 'hop', 'headless', 'axeAir', 'axeDown', 'tpOut', 'tpIn', 'lanceHeld', 'lanceFly', ...FIST_STATES];

// ---------- Esqueleto ----------
export function fistEnemyTick(e, dt) {
  if (e.state !== 'fistSit' || !e.sit) return; // agarrado/voando: quem mexe é o FistKit.update
  const s = e.sit;
  s.t += dt;
  if (!s.up && s.t >= s.total - 0.3) { s.up = true; playFor(e, 'Sit_Floor_StandUp', 0.3); }
  if (s.t >= s.total) { e.sit = null; e.setState('hurt'); e.stunTime = 0.05; e.anim.play(e.data.anims.idle, { fade: 0.12 }); }
}
export function fistLeaveState(e, from) {
  if (!FIST_STATES.includes(from)) return;
  e.position.y = 0;
  if (e.model) { e.model.rotation.x = 0; e.model.rotation.z = 0; }
  e.sit = null;
}
function playFor(e, clip, secs) {
  let sp = 1;
  try { sp = getClip(clip).duration / secs; } catch { /* sem o clipe: velocidade normal */ }
  e.anim.play(clip, { once: true, restart: true, fade: 0.06, speed: sp });
}
// Soco Sísmico: cai sentado por t segundos.
export function sitDown(e, t) {
  if (!e.alive || e.immune || e.frozenT > 0 || e.undead || BUSY.includes(e.state)) return false;
  e.releaseToken();
  e.vel.set(0, 0, 0);
  e.setState('fistSit');
  e.sit = { t: 0, total: t, up: false };
  playFor(e, 'Sit_Floor_Down', 0.3);
  return true;
}
const canGrab = (e) => e.alive && !BUSY.includes(e.state);

export class FistKit {
  constructor(combat) {
    setFistCombat(combat);
    this.c = combat;
    this.flyers = []; this.helds = []; this.bounces = []; this.discs = []; this.rockets = [];
    this.duelRings = new Map(); this.huds = new Map(); this.fuseFx = new Map(); this.backDiscs = new Map(); this.caughtFx = new Map();
  }
  get scene() { return this.c.scene; }
  get world() { return this.c.world; }
  log(o) { if (this.c.log) this.c.log(o); }
  mul(p) { return p.stats.damageMul; }

  // Dano direto em quem não pode ser acertado agora (agarrado na frente do herói).
  raw(e, dmg, by, nx = 0, nz = 1) {
    if (!e.alive) return;
    statDamage(e, dmg, e.hp);
    e.hp -= dmg; e.flash = 1; e.lastHitBy = by;
    this.c.text.add(String(dmg), e.position, 'dmg', 2.0);
    if (e.hp <= 0) { e.die(); this.c.killed(e, nx, nz, by); }
  }

  // ---------- Corpos voando (Arremesso, Strike, Soco Carregado) ----------
  // o: { dead, speed, dist, path (dano em quem está no caminho), land (dano ao cair), label }
  launch(p, e, dx, dz, o) {
    const d = Math.hypot(dx, dz) || 1;
    if (!o.dead) {
      if (!canGrab(e) && e.state !== 'fistHeld') return false;
      e.releaseToken();
      e.setState('fistFly');
      e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.5 });
    }
    e.vel.set(0, 0, 0);
    this.flyers.push({ ...o, p, e, dx: dx / d, dz: dz / d, dist: 0, hit: new Set([e]) });
    if (o.label) this.c.text.add(o.label, e.position, 'crit', 3.4);
    audio.play('swingHeavy', e.position.x, e.position.z, { v: 1.1 });
    this.log({ type: 'fistLaunch', enemy: e, dead: !!o.dead });
    return true;
  }
  updateFlyers(dt) {
    const c = this.c;
    for (const f of [...this.flyers]) {
      const e = f.e;
      if (!f.dead && (!e.alive || e.state !== 'fistFly')) { this.flyers.splice(this.flyers.indexOf(f), 1); continue; }
      const s = f.speed * dt / 3;
      let end = null;
      for (let k = 0; k < 3 && !end; k++) {
        const nx = e.position.x + f.dx * s, nz = e.position.z + f.dz * s;
        if (this.world.blocked(nx, nz, e.data.radius * 0.7)) { end = 'wall'; break; }
        e.position.x = nx; e.position.z = nz; f.dist += s;
        for (const o of [...c.enemies]) {
          if (f.hit.has(o) || !o.targetable) continue;
          const ox = o.position.x - nx, oz = o.position.z - nz, od = Math.hypot(ox, oz) || 0.01;
          if (od > o.data.radius + e.data.radius) continue;
          f.hit.add(o);
          c.bonusDamage(o, Math.max(1, Math.round(f.path * this.mul(f.p))), f.dx, f.dz, 'dmg', f.p);
          if (o.alive && !o.data.boss) knockDown(o, f.dx, f.dz);
          c.vfx.sparks(v3(o.position.x, 1.0, o.position.z), 0xffe6a0, 10);
          audio.play('hitHeavy', o.position.x, o.position.z, { v: 0.8 });
          if (o.alive && !o.data.boss) c.text.add('Derrubado!', o.position, 'hurt', 3.2);
          f.speed *= 0.88;
          this.log({ type: 'fistBowl', enemy: o });
        }
        if (f.dist >= f.distTotal) end = 'land';
      }
      if (!end) {
        e.position.y = f.dead ? 0.5 : 0.7 + 0.6 * Math.sin(Math.min(1, f.dist / Math.max(1, f.distTotal)) * Math.PI);
        e.model.rotation.x -= dt * 14;
        continue;
      }
      this.flyers.splice(this.flyers.indexOf(f), 1);
      e.position.y = 0; e.model.rotation.x = 0;
      this.world.resolveCircle(e.position, e.data.radius);
      c.vfx.dust(v3(e.position.x, 0.1, e.position.z), v3(0, 0, 0), 6);
      audio.play(end === 'wall' ? 'crunch' : 'thump', e.position.x, e.position.z, { v: 0.9 });
      if (f.dead) continue;
      knockDown(e, f.dx, f.dz);
      if (e.down) e.down.total = 0.9;
      const dmg = (f.land || 0) + (end === 'wall' ? 10 : 0);
      if (dmg > 0) c.bonusDamage(e, Math.max(1, Math.round(dmg * this.mul(f.p))), f.dx, f.dz, 'dmg big', f.p);
      if (end === 'wall') c.text.add('Na parede!', e.position, 'crit', 3.2);
      this.log({ type: 'fistLand', enemy: e, wall: end === 'wall' });
    }
  }

  // Arremesso: agarra e joga para a frente.
  toss(p, e, step) {
    const T = FIST.toss, a = p.facing;
    e.position.x = p.position.x + Math.sin(a) * 1.2; e.position.z = p.position.z + Math.cos(a) * 1.2;
    this.c.shakeFor(p, 0.2);
    this.launch(p, e, Math.sin(a), Math.cos(a), { speed: T.speed, distTotal: T.dist, path: T.path, land: step.damage * T.land, label: 'Arremesso!' });
  }
  // Soco Carregado: o mais perto na frente voa longe (quanto mais carregou, mais longe).
  bigPunch(p, step) {
    const c = this.c, F = FIST.charge, k = p.fistPower || 0;
    p.fistPower = 0;
    const dmg = F.dmg0 + (F.dmg1 - F.dmg0) * k;
    let n = 0, first = null, fd = Infinity;
    for (const e of [...c.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > 2.3 + e.data.radius || Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > 55 * Math.PI / 180) continue;
      const r = c.damageEnemy(p, e, { ...step, damage: dmg, heavy: k >= 0.5 }, dx / d, dz / d);
      if (r === 'hit' && d < fd) { fd = d; first = e; }
      if (r) n++;
    }
    if (first && first.alive && !first.data.boss && !first.undead && canGrab(first) && k > 0.05) {
      this.launch(p, first, Math.sin(p.facing), Math.cos(p.facing), { speed: F.speed, distTotal: F.d0 + (F.d1 - F.d0) * k, path: F.path, land: 0, label: k >= 1 ? 'SOCÃO!' : 'Soco carregado!' });
    } else if (first && first.alive && first.data.boss) first.daze(0.3 + 0.4 * k);
    c.vfx.heavyImpact(v3(p.position.x + Math.sin(p.facing) * 1.4, 0, p.position.z + Math.cos(p.facing) * 1.4), 0.5 + k * 0.7);
    c.shakeFor(p, 0.12 + k * 0.3);
    audio.play(n ? 'hitHeavy' : 'swingHeavy', p.position.x, p.position.z, { v: 0.8 + k * 0.6 });
    if (n) c.addHitstop(0.05 + k * 0.09);
    p.setGlow(0);
    this.log({ type: 'fistBig', k, n });
  }

  // ---------- Agarrados (Suplex, Escudo de Carne) ----------
  grabHold(p, e, kind) {
    e.releaseToken();
    if (e.atk && e.state === 'attack' && e.endAttack) e.endAttack();
    e.vel.set(0, 0, 0);
    e.setState('fistHeld');
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.4 });
    const it = { kind, p, e, t: 0, a: p.facing };
    this.helds.push(it);
    return it;
  }
  suplex(p, e, step) {
    const it = this.grabHold(p, e, 'suplex');
    it.step = step;
    this.c.text.add('Suplex!', p.position, 'crit', 3.4);
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.2 });
    this.log({ type: 'fistSuplex', enemy: e });
  }
  grabMeat(p, e) {
    this.grabHold(p, e, 'meat');
    this.c.text.add('Escudo de Carne!', p.position, 'crit', 3.2);
    audio.play('thump', e.position.x, e.position.z, { v: 0.7 });
    this.log({ type: 'fistMeat', enemy: e });
  }
  meatOf(p) { return this.helds.find((h) => h.p === p && h.kind === 'meat'); }
  // Fim do Escudo de Carne: o Cavaleiro chuta o agarrado para longe (como o Arremesso).
  kickMeat(p) {
    const it = this.meatOf(p);
    if (!it) return;
    this.helds.splice(this.helds.indexOf(it), 1);
    const e = it.e, a = p.facing, M = FIST.meat;
    e.position.y = 0; e.model.rotation.x = 0;
    if (!e.alive) return;
    this.c.shakeFor(p, 0.25);
    this.c.addHitstop(0.06);
    audio.play('hitHeavy', e.position.x, e.position.z);
    this.launch(p, e, Math.sin(a), Math.cos(a), { speed: M.kickSpeed, distTotal: M.kickDist, path: M.kickPath, land: M.kickLand, label: 'Chute!' });
    this.log({ type: 'fistMeatKick', enemy: e });
  }
  dropHeld(it, stun = 0.6) {
    const i = this.helds.indexOf(it);
    if (i >= 0) this.helds.splice(i, 1);
    const e = it.e;
    if (!e.alive || e.state !== 'fistHeld') return;
    e.setState('hurt'); e.stunTime = stun;
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05 });
    this.world.resolveCircle(e.position, e.data.radius);
  }
  updateHelds(dt) {
    const c = this.c;
    for (const it of [...this.helds]) {
      const p = it.p, e = it.e;
      it.t += dt;
      if (!e.alive || e.state !== 'fistHeld') { this.helds.splice(this.helds.indexOf(it), 1); continue; }
      e.vel.set(0, 0, 0);
      if (it.kind === 'meat') {
        if ((p.state !== 'fistMeat' && p.state !== 'fistKick') || p.state === 'dead') { this.dropHeld(it); continue; }
        const a = p.facing, M = FIST.meat;
        e.position.x = p.position.x + Math.sin(a) * M.dist; e.position.z = p.position.z + Math.cos(a) * M.dist;
        e.position.y = 0.25 + 0.04 * Math.sin(it.t * 9);
        e.facing = a; e.group.rotation.y = a;
        e.model.rotation.x = -0.15;
        // Flechas e magias batem no corpo.
        for (const s of [...c.projectiles.list]) {
          if (!s || s.hits !== 'player' || s.stuck >= 0) continue;
          if (Math.hypot(s.x - e.position.x, s.z - e.position.z) > e.data.radius + s.r + 0.25) continue;
          c.vfx.sparks(v3(s.x, 1.2, s.z), s.kind === 'arrow' ? 0xffe6a0 : (s.color ?? 0xc890ff), 8);
          c.projectiles.removeA(s);
          audio.play('hit', e.position.x, e.position.z, { v: 0.6 });
          this.log({ type: 'fistMeatBlock', kind: s.kind });
          this.raw(e, Math.max(1, s.damage || 5), p, Math.sin(a), Math.cos(a));
          if (!e.alive) break;
        }
        continue;
      }
      // Suplex: passa por cima do herói e cai atrás.
      const S = FIST.suplex, k = Math.min(1, it.t / S.time), a = it.a;
      const r = 1.3 * Math.cos(Math.PI * k) - (k > 0.5 ? (S.back - 1.3) * (k - 0.5) * 2 : 0);
      e.position.x = p.position.x + Math.sin(a) * r; e.position.z = p.position.z + Math.cos(a) * r;
      e.position.y = S.h * Math.sin(Math.PI * k);
      e.model.rotation.x = -Math.PI * k;
      if (k < 1) continue;
      this.helds.splice(this.helds.indexOf(it), 1);
      e.position.y = 0; e.model.rotation.x = 0;
      this.world.resolveCircle(e.position, e.data.radius);
      const at = v3(e.position.x, 0, e.position.z);
      e.setState('hurt');
      knockDown(e, -Math.sin(a), -Math.cos(a));
      if (e.down) e.down.total = 1.2;
      const base = it.step.damage * this.mul(p);
      c.bonusDamage(e, Math.max(1, Math.round(base * S.mul)), -Math.sin(a), -Math.cos(a), 'dmg big', p);
      let n = 0;
      for (const o of [...c.enemies]) {
        if (o === e || !o.targetable) continue;
        const dx = o.position.x - at.x, dz = o.position.z - at.z, d = Math.hypot(dx, dz) || 0.01;
        if (d > S.r + o.data.radius) continue;
        c.bonusDamage(o, Math.max(1, Math.round(base * S.aoe)), dx / d, dz / d, 'dmg', p);
        if (o.alive) { if (o.data.boss) o.daze(0.4); else if (knockDown(o, dx / d, dz / d) && o.down) o.down.total = S.down; }
        n++;
      }
      c.vfx.heavyImpact(at, 1.3);
      c.vfx.ring(at, 0xffd36a, S.r);
      c.vfx.dust(v3(at.x, 0.1, at.z), v3(0, 0, 0), 14);
      audio.play('hitHeavy', at.x, at.z, { v: 1.3 });
      c.shakeFor(p, 0.45);
      c.addHitstop(0.12);
      this.log({ type: 'fistSuplexLand', n });
    }
  }

  // ---------- Soco Sísmico ----------
  quake(p, step) {
    const c = this.c, Q = FIST.quake, a = p.facing;
    const at = v3(p.position.x + Math.sin(a) * 0.8, 0, p.position.z + Math.cos(a) * 0.8);
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - at.x, dz = e.position.z - at.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > Q.r + e.data.radius) continue;
      const r = c.damageEnemy(p, e, { ...step, pushMul: 0.2 }, dx / d, dz / d);
      if (r) n++;
      if (e.alive) { e.vel.set(0, 0, 0); if (e.data.boss) e.daze(Q.boss); else if (sitDown(e, Q.sit)) c.text.add('Sentou!', e.position, 'hurt', 3.0); }
    }
    c.props.strikeArc(p, Q.r, Math.PI, at, Q.r);
    c.vfx.heavyImpact(at, 1.4);
    c.vfx.ring(at, 0xd8a050, Q.r);
    c.vfx.dust(v3(at.x, 0.1, at.z), v3(0, 0, 0), 16);
    audio.play('hitHeavy', at.x, at.z, { v: 1.3 });
    c.shakeFor(p, 0.4);
    if (n) c.addHitstop(0.1);
    this.log({ type: 'fistQuake', n });
  }

  // ---------- Pinball ----------
  tryPinball(p, e, nx, nz) {
    if (!e.alive || this.bounces.some((b) => b.e === e) || e.state !== 'hurt') return;
    const r = e.data.radius;
    let wall = -1;
    for (let d = r * 0.6; d <= r + FIST.pinball.wall; d += 0.15) {
      if (this.world.blocked(e.position.x + nx * d, e.position.z + nz * d, 0.05)) { wall = d; break; }
    }
    if (wall < 0) return;
    this.bounces.push({ p, e, dx: nx, dz: nz, phase: 'in', t: 0 });
    this.log({ type: 'fistPinball', enemy: e });
  }
  updateBounces(dt) {
    const c = this.c, P = FIST.pinball;
    for (const b of [...this.bounces]) {
      const e = b.e, p = b.p;
      b.t += dt;
      if (!e.alive || e.state !== 'hurt' || b.t > 1.6) { this.bounces.splice(this.bounces.indexOf(b), 1); continue; }
      e.vel.set(0, 0, 0);
      e.stunTime = e.t + 0.5;
      if (b.phase === 'in') {
        const s = P.in * dt, nx = e.position.x + b.dx * s, nz = e.position.z + b.dz * s;
        if (this.world.blocked(nx, nz, e.data.radius * 0.8)) {
          b.phase = 'out';
          c.vfx.heavyImpact(v3(e.position.x, 0, e.position.z), 0.6);
          audio.play('crunch', e.position.x, e.position.z, { v: 0.8 });
          c.text.add('Pinball!', e.position, 'crit', 3.4);
          c.bonusDamage(e, Math.max(1, Math.round(P.dmg * this.mul(p))), -b.dx, -b.dz, 'dmg', p);
          c.props.hitAt(nx, nz, p);
          this.log({ type: 'fistPinballWall', enemy: e });
          continue;
        }
        e.position.x = nx; e.position.z = nz;
        e.group.rotation.y += dt * 10;
        continue;
      }
      // Volta para o herói (pronto para o próximo soco).
      const dx = p.position.x - e.position.x, dz = p.position.z - e.position.z, d = Math.hypot(dx, dz) || 0.01;
      const stop = e.data.radius + p.hero.radius + P.near;
      if (d <= stop) {
        this.bounces.splice(this.bounces.indexOf(b), 1);
        e.stunTime = e.t + P.hold;
        e.facing = Math.atan2(dx, dz); e.group.rotation.y = e.facing;
        continue;
      }
      const s = Math.min(P.out * dt, d - stop);
      e.position.x += dx / d * s; e.position.z += dz / d * s;
      e.group.rotation.y += dt * 10;
    }
  }

  // ---------- Quebra-Escudo ----------
  ripShield(p, e) {
    const c = this.c;
    e.shieldBroken = true;
    const sh = e.shieldMesh || e.weapons[1];
    if (sh) { const i = e.weapons.indexOf(sh); if (i >= 0) e.weapons.splice(i, 1); if (sh.parent) sh.parent.remove(sh); }
    p.fistDisc = (e.data.weapons && e.data.weapons.left && e.data.weapons.left.model) || 'weapons/skeletons/Skeleton_Shield_Large_A.gltf';
    const m = instance(p.fistDisc);
    m.position.set(0, 1.25, -0.42); m.rotation.set(0, Math.PI, 0); m.scale.setScalar(0.8);
    p.group.add(m);
    this.backDiscs.set(p, m);
    c.text.add('Arrancou o escudo!', e.position, 'crit', 3.4);
    c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), 0xcfe4ff, 14);
    audio.play('block', e.position.x, e.position.z);
    this.log({ type: 'fistRip', enemy: e });
  }
  throwDisc(p) {
    const c = this.c, D = FIST.disc;
    const back = this.backDiscs.get(p);
    if (back) { p.group.remove(back); this.backDiscs.delete(p); }
    const m = instance(p.fistDisc || 'weapons/skeletons/Skeleton_Shield_Large_A.gltf');
    p.fistDisc = false;
    const g = new THREE.Group(); m.rotation.x = -Math.PI / 2; m.scale.setScalar(0.9); g.add(m);
    const a = p.facing;
    g.position.set(p.position.x + Math.sin(a) * 1.0, 1.1, p.position.z + Math.cos(a) * 1.0);
    this.scene.add(g);
    const face = (e) => e.targetable && Math.abs(wrap(Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z) - a)) < Math.PI / 2;
    let target = null, bd = 12;
    for (const e of c.enemies) { if (!face(e)) continue; const d = Math.hypot(e.position.x - g.position.x, e.position.z - g.position.z); if (d < bd) { bd = d; target = e; } }
    this.discs.push({ p, g, m, dx: Math.sin(a), dz: Math.cos(a), target, hits: 0, hitSet: new Set(), t: 0 });
    c.text.add('Disco!', p.position, 'crit', 3.0);
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.1 });
    this.log({ type: 'fistDisc' });
  }
  updateDiscs(dt) {
    const c = this.c, D = FIST.disc;
    for (const it of [...this.discs]) {
      const g = it.g;
      it.t += dt;
      it.m.rotation.z += dt * 18;
      const tg = it.target && it.target.targetable ? it.target : null;
      if (tg) { const dx = tg.position.x - g.position.x, dz = tg.position.z - g.position.z, d = Math.hypot(dx, dz) || 0.01; it.dx = dx / d; it.dz = dz / d; }
      const nx = g.position.x + it.dx * D.speed * dt, nz = g.position.z + it.dz * D.speed * dt;
      if (it.t > D.life || this.world.blocked(nx, nz, 0.1)) { this.endDisc(it); continue; }
      g.position.x = nx; g.position.z = nz;
      for (const e of [...c.enemies]) {
        if (!e.targetable || it.hitSet.has(e)) continue;
        if (Math.hypot(e.position.x - nx, e.position.z - nz) > e.data.radius + D.r) continue;
        it.hitSet.add(e); it.hits++;
        c.bonusDamage(e, Math.max(1, Math.round(D.dmg * this.mul(it.p))), it.dx, it.dz, 'dmg', it.p);
        c.vfx.sparks(v3(e.position.x, 1.1, e.position.z), 0xcfe4ff, 10);
        audio.play('block', e.position.x, e.position.z, { v: 0.8 });
        this.log({ type: 'fistDiscHit', enemy: e, n: it.hits });
        // Quica para o próximo inimigo perto.
        let next = null, bd = D.seek;
        for (const o of c.enemies) { if (!o.targetable || it.hitSet.has(o)) continue; const d = Math.hypot(o.position.x - nx, o.position.z - nz); if (d < bd) { bd = d; next = o; } }
        it.target = next;
        if (!next || it.hits >= D.hits) { it.t = D.life; }
        break;
      }
    }
  }
  endDisc(it) {
    this.discs.splice(this.discs.indexOf(it), 1);
    this.scene.remove(it.g);
    const m = it.m; it.g.remove(m);
    m.position.copy(it.g.position); m.rotation.set(-Math.PI / 2, 0, 0); m.scale.setScalar(0.9);
    this.c.debris.drop(m, it.dx, it.dz);
  }

  // ---------- Punho Foguete ----------
  fireRocket(p, step) {
    const c = this.c;
    p.fistRocketOut = true;
    if (p.weapon) p.weapon.visible = false;
    const g = new THREE.Group(), m = instance('weapons/extra/fistweapon_A.gltf');
    goldify(m); m.scale.setScalar(1.6); m.rotation.x = Math.PI / 2; g.add(m);
    const a = p.facing;
    g.position.set(p.position.x + Math.sin(a) * 0.9, 1.25, p.position.z + Math.cos(a) * 0.9);
    g.rotation.y = a;
    this.scene.add(g);
    this.rockets.push({ p, g, phase: 'out', dx: Math.sin(a), dz: Math.cos(a), dist: 0, step, smoke: 0 });
    c.text.add('Punho Foguete!', p.position, 'crit', 3.2);
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.3 });
    this.log({ type: 'fistRocket' });
  }
  boom(it) {
    const c = this.c, R = FIST.rocket, at = v3(it.g.position.x, 0, it.g.position.z), p = it.p;
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - at.x, dz = e.position.z - at.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > R.r + e.data.radius) continue;
      c.bonusDamage(e, Math.max(1, Math.round(R.dmg * this.mul(p))), dx / d, dz / d, 'dmg big', p);
      if (e.alive && e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(10 * Math.max(0.4, e.data.knockback ?? 1));
      n++;
    }
    c.props.hitAt(at.x, at.z, p);
    c.vfx.heavyImpact(at, 1.2);
    c.vfx.ring(at, 0xff8a2a, R.r);
    c.vfx.sparks(v3(at.x, 1.2, at.z), 0xffb050, 22);
    audio.play('boom', at.x, at.z, { v: 1.1 });
    c.shakeFor(p, 0.35);
    if (n) c.addHitstop(0.08);
    this.log({ type: 'fistRocketBoom', n });
  }
  updateRockets(dt) {
    const c = this.c, R = FIST.rocket;
    for (const it of [...this.rockets]) {
      const g = it.g, p = it.p;
      it.smoke -= dt;
      if (it.smoke <= 0) { it.smoke = 0.04; c.vfx.sparks(v3(g.position.x - it.dx * 0.4, 1.2, g.position.z - it.dz * 0.4), it.phase === 'out' ? 0xff9a3a : 0xffe27a, 2); }
      if (it.phase === 'out') {
        const s = R.speed * dt, nx = g.position.x + it.dx * s, nz = g.position.z + it.dz * s;
        let hit = this.world.blocked(nx, nz, 0.15);
        if (!hit) for (const e of c.enemies) if (e.targetable && Math.hypot(e.position.x - nx, e.position.z - nz) < e.data.radius + 0.5) { hit = true; break; }
        g.position.x = nx; g.position.z = nz; it.dist += s;
        if (hit) { this.boom(it); it.phase = 'back'; }
        else if (it.dist >= R.range) it.phase = 'back';
        continue;
      }
      // Voltando para a mão.
      const tx = p.position.x, tz = p.position.z, dx = tx - g.position.x, dz = tz - g.position.z, d = Math.hypot(dx, dz) || 0.01;
      g.rotation.y = Math.atan2(-dx, -dz);
      if (d < 0.9 || p.state === 'dead') { this.endRocket(it); continue; }
      const s = Math.min(d, R.back * dt);
      g.position.x += dx / d * s; g.position.z += dz / d * s;
      it.dx = -dx / d; it.dz = -dz / d;
    }
  }
  endRocket(it) {
    this.rockets.splice(this.rockets.indexOf(it), 1);
    this.scene.remove(it.g);
    it.p.fistRocketOut = false;
    if (it.p.weapon && isFist(it.p)) it.p.weapon.visible = true;
    audio.play('thump', it.p.position.x, it.p.position.z, { v: 0.5 });
    this.log({ type: 'fistRocketBack' });
  }

  // ---------- Contragolpe Relâmpago ----------
  zapPunch(p, step) {
    const c = this.c, e = p.fistCounterE;
    p.fistCounterE = null;
    let n = 0;
    if (e && e.targetable && Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) <= FIST.zap.reach + e.data.radius) {
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      c.vfx.bolt(v3(p.position.x, 1.3, p.position.z), v3(e.position.x, 1.2, e.position.z), 0x9fdcff);
      if (c.damageEnemy(p, e, { ...step, kit: null }, dx / d, dz / d)) n++;
      if (e.alive && e.daze) e.daze(e.data.boss ? 0.3 : 0.8);
    }
    audio.play(n ? 'hit' : 'swing', p.position.x, p.position.z, { v: 0.9 });
    if (n) c.addHitstop(0.06);
    this.log({ type: 'fistZapHit', n });
  }

  // ---------- Pegar no Ar ----------
  showCaught(p, on) {
    let m = this.caughtFx.get(p);
    if (on && !m) {
      m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: (p.fistCaught && p.fistCaught.color) ?? 0xffe27a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.set(0.45, 1.15, 0.45);
      p.group.add(m);
      this.caughtFx.set(p, m);
    } else if (!on && m) { p.group.remove(m); this.caughtFx.delete(p); }
  }
  throwCaught(p) {
    const k = p.fistCaught;
    p.fistCaught = null;
    this.showCaught(p, false);
    const a = p.facing;
    this.c.projectiles.fire(p.position.x + Math.sin(a) * 1.0, p.position.z + Math.cos(a) * 1.0, a, {
      speed: 26, damage: Math.max(1, Math.round(k.damage * FIST.catchMul * this.mul(p))), kind: k.kind, color: k.color, hits: 'hero', pierce: true,
      height: 1.2, life: 1.2, scale: k.scale, owner: p,
    });
    this.c.text.add('De volta!', p.position, 'crit', 3.0);
    this.log({ type: 'fistThrowBack', kind: k.kind });
  }

  // ---------- Contador de Combo ----------
  countHit(p) {
    p.fistHits = (p.fistHits || 0) + 1;
    this.drawHud(p);
    if (p.fistHits % FIST.combo.every) return;
    const c = this.c, K = FIST.combo, at = v3(p.position.x, 0, p.position.z);
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - at.x, dz = e.position.z - at.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > K.r + e.data.radius) continue;
      c.bonusDamage(e, Math.max(1, Math.round(K.dmg * this.mul(p))), dx / d, dz / d, 'dmg big', p);
      if (e.alive && e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(K.push * Math.max(0.4, e.data.knockback ?? 1));
      n++;
    }
    c.vfx.ring(at, 0xffd36a, K.r);
    c.vfx.ring(at, 0xffffff, K.r * 0.6);
    c.vfx.sparks(v3(at.x, 1.2, at.z), 0xffd36a, 24);
    audio.play('boom', at.x, at.z, { v: 0.9 });
    c.shakeFor(p, 0.3);
    c.text.add(`${p.fistHits} golpes!`, p.position, 'crit', 3.8);
    this.log({ type: 'fistComboWave', n, hits: p.fistHits });
  }
  drawHud(p) {
    let el = this.huds.get(p);
    if (!el) {
      el = document.createElement('div');
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);pointer-events:none;z-index:30;font:bold 30px Georgia,serif;color:#ffd36a;text-shadow:0 2px 4px #000,0 0 10px #a86a00;text-align:center;transition:opacity .25s';
      el.style.top = `${16 + this.c.players.indexOf(p) * 8}%`;
      document.body.appendChild(el);
      this.huds.set(p, el);
    }
    const n = p.fistHits || 0, k = n % FIST.combo.every;
    el.style.opacity = n > 0 ? '1' : '0';
    if (n > 0) el.innerHTML = `${n} <span style="font-size:15px">acertos</span><div style="margin:3px auto 0;width:120px;height:5px;background:#2a2015;border:1px solid #7a5a20"><div style="height:100%;width:${k * 10}%;background:#ffd36a"></div></div>`;
  }
  resetCombo(p) {
    if (!(p.fistHits > 0)) return;
    if (p.fistHits >= 3) this.c.text.add('Combo perdido', p.position, 'miss', 3.0);
    p.fistHits = 0;
    this.drawHud(p);
    this.log({ type: 'fistComboReset' });
  }

  // ---------- Pavio ----------
  addFuse(p, e) {
    e.fistFuse = Math.min(FIST.fuse.max, (e.fistFuse || 0) + 1);
    e.fistFuseBy = p;
    this.drawFuse(e);
  }
  drawFuse(e) {
    let g = this.fuseFx.get(e);
    if (!g && e.fistFuse > 0) {
      g = new THREE.Group();
      for (let i = 0; i < FIST.fuse.max; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
        g.add(s);
      }
      this.scene.add(g);
      this.fuseFx.set(e, g);
    }
    if (!g) return;
    g.children.forEach((s, i) => { s.visible = i < (e.fistFuse || 0); });
  }
  detonate(p) {
    const c = this.c;
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!(e.fistFuse > 0) || e.fistFuseBy !== p) continue;
      const k = e.fistFuse;
      e.fistFuse = 0; this.drawFuse(e);
      if (!e.targetable) continue;
      const at = v3(e.position.x, 1.1, e.position.z);
      c.vfx.sparks(at, 0xffa030, 8 + k * 4);
      c.vfx.ring(v3(at.x, 0, at.z), 0xff8a2a, 0.8 + k * 0.25);
      c.bonusDamage(e, Math.max(1, Math.round(FIST.fuse.dmg * k * this.mul(p))), 0, 1, 'burn', p);
      n++;
    }
    if (n) { audio.play('boom', p.position.x, p.position.z, { v: 0.7 }); c.text.add('Kabum!', p.position, 'crit', 3.2); }
    this.log({ type: 'fistDetonate', n });
  }
  updateFuse(dt) {
    this.time = (this.time || 0) + dt;
    for (const [e, g] of [...this.fuseFx]) {
      if (!e.alive || !(e.fistFuse > 0)) { this.scene.remove(g); this.fuseFx.delete(e); if (e.alive) e.fistFuse = 0; continue; }
      g.position.set(e.position.x, 1.3 + e.position.y, e.position.z);
      g.children.forEach((s, i) => { const a = this.time * 5 + i * (Math.PI * 2 / FIST.fuse.max); s.position.set(Math.sin(a) * 0.6, 0.15 * Math.sin(this.time * 9 + i), Math.cos(a) * 0.6); });
    }
  }

  // ---------- Duelo ----------
  startDuel(p, e) {
    p.fistDuel = { e, t: FIST.duel.time };
    let ring = this.duelRings.get(p);
    if (!ring) {
      ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.duelRings.set(p, ring);
    }
    this.scene.add(ring);
    this.c.text.add('Duelo!', e.position, 'crit', 3.8);
    audio.play('block', e.position.x, e.position.z, { v: 0.8 });
    this.log({ type: 'fistDuel', enemy: e });
  }
  endDuel(p) {
    p.fistDuel = null;
    const ring = this.duelRings.get(p);
    if (ring) this.scene.remove(ring);
    this.log({ type: 'fistDuelEnd' });
  }
  updateDuel(p, dt) {
    const D = p.fistDuel;
    if (!D) return;
    D.t -= dt;
    if (D.t <= 0 || !D.e.alive || p.state === 'dead') { this.endDuel(p); return; }
    const ring = this.duelRings.get(p);
    if (ring) { ring.position.set(D.e.position.x, 0.1, D.e.position.z); ring.material.opacity = 0.45 + 0.3 * Math.sin(this.time * 8); }
    for (const o of this.c.enemies) if (o !== D.e && o.alive && !o.undead && o.target === p) o.cooldown = Math.max(o.cooldown, 0.3);
  }

  // ---------- Desmontar ----------
  dismantle(p, e, nx, nz) {
    if (e.data.boss || e.undead || !e.alive) return;
    const c = this.c;
    e.fistParts = (e.fistParts || 0) + 1;
    const bone = instance('props/crypt/bone_A.gltf');
    bone.position.set(e.position.x, 1.4, e.position.z);
    c.debris.add(bone, v3(nx * 3 + (Math.random() - 0.5) * 2, 5, nz * 3 + (Math.random() - 0.5) * 2), v3(12, 4, 9));
    c.vfx.sparks(v3(e.position.x, 1.4, e.position.z), 0xffffff, 10);
    audio.play('crunch', e.position.x, e.position.z);
    if (e.fistParts === 1) {
      e.model.traverse((o) => { if (o.isMesh && /_ArmLeft$/.test(o.name)) o.visible = false; });
      if (e.data.shield && !e.shieldBroken) c.breakEnemyShield(e, nx, nz, p);
      c.text.add('Arrancou o braço!', e.position, 'hurt', 3.4);
    } else if (!e.fistDisarmed) {
      e.fistDisarmed = true;
      const right = e.weapons.find((w) => w !== e.shieldMesh);
      if (right) { e.weapons.splice(e.weapons.indexOf(right), 1); c.debris.drop(right, nx, nz); }
      e.data = { ...e.data, ranged: null, attack: { ...e.data.attack, damage: 0 }, attackRange: Math.min(e.data.attackRange || 2, 2) };
      e.abilities = false;
      if (e.atk && e.state === 'attack') e.endAttack();
      c.text.add('Desarmado!', e.position, 'hurt', 3.4);
    }
    this.log({ type: 'fistDismantle', enemy: e, n: e.fistParts });
  }

  // ---------- Saco de Pancadas ----------
  bagBurst(p, e, nx, nz) {
    const c = this.c, B = FIST.bag, at = v3(e.position.x, 0, e.position.z);
    c.text.add('Saco estourou!', e.position, 'crit', 3.8);
    if (e.data.boss) c.bonusDamage(e, Math.max(1, Math.round(B.boss * this.mul(p))), nx, nz, 'dmg big', p);
    else if (e.alive) {
      e.hp = 0; e.die();
      c.debris.skeleton(e.position, nx, nz, true);
      c.killed(e, nx, nz, p);
      e.shattered = true; e.group.visible = false; // explodiu na hora (não desmonta de novo)
    }
    let n = 0;
    for (const o of [...c.enemies]) {
      if (o === e || !o.targetable) continue;
      const dx = o.position.x - at.x, dz = o.position.z - at.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > B.r + o.data.radius) continue;
      c.bonusDamage(o, Math.max(1, Math.round(B.dmg * this.mul(p))), dx / d, dz / d, 'dmg', p);
      if (o.alive && o.vel && !o.data.boss) o.vel.set(dx / d, 0, dz / d).multiplyScalar(9);
      n++;
    }
    for (let i = 0; i < 6; i++) {
      const b = instance(i % 2 ? 'props/crypt/bone_A.gltf' : 'props/crypt/skull.gltf');
      const a = Math.random() * Math.PI * 2;
      b.position.set(at.x, 1.2, at.z); b.scale.setScalar(0.8);
      c.debris.add(b, v3(Math.sin(a) * 8, 4 + Math.random() * 3, Math.cos(a) * 8), v3(12, 6, 9));
    }
    c.vfx.ring(at, 0xffffff, B.r);
    c.vfx.heavyImpact(at, 1.1);
    audio.play('bones', at.x, at.z, { v: 1.3 });
    c.shakeFor(p, 0.35);
    this.log({ type: 'fistBag', enemy: e, n });
  }

  // ---------- Quadro ----------
  update(dt) {
    for (const p of this.c.players) {
      if (p.fistLastHp !== undefined && p.hp < p.fistLastHp) this.resetCombo(p); // Contador de Combo: tomou dano
      p.fistLastHp = p.hp;
      fistPlayerTick(this.c, p, dt);
      this.updateDuel(p, dt);
      if (p.fistCaught && !this.caughtFx.get(p)) this.showCaught(p, true);
    }
    for (const e of this.c.enemies) if (e.fistBagT > 0) e.fistBagT -= dt;
    this.updateFlyers(dt);
    this.updateHelds(dt);
    this.updateBounces(dt);
    this.updateDiscs(dt);
    this.updateRockets(dt);
    this.updateFuse(dt);
  }

  // Troca de arma / nova partida: tudo deste herói some.
  dropFor(p) {
    for (const it of [...this.rockets]) if (it.p === p) this.endRocket(it);
    for (const it of [...this.helds]) if (it.p === p) this.dropHeld(it);
    for (const it of [...this.discs]) if (it.p === p) { this.discs.splice(this.discs.indexOf(it), 1); this.scene.remove(it.g); }
    const back = this.backDiscs.get(p); if (back) { p.group.remove(back); this.backDiscs.delete(p); }
    this.showCaught(p, false);
    if (p.fistDuel) this.endDuel(p);
    const el = this.huds.get(p); if (el) { el.remove(); this.huds.delete(p); }
  }

  // Troca de sala: o que está voando some (o escudo arrancado nas costas e a flecha na mão ficam).
  clear() {
    for (const it of [...this.rockets]) this.endRocket(it);
    for (const it of [...this.helds]) this.dropHeld(it);
    for (const it of this.discs) this.scene.remove(it.g);
    for (const [, g] of this.fuseFx) this.scene.remove(g);
    this.flyers = []; this.helds = []; this.bounces = []; this.discs = []; this.fuseFx.clear();
    for (const p of this.c.players) { if (p.fistDuel) this.endDuel(p); p.fistLeapReq = false; }
  }
}
