// Teste automático, parte 28 (07/11/2026): bênçãos novas das Duas Adagas (roguekit.js / rogueprops.js / roguestates.js).
// Tecla \ (ao lado do Z no teclado ABNT) = só as Duas Adagas; também roda no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { DAG } from './roguekit.js';

const ok = (c, extra = '') => (c ? `✔${extra !== '' ? ` ${extra}` : ''}` : `ERRO${extra !== '' ? ` (${extra})` : ''}`);

export function* daggerTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const K = combat.rogue2;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const fresh = (inp = {}) => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('rogue', 'adagas'); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    clearStrip(-13, 13, -16, 8);
    combat.props.list = combat.props.list.filter((b) => Math.abs(b.x) > 13 || b.z < -16 || b.z > 8);
    player.input = fake(inp);
    player.iframes = 0;
    flags.events.length = 0;
  };
  const give = (id) => player.addBlessing(BLESSINGS.find((x) => x.id === id));
  const dummy = (x, z, type = 'minion', hp = 999, passive = true, facing = 0) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; e.facing = facing; e.group.rotation.y = facing; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const C = () => player.hero.combo;
  const hit = (i = 0) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const dirTo = (x, z) => (v) => v.set(x, 0, z);
  const errs0 = (window.__game.errors || []).length;

  out('283) Duas Adagas: as 20 bênçãos novas');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'rogue.adagas');
  const want = ['Bomba de Fumaça', 'Substituição', 'Sumir no Abate', 'Areia nos Olhos', 'Execução Silenciosa', 'Passo das Sombras', 'Adaga Cravada', 'Leque de Facas', 'Lâminas Voadoras', 'Cortar Flechas', 'Desarmar', 'Bolsos Fundos', 'Marca da Morte', 'Golpe de Misericórdia', 'Veneno Paralisante', 'Veneno de Cobra'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  const by = (n) => mine.find((b) => b.name === n) || {};
  out(`  ${mine.length} bênçãos (22) ${ok(mine.length === 22)} | as 16 ${ok(!miss.length, miss.join(', '))} | lendárias: Substituição, Lâminas, Misericórdia ${ok(['Substituição', 'Lâminas Voadoras', 'Golpe de Misericórdia'].every((n) => by(n).rarity === 'legendary'))} | raras: 6 ${ok(want.filter((n) => by(n).rarity === 'rare').length === 6)} | épicas: 7 ${ok(want.filter((n) => by(n).rarity === 'epic').length === 7)}`);

  out('284) Bomba de Fumaça: rolar solta fumaça e os inimigos ficam procurando');
  fresh({ moveDir: dirTo(1, 0) }); yield 0.1; give('w_ada11');
  const sa = dummy(0, -1.5), sb = dummy(4, -4);
  yield 0.1;
  player.startDodge(); yield 0.1;
  out(`  fumaça ${ok(ev('rogueSmoke').length === 1)} | os dois perdidos ${ok(sa.state === 'rogueLost' && sb.state === 'rogueLost', `${sa.state}/${sb.state}`)}`);
  out('  -> esqueletos procurando na fumaça (screenshot)');
  yield 'hold';
  yield 0.3; player.startDodge(); yield 0.1;
  out(`  rolar de novo logo depois: sem fumaça (espera ${DAG.smoke.cd} s) ${ok(ev('rogueSmoke').length === 1)}`);
  yield 1.6;
  out(`  1,5 s depois voltam ao normal ${ok(sa.state !== 'rogueLost' && sb.state !== 'rogueLost', sa.state)}`);

  out('285) Substituição: o golpe acerta um boneco de palha e o Ladino reaparece atrás');
  fresh(); yield 0.1; give('w_ada12');
  const su = dummy(0, 0.6, 'minion', 999, false);
  yield 0.2;
  const hp0 = player.hp, z0 = player.position.z;
  player.iframes = 0;
  combat.hitPlayer(su, 10, { target: player });
  out(`  sem dano ${ok(player.hp === hp0)} | boneco ${ok(K.decoys.length === 1 && ev('rogueSub').length === 1)} | 3 passos para trás ${ok(player.position.z - z0 > 2.5, (player.position.z - z0).toFixed(1))}`);
  yield 0.1;
  out(`  o esqueleto mira o boneco ${ok(su.target && su.target.decoy)}`);
  out('  -> boneco de palha (screenshot)');
  yield 'hold';
  yield 1.75;
  out(`  bateu no boneco ${ok(ev('rogueDecoyHit').length >= 1, ev('rogueDecoyHit').length)}`);
  yield 0.4;
  out(`  2 s: o boneco some ${ok(K.decoys.length === 0 && ev('rogueDecoyEnd').length === 1)} | volta a mirar o Ladino ${ok(su.target === player)}`);
  player.iframes = 0;
  const hp1 = player.hp;
  combat.hitPlayer(su, 10, { target: player });
  out(`  outro golpe antes de 10 s: machuca ${ok(player.hp < hp1)}`);

  out('286) Sumir no Abate: derrotou um inimigo, fica invisível por 1 s');
  fresh(); yield 0.1; give('w_ada13');
  const va = dummy(0, 0.4, 'minion', 1), vb = dummy(-2.5, 1, 'minion', 999, false);
  yield 0.2;
  hit(0); yield 0.05;
  out(`  sumiu ${ok(ev('rogueVanish').length === 1 && player.vanishT > 0 && player.invulnerable)} | quem atacava ficou perdido ${ok(vb.state === 'rogueLost', vb.state)}`);
  const hpv = player.hp;
  combat.hitPlayer(vb, 10, { target: player });
  out(`  golpe nele não pega ${ok(player.hp === hpv)}`);
  yield 1.1;
  out(`  1 s depois aparece de novo ${ok(!(player.vanishT > 0) && !player.invulnerable)}`);

  out('287) Areia nos Olhos: o golpe forte cega por 2 s');
  fresh(); yield 0.1; give('w_ada14');
  const bl = dummy(0, 0.4, 'minion', 999, false);
  yield 0.1;
  hit(2); yield 0.1;
  out(`  cego ${ok(bl.state === 'rogueBlind' && bl.blindT > 0, bl.state)}`);
  yield 1.0;
  out(`  ataca a esmo ${ok(ev('rogueBlindSwing').length >= 1, ev('rogueBlindSwing').length)}`);
  const hpb = player.hp;
  combat.hitPlayer(bl, 10, { target: player });
  out(`  e erra ${ok(player.hp === hpb && ev('rogueBlindMiss').length === 1)}`);
  yield 1.2;
  out(`  2 s depois enxerga de novo ${ok(bl.state !== 'rogueBlind' && !(bl.blindT > 0), bl.state)}`);

  out('288) Execução Silenciosa: pelas costas, com menos de 30% de vida');
  fresh(); yield 0.1; give('w_ada15');
  const ex1 = dummy(0, 0.4, 'minion', 100, true, Math.PI); ex1.hp = 25;
  hit(0); yield 0.05;
  out(`  pelas costas: derrotado na hora ${ok(!ex1.alive && ev('rogueExec').length === 1)}`);
  const ex2 = dummy(0, 0.4, 'minion', 100, true, 0); ex2.hp = 25;
  hit(0); yield 0.05;
  out(`  de frente: só o golpe normal ${ok(ex2.alive && ev('rogueExec').length === 1)}`);
  const ex3 = dummy(1.5, 0.4, 'minion', 100, true, Math.PI); ex3.hp = 80;
  player.facing = Math.atan2(1.5, -1.6); hit(0); yield 0.05;
  out(`  pelas costas com vida alta: golpe normal ${ok(ex3.alive && ev('rogueExec').length === 1)}`);

  out('289) Passo das Sombras: rolar na direção de um inimigo leva para as costas dele');
  fresh({ moveDir: dirTo(0, -1) }); yield 0.1; give('w_ada16');
  const sh = dummy(0, -3, 'minion', 999, true, 0);
  yield 0.1;
  player.startDodge();
  const behind = player.position.z < sh.position.z - 0.5;
  const faceIt = Math.abs(Math.atan2(Math.sin(player.facing - Math.atan2(sh.position.x - player.position.x, sh.position.z - player.position.z)), Math.cos(player.facing - Math.atan2(sh.position.x - player.position.x, sh.position.z - player.position.z)))) < 0.3;
  yield 0.05;
  out(`  atrás dele ${ok(behind && ev('rogueShadow').length === 1, player.position.z.toFixed(1))} | virado para ele ${ok(faceIt)}`);
  out('  -> Ladino nas costas do esqueleto (screenshot)');
  yield 'hold';
  player.input = fake({ moveDir: dirTo(0, -1) }); // continua: agora pelas costas ele cai fácil
  player.facing = Math.atan2(sh.position.x - player.position.x, sh.position.z - player.position.z);
  player.position.set(5, 0, 2); player.facing = 0;
  player.startDodge(); yield 0.05;
  out(`  sem ninguém na frente: rola normal ${ok(player.state === 'dodge' && ev('rogueShadow').length === 1)}`);

  out('292) Adaga Cravada: gira a cada golpe e volta quando ele morre');
  fresh(); yield 0.1; give('w_ada19');
  const st = dummy(0, 0.4);
  hit(2); yield 0.1;
  out(`  cravada ${ok(!!st.rogueStuck && ev('rogueStick').length === 1)}`);
  out('  -> adaga cravada (screenshot)');
  yield 'hold';
  hit(0); yield 0.05;
  out(`  o golpe seguinte gira a adaga ${ok(ev('rogueTwist').length === 1)}`);
  st.hp = 1; hit(0); yield 0.1;
  out(`  morreu: a adaga volta voando ${ok(!st.alive && ev('rogueStuckBack').length === 1 && K.flies.some((f) => f.kind === 'back'))}`);
  yield 0.6;
  out(`  chegou na mão ${ok(!K.flies.length)}`);

  out('293) Leque de Facas: o golpe forte solta facas para todos os lados');
  fresh(); yield 0.1; give('w_ada20');
  const fa = dummy(3.2, 2), fb = dummy(-3.2, 2), fc = dummy(0, 5);
  hit(2); yield 0.05;
  out(`  ${DAG.fan.n} facas ${ok(K.flies.filter((f) => f.kind === 'knife').length === DAG.fan.n, K.flies.length)}`);
  out('  -> leque de facas (screenshot)');
  yield 'hold';
  yield 0.4;
  out(`  acertaram dos lados e atrás ${ok(fa.hp < 999 && fb.hp < 999 && fc.hp < 999, ev('rogueKnifeHit').length)} | sumiram ${ok(!K.flies.length)}`);

  out('294) Lâminas Voadoras: duas adagas fantasmas girando');
  fresh(); yield 0.1; give('w_ada21');
  yield 0.1;
  const orb = K.orbits.get(player);
  out(`  2 adagas ${ok(orb && orb.g.length === 2)}`);
  const lv = dummy(1.5, 2.2);
  yield 1.0;
  out(`  cortam quem chega perto ${ok(lv.hp < 999 && ev('rogueOrbitHit').length >= 2, ev('rogueOrbitHit').length)}`);
  out('  -> adagas fantasmas (screenshot)');
  yield 'hold';

  out('295) Cortar Flechas: atacando, corta flechas de qualquer lado');
  fresh(); yield 0.1; give('w_ada22');
  const ar = dummy(0, 9, 'archer', 999, true, Math.PI);
  player.startAttack(null);
  combat.projectiles.fire(0, 5.2, Math.PI, { speed: 14, damage: 8, kind: 'arrow', hits: 'player', owner: ar });
  const hpa = player.hp;
  yield 0.35;
  out(`  flecha pelas costas cortada ${ok(ev('smashed').length >= 1 && player.hp === hpa, ev('smashed').length)}`);

  out('297) Desarmar: o golpe forte arranca a arma; desarmado só empurra');
  fresh(); yield 0.1; give('w_ada24');
  const ds = dummy(0, 0.4, 'warrior', 999, false);
  const nw = ds.weapons.length;
  hit(2); yield 0.1;
  out(`  desarmado ${ok(ds.rogueDisarmed && ds.weapons.length === nw - 1 && ev('rogueDisarm').length === 1, `${nw}->${ds.weapons.length}`)}`);
  player.iframes = 0;
  const hpd = player.hp;
  combat.hitPlayer(ds, 15, { target: player });
  out(`  golpe dele só empurra ${ok(player.hp === hpd && ev('rogueShove').length === 1)}`);

  out('298) Bolsos Fundos: frasco no chão passa o efeito para o próximo golpe');
  fresh(); yield 0.1; give('w_ada25');
  const fl = dummy(0, 0.4);
  K.dropFlask(player.position.x + 0.4, player.position.z, 'poison');
  out('  -> frasco no chão (screenshot)');
  yield 'hold';
  yield 0.1;
  out(`  pegou ${ok(player.rogueFlask === 'poison' && !K.flasks.length)}`);
  hit(0); yield 0.05;
  out(`  envenenou ${ok(fl.poisonT > 0 && !player.rogueFlask)}`);
  const fl2 = dummy(-1.2, 0.2); K.dropFlask(player.position.x, player.position.z, 'smoke'); yield 0.1; hit(0); yield 0.05;
  out(`  fumaça: perdidos ${ok(fl2.state === 'rogueLost' || fl.state === 'rogueLost')}`);
  K.dropFlask(player.position.x, player.position.z, 'fire'); yield 0.1; hit(0); yield 0.05;
  out(`  fogo ${ok(fl.burn > 0)}`);
  const rnd2 = Math.random; Math.random = () => 0.01;
  const fd = dummy(2, 0.4, 'minion', 1); player.facing = Math.atan2(2, -1.6); hit(0);
  Math.random = rnd2; yield 0.05;
  out(`  inimigo derrotado deixou frasco ${ok(!fd.alive && ev('rogueFlaskDrop').length === 4)}`);

  out('299) Marca da Morte: a marca pula para o próximo');
  fresh(); yield 0.1; give('w_ada26');
  const m1 = dummy(0, 0.4), m2 = dummy(3, -2), m3 = dummy(-7, -7);
  hit(2); yield 0.05;
  out(`  marcado ${ok(m1.rogueMarkBy === player)}`);
  const d0 = m1.hp; hit(0); yield 0.05;
  out('  -> marca (screenshot)');
  yield 'hold';
  m1.hp = 1; hit(0); yield 0.1;
  out(`  derrotou o marcado: pulou para o mais perto ${ok(!m1.alive && m2.rogueMarkBy === player && !m3.rogueMarkBy && ev('rogueMarkJump').length === 1)}`);
  void d0;

  out('301) Golpe de Misericórdia: caveira em quem tem pouca vida; o golpe forte executa e cura');
  fresh(); yield 0.1; give('w_ada28');
  const mc = dummy(2.6, 2.5, 'minion', 100); mc.hp = 20;
  const mf = dummy(-4, -4, 'minion', 100);
  yield 0.1;
  out(`  caveira ${ok(K.skulls.has(mc) && !K.skulls.has(mf))}`);
  out('  -> caveira (screenshot)');
  yield 'hold';
  player.hp = player.maxHp - 20;
  const hpm = player.hp;
  hit(2); yield 0.05;
  out(`  executou (mesmo fora do golpe) ${ok(!mc.alive && ev('rogueMercy').length === 1)} | curou 5 ${ok(player.hp === hpm + 5, player.hp - hpm)}`);

  out('302) Veneno Paralisante: as adagas envenenam; 5 acertos = paralisado');
  fresh(); yield 0.1; give('w_ada29');
  const vp = dummy(0, 0.4);
  hit(0); yield 0.05;
  out(`  envenenado ${ok(vp.poisonT > 0)}`);
  for (let i = 0; i < 4; i++) { hit(i % 2); yield 0.05; }
  out(`  paralisado ${ok(ev('rogueParalyze').length === 1 && vp.state === 'hurt', vp.state)}`);
  yield 1.0;
  out(`  o veneno machuca ${ok(ev('roguePoison').length >= 1)}`);

  out('303) Veneno de Cobra: envenenado que morre solta nuvem nos vizinhos');
  fresh(); yield 0.1; give('w_ada30');
  const c1 = dummy(0, 0.4, 'minion', 999), c2 = dummy(1.8, -0.8), c3 = dummy(-8, -8);
  hit(0); yield 0.05;
  c1.hp = 1; yield 0.6;
  out(`  morreu do veneno: nuvem ${ok(!c1.alive && ev('rogueCobra').length === 1)}`);
  out('  -> nuvem de veneno (screenshot)');
  yield 'hold';
  yield 0.3;
  out(`  pegou o vizinho ${ok(c2.poisonT > 0)} | e não o de longe ${ok(!(c3.poisonT > 0))}`);

  out('304) Duas Adagas com as 30: sem erros');
  fresh({ moveDir: dirTo(0, -1) }); yield 0.1;
  for (const b of mine) if (b.id !== 'w_ada17') for (let i = 0; i < b.max; i++) player.addBlessing(b);
  const all = [];
  for (let i = 0; i < 6; i++) all.push(dummy(-3 + i * 1.2, -1 - (i % 2) * 1.5, i % 3 === 1 ? 'warrior' : 'minion', 40, false));
  all.push(dummy(0, -9, 'archer', 40, false));
  for (let t = 0; t < 30; t++) {
    const a = all.find((x) => x.alive) || all[0];
    player.facing = Math.atan2(a.position.x - player.position.x, a.position.z - player.position.z);
    hit(t % 3); if (t % 7 === 6) player.startDodge();
    if (t % 5 === 4) { player.iframes = 0; combat.hitPlayer(a, 5, { target: player }); }
    yield 0.25;
  }
  yield 2.5;
  const errs = (window.__game.errors || []).length - errs0;
  out(`  sem erros do jogo ${ok(errs === 0, errs)}`);
  player.input = realInput;
}
