// Bênçãos exclusivas de cada arma (10 por arma, 15 armas). Só aparecem para o herói usando aquela arma.
// Os números ficam em stats.w (objeto). Dois tipos de efeito:
// - "de ficha": mudam os dados do golpe (dano, velocidade, alcance, magia...) — applyWeaponMods refaz o herói;
// - "na hora": lidos no combate (wbhooks.js): cura ao acertar, sangramento, marca, raio, etc.
import { repairShield } from './shield.js';
const add = (s, k, v) => { s.w[k] = (s.w[k] || 0) + v; };
const pct = (v) => `${Math.round(v * 100)}%`;
const n1 = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

// b(arma, id, nome, ícone, raridade, máximo, texto(n), efeito(s, p))
const LIST = [];
const b = (weapon, id, name, icon, rarity, max, desc, apply) => LIST.push({ id: `w_${id}`, weapon, name, icon, rarity, max, desc, apply });

// ---------------- Cavaleiro ----------------
let W = 'knight.espada';
// Lista do dono (02/11/2026). As que mudam o jeito de jogar ficam em knightkit.js.
b(W, 'esp11', 'Aparar', '⛉', 'rare', 1, () => 'Bloquear no instante certo (logo ao levantar o escudo) não gasta o escudo e atordoa quem atacou.', (s) => { s.parry = true; });
b(W, 'esp12', 'Estilhaços', '✹', 'rare', 1, () => 'Quando o escudo quebra, ele explode: 40 de dano e empurra os esqueletos em volta.', (s) => { s.shards = true; });
b(W, 'esp13', 'Placas de Mitral', '◈', 'rare', 2, (n) => `${n * 25}% de chance de um bloqueio não gastar o escudo.`, (s) => { s.mithril += 0.25; });
b(W, 'esp14', 'Escudo de Espinhos', '✶', 'common', 3, (n) => `Bloquear um golpe devolve ${n * 15} de dano ao atacante.`, (s) => { s.thorns += 15; });
b(W, 'esp15', 'Escudo Reforçado', '⛨', 'common', 3, (n) => `O escudo aguenta +5 bloqueios e fica novo agora. (total: ${10 + n * 5} bloqueios)`, (s, p) => { s.shieldBonus += 5; if (p) repairShield(p); });
b(W, 'esp16', 'Arremesso', '➚', 'epic', 1, () => 'O combo ganha um 4º golpe que arremessa o escudo (14 de dano). Ele para no 1º inimigo ou parede e cai no chão: vá buscá-lo. Sem o escudo, não dá para bloquear.', (s) => add(s, 'shieldThrow', 1));
b(W, 'esp17', 'Pancada', '✦', 'epic', 2, (n) => `O golpe forte (3º do combo) atordoa por ${n} segundo${n > 1 ? 's' : ''}.`, (s) => add(s, 'heavyDaze', 1));
b(W, 'esp18', 'Lâmina Afiada', '♦', 'epic', 3, (n) => `Cada golpe do Cavaleiro tem ${n * 10}% de chance de causar sangramento.`, (s) => add(s, 'bleedHit', 0.1));
b(W, 'esp5', 'Rebate Brutal', '⇆', 'rare', 2, (n) => `Inimigos rebatidos pelo escudo ficam desequilibrados ${n * 50}% mais tempo.`, (s) => add(s, 'bashStun', 0.5));
b(W, 'esp6', 'Guarda Curativa', '✚', 'rare', 2, (n) => `Cada golpe bloqueado cura ${n * 3} de vida.`, (s) => add(s, 'blockHeal', 3));
b(W, 'esp7', 'Lâmina Justa', '⚖', 'rare', 2, (n) => `+${n * 40}% de dano em inimigos atordoados, desequilibrados ou congelados.`, (s) => add(s, 'vsStun', 0.4));
b(W, 'esp8', 'Golpe Duplo', '⚔', 'epic', 1, () => 'O golpe forte acerta duas vezes (o 2º impacto com metade do dano).', (s) => add(s, 'twiceH', 0.5));
b(W, 'esp9', 'Lâmina Sagrada', '✧', 'epic', 1, () => '+10% de chance de crítico; cada crítico cura 4 de vida.', (s) => { s.critChance += 0.1; add(s, 'critHeal', 4); });
b(W, 'esp10', 'Juramento do Paladino', '↯', 'legendary', 1, () => 'O golpe forte solta um raio que pula para 3 inimigos perto (12 de dano cada).', (s) => add(s, 'heavyChain', 3));
b(W, 'esp19', 'Bilhar de Ossos', '◉', 'epic', 1, () => 'Inimigos rebatidos pelo escudo voam como bolas e derrubam os outros em cadeia. Bater na parede causa 25 de dano.', (s) => add(s, 'billiard', 1));
b(W, 'esp20', 'Espada Arremessada', '†', 'legendary', 1, () => 'O golpe forte atira a espada, que atravessa todos e fica cravada onde cair. Sem ela, você luta com pancadas de escudo e o golpe forte chama a espada de volta, cortando tudo no caminho (ou passe por cima dela para pegar).', (s) => add(s, 'swordThrow', 1));
b(W, 'esp21', 'Trenó de Escudo', '⛷', 'epic', 1, () => 'Rolar vira deslizar sentado no escudo enquanto segura o botão (até 2 s), atropelando quem estiver na frente.', (s) => add(s, 'sled', 1));
b(W, 'esp22', 'Escudo Plantado', '▥', 'legendary', 1, () => 'Segurar o bloqueio por 1 s finca o escudo no chão: vira uma parede que segura esqueletos e flechas. Lute com a espada e aperte o bloqueio perto dele para pegar de volta.', (s) => add(s, 'plant', 1));
b(W, 'esp23', 'Corrente no Escudo', '⛓', 'epic', 1, () => 'Levantar o escudo lança um gancho que puxa até você o 1º inimigo da frente, até arqueiros e magos lá de trás (a cada 2 s).', (s) => add(s, 'hook', 1));
b(W, 'esp24', 'Mãos Trocadas', '⇄', 'legendary', 1, () => 'O escudo passa a atacar, com pancadas que empurram longe. A espada passa a defender: não gasta o escudo e contra-ataca sozinha (12 de dano).', (s) => add(s, 'swap', 1));
b(W, 'esp25', 'Rastro Fantasma', '≈', 'epic', 1, () => 'Cada golpe deixa um corte brilhando no ar, que corta de novo 1 s depois (60% do dano). Atraia os inimigos para eles.', (s) => add(s, 'trail', 1));
// 2ª leva (02/11/2026) — knightkit2.js.
b(W, 'esp26', 'Duelo Sagrado', '⚜', 'epic', 1, () => 'Ao começar a luta da sala, você desafia o inimigo mais forte. Um círculo dourado prende vocês dois e ninguém entra (nem golpes, nem flechas) até um cair.', (s) => add(s, 'duel', 1));
b(W, 'esp27', 'Vassalo', '♛', 'legendary', 1, () => 'O último esqueleto de cada onda se rende, ajoelha e passa a lutar do seu lado até o fim da sala.', (s) => add(s, 'vassal', 1));
b(W, 'esp28', 'Mesa Virada', '▤', 'epic', 1, () => 'Barris, mesas e caixotes na frente do escudo são chutados (levante o escudo ou dê uma pancada de escudo) e voam como projéteis: 22 de dano em quem estiver perto de onde caírem.', (s) => add(s, 'table', 1));
b(W, 'esp29', 'Cavalo Fantasma', '♞', 'legendary', 1, () => 'Rolar invoca um cavalo espectral: você galopa por 2 s atropelando tudo (10 de dano e joga longe). Atacar desmonta na hora.', (s) => add(s, 'horse', 1));
b(W, 'esp30', 'Espada Amaldiçoada', '☠', 'epic', 1, () => 'A espada fala e pede um tipo de inimigo por sala (“Quero arqueiros!”). Derrote 3 deles e ganhe um prêmio (ouro, vida ou ultimate). Ignore o pedido e ela te machuca no fim da sala (15 de dano).', (s) => add(s, 'curse', 1));

