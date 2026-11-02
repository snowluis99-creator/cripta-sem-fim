// Herói controlado pelo jogador: andar, mirar, combo, esquiva e bloqueio.
import * as THREE from 'three';
import { input } from './input.js';
import { Animator } from './animation.js';
import { makeCharacter, attachWeapon, makeFlashable, setFlash } from './characters.js';
import { baseStats } from './blessings.js';
import { audio } from './audio.js';
import { initShield, updateShield, shieldMax, shieldVisual } from './shield.js';
import { heroWith, HEROES } from './heroes.js';
import { applyWeaponMods } from './weaponbless.js';
import { instance } from './assets.js';
import { tickWeaponFx } from './weaponfx.js';
import { updateFlail } from './flail.js';
import { applyKit, kitReset, kitCanBlock, kitSwordGuard, kitOnGuard, kitTryPickup, kitBlockTick, kitStartDodge, kitSledTick } from './knightkit.js';
import { kit2StartDodge, kit2HorseTick, kit2TryKick } from './knightkit2.js';
import { applyAxe, axeReset, axeOnStart, axeStartDodge, axeApplyRoll, axeTryTop, axeTopTick } from './axekit.js';

// Quando o herói está "congelado" (troca de sala, menus) ele ignora os controles.
const NO_INPUT = {
  moveDir: (out) => out.set(0, 0, 0), attack: () => false, dodge: () => false, potion: () => false, blocking: () => false,
  interact: () => false, aimAngle: () => null, ultimate: () => false,
};

// Co-op: cor da capa do Jogador 2 (para diferenciar os dois cavaleiros).
// Clareia partes do modelo (nome da malha termina com a chave): cor × fator.
function brighten(model, map) {
  if (!map) return;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const k = Object.keys(map).find((n) => o.name.endsWith(n));
    if (k) o.material.color.multiplyScalar(map[k]);
  });
}

function tintCape(model, color) {
  model.traverse((o) => {
    if (!o.isMesh || !/cape/i.test(o.name)) return;
    const m = o.material.clone();
    m.map = null;
    m.color = new THREE.Color(color);
    o.material = m;
  });
}

const tmpMove = new THREE.Vector3();
const tmpAim = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
// Ponta da espada (sword_1handed): 1,41 do cabo no eixo +Y do modelo (outras armas: weapons.right.tip).
const WEAPON_TIP_Y = 1.41;

function angleTo(dx, dz) { return Math.atan2(dx, dz); }
function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Textura da barreira mágica: grade de hexágonos claros.
let wallTex = null;
function makeMagicWall() {
  if (!wallTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 3;
    const r = 16, h = r * Math.sqrt(3);
    for (let row = -1; row < 6; row++) for (let col = -1; col < 6; col++) {
      const x = col * r * 3 + (row % 2 ? r * 1.5 : 0), y = row * h / 2;
      g.beginPath();
      for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.stroke();
    }
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0.15)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    wallTex = new THREE.CanvasTexture(c);
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(4, 2);
  }
  const mat = new THREE.MeshBasicMaterial({ map: wallTex, color: 0x7fc8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const arc = THREE.MathUtils.degToRad(150);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.6, 32, 1, true, -arc / 2, arc), mat);
  m.position.y = 1.3;
  const g = new THREE.Group();
  g.add(m);
  // Arco brilhante no chão (dá para ver a barreira mesmo de longe).
  const base = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.75, 32, 1, -Math.PI / 2 - arc / 2, arc), mat);
  base.rotation.x = -Math.PI / 2; base.position.y = 0.12;
  g.add(base);
  g.visible = false;
  g.userData = { mat, k: 0, hit: 0, t: 0 };
  return g;
}

const aimTmp = { v: new THREE.Vector3(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), pq: new THREE.Quaternion() };

export class Player {
  // opts: { input (de onde vêm os comandos; padrão = teclado/mouse/controle deste PC), cape (cor da capa), id (1 ou 2) }
  constructor(hero, opts = {}) {
    this.heroId = hero.id || 'knight';
    this.hero = heroWith(this.heroId, opts.weapon);
    this.id = opts.id || 1;
    this.input = opts.input || input;
    this.remote = !!opts.input;   // Jogador 2 no computador do anfitrião (comandos chegam pela rede)
    const { group, model } = makeCharacter(hero.model);
    this.group = group;
    this.model = model;
    this.cape = opts.cape;
    if (opts.cape) tintCape(model, opts.cape);
    this.gold = 0;
    this.choosing = false;     // escolhendo uma bênção (co-op: o jogo não pausa)
    this.ux = null;            // avisos só para a tela deste jogador (vinheta, tremida, sem ouro...)
    this.bodyMats = makeFlashable(model).mats; // para piscar em vermelho ao apanhar
    brighten(model, this.hero.brighten);
    this.glow = 0;
    this.attachArms();
    hero = this.hero;
    this.anim = new Animator(model);
    this.position = group.position;
    this.facing = 0;          // ângulo em y
    this.state = 'idle';      // idle | run | attack | dodge | block
    this.stateTime = 0;
    this.combo = 0;
    this.queued = false;
    this.hitDone = false;
    this.dodgeDir = new THREE.Vector3();
    this.dodgeCooldown = 0;
    this.iframes = 0;         // invencível por um tempo depois de apanhar
    this.vel = new THREE.Vector3(); // empurrão recebido
    this.hurtFlash = 0;
    this.stats = baseStats();  // atributos mudados pelas bênçãos
    this.blessings = {};       // id -> quantas vezes pegou
    this.frozen = false;
    this.noPotion = false;     // perto de algo para interagir: Y do controle interage em vez de beber
    this.hp = hero.maxHp;
    this.potions = hero.potions;
    this.ult = 0; this.ultTime = 0;  // ultimate (ultimate.js)
    this.onDeath = null;      // chamado quando a vida chega a zero
    this.onHeal = null;       // (player, quanto curou)
    this.onPotionFail = null; // sem poção ou vida cheia
    this.onHit = null;        // chamado no momento do golpe: (player, golpe)
    this.onDodge = null;      // chamado no começo e no fim do rolamento: (player, 'start'|'end')
    this.anim.play(hero.anims.idle);
    initShield(this, this.shieldMesh);
  }

