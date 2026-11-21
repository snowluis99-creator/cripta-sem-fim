// Teste automático, parte 43 (12/11/2026): bênção LENDÁRIA Bênção de Odin (Machado de Duas Mãos): o Deus do Trovão.
// l1bless.js / thorkit.js / thorlook.js. Roda junto com a parte 42 (teclas * e / do numérico, e no fim do Y).
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { L1 } from './l1bless.js';
import { thorOn } from './thorkit.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* thorTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const T = L1.thor;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const ctl = { atk: 0, blk: false, mx: 0, mz: 0, aim: null, dodge: 0 };
  const fake = () => ({ moveDir: (v) => v.set(ctl.mx, 0, ctl.mz), aimAngle: () => ctl.aim, attack: () => (ctl.atk > 0 ? (ctl.atk--, true) : false), attackHeld: () => false, dodge: () => (ctl.dodge > 0 ? (ctl.dodge--, true) : false), dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => ctl.blk });
  const fresh = (hero = 'knight', weapon = 'machado') => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    for (const k of [...g.run.pickups]) g.run.removePickup(k);
    player.setHero(hero, weapon); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    clearStrip(-12, 12, -18, 10);
    combat.demo.list = [];
    flags.events.length = 0;
    Object.assign(ctl, { atk: 0, blk: false, mx: 0, mz: 0, aim: null, dodge: 0 });
    player.input = fake();
  };
  const give = (id) => player.addBlessing(BLESSINGS.find((x) => x.id === id));
  const dummy = (x, z, type = 'minion', hp = 999, passive = true) => { const e = combat.spawn(type, x, z, { awake: true, passive, facing: 0 }); e.hp = e.maxHp = hp; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 6000) { for (let t = 0; t < ms / 1000 && !cond(); t += 0.05) yield 0.05; };
  const killAll = () => { for (const e of combat.enemies) if (e.alive) e.die(); };

  // ---------- 673) Lista ----------
  out('673) Lendária Bênção de Odin (Machado): o Deus do Trovão');
  const b = WEAPON_BLESSINGS.find((x) => x.id === 'w_l1m1');
  out(`  existe ${ok(!!b)} | só do Machado ${ok(b && b.weapon === 'knight.machado')} | lendária, máx. 1 ${ok(b && b.rarity === 'legendary' && b.max === 1)} | texto fala de +100% e ${T.boom.dmg} ${ok(b && b.desc(1).includes('+100%') && b.desc(1).includes(String(T.boom.dmg)))}`);

  // ---------- 674) Transformação ----------
  out('674) Pegou a bênção: cena dos raios e o Cavaleiro vira Thor');
  fresh(); yield 0.2;
  const near = dummy(0.5, -1.5, 'minion', 999);
  const hp0 = player.hp, max0 = player.maxHp, spd0 = player.moveMul, atk0 = player.atkSpeed;
  give('w_l1m1');
  yield* until(() => player.thor && player.thor.phase === 'intro');
  out(`  começou ${ok(ev('thorBegin').length === 1)} | cena: nada machuca ${ok(player.invulnerable)}`);
  yield 0.6; out('  -> raios caindo na sala (screenshot)'); yield 'hold';
  yield* until(() => ev('thorStrike').length > 0); yield 0.15;
  out('  -> raio gigante no Cavaleiro (screenshot)'); yield 'hold';
  yield* until(() => thorOn(player), 4000); yield 0.1;
  const L = player.thorLook;
  out(`  pronto ${ok(thorOn(player) && player.state !== 'cine')} | vida +${T.hp} ${ok(player.maxHp === max0 + T.hp, `${max0}→${player.maxHp}`)} | curou ${ok(player.hp === Math.min(player.maxHp, hp0 + T.hp))} | dano ×2 ${ok(Math.abs(player.stats.damageMul - 2) < 1e-6)} | ataque ×2 ${ok(Math.abs(player.atkSpeed - atk0 * 2) < 1e-6)} | movimento ×2 ${ok(Math.abs(player.moveMul - spd0 * 2) < 1e-6)}`);
  out(`  visual: capa vermelha ${ok(L && L.capes.length > 0)} | elmo com asas ${ok(L && !!L.rig && !!L.rig.parent)} | machado azul ${ok(L && L.glow.length > 0)} | a onda não machucou ${ok(near.hp === 999)} | sem erros ${ok(!window.__game.errors.length, window.__game.errors[0])}`);
  out('  -> Cavaleiro como Thor (screenshot)'); yield 'hold';
  killAll(); yield 0.2;

  // ---------- 675) Relâmpago em todo golpe ----------
  out('675) Todo golpe chama um relâmpago em todos os inimigos perto (dano do golpe)');
  player.position.set(0, 0, 2); player.facing = Math.PI; ctl.aim = Math.PI;
  const front = dummy(0, 0.2), behind = dummy(0, 5.5), side = dummy(4.5, 2), far = dummy(9, 2);
  flags.events.length = 0; ctl.atk = 1;
  yield* until(() => ev('thorZap').length >= 1); yield 0.05;
  const z1 = ev('thorZap')[0], want1 = Math.round(player.hero.combo[0].damage * player.stats.damageMul);
  out(`  relâmpago: ${z1 && z1.n} inimigos, ${z1 && z1.dmg} de dano ${ok(z1 && z1.n === 3 && z1.dmg === want1, `queria 3 × ${want1}`)} | atrás levou ${ok(behind.hp === 999 - want1, String(999 - behind.hp))} | do lado levou ${ok(side.hp === 999 - want1)} | o da frente levou o golpe + raio ${ok(999 - front.hp > want1)} | longe não ${ok(far.hp === 999)}`);
  out('  -> relâmpagos (screenshot)'); yield 'hold';
  yield* until(() => player.state !== 'attack', 3000);
  killAll(); yield 0.2;

  // ---------- 676) Arremesso ----------
  out('676) Sem ninguém no alcance: arremessa o machado, leva todos até a parede e executa');
  player.position.set(0, 0, 6); player.facing = Math.PI; ctl.aim = Math.PI;
  const line = [dummy(0, 0.5, 'minion', 300), dummy(0.8, -2.5, 'warrior', 300), dummy(-0.7, -5, 'minion', 300)];
  const aside = dummy(6, -2, 'minion', 300);
  flags.events.length = 0; ctl.atk = 1;
  yield* until(() => ev('thorThrow').length >= 1, 3000);
  out(`  arremessou ${ok(ev('thorThrow').length === 1)} | sem machado na mão ${ok(!player.weapon.visible)}`);
  yield* until(() => ev('thorGrab').length >= 2, 2000); yield 0.05;
  out('  -> machado levando os esqueletos (screenshot)'); yield 'hold';
  ctl.atk = 1; yield 0.1;
  out(`  com o machado voando, atacar não faz nada ${ok(ev('thorThrow').length === 1)}`);
  yield* until(() => ev('thorExplode').length >= 1, 4000); yield 0.05;
  const ex = ev('thorExplode')[0];
  out(`  pegou os 3 ${ok(ev('thorGrab').length === 3, String(ev('thorGrab').length))} | explosão na parede executou ${ok(ex && ex.n === 3 && line.every((e) => !e.alive), ex && String(ex.n))} | o de lado ficou ${ok(aside.alive && aside.hp === 300)}`);
  out('  -> explosão na parede (screenshot)'); yield 'hold';
  yield* until(() => ev('thorCatch').length >= 1, 4000); yield 0.05;
  out(`  o machado voltou para a mão ${ok(ev('thorCatch').length === 1 && player.weapon.visible && !player.thorAxe)}`);
  killAll(); yield 0.2;
  // Chefe: leva 150, não é executado.
  player.position.set(0, 0, 6); player.facing = Math.PI; ctl.aim = Math.PI;
  const boss = dummy(0, -1, 'guardian', 2000);
  flags.events.length = 0; ctl.atk = 1;
  yield* until(() => ev('thorExplode').length >= 1, 4000); yield 0.05;
  out(`  chefe: levou ${T.throw.boss} e não foi executado ${ok(boss.alive && ev('thorBossHit').length === 1, String(2000 - boss.hp))}`);
  yield* until(() => !player.thorAxe, 3000);
  killAll(); yield 0.3;

  // ---------- 677) Rolamento instantâneo ----------
  out('677) O rolamento vira um raio instantâneo');
  player.position.set(-4, 0, 2); yield 0.3;
  flags.events.length = 0;
  ctl.mx = 1; ctl.dodge = 1; yield 1 / 60 * 2; ctl.mx = 0;
  const bl = ev('thorBlink')[0];
  out(`  na hora: andou ${bl ? bl.d.toFixed(1) : '?'} ${ok(bl && bl.d > player.hero.dodge.distance * 0.9)} | já pode agir ${ok(player.state === 'idle' || player.state === 'run')}`);
  out('  -> rastro do raio (screenshot)'); yield 'hold';

  // ---------- 678) Explosão ao apanhar ----------
  out(`678) Levar um golpe solta uma explosão de raio na sala inteira (${T.boom.dmg}; 1 a cada ${T.boom.cd} s)`);
  player.position.set(0, 0, 2); yield 0.5;
  const foe = dummy(0, 0.6, 'minion', 999), r1 = dummy(-9, -10, 'minion', 999), r2 = dummy(9, -12, 'warrior', 999);
  flags.events.length = 0; player.iframes = 0;
  combat.hitPlayer(foe, 10, { target: player });
  out(`  explodiu ${ok(ev('thorBoom').length === 1)} | todos levaram ${T.boom.dmg} ${ok([foe, r1, r2].every((e) => e.hp === 999 - T.boom.dmg), [foe, r1, r2].map((e) => 999 - e.hp).join('/'))}`);
  out('  -> explosão de raio (screenshot)'); yield 'hold';
  player.iframes = 0; combat.hitPlayer(foe, 10, { target: player });
  out(`  logo depois não explode de novo ${ok(ev('thorBoom').length === 1)}`);
  yield T.boom.cd + 0.2; player.iframes = 0;
  combat.hitPlayer(foe, 10, { target: player });
  out(`  depois de ${T.boom.cd} s explode de novo ${ok(ev('thorBoom').length === 2)}`);
  killAll(); yield 0.2;

  // ---------- 679) Outras bênçãos continuam ----------
  out('679) As outras bênçãos continuam valendo');
  give('forca');
  player.position.set(0, 0, 2); player.facing = Math.PI; ctl.aim = Math.PI; yield 0.3;
  const f1 = dummy(0, 0.2), f2 = dummy(-3, 4);
  flags.events.length = 0; ctl.atk = 1;
  yield* until(() => ev('thorZap').length >= 1); yield 0.05;
  const want2 = Math.round(player.hero.combo[0].damage * 2.2);
  out(`  Força Bruta soma: relâmpago de ${want2} ${ok(f2.hp === 999 - want2, String(999 - f2.hp))}`);
  yield* until(() => player.state !== 'attack', 3000);
  killAll();

  // ---------- 680) Troca de sala e partida nova ----------
  out('680) Continua na sala seguinte; partida nova volta ao normal');
  combat.clear(); player.placeAt(0, 3); yield 0.3;
  out(`  outra sala: ainda Thor ${ok(thorOn(player) && !!player.thorLook)}`);
  fresh(); yield 0.3;
  out(`  partida nova: Cavaleiro normal ${ok(!player.thor && !player.thorLook && player.stats.damageMul === 1 && !player.blessings.w_l1m1)}`);
  fresh('knight', 'espada'); yield 0.1;
  out(`  Espada: a bênção não aparece ${ok(!WEAPON_BLESSINGS.some((x) => x.id === 'w_l1m1' && x.weapon !== 'knight.machado'))}`);
  out(`  sem erros do jogo ${ok(!window.__game.errors.length, window.__game.errors[0])}`);
  player.input = realInput; player.iframes = 0;
}
