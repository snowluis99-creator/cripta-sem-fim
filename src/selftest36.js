// Teste automático, parte 36 (11/11/2026): bênçãos COMUNS dos 5 cajados da Maga (50, mcbless.js / mckit.js).
// Tecla ; (Slash no teclado ABNT, ao lado do ponto) = só estes; e no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { mcS, mcDodge } from './mckit.js';
import { markDark, hitUndead, undeadHit } from './undead.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* mcTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const fresh = (weapon) => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('mage', weapon); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    clearStrip(-12, 12, -16, 8);
    player.input = fake();
    player.iframes = 0; player.ult = 0;
    combat.mc.labareda = false; combat.mc.moon = false;
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion', hp = 999, keepShield = false) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = hp; if (!keepShield) e.shieldCovers = () => false; return e; };
  const ally = (x, z, hp = 20) => { const u = combat.spawn('minion', x, z, { awake: true, undead: player, facing: 0 }); u.hp = u.maxHp = hp; u.noGrave = true; u.noUltCharge = true; return u; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const C = () => player.hero.combo;
  const cast = (i = 0) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const spells = () => combat.projectiles.list.filter((a) => a.hits === 'spell');
  const hitsOn = (e) => ev('hit').filter((x) => x.enemy === e);
  const kill = (e) => { e.hp = 1; combat.bonusDamage(e, 5, 0, 1, 'dmg', player); };
  const arrowAt = (fromZ, owner, speed = 14) => combat.projectiles.fire(player.position.x, fromZ, 0, { speed, damage: 10, kind: 'arrow', hits: 'player', owner, height: 1.3 });
  const K = combat.mc;
  let rnd = null;
  const fixRandom = (v) => { if (!rnd) rnd = Math.random; Math.random = () => v; };
  const realRandom = () => { if (rnd) Math.random = rnd; rnd = null; };
  const errs0 = (window.__game.errors || []).length;

  // ---------- 510) Lista ----------
  out('510) Comuns da Maga: as 50 bênçãos novas');
  const mc = WEAPON_BLESSINGS.filter((b) => b.id.startsWith('w_mc'));
  const per = ['cajado', 'eletrico', 'trevas', 'gelo', 'fogo'].map((w) => mc.filter((b) => b.weapon === `mage.${w}`).length);
  out(`  ${mc.length} bênçãos ${ok(mc.length === 50)} | 10 por cajado ${ok(per.join() === '10,10,10,10,10', per.join('/'))} | todas comuns ${ok(mc.every((b) => b.rarity === 'common'))} | textos ${ok(mc.every((b) => b.desc(1).length > 10 && b.desc(b.max).length > 10))}`);
  const one = ['Orbe Teleguiado', 'Descarga ao Rolar', 'Vampiros', 'Lua Negra', 'Vento Úmido', 'Adrenalina', 'Gelo Restaurador', 'Isqueiro', 'Labareda'];
  out(`  máx. 1: ${one.length} ${ok(one.every((n) => mc.find((b) => b.name === n).max === 1))} | as outras vão até 3 ${ok(mc.filter((b) => b.max !== 1).length === 41)} | Picolé x Estátua/Boneco ${ok(mc.find((b) => b.name === 'Picolé').excludes.includes('w_gel12'))}`);

  // ================= Cajado Arcano =================
  out('511) Faísca Residual: o orbe que erra deixa uma faísca que explode');
  fresh('cajado'); yield 0.1; give('w_mca1');
  cast(0);
  yield* until(() => K.sparks.length > 0, 1500);
  const sp0 = K.sparks[0];
  out(`  faísca no chão ${ok(!!sp0)}`);
  if (sp0) { yield 0.2; const fa = dummy(sp0.x, sp0.z); yield* until(() => ev('mcSparkBoom').length > 0, 1000); out(`  inimigo pisou: explodiu ${ok(ev('mcSparkBoom').length === 1 && fa.hp < 999, String(999 - fa.hp))} | sumiu ${ok(!K.sparks.length)}`); }

  out('512) Orbe Teleguiado: o 1º orbe vai o dobro');
  fresh('cajado'); yield 0.1; give('w_mca2');
  cast(0); const l0 = spells()[0].life; combat.projectiles.clear(); cast(1); const l1 = spells()[0].life;
  out(`  1º orbe ${l0.toFixed(2)} s x 2º ${l1.toFixed(2)} s ${ok(Math.abs(l0 / l1 - 2 * (C()[1].cast.speed / C()[0].cast.speed)) < 0.05)}`);

  out('513) Contagem: a cada 4 acertos (N3), o orbe pequeno sai grande');
  fresh('cajado'); yield 0.1; give('w_mca3', 3);
  const ct = dummy(0, -2.5);
  for (let i = 0; i < 4; i++) { cast(i % 2); yield* until(() => !spells().length, 1500); }
  out(`  4 acertos: pronto ${ok(mcS(player).bigNext === true)}`);
  cast(0); const big = spells()[0];
  out(`  orbe pequeno saiu grande ${ok(!!big && !!big.step.heavy && ev('mcCount').length === 1)}`);
  yield* until(() => !spells().length, 1500); void ct;

  out('514) Estouro de Mana: abate com o orbe grande vale 2 (N3)');
  fresh('cajado'); yield 0.1; give('w_mca4', 3);
  const eu = dummy(0, -2.5, 'minion', 1);
  cast(2); yield* until(() => !eu.alive, 1500);
  out(`  ultimate ${player.ult} ${ok(player.ult === 2 && ev('mcUlt2').length === 1)}`);

  out('515) Orbe do Brago: zona de gravidade puxa para o centro');
  fresh('cajado'); yield 0.1; give('w_mca5', 2);
  dummy(0, -2.5); const bz = dummy(1.9, -2.8);
  cast(2); yield* until(() => K.zones.length > 0, 1500);
  const zt = K.zones[0] ? K.zones[0].t : 0;
  yield 0.3;
  out(`  zona criada (2 s no N2) ${ok(ev('mcZone').length === 1 && zt > 1.8)} | puxou quem estava dentro ${ok(!!bz.mcPulled)}`);
  out('  -> zona roxa e preta no chão (screenshot)');
  yield 'hold';
  yield 2.2;
  out(`  sumiu no fim ${ok(!K.zones.length)}`);

  out('516) Casca de Mana: abate cria casca que anula a próxima flecha');
  fresh('cajado'); yield 0.1; give('w_mca6');
  kill(dummy(0, -3));
  out(`  casca ${ok(player.mcShell === true)}`);
  const ar = dummy(3, -6, 'archer');
  const hp0 = player.hp;
  arrowAt(-2, ar); yield* until(() => ev('mcShellUse').length > 0, 1500); yield 0.1;
  out(`  flecha anulada ${ok(player.hp === hp0 && !player.mcShell)} | recarga ${mcS(player).shellCd.toFixed(1)} ${ok(mcS(player).shellCd > 7)}`);
  kill(dummy(0, -3));
  out(`  na recarga: sem casca nova ${ok(!player.mcShell)}`);

  out('517) Eco Arcano: a explosão grande explode de novo 1 s depois');
  fresh('cajado'); yield 0.1; give('w_mca7', 3);
  const ec = dummy(0, -2.5);
  cast(2); yield* until(() => ev('mcEcho').length > 0, 2500);
  const eco = ev('mcEcho')[0];
  out(`  eco ${ok(!!eco && eco.n >= 1, eco ? `${eco.dmg} de dano` : '')} | 60% de 8 ${ok(eco && eco.dmg >= 4 && eco.dmg <= 6)}`); void ec;

  out('518) Mira Firme: parada 1 s = próximo orbe crítico e maior');
  fresh('cajado'); yield 0.1; give('w_mca8', 2);
  const mf = dummy(0, -2.5);
  yield 1.2;
  cast(0); const mo = spells()[0];
  out(`  orbe mirado ${ok(!!mo && mo.mcAim && mo.scale > 1.4)}`);
  yield* until(() => hitsOn(mf).length > 0, 1500);
  const md = hitsOn(mf)[0];
  out(`  crítico ${ok(md && md.dmg >= 5, md ? String(md.dmg) : '-')}`);
  cast(1); out(`  o seguinte é normal ${ok(!spells()[0].mcAim)}`);

  out('519) Corta-Flechas: orbes destroem flechas (N3: +30% e atordoa arqueiro)');
  fresh('cajado'); yield 0.1; give('w_mca9', 3);
  const ca = dummy(0, -2.4, 'archer');
  const hp1 = player.hp;
  arrowAt(-1.2, ca, 6); cast(0);
  yield* until(() => ev('mcCutArrow').length > 0, 1500);
  out(`  cortou a flecha ${ok(ev('mcCutArrow').length === 1)}`);
  yield* until(() => hitsOn(ca).length > 0, 2000);
  out(`  sem dano na Maga ${ok(player.hp === hp1)} | arqueiro atordoado ${ok(ca.state === 'hurt' && ca.stunTime >= 0.9)}`);

  out('520) Orbe Saltitante: o orbe pequeno ricocheteia (N3 = sempre)');
  fresh('cajado'); yield 0.1; give('w_mca10', 3);
  dummy(0, -2.5); const s2 = dummy(2.2, -4);
  cast(0); yield* until(() => hitsOn(s2).length > 0, 2000);
  out(`  ricocheteou ${ok(ev('mcBounce').length === 1)} | acertou o 2º ${ok(s2.hp < 999)} | só 1 ricochete ${ok(ev('mcBounce').length === 1)}`);

  // ================= Cajado Elétrico =================
  out('521) Carga Estática: dois carregados que se encostam levam choque');
  fresh('eletrico'); yield 0.1; give('w_mce1', 3);
  const c1 = dummy(-1.2, -2), c2 = dummy(1.2, -2);
  cast(0);
  out(`  carregados ${ok(c1.mcChargeT > 0 && c2.mcChargeT > 0)}`);
  const h1 = c1.hp, h2 = c2.hp;
  c2.position.set(c1.position.x + 0.9, 0, c1.position.z); yield 0.1;
  out(`  encostaram: choque ${ok(ev('mcStatic').length === 1 && h1 - c1.hp >= 5 && h2 - c2.hp >= 5, `${h1 - c1.hp}/${h2 - c2.hp}`)} | descarregou ${ok(!(c1.mcChargeT > 0))}`);

  out('522) Raio Errante: o raio pula para 1 a mais (N3 = sempre)');
  fresh('eletrico'); yield 0.1;
  dummy(0, -1.8); dummy(0, -3.6);
  cast(0); const tA = ev('lightning').pop().targets;
  give('w_mce2', 3); cast(1); const tB = ev('lightning').pop().targets;
  out(`  sem: ${tA} alvo | com: ${tB} ${ok(tA === 1 && tB === 2)}`);

  out('523) Paralisia: 2 choques (N3) paralisam por 1,5 s');
  fresh('eletrico'); yield 0.1; give('w_mce3', 3);
  const pa = dummy(0, -2);
  cast(0); yield 0.05; cast(1);
  out(`  paralisou ${ok(ev('mcParalyze').length === 1 && pa.state === 'hurt' && pa.stunTime >= 1.4)}`);

  out('524) Para-raios de Bolso: raio destrói a flecha perto');
  fresh('eletrico'); yield 0.1; give('w_mce4', 3);
  const pr = dummy(3, -6, 'archer'); const hp2 = player.hp;
  arrowAt(-0.8, pr, 8); yield 0.3;
  out(`  destruiu ${ok(ev('mcRod').length === 1 && player.hp === hp2)} | recarga 2 s ${ok(mcS(player).rodCd > 1.5)}`);

  out('525) Descarga ao Rolar: 5 marcas do trovão atordoam por 3 s');
  fresh('eletrico'); yield 0.1; give('w_mce5');
  const dr = dummy(0.8, 0.8);
  for (let i = 0; i < 4; i++) mcDodge(player, 'start');
  const th4 = dr.mcThunder, hpD = dr.hp;
  mcDodge(player, 'start');
  out(`  4 marcas ${ok(th4 === 4)} | sem dano ${ok(dr.hp === hpD)} | 5ª: atordoado ${ok(ev('mcThunderStun').length === 1 && dr.state === 'hurt' && dr.stunTime >= 2.9)}`);
  mcDodge(player, 'end');

  out('526) Metal Conduz: +120% em guerreiros (N3)');
  fresh('eletrico'); yield 0.1; give('w_mce6', 3);
  const mw = dummy(0, -2, 'warrior'); cast(0); const dW = hitsOn(mw)[0].dmg; mw.die();
  const mm = dummy(0, -2); cast(1); const dM = hitsOn(mm)[0].dmg;
  out(`  guerreiro ${dW} x lacaio ${dM} ${ok(dW >= 6 && dM <= 4)}`);

  out('527) Bateria Cheia: 5 s sem atacar = o raio pula para +1');
  fresh('eletrico'); yield 0.1; give('w_mce7');
  dummy(0, -1.8); dummy(0, -3.6);
  mcS(player).lastCast = K.t - 6;
  cast(0); const tC = ev('lightning').pop().targets;
  cast(1); const tD = ev('lightning').pop().targets;
  out(`  cheia: ${tC} alvos ${ok(tC === 2 && ev('mcBattery').length === 1)} | logo depois: ${tD} ${ok(tD === 1)}`);

  out('528) Faíscas de Abate: o morto pelo raio solta 3 faíscas (N3)');
  fresh('eletrico'); yield 0.1; give('w_mce8', 3);
  dummy(0, -2, 'minion', 1); const fb = dummy(3.6, -6.5), fc = dummy(-3.6, -6.5);
  cast(0);
  const ks = ev('mcKillSparks')[0];
  out(`  faíscas ${ok(!!ks && ks.n === 2, ks ? `${ks.n} alvos` : '')} | dano ${ok(fb.hp < 999 && fc.hp < 999)}`);

  out('529) Ricochete Cego: sem outro alvo, o raio volta (80% no N3)');
  fresh('eletrico'); yield 0.1; give('w_mce9', 3);
  const rc = dummy(0, -2);
  cast(0);
  const ri = ev('mcRico')[0];
  out(`  voltou ${ok(!!ri && ri.enemy === rc && ri.dmg >= 2)}`);
  dummy(1.5, -2.5); flags.events.length = 0; cast(1);
  out(`  com outro perto: não volta ${ok(!ev('mcRico').length)}`);

  out('530) Pane: o choque da sala soma marca do trovão (N3 = sempre)');
  fresh('eletrico'); yield 0.1; give('w_mce10', 3);
  const pn = dummy(4, -8);
  for (let i = 0; i < 5; i++) { cast(2); if (pn.state === 'hurt' && i < 4) pn.setState('chase'); }
  out(`  5 choques: atordoado ${ok(ev('mcThunderStun').length === 1 && pn.state === 'hurt')}`);

  // ================= Cajado das Trevas =================
  out('531) Comandante: mortos-vivos vão no mais forte (+40% no N3)');
  fresh('trevas'); yield 0.1; give('w_mct1', 3);
  const u1 = ally(0, -1); dummy(0.5, -2, 'minion', 20); const strong = dummy(3, -6, 'warrior', 300);
  const tg = combat.pickTarget(u1, 0.016);
  out(`  alvo: o mais forte ${ok(tg === strong)} | dano ×${K.undeadDmgMul(u1).toFixed(2)} ${ok(Math.abs(K.undeadDmgMul(u1) - 1.4) < 0.01)}`);

  out('532) Medo das Trevas: marcado foge (N3 = sempre)');
  fresh('trevas'); yield 0.1; give('w_mct2', 3);
  const md2 = dummy(0, -2); markDark(combat, player, md2);
  out(`  fugiu ${ok(md2.state === 'axeFear' && ev('mcFear').length === 1)}`);

  out('533) Marca Passada: matar marcado passa a marca para 2 (N2)');
  fresh('trevas'); yield 0.1; give('w_mct3', 2);
  const mp = dummy(0, -2); const mq = dummy(1.5, -2.5), mr = dummy(-1.5, -2.5), ms = dummy(-8, -12);
  markDark(combat, player, mp); kill(mp);
  out(`  2 perto marcados ${ok(!!mq.darkMark && !!mr.darkMark)} | o longe não ${ok(!ms.darkMark)}`);

  out('534) Pacto Menor: levantar morto-vivo cura 3 (N3)');
  fresh('trevas'); yield 0.1; give('w_mct4', 3);
  dummy(5, -8); player.hp = 30;
  (combat.raising || (combat.raising = [])).push({ type: 'minion', x: 0, z: -1, t: 0, owner: player, hpScale: 1, dmgScale: 1, facing: 0 });
  yield 0.1;
  out(`  curou ${ok(player.hp === 33, String(player.hp))}`);

  out('535) Escudo de Ossos: 2 mortos-vivos = menos dano (N1: 15% cada)');
  fresh('trevas'); yield 0.1;
  const ob = dummy(0, 1.2); let hb = player.hp; combat.hitPlayer(ob, 20, { target: player }); const dNo = hb - player.hp;
  give('w_mct5'); ally(2, 0); ally(-2, 0); player.iframes = 0; player.hurtT = 0; yield 0.8; player.iframes = 0;
  hb = player.hp; combat.hitPlayer(ob, 20, { target: player }); const dYes = hb - player.hp;
  out(`  sem ${dNo} x com 2 ${dYes} ${ok(dNo === 20 && dYes === 14)}`);

  out('536) Último Abraço: morto-vivo que cai explode (N2: 10)');
  fresh('trevas'); yield 0.1; give('w_mct6', 2);
  const ua = ally(0, -1); const uv = dummy(1, -1.5);
  hitUndead(combat, ua, 999, 0, -3);
  out(`  explodiu ${ok(ev('mcHug').length === 1 && 999 - uv.hp >= 10, String(999 - uv.hp))}`);

  out('537) Olhar Sombrio: 3º orbe causa sangramento (N3 = sempre)');
  fresh('trevas'); yield 0.1; give('w_mct7', 3);
  const os = dummy(0, -2.5);
  cast(2); yield* until(() => hitsOn(os).length > 0, 1500);
  out(`  sangrando ${ok(os.bleedStacks >= 1)}`);

  out('538) Recrutador: +20% por morto-vivo (N3)');
  fresh('trevas'); yield 0.1; give('w_mct8', 3);
  const r1 = ally(1, 0); ally(-1, 0);
  out(`  2 na sala: dano ×${K.undeadDmgMul(r1).toFixed(2)} ${ok(Math.abs(K.undeadDmgMul(r1) - 1.4) < 0.01)} | dano recebido ×${K.undeadTakenMul(r1).toFixed(2)} ${ok(Math.abs(K.undeadTakenMul(r1) - 1 / 1.4) < 0.01)}`);

  out('539) Vampiros: morto-vivo que mata recupera 5');
  fresh('trevas'); yield 0.1; give('w_mct9');
  const va = ally(0, -1, 20); va.hp = 2; const vt = dummy(0, -2, 'minion', 1);
  undeadHit(combat, va, vt, 5);
  out(`  matou ${ok(!vt.alive)} | vida 2 → ${va.hp} ${ok(va.hp === 7)}`);

  out('540) Lua Negra: cada sala começa com 1 lacaio do lado da Maga');
  fresh('trevas'); yield 0.1; give('w_mct10');
  K.roomStart(); dummy(4, -8);
  yield 1.2;
  const moonU = combat.enemies.filter((e) => e.undead === player && e.alive);
  out(`  levantou ${ok(ev('mcMoon').length === 1 && moonU.length === 1 && moonU[0].type === 'minion')} | vida 10 ${ok(moonU[0] && moonU[0].hp === 10)}`);

  // ================= Cajado de Gelo =================
  out('541) Frio Contagioso: quem encosta no congelado congela (N2: 2 s)');
  fresh('gelo'); yield 0.1; give('w_mcg1', 2);
  const fz = dummy(0, -2); const fn = dummy(0.85, -2);
  fz.freeze(4, combat); yield 0.1;
  out(`  congelou o vizinho ${ok(fn.frozenT > 1.7 && fn.frozenT <= 2 && ev('mcContagion').length === 1)}`);

  out('542) Geada Rachada: queimadura de frio (N3 = sempre)');
  fresh('gelo'); yield 0.1; give('w_mcg2', 3);
  const gr = dummy(0, -2.5);
  cast(0); yield* until(() => gr.mcFrostT > 0, 1500);
  const hg = gr.hp; yield 1.15;
  out(`  queimando de frio ${ok(gr.mcFrostT > 0 || hg > gr.hp)} | dano ${ok(hg - gr.hp >= 2, String(hg - gr.hp))}`);

  out('543) Lascas: estilhaçar solta lascas em 2 perto (N2)');
  fresh('gelo'); yield 0.1; give('w_mcg3', 2);
  const la = dummy(0, -2.5); const lb = dummy(2, -3), lc = dummy(-2, -3), ld = dummy(9, -12);
  la.freeze(4, combat);
  cast(0); yield* until(() => ev('mcShards').length > 0, 1500);
  out(`  lascas ${ok(ev('mcShards').length === 1 && ev('mcShards')[0].n === 2)} | pegaram os perto ${ok(lb.hp < 999 && lc.hp < 999 && ld.hp === 999)}`);

  out('544) Poça de Gelo: descongelou = poça; molhado congela com 1 orbe');
  fresh('gelo'); yield 0.1; give('w_mcg4', 3);
  const pw = dummy(0, -2.5);
  pw.freeze(0.15, combat); yield 0.4;
  out(`  poça ${ok(ev('mcPuddle').length === 1 && K.puddles.length === 1)} | molhado em cima ${ok(pw.mcPuddleT > 0)}`);
  out('  -> poça azul no chão (screenshot)');
  yield 'hold';
  cast(0); yield* until(() => pw.frozenT > 0, 1500);
  out(`  1 orbe: congelou ${ok(pw.frozenT > 0 && ev('mcWetFreeze').length === 1)}`);

  out('545) Vento Úmido: rolar deixa molhado o 1º atravessado');
  fresh('gelo'); yield 0.1; give('w_mcg5');
  const vw = dummy(0, 1.6), vw2 = dummy(0.3, 2.3);
  mcDodge(player, 'start'); player.setState('dodge'); K.rollCross(player); player.setState('idle'); mcDodge(player, 'end');
  out(`  molhado ${ok(vw.mcWetT > 2.5 || vw2.mcWetT > 2.5)} | só 1 ${ok(!(vw.mcWetT > 0 && vw2.mcWetT > 0))}`);

  out('546) Adrenalina: levou golpe = cone de gelo na direção dele');
  fresh('gelo'); yield 0.1; give('w_mcg6');
  const ad = dummy(0, 0.6), adBack = dummy(0, 5);
  combat.hitPlayer(ad, 5, { target: player });
  out(`  congelou quem bateu ${ok(ad.frozenT > 2)} | o de trás não ${ok(!(adBack.frozenT > 0))}`);

  out('547) Congelar Flechas: N3 destrói, continua e congela o arqueiro');
  fresh('gelo'); yield 0.1; give('w_mcg7', 3);
  const ga = dummy(0, -9, 'archer'); const hp3 = player.hp;
  arrowAt(-5, ga, 8); cast(0);
  yield* until(() => ev('mcIceArrow').length > 0, 1500);
  out(`  destruiu ${ok(ev('mcIceArrow').length === 1 && player.hp === hp3)} | orbe continuou ${ok(spells().length === 1)} | arqueiro congelado ${ok(ga.frozenT > 0)}`);

  out('548) Picolé: morreu congelado vira cubo; chutar acerta (N1: 10)');
  fresh('gelo'); yield 0.1; give('w_mcg8');
  const pk = dummy(0, 0.6, 'minion', 1); pk.freeze(4, combat); kill(pk);
  out(`  cubo ${ok(K.cubes.length === 1)}`);
  const pt = dummy(0, -4);
  player.position.set(0, 0, 1.4); player.setState('run'); K.tickCubes(0.016); player.setState('idle');
  yield* until(() => ev('mcCubeHit').length > 0, 1500);
  out(`  chutou e acertou ${ok(ev('mcKick').length === 1 && ev('mcCubeHit').length === 1 && pt.hp < 999)} | cubo quebrou ${ok(!K.cubes.length)}`);

  out('549) Calafrio: lentos atacam 105% mais devagar (N3)');
  fresh('gelo'); yield 0.1; give('w_mcg9', 3); yield 0.05;
  out(`  recarga dos lentos ×${K.chillMul.toFixed(2)} ${ok(Math.abs(K.chillMul - 1 / 2.05) < 0.01)}`);

  out('550) Gelo Restaurador: morreu congelado devolve 1 da barreira');
  fresh('gelo'); yield 0.1; give('w_mcg10');
  player.shield = 2; const gz = dummy(0, -2, 'minion', 1); gz.freeze(3, combat); kill(gz);
  out(`  barreira 2 → ${player.shield} ${ok(player.shield === 3 && ev('mcRest').length === 1)}`);

  // ================= Cajado de Fogo =================
  out('551) Pavio Longo: morreu queimando deixa chamas (N2: 2 s)');
  fresh('fogo'); yield 0.1; give('w_mcf1', 2);
  const pv = dummy(0, -2, 'minion', 1); pv.burn = 3; pv.burnBy = player; kill(pv);
  out(`  chamas ${ok(ev('mcWick').length === 1 && ev('mcWick')[0].t === 2 && (combat.fireFields || []).length === 1)}`);

  out('552) Fumaça nos Olhos: arqueiro queimando erra (N3 = sempre)');
  fresh('fogo'); yield 0.1; give('w_mcf2', 3);
  const fa2 = dummy(0, -5, 'archer'); fa2.burn = 3; fa2.burnBy = player;
  const off = K.aimOffset(fa2); const fm = dummy(2, -5, 'minion'); fm.burn = 3; fm.burnBy = player;
  out(`  arqueiro erra ${ok(Math.abs(off) > 0.5)} | lacaio não conta ${ok(K.aimOffset(fm) === 0)}`);

  out('553) Fogueira Pessoal: parada 1,5 s acende fogueira que cura 1/s');
  fresh('fogo'); yield 0.1; give('w_mcf3'); player.hp = 40;
  yield 2.8;
  out(`  fogueira ${ok(ev('mcCampfire').length === 1)} | curou ${ok(player.hp >= 41, String(player.hp))}`);
  out('  -> fogueira aos pés da Maga (screenshot)');
  yield 'hold';
  player.input = fake({ moveDir: (v) => v.set(1, 0, 0) }); yield 0.3; player.input = fake();
  out(`  andou: apagou ${ok(!mcS(player).fire)}`);

  out('554) Ferro em Brasa: fogo atravessa o escudo (N1 metade, N2 todo, N3 derrete)');
  fresh('fogo'); yield 0.1;
  const fw = dummy(0, 0.7, 'warrior', 999, true); fw.facing = 0; fw.group.rotation.y = 0;
  cast(0); const r0 = flags.events.some((x) => x.type === 'blocked' && x.enemy === fw);
  give('w_mcf4'); fw.burn = 0; cast(0); const dh = hitsOn(fw).pop();
  give('w_mcf4'); cast(0); const df = hitsOn(fw).pop();
  out(`  sem: bloqueou ${ok(r0)} | N1 ${dh ? dh.dmg : '-'} x N2 ${df ? df.dmg : '-'} ${ok(dh && df && dh.dmg <= 2 && df.dmg >= 3)}`);
  give('w_mcf4'); fw.burn = 4; fw.burnBy = player;
  yield* until(() => ev('mcMelt').length > 0, 4500);
  out(`  N3: escudo derreteu ${ok(fw.shieldBroken === true)}`);

  out('555) Chama Gulosa: +8% por inimigo queimando (N3)');
  fresh('fogo'); yield 0.1; give('w_mcf5', 3);
  const gl = [dummy(0, -2), dummy(2, -3), dummy(-2, -3)]; for (const e of gl) { e.burn = 3; e.burnBy = player; }
  const gm = K.damage(player, gl[0], C()[0], { spell: true }).mul;
  out(`  3 queimando: ×${gm.toFixed(2)} ${ok(Math.abs(gm - 1.24) < 0.01)}`);

  out('556) Combustível: quem já queimava explode na explosão do 3º golpe');
  fresh('fogo'); yield 0.1; give('w_mcf6');
  const cb = dummy(0, -1.5); cb.burn = 3; cb.burnBy = player; cb.burnDps = 1; const cbn = dummy(0, -3.2);
  cast(2);
  out(`  explodiu ${ok(ev('mcCombust').length === 1 && ev('mcCombust')[0].enemy === cb)} | pegou o vizinho ${ok(cbn.hp < 999)}`);

  out('557) Isqueiro: rolar marca com faísca; acertar = explosão');
  fresh('fogo'); yield 0.1; give('w_mcf7');
  const iq = dummy(0, 1.6), iq2 = dummy(1.4, 1.0);
  mcDodge(player, 'start'); player.setState('dodge'); K.rollCross(player); player.setState('idle'); mcDodge(player, 'end');
  out(`  faísca ${ok(iq.mcSparkMark === true)}`);
  cast(0);
  out(`  explosão ${ok(ev('mcLighter').length === 1 && !iq.mcSparkMark)} | vizinho pegou fogo ${ok(iq2.burn > 0)}`);

  out('558) Ossos Secos: lacaios queimam 105% mais rápido (N3)');
  fresh('fogo'); yield 0.1; give('w_mcf8', 3);
  const os1 = dummy(0, -5); os1.burnBy = player; const ow = dummy(2, -5, 'warrior'); ow.burnBy = player;
  let sm = 0, sw = 0; for (let i = 0; i < 20; i++) { sm += K.burnMul(os1, 1); sw += K.burnMul(ow, 1); }
  out(`  lacaio: 20 ticks = ${sm} ${ok(sm === 41)} | guerreiro ${sw} ${ok(sw === 20)}`);

  out('559) Calor do Combate: abate queimando vale 2 (N3 = sempre)');
  fresh('fogo'); yield 0.1; give('w_mcf9', 3);
  const cq = dummy(0, -2, 'minion', 1); cq.burn = 3; cq.burnBy = player; kill(cq);
  out(`  ultimate ${player.ult} ${ok(player.ult === 2)}`);

  out('560) Labareda: o 1º golpe da sala atinge a sala toda');
  fresh('fogo'); yield 0.1; give('w_mcf10');
  K.roomStart();
  const lf = dummy(4, -10), ln = dummy(-5, -6);
  cast(0);
  out(`  explosão na sala ${ok(ev('mcBlaze').length === 1 && lf.hp < 999 && ln.hp < 999)} | pegou fogo ${ok(lf.burn > 0)}`);
  out('  -> labareda (screenshot)');
  yield 'hold';
  cast(1);
  out(`  o 2º golpe é normal ${ok(ev('mcBlaze').length === 1)}`);

  realRandom(); void fixRandom;
  const errs = (window.__game.errors || []).slice(errs0);
  out(`  sem erros no console ${ok(!errs.length, errs.slice(0, 2).join(' | '))}`);
  player.input = realInput;
}
