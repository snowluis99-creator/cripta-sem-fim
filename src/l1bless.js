// Bênçãos LENDÁRIAS, lote 1 (pedido do dono, 12/11/2026): a primeira lendária nova de arma.
// Espada e Escudo — Forma Final: o Cavaleiro monta num robô gigante de espada e escudo. Os efeitos ficam em
// mechkit.js (combat.mech), o modelo em mech.js e os efeitos visuais em mechfx.js.
// Decisões do dono: uma vez por partida (destruído, não volta); segurar o bloqueio defende sem gastar e soltar
// depois de defender um golpe dá a pancada que atordoa; nenhuma outra bênção vale para os golpes do robô.

// Machado de Duas Mãos — Bênção de Odin (pedido do dono, 12/11/2026): o Cavaleiro vira o Deus do Trovão até o fim
// da partida. Efeitos em thorkit.js (combat.thor), visual em thorlook.js. Decisões do dono: dura a partida toda;
// o relâmpago de cada golpe tem o dano do golpe; a explosão ao apanhar sai no máximo 1 vez a cada 3 s; o machado
// arremessado não executa chefes (eles levam 150); todas as outras bênçãos continuam valendo.

// Mangual — Venham, Irmãos (pedido do dono, 12/11/2026): o Cavaleiro toca uma corneta e cavaleiros pulam para dentro da
// sala, sem parar, enquanto houver inimigos. Efeitos em brokit.js (combat.bro), quem é cada irmão em brolook.js.
// Decisões do dono: dano conforme a arma; máximo de 30 na sala ao mesmo tempo; 1 irmão por segundo; todos os
// inimigos (até chefes) podem atacar os irmãos. Os vivos seguem para a próxima sala. Nunca 2 iguais.

// Lança — Velocidade Rasga-Tempo (pedido do dono, 12/11/2026): o Cavaleiro gira a lança tão rápido que a tela trinca e
// abre um portal para uma floresta pré-histórica; sai um Tiranossauro Rex, lambe o Cavaleiro e ele monta. Regras em
// rexkit.js (combat.rex), modelo em rex.js, efeitos (portal, tela trincada, fogo) em rexfx.js.
// Decisões do dono: o T-Rex fica até a vida dele acabar (uma vez por partida); com inimigos ele anda sozinho e ataca;
// o Cavaleiro ataca lá de cima em qualquer direção e as bênçãos valem só nos golpes do Cavaleiro; com 250 de vida ele
// fica preto, cria asas, levita e passa a cuspir fogo; quando morre, o dragão explode em fogo.

// Manopla — Gigante de Aço (pedido do dono, 12/11/2026): o Cavaleiro chama um robô boxeador gigante que copia na hora
// os golpes dele (e também o escudo e o rolamento) e anda sozinho atrás dos inimigos, nesta ordem: magos, arqueiros,
// guardas, esqueletinhos e por último o chefe. Regras em giantkit.js (combat.giant), modelo em giant.js, ringue e tela
// em giantfx.js. Decisões do dono: 300 de vida; zerou, fica 30 s nocauteado, vai levantando aos poucos e volta com a
// vida cheia; soco do robô = 60 fixo; bênçãos valem só nos golpes do Cavaleiro; fica o resto da partida; chega num
// ringue de luz com sino; o último soco do combo é um cruzado que arremessa o inimigo nos outros (boliche).

// Cajado Arcano — Grimório Ancestral (pedido do dono, 12/11/2026): um livro antigo desce do teto, o cajado se desfaz e a
// Maga passa a conjurar com as mãos (sempre sai um círculo mágico das mãos). Cada ataque solta 1 magia sorteada entre
// as do livro (50 no final; o lote 1 tem 10), sem mostrar qual vem. Regras em grimkit.js (combat.grim), visual em
// grimlook.js, magias em grimspells.js. Decisões do dono: dura o resto da partida; nenhuma outra bênção vale; escudo
// sempre ativo em 360°: flechas, virotes, orbes e magias voltam em quem atirou (sem gastar), só golpe corpo a corpo
// machuca; o rolamento vira teleporte. Pode ser absurdamente forte.

