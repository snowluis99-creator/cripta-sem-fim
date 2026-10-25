// Dados dos heróis (fácil de balancear: só números e nomes aqui).
// Cada herói começa com uma arma e pode comprar mais na Taverna (WEAPONS). Nenhuma é melhor que a outra:
// cada uma muda o jeito de jogar (combo, alcance, área, velocidade, com ou sem escudo).

export const HEROES = {
  knight: {
    name: 'Cavaleiro',
    model: 'heroes/Knight.glb',
    weapons: {
      right: { model: 'weapons/heroes/sword_1handed.gltf', rot: [0, 0, 0] },
      left: { model: 'weapons/heroes/shield_badge_color.gltf', rot: [0, 0, 0] },
    },
    radius: 0.6,          // tamanho do corpo para colisão
    maxHp: 100,
    potions: 1,           // poções no começo
    potionHeal: 35,
    hurt: { time: 0.3, iframes: 0.8, push: 7 },  // ao apanhar: tempo atordoado, invencível depois, empurrão
    block: { arc: 150 },  // bloqueio: ângulo protegido à frente; bloqueia 100%, mas gasta o escudo (shield.js)
    moveSpeed: 7,         // unidades por segundo
    turnSpeed: 16,        // rapidez para virar
    blockMoveSpeed: 0,    // parado enquanto bloqueia
    // Rolamento: cambalhota feita pelo jogo (a KayKit não tem animação de rolar). pose = postura encolhida.
    dodge: { distance: 6, time: 0.3, cooldown: 0.2, pose: 'Crouching', flips: 1 },
    // Combo. hit = momento do dano (0..1 do clipe, no pico do movimento do braço);
    // end = onde o golpe termina (corta a recuperação lenta); window = a partir daqui um clique emenda o próximo;
    // lunge = avanço do golpe; heavy = golpe forte (brilho na arma, onda de choque, tremida).
    // Opcionais por golpe: arc (ângulo próprio, ex. 360 no giro), blastMul (área do golpe forte).
    combo: [
      { clip: 'Melee_1H_Attack_Slice_Horizontal', speed: 1.15, hit: 0.24, end: 0.65, window: 0.32, lunge: 0.3, damage: 10 },
      { clip: 'Melee_1H_Attack_Stab', speed: 1.3, hit: 0.28, end: 0.55, window: 0.3, lunge: 0.7, damage: 10 },
      { clip: 'Melee_1H_Attack_Chop', speed: 1.15, hit: 0.59, end: 0.85, lunge: 0.5, damage: 18, heavy: true },
    ],
    attackCancel: 0.6,   // a partir daqui o golpe já pode ser interrompido por movimento
    attackRange: 2.6,
    attackArc: 120,      // graus
    anims: {
      idle: 'Idle_A',
      run: 'Running_A',
      blockStart: 'Melee_Block',
      blocking: 'Melee_Blocking',
      hit: 'Hit_A',
      blockHit: 'Melee_Block_Hit',
      death: 'Death_A',
      drink: 'Use_Item',
    },
  },
};

// Maga: ataca de longe (cast = magia que sai no momento do golpe; magic.js). Bloqueio = barreira mágica
// na frente dela (funciona igual ao escudo: 10 bloqueios e quebra). Menos vida que o Cavaleiro.
HEROES.mage = {
  name: 'Maga',
  model: 'heroes/Mage.glb',
  weapons: { right: { model: 'weapons/heroes/staff.gltf', rot: [0, 0, 0], tip: 1.25, fx: 'arcane' } },
  radius: 0.6,
  maxHp: 50,
  potions: 1,
  potionHeal: 35,
  hurt: { time: 0.3, iframes: 0.8, push: 7 },
  block: { arc: 150, wall: true },
  moveSpeed: 7,
  turnSpeed: 16,
  blockMoveSpeed: 0,
  dodge: { distance: 6, time: 0.3, cooldown: 0.2, pose: 'Crouching', flips: 1 },
  caster: true,
  brighten: { Hat: 1.9, Cape: 1.5, Body: 1.35 }, // chapéu/manto mais claros: vista de cima ela não vira uma mancha escura
  combo: [], // vem da arma (WEAPONS.mage)
  attackCancel: 0.6,
  attackRange: 4.5,    // até onde as magias vão (usado também pela Lâmina Longa = mais alcance)
  attackArc: 30,
  anims: {
    idle: 'Idle_A', run: 'Running_A', blockStart: 'Melee_Block', blocking: 'Melee_Blocking',
    hit: 'Hit_A', blockHit: 'Melee_Block_Hit', death: 'Death_A', drink: 'Use_Item',
  },
};

