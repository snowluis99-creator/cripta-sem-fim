// Teste automático, parte 15 (02/11/2026): bênçãos novas da Espada e Escudo (lista do dono).
// Escudo (Aparar, Mitral, Reforçado, Estilhaços, Espinhos), Pancada, Lâmina Afiada e as que mudam o jogo
// (knightkit.js): Arremesso, Espada Arremessada, Bilhar de Ossos, Trenó, Escudo Plantado, Corrente, Mãos Trocadas
// e Rastro Fantasma. Tecla Y = tudo; tecla 1 = só esta parte.
import { BLESSINGS, rollBlessings } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { shieldMax } from './shield.js';
import { kitBumpSafe } from './knightkit.js';
import { findBone } from './characters.js';
import * as THREE from 'three';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* kitTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const fresh = () => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('knight', 'espada'); player.reset(0, 2); player.facing = Math.PI;
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion', facing = 0) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing }); e.hp = e.maxHp = 999; e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const block = () => { player.setState('block'); player.anim.play(player.hero.anims.blocking); };

  // ---------------- 73) Lista ----------------
  out('73) Espada e Escudo: lista nova de bênçãos');
  const mine = WEAPON_BLESSINGS.filter((b) => b.weapon === 'knight.espada');
  const names = mine.map((b) => b.name);
  const gone = ['Fio Afiado', 'Golpe do Juramento', 'Investida Firme', 'Escudo Pesado', 'Estilhaços', 'Rebate Brutal'].filter((n) => names.includes(n));
  out(`  ${mine.length} bênçãos ${ok(mine.length === 24)} | removidas ${ok(gone.length === 0, gone.join(', '))} | todas com raridade e texto ${ok(mine.every((b) => b.rarity && b.desc(1).length > 10))}`);
  const fl = mine.find((b) => b.name === 'Escudo Flamejante');
  out(`  Escudo Plantado saiu ${ok(!names.includes('Escudo Plantado'))} | Escudo Flamejante lendária ${ok(fl && fl.rarity === 'legendary')}`);
  out(`  Mesa Virada saiu ${ok(!names.includes('Mesa Virada'))} | Demolidor entrou ${ok(names.includes('Demolidor'))}`);
  // Trenó e Cavalo não vêm juntos (04/11).
  const hero = player.hero;
  let both = 0;
  for (const own of [{ w_esp21: 1 }, { w_esp29: 1 }]) for (let i = 0; i < 300; i++) {
    const picks = rollBlessings(own, 3, 'common', Math.random, hero);
    if (picks.some((b) => b.id === (own.w_esp21 ? 'w_esp29' : 'w_esp21'))) both++;
  }
  out(`  Trenó e Cavalo nunca juntos (600 sorteios) ${ok(both === 0, both)}`);

  // ---------------- 74) Escudo ----------------
  out('74) Bênçãos do escudo');
  fresh(); yield 0.1;
  give('w_esp11');
  const at = dummy(0, 0.6);
  block(); player.stateTime = 0.05;
  combat.hitPlayer(at, 10, { target: player });
  const parry = player.shield === shieldMax(player);
  block(); player.stateTime = 1;
  combat.hitPlayer(at, 10, { target: player });
  out(`  Aparar: no instante certo não gasta ${ok(parry)} | atordoou ${ok(at.state === 'hurt')} | depois do instante gasta ${ok(player.shield === shieldMax(player) - 1)}`);
  fresh(); yield 0.1;
  give('w_esp15', 3);
  out(`  Escudo Reforçado ×3: aguenta ${shieldMax(player)} e está novo ${ok(shieldMax(player) === 25 && player.shield === 25)}`);
  fresh(); yield 0.1;
  give('w_esp13', 2); player.stats.mithril = 1;
  const at2 = dummy(0, 0.6);
  block(); player.stateTime = 1;
  for (let i = 0; i < 3; i++) { block(); player.stateTime = 1; combat.hitPlayer(at2, 10, { target: player }); }
  out(`  Placas de Mitral (100% no teste): 3 bloqueios sem gastar ${ok(player.shield === shieldMax(player))}`);
  fresh(); yield 0.1;
  give('w_esp14', 3);
  const at3 = dummy(0, 0.6);
  block(); player.stateTime = 1;
  combat.hitPlayer(at3, 10, { target: player });
  out(`  Espinhos ×3: devolveu ${999 - at3.hp} ${ok(999 - at3.hp >= 45)}`);

  // ---------------- 75) Pancada e Lâmina Afiada ----------------
  out('75) Pancada e Lâmina Afiada');
  fresh(); yield 0.1;
  give('w_esp17', 2);
  const pz = dummy(0, 0.8);
  combat.playerStrike(player, player.hero.combo[2]);
  out(`  Pancada ×2: golpe forte atordoa ${pz.stunTime.toFixed(1)} s ${ok(pz.state === 'hurt' && pz.stunTime >= 1.95)}`);
  fresh(); yield 0.1;
  give('w_esp18', 3);
  const bz = dummy(0, 0.8);
  for (let i = 0; i < 30; i++) combat.playerStrike(player, player.hero.combo[0]);
  out(`  Lâmina Afiada ×3 (30%): 30 golpes, sangramento ×${bz.bleedStacks || 0} ${ok((bz.bleedStacks || 0) >= 3)}`);

  // ---------------- 76) Arremesso ----------------
  out('76) Arremesso: 4º golpe joga o escudo');
  fresh(); yield 0.1;
  give('w_esp16');
  const c4 = player.hero.combo;
  out(`  combo de ${c4.length} golpes ${ok(c4.length === 4 && c4[3].kit === 'throwShield')}`);
  const tgt = dummy(0, -4);
  combat.playerStrike(player, c4[3]);
  out(`  sem escudo na mão ${ok(!player.canGuard() && !player.shieldMesh.visible)}`);
  yield* until(() => ev('kitLand').length > 0);
  out(`  acertou e caiu no chão ${ok(tgt.hp < 999 && ev('kitLand').length === 1, 999 - tgt.hp)} | combo sem o 4º golpe ${ok(player.hero.combo.length === 3)}`);
  yield 0.4;
  out('  -> escudo no chão (screenshot)');
  yield 'hold';
  player.position.set(tgt.position.x, 0, tgt.position.z + 1.2);
  yield* until(() => ev('kitPick').length > 0, 1500);
  out(`  andou até ele: escudo de volta ${ok(player.canGuard() && player.hero.combo.length === 4)}`);

  // ---------------- 77) Espada Arremessada ----------------
  out('77) Espada Arremessada');
  fresh(); yield 0.1;
  give('w_esp20');
  const l1 = dummy(0, -1.5), l2 = dummy(0.2, -4);
  const heavy = player.hero.combo[3];
  out(`  golpe forte continua em área ${ok(player.hero.combo[2].heavy && !player.hero.combo[2].kit)} | golpe depois do 3º arremessa ${ok(heavy && heavy.kit === 'throwSword' && heavy.clip === 'Throw' && player.hero.combo[2].window > 0)}`);
  combat.playerStrike(player, heavy);
  yield* until(() => ev('kitLand').length > 0);
  out(`  atravessou os 2 ${ok(l1.hp < 999 && l2.hp < 999)} | cravou no chão ${ok(ev('kitLand').length === 1)} | sem espada: pancadas de escudo ${ok(player.hero.combo[0].bash && player.hero.combo[3].kit === 'recallSword')}`);
  yield 0.3;
  out('  -> espada cravada (screenshot)');
  yield 'hold';
  const mid = dummy(0, -2.2); flags.events.length = 0;
  combat.playerStrike(player, player.hero.combo[3]);
  yield* until(() => ev('kitPick').length > 0);
  out(`  4º golpe chamou a espada de volta ${ok(ev('kitRecall').length === 1 && ev('kitPick').length === 1)} | cortou no caminho ${ok(mid.hp < 999)} | espada na mão ${ok(player.hero.combo[3].kit === 'throwSword' && player.weapon.visible)}`);

  // ---------------- 78) Bilhar de Ossos ----------------
  out('78) Bilhar de Ossos');
  fresh(); yield 0.1;
  give('w_esp19');
  const b1 = dummy(0, 0.6), b2 = dummy(0, -1.4);
  b1.passive = false;
  block(); player.stateTime = 1;
  combat.hitPlayer(b1, 10, { target: player });
  yield* until(() => ev('kitBallHit').length > 0, 1500);
  out(`  rebatido virou bola ${ok(ev('kitBall').length >= 1)} | derrubou o de trás ${ok(b2.hp < 999 && ev('kitBallHit').length >= 1)} | o de trás também voou ${ok(ev('kitBall').length >= 2)}`);
  yield 1;
  fresh(); yield 0.1;
  give('w_esp19');
  player.position.set(0, 0, run0(g) + 2.8);
  const wb = dummy(0, run0(g) + 1.4); wb.passive = false;
  player.facing = Math.PI; block(); player.stateTime = 1;
  flags.events.length = 0;
  combat.hitPlayer(wb, 10, { target: player });
  yield* until(() => ev('kitWall').length > 0, 1500);
  out(`  bateu na parede: 25 de dano ${ok(ev('kitWall').length === 1)}`);
  fresh(); yield 0.1;
  give('w_esp19');
  const gw = dummy(0, 0.7, 'warrior'); gw.passive = false;
  block(); player.stateTime = 1;
  combat.hitPlayer(gw, 10, { target: player });
  out(`  qualquer um que bate no bloqueio vira bola (Guerreiro) ${ok(ev('kitBall').length === 1)}`);

  // ---------------- 79) Trenó ----------------
  out('79) Trenó de Escudo');
  fresh(); yield 0.1;
  give('w_esp21');
  const s1 = dummy(0, -1.5);
  player.facing = Math.PI;
  let sledBlk = false;
  player.input = { moveDir: (o) => o.set(0, 0, 0), aimAngle: () => null, attack: () => false, dodge: () => false, dodgeHeld: () => true, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => sledBlk };
  player.startDodge();
  out(`  rolar sem segurar o bloqueio: rolamento normal ${ok(player.state === 'dodge')}`);
  yield 0.6; player.dodgeCooldown = 0; sledBlk = true;
  player.setState('idle'); player.position.set(0, 0, 2); player.facing = Math.PI;
  const sh0 = player.shield;
  player.startDodge();
  out(`  bloqueio + rolar virou trenó ${ok(player.state === 'sled' && !player.shieldMesh.visible)} | gastou 1 carga ${ok(player.shield === sh0 - 1)} | animação ${player.anim.currentName}`);
  const shp = player.hp, sAt = dummy(3, 3);
  const sledHurt = combat.hitPlayer(sAt, 20, { target: player });
  out(`  no trenó não leva dano ${ok(!sledHurt && player.hp === shp)}`);
  sAt.die();
  yield 0.25;
  out('  -> deslizando (screenshot)');
  yield 'hold';
  yield* until(() => player.state !== 'sled', 3000);
  out(`  atropelou ${ok(s1.hp < 999 && ev('sledHit').length === 1)} | pegou fogo ${ok(s1.burn > 0)} | acabou e o escudo voltou ${ok(player.state !== 'sled' && player.canGuard())}`);
  yield 0.2; player.dodgeCooldown = 0; player.startDodge();
  out(`  sem recarga: desliza de novo ${ok(player.state === 'sled' && player.shield === sh0 - 2)}`);
  yield* until(() => player.state !== 'sled', 3000);
  player.shield = 0; player.dodgeCooldown = 0; player.startDodge();
  out(`  escudo quebrado: rola normal ${ok(player.state === 'dodge')}`);

  // ---------------- 80) Escudo Flamejante (04/11, no lugar do Escudo Plantado) ----------------
  out('80) Escudo Flamejante');
  fresh(); yield 0.1;
  give('w_esp31');
  yield 0.1;
  const fA = dummy(0, 0.6);
  block(); player.stateTime = 1;
  combat.hitPlayer(fA, 10, { target: player });
  const fC = dummy(0.4, 0.5);
  block(); player.stateTime = 1;
  combat.hitPlayer(fC, 5, { contact: true, noRepel: true, target: player });
  out(`  quem bateu no escudo pegou fogo ${ok(fA.burn > 0 && ev('flameBlock').length >= 1)} | esbarrão no escudo também ${ok(fC.burn > 0)} | escudo brilhando ${ok(player.shieldMats.some(({ m }) => m.emissive && m.emissive.getHex() !== 0))}`);
  yield 0.4;
  out('  -> escudo em chamas (screenshot)');
  yield 'hold';
  yield 1.2;
  out(`  a queimadura tira vida ${ok(fA.hp < 999 - 1)}`);

  // ---------------- 81) Corrente no Escudo ----------------
  out('81) Corrente no Escudo');
  fresh(); yield 0.1;
  give('w_esp23');
  const far = dummy(0, -5); far.passive = false;
  player.facing = Math.PI;
  player.enterBlock(null);
  yield* until(() => ev('kitHook').length > 0, 1500);
  yield* until(() => Math.hypot(far.position.x - player.position.x, far.position.z - player.position.z) < 2.5, 1500);
  const dd = Math.hypot(far.position.x - player.position.x, far.position.z - player.position.z);
  out(`  puxou o inimigo de longe ${ok(ev('kitHook').length === 1 && dd < 2.5, dd.toFixed(1))} | o puxado não machuca no esbarrão ${ok(kitBumpSafe(player, far))}`);
  far.passive = true; player.setState('idle'); player.hp = player.maxHp; player.iframes = 0;
  far.position.set(player.position.x, 0, player.position.z - 0.6); far.setState('chase');
  combat.separate();
  out(`  encostou: sem dano ${ok(player.hp === player.maxHp)}`);
  yield 3.4;
  out(`  depois de 3 s volta ao normal ${ok(!kitBumpSafe(player, far))}`);

  // ---------------- 82) Mãos Trocadas ----------------
  out('82) Mãos Trocadas');
  fresh(); yield 0.1;
  give('w_esp24');
  out(`  escudo ataca ${ok(player.hero.combo.every((c) => c.bash))} | escudo na mão direita ${ok(player.shieldMesh.parent === findBone(player.model, 'handslot.r'))}`);
  const m1 = dummy(0, 0.6);
  for (let i = 0; i < 3; i++) { block(); player.stateTime = 1; combat.hitPlayer(m1, 10, { target: player }); }
  out(`  defesa da espada gasta o escudo (3 bloqueios) ${ok(player.shield === shieldMax(player) - 3, player.shield)} | contra-atacou ${ok(m1.hp < 999 && ev('kitCounter').length === 3)}`);
  const m2 = dummy(0, 0.9); m1.die();
  const z0 = m2.position.z;
  combat.playerStrike(player, player.hero.combo[0]);
  yield 0.3;
  out(`  pancada empurra longe ${ok(m2.position.z - z0 < -1.3, (m2.position.z - z0).toFixed(2))} | atordoa o dobro ${ok(m2.state === 'hurt' && m2.stunTime >= m2.data.stagger * 2 - 0.01, m2.stunTime.toFixed(2))}`);
  // A espada corta sozinha as flechas que iam acertar (sem bloquear).
  player.setState('idle'); player.hp = player.maxHp; flags.events.length = 0;
  const shooter = dummy(0, -7, 'archer');
  combat.projectiles.fire(0, -2, 0, { speed: 12, damage: 10, kind: 'arrow', owner: shooter });
  yield* until(() => ev('swordCut').length > 0 || player.hp < player.maxHp, 1500);
  out(`  espada cortou a flecha ${ok(ev('swordCut').length === 1 && player.hp === player.maxHp)} | gastou 1 carga ${ok(player.shield === shieldMax(player) - 4, player.shield)}`);
  yield 0.2;
  out('  -> mãos trocadas (screenshot)');
  yield 'hold';

  // ---------------- 83) Rastro Fantasma ----------------
  out('83) Rastro Fantasma');
  fresh(); yield 0.1;
  give('w_esp25');
  const r1 = dummy(0, 0.8);
  combat.playerStrike(player, player.hero.combo[0]);
  const h1 = 999 - r1.hp;
  yield 0.5;
  out('  -> rastro no ar (screenshot)');
  yield 'hold';
  yield* until(() => ev('kitTrail').length > 0, 1500);
  out(`  cortou de novo depois de 1 s ${ok(ev('kitTrail').length === 1 && ev('kitTrail')[0].hits === 1 && 999 - r1.hp > h1)}`);

  // ---------------- 84) Tudo junto ----------------
  out('84) Todas juntas (Arremesso + Espada Arremessada + Mãos Trocadas + Trenó...) sem erro');
  fresh(); yield 0.1;
  for (const b of mine) for (let k = 0; k < b.max; k++) player.addBlessing(b);
  for (let i = 0; i < 4; i++) dummy(-0.9 + i * 0.6, 0.6 + (i % 2) * 0.4);
  player.iframes = 99;
  const errs0 = (window.__game.errors || []).length;
  for (let t = 0; t < 24; t++) {
    const st = player.hero.combo[t % player.hero.combo.length];
    combat.playerStrike(player, st);
    if (t % 6 === 5) player.position.set(0, 0, 2); // volta para perto
    yield 0.15;
  }
  out(`  ${ok((window.__game.errors || []).length === errs0, 'sem erros')} | combo agora: ${player.hero.combo.map((c) => c.kit || (c.bash ? 'pancada' : c.clip.replace('Melee_', ''))).join(', ')}`);
  player.iframes = 0;
  fresh(); yield 0.1;
  // ---------------- 85) Demolidor (04/11, no lugar da Mesa Virada) ----------------
  out('85) Demolidor');
  fresh(); yield 0.1;
  give('w_esp32');
  const fakePillar = (x, z) => {
    const obj = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 4, 12).translate(0, 2, 0), new THREE.MeshStandardMaterial({ color: 0x8c8c94 }));
    obj.position.set(x, 0, z); combat.scene.add(obj);
    const s = { name: 'pillar_teste', x, z, r: 0.75, h: 4, obj, rect: null, colIdx: -1, down: false };
    combat.demo.list.push(s); return s;
  };
  const pil = fakePillar(0, 0.4);
  // Grupo de 3 à esquerda do pilar, 1 sozinho à direita: tem que cair para a esquerda.
  const g1 = dummy(-2, 0.4), g2 = dummy(-3.2, 0.1), g3 = dummy(-2.6, 0.9), lone = dummy(4.5, 0.4);
  player.facing = Math.PI;
  combat.playerStrike(player, player.hero.combo[2]);
  out(`  golpe forte derrubou o pilar ${ok(pil.down && ev('demolish').length === 1)} | mirou no grupo de 3 ${ok(ev('demolish')[0] && ev('demolish')[0].aim === 3)}`);
  yield 0.45;
  out('  -> pilar caindo (screenshot)');
  yield 'hold';
  yield* until(() => ev('demolishHit').length > 0, 2000);
  out(`  esmagou 3 (50% da vida máx.) ${ok(ev('demolishHit')[0] && ev('demolishHit')[0].hits === 3 && g1.hp <= 500 && g2.hp <= 500 && g3.hp <= 500, 999 - g1.hp)} | o sozinho não ${ok(lone.hp === 999)}`);
  yield 2.2;
  out(`  o pilar sumiu depois ${ok(!pil.obj.visible)}`);
  fresh(); yield 0.1;
  give('w_esp32');
  dummy(0, -1);
  combat.playerStrike(player, player.hero.combo[2]);
  out(`  sem pilar perto: golpe normal ${ok(ev('demolish').length === 0)}`);

  // ---------------- 86) Cavalo Fantasma ----------------
  out('86) Cavalo Fantasma (2ª leva)');
  fresh(); yield 0.1;
  give('w_esp29');
  const hz = dummy(2.6, 2);
  player.facing = Math.PI / 2;
  let atk = false;
  player.input = { moveDir: (o) => o.set(0, 0, 0), aimAngle: () => null, attack: () => atk, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => true };
  const hs0 = player.shield;
  player.startDodge();
  out(`  gastou 1 carga do escudo ${ok(player.shield === hs0 - 1)}`);
  out(`  bloqueio + rolar invocou o cavalo ${ok(player.state === 'horse' && !!player.kit.horse && player.kit.horse.g.parent === player.group)} | montado ${ok(player.model.position.y > 0.5)}`);
  yield 0.3;
  out('  -> galopando (screenshot)');
  yield 'hold';
  yield* until(() => player.state !== 'horse', 3000);
  out(`  atropelou ${ok(hz.hp < 999 && ev('horseHit').length === 1, 999 - hz.hp)} | durou ~2 s e desmontou ${ok(player.state !== 'horse' && player.model.position.y === 0 && !player.kit.horse.g.parent)}`);
  out(`  atropelado enterrado ${ok(ev('buried').length === 1 && hz.state === 'hurt' && hz.model.position.y < -0.3)}`);
  yield 1.2;
  out(`  1 s depois de desmontar: ainda enterrado ${ok(hz.state === 'hurt' && hz.model.position.y < -0.3)}`);
  yield 1.4;
  out(`  passou 2 s: saiu do chão ${ok(hz.state !== 'hurt' || combat.kit2.buried.length === 0)}`);
  player.dodgeCooldown = 0; player.startDodge(); yield 0.05;
  out(`  sem recarga: monta de novo ${ok(player.state === 'horse' && player.shield === hs0 - 2)}`);
  yield* until(() => player.state !== 'horse', 3000);
  player.dodgeCooldown = 0; player.startDodge();
  const hhp = player.hp;
  out(`  galopando não leva dano ${ok(!combat.hitPlayer(dummy(-3, 4), 20, { target: player }) && player.hp === hhp)}`);
  yield 0.2;
  atk = true; yield 0.1; atk = false;
  out(`  atacar desmonta e golpeia ${ok(player.state === 'attack' && !player.kit.horseOn)}`);
  player.input = realInput;

  // ---------------- 87) Duelo Sagrado ----------------
  out('87) Duelo Sagrado (2ª leva)');
  fresh(); yield 0.1;
  give('w_esp26');
  const champ = dummy(0, -2, 'warrior'); champ.shieldCovers = () => false;
  const mA = dummy(2.2, -1), mB = dummy(-3, 1);
  mA.maxHp = mB.maxHp = 50;
  combat.kit2.duelKey = null;
  Object.assign(waves, { waves: [[['warrior', 1], ['minion', 2]]], wave: 0, state: 'fighting', queue: [] });
  yield 0.2;
  const du = combat.kit2.duel;
  out(`  desafiou o mais forte (Guerreiro) ${ok(du && du.e === champ)}`);
  const outside = (e) => Math.hypot(e.position.x - du.x, e.position.z - du.z) >= du.R + e.data.radius - 0.01;
  out(`  os outros ficaram do lado de fora ${ok(du && outside(mA) && outside(mB))}`);
  const hp0 = player.hp;
  const hitIn = combat.hitPlayer(mA, 10, { target: player });
  out(`  golpe de fora não entra ${ok(!hitIn && player.hp === hp0)} | seu golpe não sai ${ok(!combat.damageEnemy(player, mA, player.hero.combo[0], 1, 0))}`);
  flags.events.length = 0;
  const ang = Math.atan2(player.position.x - mB.position.x, player.position.z - mB.position.z);
  combat.projectiles.fire(mB.position.x, mB.position.z, ang, { speed: 12, damage: 5, kind: 'arrow', owner: mB });
  yield* until(() => ev('duelProjectile').length > 0, 1500);
  out(`  flecha de fora parou no círculo ${ok(ev('duelProjectile').length === 1 && player.hp === hp0)}`);
  yield 0.1;
  out('  -> círculo do duelo (screenshot)');
  yield 'hold';
  player.position.set(du.x + du.R + 3, 0, du.z); yield 0.05;
  out(`  o herói não sai do círculo ${ok(Math.hypot(player.position.x - du.x, player.position.z - du.z) <= du.R)}`);
  champ.hp = 1; player.shield = 2; player.hp = 50;
  combat.damageEnemy(player, champ, player.hero.combo[0], 0, -1);
  yield 0.1;
  out(`  o Guerreiro caiu: círculo some ${ok(!combat.kit2.duel && ev('duelEnd').some((x) => x.won))} | escudo consertado ${ok(player.shield === shieldMax(player))} | +10 de vida ${ok(player.hp === 60)}`);
  const champ2 = dummy(1, -2.5, 'warrior');
  Object.assign(waves, { wave: 1, state: 'fighting', queue: [] });
  yield 0.2;
  out(`  onda seguinte: novo duelo ${ok(combat.kit2.duel && combat.kit2.duel.e === champ2)}`);
  combat.kit2.endDuel(false); champ2.die(); mA.die(); mB.die();
  combat.spawn('guardian', 0, -6, { awake: true, passive: true }); dummy(2, -2, 'warrior');
  Object.assign(waves, { wave: 2, state: 'fighting', queue: [] });
  yield 0.2;
  out(`  sala do chefe: sem duelo ${ok(!combat.kit2.duel)}`);

  // ---------------- 88) Vassalo ----------------
  out('88) Vassalo (2ª leva)');
  fresh(); yield 0.1;
  give('w_esp27');
  combat.kit2.vassalKey = null;
  const vs = [dummy(-1, -2), dummy(1, -2), dummy(0, -3, 'warrior')];
  for (const e of vs) { e.passive = false; e.hp = e.maxHp = 40; }
  Object.assign(waves, { waves: [[['minion', 2], ['warrior', 1]]], wave: 0, state: 'fighting', queue: [] });
  vs[0].die(); combat.killed(vs[0], 0, 1, player);
  vs[1].die(); combat.killed(vs[1], 0, 1, player);
  yield 0.15;
  const vas = vs[2];
  out(`  o último se rendeu ${ok(ev('vassal').length === 1 && vas.undead === player && vas.vassal)} | onda vencida ${ok(combat.aliveCount === 0)}`);
  const gear = vas.vassalGear;
  out(`  ganhou capa e 2 ombreiras ${ok(gear && gear.cape && gear.pads.length === 2)} | sem brilho dourado ${ok(vas.bodyMats.every((m) => !m.emissive || m.emissiveIntensity < 0.2))} | ajoelhou do lado do herói ${ok(ev('vassalScene').length === 1 && Math.abs(Math.hypot(vas.position.x - player.position.x, vas.position.z - player.position.z) - 1.35) < 0.5)}`);
  yield 0.3;
  out('  -> ajoelhado (screenshot)');
  yield 'hold';
  const foe = dummy(1.5, -5.5); foe.hp = foe.maxHp = 999;
  yield* until(() => foe.hp < 999, 6000);
  out(`  lutou do seu lado ${ok(foe.hp < 999, 999 - foe.hp)} | não machuca o herói ${ok(player.hp === player.maxHp)}`);
  foe.die(); combat.killed(foe, 0, 1, player);
  // Só 1 vassalo vivo: na onda seguinte o último não se rende.
  const w2 = [dummy(-2, -6), dummy(2, -6)];
  for (const e of w2) { e.passive = true; e.hp = e.maxHp = 40; }
  Object.assign(waves, { waves: [[['minion', 2], ['warrior', 1]], [['minion', 2]]], wave: 1, state: 'fighting', queue: [] });
  w2[0].die(); combat.killed(w2[0], 0, 1, player);
  yield 0.15;
  out(`  com 1 vassalo vivo, o próximo não se rende ${ok(!w2[1].vassal && ev('vassal').length === 1)}`);
  w2[1].die(); combat.killed(w2[1], 0, 1, player);
  Object.assign(waves, { waves: [[['minion', 2], ['warrior', 1]]], wave: 0, state: 'fighting', queue: [] });
  yield 4;
  out(`  sem inimigos, espera a sala acabar (não desmorona) ${ok(vas.alive)}`);
  vas.hp = 23;
  combat.kit2.roomClear();
  out(`  fim da sala (última onda): vai junto ${ok(vas.alive && combat.kit2.carry && combat.kit2.carry.list.length === 1)}`);
  combat.clear();
  combat.kit2.roomStart({ kind: 'combat', waves: [[['minion', 2]]] });
  const vas2 = combat.enemies.find((e) => e.vassal);
  out(`  entrou na sala nova com você ${ok(vas2 && vas2.undead === player && vas2.hp === 23 && Math.hypot(vas2.position.x - player.position.x, vas2.position.z - player.position.z) < 2.5)}`);
  yield 0.6;
  out('  -> vassalo na sala nova (screenshot)');
  yield 'hold';
  combat.kit2.roomClear();
  out(`  fim da 2ª sala: foi embora ${ok(vas2 && !vas2.alive && !combat.kit2.carry)}`);

  // ---------------- 89) Espada Amaldiçoada ----------------
  out('89) Espada Amaldiçoada (2ª leva)');
  fresh(); yield 0.1;
  give('w_esp30');
  combat.kit2.roomStart({ waves: [[['archer', 4], ['minion', 2]]] });
  Object.assign(combat.kit2.curse, { type: 'archer' });
  yield* until(() => ev('curseAsk').length > 0, 3000);
  out(`  a espada pediu ${ok(ev('curseAsk').length === 1)}`);
  yield 0.2;
  out('  -> pedido da espada (screenshot)');
  yield 'hold';
  const g0 = player.gold, u0 = player.ult || 0, h0 = player.hp = player.maxHp - 40;
  const a1 = dummy(-1, -3, 'archer'); a1.die(); combat.killed(a1, 0, 1, player);
  const mn = dummy(0, -3); mn.die(); combat.killed(mn, 0, 1, player);
  const rw = ev('curseReward');
  out(`  1º derrotado = arqueiro: prêmio (${rw[0] && rw[0].pick}) ${ok(rw.length === 1 && (player.gold > g0 || player.hp > h0 || (player.ult || 0) > u0))} | lacaio depois não castigou ${ok(ev('cursePunish').length === 0)}`);
  combat.kit2.roomClear();
  combat.kit2.roomStart({ waves: [[['warrior', 2], ['minion', 2]]] });
  Object.assign(combat.kit2.curse, { type: 'warrior' });
  yield* until(() => combat.kit2.curse && combat.kit2.curse.said, 3000);
  player.hp = player.maxHp;
  const cm2 = dummy(0, -3); cm2.die(); combat.killed(cm2, 0, 1, player);
  out(`  1º derrotado errado: a espada machucou 15 na hora ${ok(player.hp === player.maxHp - 15)}`);
  const cw2 = dummy(1, -3, "warrior"); cw2.die(); combat.killed(cw2, 0, 1, player);
  out(`  depois do 1º não conta mais ${ok(ev('curseReward').length === 1 && ev('cursePunish').length === 1)}`);
  combat.kit2.roomClear();
  player.hp = 10; combat.kit2.roomStart({ waves: [[['warrior', 2], ['minion', 1]]] });
  Object.assign(combat.kit2.curse, { type: 'warrior' });
  yield* until(() => combat.kit2.curse && combat.kit2.curse.said, 3000);
  const m3 = dummy(0, -3); m3.die(); combat.killed(m3, 0, 1, player);
  combat.kit2.roomClear();
  out(`  o castigo nunca mata ${ok(player.hp === 1 && player.state !== 'dead')}`);
  fresh();
}

// Fundo da sala (z da parede de trás, por dentro).
function run0(g) { const b = g.combat.world.bounds; return b ? -b.z + 0.2 : -8; }
