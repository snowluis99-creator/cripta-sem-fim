// Teste automático, parte 7 (M5): Taverna, suporte de armas, Ouro de Alma e salvamento.
// Tecla Y = tudo; tecla 7 = só esta parte.
import { resetSave, cleanUps } from './save.js';
import { shieldMax } from './shield.js';
import { WEAPONS, WEAPON_PRICE } from './heroes.js';
import { rollBlessings } from './blessings.js';
import { findBone } from './characters.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);
const press = (code) => {
  dispatchEvent(new KeyboardEvent('keydown', { code }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
};

export function* tavernTests(g, out, flags) {
  const { player, run, hud, save, combat, waves } = g;
  const item = (id) => run.pickups.find((p) => p.opts.item === 'weapon' && p.opts.weapon.id === id);
  const buy = (id, pl = player) => run.take(item(id), pl);
  const door = () => run.built.doors.find((d) => d.node);
  const walkIn = function* (pls) {
    yield () => door().k >= 0.6;
    for (const p of pls) p.position.set(door().x, 0, door().z + 0.6);
    yield () => !run.inTavern && !run.transition;
    yield 0.2;
  };

  // ---------------- 33) Taverna ----------------
  out('33) Taverna: suporte de armas e porta');
  resetSave();
  g.toTavern();
  yield 0.4;
  out(`  começa na Taverna: ${ok(run.inTavern && run.built.room.name === 'Taverna do Último Gole')} | 5 armas ${ok(run.pickups.filter((p) => p.opts.item === 'weapon').length === 5)} | porta "Descer" ${ok(door() && door().node.kind === 'descend')}`);
  out(`  sem inimigos e porta aberta ${ok(combat.enemies.length === 0 && run.doorsOpen)} | Ouro de Alma no HUD ${ok(hud.soulShown === 0)} | começa com espada ${ok(player.weaponId === 'espada')}`);
  const mRack = item('manopla');
  out(`  Manopla dourada no suporte: ${ok(!!(mRack && mRack.body.children[0].userData.gold))}`);
  buy('machado');
  out(`  sem Ouro de Alma não compra: ${ok(save.data.soul === 0 && player.weaponId === 'espada')}`);
  save.update((s) => { s.soul = 1000; });
  buy('machado');
  out(`  comprou o Machado: gastou ${1000 - save.data.soul} ${ok(save.data.soul === 1000 - WEAPON_PRICE)} | equipado ${ok(player.weaponId === 'machado')} | sem escudo ${ok(!player.shieldMesh && shieldMax(player) === 0)}`);
  buy('lanca');
  out(`  comprou a Lança: Ouro de Alma ${save.data.soul} ${ok(save.data.soul === 1000 - 2 * WEAPON_PRICE)} | equipada ${ok(player.weaponId === 'lanca')}`);
  buy('mangual');
  out(`  sem dinheiro para o Mangual ${ok(player.weaponId === 'lanca' && save.data.soul === 0)}`);
  buy('machado');
  out(`  voltar ao Machado não cobra ${ok(player.weaponId === 'machado' && save.data.soul === 0)}`);
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem('cripta.save')); } catch (e) { /* sem armazenamento */ }
  out(`  salvo no navegador: ${ok(stored && stored.ups.w_knight_machado === 1 && stored.ups.w_knight_lanca === 1 && stored.ups.eq_knight === 1)}`);
  const old = cleanUps({ vida: 2, fenix: 1, w_knight_lanca: 1 });
  out(`  melhorias antigas devolvem o Ouro de Alma: ${old.refund} ${ok(old.refund === 40 + 70 + 350 && !old.ups.vida && old.ups.w_knight_lanca === 1)}`);
  yield 0.3;
  out('  -> Taverna com o Machado na mão: CONGELADO (T continua)');
  yield 'hold';

  // ---------------- 34) Descida com o Machado ----------------
  out('34) Descer com o Machado (sem escudo)');
  yield* walkIn([player]);
  out(`  entrou no Andar 1: ${ok(run.floorNum === 1 && !run.inTavern)} | continua com o Machado ${ok(player.weaponId === 'machado')} | vida ${player.maxHp} ${ok(player.maxHp === 100)}`);
  waves.stop(); combat.clear(); waves.paused = true;
  player.position.set(0, 0, 2); player.facing = Math.PI;
  flags.events.length = 0;
  out(`  não bloqueia ${ok(!player.enterBlock(null) && player.state !== 'block')}`);
  let shieldOffers = 0;
  for (let i = 0; i < 300; i++) shieldOffers += rollBlessings({}, 3, 'common', Math.random, true).filter((b) => b.shield).length;
  out(`  bênçãos de escudo não aparecem: ${ok(shieldOffers === 0)}`);

  // Cada arma: alcance, área e quantos golpes no combo (golpes de verdade, pelo teclado).
  const spawnAt = (x, z) => combat.spawn('warrior', x, z, { awake: true, passive: true, facing: Math.PI });
  const strike = (wid, foes, stepIdx = 0) => {
    player.setWeapon(wid);
    combat.clear(); flags.events.length = 0;
    player.position.set(0, 0, 0); player.facing = Math.PI;
    const es = foes.map(([x, z]) => { const e = spawnAt(x, z); e.shieldCovers = () => false; e.hp = e.maxHp = 9999; return e; });
    combat.playerStrike(player, player.hero.combo[stepIdx]);
    return es.filter((e) => e.hp < 9999).length;
  };
  // Inimigos à frente (z negativo = para onde o herói olha).
  out(`  Lança: acerta a 5 de distância ${ok(strike('lanca', [[0, -5]]) === 1)} | 3 enfileirados = só 1 ${ok(strike('lanca', [[0, -1.6], [0, -3], [0.4, -4.2]]) === 1)} | golpe forte também só 1 ${ok(strike('lanca', [[0, -1.6], [0.3, -2.4]], 2) === 1)}`);
  out(`  Espada: não alcança a 5 ${ok(strike('espada', [[0, -5]]) === 0)} | Manopla: não alcança a 3 ${ok(strike('manopla', [[0, -3]]) === 0)} | acerta a 1,5 ${ok(strike('manopla', [[0, -1.5]]) === 1)}`);
  out(`  Mangual: acerta dos lados ${ok(strike('mangual', [[-3.2, 0.6], [3.2, 0.6], [0, -3.5]]) === 3)} | Espada não pega os lados ${ok(strike('espada', [[-2.2, 0.6], [2.2, 0.6]]) === 0)}`);
  out(`  Machado: 2º golpe gira (acerta atrás) ${ok(strike('machado', [[0, 2]], 1) === 1)}`);
  const dmgOf = (wid, i) => player.setWeapon(wid) && 0 || player.hero.combo[i].damage;
  out(`  dano: Machado forte ${dmgOf('machado', 2)} > Espada forte ${dmgOf('espada', 2)} ${ok(dmgOf('machado', 2) > dmgOf('espada', 2))} | Mangual ${dmgOf('mangual', 0)} < Espada ${dmgOf('espada', 0)} ${ok(dmgOf('mangual', 0) < dmgOf('espada', 0))}`);

  // Combo de verdade: conta os golpes e o tempo de cada arma.
  const comboRun = function* (wid) {
    combat.clear(); player.setWeapon(wid);
    player.position.set(0, 0, 0); player.facing = Math.PI;
    const e = spawnAt(0, -1.4); e.hp = e.maxHp = 9999; e.shieldCovers = () => false;
    flags.events.length = 0;
    let t = 0, tr = '';
    const root = findBone(player.model, 'root');
    let spin = 0, lastYaw = null, spinT = 0;
    yield () => {
      t += 1 / 60;
      // Giro do 2º golpe: soma quanto o corpo (osso root) girou enquanto o golpe 2 está ativo.
      if (player.state === 'attack' && player.combo === 1) {
        spinT += 1 / 60;
        const q = root.quaternion, yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
        if (lastYaw !== null) { let d = yaw - lastYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); spin += d; }
        lastYaw = yaw;
      }
      const k = `${player.state[0]}${player.combo}`;
      if (!tr.endsWith(k)) tr += ` ${k}`;
      // clica até o último golpe sair (clicar durante o último recomeçaria o combo)
      if ((player.state !== 'attack' && t < 0.05) || (player.state === 'attack' && player.combo < player.hero.combo.length - 1 && player.anim.progress() > 0.2)) press('KeyJ');
      return t > 0.05 && player.state !== 'attack';
    };
    if (wid === 'manopla') out(`  rastro manopla:${tr}`);
    return { swings: flags.events.filter((x) => x.type === 'swing').length, t, spin: Math.abs(spin) * 180 / Math.PI, spinT };
  };
  const res = {};
  for (const w of WEAPONS.knight) { res[w.id] = yield* comboRun(w.id); }
  out(`  combos: ${WEAPONS.knight.map((w) => `${w.id} ${res[w.id].swings} golpes/${res[w.id].t.toFixed(2)} s`).join(' | ')}`);
  out(`  Manopla tem 4 golpes ${ok(res.manopla.swings === 4)} | os outros 3 ${ok(['espada', 'machado', 'mangual', 'lanca'].every((k) => res[k].swings === 3))} | Manopla mais rápida por golpe ${ok(res.manopla.t / 4 < res.espada.t / 3)} | Machado mais lento ${ok(res.machado.t > res.espada.t)}`);
  out(`  Machado: giro do 2º golpe ${res.machado.spin.toFixed(0)}° em ${res.machado.spinT.toFixed(2)} s ${ok(res.machado.spin >= 350, 'volta completa')} | combo inteiro ${res.machado.t.toFixed(2)} s ${ok(Math.abs(res.machado.t - 2.82) < 0.15, 'mesmo tempo de antes ~2,82')}`);

  // Manopla dourada + esbarrão perdoado.
  player.setWeapon('manopla');
  const gm = player.glowMats.find((m) => m.userData.glowBase);
  out(`  Manopla dourada e brilhando: ${ok(gm && gm.emissiveIntensity > 0.2 && gm.color.r > 0.9 && gm.color.b < 0.4)}`);
  const bumpTest = function* (wid) {
    combat.clear(); player.setWeapon(wid);
    player.hp = player.maxHp; player.iframes = 0; player.bumpGrace = player.bumpWindow = 0;
    player.position.set(0, 0, 0); player.setState('idle');
    const e = combat.spawn('minion', 0, -0.9, { awake: true, passive: true });
    e.abilities = true; // o encostão só vale para esqueletos "de verdade"
    const hp0 = player.hp;
    combat.separate();
    const afterFirst = player.hp;
    yield 0.7; // passou o tempo de graça, ainda dentro da janela
    player.iframes = 0; player.setState('idle');
    e.position.set(player.position.x, 0, player.position.z - 0.9);
    combat.separate();
    const afterSecond = player.hp;
    combat.clear();
    return { first: hp0 - afterFirst, second: afterFirst - afterSecond };
  };
  const bm = yield* bumpTest('manopla');
  const bs = yield* bumpTest('espada');
  out(`  Manopla: 1º esbarrão ${bm.first} de dano ${ok(bm.first === 0)} | 2º logo depois ${bm.second} ${ok(bm.second > 0)} | Espada: 1º esbarrão ${bs.first} ${ok(bs.first > 0)}`);
  // Golpe/investida (não é esbarrão) machuca mesmo com a Manopla.
  player.setWeapon('manopla'); player.hp = player.maxHp; player.iframes = 0; player.bumpGrace = player.bumpWindow = 0; player.setState('idle');
  const w2 = combat.spawn('warrior', 0, -3, { awake: true, passive: true });
  const hpC = player.hp;
  combat.hitPlayer(w2, 20, { push: 8, target: player });
  out(`  Manopla: investida machuca igual ${ok(player.hp < hpC)}`);
  player.hp = player.maxHp; player.iframes = 0; player.setState('idle');
  combat.clear();
  player.setWeapon('mangual');
  player.position.set(0, 0, 2);
  yield 0.8;
  out('  -> Mangual na mão: CONGELADO (T continua)');
  yield 'hold';

  // ---------------- 35) Morte: ouro vira Ouro de Alma ----------------
  out('35) Morrer: o ouro que sobrou vira Ouro de Alma');
  const soul0 = save.data.soul, runs0 = save.data.runs || 0;
  player.gold = 37;
  player.die();
  yield () => hud.deathVisible;
  out(`  tela de morte ${ok(hud.deathVisible)} | +37 Ouro de Alma ${ok(save.data.soul === soul0 + 37, `${save.data.soul - soul0}`)} | partidas ${save.data.runs} ${ok(save.data.runs === runs0 + 1)} | recorde andar ${ok(save.data.best >= 1)}`);
  const txt = document.querySelector('#hud .dead .stats').textContent;
  run.bankSoul(false);
  out(`  aparece na tela ${ok(/\+37 Ouro de Alma/.test(txt))} | não soma duas vezes ${ok(save.data.soul === soul0 + 37)}`);
  hud.onRetry();
  yield 0.4;
  out(`  "Voltar à Taverna": ${ok(run.inTavern)} | herói zerado (ouro ${player.gold}) ${ok(player.gold === 0 && !Object.keys(player.blessings).length)} | volta com a arma salva (Machado) ${ok(player.weaponId === 'machado')}`);

  // ---------------- 36) Co-op na Taverna ----------------
  out('36) Co-op: cada um com o seu Ouro de Alma e a sua arma; descem juntos');
  const p2 = g.addGuest();
  yield 0.3;
  p2.saveData.soul = 600;
  const mySoul = save.data.soul;
  run.take(item('manopla'), p2);
  out(`  Jogador 2 comprou a Manopla: Ouro de Alma dele 600 -> ${p2.saveData.soul} ${ok(p2.saveData.soul === 100 && p2.saveData.ups.w_knight_manopla === 1)} | equipada nele ${ok(p2.weaponId === 'manopla')} | o Jogador 1 não mudou ${ok(save.data.soul === mySoul && player.weaponId === 'machado')}`);
  yield () => door().k >= 0.6;
  player.position.set(door().x, 0, door().z + 0.6);
  p2.position.set(6, 0, 6);
  yield 0.8;
  out(`  só um na porta: espera o parceiro ${ok(run.inTavern && !run.transition)}`);
  yield* walkIn([player, p2]);
  out(`  os dois na porta: desceram ${ok(run.floorNum === 1)} | J1 Machado ${ok(player.weaponId === 'machado')} | J2 Manopla ${ok(p2.weaponId === 'manopla')}`);
  const entry = g.coopEntry ? g.coopEntry(p2) : null;
  if (entry) out(`  arma do J2 vai para o outro PC: ${ok(entry[25] === 'knight/manopla')}`);
  p2.gold = 15; player.gold = 5;
  waves.stop(); combat.clear();
  player.die(); p2.die();
  yield () => hud.deathVisible;
  out(`  morreram: Jogador 2 ganhou 15 ${ok(p2.saveData.soul === 115)} | Jogador 1 ganhou 5 ${ok(save.data.soul === mySoul + 5)}`);
  player.setWeapon('espada');
}