W = 'knight.machado';
// Lista do dono (02/11/2026). As que mudam o jeito de jogar ficam em axekit.js.
b(W, 'mac1', 'Fio Pesado', '⚒', 'common', 3, (n) => `Acertar mais de 1 inimigo com o mesmo golpe aumenta o dano em ${n * 10}% por inimigo atingido, por 2 s.`, (s) => add(s, 'multiHit', 0.1));
b(W, 'mac2', 'Giro Voraz', '↻', 'common', 2, (n) => `O giro (2º golpe) te deixa invulnerável por ${n1(n * 0.5)} s.`, (s) => add(s, 'spinGuard', 0.5));
b(W, 'mac11', 'Sede de Batalha', '♨', 'common', 2, (n) => `Cada inimigo derrotado aumenta seu dano em ${n * 3}% até sair da sala.`, (s) => add(s, 'roomRamp', 0.03));
b(W, 'mac4', 'Braços de Ferro', 'ϟ', 'common', 2, (n) => `O golpe forte executa inimigos que ficariam com ${n * 5}% da vida ou menos (chefes não).`, (s) => add(s, 'execute', 0.05));
b(W, 'mac5', 'Racha-Crânios', '☠', 'rare', 2, (n) => `Quando um inimigo é derrotado, os inimigos perto dele ficam paralisados por ${n1(n * 0.5)} s.`, (s) => add(s, 'killDaze', 0.5));
b(W, 'mac12', 'Redemoinho', '↺', 'rare', 1, () => 'O giro (2º golpe) rebate flechas e magias de volta para quem atirou.', (s) => add(s, 'whirl', 1));
b(W, 'mac7', 'Lenhador', '⛏', 'rare', 2, (n) => `+${n * 50}% de dano em chefes e em esqueletos com escudo.`, (s) => add(s, 'vsBig', 0.5));
b(W, 'mac15', 'Tornado', '❂', 'rare', 1, () => 'O giro puxa os inimigos em volta para perto de você, juntando todos para a machadada forte (chefes não).', (s) => add(s, 'tornado', 1));
b(W, 'mac16', 'Giro Crescente', '◎', 'rare', 1, () => 'Cada inimigo acertado pelo giro deixa os próximos giros maiores (+6% cada, até +80%), até o fim da sala.', (s) => add(s, 'spinGrow', 1));
b(W, 'mac8', 'Machado Sedento', '✚', 'epic', 1, () => 'Cada inimigo acertado pelo giro cura 2 de vida.', (s) => add(s, 'spinHeal', 2));
b(W, 'mac9', 'Terremoto Rubro', '≋', 'epic', 1, () => 'O golpe forte deixa os inimigos lentos por 3 s; todos os golpes atordoam 50% mais tempo.', (s) => { add(s, 'slowH', 3); add(s, 'stun', 0.5); });
b(W, 'mac14', 'Pião', '✺', 'epic', 1, () => 'Aperte e segure o ataque durante o giro: você continua girando sem parar e anda devagar. Solte para a machadada forte.', (s) => add(s, 'spinTop', 1));
b(W, 'mac17', 'Rolagem Giratória', '⟳', 'epic', 1, () => 'O machado é tão pesado que rolar faz você girar junto, cortando quem estiver em volta (60% do dano do giro).', (s) => add(s, 'rollSpin', 1));
b(W, 'mac13', 'Arremesso Mortal', '➚', 'legendary', 1, () => 'O combo ganha um 4º golpe: o machado é arremessado girando, vai longe e volta, cortando tudo no caminho (30 de dano na ida e na volta). Você fica parado esperando ele voltar.', (s) => add(s, 'axeThrow', 1));

