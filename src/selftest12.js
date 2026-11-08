// Teste automático, parte 12 (26/10/2026): Grimório em cone, gelo congela o dobro, todo golpe interrompe,
// escudo do Cavaleiro desequilibra, bênçãos exclusivas das armas (10 por arma), sala da ultimate garantida e a
// cena da ultimate. Tecla Y = tudo; tecla 4 = só esta parte.
import { BLESSINGS, rollBlessings } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { WEAPONS } from './heroes.js';
import { generateFloor } from './dungeon/generator.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* wbTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const fresh = (hero, wid) => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero(hero, wid); player.reset(0, 2); player.facing = Math.PI;
    flags.events.length = 0;
  };
  const dummy = (x, z, type = 'minion', facing = 0) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing }); e.hp = e.maxHp = 999; return e; };
  const hits = () => flags.events.filter((e) => e.type === 'hit');
  const waitHits = function* (n = 1, ms = 3000) { const t0 = performance.now(); yield () => hits().length >= n || performance.now() - t0 > ms; };

  // ---------------- 54) Grimório em cone + gelo ----------------
  out('54) Gelo congela o dobro (chefe não)');
  fresh('mage', 'gelo'); yield 0.2;
  const m = dummy(0, -1), boss = dummy(3, 2, 'guardian');
  combat.playerStrike(player, player.hero.combo[2]);
  yield* waitHits(1);
  const fm = m.frozenT;
  player.facing = Math.atan2(boss.position.x - player.position.x, boss.position.z - player.position.z);
  flags.events.length = 0;
  combat.playerStrike(player, player.hero.combo[2]);
  yield* waitHits(1);
  out(`  3º golpe: lacaio congelado ${ok(fm > 4.0 && fm <= 4.4, fm && fm.toFixed(2))} | chefe ${ok(boss.frozenT > 0.8 && boss.frozenT <= 1.1, boss.frozenT && boss.frozenT.toFixed(2))}`);

  // ---------------- 55) Todo golpe interrompe ----------------
  out('55) Todo golpe de toda arma interrompe o inimigo (igual à espada)');
  const interrupts = function* (hero, wid, idx = 0) {
    fresh(hero, wid); yield 0.2;
    const foe = dummy(0, -0.4); foe.passive = false; foe.shieldCovers = () => false;
    foe.startAttack();
    const st0 = foe.state;
    flags.events.length = 0;
    combat.playerStrike(player, player.hero.combo[idx]);
    yield* waitHits(1);
    out(`  ${wid}: ${st0} -> ${foe.state} ${ok(st0 === 'attack' && foe.state === 'hurt')}`);
  };
  for (const [h, w, i] of [['knight', 'espada'], ['knight', 'lanca'], ['mage', 'cajado'], ['mage', 'eletrico'], ['mage', 'trevas'], ['mage', 'gelo'], ['mage', 'fogo'], ['rogue', 'garras'], ['rogue', 'kunai'], ['rogue', 'besta']]) yield* interrupts(h, w, i);

  // ---------------- 56) Escudo do Cavaleiro desequilibra ----------------
  out('56) Escudo do Cavaleiro: inimigo que bate nele fica desequilibrado (rebatido e vulnerável)');
  fresh('knight', 'espada'); yield 0.2;
  const a = combat.spawn('minion', 0, 0.5, { awake: true, facing: 0 }); a.hp = a.maxHp = 999;
  player.facing = Math.PI; player.setState('block'); player.anim.play(player.hero.anims.blocking);
  const z0 = a.position.z;
  combat.hitPlayer(a, 10, { target: player });
  yield 0.15;
  out(`  rebatido ${ok(a.position.z < z0 - 0.4, (a.position.z - z0).toFixed(2))} | atordoado ${ok(a.state === 'hurt')} | desequilibrado ${ok(a.offBalanceT > 0)} | herói sem dano ${ok(player.hp === player.maxHp)}`);
  combat.clear();
  const wr = combat.spawn('warrior', 0, 0.8, { awake: true, facing: 0 }); wr.hp = wr.maxHp = 999;
  player.setState('block');
  combat.hitPlayer(wr, 10, { target: player });
  yield 0.05;
  wr.stunTime = 0; wr.setState('chase'); // saiu do atordoamento, ainda desequilibrado
  player.setState('idle'); player.facing = Math.atan2(wr.position.x - player.position.x, wr.position.z - player.position.z);
  flags.events.length = 0;
  combat.playerStrike(player, player.hero.combo[0]);
  out(`  Guerreiro desequilibrado: golpe fraco passa pelo escudo e atordoa ${ok(hits().length === 1 && wr.state === 'hurt', wr.state)}`);

  // ---------------- 57) Bênçãos das armas ----------------
  out('57) Bênçãos exclusivas: 10 por arma, só aparecem para a arma certa; tiradas as que não fazem sentido');
  const all = Object.entries(WEAPONS).flatMap(([h, list]) => list.map((w) => [h, w.id]));
  const per = all.map(([h, w]) => WEAPON_BLESSINGS.filter((b) => b.weapon === `${h}.${w}`).length);
  out(`  ${all.length} armas, ${WEAPON_BLESSINGS.length} bênçãos ${ok(per.every((n) => n >= 9), per.join(','))} | ids únicos ${ok(new Set(BLESSINGS.map((b) => b.id)).size === BLESSINGS.length)}`);
  for (const [h, w] of all) {
    fresh(h, w);
    const seen = new Set();
    let wrong = 0, silly = 0;
    for (let i = 0; i < 400; i++) for (const b of rollBlessings({}, 3, 'common', Math.random, player.hero)) {
      if (b.weapon) { seen.add(b.id); if (b.weapon !== `${h}.${w}`) wrong++; }
      if (b.needs && !b.needs(player.hero)) silly++;
      if ((w === 'kunai' || w === 'besta') && ['alcance', 'terremoto', 'fogo', 'eco'].includes(b.id)) silly++;
      if ((w === 'lanca' || w === 'rapieira' || h === 'mage') && b.id === 'terremoto') silly++;
      if (w === 'fogo' && b.id === 'fogo') silly++;
    }
    out(`  ${w}: aparecem ${seen.size} das suas ${ok(seen.size >= 9 && wrong === 0, `${wrong} de outra arma`)} | sem bênção sem sentido ${ok(silly === 0, silly)}`);
  }
  yield 0.1;
  // Pega todas as bênçãos de cada arma e luta um pouco: nada pode dar erro. Desde a v169 só Espada e Machado ainda têm bênção de dano/velocidade base.
  for (const [h, w] of all) {
    fresh(h, w); yield 0.1;
    const before = JSON.stringify(player.hero.combo.map((c) => [Math.round(c.damage * 100), Math.round(c.speed * 100)]));
    for (const b of WEAPON_BLESSINGS.filter((x) => x.weapon === `${h}.${w}`)) for (let k = 0; k < b.max; k++) player.addBlessing(b);
    const after = JSON.stringify(player.hero.combo.map((c) => [Math.round(c.damage * 100), Math.round(c.speed * 100)]));
    const dz = Math.min(1.6, (player.hero.attackRange || 3) * 0.55); // perto o bastante até para a manopla
    for (let i = 0; i < 4; i++) dummy(-0.9 + i * 0.6, 2 - dz - (i % 2) * 0.3);
    player.iframes = 99;
    const errs0 = (window.__game.errors || []).length;
    let swings = 0;
    for (let t = 0; t < 40; t++) {
      const st = player.hero.combo[t % player.hero.combo.length];
      try { combat.playerStrike(player, st); swings++; } catch (e) { out(`  ${w}: ERRO ${e.message}`); break; }
      if (player.hero.ammo) { player.ammo = Array.from({ length: player.hero.ammo.max }, () => ({ stack: 5 })); }
      yield 0.1;
    }
    const dmg = hits().reduce((s, e) => s + e.dmg, 0);
    out(`  ${w}: ${swings} golpes, ${hits().length} acertos, dano ${dmg} ${ok(hits().length > 5 && (window.__game.errors || []).length === errs0)} | herói mudou ${ok(before !== after || !['espada', 'machado'].includes(w))}`);
    player.iframes = 0;
  }
  // Checagens pontuais.
  fresh('rogue', 'kunai'); yield 0.1;
  player.addBlessing(BLESSINGS.find((b) => b.id === 'w_kun5'));
  out(`  Bolsa Extra: 3 kunais na mão ${ok(player.ammo.length === 3 && player.hero.ammo.max === 3)}`);
  fresh('mage', 'cajado'); yield 0.1;
  player.addBlessing(BLESSINGS.find((b) => b.id === 'w_caj5'));
  const n0 = combat.projectiles.list.length;
  combat.playerStrike(player, player.hero.combo[0]);
  out(`  Orbe Duplo: 2 orbes ${ok(combat.projectiles.list.length - n0 === 2)}`);
  fresh('mage', 'trevas'); yield 0.1;
  player.addBlessing(BLESSINGS.find((b) => b.id === 'w_tre5'));
  const mk = dummy(0, -0.5);
  combat.playerStrike(player, player.hero.combo[0]);
  { const t0 = performance.now(); yield () => mk.hp < 999 || performance.now() - t0 > 2000; }
  out(`  Maldição: marca o inimigo ${ok(mk.markT > 0 && mk.markMul > 0.1)}`);
  fresh('knight', 'espada'); yield 0.1;
  player.addBlessing(BLESSINGS.find((b) => b.id === 'w_esp14'));
  const bz = combat.spawn('minion', 0, 0.5, { awake: true, facing: 0 }); bz.hp = bz.maxHp = 999;
  player.setState('block');
  combat.hitPlayer(bz, 10, { target: player });
  out(`  Escudo de Espinhos: bloquear machuca quem bateu ${ok(bz.hp < 999, 999 - bz.hp)}`);
  fresh('rogue', 'garras'); yield 0.1;
  player.addBlessing(BLESSINGS.find((b) => b.id === 'w_gar5'));
  const bl = dummy(0, -0.6);
  combat.playerStrike(player, player.hero.combo[4]);
  out(`  Dilacerar: 5º golpe soma 2 de sangramento ${ok(bl.bleedStacks === 2, bl.bleedStacks)}`);
  fresh('knight', 'machado'); yield 0.1;
  out(`  nova partida: herói volta ao normal ${ok(player.hero.combo[0].damage === WEAPONS.knight[1].set.combo[0].damage && !Object.keys(player.stats.w).length)}`);

  // ---------------- 58) Sala da ultimate garantida ----------------
  out('58) Toda partida tem pelo menos uma porta de Bênção da Ultimate por andar');
  let floors = 0, withUlt = 0;
  for (let i = 0; i < 60; i++) for (const n of [1, 2, 3]) {
    const f = generateFloor(n);
    floors++;
    if (f.steps.flat().some((o) => o.reward === 'ult')) withUlt++;
  }
  out(`  ${withUlt}/${floors} andares com a porta ${ok(withUlt === floors)}`);

  // ---------------- 59) Cena da ultimate ----------------
  out('59) Ultimate: o jogo congela, o herói levanta a arma e diz o nome, depois a ultimate sai');
  for (const [h, w] of [['knight', 'espada'], ['mage', 'cajado'], ['rogue', 'adagas']]) {
    fresh(h, w); yield 0.2;
    const foe = combat.spawn('minion', 0, -4, { awake: true }); foe.hp = foe.maxHp = 999;
    yield 0.3;
    const fz = foe.position.z;
    g.ult.cinematic = true;
    player.ult = player.ultNeed;
    const used = g.ult.use(player);
    yield 0.6;
    const during = !!g.ult.cine, still = Math.abs(foe.position.z - fz) < 0.01;
    const ban = document.querySelector('#hud .banner');
    const name = ban ? ban.textContent : '';
    const clip = player.anim.currentName;
    out(`  ${h}: começou ${ok(used && during)} | inimigo parado ${ok(still)} | animação ${clip} ${ok(/Cheering|Raise/.test(clip || ''))} | nome "${name}" ${ok(/!$/.test(name) && ban.classList.contains('ult'))}`);
    if (h === 'knight') { out('  -> cena da ultimate: CONGELADO (T continua)'); yield 'hold'; }
    yield 1.6;
    const after = !g.ult.cine;
    const fired = h === 'mage' ? foe.hp < 999 : player.ultTime > 0;
    out(`  ${h}: terminou ${ok(after)} | ultimate saiu ${ok(fired)} | barra gasta ${ok(player.ult < player.ultNeed)}`);
    g.ult.cinematic = false;
  }
}
