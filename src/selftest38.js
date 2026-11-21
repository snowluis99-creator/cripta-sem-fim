// Teste automático, parte 38 (11/11/2026): bênçãos RARAS do Cavaleiro, lote 1 (11, krbless.js / krkit.js).
// Tecla F8 (só estes) e no fim do Y.
import { BLESSINGS } from './blessings.js';
import { WEAPON_BLESSINGS } from './weaponbless.js';
import { krS, krAtkMul } from './krkit.js';
import { spendShield } from './shield.js';

const ok = (c, extra = '') => (c ? `✔${extra ? ` ${extra}` : ''}` : `ERRO${extra ? ` (${extra})` : ''}`);

export function* krTests(g, out, flags) {
  const { player, combat, waves } = g;
  const realInput = player.input;
  const clearStrip = (x0, x1, z0, z1) => { combat.world.rects = combat.world.rects.filter((r) => !(r.maxX > x0 && r.minX < x1 && r.maxZ > z0 && r.minZ < z1)); };
  const fresh = (weapon) => {
    player.input = realInput;
    g.restart(); waves.stop(); combat.clear(); waves.paused = true;
    player.setHero('knight', weapon); player.reset(0, 2); player.facing = Math.PI; player.group.rotation.y = Math.PI;
    clearStrip(-9, 9, -16, 8);
    combat.demo.list = [];
    flags.events.length = 0;
  };
  const give = (id, n = 1) => { const b = BLESSINGS.find((x) => x.id === id); for (let i = 0; i < n; i++) player.addBlessing(b); };
  const dummy = (x, z, type = 'minion', hp = 999) => { const e = combat.spawn(type, x, z, { awake: true, passive: true, facing: 0 }); e.hp = e.maxHp = hp; if (type !== 'warrior') e.shieldCovers = () => false; return e; };
  const ev = (t) => flags.events.filter((e) => e.type === t);
  const until = function* (cond, ms = 3000) { const t0 = performance.now(); yield () => cond() || performance.now() - t0 > ms; };
  const fake = (o = {}) => ({ moveDir: (v) => v.set(0, 0, 0), aimAngle: () => null, attack: () => false, attackHeld: () => false, dodge: () => false, dodgeHeld: () => false, potion: () => false, interact: () => false, ultimate: () => false, blocking: () => false, ...o });
  const C = () => player.hero.combo;
  const hit = (i) => { player.combo = i; combat.playerStrike(player, C()[i]); };
  const heavyI = () => C().findIndex((s) => s.heavy);
  const lastDmg = (e) => { const h = ev('hit').filter((x) => x.enemy === e); return h.length ? h[h.length - 1].dmg : 0; };
  const bonus = (e) => ev('bonus').filter((x) => x.enemy === e).reduce((t, x) => t + x.dmg, 0);
  const dist = (e) => Math.hypot(e.position.x - player.position.x, e.position.z - player.position.z);
  const block = () => { player.setState('block'); player.anim.play(player.hero.anims.blocking, { fade: 0.05 }); };
  let rnd = null;
  const fixRandom = (v) => { if (!rnd) rnd = Math.random; Math.random = () => v; };
  const realRandom = () => { if (rnd) Math.random = rnd; rnd = null; };

  // ---------- 622) Lista ----------
  out('622) Raras do Cavaleiro (lote 1): as 11 bênçãos novas');
  const kr = WEAPON_BLESSINGS.filter((b) => b.id.startsWith('w_kr'));
  const per = ['espada', 'mangual', 'lanca'].map((w) => kr.filter((b) => b.weapon === `knight.${w}`).length);
  out(`  ${kr.length} bênçãos ${ok(kr.length === 11)} | Espada/Mangual/Lança 6/3/2 ${ok(per.join() === '6,3,2', per.join('/'))} | todas raras ${ok(kr.every((b) => b.rarity === 'rare'))} | textos ${ok(kr.every((b) => b.desc(1).length > 10 && b.desc(b.max).length > 10))}`);
  const inesp = kr.find((b) => b.name === 'Ataque Inesperado');
  out(`  só o Ataque Inesperado tem 2 níveis ${ok(inesp.max === 2 && kr.filter((b) => b.max !== 1).length === 1)} | Investida x Trenó/Cavalo ${ok(kr.find((b) => b.id === 'w_kre2').excludes.includes('w_esp21'))} | Âncora x Sino/Equilíbrio ${ok(kr.find((b) => b.id === 'w_krf2').excludes.includes('w_man25'))}`);

  // ================= Espada e Escudo =================
  out('623) Passo de Guarda: anda com o escudo levantado');
  fresh('espada'); yield 0.1;
  player.input = fake({ blocking: () => true, moveDir: (v) => v.set(1, 0, 0) });
  player.enterBlock(g.cam.camera); yield 0.6;
  const px0 = player.position.x;
  give('w_kre1');
  player.input = fake({ blocking: () => true, moveDir: (v) => v.set(1, 0, 0) });
  yield 0.6;
  out(`  sem a bênção: parado (x ${px0.toFixed(2)}) ${ok(Math.abs(px0) < 0.2)} | com ela andou ${(player.position.x - px0).toFixed(1)} ${ok(player.position.x - px0 > 1.2 && player.state === 'block')}`);
  player.input = realInput;

  out('624) Investida de Escudo: rolar bloqueando avança, segura flechas e atordoa 3 s');
  fresh('espada'); yield 0.1;
  give('w_kre2');
  const archer = dummy(4, -14, 'archer', 50);
  player.input = fake({ blocking: () => true }); block(); player.facing = Math.PI;
  const sh0 = player.shield, hp0 = player.hp;
  combat.projectiles.fire(0, -4.5, 0, { speed: 16, damage: 9, kind: 'arrow', owner: archer });
  player.startDodge();
  out(`  virou avanço ${ok(player.state === 'krBash' && ev('krBash').length === 1)} | gastou 1 carga ${ok(player.shield === sh0 - 1)} | invulnerável ${ok(player.invulnerable)}`);
  yield* until(() => player.state !== 'krBash', 1500);
  out(`  flecha destruída ${ok(ev('smashed').length >= 1)} | sem dano ${ok(player.hp === hp0)} | voltou a bloquear ${ok(player.state === 'block')}`);
  let a = dummy(0, -4);
  player.position.set(0, 0, 1); player.facing = Math.PI; block();
  player.startDodge();
  yield* until(() => ev('krBashHit').length > 0, 1500);
  out(`  bateu no 1º inimigo ${ok(ev('krBashHit').length === 1)} | atordoado ${a.stunTime.toFixed(1)} s ${ok(a.state === 'hurt' && a.stunTime > 2.5)}`);
  player.input = realInput; player.setState('idle');

  out('625) Guarda Total: bloqueia pelas costas; 2 bloqueios em 1 s atordoam a sala');
  fresh('espada'); yield 0.1;
  const fb = dummy(0, 4.5);
  player.input = fake({ blocking: () => true }); block(); player.facing = Math.PI;
  combat.hitPlayer(fb, 10, { target: player });
  out(`  sem a bênção, golpe por trás entra ${ok(player.hp < player.maxHp)}`);
  player.hp = player.maxHp; player.iframes = 0; player.setState('idle'); yield 0.1;
  give('w_kre3');
  const far1 = dummy(6, -6), far2 = dummy(-6, -6);
  player.input = fake({ blocking: () => true }); block(); player.facing = Math.PI;
  combat.hitPlayer(fb, 10, { target: player });
  out(`  com ela: bloqueou por trás ${ok(player.hp === player.maxHp && ev('blockedHero').length >= 1)} | 1 bloqueio não bate no chão ${ok(ev('krSlam').length === 0)}`);
  yield 0.4;
  combat.hitPlayer(fb, 10, { target: player });
  out(`  2º em menos de 1 s: escudo no chão ${ok(ev('krSlam').length === 1)} | longe atordoados ${ok(far1.state === 'hurt' && far2.state === 'hurt' && far1.stunTime > 1.5)}`);
  yield 1.5;
  combat.hitPlayer(fb, 10, { target: player });
  out(`  bloqueio sozinho depois não repete ${ok(ev('krSlam').length === 1)}`);
  player.input = realInput; player.setState('idle');

  out('626) Adaptação: escudo destruído = +50% de dano e de velocidade');
  fresh('espada'); yield 0.1;
  give('w_kre4');
  a = dummy(0, 0.6);
  fixRandom(0.5); // sem variação de dano nem crítico
  hit(0); const ad0 = lastDmg(a); const sp0 = krAtkMul(player);
  player.shield = 1; spendShield(player, combat); yield 0.1;
  hit(0); const ad1 = lastDmg(a);
  realRandom();
  out(`  com escudo ${ad0} (vel ×${sp0}) | sem escudo ${ad1} (vel ×${krAtkMul(player)}) ${ok(ad1 >= ad0 * 1.4 && krAtkMul(player) === 1.5 && sp0 === 1)} | aviso ${ok(ev('krAdapt').length === 1)}`);

  out('627) Resposta Rápida: o 1º golpe de cada onda é bloqueado sozinho');
  fresh('espada'); yield 0.1;
  give('w_kre5');
  const atk = dummy(0, 1);
  const sr0 = player.shield;
  combat.hitPlayer(atk, 12, { target: player });
  const hpA = player.hp;
  player.iframes = 0;
  combat.hitPlayer(atk, 12, { target: player });
  out(`  1º golpe: bloqueado ${ok(hpA === player.maxHp && ev('krAutoBlock').length === 1 && player.shield === sr0 - 1)} | 2º entra ${ok(player.hp < hpA)}`);
  const wv = combat.kit2.waves; const wv0 = wv.wave; wv.wave = wv0 + 1;
  player.iframes = 0; const hpB = player.hp;
  combat.hitPlayer(atk, 12, { target: player });
  out(`  onda nova: bloqueia de novo ${ok(player.hp === hpB && ev('krAutoBlock').length === 2)}`);
  wv.wave = wv0;

  out('628) Postura Firme: golpe forte tem 35% de chance de restaurar 1 carga');
  fresh('espada'); yield 0.1;
  give('w_kre6');
  a = dummy(0, 0.6); player.shield = 5;
  fixRandom(0.2); hit(heavyI()); const ps1 = player.shield;
  fixRandom(0.6); hit(heavyI()); const ps2 = player.shield;
  hit(0); realRandom();
  out(`  sorte: 5 -> ${ps1} ${ok(ps1 === 6)} | azar: fica ${ps2} ${ok(ps2 === 6)} | golpe fraco não conta ${ok(player.shield === 6)}`);

  // ================= Mangual e Escudo =================
  out('629) Bola de Guarda: bloqueando, a bola acerta quem chega pelas costas');
  fresh('mangual'); yield 0.1;
  give('w_krf1');
  const back = dummy(0, 3.7);
  player.input = fake({ blocking: () => true }); block(); player.facing = Math.PI;
  yield* until(() => ev('krGuardBall').length > 0, 2500);
  const gb = ev('krGuardBall');
  out(`  acertou o de trás ${ok(gb.length >= 1 && gb[0].enemy === back)} | dano ${bonus(back)} ${ok(bonus(back) > 0)}`);
  out('  -> Bola de Guarda (screenshot)'); yield 'hold';
  player.input = realInput; player.setState('idle'); yield 0.2;
  out(`  soltou o bloqueio: a bola volta para a mão ${ok(!player.weapon.userData.flail.lash)}`);

  out('630) Âncora de Ferro: segurar o ataque bloqueando carrega e lança a bola');
  fresh('mangual'); yield 0.1;
  give('w_krf2');
  const tgt = dummy(0, -12);
  let press = true, held = true;
  player.input = fake({ blocking: () => true, attack: () => { if (press) { press = false; return true; } return false; }, attackHeld: () => held });
  block(); player.facing = Math.PI;
  yield 1.7;
  out(`  carregando (bola girando) ${ok(!!(player.krs && player.krs.anc) && player.state === 'block')}`);
  out('  -> Âncora carregando (screenshot)'); yield 'hold';
  held = false;
  yield* until(() => ev('krAnchorHit').length > 0, 2000);
  const an = ev('krAnchor')[0];
  out(`  lançou com carga cheia (até ${an ? an.max.toFixed(0) : '?'} m) ${ok(an && an.k >= 1 && an.max >= 15)} | acertou a 12 m ${ok(ev('krAnchorHit').length === 1 && bonus(tgt) >= 25, String(bonus(tgt)))}`);
  yield* until(() => ev('krAnchorBack').length > 0, 2000);
  out(`  a bola voltou ${ok(ev('krAnchorBack').length === 1 && !player.krs.ball)}`);
  const origAtk = player.startAttack; let started = 0;
  player.startAttack = function (...x) { started++; return origAtk.apply(this, x); };
  press = true; held = true; yield 0.05; held = false; yield 0.1;
  player.startAttack = origAtk;
  out(`  toque rápido = golpe normal ${ok(started === 1 && ev('krAnchor').length === 1)}`);
  player.input = realInput; yield 0.6;

  out('631) Ataque Inesperado: o 1º golpe gira 360°');
  fresh('mangual'); yield 0.1;
  give('w_krf3');
  const fr = dummy(0, 0.2), bk = dummy(0, 3.6);
  fixRandom(0.7); hit(0);
  out(`  N1 (50%), sem sorte: o de trás não leva ${ok(lastDmg(bk) === 0 && lastDmg(fr) > 0)}`);
  fixRandom(0.3); hit(0);
  out(`  N1, com sorte: o de trás leva ${ok(lastDmg(bk) > 0 && ev('krSpin360').length === 1)}`);
  give('w_krf3'); fixRandom(0.99); flags.events.length = 0; hit(0); realRandom();
  out(`  N2 (100%): sempre gira ${ok(ev('krSpin360').length === 1)} | 2º golpe nunca gira ${ok((() => { hit(1); return ev('krSpin360').length === 1; })())}`);
  yield 0.4;

  // ================= Lança =================
  out('632) Cabo de Guarda: quem encosta leva pancada e volta para a ponta da lança');
  fresh('lanca'); yield 0.1;
  give('w_krl1');
  const cl = dummy(0, 1.0);
  yield* until(() => ev('krCabo').length > 0, 1000);
  yield 1.2;
  out(`  pancada ${ok(ev('krCabo').length === 1)} | foi para ${dist(cl).toFixed(1)} m ${ok(dist(cl) > 3.5)}`);
  cl.position.set(0, 0, 1.0); cl.vel.set(0, 0, 0); cl.setState('chase'); yield 0.3;
  out(`  de novo antes de 3 s: nada ${ok(ev('krCabo').length === 1)}`);
  yield 3.0;
  out(`  depois de 3 s: de novo ${ok(ev('krCabo').length === 2)}`);

  out('633) Recuem!: abaixo de 50% da vida, todos voam até as paredes (1 vez por sala)');
  fresh('lanca'); yield 0.1;
  give('w_krl2');
  const ring = [dummy(3, 0), dummy(-3, 2), dummy(0, -3), dummy(2, 5)];
  const atk2 = dummy(0, 0.5);
  player.hp = 55; player.iframes = 0;
  combat.hitPlayer(atk2, 4, { target: player });
  out(`  51 de vida (acima de 50%): nada ${ok(ev('krRecuem').length === 0)}`);
  player.iframes = 0;
  combat.hitPlayer(atk2, 4, { target: player });
  out(`  caiu abaixo de 50%: Recuem! ${ok(ev('krRecuem').length === 1 && player.state === 'krSpin' && player.invulnerable)}`);
  out('  -> Recuem! (screenshot)'); yield 'hold';
  yield 1.4;
  const ds = ring.map(dist);
  out(`  todos longe (${ds.map((d) => d.toFixed(0)).join(', ')} m) ${ok(ds.every((d) => d > 6))}`);
  player.iframes = 0; atk2.position.set(0, 0, 2.5); atk2.vel.set(0, 0, 0);
  combat.hitPlayer(atk2, 4, { target: player });
  out(`  na mesma sala não repete ${ok(ev('krRecuem').length === 1)}`);
  combat.kr.roomStart(); player.iframes = 0;
  combat.hitPlayer(atk2, 4, { target: player });
  out(`  sala nova: volta a valer ${ok(ev('krRecuem').length === 2)}`);
  yield 1.0;

  player.input = realInput;
  realRandom();
  krS(player);
}
