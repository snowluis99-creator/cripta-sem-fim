// Venham, Irmãos (lendária do Mangual): quem é cada irmão. Arma sorteada entre todas do jogo (heróis, esqueletos
// e chefes), modelo, tamanho, cor, enfeite na cabeça, escudo e cavalo. Nunca 2 iguais na sala: dois com a mesma
// arma têm tamanho ou cor diferente (chaves "look" e "arma" únicas entre os vivos).
// Os dados de cada irmão viram um inimigo aliado (Enemy com opts.data, como os mortos-vivos da Maga).
import * as THREE from 'three';
import { HEROES, WEAPONS } from './heroes.js';
import { ENEMIES } from './enemies.js';
import { findBone } from './characters.js';
import { mountedClip } from './animation.js';
import { makeHorse } from './horse.js';
import { L1 } from './l1bless.js';

const B = () => L1.bro;
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export const BRO_MODELS = ['heroes/Knight.glb', 'heroes/Knight.glb', 'heroes/Knight.glb', 'heroes/Barbarian.glb', 'heroes/Ranger.glb', 'heroes/Rogue.glb', 'heroes/Rogue_Hooded.glb', 'heroes/Mage.glb'];
export const BRO_TINTS = [
  { id: 'branco', c: 0xffffff }, { id: 'vermelho', c: 0xd8312a }, { id: 'azul', c: 0x2f6be0 }, { id: 'verde', c: 0x2f9a45 },
  { id: 'dourado', c: 0xf0b833 }, { id: 'roxo', c: 0x8a3fd0 }, { id: 'negro', c: 0x3a3440 }, { id: 'prata', c: 0xb9c4d0 },
  { id: 'laranja', c: 0xf07a22 }, { id: 'turquesa', c: 0x22c0b8 }, { id: 'rosa', c: 0xf06aa8 }, { id: 'marrom', c: 0x8a5a32 },
];
export const BRO_SIZES = [0.82, 0.95, 1.08, 1.22, 1.38];
const HORSES = [
  { coat: 0x7a4a2a, mane: 0x2a1a10 }, { coat: 0x2a2421, mane: 0x111111 }, { coat: 0xece6da, mane: 0xd8d0c0 },
  { coat: 0x8d8d8d, mane: 0x3a3a3a }, { coat: 0x9a4a1e, mane: 0x4a1e0a }, { coat: 0xd7b56d, mane: 0xf4ecd0 },
];
const HEADGEAR = ['none', 'none', 'plume', 'plume', 'crown', 'horns', 'halo'];
const NAMES = ['Sir Bartolomeu', 'Dom Rodrigo', 'Sir Gaspar', 'Sir Leopoldo', 'Dom Afonso', 'Sir Godofredo', 'Sir Teobaldo', 'Dom Henrique',
  'Sir Valdemar', 'Sir Rolando', 'Dom Sancho', 'Sir Percival', 'Sir Tristão', 'Dom Fernão', 'Sir Lancelote', 'Sir Gawain', 'Dom Pelágio',
  'Sir Ulrico', 'Sir Bernardo', 'Dom Nuno', 'Sir Aldo', 'Sir Edmundo', 'Dom Vasco', 'Sir Hugo', 'Sir Osvaldo', 'Dom Martim', 'Sir Reinaldo',
  'Sir Galahad', 'Dom Garcia', 'Sir Cassiano', 'Sir Severino', 'Dom Bento', 'Sir Matias', 'Sir Quintino', 'Dom Lourenço', 'Sir Ivo',
  'Sir Leôncio', 'Dom Raimundo', 'Sir Wilfredo', 'Sir Arnaldo', 'Dom Tomé', 'Sir Benedito'];

