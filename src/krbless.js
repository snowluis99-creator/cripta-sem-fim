// Bênçãos RARAS do Cavaleiro (lista do dono, 11/11/2026 — Bencaos_Raras_Pendentes.md, lote 1):
// Espada e Escudo (6), Mangual e Escudo (3), Lança de Duas Mãos (2). Os efeitos ficam em krkit.js (combat.kr).
// Cada nível soma 1 na chave (stats.w.kr...).
const pc = (v) => `${Math.round(v * 100)}%`;

// Números de cada bênção (lidos pelo kit).
export const KR = {
  // Espada e Escudo
  passo: 0.5,                                   // velocidade andando com o escudo levantado (× a normal)
  invest: { dist: 7, speed: 24, stun: 3, bossStun: 1, reach: 0.5 }, // Investida de Escudo
  total: { win: 1, n: 2, stun: 2, bossStun: 1 }, // Guarda Total: 2 bloqueios em 1 s = escudo no chão
  adapt: { dmg: 0.5, spd: 0.5 },                // Adaptação: sem escudo
  postura: 0.35,                                // Postura Firme: chance no golpe forte
  // Mangual e Escudo
  bolaG: { r: 1.6, hit: 0.55, dmg: 7, cd: 0.9, daze: 0.5, push: 7, swing: 1.25, speed: 5 }, // Bola de Guarda
  ancora: { tap: 0.25, full: 1.5, d0: 5, d1: 16, speed: 30, back: 34, dmg: 13, extra: 1.5 }, // Âncora de Ferro
  inesp: [0.5, 1.0],                            // Ataque Inesperado: chance do 1º golpe girar 360°
  // Lança de Duas Mãos
  cabo: { cd: 3, dmg: 4, reach: 5.0, gap: 0.45 }, // Cabo de Guarda
  recuem: { below: 0.5, iframes: 1.0, dmg: 6, spin: 0.7 }, // Recuem!
};
export const lv = (arr, n) => arr[Math.min(arr.length, Math.max(1, n | 0)) - 1];

// b(arma, id, nome, ícone, raridade, máximo, texto(n), efeito(s))
export function addKnightRare(b, add) {
  const k = (key) => (s) => add(s, key, 1);
  let W = 'knight.espada';
  b(W, 'kre1', 'Passo de Guarda', '⛉', 'rare', 1, () => 'Você pode andar com o escudo levantado.', k('krPasso'));
  b(W, 'kre2', 'Investida de Escudo', '➠', 'rare', 1, () => `Rolar com o escudo levantado vira um avanço com o escudo na frente: segura as flechas no caminho e atordoa o 1º inimigo por ${KR.invest.stun} s (gasta 1 carga do escudo).`, k('krInvest'));
  b(W, 'kre3', 'Guarda Total', '◎', 'rare', 1, () => `O escudo bloqueia golpes de qualquer lado. Bloquear ${KR.total.n} ou mais ataques dentro de 1 s faz você bater o escudo no chão e atordoar a sala inteira por ${KR.total.stun} s.`, k('krTotal'));
  b(W, 'kre4', 'Adaptação', '⚔', 'rare', 1, () => `Quando o escudo é destruído, você ganha +${pc(KR.adapt.dmg)} de dano e +${pc(KR.adapt.spd)} de velocidade de ataque enquanto estiver sem o escudo.`, k('krAdapt'));
  b(W, 'kre5', 'Resposta Rápida', '⚡', 'rare', 1, () => 'Em cada onda, na 1ª vez que você receberia dano, o Cavaleiro bloqueia sozinho (gasta 1 carga do escudo; sem carga, não funciona).', k('krResp'));
  b(W, 'kre6', 'Postura Firme', '⛨', 'rare', 1, () => `Todo golpe forte tem ${pc(KR.postura)} de chance de restaurar 1 carga do escudo.`, k('krPostura'));

  W = 'knight.mangual';
  b(W, 'krf1', 'Bola de Guarda', '◉', 'rare', 1, () => 'Enquanto você bloqueia, a bola gira atrás de você e acerta quem chega pelas costas.', k('krBolaG'));
  b(W, 'krf2', 'Âncora de Ferro', '⚓', 'rare', 1, () => 'Enquanto bloqueia, segure o ataque para carregar um lançamento da bola: quanto mais tempo, mais longe ela vai. Ela segue em frente até acertar o 1º inimigo.', k('krAncora'));
  b(W, 'krf3', 'Ataque Inesperado', '↻', 'rare', 2, (n) => `O 1º golpe tem ${pc(lv(KR.inesp, n))} de chance de virar um ataque de 360°, com o mesmo alcance.`, k('krInesp'));

  W = 'knight.lanca';
  b(W, 'krl1', 'Cabo de Guarda', '⊸', 'rare', 1, () => `Quem encosta em você leva uma pancada com o cabo e volta para a distância da ponta da lança (no máximo a cada ${KR.cabo.cd} s).`, k('krCabo'));
  b(W, 'krl2', 'Recuem!', '❂', 'rare', 1, () => 'Uma vez por sala, ao receber um golpe que te deixe com menos de 50% da vida, você gira a lança tão rápido que todos os inimigos da sala são jogados até as paredes.', k('krRecuem'));
}

// Não vêm juntas (as duas usam rolar com o escudo levantado / atacar bloqueando).
export const KR_EXCLUDES = {
  w_kre2: ['w_esp21', 'w_esp29'],            // Investida de Escudo x Trenó de Escudo / Cavalo Fantasma
  w_esp21: ['w_kre2'], w_esp29: ['w_kre2'],
  w_krf2: ['w_man25', 'w_man12'],            // Âncora de Ferro x Sino da Catedral / Equilíbrio
  w_man25: ['w_krf2'], w_man12: ['w_krf2'],
};
