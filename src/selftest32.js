// Teste automático, parte 32 (07/11/2026): bênçãos novas da Besta de Mão (boltkit.js / boltprops.js).
// Tecla PageDown = só a Besta (corrido); Insert = com as pausas de screenshot; também roda no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { BES } from './boltkit.js';

const ok = (c, extra = '') => (c ? `✔${extra !== '' ? ` ${extra}` : ''}` : `ERRO${extra !== '' ? ` (${extra})` : ''}`);

export function* boltTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const K = combat.bolt, RK = combat.rogue;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  let press = false, held = false, mv = null;
  const live = () => fake({ attack: () => press, attackHeld: () => held, moveDir: (v) => (mv ? v.set(mv[0], 0, mv[1]) : v.set(0, 0, 0)) });
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('rogue', 'besta'); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    clearStrip(-13, 13, -16, 8);
    combat.props.list = combat.props.list.filter((b) => Math.abs(b.x) > 13 || b.z < -16 || b.z > 8);
    press = false; held = false; mv = null;
    player.input = live();
    player.iframes = 0;
    flags.events.length = 0;
  };
  const give = (id) => player.addBlessing(BLESSINGS.find((x) => x.id === id));
  const dummy = (x, z, type = 'minion', hp = 999, passive = true, facing = 0) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; e.facing = facing; e.group.rotation.y = facing; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const C = () => player.hero.combo;
  const aimAt = (e) => { player.facing = Math.atan2(e.position.x - player.position.x, e.position.z - player.position.z); player.group.rotation.y = player.facing; };
  const shoot = (step = C()[0]) => { if (!player.ammo.length) player.ammo.push({ stack: 0 }); combat.playerStrike(player, step); };
  const tap = function* () { press = true; yield 0.01; press = false; yield 0.01; };
  const bolts = (f = (it) => it.kind === 'bolt') => RK.items.filter(f);
  const errs0 = (window.__game.errors || []).length;

  out('400) Besta: as 20 bênçãos novas');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'rogue.besta');
  const want = ['Recarga Perfeita', 'Recarga no Pulo', 'Eco do Tiro', 'Gancho', 'Tiro Acrobático', 'Prego', 'Rede', 'Âncora', 'Armadilha de Urso',
    'Golpe Baixo', 'Virote Divisor', 'Quique na Parede', 'Ricochete no Escudo', 'Rastro Incendiário', 'Chuva de Virotes', 'Roleta', 'Mira de Atirador', 'Divindade', 'Besta Montada'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  const by = (n) => mine.find((b) => b.name === n) || {};
  out(`  ${mine.length} bênçãos (26; sem Corda Tensa) ${ok(mine.length === 26 && !mine.some((b) => b.name === 'Corda Tensa'))} | as 19 ${ok(!miss.length, miss.join(', '))} | lendárias 4 ${ok(want.filter((n) => by(n).rarity === 'legendary').length === 4)} | épicas 8 ${ok(want.filter((n) => by(n).rarity === 'epic').length === 8)} | raras 7 ${ok(want.filter((n) => by(n).rarity === 'rare').length === 7)} | sem Sino/Bomba de Fumaça ${ok(!mine.some((b) => b.name === 'Sino' || b.name === 'Bomba de Fumaça'))}`);

  out('401) Recarga Perfeita: barrinha, faixa dourada, besta travada');
  fresh(); yield 0.1; give('w_bes11'); give('w_bes5'); // + Aljava (2 virotes)
  let d1 = dummy(0, -8);
  player.startAttack(null);
  yield () => ev('rogueFire').length > 0;
  out(`  barrinha apareceu ${ok(player.bBar && player.bBarG && player.bBarG.visible)}`);
  yield () => player.bBar && player.bBar.t >= BES.reload.dur * 0.62;
  out('  -> barrinha na faixa dourada (screenshot)');
  yield 'hold';
  yield* tap();
  out(`  recarga perfeita ${ok(ev('bReloadOk').length === 1 && player.bPerfect)} | não atirou de novo ${ok(ev('rogueFire').length === 1)} | já pode atirar ${ok(player.state === 'idle')}`);
  yield 0.1;
  player.startAttack(null);
  const ps = player.xstep;
  out(`  tiro forte e rápido ${ok(ps && ps.perfect && Math.abs(ps.damage - C()[0].damage * BES.reload.mul) < 0.01 && Math.abs(ps.speed - C()[0].speed * BES.reload.speed) < 0.01)}`);
  yield () => ev('rogueFire').length > 1;
  out(`  saiu ${ok(ev('bPerfectShot').length === 1 && !player.bPerfect)}`);
  player.ammo.push({ stack: 0 });
  yield 0.3; player.setState('idle');
  // agora erra a faixa
  shoot(); yield 0.15; yield* tap();
  out(`  apertou cedo: travou ${ok(ev('bReloadJam').length === 1 && player.bJam > 0)}`);
  player.ammo.push({ stack: 0 }); const nf = ev('rogueFire').length;
  yield* tap(); yield 0.1;
  out(`  travada não atira ${ok(ev('rogueFire').length === nf && player.state !== 'attack')}`);
  yield BES.reload.jam + 0.1;
  yield* tap(); yield () => ev('rogueFire').length > nf;
  out(`  destravou ${ok(ev('rogueFire').length > nf)}`);
  void d1;

  out('402) Recarga no Pulo: pegar o virote já atira no mais perto');
  fresh(); yield 0.1; give('w_bes12');
  d1 = dummy(0, -6); const d2 = dummy(5, -2);
  aimAt(d1); shoot();
  yield () => bolts((it) => it.state === 'ground').length > 0;
  const hp2 = d2.hp, gb = bolts()[0];
  player.position.set(gb.x, 0, gb.z);
  yield () => ev('bAuto').length > 0;
  out(`  pegou e atirou ${ok(ev('bAuto').length === 1 && player.ammo.length === 0)}`);
  yield 1.0;
  out(`  o virote automático não atira de novo ${ok(ev('bAuto').length === 1, ev('bAuto').length)}`);
  out(`  acertou o mais perto ${ok(d2.hp < hp2 || d1.hp < 999 - 40, `${hp2 - d2.hp}/${999 - d1.hp}`)}`);

  out('403) Eco do Tiro: matou -> virote fantasma no próximo');
  fresh(); yield 0.1; give('w_bes13');
  d1 = dummy(0, -5, 'minion', 5); const e2 = dummy(6, -6);
  aimAt(d1); shoot();
  yield () => ev('bEcho').length > 0;
  out(`  eco ${ok(ev('bEcho').length === 1 && !d1.alive)}`);
  yield 0.15;
  out('  -> virote fantasma (screenshot)');
  yield 'hold';
  yield () => e2.hp < 999;
  out(`  fantasma acertou ${ok(e2.hp < 999, 999 - e2.hp)} | não virou munição ${ok(bolts((it) => it.fake).length === 0)}`);

  out('404) Gancho: besta vazia + ataque = puxa até o inimigo / a parede');
  fresh(); yield 0.1; give('w_bes14');
  d1 = dummy(0, -8);
  player.ammo.length = 0;
  yield* tap();
  out(`  gancho saiu ${ok(ev('bHook').length === 1 && player.state === 'boltHook')}`);
  yield () => ev('bHookCatch').length > 0;
  yield 0.1;
  out('  -> puxando pela corda (screenshot)');
  yield 'hold';
  yield () => ev('bHookArrive').length > 0;
  const dd = Math.hypot(player.position.x - d1.position.x, player.position.z - d1.position.z);
  out(`  chegou no inimigo ${ok(dd < 2.4, dd.toFixed(2))} | levou dano ${ok(d1.hp < 999)}`);
  yield 0.6;
  combat.world.addRect(-3, -1.5, 3, -0.8); // parede na frente
  player.position.set(0, 0, 6); aimAt({ position: { x: 0, z: -5 } }); d1.position.set(9, 0, 9);
  player.setState('idle'); yield 0.05;
  yield* tap();
  yield () => ev('bHookArrive').length > 1;
  out(`  puxou até a parede ${ok(player.position.z < 1.2 && player.position.z > -0.8, player.position.z.toFixed(2))}`);

  out('406) Tiro Acrobático: rolar não interrompe a besta armando');
  // sem a bênção: rolar cancela o disparo
  fresh(); yield 0.1;
  d1 = dummy(-3, -7); aimAt(d1);
  player.ammo.length = 1; player.startAttack(null); yield 0.12;
  mv = [1, 0]; player.startDodge(); yield 1.0; mv = null;
  out(`  sem a bênção: rolar cancela ${ok(ev('rogueFire').length === 0)}`);
  // rolar no começo: a besta continua armando e atira no meio da rolagem
  fresh(); yield 0.1; give('w_bes16');
  d1 = dummy(-3, -7); aimAt(d1);
  player.aimAngle = () => Math.atan2(d1.position.x - player.position.x, d1.position.z - player.position.z); // mira no alvo (como o mouse)
  player.startAttack(null); yield 0.5;
  mv = [1, 0]; player.startDodge();
  out(`  guardou a carga ${ok(!!player.bChan && ev('bChanSave').length === 1, player.bChan ? player.bChan.prog.toFixed(2) : '-')}`);
  yield () => ev('bRollShot').length > 0 || ev('bChanResume').length > 0;
  out(`  atirou no meio da rolagem ${ok(ev('rogueFire').length === 1 && ev('bRollShot').length === 1 && player.state === 'dodge', player.state)}`);
  out('  -> tiro no meio da rolagem (screenshot)');
  yield 'hold';
  yield 0.6; mv = null;
  out(`  acertou ${ok(d1.hp < 999, 999 - d1.hp)}`);
  // rolar logo no começo: a rolagem acaba antes e o disparo continua de onde parou
  fresh(); yield 0.1; give('w_bes16');
  d1 = dummy(-3, -7); aimAt(d1);
  player.startAttack(null); yield 0.03;
  mv = [1, 0]; player.startDodge(); yield () => player.state !== 'dodge'; mv = null;
  out(`  rolagem acabou antes: continua armando ${ok(ev('bChanResume').length === 1 && player.state === 'attack', player.state)}`);
  yield () => ev('rogueFire').length > 0;
  out(`  atirou sem recomeçar do zero ${ok(ev('rogueFire').length === 1)}`);
  // sem estar armando: clicar rolando não atira
  fresh(); yield 0.1; give('w_bes16');
  mv = [1, 0]; player.startDodge(); press = true; yield 0.15; press = false; mv = null;
  out(`  clicar rolando não atira ${ok(ev('rogueFire').length === 0 && ev('bRollShot').length === 0)}`);
  delete player.aimAngle; yield 0.6;

  out('407) Prego: empurrado contra a parede = pregado 2 s');
  fresh(); yield 0.1; give('w_bes17');
  combat.world.addRect(-3, -7, 3, -6);
  d1 = dummy(0, -5.1);
  aimAt(d1); shoot();
  yield () => ev('bNail').length > 0;
  out(`  pregado ${ok(ev('bNail').length === 1 && d1.state === 'hurt' && d1.stunTime >= BES.nail.t - 0.01)}`);
  yield 0.2;
  out('  -> pregado na parede (screenshot)');
  yield 'hold';
  const nx = d1.position.x, nz = d1.position.z;
  d1.vel.set(8, 0, 0); yield 0.3;
  out(`  não sai do lugar ${ok(Math.hypot(d1.position.x - nx, d1.position.z - nz) < 0.05)}`);
  const d3 = dummy(6, -2); aimAt(d3); shoot(); yield 0.5;
  out(`  sem parede atrás: não prega ${ok(ev('bNail').length === 1)}`);

  out('408) Rede: prende todos onde o virote cair por 2 s');
  fresh(); yield 0.1; give('w_bes18');
  d1 = dummy(0, -7); const n2 = dummy(1.4, -7.6), n3 = dummy(-1.3, -6.4), nfar = dummy(6, -7);
  aimAt(d1); shoot();
  yield () => ev('bNet').length > 0;
  out(`  rede ${ok(ev('bNet')[0].n >= 3, ev('bNet')[0].n)} | presos ${ok([d1, n2, n3].every((e) => e.state === 'hurt'))} | longe não ${ok(nfar.state !== 'hurt')}`);
  yield 0.25;
  out('  -> rede (screenshot)');
  yield 'hold';
  yield BES.net.t + 0.4;
  out(`  soltou ${ok(K.nets.length === 0 && n2.state !== 'hurt')}`);

  out('409) Âncora: só anda em volta do ponto por 6 s');
  fresh(); yield 0.1; give('w_bes19');
  d1 = dummy(0, -6);
  aimAt(d1); shoot();
  yield () => ev('bAnchor').length > 0;
  const ax = K.anchors[0].x, az = K.anchors[0].z;
  d1.vel.set(0, 0, 0); d1.position.set(ax + 6, 0, az);
  yield 0.1;
  const ad = Math.hypot(d1.position.x - ax, d1.position.z - az);
  out(`  ancorado ${ok(K.anchors.length === 1)} | corda segura ${ok(ad <= BES.anchor.r + 0.05, ad.toFixed(2))}`);
  out('  -> corda (screenshot)');
  yield 'hold';
  yield BES.anchor.t;
  d1.position.set(ax + 6, 0, az); yield 0.1;
  out(`  6 s ${ok(BES.anchor.t === 6)} | soltou ${ok(K.anchors.length === 0 && Math.hypot(d1.position.x - ax, d1.position.z - az) > 4)}`);

  out('410) Armadilha de Urso: virote que erra vira armadilha');
  fresh(); yield 0.1; give('w_bes20');
  combat.world.addRect(-3, -9, 3, -8);
  shoot();
  yield () => ev('bTrapSet').length > 0;
  const tb = bolts()[0];
  out(`  armadilha no chão ${ok(!!tb.trap)}`);
  yield 0.1;
  out('  -> armadilha aberta (screenshot)');
  yield 'hold';
  d1 = dummy(tb.x + 4, tb.z, 'minion', 999, true);
  d1.position.set(tb.x + 0.3, 0, tb.z);
  yield () => ev('bTrap').length > 0;
  out(`  mordeu ${ok(ev('bTrap').length === 1 && d1.state === 'hurt' && d1.hp < 999)}`);
  yield 0.1;
  out('  -> armadilha fechada (screenshot)');
  yield 'hold';
  const ex = d1.position.x; d1.vel.set(6, 0, 0); yield 0.3;
  out(`  preso no lugar ${ok(Math.abs(d1.position.x - ex) < 0.05)}`);
  // acertou um inimigo: não vira armadilha
  fresh(); yield 0.1; give('w_bes20'); d1 = dummy(0, -5); aimAt(d1); shoot(); yield 0.6;
  out(`  acertou: sem armadilha ${ok(ev('bTrapSet').length === 0)}`);

  out('411) Golpe Baixo: o virote leva a arma; o inimigo vai buscar');
  fresh(); yield 0.1; give('w_bes21');
  combat.world.addRect(-3, -13, 3, -12);
  const s1 = dummy(0, -4, 'minion', 999, false);
  const nW = s1.weapons.length;
  aimAt(s1); shoot();
  yield () => ev('bSteal').length > 0;
  out(`  arrancou a arma ${ok(s1.rogueDisarmed && s1.weapons.length === nW - 1)} | virote seguiu ${ok(bolts()[0] && bolts()[0].state === 'fly')}`);
  yield () => ev('bStealDrop').length > 0;
  const sp = ev('bStealDrop')[0];
  out(`  arma caiu longe, junto do virote ${ok(sp.z < -9, sp.z.toFixed(1))}`);
  yield 0.4;
  out(`  vai buscar a arma ${ok(s1.target && s1.target.decoy)}`);
  out('  -> arma no chão, esqueleto indo buscar (screenshot)');
  yield 'hold';
  yield () => ev('bStealBack').length > 0 || flags.t > 9e9;
  out(`  pegou de volta ${ok(!s1.rogueDisarmed && s1.weapons.length === nW)} | volta para o herói ${ok(!(s1.target && s1.target.decoy))}`);

  out('412) Virote Divisor: vira 3 em leque');
  fresh(); yield 0.1; give('w_bes22');
  const f1 = dummy(0, -12), f2 = dummy(-2.15, -12), f3 = dummy(2.15, -12);
  aimAt(f1); shoot();
  yield () => ev('bSplit').length > 0;
  out(`  dividiu ${ok(bolts((it) => it.fake).length === 2)}`);
  yield 0.06;
  out('  -> leque (screenshot)');
  yield 'hold';
  yield 0.5;
  out(`  acertou os 3 ${ok(f1.hp < 999 && f2.hp < 999 && f3.hp < 999, `${999 - f1.hp}/${999 - f2.hp}/${999 - f3.hp}`)} | extras sumiram ${ok(bolts((it) => it.fake).length === 0 && bolts().length === 1)}`);

  out('413) Quique na Parede');
  fresh(); yield 0.1; give('w_bes23');
  combat.world.addRect(-3, -9, 3, -8);
  const q1 = dummy(7, -4);
  shoot();
  yield () => ev('bBounce').length > 0;
  yield 0.5;
  out(`  quicou ${ok(ev('bBounce').length === 1)} | acertou ${ok(q1.hp < 999)}`);

  out('414) Ricochete no Escudo');
  fresh(); yield 0.1; give('w_bes24');
  const sh = dummy(0, -5, 'warrior', 999, true, 0); sh.shieldCovers = () => true;
  const r2 = dummy(-5, -6);
  aimAt(sh); shoot();
  yield () => ev('bShieldRico').length > 0;
  yield 0.5;
  out(`  escudo segurou ${ok(sh.hp === 999)} | ricocheteou ${ok(ev('bShieldRico').length === 1)} | acertou outro ${ok(r2.hp < 999)}`);

  out('415) Rastro Incendiário');
  fresh(); yield 0.1; give('w_bes25');
  const fb = dummy(4, -5); d1 = dummy(0, -11);
  aimAt(d1); shoot();
  yield 0.4; fb.position.set(0, 0, -5);
  out(`  fogo no caminho ${ok(K.flames.length > 8, K.flames.length)}`);
  out('  -> linha de fogo (screenshot)');
  yield 'hold';
  yield 0.6;
  out(`  quem pisa queima ${ok(fb.burn > 0 || fb.hp < 999)}`);
  yield BES.fire.t;
  out(`  apagou ${ok(K.flames.length === 0)}`);

  out('416) Chuva de Virotes: segurar o ataque');
  fresh(); yield 0.1; give('w_bes26');
  const rr = [dummy(0, -7), dummy(1.2, -8), dummy(-1, -6.4)];
  held = true; press = true; yield 0.02; press = false;
  yield () => ev('bRain').length > 0;
  held = false;
  out(`  disparou para o alto ${ok(ev('bRain').length === 1 && player.ammo.length === 0 && ev('rogueFire').length === 0)}`);
  yield 0.5;
  out('  -> alvo da chuva (screenshot)');
  yield 'hold';
  yield 0.7;
  out('  -> chuva caindo (screenshot)');
  yield 'hold';
  yield 0.8;
  out(`  acertou ${ok(rr.filter((e) => e.hp < 999).length >= 2, rr.map((e) => 999 - e.hp).join('/'))} | virote no chão ${ok(bolts((it) => it.state === 'ground' && !it.fake).length === 1)}`);
  // toque rápido: tiro normal
  player.ammo.length = 0; RK.removeOwned(player); player.ammo.push({ stack: 0 }); player.setState('idle');
  yield* tap(); yield () => ev('rogueFire').length > 0;
  out(`  toque rápido = tiro normal ${ok(ev('bRain').length === 1)}`);

  out('417) Roleta: a cada 5 tiros, 1 especial');
  fresh(); yield 0.1; give('w_bes27');
  const rl = dummy(0, -6, 'minion', 9999);
  aimAt(rl);
  for (let i = 0; i < 5; i++) { shoot(); yield 0.05; }
  out(`  armou ${ok(ev('bRouletteArm').length === 1 && !!player.bRoul, player.bRoul && player.bRoul.name)}`);
  player.bRoul = { id: 'ice', name: 'Gelo', color: 0x9fe8ff };
  shoot(); yield 0.4;
  out(`  6º tiro especial ${ok(ev('bRouletteShot').length === 1)} | gelo congelou ${ok(rl.frozenT > 0)}`);
  for (let i = 0; i < 5; i++) { shoot(); yield 0.05; }
  player.bRoul = { id: 'zap', name: 'Raio', color: 0xfff06a };
  const z2 = dummy(2, -7, 'minion', 999); rl.frozenT = 0;
  shoot(); yield 0.4;
  out(`  raio pulou ${ok(z2.hp < 999)}`);

  out('418) Mira de Atirador: parado 1,5 s');
  fresh(); yield 0.1; give('w_bes28');
  const m1 = dummy(0, -5, 'warrior', 999, true, 0); m1.shieldCovers = () => true; delete m1.shieldCovers; // escudo de verdade
  const m2 = dummy(0, -9);
  yield 1.0;
  out(`  1 s: ainda não ${ok(!player.bAim)}`);
  yield 0.6;
  out(`  1,5 s: linha de mira ${ok(player.bAim && player.bLaser && player.bLaser.visible)}`);
  out('  -> linha de mira (screenshot)');
  yield 'hold';
  shoot(); yield 0.5;
  out(`  atravessou o escudo e o 2º ${ok(m1.hp < 999 && m2.hp < 999, `${999 - m1.hp}/${999 - m2.hp}`)} | atordoou ${ok(ev('bSniperStun').length >= 1)}`);
  mv = [1, 0]; yield 1.6; mv = null;
  out(`  andando não mira ${ok(!player.bAim)}`);

  out('419) Divindade: entidade atira uma flecha espectral junto');
  fresh(); yield 0.1; give('w_bes29');
  const v1 = dummy(-5, 2), v2 = dummy(-8, 2.3), v3s = dummy(-11, 1.7, 'warrior'); // de lado: a entidade aparece de perfil
  aimAt(v1);
  player.startAttack(null);
  yield () => ev('bDivine').length > 0;
  yield 0.12;
  out(`  entidade apareceu ${ok(K.spirits.length === 1)}`);
  out('  -> entidade espectral (screenshot)');
  yield 'hold';
  yield 0.6;
  const dh = ev('bDivineHit');
  out(`  flecha atravessou todos ${ok(dh.length >= 3, dh.length)} | marcados ${ok([v1, v2, v3s].every((e) => e.bDivT > 0))} | metade do dano ${ok(999 - v2.hp > 0 && 999 - v2.hp <= C()[0].damage * 0.5 * 1.6 + 1, 999 - v2.hp)}`);
  const hp0 = v2.hp; combat.bonusDamage(v2, 10, 0, 0, 'dmg', player, true); const plain = hp0 - v2.hp;
  const hp1 = v2.hp; combat.damageEnemy(player, v2, { damage: 10 }, 0, -1); const marked = hp1 - v2.hp;
  out(`  marcado sofre +15% ${ok(marked >= 11, `${plain} / ${marked}`)}`);
  yield BES.divine.life;
  out(`  entidade sumiu ${ok(K.spirits.length === 0)}`);

  out('420) Besta Montada: torre por 5 s, Ladino chuta');
  fresh(); yield 0.1; give('w_bes30');
  const t1 = dummy(-4, -8), t2 = dummy(4, -8);
  player.useAbility(null);
  out(`  montou ${ok(!!player.bTurret && ev('bTurret').length === 1)} | besta saiu da mão ${ok(player.weapon && !player.weapon.visible)} | sem fumaça ${ok(!(player.stealth > 0))}`);
  yield 1.2;
  out(`  torre atirou ${ok(ev('bTurretShot').length >= 1)}`);
  out('  -> torre (screenshot)');
  yield 'hold';
  player.ammo.length = 0;
  const kk = dummy(0, 0.4); aimAt(kk);
  player.startAttack(null);
  out(`  chute sem virote ${ok(player.state === 'attack' && player.xstep && player.xstep.boltKick)}`);
  yield 0.5;
  out(`  chute acertou ${ok(kk.hp < 999)}`);
  yield 0.2;
  out('  -> chute (screenshot)');
  yield 'hold';
  yield BES.turret.t;
  out(`  torre sumiu ${ok(!player.bTurret && player.weapon.visible)} | acertou ${ok(t1.hp < 999 || t2.hp < 999)}`);
  player.useAbility(null);
  out(`  recarga de 10 s ${ok(!player.bTurret)}`);

  out('421) Besta com as 29: sem erros');
  fresh(); yield 0.1;
  for (const b of mine) for (let i = 0; i < b.max; i++) player.addBlessing(b);
  combat.world.addRect(-12, -14, 12, -13);
  const all = [];
  for (let i = 0; i < 6; i++) all.push(dummy(-4 + i * 1.6, -3 - (i % 2) * 2.5, i % 3 === 1 ? 'warrior' : 'minion', 60, false));
  all.push(dummy(0, -10, 'archer', 60, false));
  for (let t = 0; t < 48; t++) {
    const a = all.find((x) => x.alive) || all[0];
    aimAt(a);
    if (!player.ammo.length && t % 3 === 0) player.ammo.push({ stack: 0 });
    if (player.state === 'idle' || player.state === 'run') player.startAttack(null);
    if (t % 7 === 6) player.startDodge();
    if (t === 10) player.useAbility(null);
    if (t === 20) { held = true; press = true; } else if (t === 22) { held = false; press = false; }
    if (t === 30) { player.ammo.length = 0; press = true; } else if (t === 31) press = false;
    yield 0.25;
  }
  press = false; held = false;
  yield 2.5;
  const errs = (window.__game.errors || []).length - errs0;
  out(`  sem erros do jogo ${ok(errs === 0, errs)}`);
  player.input = realInput;
}
