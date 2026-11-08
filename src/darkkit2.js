// Bênçãos do Cajado das Trevas, parte 2 (lista do dono, 07/11/2026): as "médias" e as "difíceis".
// Médias: Troca Sombria, Cadáver Explosivo, Último Suspiro, Guarda-Costas, Elo de Almas, Pavor, Possessão, Coletora de Almas.
// Difíceis: Herança, Gigante de Ossos, Mãos da Cova, Escuridão, Traição, Sombra Faminta.
// Sem import de combat.js (o combate cria a DarkKit2 e chama os ganchos). undead.js chama por combat.dark2 (sem import circular).
import * as THREE from 'three';
import { audio } from './audio.js';
import { getGlowTexture } from './dungeon/builder.js';
import { isDark } from './darkkit.js';
import { markDark, undeadDied, hitUndead } from './undead.js';
import { fear } from './axekit3.js';

export const DARK2 = {
  swap: { range: 16 },                         // Troca Sombria: troca com o morto-vivo mais perto (até 16)
  corpse: { dmg: 15, r: 3 },                   // Cadáver Explosivo: dano e raio da explosão
  ghost: { range: 14, speed: 9 },              // Último Suspiro: o fantasma procura até 14 de distância
  guard: { range: 6, cd: 2 },                  // Guarda-Costas: morto-vivo até 6 de distância; no máximo 1 a cada 2 s
  link: 0.5,                                   // Elo de Almas: metade do dano vai para os mortos-vivos
  fear: 2,                                     // Pavor: foge por 2 s
  possess: 0.25,                               // Possessão: menos de 25% de vida
  souls: { max: 5, dmg: 6, speed: 16, range: 16 }, // Coletora de Almas
  heir: { hp: 0.5, guardR: 5 },                // Herança: levanta com metade da vida; guarda protege num raio de 5 da Maga
  giant: { n: 3, scale: 1.6, hp: 40, dmg: 2.5, merge: 0.6 }, // Gigante de Ossos
  hands: { r: 3, t: 1.5 },                     // Mãos da Cova
  dark: { n: 3, every: 3 },                    // Escuridão: com 3 mortos-vivos, 1 de cada 3 ataques erra
  betray: { every: 2.5, chance: 0.4, time: 3, range: 10, grudge: 3 }, // Traição
  shadow: { r: 1.7, dmg: 2, tick: 0.5 },       // Sombra Faminta
};
const PURPLE = 0x9a4dff;
const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const dist = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
let K = null;

// Peças das mãos de esqueleto (feitas aqui mesmo: os pacotes não têm mão).
const boneMat = new THREE.MeshStandardMaterial({ color: 0xd9d0b4, roughness: 0.9 });
const armGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.75, 6);
const palmGeo = new THREE.BoxGeometry(0.22, 0.22, 0.08);
const fingerGeo = new THREE.BoxGeometry(0.045, 0.2, 0.045);
function makeHand() {
  const g = new THREE.Group(), h = new THREE.Group();
  const arm = new THREE.Mesh(armGeo, boneMat); arm.position.y = 0.37;
  const palm = new THREE.Mesh(palmGeo, boneMat); palm.position.y = 0.82;
  h.add(arm, palm);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(fingerGeo, boneMat);
    f.position.set(-0.08 + i * 0.053, 1.0, 0.03); f.rotation.x = 0.5; h.add(f);
  }
  const th = new THREE.Mesh(fingerGeo, boneMat); th.position.set(0.14, 0.86, 0.03); th.rotation.z = -0.9; h.add(th);
  g.add(h); g.userData.h = h;
  return g;
}
function glowBall(color, size, core) {
  const g = new THREE.Group();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(size);
  const m = new THREE.Mesh(new THREE.SphereGeometry(size * 0.14, 8, 6), new THREE.MeshBasicMaterial({ color: core }));
  g.add(s, m);
  return g;
}

// Troca Sombria: ao rolar, a Maga troca de lugar com o morto-vivo dela mais perto (o rolamento continua normal).
export function darkSwap(p) { return K ? K.swap(p) : false; }

