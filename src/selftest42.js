// Teste automático, parte 42 (12/11/2026): bênção LENDÁRIA Forma Final (Espada e Escudo): o robô gigante.
// l1bless.js / mechkit.js / mech.js / mechfx.js. Tecla F7 (corrido), F10 (com as pausas de screenshot) e no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { L1 } from './l1bless.js';
import { mechOn, mechZoom } from './mechkit.js';
import { thorTests } from './selftest43.js'; // Bênção de Odin (Machado)
import { broTests } from './selftest44.js'; // Venham, Irmãos (Mangual)

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* l1Tests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const M = L1.mech;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const ctl = { atk: 0, blk: false, mx: 0, mz: 0, aim: null, dodge: 0 };
  const fake = () => ({ moveDir: (v) => v.set(ctl.mx, 0, ctl.mz), aimAngle: () => ctl.aim, attack: () => (ctl.atk > 0 ? (ctl.atk--, true) : false), attackHeld: () => false, dodge: () => (ctl.dodge > 0 ? (ctl.dodge--, true) : false), dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => ctl.blk });
  const fresh = (hero = 'knight', weapon = 'espada') => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    for (const k of [...g.run.pickups]) g.run.removePickup(k);
    player.setHero(hero, weapon); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    clearStrip(-12, 12, -18, 10);
    combat.demo.list = [];
    flags.events.length = 0;
    Object.assign(ctl, { atk: 0, blk: false, mx: 0, mz: 0, aim: null, dodge: 0 });
    player.input = fake();
  };
  const give = (id) => player.addBlessing(BLESSINGS.find((x) => x.id === id));
  const dummy = (x, z, type = 'minion', hp = 999, passive = true) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing: 0 }); e.hp = e.maxHp = hp; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 6000) { for (let t = 0; t < ms / 1000 && !cond(); t += 0.05) yield 0.05; };
  const m = () => player.mech;
  const ready = function* () { give('w_l1e1'); yield* until(() => m() && m().phase === 'play', 9000); yield 0.1; };

  // ---------- 663) Lista ----------
  out('663) Lendária Forma Final (Espada e Escudo): o robô gigante');
  const b = WEAPON_BLESSINGS.find((x) => x.id === 'w_l1e1');
  const leg = BLESSINGS.filter((x) => x.rarity === 'legendary' && !x.id.startsWith('c_'));
  out(`  existe ${ok(!!b)} | só da Espada e Escudo ${ok(b && b.weapon === 'knight.espada')} | lendária, máx. 1 ${ok(b && b.rarity === 'legendary' && b.max === 1)} | lendárias do solo: Forma Final, Bênção de Odin, Venham, Irmãos, Velocidade Rasga-Tempo, Gigante de Aço e Grimório Ancestral ${ok(leg.length === 6, leg.map((x) => x.name).join(', '))} | texto fala de ${M.hp} e ${M.dmg} ${ok(b && b.desc(1).includes(String(M.hp)) && b.desc(1).includes(String(M.dmg)))}`);

  // ---------- 664) Chegada ----------
  out('664) Pegou a bênção: o robô cai do céu, o Cavaleiro embarca e levanta');
  fresh(); yield 0.1;
  const near = dummy(0.5, -1.5, 'minion', 100), far = dummy(9, -9, 'minion', 100);
  const hp0 = player.hp;
  give('w_l1e1');
  yield* until(() => m() && m().phase === 'drop');
  out(`  chamou ${ok(ev('mechCall').length === 1)} | cena: nada machuca o Cavaleiro ${ok(player.invulnerable)}`);
  out('  -> o robô caindo (screenshot)'); yield 'hold';
  yield* until(() => ev('mechLand').length > 0);
  out(`  pouso: quem estava perto levou ${M.dmg} ${ok(!near.alive)} | quem estava longe, não ${ok(far.alive && far.hp === 100)}`);
  yield* until(() => m() && m().phase === 'rise' && m().t > 1.2);
  out('  -> raio na espada (screenshot)'); yield 'hold';
  yield* until(() => m() && m().phase === 'play'); yield 0.1;
  const mm = m();
  out(`  embarcou ${ok(ev('mechBoard').length === 1)} | raio na espada ${ok(ev('mechIgnite').length === 1)} | pronto ${ok(!!mm && mm.phase === 'play')} | vida do robô ${M.hp} ${ok(mm && mm.hp === M.hp && mm.max === M.hp)} | vida do Cavaleiro igual ${ok(player.hp === hp0)}`);
  out(`  Cavaleiro na cabine ${ok(player.model.parent === mm.v.seat)} | robô preso ao herói ${ok(mm.v.g.parent === player.group)} | câmera afastada ${ok(mechZoom(player) === M.zoom)} | sem erros ${ok(!window.__game.errors.length, window.__game.errors[0])}`);
  far.die();

  // ---------- 665) Golpes ----------
  out(`665) Golpes: ${M.dmg} de dano, alcance enorme, área grande`);
  player.position.set(0, 0, 2); player.facing = Math.PI; ctl.aim = Math.PI;
  const row = [dummy(-5, -2), dummy(0, -4.6), dummy(5, -1), dummy(0, 2 - (M.range + 0.3))], out1 = dummy(0, 2 - (M.range + 2.2)), back = dummy(0, 7.5);
  const tank = dummy(3, -3, 'warrior', 999);
  flags.events.length = 0; ctl.atk = 1;
  yield* until(() => ev('mechStrike').length >= 1); yield 0.05;
  out(`  1º corte: acertou os 4 no arco ${ok(row.every((e) => e.hp === 999 - M.dmg), row.map((e) => 999 - e.hp).join('/'))} | fora do alcance não ${ok(out1.hp === 999)} | atrás não ${ok(back.hp === 999)} | passa pelo escudo do guerreiro ${ok(tank.hp === 999 - M.dmg)}`);
  out('  -> corte largo (screenshot)'); yield 'hold';
  ctl.atk = 1; yield* until(() => ev('mechStrike').length >= 2); yield 0.05;
  out(`  2º corte (volta) ${ok(row.slice(0, 3).every((e) => e.hp === 999 - M.dmg * 2), row.map((e) => 999 - e.hp).join('/'))}`);
  const lineFar = dummy(0, 2 - (M.slam.ahead + 6), 'minion', 999);
  ctl.atk = 1; yield* until(() => ev('mechStrike').length >= 3); yield 0.05;
  out(`  3º golpe (de cima): impacto + fenda em linha reta ${ok(lineFar.hp === 999 - M.dmg && row[1].hp === 999 - M.dmg * 3)} | dos lados, longe, não ${ok(row[0].hp === 999 - M.dmg * 2)}`);
  out('  -> golpe de cima e fenda (screenshot)'); yield 'hold';
  yield* until(() => !m().atk);

  // Nenhuma bênção interfere.
  out('666) Nenhuma outra bênção muda os golpes do robô');
  give('forca'); give('forca'); give('sede'); give('explosao');
  player.stats.critChance = 5; player.hp = 50;
  for (const e of combat.enemies) if (e.alive) e.die();
  yield 0.1;
  const weak = dummy(0, -2, 'minion', 10), side = dummy(1.2, -2.4, 'minion', 999), t2 = dummy(-2, -3, 'minion', 999);
  flags.events.length = 0; ctl.atk = 1;
  yield* until(() => ev('mechStrike').length >= 1); yield 0.1;
  out(`  com Força Bruta ×2 e crítico: continua ${M.dmg} ${ok(t2.hp === 999 - M.dmg, String(999 - t2.hp))} | Sede de Sangue não cura ${ok(player.hp === 50, String(player.hp))} | Ossos Explosivos não explode ${ok(!weak.alive && side.hp === 999 - M.dmg, String(999 - side.hp))}`);
  yield* until(() => !m().atk);
  for (const e of combat.enemies) if (e.alive) e.die();

  // ---------- 667) Mais lento, não rola ----------
  out('667) Um pouco mais lento e não rola');
  yield 0.2;
  player.position.set(0, 0, 2); const x0 = player.position.x;
  ctl.mx = 1; yield 1; ctl.mx = 0;
  const walked = player.position.x - x0, want = player.hero.moveSpeed * M.speed;
  ctl.dodge = 1; yield 0.3;
  out(`  andou ${walked.toFixed(1)} em 1 s (Cavaleiro: ${player.hero.moveSpeed}) ${ok(walked > want * 0.8 && walked < player.hero.moveSpeed * 0.95)} | apertou rolar: não rolou ${ok(player.state === 'mech' && !player.canDodgeNow())} | passos pesados ${ok(mm.steps >= 1)}`);

  // ---------- 668) Vida própria ----------
  out('668) O dano vai todo para o robô; o Cavaleiro não perde vida');
  const foe = dummy(0, -1, 'minion', 999);
  player.position.set(0, 0, 2); player.facing = 0; ctl.aim = 0; yield 0.4; // de costas para o inimigo
  const kh = player.hp;
  combat.hitPlayer(foe, 40, { target: player });
  out(`  golpe de 40: robô ${m().hp}/${M.hp} ${ok(m().hp === M.hp - 40)} | Cavaleiro igual ${ok(player.hp === kh)} | esbarrão não machuca ${ok(combat.hitPlayer(foe, 10, { target: player, contact: true }) === false && m().hp === M.hp - 40)}`);

  // ---------- 669) Escudo ----------
  out('669) Escudo gigante: segurar o bloqueio defende a frente sem gastar');
  player.facing = Math.PI; ctl.aim = Math.PI; ctl.blk = true; yield 0.5;
  const sh0 = player.shield;
  for (let i = 0; i < 12; i++) combat.hitPlayer(foe, 30, { target: player });
  out(`  12 golpes pela frente: robô igual ${ok(m().hp === M.hp - 40)} | o escudo do Cavaleiro não gasta ${ok(player.shield === sh0)} | bloqueou ${ok(ev('mechBlock').length === 12)}`);
  const behind = dummy(0, 5, 'minion', 999);
  combat.hitPlayer(behind, 20, { target: player });
  out(`  pelas costas passa ${ok(m().hp === M.hp - 60)} | pancada armada ${ok(m().armed)}`);
  out('  -> escudo levantado (screenshot)'); yield 'hold';
  const x1 = player.position.x; ctl.mz = 1; yield 0.5; ctl.mz = 0;
  out(`  anda devagar com o escudo levantado ${ok(Math.abs(player.position.z - 2) > 0.3 && Math.abs(player.position.x - x1) < 0.2)}`);
  flags.events.length = 0; ctl.blk = false;
  yield* until(() => ev('mechBash').length >= 1); yield 0.05;
  out(`  soltou depois de defender: pancada atordoa em volta ${ok(ev('mechStun').length === 2, String(ev('mechStun').length))} | sem dano ${ok(foe.hp === 999 && behind.hp === 999)}`);
  out('  -> pancada de escudo (screenshot)'); yield 'hold';
  yield* until(() => !m().atk);

  // ---------- 670) Troca de sala ----------
  out('670) O robô continua na sala seguinte');
  combat.clear(); player.placeAt(0, 3); yield 0.3;
  out(`  depois de trocar de sala: ainda no robô ${ok(mechOn(player) && m().phase === 'play' && player.state === 'mech')} | vida guardada ${ok(m().hp === M.hp - 60)} | Cavaleiro na cabine ${ok(player.model.parent === m().v.seat)}`);

  // ---------- 671) Destruição ----------
  out('671) Vida do robô acaba: explode, o Cavaleiro é ejetado e o robô não volta');
  const n1 = dummy(1.5, 1, 'minion', 100), n2 = dummy(12, -12, 'minion', 100), hitter = dummy(0, 8, 'minion', 999);
  player.facing = Math.PI; yield 0.2;
  flags.events.length = 0;
  combat.hitPlayer(hitter, 999, { target: player });
  out(`  colapso ${ok(ev('mechDown').length === 1 && m().phase === 'dying')} | nada machuca durante a cena ${ok(player.invulnerable)}`);
  yield 0.9; out('  -> robô em colapso (screenshot)'); yield 'hold';
  yield* until(() => ev('mechExplode').length > 0); yield 0.12;
  out('  -> explosão (screenshot)'); yield 'hold';
  out(`  explosão: quem estava perto levou ${M.dmg} ${ok(!n1.alive)} | longe, não ${ok(n2.alive && n2.hp === 100)}`);
  yield* until(() => !player.mech); yield 0.3;
  out(`  Cavaleiro de volta ${ok(!player.mech && player.state === 'idle' && player.model.parent === player.group && player.model.scale.x === 1)} | vida dele igual ${ok(player.hp === kh)} | tamanho normal ${ok(player.hero.radius < 1)} | arma e escudo de volta ${ok(player.weapon.visible)} | 2 s sem tomar dano ${ok(player.iframes > 1)} | câmera normal ${ok(mechZoom(player) === 1)}`);
  yield 1.5;
  out(`  não volta nesta partida ${ok(!player.mech && player.mechUsed && ev('mechCall').length === 0)} | pode rolar de novo ${ok(player.canDodgeNow())}`);

  // ---------- 672) Partida nova ----------
  out('672) Partida nova: sem robô; outra arma não chama');
  fresh(); yield 0.3;
  out(`  recomeçou limpo ${ok(!player.mech && !player.mechUsed && !player.blessings.w_l1e1)}`);
  fresh('knight', 'machado'); yield 0.1;
  out(`  Machado: a bênção não aparece ${ok(!WEAPON_BLESSINGS.some((x) => x.id === 'w_l1e1' && x.weapon !== 'knight.espada'))}`);
  out(`  sem erros do jogo ${ok(!window.__game.errors.length, window.__game.errors[0])}`);
  player.input = realInput; player.iframes = 0;
  yield* thorTests(g, out, flags); // 673–680: Bênção de Odin (Machado)
  yield* broTests(g, out, flags); // 681–688: Venham, Irmãos (Mangual)
}
