// Teste automático, parte 29 (07/11/2026): bênçãos novas das Kunais (kunaikit.js / kunaiprops.js).
// Tecla [ (BracketLeft: a tecla ´ ao lado do P no teclado ABNT) = só as Kunais; também roda no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { KUN } from './kunaikit.js';

const ok = (c, extra = '') => (c ? `✔${extra !== '' ? ` ${extra}` : ''}` : `ERRO${extra !== '' ? ` (${extra})` : ''}`);

export function* kunaiTests(g, out, flags) {
  const { player, combat, waves } = g;
  const R = g.rogue, K = R.k2;
  const realInput = player.input;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  let rects0 = null;
  const fresh = (inp = {}) => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('rogue', 'kunai'); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    rects0 = combat.world.rects.slice();
    clearStrip(-13, 13, -16, 8);
    combat.props.list = combat.props.list.filter((b) => Math.abs(b.x) > 13 || b.z < -16 || b.z > 8);
    R.clear(); R.refill(player);
    player.input = fake(inp);
    player.iframes = 0;
    flags.events.length = 0;
  };
  const give = (id) => player.addBlessing(BLESSINGS.find((x) => x.id === id));
  const dummy = (x, z, type = 'minion', hp = 999, passive = true, facing = 0) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const step = () => player.hero.combo[0];
  const throwAt = (a = null) => { R.fire(player, step(), a); return R.items[R.items.length - 1]; };
  const ground = (x, z) => { const it = throwAt(); R.toGround(it, x, z); return it; };
  const errs0 = (window.__game.errors || []).length;

  out('309) Kunais: as 20 bênçãos novas');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'rogue.kunai');
  const want = ['Armadilha de Fio', 'Estrepes', 'Pregar a Sombra', 'Kunai Ímã', 'Relâmpago Amarelo', 'Troca de Lugar', 'Bumerangue', 'Fio de Aço', 'Quique na Parede', 'Faísca na Pegada', 'Pegada Heroica', 'Passar a Corrente', 'Kunai Fantasma', 'Sanguessuga', 'Mãos Vazias'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  const by = (n) => mine.find((b) => b.name === n) || {};
  out(`  ${mine.length} bênçãos (23) ${ok(mine.length === 23)} | as 15 ${ok(!miss.length, miss.join(', '))} | lendárias 1 ${ok(want.filter((n) => by(n).rarity === 'legendary').length === 1)} | raras 7 ${ok(want.filter((n) => by(n).rarity === 'rare').length === 7)} | épicas 7 ${ok(want.filter((n) => by(n).rarity === 'epic').length === 7)}`);
  out(`  Relâmpago Amarelo x Troca de Lugar não vêm juntas ${ok((by('Relâmpago Amarelo').excludes || []).includes('w_kun17'))}`);

  out('311) Armadilha de Fio: duas kunais caídas ligadas por um fio cortante');
  fresh(); yield 0.1; give('w_kun12');
  const w1 = dummy(0, -5);
  ground(-3.5, -5); ground(3.5, -5);
  yield 0.6;
  out(`  fio cortou ${ok(ev('kWire').length >= 1, ev('kWire').length)} | dano ${ok(w1.hp < 999, w1.hp)} | fio visível ${ok(K.wires.used >= 1)}`);
  out('  -> fio entre as kunais (screenshot)');
  yield 'hold';

  out('312) Estrepes: machucam e deixam lento');
  fresh(); yield 0.1; give('w_kun13');
  const c1 = dummy(0, -5);
  ground(0, -4.6); yield 0.6;
  out(`  dano ${ok(ev('kCaltrop').length >= 1 && c1.hp < 999)} | lento ${ok(c1.slow > 0)}`);

  out('313) Pregar a Sombra: kunai cai perto e prende o inimigo');
  fresh(); yield 0.1; give('w_kun14');
  const p1 = dummy(1.5, -5);
  ground(0, -5); yield 0.1;
  out(`  preso ${ok(ev('kPin').length === 1 && p1.state === 'hurt', p1.state)} | 1,5 s ${ok(ev('kPin')[0] && ev('kPin')[0].t === KUN.pin.t)}`);
  out('  -> sombra pregada (screenshot)');
  yield 'hold';

  out('314) Kunai Ímã: kunai caída desliza até o Ladino');
  fresh(); yield 0.1; give('w_kun15');
  const m1 = ground(0, -6); yield 0.05;
  const d0 = Math.hypot(m1.x - player.position.x, m1.z - player.position.z);
  yield 1;
  const d1 = Math.hypot(m1.x - player.position.x, m1.z - player.position.z);
  out(`  chegou mais perto ${ok(d0 - d1 > 2, (d0 - d1).toFixed(1))}`);

  out('315) Relâmpago Amarelo: rolar teleporta até a kunai caída e pega ela');
  fresh(); yield 0.1; give('w_kun16');
  ground(5, -5); yield 0.1;
  player.startDodge(); yield 0.05;
  out(`  teleportou ${ok(Math.hypot(player.position.x - 5, player.position.z + 5) < 1, `${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}`)} | pegou ${ok(player.ammo.length === 2 && ev('kFlash').length === 1)}`);
  player.startDodge(); yield 0.05;
  out(`  sem kunai no chão: rola normal ${ok(player.state === 'dodge')}`);

  out('316) Troca de Lugar: acertou e rolou logo depois = troca com o inimigo');
  fresh(); yield 0.1; give('w_kun17');
  const s1 = dummy(0, -5);
  throwAt(); yield () => player.kSwapT > 0;
  yield 0.2;
  player.startDodge(); yield 0.05;
  out(`  trocou ${ok(ev('kSwap').length === 1 && player.position.z < -3.5 && s1.position.z > 0.5, `${player.position.z.toFixed(1)} / ${s1.position.z.toFixed(1)}`)}`);
  yield 1.6; player.startDodge(); yield 0.05;
  out(`  depois de 1,5 s rola normal ${ok(ev('kSwap').length === 1)}`);

  out('317) Bumerangue: no fim do voo a kunai volta para a mão');
  fresh(); yield 0.1; give('w_kun18');
  throwAt(Math.PI + 0.35);
  yield () => ev('kBoomBack').length > 0;
  out(`  fez a curva ${ok(ev('kBoomBack').length === 1)}`);
  yield () => player.ammo.length === 2;
  out(`  voltou para a mão (pegou no ar) ${ok(player.ammo.length === 2 && ev('kunaiCatch').length === 1)}`);
  const bm = dummy(0, -1.5);
  const bk = throwAt(); bk.x = 0; bk.z = -7; bk.vx = 0; bk.vz = 26; K.startBack(bk);
  yield () => player.ammo.length === 2;
  out(`  na volta corta quem estiver no caminho ${ok(bm.hp < 999, bm.hp)}`);

  out('318) Fio de Aço: segurar o ataque puxa as kunais de volta, cortando');
  fresh({ attackHeld: () => true }); yield 0.1; give('w_kun19');
  const f1 = dummy(0, -4);
  player.input = fake();
  ground(0, -8); ground(2, -8);
  player.input = fake({ attackHeld: () => true });
  yield 0.45;
  out(`  puxou ${ok(ev('kSteel').length === 1 && R.items.every((x) => x.state === 'pull'))}`);
  out('  -> kunais voltando pelo fio (screenshot)');
  yield 'hold';
  player.input = fake();
  yield () => player.ammo.length === 2;
  out(`  voltaram para a mão ${ok(player.ammo.length === 2)} | cortou no caminho ${ok(f1.hp < 999, f1.hp)}`);

  out('320) Quique na Parede: bate na parede e vai no inimigo mais perto');
  fresh(); yield 0.1; give('w_kun21');
  combat.world.rects = rects0.filter((r) => r.minX > 9); // só as paredes da direita
  const q1 = dummy(5, -6);
  throwAt(Math.PI / 2 + 0.0);
  yield () => ev('kBounce').length > 0 || R.items.every((x) => x.state === 'ground');
  out(`  quicou ${ok(ev('kBounce').length === 1, R.items.map((x) => `${x.state} ${x.x.toFixed(1)},${x.z.toFixed(1)}`).join(' '))}`);
  yield 0.6;
  out(`  acertou o inimigo ${ok(q1.hp < 999, q1.hp)}`);

  const catchOne = (stack = 0) => { const it = throwAt(); it.stack = stack; R.catchKunai(it, R.items.indexOf(it), player); };
  out('323) Faísca na Pegada: choque em volta ao pegar no ar');
  fresh(); yield 0.1; give('w_kun24');
  const sp1 = dummy(1.2, 1.5);
  catchOne(); yield 0.05;
  out(`  choque ${ok(ev('kSpark').length === 1 && ev('kSpark')[0].n === 1 && sp1.hp < 999)}`);

  out('324) Pegada Heroica: pegar no ar cura 3');
  fresh(); yield 0.1; give('w_kun25');
  player.hp = 50; catchOne();
  out(`  curou ${ok(player.hp === 53, player.hp)}`);

  out('325) Passar a Corrente: a corrente passa para a outra kunai da mão');
  fresh(); yield 0.1; give('w_kun26');
  catchOne(6);
  out(`  as duas com ×7 ${ok(player.ammo.length === 2 && player.ammo.every((a) => a.stack === 6), player.ammo.map((a) => a.stack).join('/'))}`);

  out('326) Kunai Fantasma: kunai caída solta uma cópia que voa até o inimigo');
  fresh(); yield 0.1; give('w_kun27');
  const gh = dummy(5, -5);
  ground(0, -2); yield 0.05;
  out(`  fantasma saiu ${ok(K.ghosts.length === 1)}`);
  yield () => ev('kGhostHit').length > 0;
  out(`  acertou ${ok(gh.hp < 999)}`);

  out('327) Sanguessuga: kunai cravada suga a vida até ser pega');
  fresh(); yield 0.1; give('w_kun28');
  const lv = dummy(0, -5);
  player.hp = 50;
  throwAt(); yield () => R.items.some((x) => x.state === 'stuck');
  out(`  cravou ${ok(R.items[0] && R.items[0].state === 'stuck')}`);
  yield 2.1;
  out(`  sugou ${ok(ev('kLeech').length >= 2 && player.hp > 50 && lv.hp < 999, `${player.hp} / ${lv.hp}`)}`);
  out('  -> kunai cravada sugando (screenshot)');
  yield 'hold';
  throwAt(); yield 0.4;
  out(`  só uma por vez: a 2ª voa normal ${ok(R.items.filter((x) => x.state === 'stuck').length === 1)}`);
  player.position.set(lv.position.x, 0, lv.position.z + 1.3); yield 0.1;
  out(`  chegou perto: pegou ${ok(!R.items.some((x) => x.state === 'stuck'))}`);

  out('328) Mãos Vazias: sem kunais na mão, rola o dobro e os de longe perdem de vista');
  fresh({ moveDir: (v) => v.set(0, 0, -1) }); yield 0.1; give('w_kun29');
  player.position.set(0, 0, 6);
  player.startDodge(); const za = player.position.z; yield () => player.state !== 'dodge';
  const normal = za - player.position.z;
  const far = dummy(10, -12, 'minion', 999, false);
  yield 0.4;
  player.position.set(0, 0, 6);
  player.ammo.length = 0;
  player.startDodge(); const zb = player.position.z; yield () => player.state !== 'dodge';
  const dbl = zb - player.position.z;
  out(`  rolou o dobro ${ok(dbl > normal * 1.7, `${normal.toFixed(1)} -> ${dbl.toFixed(1)}`)} | o de longe perdeu de vista ${ok(ev('kEmpty').length === 1 && ev('kEmpty')[0].n >= 1, far.state)}`);

  out('330) Kunais com as 30: sem erros');
  fresh({ moveDir: (v) => v.set(0, 0, -1) }); yield 0.1;
  for (const b of mine) if (b.id !== 'w_kun17') for (let i = 0; i < b.max; i++) player.addBlessing(b);
  const all = [];
  for (let i = 0; i < 6; i++) all.push(dummy(-4 + i * 1.6, -3 - (i % 2) * 2.5, i % 3 === 1 ? 'warrior' : 'minion', 60, false));
  all.push(dummy(0, -10, 'archer', 60, false));
  let held = false;
  for (let t = 0; t < 36; t++) {
    const a = all.find((x) => x.alive) || all[0];
    player.facing = Math.atan2(a.position.x - player.position.x, a.position.z - player.position.z);
    if (player.ammo.length) throwAt();
    if (t % 6 === 5) player.startDodge();
    if (t % 9 === 4) { held = !held; player.input = fake({ attackHeld: () => held }); }
    if (t % 5 === 4) { player.iframes = 0; combat.hitPlayer(a, 3, { target: player }); }
    yield 0.25;
  }
  player.input = fake();
  yield 2.5;
  const errs = (window.__game.errors || []).length - errs0;
  out(`  sem erros do jogo ${ok(errs === 0, errs)}`);
  player.input = realInput;
}