export class DarkKit2 {
  constructor(c) {
    this.c = c; K = this;
    this.ghosts = []; this.shots = []; this.hands = []; this.merges = [];
    this.shadows = new Map();
    this.veilOn = false;
    this.rand = Math.random; // teste: dá para trocar por um número fixo
  }
  log(o) { if (this.c.log) this.c.log(o); }
  mine(p) { return this.c.enemies.filter((u) => u.undead === p && u.alive); }
  foes() { return this.c.enemies.filter((o) => !o.undead && o.targetable); }
  nearestFoe(x, z, range, skip = null, markable = false) {
    let best = null, bd = range;
    for (const o of this.c.enemies) {
      if (o === skip || o.undead || !o.alive || !o.targetable) continue;
      if (markable && (o.data.boss || o.data.phantom)) continue;
      const d = Math.hypot(o.position.x - x, o.position.z - z);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // ---------- Troca Sombria ----------
  swap(p) {
    if (!isDark(p) || !W(p).dSwap) return false;
    let u = null, bd = DARK2.swap.range;
    for (const o of this.mine(p)) { if (o.state === 'spawn') continue; const d = dist(o, p); if (d < bd) { bd = d; u = o; } }
    if (!u) return false;
    const c = this.c, px = p.position.x, pz = p.position.z;
    c.vfx.beamLine(v3(px, 1.1, pz), v3(u.position.x, 1.1, u.position.z), PURPLE, 0.25);
    c.vfx.smoke(p.position, PURPLE, 8);
    p.position.x = u.position.x; p.position.z = u.position.z;
    u.position.x = px; u.position.z = pz; u.vel.set(0, 0, 0);
    c.vfx.smoke(p.position, PURPLE, 8); c.vfx.smoke(u.position, PURPLE, 6);
    c.text.add('Troca!', p.position, 'bleed', 3.0);
    audio.play('summon', p.position.x, p.position.z);
    this.log({ type: 'darkSwap' });
    return true;
  }

  // ---------- Cadáver Explosivo ----------
  // Orbe do golpe forte encostou num morto-vivo da Maga: ele explode.
  corpseCheck(a) {
    const p = a.owner;
    if (!a.step || !a.step.heavy || !isDark(p) || !W(p).dCorpse) return false;
    const u = this.c.enemies.find((o) => o.undead === p && o.alive && o.state !== 'spawn' && Math.hypot(o.position.x - a.x, o.position.z - a.z) < o.data.radius + a.r);
    if (!u) return false;
    this.explode(p, u);
    return true;
  }
  explode(p, u) {
    const c = this.c, R = DARK2.corpse, at = v3(u.position.x, 0, u.position.z);
    const r = R.r * (u.giant ? 1.4 : 1), dmg = Math.max(1, Math.round(R.dmg * (p.stats.damageMul || 1)));
    u.die(); undeadDied(c, u);
    c.vfx.heavyImpact(at, r / 2.3);
    c.vfx.ring(at, PURPLE, r);
    c.vfx.smoke(u.position, 0x3a0a6a, 14);
    let n = 0;
    for (const e of [...c.enemies]) {
      if (e.undead || !e.targetable) continue;
      const dx = e.position.x - at.x, dz = e.position.z - at.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > r + e.data.radius) continue;
      c.bonusDamage(e, dmg, dx / d, dz / d, 'crit', p); n++;
    }
    c.text.add('Bum!', u.position, 'bleed', 3.2);
    audio.play('boom', at.x, at.z);
    c.addHitstop(0.06); c.shakeFor(p, 0.3);
    this.log({ type: 'darkCorpse', n, dmg });
  }

  // ---------- Último Suspiro ----------
  onUndeadDeath(u) {
    const p = u.undead;
    if (!p || !p.hero || !W(p).dGhost || u.merging || u.ghostDone) return;
    u.ghostDone = true;
    const t = this.nearestFoe(u.position.x, u.position.z, DARK2.ghost.range, null, true);
    if (!t) return;
    const g = glowBall(0xd8e8ff, 1.3, 0xffffff);
    g.position.set(u.position.x, 1.4, u.position.z);
    this.c.scene.add(g);
    this.ghosts.push({ g, p, t, life: 4 });
    this.log({ type: 'darkGhost' });
  }

  // ---------- Guarda-Costas e Escuridão (antes do dano no herói) ----------
  darkOn(p) {
    let n = 0;
    for (const u of this.mine(p)) n += u.giant ? DARK2.giant.n : 1; // o Gigante conta como os 3 que ele juntou
    return n >= DARK2.dark.n;
  }
  protect(p, e, base, opts) {
    if (!isDark(p) || opts.contact) return false;
    const w = W(p), c = this.c;
    if (w.dDark && this.darkOn(p)) { // Escuridão: 1 de cada 3 ataques erra
      p.dMissN = (p.dMissN || 0) + 1;
      if (p.dMissN >= DARK2.dark.every) {
        p.dMissN = 0;
        c.text.add('Errou!', p.position, 'miss');
        audio.play('miss', p.position.x, p.position.z);
        this.log({ type: 'darkMiss' });
        return true;
      }
    }
    if (w.dGuard && !(p.dGuardCd > 0) && e && e.position) { // Guarda-Costas: o morto-vivo mais perto entra na frente
      let u = null, bd = DARK2.guard.range;
      for (const o of this.mine(p)) { if (o.state === 'spawn' || o.merging) continue; const d = dist(o, p); if (d < bd) { bd = d; u = o; } }
      if (u) {
        p.dGuardCd = DARK2.guard.cd;
        const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
        c.vfx.smoke(u.position, PURPLE, 5);
        u.position.x = p.position.x + (dx / d) * 1.0; u.position.z = p.position.z + (dz / d) * 1.0;
        u.facing = Math.atan2(dx, dz); u.group.rotation.y = u.facing;
        c.world.resolveCircle(u.position, u.data.radius);
        c.vfx.smoke(u.position, PURPLE, 6);
        c.text.add('Protegeu!', u.position, 'block', 3.0);
        hitUndead(c, u, base, e.position.x, e.position.z);
        this.log({ type: 'darkGuard' });
        return true;
      }
    }
    return false;
  }

  // ---------- Elo de Almas (depois de calcular o dano no herói) ----------
  link(p, dmg) {
    if (!isDark(p) || !W(p).dLink) return dmg;
    const us = this.mine(p).filter((u) => u.state !== 'spawn' && !u.merging);
    const share = Math.floor(dmg * DARK2.link);
    if (!us.length || share <= 0) return dmg;
    const u = us.reduce((a, b) => (a.hp >= b.hp ? a : b));
    this.c.vfx.beamLine(v3(p.position.x, 1.2, p.position.z), v3(u.position.x, 1.2, u.position.z), PURPLE, 0.18);
    u.noBlockOnce = true; // o escudo do guarda não segura o Elo
    hitUndead(this.c, u, share, p.position.x, p.position.z);
    u.noBlockOnce = false;
    this.log({ type: 'darkLink', share });
    return dmg - share;
  }

  // ---------- Pavor e Possessão (golpe forte da Maga acertou) ----------
  onHeavyHit(p, e, step) {
    if (!step.heavy || !isDark(p) || !e.alive || e.undead) return;
    const w = W(p);
    if (w.dPossess && !e.data.boss && !e.data.phantom && !e.finale && e.hp <= e.maxHp * DARK2.possess) { this.possess(p, e); return; }
    if (w.dFear && e.darkMark && fear(e, p, DARK2.fear)) {
      this.c.text.add('Pavor!', e.position, 'bleed', 3.2);
      this.log({ type: 'darkFear', enemy: e });
    }
  }
  possess(p, e) {
    const c = this.c, d = e.data;
    e.data = { ...d, attackRange: d.ranged ? d.attackRange : Math.max(d.attackRange || 0, 2.0), voice: undefined };
    e.undead = p; e.possessed = true;
    e.noGrave = true; e.noUltCharge = true; e.provokedBy = null; e.darkMark = null; e.betrayLeft = 0; e.grudgeT = 0;
    if (e.darkFx) { e.darkFx.s.visible = false; e.darkFx.skull.visible = false; }
    e.releaseToken();
    e.vel.set(0, 0, 0);
    e.hp = Math.max(e.hp, Math.round(e.maxHp * 0.5)) + (W(p).undeadHp || 0);
    e.setState('hurt'); e.stunTime = 0.5;
    for (const o of c.enemies) { if (o.target === e) o.target = null; if (o.provokedBy === e) o.provokedBy = null; }
    c.vfx.ring(v3(e.position.x, 0, e.position.z), PURPLE, 1.8);
    c.vfx.smoke(e.position, PURPLE, 12);
    c.text.add('Possuído!', e.position, 'heal', 3.4);
    audio.play('rise', e.position.x, e.position.z);
    this.log({ type: 'darkPossess', enemy: e });
    this.onRise(e, {});
  }

  // ---------- Coletora de Almas ----------
  onMarkedDeath(e) {
    const p = e.darkMark;
    if (!p || !W(p).dSouls || p.state === 'dead') return;
    const list = p.dSoulList || (p.dSoulList = []);
    if (list.length >= DARK2.souls.max) return;
    const g = glowBall(0x7dfff0, 0.8, 0xe8fffb);
    g.position.set(e.position.x, 1.4, e.position.z);
    this.c.scene.add(g);
    list.push({ g, p, k: 0 });
    this.c.text.add('Alma!', e.position, 'heal small', 3.0);
    this.log({ type: 'darkSoul', n: list.length });
  }
  heavyCast(p, step) {
    if (!step.heavy || !isDark(p) || !W(p).dSouls || !p.dSoulList || !p.dSoulList.length) return;
    const foes = this.foes().filter((o) => dist(o, p) < DARK2.souls.range).sort((a, b) => dist(a, p) - dist(b, p));
    if (!foes.length) return;
    const dmg = Math.max(1, Math.round(DARK2.souls.dmg * (p.stats.damageMul || 1)));
    p.dSoulList.forEach((s, i) => this.shots.push({ g: s.g, p, t: foes[i % foes.length], dmg, life: 3 }));
    this.log({ type: 'darkSouls', n: p.dSoulList.length });
    p.dSoulList = [];
    audio.play('orb', p.position.x, p.position.z);
  }

  // ---------- Herança ----------
  // Arqueiro/mago já levantam atirando; com a Herança levantam com metade da vida e quem tem escudo vira guarda da Maga.
  heirTarget(u) {
    if (!u.guard) return null;
    const p = u.undead;
    if (!p || p.state === 'dead') return null;
    const near = this.nearestFoe(p.position.x, p.position.z, DARK2.heir.guardR);
    if (near) { u.idleT = 0; return near; }
    const any = this.nearestFoe(p.position.x, p.position.z, 99);
    const a = any ? Math.atan2(any.position.x - p.position.x, any.position.z - p.position.z) : p.facing;
    const spot = u.guardSpot || (u.guardSpot = { position: new THREE.Vector3(), state: 'chase', facing: 0 });
    const gx = p.position.x + Math.sin(a) * 1.5, gz = p.position.z + Math.cos(a) * 1.5; // lugar do guarda: entre a Maga e os inimigos
    const dx = u.position.x - gx, dz = u.position.z - gz, dd = Math.hypot(dx, dz);
    if (dd < 0.6) { // no lugar: fica parado de guarda, virado para os inimigos
      spot.position.set(gx, 0, gz); spot.state = 'dead';
      if (u.state === 'chase') u.facing += Math.atan2(Math.sin(a - u.facing), Math.cos(a - u.facing)) * 0.15;
    } else { // o cérebro para a uma certa distância do alvo: o alvo falso fica atrás do lugar, para ele parar em cima do lugar
      const R = (u.data.attackRange || 2) + 0.9;
      spot.position.set(gx - (dx / dd) * R, 0, gz - (dz / dd) * R); spot.state = 'chase';
      u.cooldown = Math.max(u.cooldown, 0.3); // andando até o lugar: não golpeia o ar
    }
    if (any) u.idleT = 0;
    return spot;
  }
  // Guarda: o escudo segura golpes e tiros que vêm da frente.
  guardBlocks(u, fromX, fromZ) {
    if (u.noBlockOnce) return false;
    if (!u.guard || !u.alive || !u.shieldCovers || !u.shieldCovers(fromX, fromZ)) return false;
    const dx = u.position.x - fromX, dz = u.position.z - fromZ, d = Math.hypot(dx, dz) || 1;
    u.blockHit(dx / d * 0.3, dz / d * 0.3);
    this.c.text.add('Bloqueou!', u.position, 'block', 2.6);
    this.c.vfx.sparks(v3(u.position.x - dx / d * 0.6, 1.2, u.position.z - dz / d * 0.6), 0xcfe4ff, 8);
    audio.play('block', u.position.x, u.position.z);
    this.log({ type: 'darkGuardBlock' });
    return true;
  }

  // ---------- Morto-vivo levantou (undead.js) ----------
  onRise(u, r) {
    const p = u.undead, w = W(p), c = this.c;
    if (r.giant) this.makeGiant(u);
    if (w.dHeir && !r.carried && !r.hp && !u.giant && !u.possessed) {
      u.hp = Math.max(u.hp, Math.round(u.maxHp * DARK2.heir.hp) + (w.undeadHp || 0));
      u.maxHp = Math.max(u.maxHp, u.hp);
      if (u.data.shield) { u.guard = true; c.text.add('Guarda!', u.position, 'block', 3.4); }
      this.log({ type: 'darkHeir', guard: !!u.guard });
    }
    if (r.carried && u.data.shield && w.dHeir) u.guard = true;
    if (w.dHands && !r.carried) this.graveHands(p, u);
  }

  // ---------- Mãos da Cova ----------
  graveHands(p, u) {
    const c = this.c, H = DARK2.hands;
    let n = 0;
    for (const e of c.enemies) {
      if (e.undead || !e.targetable || e.data.boss) continue;
      if (dist(e, u) > H.r + e.data.radius) continue;
      if (!e.daze(H.t)) continue;
      e.vel.set(0, 0, 0);
      e.handsT = H.t;
      for (let k = 0; k < 2; k++) this.addHand(e.position.x + (k ? 0.35 : -0.35), e.position.z + 0.15, H.t, e);
      n++;
    }
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; this.addHand(u.position.x + Math.sin(a) * 1.4, u.position.z + Math.cos(a) * 1.4, 1.0); }
    c.vfx.ring(v3(u.position.x, 0.05, u.position.z), 0xd9d0b4, H.r);
    if (n) c.text.add('Presos!', u.position, 'bleed', 3.4);
    this.log({ type: 'darkHands', n });
  }
  addHand(x, z, life, e = null) {
    const g = makeHand();
    g.position.set(x, -1.1, z);
    g.rotation.y = this.rand() * Math.PI * 2;
    g.userData.h.rotation.z = (this.rand() - 0.5) * 0.5;
    this.c.scene.add(g);
    this.hands.push({ g, t: 0, life: life + 0.3, e, ox: x - (e ? e.position.x : x), oz: z - (e ? e.position.z : z) });
  }

