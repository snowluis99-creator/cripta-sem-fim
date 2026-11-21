// Bênçãos ÉPICAS, lote 1 (lista do dono, 11/11/2026 — Bencaos_Epicas_Pendentes.md):
// Manopla (1), Machado (2), Mangual (2), Lança (2), Cajado de Gelo (1). Os efeitos ficam em e1kit.js (combat.e1).
// Todas máx. 1. Cada uma liga uma chave em stats.w (e1...).
const pc = (v) => `${Math.round(v * 100)}%`;

// Números de cada bênção (lidos pelo kit).
export const E1 = {
  // Manopla: Levante pelos que acreditam em você
  levante: { time: 5, need0: 14, needAdd: 8, dmg: 0.25, spd: 0.25, inv: 2 }, // apertos pedidos: 14, 22, 30, 38...
  // Machado
  lenhador: { hits: 20, time: 5, spd: 1.5, move: 0.75 },      // Lenhador Obstinado: +150% de velocidade
  gigante: { per: 0.05, max: 10, hp: 5, spd: 0.03 },          // Sangue de Gigante: +5% por abate (até +50%), +5 de vida, -3% de velocidade
  // Mangual
  newton: { width: 1.15, gap: 3.2, max: 6, fly: 16, speed: 26 }, // Berço de Newton: fila de inimigos
  meteoro: { kills: 20, spin: 0.85, up: 0.55, aim: 2.6, fall: 0.6, land: 0.45, r: 3.6, boss: 0.25, aimSpeed: 11 },
  // Lança
  chute: { delay: 0.12, kick: 0.42, back: 1.5, pit: 1.15, under: 2, hp: 0.3 }, // Chute Espartano
  macaco: { hold: 0.14, grow: 1.35, max: 4, mul: 1.5, spin: 0.55, move: 0.35 }, // Bastão do Rei Macaco
  // Cajado de Gelo
  yeti: { need: 4, dmg: 34, speed: 9, jump: 0.95, hitR: 2.1, cd: 3, scale: 1.75 }, // Gelo Ancestral
};

// b(arma, id, nome, ícone, raridade, máximo, texto(n), efeito(s))
export function addEpicLote1(b, add) {
  const k = (key) => (s) => add(s, key, 1);
  let W = 'knight.manopla';
  b(W, 'e1m1', 'Levante pelos que acreditam em você', '✊', 'epic', 1, () => `Toda vez que você morrer, a tela fica preta e aparece o botão de ataque: aperte sem parar por ${E1.levante.time} s. Se conseguir, você levanta com metade da vida, +${pc(E1.levante.dmg)} de dano e +${pc(E1.levante.spd)} de velocidade de ataque (acumula). A cada morte o desafio fica mais difícil.`, k('e1Levante'));

  W = 'knight.machado';
  b(W, 'e1a1', 'Lenhador Obstinado', '♨', 'epic', 1, () => `A cada ${E1.lenhador.hits} acertos do 1º golpe do combo, o Cavaleiro pisca em vermelho e solta fumaça: fica imune a dano por ${E1.lenhador.time} s e dá o 1º golpe sem parar, +${pc(E1.lenhador.spd)} mais rápido. Nesse modo você só anda para mirar.`, k('e1Lenhador'));
  b(W, 'e1a2', 'Sangue de Gigante', '⛰', 'epic', 1, () => `Cada abate deixa o Cavaleiro ${pc(E1.gigante.per)} maior (até +${pc(E1.gigante.per * E1.gigante.max)}), com mais alcance, mais dano e mais vida, porém golpes mais lentos. Cada golpe recebido o faz encolher um pouco.`, k('e1Gigante'));

  W = 'knight.mangual';
  b(W, 'e1f1', 'Berço de Newton', '⚖', 'epic', 1, () => 'O golpe forte numa fila de inimigos não mexe o primeiro: só o último da fila voa longe, com o dano somado da fila inteira.', k('e1Newton'));
  b(W, 'e1f2', 'Meteoro', '☄', 'epic', 1, () => `Depois de ${E1.meteoro.kills} inimigos derrotados, você gira o mangual e voa para fora da tela. Volta montado numa bola gigante pegando fogo: mova o círculo para escolher onde cair. Os inimigos tentam fugir; quem for atingido morre (chefes perdem ${pc(E1.meteoro.boss)} da vida máxima).`, k('e1Meteoro'));

  W = 'knight.lanca';
  b(W, 'e1l1', 'Chute Espartano', '↯', 'epic', 1, () => `Depois da estocada forte, um chute abre um poço atrás do inimigo. Lacaios caem e somem; os outros sobem de volta ${E1.chute.under} s depois com ${pc(E1.chute.hp)} da vida a menos (chefes só são empurrados).`, k('e1Chute'));
  b(W, 'e1l2', 'Bastão do Rei Macaco', '⟿', 'epic', 1, () => `Segure o ataque: a lança cresce até ${E1.macaco.max}× o tamanho. Ao soltar, ela varre a sala inteira (só funciona se chegar a ${E1.macaco.max}×).`, k('e1Macaco'));

  W = 'mage.gelo';
  b(W, 'e1g1', 'Gelo Ancestral', '❄', 'epic', 1, () => `Com ${E1.yeti.need} inimigos congelados ao mesmo tempo, um Yeti aparece na escuridão fora da sala, pula a parede e entra. Ele ataca só os congelados e vai embora quando não sobrar nenhum.`, k('e1Yeti'));
}

// Não vêm juntas: o Chute sai da estocada forte normal; estas trocam o golpe forte da Lança.
export const E1_EXCLUDES = {
  w_e1l1: ['w_lan16', 'w_lan17', 'w_lan18', 'w_lan21'],
  w_lan16: ['w_e1l1'], w_lan17: ['w_e1l1'], w_lan18: ['w_e1l1'], w_lan21: ['w_e1l1'],
};
