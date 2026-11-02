// Bênçãos: melhorias que valem até o fim da partida. Só dados + como elas mudam os atributos do herói.
import { WEAPON_BLESSINGS, GENERAL_NEEDS, weaponKey } from './weaponbless.js';
import { COOP_BLESSINGS } from './coopbless.js';
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
    rangeMul: 1, goldMul: 1, potionBonus: 0, execute: 0, counter: 0, reflex: false, echo: 0,
    chain: 0, boneBlast: 0, roomHeal: 0, spectral: false, fury: false, reaper: false, reaperStacks: 0,
    // Escudo (quebra depois de 10 bloqueios):
    shieldBonus: 0, parry: false, forge: false, shards: false, mithril: 0,
    // Bênçãos arriscadas e ultimate:
    potionMul: 1, ultNeed: 10,
    // Bênçãos da Ultimate (ultimate.js):
    ultHeal: 0, ultBlast: 0, ultRefund: 0, domeTime: 0, domeBurn: 0, domeFury: false, rainRepeat: 0, rainFreeze: 0, rainDamage: 0, rainAcid: 0,
    aimTime: 0, lethalCrit: false, ultSmoke: false, // Ladino (Precisão Invejável)
    // Barreira da Maga (rebate projéteis):
    reflectMul: 1, reflectArc: 0, reflectBounce: 0, reflectHeal: 0, reflectCounter: false,
    // Bênçãos gerais novas (versão 115):
    evade: 0, heavyStun: 0, dodgeUlt: false, critDmgMul: 1, potionGuard: false, rage: 0, opener: 0, shieldBreak: false,
    rollDmg: 0, perfect: 0, potionSave: 0, luck: false, freeBuy: false, ultStun: 0, ultPower: 0,
    w: {}, // bênçãos exclusivas da arma (weaponbless.js)
  };
}

