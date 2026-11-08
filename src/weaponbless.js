// Bênçãos exclusivas de cada arma (10+ por arma, 15 armas). Só aparecem para o herói usando aquela arma.
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
b(W, 'esp13', 'Placas de Mitral', '◈', 'rare', 2, (n) => `${n * 25}% de chance de um bloqueio não gastar o escudo.`, (s) => { s.mithril += 0.25; });
b(W, 'esp14', 'Escudo de Espinhos', '✶', 'common', 3, (n) => `Bloquear um golpe devolve ${n * 15} de dano ao atacante.`, (s) => { s.thorns += 15; });
b(W, 'esp15', 'Escudo Reforçado', '⛨', 'common', 3, (n) => `O escudo aguenta +5 bloqueios e fica novo agora. (total: ${10 + n * 5} bloqueios)`, (s, p) => { s.shieldBonus += 5; if (p) repairShield(p); });
b(W, 'esp16', 'Arremesso', '➚', 'epic', 1, () => 'O combo ganha um 4º golpe que arremessa o escudo (14 de dano). Ele para no 1º inimigo ou parede e cai no chão: vá buscá-lo. Sem o escudo, não dá para bloquear.', (s) => add(s, 'shieldThrow', 1));
b(W, 'esp17', 'Pancada', '✦', 'epic', 2, (n) => `O golpe forte (3º do combo) atordoa por ${n} segundo${n > 1 ? 's' : ''}.`, (s) => add(s, 'heavyDaze', 1));
b(W, 'esp18', 'Lâmina Afiada', '♦', 'epic', 3, (n) => `Cada golpe do Cavaleiro tem ${n * 10}% de chance de causar sangramento.`, (s) => add(s, 'bleedHit', 0.1));
b(W, 'esp6', 'Guarda Curativa', '✚', 'rare', 2, (n) => `Cada golpe bloqueado cura ${n * 3} de vida.`, (s) => add(s, 'blockHeal', 3));
b(W, 'esp7', 'Lâmina Justa', '⚖', 'rare', 2, (n) => `+${n * 40}% de dano em inimigos atordoados, desequilibrados ou congelados.`, (s) => add(s, 'vsStun', 0.4));
b(W, 'esp8', 'Golpe Duplo', '⚔', 'epic', 1, () => 'O golpe forte acerta duas vezes (o 2º impacto com metade do dano).', (s) => add(s, 'twiceH', 0.5));
b(W, 'esp9', 'Lâmina Sagrada', '✧', 'epic', 1, () => '+10% de chance de crítico; cada crítico cura 4 de vida.', (s) => { s.critChance += 0.1; add(s, 'critHeal', 4); });
b(W, 'esp10', 'Juramento do Paladino', '↯', 'legendary', 1, () => 'O golpe forte solta um raio que pula para 3 inimigos perto (12 de dano cada).', (s) => add(s, 'heavyChain', 3));
b(W, 'esp19', 'Bilhar de Ossos', '◉', 'epic', 1, () => 'Todo inimigo que bater no seu escudo enquanto você bloqueia voa como uma bola e derruba os outros em cadeia. Bater na parede causa 25 de dano (chefes não voam).', (s) => add(s, 'billiard', 1));
b(W, 'esp20', 'Espada Arremessada', '†', 'legendary', 1, () => 'O combo ganha um golpe depois do 3º que atira a espada: ela atravessa todos e fica cravada onde cair. Sem ela, você luta com pancadas de escudo e o mesmo golpe chama a espada de volta, cortando tudo no caminho (ou passe por cima dela para pegar).', (s) => add(s, 'swordThrow', 1));
b(W, 'esp21', 'Trenó de Escudo', '⛷', 'epic', 1, () => 'Segure o bloqueio e aperte rolar: você desliza sentado no escudo enquanto segura (até 2 s), sem levar dano, e quem for atropelado pega fogo. Sem recarga: cada deslizada gasta 1 carga do escudo. (Não vem junto com o Cavalo Fantasma.)', (s) => add(s, 'sled', 1));
b(W, 'esp31', 'Escudo Flamejante', '♨', 'legendary', 1, () => 'O escudo fica envolto em chamas: todo inimigo que bater nele pega fogo.', (s) => add(s, 'flameShield', 1));
b(W, 'esp23', 'Corrente no Escudo', '⛓', 'epic', 1, () => 'Levantar o escudo lança um gancho que puxa até você o 1º inimigo da frente, até arqueiros e magos lá de trás (a cada 2 s). O inimigo puxado não te machuca no esbarrão.', (s) => add(s, 'hook', 1));
b(W, 'esp24', 'Mãos Trocadas', '⇄', 'legendary', 1, () => 'O escudo passa a atacar, com pancadas que empurram longe e atordoam pelo dobro do tempo. A espada passa a defender: corta sozinha as flechas que iam te acertar e quem atacar enquanto você bloqueia leva dano (12). Toda defesa da espada gasta 1 carga do escudo.', (s) => add(s, 'swap', 1));
b(W, 'esp25', 'Rastro Fantasma', '≈', 'epic', 1, () => 'Cada golpe deixa um corte brilhando no ar, que corta de novo 1 s depois (60% do dano). Atraia os inimigos para eles.', (s) => add(s, 'trail', 1));
// 2ª leva (02/11/2026) — knightkit2.js.
b(W, 'esp26', 'Duelo Sagrado', '⚜', 'epic', 1, () => 'A cada onda (menos na sala do chefe), você desafia o inimigo mais forte. Um círculo dourado prende vocês dois e ninguém entra (nem golpes, nem flechas) até um cair. Vencer o duelo conserta o escudo e cura 10 de vida.', (s) => add(s, 'duel', 1));
b(W, 'esp27', 'Vassalo', '♛', 'legendary', 1, () => 'O último esqueleto de uma onda se ajoelha e você o nomeia cavaleiro: ganha ombreira e capa e luta do seu lado (só 1 vassalo por vez). O da última onda vai com você e luta também na próxima sala.', (s) => add(s, 'vassal', 1));
b(W, 'esp32', 'Demolidor', '♜', 'epic', 1, () => 'O golpe forte (3º do combo) derruba pilares e estruturas que não quebram, na direção do maior grupo de inimigos. Quem for esmagado perde 50% da vida máxima (chefes: 20%).', (s) => add(s, 'demolish', 1));
b(W, 'esp29', 'Cavalo Fantasma', '♞', 'legendary', 1, () => 'Segure o bloqueio e aperte rolar: um cavalo fantasma surge e você galopa por 2 s sem levar dano, atropelando tudo (10 de dano). Quem for atropelado fica enterrado até 2 s depois de você desmontar. Atacar desmonta na hora. Sem recarga: cada galope gasta 1 carga do escudo. (Não vem junto com o Trenó de Escudo.)', (s) => add(s, 'horse', 1));
b(W, 'esp30', 'Espada Amaldiçoada', '☠', 'epic', 1, () => 'Em cada sala a espada escolhe quem deve cair primeiro (“O primeiro: um arqueiro!”). Se o 1º inimigo derrotado for desse tipo, ganhe um prêmio (ouro, vida ou ultimate). Se for outro, ela te machuca na hora (15 de dano).', (s) => add(s, 'curse', 1));

W = 'knight.machado';
// Lista do dono (02/11/2026). As que mudam o jeito de jogar ficam em axekit.js.
b(W, 'mac11', 'Sede de Batalha', '♨', 'common', 2, (n) => `Cada inimigo derrotado aumenta seu dano em ${n * 3}% até sair da sala.`, (s) => add(s, 'roomRamp', 0.03));
b(W, 'mac4', 'Braços de Ferro', 'ϟ', 'common', 2, (n) => `O golpe forte executa inimigos que ficariam com ${n * 25}% da vida ou menos (chefes não).`, (s) => add(s, 'execute', 0.25));
b(W, 'mac5', 'Racha-Crânios', '☠', 'rare', 2, (n) => `Quando um inimigo é derrotado, os inimigos perto dele ficam paralisados por ${n1(n * 1.5)} s.`, (s) => add(s, 'killDaze', 1.5));
b(W, 'mac12', 'Redemoinho', '↺', 'rare', 1, () => 'O giro (2º golpe) rebate flechas e magias de volta para quem atirou e te deixa imune a esbarrões até o fim do combo.', (s) => add(s, 'whirl', 1));
b(W, 'mac7', 'Lenhador', '⛏', 'rare', 2, (n) => `+${n * 50}% de dano em chefes e em esqueletos com escudo.`, (s) => add(s, 'vsBig', 0.5));
b(W, 'mac15', 'Tornado', '❂', 'rare', 1, () => 'O giro puxa os inimigos em volta para perto de você, juntando todos para a machadada forte (chefes não).', (s) => add(s, 'tornado', 1));
b(W, 'mac16', 'Giro Crescente', '◎', 'rare', 1, () => 'Cada inimigo acertado pelo giro deixa os próximos giros maiores (+6% cada, até +80%), até o fim da sala.', (s) => add(s, 'spinGrow', 1));
b(W, 'mac8', 'Machado Sedento', '✚', 'epic', 1, () => 'Cada inimigo acertado pelo giro cura 2 de vida.', (s) => add(s, 'spinHeal', 2));
b(W, 'mac9', 'Terremoto Rubro', '≋', 'epic', 1, () => 'O golpe forte deixa os inimigos lentos por 3 s; todos os golpes atordoam 50% mais tempo.', (s) => { add(s, 'slowH', 3); add(s, 'stun', 0.5); });
b(W, 'mac14', 'Pião', '✺', 'epic', 1, () => 'Aperte e segure o ataque durante o giro: você continua girando sem parar e anda devagar. Solte para a machadada forte.', (s) => add(s, 'spinTop', 1));
// 2ª leva (04/11/2026) — axekit2.js.
b(W, 'mac18', 'Fenda', '⚡', 'epic', 1, () => 'A machadada forte abre uma rachadura em linha reta no chão, que joga para cima os inimigos no caminho (18 de dano; chefes só levam o dano).', (s) => add(s, 'fissure', 1));
b(W, 'mac19', 'Corte ao Meio', '⚔', 'rare', 1, () => 'A machadada forte que derrota um esqueleto parte ele em dois, e as metades voam para os lados acertando quem estiver perto (20 de dano).', (s) => add(s, 'halve', 1));
b(W, 'mac20', 'Decapitar', '☠', 'legendary', 1, () => 'A machadada forte num inimigo com 30% da vida ou menos arranca a cabeça dele. O corpo sem cabeça anda sem rumo por 3 s batendo nos próprios aliados e depois cai (chefes não).', (s) => add(s, 'decap', 1));
b(W, 'mac21', 'Desmembrar', '✂', 'rare', 1, () => 'A machadada forte arranca o braço da arma do esqueleto. Desarmado, ele perde os ataques especiais e só consegue tentar morder (metade do dano; chefes não).', (s) => add(s, 'dismember', 1));
b(W, 'mac22', 'Derrubar Pilar', '♜', 'legendary', 1, () => 'A machadada forte num pilar, coluna ou estrutura da sala derruba ele em cima dos inimigos, na direção do maior grupo. Quem for esmagado perde 50% da vida máxima (chefes: 20%).', (s) => add(s, 'pillar', 1));
b(W, 'mac23', 'Estilhaços de Escudo', '✹', 'rare', 1, () => 'A machadada forte quebra o escudo dos esqueletos, e os pedaços voam para todo lado acertando os vizinhos (12 de dano cada).', (s) => add(s, 'shieldShards', 1));
b(W, 'mac24', 'Faíscas', '✦', 'rare', 1, () => 'Bater o machado em parede ou em escudo solta faíscas que põem fogo em quem estiver perto (5 de dano por segundo, 3 s).', (s) => add(s, 'sparks', 1));
// 3ª leva (06/11/2026) — axekit3.js.
b(W, 'mac25', 'Imparável', '⛨', 'epic', 1, () => 'Durante o giro e a machadada forte, nenhum golpe interrompe você (o dano ainda entra), e quem encostar em você é empurrado.', (s) => add(s, 'unstoppable', 1));
b(W, 'mac26', 'Investida Bruta', '➠', 'rare', 1, () => 'Rolar por dentro de um esqueleto com escudo faz o inimigo ficar parado por 2 segundos.', (s) => add(s, 'rollBash', 1));
b(W, 'mac27', 'Arrastar a Lâmina', '⚟', 'epic', 1, () => 'Segure o ataque andando: o machado arrasta no chão soltando faíscas e acumulando força (até 2 s). Ao soltar, a machadada forte explode (até 42 de dano em volta).', (s) => add(s, 'drag', 1));
b(W, 'mac28', 'Grito de Guerra', '❢', 'legendary', 1, () => '3 abates seguidos (menos de 3,5 s entre eles) soltam um grito: os inimigos perto largam as armas no chão e fogem de medo. Só depois de 6 s eles tentam pegar as armas de volta (chefes não).', (s) => add(s, 'warcry', 1));
b(W, 'mac29', 'Maestria', '⊸', 'rare', 1, () => 'Atacar logo depois de rolar: o primeiro golpe sai 100% mais rápido.', (s) => add(s, 'maestry', 1));
b(W, 'mac30', 'Machado como Escudo', '⛊', 'epic', 1, () => 'Segure o ataque parado: a lâmina larga fica na sua frente e segura flechas e magias. Assim o Cavaleiro sem escudo tem alguma defesa.', (s) => add(s, 'axeGuard', 1));
b(W, 'mac31', 'Arremesso Serra', '✇', 'legendary', 1, () => 'A machadada forte arremessa o machado, que crava no chão e fica girando como uma serra por 2 s (cortando quem estiver perto) antes de voltar para a mão. Enquanto isso, você luta com socos.', (s) => add(s, 'sawThrow', 1));
b(W, 'mac32', 'Futebol de Crânio', '☻', 'rare', 1, () => 'Esqueletos derrotados por você deixam o crânio no chão. Passe por cima para chutá-lo no inimigo mais perto (16 de dano).', (s) => add(s, 'skullBall', 1));
b(W, 'mac33', 'Machado Faminto', '♆', 'epic', 1, () => 'Arma amaldiçoada com fome de briga: se você ficar 4 s sem acertar ninguém, o machado puxa o inimigo mais perto até você. O puxado fica atordoado um instante e não te machuca no esbarrão por 2 s (chefes não).', (s) => add(s, 'hungry', 1));
b(W, 'mac13', 'Arremesso Mortal', '➚', 'legendary', 1, () => 'O combo ganha um 4º golpe: o machado é arremessado girando, vai longe e volta, cortando tudo no caminho (30 de dano na ida e na volta). Você fica parado esperando ele voltar.', (s) => add(s, 'axeThrow', 1));

