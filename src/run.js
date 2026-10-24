// A partida (uma descida): monta cada sala, tranca as portas, roda as ondas, dá a recompensa
// e leva os heróis para a sala escolhida. Também cuida do mercador, do baú e da cama de descanso.
// Co-op: cada jogador tem as próprias bênçãos, poções e ouro; as recompensas saem em dobro (uma para cada,
// com um anel da cor do dono no chão). A sala de descanso traz o parceiro caído de volta.
import * as THREE from 'three';
import { audio } from './audio.js';
import { ROOMS } from './dungeon/rooms.js';
import { buildRoom } from './dungeon/builder.js';
import { generateFloor, NODE_INFO, FLOORS } from './dungeon/generator.js';
import { repairShield } from './shield.js';
import { updateSpikes } from './traps.js';
import { rollBlessings, RARITY, BLESSINGS } from './blessings.js';
import { Pickup, iconFor } from './rewards.js';
import { Merchant } from './merchant.js';
import { Tavern } from './tavern.js';
import { save } from './save.js';
import { WEAPON_PRICE, ownsWeapon, equippedWeapon, ownKey, eqKey, WEAPONS, HEROES, HERO_IDS, HERO_PRICE, HERO_SEL, heroKey, ownsHero, selectedHero } from './heroes.js';
import { UnlockScene } from './unlock.js';

const PRICES = { potion: 35 };
const GOLD_REWARD = [25, 40];
const FADE = 0.35;
export const PLAYER_COLORS = { 1: 0xffa040, 2: 0x4aa0ff };

// Ícones e nomes em cima das portas. infos[i] = { key, text, sp } (ou null). Usado também pelo Jogador 2.
export function decorateDoors(scene, ui, built, infos) {
  const icons = [];
  built.doors.forEach((d, i) => {
    const info = infos[i];
    if (!info) return;
    const icon = iconFor(info.key);
    icon.position.set(d.x, 5.2, d.z + 1.2);
    scene.add(icon);
    icons.push(icon);
    d.label = ui.addLabel(`<span${info.sp ? ' class="sp"' : ''}>${info.text}</span>`, new THREE.Vector3(d.x, 6.6, d.z + 1.2), 'door');
  });
  return icons;
}

// Uma linha sobre cada herói (aviso da cadeira na Taverna).
function heroDesc(h) {
  return h === 'mage' ? 'Ataca de longe com magia; barreira mágica para bloquear. Menos vida (80).'
    : 'Corpo a corpo com escudo. 100 de vida.';
}

export class Run {
  constructor(g) {
    // g: { scene, player, combat, waves, world, vfx, debris, hud, ui, cam }
    Object.assign(this, g);
    this.built = null;
    this.pickups = [];
    this.icons = [];
    this.npc = null;
    this.waves.onClear = () => this.roomCleared();
    this.transition = null;   // { t, node } enquanto troca de sala
    this.roomVersion = 0;     // co-op: muda a cada sala nova
    this.doorInfos = [];
    this.pendingChoice = null; // co-op: bênção que o Jogador 2 está escolhendo
    this.choiceSeq = 0;
    this.pickupSeq = 0;
    this.tavern = new Tavern({ scene: this.scene, ui: this.ui });
    this.unlock = new UnlockScene({ scene: this.scene, vfx: this.vfx, tavern: this.tavern, players: this.players, cam: this.cam });
    this.inTavern = false;
  }

  get players() { return this.combat.players; }
  get coop() { return this.players.length > 1; }
  // Ouro do Jogador 1 (cada jogador tem o seu).
  get gold() { return this.player.gold; }
  set gold(v) { this.player.gold = v; }

  // Progresso permanente de cada jogador (Jogador 2 do co-op: cópia que chegou do computador dele).
  saveOf(pl) { return pl === this.player ? save.data : pl.saveData || null; }

  // Começo de tudo (e depois de cada morte/vitória): a Taverna. Heróis zerados; a descida começa pela porta.
  start() {
    this.floorNum = 0;
    this.victoryTimer = 0;
    this.inTavern = true;
    this.floor = { steps: [[{ kind: 'descend', label: 'Descer à Cripta' }]] };
    this.step = 0;
    this.history = [];
    this.pendingChoice = null;
    this.banked = false;
    for (const p of this.players) { this.equipSaved(p); p.reset(0, 0); }
    this.enter({ kind: 'tavern', room: 'taverna' }, true);
  }

  // Herói e arma escolhidos no progresso salvo do jogador (testes: Cavaleiro com a espada).
  equipSaved(p, initial = false) {
    const sv = this.saveOf(p);
    if (initial || !sv) { p.setHero('knight', WEAPONS.knight[0].id); return; }
    const hero = selectedHero(sv.ups);
    p.setHero(hero, equippedWeapon(sv.ups, hero));
  }

