// Teste automático, parte 35 (11/11/2026): bênçãos COMUNS das 5 armas do Cavaleiro (48, kcbless.js / kckit.js).
// Tecla Delete (só estes) e no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { kcS, kcAtkMul, kcDodge } from './kckit.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* kcTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const cam = g.cam.camera;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fresh = (weapon) => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('knight', weapon); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    clearStrip(-9, 9, -14, 8);
    combat.demo.list = [];
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion', hp = 999) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = hp; if (type !== 'warrior') e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const C = () => player.hero.combo;
  const hit = (i) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const heavyI = () => C().findIndex((s) => s.heavy);
  const lastDmg = (e) => { const h = ev('hit').filter((x) => x.enemy === e); return h.length ? h[h.length - 1].dmg : 0; };
  const kill = (e) => { e.hp = 1; combat.bonusDamage(e, 5, 0, 1, 'dmg', player); };
  const blockFrom = (x, z) => { // bloqueia de verdade um golpe vindo de (x, z)
    const b = dummy(x, z);
    player.input = fake({ blocking: () => true }); player.setState('block');
    player.facing = Math.atan2(x - player.position.x, z - player.position.z);
    combat.hitPlayer(b, 10, { target: player });
    b.die(); player.setState('idle'); player.input = realInput; player.facing = Math.PI;
  };
  const near = (a, b, t = 0.06) => Math.abs(a - b) < t;
  let rnd = null;
  const fixRandom = (v) => { if (!rnd) rnd = Math.random; Math.random = () => v; };
  const realRandom = () => { if (rnd) Math.random = rnd; rnd = null; };

  // ---------- 460) Lista ----------
  out('460) Comuns do Cavaleiro: as 48 bênçãos novas');
  const kc = WEAPON_BLESSINGS.filter((b) => b.id.startsWith('w_kc'));
  const per = ['espada', 'machado', 'mangual', 'lanca', 'manopla'].map((w) => kc.filter((b) => b.weapon === `knight.${w}`).length);
  out(`  ${kc.length} bênçãos ${ok(kc.length === 48)} | por arma 8/10/10/10/10 ${ok(per.join() === '8,10,10,10,10', per.join('/'))} | todas comuns ${ok(kc.every((b) => b.rarity === 'common'))} | textos ${ok(kc.every((b) => b.desc(1).length > 10 && b.desc(b.max).length > 10))}`);
  out(`  máx. 1: Aliado, Satisfação, Corte, Determinação, Varredura, Ringue, Gancho ${ok(['Aliado dos Ventos', 'Satisfação', 'Corte Seguido', 'Determinação', 'Varredura', 'Ringue', 'Gancho de Esquerda'].every((n) => kc.find((b) => b.name === n).max === 1))} | as outras vão até 3 ${ok(kc.filter((b) => b.max !== 1).length === 41)}`);

  // ================= Espada e Escudo =================
  out('461) Golpe Certeiro: golpe forte crítico a cada 3 / sempre');
  fresh('espada'); yield 0.1;
  give('w_kce1');
  let a = dummy(0, 0.6); const hv = heavyI();
  const ds = []; for (let i = 0; i < 3; i++) { hit(hv); ds.push(lastDmg(a)); }
  out(`  N1: ${ds.join(', ')} — só o 3º crítico ${ok(ds[0] < 21 && ds[1] < 21 && ds[2] > 30)}`);
  give('w_kce1', 2); hit(hv);
  out(`  N3: sempre crítico ${ok(lastDmg(a) > 30, String(lastDmg(a)))}`);

  out('462) Troco do Escudo: depois de bloquear, o combo seguinte +30%');
  fresh('espada'); yield 0.1;
  give('w_kce2');
  a = dummy(0, 0.6); hit(0); const t0 = lastDmg(a);
  blockFrom(0, 0.6);
  a.position.set(0, 0, 0.6); a.vel.set(0, 0, 0);
  hit(0); const t1 = lastDmg(a); hit(1); const t2 = lastDmg(a); hit(hv); hit(0); const t3 = lastDmg(a);
  out(`  antes ${t0} | depois do bloqueio ${t1}, ${t2} ${ok(t0 <= 11 && t1 >= 12 && t2 >= 12)} | combo seguinte volta ao normal ${ok(t3 <= 11, String(t3))}`);

  out('463) Embalo: abate = golpes 20% mais rápidos por 4 s');
  fresh('espada'); yield 0.1;
  give('w_kce3', 2);
  const m0 = kcAtkMul(player);
  kill(dummy(0, 0.6)); kill(dummy(1, 0.6)); kill(dummy(-1, 0.6));
  const m1 = kcAtkMul(player);
  yield 4.3;
  out(`  sem abate ${m0} | 3 abates (N2, até 2×) ${m1.toFixed(2)} ${ok(near(m1, 1.4))} | 4 s depois ${kcAtkMul(player)} ${ok(kcAtkMul(player) === 1)}`);

  out('464) Brasão Restaurado: sala nova recupera o escudo');
  fresh('espada'); yield 0.1;
  give('w_kce4');
  player.shield = 2; combat.kc.roomStart();
  const sh1 = player.shield;
  give('w_kce4', 2); player.shield = 1; combat.kc.roomStart();
  out(`  N1: 2 -> ${sh1} ${ok(sh1 === 5)} | N3: 1 -> ${player.shield} (cheio) ${ok(player.shield >= 10)}`);

  out('465) Fio do Combo: os 3 golpes no mesmo = 3º +40%');
  fresh('espada'); yield 0.1;
  give('w_kce5');
  a = dummy(0, 0.6); hit(hv); const f0 = lastDmg(a);
  hit(0); hit(1); hit(hv); const f1 = lastDmg(a);
  out(`  forte sozinho ${f0} | depois de 1º e 2º no mesmo ${f1} ${ok(f0 <= 20 && f1 >= 22)}`);

  out('466) Grito do Cavaleiro: matar com o forte assusta');
  fresh('espada'); yield 0.1;
  give('w_kce6');
  a = dummy(0, 0.6, 'minion', 1); const g1 = dummy(3, 3), g2 = dummy(-3, 3);
  hit(hv);
  out(`  grito ${ok(ev('kcShout').length === 1)} | os 2 fugindo ${ok(g1.state === 'axeFear' && g2.state === 'axeFear', `${g1.state}/${g2.state}`)}`);
  yield 1.3;
  out(`  N1: 1 s depois param ${ok(g1.state !== 'axeFear')}`);

  out('467) Escudo Espelhado: a flecha bloqueada volta');
  fresh('espada'); yield 0.1;
  give('w_kce7', 3);
  const ar = dummy(0, -7, 'archer', 50);
  player.input = fake({ blocking: () => true }); player.setState('block'); player.facing = Math.PI;
  combat.projectiles.fire(0, -5, 0, { speed: 18, damage: 9, kind: 'arrow', owner: ar });
  yield* until(() => ev('reflected').length > 0 || ev('blockedHero').length > 0, 2000);
  yield 0.6;
  out(`  devolveu ${ok(ev('kcMirror').length === 1 && ev('reflected').length === 1)} | acertou o arqueiro ${ok(ev('reflectHit').some((x) => x.enemy === ar))}`);
  player.input = realInput; player.setState('idle');

  out('468) Caçador de Arqueiros: +40% em arqueiros e magos');
  fresh('espada'); yield 0.1;
  give('w_kce8');
  const ca = dummy(0, 0.6, 'archer'); ca.rolledOnce = true; hit(0); const c1 = lastDmg(ca); ca.die();
  const cm = dummy(0, 0.6); hit(0); const c0 = lastDmg(cm);
  out(`  lacaio ${c0} | arqueiro ${c1} ${ok(c0 <= 11 && c1 >= 12.5)}`);

  // ================= Machado =================
  out('470) Aliado dos Ventos: giro em 4 levanta todos por 2 s');
  fresh('machado'); yield 0.1;
  give('w_kcm1');
  const four = [dummy(1.5, 2), dummy(-1.5, 2), dummy(0, 0.5), dummy(0, 3.5)];
  hit(1);
  out(`  redemoinho ${ok(ev('kcWhirl').length === 1)} | levantou os 4 ${ok(ev('kcLift').length === 1 && ev('kcLift')[0].n === 4 && four.every((e) => e.state === 'kcLift'))}`);
  yield 0.6;
  out(`  no ar ${ok(four.every((e) => e.position.y > 1), four.map((e) => e.position.y.toFixed(1)).join('/'))}`);
  const hp0 = player.hp; four[0].position.set(player.position.x + 0.5, 0, player.position.z); yield 0.3;
  out(`  encostar não machuca ${ok(player.hp === hp0)}`);
  yield 1.8;
  out(`  2 s depois desce ${ok(four.every((e) => e.state !== 'kcLift' && e.position.y === 0))}`);
  fresh('machado'); yield 0.1; give('w_kcm1');
  dummy(1.5, 2); dummy(-1.5, 2); dummy(0, 0.5); hit(1);
  out(`  com 3 só gira ${ok(ev('kcWhirl').length === 1 && !ev('kcLift').some((x) => x.n > 0))}`);

  out('471) Peso Morto: forte arremessa quem fica fraco');
  fresh('machado'); yield 0.1;
  give('w_kcm2');
  a = dummy(0, 0.6, 'minion', 100); a.hp = 70;
  const path = dummy(0, -3.5);
  hit(heavyI());
  out(`  arremessou ${ok(ev('kcPeso').length === 1 && a.state === 'fistFly', a.state)}`);
  yield* until(() => ev('fistBowl').length > 0, 1500);
  out(`  derrubou quem estava no caminho ${ok(ev('fistBowl').some((x) => x.enemy === path))}`);

  out('472) Embalo do Lenhador: 2 abates no mesmo golpe = combo +30%');
  fresh('machado'); yield 0.1;
  give('w_kcm3');
  dummy(0.8, 0.6, 'minion', 1); dummy(-0.8, 0.6, 'minion', 1);
  hit(0);
  out(`  armou ${ok(ev('kcLumber').length === 1)}`);
  player.combo = 0; player.startAttack(cam);
  out(`  próximo combo ${kcAtkMul(player).toFixed(2)} ${ok(near(kcAtkMul(player), 1.3))}`);
  yield 0.8; player.combo = 0; player.startAttack(cam);
  out(`  o seguinte volta ao normal ${ok(kcAtkMul(player) === 1)}`);
  yield 1.2;

  out('473) Surpresa: 3º golpe mais rápido');
  fresh('machado'); yield 0.1;
  const sp0 = C()[heavyI()].speed;
  give('w_kcm4', 2);
  out(`  ${sp0} -> ${C()[heavyI()].speed.toFixed(3)} (+70%) ${ok(near(C()[heavyI()].speed, sp0 * 1.7, 0.01))} | 1º golpe igual ${ok(near(C()[0].speed, 0.9, 0.001))}`);

  out('474) Golpe de Abertura: 1º golpe em vida cheia é crítico');
  fresh('machado'); yield 0.1;
  give('w_kcm5');
  a = dummy(0, 0.6); hit(0); const o1 = lastDmg(a); hit(0); const o2 = lastDmg(a);
  a.die();
  const oa = dummy(0, 0.6, 'archer'); oa.rolledOnce = true; hit(0); const o3 = lastDmg(oa); oa.die();
  give('w_kcm5');
  const ob = dummy(0, 0.6, 'archer'); ob.rolledOnce = true; hit(0); const o4 = lastDmg(ob);
  out(`  N1 lacaio cheio ${o1} ${ok(o1 > 40)} | 2º golpe normal ${o2} ${ok(o2 < 30)} | arqueiro (N1) ${o3} ${ok(o3 < 30)} | arqueiro (N2) ${o4} ${ok(o4 > 40)}`);

  out('475) Rachador: escudo do guerreiro quebra em 3 / 1 golpe');
  fresh('machado'); yield 0.1;
  give('w_kcm6');
  const wr = dummy(0, 0.6, 'warrior');
  for (let i = 0; i < 3; i++) { hit(0); yield 0.05; }
  out(`  3 golpes: quebrou ${ok(wr.shieldBroken && ev('kcCrack').length === 1)}`);
  fresh('machado'); yield 0.1; give('w_kcm6', 3);
  const wr2 = dummy(0, 0.6, 'warrior'); hit(0);
  out(`  N3: 1 golpe ${ok(wr2.shieldBroken)}`);

  out('476) Cabeça Fria: 5 s sem dano = forte +50%');
  fresh('machado'); yield 0.1;
  give('w_kcm7');
  a = dummy(0, 0.6);
  kcS(player).lastHurt = combat.kc.t;
  hit(heavyI()); const h0 = lastDmg(a);
  kcS(player).lastHurt = combat.kc.t - 6;
  hit(heavyI()); const h1 = lastDmg(a); hit(heavyI()); const h2 = lastDmg(a);
  out(`  logo depois de apanhar ${h0} | 5 s sem dano ${h1} ${ok(h0 <= 51 && h1 >= 61)} | o seguinte normal ${h2} ${ok(h2 <= 51)}`);

  out('477) Troféu de Ossos: a cada 5 abates (N3) +1 ultimate');
  fresh('machado'); yield 0.1;
  give('w_kcm8', 3); player.ult = 0;
  for (let i = 0; i < 5; i++) kill(dummy(i - 2, -3));
  out(`  ultimate ${player.ult} (5 + 1) ${ok(player.ult === 6 && ev('kcTrophy').length === 1)}`);

  out('478) Satisfação: os 3 golpes acertando curam 3');
  fresh('machado'); yield 0.1;
  give('w_kcm9');
  player.hp = 50; dummy(0, 0.6);
  hit(0); hit(1); const hs = player.hp; hit(heavyI());
  out(`  curou ${hs} -> ${player.hp} ${ok(hs === 50 && player.hp === 53)}`);

  out('479) Corte Seguido: o forte que mata acerta o de trás');
  fresh('machado'); yield 0.1;
  give('w_kcm10');
  a = dummy(0, 0.6, 'minion', 1); const back = dummy(0, -2.9);
  hit(heavyI());
  const fc = ev('kcFollow')[0];
  out(`  acertou o de trás ${ok(fc && fc.enemy === back, fc ? String(fc.dmg) : '-')} | metade do dano ${ok(fc && fc.dmg >= 19 && fc.dmg <= 27)}`);

  // ================= Mangual =================
  out('480) Elo Extra: +5% de alcance por acerto; apanhar zera');
  fresh('mangual'); yield 0.1;
  give('w_kcf1');
  a = dummy(0, 0.6);
  hit(0); const r1 = combat.kc.rangeMul(player);
  for (let i = 0; i < 4; i++) hit(0);
  const r2 = combat.kc.rangeMul(player);
  combat.kc.onHurt(player, null);
  out(`  1 acerto ${r1.toFixed(2)} ${ok(near(r1, 1.05, 0.001))} | máx. 3 elos ${r2.toFixed(2)} ${ok(near(r2, 1.15, 0.001))} | apanhou ${ok(combat.kc.rangeMul(player) === 1)}`);

  out('481) Bola Pesada: forte em atordoado +40%');
  fresh('mangual'); yield 0.1;
  give('w_kcf2');
  a = dummy(0, 0.6); hit(heavyI()); const b0 = lastDmg(a);
  yield 0.6; a.daze(2); hit(heavyI()); const b1 = lastDmg(a);
  out(`  normal ${b0} | tonto ${b1} ${ok(b0 <= 15 && b1 >= 16)}`);

  out('482) Badalo: a cada 3 acertos (N3), DONG atordoa em volta');
  fresh('mangual'); yield 0.1;
  give('w_kcf3', 3);
  const bells = [dummy(0, 0.6), dummy(1.5, 1), dummy(-1.5, 1)];
  hit(0); yield 0.7;
  hit(0);
  out(`  DONG ${ok(ev('kcDong').length === 1 && ev('kcDong')[0].n >= 3)}`);

  out('483) Corrente Quente: tontos levam dano por segundo');
  fresh('mangual'); yield 0.1;
  give('w_kcf4', 3);
  a = dummy(0, 0.6); hit(0); a.daze(2);
  yield 1.6;
  const hot = ev('kcHot').reduce((n, x) => n + x.dmg, 0);
  out(`  ${hot} de dano em 1,6 s (6/s) ${ok(hot >= 8 && hot <= 11)}`);

  out('484) Calar o Mago: sem magia por 2 s');
  fresh('mangual'); yield 0.1;
  give('w_kcf5');
  const mg = dummy(0, 0.6, 'mage');
  hit(0);
  out(`  silenciou ${ok(ev('kcSilence').length === 1)} | recarga ${mg.cooldown.toFixed(1)} ${ok(mg.cooldown >= 1.9)}`);
  yield 1.0;
  out(`  1 s depois ainda calado ${ok(mg.cooldown >= 0.9)}`);

  out('485) Peso na Consciência: derrotado derruba quem está atrás');
  fresh('mangual'); yield 0.1;
  give('w_kcf6', 3);
  a = dummy(0, 0.6, 'minion', 1); const bk = dummy(0, -1.4);
  hit(0);
  out(`  derrubou o de trás ${ok(ev('kcTopple').length === 1 && bk.state === 'axeDown', bk.state)}`);

  out('486) Esquiva Pesada: 1º golpe depois de rolar gira em volta');
  fresh('mangual'); yield 0.1;
  give('w_kcf7');
  const fr = dummy(0, 0.6), bh = dummy(0, 3.6);
  kcDodge(player, 'end');
  player.combo = 0; player.startAttack(cam);
  const spinMul = kcAtkMul(player);
  yield* until(() => ev('kcHeavySpin').length > 0, 2000);
  out(`  muito mais rápido ${spinMul.toFixed(1)} ${ok(spinMul > 2)} | girou em volta e acertou os 2 ${ok(ev('kcHeavySpin').length === 1 && ev('kcHeavySpin')[0].hits === 2)} | 30% do dano ${ok(lastDmg(fr) <= 3 && lastDmg(bh) <= 3)}`);
  yield 0.8;

  out('487) Muralha Paciente: 1 bloqueio (N3) = próximo crítico e empurra');
  fresh('mangual'); yield 0.1;
  give('w_kcf8', 3);
  blockFrom(0, 0.6);
  a = dummy(0, 0.6); hit(0);
  out(`  crítico ${lastDmg(a)} ${ok(lastDmg(a) >= 12)} | empurrou longe ${ok(ev('kcWallPush').length === 1)}`);
  hit(0);
  out(`  só 1 golpe ${lastDmg(a)} ${ok(lastDmg(a) < 12)}`); // não crítico (o dano varia 8–9)

  out('488) Lootear: morreu tonto solta poção');
  fresh('mangual'); yield 0.1;
  give('w_kcf9', 3);
  a = dummy(0, 0.6, 'minion', 1); a.daze(2);
  fixRandom(0.01); hit(0); realRandom();
  out(`  poção ${ok(ev('kcLoot').length === 1)}`);

  out('489) Mangual Divino: 3º golpe atordoa todos no chão');
  fresh('mangual'); yield 0.1;
  give('w_kcf10', 3);
  const far = [dummy(6, -6), dummy(-6, -6), dummy(0, -9)];
  hit(heavyI());
  out(`  ${ok(ev('kcDivine').length === 1 && ev('kcDivine')[0].n >= 3)} | os de longe levaram 1 e ficaram tontos ${ok(far.every((e) => e.hp === 998 && e.state === 'hurt'))}`);

  // ================= Lança =================
  out('490) Espeto Duplo: atravessa e acerta o de trás');
  fresh('lanca'); yield 0.1;
  give('w_kcl1', 3);
  a = dummy(0, 0.6); const sk = dummy(0, -1.8);
  hit(0);
  const skv = ev('kcSkewer')[0];
  out(`  acertou o de trás ${ok(skv && skv.enemy === sk)} | 100% do dano ${ok(skv && Math.abs(skv.dmg - lastDmg(a)) <= 1)}`);

  out('491) Manter a Linha: marcado leva +25%');
  fresh('lanca'); yield 0.1;
  give('w_kcl2');
  a = dummy(0, 0.6); hit(0); const l0 = lastDmg(a); const lt = a.kcLineT; hit(0); const l1 = lastDmg(a);
  out(`  marcou por 3 s ${ok(near(lt, 3))} | 1º ${l0}, 2º ${l1} ${ok(l0 <= 14.3 && l1 >= 14.6)}`);
  yield 3.2;
  out(`  3 s depois sem marca ${ok(!(a.kcLineT > 0))}`);

  out('492) Contra-Investida: para a investida do guerreiro');
  fresh('lanca'); yield 0.1;
  give('w_kcl3');
  const cw = dummy(0, 0.6, 'warrior'); cw.setState('chargeWind');
  hit(0);
  out(`  parou e atordoou ${ok(ev('kcContra').length === 1 && cw.state === 'hurt' && cw.stunTime >= 0.5)}`);

  out('493) Primeira Estocada: 1º golpe crítico (N3: sempre)');
  fresh('lanca'); yield 0.1;
  give('w_kcl4', 3);
  a = dummy(0, 0.6); hit(0); const p0 = lastDmg(a); hit(1); const p1 = lastDmg(a);
  out(`  1º ${p0} ${ok(p0 >= 23)} | 2º ${p1} ${ok(p1 <= 14.3)}`);

  out('494) Determinação: o 3º golpe sempre acha alguém');
  fresh('lanca'); yield 0.1;
  give('w_kcl5');
  const sd = dummy(3, 0.5);
  hit(heavyI());
  out(`  inimigo do lado: virou e acertou ${ok(ev('kcDetermTurn').length === 1 && sd.hp < 999)}`);
  fresh('lanca'); yield 0.1; give('w_kcl5');
  const fd = dummy(0, -9);
  hit(heavyI());
  out(`  longe: investiu ${ok(player.state === 'kcDash' && player.invulnerable)}`);
  yield* until(() => ev('kcDashHit').length > 0, 2000);
  out(`  chegou e acertou ${ok(fd.hp < 999 && Math.hypot(player.position.x - fd.position.x, player.position.z - fd.position.z) < 5)} | sem dano por 1 s ${ok(player.iframes > 0.4)}`);
  yield 0.5;
  out(`  voltou ao normal ${ok(player.state === 'idle' || player.state === 'run')}`);

  out('495) Ferida Profunda: acertos somam sangramento');
  fresh('lanca'); yield 0.1;
  give('w_kcl6');
  a = dummy(0, 0.6); hit(0); hit(0); const fb = a.bleedStacks || 0; hit(0);
  out(`  N1: 2 golpes ${fb} | 3 golpes ${a.bleedStacks} ${ok(!fb && a.bleedStacks === 1)}`);

  out('496) Deus Gelado: 2º golpe congela (N3: sempre)');
  fresh('lanca'); yield 0.1;
  give('w_kcl7', 3);
  a = dummy(0, 0.6); hit(0); const fz0 = a.frozenT > 0; hit(1);
  out(`  1º não ${ok(!fz0)} | 2º congelou ${ok(a.frozenT > 0.8)}`);

  out('497) Caça-Atiradores: +30% e (N3) mata quem fica com menos da metade');
  fresh('lanca'); yield 0.1;
  give('w_kcl8');
  const at1 = dummy(0, 0.6, 'archer'); at1.rolledOnce = true; hit(0); const ad = lastDmg(at1); at1.die();
  give('w_kcl8', 2);
  const at2 = dummy(0, 0.6, 'archer', 200); at2.rolledOnce = true; at2.hp = 120; hit(heavyI());
  out(`  N1 ${ad} ${ok(ad >= 15)} | N3 abateu ${ok(!at2.alive)}`);

  out('498) Ponta de Troféu: +4% de alcance por abate (até 5)');
  fresh('lanca'); yield 0.1;
  give('w_kcl9');
  for (let i = 0; i < 7; i++) kill(dummy(i - 3, -4));
  const pr = combat.kc.rangeMul(player);
  combat.kc.roomStart();
  out(`  7 abates ${pr.toFixed(2)} ${ok(near(pr, 1.2, 0.001))} | sala nova ${ok(combat.kc.rangeMul(player) === 1)}`);

  out('499) Varredura: estocada forte pega os lados');
  fresh('lanca'); yield 0.1;
  give('w_kcl10');
  a = dummy(0, 0.6); const sR = dummy(2.2, 2), sL = dummy(-2.2, 2.3);
  hit(heavyI());
  out(`  pegou os 2 dos lados ${ok(ev('kcSweep').length === 1 && ev('kcSweep')[0].n === 2 && sR.hp < 999 && sL.hp < 999)} | metade ${ok(999 - sR.hp >= 11 && 999 - sR.hp <= 15, String(999 - sR.hp))}`);

  // ================= Manopla =================
  out('500) Um-Dois: 1º e 2º no mesmo = 2º crítico (N3: 3º também)');
  fresh('manopla'); yield 0.1;
  give('w_kcp1');
  a = dummy(0, 0.6); hit(0); const u0 = lastDmg(a); hit(1); const u1 = lastDmg(a); hit(2); const u2 = lastDmg(a);
  out(`  N1: ${u0}, ${u1}, ${u2} ${ok(u0 <= 9 && u1 >= 14 && u2 <= 9)}`);
  give('w_kcp1', 2); a.position.set(0, 0, 0.6); a.vel.set(0, 0, 0);
  hit(0); hit(1); const ob1 = a.offBalanceT > 0; hit(2);
  out(`  N3: desequilibrou ${ok(ob1)} | 3º crítico ${ok(lastDmg(a) >= 14)}`);

  out('501) Sequência: combo completo = +5% até sair da sala');
  fresh('manopla'); yield 0.1;
  give('w_kcp2');
  a = dummy(0, 0.6);
  for (let i = 0; i < 4; i++) hit(i);
  const sq = kcS(player).seqN;
  for (let i = 0; i < 4; i++) hit(i);
  for (let i = 0; i < 4; i++) hit(i);
  for (let i = 0; i < 4; i++) hit(i);
  const sq2 = kcS(player).seqN;
  combat.kc.roomStart();
  out(`  1 combo ${sq} ${ok(sq === 1)} | máx. 3 (N1) ${ok(sq2 === 3)} | sala nova zera ${ok(kcS(player).seqN === 0)}`);

  out('502) Esquiva de Boxe: rolar perto de quem ataca = soco crítico (+cura +atordoa)');
  fresh('manopla'); yield 0.1;
  give('w_kcp3', 3);
  a = dummy(0, 0.6); player.hp = 50;
  const st0 = a.state; a.state = 'attack'; kcDodge(player, 'start'); a.state = st0;
  hit(0);
  out(`  crítico ${lastDmg(a)} ${ok(ev('kcBoxe').length === 1 && lastDmg(a) >= 14)} | curou 3 ${ok(player.hp === 53)} | atordoou ${ok(a.state === 'hurt' && a.stunTime >= 1)}`);
  hit(0);
  out(`  só 1 soco ${ok(lastDmg(a) <= 9)}`);

  out('503) Nocaute: forte arremessa e derrota quem fica fraco');
  fresh('manopla'); yield 0.1;
  give('w_kcp4', 3);
  a = dummy(0, 0.6, 'minion', 100); a.hp = 45;
  hit(heavyI());
  out(`  nocaute ${ok(ev('kcNocaute').length === 1 && !a.alive)}`);

  out('504) Cotovelada: apanhou por trás, revida');
  fresh('manopla'); yield 0.1;
  give('w_kcp5');
  const el = dummy(0, 3.2);
  combat.hitPlayer(el, 5, { target: player });
  const elb = ev('kcElbow')[0];
  out(`  cotovelada ${ok(elb && elb.enemy === el && elb.dmg === 8, elb ? String(elb.dmg) : '-')}`);
  player.iframes = 0; flags.events.length = 0;
  const fr2 = dummy(0, 0.8); combat.hitPlayer(fr2, 5, { target: player });
  out(`  pela frente não ${ok(!ev('kcElbow').length)}`);

  out('505) Sangue nos Nós: 30% por abate; cheia = forte dobrado');
  fresh('manopla'); yield 0.1;
  give('w_kcp6', 3);
  for (let i = 0; i < 4; i++) kill(dummy(i - 2, -4));
  const bar = kcS(player).nos;
  a = dummy(0, 0.6); hit(heavyI()); const n2 = lastDmg(a);
  out(`  barra ${bar.toFixed(1)} ${ok(bar >= 1)} | forte ${n2} ${ok(n2 >= 27)} | esvaziou ${ok(kcS(player).nos === 0)}`);

  out('506) Empurra-Empurra: empurrado bate no outro');
  fresh('manopla'); yield 0.1;
  give('w_kcp7', 3);
  a = dummy(0, 0.6); const ob2 = dummy(0, -0.95);
  hit(0);
  yield* until(() => ev('kcShove').length > 0, 1500);
  out(`  trombada ${ok(ev('kcShove').length === 1 && ev('kcShove')[0].dmg === 12)}`);

  out('507) Ringue: rolar na parede joga até a outra');
  fresh('manopla'); yield 0.1;
  give('w_kcp8');
  let wx = 0; while (!combat.world.blocked(wx + 0.3, 2, 0.15) && wx < 40) wx += 0.3;
  player.position.set(wx - 0.9, 0, 2);
  player.input = fake({ moveDir: (v) => v.set(1, 0, 0) });
  player.startDodge();
  yield* until(() => ev('kcRing').length > 0, 1500);
  out(`  voou ${ok(ev('kcRing').length === 1 && player.state === 'kcFly')} | invulnerável ${ok(player.invulnerable)}`);
  player.input = fake();
  yield* until(() => ev('kcRingLand').length > 0, 3000);
  out(`  caiu do outro lado (x ${player.position.x.toFixed(1)}) ${ok(player.position.x < -(wx - 3))} | 1 s sem dano ${ok(player.iframes > 0.8)}`);
  player.input = realInput;
  yield 0.4;

  out('508) Campeão: 3 abates em 4 s = socos mais rápidos');
  fresh('manopla'); yield 0.1;
  give('w_kcp9');
  kill(dummy(-2, -3)); kill(dummy(0, -3));
  const cm0 = kcAtkMul(player); kill(dummy(2, -3));
  const cm1 = kcAtkMul(player);
  yield 3.2;
  out(`  2 abates ${cm0} | 3 abates ${cm1.toFixed(2)} ${ok(cm0 === 1 && near(cm1, 1.3))} | 3 s depois ${ok(kcAtkMul(player) === 1)}`);

  out('509) Gancho de Esquerda: o chute puxa para perto');
  fresh('manopla'); yield 0.1;
  give('w_kcp10');
  a = dummy(0, -0.2);
  const d0 = Math.hypot(a.position.x - player.position.x, a.position.z - player.position.z);
  hit(2); yield 0.3;
  const d1 = Math.hypot(a.position.x - player.position.x, a.position.z - player.position.z);
  out(`  puxou ${d0.toFixed(1)} -> ${d1.toFixed(1)} ${ok(ev('kcHook').length === 1 && d1 < 1.7)}`);

  player.input = realInput;
  realRandom();
}
