// Bênçãos novas do Cajado de Fogo (lista do dono, 07/11/2026): as regras. As coisas na sala estão em fireprops.js;
// o esqueleto em pânico, em firestates.js. Sem import de combat.js: o combate cria o FireKit (combat.fire2) e chama
// os ganchos; magic.js, props.js e player.js chamam por combat.fire2 / pelas funções exportadas (sem import circular).
import * as THREE from 'three';
import { audio } from './audio.js';
import { FireProps, glow } from './fireprops.js';

export const FIRE = {
  panic: { burn: 3, touch: 0.2, speed: 1.4 },                                   // Pânico: corre sem rumo e põe fogo em quem encosta
  blue: { n: 3, mul: 2, every: 0.8, r: 2.4, color: 0x3a8cff },                  // Fogo Azul: 3 vezes seguidas = fogo azul (×2) que pula
  spark: { range: 6.5, speed: 11, dps: 3, burn: 3 },                            // Faísca Saltitante
  melt: 3,                                                                      // Derreter: 3 s queimando
  chain: { r: 2.2, dmg: 8, gap: 0.09 },                                         // Reação em Cadeia
  powder: { fuse: 0.9, r: 2.8, dmg: 20, pool: 2.5, re: /^(barrel|box|crates|keg)/ }, // Pólvora
  torch: { range: 5.5, cd: 1.6, dmg: 5, speed: 13 },                            // Tochas Vivas
  volcano: { range: 8, n: 3, first: 0.35, gap: 0.5, r: 1.6, dmg: 7, pool: 1.8 }, // Vulcão
  smoke: { r: 1.7, life: 2.6, every: 1.0, nova: 2.6, miss: 0.5, max: 14 },     // Fumaça
  works: { n: 5, speed: 7, arc: 5, r: 1.6, dmg: 6 },                            // Fogos de Artifício
  trail: { gap: 0.45, r: 0.8, life: 2, dmg: 2, burn: 2 },                       // Rastro de Chamas
  phoenix: { r: 1.25, dmg: 6 },                                                 // Voo da Fênix
  child: { heal: 2, tick: 0.5 },                                                // Filha do Fogo
  ring: { time: 3, n: 3, r: 1.9, spin: 4.2, hitR: 0.75, dmg: 4, cd: 0.5 },      // Anel de Chamas
  heat: { max: 12, wait: 1.2, decay: 2.5, blaze: 4, r: 1.0, tick: 0.4, dmg: 4, self: 3, breath: 0.15 }, // Superaquecimento
  inner: 0.9,                                                                   // Chama Interior: com pouca vida, até +90% de raio
  breath: { delay: 0.3, tick: 0.12, range: 3.0, arc: 56, dmg: 1.5, burn: 1.5 }, // lança-chamas antigo (desligado)
  dragon: 2,                                                                    // Sopro do Dragão: 1º golpe com o dobro de alcance
  release: { max: 40, step: 0.25, width: 1.1 },                                 // Liberação Ardente: até a 1ª parede
  sala: { every: 1.1, range: 7.5, dmg: 4, speed: 12 },                          // Salamandra
  ash: { n: 10, r: 2.2, dmg: 3 },                                               // Cinzas: 10 brasas = explosão gigante (raio ×2,2, dano ×3)
};
const ORANGE = 0xff7a2a;
const COLORS = [0xff4a6a, 0x4ae0ff, 0xffe04a, 0x7aff6a, 0xd06aff];
const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const isFire = (p) => !!(p && p.heroId === 'mage' && p.hero && p.hero.weaponId === 'fogo');
const has = (p, k) => isFire(p) && !!W(p)[k];
let K = null;

// Voo da Fênix: o rolamento vira um voo (o rolamento normal continua; o FireKit troca o visual e queima quem passar).
export function fireStartDodge(p) {
  if (!K || !has(p, 'fPhoenix')) return;
  p.firePhoenix = { hit: new Set(), t: 0, m: null };
}
// Lança-chamas segurando o ataque (era o Sopro do Dragão antigo; desligado a pedido do dono, 07/11/2026).
export function fireHoldCheck(p, input) {
  if (!K || !has(p, 'fBreathHold') || p.xstep || p.combo !== 0 || !p.hitDone) return false;
  if (p.stateTime < FIRE.breath.delay || !(input.attackHeld && input.attackHeld())) return false;
  p.setState('fireBreath');
  p.fireBreath = { t: 0, tick: 0, snd: 0 };
  p.queued = false;
  p.anim.play(p.hero.combo[0].clip, { fade: 0.12, speed: 0.35 });
  K.log({ type: 'fireBreath' });
  return true;
}
// Segurando o lança-chamas. 'end' = soltou o botão.
export function fireBreathTick(p, dt, input, camera) {
  if (!K || !(input.attackHeld && input.attackHeld())) { p.fireBreath = null; return 'end'; }
  const want = p.aimAngle(camera);
  p.facing += wrap(want - p.facing) * (1 - Math.exp(-12 * dt));
  p.group.rotation.y = p.facing;
  K.breathTick(p, dt);
  return null;
}
// Sopro do Dragão: o cone do 1º golpe vai o dobro mais longe (magic.js).
export const fireConeMul = (p) => (K && has(p, 'fDragon') ? FIRE.dragon : 1);
// Liberação Ardente: a linha de fogo do 2º golpe vai até a primeira parede (magic.js). 0 = sem a bênção.
export function fireLineLen(p, x, z, fx, fz) {
  if (!K || !has(p, 'fRelease')) return 0;
  const R = FIRE.release, wd = K.c.world, b = wd && wd.bounds;
  const skip = new Set(((K.c.props && K.c.props.list) || []).filter((o) => !o.broken && o.rect).map((o) => o.rect)); // quebráveis: a linha quebra e passa
  const wall = (nx, nz) => wd && wd.rects.some((r) => !r.ice && !skip.has(r) && nx > r.minX - 0.15 && nx < r.maxX + 0.15 && nz > r.minZ - 0.15 && nz < r.maxZ + 0.15);
  let d = 0;
  while (d < R.max) {
    const nx = x + fx * (d + R.step), nz = z + fz * (d + R.step);
    if (wall(nx, nz)) break;
    if (b && (Math.abs(nx) > b.x || Math.abs(nz) > b.z)) break;
    d += R.step;
  }
  K.log({ type: 'fireRelease', len: d });
  return Math.max(d, 1);
}
// Troca de arma/herói, partida nova: tudo volta ao normal.
export function fireReset(p) {
  p.fireHeat = 0; p.fireBlazeT = 0; p.fireAsh = 0; p.fireBreath = null;
  if (K) K.dropFor(p);
}

