// Taverna: a sala entre uma descida e outra. O taverneiro, os heróis que ainda vão chegar (sentados à mesa)
// e o suporte de armas: cada arma nova custa Ouro de Alma (cada jogador com o seu); as compradas trocam na hora.
import * as THREE from 'three';
import { makeCharacter } from './characters.js';
import { Animator } from './animation.js';
import { Pickup } from './rewards.js';
import { WEAPONS, HEROES, HERO_PRICE, heroWith } from './heroes.js';
import { instance } from './assets.js';

export const TAVERN_MODELS = ['heroes/Rogue_Hooded.glb', 'heroes/Barbarian.glb', 'heroes/Mage.glb', 'heroes/Ranger.glb', 'heroes/Rogue.glb',
  'dungeon/table_small.gltf'];

// Heróis que chegam no próximo marco: sentados nas cadeiras da mesa da frente.
// hero = herói que já existe no jogo: a cadeira vira o lugar de desbloquear/escolher.
const GUESTS = [
  { model: 'heroes/Barbarian.glb', name: 'Bárbaro', x: -10, z: 2.6, rot: 0 },
  { model: 'heroes/Mage.glb', name: 'Maga', x: -8, z: 2.6, rot: 0, hero: 'mage' },
  { model: 'heroes/Ranger.glb', name: 'Patrulheira', x: -11.8, z: 4.4, rot: Math.PI / 2 },
  { model: 'heroes/Rogue.glb', name: 'Ladino', x: -6.2, z: 4.4, rot: -Math.PI / 2, hero: 'rogue' },
];
// Suporte de armas (lado direito da taverna): uma mesinha por arma do herói, na ordem de WEAPONS.
const SPOTS = [[7.5, -6.5], [12, -6.5], [7.5, -1.5], [12, -1.5], [9.75, 3.5]];
export const KEEPER_POS = [-9, -8.6];
export const weaponIcon = (w) => `<i style="color:#${w.color.toString(16).padStart(6, '0')}">${w.icon}</i>`;

export class Tavern {
  // g: { scene, ui }
  constructor(g) {
    Object.assign(this, g);
    this.npcs = [];
    this.labels = [];
    this.tables = [];
  }

  // Personagens e mesinhas (também usado pelo Jogador 2, que só desenha).
  // heroId = herói de quem está vendo (o suporte mostra as armas dele; na cadeira dele senta o Cavaleiro).
  // owns(h) = já desbloqueou o herói h?
  buildDecor(world, heroId = 'knight', owns = () => false) {
    this.clear();
    const keeper = this.npc('heroes/Rogue_Hooded.glb', KEEPER_POS[0], KEEPER_POS[1], 0, 'Idle_B');
    this.keeper = keeper;
    this.seats = {};
    for (const g of GUESTS) {
      // Cadeira do herói que o jogador está usando: o Cavaleiro senta no lugar dele.
      const swap = g.hero && g.hero === heroId;
      const seatHero = swap ? 'knight' : g.hero;
      const n = this.npc(swap ? HEROES.knight.model : g.model, g.x, g.z, g.rot, 'Sit_Chair_Idle');
      n.anim.mixer.update(Math.random() * 3);
      if (g.hero) this.seats[g.hero] = n;
      const name = seatHero ? HEROES[seatHero].name : g.name;
      const sub = !seatHero ? '<small class="soon">em breve</small>'
        : owns(seatHero) ? '<small class="soon">E: jogar com este herói</small>'
          : `<small class="soon"><span class="soulp">${HERO_PRICE}</span> para desbloquear</small>`;
      this.labels.push(this.ui.addLabel(`<span>${name}</span>${sub}`, new THREE.Vector3(g.x, 3.3, g.z), 'npc'));
    }
    this.labels.push(this.ui.addLabel('<span>Taverneiro</span>', new THREE.Vector3(KEEPER_POS[0], 3.4, KEEPER_POS[1]), 'npc'));
    WEAPONS[heroId].forEach((w, i) => {
      const [x, z] = SPOTS[i];
      const t = instance('dungeon/table_small.gltf');
      t.position.set(x, 0, z);
      this.scene.add(t);
      this.tables.push(t);
      if (world) world.addRect(x - 0.5, z - 0.5, x + 0.5, z + 0.5);
      this.labels.push(this.ui.addLabel(`<span>${weaponIcon(w)} ${w.short}</span>`, new THREE.Vector3(x, 3.3, z), 'npc'));
    });
    // Luzes do fogo da cena de desbloqueio (apagadas; já ficam na sala para não travar quando acendem).
    this.fireLights = [[-6, -3], [6, 3]].map(([x, z]) => {
      const l = new THREE.PointLight(0xff7a2a, 0, 22, 1.4);
      l.position.set(x, 3, z);
      this.scene.add(l);
      return l;
    });
  }

  // Anfitrião/sozinho: decoração + as armas (Pickups 'shop' com item 'weapon') + cadeiras dos heróis (item 'hero').
  build(addPickup, world, heroId = 'knight', owns = () => false) {
    this.buildDecor(world, heroId, owns);
    const items = WEAPONS[heroId].map((w, i) => {
      const [x, z] = SPOTS[i];
      return addPickup(new Pickup('shop', new THREE.Vector3(x, 0, z), {
        item: 'weapon', slot: i, weapon: w, arms: heroWith(heroId, w.id).weapons, color: w.color, radius: 1.75, prompt: '' }));
    });
    for (const g of GUESTS) {
      if (!g.hero) continue;
      items.push(addPickup(new Pickup('shop', new THREE.Vector3(g.x, 0, g.z), { item: 'hero', heroId: g.hero, radius: 1.9, prompt: '' })));
    }
    return items;
  }

  npc(model, x, z, rot, clip) {
    const { group, model: m } = makeCharacter(model);
    group.position.set(x, 0, z);
    group.rotation.y = rot;
    const anim = new Animator(m);
    anim.play(clip);
    this.scene.add(group);
    const n = { group, anim, waved: false };
    this.npcs.push(n);
    return n;
  }

  clear() {
    for (const l of this.fireLights || []) this.scene.remove(l);
    this.fireLights = [];
    this.seats = {};
    for (const n of this.npcs) this.scene.remove(n.group);
    for (const t of this.tables) this.scene.remove(t);
    for (const l of this.labels) l.el.remove();
    this.npcs.length = 0; this.tables.length = 0; this.labels.length = 0;
    this.keeper = null;
  }

  // O taverneiro acena quando alguém chega perto e comemora quando alguém compra.
  update(dt, players) {
    for (const n of this.npcs) n.anim.update(dt);
    const k = this.keeper;
    if (!k) return;
    const d = Math.min(...players.map((p) => Math.hypot(p.position.x - k.group.position.x, p.position.z - k.group.position.z)));
    if (!k.waved && d < 8) {
      k.waved = true;
      k.anim.play('Waving', { once: true, restart: true, onFinish: () => k.anim.play('Idle_B') });
    }
  }

  cheer() {
    const k = this.keeper;
    if (k) k.anim.play('Cheering', { once: true, restart: true, onFinish: () => k.anim.play('Idle_B') });
  }
}
