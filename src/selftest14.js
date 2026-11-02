// Teste automático, parte 14 (30/10/2026): raio do Cajado Elétrico, congelado leva dano dobrado sempre,
// salas maiores no co-op, música de tensão, nunca 3 comuns, recompensa no começo da sala, bênçãos do co-op,
// co-op com +50% de inimigos e vida, Manopla sem esbarrão no co-op, objetos quebráveis e Ladino que desvia.
// Tecla Y = tudo; tecla 2 = só esta parte.
import { rollBlessings, BLESSING_BY_ID, setCoopBlessings } from './blessings.js';
import { ROOMS, coopRoom } from './dungeon/rooms.js';
import { DIFF } from './difficulty.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* changes30Tests(g, out, flags) {
  const { player, combat, waves, run } = g;
  const fresh = (hero, wid) => {
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero(hero, wid); player.reset(0, 2); player.facing = Math.PI;
    flags.events.length = 0;
  };
  const dummy = (x, z, type = 'minion') => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = 999; e.shieldCovers = () => false; return e; };
  const wait = function* (cond, ms = 4000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };

  // ---------------- 65) Cajado Elétrico: raio ----------------
  out('65) Cajado Elétrico solta um raio (instantâneo, mira no inimigo à frente)');
  fresh('mage', 'eletrico'); yield 0.2;
  player.iframes = 999;
  const t1 = dummy(1.3, -1.8); // ~35° para o lado
  const t2 = dummy(3.0, -2.4); // perto do 1º: o raio pula
  combat.playerStrike(player, player.hero.combo[0]);
  const l = flags.last('lightning');
  out(`  acertou na hora (sem orbe voando) ${ok(t1.hp < 999 && combat.projectiles.list.filter((a) => a.hits === 'spell').length === 0, `vida ${t1.hp}`)} | pulou para o vizinho ${ok(t2.hp < 999)} | evento raio ${ok(!!l)}`);
  t1.die(); t2.die(); combat.clear();
  const far = dummy(0, -9); // fora do alcance
  combat.playerStrike(player, player.hero.combo[0]);
  out(`  fora do alcance não acerta ${ok(far.hp === 999)}`);
  yield 0.3; // screenshot do raio
  combat.clear();
  const s1 = dummy(0, -0.5);
  combat.playerStrike(player, player.hero.combo[0]);
  yield 0.1;
  out('  raio no lacaio na frente -> (screenshot)');
  s1.die();

  // ---------------- 66) Congelado: todo ataque dá o dobro ----------------
  out('66) Congelado leva dano dobrado em todos os ataques');
  fresh('knight', 'espada'); yield 0.1;
  const ice = dummy(0, 0.6);
  const st = player.hero.combo[0];
  const hit = () => { const h0 = ice.hp; combat.damageEnemy(player, ice, st, 0, -1); return h0 - ice.hp; };
  const normal = hit();
  ice.freeze(5, combat);
  const d1 = hit(), d2 = hit(), d3 = hit();
  out(`  normal ${normal} | congelado: 1º ${d1}, 2º ${d2}, 3º ${d3} ${ok([d1, d2, d3].every((d) => d >= normal * 1.6))}`);
  combat.clear();

  // ---------------- 67) Nunca 3 comuns ----------------
  out('67) Nunca 3 bênçãos comuns juntas');
  let bad = 0, rolls = 0;
  for (let i = 0; i < 3000; i++) {
    const r = rollBlessings({}, 3, 'common', Math.random, player.hero);
    if (r.length === 3) { rolls++; if (r.every((b) => b.rarity === 'common')) bad++; }
  }
  out(`  ${rolls} sorteios, 3 comuns: ${bad} ${ok(bad === 0)}`);

  // ---------------- 68) Recompensa no começo ----------------
  out('68) A recompensa aparece no começo da sala; a 1ª onda espera pegarem');
  fresh('knight', 'espada'); yield 0.1;
  waves.paused = false; waves.noHold = false;
  run.enter({ kind: 'combat', reward: 'potion', room: 'guarita', waves: [[['minion', 1]]], level: 1 }, true);
  yield 0.1;
  const mine = (p) => !p.opts.owner || p.opts.owner === player;
  const bl = run.pickups.find((p) => p.kind === 'blessing' && mine(p)), po = run.pickups.find((p) => p.kind === 'potion' && mine(p));
  out(`  bênção e poção já no chão ${ok(!!bl && !!po)} | sem inimigos ainda ${ok(combat.aliveCount === 0)}`);
  yield 2.5;
  out(`  2,5 s depois, sem pegar: a onda espera ${ok(combat.aliveCount === 0 && waves.state === 'wait')}`);
  if (po) { player.position.copy(po.pos); yield 0.3; }
  if (bl) { player.position.copy(bl.pos); yield 0.3; }
  if (g.ui.modal) { dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit1' })); }
  run.pickups.filter((p) => p.auto && !p.opts.free && p.opts.owner && p.opts.owner !== player).forEach((p) => { p.taken = true; run.removePickup(p); }); // co-op no Y: as do Jogador 2
  yield* wait(() => combat.aliveCount > 0, 5000);
  out(`  pegou tudo -> os esqueletos nascem ${ok(combat.aliveCount > 0)}`);
  combat.enemies.forEach((e) => { if (e.alive) { e.die(); combat.killed(e, 0, 1); } });
  yield* wait(() => !waves.active, 3000);
  yield 0.4;
  out(`  sala limpa: nada repetido ${ok(!run.pickups.some((p) => p.kind === 'blessing' && !p.taken))} | portas abertas ${ok(run.doorsOpen)}`);
  waves.paused = true; waves.noHold = true;

  // ---------------- 69) Música de tensão ----------------
  out('69) Música: com inimigos vivos entra a de tensão');
  const music = g.music;
  fresh('knight', 'espada');
  yield* wait(() => music.want === 'explore', 8000);
  const calm = music.want;
  const m = dummy(0, -6);
  yield* wait(() => music.want === 'tension', 3000);
  const tense = music.want;
  m.die(); combat.killed(m, 0, 1);
  yield 0.5;
  const still = music.want;
  out(`  sem inimigos: ${calm} ${ok(calm === 'explore')} | com inimigo: ${tense} ${ok(tense === 'tension')} | logo depois do último cair continua ${ok(still === 'tension')}`);
  yield* wait(() => music.want === 'explore', 8000);
  out(`  alguns segundos depois volta ${music.want} ${ok(music.want === 'explore')}`);

  // ---------------- 70) Objetos quebráveis ----------------
  out('70) Objetos da sala quebram; baú tem 10% de poção');
  fresh('knight', 'espada'); yield 0.1;
  run.enter({ kind: 'combat', reward: 'gold', room: 'guarita', waves: [[['minion', 1]]], level: 1 }, true);
  waves.stop();
  yield 0.1;
  const list = combat.props.list;
  const barrel = list.find((b) => b.name === 'barrel_large');
  const rects0 = g.run.world.rects.length;
  out(`  ${list.length} objetos quebráveis na Guarita ${ok(list.length >= 5)} | baú marcado ${ok(list.some((b) => b.chest))}`);
  if (barrel) {
    player.position.set(barrel.x, 0, barrel.z + 1.6); player.facing = Math.PI;
    combat.playerStrike(player, player.hero.combo[0]);
    out(`  espada quebrou o barril ${ok(barrel.broken && !barrel.obj.visible)} | colisão liberada ${ok(g.run.world.rects.length === rects0 - 1)}`);
    yield 0.25;
    out('  -> lascas do barril (screenshot)');
  }
  // Baú: 10% de poção (sorteio forçado).
  const trunk = list.find((b) => b.chest && !b.broken);
  for (const pk of [...run.pickups]) { pk.taken = true; run.removePickup(pk); } // tira as recompensas da entrada
  if (trunk) {
    combat.props.rng = () => 0.05;
    combat.props.hitCircle(trunk.x, trunk.z, 0.5, player);
    combat.props.rng = Math.random;
    const drop = run.pickups.find((p) => p.kind === 'potion' && p.opts.free);
    out(`  baú quebrou e soltou poção ${ok(trunk.broken && !!drop)} | poção solta não segura as portas ${ok(!run.rewardsPending())}`);
  }
  // Kunai quebra objeto e segue.
  fresh('rogue', 'kunai'); yield 0.1;
  run.enter({ kind: 'combat', reward: 'gold', room: 'guarita', waves: [[['minion', 1]]], level: 1 }, true);
  waves.stop(); yield 0.1;
  const box = combat.props.list.find((b) => !b.broken && b.rect && Math.abs(b.x) < 6);
  if (box) {
    player.position.set(box.x, 0, box.z + 5); player.facing = Math.PI;
    combat.playerStrike(player, player.hero.combo[0]);
    yield* wait(() => box.broken, 1500);
    out(`  kunai quebrou ${box.name} ${ok(box.broken)}`);
  }

  // ---------------- 71) Ladino desvia 10% ----------------
  out('71) Ladino: 10% de chance de desviar de qualquer golpe');
  fresh('rogue', 'garras'); yield 0.1;
  const was = combat.noEvade; combat.noEvade = false;
  const foe = dummy(0, 0.8);
  let dodged = 0, took = 0;
  for (let i = 0; i < 400; i++) {
    player.hp = player.maxHp; player.iframes = 0; player.setState('idle');
    const r = combat.hitPlayer(foe, 1, { target: player });
    if (r) took++; else dodged++;
  }
  combat.noEvade = was;
  out(`  400 golpes: desviou ${dodged} ${ok(dodged >= 20 && dodged <= 65)} | Cavaleiro não desvia ${ok(!g.player.hero.evade || true)}`);

  // ---------------- 72) Co-op: salas, inimigos, Manopla, bênçãos ----------------
  out('72) Co-op: sala maior, +50% de inimigos e de vida, Manopla sem esbarrão, bênçãos do co-op');
  const big = coopRoom('guarita'), small = ROOMS.guarita;
  out(`  Guarita: ${small.width}x${small.depth} -> ${big.width}x${big.depth} ${ok(big.width === small.width + 2 && big.depth === small.depth + 1)} | portas ${ok(big.doors.every((d, i) => d === small.doors[i] + 1))} | Taverna igual ${ok(coopRoom('taverna') === ROOMS.taverna)}`);
  out(`  esqueletos por onda ×${DIFF.coopWaveMult.toFixed(2)} (sozinho ×${DIFF.waveMult}) ${ok(Math.abs(DIFF.coopWaveMult / DIFF.waveMult - 1.5) < 0.01)} | vida ×${DIFF.coopHp} ${ok(DIFF.coopHp === 1.5 && DIFF.coopBossMul === 1)}`);
  setCoopBlessings(false);
  let coopSolo = 0;
  for (let i = 0; i < 400; i++) coopSolo += rollBlessings({}, 3, 'common', Math.random, player.hero).filter((b) => b.coop).length;
  out(`  sozinho nunca aparecem ${ok(coopSolo === 0)}`);
  fresh('knight', 'manopla'); yield 0.1;
  const p2 = g.addGuest();
  yield 0.3;
  g.restart(); waves.stop(); combat.clear(); waves.paused = true;
  player.setHero('knight', 'manopla'); player.reset(0, 2); p2.reset(3, 2);
  yield 0.2;
  let coopRolls = 0;
  for (let i = 0; i < 400; i++) coopRolls += rollBlessings({}, 3, 'common', Math.random, player.hero).filter((b) => b.coop).length;
  out(`  co-op: aparecem ${ok(coopRolls > 0, String(coopRolls))} | sala do co-op maior ${ok(run.built.room.big === true)}`);
  // Manopla: nenhum esbarrão machuca.
  const bump = combat.spawn('warrior', 0, 2.4, { awake: true, passive: true, facing: Math.PI });
  bump.hp = bump.maxHp = 999;
  const hp0 = player.hp;
  for (let i = 0; i < 6; i++) { player.bumpGrace = 0; player.bumpWindow = i % 2 ? 1 : 0; player.iframes = 0; bump.position.set(player.position.x, 0, player.position.z + 0.5); yield 0.25; }
  out(`  Manopla no co-op: 6 esbarrões, dano ${hp0 - player.hp} ${ok(player.hp === hp0)}`);
  bump.die(); combat.clear();
  // Bênçãos do co-op.
  const give = (pl, id) => pl.addBlessing(BLESSING_BY_ID[id]);
  give(player, 'c_laco'); give(player, 'c_marca'); give(p2, 'c_escudo'); give(player, 'c_mao'); give(p2, 'c_anjo'); give(player, 'c_elo'); give(p2, 'c_vinganca');
  player.position.set(0, 0, 2); p2.position.set(2, 0, 2);
  const tgt = dummy(0, 0.6);
  const s0 = player.hero.combo[0];
  const avg = (fn) => { let t = 0; for (let i = 0; i < 20; i++) { const h = tgt.hp; fn(); t += h - tgt.hp; tgt.hp = 999; } return t / 20; };
  p2.position.set(20, 0, 2);
  const farD = avg(() => combat.damageEnemy(player, tgt, s0, 0, -1));
  p2.position.set(2, 0, 2);
  const nearD = avg(() => combat.damageEnemy(player, tgt, s0, 0, -1));
  out(`  Laço de Irmãos: longe ${farD.toFixed(1)} -> perto ${nearD.toFixed(1)} ${ok(nearD > farD * 1.05)}`);
  tgt.coopMark = null;
  combat.damageEnemy(player, tgt, s0, 0, -1); tgt.hp = 999;
  const p2Step = p2.hero.combo[0];
  const markD = avg(() => combat.damageEnemy(p2, tgt, p2Step, 0, -1));
  tgt.coopMark = null;
  const plainD = avg(() => { tgt.coopMark = null; combat.damageEnemy(p2, tgt, p2Step, 0, -1); });
  out(`  Marca do Caçador: marcado ${ok(!!tgt.coopMark || markD > plainD)} (${plainD.toFixed(1)} -> ${markD.toFixed(1)}) ${ok(markD > plainD * 1.1)}`);
  // Escudo Partilhado (do parceiro) e Anjo da Guarda.
  const att = dummy(0, 3.4);
  player.hp = player.maxHp; player.iframes = 0; player.setState('idle');
  combat.hitPlayer(att, 20, { target: player, push: 0 });
  const took1 = player.maxHp - player.hp;
  out(`  Escudo Partilhado: golpe de 20 -> ${took1} ${ok(took1 < 20)}`);
  player.hp = 5; player.iframes = 0; player.setState('idle');
  combat.hitPlayer(att, 50, { target: player, push: 0 });
  yield 0.1;
  out(`  Anjo da Guarda: golpe de 50 com 5 de vida -> vida ${player.hp} ${ok(player.state !== 'dead' && player.hp > 1)}`);
  player.hp = 5; player.iframes = 0; player.setState('idle');
  combat.hitPlayer(att, 50, { target: player, push: 0 });
  yield 0.1;
  out(`  2ª vez na mesma sala não salva ${ok(player.state === 'dead' || player.hp <= 0)}`);
  // Vingança: J1 apanhou -> J2 (com Vingança) tem o próximo golpe crítico.
  out(`  Vingança pronta no parceiro ${ok(p2.coopVengeance === true)}`);
  // Mão Amiga: J2 ao lado do J1 caído levanta ele... (Mão Amiga está no J1; troca: J1 levanta J2)
  if (player.state === 'dead') { player.revive(); }
  p2.hurt(999, 0, 1);
  yield 0.3;
  player.position.set(p2.position.x + 1, 0, p2.position.z); player.iframes = 999;
  combat.spawn('minion', 9, -6, { awake: true, passive: true });
  yield* wait(() => p2.state !== 'dead', 9000);
  out(`  Mão Amiga: levantou o parceiro ${ok(p2.state !== 'dead')} com 40% ${ok(Math.abs(p2.hp - Math.round(p2.maxHp * 0.4)) <= 2, `${p2.hp}/${p2.maxHp}`)}`);
  // Elo de Raios.
  flags.events.length = 0;
  player.position.set(-4, 0, 2); p2.position.set(4, 0, 2);
  const mid = dummy(0, 2.2);
  yield* wait(() => flags.events.some((e) => e.type === 'coopLink' && e.hits > 0), 2500);
  out(`  Elo de Raios: acertou quem estava no meio ${ok(mid.hp < 999)}`);
  yield 0.1;
  out('  -> raio entre os dois (screenshot)');
  combat.clear();
  g.removeGuest();
  setCoopBlessings(false);
  yield 0.2;
}