// Ladino: rápido e frágil, vive de críticos (25% de chance base; Precisão Invejável = 100% por 5 s).
// Sem escudo. Botão direito: Bomba de Fumaça (fica invisível; o 1º golpe sai crítico). Rapieira: aparar.
// Kunais e Besta usam munição (ammo): o que foi arremessado fica no chão até ser pego (rogue.js).
HEROES.rogue = {
  name: 'Ladino',
  model: 'heroes/Rogue.glb',
  weapons: {
    right: { model: 'weapons/heroes/dagger.gltf', rot: [0, 0, 0], tip: 0.95, scale: 1.1 },
    left: { model: 'weapons/heroes/dagger.gltf', rot: [0, 0, 0], scale: 1.1 },
  },
  radius: 0.55,
  maxHp: 70,
  potions: 1,
  potionHeal: 35,
  hurt: { time: 0.28, iframes: 0.8, push: 7 },
  block: { arc: 150 },
  noShield: true,
  moveSpeed: 7.8,
  turnSpeed: 18,
  blockMoveSpeed: 0,
  dodge: { distance: 6.5, time: 0.28, cooldown: 0.15, pose: 'Crouching', flips: 1 },
  crit: 0.25,           // chance de crítico própria do herói (soma com Olho do Carrasco)
  ability: 'smoke',     // botão direito (rogue.js)
  combo: [
    { clip: 'Melee_Dualwield_Attack_Stab', speed: 1.7, hit: 0.25, end: 0.5, window: 0.28, lunge: 0.35, damage: 7 },
    { clip: 'Melee_Dualwield_Attack_Slice', speed: 1.9, hit: 0.64, end: 0.82, window: 0.66, lunge: 0.3, damage: 7 },
    { clip: 'Melee_Dualwield_Attack_Chop', speed: 1.5, hit: 0.45, end: 0.72, lunge: 0.5, damage: 13, heavy: true, blastMul: 0.7 },
  ],
  attackCancel: 0.5,
  attackRange: 2.3,
  attackArc: 110,
  anims: {
    idle: 'Idle_A', run: 'Running_A', blockStart: 'Melee_Block', blocking: 'Melee_Blocking',
    hit: 'Hit_A', blockHit: 'Melee_Block_Hit', death: 'Death_A', drink: 'Use_Item',
  },
};

// Artigo do nome (textos da Taverna: "a Maga", "o Ladino").
export const heroArticle = (id) => (id === 'mage' ? 'a' : 'o');

// Ordem dos heróis (o número é o que fica salvo como herói escolhido).
export const HERO_IDS = ['knight', 'mage', 'rogue'];
// Preço para desbloquear um herói novo na Taverna (Ouro de Alma).
export const HERO_PRICE = 1500;
export const heroKey = (heroId) => `h_${heroId}`;
export const HERO_SEL = 'eh';
export function ownsHero(ups, heroId) { return heroId === 'knight' || !!(ups && ups[heroKey(heroId)]); }
export function selectedHero(ups) {
  const id = HERO_IDS[ups ? ups[HERO_SEL] | 0 : 0] || 'knight';
  return ownsHero(ups, id) ? id : 'knight';
}

// Preço de cada arma nova na Taverna (Ouro de Alma). Todas custam o mesmo.
export const WEAPON_PRICE = 500;

