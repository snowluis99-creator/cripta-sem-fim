// Teste automático, parte 22 (06/11/2026): bênçãos novas do Cajado Arcano (lista do dono).
// Tecla Y = tudo; tecla , (vírgula) = só o Cajado Arcano.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* arcTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('mage', 'cajado'); player.reset(0, 2); player.facing = Math.PI;
    clearStrip(-9, 9, -14, 8);
    player.input = fake();
    player.iframes = 0;
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion', hp = 999) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = hp; e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const C = () => player.hero.combo;
  const H = () => player.hero.combo[player.hero.heavyIdx];
  const cast = (i = 0) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const spells = () => combat.projectiles.list.filter((a) => a.hits === 'spell');
  const K = combat.arcane;
  const errs0 = (window.__game.errors || []).length;

  // ---------------- 171) Lista ----------------
  out('171) Cajado Arcano: bênçãos do dono');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'mage.cajado');
  const by = (n) => mine.find((b) => b.name === n) || {};
  const want = ['Ponto de Estouro', 'Pancada de Cajado', 'Armadura Arcana', 'Bolha Arcana', 'Esfera Moedora', 'Mina Arcana', 'Órbita', 'Triângulo Arcano', 'Constelação',
    'Encolher', 'Levitar', 'Repulsor', 'Ressonância', 'Carga Paciente', 'Fusão', 'Devorador', 'Piscar', 'Gêmea Arcana', 'Caos Arcano'];
  const miss = want.filter((n) => !mine.some((b) => b.name === n));
  out(`  ${mine.length} bênçãos (5 antigas + 19) ${ok(mine.length === 24)} | as 19 da lista ${ok(!miss.length, miss.join(', '))} | Singularidade continua ${ok(!!by('Singularidade').id)}`);
  out(`  raridades ${ok(by('Esfera Moedora').rarity === 'legendary' && by('Triângulo Arcano').rarity === 'legendary' && by('Piscar').rarity === 'legendary' && by('Gêmea Arcana').rarity === 'legendary'
    && by('Mina Arcana').rarity === 'rare' && by('Fusão').rarity === 'rare' && by('Armadura Arcana').rarity === 'epic' && by('Caos Arcano').rarity === 'epic')}`
    + ` | quem erra: só uma (Estouro/Mina/Órbita) ${ok(by('Mina Arcana').excludes.includes('w_caj11') && by('Mina Arcana').excludes.includes('w_caj17'))} | Bolha x Levitar ${ok(by('Bolha Arcana').excludes.includes('w_caj21'))} | Repulsor x Singularidade ${ok(by('Repulsor').excludes.includes('w_caj10'))}`);

  // ---------------- 172) Ponto de Estouro ----------------
  out('172) Ponto de Estouro: o orbe que erra explode no fim');
  fresh(); yield 0.1;
  give('w_caj11');
  const pe = dummy(1.4, -4.4);
  cast(0);
  yield* until(() => ev('arcBurst').length > 0, 1500);
  yield 0.1;
  out(`  explodiu no fim do alcance ${ok(ev('arcBurst').length === 1)} | pegou quem estava perto ${ok(pe.hp < 999)}`);

  // ---------------- 173) Pancada de Cajado ----------------
  out('173) Pancada de Cajado: inimigo colado leva pancada');
  fresh(); yield 0.1;
  give('w_caj12');
  const pc = dummy(0, 1.0);
  const z0 = pc.position.z;
  cast(0);
  out(`  virou pancada ${ok(ev('arcBash').length === 1 && spells().length === 0)} | atordoou ${ok(pc.state === 'hurt' && pc.stunTime >= 0.9)}`);
  yield 0.4;
  out(`  jogou longe ${ok(z0 - pc.position.z > 1, (z0 - pc.position.z).toFixed(1))}`);
  fresh(); yield 0.1; give('w_caj12'); dummy(0, -2.5);
  cast(0);
  out(`  longe: orbe normal ${ok(!ev('arcBash').length && spells().length === 1)}`);

  // ---------------- 174) Armadura Arcana ----------------
  out('174) Armadura Arcana: cada orbe que acerta = 1 camada');
  fresh(); yield 0.1;
  give('w_caj13');
  const am = dummy(0, -1);
  for (let i = 0; i < 3; i++) { cast(i); yield 0.35; }
  out(`  3 orbes = 3 camadas ${ok(player.arcArmor === 3, player.arcArmor)}`);
  yield 0.1;
  out('  -> camadas girando em volta da Maga (screenshot)');
  yield 'hold';
  const ha = player.hp;
  combat.hitPlayer(am, 7, { target: player });
  out(`  7 de dano anulado ${ok(player.hp === ha && ev('arcArmor').length === 1 && ev('arcArmor')[0].saved === 7)} | gastou 3 camadas ${ok(player.arcArmor === 0)}`);

  // ---------------- 175) Bolha Arcana ----------------
  out('175) Bolha Arcana: prende 3 s; outro orbe estoura');
  fresh(); yield 0.1;
  give('w_caj14');
  const ba = dummy(0, -1), bb = dummy(1.3, -1.6);
  cast(2);
  yield* until(() => ev('arcBubble').length > 0, 1000);
  out(`  prendeu ${ok(ba.state === 'orbBubble' && !!ba.arcBubble)}`);
  yield 0.2;
  out('  -> esqueleto na bolha (screenshot)');
  yield 'hold';
  const hb = bb.hp;
  cast(0);
  yield* until(() => ev('arcBubblePop').length > 0, 1000);
  out(`  estourou ${ok(ev('arcBubblePop').length === 1 && ba.state !== 'orbBubble')} | machucou o vizinho ${ok(bb.hp < hb)}`);
  fresh(); yield 0.1; give('w_caj14');
  const bc = dummy(0, -1);
  cast(2);
  yield 0.5;
  const pos = bc.position.clone();
  yield 2.8;
  out(`  sozinha some depois de 3 s ${ok(bc.state !== 'orbBubble')} | ficou parado ${ok(Math.hypot(bc.position.x - pos.x, bc.position.z - pos.z) < 0.2)}`);

  // ---------------- 176) Esfera Moedora ----------------
  out('176) Esfera Moedora: devagar, atravessa e mói');
  fresh(); yield 0.1;
  give('w_caj15');
  const gs = [dummy(0, 0.2), dummy(0, -1), dummy(0, -2.2)];
  cast(2);
  const gr = spells()[0];
  out(`  devagar ${ok(gr && gr.grind && Math.hypot(gr.vx, gr.vz) < 8, gr && Math.hypot(gr.vx, gr.vz).toFixed(1))}`);
  yield 0.4;
  out('  -> esfera passando pelos esqueletos (screenshot)');
  yield 'hold';
  yield* until(() => !spells().length, 2500);
  out(`  acertou os 3 ${ok(gs.every((e) => e.hp < 999))} | vários toques ${ok(ev('arcGrind').length >= 3, ev('arcGrind').length)}`);

  // ---------------- 177) Mina Arcana ----------------
  out('177) Mina Arcana: orbe que erra vira mina');
  fresh(); yield 0.1;
  give('w_caj16');
  cast(0);
  yield 0.5;
  out(`  ficou no chão ${ok(K.mines.length === 1)}`);
  const mn = K.mines[0];
  const md = dummy(mn ? mn.x + 4 : 4, mn ? mn.z : -3);
  yield 0.3;
  out(`  não explode sozinha ${ok(K.mines.length === 1 && md.hp === 999)}`);
  if (mn) md.position.set(mn.x + 0.5, 0, mn.z);
  yield 0.3;
  out(`  explodiu quando o esqueleto passou ${ok(ev('arcMineBoom').length === 1 && md.hp < 999)}`);

  // ---------------- 178) Órbita ----------------
  out('178) Órbita: orbe que erra volta e gira 4 s');
  fresh(); yield 0.1;
  give('w_caj17');
  cast(0);
  yield 0.6;
  out(`  voltou e gira ${ok(K.orbits.length === 1 && K.orbits[0].phase === 'orbit')}`);
  out('  -> orbe girando em volta da Maga (screenshot)');
  yield 'hold';
  const od = dummy(0, 2 - 1.9);
  yield* until(() => ev('arcOrbitHit').length > 0, 2000);
  out(`  acertou quem chegou perto ${ok(od.hp < 999)}`);
  yield 4;
  out(`  some depois de 4 s ${ok(K.orbits.length === 0)}`);

  // ---------------- 179) Triângulo Arcano ----------------
  out('179) Triângulo Arcano: 3 runas ligadas por linhas');
  fresh(); yield 0.1;
  give('w_caj18');
  for (const [x, z] of [[-3, 2], [3, 2], [0, -3]]) { player.position.set(x, 0, z); cast(2); yield 0.4; }
  out(`  3 runas ${ok((K.runes.get(player) || []).length === 3)} | 3 linhas ${ok((K.lineMeshes.get(player) || []).length === 3)}`);
  player.position.set(0, 0, -6);
  const tr = dummy(0, 2);
  yield 1.0;
  out(`  quem está na linha leva dano ${ok(tr.hp < 999 && ev('arcRuneHit').length >= 2)} | fica lento ${ok(tr.slow > 0)}`);
  out('  -> triângulo de luz no chão (screenshot)');
  yield 'hold';
  for (const [x, z] of [[-6, 4], [6, 4]]) { player.position.set(x, 0, z); cast(2); yield 0.4; }
  out(`  continua com 3 (a mais velha sai) ${ok((K.runes.get(player) || []).length === 3)}`);

  // ---------------- 180) Constelação ----------------
  out('180) Constelação: estrelas perto se ligam e machucam');
  fresh(); yield 0.1;
  give('w_caj19');
  const cs = [dummy(-1.1, -1.4), dummy(0, -1.9), dummy(1.1, -1.4)];
  cast(2);
  yield 0.3;
  out(`  3 estrelas ${ok(cs.every((e) => e.arcStarT > 0))}`);
  const hs = cs.map((e) => e.hp);
  yield 1.4;
  out(`  ligados machucam ${ok(ev('arcStarLink').length >= 1 && cs.every((e, i) => e.hp < hs[i]))}`);
  out('  -> raios de luz entre os esqueletos (screenshot)');
  yield 'hold';

  // ---------------- 181) Encolher ----------------
  out('181) Encolher: pequeno, lento e metade do dano');
  fresh(); yield 0.1;
  give('w_caj20');
  const en = dummy(0, -1);
  const sc0 = en.group.scale.x;
  cast(2);
  yield 0.5;
  out(`  encolheu ${ok(en.group.scale.x < sc0 * 0.7, en.group.scale.x.toFixed(2))} | lento ${ok(en.slow > 0)}`);
  out('  -> esqueleto pequeno (screenshot)');
  yield 'hold';
  const he = player.hp;
  combat.hitPlayer(en, 10, { target: player });
  const lost = he - player.hp;
  out(`  metade do dano ${ok(lost >= 4 && lost <= 6, lost)}`);
  yield 4.6;
  out(`  volta ao normal ${ok(Math.abs(en.group.scale.x - sc0) < 0.02)}`);

  // ---------------- 182) Levitar ----------------
  out('182) Levitar: flutua indefeso 2 s e leva dano da queda');
  fresh(); yield 0.1;
  give('w_caj21');
  const lv = dummy(0, -1);
  cast(2);
  yield 0.6;
  out(`  flutuando ${ok(lv.state === 'orbFloat' && lv.position.y > 1, lv.position.y.toFixed(2))}`);
  out('  -> esqueleto no ar (screenshot)');
  yield 'hold';
  const hl = lv.hp;
  yield* until(() => ev('arcLevLand').length > 0, 2500);
  out(`  caiu e levou dano ${ok(ev('arcLevLand').length === 1 && lv.hp < hl && lv.position.y === 0)}`);

  // ---------------- 184) Repulsor ----------------
  out('184) Repulsor: o orbe grande empurra todos para longe');
  fresh(); yield 0.1;
  give('w_caj23');
  const rp = [dummy(0, -1), dummy(1.5, -1.2), dummy(-1.5, -1.2)];
  cast(2);
  yield* until(() => ev('arcRepel').length > 0, 1000);
  const ip = { x: 0, z: -1 };
  const d0 = rp.map((e) => Math.hypot(e.position.x - ip.x, e.position.z - ip.z));
  yield 0.5;
  const d1 = rp.map((e) => Math.hypot(e.position.x - ip.x, e.position.z - ip.z));
  out(`  empurrou os 3 ${ok(ev('arcRepel')[0] && ev('arcRepel')[0].n >= 3 && d1[1] > d0[1] + 0.8 && d1[2] > d0[2] + 0.8, d1.map((v) => v.toFixed(1)).join('/'))}`);

  // ---------------- 185) Ressonância ----------------
  out('185) Ressonância: os 3 orbes no mesmo inimigo = bomba');
  fresh(); yield 0.1;
  give('w_caj24');
  const rs = dummy(0, -1), rn = dummy(1.8, -1.6);
  for (let i = 0; i < 3; i++) { cast(i); yield 0.35; }
  out(`  virou bomba ${ok(ev('arcResonance').length === 1)}`);
  const hr = rn.hp;
  yield* until(() => ev('arcResBoom').length > 0, 2000);
  out(`  explodiu 1 s depois ${ok(ev('arcResBoom').length === 1 && rn.hp < hr)}`);
  fresh(); yield 0.1; give('w_caj24');
  const r1 = dummy(-1.2, -1), r2 = dummy(1.2, -1);
  player.facing = Math.atan2(-1.2, -3); cast(0); yield 0.35;
  player.facing = Math.atan2(1.2, -3); cast(1); yield 0.35; cast(2); yield 0.5;
  out(`  inimigos diferentes: nada ${ok(ev('arcResonance').length === 0)}`);

  // ---------------- 186) Carga Paciente ----------------
  out('186) Carga Paciente: 2 s parada junta orbes (até 5)');
  fresh(); yield 0.1;
  give('w_caj25');
  yield 2.7;
  out(`  juntou ${ok(player.arcCharge >= 2, player.arcCharge)}`);
  yield 2.0;
  out(`  no máximo 5 ${ok(player.arcCharge === 5)}`);
  out('  -> orbes flutuando em volta da Maga (screenshot)');
  yield 'hold';
  dummy(0, -1.5);
  cast(0);
  out(`  todos saem no próximo ataque ${ok(ev('arcChargeFire').length === 1 && ev('arcChargeFire')[0].n === 5 && spells().length === 6 && player.arcCharge === 0, spells().length)}`);

  // ---------------- 187) Fusão ----------------
  out('187) Fusão: orbes que se tocam viram um maior');
  fresh(); yield 0.1;
  give('w_caj5'); give('w_caj26');
  cast(0);
  yield 0.05;
  out(`  Orbe Duplo + Fusão: viraram 1 ${ok(ev('arcFuse').length >= 1)}`);
  fresh(); yield 0.1; give('w_caj26');
  cast(0);
  yield 0.3;
  out(`  orbe que errou espera no ar ${ok(spells().length === 1 && spells()[0].hover)}`);
  cast(1);
  yield* until(() => ev('arcFuse').length > 0, 800);
  const fz = ev('arcFuse')[0];
  out(`  o de trás alcançou e fundiu ${ok(!!fz && fz.dmg >= 5.5, fz && fz.dmg.toFixed(1))}`);

  // ---------------- 188) Devorador ----------------
  out('188) Devorador: o orbe engole a flecha');
  fresh(); yield 0.1;
  give('w_caj27');
  const hd = player.hp;
  combat.projectiles.fire(0, -6, 0, { speed: 14, damage: 10, owner: null });
  yield 0.15;
  cast(0);
  yield 0.5;
  out(`  engoliu ${ok(ev('arcDevour').length === 1)} | a Maga não apanhou ${ok(player.hp === hd)}`);

  // ---------------- 189) Piscar ----------------
  out('189) Piscar: rolar vira teletransporte com bomba');
  fresh(); yield 0.1;
  give('w_caj28');
  const bk = dummy(0.8, 2.6);
  player.startDodge();
  const bl = ev('arcBlink')[0];
  out(`  teletransportou ${ok(!!bl && bl.d > 4 && player.state !== 'dodge', bl && bl.d.toFixed(1))}`);
  yield 0.3;
  out('  -> bomba onde ela estava (screenshot)');
  yield 'hold';
  yield* until(() => ev('arcBlinkBoom').length > 0, 1500);
  out(`  a bomba explodiu ${ok(ev('arcBlinkBoom').length === 1 && bk.hp < 999)}`);

  // ---------------- 190) Gêmea Arcana ----------------
  out('190) Gêmea Arcana: cópia fantasma repete os ataques');
  fresh(); yield 0.1;
  give('w_caj29');
  dummy(0, -1.8);
  cast(2);
  out(`  apareceu no combo completo ${ok(K.twins.size === 1 && ev('arcTwin').length === 1)}`);
  yield 0.5;
  cast(0);
  out(`  repetiu o ataque ${ok(ev('arcTwinCast').length === 1 && spells().length === 2, spells().length)}`);
  yield 0.1;
  out('  -> a Gêmea atirando junto (screenshot)');
  yield 'hold';
  yield 3.2;
  out(`  some depois de 3 s ${ok(K.twins.size === 0)}`);

  // ---------------- 191) Caos Arcano ----------------
  out('191) Caos Arcano: a cada 8, um orbe de outro tipo');
  fresh(); yield 0.1;
  give('w_caj30');
  for (let i = 0; i < 8; i++) { cast(0); yield 0.12; }
  out(`  8 normais ${ok(!ev('arcChaos').length && player.arcChaosNext)}`);
  const kinds = [];
  const r0 = Math.random;
  for (let k = 0; k < 5; k++) {
    fresh(); yield 0.1; give('w_caj30');
    const t = dummy(0, -1.4); dummy(1.6, -1.8);
    player.arcChaosNext = true;
    Math.random = () => k / 5 + 0.01;
    cast(0);
    Math.random = r0;
    yield 1.2;
    const kind = (ev('arcChaos')[0] || {}).kind;
    const fx = kind === 'gelo' ? t.frozenT > 0 || ev('frozen').length > 0 : kind === 'fogo' ? t.burn > 0 || ev('burn').length > 0 || t.burnBy === player
      : kind === 'raio' ? ev('hit').length >= 2 : kind === 'sombra' ? !!t.darkMark : kind === 'veneno' ? ev('arcPoison').length > 0 : false;
    kinds.push(`${kind} ${ok(fx)}`);
  }
  Math.random = r0;
  out(`  ${kinds.join(' | ')}`);

  // ---------------- 192) Todas juntas ----------------
  out('192) Cajado com as 30 bênçãos: sem erros');
  fresh(); yield 0.1;
  for (const b of mine) for (let k = 0; k < b.max; k++) player.addBlessing(b);
  for (let i = 0; i < 6; i++) dummy(-2.5 + i, -1 - (i % 2) * 1.2);
  player.iframes = 99;
  for (let t = 0; t < 18; t++) { cast(t % 3); yield 0.25; if (t === 9) player.startDodge(); }
  yield 1.5;
  player.iframes = 0;
  const errs = (window.__game.errors || []).length - errs0;
  out(`  sem erros do jogo ${ok(errs === 0, errs)}`);
  player.input = realInput;
}
