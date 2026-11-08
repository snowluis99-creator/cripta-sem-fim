// Bênçãos novas das Kunais do Ladino (lista do dono, 07/11/2026): as regras. O visual está em kunaiprops.js.
// O RogueKit (rogue.js) cria o kit (rogue.k2) e chama os ganchos; player.js chama kunaiStartDodge / kunaiReset.
// Estados novos dos itens do RogueKit: 'back' (Bumerangue voltando), 'pull' (Fio de Aço puxando), 'stuck' (Sanguessuga).
import * as THREE from 'three';
import { audio } from './audio.js';
import { sealTag, caltrops, Links, ghostKunai, goldGlow, bloodGlow, pinShadow, fireworks, dispose } from './kunaiprops.js';

export const KUN = {
  bomb: { t: 2, r: 2.6, dmg: 12, perStack: 2 },        // Selo Explosivo
  wire: { len: 14, dmg: 6, cd: 0.5, hitR: 0.25 },       // Armadilha de Fio
  caltrop: { r: 1.1, dmg: 3, cd: 0.5, slow: 1.5 },      // Estrepes
  pin: { r: 2.2, t: 1.5, boss: 0.5 },                   // Pregar a Sombra
  magnet: 2.6,                                          // Kunai Ímã (velocidade)
  flash: { iframes: 0.35 },                             // Relâmpago Amarelo
  swap: { window: 1.5, daze: 0.8, iframes: 0.4 },       // Troca de Lugar
  boom: { range: 10, speed: 26, turn: 7, life: 3 },     // Bumerangue
  steel: { hold: 0.35, speed: 30 },                     // Fio de Aço
  fan: { hold: 0.35, spread: 14 },                      // Leque (graus entre kunais)
  bounce: 16,                                           // Quique na Parede (alcance para achar o inimigo)
  chain: { len: 14, dmg: 4, cd: 0.3, hitR: 0.3 },       // Corrente Viva
  juggle: 5,                                            // Malabarista
  spark: { r: 2.4, dmg: 6, stun: 0.3 },                 // Faísca na Pegada
  heal: 3,                                              // Pegada Heroica
  ghost: { range: 16, speed: 20, life: 2.2 },           // Kunai Fantasma
  leech: { cd: 1, dmg: 2, heal: 1, pickR: 1.4 },        // Sanguessuga
  empty: { mul: 2, far: 6, lost: 1.5 },                 // Mãos Vazias
  finale: { r: 3, dmg: 20, n: 6, ghostDmg: 8 },         // Grand Finale
};
const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const isKun = (p) => !!(p && p.heroId === 'rogue' && p.hero && p.hero.ammo && p.hero.ammo.kind === 'kunai');
const has = (p, k) => isKun(p) && !!W(p)[k];
const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1e-6;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
};
let K = null;

// Rolamento: Relâmpago Amarelo / Troca de Lugar (true = virou teleporte) e Mãos Vazias (rola o dobro).
export function kunaiStartDodge(p) {
  p.kRollMul = 1;
  if (!K || !isKun(p)) return false;
  if (has(p, 'kFlash') && K.flash(p)) return true;
  if (has(p, 'kSwap') && K.swap(p)) return true;
  if (has(p, 'kEmpty') && !(p.ammo && p.ammo.length)) K.emptyRoll(p);
  return false;
}
export function kunaiReset(p) {
  p.kRollMul = 1; p.kJug = 0; p.kJugReady = false; p.kSwapT = 0; p.kSwapE = null; p.kHoldT = 0;
  if (K) K.dropFor(p);
}

