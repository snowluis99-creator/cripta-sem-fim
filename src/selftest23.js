// Teste automático, parte 23 (06/11/2026): bênçãos novas do Cajado Elétrico (lista do dono).
// Tecla Y = tudo; tecla . (ponto) = só o Cajado Elétrico.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* eleTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('mage', 'eletrico'); player.reset(0, 2); player.facing = Math.PI;
    clearStrip(-10, 10, -14, 8);
    player.input = fake();
    player.iframes = 0;
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion', hp = 999) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const C = () => player.hero.combo;
  const cast = (i = 0) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const face = (e) => { player.facing = Math.atan2(e.position.x - player.position.x, e.position.z - player.position.z); player.group.rotation.y = player.facing; };
  const K = combat.ele;
  const errs0 = (window.__game.errors || []).length;

  // ---------------- 193) Lista ----------------
  out('193) Cajado Elétrico: bênçãos do dono');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'mage.eletrico');
  const by = (n) => mine.find((b) => b.name === n) || {};
  const want = ['Polaridade', 'Ímã', 'Pulso Magnético', 'Poça Elétrica', 'Torre Tesla', 'Nuvem Pessoal', 'Rede Elétrica', 'Marionete', 'Curto-Circuito', 'Sobrecarga',
    'Blecaute', 'Passo Relâmpago', 'Para-choque', 'Gerador', 'Bateria', 'Arco Voltaico', 'Ping-Pong', 'Ionizar', 'Ossos Magnéticos', 'Choque Amigo'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  out(`  ${mine.length} bênçãos (6 antigas + 20) ${ok(mine.length === 26)} | as 20 da lista ${ok(!miss.length, miss.join(', '))}`);
  out(`  raridades ${ok(by('Polaridade').rarity === 'epic' && by('Ímã').rarity === 'rare' && by('Torre Tesla').rarity === 'legendary' && by('Blecaute').rarity === 'legendary'
    && by('Arco Voltaico').rarity === 'legendary' && by('Bateria').rarity === 'epic' && by('Ping-Pong').rarity === 'rare' && by('Choque Amigo').rarity === 'epic')} | Choque Amigo só no co-op ${ok(by('Choque Amigo').coop === true)}`);

  // ---------------- 194) Polaridade ----------------
  out('194) Polaridade: opostos se puxam e batem; iguais se empurram');
  fresh(); yield 0.1;
  give('w_ele11');
  const pa = dummy(0, -0.6), pb = dummy(2.6, -0.8);
  face(pa); cast(0);
  out(`  os dois ganharam carga ${ok(pa.elePol && pb.elePol)} | cargas opostas ${ok(pa.elePol === -pb.elePol)}`);
  yield 0.3;
  out('  -> + e − em cima das cabeças (screenshot)');
  yield 'hold';
  yield* until(() => ev('elePolBang').length > 0, 2500);
  out(`  se puxaram e bateram ${ok(ev('elePolBang').length === 1)} | dano nos dois ${ok(pa.hp < 999 - 3 && pb.hp < 999 - 3)}`);
  fresh(); yield 0.1; give('w_ele11');
  const pc = dummy(0, -1), pd = dummy(1.8, -1);
  K.charge(player, pc); K.charge(player, pd); pc.elePol = 1; pd.elePol = 1;
  const d0 = Math.hypot(pc.position.x - pd.position.x, pc.position.z - pd.position.z);
  yield 0.6;
  const d1 = Math.hypot(pc.position.x - pd.position.x, pc.position.z - pd.position.z);
  out(`  iguais se afastaram ${ok(d1 > d0 + 0.5, `${d0.toFixed(1)} → ${d1.toFixed(1)}`)}`);

  // ---------------- 195) Ímã ----------------
  out('195) Ímã: os atingidos se juntam');
  fresh(); yield 0.1;
  give('w_ele12');
  const ms = [dummy(0, -0.6), dummy(2.6, -0.6), dummy(-2.6, -0.6)];
  const spread = () => Math.max(...ms.map((a) => Math.max(...ms.map((b) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z)))));
  const s0 = spread();
  face(ms[0]); cast(0);
  yield 0.5;
  out(`  puxou ${ok(ev('eleMagnet').length === 1 && ev('eleMagnet')[0].n >= 2)} | o grupo ficou mais junto ${ok(spread() < s0 - 1, `${s0.toFixed(1)} → ${spread().toFixed(1)}`)}`);

  // ---------------- 196) Pulso Magnético ----------------
  out('196) Pulso Magnético: o 3º raio desvia flechas e magias');
  fresh(); yield 0.1;
  give('w_ele13');
  const archer = dummy(0, -7);
  const ar = combat.projectiles.fire(0, -5, 0, { speed: 6, damage: 5, kind: 'arrow', owner: archer, height: 1.2 });
  const orb = combat.projectiles.fire(3, -4, -0.6, { speed: 5, damage: 5, kind: 'orb', color: 0x9a40ff, owner: archer, height: 1.2 });
  cast(2);
  out(`  desviou as 2 ${ok(ar.hits === 'reflected' && orb.hits === 'reflected' && ev('elePulse')[0]?.n === 2)}`);
  fresh(); yield 0.1; give('w_ele13');
  const ar2 = combat.projectiles.fire(0, -5, 0, { speed: 6, damage: 5, kind: 'arrow', owner: dummy(0, -7), height: 1.2 });
  cast(0);
  out(`  1º raio não desvia ${ok(ar2.hits === 'player')}`);

  // ---------------- 197) Poça Elétrica ----------------
  out('197) Poça Elétrica: fica no chão 3 s e dá choque');
  fresh(); yield 0.1;
  give('w_ele14');
  cast(0);
  out(`  poça onde o raio terminou ${ok(K.puddles.length === 1)}`);
  const pu = K.puddles[0];
  const pde = dummy(pu ? pu.x : 0, pu ? pu.z : -2);
  yield 0.3;
  out('  -> poça faiscando (screenshot)');
  yield 'hold';
  yield 0.8;
  out(`  quem pisou levou choque ${ok(pde.hp < 999 && ev('elePuddle').length >= 1)}`);
  yield 2.2;
  out(`  some depois de 3 s ${ok(K.puddles.length === 0)}`);

  // ---------------- 198) Torre Tesla ----------------
  out('198) Torre Tesla: o 3º raio planta um cristal por 5 s');
  fresh(); yield 0.1;
  give('w_ele15');
  cast(0);
  out(`  1º raio não planta ${ok(K.towers.length === 0)}`);
  cast(2);
  out(`  3º raio plantou ${ok(K.towers.length === 1)}`);
  const tw = K.towers[0];
  const tde = dummy(tw.x + 3, tw.z - 1);
  yield 1.0;
  out('  -> cristal soltando raios (screenshot)');
  yield 'hold';
  out(`  atirou sozinho ${ok(ev('eleTowerZap').length >= 1 && tde.hp < 999)}`);
  yield 4.3;
  out(`  some depois de 5 s ${ok(K.towers.length === 0)}`);

  // ---------------- 199) Nuvem Pessoal ----------------
  out('199) Nuvem Pessoal: combo completo chama a nuvem (5 s)');
  fresh(); yield 0.1;
  give('w_ele16');
  cast(2);
  out(`  chamou ${ok(K.clouds.has(player))}`);
  const cde = dummy(-3, 2.5);
  yield 1.2;
  out('  -> nuvem em cima da Maga (screenshot)');
  yield 'hold';
  out(`  raio em quem chegou perto ${ok(ev('eleCloudZap').length >= 1 && cde.hp < 999)}`);
  yield 4.2;
  out(`  some depois de 5 s ${ok(!K.clouds.has(player))}`);

  // ---------------- 200) Rede Elétrica ----------------
  out('200) Rede Elétrica: fio entre os dois por 2 s');
  fresh(); yield 0.1;
  give('w_ele17');
  const na = dummy(0, -0.6), nb = dummy(2.8, -0.6);
  face(na); cast(0);
  out(`  ligou ${ok(K.wires.length === 1)}`);
  const nc = dummy(1.4, -0.6);
  nc.position.set(1.4, 0, -0.6);
  yield 0.6;
  out('  -> fio de luz entre os dois (screenshot)');
  yield 'hold';
  out(`  quem encostou no fio levou choque ${ok(ev('eleWireHit').some((e) => e.enemy === nc))}`);
  yield 1.7;
  out(`  some depois de 2 s ${ok(K.wires.length === 0)}`);

  // ---------------- 201) Marionete ----------------
  out('201) Marionete: o atordoado golpeia o aliado mais perto');
  fresh(); yield 0.1;
  give('w_ele18');
  const ma = dummy(0, -0.6), mb = dummy(1.1, -1.2);
  face(ma); cast(0);
  out(`  espasmo ${ok(ev('elePuppet').length >= 1)}`);
  yield* until(() => ev('elePuppetHit').length > 0, 2000);
  out(`  golpeou o aliado ${ok(ev('elePuppetHit').length >= 1)}`);
  yield 1.0;
  out(`  voltou ao normal ${ok(ma.state !== 'elePuppet' && mb.state !== 'elePuppet')}`);

  // ---------------- 202) Curto-Circuito ----------------
  out('202) Curto-Circuito: escudo não segura e passa o choque');
  fresh(); yield 0.1;
  const sw = combat.spawn('warrior', 0, -0.8, { awake: true, passive: true, facing: 0 }); sw.hp = sw.maxHp = 999;
  cast(0);
  out(`  sem a bênção o escudo segura ${ok(ev('blocked').length >= 1 && sw.hp === 999)}`);
  fresh(); yield 0.1;
  give('w_ele19');
  const sw2 = combat.spawn('warrior', 0, -0.8, { awake: true, passive: true, facing: 0 }); sw2.hp = sw2.maxHp = 999;
  const st2 = dummy(1.0, -1.0);
  cast(0);
  const hit2 = ev('hit').find((h) => h.enemy === sw2);
  out(`  passou pelo escudo ${ok(!!hit2)} | dano dobrado ${ok(hit2 && hit2.dmg >= 5, hit2 && hit2.dmg)} | passou para quem encosta ${ok(ev('eleShortPass').some((e) => e.enemy === st2))}`);

  // ---------------- 203) Sobrecarga ----------------
  out('203) Sobrecarga: 5 raios = explode 2 s depois');
  fresh(); yield 0.1;
  give('w_ele20');
  const oa = dummy(0, -0.8), ob = dummy(1.6, -2.2);
  ob.position.set(4, 0, -4); // longe do raio
  face(oa);
  for (let i = 0; i < 4; i++) { cast(0); yield 0.05; }
  out(`  4 raios: ainda não ${ok(ev('eleOverload').length === 0)}`);
  cast(0);
  out(`  5º raio: começou a faiscar ${ok(ev('eleOverload').length === 1)}`);
  ob.position.set(1.6, 0, -0.8);
  yield 0.6;
  out('  -> esqueleto faiscando (screenshot)');
  yield 'hold';
  yield* until(() => ev('eleOverBoom').length > 0, 2500);
  out(`  explodiu ${ok(ev('eleOverBoom').length === 1 && ev('eleOverBoom')[0].n >= 2)} | pegou o vizinho ${ok(ob.hp < 999)}`);

  // ---------------- 204) Blecaute ----------------
  out('204) Blecaute: tochas apagam 3 s, esqueletos perdidos');
  fresh(); yield 0.1;
  give('w_ele21');
  const ba = [dummy(-3, -3), dummy(3, -4), dummy(0, -6)];
  const built = K.built;
  cast(2);
  out(`  apagou ${ok(!!K.black)} | esqueletos perdidos ${ok(ba.every((e) => e.state === 'eleLost'))} | tem sala ${ok(!!(built && built.light))}`);
  const pos0 = ba[0].position.clone();
  yield 0.8;
  out(`  escuro ${ok(built && built.light.dim < 0.1, built && built.light.dim.toFixed(2))} | andando sem rumo ${ok(Math.hypot(ba[0].position.x - pos0.x, ba[0].position.z - pos0.z) > 0.3)}`);
  out('  -> sala escura, só a Maga brilha (screenshot)');
  yield 'hold';
  cast(2);
  out(`  recarga: o 2º não apaga de novo ${ok(ev('eleBlackout').length === 1)}`);
  yield 3.0;
  out(`  voltou a luz ${ok(!K.black && built && built.light.dim > 0.5)} | voltaram a caçar ${ok(ba.every((e) => e.state !== 'eleLost'))}`);

  // ---------------- 205) Passo Relâmpago ----------------
  out('205) Passo Relâmpago: rolar vira avanço de raio');
  fresh(); yield 0.1;
  give('w_ele22');
  const da = dummy(0, -0.5);
  const z0 = player.position.z;
  player.startDodge();
  out(`  avançou ${ok(z0 - player.position.z > 4, (z0 - player.position.z).toFixed(1))} | choque no caminho ${ok(da.hp < 999)} | rastro ${ok(K.trails.length === 1)}`);
  const db = dummy(0, 0.2);
  yield 0.6;
  out('  -> rastro elétrico no chão (screenshot)');
  yield 'hold';
  out(`  rastro dá choque ${ok(ev('eleTrail').some((e) => e.enemy === db))}`);

  // ---------------- 206) Para-choque ----------------
  out('206) Para-choque: quem encosta leva choque e voa');
  fresh(); yield 0.1;
  give('w_ele23');
  const bu = dummy(0, 1.2);
  const hp0 = player.hp, bz = bu.position.z;
  const r = K.bumper(player, bu);
  yield 0.3;
  out(`  choque ${ok(r && bu.hp < 999)} | jogado para trás ${ok(bz - bu.position.z > 0.8, (bz - bu.position.z).toFixed(1))} | Maga sem dano ${ok(player.hp === hp0)}`);
  fresh(); yield 0.1;
  out(`  sem a bênção não faz nada ${ok(!K.bumper(player, dummy(0, 1.2)))}`);

  // ---------------- 207) Gerador ----------------
  out('207) Gerador: andar enche, o próximo raio solta tudo');
  fresh(); yield 0.1;
  give('w_ele24');
  let ang = 0; // anda em círculo (em linha reta bate na parede)
  player.input = fake({ moveDir: (v) => { ang += 0.025; return v.set(Math.sin(ang), 0, Math.cos(ang)); } });
  yield 1.5;
  const half = player.eleGen;
  yield 2.0;
  out(`  enche andando ${ok(half > 0.3 && half < 0.7, half.toFixed(2))} → cheia ${ok(player.eleGen >= 0.99, player.eleGen.toFixed(2))}`);
  player.input = fake();
  const gd = dummy(player.position.x, player.position.z - 1.6);
  face(gd);
  flags.events.length = 0;
  cast(0);
  const gh = ev('hit').find((h) => h.enemy === gd);
  out(`  raio ×3 ${ok(ev('eleGen').length === 1 && gh && gh.dmg >= 7, gh && gh.dmg)} | barra zerou ${ok(player.eleGen === 0)}`);
  yield 0.6;
  out(`  parada não enche ${ok(player.eleGen === 0)}`);

  // ---------------- 208) Bateria ----------------
  out('208) Bateria: guarda cargas e descarrega em quem bate');
  fresh(); yield 0.1;
  give('w_ele25');
  const bd = dummy(0, -0.8);
  face(bd);
  for (let i = 0; i < 4; i++) { cast(0); yield 0.05; }
  out(`  4 cargas ${ok(player.eleBat === 4, player.eleBat)}`);
  yield 0.2;
  out('  -> faíscas girando na cintura (screenshot)');
  yield 'hold';
  const bhp = bd.hp;
  combat.hitPlayer(bd, 5, { target: player });
  out(`  descarregou ${ok(ev('eleBattery').length === 1 && ev('eleBattery')[0].n === 4)} | dano em quem bateu ${ok(bhp - bd.hp >= 10, bhp - bd.hp)} | zerou ${ok(player.eleBat === 0)}`);

  // ---------------- 209) Arco Voltaico ----------------
  out('209) Arco Voltaico: segurar = raio contínuo que cresce');
  fresh(); yield 0.1;
  give('w_ele26');
  const vd = dummy(0, -0.8);
  let first = true, held = true;
  player.input = fake({ attack: () => { const f = first; first = false; return f; }, attackHeld: () => held });
  yield 0.8;
  out(`  virou raio contínuo ${ok(player.state === 'eleBeam')}`);
  yield 1.0;
  out('  -> raio grudado no esqueleto (screenshot)');
  yield 'hold';
  yield 1.5;
  const arcs = ev('eleArc');
  out(`  vários toques ${ok(arcs.length >= 8, arcs.length)} | mais forte com o tempo ${ok(arcs.length && arcs[arcs.length - 1].mul > arcs[0].mul + 1, arcs.length && `${arcs[0].mul.toFixed(1)} → ${arcs[arcs.length - 1].mul.toFixed(1)}`)} | dano ${ok(vd.hp < 999 - 15, 999 - vd.hp)}`);
  held = false;
  yield 0.2;
  out(`  soltou: volta ao normal ${ok(player.state !== 'eleBeam')}`);
  fresh(); yield 0.1;
  first = true; held = false;
  player.input = fake({ attack: () => { const f = first; first = false; return f; }, attackHeld: () => held });
  dummy(0, -0.8);
  yield 0.8;
  out(`  sem a bênção: golpe normal ${ok(player.state !== 'eleBeam')}`);

  // ---------------- 210) Ping-Pong ----------------
  out('210) Ping-Pong: o raio vai e volta');
  fresh(); yield 0.1;
  give('w_ele27');
  const qa = dummy(0, -0.6), qb = dummy(2.4, -0.6);
  face(qa); cast(0);
  yield 1.2;
  const pings = ev('elePing');
  out(`  quicou ${ok(pings.length === 4, pings.length)} | foi e voltou ${ok(pings.some((e) => e.enemy === qa) && pings.some((e) => e.enemy === qb))}`);

  // ---------------- 211) Ionizar ----------------
  out('211) Ionizar: o 3º raio pula de novo a partir dos ionizados');
  fresh(); yield 0.1;
  give('w_ele28');
  const ia = dummy(0, -0.6);
  face(ia); cast(0);
  out(`  ionizado ${ok(ia.eleIonT > 0)}`);
  ia.position.set(6, 0, -3);
  const ic = dummy(7.5, -3.5), id = dummy(0, -0.6);
  face(id); cast(2);
  out(`  pulou do ionizado longe ${ok(ev('hit').some((h) => h.enemy === ic) && ev('eleIonJump')[0]?.n >= 1)}`);

  // ---------------- 212) Ossos Magnéticos ----------------
  out('212) Ossos Magnéticos: morto pelo raio solta ossos');
  fresh(); yield 0.1;
  give('w_ele29');
  const oa2 = dummy(0, -0.6, 'minion', 1), ob2 = dummy(4.5, -2.8);
  face(oa2); cast(0);
  out(`  soltou ossos ${ok(ev('eleBones').length === 1)}`);
  yield* until(() => ev('eleBonesHit').length > 0, 2000);
  out(`  voaram até o vizinho ${ok(ob2.hp < 999)}`);

  // ---------------- 213) Choque Amigo ----------------
  out('213) Choque Amigo: o raio pula no parceiro e ajuda');
  fresh(); yield 0.1;
  give('w_ele30');
  const fa = dummy(0, -0.6);
  let healed = 0;
  const mate = { position: fa.position.clone().set(1.5, 0, -1), hero: { radius: 0.5 }, state: 'idle', heal: (n) => { healed += n; return n; }, eleHasteT: 0 };
  combat.players.push(mate);
  face(fa); cast(0);
  combat.players.splice(combat.players.indexOf(mate), 1);
  out(`  curou 2 ${ok(healed === 2)} | ficou rápido ${ok(mate.eleHasteT > 1.5)}`);

  // ---------------- 214) Todas juntas ----------------
  out('214) Cajado com as 30 bênçãos: sem erros');
  fresh(); yield 0.1;
  for (const b of mine) for (let k = 0; k < b.max; k++) player.addBlessing(b);
  const all = [];
  for (let i = 0; i < 6; i++) all.push(dummy(-2.5 + i, -1 - (i % 2) * 1.2));
  combat.spawn('warrior', 2, -3, { awake: true, passive: true, facing: 0 });
  player.iframes = 99;
  for (let t = 0; t < 18; t++) { face(all[t % 6]); cast(t % 3); yield 0.25; if (t === 9) player.startDodge(); }
  yield 2.5;
  player.iframes = 0;
  const errs = (window.__game.errors || []).length - errs0;
  out(`  sem erros do jogo ${ok(errs === 0, errs)}`);
  player.input = realInput;
}
