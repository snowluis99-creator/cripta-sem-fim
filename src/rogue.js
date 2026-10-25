// Ladino (rogue): munição das Kunais e da Besta, bomba de fumaça, aparar da Rapieira e o brilho da ultimate.
// Kunai: alcance infinito, dano MUITO baixo. Acertou um inimigo -> voa para cima e cai num círculo no chão;
//   pegar no círculo (estar dentro quando ela cai) devolve a carga com +1 de "corrente" (o dano cresce)
//   se for arremessada de novo logo. Errou (parede) ou deixou cair -> fica no chão até ser pega (corrente zera).
// Besta: virote para onde bater; acertou um inimigo -> cai no chão embaixo dele. Ande por cima para pegar.
// Tudo volta para a mão ao entrar numa sala nova.
import * as THREE from 'three';
import { audio } from './audio.js';
import { instance } from './assets.js';
import { setFlash } from './characters.js';
import { getGlowTexture } from './dungeon/builder.js';

export const KUNAI = {
  speed: 34, life: 4,
  base: 2, perStack: 3, maxStack: 15,  // dano = 2 + 3 por corrente (máx. 15 = 47)
  keep: 2.2,                           // segundos para arremessar de novo sem perder a corrente
  pop: { time: 0.85, height: 3.4, dist: 2.8, side: 1.0 }, // voo depois de acertar
  catchR: 1.35, catchEarly: 0.12,      // raio do círculo; pode pegar um pouquinho antes de cair
  pickR: 1.15,                         // pegar do chão andando por cima
  color: 0x6fe3ff,
};
export const BOLT = { speed: 40, life: 4, pickR: 1.15, color: 0xffc46a };
export const SMOKE = { time: 2, cooldown: 9 };
export const PARRY = { window: 0.2, total: 0.42, cooldown: 0.45, stun: 1.2, iframes: 0.35 };
export const ROGUE_ULT = { name: 'Precisão Invejável', time: 5 };
export const ROGUE_MODELS = ['weapons/extra/dagger_A.gltf', 'weapons/heroes/arrow_crossbow.gltf'];

const ring = (r0, r1, color, opacity) => {
  const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.position.y = 0.09;
  return m;
};

// Modelo do item voando/no chão (também desenhado no computador do Jogador 2).
export function makeRogueShot(kind) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  if (kind === 'kunai') {
    const k = instance(ROGUE_MODELS[0]);
    k.rotation.x = Math.PI / 2; // lâmina (+Y do modelo) apontando para a frente (+Z)
    k.position.z = -0.45;
    k.scale.setScalar(1.1);
    k.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0x2aa8d8); o.material.emissiveIntensity = 0.5; } });
    inner.add(k);
  } else {
    const a = instance(ROGUE_MODELS[1]);
    a.rotation.x = -Math.PI / 2; // virote: ponta em -Y no modelo
    a.scale.setScalar(1.8);
    inner.add(a);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: kind === 'kunai' ? KUNAI.color : BOLT.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
  s.scale.setScalar(1.1);
  g.add(inner, s);
  g.userData.inner = inner;
  return g;
}

const isRogue = (p) => p && p.heroId === 'rogue';
const ammoKind = (p) => (p.hero.ammo ? p.hero.ammo.kind : null);

export class RogueKit {
  // g: { scene, combat, vfx, run }
  constructor(g) {
    Object.assign(this, g);
    this.items = [];    // { kind, owner, state: 'fly'|'pop'|'ground', x, z, ... }
    this.seq = 100000;  // ids para o co-op (não bater com os projéteis comuns)
    this.room = -1;
  }

