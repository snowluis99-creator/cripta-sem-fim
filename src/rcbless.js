// Bênçãos COMUNS das 5 armas do Ladino (lista do dono, 11/11/2026). 10 por arma.
// Os efeitos ficam em rckit.js (combat.rc). Cada nível soma 1 na chave (stats.w.rc...).
// N1 / N2 / N3 = o que muda a cada nível; máx. 1 = não sobe de nível.
const pc = (v) => `${Math.round(v * 100)}%`;
const n1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

// Números de cada bênção por nível (lidos pelo kit).
export const RC = {
  // Duas Adagas
  encadeado: { per: [0.05, 0.1, 0.15], cap: 0.6 },      // +chance de crítico a cada crítico seguido (teto +60%)
  sequencia: [0.35, 0.7, 1.0],                           // 2º golpe: chance de sangramento
  rolar: { t: [3, 6, 9], crit: [0.35, 0.7, 1.05] },      // vulnerável: crítico; se já era crítico, +dano do crítico
  veneno: { dps: [2, 4, 6], t: 3, pass: 5 },             // críticos envenenam; morreu envenenado: passa para 1 perto
  primeiro: [0.35, 0.7, 1.0],                            // 1º golpe em cada inimigo: chance de crítico
  saida: [0.5, 1, 1.5],                                  // abate: fora da visão
  maos: [0.1, 0.15, 0.2],                                // crítico: chance de soltar poção (1 por inimigo)
  esquiva: { dmg: [5, 10, 15], r: 1.3, speed: 26 },      // rolar por dentro da flecha: adaga no atirador
  caca: [0, 0.3, 0.6],                                   // dano extra em magos (N2/N3)
  danca: 4,                                              // golpes seguidos sem tomar dano
  // Kunais
  explosiva: { n: 5, r: [1.6, 2.3, 3.0], mul: 0.5 },     // corrente ×5: explode (metade do dano da kunai)
  viva: [1, 2, 3],                                       // erros seguidos que não zeram a corrente
  gelada: { n: [3, 2, 1], t: 2.5 },                      // corrente mínima para deixar MUITO lento
  prego: [3, 2, 1],                                      // acertos no escudo para quebrar
  maldita: { r: 2.4, push: 5 },                          // kunai no chão afasta os inimigos
  mira: 1,                                               // 2 kunais no mesmo alvo em 1 s
  gemeas: { t: 1, mul: [0.35, 0.7, 1.0] },               // 2ª kunai em menos de 1 s
  assobio: [2, 4, 8],                                    // vezes por sala
  // Garras
  fervente: { min: 3, dps: [2, 4, 6] },                  // 3+ sangramentos: dano por segundo
  cheiro: [0.35, 0.7, 1.05],                             // ataque mais rápido contra quem sangra
  lambida: [2, 4, 6],                                    // abate de quem sangra: cura
  unhas: { n: 3, t: 1, crit: 1.0 },                      // 3 acertos seguidos: vulnerável por 1 s
  fera: { n: [1, 2, 3], r: 3 },                          // morreu sangrando: espalha sangramentos
  felino: 1.0,                                           // rolar por dentro: próximo ataque 100% mais rápido
  pelagem: { mul: 0.5, t: [5, 10, 15] },                 // tomar dano: golpes mais rápidos
  presa: [0.4, 0.8, 1.2],                                // dano em arqueiros e magos
  instinto: { back: 100, range: 7 },                     // aviso de ataque por trás
  // Rapieira
  luz: [0.5, 1, 2],                                      // rolar por dentro: o 1º perde você de vista
  duelista: { n: 3, t: [0.5, 1, 1.5] },                  // 3 acertos seguidos: desequilibra
  floreio: { mul: [0.5, 1, 1.5], t: 4 },                 // abate: mais rápido
  ponta: [0.35, 0.7, 1.0],                               // estocada passa pelo escudo
  contorno: { r: 2.4, gap: 0.45, inv: 0.5 },            // rolar ao lado: termina nas costas
  saudacao: { still: 1, mul: [0.5, 1, 2] },              // parado antes da 1ª onda: 1º golpe crítico e mais forte
  cicatriz: [0.02, 0.03, 0.05],                          // por abate com crítico (até sair da sala)
  esgrima: [0.15, 0.3, 0.5],                             // desviar durante a estocada
  toque: 0.3,                                            // vida abaixo de 30%: morre com a estocada
  // Besta de Mão
  tiro1: { mul: [0.5, 1, 2] },                           // Primeiro Tiro
  coleta: { win: 1, n: [2, 4, 8], mul: 2 },
  distante: { from: 5, per: [0.05, 0.1, 0.15] },
  farpa: [1, 2, 3],
  derrubada: { n: [1, 2, 3], len: 5, w: 1.4, t: 1.2 },
  teimoso: [0.15, 0.3, 0.5],
  duelo: [0.4, 0.8, 1.5],
  interromper: [1, 2, 3],
  ima: { dmg: 12, fall: 1.2, pullT: 0.28, segR: 2.2, holdT: 1 },
  brilho: { t: [1, 2, 3], r: 3, cd: 3 },
};
export const ABERTURA = [['minion'], ['minion', 'warrior', 'archer'], null]; // Estocada de Abertura: tipos por nível (N3 = todos)
export const CONTORNO = [['minion'], ['minion', 'warrior', 'archer'], null]; // Contorno: tipos por nível (N3 = todos)
export const lv = (arr, n) => arr[Math.min(arr.length, Math.max(1, n | 0)) - 1];
const L = (arr) => (n) => lv(arr, n);

