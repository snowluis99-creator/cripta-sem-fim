// Bênçãos ÉPICAS, lote 2 (lista do dono, 11/11/2026 — Bencaos_Epicas_Pendentes.md): as 8 do Ladino.
// Duas Adagas (1), Kunais (1), Garras (2), Rapieira (2), Besta de Mão (2). Os efeitos ficam em e2kit.js (combat.e2).
// Todas máx. 1. Cada uma liga uma chave em stats.w (e2...).
const pc = (v) => `${Math.round(v * 100)}%`;

// Números de cada bênção (lidos pelo kit).
export const E2 = {
  // Duas Adagas: Disfarce (o 1º golpe disfarçado: ×3; revela o Ladino)
  disfarce: { mul: 3, refresh: 0.35, lost: 0.9 },
  // Kunais: Tempo de Bala (2 kunais pegas no ar em até 1,5 s -> mundo a 25% por 5 s)
  bala: { window: 1.5, time: 5, scale: 0.25 },
  // Garras: Lua Cheia (20 abates) e Regeneração (devolve o dano em 60 s)
  lua: { kills: 20, time: 8, scale: 1.3, move: 1.35, atk: 1.35, heal: 3, fearR: 10 },
  regen: { time: 60 },
  // Rapieira: Destruição (marcou todos -> ataque pelas costas em cada um) e Ponto Vital (2 críticos = execução)
  destruicao: { min: 2, mul: 2.5, gap: 0.42, strike: 0.16, daze: 1.2 },
  vital: { crits: 2, boss: 0.1 },
  // Besta: Sniper (20 abates -> em cima da parede, X vermelho, 8 s por alvo) e Flecha do Cupido (2 tiros, 2 inimigos)
  sniper: { kills: 20, time: 8, cd: 0.5, r: 0.9, aimSpeed: 13, jump: 0.45, wallH: 4 },
  cupido: { dmg: 1.5, hp: 1.5 },
};

// b(arma, id, nome, ícone, raridade, máximo, texto(n), efeito(s))
export function addEpicLote2(b, add) {
  const k = (key) => (s) => add(s, key, 1);
  let W = 'rogue.adagas';
  b(W, 'e2d1', 'Disfarce', '☠', 'epic', 1, () => `Ao derrotar um esqueleto, você veste o crânio dele e os inimigos te ignoram (chefes não se enganam). O 1º golpe disfarçado causa ${E2.disfarce.mul}× o dano e revela você. Uma vez por onda.`, k('e2Disfarce'));

  W = 'rogue.kunai';
  b(W, 'e2k1', 'Tempo de Bala', '⌛', 'epic', 1, () => `Pegar as duas kunais no ar em até ${E2.bala.window} s deixa o mundo em câmera lenta por ${E2.bala.time} s, menos você e as suas kunais. No máximo uma vez por onda.`, k('e2Bala'));

  W = 'rogue.garras';
  b(W, 'e2g1', 'Lua Cheia', '☾', 'epic', 1, () => `Uma lua aparece no canto da tela e sobe a cada abate. Com ${E2.lua.kills} abates ela chega ao topo e o Ladino vira fera por ${E2.lua.time} s: maior, mais rápido, cura a cada golpe, e os inimigos fogem dele (chefes não).`, k('e2Lua'));
  b(W, 'e2g2', 'Regeneração', '✚', 'epic', 1, () => `Ao receber dano, você recupera exatamente o dano sofrido ao longo de ${E2.regen.time / 60 === 1 ? '1 minuto' : `${E2.regen.time} s`}.`, k('e2Regen'));

  W = 'rogue.rapieira';
  b(W, 'e2r1', 'Destruição', '✠', 'epic', 1, () => 'Em cada onda, atacar um inimigo o marca. Ao marcar todos os inimigos da sala, o Ladino some e ataca todos pelas costas, um por um, sumindo e aparecendo.', k('e2Destruicao'));
  b(W, 'e2r2', 'Ponto Vital', '✛', 'epic', 1, () => `${E2.vital.crits} críticos no mesmo inimigo o executam (chefes perdem ${pc(E2.vital.boss)} da vida máxima).`, k('e2Vital'));

  W = 'rogue.besta';
  b(W, 'e2b1', 'Sniper', '⌖', 'epic', 1, () => `A cada ${E2.sniper.kills} inimigos derrotados, antes da próxima onda o Ladino pula em cima de uma parede: lá ninguém te vê nem te acerta. Mova a mira vermelha: um inimigo ganha um X na cabeça e você tem ${E2.sniper.time} s para derrubá-lo. Conseguiu, o X passa para outro; o tempo acabou, você desce.`, k('e2Sniper'));
  b(W, 'e2b2', 'Flecha do Cupido', '♥', 'epic', 1, () => 'Acertar dois inimigos diferentes em 2 tiros seguidos (sem errar) faz os dois se apaixonarem: ficam mais fortes e lutam contra todos os outros inimigos até só sobrarem os dois. Aí partem para cima de você.', k('e2Cupido'));
}

// Não vêm juntas: nenhuma por enquanto.
export const E2_EXCLUDES = {};
