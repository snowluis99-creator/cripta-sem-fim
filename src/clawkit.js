// Bênçãos novas das Garras do Ladino (lista do dono, 07/11/2026): as regras. O visual está em clawprops.js.
// Sem import de combat.js: o combate cria o kit (combat.claw2) e chama os ganchos; player.js chama
// clawPress / clawAirTick / clawLand / clawBeast / clawLeave / clawReset.
// Garras: combo de 5; o 5º golpe (step.heavy) soma sangramento. "Combo completo" = o 5º golpe.
import * as THREE from 'three';
import { audio } from './audio.js';
import { knockDown, fear } from './axekit3.js';
import { bearTrap, setTrapOpen } from './boltprops.js';
import { addOutline, removeOutline, ghostClaw, clawMarks, bloodPuddle, ghostWolf, animWolf, fadeWolf, slashFx, whetGlow, beastGlow, dispose, OUTLINE_MAT } from './clawprops.js';
import { setFlash } from './characters.js';

export const CLAW = {
  lion: { cd: 10, win: 0.12, w: 1.4, dmg: 12, cross: 0.24, gone: 0.1, land: 0.4 },  // Investida do Leão: ataque + rolar juntos
  roar: { r: 4.5, t: 1.5 },                                      // Rugido
  mount: { time: 3, every: 0.2, dmg: 3, cd: 6, bigR: 0.9, throw: 7 }, // Montaria
  revenge: { cd: 1.2, safe: 1.0, vanish: 0.12, strike: 0.14, end: 0.42, bossMul: 3 }, // Revide: some, aparece atrás e executa
  isolated: { r: 4 },                                            // Presa Isolada: ninguém até 4
  scent: { range: 14, cone: 40, mul: 1.35 },                     // Faro de Sangue
  agony: { every: 3 },                                           // Morte Dolorosa: o sangramento ativa sozinho a cada 3 s
  spread: { r: 3 },                                              // Contágio de Sangue
  burst: { at: 5, r: 3.5, add: 2, per: 3 },                      // Ruptura: dano = 3 por sangramento
  puddle: { every: 1, life: 4, r: 0.85, cd: 4, down: 1.5, boss: 0.6, max: 14 }, // Poça de Sangue: escorrega (animação), cai e fica 1,5 s no chão (08/11: era 3 s)
  marks: { len: 3.4, gap: 0.5, w: 0.26, life: 3, tick: 0.5, dmg: 4 }, // Marcas de Garra
  wind: { n: 3, spread: 0.26, speed: 16, life: 0.32, dmg: 5 },   // Cortes de Vento
  tiger: { delay: 0.3, r: 2.4, dmg: 20, range: 6, h: 7 },        // Tigre Fantasma
  whet: { n: 5, wall: 0.95 },                                    // Afiar na Parede: 5 golpes
  trap: { every: 15, r: 0.85, t: 5, boss: 2, max: 4 },           // Armadilha de Urso: cai a cada 15 s (em combate), atordoa 5 s
  beast: { need: 10, t: 5 },                                     // Fúria da Fera: 10 acertos sem apanhar = imune 5 s
  nine: { low: 0.25, iframes: 0.6 },                             // Sete Vidas
  pack: { life: 5, max: 3, r: 0.45, speed: 8, reach: 0.55,          // Matilha: lobo fantasma
    combo: [{ kind: 'swipeR', dmg: 5, t: 0.3 }, { kind: 'swipeL', dmg: 5, t: 0.3 }, { kind: 'bite', dmg: 9, t: 0.38, bleed: 1 }], rest: 0.45,
    leap: { min: 3.2, max: 9, t: 0.45, h: 1.3, dmg: 8, cd: 1.2 } },
};
const DEG = Math.PI / 180;
// Poses de braço (Investida do Leão), em cima da animação: [x, y, z, relativo?] por osso. Ajustadas olhando screenshots.
const POSES = {
  x: { upperarmr: [0, 0, 1.3, 1], lowerarmr: [0, 0, 1.2, 1], upperarml: [0, 0, -1.3, 1], lowerarml: [0, 0, -1.2, 1] }, // antebraços cruzados no peito
  down: { upperarmr: [0.5, 0, -0.3, 1], upperarml: [0.5, 0, 0.3, 1] },                                                  // braços abertos para baixo
};
const RED = 0xff3040;
const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const isClaw = (p) => !!(p && p.heroId === 'rogue' && p.hero && p.hero.weaponId === 'garras');
const has = (p, k) => isClaw(p) && !!W(p)[k];
const big = (e) => !!(e.data.boss || e.data.radius >= CLAW.mount.bigR);
const LION_STEP = { damage: CLAW.lion.dmg, clawExtra: true };
const ARM_BONES = ['upperarml', 'lowerarml', 'wristl', 'handl', 'upperarmr', 'lowerarmr', 'wristr', 'handr', 'chest', 'spine'];
let K = null;

// ---------- Herói (player.js) ----------

// Bote (removido a pedido do dono, 07/11/2026): o ataque depois de rolar volta a ser um golpe normal.
export function clawPress() { return false; }

// Investida do Leão: ataque e rolamento apertados juntos (até CLAW.lion.win s de diferença). Chamado no começo
// do update do herói (player.js), antes do rolamento. true = começou a investida.
export function clawLionCheck(p, input, dt) {
  if (!K || !has(p, 'cLion') || !input) return false;
  const a = !!(input.attack && input.attack()), d = !!(input.dodge && input.dodge());
  p.clawAtkAge = a ? 0 : (p.clawAtkAge ?? 9) + dt;
  p.clawDodgeAge = d ? 0 : (p.clawDodgeAge ?? 9) + dt;
  if (!(a || d) || p.clawLionCd > 0 || p.clawAir) return false;
  const L = CLAW.lion;
  if (p.clawAtkAge > L.win || p.clawDodgeAge > L.win) return false;
  if (!['idle', 'run', 'attack', 'dodge'].includes(p.state) || (p.state === 'dodge' && p.stateTime > 0.18)) return false;
  p.clawAtkAge = p.clawDodgeAge = 9;
  return K.startLion(p);
}

// Investida do Leão / Revide / Montaria (estados clawLion, clawRev, clawMount). Devolve 'attack', 'end' ou nada.
export function clawAirTick(p, dt, world, input) {
  const A = p.clawAir;
  if (!A || !K) { clawLeave(p); return 'end'; }
  A.t += dt;
  if (input && input.attack && input.attack() && A.t > 0.1) A.atk = true; // o clique que começou a investida não conta
  if (A.kind === 'mount') return K.mountTick(p, A, dt, world);
  if (A.kind === 'lion') return K.lionTick(p, A, dt, world);
  if (A.kind === 'rev') return K.revTick(p, A, dt, world);
  clawLeave(p);
  return 'end';
}

