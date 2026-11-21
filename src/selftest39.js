// Teste automático, parte 39 (11/11/2026): bênçãos RARAS, lote 2 (11, r2bless.js / r2kit.js).
// Rapieira, Cajado de Fogo, Manopla, Cajado Arcano, Duas Adagas. Tecla F2 (só estes, corrido), F4 (com pausas) e no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { r2S, r2MoveMul, r2Override } from './r2kit.js';
import { shieldMax } from './shield.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* r2Tests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fresh = (hero, weapon) => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero(hero, weapon); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    clearStrip(-12, 12, -18, 10);
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
  const block = () => { player.setState('block'); player.anim.play(player.hero.anims.blocking, { fade: 0.05 }); };
  let rnd = null;
  const fixRandom = (v) => { if (!rnd) rnd = Math.random; Math.random = () => v; };
  const realRandom = () => { if (rnd) Math.random = rnd; rnd = null; };
  const arrowAt = (owner, z0 = -4.5) => combat.projectiles.fire(0, z0, 0, { speed: 16, damage: 9, kind: 'arrow', owner });

  // ---------- 634) Lista ----------
  out('634) Raras, lote 2: as 11 bênçãos novas');
  const r2 = WEAPON_BLESSINGS.filter((b) => b.id.startsWith('w_r2'));
  const per = ['rogue.rapieira', 'mage.fogo', 'knight.manopla', 'mage.cajado', 'rogue.adagas'].map((w) => r2.filter((b) => b.weapon === w).length);
  out(`  ${r2.length} bênçãos ${ok(r2.length === 11)} | Rapieira/Fogo/Manopla/Arcano/Adagas 3/2/4/1/1 ${ok(per.join() === '3,2,4,1,1', per.join('/'))} | todas raras ${ok(r2.every((b) => b.rarity === 'rare'))} | textos ${ok(r2.every((b) => b.desc(1).length > 10 && b.desc(b.max).length > 10))}`);
  const dedosB = r2.find((b) => b.name === 'Estocada de 3 Dedos');
  out(`  só a Estocada de 3 Dedos tem 2 níveis ${ok(dedosB.max === 2 && r2.filter((b) => b.max !== 1).length === 1)} | Jab x Escudo de Carne ${ok(r2.find((b) => b.id === 'w_r2m1').excludes.includes('w_mnp13'))} | Gingado x Ringue ${ok(r2.find((b) => b.id === 'w_r2m2').excludes.includes('w_kcp8'))}`);

  // ================= Rapieira =================
  out('635) Estocada de 3 Dedos: a 1ª estocada vira o inimigo de costas (50% / 100%)');
  fresh('rogue', 'rapieira'); yield 0.1;
  give('w_r2r1');
  let a = dummy(0, 0.5);
  fixRandom(0.9);
  hit(0); yield 0.05;
  const no1 = ev('r2Dedos').length;
  a.turnedT = 0; a.facing = 0;
  fixRandom(0.1);
  hit(0); yield 0.05;
  const yes1 = ev('r2Dedos').length;
  out(`  N1 sem sorte: não vira ${ok(no1 === 0)} | N1 com sorte: virou de costas ${ok(yes1 === 1 && Math.abs(Math.cos(a.facing) + 1) < 0.2, a.facing.toFixed(2))}`);
  give('w_r2r1'); fixRandom(0.9);
  a.turnedT = 0; a.facing = 0; a.position.set(0, 0, 0.5);
  hit(0); yield 0.05;
  const y2 = ev('r2Dedos').length;
  a.position.set(0, 0, 0.5); hit(2); yield 0.05;
  realRandom();
  out(`  N2 (100%): sempre vira ${ok(y2 === 2)} | golpe forte não conta ${ok(ev('r2Dedos').length === 2)}`);

  out('636) En Garde: os 3 golpes do combo no mesmo inimigo o desarmam');
  fresh('rogue', 'rapieira'); yield 0.1;
  give('w_r2r2');
  a = dummy(0, 0.5);
  hit(0); yield 0.15; a.position.set(0, 0, 0.5); hit(2); yield 0.15;
  out(`  pulando o 2º golpe: nada ${ok(ev('r2Garde').length === 0 && !a.rogueDisarmed)}`);
  for (let i = 0; i < 3; i++) { a.position.set(0, 0, 0.5); a.vel.set(0, 0, 0); hit(i); yield 0.2; }
  out(`  1º, 2º e 3º no mesmo: desarmado ${ok(ev('r2Garde').length === 1 && a.rogueDisarmed)}`);
  out('  -> En Garde (screenshot)'); yield 'hold';

  out('637) Leveza: movimento e rolagem dobram');
  fresh('rogue', 'rapieira'); yield 0.1;
  const runFor = function* () {
    player.position.set(-8, 0, 2); player.setState('idle');
    player.input = fake({ moveDir: (v) => v.set(1, 0, 0) });
    yield 0.5;
    player.input = fake();
    return player.position.x + 8;
  };
  const rollFor = function* () {
    player.position.set(-8, 0, 2); player.setState('idle'); player.facing = Math.PI / 2; player.dodgeCooldown = 0;
    player.input = fake();
    player.startDodge(); yield 0.5;
    return player.position.x + 8;
  };
  const run0 = yield* runFor(), roll0 = yield* rollFor();
  give('w_r2r3');
  const run1 = yield* runFor(), roll1 = yield* rollFor();
  out(`  correndo 0,5 s: ${run0.toFixed(1)} -> ${run1.toFixed(1)} m ${ok(run1 > run0 * 1.7 && r2MoveMul(player) === 2)} | rolagem: ${roll0.toFixed(1)} -> ${roll1.toFixed(1)} m ${ok(roll1 > roll0 * 1.7)}`);
  player.input = realInput;

  // ================= Cajado de Fogo =================
  out('638) Ar Quente: flechas que chegam perto derretem (1 a cada 10 s; 5 s com 3+ queimando)');
  fresh('mage', 'fogo'); yield 0.1;
  const archer = dummy(0, -14, 'archer', 999);
  player.input = fake();
  let hp0 = player.hp;
  arrowAt(archer); yield* until(() => player.hp < hp0, 1500);
  out(`  sem a bênção, a flecha acerta ${ok(player.hp < hp0)}`);
  player.hp = player.maxHp; player.iframes = 0; yield 0.8; player.iframes = 0;
  give('w_r2f1');
  hp0 = player.hp;
  arrowAt(archer); yield 0.6;
  const m1 = ev('r2Melt');
  out(`  com ela: derreteu ${ok(m1.length === 1 && player.hp === hp0)} | recarga ${m1.length ? m1[0].cd : '-'} s ${ok(m1.length && m1[0].cd === 10)}`);
  player.iframes = 0;
  arrowAt(archer); yield* until(() => player.hp < hp0, 1500);
  out(`  2ª logo depois: acerta (recarga) ${ok(player.hp < hp0 && ev('r2Melt').length === 1)}`);
  const burners = [dummy(-5, -6), dummy(5, -6), dummy(-5, 6)];
  for (const e of burners) { e.burn = 30; e.burnDps = 0.1; e.burnTick = 0.5; }
  r2S(player).arCd = 0; player.hp = player.maxHp; player.iframes = 0; yield 0.8; player.iframes = 0;
  arrowAt(archer); yield 0.6;
  const m2 = ev('r2Melt');
  out(`  com 3 queimando: derreteu e a recarga é ${m2.length > 1 ? m2[1].cd : '-'} s ${ok(m2.length === 2 && m2[1].cd === 5)}`);
  for (const e of burners) e.burn = 0;
  player.input = realInput;

  out('639) Defesa Ardente: tiro rebatido pela barreira volta pegando fogo');
  fresh('mage', 'fogo'); yield 0.1;
  let shooter = dummy(0, -9, 'archer', 999);
  player.input = fake({ blocking: () => true }); block(); player.facing = Math.PI;
  arrowAt(shooter); yield* until(() => ev('reflectHit').length > 0, 2000);
  out(`  sem a bênção: rebateu ${ok(ev('reflectHit').length === 1)} | não queima ${ok(!(shooter.burn > 0))}`);
  give('w_r2f2');
  player.input = fake({ blocking: () => true }); block(); player.facing = Math.PI;
  arrowAt(shooter); yield 0.12;
  out('  -> Flecha rebatida pegando fogo (screenshot)'); yield 'hold';
  yield* until(() => ev('reflectHit').length > 1, 2000);
  out(`  com ela: voltou pegando fogo ${ok(ev('r2ArdenteOn').length === 1)} | o atirador queima ${ok(ev('r2ArdenteHit').length === 1 && shooter.burn > 0)}`);
  player.input = realInput; player.setState('idle');

  // ================= Manopla =================
  out('640) Jab de Guarda: atacar bloqueando solta um soco sem baixar a guarda');
  fresh('knight', 'manopla'); yield 0.1;
  a = dummy(0, 0.6);
  let tap = 0;
  player.input = fake({ blocking: () => true, attack: () => tap > 0 });
  block(); player.facing = Math.PI;
  tap = 1; yield 0.05; tap = 0;
  out(`  sem a bênção: sem jab ${ok(ev('r2Jab').length === 0)}`);
  yield 0.6; block(); player.facing = Math.PI; yield 0.2;
  give('w_r2m1');
  flags.events.length = 0;
  const hpA = a.hp;
  tap = 1; yield 0.05; tap = 0; yield 0.3;
  out(`  com ela: continua bloqueando ${ok(player.state === 'block')} | soco saiu ${ok(ev('r2Jab').length === 1 && a.hp < hpA, hpA - a.hp)}`);
  out('  -> Jab de Guarda (screenshot)'); yield 'hold';
  tap = 1; yield 0.4; tap = 0; yield 0.1;
  out(`  segurando o ataque: socos em sequência ${ok(ev('r2Jab').length >= 2 && player.state === 'block')}`);
  player.input = realInput; player.setState('idle');

  out('641) Gingado: rolar vira passinho lateral que não quebra o combo');
  fresh('knight', 'manopla'); yield 0.1;
  give('w_r2m2');
  let atk = 0;
  player.input = fake({ attack: () => atk > 0 });
  player.combo = 0; player.startAttack(null);
  yield* until(() => player.hitDone, 800);
  const x0 = player.position.x, z0 = player.position.z;
  player.dodgeCooldown = 0; player.startDodge();
  const st1 = !!player.r2Step && player.state === 'dodge';
  yield 0.3;
  const side = Math.hypot(player.position.x - x0, player.position.z - z0);
  out(`  virou passinho ${ok(st1 && ev('r2Ging').length === 1)} | andou ${side.toFixed(1)} m de lado ${ok(side > 1.5 && side < 3.2 && Math.abs(player.position.x - x0) > 1.5)} | recarga curta ${ok(player.dodgeCooldown <= 0.05)}`);
  atk = 1; yield 0.05; atk = 0;
  out(`  atacar depois: o combo continua no 2º golpe ${ok(player.state === 'attack' && player.combo === 1, player.combo)}`);
  yield* until(() => player.hitDone, 800);
  player.startDodge(); atk = 1; yield 0.1; atk = 0;
  out(`  atacando durante o passinho: 3º golpe ${ok(player.state === 'attack' && player.combo === 2, player.combo)}`);
  player.input = realInput;

  out('642) Clinch: socos seguidos no mesmo inimigo não deixam ele atacar (até 2 s)');
  fresh('knight', 'manopla'); yield 0.1;
  player.iframes = 99;
  a = dummy(0, 0.8); a.passive = false;
  hit(0); a.startAttack(); yield 0.05;
  out(`  sem a bênção: ele ataca ${ok(a.state === 'attack')}`);
  a.endAttack(); yield 0.1;
  give('w_r2m3');
  flags.events.length = 0;
  a.position.set(0, 0, 0.8); hit(0); yield 0.02; a.startAttack(); yield 0.05;
  out(`  com ela: clinch ${ok(ev('r2Clinch').length === 1)} | ataque cancelado ${ok(a.state !== 'attack' && ev('r2ClinchStop').length >= 1)}`);
  for (let i = 1; i <= 4; i++) { yield 0.55; a.position.set(0, 0, 0.8); a.vel.set(0, 0, 0); hit(i % 4); }
  yield 0.05; a.startAttack(); yield 0.05;
  out(`  passou de 2 s: ele volta a atacar ${ok(a.state === 'attack')}`);
  a.endAttack();
  const boss = combat.spawn('warrior', 3, 0.8, { awake: true, passive: true });
  boss.data = { ...boss.data, boss: true };
  player.position.set(3, 0, 2); player.facing = Math.PI;
  flags.events.length = 0; player.combo = 0; combat.playerStrike(player, C()[0]);
  out(`  chefe: não vale ${ok(ev('r2Clinch').every((x) => x.enemy !== boss))}`);
  player.iframes = 0;

  out('643) Segundo Round: abaixo de 25% fica 2 s invencível e o escudo enche (1 vez por sala)');
  fresh('knight', 'manopla'); yield 0.1;
  const hitter = dummy(0, 0.8);
  const mh = player.maxHp;
  player.hp = Math.round(mh * 0.3); player.shield = 1; player.iframes = 0;
  combat.hitPlayer(hitter, Math.round(mh * 0.1), { target: player });
  out(`  sem a bênção: nada ${ok(ev('r2Round').length === 0)}`);
  give('w_r2m4');
  player.hp = Math.round(mh * 0.3); player.shield = 1; player.iframes = 0;
  combat.hitPlayer(hitter, Math.round(mh * 0.1), { target: player });
  out(`  com ela: Segundo Round ${ok(ev('r2Round').length === 1)} | invencível ${player.iframes.toFixed(1)} s ${ok(player.iframes > 1.8 && player.invulnerable)} | escudo cheio ${ok(player.shield === shieldMax(player), `${player.shield}/${shieldMax(player)}`)}`);
  out('  -> Segundo Round (screenshot)'); yield 'hold';
  player.iframes = 0;
  combat.hitPlayer(hitter, 2, { target: player });
  out(`  na mesma sala não repete ${ok(ev('r2Round').length === 1)}`);
  combat.r2.roomStart(); player.iframes = 0; player.hp = Math.round(mh * 0.3);
  combat.hitPlayer(hitter, Math.round(mh * 0.1), { target: player });
  out(`  sala nova: volta a valer ${ok(ev('r2Round').length === 2)}`);
  player.iframes = 0;

  // ================= Cajado Arcano =================
  out('644) Conjuração Ágil: anda atacando e atira logo depois de rolar');
  fresh('mage', 'cajado'); yield 0.1;
  const walkAtk = function* () {
    player.position.set(-6, 0, 2); player.setState('idle'); player.facing = Math.PI;
    player.input = fake({ moveDir: (v) => v.set(1, 0, 0) });
    player.combo = 0; player.startAttack(null);
    yield 0.15;
    const st = player.state;
    player.input = fake();
    return [player.position.x + 6, st];
  };
  const dodgeShoot = function* () {
    player.position.set(-6, 0, 2); player.setState('idle'); player.dodgeCooldown = 0;
    player.input = fake(); player.startDodge();
    player.input = fake({ attack: () => true });
    yield 0.14;
    const st = player.state;
    player.input = fake(); yield 0.5;
    return st;
  };
  const [w0, s0] = yield* walkAtk(); const d0 = yield* dodgeShoot();
  give('w_r2a1');
  const [w1, s1] = yield* walkAtk(); const d1 = yield* dodgeShoot();
  out(`  atacando com a direção apertada: ${w0.toFixed(2)} -> ${w1.toFixed(2)} m ${ok(w0 < 0.3 && w1 > 0.6 && s1 === 'attack', s0 + '/' + s1)}`);
  out(`  apertou o ataque rolando: sem ${d0} | com ${d1} ${ok(d0 === 'dodge' && d1 === 'attack')}`);
  player.input = realInput;

  // ================= Duas Adagas =================
  out('645) Proficiência: sem ninguém perto arremessa a adaga; ela crava; sem adagas, socos');
  fresh('rogue', 'adagas'); yield 0.1;
  a = dummy(0, -6);
  out(`  sem a bênção: golpe normal ${ok(r2Override(player) === null)}`);
  give('w_r2d1');
  const xs1 = r2Override(player);
  out(`  ninguém perto: arremesso ${ok(xs1 && xs1.r2Throw)}`);
  const hpK = a.hp;
  combat.playerStrike(player, xs1);
  yield* until(() => ev('r2KnifeHit').length > 0, 1500);
  const k1 = r2S(player).knives[0];
  out(`  acertou ${ok(ev('r2KnifeHit').length === 1 && a.hp < hpK, hpK - a.hp)} | cravada ${ok(k1 && k1.state === 'stuck' && k1.e === a)} | mão direita vazia ${ok(!player.weapon.visible && player.offhand.visible)}`);
  combat.playerStrike(player, r2Override(player));
  yield* until(() => ev('r2KnifeHit').length > 1, 1500);
  out(`  2ª adaga ${ok(ev('r2Throw').length === 2 && r2S(player).knives.length === 2 && !player.offhand.visible)}`);
  out('  -> Adagas cravadas (screenshot)'); yield 'hold';
  const xs3 = r2Override(player);
  out(`  sem adagas: soco ${ok(xs3 && xs3.r2Punch)}`);
  player.position.set(a.position.x, 0, a.position.z + 1.6);
  yield 0.2;
  out(`  chegou perto: pegou as duas ${ok(ev('r2KnifeBack').length === 2 && r2S(player).knives.length === 0 && player.weapon.visible && player.offhand.visible)}`);
  player.position.set(a.position.x, 0, a.position.z + 2.2); player.facing = Math.PI;
  out(`  inimigo no alcance: golpe normal ${ok(r2Override(player) === null)}`);
  // errou: cai no chão; morreu com a adaga: cai no chão
  player.position.set(6, 0, 2); player.facing = 0;
  combat.world.rects.push({ minX: 4, maxX: 8, minZ: 7, maxZ: 8 }); // parede de teste na frente
  combat.playerStrike(player, r2Override(player));
  yield* until(() => ev('r2KnifeGround').length > 0, 1500);
  out(`  errou: a adaga cai no chão ${ok(r2S(player).knives[0] && r2S(player).knives[0].state === 'ground')}`);
  const gk = r2S(player).knives[0];
  player.position.set(gk.x, 0, gk.z); yield 0.15;
  out(`  passou por cima: pegou ${ok(r2S(player).knives.length === 0, r2S(player).knives.map((k) => `${k.state} ${k.x.toFixed(1)},${k.z.toFixed(1)}`).join(' ') + ` herói ${player.position.x.toFixed(1)},${player.position.z.toFixed(1)} ${player.state}`)}`);
  player.position.set(0, 0, 2); player.facing = Math.PI;
  combat.playerStrike(player, r2Override(player));
  yield* until(() => ev('r2KnifeHit').length > 2, 1500);
  combat.r2.roomStart();
  out(`  sala nova: as adagas voltam ${ok(r2S(player).knives.length === 0 && player.weapon.visible)}`);
  yield 0.5;

  player.input = realInput;
  realRandom();
}