  // ---------- Munição do herói ----------
  // Enche a mão (nova sala, troca de arma, começo da descida) e tira do chão o que era dele.
  refill(p) {
    const a = p.hero.ammo;
    p.ammo = a ? Array.from({ length: a.max }, () => ({ stack: 0, keep: 0 })) : [];
    this.removeOwned(p);
  }
  removeOwned(p) {
    for (let i = this.items.length - 1; i >= 0; i--) if (this.items[i].owner === p) this.drop(i);
  }
  drop(i) {
    const it = this.items[i];
    this.scene.remove(it.g);
    if (it.mark) this.scene.remove(it.mark);
    this.items.splice(i, 1);
  }
  clear() { for (let i = this.items.length - 1; i >= 0; i--) this.drop(i); }

  // Carga a usar: a de maior corrente (se ainda valer).
  takeCharge(p) {
    if (!p.ammo || !p.ammo.length) return null;
    let bi = 0;
    for (let i = 1; i < p.ammo.length; i++) if (p.ammo[i].stack > p.ammo[bi].stack) bi = i;
    return p.ammo.splice(bi, 1)[0];
  }

  // Golpe de arremesso (chamado no momento do golpe em vez do corte): kunai ou virote.
  fire(p, step) {
    const c = this.takeCharge(p);
    if (!c) return;
    const kind = step.throw, a = p.facing;
    const x = p.position.x + Math.sin(a) * 0.8, z = p.position.z + Math.cos(a) * 0.8;
    const cfg = kind === 'kunai' ? KUNAI : BOLT;
    const g = makeRogueShot(kind);
    g.position.set(x, 1.3, z);
    g.rotation.y = a;
    this.scene.add(g);
    this.items.push({ id: ++this.seq, kind, owner: p, state: 'fly', x, z, y: 1.3, a, vx: Math.sin(a) * cfg.speed, vz: Math.cos(a) * cfg.speed,
      life: cfg.life, stack: kind === 'kunai' ? c.stack : 0, g, step, sneak: !!p.sneakCrit });
    p.sneakCrit = false;
    audio.play(kind === 'kunai' ? 'swing' : 'arrow', x, z);
    if (this.combat.log) this.combat.log({ type: 'rogueFire', kind, stack: c.stack });
  }

  // Dano do item num inimigo (passa pelo dano normal: crítico, bênçãos, escudo do Guerreiro).
  hitEnemy(it, e) {
    const sp = Math.hypot(it.vx, it.vz) || 1, nx = it.vx / sp, nz = it.vz / sp;
    const dmg = it.kind === 'kunai' ? KUNAI.base + KUNAI.perStack * Math.min(it.stack, KUNAI.maxStack) : it.step.damage;
    const step = { damage: dmg, heavy: false };
    return this.combat.damageEnemy(it.owner, e, step, nx, nz, { ranged: true, forceCrit: it.sneak });
  }

  // Item vira "no chão" num ponto (fica parado até o dono passar por cima).
  toGround(it, x, z) {
    const v = new THREE.Vector3(x, 0, z);
    const w = this.combat.world;
    if (w) { w.resolveCircle(v, 0.45); if (w.clampInside) w.clampInside(v, 0.45); }
    it.state = 'ground';
    it.x = v.x; it.z = v.z; it.stack = 0;
    it.g.position.set(v.x, 0.18, v.z);
    it.g.userData.inner.rotation.set(0, 0, 0);
    it.g.rotation.set(0, it.a, 0);
    it.g.children[1].material.opacity = 0.35;
    if (it.mark) this.scene.remove(it.mark);
    it.mark = ring(0.55, 0.75, it.kind === 'kunai' ? KUNAI.color : BOLT.color, 0.5);
    it.mark.position.set(v.x, 0.09, v.z);
    this.scene.add(it.mark);
    it.t = 0;
  }

