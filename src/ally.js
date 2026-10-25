// Mercador contratado (250 de ouro na sala dele): luta ao lado dos heróis só na sala do chefe.
// Atira flechas como o arqueiro esqueleto, rola para fugir (como o herói) e solta uma saraivada a cada 1 minuto.
// Os heróis não acertam nele; os inimigos podem matá-lo. Depois da luta ele vai embora.
import * as THREE from 'three';
import { Merchant } from './merchant.js';
import { audio } from './audio.js';

export const ALLY = {
  price: 250,
  hp: 150,
  speed: 6.5,
  arrow: { damage: 14, speed: 24, aim: 0.5, recover: 0.35, every: 1.3 },
  volley: { first: 15, every: 60, aim: 0.8, count: 9, spread: 1.0, damage: 14 },
  roll: { distance: 6, time: 0.32, cooldown: 2.0 },
  keep: { flee: 4.5, near: 7, far: 13 },   // distância dos inimigos: foge / fica / chega perto
};

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Mercenary extends Merchant {
  constructor(scene, combat, x, z, world) {
    super(scene, combat, x, z);
    this.ally = true;
    this.world = world;
    this.hp = this.maxHp = ALLY.hp;
    this.state = 'fight';      // fight | aim | shot | volleyAim | roll | leave | gone | dead
    this.cd = 0.8;             // até o próximo tiro
    this.volleyT = ALLY.volley.first;
    this.rollCd = 0;
    this.rollDir = new THREE.Vector3();
    this.rollK = 0;            // 0..1 durante o rolamento (co-op: vai para o Jogador 2)
    this.volleys = 0;
    this.anim.play('Idle_B');
  }

  get facing() { return this.group.rotation.y; }

  // Heróis não acertam nele; rolando, nada acerta.
  hit(dmg, attacker) {
    if (!this.alive || this.state === 'leave' || this.state === 'gone') return false;
    if (attacker === 'player' || (attacker && attacker.hero)) return false;
    const c = this.combat;
    if (this.state === 'roll') { c.text.add('Esquivou!', this.position, 'miss'); return false; }
    dmg = Math.max(0, Math.round(dmg));
    this.hp -= dmg;
    this.flash = 1;
    c.text.add(String(dmg), this.position, 'hurt small');
    c.vfx.sparks(new THREE.Vector3(this.position.x, 1.3, this.position.z), 0xffffff, 6);
    if (c.log) c.log({ type: 'allyHit', dmg, hp: this.hp });
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  die() {
    this.alive = false;
    this.hp = 0;
    this.state = 'dead';
    this.clearRoll();
    this.combat.text.add('O mercador caiu!', this.position, 'crit', 3.6);
    this.anim.play('Death_A', { once: true, restart: true, fade: 0.08 });
    if (this.combat.log) this.combat.log({ type: 'allyDied' });
    if (this.onDeath) this.onDeath();
  }

  enemies() { return this.combat.enemies.filter((e) => e.alive && e.targetable); }

  nearest(list) {
    let best = null, bd = Infinity;
    for (const e of list) {
      const d = Math.hypot(e.position.x - this.position.x, e.position.z - this.position.z);
      if (d < bd) { bd = d; best = e; }
    }
    return { e: best, d: bd };
  }

  // Algo perigoso chegando? (inimigo atacando perto, ou projétil vindo na direção dele)
  threat() {
    for (const e of this.combat.enemies) {
      if (!e.alive) continue;
      const dx = this.position.x - e.position.x, dz = this.position.z - e.position.z, d = Math.hypot(dx, dz);
      const busy = e.state === 'attack' || e.state === 'leap' || e.state === 'charge' || e.state === 'spin';
      if ((busy && d < (e.data.attackRange || 2) + 2) || d < 2.2) return { x: dx / (d || 1), z: dz / (d || 1) };
    }
    for (const a of this.combat.projectiles.list) {
      if (!a || a.owner === this || a.stuck >= 0 || a.hits === 'enemies' || a.hits === 'spell' || a.hits === 'hero') continue;
      const dx = this.position.x - a.x, dz = this.position.z - a.z, d = Math.hypot(dx, dz);
      if (d > 3.2) continue;
      const sp = Math.hypot(a.vx, a.vz) || 1;
      if ((a.vx * dx + a.vz * dz) / (sp * (d || 1)) < 0.8) continue; // não vem para cá
      return { x: -a.vz / sp, z: a.vx / sp };                       // sai de lado
    }
    return null;
  }

  startRoll(dir) {
    const R = ALLY.roll;
    let x = dir.x, z = dir.z;
    // Prefere rolar para onde tem espaço.
    const free = (sx, sz) => !this.world.blocked(this.position.x + sx * 3, this.position.z + sz * 3, 0.6);
    if (!free(x, z)) { const px = -z, pz = x; if (free(px, pz)) { x = px; z = pz; } else if (free(-px, -pz)) { x = -px; z = -pz; } }
    this.rollDir.set(x, 0, z).normalize();
    this.group.rotation.y = Math.atan2(x, z);
    this.state = 'roll'; this.t = 0;
    this.rollCd = R.cooldown;
    this.anim.play('Crouching', { fade: 0.06, restart: true });
    audio.play('dodge', this.position.x, this.position.z);
  }

  move(dx, dz, dist) {
    const steps = Math.max(1, Math.ceil(dist / 0.25));
    for (let i = 0; i < steps; i++) {
      this.position.x += dx * dist / steps; this.position.z += dz * dist / steps;
      this.world.resolveCircle(this.position, this.radius);
    }
    if (this.world.clampInside) this.world.clampInside(this.position, this.radius);
  }

  update(dt) {
    this.anim.update(dt);
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 5); this.setFlashLevel(this.flash); }
    if (!this.alive || this.state === 'gone') return;
    this.t += dt;
    this.cd -= dt; this.rollCd -= dt; this.volleyT -= dt;
    if (this.state === 'leave') {
      if (this.t > 1.6) {
        this.state = 'gone';
        this.combat.vfx.smoke(this.position.clone(), 0x7dff8a, 10);
        this.group.visible = false;
        if (this.onGone) this.onGone();
      }
      return;
    }
    if (this.state === 'roll') {
      const R = ALLY.roll;
      this.move(this.rollDir.x, this.rollDir.z, R.distance / R.time * dt);
      this.rollK = Math.min(1, this.t / R.time);
      this.applyRoll(this.rollK);
      if (this.t >= R.time) { this.clearRoll(); this.rollK = 0; this.toFight(); }
      return;
    }
    const foes = this.enemies();
    const { e: near, d: nd } = this.nearest(foes);
    // Rolar para fugir (não no meio da saraivada).
    if (this.state !== 'volleyAim' && this.rollCd <= 0) {
      const th = this.threat();
      if (th) { this.startRoll(th); return; }
    }
    if (!near) {
      if (this.state !== 'fight') this.toFight();
      this.anim.play('Idle_B', { fade: 0.2 });
      return;
    }
    // Alvo: o chefe se estiver perto o bastante, senão o mais perto.
    const boss = foes.find((e) => e.data.boss);
    const target = boss && Math.hypot(boss.position.x - this.position.x, boss.position.z - this.position.z) < 16 ? boss : near;
    const tp = target.position;
    if (this.state === 'aim' || this.state === 'volleyAim') {
      this.faceTo(tp, dt);
      const aim = this.state === 'aim' ? ALLY.arrow.aim : ALLY.volley.aim;
      if (this.t >= aim) { if (this.state === 'aim') this.shootAt(tp); else this.volley(tp); }
      return;
    }
    if (this.state === 'shot') { if (this.t >= ALLY.arrow.recover) this.toFight(); return; }
    // Andando: mantém distância.
    const K = ALLY.keep;
    let mx = 0, mz = 0;
    const tx = tp.x - this.position.x, tz = tp.z - this.position.z, td = Math.hypot(tx, tz) || 1;
    if (nd < K.flee) { mx = -(near.position.x - this.position.x) / nd; mz = -(near.position.z - this.position.z) / nd; }
    else if (td > K.far) { mx = tx / td; mz = tz / td; }
    if (mx || mz) {
      this.move(mx, mz, ALLY.speed * dt);
      this.group.rotation.y += wrap(Math.atan2(mx, mz) - this.group.rotation.y) * Math.min(1, dt * 12);
      this.anim.play('Running_A', { fade: 0.15 });
      if (nd >= K.flee) return; // chegando perto: anda primeiro
    } else {
      this.faceTo(tp, dt);
      this.anim.play('Idle_B', { fade: 0.2 });
    }
    if (this.volleyT <= 0) { this.state = 'volleyAim'; this.t = 0; this.anim.play('Ranged_2H_Aiming', { fade: 0.1 }); this.combat.text.add('Saraivada!', this.position, 'crit', 3.4); return; }
    if (this.cd <= 0) { this.state = 'aim'; this.t = 0; this.anim.play('Ranged_2H_Aiming', { fade: 0.1 }); }
  }

  toFight() { this.state = 'fight'; this.t = 0; }

  shootAt(tp) {
    const A = ALLY.arrow;
    const a = Math.atan2(tp.x - this.position.x, tp.z - this.position.z);
    this.group.rotation.y = a;
    this.combat.projectiles.fire(this.position.x + Math.sin(a) * 0.9, this.position.z + Math.cos(a) * 0.9, a, {
      speed: A.speed, damage: A.damage, height: 1.3, owner: this, hits: 'enemies',
    });
    this.shots++;
    this.cd = A.every;
    this.state = 'shot'; this.t = 0;
    this.anim.play('Ranged_2H_Shoot', { once: true, restart: true, fade: 0.05 });
  }

  volley(tp) {
    const V = ALLY.volley;
    const a0 = Math.atan2(tp.x - this.position.x, tp.z - this.position.z);
    for (let i = 0; i < V.count; i++) {
      const a = a0 + (i / (V.count - 1) - 0.5) * V.spread;
      this.combat.projectiles.fire(this.position.x + Math.sin(a) * 0.9, this.position.z + Math.cos(a) * 0.9, a, {
        speed: ALLY.arrow.speed, damage: V.damage, height: 1.3, owner: this, hits: 'enemies', silent: i > 0,
      });
    }
    this.volleys++;
    this.volleyT = V.every;
    this.cd = ALLY.arrow.every;
    this.state = 'shot'; this.t = 0;
    this.anim.play('Ranged_2H_Shoot', { once: true, restart: true, fade: 0.05 });
    if (this.combat.log) this.combat.log({ type: 'allyVolley' });
  }

  // Luta acabou: comemora e vai embora.
  leave() {
    if (!this.alive || this.state === 'leave' || this.state === 'gone') return;
    this.clearRoll();
    this.state = 'leave'; this.t = 0;
    this.anim.play('Cheering', { once: true, restart: true, fade: 0.15 });
    this.combat.text.add('Até a próxima!', this.position, 'gold', 3.4);
  }
}