W = 'knight.mangual';
// Lista do dono (06/11/2026). Os efeitos novos ficam em flailkit.js.
b(W, 'man3', 'Pancada Atordoante', '✦', 'common', 3, (n) => `Os inimigos ficam atordoados ${n * 30}% mais tempo.`, (s) => add(s, 'stun', 0.3));
b(W, 'man4', 'Rodopio', '⟳', 'common', 1, () => 'Golpes do mangual destroem flechas e magias.', (s) => add(s, 'swipe', 1));
b(W, 'man11', 'Corrente Enroscada', '∞', 'common', 1, () => 'O terceiro golpe enterra o inimigo mais distante atingido por 1,5 s (chefes: 0,5 s).', (s) => add(s, 'snare', 1));
b(W, 'man5', 'Esmaga-Guarda', '⛨', 'rare', 1, () => 'Todos os golpes do mangual quebram a guarda: passam pelo escudo e atordoam até os resistentes.', (s) => add(s, 'guardBreak', 1));
b(W, 'man12', 'Equilíbrio', '⚖', 'rare', 1, () => 'É possível atacar enquanto se defende com o escudo.', (s) => add(s, 'blockAtk', 1));
b(W, 'man13', 'Reflexo', '↺', 'rare', 1, () => 'Bloquear um golpe faz o Cavaleiro lançar sozinho a bola do mangual, esticando a corrente até o inimigo mais distante. Não leva dano durante o lançamento nem no segundo seguinte.', (s) => add(s, 'autoCounter', 1));
b(W, 'man8', 'Impacto Sísmico', '≋', 'epic', 3, (n) => `O golpe forte deixa marcados (6 s) todos os inimigos atingidos. Inimigos marcados sofrem ${n * 25}% mais dano.`, (s) => add(s, 'seismic', 0.25));
b(W, 'man14', 'Corrente', '⇐', 'epic', 1, () => 'Ao defender uma flecha ou magia com o escudo, o Cavaleiro joga a corrente do mangual em quem atirou e puxa ele para perto.', (s) => add(s, 'chainPull', 1));
b(W, 'man10', 'Estrela da Manhã', '✺', 'legendary', 1, () => 'O primeiro e o segundo golpe do combo atordoam por 1 segundo.', (s) => add(s, 'morningStar', 1));

W = 'knight.lanca';
// Lista do dono (06/11/2026). Os efeitos ficam em lancekit.js / lancekit2.js.
b(W, 'lan11', 'Ponta Doce', '◎', 'rare', 1, () => 'Acertar com a pontinha, no limite do alcance, é sempre crítico. De perto a lança só empurra (sem dano).', (s) => add(s, 'sweet', 1));
b(W, 'lan12', 'Pregar na Parede', '⊣', 'rare', 1, () => 'Se a estocada empurra o esqueleto contra uma parede ou pilar, ele fica pregado ali, atordoado, por 2 s.', (s) => add(s, 'nail', 1));
b(W, 'lan13', 'Contra-Carga', '⇤', 'epic', 1, () => 'Inimigo que vem correndo na sua direção (investida do Guerreiro, salto) e leva a ponta para na hora e toma o triplo de dano.', (s) => add(s, 'counterCharge', 1));
b(W, 'lan14', 'Muralha de Pontas', '⩚', 'epic', 1, () => 'Ficar parado 1 s com a lança apontada põe você em guarda: qualquer inimigo que entrar na frente é espetado sozinho.', (s) => add(s, 'spearWall', 1));
b(W, 'lan15', 'Arpão', '⥢', 'rare', 1, () => 'O golpe forte lança um arpão que puxa até você o inimigo atingido, até o mago lá de trás.', (s) => add(s, 'harpoon', 1));
b(W, 'lan16', 'Espetinho', '⚲', 'epic', 1, () => 'O golpe forte deixa o esqueleto preso na ponta da lança. O próximo golpe arremessa o corpo como projétil contra os outros.', (s) => add(s, 'skewer', 1));
b(W, 'lan17', 'Lança Bumerangue', '↺', 'legendary', 1, () => 'O golpe forte arremessa a lança para a frente: ela atravessa todo mundo e volta para a sua mão, acertando de novo na volta.', (s) => add(s, 'lanceBoomer', 1));
b(W, 'lan18', 'Lança Cravada', '⚡', 'epic', 1, () => 'O golpe forte arremessa a lança, que fica cravada no chão soltando choques em quem passa perto. Até ir buscá-la, você luta na base do soco.', (s) => add(s, 'lancePlant', 1));
b(W, 'lan19', 'Salto com Vara', '⤴', 'rare', 1, () => 'Rolar na direção de um inimigo usa a lança como vara: você pula por cima dele e cai nas costas dele. O próximo golpe é crítico.', (s) => add(s, 'vault', 1));
b(W, 'lan20', 'Salto do Dragão', '⇑', 'legendary', 1, () => 'Atacar logo depois de rolar vira um salto alto que cai cravando a lança no chão, com dano em área e empurrão.', (s) => add(s, 'dragonLeap', 1));
b(W, 'lan21', 'Âncora', '⚓', 'rare', 1, () => 'O golpe forte crava a lança no chão e você gira em volta dela dando um chute circular que afasta todo mundo.', (s) => add(s, 'anchor', 1));
b(W, 'lan22', 'Estandarte de Guerra', '⚑', 'epic', 1, () => 'Matar um inimigo com o golpe forte deixa uma bandeira cravada no chão. Perto dela você anda mais rápido e se cura aos poucos por 6 s.', (s) => add(s, 'banner', 1));
b(W, 'lan23', 'Cemitério de Lanças', '✝', 'rare', 1, () => 'Cada esqueleto morto pela lança deixa uma lança fantasma cravada no lugar, que espeta quem pisar ali.', (s) => add(s, 'graves', 1));
b(W, 'lan24', 'Para-raios', 'ϟ', 'epic', 1, () => 'A cada 5 estocadas que acertam, cai um raio na ponta da lança, no alvo da vez.', (s) => add(s, 'rod', 1));
b(W, 'lan25', 'Espinhos de Pedra', '▲', 'epic', 1, () => 'O golpe forte faz uma fileira de espinhos brotar do chão em linha reta, bem além do alcance normal.', (s) => add(s, 'spikes', 1));
b(W, 'lan26', 'Estocada Fantasma', '⇉', 'rare', 1, () => 'Meio segundo depois de cada estocada, uma lança espectral repete o mesmo golpe no mesmo lugar. Quem entrar ali depois também leva.', (s) => add(s, 'ghostStab', 1));
b(W, 'lan27', 'Mil Lanças', '⁂', 'legendary', 1, () => 'Se os 3 golpes do combo acertarem o mesmo inimigo, sai um 4º golpe extra: uma rajada de estocadas rapidíssimas.', (s) => add(s, 'flurry', 1));
b(W, 'lan28', 'Molinete', '✇', 'rare', 1, () => 'Apertar ataque logo depois do golpe forte faz você girar a lança, rebatendo flechas e magias dos esqueletos de volta.', (s) => add(s, 'molinete', 1));
b(W, 'lan29', 'Lança de Troféus', '☠', 'legendary', 1, () => 'Cada inimigo morto deixa um crânio espetado na lança, até 3. O golpe forte arremessa os crânios como bombas.', (s) => add(s, 'trophy', 1));
b(W, 'lan30', 'Domador', '❦', 'epic', 1, () => 'O golpe forte num esqueleto com pouca vida faz ele mudar de lado e lutar por você até o fim da sala. Depois ele vira pó.', (s) => add(s, 'tame', 1));
b(W, 'lan10', 'Lança do Dragão', '♨', 'legendary', 1, () => 'O golpe forte solta uma rajada de fogo em linha reta que atravessa todos (20 de dano e queima).', (s) => add(s, 'fireLine', 20));

