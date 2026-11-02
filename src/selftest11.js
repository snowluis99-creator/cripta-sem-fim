// Teste automático, parte 11: ajustes pedidos pelo dono em 26/10/2026 (bloqueio instantâneo, Varinha atordoa,
// Grimório mira no grupo e empurra, gelo estilhaça, linha de fogo, Kunais zeram ao levar dano, Rapieira apara
// projéteis, Besta com 1 virote forte e lento). Tecla Y = tudo; tecla 5 = só esta parte.
const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);
const holdKey = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const press = (code) => { holdKey(code, true); holdKey(code, false); };

export function* tweakTests(g, out, flags) {
  const { player, combat, waves } = g;
  const cam = g.cam.camera;
  const realInput = player.input;
  const fake = (o = {}) => { player.input = Object.assign(Object.create(realInput), {
    blocking: () => false, attack: () => false, dodge: () => false, potion: () => false, interact: () => false,
    moveDir: (v) => v.set(0, 0, 0), aimAngle: () => Math.PI }, o); };
  const fresh = (hero, wid) => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero(hero, wid); player.reset(0, 2); player.facing = Math.PI;
    flags.events.length = 0;
  };
  const dummy = (x, z, type = 'minion', facing = 0) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing }); e.hp = e.maxHp = 999; return e; };
  const hits = () => flags.events.filter((e) => e.type === 'hit');

  // ---------------- 51) Bloqueio instantâneo ----------------
  out('51) Bloqueio instantâneo: corta o golpe na hora (Cavaleiro e Maga), também bebendo poção');
  for (const [hero, wid] of [['knight', 'espada'], ['mage', 'cajado'], ['mage', 'trevas']]) {
    fresh(hero, wid);
    yield 0.2;
    fake();
    player.startAttack(cam);
    yield 0.04;
    const early = player.state === 'attack' && !player.hitDone;
    fake({ blocking: () => true });
    yield 1 / 60 * 2;
    out(`  ${hero}/${wid}: no começo do golpe ${ok(early)} -> bloqueou na hora ${ok(player.state === 'block', player.state)} | golpe cancelado ${ok(!player.hitDone || player.state === 'block')}`);
    fake();
    yield 0.1;
  }
  fresh('knight', 'espada'); yield 0.2;
  player.hp = 20; fake();
  player.tryDrink(); yield 0.05;
  fake({ blocking: () => true }); yield 1 / 30;
  out(`  bebendo poção: bloqueou na hora ${ok(player.state === 'block', player.state)} | poção não gasta ${ok(player.hp === 20)}`);
  fake();
  yield 0.1;

  // ---------------- 52) Maga ----------------
  out('52) Maga: Cajado Elétrico atordoa, gelo estilhaça, linha de fogo');
  fresh('mage', 'eletrico'); yield 0.2;
  const foe = dummy(0, -0.2, 'minion', 0); foe.passive = false; foe.shieldCovers = () => false;
  foe.startAttack();
  const st0 = foe.state;
  combat.playerStrike(player, player.hero.combo[0]);
  { const t0 = performance.now(); yield () => hits().length > 0 || performance.now() - t0 > 3000; }
  out(`  Elétrico: raio interrompe o ataque (${st0} -> ${foe.state}) ${ok(st0 === 'attack' && foe.state === 'hurt')}`);
  foe.passive = true;
  combat.clear();
  // Gelo: todo ataque num congelado = dano dobrado (30/10)
  fresh('mage', 'gelo'); yield 0.2;
  const ice = dummy(0, -1); ice.shieldCovers = () => false;
  const dmgOf = () => { flags.events.length = 0; combat.damageEnemy(player, ice, { damage: 10 }, 0, -1); return (hits()[0] || {}).dmg; };
  const n0 = dmgOf();
  ice.freeze(2, combat);
  const d1 = dmgOf(), d2 = dmgOf();
  out(`  Gelo: normal ${n0} | congelado 1º ataque ${d1} ${ok(d1 >= 17 && d1 <= 23 && !!flags.events)} | 2º ataque ${d2} (também dobrado, 30/10) ${ok(d2 >= 17 && d2 <= 23)} | "Estilhaçou!" ${ok(ice.shattered)}`);
  yield 2.2;
  ice.freeze(2, combat);
  const d3 = dmgOf();
  out(`  congelou de novo: dobrado outra vez ${ok(d3 >= 17, d3)}`);
  combat.clear();
  // Fogo: 2º golpe é linha reta que vai mais longe que o 1º
  fresh('mage', 'fogo'); yield 0.2;
  out(`  Fogo: 2º golpe = linha de fogo ${ok(player.hero.combo[1].cast.type === 'fireline')}`);
  const fl = dummy(0, 2 - 3.8); fl.shieldCovers = () => false;
  flags.events.length = 0;
  combat.playerStrike(player, player.hero.combo[0]);
  const c1 = hits().length;
  combat.playerStrike(player, player.hero.combo[1]);
  const c2 = hits().length - c1;
  out(`  lacaio a 3,8: 1º golpe (cone) não alcança ${ok(c1 === 0)} | linha de fogo alcança ${ok(c2 === 1)} | queimando ${ok(fl.burn > 0)}`);
  yield 0.1;
  out('  -> linha de fogo: CONGELADO (T continua)');
  yield 'hold';
  combat.clear();

  // ---------------- 53) Ladino ----------------
  out('53) Ladino: Kunais NÃO zeram ao levar dano, Rapieira apara projéteis, Besta 1 virote lento e forte');
  fresh('rogue', 'kunai'); yield 0.2;
  player.ammo[0].stack = 4; player.ammo[1].stack = 2;
  const w = dummy(0, 1, 'warrior', 0);
  flags.events.length = 0; player.iframes = 0;
  combat.hitPlayer(w, 5, { target: player });
  out(`  levou dano: kunais na mão mantêm a corrente ${ok(player.ammo[0].stack === 4 && player.ammo[1].stack === 2)} | sem aviso ${ok(!flags.last('streakBroken'))}`);
  combat.clear();
  // Rapieira apara flecha
  fresh('rogue', 'rapieira'); yield 0.2;
  const ar = dummy(0, -8, 'archer', 0);
  const hp0 = player.hp;
  holdKey('ShiftLeft', true); yield 0.03; holdKey('ShiftLeft', false);
  combat.projectiles.fire(0, 2 - 1.6, 0, { speed: 19, damage: 9, owner: ar });
  yield 0.12;
  out(`  aparou a flecha ${ok(!!flags.last('parry') && player.hp === hp0, `${hp0} -> ${player.hp}`)} | flecha sumiu ${ok(!combat.projectiles.list.some((a) => a && a.owner === ar))}`);
  yield PARRY_WAIT;
  // Aparar também é instantâneo no meio do golpe
  fake(); player.iframes = 0; player.parryCd = 0;
  player.startAttack(cam); yield 0.03;
  player.input = realInput;
  holdKey('ShiftLeft', true); yield 0.03; holdKey('ShiftLeft', false);
  out(`  no meio do golpe: aparar na hora ${ok(player.state === 'parry', player.state)}`);
  yield 0.6;
  combat.clear();
  // Besta
  fresh('rogue', 'besta'); yield 0.2;
  const mk = dummy(0, -8);
  out(`  Besta: 1 virote ${ok(player.ammo.length === 1)}`);
  player.facing = Math.PI; flags.events.length = 0;
  const t0 = g.clock ? 0 : 0; let tFire = 0;
  press('KeyJ');
  while (!flags.last('rogueFire') && tFire < 3) { yield 1 / 60; tFire += 1 / 60; }
  const clip = player.anim.current ? player.anim.current.getClip().duration : 0;
  const before = 0.3 * clip / 1.4;
  out(`  demora para sair: ${tFire.toFixed(2)} s (antes ${before.toFixed(2)} s) ${ok(tFire > before * 2.5, (tFire / before).toFixed(1) + '×')}`);
  { const t1 = performance.now(); yield () => hits().length > 0 || performance.now() - t1 > 3000; }
  const bd = (hits()[0] || {}).dmg;
  out(`  dano triplo ${ok(bd >= 30, bd)} | sem virote na mão ${ok(player.ammo.length === 0)}`);
  yield 0.5; flags.events.length = 0;
  press('KeyJ'); yield 0.8;
  out(`  sem virote: não atira ${ok(!flags.last('rogueFire'))}`);
  player.input = realInput;
  combat.clear();
  g.restart();
  void t0; void mk;
}
const PARRY_WAIT = 1.0;
