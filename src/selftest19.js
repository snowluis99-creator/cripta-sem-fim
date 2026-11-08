// Teste automático, parte 19 (06/11/2026): bênçãos do Mangual (lista do dono).
// Tecla Y = tudo; tecla \ (barra invertida) = só o Mangual.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { wbDamage } from './wbhooks.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* flailTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const cam = g.cam.camera;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('knight', 'mangual'); player.reset(0, 2); player.facing = Math.PI;
    clearStrip(-5, 5, -12, 4);
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion', hp = 999) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const once = () => { let n = 1; return () => (n-- > 0); };
  const C = () => player.hero.combo;
  const dist = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
  const front = (d = 1.5) => ({ position: { x: player.position.x + Math.sin(player.facing) * d, y: 0, z: player.position.z + Math.cos(player.facing) * d }, alive: false, data: { boss: true } });

  // ---------------- 117) Lista ----------------
  out('117) Mangual: bênçãos do dono');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'knight.mangual');
  const by = (n) => mine.find((b) => b.name === n) || {};
  const want = ['Corrente Enroscada', 'Pancada Atordoante', 'Rodopio', 'Esmaga-Guarda', 'Equilíbrio', 'Reflexo', 'Impacto Sísmico', 'Corrente', 'Estrela da Manhã'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  out(`  ${mine.length} bênçãos ${ok(mine.length === 9)} | as 9 da lista ${ok(!miss.length, miss.join(', '))}`);
  out(`  raridades ${ok(by('Corrente Enroscada').rarity === 'common' && by('Rodopio').rarity === 'common' && by('Equilíbrio').rarity === 'rare' && by('Reflexo').rarity === 'rare' && by('Impacto Sísmico').rarity === 'epic' && by('Corrente').rarity === 'epic' && by('Estrela da Manhã').rarity === 'legendary')} | máximos ${ok(by('Pancada Atordoante').max === 3 && by('Rodopio').max === 1 && by('Impacto Sísmico').max === 3)}`);

  // ---------------- 118) Estrela da Manhã ----------------
  out('118) Estrela da Manhã: 1º e 2º golpe atordoam 1 s');
  fresh(); yield 0.1;
  const s0 = dummy(0, 0.6);
  combat.playerStrike(player, C()[0]);
  out(`  sem a bênção: não atordoa ${ok(!ev('flailStar').length)}`);
  fresh(); yield 0.1;
  give('w_man10');
  const s1 = dummy(0, 0.6);
  combat.playerStrike(player, C()[0]);
  const st1 = s1.state === 'hurt' ? s1.stunTime : 0;
  yield 0.6;
  out(`  1º golpe atordoou ${ok(ev('flailStar').length === 1 && Math.abs(st1 - 1) < 0.05, st1.toFixed(2))} | ainda atordoado em 0,6 s ${ok(s1.state === 'hurt')}`);
  combat.playerStrike(player, C()[1]);
  out(`  2º golpe também ${ok(ev('flailStar').length === 2)}`);
  combat.playerStrike(player, C()[2]);
  out(`  golpe forte não conta ${ok(ev('flailStar').length === 2)}`);
  void s0;

  // ---------------- 119) Pancada Atordoante soma ----------------
  out('119) Pancada Atordoante + Estrela da Manhã');
  fresh(); yield 0.1;
  give('w_man10'); give('w_man3', 3);
  const s2 = dummy(0, 0.6);
  combat.playerStrike(player, C()[0]);
  out(`  atordoa 90% mais (1,9 s) ${ok(Math.abs(s2.stunTime - 1.9) < 0.05, s2.stunTime.toFixed(2))}`);

  // ---------------- 120) Impacto Sísmico ----------------
  out('120) Impacto Sísmico: golpe forte marca (6 s)');
  fresh(); yield 0.1;
  give('w_man8', 2);
  const m1 = dummy(-0.8, 0.6), m2 = dummy(0.8, 0.6);
  combat.playerStrike(player, C()[0]);
  out(`  golpe fraco não marca ${ok(!(m1.markT > 0))}`);
  combat.playerStrike(player, C()[2]);
  const mul = wbDamage(player, m1, C()[0], {}).mul;
  out(`  os 2 marcados ${ok(m1.markT > 5.9 && m2.markT > 5.9)} | +50% de dano (2 níveis) ${ok(Math.abs(mul - 1.5) < 0.01, mul.toFixed(2))} | anel no chão ${ok(ev('flailMark').length === 2)}`);
  out('  -> marcados (screenshot)');
  yield 'hold';
  yield 6.5;
  const mulEnd = wbDamage(player, m1, C()[0], {}).mul;
  out(`  passou 6 s: acabou ${ok(!(m1.markT > 0) && Math.abs(mulEnd - 1) < 0.01, `${(m1.markT || 0).toFixed(2)} ${mulEnd.toFixed(2)} ${m1.state}`)}`);

  // ---------------- 121) Corrente Enroscada (enterra 1,5 s, pedido do dono 07/11) ----------------
  out('121) Corrente Enroscada: enterra o mais distante do 3º golpe');
  fresh(); yield 0.1;
  give('w_man11');
  const near = dummy(0, 0.8), far = dummy(1.5, -1.0);
  combat.playerStrike(player, C()[0]);
  out(`  golpe fraco não enterra ${ok(!ev('flailSnare').length)}`);
  yield 1.2;
  combat.playerStrike(player, C()[2]);
  const sn = ev('flailSnare');
  out(`  enterrou o mais distante ${ok(sn.length === 1 && sn[0].enemy === far, sn.length ? dist(player, sn[0].enemy).toFixed(1) : '-')} | o de perto não ${ok(!sn.some((x) => x.enemy === near))} | parado ${ok(far.state === 'hurt' && far.stunTime >= 1.45)}`);
  yield 0.3;
  out(`  afundou no chão ${ok(far.model.position.y < -0.5, far.model.position.y.toFixed(2))}`);
  out('  -> enterrado (screenshot)');
  yield 'hold';
  yield 0.9;
  out(`  aos 1,2 s ainda enterrado ${ok(far.model.position.y < -0.3 && far.state === 'hurt')}`);
  yield 0.6;
  out(`  aos 1,8 s saiu do chão ${ok(far.model.position.y === 0)}`);

  // ---------------- 122) Rodopio ----------------
  out('122) Rodopio: golpes destroem flechas e magias');
  const shot = () => combat.projectiles.fire(0, -1.0, 0, { speed: 0.01, damage: 10, kind: 'arrow', owner: null, silent: true });
  fresh(); yield 0.1;
  shot(); const n0 = combat.projectiles.list.length;
  combat.playerStrike(player, C()[0]);
  out(`  sem a bênção: a flecha fica ${ok(combat.projectiles.list.length === n0 && n0 === 1)}`);
  fresh(); yield 0.1;
  give('w_man4');
  shot(); shot();
  combat.playerStrike(player, C()[0]);
  out(`  com Rodopio: destruiu ${ok(combat.projectiles.list.length === 0)}`);
  combat.projectiles.fire(0, 6, 0, { speed: 0.01, damage: 10, kind: 'arrow', owner: null, silent: true }); // atrás e longe
  combat.playerStrike(player, C()[0]);
  out(`  flecha longe fica ${ok(combat.projectiles.list.length === 1)}`);
  combat.projectiles.clear();

  // ---------------- 123) Equilíbrio ----------------
  out('123) Equilíbrio: atacar defendendo');
  fresh(); yield 0.1;
  player.input = fake({ blocking: () => true });
  yield 0.2;
  player.input = fake({ blocking: () => true, attack: once() });
  yield 0.1;
  out(`  sem a bênção: o bloqueio corta o golpe ${ok(player.state === 'block')}`);
  fresh(); yield 0.1;
  give('w_man12');
  player.input = fake({ blocking: () => true });
  yield 0.2;
  player.input = fake({ blocking: () => true, attack: once() });
  yield 0.1;
  const hpE = player.hp;
  const hitE = combat.hitPlayer(front(), 20, { target: player });
  out(`  atacando ${ok(player.state === 'attack' && player.guardAtk)} | defendeu de frente ${ok(hitE && player.hp === hpE)} | golpe continuou ${ok(player.state === 'attack')}`);
  player.iframes = 0;
  const back = { position: { x: player.position.x - Math.sin(player.facing) * 1.5, y: 0, z: player.position.z - Math.cos(player.facing) * 1.5 }, alive: false, data: { boss: true } };
  combat.hitPlayer(back, 7, { target: player });
  out(`  pelas costas toma dano ${ok(player.hp < hpE)}`);
  yield* until(() => player.state === 'block', 1500);
  out(`  depois do golpe volta a bloquear ${ok(player.state === 'block')}`);
  player.input = fake(); yield 0.2;

  // ---------------- 124) Reflexo (novo, pedido do dono 07/11) ----------------
  out('124) Reflexo: bloqueou -> lança a bola no inimigo mais distante');
  fresh(); yield 0.1;
  give('w_man13');
  const side = dummy(1.6, 2.0, 'minion', 999); // perto
  const farR = dummy(0.5, -7.5, 'minion', 999); // o mais distante
  player.input = fake({ blocking: () => true });
  yield 0.2;
  player.iframes = 0;
  const hpR = player.hp;
  combat.hitPlayer(front(), 20, { target: player });
  yield 0.15;
  const want2 = Math.atan2(farR.position.x - player.position.x, farR.position.z - player.position.z);
  const da = Math.abs(Math.atan2(Math.sin(player.facing - want2), Math.cos(player.facing - want2)));
  out(`  atacou sozinho ${ok(player.state === 'attack' && player.xstep && player.xstep.kit === 'flailLash')} | virado para o mais distante ${ok(da < 0.15, da.toFixed(2))} | sem dano no bloqueio ${ok(player.hp === hpR)}`);
  player.iframes = 0;
  combat.hitPlayer(back.position ? { position: { x: player.position.x - 1, y: 0, z: player.position.z }, alive: false, data: { boss: true } } : back, 20, { target: player });
  out(`  invulnerável durante o golpe ${ok(player.hp === hpR && player.invulnerable)}`);
  const hpF = farR.hp, hpS = side.hp;
  yield* until(() => ev('flailLash').length > 0, 1500);
  yield 0.1;
  const fl = player.weapon && player.weapon.userData.flail;
  const ballD = fl && fl.pos ? Math.hypot(fl.pos.x - player.position.x, fl.pos.z - player.position.z) : 0;
  out(`  bola lançada longe ${ok(ballD > 3, ballD.toFixed(1))}`);
  out('  -> corrente esticada até o inimigo (screenshot)');
  yield 'hold';
  yield* until(() => farR.hp < hpF, 800);
  out(`  acertou o mais distante ${ok(farR.hp < hpF)} | o de perto não ${ok(side.hp === hpS)}`);
  yield* until(() => player.state !== 'attack', 1500);
  player.input = fake();
  yield 0.3;
  const ballBack = fl && fl.pos ? Math.hypot(fl.pos.x - player.position.x, fl.pos.z - player.position.z) : 9;
  out(`  bola voltou ${ok(ballBack < 2, ballBack.toFixed(1))} | ainda sem dano depois (1 s) ${ok(player.invulnerable && player.iframes > 0.2, player.iframes.toFixed(2))}`);
  const hpA = player.hp;
  combat.hitPlayer(front(), 20, { target: player });
  out(`  golpe logo depois não machuca ${ok(player.hp === hpA)}`);
  yield 1.2;
  out(`  passou: volta a levar dano ${ok(!player.invulnerable)}`);

  // ---------------- 125) Corrente ----------------
  out('125) Corrente: defendeu flecha -> puxa quem atirou');
  fresh(); yield 0.1;
  give('w_man14');
  const archer = combat.spawn('archer', 0, -9, { awake: true, passive: true, facing: 0 }); archer.hp = archer.maxHp = 999;
  player.input = fake({ blocking: () => true });
  yield 0.2;
  const d0 = dist(player, archer);
  combat.projectiles.fire(0, 0.2, 0, { speed: 14, damage: 8, kind: 'arrow', owner: archer, silent: true });
  yield 0.15;
  out(`  defendeu ${ok(ev('blockedHero').length >= 1 && player.hp === player.maxHp)} | corrente lançada ${ok(ev('flailChain').length === 1 && combat.kit.hooks.length === 1)}`);
  yield 0.25;
  out('  -> corrente indo no arqueiro (screenshot)');
  yield 'hold';
  yield* until(() => combat.kit.hooks.length === 0, 2500);
  out(`  puxou para perto ${ok(dist(player, archer) < 2.6, `${d0.toFixed(1)} -> ${dist(player, archer).toFixed(1)}`)} | atordoado ${ok(archer.state === 'hurt')}`);
  fresh(); yield 0.1;
  const archer2 = combat.spawn('archer', 0, -9, { awake: true, passive: true, facing: 0 });
  player.input = fake({ blocking: () => true });
  yield 0.2;
  combat.projectiles.fire(0, 0.2, 0, { speed: 14, damage: 8, kind: 'arrow', owner: archer2, silent: true });
  yield 0.3;
  out(`  sem a bênção: não puxa ${ok(!ev('flailChain').length && combat.kit.hooks.length === 0)}`);
  player.input = fake(); yield 0.1;

  // ---------------- 126) Todas juntas ----------------
  out('126) Mangual: as 9 bênçãos juntas (sem erro)');
  fresh(); yield 0.1;
  for (const b of mine) for (let k = 0; k < b.max; k++) player.addBlessing(b);
  for (let i = 0; i < 5; i++) dummy(-1.2 + i * 0.6, 0.4 - (i % 2) * 0.6, i === 2 ? 'warrior' : 'minion', 300);
  const errs0 = (window.__game.errors || []).length;
  player.iframes = 99;
  let swings = 0;
  try {
    for (let t = 0; t < 9; t++) { combat.playerStrike(player, C()[t % C().length]); swings++; yield 0.15; }
    player.iframes = 0;
    player.input = fake({ blocking: () => true }); yield 0.2;
    combat.hitPlayer(front(), 10, { target: player }); yield 0.8;
    for (const e of [...combat.enemies]) if (e.alive) { e.die(); combat.killed(e, 0, 1, player); }
    yield 0.5;
  } catch (e) { out(`  ERRO ${e.message}`); }
  out(`  ${swings} golpes ${ok(swings === 9 && (window.__game.errors || []).length === errs0)}`);
  player.iframes = 0;
  fresh();
}
