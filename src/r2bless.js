// Bênçãos RARAS, lote 2 (lista do dono, 11/11/2026 — Bencaos_Raras_Pendentes.md):
// Rapieira (3), Cajado de Fogo (2), Manopla (4), Cajado Arcano (1), Duas Adagas (1). Os efeitos ficam em r2kit.js (combat.r2).
// Cada nível soma 1 na chave (stats.w.r2...).
const pc = (v) => `${Math.round(v * 100)}%`;

// Números de cada bênção (lidos pelo kit).
export const R2 = {
  // Rapieira
  dedos: [0.5, 1.0],                              // Estocada de 3 Dedos: chance de virar de costas
  engarde: { gap: 1.6 },                          // En Garde: tempo máximo entre os golpes do combo
  leveza: { move: 2, roll: 2 },                   // Leveza: velocidade e distância da rolagem
  // Cajado de Fogo
  ar: { r: 2.6, cd: 10, cdHot: 5, hot: 3 },       // Ar Quente: raio, recarga, recarga com 3+ queimando
  ardente: { dps: 4, t: 3 },                      // Defesa Ardente: queimadura do tiro rebatido
  // Manopla
  jab: { dmg: 6, hit: 0.08, cd: 0.32, range: 2.0, arc: 90 }, // Jab de Guarda
  ging: { dist: 2.4, time: 0.16, cd: 0.05, keep: 0.9 },      // Gingado: passinho lateral; o combo fica guardado 0,9 s
  clinch: { gap: 1.0, max: 2 },                   // Clinch: socos com no máximo 1 s entre eles; até 2 s
  round: { below: 0.25, inv: 2 },                 // Segundo Round
  // Cajado Arcano
  agil: { cancel: 0.35 },                         // Conjuração Ágil: depois de 35% da rolagem já pode atirar
  // Duas Adagas
  prof: { speed: 26, range: 16, pick: 1.7, punch: 5 }, // Proficiência
};
export const lv = (arr, n) => arr[Math.min(arr.length, Math.max(1, n | 0)) - 1];

// b(arma, id, nome, ícone, raridade, máximo, texto(n), efeito(s))
export function addRareLote2(b, add) {
  const k = (key) => (s) => add(s, key, 1);
  let W = 'rogue.rapieira';
  b(W, 'r2r1', 'Estocada de 3 Dedos', '✋', 'rare', 2, (n) => `A 1ª estocada do combo tem ${pc(lv(R2.dedos, n))} de chance de virar o inimigo de costas.`, k('r2Dedos'));
  b(W, 'r2r2', 'En Garde', '⚔', 'rare', 1, () => 'Acertar os 3 golpes do combo no mesmo inimigo desarma ele, jogando a arma longe (chefes não).', k('r2Garde'));
  b(W, 'r2r3', 'Leveza', '❧', 'rare', 1, () => 'Sua velocidade de movimento e a distância da rolagem dobram.', k('r2Leve'));

  W = 'mage.fogo';
  b(W, 'r2f1', 'Ar Quente', '♨', 'rare', 1, () => `Flechas e magias que chegam perto da Maga derretem no ar, no máximo 1 a cada ${R2.ar.cd} s. Com ${R2.ar.hot} ou mais inimigos queimando na sala, 1 a cada ${R2.ar.cdHot} s.`, k('r2Ar'));
  b(W, 'r2f2', 'Defesa Ardente', '✹', 'rare', 1, () => 'Flechas e magias rebatidas pela barreira voltam pegando fogo e queimam quem acertarem.', k('r2Ardente'));

  W = 'knight.manopla';
  b(W, 'r2m1', 'Jab de Guarda', '✊', 'rare', 1, () => 'Atacar com o escudinho levantado solta um soco rápido sem baixar a guarda.', k('r2Jab'));
  b(W, 'r2m2', 'Gingado', '↔', 'rare', 1, () => 'Rolar vira um passinho lateral curto, quase sem recarga, que não quebra o combo.', k('r2Ging'));
  b(W, 'r2m3', 'Clinch', '⛓', 'rare', 1, () => `Enquanto você acerta socos seguidos no mesmo inimigo, ele não consegue atacar, por até ${R2.clinch.max} s (chefes não).`, k('r2Clinch'));
  b(W, 'r2m4', 'Segundo Round', '❷', 'rare', 1, () => `Uma vez por sala, quando a vida cai abaixo de ${pc(R2.round.below)}, você fica ${R2.round.inv} s invencível e o escudo volta cheio.`, k('r2Round'));

  W = 'mage.cajado';
  b(W, 'r2a1', 'Conjuração Ágil', '✧', 'rare', 1, () => 'A Maga anda na velocidade normal enquanto ataca e pode atirar logo depois de rolar.', k('r2Agil'));

  W = 'rogue.adagas';
  b(W, 'r2d1', 'Proficiência', '➶', 'rare', 1, () => 'Sem ninguém no alcance, o ataque arremessa uma adaga (dá para arremessar a outra também). Ela causa o dano de um golpe e fica cravada no inimigo que acertar: para recuperar, chegue perto dele ou role por dentro dele. Sem adagas, o Ladino bate com socos.', k('r2Prof'));
}

// Não vêm juntas.
export const R2_EXCLUDES = {
  w_r2m1: ['w_mnp13'], w_mnp13: ['w_r2m1'],     // Jab de Guarda x Escudo de Carne (as duas: atacar bloqueando)
  w_r2m2: ['w_kcp8'], w_kcp8: ['w_r2m2'],       // Gingado x Ringue (as duas mudam o rolamento)
};