  // ---------- Gigante de Ossos ----------
  checkGiant(p) {
    if (this.merges.some((m) => m.p === p)) return;
    const list = this.mine(p).filter((u) => !u.giant && !u.merging && u.state !== 'spawn');
    if (list.length < DARK2.giant.n) return;
    const us = list.slice(0, DARK2.giant.n);
    let cx = 0, cz = 0;
    for (const u of us) { cx += u.position.x / us.length; cz += u.position.z / us.length; }
    for (const u of us) {
      u.merging = true; u.releaseToken(); u.vel.set(0, 0, 0);
      if (u.state === 'attack' && u.endAttack) u.endAttack();
      u.setState('hurt'); u.stunTime = 99;
    }
    this.merges.push({ p, us, t: 0, cx, cz });
    this.c.text.add('Juntando!', v3(cx, 0, cz), 'bleed', 3.4);
    this.log({ type: 'darkMerge' });
  }
  finishMerge(m) {
    const c = this.c;
    let hp = 0;
    for (const u of m.us) if (u.alive) { hp += Math.max(1, u.hp); u.die(); undeadDied(c, u); }
    if (!hp || m.p.state === 'dead') return;
    if (c.world.blocked(m.cx, m.cz, 0.9)) { const u = m.us[0]; m.cx = u.position.x; m.cz = u.position.z; }
    (c.raising || (c.raising = [])).push({ type: 'warrior', x: m.cx, z: m.cz, t: 0, owner: m.p, hpScale: 1, dmgScale: 1, facing: m.p.facing, hp: DARK2.giant.hp + hp, giant: true });
    c.vfx.smoke(v3(m.cx, 0, m.cz), PURPLE, 18);
  }
  makeGiant(u) {
    const G = DARK2.giant, d = u.data, c = this.c;
    u.giant = true;
    u.group.scale.setScalar(G.scale);
    u.data = { ...d, scale: G.scale, radius: d.radius * 1.45, attackRange: (d.attackRange || 2) * 1.4, knockback: (d.knockback ?? 1) * 0.3,
      attack: d.attack ? { ...d.attack, reach: d.attack.reach * 1.5 } : d.attack };
    u.dmgScale = (u.dmgScale || 1) * G.dmg;
    u.damage = Math.round(d.damage * u.dmgScale);
    u.maxHp = Math.max(u.maxHp, u.hp);
    c.vfx.ring(v3(u.position.x, 0, u.position.z), PURPLE, 2.6);
    c.text.add('Gigante de Ossos!', u.position, 'crit big', 4.4);
    c.shakeFor(u.undead, 0.35);
    audio.play('boom', u.position.x, u.position.z, { v: 0.6 });
    this.log({ type: 'darkGiant', hp: u.hp });
  }

