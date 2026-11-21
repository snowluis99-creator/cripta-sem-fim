// Bênçãos COMUNS das 5 armas do Cavaleiro (lista do dono, 11/11/2026). 10 por arma.
// Os efeitos ficam em kckit.js / kckit2.js (combat.kc). Cada nível soma 1 na chave (stats.w.kc...).
// N1 / N2 / N3 = o que muda a cada nível; máx. 1 = não sobe de nível.
const L = (arr) => (n) => arr[Math.min(arr.length, Math.max(1, n)) - 1];
const pc = (v) => `${Math.round(v * 100)}%`;

// Números de cada bênção por nível (lidos pelo kit).
export const KC = {
  // Espada e Escudo
  certeiro: [3, 2, 1],              // golpe forte crítico a cada N combos (1 = sempre)
  troco: [0.3, 0.6, 1.0],           // próximo combo depois de bloquear
  embalo: { spd: 0.2, t: 4 },       // por inimigo derrotado, até N vezes
  brasao: [3, 6, Infinity],         // bloqueios recuperados ao entrar na sala
  fio: [0.4, 0.8, 1.5],             // 3º golpe no mesmo inimigo dos 2 primeiros
  grito: { t: [1, 2, 3], r: 5 },    // medo em volta
  espelho: [0.25, 0.5, 1.0],        // chance de devolver a flecha bloqueada
  cacador: [0.4, 0.8, 1.2],         // dano em arqueiros e magos
  // Machado
  ventos: { n: 4, t: 2, h: 1.6 },   // giro que acerta 4 de uma vez: levanta por 2 s
  pesoMorto: [0.3, 0.4, 0.5],       // vida abaixo disso: arremessa longe
  lenhador: [0.3, 0.6, 1.0],        // próximo combo mais rápido depois de 2 abates no mesmo golpe
  surpresa: [0.35, 0.7, 1.05],      // 3º golpe mais rápido (ficha: spdH)
  abertura: [['minion'], ['minion', 'warrior', 'archer'], null], // null = todos
  rachador: [3, 2, 1],              // golpes para quebrar o escudo do guerreiro
  cabeca: { t: 5, mul: [0.5, 1.0, 2.0] },
  trofeu: [10, 7, 5],               // abates por carga extra da ultimate
  satisfacao: 3,                    // cura
  corte: { mul: 0.5, reach: 3.6 },
  // Mangual
  elo: { per: 0.05, max: [3, 6, 10] },
  bola: [0.4, 0.8, 1.5],
  badalo: { n: [5, 4, 3], t: 0.5, r: 4.2 },
  quente: [2, 4, 6],                // dano por segundo nos tontos
  calar: [2, 4, 6],                 // segundos sem magia
  consciencia: [1.6, 2.4, 3.4],     // raio de quem cai junto
  esquiva: { mul: [0.3, 0.6, 1.0], spd: 2.4, window: 1.0 },
  muralha: [3, 2, 1],
  loot: [0.2, 0.4, 0.7],
  divino: { chance: [0.35, 0.7, 1.0], dmg: 1, t: 0.5 },
  // Lança
  espeto: { mul: [0.3, 0.6, 1.0], reach: 3.5 },
  linha: { t: [3, 6, 9], mul: 0.25 },
  contra: [0.5, 1, 2],
  primeira: [0.25, 0.5, 1.0],
  determ: { range: 14, iframes: 1, speed: 26 },
  ferida: [3, 2, 1],
  gelado: { chance: [0.35, 0.7, 1.0], t: 1 },
  atiradores: [0.3, 0.6, 0.6],
  ponta: { per: [0.04, 0.06, 0.08], max: 5 },
  varredura: { mul: 0.5, r: 3.2 },
  // Manopla
  sequencia: { per: 0.05, max: [3, 6, 10] },
  nocaute: [0.15, 0.25, 0.35],
  cotovelada: [8, 14, 20],
  nos: [0.1, 0.2, 0.3],
  empurra: [4, 8, 12],
  ringue: { speed: 24, h: 2.2, after: 1 },
  campeao: { spd: [0.3, 0.5, 0.8], n: 3, win: 4, t: 3 },
};
export const lv = (arr, n) => arr[Math.min(arr.length, Math.max(1, n | 0)) - 1];

