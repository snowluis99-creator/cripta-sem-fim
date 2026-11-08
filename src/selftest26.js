// Teste automático, parte 26 (07/11/2026): bênçãos novas do Cajado de Gelo (icekit.js / iceprops.js).
// Tecla ' (aspas simples) = só o Cajado de Gelo; também roda no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { iceSpeedMul, ICE } from './icekit.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* iceTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const K = combat.ice2;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('mage', 'gelo'); player.reset(0, 2); player.facing = Math.PI;
    clearStrip(-13, 13, -16, 8);
    player.input = fake();
    player.iframes = 0;
    flags.events.length = 0;
  };
  const give = (id) => player.addBlessing(BLESSINGS.find((x) => x.id === id));
  const dummy = (x, z, type = 'minion', hp = 999, passive = true) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing: 0 }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const face = (e) => { player.facing = Math.atan2(e.position.x - player.position.x, e.position.z - player.position.z); player.group.rotation.y = player.facing; };
  const C = () => player.hero.combo;
  const heavy = () => C().findIndex((c) => c.heavy);
  const cast = (i = 0) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const frz = (e, t = 4.4) => { e.lastHitBy = player; e.freeze(t, combat); };
  const smash = (e) => combat.damageEnemy(player, e, C()[0], 0, -1, { spell: true }); // um orbe acertando direto
  const iceRects = () => combat.world.rects.filter((r) => r.ice).length;
  const hostile = (from, toX, toZ) => combat.projectiles.fire(from.position.x, from.position.z, Math.atan2(toX - from.position.x, toZ - from.position.z), { speed: 14, damage: 7, kind: 'arrow', hits: 'player', owner: from, height: 1.3 });
  const errs0 = (window.__game.errors || []).length;

  out('239) Cajado de Gelo: as 20 bênçãos novas');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'mage.gelo');
  const want = ['Curling', 'Estátua', 'Espelho de Gelo', 'Grudento', 'Floco Gigante', 'Quebra Fatal', 'Pista de Gelo', 'Parede de Gelo', 'Estalagmites', 'Granizo',
    'Iglu', 'Pele Gélida', 'Neblina', 'Cristais', 'Patins', 'Contágio Gélido', 'Encharcado', 'Avalanche Lenta', 'Boneco de Neve', 'Tempo Congelado'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  const by = (n) => mine.find((b) => b.name === n) || {};
  out(`  ${mine.length} bênçãos (6 + 20) ${ok(mine.length === 26)} | as 20 ${ok(!miss.length, miss.join(', '))} | lendárias: Floco, Iglu, Tempo, Neblina, Granizo ${ok(['Floco Gigante', 'Iglu', 'Tempo Congelado', 'Neblina', 'Granizo'].every((n) => by(n).rarity === 'legendary'))} | Estátua x Boneco ${ok((by('Estátua').excludes || []).includes(by('Boneco de Neve').id))}`);

  out('240) Curling: congelado desliza e derruba quem está no caminho');
  fresh(); yield 0.1; give('w_gel11');
  const ca = dummy(0, -3), cb = dummy(0.2, -7), cc = dummy(6, -3);
  frz(ca); const cz0 = ca.position.z;
  smash(ca); yield 0.9;
  const ch = ev('iceCurlHit')[0];
  out(`  deslizou ${ok(ca.position.z < cz0 - 2.5, (cz0 - ca.position.z).toFixed(1))} | derrubou o do caminho ${ok(ch && ch.enemy === cb && cb.hp < 999, cb && 999 - cb.hp)} | o de longe não ${ok(cc.hp === 999)}`);

  out('241) Estátua: quem morre deixa um clone de gelo; quem encosta congela e o clone quebra');
  fresh(); yield 0.1; give('w_gel12');
  const sa = dummy(0, -4, 'minion', 3), sw = dummy(5, -4);
  const r0 = iceRects();
  smash(sa); yield 0.2;
  out(`  morreu (sem congelar): clone ${ok(ev('iceStatue').length === 1 && !sa.alive && K.props.statues.length === 1)} | não é obstáculo ${ok(iceRects() === r0)}`);
  out('  -> clone de gelo (screenshot)');
  yield 'hold';
  sw.position.set(0.6, 0, -4); yield 0.15;
  out(`  encostou: congelou ${ok(sw.frozenT > 0 && ev('iceStatueTrap').length === 1)} | clone quebrou ${ok(K.props.statues.length === 0)}`);
  const sb2 = dummy(-5, -6, 'minion', 3);
  smash(sb2); yield 0.1;
  yield ICE.statue.life + 0.2;
  out(`  sem ninguém encostar, some depois de 10 s ${ok(K.props.statues.length === 0)}`);

  out('242) Espelho de Gelo: congelado rebate flechas');
  fresh(); yield 0.1; give('w_gel13');
  const ma = dummy(0, -3), ms = dummy(0, -9);
  frz(ma); const mh = player.hp;
  hostile(ms, 0, 2); yield 1.4;
  out(`  rebateu ${ok(ev('iceMirror').length === 1)} | a Maga escondida não apanhou ${ok(player.hp === mh)} | voltou em quem atirou ${ok(ms.hp < 999, 999 - ms.hp)}`);

  out('243) Grudento: quem encosta num congelado gruda 5 s');
  fresh(); yield 0.1; give('w_gel14');
  const ga = dummy(0, -3), gb = dummy(1.1, -3), gfar = dummy(6, -3);
  frz(ga); yield 0.1;
  const gp = gb.rootPos ? { ...gb.rootPos } : null;
  gb.vel.set(8, 0, 0); yield 0.3;
  out(`  grudou ${ok(ev('iceSticky').length === 1 && gb.rootT > 0)} | não sai do lugar ${ok(gp && Math.hypot(gb.position.x - gp.x, gb.position.z - gp.z) < 0.05)} | o de longe não ${ok(!(gfar.rootT > 0))}`);
  out(`  preso por 5 s ${ok(gb.rootT > 4.4, gb.rootT.toFixed(2))}`);

  out('244) Floco Gigante: estilhaçar solta 6 lascas');
  fresh(); yield 0.1; give('w_gel15');
  const fc = dummy(0, -5), ring = [];
  for (let i = 0; i < 6; i++) ring.push(dummy(Math.sin(i * Math.PI / 3) * 1.7, -5 + Math.cos(i * Math.PI / 3) * 1.7));
  frz(fc); smash(fc);
  const shards = combat.projectiles.list.filter((a) => a.hits === 'hero' && a.kind === 'shard').length;
  yield 0.6;
  const hitN = ring.filter((e) => e.hp < 999).length;
  out(`  6 lascas ${ok(shards === 6, shards)} | acertaram ${ok(hitN >= 3, `${hitN} de 6`)}`);

  out('245) Quebra Fatal: menos de 20% de vida + congelou = quebra');
  fresh(); yield 0.1; give('w_gel16');
  const qa = dummy(0, -4, 'minion', 100), qb = dummy(3, -4, 'minion', 100);
  qa.hp = 15; qb.hp = 50;
  frz(qa); frz(qb); yield 0.1;
  out(`  quebrou ${ok(!qa.alive && ev('iceFatal').length === 1)} | com 50% só congela ${ok(qb.alive && qb.frozenT > 0)}`);

  out('246) Pista de Gelo: o 3º golpe congela o chão; quem entra escorrega');
  fresh(); yield 0.1; give('w_gel17');
  const pt = dummy(0, -4);
  face(pt); cast(heavy()); yield 0.6;
  const pin = dummy(-0.5, -2.3), pout = dummy(7, -2.3);
  out(`  pista no chão ${ok(K.props.rinks.length === 1 && ev('iceRink').length === 1)}`);
  yield 0.05;
  const px0 = pin.position.x, po0 = pout.position.x;
  pin.vel.set(6, 0, 0); pout.vel.set(6, 0, 0);
  yield 1.0;
  const dIn = pin.position.x - px0, dOut = pout.position.x - po0;
  out(`  escorregou ${ok(ev('iceSlip').length >= 1 && dIn > dOut * 1.5, `${dIn.toFixed(1)} x ${dOut.toFixed(1)}`)}`);

  out('247) Parede de Gelo: golpe forte levanta parede que segura flechas');
  fresh(); yield 0.1; give('w_gel18');
  const wr0 = iceRects();
  cast(heavy()); yield 0.4;
  const wl = K.props.walls[0];
  out(`  parede ${ok(wl && ev('iceWall').length === 1 && iceRects() === wr0 + ICE.wall.blocks)} | bloqueia ${ok(wl && combat.world.blocked(wl.x, wl.z, 0.3))}`);
  const wsh = dummy(0, -3.2), wh = player.hp;
  hostile(wsh, 0, 2); yield 1.2;
  out(`  segurou a flecha ${ok(player.hp === wh)}`);
  face(wsh); cast(0); yield 0.8;
  out(`  orbe da Maga passa ${ok(wsh.hp < 999, 999 - wsh.hp)}`);
  yield ICE.wall.time;
  out(`  derreteu depois de 4 s ${ok(K.props.walls.length === 0 && iceRects() === wr0)}`);

  out('248) Estalagmites: estilhaçar faz estacas brotarem em volta');
  fresh(); yield 0.1; give('w_gel19');
  const ea = dummy(0, -4), eb = dummy(1.6, -4), ef = dummy(7, -4);
  frz(ea); smash(ea); yield 0.5;
  out(`  estacas ${ok(ev('iceSpikes').length === 1)} | acertou o vizinho ${ok(eb.hp < 999 && eb.slow > 0, 999 - eb.hp)} | o longe não ${ok(ef.hp === 999)}`);

  out('249) Granizo: combo completo faz chover gelo em volta da Maga');
  fresh(); yield 0.1; give('w_gel20');
  const ha = dummy(1.8, 0.5), hb = dummy(-1.8, 1), hfar = dummy(0, -12);
  face(ha); cast(heavy()); yield 3.3;
  const hh = ev('iceHailHit').length;
  out(`  granizo ${ok(ev('iceHail').length === 1)} | pedras acertaram ${ok(hh >= 3, hh)} | perto apanhou ${ok(hb.hp < 999)} | longe não ${ok(hfar.hp === 999)} | parou ${ok(K.props.hail.length === 0)}`);

  out('250) Iglu: vida baixa = bloco de gelo, imune e curando (1 vez por sala)');
  fresh(); yield 0.1; give('w_gel21');
  const ia = dummy(0, -1.5);
  player.hp = Math.round(player.maxHp * 0.35);
  combat.hitPlayer(ia, 20, { target: player });
  const ih = player.hp;
  out(`  fechou o iglu ${ok(ev('iceIgloo').length === 1 && player.frozen && player.iframes > 1.5)}`);
  combat.hitPlayer(ia, 20, { target: player });
  out(`  imune dentro ${ok(player.hp >= ih)}`);
  yield 2.3;
  out(`  curou ${ok(player.hp >= ih + 15, `${ih} → ${player.hp}`)} | saiu ${ok(!player.frozen && !player.iglooMesh)}`);
  player.iframes = 0; player.hp = Math.round(player.maxHp * 0.35);
  combat.hitPlayer(ia, 20, { target: player });
  out(`  só 1 vez por sala ${ok(ev('iceIgloo').length === 1)}`);
  fresh(); yield 0.1; give('w_gel21');
  player.hp = 5; combat.hitPlayer(dummy(0, -1.5), 60, { target: player });
  out(`  golpe que mataria: fica com vida ${ok(player.hp >= 1 && player.state !== 'dead', player.hp)}`);
  yield 2.3;

  out('251) Pele Gélida: quem causa dano na Maga congela');
  fresh(); yield 0.1; give('w_gel22');
  const sk = dummy(0, -1.5);
  combat.hitPlayer(sk, 5, { target: player });
  out(`  congelou quem bateu ${ok(sk.frozenT > 2 && ev('iceSkin').length === 1, (sk.frozenT || 0).toFixed(2))}`);

  out('252) Neblina: só quem está dentro perde a Maga de vista');
  fresh(); yield 0.1; give('w_gel23');
  player.iframes = 99;
  const na = dummy(1, 0.5, 'minion', 999, false), nb = dummy(-1.5, 2.5, 'warrior', 999, false), nf = dummy(0, -9, 'minion', 999, false);
  yield 0.1;
  na.position.set(1, 0, 0.5); nb.position.set(-1.5, 0, 2.5);
  player.startDodge(); yield 0.1;
  out(`  neblina ${ok(ev('iceFog').length === 1)} | os de dentro perderam de vista ${ok(na.passive && nb.passive)} | o de fora não ${ok(!nf.passive)}`);
  out('  -> neblina azul-acinzentada (screenshot)');
  yield 'hold';
  K.fog(player);
  out(`  espera 3 s para outra ${ok(ev('iceFog').length === 1)}`);
  na.position.set(8, 0, 6); na.passive = na.passive; yield 0.6;
  out(`  saiu da neblina: volta a ver ${ok(!na.passive)}`);
  nb.position.set(-1.5, 0, 2.5); yield 0.3;
  out(`  quem continua dentro segue perdido ${ok(nb.passive)}`);
  yield ICE.fog.time;
  out(`  a neblina sumiu: todos voltam a ver ${ok(!na.passive && !nb.passive && K.props.fogs.length === 0)}`);
  player.iframes = 0;

  out('253) Cristais: quebrar um congelado deixa um cristal que cura 4');
  fresh(); yield 0.1; give('w_gel24');
  const ka = dummy(0, -4);
  frz(ka); smash(ka); yield 0.1;
  const kc = K.props.crystals[0];
  out(`  cristal no chão ${ok(!!kc && ev('iceCrystal').length === 1)}`);
  player.hp = player.maxHp - 20; const kh = player.hp;
  if (kc) { player.position.x = kc.x; player.position.z = kc.z; }
  yield 0.2;
  out(`  pegou e curou 4 ${ok(player.hp === kh + ICE.crystal.heal, `${kh} → ${player.hp}`)} | sumiu ${ok(K.props.crystals.length === 0)}`);

  out('254) Patins: rastro de gelo ao rolar; no gelo, mais rápida e deslizando');
  fresh(); yield 0.1; give('w_gel25');
  player.startDodge(); yield 0.6;
  out(`  rolar deixa gelo ${ok(combat.ice.length > 0)}`);
  combat.ice.length = 0;
  out(`  fora do gelo: normal ${ok(iceSpeedMul(player) === 1)}`);
  K.props.rink(0, 0, { r: 6, life: 5 });
  out(`  no gelo: +40% ${ok(Math.abs(iceSpeedMul(player) - 1.4) < 1e-6)}`);
  player.input = fake({ moveDir: (v) => v.set(1, 0, 0) }); yield 0.4;
  player.input = fake(); yield 0.02;
  const sx0 = player.position.x; yield 0.4;
  out(`  parou de andar e continuou deslizando ${ok(player.position.x - sx0 > 0.5 && ev('iceSkate').length >= 1, (player.position.x - sx0).toFixed(2))}`);

  out('255) Contágio Gélido: perto de um congelado toma dano do frio');
  fresh(); yield 0.1; give('w_gel26');
  const ta = dummy(0, -4), tb = dummy(1.8, -4), tfar = dummy(7, -4);
  frz(ta); yield 1.05;
  out(`  vizinho tomou dano ${ok(tb.hp < 999 && ev('iceChill').length >= 2, 999 - tb.hp)} | não fica atordoado ${ok(tb.state !== 'hurt', tb.state)} | longe não ${ok(tfar.hp === 999)}`);

  out('256) Encharcado: descongelou = molhado, congela de novo com 1 orbe');
  fresh(); yield 0.1; give('w_gel27');
  const wa = dummy(0, -4);
  frz(wa, 0.3); yield 0.5;
  out(`  ficou molhado ${ok(wa.wetT > 0 && !(wa.frozenT > 0))}`);
  face(wa); cast(0); yield 0.5;
  out(`  1 orbe congelou ${ok(wa.frozenT > 0 && ev('iceWetFreeze').length === 1)}`);
  yield ICE.wet.freeze + 0.2;
  out(`  depois não fica molhado de novo ${ok(!(wa.frozenT > 0) && !(wa.wetT > 0))}`);

  out('257) Avalanche Lenta: lento 3 vezes seguidas congela sozinho');
  fresh(); yield 0.1; give('w_gel28');
  const va = dummy(0, -1.5);
  face(va); cast(0); yield 0.6;
  const after1 = va.frozenT > 0;
  cast(0); yield 0.6; cast(0); yield 0.5;
  out(`  1 orbe não congela ${ok(!after1)} | 3 seguidos congelam ${ok(va.frozenT > 0 && ev('iceAval').length === 1)}`);

  out('258) Boneco de Neve: morreu congelado vira aliado que joga bolas de neve');
  fresh(); yield 0.1; give('w_gel29');
  const ba = dummy(0, -3, 'minion', 3), bt = dummy(4, -8);
  frz(ba); smash(ba); yield 0.1;
  out(`  virou boneco ${ok(ev('iceSnowman').length === 1 && K.props.snowmen.length === 1)}`);
  yield 2.5;
  out(`  jogou bolas de neve ${ok(ev('iceSnowball').length >= 1 && bt.hp < 999 && bt.slow > 0, 999 - bt.hp)}`);
  yield ICE.snowman.time - 2.4;
  out(`  derrete em 8 s ${ok(K.props.snowmen.length === 0)}`);

  out('259) Tempo Congelado: 3 congelados ao mesmo tempo param a sala');
  fresh(); yield 0.1; give('w_gel30');
  player.iframes = 99;
  const z1 = dummy(-3, -4), z2 = dummy(0, -4), z3 = dummy(3, -4), zw = dummy(0, -9, 'minion', 999, false), zs = dummy(6, -9);
  yield 0.3;
  const shot = hostile(zs, 0, 2);
  frz(z1); frz(z2);
  out(`  com 2 não para ${ok(!(K.stopT > 0))}`);
  frz(z3);
  const wp = { x: zw.position.x, z: zw.position.z }, sp0 = { x: shot.x, z: shot.z }, f3 = z3.frozenT;
  out(`  com 3 para ${ok(K.stopT > 0 && ev('iceTimeStop').length === 1 && K.veilOn)} | congelados ficam mais ${ok(f3 > 4.4 + 1)}`);
  yield 1.0;
  out(`  inimigo parado ${ok(Math.hypot(zw.position.x - wp.x, zw.position.z - wp.z) < 0.05)} | flecha parada no ar ${ok(Math.hypot(shot.x - sp0.x, shot.z - sp0.z) < 0.05)}`);
  out(`  ainda parado em 1,7 s (dura 3 s) ${ok(K.stopT > 0)}`);
  yield 2.2;
  out(`  volta ao normal ${ok(!(K.stopT > 0) && !K.veilOn)}`);
  player.iframes = 0;

  out('260) Cajado de Gelo com as 30: sem erros');
  fresh(); yield 0.1;
  for (const b of mine) if (b.id !== 'w_gel29') for (let k = 0; k < b.max; k++) player.addBlessing(b);
  const all = [];
  for (let i = 0; i < 6; i++) all.push(dummy(-3 + i * 1.2, -3 - (i % 2) * 1.5, i % 3 === 1 ? 'warrior' : 'minion', 14, false));
  all.push(dummy(0, -10, 'archer', 14, false));
  player.iframes = 99;
  for (let t = 0; t < 24; t++) { const a = all.find((x) => x.alive) || all[0]; face(a); cast(t % 3); if (t % 6 === 5) player.startDodge(); yield 0.3; }
  player.iframes = 0;
  for (let i = 0; i < 4; i++) { const e = combat.enemies.find((x) => x.alive); if (e) combat.hitPlayer(e, 5, { target: player }); player.iframes = 0; yield 0.2; }
  yield 2;
  const errs = (window.__game.errors || []).length - errs0;
  out(`  sem erros do jogo ${ok(errs === 0, errs)}`);
  player.input = realInput;
}
