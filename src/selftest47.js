// Teste automático, parte 47 (12/11/2026): bênção LENDÁRIA Grimório Ancestral (Cajado Arcano), lotes 1 e 2 das magias
// (717 = lote 2, 13/11/2026: grimspells2.js / grimspells3.js; 718 = lote 3, 14/11/2026: grimspells4.js / grimspells5.js;
// 719 = lote 4, 22/11/2026: grimspells6.js / grimspells7.js; 720 = lote 5, 22/11/2026: grimspells8.js / grimspells9.js).
// l1bless.js / grimkit.js / grimlook.js / grimspells.js. Tecla 3 do numérico (corrido) / 4 do numérico (com pausas de
// screenshot); roda também no fim da parte 46 (teclas * / . + - 1 2 do numérico e no fim do Y).
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { L1 } from './l1bless.js';
import { grimOn, SPELLS } from './grimkit.js';
import { grimGolems } from './grimspells7.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* grimTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const G = L1.grim;
  if (window.__realRandom) Math.random = window.__realRandom;
  const ctl = { atk: 0, mx: 0, mz: 0, aim: null, dodge: 0, blk: false };
  const fake = () => ({ moveDir: (v) => v.set(ctl.mx, 0, ctl.mz), aimAngle: () => ctl.aim, attack: () => (ctl.atk > 0 ? (ctl.atk--, true) : false), attackHeld: () => false, dodge: () => (ctl.dodge > 0 ? (ctl.dodge--, true) : false), dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => ctl.blk });
  const fresh = (hero = 'mage', weapon = 'cajado') => {
    player.input = realInput;
    window.__grimForce = null;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    for (const k of [...g.run.pickups]) g.run.removePickup(k);
    player.setHero(hero, weapon); player.reset(0, 4); player.facing = Math.PI; player.group.rotation.y = Math.PI;
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
  const killAll = () => { for (const e of combat.enemies) if (e.alive) { e.noGrave = true; e.die(); } };
  const errs = () => ok(!window.__game.errors.length, window.__game.errors[0]);
  const lost = (e, hp0 = 5000) => hp0 - Math.max(0, e.hp);

  // ---------- 709) Lista ----------
  out('709) Lendária Grimório Ancestral (Cajado Arcano)');
  const b = WEAPON_BLESSINGS.find((x) => x.id === 'w_l1c1');
  out(`  existe ${ok(!!b)} | só do Cajado Arcano ${ok(b && b.weapon === 'mage.cajado')} | lendária, máx. 1 ${ok(b && b.rarity === 'legendary' && b.max === 1)} | magias no livro: ${SPELLS.length} ${ok(SPELLS.length === 50)} | sem nome repetido ${ok(new Set(SPELLS.map((x) => x.id)).size === SPELLS.length)}`);

  // ---------- 710) Transformação ----------
  out('710) Pegou: o livro desce, abre, as páginas voam, o cajado se desfaz');
  fresh(); yield 0.2;
  const near = dummy(0.5, 1.5, 'minion', 999);
  give('w_l1c1');
  yield* until(() => player.grim && player.grim.phase === 'intro');
  out(`  começou ${ok(ev('grimBegin').length === 1)} | cena: nada machuca ${ok(player.invulnerable)}`);
  yield 0.8; out('  -> livro descendo (screenshot)'); yield 'hold';
  yield* until(() => player.grim && player.grim.step >= 1); yield 0.3;
  out('  -> livro aberto, páginas voando (screenshot)'); yield 'hold';
  yield* until(() => grimOn(player), 6000); yield 0.1;
  const L = player.grimLook;
  out(`  pronto ${ok(grimOn(player) && player.state !== 'cine')} | cajado sumiu ${ok(player.weapon && !player.weapon.visible)} | livro nas costas ${ok(L && L.book && L.book.g.parent === player.group)} | mãos acesas ${ok(L && L.hands.length === 2)} | escudo ${ok(L && L.shield && L.shield.g.visible)} | a onda não machucou ${ok(near.hp === 999)} | ${errs()}`);
  out('  -> Maga com o Grimório (screenshot)'); yield 'hold';
  killAll(); yield 0.3;

  // ---------- 711) Cada magia ----------
  out('711) As 10 magias do lote 1');
  const spellTest = function* (id, setup, check, wait = 2.2) {
    killAll(); yield 0.3;
    for (const e of [...combat.enemies]) if (!e.alive) e.group.visible = false;
    player.position.set(0, 0, 4); player.facing = Math.PI; player.group.rotation.y = Math.PI; ctl.aim = Math.PI;
    player.hp = player.maxHp;
    const ctx = setup();
    flags.events.length = 0;
    window.__grimForce = () => id;
    ctl.atk = 1;
    yield* until(() => ev('grimCast').length > 0, 3000);
    window.__grimForce = null;
    const sp = SPELLS.find((s) => s.id === id);
    yield 0.45; out(`  -> ${sp.name} (screenshot)`); yield 'hold';
    yield wait;
    out(`  ${sp.name}: saiu ${ok(ev('grimCast').some((x) => x.id === id))} | ${check(ctx)}`);
  };
  yield* spellTest('meteoro', () => ({ a: dummy(0, -3), b: dummy(1.5, -3.5), far: dummy(8, 4) }),
    (c) => `explodiu ${ok(lost(c.a) >= G.meteor.dmg, String(lost(c.a)))} | pegou o do lado ${ok(lost(c.b) >= G.meteor.dmg)} | longe não ${ok(c.far.hp === 5000)}`);
  yield* spellTest('inferno', () => ({ a: dummy(-6, -5), b: dummy(6, 2) }),
    (c) => `sala toda queimando ${ok(lost(c.a) > G.inferno.dmg + G.inferno.tickDmg * 3 && lost(c.b) > G.inferno.dmg, `${lost(c.a)}, ${lost(c.b)}`)}`, G.inferno.dur);
  yield* spellTest('gelo', () => ({ a: dummy(-5, -3), b: dummy(5, 0) }),
    (c) => `congelou todos ${ok(c.a.frozenT > 0 && c.b.frozenT > 0)} | dano ${ok(lost(c.a) >= G.ice.dmg)}`, 1.0);
  yield* spellTest('julgamento', () => ({ list: [dummy(-6, -4), dummy(0, -6), dummy(6, -2), dummy(4, 3)] }),
    (c) => `raio em cada um ${ok(c.list.every((e) => lost(e) >= G.judgment.dmg), c.list.map((e) => lost(e)).join('/'))}`, 1.0);
  let hole = null;
  yield* spellTest('buraco', () => (hole = { a: dummy(-3, -4, 'minion', 5000, true), b: dummy(3, -4, 'minion', 5000, true) }),
    (c) => { const d = Math.hypot(c.a.position.x - c.b.position.x, c.a.position.z - c.b.position.z); return `puxou os dois juntos ${ok(d < 2.5, d.toFixed(1))}`; }, G.hole.dur - 0.9);
  yield 1.4;
  out(`  Buraco Negro: implosão ${ok(lost(hole.a) >= G.hole.boom && lost(hole.b) >= G.hole.boom, `${lost(hole.a)}/${lost(hole.b)}`)}`);
  yield* spellTest('apagar', () => ({ big: dummy(0, -4, 'warrior', 999), small: dummy(3, -3, 'minion', 50) }),
    (c) => `apagou o mais forte ${ok(!c.big.alive && !c.big.group.visible)} | sem túmulo ${ok(!combat.graves.some((gr) => Math.abs(gr.x - c.big.position.x) < 0.1 && Math.abs(gr.z - c.big.position.z) < 0.1))} | o outro ficou ${ok(c.small.alive)}`, G.erase.dur + 0.4);
  yield* spellTest('supernova', () => ({ a: dummy(0, 0), b: dummy(-7, 4), far: dummy(9, -9) }),
    (c) => `explosão em volta ${ok(lost(c.a) >= G.nova.dmg && lost(c.b) >= G.nova.dmg)} | longe não ${ok(c.far.hp === 5000)}`, 1.2);
  yield* spellTest('espadas', () => ({ list: [dummy(-3, -3), dummy(3, -3)] }),
    (c) => `espadas cravaram ${ok(c.list.every((e) => lost(e) >= G.swords.dmg * 3), c.list.map((e) => lost(e)).join('/'))}`, 1.8);
  yield* spellTest('tornado', () => ({ a: dummy(0, -1), b: dummy(1, -2.5) }),
    (c) => `sugou ${ok(ev('bonus').length >= 0 && (c.a.state === 'lanceFly' || lost(c.a) > 0))}`, 1.2);
  yield 'hold';
  yield* until(() => !combat.enemies.some((e) => e.state === 'lanceFly'), 6000); yield 0.2;
  const tz = combat.enemies.filter((e) => e.alive && !e.undead);
  out(`  Tornado: soltou e jogou longe ${ok(tz.length && tz.every((e) => e.state !== 'lanceFly' && e.position.y === 0 && lost(e) >= G.tornado.toss), tz.map((e) => lost(e)).join('/'))}`);
  yield* spellTest('mao', () => ({ a: dummy(0, -4), b: dummy(1, -4.5), far: dummy(-9, 6) }),
    (c) => `esmagou ${ok(lost(c.a) >= G.hand.dmg && lost(c.b) >= G.hand.dmg, String(lost(c.a)))} | longe não ${ok(c.far.hp === 5000)}`, 1.8);
  out(`  sem erros ${errs()}`);
  killAll(); combat.grim.clear(); yield 0.4;

  // ---------- 717) Lote 2 ----------
  out('717) As 10 magias do lote 2');
  yield* spellTest('chuva', () => ({ a: dummy(0, -4), b: dummy(5, -2) }),
    (c) => `meteoro em cada um ${ok(lost(c.a) >= G.rain.dmg && lost(c.b) >= G.rain.dmg, `${lost(c.a)}/${lost(c.b)}`)}`, G.rain.over + G.rain.fall + 0.6);
  yield* spellTest('sol', () => ({ a: dummy(0, -4), far: dummy(-9, 6) }),
    (c) => `queimou e explodiu ${ok(lost(c.a) >= G.sun.boom + G.sun.tickDmg * 5, String(lost(c.a)))} | longe não ${ok(c.far.hp === 5000)}`, G.sun.rise + G.sun.dur);
  yield* spellTest('fenix', () => ({ list: [dummy(-4, -4), dummy(0, -6), dummy(4, -3)] }),
    (c) => `caçou os 3 ${ok(c.list.every((e) => lost(e) >= G.phoenix.dmg), c.list.map((e) => lost(e)).join('/'))} | ${G.phoenix.hits} queimadas ${ok(c.list.reduce((n, e) => n + lost(e), 0) >= G.phoenix.dmg * G.phoenix.hits)}`, 5.5);
  yield* spellTest('pilares', () => ({ a: dummy(0, -3), b: dummy(0.5, -7), side: dummy(7, 2) }),
    (c) => `pilares na linha ${ok(lost(c.a) >= G.pillars.dmg && lost(c.b) >= G.pillars.dmg, `${lost(c.a)}/${lost(c.b)}`)} | caíram de volta ${ok(c.a.position.y === 0 && c.a.state !== 'lanceFly')} | do lado não ${ok(c.side.hp === 5000)}`, 2.2);
  yield* spellTest('cometa', () => ({ a: dummy(0, -3), b: dummy(0.8, -7), side: dummy(7, 3) }),
    (c) => `atravessou congelando ${ok(lost(c.a) >= G.comet.dmg && c.a.frozenT > 0 && c.b.frozenT > 0, `${lost(c.a)}/${lost(c.b)}`)} | do lado não ${ok(c.side.hp === 5000)}`, 0.3);
  yield* spellTest('prisao', () => ({ big: dummy(0, -4, 'warrior', 5000), s1: dummy(2.5, -3, 'minion', 1000), s2: dummy(-3, -5, 'minion', 1000) }),
    (c) => `preso no cristal ${ok(c.big.frozenT > 0)}`, 0.5);
  yield G.prison.dur;
  { const c = { big: combat.enemies.find((e) => e.alive && e.type === 'warrior') }; out(`  Prisão de Cristal: quebrou ${ok(c.big && lost(c.big) >= G.prison.dmg, c.big && String(lost(c.big)))} | estilhaços nos outros ${ok(combat.enemies.filter((e) => e.alive && e.type === 'minion').every((e) => 1000 - e.hp >= G.prison.shardDmg))}`); }
  let nv = null;
  yield* spellTest('nevasca', () => (nv = { a: dummy(1.5, 2), far: dummy(0, -7) }),
    (c) => `segue a Maga ${ok(lost(c.a) > 0)}`, 0.5);
  ctl.mx = 0.5; yield 1.0; ctl.mx = 0;
  yield G.blizzard.dur - 1.0;
  out(`  Nevasca: cortou quem chegou perto ${ok(lost(nv.a) >= G.blizzard.tickDmg * 10, String(lost(nv.a)))} | congelou ${ok(ev('frozen').some((x) => x.enemy === nv.a))} | longe não ${ok(nv.far.hp === 5000)}`);
  yield* spellTest('lancas', () => ({ a: dummy(0, -3), b: dummy(-2.5, -7), back: dummy(0, 7.5) }),
    (c) => `empalou e congelou ${ok(lost(c.a) >= G.spears.dmg && lost(c.b) >= G.spears.dmg && c.a.frozenT > 0, `${lost(c.a)}/${lost(c.b)}`)} | atrás não ${ok(c.back.hp === 5000)}`, 0.6);
  yield* spellTest('tempestade', () => ({ list: [dummy(-6, -4), dummy(0, -6), dummy(6, -2)] }),
    (c) => `raios em todos ${ok(c.list.every((e) => lost(e) >= G.storm.dmg), c.list.map((e) => lost(e)).join('/'))}`, G.storm.dur);
  yield* spellTest('raio', () => ({ list: [dummy(-3, -3), dummy(0, -6), dummy(3, -3), dummy(5, 0)] }),
    (c) => `pulou sem parar ${ok(c.list.every((e) => lost(e) >= G.chain.dmg * 5), c.list.map((e) => lost(e)).join('/'))}`, G.chain.max * G.chain.every + 0.4);
  killAll(); yield 0.3;
  { const weak = [dummy(-3, -3, 'minion', 60), dummy(0, -6, 'minion', 60), dummy(3, -3, 'minion', 60), dummy(5, 0, 'minion', 60), dummy(-5, -1, 'minion', 60)];
    flags.events.length = 0; window.__grimForce = () => 'raio'; ctl.atk = 1;
    yield* until(() => ev('grimCast').length > 0, 3000); window.__grimForce = null; yield 1.5;
    out(`  Raio Sem Fim: matou todos ${ok(weak.every((e) => !e.alive))} | ${errs()}`); }
  killAll(); combat.grim.clear(); yield 0.4;

  // ---------- 718) Lote 3 ----------
  out('718) As 10 magias do lote 3');
  yield* spellTest('dragao', () => ({ a: dummy(0, -4), b: dummy(1, -7), side: dummy(-9, 6) }),
    (c) => `atravessou abocanhando ${ok(lost(c.a) >= G.dragon.dmg && lost(c.b) >= G.dragon.dmg, `${lost(c.a)}/${lost(c.b)}`)} | queimou ${ok(lost(c.a) > G.dragon.dmg)}`, 3.2);
  yield* spellTest('plasma', () => ({ a: dummy(0, -3), side: dummy(4, -4) }),
    (c) => `choques em volta ${ok(lost(c.a) >= G.plasma.dmg * 4 && lost(c.side) >= G.plasma.dmg * 2, `${lost(c.a)}/${lost(c.side)}`)}`, G.plasma.maxT);
  yield* spellTest('abismo', () => ({ weak: dummy(-2, -4, 'minion', 300), strong: dummy(2, -4, 'warrior', 5000) }),
    (c) => `arrastou o fraco (sem corpo) ${ok(!c.weak.alive && !c.weak.group.visible)} | o forte escapou ${ok(c.strong.alive && lost(c.strong) >= G.abyss.dmg && c.strong.position.y === 0 && c.strong.state !== 'lanceFly', String(lost(c.strong)))}`, G.abyss.rise + G.abyss.hold + G.abyss.sink + 0.6);
  let army = null;
  yield* spellTest('exercito', () => {
    combat.grim.fallen.length = 0;
    for (const [x, z] of [[-3, 0], [3, 0], [-4, -3], [4, -3]]) { const e = dummy(x, z, 'minion', 50); combat.bonusDamage(e, 9999, 0, 1); }
    return (army = { foe: dummy(0, -5, 'warrior', 5000), n0: combat.enemies.filter((e) => e.undead && e.alive).length });
  }, (c) => { const sh = combat.enemies.filter((e) => e.grimShade && e.alive); return `os 4 mortos levantaram ${ok(sh.length >= 4, String(sh.length))} | lutam pela Maga ${ok(sh.every((u) => u.undead === player))}`; }, 3.5);
  out(`  Exército das Sombras: bateram no inimigo ${ok(lost(army.foe) >= G.army.dmg * 2, String(lost(army.foe)))} | ${errs()}`);
  for (const u of combat.enemies) if (u.grimShade && u.alive) u.die();
  let ecl = null;
  yield* spellTest('eclipse', () => (ecl = { list: [dummy(-1, -6, 'minion', 5000, false), dummy(1, -6, 'minion', 5000, false), dummy(0, -7.5, 'minion', 5000, false)], hp: player.hp }),
    (c) => `cegos ${ok(c.list.every((e) => e.grimBlindT > 0))}`, 0.2);
  yield G.eclipse.dur - 0.8;
  out(`  Eclipse: bateram uns nos outros ${ok(ev('grimBlindHit').length >= 2 && ecl.list.some((e) => lost(e) > 0), `${ev('grimBlindHit').length} golpes`)} | a Maga não apanhou ${ok(player.hp === ecl.hp)} | ${errs()}`);
  yield 1; out(`  Eclipse: acabou ${ok(ecl.list.every((e) => !(e.grimBlindT > 0)))}`);
  yield* spellTest('foice', () => ({ list: [dummy(0, -5), dummy(6, 3), dummy(-7, 6), dummy(-4, -8)] }),
    (c) => `varreu a sala 2 vezes ${ok(c.list.every((e) => lost(e) >= G.scythe.dmg * 2), c.list.map((e) => lost(e)).join('/'))}`, G.scythe.appear + G.scythe.dur);
  yield* spellTest('arcano', () => ({ a: dummy(0, -3), b: dummy(0.5, -9), side: dummy(6, 0) }),
    (c) => `feixe atravessou ${ok(lost(c.a) >= G.beam.dmg * 8 && lost(c.b) >= G.beam.dmg * 8, `${lost(c.a)}/${lost(c.b)}`)} | do lado não ${ok(c.side.hp === 5000)}`, G.beam.charge + G.beam.dur);
  yield* spellTest('estrelas', () => ({ list: [dummy(-5, -4), dummy(0, -7), dummy(5, -2)] }),
    (c) => `estrelas em todos ${ok(c.list.every((e) => lost(e) >= G.stars.dmg), c.list.map((e) => lost(e)).join('/'))}`, G.stars.dur);
  yield* spellTest('portal', () => ({ a: dummy(0, -4), b: dummy(1.2, -4.6), far: dummy(-9, 7) }),
    (c) => `engoliu e cuspiu do teto ${ok([c.a, c.b].every((e) => lost(e) >= G.portal.dmg && e.position.y === 0 && e.state !== 'lanceFly' && e.group.visible), `${lost(c.a)}/${lost(c.b)}`)} | longe não ${ok(c.far.hp === 5000)}`, G.portal.dur + 2.2);
  let zg = null;
  yield* spellTest('gravidade', () => (zg = { a: dummy(-3, -4), b: dummy(3, -2, 'warrior') }),
    (c) => `flutuando ${ok(c.a.position.y > 1.5 && c.b.position.y > 1.5, `${c.a.position.y.toFixed(1)}/${c.b.position.y.toFixed(1)}`)}`, 0.8);
  yield G.zero.dur;
  out(`  Gravidade Zero: despencaram ${ok([zg.a, zg.b].every((e) => lost(e) >= G.zero.dmg && e.position.y === 0 && e.state !== 'lanceFly'), `${lost(zg.a)}/${lost(zg.b)}`)} | ${errs()}`);
  killAll(); combat.grim.clear(); yield 0.4;

  // ---------- 719) Lote 4 ----------
  out('719) As 10 magias do lote 4');
  let cr = null;
  yield* spellTest('esmagadora', () => (cr = { a: dummy(-3, -4), b: dummy(3, -2, 'warrior') }),
    (c) => `achatados no chão ${ok(c.a.group.scale.y < 0.7 && c.b.group.scale.y < 0.7 && c.a.state === 'lanceFly', `${c.a.group.scale.y.toFixed(2)}/${c.b.group.scale.y.toFixed(2)}`)}`, 1.3);
  yield G.crush.dur - 1.0;
  out(`  Gravidade Esmagadora: esmagou ${ok([cr.a, cr.b].every((e) => lost(e) >= G.crush.dmg && e.state !== 'lanceFly' && Math.abs(e.group.scale.y - 1) < 0.01), `${lost(cr.a)}/${lost(cr.b)}`)}`);
  yield* spellTest('espelhos', () => ({ list: [dummy(-5, -3), dummy(0, -6), dummy(5, -2)] }),
    (c) => `6 cópias ${ok((ev('grimMirror')[0] || {}).n === G.mirror.n)} | atiraram em todos ${ok(c.list.every((e) => lost(e) >= G.mirror.dmg * 3), c.list.map((e) => lost(e)).join('/'))}`, G.mirror.dur);
  yield* spellTest('rasgo', () => ({ a: dummy(0, -3), b: dummy(0.5, -8), side: dummy(9, 3) }),
    (c) => `partiu a linha ${ok(lost(c.a) >= G.rift.dmg + G.rift.close && lost(c.b) >= G.rift.dmg, `${lost(c.a)}/${lost(c.b)}`)} | do lado não ${ok(c.side.hp === 5000)}`, G.rift.open + G.rift.stay + 0.5);
  yield* spellTest('anel', () => ({ a: dummy(3.4, 4), b: dummy(-1, 0.8), far: dummy(-9, -9) }),
    (c) => `rochas batendo ${ok(lost(c.a) >= G.ring.dmg * 3 && lost(c.b) >= G.ring.dmg * 3, `${lost(c.a)}/${lost(c.b)}`)}`, G.ring.dur + 0.9);
  yield* spellTest('terremoto', () => ({ weak: dummy(-2, -4, 'minion', 300), strong: dummy(2, -4, 'warrior', 5000) }),
    (c) => `engoliu o fraco (sem corpo) ${ok(!c.weak.alive && !c.weak.group.visible)} | o forte escapou ${ok(c.strong.alive && lost(c.strong) >= G.quake.dmg + G.quake.tremorDmg * 3 && c.strong.position.y === 0 && c.strong.state !== 'lanceFly' && c.strong.group.visible, String(lost(c.strong)))}`, G.quake.every * G.quake.tremors + G.quake.sink + G.quake.hold + 0.95);
  yield* spellTest('raizes', () => ({ a: dummy(-3, -4), b: dummy(3, -3, 'warrior') }),
    (c) => `prendeu e espremeu ${ok([c.a, c.b].every((e) => lost(e) >= G.roots.dmg && e.state !== 'lanceFly' && e.position.y === 0), `${lost(c.a)}/${lost(c.b)}`)}`, G.roots.grow + G.roots.hold + 0.8);
  let ts = null;
  yield* spellTest('tsunami', () => (ts = { a: dummy(-3, -1), b: dummy(4, -4), hp: player.hp }),
    (c) => `levou até a parede ${ok([c.a, c.b].every((e) => lost(e) >= G.wave.dmg && e.state !== 'lanceFly' && e.position.y === 0 && e.position.z < -combat.grim.bounds().z + 3.5), `${lost(c.a)}/${lost(c.b)} z ${c.a.position.z.toFixed(1)}`)} | a Maga não apanhou ${ok(player.hp === c.hp)}`, 3.4);
  yield* spellTest('nevoa', () => ({ list: [dummy(-7, -6), dummy(7, 5), dummy(0, -8)] }),
    (c) => `envenenou a sala ${ok(c.list.every((e) => lost(e) >= G.fog.dmg * 12), c.list.map((e) => lost(e)).join('/'))}`, G.fog.dur);
  yield* spellTest('enxame', () => ({ list: [dummy(-4, -4), dummy(4, -5), dummy(0, -8)] }),
    (c) => `morcegos morderam todos ${ok(c.list.every((e) => lost(e) >= 120), c.list.map((e) => lost(e)).join('/'))}`, G.swarm.dur + 0.8);
  let gl = null;
  yield* spellTest('golem', () => (gl = { a: dummy(0, -5), b: dummy(2, -6) }),
    (c) => `subiu do chão ${ok(grimGolems().length === 1)}`, 0.2);
  yield 7;
  out(`  Golem Ancestral: socou ${ok(ev('grimGolemHit').length >= 3 && lost(gl.a) + lost(gl.b) >= G.golem.punch * 3, `${ev('grimGolemHit').length} golpes, ${lost(gl.a)}/${lost(gl.b)}`)} | pancada no chão ${ok(ev('grimGolemHit').some((x) => x.slam))} | ${errs()}`);
  killAll(); combat.grim.clear(); yield 0.4;
  out(`  Golem Ancestral: some no fim da sala ${ok(grimGolems().length === 0)} | ${errs()}`);

  // ---------- 720) Lote 5 ----------
  out('720) As 10 magias do lote 5 (absurdas)');
  yield* spellTest('miniatura', () => ({ a: dummy(-3, -4), b: dummy(3, -3, 'warrior') }),
    (c) => `viraram bonequinhos ${ok([c.a, c.b].every((e) => e.alive && e.hp <= 1 && e.group.scale.x < 0.5), `${c.a.hp}/${c.b.hp} esc. ${c.a.group.scale.x.toFixed(2)}`)} | quase sem força ${ok(c.a.dmgScale < 0.5)}`, G.mini.shrink + 0.5);
  let mr = null;
  yield* spellTest('marionetes', () => (mr = { list: [dummy(-1, -6, 'minion', 5000, false), dummy(1, -6, 'minion', 5000, false), dummy(0, -7.5, 'minion', 5000, false)], hp: player.hp }),
    (c) => `presos nos fios ${ok(c.list.every((e) => e.grimBlindT > 0 && e.grimPuppet))}`, 0.2);
  yield G.puppet.dur - 0.8;
  out(`  Marionetes: se atacaram ${ok(ev('grimBlindHit').length >= 2 && mr.list.some((e) => lost(e) > 0), `${ev('grimBlindHit').length} golpes`)} | a Maga não apanhou ${ok(player.hp === mr.hp)}`);
  yield 1; out(`  Marionetes: soltou ${ok(mr.list.every((e) => !(e.grimBlindT > 0) && !e.grimPuppet))} | ${errs()}`);
  let cv = null;
  yield* spellTest('conversao', () => (cv = { big: dummy(0, -4, 'warrior', 800, false), foe: dummy(3, -6, 'minion', 300) }),
    (c) => `o mais forte virou aliado ${ok(c.big.undead === player && c.big.grimConvert && c.big.hp === 1600, `${c.big.hp}`)} | o outro não ${ok(!c.foe.undead)}`, 0.4);
  yield 4;
  out(`  Conversão: bateu no inimigo ${ok(lost(cv.foe, 300) >= G.convert.dmg, String(lost(cv.foe, 300)))} | ${errs()}`);
  for (const u of combat.enemies) if (u.grimConvert && u.alive) u.die();
  yield* spellTest('bomba', () => ({ a: dummy(-3, -4), b: dummy(-1.5, -4.5), far: dummy(6, 2), s0: 1 }),
    (c) => `explodiram ${ok(lost(c.far) >= G.bomb.dmg && lost(c.a) >= G.bomb.dmg + G.bomb.splash, `${lost(c.a)}/${lost(c.far)}`)} | sem bomba na cabeça ${ok(c.a.model.scale.x < 1.05)}`, G.bomb.fuse + 0.4);
  yield* spellTest('teto', () => ({ list: [dummy(-5, -4), dummy(0, -7), dummy(5, -2)] }),
    (c) => `pedras em todos ${ok(c.list.every((e) => lost(e) >= G.ceiling.dmg), c.list.map((e) => lost(e)).join('/'))}`, G.ceiling.over + G.ceiling.fall + 0.6);
  yield* spellTest('martelo', () => ({ a: dummy(0, -4), b: dummy(1.5, -5), far: dummy(-9, 7) }),
    (c) => `achatou ${ok(lost(c.a) >= G.hammer.dmg && lost(c.b) >= G.hammer.dmg, `${lost(c.a)}/${lost(c.b)}`)} | longe não ${ok(c.far.hp === 5000)}`, G.hammer.fall + 0.5);
  let jz = null;
  yield* spellTest('juizo', () => (jz = { list: [dummy(-6, -5), dummy(6, 3), dummy(0, -8)], hp: player.hp }),
    (c) => `julgou a sala ${ok(c.list.every((e) => lost(e) >= G.doom.dmg), c.list.map((e) => lost(e)).join('/'))} | a Maga não apanhou ${ok(player.hp === c.hp)}`, 3.6);
  yield* spellTest('fonte', () => { player.hp = 10; return { list: [dummy(-3, -4), dummy(6, 2)] }; },
    (c) => `vida cheia ${ok(player.hp === player.maxHp, `${player.hp}/${player.maxHp}`)} | 3 ondas queimaram ${ok(c.list.every((e) => lost(e) >= G.fount.dmg * 3), c.list.map((e) => lost(e)).join('/'))}`, G.fount.waves * G.fount.every + 1);
  yield* spellTest('roleta', () => ({ a: dummy(0, -5) }),
    () => `soltou 3 magias ${ok(ev('grimChaos').length === G.chaos.n, ev('grimChaos').map((x) => x.id).join(','))} | ${errs()}`, G.chaos.spin + G.chaos.gap * 3 + 0.4);
  yield 5; killAll(); combat.grim.clear(); yield 0.3;
  yield* spellTest('apocalipse', () => ({ list: [dummy(-4, -4), dummy(4, -6), dummy(0, -8, 'warrior')] }),
    (c) => `fim do mundo ${ok(ev('grimApoc').length === 1 && c.list.every((e) => lost(e) >= G.apoc.final + 300), c.list.map((e) => lost(e)).join('/'))} | as 4 juntas ${ok(ev('grimChaos').length === 4)} | ${errs()}`, G.apoc.dur + 0.5);
  killAll(); combat.grim.clear(); yield 0.4;

  // ---------- 712) Sorteio ----------
  out(`712) Sorteio: as ${SPELLS.length} saem antes de alguma repetir`);
  player.grim.bag = []; flags.events.length = 0;
  for (let i = 0; i < SPELLS.length; i++) { ctl.atk = 1; yield* until(() => ev('grimCast').length > i, 3000); yield* until(() => player.state !== 'attack', 2000); }
  const ids = new Set(ev('grimCast').map((x) => x.id));
  out(`  ${SPELLS.length} magias diferentes ${ok(ids.size === SPELLS.length, `${ids.size}: ${[...ids].join(',')}`)} | ${errs()}`);
  yield 7; killAll(); combat.grim.clear(); yield 0.3;

  // ---------- 713) Escudo ----------
  out('713) Escudo 360°: flechas e magias voltam, golpe corpo a corpo machuca');
  player.position.set(0, 0, 4); player.hp = player.maxHp; player.iframes = 0;
  const arch = dummy(0, -6, 'archer', 500);
  const hp0 = player.hp, sh0 = player.shield; flags.events.length = 0;
  combat.projectiles.fire(3.2, 4, -Math.PI / 2, { speed: 18, damage: 9, kind: 'arrow', owner: arch }); // do lado
  combat.projectiles.fire(0, -4.5, 0, { speed: 18, damage: 9, kind: 'orb', owner: arch }); // pela frente
  yield* until(() => ev('grimReflect').length >= 2, 2000); yield 0.6;
  out(`  rebateu as 2 ${ok(ev('grimReflect').length === 2)} | não perdeu vida ${ok(player.hp === hp0)} | barreira não gastou ${ok(player.shield === sh0, `${sh0}→${player.shield}`)} | o arqueiro levou de volta ${ok(arch.hp < 500, String(500 - arch.hp))}`);
  const nec = { position: player.position.clone().setZ(player.position.z - 1), alive: true, data: { boss: true }, dmgScale: 1 };
  combat.hitPlayer(nec, 20, { bossSkill: true, magic: true, target: player });
  out(`  explosão do Necromante anulada ${ok(player.hp === hp0 && ev('grimBlock').length === 1)}`);
  player.iframes = 0;
  const mel = dummy(0, 3, 'minion', 500, false);
  combat.hitPlayer(mel, 6, { target: player });
  out(`  golpe corpo a corpo machuca ${ok(player.hp < hp0, `${hp0}→${player.hp}`)}`);
  killAll(); yield 0.3;

  // ---------- 714) Teleporte ----------
  out('714) Rolamento vira teleporte');
  player.position.set(0, 0, 4); player.hp = player.maxHp; flags.events.length = 0; player.dodgeCooldown = 0;
  ctl.mx = 1; ctl.dodge = 1; yield 0.1; ctl.mx = 0;
  const bl = ev('grimBlink')[0];
  out(`  teleportou ${ok(!!bl && bl.d > 4, bl && bl.d.toFixed(1))} | não rolou ${ok(player.state !== 'dodge')}`);
  yield 0.2; out('  -> teleporte (screenshot)'); yield 'hold';

  // ---------- 715) Nenhuma bênção ----------
  out('715) Nenhuma outra bênção vale com o Grimório');
  player.position.set(0, 0, 4); player.facing = Math.PI;
  player.stats.damageMul = 3; player.stats.lifeOnKill = 10; player.hp = 10;
  const t1 = dummy(0, -3, 'minion', 5000), t2 = dummy(0.5, -3.5, 'minion', 30);
  flags.events.length = 0; window.__grimForce = () => 'meteoro'; ctl.atk = 1;
  yield* until(() => ev('grimCast').length > 0, 3000); window.__grimForce = null; yield 1.4;
  out(`  dano fixo (sem +dano) ${ok(lost(t1) === G.meteor.dmg || lost(t1) <= G.meteor.dmg + G.meteor.burnDmg * 3, String(lost(t1)))} | matou sem curar (Sede de Sangue) ${ok(!t2.alive && player.hp === 10, String(player.hp))}`);
  player.stats.damageMul = 1; player.stats.lifeOnKill = 0; player.hp = player.maxHp;
  killAll(); yield 0.3;

  // ---------- 716) Sala nova / partida nova ----------
  out('716) Sala nova: continua; partida nova: volta ao normal');
  combat.clear(); yield 0.3;
  out(`  depois de limpar a sala continua ${ok(grimOn(player) && player.grimLook && player.grimLook.book.g.parent === player.group)}`);
  fresh(); yield 0.3;
  out(`  recomeçou limpo ${ok(!player.grim && !player.grimLook && !player.blessings.w_l1c1 && player.weapon && player.weapon.visible)}`);
  out(`  outras armas: não aparece ${ok(!WEAPON_BLESSINGS.some((x) => x.id === 'w_l1c1' && x.weapon !== 'mage.cajado'))}`);
  out(`  sem erros do jogo ${errs()}`);
  player.input = realInput; player.iframes = 0;
}