W = 'knight.manopla';
// Lista do dono (06/11/2026). Os efeitos ficam em fistkit.js / fistkit2.js.
b(W, 'mnp11', 'Arremesso', '➚', 'rare', 1, () => 'O golpe forte agarra o esqueleto e joga ele para a frente. Quem estiver no caminho leva dano e cai.', (s) => add(s, 'fistToss', 1));
b(W, 'mnp12', 'Suplex', '⤾', 'epic', 1, () => 'O golpe forte agarra o inimigo e bate ele no chão atrás de você, com um impacto em área. Serve para quando você está cercado.', (s) => add(s, 'suplex', 1));
b(W, 'mnp13', 'Escudo de Carne', '☗', 'rare', 1, () => 'Atacar enquanto bloqueia agarra o esqueleto mais perto e usa ele como escudo contra flechas e magias por 2 s. No fim, o Cavaleiro chuta ele para longe (sem levar dano no chute nem no segundo seguinte).', (s) => add(s, 'meat', 1));
b(W, 'mnp14', 'Quebra-Escudo', '⛨', 'epic', 1, () => 'Socar um esqueleto com escudo arranca o escudo da mão dele. O próximo golpe forte arremessa esse escudo como um disco que quica entre inimigos.', (s) => add(s, 'shieldRip', 1));
b(W, 'mnp15', 'Strike', '◉', 'rare', 1, () => 'Inimigo nocauteado pelo golpe forte sai voando como bola de boliche e derruba todo mundo que acertar.', (s) => add(s, 'strike', 1));
b(W, 'mnp16', 'Pinball', '⇋', 'epic', 1, () => 'Inimigo socado contra a parede quica de volta direto para o seu próximo soco. Dá para fazer combo infinito na parede.', (s) => add(s, 'pinball', 1));
b(W, 'mnp17', 'Soco Sísmico', '≋', 'epic', 1, () => 'O golpe forte vira um soco no chão. Todos em volta caem sentados por 1 s.', (s) => add(s, 'quake', 1));
b(W, 'mnp18', 'Soco de Vento', '≈', 'rare', 1, () => 'O golpe forte solta uma onda de ar que acerta inimigos até 5 de distância.', (s) => add(s, 'wind', 1));
b(W, 'mnp19', 'Punho Foguete', '☄', 'legendary', 1, () => 'O golpe forte dispara a manopla como um foguete que explode no 1º inimigo e volta voando para a sua mão.', (s) => add(s, 'rocket', 1));
b(W, 'mnp20', 'Investida de Punho', '»', 'rare', 1, () => 'Atacar logo depois de rolar vira um soco que avança até o inimigo mais próximo à frente, mesmo longe.', (s) => add(s, 'fistDash', 1));
b(W, 'mnp21', 'Corrente de Nocautes', '⤳', 'legendary', 1, () => 'Ao derrubar um inimigo com um soco, você salta sozinho até o próximo inimigo perto e já chega batendo. Dá para limpar a sala pulando de um em um.', (s) => add(s, 'koChain', 1));
b(W, 'mnp22', 'Pegar no Ar', '✋', 'epic', 1, () => 'Levantar o escudinho no instante em que uma flecha ou magia chega faz você pegar ela no ar. O próximo soco joga ela de volta.', (s) => add(s, 'catchShot', 1));
b(W, 'mnp24', 'Contragolpe Relâmpago', '↯', 'epic', 1, () => 'Bloquear no tempo certo devolve na hora um soco automático, sem gastar o escudo.', (s) => add(s, 'zap', 1));
b(W, 'mnp25', 'Soco Carregado', '✊', 'epic', 1, () => 'Segurar o botão carrega um único soco gigante. Quanto mais tempo segurando, mais longe o inimigo voa (e quem ele acertar no caminho também).', (s) => add(s, 'chargePunch', 1));
b(W, 'mnp26', 'Contador de Combo', '#', 'legendary', 1, () => 'Um contador de acertos seguidos aparece na tela. A cada 10 sem tomar dano, sai uma onda de choque em volta. Se tomar dano, o contador zera.', (s) => add(s, 'comboCount', 1));
b(W, 'mnp27', 'Pavio', '✹', 'epic', 1, () => 'Cada soco gruda uma faísca no inimigo, até 5. O golpe forte detona todas de uma vez.', (s) => add(s, 'fuse', 1));
b(W, 'mnp28', 'Desmontar', '☠', 'rare', 1, () => 'Cada combo completo no mesmo esqueleto arranca um pedaço dele. No 2º, ele perde a arma e só consegue empurrar.', (s) => add(s, 'dismantle', 1));
b(W, 'mnp29', 'Duelo', '⚔', 'epic', 1, () => 'O golpe forte desafia o inimigo atingido. Os outros param de atacar você por 4 s ou até ele cair.', (s) => add(s, 'duel', 1));
b(W, 'mnp30', 'Saco de Pancadas', '♨', 'legendary', 1, () => 'Esqueleto que leva 8 socos seguidos explode em ossos para todos os lados, acertando quem estiver em volta.', (s) => add(s, 'punchBag', 1));

// ---------------- Maga ----------------
W = 'mage.cajado';
b(W, 'caj5', 'Orbe Duplo', '⁑', 'rare', 1, () => 'O 1º e o 2º golpe soltam 2 orbes cada.', (s) => add(s, 'boltNL', 1));
b(W, 'caj7', 'Marca Arcana', '◈', 'rare', 2, (n) => `Orbes marcam o inimigo: ele leva +${n * 15}% de dano de tudo por 3 s.`, (s) => add(s, 'markHit', 0.15));
b(W, 'caj8', 'Atravessar', '⇶', 'epic', 1, () => 'Os orbes atravessam o 1º inimigo e seguem para o próximo.', (s) => add(s, 'pierce', 1));
b(W, 'caj9', 'Tríade', '⁂', 'epic', 1, () => 'O orbe grande vira 3 orbes grandes em leque.', (s) => add(s, 'boltNH', 2));
b(W, 'caj10', 'Singularidade', '◉', 'legendary', 1, () => 'O orbe grande puxa os inimigos em volta (raio 3,5) para o ponto do impacto e explode.', (s) => add(s, 'pullH', 3.5));
// Lista do dono (06/11/2026): somam às 10 de cima. Os efeitos ficam em arcanekit.js / arcanekit2.js.
b(W, 'caj11', 'Ponto de Estouro', '✺', 'rare', 1, () => 'O orbe que chega ao fim do alcance sem acertar ninguém explode ali mesmo, numa área pequena. Errar deixa de ser desperdício.', (s) => add(s, 'aBurst', 1));
b(W, 'caj12', 'Pancada de Cajado', '⚚', 'rare', 1, () => 'Com um inimigo colado na Maga, o golpe vira uma pancada com o cajado que joga ele longe e atordoa.', (s) => add(s, 'aBash', 1));
b(W, 'caj13', 'Armadura Arcana', '⛉', 'epic', 1, () => 'Cada orbe que acerta cria uma camada de mana em volta da Maga, até 5. Cada camada anula 3 de dano.', (s) => add(s, 'aArmor', 1));
b(W, 'caj14', 'Bolha Arcana', '◌', 'epic', 1, () => 'O orbe grande prende o inimigo numa bolha por 3 s, sem andar nem atacar. Acerte a bolha com outro orbe para estourar e machucar todos em volta.', (s) => add(s, 'aBubble', 1));
b(W, 'caj15', 'Esfera Moedora', '◍', 'legendary', 1, () => 'O orbe grande voa bem devagar, mas atravessa todo mundo e vai machucando sem parar quem estiver dentro dele.', (s) => add(s, 'aGrind', 1));
b(W, 'caj16', 'Mina Arcana', '⊛', 'rare', 1, () => 'Orbes que erram não somem: ficam parados no chão e explodem quando um esqueleto passa.', (s) => add(s, 'aMine', 1));
b(W, 'caj17', 'Órbita', '☉', 'epic', 1, () => 'Orbes que erram voltam e ficam girando em volta da Maga por 4 s, acertando quem chegar perto.', (s) => add(s, 'aOrbit', 1));
b(W, 'caj18', 'Triângulo Arcano', '△', 'legendary', 1, () => 'Cada combo completo deixa uma runa no chão (até 3). Com 3 runas, elas se ligam por linhas de luz que machucam e deixam lento quem atravessar.', (s) => add(s, 'aRunes', 1));
b(W, 'caj19', 'Constelação', '✧', 'epic', 1, () => 'Cada inimigo atingido ganha uma estrela. Inimigos com estrela perto uns dos outros ficam ligados por um raio de luz que machuca os dois.', (s) => add(s, 'aStars', 1));
b(W, 'caj20', 'Encolher', '⇲', 'epic', 1, () => 'O orbe grande encolhe o esqueleto por 4 s: ele fica pequeno, lento e causa metade do dano.', (s) => add(s, 'aShrink', 1));
b(W, 'caj21', 'Levitar', '⇡', 'rare', 1, () => 'O orbe grande faz o inimigo flutuar indefeso por 2 s. Quando cai, leva dano da queda.', (s) => add(s, 'aLevit', 1));
b(W, 'caj23', 'Repulsor', '⊕', 'rare', 1, () => 'O orbe grande explode empurrando todo mundo para longe. É o contrário da Singularidade: serve para respirar quando está cercada.', (s) => add(s, 'aRepel', 1));
b(W, 'caj24', 'Ressonância', '≋', 'epic', 1, () => 'Se os 3 orbes do combo acertarem o mesmo inimigo, ele vira uma bomba arcana e explode 1 s depois.', (s) => add(s, 'aRes', 1));
b(W, 'caj25', 'Carga Paciente', '⌛', 'rare', 1, () => 'Ficar 2 s sem atacar junta orbes flutuando em volta da Maga, até 5. No próximo ataque, todos disparam juntos.', (s) => add(s, 'aPatient', 1));
b(W, 'caj26', 'Fusão', '⊗', 'rare', 1, () => 'Dois orbes que se tocam no ar viram um orbe maior. O orbe que erra espera um instante no ar: atirar rápido e em sequência passa a valer a pena.', (s) => add(s, 'aFuse', 1));
b(W, 'caj27', 'Devorador', '◐', 'epic', 1, () => 'Os orbes engolem flechas e magias inimigas no caminho. Cada uma engolida deixa o orbe maior.', (s) => add(s, 'aDevour', 1));
b(W, 'caj28', 'Piscar', '⌁', 'legendary', 1, () => 'Rolar vira um teletransporte. No lugar de onde a Maga sumiu fica um orbe que explode 1 s depois.', (s) => add(s, 'aBlink', 1));
b(W, 'caj29', 'Gêmea Arcana', '♊', 'legendary', 1, () => 'A cada combo completo aparece uma cópia fantasma da Maga por 3 s, que repete todos os seus ataques de onde ela está.', (s) => add(s, 'aTwin', 1));
b(W, 'caj30', 'Caos Arcano', '✶', 'epic', 1, () => 'A cada 8 orbes, o próximo sai de um tipo aleatório (gelo, fogo, raio, sombra ou veneno), com o efeito daquele cajado.', (s) => add(s, 'aChaos', 1));