W = 'knight.mangual';
b(W, 'man1', 'Bolas Cravejadas', '✹', 'common', 3, (n) => `+25% de dano em todos os golpes do mangual. (total: +${n * 25}%)`, (s) => add(s, 'dmg', 0.25));
b(W, 'man2', 'Corrente Longa', '↔', 'common', 2, (n) => `O mangual alcança ${n * 15}% mais longe.`, (s) => add(s, 'range', 0.15));
b(W, 'man3', 'Pancada Atordoante', '✦', 'common', 3, (n) => `Os inimigos ficam atordoados ${n * 30}% mais tempo.`, (s) => add(s, 'stun', 0.3));
b(W, 'man4', 'Rodopio', 'ϟ', 'common', 2, (n) => `Golpes do mangual ${n * 10}% mais rápidos.`, (s) => add(s, 'spd', 0.1));
b(W, 'man5', 'Esmaga-Guarda', '⛨', 'rare', 1, () => 'Todos os golpes do mangual quebram a guarda: passam pelo escudo e atordoam até os resistentes.', (s) => add(s, 'guardBreak', 1));
b(W, 'man6', 'Órbita Pesada', '◎', 'rare', 2, (n) => `A área do golpe forte fica ${n * 30}% maior.`, (s) => add(s, 'blast', 0.3));
b(W, 'man7', 'Escudo de Ferro', '⛉', 'rare', 3, (n) => `Bloquear um golpe causa ${n * 10} de dano em quem atacou.`, (s) => add(s, 'bashDmg', 10));
b(W, 'man8', 'Impacto Sísmico', '≋', 'epic', 1, () => 'O golpe forte deixa lentos (3 s) todos os inimigos atingidos.', (s) => add(s, 'slowH', 3));
b(W, 'man9', 'Corrente de Choque', '↯', 'epic', 2, (n) => `O golpe forte causa +50% de dano. (total: +${n * 50}%)`, (s) => add(s, 'dmgH', 0.5));
b(W, 'man10', 'Estrela da Manhã', '✺', 'legendary', 1, () => 'O golpe forte deixa todos os atingidos desequilibrados (+25% de dano e qualquer golpe atordoa).', (s) => add(s, 'heavyOff', 1));

W = 'knight.lanca';
b(W, 'lan1', 'Ponta de Aço', '➶', 'common', 3, (n) => `+25% de dano em todas as estocadas. (total: +${n * 25}%)`, (s) => add(s, 'dmg', 0.25));
b(W, 'lan2', 'Haste Longa', '↔', 'common', 2, (n) => `A lança alcança ${n * 15}% mais longe.`, (s) => add(s, 'range', 0.15));
b(W, 'lan3', 'Estocada Veloz', 'ϟ', 'common', 2, (n) => `Estocadas ${n * 10}% mais rápidas.`, (s) => add(s, 'spd', 0.1));
b(W, 'lan4', 'Investida', '»', 'common', 2, () => 'O golpe forte avança 50% mais e causa +30% de dano.', (s) => { add(s, 'lungeH', 0.5); add(s, 'dmgH', 0.3); });
b(W, 'lan5', 'Perfurar', '⇶', 'rare', 2, (n) => `Cada estocada atravessa e acerta mais ${n} inimigo${n > 1 ? 's' : ''} atrás do primeiro.`, (s) => add(s, 'pierceMelee', 1));
b(W, 'lan6', 'Alvo Fixo', '◎', 'rare', 2, (n) => `+${n * 40}% de dano em inimigos com a vida cheia.`, (s) => add(s, 'vsFull', 0.4));
b(W, 'lan7', 'Manter Distância', '⇥', 'rare', 1, () => 'As estocadas empurram os inimigos 60% mais longe.', (s) => add(s, 'pushMul', 0.6));
b(W, 'lan8', 'Empalar', '†', 'epic', 1, () => 'O golpe forte deixa o inimigo lento por 3 s e soma 1 de sangramento.', (s) => { add(s, 'slowH', 3); add(s, 'bleedH', 1); });
b(W, 'lan9', 'Fio Mortal', '✧', 'epic', 2, () => '+12% de chance de crítico; críticos causam +50% de dano.', (s) => { s.critChance += 0.12; add(s, 'critDmg', 0.5); });
b(W, 'lan10', 'Lança do Dragão', '♨', 'legendary', 1, () => 'O golpe forte solta uma rajada de fogo em linha reta que atravessa todos (20 de dano e queima).', (s) => add(s, 'fireLine', 20));