// b(arma, id, nome, ícone, raridade, máximo, texto(n), efeito(s))
export function addRogueCommon(b, add) {
  const k = (key) => (s) => add(s, key, 1);
  let W = 'rogue.adagas';
  b(W, 'rca1', 'Crítico Encadeado', '⛓', 'common', 3, (n) => `Cada crítico soma +${pc(L(RC.encadeado.per)(n))} de chance de crítico para o próximo golpe (até +60%). O golpe que não é crítico zera.`, k('rcEncad'));
  b(W, 'rca2', 'Sequência Mortal', '♦', 'common', 3, (n) => `O 2º golpe do combo tem ${pc(L(RC.sequencia)(n))} de chance de causar sangramento.`, k('rcSeq'));
  b(W, 'rca3', 'Rolar e Cortar', '↷', 'common', 3, (n) => `Rolar atravessando um inimigo deixa o primeiro atravessado vulnerável por ${L(RC.rolar.t)(n)} s: todo golpe nele é crítico, e o que já ia ser crítico causa +${pc(L(RC.rolar.crit)(n))} de dano.`, k('rcRolar'));
  b(W, 'rca4', 'Veneno Fraco', '∿', 'common', 3, (n) => `Críticos envenenam: ${L(RC.veneno.dps)(n)} de dano por segundo por 3 s. Se o inimigo morrer envenenado, o veneno passa para outro perto.`, k('rcVeneno'));
  b(W, 'rca5', 'Primeiro Sangue', '✚', 'common', 3, (n) => `O 1º golpe em cada inimigo tem ${pc(L(RC.primeiro)(n))} de chance de ser crítico.`, k('rcPrimeiro'));
  b(W, 'rca6', 'Corte de Saída', '◌', 'common', 3, (n) => `Derrotar um inimigo te deixa fora da visão dos inimigos por ${n1(L(RC.saida)(n))} s.`, k('rcSaida'));
  b(W, 'rca7', 'Mãos Ladras', '⚱', 'common', 3, (n) => `Críticos têm ${pc(L(RC.maos)(n))} de chance de fazer o inimigo soltar uma poção (no máximo 1 por inimigo).`, k('rcMaos'));
  b(W, 'rca8', 'Esquiva Afiada', '➶', 'common', 3, (n) => `Rolar por dentro de uma flecha joga uma adaga no atirador (${L(RC.esquiva.dmg)(n)} de dano).`, k('rcEsquiva'));
  b(W, 'rca9', 'Caça-Magos', '✦', 'common', 3, (n) => `O golpe em mago esqueleto é sempre crítico e interrompe a magia${n > 1 ? ` (+${pc(RC.caca[n - 1])} de dano)` : ''}.`, k('rcCaca'));
  b(W, 'rca10', 'Dança Curta', '♫', 'common', 1, () => '4 golpes seguidos sem tomar dano fazem o 5º golpe ser de novo o golpe forte.', k('rcDanca'));

  W = 'rogue.kunai';
  b(W, 'rck1', 'Corrente Explosiva', '✹', 'common', 3, (n) => `A kunai com corrente ×5 ou mais explode ao acertar, sem perder a corrente (área ${['pequena', 'média', 'grande'][n - 1]}).`, k('rcExplo'));
  b(W, 'rck2', 'Pegada Rápida', '✋', 'common', 1, () => 'Pegar a kunai no ar dá +1 na corrente dela.', k('rcPegada'));
  b(W, 'rck3', 'Corrente Viva', '⛓', 'common', 3, (n) => `A corrente não zera no ${['1º erro', '1º e no 2º erro seguidos', '1º, no 2º e no 3º erro seguidos'][n - 1]} (kunai que não acerta ninguém).`, k('rcViva'));
  b(W, 'rck4', 'Kunai Gelada', '❄', 'common', 3, (n) => `Kunais com corrente ×${L(RC.gelada.n)(n)} ou mais deixam o inimigo MUITO lento por 2,5 s.`, k('rcGelada'));
  b(W, 'rck5', 'Prego no Escudo', '⊣', 'common', 3, (n) => `A kunai que acerta um escudo fica cravada nele até você buscar. ${n === 3 ? 'Acertar um escudo 1 vez' : `Acertar o mesmo escudo ${L(RC.prego)(n)} vezes`} quebra o escudo.`, k('rcPrego'));
  b(W, 'rck6', 'Adaga Amaldiçoada', '☠', 'common', 1, () => 'Kunais caídas no chão soltam maldições que afastam os inimigos de perto delas até você pegar.', k('rcMaldita'));
  b(W, 'rck7', 'Mira Treinada', '⌖', 'common', 1, () => 'Acertar duas kunais no mesmo alvo em menos de 1 s: a segunda sempre é crítica.', k('rcMira'));
  b(W, 'rck8', 'Lâminas Gêmeas', '⚔', 'common', 3, (n) => `Duas kunais arremessadas em menos de 1 s: a 2ª causa +${pc(L(RC.gemeas.mul)(n))} de dano.`, k('rcGemeas'));
  b(W, 'rck9', 'Assobio', '♪', 'common', 3, (n) => `${L(RC.assobio)(n)} vezes por sala, rolar sem nenhuma kunai na mão faz um assobio, e todas as suas kunais voltam voando para você.`, k('rcAssobio'));
  b(W, 'rck10', 'Estoque Escondido', '✧', 'common', 1, () => 'No começo de cada sala você ganha 1 kunai extra, que some assim que a corrente dela zerar.', k('rcEstoque'));

  W = 'rogue.garras';
  b(W, 'rcg1', 'Sangue Fervente', '♨', 'common', 3, (n) => `Inimigos com 3 ou mais sangramentos levam ${L(RC.fervente.dps)(n)} de dano a mais por segundo.`, k('rcFervente'));
  b(W, 'rcg2', 'Rasgo Final', '✠', 'common', 1, () => 'O 5º golpe do combo é sempre crítico.', k('rcRasgo'));
  b(W, 'rcg3', 'Cheiro de Sangue', '≋', 'common', 3, (n) => `Você ataca ${pc(L(RC.cheiro)(n))} mais rápido contra inimigos sangrando.`, k('rcCheiro'));
  b(W, 'rcg4', 'Lambida', '♥', 'common', 3, (n) => `Derrotar um inimigo sangrando cura ${L(RC.lambida)(n)} de vida.`, k('rcLambida'));
  b(W, 'rcg5', 'Unhas Grudentas', '⁂', 'common', 1, () => '3 acertos seguidos no mesmo inimigo o deixam vulnerável por 1 s: o próximo golpe nele gasta a marca e é crítico (se já fosse crítico, causa +100% de dano).', k('rcUnhas'));
  b(W, 'rcg6', 'Marca da Fera', '☫', 'common', 3, (n) => `O inimigo sangrando que morre espalha ${n} sangramento${n > 1 ? 's' : ''} em quem estiver perto.`, k('rcFera'));
  b(W, 'rcg7', 'Salto Felino', '⤴', 'common', 1, () => 'Rolar por dentro de um inimigo deixa o próximo ataque 100% mais rápido.', k('rcFelino'));
  b(W, 'rcg8', 'Pelagem Arrepiada', '☀', 'common', 3, (n) => `Tomar dano deixa os golpes 50% mais rápidos por ${L(RC.pelagem.t)(n)} s.`, k('rcPelagem'));
  b(W, 'rcg9', 'Presa Fácil', '➹', 'common', 3, (n) => `+${pc(L(RC.presa)(n))} de dano em arqueiros e magos.`, k('rcPresa'));
  b(W, 'rcg10', 'Instinto', '!', 'common', 1, () => 'Um ponto de exclamação aparece quando um inimigo vai atacar você por trás, e o próximo golpe nele é crítico.', k('rcInstinto'));

  W = 'rogue.rapieira';
  b(W, 'rcr1', 'Estocada de Abertura', '†', 'common', 3, (n) => `A 1ª estocada em ${['lacaios', 'lacaios, guerreiros e arqueiros', 'qualquer inimigo'][n - 1]} com a vida cheia é crítica.`, k('rcAbertura'));
  b(W, 'rcr2', 'Velocidade da Luz', '☄', 'common', 3, (n) => `Rolar por dentro de um inimigo faz o primeiro atravessado perder você de vista por ${n1(L(RC.luz)(n))} s (chefes não).`, k('rcLuz'));
  b(W, 'rcr3', 'Marca do Duelista', '⚜', 'common', 3, (n) => `3 acertos seguidos no mesmo inimigo o desequilibram por ${n1(L(RC.duelista.t)(n))} s.`, k('rcDuelista'));
  b(W, 'rcr4', 'Floreio', '❧', 'common', 3, (n) => `Derrotar um inimigo deixa você ${pc(L(RC.floreio.mul)(n))} mais rápido por 4 s.`, k('rcFloreio'));
  b(W, 'rcr5', 'Ponta Fina', '⌁', 'common', 3, (n) => `${pc(L(RC.ponta)(n))} de chance de a estocada passar pelo escudo.`, k('rcPonta'));
  b(W, 'rcr6', 'Contorno', '↺', 'common', 3, (n) => [
    'Rolar ao lado de um lacaio termina nas costas dele.',
    'Rolar ao lado de um lacaio, guerreiro ou arqueiro termina nas costas dele.',
    'Rolar ao lado de qualquer inimigo termina nas costas dele, e você fica 0,5 s sem tomar dano ao aterrissar.'][n - 1], k('rcContorno'));
  b(W, 'rcr7', 'Saudação', '⚐', 'common', 3, (n) => `Ficar parado 1 s antes da 1ª onda da sala deixa o seu 1º golpe crítico e +${pc(L(RC.saudacao.mul)(n))} mais forte.`, k('rcSaudacao'));
  b(W, 'rcr8', 'Cicatriz', '✗', 'common', 3, (n) => `Cada inimigo derrotado com crítico dá +${pc(L(RC.cicatriz)(n))} de chance de crítico até você sair da sala.`, k('rcCicatriz'));
  b(W, 'rcr9', 'Esgrima Defensiva', '⛉', 'common', 3, (n) => `Durante a estocada, ${pc(L(RC.esgrima)(n))} de chance de desviar dos golpes.`, k('rcEsgrima'));
  b(W, 'rcr10', 'Toque Final', '☠', 'common', 1, () => 'O inimigo comum com menos de 30% da vida morre com qualquer estocada.', k('rcToque'));

  W = 'rogue.besta';
  b(W, 'rcb1', 'Primeiro Tiro', '①', 'common', 3, (n) => `O 1º tiro de cada sala é crítico e causa +${pc(L(RC.tiro1.mul)(n))} de dano.`, k('rcTiro1'));
  b(W, 'rcb2', 'Coleta Ligeira', '⇡', 'common', 3, (n) => `Pegar o virote em até 1 s depois que ele cair faz o próximo tiro sair 100% mais rápido (${L(RC.coleta.n)(n)} vezes por sala).`, k('rcColeta'));
  b(W, 'rcb3', 'Tiro Distante', '⟶', 'common', 3, (n) => `O dano sobe com a distância: +${pc(L(RC.distante.per)(n))} por metro acima de 5 m.`, k('rcDistante'));
  b(W, 'rcb4', 'Farpa', '♦', 'common', 3, (n) => `O virote soma ${n} sangramento${n > 1 ? 's' : ''}.`, k('rcFarpa'));
  b(W, 'rcb5', 'Derrubada', '⤓', 'common', 3, (n) => `O inimigo acertado pelo virote derruba ${n} inimigo${n > 1 ? 's' : ''} que estiver${n > 1 ? 'em' : ''} logo atrás dele.`, k('rcDerruba'));
  b(W, 'rcb6', 'Virote Teimoso', '↩', 'common', 3, (n) => `O virote que acerta tem ${pc(L(RC.teimoso)(n))} de chance de voltar direto para a mão.`, k('rcTeimoso'));
  b(W, 'rcb7', 'Duelo de Besteiros', '⚔', 'common', 3, (n) => `+${pc(L(RC.duelo)(n))} de dano em arqueiros esqueletos.`, k('rcDuelo'));
  b(W, 'rcb8', 'Interromper', '✋', 'common', 3, (n) => `O virote cancela a magia do mago e o deixa sem lançar magia por ${n} s.`, k('rcInterr'));
  b(W, 'rcb9', 'Virote Magnético', '⊕', 'common', 1, () => 'Os tiros marcam onde acertam, um com + e o seguinte com −. A cada 2 tiros os ímãs ligam: 2 inimigos marcados se atraem, batem um no outro e caem; inimigo e parede: ele voa até a parede e cai; 2 paredes: quem estiver entre elas é puxado para o meio por 1 s.', k('rcIma'));
  b(W, 'rcb10', 'Virote Brilhante', '✺', 'common', 3, (n) => `O virote caído brilha e cega os inimigos perto por ${n} s. Cegos andam e atacam para qualquer lado, e podem acertar outros inimigos (chefes não).`, k('rcBrilho'));
}