// Números (lidos pelo kit).
export const L1 = {
  grim: {
    cast: { speed: 1.0, hit: 0.34, end: 0.66 },   // cada conjuração (Spellcasting / Shoot alternados)
    blink: { dist: 7.5, iframes: 0.25 },           // teleporte (rolamento)
    intro: { wait: 0.35, book: 1.1, open: 0.7, staff: 0.6, pages: 0.9 },
    reach: 15,                                       // até onde as magias miram sozinhas
    meteor: { dmg: 260, r: 4.5, fall: 0.8, burn: 3.5, burnDmg: 15, tick: 0.5 },
    inferno: { dmg: 40, dur: 6, tick: 0.4, tickDmg: 14 },
    ice: { dmg: 50, freeze: 4, boss: 1.5 },
    judgment: { dmg: 170 },
    hole: { dur: 2.6, pull: 10, tick: 0.3, tickDmg: 12, boom: 260, r: 9, boomR: 6 },
    erase: { dur: 1.3, boss: 0.25 },
    nova: { charge: 0.55, dmg: 240, r: 11, push: 16 },
    swords: { n: 20, dmg: 70, over: 1.1, r: 1.3 },
    tornado: { dur: 5, speed: 5, r: 2.8, tick: 0.25, tickDmg: 10, toss: 80 },
    hand: { dmg: 320, r: 5.5, fall: 0.95 },
    // Lote 2 (13/11/2026)
    rain: { n: 12, over: 2.2, fall: 0.6, dmg: 150, r: 3.2, burn: 2, burnDmg: 10, tick: 0.5, big: 1.6 },  // Chuva de Meteoros (o 12º é gigante)
    sun: { rise: 0.6, dur: 5, r: 6, tick: 0.3, tickDmg: 16, follow: 2.5, boom: 300, boomR: 8.5 },     // Sol em Miniatura
    phoenix: { hits: 6, dmg: 170, speed: 12, turn: 5, r: 1.7, burn: 3, burnDmg: 10, maxT: 7, final: 140, finalR: 4.5 }, // Fênix
    pillars: { step: 1.9, delay: 0.075, r: 2.1, dmg: 200, h: 6.5, burn: 2.5, tick: 0.5, tickDmg: 12, endR: 4, endDmg: 160 }, // Pilares de Chamas
    comet: { speed: 17, r: 2.6, dmg: 150, freeze: 3.5, boss: 1.2, boom: 140, boomR: 4.5 },             // Cometa Gelado
    prison: { dur: 2.2, boss: 1.2, dmg: 350, shards: 26, shardDmg: 110, r: 10 },                       // Prisão de Cristal
    blizzard: { dur: 6, r: 5.5, tick: 0.25, tickDmg: 14, chill: 1.5, freeze: 1.6, swirl: 1.8 },         // Nevasca
    spears: { rows: 7, first: 1.8, step: 1.6, half: 0.8, gap: 1.15, delay: 0.075, dmg: 220, r: 1.15, freeze: 1.5, stay: 2.4 }, // Floresta de Lanças
    storm: { dur: 6, every: 0.17, dmg: 90, r: 2.2, bigEvery: 6, big: 2, bigR: 3.6 },                    // Tempestade
    chain: { dmg: 90, grow: 8, every: 0.09, range: 14, max: 60 },                                      // Raio Sem Fim
    // Lote 3 (14/11/2026)
    dragon: { speed: 14, r: 2.6, dmg: 230, burn: 3, burnDmg: 12, segs: 26, gap: 0.62, amp: 2.4 },      // Dragão de Fogo
    plasma: { speed: 3.4, maxT: 7, r: 6, tick: 0.25, dmg: 34, pull: 1.6, boom: 220, boomR: 5.5 },       // Esfera de Plasma
    abyss: { rise: 0.35, hold: 0.35, sink: 1.0, dmg: 400, boss: 220, stagger: 0.05 },                  // Mãos do Abismo
    army: { max: 12, min: 3, hp: 170, dmg: 45 },                                                         // Exército das Sombras
    eclipse: { dur: 5, mul: 3, boss: 2 },                                                                // Eclipse
    scythe: { appear: 0.4, dur: 2.2, turns: 2, dmg: 210 },                                               // Foice do Ceifador
    beam: { charge: 0.45, dur: 1.6, w: 1.7, tick: 0.1, dmg: 38, push: 2.5, len: 60 },                   // Raio Arcano
    stars: { dur: 4, every: 0.06, fall: 0.35, r: 2, dmg: 75, aimed: 0.55 },                             // Chuva de Estrelas
    portal: { r: 5, pull: 9, dur: 1.5, h: 8.5, dmg: 260, landR: 2.2, landDmg: 80, boss: 220 },        // Portal
    zero: { rise: 1, dur: 4, h: 3.2, dmg: 300, r: 2.4, splash: 60, boss: 180 },                         // Gravidade Zero
    // Lote 4 (22/11/2026)
    crush: { dur: 2.2, pulses: 3, squash: 0.3, dmg: 380, boss: 260 },                                  // Gravidade Esmagadora
    mirror: { n: 6, r: 3, dur: 8, every: 0.55, dmg: 50, speed: 24, range: 15, shatter: 80, shatterR: 3 }, // Salão de Espelhos
    rift: { open: 0.35, stay: 1.1, w: 1.5, dmg: 420, close: 140, pull: 5 },                             // Rasgo na Realidade
    ring: { dur: 6, n: 9, r: 3.4, spin: 3.4, dmg: 70, cd: 0.35, push: 9, boom: 110, boomR: 2.4 },        // Anel Planetário
    quake: { tremors: 3, every: 0.4, tremorDmg: 35, sink: 0.9, hold: 0.5, dmg: 380, boss: 240 },        // Terremoto
    roots: { grow: 0.5, hold: 2.2, squeezes: 3, dmg: 360, boss: 240 },                                  // Raízes Ancestrais
    wave: { speed: 12, h: 4.5, dmg: 320, boss: 220 },                                                    // Tsunami
    fog: { dur: 7, tick: 0.5, dmg: 22, rise: 1 },                                                        // Névoa Venenosa
    swarm: { n: 48, dur: 5, tick: 0.25, bite: 2 },                                                       // Enxame (mordida por morcego)
    golem: { rise: 1.2, speed: 4.6, turn: 6, reach: 2.8, punch: 130, slamEvery: 4, slam: 220, slamR: 3.8, cd: 0.8, max: 2, scale: 1.35 }, // Golem Ancestral
  },
  giant: {
    hp: 300, ko: 30, dmg: 60,           // vida; segundos de nocaute; dano de cada soco (fixo)
    rise: [17, 29],                     // durante o nocaute: começa a levantar aos 17 s e fica de pé aos 29 s
    speed: 6.2, turn: 9,                // anda 6,2 por segundo (o Cavaleiro anda 7)
    scale: 1.2,                         // tamanho do modelo (≈ 6 de altura; o Cavaleiro tem 2,5)
    body: 1.3, wall: 0.95,              // raio do corpo (inimigos e flechas) e para paredes (passa em vãos de 2)
    reach: 3.5, arc: 42,                // alcance dos socos a partir do centro do robô; meio ângulo (graus)
    punch: [0.42, 0.42, 0.5, 0.72],     // duração de jab, direto, gancho de baixo e cruzado
    hitAt: 0.42, lunge: 0.55,           // momento do impacto (fração); passo à frente no soco
    bowl: { speed: 26, max: 13, r: 0.85, push: 9, daze: 0.9 }, // cruzado: o inimigo voa e derruba quem estiver no caminho
    weave: { dur: 0.42, dist: 1.4 },    // esquiva (copia o rolamento): invencível
    follow: { back: 3.2, side: 1.6, near: 2.0 }, // sem inimigos: fica atrás do Cavaleiro
    zoom: 1.12,
    intro: { wait: 0.35, ring: 1.0, drop: 0.6, rise: 0.55, bump: 1.25, out: 0.8, dist: 3.4, sky: 22 },
  },
  rex: {
    hp: 500, morphAt: 250,              // vida própria; com 250 vira o dragão negro
    speed: 1.15, flySpeed: 1.3, turn: 6, // × velocidade do Cavaleiro (7): anda 8, voando 9
    scale: 1.25, radius: 1.7, wall: 0.95, zoom: 1.22, // tamanho do modelo; para golpes/flechas; para paredes (passa em vãos de 2); câmera mais longe
    reach: 1.35,                         // a lança lá de cima alcança 35% mais longe
    bite: { dmg: 60, dur: 0.62, hit: 0.48, side: 1.5 }, // mordida: em quem estiver na frente, até a boca
    shred: { every: 3, dmg: 150, dur: 1.1, hits: 3 },  // a cada 3 mordidas, abocanha e sacode (chefe não é erguido)
    spit: { dmg: 70, r: 2.8, speed: 22, cd: 0.95, dur: 0.6, hit: 0.42, keep: 9.5, max: 17, burn: 3, burnDps: 6 }, // dragão: cuspida de fogo
    boom: { dmg: 150, r: 7.5, burn: 4 }, // morreu: explosão de fogo
    intro: { wait: 0.35, spin: 1.25, crack: 0.55, emerge: 1.35, roar: 0.75, lick: 0.95, board: 0.85 },
    morph: 1.5, dying: 1.25, fly: 0.75,
  },
  bro: {
    hp: 100, max: 30, every: 1.0,       // vida de cada irmão; quantos ao mesmo tempo; 1 a cada 1 s durante a luta
    dmg: { '1h': 12, fist: 10, dual: 10, '2h': 18, spear: 16, bow: 10, xbow: 12, magic: 12, boss: 25 }, // dano por golpe/tiro (arma de chefe: 25)
    speed: { foot: 5.6, mounted: 8.4 },
    mountChance: 0.3, horseScale: 1.15, seat: 0.98,
    jump: { h: 3.2, top: 4.2, base: 0.75, perM: 0.035, land: 2.2, daze: 0.6 }, // pulo por cima do muro; pouso: área e tontura
    answer: 3,                           // irmãos que respondem à corneta na hora (mesmo sem inimigos)
    intro: { horn: 0.35, title: 0.55, answer: 1.0, end: 2.3 },
    hornCd: 3,                           // horda nova depois de uma pausa: o Cavaleiro toca a corneta de novo (só o som)
  },
  thor: {
    dmg: 1, atk: 1, move: 1, hp: 100,  // +100% de dano, velocidade de ataque e de movimento; +100 de vida
    zapR: 6.5,                         // relâmpago de cada golpe: raio em volta do Cavaleiro
    boom: { dmg: 150, cd: 3 },         // apanhou: explosão na sala inteira (no máximo 1 a cada 3 s)
    blink: { iframes: 0.18 },          // rolamento instantâneo (mesma distância do rolamento)
    throw: { speed: 36, back: 46, max: 40, r: 1.5, boss: 150, catch: 1.1 }, // machado arremessado
    intro: { call: 1.0, end: 1.9, push: 8, daze: 1.2 }, // cena da transformação
  },
  mech: {
    hp: 300, dmg: 150,
    range: 7.2, arc: 200,            // cortes largos (graus)
    speed: 0.72, turn: 7,            // um pouco mais lento que o Cavaleiro (7 × 0,72 = 5 por segundo)
    radius: 1.5, wall: 0.95,         // tamanho para golpes/flechas e para paredes (passa em vãos de 2)
    scale: 0.92, zoom: 1.24,          // tamanho do modelo e quanto a câmera se afasta
    steps: [{ dur: 0.8, hit: 0.45 }, { dur: 0.76, hit: 0.45 }, { dur: 1.05, hit: 0.56 }],
    slam: { ahead: 4.8, r: 3.9, len: 12, half: 1.7 },   // 3º golpe: impacto à frente + fenda em linha reta
    block: { arc: 180, move: 0.45, armed: 6 },
    bash: { r: 9, daze: 2.5, boss: 1, push: 11, dur: 0.9, hit: 0.48 },
    land: { r: 5.5 }, boom: { r: 6.5 },
    summon: { wait: 0.4, call: 1.2, drop: 0.5, board: 0.95, rise: 1.9 },
    dying: { burn: 1.3, fly: 0.7 },
  },
};

