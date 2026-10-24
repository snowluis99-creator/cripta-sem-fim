// Teste automático das jogadas em dupla (co-op): Golpe Duplo, Visão Espectral, Costas com Costas e Poção Compartilhada.
// Tecla X (com o modo de teste ligado). Cria um Jogador 2 sem rede (comandos postos direto no RemoteInput).
import { TEAM } from './teamwork.js';

const keyDown = (code) => dispatchEvent(new KeyboardEvent('keydown', { code }));
const keyUp = (code) => dispatchEvent(new KeyboardEvent('keyup', { code }));
const press = (code) => { keyDown(code); keyUp(code); };
const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);
const near = (a, b, t = 0.05) => Math.abs(a - b) <= t;

export function* duoTests(g, out, flags) {
  const { player, combat, waves, team } = g;
  const hero = player.hero;
  const p2 = g.addGuest();
  const ri = p2.input;
  const fresh = () => {
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    ri.reset();
    player.position.set(0, 0, 0); player.facing = 0;
    p2.position.set(0, 0, 4); p2.facing = Math.PI;
    flags.events.length = 0;
  };
  const dummy = (x, z, type = 'minion') => combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 });

  // ---------------- 25) Golpe Duplo ----------------
  out('25) Golpe Duplo (golpe forte juntos, um de frente para o outro)');
  fresh();
  let foes = [dummy(-6, -5), dummy(7, 6), dummy(5, -6)];
  let hp0 = foes.map((e) => e.hp);
  player.onHit(player, hero.combo[2]);
  yield 0.1;
  p2.onHit(p2, hero.combo[2]);
  const lost = foes.map((e, i) => hp0[i] - e.hp);
  out(`  todos os esqueletos (longe) perderam ${lost.join('/')} ${ok(lost.every((d) => d === TEAM.combo.damage))} | aviso ${ok(!!flags.last('duo'))}`);
  // De costas um para o outro: não vale.
  fresh();
  foes = [dummy(-6, -5)]; hp0 = foes[0].hp;
  player.facing = Math.PI; p2.facing = 0;
  player.onHit(player, hero.combo[2]); p2.onHit(p2, hero.combo[2]);
  out(`  virados para lados opostos: sem Golpe Duplo ${ok(foes[0].hp === hp0 && !flags.last('duo'))}`);
  // Tempo demais entre os dois golpes: não vale.
  fresh();
  foes = [dummy(-6, -5)]; hp0 = foes[0].hp;
  player.onHit(player, hero.combo[2]);
  yield 1.0;
  p2.onHit(p2, hero.combo[2]);
  out(`  1 s de diferença: sem Golpe Duplo ${ok(foes[0].hp === hp0)}`);
  // Golpe fraco (1º do combo) não conta.
  fresh();
  foes = [dummy(-6, -5)]; hp0 = foes[0].hp;
  player.onHit(player, hero.combo[0]); p2.onHit(p2, hero.combo[0]);
  out(`  golpes fracos juntos: nada ${ok(foes[0].hp === hp0)}`);
  // De verdade: os dois fazem o combo inteiro ao mesmo tempo.
  fresh();
  foes = [dummy(-7, -6), dummy(7, 7)]; hp0 = foes.map((e) => e.hp);
  const click = () => { press('KeyJ'); ri.pend.atk++; };
  click(); yield 0.1;
  click(); yield () => player.combo === 1 && p2.combo === 1;
  yield 0.05;
  click(); yield () => player.combo === 2 && p2.combo === 2;
  yield () => player.state !== 'attack' && p2.state !== 'attack';
  out(`  combo dos dois pelo controle: Golpe Duplo saiu ${ok(!!flags.last('duo'))} | dano ${foes.map((e, i) => hp0[i] - e.hp).join('/')}`);
  yield 'hold';

  // ---------------- 26) Visão Espectral ----------------
  out('26) Visão Espectral (caído aperta E: avisos vermelhos por 15 s)');
  fresh();
  p2.die();
  let e = dummy(3, 3, 'warrior');
  e.passive = false;
  const arch = dummy(-4, 4, 'archer');
  yield 0.2;
  out(`  sem a visão: nenhum aviso ${ok(team.shapes.length === 0)}`);
  ri.pend.use++;
  yield 0.05;
  out(`  Jogador 2 caído apertou E: visão ligada ${ok(team.spectral > 14)} | uma vez por sala ${ok(p2.spectralUsed)}`);
  // Força o golpe e o tiro para ver os avisos.
  e.startAttack();
  arch.releaseToken && arch.releaseToken();
  arch.setState('aim'); arch.shot = arch.data.ranged; arch.hitDone = false; arch.t = 0;
  yield 0.05;
  const kinds = team.shapes.map((s) => s[0]);
  out(`  golpe vira círculo ${ok(kinds.includes(0))} | arqueiro mirando vira faixa ${ok(kinds.includes(1))}`);
  yield 'hold';
  const sp = team.spectral;
  ri.pend.use++;
  yield 0.05;
  out(`  2º E na mesma sala não renova ${ok(team.spectral < sp)}`);
  team.spectral = 0.05;
  yield 0.2;
  out(`  depois de 15 s os avisos somem ${ok(team.shapes.length === 0)}`);
  g.run.roomVersion++;
  yield 0.05;
  ri.pend.use++;
  yield 0.05;
  out(`  sala nova: pode usar de novo ${ok(team.spectral > 14)}`);
  // Herói vivo não liga a visão.
  fresh();
  press('KeyE');
  yield 0.05;
  out(`  vivo apertando E: nada ${ok(team.spectral <= 0)}`);

  // ---------------- 27) Costas com Costas ----------------
  out('27) Costas com Costas (os dois bloqueando encostados)');
  fresh();
  p2.position.set(0.4, 0, 1.25);
  keyDown('KeyK'); ri.blk = true;
  yield 0.3;
  const dFace = Math.abs(Math.atan2(Math.sin(player.facing - p2.facing), Math.cos(player.facing - p2.facing)));
  const dist = Math.hypot(player.position.x - p2.position.x, player.position.z - p2.position.z);
  out(`  ligaram ${ok(player.backToBack && p2.backToBack)} | olhando para lados opostos ${ok(near(dFace, Math.PI, 0.05), `${Math.round(dFace * 57.3)}°`)} | encostados ${ok(near(dist, 1.2, 0.08), dist.toFixed(2))}`);
  // Golpe vindo de qualquer lado é bloqueado.
  e = dummy(player.position.x + 2, player.position.z, 'minion');
  const side = combat.hitPlayer(e, 10, { target: player });
  out(`  golpe pelo lado bloqueado ${ok(side && flags.last('blockedHero'))}`);
  // Andam juntos.
  combat.clear();
  const x0 = player.position.x, x0b = p2.position.x;
  ri.mx = 1;
  yield 0.5;
  ri.mx = 0;
  const d2 = Math.hypot(player.position.x - p2.position.x, player.position.z - p2.position.z);
  out(`  andaram juntos: ${(player.position.x - x0).toFixed(1)} e ${(p2.position.x - x0b).toFixed(1)} ${ok(player.position.x - x0 > 1.5 && p2.position.x - x0b > 1.5)} | continuam encostados ${ok(near(d2, 1.2, 0.08))}`);
  yield 'hold';
  ri.blk = false;
  yield 0.1;
  out(`  soltou o bloqueio: separam ${ok(!player.backToBack && !p2.backToBack)}`);
  keyUp('KeyK');
  // Bloqueando longe um do outro: nada.
  fresh();
  keyDown('KeyK'); ri.blk = true;
  yield 0.3;
  out(`  bloqueando longe: não liga ${ok(!player.backToBack)}`);
  keyUp('KeyK'); ri.blk = false;
  yield 0.1;

  // ---------------- 28) Poção Compartilhada ----------------
  out('28) Poção Compartilhada (cura que sobra vai para o parceiro)');
  fresh();
  player.potions = 2; player.hp = 90; p2.hp = 50;
  press('KeyQ');
  yield () => player.state !== 'drink';
  yield 0.1;
  out(`  J1 90/100 bebe (35): J1 ${player.hp} ${ok(player.hp === 100)} | J2 50 -> ${p2.hp} ${ok(p2.hp === 75)}`);
  press('KeyQ');
  yield () => player.state !== 'drink';
  yield 0.1;
  out(`  vida cheia e parceiro machucado: bebe mesmo assim ${ok(player.potions === 0)} | J2 -> ${p2.hp} ${ok(p2.hp === 100)}`);
  fresh();
  player.potions = 1; player.hp = 100; p2.hp = 100;
  press('KeyQ');
  yield 0.6;
  out(`  os dois com vida cheia: não gasta ${ok(player.potions === 1)}`);
  fresh();
  player.potions = 1; player.hp = 95; p2.die();
  press('KeyQ');
  yield () => player.state !== 'drink';
  out(`  parceiro caído não recebe ${ok(p2.hp <= 0 && player.hp === 100)}`);
}
