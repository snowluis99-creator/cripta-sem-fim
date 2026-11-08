// Teste automático, parte 16 (02/11/2026): bênçãos do Machado de Duas Mãos (lista do dono, 1ª leva).
// Tecla Y = tudo; tecla - (menos) = só esta parte.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import * as THREE from 'three';
import { AXE, axeWhirlGuard } from './axekit.js';
import { AXE2 } from './axekit2.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* axeTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('knight', 'machado'); player.reset(0, 2); player.facing = Math.PI;
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion', hp = 999) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const C = () => player.hero.combo;
  const giro = () => C().find((s) => s.arc === 360);

  // ---------------- 90) Lista ----------------
  out('90) Machado: lista nova de bênçãos (1ª leva)');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'knight.machado');
  const names = mine.map((b) => b.name);
  const gone = ['Cabo Longo', 'Sangue Quente', 'Fúria do Berserker', 'Fio Pesado', 'Rolagem Giratória', 'Giro Voraz'].filter((n) => names.includes(n)); // as duas últimas saíram em 06/11
  const want = ['Sede de Batalha', 'Braços de Ferro', 'Racha-Crânios', 'Redemoinho', 'Lenhador', 'Machado Sedento', 'Terremoto Rubro', 'Arremesso Mortal', 'Pião', 'Tornado', 'Giro Crescente',
    'Fenda', 'Corte ao Meio', 'Decapitar', 'Desmembrar', 'Derrubar Pilar', 'Estilhaços de Escudo', 'Faíscas'];
  const miss = want.filter((n) => !names.includes(n));
  out(`  ${mine.length} bênçãos ${ok(mine.length === 27)} | removidas ${ok(gone.length === 0, gone.join(', '))} | todas da lista ${ok(!miss.length, miss.join(', '))} | um só "Machado Sedento" ${ok(names.filter((n) => n === 'Machado Sedento').length === 1)}`);

  // ---------------- 91) Sede de Batalha (Fio Pesado saiu em 06/11) ----------------
  out('91) Sede de Batalha');
  fresh(); yield 0.1;
  give('w_mac11', 2);
  const s1 = dummy(0, 0.8);
  combat.playerStrike(player, C()[0]); const sd0 = 999 - s1.hp;
  for (let i = 0; i < 5; i++) { const k = dummy(3, 3 + i); k.die(); combat.killed(k, 0, 1, player); }
  s1.hp = 999; combat.playerStrike(player, C()[0]); const sd1 = 999 - s1.hp;
  out(`  Sede de Batalha ×2: 5 abates (+30%) ${sd0} -> ${sd1} ${ok(player.axeKills === 5 && sd1 > sd0 * 1.03)}`);
  combat.axe.roomStart();
  out(`  sala nova: zera ${ok(player.axeKills === 0)}`);

  // ---------------- 92) Giro Voraz, Braços de Ferro, Racha-Crânios ----------------
  out('92) Braços de Ferro e Racha-Crânios (Giro Voraz saiu)');
  fresh(); yield 0.1;
  give('w_mac4', 2);
  const ex = dummy(0, 0.8, 'minion', 1000); ex.hp = 140; // golpe forte (~46) deixa com ~94 = 9,4%
  combat.playerStrike(player, C()[2]);
  out(`  Braços de Ferro ×2 (50%): executou ${ok(!ex.alive && ev('axeExecute').length === 1)} | máx. 2 ${ok(BLESSINGS.find((b) => b.id === 'w_mac4').max === 2)}`);
  fresh(); yield 0.1;
  give('w_mac4');
  const ex3 = dummy(0, 0.8, 'minion', 1000); ex3.hp = 280; // ~234 = 23%
  combat.playerStrike(player, C()[2]);
  out(`  ×1 (25%): com 23% executou ${ok(!ex3.alive && ev('axeExecute').length === 1)}`);
  fresh(); yield 0.1;
  give('w_mac4');
  const ex2 = dummy(0, 0.8, 'minion', 1000); ex2.hp = 400; // ~354 = 35%
  combat.playerStrike(player, C()[2]);
  out(`  ×1 (25%): ficou com ${ex2.hp} e não executou ${ok(ex2.alive && ev('axeExecute').length === 0)}`);
  fresh(); yield 0.1;
  give('w_mac5', 2);
  const vic = dummy(0, -2), n1 = dummy(1.5, -2.5), n2 = dummy(-1.4, -1.6), far = dummy(0, -8);
  vic.die(); combat.killed(vic, 0, 1, player);
  out(`  Racha-Crânios ×2: vizinhos paralisados 3 s ${ok(n1.state === 'hurt' && n2.state === 'hurt' && Math.abs(n1.stunTime - 3) < 0.01, n1.stunTime)} | longe não ${ok(far.state !== 'hurt')}`);
  fresh(); yield 0.1;
  give('w_mac5');
  const vic1 = dummy(0, -2), m1 = dummy(1.5, -2.5);
  vic1.die(); combat.killed(vic1, 0, 1, player);
  out(`  Racha-Crânios ×1: 1,5 s ${ok(m1.state === 'hurt' && Math.abs(m1.stunTime - 1.5) < 0.01, m1.stunTime)}`);

  // ---------------- 93) Redemoinho ----------------
  out('93) Redemoinho: o giro rebate projéteis');
  fresh(); yield 0.1;
  give('w_mac12');
  const arch = dummy(0, -7, 'archer');
  player.input = fake();
  player.combo = 1; player.startAttack(g.cam.camera);
  combat.projectiles.fire(0, -2, 0, { speed: 12, damage: 10, kind: 'arrow', owner: arch });
  yield* until(() => ev('axeReflect').length > 0, 1500);
  const hp0 = arch.hp;
  yield* until(() => arch.hp < hp0, 2000);
  out(`  flecha rebatida ${ok(ev('axeReflect').length === 1)} | acertou o arqueiro ${ok(arch.hp < 999, 999 - arch.hp)} | herói sem dano ${ok(player.hp === player.maxHp)}`);
  // Redemoinho (04/11): do giro até o fim do combo, esbarrão não machuca.
  player.input = fake(); player.combo = 1; player.startAttack(g.cam.camera);
  const inSpin = axeWhirlGuard(player);
  player.combo = 2; player.startAttack(g.cam.camera);
  const inHeavy = axeWhirlGuard(player);
  player.setState('idle'); player.combo = 0;
  out(`  imune a esbarrão no giro ${ok(inSpin)} | até o fim do combo ${ok(inHeavy)} | fora do combo não ${ok(!axeWhirlGuard(player))}`);
  fresh(); yield 0.1;
  const arch2 = dummy(0, -7, 'archer');
  player.hp = player.maxHp;
  combat.projectiles.fire(0, -2, 0, { speed: 12, damage: 10, kind: 'arrow', owner: arch2 });
  yield* until(() => player.hp < player.maxHp, 1500);
  out(`  sem a bênção (parado): a flecha acerta ${ok(player.hp < player.maxHp)}`);

  // ---------------- 94) Arremesso Mortal ----------------
  out('94) Arremesso Mortal: 4º golpe joga o machado, que volta');
  fresh(); yield 0.1;
  give('w_mac13');
  out(`  combo de ${C().length} golpes ${ok(C().length === 4 && C()[3].kit === 'axeThrow' && C()[3].clip === 'Throw')}`);
  const t1 = dummy(0, -1.5), t2 = dummy(0.3, -5);
  player.input = fake({ attack: () => true, dodge: () => true });
  combat.playerStrike(player, C()[3]);
  out(`  machado na mão sumiu ${ok(player.axeAway && !player.weapon.visible)}`);
  yield 0.15;
  const p0 = player.position.clone();
  out(`  esperando: não ataca nem rola ${ok(player.state === 'idle')}`);
  yield 0.2;
  out('  -> machado voando (screenshot)');
  yield 'hold';
  yield* until(() => ev('axeCatch').length > 0, 3000);
  player.input = fake();
  const hitsT1 = ev('hit').filter((e) => e.enemy === t1).length, hitsT2 = ev('hit').filter((e) => e.enemy === t2).length;
  out(`  voltou para a mão ${ok(ev('axeCatch').length === 1 && !player.axeAway && player.weapon.visible)} | ficou parado ${ok(player.position.distanceTo(p0) < 0.05)} | cortou na ida e na volta ${ok(hitsT1 === 2 && hitsT2 === 2, `${hitsT1}/${hitsT2}`)}`);

  // ---------------- 95) Pião ----------------
  out('95) Pião: segurar o ataque no giro continua girando');
  fresh(); yield 0.1;
  give('w_mac14');
  const pz = dummy(0, 0.6);
  let held = true, mv = 0;
  player.input = fake({ attack: () => true, attackHeld: () => held, moveDir: (v) => v.set(mv, 0, 0) });
  player.combo = 1; player.startAttack(g.cam.camera);
  yield* until(() => player.state === 'spin', 3000);
  out(`  virou Pião ${ok(player.state === 'spin' && ev('axeTop').length === 1)}`);
  yield 1.5;
  out(`  continua girando ${ok(player.state === 'spin')} | acertou de novo a cada volta ${ok(ev('hit').filter((e) => e.enemy === pz).length >= 3, ev('hit').filter((e) => e.enemy === pz).length)}`);
  const x0 = player.position.x; mv = 1;
  yield 1;
  const walked = player.position.x - x0;
  out(`  anda devagar: ${walked.toFixed(1)} em 1 s ${ok(walked > 0.8 && walked < player.hero.moveSpeed * 0.6, `normal ${player.hero.moveSpeed}`)}`);
  mv = 0;
  out('  -> Pião (screenshot)');
  yield 'hold';
  held = false; player.input = fake({ attackHeld: () => false });
  yield* until(() => player.state === 'attack', 1500);
  out(`  soltou: sai a machadada forte ${ok(player.state === 'attack' && C()[player.combo].heavy)}`);
  fresh(); yield 0.1;
  player.input = fake({ attack: () => true, attackHeld: () => true });
  player.combo = 1; player.startAttack(g.cam.camera);
  yield* until(() => player.combo === 2, 3000);
  out(`  sem a bênção: giro -> machadada normal ${ok(player.combo === 2 && player.state === 'attack')}`);

  // ---------------- 96) Tornado e Giro Crescente ----------------
  out('96) Tornado e Giro Crescente');
  fresh(); yield 0.1;
  give('w_mac15');
  const fz = dummy(4.5, 2), fb = dummy(-4.6, 2);
  const d0t = Math.hypot(fz.position.x - player.position.x, fz.position.z - player.position.z);
  combat.playerStrike(player, giro());
  yield 0.5;
  const d1t = Math.hypot(fz.position.x - player.position.x, fz.position.z - player.position.z);
  out(`  Tornado: puxou ${d0t.toFixed(1)} -> ${d1t.toFixed(1)} ${ok(d1t < d0t - 1.5)} | o outro lado também ${ok(Math.abs(fb.position.x) < 3.5)}`);
  fresh(); yield 0.1;
  give('w_mac16');
  const gr = [dummy(-1, 1.2), dummy(1, 1.2), dummy(0, 3), dummy(1.5, 2.8)];
  const r0 = giro();
  combat.playerStrike(player, r0);
  const far2 = dummy(0, 2 + player.hero.attackRange + 0.5);
  const grow = 1 + Math.min(AXE.grow.max, 4 * AXE.grow.per);
  combat.playerStrike(player, r0);
  out(`  Giro Crescente: 4 acertados -> giro ×${grow.toFixed(2)} ${ok(player.axeGrow >= 4)} | alcançou um que antes não pegava ${ok(far2.hp < 999)}`);
  combat.axe.roomStart();
  out(`  sala nova: volta ao normal ${ok(player.axeGrow === 0)}`);

  // ---------------- 98) Todas juntas ----------------
  out('98) Machado: todas as bênçãos juntas (sem erro)');
  fresh(); yield 0.1;
  for (const b of mine) for (let k = 0; k < b.max; k++) player.addBlessing(b);
  for (let i = 0; i < 5; i++) dummy(-1.2 + i * 0.6, 0.4 - (i % 2) * 0.6, i === 2 ? 'warrior' : 'minion', 300);
  const errs0 = (window.__game.errors || []).length;
  player.iframes = 99;
  let swings = 0;
  try {
    for (let t = 0; t < 12; t++) { combat.playerStrike(player, C()[t % C().length]); swings++; yield 0.15; }
  } catch (e) { out(`  ERRO ${e.message}`); }
  yield* until(() => !player.axeAway, 3000);
  player.input = fake({ moveDir: (v) => v.set(1, 0, 0) }); player.dodgeCooldown = 0; player.startDodge(); yield 0.5;
  out(`  ${swings} golpes ${ok(swings === 12 && (window.__game.errors || []).length === errs0)} | machado de volta ${ok(!player.axeAway && player.weapon.visible)}`);
  player.iframes = 0;

  // ---------------- 99) Fenda ----------------
  out('99) Fenda: rachadura que joga para cima');
  fresh(); yield 0.1;
  give('w_mac18');
  const strip = (r) => r.maxX > -1.6 && r.minX < 1.6 && r.maxZ > -6.5 && r.minZ < 1.5;
  combat.world.rects = combat.world.rects.filter((r) => !strip(r)); // sala sorteada: tira o que estiver no caminho da rachadura
  const f1 = dummy(0, -1.5), f2 = dummy(0.4, -4.5), fSide = dummy(4, -3);
  combat.playerStrike(player, C()[2]);
  yield* until(() => f2.state === 'axeAir', 1500); // o golpe forte tem uma pausa de impacto antes
  yield 0.12;
  const upY = Math.max(f1.position.y, f2.position.y);
  out(`  rachadura saiu ${ok(ev('axeFissure').length === 1)} | jogou para cima ${ok(f2.state === 'axeAir' || f1.state === 'axeAir', upY.toFixed(2))}`);
  out('  -> rachadura e esqueletos no ar (screenshot)');
  yield 'hold';
  yield* until(() => f1.state !== 'axeAir' && f2.state !== 'axeAir' && combat.axe2.cracks.every((c) => c.done), 2000);
  const fh = ev('axeFissureHit');
  out(`  pegou os 2 da linha ${ok(fh.some((e) => e.enemy === f1) && fh.some((e) => e.enemy === f2))} | o do lado não ${ok(!fh.some((e) => e.enemy === fSide))} | caíram no chão ${ok(f1.position.y === 0 && f2.position.y === 0)}`);
  fresh(); yield 0.1;
  give('w_mac18');
  const fBoss = combat.spawn('warrior', 0, -2, { awake: true, passive: true });
  fBoss.data = { ...fBoss.data, boss: true }; fBoss.hp = fBoss.maxHp = 999;
  combat.playerStrike(player, C()[2]);
  yield 0.3;
  out(`  chefe: só o dano, não voa ${ok(fBoss.state !== 'axeAir' && fBoss.hp < 999)}`);

  // ---------------- 100) Corte ao Meio ----------------
  out('100) Corte ao Meio');
  fresh(); yield 0.1;
  give('w_mac19');
  const hv = dummy(0, 0.8, 'minion', 5), hl = dummy(-2.2, 0.9), hr = dummy(2.2, 0.9);
  combat.playerStrike(player, C()[2]);
  out(`  partiu ao meio ${ok(ev('axeHalve').length === 1 && combat.axe2.halves.length === 2)} | corpo some (sem chuva de ossos) ${ok(!hv.group.visible && hv.shattered)}`);
  yield 0.2;
  out('  -> metades voando (screenshot)');
  yield 'hold';
  yield 0.6;
  const hh = ev('axeHalfHit');
  out(`  metades acertaram os dois lados ${ok(hh.some((e) => e.enemy === hl) && hh.some((e) => e.enemy === hr), hh.length)}`);
  yield 2.5;
  out(`  metades somem ${ok(combat.axe2.halves.length === 0)}`);
  fresh(); yield 0.1;
  give('w_mac19');
  dummy(0, 0.8);
  combat.playerStrike(player, C()[2]);
  out(`  sem matar: nada ${ok(ev('axeHalve').length === 0)}`);

  // ---------------- 101) Decapitar ----------------
  out('101) Decapitar');
  fresh(); yield 0.1;
  give('w_mac20');
  const dv = dummy(0, 0.8, 'minion', 100); dv.hp = 30;
  const dn1 = dummy(1.4, -0.4), dn2 = dummy(-1.4, -0.4);
  combat.playerStrike(player, C()[2]);
  const hidden = (e, re) => { let n = 0, v = 0; e.model.traverse((o) => { if (o.isMesh && re.test(o.name)) { n++; if (o.visible) v++; } }); return n > 0 && v === 0; };
  out(`  arrancou a cabeça ${ok(ev('axeDecap').length === 1 && dv.state === 'headless' && hidden(dv, /_Head$/))} | não dá para acertar ${ok(!dv.targetable)} | ainda conta como vivo ${ok(dv.alive && combat.aliveCount === 3)}`);
  player.position.set(0, 0, 9);
  yield 1.2;
  out(`  cabeça continua escondida andando ${ok(hidden(dv, /_Head$/))}`);
  out('  -> corpo sem cabeça (screenshot)');
  yield 'hold';
  yield* until(() => !dv.alive, 3500);
  const hhits = ev('axeHeadlessHit');
  out(`  andou e golpeou ${ok(hhits.length >= 1, hhits.length)} | bateu nos aliados ${ok(dn1.hp < 999 || dn2.hp < 999, `${999 - dn1.hp}/${999 - dn2.hp}`)} | herói sem dano ${ok(player.hp === player.maxHp)}`);
  out(`  caiu depois de ~3 s ${ok(!dv.alive)}`);
  fresh(); yield 0.1;
  give('w_mac20');
  const dh = dummy(0, 0.8, 'minion', 100); dh.hp = 60;
  combat.playerStrike(player, C()[2]);
  out(`  com 60% da vida: golpe normal ${ok(ev('axeDecap').length === 0 && dh.state !== 'headless')}`);

  // ---------------- 102) Desmembrar ----------------
  out('102) Desmembrar');
  fresh(); yield 0.1;
  give('w_mac21');
  const ds = dummy(0, 0.8, 'warrior', 999);
  const w0 = ds.weapons.length;
  combat.playerStrike(player, C()[2]);
  out(`  arrancou o braço ${ok(ev('axeDismember').length === 1 && hidden(ds, /_ArmRight$/))} | soltou a arma ${ok(ds.weapons.length === w0 - 1)} | só morde ${ok(ds.data.attack.bite && !ds.abilities)}`);
  const da = dummy(0, -3, 'archer', 999);
  combat.playerStrike(player, C()[2]); // longe: não pega
  player.position.set(0, 0, -1.6); player.facing = Math.PI;
  combat.playerStrike(player, C()[2]);
  out(`  arqueiro desarmado vira mordedor ${ok(da.disarmed && !da.data.ranged)}`);
  da.passive = false; player.hp = player.maxHp;
  player.position.set(0, 0, -4.6);
  yield* until(() => player.hp < player.maxHp, 6000);
  out(`  mordeu (${player.maxHp - player.hp} de dano) ${ok(player.hp < player.maxHp && player.maxHp - player.hp <= Math.ceil(da.data.damage || 99))}`);
  out('  -> esqueleto sem braço (screenshot)');
  yield 'hold';

  // ---------------- 103) Derrubar Pilar ----------------
  out('103) Derrubar Pilar');
  fresh(); yield 0.1;
  give('w_mac22');
  const pobj = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 4, 12).translate(0, 2, 0), new THREE.MeshStandardMaterial({ color: 0x8c8c94 }));
  pobj.position.set(0, 0, 0.4); combat.scene.add(pobj);
  const pil = { name: 'pillar_teste', x: 0, z: 0.4, r: 0.75, h: 4, obj: pobj, rect: null, colIdx: -1, down: false };
  combat.demo.list.push(pil);
  const pg = [dummy(-2, 0.4), dummy(-3.2, 0.1)];
  combat.playerStrike(player, C()[2]);
  yield* until(() => ev('demolishHit').length > 0, 2000);
  out(`  derrubou ${ok(pil.down)} | esmagou o grupo ${ok(ev('demolishHit')[0] && ev('demolishHit')[0].hits === 2 && pg[0].hp <= 500)}`);
  fresh(); yield 0.1;
  give('w_mac22');
  dummy(0, -1);
  combat.playerStrike(player, C()[1]);
  out(`  giro não derruba ${ok(ev('demolish').length === 0)}`);

  // ---------------- 104) Estilhaços de Escudo ----------------
  out('104) Estilhaços de Escudo');
  fresh(); yield 0.1;
  give('w_mac23');
  const sw = dummy(0, 0.8, 'warrior', 999), sn1 = dummy(-2, 0.8), sn2 = dummy(2, 0.6), sn3 = dummy(0, -2.5);
  combat.playerStrike(player, C()[2]);
  out(`  escudo quebrou ${ok(sw.shieldBroken && ev('shieldBroken').length === 1)} | pedaços voando ${ok(ev('axeShards').length === 1)}`);
  yield 0.08;
  out('  -> estilhaços (screenshot)');
  yield 'hold';
  yield 0.6;
  const sh = ev('axeShardHit');
  out(`  acertaram ${sh.length} vizinhos ${ok(sh.length >= 2)} | não acertam o dono ${ok(!sh.some((e) => e.enemy === sw))}`);

  // ---------------- 105) Faíscas ----------------
  out('105) Faíscas');
  fresh(); yield 0.1;
  give('w_mac24');
  const fw = combat.spawn('warrior', 0, 0.8, { awake: true, passive: true, facing: 0 }); fw.hp = fw.maxHp = 999;
  const fn = dummy(1.8, 0.2);
  player.facing = Math.PI;
  combat.playerStrike(player, C()[0]); // golpe leve no escudo
  out(`  bateu no escudo ${ok(ev('blocked').length >= 1)} | faíscas ${ok(ev('axeSparks').some((e) => e.kind === 'shield'))} | vizinho pegou fogo ${ok(fn.burn > 0)}`);
  fresh(); yield 0.1;
  give('w_mac24');
  const wb = combat.world.bounds;
  if (wb) {
    player.position.set(-wb.x + 1.0, 0, 2); player.facing = -Math.PI / 2;
    const fw2 = dummy(-wb.x + 1.2, 3.4);
    combat.playerStrike(player, C()[0]);
    out(`  na parede: faíscas ${ok(ev('axeSparks').some((e) => e.kind === 'wall'))} | quem estava perto pegou fogo ${ok(fw2.burn > 0)}`);
  } else out('  (sala sem limites conhecidos: pulei o teste da parede)');
  fresh(); yield 0.1;
  give('w_mac24');
  dummy(0, -6);
  combat.playerStrike(player, C()[0]);
  out(`  golpe no ar: nada ${ok(ev('axeSparks').length === 0)}`);
  fresh();
}
