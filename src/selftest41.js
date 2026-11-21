// Teste automático, parte 41 (11/11/2026): bênçãos ÉPICAS, lote 2 (as 8 do Ladino, e2bless.js / e2kit.js).
// Duas Adagas, Kunais, Garras, Rapieira, Besta. Tecla + do teclado numérico (corrido), - do numérico (com pausas) e no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { e2S, e2MoveMul, e2AtkMul } from './e2kit.js';
import { E2 } from './e2bless.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* e2Tests(g, out, flags) {
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
  const dummy = (x, z, type = 'minion', hp = 999, passive = true) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing: 0 }); e.hp = e.maxHp = hp; if (type !== 'warrior') e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { for (let t = 0; t < ms / 1000 && !cond(); t += 0.05) yield 0.05; }; // tempo do jogo (não do relógio)
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const C = () => player.hero.combo;
  const hit = (i) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const strike = (e, step, opts = {}) => { const dx = e.position.x - player.position.x, dz = e.position.z - player.position.z, d = Math.hypot(dx, dz) || 1; player.swingSeq = (player.swingSeq || 0) + 1; return combat.damageEnemy(player, e, step, dx / d, dz / d, opts); };

  // ---------- 655) Lista ----------
  out('655) Épicas, lote 2: as 8 bênçãos do Ladino');
  const e2 = WEAPON_BLESSINGS.filter((b) => b.id.startsWith('w_e2'));
  const per = ['rogue.adagas', 'rogue.kunai', 'rogue.garras', 'rogue.rapieira', 'rogue.besta'].map((w) => e2.filter((b) => b.weapon === w).length);
  out(`  ${e2.length} bênçãos ${ok(e2.length === 8)} | Adagas/Kunais/Garras/Rapieira/Besta 1/1/2/2/2 ${ok(per.join() === '1,1,2,2,2', per.join('/'))} | todas épicas, máx. 1 ${ok(e2.every((b) => b.rarity === 'epic' && b.max === 1))} | textos ${ok(e2.every((b) => b.desc(1).length > 20))}`);

  // ================= Duas Adagas =================
  out('656) Disfarce: derrubou um esqueleto -> veste o crânio; ninguém vê; 1º golpe ×3 e revela (1 vez por onda)');
  fresh('rogue', 'adagas'); yield 0.1;
  give('w_e2d1');
  player.stats.critChance = -1; // sem crítico (o teste compara o dano)
  const others = [dummy(-5, -5, 'minion', 999, false), dummy(5, -6, 'warrior', 999, false)];
  dummy(0, 0.6, 'minion', 1); hit(0);
  yield 0.1;
  const s = e2S(player);
  out(`  derrubou: disfarçado ${ok(!!s.disguise && ev('e2Disguise').length === 1)} | crânio na cabeça ${ok(!!(s.disguise && s.disguise.g && s.disguise.g.parent))}`);
  yield 0.8;
  out(`  os inimigos perderam o Ladino ${ok(others.every((e) => e.state === 'rogueLost'), others.map((e) => e.state).join('/'))}`);
  out('  -> Disfarce (screenshot)'); yield 'hold';
  const tgt = dummy(0, 0.6, 'minion', 999);
  const base = Math.round(C()[0].damage * player.stats.damageMul);
  hit(0);
  const got = 999 - tgt.hp;
  out(`  1º golpe disfarçado: ${got} de dano (normal ~${base}) ${ok(got >= base * 3 * 0.85, `${(got / base).toFixed(1)}×`)} | revelou ${ok(!s.disguise && ev('e2Reveal').length === 1)} | crânio saiu ${ok(!player.model.getObjectByName('E2_Skull'))}`);
  hit(0);
  const got2 = 999 - tgt.hp - got;
  out(`  golpe seguinte: normal (${got2}) ${ok(got2 <= base * 1.25)}`);
  dummy(0.4, 0.6, 'minion', 1); hit(0); yield 0.1;
  out(`  outro abate na mesma onda: sem disfarce ${ok(!s.disguise && ev('e2Disguise').length === 1)}`);
  combat.e2.room++; // onda nova
  dummy(-0.4, 0.6, 'minion', 1); hit(0); yield 0.1;
  out(`  onda nova: disfarça de novo ${ok(!!s.disguise && ev('e2Disguise').length === 2)}`);
  const boss = dummy(4, -4, 'guardian', 4000, false); yield 0.8;
  out(`  chefe não se engana ${ok(boss.state !== 'rogueLost', boss.state)}`);

  // ================= Kunais =================
  out('657) Tempo de Bala: 2 kunais pegas no ar em até 1,5 s -> 5 s de câmera lenta (menos o Ladino)');
  fresh('rogue', 'kunai'); yield 0.1;
  give('w_e2k1');
  combat.e2.onCatch(player); yield 2.0; combat.e2.onCatch(player);
  out(`  2 pegas com 2 s entre elas: nada ${ok(!(combat.e2.slowT > 0))}`);
  const run = dummy(0, -10, 'minion', 999, false);
  yield 0.3;
  const z0 = run.position.z; yield 1.0; const normal = Math.abs(run.position.z - z0);
  e2S(player).catches.length = 0;
  combat.e2.onCatch(player); yield 0.6; combat.e2.onCatch(player);
  out(`  2 pegas em 0,6 s: câmera lenta ${ok(combat.e2.slowT > 0 && ev('e2Bullet').length === 1)} | inimigos a ${combat.e2.foeScale() * 100}% ${ok(combat.e2.foeScale() === E2.bala.scale)} | tela azul ${ok(!!document.querySelector('.e2bt.on'))}`);
  const z1 = run.position.z; yield 1.0; const slow = Math.abs(run.position.z - z1);
  out(`  inimigo andou ${slow.toFixed(2)} m em 1 s (normal ${normal.toFixed(2)}) ${ok(slow < normal * 0.5 && normal > 0.5)}`);
  out('  -> Tempo de Bala (screenshot)'); yield 'hold';
  yield 4.2;
  out(`  acabou depois de 5 s ${ok(!(combat.e2.slowT > 0) && ev('e2BulletEnd').length === 1 && !document.querySelector('.e2bt.on'))}`);
  combat.e2.onCatch(player); yield 0.3; combat.e2.onCatch(player);
  out(`  na mesma onda não repete ${ok(ev('e2Bullet').length === 1)}`);

  // ================= Garras =================
  out('658) Lua Cheia: 20 abates -> a lua chega ao topo e o Ladino vira fera por 8 s');
  fresh('rogue', 'garras'); yield 0.1;
  give('w_e2g1');
  for (let i = 0; i < 10; i++) { dummy(0, 0.6, 'minion', 1); hit(0); }
  yield 0.5;
  const sg = e2S(player);
  out(`  10 abates: lua na metade ${ok(sg.moonK === 10 && !!document.querySelector('.e2moon.on'))}`);
  const flee = dummy(3, -2, 'minion', 999, false), bigB = dummy(-3, -3, 'guardian', 4000, false); bigB.cooldown = 99;
  const mv0 = player.moveMul, at0 = player.atkSpeed;
  for (let i = 0; i < 10; i++) { dummy(0, 0.6, 'minion', 1); hit(0); }
  yield 0.8;
  out(`  20º abate: fera ${ok(sg.beastT > 0 && ev('e2Beast').length === 1)} | lua cheia ${ok(!!document.querySelector('.e2moon.full'))} | maior (${player.model.scale.x.toFixed(2)}) ${ok(Math.abs(player.model.scale.x - E2.lua.scale) < 0.03)} | mais rápido ${ok(Math.abs(player.moveMul / mv0 - E2.lua.move) < 0.01 && Math.abs(player.atkSpeed / at0 - E2.lua.atk) < 0.01)}`);
  out(`  os inimigos fogem ${ok(flee.state === 'axeFear', flee.state)} | chefe não ${ok(bigB.state !== 'axeFear')}`);
  out('  -> Lua Cheia (screenshot)'); yield 'hold';
  player.hp = 20;
  const pre = player.hp; dummy(0, 0.6, 'minion', 999); hit(0);
  out(`  cura a cada golpe (+${player.hp - pre}) ${ok(player.hp - pre === E2.lua.heal)}`);
  yield 8.0;
  out(`  depois de 8 s volta ao normal ${ok(!(sg.beastT > 0) && ev('e2BeastEnd').length === 1 && Math.abs(player.model.scale.x - 1) < 0.03 && e2MoveMul(player) === 1 && e2AtkMul(player) === 1)} | lua recomeça ${ok(sg.moonK === 0)}`);

  out('659) Regeneração: o dano recebido volta aos poucos em 1 minuto');
  fresh('rogue', 'garras'); yield 0.1;
  give('w_e2g2');
  const atk = dummy(0, 0.6, 'minion', 999);
  const full = player.hp;
  for (let k = 0; k < 10 && player.hp === full; k++) { player.iframes = 0; combat.hitPlayer(atk, 20, { target: player }); } // pode desviar por sorte: tenta de novo
  const lost = full - player.hp;
  combat.scene.remove(atk.group); combat.enemies.splice(combat.enemies.indexOf(atk), 1);
  yield 30;
  const mid = player.hp - (full - lost);
  out(`  perdeu ${lost}; em 30 s voltou ${mid} ${ok(lost > 0 && Math.abs(mid - lost / 2) <= 1.5)}`);
  yield 31;
  out(`  em 1 minuto voltou tudo (${player.hp}/${full}) ${ok(player.hp === full)}`);

  // ================= Rapieira =================
  out('660) Destruição: marcou todos da onda -> some e ataca cada um pelas costas');
  fresh('rogue', 'rapieira'); yield 0.1;
  give('w_e2r1');
  const trio = [dummy(-3, -3, 'minion', 999), dummy(3, -4, 'warrior', 999), dummy(0, -7, 'mage', 999)];
  const st = { ...C()[0] };
  strike(trio[0], st); strike(trio[2], st);
  yield 0.2;
  out(`  2 de 3 marcados: nada ${ok(ev('e2Mark').length === 2 && ev('e2Ghost').length === 0)}`);
  const hp3 = trio.map((e) => e.hp);
  trio[1].shieldCovers = () => false;
  strike(trio[1], st);
  yield 0.1;
  out(`  3º marcado: sumiu ${ok(player.state === 'e2Ghost' && ev('e2Ghost').length === 1 && !player.model.visible)} | imune ${ok(player.invulnerable)}`);
  yield* until(() => ev('e2GhostHit').length >= 2, 3000);
  out('  -> Destruição (screenshot)'); yield 'hold';
  yield* until(() => ev('e2GhostEnd').length > 0, 4000);
  const lostHp = trio.map((e, i) => hp3[i] - e.hp);
  out(`  atacou os 3 pelas costas ${ok(ev('e2GhostHit').length === 3 && lostHp.every((d) => d >= C()[2].damage * E2.destruicao.mul * 1.6), lostHp.join('/'))} | voltou a aparecer ${ok(player.model.visible && player.state !== 'e2Ghost')}`);
  for (const e of trio) strike(e, st);
  yield 0.3;
  out(`  na mesma onda não repete ${ok(ev('e2Ghost').length === 1)}`);

  out('661) Ponto Vital: 2 críticos no mesmo inimigo = execução (chefe: -10% da vida máxima)');
  fresh('rogue', 'rapieira'); yield 0.1;
  give('w_e2r2');
  const vt = dummy(0, 0.2, 'warrior', 999); vt.shieldCovers = () => false;
  strike(vt, { ...C()[0] }, { forceCrit: true });
  out(`  1º crítico: vivo ${ok(vt.alive && vt.e2Crits === 1)}`);
  strike(vt, { ...C()[0] }, { forceCrit: true });
  out(`  2º crítico: executado ${ok(!vt.alive && ev('e2Vital').length === 1)}`);
  const vb = dummy(2, -2, 'guardian', 4000); vb.cooldown = 99;
  strike(vb, { ...C()[0] }, { forceCrit: true }); strike(vb, { ...C()[0] }, { forceCrit: true });
  const vbe = ev('e2Vital').find((x) => x.boss);
  out(`  chefe: perdeu 10% (${vbe ? vbe.dmg : '?'}) ${ok(vb.alive && vbe && vbe.dmg === 400)}`);

  // ================= Besta =================
  out('662) Sniper: 20 abates -> na onda seguinte sobe na parede; X vermelho, 8 s por alvo');
  fresh('rogue', 'besta'); yield 0.1;
  give('w_e2b1');
  const sb = e2S(player);
  combat.e2.tick(0); sb.snKills = E2.sniper.kills;
  const foesS = [dummy(-3, -1, 'minion', 60, false), dummy(3, 0, 'minion', 60, false), dummy(0, 3, 'minion', 60, false)];
  combat.e2.room++; // onda nova
  yield 0.1;
  out(`  onda nova: pulou ${ok(player.state === 'e2Snipe' && ev('e2Sniper').length === 1)} | ninguém acerta ${ok(player.invulnerable)}`);
  yield 0.6;
  const S = sb.sn;
  out(`  em cima da parede ${ok(S && S.phase === 'aim' && Math.abs(player.model.position.y - E2.sniper.wallH) < 0.01)} | mira vermelha ${ok(!!(S && S.cross.parent))} | um X ${ok(!!(S && S.target && S.mark))} | a câmera segue a mira ${ok(player.camFocus === (S && S.focus))}`);
  out(`  os inimigos perderam o Ladino ${ok(foesS.filter((e) => e.alive).every((e) => e.state === 'rogueLost'), foesS.map((e) => e.state).join('/'))}`);
  let shoot = false;
  player.input = fake({ attack: () => shoot, device: 'keys' });
  const first = S.target;
  S.aim.set(first.position.x, 0, first.position.z); shoot = true;
  yield 0.05; shoot = false;
  yield 0.2;
  out('  -> Sniper (screenshot)'); yield 'hold';
  out(`  derrubou o X ${ok(!first.alive && S.kills === 1)} | o X passou para outro ${ok(!!S.target && S.target !== first && S.target.alive)} | tempo voltou a 8 s ${ok(S.time > 7.5)}`);
  yield* until(() => ev('e2SniperEnd').length > 0, 10000);
  const dn = ev('e2SniperDown')[0];
  out(`  tempo acabou: desceu ${ok(dn && dn.why === 'tempo' && player.state !== 'e2Snipe')} | no chão ${ok(player.model.position.y === 0)} | câmera de volta ${ok(!player.camFocus)} | contagem zerou ${ok(sb.snKills === 0)}`);
  player.input = realInput;

  out('663) Flecha do Cupido: 2 tiros seguidos em 2 inimigos -> o casal briga com os outros, depois vem atrás de você');
  fresh('rogue', 'besta'); yield 0.1;
  give('w_e2b2');
  const A = dummy(0, -3, 'warrior', 120, false), B = dummy(3, -3, 'warrior', 120, false);
  A.shieldCovers = () => false; B.shieldCovers = () => false;
  const rest = [dummy(-4, -8, 'minion', 10, false), dummy(5, -9, 'minion', 10, false)];
  const shot = function* (e) {
    player.refillAmmo();
    player.facing = Math.atan2(e.position.x - player.position.x, e.position.z - player.position.z); player.group.rotation.y = player.facing;
    hit(0);
    yield 0.4;
  };
  yield* shot(A);
  out(`  1º tiro acertou ${ok(ev('e2CupidArm').length === 1)}`);
  // tiro que erra (para o lado vazio) quebra a sequência
  player.refillAmmo(); player.facing = Math.PI / 2; player.group.rotation.y = player.facing; hit(0);
  yield* until(() => ev('e2CupidMiss').length > 0, 6000);
  yield* shot(B);
  out(`  errou no meio: não apaixona ${ok(ev('e2CupidMiss').length === 1 && ev('e2Love').length === 0)}`);
  yield* shot(A);
  const hpA = A.maxHp;
  out(`  2 seguidos (B depois A): apaixonados ${ok(ev('e2Love').length === 1 && !!A.e2Love && !!B.e2Love)} | mais fortes ${ok(A.dmgScale >= 1.49 && A.hp === A.maxHp && hpA >= 179)} | corações ${ok(!!A.e2Love.g && !!B.e2Love.g)}`);
  out(`  vão atrás dos outros ${ok(rest.includes(combat.pickTarget(A, 0)) && rest.includes(combat.pickTarget(B, 0)))}`);
  out('  -> Cupido (screenshot)'); yield 'hold';
  player.iframes = 99;
  yield* until(() => rest.every((e) => !e.alive), 15000);
  out(`  derrubaram os outros ${ok(rest.every((e) => !e.alive))}`);
  yield 0.3;
  out(`  só sobraram os dois: vêm atrás de você ${ok(ev('e2LoveTurn').length >= 1 && combat.pickTarget(A, 0) === player)}`);
  player.iframes = 0;
}
