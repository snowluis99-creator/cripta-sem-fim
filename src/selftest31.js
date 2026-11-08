// Teste automático, parte 31 (07/11/2026): bênçãos novas da Rapieira (rapkit.js / rapprops.js).
// Tecla Home = só a Rapieira (corrido); PageUp = com as pausas de screenshot; também roda no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { RAP } from './rapkit.js';
import { rap3Tests } from './selftest33.js';

const ok = (c, extra = '') => (c ? `✔${extra !== '' ? ` ${extra}` : ''}` : `ERRO${extra !== '' ? ` (${extra})` : ''}`);

export function* rapTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const K = combat.rap;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const fresh = (inp = {}) => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('rogue', 'rapieira'); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    clearStrip(-13, 13, -16, 8);
    combat.props.list = combat.props.list.filter((b) => Math.abs(b.x) > 13 || b.z < -16 || b.z > 8);
    player.input = fake(inp);
    player.iframes = 0;
    flags.events.length = 0;
  };
  const give = (id) => player.addBlessing(BLESSINGS.find((x) => x.id === id));
  const dummy = (x, z, type = 'minion', hp = 999, passive = true, facing = 0) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; e.facing = facing; e.group.rotation.y = facing; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const C = () => player.hero.combo;
  const hit = (i = 0) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const parry = (e, dmg = 10) => { player.rapRipCd = 0; player.iframes = 0; player.useAbility(null); combat.hitPlayer(e, dmg, { target: player }); };
  const errs0 = (window.__game.errors || []).length;

  out('353) Rapieira: bênçãos (sem aparar, com Ripostar)');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'rogue.rapieira');
  const want = ['Assinatura', 'Ponto Fraco', 'Precisão Cirúrgica', 'Chuva de Estocadas', 'Golpe Fantasma', 'Ripostar', 'Velocidade da Luz', 'Vem Dançar'];
  const gone = ['Riposta', 'Reflexos Felinos', 'Aparar Restaurador', 'Mestre Espadachim', 'Câmera Lenta', 'Desarme', 'Rebater', 'Lâmina Cantante', 'Punhal de Canhota', 'Espadachim Fantasma',
    'En Garde', 'Aparar em Cadeia', 'Bravata', 'Aplausos', 'Valsa', 'Mosqueteiro', 'Passo de Esgrima', 'Capa do Toureiro', 'Estocada Relâmpago'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  const by = (n) => mine.find((b) => b.name === n) || {};
  out(`  ${mine.length} bênçãos (sem as de aparar, + 8 da 3ª leva, + 2 de 08/11, − 3 tiradas) ${ok(mine.length === 18)} | ficaram ${ok(!miss.length, miss.join(', '))} | as de aparar saíram ${ok(!gone.some((n) => mine.some((b) => b.name === n)))} | Ripostar épica ${ok(by('Ripostar').rarity === 'epic')}`);

  out('375) Sem o aparar: o botão direito não faz nada sem o Ripostar');
  fresh(); yield 0.1;
  const used = player.useAbility(null);
  out(`  botão direito sem bênção ${ok(!used && player.state !== 'parry')} | descrição sem aparar ${ok(!/aparar/i.test(player.hero.desc || ''))}`);

  out('376) Ripostar: nega o dano por 0,5 s e devolve na mira');
  fresh(); yield 0.1; give('w_rap31');
  let atk = dummy(0, 0.9, 'warrior', 999, true, Math.PI);
  const side = dummy(0.4, -1.6, 'minion', 999, true), off = dummy(5, 2, 'minion', 999, true);
  player.aimAngle = () => Math.PI; // mira no atacante (na frente, para -z)
  const hp0 = player.hp;
  out(`  começou ${ok(player.useAbility(null) && player.state === 'rapRiposte')} | recarga 20 s ${ok(Math.abs(player.rapRipCd - RAP.riposte.cd) < 0.01)}`);
  yield 0.1;
  combat.hitPlayer(atk, 12, { target: player }); yield 0.05;
  combat.hitPlayer(atk, 8, { target: player });
  out(`  dano negado ${ok(player.hp === hp0 && ev('rapRipCatch').length === 2, hp0 - player.hp)} | guardou 20 ${ok(player.rapRip && player.rapRip.stored === 20, player.rapRip && player.rapRip.stored)}`);
  out('  -> guarda do Ripostar (screenshot)');
  yield 'hold';
  yield () => ev('rapRipStrike').length > 0;
  const st = ev('rapRipStrike')[0];
  out(`  estocou depois de 0,5 s ${ok(!!st)} | devolveu ${ok(st && st.dmg >= 20 + RAP.riposte.base - 1 && 999 - atk.hp >= 20, 999 - atk.hp)} | atordoou ${ok(atk.state === 'hurt', atk.state)} | longe da mira não ${ok(off.hp === 999)}`);
  yield 0.05;
  out('  -> estocada do Ripostar (screenshot)');
  yield 'hold';
  yield 0.4;
  out(`  voltou ao normal ${ok(player.state !== 'rapRiposte', player.state)} | depois do 0,5 s o dano entra ${ok((combat.hitPlayer(atk, 5, { target: player }), player.hp < hp0))}`);
  player.hp = player.maxHp; player.iframes = 0;
  out(`  em recarga não usa ${ok(!player.useAbility(null))}`);
  // nada negado: só deixa lento
  fresh(); yield 0.1; give('w_rap31');
  atk = dummy(0, 0.9, 'minion', 999, true, Math.PI);
  player.aimAngle = () => Math.PI; player.useAbility(null);
  yield 0.7;
  out(`  sem negar nada: deixa lento, sem atordoar ${ok(atk.slow > 0 && !(atk.state === 'hurt' && atk.stunTime >= 1), atk.slow.toFixed(1))}`);
  // flecha também é negada
  fresh(); yield 0.1; give('w_rap31');
  const arc = dummy(0, 7, 'archer', 999, true, Math.PI);
  player.aimAngle = () => Math.PI; player.useAbility(null);
  combat.projectiles.fire(0, 3, Math.PI, { damage: 9, owner: arc, speed: 20 });
  yield 0.3;
  out(`  flecha negada ${ok(ev('rapRipCatch').length >= 1 && player.hp === player.maxHp, ev('rapRipCatch').length)}`);
  delete player.aimAngle;

  out('366) Assinatura: 3º golpe marca; 3 marcas = sangra muito');
  fresh(); yield 0.1; give('w_rap23');
  const sg = dummy(0, -0.5, 'minion', 999, true, 0);
  hit(2); yield 0.1; hit(2); yield 0.1;
  out(`  2 marcas ${ok(ev('rapSign').length === 2 && K.signs.get(sg) && K.signs.get(sg).n === 2)}`);
  out('  -> 2 marcas (screenshot)');
  yield 'hold';
  hit(2);
  out(`  3 marcas: sangrando ${ok(ev('rapSignBleed').length === 1)}`);
  const hpS = sg.hp;
  yield 3.2;
  const bled = ev('rapSignTick').reduce((a, x) => a + x.dmg, 0);
  out(`  sangrou muito ${ok(bled >= 20 && hpS - sg.hp >= 20, bled)} | marca some ${ok(!K.signs.has(sg))}`);
  hit(0); hit(1);
  out(`  só o 3º golpe marca ${ok(!K.signs.has(sg))}`);

  out('367) Ponto Fraco: ponto brilhante a cada 4 s; estocar = golpe perfeito');
  fresh(); yield 0.1; give('w_rap24');
  const wk = dummy(0, -0.5, 'minion', 999, true, 0), wk2 = dummy(0.2, -3.5, 'minion', 999, true, 0);
  yield () => ev('rapWeak').length > 0;
  out(`  apareceu ${ok(ev('rapWeak').length === 1 && K.weak && K.weak.e === wk)}`);
  out('  -> ponto fraco (screenshot)');
  yield 'hold';
  hit(0);
  const wh = ev('hit').find((h) => h.enemy === wk);
  out(`  perfeito ${ok(ev('rapWeakHit').length === 1 && wh && wh.dmg >= 25, wh && wh.dmg)} | atravessou ${ok(wk2.hp < 999)} | atordoou ${ok(wk.state === 'hurt' && wk.stunTime >= RAP.weak.stun - 0.01)} | sumiu ${ok(!K.weak)}`);
  yield RAP.weak.every + 0.2;
  out(`  volta a cada 4 s ${ok(ev('rapWeak').length === 2)}`);

  out('368) Precisão Cirúrgica: 3 estocadas no mesmo = escudo para de bloquear');
  fresh(); yield 0.1; give('w_rap25');
  const sh = combat.spawn('warrior', 0, -0.4, { awake: true, passive: true, facing: 0 }); sh.hp = sh.maxHp = 999; sh.facing = 0; sh.group.rotation.y = 0;
  hit(0); hit(0);
  out(`  bloqueou 2 ${ok(ev('blocked').length === 2 && sh.hp === 999)}`);
  hit(0);
  out(`  3ª: armadura furada ${ok(ev('rapPierce').length === 1 && sh.rapPierced)}`);
  out('  -> armadura furada (screenshot)');
  yield 'hold';
  sh.setState('chase');
  hit(0);
  out(`  agora entra ${ok(sh.hp < 999 && ev('blocked').length === 3, 999 - sh.hp)}`);

  out('370) Chuva de Estocadas: segurar o ataque = estocadas rapidíssimas');
  fresh(); yield 0.1; give('w_rap27');
  const fl = dummy(0, -0.6, 'minion', 999, true, 0);
  let held = true;
  player.input = fake({ attack: () => held, attackHeld: () => held });
  yield 0.3;
  out(`  chuva ${ok(player.state === 'rapFlurry' && ev('rapFlurry').length === 1, player.state)}`);
  yield 0.7;
  out(`  rapidíssimas ${ok(ev('rapFlurryStab').length >= 7, ev('rapFlurryStab').length)} | acertou ${ok(fl.hp < 999 - 15, 999 - fl.hp)}`);
  out('  -> chuva de estocadas (screenshot)');
  yield 'hold';
  held = false; yield 0.05;
  out(`  soltou: para ${ok(player.state !== 'rapFlurry')}`);

  out('372) Golpe Fantasma: pelas costas = outra estocada meio segundo depois');
  fresh(); yield 0.1; give('w_rap29');
  const gb = dummy(0, -0.5, 'minion', 999, true, Math.PI); // de costas para o herói
  hit(0);
  const hpE = gb.hp;
  out(`  estocada fantasma ${ok(ev('rapEcho').length === 1)}`);
  yield 0.3;
  out('  -> rapieira fantasma (screenshot)');
  yield 'hold';
  yield 0.4;
  out(`  acertou de novo ${ok(ev('rapEchoHit').length === 1 && gb.hp < hpE, hpE - gb.hp)}`);
  const gf = dummy(3, -0.5, 'minion', 999, true, 0); void gf;
  combat.enemies.forEach((e) => { if (e !== gb) e.position.set(9, 0, 9); });
  gb.facing = 0; gb.group.rotation.y = 0; gb.setState('chase'); hit(0);
  out(`  de frente: não ${ok(ev('rapEcho').length === 1)}`);

  out('374) Rapieira com as 15: sem erros');
  fresh({ moveDir: (v) => v.set(0, 0, -1) }); yield 0.1;
  for (const b of mine) for (let i = 0; i < b.max; i++) player.addBlessing(b);
  const all = [];
  for (let i = 0; i < 6; i++) all.push(dummy(-4 + i * 1.6, -3 - (i % 2) * 2.5, i % 3 === 1 ? 'warrior' : 'minion', 60, false));
  all.push(dummy(0, -10, 'archer', 60, false));
  for (let t = 0; t < 40; t++) {
    const a = all.find((x) => x.alive) || all[0];
    player.facing = Math.atan2(a.position.x - player.position.x, a.position.z - player.position.z);
    if (player.state === 'idle' || player.state === 'run') player.startAttack(null);
    if (t % 7 === 6) player.startDodge();
    if (t % 5 === 4) parry(a, 3);
    if (t === 12) player.input = fake({ moveDir: (v) => v.set(0, 0, -1), attack: () => true, attackHeld: () => true });
    else if (t === 16) player.input = fake({ moveDir: (v) => v.set(0, 0, -1) });
    yield 0.25;
  }
  player.input = fake();
  yield 2.5;
  const errs = (window.__game.errors || []).length - errs0;
  out(`  sem erros do jogo ${ok(errs === 0, errs)}`);
  player.input = realInput;
  yield* rap3Tests(g, out, flags); // 3ª leva (08/11)
}