// Armas de cada herói. A primeira é a inicial (já vem com o herói). Cada uma troca só o que muda no herói.
// tip = comprimento da arma no eixo +Y do modelo (para a Lâmina Longa crescer a arma certo).
export const WEAPONS = {
  knight: [
    { id: 'espada', name: 'Espada e Escudo', short: 'Espada', icon: '⚔', color: 0xcfd8e6,
      desc: 'Versátil: golpes rápidos e escudo para bloquear. Dano baixo.',
      set: {} },
    { id: 'machado', name: 'Machado de Duas Mãos', short: 'Machado', icon: '⚒', color: 0xff8a4a,
      desc: 'Sem escudo. Golpes lentos, mas com muito mais dano; o 2º golpe gira em volta.',
      set: {
        noShield: true,
        weapons: { right: { model: 'weapons/heroes/axe_2handed.gltf', rot: [0, 0, 0], tip: 1.29 } },
        combo: [
          { clip: 'Melee_2H_Attack_Slice', speed: 0.9, hit: 0.38, end: 0.78, window: 0.42, lunge: 0.4, damage: 24 },
          // Giro: o clipe gira 360° em 0,67 s (velocidade 1). end > 1 = segura a pose final, então o golpe dura
          // o mesmo de antes (~1,06 s) e o combo só emenda depois da volta completa (window 1).
          { clip: 'Melee_2H_Attack_Spinning', speed: 1.0, hit: 0.5, end: 1.58, window: 1.0, cancel: 1.05, lunge: 0.6, damage: 22, arc: 360 },
          { clip: 'Melee_2H_Attack_Chop', speed: 0.95, hit: 0.5, end: 0.85, lunge: 0.6, damage: 46, heavy: true, blastMul: 1.2 },
        ],
        attackCancel: 0.7,
        attackRange: 3.0,
        attackArc: 140,
        anims: { idle: 'Melee_2H_Idle' },
      } },
    { id: 'mangual', name: 'Mangual e Escudo', short: 'Mangual', icon: '✹', color: 0xb9a2ff,
      desc: 'Golpes que cobrem uma área muito grande, com menos dano que a espada. Mantém o escudo.',
      set: {
        weapons: {
          right: { flail: true, rot: [0, 0, 0], tip: 1.6 },
          left: { model: 'weapons/heroes/shield_badge_color.gltf', rot: [0, 0, 0] },
        },
        combo: [
          { clip: 'Melee_1H_Attack_Slice_Horizontal', speed: 1.0, hit: 0.26, end: 0.66, window: 0.34, lunge: 0.2, damage: 7 },
          { clip: 'Melee_1H_Attack_Slice_Diagonal', speed: 1.0, hit: 0.44, end: 0.75, window: 0.48, lunge: 0.3, damage: 7 },
          { clip: 'Melee_1H_Attack_Chop', speed: 1.0, hit: 0.6, end: 0.86, lunge: 0.4, damage: 13, heavy: true, blastMul: 1.6 },
        ],
        attackRange: 3.9,
        attackArc: 230,
      } },
    { id: 'lanca', name: 'Lança de Duas Mãos', short: 'Lança', icon: '➶', color: 0x7fd6ff,
      desc: 'Sem escudo. Alcance enorme, mas cada golpe acerta só 1 inimigo (o mais perto na frente).',
      set: {
        noShield: true,
        single: true,
        weapons: { right: { model: 'weapons/extra/spear_A.gltf', rot: [0, 0, 0], tip: 2.1 } },
        combo: [
          { clip: 'Melee_2H_Attack_Stab', speed: 1.4, hit: 0.27, end: 0.55, window: 0.3, lunge: 0.3, damage: 13 },
          { clip: 'Melee_2H_Attack_Stab', speed: 1.6, hit: 0.27, end: 0.55, window: 0.3, lunge: 0.4, damage: 13 },
          { clip: 'Melee_2H_Attack_Stab', speed: 1.0, hit: 0.27, end: 0.62, lunge: 1.4, damage: 26, heavy: true },
        ],
        attackRange: 5.4,
        attackArc: 36,
        anims: { idle: 'Melee_2H_Idle' },
      } },
    { id: 'manopla', name: 'Manopla e Escudo de Antebraço', short: 'Manopla', icon: '✊', color: 0xffd36a,
      desc: 'Os golpes mais rápidos: combo de 4. Alcance bem curto; dano parecido com o da espada. O 1º esbarrão em esqueleto não machuca.',
      set: {
        weapons: {
          right: { model: 'weapons/extra/fistweapon_A.gltf', rot: [0, 0, 0], tip: 0.3, scale: 1.5, gold: true },
          left: { model: 'weapons/heroes/shield_round.gltf', rot: [0, 0, 0], scale: 0.72 },
        },
        combo: [
          { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 1.9, hit: 0.38, end: 0.6, window: 0.44, lunge: 0.25, damage: 8 },
          { clip: 'Melee_Block_Attack', speed: 1.9, hit: 0.36, end: 0.6, window: 0.42, lunge: 0.3, damage: 8 },
          { clip: 'Melee_Unarmed_Attack_Kick', speed: 1.7, hit: 0.45, end: 0.66, window: 0.5, lunge: 0.3, damage: 8 },
          { clip: 'Melee_1H_Attack_Chop', speed: 1.5, hit: 0.6, end: 0.82, lunge: 0.4, damage: 15, heavy: true, blastMul: 0.8 },
        ],
        attackCancel: 0.55,
        // Esbarrão perdoado: o 1º encostão num esqueleto não machuca; só um 2º logo em seguida (bump em combat.js).
        bumpGuard: true,
        attackRange: 1.9,
        attackArc: 110,
      } },
  ],
  // Maga: cada arma tem um visual bem diferente (fx = enfeite brilhante feito em código, weaponfx.js)
  // e uma magia diferente. cast: bolt (orbe que voa), beam (raio em linha reta), cone (sopro de fogo).
  mage: [
    { id: 'cajado', name: 'Cajado Arcano', short: 'Cajado', icon: '✦', color: 0xb070ff,
      desc: 'Orbes roxos de média distância; o 3º é um orbe grande e mais forte.',
      set: {
        combo: [
          { clip: 'Ranged_Magic_Shoot', speed: 0.78, hit: 0.24, end: 0.62, window: 0.3, lunge: 0, damage: 3,
            cast: { type: 'bolt', speed: 24, size: 1, color: 0xb070ff } },
          { clip: 'Ranged_Magic_Shoot', speed: 0.83, hit: 0.24, end: 0.62, window: 0.3, lunge: 0, damage: 3,
            cast: { type: 'bolt', speed: 24, size: 1, color: 0xb070ff } },
          { clip: 'Ranged_Magic_Spellcasting', speed: 0.47, hit: 0.3, end: 0.52, lunge: 0, damage: 8, heavy: true,
            cast: { type: 'bolt', speed: 17, size: 2, color: 0xd59bff } },
        ],
      } },
    { id: 'varinha', name: 'Varinha Estelar', short: 'Varinha', icon: '★', color: 0xffd84a,
      desc: 'Estrelinhas rápidas de curta distância: combo de 5. Pouco dano por tiro; a 5ª solta 3 estrelas em cone.',
      set: {
        weapons: { right: { model: 'weapons/extra/wand_A.gltf', rot: [0, 0, 0], tip: 0.83, scale: 1.3, fx: 'star' } },
        combo: [
          { clip: 'Ranged_1H_Shoot', speed: 1.25, hit: 0.26, end: 0.5, window: 0.3, lunge: 0, damage: 2,
            cast: { type: 'bolt', speed: 34, size: 0.6, color: 0xffe066, star: true } },
          { clip: 'Ranged_1H_Shoot', speed: 1.25, hit: 0.26, end: 0.5, window: 0.3, lunge: 0, damage: 2,
            cast: { type: 'bolt', speed: 34, size: 0.6, color: 0xffe066, star: true } },
          { clip: 'Ranged_1H_Shoot', speed: 1.25, hit: 0.26, end: 0.5, window: 0.3, lunge: 0, damage: 2,
            cast: { type: 'bolt', speed: 34, size: 0.6, color: 0xffe066, star: true } },
          { clip: 'Ranged_1H_Shoot', speed: 1.25, hit: 0.26, end: 0.5, window: 0.3, lunge: 0, damage: 2,
            cast: { type: 'bolt', speed: 34, size: 0.6, color: 0xffe066, star: true } },
          { clip: 'Ranged_Magic_Shoot', speed: 0.73, hit: 0.24, end: 0.48, lunge: 0, damage: 5, heavy: true,
            cast: { type: 'bolt', speed: 30, size: 1.0, color: 0xfff2a0, star: true, count: 3, spread: 22 } },
        ],
        attackCancel: 0.45,
        attackRange: 3.5,
      } },
    { id: 'grimorio', name: 'Grimório Verde', short: 'Grimório', icon: '❖', color: 0x4dff9a,
      desc: 'Raio verde em linha reta que atravessa todos os esqueletos. Mais lento.',
      set: {
        weapons: { right: { model: 'weapons/heroes/spellbook_open.gltf', rot: [-70, 0, 0], tip: 0.3, scale: 1.25, fx: 'tome' } },
        combo: [
          { clip: 'Ranged_Magic_Spellcasting', speed: 0.52, hit: 0.3, end: 0.8, window: 0.35, lunge: 0, damage: 2,
            cast: { type: 'beam', length: 4, width: 0.8, color: 0x4dff9a } },
          { clip: 'Ranged_Magic_Spellcasting', speed: 0.52, hit: 0.3, end: 0.8, window: 0.35, lunge: 0, damage: 2,
            cast: { type: 'beam', length: 4, width: 0.8, color: 0x4dff9a } },
          { clip: 'Ranged_Magic_Shoot', speed: 0.47, hit: 0.28, end: 0.43, lunge: 0, damage: 4, heavy: true,
            cast: { type: 'beam', length: 4, width: 0.8, color: 0x9dffc8 } },
        ],
      } },
    { id: 'gelo', name: 'Cajado de Gelo', short: 'Gelo', icon: '❄', color: 0x8fe3ff,
      desc: 'Orbes de gelo que deixam os esqueletos lentos; o 3º ataque sempre congela (imobiliza) o esqueleto atingido, mesmo no meio de um golpe ou habilidade. Chefes: metade do tempo.',
      set: {
        weapons: { right: { model: 'weapons/extra/staff_A.gltf', rot: [0, 0, 0], tip: 1.07, scale: 1.15, fx: 'ice', tint: 0xcff4ff } },
        combo: [
          { clip: 'Ranged_Magic_Shoot', speed: 0.73, hit: 0.24, end: 0.62, window: 0.3, lunge: 0, damage: 3,
            cast: { type: 'bolt', speed: 20, size: 1, color: 0x2f7dff, slow: 2.5, shard: true } },
          { clip: 'Ranged_Magic_Shoot', speed: 0.78, hit: 0.24, end: 0.62, window: 0.3, lunge: 0, damage: 3,
            cast: { type: 'bolt', speed: 20, size: 1, color: 0x2f7dff, slow: 2.5, shard: true } },
          { clip: 'Ranged_Magic_Spellcasting', speed: 0.47, hit: 0.3, end: 0.52, lunge: 0, damage: 3, heavy: true,
            cast: { type: 'bolt', speed: 22, size: 1.5, color: 0x4a9bff, freeze: 2.2, shard: true } },
        ],
      } },
    { id: 'fogo', name: 'Cajado de Fogo', short: 'Fogo', icon: '♨', color: 0xff6a1a,
      desc: 'Sopro de fogo de perto, em cone, que deixa os esqueletos queimando. Alcance curto; o 3º é uma explosão de fogo em volta da Maga.',
      set: {
        weapons: { right: { model: 'weapons/extra/staff_B.gltf', rot: [0, 0, 0], tip: 1.45, fx: 'fire', tint: 0x8a3020 } },
        combo: [
          { clip: 'Ranged_Magic_Spellcasting', speed: 0.68, hit: 0.28, end: 0.7, window: 0.32, lunge: 0, damage: 3,
            cast: { type: 'cone', range: 2.4, arc: 70, color: 0xff7a2a, burn: 1.5 } },
          { clip: 'Ranged_Magic_Spellcasting', speed: 0.68, hit: 0.28, end: 0.7, window: 0.32, lunge: 0, damage: 3,
            cast: { type: 'cone', range: 2.4, arc: 70, color: 0xff7a2a, burn: 1.5 } },
          { clip: 'Ranged_Magic_Shoot', speed: 0.52, hit: 0.26, end: 0.43, lunge: 0, damage: 6, heavy: true,
            cast: { type: 'nova', radius: 3.2, color: 0xffb04a, burn: 2 } }, // explosão de fogo em volta da Maga (360°)
        ],
        attackRange: 2.5,
      } },
  ],
  // Ladino (pedido do dono, 25/10/2026). Todas sem escudo.
  rogue: [
    { id: 'adagas', name: 'Duas Adagas', short: 'Adagas', icon: '⚔', color: 0xd8dde8,
      desc: 'Golpes rápidos com as duas mãos e 25% de chance de crítico. Botão direito: bomba de fumaça.',
      set: {} },
    { id: 'kunai', name: 'Kunais de Arremesso', short: 'Kunais', icon: '✧', color: 0x6fe3ff,
      desc: '2 kunais com alcance infinito e dano MUITO baixo. Acertou um inimigo: ela voa para cima e cai no círculo — pegue e arremesse de novo rápido para o dano ir crescendo. Errou: ela fica no chão até você pegar.',
      set: {
        weapons: { right: { model: 'weapons/extra/dagger_A.gltf', rot: [0, 0, 0], tip: 0.9, scale: 0.85, tint: 0x9fe8ff } },
        ammo: { kind: 'kunai', max: 2 },
        combo: [
          { clip: 'Throw', speed: 2.1, hit: 0.44, end: 0.68, window: 0.46, lunge: 0, damage: 2, throw: 'kunai' },
        ],
        attackCancel: 0.5,
      } },
    { id: 'garras', name: 'Garras', short: 'Garras', icon: '≋', color: 0xff5a6a,
      desc: 'Combo de 5 golpes de alcance médio. Pouco dano e não interrompe o que o inimigo está fazendo; o 5º golpe deixa o alvo sangrando.',
      set: {
        weapons: {
          right: { model: 'weapons/extra/fistweapon_B.gltf', rot: [0, 0, 0], tip: 0.4, scale: 1.5 },
          left: { model: 'weapons/extra/fistweapon_B.gltf', rot: [0, 0, 0], scale: 1.5 },
        },
        noStagger: true,
        combo: [
          { clip: 'Melee_Dualwield_Attack_Stab', speed: 2.0, hit: 0.25, end: 0.48, window: 0.27, lunge: 0.3, damage: 4 },
          { clip: 'Melee_Unarmed_Attack_Punch_A', speed: 2.0, hit: 0.38, end: 0.58, window: 0.4, lunge: 0.3, damage: 4 },
          { clip: 'Melee_Dualwield_Attack_Slice', speed: 2.2, hit: 0.64, end: 0.8, window: 0.66, lunge: 0.3, damage: 4 },
          { clip: 'Melee_Dualwield_Attack_Stab', speed: 2.2, hit: 0.25, end: 0.48, window: 0.27, lunge: 0.3, damage: 4 },
          { clip: 'Melee_Dualwield_Attack_Chop', speed: 1.6, hit: 0.45, end: 0.72, lunge: 0.4, damage: 6, heavy: true, blastMul: 0.6,
            bleed: { dps: 6, time: 4 } },
        ],
        attackCancel: 0.45,
        attackRange: 2.7,
        attackArc: 120,
      } },
    { id: 'rapieira', name: 'Rapieira', short: 'Rapieira', icon: '†', color: 0xffe27a,
      desc: 'Estocadas de alcance médio que acertam só 1 inimigo, com dano baixo. Pelas costas: sempre crítico. Botão direito: aparar — no instante exato do golpe inimigo, defende e atordoa; se errar o tempo, leva o dano.',
      set: {
        single: true,
        backstab: true,
        ability: 'parry',
        weapons: { right: { model: 'weapons/extra/sword_C.gltf', rot: [0, 0, 0], tip: 1.9 } },
        combo: [
          { clip: 'Melee_1H_Attack_Stab', speed: 1.5, hit: 0.27, end: 0.52, window: 0.3, lunge: 0.6, damage: 6 },
          { clip: 'Melee_1H_Attack_Stab', speed: 1.7, hit: 0.27, end: 0.52, window: 0.3, lunge: 0.6, damage: 6 },
          { clip: 'Melee_1H_Attack_Stab', speed: 1.25, hit: 0.27, end: 0.58, lunge: 1.0, damage: 9, heavy: true },
        ],
        attackRange: 3.4,
        attackArc: 40,
      } },
    { id: 'besta', name: 'Besta de Mão', short: 'Besta', icon: '➹', color: 0xc99a5a,
      desc: '3 virotes de dano médio e alcance infinito. O virote para onde bater; se acertar um inimigo, cai no chão embaixo dele. Ande por cima para pegar de volta.',
      set: {
        weapons: { right: { model: 'weapons/heroes/crossbow_1handed.gltf', rot: [0, 0, 0], tip: 0.6 } },
        ammo: { kind: 'bolt', max: 3 },
        combo: [
          { clip: 'Ranged_1H_Shoot', speed: 1.4, hit: 0.3, end: 0.6, window: 0.34, lunge: 0, damage: 12, throw: 'bolt' },
        ],
        attackCancel: 0.45,
      } },
  ],
};