  // Põe nas mãos as armas do herói atual (arma na direita; escudo na esquerda, se tiver).
  attachArms() {
    const ws = this.hero.weapons;
    this.weapon = ws.right ? attachWeapon(this.model, 'handslot.r', ws.right) : null;
    this.glowMats = [];
    if (this.weapon) {
      // Material próprio da arma (para brilhar sem afetar outras peças).
      this.weapon.traverse((o) => {
        if (o.isMesh && !o.userData.fxPart) {
          const base = o.material.userData.glowBase;
          o.material = o.material.clone();
          o.material.userData.glowBase = base;
          this.glowMats.push(o.material);
        }
      });
    }
    const left = ws.left ? attachWeapon(this.model, 'handslot.l', ws.left) : null;
    // Sem escudo (Ladino): a peça da mão esquerda é uma arma (adaga, garra), não gasta nem some.
    this.offhand = this.hero.noShield ? left : null;
    this.shieldMesh = this.hero.noShield ? null : left;
    // Garras: guardam a rotação normal para voltar depois de apontar para o inimigo.
    this.aimParts = [[this.weapon, ws.right], [left, ws.left]].filter(([o, c]) => o && c && c.aim).map(([o]) => ({ o, rest: o.quaternion.clone() }));
    this.aimW = 0;
  }

  get weaponId() { return this.hero.weaponId; }

  // Troca de herói (Taverna): outro modelo, outras armas e animações. Mantém posição, ouro e bênçãos.
  setHero(heroId, wid) {
    if (!HEROES[heroId]) return false;
    if (heroId === this.heroId) return this.setWeapon(wid || this.hero.weaponId);
    this.group.remove(this.model);
    if (this.wall) { this.group.remove(this.wall); this.wall = null; }
    kitReset(this);
    axeReset(this);
    this.heroId = heroId;
    this.hero = applyWeaponMods(heroWith(heroId, wid), this.stats.w);
    const model = instance(this.hero.model);
    model.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
    this.group.add(model);
    this.model = model;
    if (this.cape) tintCape(model, this.cape);
    this.bodyMats = makeFlashable(model).mats;
    brighten(model, this.hero.brighten);
    this.glow = 0;
    this.attachArms();
    this.anim = new Animator(model);
    initShield(this, this.shieldMesh);
    applyKit(this);
    applyAxe(this);
    this.syncWeaponSize(this.stats.rangeMul);
    this.combo = 0;
    this.refillAmmo();
    if (this.hp > this.maxHp) this.hp = this.maxHp;
    if (this.state !== 'dead') this.setState('idle');
    this.anim.play(this.hero.anims.idle, { fade: 0, restart: true });
    return true;
  }

  // Barreira mágica da Maga (o "escudo" dela): arco brilhante na frente, só aparece bloqueando.
  updateWall(dt) {
    if (!this.hero.block.wall) return;
    if (!this.wall) { this.wall = makeMagicWall(); this.group.add(this.wall); }
    const on = this.state === 'block' && this.shield > 0;
    const w = this.wall, u = w.userData;
    u.k += ((on ? 1 : 0) - u.k) * Math.min(1, dt * 14);
    u.hit = Math.max(0, u.hit - dt * 4);
    u.t += dt;
    w.visible = u.k > 0.02;
    if (!w.visible) return;
    const wear = Math.max(0, this.shield) / Math.max(1, shieldMax(this));
    u.mat.color.setHex(0x7fc8ff).lerp(new THREE.Color(0xff5a7a), (1 - wear) * 0.7);
    u.mat.opacity = u.k * (0.5 + 0.4 * wear + 0.08 * Math.sin(u.t * 9)) + u.hit * 0.6;
    u.mat.map.offset.y = -u.t * 0.25;
    w.scale.set(0.85 + 0.15 * u.k, u.k, 0.85 + 0.15 * u.k);
  }

  // Troca de arma (Taverna). Mantém vida, bênçãos e ouro.
  setWeapon(wid) {
    if (!wid || wid === this.hero.weaponId) return false;
    kitReset(this);
    axeReset(this);
    for (const m of [this.weapon, this.shieldMesh, this.offhand]) if (m && m.parent) m.parent.remove(m);
    this.hero = applyWeaponMods(heroWith(this.heroId, wid), this.stats.w);
    this.glow = 0;
    this.attachArms();
    initShield(this, this.shieldMesh);
    if (this.kit) this.kit.swapMesh = null;
    applyKit(this);
    applyAxe(this);
    this.syncWeaponSize(this.stats.rangeMul);
    this.combo = 0;
    this.refillAmmo();
    if (this.state === 'idle' || this.state === 'run' || this.state === 'attack' || this.state === 'block') {
      this.setState('idle');
      this.anim.play(this.hero.anims.idle, { fade: 0.15, restart: true });
    }
    return true;
  }

  setState(s) { this.state = s; this.stateTime = 0; }

  // Dá para levantar a guarda agora? (escudo inteiro e na mão; Mãos Trocadas: a espada na mão)
  canGuard() { return !this.hero.noShield && kitCanBlock(this) && (kitSwordGuard(this) || this.shield > 0); }

  // Munição (Kunais/Besta do Ladino): cheia. O que estava no chão some (rogue.js cuida disso pelo onRefill).
  refillAmmo() {
    const a = this.hero.ammo;
    if (this.onRefill) this.onRefill(this);
    else this.ammo = a ? Array.from({ length: a.max }, () => ({ stack: 0, keep: 0 })) : [];
  }

