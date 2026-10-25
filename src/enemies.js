// Inimigos: dados (fácil de balancear) + IA simples por estados.
// Estados: spawn (levantando do chão) → chase (persegue) → attack → hurt (atordoado) / block → dead.
import * as THREE from 'three';
import { Animator } from './animation.js';
import { makeCharacter, attachWeapon, makeFlashable, setFlash } from './characters.js';
import { makeIceBlock } from './magic.js';
import { tryAbility, runAbility, initAbilities, hideTelegraphs, tickCooldowns, startRage, raiseRightArm, ABILITY_STATES, releaseGrab } from './abilities.js';
import { archerChase, startRoll } from './ranged.js';
import { dropHeld } from './toss.js';
import { applyDifficulty } from './difficulty.js';
import { meleeMove, leadAngle, targetBusy } from './brain.js';
import { checkPhase } from './necro.js';
import { voiceState, voiceHit, voiceTick } from './voice.js';
import { GHOST_STATES, HIDDEN_STATES, setGhost, shadowTick } from './shadow.js';

const SKELETON_ANIMS = {
  spawn: 'Skeletons_Awaken_Floor',
  idle: 'Skeletons_Idle',
  walk: 'Skeletons_Walking',
  hit: 'Hit_A',
  death: 'Skeletons_Death',
  block: 'Melee_Block_Hit',
};