  // ---------- Traição ----------
  // Quem o inimigo persegue (combat.pickTarget): o marcado às vezes vai atrás de um aliado dele; quem apanhou revida um pouco.
  betrayTarget(e, dt) {
    if (e.grudgeT > 0) {
      e.grudgeT -= dt;
      if (e.grudge && e.grudge.alive && !e.grudge.undead && e.grudgeT > 0) return e.grudge;
      e.grudge = null; e.grudgeT = 0;
    }
    const p = e.darkMark;
    if (!p || !W(p).dBetray || e.undead || e.data.boss) { e.betrayLeft = 0; return null; }
    if (e.betrayLeft > 0) {
      e.betrayLeft -= dt;
      if (e.betrayFoe && e.betrayFoe.alive && !e.betrayFoe.undead && e.betrayLeft > 0) return e.betrayFoe;
      e.betrayLeft = 0; e.betrayFoe = null;
    }
    e.betrayRoll = (e.betrayRoll ?? 0.5) - dt;
    if (e.betrayRoll > 0) return null;
    e.betrayRoll = DARK2.betray.every;
    if (this.rand() >= DARK2.betray.chance) return null;
    const foe = this.nearestFoe(e.position.x, e.position.z, DARK2.betray.range, e);
    if (!foe) return null;
    e.betrayFoe = foe; e.betrayLeft = DARK2.betray.time;
    e.releaseToken();
    this.c.text.add('Traidor!', e.position, 'bleed', 3.2);
    this.c.vfx.smoke(e.position, PURPLE, 5);
    this.log({ type: 'darkBetray', enemy: e, foe });
    return foe;
  }
  isFoeTarget(e, t) { return !!(t && t !== e && !t.undead && t.data && !e.undead && this.c.enemies.includes(t)); }
  // Golpe de um inimigo que está brigando com outro inimigo (combat.enemyStrike).
  foeStrike(e, inReach, dmg) {
    const t = e.target;
    if (!this.isFoeTarget(e, t)) return false;
    if (t.alive && t.targetable && inReach(t.position, t.data.radius)) this.betrayHit(e, t, dmg);
    return true;
  }
  // Salto, investida... de quem está brigando com outro inimigo (combat.hitPlayer sem alvo certo).
  foeHit(e, base, opts) {
    if (opts.target || !e || !e.position) return false;
    const t = e.target;
    if (!this.isFoeTarget(e, t)) return false;
    if (t.alive && t.targetable && !opts.contact && dist(t, e) < (e.data.attackRange || 2) + 2) this.betrayHit(e, t, base);
    return true;
  }
  betrayHit(e, t, dmg) {
    const c = this.c, by = e.darkMark && e.darkMark.hero ? e.darkMark : null;
    const dx = t.position.x - e.position.x, dz = t.position.z - e.position.z, d = Math.hypot(dx, dz) || 1;
    c.vfx.sparks(v3(t.position.x, 1.2, t.position.z), PURPLE, 8);
    audio.play('hit', t.position.x, t.position.z);
    c.bonusDamage(t, Math.max(1, Math.round(dmg)), dx / d, dz / d, 'dmg', by);
    if (t.alive && !t.data.boss) { t.grudge = e; t.grudgeT = DARK2.betray.grudge; } // revida no traidor
    this.log({ type: 'darkBetrayHit', enemy: t, dmg });
  }

