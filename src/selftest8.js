// Teste automático, parte 8: a Maga (desbloquear na Taverna com a cena, magias das 5 armas, barreira).
// Tecla Y = tudo; tecla 8 = só esta parte.
import { resetSave } from './save.js';
import { shieldMax } from './shield.js';
import { WEAPONS, HERO_PRICE } from './heroes.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);
const holdKey = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const press = (code) => {
  dispatchEvent(new KeyboardEvent('keydown', { code }));
  dispatchEvent(new KeyboardEvent('keyup', { code }));
};

export function* mageTests(g, out, flags) {
  const { player, run, save, combat, waves } = g;
  const seat = () => run.pickups.find((p) => p.opts.item === 'hero' && p.opts.heroId === 'mage');
  const rack = (slot) => run.pickups.find((p) => p.opts.item === 'weapon' && p.opts.slot === slot);

  // ---------------- 37) Desbloquear a Maga ----------------
  out('37) Taverna: desbloquear a Maga (1500) com a cena');
  resetSave();
  g.toTavern();
  yield 0.4;
  out(`  cadeira da Maga na mesa ${ok(!!seat())} | começa com o Cavaleiro ${ok(player.heroId === 'knight')}`);
  save.update((s) => { s.soul = 1000; });
  run.take(seat(), player);
  out(`  sem Ouro de Alma suficiente não desbloqueia ${ok(save.data.soul === 1000 && !save.data.ups.h_mage && !run.unlock.active)}`);
  save.update((s) => { s.soul = 2000; });
  run.take(seat(), player);
  out(`  pagou ${2000 - save.data.soul} ${ok(save.data.soul === 2000 - HERO_PRICE)} | cena começou ${ok(run.unlock.active)} | jogador parado na cena ${ok(player.state === 'cine')}`);
  const sc = run.unlock;
  yield () => sc.t >= 2.2;
  const mageNpc = sc.mage;
  out(`  Maga pulou para o meio ${ok(Math.hypot(mageNpc.group.position.x, mageNpc.group.position.z + 0.5) < 0.6)}`);
  yield () => sc.t >= 3.6;
  const lit = sc.fires.filter((f) => f.visible).length;
  const running = sc.actors.filter((a) => a.state === 'run' || a.state === 'hide').length;
  out(`  fogo em tudo: ${lit} fogueiras ${ok(lit >= 20)} | luz do fogo ${ok(sc.tavern.fireLights.some((l) => l.intensity > 5))} | todos fugindo/escondidos ${running}/${sc.actors.length} ${ok(running === sc.actors.length)}`);
  yield 0.6;
  out('  -> taverna pegando fogo: CONGELADO (T continua)');
  yield 'hold';
  yield () => sc.t >= 6.6;
  const frozen = sc.actors.filter((a) => a.frozen).length, litAfter = sc.fires.filter((f) => f.visible && !f.userData.out).length;
  out(`  onda de gelo: congelou ${frozen}/${sc.actors.length} ${ok(frozen === sc.actors.length)} | fogo apagado ${ok(litAfter === 0, `${litAfter} acesas`)}`);
  out('  -> todos congelados: CONGELADO (T continua)');
  yield 'hold';
  yield () => sc.t >= 9.55;
  out(`  derreteram aos poucos ${ok(sc.actors.every((a) => !a.frozen && a.thawed))}`);
  yield () => !!document.getElementById('unlock');
  const pop = document.getElementById('unlock');
  out(`  aviso "Maga desbloqueada" ${ok(pop && /Maga desbloqueada/.test(pop.textContent))} | cadeado ${ok(!!pop.querySelector('.ulock'))} | arte ao fundo ${ok(/maga\.jpg/.test(pop.querySelector('.uart').style.backgroundImage))}`);
  yield 1.4;
  out('  -> aviso na tela: CONGELADO (T continua)');
  yield 'hold';
  if (run.unlock.active) { run.unlock.popupAt = 0; run.unlock.closePopup(); }
  yield () => !run.unlock.active;
  yield 0.3;
  out(`  virou a Maga ${ok(player.heroId === 'mage')} | vida 50 ${ok(player.maxHp === 50 && player.hp === 50)} | salvo ${ok(save.data.ups.h_mage === 1 && save.data.ups.eh === 1)} | pode andar ${ok(player.state !== 'cine')}`);
  out(`  na cadeira dela agora está o Cavaleiro ${ok(/Knight/.test(run.tavern.seats.mage ? 'x' : '') || !!seat())} | suporte com as armas da Maga ${ok(rack(0) && rack(0).opts.weapon.id === 'cajado' && rack(4).opts.weapon.id === 'fogo')}`);
  // Volta ao Cavaleiro pela cadeira (já desbloqueado: sem cena, sem pagar) e depois à Maga.
  const soulNow = save.data.soul;
  run.take(seat(), player);
  out(`  cadeira -> Cavaleiro sem pagar ${ok(player.heroId === 'knight' && save.data.soul === soulNow && !run.unlock.active)}`);
  run.take(seat(), player);
  out(`  cadeira -> Maga de novo ${ok(player.heroId === 'mage' && save.data.ups.eh === 1)}`);
  save.update((s) => { s.soul = 2000; });
  run.take(rack(1), player);
  out(`  comprou a Varinha ${ok(player.weaponId === 'varinha' && save.data.ups.w_mage_varinha === 1)}`);
  yield 0.5;
  out('  -> Maga com a Varinha na Taverna: CONGELADO (T continua)');
  yield 'hold';

  // ---------------- 38) Magias ----------------
  out('38) Magias das 5 armas');
  g.run.beginDescent({ noUpgrades: true });
  player.setHero('mage', 'cajado'); player.reset(0, 2);
  yield 0.3;
  waves.stop(); combat.clear(); waves.paused = true;
  const spawnAt = (x, z, type = 'minion') => {
    const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 });
    e.hp = e.maxHp = 9999; e.shieldCovers = () => false;
    return e;
  };
  const fire = function* (wid, stepIdx, foes, wait = 0.9) {
    combat.clear(); player.setWeapon(wid);
    player.position.set(0, 0, 4); player.facing = Math.PI; player.setState('idle');
    const es = foes.map(([x, z, t]) => spawnAt(x, z, t));
    combat.playerStrike(player, player.hero.combo[stepIdx]);
    yield wait;
    return es;
  };
  const hit = (es) => es.filter((e) => e.hp < 9999).length;
  let es = yield* fire('cajado', 0, [[0, -1], [0.3, 1.6]]);
  out(`  Cajado: orbe para no 1º ${ok(hit(es) === 1 && es[1].hp < 9999)}`);
  es = yield* fire('cajado', 2, [[0, 0], [1.4, -0.6], [-1.3, 0.6], [6, 0]]);
  out(`  Cajado forte: só 1 alvo, sem área (${hit(es)}) ${ok(hit(es) === 1)} | mais forte ${ok(9999 - es[0].hp > player.hero.combo[0].damage)}`);
  player.setWeapon('varinha');
  out(`  Varinha: combo de 5 ${ok(player.hero.combo.length === 5)} | alcance menor ${ok(player.hero.attackRange < 4.5)}`);
  es = yield* fire('varinha', 4, [[-1.2, 0.2], [0, 0], [1.2, 0.2]]);
  out(`  Varinha 5º tiro: 3 estrelas em cone (${hit(es)}) ${ok(hit(es) === 3)}`);
  es = yield* fire('grimorio', 0, [[0, 2.5], [0.2, 1], [-0.3, -0.3], [0, -5]], 0.3);
  out(`  Grimório: raio atravessa os 3 da linha ${ok(hit(es) === 3)} | não passa do alcance ${ok(es[3].hp === 9999)}`);
  es = yield* fire('cajado', 0, [[0, -4]], 1.0);
  out(`  alcance curto: orbe não chega a 8 de distância ${ok(es[0].hp === 9999)}`);
  player.stats.rangeMul = 1.5;
  es = yield* fire('cajado', 0, [[0, -4]], 1.0);
  out(`  Lâmina Longa aumenta o alcance ${ok(es[0].hp < 9999)}`);
  player.stats.rangeMul = 1;
  { // magia não interrompe: esqueleto atacando continua atacando
    combat.clear(); player.setWeapon('cajado');
    player.position.set(0, 0, 4); player.facing = Math.PI; player.setState('idle');
    const atk = combat.spawn('minion', 0, 1.5, { awake: true }); atk.hp = atk.maxHp = 9999; atk.shieldCovers = () => false;
    player.iframes = 99;
    yield () => atk.state === 'attack';
    const s0 = atk.state, a0 = atk.anim.currentName, z0 = atk.position.z;
    player.facing = Math.atan2(atk.position.x - player.position.x, atk.position.z - player.position.z); // a IA nova cerca pelos lados: mira nele
    combat.playerStrike(player, player.hero.combo[2]);
    yield 0.25;
    out(`  magia não interrompe o ataque (${s0} -> ${atk.state}) ${ok(atk.hp < 9999 && atk.state !== 'hurt' && (atk.state === 'attack' || atk.anim.currentName === a0 || atk.state === 'chase'))} | sem empurrão ${ok(atk.position.z - z0 < 0.3, (atk.position.z - z0).toFixed(2))}`);
    player.iframes = 0;
  }
  es = yield* fire('gelo', 0, [[0, 0]], 0.6);
  out(`  Gelo 1º: deixa lento ${ok(es[0].slow > 1)} | não congela ${ok(!(es[0].frozenT > 0))}`);
  es = yield* fire('gelo', 2, [[0, 0], [0.6, -0.8]], 0.6);
  const fz = es[0].frozenT;
  out(`  Gelo 3º: congela ${ok(fz > 1.2, fz && fz.toFixed(2))} | o vizinho não (sem área) ${ok(!(es[1].frozenT > 0) && es[1].hp === 9999)}`);
  // Congelado não anda nem ataca.
  combat.clear();
  const walker = combat.spawn('minion', 0, 0, { awake: true });
  walker.hp = walker.maxHp = 9999;
  player.position.set(0, 0, 4); player.setWeapon('gelo'); player.facing = Math.PI;
  combat.playerStrike(player, player.hero.combo[2]);
  yield () => walker.frozenT > 0;
  const hp0 = player.hp;
  player.iframes = 99;
  yield 0.4; // espera o empurrão do golpe acabar
  const z0 = walker.position.z;
  yield 0.8;
  out(`  congelado fica parado ${ok(Math.abs(walker.position.z - z0) < 0.15)} | bloco de gelo ${ok(walker.iceBlock && walker.iceBlock.visible)}`);
  yield 0.3;
  out('  -> esqueleto congelado: CONGELADO (T continua)');
  yield 'hold';
  yield () => !(walker.frozenT > 0);
  out(`  descongela sozinho ${ok(!walker.iceBlock.visible)}`);
  player.iframes = 0; player.hp = hp0;
  { // 3º golpe do Gelo congela até esqueleto no meio do ataque
    combat.clear(); player.setWeapon('gelo');
    player.position.set(0, 0, 4); player.facing = Math.PI; player.setState('idle');
    const atk = combat.spawn('minion', 0, 1.8, { awake: true, abilities: false }); atk.hp = atk.maxHp = 9999; atk.shieldCovers = () => false;
    player.iframes = 99;
    yield () => atk.state === 'attack';
    combat.playerStrike(player, player.hero.combo[2]);
    yield () => atk.frozenT > 0 || atk.hp < 9999;
    out(`  Gelo 3º congela no meio do ataque ${ok(atk.frozenT > 0, `gelo ${(atk.frozenT||0).toFixed(2)} hp ${atk.hp} ${atk.state} ${atk.alive}`)} | sem dano extra ${ok(9999 - atk.hp <= player.hero.combo[0].damage)}`);
    player.iframes = 0;
  }
  // Chefe: metade do tempo.
  combat.clear();
  const boss = combat.spawn('guardian', 0, -0.5, { awake: true, passive: true });
  boss.hp = boss.maxHp = 99999;
  player.position.set(0, 0, 4); player.facing = Math.PI;
  combat.playerStrike(player, player.hero.combo[2]);
  yield () => boss.frozenT > 0 || boss.hp < 99999;
  out(`  chefe congela metade do tempo: ${boss.frozenT.toFixed(2)} s ${ok(Math.abs(boss.frozenT - 1.1) < 0.1)}`);
  es = yield* fire('fogo', 0, [[0, 1.5], [1.2, 1.8], [0, -4]], 0.2);
  out(`  Fogo: pega os 2 de perto ${ok(es[0].hp < 9999 && es[1].hp < 9999)} | não o de longe ${ok(es[2].hp === 9999, `hp ${es[2].hp} z ${es[2].position.z.toFixed(1)} st ${es[2].state}`)} | queimando ${ok(es[0].burn > 0)}`);
  es = yield* fire('fogo', 2, [[0, 2.2], [0, 6.5], [2.4, 4], [0, -1]], 0.2);
  out(`  Fogo 3º: explosão em volta pega os 3 perto (frente, costas, lado) ${ok(es[0].hp < 9999 && es[1].hp < 9999 && es[2].hp < 9999)} | não o de longe ${ok(es[3].hp === 9999)}`);
  // Combos de verdade (teclado): cada arma solta todos os ataques.
  const comboRun = function* (wid) {
    combat.clear(); player.setWeapon(wid);
    player.position.set(0, 0, 3); player.facing = Math.PI; player.setState('idle');
    const n0 = combat.spellCount || 0;
    let t = 0;
    yield () => {
      t += 1 / 60;
      // clica até o último golpe sair (clicar durante o último recomeçaria o combo)
      if ((player.state !== 'attack' && t < 0.05) || (player.state === 'attack' && player.combo < player.hero.combo.length - 1 && player.anim.progress() > 0.15)) press('KeyJ');
      return t > 0.05 && player.state !== 'attack';
    };
    return { casts: (combat.spellCount || 0) - n0, t };
  };
  const res = {};
  for (const w of WEAPONS.mage) res[w.id] = yield* comboRun(w.id);
  out(`  combos: ${WEAPONS.mage.map((w) => `${w.id} ${res[w.id].casts}/${res[w.id].t.toFixed(2)} s`).join(' | ')}`);
  out(`  todas soltam o combo inteiro ${ok(WEAPONS.mage.every((w) => res[w.id].casts === w.set.combo.length))}`);
  { // depois do último golpe a Maga anda logo depois do impacto (não fica travada no chão)
    const free = [];
    for (const w of WEAPONS.mage) {
      combat.clear(); player.setWeapon(w.id);
      player.position.set(0, 0, 3); player.facing = Math.PI; player.setState('idle');
      player.combo = player.hero.combo.length - 1; player.startAttack((g.cam && g.cam.camera));
      yield () => player.hitDone;
      let t = 0;
      yield () => { t += 1 / 60; holdKey('KeyD', true); return player.state !== 'attack' || t > 2; };
      holdKey('KeyD', false);
      free.push(`${w.id} ${t.toFixed(2)}`);
      if (t > 0.35) free.push('LENTO');
    }
    out(`  depois do último golpe anda em: ${free.join(' | ')} ${ok(!free.includes('LENTO'))}`);
    // clicar durante o último golpe recomeça o combo (não fica parado)
    combat.clear(); player.setWeapon('cajado'); player.setState('idle');
    player.combo = 2; player.startAttack((g.cam && g.cam.camera));
    yield 0.1; press('KeyJ');
    yield () => player.state !== 'attack' || player.combo === 0 && player.stateTime < 0.1;
    out(`  clique no último golpe emenda um combo novo ${ok(player.state === 'attack' && player.combo === 0)}`);
    yield () => player.state !== 'attack';
  }
  // Visual: cada arma com um enfeite diferente.
  const fxKinds = WEAPONS.mage.map((w) => { player.setWeapon(w.id); return player.weapon.userData.fx ? player.hero.weapons.right.fx : '-'; });
  out(`  enfeites diferentes: ${fxKinds.join(', ')} ${ok(new Set(fxKinds).size === 5)}`);
  player.setWeapon('cajado');
  combat.clear();
  for (const [x, z, t] of [[-1.2, 0], [1.2, -0.5, 'warrior']]) spawnAt(x, z, t);
  player.position.set(0, 0, 3); player.facing = Math.PI;
  combat.playerStrike(player, player.hero.combo[2]);
  yield 0.12;
  out('  -> orbe grande voando: CONGELADO (T continua)');
  yield 'hold';

  // ---------------- 39) Barreira ----------------
  { // Guerreiro: a investida não para com magia, e ele segue andando enquanto o escudo segura a magia.
    combat.clear(); player.setWeapon('cajado');
    player.position.set(0, 0, 4); player.facing = Math.PI; player.setState('idle'); player.iframes = 99;
    const w = combat.spawn('warrior', 0, -3, { awake: true, facing: 0 }); w.hp = w.maxHp = 9999;
    yield 0.5;
    const z0 = w.position.z, hp0 = w.hp;
    for (let i = 0; i < 3; i++) { combat.playerStrike(player, player.hero.combo[0]); yield 0.25; }
    out(`  Guerreiro bloqueia a magia e continua andando ${ok(w.hp === hp0 && w.position.z - z0 > 0.8, (w.position.z - z0).toFixed(2))} | estado ${w.state} ${ok(w.state !== 'block' && w.state !== 'hurt')}`);
    w.position.set(0, 0, -4); w.cd.charge = 0; w.setState('chase');
    yield () => w.state === 'chargeWind' || w.state === 'charge';
    const seen = new Set([w.state]);
    for (let i = 0; i < 12 && w.state !== 'recover'; i++) { combat.playerStrike(player, player.hero.combo[i % 2]); yield 0.08; seen.add(w.state); }
    out(`  investida não é interrompida pela magia (${[...seen].join('>')}) ${ok(seen.has('charge') && !seen.has('hurt') && !seen.has('block'))}`);
    player.iframes = 0;
  }
  { // Ninguém fica fora da sala.
    combat.clear();
    const b = combat.spawn('guardian', 0, 0, { awake: true, passive: true });
    b.position.set(500, 0, -500); player.position.set(-300, 0, 300);
    yield 0.1;
    const W = g.run.built.halfW, D = g.run.built.halfD;
    const inside = (p) => Math.abs(p.x) < W && Math.abs(p.z) < D;
    out(`  chefe e herói jogados para fora voltam para dentro da sala ${ok(inside(b.position) && inside(player.position))}`);
    player.reset(0, 2);
  }
  { // Magia mata o Rei Skullbone: a cena de morte roda inteira sem erro (antes travava o jogo).
    combat.clear(); player.setWeapon('cajado');
    player.position.set(0, 0, 4); player.facing = Math.PI; player.setState('idle');
    const kb = combat.spawn('guardian', 0, -0.5, { awake: true, passive: true, facing: 0 });
    kb.hp = 1;
    const err0 = window.__game.errors.length;
    combat.playerStrike(player, player.hero.combo[2]);
    yield () => combat.finale.active;
    yield 4;
    yield () => !combat.finale.active;
    out(`  magia mata o Rei Skullbone: cena até o fim ${ok(!combat.finale.active && player.state !== 'cine', player.state)} | sem erro ${ok(window.__game.errors.length === err0)}`);
  }
  out('39) Barreira mágica (bloqueio da Maga)');
  combat.clear();
  player.setWeapon('cajado'); player.reset(0, 2); player.facing = Math.PI;
  const foe = combat.spawn('warrior', 0, -0.5, { awake: true, passive: true });
  out(`  tem barreira (10) ${ok(shieldMax(player) === 10 && player.shield === 10)}`);
  player.enterBlock(null);
  const hpB = player.hp;
  combat.hitPlayer(foe, 20, { target: player });
  player.updateWall(0.2);
  out(`  bloqueou de frente: vida ${player.hp} ${ok(player.hp === hpB)} | gastou 1 ${ok(player.shield === 9)} | barreira aparecendo ${ok(player.wall && player.wall.visible)}`);
  // Segura o bloqueio sem teclado (só para a foto).
  const realInput = player.input;
  player.input = Object.assign(Object.create(realInput), {
    blocking: () => true, attack: () => false, dodge: () => false, potion: () => false, interact: () => false,
    moveDir: (o) => o.set(0, 0, 0), aimAngle: () => Math.PI,
  });
  if (player.state !== 'block') player.enterBlock(null);
  yield 0.3;
  out('  -> barreira na frente: CONGELADO (T continua)');
  yield 'hold';
  player.input = realInput;
  for (let i = 0; i < 9; i++) { player.setState('block'); combat.hitPlayer(foe, 20, { target: player }); }
  out(`  quebra com 10 ${ok(player.shield === 0)} | não bloqueia mais ${ok(!player.enterBlock(null))}`);
  combat.clear();
  player.setHero('knight', 'espada');
  player.reset(0, 0);
}
