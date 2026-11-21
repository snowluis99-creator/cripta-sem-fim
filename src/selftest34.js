// Teste automático, parte 34 (09/11/2026): Mangual e Escudo, 2ª leva (14 bênçãos do dono).
// Roda no fim dos testes do Mangual (tecla \ e Y).
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* flail2Tests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const cam = g.cam.camera;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('knight', 'mangual'); player.reset(0, 2); player.facing = Math.PI;
    clearStrip(-9, 9, -14, 6);
    combat.demo.list = [];
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion', hp = 999) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const once = () => { let n = 1; return () => (n-- > 0); };
  const C = () => player.hero.combo;
  const heavy = () => C()[C().length - 1];
  const dist = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
  const front = (d = 1.5) => ({ position: { x: player.position.x + Math.sin(player.facing) * d, y: 0, z: player.position.z + Math.cos(player.facing) * d }, alive: false, data: { boss: true } });
  const swingHeavy = () => { player.combo = C().length - 1; player.startAttack(cam); }; // golpe forte de verdade (estado attack)
  const K = combat.flail2;

  // ---------------- 433) Lista ----------------
  out('433) Mangual 2ª leva: as 14 bênçãos novas');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'knight.mangual' && !b.id.startsWith('w_kc') && !b.id.startsWith('w_kr') && !b.id.startsWith('w_r2') && !b.id.startsWith('w_e1') && !b.id.startsWith('w_e2') && !b.id.startsWith('w_l1')); // sem as comuns de 11/11 (selftest35)
  const by = (n) => mine.find((b) => b.name === n) || {};
  const want = { 'Laço de Ferro': 'epic', Algemas: 'rare', 'Strike!': 'rare', 'Bola Faminta': 'epic', 'Bola de Ossos': 'epic', Cometa: 'epic', 'Martelo Olímpico': 'epic', 'Bola no Poste': 'epic', 'Bola de Canhão': 'rare', 'Gaiola de Correntes': 'epic', 'Sino da Catedral': 'rare', 'Escudo Coletor': 'epic', 'Panela de Pressão': 'epic', Hidra: 'epic' };
  const bad = Object.keys(want).filter((n) => by(n).rarity !== want[n]);
  out(`  Mangual com ${mine.length} ${ok(mine.length === 23)} | as 14 com a raridade certa ${ok(!bad.length, bad.join(', '))}`);
  out(`  Laço/Gaiola/Hidra não vêm juntas ${ok((by('Laço de Ferro').excludes || []).includes('w_man24') && (by('Hidra').excludes || []).includes('w_man15'))}`);

  // ---------------- 434) Laço de Ferro ----------------
  out('434) Laço de Ferro: gira com o inimigo preso e arremessa');
  fresh(); yield 0.1;
  give('w_man15');
  const lz = dummy(0, 0.6), side = dummy(2.4, 2.0);
  swingHeavy();
  yield* until(() => player.state === 'flailSpin', 1500);
  out(`  agarrou ${ok(ev('flailLasso').length === 1 && ev('flailLasso')[0].enemy === lz && lz.state === 'fistHeld')} | girando ${ok(player.state === 'flailSpin')}`);
  yield 0.4;
  const rr = dist(player, lz);
  out(`  preso a ~2,3 de distância ${ok(Math.abs(rr - 2.3) < 0.3, rr.toFixed(2))}`);
  out('  -> girando com o esqueleto (screenshot)');
  yield 'hold';
  yield* until(() => ev('flailLassoThrow').length > 0, 2000);
  out(`  bateu no de perto ${ok(ev('flailLassoHit').some((x) => x.enemy === side))} | arremessou ${ok(ev('flailLassoThrow').length === 1)} | voando ${ok(lz.state === 'fistFly')}`);
  yield 1.0;
  out(`  caiu longe ${ok(dist(player, lz) > 5, dist(player, lz).toFixed(1))} | herói livre ${ok(player.state === 'idle' || player.state === 'run')}`);

  // ---------------- 435) Algemas ----------------
  out('435) Algemas: 2 acertados ficam acorrentados');
  fresh(); yield 0.1;
  give('w_man16');
  const ca = dummy(-1.2, 0.4), cb = dummy(1.2, 0.4);
  combat.playerStrike(player, C()[0]);
  out(`  algemou os dois ${ok(ev('flailCuffs').length === 1 && K.cuffs.length === 1)}`);
  const hb0 = cb.hp;
  ca.position.set(0, 0, 0.6); cb.position.set(4, 0, 4);
  flags.events.length = 0;
  combat.playerStrike(player, C()[0]);
  const shared = ev('bonus').find((x) => x.enemy === cb);
  out(`  o parceiro leva metade ${ok(!!shared && cb.hp < hb0, shared ? String(shared.dmg) : '-')}`);
  ca.position.set(-1, 0, -2); cb.position.set(1, 0, -2);
  yield* until(() => ev('flailHeadbutt').length > 0, 2500);
  out(`  deram cabeçada ${ok(ev('flailHeadbutt').length >= 1)}`);
  out('  -> corrente entre os dois (screenshot)');
  yield 'hold';
  yield 5.2;
  out(`  passou 5 s: soltou ${ok(K.cuffs.length === 0)}`);

  // ---------------- 436) Strike! ----------------
  out('436) Strike!: golpe forte manda rolando como pinos');
  fresh(); yield 0.1;
  give('w_man17');
  const pins = [];
  for (let i = 0; i < 6; i++) pins.push(dummy(-1.5 + (i % 3) * 1.5, 0.3 - Math.floor(i / 3) * 1.4));
  combat.playerStrike(player, heavy());
  out(`  lançou os atingidos ${ok(ev('flailBowl').length === 1 && ev('flailBowl')[0].n >= 5, ev('flailBowl').length ? String(ev('flailBowl')[0].n) : '-')}`);
  yield* until(() => ev('flailStrike').length > 0, 1500);
  out(`  STRIKE! ${ok(ev('flailStrike').length === 1)}`);
  out('  -> pinos voando (screenshot)');
  yield 'hold';
  fresh(); yield 0.1;
  give('w_man17');
  dummy(0, 0.4);
  combat.playerStrike(player, heavy());
  yield 1.3;
  out(`  com 1 só: sem strike ${ok(!ev('flailStrike').length)}`);

  // ---------------- 437) Bola Faminta ----------------
  out('437) Bola Faminta: parado 2 s, a bola morde sozinha');
  fresh(); yield 0.1;
  give('w_man18');
  player.input = fake();
  const fz = dummy(0, -1.5);
  const hf = fz.hp;
  yield 1.2;
  out(`  antes de 2 s não morde ${ok(!ev('flailBite').length)} | olhos na bola ${ok(K.faces.has(player))}`);
  yield* until(() => ev('flailBite').length > 0, 2000);
  out(`  mordeu ${ok(ev('flailBite').length === 1 && fz.hp < hf)}`);
  out('  -> bola com olhos mordendo (screenshot)');
  yield 'hold';
  player.input = realInput;

  // ---------------- 438) Bola de Ossos ----------------
  out('438) Bola de Ossos: crânios na bola');
  fresh(); yield 0.1;
  give('w_man19');
  for (let i = 0; i < 3; i++) { const e = dummy(i * 2 - 2, -3, 'minion', 5); e.die(); combat.killed(e, 0, 1, player); }
  const nb = player.f2 ? player.f2.bones.length : 0;
  out(`  3 crânios ${ok(nb === 3)} | +15% de dano ${ok(Math.abs(K.dmgMul(player) - 1.15) < 0.001)} | +9% de alcance ${ok(Math.abs(K.rangeMul(player) - 1.09) < 0.001)}`);
  const ball = player.weapon.userData.flail.ball;
  out(`  bola maior ${ok(ball.scale.x > 1.2, ball.scale.x.toFixed(2))}`);
  out('  -> crânios na bola (screenshot)');
  yield 'hold';
  player.iframes = 0;
  combat.hitPlayer(front(), 5, { target: player });
  out(`  tomou dano: caíram 2 ${ok(player.f2.bones.length === 1)}`);

  // ---------------- 439) Cometa ----------------
  out('439) Cometa: bola esquenta e o golpe forte chama um cometa');
  fresh(); yield 0.1;
  give('w_man20');
  const cm = dummy(0, -2.0, 'minion', 999);
  for (let i = 0; i < 8; i++) { combat.playerStrike(player, C()[0]); yield 0.05; }
  yield 0.3;
  const body = player.weapon.userData.flail.ball.children[0];
  out(`  esquentou (8) ${ok(player.f2.heat >= 7.5, player.f2.heat.toFixed(1))} | bola branca ${ok(body.material.emissiveIntensity > 2, `${body.material.emissiveIntensity} ${body.material.emissive.getHexString()} ${player.weapon.userData.flail.ball.children.length}`)}`);
  out('  -> bola em brasa (screenshot)');
  yield 'hold';
  const hc = cm.hp;
  combat.playerStrike(player, heavy());
  out(`  cometa lançado ${ok(ev('flailComet').length === 1)} | esfriou ${ok(player.f2.heat === 0)}`);
  yield 0.5;
  out('  -> cometa caindo (screenshot)');
  yield 'hold';
  yield* until(() => ev('flailCometHit').length > 0, 1500);
  out(`  caiu e machucou ${ok(ev('flailCometHit').length === 1 && cm.hp < hc - 20, `${hc - cm.hp}`)}`);
  cm.position.set(0, 0, 0.6);
  for (let i = 0; i < 5; i++) { combat.playerStrike(player, C()[0]); yield 0.05; }
  const h5 = player.f2.heat;
  yield 3;
  out(`  parado esfria ${ok(player.f2.heat < h5 - 2, `${h5.toFixed(1)} -> ${player.f2.heat.toFixed(1)}`)}`);

  // ---------------- 440) Martelo Olímpico ----------------
  out('440) Martelo Olímpico: segura para girar, solta para lançar');
  fresh(); yield 0.1;
  give('w_man21');
  const ring = dummy(2.6, 2.0), lane = dummy(0, -3.5), far2 = dummy(0, -7.5);
  player.input = fake({ attack: once(), attackHeld: () => true });
  yield* until(() => player.state === 'flailSpin', 1500);
  out(`  começou a girar ${ok(player.state === 'flailSpin' && ev('flailHammer').length === 1)}`);
  yield 1.4;
  const turns = player.f2.spin ? player.f2.spin.turns : 0;
  out(`  voltas ${ok(turns > 1.5, turns.toFixed(1))} | bola acertou quem estava na roda ${ok(ev('flailHammerHit').some((x) => x.enemy === ring))}`);
  out('  -> girando (screenshot)');
  yield 'hold';
  player.input = fake({ aimAngle: () => Math.PI });
  yield* until(() => ev('flailHammerThrow').length > 0, 800);
  yield* until(() => player.f2 && player.f2.ball && player.f2.ball.phase === 'rest', 1500);
  const bl = player.f2.ball;
  const bd = bl ? Math.hypot(bl.x - player.position.x, bl.z - player.position.z) : 0;
  out(`  soltou: bola longe ${ok(bd > 5, bd.toFixed(1))} | acertou no caminho ${ok(ev('flailHammerBall').length >= 1)} | herói livre ${ok(player.state === 'idle' || player.state === 'run')}`);
  out('  -> bola no chão presa pela corrente (screenshot)');
  yield 'hold';
  lane.position.set(bl.x * 0.5 + player.position.x * 0.5, 0, bl.z * 0.5 + player.position.z * 0.5);
  const sw0 = ev('swing').length;
  player.input = fake({ attack: once() });
  yield 0.05;
  const noAtk = player.state !== 'attack';
  yield* until(() => ev('flailHammerBack').length > 0, 2500);
  out(`  puxou de volta ${ok(ev('flailHammerPull').length === 1 && ev('flailHammerBack').length === 1)} | arrastou ${ok(ev('flailHammerDrag').length >= 1, String(ev('flailHammerDrag').length))} | não atacou ${ok(noAtk && ev('swing').length === sw0)}`);
  void far2;
  player.input = fake(); yield 0.3;
  player.input = fake({ attack: once(), attackHeld: () => true });
  yield* until(() => ev('flailDizzy').length > 0, 6000);
  out(`  girou demais: tonto ${ok(ev('flailDizzy').length === 1 && player.state === 'flailDizzy')}`);
  player.input = fake();
  yield 1.2;
  out(`  passou o tonto ${ok(player.state === 'idle' || player.state === 'run')}`);
  yield* until(() => !player.f2.ball || player.f2.ball.phase === 'rest', 1500);
  player.input = fake({ attack: once() }); yield* until(() => !player.f2.ball, 2500);
  player.input = fake();

  // ---------------- 441) Bola no Poste ----------------
  out('441) Bola no Poste: golpe forte perto de pilar = 2 voltas');
  fresh(); yield 0.1;
  give('w_man22');
  combat.demo.list = [{ x: 0, z: -0.6, r: 0.6, h: 4 }];
  const kick = dummy(2.9, -0.6);
  const p0 = { x: player.position.x, z: player.position.z };
  swingHeavy();
  yield* until(() => player.state === 'flailOrbit', 1500);
  out(`  prendeu no pilar ${ok(ev('flailPole').length === 1 && player.state === 'flailOrbit')} | sem dano girando ${ok(player.invulnerable)}`);
  yield 0.3;
  const moved = Math.hypot(player.position.x - p0.x, player.position.z - p0.z);
  out(`  andando em volta ${ok(moved > 1.5, moved.toFixed(1))}`);
  out('  -> girando em volta do pilar (screenshot)');
  yield 'hold';
  yield* until(() => player.state !== 'flailOrbit', 1500);
  const rp = Math.hypot(player.position.x, player.position.z + 0.6);
  out(`  chutou quem estava no caminho ${ok(ev('flailPoleKick').some((x) => x.enemy === kick))} | terminou perto do pilar ${ok(rp < 3.8, rp.toFixed(1))}`);
  fresh(); yield 0.1;
  give('w_man22');
  dummy(0, 0.5);
  swingHeavy();
  yield 0.8;
  out(`  sem pilar nem chefe: golpe normal ${ok(!ev('flailPole').length)}`);

  // ---------------- 442) Bola de Canhão ----------------
  out('442) Bola de Canhão: rolar = lançar a bola e ser puxado');
  fresh(); yield 0.1;
  give('w_man23');
  const land = dummy(0.3, -5.3);
  const z0 = player.position.z;
  player.input = fake({ dodge: once(), moveDir: (v) => v.set(0, 0, -1) });
  yield* until(() => player.state === 'flailFly', 800);
  out(`  saiu voando atrás da bola ${ok(player.state === 'flailFly' && ev('flailCannon').length === 1)} | sem dano ${ok(player.invulnerable)}`);
  yield 0.15;
  out('  -> puxado pela corrente (screenshot)');
  yield 'hold';
  yield* until(() => ev('flailCannonLand').length > 0, 1500);
  const went = z0 - player.position.z;
  out(`  foi longe ${ok(went > 6, went.toFixed(1))} | derrubou quem estava lá ${ok(land.state === 'axeDown')}`);
  player.input = fake(); yield 0.3;

  // ---------------- 443) Gaiola de Correntes ----------------
  out('443) Gaiola: dentro não sai, fora não entra');
  fresh(); yield 0.1;
  give('w_man24');
  const inn = dummy(0, 0.2), outE = dummy(0, -7);
  combat.playerStrike(player, heavy());
  const cg = K.cages[0];
  out(`  gaiola levantada ${ok(ev('flailCage').length === 1 && !!cg)} | quem estava dentro ${ok(cg && cg.inside.has(inn) && !cg.inside.has(outE))}`);
  yield 0.3;
  inn.position.set(0, 0, -6);
  outE.position.set(cg.x + 0.6, 0, cg.z + 0.3);
  yield 0.05;
  const di = Math.hypot(inn.position.x - cg.x, inn.position.z - cg.z), dO = Math.hypot(outE.position.x - cg.x, outE.position.z - cg.z);
  out(`  o de dentro ficou dentro ${ok(di < cg.r, di.toFixed(1))} | o de fora ficou fora ${ok(dO > cg.r - 0.2, dO.toFixed(1))}`);
  out('  -> gaiola (screenshot)');
  yield 'hold';
  combat.playerStrike(player, heavy());
  out(`  recarga: não faz outra ${ok(K.cages.length === 1)}`);
  yield 5.2;
  out(`  5 s: sumiu ${ok(K.cages.length === 0)}`);

  // ---------------- 444) Sino da Catedral ----------------
  out('444) Sino da Catedral: atacar bloqueando = DONG');
  fresh(); yield 0.1;
  give('w_man25');
  const bfar = dummy(0, -6), bfar2 = dummy(4, -3);
  player.input = fake({ blocking: () => true }); yield 0.2;
  player.input = fake({ blocking: () => true, attack: once() });
  yield* until(() => ev('flailBell').length > 0, 1000);
  out(`  [diag] ${player.state} ${player.xstep ? player.xstep.flail2 : '-'} cd ${player.f2 ? player.f2.bellCd : '-'} ${ev('swing').length}`);
  out(`  tocou ${ok(ev('flailBell').length === 1 && ev('flailBell')[0].n === 2)}`);
  out('  -> sino (screenshot)');
  yield 'hold';
  yield* until(() => ev('flailBellStun').length >= 2, 2500);
  out(`  vieram correndo e ficaram atordoados ${ok(ev('flailBellStun').length >= 2, `${dist(player, bfar).toFixed(1)} / ${dist(player, bfar2).toFixed(1)}`)}`);
  player.input = fake({ blocking: () => true }); yield 0.6;
  player.input = fake({ blocking: () => true, attack: once() }); yield 0.3;
  out(`  recarga: não tocou de novo ${ok(ev('flailBell').length === 1)}`);
  player.input = fake(); yield 0.6;

  // ---------------- 445) Escudo Coletor ----------------
  out('445) Escudo Coletor: flechas presas voltam no golpe forte');
  fresh(); yield 0.1;
  give('w_man26');
  const arc = combat.spawn('archer', 0, -9, { awake: true, passive: true, facing: 0 }); arc.hp = arc.maxHp = 999;
  player.input = fake({ blocking: () => true }); yield 0.2;
  for (let i = 0; i < 3; i++) { combat.projectiles.fire(0, 0.2, 0, { speed: 14, damage: 6, kind: 'arrow', owner: arc, silent: true }); yield 0.25; }
  out(`  guardou 3 ${ok(ev('flailCollect').length === 3 && player.f2.shots.length === 3)}`);
  out('  -> flechas no escudo (screenshot)');
  yield 'hold';
  player.input = fake(); yield 0.2;
  combat.playerStrike(player, heavy());
  const back = combat.projectiles.list.filter((a) => a.hits === 'hero');
  out(`  devolveu as 3 ${ok(ev('flailCollectFire').length === 1 && back.length === 3 && player.f2.shots.length === 0)}`);
  combat.projectiles.clear();

  // ---------------- 446) Panela de Pressão ----------------
  out('446) Panela de Pressão: 5 bloqueios = vapor e chão escorregadio');
  fresh(); yield 0.1;
  give('w_man27');
  const sl = dummy(1.5, 0.5);
  player.input = fake({ blocking: () => true }); yield 0.2;
  for (let i = 0; i < 4; i++) { combat.hitPlayer(front(), 4, { target: player }); yield 0.05; }
  out(`  4 bloqueios: ainda não ${ok(!ev('flailSteam').length && player.f2.pressure === 4)}`);
  combat.hitPlayer(front(), 4, { target: player });
  out(`  5º: explodiu ${ok(ev('flailSteam').length === 1 && player.f2.pressure === 0)} | chão molhado ${ok(K.slicks.length === 1)}`);
  yield* until(() => ev('flailSlip').length > 0, 1500);
  out(`  escorregou e sentou ${ok(ev('flailSlip').some((x) => x.enemy === sl) && sl.state === 'fistSit')}`);
  out('  -> vapor e esqueleto sentado (screenshot)');
  yield 'hold';
  player.input = fake(); yield 0.1;

  // ---------------- 447) Hidra ----------------
  out('447) Hidra: 3 cabeças atrás de 3 inimigos');
  fresh(); yield 0.1;
  give('w_man28');
  const hy = [dummy(-4, -2), dummy(0, -4), dummy(4, -2)];
  yield 0.2;
  out(`  cabeças extras penduradas ${ok(K.extra.has(player) && K.extra.get(player).length === 2)}`);
  combat.playerStrike(player, heavy());
  out(`  soltou as cabeças ${ok(ev('flailHydra').length === 1 && K.heads.length === 3)}`);
  yield 0.15;
  out('  -> 3 cabeças voando (screenshot)');
  yield 'hold';
  yield 0.5;
  const got = new Set(ev('flailHydraHit').map((x) => x.enemy));
  out(`  cada uma pegou um diferente ${ok(hy.every((e) => got.has(e)), String(got.size))} | voltaram ${ok(K.heads.length === 0)}`);

  player.input = realInput;
  fresh();
}
