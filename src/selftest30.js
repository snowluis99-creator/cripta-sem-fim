// Teste automático, parte 30 (07/11/2026): bênçãos novas das Garras (clawkit.js / clawprops.js).
// Tecla End = só as Garras; também roda no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { CLAW, clawLionCheck } from './clawkit.js';

const ok = (c, extra = '') => (c ? `✔${extra !== '' ? ` ${extra}` : ''}` : `ERRO${extra !== '' ? ` (${extra})` : ''}`);

export function* clawTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const K = combat.claw2;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const fresh = (inp = {}) => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('rogue', 'garras'); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
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
  const bleed = (e, n = 1) => { e.bleedStacks = n; e.bleedBy = player; };
  const errs0 = (window.__game.errors || []).length;

  out('331) Garras: as 20 bênçãos novas');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'rogue.garras');
  const want = ['Investida do Leão', 'Rugido', 'Montaria', 'Revide', 'Cair de Pé', 'Morte Dolorosa', 'Contágio de Sangue', 'Poça de Sangue', 'Marcas de Garra', 'Cortes de Vento', 'Tigre Fantasma', 'Afiar na Parede', 'Rasgar Escudo', 'Armadilha de Urso', 'Fúria da Fera', 'Sete Vidas', 'Matilha'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  const by = (n) => mine.find((b) => b.name === n) || {};
  out(`  ${mine.length} bênçãos (23) ${ok(mine.length === 23)} | as 17 ${ok(!miss.length, miss.join(', '))} | lendárias 3 ${ok(want.filter((n) => by(n).rarity === 'legendary').length === 3)} | raras 8 ${ok(want.filter((n) => by(n).rarity === 'rare').length === 8)} | épicas 6 ${ok(want.filter((n) => by(n).rarity === 'epic').length === 6)}`);

  out('332) Investida do Leão: ataque + rolamento juntos = some e reaparece cortando o caminho');
  fresh(); yield 0.1; give('w_gar11');
  const b1 = dummy(0, 0.6), b2 = dummy(0.3, -1.4), b3 = dummy(4, -1);
  const z0 = player.position.z;
  let both = true;
  player.input = fake({ attack: () => both, dodge: () => both });
  yield 0.02; both = false;
  out(`  braços em X ${ok(player.state === 'clawLion' && player.clawPose === 'x' && ev('clawLion').length === 1, player.state)}`);
  yield 0.12;
  out('  -> braços em X (screenshot)');
  yield 'hold';
  yield 0.15;
  out(`  cortou o caminho ${ok(b1.hp < 999 && b2.hp < 999, `${999 - b1.hp}/${999 - b2.hp}`)} | fora do caminho não ${ok(b3.hp === 999)}`);
  yield 0.08;
  out(`  reapareceu à frente ${ok(player.model.visible && z0 - player.position.z > 2, (z0 - player.position.z).toFixed(1))} | braços para baixo ${ok(player.clawPose === 'down')}`);
  out('  -> reapareceu (screenshot)');
  yield 'hold';
  yield 0.5;
  out(`  acabou ${ok(player.state !== 'clawLion')} | recarga 10 s ${ok(player.clawLionCd > 8, player.clawLionCd.toFixed(1))}`);
  both = true; yield 0.02; both = false; yield 0.1;
  out(`  na recarga: não sai ${ok(ev('clawLion').length === 1)}`);
  fresh(); yield 0.1;
  both = true; player.input = fake({ attack: () => both, dodge: () => both }); yield 0.02; both = false;
  out(`  sem a bênção: nada ${ok(ev('clawLion').length === 0)}`);

  out('333) Rugido: o 5º golpe faz os inimigos em volta fugirem de medo');
  fresh(); yield 0.1; give('w_gar12');
  const r1 = dummy(-2, 0.5), r2 = dummy(2.5, 1), r3 = dummy(0, -8);
  hit(4); yield 0.05;
  out(`  rugiu ${ok(ev('clawRoar').length === 1)} | perto fugiram ${ok(r1.state === 'axeFear' && r2.state === 'axeFear', `${r1.state}/${r2.state}`)} | longe não ${ok(r3.state !== 'axeFear')}`);
  yield 0.6;
  out(`  fugindo para longe ${ok(Math.hypot(r1.position.x, r1.position.z - 2) > 2.2)}`);
  yield 1.3;
  out(`  depois de 1,5 s voltam ${ok(r1.state !== 'axeFear')}`);

  out('334) Montaria: golpe forte num inimigo grande = pula nas costas e arranha');
  fresh(); yield 0.1; give('w_gar13');
  const m1 = dummy(0, -1, 'guardian', 2000);
  player.combo = 4; player.startAttack(null);
  let wt = 0;
  yield () => player.state === 'clawMount' || ++wt > 150;
  out(`  montou ${ok(player.state === 'clawMount' && ev('clawMount').length === 1, player.state)}`);
  yield 1;
  out(`  arranhando ${ok(ev('clawScratch').length >= 4, ev('clawScratch').length)} | vida caiu ${ok(m1.hp < 2000, m1.hp)} | em cima dele ${ok(player.model.position.y > 1)}`);
  out('  -> Ladino nas costas do Guardião (screenshot)');
  yield 'hold';
  yield 3;
  out(`  jogado longe ${ok(ev('clawThrown').length === 1 && player.state !== 'clawMount' && player.model.position.y === 0)}`);
  fresh(); yield 0.1; give('w_gar13');
  dummy(0, -0.5); hit(4); yield 0.1;
  out(`  inimigo pequeno: não monta ${ok(ev('clawMount').length === 0)}`);

  out('335) Revide: tomou dano = some, aparece atrás de quem bateu e executa');
  fresh(); yield 0.1; give('w_gar14');
  const v1 = dummy(2.5, -2, 'warrior', 999, true, 0);
  yield 0.3;
  combat.hitPlayer(v1, 5, { target: player });
  let rw = 0; yield () => player.state === 'clawRev' || ++rw > 40;
  out(`  sumiu ${ok(player.state === 'clawRev' && !player.model.visible && player.invulnerable, player.state)}`);
  yield 0.15;
  const rbx = v1.position.x - Math.sin(v1.facing) * 1, rbz = v1.position.z - Math.cos(v1.facing) * 1;
  out(`  atrás do inimigo ${ok(player.model.visible && Math.hypot(player.position.x - rbx, player.position.z - rbz) < 1.2, `${player.position.x.toFixed(1)},${player.position.z.toFixed(1)}`)}`);
  out('  -> atrás do inimigo (screenshot)');
  yield 'hold';
  yield 0.15;
  yield 0.1;
  out(`  executou ${ok(!v1.alive && ev('clawRevengeHit').length === 1)} | 1 s sem dano ${ok(player.iframes > 0.4, player.iframes.toFixed(2))}`);
  fresh(); yield 0.1; give('w_gar14');
  const vb = dummy(0, -3, 'guardian', 2000);
  vb.data = { ...vb.data, boss: true };
  combat.hitPlayer(vb, 5, { target: player }); yield 0.5;
  const rh = ev('clawRevengeHit')[0];
  out(`  chefe: não morre, leva o triplo ${ok(rh && vb.alive && 2000 - vb.hp >= C()[0].damage * 3 * 0.9, 2000 - vb.hp)}`);

  out('336) Cair de Pé: tomar dano não atordoa e ele já ataca');
  fresh(); yield 0.1; give('w_gar15');
  const l1 = dummy(0, 0.3);
  combat.hitPlayer(l1, 5, { target: player });
  out(`  sem atordoar ${ok(player.state !== 'hurt' && ev('clawLand').length === 1, player.state)}`);
  yield () => player.state === 'attack';
  out(`  já atacando ${ok(player.state === 'attack', player.state)}`);
  yield 1; player.iframes = 0;
  out(`  rebatido no escudo também ${ok(player.staggerBack(0, -1, 0.6, 6) === false && player.state !== 'stagger')}`);

  out('339) Morte Dolorosa: o sangramento tira vida sozinho a cada 3 s');
  fresh(); yield 0.1;
  const g0 = dummy(0, -6); bleed(g0, 2);
  yield 3.2;
  out(`  sem a bênção: nada ${ok(g0.hp === 999)}`);
  fresh(); yield 0.1; give('w_gar18');
  const g1 = dummy(0, -6); bleed(g1, 2);
  yield 2.5;
  out(`  antes de 3 s: nada ${ok(g1.hp === 999)}`);
  yield 0.7;
  out(`  aos 3 s: sangrou ${ok(g1.hp < 999 && ev('clawAgony').length === 1, 999 - g1.hp)}`);

  out('340) Contágio de Sangue: o 5º golpe passa os sangramentos para os vizinhos');
  fresh(); yield 0.1; give('w_gar19');
  const c1 = dummy(0, -0.6); bleed(c1, 3);
  const c2 = dummy(2.2, -3.0), c3 = dummy(-2.2, -3.0), c4 = dummy(9, -9);
  hit(4); yield 0.05;
  out(`  vizinhos sangrando ${ok(c2.bleedStacks >= 3 && c3.bleedStacks >= 3, `${c2.bleedStacks}/${c3.bleedStacks}`)} | longe não ${ok(!(c4.bleedStacks > 0))} | ${ok(ev('clawSpread').length === 1)}`);

  out('342) Poça de Sangue: quem pisa escorrega (animação), cai e fica 1,5 s no chão');
  fresh(); yield 0.1; give('w_gar21');
  const q1 = dummy(0, -6); bleed(q1);
  yield 0.7;
  const pud = K.puddles[0];
  out(`  poça no chão ${ok(!!pud)} | quem deixou não escorrega ${ok(ev('clawSlip').length === 0)}`);
  const q2 = dummy(4, -4);
  if (pud) q2.position.set(pud.x + 0.3, 0, pud.z);
  yield 0.1;
  out(`  outro pisou: caiu ${ok(ev('clawSlip').length === 1 && q2.state === 'axeDown' && q2.down && q2.down.slip && Math.abs(q2.down.total - CLAW.puddle.down - 0.55) < 0.01, q2.state)}`);
  yield 0.15;
  out(`  escorregando: ainda em pé, se debatendo ${ok(q2.model.rotation.x > -0.5, q2.model.rotation.x.toFixed(2))}`);
  out('  -> escorregando (screenshot)');
  yield 'hold';
  yield 0.5;
  out(`  caiu de costas ${ok(q2.model.rotation.x < -1.2, q2.model.rotation.x.toFixed(2))}`);
  out('  -> poça, esqueleto caído (screenshot)');
  yield 'hold';
  yield 1.0;
  out(`  ainda no chão aos 1,75 s ${ok(q2.state === 'axeDown')}`);
  yield 0.45;
  out(`  levantou logo (≈2 s com o escorregão) ${ok(q2.state !== 'axeDown', q2.state)}`);

  out('343) Marcas de Garra: três riscos que cortam por 3 s');
  fresh(); yield 0.1; give('w_gar22');
  hit(4); yield 0.05;
  out(`  riscos ${ok(K.marks.length === 1)}`);
  const k1 = dummy(0.3, -0.4);
  yield 0.7;
  out(`  cortou quem passou ${ok(ev('clawMarkCut').length >= 2 && k1.hp < 999, ev('clawMarkCut').length)}`);
  out('  -> riscos no chão (screenshot)');
  yield 'hold';
  yield 2.6;
  out(`  sumiram ${ok(K.marks.length === 0)}`);

  out('344) Cortes de Vento: o 5º golpe solta 3 cortes para a frente');
  fresh(); yield 0.1; give('w_gar23');
  const w1 = dummy(0, -3.6), w2 = dummy(0, -9);
  hit(4); yield 0.4;
  out(`  ${ok(ev('clawWind').length === 1)} | acertou de longe ${ok(w1.hp < 999, 999 - w1.hp)} | curto (não vai longe) ${ok(w2.hp === 999)}`);

  out('345) Tigre Fantasma: garra gigante desce no alvo a cada combo');
  fresh(); yield 0.1; give('w_gar24');
  const t1 = dummy(0, -1), t2 = dummy(1.4, -1.8);
  hit(4); yield 0.12;
  out('  -> garra descendo (screenshot)');
  yield 'hold';
  yield 0.3;
  const th = ev('clawTigerHit')[0];
  out(`  caiu ${ok(!!th && th.n >= 2, th && th.n)} | dano ${ok(t2.hp <= 999 - 18, 999 - t2.hp)} | sangrando ${ok(t2.bleedStacks >= 1)}`);

  out('346) Afiar na Parede: golpe encostado na parede = 5 golpes com sangramento');
  fresh(); yield 0.1; give('w_gar25');
  hit(0);
  out(`  longe da parede não afia ${ok(!(player.clawWhet > 0))}`);
  const bx = combat.world.bounds ? combat.world.bounds.x : 12;
  player.position.set(bx - 0.9, 0, 0); player.facing = -Math.PI / 2;
  hit(0);
  out(`  afiou ${ok(player.clawWhet === CLAW.whet.n && ev('clawWhet').length === 1)}`);
  yield 0.1;
  out(`  garras brilhando ${ok(K.whetFx.has(player))}`);
  player.position.set(0, 0, 2); player.facing = Math.PI;
  const h1 = dummy(0, 0.2);
  hit(0); hit(1);
  out(`  acerto sangrou ${ok(h1.bleedStacks === 2, h1.bleedStacks)} | sobram 3 ${ok(player.clawWhet === 3)}`);

  out('347) Rasgar Escudo: golpes no escudo rasgam e o 5º arranca');
  fresh(); yield 0.1; give('w_gar26');
  const s1 = dummy(0, -0.2, 'warrior', 999, true, 0); delete s1.shieldCovers;
  hit(0);
  out(`  bloqueou e rasgou ${ok(ev('clawShred').length === 1, ev('blocked').length)}`);
  yield 0.4; hit(4); yield 0.05;
  out(`  5º golpe: escudo sumiu ${ok(s1.shieldBroken === true && ev('clawShredBreak').length === 1)}`);

  out('348) Armadilha de Urso: a cada 15 s cai uma armadilha; quem pisa fica 5 s atordoado');
  fresh(); yield 0.1; give('w_gar27');
  const tr = dummy(6, -8);
  player.clawTrapCd = 0.3; yield 0.4;
  out(`  caiu a armadilha ${ok(K.traps.length === 1 && ev('clawTrapSet').length === 1)}`);
  out(`  próxima em 15 s ${ok(player.clawTrapCd > 14.5, player.clawTrapCd.toFixed(1))}`);
  yield 0.6;
  out(`  fica lá esperando ${ok(K.traps.length === 1 && K.traps[0].shut < 0)}`);
  tr.position.set(K.traps[0].x + 0.2, 0, K.traps[0].z); yield 0.1;
  out(`  pisou: preso e atordoado 5 s ${ok(ev('clawTrap').length === 1 && tr.state === 'hurt' && tr.stunTime >= CLAW.trap.t - 0.01, tr.state)}`);
  out('  -> armadilha fechada (screenshot)');
  yield 'hold';

  out('349) Fúria da Fera: 10 acertos sem apanhar = imune por 5 s');
  fresh(); yield 0.1; give('w_gar28');
  const e1 = dummy(0, 0.2, 'minion', 99999);
  for (let i = 0; i < 5; i++) hit(i % 5);
  combat.hitPlayer(e1, 1, { target: player }); player.iframes = 0;
  out(`  tomou dano: contagem zerou ${ok(player.clawBeastN === 0)}`);
  yield 0.6; player.setState('idle'); player.position.set(0, 0, 2); player.vel.set(0, 0, 0); player.facing = Math.PI;
  for (let i = 0; i < 10; i++) hit(i % 5);
  out(`  imune ${ok(player.clawBeastT > 0 && player.invulnerable && ev('clawBeast').length === 1)}`);
  const hp0 = player.hp; player.iframes = 0;
  combat.hitPlayer(e1, 10, { target: player });
  out(`  golpe não tira vida ${ok(player.hp === hp0)}`);
  for (let i = 0; i < 12; i++) hit(i % 5);
  out(`  durante a imunidade não conta ${ok(player.clawBeastN === 0 && ev('clawBeast').length === 1)}`);
  out('  -> imune (screenshot)');
  yield 'hold';
  yield 5.3; player.position.set(0, 0, 2); player.facing = Math.PI; e1.position.set(0, 0, 0.2);
  out(`  acabou em 5 s ${ok(!(player.clawBeastT > 0) && ev('clawBeastEnd').length === 1)} | voltou a contar ${ok((hit(0), player.clawBeastN === 1))}`);

  out('350) Sete Vidas: 1ª vez na sala que ficaria com pouca vida, esquiva sozinho');
  fresh(); yield 0.1; give('w_gar29');
  const n1 = dummy(0, 0.4);
  player.hp = 30;
  combat.hitPlayer(n1, 20, { target: player });
  out(`  escapou ${ok(player.hp === 30 && player.state === 'dodge' && ev('clawNine').length === 1, player.hp)}`);
  yield 0.8; player.iframes = 0;
  combat.hitPlayer(n1, 20, { target: player });
  out(`  2ª vez na mesma sala: apanha ${ok(player.hp < 30, player.hp)}`);

  out('351) Matilha: inimigo que morre sangrando solta um lobo fantasma');
  fresh(); yield 0.1; give('w_gar30');
  const a1 = dummy(0, -1, 'minion', 5); bleed(a1);
  const a2 = dummy(1.5, -2.2);
  combat.bleedDamage(a1, 10);
  yield 0.05;
  out(`  lobo apareceu ${ok(ev('clawPack').length === 1 && K.beasts.length === 1)}`);
  yield 1.6;
  const sw2 = ev('clawPackSwipe'), bi = ev('clawPackBite');
  out(`  combo de 3: garradas ${ok(sw2.length >= 2, sw2.length)} | mordida ${ok(bi.length >= 1)} | dano e sangramento ${ok(a2.hp < 999 && a2.bleedStacks >= 1, 999 - a2.hp)}`);
  out('  -> lobo atacando (screenshot)');
  yield 'hold';
  a2.position.set(-7, 0, -8);
  yield 1.0;
  out(`  alvo longe: pula e morde ${ok(ev('clawPackJump').length >= 1 && ev('clawPackLeap').length >= 1, ev('clawPackJump').length)}`);
  yield 3;
  out(`  sumiu em 5 s ${ok(K.beasts.length === 0)}`);

  out('352) Garras com as 30: sem erros');
  fresh({ moveDir: (v) => v.set(0, 0, -1) }); yield 0.1;
  for (const b of mine) for (let i = 0; i < b.max; i++) player.addBlessing(b);
  const all = [];
  for (let i = 0; i < 6; i++) all.push(dummy(-4 + i * 1.6, -3 - (i % 2) * 2.5, i % 3 === 1 ? 'warrior' : 'minion', 60, false));
  all.push(dummy(0, -10, 'archer', 60, false));
  for (let t = 0; t < 40; t++) {
    const a = all.find((x) => x.alive) || all[0];
    player.facing = Math.atan2(a.position.x - player.position.x, a.position.z - player.position.z);
    if (player.state === 'idle' || player.state === 'run') player.startAttack(null);
    if (t % 7 === 6) player.startDodge();
    if (t === 9) { player.input = fake({ moveDir: (v) => v.set(0, 0, -1), attack: () => true, dodge: () => true }); } else if (t === 10) player.input = fake({ moveDir: (v) => v.set(0, 0, -1) });
    if (t % 5 === 4) { player.iframes = 0; combat.hitPlayer(a, 3, { target: player }); }
    yield 0.25;
  }
  player.input = fake();
  yield 2.5;
  const errs = (window.__game.errors || []).length - errs0;
  out(`  sem erros do jogo ${ok(errs === 0, errs)}`);
  player.input = realInput;
}