export const ENEMIES = {
  minion: {
    name: 'Lacaio',
    model: 'enemies/Skeleton_Minion.glb',
    weapons: { right: { model: 'weapons/skeletons/Skeleton_Blade.gltf', rot: [0, 0, 0] } },
    hp: 30,
    radius: 0.6,
    speed: 3.4,          // unidades por segundo (herói: 7)
    walkAnimSpeed: 1.5,
    turnSpeed: 8,
    attackRange: 2.0,    // começa o ataque a esta distância
    damage: 10,
    // Ataque: hit = momento do dano (0..1 do clipe); aim = até aqui ele ainda vira para o herói.
    attack: { clip: 'Melee_1H_Attack_Chop', speed: 1.0, hit: 0.59, aim: 0.3, end: 0.9, reach: 2.3, arc: 110, lunge: 0.8 },
    cooldown: [0.9, 1.7],
    contact: 5,          // dano ao encostar no herói
    // Salto pelas costas: pula para trás do herói, prepara (olhos + anel vermelho) e dá um golpe rápido.
    leap: { range: [2.6, 7], cooldown: [3.5, 5.5], first: [1.0, 2.5], time: 0.5, height: 1.8, behind: 1.9, wind: 0.5,
      grab: 0.6, afterGrab: 0.2, // encostou no herói durante o salto: agarra 0,6 s e emenda o golpe
      attack: { clip: 'Melee_1H_Attack_Slice_Horizontal', speed: 2.4, hit: 0.24, aim: 0.02, end: 0.62, reach: 2.4, arc: 160, lunge: 0.5, damage: 9, glow: false } },
    knockback: 1,        // quanto é empurrado pelos golpes
    stagger: 0.4,        // tempo atordoado ao levar um golpe
    staggerOnlyHeavy: false,
    anims: SKELETON_ANIMS,
  },
  warrior: {
    name: 'Guerreiro',
    model: 'enemies/Skeleton_Warrior.glb',
    weapons: {
      right: { model: 'weapons/skeletons/Skeleton_Axe.gltf', rot: [0, 0, 0] },
      left: { model: 'weapons/skeletons/Skeleton_Shield_Large_A.gltf', rot: [0, 0, 0] },
    },
    hp: 60,
    radius: 0.7,
    speed: 2.6,
    walkAnimSpeed: 1.15,
    turnSpeed: 2.6,      // vira devagar: dá para rolar e pegar ele pelas costas
    attackRange: 2.2,
    damage: 15,
    attack: { clip: 'Melee_1H_Attack_Chop', speed: 0.85, hit: 0.59, aim: 0.35, end: 0.92, reach: 2.6, arc: 110, lunge: 0.6 },
    cooldown: [1.4, 2.2],
    contact: 8,
    // Investida: agacha mostrando a direção no chão e dispara muito rápido em linha reta.
    charge: { range: [3.5, 14], cooldown: [5, 8], first: [2, 4], wind: 0.75, speed: 26, distance: 15, damage: 20, push: 14, recover: 0.8 },
    knockback: 0.35,
    stagger: 1.0,        // só o golpe forte atordoa (quebra a guarda)
    staggerOnlyHeavy: true,
    shield: { arc: 130, bash: { time: 0.6, push: 9 } }, // bloqueia golpes deste ângulo; bash = rebate o herói (desequilibrado 0,6 s)
    anims: SKELETON_ANIMS,
  },
  // Arqueiro: fica longe, foge se o herói chega perto e atira com a besta (ranged.js).
  archer: {
    name: 'Arqueiro',
    model: 'enemies/Skeleton_Rogue.glb',
    weapons: { right: { model: 'weapons/skeletons/Skeleton_Crossbow.gltf', rot: [0, 0, 0] } },
    hp: 24,
    radius: 0.6,
    speed: 3.6,
    walkAnimSpeed: 1.5,
    turnSpeed: 7,
    attackRange: 0,      // não ataca de perto
    damage: 6,
    attack: { clip: 'Melee_1H_Attack_Chop', speed: 1.0, hit: 0.59, aim: 0.3, end: 0.9, reach: 2.3, arc: 110, lunge: 0.5 },
    cooldown: [1.4, 2.2], // tempo entre um tiro e outro
    contact: 4,
    // min/max = distância que ele gosta de ficar; flee = perto disso ele foge; aim = tempo mirando antes do tiro.
    // keep = distância que ele tenta manter (anda de costas, mirando); back = velocidade andando para trás enquanto mira.
    // roll = no 1º golpe que recebe: rola para longe e recarrega a besta.
    ranged: { max: 13, keep: 9, flee: 4.5, back: 1.6, aim: 0.55, aimClip: 'Ranged_2H_Aiming', shootClip: 'Ranged_2H_Shoot', recover: 0.45, speed: 19, damage: 9,
      roll: { dist: 4.5, time: 0.45, reload: 1.1, clip: 'Ranged_2H_Reload' } },
    knockback: 1.1,
    stagger: 0.45,
    staggerOnlyHeavy: false,
    anims: SKELETON_ANIMS,
  },
  // Chefe da sala elite do andar 1: um Guerreiro grande e resistente.
  guardian: {
    name: 'Rei Skullbone',
    model: 'enemies/Skeleton_Warrior.glb',
    weapons: {
      right: { model: 'weapons/skeletons/Skeleton_Axe.gltf', rot: [0, 0, 0] },
      left: { model: 'weapons/skeletons/Skeleton_Shield_Large_B.gltf', rot: [0, 0, 0] },
    },
    scale: 1.4,
    hp: 480,
    radius: 1.0,
    speed: 2.5,
    walkAnimSpeed: 1.0,
    turnSpeed: 2.2,
    attackRange: 3.0,
    damage: 22,
    attack: { clip: 'Melee_1H_Attack_Chop', speed: 0.75, hit: 0.59, aim: 0.4, end: 0.92, reach: 3.5, arc: 120, lunge: 1.0 },
    cooldown: [1.2, 2.0],
    contact: 12,
    // Habilidades do chefe.
    spin: { range: 4.2, radius: 4.4, cooldown: [4, 6], first: [2, 3], wind: 0.6, speed: 1.15, hit: 0.35, damage: 26, push: 12 },
    summon: { cooldown: [12, 15], first: [6, 7], time: 1.8, list: [['minion', 3]], cap: 6 },
    cast: { cooldown: [6, 8], first: [3, 4], time: 1.4, count: 3, radius: 1.6, warn: 0.9, life: 5, root: 1.6 },
    // Arremesso: pega um esqueleto perto dele e joga no herói (toss.js). reach = até onde ele alcança um esqueleto.
    toss: { cooldown: [6, 9], first: [3, 5], reach: 6, minDist: 3.5, maxDist: 16, pull: 0.45, release: 0.42, throwSpeed: 1.25,
      flight: 0.7, height: 3.2, radius: 1.9, damage: 20, push: 11, stun: 0.7 },
    knockback: 0.12,
    stagger: 0.8,
    staggerOnlyHeavy: true,
    shield: { arc: 120 },
    // Metade da vida: enfurecido. stats substituem os números acima (escala 2× do tamanho atual).
    rage: {
      at: 0.5, grow: 1.4, time: 2.0,
      stats: {
        scale: 2.8, radius: 2.0, speed: 3.0, turnSpeed: 2.8, attackRange: 5.0, damage: 30, contact: 18,
        attack: { clip: 'Melee_1H_Attack_Chop', speed: 0.85, hit: 0.59, aim: 0.4, end: 0.92, reach: 6.4, arc: 130, lunge: 1.6 },
        cooldown: [1.0, 1.7],
        // Giro: pega a sala inteira (global) e não dá para rolar; só o escudo defende.
        spin: { range: 9, radius: 60, global: true, boneSword: { count: 14, every: 0.2, fly: 0.55, hold: 0.35, walkTimeout: 4 }, cooldown: [7, 9], first: [3, 4], wind: 0.9, speed: 1.0, hit: 0.35, damage: 34, push: 16 },
        summon: { cooldown: [14, 17], first: [8, 9], time: 1.8, list: [['minion', 3], ['archer', 1]], cap: 7 },
        // Círculos cobrindo 3/4 do chão da sala (80% das casas da grade ≈ 75% da área).
        cast: { cooldown: [10, 13], first: [5, 6], time: 1.4, fill: 0.8, radius: 2.3, warn: 0.35, life: 4, root: 1.3 },
        toss: { cooldown: [5, 7], first: [2, 3], reach: 10, minDist: 4, maxDist: 22, pull: 0.4, release: 0.42, throwSpeed: 1.25,
          flight: 0.75, height: 5, radius: 2.4, damage: 28, push: 14, stun: 0.7 },
        // Habilidades dos outros esqueletos:
        leap: { range: [4, 14], cooldown: [6, 9], first: [2, 3], time: 0.7, height: 4, behind: 4.2, wind: 0.35,
          attack: { clip: 'Melee_1H_Attack_Slice_Horizontal', speed: 1.7, hit: 0.24, aim: 0.02, end: 0.62, reach: 6.0, arc: 170, lunge: 0.8, damage: 28, glow: false } },
        charge: { range: [5, 24], cooldown: [6, 9], first: [4, 6], wind: 0.6, speed: 30, distance: 24, damage: 32, push: 18, recover: 0.9 },
        volley: { range: 10, cooldown: [2.5, 3.5], first: [1, 2], aim: 0.45, aimClip: 'Ranged_1H_Aiming', shootClip: 'Ranged_1H_Shoot',
          recover: 0.5, count: 5, spread: 0.55, speed: 22, damage: 16, scale: 2.2, turn: 5 },
      },
    },
    boss: true,
    short: 'O Rei Skullbone',
    voice: true,   // fala palavras de outro mundo e grunhe (voice.js)
    finale: true,  // morte com cena (finale.js)
    anims: SKELETON_ANIMS,
  },
  // Mago Esqueleto (andar 2+): fica longe, lança orbes lentos que seguem o herói e revive esqueletos caídos.
  mage: {
    name: 'Mago',
    model: 'enemies/Skeleton_Mage.glb',
    weapons: { right: { model: 'weapons/skeletons/Skeleton_Staff.gltf', rot: [0, 0, 0] } },
    hp: 26,
    radius: 0.6,
    speed: 3.0,
    walkAnimSpeed: 1.3,
    turnSpeed: 7,
    attackRange: 0,
    damage: 8,
    attack: { clip: 'Melee_1H_Attack_Chop', speed: 1.0, hit: 0.59, aim: 0.3, end: 0.9, reach: 2.3, arc: 110, lunge: 0.5 },
    cooldown: [2.2, 3.0],
    contact: 4,
    ranged: { max: 11, keep: 8, flee: 4.5, back: 1.2, aim: 0.7, aimClip: 'Ranged_Magic_Spellcasting', shootClip: 'Ranged_Magic_Shoot', recover: 0.5,
      speed: 8, damage: 11, kind: 'orb', homing: 1.1, color: 0x9a50ff },
    // Revive: levanta até "max" esqueletos caídos perto dele (cada esqueleto só pode ser revivido uma vez).
    revive: { cooldown: [7, 10], first: [3, 5], range: 16, max: 2, time: 1.4 },
    knockback: 1.1,
    stagger: 0.45,
    staggerOnlyHeavy: false,
    anims: SKELETON_ANIMS,
  },
  // Chefe do andar 2: o Necromante. 3 fases (ver "phases"); necro.js tem as magias dele.
  // final = quando morre, os esqueletos invocados desmoronam juntos.
  necromancer: {
    name: 'O Necromante',
    short: 'O Necromante',
    model: 'enemies/Skeleton_Mage.glb',
    weapons: { right: { model: 'weapons/skeletons/Skeleton_Staff.gltf', rot: [0, 0, 0] } },
    scale: 1.8,
    hp: 1000,
    radius: 1.1,
    speed: 3.0,
    walkAnimSpeed: 1.0,
    turnSpeed: 5,
    attackRange: 0,
    damage: 18,
    attack: { clip: 'Melee_1H_Attack_Chop', speed: 1.0, hit: 0.59, aim: 0.3, end: 0.9, reach: 3, arc: 110, lunge: 0.5 },
    cooldown: [1.6, 2.4],
    contact: 10,
    // Fase 1: orbes em leque, some e aparece longe quando o herói chega perto, invoca e revive esqueletos.
    ranged: { max: 13, flee: 0, aim: 0.6, aimClip: 'Ranged_Magic_Spellcasting', shootClip: 'Ranged_Magic_Shoot', recover: 0.5,
      speed: 10, damage: 16, kind: 'orb', homing: 0.7, count: 3, spread: 0.5, scale: 1.5, color: 0xa040ff },
    teleport: { near: 4.0, cooldown: [4, 6], first: [2, 3] },
    summon: { cooldown: [13, 16], first: [4, 5], time: 1.8, list: [['minion', 3], ['archer', 1]], cap: 6 },
    revive: { cooldown: [9, 12], first: [8, 9], range: 60, max: 5, min: 2, time: 1.8, text: 'Voltem!' },
    knockback: 0.1,
    stagger: 0.5,
    staggerOnlyHeavy: true,
    boss: true,
    final: true,
    noGrave: true,
    anims: SKELETON_ANIMS,
    phases: [
      { at: 0.66, banner: 'A chuva de ossos!', grow: 1.0, time: 1.6, stats: {
        cooldown: [1.4, 2.0],
        ranged: { max: 13, flee: 0, aim: 0.5, aimClip: 'Ranged_Magic_Spellcasting', shootClip: 'Ranged_Magic_Shoot', recover: 0.45,
          speed: 11, damage: 16, kind: 'orb', homing: 0.8, count: 5, spread: 0.9, scale: 1.5, color: 0xa040ff },
        teleport: { near: 4.5, cooldown: [3.5, 5], first: [1.5, 2] },
        summon: { cooldown: [14, 17], first: [6, 7], time: 1.8, list: [['minion', 2], ['archer', 1], ['mage', 1]], cap: 6 },
        rain: { cooldown: [6, 8], first: [1.5, 2], time: 1.8, count: 10, spread: 7, radius: 1.4, damage: 18, fall: 0.85, every: 0.09 },
        ring: { cooldown: [7, 9], first: [4, 5], time: 1.3, count: 14, speed: 9, damage: 14, waves: 1 },
      } },
      { at: 0.33, banner: 'A Fúria do Necromante!', grow: 1.4, time: 2.0, stats: {
        scale: 2.6, radius: 1.5, speed: 3.6, contact: 16,
        cooldown: [1.1, 1.6],
        ranged: { max: 13, flee: 0, aim: 0.42, aimClip: 'Ranged_Magic_Spellcasting', shootClip: 'Ranged_Magic_Shoot', recover: 0.4,
          speed: 12, damage: 18, kind: 'orb', homing: 1.1, count: 5, spread: 1.0, scale: 1.8, color: 0xff3a6a },
        teleport: { near: 5, cooldown: [3, 4.5], first: [1, 1.5] },
        summon: { cooldown: [12, 14], first: [3, 4], time: 1.8, list: [['minion', 2], ['warrior', 1], ['mage', 1]], cap: 7 },
        revive: { cooldown: [8, 10], first: [6, 7], range: 60, max: 6, min: 2, time: 1.6, text: 'Voltem!' },
        rain: { cooldown: [5, 6.5], first: [2, 2.5], time: 2.0, count: 16, spread: 8, radius: 1.5, damage: 20, fall: 0.8, every: 0.07 },
        ring: { cooldown: [5.5, 7], first: [3.5, 4], time: 1.6, count: 18, speed: 10, damage: 16, waves: 2 },
        // Explosão em volta quando o herói chega muito perto (depois ele some).
        nova: { range: 4.2, radius: 5, wind: 0.55, damage: 26, push: 14, cooldown: [4, 6], first: [0.5, 1] },
      } },
    ],
  },
  // Assassino Sombrio (andar 3): duas adagas; some numa fumaça, anda invisível e reaparece nas costas do herói
  // com um golpe duplo rápido (shadow.js). Acertar enquanto ele está invisível revela e atordoa.
  assassin: {
    name: 'Assassino Sombrio',
    model: 'enemies/Skeleton_Rogue.glb',
    tint: 0x26262e,
    weapons: { right: { model: 'weapons/extra/dagger_A.gltf', rot: [0, 0, 0] }, left: { model: 'weapons/extra/dagger_A.gltf', rot: [0, 0, 0] } },
    hp: 34,
    radius: 0.6,
    speed: 4.4,
    walkAnimSpeed: 1.8,
    turnSpeed: 10,
    attackRange: 2.0,
    damage: 9,
    attack: { clip: 'Melee_Dualwield_Attack_Slice', speed: 1.5, hit: 0.55, aim: 0.3, end: 0.85, reach: 2.3, arc: 120, lunge: 0.7 },
    cooldown: [0.8, 1.4],
    contact: 4,
    // range = distância do herói para sumir; time = quanto tempo fica invisível; alpha = quanto ainda aparece (brilho fraco).
    vanish: { range: [3, 18], cooldown: [4.5, 6.5], first: [1.2, 2.5], fade: 0.3, time: [1.3, 1.9], alpha: 0.07, speed: 8, behind: 1.7, wind: 0.32,
      attack: { clip: 'Melee_Dualwield_Attack_Chop', speed: 1.6, hit: 0.45, aim: 0.05, end: 0.8, reach: 2.5, arc: 150, lunge: 0.5, damage: 16, glow: false } },
    knockback: 1.2,
    stagger: 0.45,
    staggerOnlyHeavy: false,
    anims: SKELETON_ANIMS,
  },
  // Chefe final (andar 3): o Ceifador Sombrio. Esqueleto encapuzado gigante com alabarda (shadow.js).
  // - shade: afunda numa sombra no chão e sai dela nas costas do herói com um golpe de cima para baixo;
  // - clones: some e aparecem 3 Ceifadores em volta do herói (só um é de verdade; as cópias somem com 1 golpe);
  // - reap: cortes longos (ondas roxas que atravessam a sala) em leque; na 2ª fase em círculo.
  reaper: {
    name: 'O Ceifador Sombrio',
    short: 'O Ceifador',
    model: 'enemies/Skeleton_Rogue.glb',
    tint: 0x170f22,
    weapons: { right: { model: 'weapons/extra/halberd.gltf', rot: [0, 0, 0] } },
    scale: 2.0,
    hp: 1500,
    radius: 1.2,
    speed: 3.4,
    walkAnimSpeed: 1.1,
    turnSpeed: 4,
    attackRange: 4.4,
    damage: 24,
    attack: { clip: 'Melee_2H_Attack_Slice', speed: 0.9, hit: 0.36, aim: 0.25, end: 0.9, reach: 5.4, arc: 170, lunge: 1.2 },
    cooldown: [1.3, 2.0],
    contact: 12,
    shade: { range: [5, 40], cooldown: [6, 8], first: [3, 4], sink: 0.45, hidden: 0.55, behind: 3.4, rise: 0.3,
      attack: { clip: 'Melee_2H_Attack_Chop', speed: 1.25, hit: 0.49, aim: 0.15, end: 0.85, reach: 5.0, arc: 110, lunge: 1.0, damage: 30, glow: false } },
    clones: { cooldown: [16, 20], first: [8, 10], count: 2, dist: 7.5, life: 9, time: 1.1 },
    reap: { range: 0, cooldown: [7, 9], first: [5, 6], speed: 0.75, count: 5, spread: 1.0, shot: 15, damage: 20, scale: 2.6, slashes: 1, gap: 0.3 },
    knockback: 0.1,
    stagger: 0.5,
    staggerOnlyHeavy: true,
    boss: true,
    final: true,
    noGrave: true,
    anims: SKELETON_ANIMS,
    phases: [
      { at: 0.5, banner: 'A Colheita começou!', grow: 1.0, time: 1.8, stats: {
        scale: 2.4, radius: 1.4, speed: 4.0, cooldown: [1.0, 1.6], contact: 16,
        shade: { range: [4, 40], cooldown: [4.5, 6], first: [2, 3], sink: 0.35, hidden: 0.4, behind: 3.6, rise: 0.25,
          attack: { clip: 'Melee_2H_Attack_Chop', speed: 1.4, hit: 0.49, aim: 0.12, end: 0.85, reach: 5.6, arc: 120, lunge: 1.2, damage: 34, glow: false } },
        clones: { cooldown: [13, 16], first: [4, 5], count: 3, dist: 8, life: 10, time: 1.0 },
        reap: { range: 0, cooldown: [6, 7.5], first: [2.5, 3.5], speed: 0.8, count: 12, spread: Math.PI * 2, shot: 13, damage: 22, scale: 2.6, slashes: 2, gap: 0.35 },
      } },
    ],
  },
};
applyDifficulty(ENEMIES); // modo brutal (difficulty.js)
// Cópia falsa do Ceifador: igual por fora, some com 1 golpe e depois de "life" segundos. Machuca menos.
ENEMIES.reaperClone = {
  ...ENEMIES.reaper, name: 'Cópia Sombria', hp: 1, damage: 12, boss: false, final: false, phases: undefined,
  shade: undefined, clones: undefined, phantom: true, knockback: 0.4,
  reap: { ...ENEMIES.reaper.reap, damage: 12, cooldown: [99, 99] },
};

