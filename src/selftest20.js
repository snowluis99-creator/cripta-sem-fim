// Teste automático, parte 20 (06/11/2026): bênçãos da Lança (lista do dono).
// Tecla Y = tudo; tecla ] (fecha colchete) = só a Lança.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { wbDamage } from './wbhooks.js';
import { lancePress } from './lancekit.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* lanceTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const cam = g.cam.camera;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('knight', 'lanca'); player.reset(0, 2); player.facing = Math.PI;
    clearStrip(-6, 6, -14, 5);
    player.input = fake();
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion', hp = 999) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const C = () => player.hero.combo;
  const dist = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
  const hits = (e) => flags.events.filter((x) => (x.type === 'hit' || x.type === 'bonus') && x.enemy === e);
  const errs0 = (window.__game.errors || []).length;

  // ---------------- 127) Lista ----------------
  out('127) Lança: bênçãos do dono');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'knight.lanca');
  const by = (n) => mine.find((b) => b.name === n) || {};
  const want = ['Ponta Doce', 'Pregar na Parede', 'Contra-Carga', 'Muralha de Pontas', 'Arpão', 'Espetinho', 'Lança Bumerangue', 'Lança Cravada', 'Salto com Vara', 'Salto do Dragão', 'Âncora',
    'Estandarte de Guerra', 'Cemitério de Lanças', 'Para-raios', 'Espinhos de Pedra', 'Estocada Fantasma', 'Mil Lanças', 'Molinete', 'Lança de Troféus', 'Domador', 'Lança do Dragão'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  out(`  ${mine.length} bênçãos ${ok(mine.length === 21)} | as 21 da lista ${ok(!miss.length, miss.join(', '))}`);
  out(`  raridades ${ok(by('Ponta Doce').rarity === 'rare' && by('Contra-Carga').rarity === 'epic' && by('Lança Bumerangue').rarity === 'legendary' && by('Mil Lanças').rarity === 'legendary' && by('Domador').rarity === 'epic' && by('Molinete').rarity === 'rare')}`
    + ` | Bumerangue não vem com Cravada/Âncora/Espetinho ${ok(['w_lan16', 'w_lan18', 'w_lan21'].every((id) => by('Lança Bumerangue').excludes.includes(id)))}`);

  // ---------------- 128) Ponta Doce ----------------
  out('128) Ponta Doce: ponta = crítico, de perto só empurra');
  fresh(); yield 0.1;
  give('w_lan11');
  const pn = dummy(0, 0.8);
  combat.playerStrike(player, C()[0]);
  out(`  de perto: sem dano ${ok(pn.hp === 999)} | empurrou ${ok(ev('lanceShove').length === 1 && pn.vel.length() > 1)}`);
  fresh(); yield 0.1; give('w_lan11');
  const pt = dummy(0, -2.6);
  combat.playerStrike(player, C()[0]);
  out(`  na ponta (${dist(player, pt).toFixed(1)}): crítico ${ok(ev('lanceSweet').length === 1 && pt.hp < 999)}`);
  fresh(); yield 0.1; give('w_lan11');
  const pm = dummy(0, -0.6);
  combat.playerStrike(player, C()[0]);
  out(`  no meio: dano normal, sem crítico garantido ${ok(pm.hp < 999 && !ev('lanceSweet').length && !ev('lanceShove').length)}`);

  // ---------------- 129) Pregar na Parede ----------------
  out('129) Pregar na Parede: estocada contra a parede prega 2 s');
  fresh(); yield 0.1;
  give('w_lan12');
  combat.world.addRect(-3, -0.6, 3, -0.1);
  const nl = dummy(0, 0.5);
  combat.playerStrike(player, C()[0]);
  const nx0 = nl.position.z;
  out(`  pregou ${ok(ev('lanceNail').length === 1 && nl.state === 'hurt' && nl.stunTime >= 1.9, nl.stunTime && nl.stunTime.toFixed(2))}`);
  yield 0.4;
  out('  -> pregado na parede (screenshot)');
  yield 'hold';
  yield 1.0;
  out(`  continua parado no lugar ${ok(nl.state === 'hurt' && Math.abs(nl.position.z - nx0) < 0.05)}`);
  fresh(); yield 0.1; give('w_lan12');
  const nl2 = dummy(0, 0.5);
  combat.playerStrike(player, C()[0]);
  out(`  sem parede atrás: não prega ${ok(!ev('lanceNail').length && nl2.state !== 'lanceHeld')}`);

  // ---------------- 130) Contra-Carga ----------------
  out('130) Contra-Carga: quem vem correndo leva o triplo e para');
  fresh(); yield 0.1;
  give('w_lan13');
  const cc = dummy(0, -0.5, 'warrior');
  const mulN = wbDamage(player, cc, C()[0], {}).mul;
  cc.state = 'charge';
  const mulC = wbDamage(player, cc, C()[0], {}).mul;
  cc.lanceCounter = false;
  combat.playerStrike(player, C()[0]);
  out(`  normal ×${mulN.toFixed(1)} -> correndo ×${mulC.toFixed(1)} ${ok(mulN === 1 && mulC === 3)} | parou ${ok(ev('lanceCounter').length === 1 && cc.state === 'hurt' && cc.stunTime >= 1.1)}`);

  // ---------------- 131) Muralha de Pontas ----------------
  out('131) Muralha de Pontas: parado 1 s = em guarda, espeta quem chega');
  fresh(); yield 0.1;
  give('w_lan14');
  player.setState('idle');
  const mw = dummy(0, -1.5);
  yield 0.6;
  out(`  antes de 1 s: nada ${ok(!ev('lanceWallStab').length)}`);
  yield 0.7;
  out(`  em guarda ${ok(ev('lanceGuard').length === 1)} | espetou sozinho ${ok(ev('lanceWallStab').length >= 1 && mw.hp < 999)}`);
  out('  -> em guarda (screenshot)');
  yield 'hold';

  // ---------------- 132) Arpão ----------------
  out('132) Arpão: golpe forte puxa o mago lá de trás');
  fresh(); yield 0.1;
  give('w_lan15');
  const mg = combat.spawn('mage', 0, -9, { awake: true, passive: true, facing: 0 }); mg.hp = mg.maxHp = 999;
  const dm0 = dist(player, mg);
  combat.playerStrike(player, C()[2]);
  out(`  arpão lançado ${ok(combat.kit.hooks.length === 1)}`);
  yield* until(() => combat.kit.hooks.length === 0, 2500);
  out(`  puxou ${ok(dist(player, mg) < 2.8, `${dm0.toFixed(1)} -> ${dist(player, mg).toFixed(1)}`)}`);

  // ---------------- 133) Espetinho ----------------
  out('133) Espetinho: espeta e arremessa o corpo');
  fresh(); yield 0.1;
  give('w_lan16');
  const sk = dummy(0, 0.4, 'minion', 999), tgt = dummy(0, -6, 'minion', 999);
  combat.playerStrike(player, C()[2]);
  yield 0.2;
  out(`  na ponta ${ok(sk.state === 'lanceHeld' && player.lanceHeld === sk && !sk.targetable)}`);
  out('  -> esqueleto espetado (screenshot)');
  yield 'hold';
  player.combo = 0; player.startAttack(cam);
  out(`  próximo golpe = arremesso ${ok(player.xstep && player.xstep.kit === 'lanceSkewerThrow')}`);
  yield* until(() => ev('lanceBodyHit').length > 0, 2500);
  out(`  acertou o de trás ${ok(ev('lanceBodyHit').length === 1 && ev('lanceBodyHit')[0].enemy === tgt && tgt.hp < 999)} | corpo também apanhou ${ok(sk.hp < 999 || !sk.alive)} | soltou ${ok(!player.lanceHeld && sk.state !== 'lanceHeld')}`);

  // ---------------- 134) Lança Bumerangue ----------------
  out('134) Lança Bumerangue: vai, atravessa e volta');
  fresh(); yield 0.1;
  give('w_lan17');
  const b1 = dummy(0, -0.8), b2 = dummy(0.3, -4);
  out(`  golpe forte vira arremesso ${ok(C()[2].kit === 'lanceBoomer')}`);
  player.combo = 2; player.startAttack(cam);
  yield* until(() => ev('lanceBoomer').length > 0, 1500);
  out(`  arremessou ${ok(player.axeAway && !player.weapon.visible)}`);
  yield 0.25;
  out('  -> lança voando (screenshot)');
  yield 'hold';
  yield* until(() => !player.axeAway, 3000);
  const bh = ev('lanceBoomerHit');
  out(`  voltou para a mão ${ok(!player.axeAway && player.weapon.visible)} | acertou os 2 na ida e na volta ${ok(bh.filter((x) => x.enemy === b1).length === 2 && bh.filter((x) => x.enemy === b2).length === 2, bh.length)}`);

  // ---------------- 135) Lança Cravada ----------------
  out('135) Lança Cravada: crava, dá choque, socos até buscar');
  fresh(); yield 0.1;
  give('w_lan18');
  player.combo = 2; player.startAttack(cam);
  yield* until(() => ev('lanceLanded').length > 0, 2000);
  const sp = combat.lance.planted[0];
  out(`  cravou ${ok(!!sp && sp.phase === 'ground' && player.lanceAway === 'planted')}`);
  yield* until(() => player.state !== 'attack', 1500); yield 0.05;
  out(`  sem a lança: socos ${ok(C()[0].kit === 'lancePunch' && !player.weapon.visible)}`);
  const sh = dummy(sp.g.position.x + 1.2, sp.g.position.z);
  yield 1.4;
  out(`  choque em quem passa perto ${ok(ev('lanceShock').length >= 1 && sh.hp < 999)}`);
  out('  -> lança cravada (screenshot)');
  yield 'hold';
  player.position.set(sp.g.position.x, 0, sp.g.position.z + 0.5);
  yield 0.2;
  out(`  foi buscar: lança na mão ${ok(ev('lancePick').length === 1 && !player.lanceAway && !C()[0].kit && player.weapon.visible)}`);

  // ---------------- 136) Salto com Vara ----------------
  out('136) Salto com Vara: rolar até o inimigo = pula por cima');
  fresh(); yield 0.1;
  give('w_lan19');
  const vt = dummy(0, -0.6);
  player.startDodge();
  out(`  saltou ${ok(player.state === 'lanceVault' && ev('lanceVault').length === 1)}`);
  yield 0.25;
  out('  -> no ar (screenshot)');
  yield 'hold';
  yield* until(() => player.state !== 'lanceVault', 1500);
  const face = Math.atan2(vt.position.x - player.position.x, vt.position.z - player.position.z);
  out(`  caiu nas costas ${ok(player.position.z < vt.position.z - 0.5, player.position.z.toFixed(1))} | virado para ele ${ok(Math.abs(Math.atan2(Math.sin(player.facing - face), Math.cos(player.facing - face))) < 0.2)} | pronto (crítico) ${ok(player.lanceReadyT > 0)}`);
  const vh = vt.hp;
  combat.playerStrike(player, C()[0]);
  out(`  golpe crítico ${ok(vt.hp < vh && !(player.lanceReadyT > 0))}`);

  // ---------------- 137) Salto do Dragão ----------------
  out('137) Salto do Dragão: atacar depois de rolar = salto que crava');
  fresh(); yield 0.1;
  give('w_lan20');
  const d1 = dummy(0, -1.6), d2 = dummy(1.3, -2.3);
  out(`  sem rolar antes: golpe normal ${ok(!lancePress(player, cam))}`);
  player.lanceSinceDodge = 0.1;
  out(`  logo depois de rolar: salta ${ok(lancePress(player, cam) && player.state === 'lanceLeap')}`);
  yield 0.3;
  out('  -> salto alto (screenshot)');
  yield 'hold';
  yield* until(() => ev('lanceSlam').length > 0, 1500);
  out(`  cravou com dano em área ${ok(ev('lanceSlam')[0] && ev('lanceSlam')[0].n === 2 && d1.hp < 999 && d2.hp < 999)}`);
  yield* until(() => player.state !== 'lanceLeap', 1000);
  out(`  terminou ${ok(player.state === 'idle' || player.state === 'run')}`);

  // ---------------- 138) Âncora ----------------
  out('138) Âncora: crava a lança e gira chutando em volta');
  fresh(); yield 0.1;
  give('w_lan21');
  const an = [dummy(0, 0.3), dummy(1.6, 1.4), dummy(-1.6, 1.4), dummy(0, 4)];
  const ad0 = an.map((e) => Math.hypot(e.position.x, e.position.z - 0.9));
  player.combo = 2; player.startAttack(cam);
  yield 0.2;
  out(`  lança cravada na frente ${ok(!!player.lanceAnchor && !player.weapon.visible)}`);
  out('  -> girando em volta da lança (screenshot)');
  yield 'hold';
  yield* until(() => player.state !== 'attack', 2000);
  yield 0.3;
  const moved = an.filter((e, i) => Math.hypot(e.position.x, e.position.z - 0.9) > ad0[i] + 1);
  out(`  chute em volta ${ok(ev('lanceAnchor').length === 1 && ev('lanceAnchor')[0].n >= 3, ev('lanceAnchor')[0] && ev('lanceAnchor')[0].n)} | afastou todo mundo ${ok(moved.length >= 3, moved.length)} | lança volta para a mão ${ok(!player.lanceAnchor && player.weapon.visible)}`);

  // ---------------- 139) Estandarte de Guerra ----------------
  out('139) Estandarte de Guerra: matar com o golpe forte deixa bandeira');
  fresh(); yield 0.1;
  give('w_lan22');
  const bn = dummy(0, 0.6, 'minion', 5);
  combat.playerStrike(player, C()[0]);
  out(`  golpe fraco não deixa ${ok(!ev('lanceBanner').length)}`);
  const bn2 = dummy(0.5, 0.2, 'minion', 5);
  combat.playerStrike(player, C()[2]);
  out(`  golpe forte deixa ${ok(ev('lanceBanner').length === 1 && combat.lance.banners.length === 1)}`);
  void bn; void bn2;
  player.hp = 50;
  yield 1.2;
  out(`  perto: mais rápido ${ok(player.bannerBoost > 1.3 && player.moveMul > player.stats.speedMul)} | curando ${ok(player.hp > 50, player.hp)}`);
  out('  -> bandeira (screenshot)');
  yield 'hold';
  yield 5.2;
  out(`  some depois de 6 s ${ok(combat.lance.banners.length === 0 && player.bannerBoost === 1)}`);

  // ---------------- 140) Cemitério de Lanças ----------------
  out('140) Cemitério de Lanças: lança fantasma onde morreu');
  fresh(); yield 0.1;
  give('w_lan23');
  const gr = dummy(0, 0.6, 'minion', 3);
  combat.playerStrike(player, C()[0]);
  yield 0.1;
  out(`  ficou a lança fantasma ${ok(!gr.alive && combat.lance.graves.length === 1)}`);
  const gw = dummy(3, 0.6);
  yield 0.8;
  gw.position.set(0, 0, 0.6);
  yield 0.2;
  out(`  espetou quem pisou ${ok(ev('lanceGraveHit').length === 1 && gw.hp < 999)}`);

  // ---------------- 141) Para-raios ----------------
  out('141) Para-raios: a cada 5 estocadas, um raio');
  fresh(); yield 0.1;
  give('w_lan24');
  const rd = dummy(0, -0.5);
  for (let i = 0; i < 4; i++) { combat.playerStrike(player, C()[i % 2]); yield 0.05; }
  out(`  4 estocadas: nada ${ok(!ev('lanceRod').length)}`);
  combat.playerStrike(player, C()[0]);
  out(`  5ª: raio ${ok(ev('lanceRod').length === 1 && ev('lanceRod')[0].enemy === rd)}`);
  yield 0.05;
  out('  -> raio (screenshot)');
  yield 'hold';

  // ---------------- 142) Espinhos de Pedra ----------------
  out('142) Espinhos de Pedra: fileira de espinhos além do alcance');
  fresh(); yield 0.1;
  give('w_lan25');
  const sf = dummy(0.3, -7.5);
  combat.playerStrike(player, C()[2]);
  yield 0.3;
  out('  -> espinhos (screenshot)');
  yield 'hold';
  yield 0.4;
  out(`  acertou longe (${dist(player, sf).toFixed(1)}) ${ok(ev('lanceSpikeHit').some((x) => x.enemy === sf) && sf.hp < 999)}`);

  // ---------------- 143) Estocada Fantasma ----------------
  out('143) Estocada Fantasma: repete o golpe 0,5 s depois');
  fresh(); yield 0.1;
  give('w_lan26');
  combat.playerStrike(player, C()[0]);
  const gh = dummy(0, -1.0);
  yield 0.2;
  out(`  ainda não acertou ${ok(gh.hp === 999)}`);
  yield 0.45;
  out(`  quem entrou depois levou ${ok(ev('lanceGhost').length === 1 && ev('lanceGhost')[0].n === 1 && gh.hp < 999)}`);

  // ---------------- 144) Mil Lanças ----------------
  out('144) Mil Lanças: 3 golpes no mesmo inimigo = rajada');
  fresh(); yield 0.1;
  give('w_lan27');
  const ml = dummy(0, 0.2, 'minion', 9999);
  ml.data = { ...ml.data, knockback: 0 };
  player.input = fake({ attack: () => true });
  yield* until(() => ev('lanceFlurry').length > 0, 4000);
  player.input = fake();
  out(`  rajada ${ok(ev('lanceFlurry').length === 1)}`);
  yield 0.2;
  out('  -> rajada de estocadas (screenshot)');
  yield 'hold';
  yield 0.6;
  const fh = flags.events.filter((x) => x.type === 'hit' && x.enemy === ml).length;
  out(`  ${fh} acertos (3 + 7) ${ok(fh >= 10, fh)}`);
  yield* until(() => player.state !== 'attack', 1500);

  // ---------------- 145) Molinete ----------------
  out('145) Molinete: ataque logo depois do golpe forte = giro que rebate');
  fresh(); yield 0.1;
  give('w_lan28');
  player.input = fake({ attack: () => true });
  yield* until(() => ev('lanceMolinete').length > 0, 4000);
  player.input = fake();
  out(`  girou ${ok(ev('lanceMolinete').length === 1 && player.xstep && player.xstep.kit === 'lanceMolinete')}`);
  combat.projectiles.fire(player.position.x, player.position.z - 1.5, 0, { speed: 0.01, damage: 10, kind: 'arrow', owner: null, silent: true });
  yield 0.1;
  out(`  rebateu a flecha ${ok(ev('lanceReflect').length >= 1)}`);
  combat.projectiles.clear();
  yield* until(() => player.state !== 'attack', 1500);

  // ---------------- 146) Lança de Troféus ----------------
  out('146) Lança de Troféus: crânios na lança viram bombas');
  fresh(); yield 0.1;
  give('w_lan29');
  for (let i = 0; i < 4; i++) { dummy(0, 0.6, 'minion', 1); combat.playerStrike(player, C()[0]); yield 0.05; }
  out(`  3 crânios no máximo ${ok(player.lanceSkulls === 3 && combat.lance.mounts.get(player).length === 3)}`);
  out('  -> crânios na lança (screenshot)');
  yield 'hold';
  const tb = [dummy(-1.5, -4.5), dummy(0, -4.6), dummy(1.5, -4.5)];
  combat.playerStrike(player, C()[2]);
  out(`  golpe forte arremessa ${ok(player.lanceSkulls === 0 && combat.lance.bombs.length === 3)}`);
  yield 0.9;
  out(`  3 explosões ${ok(ev('lanceSkullBoom').length === 3 && tb.filter((e) => e.hp < 999).length >= 2)}`);

  // ---------------- 147) Domador ----------------
  out('147) Domador: golpe forte em quem tem pouca vida = muda de lado');
  fresh(); yield 0.1;
  give('w_lan30');
  const tm = dummy(0, 0.6, 'minion', 100);
  combat.playerStrike(player, C()[2]);
  out(`  com vida alta: não ${ok(!tm.undead)}`);
  yield 0.6;
  tm.hp = 40;
  combat.playerStrike(player, C()[2]);
  out(`  com pouca vida: domado ${ok(tm.undead === player && tm.tamed && ev('lanceTame').length === 1)}`);
  const foe = dummy(0, -3, 'minion', 999);
  void foe;
  yield 0.3;
  out(`  a lança não acerta mais ele ${ok(!tm.targetable)}`);

  // ---------------- 148) Todas juntas ----------------
  out('148) Lança: todas as bênçãos juntas (sem erro)');
  fresh(); yield 0.1;
  for (const b of mine) for (let k = 0; k < b.max; k++) player.addBlessing(b);
  for (let i = 0; i < 5; i++) dummy(-1.2 + i * 0.6, 0.4 - (i % 2) * 1.2, i === 2 ? 'warrior' : 'minion', 60);
  player.iframes = 99;
  let swings = 0;
  try {
    player.input = fake({ attack: () => true });
    yield 3;
    player.input = fake({ attack: () => true, dodge: (() => { let n = 1; return () => n-- > 0; })() });
    yield 1.5;
    player.input = fake();
    for (let t = 0; t < 9; t++) { combat.playerStrike(player, C()[t % C().length]); swings++; yield 0.15; }
    for (const e of [...combat.enemies]) if (e.alive && !e.undead) { e.die(); combat.killed(e, 0, 1, player); }
    yield 1;
  } catch (e) { out(`  ERRO ${e.message}`); }
  player.iframes = 0;
  combat.clear(); yield 0.1;
  out(`  sem erros do jogo ${ok((window.__game.errors || []).length === errs0, (window.__game.errors || []).slice(errs0).join(' | '))} | sala limpa: lança na mão ${ok(!player.lanceAway && !player.axeAway)}`);
  player.input = realInput;
  fresh(); player.input = realInput;
}