// b(arma, id, nome, ícone, raridade, máximo, texto(n), efeito(s))
export function addKnightCommon(b, add) {
  const k = (key) => (s) => add(s, key, 1);
  let W = 'knight.espada';
  b(W, 'kce1', 'Golpe Certeiro', '✪', 'common', 3, (n) => (n >= 3 ? 'O golpe forte é sempre crítico.' : `O golpe forte é crítico a cada ${KC.certeiro[n - 1]} combos.`), k('kcCerteiro'));
  b(W, 'kce2', 'Troco do Escudo', '⛉', 'common', 3, (n) => `Depois de bloquear, o próximo combo causa +${pc(L(KC.troco)(n))} de dano.`, k('kcTroco'));
  b(W, 'kce3', 'Embalo', '»', 'common', 3, (n) => `Cada inimigo derrotado deixa os golpes 20% mais rápidos por 4 s, acumulando até ${n} vez${n > 1 ? 'es' : ''}.`, k('kcEmbalo'));
  b(W, 'kce4', 'Brasão Restaurado', '⛨', 'common', 3, (n) => (n >= 3 ? 'Ao entrar numa sala nova, o escudo fica novo.' : `Ao entrar numa sala nova, o escudo recupera ${KC.brasao[n - 1]} bloqueios.`), k('kcBrasao'));
  b(W, 'kce5', 'Fio do Combo', '⚔', 'common', 3, (n) => `Se os 3 golpes do combo acertarem o mesmo inimigo, o 3º causa +${pc(L(KC.fio)(n))} de dano.`, k('kcFio'));
  b(W, 'kce6', 'Grito do Cavaleiro', '‼', 'common', 3, (n) => `Matar com o golpe forte assusta os inimigos em volta, que fogem por ${n} s.`, k('kcGrito'));
  b(W, 'kce7', 'Escudo Espelhado', '◐', 'common', 3, (n) => `Bloquear uma flecha tem ${pc(L(KC.espelho)(n))} de chance de mandá-la de volta.`, k('kcEspelho'));
  b(W, 'kce8', 'Caçador de Arqueiros', '➶', 'common', 3, (n) => `+${pc(L(KC.cacador)(n))} de dano em arqueiros e magos esqueletos.`, k('kcCacador'));

  W = 'knight.machado';
  b(W, 'kcm1', 'Aliado dos Ventos', '🌪', 'common', 1, () => 'O giro vira um redemoinho. Se ele acertar 4 inimigos de uma vez, eles são levantados por 2 s: ficam imóveis no ar e não machucam no esbarrão.', k('kcVentos'));
  b(W, 'kcm2', 'Peso Morto', '⤳', 'common', 3, (n) => `O golpe forte arremessa longe o inimigo que ficar com menos de ${pc(L(KC.pesoMorto)(n))} da vida, e ele derruba quem estiver no caminho (chefes não).`, k('kcPeso'));
  b(W, 'kcm3', 'Embalo do Lenhador', '»', 'common', 3, (n) => `Derrotar 2 inimigos com o mesmo golpe deixa o próximo combo ${pc(L(KC.lenhador)(n))} mais rápido.`, k('kcLenhador'));
  b(W, 'kcm4', 'Surpresa', '!', 'common', 3, (n) => `O 3º golpe sai ${pc(L(KC.surpresa)(n))} mais rápido.`, (s) => { add(s, 'kcSurpresa', 1); add(s, 'spdH', KC.surpresa[0]); });
  b(W, 'kcm5', 'Golpe de Abertura', '✪', 'common', 3, (n) => `O 1º golpe em inimigo de vida cheia é crítico: ${['lacaios', 'lacaios, guerreiros e arqueiros', 'todos (até chefes)'][n - 1]}.`, k('kcAbertura'));
  b(W, 'kcm6', 'Rachador', '⛏', 'common', 3, (n) => `Quebra o escudo do guerreiro em ${KC.rachador[n - 1]} golpe${n < 3 ? 's' : ''}.`, k('kcRachador'));
  b(W, 'kcm7', 'Cabeça Fria', '❄', 'common', 3, (n) => `5 s sem tomar dano deixam o próximo golpe forte +${pc(L(KC.cabeca.mul)(n))}.`, k('kcCabeca'));
  b(W, 'kcm8', 'Troféu de Ossos', '☠', 'common', 3, (n) => `A cada ${KC.trofeu[n - 1]} inimigos derrotados, a ultimate ganha 1 carga extra.`, k('kcTrofeu'));
  b(W, 'kcm9', 'Satisfação', '✚', 'common', 1, () => 'Acertar os 3 golpes do combo em pelo menos 1 inimigo cura 3 de vida.', k('kcSatisf'));
  b(W, 'kcm10', 'Corte Seguido', '⇶', 'common', 1, () => 'O golpe forte que derrota um inimigo continua e acerta o de trás com metade do dano.', k('kcCorte'));

  W = 'knight.mangual';
  b(W, 'kcf1', 'Elo Extra', '⛓', 'common', 3, (n) => `Cada golpe que acerta aumenta o alcance do próximo em +5%, até ${KC.elo.max[n - 1]} elos. Tomar dano zera.`, k('kcElo'));
  b(W, 'kcf2', 'Bola Pesada', '●', 'common', 3, (n) => `O golpe forte em inimigo atordoado causa +${pc(L(KC.bola)(n))} de dano.`, k('kcBola'));
  b(W, 'kcf3', 'Badalo', '🔔', 'common', 3, (n) => `A cada ${KC.badalo.n[n - 1]} acertos, o próximo golpe faz "DONG" e atordoa por 0,5 s quem estiver em volta.`, k('kcBadalo'));
  b(W, 'kcf4', 'Corrente Quente', '♨', 'common', 3, (n) => `Inimigos atordoados pelo mangual levam ${KC.quente[n - 1]} de dano por segundo enquanto estão tontos.`, k('kcQuente'));
  b(W, 'kcf5', 'Calar o Mago', '✖', 'common', 3, (n) => `Acertar um mago esqueleto cancela a magia dele e o deixa sem lançar magia por ${KC.calar[n - 1]} s.`, k('kcCalar'));
  b(W, 'kcf6', 'Peso na Consciência', '⤓', 'common', 3, (n) => `O inimigo derrotado pelo mangual cai e derruba quem estiver atrás (área ${['pequena', 'média', 'grande'][n - 1]}).`, k('kcConsc'));
  b(W, 'kcf7', 'Esquiva Pesada', '↻', 'common', 3, (n) => `O 1º golpe depois de rolar gira a bola em volta de você, muito mais rápido que um ataque comum, e causa ${pc(L(KC.esquiva.mul)(n))} do dano.`, k('kcEsquiva'));
  b(W, 'kcf8', 'Muralha Paciente', '▥', 'common', 3, (n) => `Bloquear ${KC.muralha[n - 1]} golpe${n < 3 ? 's' : ''} seguido${n < 3 ? 's' : ''} sem atacar faz o próximo golpe ser crítico e empurrar longe.`, k('kcMuralha'));
  b(W, 'kcf9', 'Lootear', '⚱', 'common', 3, (n) => `Inimigo que morre atordoado tem ${pc(L(KC.loot)(n))} de chance de soltar uma poção.`, k('kcLoot'));
  b(W, 'kcf10', 'Mangual Divino', '✺', 'common', 3, (n) => `${pc(L(KC.divino.chance)(n))} de chance de, no 3º golpe do combo, todos os inimigos no chão levarem 1 de dano e ficarem atordoados por 0,5 s.`, k('kcDivino'));

  W = 'knight.lanca';
  b(W, 'kcl1', 'Espeto Duplo', '⇉', 'common', 3, (n) => `A estocada atravessa e acerta quem estiver atrás com ${pc(L(KC.espeto.mul)(n))} do dano.`, k('kcEspeto'));
  b(W, 'kcl2', 'Manter a Linha', '▣', 'common', 3, (n) => `Os inimigos acertados ficam machucados (marcados) por ${KC.linha.t[n - 1]} s. Marcados recebem +25% de dano.`, k('kcLinha'));
  b(W, 'kcl3', 'Contra-Investida', '⟰', 'common', 3, (n) => `Acertar um guerreiro que está investindo para a investida e o deixa atordoado por ${String(KC.contra[n - 1]).replace('.', ',')} s.`, k('kcContra'));
  b(W, 'kcl4', 'Primeira Estocada', '✪', 'common', 3, (n) => `O 1º golpe de cada combo tem ${pc(L(KC.primeira)(n))} de chance de ser crítico.`, k('kcPrimeira'));
  b(W, 'kcl5', 'Determinação', '➹', 'common', 1, () => 'O 3º golpe sempre acerta um inimigo no alcance. Se não houver nenhum, você investe até o mais perto e o acerta com o 3º golpe (sem tomar dano por 1 s a partir da investida).', k('kcDeterm'));
  b(W, 'kcl6', 'Ferida Profunda', '✚', 'common', 3, (n) => `Acertar o mesmo inimigo ${KC.ferida[n - 1]} vez${n < 3 ? 'es' : ''} soma 1 de sangramento.`, k('kcFerida'));
  b(W, 'kcl7', 'Deus Gelado', '❄', 'common', 3, (n) => `O 2º golpe do combo tem ${pc(L(KC.gelado.chance)(n))} de chance de congelar o inimigo por 1 s.`, k('kcGelado'));
  b(W, 'kcl8', 'Caça-Atiradores', '➶', 'common', 3, (n) => (n >= 3 ? '+60% de dano em arqueiros e magos, e a estocada forte mata os que estiverem com menos da metade da vida.' : `+${pc(KC.atiradores[n - 1])} de dano em arqueiros e magos.`), k('kcAtiradores'));
  b(W, 'kcl9', 'Ponta de Troféu', '⟶', 'common', 3, (n) => `Cada abate na sala aumenta o alcance em +${pc(KC.ponta.per[n - 1])} até você sair dela (até 5 abates).`, k('kcPonta'));
  b(W, 'kcl10', 'Varredura', '⟷', 'common', 1, () => 'A estocada forte acerta também quem estiver dos lados, com metade do dano.', k('kcVarredura'));

  W = 'knight.manopla';
  b(W, 'kcp1', 'Um-Dois', '✌', 'common', 3, (n) => ['Se o 1º e o 2º soco acertarem o mesmo inimigo, o 2º é crítico.', 'Se o 1º e o 2º soco acertarem o mesmo inimigo, o 2º é crítico e desequilibra.', 'Se o 1º e o 2º soco acertarem o mesmo inimigo, o 2º é crítico e desequilibra, e o 3º também é crítico.'][n - 1], k('kcUmDois'));
  b(W, 'kcp2', 'Sequência', '≡', 'common', 3, (n) => `Cada combo completo (os 4 golpes acertando) dá +5% de dano até sair da sala, até ${KC.sequencia.max[n - 1]} vezes.`, k('kcSeq'));
  b(W, 'kcp3', 'Esquiva de Boxe', '↶', 'common', 3, (n) => ['Rolar perto de um inimigo que está atacando deixa o próximo soco crítico.', 'Rolar perto de um inimigo que está atacando deixa o próximo soco crítico e cura 3.', 'Rolar perto de um inimigo que está atacando deixa o próximo soco crítico, cura 3 e atordoa.'][n - 1], k('kcBoxe'));
  b(W, 'kcp4', 'Nocaute', '✊', 'common', 3, (n) => `O golpe forte arremessa e derrota o inimigo comum que ficar com menos de ${pc(KC.nocaute[n - 1])} da vida.`, k('kcNocaute'));
  b(W, 'kcp5', 'Cotovelada', '↩', 'common', 3, (n) => `Ser acertado por trás dispara uma cotovelada automática de ${KC.cotovelada[n - 1]} de dano.`, k('kcCotovelo'));
  b(W, 'kcp6', 'Sangue nos Nós', '♥', 'common', 3, (n) => `Cada inimigo derrotado enche ${pc(KC.nos[n - 1])} de uma barra. Cheia, o próximo golpe forte causa o dobro.`, k('kcNos'));
  b(W, 'kcp7', 'Empurra-Empurra', '⇄', 'common', 3, (n) => `Inimigos empurrados pelo soco que batem em outros causam ${KC.empurra[n - 1]} de dano em ambos.`, k('kcEmpurra'));
  b(W, 'kcp8', 'Ringue', '▢', 'common', 1, () => 'Rolar contra uma parede te joga até a parede do outro lado (sem tomar dano no trajeto nem por 1 s ao aterrissar).', k('kcRingue'));
  b(W, 'kcp9', 'Campeão', '♛', 'common', 3, (n) => `Derrotar 3 inimigos em 4 s deixa os socos ${pc(KC.campeao.spd[n - 1])} mais rápidos por 3 s.`, k('kcCampeao'));
  b(W, 'kcp10', 'Gancho de Esquerda', '↪', 'common', 1, () => 'O chute (3º golpe) puxa o inimigo para perto em vez de empurrar, para emendar o golpe forte.', k('kcGancho'));
}
