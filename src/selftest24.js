// Teste automático, parte 24 (06/11/2026): bênçãos novas (fáceis) do Cajado das Trevas.
// Tecla Y = tudo; tecla / = só o Cajado das Trevas.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { markDark, undeadHit, undeadDied } from './undead.js';
import { dark2Tests } from './selftest25.js';
import { darkHoldCheck, darkRoomClear, darkCarryOut, darkCarryIn } from './darkkit.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* darkTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('mage', 'trevas'); player.reset(0, 2); player.facing = Math.PI;
    clearStrip(-10, 10, -14, 8);
    player.input = fake();
    player.iframes = 0;
    flags.events.length = 0;
  };
  const give = (id) => player.addBlessing(BLESSINGS.find((x) => x.id === id));
  const dummy = (x, z, type = 'minion', hp = 999) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; return e; };
  const raise = (x, z, hp = 30) => (combat.raising || (combat.raising = [])).push({ type: 'minion', x, z, t: 0, owner: player, hpScale: 1, dmgScale: 1, facing: Math.PI, hp });
  const undead = () => combat.enemies.filter((u) => u.undead && u.alive);
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const face = (e) => { player.facing = Math.atan2(e.position.x - player.position.x, e.position.z - player.position.z); player.group.rotation.y = player.facing; };
  const C = () => player.hero.combo;
  const cast = (i = 0) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const errs0 = (window.__game.errors || []).length;

  out('215) Cajado das Trevas: bênçãos do dono (fáceis)');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'mage.trevas');
  const want = ['Tambores de Guerra', 'Praga', 'Dízimo', 'Banquete', 'Pacto de Sangue Sombrio', 'Rei dos Mortos'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  const by = (n) => mine.find((b) => b.name === n) || {};
  out(`  ${mine.length} bênçãos (6 + 6 + 14) ${ok(mine.length === 26)} | as 6 ${ok(!miss.length, miss.join(', '))} | Rei lendária ${ok(by('Rei dos Mortos').rarity === 'legendary')} | Dízimo x Rei ${ok((by('Dízimo').excludes || []).includes('w_tre16'))}`);

  out('216) Tambores de Guerra: golpe forte = todos os mortos-vivos atacam');
  fresh(); yield 0.1; give('w_tre11');
  const t1 = dummy(0, -5);
  raise(-3, -1); raise(3, -1);
  yield 2.0;
  const us = undead();
  for (const u of us) { u.cooldown = 99; if (u.state === 'attack') u.endAttack(); }
  face(t1); cast(C().findIndex((c) => c.heavy));
  out(`  2 mortos-vivos ${ok(us.length === 2)} | os dois atacando ${ok(us.length && us.every((u) => u.state === 'attack'), us.map((u) => u.state).join(','))} | evento ${ok(ev('darkDrums').length === 1)}`);
  yield 0.6;

  out('217) Praga: a marca passa adiante');
  fresh(); yield 0.1; give('w_tre12');
  const pa = dummy(0, -2, 'minion', 5), pb = dummy(2, -2.5), pc = dummy(-8, -8);
  markDark(combat, player, pa);
  combat.bonusDamage(pa, 50, 0, -1, 'dmg', player);
  out(`  morreu ${ok(!pa.alive)} | o mais perto ficou marcado ${ok(pb.darkMark === player)} | o longe não ${ok(!pc.darkMark)}`);
  yield 1.5;
  out(`  o marcado levantou aliado ${ok(undead().length === 1)}`);

  out('218) Banquete: morto-vivo derruba = +2 de vida');
  fresh(); yield 0.1; give('w_tre14');
  raise(0, -1); yield 1.5;
  const bu = undead()[0], bt = dummy(1, -1.5, 'minion', 3);
  player.hp = player.maxHp - 10;
  const h0 = player.hp;
  if (bu) undeadHit(combat, bu, bt, 10);
  out(`  inimigo caiu ${ok(!bt.alive)} | curou 2 ${ok(player.hp === h0 + 2, `${h0} → ${player.hp}`)}`);

  out('219) Pacto de Sangue Sombrio: segurar o ataque = 8 de vida por um esqueleto');
  fresh(); yield 0.1; give('w_tre15');
  player.hp = 50;
  player.stateTime = 0.5;
  darkHoldCheck(player, fake({ attackHeld: () => true }));
  darkHoldCheck(player, fake({ attackHeld: () => true })); // recarga: não gasta de novo
  out(`  gastou 8 só uma vez ${ok(player.hp === 42, player.hp)}`);
  yield 1.2;
  const bl = undead();
  out(`  levantou 1 esqueleto ${ok(bl.length === 1)} | com 10 de vida ${ok(bl[0] && bl[0].hp === 10, bl[0] && bl[0].hp)}`);
  player.hp = 6; player.dBloodCd = 0;
  darkHoldCheck(player, fake({ attackHeld: () => true }));
  out(`  com pouca vida não gasta ${ok(player.hp === 6)}`);
  yield 0.3;

  out('220) Dízimo: sobra de mortos-vivos vira vida');
  fresh(); yield 0.1; give('w_tre13');
  raise(-1, -1); raise(1, -1); yield 1.5;
  player.hp = player.maxHp - 20;
  const d0 = player.hp;
  darkRoomClear(combat, (u) => { u.die(); undeadDied(combat, u); });
  out(`  curou 8 (2 × 4) ${ok(player.hp === d0 + 8, `${d0} → ${player.hp}`)} | sumiram ${ok(undead().length === 0)}`);
  yield 0.5;

  out('221) Rei dos Mortos: não desmoronam e vão para a sala seguinte');
  fresh(); yield 0.1; give('w_tre16');
  raise(-1, -1, 7); raise(1, -1, 7); yield 1.2;
  yield 5; // sala vazia: normalmente desmoronariam em 3,5 s
  out(`  continuam de pé ${ok(undead().length === 2)}`);
  const carry = darkCarryOut(combat);
  combat.clear();
  darkCarryIn(combat, carry);
  yield 1.5;
  const cu = undead();
  out(`  vieram 2 ${ok(carry.length === 2 && cu.length === 2)} | com a mesma vida ${ok(cu.every((u) => u.hp === 7))} | na sala seguinte não vão de novo ${ok(darkCarryOut(combat).length === 0)}`);
  darkRoomClear(combat, (u) => { u.die(); undeadDied(combat, u); });
  out(`  desmoronam no fim dessa sala ${ok(undead().length === 0)}`);

  out('222) Cajado das Trevas com todas: sem erros');
  fresh(); yield 0.1;
  for (const b of mine) if (b.id !== 'w_tre13') for (let k = 0; k < b.max; k++) player.addBlessing(b);
  const all = [];
  for (let i = 0; i < 5; i++) all.push(dummy(-2 + i, -2 - (i % 2), 'minion', 12));
  raise(0, 0); player.iframes = 99;
  for (let t = 0; t < 15; t++) { face(all[t % 5]); cast(t % 3); yield 0.3; }
  yield 2;
  player.iframes = 0;
  const errs = (window.__game.errors || []).length - errs0;
  out(`  sem erros do jogo ${ok(errs === 0, errs)}`);
  player.input = realInput;
  yield* dark2Tests(g, out, flags); // médias e difíceis (selftest25.js)
}
