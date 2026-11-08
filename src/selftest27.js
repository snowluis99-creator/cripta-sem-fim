// Teste automático, parte 27 (07/11/2026): bênçãos novas do Cajado de Fogo (firekit.js / fireprops.js / firestates.js).
// Tecla ~ (til, ao lado do Ç) = só o Cajado de Fogo; também roda no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { FIRE } from './firekit.js';

const ok = (c, extra = '') => (c ? `✔${extra !== '' ? ` ${extra}` : ''}` : `ERRO${extra !== '' ? ` (${extra})` : ''}`);

export function* fireTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const K = combat.fire2;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('mage', 'fogo'); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    clearStrip(-13, 13, -16, 8);
    combat.props.list = combat.props.list.filter((b) => Math.abs(b.x) > 13 || b.z < -16 || b.z > 8);
    player.input = fake();
    player.iframes = 0;
    flags.events.length = 0;
  };
  const give = (id) => player.addBlessing(BLESSINGS.find((x) => x.id === id));
  const dummy = (x, z, type = 'minion', hp = 999, passive = true) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing: 0 }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const C = () => player.hero.combo;
  const cast = (i = 0) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const burn = (e, t = 3) => K.ignite(e, player, 2, t);
  const barrel = (x, z, name = 'barrel_small') => { const b = { name, obj: { visible: true }, x, z, r: 0.45, colIdx: -1, rect: null, chest: false, h: 1, broken: false, riders: [] }; combat.props.list.push(b); return b; };
  const errs0 = (window.__game.errors || []).length;

  out('261) Cajado de Fogo: as 20 bênçãos novas');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'mage.fogo');
  const want = ['Pânico', 'Fogo Azul', 'Faísca Saltitante', 'Derreter', 'Reação em Cadeia', 'Tochas Vivas', 'Vulcão', 'Fumaça', 'Fogos de Artifício',
    'Rastro de Chamas', 'Liberação Ardente', 'Filha do Fogo', 'Anel de Chamas', 'Chama Interior', 'Sopro do Dragão', 'Salamandra', 'Cinzas'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  const by = (n) => mine.find((b) => b.name === n) || {};
  out(`  ${mine.length} bênçãos (22) ${ok(mine.length === 22)} | as 17 ${ok(!miss.length, miss.join(', '))} | lendárias: Reação, Cinzas ${ok(['Reação em Cadeia', 'Cinzas'].every((n) => by(n).rarity === 'legendary'))} | raras: 6 ${ok(want.filter((n) => by(n).rarity === 'rare').length === 6)} | sem Pavio Curto ${ok(!mine.some((b) => b.name === 'Pavio Curto'))}`);

  out('262) Pânico: quem pega fogo corre sem rumo e põe fogo em quem encosta');
  fresh(); yield 0.1; give('w_fog11');
  const pa = dummy(0, 0.4), pb = dummy(7, -6);
  const p0 = { x: pa.position.x, z: pa.position.z };
  cast(0); yield 0.6;
  out(`  em pânico ${ok(pa.state === 'firePanic' && ev('firePanic').length === 1)} | correu ${ok(Math.hypot(pa.position.x - p0.x, pa.position.z - p0.z) > 1, Math.hypot(pa.position.x - p0.x, pa.position.z - p0.z).toFixed(1))}`);
  out('  -> esqueleto em pânico (screenshot)');
  yield 'hold';
  pb.position.set(pa.position.x + 0.7, 0, pa.position.z); yield 0.1;
  out(`  encostou: o outro pegou fogo ${ok(pb.burn > 0 && ev('firePanicTouch').length >= 1)}`);
  yield 4.5;
  out(`  o fogo acabou: volta ao normal ${ok(pa.state !== 'firePanic')}`);

  out('263) Fogo Azul: 3 vezes seguidas = fogo azul, mais forte, que pula');
  fresh(); yield 0.1; give('w_fog12');
  const ba = dummy(0, 0.4), bb = dummy(2.2, 0.4);
  cast(0); yield 0.4; cast(0); yield 0.4;
  out(`  com 2 ainda não ${ok(!ba.blueFire)}`);
  cast(0); yield 0.05;
  out(`  com 3: azul ${ok(ba.blueFire && ev('fireBlue').length === 1)} | dano dobrado ${ok(ba.burnDps >= 2.9, ba.burnDps.toFixed(1))}`);
  out('  -> fogo azul (screenshot)');
  yield 'hold';
  yield 1.0;
  out(`  pulou para o vizinho ${ok(bb.blueFire && bb.burn > 0 && ev('fireBlueJump').length >= 1)}`);

  out('264) Faísca Saltitante: a queimadura acaba e pula para o mais perto');
  fresh(); yield 0.1; give('w_fog13');
  const sa = dummy(0, 0.4), sb = dummy(4, -3), sc = dummy(-9, -9);
  cast(0); yield 3.3 + FIRE.spark.range / FIRE.spark.speed;
  out(`  faísca ${ok(ev('fireSpark').length >= 1)} | o mais perto pegou fogo ${ok(sb.burn > 0 && ev('fireSparkHit').length >= 1)} | o longe não ${ok(!(sc.burn > 0))}`);

  out('265) Derreter: escudo derrete depois de 3 s queimando');
  fresh(); yield 0.1; give('w_fog14');
  const wa = dummy(0, 0.4, 'warrior');
  cast(0); yield 1.5; cast(0); yield 1.8;
  out(`  derreteu ${ok(wa.shieldBroken && ev('fireMelt').length === 1)}`);
  fresh(); yield 0.1;
  const wb = dummy(0, 0.4, 'warrior');
  cast(0); yield 1.5; cast(0); yield 1.8;
  out(`  sem a bênção não ${ok(!wb.shieldBroken)}`);

  out('266) Reação em Cadeia: quem já queimava explode junto');
  fresh(); yield 0.1; give('w_fog15');
  const ra = dummy(0, -1), rb = dummy(2, 2), rc = dummy(-2, 2.5), ro = dummy(0, -3.1);
  burn(ra); burn(rb); yield 0.1;
  cast(2); yield 0.5;
  const rch = ev('fireChain')[0];
  out(`  2 explodiram ${ok(rch && rch.n === 2 && ev('fireChainBoom').length === 2, rch && rch.n)} | o de fora (perto de um que explodiu) levou ${ok(ro.hp < 999 && ro.burn > 0, 999 - ro.hp)} | o que não queimava não explodiu ${ok(!ev('fireChainBoom').some((x) => x.enemy === rc))}`);

  out('268) Tochas Vivas: a tocha atira bola de fogo em quem passa perto');
  fresh(); yield 0.1;
  out(`  tochas acesas na sala: ${K.torches.length} ${ok(K.torches.length >= 1)}`);
  give('w_fog17');
  K.torches = [{ x: 0, y: 2.2, z: -6, cd: 0 }];
  const ta = dummy(1, -3.5);
  yield 1.2;
  out(`  atirou ${ok(ev('fireTorch').length >= 1)} | acertou e pôs fogo ${ok(ev('fireTorchHit').length >= 1 && ta.hp < 999 && ta.burn > 0, 999 - ta.hp)}`);

  out('269) Vulcão: o golpe forte racha o chão e jorra lava 3 vezes');
  fresh(); yield 0.1; give('w_fog18');
  const va = dummy(2.5, -3);
  cast(2); yield 0.5;
  out('  -> lava saindo da rachadura (screenshot)');
  yield 'hold';
  yield 1.3;
  out(`  3 jorros ${ok(ev('fireVolcanoErupt').length === 3)} | embaixo do inimigo mais perto ${ok(ev('fireVolcano')[0] && ev('fireVolcano')[0].target === va)} | dano ${ok(va.hp < 999 - 10, 999 - va.hp)}`);

  out('270) Fumaça: quem está na fumaça erra metade dos ataques');
  fresh(); yield 0.1; give('w_fog19');
  const ma = dummy(0, 0.5), mf = dummy(0, -7);
  cast(2); yield 0.1;
  out(`  a explosão soltou fumaça ${ok(K.props.clouds.length >= 1)}`);
  const h0 = player.hp; K.forceMiss = true;
  player.iframes = 0; combat.hitPlayer(ma, 5, { target: player });
  out(`  dentro da fumaça errou ${ok(player.hp === h0 && ev('fireSmokeMiss').length === 1)}`);
  player.iframes = 0; combat.hitPlayer(mf, 5, { target: player });
  out(`  fora da fumaça acerta ${ok(player.hp < h0)}`);
  K.forceMiss = false;
  let missN = 0;
  for (let i = 0; i < 40; i++) { player.hp = player.maxHp; player.iframes = 0; const hb = player.hp; combat.hitPlayer(ma, 1, { target: player }); if (player.hp === hb) missN++; }
  out(`  mais ou menos metade erra ${ok(missN >= 10 && missN <= 30, `${missN} de 40`)}`);
  player.hp = player.maxHp;
  out('  -> fumaça (screenshot)');
  yield 'hold';

  out('271) Fogos de Artifício: 5 fogos caem pela sala');
  fresh(); yield 0.1; give('w_fog20');
  cast(2); yield 0.05;
  out(`  5 fogos subindo ${ok(K.props.balls.filter((b) => b.to).length === FIRE.works.n)}`);
  yield 0.5;
  out('  -> fogos no ar (screenshot)');
  yield 'hold';
  yield 2.0;
  out(`  5 estouros ${ok(ev('fireWorksBoom').length === FIRE.works.n)}`);

  out('272) Rastro de Chamas: rolar deixa fogo no chão por 2 s');
  fresh(); yield 0.1; give('w_fog21');
  player.startDodge(); yield 0.6;
  const pn = K.props.patches.length;
  out(`  trilha ${ok(pn >= 3, pn)}`);
  const tr = dummy(0, 0.5);
  yield 0.8;
  out(`  quem pisa queima ${ok(tr.burn > 0 && ev('fireTrailHit').length >= 1)}`);
  yield 1.6;
  out(`  some em 2 s ${ok(K.props.patches.length === 0)}`);

  out('274) Liberação Ardente: a linha de fogo do 2º golpe vai até a parede e atravessa');
  fresh(); yield 0.1;
  const la = dummy(0, -1), lb = dummy(0, -8);
  cast(1); yield 0.1;
  out(`  sem a bênção: só perto ${ok(la.hp < 999 && lb.hp === 999)}`);
  fresh(); yield 0.1; give('w_fog23');
  const lc = dummy(0, -1), ld = dummy(0, -8);
  cast(1); yield 0.1;
  const rl = ev('fireRelease')[0];
  out(`  com a bênção: os dois ${ok(lc.hp < 999 && ld.hp < 999)} | até a parede ${ok(rl && rl.len > 8, rl && rl.len.toFixed(1))}`);
  out('  -> linha até a parede (screenshot)');
  yield 'hold';

  out('275) Filha do Fogo: pisar no fogo cura');
  fresh(); yield 0.1; give('w_fog24');
  const hHalf = Math.round(player.maxHp / 2);
  player.hp = hHalf;
  K.props.patch(player.position.x, player.position.z, 1, 3, 'trail', player, null);
  yield 1.1;
  out(`  curou ${ok(player.hp > hHalf && ev('fireChildHeal').length >= 2, player.hp - hHalf)}`);
  fresh(); yield 0.1;
  player.hp = hHalf;
  K.props.patch(player.position.x, player.position.z, 1, 3, 'trail', player, null);
  yield 1.1;
  out(`  sem a bênção não cura (e não machuca) ${ok(player.hp === hHalf)}`);
  player.hp = player.maxHp;

  out('276) Anel de Chamas: bolas de fogo girando por 3 s');
  fresh(); yield 0.1; give('w_fog25');
  cast(2); yield 0.1;
  out(`  anel ${ok(K.props.rings.length === 1 && K.props.rings[0].balls.length === FIRE.ring.n)}`);
  const ra2 = dummy(1.9, 2);
  yield 1.0;
  out(`  queima quem encosta ${ok(ev('fireRingHit').some((x) => x.enemy === ra2) && ra2.burn > 0)}`);
  out('  -> anel de chamas (screenshot)');
  yield 'hold';
  yield 2.2;
  out(`  some em 3 s ${ok(K.props.rings.length === 0)}`);

  out('278) Chama Interior: com pouca vida, a explosão fica maior');
  fresh(); yield 0.1; give('w_fog27');
  const full = K.novaBoost(player, 3.2).r;
  player.hp = Math.round(player.maxHp * 0.1);
  const low = K.novaBoost(player, 3.2).r;
  out(`  vida cheia ×${full.toFixed(2)} ${ok(full === 1)} | 10% de vida ×${low.toFixed(2)} ${ok(low > 1.7)}`);
  const ia = dummy(0, -2.6);
  cast(2); yield 0.1;
  out(`  acertou longe (fora do raio normal) ${ok(ia.hp < 999)}`);
  player.hp = player.maxHp;

  out('279) Sopro do Dragão: o 1º golpe alcança o dobro');
  fresh(); yield 0.1;
  const da = dummy(0, -1.9);
  cast(0); yield 0.1;
  out(`  sem a bênção: longe demais ${ok(da.hp === 999)}`);
  fresh(); yield 0.1; give('w_fog28');
  const db = dummy(0, -1.9);
  cast(0); yield 0.1;
  out(`  com a bênção: acertou ${ok(db.hp < 999)}`);
  let first = true;
  player.input = fake({ attack: () => { const f = first; first = false; return f; }, attackHeld: () => true });
  yield 0.8;
  out(`  segurar não vira mais lança-chamas ${ok(player.state !== 'fireBreath')}`);
  out('  -> sopro longo (screenshot)');
  yield 'hold';

  out('280) Salamandra: segue a Maga e cospe fogo em quem já queima');
  fresh(); yield 0.1; give('w_fog29');
  yield 0.2;
  out(`  salamandra ${ok(K.props.salas.length === 1)}`);
  const sl = dummy(3, -2), sn = dummy(-3, -2);
  yield 1.5;
  out(`  sem ninguém queimando não cospe ${ok(!ev('fireSala').length)}`);
  burn(sl, 6); yield 1.5;
  out(`  cuspiu em quem queima ${ok(ev('fireSalaHit').some((x) => x.enemy === sl) && sl.hp < 999)} | no outro não ${ok(sn.hp === 999)}`);
  out('  -> salamandra (screenshot)');
  yield 'hold';
  player.position.set(-4, 0, 3); yield 1.2;
  const sd = Math.hypot(K.props.salas[0].g.position.x - player.position.x, K.props.salas[0].g.position.z - player.position.z);
  out(`  vai atrás da Maga ${ok(sd < 2.5, sd.toFixed(1))}`);

  out('281) Cinzas: quem morre queimando vira brasa; 10 = explosão gigante');
  fresh(); yield 0.1; give('w_fog30');
  player.fireAsh = 8;
  const ca1 = dummy(3, -4, 'minion', 1), ca2 = dummy(-3, -4, 'minion', 1);
  burn(ca1); burn(ca2); yield 0.7;
  out(`  2 morreram queimando: 10 brasas ${ok(!ca1.alive && !ca2.alive && player.fireAsh === 10 && ev('fireAsh').length === 2, player.fireAsh)}`);
  const cfar = dummy(0, -3.8);
  cast(2); yield 0.1;
  out(`  explosão gigante ${ok(ev('fireAshBlast').length === 1 && player.fireAsh === 0)} | acertou longe ${ok(cfar.hp < 999, 999 - cfar.hp)}`);

  out('282) Cajado de Fogo com as 30: sem erros');
  fresh(); yield 0.1;
  for (const b of mine) for (let k = 0; k < b.max; k++) player.addBlessing(b);
  barrel(3, -2); barrel(-3, -3);
  const all = [];
  for (let i = 0; i < 6; i++) all.push(dummy(-3 + i * 1.2, -1 - (i % 2) * 1.5, i % 3 === 1 ? 'warrior' : 'minion', 30, false));
  all.push(dummy(0, -9, 'archer', 30, false));
  player.iframes = 99;
  for (let t = 0; t < 24; t++) { const a = all.find((x) => x.alive) || all[0]; player.facing = Math.atan2(a.position.x - player.position.x, a.position.z - player.position.z); cast(t % 3); if (t % 6 === 5) player.startDodge(); yield 0.3; }
  player.iframes = 0;
  for (let i = 0; i < 4; i++) { const e = combat.enemies.find((x) => x.alive); if (e) combat.hitPlayer(e, 5, { target: player }); player.iframes = 0; yield 0.2; }
  yield 2;
  const errs = (window.__game.errors || []).length - errs0;
  out(`  sem erros do jogo ${ok(errs === 0, errs)}`);
  player.input = realInput;
}