export const BLESSINGS = [
  // ---- Comuns ----
  { id: 'forca', name: 'Força Bruta', icon: '⚔', rarity: 'common', max: 5,
    desc: (n) => `+20% de dano em todos os golpes. (total: +${n * 20}%)`,
    apply: (s) => { s.damageMul += 0.2; } },
  { id: 'vigor', name: 'Vigor', icon: '♥', rarity: 'common', max: 5,
    desc: () => '+20 de vida máxima e cura 20 agora.',
    apply: (s, p) => { s.bonusHp += 20; p && p.heal(20); } },
  { id: 'maos', name: 'Mãos Leves', icon: '»', rarity: 'common', max: 5,
    desc: (n) => `Golpes 15% mais rápidos. (total: +${n * 15}%)`,
    apply: (s) => { s.attackSpeed += 0.15; } },
  { id: 'pele', name: 'Pele de Ferro', icon: '⛨', rarity: 'common', max: 3,
    desc: () => 'Recebe 15% menos dano.',
    apply: (s) => { s.damageTaken *= 0.85; } },
  { id: 'alcance', name: 'Sem Limites', icon: '↔', rarity: 'common', max: 2,
    desc: (n) => `Os golpes alcançam 15% mais longe. (total: +${n * 15}%)`,
    apply: (s) => { s.rangeMul += 0.15; } },
  { id: 'ganancia', name: 'Ganância', icon: '¤', rarity: 'common', max: 2,
    desc: () => 'Ganha 50% mais ouro.',
    apply: (s) => { s.goldMul += 0.5; } },
  { id: 'alquimia', name: 'Alquimista', icon: '⚗', rarity: 'common', max: 3,
    desc: (n) => `Ganha 1 poção agora e as poções curam +10. (total: +${n * 10})`,
    apply: (s, p) => { s.potionBonus += 10; if (p) p.potions += 1; } },
  { id: 'folego', name: 'Fôlego', icon: '❦', rarity: 'common', max: 3,
    desc: (n) => `Cura ${n * 10} de vida ao entrar em cada sala nova.`,
    apply: (s) => { s.roomHeal += 10; } },
  { id: 'habil', name: 'Habilidoso', icon: '✧', rarity: 'common', max: 3,
    desc: (n) => `+5% de chance de golpe crítico. (total: +${n * 5}%)`,
    apply: (s) => { s.critChance += 0.05; } },
  { id: 'furtivo', name: 'Furtivo', icon: '☁', rarity: 'common', max: 3,
    desc: (n) => `${n * 5}% de chance de desviar de qualquer golpe.`,
    apply: (s) => { s.evade += 0.05; } },
  // ---- Raras ----
  { id: 'frenesi', name: 'Frenesi', icon: 'ϟ', rarity: 'rare', max: 2,
    desc: (n) => `Inimigos acertados pelo último golpe do combo ficam ${n * 25}% mais tempo atordoados.`,
    apply: (s) => { s.heavyStun += 0.25; } },
  { id: 'esqult', name: 'Esquiva Envolvente', icon: '↺', rarity: 'rare', max: 1,
    desc: () => 'Escapar de um projétil rolando enche 1 da ultimate (no máximo 1 vez por minuto).',
    apply: (s) => { s.dodgeUlt = true; } },
  { id: 'carrasco', name: 'Olho do Carrasco', icon: '◎', rarity: 'rare', max: 3,
    desc: (n) => `Golpes críticos causam ${n * 15}% mais dano.`,
    apply: (s) => { s.critDmgMul += 0.15; } },
  { id: 'execucao', name: 'Execução', icon: '†', rarity: 'rare', max: 2,
    desc: (n) => `+${n * 50}% de dano em esqueletos com menos de 30% de vida.`,
    apply: (s) => { s.execute += 0.5; } },
  { id: 'contra', name: 'Contra-Ataque', icon: '⇄', rarity: 'rare', max: 4,
    desc: (n) => `Depois de escapar de um golpe rolando, o próximo golpe causa +${n * 25}% de dano.`,
    apply: (s) => { s.counter += 0.25; } },
  { id: 'reflexo', name: 'Reflexo', icon: '≫', rarity: 'rare', max: 1,
    desc: () => 'Escapar de um ataque rolando deixa os golpes 30% mais rápidos durante o próximo combo.',
    apply: (s) => { s.reflex = true; } },
  { id: 'pocaoesc', name: 'Poção Concentrada', icon: '◈', rarity: 'rare', max: 1,
    desc: () => 'Beber uma poção dá uma proteção que anula o próximo dano recebido.',
    apply: (s) => { s.potionGuard = true; } },
  { id: 'furia2', name: 'Fúria', icon: '☄', rarity: 'rare', max: 2,
    desc: (n) => `Com 10% de vida ou menos: +${n * 25}% de dano.`,
    apply: (s) => { s.rage += 0.25; } },
  { id: 'quebragelo', name: 'Quebra-Gelo', icon: '❄', rarity: 'rare', max: 2,
    desc: (n) => `O primeiro ataque em cada sala nova causa +${n * 35}% de dano.`,
    apply: (s) => { s.opener += 0.35; } },
  { id: 'potencia', name: 'Potência', icon: '⛉', rarity: 'rare', max: 1,
    desc: () => 'O último golpe do combo quebra o escudo do inimigo (ele perde o escudo de vez; chefes não).',
    apply: (s) => { s.shieldBreak = true; } },
  // ---- Épicas ----
  { id: 'fogo', name: 'Lâmina Flamejante', icon: '♨', rarity: 'epic', max: 3,
    desc: (n) => `O último golpe do combo põe fogo nos esqueletos: ${n * 4} de dano por segundo durante 3 s.`,
    apply: (s) => { s.burnDps += 4; } },
  { id: 'saque', name: 'Saque Rápido', icon: '➹', rarity: 'epic', max: 5,
    desc: (n) => `Rolar por dentro de um inimigo causa ${n} de dano.`,
    apply: (s) => { s.rollDmg += 1; } },
  { id: 'terremoto', name: 'Terremoto', icon: '≋', rarity: 'epic', max: 2,
    desc: () => 'A área do último golpe do combo fica 50% maior e empurra mais.',
    apply: (s) => { s.heavyRadiusMul += 0.5; s.heavyPushMul += 0.4; } },
  { id: 'espectral', name: 'Escudo Espectral', icon: '◈', rarity: 'epic', max: 1,
    desc: () => 'A cada 12 s ganha uma proteção que anula o próximo golpe recebido.',
    apply: (s) => { s.spectral = true; } },
  { id: 'perfect', name: 'Perfect', icon: '✪', rarity: 'epic', max: 2,
    desc: (n) => `Cada golpe que acerta soma +${n * 2} de dano aos próximos (até +${n * 30}), até você tomar dano.`,
    apply: (s) => { s.perfect += 2; } },
  { id: 'premiada', name: 'Poção Premiada', icon: '⚗', rarity: 'epic', max: 2,
    desc: (n) => `${n * 15}% de chance de a poção não ser gasta ao beber.`,
    apply: (s) => { s.potionSave += 0.15; } },
  { id: 'sorte', name: 'Sorte Grande', icon: '☘', rarity: 'epic', max: 1,
    desc: () => 'Objetos quebrados têm 25% de chance de soltar moedas, e baús 25% de soltar poção.',
    apply: (s) => { s.luck = true; } },
  // ---- Lendárias ----
  { id: 'sede', name: 'Sede de Sangue', icon: '✚', rarity: 'legendary', max: 1,
    desc: () => 'Cura 3 de vida a cada esqueleto destruído.',
    apply: (s) => { s.lifeOnKill += 3; } },
  { id: 'eco', name: 'Eco do Golpe', icon: '◗', rarity: 'legendary', max: 1,
    desc: () => 'O último golpe do combo solta uma rajada que atravessa os esqueletos à frente (25 de dano).',
    apply: (s) => { s.echo += 25; } },
  { id: 'raio', name: 'Corrente de Raios', icon: '↯', rarity: 'legendary', max: 1,
    desc: () => 'Golpes críticos soltam um raio que pula para 3 esqueletos perto (12 de dano).',
    apply: (s) => { s.chain += 2; } },
  { id: 'explosao', name: 'Ossos Explosivos', icon: '✹', rarity: 'legendary', max: 1,
    desc: () => 'Esqueletos destruídos explodem e causam 20 de dano em volta.',
    apply: (s) => { s.boneBlast += 20; } },
  { id: 'furia', name: 'Fúria Desesperada', icon: '☄', rarity: 'legendary', max: 1,
    desc: () => 'Com menos de 40% de vida: +60% de dano e golpes 30% mais rápidos.',
    apply: (s) => { s.fury = true; } },
  { id: 'ceifador', name: 'Ceifador', icon: '☠', rarity: 'legendary', max: 1,
    desc: () => 'Cada esqueleto destruído dá +2% de dano até o fim da partida (máx. +75%).',
    apply: (s) => { s.reaper = true; } },
  { id: 'negociador', name: 'Negociador', icon: '⚖', rarity: 'legendary', max: 1,
    desc: () => 'A primeira compra em cada visita ao mercador é grátis.',
    apply: (s) => { s.freeBuy = true; } },
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
  { id: 'r_vampira', name: 'Alma Vampira', icon: '♁', rarity: 'risky', max: 1,
    desc: () => 'Cura 5 de vida a cada inimigo derrotado.', risk: 'As poções curam só 20% do normal.',
    apply: (s) => { s.lifeOnKill += 5; s.potionMul *= 0.2; } },
  { id: 'r_ceifador', name: 'Pacto do Ceifador', icon: '⌛', rarity: 'risky', max: 1,
    desc: () => 'A ultimate carrega com 6 inimigos derrotados (em vez de 10).', risk: '−20 de vida máxima.',
    apply: (s) => { s.ultNeed -= 4; s.bonusHp -= 20; } },
];
BLESSINGS.push(...RISKY);

