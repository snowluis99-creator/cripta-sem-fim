// Monta o andar: uma sequência de salas. Depois de cada sala o jogador escolhe uma entre 1 ou 2 portas;
// o ícone em cima da porta mostra o que tem do outro lado (tipo de sala e recompensa).
import { COMBAT_ROOMS, CRYPT_ROOMS, SHADOW_ROOMS } from './rooms.js';

// Ondas por dificuldade (0 = primeira sala). Cada onda = lista de [tipo, quantidade].
// Arqueiros entram em todas as ondas, somados aos inimigos que já existiam.
const WAVES_BY_LEVEL = [
  [[['minion', 3], ['archer', 1]], [['minion', 4], ['archer', 1]]],
  [[['minion', 3], ['archer', 1]], [['minion', 3], ['warrior', 1], ['archer', 1]]],
  [[['minion', 4], ['archer', 1]], [['minion', 3], ['warrior', 1], ['archer', 1]], [['minion', 2], ['warrior', 2], ['archer', 2]]],
  [[['minion', 4], ['warrior', 1], ['archer', 1]], [['minion', 3], ['warrior', 2], ['archer', 2]]],
  [[['minion', 5], ['archer', 2]], [['minion', 3], ['warrior', 2], ['archer', 2]], [['minion', 4], ['warrior', 2], ['archer', 2]]],
];
const ELITE_WAVES = [[['minion', 4], ['warrior', 1], ['archer', 2]], [['minion', 3], ['archer', 1], ['guardian', 1]]];

// Andar 2 (Cripta): entram os Magos (orbes + reviver os caídos).
const CRYPT_WAVES = [
  [[['minion', 3], ['archer', 1], ['mage', 1]], [['minion', 3], ['warrior', 1], ['archer', 1]]],
  [[['minion', 4], ['archer', 1], ['mage', 1]], [['minion', 3], ['warrior', 1], ['archer', 1], ['mage', 1]]],
  [[['minion', 4], ['warrior', 1], ['mage', 1]], [['minion', 3], ['warrior', 1], ['archer', 2]], [['minion', 3], ['warrior', 1], ['archer', 1], ['mage', 1]]],
  [[['minion', 4], ['warrior', 1], ['archer', 1], ['mage', 1]], [['minion', 3], ['warrior', 2], ['archer', 1], ['mage', 1]]],
  [[['minion', 5], ['archer', 1], ['mage', 1]], [['minion', 3], ['warrior', 2], ['archer', 2]], [['minion', 4], ['warrior', 1], ['archer', 1], ['mage', 2]]],
];
// Andar 2: o chefe é o Necromante (Salão do Necromante).
const NECRO_WAVES = [[['necromancer', 1]]];
// Andar 3 (Reino das Sombras): entra o Assassino Sombrio (fica invisível e aparece nas costas).
const SHADOW_WAVES = [
  [[['minion', 3], ['assassin', 1], ['archer', 1]], [['minion', 3], ['warrior', 1], ['assassin', 1]]],
  [[['minion', 3], ['assassin', 1], ['mage', 1]], [['minion', 3], ['warrior', 1], ['assassin', 1], ['archer', 1]]],
  [[['minion', 3], ['warrior', 1], ['assassin', 2]], [['minion', 3], ['assassin', 1], ['archer', 1], ['mage', 1]], [['minion', 2], ['warrior', 2], ['assassin', 2]]],
  [[['minion', 4], ['warrior', 1], ['assassin', 2], ['mage', 1]], [['minion', 3], ['warrior', 2], ['assassin', 2], ['archer', 1]]],
  [[['minion', 4], ['assassin', 2], ['archer', 1]], [['minion', 3], ['warrior', 2], ['assassin', 2], ['mage', 1]], [['minion', 3], ['warrior', 1], ['assassin', 3], ['archer', 1], ['mage', 1]]],
];
const REAPER_WAVES = [[['reaper', 1]]];

// Nome e vida/dano extras de cada andar.
export const FLOORS = {
  1: { name: 'A Masmorra', hp: 1, dmg: 1 },
  2: { name: 'A Cripta', hp: 1.25, dmg: 1.15 },
  3: { name: 'O Reino das Sombras', hp: 1.45, dmg: 1.25 },
};

// Tipos de porta: o que o ícone mostra.
export const NODE_INFO = {
  blessing: { label: 'Bênção', color: 0xc27bff },
  gold: { label: 'Ouro', color: 0xffc24a },
  potion: { label: 'Poção', color: 0xe2384b },
  treasure: { label: 'Tesouro', color: 0xffd36a },
  merchant: { label: 'Mercador', color: 0x7dff8a },
  rest: { label: 'Descanso (vida cheia)', color: 0x8ad8ff },
  elite: { label: 'Guardião', color: 0xff4040 },
  exit: { label: 'Descer', color: 0xffffff },
  boss: { label: 'Chefe', color: 0xa040ff },
};

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const shuffle = (list, rng) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Uma "sala do mapa" (nó): { kind: combat|treasure|merchant|rest|elite|exit, reward, room, waves, level }
function combatNode(level, reward, used, rng, rooms = COMBAT_ROOMS, table = WAVES_BY_LEVEL) {
  const free = rooms.filter((r) => !used.has(r));
  const room = pick(free.length ? free : rooms, rng);
  used.add(room);
  return { kind: 'combat', reward, room, waves: table[Math.min(level, table.length - 1)], level };
}

