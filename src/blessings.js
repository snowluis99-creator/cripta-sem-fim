// Bênçãos: melhorias que valem até o fim da partida. Só dados + como elas mudam os atributos do herói.
// stats = números que o resto do jogo lê (dano, velocidade, etc.). Cada bênção pode ser pega várias vezes até "max".

export const RARITY = {
  common: { name: 'Comum', color: '#e9e4d8', weight: 55, price: 50 },
  rare: { name: 'Rara', color: '#5fb0ff', weight: 30, price: 70 },
  epic: { name: 'Épica', color: '#c27bff', weight: 12, price: 100 },
  legendary: { name: 'Lendária', color: '#ffc24a', weight: 3, price: 150 },
};
const ORDER = ['common', 'rare', 'epic', 'legendary'];

export function baseStats() {
  return {
    damageMul: 1, critChance: 0, speedMul: 1, dodgeMul: 1, attackSpeed: 1, damageTaken: 1, bonusHp: 0,
    lifeOnKill: 0, thorns: 0, burnDps: 0, iceTrail: false, heavyRadiusMul: 1, heavyPushMul: 1, phoenix: 0,
    // M4:
    rangeMul: 1, goldMul: 1, potionBonus: 0, execute: 0, counter: false, reflex: false, echo: 0,
    chain: 0, boneBlast: 0, roomHeal: 0, spectral: false, fury: false, reaper: false, reaperStacks: 0,
    // Escudo (quebra depois de 10 bloqueios):
    shieldBonus: 0, parry: false, forge: false, shards: false, mithril: 0,
  };
}

