// Teste automático, parte 46 (12/11/2026): bênção LENDÁRIA Gigante de Aço (Manopla): o robô boxeador.
// l1bless.js / giantkit.js / giant.js / giantfx.js. Tecla 1 do numérico (corrido) / 2 do numérico (com pausas de
// screenshot); roda também no fim da parte 45 (teclas * / . + - do numérico e no fim do Y).
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { L1 } from './l1bless.js';
import { grimTests } from './selftest47.js'; // Grimório Ancestral (Cajado Arcano)

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* giantTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const G = L1.giant;
  if (window.__realRandom) Math.random = window.__realRandom;
  const kit = combat.giant;
  const ctl = { atk: 0, mx: 0, mz: 0, aim: null, dodge: 0, blk: false };
  const fake = () => ({ moveDir: (v) => v.set(ctl.mx, 0, ctl.mz), aimAngle: () => ctl.aim, attack: () => (ctl.atk > 0 ? (ctl.atk--, true) : false), attackHeld: () => false, dodge: () => (ctl.dodge > 0 ? (ctl.dodge--, true) : false), dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => ctl.blk });
  const fresh = (hero = 'knight', weapon = 'manopla') => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    for (const k of [...g.run.pickups]) g.run.removePickup(k);
    player.setHero(hero, weapon); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    combat.demo.list = [];
    flags.events.length = 0;
    Object.assign(ctl, { atk: 0, mx: 0, mz: 0, aim: null, dodge: 0, blk: false });
    player.input = fake();
  };
  const give = (id) => player.addBlessing(BLESSINGS.find((x) => x.id === id));
  const dummy = (x, z, type = 'minion', hp = 5000, passive = true) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing: 0 }); e.hp = e.maxHp = hp; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 6000) { for (let t = 0; t < ms / 1000 && !cond(); t += 0.05) yield 0.05; };
  const foes = () => combat.enemies.filter((e) => !e.undead && e.alive);
  const errs = () => ok(!window.__game.errors.length, window.__game.errors[0]);
  const M = () => player.giant;
  const ph = () => (M() ? M().phase : '-');
  // Põe o robô num lugar e olhando para um lado (sem alvo guardado).
  const put = (x, z, facing) => { const m = M(); m.pos.set(x, 0, z); m.facing = facing; m.target = null; m.act = null; m.weave = null; kit.place(m); };
  const B = () => combat.world.bounds;

  // ---------- 699) Lista ----------
  out('699) Lendária Gigante de Aço (Manopla): o robô boxeador');
  const b = WEAPON_BLESSINGS.find((x) => x.id === 'w_l1g1');
  out(`  existe ${ok(!!b)} | só da Manopla ${ok(b && b.weapon === 'knight.manopla')} | lendária, máx. 1 ${ok(b && b.rarity === 'legendary' && b.max === 1)} | texto fala de ${G.hp}, ${G.dmg} e ${G.ko} s ${ok(b && b.desc(1).includes(String(G.hp)) && b.desc(1).includes(String(G.dmg)) && b.desc(1).includes(`${G.ko} s`))}`);

  // ---------- 700) A chegada ----------
  out('700) Pegou a bênção: sino, ringue de luz, o robô cai do céu e bate o punho com o Cavaleiro');
  fresh(); yield 0.2;
  give('w_l1g1');
  yield* until(() => ph() === 'ring', 2000);
  out(`  começou ${ok(ev('giantCall').length === 1)} | ringue ${ok(!!M().ring)} | Cavaleiro em cena (nada machuca) ${ok(player.invulnerable && player.state === 'cine')}`);
  yield 0.6;
  out('  -> ringue de luz (screenshot)'); yield 'hold';
  yield* until(() => ev('giantLand').length > 0, 3000);
  out(`  caiu do céu ${ok(!!M().v && M().v.g.parent)}`);
  yield* until(() => ph() === 'bump', 3000); yield 0.7;
  out('  -> soquinho de punho (screenshot)'); yield 'hold';
  yield* until(() => ph() === 'play', 3000); yield 0.1;
  out(`  bateu o punho ${ok(ev('giantBump').length === 1)} | pronto ${ok(ph() === 'play' && M().hp === G.hp)} | Cavaleiro livre ${ok(player.state !== 'cine')} | barra ${ok(!!document.querySelector('#giantbar.show'))}`);

  // ---------- 701) Copia os golpes ----------
  out(`701) Copia os golpes do Cavaleiro: ${G.dmg} por soco, sem bênçãos`);
  put(player.position.x, player.position.z - 5, Math.PI);
  const d1 = dummy(player.position.x, player.position.z - 7.4, 'minion');
  player.stats.damageMul += 2; // bênçãos de dano: não valem no robô
  flags.events.length = 0;
  ctl.aim = Math.PI; ctl.atk = 1; yield 0.05;
  out(`  o Cavaleiro golpeou e o robô copiou na hora ${ok(ev('giantPunch').length === 1 && ev('giantPunch')[0].which === 0)}`);
  yield* until(() => ev('giantHit').length > 0, 2000);
  const h1 = ev('giantHit')[0];
  out(`  acertou ${ok(h1 && h1.enemy === d1)} | ${G.dmg} fixo (com +200% de dano no Cavaleiro) ${ok(h1 && h1.dmg === G.dmg, h1 && h1.dmg)}`);
  player.stats.damageMul -= 2;
  yield 1.0; flags.events.length = 0; // combo novo, apertando sem parar
  for (let i = 0; i < 40 && ev('giantPunch').length < 4; i++) { ctl.atk = 1; yield 0.1; }
  const ws = ev('giantPunch').map((x) => x.which).join(',');
  out(`  combo inteiro copiado: jab, direto, gancho, cruzado ${ok(ws === '0,1,2,3', ws)}`);
  yield 0.8;
  combat.clear(); yield 0.2;

  // ---------- 702) Prioridade ----------
  out('702) Escolhe o alvo: magos > arqueiros > guardas > esqueletinhos');
  put(0, 0, 0);
  const pm = dummy(-6, -6, 'minion'), pw = dummy(5, -5, 'warrior'), pa = dummy(-7, 5, 'archer'), pmg = dummy(8, 6, 'mage');
  yield 0.6;
  const order = [];
  for (const e of [pmg, pa, pw, pm]) { order.push(M().target === e); e.die(); M().retarget = 0; yield 0.3; }
  out(`  mago ${ok(order[0])} | arqueiro ${ok(order[1])} | guarda ${ok(order[2])} | esqueletinho ${ok(order[3])}`);
  yield* until(() => !foes().length, 2000); yield 0.3;

  // ---------- 703) Cruzado boliche ----------
  out('703) O último soco do combo é o cruzado: o inimigo voa e derruba os outros (boliche)');
  combat.clear(); yield 0.1;
  player.placeAt(0, B().z - 2.5);
  put(-B().x + 2.5, 0, Math.PI / 2);
  const ball = dummy(-B().x + 2.5 + 3.3, 0), pins = [dummy(-B().x + 2.5 + 6, 0.3), dummy(-B().x + 2.5 + 8, -0.7)];
  flags.events.length = 0;
  M().pending = 3; yield 0.05;
  yield* until(() => ev('giantBowl').length > 0, 2000);
  out(`  voou ${ok(ev('giantBowl').length === 1 && ev('giantBowl')[0].enemy === ball)}`);
  yield 0.12;
  out('  -> inimigo voando como bola de boliche (screenshot)'); yield 'hold';
  yield* until(() => ev('giantBowlEnd').length > 0, 3000);
  const pinHits = ev('giantHit').filter((x) => x.kind === 'pin').map((x) => x.enemy);
  out(`  derrubou os outros ${ok(pins.every((e) => pinHits.includes(e)), pinHits.length)} | a bola apanhou ${G.dmg} no fim ${ok(ev('giantHit').some((x) => x.kind === 'bowl' && x.enemy === ball && x.dmg === G.dmg))} | caiu no chão ${ok(ball.state !== 'lanceFly' && ball.position.y === 0)}`);
  combat.clear(); yield 0.3;

  // ---------- 704) Guarda e esquiva ----------
  out('704) Defender = guarda fechada (não leva dano); rolar = esquiva');
  ctl.blk = true; yield 0.3;
  const hp0 = M().hp;
  out(`  levantou a guarda junto ${ok(M().block, player.state)}`);
  kit.hurt(player, 40, M().pos.x + 2, M().pos.z);
  out(`  defendeu ${ok(M().hp === hp0 && ev('giantBlock').length === 1)}`);
  out('  -> guarda fechada (screenshot)'); yield 'hold';
  ctl.blk = false; yield 0.4;
  ctl.mx = 1; ctl.dodge = 1; yield 0.1; ctl.mx = 0;
  out(`  esquivou junto ${ok(!!M().weave && ev('giantWeave').length === 1)}`);
  kit.hurt(player, 40, M().pos.x + 2, M().pos.z);
  out(`  esquivando não leva dano ${ok(M().hp === hp0)}`);
  yield 0.6;
  kit.hurt(player, 25, M().pos.x + 2, M().pos.z);
  out(`  parado leva dano ${ok(M().hp === hp0 - 25, M().hp)}`);

  // ---------- 705) Os inimigos batem no robô ----------
  out('705) Os inimigos também podem atacar o robô (golpe e flecha)');
  M().hp = M().max; flags.events.length = 0;
  player.placeAt(B().x - 2, B().z - 2);
  put(-B().x + 3, -B().z + 3, 0);
  const brute = dummy(-B().x + 3, -B().z + 5.2, 'warrior', 5000, false);
  yield* until(() => ev('giantHurt').length > 0, 8000);
  out(`  o guerreiro escolheu o robô ${ok(brute.target && brute.target.giantBot)} | bateu nele ${ok(ev('giantHurt').length > 0)} | o Cavaleiro longe não apanhou ${ok(player.hp === player.maxHp)}`);
  brute.die(); yield 0.3;
  const ar = dummy(-B().x + 3, -B().z + 12, 'archer', 5000, false);
  flags.events.length = 0;
  yield* until(() => ev('giantHurt').length > 0, 10000);
  out(`  a flecha do arqueiro pegou no robô ${ok(ev('giantHurt').length > 0)}`);
  ar.die(); yield 0.3;

  // ---------- 706) Nocaute ----------
  out(`706) Vida zerou: nocaute de ${G.ko} s, levanta aos poucos e volta com a vida cheia`);
  combat.clear(); M().weave = null; yield 0.1;
  flags.events.length = 0;
  kit.hurt(player, 9999, M().pos.x + 2, M().pos.z);
  out(`  nocauteado ${ok(ph() === 'ko' && ev('giantKO').length === 1)} | inimigos não miram mais nele ${ok(kit.bots().length === 0)}`);
  ctl.atk = 1; yield 0.2;
  out(`  caído não copia os golpes ${ok(ev('giantPunch').length === 0)}`);
  yield 2;
  out('  -> robô nocauteado (screenshot)'); yield 'hold';
  M().ko.t = (G.rise[0] + G.rise[1]) / 2; yield 0.2;
  out('  -> robô levantando (screenshot)'); yield 'hold';
  M().ko.t = G.ko - 0.3;
  yield* until(() => ph() === 'play', 2000);
  out(`  de pé ${ok(ph() === 'play' && ev('giantUp').length === 1)} | vida cheia ${ok(M().hp === G.hp)} | volta a ser alvo ${ok(kit.bots().length === 1)}`);

  // ---------- 707) Sala nova ----------
  out('707) Sala nova: o robô vai junto (cai do céu atrás do Cavaleiro)');
  M().hp = 150; M().bounds = null; flags.events.length = 0;
  yield* until(() => ev('giantLand').length > 0, 3000);
  const dd = Math.hypot(M().pos.x - player.position.x, M().pos.z - player.position.z);
  out(`  caiu na sala ${ok(ev('giantLand').length === 1)} | perto do Cavaleiro ${ok(dd < 6, dd.toFixed(1))} | mesma vida ${ok(M().hp === 150)}`);

  // ---------- 708) Partida nova ----------
  out('708) Partida nova: sem robô; outras armas não têm a bênção');
  fresh(); yield 0.3;
  out(`  recomeçou limpo ${ok(!M() && !player.giantUsed && !player.blessings.w_l1g1 && !document.querySelector('#giantbar.show'))}`);
  out(`  outras armas: não aparece ${ok(!WEAPON_BLESSINGS.some((x) => x.id === 'w_l1g1' && x.weapon !== 'knight.manopla'))}`);
  out(`  sem erros do jogo ${errs()}`);
  player.input = realInput; player.iframes = 0;
  yield* grimTests(g, out, flags); // 709–716: Grimório Ancestral (Cajado Arcano)
}
