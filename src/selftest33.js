// Teste automático, parte 33 (08/11/2026): 3ª leva de bênçãos da Rapieira (rapkit2.js / rapprops2.js).
// Roda no fim dos testes da Rapieira (tecla Home corrido; PageUp com pausas) e no Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { RAP2 } from './rapkit2.js';

const ok = (c, extra = '') => (c ? `✔${extra !== '' ? ` ${extra}` : ''}` : `ERRO${extra !== '' ? ` (${extra})` : ''}`);

export function* rap3Tests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const K = combat.rap2;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    combat.waveList = null;
    player.setHero('rogue', 'rapieira'); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    clearStrip(-13, 13, -16, 8);
    combat.props.list = combat.props.list.filter((b) => Math.abs(b.x) > 13 || b.z < -16 || b.z > 8);
    player.input = fake();
    player.iframes = 0;
    combat.noEvade = true; // sem o desvio de 10% do Ladino (o teste conta os acertos)
    flags.events.length = 0;
  };
  const give = (id) => player.addBlessing(BLESSINGS.find((x) => x.id === id));
  const dummy = (x, z, type = 'minion', hp = 999, passive = true, facing = 0) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; e.facing = facing; e.group.rotation.y = facing; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const C = () => player.hero.combo;
  const hit = (i = 0) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const errs0 = (window.__game.errors || []).length;

  out('420) Rapieira, 3ª leva: as 8 bênçãos novas');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'rogue.rapieira');
  const want = { 'Espetinho': 'epic', 'Já Está Morto': 'legendary', 'Constelação': 'epic', 'Linha e Agulha': 'rare', 'Touché!': 'epic', 'Pistola de Pederneira': 'rare', 'Um por Todos': 'legendary', 'Xeque-Mate': 'legendary' };
  const bad = Object.entries(want).filter(([n, r]) => !mine.some((b) => b.name === n && b.rarity === r)).map(([n]) => n);
  out(`  as 8 com a raridade certa ${ok(!bad.length, bad.join(', '))} | Rapieira com 18 ${ok(mine.length === 18, mine.length)}`);

  out('421) Espetinho: 1º e 2º golpe espetam; o golpe forte arremessa o espeto');
  fresh(); yield 0.1; give('w_rap32');
  const s1 = dummy(0, 0.2), s2 = dummy(0.6, -0.4), far = dummy(0, -7);
  hit(0); yield 0.05;
  out(`  1º golpe espetou ${ok(s1.state === 'lanceHeld' && ev('rapSkewer').length === 1, s1.state)}`);
  hit(1); yield 0.05;
  const onBlade = (e) => { // o peito do esqueleto em cima da lâmina
    const b = K.bodies.find((x) => x.e === e); if (!b || !player.weapon) return 9;
    const tip = (player.hero.weapons.right.tip || 1.9), d = RAP2.skewer.slots[b.slot];
    const pt = player.weapon.localToWorld(new player.weapon.position.constructor(0, b.t >= 0.12 ? d : tip, 0));
    return Math.hypot(e.position.x - pt.x, e.position.z - pt.z) + Math.max(0, Math.abs(e.position.y + RAP2.skewer.chest - pt.y) - (e.position.y <= -0.149 ? 9 : 0));
  };
  yield 0.15;
  out(`  2º golpe espetou outro ${ok(s2.state === 'lanceHeld' && ev('rapSkewer').length === 2, s2.state)} | atravessados no meio, na lâmina ${ok(onBlade(s1) < 0.2 && onBlade(s2) < 0.2, `${onBlade(s1).toFixed(2)} / ${onBlade(s2).toFixed(2)}`)}`);
  const sx0 = s1.position.x;
  player.position.x = 0.5; yield 0.05;
  out(`  anda com o espeto ${ok(Math.abs(s1.position.x - sx0 - 0.5) < 0.2, (s1.position.x - sx0).toFixed(2))} | continua na lâmina ${ok(onBlade(s1) < 0.2, onBlade(s1).toFixed(2))}`);
  out('  -> espeto com 2 (screenshot)');
  yield 'hold';
  player.position.x = 0; yield 0.02;
  hit(2); yield 0.12;
  out(`  arremessou ${ok(ev('rapSkewerThrow').length === 1 && s1.state === 'lanceFly', s1.state)}`);
  out('  -> espeto voando (screenshot)');
  yield 'hold';
  yield 0.6;
  out(`  acertou o de longe ${ok(far.hp < 999 && ev('rapSkewerHit').length >= 1, 999 - far.hp)} | os espetados caíram e apanharam ${ok(s1.state !== 'lanceFly' && s1.hp < 999 && s2.hp < 999)}`);

  out('422) Já Está Morto: o dano fica guardado; 1 s sem atacar = clic e abre tudo');
  fresh(); yield 0.1; give('w_rap33');
  const d1 = dummy(0, 0.3);
  hit(0); player.rap2AtkT = K.time; yield 0.05;
  hit(2); player.rap2AtkT = K.time;
  const held = K.holes.get(d1);
  out(`  não tirou vida ${ok(d1.hp === 999, 999 - d1.hp)} | furos guardados ${ok(held && held.n === 2 && held.dmg > 0, held && held.dmg)}`);
  out('  -> furos brilhando (screenshot)');
  yield 'hold';
  yield 0.6;
  out(`  antes de 1 s nada ${ok(!ev('rapClick').length && d1.hp === 999)}`);
  yield 0.6;
  out(`  clic ${ok(ev('rapClick').length === 1)}`);
  yield 0.3;
  const rel = ev('rapRelease')[0];
  out(`  abriu com +50% ${ok(rel && 999 - d1.hp >= Math.round(held.dmg * 1.4), `${held.dmg} -> ${999 - d1.hp}`)} | furos sumiram ${ok(!K.holes.has(d1))}`);

  out('423) Constelação: estrela em cada golpe; 3 ligam numa figura');
  fresh(); yield 0.1; give('w_rap34');
  const inn = dummy(0, 1.2, 'minion', 999), outE = dummy(0, -6, 'minion', 999);
  for (const f of [Math.PI, Math.PI / 2, -Math.PI / 2]) { player.facing = f; hit(0); yield 0.05; }
  const hpIn = inn.hp;
  out(`  3 estrelas ${ok(player.rap2Stars && player.rap2Stars.list.length === 3, player.rap2Stars && player.rap2Stars.list.length)}`);
  out('  -> 3 estrelas (screenshot)');
  yield 'hold';
  yield 1.1;
  const cs = ev('rapConstellation')[0];
  out(`  formou a figura ${ok(cs && cs.n === 3)} | quem estava dentro apanhou ${ok(inn.hp < hpIn, hpIn - inn.hp)} | fora não ${ok(outE.hp === 999)}`);
  // 5 estrelas = forma na hora
  fresh(); yield 0.1; give('w_rap34');
  for (let i = 0; i < 5; i++) { player.facing = i * 1.25; hit(0); }
  out(`  5 estrelas formam na hora ${ok(ev('rapConstellation').length === 1 && ev('rapConstellation')[0].n === 5)}`);

  out('424) Linha e Agulha: costura quem acerta; golpe forte puxa todos juntos');
  fresh(); yield 0.1; give('w_rap35');
  const t1 = dummy(-1.1, 0.1), t2 = dummy(1.1, 0.1);
  hit(1); yield 0.2;
  out(`  costurou os 2 ${ok(K.threads.length === 2, K.threads.length)}`);
  out('  -> linha vermelha (screenshot)');
  yield 'hold';
  const gap0 = Math.hypot(t1.position.x - t2.position.x, t1.position.z - t2.position.z);
  hit(2); yield 0.35;
  const gap1 = Math.hypot(t1.position.x - t2.position.x, t1.position.z - t2.position.z);
  out(`  puxou ${ok(ev('rapPull').length === 1)} | voaram juntos ${ok(gap1 < gap0 * 0.6, `${gap0.toFixed(1)} -> ${gap1.toFixed(1)}`)} | apanharam ${ok(ev('rapPullHit').length === 1 && t1.hp < 999 && t2.hp < 999)}`);

  out('425) Touché!: 5 toques eliminam; acerto dele zera o placar');
  fresh(); yield 0.1; give('w_rap36');
  const f1 = dummy(0, 0.3, 'warrior', 999, true, 0);
  for (let i = 0; i < 4; i++) { hit(0); yield 0.05; }
  const sc = K.scores.get(f1);
  out(`  placar 4 ${ok(sc && sc.me === 4, sc && sc.me)}`);
  out('  -> placar 4/5 (screenshot)');
  yield 'hold';
  player.iframes = 0; combat.hitPlayer(f1, 3, { target: player }); yield 0.05;
  out(`  ele acertou: placar zerou ${ok(sc.me === 0 && ev('rapToucheLost').length === 1, sc.me)}`);
  for (let i = 0; i < 4; i++) { hit(0); yield 0.05; }
  out(`  ainda vivo com 4 ${ok(f1.alive)}`);
  hit(0); yield 0.15;
  out(`  5º toque eliminou ${ok(!f1.alive && ev('rapTouche').length === 1)}`);
  // chefe: também 5 pontos, tira 20% da vida
  fresh(); yield 0.1; give('w_rap36');
  const bo = dummy(0, 0.2, 'minion', 1000); bo.data = { ...bo.data, boss: true };
  for (let i = 0; i < 5; i++) { hit(0); yield 0.05; }
  yield 0.1;
  const tb = ev('rapTouche')[0];
  out(`  chefe: 5 pontos ${ok(tb && tb.boss)} | tirou 20% ${ok(bo.alive && bo.hp <= 1000 - 200, 1000 - bo.hp)}`);

  out('426) Pistola de Pederneira: 4º golpe atira e o coice joga para trás');
  fresh(); yield 0.1; give('w_rap37');
  const pv = dummy(0, -1.5);
  out(`  combo de 4 ${ok(C().length === 4 && C()[3].rap2 === 'pistol')}`);
  const z0 = player.position.z;
  hit(3); yield 0.3;
  const ps = ev('rapPistol')[0];
  out(`  BANG acertou ${ok(ps && ps.hit && pv.hp < 999, 999 - pv.hp)} | coice para trás ${ok(player.position.z - z0 > 1.5, (player.position.z - z0).toFixed(1))}`);
  // pistola aparece na mão no 4º golpe
  fresh(); yield 0.1; give('w_rap37');
  player.combo = 3; player.startAttack(null); yield 0.05;
  out(`  pistola na mão, rapieira guardada ${ok(K.pistols.has(player) && player.weapon && !player.weapon.visible)}`);
  out('  -> pistola (screenshot)');
  yield 'hold';
  yield 0.8;
  out(`  depois a rapieira volta ${ok(!K.pistols.has(player) && player.weapon.visible)}`);

  out('427) Um por Todos: derrotado vira mosqueteiro (até 2) que repete tudo');
  fresh(); yield 0.1; give('w_rap38');
  for (let i = 0; i < 3; i++) { const k = dummy(0, 0.3, 'minion', 1); hit(0); yield 0.05; void k; }
  const M = K.musk.get(player) || [];
  out(`  2 mosqueteiros (não 3) ${ok(M.filter(Boolean).length === 2 && ev('rapMusk').length === 2)}`);
  yield 0.6;
  const dl = M[0] && Math.hypot(M[0].g.position.x - player.position.x, M[0].g.position.z - player.position.z);
  out(`  um de cada lado ${ok(M[0] && M[1] && Math.abs(dl - RAP2.musk.side) < 0.2 && Math.sign(M[0].g.position.x) !== Math.sign(M[1].g.position.x), dl && dl.toFixed(2))}`);
  player.combo = 0; player.startAttack(null); yield 0.05;
  out(`  repete a animação ${ok(M[0].anim.currentName === player.anim.currentName, M[0].anim.currentName)}`);
  out('  -> mosqueteiros (screenshot)');
  yield 'hold';
  yield 0.6;
  const mx = M.find((m) => m && m.g.position.x > 0).g.position.x;
  const side = dummy(mx, -0.2, 'minion', 999);
  player.facing = Math.PI; hit(0); yield 0.05;
  out(`  golpeou junto (metade) ${ok(side.hp < 999 && ev('rapMuskHit').some((e) => e.n > 0), 999 - side.hp)}`);
  player.iframes = 0; combat.hitPlayer(side, 3, { target: player }); yield 0.05;
  out(`  tomou dano: sumiram ${ok(!(K.musk.get(player) || []).some(Boolean))}`);

  out('428) Xeque-Mate: coroa no mais forte de todas as ondas; pelas costas = coroa é sua');
  fresh(); yield 0.1; give('w_rap39');
  combat.waveList = [[['minion', 2]], [['warrior', 1]]];
  const m1 = dummy(-3, 0, 'minion', 999); void m1;
  yield 0.1;
  out(`  sem o mais forte ainda: espera ${ok(!K.king)}`);
  const kg = dummy(0, 0.3, 'warrior', 1, true, 0); // de frente para o Ladino
  yield 0.1;
  out(`  coroa no Guerreiro ${ok(K.king && K.king.e === kg)}`);
  out('  -> rei coroado (screenshot)');
  yield 'hold';
  hit(0); yield 0.05;
  out(`  de frente: a coroa cai ${ok(!player.rapCrown && ev('rapKingLost').length === 1)}`);
  fresh(); yield 0.1; give('w_rap39');
  const hp0 = player.maxHp, as0 = player.atkSpeed, mv0 = player.moveMul;
  const kb = dummy(0, 0.3, 'warrior', 1, true, Math.PI); // de costas
  yield 0.1;
  hit(0); yield 0.05;
  out(`  pelas costas: coroa sua ${ok(player.rapCrown && ev('rapCrown').length === 1)} | +30 de vida ${ok(player.maxHp === hp0 + 30)} | ataque e passo +30% ${ok(Math.abs(player.atkSpeed / as0 - 1.3) < 0.01 && Math.abs(player.moveMul / mv0 - 1.3) < 0.01)}`);
  const foe = dummy(3, 3, 'minion', 999); player.iframes = 0;
  const h1 = player.hp; combat.hitPlayer(foe, 10, { target: player });
  out(`  dano recebido -30% ${ok(h1 - player.hp === 7, h1 - player.hp)}`);
  out('  -> coroa no Ladino (screenshot)');
  yield 'hold';
  combat.clear(); yield 0.05;
  out(`  sala nova: a coroa some ${ok(!player.rapCrown && player.maxHp === hp0)}`);
  void kb;

  out('430) Velocidade da Luz: golpe novo antes do forte, uma estocada em cada inimigo de costas');
  fresh(); yield 0.1; give('w_rap40');
  out(`  combo de 4 ${ok(C().length === 4 && C()[2].rap2 === 'light' && C()[3].heavy && player.hero.heavyIdx === 3)}`);
  const L1 = dummy(0, 0.6, 'minion', 999, true, Math.PI), L2 = dummy(1.1, 0.7, 'minion', 999, true, Math.PI), L3 = dummy(-1.1, 0.4, 'minion', 999, true, Math.PI);
  const Lf = dummy(0.6, -0.4, 'minion', 999, true, 0); // de frente: fica de fora
  yield 0.05;
  player.combo = 2; player.startAttack(null);
  yield 0.1;
  out('  -> estocadas de luz (screenshot)');
  yield 'hold';
  yield 0.5;
  out(`  ${ev('rapLightStab').length} estocadas, uma em cada ${ok(ev('rapLightStab').length === 3 && L1.hp < 999 && L2.hp < 999 && L3.hp < 999, ev('rapLightStab').length)} | quem estava de frente não ${ok(Lf.hp === 999)}`);
  fresh(); yield 0.1; give('w_rap40');
  const Ln = dummy(0, 0.4, 'minion', 999, true, 0);
  hit(2); yield 0.05;
  out(`  ninguém de costas: estocada normal ${ok(ev('rapLight')[0] && ev('rapLight')[0].n === 0 && Ln.hp < 999)}`);
  fresh(); yield 0.1; give('w_rap40'); give('w_rap37');
  out(`  com a Pistola: luz, forte, tiro ${ok(C().length === 5 && C()[2].rap2 === 'light' && C()[3].heavy && C()[4].rap2 === 'pistol')}`);

  out('431) Vem Dançar: cortar quem já está de costas = gira e fica tonto 3 s');
  fresh(); yield 0.1; give('w_rap41');
  const D1 = dummy(0, 0.5, 'minion', 999, true, Math.PI), D2 = dummy(-3, 0.5, 'minion', 999, true, 0);
  hit(1); yield 0.1;
  out(`  girou ${ok(ev('rapDance').length === 1 && !!D1.rap2Dizzy && D1.state === 'hurt')}`);
  yield 0.5;
  out(`  estrelinhas na cabeça ${ok(D1.rap2Dizzy && D1.rap2Dizzy.stars.visible && D1.rap2Dizzy.stars.position.y > 2.3)}`);
  out('  -> tonto (screenshot)');
  yield 'hold';
  hit(0); yield 0.3;
  out(`  apanhou e continua tonto ${ok(D1.state === 'hurt' && !!D1.rap2Dizzy)}`);
  yield 1.9;
  out(`  ainda tonto aos 2,8 s ${ok(D1.state === 'hurt')}`);
  yield 0.9;
  out(`  acordou depois de 3 s ${ok(D1.state !== 'hurt' && !D1.rap2Dizzy && !D1.rap2Dizzy, D1.state)}`);
  player.facing = Math.atan2(D2.position.x - player.position.x, D2.position.z - player.position.z);
  hit(1); yield 0.05;
  out(`  de frente: só vira de costas ${ok(ev('rapDance').length === 1 && ev('turnedAway').some((x) => x.enemy === D2))}`);

  out('432) Espetinho: rolar solta os espetados');
  fresh(); yield 0.1; give('w_rap32');
  const R1 = dummy(0, 0.2);
  hit(0); yield 0.1;
  player.dodgeCooldown = 0; player.startDodge(); yield 0.05;
  out(`  soltou ${ok(R1.state !== 'lanceHeld' && ev('rapSkewerDrop').length === 1 && R1.position.y === 0, R1.state)}`);

  const errs = (window.__game.errors || []).length - errs0;
  out(`429) 3ª leva sem erros do jogo ${ok(errs === 0, errs)}`);
  combat.noEvade = false;
  player.input = realInput;
}