// Desce do pulo/montaria na hora (rolou, morreu, trocou de arma).
export function clawLeave(p) {
  if (!p) return;
  const A = p.clawAir;
  p.clawAir = null;
  if (p.model) { p.model.position.y = 0; p.model.rotation.x = 0; p.model.visible = true; }
  if (A && A.kind === 'mount' && A.e) A.e.clawRider = null;
}

// Cair de Pé: empurrado ou derrubado, não fica atordoado e já ataca (devolve true = não entra em 'hurt'/'stagger').
export function clawLand(p, toEnemyAng) {
  if (!K || !has(p, 'cLand') || p.hp <= 0 || p.state === 'dead') return false;
  p.iframes = Math.max(p.iframes || 0, p.hero.hurt.iframes);
  p.combo = 0; p.queued = false;
  p.setState('idle'); p.anim.play(p.hero.anims.idle, { fade: 0.08 });
  p.clawAuto = toEnemyAng;
  K.c.text.add('De pé!', p.position, 'crit', 3.0);
  K.log({ type: 'clawLand' });
  return true;
}

// Fúria da Fera agora deixa imune (não ataca mais sozinho): sempre false.
export const clawBeast = () => false;

export function clawReset(p) {
  clawLeave(p);
  p.clawBeastT = 0; p.clawBeastN = 0; p.clawWhet = 0; p.clawAuto = null; p.clawWantRev = null; p.clawWantMount = null;
  p.clawRevengeCd = 0; p.clawMountCd = 0; p.clawLionCd = 0; p.clawPose = null; p.clawBack = null; p.clawTrapCd = CLAW.trap.every; p.clawScentMul = 1; p.clawNineUsed = false;
  if (p.bodyMats && p.clawFlashOn) { setFlash(p.bodyMats, 0); p.clawFlashOn = false; }
  if (K) K.dropFor(p);
}