  // Taverna: monta de novo os heróis da mesa e o suporte de armas (depois de trocar de herói).
  rebuildTavern() {
    for (const p of [...this.pickups]) if (p.opts.item === 'weapon' || p.opts.item === 'hero') this.removePickup(p);
    this.tavern.build((p) => this.addPickup(p), null, this.player.heroId, (h) => ownsHero(save.data.ups, h));
    this.tavernVersion = (this.tavernVersion || 0) + 1; // co-op: o Jogador 2 remonta a decoração da Taverna
  }

  // Herói que a cadeira oferece a este jogador (na cadeira do herói dele, senta o Cavaleiro).
  seatHero(p, pl) { return p.opts.heroId === pl.heroId ? 'knight' : p.opts.heroId; }

  // Porta da Taverna: começa uma descida nova com a arma escolhida.
  beginDescent(opts = {}) {
    this.inTavern = false;
    this.floorNum = 1;
    this.victoryTimer = 0;
    this.floor = generateFloor(1);
    this.step = 0;            // quantas salas já passou
    this.history = [];        // tipos das salas visitadas (minimapa)
    this.startTime = performance.now();
    this.pendingChoice = null;
    this.banked = false;
    this.combat.kills = 0;
    this.waves.cleared = 0;
    for (const p of this.players) { this.equipSaved(p, opts.noUpgrades); p.reset(0, 0); }
    this.hud.setBlessings({}, BLESSINGS, RARITY);
    this.enter(this.floor.first, true);
    this.hud.banner(`Andar 1 — ${FLOORS[1].name}`, 'big');
  }

  // Fim da descida (morte ou vitória): o ouro que sobrou vira Ouro de Alma. Uma vez só. Devolve o texto da tela.
  bankSoul(won) {
    if (this.banked || this.inTavern) return this.bankText || '';
    this.banked = true;
    const lines = [];
    for (const p of this.players) {
      const gain = Math.max(0, Math.floor(p.gold));
      const upd = (s) => { s.soul += gain; s.soulTotal = (s.soulTotal || 0) + gain; s.runs = (s.runs || 0) + 1; s.best = Math.max(s.best || 0, this.floorNum); if (won) s.wins = (s.wins || 0) + 1; };
      if (p === this.player) save.update(upd);
      else if (p.saveData) { upd(p.saveData); p.saveData.rev = (p.saveData.rev || 0) + 1; }
      const total = this.saveOf(p)?.soul ?? gain;
      const who = this.coop ? `Jogador ${p.id}: ` : '';
      lines.push(`${who}<span class="soulline">+${gain} Ouro de Alma</span> &nbsp;(total: <b>${total}</b>)`);
    }
    this.bankText = `<br>${lines.join('<br>')}<br><small>O ouro que sobrou virou Ouro de Alma. Gaste na Taverna.</small>`;
    return this.bankText;
  }

  get nextOptions() { return this.floor.steps[this.step] || []; }

