// Teste automático, parte 9: ultimate, bênçãos arriscadas e mercador contratado para o chefe.
// Tecla Y = tudo; tecla 9 = só esta parte.
import { WEAPONS } from './heroes.js';
import { BLESSING_BY_ID, RISKY, rollShop } from './blessings.js';
import { ULT } from './ultimate.js';
import { ALLY } from './ally.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);
const press = (code) => {
  dispatchEvent(new KeyboardEvent('keydown', { code }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
};

export function* newTests(g, out, flags) {
  const { player, run, combat, waves, hud, ui } = g;
  const fresh = () => {
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.position.set(0, 0, 0); player.facing = 0;
    flags.events.length = 0;
  };
  const dummy = (x, z, type = 'minion') => combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 });
  const killBy = (e) => combat.bonusDamage(e, 9999, 0, 1, 'dmg', player);

  // ---------------- 40) Ultimate ----------------
  out('40) Ultimate (10 inimigos; R / RT)');
  fresh();
  yield 0.2;
  for (let i = 0; i < 3; i++) killBy(dummy(-6 + i * 3, -5));
  yield 0.1;
  out(`  3 derrotados: barra ${player.ult}/${player.ultNeed} ${ok(player.ult === 3 && player.ultNeed === 10)} | HUD ${ok(hud.$('.ut').textContent === '3/10', hud.$('.ut').textContent)}`);
  press('KeyR');
  yield 0.1;
  out(`  R com a barra incompleta: nada ${ok(!flags.last('ultimate') && player.ult === 3)}`);
  player.ult = 10;
  yield 0.1;
  out(`  barra cheia: "Ultimate pronta!" ${ok(hud.$('.ut').textContent === 'Ultimate pronta!')}`);
  press('KeyR');
  yield 0.1;
  out(`  Cavaleiro: ${ULT.knight.name} ${ok(!!flags.last('ultimate'))} | invulnerável ${ok(player.invulnerable && player.ultTime > 2.5)} | barra zerou ${ok(player.ult === 0)}`);
  const m = dummy(1, 1.5, 'warrior');
  const hp0 = player.hp;
  combat.hitPlayer(m, 20, { target: player });
  killBy(dummy(4, -4));
  out(`  golpe durante a ultimate: vida ${hp0} -> ${player.hp} ${ok(player.hp === hp0)} | derrotado durante a ultimate não carrega ${ok(player.ult === 0)}`);
  out(`  domo dourado ${ok(!!player.dome && player.dome.visible)}`);
  yield 0.3;
  out('  -> domo dourado do Cavaleiro: CONGELADO (T continua)');
  yield 'hold';
  yield () => player.ultTime <= 0;
  yield 0.1;
  combat.hitPlayer(m, 20, { target: player });
  out(`  depois de 3 s volta a apanhar ${ok(player.hp < hp0, `${player.hp}`)}`);
  combat.clear();
  // Maga
  fresh();
  player.setHero('mage', WEAPONS.mage[0].id);
  yield 0.2;
  const foes = [dummy(-8, -6, 'warrior'), dummy(7, 5, 'warrior'), dummy(6, -7, 'warrior')];
  const weak = dummy(-6, 6, 'minion'); weak.hp = 8;
  const before = foes.map((e) => e.hp);
  player.ult = 10;
  press('KeyR');
  yield () => flags.last('ultStrike');
  yield 0.05;
  const lost = foes.map((e, i) => before[i] - e.hp);
  out(`  Maga: ${ULT.mage.name} acerta a sala toda: ${lost.join('/')} ${ok(lost.every((d) => d === ULT.mage.damage))} | ${flags.last('ultStrike').hits} acertos`);
  out(`  inimigo derrotado pela ultimate não carrega ${ok(!weak.alive && player.ult === 0)}`);
  yield 0.2;
  out('  -> raios da Maga: CONGELADO (T continua)');
  yield 'hold';
  // Pacto do Ceifador: 6.
  player.addBlessing(BLESSING_BY_ID.r_ceifador);
  out(`  Pacto do Ceifador: barra de ${player.ultNeed} ${ok(player.ultNeed === 6)}`);
  player.setHero('knight', WEAPONS.knight[0].id);
  combat.clear();

  // ---------------- 41) Bênçãos arriscadas ----------------
  out('41) Bênçãos arriscadas (4ª carta, borda vermelha)');
  fresh();
  yield 0.2;
  run.offerBlessings('common', player.position.clone(), null, undefined, player);
  yield 0.4;
  const opts = ui.choice ? ui.choice.options : [];
  const card4 = ui.$('.choice .cards').children[3];
  out(`  4 opções ${ok(opts.length === 4)} | a 4ª é arriscada ${ok(opts[3] && opts[3].rarity === 'risky', opts[3] && opts[3].name)} | borda vermelha ${ok(card4 && card4.classList.contains('risky'))} | as outras 3 normais ${ok(opts.slice(0, 3).every((b) => b.rarity !== 'risky'))}`);
  out('  -> cartas com a arriscada: CONGELADO (T continua)');
  yield 'hold';
  const pick = opts[3];
  press('Digit4');
  yield 0.2;
  out(`  escolheu a 4ª: ${pick && pick.name} ${ok(pick && player.blessings[pick.id] === 1)}`);
  fresh();
  player.addBlessing(BLESSING_BY_ID.r_pacto);
  out(`  Pacto de Sangue: vida ${player.hp}/${player.maxHp} ${ok(player.maxHp === 70 && player.hp === 70)} | dano ×${player.stats.damageMul} ${ok(player.stats.damageMul === 1.5)}`);
  player.addBlessing(BLESSING_BY_ID.r_pesada);
  out(`  Lâmina Pesada: dano ×${player.stats.damageMul} ${ok(player.stats.damageMul === 2)} | golpes ×${player.stats.attackSpeed} ${ok(player.stats.attackSpeed === 0.75)}`);
  player.addBlessing(BLESSING_BY_ID.r_vampira);
  player.hp = 20; player.potions = 1;
  press('KeyQ');
  yield () => player.state !== 'drink';
  yield 0.1;
  out(`  Alma Vampira: poção curou ${player.hp - 20} (metade de 35) ${ok(player.hp - 20 === 18)}`);
  fresh();
  for (const b of RISKY) player.addBlessing(b);
  run.offerBlessings('common', player.position.clone(), null, undefined, player);
  yield 0.4;
  out(`  com todas as arriscadas: só 3 opções ${ok(ui.choice && ui.choice.options.length === 3)}`);
  press('Digit1');
  yield 0.2;
  out(`  mercador nunca vende arriscada ${ok(rollShop({}).every((b) => b.rarity !== 'risky'))}`);

  // ---------------- 42) Mercador contratado ----------------
  out('42) Mercador contratado para o chefe (250)');
  fresh();
  waves.paused = false;
  run.enter({ kind: 'merchant', reward: 'merchant', room: 'mercador', waves: [[['minion', 1]]], level: 1 }, true);
  for (let i = 0; i < 4 && waves.active; i++) yield () => { combat.enemies.forEach((e) => e.alive && killBy(e)); return !waves.active; };
  yield 1.2;
  run.pickups.filter((p) => p.kind === 'blessing').forEach((p) => { p.taken = true; run.removePickup(p); });
  const hire = run.pickups.find((p) => p.opts.item === 'hire');
  out(`  opção de contratar ${ok(!!hire)} | preço ${hire && hire.opts.price} ${ok(hire && hire.opts.price === ALLY.price)}`);
  player.gold = 100;
  run.take(hire, player);
  out(`  sem ouro: não contrata ${ok(!run.hired && player.gold === 100)}`);
  player.gold = 300;
  player.position.set(hire.pos.x, 0, hire.pos.z + 1.2);
  yield 0.2;
  press('KeyE');
  yield 0.3;
  out(`  contratou: ouro 300 -> ${player.gold} ${ok(player.gold === 50 && run.hired)} | opção sumiu ${ok(!run.pickups.includes(hire))}`);
  // Sala do chefe (Grande Salão).
  run.enter({ kind: 'elite', reward: 'elite', room: 'salao', waves: [[['minion', 3]]], level: 5 }, true);
  const ally = run.npc;
  out(`  entrou com os heróis na sala do chefe ${ok(ally && ally.ally && ally.alive)} | contrato usado ${ok(!run.hired)}`);
  yield () => combat.enemies.filter((e) => e.alive && e.targetable).length >= 3;
  waves.paused = true;
  for (const e of combat.enemies) { e.hp = e.maxHp = 9999; e.passive = true; } // aguentam a luta inteira do teste
  yield () => ally.shots >= 1;
  yield () => flags.last('merchantShot');
  out(`  atira flechas nos esqueletos ${ok(ally.shots >= 1 && !!flags.last('merchantShot'))}`);
  // Heróis não acertam nele.
  const ahp = ally.hp;
  player.position.set(ally.position.x, 0, ally.position.z - 1.4); player.facing = 0;
  combat.playerStrike(player, player.hero.combo[2]);
  out(`  golpe do herói não acerta ${ok(ally.hp === ahp)}`);
  // Esqueleto bate: perde vida.
  const sk = combat.enemies.find((e) => e.alive);
  ally.state = 'fight';
  ally.hit(20, sk);
  out(`  esqueleto acerta: vida ${ahp} -> ${ally.hp} ${ok(ally.hp === ahp - 20)}`);
  // Rola para fugir.
  ally.rollCd = 0;
  const close = dummy(ally.position.x + 1.2, ally.position.z);
  close.passive = false;
  yield () => ally.state === 'roll';
  const rollHp = ally.hp;
  ally.hit(30, close);
  out(`  inimigo colado: rolou ${ok(ally.state === 'roll')} | rolando não apanha ${ok(ally.hp === rollHp)}`);
  yield 0.2;
  out('  -> mercador rolando: CONGELADO (T continua)');
  yield 'hold';
  // Saraivada.
  ally.volleyT = 0; ally.rollCd = 9;
  yield () => flags.last('allyVolley');
  out(`  saraivada ${ok(ally.volleys === 1)} | próxima em ${Math.round(ally.volleyT)} s ${ok(ally.volleyT > 55)}`);
  yield 0.15;
  out('  -> saraivada: CONGELADO (T continua)');
  yield 'hold';
  // Pode morrer.
  ally.state = 'fight';
  ally.hit(999, sk);
  out(`  pode morrer na luta ${ok(!ally.alive && !!flags.last('allyDied'))}`);
  // Outra luta: vai embora quando a sala é limpa.
  fresh();
  run.hired = true;
  waves.paused = false;
  run.enter({ kind: 'elite', reward: 'elite', room: 'salao', waves: [[['minion', 1]]], level: 5 }, true);
  const ally2 = run.npc;
  for (let i = 0; i < 6 && waves.active; i++) yield () => { combat.enemies.forEach((e) => e.alive && killBy(e)); return !waves.active; };
  yield 0.3;
  out(`  sala limpa: comemora e vai embora ${ok(ally2.state === 'leave' || ally2.state === 'gone')}`);
  yield () => !run.npc;
  out(`  sumiu da sala ${ok(!run.npc && !combat.merchant)}`);
  // Sem contrato: não aparece.
  fresh();
  run.enter({ kind: 'elite', reward: 'elite', room: 'salao', waves: [[['minion', 1]]], level: 5 }, true);
  out(`  sem contratar: luta sozinho ${ok(!run.npc)}`);
  combat.clear();
}