  get spectralReady() { return this.stats.spectral && this.spectralCd <= 0 && this.state !== 'dead'; }
  updateSpectral(dt) {
    if (!this.spectralGlow) {
      this.spectralGlow = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.3, 40),
        new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      this.spectralGlow.rotation.x = -Math.PI / 2;
      this.spectralGlow.position.y = 0.12;
      this.group.add(this.spectralGlow);
    }
    const target = this.spectralReady || this.potionGuard ? 0.55 + 0.2 * Math.sin(performance.now() / 200) : 0;
    const m = this.spectralGlow.material;
    m.opacity += (target - m.opacity) * Math.min(1, dt * 8);
    this.spectralGlow.visible = m.opacity > 0.01;
  }

  get maxHp() { return Math.max(10, this.hero.maxHp + this.stats.bonusHp); }
  // Ultimate: quantos inimigos derrotados enchem a barra (Pacto do Ceifador: 6).
  get ultNeed() { return Math.max(3, this.stats.ultNeed || 10); }
  // Bênçãos com efeito por tempo/condição (M4).
  get lowHp() { return this.hp < this.maxHp * 0.4; }
  // Reflexo: +30% durante o combo depois de escapar rolando. Fúria Desesperada: +30% com pouca vida.
  get atkSpeed() { return this.stats.attackSpeed + (this.reflexCombo === 'active' ? 0.3 : 0) + (this.stats.fury && this.lowHp ? 0.3 : 0) + (this.hasteT > 0 ? (this.stats.w.critHaste || 0) : 0); }
  get moveMul() { return this.stats.speedMul; }
  get ctl() { return this.frozen || this.choosing ? NO_INPUT : this.input; }

  heal(n) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + n);
    return this.hp - before;
  }

  addBlessing(b) {
    this.blessings[b.id] = (this.blessings[b.id] || 0) + 1;
    b.apply(this.stats, this);
    if (b.weapon) this.rebuildHero(); // bênção exclusiva da arma: muda os dados dos golpes
    if (this.hp > this.maxHp) this.hp = this.maxHp; // bênção arriscada pode tirar vida máxima
    this.syncWeaponSize();
  }

  // Refaz os dados do herói (mesma arma) com as bênçãos da arma. Não troca modelos.
  rebuildHero() {
    this.hero = applyWeaponMods(heroWith(this.heroId, this.hero.weaponId), this.stats.w);
    applyKit(this); // Espada e Escudo: combo conforme o que está na mão (knightkit.js)
    applyAxe(this); // Machado: Arremesso Mortal (4º golpe)
    if (this.combo >= this.hero.combo.length) this.combo = 0;
  }

  // Lâmina Longa: a espada cresce junto com o alcance do golpe. A lâmina aponta para +Y no modelo;
  // a ponta avança exatamente o que o alcance ganhou (attackRange × bônus), um pouco mais grossa também.
  syncWeaponSize(mul = this.stats.rangeMul) {
    if (!this.weapon) return;
    const extra = this.hero.caster ? 0 : this.hero.attackRange * (mul - 1); // Maga: a magia vai mais longe, o cajado não cresce
    const bone = this.weapon.parent;
    const ws = bone ? bone.getWorldScale(tmpScale).x / (this.group.scale.x || 1) : 1;
    const right = this.hero.weapons.right || {};
    const base = right.scale || 1;
    const sy = 1 + extra / ((right.tip || WEAPON_TIP_Y) * base * (ws || 1));
    const sxz = 1 + (sy - 1) * 0.35;
    if (right.flail) this.weapon.scale.setScalar(base * sy); // mangual: cresce inteiro (a corrente também)
    else this.weapon.scale.set(base * sxz, base * sy, base * sxz);
    this.weaponMul = mul;
  }

  // Coloca o herói na entrada de uma sala nova (sem mexer na vida nem nas bênçãos).
  placeAt(x, z, facing = Math.PI) {
    this.position.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.facing = facing;
    this.group.rotation.y = facing;
    this.combo = 0;
    this.clearRoll();
    this.setGlow(0);
    if (this.state !== 'dead') { this.setState('idle'); this.anim.play(this.hero.anims.idle, { fade: 0, restart: true }); }
  }

  // ultTime: só a Fortaleza Dourada (Cavaleiro) deixa invulnerável. stealth: bomba de fumaça do Ladino.
  get invulnerable() { return this.state === 'dodge' || this.iframes > 0 || (this.ultTime > 0 && this.heroId === 'knight') || this.stealth > 0 || this.state === 'dead' || this.state === 'cine'; }

  // Cena (morte do Rei Skullbone): sem controle e sem levar dano; quem mexe no herói é a cena.
  enterCine() {
    if (this.state === 'dead') return;
    this.combo = 0;
    this.clearRoll();
    this.setGlow(0);
    this.vel.set(0, 0, 0);
    this.backToBack = false;
    this.setState('cine');
  }
  exitCine() {
    this.position.y = 0;
    if (this.state !== 'cine') return;
    this.iframes = 0.6;
    this.setState('idle');
    this.anim.play(this.hero.anims.idle, { fade: 0.2 });
  }

  // O escudo protege de um ataque vindo de (x, z)?
  // Barreira da Maga: rebate um projétil vindo de (x, z)? (Barreira Total = de qualquer lado)
  reflects(x, z) {
    if (!this.hero.block || !this.hero.block.reflect || this.state !== 'block' || this.shield <= 0) return false;
    return this.stats.reflectArc >= 360 || this.blocksFrom(x, z);
  }

  blocksFrom(x, z) {
    if (this.state !== 'block') return false;
    if (this.backToBack) return true; // co-op: de costas com o parceiro, os dois cobrem todos os lados
    const ang = Math.atan2(x - this.position.x, z - this.position.z) - this.facing;
    return Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) <= THREE.MathUtils.degToRad(this.hero.block.arc / 2);
  }

  blockedHit(dmg, nx, nz) {
    this.hp -= dmg;
    if (this.wall) this.wall.userData.hit = 1;
    audio.play('shieldBlock', this.position.x, this.position.z);
    this.vel.set(nx, 0, nz).multiplyScalar(3);
    const h = this.hero;
    this.anim.play(h.anims.blockHit, {
      once: true, speed: 2.4, fade: 0.05, restart: true,
      onFinish: () => { if (this.state === 'block') this.anim.play(h.anims.blocking, { fade: 0.1 }); },
    });
    if (this.hp <= 0) this.die();
  }

  hurt(dmg, nx, nz, push) {
    const h = this.hero;
    this.hp -= dmg;
    this.perfectStacks = 0; // Perfect: tomou dano, a contagem recomeça
    audio.play('hurt', this.position.x, this.position.z);
    this.hurtFlash = 1;
    if (this.state === 'rooted') {
      // Preso no círculo: apanha sem sair do lugar.
      if (this.hp <= 0) { this.rootTime = 0; this.die(); return; }
      this.iframes = h.hurt.iframes;
      return;
    }
    this.vel.set(nx, 0, nz).multiplyScalar(push ?? h.hurt.push);
    this.combo = 0;
    this.clearRoll(); // atingido no meio do rolamento (giro do Guardião enfurecido)
    this.setGlow(0);
    if (this.hp <= 0) { this.die(); return; }
    this.iframes = h.hurt.iframes;
    this.setState('hurt');
    this.anim.play(h.anims.hit, { once: true, speed: 1.6, fade: 0.05, restart: true });
  }

  // Escudo do Guerreiro rebateu o golpe: o herói é jogado para trás e fica sem defesa por "time" segundos.
  // (nx, nz) = direção do herói para o esqueleto.
  staggerBack(nx, nz, time, push) {
    if (this.state === 'dead' || this.state === 'rooted' || this.state === 'cine') return false;
    this.combo = 0;
    this.clearRoll();
    this.setGlow(0);
    this.vel.set(-nx, 0, -nz).multiplyScalar(push);
    this.staggerTime = time;
    this.setState('stagger');
    this.anim.play(this.hero.anims.hit, { once: true, speed: 1.1, fade: 0.05, restart: true });
    return true;
  }

  // Círculo do Guardião: fica imóvel e sem defesa (não anda, não ataca, não rola, não bloqueia).
  // kind = 'grab': agarrado por um Lacaio (pisca em vermelho em vez de roxo).
  root(t, kind = 'circle') {
    if (this.state === 'dead') return;
    this.rootTime = t;
    this.rootKind = kind;
    this.combo = 0;
    this.clearRoll();
    this.setGlow(0);
    this.vel.set(0, 0, 0);
    this.setState('rooted');
    this.anim.play(this.hero.anims.hit, { once: true, speed: 0.5, fade: 0.05, restart: true });
  }

  die() {
    if (this.stats.phoenix > 0) {
      // Coração de Fênix: volta com metade da vida.
      this.stats.phoenix--;
      this.blessings.fenix = 0;
      this.hp = Math.round(this.maxHp / 2);
      this.iframes = 2;
      this.setState('hurt');
      if (this.onRevive) this.onRevive(this);
      return;
    }
    this.hp = 0;
    this.clearRoll();
    this.setState('dead');
    audio.play('heroDeath', this.position.x, this.position.z);
    this.anim.play(this.hero.anims.death, { once: true, fade: 0.1, restart: true });
    if (this.onDeath) this.onDeath(this);
  }

  // Co-op: a sala de descanso traz o parceiro caído de volta com a vida cheia.
  revive() {
    this.hp = this.maxHp;
    this.iframes = 1.5;
    this.vel.set(0, 0, 0);
    this.clearRoll();
    this.group.visible = true;
    setFlash(this.bodyMats, 0);
    this.setState('idle');
    this.anim.play(this.hero.anims.idle, { fade: 0.2, restart: true });
  }

  tryDrink() {
    if (this.restRoom) { if (this.onRestPotion) this.onRestPotion(this); return false; } // sala de descanso: sem poção
    const full = this.hp >= this.maxHp && !(this.canShareHeal && this.canShareHeal(this));
    if (this.potions <= 0 || full) { if (this.onPotionFail) this.onPotionFail(this); return false; }
    this.setState('drink');
    this.drank = false;
    this.anim.play(this.hero.anims.drink, { once: true, speed: 1.8, fade: 0.1, restart: true });
    return true;
  }

  reset(x, z) {
    this.position.set(x, 0, z);
    this.hp = this.maxHp;
    this.potions = this.hero.potions;
    this.stats = baseStats();
    this.blessings = {};
    kitReset(this);
    axeReset(this);
    this.rebuildHero(); // sem bênçãos de arma
    this.hasteT = 0; this.wbDodgeT = 0; this.rampT = 0; this.rampStacks = 0; this.wbHealCd = 0;
    this.syncWeaponSize(1);
    this.frozen = false;
    this.choosing = false;
    this.gold = 0;
    this.group.visible = true;
    this.hp = this.maxHp;
    this.iframes = 0; this.vel.set(0, 0, 0); this.hurtFlash = 0; this.combo = 0;
    this.reflexTime = 0; this.counterReady = false; this.spectralCd = 0; this.backToBack = false;
    this.reflexCombo = false; this.potionGuard = false; this.dodgeUltCd = 0; this.perfectStacks = 0; this.openerReady = false;
    this.powerLeft = 0; this.powerActive = false;
    this.ult = 0; this.ultTime = 0; this.ultCasting = false;
    this.stealth = 0; this.smokeCd = 0; this.sneakCrit = false; this.parryCrit = false; this.parryCd = 0;
    this.refillAmmo();
    this.shield = shieldMax(this); this.forgeT = 0; shieldVisual(this);
    this.facing = Math.PI;
    this.clearRoll();
    this.setGlow(0);
    setFlash(this.bodyMats, 0);
    this.setState('idle');
    this.anim.play(this.hero.anims.idle, { fade: 0, restart: true });
  }

  aimAngle(camera) {
    const a = this.ctl.aimAngle(camera, this.position);
    return a === null ? this.facing : a;
  }

  startAttack(camera) {
    // Sem munição (Kunais/Besta): não arremessa.
    if (this.hero.ammo && !(this.ammo && this.ammo.length)) {
      this.combo = 0; this.queued = false;
      if (this.onNoAmmo) this.onNoAmmo(this);
      if (this.state === 'attack' || this.state === 'dodge') { this.setState('idle'); this.anim.play(this.hero.anims.idle, { fade: 0.15 }); }
      return false;
    }
    // Saiu da fumaça atacando: volta a aparecer (o golpe sai crítico: sneakCrit).
    if (this.stealth > 0) this.stealth = 0;
    const step = this.hero.combo[this.combo];
    if (this.combo === 0) this.newCombo();
    this.setState('attack');
    this.queued = false;
    this.hitDone = false;
    if (!this.frozen) this.facing = this.aimAngle(camera);
    audio.play(step.heavy ? 'swingHeavy' : 'swing', this.position.x, this.position.z);
    this.anim.play(step.clip, { once: true, speed: step.speed * this.atkSpeed, restart: true, fade: 0.08 });
    axeOnStart(this, step); // Giro Voraz
  }

  // Começo de um combo novo: Reflexo (vale para 1 combo) e Poder Acumulado (2 combos depois da ultimate).
  newCombo() {
    this.reflexCombo = this.reflexCombo === 'armed' ? 'active' : false;
    if (this.powerLeft > 0) { this.powerLeft--; this.powerActive = true; } else this.powerActive = false;
  }

  startDodge() {
    const h = this.hero;
    if (kit2StartDodge(this)) return; // Cavalo Fantasma: galopa em vez de rolar
    if (kitStartDodge(this)) return; // Trenó de Escudo: desliza em vez de rolar
    this.ctl.moveDir(this.dodgeDir);
    if (this.dodgeDir.lengthSq() === 0) this.dodgeDir.set(Math.sin(this.facing), 0, Math.cos(this.facing));
    else this.dodgeDir.normalize();
    this.facing = angleTo(this.dodgeDir.x, this.dodgeDir.z);
    this.setState('dodge');
    this.combo = 0;
    if (this.rollHits) this.rollHits.clear(); // Saque Rápido: cada rolamento acerta cada inimigo uma vez
    this.setGlow(0);
    if (!axeStartDodge(this)) this.anim.play(h.dodge.pose, { fade: 0.06, restart: true }); // Rolagem Giratória: gira com o machado
    audio.play('dodge', this.position.x, this.position.z);
    if (this.stats.w.dodgeDmg || this.stats.w.dodgeCrit) this.wbDodgeT = 1.8; // Pés Ligeiros / Dança das Lâminas (rolamento + 1,5 s)
    if (this.onDodge) this.onDodge(this, 'start');
  }

  // Anda em passos curtos e checa a colisão a cada passo (sem isso, o rolamento rápido atravessa paredes).
  move(dx, dz, dist, world) {
    const steps = Math.max(1, Math.ceil(dist / 0.25));
    const d = dist / steps;
    for (let i = 0; i < steps; i++) {
      this.position.x += dx * d;
      this.position.z += dz * d;
      world.resolveCircle(this.position, this.hero.radius);
    }
  }

  setGlow(v) {
    if (Math.abs(v - this.glow) < 0.01) return;
    this.glow = v;
    for (const m of this.glowMats) {
      const b = m.userData.glowBase; // arma dourada: volta ao brilho dourado próprio
      if (b && v < 0.01) { m.emissive.setHex(b.color); m.emissiveIntensity = b.intensity; continue; }
      m.emissive.setRGB(1, 0.45, 0.1); m.emissiveIntensity = Math.max(v * 1.6, b ? b.intensity : 0);
    }
  }

  // Arma dourada: brilho pulsando de leve (só quando não está no brilho do golpe forte).
  pulseGold() {
    if (this.glow > 0 || !this.weapon || !this.weapon.userData.gold) return;
    const k = 1 + 0.25 * Math.sin(performance.now() / 380);
    for (const m of this.glowMats) if (m.userData.glowBase) m.emissiveIntensity = m.userData.glowBase.intensity * k;
  }

  // Cambalhota: gira o modelo para a frente em torno do centro do corpo.
  applyRoll(t) {
    const c = 0.9; // altura do centro do giro
    const k = Math.min(Math.max(t, 0), 1);
    const e = k * k * (3 - 2 * k); // suaviza começo e fim
    const a = e * Math.PI * 2 * this.hero.dodge.flips;
    this.model.rotation.x = a;
    this.model.position.set(0, c - c * Math.cos(a) - Math.sin(k * Math.PI) * 0.35, -c * Math.sin(a));
  }

  clearRoll() { this.model.rotation.set(0, 0, 0); this.model.position.set(0, 0, 0); }

  update(dt, camera, world) {
    if (this.grabImmune > 0) this.grabImmune -= dt;
    this.updateBody(dt, camera, world);
    if (this.weapon && this.weapon.userData.flail) updateFlail(this.weapon, dt);
    this.pulseGold();
    this.updateWall(dt);
    if (this.weapon) tickWeaponFx(this.weapon, dt);
  }

  updateBody(dt, camera, world) {
    const h = this.hero;
    this.stateTime += dt;
    this.iframes = Math.max(0, this.iframes - dt);
    this.reflexTime = Math.max(0, (this.reflexTime || 0) - dt);
    this.dodgeUltCd = Math.max(0, (this.dodgeUltCd || 0) - dt); // Esquiva Envolvente: 1 vez por minuto
    this.bumpGrace = Math.max(0, (this.bumpGrace || 0) - dt);
    this.bumpWindow = Math.max(0, (this.bumpWindow || 0) - dt);
    // Escudo Espectral: recarrega em 12 s; brilho azul em volta quando pronto.
    if (this.stats.spectral) this.spectralCd = Math.max(0, (this.spectralCd || 0) - dt);
    this.updateSpectral(dt);
    updateShield(this, dt);
    // Pisca em vermelho ao apanhar; durante a invencibilidade fica piscando de leve.
    if (this.hurtFlash > 0 || this.iframes > 0) {
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 5);
      const blink = this.iframes > 0 && this.state !== 'dead' ? (Math.sin(this.iframes * 40) > 0 ? 0.25 : 0) : 0;
      setFlash(this.bodyMats, Math.max(this.hurtFlash * 1.5, blink), 1, 0.15, 0.1);
    } else if (this.state !== 'dead') setFlash(this.bodyMats, this.cineTint || 0, 0.45, 0.8, 1); // cineTint: congelado na cena da Taverna
    if (this.vel.lengthSq() > 1e-3) {
      const sp = this.vel.length();
      this.move(this.vel.x / sp, this.vel.z / sp, sp * dt, world);
      this.vel.multiplyScalar(Math.exp(-10 * dt));
    }
    if (this.state === 'dead') { this.anim.update(dt); return; }
    this.dodgeCooldown -= dt;
    this.parryCd = Math.max(0, (this.parryCd || 0) - dt);
    const input = this.ctl;
    // Botão direito do Ladino (fumaça / aparar): conta só o apertar (não segurar).
    const abilDown = !!(this.hero.ability && input.blocking());
    const abilPress = abilDown && !this.abilHeld;
    this.abilHeld = abilDown;
    input.moveDir(tmpMove);
    const moving = tmpMove.lengthSq() > 0;
    let targetFacing = this.facing;
    let turnRate = h.turnSpeed;

    // Esquiva tem prioridade sobre tudo (menos outra esquiva).
    if (this.state === 'cine') { this.anim.update(dt); this.aimForward(); return; } // a cena controla o herói
    if (input.dodge() && !this.axeAway && this.state !== 'dodge' && this.state !== 'sled' && this.state !== 'horse' && this.state !== 'rooted' && this.state !== 'stagger' && this.dodgeCooldown <= 0) this.startDodge();

    switch (this.state) {
      case 'idle':
      case 'run': {
        // Arremesso Mortal: parado esperando o machado voltar.
        if (this.axeAway) { if (this.state !== 'idle') { this.setState('idle'); this.anim.play(h.anims.idle, { fade: 0.15 }); } break; }
        if (input.attack()) { this.combo = 0; this.startAttack(camera); break; }
        if (input.potion() && !this.noPotion && this.tryDrink()) break;
        if (abilPress && this.useAbility(camera)) break;
        if (input.blocking() && this.enterBlock(camera)) break;
        if (moving) {
          this.move(tmpMove.x, tmpMove.z, h.moveSpeed * this.moveMul * dt, world);
          targetFacing = angleTo(tmpMove.x, tmpMove.z);
          if (this.state !== 'run') { this.setState('run'); this.anim.play(h.anims.run); }
        } else if (this.state !== 'idle') {
          this.setState('idle'); this.anim.play(h.anims.idle);
        }
        break;
      }
      case 'attack': {
        // Bloqueio/aparar é instantâneo: corta o golpe na hora, em qualquer momento (pedido do dono).
        if (!h.ability && input.blocking() && this.canGuard()) { this.combo = 0; this.queued = false; this.setGlow(0); this.enterBlock(camera); break; }
        if (abilPress && h.ability === 'parry' && this.useAbility(camera)) { this.combo = 0; this.queued = false; this.setGlow(0); break; }
        const step = h.combo[this.combo];
        // Golpes com end > 1: o clipe toca rápido e o herói segura a pose final até o tempo do golpe acabar
        // (ex.: giro do machado). O progresso conta pelo tempo do golpe, não para em 1.
        const p = (step.end || 0) > 1
          ? this.stateTime * step.speed * this.atkSpeed / this.anim.current.getClip().duration
          : this.anim.progress();
        // Avanço do golpe (só no começo).
        if (p < step.hit) {
          const v = (step.lunge * (h.lungeMul ?? 1) / (step.hit * this.anim.current.getClip().duration / (step.speed * this.atkSpeed)));
          this.move(Math.sin(this.facing), Math.cos(this.facing), v * dt, world);
        }
        if (!this.hitDone && p >= step.hit) {
          this.hitDone = true;
          if (this.onHit) this.onHit(this, step);
        }
        const win = step.window ?? 0.4;
        if (input.attack()) this.queued = true; // clique em qualquer momento do golpe fica guardado para o próximo
        const last = this.combo === h.combo.length - 1;
        // Golpe forte: a espada acende enquanto ele levanta e apaga depois do impacto.
        if (step.heavy) this.setGlow(p < step.hit ? p / step.hit : Math.max(0, 1 - (p - step.hit) * 5));
        if (this.queued && !last && p >= win && this.hitDone && axeTryTop(this, step, input)) {
          // Pião: segurando o ataque no fim do giro, continua girando
        } else if (this.queued && !last && p >= win && this.hitDone) {
          this.combo++;
          this.startAttack(camera);
        } else if (p >= (step.end || 0.98)) {
          this.combo = 0;
          // Último golpe com clique guardado: recomeça o combo na hora (não fica parado).
          if (last && this.queued && !this.axeAway) { this.startAttack(camera); break; }
          this.queued = false;
          this.setState('idle'); this.anim.play(h.anims.idle, { fade: 0.2 });
        } else if (moving && (last
          ? this.hitDone && p >= Math.min(step.cancel ?? h.attackCancel, step.hit + 0.08) // último golpe: andar solta logo depois do impacto
          : p >= (step.cancel ?? h.attackCancel) && !this.queued)) {
          this.combo = 0; this.queued = false;
          this.setState('run'); this.anim.play(h.anims.run, { fade: 0.2 });
        } else if (abilPress && this.hitDone && this.useAbility(camera)) {
          this.combo = 0; this.queued = false;
        }
        turnRate = 0;
        break;
      }
      case 'dodge': {
        const speed = h.dodge.distance * this.stats.dodgeMul / h.dodge.time;
        this.move(this.dodgeDir.x, this.dodgeDir.z, speed * dt, world);
        if (this.axeRoll) axeApplyRoll(this, this.stateTime / h.dodge.time); else this.applyRoll(this.stateTime / h.dodge.time);
        if (this.stateTime >= h.dodge.time) {
          this.clearRoll();
          if (this.onDodge) this.onDodge(this, 'end');
          this.dodgeCooldown = h.dodge.cooldown;
          if (input.attack()) { this.startAttack(camera); break; }
          this.setState(moving ? 'run' : 'idle');
          this.anim.play(moving ? h.anims.run : h.anims.idle, { fade: 0.12 });
        }
        turnRate = 0;
        break;
      }
      case 'sled': { // Trenó de Escudo (knightkit.js)
        kitSledTick(this, dt, world, input, tmpMove);
        turnRate = 0;
        break;
      }
      case 'spin': { // Pião (axekit.js): girando sem parar enquanto segura o ataque
        if (axeTopTick(this, dt, world, input, tmpMove) === 'heavy') { this.combo = Math.max(0, h.heavyIdx); this.startAttack(camera); }
        turnRate = 0;
        break;
      }
      case 'horse': { // Cavalo Fantasma (knightkit2.js)
        const r = kit2HorseTick(this, dt, world, input, tmpMove);
        if (r === 'attack') { this.combo = 0; this.startAttack(camera); }
        else if (r === 'end') { this.setState(moving ? 'run' : 'idle'); this.anim.play(moving ? h.anims.run : h.anims.idle, { fade: 0.15 }); }
        turnRate = 0;
        break;
      }
      case 'rooted': {
        // Preso: pisca em roxo até soltar.
        this.rootTime -= dt;
        this.vel.set(0, 0, 0);
        if (this.rootKind === 'grab') setFlash(this.bodyMats, 0.3 + 0.25 * Math.sin(this.stateTime * 24), 1, 0.25, 0.15);
        else setFlash(this.bodyMats, 0.35 + 0.25 * Math.sin(this.stateTime * 18), 0.55, 0.15, 1);
        if (this.rootTime <= 0) {
          setFlash(this.bodyMats, 0);
          this.setState(moving ? 'run' : 'idle');
          this.anim.play(moving ? h.anims.run : h.anims.idle, { fade: 0.15 });
        }
        turnRate = 0;
        break;
      }
      case 'parry': {
        // Aparar (Rapieira): defesa curtinha. Só o começo (PARRY.window) apara; depois fica exposto até acabar.
        if (this.stateTime >= (this.parryTotal || 0.42)) {
          this.setState(moving ? 'run' : 'idle');
          this.anim.play(moving ? h.anims.run : h.anims.idle, { fade: 0.12 });
        }
        turnRate = 0;
        break;
      }
      case 'stagger': {
        // Golpe batido no escudo do Guerreiro: desequilibrado, sem defesa nem rolamento por um instante.
        const k = Math.max(0, 1 - this.stateTime / this.staggerTime);
        setFlash(this.bodyMats, 0.35 * k, 1, 0.85, 0.3);
        if (this.stateTime >= this.staggerTime) {
          setFlash(this.bodyMats, 0);
          this.setState(moving ? 'run' : 'idle');
          this.anim.play(moving ? h.anims.run : h.anims.idle, { fade: 0.15 });
        }
        turnRate = 0;
        break;
      }
      case 'hurt': {
        if (!h.ability && input.blocking() && this.canGuard() && this.enterBlock(camera)) break; // bloqueio instantâneo
        if (abilPress && h.ability === 'parry' && this.useAbility(camera)) break;
        if (this.stateTime >= h.hurt.time) {
          this.setState(moving ? 'run' : 'idle');
          this.anim.play(moving ? h.anims.run : h.anims.idle, { fade: 0.15 });
        }
        turnRate = 0;
        break;
      }
      case 'drink': {
        // Bebe a poção: cura no meio da animação. Rolar cancela (sem gastar a poção, se for antes da cura).
        // Bloqueio/aparar também cancela na hora (antes da cura não gasta a poção).
        if (!h.ability && input.blocking() && this.canGuard() && this.enterBlock(camera)) break;
        if (abilPress && h.ability === 'parry' && this.useAbility(camera)) break;
        if (!this.drank && this.anim.progress() >= 0.5) {
          this.drank = true;
          // Poção Premiada: chance de não gastar a poção.
          if (this.stats.potionSave > 0 && Math.random() < this.stats.potionSave) { if (this.onText) this.onText(this, 'Poção salva!', 'gold'); }
          else this.potions--;
          if (this.stats.potionGuard) this.potionGuard = true; // Poção Concentrada: anula o próximo dano
          audio.play('potion', this.position.x, this.position.z);
          const before = this.hp, total = Math.round((h.potionHeal + this.stats.potionBonus) * this.stats.potionMul);
          this.hp = Math.min(this.maxHp, this.hp + total);
          if (this.onHeal && this.hp > before) this.onHeal(this, this.hp - before);
          // Co-op: a cura que sobrou vai para o parceiro.
          if (this.onHealOverflow && total > this.hp - before) this.onHealOverflow(this, total - (this.hp - before));
        }
        if (this.anim.progress() >= 0.85) {
          this.setState(moving ? 'run' : 'idle');
          this.anim.play(moving ? h.anims.run : h.anims.idle, { fade: 0.2 });
        }
        turnRate = 0;
        break;
      }
      case 'emote': {
        // Animação curta sem controle (abrir baú, comemorar). Rolar cancela.
        if (this.anim.progress() >= (this.emoteEnd ?? 0.95) && !this.emoteHold) {
          this.setState(moving ? 'run' : 'idle');
          this.anim.play(moving ? h.anims.run : h.anims.idle, { fade: 0.2 });
        }
        turnRate = 0;
        break;
      }
      case 'block': {
        targetFacing = this.aimAngle(camera);
        turnRate = h.turnSpeed * 1.5;
        if (moving && h.blockMoveSpeed > 0) this.position.addScaledVector(tmpMove, h.blockMoveSpeed * dt);
        if (input.potion() && !this.noPotion && this.tryDrink()) break;
        if (!input.blocking() || !this.canGuard()) { this.setState('idle'); this.anim.play(h.anims.idle, { fade: 0.15 }); }
        else if (kitBlockTick(this)) break; // Escudo Plantado: segurou o bloqueio, fincou o escudo
        else if (input.attack()) { this.combo = 0; this.startAttack(camera); }
        break;
      }
    }

    if (this.state !== 'attack' && this.glow > 0) this.setGlow(Math.max(0, this.glow - dt * 6));
    if (turnRate > 0) this.facing = lerpAngle(this.facing, targetFacing, 1 - Math.exp(-turnRate * dt));
    this.group.rotation.y = this.facing;
    world.resolveCircle(this.position, h.radius);
    this.anim.update(dt);
    if (this.aimParts && this.aimParts.length) this.aimClaws(dt);
    this.aimForward();
  }

  // Besta do Ladino (pedido do dono, 31/10): a mão gira de lado nas animações; a besta fica sempre
  // deitada e apontada para a frente do herói, presa na mão.
  aimForward() {
    const w = this.weapon, ws = this.hero && this.hero.weapons;
    if (!w || !ws || !ws.right || !ws.right.forward || !w.parent) return;
    const q = (this._fwdQ ||= w.quaternion.clone()).identity();
    for (let o = w.parent; o && o !== this.model; o = o.parent) q.premultiply(o.quaternion);
    w.quaternion.copy(q.invert());
  }

  // Garras do Ladino: atacando, as lâminas (eixo -X do modelo) apontam para a frente do herói.
  aimClaws(dt) {
    this.aimW += ((this.state === 'attack' ? 1 : 0) - this.aimW) * Math.min(1, dt * 18);
    const fwd = aimTmp.v.set(Math.sin(this.facing), -0.12, Math.cos(this.facing)).normalize();
    for (const a of this.aimParts) {
      if (this.aimW < 0.01) { a.o.quaternion.copy(a.rest); continue; }
      const parent = a.o.parent; parent.updateWorldMatrix(true, false);
      // base: lâmina = -fwd, "cima" da garra = cima do mundo
      const x = aimTmp.x.copy(fwd).negate(), y = aimTmp.y.set(0, 1, 0), z = aimTmp.z.crossVectors(x, y).normalize(); y.crossVectors(z, x);
      aimTmp.m.makeBasis(x, y, z);
      const want = aimTmp.q.setFromRotationMatrix(aimTmp.m);
      parent.getWorldQuaternion(aimTmp.pq);
      want.premultiply(aimTmp.pq.invert());
      a.o.quaternion.copy(a.rest).slerp(want, this.aimW);
    }
  }

  // Toca uma animação "de cena" (ex.: Interact, Cheering). hold = fica parado no fim.
  emote(clip, { speed = 1, end = 0.95, hold = false, face } = {}) {
    if (this.state === 'dead') return;
    if (face !== undefined) { this.facing = face; this.group.rotation.y = face; }
    this.combo = 0;
    this.setGlow(0);
    this.emoteEnd = end;
    this.emoteHold = hold;
    this.setState('emote');
    this.anim.play(clip, { once: true, speed, restart: true, fade: 0.12 });
  }

  // Botão direito do Ladino: bomba de fumaça ou aparar (Rapieira). Devolve true se usou.
  useAbility(camera) {
    const h = this.hero;
    if (h.ability === 'smoke') return !!(this.onSmoke && this.onSmoke(this));
    if (h.ability === 'parry') {
      if (this.parryCd > 0) return false;
      this.parryCd = this.parryCooldown || 0.45;
      this.facing = this.aimAngle(camera);
      this.group.rotation.y = this.facing;
      this.setState('parry');
      this.anim.play(h.anims.blockStart, { once: true, speed: 2.8, fade: 0.04, restart: true });
      if (this.onParryStart) this.onParryStart(this);
      return true;
    }
    return false;
  }

  // Escudo quebrado: não bloqueia (aviso curto). Devolve true se entrou no bloqueio.
  enterBlock(camera) {
    const h = this.hero;
    if (h.noShield) return false; // arma de duas mãos: sem escudo, sem bloqueio
    if (kitTryPickup(this)) return false; // Escudo Plantado: perto dele, pega de volta
    if (kit2TryKick(this)) return false; // Mesa Virada: objeto na frente do escudo é chutado
    if (!kitCanBlock(this)) return false; // escudo longe (arremessado/fincado) ou espada longe (Mãos Trocadas)
    if (this.shield <= 0 && !kitSwordGuard(this)) {
      if (!this.noShieldCd && this.onNoShield) this.onNoShield(this);
      this.noShieldCd = 1.2;
      return false;
    }
    this.setState('block');
    this.facing = this.aimAngle(camera);
    this.anim.play(h.anims.blockStart, {
      once: true, speed: 2.2, fade: 0.08, restart: true,
      onFinish: () => { if (this.state === 'block') this.anim.play(h.anims.blocking, { fade: 0.1 }); },
    });
    kitOnGuard(this); // Corrente no Escudo
    return true;
  }
}
