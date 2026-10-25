// Teste automático, parte 10: o Ladino (desbloquear com a cena "facas na parede", as 5 armas, fumaça,
// aparar, crítico e a ultimate Precisão Invejável). Tecla Y = tudo; tecla 0 = só esta parte.
import { resetSave } from './save.js';
import { HERO_PRICE, WEAPONS } from './heroes.js';
import { KUNAI, SMOKE, PARRY, ROGUE_ULT } from './rogue.js';
import { BLESSING_BY_ID, rollUltBlessings } from './blessings.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);
const holdKey = (code, down) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
const press = (code) => { holdKey(code, true); holdKey(code, false); };

export function* rogueTests(g, out, flags) {
  const { player, run, save, combat, waves, hud } = g;
  const cam = g.cam.camera;
  const seat = () => run.pickups.find((p) => p.opts.item === 'hero' && p.opts.heroId === 'rogue');
  const fresh = (wid = 'adagas') => {
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('rogue', wid); player.reset(0, 0); player.facing = Math.PI;
    flags.events.length = 0;
  };
  const dummy = (x, z, type = 'minion', facing = 0) => combat.spawn(type, x, z, { awake: true, passive: true, facing });
  const hits = () => flags.events.filter((e) => e.type === 'hit');
  // Aperta o botão direito por um quadro (fumaça / aparar).
  function* ability() { holdKey('ShiftLeft', true); yield 0.05; holdKey('ShiftLeft', false); yield 0.02; }

  // ---------------- 45) Desbloquear o Ladino ----------------
  out('45) Taverna: desbloquear o Ladino (1500) com a cena "facas na parede"');
  resetSave();
  g.toTavern();
  yield 0.4;
  out(`  cadeira do Ladino na mesa ${ok(!!seat())} | aviso ${ok(/Desbloquear o Ladino/.test(run.promptFor(seat(), player)))}`);
  save.update((s) => { s.soul = 2000; });
  run.take(seat(), player);
  const sc = run.unlock;
  out(`  pagou ${2000 - save.data.soul} ${ok(save.data.soul === 2000 - HERO_PRICE)} | cena começou ${ok(sc.active && sc.mode === 'rogue')} | jogador parado ${ok(player.state === 'cine')}`);
  yield () => sc.t >= 1.6;
  out(`  subiu na mesa ${ok(sc.mage.group.position.y > 0.9, sc.mage.group.position.y.toFixed(2))}`);
  yield () => sc.actors.every((a) => a.state === 'pinned');
  const pinned = sc.actors.filter((a) => a.state === 'pinned').length;
  out(`  todos presos na parede: ${pinned}/${sc.actors.length} ${ok(pinned === sc.actors.length && pinned >= 4)} | uma adaga para cada ${ok(sc.knives.filter((k) => k.state === 'stuck').length === pinned)} | jogador na parede ${ok(player.position.z < -10 && player.position.y > 0.3)}`);
  yield 0.3;
  out('  -> todos presos pela capa: CONGELADO (T continua)');
  yield 'hold';
  yield () => sc.actors.every((a) => a.state === 'free');
  out(`  reverência e estalo: todos caíram ${ok(sc.knives.every((k) => k.state === 'gone'))}`);
  yield () => !!document.getElementById('unlock');
  const pop = document.getElementById('unlock');
  out(`  aviso "Ladino desbloqueado" ${ok(pop && /Ladino desbloqueado/.test(pop.textContent) && /Agora ele pode/.test(pop.textContent))} | arte ${ok(/ladino\.jpg/.test(pop.querySelector('.uart').style.backgroundImage))}`);
  yield 1.4;
  out('  -> aviso na tela: CONGELADO (T continua)');
  yield 'hold';
  if (sc.active) { sc.popupAt = 0; sc.closePopup(); }
  yield () => !sc.active;
  yield 0.3;
  out(`  virou o Ladino ${ok(player.heroId === 'rogue')} | vida 70 ${ok(player.maxHp === 70 && player.hp === 70)} | salvo ${ok(save.data.ups.h_rogue === 1 && save.data.ups.eh === 2)} | anda ${ok(player.state !== 'cine' && player.position.y === 0)}`);
  const rack = (slot) => run.pickups.find((p) => p.opts.item === 'weapon' && p.opts.slot === slot);
  out(`  suporte com as armas do Ladino ${ok(rack(0) && rack(0).opts.weapon.id === 'adagas' && rack(4).opts.weapon.id === 'besta')} | sem escudo no HUD ${ok(hud.$('.shield').style.display === 'none')}`);

  // ---------------- 46) Adagas, crítico, fumaça e ultimate ----------------
  out('46) Duas Adagas: 25% de crítico, bomba de fumaça e Precisão Invejável');
  fresh('adagas');
  yield 0.2;
  out(`  duas adagas nas mãos ${ok(!!player.weapon && !!player.offhand && !player.shieldMesh)} | combo de 3 ${ok(player.hero.combo.length === 3)}`);
  const bag = dummy(0, -2, 'minion'); bag.hp = bag.maxHp = 1e6;
  const step = player.hero.combo[0];
  let crits = 0;
  for (let i = 0; i < 400; i++) { flags.events.length = 0; combat.damageEnemy(player, bag, step, 0, -1); const h = hits()[0]; if (h && h.dmg >= 12) crits++; }
  out(`  crítico em ${crits}/400 golpes ${ok(crits > 70 && crits < 130, `${Math.round(crits / 4)}%`)}`);
  // Fumaça
  const hp0 = player.hp;
  yield* ability();
  out(`  botão direito: fumaça ${ok(!!flags.last('smoke'))} | invisível ${ok(player.stealth > 1.5 && player.invulnerable)} | HUD ${ok(/invisível/.test(hud.$('.stx').textContent))}`);
  combat.hitPlayer(bag, 20, { target: player });
  out(`  esqueleto não acerta na fumaça ${ok(player.hp === hp0)} | modelo transparente ${ok(player.stealthShown < 0.5)}`);
  yield 0.3;
  out('  -> Ladino invisível: CONGELADO (T continua)');
  yield 'hold';
  flags.events.length = 0;
  combat.playerStrike(player, step);
  out(`  golpe saindo da fumaça é crítico ${ok(hits()[0] && hits()[0].dmg >= 12, hits()[0] && hits()[0].dmg)}`);
  flags.events.length = 0;
  yield* ability();
  out(`  fumaça recarregando (${SMOKE.cooldown} s) ${ok(!flags.last('smoke'))}`);
  yield SMOKE.cooldown + 0.1;
  out(`  recarregou ${ok(/pronta/.test(hud.$('.stx').textContent))}`);
  player.stealth = 0;
  yield () => player.state === 'idle' || player.state === 'run';
  // Ultimate
  player.ult = player.ultNeed;
  press('KeyR');
  yield 0.1;
  out(`  ${ROGUE_ULT.name}: ${ok(player.ultTime > 4.5)} | não fica invulnerável ${ok(!player.invulnerable)} | sem domo ${ok(!player.dome || !player.dome.visible)}`);
  let all = 0;
  for (let i = 0; i < 50; i++) { flags.events.length = 0; combat.damageEnemy(player, bag, step, 0, -1); const h = hits()[0]; if (h && h.dmg >= 12) all++; }
  out(`  100% de crítico: ${all}/50 ${ok(all === 50)}`);
  player.addBlessing(BLESSING_BY_ID.u_letal);
  flags.events.length = 0; combat.damageEnemy(player, bag, { damage: 10 }, 0, -1);
  out(`  Golpe Letal: crítico triplo ${ok(hits()[0] && hits()[0].dmg >= 27, hits()[0] && hits()[0].dmg)}`);
  const picks = rollUltBlessings({}, 'rogue');
  out(`  sala da ultimate oferece bênção do Ladino ${ok(picks.some((b) => b.hero === 'rogue') && !picks.some((b) => b.hero && b.hero !== 'rogue'))}`);
  yield ROGUE_ULT.time;
  combat.clear();

  // ---------------- 47) Kunais ----------------
  out('47) Kunais: 2 cargas, alcance infinito, pegar no círculo aumenta o dano');
  fresh('kunai');
  yield 0.2;
  const target = dummy(0, -9, 'minion'); target.hp = target.maxHp = 1e6;
  player.hero.crit = 0; // sem crítico aleatório: o dano tem que crescer sempre
  out(`  2 kunais na mão ${ok(player.ammo.length === 2)} | HUD ${ok(hud.$('.ammo').style.display === 'flex' && hud.$('.apips').children.length === 2)}`);
  const throwAt = function* () { player.facing = Math.PI; flags.events.length = 0; press('KeyJ'); yield () => flags.last('rogueFire'); };
  yield* throwAt();
  yield () => hits().length > 0;
  const d1 = (hits()[0] || {}).dmg;
  out(`  arremessou: ${player.ammo.length} na mão ${ok(player.ammo.length === 1)} | dano muito baixo ${ok(d1 <= 2 * 2.2, d1)}`);
  const it = g.rogue.items[0];
  out(`  acertou: voa para cima com círculo no chão ${ok(it && it.state === 'pop' && !!it.mark)}`);
  yield 0.25;
  out('  -> kunai voando e o círculo onde ela cai: CONGELADO (T continua)');
  yield 'hold';
  yield () => !g.rogue.items[0] || g.rogue.items[0].state === 'ground';
  out(`  não pegou: ficou no chão ${ok(g.rogue.items[0] && g.rogue.items[0].state === 'ground' && !!flags.last('kunaiMissed'))}`);
  player.position.set(g.rogue.items[0].x, 0, g.rogue.items[0].z);
  yield 0.1;
  out(`  andou por cima: pegou de volta ${ok(player.ammo.length === 2 && player.ammo.every((a) => a.stack === 0) && !!flags.last('ammoPick'))}`);
  // Pegando no círculo: dano cresce.
  const dmgs = [];
  for (let k = 0; k < 3; k++) {
    player.position.set(0, 0, 0);
    target.position.set(0, 0, -9); target.vel.set(0, 0, 0); // o empurrão do golpe não tira ele da linha
    yield 0.05;
    yield* throwAt();
    yield () => hits().length > 0;
    dmgs.push((hits()[0] || {}).dmg);
    const pi = g.rogue.items.find((x) => x.state === 'pop');
    if (pi) player.position.set(pi.to.x, 0, pi.to.z);
    yield () => flags.last('kunaiCatch') || flags.last('kunaiMissed');
    yield 0.05;
  }
  out(`  pegou no ar 3 vezes: dano ${dmgs.join(' -> ')} ${ok(dmgs[1] > dmgs[0] && dmgs[2] > dmgs[1])} | corrente ×${Math.max(...player.ammo.map((a) => a.stack)) + 1} no HUD ${ok(/corrente ×4/.test(hud.$('.ast').textContent), hud.$('.ast').textContent)}`);
  yield KUNAI.keep + 0.2;
  out(`  demorou para arremessar: corrente zerou ${ok(player.ammo.every((a) => a.stack === 0))}`);
  // Parede e sem munição.
  combat.clear(); g.rogue.clear(); player.ammo = [{ stack: 0, keep: 0 }, { stack: 0, keep: 0 }];
  player.position.set(0, 0, 0);
  yield* throwAt();
  yield () => flags.last('ammoWall');
  yield* throwAt();
  yield () => flags.events.filter((e) => e.type === 'ammoWall').length >= 2;
  flags.events.length = 0;
  press('KeyJ');
  yield 0.4;
  out(`  bateu na parede e ficou lá ${ok(g.rogue.items.length === 2 && g.rogue.items.every((x) => x.state === 'ground' && x.z < -6))} | sem kunais não arremessa ${ok(!flags.last('rogueFire') && player.ammo.length === 0)} | HUD "pegue do chão" ${ok(/pegue/.test(hud.$('.apips').textContent))}`);
  run.roomVersion++;
  yield 0.1;
  out(`  sala nova: as kunais voltam para a mão ${ok(player.ammo.length === 2 && g.rogue.items.length === 0)}`);

  // ---------------- 48) Garras ----------------
  out('48) Garras: combo de 5, não interrompe, 5º golpe sangra');
  fresh('garras');
  yield 0.2;
  out(`  combo de 5 ${ok(player.hero.combo.length === 5)} | duas garras ${ok(!!player.offhand)}`);
  const foe = dummy(0, -1.6, 'minion', 0); foe.hp = foe.maxHp = 500; foe.passive = false;
  foe.startAttack();
  combat.playerStrike(player, player.hero.combo[0]);
  out(`  acertou no meio do ataque dele: ele continua atacando ${ok(foe.state === 'attack')}`);
  combat.clear();
  const foe2 = dummy(0, -1.6, 'minion', 0); foe2.hp = foe2.maxHp = 500;
  combat.playerStrike(player, player.hero.combo[4]);
  const hpB = foe2.hp;
  out(`  5º golpe: sangrando ${ok(foe2.bleed > 3)}`);
  yield 1.6;
  out(`  sangrou ${hpB - foe2.hp} de vida ${ok(hpB - foe2.hp >= 6)}`);
  yield 'hold';
  // Comparação: as adagas interrompem.
  player.setWeapon('adagas');
  const foe3 = dummy(1.2, -1.4, 'minion', 0); foe3.hp = foe3.maxHp = 500; foe3.passive = false;
  foe3.startAttack(); player.facing = Math.atan2(1.2, -1.4);
  combat.playerStrike(player, player.hero.combo[0]);
  out(`  (as Adagas interrompem: ${ok(foe3.state === 'hurt')})`);
  combat.clear();

  // ---------------- 49) Rapieira ----------------
  out('49) Rapieira: 1 alvo, crítico pelas costas, aparar no instante exato');
  fresh('rapieira');
  yield 0.2;
  const front = dummy(0, -2.5, 'minion', 0); front.hp = front.maxHp = 1e6;  // de frente para o herói
  const behind = dummy(0.4, -3.6, 'minion', Math.PI); behind.hp = behind.maxHp = 1e6; // de costas
  flags.events.length = 0;
  combat.playerStrike(player, player.hero.combo[0]);
  out(`  acerta só 1 inimigo ${ok(hits().length === 1)}`);
  combat.clear();
  const back = dummy(0, -2.5, 'minion', Math.PI); back.hp = back.maxHp = 1e6;
  let bs = 0;
  for (let i = 0; i < 20; i++) { flags.events.length = 0; combat.damageEnemy(player, back, player.hero.combo[0], 0, -1); if (hits()[0].dmg >= 10) bs++; }
  out(`  pelas costas: crítico ${bs}/20 ${ok(bs === 20)}`);
  combat.clear();
  const atk = dummy(0, -1.6, 'warrior', 0); atk.passive = false;
  const hp1 = player.hp;
  yield* ability();
  out(`  botão direito: aparar ${ok(player.state === 'parry')}`);
  combat.hitPlayer(atk, 20, { target: player });
  atk.passive = true; // daqui em diante ele não ataca sozinho
  out(`  golpe no instante certo: aparou ${ok(!!flags.last('parry') && player.hp === hp1)} | atordoou ${ok(atk.state === 'hurt' && atk.stunTime >= PARRY.stun - 0.01)} | próximo golpe crítico ${ok(player.parryCrit)}`);
  yield 0.2;
  out('  -> aparou: CONGELADO (T continua)');
  yield 'hold';
  yield PARRY.total + PARRY.cooldown + 0.2;
  flags.events.length = 0;
  yield* ability();
  yield PARRY.window + 0.08;
  player.iframes = 0;
  combat.hitPlayer(atk, 20, { target: player });
  out(`  errou o tempo: levou o golpe ${ok(!flags.last('parry') && player.hp < hp1, `${hp1} -> ${player.hp}`)}`);
  combat.clear();

  // ---------------- 50) Besta ----------------
  out('50) Besta de mão: 3 virotes, cai embaixo do inimigo, pega andando por cima');
  fresh('besta');
  yield 0.2;
  const mark = dummy(0, -8, 'minion'); mark.hp = mark.maxHp = 1e6;
  out(`  3 virotes ${ok(player.ammo.length === 3)} | dica de controle ${ok(/atirar/.test(document.getElementById('controls').textContent))}`);
  yield* throwAt();
  yield () => hits().length > 0;
  const bd = (hits()[0] || {}).dmg;
  yield 0.05;
  const bolt = g.rogue.items[0];
  out(`  dano médio ${ok(bd >= 10 && bd <= 30, bd)} | caiu embaixo dele ${ok(bolt && bolt.state === 'ground' && Math.hypot(bolt.x - mark.position.x, bolt.z - mark.position.z) < 1.2)} | ${player.ammo.length} na mão ${ok(player.ammo.length === 2)}`);
  yield 0.3;
  out('  -> virote no chão: CONGELADO (T continua)');
  yield 'hold';
  player.position.set(bolt.x, 0, bolt.z + 1);
  yield 0.1;
  out(`  pegou de volta ${ok(player.ammo.length === 3)}`);
  combat.clear();
  // Arremesso sai na hora certa da animação (sem travar) e o Jogador volta ao normal.
  player.setWeapon('adagas');
  out(`  trocar de arma tira os virotes da mão ${ok(player.ammo.length === 0 && !player.hero.ammo)}`);
  g.restart();
  out(`  todas as armas do Ladino: ${WEAPONS.rogue.map((w) => w.short).join(', ')}`);
}