W = 'mage.eletrico';
b(W, 'ele5', 'Estática', '✦', 'rare', 2, (n) => `Os inimigos atingidos ficam atordoados ${n * 40}% mais tempo.`, (s) => add(s, 'stun', 0.4));
b(W, 'ele6', 'Tempestade', '☈', 'rare', 2, (n) => `O raio do 3º golpe em toda a sala causa +${n} de dano.`, (s) => add(s, 'zapAdd', 1));
b(W, 'ele7', 'Raio Duplo', '⁑', 'rare', 1, () => 'O 1º e o 2º golpe soltam 2 raios cada.', (s) => add(s, 'boltNL', 1));
b(W, 'ele8', 'Trovão', '✹', 'epic', 1, () => 'O raio do 3º golpe explode em área ao acertar (raio 2).', (s) => add(s, 'blastLast', 2));
b(W, 'ele9', 'Atravessar', '⇶', 'epic', 1, () => 'Cada raio acerta o 1º inimigo e segue para o próximo atrás dele.', (s) => add(s, 'pierce', 1));
b(W, 'ele10', 'Fúria da Tempestade', '⚡', 'legendary', 1, () => 'Todos os golpes (não só o 3º) dão 1 de dano em todos os inimigos da sala.', (s) => add(s, 'zapAll', 1));
// Lista do dono (06/11/2026) — elekit.js / elekit2.js. O "golpe forte" do Cajado Elétrico é o 3º raio do combo.
b(W, 'ele11', 'Polaridade', '±', 'epic', 1, () => 'Cada inimigo atingido ganha uma carga, + ou −. Dois com cargas opostas se puxam e batem um no outro (10 de dano e atordoa). Dois com a mesma carga se empurram.', (s) => add(s, 'ePol', 1));
b(W, 'ele12', 'Ímã', '⊂', 'rare', 1, () => 'Os raios puxam os inimigos atingidos um pouco para perto uns dos outros. O grupo vai se juntando, e o próximo raio pega mais gente.', (s) => add(s, 'eMag', 1));
b(W, 'ele13', 'Pulso Magnético', '◎', 'rare', 1, () => 'O golpe forte (3º raio) desvia para longe todas as flechas e magias que estão voando na sala.', (s) => add(s, 'ePulse', 1));
b(W, 'ele14', 'Poça Elétrica', '≈', 'rare', 1, () => 'Onde o raio acerta, fica uma poça faiscando por 3 s que dá choque em quem pisar.', (s) => add(s, 'ePud', 1));
b(W, 'ele15', 'Torre Tesla', '♆', 'legendary', 1, () => 'O golpe forte (3º raio) planta um cristal no chão que solta raios sozinho nos inimigos perto por 5 s.', (s) => add(s, 'eTesla', 1));
b(W, 'ele16', 'Nuvem Pessoal', '☁', 'epic', 1, () => 'O combo completo chama uma nuvenzinha de tempestade que segue a Maga por 5 s e solta raios em quem chegar perto.', (s) => add(s, 'eCloud', 1));
b(W, 'ele17', 'Rede Elétrica', '⌇', 'epic', 1, () => 'Quando o raio pula de um inimigo para outro, os dois ficam ligados por um fio de luz por 2 s. Quem encostar no fio leva choque.', (s) => add(s, 'eNet', 1));
b(W, 'ele18', 'Marionete', '♟', 'epic', 1, () => 'O inimigo atordoado pelo raio sofre um espasmo e dá um golpe no aliado mais perto dele.', (s) => add(s, 'ePup', 1));
b(W, 'ele19', 'Curto-Circuito', '⛉', 'rare', 1, () => 'Esqueleto com escudo leva choque em dobro (o escudo não segura o raio), e o escudo passa o choque para quem estiver encostado nele.', (s) => add(s, 'eShort', 1));
b(W, 'ele20', 'Sobrecarga', '✺', 'epic', 1, () => 'Inimigo atingido 5 vezes começa a faiscar e explode 2 s depois, dando choque em volta (18 de dano).', (s) => add(s, 'eOver', 1));
b(W, 'ele21', 'Blecaute', '◑', 'legendary', 1, () => 'O 3º golpe apaga as tochas da sala por 3 s. Os esqueletos ficam perdidos no escuro, andando sem rumo, e só a Maga brilha (recarrega em 10 s).', (s) => add(s, 'eBlack', 1));
b(W, 'ele22', 'Passo Relâmpago', '⌁', 'rare', 1, () => 'Rolar vira um avanço em forma de raio que dá choque em quem estiver no caminho e deixa um rastro elétrico no chão por 3 s.', (s) => add(s, 'eDash', 1));
b(W, 'ele23', 'Para-choque', '⊕', 'rare', 1, () => 'Inimigo que encosta na Maga leva um choque e é jogado para trás (e o esbarrão não machuca).', (s) => add(s, 'eBump', 1));
b(W, 'ele24', 'Gerador', '⚙', 'epic', 1, () => 'Andar sem parar enche uma barra de energia (cheia em 3 s). O próximo ataque solta tudo de uma vez, num raio mais forte quanto mais cheia a barra estiver (até o triplo do dano).', (s) => add(s, 'eGen', 1));
b(W, 'ele25', 'Bateria', '▮', 'epic', 1, () => 'Cada raio que acerta guarda 1 carga, até 10. Quando a Maga toma dano, as cargas descarregam todas em quem atacou (3 de dano cada).', (s) => add(s, 'eBat', 1));
b(W, 'ele26', 'Arco Voltaico', '∿', 'legendary', 1, () => 'Segurar o ataque mantém um raio contínuo grudado no inimigo, e o raio fica mais forte quanto mais tempo você segura (até 4×).', (s) => add(s, 'eArc', 1));
b(W, 'ele27', 'Ping-Pong', '⇋', 'rare', 1, () => 'O raio que pula pode voltar para um inimigo que já acertou. Com só dois inimigos, ele fica indo e vindo entre eles.', (s) => add(s, 'ePing', 1));
b(W, 'ele28', 'Ionizar', '⚛', 'epic', 1, () => 'Inimigos atingidos ficam ionizados por 4 s. O raio do 3º golpe pula de novo a partir de cada um deles.', (s) => add(s, 'eIon', 1));
b(W, 'ele29', 'Ossos Magnéticos', '☠', 'rare', 1, () => 'Inimigo morto pelo raio solta ossos eletrificados que voam até o próximo inimigo perto (8 de dano).', (s) => add(s, 'eBones', 1));
b(W, 'ele30', 'Choque Amigo', '♥', 'epic', 1, () => 'O raio também pula para o parceiro, mas em vez de machucar dá a ele velocidade por 2 s e cura 2 de vida.', (s) => add(s, 'eFriend', 1));

W = 'mage.trevas';
b(W, 'tre4', 'Orbe Gêmeo', '⁑', 'rare', 1, () => 'O 1º e o 2º golpe soltam 2 orbes cada.', (s) => add(s, 'boltNL', 1));
b(W, 'tre5', 'Maldição', '◈', 'rare', 2, (n) => `Inimigos atingidos levam +${n * 15}% de dano de tudo por 3 s.`, (s) => add(s, 'markHit', 0.15));
b(W, 'tre6', 'Pacto Sombrio', '✚', 'rare', 2, (n) => `Marcar um inimigo cura ${n * 2} de vida.`, (s) => add(s, 'markHeal', 2));
b(W, 'tre7', 'Ossos Fortes', '⛨', 'rare', 2, (n) => `Os mortos-vivos levantam com +${n * 6} de vida.`, (s) => add(s, 'undeadHp', 6));
b(W, 'tre8', 'Marca em Área', '✺', 'epic', 1, () => 'O 3º golpe explode em área (raio 2) e marca todos que pegar.', (s) => add(s, 'blastLast', 2));
b(W, 'tre9', 'Fúria dos Mortos', '⚔', 'epic', 1, () => 'Os mortos-vivos causam o dobro de dano.', (s) => add(s, 'undeadDmg', 1));
b(W, 'tre10', 'Exército das Trevas', '♛', 'legendary', 1, () => 'Todos os golpes marcam os inimigos (não só o 3º).', (s) => add(s, 'markAll', 1));
// Lista do dono (06/11/2026) — as fáceis (darkkit.js).
b(W, 'tre11', 'Tambores de Guerra', '♫', 'rare', 1, () => 'Quando a Maga dá o golpe forte, todos os mortos-vivos dela atacam ao mesmo tempo (quem está longe pula para perto).', (s) => add(s, 'dDrums', 1));
b(W, 'tre12', 'Praga', '☣', 'rare', 1, () => 'Quando um inimigo marcado morre, a marca passa para o inimigo mais perto dele.', (s) => add(s, 'dPlague', 1));
b(W, 'tre13', 'Dízimo', '⚱', 'rare', 1, () => 'No fim da sala, cada morto-vivo que sobrou se desfaz e cura 4 de vida da Maga.', (s) => add(s, 'dTithe', 1));
b(W, 'tre14', 'Banquete', '❦', 'epic', 1, () => 'Cada inimigo derrubado por um morto-vivo cura 2 de vida da Maga.', (s) => add(s, 'dFeast', 1));
b(W, 'tre15', 'Pacto de Sangue Sombrio', '⚰', 'rare', 1, () => 'Segurar o ataque gasta 8 de vida para levantar um esqueleto do chão (10 de vida), mesmo sem nenhum inimigo ter morrido.', (s) => add(s, 'dBlood', 1));
b(W, 'tre16', 'Rei dos Mortos', '♚', 'legendary', 1, () => 'Os mortos-vivos não desmoronam mais quando a sala fica vazia e acompanham a Maga até a sala seguinte.', (s) => add(s, 'dKing', 1));
// Lista do dono (07/11/2026), parte 2: médias e difíceis (darkkit2.js).
b(W, 'tre18', 'Cadáver Explosivo', '✹', 'epic', 1, () => 'O golpe forte num morto-vivo aliado faz ele explodir em sombras: 15 de dano em todos os inimigos em volta (raio 3).', (s) => add(s, 'dCorpse', 1));
b(W, 'tre19', 'Último Suspiro', '☁', 'rare', 1, () => 'Quando um morto-vivo aliado cai, sai dele um fantasma que voa até o inimigo mais perto e marca ele.', (s) => add(s, 'dGhost', 1));
b(W, 'tre20', 'Guarda-Costas', '⛉', 'rare', 1, () => 'Quando um golpe vai acertar a Maga, o morto-vivo mais perto (até 6 de distância) se joga na frente e leva o golpe no lugar dela. No máximo 1 vez a cada 2 s.', (s) => add(s, 'dGuard', 1));
b(W, 'tre21', 'Elo de Almas', '∞', 'epic', 1, () => 'Metade do dano que a Maga recebe vai para os mortos-vivos dela (para o que tem mais vida).', (s) => add(s, 'dLink', 1));
b(W, 'tre22', 'Pavor', '☹', 'epic', 1, () => 'O 3º golpe faz o inimigo marcado fugir de medo por 2 s (chefes não).', (s) => add(s, 'dFear', 1));
b(W, 'tre23', 'Possessão', '♆', 'legendary', 1, () => 'O golpe forte num inimigo com menos de 25% de vida faz ele passar para o seu lado na hora, sem precisar morrer antes (com metade da vida). Chefes não.', (s) => add(s, 'dPossess', 1));
b(W, 'tre24', 'Coletora de Almas', '❂', 'epic', 1, () => 'Cada inimigo marcado que morre solta uma alma que fica girando em volta da Maga (até 5). O golpe forte dispara todas as almas nos inimigos mais perto (6 de dano cada).', (s) => add(s, 'dSouls', 1));
b(W, 'tre25', 'Herança', '⚜', 'epic', 1, () => 'Os mortos-vivos levantam com metade da vida que tinham em vida, com a arma de antes: arqueiro vira arqueiro aliado, e esqueleto com escudo vira guarda que fica do lado da Maga e segura golpes e flechas com o escudo.', (s) => add(s, 'dHeir', 1));
b(W, 'tre26', 'Gigante de Ossos', '☗', 'legendary', 1, () => 'Ao juntar 3 mortos-vivos, eles se fundem num esqueleto gigante, bem mais forte e mais resistente.', (s) => add(s, 'dGiant', 1));
b(W, 'tre27', 'Mãos da Cova', '✋', 'epic', 1, () => 'Quando um morto-vivo levanta, mãos de esqueleto saem do chão em volta e prendem os inimigos perto (raio 3) por 1,5 s. Chefes não.', (s) => add(s, 'dHands', 1));
b(W, 'tre28', 'Escuridão', '◐', 'legendary', 1, () => 'Com 3 ou mais mortos-vivos em campo (o Gigante conta como 3), a sala escurece e os inimigos erram 1 de cada 3 ataques na Maga.', (s) => add(s, 'dDark', 1));
b(W, 'tre29', 'Traição', '⚔', 'epic', 1, () => 'O inimigo marcado tem chance de virar contra um aliado dele por 3 s em vez de atacar você (e quem apanha revida nele).', (s) => add(s, 'dBetray', 1));
b(W, 'tre30', 'Sombra Faminta', '◉', 'rare', 1, () => 'A sombra da Maga no chão morde quem pisar nela: 2 de dano a cada 0,5 s (sem atordoar).', (s) => add(s, 'dShadow', 1));

