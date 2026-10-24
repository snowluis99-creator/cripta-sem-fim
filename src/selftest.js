import { input } from './input.js';
import { rangedAndRageTests } from './selftest2.js';
import { findBone } from './characters.js';
import * as THREE from 'three';
const handY = (e, b) => { const o = findBone(e.model, b); o.updateWorldMatrix(true, false); return o.getWorldPosition(new THREE.Vector3()).y; };
import { newRulesTests } from './selftest3.js';
import { m4Tests } from './selftest4.js';
import { duoTests } from './selftest5.js';
import { shadowTests } from './selftest6.js';
import { tavernTests } from './selftest7.js';
import { mageTests } from './selftest8.js';
// Teste automático de combate (tecla T, só com o modo de teste ligado pela tecla I).
// Roda um roteiro com tempo fixo de 1/60 s por passo, escreve o resultado na tela e congela
// nos momentos importantes para screenshot (T continua). Usado pelo Claude; o jogador não precisa dele.

const press = (code) => {
  dispatchEvent(new KeyboardEvent('keydown', { code }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
};
const keyDown = (code) => dispatchEvent(new KeyboardEvent('keydown', { code }));
const keyUp = (code) => dispatchEvent(new KeyboardEvent('keyup', { code }));

// Roteiro. yield número = esperar segundos; yield função = esperar até ser verdade (máx. 5 s); yield 'hold' = congelar.
function* script(g, out, flags) {
  const { player, combat, waves, debris } = g;
  const setup = () => { input.endFrame(); g.restart(); waves.paused = true; player.reset(0, 2); flags.events.length = 0; };
  waves.paused = true;

  out('1) Combo de 3 golpes no Lacaio (30 de vida)');
  setup();
  const m = combat.spawn('minion', 0, -0.3, { awake: true, facing: 0, passive: true });
  yield 0.3;
  flags.freezeHeavy = true;
  out(`  início: herói (${player.position.x.toFixed(1)}, ${player.position.z.toFixed(1)}) ${player.state} virado ${Math.round(player.facing * 57.3)}° | lacaio (${m.position.x.toFixed(1)}, ${m.position.z.toFixed(1)}) ${m.state}`);
  press('KeyJ'); yield 0.22; press('KeyJ'); yield 0.25; press('KeyJ');
  yield () => !m.alive;
  out(m.alive ? '  ERRO: o lacaio não morreu' : `  morreu ✔ (vida final ${m.hp})`);
  yield 1.8;
  out('  -> ossos no chão: CONGELADO (T continua)');
  yield 'hold';

  out('2) Guerreiro com escudo');
  setup();
  // Lado a lado (para a câmera ver os dois): herói à esquerda olhando para a direita.
  player.position.set(-1.2, 0, 1); player.facing = Math.PI / 2;
  const w = combat.spawn('warrior', 1.1, 1, { awake: true, facing: -Math.PI / 2, passive: true });
  yield 0.3;
  press('KeyJ'); yield 0.3;
  out('  -> golpe no escudo: CONGELADO (T continua)');
  yield 'hold';
  yield 0.6; flags.events.length = 0;
  press('KeyJ'); yield 0.7;
  out(`  de frente: ${flags.last('blocked') ? 'bloqueou ✔' : 'ERRO: não bloqueou'} (vida ${w.hp}/${w.maxHp})`);
  w.facing = Math.PI / 2; flags.events.length = 0;
  press('KeyJ'); yield 0.7;
  out(`  pelas costas: ${flags.last('hit') ? 'acertou ✔' : 'ERRO: não acertou'} (vida ${w.hp}/${w.maxHp})`);
  w.facing = -Math.PI / 2; flags.events.length = 0;
  press('KeyJ'); yield 0.22; press('KeyJ'); yield 0.25; press('KeyJ');
  yield 1.0;
  out(`  combo de frente: ${flags.events.filter((e) => e.type !== 'swing').map((e) => e.type === 'blocked' ? 'bloq' : `-${e.dmg}`).join(', ')} | estado ${w.state} (vida ${w.hp})`);

  out('3) Lacaio ataca o herói parado');
  setup();
  combat.spawn('minion', 0, 0.2, { awake: true, facing: 0, cooldown: 0, abilities: false });
  yield () => player.hp < player.maxHp;
  out(`  herói apanhou: vida ${player.hp}/${player.maxHp} ${player.hp < player.maxHp ? '✔' : 'ERRO'}`);
  yield 0.05;
  out('  -> CONGELADO no golpe (T continua)');
  yield 'hold';
  yield 1.2;

  out('4) Bloqueando (segura K)');
  flags.events.length = 0;
  keyDown('KeyK');
  yield () => flags.last('blockedHero') || player.hp <= 0;
  const b = flags.last('blockedHero');
  out(`  ${b ? `bloqueou ✔ dano ${b.dmg} (sem bloqueio: 10)` : 'ERRO: não bloqueou'} | vida ${player.hp}`);
  yield 0.3;
  keyUp('KeyK');

  out('5) Poção (Q)');
  combat.clear();
  yield 0.3;
  player.potions = 1; // o herói começa sem poções: dá uma para o teste
  const hp0 = player.hp, p0 = player.potions;
  press('KeyQ');
  yield 1.2;
  out(`  vida ${hp0} -> ${player.hp}, poções ${p0} -> ${player.potions} ${player.hp > hp0 && player.potions === p0 - 1 ? '✔' : 'ERRO'}`);

  out('6) Morte e recomeço');
  player.hurt(999, 0, 1);
  yield 2.6;
  out(`  tela de morte: ${g.hud.deathVisible ? '✔' : 'ERRO'} -> CONGELADO (T continua)`);
  yield 'hold';
  press('Enter');
  yield 0.2;
  out(`  recomeçou: vida ${player.hp}, poções ${player.potions}, tela ${g.hud.deathVisible ? 'ERRO ainda aberta' : 'fechada ✔'}`);
  yield* abilityTests(g, out, flags, setup);
  yield* rangedAndRageTests(g, out, flags, setup);
  yield* roomFlow(g, out);
  yield* newRulesTests(g, out, flags);
  yield* m4Tests(g, out, flags);
  yield* shadowTests(g, out, flags);
  yield* tavernTests(g, out, flags);
  yield* mageTests(g, out, flags);
  waves.paused = false;
  out('FIM (partida nova começou)');
  g.restart();
}

// V: só o Guardião enfurecido, congelando nos momentos para screenshot (V continua).
function* bossShowcase(g, out, flags) {
  const { player, combat, waves } = g;
  input.endFrame(); g.restart(); waves.paused = true; player.reset(0, 6); flags.events.length = 0;
  player.stats.damageTaken = 0.01;
  const boss = combat.spawn('guardian', 0, -6, { awake: true, facing: 0 });
  for (const k in boss.cd) boss.cd[k] = 99; boss.cooldown = 99;
  boss.hp = Math.floor(boss.maxHp * 0.5);
  yield () => boss.state === 'rage';
  yield () => boss.state === 'chase';
  for (const k in boss.cd) boss.cd[k] = 99; boss.cooldown = 99;
  boss.cd.cast = 0;
  yield () => boss.state === 'cast';
  yield 0.75;
  out(`círculos: parado, mão direita levantada (${boss.anim.currentName}) -> V continua`);
  yield 'hold';
  combat.hazards.clear(); yield () => player.state !== 'rooted';
  for (const k in boss.cd) boss.cd[k] = 99;
  boss.position.set(-6, 0, -6); player.position.set(0, 0, 7);
  boss.cd.spin = 0;
  yield () => boss.state === 'spinGather';
  out(`chegou ao meio: (${boss.position.x.toFixed(1)}, ${boss.position.z.toFixed(1)})`);
  yield 1.6;
  out(`esqueletos grudando: ${boss.boneSword.stuck.length} -> V continua`);
  yield 'hold';
  yield () => boss.state === 'spin';
  yield 0.05;
  out(`espada completa: ${boss.boneSword.stuck.length} -> V continua`);
  yield 'hold';
  yield () => boss.anim.progress() >= 0.25;
  out('girando -> V continua');
  yield 'hold';
  yield () => boss.state !== 'spin';
  yield 0.4;
  out(`depois do giro: espada desmanchou ${!boss.boneSword ? '✔' : 'ERRO'} -> V termina`);
  yield 'hold';
  for (const k in boss.cd) boss.cd[k] = 99;
}

// Habilidades dos inimigos: salto pelas costas, encostar, investida, círculos, giro e invocação.
function* abilityTests(g, out, flags, setup) {
  const { player, combat, waves } = g;
  const behind = (e) => { // o inimigo está atrás do herói?
    const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
    return (e.position.x - player.position.x) * fx + (e.position.z - player.position.z) * fz < 0;
  };
  const block = (e) => { for (const k in e.cd) e.cd[k] = 99; e.cooldown = 99; };

  out('12) Lacaio: salto pelas costas + golpe rápido');
  setup();
  player.facing = Math.PI;
  const m = combat.spawn('minion', 0, -3, { awake: true, facing: 0 });
  block(m); m.cd.leap = 0;
  yield () => m.state === 'leapWind';
  out(`  saltou: ${m.state === 'leapWind' ? '✔' : 'ERRO'} | caiu nas costas do herói: ${behind(m) ? '✔' : 'ERRO'} -> CONGELADO no aviso (T continua)`);
  yield 'hold';
  const t0 = performance.now();
  let tAviso = 0;
  yield () => { tAviso += 1 / 60; return flags.last('heroHit'); };
  const hh = flags.last('heroHit');
  out(`  golpe rápido: ${hh ? `✔ -${hh.dmg}` : 'ERRO'} | tempo para reagir depois de cair: ${tAviso.toFixed(2)} s`);
  void t0;
  // Rolando no aviso: escapa.
  setup();
  player.facing = Math.PI;
  const m2 = combat.spawn('minion', 0, -3, { awake: true, facing: 0 });
  block(m2); m2.cd.leap = 0;
  yield () => m2.state === 'leapWind';
  yield 0.2;
  press('Space');
  yield 1.0;
  out(`  rolando no aviso: ${!flags.last('heroHit') ? 'escapou ✔' : 'ERRO apanhou'}`);

  out('13) Encostar no esqueleto machuca');
  setup();
  const c = combat.spawn('minion', 0, 1.2, { awake: true, facing: 0 });
  block(c);
  yield () => flags.last('contact');
  const ct = flags.last('contact');
  out(`  encostou: ${ct ? `✔ -${ct.dmg}` : 'ERRO'}`);

  out('14) Guerreiro: investida');
  setup();
  player.position.set(0, 0, 5);
  const w = combat.spawn('warrior', 0, -6, { awake: true, facing: 0 });
  block(w); w.cd.charge = 0;
  yield () => w.state === 'chargeWind';
  yield 0.45;
  out('  -> aviso da investida no chão: CONGELADO (T continua)');
  yield 'hold';
  const z0 = w.position.z;
  let tc = 0;
  yield () => { if (w.state === 'charge') tc += 1 / 60; return flags.last('heroHit') || w.state === 'recover'; };
  const hc = flags.last('heroHit');
  out(`  investida: ${hc ? `acertou ✔ -${hc.dmg}` : 'ERRO não acertou'} | andou ${(w.position.z - z0).toFixed(1)} em ${tc.toFixed(2)} s`);

  out('15) Guardião: círculos, giro e invocação');
  setup();
  player.position.set(0, 0, 3);
  const boss = combat.spawn('guardian', 0, -4, { awake: true, facing: 0 });
  block(boss); boss.cd.cast = 0;
  const bx0 = boss.position.x, bz0 = boss.position.z;
  yield () => combat.hazards.circles.length > 0;
  const hr = handY(boss, 'handslot.r'), hl = handY(boss, 'handslot.l');
  out(`  mão direita ${hr.toFixed(1)} x esquerda ${hl.toFixed(1)}: ${hr > hl + 1.2 && hr > 2.3 ? '✔ direita levantada' : 'ERRO'}`);
  out(`  conjurou círculos: ${combat.hazards.circles.length} ✔ | parado: ${Math.hypot(boss.position.x - bx0, boss.position.z - bz0) < 0.05 ? '✔' : 'ERRO'} | mão levantada: ${boss.anim.currentName === 'Ranged_Magic_Raise' ? '✔' : 'ERRO'} | vida ${boss.maxHp} ${boss.maxHp === 480 ? '✔' : 'ERRO'} -> CONGELADO (T continua)`);
  yield 'hold';
  yield () => player.state === 'rooted';
  out(`  herói preso: ${player.state === 'rooted' ? '✔' : 'ERRO'}`);
  const px = player.position.x, pz = player.position.z;
  keyDown('KeyD'); press('Space'); keyDown('KeyK'); yield 0.6;
  out(`  preso não anda/rola/bloqueia: ${player.state === 'rooted' && Math.hypot(player.position.x - px, player.position.z - pz) < 0.01 ? '✔' : `ERRO (${player.state})`}`);
  keyUp('KeyD'); keyUp('KeyK');
  yield () => player.state !== 'rooted';
  out(`  soltou depois de ${boss.data.cast.root} s: ${player.state !== 'rooted' ? '✔' : 'ERRO'}`);
  combat.hazards.clear();
  yield 1.0; flags.events.length = 0;
  player.position.set(boss.position.x, 0, boss.position.z + 2.8);
  boss.cd.spin = 0;
  yield () => boss.state === 'spinWind';
  yield 0.4;
  out('  -> aviso do giro: CONGELADO (T continua)');
  yield 'hold';
  yield () => flags.last('heroHit');
  const hs = flags.last('heroHit');
  out(`  giro 360°: ${hs ? `acertou ✔ -${hs.dmg}` : 'ERRO'}`);
  yield 1.0;
  waves.stop(); waves.state = 'fighting'; waves.paused = false;
  player.facing = 0;
  const n0 = combat.enemies.length;
  boss.cd.summon = 0;
  yield () => combat.enemies.length >= n0 + 3;
  yield 0.1;
  const novos = combat.enemies.slice(n0);
  out(`  invocou: ${novos.length} esqueletos ${novos.length >= 3 ? '✔' : 'ERRO'} | nas costas do herói: ${novos.every(behind) ? '✔' : 'ERRO'} -> CONGELADO (T continua)`);
  yield 'hold';
  waves.paused = true;
}

// Parte 2 (M3): limpar a sala, recompensa, bênção, portas, mercador, baú, descanso e Guardião.
function* roomFlow(g, out) {
  const { player, combat, waves, run, ui } = g;
  const killAll = () => combat.enemies.forEach((e) => { if (e.alive && e.targetable) { e.die(); combat.killed(e, 0, 1); } });
  out('7) Sala de combate completa');
  g.restart();
  waves.paused = false;
  player.position.set(0, 0, 0); player.facing = Math.PI; // no meio da sala, olhando para o fundo
  yield () => combat.enemies.length > 0;
  {
    const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
    const ok = combat.enemies.every((e) => (e.position.x - player.position.x) * fx + (e.position.z - player.position.z) * fz < 0);
    out(`  onda nasceu nas costas do herói: ${ok ? '✔' : 'ERRO'}`);
  }
  out(`  sala: ${run.built.room.name} | portas: ${run.built.doors.length} (${run.built.doors.map((d) => d.node.reward).join(', ')}) | fechadas: ${!run.doorsOpen ? '✔' : 'ERRO'}`);
  for (let i = 0; i < 4 && waves.active; i++) yield () => { killAll(); return !waves.active; };
  out(`  sala limpa: ${!waves.active ? '✔' : 'ERRO'} | recompensa no chão: ${run.pickups.map((p) => p.kind).join(', ') || 'nenhuma'}`);
  yield 0.6;
  out(`  portas ainda fechadas antes de pegar: ${!run.doorsOpen ? '✔' : 'ERRO'}`);
  player.position.copy(run.built.reward);
  yield () => ui.modal;
  out(`  menu de bênção: ${ui.modal ? '✔' : 'ERRO'} (${ui.choice ? ui.choice.options.map((b) => b.name).join(' / ') : ''}) -> CONGELADO (T continua)`);
  yield 'hold';
  yield 0.4;
  press('Digit1');
  yield 0.1;
  out(`  bênção escolhida: ${Object.keys(player.blessings).join(', ') || 'ERRO nenhuma'} | portas abertas: ${run.doorsOpen ? '✔' : 'ERRO'}`);
  player.position.set(0, 0, run.built.halfD - 6);
  yield 1.4;
  out('  -> portas abertas com ícones: CONGELADO (T continua)');
  yield 'hold';
  const d = run.built.doors[0];
  const target = d.node;
  player.position.set(d.x, 0, d.z + 2.5);
  keyDown('KeyW');
  yield () => run.step === 1 && !run.transition;
  keyUp('KeyW');
  out(`  passou pela porta: ${run.step === 1 ? '✔' : 'ERRO'} -> ${run.built.room.name} (${target.kind}/${target.reward})`);

  out('8) Mercador (combate antes)');
  run.enter({ kind: 'merchant', reward: 'merchant', room: 'mercador', waves: [[['minion', 1]]], level: 1 }, true);
  out(`  sem itens durante o combate: ${!run.pickups.some((p) => p.kind === 'shop') ? '✔' : 'ERRO'}`);
  for (let i = 0; i < 4 && waves.active; i++) yield () => { killAll(); return !waves.active; };
  yield 1.2;
  out(`  depois do combate: ${run.pickups.filter((p) => p.kind === 'shop').length === 3 ? '✔ 3 itens' : 'ERRO itens'} + bênção ${run.pickups.some((p) => p.kind === 'blessing') ? '✔' : 'ERRO'}`);
  run.pickups.filter((p) => p.kind === 'blessing').forEach((p) => { p.taken = true; run.removePickup(p); });
  run.gold = 200; g.hud.setGold(200);
  const shop = run.pickups.find((p) => p.opts.item === 'potion');
  player.position.set(shop.pos.x, 0, shop.pos.z + 1.3);
  yield 0.2;
  out('  -> mercador e itens: CONGELADO (T continua)');
  yield 'hold';
  const pot0 = player.potions;
  press('KeyE');
  yield 0.3;
  out(`  comprou poção: ${player.potions === pot0 + 1 && run.gold === 165 ? '✔' : 'ERRO'} (poções ${player.potions}, ouro ${run.gold})`);
  const sb = run.pickups.find((p) => p.opts.item === 'blessing');
  player.position.set(sb.pos.x, 0, sb.pos.z + 1.3);
  yield 0.2;
  const nb = Object.keys(player.blessings).length;
  press('KeyE');
  yield 0.3;
  out(`  comprou bênção: ${Object.keys(player.blessings).length > nb || run.gold < 165 ? '✔' : 'ERRO'} (ouro ${run.gold})`); // pode ser uma que ele já tinha (acumula)

  out('9) Baú do tesouro (combate antes)');
  run.enter({ kind: 'treasure', reward: 'treasure', room: 'tesouro', waves: [[['minion', 1]]], level: 1 }, true);
  out(`  sem baú durante o combate: ${!run.pickups.some((p) => p.kind === 'chest') ? '✔' : 'ERRO'}`);
  for (let i = 0; i < 4 && waves.active; i++) yield () => { killAll(); return !waves.active; };
  yield 0.5;
  run.pickups.filter((p) => p.kind === 'blessing').forEach((p) => { p.taken = true; run.removePickup(p); });
  const chest = run.pickups.find((p) => p.kind === 'chest');
  player.position.set(chest.pos.x, 0, chest.pos.z + 1.8);
  yield 0.2;
  const g0 = run.gold;
  press('KeyE');
  yield () => ui.modal;
  out(`  abriu: ${ui.modal ? '✔' : 'ERRO'} ouro ${g0} -> ${run.gold} | opções: ${ui.choice ? ui.choice.options.map((b) => b.rarity).join(', ') : ''}`);
  yield 0.4; press('Digit2'); yield 0.2;

  out('10) Descanso (sem combate, sem bênção, vida cheia)');
  run.enter({ kind: 'rest', reward: 'rest', room: 'descanso' }, true);
  player.hp = 20;
  yield 0.5;
  out(`  sem combate: ${!waves.active ? '✔' : 'ERRO'} | portas abertas: ${run.doorsOpen ? '✔' : 'ERRO'} | sem bênção: ${!run.pickups.some((p) => p.kind === 'blessing') ? '✔' : 'ERRO'}`);
  const bed = run.pickups.find((p) => p.kind === 'bed');
  player.position.set(bed.pos.x + 1.6, 0, bed.pos.z + 1);
  yield 0.2;
  press('KeyE');
  yield 0.3;
  out(`  descansou: vida 20 -> ${player.hp} ${player.hp === player.maxHp ? '✔ cheia' : 'ERRO'}`);

  out('11) Guardião e saída do andar');
  run.step = 5;
  run.enter(run.floor.steps[4][0], true);
  player.hp = player.maxHp;
  out(`  ${run.built.room.name}: ondas ${waves.waves.length}`);
  for (let i = 0; i < 6 && !combat.enemies.some((e) => e.type === 'guardian'); i++) yield () => { killAll(); return combat.enemies.some((e) => e.type === 'guardian'); };
  const boss = combat.enemies.find((e) => e.type === 'guardian');
  yield 1.0;
  out(`  Guardião apareceu: ${boss ? `✔ vida ${boss.hp}` : 'ERRO'} | barra de chefe: ${g.hud.boss ? '✔' : 'ERRO'} -> CONGELADO (T continua)`);
  yield 'hold';
  for (let i = 0; i < 4 && waves.active; i++) yield () => { killAll(); return !waves.active; };
  yield 0.3;
  const prize = run.pickups.find((p) => p.kind === 'blessing');
  if (prize) { player.position.copy(prize.pos); yield () => ui.modal; yield 0.4; press('Digit1'); yield 0.2; }
  const gp = run.pickups.find((p) => p.kind === 'gold');
  if (gp) { player.position.copy(gp.pos); yield 0.2; }
  yield 1.2;
  out(`  portas abertas: ${run.doorsOpen ? '✔' : 'ERRO'} | porta leva a: ${run.built.doors.map((x) => x.node.kind).join(', ')}`);
  const ex = run.built.doors[0];
  player.position.set(ex.x, 0, ex.z + 2.5);
  keyDown('KeyW');
  yield () => run.floorNum === 2;
  keyUp('KeyW');
  yield 1.0;
  out(`  desceu para o Andar 2: ${run.floorNum === 2 && run.built.room.name === 'Portões da Cripta' ? '✔' : `ERRO (andar ${run.floorNum}, ${run.built.room.name})`} -> CONGELADO (T continua)`);
  yield 'hold';
}

// Tecla M: só os testes do M4 (rápido, parando nas pausas para screenshot).
// X: jogadas em dupla do co-op (cria um Jogador 2 sem rede).
function* duoOnly(g, out, flags) {
  g.waves.paused = true;
  yield* duoTests(g, out, flags);
  g.waves.paused = false;
  out('FIM (partida nova começou)');
  g.restart();
}

function* m4Only(g, out, flags) {
  g.waves.paused = true;
  yield* m4Tests(g, out, flags);
  g.waves.paused = false;
  out('FIM (partida nova começou)');
}

export function createSelfTest(state, game, isDebug) {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:120px;left:8px;z-index:6;font:11px monospace;color:#ff9;'
    + 'background:rgba(0,0,0,.75);padding:6px 8px;white-space:pre;display:none;max-width:90vw;max-height:calc(100vh - 140px);overflow:auto;pointer-events:auto';
  // L = esconde/mostra o resultado (para ver a cena por trás).
  addEventListener('keydown', (e) => { if (e.code === 'KeyL' && log.length) box.style.visibility = box.style.visibility === 'hidden' ? '' : 'hidden'; });
  document.body.appendChild(box);

  let running = false, holding = false, holdIn = 0, gen = null, wait = 0, waitFn = null, waitLeft = 0, log = [];
  // Resultado em páginas de 38 linhas ([ e ] trocam de página; por padrão mostra a última).
  let page = -1;
  const render = () => {
    const per = 38, pages = Math.max(1, Math.ceil(log.length / per));
    const pg = page < 0 || page >= pages ? pages - 1 : page;
    const ok = log.join('\n').split('✔').length - 1, bad = log.filter((l) => l.includes('ERRO')).length;
    box.textContent = `[página ${pg + 1}/${pages} · ✔ ${ok} · ERRO ${bad}]\n` + log.slice(pg * per, pg * per + per).join('\n');
  };
  const out = (s) => { log.push(s); render(); };
  window.__testLog = () => log; // para o teste local (tests/run_selftest.py --log)
  addEventListener('keydown', (e) => {
    if (!log.length) return;
    const pages = Math.max(1, Math.ceil(log.length / 38));
    const cur = page < 0 ? pages - 1 : page;
    if (e.code === 'BracketLeft' || e.code === 'BracketRight') { box.style.top = '120px'; box.style.whiteSpace = 'pre'; box.style.fontSize = '11px'; }
    if (e.code === 'BracketLeft') { page = Math.max(0, cur - 1); render(); }
    if (e.code === 'BracketRight') { page = Math.min(pages - 1, cur + 1); render(); }
  });
  const flags = {
    events: [],
    freezeHeavy: false,
    last(type) { for (let i = this.events.length - 1; i >= 0; i--) if (this.events[i].type === type) return this.events[i]; return null; },
  };

  // Registra o que acontece no combate (golpes, bloqueios, dano no herói).
  game.combat.log = (ev) => {
    if (!running) return;
    flags.events.push(ev);
    if (ev.type === 'swing') {
      const p = game.player, e = game.combat.enemies[0];
      const d = e ? Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z).toFixed(2) : '-';
      out(`  golpe ${p.combo + 1} saiu: acertou ${ev.hits} | herói (${p.position.x.toFixed(1)}, ${p.position.z.toFixed(1)}) virado ${Math.round(p.facing * 57.3)}° | dist ${d}`);
    }
    if (ev.type === 'hit') out(`  golpe ${game.player.combo + 1}: -${ev.dmg} (vida ${Math.max(0, ev.enemy.hp)})${ev.died ? ' MORREU' : ''}`);
    if (ev.type === 'hit' && game.player.combo === 2 && flags.freezeHeavy) {
      flags.freezeHeavy = false; holdIn = 2; out('  -> golpe forte: CONGELADO no impacto (T continua)');
    }
  };

  // T = teste com pausas para screenshot; Y = teste corrido (sem pausas); U = rápido mas parando nas pausas.
  let fast = false, skipHolds = false;
  addEventListener('keydown', (e) => {
    if (!['KeyT', 'KeyY', 'KeyU', 'KeyV', 'KeyM', 'KeyX', 'Digit6', 'Digit7', 'Digit8'].includes(e.code) || !isDebug()) return;
    if (running) { holding = false; return; }
    fast = e.code !== 'KeyT';
    skipHolds = e.code === 'KeyY';
    running = true; holding = false; log = []; page = -1; wait = 0; waitFn = null;
    gen = e.code === 'KeyV' ? bossShowcase(game, out, flags) : e.code === 'KeyM' ? m4Only(game, out, flags) : e.code === 'KeyX' ? duoOnly(game, out, flags) : e.code === 'Digit6' ? (function* () { yield 0.5; yield* shadowTests(game, out, flags); })() : e.code === 'Digit7' ? (function* () { yield 0.5; yield* tavernTests(game, out, flags); })() : e.code === 'Digit8' ? (function* () { yield 0.5; yield* mageTests(game, out, flags); })() : script(game, out, flags);
    box.style.display = 'block';
    out('TESTE AUTOMÁTICO DE COMBATE');
  });

  const advance = () => {
    const r = gen.next();
    if (r.done) {
      running = false;
      // Resumo no título da aba (dá para ler mesmo com o painel pequeno).
      const bad = log.filter((l) => l.includes('ERRO'));
      document.title = bad.length ? `ERRO ${bad.length}: ${bad.map((l) => l.trim()).join(' || ')}`.slice(0, 900) : 'Teste OK';
      // Resumo compacto no topo da tela: só as linhas com ERRO (e a seção de cada uma). [ e ] voltam ao log completo.
      const sec = (i) => { for (let j = i; j >= 0; j--) if (/^\d+\)/.test(log[j])) return log[j]; return ''; };
      const lines = log.map((l, i) => (l.includes('ERRO') ? `${sec(i)} >> ${l.trim()}` : null)).filter(Boolean);
      const ok = log.join('\n').split('✔').length - 1;
      box.style.top = '0px'; box.style.whiteSpace = 'pre-wrap'; box.style.fontSize = '10px';
      box.textContent = `RESUMO ✔ ${ok} · ERRO ${lines.length}\n${lines.join('\n')}`;
      
      return;
    }
    const v = r.value;
    if (v === 'hold') holding = !skipHolds;
    else if (typeof v === 'function') { waitFn = v; waitLeft = 5; }
    else wait = v;
  };

  return {
    get running() { return running; },
    get stepsPerFrame() { return fast ? 2000 : 20; },
    // Avança um passo fixo de 1/60 s e devolve o dt; 0 = congelado (espera apertar T de novo).
    update() {
      if (!running || holding) return 0;
      if (holdIn > 0 && --holdIn === 0 && !fast) { holding = true; return 0; }
      const dt = 1 / 60;
      if (waitFn) {
        waitLeft -= dt;
        if (waitFn() || waitLeft <= 0) { waitFn = null; advance(); }
      } else if ((wait -= dt) <= 0) advance();
      return running && !holding ? dt : 0;
    },
  };
}