// ---------- Todas as armas do jogo ----------
let POOL = null, SHIELDS = null;
const keyOf = (w) => w ? `${w.flail ? 'flail' : w.model}${w.tint ? `#${w.tint}` : ''}${w.fx ? `@${w.fx}` : ''}${w.gold ? '$' : ''}` : '-';
function kindOf(r, l) {
  const m = r.model || '';
  if (/crossbow/i.test(m)) return 'xbow';
  if (/bow/i.test(m)) return 'bow';
  if (/staff|wand/i.test(m)) return 'magic';
  if (/fistweapon/i.test(m)) return 'fist';
  if (l && /dagger/i.test(l.model || '') && /dagger/i.test(m)) return 'dual';
  if (/spear|halberd/i.test(m)) return 'spear';
  if (/2handed|sword_C|hammer/i.test(m)) return '2h';
  return '1h';
}
export function broWeapons() {
  if (POOL) return POOL;
  const list = [], shields = new Map(), seen = new Set();
  const take = (w, src, boss = false) => {
    if (!w || !w.right || w.right.flail) return;
    if (w.left && /shield/i.test(w.left.model || '')) shields.set(keyOf(w.left), w.left);
    const left = w.left && !/shield/i.test(w.left.model || '') ? w.left : null;
    const k = keyOf(w.right) + '|' + keyOf(left);
    if (seen.has(k)) { if (boss) list.find((x) => x.key === k).boss = true; return; }
    seen.add(k);
    list.push({ key: k, right: w.right, left, src, boss, kind: kindOf(w.right, left) });
  };
  for (const [id, h] of Object.entries(HEROES)) {
    take(h.weapons, id);
    for (const wd of WEAPONS[id] || []) if (wd.set && wd.set.weapons) take(wd.set.weapons, id);
  }
  for (const [id, e] of Object.entries(ENEMIES)) if (e.weapons) take(e.weapons, id, !!e.boss);
  for (const w of Object.values(ENEMIES)) if (w.weapons && w.weapons.left && /shield/i.test(w.weapons.left.model || '')) shields.set(keyOf(w.weapons.left), w.weapons.left);
  POOL = list; SHIELDS = [...shields.values()];
  return POOL;
}
export const broShields = () => { broWeapons(); return SHIELDS; };

// Dano de cada golpe/tiro conforme a arma (decisão do dono: "conforme a arma").
export function broDamage(w) { const D = B().dmg; return w.boss ? D.boss : D[w.kind] || D['1h']; }

// ---------- Sorteio de um irmão único ----------
// taken = irmãos vivos (specs). force = campos fixos (testes).
export function rollBrother(taken = [], force = {}) {
  const pool = broWeapons();
  const looks = new Set(taken.map((s) => `${s.model}|${s.tint}|${s.size}`));
  const arms = new Set(taken.map((s) => `${s.weapon}|${s.tint}|${s.size}`));
  const names = new Set(taken.map((s) => s.name));
  for (let i = 0; i < 400; i++) {
    const w = force.weapon ? pool.find((x) => x.key === force.weapon) || pick(pool) : pick(pool);
    const ranged = w.kind === 'bow' || w.kind === 'xbow' || w.kind === 'magic';
    const s = {
      model: force.model || pick(BRO_MODELS),
      weapon: w.key,
      tint: force.tint ?? Math.floor(Math.random() * BRO_TINTS.length),
      size: force.size ?? Math.floor(Math.random() * BRO_SIZES.length),
      mount: force.mount ?? (Math.random() < B().mountChance ? Math.floor(Math.random() * HORSES.length) : -1),
      shield: -1,
      head: force.head || pick(HEADGEAR),
      gold: force.gold ?? Math.random() < 0.12,
      name: '',
    };
    if (s.mount >= 0) s.size = Math.min(s.size, 2); // montado: tamanho normal (o cavalo é que é grande)
    if (!ranged && (w.kind === '1h' || w.kind === 'fist') && Math.random() < 0.55) s.shield = Math.floor(Math.random() * broShields().length);
    if (force.shield !== undefined) s.shield = force.shield;
    if (looks.has(`${s.model}|${s.tint}|${s.size}`) || arms.has(`${s.weapon}|${s.tint}|${s.size}`)) continue;
    const free = NAMES.filter((n) => !names.has(n));
    s.name = free.length ? pick(free) : `Sir Irmão ${taken.length + 1}`;
    return s;
  }
  return null;
}
export const broLookKey = (s) => `${s.model}|${s.tint}|${s.size}`;
export const broArmKey = (s) => `${s.weapon}|${s.tint}|${s.size}`;