W = 'mage.gelo';
b(W, 'gel5', 'Estilhaçar', '✸', 'rare', 2, (n) => `O golpe que estilhaça um congelado causa ${n1(2 + n * 0.5)}× o dano (em vez de 2×).`, (s) => add(s, 'shatter', 0.5));
b(W, 'gel6', 'Geada', '❆', 'rare', 1, () => 'O 1º e o 2º orbe têm 15% de chance de congelar o inimigo por 1,2 s (chefes não).', (s) => add(s, 'freezeChance', 0.15));
b(W, 'gel7', 'Frio Mortal', '☃', 'rare', 2, (n) => `+${n * 30}% de dano em inimigos lentos ou congelados.`, (s) => add(s, 'vsSlow', 0.3));
b(W, 'gel8', 'Nova Glacial', '✺', 'epic', 1, () => 'Ao estilhaçar um congelado, o gelo explode em volta: 12 de dano e lentidão.', (s) => add(s, 'frostNova', 12));
b(W, 'gel9', 'Lança de Gelo', '⇶', 'epic', 1, () => 'O 3º orbe atravessa todos os inimigos no caminho (congela todos).', (s) => add(s, 'pierceH', 99));
b(W, 'gel10', 'Zero Absoluto', '❄', 'legendary', 1, () => 'O 3º golpe congela também quem estiver perto do alvo (raio 2,5).', (s) => add(s, 'freezeAoe', 2.5));
// Lista do dono (07/11/2026). As regras ficam em icekit.js; o que fica na sala, em iceprops.js.
b(W, 'gel11', 'Curling', '◎', 'epic', 1, () => 'Bater num inimigo congelado faz ele deslizar pela sala como pedra de gelo, derrubando quem estiver no caminho (chefes não).', (s) => add(s, 'iCurl', 1));
b(W, 'gel12', 'Estátua', '♜', 'rare', 1, () => 'Quando um inimigo morre, um clone de gelo dele fica no lugar (10 s). Inimigo que encosta no clone é congelado e o clone se quebra.', (s) => add(s, 'iStatue', 1));
b(W, 'gel13', 'Espelho de Gelo', '◇', 'epic', 1, () => 'Inimigo congelado rebate as flechas e magias que batem nele. Dá para se esconder atrás dele.', (s) => add(s, 'iMirror', 1));
b(W, 'gel14', 'Grudento', '❉', 'rare', 1, () => 'Inimigo que encosta num congelado fica com os pés grudados no gelo por 5 s.', (s) => add(s, 'iSticky', 1));
b(W, 'gel15', 'Floco Gigante', '❄', 'legendary', 1, () => 'Estilhaçar um congelado solta 6 lascas de gelo para todos os lados.', (s) => add(s, 'iFlake', 1));
b(W, 'gel16', 'Quebra Fatal', '☠', 'epic', 1, () => 'Inimigo com menos de 20% de vida que é congelado se quebra na hora (chefes não).', (s) => add(s, 'iFatal', 1));
b(W, 'gel17', 'Pista de Gelo', '⛸', 'rare', 1, () => 'O 3º golpe congela o chão em volta do alvo. Inimigos que entram ali escorregam e andam sem controle.', (s) => add(s, 'iRink', 1));
b(W, 'gel18', 'Parede de Gelo', '▦', 'epic', 1, () => 'O golpe forte levanta uma parede de gelo na frente da Maga que segura inimigos e flechas por 4 s. Os orbes dela passam.', (s) => add(s, 'iWall', 1));
b(W, 'gel19', 'Estalagmites', '▲', 'rare', 1, () => 'Estilhaçar um congelado faz estacas de gelo brotarem do chão em volta dele (8 de dano e lentidão).', (s) => add(s, 'iSpikes', 1));
b(W, 'gel20', 'Granizo', '☄', 'legendary', 1, () => 'O combo completo faz cair granizo em volta da Maga por 3 s, acertando quem estiver perto.', (s) => add(s, 'iHail', 1));
b(W, 'gel21', 'Iglu', '⌂', 'legendary', 1, () => 'Quando a vida fica baixa, a Maga se fecha num bloco de gelo por 2 s. Fica imune e se cura 20 (1 vez por sala).', (s) => add(s, 'iIgloo', 1));
b(W, 'gel22', 'Pele Gélida', '❅', 'rare', 1, () => 'Qualquer inimigo que causa dano na Maga é congelado.', (s) => add(s, 'iSkin', 1));
b(W, 'gel23', 'Neblina', '☁', 'legendary', 1, () => 'Rolar deixa uma nuvem de neblina por 4 s (no máximo a cada 3 s). Só os inimigos dentro dela perdem a Maga de vista (chefes não).', (s) => add(s, 'iFog', 1));
b(W, 'gel24', 'Cristais', '◆', 'rare', 1, () => 'Quebrar um congelado deixa um cristal no chão. Pegar o cristal cura 4 de vida.', (s) => add(s, 'iCrystal', 1));
b(W, 'gel25', 'Patins', '⛸', 'epic', 1, () => 'Rolar deixa um rastro de gelo. Andar sobre gelo deixa a Maga deslizando e 40% mais rápida. Combina com a Pista de Gelo.', (s) => { add(s, 'iSkate', 1); s.iceTrail = true; });
b(W, 'gel26', 'Contágio Gélido', '❆', 'rare', 1, () => 'Inimigos perto de um congelado tomam dano do frio que sai dele (4 por segundo).', (s) => add(s, 'iChill', 1));
b(W, 'gel27', 'Encharcado', '≈', 'rare', 1, () => 'Inimigo que acabou de descongelar fica molhado e congela de novo com um único orbe.', (s) => add(s, 'iWet', 1));
b(W, 'gel28', 'Avalanche Lenta', '⛰', 'epic', 1, () => 'Inimigo que fica lento 3 vezes seguidas congela sozinho, mesmo sem o 3º golpe.', (s) => add(s, 'iAval', 1));
b(W, 'gel29', 'Boneco de Neve', '☃', 'epic', 1, () => 'Inimigo que morre congelado vira um boneco de neve aliado que joga bolas de neve nos outros por 8 s.', (s) => add(s, 'iSnowman', 1));
b(W, 'gel30', 'Tempo Congelado', '⌛', 'legendary', 1, () => 'Ter 3 inimigos congelados ao mesmo tempo para a sala inteira por 3 s. Tudo fica parado, menos a Maga.', (s) => add(s, 'iTime', 1));

W = 'mage.fogo';
b(W, 'fog5', 'Combustão', '✹', 'rare', 2, (n) => `+${n * 35}% de dano em inimigos queimando.`, (s) => add(s, 'vsBurn', 0.35));
b(W, 'fog7', 'Explosão Maior', '◎', 'rare', 2, (n) => `A explosão (3º golpe) fica ${n * 25}% maior.`, (s) => add(s, 'novaR', 0.25));
b(W, 'fog8', 'Contágio', '☣', 'epic', 1, () => 'Inimigo que morre queimando explode em fogo: 10 de dano e põe fogo em quem estiver perto.', (s) => add(s, 'spreadBurn', 10));
b(W, 'fog9', 'Coração de Brasa', '✚', 'epic', 1, () => 'Acertar um inimigo queimando cura 1 de vida (no máximo a cada 0,3 s).', (s) => add(s, 'burnHeal', 1));
b(W, 'fog10', 'Inferno', '☀', 'legendary', 1, () => 'A explosão do 3º golpe deixa um círculo de fogo no chão por 3 s que queima quem passar.', (s) => add(s, 'fireField', 1));
// Lista do dono (07/11/2026). As regras ficam em firekit.js; o que fica na sala, em fireprops.js; o Pânico, em firestates.js.
b(W, 'fog11', 'Pânico', '☄', 'epic', 1, () => 'Esqueleto que pega fogo sai correndo sem rumo e põe fogo em quem ele encostar (chefes não).', (s) => add(s, 'fPanic', 1));
b(W, 'fog12', 'Fogo Azul', '♨', 'epic', 1, () => 'Inimigo que pega fogo 3 vezes seguidas passa a queimar com fogo azul: o dobro do dano, e o fogo pula para quem estiver perto.', (s) => add(s, 'fBlue', 1));
b(W, 'fog13', 'Faísca Saltitante', '✦', 'rare', 1, () => 'Quando a queimadura de um inimigo acaba, uma faísca pula dele e põe fogo no inimigo mais perto.', (s) => add(s, 'fSpark', 1));
b(W, 'fog14', 'Derreter', '⛉', 'rare', 1, () => 'Esqueleto com escudo que fica 3 s queimando perde o escudo: ele derrete.', (s) => add(s, 'fMelt', 1));
b(W, 'fog15', 'Reação em Cadeia', '✺', 'legendary', 1, () => 'A explosão do 3º golpe faz cada inimigo que já estava queimando explodir também (8 de dano em volta dele).', (s) => add(s, 'fChain', 1));
b(W, 'fog17', 'Tochas Vivas', '♆', 'rare', 1, () => 'As tochas da parede soltam uma bola de fogo nos inimigos que passam perto delas.', (s) => add(s, 'fTorch', 1));
b(W, 'fog18', 'Vulcão', '⛰', 'epic', 1, () => 'O golpe forte racha o chão debaixo do inimigo mais perto, que jorra lava 3 vezes seguidas.', (s) => add(s, 'fVolcano', 1));
b(W, 'fog19', 'Fumaça', '☁', 'rare', 1, () => 'O fogo solta fumaça (inimigos queimando e a explosão do 3º golpe). Inimigos dentro dela erram metade dos ataques.', (s) => add(s, 'fSmoke', 1));
b(W, 'fog20', 'Fogos de Artifício', '✷', 'rare', 1, () => 'A explosão do 3º golpe solta 5 fogos coloridos que caem em pontos aleatórios da sala e estouram (6 de dano e fogo).', (s) => add(s, 'fWorks', 1));
b(W, 'fog21', 'Rastro de Chamas', '≋', 'rare', 1, () => 'Rolar deixa uma trilha de fogo no chão por 2 s.', (s) => add(s, 'fTrail', 1));
b(W, 'fog23', 'Liberação Ardente', '⟿', 'epic', 1, () => 'A linha de fogo do 2º golpe vai até a primeira parede e atravessa todos os inimigos no caminho.', (s) => add(s, 'fRelease', 1));
b(W, 'fog24', 'Filha do Fogo', '✚', 'epic', 1, () => 'Pisar no fogo do chão (Inferno, Rastro de Chamas, lava, barril) cura a Maga: 2 de vida a cada 0,5 s.', (s) => add(s, 'fChild', 1));
b(W, 'fog25', 'Anel de Chamas', '◌', 'epic', 1, () => 'Depois da explosão do 3º golpe, 3 bolas de fogo ficam girando em volta da Maga por 3 s, queimando quem encostar.', (s) => add(s, 'fRing', 1));
b(W, 'fog27', 'Chama Interior', '♥', 'epic', 1, () => 'Quanto menos vida a Maga tiver, maior fica a explosão do 3º golpe (até +90%).', (s) => add(s, 'fInner', 1));
b(W, 'fog28', 'Sopro do Dragão', '»', 'epic', 1, () => 'O sopro de fogo do 1º golpe do combo alcança o dobro da distância.', (s) => add(s, 'fDragon', 1));
b(W, 'fog29', 'Salamandra', '∿', 'epic', 1, () => 'Uma salamandra de fogo segue a Maga e cospe fogo nos inimigos que já estão queimando.', (s) => add(s, 'fSala', 1));
b(W, 'fog30', 'Cinzas', '✧', 'legendary', 1, () => 'Cada inimigo que morre queimando deixa uma brasa para a Maga. Com 10 brasas, o próximo golpe forte vira uma explosão gigante (raio ×2,2 e dano ×3).', (s) => add(s, 'fAsh', 1));

