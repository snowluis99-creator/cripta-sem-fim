// Objetos de recompensa no mundo: orbe de bênção, ouro, poção, baú, itens do mercador, cama de descanso,
// e os ícones que flutuam em cima das portas.
import * as THREE from 'three';
import { instance } from './assets.js';
import { getGlowTexture } from './dungeon/builder.js';
import { makeFlail, updateFlail } from './flail.js';
import { buildWeapon } from './characters.js';
import { tickWeaponFx } from './weaponfx.js';

export const REWARD_MODELS = [
  'dungeon/coin_stack_medium.gltf', 'dungeon/coin_stack_small.gltf', 'dungeon/bottle_B_green.gltf',
  'dungeon/chest_gold.gltf', 'dungeon/chest.gltf', 'props/crypt/skull.gltf', 'props/loot/Gold_Bars_Stack_Small.gltf',
  'dungeon/bed_floor.gltf', 'dungeon/keyring.gltf', 'dungeon/coin.gltf', 'weapons/heroes/mug_full.gltf',
];

// Brilho colorido (sprite aditivo).
function glow(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getGlowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  s.scale.setScalar(size);
  return s;
}

// Anel no chão com a cor do dono (co-op).
export function ownerRing(color, r = 0.85) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.8, r, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.1;
  return m;
}

// Orbe da bênção: núcleo branco + halo colorido.
function orb(color, size = 1) {
  const g = new THREE.Group();
  const halo = glow(color, 2.2 * size);
  const core = glow(0xffffff, 0.9 * size);
  g.add(halo, core);
  g.userData.halo = halo;
  return g;
}

function model(path, scale = 1) {
  const o = instance(path);
  o.scale.setScalar(scale);
  return o;
}

// Modelo do ícone de cada tipo de porta/recompensa.
export function iconFor(kind) {
  const g = new THREE.Group();
  switch (kind) {
    case 'blessing': g.add(orb(0xc27bff, 0.8)); break;
    case 'gold': g.add(model('dungeon/coin_stack_small.gltf', 0.9), glow(0xffc24a, 1.6)); break;
    case 'potion': g.add(model('dungeon/bottle_B_green.gltf', 1.1), glow(0xe2384b, 1.6)); break;
    case 'treasure': g.add(model('dungeon/chest_gold.gltf', 0.55), glow(0xffd36a, 2)); break;
    case 'merchant': g.add(model('props/loot/Gold_Bars_Stack_Small.gltf', 0.8), glow(0x7dff8a, 1.8)); break;
    case 'rest': g.add(model('weapons/heroes/mug_full.gltf', 1.5), glow(0x8ad8ff, 1.6)); break;
    case 'elite': g.add(model('props/crypt/skull.gltf', 0.75), glow(0xff3030, 2.2)); break;
    case 'exit': g.add(model('dungeon/keyring.gltf', 1.1), glow(0xffffff, 1.8)); break;
    default: g.add(glow(0xffffff, 1.5));
  }
  g.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
  return g;
}

// Objeto que fica girando/flutuando no chão até ser pego.
// kind: blessing | gold | potion | chest | shop | bed. auto = pega ao encostar; senão precisa apertar E.
export class Pickup {
  constructor(kind, pos, opts = {}) {
    this.kind = kind;
    this.pos = pos.clone();
    this.opts = opts;
    this.auto = ['blessing', 'gold', 'potion'].includes(kind);
    this.radius = opts.radius ?? (this.auto ? 1.3 : 2.0);
    this.taken = false;
    this.t = Math.random() * 6;
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    this.float = true;
    switch (kind) {
      case 'blessing': this.body = orb(opts.color ?? 0xc27bff); this.body.position.y = 1.4; break;
      case 'gold': this.body = model('dungeon/coin_stack_medium.gltf', 1); this.group.add(glow(0xffc24a, 2.4)); break;
      case 'potion': this.body = model('dungeon/bottle_B_green.gltf', 1.3); this.group.add(glow(0xe2384b, 2.2)); break;
      case 'chest': this.body = model(opts.gold === false ? 'dungeon/chest.gltf' : 'dungeon/chest_gold.gltf', 1.15); this.float = false; break;
      case 'bed': this.body = new THREE.Group(); this.float = false; break; // a cama já faz parte da sala
      case 'shop':
        if (opts.item === 'weapon') {
          // Arma em exposição no suporte da Taverna (+ escudo ao lado, se o conjunto tiver).
          // opts.arms = armas do herói com esta arma (heroWith); sem isso, as da arma.
          const ws = opts.arms || opts.weapon.set.weapons;
          this.body = new THREE.Group();
          const r = ws ? ws.right : { model: 'weapons/heroes/sword_1handed.gltf' };
          const l = ws ? ws.left : { model: 'weapons/heroes/shield_badge_color.gltf' };
          const main = buildWeapon(r);
          main.scale.multiplyScalar((r.tip > 1.8 ? 0.7 : 1) * (r.tip < 0.9 && !r.flail ? 1.6 : 1));
          this.fxObj = main;
          main.position.x = l ? -0.35 : 0;
          main.rotation.z = r.tip > 1.8 ? 0.35 : 0;
          this.body.add(main);
          if (l) { const sh = model(l.model, (l.scale || 1) * 0.8); sh.position.set(0.45, 0.25, 0); this.body.add(sh); }
          this.flail = r.flail ? main : null;
          this.base = 1.25;
          this.group.add(glow(opts.color, 2.6));
          this.eqRing = ownerRing(0xffd36a, 1.25);
          this.eqRing.visible = false;
          this.group.add(this.eqRing);
          break;
        }
        if (opts.item === 'hero') { this.body = new THREE.Group(); this.float = false; break; } // cadeira de herói (Taverna)
        this.body = opts.item === 'potion' ? model('dungeon/bottle_B_green.gltf', 0.9) : orb(opts.color ?? 0xc27bff, 0.55);
        this.base = opts.item === 'potion' ? 1.0 : 1.55; break;
      default: this.body = new THREE.Group();
    }
    this.group.add(this.body);
    if (this.group.children.length > 1) this.group.children[0].position.y = 0.9;
    // Co-op: anel colorido no chão = de qual jogador é (laranja = Jogador 1, azul = Jogador 2).
    if (opts.ringColor !== undefined) this.group.add(ownerRing(opts.ringColor, kind === 'chest' ? 1.3 : 0.85));
  }

  get prompt() { return this.opts.prompt || ''; }

  // Taverna: anel dourado no chão = arma equipada.
  setEquipped(v) { if (this.eqRing) this.eqRing.visible = v; }

  update(dt) {
    this.t += dt;
    if (this.float) {
      const base = this.base ?? (this.kind === 'blessing' ? 1.4 : 0.35);
      this.body.position.y = base + Math.sin(this.t * 2.4) * 0.15;
      if (this.kind !== 'blessing') this.body.rotation.y += dt * (this.eqRing ? 0.9 : 1.6);
      if (this.flail) updateFlail(this.flail, dt);
      if (this.fxObj) tickWeaponFx(this.fxObj, dt);
      if (this.body.userData.halo) this.body.userData.halo.scale.setScalar(2.2 * (this.opts.size ?? 1) * (1 + Math.sin(this.t * 4) * 0.08));
    }
    if (this.shake > 0) {
      this.shake -= dt;
      this.body.rotation.z = Math.sin(this.t * 60) * 0.08 * Math.max(0, this.shake);
    }
  }
}