export function modelsForEnemy(data) {
  return [data.model, ...Object.values(data.weapons).map((w) => w.model)];
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const lerpAngle = (a, b, t) => a + wrap(b - a) * t;

export class Enemy {
  constructor(type, x, z, opts = {}) {
    const data = ENEMIES[type];
    this.type = type;
    this.data = data;
    const { group, model } = makeCharacter(data.model);
    this.group = group;
    this.model = model;
    const fl = makeFlashable(model);
    this.eyes = fl.eyes;
    this.bodyMats = fl.mats.filter((m) => !fl.eyes.includes(m));
    // Capuz e capa tingidos (Assassino e Ceifador: preto em vez do vermelho do Arqueiro).
    if (data.tint) model.traverse((o) => {
      if (!o.isMesh || !/Hood|Cape/.test(o.name)) return;
      o.material.map = null; o.material.color.setHex(data.tint); o.material.needsUpdate = true;
    });
    this.weapons = [];
    if (data.weapons.right) this.weapons.push(attachWeapon(model, 'handslot.r', data.weapons.right));
    if (data.weapons.left) this.weapons.push(attachWeapon(model, 'handslot.l', data.weapons.left));
    this.anim = new Animator(model);
    this.position = group.position;
    this.position.set(x, 0, z);
    this.facing = opts.facing ?? 0;
    this.maxHp = Math.round(data.hp * (opts.hpScale || 1));
    this.hp = this.maxHp;
    this.vel = new THREE.Vector3();
    this.flash = 0;
    this.cooldown = opts.cooldown ?? (0.6 + Math.random() * 0.8);
    this.hasToken = false;   // vaga de ataque (no máximo N inimigos atacam ao mesmo tempo)
    this.hitDone = false;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.combat = null;
    this.passive = !!opts.passive; // teste: fica parado, sem atacar
    if (opts.awake) {
      this.setState('chase');
      this.anim.play(data.anims.idle, { fade: 0 });
    } else {
      this.setState('spawn');
      this.anim.play(opts.spawnAnim || data.anims.spawn, { once: true, speed: 1.5, fade: 0 });
    }
    this.revived = !!opts.revived;   // revivido pelo Mago: não pode ser revivido de novo
    this.group.rotation.y = this.facing;
    if (data.scale) this.group.scale.setScalar(data.scale);
    this.abilities = !this.passive && opts.abilities !== false; // teste: sem habilidades especiais
    initAbilities(this);
    if (data.phases) { this.basePhases = data.phases; this.baseData = data; this.phaseIdx = 0; }
    this.slow = 0;        // tempo restante lento (gelo)
    this.burn = 0;        // tempo restante pegando fogo
    this.burnDps = 0;
    this.burnTick = 0;
  }

  get alive() { return this.state !== 'dead'; }
  // Pode ser acertado? (enquanto levanta do chão, só no fim da animação)
  // Imune: o Rei Skullbone indo para o meio da sala montar a Lâmina dos Mortos (pedido do dono).
  get immune() { return this.state === 'spinMove'; }
  // Bolha brilhante em volta enquanto está imune.
  updateImmuneFx(dt, on = this.immune) {
    if (!on && !this.bubble) return;
    if (!this.bubble) {
      this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14),
        new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      this.bubble.position.y = 1.2;
      this.bubble.scale.set(1.25, 1.35, 1.25);
      this.group.add(this.bubble);
    }
    const m = this.bubble.material, want = on ? 0.22 + 0.08 * Math.sin(performance.now() / 90) : 0;
    m.opacity += (want - m.opacity) * Math.min(1, dt * 10);
    this.bubble.visible = m.opacity > 0.01;
  }
  get targetable() { return this.alive && this.state !== 'rage' && this.state !== 'held' && this.state !== 'thrown' && this.state !== 'tpOut' && this.state !== 'tpIn' && !HIDDEN_STATES.has(this.state) && (this.state !== 'spawn' || this.anim.progress() > 0.6); }

  setState(s) {
    if (this.tele) hideTelegraphs(this);
    // Espada de esqueletos: se o giro for interrompido (ou ele morrer), ela se desmancha.
    if (this.boneSword && s !== 'spinGather' && s !== 'spin') { this.boneSword.shatter(); this.boneSword = null; }
    if (this.state === 'leap') this.position.y = 0; // interrompido no meio do salto: volta ao chão
    if (this.state === 'grab' && s !== 'grab') releaseGrab(this); // apanhou/morreu agarrando: solta o herói
    if (this.tossing && s !== 'tossGrab' && s !== 'tossThrow') dropHeld(this); // Rei interrompido: larga o esqueleto
    // Saiu da sombra/invisibilidade (inclusive acertado no meio): volta a aparecer.
    if (this.alpha !== undefined && this.alpha < 1 && !GHOST_STATES.has(s)) setGhost(this, 1);
    if (HIDDEN_STATES.has(this.state) && !HIDDEN_STATES.has(s)) this.group.position.y = 0;
    const prev = this.state;
    this.state = s; this.t = 0;
    if (this.data.voice) voiceState(this, prev, s);
  }

  // Está protegido pelo escudo contra um golpe vindo de (fromX, fromZ)?
  shieldCovers(fromX, fromZ) {
    const sh = this.data.shield;
    if (!sh || (this.state !== 'chase' && this.state !== 'block')) return false; // atacando ou usando habilidade: guarda aberta
    const ang = Math.atan2(fromX - this.position.x, fromZ - this.position.z);
    return Math.abs(wrap(ang - this.facing)) <= THREE.MathUtils.degToRad(sh.arc / 2);
  }

  // Recebe dano. (dirX, dirZ) = direção do empurrão. Devolve true se morreu.
  // noStagger: dano da Maga (magias) não empurra nem interrompe o que o esqueleto está fazendo.
  takeDamage(amount, dirX, dirZ, push, heavy, noStagger = false) {
    if (this.immune) return false;
    this.hp -= amount;
    this.flash = 1;
    if (!noStagger) this.vel.set(dirX, 0, dirZ).multiplyScalar(push * this.data.knockback);
    if (this.hp <= 0) { this.die(); return true; }
    if (this.data.voice) voiceHit(this, heavy);
    if (noStagger) return false;
    // Arqueiro: no 1º golpe que leva, rola para longe e recarrega a besta.
    const R = this.data.ranged;
    if (R && R.roll && !this.rolledOnce && this.abilities && this.state !== 'spawn') { this.rolledOnce = true; startRoll(this, dirX, dirZ); return false; }
    const armor = this.state === 'spinMove' || this.state === 'spinGather' || this.state === 'spin' || this.state === 'roll'; // chefe não para o golpe especial
    if (!armor && (heavy || !this.data.staggerOnlyHeavy)) {
      this.releaseToken();
      this.setState('hurt');
      this.stunTime = this.data.staggerOnlyHeavy ? this.data.stagger : this.data.stagger * (heavy ? 1.5 : 1);
      this.anim.play(this.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 1.2 });
    }
    return false;
  }

  // Golpe defendido pelo escudo.
  blockHit(dirX, dirZ) {
    this.vel.set(dirX, 0, dirZ).multiplyScalar(2.5);
    this.setState('block');
    this.anim.play(this.data.anims.block, { once: true, restart: true, fade: 0.05, speed: 2.2 });
  }

  // Empurrado pelo escudo do herói: fica atordoado um pouco.
  repelled(dirX, dirZ) {
    this.releaseToken();
    this.vel.set(dirX, 0, dirZ).multiplyScalar(7 * Math.max(this.data.knockback, 0.6));
    this.setState('hurt');
    this.stunTime = 0.6;
    this.anim.play(this.data.anims.hit, { once: true, restart: true, fade: 0.05 });
  }

  die() {
    this.releaseToken();
    if (this.state === 'held' || this.state === 'thrown') this.position.y = 0;
    if (this.frozenT > 0) { this.frozenT = 0; if (this.iceBlock) this.iceBlock.visible = false; setFlash(this.bodyMats, 0); }
    this.setState('dead');
    this.flash = 1;
    this.anim.play(this.data.anims.death, { once: true, restart: true, fade: 0.05, speed: 1.4 });
  }

  // Congelado (Cajado de Gelo): não anda, não ataca, a animação para; bloco de gelo em volta.
  freeze(t, combat) {
    if (!this.alive) return;
    const first = !(this.frozenT > 0);
    this.frozenT = Math.max(this.frozenT || 0, t);
    if (!this.iceBlock) {
      const sc = this.group.scale.x || 1;
      this.iceBlock = makeIceBlock(this.data.radius / sc + 0.15, 2.1);
      this.group.add(this.iceBlock);
    }
    this.iceBlock.visible = true;
    if (first && combat) {
      combat.text.add('Congelado!', this.position, 'block', 3.2);
      combat.vfx.sparks(new THREE.Vector3(this.position.x, 1.2, this.position.z), 0xbff0ff, 12);
      if (combat.log) combat.log({ type: 'frozen', enemy: this, t: this.frozenT });
    }
  }

  // A cada quadro enquanto congelado. Devolve true se ainda está congelado.
  updateFrozen(dt, ctx) {
    if (!(this.frozenT > 0)) return false;
    this.frozenT -= dt;
    const left = Math.max(0, this.frozenT);
    if (this.iceBlock) {
      this.iceBlock.userData.mat.opacity = 0.55 * Math.min(1, left / 0.4);
      this.iceBlock.userData.glow.opacity = 0.5 * Math.min(1, left / 0.4);
    }
    if (this.frozenT <= 0 || !this.alive) {
      this.frozenT = 0;
      if (this.iceBlock) this.iceBlock.visible = false;
      setFlash(this.bodyMats, 0);
      if (ctx.combat) ctx.combat.vfx.sparks(new THREE.Vector3(this.position.x, 1.0, this.position.z), 0xbff0ff, 8);
      return false;
    }
    setFlash(this.bodyMats, 0.45, 0.45, 0.8, 1);
    if (this.vel.lengthSq() > 1e-4) { this.position.addScaledVector(this.vel, dt); this.vel.multiplyScalar(Math.exp(-12 * dt)); }
    ctx.world.resolveCircle(this.position, this.data.radius);
    if (this.burn > 0) { this.burn -= dt; this.burnTick -= dt; if (this.burnTick <= 0) { this.burnTick = 0.5; ctx.combat.burnDamage(this, Math.max(1, Math.round(this.burnDps * 0.5))); } }
    return true;
  }

  releaseToken() {
    if (this.hasToken && this.combat) this.combat.attackers--;
    this.hasToken = false;
  }

  // ctx: { player, world, combat }
  update(dt, ctx) {
    const d = this.data, p = ctx.player, combat = ctx.combat;
    this.combat = combat;
    if (this.frozenT > 0 && this.state !== 'dead' && this.updateFrozen(dt, ctx)) return;
    this.t += dt;
    this.cooldown -= dt * (this.slow > 0 ? 0.5 : 1);
    if (this.slow > 0) this.slow -= dt;
    tickCooldowns(this, dt);
    if (d.voice) voiceTick(this, dt);
    if (d.phantom) shadowTick(this, dt, combat);
    // Fogo: dano por segundo (sem atordoar).
    if (this.burn > 0 && this.alive) {
      this.burn -= dt;
      this.burnTick -= dt;
      if (this.burnTick <= 0) {
        this.burnTick = 0.5;
        combat.burnDamage(this, Math.max(1, Math.round(this.burnDps * 0.5)));
      }
    }
    // Chefe com metade da vida: se enfurece (uma vez).
    if (d.rage && !this.raged && this.alive && this.state !== 'spawn' && this.hp <= this.maxHp * d.rage.at && this.abilities) {
      startRage(this, combat);
    }
    // Necromante: troca de fase com 66% e 33% da vida.
    if (this.basePhases && this.abilities && this.alive && this.state !== 'spawn' && this.state !== 'rage') checkPhase(this, combat);
    const dx = p.position.x - this.position.x, dz = p.position.z - this.position.z;
    const dist = Math.max(Math.hypot(dx, dz), 0.001);
    const toPlayer = Math.atan2(dx, dz);
    let turn = 0, target = this.facing;

    switch (this.state) {
      case 'spawn':
        if (this.anim.progress() >= 0.98) { this.setState('chase'); this.anim.play(d.anims.idle, { fade: 0.2 }); }
        break;
      case 'chase': {
        if (p.state === 'dead') { this.anim.play(d.anims.idle); break; }
        if (this.passive) { this.anim.play(d.anims.idle); break; }
        target = toPlayer; turn = d.turnSpeed;
        if (this.abilities && tryAbility(this, ctx, dist)) break;
        if (d.ranged) { archerChase(this, dt, ctx, dist, dx, dz); break; }
        const slot = combat.attackers < combat.maxAttackers;
        // Herói ocupado (atacando, bebendo, tomando dano): a recarga anda mais rápido (punição).
        if (targetBusy(p)) this.cooldown -= dt * 1.2;
        const ready = slot && this.cooldown <= 0;
        // Andar com o cérebro (brain.js): contorna obstáculos, cerca o herói e evita o escudo.
        const canHit = meleeMove(this, dt, ctx, dist, ready);
        const aimAt = leadAngle(this, p, 0.25);
        if (ready && canHit && dist <= d.attackRange && Math.abs(wrap(aimAt - this.facing)) < 0.7) {
          this.hasToken = true; combat.attackers++;
          this.startAttack();
          break;
        }
        // Perto: já vira para onde o herói vai estar.
        if (dist < d.attackRange + 2) target = aimAt;
        else if (this.moveAng != null && this.nav && !this.nav.direct) target = this.moveAng; // contornando: olha para onde anda
        break;
      }
      case 'attack': {
        const a = this.atk;
        const pr = this.anim.progress();
        if (pr < a.aim) { target = leadAngle(this, p, 0.2); turn = d.turnSpeed * 1.5; }
        // Olhos acendem em vermelho enquanto ele prepara o golpe (aviso para o jogador).
        const glow = pr < a.hit ? pr / a.hit : Math.max(0, 1 - (pr - a.hit) * 6);
        if (a.glow !== false) setFlash(this.eyes, glow * 3, 1, 0.1, 0.05);
        if (pr > a.hit - 0.12 && pr < a.hit) {
          const v = a.lunge / (0.12 * this.anim.current.getClip().duration / a.speed);
          this.position.x += Math.sin(this.facing) * v * dt;
          this.position.z += Math.cos(this.facing) * v * dt;
        }
        if (!this.hitDone && pr >= a.hit) { this.hitDone = true; combat.enemyStrike(this); }
        if (pr >= a.end) this.endAttack();
        break;
      }
      case 'hurt':
        if (this.t >= this.stunTime) { this.setState('chase'); this.anim.play(d.anims.idle, { fade: 0.15 }); }
        break;
      case 'block':
        target = toPlayer; turn = d.turnSpeed;
        if (this.t >= 0.35) { this.setState('chase'); this.anim.play(d.anims.idle, { fade: 0.15 }); }
        break;
      default: { // habilidades especiais (abilities.js); dead: a animação de morte toca sozinha
        const r = runAbility(this, dt, ctx, { dist, toPlayer });
        if (r) { target = r.target ?? target; turn = r.turn ?? 0; }
      }
    }

    if (this.state !== 'attack' && !ABILITY_STATES.has(this.state) && this.eyes.length) setFlash(this.eyes, d.boss && this.alive ? 1.4 : 0, 1, 0.1, 0.05);
    // Empurrão que vai diminuindo.
    if (this.vel.lengthSq() > 1e-4) {
      this.position.addScaledVector(this.vel, dt);
      this.vel.multiplyScalar(Math.exp(-9 * dt));
    }
    if (turn > 0) this.facing = lerpAngle(this.facing, target, 1 - Math.exp(-turn * dt));
    this.group.rotation.y = this.facing;
    ctx.world.resolveCircle(this.position, d.radius);
    // Flash branco ao levar golpe.
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 7);
      setFlash(this.bodyMats, this.flash * 1.6);
    }
    this.anim.update(dt);
    if (this.state === 'cast') raiseRightArm(this);
    if (d.boss) this.updateImmuneFx(dt);
  }

  startAttack(a = this.data.attack) {
    this.atk = a;
    this.setState('attack');
    this.hitDone = false;
    this.anim.play(a.clip, { once: true, speed: a.speed, restart: true, fade: 0.1 });
  }

  endAttack() {
    this.releaseToken();
    const [c0, c1] = this.data.cooldown;
    this.cooldown = c0 + Math.random() * (c1 - c0);
    this.setState('chase');
    this.anim.play(this.data.anims.idle, { fade: 0.2 });
  }
}
