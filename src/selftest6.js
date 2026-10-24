// Teste automático, parte 6: escudo que quebra, Rei Skullbone imune indo para o meio da sala,
// Assassino Sombrio e o Ceifador Sombrio (chefe final). Tecla Y = tudo; tecla 6 = só esta parte.
import { BLESSING_BY_ID } from './blessings.js';
import { startRage } from './abilities.js';
import { shieldMax } from './shield.js';

const keyDown = (code) => dispatchEvent(new KeyboardEvent('keydown', { code }));
const keyUp = (code) => dispatchEvent(new KeyboardEvent('keyup', { code }));
const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* shadowTests(g, out, flags) {
  const { player, combat, waves, run, ui } = g;
  const hero = player.hero;
  const fresh = () => { g.restart(); waves.stop(); combat.clear(); waves.paused = true; player.position.set(0, 0, 2); player.facing = Math.PI; flags.events.length = 0; };
  const face = (e) => { player.facing = Math.atan2(e.position.x - player.position.x, e.position.z - player.position.z); };
  const give = (id) => player.addBlessing(BLESSING_BY_ID[id]);
  const dummy = (x, z, type = 'minion') => combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 });
  const count = (t) => flags.events.filter((x) => x.type === t).length;

  // ---------------- 29) Escudo ----------------
  out('29) Escudo: bloqueia 100%, quebra com 10 bloqueios');
  fresh();
  let e = dummy(0, 0.4);
  face(e);
  keyDown('KeyK'); yield 0.35;
  const hp0 = player.hp;
  combat.hitPlayer(e, 30);
  out(`  bloqueou 30 de dano: vida ${hp0} -> ${player.hp} ${ok(player.hp === hp0)} | escudo ${player.shield}/${shieldMax(player)} ${ok(player.shield === 9)}`);
  for (let i = 0; i < 8; i++) { player.iframes = 0; face(e); combat.hitPlayer(e, 10); yield 0.05; }
  out(`  9 bloqueios: escudo ${player.shield} ${ok(player.shield === 1)} | inteiro na mão ${ok(player.shieldMesh.visible)}`);
  face(e); combat.hitPlayer(e, 10);
  out(`  10º bloqueio quebrou: ${ok(player.shield === 0 && !!flags.last('shieldBreak'))} | some da mão ${ok(!player.shieldMesh.visible)} | vida intacta ${ok(player.hp === hp0)}`);
  yield 0.6;
  out(`  quebrado não bloqueia (segurando K): estado ${player.state} ${ok(player.state !== 'block')}`);
  player.iframes = 0;
  const hp1 = player.hp;
  face(e); combat.hitPlayer(e, 10);
  out(`  sem escudo apanha: -${hp1 - player.hp} ${ok(player.hp === hp1 - 10)} -> CONGELADO (T continua)`);
  keyUp('KeyK');
  yield 'hold';
  // A cama conserta.
  run.enter({ kind: 'rest', reward: 'rest', room: 'descanso' }, true);
  yield 0.2;
  const bed = run.pickups.find((p) => p.kind === 'bed');
  run.take(bed, player);
  out(`  descansar na cama conserta: escudo ${player.shield}/${shieldMax(player)} ${ok(player.shield === shieldMax(player))}`);
  // Bênçãos de escudo.
  fresh(); player.shield = 2; give('reforco');
  out(`  Escudo Reforçado: máximo ${shieldMax(player)} ${ok(shieldMax(player) === 14)} | consertou ${ok(player.shield === 14)}`);
  fresh(); give('aparar');
  e = dummy(0, 0.4); face(e);
  keyDown('KeyK'); yield 0.05;
  combat.hitPlayer(e, 10);
  const parried = flags.last('blockedHero')?.res === 'parry';
  yield 0.4; player.iframes = 0; face(e);
  combat.hitPlayer(e, 10);
  keyUp('KeyK');
  out(`  Aparar: no instante certo não gasta ${ok(parried)} | depois gasta normal ${ok(player.shield === 9, `${player.shield}`)}`);
  fresh(); give('estilhacos');
  e = dummy(0, 0.4); const near = dummy(2, 1.5); near.hp = 999; face(e);
  keyDown('KeyK'); yield 0.35;
  player.shield = 1; face(e);
  combat.hitPlayer(e, 10);
  keyUp('KeyK');
  out(`  Estilhaços: quebrou e explodiu, vizinho -${999 - near.hp} ${ok(near.hp < 999)}`);
  fresh(); give('forja'); player.shield = 0;
  yield 6.3;
  out(`  Forja Viva: 6 s depois de quebrar, escudo ${player.shield} ${ok(player.shield === 1)}`);
  fresh(); give('mitral'); give('mitral');
  e = dummy(0, 0.4); face(e);
  keyDown('KeyK'); yield 0.35;
  for (let i = 0; i < 10; i++) { face(e); combat.hitPlayer(e, 5); yield 0.02; }
  keyUp('KeyK');
  out(`  Placas de Mitral (50%): 10 bloqueios gastaram ${10 - player.shield} ${ok(player.shield > 0 && player.shield < 10)}`);
  out(`  Eco do Golpe lendário: ${ok(BLESSING_BY_ID.eco.rarity === 'legendary')} | Ossos Explosivos e Corrente de Raios lendários ${ok(BLESSING_BY_ID.explosao.rarity === 'legendary' && BLESSING_BY_ID.raio.rarity === 'legendary')}`);

  // ---------------- 30) Rei Skullbone imune ----------------
  out('30) Rei Skullbone imune indo para o meio da sala');
  fresh();
  run.enter({ kind: 'combat', reward: 'gold', room: 'salao', waves: [[['minion', 1]]], level: 1 }, true);
  waves.stop(); combat.clear();
  player.stats.bonusHp = 3000; player.hp = player.maxHp;
  const boss = combat.spawn('guardian', 10, 6, { awake: true, facing: 0 });
  startRage(boss, combat);
  yield () => boss.state === 'chase';
  for (const k in boss.cd) boss.cd[k] = 99;
  boss.cooldown = 99;
  player.position.set(boss.position.x - 3, 0, boss.position.z);
  boss.cd.spin = 0;
  yield () => boss.state === 'spinMove';
  yield 0.1;
  const bh = boss.hp;
  player.position.set(boss.position.x - 3, 0, boss.position.z); face(boss);
  combat.playerStrike(player, hero.combo[2]);
  out(`  andando para o meio: imune ${ok(boss.hp === bh && !!flags.last('immune'))} | bolha brilhando ${ok(!!boss.bubble)} -> CONGELADO (T continua)`);
  yield 'hold';
  yield () => boss.state !== 'spinMove';
  yield 0.1;
  const bh2 = boss.hp;
  player.position.set(boss.position.x - 3, 0, boss.position.z); face(boss);
  combat.playerStrike(player, hero.combo[2]);
  out(`  chegou ao meio (${boss.state}): volta a levar dano ${ok(boss.hp < bh2, `-${bh2 - boss.hp}`)}`);
  combat.clear();
  player.stats.bonusHp = 0;

  // ---------------- 31) Assassino Sombrio ----------------
  out('31) Assassino Sombrio (andar 3)');
  fresh();
  run.enter({ kind: 'combat', reward: 'gold', room: 's_pilares', waves: [[['minion', 1]]], level: 1 }, true);
  waves.stop(); combat.clear();
  player.stats.bonusHp = 500; player.hp = player.maxHp;
  player.position.set(0, 0, 4); player.facing = Math.PI;
  let a = combat.spawn('assassin', 0, -4, { awake: true, facing: 0 });
  for (const k in a.cd) a.cd[k] = 99;
  a.cooldown = 99;
  a.cd.vanish = 0;
  yield () => a.state === 'stalk';
  yield 0.3;
  out(`  sumiu: quase invisível ${ok(a.alpha < 0.2, a.alpha.toFixed(2))} -> CONGELADO (T continua)`);
  yield 'hold';
  yield () => a.state === 'ambushWind';
  const back = Math.atan2(a.position.x - player.position.x, a.position.z - player.position.z);
  const diff = Math.abs(Math.atan2(Math.sin(back - player.facing - Math.PI), Math.cos(back - player.facing - Math.PI)));
  out(`  apareceu nas costas do herói ${ok(diff < 1.2, `${Math.round(diff * 57)}°`)}`);
  flags.events.length = 0;
  yield () => flags.last('heroHit') || a.state === 'chase';
  out(`  golpe duplo acertou ${ok(!!flags.last('heroHit'), flags.last('heroHit') ? `-${flags.last('heroHit').dmg}` : '')} | voltou a aparecer ${ok(a.alpha === 1)}`);
  // Acertar enquanto invisível revela.
  for (const k in a.cd) a.cd[k] = 99;
  yield () => a.state === 'chase';
  a.cooldown = 99; a.cd.vanish = 0;
  player.position.set(a.position.x, 0, a.position.z + 6);
  yield () => a.state === 'stalk';
  yield 0.1;
  player.position.set(a.position.x, 0, a.position.z + 1.8); face(a);
  combat.playerStrike(player, hero.combo[0]);
  out(`  acertado invisível: revelou e atordoou ${ok(a.alpha === 1 && a.state === 'hurt', `${a.state}`)}`);
  combat.clear();
  player.stats.bonusHp = 0;

  // ---------------- 32) Ceifador Sombrio ----------------
  out('32) O Ceifador Sombrio (chefe final)');
  fresh();
  g.gotoBoss(3);
  player.stats.bonusHp = 5000; player.hp = player.maxHp;
  waves.paused = false;
  yield () => combat.enemies.some((x) => x.type === 'reaper');
  const rp = combat.enemies.find((x) => x.type === 'reaper');
  for (const k in rp.cd) rp.cd[k] = 99;
  rp.cooldown = 99;
  yield () => rp.state !== 'spawn';
  yield 0.3;
  out(`  "${run.built.room.name}": ${ok(run.built.room.name === 'Santuário do Ceifador')} | sem saída ${ok(run.built.doors.length === 0)} | barra ${ok(g.hud.boss === rp)} | vida ${rp.hp} -> CONGELADO (T continua)`);
  yield 'hold';
  // Sombra: afunda e sai nas costas.
  player.position.set(0, 0, 6); player.facing = Math.PI;
  rp.position.set(0, 0, -6);
  rp.cd.shade = 0;
  yield () => rp.state === 'shadeOut';
  yield 0.3;
  const hidden = !rp.targetable;
  yield () => rp.state === 'attack';
  const db = Math.hypot(rp.position.x - player.position.x, rp.position.z - player.position.z);
  out(`  afundou na sombra (não dá para acertar) ${ok(hidden)} | saiu perto das costas ${ok(db < 5, db.toFixed(1))}`);
  yield () => rp.state === 'chase';
  for (const k in rp.cd) rp.cd[k] = 99;
  rp.cooldown = 99;
  // Cortes longos.
  combat.projectiles.clear();
  player.position.set(rp.position.x > 0 ? rp.position.x - 13 : rp.position.x + 13, 0, rp.position.z); // longe: as ondas não somem no herói
  rp.cd.reap = 0;
  yield () => combat.projectiles.list.filter((x) => x.kind === 'wave').length >= 5;
  out(`  cortes longos: ${combat.projectiles.list.filter((x) => x.kind === 'wave').length} ondas ${ok(combat.projectiles.list.filter((x) => x.kind === 'wave').length >= 5)} -> CONGELADO (T continua)`);
  yield 'hold';
  yield () => rp.state === 'chase';
  for (const k in rp.cd) rp.cd[k] = 99;
  combat.projectiles.clear();
  // Cópias.
  rp.cd.clones = 0;
  yield () => combat.enemies.filter((x) => x.type === 'reaperClone' && x.alive).length >= 2;
  yield 1.4;
  const clones = combat.enemies.filter((x) => x.type === 'reaperClone' && x.alive);
  out(`  cópias: ${clones.length} ${ok(clones.length === 2)} | todos soltam cortes ${ok(clones.every((c) => c.reaped) && rp.reaped >= 2)} -> CONGELADO (T continua)`);
  yield 'hold';
  const gold0 = player.gold, kills0 = combat.kills;
  const c1 = clones[0];
  player.position.set(c1.position.x, 0, c1.position.z + 3); face(c1);
  combat.playerStrike(player, hero.combo[0]);
  out(`  cópia sumiu com 1 golpe ${ok(!c1.alive)} | sem ouro ${ok(player.gold === gold0 && combat.kills === kills0)}`);
  yield 5; yield 5;
  out(`  outra cópia sumiu sozinha com o tempo ${ok(!clones[1].alive)}`);
  combat.projectiles.clear();
  // Fase 2.
  for (const k in rp.cd) rp.cd[k] = 99;
  rp.cooldown = 99;
  yield () => rp.state === 'chase';
  rp.hp = Math.round(rp.maxHp * 0.45);
  yield () => flags.last('phase');
  yield () => rp.state === 'chase';
  for (const k in rp.cd) rp.cd[k] = 99;
  rp.cooldown = 99;
  player.position.set(rp.position.x > 0 ? rp.position.x - 13 : rp.position.x + 13, 0, rp.position.z);
  rp.cd.reap = 0;
  yield () => combat.projectiles.list.filter((x) => x.kind === 'wave').length >= 12;
  out(`  fase 2 (A Colheita) ${ok(flags.last('phase')?.phase === 2)} | cortes em círculo: ${combat.projectiles.list.length} ${ok(combat.projectiles.list.length >= 12)}`);
  yield () => rp.state === 'chase';
  for (const k in rp.cd) rp.cd[k] = 99;
  rp.cd.clones = 0;
  yield () => combat.enemies.filter((x) => x.type === 'reaperClone' && x.alive).length >= 3;
  out(`  fase 2: 3 cópias ${ok(true)}`);
  yield 0.5;
  for (const k in rp.cd) rp.cd[k] = 99;
  yield () => rp.targetable && rp.state === 'chase';
  rp.hp = 1;
  player.position.set(rp.position.x, 0, rp.position.z + 3); face(rp);
  combat.playerStrike(player, hero.combo[0]);
  out(`  Ceifador morreu ${ok(!rp.alive)} | cópias sumiram ${ok(combat.enemies.every((x) => !x.alive))}`);
  yield () => ui.winVisible;
  yield 0.6;
  out(`  tela de vitória ${ok(ui.winVisible)} -> CONGELADO (T continua)`);
  yield 'hold';
  player.stats.bonusHp = 0;
  dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
  dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter' }));
  yield 0.3;
  void count;
}