W = 'knight.manopla';
b(W, 'mnp1', 'Nós de Ferro', '✊', 'common', 3, (n) => `+25% de dano em todos os socos. (total: +${n * 25}%)`, (s) => add(s, 'dmg', 0.25));
b(W, 'mnp2', 'Socos Rápidos', 'ϟ', 'common', 3, (n) => `Socos ${n * 10}% mais rápidos.`, (s) => add(s, 'spd', 0.1));
b(W, 'mnp3', 'Ritmo', '♪', 'common', 2, (n) => `Cada golpe seguido do combo causa +${n * 12}% de dano a mais que o anterior (o 4º: +${n * 36}%).`, (s) => add(s, 'ramp', 0.12));
b(W, 'mnp4', 'Antebraço Firme', '⛉', 'common', 3, () => 'Bloquear um golpe cura 2 de vida e causa 6 de dano em quem atacou.', (s) => { add(s, 'blockHeal', 2); add(s, 'bashDmg', 6); });
b(W, 'mnp5', 'Gancho', '☄', 'rare', 2, (n) => `O golpe forte (4º) causa +${n * 50}% de dano.`, (s) => add(s, 'dmgH', 0.5));
b(W, 'mnp6', 'Pés Ligeiros', '»', 'rare', 1, () => 'Depois de rolar, o próximo golpe (até 1,5 s) causa +60% de dano.', (s) => add(s, 'dodgeDmg', 0.6));
b(W, 'mnp7', 'Chuva de Golpes', '✦', 'rare', 2, () => '+10% de chance de crítico; cada crítico deixa os socos 20% mais rápidos por 2 s.', (s) => { s.critChance += 0.1; add(s, 'critHaste', 0.2); });
b(W, 'mnp8', 'Punho Trovejante', '↯', 'epic', 1, () => 'O golpe forte solta um raio que pula para 2 inimigos perto.', (s) => add(s, 'heavyChain', 2));
b(W, 'mnp9', 'Uppercut', '⇑', 'epic', 1, () => 'O golpe forte deixa o inimigo desequilibrado (+25% de dano e qualquer golpe atordoa).', (s) => add(s, 'heavyOff', 1));
b(W, 'mnp10', 'Mestre do Punho', '✚', 'legendary', 1, () => 'Cada acerto cura 1 de vida (no máximo a cada 0,3 s).', (s) => add(s, 'hitHeal', 1));

// ---------------- Maga ----------------
W = 'mage.cajado';
b(W, 'caj1', 'Orbes Densos', '✦', 'common', 3, (n) => `+25% de dano em todos os orbes. (total: +${n * 25}%)`, (s) => add(s, 'dmg', 0.25));
b(W, 'caj2', 'Conjuração Rápida', 'ϟ', 'common', 2, (n) => `Magias do cajado ${n * 10}% mais rápidas.`, (s) => add(s, 'spd', 0.1));
b(W, 'caj3', 'Orbe Maior', '●', 'common', 2, () => 'O orbe grande (3º) fica 40% maior e causa +30% de dano.', (s) => { add(s, 'heavySize', 0.4); add(s, 'dmgH', 0.3); });
b(W, 'caj4', 'Velocidade Arcana', '»', 'common', 2, () => 'Orbes voam 25% mais rápido e vão 15% mais longe.', (s) => { add(s, 'boltSpeed', 0.25); add(s, 'range', 0.15); });
b(W, 'caj5', 'Orbe Duplo', '⁑', 'rare', 1, () => 'O 1º e o 2º golpe soltam 2 orbes cada.', (s) => add(s, 'boltNL', 1));
b(W, 'caj6', 'Explosão Arcana', '✹', 'rare', 2, (n) => `A explosão do orbe grande fica maior (raio ${n1(2.2 + n * 0.6)}) e o orbe grande causa +${n * 20}% de dano.`, (s) => { add(s, 'blastAdd', 0.6); add(s, 'dmgH', 0.2); });
b(W, 'caj7', 'Marca Arcana', '◈', 'rare', 2, (n) => `Orbes marcam o inimigo: ele leva +${n * 15}% de dano de tudo por 3 s.`, (s) => add(s, 'markHit', 0.15));
b(W, 'caj8', 'Atravessar', '⇶', 'epic', 1, () => 'Os orbes atravessam o 1º inimigo e seguem para o próximo.', (s) => add(s, 'pierce', 1));
b(W, 'caj9', 'Tríade', '⁂', 'epic', 1, () => 'O orbe grande vira 3 orbes grandes em leque.', (s) => add(s, 'boltNH', 2));
b(W, 'caj10', 'Singularidade', '◉', 'legendary', 1, () => 'O orbe grande puxa os inimigos em volta (raio 3,5) para o ponto do impacto e explode.', (s) => add(s, 'pullH', 3.5));

W = 'mage.eletrico';
b(W, 'ele1', 'Alta Voltagem', 'ϟ', 'common', 3, (n) => `+25% de dano em todos os raios. (total: +${n * 25}%)`, (s) => add(s, 'dmg', 0.25));
b(W, 'ele2', 'Descarga Rápida', '»', 'common', 2, (n) => `Raios do cajado elétrico ${n * 10}% mais rápidos.`, (s) => add(s, 'spd', 0.1));
b(W, 'ele3', 'Condutor', '↯', 'common', 2, (n) => `O raio pula para inimigos até ${n1(3 + n)} de distância do atingido.`, (s) => add(s, 'chainAdd', 1));
b(W, 'ele4', 'Faísca Longa', '↔', 'common', 2, (n) => `Os raios vão ${n * 20}% mais longe.`, (s) => { add(s, 'range', 0.2); });
b(W, 'ele5', 'Estática', '✦', 'rare', 2, (n) => `Os inimigos atingidos ficam atordoados ${n * 40}% mais tempo.`, (s) => add(s, 'stun', 0.4));
b(W, 'ele6', 'Tempestade', '☈', 'rare', 2, (n) => `O raio do 3º golpe em toda a sala causa +${n} de dano.`, (s) => add(s, 'zapAdd', 1));
b(W, 'ele7', 'Raio Duplo', '⁑', 'rare', 1, () => 'O 1º e o 2º golpe soltam 2 raios cada.', (s) => add(s, 'boltNL', 1));
b(W, 'ele8', 'Trovão', '✹', 'epic', 1, () => 'O raio do 3º golpe explode em área ao acertar (raio 2).', (s) => add(s, 'blastLast', 2));
b(W, 'ele9', 'Atravessar', '⇶', 'epic', 1, () => 'Cada raio acerta o 1º inimigo e segue para o próximo atrás dele.', (s) => add(s, 'pierce', 1));
b(W, 'ele10', 'Fúria da Tempestade', '⚡', 'legendary', 1, () => 'Todos os golpes (não só o 3º) dão 1 de dano em todos os inimigos da sala.', (s) => add(s, 'zapAll', 1));