export class FireKit {
  constructor(c) {
    this.c = c; K = this;
    this.props = new FireProps(c);
    this.torches = [];
    this.time = 0;
    this.chains = [];
    this.fx = new Map(); // barras do Superaquecimento e brasas das Cinzas (por heroína)
  }
  log(o) { if (this.c.log) this.c.log(o); }
  owner(k) { return this.c.players.find((p) => p.state !== 'dead' && has(p, k)) || null; }
  who(e, k) { return has(e && e.burnBy, k) ? e.burnBy : this.owner(k); }
  foe(o) { return o && o.alive && !o.undead && !(o.data && o.data.phantom); }
  dmg(p, n) { return Math.max(1, Math.round(n * ((p && p.stats && p.stats.damageMul) || 1))); }

  // Põe fogo (ou renova). t = duração base (as bênçãos de duração somam).
  ignite(e, by, dps, t = 3) {
    if (!e || !e.alive || !e.targetable || e.undead) return;
    const was = e.burn > 0;
    e.burn = Math.max(e.burn || 0, t + (W(by).burnTime || 0));
    e.burnDps = Math.max(was ? e.burnDps || 0 : 0, dps);
    if (!was) e.burnTick = 0.5;
    e.burnBy = by;
    if (e.blueFire) e.burnDps = Math.max(e.burnDps, dps * FIRE.blue.mul);
  }
  hit(p, e, n, nx, nz, cls = 'burn') {
    if (!e.targetable) return;
    if (n > 0) this.c.bonusDamage(e, this.dmg(p, n), nx, nz, cls, p, true);
  }
  // Explosão de fogo em área: dano + fogo em quem pegar (não machuca a Maga).
  blast(p, x, z, r, n, skip = null, burn = 2) {
    let hits = 0;
    for (const e of [...this.c.enemies]) {
      if (e === skip || !e.targetable || e.undead) continue;
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz);
      if (d > r + e.data.radius) continue;
      this.hit(p, e, n, dx / (d || 1), dz / (d || 1));
      this.ignite(e, p, burn * p.stats.damageMul);
      hits++;
    }
    this.c.props.hitCircle(x, z, r * 0.8, p);
    return hits;
  }

  // Sala nova: tochas acesas da parede (Tochas Vivas).
  setRoom(built) {
    const tmp = new THREE.Vector3();
    this.torches = (built && built.torches ? built.torches : []).filter((t) => t.sprite).map((t) => {
      t.sprite.getWorldPosition(tmp);
      return { x: tmp.x, y: tmp.y, z: tmp.z, cd: Math.random() * 0.6 };
    });
  }

  // ---------- Toda magia do Cajado de Fogo, no começo (magic.js): Superaquecimento ----------
  onCast(p, step) {
    if (!has(p, 'fHeat')) return;
    p.fireHeatIdle = 0;
    if (p.fireBlazeT > 0) { this.selfBurn(p, FIRE.heat.self); return; }
    this.addHeat(p, 1);
  }
  addHeat(p, n) {
    const H = FIRE.heat;
    p.fireHeat = Math.min(H.max, (p.fireHeat || 0) + n);
    if (p.fireHeat < H.max) return;
    p.fireHeat = 0; p.fireBlazeT = H.blaze; p.fireBlazeTick = 0;
    this.c.text.add('Superaquecida!', p.position, 'crit', 3.8);
    audio.play('fireRoar', p.position.x, p.position.z);
    this.c.vfx.ring(v3(p.position.x, 0, p.position.z), 0xff5010, 2.2);
    this.log({ type: 'fireBlaze' });
  }
  selfBurn(p, n) {
    if (p.state === 'dead' || p.invulnerable) return;
    const d = Math.min(n, p.hp - 1); // o próprio fogo não mata
    if (d <= 0) return;
    p.hp -= d; p.hurtFlash = 1;
    this.c.text.add(String(d), p.position, 'hurt small');
    this.c.vfx.sparks(v3(p.position.x, 1.2, p.position.z), 0xff5010, 6);
    this.log({ type: 'fireSelfBurn', dmg: d });
  }

  // ---------- Toda magia de fogo que acerta (magic.js, depois de pôr fogo): Fogo Azul ----------
  onFireHit(p, e, step) {
    if (!isFire(p) || !e.alive) return;
    e.fireN = e.fireWas ? (e.fireN || 0) + 1 : 1; // "seguidas": sem o fogo apagar no meio (fireWas = queimava no quadro anterior)
    if (e.blueFire) { e.burnDps *= FIRE.blue.mul; return; }
    if (has(p, 'fBlue') && e.fireN >= FIRE.blue.n) this.makeBlue(e, p);
  }
  makeBlue(e, p, from = null) {
    if (e.blueFire || !e.alive) return;
    e.blueFire = true; e.blueEvery = FIRE.blue.every;
    e.burnDps = (e.burnDps || 2) * (from ? 1 : FIRE.blue.mul);
    const g = glow(FIRE.blue.color, 1.8, 0.85);
    g.position.y = 1.1 / (e.group.scale.x || 1);
    e.group.add(g); e.blueGlow = g;
    this.c.text.add(from ? 'Fogo Azul!' : 'FOGO AZUL!', e.position, 'crit', 3.4);
    this.c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), FIRE.blue.color, 14);
    this.log({ type: from ? 'fireBlueJump' : 'fireBlue', enemy: e, from });
  }
  endBlue(e) {
    e.blueFire = false;
    if (e.blueGlow) { e.group.remove(e.blueGlow); e.blueGlow.material.dispose(); e.blueGlow = null; }
  }

  // ---------- 3º golpe (explosão em volta da Maga), magic.js ----------
  // Antes: tamanho/dano extra (Chama Interior, Cinzas) e quem já estava queimando (Reação em Cadeia).
  novaBoost(p, radius) {
    const out = { r: 1, dmg: 1, pre: [] };
    if (!isFire(p)) return out;
    const w = W(p);
    if (w.fInner) { out.r *= 1 + FIRE.inner * Math.max(0, 1 - p.hp / p.maxHp); if (out.r > 1.05) this.log({ type: 'fireInner', mul: out.r }); }
    if (w.fAsh && (p.fireAsh || 0) >= FIRE.ash.n) {
      p.fireAsh = 0; out.r *= FIRE.ash.r; out.dmg *= FIRE.ash.dmg; out.giant = true;
      this.c.text.add('EXPLOSÃO DE CINZAS!', p.position, 'crit', 4.2);
      this.c.shakeFor(p, 0.6);
      this.log({ type: 'fireAshBlast' });
    }
    if (w.fChain) {
      const R = radius * out.r;
      out.pre = this.c.enemies.filter((e) => e.targetable && e.burn > 0 && !e.undead
        && Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) <= R + e.data.radius);
    }
    return out;
  }
  // Depois: Reação em Cadeia, Fogos de Artifício, Vulcão, Anel de Chamas, fumaça.
  onNova(p, step, radius, boost) {
    if (!isFire(p)) return;
    const w = W(p), c = this.c, x = p.position.x, z = p.position.z;
    if (boost.giant) { c.vfx.ring(v3(x, 0, z), 0xffe04a, radius * 1.1); c.vfx.heavyImpact(v3(x, 0, z), radius / 1.6); }
    if (w.fChain && boost.pre.length) { // cada um que já queimava explode em sequência
      boost.pre.forEach((e, i) => this.chains.push({ p, e, x: e.position.x, z: e.position.z, t: FIRE.chain.gap * (i + 1) }));
      this.log({ type: 'fireChain', n: boost.pre.length });
    }
    if (w.fWorks) this.fireworks(p);
    if (w.fVolcano) this.volcano(p);
    if (w.fRing) { this.props.orbit(p, FIRE.ring); this.log({ type: 'fireRing' }); }
    if (w.fSmoke) this.smoke(x, z, FIRE.smoke.nova);
  }
  fireworks(p) {
    const F = FIRE.works, b = this.c.world && this.c.world.bounds;
    const bx = b ? b.x - 1 : 8, bz = b ? b.z - 1 : 6;
    for (let i = 0; i < F.n; i++) {
      const col = COLORS[i % COLORS.length];
      const to = { x: (Math.random() * 2 - 1) * bx, y: 0.3, z: (Math.random() * 2 - 1) * bz };
      this.props.ball({ from: { x: p.position.x, y: 1.6, z: p.position.z }, to, speed: F.speed * (0.8 + Math.random() * 0.4), arc: F.arc, color: col, trail: col, size: 0.7,
        onHit: (hx, hz) => {
          this.props.burst(hx, hz, col, F.r);
          audio.play('boom', hx, hz, { v: 0.35 });
          const n = this.blast(p, hx, hz, F.r, F.dmg);
          this.log({ type: 'fireWorksBoom', n });
        } });
    }
    audio.play('charge', p.position.x, p.position.z, { v: 0.5 });
    this.log({ type: 'fireWorks' });
  }
  volcano(p) {
    const V = FIRE.volcano;
    let t = null, bd = V.range;
    for (const e of this.c.enemies) {
      if (!e.targetable || e.undead) continue;
      const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
      if (d < bd) { bd = d; t = e; }
    }
    const x = t ? t.position.x : p.position.x + Math.sin(p.facing) * 3, z = t ? t.position.z : p.position.z + Math.cos(p.facing) * 3;
    this.props.crack(x, z, V, p, (ck) => {
      const n = this.blast(p, ck.x, ck.z, V.r, V.dmg);
      for (const e of this.c.enemies) if (e.targetable && !e.data.boss && Math.hypot(e.position.x - ck.x, e.position.z - ck.z) < V.r + e.data.radius && e.vel) {
        const dx = e.position.x - ck.x, dz = e.position.z - ck.z, d = Math.hypot(dx, dz) || 1;
        e.vel.set(dx / d, 0, dz / d).multiplyScalar(4);
      }
      this.props.patch(ck.x, ck.z, V.r * 0.8, ck.left ? 0.6 : V.pool, 'lava', p, (e) => { this.hit(p, e, 2, 0, 0); this.ignite(e, p, 2 * p.stats.damageMul, 2); });
      this.log({ type: 'fireVolcanoErupt', n, left: ck.left });
    });
    this.c.text.add('Vulcão!', { x, z }, 'crit', 3.0);
    this.log({ type: 'fireVolcano', target: t });
  }
  smoke(x, z, r) {
    const S = FIRE.smoke, cl = this.props.clouds;
    if (cl.length >= S.max) { const old = cl.shift(); this.props.drop(old.g); }
    this.props.cloud(x, z, r, S.life);
  }

  // ---------- A Maga vai apanhar (combat.hitPlayer): Fumaça faz errar metade ----------
  smokeMiss(p, e, opts) {
    if (opts.contact || !this.props.clouds.length || !this.owner('fSmoke')) return false;
    const src = (opts.shooter && opts.shooter.position) ? opts.shooter : e;
    if (!src || !src.position || !this.props.inSmoke(src.position.x, src.position.z)) return false;
    if (Math.random() >= FIRE.smoke.miss && !this.forceMiss) return false;
    this.c.text.add('Errou!', p.position, 'miss');
    audio.play('miss', p.position.x, p.position.z);
    this.log({ type: 'fireSmokeMiss' });
    return true;
  }

  // ---------- Barril/caixa atingido (props.js): Pólvora. true = pegou fogo (quebra depois) ----------
  lightProp(b, by) {
    const p = has(by, 'fPowder') ? by : null;
    if (!p || !FIRE.powder.re.test(b.name)) return false;
    b.fuse = true;
    const flame = glow(ORANGE, 1.6, 0.9);
    flame.position.set(b.x, Math.min(1.4, b.h * 0.8), b.z);
    this.props.add(flame);
    this.props.fuses.push({ b, p, t: FIRE.powder.fuse, flame, fx: 0 });
    this.c.text.add('Pólvora!', { x: b.x, z: b.z }, 'burn', 2.4);
    audio.play('fireRoar', b.x, b.z, { v: 0.5 });
    this.log({ type: 'firePowderLit', name: b.name });
    return true;
  }
  tickFuses(dt) {
    const P = FIRE.powder;
    for (const f of [...this.props.fuses]) {
      f.t -= dt; f.fx -= dt;
      f.flame.scale.setScalar(1.4 + Math.sin(this.time * 30) * 0.3 + (P.fuse - f.t) * 1.2);
      if (f.fx <= 0) { f.fx = 0.06; this.c.vfx.flameCone(v3(f.b.x, Math.min(1.2, f.b.h * 0.7), f.b.z), Math.random() * 6.3, 0.35, Math.PI, ORANGE, false); }
      if (f.t > 0) continue;
      this.props.fuses.splice(this.props.fuses.indexOf(f), 1);
      this.props.drop(f.flame);
      const { b, p } = f;
      this.c.props.smash(b, 0, 1, p);
      const at = v3(b.x, 0, b.z);
      this.c.vfx.heavyImpact(at, P.r / 2);
      this.c.vfx.ring(at, ORANGE, P.r);
      this.c.vfx.flameCone(v3(b.x, 0.8, b.z), 0, P.r * 0.7, Math.PI, ORANGE, true);
      audio.play('boom', b.x, b.z, { v: 0.9 });
      this.c.shakeFor(p, 0.25);
      const n = this.blast(p, b.x, b.z, P.r, P.dmg, null, 3); // pega os barris em volta: explodem em cadeia
      this.props.patch(b.x, b.z, 1.2, P.pool, 'pool', p, (e) => { this.hit(p, e, 2, 0, 0); this.ignite(e, p, 2 * p.stats.damageMul, 2); });
      this.log({ type: 'firePowderBoom', n, name: b.name });
    }
  }

  // ---------- Morreu (combat.killed): Cinzas ----------
  onKilled(e, by) {
    if (!(e.burn > 0) || e.undead || (e.data && e.data.phantom)) return;
    const p = has(by, 'fAsh') ? by : this.who(e, 'fAsh');
    if (!p || p.state === 'dead') return;
    if ((p.fireAsh || 0) >= FIRE.ash.n) return;
    p.fireAsh = (p.fireAsh || 0) + 1;
    const from = v3(e.position.x, 1.0, e.position.z);
    this.props.ball({ from, target: null, to: { x: p.position.x, y: 1.0, z: p.position.z }, speed: 10, arc: 1.2, color: 0xffb040, size: 0.5 });
    this.c.text.add(p.fireAsh >= FIRE.ash.n ? 'Cinzas prontas!' : `Brasa ${p.fireAsh}/${FIRE.ash.n}`, p.position, p.fireAsh >= FIRE.ash.n ? 'crit' : 'burn', 3.2);
    this.log({ type: 'fireAsh', n: p.fireAsh });
  }

  // ---------- Sopro do Dragão (player.js: estado fireBreath) ----------
  breathTick(p, dt) {
    const B = FIRE.breath, b = p.fireBreath, c = this.c;
    b.t += dt; b.tick -= dt; b.snd -= dt;
    if (b.tick > 0) return;
    b.tick = B.tick;
    const rangeMul = p.stats.rangeMul || 1, range = B.range * rangeMul, half = (B.arc / 2) * Math.PI / 180;
    c.vfx.flameCone(v3(p.position.x, 1.1, p.position.z), p.facing, range, half, ORANGE, false);
    if (b.snd <= 0) { b.snd = 0.45; audio.play('fireRoar', p.position.x, p.position.z, { v: 0.35 }); }
    c.props.strikeArc(p, range, half);
    const step = { damage: B.dmg, cast: { type: 'cone' }, breath: true };
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable || e.undead) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > range + e.data.radius || Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > half) continue;
      const r = c.damageEnemy(p, e, step, dx / d, dz / d, { spell: true, noStagger: true });
      if (r === 'hit' || r === 'kill') { n++; this.ignite(e, p, B.burn * p.stats.damageMul); if (e.alive) this.onFireHit(p, e, step); }
    }
    if (has(p, 'fHeat')) { if (p.fireBlazeT > 0) { p.fireSelfT = (p.fireSelfT || 0) - B.tick; if (p.fireSelfT <= 0) { p.fireSelfT = 0.5; this.selfBurn(p, 1); } } else this.addHeat(p, FIRE.heat.breath); p.fireHeatIdle = 0; }
    this.log({ type: 'fireBreathTick', n });
  }

  // ---------- A cada quadro, antes dos inimigos andarem ----------
  tick(dt) {
    const c = this.c;
    this.time += dt;
    for (const p of c.players) this.tickPlayer(p, dt);
    const panicP = this.owner('fPanic'), sparkP = this.owner('fSpark'), meltP = this.owner('fMelt'), blueP = this.owner('fBlue'), smokeP = this.owner('fSmoke');
    for (const e of [...c.enemies]) {
      if (!e.alive) { if (e.blueFire) this.endBlue(e); continue; }
      const burning = e.burn > 0;
      if (burning && !e.fireWas) this.onIgnite(e, panicP); // pegou fogo agora
      if (!burning && e.fireWas) this.onBurnOut(e, sparkP); // o fogo apagou
      e.fireWas = burning;
      if (!burning) { e.fireN = 0; e.meltT = 0; continue; }
      e.fireLastDps = e.burnDps;
      if (e.firePanicT > 0) e.firePanicT -= dt;
      if (e.firePanicT > 0 && (e.state === 'chase' || e.state === 'attack') && !(e.frozenT > 0)) this.startPanic(e);
      // Derreter: escudo derrete depois de 3 s queimando.
      if (meltP && e.data.shield && !e.shieldBroken && !e.data.boss) {
        e.meltT = (e.meltT || 0) + dt;
        if (Math.random() < dt * 6) c.vfx.sparks(v3(e.position.x, 0.9, e.position.z), 0xffb040, 1);
        if (e.meltT >= FIRE.melt) {
          const by = this.who(e, 'fMelt');
          c.breakEnemyShield(e, 0, 0, by);
          c.text.add('Derreteu!', e.position, 'burn', 3.6);
          c.vfx.flameCone(v3(e.position.x, 0.4, e.position.z), 0, 0.6, Math.PI, 0xffb040, true);
          this.log({ type: 'fireMelt', enemy: e });
        }
      }
      // Fogo Azul: pula para quem estiver perto.
      if (e.blueFire && blueP) {
        e.blueEvery -= dt;
        if (e.blueGlow) e.blueGlow.material.opacity = 0.65 + 0.25 * Math.sin(this.time * 18);
        if (e.blueEvery <= 0) {
          e.blueEvery = FIRE.blue.every;
          for (const o of c.enemies) {
            if (o === e || !this.foe(o) || !o.targetable || o.blueFire) continue;
            if (Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) > FIRE.blue.r + o.data.radius) continue;
            c.vfx.bolt(v3(e.position.x, 1.2, e.position.z), v3(o.position.x, 1.2, o.position.z), FIRE.blue.color);
            this.ignite(o, e.burnBy || blueP, e.burnDps / FIRE.blue.mul, 3);
            this.makeBlue(o, blueP, e);
            break;
          }
        }
      }
      if (smokeP && !e.data.boss) { e.smokeT = (e.smokeT ?? Math.random()) - dt; if (e.smokeT <= 0) { e.smokeT = FIRE.smoke.every; this.smoke(e.position.x, e.position.z, FIRE.smoke.r); } }
    }
    for (const e of c.enemies) if (e.blueFire && !(e.burn > 0)) this.endBlue(e);
    // Reação em Cadeia: explosões em sequência.
    for (const ch of [...this.chains]) {
      ch.t -= dt;
      if (ch.t > 0) continue;
      this.chains.splice(this.chains.indexOf(ch), 1);
      if (ch.e.alive) { ch.x = ch.e.position.x; ch.z = ch.e.position.z; }
      const at = v3(ch.x, 0, ch.z);
      c.vfx.flameCone(v3(ch.x, 0.9, ch.z), 0, FIRE.chain.r * 0.6, Math.PI, ORANGE, true);
      c.vfx.ring(at, 0xffb04a, FIRE.chain.r);
      audio.play('boom', ch.x, ch.z, { v: 0.5 });
      if (ch.e.targetable) this.hit(ch.p, ch.e, FIRE.chain.dmg, 0, 0);
      const n = this.blast(ch.p, ch.x, ch.z, FIRE.chain.r, FIRE.chain.dmg, ch.e);
      this.log({ type: 'fireChainBoom', n, enemy: ch.e });
    }
    this.tickTorches(dt);
    this.tickFuses(dt);
    this.props.update(dt, (p, e, at) => { // Anel de Chamas
      const dx = e.position.x - at.x, dz = e.position.z - at.z, d = Math.hypot(dx, dz) || 1;
      this.hit(p, e, FIRE.ring.dmg, dx / d, dz / d);
      this.ignite(e, p, 2 * p.stats.damageMul);
      this.log({ type: 'fireRingHit', enemy: e });
    });
  }

  onIgnite(e, panicP) {
    e.fireN = e.fireN || 1;
    if (!panicP || e.data.boss || !this.foe(e) || !has(this.who(e, 'fPanic'), 'fPanic')) return;
    e.firePanicT = Math.min(e.burn, FIRE.panic.burn + 1);
  }
  startPanic(e) {
    e.releaseToken();
    const p = e.burnBy && e.burnBy.position ? e.burnBy : null;
    const away = p ? Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z) : Math.random() * Math.PI * 2;
    e.firePanic = { ang: away + (Math.random() - 0.5) * 1.5, turn: 0.4, scream: 0 };
    e.setState('firePanic');
    if (!e.firePanicSaid) { e.firePanicSaid = true; this.c.text.add('Pânico!', e.position, 'burn', 3.2); }
    this.log({ type: 'firePanic', enemy: e });
  }
  // Esqueleto em pânico encostou em outro (firestates.js).
  panicTouch(e, o) {
    if (o.burn > 0 && !e.blueFire) return;
    const by = e.burnBy;
    this.ignite(o, by, Math.max(2, e.burnDps || 2), FIRE.panic.burn);
    if (e.blueFire && !o.blueFire && this.owner('fBlue')) this.makeBlue(o, by, e);
    this.c.vfx.sparks(v3(o.position.x, 1.1, o.position.z), ORANGE, 8);
    this.log({ type: 'firePanicTouch', enemy: e, target: o });
  }
  onBurnOut(e, sparkP) {
    e.firePanicT = 0;
    if (!sparkP) return;
    const p = this.who(e, 'fSpark');
    if (!p) return;
    let t = null, bd = FIRE.spark.range;
    for (const o of this.c.enemies) {
      if (o === e || !this.foe(o) || !o.targetable) continue;
      const d = Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z);
      if (d < bd) { bd = d; t = o; }
    }
    if (!t) return;
    const dps = Math.max(FIRE.spark.dps * p.stats.damageMul, e.fireLastDps || 0);
    this.props.ball({ from: { x: e.position.x, y: 1.3, z: e.position.z }, target: t, speed: FIRE.spark.speed, color: 0xffc040, size: 0.55,
      onHit: (x, z, hit) => { if (hit) { this.ignite(hit, p, dps, FIRE.spark.burn); this.c.vfx.sparks(v3(x, 1.1, z), 0xffc040, 8); this.log({ type: 'fireSparkHit', enemy: hit }); } } });
    this.log({ type: 'fireSpark', from: e, to: t });
  }

  tickTorches(dt) {
    const p = this.owner('fTorch');
    if (!p || !this.torches.length) return;
    const T = FIRE.torch;
    for (const tc of this.torches) {
      tc.cd -= dt;
      if (tc.cd > 0) continue;
      let t = null, bd = T.range;
      for (const e of this.c.enemies) {
        if (!e.targetable || e.undead) continue;
        const d = Math.hypot(e.position.x - tc.x, e.position.z - tc.z);
        if (d < bd) { bd = d; t = e; }
      }
      if (!t) { tc.cd = 0.25; continue; }
      tc.cd = T.cd;
      this.props.ball({ from: { x: tc.x, y: tc.y, z: tc.z }, target: t, speed: T.speed, color: ORANGE, size: 0.8,
        onHit: (x, z, hit) => {
          this.c.vfx.flameCone(v3(x, 1.0, z), 0, 0.6, Math.PI, ORANGE, false);
          if (hit) { this.hit(p, hit, T.dmg, 0, 0); this.ignite(hit, p, 2 * p.stats.damageMul); this.log({ type: 'fireTorchHit', enemy: hit }); }
        } });
      audio.play('orb', tc.x, tc.z, { v: 0.4 });
      this.log({ type: 'fireTorch', enemy: t });
    }
  }

  tickPlayer(p, dt) {
    const c = this.c, w = W(p), fire = isFire(p), alive = p.state !== 'dead';
    // Superaquecimento: parada esfria; em chamas queima quem encosta.
    if (fire && w.fHeat && alive) {
      p.fireHeatIdle = (p.fireHeatIdle || 0) + dt;
      if (p.fireHeatIdle > FIRE.heat.wait && p.fireHeat > 0) p.fireHeat = Math.max(0, p.fireHeat - FIRE.heat.decay * dt);
      if (p.fireBlazeT > 0) {
        p.fireBlazeT -= dt; p.fireBlazeTick = (p.fireBlazeTick || 0) - dt;
        if (Math.random() < dt * 22) c.vfx.flameCone(v3(p.position.x + (Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 1.2, p.position.z + (Math.random() - 0.5) * 0.5), Math.random() * 6.3, 0.25, 0.6, Math.random() < 0.5 ? 0xff5010 : ORANGE, false);
        if (p.fireBlazeTick <= 0) {
          p.fireBlazeTick = FIRE.heat.tick;
          for (const e of [...c.enemies]) {
            if (!e.targetable || e.undead) continue;
            const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
            if (d > p.hero.radius + e.data.radius + FIRE.heat.r) continue;
            this.hit(p, e, FIRE.heat.dmg, dx / d, dz / d);
            this.ignite(e, p, 2 * p.stats.damageMul);
            this.log({ type: 'fireBlazeHit', enemy: e });
          }
        }
        if (p.fireBlazeT <= 0) { p.fireBlazeT = 0; c.vfx.sparks(v3(p.position.x, 1.2, p.position.z), 0xffb040, 10); }
      }
    }
    // Rastro de Chamas: rolar deixa fogo no chão.
    if (fire && w.fTrail && alive && p.state === 'dodge') {
      const last = p.fireTrailAt;
      if (!last || Math.hypot(p.position.x - last.x, p.position.z - last.z) >= FIRE.trail.gap) {
        p.fireTrailAt = { x: p.position.x, z: p.position.z };
        const T = FIRE.trail;
        this.props.patch(p.position.x, p.position.z, T.r, T.life, 'trail', p, (e) => { this.hit(p, e, T.dmg, 0, 0); this.ignite(e, p, 2 * p.stats.damageMul, T.burn); this.log({ type: 'fireTrailHit', enemy: e }); });
        this.log({ type: 'fireTrail' });
      }
    } else if (p.state !== 'dodge') p.fireTrailAt = null;
    // Voo da Fênix.
    const ph = p.firePhoenix;
    if (ph) {
      if (p.state !== 'dodge' || !alive) this.endPhoenix(p);
      else {
        ph.t += dt;
        if (!ph.m) { ph.m = this.props.phoenix(); audio.play('phoenixCry', p.position.x, p.position.z, { v: 0.5 }); this.log({ type: 'firePhoenix' }); }
        p.model.visible = false;
        this.props.flapPhoenix(ph.m, p, ph.t);
        if (Math.random() < dt * 30) c.vfx.sparks(v3(p.position.x, 1.0, p.position.z), ORANGE, 2);
        for (const e of [...c.enemies]) {
          if (!e.targetable || e.undead || ph.hit.has(e)) continue;
          const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
          if (d > FIRE.phoenix.r + e.data.radius) continue;
          ph.hit.add(e);
          this.hit(p, e, FIRE.phoenix.dmg, dx / d, dz / d);
          this.ignite(e, p, 3 * p.stats.damageMul);
          this.log({ type: 'firePhoenixHit', enemy: e });
        }
      }
    }
    // Filha do Fogo: pisar no fogo cura.
    if (fire && w.fChild && alive && this.props.inFire(p.position.x, p.position.z)) {
      p.fireChildT = (p.fireChildT || 0) - dt;
      if (p.fireChildT <= 0) {
        p.fireChildT = FIRE.child.tick;
        const got = p.heal(FIRE.child.heal);
        if (got) { c.text.add(`+${got}`, p.position, 'heal small'); this.log({ type: 'fireChildHeal', heal: got }); }
      }
    }
    // Salamandra.
    let s = this.props.salas.find((o) => o.p === p);
    if (fire && w.fSala && alive && !s) s = this.props.salamander(p);
    if (s && (!fire || !w.fSala || !alive)) { this.props.dropSalamander(s); s = null; }
    if (s) {
      this.props.moveSalamander(s, dt);
      s.cd -= dt;
      if (s.cd <= 0) {
        let t = null, bd = FIRE.sala.range;
        for (const e of c.enemies) {
          if (!e.targetable || e.undead || !(e.burn > 0)) continue;
          const d = Math.hypot(e.position.x - s.g.position.x, e.position.z - s.g.position.z);
          if (d < bd) { bd = d; t = e; }
        }
        s.cd = t ? FIRE.sala.every : 0.2;
        if (t) {
          s.facing = Math.atan2(t.position.x - s.g.position.x, t.position.z - s.g.position.z); s.spitT = 0.3;
          this.props.ball({ from: this.props.headPos(s), target: t, speed: FIRE.sala.speed, color: 0xff6a1a, size: 0.6,
            onHit: (x, z, hit) => { if (hit) { this.hit(p, hit, FIRE.sala.dmg, 0, 0); this.ignite(hit, p, 2 * p.stats.damageMul); this.log({ type: 'fireSalaHit', enemy: hit }); } } });
          audio.play('orb', s.g.position.x, s.g.position.z, { v: 0.35 });
          this.log({ type: 'fireSala', enemy: t });
        }
      }
    }
    this.drawBars(p, fire && alive);
  }
  endPhoenix(p) {
    const ph = p.firePhoenix;
    p.firePhoenix = null;
    if (p.model) p.model.visible = true;
    if (ph && ph.m) { this.c.vfx.sparks(v3(p.position.x, 1.0, p.position.z), 0xffd070, 14); this.props.drop(ph.m); }
  }

  // Barra do Superaquecimento (arco sobre a cabeça) e brasas das Cinzas (girando na cintura).
  drawBars(p, on) {
    const w = W(p);
    let f = this.fx.get(p);
    const want = on && (w.fHeat || w.fAsh);
    if (!want) { if (f) { this.c.scene.remove(f.g); f.g.traverse((m) => m.material && m.material.dispose()); this.fx.delete(p); } return; }
    if (!f) {
      const g = new THREE.Group(), heat = [], ash = [];
      for (let i = 0; i < FIRE.heat.max; i++) { const s = glow(0xffb040, 0.42, 0); const a = -1.2 + (i / (FIRE.heat.max - 1)) * 2.4; s.position.set(Math.sin(a) * 1.0, 2.6 + Math.cos(a) * 0.35 - 0.35, 0); g.add(s); heat.push(s); }
      const aura = glow(0xff5010, 3.2, 0); aura.position.y = 1.0; g.add(aura);
      for (let i = 0; i < FIRE.ash.n; i++) { const s = glow(0xff9a30, 0.3, 0); g.add(s); ash.push(s); }
      this.c.scene.add(g);
      f = { g, heat, ash, a: 0, aura };
      this.fx.set(p, f);
    }
    f.g.position.set(p.position.x, 0, p.position.z);
    const cam = this.c.cam && this.c.cam.camera;
    if (cam) f.g.quaternion.copy(cam.quaternion); else f.g.rotation.set(0, 0, 0);
    const lit = w.fHeat ? (p.fireBlazeT > 0 ? FIRE.heat.max : Math.floor(p.fireHeat || 0)) : 0;
    f.heat.forEach((s, i) => {
      s.material.opacity = w.fHeat ? (i < lit ? 0.95 : 0.18) : 0;
      s.material.color.setHex(p.fireBlazeT > 0 ? (Math.sin(this.time * 20 + i) > 0 ? 0xff3010 : 0xffd040) : i < FIRE.heat.max * 0.5 ? 0xffd040 : i < FIRE.heat.max * 0.8 ? 0xff8a20 : 0xff3010);
    });
    f.aura.material.opacity = p.fireBlazeT > 0 ? 0.55 + 0.2 * Math.sin(this.time * 25) : 0; // em chamas: brilho em volta
    f.a += 0.03;
    const n = w.fAsh ? Math.min(FIRE.ash.n, p.fireAsh || 0) : 0, full = n >= FIRE.ash.n;
    f.ash.forEach((s, i) => {
      const a = f.a * (full ? 3 : 1) + (i / FIRE.ash.n) * Math.PI * 2;
      s.position.set(Math.sin(a) * 0.9, 1.0 + Math.sin(a * 2 + this.time) * 0.08, Math.cos(a) * 0.9);
      s.material.opacity = i < n ? (full ? 0.75 + 0.25 * Math.sin(this.time * 12 + i) : 0.85) : 0;
    });
    // as brasas giram em volta da Maga (não viram com a câmera)
    if (cam) f.ash.forEach((s) => { s.position.applyQuaternion(f.g.quaternion.clone().invert()); });
  }

  dropFor(p) {
    const f = this.fx.get(p);
    if (f) { this.c.scene.remove(f.g); this.fx.delete(p); }
    const s = this.props.salas.find((o) => o.p === p);
    if (s) this.props.dropSalamander(s);
    if (p.firePhoenix) this.endPhoenix(p);
  }

  clear() {
    this.props.clear();
    this.chains = [];
    for (const e of this.c.enemies) if (e.blueFire) this.endBlue(e);
    for (const p of this.c.players) { if (p.firePhoenix) this.endPhoenix(p); p.fireBlazeT = 0; p.fireHeat = 0; p.fireTrailAt = null; }
  }
}