// Gera o andar "n" (1, 2 ou 3). Cada nó guarda o andar (floor) para a vida/dano extras.
export function generateFloor(n = 1, rng = Math.random) {
  const f = n === 2 ? generateCrypt(rng) : n === 3 ? generateHall(rng) : generateDungeon(rng);
  for (const node of [f.first, ...f.steps.flat()]) node.floor = n;
  f.n = n;
  return f;
}

// Andar 2: igual ao andar 1 na estrutura, com salas da Cripta e o Necromante no fim (depois, a descida).
function generateCrypt(rng) {
  const used = new Set();
  const first = { kind: 'combat', reward: 'none', room: 'cripta_entrada', waves: CRYPT_WAVES[0], level: 0 };
  const steps = midSteps(rng, (lvl, reward) => combatNode(lvl, reward, used, rng, CRYPT_ROOMS, CRYPT_WAVES), CRYPT_WAVES);
  steps.push([{ kind: 'boss', reward: 'boss', room: 'trono', waves: NECRO_WAVES, level: 6, label: 'O Necromante', intro: 'O Necromante desperta…' }]);
  steps.push([{ kind: 'exit', reward: 'exit' }]);
  return { first, steps: steps.map((s) => shuffle(s, rng)) };
}

// Andar 3: andar completo nas salas das sombras, com o Ceifador Sombrio no fim (vencer = fim da partida).
function generateHall(rng) {
  const used = new Set();
  const first = { kind: 'combat', reward: 'none', room: 'antessala', waves: SHADOW_WAVES[0], level: 0 };
  const steps = midSteps(rng, (lvl, reward) => combatNode(lvl, reward, used, rng, SHADOW_ROOMS, SHADOW_WAVES), SHADOW_WAVES);
  steps.push([{ kind: 'boss', reward: 'boss', room: 'santuario', waves: REAPER_WAVES, level: 6, label: 'O Ceifador Sombrio', intro: 'O Ceifador Sombrio surge das sombras…' }]);
  return { first, steps: steps.map((s) => shuffle(s, rng)) };
}

// Os 4 passos do meio de um andar (iguais nos 3 andares): ouro x poção, combate x tesouro,
// combate x (mercador/descanso) e combate x o que não saiu antes.
function midSteps(rng, node, table) {
  const prize = () => pick(['gold', 'potion'], rng);
  const special = (kind, level) => (kind === 'rest' ? { kind, reward: kind, room: 'descanso' }
    : { kind, reward: kind, room: kind === 'merchant' ? 'mercador' : 'tesouro', level, waves: table[Math.min(level, table.length - 1)] });
  const steps = [];
  const r = shuffle(['gold', 'potion'], rng);
  steps.push([node(1, r[0]), node(1, r[1])]);
  steps.push([node(2, prize()), special('treasure', 2)]);
  const shop = rng() < 0.5 ? 'merchant' : 'rest';
  steps.push([node(3, prize()), special(shop, 3)]);
  steps.push([node(4, prize()), special(shop === 'merchant' ? 'rest' : 'merchant', 4)]);
  return steps;
}

// Gera o andar inteiro de uma vez: lista de passos; cada passo tem as opções de porta.
// Toda sala com combate dá uma bênção ao ser limpa; a porta mostra o prêmio EXTRA (ouro, poções, tesouro,
// mercador). Só o Descanso não tem combate (e não dá bênção: enche a vida inteira).
function generateDungeon(rng) {
  const used = new Set();
  const first = { kind: 'combat', reward: 'none', room: 'entrada', waves: WAVES_BY_LEVEL[0], level: 0 };
  const steps = [];
  const prize = () => pick(['gold', 'potion'], rng);
  // Sala especial com combate antes (tesouro / mercador) ou descanso (sem combate).
  const special = (kind, level) => {
    if (kind === 'rest') return { kind, reward: kind, room: 'descanso' };
    return { kind, reward: kind, room: kind === 'merchant' ? 'mercador' : 'tesouro', level,
      waves: WAVES_BY_LEVEL[Math.min(level, WAVES_BY_LEVEL.length - 1)] };
  };
  // Passo 1: ouro contra poções.
  const r = shuffle(['gold', 'potion'], rng);
  steps.push([combatNode(1, r[0], used, rng), combatNode(1, r[1], used, rng)]);
  // Passo 2: combate ou tesouro.
  steps.push([combatNode(2, prize(), used, rng), special('treasure', 2)]);
  // Passo 3: combate ou (mercador / descanso).
  const shop = rng() < 0.5 ? 'merchant' : 'rest';
  steps.push([combatNode(3, prize(), used, rng), special(shop, 3)]);
  // Passo 4: o que não saiu antes (mercador ou descanso) contra combate.
  const other = shop === 'merchant' ? 'rest' : 'merchant';
  steps.push([combatNode(4, prize(), used, rng), special(other, 4)]);
  // Passo 5: o Guardião (sala elite, porta única).
  steps.push([{ kind: 'elite', reward: 'elite', room: 'salao', waves: ELITE_WAVES, level: 5 }]);
  // Passo 6: a saída do andar.
  steps.push([{ kind: 'exit', reward: 'exit' }]);
  // Mistura a ordem das portas de cada passo (esquerda/direita).
  return { first, steps: steps.map((s) => shuffle(s, rng)) };
}
