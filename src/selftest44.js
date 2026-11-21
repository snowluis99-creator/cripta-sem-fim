// Teste automático, parte 44 (12/11/2026): bênção LENDÁRIA Venham, Irmãos (Mangual): cavaleiros pulando na sala.
// l1bless.js / brokit.js / brolook.js. Roda junto com as partes 42 e 43 (teclas * e / do numérico, e no fim do Y).
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { L1 } from './l1bless.js';
import { broLookKey, broArmKey, broWeapons } from './brolook.js';
import { rexTests } from './selftest45.js'; // Velocidade Rasga-Tempo (Lança)

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* broTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const R = L1.bro;
  if (window.__realRandom) Math.random = window.__realRandom; // outro teste pode ter deixado o sorteio fixo
  const kit = combat.bro;
  const ctl = { atk: 0, blk: false, mx: 0, mz: 0, aim: null, dodge: 0 };
  const fake = () => ({ moveDir: (v) => v.set(ctl.mx, 0, ctl.mz), aimAngle: () => ctl.aim, attack: () => (ctl.atk > 0 ? (ctl.atk--, true) : false), attackHeld: () => false, dodge: () => (ctl.dodge > 0 ? (ctl.dodge--, true) : false), dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => ctl.blk });
  const fresh = (hero = 'knight', weapon = 'mangual') => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    for (const k of [...g.run.pickups]) g.run.removePickup(k);
    player.setHero(hero, weapon); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    combat.demo.list = [];
    flags.events.length = 0;
    kit.every = R.every; kit.force = null;
    Object.assign(ctl, { atk: 0, blk: false, mx: 0, mz: 0, aim: null, dodge: 0 });
    player.input = fake();
  };
  const give = (id) => player.addBlessing(BLESSINGS.find((x) => x.id === id));
  const dummy = (x, z, type = 'minion', hp = 5000, passive = true) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing: 0 }); e.hp = e.maxHp = hp; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 6000) { for (let t = 0; t < ms / 1000 && !cond(); t += 0.05) yield 0.05; };
  const foesOnly = () => combat.enemies.filter((e) => !e.undead);
  const killAll = () => { for (const e of foesOnly()) if (e.alive) e.die(); };
  const bros = () => combat.enemies.filter((e) => e.bro && e.alive);
  const errs = () => ok(!window.__game.errors.length, window.__game.errors[0]);

  // ---------- 681) Lista ----------
  out('681) Lendária Venham, Irmãos (Mangual): cavaleiros pulando na sala');
  const b = WEAPON_BLESSINGS.find((x) => x.id === 'w_l1f1');
  out(`  existe ${ok(!!b)} | só do Mangual ${ok(b && b.weapon === 'knight.mangual')} | lendária, máx. 1 ${ok(b && b.rarity === 'legendary' && b.max === 1)} | texto fala de ${R.max} e ${R.hp} ${ok(b && b.desc(1).includes(String(R.max)) && b.desc(1).includes(String(R.hp)))}`);
  const pool = broWeapons();
  const kinds = new Set(pool.map((w) => w.kind));
  out(`  armas sorteáveis: ${pool.length} ${ok(pool.length >= 15)} | de heróis, esqueletos e chefes ${ok(pool.some((w) => w.src === 'knight') && pool.some((w) => w.src === 'minion') && pool.some((w) => w.boss))} | tipos: ${[...kinds].join(', ')} ${ok(kinds.size >= 6)}`);

  // ---------- 682) Corneta ----------
  out('682) Pegou a bênção: o Cavaleiro toca a corneta e os primeiros irmãos respondem');
  fresh(); yield 0.2;
  give('w_l1f1');
  yield* until(() => player.bro && player.bro.phase === 'intro');
  out(`  começou ${ok(ev('broBegin').length === 1)} | cena: nada machuca ${ok(player.invulnerable)} | corneta na mão ${ok(!!player.broHorn)}`);
  yield* until(() => ev('broHorn').length > 0); yield 0.2;
  out('  -> Cavaleiro tocando a corneta (screenshot)'); yield 'hold';
  yield* until(() => ev('broSpawn').length >= 1); yield 0.35;
  out('  -> irmão pulando o muro (screenshot)'); yield 'hold';
  yield* until(() => player.bro && player.bro.phase === 'play', 4000);
  yield* until(() => ev('broLand').length >= R.answer, 4000); yield 0.1;
  out(`  ${R.answer} responderam ${ok(ev('broLand').length === R.answer, String(ev('broLand').length))} | cena acabou ${ok(player.state !== 'cine' && !player.broHorn)} | sem inimigos: não vêm mais ${ok(ev('broSpawn').length === R.answer)}`);
  const first = bros();
  out(`  vida ${R.hp} ${ok(first.every((e) => e.hp === R.hp && e.maxHp === R.hp))} | aliados do Cavaleiro ${ok(first.every((e) => e.undead === player && !e.targetable))} | a sala não espera por eles ${ok(combat.aliveCount === 0)} | sem erros ${errs()}`);
  yield 2.5;
  const nearHero = bros().filter((e) => Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z) < 6).length;
  out(`  seguem o Cavaleiro ${ok(nearHero === first.length, `${nearHero}/${first.length}`)} | não desmoronam sozinhos ${ok(bros().length === R.answer)}`);
  out('  -> irmãos em volta do Cavaleiro (screenshot)'); yield 'hold';

  // ---------- 683) Luta: 1 por segundo, dano da arma ----------
  out('683) Com inimigos: 1 irmão por segundo, cada golpe com o dano da arma');
  const targets = [dummy(-4, -6), dummy(4, -6), dummy(0, -9), dummy(-6, -2), dummy(6, -2)];
  flags.events.length = 0;
  yield 3.05;
  const n3 = ev('broSpawn').length;
  out(`  em 3 s chegaram ${n3} ${ok(n3 >= 3 && n3 <= 4)} | pulam de fora da sala ${ok(ev('broSpawn').every((x) => !x.carried))}`);
  yield 3;
  const hits = ev('undeadHit');
  const allowed = new Set(Object.values(R.dmg));
  const bad = hits.filter((h) => !allowed.has(h.dmg));
  out(`  bateram ${hits.length} vezes ${ok(hits.length > 5)} | dano sempre de uma arma (${[...new Set(hits.map((h) => h.dmg))].sort((a, b) => a - b).join('/')}) ${ok(!bad.length, bad[0] && String(bad[0].dmg))} | os alvos apanharam ${ok(targets.some((t) => t.hp < 5000))}`);
  out('  -> irmãos lutando (screenshot)'); yield 'hold';

  // ---------- 684) Máximo de 30, nunca 2 iguais ----------
  out(`684) No máximo ${R.max} ao mesmo tempo, nenhum igual ao outro`);
  kit.every = 0.05;
  yield* until(() => kit.count(player) >= R.max, 12000);
  yield 1.5;
  const all = bros();
  const looks = new Set(all.map((e) => broLookKey(e.bro))), arms = new Set(all.map((e) => broArmKey(e.bro))), names = new Set(all.map((e) => e.bro.name));
  const mounted = all.filter((e) => e.horse).length, wk = new Set(all.map((e) => e.bro.weapon)).size;
  out(`  ${all.length} irmãos ${ok(kit.count(player) === R.max && all.length <= R.max, String(kit.count(player)))} | nenhum igual (modelo+cor+tamanho) ${ok(looks.size === all.length)} | mesma arma só com cor ou tamanho diferente ${ok(arms.size === all.length)} | nomes diferentes ${ok(names.size === all.length)}`);
  out(`  ${wk} armas diferentes ${ok(wk >= 8)} | ${mounted} a cavalo ${ok(mounted >= 1)} | ${all.filter((e) => e.headgear).length} com enfeite na cabeça | ${all.filter((e) => e.data.shield).length} com escudo | ${all.filter((e) => e.data.ranged).length} de longe ${ok(all.some((e) => e.data.ranged))} | sem erros ${errs()}`);
  out('  -> 30 irmãos (screenshot)'); yield 'hold';

  // ---------- 685) Inimigos batem nos irmãos ----------
  out('685) Os inimigos (até chefes) atacam os irmãos; quem cai é trocado por outro');
  killAll(); yield 0.6;
  const vic = bros()[0];
  for (const o of bros()) o.hp = 5; // qualquer golpe derruba
  const foe = dummy(vic.position.x + 1.2, vic.position.z, 'warrior', 5000, false);
  foe.provokedBy = vic;
  const boss = dummy(vic.position.x - 6, vic.position.z, 'guardian', 20000, false);
  flags.events.length = 0;
  yield* until(() => ev('broDied').length >= 1, 8000);
  const fell = combat.enemies.find((e) => e.bro && !e.alive) || vic;
  out(`  os inimigos derrubaram um irmão ${ok(ev('broDied').length >= 1)} | caiu sem virar ossos ${ok(!fell.alive && fell.broDead)}`);
  yield 2;
  out(`  outro pulou no lugar ${ok(kit.count(player) === R.max, String(kit.count(player)))} | ${ev('undeadHurt').length} golpes nos irmãos ${ok(ev('undeadHurt').length >= 1)}`);
  const bt = boss.target;
  yield* until(() => boss.target && boss.target.bro, 6000);
  out(`  o chefe vai atrás de um irmão que bateu nele ${ok(boss.target && boss.target.bro, bt ? 'tinha alvo' : '')} | sem erros ${errs()}`);

  // ---------- 686) Fim da luta ----------
  out('686) Inimigos acabaram: param de vir, comemoram e seguem o Cavaleiro');
  killAll(); yield 0.5;
  const c0 = kit.count(player);
  flags.events.length = 0;
  kit.roomClear(); yield 2;
  out(`  não vêm mais ${ok(ev('broSpawn').length === 0)} | comemoraram ${ok(bros().every((e) => e.state === 'broFollow'))}`);
  player.position.set(-6, 0, 4); yield 4;
  const close = bros().filter((e) => Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z) < 9).length;
  out(`  foram atrás do Cavaleiro ${ok(close >= bros().length * 0.8, `${close}/${bros().length}`)} | ninguém sumiu ${ok(kit.count(player) === c0)}`);
  out('  -> exército seguindo o Cavaleiro (screenshot)'); yield 'hold';

  // ---------- 687) Próxima sala ----------
  out('687) Os vivos vão junto para a sala seguinte (mesmos irmãos, mesma vida)');
  bros()[0].hp = 37;
  const before = new Map(bros().map((e) => [e.bro.name, e.hp]));
  const carry = kit.carryOut();
  combat.clear(); player.placeAt(0, 3);
  kit.carryIn(carry);
  flags.events.length = 0;
  yield* until(() => bros().length >= before.size, 8000); yield 0.3;
  const after = bros();
  out(`  vieram ${after.length} de ${before.size} ${ok(after.length === before.size)} | os mesmos ${ok(after.every((e) => before.has(e.bro.name)))} | vida igual ${ok(after.every((e) => e.hp === before.get(e.bro.name)))} | entram com o Cavaleiro ${ok(ev('broSpawn').every((x) => x.carried))}`);
  dummy(0, -8); flags.events.length = 0; kit.every = R.every; yield 1.5;
  out(`  horda nova: corneta de novo ${ok(ev('broHorn').length === 1)} | cheio: ninguém a mais ${ok(kit.count(player) === R.max)}`);
  killAll(); yield 0.3;

  // ---------- 688) Partida nova ----------
  out('688) Partida nova: sem irmãos; outra arma não chama');
  fresh(); yield 0.3;
  out(`  recomeçou limpo ${ok(!player.bro && !bros().length && !player.blessings.w_l1f1)}`);
  out(`  Espada: a bênção não aparece ${ok(!WEAPON_BLESSINGS.some((x) => x.id === 'w_l1f1' && x.weapon !== 'knight.mangual'))}`);
  out(`  sem erros do jogo ${errs()}`);
  player.input = realInput; player.iframes = 0;
  yield* rexTests(g, out, flags); // 689–698: Velocidade Rasga-Tempo (Lança)
}
