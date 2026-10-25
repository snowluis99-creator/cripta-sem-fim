// Melhorias permanentes da Taverna (compradas com Ouro de Alma). Só dados + como elas mudam o herói
// no começo de cada descida. price[n] = preço do nível n+1.
import { repairShield } from './shield.js';
export const UPGRADES = [
  { id: 'vida', name: 'Vigor da Taverna', icon: '♥', color: 0xe2504a, max: 5, price: [40, 70, 110, 160, 220],
    desc: (n) => `Começa a descida com +10 de vida máxima por nível. (agora: +${n * 10})`,
    apply: (p, n) => { p.stats.bonusHp += 10 * n; } },
  { id: 'afiar', name: 'Pedra de Afiar', icon: '⚔', color: 0xffb04a, max: 5, price: [60, 100, 150, 210, 280],
    desc: (n) => `+5% de dano por nível. (agora: +${n * 5}%)`,
    apply: (p, n) => { p.stats.damageMul += 0.05 * n; } },
  { id: 'escudo', name: 'Escudo Reforjado', icon: '⛨', color: 0x8fc3ff, max: 3, price: [50, 90, 150],
    desc: (n) => `O escudo aguenta +2 bloqueios por nível. (agora: +${n * 2})`,
    apply: (p, n) => { p.stats.shieldBonus += 2 * n; } },
  { id: 'pocao', name: 'Poção da Casa', icon: '⚱', color: 0xe2384b, max: 2, price: [90, 200],
    desc: (n) => `Começa a descida com +1 poção por nível. (agora: +${n})`,
    apply: (p, n) => { p.potions += n; } },
  { id: 'bolsa', name: 'Bolsa Velha', icon: '●', color: 0xffd36a, max: 3, price: [40, 80, 130],
    desc: (n) => `Começa a descida com 20 de ouro por nível. (agora: ${n * 20})`,
    apply: (p, n) => { p.gold += 20 * n; } },
  { id: 'bencao', name: 'Bênção do Taverneiro', icon: '✦', color: 0xc27bff, max: 1, price: [180],
    desc: () => 'Escolhe uma bênção logo na entrada da masmorra.',
    apply: (p, n) => { p.startBlessing = n > 0; } },
  { id: 'fenix', name: 'Segunda Chance', icon: '❂', color: 0xffc24a, max: 1, price: [350],
    desc: () => 'Uma vez por descida, ao morrer, levanta com metade da vida.',
    apply: (p, n) => { p.stats.phoenix += n; } },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export const upgradeLevel = (ups, id) => Math.min(UPGRADE_BY_ID[id].max, (ups && ups[id]) || 0);
export const upgradePrice = (ups, id) => UPGRADE_BY_ID[id].price[upgradeLevel(ups, id)] ?? null; // null = nível máximo

// Começo de uma descida: aplica tudo o que o jogador comprou (o herói já foi zerado com reset()).
export function applyUpgrades(p, ups) {
  p.startBlessing = false;
  for (const u of UPGRADES) {
    const n = upgradeLevel(ups, u.id);
    if (n > 0) u.apply(p, n);
  }
  p.hp = p.maxHp;
  repairShield(p);
}
