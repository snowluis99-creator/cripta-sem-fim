// Teste automático, parte 40 (11/11/2026): bênçãos ÉPICAS, lote 1 (8, e1bless.js / e1kit.js).
// Manopla, Machado, Mangual, Lança, Cajado de Gelo. Tecla F6 (só estes, corrido), F3 (com pausas) e no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { e1S, e1Frenzy, e1AtkMul, e1RangeMul } from './e1kit.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* e1Tests(g, out, flags) {
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
  const until = function* (cond, ms = 3000) { for (let t = 0; t < ms / 1000 && !cond(); t += 0.05) yield 0.05; }; // tempo do jogo (não do relógio)
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const C = () => player.hero.combo;
  const hit = (i) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const heavyI = () => Math.max(0, player.hero.heavyIdx);
  const moved = (e, x, z) => Math.hypot(e.position.x - x, e.position.z - z);

  // ---------- 646) Lista ----------
  out('646) Épicas, lote 1: as 8 bênçãos novas');
  const e1 = WEAPON_BLESSINGS.filter((b) => b.id.startsWith('w_e1'));
  const per = ['knight.manopla', 'knight.machado', 'knight.mangual', 'knight.lanca', 'mage.gelo'].map((w) => e1.filter((b) => b.weapon === w).length);
  out(`  ${e1.length} bênçãos ${ok(e1.length === 8)} | Manopla/Machado/Mangual/Lança/Gelo 1/2/2/2/1 ${ok(per.join() === '1,2,2,2,1', per.join('/'))} | todas épicas, máx. 1 ${ok(e1.every((b) => b.rarity === 'epic' && b.max === 1))} | textos ${ok(e1.every((b) => b.desc(1).length > 20))}`);
  out(`  Chute x Espetinho/Lança Cravada/Bumerangue/Âncora ${ok(['w_lan16', 'w_lan17', 'w_lan18', 'w_lan21'].every((id) => e1.find((b) => b.id === 'w_e1l1').excludes.includes(id)))}`);

  // ================= Manopla =================
  out('647) Levante: morreu -> tela preta; apertar o ataque rápido faz levantar (cada vez mais difícil)');
  fresh('knight', 'manopla'); yield 0.1;
  give('w_e1m1');
  g.ult.cinematic = true;
  player.input = fake({ attack: () => true }); // aperta em todo quadro
  player.hp = 0; player.die();
  yield 0.6;
  out(`  tela preta e congelado ${ok(!!g.ult.cine && player.state === 'ultCine' && document.querySelector('.e1lev.on') !== null)}`);
  out('  -> Levante (screenshot)'); yield 'hold';
  yield* until(() => !g.ult.cine, 9000);
  const win = ev('e1LevanteWin');
  out(`  apertou ${win.length ? win[0].count : '?'}/${win.length ? win[0].need : '?'}: levantou ${ok(win.length === 1 && player.state !== 'dead')} | metade da vida ${ok(player.hp === Math.round(player.maxHp / 2), String(player.hp))} | +25% de velocidade ${ok(Math.abs(e1AtkMul(player) - 1.25) < 0.01)} | +25% de dano ${ok(Math.abs(combat.e1.damage(player).mul - 1.25) < 0.01)}`);
  player.input = fake(); player.iframes = 0; yield 0.2;
  player.hp = 0; player.die();
  yield 0.5;
  yield* until(() => !g.ult.cine, 9000);
  const st2 = ev('e1LevanteStart'), lose = ev('e1LevanteLose');
  out(`  2ª vez pede mais (${st2.length > 1 ? st2[1].need : '?'}) ${ok(st2.length === 2 && st2[1].need > st2[0].need)} | sem apertar: morre de vez ${ok(lose.length === 1 && player.state === 'dead')} | tela some ${ok(document.querySelector('.e1lev.on') === null)}`);
  g.ult.cinematic = false;
  player.input = realInput;

  // ================= Machado =================
  out('648) Lenhador Obstinado: 20 acertos do 1º golpe -> 5 s imune batendo sem parar');
  fresh('knight', 'machado'); yield 0.1;
  give('w_e1a1');
  let a = dummy(0, 0.3, 'minion', 99999);
  const spd0 = player.atkSpeed;
  for (let i = 0; i < 5; i++) hit(1);
  for (let i = 0; i < 19; i++) hit(0);
  out(`  19 acertos (o 2º golpe não conta): nada ${ok(ev('e1Frenzy').length === 0 && e1S(player).lenHits === 19)}`);
  hit(0);
  out(`  20º: modo obstinado ${ok(ev('e1Frenzy').length === 1 && e1Frenzy(player))} | imune ${ok(player.invulnerable)} | ${(player.atkSpeed / spd0).toFixed(2)}× mais rápido ${ok(Math.abs(player.atkSpeed / spd0 - 2.5) < 0.01)}`);
  player.input = fake(); player.setState('idle'); a.position.set(0, 0, 0.3);
  const sw0 = ev('swing').length;
  yield 1.5;
  const autos = ev('swing').length - sw0;
  out(`  sem apertar nada: ${autos} golpes em 1,5 s ${ok(autos >= 4)} | só o 1º golpe ${ok(player.combo === 0)}`);
  out('  -> Lenhador Obstinado (screenshot)'); yield 'hold';
  yield 4.0;
  out(`  depois de 5 s volta ao normal ${ok(!e1Frenzy(player) && ev('e1FrenzyEnd').length === 1 && !player.invulnerable)}`);
  player.input = realInput;

  out('649) Sangue de Gigante: cada abate +5% (até +50%); cada golpe recebido encolhe');
  fresh('knight', 'machado'); yield 0.1;
  give('w_e1a2');
  const hp0 = player.maxHp, as0 = player.atkSpeed;
  for (let i = 0; i < 3; i++) { dummy(0, 0.4, 'minion', 1); hit(0); }
  yield 0.6;
  const s = e1S(player);
  out(`  3 abates: +15% ${ok(s.giant === 3)} | vida máx. ${hp0} -> ${player.maxHp} ${ok(player.maxHp === hp0 + 15)} | alcance ×${e1RangeMul(player).toFixed(2)} ${ok(Math.abs(e1RangeMul(player) - 1.15) < 0.01)} | dano ×${combat.e1.damage(player).mul.toFixed(2)} ${ok(Math.abs(combat.e1.damage(player).mul - 1.15) < 0.01)} | mais lento ${ok(player.atkSpeed < as0)} | tamanho ${player.model.scale.x.toFixed(2)} ${ok(Math.abs(player.model.scale.x - 1.15) < 0.03)}`);
  for (let i = 0; i < 12; i++) { dummy(0, 0.4, 'minion', 1); hit(0); }
  yield 0.6;
  out(`  15 abates: para em +50% ${ok(s.giant === 10)} | tamanho ${player.model.scale.x.toFixed(2)} ${ok(Math.abs(player.model.scale.x - 1.5) < 0.03)}`);
  out('  -> Gigante (screenshot)'); yield 'hold';
  const atk = dummy(0, 0.6, 'minion', 999);
  player.iframes = 0; combat.hitPlayer(atk, 3, { target: player });
  out(`  tomou um golpe: encolheu ${ok(s.giant === 9 && ev('e1Shrink').length === 1)}`);

  // ================= Mangual =================
  out('650) Berço de Newton: o golpe forte numa fila não mexe o 1º; só o último voa, com o dano somado');
  fresh('knight', 'mangual'); yield 0.1;
  give('w_e1f1');
  const line = [dummy(0, 0.6), dummy(0, -1.2), dummy(0, -3.0)];
  const at0 = line.map((e) => [e.position.x, e.position.z]);
  const lastHp = line[2].hp;
  hit(heavyI());
  yield 1.0;
  const nw = ev('e1Newton');
  const expect = Math.round(C()[heavyI()].damage * player.stats.damageMul * 3);
  out(`  fila de 3 ${ok(nw.length === 1 && nw[0].n === 3)} | o 1º não saiu do lugar (${moved(line[0], ...at0[0]).toFixed(1)} m) ${ok(moved(line[0], ...at0[0]) < 0.6)} | o último voou ${moved(line[2], ...at0[2]).toFixed(1)} m ${ok(moved(line[2], ...at0[2]) > 4)} | levou ${lastHp - line[2].hp} (≥ ${expect}) ${ok(lastHp - line[2].hp >= expect)}`);
  fresh('knight', 'mangual'); yield 0.1;
  give('w_e1f1');
  dummy(0, 0.6); hit(heavyI());
  out(`  sozinho (sem fila): golpe normal ${ok(ev('e1Newton').length === 0)}`);

  out('651) Meteoro: 20 abates -> voa, escolhe onde cair e esmaga; chefes perdem 25%');
  fresh('knight', 'mangual'); yield 0.1;
  give('w_e1f2');
  e1S(player).metKills = 19;
  const foes = [dummy(1.2, 2.6), dummy(-1.4, 1.8), dummy(0.6, 0.4)];
  const boss = dummy(1.9, 2.9, 'guardian', 4000); boss.cooldown = 99;
  player.input = fake({ attack: () => true }); // na mira: atacar = cair agora
  dummy(0, 0.4, 'minion', 1); hit(0);
  yield 0.1;
  out(`  20º abate: começou ${ok(player.state === 'e1Meteor' && ev('e1MeteorStart').length === 1)} | imune ${ok(player.invulnerable)}`);
  for (const e of foes.slice(0, 2)) e.freeze(6, combat); // congelados não fogem (o 3º foge)
  yield* until(() => player.e1s.met && player.e1s.met.phase === 'aim', 3000);
  yield 0.2;
  out(`  sumiu no céu e apareceu o círculo ${ok(!player.model.visible && !!player.e1s.met.target)} | quem pode, foge ${ok(foes[2].state === 'axeFear', foes[2].state)}`);
  out('  -> Meteoro: mira (screenshot)'); yield 'hold';
  const bossHp = boss.hp;
  yield* until(() => player.e1s.met && player.e1s.met.phase === 'fall' && player.e1s.met.t > 0.25, 4000);
  out('  -> Meteoro: queda (screenshot)'); yield 'hold';
  yield* until(() => ev('e1MeteorHit').length > 0, 5000);
  const mh = ev('e1MeteorHit')[0];
  out(`  caiu em (${mh ? mh.x.toFixed(1) : '?'}, ${mh ? mh.z.toFixed(1) : '?'}) | esmagou ${mh ? mh.killed : 0} ${ok(mh && mh.killed >= 2 && !foes[0].alive && !foes[1].alive)} | chefe -25% (${bossHp - boss.hp}) ${ok(boss.alive && bossHp - boss.hp === 1000)}`);
  yield* until(() => player.state !== 'e1Meteor', 2000);
  out(`  terminou de pé ${ok(player.state !== 'e1Meteor' && player.state !== 'dead', player.state)} | modelo no chão ${ok(player.model.visible && player.model.position.y === 0)} | contagem zerou ${ok(player.e1s.metKills === 0)}`);
  player.input = realInput;

  // ================= Lança =================
  out('652) Chute Espartano: depois da estocada forte, um chute joga o inimigo num poço');
  fresh('knight', 'lanca'); yield 0.1;
  give('w_e1l1');
  const mn = dummy(0, -0.5, 'minion', 999);
  hit(heavyI());
  yield* until(() => ev('e1Kick').length > 0, 1500);
  out(`  chutou ${ok(ev('e1Kick').length === 1 && player.state === 'e1Kick')} | caiu no poço ${ok(mn.state === 'e1Pit' && combat.e1.pits.length === 1)}`);
  yield 0.3;
  out('  -> Chute Espartano (screenshot)'); yield 'hold';
  yield* until(() => ev('e1PitKill').length > 0, 2000);
  out(`  lacaio: sumiu (derrotado) ${ok(!mn.alive && ev('e1PitKill').length === 1)}`);
  fresh('knight', 'lanca'); yield 0.1;
  give('w_e1l1');
  const mg = dummy(0, -0.5, 'mage', 300);
  hit(heavyI());
  yield* until(() => ev('e1PitFall').length > 0, 2000);
  const hpIn = mg.hp;
  out(`  mago: caiu e não pode ser acertado ${ok(mg.state === 'e1Pit' && !mg.targetable)}`);
  yield* until(() => ev('e1PitClimb').length > 0, 4000);
  out(`  subiu de volta com -30% (${hpIn - mg.hp}) ${ok(mg.alive && hpIn - mg.hp === 90 && mg.targetable && mg.group.visible)}`);
  yield 1.5;
  out(`  o poço fechou ${ok(combat.e1.pits.length === 0)}`);
  fresh('knight', 'lanca'); yield 0.1;
  give('w_e1l1');
  const bs = dummy(0, -0.5, 'guardian', 4000); bs.cooldown = 99;
  hit(heavyI());
  yield* until(() => ev('e1KickPush').length > 0, 1500);
  out(`  chefe: só empurrado ${ok(ev('e1KickPush').length === 1 && ev('e1Kick').length === 0)}`);

  out('653) Bastão do Rei Macaco: segurar cresce a lança até 4×; soltar varre a sala');
  fresh('knight', 'lanca'); yield 0.1;
  give('w_e1l2');
  const far = [dummy(9, 2), dummy(-9, 2), dummy(0, -12)];
  let press = true, held = true;
  player.input = fake({ attack: () => { if (press) { press = false; return true; } return false; }, attackHeld: () => held });
  yield 0.6;
  out(`  crescendo ${ok(player.state === 'e1Staff')}`);
  yield* until(() => ev('e1StaffFull').length > 0, 2500);
  out(`  chegou a 4× ${ok(Math.abs(player.weapon.scale.y - 4) < 0.05, player.weapon.scale.y.toFixed(2))}`);
  out('  -> Lança 4× (screenshot)'); yield 'hold';
  held = false;
  yield* until(() => ev('e1Sweep').length > 0, 1500);
  const sw = ev('e1Sweep')[0];
  out(`  varreu: acertou os 3 longe (9 a 14 m) ${ok(sw && sw.n === 3 && far.every((e) => e.hp < 999))}`);
  yield 0.8;
  out(`  lança voltou ao tamanho normal ${ok(Math.abs(player.weapon.scale.y - 1) < 0.01 && player.state !== 'e1Staff')}`);
  press = true; held = true; yield 0.6; held = false; yield 0.4;
  out(`  soltou antes de 4×: não varre ${ok(ev('e1Sweep').length === 1)} | lança normal ${ok(Math.abs(player.weapon.scale.y - 1) < 0.01)}`);
  player.input = realInput;

  // ================= Cajado de Gelo =================
  out('654) Gelo Ancestral: 4 congelados -> o Yeti pula a parede e ataca só os congelados');
  fresh('mage', 'gelo'); yield 0.1;
  give('w_e1g1');
  const ice = [dummy(-4, -2, 'minion', 150), dummy(-1.5, -4, 'minion', 150), dummy(1.5, -4, 'minion', 150), dummy(4, -2, 'minion', 150)];
  const free = dummy(0, -7, 'minion', 150);
  for (const e of ice.slice(0, 3)) e.freeze(7, combat);
  yield 0.4;
  out(`  3 congelados: nada ${ok(!combat.e1.yeti)}`);
  ice[3].freeze(7, combat);
  yield 0.2;
  out(`  4 congelados: o Yeti apareceu ${ok(!!combat.e1.yeti && ev('e1Yeti').length === 1)}`);
  yield* until(() => ev('e1YetiHit').length > 0, 4000);
  out(`  pulou a parede e bateu num congelado ${ok(ev('e1YetiHit').length >= 1 && ice.includes(ev('e1YetiHit')[0].enemy))}`);
  out('  -> Yeti (screenshot)'); yield 'hold';
  yield* until(() => ev('e1YetiGone').length > 0, 14000);
  out(`  foi embora (${ev('e1YetiHit').length} golpes) ${ok(ev('e1YetiGone').length === 1 && !combat.e1.yeti)} | o que não estava congelado não apanhou ${ok(free.hp === 150)}`);
}