// ---- Bênçãos da Ultimate (sala "Bênção da Ultimate"). hero = só para esse herói; sem hero = todos ----
export const ULT_BLESSINGS = [
  { id: 'u_medo', name: 'Amedrontador', icon: '☠', rarity: 'ult', max: 1,
    desc: () => 'Usar a ultimate atordoa todos os inimigos por 2 s.',
    apply: (s) => { s.ultStun = 2; } },
  { id: 'u_cura', name: 'Ultimate Restauradora', icon: '✚', rarity: 'ult', max: 2,
    desc: (n) => `Usar a ultimate cura ${n * 25} de vida.`,
    apply: (s) => { s.ultHeal += 25; } },
  { id: 'u_onda', name: 'Explosão de Poder', icon: '✹', rarity: 'ult', max: 2,
    desc: (n) => `Ao usar a ultimate, uma explosão em volta causa ${n * 25} de dano e empurra os inimigos.`,
    apply: (s) => { s.ultBlast += 25; } },
  { id: 'u_poder', name: 'Poder Acumulado', icon: '⚡', rarity: 'ult', max: 1,
    desc: () => 'Depois de usar a ultimate, os próximos 2 combos causam o dobro de dano.',
    apply: (s) => { s.ultPower = 2; } },
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
  { id: 'u_acida', hero: 'mage', name: 'Chuva Ácida', icon: '☣', rarity: 'ult', max: 2,
    desc: (n) => `A Chuva Arcana marca os inimigos por 6 s: marcados sofrem ${n * 15}% mais dano.`,
    apply: (s) => { s.rainAcid += 0.15; } },
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
];
for (const b of ULT_BLESSINGS) b.ult = true;
BLESSINGS.push(...ULT_BLESSINGS);
// Bênçãos exclusivas de cada arma (10 por arma): só aparecem para quem está com aquela arma.
BLESSINGS.push(...WEAPON_BLESSINGS);
// Bênçãos exclusivas do co-op (coopbless.js): só aparecem com 2 heróis.
BLESSINGS.push(...COOP_BLESSINGS);
let COOP_MODE = false;
export const setCoopBlessings = (on) => { COOP_MODE = !!on; };
for (const b of BLESSINGS) if (GENERAL_NEEDS[b.id]) b.needs = GENERAL_NEEDS[b.id];

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
// block: 'shield' (Cavaleiro), 'none' (sem bloqueio: Ladino, duas mãos) ou 'reflect' (barreira da Maga).
// As de escudo só aparecem com 'shield'; as da barreira só com 'reflect'. (true/false antigos = 'none'/'shield')
export const blockKind = (hero) => (hero.noShield ? 'none' : hero.block && hero.block.reflect ? 'reflect' : 'shield');
// block pode ser o próprio herói (objeto): aí também filtra as bênçãos da arma e as que não fazem sentido para ela.
const fits = (b, block) => {
  const hero = block && typeof block === 'object' ? block : null;
  if (hero) {
    if (b.weapon && b.weapon !== weaponKey(hero)) return false;
    if (b.needs && !b.needs(hero)) return false;
    block = blockKind(hero);
  } else if (b.weapon) return false;
  if (b.coop && !COOP_MODE) return false;
  const k = block === true ? 'none' : block === false || block === undefined ? 'shield' : block;
  return !(b.shield && k !== 'shield') && !(b.reflect && k !== 'reflect');
};
export function rollBlessings(owned, count = 3, minRarity = 'common', rng = Math.random, block = 'shield') {
  const min = ORDER.indexOf(minRarity);
  const can = (b) => b.rarity !== 'risky' && !b.ult && (owned[b.id] || 0) < b.max && fits(b, block);
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
  // Nunca 3 cartas do pior nível (todas comuns): a última vira uma rara ou melhor (pedido do dono, 30/10).
  if (picks.length >= 3 && picks.every((b) => b.rarity === 'common')) {
    const up = pool.filter((b) => b.rarity !== 'common');
    if (up.length) {
      const total = up.reduce((a, b) => a + RARITY[b.rarity].weight, 0);
      let r = rng() * total, i = 0;
      for (; i < up.length - 1; i++) { r -= RARITY[up[i].rarity].weight; if (r <= 0) break; }
      picks[picks.length - 1] = up[i];
    }
  }
  return picks;
}

// Sala do chefe: garante pelo menos 1 lendária entre as cartas (troca a última que não for lendária).
export function ensureLegendary(picks, owned, rng = Math.random, block = 'shield') {
  if (picks.some((b) => b.rarity === 'legendary')) return picks;
  const pool = BLESSINGS.filter((b) => b.rarity === 'legendary' && !b.ult && (owned[b.id] || 0) < b.max && fits(b, block) && !picks.includes(b));
  if (!pool.length) return picks;
  const leg = pool[Math.floor(rng() * pool.length)];
  if (picks.length < 3) picks.push(leg); else picks[picks.length - 1] = leg;
  return picks;
}

// Mercador: uma bênção de cada raridade (comum, rara, épica, lendária). Pula a raridade que não tiver mais nenhuma disponível.
export function rollShop(owned, rng = Math.random, block = 'shield') {
  const can = (b) => (owned[b.id] || 0) < b.max && fits(b, block);
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
