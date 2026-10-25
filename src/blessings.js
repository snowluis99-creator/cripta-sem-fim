// Bênçãos: melhorias que valem até o fim da partida. Só dados + como elas mudam os atributos do herói.
// stats = números que o resto do jogo lê (dano, velocidade, etc.). Cada bênção pode ser pega várias vezes até "max".

export const RARITY = {
  common: { name: 'Comum', color: '#e9e4d8', weight: 55, price: 200 },
  rare: { name: 'Rara', color: '#5fb0ff', weight: 30, price: 300 },
  epic: { name: 'Épica', color: '#c27bff', weight: 12, price: 400 },
  legendary: { name: 'Lendária', color: '#ffc24a', weight: 3, price: 500 },
  // Arriscada: sempre a 4ª carta (borda vermelha). Muito forte, mas com uma contrapartida. Não é vendida.
  risky: { name: 'Arriscada', color: '#ff4a4a', weight: 0, price: 0 },
  // Da sala "Bênção da Ultimate": melhoram a ultimate. Só saem lá (não vendem nem aparecem nas outras escolhas).
  ult: { name: 'Ultimate', color: '#ff9a2a', weight: 0, price: 0 },
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
    // Bênçãos arriscadas e ultimate:
    potionMul: 1, ultNeed: 10,
    // Bênçãos da Ultimate (ultimate.js):
    ultHeal: 0, ultBlast: 0, ultRefund: 0, domeTime: 0, domeBurn: 0, domeFury: false, rainRepeat: 0, rainFreeze: 0, rainDamage: 0,
    aimTime: 0, lethalCrit: false, ultSmoke: false, // Ladino (Precisão Invejável)
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
// ---- Arriscadas (sempre a 4ª opção): forte + contrapartida (risk = o texto da contrapartida) ----
export const RISKY = [
  { id: 'r_pacto', name: 'Pacto de Sangue', icon: '♆', rarity: 'risky', max: 1,
    desc: () => '+50% de dano.', risk: '−30 de vida máxima.',
    apply: (s) => { s.damageMul += 0.5; s.bonusHp -= 30; } },
  { id: 'r_furia', name: 'Fúria Cega', icon: '⚡', rarity: 'risky', max: 1,
    desc: () => 'Golpes 30% mais rápidos.', risk: 'Recebe 30% mais dano.',
    apply: (s) => { s.attackSpeed += 0.3; s.damageTaken *= 1.3; } },
  { id: 'r_pesada', name: 'Lâmina Pesada', icon: '✠', rarity: 'risky', max: 1,
    desc: () => '+50% de dano.', risk: 'Golpes 25% mais lentos.',
    apply: (s) => { s.damageMul += 0.5; s.attackSpeed -= 0.25; } },
  { id: 'r_fantasma', name: 'Passos Fantasmas', icon: '☁', rarity: 'risky', max: 1,
    desc: () => 'Anda 25% mais rápido e rola o dobro da distância.', risk: '−25% de dano.',
    apply: (s) => { s.speedMul += 0.25; s.dodgeMul += 1; s.damageMul -= 0.25; } },
  { id: 'r_vampira', name: 'Alma Vampira', icon: '♁', rarity: 'risky', max: 1,
    desc: () => 'Cura 5 de vida a cada inimigo derrotado.', risk: 'As poções curam só metade.',
    apply: (s) => { s.lifeOnKill += 5; s.potionMul *= 0.5; } },
  { id: 'r_ceifador', name: 'Pacto do Ceifador', icon: '⌛', rarity: 'risky', max: 1,
    desc: () => 'A ultimate carrega com 6 inimigos derrotados (em vez de 10).', risk: '−20 de vida máxima.',
    apply: (s) => { s.ultNeed -= 4; s.bonusHp -= 20; } },
];
BLESSINGS.push(...RISKY);

// ---- Bênçãos da Ultimate (sala "Bênção da Ultimate"). hero = só para esse herói; sem hero = todos ----
export const ULT_BLESSINGS = [
  { id: 'u_carga', name: 'Carga Rápida', icon: '⚡', rarity: 'ult', max: 2,
    desc: () => 'A ultimate carrega com 2 inimigos a menos.',
    apply: (s) => { s.ultNeed -= 2; } },
  { id: 'u_cura', name: 'Ultimate Restauradora', icon: '✚', rarity: 'ult', max: 2,
    desc: (n) => `Usar a ultimate cura ${n * 25} de vida.`,
    apply: (s) => { s.ultHeal += 25; } },
  { id: 'u_onda', name: 'Explosão de Poder', icon: '✹', rarity: 'ult', max: 2,
    desc: (n) => `Ao usar a ultimate, uma explosão em volta causa ${n * 25} de dano e empurra os inimigos.`,
    apply: (s) => { s.ultBlast += 25; } },
  { id: 'u_eco', name: 'Carga Guardada', icon: '↺', rarity: 'ult', max: 1,
    desc: () => 'Depois de usar a ultimate, a barra já começa com metade.',
    apply: (s) => { s.ultRefund = 0.5; } },
  // Cavaleiro (Fortaleza Dourada)
  { id: 'u_eterna', hero: 'knight', name: 'Fortaleza Eterna', icon: '⛨', rarity: 'ult', max: 2,
    desc: (n) => `O domo dourado dura +1,5 s. (total: ${(3 + n * 1.5).toString().replace('.', ',')} s)`,
    apply: (s) => { s.domeTime += 1.5; } },
  { id: 'u_ardente', hero: 'knight', name: 'Domo Ardente', icon: '♨', rarity: 'ult', max: 1,
    desc: () => 'O domo queima quem estiver perto: 10 de dano a cada meio segundo.',
    apply: (s) => { s.domeBurn = 10; } },
  { id: 'u_furia', hero: 'knight', name: 'Fúria Dourada', icon: '☄', rarity: 'ult', max: 1,
    desc: () => 'Dentro do domo, os golpes causam +60% de dano.',
    apply: (s) => { s.domeFury = true; } },
  // Maga (Chuva Arcana)
  { id: 'u_dupla', hero: 'mage', name: 'Chuva Dupla', icon: '↯', rarity: 'ult', max: 1,
    desc: () => 'A Chuva Arcana cai mais uma vez logo depois.',
    apply: (s) => { s.rainRepeat = 1; } },
  { id: 'u_gelida', hero: 'mage', name: 'Chuva Gélida', icon: '❄', rarity: 'ult', max: 1,
    desc: () => 'A Chuva Arcana congela os inimigos por 2 s.',
    apply: (s) => { s.rainFreeze = 2; } },
  { id: 'u_forte', hero: 'mage', name: 'Tempestade Arcana', icon: '✦', rarity: 'ult', max: 2,
    desc: (n) => `Cada raio da Chuva Arcana causa +12 de dano. (total: ${15 + n * 12})`,
    apply: (s) => { s.rainDamage += 12; } },
  // Ladino (Precisão Invejável)
  { id: 'u_mira', hero: 'rogue', name: 'Mira Demorada', icon: '◎', rarity: 'ult', max: 2,
    desc: (n) => `A Precisão Invejável dura +2 s. (total: ${5 + n * 2} s)`,
    apply: (s) => { s.aimTime += 2; } },
  { id: 'u_letal', hero: 'rogue', name: 'Golpe Letal', icon: '†', rarity: 'ult', max: 1,
    desc: () => 'Durante a Precisão Invejável, os críticos causam o triplo de dano (em vez do dobro).',
    apply: (s) => { s.lethalCrit = true; } },
  { id: 'u_sombra', hero: 'rogue', name: 'Sombra Instantânea', icon: '☁', rarity: 'ult', max: 1,
    desc: () => 'Usar a ultimate também solta uma bomba de fumaça (fica invisível por 2 s).',
    apply: (s) => { s.ultSmoke = true; } },
];
for (const b of ULT_BLESSINGS) b.ult = true;
BLESSINGS.push(...ULT_BLESSINGS);

// 3 bênçãos da ultimate para este herói (pelo menos uma dele, se ainda tiver).
export function rollUltBlessings(owned, heroId, count = 3, rng = Math.random) {
  const can = (b) => (owned[b.id] || 0) < b.max && (!b.hero || b.hero === heroId);
  const own = ULT_BLESSINGS.filter((b) => can(b) && b.hero);
  const picks = [];
  if (own.length) picks.push(own[Math.floor(rng() * own.length)]);
  let pool = ULT_BLESSINGS.filter((b) => can(b) && !picks.includes(b));
  while (picks.length < count && pool.length) {
    const i = Math.floor(rng() * pool.length);
    picks.push(pool[i]);
    pool = pool.filter((_, j) => j !== i);
  }
  return picks.sort((a, b) => ULT_BLESSINGS.indexOf(a) - ULT_BLESSINGS.indexOf(b));
}

// A 4ª carta: uma arriscada que o herói ainda não tem (null se já tem todas).
export function rollRisky(owned, rng = Math.random) {
  const pool = RISKY.filter((b) => (owned[b.id] || 0) < b.max);
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

export const BLESSING_BY_ID = Object.fromEntries(BLESSINGS.map((b) => [b.id, b]));

// Sorteia "count" bênçãos diferentes que o herói ainda pode pegar. minRarity: raridade mínima (baú, guardião).
// noShield: herói com arma de duas mãos (as bênçãos de escudo não aparecem).
export function rollBlessings(owned, count = 3, minRarity = 'common', rng = Math.random, noShield = false) {
  const min = ORDER.indexOf(minRarity);
  const can = (b) => b.rarity !== 'risky' && !b.ult && (owned[b.id] || 0) < b.max && !(noShield && b.shield);
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

// Mercador: uma bênção de cada raridade (comum, rara, épica, lendária). Pula a raridade que não tiver mais nenhuma disponível.
export function rollShop(owned, rng = Math.random, noShield = false) {
  const can = (b) => (owned[b.id] || 0) < b.max && !(noShield && b.shield);
  const out = [];
  for (const r of ORDER) {
    const pool = BLESSINGS.filter((b) => b.rarity === r && can(b));
    if (pool.length) out.push(pool[Math.floor(rng() * pool.length)]);
  }
  return out;
}

// Texto da carta: a descrição considerando o nível que o herói terá depois de pegar.
export function describe(b, owned) {
  const n = (owned[b.id] || 0) + 1;
  return b.desc(n) + (b.risk ? `<span class="risk">⚠ ${b.risk}</span>` : '');
}
