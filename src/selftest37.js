// Teste automático, parte 37 (11/11/2026): bênçãos COMUNS das 5 armas do Ladino (50, rcbless.js / rckit.js).
// Tecla F9 = só estes; e no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { rcS } from './rckit.js';

const ok = (c, extra = '') => (c ? `✔${extra !== '' ? ` ${extra}` : ''}` : `ERRO${extra !== '' ? ` (${extra})` : ''}`);

export function* rcTests(g, out, flags) {
  const { player, combat, waves } = g;
  const R = g.rogue, K = combat.rc;
  const realInput = player.input;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const fresh = (weapon) => {
    realRandom();
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('rogue', weapon); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    clearStrip(-13, 13, -16, 8);
    combat.props.list = combat.props.list.filter((b) => Math.abs(b.x) > 13 || b.z < -16 || b.z > 8);
    R.clear(); R.refill(player);
    player.input = fake();
    player.iframes = 0; player.ult = 0;
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion', hp = 999, keepShield = false, passive = true) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing: 0 }); e.hp = e.maxHp = hp; if (!keepShield) e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const C = () => player.hero.combo;
  const strike = (i = 0) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const hitsOn = (e) => ev('hit').filter((x) => x.enemy === e);
  const lastDmg = (e) => { const h = hitsOn(e); return h.length ? h[h.length - 1].dmg : 0; };
  const shot = (a = null) => { R.fire(player, C()[0], a); return R.items[R.items.length - 1]; };
  const ground = (x, z) => { const it = shot(); R.toGround(it, x, z); return it; };
  const ammo = (...st) => { player.ammo = st.map((s) => ({ stack: s })); };
  const at = (x, z, f = Math.PI) => { player.position.x = x; player.position.z = z; player.facing = f; player.group.rotation.y = f; };
  const roll = function* (t = 0.4) { player.startDodge(); yield t; };
  let rnd = null;
  const fixRandom = (v) => { if (!rnd) rnd = Math.random; Math.random = () => v; };
  const realRandom = () => { if (rnd) Math.random = rnd; rnd = null; };
  const S = () => rcS(player);
  const wall = (minX, minZ, maxX, maxZ) => combat.world.addRect(minX, minZ, maxX, maxZ);
  const errs0 = (window.__game.errors || []).length;

  // ---------- 570) Lista ----------
  out('570) Comuns do Ladino: as 50 bênçãos novas');
  const rc = WEAPON_BLESSINGS.filter((b) => b.id.startsWith('w_rc'));
  const per = ['adagas', 'kunai', 'garras', 'rapieira', 'besta'].map((w) => rc.filter((b) => b.weapon === `rogue.${w}`).length);
  out(`  ${rc.length} bênçãos ${ok(rc.length === 50)} | 10 por arma ${ok(per.join() === '10,10,10,10,10', per.join('/'))} | todas comuns ${ok(rc.every((b) => b.rarity === 'common'))} | textos ${ok(rc.every((b) => b.desc(1).length > 10 && b.desc(b.max).length > 10))}`);
  const one = ['Dança Curta', 'Pegada Rápida', 'Adaga Amaldiçoada', 'Mira Treinada', 'Estoque Escondido', 'Rasgo Final', 'Unhas Grudentas', 'Salto Felino', 'Instinto', 'Toque Final', 'Virote Magnético'];
  out(`  máx. 1: ${one.length} ${ok(one.every((n) => rc.find((b) => b.name === n).max === 1))} | as outras vão até 3 ${ok(rc.filter((b) => b.max !== 1).length === 39)}`);

  // ================= Duas Adagas =================
  out('571) Crítico Encadeado: cada crítico soma chance; o golpe sem crítico zera');
  fresh('adagas'); yield 0.1; give('w_rca1', 3);
  const ce = dummy(0, 0.4);
  fixRandom(0.0); strike(0); strike(0); strike(0);
  const ch3 = S().chain;
  strike(0); strike(0);
  const ch5 = S().chain;
  fixRandom(0.99); strike(0);
  out(`  3 críticos: +${Math.round(ch3 * 100)}% ${ok(Math.abs(ch3 - 0.45) < 0.001)} | teto +60% ${ok(Math.abs(ch5 - 0.6) < 0.001)} | sem crítico zera ${ok(S().chain === 0)}`);
  void ce;

  out('572) Sequência Mortal: o 2º golpe sangra (N3)');
  fresh('adagas'); yield 0.1; give('w_rca2', 3);
  const sq = dummy(0, 0.4);
  fixRandom(0.99); strike(0);
  const b0 = sq.bleedStacks || 0;
  strike(1);
  out(`  1º golpe não ${ok(b0 === 0)} | 2º golpe sangra ${ok(sq.bleedStacks >= 1 && ev('rcSeqBleed').length === 1)}`);

  out('573) Rolar e Cortar: o atravessado fica vulnerável (N3: 9 s, +105%)');
  fresh('adagas'); yield 0.1; give('w_rca3', 3);
  const rv = dummy(0, -1.2);
  yield* roll();
  out(`  vulnerável ${ok(rv.rcVulnT > 8 && ev('rcVuln').length === 1, (rv.rcVulnT || 0).toFixed(1))} | ícone ${ok(!!(rv.rcIcons && rv.rcIcons.vuln))}`);
  out('  -> marca de vulnerável (screenshot)');
  yield 'hold';
  at(0, 0.3); fixRandom(0.5); strike(0);
  const vd1 = lastDmg(rv);
  player.sneakCrit = true; strike(0); // já ia ser crítico
  const vd2 = lastDmg(rv);
  out(`  golpe comum vira crítico: ${vd1} ${ok(vd1 === 14)} | já era crítico: ${vd2} ${ok(vd2 === 29 && ev('rcVulnBonus').length === 1)}`);

  out('574) Veneno Fraco: crítico envenena (N3: 6/s); morreu envenenado passa para outro');
  fresh('adagas'); yield 0.1; give('w_rca4', 3);
  const vn = dummy(0, 0.4, 'minion', 999), vn2 = dummy(1.5, -1.2, 'minion', 999);
  fixRandom(0.0); strike(0);
  out(`  envenenado ${ok(vn.poisonT > 0 && Math.round(vn.poisonDps) === 6, vn.poisonDps)}`);
  vn.hp = 1; strike(0);
  out(`  morreu: veneno passou ${ok(!vn.alive && vn2.poisonT > 0 && ev('rcPoisonPass').length === 1)}`);
  realRandom(); yield 1.1;
  out(`  vizinho perdendo vida ${ok(vn2.hp < 999, vn2.hp)}`);

  out('575) Primeiro Sangue: o 1º golpe em cada inimigo é crítico (N3)');
  fresh('adagas'); yield 0.1; give('w_rca5', 3);
  const fb = dummy(0, 0.4);
  fixRandom(0.5); strike(0); const fd1 = lastDmg(fb); strike(0); const fd2 = lastDmg(fb);
  out(`  1º golpe ${fd1} ${ok(fd1 === 14 && ev('rcFirstBlood').length === 1)} | 2º golpe ${fd2} ${ok(fd2 === 7)}`);

  out('576) Corte de Saída: abate deixa fora da visão (N3: 1,5 s)');
  fresh('adagas'); yield 0.1; give('w_rca6', 3);
  const cs = dummy(0, 0.4, 'minion', 1);
  fixRandom(0.5); strike(0);
  out(`  sumiu ${ok(!cs.alive && player.vanishT >= 1.4 && player.invulnerable && ev('rcExitCut').length === 1, (player.vanishT || 0).toFixed(2))}`);

  out('577) Mãos Ladras: crítico solta poção (no máximo 1 por inimigo)');
  fresh('adagas'); yield 0.1; give('w_rca7', 3);
  const drops = [], onDrop0 = combat.props.onDrop;
  combat.props.onDrop = (pos) => drops.push(pos);
  const ml = dummy(0, 0.4);
  fixRandom(0.0); strike(0); strike(0);
  combat.props.onDrop = onDrop0;
  out(`  soltou poção ${ok(drops.length === 1 && ev('rcPotion').length === 1, drops.length)}`);

  out('578) Esquiva Afiada: rolar por dentro da flecha joga adaga no atirador');
  fresh('adagas'); yield 0.1; give('w_rca8', 3);
  const ar = dummy(0, -10, 'archer');
  combat.projectiles.fire(0, -1.5, 0, { speed: 14, damage: 10, kind: 'arrow', hits: 'player', owner: ar, height: 1.3 });
  yield* roll(0.15);
  yield* until(() => ev('rcKnifeHit').length > 0, 1500);
  out(`  adaga ${ok(ev('rcKnife').length === 1)} | acertou o arqueiro: 15 ${ok(ev('rcKnifeHit').length === 1 && ar.hp === 984, ar.hp)}`);

  out('579) Caça-Magos: golpe em mago é crítico e interrompe (N3: +60%)');
  fresh('adagas'); yield 0.1; give('w_rca9', 3);
  const mg = dummy(0, 0.4, 'mage');
  fixRandom(0.5); strike(0);
  out(`  crítico +60%: ${lastDmg(mg)} ${ok(lastDmg(mg) === 22)} | interrompido ${ok(ev('rcInterrupt').length === 1 && mg.kcSilT > 0)}`);

  out('580) Dança Curta: 4 golpes seguidos sem tomar dano = 5º é o golpe forte');
  fresh('adagas'); yield 0.1; give('w_rca10');
  dummy(0, 0.4);
  fixRandom(0.5); strike(0); strike(1); strike(2); strike(0);
  out(`  pronto ${ok(S().danceReady && ev('rcDanceReady').length === 1)}`);
  realRandom();
  player.combo = 1; player.startAttack(null);
  out(`  o 5º virou golpe forte ${ok(player.combo === player.hero.heavyIdx && ev('rcDance').length === 1, player.combo)}`);
  player.setState('idle');
  strike(0); strike(1); strike(2); strike(0);
  K.onHurt(player);
  out(`  tomar dano zera ${ok(!S().danceReady && S().dance === 0)}`);

  // ================= Kunais =================
  out('581) Corrente Explosiva: kunai ×5 explode ao acertar e não perde a corrente');
  fresh('kunai'); yield 0.1; give('w_rck1', 3);
  const ex = dummy(0, -5), ex2 = dummy(1.6, -5.6);
  ammo(5, 0);
  const ek = shot();
  yield* until(() => ev('rcKunaiBoom').length > 0, 1500);
  out(`  explodiu ${ok(ev('rcKunaiBoom').length === 1 && ex2.hp < 999, ex2.hp)} | corrente continua ×${ek.stack} ${ok(ek.stack === 6)}`);
  out('  -> explosão da kunai (screenshot)');
  yield 'hold';
  void ex;

  out('582) Pegada Rápida: pegar no ar dá +1 na corrente');
  fresh('kunai'); yield 0.1; give('w_rck2');
  ammo(2, 0);
  const pk = shot(); R.catchKunai(pk, R.items.indexOf(pk), player);
  out(`  corrente 2 -> ${player.ammo[player.ammo.length - 1].stack} ${ok(player.ammo[player.ammo.length - 1].stack === 3 && ev('rcQuickCatch').length === 1)}`);

  out('583) Corrente Viva: a corrente não zera nos 2 primeiros erros (N2)');
  fresh('kunai'); yield 0.1; give('w_rck3', 2); wall(-6, -10, 6, -9);
  const vs = [];
  for (let i = 0; i < 3; i++) { R.clear(); ammo(4); const it = shot(); yield* until(() => it.state === 'ground', 3000); vs.push(it.stack); }
  out(`  erros: ${vs.join(' / ')} ${ok(vs.join() === '4,4,0')} | aviso ${ok(ev('rcKeepChain').length === 2)}`);

  out('584) Kunai Gelada: corrente ×1 já deixa MUITO lento (N3)');
  fresh('kunai'); yield 0.1; give('w_rck4', 3);
  const gl = dummy(0, -5);
  ammo(1, 0); shot();
  yield* until(() => ev('rcIce').length > 0, 1500);
  out(`  muito lento ${ok(gl.rcIceT > 0 && gl.slow > 0)}`);
  ammo(0); gl.rcIceT = 0; flags.events.length = 0; shot();
  yield* until(() => hitsOn(gl).length > 0, 1500);
  out(`  sem corrente: não ${ok(!ev('rcIce').length)}`);

  out('585) Prego no Escudo: a kunai crava no escudo; 2 acertos quebram (N2)');
  fresh('kunai'); yield 0.1; give('w_rck5', 2);
  const ws = dummy(0, -5, 'warrior', 999, true);
  const n1 = shot();
  yield* until(() => n1.state === 'ground', 1500);
  yield 0.1;
  out(`  cravou ${ok(n1.rcNailed === ws && ev('rcNail').length === 1)} | acompanha o escudo ${ok(Math.hypot(n1.x - ws.position.x, n1.z - ws.position.z) < 1.2)}`);
  out('  -> kunai cravada no escudo (screenshot)');
  yield 'hold';
  shot();
  yield* until(() => ws.shieldBroken, 1500);
  yield 0.05;
  out(`  2º acerto quebrou o escudo ${ok(ws.shieldBroken && ev('rcNailBreak').length === 1)} | a kunai cravada caiu ${ok(!n1.rcNailed)}`);

  out('586) Adaga Amaldiçoada: kunai caída afasta os inimigos');
  fresh('kunai'); yield 0.1; give('w_rck6');
  const cu = dummy(0.8, -5);
  ground(0, -5);
  const cd0 = Math.hypot(cu.position.x, cu.position.z + 5);
  yield 0.6;
  const cd1 = Math.hypot(cu.position.x, cu.position.z + 5);
  out(`  afastou ${ok(cd1 - cd0 > 0.5 && ev('rcCurse').length === 1, `${cd0.toFixed(1)} -> ${cd1.toFixed(1)}`)}`);
  out('  -> kunai amaldiçoada (screenshot)');
  yield 'hold';

  out('587) Mira Treinada: 2 kunais no mesmo alvo em 1 s = a 2ª é crítica');
  fresh('kunai'); yield 0.1; give('w_rck7');
  const mt = dummy(0, -4);
  fixRandom(0.5);
  shot(); yield* until(() => hitsOn(mt).length === 1, 1500);
  shot(); yield* until(() => hitsOn(mt).length === 2, 1500);
  out(`  1ª ${hitsOn(mt)[0].dmg} | 2ª ${lastDmg(mt)} ${ok(lastDmg(mt) === 4 && ev('rcAimCrit').length === 1)}`);

  out('588) Lâminas Gêmeas: a 2ª kunai em menos de 1 s causa +100% (N3)');
  fresh('kunai'); yield 0.1; give('w_rck8', 3);
  const lg = dummy(0, -4);
  fixRandom(0.5);
  const t1 = shot(), t2 = shot();
  yield* until(() => hitsOn(lg).length === 2, 1500);
  out(`  só a 2ª é gêmea ${ok(!t1.rcTwin && t2.rcTwin)} | dano ${hitsOn(lg).map((h) => h.dmg).sort().join(' e ')} ${ok(hitsOn(lg).map((h) => h.dmg).sort().join() === '2,4')}`);

  out('589) Assobio: rolar sem kunais faz elas voltarem (N1: 2 por sala)');
  fresh('kunai'); yield 0.1; give('w_rck9');
  const as = dummy(0, -1.5);
  ground(0, -6); ground(-3, -4);
  yield* roll(0.05);
  out(`  assobiou ${ok(ev('rcWhistle').length === 1 && R.items.every((it) => it.state === 'pull' && it.rcWhistle))}`);
  yield* until(() => player.ammo.length === 2, 2000);
  out(`  voltaram ${ok(player.ammo.length === 2)} | sem cortar ninguém ${ok(as.hp === 999)}`);
  yield 0.3;
  for (let i = 0; i < 2; i++) { R.clear(); ammo(0); ground(0, -6); player.ammo = []; at(0, 2); yield* roll(0.45); yield* until(() => player.ammo.length > 0 || !R.items.some((it) => it.state === 'pull'), 1500); yield 0.2; }
  out(`  só 2 vezes por sala ${ok(ev('rcWhistle').length === 2, ev('rcWhistle').length)}`);
  K.roomStart();
  out(`  sala nova recarrega ${ok(S().whistles === 0)}`);

  out('590) Estoque Escondido: 1 kunai extra; some quando a corrente zera');
  fresh('kunai'); yield 0.1; give('w_rck10');
  K.onRefill(player);
  out(`  3 kunais ${ok(player.ammo.length === 3 && player.ammo.some((c) => c.rcExtra))}`);
  player.ammo.find((c) => c.rcExtra).stack = 3;
  R.breakStreak(player);
  out(`  tomou dano: a extra sumiu ${ok(player.ammo.length === 2 && !player.ammo.some((c) => c.rcExtra))}`);
  R.clear(); player.ammo = [{ stack: 3, rcExtra: true }]; wall(-6, -10, 6, -9);
  const xk = shot();
  yield* until(() => !R.items.includes(xk), 3000);
  out(`  errou na parede: sumiu ${ok(!R.items.includes(xk) && ev('rcExtraGone').length === 2)}`);

  // ================= Garras =================
  out('591) Sangue Fervente: 3+ sangramentos = dano por segundo (N3: 6)');
  fresh('garras'); yield 0.1; give('w_rcg1', 3);
  const sf = dummy(0, -3);
  sf.bleedStacks = 3; sf.bleedBy = player;
  yield 1.1;
  out(`  ferveu ${ok(ev('rcBoil').length === 1 && sf.hp === 993, sf.hp)}`);

  out('592) Rasgo Final: o 5º golpe é sempre crítico');
  fresh('garras'); yield 0.1; give('w_rcg2');
  const rf = dummy(0, 0.4);
  fixRandom(0.5); strike(0); const rd0 = lastDmg(rf); strike(4); const rd4 = lastDmg(rf);
  out(`  1º golpe ${rd0} ${ok(rd0 === 4)} | 5º golpe ${rd4} ${ok(rd4 === 12)}`);

  out('593) Cheiro de Sangue: ataque mais rápido contra quem sangra (N3: +105%)');
  fresh('garras'); yield 0.1; give('w_rcg3', 3);
  const cb = dummy(0, 0.4);
  player.startAttack(null); const sp0 = player.rcStepMul; player.setState('idle');
  cb.bleedStacks = 1;
  player.combo = 0; player.startAttack(null); const sp1 = player.rcStepMul; player.setState('idle');
  out(`  sem sangue ×${sp0} ${ok(sp0 === 1)} | sangrando ×${sp1.toFixed(2)} ${ok(Math.abs(sp1 - 2.05) < 0.01 && ev('rcScent').length === 1)}`);

  out('594) Lambida: derrotar quem sangra cura (N3: 6)');
  fresh('garras'); yield 0.1; give('w_rcg4', 3);
  const lb = dummy(0, 0.4, 'minion', 1);
  lb.bleedStacks = 1; player.hp = 30;
  fixRandom(0.5); strike(0);
  out(`  curou ${ok(player.hp === 36 && ev('rcLick').length === 1, player.hp)}`);

  out('595) Unhas Grudentas: 3 acertos seguidos = vulnerável; o próximo é crítico');
  fresh('garras'); yield 0.1; give('w_rcg5');
  const ug = dummy(0, 0.4);
  fixRandom(0.5); strike(0); strike(1); strike(2);
  out(`  vulnerável ${ok(ug.rcGrabT > 0 && ev('rcGrab').length === 1)}`);
  strike(3);
  out(`  4º golpe crítico: ${lastDmg(ug)} ${ok(lastDmg(ug) === 8 && ev('rcGrabUse').length === 1)} | marca gasta ${ok(!(ug.rcGrabT > 0))}`);
  ug.rcGrabN = 0; ug.rcGrabSeq = undefined;
  strike(0); strike(1); strike(2);
  player.sneakCrit = true; strike(3); // já ia ser crítico
  out(`  já era crítico: +100% = ${lastDmg(ug)} ${ok(lastDmg(ug) === 16)}`);

  out('596) Marca da Fera: quem morre sangrando espalha sangramento (N3)');
  fresh('garras'); yield 0.1; give('w_rcg6', 3);
  const mf = dummy(0, 0.4, 'minion', 1), mf2 = dummy(1.5, -1);
  mf.bleedStacks = 1;
  fixRandom(0.5); strike(0);
  out(`  vizinho com 3 sangramentos ${ok(mf2.bleedStacks === 3 && ev('rcBeastMark').length === 1, mf2.bleedStacks)}`);

  out('597) Salto Felino: rolar por dentro deixa o próximo ataque 100% mais rápido');
  fresh('garras'); yield 0.1; give('w_rcg7');
  dummy(0, -1.2);
  yield* roll();
  out(`  pronto ${ok(S().felino && ev('rcFeline').length === 1)}`);
  player.combo = 0; player.startAttack(null); const fs1 = player.rcStepMul; player.setState('idle');
  player.combo = 0; player.startAttack(null); const fs2 = player.rcStepMul; player.setState('idle');
  out(`  próximo ataque ×${fs1} ${ok(fs1 === 2)} | depois volta ×${fs2} ${ok(fs2 === 1)}`);

  out('598) Pelagem Arrepiada: tomar dano = golpes 50% mais rápidos (N2: 10 s)');
  fresh('garras'); yield 0.1; give('w_rcg8', 2);
  const pa = dummy(0, -0.6);
  const sp00 = player.atkSpeed;
  combat.noEvade = true; combat.hitPlayer(pa, 5, { target: player }); combat.noEvade = false;
  out(`  arrepiou ${ok(S().furT > 9.9 && ev('rcFur').length === 1)} | velocidade ×${(player.atkSpeed / sp00).toFixed(2)} ${ok(Math.abs(player.atkSpeed / sp00 - 1.5) < 0.01)}`);

  out('599) Presa Fácil: +120% em arqueiros e magos (N3)');
  fresh('garras'); yield 0.1; give('w_rcg9', 3);
  const pf = dummy(0, 0.4, 'archer');
  fixRandom(0.5); strike(0); const pfd = lastDmg(pf);
  fresh('garras'); yield 0.1; give('w_rcg9', 3);
  const pm = dummy(0, 0.4); fixRandom(0.5); strike(0);
  out(`  arqueiro ${pfd} ${ok(pfd === 9)} | lacaio ${lastDmg(pm)} ${ok(lastDmg(pm) === 4)}`);

  out('600) Instinto: "!" quando um inimigo vai atacar pelas costas; o próximo golpe nele é crítico');
  fresh('garras'); yield 0.1; give('w_rcg10');
  const it0 = dummy(0, 3.4, 'minion', 999, false, false);
  player.iframes = 9;
  it0.target = player; it0.facing = Math.PI; it0.startAttack();
  yield 0.05;
  out(`  aviso ${ok(it0.rcInstBy === player && ev('rcInstinct').length === 1)} | "!" em cima dele ${ok(!!(it0.rcIcons && it0.rcIcons.inst))}`);
  out('  -> ponto de exclamação (screenshot)');
  yield 'hold';
  at(0, 2, 0); fixRandom(0.5); strike(0);
  out(`  golpe nele crítico: ${lastDmg(it0)} ${ok(lastDmg(it0) === 8 && ev('rcInstinctHit').length === 1)} | aviso sumiu ${ok(!it0.rcInstBy && !(it0.rcIcons && it0.rcIcons.inst))}`);
  player.iframes = 0;

  // ================= Rapieira =================
  out('601) Estocada de Abertura: 1ª estocada em vida cheia é crítica (N1 lacaio, N3 todos)');
  fresh('rapieira'); yield 0.1; give('w_rcr1');
  const ea = dummy(0, 0.2);
  fixRandom(0.5); strike(0); const ead = lastDmg(ea); strike(0); const ead2 = lastDmg(ea);
  fresh('rapieira'); yield 0.1; give('w_rcr1');
  const ew = dummy(0, 0.2, 'warrior'); fixRandom(0.5); strike(0); const ewd = lastDmg(ew);
  give('w_rcr1', 2); ew.hp = ew.maxHp; strike(0); const ewd3 = lastDmg(ew);
  out(`  lacaio ${ead} ${ok(ead === 12)} | já ferido ${ead2} ${ok(ead2 === 6)} | guerreiro no N1 ${ewd} ${ok(ewd === 6)} | no N3 ${ewd3} ${ok(ewd3 === 12)}`);

  out('602) Velocidade da Luz: rolar por dentro faz o 1º perder você de vista (N3: 2 s)');
  fresh('rapieira'); yield 0.1; give('w_rcr2', 3);
  const vl = dummy(0, -1.2);
  yield* roll(0.3);
  out(`  perdeu de vista ${ok(vl.state === 'rogueLost' && ev('rcLight').length === 1, vl.state)}`);

  out('603) Marca do Duelista: 3 acertos seguidos desequilibram (N3: 1,5 s)');
  fresh('rapieira'); yield 0.1; give('w_rcr3', 3);
  const md = dummy(0, 0.2);
  fixRandom(0.5); strike(0); strike(0);
  const mdb = md.offBalanceT > 0;
  strike(0);
  out(`  2 acertos: ainda não ${ok(!mdb)} | 3º desequilibra ${ok(md.offBalanceT > 1.5 && ev('rcDuelist').length === 1, (md.offBalanceT || 0).toFixed(1))}`);

  out('604) Floreio: abate = mais rápido por 4 s (N3: +150%)');
  fresh('rapieira'); yield 0.1; give('w_rcr4', 3);
  const mv0 = player.moveMul;
  dummy(0, 0.2, 'minion', 1);
  fixRandom(0.5); strike(0);
  out(`  floreio ${ok(ev('rcFlourish').length === 1)} | passo ×${(player.moveMul / mv0).toFixed(2)} ${ok(Math.abs(player.moveMul / mv0 - 2.5) < 0.01)}`);

  out('605) Ponta Fina: a estocada passa pelo escudo (N3: sempre)');
  fresh('rapieira'); yield 0.1; give('w_rcr5', 3);
  const pw = dummy(0, 0.2, 'warrior', 999, true);
  fixRandom(0.5); strike(0);
  out(`  estocada passou ${ok(ev('rcPierce').length === 1 && pw.hp < 999, pw.hp)}`);
  const hp1 = pw.hp; pw.state = 'chase'; strike(1);
  out(`  o corte (2º golpe) não ${ok(pw.hp === hp1 && ev('blocked').length === 1)}`);

  out('606) Contorno: rolar ao lado de um inimigo termina nas costas dele (N3)');
  fresh('rapieira'); yield 0.1; give('w_rcr6', 3);
  const ct = dummy(1.4, -1.5);
  yield* roll(0.45);
  const back = Math.hypot(player.position.x - 1.4, player.position.z - (-1.5 - (ct.data.radius + player.hero.radius + 0.45)));
  out(`  nas costas ${ok(ev('rcContour').length === 1 && back < 0.6, `${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}`)} | sem dano ao aterrissar ${ok(player.iframes > 0.2)}`);
  fixRandom(0.5); strike(0);
  out(`  estocada pelas costas: ${lastDmg(ct)} ${ok(lastDmg(ct) === 12)}`);

  out('607) Saudação: parado 1 s antes da 1ª onda = 1º golpe crítico e +100% (N2)');
  fresh('rapieira'); yield 0.1; give('w_rcr7', 2);
  K.roomStart(); player.setState('idle');
  yield 1.2;
  out(`  saudou ${ok(S().salute && ev('rcSalute').length === 1)}`);
  out('  -> saudação (screenshot)');
  yield 'hold';
  const sd = dummy(0, 0.2);
  fixRandom(0.5); strike(0); const sdd = lastDmg(sd); yield 0.05; strike(0); const sdd2 = lastDmg(sd);
  out(`  1º golpe ${sdd} ${ok(sdd === 24)} | 2º golpe ${sdd2} ${ok(sdd2 === 6)}`);
  K.roomStart(); dummy(4, -4); player.setState('idle'); yield 1.2;
  out(`  com inimigos na sala não vale ${ok(!S().salute)}`);

  out('608) Cicatriz: cada abate com crítico dá +5% de crítico na sala (N3)');
  fresh('rapieira'); yield 0.1; give('w_rcr8', 3);
  dummy(0, 0.2, 'minion', 1);
  player.sneakCrit = true; fixRandom(0.5); strike(0); // crítico garantido (como saindo da fumaça)
  out(`  +5% ${ok(Math.abs(S().scar - 0.05) < 0.001 && ev('rcScar').length === 1, `${S().scar} ${JSON.stringify(ev('hit').map((h) => [h.dmg, h.died]))}`)}`);
  K.roomStart();
  out(`  sala nova zera ${ok(S().scar === 0)}`);

  out('609) Esgrima Defensiva: durante a estocada, chance de desviar (N3: 50%)');
  fresh('rapieira'); yield 0.1; give('w_rcr9', 3);
  const eg = dummy(0, 0.2);
  fixRandom(0.2); combat.noEvade = true;
  player.setState('attack'); player.combo = 0; player.xstep = null;
  const hp0 = player.hp;
  combat.hitPlayer(eg, 10, { target: player });
  const dodged = player.hp === hp0 && ev('rcFence').length === 1;
  player.iframes = 0; player.combo = 1;
  combat.hitPlayer(eg, 10, { target: player });
  combat.noEvade = false; player.setState('idle');
  out(`  estocada: desviou ${ok(dodged)} | no corte (2º golpe) não ${ok(player.hp < hp0 && ev('rcFence').length === 1)}`);

  out('610) Toque Final: inimigo comum com menos de 30% morre com a estocada');
  fresh('rapieira'); yield 0.1; give('w_rcr10');
  const tf = dummy(0, 0.2, 'minion', 100);
  tf.hp = 25; fixRandom(0.5); strike(0);
  out(`  morreu ${ok(!tf.alive && ev('rcTouche').length === 1)}`);
  const tf2 = dummy(0, 0.2, 'minion', 100); tf2.hp = 40; strike(0);
  out(`  com 40% não ${ok(tf2.alive)}`);

  // ================= Besta de Mão =================
  out('611) Primeiro Tiro: o 1º tiro da sala é crítico e +200% (N3)');
  fresh('besta'); yield 0.1; give('w_rcb1', 3); K.roomStart();
  const pt = dummy(0, -3);
  fixRandom(0.5); shot(); yield* until(() => hitsOn(pt).length === 1, 1500);
  ammo(0); shot(); yield* until(() => hitsOn(pt).length === 2, 1500);
  out(`  1º tiro ${hitsOn(pt)[0] && hitsOn(pt)[0].dmg} ${ok(hitsOn(pt)[0] && hitsOn(pt)[0].dmg === 216)} | 2º tiro ${lastDmg(pt)} ${ok(lastDmg(pt) === 36)}`);

  out('612) Coleta Ligeira: pegar o virote em até 1 s = próximo tiro 100% mais rápido (N1: 2 por sala)');
  fresh('besta'); yield 0.1; give('w_rcb2');
  const quick = () => { const it = ground(0, -3); R.pickUp(it, R.items.indexOf(it), player); };
  quick();
  out(`  pronto ${ok(S().fastShot && ev('rcQuickPick').length === 1)}`);
  player.combo = 0; player.startAttack(null); const cl1 = player.rcStepMul; player.setState('idle'); R.clear(); ammo(0);
  out(`  tiro ×${cl1} ${ok(cl1 === 2)}`);
  quick(); quick(); quick();
  out(`  só 2 por sala ${ok(ev('rcQuickPick').length === 2)}`);
  const slow = ground(0, -3); slow.rcLandT -= 1.5; S().quick = 0; S().fastShot = false; R.pickUp(slow, R.items.indexOf(slow), player);
  out(`  depois de 1 s não vale ${ok(!S().fastShot)}`);

  out('613) Tiro Distante: +15% por metro acima de 5 m (N3)');
  fresh('besta'); yield 0.1; give('w_rcb3', 3);
  const near = dummy(0, -1);
  fixRandom(0.5); shot(); yield* until(() => hitsOn(near).length === 1, 1500);
  const nearD = hitsOn(near)[0] ? hitsOn(near)[0].dmg : 0;
  fresh('besta'); yield 0.1; give('w_rcb3', 3);
  const far = dummy(0, -8.8); fixRandom(0.5); shot(); yield* until(() => hitsOn(far).length === 1, 1500);
  const want = Math.round(36 * (1 + 0.15 * (Math.hypot(0, -8.8 - (2 - 0.8)) - 5)));
  out(`  perto ${nearD} ${ok(nearD === 36)} | 10 m: ${lastDmg(far)} ${ok(Math.abs(lastDmg(far) - want) <= 1, want)}`);

  out('614) Farpa: o virote soma 3 sangramentos (N3)');
  fresh('besta'); yield 0.1; give('w_rcb4', 3);
  const fp = dummy(0, -3);
  shot(); yield* until(() => hitsOn(fp).length === 1, 1500);
  out(`  sangramento ×${fp.bleedStacks} ${ok(fp.bleedStacks === 3)}`);

  out('615) Derrubada: o acertado derruba os 2 de trás (N2)');
  fresh('besta'); yield 0.1; give('w_rcb5', 2);
  const da = dummy(0, -3), db = dummy(0.3, -5), dc = dummy(-0.4, -6.5), dd = dummy(0.2, -7.6), de = dummy(4, -5);
  shot(); yield* until(() => hitsOn(da).length === 1, 1500);
  out(`  derrubou 2 ${ok(db.offBalanceT > 0 && dc.offBalanceT > 0 && ev('rcKnock').length === 1)} | o 3º e o de lado não ${ok(!(dd.offBalanceT > 0) && !(de.offBalanceT > 0))}`);

  out('616) Virote Teimoso: o virote que acerta volta para a mão (N3: 50%)');
  fresh('besta'); yield 0.1; give('w_rcb6', 3);
  const vt = dummy(0, -3);
  fixRandom(0.2); shot(); yield* until(() => hitsOn(vt).length === 1, 1500);
  yield 0.05;
  out(`  voltou ${ok(player.ammo.length === 1 && ev('rcBoltBack').length === 1)}`);
  fixRandom(0.9); shot(); yield* until(() => hitsOn(vt).length === 2, 1500); yield 0.05;
  out(`  sem sorte fica no chão ${ok(player.ammo.length === 0)}`);

  out('617) Duelo de Besteiros: +150% em arqueiros (N3)');
  fresh('besta'); yield 0.1; give('w_rcb7', 3);
  const da2 = dummy(0, -3, 'archer');
  fixRandom(0.5); shot(); yield* until(() => hitsOn(da2).length === 1, 1500);
  out(`  arqueiro ${lastDmg(da2)} ${ok(lastDmg(da2) === 90)}`);

  out('618) Interromper: o virote deixa o mago sem magia (N3: 3 s)');
  fresh('besta'); yield 0.1; give('w_rcb8', 3);
  const im = dummy(0, -3, 'mage');
  shot(); yield* until(() => hitsOn(im).length === 1, 1500);
  out(`  sem magia ${ok(ev('rcInterrupt').length === 1 && im.kcSilT > 2.5, (im.kcSilT || 0).toFixed(1))}`);

  out('619) Virote Magnético: + e −, a cada 2 tiros os ímãs ligam');
  fresh('besta'); yield 0.1; give('w_rcb9');
  const ma = dummy(-2.5, -6), mb = dummy(2.5, -6);
  const aim = (x, z) => Math.atan2(x - player.position.x, z - player.position.z);
  shot(aim(-2.5, -6)); yield* until(() => ev('rcMagMark').length === 1, 1500);
  out(`  1º tiro: + ${ok(ev('rcMagMark')[0] && ev('rcMagMark')[0].sign === 1 && ev('rcMagMark')[0].enemy === ma)}`);
  out('  -> marca + (screenshot)');
  yield 'hold';
  ammo(0); shot(aim(2.5, -6)); yield* until(() => ev('rcMagnet').length === 1, 1500);
  yield 0.4;
  const mg1 = ev('rcMagnet')[0];
  out(`  2 inimigos se atraem ${ok(mg1 && mg1.mode === 'enemies' && Math.hypot(ma.position.x - mb.position.x, ma.position.z - mb.position.z) < 2.2, Math.hypot(ma.position.x - mb.position.x, ma.position.z - mb.position.z).toFixed(1))} | bateram e caíram ${ok(ev('rcSlam').length === 2)}`);
  fresh('besta'); yield 0.1; give('w_rcb9'); wall(9, -12, 10, 8);
  const mw = dummy(0, -5);
  shot(aim(0, -5)); yield* until(() => ev('rcMagMark').length === 1, 1500);
  ammo(0); const x0 = mw.position.x; shot(Math.PI / 2); yield* until(() => ev('rcMagnet').length === 1, 2500);
  yield 0.4;
  out(`  inimigo e parede: voou até a parede ${ok(ev('rcMagnet')[0] && ev('rcMagnet')[0].mode === 'wall' && mw.position.x - x0 > 4, (mw.position.x - x0).toFixed(1))}`);
  fresh('besta'); yield 0.1; give('w_rcb9'); wall(9, -12, 10, 8); wall(-10, -12, -9, 8);
  const mz = dummy(5, 3.2);
  shot(Math.PI / 2); yield* until(() => ev('rcMagMark').length === 1, 2500);
  ammo(0); shot(-Math.PI / 2); yield* until(() => ev('rcMagnet').length === 1, 2500);
  yield 1.1;
  out(`  2 paredes: puxou para o meio ${ok(ev('rcMagnet')[0] && ev('rcMagnet')[0].mode === 'walls' && Math.abs(mz.position.x) < 2, mz.position.x.toFixed(1))}`);

  out('620) Virote Brilhante: o virote caído cega quem está perto (N2: 2 s)');
  fresh('besta'); yield 0.1; give('w_rcb10', 2);
  const vb = dummy(0.8, -5), vb2 = dummy(1.9, -5.4);
  ground(0, -5); yield 0.1;
  out(`  cegou ${ok(vb.state === 'rogueBlind' && vb.rcGlowBlind && ev('rcGlowBlind').length >= 1, vb.state)}`);
  out('  -> virote brilhante (screenshot)');
  yield 'hold';
  fixRandom(0.9); vb2.hp = 999; K.blindSwing(vb); realRandom();
  out(`  cego acertou o vizinho ${ok(ev('rcBlindHit').length === 1 && (vb2.hp < 999 || vb.hp < 999))}`);

  realRandom();
  const errs = (window.__game.errors || []).slice(errs0);
  out(`  sem erros no console ${ok(!errs.length, errs.join(' | ').slice(0, 200))}`);
  out('621) FIM das comuns do Ladino');
}
