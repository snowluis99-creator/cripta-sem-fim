// Teste automático, parte 18 (06/11/2026): bênçãos do Machado, 3ª leva (lista do dono).
// Tecla Y = tudo; tecla - (menos) = Machado inteiro (partes 16 e 18).
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { AXE3, PUNCHES, axe3Press } from './axekit3.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* axe3Tests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const cam = g.cam.camera;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('knight', 'machado'); player.reset(0, 2); player.facing = Math.PI;
    clearStrip(-4, 4, -9, 4);
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion', hp = 999) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const once = () => { let n = 1; return () => (n-- > 0); }; // aperta o ataque 1 vez
  const C = () => player.hero.combo;
  const dist = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);

  // ---------------- 106) Lista ----------------
  out('106) Machado: 3ª leva de bênçãos');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'knight.machado');
  const want = ['Imparável', 'Investida Bruta', 'Arrastar a Lâmina', 'Grito de Guerra', 'Maestria', 'Machado como Escudo', 'Arremesso Serra', 'Futebol de Crânio', 'Machado Faminto'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  const rar = (n) => mine.find((b) => b.name === n)?.rarity;
  out(`  ${mine.length} bênçãos ${ok(mine.length === 27)} | as 9 novas ${ok(!miss.length, miss.join(', '))} | raridades ${ok(rar('Imparável') === 'epic' && rar('Investida Bruta') === 'rare' && rar('Arremesso Serra') === 'legendary' && rar('Futebol de Crânio') === 'rare' && rar('Machado Faminto') === 'epic' && rar('Grito de Guerra') === 'legendary')}`);

  // ---------------- 107) Imparável ----------------
  out('107) Imparável');
  fresh(); yield 0.1;
  const hitter = dummy(0, 0.6); hitter.passive = false;
  player.input = fake();
  player.combo = 1; player.startAttack(cam); yield 0.05;
  combat.hitPlayer(hitter, 20, { target: player });
  out(`  sem a bênção: golpe no giro interrompe ${ok(player.state === 'hurt')}`);
  fresh(); yield 0.1;
  give('w_mac25');
  const hit2 = dummy(0, 0.6); hit2.passive = false;
  player.input = fake();
  player.combo = 1; player.startAttack(cam); yield 0.05;
  player.iframes = 0; combat.hitPlayer(hit2, 20, { target: player });
  out(`  giro: levou o dano ${ok(player.hp < player.maxHp)} | continuou girando ${ok(player.state === 'attack' && player.combo === 1)}`);
  player.combo = 2; player.startAttack(cam); yield 0.05;
  const hp0 = player.hp; player.iframes = 0;
  combat.hitPlayer(hit2, 20, { target: player });
  out(`  machadada forte: não para ${ok(player.state === 'attack' && player.combo === 2 && player.hp < hp0)} | sem desequilibrar ${ok(!player.staggerBack(0, 1, 0.6, 5))}`);
  fresh(); yield 0.1;
  give('w_mac25');
  const bump = combat.spawn('minion', 0, 2.5, { awake: true, facing: Math.PI }); bump.hp = bump.maxHp = 999;
  player.input = fake();
  player.combo = 1; player.startAttack(cam);
  const hpB = player.hp, d0 = dist(player, bump);
  yield 0.25;
  out(`  quem encosta é empurrado ${ok(dist(player, bump) > d0 + 0.3, `${d0.toFixed(1)} -> ${dist(player, bump).toFixed(1)}`)} | sem machucar ${ok(player.hp === hpB)}`);
  out('  -> girando imparável (screenshot)');
  yield 'hold';

  // ---------------- 108) Investida Bruta (nova, 06/11) ----------------
  out('108) Investida Bruta: rolar por dentro de esqueleto com escudo');
  fresh(); yield 0.1;
  give('w_mac26');
  const bw = combat.spawn('warrior', 0, -2.2, { awake: true, passive: true, facing: 0 }); bw.hp = bw.maxHp = 999;
  const bm = dummy(1.2, -2.2); // sem escudo
  player.input = fake({ moveDir: (v) => v.set(0.25, 0, -1) });
  player.dodgeCooldown = 0; player.startDodge();
  yield* until(() => player.state !== 'dodge', 1500);
  player.input = fake();
  const rb = ev('axeRollBash');
  out(`  atordoou o do escudo ${ok(rb.some((x) => x.enemy === bw) && bw.state === 'hurt')} | sem escudo nada ${ok(!rb.some((x) => x.enemy === bm))} | 1 vez só ${ok(rb.length === 1)}`);
  out('  -> esqueleto atordoado (screenshot)');
  yield 'hold';
  yield 1.2;
  out(`  ainda parado depois de 1,5 s ${ok(bw.state === 'hurt')}`);
  yield* until(() => bw.state !== 'hurt', 1500);
  out(`  voltou depois de ~2 s ${ok(bw.state !== 'hurt')}`);

  // ---------------- 109) Arrastar a Lâmina ----------------
  out('109) Arrastar a Lâmina');
  fresh(); yield 0.1;
  give('w_mac27');
  player.input = fake({ attack: once(), attackHeld: () => false });
  yield 0.4;
  out(`  toque rápido: golpe normal ${ok(player.state === 'attack' && ev('axeHold').length === 0)}`);
  fresh(); yield 0.1;
  give('w_mac27');
  let held = true;
  player.position.set(-2.5, 0, -1);
  player.input = fake({ attack: once(), attackHeld: () => held, moveDir: (v) => v.set(1, 0, 0) });
  yield 0.35;
  out(`  segurando: arrasta ${ok(player.state === 'axeHold' && player.axeHold.mode === 'drag')}`);
  yield 0.9;
  out('  -> arrastando o machado (screenshot)');
  yield 'hold';
  yield 1.3;
  out(`  força cheia ${ok(player.axeHold && player.axeHold.charge >= AXE3.drag.full)}`);
  const ex1 = dummy(player.position.x + 1.6, player.position.z + 1.2), ex2 = dummy(player.position.x + 1.8, player.position.z - 1.4);
  player.facing = Math.PI / 2;
  player.input = fake({ attackHeld: () => false });
  held = false;
  yield* until(() => ev('axeDragBlast').length > 0, 2000);
  const bl = ev('axeDragBlast')[0];
  out(`  soltou: machadada explode ${ok(bl && bl.k >= 1 && bl.n >= 2, bl ? `${bl.dmg} de dano` : '')} | acertou os dois ${ok(ex1.hp < 999 && ex2.hp < 999)}`);
  yield 0.05;
  out('  -> explosão (screenshot)');
  yield 'hold';

  // ---------------- 110) Machado como Escudo ----------------
  out('110) Machado como Escudo');
  fresh(); yield 0.1;
  give('w_mac30');
  player.input = fake({ attack: once(), attackHeld: () => true, aimAngle: () => Math.PI });
  yield 0.4;
  out(`  segurando parado: guarda ${ok(player.state === 'axeHold' && player.axeHold.mode === 'guard')}`);
  const hpG = player.hp;
  combat.projectiles.fire(player.position.x, player.position.z - 5, 0, { speed: 16, damage: 10, kind: 'arrow', hits: 'player' });
  combat.projectiles.fire(player.position.x + 0.3, player.position.z - 6, 0, { speed: 14, damage: 10, kind: 'orb', hits: 'player' });
  yield 0.12;
  out('  -> lâmina na frente (screenshot)');
  yield 'hold';
  yield* until(() => ev('axeGuard').length >= 2, 1500);
  out(`  segurou flecha e magia ${ok(ev('axeGuard').length === 2 && player.hp === hpG)}`);
  combat.projectiles.fire(player.position.x, player.position.z + 5, Math.PI, { speed: 16, damage: 10, kind: 'arrow', hits: 'player' });
  yield* until(() => player.hp < hpG, 1500);
  out(`  pelas costas entra ${ok(player.hp < hpG)}`);

  // ---------------- 111) Grito de Guerra ----------------
  out('111) Grito de Guerra');
  fresh(); yield 0.1;
  give('w_mac28');
  const f1 = dummy(1.5, -0.5), f2 = dummy(-1.8, 0.5), far = dummy(0, -13);
  for (let i = 0; i < 2; i++) { const k = dummy(3, 4 + i); k.die(); combat.killed(k, 0, 1, player); }
  out(`  2 abates: nada ${ok(ev('axeWarcry').length === 0)}`);
  yield 3.8;
  const k3 = dummy(3, 6); k3.die(); combat.killed(k3, 0, 1, player);
  out(`  3º abate depois de 3,8 s: não conta ${ok(ev('axeWarcry').length === 0)}`);
  for (let i = 0; i < 2; i++) { const k = dummy(-3, 4 + i); k.die(); combat.killed(k, 0, 1, player); }
  out(`  3 seguidos: grito ${ok(ev('axeWarcry').length === 1)} | perto fogem ${ok(f1.state === 'axeFear' && f2.state === 'axeFear')} | longe não ${ok(far.state !== 'axeFear')}`);
  out(`  largaram as armas ${ok(!!f1.warDrop && f1.warDrop.items.length > 0 && f1.warDrop.items.every((it) => it.obj.parent === combat.scene))} | longe continua armado ${ok(!far.warDrop)}`);
  const fd1 = dist(player, f1);
  yield 0.8;
  out(`  correndo para longe ${ok(dist(player, f1) > fd1 + 1, `${fd1.toFixed(1)} -> ${dist(player, f1).toFixed(1)}`)}`);
  out('  -> fugindo sem arma, arma no chão (screenshot)');
  yield 'hold';
  // sem arma, encostar não machuca
  const hpW = player.hp; f2.abilities = true; f2.position.set(player.position.x + 0.5, 0, player.position.z); yield 0.1;
  out(`  sem arma não machuca no esbarrão ${ok(player.hp === hpW)}`);
  // Fugindo encurralado não fica indo e voltando na parede (bug relatado pelo dono 07/11).
  let flips = 0, prevD = null, inWall = false;
  let lx = f1.position.x, lz = f1.position.z;
  for (let i = 0; i < 40; i++) {
    yield 0.1;
    const dx = f1.position.x - lx, dz = f1.position.z - lz, m = Math.hypot(dx, dz);
    lx = f1.position.x; lz = f1.position.z;
    if (combat.world.blocked(f1.position.x, f1.position.z, f1.data.radius * 0.8)) inWall = true;
    if (m < 0.02) continue;
    if (prevD && (dx * prevD[0] + dz * prevD[1]) / m < -0.5) flips++;
    prevD = [dx / m, dz / m];
  }
  out(`  fuga sem tremer na parede ${ok(flips <= 2, `${flips} meias-voltas`)} | não entra na parede ${ok(!inWall)}`);
  out(`  aos 5 s ainda sem arma ${ok(!!f1.warDrop && f1.state === 'axeFear')}`);
  yield* until(() => f1.state === 'axeFetch', 2000);
  out(`  depois de 6 s vai buscar ${ok(f1.state === 'axeFetch')}`);
  yield* until(() => !f1.warDrop, 8000);
  const rearmed = f1.weapons.some((w) => w.parent && w.parent !== combat.scene);
  out(`  pegou a arma de volta ${ok(!f1.warDrop && rearmed && ev('axeRearm').some((x) => x.enemy === f1))}`);
  f2.die(); combat.killed(f2, 0, 1, player); yield 0.05;
  out(`  quem morre sem arma: a arma some do chão ${ok(!combat.axe3.dropped.some((d) => d.e === f2))}`);

  // ---------------- 112) Maestria (no lugar da Pancada de Cabo, pedido do dono 07/11) ----------------
  out('112) Maestria: 1º golpe depois de rolar 2× mais rápido');
  fresh(); yield 0.1;
  give('w_mac29');
  const base = player.atkSpeed;
  let atk = false;
  player.input = fake({ moveDir: (v) => v.set(0, 0, -1), attack: () => atk });
  player.dodgeCooldown = 0; player.startDodge();
  yield 0.2; atk = true; yield 0.05; atk = false;
  player.input = fake();
  yield* until(() => player.state !== 'dodge', 1000);
  out(`  atacou no fim do rolamento: golpe normal do combo ${ok(player.state === 'attack' && !player.xstep && player.combo === 0)} | evento ${ok(ev('axeMaestry').length === 1)}`);
  out(`  2× mais rápido ${ok(player.maestry && Math.abs(player.atkSpeed - base * 2) < 0.01, player.atkSpeed.toFixed(2))}`);
  player.input = fake({ attack: () => true });
  yield* until(() => player.combo === 1, 2000);
  player.input = fake();
  out(`  o 2º golpe volta ao normal ${ok(player.combo === 1 && !player.maestry && Math.abs(player.atkSpeed - base) < 0.01)}`);
  fresh(); yield 0.1;
  give('w_mac29');
  player.input = fake({ attack: once() });
  yield 0.1;
  out(`  ataque normal (sem rolar): sem Maestria ${ok(player.state === 'attack' && !player.maestry)}`);

  // ---------------- 113) Arremesso Serra ----------------
  out('113) Arremesso Serra (com o Arremesso Mortal)');
  fresh(); yield 0.1;
  give('w_mac31'); give('w_mac13');
  const sa = dummy(0.4, -2.6), sb = dummy(-0.5, -3.0), near = dummy(0.4, 0.8);
  player.input = fake();
  combat.playerStrike(player, C()[2]);
  out(`  machadada arremessa ${ok(player.axeSaw && ev('axeSaw').length === 1)} | machado some da mão ${ok(!player.weapon.visible)}`);
  yield* until(() => combat.axe3.saws[0] && combat.axe3.saws[0].phase === 'saw', 1500);
  yield 0.4;
  out('  -> serra girando no chão (screenshot)');
  yield 'hold';
  player.combo = 0; player.startAttack(cam);
  out(`  sem o machado: soco ${ok(player.xstep && player.xstep.kit === 'axePunch' && player.xstep.clip === PUNCHES[0].clip)}`);
  yield 0.05;
  out('  -> socando (screenshot)');
  yield 'hold';
  combat.playerStrike(player, PUNCHES[0]);
  out(`  soco acertou ${ok(ev('axePunch').some((e) => e.n >= 1) && near.hp < 999)}`);
  player.dodgeCooldown = 0; player.startDodge();
  out(`  rolar sem machado: rolamento normal ${ok(player.state === 'dodge' && !player.axeRoll)}`);
  yield* until(() => !player.axeSaw, 4000);
  const sh = ev('axeSawHit').reduce((a, e) => a + e.n, 0);
  out(`  serra cortou ${ok(sh >= 8 && sa.hp < 999 && sb.hp < 999, `${sh} cortes`)} | voltou para a mão ${ok(!player.axeSaw && player.weapon.visible && ev('axeSawCatch').length === 1)}`);
  player.state = 'idle'; player.combo = 0; player.startAttack(cam);
  out(`  de volta ao machado ${ok(!player.xstep && player.hero.combo.length === 4)}`);
  combat.playerStrike(player, C()[3]);
  out(`  Arremesso Mortal continua ${ok(ev('axeThrow').length === 1)}`);
  yield* until(() => !player.axeAway, 3000);

  // ---------------- 114) Futebol de Crânio ----------------
  out('114) Futebol de Crânio');
  fresh(); yield 0.1;
  give('w_mac32');
  const kv = dummy(0, -1.5, 'minion', 5);
  kv.die(); combat.killed(kv, 0, 1, player);
  out(`  crânio no chão ${ok(combat.axe3.skulls.length === 1)}`);
  const goal = dummy(4, -6);
  yield 0.2;
  out('  -> crânio no chão (screenshot)');
  yield 'hold';
  const sk = combat.axe3.skulls[0];
  player.position.set(sk.m.position.x, 0, sk.m.position.z + 0.6);
  yield* until(() => ev('axeSkullHit').length > 0, 2000);
  out(`  chutou no mais perto ${ok(ev('axeSkullKick')[0] && ev('axeSkullKick')[0].target === goal)} | gol ${ok(goal.hp < 999)} | crânio quebrou ${ok(combat.axe3.skulls.length === 0)}`);
  fresh(); yield 0.1;
  give('w_mac32');
  const boss = dummy(0, -2); boss.data = { ...boss.data, boss: true };
  boss.die(); combat.killed(boss, 0, 1, player);
  out(`  chefe não deixa crânio ${ok(combat.axe3.skulls.length === 0)}`);

  // ---------------- 115) Machado Faminto ----------------
  out('115) Machado Faminto');
  fresh(); yield 0.1;
  give('w_mac33');
  const prey = dummy(0, -6);
  player.input = fake();
  yield 3.5;
  out(`  3,5 s: ainda não ${ok(ev('axeHunger').length === 0)}`);
  yield* until(() => ev('axeHunger').length > 0, 1500);
  out(`  4 s sem acertar: puxou o inimigo ${ok(ev('axeHunger').length === 1 && combat.axe3.pulls.length === 1)} | herói não sai do lugar ${ok(Math.hypot(player.position.x - 0, player.position.z - 2) < 0.3)}`);
  yield 0.12;
  out('  -> inimigo sendo puxado (screenshot)');
  yield 'hold';
  yield* until(() => combat.axe3.pulls.length === 0, 1500);
  out(`  chegou perto do herói ${ok(dist(player, prey) < player.hero.radius + prey.data.radius + 1, dist(player, prey).toFixed(1))} | atordoado ${ok(prey.state === 'hurt')}`);
  const hpH = player.hp; prey.abilities = true; prey.position.set(player.position.x, 0, player.position.z - 0.6); yield 0.3;
  out(`  esbarrão não machuca por 2 s ${ok(player.hp === hpH && prey.hookSafe === player)}`);
  yield 2.0;
  out(`  depois de 2 s volta a valer ${ok(!prey.hookSafe)}`);
  player.axeHunger = 3.5;
  combat.playerStrike(player, C()[0]);
  out(`  acertar zera a fome ${ok(player.axeHunger === 0)}`);

  // ---------------- 116) Todas juntas ----------------
  out('116) Machado: as 28 bênçãos juntas (sem erro)');
  fresh(); yield 0.1;
  for (const b of mine) for (let k = 0; k < b.max; k++) player.addBlessing(b);
  for (let i = 0; i < 5; i++) dummy(-1.2 + i * 0.6, 0.4 - (i % 2) * 0.6, i === 2 ? 'warrior' : 'minion', 300);
  const errs0 = (window.__game.errors || []).length;
  player.iframes = 99;
  let swings = 0;
  try {
    for (let t = 0; t < 12; t++) { const st = player.xstep || C()[t % C().length]; combat.playerStrike(player, st); swings++; yield 0.15; }
    player.axeSinceDodge = 0; axe3Press(player, cam, true); yield 0.4;
    for (const e of [...combat.enemies]) if (e.alive) { e.die(); combat.killed(e, 0, 1, player); }
    yield 0.5;
  } catch (e) { out(`  ERRO ${e.message}`); }
  yield* until(() => !player.axeAway && !player.axeSaw, 4000);
  out(`  ${swings} golpes ${ok(swings === 12 && (window.__game.errors || []).length === errs0)} | machado de volta ${ok(!player.axeAway && !player.axeSaw && player.weapon.visible)}`);
  player.iframes = 0;
  fresh();
}
