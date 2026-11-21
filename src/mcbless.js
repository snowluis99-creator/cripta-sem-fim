// Bênçãos COMUNS dos 5 cajados da Maga (lista do dono, 11/11/2026). 10 por cajado.
// Os efeitos ficam em mckit.js (combat.mc). Cada nível soma 1 na chave (stats.w.mc...).
// N1 / N2 / N3 = o que muda a cada nível; máx. 1 = não sobe de nível.
const pc = (v) => `${Math.round(v * 100)}%`;

// Números de cada bênção por nível (lidos pelo kit).
export const MC = {
  // Cajado Arcano
  faisca: { t: [2, 3, 4], r: 1.8, dmg: 6, trig: 0.9 },  // faísca no chão do orbe que errou
  contagem: [6, 5, 4],                                   // orbes que acertam para o próximo sair grande
  estouro: [0.5, 0.75, 1.0],                             // chance do abate com orbe grande valer 2
  brago: { t: [1, 2, 3], pull: 7 },                      // zona de gravidade da explosão grande
  casca: [8, 6, 4],                                      // recarga da casca de mana
  eco: { t: 1, mul: [0.2, 0.4, 0.6] },                   // a explosão grande explode de novo
  mira: { still: 1, size: [0.25, 0.5, 0.8] },            // parada 1 s: próximo orbe crítico e maior
  corta: { archer: 0.3, daze: 1 },                       // N2: +30% em arqueiros; N3: atordoa
  salto: { chance: [0.35, 0.7, 1.0], range: 6 },         // orbe pequeno ricocheteia
  // Cajado Elétrico
  carga: { dmg: [2, 4, 6], t: 5 },                       // carregados que se encostam
  errante: [0.3, 0.7, 1.0],                              // chance de pular para 1 a mais
  paralisia: { n: [4, 3, 2], t: 1.5, boss: 0.5 },        // choques para paralisar
  pararaios: { cd: [6, 4, 2], r: 2.6 },                  // raio que destrói a flecha perto
  descarga: { r: 2.6 },                                  // choque em volta ao rolar (marca do trovão)
  trovao: { n: 5, t: 3, boss: 1 },                       // marcas do trovão para atordoar
  metal: [0.4, 0.8, 1.2],                                // dano em guerreiros
  bateria: { idle: 5, jumps: [1, 2, 3] },                // 5 s sem atacar: raio pula para mais
  faiscas: { n: [1, 2, 3], dmg: 3, range: 7 },           // faíscas do inimigo morto pelo raio
  rico: [0.3, 0.5, 0.8],                                 // raio sem outro alvo volta para o mesmo
  pane: [0.35, 0.7, 1.0],                                // choque da sala: chance de marca do trovão
  // Cajado das Trevas
  comandante: [0, 0.2, 0.4],                             // dano extra dos mortos-vivos
  medo: { chance: [0.35, 0.7, 1.0], t: 1.5 },
  passada: { n: [1, 2, 3], range: 6 },
  pacto: [1, 2, 3],                                      // cura ao levantar morto-vivo
  ossos: [0.15, 0.3, 0.45],                              // cada morto-vivo reduz o dano recebido
  abraco: { dmg: [5, 10, 15], r: 2.6 },                  // morto-vivo que cai explode
  olhar: [0.35, 0.7, 1.0],                               // 3º orbe: chance de sangramento
  recrutador: [0.05, 0.1, 0.2],                          // por morto-vivo na sala
  vampiro: 5,                                            // vida que o morto-vivo recupera ao matar
  lua: { hp: 10 },                                       // lacaio do começo da sala
  // Cajado de Gelo
  frio: [1, 2, 3],                                       // congela quem encosta no congelado
  geada: { chance: [0.35, 0.7, 1.0], dps: 2, t: 3 },     // queimadura de frio
  lascas: { n: [1, 2, 3], dmg: 6, range: 5 },
  poca: { t: [1, 2, 3], r: 1.5, freeze: 2.2 },           // poça de água ao descongelar
  vento: { t: 3 },                                       // rolar: o primeiro atravessado fica molhado
  adrenalina: { range: 3.8, arc: 80, t: 2.2, boss: 0.55 },
  flechas: { freeze: 2 },                                // N3: congela o arqueiro que atirou
  picole: { dmg: [10, 20, 30], speed: 15, life: 12 },
  calafrio: [0.3, 0.7, 1.05],                            // inimigos lentos atacam mais devagar
  // Cajado de Fogo
  pavio: { t: [1, 2, 3], r: 1.4 },
  fumaca: [0.35, 0.7, 1.0],                              // arqueiros e magos queimando erram
  fogueira: { still: 1.5, heal: [1, 2, 3] },             // cura por segundo parada
  ferro: { melt: 3 },                                    // N3: escudo derrete depois de 3 s queimando
  gulosa: { per: [0.03, 0.05, 0.08], max: 5 },
  combustivel: { dmg: [5, 10, 15], r: 2 },
  isqueiro: { dmg: 8, r: 2 },
  ossosSecos: [0.35, 0.7, 1.05],                         // lacaios queimam mais rápido
  calor: [0.35, 0.7, 1.0],                               // abate queimando vale 2 para a ultimate
};
export const lv = (arr, n) => arr[Math.min(arr.length, Math.max(1, n | 0)) - 1];
const L = (arr) => (n) => lv(arr, n);