export class KunaiKit {
  constructor(rk) {
    this.rk = rk; K = this;
    this.scene = rk.scene;
    this.ghosts = [];
    this.wires = new Links(this.scene, 0xdff4ff, 0.05, 0.45);
    this.chains = new Links(this.scene, 0xffc24a, 0.09, 1.2);
    this.hitCd = new Map(); // `${linha}:${inimigo}` -> tempo
  }
  get c() { return this.rk.combat; }
  log(o) { if (this.c.log) this.c.log(o); }
  dmg(p, n) { return Math.max(1, Math.round(n * ((p && p.stats && p.stats.damageMul) || 1))); }
  kunaiDmg(p, stack) { return this.rk.kunaiDamage(p, stack); }
  foes() { return this.c.enemies.filter((e) => e.targetable && !e.undead && !(e.data && e.data.phantom)); }
  near(x, z, r, skip = null) {
    let best = null, bd = r;
    for (const e of this.foes()) {
      if (skip && skip.has && skip.has(e)) continue;
      const d = Math.hypot(e.position.x - x, e.position.z - z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  mine(p, states) { return this.rk.items.filter((it) => it.owner === p && it.kind === 'kunai' && states.includes(it.state)); }
  hitOnce(key, cd) {
    const now = this.time || 0, t = this.hitCd.get(key);
    if (t !== undefined && now - t < cd) return false;
    this.hitCd.set(key, now);
    return true;
  }
  ui(e) { return e.uid || (e.uid = Math.random().toString(36).slice(2)); }

  // ---------- Arremesso (RogueKit.fire): Malabarista ----------
  onFire(p, it) {
    if (p.kJugReady) {
      p.kJugReady = false;
      it.pierce = 99; it.jug = true;
      const s = goldGlow(); it.g.add(s);
      this.c.text.add('Atravessa tudo!', p.position, 'crit', 3.2);
      this.log({ type: 'kJugShot' });
    }
    if (has(p, 'kBoom')) it.flyD = 0;
  }

  // ---------- Acertou um inimigo (RogueKit, kunai voando) ----------
  onHit(it, e, r) {
    const p = it.owner;
    if (r !== 'hit' && r !== 'kill') return;
    if (has(p, 'kSwap') && e.alive && !e.data.boss) { p.kSwapT = KUN.swap.window; p.kSwapE = e; }
    // Grand Finale: chegou na corrente máxima -> fogos e 6 kunais fantasmas; a corrente recomeça.
    if (has(p, 'kFinale') && it.stack >= this.rk.maxStack(p)) this.finale(it, e);
  }
  // Sanguessuga: em vez de voar, a kunai fica cravada (1 por vez).
  wantStick(it, e, r) {
    const p = it.owner;
    return has(p, 'kLeech') && r === 'hit' && e.alive && !e.data.boss && !this.mine(p, ['stuck']).length;
  }
  stick(it, e) {
    it.state = 'stuck'; it.e = e; it.t = 0; it.tick = 0;
    it.g.userData.inner.rotation.set(0.5, 0, 0);
    it.blood = bloodGlow(); it.g.add(it.blood);
    this.c.text.add('Cravada!', e.position, 'crit', 3);
    this.log({ type: 'kLeechStick', enemy: e });
  }

  // ---------- Kunai caiu no chão (RogueKit.toGround) ----------
  onGround(it, why) {
    const p = it.owner;
    if (!isKun(p)) return;
    if (p.kJug) { p.kJug = 0; this.log({ type: 'kJugReset' }); } // Malabarista: deixou cair, recomeça
    if (has(p, 'kBomb')) { it.bombT = KUN.bomb.t; it.seal = sealTag(); it.g.add(it.seal); }
    if (has(p, 'kCaltrop')) { it.calt = caltrops(); it.g.add(it.calt); }
    if (has(p, 'kPin')) this.pin(it);
    if (has(p, 'kGhost') && why !== 'quiet') {
      const e = this.near(it.x, it.z, KUN.ghost.range);
      if (e) this.ghost(p, it.x, it.z, e, this.kunaiDmg(p, it.stack), 0x6fd8ff);
    }
  }

  pin(it) {
    const e = this.near(it.x, it.z, KUN.pin.r);
    if (!e) return;
    const t = e.data.boss ? KUN.pin.boss : KUN.pin.t;
    if (!e.daze(t)) return;
    e.vel && e.vel.set(0, 0, 0);
    const s = pinShadow();
    s.position.set(e.position.x, 0, e.position.z);
    this.c.vfx.add(s, t, (o, k) => { o.userData.ring.material.opacity = 0.7 * (1 - k * k); o.children[0].material.opacity = 0.75 * (1 - k * k); });
    this.c.text.add('Preso!', e.position, 'crit', 3.1);
    audio.play('block', e.position.x, e.position.z, { v: 0.5 });
    this.log({ type: 'kPin', enemy: e, t });
  }

  // ---------- Pegou no ar (RogueKit.catchKunai e Bumerangue) ----------
  onCatch(p, stack) {
    if (!isKun(p)) return;
    const w = W(p);
    if (w.kJuggle) {
      p.kJug = (p.kJug || 0) + 1;
      if (p.kJug >= KUN.juggle) { p.kJug = 0; p.kJugReady = true; this.c.text.add('Malabarista!', p.position, 'crit', 3.6); this.c.vfx.sparks(v3(p.position.x, 1.6, p.position.z), 0xffd24a, 16); this.log({ type: 'kJugReady' }); }
    }
    if (w.kSpark) {
      const S = KUN.spark;
      this.c.vfx.ring(p.position, 0x8fd8ff, S.r);
      this.c.vfx.sparks(v3(p.position.x, 1, p.position.z), 0xbfe6ff, 12);
      audio.play('zap', p.position.x, p.position.z, { v: 0.6 });
      let n = 0;
      for (const e of this.foes()) {
        const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz);
        if (d > S.r + e.data.radius) continue;
        this.c.bonusDamage(e, this.dmg(p, S.dmg), dx / (d || 1), dz / (d || 1), 'dmg', p);
        if (e.alive && !e.data.boss) e.daze(S.stun);
        n++;
      }
      this.log({ type: 'kSpark', n });
    }
    if (w.kHeal) { const got = p.heal(KUN.heal); if (got) this.c.text.add(`+${got}`, p.position, 'heal'); this.log({ type: 'kHeal', got }); }
    if (w.kPass) { // Passar a Corrente: as kunais na mão ficam com a corrente da que foi pega
      for (const a of p.ammo) a.stack = Math.max(a.stack, stack);
      this.log({ type: 'kPass', stack });
    }
  }

  // ---------- Itens nos estados novos ----------
  // Devolve true se tratou o item (estados 'back', 'pull', 'stuck').
  updateSpecial(it, i, dt) {
    if (it.state === 'back') { this.backTick(it, i, dt); return true; }
    if (it.state === 'pull') { this.pullTick(it, i, dt); return true; }
    if (it.state === 'stuck') { this.stuckTick(it, i, dt); return true; }
    return false;
  }

  // Bumerangue: no fim do voo (ou na parede) a kunai faz a curva e volta, cortando quem estiver no caminho.
  startBack(it) {
    it.state = 'back'; it.life = KUN.boom.life; it.hitSet = new Set(); it.backT = 0;
    this.log({ type: 'kBoomBack' });
  }
  backTick(it, i, dt) {
    const p = it.owner, B = KUN.boom;
    it.life -= dt; it.backT += dt;
    if (it.life <= 0 || p.state === 'dead') { this.rk.toGround(it, it.x, it.z); return; }
    const want = Math.atan2(p.position.x - it.x, p.position.z - it.z);
    let a = Math.atan2(it.vx, it.vz);
    const d = Math.atan2(Math.sin(want - a), Math.cos(want - a));
    a += Math.sign(d) * Math.min(Math.abs(d), B.turn * dt * (1 + it.backT * 2));
    it.vx = Math.sin(a) * B.speed; it.vz = Math.cos(a) * B.speed; it.a = a;
    if (this.sweep(it, dt, B.speed)) return;
    it.g.rotation.y = a;
    if (Math.hypot(p.position.x - it.x, p.position.z - it.z) < 1.1) { this.rk.catchKunai(it, this.rk.items.indexOf(it), p); }
  }
  // Move o item reto pelo vx/vz e acerta cada inimigo uma vez (sem parar). true = item saiu da lista.
  sweep(it, dt) {
    const sp = Math.hypot(it.vx, it.vz) || 1, nx = it.vx / sp, nz = it.vz / sp;
    let left = sp * dt;
    while (left > 0) {
      const st = Math.min(0.3, left); left -= st;
      it.x += nx * st; it.z += nz * st;
      this.c.smashProjectiles(it.owner, it.x, it.z, 0.55);
      for (const e of this.foes()) {
        if (it.hitSet.has(e) || Math.hypot(e.position.x - it.x, e.position.z - it.z) > e.data.radius + 0.35) continue;
        it.hitSet.add(e);
        const r = this.rk.hitEnemy(it, e);
        if (r === 'hit' || r === 'kill') { it.stack = Math.min(this.rk.maxStack(it.owner), it.stack + 1); this.onHit(it, e, r); }
      }
    }
    it.y += (1.2 - it.y) * Math.min(1, dt * 8);
    it.g.position.set(it.x, it.y, it.z);
    it.g.userData.inner.rotation.x += dt * 22;
    return false;
  }

  // Fio de Aço: segurar o ataque puxa de volta todas as kunais que estão fora.
  pullAll(p) {
    const list = this.mine(p, ['ground', 'pop', 'fly', 'stuck']);
    for (const it of list) {
      if (it.mark) { this.scene.remove(it.mark); it.mark = null; }
      this.clearGroundFx(it);
      it.state = 'pull'; it.hitSet = new Set(); it.life = 3;
      if (it.e) { it.hitSet.add(it.e); it.e = null; }
      if (it.blood) { it.g.remove(it.blood); it.blood = null; }
      it.y = Math.max(it.y || 0.2, 0.6);
      it.g.children[1].material.opacity = 0.55;
    }
    if (list.length) {
      this.c.text.add('Puxou!', p.position, 'crit', 3);
      audio.play('swing', p.position.x, p.position.z, { v: 1.2 });
      this.log({ type: 'kSteel', n: list.length });
    }
    return list.length;
  }
  pullTick(it, i, dt) {
    const p = it.owner;
    it.life -= dt;
    const dx = p.position.x - it.x, dz = p.position.z - it.z, d = Math.hypot(dx, dz);
    if (d < 1 || it.life <= 0 || p.state === 'dead') { this.rk.pickUp(it, this.rk.items.indexOf(it), p, true); return; }
    it.vx = dx / d * KUN.steel.speed; it.vz = dz / d * KUN.steel.speed; it.a = Math.atan2(it.vx, it.vz) + Math.PI;
    it.g.rotation.y = it.a;
    this.sweep(it, Math.min(dt, d / KUN.steel.speed));
    // fio prateado da kunai até a mão
    this.wireToHand.push(it);
  }

  // Sanguessuga: cravada no inimigo, suga a vida para o Ladino até ser pega de volta (ande perto) ou ele morrer.
  stuckTick(it, i, dt) {
    const p = it.owner, e = it.e, L = KUN.leech;
    if (!e || !e.alive) { if (it.blood) { it.g.remove(it.blood); it.blood = null; } this.rk.toGround(it, it.x, it.z, false, 'quiet'); return; }
    if (it.blood) it.blood.material.opacity = 0.5 + 0.4 * Math.sin(this.time * 6);
    it.x = e.position.x; it.z = e.position.z; it.y = 1.3 * (e.group.scale.y || 1);
    it.g.position.set(it.x, it.y, it.z);
    it.tick += dt;
    if (it.tick >= L.cd) {
      it.tick -= L.cd;
      this.c.bonusDamage(e, L.dmg, 0, 0, 'poison', p, true);
      const got = p.heal(L.heal);
      if (got) this.c.text.add(`+${got}`, p.position, 'heal');
      this.c.vfx.beamLine(v3(it.x, it.y, it.z), v3(p.position.x, 1.2, p.position.z), 0xff3050, 0.25);
      this.log({ type: 'kLeech', got });
    }
    if (p.state !== 'dead' && Math.hypot(p.position.x - it.x, p.position.z - it.z) <= e.data.radius + L.pickR) this.rk.pickUp(it, i, p);
  }

  // ---------- No chão, a cada quadro (antes do dono pegar). true = item saiu da lista. ----------
  groundTick(it, i, dt) {
    const p = it.owner;
    if (it.kind !== 'kunai' || !isKun(p)) return false;
    const w = W(p);
    if (it.bombT !== undefined) {
      it.bombT -= dt;
      const s = it.seal.userData, k = Math.max(0, it.bombT / KUN.bomb.t);
      s.paper.position.y = 0.85 + 0.08 * Math.sin(this.time * 5);
      const blink = 0.5 + 0.5 * Math.sin(performance.now() / (40 + 120 * k));
      s.ring.material.opacity = 0.25 + 0.6 * blink; s.glow.material.opacity = 0.3 + 0.7 * blink;
      s.ring.scale.setScalar(1 + (1 - k) * 0.4);
      if (it.bombT <= 0) { this.explode(it, i); return true; }
    }
    if (it.calt) {
      const C = KUN.caltrop;
      for (const e of this.foes()) {
        if (Math.hypot(e.position.x - it.x, e.position.z - it.z) > C.r + e.data.radius * 0.5) continue;
        e.slow = Math.max(e.slow || 0, C.slow);
        if (this.hitOnce(`c${it.id}:${this.ui(e)}`, C.cd)) { this.c.bonusDamage(e, this.dmg(p, C.dmg), 0, 0, 'dmg', p, true); this.log({ type: 'kCaltrop', enemy: e }); }
      }
    }
    if (w.kMagnet && p.state !== 'dead') {
      const dx = p.position.x - it.x, dz = p.position.z - it.z, d = Math.hypot(dx, dz);
      if (d > 0.3) {
        const st = Math.min(d, KUN.magnet * dt);
        const v = v3(it.x + dx / d * st, 0, it.z + dz / d * st);
        if (this.c.world) this.c.world.resolveCircle(v, 0.45);
        it.x = v.x; it.z = v.z;
        it.g.position.x = v.x; it.g.position.z = v.z;
        if (it.mark) { it.mark.position.x = v.x; it.mark.position.z = v.z; }
      }
    }
    return false;
  }
  clearGroundFx(it) {
    if (it.seal) { it.g.remove(it.seal); dispose(it.seal); it.seal = null; }
    if (it.calt) { it.g.remove(it.calt); dispose(it.calt); it.calt = null; }
    delete it.bombT;
  }

  // Selo Explosivo: explode e a kunai volta para a mão (corrente zerada).
  explode(it, i) {
    const p = it.owner, B = KUN.bomb, c = this.c;
    const at = v3(it.x, 0, it.z);
    c.vfx.heavyImpact(at, 1.2);
    c.vfx.sparks(v3(at.x, 0.8, at.z), 0xff6a2a, 18);
    c.vfx.ring(at, 0xff4a2a, B.r);
    audio.play('boom', at.x, at.z, { v: 0.8 });
    c.shakeFor && c.shakeFor(p, 0.18);
    const dmg = this.dmg(p, B.dmg + B.perStack * it.stack);
    let n = 0;
    for (const e of this.foes()) {
      const dx = e.position.x - at.x, dz = e.position.z - at.z, d = Math.hypot(dx, dz);
      if (d > B.r + e.data.radius) continue;
      c.bonusDamage(e, dmg, dx / (d || 1), dz / (d || 1), 'burn', p);
      n++;
    }
    c.props && c.props.hitAt && c.props.hitAt(at.x, at.z, p);
    this.clearGroundFx(it);
    this.rk.drop(i);
    p.ammo.push({ stack: 0 });
    c.text.add('Bum! +1 kunai', p.position, 'miss', 2.8);
    this.log({ type: 'kBomb', n, dmg });
  }

  // ---------- Kunais fantasmas (Kunai Fantasma e Grand Finale) ----------
  ghost(p, x, z, target, dmg, color, ang = null) {
    const g = ghostKunai(color);
    g.position.set(x, 1.2, z);
    this.scene.add(g);
    const a = ang === null ? Math.atan2(target.position.x - x, target.position.z - z) : ang;
    this.ghosts.push({ p, g, x, z, a, target, dmg, life: KUN.ghost.life, t: 0 });
    this.log({ type: 'kGhost' });
  }
  ghostTick(dt) {
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const h = this.ghosts[i];
      h.life -= dt; h.t += dt;
      if (!h.target || !h.target.targetable) h.target = this.near(h.x, h.z, KUN.ghost.range * 1.5);
      if (h.life <= 0 || !h.target) { this.rmGhost(i); continue; }
      const want = Math.atan2(h.target.position.x - h.x, h.target.position.z - h.z);
      const d = Math.atan2(Math.sin(want - h.a), Math.cos(want - h.a));
      h.a += Math.sign(d) * Math.min(Math.abs(d), dt * (h.t < 0.25 ? 3 : 12));
      const sp = KUN.ghost.speed * (h.t < 0.25 ? 0.5 : 1);
      h.x += Math.sin(h.a) * sp * dt; h.z += Math.cos(h.a) * sp * dt;
      h.g.position.set(h.x, 1.2, h.z); h.g.rotation.y = h.a;
      if (Math.hypot(h.target.position.x - h.x, h.target.position.z - h.z) < h.target.data.radius + 0.35) {
        const e = h.target;
        this.c.bonusDamage(e, h.dmg, Math.sin(h.a), Math.cos(h.a), 'dmg', h.p);
        this.c.vfx.sparks(v3(h.x, 1.2, h.z), 0x6fd8ff, 6);
        this.log({ type: 'kGhostHit', enemy: e, dmg: h.dmg });
        this.rmGhost(i);
      }
    }
  }
  rmGhost(i) { const h = this.ghosts[i]; this.scene.remove(h.g); dispose(h.g); this.ghosts.splice(i, 1); }

  // Grand Finale: fogos + 6 kunais fantasmas pela sala; a corrente da kunai recomeça.
  finale(it, e) {
    const p = it.owner, F = KUN.finale, c = this.c;
    fireworks(c.vfx, e.position.x, e.position.z);
    c.vfx.ring(e.position, 0xffd24a, F.r);
    audio.play('boom', e.position.x, e.position.z, { v: 0.9 });
    const dmg = this.dmg(p, F.dmg);
    for (const o of this.foes()) {
      const dx = o.position.x - e.position.x, dz = o.position.z - e.position.z, d = Math.hypot(dx, dz);
      if (d > F.r + o.data.radius) continue;
      c.bonusDamage(o, dmg, dx / (d || 1), dz / (d || 1), 'burn', p);
    }
    const foes = this.foes();
    for (let k = 0; k < F.n; k++) {
      const t = foes.length ? foes[k % foes.length] : null;
      if (t) this.ghost(p, e.position.x, e.position.z, t, this.dmg(p, F.ghostDmg), [0xff4a6a, 0xffd24a, 0x6fe3ff, 0x9aff6a, 0xd06aff, 0xffffff][k], k / F.n * Math.PI * 2);
    }
    it.stack = 0;
    c.text.add('Grand Finale!', e.position, 'crit', 4);
    this.log({ type: 'kFinale' });
  }

  // ---------- Rolamento ----------
  flash(p) {
    const list = this.mine(p, ['ground']);
    if (!list.length) return false;
    let best = null, bd = Infinity;
    for (const it of list) { const d = Math.hypot(it.x - p.position.x, it.z - p.position.z); if (d < bd) { bd = d; best = it; } }
    const a = v3(p.position.x, 1.2, p.position.z);
    p.position.x = best.x; p.position.z = best.z;
    if (this.c.world) this.c.world.resolveCircle(p.position, p.hero.radius);
    this.c.vfx.lightning(a, v3(p.position.x, 1.2, p.position.z), 0xffe04a, 0.3);
    this.c.vfx.sparks(v3(p.position.x, 1, p.position.z), 0xffe04a, 14);
    this.teleported(p);
    p.iframes = Math.max(p.iframes || 0, KUN.flash.iframes);
    this.rk.pickUp(best, this.rk.items.indexOf(best), p);
    this.c.text.add('Relâmpago!', p.position, 'crit', 3.3);
    this.log({ type: 'kFlash', d: bd });
    return true;
  }
  swap(p) {
    const e = p.kSwapE;
    if (!(p.kSwapT > 0) || !e || !e.targetable || e.data.boss) return false;
    const S = KUN.swap;
    const px = p.position.x, pz = p.position.z;
    this.c.vfx.puff(v3(px, 0.2, pz)); this.c.vfx.puff(v3(e.position.x, 0.2, e.position.z));
    p.position.x = e.position.x; p.position.z = e.position.z;
    e.position.x = px; e.position.z = pz;
    if (this.c.world) { this.c.world.resolveCircle(p.position, p.hero.radius); this.c.world.resolveCircle(e.position, e.data.radius); }
    e.group && e.group.position.copy(e.position);
    e.daze(S.daze);
    p.facing = Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z); p.group.rotation.y = p.facing;
    this.teleported(p);
    p.iframes = Math.max(p.iframes || 0, S.iframes);
    p.kSwapT = 0; p.kSwapE = null;
    this.c.text.add('Trocou!', p.position, 'crit', 3.2);
    this.log({ type: 'kSwap', enemy: e });
    return true;
  }
  teleported(p) {
    p.group.position.copy(p.position);
    p.combo = 0; p.queued = false;
    p.setState('idle'); p.anim.play(p.hero.anims.idle, { fade: 0.1 });
    p.dodgeCooldown = p.hero.dodge.cooldown;
    audio.play('dodge', p.position.x, p.position.z);
  }
  emptyRoll(p) {
    const E = KUN.empty;
    p.kRollMul = E.mul;
    let n = 0;
    const r2 = this.c.rogue2;
    if (r2) for (const e of this.c.enemies) {
      if (Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) > E.far && r2.lose(e, E.lost, p.position)) n++;
    }
    this.c.vfx.smoke(v3(p.position.x, 0.4, p.position.z), 0x8a8f9c, 8);
    this.log({ type: 'kEmpty', n });
  }

  // ---------- Leque ----------
  fan(p) {
    const n = p.ammo.length;
    if (!n) return 0;
    const step = p.hero.combo[0], sp = KUN.fan.spread * Math.PI / 180;
    for (let k = 0; k < n; k++) this.rk.fire(p, step, p.facing + (k - (n - 1) / 2) * sp);
    this.c.text.add('Leque!', p.position, 'crit', 3);
    this.log({ type: 'kFan', n });
    return n;
  }

  // ---------- Segurar o ataque (Leque, Fio de Aço) ----------
  holdTick(p, dt) {
    const held = p.state !== 'dead' && p.state !== 'dodge' && p.ctl && p.ctl.attackHeld && p.ctl.attackHeld();
    if (!held) { p.kHoldT = 0; p.kFanDone = p.kPullDone = false; return; }
    p.kHoldT = (p.kHoldT || 0) + dt;
    const w = W(p);
    if (w.kFan && !p.kFanDone && p.kHoldT >= KUN.fan.hold && p.ammo.length) { p.kFanDone = true; this.fan(p); return; }
    if (w.kSteel && !p.kPullDone && p.kHoldT >= KUN.steel.hold + (p.kFanDone ? 0.4 : 0)) {
      if (this.pullAll(p)) p.kPullDone = true;
    }
  }

  // ---------- Ligações: Armadilha de Fio (no chão) e Corrente Viva (no ar) ----------
  linkTick(list, L, links, tag, p) {
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
      const A = list[a], B = list[b];
      if (Math.hypot(A.x - B.x, A.z - B.z) > L.len) continue;
      links.add(A.x, A.z, B.x, B.z, tag === 'w' ? 0.45 : Math.max(0.5, A.y), tag === 'w' ? 0.45 : Math.max(0.5, B.y));
      for (const e of this.foes()) {
        if (segDist(e.position.x, e.position.z, A.x, A.z, B.x, B.z) > e.data.radius + L.hitR) continue;
        if (!this.hitOnce(`${tag}${A.id}-${B.id}:${this.ui(e)}`, L.cd)) continue;
        this.c.bonusDamage(e, this.dmg(p, L.dmg), 0, 0, 'dmg', p, true);
        this.c.vfx.sparks(v3(e.position.x, tag === 'w' ? 0.5 : 1.2, e.position.z), tag === 'w' ? 0xdff4ff : 0xffc24a, 4);
        this.log({ type: tag === 'w' ? 'kWire' : 'kChain', enemy: e });
      }
    }
  }

  // ---------- A cada quadro (RogueKit.update) ----------
  tick(dt) {
    this.time = (this.time || 0) + dt;
    this.wires.begin(); this.chains.begin();
    this.wireToHand = [];
    for (const p of this.c.players) {
      if (!isKun(p)) continue;
      p.kSwapT = Math.max(0, (p.kSwapT || 0) - dt);
      this.holdTick(p, dt);
      const w = W(p);
      if (w.kWire) this.linkTick(this.mine(p, ['ground']), KUN.wire, this.wires, 'w', p);
      if (w.kChain) this.linkTick(this.mine(p, ['fly', 'pop', 'back', 'pull']), KUN.chain, this.chains, 'c', p);
    }
    this.ghostTick(dt);
    if (this.hitCd.size > 400) this.hitCd.clear();
  }
  // Depois de mexer os itens: fio fino da kunai puxada até a mão (Fio de Aço) e esconde as ligações que sobraram.
  afterItems() {
    for (const it of this.wireToHand || []) if (it.owner) this.wires.add(it.x, it.z, it.owner.position.x, it.owner.position.z, it.y, 1.2);
    this.wireToHand = [];
    this.wires.end(); this.chains.end();
  }

  dropFor(p) { for (let i = this.ghosts.length - 1; i >= 0; i--) if (this.ghosts[i].p === p) this.rmGhost(i); }
  clear() {
    for (let i = this.ghosts.length - 1; i >= 0; i--) this.rmGhost(i);
    this.wires.begin(); this.wires.end(); this.chains.begin(); this.chains.end();
    this.hitCd.clear();
  }
}