  // ---------- Montar uma sala ----------
  enter(node, instant = false) {
    this.clearRoom();
    this.node = node;
    this.doorsOpen = false;
    this.timers = [];
    this.roomVersion++;
    if (node.kind !== 'tavern') this.history.push(node.kind === 'combat' ? node.reward : node.kind);
    // Fôlego: cura um pouco ao entrar numa sala nova.
    for (const p of this.players) {
      const rh = p.stats.roomHeal;
      if (rh > 0 && this.history.length > 1 && p.state !== 'dead') {
        const healed = p.heal(rh);
        if (healed) this.combat.text.add(`+${healed}`, p.position, 'heal');
      }
    }
    const room = ROOMS[node.room];
    const options = this.nextOptions;
    const slots = this.chooseSlots(room, options.length);
    this.slots = slots;
    const built = buildRoom(room, { doors: slots });
    this.built = built;
    this.scene.add(built.group);
    this.world.clear();
    built.colliders.forEach((r) => this.world.addRect(...r));
    this.world.setBounds(built.halfW, built.halfD, built.wallHalf ?? 0.5);
    // Portas: cada uma leva a uma opção do próximo passo, com ícone em cima.
    this.doorInfos = built.doors.map((d, i) => {
      d.node = options[i];
      if (!d.node) return null;
      const key = d.node.kind === 'combat' ? d.node.reward : d.node.kind === 'descend' ? 'exit' : d.node.kind;
      const text = d.node.kind === 'exit' && this.floorNum < 3 ? `Descer ao Andar ${this.floorNum + 1}` : d.node.label || NODE_INFO[key].label;
      return { key, text, sp: d.node.kind !== 'combat' };
    });
    this.icons = decorateDoors(this.scene, this.ui, built, this.doorInfos);
    // Heróis na entrada (co-op: lado a lado). Quem está caído fica invisível até a sala de descanso.
    this.players.forEach((p, i) => {
      const off = this.coop ? (i === 0 ? -1.1 : 1.1) : 0;
      p.placeAt(built.entrance.x + off, built.entrance.z, Math.PI);
      if (p.state === 'dead') p.group.visible = false;
    });
    if (node.kind === 'rest') this.reviveFallen();
    const lead = this.players.find((p) => p.state !== 'dead') || this.player;
    this.cam.target.copy(lead.position);
    if (instant) this.cam.follow(lead.position, 1);
    if (node.kind === 'tavern') this.hud.setMinimap([], 0, 0, 0);
    else this.hud.setMinimap(this.history, this.floor.steps.length + 1, this.step, this.floorNum);
    this.hud.banner(room.name, 'small');
    this.hud.hideBoss();
    built.setDoorsOpen(false);
    // Toda sala tem combate primeiro, menos o Descanso. O mercador fica na sala durante a luta.
    const F = FLOORS[this.floorNum] || FLOORS[1];
    if (node.waves) this.waves.start(node.waves, {
      bounds: built, delay: node.kind === 'boss' ? 2.0 : 1.3,
      hpScale: node.kind === 'boss' ? 1 : (node.kind === 'elite' ? 1.15 : 1 + (node.level || 0) * 0.04) * F.hp,
      dmgScale: F.dmg,
      mult: this.coop ? 2 : 1, bossMul: this.coop ? 2 : 1, // co-op: dobro de esqueletos e chefe com dobro de vida
    });
    this.combat.hazards.bounds = built; // magias do Necromante usam o tamanho da sala
    if (node.kind === 'boss') this.hud.banner(node.intro || 'O chefe desperta…', 'big');
    if (node.kind === 'merchant') this.addMerchant();
    if (node.kind === 'rest') this.addBed();
    if (node.kind === 'tavern') this.tavern.build((p) => this.addPickup(p), this.world, this.player.heroId, (h) => ownsHero(save.data.ups, h));
    if (!this.waves.active) this.openDoors(false); // salas sem combate: pode sair quando quiser
  }

  // Co-op: o parceiro caído levanta com a vida cheia.
  reviveFallen() {
    for (const p of this.players) {
      if (p.state !== 'dead') continue;
      p.revive();
      this.vfx.burst(p.position, 0x8ad8ff);
      this.combat.text.add('De volta!', p.position, 'heal', 3.2);
      this.hud.banner(`Jogador ${p.id} voltou!`, 'small');
    }
  }