  // Kunai acertou: sobe girando e cai num ponto um pouco além do inimigo (círculo mostra onde).
  toPop(it, e) {
    const P = KUNAI.pop, sp = Math.hypot(it.vx, it.vz) || 1, dx = it.vx / sp, dz = it.vz / sp;
    const side = (Math.random() * 2 - 1) * P.side;
    const to = new THREE.Vector3(e.position.x + dx * P.dist - dz * side, 0, e.position.z + dz * P.dist + dx * side);
    const w = this.combat.world;
    if (w) { w.resolveCircle(to, 0.6); if (w.clampInside) w.clampInside(to, 0.6); }
    it.state = 'pop';
    it.t = 0;
    it.from = new THREE.Vector3(it.x, it.y, it.z);
    it.to = to;
    it.mark = new THREE.Group();
    it.mark.add(ring(KUNAI.catchR - 0.22, KUNAI.catchR, KUNAI.color, 1));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(KUNAI.catchR, 36).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: KUNAI.color, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
    fill.position.y = 0.08;
    it.mark.add(fill);
    it.mark.userData.fill = fill;
    it.mark.position.set(to.x, 0, to.z);
    this.scene.add(it.mark);
  }

  catchKunai(it, idx, p) {
    const stack = Math.min(KUNAI.maxStack, it.stack + 1);
    p.ammo.push({ stack, keep: KUNAI.keep });
    this.drop(idx);
    this.combat.text.add(`Pegou! ×${stack + 1}`, p.position, 'crit', 3.2);
    this.vfx.sparks(new THREE.Vector3(p.position.x, 1.3, p.position.z), KUNAI.color, 10);
    audio.play('gold', p.position.x, p.position.z);
    if (this.combat.log) this.combat.log({ type: 'kunaiCatch', stack });
  }

  pickUp(it, idx, p) {
    p.ammo.push({ stack: 0, keep: 0 });
    this.drop(idx);
    this.combat.text.add(it.kind === 'kunai' ? '+1 kunai' : '+1 virote', p.position, 'miss', 2.8);
    audio.play('potion', p.position.x, p.position.z, { v: 0.5 });
    if (this.combat.log) this.combat.log({ type: 'ammoPick', kind: it.kind });
  }

  updateItem(it, i, dt) {
    const c = this.combat, p = it.owner;
    if (it.state === 'fly') {
      it.life -= dt;
      if (it.life <= 0) { this.toGround(it, it.x, it.z); return; }
      let left = Math.hypot(it.vx, it.vz) * dt;
      const sp = Math.hypot(it.vx, it.vz), dx = it.vx / sp, dz = it.vz / sp;
      while (left > 0) {
        const st = Math.min(0.3, left);
        left -= st;
        it.x += dx * st; it.z += dz * st;
        if (c.world.blocked(it.x, it.z, 0.05)) {
          c.vfx.sparks(new THREE.Vector3(it.x, 1.2, it.z), 0xffffff, 5);
          audio.play('block', it.x, it.z, { v: 0.5 });
          this.toGround(it, it.x - dx * 0.6, it.z - dz * 0.6);
          if (c.log) c.log({ type: 'ammoWall', kind: it.kind });
          return;
        }
        const e = c.enemies.find((en) => en.targetable && Math.hypot(en.position.x - it.x, en.position.z - it.z) < en.data.radius + 0.3);
        if (e) {
          const r = this.hitEnemy(it, e);
          if (it.kind === 'kunai' && (r === 'hit' || r === 'kill')) this.toPop(it, e);
          else this.toGround(it, e.position.x - dx * 0.3, e.position.z - dz * 0.3); // virote / bloqueado: cai embaixo dele
          return;
        }
      }
      it.g.position.set(it.x, it.y, it.z);
      return;
    }
    if (it.state === 'pop') {
      const P = KUNAI.pop;
      it.t += dt;
      const k = Math.min(1, it.t / P.time);
      it.x = it.from.x + (it.to.x - it.from.x) * k;
      it.z = it.from.z + (it.to.z - it.from.z) * k;
      it.y = it.from.y * (1 - k) + 0.2 * k + Math.sin(k * Math.PI) * P.height;
      it.g.position.set(it.x, it.y, it.z);
      it.g.userData.inner.rotation.x += dt * 18; // gira no ar
      const fill = it.mark.userData.fill;
      fill.scale.setScalar(0.15 + 0.85 * k);  // o círculo vai enchendo até a hora de pegar
      fill.material.opacity = 0.1 + 0.3 * k;
      const near = p && p.state !== 'dead' && Math.hypot(p.position.x - it.to.x, p.position.z - it.to.z) <= KUNAI.catchR + p.hero.radius * 0.5;
      if (near && it.t >= P.time - KUNAI.catchEarly && isRogue(p) && ammoKind(p) === 'kunai') { this.catchKunai(it, i, p); return; }
      if (k >= 1) {
        this.vfx.sparks(new THREE.Vector3(it.to.x, 0.4, it.to.z), KUNAI.color, 5);
        this.toGround(it, it.to.x, it.to.z);
        if (c.log) c.log({ type: 'kunaiMissed' });
      }
      return;
    }
    // No chão: pisca de leve; o dono pega andando por cima.
    it.t = (it.t || 0) + dt;
    if (it.mark) it.mark.material.opacity = 0.35 + 0.25 * Math.sin(it.t * 5);
    const cfg = it.kind === 'kunai' ? KUNAI : BOLT;
    if (p && isRogue(p) && ammoKind(p) === it.kind && p.state !== 'dead' && Math.hypot(p.position.x - it.x, p.position.z - it.z) <= cfg.pickR + p.hero.radius * 0.5) this.pickUp(it, i, p);
  }