W = 'mage.trevas';
b(W, 'tre1', 'Sombras Densas', '☠', 'common', 3, (n) => `+25% de dano nos orbes sombrios. (total: +${n * 25}%)`, (s) => add(s, 'dmg', 0.25));
b(W, 'tre2', 'Conjuração Sombria', 'ϟ', 'common', 2, (n) => `Magias do cajado das trevas ${n * 10}% mais rápidas.`, (s) => add(s, 'spd', 0.1));
b(W, 'tre3', 'Alcance Profano', '↔', 'common', 2, () => 'Orbes vão 15% mais longe e voam 20% mais rápido.', (s) => { add(s, 'range', 0.15); add(s, 'boltSpeed', 0.2); });
b(W, 'tre4', 'Orbe Gêmeo', '⁑', 'rare', 1, () => 'O 1º e o 2º golpe soltam 2 orbes cada.', (s) => add(s, 'boltNL', 1));
b(W, 'tre5', 'Maldição', '◈', 'rare', 2, (n) => `Inimigos atingidos levam +${n * 15}% de dano de tudo por 3 s.`, (s) => add(s, 'markHit', 0.15));
b(W, 'tre6', 'Pacto Sombrio', '✚', 'rare', 2, (n) => `Marcar um inimigo cura ${n * 2} de vida.`, (s) => add(s, 'markHeal', 2));
b(W, 'tre7', 'Ossos Fortes', '⛨', 'rare', 2, (n) => `Os mortos-vivos levantam com +${n * 6} de vida.`, (s) => add(s, 'undeadHp', 6));
b(W, 'tre8', 'Marca em Área', '✺', 'epic', 1, () => 'O 3º golpe explode em área (raio 2) e marca todos que pegar.', (s) => add(s, 'blastLast', 2));
b(W, 'tre9', 'Fúria dos Mortos', '⚔', 'epic', 1, () => 'Os mortos-vivos causam o dobro de dano.', (s) => add(s, 'undeadDmg', 1));
b(W, 'tre10', 'Exército das Trevas', '♛', 'legendary', 1, () => 'Todos os golpes marcam os inimigos (não só o 3º).', (s) => add(s, 'markAll', 1));

W = 'mage.gelo';
b(W, 'gel1', 'Gelo Afiado', '❄', 'common', 3, (n) => `+25% de dano nos orbes de gelo. (total: +${n * 25}%)`, (s) => add(s, 'dmg', 0.25));
b(W, 'gel2', 'Frio Intenso', '❅', 'common', 2, (n) => `A lentidão dos orbes dura ${n * 50}% mais.`, (s) => add(s, 'slow', 0.5));
b(W, 'gel3', 'Conjuração Gélida', 'ϟ', 'common', 2, (n) => `Magias do cajado de gelo ${n * 10}% mais rápidas.`, (s) => add(s, 'spd', 0.1));
b(W, 'gel4', 'Congelamento Longo', '⌛', 'common', 2, (n) => `O congelamento dura ${n * 25}% mais.`, (s) => add(s, 'freeze', 0.25));
b(W, 'gel5', 'Estilhaçar', '✸', 'rare', 2, (n) => `O golpe que estilhaça um congelado causa ${n1(2 + n * 0.5)}× o dano (em vez de 2×).`, (s) => add(s, 'shatter', 0.5));
b(W, 'gel6', 'Geada', '❆', 'rare', 1, () => 'O 1º e o 2º orbe têm 15% de chance de congelar o inimigo por 1,2 s (chefes não).', (s) => add(s, 'freezeChance', 0.15));
b(W, 'gel7', 'Frio Mortal', '☃', 'rare', 2, (n) => `+${n * 30}% de dano em inimigos lentos ou congelados.`, (s) => add(s, 'vsSlow', 0.3));
b(W, 'gel8', 'Nova Glacial', '✺', 'epic', 1, () => 'Ao estilhaçar um congelado, o gelo explode em volta: 12 de dano e lentidão.', (s) => add(s, 'frostNova', 12));
b(W, 'gel9', 'Lança de Gelo', '⇶', 'epic', 1, () => 'O 3º orbe atravessa todos os inimigos no caminho (congela todos).', (s) => add(s, 'pierceH', 99));
b(W, 'gel10', 'Zero Absoluto', '❄', 'legendary', 1, () => 'O 3º golpe congela também quem estiver perto do alvo (raio 2,5).', (s) => add(s, 'freezeAoe', 2.5));