// ---------- Dados de combate (Enemy) de um irmão ----------
export function broData(s) {
  const C = B();
  const w = broWeapons().find((x) => x.key === s.weapon) || broWeapons()[0];
  const size = BRO_SIZES[s.size] || 1, mounted = s.mount >= 0;
  const dmg = broDamage(w);
  const m = (n) => (mounted ? mountedClip(n) : n);
  const right = { ...w.right, gold: w.right.gold || s.gold };
  const left = w.left ? { ...w.left } : s.shield >= 0 ? { ...broShields()[s.shield] } : null;
  const ATK = {
    '1h': { clip: pick(['Melee_1H_Attack_Chop', 'Melee_1H_Attack_Slice_Horizontal', 'Melee_1H_Attack_Slice_Diagonal']), speed: 1.2, hit: 0.45, aim: 0.25, end: 0.85, reach: 2.4, arc: 130, lunge: 0.6 },
    fist: { clip: pick(['Melee_Unarmed_Attack_Punch_A', 'Melee_Unarmed_Attack_Kick']), speed: 1.6, hit: 0.4, aim: 0.25, end: 0.75, reach: 2.0, arc: 120, lunge: 0.4 },
    dual: { clip: pick(['Melee_Dualwield_Attack_Slice', 'Melee_Dualwield_Attack_Chop', 'Melee_Dualwield_Attack_Stab']), speed: 1.5, hit: 0.4, aim: 0.25, end: 0.8, reach: 2.2, arc: 130, lunge: 0.6 },
    '2h': { clip: pick(['Melee_2H_Attack_Chop', 'Melee_2H_Attack_Slice', 'Melee_2H_Attack_Spin']), speed: 1.0, hit: 0.48, aim: 0.25, end: 0.85, reach: 2.9, arc: 170, lunge: 0.6 },
    spear: { clip: 'Melee_2H_Attack_Stab', speed: 1.2, hit: 0.3, aim: 0.2, end: 0.65, reach: 3.8, arc: 60, lunge: 0.9 },
  };
  const a = { ...(ATK[w.kind] || ATK['1h']) };
  a.reach = a.reach * (0.8 + 0.2 * size) + (mounted ? 0.6 : 0);
  a.clip = m(a.clip);
  const idle0 = w.kind === '2h' || w.kind === 'spear' ? 'Melee_2H_Idle' : w.kind === 'bow' ? 'Ranged_Bow_Idle' : 'Idle_A';
  const data = {
    name: s.name, bro: true, model: s.model,
    weapons: { right, left },
    hp: C.hp, radius: (mounted ? 0.95 : 0.6) * (mounted ? 1 : size),
    speed: mounted ? C.speed.mounted : C.speed.foot * (size > 1.2 ? 0.9 : 1), walkAnimSpeed: 1.0, turnSpeed: 10,
    attackRange: a.reach - 0.3, damage: dmg, attack: a,
    cooldown: [0.55, 1.15], contact: 0, knockback: mounted ? 0.3 : 0.7 / size, stagger: 0.3, staggerOnlyHeavy: false,
    scale: mounted ? 0 : size,
    anims: { spawn: m('Idle_A'), idle: m(idle0), walk: m(mounted ? idle0 : 'Running_A'), hit: m('Hit_A'), death: 'Death_A', block: m('Melee_Block_Hit') },
  };
  if (!data.scale) delete data.scale;
  if (left && /shield/i.test(left.model || '') && w.kind !== 'dual') data.shield = { arc: 140 };
  if (w.kind === 'bow' || w.kind === 'xbow' || w.kind === 'magic') {
    const mag = w.kind === 'magic', bow = w.kind === 'bow';
    data.attackRange = 0;
    data.cooldown = [0.9, 1.5];
    data.ranged = {
      max: 14, keep: 8, flee: 3.2, back: 1.6, aim: mag ? 0.5 : 0.4,
      aimClip: m(mag ? 'Ranged_Magic_Spellcasting' : bow ? 'Ranged_Bow_Aiming_Idle' : 'Ranged_1H_Aiming'),
      shootClip: m(mag ? 'Ranged_Magic_Shoot' : bow ? 'Ranged_Bow_Release' : 'Ranged_1H_Shoot'),
      recover: 0.35, speed: mag ? 15 : 24, damage: dmg,
      ...(mag ? { kind: 'orb', homing: 1.1, color: right.tint || BRO_TINTS[s.tint].c } : {}),
    };
  }
  return { data, w };
}