// b(arma, id, nome, ícone, raridade, máximo, texto(n), efeito(s))
export function addMageCommon(b, add) {
  const k = (key) => (s) => add(s, key, 1);
  let W = 'mage.cajado';
  b(W, 'mca1', 'Faísca Residual', '✧', 'common', 3, (n) => `O orbe que erra deixa uma faísca no chão por ${MC.faisca.t[n - 1]} s, que explode quando um inimigo pisa nela.`, k('mcFaisca'));
  b(W, 'mca2', 'Orbe Teleguiado', '➹', 'common', 1, () => 'O 1º orbe do combo alcança o dobro da distância.', k('mcGuia'));
  b(W, 'mca3', 'Contagem', '#', 'common', 3, (n) => `A cada ${L(MC.contagem)(n)} orbes que acertam, o próximo orbe pequeno sai como orbe grande.`, k('mcConta'));
  b(W, 'mca4', 'Estouro de Mana', '✺', 'common', 3, (n) => `Derrotar um inimigo com o orbe grande tem ${pc(L(MC.estouro)(n))} de chance de valer 2 para a ultimate.`, k('mcEstouro'));
  b(W, 'mca5', 'Orbe do Brago', '◉', 'common', 3, (n) => `A explosão do orbe grande deixa uma pequena zona de gravidade por ${n} s, que puxa para o centro os inimigos que estão dentro dela.`, k('mcBrago'));
  b(W, 'mca6', 'Casca de Mana', '◌', 'common', 3, (n) => `Derrotar um inimigo cria uma casca que anula a próxima flecha ou magia (recarga ${L(MC.casca)(n)} s).`, k('mcCasca'));
  b(W, 'mca7', 'Eco Arcano', '≋', 'common', 3, (n) => `A explosão do orbe grande explode de novo 1 s depois, com ${pc(L(MC.eco.mul)(n))} do dano.`, k('mcEco'));
  b(W, 'mca8', 'Mira Firme', '⊕', 'common', 3, (n) => `Ficar parada 1 s deixa o próximo orbe crítico e ${pc(L(MC.mira.size)(n))} maior.`, k('mcMira'));
  b(W, 'mca9', 'Corta-Flechas', '✂', 'common', 3, (n) => ['Os orbes destroem as flechas no caminho.', 'Os orbes destroem as flechas no caminho e causam +30% de dano em arqueiros.', 'Os orbes destroem as flechas no caminho, causam +30% de dano em arqueiros e os atordoam.'][n - 1], k('mcCorta'));
  b(W, 'mca10', 'Orbe Saltitante', '⤳', 'common', 3, (n) => `O orbe pequeno tem ${pc(L(MC.salto.chance)(n))} de chance de ricochetear em 1 inimigo perto.`, k('mcSalto'));

  W = 'mage.eletrico';
  b(W, 'mce1', 'Carga Estática', '±', 'common', 3, (n) => `Os inimigos acertados ficam carregados. Dois carregados que se encostam levam ${L(MC.carga.dmg)(n)} de choque.`, k('mcCarga'));
  b(W, 'mce2', 'Raio Errante', '↯', 'common', 3, (n) => `${pc(L(MC.errante)(n))} de chance de o raio pular para 1 inimigo a mais.`, k('mcErrante'));
  b(W, 'mce3', 'Paralisia', '⚡', 'common', 3, (n) => `${L(MC.paralisia.n)(n)} choques no mesmo inimigo o paralisam por 1,5 s.`, k('mcParal'));
  b(W, 'mce4', 'Para-raios de Bolso', '⌇', 'common', 3, (n) => `Um raio destrói a flecha que passar perto de você (recarga ${L(MC.pararaios.cd)(n)} s).`, k('mcPara'));
  b(W, 'mce5', 'Descarga ao Rolar', '⌁', 'common', 1, () => 'Rolar solta um choque em volta que não causa dano, mas soma 1 marca do trovão. Com 5 marcas, o inimigo fica atordoado por 3 s.', k('mcDescarga'));
  b(W, 'mce6', 'Metal Conduz', '⛉', 'common', 3, (n) => `+${pc(L(MC.metal)(n))} de dano em guerreiros (escudo e armadura de metal).`, k('mcMetal'));
  b(W, 'mce7', 'Bateria Cheia', '▮', 'common', 3, (n) => `5 s sem atacar fazem o próximo raio pular para +${L(MC.bateria.jumps)(n)} inimigo${n > 1 ? 's' : ''}.`, k('mcBateria'));
  b(W, 'mce8', 'Faíscas de Abate', '✦', 'common', 3, (n) => `O inimigo derrotado por raio solta ${n} faísca${n > 1 ? 's' : ''} que procura${n > 1 ? 'm' : ''} outros inimigos (3 de dano).`, k('mcFaiscas'));
  b(W, 'mce9', 'Ricochete Cego', '⟲', 'common', 3, (n) => `O raio que não acha outro alvo volta para o mesmo, com ${pc(L(MC.rico)(n))} do dano.`, k('mcRico'));
  b(W, 'mce10', 'Pane', '☈', 'common', 3, (n) => `O choque do 3º golpe, que acerta a sala toda, tem ${pc(L(MC.pane)(n))} de chance de somar 1 marca do trovão (sem dano). Com 5 marcas, o inimigo fica atordoado por 3 s.`, k('mcPane'));

  W = 'mage.trevas';
  b(W, 'mct1', 'Comandante', '♛', 'common', 3, (n) => `Os mortos-vivos atacam o inimigo mais forte da sala${n > 1 ? ` e causam +${pc(MC.comandante[n - 1])} de dano` : ''}.`, k('mcCmd'));
  b(W, 'mct2', 'Medo das Trevas', '☹', 'common', 3, (n) => `Inimigos marcados têm ${pc(L(MC.medo.chance)(n))} de chance de fugir por 1,5 s (chefes não).`, k('mcMedo'));
  b(W, 'mct3', 'Marca Passada', '⇉', 'common', 3, (n) => `Matar um marcado passa a marca para ${n} inimigo${n > 1 ? 's' : ''} perto.`, k('mcPassa'));
  b(W, 'mct4', 'Pacto Menor', '✚', 'common', 3, (n) => `Levantar um morto-vivo cura ${n} de vida.`, k('mcPacto'));
  b(W, 'mct5', 'Escudo de Ossos', '⛨', 'common', 3, (n) => `Cada morto-vivo do seu lado reduz em ${pc(L(MC.ossos)(n))} o dano que você recebe (somam um em cima do outro).`, k('mcOssos'));
  b(W, 'mct6', 'Último Abraço', '✹', 'common', 3, (n) => `O morto-vivo que cai explode em sombra, com ${L(MC.abraco.dmg)(n)} de dano.`, k('mcAbraco'));
  b(W, 'mct7', 'Olhar Sombrio', '◈', 'common', 3, (n) => `O 3º orbe do combo tem ${pc(L(MC.olhar)(n))} de chance de causar sangramento.`, k('mcOlhar'));
  b(W, 'mct8', 'Recrutador', '⚑', 'common', 3, (n) => `Cada morto-vivo fica ${pc(L(MC.recrutador)(n))} mais forte e mais resistente para cada morto-vivo na sala.`, k('mcRecruta'));
  b(W, 'mct9', 'Vampiros', '❦', 'common', 1, () => 'Quando um morto-vivo derrota um inimigo, ele recupera 5 da própria vida.', k('mcVamp'));
  b(W, 'mct10', 'Lua Negra', '☾', 'common', 1, () => 'Você começa cada sala com 1 esqueleto lacaio morto-vivo do seu lado.', k('mcLua'));

  W = 'mage.gelo';
  b(W, 'mcg1', 'Frio Contagioso', '❆', 'common', 3, (n) => `Um inimigo congelado congela por ${n} s quem encostar nele.`, k('mcFrio'));
  b(W, 'mcg2', 'Geada Rachada', '❅', 'common', 3, (n) => `Cada orbe tem ${pc(L(MC.geada.chance)(n))} de chance de causar queimadura de frio (2 de dano por segundo por 3 s).`, k('mcGeada'));
  b(W, 'mcg3', 'Lascas', '✸', 'common', 3, (n) => `Estilhaçar um congelado solta lascas que atingem ${n} inimigo${n > 1 ? 's' : ''} perto (6 de dano).`, k('mcLascas'));
  b(W, 'mcg4', 'Poça de Gelo', '≈', 'common', 3, (n) => `Quando um inimigo descongela, fica uma poça de água no lugar por ${n} s. Quem pisa nela fica molhado, e um molhado congela com 1 orbe comum.`, k('mcPoca'));
  b(W, 'mcg5', 'Vento Úmido', '☂', 'common', 1, () => 'Rolar deixa molhado por 3 s o primeiro inimigo atravessado (molhado congela com 1 orbe comum).', k('mcVento'));
  b(W, 'mcg6', 'Adrenalina', '❄', 'common', 1, () => 'Quando você é atingida, solta sozinha uma magia de gelo em cone na direção do golpe, que congela todos que pegar.', k('mcAdren'));
  b(W, 'mcg7', 'Congelar Flechas', '➶', 'common', 3, (n) => ['Os orbes de gelo destroem flechas.', 'Os orbes de gelo destroem flechas e continuam voando.', 'Os orbes de gelo destroem flechas, continuam voando e congelam o arqueiro que atirou.'][n - 1], k('mcFlechas'));
  b(W, 'mcg8', 'Picolé', '◆', 'common', 3, (n) => `O inimigo que morre congelado vira um cubo de gelo. Andar contra ele o chuta como projétil (${L(MC.picole.dmg)(n)} de dano).`, k('mcPicole'));
  b(W, 'mcg9', 'Calafrio', '☃', 'common', 3, (n) => `Inimigos lentos atacam ${pc(L(MC.calafrio)(n))} mais devagar.`, k('mcCalafrio'));
  b(W, 'mcg10', 'Gelo Restaurador', '⛉', 'common', 1, () => 'Cada inimigo que morre congelado devolve 1 carga da barreira.', k('mcRest'));

  W = 'mage.fogo';
  b(W, 'mcf1', 'Pavio Longo', '♨', 'common', 3, (n) => `O inimigo que morre queimando deixa chamas no chão por ${n} s.`, k('mcPavio'));
  b(W, 'mcf2', 'Fumaça nos Olhos', '☁', 'common', 3, (n) => `Arqueiros e magos queimando erram ${pc(L(MC.fumaca)(n))} dos tiros.`, k('mcFumaca'));
  b(W, 'mcf3', 'Fogueira Pessoal', '♆', 'common', 3, (n) => `Ficar parada 1,5 s acende uma fogueira aos seus pés que cura ${n} de vida por segundo.`, k('mcFogueira'));
  b(W, 'mcf4', 'Ferro em Brasa', '⚒', 'common', 3, (n) => ['O fogo atravessa o escudo do guerreiro com metade do dano.', 'O fogo atravessa o escudo do guerreiro com o dano todo.', 'O fogo atravessa o escudo do guerreiro com o dano todo, e o escudo derrete e cai depois de 3 s queimando.'][n - 1], k('mcFerro'));
  b(W, 'mcf5', 'Chama Gulosa', '☀', 'common', 3, (n) => `Cada inimigo queimando na sala aumenta seu dano em ${pc(L(MC.gulosa.per)(n))} (até 5 inimigos).`, k('mcGulosa'));
  b(W, 'mcf6', 'Combustível', '✹', 'common', 3, (n) => `Inimigos que já estavam queimando e são atingidos pela explosão do 3º golpe explodem também, com ${L(MC.combustivel.dmg)(n)} de dano.`, k('mcComb'));
  b(W, 'mcf7', 'Isqueiro', '✦', 'common', 1, () => 'Rolar marca com uma faísca os inimigos atravessados. Acertar um inimigo com faísca faz uma explosão em volta dele (8 de dano e fogo).', k('mcIsq'));
  b(W, 'mcf8', 'Ossos Secos', '☠', 'common', 3, (n) => `Os lacaios queimam ${pc(L(MC.ossosSecos)(n))} mais rápido (morrem antes).`, k('mcSecos'));
  b(W, 'mcf9', 'Calor do Combate', '♥', 'common', 3, (n) => `Derrotar um inimigo queimando tem ${pc(L(MC.calor)(n))} de chance de valer 2 para a ultimate.`, k('mcCalor'));
  b(W, 'mcf10', 'Labareda', '☄', 'common', 1, () => 'O 1º golpe de cada sala vira uma grande explosão de fogo que atinge a sala toda.', k('mcLabareda'));
}
