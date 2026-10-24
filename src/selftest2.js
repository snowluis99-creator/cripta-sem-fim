// Teste automático, parte 3: Arqueiro e Guardião enfurecido (chamado por selftest.js).
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
  a.position.set(0, 0, -6); face(a); keyDown('KeyK'); yield 0.2;
  a.cooldown = 0;
  yield () => flags.last('arrow');
  const bl = flags.last('blockedHero');
  out(`  escudo bloqueou a flecha: ${bl ? `✔ dano ${bl.dmg}` : 'ERRO'}`);
  keyUp('KeyK'); yield 0.2;
  a.cooldown = 99;
  a.position.set(0, 0, 0.8);
  const d0 = dist(a);
  yield 0.8;
  out(`  fugiu do herói: ${dist(a) > d0 + 1.5 ? '✔' : 'ERRO'} (${d0.toFixed(1)} -> ${dist(a).toFixed(1)})`);

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
