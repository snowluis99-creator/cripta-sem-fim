// Teste automático, parte 16 (02/11/2026): bênçãos do Machado de Duas Mãos (lista do dono, 1ª leva).
// Tecla Y = tudo; tecla - (menos) = só esta parte.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { AXE } from './axekit.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* axeTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('knight', 'machado'); player.reset(0, 2); player.facing = Math.PI;
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion', hp = 999) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const C = () => player.hero.combo;
  const giro = () => C().find((s) => s.arc === 360);

  // ---------------- 90) Lista ----------------
  out('90) Machado: lista nova de bênçãos (1ª leva)');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'knight.machado');
  const names = mine.map((b) => b.name);
  const gone = ['Cabo Longo', 'Sangue Quente', 'Fúria do Berserker'].filter((n) => names.includes(n));
  const want = ['Fio Pesado', 'Giro Voraz', 'Sede de Batalha', 'Braços de Ferro', 'Racha-Crânios', 'Redemoinho', 'Lenhador', 'Machado Sedento', 'Terremoto Rubro', 'Arremesso Mortal', 'Pião', 'Tornado', 'Giro Crescente', 'Rolagem Giratória'];
  const miss = want.filter((n) => !names.includes(n));
  out(`  ${mine.length} bênçãos ${ok(mine.length === 14)} | removidas ${ok(gone.length === 0, gone.join(', '))} | todas da lista ${ok(!miss.length, miss.join(', '))} | um só "Machado Sedento" ${ok(names.filter((n) => n === 'Machado Sedento').length === 1)}`);

  // ---------------- 91) Fio Pesado, Sede de Batalha ----------------
  out('91) Fio Pesado e Sede de Batalha');
  fresh(); yield 0.1;
  give('w_mac1', 3);
  const a1 = dummy(-0.6, 0.6), a2 = dummy(0.6, 0.6);
  combat.playerStrike(player, C()[0]);
  const d0 = 999 - a1.hp;
  out(`  acertou 2: bônus ${Math.round((player.axeMultiBonus || 0) * 100)}% por 2 s ${ok(player.axeMultiT > 1.9 && Math.abs(player.axeMultiBonus - 0.6) < 0.01)}`);
  a2.die(); combat.killed(a2, 0, 1, player); a1.hp = 999;
  combat.playerStrike(player, C()[0]);
  const d1 = 999 - a1.hp;
  out(`  próximo golpe ${d0} -> ${d1} ${ok(d1 > d0 * 1.35)}`);
  yield 2.2;
  out(`  passou 2 s: acabou ${ok(!(player.axeMultiT > 0))}`);
  fresh(); yield 0.1;
  give('w_mac11', 2);
  const s1 = dummy(0, 0.8);
  combat.playerStrike(player, C()[0]); const sd0 = 999 - s1.hp;
  for (let i = 0; i < 5; i++) { const k = dummy(3, 3 + i); k.die(); combat.killed(k, 0, 1, player); }
  s1.hp = 999; combat.playerStrike(player, C()[0]); const sd1 = 999 - s1.hp;
  out(`  Sede de Batalha ×2: 5 abates (+30%) ${sd0} -> ${sd1} ${ok(player.axeKills === 5 && sd1 > sd0 * 1.12)}`);
  combat.axe.roomStart();
  out(`  sala nova: zera ${ok(player.axeKills === 0)}`);

  // ---------------- 92) Giro Voraz, Braços de Ferro, Racha-Crânios ----------------
  out('92) Giro Voraz, Braços de Ferro e Racha-Crânios');
  fresh(); yield 0.1;
  give('w_mac2', 2);
  player.input = fake();
  player.combo = 1; player.startAttack(g.cam.camera);
  out(`  giro: invulnerável ${player.iframes.toFixed(1)} s ${ok(player.iframes >= 0.99 && player.invulnerable)}`);
  const hz = dummy(0, 0.8); hz.passive = false;
  player.hp = player.maxHp;
  combat.hitPlayer(hz, 20, { target: player });
  out(`  golpe no giro não machuca ${ok(player.hp === player.maxHp)}`);
  fresh(); yield 0.1;
  give('w_mac4', 2);
  const ex = dummy(0, 0.8, 'minion', 1000); ex.hp = 140; // golpe forte (~46) deixa com ~94 = 9,4%
  combat.playerStrike(player, C()[2]);
  out(`  Braços de Ferro ×2 (10%): executou ${ok(!ex.alive && ev('axeExecute').length === 1)}`);
  fresh(); yield 0.1;
  give('w_mac4');
  const ex2 = dummy(0, 0.8, 'minion', 1000); ex2.hp = 140;
  combat.playerStrike(player, C()[2]);
  out(`  ×1 (5%): ficou com ${ex2.hp} e não executou ${ok(ex2.alive && ev('axeExecute').length === 0)}`);
  fresh(); yield 0.1;
  give('w_mac5', 2);
  const vic = dummy(0, -2), n1 = dummy(1.5, -2.5), n2 = dummy(-1.4, -1.6), far = dummy(0, -8);
  vic.die(); combat.killed(vic, 0, 1, player);
  out(`  Racha-Crânios ×2: vizinhos paralisados 1 s ${ok(n1.state === 'hurt' && n2.state === 'hurt' && Math.abs(n1.stunTime - 1) < 0.01)} | longe não ${ok(far.state !== 'hurt')}`);

  // ---------------- 93) Redemoinho ----------------
  out('93) Redemoinho: o giro rebate projéteis');
  fresh(); yield 0.1;
  give('w_mac12');
  const arch = dummy(0, -7, 'archer');
  player.input = fake();
  player.combo = 1; player.startAttack(g.cam.camera);
  combat.projectiles.fire(0, -2, 0, { speed: 12, damage: 10, kind: 'arrow', owner: arch });
  yield* until(() => ev('axeReflect').length > 0, 1500);
  const hp0 = arch.hp;
  yield* until(() => arch.hp < hp0, 2000);
  out(`  flecha rebatida ${ok(ev('axeReflect').length === 1)} | acertou o arqueiro ${ok(arch.hp < 999, 999 - arch.hp)} | herói sem dano ${ok(player.hp === player.maxHp)}`);
  fresh(); yield 0.1;
  const arch2 = dummy(0, -7, 'archer');
  player.hp = player.maxHp;
  combat.projectiles.fire(0, -2, 0, { speed: 12, damage: 10, kind: 'arrow', owner: arch2 });
  yield* until(() => player.hp < player.maxHp, 1500);
  out(`  sem a bênção (parado): a flecha acerta ${ok(player.hp < player.maxHp)}`);

  // ---------------- 94) Arremesso Mortal ----------------
  out('94) Arremesso Mortal: 4º golpe joga o machado, que volta');
  fresh(); yield 0.1;
  give('w_mac13');
  out(`  combo de ${C().length} golpes ${ok(C().length === 4 && C()[3].kit === 'axeThrow' && C()[3].clip === 'Throw')}`);
  const t1 = dummy(0, -1.5), t2 = dummy(0.3, -5);
  player.input = fake({ attack: () => true, dodge: () => true });
  combat.playerStrike(player, C()[3]);
  out(`  machado na mão sumiu ${ok(player.axeAway && !player.weapon.visible)}`);
  yield 0.15;
  const p0 = player.position.clone();
  out(`  esperando: não ataca nem rola ${ok(player.state === 'idle')}`);
  yield 0.2;
  out('  -> machado voando (screenshot)');
  yield 'hold';
  yield* until(() => ev('axeCatch').length > 0, 3000);
  player.input = fake();
  const hitsT1 = ev('hit').filter((e) => e.enemy === t1).length, hitsT2 = ev('hit').filter((e) => e.enemy === t2).length;
  out(`  voltou para a mão ${ok(ev('axeCatch').length === 1 && !player.axeAway && player.weapon.visible)} | ficou parado ${ok(player.position.distanceTo(p0) < 0.05)} | cortou na ida e na volta ${ok(hitsT1 === 2 && hitsT2 === 2, `${hitsT1}/${hitsT2}`)}`);

  // ---------------- 95) Pião ----------------
  out('95) Pião: segurar o ataque no giro continua girando');
  fresh(); yield 0.1;
  give('w_mac14');
  const pz = dummy(0, 0.6);
  let held = true, mv = 0;
  player.input = fake({ attack: () => true, attackHeld: () => held, moveDir: (v) => v.set(mv, 0, 0) });
  player.combo = 1; player.startAttack(g.cam.camera);
  yield* until(() => player.state === 'spin', 3000);
  out(`  virou Pião ${ok(player.state === 'spin' && ev('axeTop').length === 1)}`);
  yield 1.5;
  out(`  continua girando ${ok(player.state === 'spin')} | acertou de novo a cada volta ${ok(ev('hit').filter((e) => e.enemy === pz).length >= 3, ev('hit').filter((e) => e.enemy === pz).length)}`);
  const x0 = player.position.x; mv = 1;
  yield 1;
  const walked = player.position.x - x0;
  out(`  anda devagar: ${walked.toFixed(1)} em 1 s ${ok(walked > 0.8 && walked < player.hero.moveSpeed * 0.6, `normal ${player.hero.moveSpeed}`)}`);
  mv = 0;
  out('  -> Pião (screenshot)');
  yield 'hold';
  held = false; player.input = fake({ attackHeld: () => false });
  yield* until(() => player.state === 'attack', 1500);
  out(`  soltou: sai a machadada forte ${ok(player.state === 'attack' && C()[player.combo].heavy)}`);
  fresh(); yield 0.1;
  player.input = fake({ attack: () => true, attackHeld: () => true });
  player.combo = 1; player.startAttack(g.cam.camera);
  yield* until(() => player.combo === 2, 3000);
  out(`  sem a bênção: giro -> machadada normal ${ok(player.combo === 2 && player.state === 'attack')}`);

  // ---------------- 96) Tornado e Giro Crescente ----------------
  out('96) Tornado e Giro Crescente');
  fresh(); yield 0.1;
  give('w_mac15');
  const fz = dummy(4.5, 2), fb = dummy(-4.6, 2);
  const d0t = Math.hypot(fz.position.x - player.position.x, fz.position.z - player.position.z);
  combat.playerStrike(player, giro());
  yield 0.5;
  const d1t = Math.hypot(fz.position.x - player.position.x, fz.position.z - player.position.z);
  out(`  Tornado: puxou ${d0t.toFixed(1)} -> ${d1t.toFixed(1)} ${ok(d1t < d0t - 1.5)} | o outro lado também ${ok(Math.abs(fb.position.x) < 3.5)}`);
  fresh(); yield 0.1;
  give('w_mac16');
  const gr = [dummy(-1, 1.2), dummy(1, 1.2), dummy(0, 3), dummy(1.5, 2.8)];
  const r0 = giro();
  combat.playerStrike(player, r0);
  const far2 = dummy(0, 2 + player.hero.attackRange + 0.5);
  const grow = 1 + Math.min(AXE.grow.max, 4 * AXE.grow.per);
  combat.playerStrike(player, r0);
  out(`  Giro Crescente: 4 acertados -> giro ×${grow.toFixed(2)} ${ok(player.axeGrow >= 4)} | alcançou um que antes não pegava ${ok(far2.hp < 999)}`);
  combat.axe.roomStart();
  out(`  sala nova: volta ao normal ${ok(player.axeGrow === 0)}`);

  // ---------------- 97) Rolagem Giratória ----------------
  out('97) Rolagem Giratória');
  fresh(); yield 0.1;
  give('w_mac17');
  const rr = [dummy(-1.5, 0.5), dummy(1.5, 0.5), dummy(0, -1.5)];
  player.input = fake({ moveDir: (v) => v.set(0, 0, -1) });
  player.startDodge();
  yield 0.12;
  out('  -> girando no rolamento (screenshot)');
  yield 'hold';
  yield* until(() => player.state !== 'dodge', 1500);
  const nRoll = ev('axeRollHit').length;
  out(`  cortou ${nRoll} em volta ${ok(nRoll >= 2)} | cada um 1 vez ${ok(new Set(ev('axeRollHit').map((e) => e.enemy)).size === nRoll)} | voltou em pé ${ok(player.model.rotation.y === 0 && player.model.rotation.x === 0)}`);

  // ---------------- 98) Todas juntas ----------------
  out('98) Machado: todas as bênçãos juntas (sem erro)');
  fresh(); yield 0.1;
  for (const b of mine) for (let k = 0; k < b.max; k++) player.addBlessing(b);
  for (let i = 0; i < 5; i++) dummy(-1.2 + i * 0.6, 0.4 - (i % 2) * 0.6, i === 2 ? 'warrior' : 'minion', 300);
  const errs0 = (window.__game.errors || []).length;
  player.iframes = 99;
  let swings = 0;
  try {
    for (let t = 0; t < 12; t++) { combat.playerStrike(player, C()[t % C().length]); swings++; yield 0.15; }
  } catch (e) { out(`  ERRO ${e.message}`); }
  yield* until(() => !player.axeAway, 3000);
  player.input = fake({ moveDir: (v) => v.set(1, 0, 0) }); player.dodgeCooldown = 0; player.startDodge(); yield 0.5;
  out(`  ${swings} golpes ${ok(swings === 12 && (window.__game.errors || []).length === errs0)} | machado de volta ${ok(!player.axeAway && player.weapon.visible)}`);
  player.iframes = 0;
  fresh();
}