// ---------------- Ladino ----------------
W = 'rogue.adagas';
b(W, 'ada5', 'Golpe Cruel', '☠', 'rare', 2, (n) => `Críticos causam +${n * 50}% de dano (${n1(2 + n * 0.5)}× em vez de 2×).`, (s) => add(s, 'critDmg', 0.5));
b(W, 'ada6', 'Sangue Frio', '❄', 'rare', 1, () => 'Cada crítico deixa os golpes 25% mais rápidos por 2 s.', (s) => add(s, 'critHaste', 0.25));
b(W, 'ada7', 'Hemorragia', '♦', 'rare', 2, (n) => `${n * 20}% de chance por golpe de somar 1 de sangramento.`, (s) => add(s, 'bleedHit', 0.2));
b(W, 'ada8', 'Dança das Lâminas', '»', 'epic', 1, () => 'Depois de rolar, os golpes saem sempre críticos por 1,5 s.', (s) => add(s, 'dodgeCrit', 1));
b(W, 'ada9', 'Vampiro', '✚', 'epic', 1, () => 'Cada crítico cura 3 de vida.', (s) => add(s, 'critHeal', 3));
b(W, 'ada10', 'Mil Cortes', '✶', 'legendary', 1, () => 'Cada crítico corta de novo: um 2º corte com metade do dano.', (s) => add(s, 'critTwice', 0.5));
// Lista do dono (07/11/2026) — roguekit.js / rogueprops.js / roguestates.js.
b(W, 'ada11', 'Bomba de Fumaça', '☁', 'epic', 1, () => 'Rolar solta uma nuvem de fumaça. Os inimigos perdem o Ladino de vista por 1,5 s e ficam procurando (no máximo a cada 3 s; chefes não).', (s) => add(s, 'dSmoke', 1));
b(W, 'ada12', 'Substituição', '♙', 'legendary', 1, () => 'Ao tomar um golpe, o Ladino some e no lugar fica um boneco de palha. Ele reaparece 3 passos para trás, e os inimigos continuam batendo no boneco por 2 s (1 vez a cada 10 s).', (s) => add(s, 'dSub', 1));
b(W, 'ada13', 'Sumir no Abate', '◌', 'rare', 1, () => 'Ao derrotar um inimigo, o Ladino fica invisível por 1 s e ninguém ataca ele.', (s) => add(s, 'dVanish', 1));
b(W, 'ada14', 'Areia nos Olhos', '⁂', 'rare', 1, () => 'O golpe forte cega o inimigo por 2 s: ele ataca a esmo e erra.', (s) => add(s, 'dSand', 1));
b(W, 'ada15', 'Execução Silenciosa', '†', 'epic', 1, () => 'Atacar pelas costas um inimigo com menos de 30% de vida derrota ele na hora (chefes não).', (s) => add(s, 'dExec', 1));
b(W, 'ada16', 'Passo das Sombras', '☾', 'epic', 1, () => 'Rolar na direção de um inimigo leva o Ladino direto para as costas dele. (Não vem junto com a Cambalhota Cortante.)', (s) => add(s, 'dShadow', 1));
b(W, 'ada19', 'Adaga Cravada', '⚔', 'epic', 1, () => 'O golpe forte deixa uma adaga cravada no inimigo. Cada golpe seguinte nele gira a adaga e machuca de novo. Quando ele morre, a adaga volta para o Ladino.', (s) => add(s, 'dStuck', 1));
b(W, 'ada20', 'Leque de Facas', '✺', 'rare', 1, () => 'O golpe forte solta facas curtas para todos os lados, em volta do Ladino.', (s) => add(s, 'dFan', 1));
b(W, 'ada21', 'Lâminas Voadoras', '❂', 'legendary', 1, () => 'Duas adagas fantasmas ficam girando em volta do Ladino e cortam quem chega perto.', (s) => add(s, 'dOrbit', 1));
b(W, 'ada22', 'Cortar Flechas', '➶', 'rare', 1, () => 'Atacando, o Ladino corta no ar as flechas e magias que chegarem perto, de qualquer lado e durante o golpe inteiro.', (s) => add(s, 'dCut', 1));
b(W, 'ada24', 'Desarmar', '⚒', 'epic', 1, () => 'O golpe forte arranca a arma do esqueleto. Desarmado, ele só consegue empurrar (chefes não).', (s) => add(s, 'dDisarm', 1));
b(W, 'ada25', 'Bolsos Fundos', '⚱', 'rare', 1, () => 'Inimigos derrotados às vezes deixam um frasco no chão (veneno, fumaça ou fogo). Pegar o frasco passa o efeito para o próximo golpe.', (s) => add(s, 'dFlask', 1));
b(W, 'ada26', 'Marca da Morte', '◎', 'epic', 1, () => 'O golpe forte marca o inimigo (+30% de dano nele). Ao derrotar o marcado, a marca pula sozinha para o inimigo mais perto. O Ladino vai caçando um por um.', (s) => add(s, 'dMark', 1));
b(W, 'ada28', 'Golpe de Misericórdia', '☠', 'legendary', 1, () => 'Inimigos com pouca vida ganham uma caveira em cima da cabeça. O golpe forte perto de um deles faz uma execução que derrota na hora e cura 5 de vida.', (s) => add(s, 'dMercy', 1));
b(W, 'ada29', 'Veneno Paralisante', '≈', 'rare', 1, () => 'As adagas envenenam. A cada 5 acertos no mesmo inimigo, ele fica paralisado por 1 s.', (s) => add(s, 'dPara', 1));
b(W, 'ada30', 'Veneno de Cobra', '∿', 'epic', 1, () => 'As adagas envenenam. O inimigo envenenado que morre solta uma nuvem de veneno que pega os vizinhos.', (s) => add(s, 'dCobra', 1));

W = 'rogue.kunai';
b(W, 'kun1', 'Kunai Afiada', '✧', 'common', 3, (n) => `Dano base das kunais +2. (total: ${2 + n * 2})`, (s) => add(s, 'kBase', 2));
b(W, 'kun2', 'Corrente Forte', '⛓', 'common', 3, (n) => `Cada acúmulo da corrente vale +1 de dano. (total: ${3 + n} por acúmulo)`, (s) => add(s, 'kPer', 1));
b(W, 'kun5', 'Bolsa Extra', '✚', 'rare', 2, (n) => `+1 kunai. (total: ${2 + n})`, (s, p) => { add(s, 'ammo', 1); if (p && p.ammo && p.hero.ammo && p.hero.ammo.kind === 'kunai') p.ammo.push({ stack: 0 }); });
b(W, 'kun6', 'Ricochete de Aço', '⇶', 'rare', 1, () => 'A kunai atravessa o 1º inimigo e acerta mais um antes de cair.', (s) => add(s, 'kPierce', 1));
b(W, 'kun7', 'Disciplina', '☯', 'rare', 1, () => 'Pegar a kunai no ar dá +1 de corrente a ela.', (s) => add(s, 'kKeep', 1));
b(W, 'kun8', 'Ponta Envenenada', '♦', 'epic', 1, () => 'Kunais com corrente ×5 ou mais somam 1 de sangramento a cada acerto.', (s) => add(s, 'kBleed', 5));
b(W, 'kun9', 'Aço Resistente', '⛨', 'epic', 1, () => 'Bater em parede ou objeto não zera mais a corrente da kunai.', (s) => add(s, 'kWall', 1));
b(W, 'kun10', 'Tempestade de Aço', '☄', 'legendary', 1, () => 'O limite da corrente sobe de 15 para 30 e kunais com corrente ×10 ou mais sempre dão crítico.', (s) => { add(s, 'kMax', 15); add(s, 'kCrit', 10); });
// Lista do dono (07/11/2026) — kunaikit.js / kunaiprops.js.
b(W, 'kun12', 'Armadilha de Fio', '⌇', 'epic', 1, () => 'Duas kunais caídas ficam ligadas por um fio cortante: inimigo que cruza o fio leva 6 de dano.', (s) => add(s, 'kWire', 1));
b(W, 'kun13', 'Estrepes', '⁂', 'rare', 1, () => 'Kunais caídas machucam (3 de dano) e deixam lento quem pisar nelas.', (s) => add(s, 'kCaltrop', 1));
b(W, 'kun14', 'Pregar a Sombra', '☾', 'epic', 1, () => 'A kunai que cai perto de um inimigo crava na sombra dele e prende ele no lugar por 1,5 s (chefes: 0,5 s).', (s) => add(s, 'kPin', 1));
b(W, 'kun15', 'Kunai Ímã', '⊂', 'rare', 1, () => 'Kunais caídas deslizam devagar até o Ladino.', (s) => add(s, 'kMagnet', 1));
b(W, 'kun16', 'Relâmpago Amarelo', 'ϟ', 'legendary', 1, () => 'Rolar teleporta o Ladino até a kunai caída mais perto, e ele já pega a kunai na chegada. (Não vem junto com a Troca de Lugar.)', (s) => add(s, 'kFlash', 1));
b(W, 'kun17', 'Troca de Lugar', '⇄', 'epic', 1, () => 'Rolar logo depois (até 1,5 s) de acertar um inimigo com a kunai troca o Ladino de lugar com ele, que fica tonto (chefes não). (Não vem junto com o Relâmpago Amarelo.)', (s) => add(s, 'kSwap', 1));
b(W, 'kun18', 'Bumerangue', '↶', 'rare', 1, () => 'A kunai que não acerta ninguém faz uma curva no fim do voo (ou na parede) e volta para o Ladino, acertando quem estiver no caminho.', (s) => add(s, 'kBoom', 1));
b(W, 'kun19', 'Fio de Aço', '⥀', 'epic', 1, () => 'Segurar o ataque puxa de volta pelo fio todas as kunais que estão fora, e elas cortam quem estiver no caminho da volta.', (s) => add(s, 'kSteel', 1));
b(W, 'kun21', 'Quique na Parede', '⟲', 'rare', 1, () => 'Kunai que bate na parede quica direto para o inimigo mais perto, sem perder a corrente.', (s) => add(s, 'kBounce', 1));
b(W, 'kun24', 'Faísca na Pegada', '✦', 'rare', 1, () => 'Pegar uma kunai no ar solta um pequeno choque em volta do Ladino (6 de dano).', (s) => add(s, 'kSpark', 1));
b(W, 'kun25', 'Pegada Heroica', '✚', 'rare', 1, () => 'Pegar uma kunai no ar cura 3 de vida.', (s) => add(s, 'kHeal', 1));
b(W, 'kun26', 'Passar a Corrente', '⇉', 'epic', 1, () => 'Ao pegar uma kunai no ar, a corrente dela passa também para as outras kunais da mão (a próxima arremessada já sai com ela).', (s) => add(s, 'kPass', 1));
b(W, 'kun27', 'Kunai Fantasma', '◌', 'rare', 1, () => 'Quando uma kunai cai no chão, uma cópia fantasma dela voa sozinha até o inimigo mais perto.', (s) => add(s, 'kGhost', 1));
b(W, 'kun28', 'Sanguessuga', '♥', 'epic', 1, () => 'A kunai crava no inimigo (uma por vez) e vai sugando a vida dele para o Ladino (2 de dano e cura 1 por segundo) até ser pega de volta: chegue perto dele.', (s) => add(s, 'kLeech', 1));
b(W, 'kun29', 'Mãos Vazias', '○', 'epic', 1, () => 'Com todas as kunais arremessadas, o Ladino rola o dobro da distância e os inimigos de longe perdem ele de vista.', (s) => add(s, 'kEmpty', 1));