  // ---------- Bomba de fumaça (botão direito das armas sem aparar) ----------
  smoke(p) {
    if (p.smokeCd > 0) {
      if (!p.smokeWarnCd) { this.combat.text.add(`Fumaça em ${Math.ceil(p.smokeCd)} s`, p.position, 'miss', 3); p.smokeWarnCd = 0.8; }
      return false;
    }
    p.smokeCd = SMOKE.cooldown;
    p.stealth = SMOKE.time;
    p.sneakCrit = true;
    const at = new THREE.Vector3(p.position.x, 0.2, p.position.z);
    this.vfx.smoke(at, 0x8a8f9c, 14);
    this.vfx.smoke(at, 0x55596a, 10);
    this.vfx.puff(at);
    audio.play('dodge', p.position.x, p.position.z, { v: 1.3 });
    this.combat.text.add('Sumiu!', p.position, 'miss', 3.2);
    // Os esqueletos que estavam atacando ficam perdidos por um instante.
    for (const e of this.combat.enemies) if (e.alive && e.target === p && !e.data.boss && e.state === 'chase') e.cooldown = Math.max(e.cooldown, 1);
    if (this.combat.log) this.combat.log({ type: 'smoke' });
    return true;
  }

  // ---------- Aparar (Rapieira) ----------
  // Chamado pelo combate quando um golpe chega no herói. Devolve true se aparou (sem dano).
  tryParry(p, e, opts) {
    if (p.state !== 'parry' || p.stateTime > PARRY.window || opts.contact) return false;
    const c = this.combat;
    p.iframes = Math.max(p.iframes, PARRY.iframes);
    p.parryCrit = true;
    p.setState('idle');
    p.anim.play('Melee_Block_Attack', { once: true, restart: true, speed: 2.4, fade: 0.04, onFinish: () => { if (p.state === 'idle') p.anim.play(p.hero.anims.idle, { fade: 0.15 }); } });
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
    if (e.alive && e.repelled && !opts.noRepel) { e.repelled(dx / d, dz / d); e.stunTime = e.data.boss ? 0.5 : PARRY.stun; }
    c.text.add('Aparou!', p.position, 'crit', 3.4);
    c.vfx.sparks(new THREE.Vector3(p.position.x + dx / d * 0.7, 1.4, p.position.z + dz / d * 0.7), 0xffe27a, 18);
    audio.play('shieldBlock', p.position.x, p.position.z, { v: 1.3 });
    c.addHitstop(0.1);
    c.shakeFor(p, 0.15);
    if (c.log) c.log({ type: 'parry' });
    return true;
  }

