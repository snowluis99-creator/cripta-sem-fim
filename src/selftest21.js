// Teste automático, parte 21 (06/11/2026): bênçãos da Manopla (lista do dono).
// Tecla Y = tudo; tecla Ç (Semicolon) = só a Manopla.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { fistPress } from './fistkit.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* fistTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const cam = g.cam.camera;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('knight', 'manopla'); player.reset(0, 2); player.facing = Math.PI;
    clearStrip(-7, 7, -14, 7);
    player.input = fake();
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion', hp = 999) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const C = () => player.hero.combo;
  const once = () => { let n = 1; return () => (n-- > 0); };
  const H = () => player.hero.combo[player.hero.heavyIdx];
  const dist = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
  const punch = (i = 0) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const errs0 = (window.__game.errors || []).length;

  // ---------------- 149) Lista ----------------
  out('149) Manopla: bênçãos do dono');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'knight.manopla');
  const by = (n) => mine.find((b) => b.name === n) || {};
  const want = ['Arremesso', 'Suplex', 'Escudo de Carne', 'Quebra-Escudo', 'Strike', 'Pinball', 'Soco Sísmico', 'Soco de Vento', 'Punho Foguete', 'Investida de Punho',
    'Corrente de Nocautes', 'Pegar no Ar', 'Contragolpe Relâmpago', 'Soco Carregado', 'Contador de Combo', 'Pavio', 'Desmontar', 'Duelo', 'Saco de Pancadas'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  out(`  ${mine.length} bênçãos ${ok(mine.length === 19)} | as 19 da lista ${ok(!miss.length, miss.join(', '))}`);
  out(`  raridades ${ok(by('Arremesso').rarity === 'rare' && by('Suplex').rarity === 'epic' && by('Punho Foguete').rarity === 'legendary' && by('Corrente de Nocautes').rarity === 'legendary' && by('Contador de Combo').rarity === 'legendary' && by('Saco de Pancadas').rarity === 'legendary' && by('Desmontar').rarity === 'rare')}`
    + ` | Arremesso não vem com Suplex/Sísmico/Foguete ${ok(['w_mnp12', 'w_mnp17', 'w_mnp19'].every((id) => by('Arremesso').excludes.includes(id)))} | Carne x Carregado ${ok(by('Escudo de Carne').excludes.includes('w_mnp25'))}`);

  // ---------------- 150) Arremesso ----------------
  out('150) Arremesso: agarra e joga; quem está no caminho cai');
  fresh(); yield 0.1;
  give('w_mnp11');
  const ta = dummy(0, 0.8), tb = dummy(0, -4);
  combat.playerStrike(player, H());
  out(`  jogou ${ok(ev('fistLaunch').length === 1 && ta.state === 'fistFly')}`);
  yield 0.15;
  out('  -> esqueleto voando (screenshot)');
  yield 'hold';
  yield* until(() => ev('fistLand').length > 0, 2000);
  out(`  derrubou quem estava no caminho ${ok(ev('fistBowl').some((x) => x.enemy === tb) && tb.hp < 999)} | o arremessado caiu e levou dano ${ok(ev('fistLand').length === 1 && ta.hp < 999 && dist(player, ta) > 5, dist(player, ta).toFixed(1))}`);
  fresh(); yield 0.1; give('w_mnp11');
  const tc = dummy(0, -6);
  combat.playerStrike(player, H());
  out(`  sem ninguém perto: soco forte normal ${ok(!ev('fistLaunch').length)}`);
  tc.hp = 1;

  // ---------------- 151) Suplex ----------------
  out('151) Suplex: bate o inimigo no chão atrás, com área');
  fresh(); yield 0.1;
  give('w_mnp12');
  const sa = dummy(0, 0.8), sb = dummy(0.8, 4.2);
  combat.playerStrike(player, H());
  out(`  agarrou ${ok(ev('fistSuplex').length === 1 && sa.state === 'fistHeld')}`);
  yield 0.22;
  out('  -> no alto, passando por cima (screenshot)');
  yield 'hold';
  yield* until(() => ev('fistSuplexLand').length > 0, 1500);
  out(`  caiu atrás ${ok(sa.position.z > player.position.z, sa.position.z.toFixed(1))} | levou dano ${ok(sa.hp < 999)} | área pegou o de trás ${ok(sb.hp < 999 && ev('fistSuplexLand')[0].n >= 1)}`);

  // ---------------- 152) Escudo de Carne (atacar bloqueando + chute, pedido do dono 07/11) ----------------
  out('152) Escudo de Carne: atacar bloqueando agarra, segura flechas 2 s e chuta');
  fresh(); yield 0.1;
  give('w_mnp13');
  const mt = dummy(0, 0.6);
  player.input = fake({ attackHeld: () => true });
  player.startAttack(cam);
  yield 0.3;
  out(`  segurar o ataque sem bloquear não agarra ${ok(player.state !== 'fistMeat' && mt.state !== 'fistHeld')}`);
  player.input = fake(); yield 0.5;
  player.input = fake({ blocking: () => true });
  yield 0.2;
  out(`  bloqueando ${ok(player.state === 'block')}`);
  player.input = fake({ blocking: () => true, attack: once() });
  yield 0.1;
  out(`  atacou bloqueando: agarrou ${ok(player.state === 'fistMeat' && mt.state === 'fistHeld')}`);
  player.input = fake();
  const hp0 = player.hp;
  combat.projectiles.fire(0, -6, 0, { speed: 14, damage: 10, owner: null });
  yield 0.6;
  out(`  a flecha bateu no corpo ${ok(ev('fistMeatBlock').length === 1 && player.hp === hp0 && mt.hp < 999)}`);
  out('  -> segurando o esqueleto na frente (screenshot)');
  yield 'hold';
  yield* until(() => player.state === 'fistKick', 2500);
  out(`  acabou o tempo: chute ${ok(player.state === 'fistKick')} | sem dano no chute ${ok(player.invulnerable)}`);
  const kz0 = mt.position.z;
  yield* until(() => ev('fistMeatKick').length > 0, 800);
  yield 0.5;
  out(`  arremessou longe ${ok(ev('fistMeatKick').length === 1 && Math.abs(mt.position.z - kz0) > 4, Math.abs(mt.position.z - kz0).toFixed(1))}`);
  yield* until(() => player.state !== 'fistKick', 1000);
  const hpK = player.hp;
  combat.hitPlayer({ position: { x: player.position.x, y: 0, z: player.position.z - 1 }, alive: false, data: { boss: true } }, 20, { target: player });
  out(`  1 s depois do chute ainda sem dano ${ok(player.hp === hpK && player.iframes > 0.3, player.iframes.toFixed(2))}`);
  yield 1.2;
  out(`  passou: volta a levar dano ${ok(!player.invulnerable)}`);

  // ---------------- 153) Quebra-Escudo ----------------
  out('153) Quebra-Escudo: arranca o escudo e arremessa como disco');
  fresh(); yield 0.1;
  give('w_mnp14');
  const sw = dummy(0, 0.6, 'warrior');
  dummy(-2.5, -3); dummy(2.5, -5);
  punch(0);
  out(`  arrancou ${ok(ev('fistRip').length === 1 && sw.shieldBroken && !!player.fistDisc)}`);
  combat.playerStrike(player, H());
  out(`  golpe forte arremessou ${ok(ev('fistDisc').length === 1 && !player.fistDisc)}`);
  yield* until(() => combat.fist.discs.length === 0, 3000);
  out(`  quicou entre inimigos ${ok(ev('fistDiscHit').length >= 2, ev('fistDiscHit').length)}`);

  // ---------------- 154) Strike ----------------
  out('154) Strike: nocauteado pelo golpe forte vira bola de boliche');
  fresh(); yield 0.1;
  give('w_mnp15');
  dummy(0, 0.8, 'minion', 1); const pin = dummy(0.3, -4);
  combat.playerStrike(player, H());
  out(`  corpo voou ${ok(ev('fistLaunch').some((x) => x.dead))}`);
  yield 0.8;
  out(`  derrubou ${ok(ev('fistBowl').some((x) => x.enemy === pin) && pin.state === 'axeDown')}`);

  // ---------------- 155) Pinball ----------------
  out('155) Pinball: socado na parede volta para o próximo soco');
  fresh(); yield 0.1;
  give('w_mnp16');
  combat.world.addRect(-3, -1.4, 3, -0.9);
  const pb = dummy(0, 0.2);
  punch(0);
  out(`  quicou ${ok(ev('fistPinball').length === 1)}`);
  yield* until(() => combat.fist.bounces.length === 0, 2000);
  out(`  bateu na parede ${ok(ev('fistPinballWall').length === 1)} | voltou para perto ${ok(dist(player, pb) < pb.data.radius + player.hero.radius + 1.2, dist(player, pb).toFixed(2))} | atordoado ${ok(pb.state === 'hurt')}`);
  punch(1);
  out(`  o próximo soco pega ${ok(pb.hp < 999 - 6)}`);

  // ---------------- 156) Soco Sísmico ----------------
  out('156) Soco Sísmico: todos em volta caem sentados 1 s');
  fresh(); yield 0.1;
  give('w_mnp17');
  const q = [dummy(0, 0.6), dummy(2, 2), dummy(-2, 1.4)];
  combat.playerStrike(player, H());
  out(`  sentaram ${ok(q.every((e) => e.state === 'fistSit'), q.map((e) => e.state).join(','))}`);
  yield 0.3;
  out('  -> sentados (screenshot)');
  yield 'hold';
  yield 1.0;
  out(`  levantaram ${ok(q.every((e) => e.state !== 'fistSit'))}`);

  // ---------------- 157) Soco de Vento ----------------
  out('157) Soco de Vento: onda de ar até 5');
  fresh(); yield 0.1;
  give('w_mnp18');
  const w4 = dummy(0, -2.3), w8 = dummy(0, -6.4);
  combat.playerStrike(player, H());
  yield 0.5;
  out(`  acertou a 4,3 ${ok(w4.hp < 999)} | não passa de 5 ${ok(w8.hp === 999)}`);

  // ---------------- 158) Punho Foguete ----------------
  out('158) Punho Foguete: explode no 1º inimigo e volta');
  fresh(); yield 0.1;
  give('w_mnp19');
  const rk = dummy(0, -7), rk2 = dummy(1.2, -7.5);
  combat.playerStrike(player, H());
  out(`  disparou ${ok(ev('fistRocket').length === 1 && player.weapon && !player.weapon.visible)}`);
  yield 0.2;
  out('  -> foguete voando (screenshot)');
  yield 'hold';
  yield* until(() => ev('fistRocketBoom').length > 0, 2000);
  out(`  explodiu ${ok(rk.hp < 999 && rk2.hp < 999)}`);
  yield* until(() => ev('fistRocketBack').length > 0, 2000);
  out(`  voltou para a mão ${ok(player.weapon.visible && !player.fistRocketOut)}`);

  // ---------------- 159) Investida de Punho ----------------
  out('159) Investida de Punho: depois de rolar, avança até o inimigo');
  fresh(); yield 0.1;
  give('w_mnp20');
  const ds = dummy(0, -5);
  const went = fistPress(player, cam, true);
  out(`  saiu correndo ${ok(went && player.state === 'fistDash')}`);
  yield* until(() => ds.hp < 999, 1500);
  out(`  chegou batendo ${ok(ds.hp < 999 && dist(player, ds) < 3)}`);

  // ---------------- 160) Corrente de Nocautes ----------------
  out('160) Corrente de Nocautes: derrubou, salta para o próximo');
  fresh(); yield 0.1;
  give('w_mnp21');
  dummy(0, 0.8, 'minion', 1); const cn = dummy(3, -3);
  player.startAttack(cam); player.hitDone = true;
  punch(0);
  yield* until(() => ev('fistLeap').length > 0, 800);
  out(`  saltou ${ok(ev('fistLeap').length === 1 && ev('fistLeap')[0].enemy === cn)}`);
  yield* until(() => cn.hp < 999, 1500);
  out(`  chegou batendo ${ok(cn.hp < 999)}`);

  // ---------------- 161) Pegar no Ar ----------------
  out('161) Pegar no Ar: escudinho na hora pega a flecha; o soco devolve');
  fresh(); yield 0.1;
  give('w_mnp22');
  player.input = fake({ blocking: () => true });
  player.enterBlock(cam);
  const sh0 = player.shield, hpc = player.hp;
  combat.projectiles.fire(0, -1.2, 0, { speed: 20, damage: 8, owner: null });
  yield 0.2;
  out(`  pegou ${ok(ev('fistCatch').length === 1 && !!player.fistCaught && player.hp === hpc && player.shield === sh0)}`);
  player.input = fake();
  yield 0.1;
  const cb = dummy(0, -4);
  punch(0);
  out(`  devolveu ${ok(ev('fistThrowBack').length === 1 && !player.fistCaught)}`);
  yield 0.4;
  out(`  acertou ${ok(cb.hp < 999)}`);
  fresh(); yield 0.1; give('w_mnp22');
  player.input = fake({ blocking: () => true });
  player.enterBlock(cam);
  yield 0.6;
  combat.projectiles.fire(0, -1.2, 0, { speed: 20, damage: 8, owner: null });
  yield 0.2;
  out(`  atrasado: só bloqueia ${ok(!ev('fistCatch').length)}`);

  // ---------------- 163) Contragolpe Relâmpago ----------------
  out('163) Contragolpe Relâmpago: bloqueio na hora devolve um soco');
  fresh(); yield 0.1;
  give('w_mnp24');
  player.input = fake({ blocking: () => true });
  player.enterBlock(cam);
  const zz = dummy(0, 0.6, 'warrior');
  const shz = player.shield;
  combat.hitPlayer(zz, 10, { target: player });
  out(`  sem gastar o escudo ${ok(player.shield === shz && ev('fistZap').length === 1)}`);
  yield* until(() => ev('fistZapHit').length > 0, 1200);
  out(`  soco automático acertou ${ok(ev('fistZapHit').length === 1 && ev('fistZapHit')[0].n === 1 && zz.hp < 999)}`);
  player.input = fake();

  // ---------------- 164) Soco Carregado ----------------
  out('164) Soco Carregado: segurar carrega; voa longe');
  fresh(); yield 0.1;
  give('w_mnp25');
  const ch = dummy(0, 0.7);
  let hold = true;
  player.input = fake({ attackHeld: () => hold });
  player.startAttack(cam);
  yield 0.3;
  out(`  carregando ${ok(player.state === 'fistCharge')}`);
  yield 1.4;
  out('  -> mão brilhando (screenshot)');
  yield 'hold';
  hold = false;
  const z0 = ch.position.z;
  yield* until(() => ev('fistBig').length > 0, 1500);
  out(`  soltou: força ${ev('fistBig').length ? ev('fistBig')[0].k.toFixed(2) : '?'} ${ok(ev('fistBig').length === 1 && ev('fistBig')[0].k > 0.9)}`);
  yield* until(() => ev('fistLand').length > 0, 2000);
  out(`  voou longe ${ok(Math.abs(ch.position.z - z0) > 6, Math.abs(ch.position.z - z0).toFixed(1))}`);
  player.input = fake();

  // ---------------- 165) Contador de Combo ----------------
  out('165) Contador de Combo: 10 acertos = onda; dano zera');
  fresh(); yield 0.1;
  give('w_mnp26');
  const cc = dummy(0, 0.6);
  for (let i = 0; i < 10; i++) { cc.position.set(0, 0, 0.6); cc.vel.set(0, 0, 0); punch(i % 3); yield 0.05; }
  out(`  10 acertos -> onda ${ok(ev('fistComboWave').length === 1 && player.fistHits === 10)}`);
  combat.hitPlayer(cc, 5, { target: player });
  yield 0.3;
  out(`  tomou dano: zerou ${ok(player.fistHits === 0 && ev('fistComboReset').length === 1)}`);

  // ---------------- 166) Pavio ----------------
  out('166) Pavio: faíscas grudam; golpe forte detona');
  fresh(); yield 0.1;
  give('w_mnp27');
  const fu = dummy(0, 0.6);
  for (let i = 0; i < 7; i++) punch(i % 3);
  out(`  faíscas: ${fu.fistFuse} ${ok(fu.fistFuse === 5)}`);
  yield 0.2;
  out('  -> faíscas girando (screenshot)');
  yield 'hold';
  const hpf = fu.hp;
  combat.playerStrike(player, H());
  out(`  detonou ${ok(ev('fistDetonate').length === 1 && ev('fistDetonate')[0].n === 1 && !fu.fistFuse && hpf - fu.hp > 25)}`);

  // ---------------- 167) Desmontar ----------------
  out('167) Desmontar: 2 combos completos = sem arma, só empurra');
  fresh(); yield 0.1;
  give('w_mnp28');
  const dm = dummy(0, 0.6, 'warrior');
  for (let k = 0; k < 2; k++) for (let i = 0; i < 4; i++) { punch(i); dm.position.set(0, 0, 0.6); dm.vel.set(0, 0, 0); }
  out(`  arrancou 2 pedaços ${ok(ev('fistDismantle').length === 2 && dm.fistDisarmed)}`);
  const hpd = player.hp;
  combat.hitPlayer(dm, 10, { target: player });
  out(`  golpe dele só empurra ${ok(player.hp === hpd && ev('fistShove').length === 1)}`);

  // ---------------- 168) Duelo ----------------
  out('168) Duelo: os outros param de atacar');
  fresh(); yield 0.1;
  give('w_mnp29');
  const da = dummy(0, 0.6), db = dummy(3, 2);
  combat.playerStrike(player, H());
  out(`  desafiou ${ok(ev('fistDuel').length === 1 && player.fistDuel && player.fistDuel.e === da)}`);
  const hpe = player.hp;
  combat.hitPlayer(db, 10, { target: player });
  out(`  o outro não machuca ${ok(player.hp === hpe && ev('fistDuelBlock').length === 1)}`);
  player.iframes = 0;
  combat.hitPlayer(da, 10, { target: player });
  out(`  o desafiado machuca ${ok(player.hp < hpe)}`);

  // ---------------- 169) Saco de Pancadas ----------------
  out('169) Saco de Pancadas: 8 socos seguidos = explode');
  fresh(); yield 0.1;
  give('w_mnp30');
  const bg = dummy(0, 0.6), nb = dummy(1.8, 0.2);
  for (let i = 0; i < 8 && bg.alive; i++) { punch(i % 3); bg.position.set(0, 0, 0.6); }
  out(`  explodiu ${ok(ev('fistBag').length === 1 && !bg.alive)} | acertou o vizinho ${ok(nb.hp < 999)}`);
  yield 0.3;
  out('  -> ossos voando (screenshot)');
  yield 'hold';

  // ---------------- 170) Todas juntas ----------------
  out('170) Manopla com todas as bênçãos: sem erros');
  fresh(); yield 0.1;
  for (const b of mine) for (let k = 0; k < b.max; k++) player.addBlessing(b);
  for (let i = 0; i < 6; i++) dummy(-2 + i * 0.8, -0.5 - (i % 2));
  player.iframes = 99;
  for (let t = 0; t < 16; t++) { player.combo = t % 4; combat.playerStrike(player, C()[t % 4]); yield 0.15; }
  yield 1.0;
  player.iframes = 0;
  const errs = (window.__game.errors || []).length - errs0;
  out(`  sem erros do jogo ${ok(errs === 0, errs)}`);
  player.input = realInput;
}
