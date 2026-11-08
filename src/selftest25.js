// Teste automático, parte 25 (07/11/2026): bênçãos médias e difíceis do Cajado das Trevas (darkkit2.js).
// Roda junto com a parte 24 (tecla Y = tudo; tecla / = só o Cajado das Trevas).
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { markDark, undeadDied, hitUndead } from './undead.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* dark2Tests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const K = combat.dark2;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('mage', 'trevas'); player.reset(0, 2); player.facing = Math.PI;
    clearStrip(-12, 12, -16, 8);
    player.input = fake();
    player.iframes = 0;
    K.rand = Math.random;
    flags.events.length = 0;
  };
  const give = (id) => player.addBlessing(BLESSINGS.find((x) => x.id === id));
  const dummy = (x, z, type = 'minion', hp = 999, passive = true) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing: 0 }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; return e; };
  const raise = (x, z, hp = 30, type = 'minion') => (combat.raising || (combat.raising = [])).push({ type, x, z, t: 0, owner: player, hpScale: 1, dmgScale: 1, facing: Math.PI, hp });
  const undead = () => combat.enemies.filter((u) => u.undead && u.alive);
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const face = (e) => { player.facing = Math.atan2(e.position.x - player.position.x, e.position.z - player.position.z); player.group.rotation.y = player.facing; };
  const C = () => player.hero.combo;
  const heavy = () => C().findIndex((c) => c.heavy);
  const cast = (i = 0) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const hold = () => { for (const u of undead()) { u.cooldown = 99; u.passive = true; } }; // mortos-vivos parados (não andam até os bonecos)
  const errs0 = (window.__game.errors || []).length;

  out('223) Cajado das Trevas: bênçãos médias e difíceis');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'mage.trevas');
  const want = ['Cadáver Explosivo', 'Último Suspiro', 'Guarda-Costas', 'Elo de Almas', 'Pavor', 'Possessão', 'Coletora de Almas',
    'Herança', 'Gigante de Ossos', 'Mãos da Cova', 'Escuridão', 'Traição', 'Sombra Faminta'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  const by = (n) => mine.find((b) => b.name === n) || {};
  out(`  ${mine.length} bênçãos (26) ${ok(mine.length === 26)} | as 13 ${ok(!miss.length, miss.join(', '))} | lendárias: Possessão, Gigante, Escuridão ${ok(['Possessão', 'Gigante de Ossos', 'Escuridão'].every((n) => by(n).rarity === 'legendary'))}`);

  out('225) Cadáver Explosivo: golpe forte no morto-vivo = explosão');
  fresh(); yield 0.1; give('w_tre18');
  raise(0, -3); yield 2.5; hold();
  const cu = undead()[0];
  const c1 = dummy(cu.position.x + 1.4, cu.position.z - 0.5), c2 = dummy(cu.position.x - 1.4, cu.position.z - 0.8), c3 = dummy(cu.position.x + 7, cu.position.z);
  const fakeOrb = (step) => ({ owner: player, step, x: cu.position.x, z: cu.position.z, r: 0.35 });
  const notHeavy = K.corpseCheck(fakeOrb(C()[0]));
  const boom = K.corpseCheck(fakeOrb(C()[heavy()]));
  const ce = ev('darkCorpse')[0];
  out(`  golpe fraco não explode ${ok(!notHeavy)} | golpe forte explode ${ok(boom && !cu.alive)} | pegou os 2 perto ${ok(ce && ce.n === 2, ce && ce.n)} | o longe não ${ok(c3.hp === 999)} | dano ${ok(c1.hp === 999 - 15 && c2.hp === 999 - 15, `${999 - c1.hp}`)}`);
  // e com o orbe de verdade
  fresh(); yield 0.1; give('w_tre18');
  raise(0, -3); yield 2.5; hold();
  const cu2 = undead()[0];
  face(cu2); cast(heavy()); yield 0.6;
  out(`  orbe de verdade explode o morto-vivo ${ok(cu2 && !cu2.alive && ev('darkCorpse').length === 1)}`);

  out('226) Último Suspiro: morto-vivo cai, fantasma marca o inimigo mais perto');
  fresh(); yield 0.1; give('w_tre19');
  raise(0, -1); yield 2.5; hold();
  const gu = undead()[0], gt = dummy(4, -5), gf = dummy(-11, -13);
  gu.die(); undeadDied(combat, gu);
  out(`  saiu um fantasma ${ok(ev('darkGhost').length === 1)}`);
  yield 1.5;
  out(`  o mais perto ficou marcado ${ok(gt.darkMark === player)} | o longe não ${ok(!gf.darkMark)}`);

  out('227) Guarda-Costas: morto-vivo leva o golpe no lugar da Maga');
  fresh(); yield 0.1; give('w_tre20');
  raise(2, 0, 30); yield 2.5; hold();
  const bu = undead()[0], at = dummy(0, -1);
  player.hp = 50;
  combat.hitPlayer(at, 10, { target: player });
  const bh = bu.hp;
  out(`  Maga sem dano ${ok(player.hp === 50, player.hp)} | morto-vivo levou ${ok(bh === 20, bh)} | pulou na frente ${ok(Math.hypot(bu.position.x - player.position.x, bu.position.z - player.position.z) < 1.6)} | evento ${ok(ev('darkGuard').length === 1)}`);
  player.iframes = 0;
  combat.hitPlayer(at, 10, { target: player });
  out(`  logo depois (recarga de 2 s) a Maga leva ${ok(player.hp === 40, player.hp)}`);

  out('228) Elo de Almas: metade do dano vai para os mortos-vivos');
  fresh(); yield 0.1; give('w_tre21');
  raise(2, 0, 30); yield 2.5; hold();
  const lu = undead()[0], la = dummy(0, -1);
  player.hp = 50;
  combat.hitPlayer(la, 10, { target: player });
  out(`  Maga levou 5 ${ok(player.hp === 45, player.hp)} | morto-vivo levou 5 ${ok(lu.hp === 25, lu.hp)} | evento ${ok(ev('darkLink').length === 1)}`);
  fresh(); yield 0.1; give('w_tre21');
  player.hp = 50; combat.hitPlayer(dummy(0, -1), 10, { target: player });
  out(`  sem mortos-vivos leva tudo ${ok(player.hp === 40, player.hp)}`);

  out('229) Pavor: o 3º golpe faz o marcado fugir');
  fresh(); yield 0.1; give('w_tre22');
  const fe = dummy(0, -4, 'minion', 999, false); fe.cooldown = 99;
  face(fe); cast(heavy()); yield 0.5;
  out(`  marcado ${ok(fe.darkMark === player)} | fugindo ${ok(fe.state === 'axeFear', fe.state)} | evento ${ok(ev('darkFear').length === 1)}`);
  const fz0 = Math.hypot(fe.position.x - player.position.x, fe.position.z - player.position.z);
  yield 1.0;
  const fz1 = Math.hypot(fe.position.x - player.position.x, fe.position.z - player.position.z);
  out(`  se afastou ${ok(fz1 > fz0 + 0.5, `${fz0.toFixed(1)} → ${fz1.toFixed(1)}`)}`);
  yield 1.5;
  out(`  depois de 2 s volta a lutar ${ok(fe.state !== 'axeFear', fe.state)}`);

  out('230) Possessão: golpe forte em quem tem menos de 25% = aliado na hora');
  fresh(); yield 0.1; give('w_tre23');
  const pe = dummy(0, -4, 'minion', 100); pe.hp = 22;
  const pf = dummy(3, -4, 'minion', 100); pf.hp = 60;
  face(pe); cast(heavy()); yield 0.5;
  out(`  passou para o lado dela ${ok(pe.undead === player && pe.alive)} | com metade da vida ${ok(pe.hp >= 50, pe.hp)} | evento ${ok(ev('darkPossess').length === 1)}`);
  face(pf); cast(heavy()); yield 0.5;
  out(`  com mais de 25% não ${ok(!pf.undead)}`);
  const pb = dummy(-3, -4, 'necromancer', 1000); pb.hp = 100;
  face(pb); cast(heavy()); yield 0.5;
  out(`  chefe não ${ok(!pb.undead)}`);

  out('231) Coletora de Almas: marcados que morrem viram almas; golpe forte dispara');
  fresh(); yield 0.1; give('w_tre24');
  for (let i = 0; i < 6; i++) { const k = dummy(-5 + i * 2, -8, 'minion', 5); markDark(combat, player, k); combat.bonusDamage(k, 50, 0, -1, 'dmg', player); }
  out(`  guardou só 5 almas ${ok(player.dSoulList && player.dSoulList.length === 5, player.dSoulList && player.dSoulList.length)}`);
  yield 0.5;
  const st = dummy(0, -3);
  face(st); cast(heavy()); yield 1.2;
  out(`  disparou as 5 ${ok(ev('darkSoulHit').length === 5, ev('darkSoulHit').length)} | acabaram ${ok(player.dSoulList.length === 0)}`);

  out('232) Herança: levantam com metade da vida; escudo vira guarda');
  fresh(); yield 0.1; give('w_tre25');
  const hw = dummy(0, -3, 'warrior', 60), ha = dummy(2, -3, 'archer', 24);
  markDark(combat, player, hw); markDark(combat, player, ha);
  combat.bonusDamage(hw, 999, 0, -1, 'dmg', player); combat.bonusDamage(ha, 999, 0, -1, 'dmg', player);
  yield 1.6;
  const gw = undead().find((u) => u.type === 'warrior'), ga = undead().find((u) => u.type === 'archer');
  out(`  guerreiro com metade da vida ${ok(gw && gw.hp === Math.round(gw.maxHp / 2), gw && `${gw.hp}/${gw.maxHp}`)} | virou guarda ${ok(gw && gw.guard)} | arqueiro com metade ${ok(ga && ga.hp === Math.round(ga.maxHp / 2), ga && `${ga.hp}/${ga.maxHp}`)} | arqueiro não é guarda ${ok(ga && !ga.guard)}`);
  dummy(0, -14);
  yield 2.5;
  out(`  o guarda fica do lado da Maga ${ok(gw && Math.hypot(gw.position.x - player.position.x, gw.position.z - player.position.z) < 2.6, gw && Math.hypot(gw.position.x - player.position.x, gw.position.z - player.position.z).toFixed(1))}`);
  if (gw) {
    const h0 = gw.hp;
    gw.setState('chase');
    hitUndead(combat, gw, 10, gw.position.x + Math.sin(gw.facing) * 3, gw.position.z + Math.cos(gw.facing) * 3);
    out(`  o escudo do guarda segura o golpe da frente ${ok(gw.hp === h0 && ev('darkGuardBlock').length === 1, gw.hp)}`);
  }

  out('233) Gigante de Ossos: 3 mortos-vivos viram um gigante');
  fresh(); yield 0.1; give('w_tre26');
  raise(-1.5, -2, 10); raise(0, -3, 10); raise(1.5, -2, 10);
  yield 3.0;
  const gs = undead();
  const gg = gs[0];
  out(`  ficou 1 só ${ok(gs.length === 1, gs.length)} | gigante ${ok(gg && gg.giant)} | vida 40 + 30 ${ok(gg && gg.hp === 70, gg && gg.hp)} | maior ${ok(gg && gg.group.scale.x > 1.5)} | bate mais forte ${ok(gg && gg.dmgScale === 2.5)}`);
  raise(-2, 0, 10); raise(2, 0, 10); yield 2.5;
  out(`  com 2 novos não junta de novo ${ok(undead().length === 3 && undead().filter((u) => u.giant).length === 1, undead().length)}`);

  out('234) Mãos da Cova: quem está perto fica preso');
  fresh(); yield 0.1; give('w_tre27');
  const m1 = dummy(1, -2, 'minion', 999, false), m2 = dummy(-1.2, -2.6, 'minion', 999, false), m3 = dummy(7, -7, 'minion', 999, false);
  for (const m of [m1, m2, m3]) m.cooldown = 99;
  raise(0, -1.5, 10); yield 0.15;
  out(`  2 presos ${ok(ev('darkHands')[0] && ev('darkHands')[0].n === 2)} | parados ${ok(m1.state === 'hurt' && m2.state === 'hurt')} | o longe não ${ok(m3.state !== 'hurt')} | mãos no chão ${ok(K.hands.length >= 4, K.hands.length)}`);
  yield 1.0;
  out(`  ainda presos depois de 1 s ${ok(m1.state === 'hurt' && m2.state === 'hurt')}`);
  yield 1.0;
  out(`  soltos depois de 1,5 s ${ok(m1.state !== 'hurt' && m2.state !== 'hurt')}`);

  out('235) Escuridão: 3 mortos-vivos = sala escura e 1 de cada 3 ataques erra');
  fresh(); yield 0.1; give('w_tre28');
  dummy(0, -14); // um inimigo longe: sem ele os mortos-vivos desmoronam (sala vazia)
  raise(-2, 1, 30); raise(2, 1, 30); yield 2.5; hold();
  out(`  com 2 não escurece ${ok(!K.veilOn)}`);
  raise(0, 4, 30); yield 2.5; hold();
  const veil = document.getElementById('darkVeil');
  out(`  com 3 escurece ${ok(K.veilOn && veil && veil.style.opacity === '1')}`);
  player.hp = 60;
  const da = dummy(0, 0.8);
  for (let i = 0; i < 3; i++) { player.iframes = 0; combat.hitPlayer(da, 10, { target: player }); }
  out(`  de 3 golpes, 1 errou ${ok(player.hp === 40 && ev('darkMiss').length === 1, player.hp)}`);
  for (const u of undead()) { u.die(); undeadDied(combat, u); }
  yield 0.2;
  out(`  sem mortos-vivos clareia ${ok(!K.veilOn)}`);

  out('236) Traição: o marcado ataca um aliado dele');
  fresh(); yield 0.1; give('w_tre29');
  K.rand = () => 0; // sempre trai (no jogo: 40% a cada 2,5 s)
  const ta = dummy(0, -3), tb = dummy(1.4, -3.4);
  markDark(combat, player, ta);
  yield 0.8;
  out(`  virou traidor ${ok(ev('darkBetray').length >= 1)} | mirando o aliado ${ok(ta.target === tb)}`);
  ta.facing = Math.atan2(tb.position.x - ta.position.x, tb.position.z - ta.position.z);
  const th = tb.hp, ph = player.hp;
  combat.enemyStrike(ta);
  out(`  o golpe pegou o aliado ${ok(tb.hp < th, `${th} → ${tb.hp}`)} | não a Maga ${ok(player.hp === ph)} | quem apanhou revida ${ok(tb.grudge === ta)}`);
  K.rand = () => 0.99;
  const tc = dummy(-4, -3); markDark(combat, player, tc); yield 0.8;
  out(`  sem sorte não trai ${ok(!tc.betrayLeft)}`);
  K.rand = Math.random;

  out('237) Sombra Faminta: a sombra morde quem pisa nela');
  fresh(); yield 0.1; give('w_tre30');
  const sd = dummy(0.9, 2.2), sf = dummy(4, 2);
  yield 1.6;
  out(`  mordeu ${ok(ev('darkBite').length >= 2, ev('darkBite').length)} | tirou vida ${ok(sd.hp < 999, 999 - sd.hp)} | sem atordoar ${ok(sd.state !== 'hurt')} | o longe não ${ok(sf.hp === 999)} | sombra visível ${ok(K.shadows.size === 1)}`);

  out('238) Cajado das Trevas com as 30: sem erros');
  fresh(); yield 0.1;
  for (const b of mine) if (b.id !== 'w_tre13') for (let k = 0; k < b.max; k++) player.addBlessing(b);
  const all = [];
  for (let i = 0; i < 6; i++) all.push(dummy(-3 + i * 1.2, -3 - (i % 2), i % 3 === 1 ? 'warrior' : 'minion', 14, false));
  raise(0, 0); raise(1, 0); player.iframes = 99;
  for (let t = 0; t < 24; t++) { const a = all.find((x) => x.alive && !x.undead) || all[0]; face(a); cast(t % 3); if (t % 6 === 5) player.startDodge(); yield 0.3; }
  player.iframes = 0;
  for (let i = 0; i < 4; i++) { const e = combat.enemies.find((x) => !x.undead && x.alive); if (e) combat.hitPlayer(e, 5, { target: player }); player.iframes = 0; yield 0.2; }
  yield 2;
  const errs = (window.__game.errors || []).length - errs0;
  out(`  sem erros do jogo ${ok(errs === 0, errs)}`);
  K.rand = Math.random;
  player.input = realInput;
}