// ---------- Visual: cor, enfeite na cabeça e cavalo ----------
const tmpC = new THREE.Color();
export function broDress(e, s) {
  const tint = BRO_TINTS[s.tint] || BRO_TINTS[0];
  const col = new THREE.Color(tint.c);
  // Capa/capuz na cor cheia; o resto do corpo puxado de leve para a cor.
  e.model.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.color) return;
    if (/Cape|Hat/.test(o.name)) { o.material.map = null; o.material.color.copy(col); o.material.needsUpdate = true; } // capa, chapéu da Maga, chapéu de urso do Bárbaro
    else if (tint.id !== 'branco') o.material.color.copy(tmpC.setRGB(1, 1, 1).lerp(col, tint.id === 'negro' ? 0.6 : 0.38));
  });
  if (s.head !== 'none') addHeadgear(e, s.head, col);
  if (s.mount >= 0) {
    const h = HORSES[s.mount];
    const horse = makeHorse({ coat: h.coat, mane: h.mane, cloth: tint.c });
    horse.g.scale.setScalar(B().horseScale);
    e.group.add(horse.g);
    e.horse = horse; e.horseT = Math.random() * 3;
    e.model.position.y = B().seat;
  }
}

function dirToLocal(bone, v) {
  const q = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
  return v.clone().applyQuaternion(q).normalize();
}
// Grupo preso ao osso da cabeça com eixos do corpo (x = direita, y = cima, z = frente), medido na pose de referência.
function headRig(e) {
  const head = findBone(e.model, 'head');
  if (!head) return null;
  let skin = null; e.model.traverse((o) => { if (o.isSkinnedMesh && !skin) skin = o; });
  if (skin) skin.skeleton.pose();
  const keep = e.group.rotation.y; e.group.rotation.y = 0; e.group.updateMatrixWorld(true);
  const ws = head.getWorldScale(new THREE.Vector3()).x / Math.max(1e-6, e.group.getWorldScale(new THREE.Vector3()).x);
  const up = dirToLocal(head, new THREE.Vector3(0, 1, 0)), fwd = dirToLocal(head, new THREE.Vector3(0, 0, 1));
  const side = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const rig = new THREE.Group();
  rig.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side.clone().negate(), up, fwd));
  rig.scale.setScalar(1 / (ws || 1));
  head.add(rig);
  e.group.rotation.y = keep; e.group.updateMatrixWorld(true);
  return rig;
}
const std = (color, emissive = 0x000000, ei = 0, metal = 0.2) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.5, metalness: metal });
function addHeadgear(e, kind, col) {
  const rig = headRig(e);
  if (!rig) return;
  const g = new THREE.Group(); rig.add(g);
  if (kind === 'plume') { // pluma colorida em cima do elmo
    const m = std(col.getHex(), col.getHex(), 0.25, 0);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8).scale(0.55, 0.5, 1.9), m);
      f.position.set(0, 0.78 - i * 0.02, -0.05 - i * 0.16); f.rotation.x = -0.35 - i * 0.22; g.add(f);
    }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.12, 8), std(0xe8b84a, 0x4a3000, 0.4, 0.6));
    base.position.set(0, 0.7, 0); g.add(base);
  } else if (kind === 'crown') { // coroa dourada
    const m = std(0xffcf4a, 0x8a5a00, 0.5, 0.7);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.13, 16, 1, true), m); ring.position.y = 0.68; g.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.17, 6), m);
      sp.position.set(Math.sin(a) * 0.34, 0.8, Math.cos(a) * 0.34); g.add(sp);
      if (i % 2 === 0) { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), std(col.getHex(), col.getHex(), 0.8, 0.1)); gem.position.set(Math.sin(a) * 0.36, 0.68, Math.cos(a) * 0.36); g.add(gem); }
    }
  } else if (kind === 'horns') { // chifres de viking
    const m = std(0xeee6d2, 0x000000, 0, 0.05);
    for (const sd of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.42, 10), m);
      h.position.set(sd * 0.36, 0.62, 0.02); h.rotation.z = -sd * 0.95; g.add(h);
    }
  } else if (kind === 'halo') { // auréola sagrada
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
    h.rotation.x = Math.PI / 2; h.position.y = 0.95; g.add(h);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  e.headgear = g;
}