W = 'rogue.garras';
b(W, 'gar4', 'Ferida Aberta', '♦', 'common', 2, (n) => `+${n * 30}% de dano em inimigos sangrando.`, (s) => add(s, 'vsBleed', 0.3));
b(W, 'gar5', 'Dilacerar', '✠', 'rare', 2, (n) => `O 5º golpe soma +${n} de sangramento a mais (total: ${1 + n}).`, (s) => add(s, 'bleedH', 1));
b(W, 'gar6', 'Arranhão', '⁘', 'rare', 2, (n) => `${n * 15}% de chance por golpe de somar 1 de sangramento.`, (s) => add(s, 'bleedHit', 0.15));
b(W, 'gar7', 'Hemofilia', '☠', 'rare', 2, (n) => `Cada sangramento tira ${1 + n} de vida em vez de 1.`, (s) => add(s, 'bleedDmg', 1));
b(W, 'gar8', 'Caçador', '✚', 'epic', 1, () => 'Acertar um inimigo sangrando cura 1 de vida (no máximo a cada 0,3 s).', (s) => add(s, 'bleedHeal', 1));
b(W, 'gar9', 'Garras Duplas', '⚔', 'epic', 1, () => 'Cada acerto tem 25% de chance de um 2º arranhão com metade do dano.', (s) => add(s, 'twiceChance', 0.25));
// Lista do dono (07/11/2026) — clawkit.js / clawprops.js.
b(W, 'gar11', 'Investida do Leão', '⤳', 'epic', 1, () => 'Apertar ataque e rolamento juntos: o Ladino cruza os braços, some e reaparece à frente (a distância de um rolamento), cortando todos os inimigos no caminho. Recarga de 10 s.', (s) => add(s, 'cLion', 1));
b(W, 'gar12', 'Rugido', '☊', 'rare', 1, () => 'O 5º golpe solta um rugido que faz os inimigos em volta fugirem de medo por 1,5 s (chefes não).', (s) => add(s, 'cRoar', 1));
b(W, 'gar13', 'Montaria', '♞', 'legendary', 1, () => 'O golpe forte num chefe ou num inimigo grande faz o Ladino pular nas costas dele e ficar arranhando sem parar até ser jogado longe (rolar pula fora).', (s) => add(s, 'cMount', 1));
b(W, 'gar14', 'Revide', '↺', 'epic', 1, () => 'Ao tomar dano, o Ladino some, reaparece atrás de quem bateu e o executa (chefes: o triplo do dano de um golpe). Fica 1 s sem tomar dano.', (s) => add(s, 'cRevenge', 1));
b(W, 'gar15', 'Cair de Pé', '⇡', 'rare', 1, () => 'Ser empurrado ou derrubado não atordoa o Ladino. Ele cai de pé e já ataca.', (s) => add(s, 'cLand', 1));
b(W, 'gar18', 'Morte Dolorosa', '✟', 'rare', 1, () => 'Inimigos sangrando também perdem vida pelo sangramento a cada 3 s, mesmo sem atacar.', (s) => add(s, 'cAgony', 1));
b(W, 'gar19', 'Contágio de Sangue', '⁂', 'epic', 1, () => 'O 5º golpe passa os sangramentos do alvo para os inimigos em volta dele.', (s) => add(s, 'cSpread', 1));
b(W, 'gar21', 'Poça de Sangue', '◉', 'rare', 1, () => 'Inimigo sangrando deixa uma poça no chão. Quem pisar nela escorrega, cai e fica no chão por 1,5 s.', (s) => add(s, 'cPuddle', 1));
b(W, 'gar22', 'Marcas de Garra', '≡', 'epic', 1, () => 'O 5º golpe deixa três riscos brilhando no chão que cortam quem passar por cima por 3 s.', (s) => add(s, 'cMarks', 1));
b(W, 'gar23', 'Cortes de Vento', '≋', 'rare', 1, () => 'O 5º golpe solta 3 cortes de vento curtos para a frente.', (s) => add(s, 'cWind', 1));
b(W, 'gar24', 'Tigre Fantasma', '❂', 'legendary', 1, () => 'A cada combo completo, uma garra fantasma gigante desce do alto em cima do alvo (20 de dano em volta e sangramento).', (s) => add(s, 'cTiger', 1));
b(W, 'gar25', 'Afiar na Parede', '⚒', 'rare', 1, () => 'Atacar encostado numa parede afia as garras, e os próximos 5 golpes já causam sangramento.', (s) => add(s, 'cWhet', 1));
b(W, 'gar26', 'Rasgar Escudo', '⛉', 'rare', 1, () => 'Golpes no escudo de um esqueleto rasgam pedaços dele, e no 5º golpe o escudo some.', (s) => add(s, 'cShred', 1));
b(W, 'gar27', 'Armadilha de Urso', '⊓', 'rare', 1, () => 'A cada 15 s, o Ladino deixa cair uma armadilha de urso no chão. Ela fica lá até um inimigo pisar, e quem pisar fica atordoado por 5 s.', (s) => add(s, 'cTrap', 1));
b(W, 'gar28', 'Fúria da Fera', '☀', 'epic', 1, () => '10 acertos seguidos sem tomar dano deixam o Ladino imune a dano por 5 s. A contagem só recomeça depois que a imunidade acaba.', (s) => add(s, 'cBeast', 1));
b(W, 'gar29', 'Sete Vidas', '☥', 'epic', 1, () => 'A primeira vez em cada sala que um golpe deixaria o Ladino com pouca vida, ele se esquiva sozinho e escapa.', (s) => add(s, 'cNine', 1));
b(W, 'gar30', 'Matilha', '☫', 'legendary', 1, () => 'Inimigo que morre sangrando solta um lobo fantasma que luta ao lado do Ladino por 5 s: combo de 3 garradas e, se o alvo estiver longe, pulo com mordida.', (s) => add(s, 'cPack', 1));

W = 'rogue.rapieira';
b(W, 'rap7', 'Golpe Traiçoeiro', '☠', 'rare', 2, (n) => `Ataques pelas costas causam +${n * 50}% de dano.`, (s) => add(s, 'backDmg', 0.5));
b(W, 'rap9', 'Duelista', '⇶', 'epic', 1, () => 'As estocadas atravessam e acertam mais 1 inimigo atrás do primeiro.', (s) => add(s, 'pierceMelee', 1));
// Lista do dono (07/11/2026) — rapkit.js / rapprops.js.
b(W, 'rap23', 'Assinatura', '✍', 'rare', 1, () => 'O 3º golpe risca uma marca no inimigo. Com 3 marcas, a marca brilha e o inimigo sangra muito.', (s) => add(s, 'rSign', 1));
b(W, 'rap24', 'Ponto Fraco', '✧', 'epic', 1, () => 'A cada 4 s, um ponto brilhante aparece num inimigo. Estocar ele nesse momento dá um golpe perfeito, que atravessa e atordoa.', (s) => add(s, 'rWeak', 1));
b(W, 'rap25', 'Precisão Cirúrgica', '⌖', 'rare', 1, () => '3 estocadas seguidas no mesmo inimigo furam a armadura, e o escudo dele para de bloquear até o fim da sala.', (s) => add(s, 'rSurgeon', 1));
b(W, 'rap27', 'Chuva de Estocadas', '☔', 'epic', 1, () => 'Segurar o ataque solta uma sequência de estocadas rapidíssimas na frente.', (s) => add(s, 'rFlurry', 1));
b(W, 'rap29', 'Golpe Fantasma', '⇉', 'rare', 1, () => 'Cada ataque pelas costas deixa uma estocada fantasma que acerta de novo meio segundo depois.', (s) => add(s, 'rEcho', 1));
// 07/11 (noite): o aparar saiu da Rapieira (pedido do dono); o botão direito virou Ripostar (igual ao W da Fiora, LoL).
b(W, 'rap31', 'Ripostar', '⇄', 'epic', 1, () => 'Botão direito: por 0,5 s o Ladino nega todo o dano que receber. Depois, estoca na direção da mira e devolve o dano negado a todos os inimigos no alcance (atordoa 1,5 s se negou algum golpe; senão, deixa lentos). Recarga de 20 s.', (s) => add(s, 'rRiposte', 1));
// 08/11/2026: 3ª leva (lista do dono) — rapkit2.js / rapprops2.js.
b(W, 'rap32', 'Espetinho', '⚲', 'epic', 1, () => 'O 1º e o 2º golpe deixam o esqueleto preso na lâmina (até 3). Você anda com o espeto, e o golpe forte arremessa todos juntos como um projétil.', (s) => add(s, 'rSkewer', 1));
b(W, 'rap33', 'Já Está Morto', '☯', 'legendary', 1, () => 'Os golpes não tiram vida na hora: só deixam furos brilhando. Fique 1 s sem atacar, ouça o clic, e todos os furos abrem juntos com 50% a mais de dano.', (s) => add(s, 'rDelay', 1));
b(W, 'rap34', 'Constelação', '✦', 'epic', 1, () => 'Cada golpe deixa uma estrela no ar, na ponta da lâmina. Com 3 ou mais (até 5), elas se ligam numa figura, e quem estiver dentro ou nas linhas é atingido de uma vez.', (s) => add(s, 'rStars', 1));
b(W, 'rap35', 'Linha e Agulha', '⟆', 'rare', 1, () => 'Cada esqueleto atingido fica preso numa linha vermelha. O golpe forte puxa a linha, e todos os costurados voam uns contra os outros.', (s) => add(s, 'rThread', 1));
b(W, 'rap36', 'Touché!', '⚐', 'epic', 1, () => 'Placar de esgrima em cima de cada esqueleto: cada golpe seu é 1 ponto. Com 5 pontos ele é eliminado na hora. Mas se ele te acertar, o placar dele volta a zero. Chefes: 5 pontos tiram 20% da vida.', (s) => add(s, 'rTouche', 1));
b(W, 'rap37', 'Pistola de Pederneira', '⌐', 'rare', 1, () => 'O combo ganha um 4º golpe: um tiro à queima-roupa que joga o inimigo longe, e o coice joga você para trás.', (s) => add(s, 'rPistol', 1));
b(W, 'rap38', 'Um por Todos', '⚜', 'legendary', 1, () => 'Cada esqueleto derrotado vira um mosqueteiro fantasma ao seu lado (até 2, um de cada lado). Eles repetem tudo o que você faz e golpeiam junto (metade do dano). Somem quando você toma dano.', (s) => add(s, 'rMusk', 1));
b(W, 'rap39', 'Xeque-Mate', '♚', 'legendary', 1, () => 'O esqueleto mais forte da sala (de todas as ondas) ganha uma coroa. Derrote-o pelas costas e a coroa é sua até o fim da sala: +30 de vida e 30% a mais de dano, velocidade de ataque e de movimento, e 30% menos dano recebido.', (s) => add(s, 'rCrown', 1));
// 08/11/2026 (madrugada): Velocidade da Luz e Vem Dançar (pedido do dono) — rapkit2.js.
b(W, 'rap40', 'Velocidade da Luz', '☄', 'epic', 1, () => 'O combo ganha um golpe novo antes do golpe forte: uma estocada rapidíssima em cada inimigo de costas no alcance (uma em cada). Depois o combo segue normal com o golpe forte.', (s) => add(s, 'rLight', 1));
b(W, 'rap41', 'Vem Dançar', '♫', 'rare', 1, () => 'Acertar o corte (2º golpe) num inimigo que já está de costas faz ele girar 360° e ficar tonto: parado, sem fazer nada, por 3 s (chefes: 1,5 s).', (s) => add(s, 'rDance', 1));