  // ---------- A cada quadro ----------
  update(dt) {
    const run = this.run;
    if (run && run.roomVersion !== this.room) { // sala nova: tudo volta para a mão
      this.room = run.roomVersion;
      this.clear();
      for (const p of this.combat.players) if (isRogue(p)) this.refill(p);
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (!it.owner || !this.combat.players.includes(it.owner)) { this.drop(i); continue; }
      this.updateItem(it, i, dt);
    }
    for (const p of this.combat.players) this.updateHero(p, dt);
  }

  updateHero(p, dt) {
    if (!isRogue(p)) { if (p.stealthShown) this.setGhost(p, 1); return; }
    p.smokeCd = Math.max(0, (p.smokeCd || 0) - dt);
    p.smokeWarnCd = Math.max(0, (p.smokeWarnCd || 0) - dt);
    if (p.stealth > 0) { p.stealth = Math.max(0, p.stealth - dt); if (p.stealth <= 0) p.sneakCrit = false; }
    if (p.state === 'dead') p.stealth = 0;
    this.setGhost(p, p.stealth > 0 ? 0.3 + 0.08 * Math.sin(performance.now() / 70) : 1);
    // Corrente da kunai: se demorar para arremessar de novo, zera.
    for (const a of p.ammo || []) if (a.stack > 0 && (a.keep -= dt) <= 0) {
      a.stack = 0;
      this.combat.text.add('Corrente perdida', p.position, 'miss', 3);
    }
    // Precisão Invejável: arma brilhando em vermelho-dourado.
    if (p.ultTime > 0 && p.glowMats) for (const m of p.glowMats) { m.emissive.setRGB(1, 0.25, 0.1); m.emissiveIntensity = 0.9 + 0.5 * Math.sin(performance.now() / 90); }
    else if (p.ultGlowOn && p.glowMats) for (const m of p.glowMats) m.emissiveIntensity = 0;
    p.ultGlowOn = p.ultTime > 0;
    if (p.ultTime > 0 && p.state !== 'dead') setFlash(p.bodyMats, 0.12, 1, 0.3, 0.1);
  }

  // Invisível: o modelo fica transparente.
  setGhost(p, a) {
    const k = Math.round(a * 50) / 50;
    if (p.stealthShown === k) return;
    p.stealthShown = k;
    p.model.traverse((o) => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) { m.transparent = k < 1; m.opacity = k; m.depthWrite = k >= 1; }
    });
  }

  // Co-op: o que o Jogador 2 desenha (mesmo formato dos projéteis: id, tipo, cor, escala, x, z, y, ângulo, velocidade).
  netList(kinds) {
    return this.items.map((it) => [it.id, kinds.indexOf(it.kind), it.kind === 'kunai' ? KUNAI.color : BOLT.color, 1,
      Math.round(it.x * 100) / 100, Math.round(it.z * 100) / 100, Math.round((it.state === 'ground' ? 0.18 : it.y) * 100) / 100,
      Math.round(it.a * 100) / 100, it.state === 'fly' ? Math.round(Math.hypot(it.vx, it.vz)) : 0]);
  }
}

// Texto da munição no HUD (Jogador 1 e 2).
export function ammoInfo(p) {
  const a = p.hero && p.hero.ammo;
  if (!a) return null;
  const n = (p.ammo || []).length, best = Math.max(0, ...(p.ammo || []).map((c) => c.stack));
  return { n, max: a.max, kind: a.kind, stack: best };
}

// Jogador 2 (só desenha): deixa o Ladino transparente enquanto está invisível.
const ghostKit = { setGhost: RogueKit.prototype.setGhost };
export function ammoSmoke(p, hidden) {
  if (!p.model) return;
  ghostKit.setGhost.call(ghostKit, p, hidden ? 0.3 : 1);
}