W = 'mage.fogo';
b(W, 'fog1', 'Brasas', '♨', 'common', 3, (n) => `+25% de dano no fogo. (total: +${n * 25}%)`, (s) => add(s, 'dmg', 0.25));
b(W, 'fog2', 'Queimadura Forte', '✶', 'common', 3, (n) => `A queimadura causa +${n * 40}% de dano por segundo.`, (s) => add(s, 'burn', 0.4));
b(W, 'fog3', 'Fogo Duradouro', '⌛', 'common', 2, (n) => `A queimadura dura +${n1(n * 1.5)} s.`, (s) => add(s, 'burnTime', 1.5));
b(W, 'fog4', 'Sopro Largo', '◺', 'common', 2, () => 'O cone fica 15° mais aberto e a linha de fogo 20% mais longa.', (s) => { add(s, 'coneArc', 15); add(s, 'castLen', 0.2); });
b(W, 'fog5', 'Combustão', '✹', 'rare', 2, (n) => `+${n * 35}% de dano em inimigos queimando.`, (s) => add(s, 'vsBurn', 0.35));
b(W, 'fog6', 'Pavio Curto', 'ϟ', 'rare', 2, () => 'Magias de fogo 12% mais rápidas e a queimadura +20% mais forte.', (s) => { add(s, 'spd', 0.12); add(s, 'burn', 0.2); });
b(W, 'fog7', 'Explosão Maior', '◎', 'rare', 2, (n) => `A explosão (3º golpe) fica ${n * 25}% maior.`, (s) => add(s, 'novaR', 0.25));
b(W, 'fog8', 'Contágio', '☣', 'epic', 1, () => 'Inimigo que morre queimando explode em fogo: 10 de dano e põe fogo em quem estiver perto.', (s) => add(s, 'spreadBurn', 10));
b(W, 'fog9', 'Coração de Brasa', '✚', 'epic', 1, () => 'Acertar um inimigo queimando cura 1 de vida (no máximo a cada 0,3 s).', (s) => add(s, 'burnHeal', 1));
b(W, 'fog10', 'Inferno', '☀', 'legendary', 1, () => 'A explosão do 3º golpe deixa um círculo de fogo no chão por 3 s que queima quem passar.', (s) => add(s, 'fireField', 1));

// ---------------- Ladino ----------------
W = 'rogue.adagas';
b(W, 'ada1', 'Lâminas Afiadas', '⚔', 'common', 3, (n) => `+20% de dano nas adagas. (total: +${n * 20}%)`, (s) => add(s, 'dmg', 0.2));
b(W, 'ada2', 'Mãos Rápidas', 'ϟ', 'common', 3, (n) => `Golpes das adagas ${n * 8}% mais rápidos.`, (s) => add(s, 'spd', 0.08));
b(W, 'ada3', 'Olho Frio', '◎', 'common', 3, (n) => `+${n * 8}% de chance de crítico.`, (s) => { s.critChance += 0.08; });
b(W, 'ada4', 'Corte Profundo', '✠', 'common', 2, (n) => `O golpe forte das adagas causa +${n * 40}% de dano.`, (s) => add(s, 'dmgH', 0.4));
b(W, 'ada5', 'Golpe Cruel', '☠', 'rare', 2, (n) => `Críticos causam +${n * 50}% de dano (${n1(2 + n * 0.5)}× em vez de 2×).`, (s) => add(s, 'critDmg', 0.5));
b(W, 'ada6', 'Sangue Frio', '❄', 'rare', 1, () => 'Cada crítico deixa os golpes 25% mais rápidos por 2 s.', (s) => add(s, 'critHaste', 0.25));
b(W, 'ada7', 'Hemorragia', '♦', 'rare', 2, (n) => `${n * 20}% de chance por golpe de somar 1 de sangramento.`, (s) => add(s, 'bleedHit', 0.2));
b(W, 'ada8', 'Dança das Lâminas', '»', 'epic', 1, () => 'Depois de rolar, os golpes saem sempre críticos por 1,5 s.', (s) => add(s, 'dodgeCrit', 1));
b(W, 'ada9', 'Vampiro', '✚', 'epic', 1, () => 'Cada crítico cura 3 de vida.', (s) => add(s, 'critHeal', 3));
b(W, 'ada10', 'Mil Cortes', '✶', 'legendary', 1, () => 'Cada crítico corta de novo: um 2º corte com metade do dano.', (s) => add(s, 'critTwice', 0.5));

W = 'rogue.kunai';
b(W, 'kun1', 'Kunai Afiada', '✧', 'common', 3, (n) => `Dano base das kunais +2. (total: ${2 + n * 2})`, (s) => add(s, 'kBase', 2));
b(W, 'kun2', 'Corrente Forte', '⛓', 'common', 3, (n) => `Cada acúmulo da corrente vale +1 de dano. (total: ${3 + n} por acúmulo)`, (s) => add(s, 'kPer', 1));
b(W, 'kun3', 'Mãos Leves', 'ϟ', 'common', 2, (n) => `Arremessos ${n * 12}% mais rápidos.`, (s) => add(s, 'spd', 0.12));
b(W, 'kun4', 'Pegada Certeira', '◯', 'common', 2, (n) => `O círculo para pegar a kunai no ar fica ${n * 35}% maior.`, (s) => add(s, 'kCatch', 0.35));
b(W, 'kun5', 'Bolsa Extra', '✚', 'rare', 2, (n) => `+1 kunai. (total: ${2 + n})`, (s, p) => { add(s, 'ammo', 1); if (p && p.ammo && p.hero.ammo && p.hero.ammo.kind === 'kunai') p.ammo.push({ stack: 0 }); });
b(W, 'kun6', 'Ricochete de Aço', '⇶', 'rare', 1, () => 'A kunai atravessa o 1º inimigo e acerta mais um antes de cair.', (s) => add(s, 'kPierce', 1));
b(W, 'kun7', 'Disciplina', '☯', 'rare', 1, () => 'Pegar a kunai no ar dá +1 de corrente a ela.', (s) => add(s, 'kKeep', 1));
b(W, 'kun8', 'Ponta Envenenada', '♦', 'epic', 1, () => 'Kunais com corrente ×5 ou mais somam 1 de sangramento a cada acerto.', (s) => add(s, 'kBleed', 5));
b(W, 'kun9', 'Aço Resistente', '⛨', 'epic', 1, () => 'Bater em parede ou objeto não zera mais a corrente da kunai.', (s) => add(s, 'kWall', 1));
b(W, 'kun10', 'Tempestade de Aço', '☄', 'legendary', 1, () => 'O limite da corrente sobe de 15 para 30 e kunais com corrente ×10 ou mais sempre dão crítico.', (s) => { add(s, 'kMax', 15); add(s, 'kCrit', 10); });