export class ClawKit {
  constructor(c) {
    this.c = c; K = this;
    this.scene = c.scene;
    this.marks = []; this.puddles = []; this.traps = []; this.tigers = []; this.beasts = [];
    this.outlines = new Map(); this.whetFx = new Map(); this.beastFx = new Map();
    this.time = 0;
  }
  log(o) { if (this.c.log) this.c.log(o); }
  dmg(p, n) { return Math.max(1, Math.round(n * ((p && p.stats && p.stats.damageMul) || 1))); }
  owner(k) { return this.c.players.find((p) => p.state !== 'dead' && has(p, k)) || null; }
  rm(o) { if (o) { this.scene.remove(o); dispose(o); } }
  bleed(p, e, n) {
    if (!e.alive || e.undead || n <= 0) return;
    e.bleedStacks = (e.bleedStacks || 0) + n;
    e.bleedBy = p;
    this.c.text.add(e.bleedStacks > 1 ? `Sangramento ×${e.bleedStacks}` : 'Sangrando!', e.position, 'bleed', 3.0);
  }
  others(e, r) {
    return this.c.enemies.filter((o) => o !== e && o.targetable && !o.undead && !(o.data && o.data.phantom)
      && Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) <= r + o.data.radius);
  }

  // ---------- Investida do Leão ----------
  startLion(p) {
    const L = CLAW.lion, wd = this.c.world, c = this.c;
    // Direção: para onde está andando; parado, para onde mira.
    const d = (this._dir ||= new THREE.Vector3());
    if (p.ctl && p.ctl.moveDir) p.ctl.moveDir(d); else d.set(0, 0, 0);
    let a = d.lengthSq() > 0.01 ? Math.atan2(d.x, d.z) : (p.ctl && p.ctl.aimAngle && c.cam ? (p.ctl.aimAngle(c.cam.camera, p.position) ?? p.facing) : p.facing);
    const dist = p.hero.dodge.distance * (p.stats.dodgeMul || 1);
    // Até onde dá para ir (para na parede).
    const probe = (this._probe ||= new THREE.Vector3()).copy(p.position);
    const fx = Math.sin(a), fz = Math.cos(a), n = Math.max(1, Math.ceil(dist / 0.25));
    for (let i = 0; i < n; i++) { probe.x += fx * dist / n; probe.z += fz * dist / n; if (wd) { wd.resolveCircle(probe, p.hero.radius); wd.clampInside(probe, p.hero.radius); } }
    clawLeave(p);
    if (p.clearRoll) p.clearRoll();
    p.setState('clawLion');
    p.combo = 0; p.queued = false; p.setGlow(0); p.vel.set(0, 0, 0);
    p.facing = a; p.group.rotation.y = a;
    p.clawLionCd = L.cd;
    p.clawAir = { kind: 'lion', t: 0, fx: p.position.x, fz: p.position.z, tx: probe.x, tz: probe.z, a, gone: false, back: false, atk: false };
    p.clawPose = 'x';
    p.anim.play('Idle_A', { fade: 0.04, restart: true }); // base das poses (POSES)
    const hx = p.position.x + Math.sin(a) * 0.5, hz = p.position.z + Math.cos(a) * 0.5;
    this.slash(hx, 1.35, hz, a, 0.5, 0.8); this.slash(hx, 1.35, hz, a, 0.5, -0.8); // brilho em X na frente do peito
    c.vfx.sparks(v3(p.position.x, 1.4, p.position.z), RED, 8);
    audio.play('charge', p.position.x, p.position.z, { v: 0.6 });
    c.text.add('Investida do Leão!', p.position, 'crit', 3.4);
    this.log({ type: 'clawLion' });
    return true;
  }
  lionTick(p, A, dt, world) {
    const L = CLAW.lion, c = this.c;
    if (!A.gone && A.t >= L.cross) { // some e corta tudo no caminho
      A.gone = true;
      p.model.visible = false;
      c.vfx.smoke(v3(A.fx, 0.9, A.fz), 0x5a0a14, 12);
      const from = v3(A.fx, 1.0, A.fz), to = v3(A.tx, 1.0, A.tz);
      c.vfx.beamLine(from, to, 0xff2a3a, 0.35);
      c.vfx.beamLine(from, to, 0xffd0c0, 0.12);
      audio.play('swingHeavy', A.fx, A.fz, { v: 1.2 });
      const len = Math.hypot(A.tx - A.fx, A.tz - A.fz) || 0.01, ux = (A.tx - A.fx) / len, uz = (A.tz - A.fz) / len;
      let n = 0;
      for (const e of [...c.enemies]) {
        if (!e.targetable) continue;
        const dx = e.position.x - A.fx, dz = e.position.z - A.fz, along = dx * ux + dz * uz, side = Math.abs(dx * uz - dz * ux);
        if (along < -0.6 || along > len + 0.6 || side > L.w / 2 + e.data.radius) continue;
        const r = c.damageEnemy(p, e, LION_STEP, ux, uz);
        if (r === 'hit' || r === 'kill') {
          n++;
          c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), RED, 10);
          this.slash(e.position.x, 1.2, e.position.z, A.a, 1.1);
        }
      }
      if (c.props) c.props.hitLine(A.fx, A.fz, A.tx, A.tz, L.w, p);
      if (n) { c.addHitstop(0.05); c.shakeFor(p, 0.2); audio.play('hitHeavy', A.tx, A.tz, { v: 0.9 }); }
      this.log({ type: 'clawLionHit', n });
    }
    if (A.gone && !A.back && A.t >= L.cross + L.gone) { // reaparece no fim, braços esticados para baixo
      A.back = true;
      p.position.x = A.tx; p.position.z = A.tz;
      world.resolveCircle(p.position, p.hero.radius);
      p.model.visible = true;
      p.clawPose = 'down';
      p.anim.play('Idle_A', { fade: 0 });
      c.vfx.smoke(v3(p.position.x, 0.9, p.position.z), 0x5a0a14, 10);
      c.vfx.dust(v3(p.position.x, 0.1, p.position.z), v3(0, 0, 0), 6);
    }
    if (A.back && A.t >= L.cross + L.gone + L.land) {
      p.clawPose = null;
      p.clawAir = null;
      p.dodgeCooldown = Math.min(p.dodgeCooldown, 0.1);
      return A.atk ? 'attack' : 'end';
    }
    return null;
  }
  // Garrada: três riscos vermelhos que aparecem e somem (lobo e investida).
  slash(x, y, z, a, size = 1, tilt = 0) {
    const g = slashFx(size);
    g.position.set(x, y, z);
    g.rotation.set(0, a + Math.PI / 2, tilt);
    this.c.vfx.add(g, 0.22, (o, k) => { o.userData.mats[0].opacity = 0.95 * (1 - k); o.userData.mats[1].opacity = 0.6 * (1 - k); o.scale.setScalar(0.8 + k * 0.4); });
  }

  // ---------- Revide: some, aparece atrás de quem bateu e executa ----------
  startRev(p, e) {
    const R = CLAW.revenge, c = this.c;
    clawLeave(p);
    if (p.clearRoll) p.clearRoll();
    p.setState('clawRev');
    p.combo = 0; p.queued = false; p.vel.set(0, 0, 0);
    p.iframes = Math.max(p.iframes || 0, R.safe);
    p.clawAir = { kind: 'rev', e, t: 0, shown: false, hit: false, atk: false };
    p.model.visible = false;
    c.vfx.smoke(v3(p.position.x, 0.9, p.position.z), 0x3a0a14, 12);
    audio.play('dodge', p.position.x, p.position.z, { v: 1.2 });
    c.text.add('Revide!', p.position, 'crit', 3.4);
    this.log({ type: 'clawRevenge', enemy: e });
    return true;
  }
  behind(p, e) {
    const wd = this.c.world, b = wd && wd.bounds, r = e.data.radius + p.hero.radius + 0.2;
    for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, Math.PI]) {
      const a = e.facing + Math.PI + off, x = e.position.x + Math.sin(a) * r, z = e.position.z + Math.cos(a) * r;
      if (b && (Math.abs(x) > b.x - p.hero.radius || Math.abs(z) > b.z - p.hero.radius)) continue;
      if (wd && wd.blocked(x, z, p.hero.radius * 0.9)) continue;
      return { x, z };
    }
    return { x: p.position.x, z: p.position.z };
  }
  revTick(p, A, dt, world) {
    const R = CLAW.revenge, c = this.c, e = A.e;
    if (!A.shown && A.t >= R.vanish) {
      A.shown = true;
      if (e && e.alive && e.targetable) { const at = this.behind(p, e); p.position.x = at.x; p.position.z = at.z; world.resolveCircle(p.position, p.hero.radius); }
      if (e) { p.facing = Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z); p.group.rotation.y = p.facing; }
      p.model.visible = true;
      p.anim.play('Melee_Dualwield_Attack_Stab', { once: true, restart: true, fade: 0.04, speed: 2.4 });
      c.vfx.smoke(v3(p.position.x, 0.9, p.position.z), 0x3a0a14, 8);
    }
    if (A.shown && !A.hit && A.t >= R.vanish + R.strike) {
      A.hit = true;
      if (e && e.alive && e.targetable) {
        const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
        const boss = !!e.data.boss;
        if (boss) c.damageEnemy(p, e, { damage: p.hero.combo[0].damage * R.bossMul, clawExtra: true }, dx / d, dz / d, { forceCrit: false });
        else { c.text.add('Execução!', e.position, 'crit', 3.8); c.bonusDamage(e, Math.max(1, Math.ceil(e.hp)), dx / d, dz / d, 'dmg big', p); }
        this.slash(e.position.x, 1.3, e.position.z, p.facing, 1.2, 0.3);
        c.vfx.sparks(v3(e.position.x, 1.3, e.position.z), RED, 16);
        c.addHitstop(0.07); c.shakeFor(p, 0.25);
        audio.play('hitHeavy', e.position.x, e.position.z, { v: 1.1 });
        this.log({ type: 'clawRevengeHit', enemy: e, boss, died: !e.alive });
      }
    }
    if (A.t >= R.end) { p.clawAir = null; return A.atk ? 'attack' : 'end'; }
    return null;
  }

  // Poses de braço feitas por cima da animação (depois do mixer): 'x' = braços cruzados; 'down' = esticados para baixo.
  applyPose(p) {
    const P = POSES[p.clawPose];
    if (!P || !p.model) return;
    const bones = p.clawBones || (p.clawBones = {});
    if (!bones.ready) { p.model.traverse((o) => { if (o.isBone && ARM_BONES.includes(o.name)) bones[o.name] = o; }); bones.ready = true; }
    for (const [name, eu] of Object.entries(P)) {
      const b = bones[name];
      if (!b) continue;
      const q = (this._q ||= new THREE.Quaternion()).setFromEuler((this._e ||= new THREE.Euler()).set(eu[0], eu[1], eu[2]));
      b.quaternion.copy(eu[3] ? b.quaternion.multiply(q) : q);
    }
    p.model.updateMatrixWorld(true);
  }

  // ---------- Montaria ----------
  startMount(p, e) {
    if (!e.alive || !e.targetable || e.clawRider) return false;
    clawLeave(p);
    p.setState('clawMount');
    p.combo = 0; p.queued = false;
    p.clawMountCd = CLAW.mount.cd;
    e.clawRider = p;
    p.clawAir = { kind: 'mount', e, t: 0, T: CLAW.mount.time * (0.85 + Math.random() * 0.3), tick: 0.1, n: 0, side: 1 };
    p.anim.play('Jump_Full_Short', { once: true, restart: true, fade: 0.05, speed: 2.4 });
    this.c.text.add('Montou!', e.position, 'crit', 3.6);
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.2 });
    this.log({ type: 'clawMount', enemy: e });
    return true;
  }
  mountTick(p, A, dt, world) {
    const e = A.e, c = this.c, M = CLAW.mount;
    const sc = e.group.scale.y || 1;
    if (!e.alive || !e.targetable || A.t >= A.T) return this.throwOff(p, A, world);
    const back = e.facing + Math.PI;
    p.position.x = e.position.x + Math.sin(back) * e.data.radius * 0.35;
    p.position.z = e.position.z + Math.cos(back) * e.data.radius * 0.35;
    p.model.position.y = 1.05 * sc + Math.sin(A.t * 30) * 0.05;
    p.facing = e.facing; p.group.rotation.y = p.facing;
    A.tick -= dt;
    if (A.tick <= 0) {
      A.tick = M.every; A.n++;
      A.side = -A.side;
      p.anim.play(A.side > 0 ? 'Melee_Dualwield_Attack_Stab' : 'Melee_Dualwield_Attack_Slice', { once: true, restart: true, fade: 0.04, speed: 3.2 });
      c.bonusDamage(e, this.dmg(p, M.dmg), Math.sin(e.facing), Math.cos(e.facing), 'dmg', p, true);
      c.vfx.sparks(v3(p.position.x, 1.3 * sc + 0.4, p.position.z), RED, 5);
      audio.play('hit', e.position.x, e.position.z, { v: 0.5 });
      this.log({ type: 'clawScratch', enemy: e });
    }
    return null;
  }
  throwOff(p, A, world) {
    const e = A.e, c = this.c;
    if (e) e.clawRider = null;
    p.clawAir = null;
    p.model.position.y = 0; p.model.rotation.x = 0;
    const a = (e ? e.facing : p.facing) + Math.PI + (Math.random() - 0.5) * 1.2;
    const r = (e ? e.data.radius : 0.6) + p.hero.radius + 0.6;
    const ox = e ? e.position.x : p.position.x, oz = e ? e.position.z : p.position.z;
    p.position.x = ox + Math.sin(a) * r; p.position.z = oz + Math.cos(a) * r;
    world.resolveCircle(p.position, p.hero.radius);
    p.vel.set(Math.sin(a), 0, Math.cos(a)).multiplyScalar(CLAW.mount.throw);
    p.iframes = Math.max(p.iframes || 0, 0.5);
    p.facing = a + Math.PI; p.group.rotation.y = p.facing;
    c.vfx.dust(v3(p.position.x, 0.1, p.position.z), v3(0, 0, 0), 6);
    if (e && e.alive) c.text.add('Jogado longe!', p.position, 'miss', 3.0);
    this.log({ type: 'clawThrown', alive: !!(e && e.alive), n: A.n });
    return 'end';
  }

  // ---------- Golpe das garras ----------
  // No momento do golpe (antes de procurar quem acertou).
  onSwing(p, step) {
    if (!isClaw(p) || step.clawExtra) return;
    const w = W(p), c = this.c;
    if (w.cWhet && !(p.clawWhet > 0) && this.nearWall(p)) {
      p.clawWhet = CLAW.whet.n;
      c.vfx.sparks(v3(p.position.x + Math.sin(p.facing) * 0.6, 1.1, p.position.z + Math.cos(p.facing) * 0.6), 0xffd0a0, 16);
      audio.play('block', p.position.x, p.position.z, { v: 0.6 });
      c.text.add('Garras afiadas!', p.position, 'crit', 3.2);
      this.log({ type: 'clawWhet' });
    }
    if (!step.heavy) return;
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
    if (w.cRoar) {
      const R = CLAW.roar;
      let n = 0;
      for (const e of c.enemies) {
        if (Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) > R.r + e.data.radius) continue;
        if (fear(e, p, R.t)) { n++; c.text.add('Medo!', e.position, 'hurt', 3.0); }
      }
      c.vfx.ring(v3(p.position.x, 0.15, p.position.z), 0xffb040, R.r);
      c.vfx.ring(v3(p.position.x, 0.25, p.position.z), RED, R.r * 0.7);
      c.shakeFor(p, 0.18);
      audio.play('warcry', p.position.x, p.position.z, { v: 0.9 });
      c.text.add('RUGIDO!', p.position, 'crit', 3.8);
      this.log({ type: 'clawRoar', n });
    }
    if (w.cWind) {
      const Wd = CLAW.wind;
      for (let i = 0; i < Wd.n; i++) {
        const a = p.facing + (i - (Wd.n - 1) / 2) * Wd.spread;
        c.projectiles.fire(p.position.x + Math.sin(a) * 0.9, p.position.z + Math.cos(a) * 0.9, a, {
          speed: Wd.speed, damage: this.dmg(p, Wd.dmg), kind: 'wave', color: 0xe8f4ff, hits: 'hero', pierce: true,
          height: 1.0, life: Wd.life, scale: 0.7, owner: p,
        });
      }
      audio.play('swing', p.position.x, p.position.z, { v: 1.1 });
      this.log({ type: 'clawWind' });
    }
    if (w.cMarks) {
      const M = CLAW.marks, g = clawMarks(M.len, M.gap, M.w);
      const x = p.position.x + fx * 0.6, z = p.position.z + fz * 0.6;
      g.position.set(x, 0, z); g.rotation.y = p.facing;
      this.scene.add(g);
      this.marks.push({ g, x, z, a: p.facing, t: M.life, by: p, cd: new Map() });
      this.log({ type: 'clawMarks' });
    }
    if (w.cTiger) {
      const T = CLAW.tiger;
      let best = null, bd = T.range;
      for (const e of c.enemies) {
        if (!e.targetable || e.undead) continue;
        const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz);
        if (d < bd && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) < 70 * DEG) { bd = d; best = e; }
      }
      const x = best ? best.position.x : p.position.x + fx * 2.2, z = best ? best.position.z : p.position.z + fz * 2.2;
      const g = ghostClaw();
      g.position.set(x, T.h, z);
      this.scene.add(g);
      this.tigers.push({ g, x, z, e: best, t: 0, by: p, hit: false });
      c.text.add('Tigre Fantasma!', p.position, 'crit', 3.4);
      this.log({ type: 'clawTiger' });
    }
  }
  nearWall(p) {
    const wd = this.c.world;
    if (!wd) return false;
    const r = p.hero.radius + CLAW.whet.wall, b = wd.bounds;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = p.position.x + Math.sin(a) * r, z = p.position.z + Math.cos(a) * r;
      if (wd.blocked(x, z, 0.2)) return true;
      if (b && (Math.abs(x) > b.x - 0.1 || Math.abs(z) > b.z - 0.1)) return true;
    }
    return false;
  }

  // Depois do dano (wbOnHit): tudo que acontece num acerto das garras.
  onHit(p, e, step, r) {
    if (!isClaw(p) || step.clawExtra) return;
    const w = W(p), c = this.c, { died, nx, nz } = r;
    if (p.clawSwing !== p.swingSeq) { // 1º acerto deste golpe
      p.clawSwing = p.swingSeq;
      p.clawWhetOn = p.clawWhet > 0;
      if (p.clawWhetOn) p.clawWhet--;
      if (w.cBeast && !(p.clawBeastT > 0)) { // imune: não conta (recomeça depois)
        p.clawBeastN = (p.clawBeastN || 0) + 1;
        if (p.clawBeastN >= CLAW.beast.need) {
          p.clawBeastN = 0; p.clawBeastT = CLAW.beast.t;
          c.text.add('FÚRIA DA FERA: IMUNE!', p.position, 'crit', 4.0);
          audio.play('warcry', p.position.x, p.position.z, { v: 0.7 });
          this.log({ type: 'clawBeast' });
        }
      }
    }
    if (p.clawWhetOn && !died && e.alive) { this.bleed(p, e, 1); this.log({ type: 'clawWhetBleed', enemy: e }); }
    if (died || !e.alive) return;
    if (!step.heavy) return;
    if (w.cShred && e.data.shield && !e.shieldBroken && !e.data.boss) { c.breakEnemyShield(e, nx, nz, p); c.text.add('Rasgou o escudo!', e.position, 'crit', 3.6); this.log({ type: 'clawShredBreak', enemy: e }); }
    if (w.cSpread && e.bleedStacks > 0) {
      let n = 0;
      for (const o of this.others(e, CLAW.spread.r)) {
        this.bleed(p, o, e.bleedStacks); n++;
        c.vfx.bolt(v3(e.position.x, 1.2, e.position.z), v3(o.position.x, 1.2, o.position.z), 0xff2040);
      }
      if (n) c.text.add('Contágio!', e.position, 'bleed', 3.4);
      this.log({ type: 'clawSpread', n, stacks: e.bleedStacks });
    }
    if (w.cMount && big(e) && !(p.clawMountCd > 0) && !e.clawRider) p.clawWantMount = e;
  }

  // Golpe batido no escudo do esqueleto: Rasgar Escudo arranca pedaços.
  onBlocked(p, e, step) {
    if (!has(p, 'cShred') || step.clawExtra || e.data.boss) return;
    e.clawShred = (e.clawShred || 0) + 1;
    const c = this.c;
    c.vfx.sparks(v3(e.position.x - Math.sin(e.facing) * -0.5, 1.2, e.position.z + Math.cos(e.facing) * 0.5), 0xb08a5a, 10);
    c.vfx.dust(v3(e.position.x, 1.0, e.position.z), v3(0, 0, 0), 3);
    c.text.add('Rasgou!', e.position, 'block', 2.8);
    if (e.shieldMesh) e.shieldMesh.scale.multiplyScalar(0.9); // o escudo vai diminuindo
    this.log({ type: 'clawShred', enemy: e, n: e.clawShred });
  }

  // Herói tomou dano (combat.hitPlayer, depois do dano).
  onHurt(p, src) {
    if (!isClaw(p)) return;
    if (!(p.clawBeastT > 0)) p.clawBeastN = 0; // Fúria da Fera: a contagem recomeça
    if (!has(p, 'cRevenge') || p.state === 'dead' || p.hp <= 0 || p.clawRevengeCd > 0) return;
    if (!src || !src.alive || !src.targetable || src.undead || !src.data) return;
    p.clawRevengeCd = CLAW.revenge.cd;
    p.clawWantRev = src;
  }

  // Sete Vidas (combat.hitPlayer, antes do dano): devolve true = escapou.
  nineLives(p, e, dmg, nx, nz) {
    if (!has(p, 'cNine') || p.clawNineUsed || p.state === 'dead') return false;
    if (p.hp - dmg >= p.maxHp * CLAW.nine.low) return false;
    p.clawNineUsed = true;
    clawLeave(p);
    p.dodgeDir.set(nx, 0, nz);
    if (p.dodgeDir.lengthSq() < 1e-4) p.dodgeDir.set(-Math.sin(p.facing), 0, -Math.cos(p.facing));
    p.dodgeDir.normalize();
    p.facing = Math.atan2(p.dodgeDir.x, p.dodgeDir.z); p.group.rotation.y = p.facing;
    p.combo = 0; p.queued = false;
    p.setState('dodge');
    p.anim.play(p.hero.dodge.pose, { fade: 0.04, restart: true });
    p.iframes = Math.max(p.iframes || 0, CLAW.nine.iframes);
    const c = this.c;
    c.vfx.smoke(v3(p.position.x, 0.8, p.position.z), 0xffd0d0, 10);
    c.text.add('Sete Vidas!', p.position, 'crit', 3.8);
    audio.play('dodge', p.position.x, p.position.z, { v: 1.3 });
    this.log({ type: 'clawNine', dmg });
    return true;
  }

  // Presa Isolada: ninguém do lado.
  isolated(e) { return this.others(e, CLAW.isolated.r).length === 0; }
  bleedMul(e) {
    const bw = W(e.bleedBy);
    if (!bw.cIsolated || !isClaw(e.bleedBy) || !this.isolated(e)) return 1;
    this.c.text.add('Presa isolada!', e.position, 'crit', 3.2);
    this.log({ type: 'clawIsolated', enemy: e });
    return 2;
  }

  // ---------- Inimigo destruído ----------
  onKill(e) {
    const o = this.outlines.get(e);
    if (o) { removeOutline(o); this.outlines.delete(e); }
    if (e.clawRider) { const p = e.clawRider; e.clawRider = null; if (p.clawAir && p.clawAir.e === e) p.clawAir.t = 1e9; }
    const by = e.bleedBy;
    if (e.bleedStacks > 0 && has(by, 'cPack') && by.state !== 'dead' && !e.clawPackDone) {
      e.clawPackDone = true;
      this.spawnBeast(by, e.position.x, e.position.z);
    }
  }
  spawnBeast(p, x, z) {
    const P = CLAW.pack;
    const mine = this.beasts.filter((b) => b.by === p);
    if (mine.length >= P.max) { const old = mine[0]; old.t = Math.min(old.t, 0.3); }
    const g = ghostWolf();
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(p.position.x - x, p.position.z - z);
    this.scene.add(g);
    const b = { g, by: p, t: P.life, pos: g.position, mode: 'chase', i: 0, k: 0, hit: false, rest: 0.25, leapCd: 0, air: null, born: 0 };
    this.beasts.push(b);
    this.c.vfx.smoke(v3(x, 0.8, z), 0xff5a6a, 10);
    this.c.text.add('Matilha!', { x, z }, 'crit', 3.2);
    audio.play('warcry', x, z, { v: 0.5 });
    this.log({ type: 'clawPack' });
    return b;
  }
  wolfHit(b, e, dmg, bleed) {
    const c = this.c, dx = e.position.x - b.pos.x, dz = e.position.z - b.pos.z, d = Math.hypot(dx, dz) || 1;
    c.bonusDamage(e, this.dmg(b.by, dmg), dx / d, dz / d, 'dmg', b.by);
    if (bleed && e.alive) this.bleed(b.by, e, bleed);
    c.vfx.sparks(v3(e.position.x, 1.0, e.position.z), 0xff5a6a, 7);
    audio.play('hit', e.position.x, e.position.z, { v: 0.45 });
  }

  // ---------- A cada quadro ----------
  tick(dt) {
    const c = this.c;
    this.time += dt;
    for (const p of c.players) {
      if (p.clawRevengeCd > 0) p.clawRevengeCd -= dt;
      if (p.clawMountCd > 0) p.clawMountCd -= dt;
      if (p.clawLionCd > 0) p.clawLionCd -= dt;
      if (p.clawPose && p.state !== 'clawLion') p.clawPose = null;
      if (p.clawPose) this.applyPose(p);
      if (!isClaw(p)) { if (p.clawAir) clawLeave(p); this.dropFor(p); continue; }
      const w = W(p);
      // Pedidos guardados (o golpe/dano aconteceu no meio do update do herói).
      if (p.clawWantMount) {
        const e = p.clawWantMount; p.clawWantMount = null;
        if (p.state !== 'dead' && ['attack', 'idle', 'run'].includes(p.state)) this.startMount(p, e);
      }
      if (p.clawWantRev) {
        const e = p.clawWantRev; p.clawWantRev = null;
        if (p.state !== 'dead' && p.hp > 0 && e.targetable && ['hurt', 'idle', 'run', 'attack', 'stagger', 'dodge', 'clawLion'].includes(p.state)) this.startRev(p, e);
      }
      // Armadilha de Urso: a cada 15 s de combate, cai uma armadilha aos pés do Ladino.
      if (w.cTrap && p.state !== 'dead' && c.enemies.some((e) => e.targetable && !e.undead)) {
        p.clawTrapCd = (p.clawTrapCd ?? CLAW.trap.every) - dt;
        if (p.clawTrapCd <= 0) { p.clawTrapCd = CLAW.trap.every; this.dropTrap(p); }
      }
      // Fúria da Fera: imune, com brilho vermelho.
      if (p.clawBeastT > 0) {
        p.clawBeastT -= dt;
        let fx = this.beastFx.get(p);
        if (!fx) { fx = beastGlow(); this.scene.add(fx); this.beastFx.set(p, fx); }
        fx.position.set(p.position.x, 1.2 + p.model.position.y, p.position.z);
        fx.material.opacity = 0.35 + 0.15 * Math.sin(this.time * 12);
        if (p.bodyMats) { setFlash(p.bodyMats, 0.35 + 0.2 * Math.sin(this.time * 12), 1, 0.12, 0.08); p.clawFlashOn = true; }
        if (p.clawBeastT <= 0) { p.clawBeastT = 0; p.clawBeastN = 0; this.rm(fx); this.beastFx.delete(p); if (p.bodyMats) setFlash(p.bodyMats, 0); p.clawFlashOn = false; c.text.add('Fim da Fúria', p.position, 'miss', 2.6); this.log({ type: 'clawBeastEnd' }); }
      }
      // Afiar na Parede: brilho nas garras enquanto estão afiadas.
      let wf = this.whetFx.get(p);
      if (p.clawWhet > 0 && !wf) { wf = [p.weapon, p.offhand].filter(Boolean).map((o) => { const s = whetGlow(); o.add(s); return s; }); this.whetFx.set(p, wf); }
      if (!(p.clawWhet > 0) && wf) { wf.forEach((s) => { s.removeFromParent(); dispose(s); }); this.whetFx.delete(p); }
      // Faro de Sangue: corre mais rápido na direção de um inimigo sangrando.
      p.clawScentMul = 1;
      if (w.cScent && (p.state === 'run' || p.state === 'idle') && p.ctl) {
        const d = (this._dir ||= new THREE.Vector3());
        p.ctl.moveDir(d);
        if (d.lengthSq() > 0) {
          const a = Math.atan2(d.x, d.z), S = CLAW.scent;
          for (const e of c.enemies) {
            if (!(e.bleedStacks > 0) || !e.targetable) continue;
            const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z;
            if (Math.hypot(dx, dz) <= S.range && Math.abs(wrap(Math.atan2(dx, dz) - a)) <= S.cone * DEG) { p.clawScentMul = S.mul; break; }
          }
        }
      }
    }
    this.enemyTick(dt);
    this.tickMarks(dt);
    this.tickTraps(dt);
    this.tickTigers(dt);
    this.tickBeasts(dt);
  }

  enemyTick(dt) {
    const c = this.c;
    const scent = this.owner('cScent');
    OUTLINE_MAT.opacity = 0.65 + 0.3 * Math.sin(this.time * 8);
    for (const e of c.enemies) {
      if (!e.alive && e.bleedStacks > 0 && !e.clawPackDone && !e.undead) this.onKill(e); // Matilha (qualquer jeito de morrer)
      const bleeding = e.alive && e.bleedStacks > 0 && !e.undead;
      // Faro de Sangue: contorno vermelho.
      const o = this.outlines.get(e);
      if (bleeding && scent && !o) { this.outlines.set(e, addOutline(e.model)); this.log({ type: 'clawOutline', enemy: e }); }
      else if ((!bleeding || !scent) && o) { removeOutline(o); this.outlines.delete(e); }
      if (!bleeding) continue;
      const by = e.bleedBy, w = isClaw(by) ? W(by) : {};
      // Morte Dolorosa: o sangramento ativa sozinho de tempo em tempo (mesmo sem atacar).
      if (w.cAgony && e.targetable) {
        e.clawAgonyT = (e.clawAgonyT || 0) + dt;
        if (e.clawAgonyT >= CLAW.agony.every) {
          e.clawAgonyT = 0;
          this.log({ type: 'clawAgony', enemy: e, stacks: e.bleedStacks });
          c.bleedDamage(e, e.bleedStacks);
          if (!e.alive) continue;
        }
      }
      // Poça de Sangue: vai pingando no chão.
      if (w.cPuddle && e.targetable) {
        e.clawPudT = (e.clawPudT ?? CLAW.puddle.every * 0.5) - dt;
        if (e.clawPudT <= 0) {
          e.clawPudT = CLAW.puddle.every;
          if (!this.puddles.some((q) => Math.hypot(q.x - e.position.x, q.z - e.position.z) < CLAW.puddle.r * 1.2)) this.addPuddle(e.position.x, e.position.z, e, by);
        }
      }
      // Ruptura: 5 sangramentos ou mais estoura.
      if (w.cBurst && e.targetable && e.bleedStacks >= CLAW.burst.at) this.burst(e, by);
    }
    // Poças: quem pisa escorrega.
    const P = CLAW.puddle;
    for (const q of [...this.puddles]) {
      q.t -= dt;
      q.g.userData.mat.opacity = Math.min(0.85, q.t / 0.6 * 0.85);
      if (q.t <= 0) { this.rm(q.g); this.puddles.splice(this.puddles.indexOf(q), 1); continue; }
      for (const e of c.enemies) {
        if (e === q.src || !e.targetable || e.undead || e.state !== 'chase' || (e.clawSlipT || 0) > this.time) continue;
        if (Math.hypot(e.position.x - q.x, e.position.z - q.z) > P.r + e.data.radius * 0.4) continue;
        e.clawSlipT = this.time + P.cd;
        const a = e.facing + Math.PI + (Math.random() - 0.5) * 0.6; // cai de costas
        if (knockDown(e, Math.sin(a) * 0.25, Math.cos(a) * 0.25)) {
          e.down.total = (e.data.boss ? P.boss : P.down) + 0.55; // + o tempo do escorregão
          e.down.slip = true; // axekit3: pés deslizam, braços se debatem, depois cai de costas
          e.vel.set(Math.sin(e.facing), 0, Math.cos(e.facing)).multiplyScalar(2.2);
          c.text.add('Escorregou e caiu!', e.position, 'hurt', 3.2);
          c.vfx.sparks(v3(e.position.x, 0.3, e.position.z), 0x9a0a1a, 6);
          this.log({ type: 'clawSlip', enemy: e });
        }
      }
    }
  }
  // Armadilha de Urso (Garras): fica no chão até um inimigo pisar.
  dropTrap(p) {
    const T = CLAW.trap;
    if (this.traps.length >= T.max) { const old = this.traps.shift(); this.rm(old.g); }
    const g = bearTrap();
    g.position.set(p.position.x, 0.02, p.position.z); g.rotation.y = Math.random() * 6.28;
    this.scene.add(g);
    this.traps.push({ g, x: p.position.x, z: p.position.z, by: p, armT: 0.4, shut: -1 });
    audio.play('metal', p.position.x, p.position.z, { v: 0.6 });
    this.c.text.add('Armadilha!', p.position, 'miss', 2.6);
    this.log({ type: 'clawTrapSet' });
  }
  tickTraps(dt) {
    const T = CLAW.trap, c = this.c;
    for (const q of [...this.traps]) {
      if (q.shut >= 0) { // fechou: some depois de um tempo
        q.shut += dt;
        setTrapOpen(q.g, Math.max(0, 1 - q.shut / 0.08));
        if (q.shut > 1.2) { q.g.scale.setScalar(Math.max(0.01, 1 - (q.shut - 1.2) / 0.4)); }
        if (q.shut > 1.6) { this.rm(q.g); this.traps.splice(this.traps.indexOf(q), 1); }
        continue;
      }
      q.armT -= dt;
      if (q.armT > 0) continue;
      for (const e of c.enemies) {
        if (!e.targetable || e.undead || (e.data && e.data.phantom)) continue;
        if (Math.hypot(e.position.x - q.x, e.position.z - q.z) > T.r + e.data.radius * 0.5) continue;
        q.shut = 0;
        e.position.x = q.x; e.position.z = q.z; if (e.group) e.group.position.copy(e.position);
        if (e.vel) e.vel.set(0, 0, 0);
        const t = e.data.boss ? T.boss : T.t;
        e.daze(t);
        c.text.add('Preso! (atordoado)', e.position, 'crit', 3.2);
        c.vfx.sparks(v3(q.x, 0.5, q.z), 0xd0d4dc, 12);
        audio.play('spikes', q.x, q.z, { v: 1.3 });
        this.log({ type: 'clawTrap', enemy: e, t });
        break;
      }
    }
  }
  addPuddle(x, z, src, by) {
    const P = CLAW.puddle;
    if (this.puddles.length >= P.max) { const old = this.puddles.shift(); this.rm(old.g); }
    const g = bloodPuddle(P.r);
    g.position.x = x; g.position.z = z; g.rotation.y = Math.random() * 6.28;
    this.scene.add(g);
    const q = { g, x, z, t: P.life, src, by };
    this.puddles.push(q);
    this.log({ type: 'clawPuddle' });
    return q;
  }
  burst(e, by) {
    const B = CLAW.burst, c = this.c;
    const n = e.bleedStacks;
    e.bleedStacks = 1;
    const at = v3(e.position.x, 1.1, e.position.z);
    c.vfx.sparks(at, 0xc8102e, 24);
    c.vfx.ring(v3(at.x, 0.12, at.z), 0xff2040, B.r);
    c.vfx.burst(at, 0xff2040);
    audio.play('crunch', at.x, at.z, { v: 0.9 });
    c.text.add('Ruptura!', e.position, 'crit', 3.8);
    const victims = this.others(e, B.r);
    for (const o of victims) this.bleed(by, o, B.add);
    this.log({ type: 'clawBurst', enemy: e, stacks: n, n: victims.length });
    c.bonusDamage(e, this.dmg(by, B.per * n), 0, 1, 'bleed', by, true);
  }

  tickMarks(dt) {
    const c = this.c, M = CLAW.marks;
    for (const m of [...this.marks]) {
      m.t -= dt;
      const k = Math.min(1, m.t / 0.5);
      m.g.userData.mats[0].opacity = 0.85 * k * (0.8 + 0.2 * Math.sin(this.time * 14));
      m.g.userData.mats[1].opacity = 0.9 * k;
      if (m.t <= 0) { this.rm(m.g); this.marks.splice(this.marks.indexOf(m), 1); continue; }
      const fx = Math.sin(m.a), fz = Math.cos(m.a);
      for (const e of [...c.enemies]) {
        if (!e.targetable || e.undead) continue;
        if ((m.cd.get(e) || 0) > this.time) continue;
        const dx = e.position.x - m.x, dz = e.position.z - m.z;
        const along = dx * fx + dz * fz, side = dx * fz - dz * fx;
        if (along < -e.data.radius || along > M.len + e.data.radius || Math.abs(side) > M.gap + M.w + e.data.radius) continue;
        m.cd.set(e, this.time + M.tick);
        c.vfx.sparks(v3(e.position.x, 0.4, e.position.z), 0xff6a4a, 5);
        c.bonusDamage(e, this.dmg(m.by, M.dmg), fx, fz, 'bleed', m.by, true);
        this.log({ type: 'clawMarkCut', enemy: e });
      }
    }
  }

  tickTigers(dt) {
    const c = this.c, T = CLAW.tiger;
    for (const t of [...this.tigers]) {
      t.t += dt;
      if (t.e && t.e.alive) { t.x = t.e.position.x; t.z = t.e.position.z; }
      const k = Math.min(1, t.t / T.delay);
      t.g.position.set(t.x, T.h * (1 - k * k), t.z);
      if (k >= 1 && !t.hit) {
        t.hit = true;
        const at = v3(t.x, 0.1, t.z);
        c.vfx.heavyImpact(at, 1.4);
        c.vfx.ring(at, 0xff6a3a, T.r);
        c.shakeFor(t.by, 0.3);
        c.addHitstop(0.05);
        audio.play('hitHeavy', t.x, t.z, { v: 1.2 });
        let n = 0;
        for (const e of [...c.enemies]) {
          if (!e.targetable || e.undead) continue;
          const dx = e.position.x - t.x, dz = e.position.z - t.z, d = Math.hypot(dx, dz) || 1;
          if (d > T.r + e.data.radius) continue;
          c.bonusDamage(e, this.dmg(t.by, T.dmg), dx / d, dz / d, 'dmg big', t.by);
          if (e.alive) this.bleed(t.by, e, 1);
          n++;
        }
        this.log({ type: 'clawTigerHit', n });
      }
      if (t.hit) {
        const f = Math.max(0, 1 - (t.t - T.delay) / 0.45);
        t.g.traverse((o) => { if (o.material) o.material.opacity = (o.material.userData.base ??= o.material.opacity) * f; });
        if (f <= 0) { this.rm(t.g); this.tigers.splice(this.tigers.indexOf(t), 1); }
      }
    }
  }

  // Matilha: cada lobo persegue o inimigo mais perto; perto = combo de 3 (garrada, garrada, mordida com sangramento);
  // longe = pulo com mordida. Sem inimigo: fica do lado do Ladino.
  tickBeasts(dt) {
    const c = this.c, P = CLAW.pack, wd = c.world;
    for (const b of [...this.beasts]) {
      b.t -= dt; b.born += dt; b.leapCd -= dt;
      const fade = Math.min(1, b.t / 0.4, b.born / 0.25);
      fadeWolf(b.g, Math.max(0, fade));
      if (b.t <= 0 || b.by.state === 'dead') { c.vfx.smoke(v3(b.pos.x, 0.7, b.pos.z), 0xff5a6a, 6); this.rm(b.g); this.beasts.splice(this.beasts.indexOf(b), 1); continue; }
      let best = null, bd = 30;
      for (const e of c.enemies) {
        if (!e.targetable || e.undead) continue;
        const d = Math.hypot(e.position.x - b.pos.x, e.position.z - b.pos.z);
        if (d < bd) { bd = d; best = e; }
      }
      const pose = { move: 0, atk: null, air: null };
      // No ar (pulo com mordida).
      if (b.air) {
        const A = b.air; A.t += dt;
        const k = Math.min(1, A.t / P.leap.t);
        b.pos.x = A.fx + (A.tx - A.fx) * k; b.pos.z = A.fz + (A.tz - A.fz) * k;
        b.g.userData.body.position.y = 0;
        b.g.position.y = P.leap.h * 4 * k * (1 - k);
        pose.air = k;
        if (k >= 1) {
          b.air = null; b.g.position.y = 0;
          if (wd) wd.resolveCircle(b.pos, P.r);
          c.vfx.dust(v3(b.pos.x, 0.1, b.pos.z), v3(0, 0, 0), 5);
          if (A.e && A.e.targetable && Math.hypot(A.e.position.x - b.pos.x, A.e.position.z - b.pos.z) < A.e.data.radius + P.r + 1.4) {
            this.wolfHit(b, A.e, P.leap.dmg, 0);
            this.slash(A.e.position.x, 1.0, A.e.position.z, b.g.rotation.y, 0.8, 1.2);
            this.log({ type: 'clawPackLeap', enemy: A.e });
          }
          b.mode = 'chase'; b.i = 0; b.rest = 0.1;
        }
        animWolf(b.g, pose, dt);
        continue;
      }
      const tx = best ? best.position.x : b.by.position.x + 1.4, tz = best ? best.position.z : b.by.position.z + 0.4;
      const dx = tx - b.pos.x, dz = tz - b.pos.z, d = Math.hypot(dx, dz) || 1;
      const reach = best ? best.data.radius + P.r + P.reach : 1.2;
      const want = Math.atan2(dx, dz);
      b.g.rotation.y += wrap(want - b.g.rotation.y) * (1 - Math.exp(-14 * dt));
      if (b.mode === 'atk') {
        const S = P.combo[b.i];
        b.k += dt / S.t;
        pose.atk = { kind: S.kind, k: Math.min(1, b.k) };
        if (!b.hit && b.k >= 0.5) {
          b.hit = true;
          if (best && d <= reach + 0.6) {
            this.wolfHit(b, best, S.dmg, S.bleed || 0);
            const side = S.kind === 'swipeR' ? -0.9 : S.kind === 'swipeL' ? 0.9 : 0;
            this.slash(best.position.x, 1.05, best.position.z, b.g.rotation.y, S.kind === 'bite' ? 0.95 : 0.75, side);
            this.log({ type: S.kind === 'bite' ? 'clawPackBite' : 'clawPackSwipe', enemy: best, step: b.i });
          }
          audio.play(S.kind === 'bite' ? 'swingHeavy' : 'swing', b.pos.x, b.pos.z, { v: 0.45 });
        }
        if (b.k >= 1) {
          b.k = 0; b.hit = false; b.i++;
          if (b.i >= P.combo.length || !best || d > reach + 0.8) { b.i = 0; b.mode = 'chase'; b.rest = P.rest; }
        }
      } else {
        b.rest -= dt;
        if (best && d > P.leap.min && d < P.leap.max && b.leapCd <= 0) { // longe: pula e morde
          const back = best.data.radius + P.r + 0.2;
          b.air = { fx: b.pos.x, fz: b.pos.z, tx: tx - dx / d * back, tz: tz - dz / d * back, t: 0, e: best };
          b.leapCd = P.leap.cd;
          b.g.rotation.y = want;
          audio.play('swing', b.pos.x, b.pos.z, { v: 0.5 });
          this.log({ type: 'clawPackJump', enemy: best });
        } else if (d > reach) {
          const sp = Math.min(d - reach, P.speed * dt);
          b.pos.x += dx / d * sp; b.pos.z += dz / d * sp;
          if (wd) wd.resolveCircle(b.pos, P.r);
          pose.move = 1;
        } else if (best && b.rest <= 0) { b.mode = 'atk'; b.i = 0; b.k = 0; b.hit = false; }
      }
      animWolf(b.g, pose, dt);
    }
  }

  // Tira o que é do herói (trocou de arma, morreu, partida nova).
  dropFor(p) {
    const fx = this.beastFx.get(p); if (fx) { this.rm(fx); this.beastFx.delete(p); }
    const wf = this.whetFx.get(p); if (wf) { wf.forEach((s) => { s.removeFromParent(); dispose(s); }); this.whetFx.delete(p); }
  }
  clear() {
    for (const m of this.marks) this.rm(m.g);
    for (const q of this.puddles) this.rm(q.g);
    for (const q of this.traps) this.rm(q.g);
    this.traps.length = 0;
    for (const t of this.tigers) this.rm(t.g);
    for (const b of this.beasts) this.rm(b.g);
    for (const o of this.outlines.values()) removeOutline(o);
    this.marks.length = 0; this.puddles.length = 0; this.tigers.length = 0; this.beasts.length = 0;
    this.outlines.clear();
    for (const p of this.c.players) { if (p.clawAir && p.clawAir.kind === 'mount') clawLeave(p); }
  }
}