  // ---------- A cada quadro ----------
  tick(dt) {
    const c = this.c;
    for (const p of c.players) {
      if (p.dGuardCd > 0) p.dGuardCd -= dt;
      if (isDark(p) && W(p).dGiant && p.state !== 'dead') this.checkGiant(p);
      this.shadowTick(p, dt);
    }
    // Gigante: os 3 deslizam para o meio e viram um só.
    for (let i = this.merges.length - 1; i >= 0; i--) {
      const m = this.merges[i];
      m.t += dt;
      const k = Math.min(1, dt * 6);
      for (const u of m.us) if (u.alive) { u.position.x += (m.cx - u.position.x) * k; u.position.z += (m.cz - u.position.z) * k; }
      if (Math.random() < dt * 20) c.vfx.smoke(v3(m.cx, 0, m.cz), PURPLE, 2);
      if (m.t >= DARK2.giant.merge) { this.merges.splice(i, 1); this.finishMerge(m); }
    }
    // Último Suspiro: fantasmas voando até o alvo.
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.life -= dt;
      if (!g.t || !g.t.alive || g.t.undead) g.t = this.nearestFoe(g.g.position.x, g.g.position.z, DARK2.ghost.range, null, true);
      if (!g.t || g.life <= 0) { c.scene.remove(g.g); this.ghosts.splice(i, 1); continue; }
      const dx = g.t.position.x - g.g.position.x, dz = g.t.position.z - g.g.position.z, d = Math.hypot(dx, dz) || 0.01;
      const step = DARK2.ghost.speed * dt;
      g.g.position.x += dx / d * Math.min(step, d); g.g.position.z += dz / d * Math.min(step, d);
      g.g.position.y = 1.4 + Math.sin(g.life * 9) * 0.15;
      if (d < g.t.data.radius + 0.4) {
        if (g.t.targetable) markDark(c, g.p, g.t);
        c.vfx.sparks(v3(g.t.position.x, 1.6, g.t.position.z), 0xd8e8ff, 10);
        c.scene.remove(g.g); this.ghosts.splice(i, 1);
        this.log({ type: 'darkGhostMark', enemy: g.t });
      }
    }
    // Coletora: almas girando em volta da Maga.
    const now = performance.now() / 1000;
    for (const p of c.players) {
      const L = p.dSoulList;
      if (!L || !L.length) continue;
      if (p.state === 'dead') { for (const s of L) c.scene.remove(s.g); p.dSoulList = []; continue; }
      L.forEach((s, i) => {
        const a = now * 2.6 + (i / L.length) * Math.PI * 2;
        const tx = p.position.x + Math.sin(a) * 1.15, tz = p.position.z + Math.cos(a) * 1.15, ty = 1.5 + Math.sin(now * 4 + i) * 0.12;
        s.k = Math.min(1, s.k + dt * 3);
        s.g.position.x += (tx - s.g.position.x) * s.k; s.g.position.z += (tz - s.g.position.z) * s.k; s.g.position.y += (ty - s.g.position.y) * s.k;
      });
    }
    // Coletora: almas disparadas.
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      if (!s.t || !s.t.targetable) s.t = this.nearestFoe(s.g.position.x, s.g.position.z, DARK2.souls.range);
      if (!s.t || s.life <= 0) { c.scene.remove(s.g); this.shots.splice(i, 1); continue; }
      const dx = s.t.position.x - s.g.position.x, dz = s.t.position.z - s.g.position.z, d = Math.hypot(dx, dz) || 0.01;
      const step = DARK2.souls.speed * dt;
      s.g.position.x += dx / d * Math.min(step, d); s.g.position.z += dz / d * Math.min(step, d);
      s.g.position.y += (1.2 - s.g.position.y) * Math.min(1, dt * 6);
      if (d < s.t.data.radius + 0.35) {
        c.vfx.sparks(v3(s.t.position.x, 1.2, s.t.position.z), 0x7dfff0, 8);
        c.bonusDamage(s.t, s.dmg, dx / d, dz / d, 'dmg', s.p);
        audio.play('hit', s.t.position.x, s.t.position.z);
        c.scene.remove(s.g); this.shots.splice(i, 1);
        this.log({ type: 'darkSoulHit', dmg: s.dmg });
      }
    }
    // Mãos da Cova: sobem, seguram e afundam.
    for (let i = this.hands.length - 1; i >= 0; i--) {
      const h = this.hands[i];
      h.t += dt;
      const up = Math.min(1, h.t / 0.22), down = Math.max(0, (h.t - (h.life - 0.3)) / 0.3);
      h.g.position.y = -1.1 + 1.1 * up - 1.1 * down;
      if (h.e && h.e.alive) { h.g.position.x = h.e.position.x + h.ox; h.g.position.z = h.e.position.z + h.oz; }
      h.g.userData.h.rotation.x = Math.sin(h.t * 14) * 0.08;
      if (h.t >= h.life) { c.scene.remove(h.g); this.hands.splice(i, 1); }
    }
    // Escuridão: a sala escurece com 3 ou mais mortos-vivos.
    const on = c.players.some((p) => isDark(p) && W(p).dDark && p.state !== 'dead' && this.darkOn(p));
    if (on !== this.veilOn) this.setVeil(on);
  }

  // Sombra Faminta: a sombra da Maga morde quem pisar nela (sem atordoar).
  shadowTick(p, dt) {
    const on = isDark(p) && W(p).dShadow && p.state !== 'dead';
    let s = this.shadows.get(p);
    if (!on) { if (s) { this.c.scene.remove(s.g); this.shadows.delete(p); } return; }
    if (!s) s = this.makeShadow(p);
    const S = DARK2.shadow;
    s.g.position.set(p.position.x, 0.04, p.position.z);
    s.g.rotation.y += dt * 0.6;
    s.bite = Math.max(0, s.bite - dt * 4);
    for (const t of s.teeth) t.position.y = 0.05 + s.bite * 0.25;
    s.mat.opacity = 0.5 + s.bite * 0.3;
    p.dShadowT = (p.dShadowT ?? S.tick) - dt;
    if (p.dShadowT > 0) return;
    p.dShadowT = S.tick;
    const c = this.c, dmg = Math.max(1, Math.round(S.dmg * (p.stats.damageMul || 1)));
    let n = 0;
    for (const e of [...c.enemies]) {
      if (e.undead || !e.targetable || e.immune) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > S.r + e.data.radius * 0.5) continue;
      e.lastHitBy = p;
      const died = e.takeDamage(dmg, dx / d, dz / d, 0, false, true);
      c.text.add(String(dmg), e.position, 'bleed', 2.0);
      c.vfx.sparks(v3(e.position.x, 0.4, e.position.z), 0x3a0a6a, 5);
      if (died) c.killed(e, dx / d, dz / d, p);
      n++;
    }
    if (n) { s.bite = 1; audio.play('crunch', p.position.x, p.position.z, { v: 0.4 }); this.log({ type: 'darkBite', n, dmg }); }
  }
  makeShadow(p) {
    const S = DARK2.shadow, g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x12001c, transparent: true, opacity: 0.5, depthWrite: false });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(S.r, 36), mat);
    disc.rotation.x = -Math.PI / 2;
    const edge = new THREE.Mesh(new THREE.RingGeometry(S.r - 0.08, S.r, 36), new THREE.MeshBasicMaterial({ color: PURPLE, transparent: true, opacity: 0.55, depthWrite: false }));
    edge.rotation.x = -Math.PI / 2; edge.position.y = 0.01;
    g.add(disc, edge);
    const teeth = [], toothGeo = new THREE.ConeGeometry(0.08, 0.28, 4), toothMat = new THREE.MeshBasicMaterial({ color: 0xe8dcff });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, t = new THREE.Mesh(toothGeo, toothMat);
      t.position.set(Math.sin(a) * (S.r - 0.15), 0.05, Math.cos(a) * (S.r - 0.15));
      t.rotation.set(0, a, Math.PI / 2 + 0.4); t.rotation.order = 'YXZ';
      g.add(t); teeth.push(t);
    }
    g.renderOrder = 1;
    this.c.scene.add(g);
    const s = { g, mat, teeth, bite: 0 };
    this.shadows.set(p, s);
    return s;
  }

  setVeil(on) {
    this.veilOn = on;
    let el = document.getElementById('darkVeil');
    if (!el) {
      el = document.createElement('div');
      el.id = 'darkVeil';
      el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0;transition:opacity .6s;'
        + 'background:radial-gradient(ellipse at 50% 50%, rgba(25,0,45,0.25) 15%, rgba(8,0,18,0.82) 72%);';
      document.body.appendChild(el);
    }
    el.style.opacity = on ? '1' : '0';
    if (on) { const p = this.c.players.find((x) => isDark(x) && W(x).dDark); if (p) this.c.text.add('Escuridão!', p.position, 'bleed', 3.4); }
    this.log({ type: 'darkVeil', on });
  }

  clear() {
    const c = this.c;
    for (const g of this.ghosts) c.scene.remove(g.g);
    for (const s of this.shots) c.scene.remove(s.g);
    for (const h of this.hands) c.scene.remove(h.g);
    for (const s of this.shadows.values()) c.scene.remove(s.g);
    for (const p of c.players) { if (p.dSoulList) for (const s of p.dSoulList) c.scene.remove(s.g); p.dSoulList = []; p.dMissN = 0; }
    this.ghosts.length = 0; this.shots.length = 0; this.hands.length = 0; this.merges.length = 0;
    this.shadows.clear();
    if (this.veilOn) this.setVeil(false);
  }
}