export const weaponById = (heroId, id) => (WEAPONS[heroId] || []).find((w) => w.id === id) || WEAPONS[heroId][0];

// Herói com a arma escolhida (objeto novo; o original não muda).
export function heroWith(heroId, weaponId) {
  const base = HEROES[heroId];
  const w = weaponById(heroId, weaponId);
  const s = w.set;
  return {
    ...base, ...s,
    id: heroId,
    weaponId: w.id,
    weapons: s.weapons || base.weapons,
    anims: { ...base.anims, ...(s.anims || {}) },
    combo: s.combo || base.combo,
    heavyIdx: Math.max(0, (s.combo || base.combo).findIndex((c) => c.heavy)),
  };
}

// Todos os modelos de arma de um herói (para carregar no começo).
export const weaponModels = (heroId) => [...new Set([HEROES[heroId].weapons, ...WEAPONS[heroId].map((w) => w.set.weapons || {})]
  .flatMap((ws) => Object.values(ws).map((x) => x.model).filter(Boolean)))];
export const allHeroModels = () => HERO_IDS.flatMap((id) => [HEROES[id].model, ...weaponModels(id)]);

// Progresso salvo (save.ups): "w_<herói>_<arma>" = comprada; "eq_<herói>" = número da arma equipada.
export const ownKey = (heroId, wid) => `w_${heroId}_${wid}`;
export const eqKey = (heroId) => `eq_${heroId}`;
export function ownsWeapon(ups, heroId, wid) {
  return WEAPONS[heroId][0].id === wid || !!(ups && ups[ownKey(heroId, wid)]);
}
export function equippedWeapon(ups, heroId) {
  const list = WEAPONS[heroId];
  const i = ups ? ups[eqKey(heroId)] | 0 : 0;
  const w = list[i] || list[0];
  return ownsWeapon(ups, heroId, w.id) ? w.id : list[0].id;
}