// b(arma, id, nome, ícone, raridade, máximo, texto(n), efeito(s))
export function addLegendaryLote1(b, add) {
  const M = L1.mech;
  b('knight.espada', 'l1e1', 'Forma Final', '♜', 'legendary', 1, () => `O Cavaleiro monta num robô gigante de espada e escudo. O robô tem ${M.hp} de vida própria, causa ${M.dmg} de dano por golpe, alcança muito longe e varre uma área enorme, mas é um pouco mais lento e não rola. Segurar o bloqueio defende sem gastar; soltar depois de defender um golpe dá uma pancada que atordoa todos em volta. Dura até o robô ser destruído (uma vez por partida).`, (s) => add(s, 'mechForm', 1));
  const T = L1.thor;
  b('knight.machado', 'l1m1', 'Bênção de Odin', 'ϟ', 'legendary', 1, () => `Você recebe os poderes de Thor e vira o Deus do Trovão até o fim da partida: +${T.dmg * 100}% de dano, +${T.move * 100}% de velocidade de movimento, +${T.atk * 100}% de velocidade de ataque e +${T.hp} de vida. Todo golpe chama um relâmpago que atinge todos os inimigos perto (mesmo dano do golpe). O rolamento vira um raio instantâneo. Levar um golpe solta uma explosão de raio na sala inteira (${T.boom.dmg} de dano; no máximo 1 a cada ${T.boom.cd} s). Atacar sem ninguém no alcance arremessa o machado: ele empurra todos que encostar até a parede e os executa com uma explosão de raio (chefes levam ${T.throw.boss}), e volta sozinho para a mão.`,
    (s, p) => { add(s, 'thorForm', 1); s.damageMul += T.dmg; s.attackSpeed += T.atk; s.speedMul += T.move; s.bonusHp += T.hp; if (p) p.heal(T.hp); });
  const R = L1.bro;
  b('knight.mangual', 'l1f1', 'Venham, Irmãos', '♞', 'legendary', 1, () => `O Cavaleiro toca a corneta da Ordem e cavaleiros começam a pular de fora da sala para dentro, um por segundo, sem parar enquanto houver inimigos (até ${R.max} ao mesmo tempo). Cada irmão tem ${R.hp} de vida e uma arma sorteada entre todas do jogo (de heróis, de esqueletos e até de chefes), com o dano dessa arma; nenhum é igual ao outro e alguns vêm a cavalo. Os que sobreviverem seguem com você para as próximas salas, e a cada horda nova chegam mais.`,
    (s) => add(s, 'brothers', 1));
  const X = L1.rex;
  b('knight.lanca', 'l1l1', 'Velocidade Rasga-Tempo', '✺', 'legendary', 1, () => `O Cavaleiro gira a lança tão rápido que a tela trinca e se abre um portal para uma floresta de outra era. De lá sai um Tiranossauro Rex, que dá uma lambida no Cavaleiro, e ele monta. Com inimigos na sala o T-Rex anda sozinho, morde (${X.bite.dmg}) e de vez em quando abocanha e estraçalha (${X.shred.dmg}); lá de cima você ataca com a lança para qualquer lado (suas bênçãos valem nos seus golpes). Ele tem ${X.hp} de vida própria e não se defende: com ${X.morphAt} ele fica preto, cria asas, levita e passa a cuspir fogo (${X.spit.dmg} em área). Quando a vida acaba, explode em fogo (${X.boom.dmg}). Uma vez por partida.`,
    (s) => add(s, 'rexForm', 1));
  b('mage.cajado', 'l1c1', 'Grimório Ancestral', '✧', 'legendary', 1, () => `Um grimório ancestral desce do teto e se abre para a Maga até o fim da partida. O cajado se desfaz e ela passa a conjurar com as mãos: cada ataque solta uma magia diferente, sorteada entre as do livro, como meteoros, buracos negros, a sala inteira em chamas, raios do céu e até apagar um inimigo da existência. Um escudo arcano envolve a Maga por todos os lados: flechas, virotes e magias voltam em quem atirou, e só golpes corpo a corpo a machucam. O rolamento vira teleporte. Nenhuma outra bênção vale junto com o Grimório.`,
    (s) => add(s, 'grimForm', 1));
  const G = L1.giant;
  b('knight.manopla', 'l1g1', 'Gigante de Aço', '✊', 'legendary', 1, () => `O sino toca, um ringue de luz aparece e um robô boxeador gigante cai do céu para lutar do seu lado até o fim da partida. Ele copia na hora todos os seus golpes (${G.dmg} de dano por soco; o último soco do combo é um cruzado que arremessa o inimigo contra os outros, como num boliche), levanta a guarda quando você defende e esquiva quando você rola. Ele anda sozinho atrás dos inimigos, nesta ordem: magos, arqueiros, guardas, esqueletinhos e, por último, o chefe. Tem ${G.hp} de vida: se for nocauteado, fica ${G.ko} s no chão, vai levantando aos poucos e volta com a vida cheia. Suas bênçãos valem só nos seus golpes.`,
    (s) => add(s, 'giantForm', 1));
}
