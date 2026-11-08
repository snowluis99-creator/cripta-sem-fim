// Teste automático, parte 13 (26/10/2026): Cajado das Trevas (marca e mortos-vivos), Ladino destruindo projéteis,
// Rapieira em cone virando de costas, Kunai que atravessa e bate na parede sem perder a corrente.
// Tecla Y = tudo; tecla 3 = só esta parte.
import { BLESSINGS } from './blessings.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* newWeaponTests(g, out, flags) {
  const { player, combat, waves } = g;
  const fresh = (hero, wid) => {
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero(hero, wid); player.reset(0, 2); player.facing = Math.PI;
    flags.events.length = 0;
  };
  const dummy = (x, z, type = 'minion', facing = 0) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing }); e.hp = e.maxHp = 999; e.shieldCovers = () => false; return e; };
  const wait = function* (cond, ms = 4000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const waitGame = function* (cond, sec) { for (let t = 0; t < sec && !cond(); t += 0.1) yield 0.1; }; // conta o tempo do jogo

  // ---------------- 60) Cajado das Trevas ----------------
  out('60) Cajado das Trevas: marcado que morre levanta com 1 de vida e luta pela Maga');
  fresh('mage', 'trevas'); yield 0.2;
  player.iframes = 999;
  const v = dummy(0, -0.5); v.hp = 2; // morre com o orbe
  combat.playerStrike(player, player.hero.combo[2]);
  yield* wait(() => !v.alive);
  out(`  marcou e matou ${ok(!!v.darkMark && !v.alive)}`);
  yield* wait(() => combat.enemies.some((e) => e.undead && e.alive), 3000);
  const u = combat.enemies.find((e) => e.undead && e.alive);
  out(`  levantou ${ok(!!u)} | com 1 de vida ${ok(u && u.hp === 1)} | não conta como inimigo da sala ${ok(combat.aliveCount === 0)} | herói não acerta nele ${ok(u && !u.targetable)}`);
  yield 1.2; // termina de levantar
  const foe = combat.spawn('minion', 4, -3, { awake: true, facing: 0 }); foe.hp = foe.maxHp = 60; foe.shieldCovers = () => false;
  player.position.set(-8, 0, 6);
  yield 0.4;
  out(`  inimigo não vai atrás dele antes de apanhar ${ok(foe.target !== u, foe.target === u ? 'morto-vivo' : 'herói')}`);
  yield* waitGame(() => foe.hp < 60 || !u.alive, 15);
  yield 0.05;
  out(`  o morto-vivo atacou o inimigo ${ok(foe.hp < 60, 60 - foe.hp)} | inimigo agora briga com ele ${ok(foe.provokedBy === u && foe.target === u)}`);
  yield* wait(() => !u.alive || foe.hp <= 0, 8000);
  out(`  inimigo revidou: morto-vivo caiu ${ok(!u.alive || foe.hp <= 0, u.alive ? 'inimigo morreu antes' : '')} | herói intacto ${ok(player.hp === player.maxHp)}`);
  yield 0.6;
  out('  -> morto-vivo roxo e o inimigo: CONGELADO (T continua)');
  yield 'hold';
  // Morto-vivo usa as habilidades de quando estava vivo (pedido do dono, 31/10): lacaio pula, guerreiro investe, arqueiro atira.
  for (const [type, moves] of [['minion', ['leap', 'leapWind']], ['warrior', ['chargeWind', 'charge']], ['archer', ['aim', 'shot']]]) {
    fresh('mage', 'trevas'); yield 0.2;
    player.iframes = 999;
    const m = dummy(0, -0.5, type); m.hp = 2;
    combat.playerStrike(player, player.hero.combo[2]);
    yield* wait(() => combat.enemies.some((e) => e.undead && e.alive), 3000);
    const uu = combat.enemies.find((e) => e.undead && e.alive);
    yield 1.2;
    player.position.set(-9, 0, 7);
    const hp0 = player.hp;
    const f = dummy(1, -6.5); f.hp = f.maxHp = 400;
    if (uu && uu.cd) for (const k of ['leap', 'charge']) if (k in uu.cd) uu.cd[k] = 0.3; // habilidade pronta (o teste não depende da sorte)
    let saw = null, shots = 0;
    const n0 = combat.projectiles.list.length;
    yield* waitGame(() => {
      if (uu && moves.includes(uu.state)) saw = uu.state;
      shots = Math.max(shots, combat.projectiles.list.filter((a) => a.owner === uu && a.hits === 'undead').length);
      return !!saw && f.hp < 400;
    }, 15);
    yield 0.1;
    out(`  ${type} morto-vivo: usou a habilidade ${ok(!!saw, saw || uu && uu.state)} | acertou o inimigo ${ok(f.hp < 400, 400 - f.hp)}${type === 'archer' ? ` | atirou virote nos inimigos ${ok(shots > 0 || n0 > 0)}` : ''} | herói intacto ${ok(player.hp === hp0)}`);
  }
  // sozinho na sala: desmorona depois de um tempo
  fresh('mage', 'trevas'); yield 0.2;
  const v2 = dummy(0, -0.5); v2.hp = 2;
  combat.playerStrike(player, player.hero.combo[2]);
  yield* wait(() => combat.enemies.some((e) => e.undead && e.alive), 3000);
  const u2 = combat.enemies.find((e) => e.undead);
  yield* wait(() => u2 && !u2.alive, 7000);
  out(`  sem inimigos: desmorona sozinho ${ok(u2 && !u2.alive)}`);
  // chefe não é marcado; bênção Exército das Trevas marca com todo golpe
  fresh('mage', 'trevas'); yield 0.2;
  const boss = dummy(0, -1, 'guardian');
  combat.playerStrike(player, player.hero.combo[2]);
  yield* wait(() => boss.hp < 999);
  out(`  chefe não é marcado ${ok(!boss.darkMark)}`);
  fresh('mage', 'trevas'); yield 0.1;
  player.addBlessing(BLESSINGS.find((b) => b.id === 'w_tre10'));
  const mk = dummy(0, -0.5);
  combat.playerStrike(player, player.hero.combo[0]);
  yield* wait(() => mk.hp < 999);
  out(`  Exército das Trevas: o 1º golpe também marca ${ok(!!mk.darkMark)}`);

  // ---------------- 61) Elétrico + bênçãos ----------------
  out('61) Cajado Elétrico: bênção Fúria da Tempestade');
  fresh('mage', 'eletrico'); yield 0.1;
  player.addBlessing(BLESSINGS.find((b) => b.id === 'w_ele10'));
  const far = dummy(9, -8);
  combat.playerStrike(player, player.hero.combo[0]);
  yield 0.1;
  out(`  Fúria da Tempestade: o 1º golpe já dá 1 em todos ${ok(far.hp === 998, 999 - far.hp)}`);

  // ---------------- 62) Ladino destrói projéteis ----------------
  out('62) Ladino: golpes, kunais e virotes destroem flechas e magias');
  fresh('rogue', 'adagas'); yield 0.2;
  player.iframes = 0;
  const shoot = (x, z, kind = 'arrow') => combat.projectiles.fire(x, z, Math.atan2(player.position.x - x, player.position.z - z), { speed: 6, damage: 9, kind, color: 0xb070ff, owner: null });
  shoot(0, 0.4);
  shoot(0.7, 0.7, 'orb');
  yield 0.05;
  const n0 = combat.projectiles.list.length;
  flags.events.length = 0;
  combat.playerStrike(player, player.hero.combo[0]);
  const smashed = flags.events.filter((e) => e.type === 'smashed').length;
  out(`  golpe destruiu a flecha e o orbe ${ok(smashed === 2 && combat.projectiles.list.length === n0 - 2, smashed)}`);
  shoot(0, 8); yield 0.05; // atrás dele: não pega
  flags.events.length = 0;
  combat.playerStrike(player, player.hero.combo[0]);
  out(`  projétil pelas costas não é destruído ${ok(!flags.events.some((e) => e.type === 'smashed'))}`);
  combat.projectiles.clear();
  fresh('rogue', 'kunai'); yield 0.2;
  combat.projectiles.fire(0, -9, 0, { speed: 8, damage: 9, kind: 'arrow', owner: null });
  flags.events.length = 0;
  combat.playerStrike(player, player.hero.combo[0]);
  yield* wait(() => flags.events.some((e) => e.type === 'smashed'), 2500);
  out(`  kunai voando destruiu a flecha ${ok(flags.events.some((e) => e.type === 'smashed'))} | herói sem dano ${ok(player.hp === player.maxHp)}`);

  // ---------------- 63) Rapieira em cone ----------------
  out('63) Rapieira: 2º golpe em cone acerta todos na frente e deixa de costas');
  fresh('rogue', 'rapieira'); yield 0.2;
  const L = [dummy(-1.1, 0.2), dummy(1.1, 0.2), dummy(0, -0.8)], back = dummy(0, 5);
  for (const e of L) e.facing = Math.atan2(player.position.x - e.position.x, player.position.z - e.position.z);
  flags.events.length = 0;
  combat.playerStrike(player, player.hero.combo[1]);
  const away = (e) => Math.abs(Math.atan2(Math.sin(e.facing - Math.atan2(e.position.x - player.position.x, e.position.z - player.position.z)), Math.cos(e.facing - Math.atan2(e.position.x - player.position.x, e.position.z - player.position.z)))) < 0.2;
  out(`  acertou os 3 da frente ${ok(L.every((e) => e.hp < 999))} | o de trás não ${ok(back.hp === 999)} | todos de costas ${ok(L.every(away))}`);
  yield 0.3;
  out(`  continuam de costas logo depois ${ok(L.every(away))}`);
  flags.events.length = 0;
  combat.playerStrike(player, player.hero.combo[0]);
  out(`  1º golpe continua em 1 alvo ${ok(flags.events.filter((e) => e.type === 'hit').length === 1)}`);
  yield 0.2;
  out('  -> rapieira em cone: CONGELADO (T continua)');
  yield 'hold';

  // ---------------- 64) Kunai: atravessou e bateu na parede ----------------
  out('64) Kunai com Ricochete de Aço: atravessa, bate na parede e mantém a corrente');
  fresh('rogue', 'kunai'); yield 0.2;
  const pierce = BLESSINGS.find((b) => b.weapon === 'rogue.kunai' && /atravessa/i.test(b.desc(1)));
  if (pierce) player.addBlessing(pierce);
  player.ammo.forEach((c) => (c.stack = 3));
  dummy(0, -1);
  flags.events.length = 0;
  combat.playerStrike(player, player.hero.combo[0]);
  yield* wait(() => flags.events.some((e) => e.type === 'ammoWall'), 4000);
  const it = combat.rogue.items.find((x) => x.kind === 'kunai');
  out(`  bênção ${ok(!!pierce, pierce && pierce.name)} | bateu na parede ${ok(flags.events.some((e) => e.type === 'ammoWall'))} | corrente mantida ${ok(it && it.stack === 4, it && it.stack)}`);
  fresh('rogue', 'kunai'); yield 0.2;
  player.ammo.forEach((c) => (c.stack = 3));
  flags.events.length = 0;
  combat.playerStrike(player, player.hero.combo[0]);
  yield* wait(() => flags.events.some((e) => e.type === 'ammoWall'), 4000);
  const it2 = combat.rogue.items.find((x) => x.kind === 'kunai');
  out(`  direto na parede: perde a corrente ${ok(it2 && it2.stack === 0, it2 && it2.stack)}`);
}