W = 'rogue.garras';
b(W, 'gar1', 'Garras Longas', '↔', 'common', 2, (n) => `As garras alcançam ${n * 15}% mais longe.`, (s) => add(s, 'range', 0.15));
b(W, 'gar2', 'Unhas de Aço', '≋', 'common', 3, (n) => `+25% de dano nas garras. (total: +${n * 25}%)`, (s) => add(s, 'dmg', 0.25));
b(W, 'gar3', 'Frenesi Felino', 'ϟ', 'common', 2, (n) => `Golpes das garras ${n * 10}% mais rápidos.`, (s) => add(s, 'spd', 0.1));
b(W, 'gar4', 'Ferida Aberta', '♦', 'common', 2, (n) => `+${n * 30}% de dano em inimigos sangrando.`, (s) => add(s, 'vsBleed', 0.3));
b(W, 'gar5', 'Dilacerar', '✠', 'rare', 2, (n) => `O 5º golpe soma +${n} de sangramento a mais (total: ${1 + n}).`, (s) => add(s, 'bleedH', 1));
b(W, 'gar6', 'Arranhão', '⁘', 'rare', 2, (n) => `${n * 15}% de chance por golpe de somar 1 de sangramento.`, (s) => add(s, 'bleedHit', 0.15));
b(W, 'gar7', 'Hemofilia', '☠', 'rare', 2, (n) => `Cada sangramento tira ${1 + n} de vida em vez de 1.`, (s) => add(s, 'bleedDmg', 1));
b(W, 'gar8', 'Caçador', '✚', 'epic', 1, () => 'Acertar um inimigo sangrando cura 1 de vida (no máximo a cada 0,3 s).', (s) => add(s, 'bleedHeal', 1));
b(W, 'gar9', 'Garras Duplas', '⚔', 'epic', 1, () => 'Cada acerto tem 25% de chance de um 2º arranhão com metade do dano.', (s) => add(s, 'twiceChance', 0.25));
b(W, 'gar10', 'Sangria', '♆', 'legendary', 1, () => 'O sangramento também tira vida a cada 2 s, mesmo sem o inimigo atacar.', (s) => add(s, 'bleedTick', 2));

W = 'rogue.rapieira';
b(W, 'rap1', 'Ponta Fina', '†', 'common', 3, (n) => `+25% de dano nas estocadas. (total: +${n * 25}%)`, (s) => add(s, 'dmg', 0.25));
b(W, 'rap2', 'Passo Leve', '»', 'common', 2, () => 'As estocadas avançam 30% mais e saem 8% mais rápidas.', (s) => { add(s, 'lunge', 0.3); add(s, 'spd', 0.08); });
b(W, 'rap3', 'Florete Longo', '↔', 'common', 2, (n) => `A rapieira alcança ${n * 15}% mais longe.`, (s) => add(s, 'range', 0.15));
b(W, 'rap4', 'Estocada Final', '✠', 'common', 2, (n) => `O 3º golpe causa +${n * 40}% de dano.`, (s) => add(s, 'dmgH', 0.4));
b(W, 'rap5', 'Riposta', '⇄', 'rare', 2, (n) => `O contra-golpe depois de aparar causa +${n * 60}% de dano.`, (s) => add(s, 'parryDmg', 0.6));
b(W, 'rap6', 'Reflexos Felinos', '⟂', 'rare', 1, () => 'O tempo certo para aparar fica 50% maior.', (s) => add(s, 'parryWin', 0.5));
b(W, 'rap7', 'Golpe Traiçoeiro', '☠', 'rare', 2, (n) => `Ataques pelas costas causam +${n * 50}% de dano.`, (s) => add(s, 'backDmg', 0.5));
b(W, 'rap8', 'Aparar Restaurador', '✚', 'epic', 1, () => 'Cada aparada cura 5 de vida.', (s) => add(s, 'parryHeal', 5));
b(W, 'rap9', 'Duelista', '⇶', 'epic', 1, () => 'As estocadas atravessam e acertam mais 1 inimigo atrás do primeiro.', (s) => add(s, 'pierceMelee', 1));
b(W, 'rap10', 'Mestre Espadachim', '✺', 'legendary', 1, () => 'Aparar deixa desequilibrados todos os inimigos perto (raio 3).', (s) => add(s, 'parryAoe', 3));

