// Teste automático, parte 17 (04/11/2026): cenas que congelam o jogo (Coração de Fênix e Vassalo),
// cavalo novo, salas novas do andar 1, baú em toda sala e sem moedas de enfeite. Tecla Y = tudo.
import { BLESSINGS } from './blessings.js';
import { ROOMS, COMBAT_ROOMS } from './dungeon/rooms.js';
import { PHOENIX } from './phoenix.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* sceneTests(g, out, flags) {
  const { player, combat, waves, run } = g;
  const realInput = player.input;
  const fresh = (weapon = 'espada') => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('knight', weapon); player.reset(0, 2); player.facing = Math.PI;
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion') => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = 40; e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };

  // ---------------- 94) Coração de Fênix: cena ----------------
  out('94) Coração de Fênix: o jogo para, a fênix aparece e o herói levanta');
  fresh(); yield 0.1;
  g.ult.cinematic = true;
  give('fenix');
  const foe = dummy(3, 0); foe.passive = false;
  const fz = foe.position.clone();
  player.hp = 0; player.die();
  out(`  cena começou ${ok(!!g.ult.cine && g.ult.cine.p === player)} | voltou com metade ${ok(player.hp === Math.round(player.maxHp / 2))}`);
  yield PHOENIX.bird + 0.15;
  const bird = document.querySelector('.phoenixfx');
  out(`  fênix na tela ${ok(bird && bird.classList.contains('on'))} | o resto congelado ${ok(foe.position.distanceTo(fz) < 0.01)}`);
  out('  -> fênix (screenshot)');
  yield 'hold';
  yield* until(() => !g.ult.cine, 5000);
  out(`  cena acabou: herói de pé ${ok(player.state === 'idle')} | invencível 3 s ${ok(player.iframes >= 2.9 && player.invulnerable)}`);
  g.ult.cinematic = false;

  // ---------------- 95) Vassalo: cena ----------------
  out('95) Vassalo: ajoelha e é nomeado cavaleiro');
  fresh(); yield 0.1;
  g.ult.cinematic = true;
  give('w_esp27');
  combat.kit2.vassalKey = null;
  const vs = [dummy(-2, -3), dummy(4, -2, 'warrior')];
  Object.assign(waves, { waves: [[['minion', 1], ['warrior', 1]]], wave: 0, state: 'fighting', queue: [] });
  vs[0].die(); combat.killed(vs[0], 0, 1, player);
  yield 0.1;
  const v = vs[1];
  out(`  cena começou ${ok(!!g.ult.cine && g.ult.cine.actors && g.ult.cine.actors[0] === v)}`);
  yield 1.4;
  const dist = Math.hypot(v.position.x - player.position.x, v.position.z - player.position.z);
  out(`  veio até o herói e ajoelhou ${ok(Math.abs(dist - 1.35) < 0.4, dist.toFixed(2))} | espada erguida ${ok(player.anim.currentName === 'Melee_1H_Attack_Chop')}`);
  out('  -> espada na cabeça (screenshot)');
  yield 'hold';
  yield* until(() => !g.ult.cine, 4000);
  const gear = v.vassalGear;
  out(`  capa e ombreiras ${ok(gear && gear.cape && gear.pads.length === 2)} | luta do seu lado ${ok(v.vassal && v.undead === player && v.alive)} | herói livre ${ok(player.state === 'idle')}`);
  v.passive = true; v.vel.set(0, 0, 0);
  g.cam.setCine(0.4);
  yield 0.4;
  out('  -> vassalo de capa (screenshot)');
  yield 'hold';
  g.cam.setCine(1);
  g.ult.cinematic = false;

  // ---------------- 96) Cavalo novo ----------------
  out('96) Cavalo Fantasma: modelo novo');
  fresh(); yield 0.1;
  give('w_esp29');
  player.input = { moveDir: (o) => o.set(0, 0, 0), aimAngle: () => null, attack: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => true };
  player.facing = Math.PI / 2;
  player.startDodge();
  const hz = player.kit.horse;
  let parts = 0; if (hz) hz.g.traverse((o) => { if (o.isMesh) parts++; });
  out(`  montou ${ok(player.state === 'horse')} | cavalo com ${parts} peças ${ok(parts > 40)} | pernas com joelho ${ok(hz && hz.legs.every((l) => l.knee))}`);
  g.cam.setCine(0.4);
  yield 0.5;
  out('  -> cavalo galopando (screenshot)');
  yield 'hold';
  g.cam.setCine(1);
  yield* until(() => player.state !== 'horse', 3000);
  player.input = realInput;

  // ---------------- 97) Salas ----------------
  out('97) Salas: novas do andar 1, baú em todas, sem moedas de enfeite');
  const novas = ['biblioteca', 'celas', 'adega', 'quartel', 'esgoto'];
  out(`  ${COMBAT_ROOMS.length} salas no andar 1 ${ok(novas.every((r) => COMBAT_ROOMS.includes(r)))}`);
  const semBau = Object.entries(ROOMS).filter(([, r]) => r.special !== 'merchant' && r.special !== 'tavern' && !(r.props || []).some((p) => /trunk|chest/.test(p[0]))).map(([id]) => id);
  out(`  baú em toda sala ${ok(!semBau.length, semBau.join(', '))}`);
  const moedas = Object.entries(ROOMS).filter(([, r]) => (r.props || []).some((p) => /coin|props\/loot/.test(p[0]))).map(([id]) => id);
  out(`  sem moedas de enfeite ${ok(!moedas.length, moedas.join(', '))}`);
  const errs0 = (window.__game.errors || []).length;
  for (const id of novas) {
    fresh(); yield 0.1;
    run.enter({ kind: 'combat', reward: 'none', room: id, waves: [[['minion', 1]]], level: 1 }, true);
    yield 0.3;
    const chests = combat.props.list.filter((b) => b.chest).length;
    out(`  ${ROOMS[id].name}: montou ${ok(!!run.built && run.built.room === ROOMS[id])} | baús que quebram: ${chests} ${ok(chests >= 1)} | pilares: ${combat.demo.list.length}`);
    for (const e of combat.enemies) e.passive = true;
    player.position.set(0, 0, 1); g.cam.setCine(1.25);
    yield 2;
    out(`  -> sala ${id} (screenshot)`);
    yield 'hold';
    g.cam.setCine(1);
  }
  out(`  ${ok((window.__game.errors || []).length === errs0, 'sem erros')}`);
  fresh(); yield 0.1;
}
