// Teste automático, parte 4: regras novas (poção inicial, bênção por sala, portas, parede da frente)
// e o Mercador que revida. Chamado por selftest.js.
import { generateFloor } from './dungeon/generator.js';

const press = (code) => {
  dispatchEvent(new KeyboardEvent('keydown', { code }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
};

export function* newRulesTests(g, out, flags) {
  const { player, combat, waves, run, ui } = g;
  const killAll = () => combat.enemies.forEach((e) => { if (e.alive && e.targetable) { e.die(); combat.killed(e, 0, 1); } });
  const clearRoomNow = function* () { for (let i = 0; i < 4 && waves.active; i++) yield () => { killAll(); return !waves.active; }; };

  out('18) Regras novas');
  g.restart();
  out(`  começa com 1 poção: ${player.potions === 1 ? '✔' : `ERRO (${player.potions})`}`);
  let bad = 0, specials = 0;
  for (let i = 0; i < 30; i++) {
    for (const st of generateFloor().steps) for (const n of st) {
      if (n.reward === 'blessing') bad++;
      if ((n.kind === 'treasure' || n.kind === 'merchant') && !n.waves) bad++;
      if (n.kind === 'rest' && n.waves) bad++;
      if (n.kind !== 'combat') specials++;
    }
  }
  out(`  portas sem "Bênção", tesouro/mercador com combate, descanso sem: ${bad === 0 ? '✔' : `ERRO ${bad}`} (${specials} especiais)`);

  // Porta de poção: combate, depois bênção + 1 poção.
  run.enter({ kind: 'combat', reward: 'potion', room: 'guarita', waves: [[['minion', 1]]], level: 1 }, true);
  yield* clearRoomNow();
  yield 0.3;
  const pot = run.pickups.find((p) => p.kind === 'potion');
  out(`  sala limpa deu bênção: ${run.pickups.some((p) => p.kind === 'blessing') ? '✔' : 'ERRO'} | poção x${pot ? pot.opts.amount : 0} ${pot && pot.opts.amount === 1 ? '✔' : 'ERRO'}`);
  if (pot) {
    const p0 = player.potions;
    player.position.copy(pot.pos);
    yield 0.2;
    out(`  pegou: poções ${p0} -> ${player.potions} ${player.potions === p0 + 1 ? '✔' : 'ERRO'}`);
  }
  if (ui.modal) { press('Digit1'); yield 0.2; }

  // Parede da frente inteira some com o herói ou um inimigo perto dela.
  waves.stop();
  combat.clear();
  const hd = run.built.halfD;
  player.position.set(0, 0, 0);
  yield 0.6;
  const vis0 = !run.built.frontHidden;
  const en = combat.spawn('minion', 6, hd - 1.6, { awake: true, facing: Math.PI, passive: true });
  yield 0.6;
  const hidEnemy = run.built.frontHidden;
  out(`  parede da frente: visível ${vis0 ? '✔' : 'ERRO'} | inimigo perto -> some inteira ${hidEnemy ? '✔' : 'ERRO'} -> CONGELADO (T continua)`);
  yield 'hold';
  en.die(); combat.killed(en, 0, 1);
  yield 1.5;
  const vis1 = !run.built.frontHidden;
  player.position.set(-6, 0, hd - 2);
  yield 0.6;
  out(`  volta sem ninguém: ${vis1 ? '✔' : 'ERRO'} | herói perto -> some ${run.built.frontHidden ? '✔' : 'ERRO'}`);

  out('19) Mercador revida');
  player.reset(0, 0);
  player.hp = player.maxHp;
  waves.paused = true;
  run.enter({ kind: 'merchant', reward: 'merchant', room: 'mercador', waves: [[['minion', 1]]], level: 1 }, true);
  const m = run.npc;
  yield 0.5;
  // a) Herói bate no mercador -> leva flechada.
  flags.events.length = 0;
  player.position.set(m.position.x + 1.9, 0, m.position.z);
  player.facing = -Math.PI / 2;
  yield 0.1;
  press('KeyJ');
  yield () => flags.last('merchantHit');
  const mh = flags.last('merchantHit');
  out(`  herói bateu: ${mh && mh.byPlayer ? `✔ -${mh.dmg} (vida ${m.hp})` : 'ERRO'}`);
  player.position.set(m.position.x + 4, 0, m.position.z + 5);
  yield () => flags.events.some((e) => e.type === 'arrow' && e.merchant);
  const hh = flags.last('heroHit');
  out(`  mercador atirou no herói: ${m.shots >= 1 && hh ? `✔ -${hh.dmg}` : 'ERRO'}`);
  yield 0.8;

  // b) Esqueleto bate no mercador -> flecha nele, atravessando o herói.
  flags.events.length = 0;
  m.hp = 5;
  const sk = combat.spawn('warrior', m.position.x, m.position.z + 1.3, { awake: true, facing: Math.PI, passive: true });
  yield 0.3;
  sk.facing = Math.PI; sk.group.rotation.y = Math.PI;
  combat.enemyStrike(sk);
  out(`  esqueleto bateu: vida do mercador 5 -> ${m.hp} ${m.hp === 1 && m.alive ? '✔ (não morre)' : 'ERRO'}`);
  m.hit(50, sk);
  out(`  outro golpe forte de esqueleto: vida ${m.hp} ${m.hp === 1 && m.alive ? '✔' : 'ERRO'}`);
  // Esqueleto longe, herói no meio do caminho da flecha.
  sk.position.set(m.position.x + 9, 0, m.position.z);
  player.position.set(m.position.x + 4.5, 0, m.position.z);
  player.hp = player.maxHp;
  const hp0 = sk.hp;
  yield () => flags.last('merchantShot');
  yield 0.1;
  const ms = flags.last('merchantShot');
  out(`  flecha no esqueleto: ${ms ? `✔ -${ms.dmg} (vida ${hp0} -> ${sk.hp})` : 'ERRO'} | atravessou o herói: ${!flags.last('heroHit') && player.hp === player.maxHp ? '✔' : 'ERRO'}`);
  sk.die(); combat.killed(sk, 0, 1);
  yield 0.5;

  // c) Sala limpa abre a loja; herói mata o mercador -> sem trocas.
  waves.stop();
  run.roomCleared();
  yield 0.3;
  const items = run.pickups.filter((p) => p.kind === 'shop').length;
  run.pickups.filter((p) => p.kind === 'blessing').forEach((p) => { p.taken = true; run.removePickup(p); });
  m.hp = 3;
  player.position.set(m.position.x + 1.9, 0, m.position.z);
  player.facing = -Math.PI / 2;
  yield 0.2;
  press('KeyJ');
  yield () => !m.alive;
  yield 1.2;
  const left = run.pickups.filter((p) => p.kind === 'shop').length;
  out(`  loja ${items} itens -> herói matou o mercador: ${!m.alive ? '✔' : 'ERRO'} | itens sumiram: ${left === 0 ? '✔' : `ERRO (${left})`} -> CONGELADO (T continua)`);
  yield 'hold';
  waves.paused = false;
}