  // Quais segmentos da parede viram portas: com 1 opção, a porta do meio; com 2, as do template.
  chooseSlots(room, n) {
    if (n === 0) return [];
    if (n >= room.doors.length) return room.doors.slice(0, n);
    const mid = (room.width - 2) / 2;
    return [...room.doors].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid)).slice(0, n);
  }

  clearRoom() {
    this.unlock.abort();
    if (this.built) this.scene.remove(this.built.group);
    this.built = null;
    this.waves.stop();
    this.combat.clear();
    this.debris.clear();
    this.vfx.clear();
    this.ui.clearLabels();
    this.ui.setPrompt(null);
    this.remotePrompt = null;
    for (const p of this.pickups) this.scene.remove(p.group);
    this.pickups.length = 0;
    for (const i of this.icons) this.scene.remove(i);
    this.icons.length = 0;
    if (this.npc) { this.scene.remove(this.npc.group); this.npc = null; }
    this.tavern.clear();
  }

  // ---------- Sala limpa e recompensas ----------
  // Lugar de cada jogador ao lado do ponto de recompensa (co-op: um à esquerda, outro à direita).
  spot(base, p, dx = 1.3) {
    if (!this.coop) return base.clone();
    return base.clone().add(new THREE.Vector3(p.id === 1 ? -dx : dx, 0, 0));
  }

  // Recompensa de um jogador (co-op: só o dono pega; anel da cor dele no chão).
  ownPickup(kind, pos, opts, p) {
    if (this.coop) Object.assign(opts, { owner: p, ringColor: PLAYER_COLORS[p.id] });
    return this.addPickup(new Pickup(kind, pos, opts));
  }

  roomCleared() {
    const n = this.node, at = this.built.reward;
    if (n.kind === 'boss' && this.floorNum >= 3) { this.victory(); return; } // o Ceifador: fim da partida
    this.hud.banner('Sala limpa!', 'big');
    audio.play('clear', null, null);
    this.hud.hideBoss();
    for (const p of this.players) {
      const side = this.spot(at.clone().add(new THREE.Vector3(3, 0, 0)), p, 0).add(new THREE.Vector3(0, 0, this.coop ? (p.id === 1 ? -1 : 1) : 0));
      // Toda sala limpa dá uma bênção (o Guardião dá uma rara ou melhor)...
      const bigBoss = n.kind === 'elite' || n.kind === 'boss'; // Rei Skullbone / Necromante
      if (bigBoss) this.ownPickup('blessing', this.spot(at, p), { minRarity: n.kind === 'boss' ? 'epic' : 'rare', color: 0xffc24a, size: 1.2 }, p);
      else this.ownPickup('blessing', this.spot(n.kind === 'treasure' ? at.clone().add(new THREE.Vector3(-3.5, 0, 1)) : at, p), {}, p);
      // ... mais o prêmio da porta.
      if (bigBoss) this.ownPickup('gold', side, { amount: 60 + (this.floorNum - 1) * 20 }, p);
      else if (n.reward === 'gold') this.ownPickup('gold', side, { amount: GOLD_REWARD[0] + Math.floor(Math.random() * (GOLD_REWARD[1] - GOLD_REWARD[0] + 1)) }, p);
      else if (n.reward === 'potion') this.ownPickup('potion', side, { amount: 1 }, p);
      else if (n.kind === 'treasure') this.addChest(p);
    }
    if (n.kind === 'merchant') this.openShop();
    this.vfx.burst(at, 0xffd36a);
    this.checkDoors();
  }

  addPickup(p) { p.id = ++this.pickupSeq; this.pickups.push(p); this.scene.add(p.group); return p; }

  // As portas abrem quando não sobrou recompensa automática para pegar (de quem está vivo).
  checkDoors() {
    if (this.waves.active || this.doorsOpen) return;
    if (this.pickups.some((p) => p.auto && !p.taken && !(p.opts.owner && p.opts.owner.state === 'dead'))) return;
    if (this.pendingChoice || this.players.some((p) => p.choosing)) return;
    this.openDoors(true);
  }

  openDoors(announce) {
    this.doorsOpen = true;
    if (announce) audio.play('door', null, null);
    this.built.setDoorsOpen(true);
    if (announce) this.hud.banner(this.nextOptions.length > 1 ? 'Escolha uma porta' : 'A porta se abriu', 'small');
  }

  addChest(p) {
    const r = this.spot(this.built.reward, p, 1.6);
    const c = this.ownPickup('chest', r, { prompt: 'Abrir o baú', radius: 2.3 }, p);
    this.world.addRect(r.x - 0.8, r.z - 0.65, r.x + 0.8, r.z + 0.65);
    c.rect = this.world.rects[this.world.rects.length - 1];
    this.chestRect = c.rect;
  }

  addBed() {
    const bed = ROOMS.descanso.props.find((p) => p[0] === 'bed_floor');
    this.addPickup(new Pickup('bed', new THREE.Vector3(bed[1], 0, bed[2]), { prompt: 'Descansar (vida cheia e escudo novo)', radius: 2.4 }));
  }

  // O mercador fica na sala desde o começo (pode apanhar durante o combate e revidar).
  addMerchant() {
    this.npc = new Merchant(this.scene, this.combat, 0, -6.2);
    this.npc.onDeath = () => {
      // Morto: os itens somem e não dá mais para comprar.
      for (const p of [...this.pickups]) if (p.kind === 'shop') { if (p.label) p.label.el.remove(); this.removePickup(p); }
      this.hud.banner('O mercador morreu: sem trocas', 'small');
    };
  }

  // Depois do combate: três itens nas mesinhas (poção + duas bênçãos), se o mercador estiver vivo.
  // Co-op: cada jogador pode comprar cada item uma vez (com o próprio ouro).
  openShop() {
    if (!this.npc || !this.npc.alive) { this.hud.banner('O mercador está morto: sem trocas', 'small'); return; }
    const offers = rollBlessings(this.player.blessings, 2, 'common', Math.random, this.player.hero.noShield);
    const tables = ROOMS.mercador.props.filter((p) => p[0] === 'table_small');
    const items = [{ item: 'potion' }, ...offers.map((b) => ({ item: 'blessing', blessing: b }))];
    items.forEach((it, i) => {
      const t = tables[i];
      const pos = new THREE.Vector3(t[1], 0, t[2]);
      const price = it.item === 'potion' ? PRICES.potion : RARITY[it.blessing.rarity].price;
      const color = it.blessing ? new THREE.Color(RARITY[it.blessing.rarity].color).getHex() : 0xe2384b;
      const p = this.addPickup(new Pickup('shop', pos, { ...it, price, color, radius: 1.7, prompt: '' }));
      p.boughtBy = new Set();
      p.label = this.ui.addLabel(`<span class="price">${price}</span>`, pos.clone().setY(2.6), 'tag');
    });
  }

  // Texto do aviso "E — ..." para um jogador (o item do mercador mostra o nível dele).
  promptFor(p, pl) {
    if (p.kind !== 'shop') return p.prompt;
    const it = p.opts, owned = pl.blessings;
    if (it.item === 'hero') {
      const h = this.seatHero(p, pl), sv = this.saveOf(pl), name = HEROES[h].name;
      if (!sv) return `${name}<br><small>Carregando o progresso do jogador…</small>`;
      if (ownsHero(sv.ups, h)) return `Jogar com ${h === 'mage' ? 'a' : 'o'} ${name}<br><small>${heroDesc(h)}</small>`;
      return `Desbloquear ${h === 'mage' ? 'a' : 'o'} ${name} · <span class="soulp">${HERO_PRICE}</span><br><small>${heroDesc(h)}</small>`;
    }
    if (it.item === 'weapon') {
      const w = WEAPONS[pl.heroId][it.slot] || it.weapon, sv = this.saveOf(pl);
      if (!sv) return `${w.name}<br><small>Carregando o progresso do jogador…</small>`;
      const name = `<i style="color:#${w.color.toString(16).padStart(6, '0')}">${w.name}</i>`;
      if (pl.weaponId === w.id) return `${name} <small class="lvl">equipada</small><br><small>${w.desc}</small>`;
      if (ownsWeapon(sv.ups, pl.heroId, w.id)) return `Equipar ${name}<br><small>${w.desc}</small>`;
      return `Comprar ${name} · <span class="soulp">${WEAPON_PRICE}</span><br><small>${w.desc}</small>`;
    }
    if (it.item === 'potion') return `Comprar Poção · ${it.price} ouro`;
    const b = it.blessing;
    return `Comprar <i style="color:${RARITY[b.rarity].color}">${b.name}</i> · ${it.price} ouro<br><small>${b.desc((owned[b.id] || 0) + 1)}</small>`;
  }

  // ---------- Pegar / usar ----------
  take(p, pl = this.player) {
    switch (p.kind) {
      case 'blessing':
        p.taken = true;
        this.removePickup(p);
        this.offerBlessings(p.opts.minRarity || 'common', p.pos, () => this.checkDoors(), undefined, pl);
        return;
      case 'gold':
        p.taken = true;
        this.addGold(p.opts.amount ?? 30, p.pos, pl);
        this.removePickup(p);
        break;
      case 'potion':
        p.taken = true;
        pl.potions += p.opts.amount || 1;
        audio.play('potion', p.pos.x, p.pos.z);
        this.combat.text.add(`+${p.opts.amount || 1} ${(p.opts.amount || 1) > 1 ? 'poções' : 'poção'}`, p.pos, 'heal');
        this.vfx.burst(p.pos, 0xe2384b);
        this.removePickup(p);
        break;
      case 'chest':
        p.taken = true;
        p.shake = 0.6;
        audio.play('chest', p.pos.x, p.pos.z);
        pl.emote('Interact', { speed: 1.4, face: Math.atan2(p.pos.x - pl.position.x, p.pos.z - pl.position.z) });
        this.delay(0.6, () => {
          this.vfx.burst(p.pos, 0xffd36a);
          this.combat.shakeFor(pl, 0.25);
          this.addGold(40, p.pos, pl);
          this.removePickup(p);
          const i = this.world.rects.indexOf(p.rect || this.chestRect);
          if (i >= 0) this.world.rects.splice(i, 1);
          this.offerBlessings('rare', p.pos, null, 'Tesouro! Escolha uma bênção', pl);
        });
        break;
      case 'bed': {
        (p.usedBy ||= new Set()).add(pl);
        if (p.usedBy.size >= this.players.length) p.taken = true;
        const healed = pl.heal(pl.maxHp);
        const fixed = repairShield(pl); // a cama também conserta o escudo
        audio.play('heal', pl.position.x, pl.position.z);
        this.combat.text.add(healed ? `+${healed}` : 'Descansado', pl.position, 'heal');
        if (fixed) this.combat.text.add('Escudo consertado!', pl.position, 'block', 3.4);
        this.vfx.burst(pl.position, 0x7dff8a);
        break;
      }
      case 'shop':
        if (p.opts.item === 'weapon') { this.buyWeapon(p, pl); return; }
        if (p.opts.item === 'hero') { this.heroSeat(p, pl); return; }
        if (pl.gold < p.opts.price) {
          this.combat.text.add('Ouro insuficiente', p.pos, 'miss', 2.8);
          if (pl.ux) pl.ux.goldWarn(); else this.hud.goldWarn();
          return;
        }
        pl.gold -= p.opts.price;
        audio.play('gold', p.pos.x, p.pos.z);
        if (pl === this.player) this.hud.setGold(pl.gold);
        if (p.opts.item === 'potion') { pl.potions++; this.combat.text.add('+1 poção', pl.position, 'heal'); }
        else this.grantBlessing(p.opts.blessing, pl);
        this.vfx.burst(p.pos, p.opts.color);
        p.boughtBy.add(pl);
        // Some quando todos (vivos) já compraram.
        if (this.players.every((o) => p.boughtBy.has(o) || o.state === 'dead')) {
          p.taken = true;
          if (p.label) p.label.el.remove();
          this.removePickup(p);
        }
        if (this.npc && this.npc.state === 'idle') this.npc.anim.play('Cheering', { once: true, restart: true, onFinish: () => this.npc && this.npc.state === 'idle' && this.npc.anim.play('Idle_B') });
        break;
      default: break;
    }
    if (p.auto) this.checkDoors();
  }

  // Taverna: compra a arma com o Ouro de Alma do jogador (ou só equipa, se já tiver). Fica equipada nas próximas descidas.
  buyWeapon(p, pl) {
    const w = WEAPONS[pl.heroId][p.opts.slot] || p.opts.weapon, sv = this.saveOf(pl);
    if (!sv || pl.weaponId === w.id) return;
    const owned = ownsWeapon(sv.ups, pl.heroId, w.id);
    if (!owned && sv.soul < WEAPON_PRICE) {
      this.combat.text.add('Ouro de Alma insuficiente', p.pos, 'miss', 2.8);
      if (pl.ux) pl.ux.goldWarn(); else this.hud.goldWarn();
      return;
    }
    const idx = WEAPONS[pl.heroId].findIndex((x) => x.id === w.id);
    const change = (s) => {
      if (!owned) { s.soul -= WEAPON_PRICE; s.ups = { ...s.ups, [ownKey(pl.heroId, w.id)]: 1 }; }
      s.ups = { ...s.ups, [eqKey(pl.heroId)]: idx };
    };
    if (pl === this.player) save.update(change); else { change(sv); sv.rev = (sv.rev || 0) + 1; }
    pl.setWeapon(w.id);
    audio.play(owned ? 'shieldBlock' : 'blessing', p.pos.x, p.pos.z);
    this.combat.text.add(owned ? 'Equipada!' : 'Comprada!', p.pos, 'gold', 3.2);
    this.vfx.burst(pl.position, w.color);
    if (!owned) this.tavern.cheer();
  }

  // Cadeira de herói: desbloqueia (Ouro de Alma + cena) ou troca para ele.
  heroSeat(p, pl, opts = {}) {
    const h = this.seatHero(p, pl), sv = this.saveOf(pl);
    if (!sv || this.unlock.active) return;
    const owned = ownsHero(sv.ups, h);
    if (!owned && sv.soul < HERO_PRICE) {
      this.combat.text.add('Ouro de Alma insuficiente', p.pos, 'miss', 2.8);
      if (pl.ux) pl.ux.goldWarn(); else this.hud.goldWarn();
      return;
    }
    if (owned) { this.switchHero(pl, h); return; }
    const change = (s) => { s.soul -= HERO_PRICE; s.ups = { ...s.ups, [heroKey(h)]: 1 }; };
    if (pl === this.player) save.update(change); else { change(sv); sv.rev = (sv.rev || 0) + 1; }
    this.ui.setPrompt(null);
    if (this.onUnlock) this.onUnlock(h, pl); // co-op: o Jogador 2 vê a mesma cena
    this.unlock.play(h, pl, (at) => {
      pl.position.set(at.x, 0, at.z);
      this.switchHero(pl, h, true);
    }, { fast: opts.fast || this.fastUnlock });
  }

  // Troca o herói do jogador (salva a escolha) e remonta a Taverna.
  switchHero(pl, h, quiet = false) {
    const sv = this.saveOf(pl);
    const idx = HERO_IDS.indexOf(h);
    const change = (s) => { s.ups = { ...s.ups, [HERO_SEL]: idx }; };
    if (pl === this.player) save.update(change); else if (sv) { change(sv); sv.rev = (sv.rev || 0) + 1; }
    pl.setHero(h, equippedWeapon(sv && sv.ups, h));
    pl.reset(pl.position.x, pl.position.z);
    this.vfx.burst(pl.position, h === 'mage' ? 0xb070ff : 0xffd36a);
    audio.play('blessing', pl.position.x, pl.position.z);
    if (!quiet) this.combat.text.add(HEROES[h].name, pl.position, 'gold', 3.2);
    if (pl === this.player) this.rebuildTavern();
    else this.tavernVersion = (this.tavernVersion || 0) + 1;
  }

  removePickup(p) {
    this.scene.remove(p.group);
    const i = this.pickups.indexOf(p);
    if (i >= 0) this.pickups.splice(i, 1);
  }

  // Ouro ganho (Ganância multiplica). Gastar no mercador não passa por aqui.
  addGold(n, pos, pl = this.player) {
    n = Math.round(n * pl.stats.goldMul);
    pl.gold += n;
    if (pl === this.player) this.hud.setGold(pl.gold);
    this.combat.text.add(`+${n} ouro`, pos, 'gold');
    audio.play('gold', pos.x, pos.z);
    this.vfx.sparks(new THREE.Vector3(pos.x, 1, pos.z), 0xffc24a, 12);
  }

  // Escolha de bênção. Jogador 1: menu nesta tela. Jogador 2 (co-op): o menu abre no computador dele.
  offerBlessings(minRarity, pos, after, title, pl = this.player) {
    const options = rollBlessings(pl.blessings, 3, minRarity, Math.random, pl.hero.noShield);
    if (!options.length) { if (after) after(); return; }
    pl.choosing = true;
    if (pl.remote) {
      this.pendingChoice = { id: ++this.choiceSeq, options, title: title || 'Escolha uma bênção', pl, after };
      return;
    }
    this.ui.openChoice(options, pl.blessings, (b) => {
      pl.choosing = false;
      this.grantBlessing(b, pl);
      if (after) after();
    }, title);
  }

  // Resposta do Jogador 2 (co-op). idx < 0 = desistiu (desconectou).
  resolveRemoteChoice(id, idx) {
    const c = this.pendingChoice;
    if (!c || c.id !== id) return;
    this.pendingChoice = null;
    c.pl.choosing = false;
    const b = c.options[idx];
    if (b) this.grantBlessing(b, c.pl);
    if (c.after) c.after();
    this.checkDoors();
  }

  grantBlessing(b, pl = this.player) {
    pl.addBlessing(b);
    audio.play('blessing', pl.position.x, pl.position.z);
    if (pl === this.player) this.hud.setBlessings(pl.blessings, BLESSINGS, RARITY);
    if (pl.ux) pl.ux.banner(b.name, 'small'); else this.hud.banner(b.name, 'small');
    this.vfx.burst(pl.position, new THREE.Color(RARITY[b.rarity].color).getHex());
  }

  // Pequena espera sem setTimeout (respeita o hitstop e o teste automático).
  delay(t, fn) { (this.timers ||= []).push({ t, fn }); }

  // ---------- A cada quadro ----------
  update(dt, time) {
    if (this.timers) for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      if ((tm.t -= dt) <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }
    for (const i of this.icons) { i.rotation.y += dt * 1.2; i.position.y = 5.2 + Math.sin(time * 2 + i.position.x) * 0.15; }
    for (const p of this.pickups) p.update(dt);
    if (this.npc && this.npc.alive && this.npc.state === 'idle' && !this.waves.active) {
      const d = Math.min(...this.players.map((pl) => Math.hypot(pl.position.x - this.npc.group.position.x, pl.position.z - this.npc.group.position.z)));
      if (!this.npc.waved && d < 9) {
        this.npc.waved = true;
        this.npc.anim.play('Waving', { once: true, restart: true, onFinish: () => this.npc && this.npc.state === 'idle' && this.npc.anim.play('Idle_B') });
      }
    }
    if (this.built) updateSpikes(this.built.spikes, dt, time, this.combat);
    if (this.inTavern) {
      this.tavern.update(dt, this.players);
      for (const p of this.pickups) if (p.opts.item === 'weapon') p.setEquipped(this.player.weaponId === (WEAPONS[this.player.heroId][p.opts.slot] || {}).id);
      if (this.unlock.active) { this.unlock.update(dt); this.ui.setPrompt(null); return; } // cena de desbloqueio
    }
    if (this.victoryTimer > 0 && (this.victoryTimer -= dt) <= 0) this.showVictory();
    if (this.waitMsg > 0) this.waitMsg -= dt;
    if (this.transition) { this.updateTransition(dt); return; }

    for (const pl of this.players) {
      const prompt = pl.state === 'dead' ? null : this.updatePickups(pl);
      if (pl === this.player) {
        if (prompt) this.ui.setPrompt(prompt.text, prompt.pos); else this.ui.setPrompt(null);
      } else this.remotePrompt = prompt;
    }

    // Entrar por uma porta aberta (qualquer herói vivo leva os dois).
    if (this.doorsOpen && this.built) {
      for (const pl of this.players) {
        if (pl.state === 'dead' || this.transition) continue;
        for (const d of this.built.doors) {
          if (!d.node || d.k < 0.6) continue;
          if (!this.atDoor(pl, d)) continue;
          // Taverna no co-op: a descida só começa com os dois na porta.
          if (d.node.kind === 'descend' && this.coop && !this.players.every((o) => o.state === 'dead' || this.atDoor(o, d))) {
            if (!(this.waitMsg > 0)) { this.waitMsg = 3; this.hud.banner('Esperando o parceiro na porta…', 'small'); }
            continue;
          }
          this.go(d.node);
          break;
        }
      }
    }
  }

  atDoor(pl, d) { return Math.abs(pl.position.x - d.x) < 1.5 && pl.position.z < d.z + 0.5 + pl.hero.radius + 0.35; }

  // Pega recompensas automáticas (encostando) e procura o que dá para usar com E. Devolve o aviso { text, pos } ou null.
  updatePickups(pl) {
    let near = null, nearD = Infinity;
    for (const p of [...this.pickups]) {
      if (p.taken) continue;
      if (p.opts.owner && p.opts.owner !== pl) continue;           // de outro jogador
      if (p.boughtBy && p.boughtBy.has(pl)) continue;              // já comprou este item
      if (p.usedBy && p.usedBy.has(pl)) continue;                  // já descansou
      const d = Math.hypot(pl.position.x - p.pos.x, pl.position.z - p.pos.z);
      if (d > p.radius) continue;
      if (p.auto) { if (!pl.choosing) this.take(p, pl); continue; }
      if ((p.prompt || p.kind === 'shop') && d < nearD) { near = p; nearD = d; }
    }
    pl.noPotion = !!near;
    if (!near) return null;
    if (pl.ctl.interact() && pl.state !== 'attack' && pl.state !== 'dodge') this.take(near, pl);
    if (near.taken || !this.pickups.includes(near) || (near.boughtBy && near.boughtBy.has(pl)) || (near.usedBy && near.usedBy.has(pl))) return null;
    return { text: this.promptFor(near, pl), pos: new THREE.Vector3(near.pos.x, near.kind === 'shop' ? 3.4 : 2.8, near.pos.z) };
  }

  // ---------- Troca de sala ----------
  go(node) {
    this.transition = { t: 0, node, swapped: false };
    for (const p of this.players) p.frozen = true;
    this.ui.fade(true);
    this.ui.setPrompt(null);
  }

  updateTransition(dt) {
    const tr = this.transition;
    tr.t += dt;
    // Heróis continuam andando um pouco para dentro da porta enquanto escurece.
    if (!tr.swapped) for (const p of this.players) if (p.state !== 'dead') p.position.z -= dt * 3;
    if (!tr.swapped && tr.t >= FADE) {
      tr.swapped = true;
      this.step++;
      this.doorsOpen = false;
      if (tr.node.kind === 'exit') { this.nextFloor(); this.ui.fade(false); return; }
      if (tr.node.kind === 'descend') { this.beginDescent(); this.ui.fade(false); return; }
      this.enter(tr.node, true);
      this.ui.fade(false);
    }
    if (tr.swapped && tr.t >= FADE + 0.25) {
      this.transition = null;
      for (const p of this.players) p.frozen = false;
    }
  }

  // Desce para o próximo andar (vida, ouro e bênçãos continuam).
  nextFloor(n = this.floorNum + 1) {
    this.inTavern = false;
    this.floorNum = n;
    this.floor = generateFloor(n);
    this.step = 0;
    this.history = [];
    this.enter(this.floor.first, true);
    this.hud.banner(`Andar ${n} — ${FLOORS[n].name}`, 'big');
  }

  // O Necromante caiu: alguns segundos para ver ele desmoronar, depois a tela de vitória.
  victory() {
    audio.play('win', null, null);
    this.hud.banner('O Ceifador caiu!', 'big');
    this.hud.hideBoss();
    this.won = true;
    this.cam.shake(0.6);
    this.vfx.burst(this.built.reward, 0xffc24a);
    this.victoryTimer = 3.2;
  }

  showVictory() {
    if (this.players.every((p) => p.state === 'dead')) return;
    for (const p of this.players) { p.frozen = true; p.emote('Cheering', { hold: true }); }
    const secs = Math.round((performance.now() - this.startTime) / 1000);
    const line = (p) => {
      const nBless = Object.values(p.blessings).reduce((a, b) => a + b, 0);
      return `Ouro: <b>${p.gold}</b> &nbsp;·&nbsp; Bênçãos: <b>${nBless}</b> &nbsp;·&nbsp; Vida: <b>${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}</b>`;
    };
    const per = this.coop ? this.players.map((p) => `Jogador ${p.id} — ${line(p)}`).join('<br>') : line(this.player);
    this.winStats = `Tempo: <b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b> &nbsp;·&nbsp; Esqueletos destruídos: <b>${this.combat.kills}</b><br>${per}${this.bankSoul(true)}`;
    this.ui.showWin(this.winStats);
  }
}
