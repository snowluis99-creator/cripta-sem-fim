// O Mercador: fica na sala dele durante o combate e depois vende os itens.
// Se alguém bate nele (herói ou esqueleto), ele revida com um tiro de besta em quem bateu.
// Só o herói pode matá-lo; os esqueletos deixam ele no máximo com 1 de vida. Morto = sem trocas.
import * as THREE from 'three';
import { makeCharacter, attachWeapon, makeFlashable, setFlash } from './characters.js';
import { Animator } from './animation.js';

export const MERCHANT = {
  hp: 80,
  radius: 0.75,
  aim: 0.4,             // tempo mirando antes do tiro (s)
  recover: 0.35,        // depois do tiro
  speed: 22,            // velocidade da flecha
  damageToHero: 12,
  damageToEnemy: 26,
  weapon: { model: 'weapons/heroes/crossbow_2handed.gltf', rot: [0, 0, 0] },
};
export const MERCHANT_MODELS = ['heroes/Rogue_Hooded.glb', MERCHANT.weapon.model];

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Merchant {
  constructor(scene, combat, x, z) {
    this.combat = combat;
    const { group, model } = makeCharacter(MERCHANT_MODELS[0]);
    group.position.set(x, 0, z);
    scene.add(group);
    this.group = group;
    this.model = model;
    this.position = group.position;
    attachWeapon(model, 'handslot.r', MERCHANT.weapon);
    this.anim = new Animator(model);
    this.anim.play('Idle_B');
    this.flashMats = makeFlashable(model).mats;
    this.flash = 0;
    this.hp = MERCHANT.hp;
    this.alive = true;
    this.waved = false;
    this.state = 'idle';    // idle | aim | shot | dead
    this.t = 0;
    this.target = null;     // 'player' ou um esqueleto
    this.queue = [];        // quem ainda vai levar o troco
    this.onDeath = null;
    this.shots = 0;         // contagem (teste automático)
    combat.merchant = this;
  }

  get radius() { return MERCHANT.radius; }

  setFlashLevel(v) { setFlash(this.flashMats, v); }
  // Cambalhota (mercador contratado; igual à do herói).
  applyRoll(t) {
    const c = 0.9, k = Math.min(Math.max(t, 0), 1), e = k * k * (3 - 2 * k), a = e * Math.PI * 2;
    this.model.rotation.x = a;
    this.model.position.set(0, c - c * Math.cos(a) - Math.sin(k * Math.PI) * 0.35, -c * Math.sin(a));
  }
  clearRoll() { this.model.rotation.x = 0; this.model.position.set(0, 0, 0); }

  // Alguém bateu no mercador. attacker = 'player' ou o esqueleto.
  hit(dmg, attacker) {
    if (!this.alive) return false;
    if (attacker === 'player') attacker = this.combat.player;
    const byPlayer = !!(attacker && attacker.hero); // um dos heróis
    if (!byPlayer) dmg = Math.min(dmg, this.hp - 1); // esqueletos não matam o mercador
    dmg = Math.max(0, dmg);
    this.hp -= dmg;
    this.flash = 1;
    const c = this.combat;
    c.text.add(dmg > 0 ? String(dmg) : 'Ai!', this.position, 'dmg');
    c.vfx.sparks(new THREE.Vector3(this.position.x, 1.3, this.position.z), 0xffffff, 6);
    if (c.log) c.log({ type: 'merchantHit', dmg, byPlayer, hp: this.hp });
    if (this.hp <= 0) { this.die(); return true; }
    if (this.state === 'idle') this.anim.play('Hit_A', { once: true, restart: true, fade: 0.05, onFinish: () => this.state === 'idle' && this.anim.play('Idle_B') });
    if (this.target !== attacker && !this.queue.includes(attacker)) this.queue.push(attacker);
    if (Math.random() < 0.5) c.text.add(byPlayer ? 'Ei!' : 'Fora daqui!', this.position, 'block', 3.4);
    return false;
  }

  die() {
    this.alive = false;
    this.hp = 0;
    this.state = 'dead';
    this.queue.length = 0;
    this.combat.text.add('O mercador morreu', this.position, 'crit', 3.6);
    this.anim.play('Death_A', { once: true, restart: true, fade: 0.08 });
    if (this.onDeath) this.onDeath();
  }

  targetPos(tg) {
    if (tg && tg.hero) return tg.state === 'dead' ? null : tg.position;
    return tg && tg.alive ? tg.position : null;
  }

  faceTo(p, dt, speed = 14) {
    const want = Math.atan2(p.x - this.position.x, p.z - this.position.z);
    const d = wrap(want - this.group.rotation.y);
    this.group.rotation.y += d * Math.min(1, dt * speed);
  }

  update(dt) {
    this.anim.update(dt);
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 5); setFlash(this.flashMats, this.flash); }
    if (!this.alive) return;
    const pl = this.combat.nearestPlayer ? this.combat.nearestPlayer(this.position.x, this.position.z) : this.combat.player;
    this.t += dt;
    if (this.state === 'idle') {
      // Próximo da fila (pula esqueleto que já morreu e herói morto).
      while (this.queue.length) {
        const tg = this.queue.shift();
        if (tg && tg.hero ? tg.state === 'dead' : !(tg && tg.alive)) continue;
        this.target = tg; this.state = 'aim'; this.t = 0;
        this.anim.play('Ranged_2H_Aiming', { fade: 0.1 });
        break;
      }
      if (this.state === 'idle') { this.faceTo(pl.position, dt, 6); return; }
    }
    const tp = this.targetPos(this.target);
    if (this.state === 'aim') {
      if (!tp) { this.toIdle(); return; }
      this.faceTo(tp, dt);
      if (this.t >= MERCHANT.aim) this.shoot(tp);
      return;
    }
    if (this.state === 'shot' && this.t >= MERCHANT.recover) this.toIdle();
  }

  toIdle() {
    this.state = 'idle'; this.target = null; this.t = 0;
    this.anim.play('Idle_B', { fade: 0.2 });
  }

  shoot(tp) {
    const a = Math.atan2(tp.x - this.position.x, tp.z - this.position.z);
    this.group.rotation.y = a;
    const atPlayer = !!(this.target && this.target.hero);
    this.combat.projectiles.fire(this.position.x + Math.sin(a) * 0.9, this.position.z + Math.cos(a) * 0.9, a, {
      speed: MERCHANT.speed, damage: atPlayer ? MERCHANT.damageToHero : MERCHANT.damageToEnemy,
      height: 1.3, owner: this, hits: atPlayer ? 'player' : 'enemies',
    });
    this.shots++;
    this.state = 'shot'; this.t = 0;
    this.anim.play('Ranged_2H_Shoot', { once: true, restart: true, fade: 0.05 });
  }
}