export const BLESSINGS = [
  { id: 'forca', name: 'Força Bruta', icon: '⚔', rarity: 'common', max: 5,
    desc: (n) => `+20% de dano em todos os golpes. (total: +${n * 20}%)`,
    apply: (s) => { s.damageMul += 0.2; } },
  { id: 'vigor', name: 'Vigor', icon: '♥', rarity: 'common', max: 5,
    desc: () => '+20 de vida máxima e cura 20 agora.',
    apply: (s, p) => { s.bonusHp += 20; p && p.heal(20); } },
  { id: 'pes', name: 'Pés Leves', icon: '»', rarity: 'common', max: 3,
    desc: () => 'Anda 12% mais rápido e rola 15% mais longe.',
    apply: (s) => { s.speedMul += 0.12; s.dodgeMul += 0.15; } },
  { id: 'pele', name: 'Pele de Ferro', icon: '⛨', rarity: 'common', max: 3,
    desc: () => 'Recebe 15% menos dano.',
    apply: (s) => { s.damageTaken *= 0.85; } },
  { id: 'sede', name: 'Sede de Sangue', icon: '✚', rarity: 'legendary', max: 1,
    desc: () => 'Cura 3 de vida a cada esqueleto destruído.',
    apply: (s) => { s.lifeOnKill += 3; } },
  { id: 'frenesi', name: 'Frenesi', icon: 'ϟ', rarity: 'rare', max: 2,
    desc: () => 'Golpes 15% mais rápidos.',
    apply: (s) => { s.attackSpeed += 0.15; } },
  { id: 'espinhos', name: 'Escudo de Espinhos', icon: '✷', rarity: 'rare', max: 3,
    desc: (n) => `Bloquear um golpe devolve ${n * 15} de dano ao atacante.`,
    apply: (s) => { s.thorns += 15; } },
  { id: 'carrasco', name: 'Olho do Carrasco', icon: '◎', rarity: 'rare', max: 3,
    desc: (n) => `${n * 15}% de chance de golpe crítico (dano dobrado).`,
    apply: (s) => { s.critChance += 0.15; } },
  { id: 'fogo', name: 'Lâmina Flamejante', icon: '♨', rarity: 'epic', max: 3,
    desc: (n) => `O golpe forte põe fogo nos esqueletos: ${n * 4} de dano por segundo durante 3 s.`,
    apply: (s) => { s.burnDps += 4; } },
  { id: 'gelo', name: 'Rastro de Gelo', icon: '❄', rarity: 'epic', max: 1,
    desc: () => 'Rolar deixa gelo no chão que deixa os esqueletos lentos.',
    apply: (s) => { s.iceTrail = true; } },
  { id: 'terremoto', name: 'Terremoto', icon: '≋', rarity: 'epic', max: 2,
    desc: () => 'A onda de choque do golpe forte fica 50% maior e empurra mais.',
    apply: (s) => { s.heavyRadiusMul += 0.5; s.heavyPushMul += 0.4; } },
  // ---- M4: +13 bênçãos ----
  { id: 'alcance', name: 'Lâmina Longa', icon: '↔', rarity: 'common', max: 2,
    desc: () => 'Os golpes alcançam 20% mais longe.',
    apply: (s) => { s.rangeMul += 0.2; } },
  { id: 'ganancia', name: 'Ganância', icon: '¤', rarity: 'common', max: 2,
    desc: () => 'Ganha 50% mais ouro.',
    apply: (s) => { s.goldMul += 0.5; } },
  { id: 'alquimia', name: 'Alquimista', icon: '⚗', rarity: 'common', max: 3,
    desc: (n) => `Ganha 1 poção agora e as poções curam +15. (total: +${n * 15})`,
    apply: (s, p) => { s.potionBonus += 15; if (p) p.potions += 1; } },
  { id: 'folego', name: 'Fôlego', icon: '❦', rarity: 'common', max: 3,
    desc: (n) => `Cura ${n * 8} de vida ao entrar em cada sala nova.`,
    apply: (s) => { s.roomHeal += 8; } },
  { id: 'execucao', name: 'Execução', icon: '†', rarity: 'rare', max: 2,
    desc: (n) => `+${n * 50}% de dano em esqueletos com menos de 30% de vida.`,
    apply: (s) => { s.execute += 0.5; } },
  { id: 'contra', shield: true, name: 'Contra-Ataque', icon: '⇄', rarity: 'rare', max: 1,
    desc: () => 'Depois de bloquear um golpe, o próximo golpe dá dano dobrado.',
    apply: (s) => { s.counter = true; } },
  { id: 'reflexo', name: 'Reflexo', icon: '≫', rarity: 'rare', max: 1,
    desc: () => 'Escapar de um ataque rolando deixa os golpes 30% mais rápidos por 3 s.',
    apply: (s) => { s.reflex = true; } },
  // Fortes demais para serem comuns (pedido do dono): viraram lendárias, uma vez só.
  { id: 'eco', name: 'Eco do Golpe', icon: '◗', rarity: 'legendary', max: 1,
    desc: () => 'O golpe forte solta uma rajada que atravessa os esqueletos à frente (25 de dano).',
    apply: (s) => { s.echo += 25; } },
  { id: 'raio', name: 'Corrente de Raios', icon: '↯', rarity: 'legendary', max: 1,
    desc: () => 'Golpes críticos soltam um raio que pula para 3 esqueletos perto (12 de dano).',
    apply: (s) => { s.chain += 2; } },
  { id: 'explosao', name: 'Ossos Explosivos', icon: '✹', rarity: 'legendary', max: 1,
    desc: () => 'Esqueletos destruídos explodem e causam 20 de dano em volta.',
    apply: (s) => { s.boneBlast += 20; } },
  { id: 'espectral', name: 'Escudo Espectral', icon: '◈', rarity: 'epic', max: 1,
    desc: () => 'A cada 12 s ganha uma proteção que anula o próximo golpe recebido.',
    apply: (s) => { s.spectral = true; } },
  { id: 'furia', name: 'Fúria do Cavaleiro', icon: '☄', rarity: 'legendary', max: 1,
    desc: () => 'Com menos de 40% de vida: +60% de dano e anda 20% mais rápido.',
    apply: (s) => { s.fury = true; } },
  { id: 'ceifador', name: 'Ceifador', icon: '☠', rarity: 'legendary', max: 1,
    desc: () => 'Cada esqueleto destruído dá +2% de dano até o fim da partida (máx. +50%).',
    apply: (s) => { s.reaper = true; } },
  // ---- Escudo ----
  { id: 'reforco', shield: true, name: 'Escudo Reforçado', icon: '⛉', rarity: 'common', max: 3,
    desc: (n) => `O escudo aguenta +4 bloqueios (total: ${10 + n * 4}) e fica novo agora.`,
    apply: (s, p) => { s.shieldBonus += 4; if (p) p.shield = 10 + s.shieldBonus; } },
  { id: 'mitral', shield: true, name: 'Placas de Mitral', icon: '⬡', rarity: 'rare', max: 2,
    desc: (n) => `${n * 25}% de chance de um bloqueio não gastar o escudo.`,
    apply: (s) => { s.mithril += 0.25; } },
  { id: 'estilhacos', shield: true, name: 'Estilhaços', icon: '✦', rarity: 'rare', max: 1,
    desc: () => 'Quando o escudo quebra, ele explode: 40 de dano e empurra os esqueletos em volta.',
    apply: (s) => { s.shards = true; } },
  { id: 'aparar', shield: true, name: 'Aparar', icon: '⟂', rarity: 'epic', max: 1,
    desc: () => 'Bloquear no instante certo (logo ao levantar o escudo) não gasta o escudo e atordoa quem atacou.',
    apply: (s) => { s.parry = true; } },
  { id: 'forja', shield: true, name: 'Forja Viva', icon: '⚒', rarity: 'epic', max: 1,
    desc: () => 'O escudo conserta 1 bloqueio a cada 6 s sem bloquear (até depois de quebrar). Conserta tudo agora.',
    apply: (s, p) => { s.forge = true; if (p) p.shield = 10 + s.shieldBonus; } },
  { id: 'fenix', name: 'Coração de Fênix', icon: '✺', rarity: 'legendary', max: 1,
    desc: () => 'Ao morrer, volta uma vez com metade da vida.',
    apply: (s) => { s.phoenix += 1; } },
];
export const BLESSING_BY_ID = Object.fromEntries(BLESSINGS.map((b) => [b.id, b]));

// Sorteia "count" bênçãos diferentes que o herói ainda pode pegar. minRarity: raridade mínima (baú, guardião).
// noShield: herói com arma de duas mãos (as bênçãos de escudo não aparecem).
export function rollBlessings(owned, count = 3, minRarity = 'common', rng = Math.random, noShield = false) {
  const min = ORDER.indexOf(minRarity);
  const can = (b) => (owned[b.id] || 0) < b.max && !(noShield && b.shield);
  let pool = BLESSINGS.filter((b) => can(b) && ORDER.indexOf(b.rarity) >= min);
  if (pool.length < count) pool = BLESSINGS.filter(can);
  const picks = [];
  while (picks.length < count && pool.length) {
    const total = pool.reduce((a, b) => a + RARITY[b.rarity].weight, 0);
    let r = rng() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) { r -= RARITY[pool[i].rarity].weight; if (r <= 0) break; }
    picks.push(pool[i]);
    pool = pool.filter((_, j) => j !== i);
  }
  return picks;
}

// Texto da carta: a descrição considerando o nível que o herói terá depois de pegar.
export function describe(b, owned) {
  const n = (owned[b.id] || 0) + 1;
  return b.desc(n);
}
