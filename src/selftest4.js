// Teste automático, parte 5 (M4): bênçãos novas, andares 2 e 3, espinhos, Mago Esqueleto e o Necromante.
// Chamado por selftest.js (tecla Y = tudo; tecla M = só esta parte, parando nas pausas).
import { BLESSINGS, BLESSING_BY_ID } from './blessings.js';
import { generateFloor } from './dungeon/generator.js';
import { ROOMS } from './dungeon/rooms.js';
import { SPIKES } from './traps.js';

const press = (code) => {
  dispatchEvent(new KeyboardEvent('keydown', { code }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
};
const keyDown = (code) => dispatchEvent(new KeyboardEvent('keydown', { code }));
const keyUp = (code) => dispatchEvent(new KeyboardEvent('keyup', { code }));
const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* m4Tests(g, out, flags) {
  const { player, combat, waves, run, ui } = g;
  const hero = player.hero;
  const fresh = () => { g.restart(); waves.stop(); combat.clear(); waves.paused = true; player.position.set(0, 0, 2); player.facing = Math.PI; flags.events.length = 0; };
  const face = (e) => { player.facing = Math.atan2(e.position.x - player.position.x, e.position.z - player.position.z); };
  const give = (id, n = 1) => { for (let i = 0; i < n; i++) player.addBlessing(BLESSING_BY_ID[id]); };
  const dummy = (x, z, type = 'minion') => combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 });
  const lastDmg = () => { const h = flags.last('hit'); return h ? h.dmg : 0; };

  // ---------------- 20) Bênçãos ----------------
  out('20) Bênçãos (30 no total)');
  fresh();
  const sede = BLESSING_BY_ID.sede;
  out(`  total ${BLESSINGS.length} (30 + 6 arriscadas): ${ok(BLESSINGS.length === 36)} | Sede de Sangue lendária, máx. 1: ${ok(sede.rarity === 'legendary' && sede.max === 1)}`);

  // Lâmina Longa: alcança um esqueleto a 3,6.
  let e = dummy(0, 2 - 3.6);
  face(e);
  combat.playerStrike(player, hero.combo[0]);
  const missed = !flags.last('hit');
  give('alcance', 2); face(e);
  combat.playerStrike(player, hero.combo[0]);
  out(`  Lâmina Longa: sem ela erra ${ok(missed)} | com ela acerta ${ok(!!flags.last('hit'))}`);
  combat.clear(); flags.events.length = 0;

  fresh(); give('ganancia');
  const g0 = run.gold; run.addGold(10, player.position);
  out(`  Ganância: +10 de ouro vira +${run.gold - g0} ${ok(run.gold - g0 === 15)}`);

  fresh(); const p0 = player.potions; give('alquimia');
  player.hp = 10;
  press('KeyQ');
  yield () => player.state !== 'drink' && player.potions === p0;
  yield 0.2;
  out(`  Alquimista: +1 poção ${ok(player.potions === p0)} | poção curou ${player.hp - 10} ${ok(player.hp - 10 === hero.potionHeal + 15)}`);

  fresh(); give('execucao');
  e = dummy(0, 0); e.hp = 5; face(e);
  combat.playerStrike(player, { ...hero.combo[0], damage: 10 });
  out(`  Execução: golpe de 10 num esqueleto quase morto tirou ${lastDmg()} ${ok(lastDmg() >= 13)}`);

  fresh(); give('contra');
  e = dummy(0, 0.2); face(e);
  keyDown('KeyK'); yield 0.3;
  combat.hitPlayer(e, 10);
  keyUp('KeyK'); yield 0.3;
  const ready = player.counterReady;
  e.hp = 999; face(e);
  combat.playerStrike(player, { ...hero.combo[0], damage: 10 });
  out(`  Contra-Ataque: bloqueou -> pronto ${ok(ready)} | próximo golpe tirou ${lastDmg()} ${ok(lastDmg() >= 18)} | gastou ${ok(!player.counterReady)}`);

  fresh(); give('reflexo');
  e = dummy(0, -1);
  const sp0 = player.atkSpeed;
  press('Space'); yield 0.05;
  combat.hitPlayer(e, 10);
  out(`  Reflexo: escapou rolando -> golpes ${sp0.toFixed(2)} -> ${player.atkSpeed.toFixed(2)} ${ok(player.atkSpeed > sp0 + 0.25)}`);
  yield 0.5;

  fresh(); give('eco');
  const far = dummy(0, 2 - 7); far.hp = 999;
  player.facing = Math.PI;
  combat.playerStrike(player, hero.combo[2]);
  const waveOut = combat.projectiles.list.some((a) => a.kind === 'wave');
  yield () => flags.last('bonus');
  out(`  Eco do Golpe: onda saiu ${ok(waveOut)} | acertou o esqueleto a 7 ${ok(!!flags.last('bonus'), flags.last('bonus') ? `-${flags.last('bonus').dmg}` : '')}`);

  fresh(); give('raio'); player.stats.critChance = 1;
  const r1 = dummy(0, 0), r2 = dummy(2.5, -1.5), r3 = dummy(-2.5, -2.5);
  [r1, r2, r3].forEach((x) => { x.hp = 999; });
  face(r1);
  player.position.set(0, 0, 2.2);
  combat.playerStrike(player, hero.combo[0]);
  out(`  Corrente de Raios: crítico pulou para ${flags.events.filter((x) => x.type === 'bonus').length} esqueletos ${ok(flags.events.filter((x) => x.type === 'bonus').length === 2)} -> CONGELADO (T continua)`);
  yield 0.05;
  yield 'hold';

  fresh(); give('explosao');
  const k1 = dummy(0, 0), k2 = dummy(2.2, -1.6);
  k2.hp = 999; k1.hp = 1; face(k1);
  combat.playerStrike(player, hero.combo[0]);
  out(`  Ossos Explosivos: morto explodiu e acertou o vizinho ${ok(k2.hp < 999, `-${999 - k2.hp}`)}`);

  fresh(); give('espectral');
  e = dummy(0, -1);
  yield 0.1;
  const hpA = player.hp;
  const r = combat.hitPlayer(e, 20);
  const hpB = player.hp;
  yield 0.6;
  combat.hitPlayer(e, 20);
  out(`  Escudo Espectral: 1º golpe anulado ${ok(r === false && hpB === hpA)} | 2º golpe machuca ${ok(player.hp < hpB)} | recarga ${player.spectralCd.toFixed(0)} s`);

  fresh(); give('furia');
  e = dummy(0, 0); e.hp = 999; face(e);
  player.hp = Math.round(player.maxHp * 0.3);
  combat.playerStrike(player, { ...hero.combo[0], damage: 10 });
  out(`  Fúria: com pouca vida o golpe de 10 tirou ${lastDmg()} ${ok(lastDmg() >= 14)} | anda ${player.moveMul.toFixed(2)}x ${ok(player.moveMul > 1.15)}`);

  fresh(); give('ceifador');
  for (let i = 0; i < 5; i++) { const d = dummy(i * 2 - 4, -4); d.die(); combat.killed(d, 0, 1); }
  out(`  Ceifador: 5 mortes -> +${player.stats.reaperStacks * 2}% de dano ${ok(player.stats.reaperStacks === 5)}`);

  fresh(); give('folego');
  player.hp = 50;
  run.enter({ kind: 'combat', reward: 'gold', room: 'guarita', waves: [[['minion', 1]]], level: 1 }, true);
  waves.stop();
  out(`  Fôlego: entrou na sala e curou ${player.hp - 50} ${ok(player.hp - 50 === 8)}`);

  fresh(); give('sede');
  player.hp = 50;
  e = dummy(0, 0); e.die(); combat.killed(e, 0, 1);
  out(`  Sede de Sangue (lendária): matou -> +${player.hp - 50} ${ok(player.hp === 53)}`);

  // ---------------- 21) Andares ----------------
  out('21) Andares 2 e 3');
  let bad = 0, mages = 0;
  for (let i = 0; i < 20; i++) {
    const f2 = generateFloor(2);
    for (const n of [f2.first, ...f2.steps.flat()]) {
      if (n.kind === 'combat' && !['cripta_entrada', 'cemiterio', 'ossario', 'caixoes', 'capela', 'corredor', 'tumulos'].includes(n.room)) bad++;
      if (n.waves) for (const w of n.waves) for (const [t] of w) if (t === 'mage') mages++;
    }
    // Andar 2 termina com o Necromante e depois a descida.
    const l2 = f2.steps.length;
    if (f2.steps[l2 - 2][0].kind !== 'boss' || f2.steps[l2 - 2][0].waves[0][0][0] !== 'necromancer' || f2.steps[l2 - 1][0].kind !== 'exit') bad++;
    // Andar 3: completo (entrada + 4 escolhas) e o Ceifador no fim; Assassinos nas ondas.
    const f3 = generateFloor(3);
    const last = f3.steps[f3.steps.length - 1][0];
    if (last.kind !== 'boss' || last.waves[0][0][0] !== 'reaper' || f3.steps.length !== 5) bad++;
    for (const n of [f3.first, ...f3.steps.flat()]) if (n.kind === 'combat' && !(n.room === 'antessala' || n.room.startsWith('s_'))) bad++;
    if (![f3.first, ...f3.steps.flat()].some((n) => n.waves && n.waves.some((w) => w.some(([t]) => t === 'assassin')))) bad++;
  }
  out(`  andar 2 (Cripta + Necromante) e andar 3 (sombras + Ceifador): ${ok(bad === 0, `${bad}`)} | Magos nas ondas: ${ok(mages > 0, `${mages}`)}`);
  fresh();
  give('forca');
  player.hp = 77; run.gold = 42;
  run.nextFloor();
  out(`  desceu: Andar ${run.floorNum} "${run.built.room.name}" ${ok(run.floorNum === 2)} | vida 77 ${ok(player.hp === 77)} | ouro 42 ${ok(run.gold === 42)} | bênção ${ok(player.blessings.forca === 1)}`);
  yield 1.5;
  out('  -> Portões da Cripta: CONGELADO (T continua)');
  yield 'hold';
  // Salas da Cripta montam sem erro e com os espinhos certos.
  let spikeBad = 0;
  for (const id of ['cemiterio', 'ossario', 'caixoes', 'capela', 'corredor', 'tumulos', 'catacumba', 'antessala', 'trono', 's_catacumba', 'santuario', 's_guarita']) {
    run.enter({ kind: 'combat', reward: 'gold', room: id, waves: [[['minion', 1]]], level: 1 }, true);
    waves.stop();
    if (run.built.spikes.length !== (ROOMS[id].spikes || []).length || run.built.spikes.some((s) => !s.obj)) spikeBad++;
    // A recompensa não pode cair em cima de um espinho nem dentro de um obstáculo.
    const rw = run.built.reward;
    if (run.built.spikes.some((s) => Math.abs(rw.x - s.x) < 2 && Math.abs(rw.z - s.z) < 2) || g.combat.world.blocked(rw.x, rw.z, 0.6)) { spikeBad++; out(`  ERRO recompensa em lugar ruim: ${id}`); }
    // Entrada livre.
    if (g.combat.world.blocked(run.built.entrance.x, run.built.entrance.z, 0.8)) { spikeBad++; out(`  ERRO entrada bloqueada: ${id}`); }
    yield 0.05;
  }
  out(`  12 salas montadas, espinhos/recompensa/entrada: ${ok(spikeBad === 0, `${spikeBad}`)}`);

  // ---------------- 22) Espinhos ----------------
  out('22) Armadilhas de espinho');
  fresh();
  run.nextFloor(2);
  run.enter({ kind: 'combat', reward: 'gold', room: 'corredor', waves: [[['minion', 1]]], level: 1 }, true);
  waves.stop(); combat.clear();
  const sp = run.built.spikes[3];
  player.position.set(sp.x, 0, sp.z); player.facing = Math.PI;
  player.hp = player.maxHp;
  flags.events.length = 0;
  yield () => flags.last('spike');
  const sh = flags.last('spike');
  out(`  herói em cima: machucou ${ok(sh && sh.hurt, `vida ${player.hp}/${player.maxHp}`)}`);
  yield 0.25;
  out('  -> espinhos levantados: CONGELADO (T continua)');
  yield 'hold';
  // Rolando por cima: passa ileso.
  const sp2 = run.built.spikes[5];
  player.iframes = 0; player.hp = player.maxHp; flags.events.length = 0;
  yield () => !sp2.up;
  yield () => sp2.up;   // espera subir, rola atravessando
  player.position.set(sp2.x - 4, 0, sp2.z); player.facing = Math.PI / 2;
  keyDown('KeyD'); press('Space'); yield 0.26; keyUp('KeyD');
  yield 0.4;
  out(`  rolando por cima: sem dano ${ok(player.hp === player.maxHp, `vida ${player.hp}`)}`);
  // Esqueleto em cima: leva 20.
  const sp3 = run.built.spikes[0];
  player.position.set(sp3.x + 8, 0, sp3.z + 5);
  const vic = dummy(sp3.x, sp3.z); vic.hp = 999;
  yield () => vic.hp < 999;
  out(`  esqueleto em cima: -${999 - vic.hp} ${ok(999 - vic.hp === SPIKES.enemyDamage)}`);
  combat.clear();

  // ---------------- 23) Mago Esqueleto ----------------
  out('23) Mago Esqueleto');
  fresh();
  run.nextFloor(2);
  waves.stop(); combat.clear();
  player.position.set(0, 0, 4); player.hp = player.maxHp; player.stats.bonusHp = 500; player.hp = player.maxHp;
  const mg = combat.spawn('mage', 0, -6, { awake: true, facing: 0 });
  for (const k in mg.cd) mg.cd[k] = 99;
  mg.cooldown = 0;
  yield () => combat.projectiles.list.some((a) => a.kind === 'orb');
  yield 0.25;
  out(`  lançou orbe: ${ok(combat.projectiles.list.some((a) => a.kind === 'orb'))} -> CONGELADO (T continua)`);
  yield 'hold';
  yield () => flags.last('arrow');
  const orbHit = flags.last('arrow');
  out(`  orbe acertou o herói: ${ok(orbHit && orbHit.owner === mg)}`);
  // Reviver: mata um lacaio perto do mago e deixa ele reviver.
  mg.cooldown = 99;
  const fall = combat.spawn('minion', 3, -5, { awake: true, passive: true });
  fall.die(); combat.killed(fall, 0, 1);
  out(`  restos no chão: ${ok(combat.graves.length === 1)}`);
  yield 1.5;
  mg.cd.revive = 0;
  yield () => flags.last('revived');
  const rv = flags.last('revived');
  out(`  Mago reviveu o lacaio: ${ok(!!rv && rv.enemy.type === 'minion' && rv.enemy.revived)}`);
  yield 0.5;
  out('  -> esqueleto voltando à vida: CONGELADO (T continua)');
  yield 'hold';
  yield () => !rv || rv.enemy.state !== 'spawn';
  rv.enemy.die(); combat.killed(rv.enemy, 0, 1);
  out(`  revivido não deixa restos de novo: ${ok(combat.graves.length === 0)}`);
  combat.clear();

  // ---------------- 24) O Necromante ----------------
  out('24) O Necromante');
  fresh();
  g.gotoBoss(2);
  out(`  Andar 2: "${run.built.room.name}" ${ok(run.built.room.name === 'Salão do Necromante')}`);
  player.stats.bonusHp = 3000; player.hp = player.maxHp;
  waves.paused = false;
  yield () => combat.enemies.some((x) => x.type === 'necromancer');
  const nc = combat.enemies.find((x) => x.type === 'necromancer');
  for (const k in nc.cd) nc.cd[k] = 99;
  nc.cooldown = 99;
  yield () => nc.state !== 'spawn';
  yield 0.3;
  out(`  apareceu: vida ${nc.hp} | barra de chefe ${ok(g.hud.boss === nc)} | porta de descida ${ok(run.built.doors.length === 1)} -> CONGELADO (T continua)`);
  yield 'hold';
  // Fase 1: orbes em leque.
  nc.position.set(0, 0, -8);
  player.position.set(0, 0, 2);
  nc.cooldown = 0;
  yield () => combat.projectiles.list.filter((a) => a.kind === 'orb').length >= 3;
  out(`  orbes em leque: ${combat.projectiles.list.filter((a) => a.kind === 'orb').length} ${ok(combat.projectiles.list.filter((a) => a.kind === 'orb').length >= 3)}`);
  nc.cooldown = 99;
  yield 1.5;
  // Some quando o herói chega perto.
  const before = { x: nc.position.x, z: nc.position.z };
  nc.cd.teleport = 0;
  player.position.set(nc.position.x + 2.6, 0, nc.position.z + 0.5);
  yield () => nc.state === 'tpIn';
  yield () => nc.state === 'chase';
  const moved = Math.hypot(nc.position.x - before.x, nc.position.z - before.z);
  const pd = Math.hypot(nc.position.x - player.position.x, nc.position.z - player.position.z);
  out(`  sumiu e apareceu longe: andou ${moved.toFixed(1)} ${ok(moved > 4)} | longe do herói ${pd.toFixed(1)} ${ok(pd > 6)}`);
  for (const k in nc.cd) nc.cd[k] = 99;
  // Invoca.
  const before2 = combat.enemies.length;
  nc.cd.summon = 0;
  yield () => combat.enemies.length >= before2 + 3;
  out(`  invocou: ${combat.enemies.length - before2} ${ok(combat.enemies.length - before2 >= 3)}`);
  nc.cd.summon = 99;
  yield 1.5;
  // Revive os caídos (mata os invocados).
  combat.enemies.filter((x) => x !== nc && x.alive && x.targetable).forEach((x) => { x.die(); combat.killed(x, 0, 1); });
  const gr = combat.graves.length;
  yield 1.4;
  nc.cd.revive = 0;
  yield () => flags.last('revived');
  yield 0.3;
  const nRev = flags.events.filter((x) => x.type === 'revived').length;
  out(`  reviveu os caídos: ${nRev} de ${gr} ${ok(nRev >= 2)}`);
  nc.cd.revive = 99;
  yield 1.2;
  combat.enemies.filter((x) => x !== nc && x.alive).forEach((x) => { x.noGrave = true; x.die(); combat.killed(x, 0, 1); });
  yield 1.4;
  // Fase 2.
  nc.hp = Math.round(nc.maxHp * 0.6);
  yield () => flags.last('phase');
  out(`  fase 2 com 60%: ${ok(flags.last('phase')?.phase === 2)}`);
  yield () => nc.state === 'chase';
  for (const k in nc.cd) nc.cd[k] = 99;
  nc.cooldown = 99;
  player.position.set(0, 0, 4); player.iframes = 0;
  nc.cd.rain = 0;
  yield () => combat.projectiles.drops.length > 0;
  yield 0.5;
  out(`  chuva de crânios: ${combat.projectiles.drops.length} caindo -> CONGELADO (T continua)`);
  yield 'hold';
  yield () => flags.last('rainHit');
  out(`  crânio acertou o herói: ${ok(!!flags.last('rainHit'))}`);
  nc.cd.rain = 99;
  yield 2.0;
  combat.projectiles.clear();
  // Conta os orbes disparados (os que saem perto de uma parede somem na hora; contar a lista falhava às vezes).
  let fired = 0;
  const fire0 = combat.projectiles.fire;
  combat.projectiles.fire = function (...a) { if (a[3] && a[3].owner === nc) fired++; return fire0.apply(this, a); };
  yield () => nc.state === 'chase';
  nc.cd.ring = 0;
  yield () => fired >= 14;
  combat.projectiles.fire = fire0;
  out(`  anel de orbes: ${fired} ${ok(fired >= 14)}`);
  nc.cd.ring = 99;
  yield 1.5;
  // Fase 3: cresce e explode de perto.
  nc.hp = Math.round(nc.maxHp * 0.3);
  yield () => flags.events.filter((x) => x.type === 'phase').length >= 2;
  yield () => nc.state === 'chase';
  out(`  fase 3 com 30%: cresceu para ${nc.group.scale.x.toFixed(1)} ${ok(nc.group.scale.x > 2.5)} -> CONGELADO (T continua)`);
  yield 'hold';
  for (const k in nc.cd) nc.cd[k] = 99;
  nc.cooldown = 99;
  player.iframes = 0; flags.events.length = 0;
  nc.cd.nova = 0;
  player.position.set(nc.position.x + 3, 0, nc.position.z + 1);
  yield () => flags.last('heroHit') || nc.state === 'tpOut';
  yield () => nc.state === 'tpOut' || nc.state === 'tpIn'; // some 0,3 s depois da explosão
  out(`  explosão de perto: ${ok(!!flags.last('heroHit'))} e depois sumiu ${ok(nc.state === 'tpOut' || nc.state === 'tpIn')}`);
  yield 1.0;
  // Morte: os invocados desmoronam e aparece a vitória.
  nc.cd.summon = 0;
  yield () => combat.enemies.length > 1;
  yield 1.2;
  for (const k in nc.cd) nc.cd[k] = 99;
  yield () => nc.targetable;
  nc.hp = 1; nc.state = 'chase';
  face(nc); player.position.set(nc.position.x, 0, nc.position.z + 3); face(nc);
  combat.playerStrike(player, hero.combo[0]);
  out(`  Necromante morreu: ${ok(!nc.alive)} | invocados desmoronaram: ${ok(combat.aliveCount === 0)}`);
  yield () => run.pickups.length > 0;
  yield 0.6;
  out(`  andar 2: sem tela de vitória ${ok(!ui.winVisible)} | bênção e ouro do chefe ${ok(run.pickups.some((p) => p.kind === 'blessing') && run.pickups.some((p) => p.kind === 'gold'))} -> CONGELADO (T continua)`);
  yield 'hold';
  player.stats.bonusHp = 0;
}