W = 'rogue.besta';
b(W, 'bes1', 'Virote Pesado', '➹', 'common', 3, (n) => `+20% de dano no virote. (total: +${n * 20}%)`, (s) => add(s, 'dmg', 0.2));
b(W, 'bes2', 'Corda Tensa', 'ϟ', 'common', 3, (n) => `Disparo ${n * 12}% mais rápido.`, (s) => add(s, 'spd', 0.12));
b(W, 'bes3', 'Ponta Larga', '⇥', 'common', 2, () => 'O virote empurra o dobro e atordoa 30% mais tempo.', (s) => { add(s, 'pushMul', 1); add(s, 'stun', 0.3); });
b(W, 'bes4', 'Mira Firme', '◎', 'common', 2, (n) => `+${n * 40}% de dano em inimigos com a vida cheia.`, (s) => add(s, 'vsFull', 0.4));
b(W, 'bes5', 'Aljava', '✚', 'rare', 1, () => '+1 virote.', (s, p) => { add(s, 'ammo', 1); if (p && p.ammo && p.hero.ammo && p.hero.ammo.kind === 'bolt') p.ammo.push({ stack: 0 }); });
b(W, 'bes6', 'Atravessar', '⇶', 'rare', 2, (n) => `O virote atravessa e acerta mais ${n} inimigo${n > 1 ? 's' : ''}.`, (s) => add(s, 'bPierce', 1));
b(W, 'bes7', 'Recarga Mágica', '↺', 'rare', 1, () => 'Virote caído volta sozinho para a mão depois de 1,5 s.', (s) => add(s, 'bReturn', 1.5));
b(W, 'bes8', 'Virote Explosivo', '✹', 'epic', 1, () => 'O virote explode ao acertar um inimigo: 15 de dano em volta.', (s) => add(s, 'bBlast', 15));
b(W, 'bes9', 'Caçador de Chefes', '♛', 'epic', 1, () => '+50% de dano em chefes e em esqueletos com escudo.', (s) => add(s, 'vsBig', 0.5));
b(W, 'bes10', 'Disparo Mortal', '☠', 'legendary', 1, () => '+25% de chance de crítico; críticos com a besta causam o triplo do dano.', (s) => { s.critChance += 0.25; add(s, 'critDmg', 1); });

export const WEAPON_BLESSINGS = LIST;
export const weaponKey = (hero) => `${hero.id}.${hero.weaponId}`;

// Refaz os dados do herói com as bênçãos "de ficha" da arma (w = stats.w). Devolve o próprio objeto (alterado).
export function applyWeaponMods(hero, w) {
  if (!w || !Object.keys(w).length) return hero;
  const v = (k) => w[k] || 0;
  hero.combo = hero.combo.map((st0, i, arr) => {
    const st = { ...st0 };
    const heavy = !!st.heavy, last = i === arr.length - 1 && arr.length > 1;
    st.damage = st.damage * (1 + v('dmg') + (heavy ? v('dmgH') : v('dmgL')) + (i === 1 ? v('dmgIdx1') : 0) + v('ramp') * i);
    st.speed = st.speed * (1 + v('spd'));
    st.lunge = (st.lunge || 0) * (1 + v('lunge') + (heavy ? v('lungeH') : 0));
    if (heavy && v('blast')) st.blastMul = (st.blastMul || 1) * (1 + v('blast'));
    if (heavy && v('bleedH')) st.bleed = { stacks: ((st.bleed && st.bleed.stacks) || 0) + v('bleedH') };
    if (st.cast) {
      const c = st.cast = { ...st.cast };
      if (c.type === 'bolt') {
        const extra = heavy ? v('boltNH') : v('boltNL');
        if (extra) { c.count = (c.count || 1) + extra; c.spread = c.spread || 14; }
        c.speed *= 1 + v('boltSpeed');
        if (heavy) { c.size *= 1 + v('heavySize'); if (v('blastH')) c.blast = v('blastH'); if (v('pullH')) { c.pull = v('pullH'); c.blast = Math.max(c.blast || 0, 1.8); } }
        const pierce = v('pierce') + (heavy ? v('pierceH') : 0);
        if (pierce) c.pierce = pierce;
        if (c.blast && v('blastAdd')) c.blast += v('blastAdd');           // Explosão Arcana (Cajado Arcano)
        if (last && v('blastLast')) c.blast = Math.max(c.blast || 0, v('blastLast')); // Trovão / Marca em Área
        if (c.chain && v('chainAdd')) c.chain += v('chainAdd');          // Condutor
        if (c.roomZap && v('zapAdd')) c.roomZap += v('zapAdd');          // Tempestade
        if (v('zapAll')) c.roomZap = Math.max(c.roomZap || 0, 1);        // Fúria da Tempestade
        if (v('markAll') && hero.weaponId === 'trevas') c.darkMark = true; // Exército das Trevas
      }
      if (c.range) c.range *= 1 + v('range');
      if (c.length) c.length *= 1 + v('range') + v('castLen');
      if (c.arc && c.type === 'cone') c.arc += v('coneArc');
      if (c.radius) c.radius *= 1 + v('novaR');
      if (c.burn) c.burn *= 1 + v('burn');
      if (c.slow) c.slow *= 1 + v('slow');
      if (c.freeze) c.freeze *= 1 + v('freeze');
      if (heavy && v('knock')) c.knock = (c.knock || 0) + v('knock');
    }
    return st;
  });
  hero.heavyIdx = Math.max(0, hero.combo.findIndex((c) => c.heavy));
  hero.attackRange *= 1 + v('range');
  hero.attackArc += v('arc');
  if (hero.ammo && v('ammo')) hero.ammo = { ...hero.ammo, max: hero.ammo.max + v('ammo') };
  return hero;
}

// Bênçãos gerais que não fazem sentido para certas armas (needs = o herói precisa ter isso).
const hasHeavy = (h) => h.combo.some((c) => c.heavy);
const finite = (h) => !h.ammo;       // Kunais/Besta têm alcance infinito
const blasts = (h) => !h.caster && !h.single && hasHeavy(h); // onda de choque do golpe forte (corpo a corpo em área)
export const GENERAL_NEEDS = {
  alcance: finite,                                           // Sem Limites: nada a ganhar com alcance infinito
  fogo: (h) => hasHeavy(h) && h.weaponId !== 'fogo',        // Lâmina Flamejante: precisa de golpe forte; o Cajado de Fogo já queima
  terremoto: blasts,                                         // Terremoto: só onde existe a onda de choque
  eco: hasHeavy,                                             // Eco do Golpe: sai do golpe forte
  frenesi: hasHeavy,                                         // Frenesi: atordoa mais com o último golpe do combo
  potencia: hasHeavy,                                        // Potência: o último golpe do combo quebra escudos
};
