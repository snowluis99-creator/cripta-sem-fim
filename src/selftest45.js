// Teste automático, parte 45 (12/11/2026): bênção LENDÁRIA Velocidade Rasga-Tempo (Lança): o T-Rex do portal.
// l1bless.js / rexkit.js / rex.js / rexfx.js. Tecla + do numérico (só esta parte); roda também no fim da parte 44
// (teclas * / . do numérico e no fim do Y).
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { L1 } from './l1bless.js';
import { giantTests } from './selftest46.js'; // Gigante de Aço (Manopla)

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* rexTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const X = L1.rex;
  if (window.__realRandom) Math.random = window.__realRandom;
  const kit = combat.rex;
  const ctl = { atk: 0, mx: 0, mz: 0, aim: null, dodge: 0 };
  const fake = () => ({ moveDir: (v) => v.set(ctl.mx, 0, ctl.mz), aimAngle: () => ctl.aim, attack: () => (ctl.atk > 0 ? (ctl.atk--, true) : false), attackHeld: () => false, dodge: () => (ctl.dodge > 0 ? (ctl.dodge--, true) : false), dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false });
  const fresh = (hero = 'knight', weapon = 'lanca') => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    for (const k of [...g.run.pickups]) g.run.removePickup(k);
    player.setHero(hero, weapon); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    combat.demo.list = [];
    flags.events.length = 0;
    Object.assign(ctl, { atk: 0, mx: 0, mz: 0, aim: null, dodge: 0 });
    player.input = fake();
  };
  const give = (id) => player.addBlessing(BLESSINGS.find((x) => x.id === id));
  const dummy = (x, z, type = 'minion', hp = 5000, passive = true) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing: 0 }); e.hp = e.maxHp = hp; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 6000) { for (let t = 0; t < ms / 1000 && !cond(); t += 0.05) yield 0.05; };
  const foes = () => combat.enemies.filter((e) => !e.undead && e.alive);
  const killAll = () => { for (const e of foes()) e.die(); };
  const errs = () => ok(!window.__game.errors.length, window.__game.errors[0]);
  const ph = () => (player.rex ? player.rex.phase : '-');
  const dist = (e) => Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z);

  // ---------- 689) Lista ----------
  out('689) Lendária Velocidade Rasga-Tempo (Lança): o T-Rex do portal');
  const b = WEAPON_BLESSINGS.find((x) => x.id === 'w_l1l1');
  out(`  existe ${ok(!!b)} | só da Lança ${ok(b && b.weapon === 'knight.lanca')} | lendária, máx. 1 ${ok(b && b.rarity === 'legendary' && b.max === 1)} | texto fala de ${X.hp} e ${X.morphAt} ${ok(b && b.desc(1).includes(String(X.hp)) && b.desc(1).includes(String(X.morphAt)))}`);

  // ---------- 690) A cena ----------
  out('690) Pegou a bênção: gira a lança, a tela trinca, abre o portal, sai o T-Rex, lambe e o Cavaleiro monta');
  fresh(); yield 0.2;
  give('w_l1l1');
  yield* until(() => ph() === 'spin', 2000);
  out(`  começou ${ok(ev('rexCall').length === 1)} | girando: nada machuca ${ok(player.invulnerable)} | não rola ${ok(!player.canDodgeNow())}`);
  yield 0.8;
  out('  -> Cavaleiro girando a lança (screenshot)'); yield 'hold';
  yield* until(() => ev('rexCrack').length > 0, 3000); yield 0.25;
  out(`  tela trincou e o portal abriu ${ok(!!player.rex.portal)}`);
  out('  -> tela trincada e portal abrindo (screenshot)'); yield 'hold';
  yield* until(() => ph() === 'emerge', 3000); yield 0.8;
  out(`  o T-Rex está saindo do portal ${ok(!!player.rex.v && player.rex.v.g.parent)}`);
  out('  -> T-Rex saindo do portal (screenshot)'); yield 'hold';
  yield* until(() => ph() === 'roar', 3000); yield 0.25;
  out('  -> rugido (screenshot)'); yield 'hold';
  yield* until(() => ph() === 'lick', 3000); yield 0.45;
  out('  -> lambida (screenshot)'); yield 'hold';
  yield* until(() => ph() === 'play', 4000); yield 0.3;
  const m = player.rex;
  out(`  montou ${ok(ph() === 'play' && m.attached)} | Cavaleiro na sela ${ok(player.model.parent === m.v.seat)} | vida ${X.hp} ${ok(m.hp === X.hp)} | portal fechou ${ok(!m.portal)} | sem erros ${errs()}`);
  yield 1.2;
  out('  -> montado no T-Rex (screenshot)'); yield 'hold';

  // ---------- 691) Sem inimigos: o jogador guia ----------
  out('691) Sem inimigos: o jogador anda com o T-Rex; não rola');
  const p0 = player.position.clone();
  ctl.mx = 1; yield 0.8; ctl.mx = 0;
  const moved = player.position.distanceTo(p0);
  ctl.dodge = 1; yield 0.3;
  const dodgeLeft = ctl.dodge; ctl.dodge = 0;
  out(`  andou ${moved.toFixed(1)} ${ok(moved > 4)} | rolar não faz nada ${ok(player.state === 'rex' && ph() === 'play')} | herói ocupa o tamanho do T-Rex ${ok(player.hero.radius === X.radius)}`);

  // ---------- 692) Com inimigos: anda e ataca sozinho ----------
  out('692) Com inimigos: o T-Rex vai sozinho, morde e estraçalha');
  player.position.set(0, 0, 4);
  const t1 = dummy(0, -6, 'warrior', 5000);
  flags.events.length = 0;
  yield* until(() => ev('rexHit').length >= 1, 5000);
  const bites = ev('rexHit').filter((x) => x.kind === 'bite');
  out(`  foi até o inimigo e mordeu ${ok(bites.length >= 1)} | dano ${X.bite.dmg} ${ok(bites.every((x) => x.dmg === X.bite.dmg), bites[0] && String(bites[0].dmg))} | nenhuma bênção na mordida ${ok(!ev('hit').length)}`);
  yield 0.1;
  out('  -> mordida (screenshot)'); yield 'hold';
  yield* until(() => ev('rexAct').some((x) => x.kind === 'shred'), 6000); yield 0.45;
  out(`  a cada ${X.shred.every} mordidas estraçalha ${ok(ev('rexAct').some((x) => x.kind === 'shred'))} | inimigo na boca ${ok(!!(player.rex.act && player.rex.act.held))}`);
  out('  -> estraçalhando (screenshot)'); yield 'hold';
  yield* until(() => ev('rexHit').filter((x) => x.kind === 'shred').length >= 3, 3000);
  const sh = ev('rexHit').filter((x) => x.kind === 'shred').reduce((a, x) => a + x.dmg, 0);
  out(`  estraçalhar = ${sh} ${ok(sh === X.shred.dmg)} | soltou no chão ${ok(t1.position.y === 0)} | sem erros ${errs()}`);
  killAll(); yield 0.4;

  // ---------- 693) O Cavaleiro ataca de cima para qualquer lado ----------
  out('693) O Cavaleiro ataca lá de cima para onde mirar, com as bênçãos dele');
  player.position.set(0, 0, 0); player.facing = 0; player.group.rotation.y = 0;
  const behind = dummy(0, -5.5, 'minion', 5000); // atrás do T-Rex
  combat.rex.godRex = true;
  flags.events.length = 0;
  ctl.aim = Math.PI; ctl.atk = 1;
  yield 0.22;
  const yawOk = Math.abs(Math.atan2(Math.sin(player.facing + player.rex.kyaw - Math.PI), Math.cos(player.facing + player.rex.kyaw - Math.PI))) < 0.5;
  yield 0.4;
  const kh = ev('hit').filter((x) => x.enemy === behind);
  out(`  acertou o inimigo de trás ${ok(kh.length >= 1)} | golpe passou pelas bênçãos (dano ${kh[0] && kh[0].dmg}) ${ok(kh.length && kh[0].dmg >= 10)} | Cavaleiro virou para trás ${ok(yawOk)}`);
  out('  -> Cavaleiro atacando para trás (screenshot)'); yield 'hold';
  flags.events.length = 0;
  for (let i = 0; i < 40 && ev('rexKnightAtk').length < 3; i++) { ctl.atk = 1; yield 0.1; }
  yield 0.6;
  out(`  combo de ${ev('rexKnightAtk').length} golpes ${ok(ev('rexKnightAtk').length >= 3)} | sem erros ${errs()}`);
  combat.rex.godRex = false;
  killAll(); yield 0.3;

  // ---------- 694) Dano vai para o T-Rex ----------
  out('694) Golpes dos inimigos vão para o T-Rex (o Cavaleiro não perde vida)');
  const hp0 = player.hp, foe = dummy(3, 0, 'warrior', 5000);
  combat.hitPlayer(foe, 30, {});
  out(`  T-Rex ${player.rex.hp} ${ok(player.rex.hp === X.hp - 30)} | Cavaleiro igual ${ok(player.hp === hp0)} | esbarrão não machuca ${ok(combat.hitPlayer(foe, 10, { contact: true }) === false && player.rex.hp === X.hp - 30)}`);
  killAll(); yield 0.3;

  // ---------- 695) Dragão das Trevas ----------
  out(`695) Com ${X.morphAt} de vida: fica preto, cria asas, levita e cospe fogo`);
  const f2 = dummy(2, 0, 'warrior', 5000);
  combat.hitPlayer(f2, 400, {});
  out(`  a transformação sempre acontece ${ok(player.rex.hp === X.morphAt && ph() === 'morph')} | nada machuca na cena ${ok(player.invulnerable)}`);
  yield X.morph * 0.6;
  out('  -> virando dragão (screenshot)'); yield 'hold';
  yield* until(() => ph() === 'play', 3000); yield 0.6;
  const v = player.rex.v;
  out(`  dragão ${ok(player.rex.dark && v.dark === 1 && v.wingK === 1)} | levitando ${ok(v.lift.position.y > 1)} | sem erros ${errs()}`);
  killAll(); yield 0.2;
  const t3 = dummy(0, -11, 'warrior', 5000);
  flags.events.length = 0;
  combat.rex.dropShots();
  yield* until(() => ev('rexHit').some((x) => x.kind === 'fire' && x.enemy === t3), 6000);
  if (!ev('rexBoom').length) out(`  (debug: alvo targetable ${t3.targetable} estado ${t3.state} | ato ${player.rex.act && player.rex.act.kind} | cd ${player.rex.spitCd.toFixed(2)} | fase ${ph()} | dist ${dist(t3).toFixed(1)} | facing ${player.facing.toFixed(2)})`);
  const fh = ev('rexHit').filter((x) => x.kind === 'fire');
  out(`  cuspiu fogo ${ok(ev('rexSpit').length >= 1)} | explodiu no alvo ${ok(fh.some((x) => x.enemy === t3))} | dano ${X.spit.dmg} ${ok(fh.every((x) => x.dmg === X.spit.dmg))} | pegou fogo ${ok(t3.burn > 0)} | mantém distância ${ok(dist(t3) > 4, dist(t3).toFixed(1))}`);
  yield* until(() => ev('rexSpit').length >= 2, 3000); yield 0.25;
  out('  -> dragão cuspindo fogo (screenshot)'); yield 'hold';
  killAll(); yield 0.3;

  // ---------- 696) Sala nova ----------
  out('696) Sala nova: o dragão vai junto, com a mesma vida');
  const hpBefore = player.rex.hp;
  combat.clear(); player.placeAt(0, 3); yield 0.5;
  out(`  continua montado ${ok(ph() === 'play' && player.rex.attached && player.model.parent === player.rex.v.seat)} | mesma vida ${ok(player.rex.hp === hpBefore)} | ainda dragão ${ok(player.rex.dark)}`);

  // ---------- 697) Explosão final ----------
  out('697) A vida acabou: o dragão explode em fogo e o Cavaleiro cai de pé');
  const near = dummy(player.position.x + 3, player.position.z, 'warrior', 5000);
  flags.events.length = 0;
  combat.hitPlayer(near, 999, {});
  out(`  vai explodir ${ok(ph() === 'dying')} | nada machuca ${ok(player.invulnerable)}`);
  yield* until(() => ev('rexExplode').length > 0, 3000); yield 0.12;
  const bh = ev('rexHit').filter((x) => x.kind === 'boom');
  out(`  explodiu ${ok(ev('rexExplode').length === 1)} | ${X.boom.dmg} em quem estava perto ${ok(bh.some((x) => x.enemy === near && x.dmg === X.boom.dmg))} | pegou fogo ${ok(near.burn > 0)}`);
  out('  -> explosão do dragão (screenshot)'); yield 'hold';
  yield* until(() => !player.rex, 3000); yield 0.2;
  out(`  Cavaleiro de pé ${ok(!player.rex && (player.state === 'idle' || player.state === 'run') && player.position.y === 0, `${player.state} y=${player.position.y.toFixed(2)}`)} | sem dano por 2 s ${ok(player.iframes > 1)} | não volta nesta partida ${ok(player.rexUsed && !kit.canSummon(player))} | tamanho normal ${ok(player.hero.radius < 1)}`);
  killAll(); yield 0.3;

  // ---------- 698) Partida nova ----------
  out('698) Partida nova: libera de novo; outra arma não tem a bênção');
  fresh(); yield 0.3;
  out(`  recomeçou limpo ${ok(!player.rex && !player.rexUsed && !player.blessings.w_l1l1)}`);
  out(`  outras armas: não aparece ${ok(!WEAPON_BLESSINGS.some((x) => x.id === 'w_l1l1' && x.weapon !== 'knight.lanca'))}`);
  out(`  sem erros do jogo ${errs()}`);
  player.input = realInput; player.iframes = 0;
  yield* giantTests(g, out, flags); // 699–708: Gigante de Aço (Manopla)
}
