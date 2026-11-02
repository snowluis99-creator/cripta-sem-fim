// Teste automático, parte 3: Arqueiro e Guardião enfurecido (chamado por selftest.js).
import { rollBlessings, ensureLegendary } from './blessings.js';
const press = (code) => {
  dispatchEvent(new KeyboardEvent('keydown', { code }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
};
const keyDown = (code) => dispatchEvent(new KeyboardEvent('keydown', { code }));
const keyUp = (code) => dispatchEvent(new KeyboardEvent('keyup', { code }));

export function* rangedAndRageTests(g, out, flags, setup) {
  const { player, combat, waves } = g;
  const block = (e) => { for (const k in e.cd) e.cd[k] = 99; e.cooldown = 99; };
  const dist = (e) => Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z);
  const face = (e) => { player.facing = Math.atan2(e.position.x - player.position.x, e.position.z - player.position.z); };

  out('16) Arqueiro: atira de longe, escudo bloqueia, foge de perto');
  setup();
  player.position.set(0, 0, 3);
  const a = combat.spawn('archer', 0, -6, { awake: true, facing: 0 });
  a.cooldown = 0;
  yield () => combat.projectiles.list.length > 0;
  yield 0.12;
  out(`  atirou: ${combat.projectiles.list.length ? '✔' : 'ERRO'} -> flecha no ar: CONGELADO (T continua)`);
  yield 'hold';
  yield () => flags.last('arrow');
  const h = flags.last('heroHit');
  out(`  flecha acertou o herói: ${h ? `✔ -${h.dmg}` : 'ERRO'}`);
  yield 1.0; flags.events.length = 0;
  const reload = (e) => { e.loaded = true; e.carry = false; e.ammo = 3; for (const it of e.boltList || []) combat.projectiles.takeBolt(it); e.boltList = []; combat.projectiles.takeBolt(e.bolt); e.bolt = null; if (e.state !== 'chase') e.setState('chase'); };
  reload(a); a.position.set(0, 0, -6); face(a); keyDown('KeyK'); yield 0.2;
  reload(a); a.cooldown = 0;
  yield () => flags.last('arrow');
  const bl = flags.last('blockedHero');
  out(`  escudo bloqueou a flecha: ${bl ? `✔ dano ${bl.dmg}` : 'ERRO'}`);
  keyUp('KeyK'); yield 0.2;
  reload(a); a.cooldown = 99;
  a.position.set(0, 0, 0.8);
  const d0 = dist(a);
  yield 0.8;
  out(`  fugiu do herói: ${dist(a) > d0 + 1.5 ? '✔' : 'ERRO'} (${d0.toFixed(1)} -> ${dist(a).toFixed(1)})`);

  out('16b) Arqueiro: 3 flechas, depois um pulo direto em cada flecha, canto, recarrega; 1º golpe sem recarregar');
  setup();
  const until = function* (f, t) { let k = 0; while (!f() && k < t) { yield 0.1; k += 0.1; } return f(); };
  player.position.set(4, 0, 3); player.facing = Math.PI; player.iframes = 0;
  const b = combat.spawn('archer', -2, -6, { awake: true, facing: 0 });
  flags.events.length = 0;
  let shots = 0;
  for (let i = 0; i < 3; i++) {
    b.cooldown = 0;
    const n = shots;
    yield* until(() => flags.events.filter((e) => e.type === 'archerBoltDrop').length > n, 4);
    shots = flags.events.filter((e) => e.type === 'archerBoltDrop').length;
    if (i === 0) out(`  1ª flecha: continua atirando normal: ${b.loaded !== false && b.ammo === 2 ? '✔' : 'ERRO'} (flechas ${b.ammo})`);
  }
  out(`  3 flechas no chão: ${shots === 3 && combat.projectiles.bolts && combat.projectiles.bolts.length === 3 ? '✔' : 'ERRO'} (${shots}) | besta vazia: ${b.loaded === false ? '✔' : 'ERRO'}`);
  const hop = yield* until(() => b.state === 'hop', 3);
  const h1 = flags.last('archerHop') || { next: '-', to: { x: 99, z: 99 } };
  const nb = h1 && combat.projectiles.bolts.reduce((m, it) => Math.min(m, Math.hypot(it.x - h1.to.x, it.z - h1.to.z)), 99);
  out(`  pulo direto na flecha: ${hop && h1.next === 'pickup' && nb < 1.4 ? '✔' : 'ERRO'} (${nb != null ? nb.toFixed(2) : '-'}) | no ar não leva golpe: ${hop && !b.targetable ? '✔' : 'ERRO'} -> CONGELADO (T continua)`);
  yield 'hold';
  player.position.set(6, 0, 6);
  let tPick = 0;
  const pick = yield* (function* () { let k = 0; while (flags.events.filter((e) => e.type === 'archerPickup').length < 3 && k < 20) { yield 0.1; k += 0.1; tPick = k; } return flags.events.filter((e) => e.type === 'archerPickup').length >= 3; })();
  const pHops = flags.events.filter((e) => e.type === 'archerHop' && e.next === 'pickup' && e.enemy === b).length;
  out(`  um pulo por flecha: ${pHops >= 1 && pHops <= 3 ? '✔' : 'ERRO'} (${pHops} pulos; flecha colada na outra = pega sem pular) | rápido: ${tPick <= 5 ? '✔' : 'ERRO'} (${tPick.toFixed(1)} s)`);
  out(`  pegou as 3 flechas: ${pick ? '✔' : 'ERRO'} (${flags.events.filter((e) => e.type === 'archerPickup').length})`);
  const corner = yield* until(() => flags.last('archerHop') && flags.last('archerHop').next === 'reload', 3);
  const to = corner && flags.last('archerHop').to, bd = combat.world.bounds;
  out(`  pulou para a ponta da sala: ${to && bd && (Math.abs(to.x) > bd.x * 0.5 || Math.abs(to.z) > bd.z * 0.5) ? '✔' : 'ERRO'} (${to ? to.x.toFixed(1) + ', ' + to.z.toFixed(1) : '-'})`);
  const rl = yield* until(() => b.state === 'reload', 2);
  out(`  recarregando: ${rl ? '✔' : 'ERRO'} -> CONGELADO (T continua)`);
  yield 'hold';
  yield* until(() => b.loaded === true, 3);
  const n0 = combat.projectiles.list.length;
  const again = yield* until(() => combat.projectiles.list.length > n0 || b.state === 'aim', 4);
  out(`  recarregou (3 flechas) e atira de novo: ${b.loaded !== false && again && b.ammo >= 2 ? '✔' : 'ERRO'}`);
  b.die();
  // 1º golpe com flechas na besta: rola, pula para longe e atira SEM recarregar.
  setup();
  player.position.set(0, 0, 0); player.facing = Math.PI;
  const r = combat.spawn('archer', 0, -1.6, { awake: true, facing: 0 });
  r.cooldown = 99; flags.events.length = 0;
  press('KeyJ');
  yield* until(() => r.state === 'roll', 1.2);
  r.cooldown = 99;
  const rh = yield* until(() => flags.last('archerHop'), 2);
  out(`  1º golpe com flechas: rolou e pulou para longe: ${rh && flags.last('archerHop').next === 'shoot' ? '✔' : 'ERRO'} (${rh ? flags.last('archerHop').next : r.state})`);
  let sawReload = false, shotR = false;
  for (let k = 0; k < 2.5 && !shotR; k += 0.05) { yield 0.05; if (r.state === 'reload') sawReload = true; if (r.state === 'aim' || r.state === 'shot') shotR = true; }
  out(`  sem recarregar: ${!sawReload ? '✔' : 'ERRO'} | já atirou: ${shotR ? '✔' : 'ERRO'} (flechas ${r.ammo})`);
  r.die();

  out('16c) Escudo atordoa em volta a cada bloqueio + chefe sempre com 1 lendária');
  setup();
  player.position.set(0, 0, 0); player.facing = Math.PI;
  const ms = [[0, -1.3], [1.6, -0.8], [-1.6, -0.8]].map(([x, z]) => combat.spawn('minion', x, z, { awake: true, facing: 0 }));
  for (const m of ms) block(m);
  player.shield = 10; player.iframes = 0; player.bumpGrace = 0;
  flags.events.length = 0; keyDown('KeyK'); yield 0.25;
  combat.hitPlayer(ms[0], 5, { contact: true, push: 6, noRepel: true, target: player });
  const sh = flags.events.filter((e) => e.type === 'shieldShock').sort((a, c) => c.n - a.n)[0];
  out(`  esbarrão bloqueado atordoa ${sh ? sh.n : 0} esqueletos em volta: ${sh && sh.n >= 3 && ms.every((m) => m.state === 'hurt') ? '✔' : `ERRO (${player.state}, escudo ${player.shield}, ${flags.events.map((e) => e.type).join(',')})`}`);
  keyUp('KeyK'); yield 0.3;
  for (const m of ms) m.die();
  let okL = 0;
  for (let i = 0; i < 60; i++) { const o = ensureLegendary(rollBlessings({}, 3, 'epic', Math.random, player.hero), {}, Math.random, player.hero); if (o.some((x) => x.rarity === 'legendary')) okL++; }
  out(`  bênção do chefe com lendária: ${okL}/60 ${okL === 60 ? '✔' : 'ERRO'}`);
  player.hp = Math.max(1, player.maxHp - 30); player.potions = Math.max(player.potions, 1); player.restRoom = true;
  const pot0 = player.potions;
  const drank = player.tryDrink();
  out(`  sala de descanso: poção travada: ${!drank && player.potions === pot0 && player.state !== 'drink' ? '✔' : 'ERRO'}`);
  player.restRoom = false;

  out('17) Guardião enfurecido (metade da vida)');
  setup();
  player.position.set(0, 0, 4);
  const boss = combat.spawn('guardian', 0, -4, { awake: true, facing: 0 });
  block(boss);
  const s0 = boss.group.scale.x;
  boss.hp = Math.floor(boss.maxHp * 0.5);
  yield () => boss.state === 'rage';
  out(`  enfureceu: ✔ | invulnerável enquanto cresce: ${!boss.targetable ? '✔' : 'ERRO'}`);
  yield () => boss.state === 'chase';
  block(boss);
  out(`  tamanho ${s0.toFixed(1)} -> ${boss.group.scale.x.toFixed(1)}: ${Math.abs(boss.group.scale.x - s0 * 2) < 0.05 ? '✔ dobrou' : 'ERRO'} -> CONGELADO (T continua)`);
  yield 'hold';

  // Giro na sala toda: rolar não salva.
  flags.events.length = 0;
  boss.position.set(0, 0, -6); player.position.set(0, 0, 2); face(boss);
  boss.cd.spin = 0;
  yield () => boss.state === 'spinGather';
  out(`  andou até o meio da sala: ${Math.hypot(boss.position.x, boss.position.z) < 1.5 ? '✔' : 'ERRO'}`);
  yield () => boss.state === 'spin';
  const bs = boss.boneSword;
  out(`  espada de esqueletos: ${bs ? bs.stuck.length : 0} grudados, ${bs ? bs.length.toFixed(0) : 0} de comprimento ${bs && bs.stuck.length === boss.data.spin.boneSword.count ? '✔' : 'ERRO'} -> CONGELADO (T continua)`);
  yield 'hold';
  yield () => boss.state === 'spin' && boss.anim.progress() >= boss.data.spin.hit - 0.04;
  press('Space');
  yield () => flags.last('heroHit') || flags.last('dodged');
  out(`  giro pega a sala toda e atravessa o rolamento: ${flags.last('heroHit') ? `✔ -${flags.last('heroHit').dmg}` : 'ERRO (esquivou)'}`);
  yield () => boss.state !== 'spin';
  out(`  espada se desmancha depois do giro: ${!boss.boneSword ? '✔' : 'ERRO'}`);
  yield 1.2; block(boss); flags.events.length = 0;
  boss.position.set(0, 0, -6); player.position.set(0, 0, 6); face(boss);
  boss.cd.spin = 0;
  yield () => boss.state === 'spinGather';
  yield () => boss.state === 'spin';
  player.facing = Math.atan2(boss.position.x - player.position.x, boss.position.z - player.position.z);
  keyDown('KeyK'); yield 0.15; flags.events.length = 0;
  yield () => flags.last('blockedHero') || flags.last('heroHit');
  out(`  escudo defende o giro: ${flags.last('blockedHero') ? `✔ dano ${flags.last('blockedHero').dmg}` : 'ERRO'}`);
  keyUp('KeyK'); yield 0.8; block(boss);

  // Círculos em 3/4 do chão.
  boss.cd.cast = 0;
  yield () => combat.hazards.circles.length > 0;
  yield 0.5;
  const hz = combat.hazards, { halfW, halfD } = hz.bounds;
  let hit = 0, n = 0;
  for (let i = 0; i < 3000; i++) {
    const x = (Math.random() * 2 - 1) * (halfW - 1), z = (Math.random() * 2 - 1) * (halfD - 1);
    if (hz.world.blocked(x, z, 0.1)) continue;
    n++;
    if (hz.circles.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + player.hero.radius * 0.5)) hit++;
  }
  const cov = hit / Math.max(1, n);
  out(`  círculos: ${hz.circles.length}, cobrem ${Math.round(cov * 100)}% do chão ${cov > 0.65 && cov < 0.86 ? '✔' : 'ERRO'} -> CONGELADO (T continua)`);
  yield 'hold';
  hz.clear(); block(boss);
  if (player.state === 'rooted') yield () => player.state !== 'rooted';
  yield 0.5;

  // Flechas quando o herói está longe.
  flags.events.length = 0;
  combat.projectiles.clear();
  boss.position.set(0, 0, -7); player.position.set(0, 0, 5); face(boss);
  boss.cd.volley = 0;
  yield () => combat.projectiles.list.length >= boss.data.volley.count;
  out(`  saraivada de longe: ${combat.projectiles.list.length} flechas ✔ -> CONGELADO (T continua)`);
  yield 'hold';
  yield 1.0; block(boss); combat.projectiles.clear();

  // Salto pelas costas.
  boss.position.set(0, 0, -6); player.position.set(0, 0, 2); player.facing = 0;
  yield 0.4;
  boss.cd.leap = 0;
  yield () => boss.state === 'leapWind';
  const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
  const back = (boss.position.x - player.position.x) * fx + (boss.position.z - player.position.z) * fz < 0;
  out(`  salto pelas costas: ${back ? '✔' : 'ERRO'}`);
  yield 1.2; block(boss);
  if (player.state === 'dead') { setup(); }

  // Investida.
  boss.position.set(0, 0, -6); player.position.set(0, 0, 3);
  boss.facing = Math.atan2(player.position.x - boss.position.x, player.position.z - boss.position.z);
  boss.cd.charge = 0;
  yield () => boss.state === 'charge';
  out('  investida: ✔');
  yield () => boss.state === 'recover' || boss.state === 'chase';
  yield 0.5;
  combat.clear();
}