W = 'rogue.besta';
b(W, 'bes4', 'Mira Firme', '◎', 'common', 2, (n) => `+${n * 40}% de dano em inimigos com a vida cheia.`, (s) => add(s, 'vsFull', 0.4));
b(W, 'bes5', 'Aljava', '✚', 'rare', 1, () => '+1 virote.', (s, p) => { add(s, 'ammo', 1); if (p && p.ammo && p.hero.ammo && p.hero.ammo.kind === 'bolt') p.ammo.push({ stack: 0 }); });
b(W, 'bes6', 'Atravessar', '⇶', 'rare', 2, (n) => `O virote atravessa e acerta mais ${n} inimigo${n > 1 ? 's' : ''}.`, (s) => add(s, 'bPierce', 1));
b(W, 'bes7', 'Recarga Mágica', '↺', 'rare', 1, () => 'Virote caído volta sozinho para a mão depois de 1,5 s.', (s) => add(s, 'bReturn', 1.5));
b(W, 'bes8', 'Virote Explosivo', '✹', 'epic', 1, () => 'O virote explode ao acertar um inimigo: 15 de dano em volta.', (s) => add(s, 'bBlast', 15));
b(W, 'bes9', 'Caçador de Chefes', '♛', 'epic', 1, () => '+50% de dano em chefes e em esqueletos com escudo.', (s) => add(s, 'vsBig', 0.5));
b(W, 'bes10', 'Disparo Mortal', '☠', 'legendary', 1, () => '+25% de chance de crítico; críticos com a besta causam o triplo do dano.', (s) => { s.critChance += 0.25; add(s, 'critDmg', 1); });
// Lista do dono (07/11/2026). As regras ficam em boltkit.js (visual em boltprops.js).
b(W, 'bes11', 'Recarga Perfeita', '▮', 'epic', 1, () => 'Depois de cada tiro aparece uma barrinha de recarga com uma faixa dourada. Apertar o ataque bem na faixa recarrega na hora e o próximo tiro sai rápido e 60% mais forte. Apertar fora da faixa trava a besta por um instante.', (s) => add(s, 'bReload', 1));
b(W, 'bes12', 'Recarga no Pulo', '⤴', 'rare', 1, () => 'Pegar um virote do chão já dispara ele na hora contra o inimigo mais perto.', (s) => add(s, 'bAuto', 1));
b(W, 'bes13', 'Eco do Tiro', '≫', 'rare', 1, () => 'Quando o virote mata, um virote fantasma sai sozinho na direção do próximo inimigo (70% do dano).', (s) => add(s, 'bEcho', 1));
b(W, 'bes14', 'Gancho', '⚓', 'legendary', 1, () => 'Atacar com a besta descarregada solta um gancho com corda que puxa o Ladino até a parede ou o inimigo atingido.', (s) => add(s, 'bHook', 1));
b(W, 'bes16', 'Tiro Acrobático', '↻', 'epic', 1, () => 'Rolar não interrompe a recarga do disparo: a besta continua armando durante a rolagem e atira assim que estiver pronta.', (s) => add(s, 'bRollShot', 1));
b(W, 'bes17', 'Prego', '⊣', 'epic', 1, () => 'Inimigo empurrado contra a parede pelo virote fica pregado ali por 2 s.', (s) => add(s, 'bNail', 1));
b(W, 'bes18', 'Rede', '#', 'epic', 1, () => 'O tiro solta uma rede onde o virote cair, que prende todos os inimigos ali por 2 s.', (s) => add(s, 'bNet', 1));
b(W, 'bes19', 'Âncora', '⚲', 'rare', 1, () => 'O virote prende o inimigo ao chão por uma corda: por 6 s ele só consegue andar em volta do ponto.', (s) => add(s, 'bAnchor', 1));
b(W, 'bes20', 'Armadilha de Urso', '⊓', 'rare', 1, () => 'O virote que erra vira uma armadilha no chão, que prende o primeiro inimigo que pisar nela.', (s) => add(s, 'bTrap', 1));
b(W, 'bes21', 'Golpe Baixo', '⚯', 'epic', 1, () => 'O virote arranca a arma do inimigo atingido e a leva junto até onde parar. Sem arma, ele não ataca e vai andando até ela para pegá-la de volta (chefes não).', (s) => add(s, 'bSteal', 1));
b(W, 'bes22', 'Virote Divisor', '⋔', 'epic', 1, () => 'No meio do voo, o virote se divide em 3 em leque.', (s) => add(s, 'bSplit', 1));
b(W, 'bes23', 'Quique na Parede', '⟲', 'rare', 1, () => 'O virote que bate na parede quica direto para o inimigo mais perto.', (s) => add(s, 'bBounce', 1));
b(W, 'bes24', 'Ricochete no Escudo', '⛉', 'rare', 1, () => 'O virote que bate num escudo, em vez de parar, ricocheteia para outro inimigo.', (s) => add(s, 'bShieldRico', 1));
b(W, 'bes25', 'Rastro Incendiário', '♨', 'epic', 1, () => 'O virote deixa uma linha de fogo no chão por todo o caminho que voou.', (s) => add(s, 'bFire', 1));
b(W, 'bes26', 'Chuva de Virotes', '☔', 'legendary', 1, () => 'Segurar o ataque dispara para o alto, e 1 s depois uma chuva de virotes cai na área mirada.', (s) => add(s, 'bRain', 1));
b(W, 'bes27', 'Roleta', '✣', 'rare', 1, () => 'A cada 5 tiros, o próximo sai como um virote especial aleatório: gelo, fogo, raio ou fumaça.', (s) => add(s, 'bRoulette', 1));
b(W, 'bes28', 'Mira de Atirador', '⌖', 'epic', 1, () => 'Ficar parado 1,5 s mostra uma linha de mira, e o próximo tiro atravessa tudo (até escudos) e atordoa por 2 s.', (s) => add(s, 'bSniper', 1));
b(W, 'bes29', 'Divindade', '✠', 'legendary', 1, () => 'A cada disparo da besta, uma entidade espectral surge atrás do Ladino e atira uma flecha junto com o virote: metade do dano, atravessa todos os inimigos e os marca para sofrerem +15% de dano por 5 s.', (s) => add(s, 'bDivine', 1));
b(W, 'bes30', 'Besta Montada', '♜', 'legendary', 1, () => 'O botão direito monta a besta no chão como uma torre que atira sozinha por 5 s, enquanto o Ladino luta com chutes. Recarga de 10 s.', (s) => add(s, 'bTurret', 1));

// Não vêm juntas: pegou uma, a outra não aparece mais (pedido do dono, 04/11).
const EXCLUDES = {
  w_esp21: ['w_esp29'], w_esp29: ['w_esp21'],
  // Lança: as que trocam o golpe forte não vêm juntas (arremessos, Âncora, Espetinho).
  w_lan16: ['w_lan17', 'w_lan18', 'w_lan21'], w_lan17: ['w_lan16', 'w_lan18', 'w_lan21'],
  w_lan18: ['w_lan16', 'w_lan17', 'w_lan21'], w_lan21: ['w_lan16', 'w_lan17', 'w_lan18'],
  // Manopla: as que trocam o golpe forte (Arremesso, Suplex, Soco Sísmico, Punho Foguete) e as de segurar o ataque.
  w_mnp11: ['w_mnp12', 'w_mnp17', 'w_mnp19'], w_mnp12: ['w_mnp11', 'w_mnp17', 'w_mnp19'],
  w_mnp17: ['w_mnp11', 'w_mnp12', 'w_mnp19'], w_mnp19: ['w_mnp11', 'w_mnp12', 'w_mnp17'],
  w_mnp13: ['w_mnp25'], w_mnp25: ['w_mnp13'],
  // Cajado Arcano: o que acontece com o orbe que erra (só uma); Bolha x Levitar; Repulsor x Singularidade.
  w_caj11: ['w_caj16', 'w_caj17'], w_caj16: ['w_caj11', 'w_caj17'], w_caj17: ['w_caj11', 'w_caj16'],
  w_caj14: ['w_caj21'], w_caj21: ['w_caj14'],
  w_caj23: ['w_caj10'], w_caj10: ['w_caj23'],
  // Cajado das Trevas: Dízimo (desfaz no fim da sala) x Rei dos Mortos (leva para a próxima).
  w_tre13: ['w_tre16'], w_tre16: ['w_tre13'],
  // Cajado de Gelo: quem morre congelado vira Estátua ou Boneco de Neve (um só).
  w_gel12: ['w_gel29'], w_gel29: ['w_gel12'],
  // Duas Adagas: rolar até o inimigo vira teleporte, então não corta ninguém no caminho.
  // Kunais: as duas trocam o rolamento por um teleporte.
  w_kun16: ['w_kun17'], w_kun17: ['w_kun16'],
};
for (const it of LIST) if (EXCLUDES[it.id]) it.excludes = EXCLUDES[it.id];
for (const it of LIST) if (it.id === 'w_ele30') it.coop = true; // Choque Amigo: só com 2 heróis
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
