// Bênçãos novas da Besta de Mão do Ladino (lista do dono, 07/11/2026): as regras. O visual está em boltprops.js.
// O combate cria o kit (combat.bolt) e chama tick/afterMove/clear/lureFor; rogue.js chama onFire/flyTick/wallBounce/
// shieldRico/onHit/onGround/fakeEnd/groundTick/onPick; player.js chama boltPlayerTick/boltPress/boltHoldCheck/
// boltRollShot/boltOverride/boltKicks/boltAbility/boltStateTick/boltReset.
// Besta: 1 virote (Aljava: +1), dano alto, o virote fica no chão até ser pego. Itens "fake" (Divisor, Eco, torre)
// são virotes extras: acertam igual, mas somem quando param (não viram munição).
import * as THREE from 'three';
import { audio } from './audio.js';
import { makeRogueShot, BOLT } from './rogue.js';
import { reloadBar, setReloadBar, hookMesh, Ropes, laserLine, setLaser, netMesh, stake, bearTrap, setTrapOpen, bellMesh,
  flame, smokeDisc, turretMesh, rainMarker, nailBolt, boltMesh, glowSprite, divineSpirit, animDivine, divineArrow, dispose } from './boltprops.js';

export const BES = {
  reload: { dur: 1.0, a: 0.55, b: 0.78, mul: 1.6, speed: 3, jam: 0.7 },   // Recarga Perfeita (faixa dourada de 55% a 78%)
  auto: { range: 22 },                                                   // Recarga no Pulo
  echo: { range: 18, mul: 0.7, max: 4 },                                 // Eco do Tiro
  hook: { speed: 42, range: 15, pull: 30, cd: 0.5, dmg: 6, daze: 0.6, maxT: 1.0 }, // Gancho
  recoil: { dist: 3.2, time: 0.2 },                                      // Recuo
  nail: { t: 2, boss: 0.8, scan: 2.6 },                                  // Prego
  net: { r: 2.4, t: 2, boss: 0.8 },                                      // Rede
  anchor: { r: 2.0, t: 6, boss: 3 },                                     // Âncora (07/11 noite: o dobro do tempo)
  trap: { r: 0.8, t: 2.5, boss: 1, dmg: 8 },                             // Armadilha de Urso
  bell: { r: 11, t: 2, cd: 3.5 },                                        // Sino
  split: { at: 6, spread: 15, mul: 0.6 },                                // Virote Divisor (depois de 6 de voo, ±15°)
  bounce: 18,                                                            // Quique na Parede / Ricochete no Escudo (alcance)
  rico: 3,                                                               // Ricochete no Escudo: até 3 escudos por tiro
  fire: { every: 0.7, t: 3, r: 0.75, dps: 6, burn: 1.5 },                // Rastro Incendiário
  rain: { hold: 0.3, delay: 1, r: 3, n: 14, spread: 0.5, dmg: 10, hitR: 0.85, range: 18, pose: 0.45 }, // Chuva de Virotes
  roulette: { every: 5, freeze: 1.5, burn: 3, burnDps: 8, chain: 3, smoke: 3 }, // Roleta
  sniper: { still: 1.5, stun: 2, boss: 0.8 },                            // Mira de Atirador
  smoke: { r: 2.8, t: 4, lose: 0.8 },                                    // Bomba de Fumaça
  turret: { t: 5, cd: 10, every: 0.7, range: 18, mul: 0.5 },             // Besta Montada
  divine: { mul: 0.5, mark: 5, more: 0.15, life: 1.1, back: 0.35, scale: 1.3 },       // Divindade: flecha espectral (metade do dano), marca +15% por 5 s
  steal: { pick: 0.9 },                                                  // Golpe Baixo: distância para pegar a arma de volta
};
const ELEMS = [
  { id: 'ice', name: 'Gelo', color: 0x9fe8ff },
  { id: 'fire', name: 'Fogo', color: 0xff6a2a },
  { id: 'zap', name: 'Raio', color: 0xfff06a },
  { id: 'smoke', name: 'Fumaça', color: 0xb8bcc8 },
];
const KICK = { clip: 'Melee_Unarmed_Attack_Kick', speed: 1.5, hit: 0.38, end: 0.72, window: 0.45, lunge: 0.35, damage: 9, pushMul: 1.8, boltKick: true };
const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const isBesta = (p) => !!(p && p.heroId === 'rogue' && p.hero && p.hero.weaponId === 'besta');
const has = (p, k) => isBesta(p) && !!W(p)[k];
let K = null;

// ---------- Herói (player.js) ----------

// A cada quadro, antes do estado: barrinha de recarga, besta travada, recuo, mira parada, rolagem.
// Pode "comer" o clique do ataque (p.bEat): aí o herói não ataca neste quadro.
export function boltPlayerTick(p, dt, input, camera, world, moving) {
  p.bEat = false;
  if (p.bChan && p.state !== 'dodge') p.bChan = null;
  if (!K || !isBesta(p)) return;
  K.playerTick(p, dt, input, camera, world, moving);
}
// Gancho: atacar sem virote na mão (true = saiu o gancho).
export function boltPress(p, camera) {
  if (!K || !has(p, 'bHook') || p.bTurret || (p.ammo && p.ammo.length) || p.bHookCd > 0) return false;
  return K.startHook(p, camera);
}
// Chuva de Virotes: segurando o ataque enquanto a besta arma (true = virou a chuva).
export function boltHoldCheck(p, input, camera) {
  if (!K || !has(p, 'bRain') || p.hitDone || (p.xstep && p.xstep.boltKick)) return false;
  const step = p.xstep || p.hero.combo[p.combo];
  if (!step || !step.throw || p.stateTime < BES.rain.hold || !(input.attackHeld && input.attackHeld())) return false;
  return K.startRain(p, camera);
}
// Tiro Acrobático (refeito 07/11 noite): rolar não interrompe a besta armando. No começo do rolamento guarda
// quanto do disparo já foi carregado; durante o rolamento continua carregando e atira quando chegar no ponto
// do disparo. Se o rolamento acabar antes, o ataque continua de onde parou.
export function boltRollSave(p) {
  p.bChan = null;
  if (!K || !has(p, 'bRollShot') || p.state !== 'attack' || p.hitDone || p.bTurret) return;
  const step = p.xstep || p.hero.combo[p.combo];
  const clip = p.anim.current && p.anim.current.getClip();
  if (!step || step.throw !== 'bolt' || !clip || !(p.ammo && p.ammo.length)) return;
  p.bChan = { step, xs: p.xstep || null, prog: p.anim.progress(), dur: clip.duration, speed: step.speed * (p.atkSpeed || 1) };
  K.log({ type: 'bChanSave', prog: p.bChan.prog });
}
export function boltRollShot(p, dt, camera) {
  const C = p.bChan;
  if (!C || !K) return false;
  C.prog += dt * C.speed / C.dur;
  if (C.prog < C.step.hit) return false;
  p.bChan = null;
  if (!(p.ammo && p.ammo.length)) return false;
  K.rk.fire(p, C.step, p.aimAngle(camera), 'roll');
  K.c.text.add('Tiro Acrobático!', p.position, 'crit', 3);
  K.log({ type: 'bRollShot' });
  return true;
}
// Fim do rolamento com o disparo ainda carregando: o ataque continua de onde parou (true = continuou).
export function boltRollResume(p, camera) {
  const C = p.bChan;
  p.bChan = null;
  if (!C || !K || !(p.ammo && p.ammo.length)) return false;
  if (p.startAttack(camera, C.xs) === false) return false;
  if (p.anim.current) p.anim.current.time = Math.min(C.prog, C.step.hit - 0.01) * C.dur;
  K.log({ type: 'bChanResume', prog: C.prog });
  return true;
}
// Golpe próprio: chutes (torre montada) ou o tiro da Recarga Perfeita (rápido e forte).
export function boltOverride(p) {
  if (!K || !isBesta(p)) return null;
  if (p.bTurret) return KICK;
  if (p.bPerfect && p.ammo && p.ammo.length) {
    const st = p.hero.combo[0];
    return { ...st, speed: st.speed * BES.reload.speed, damage: st.damage * BES.reload.mul, perfect: true };
  }
  return null;
}
export const boltKicks = (p) => !!(K && isBesta(p) && p.bTurret);
export const boltHasAbility = (p) => !!K && has(p, 'bTurret');
// Botão direito: Besta Montada (null = não tem a bênção).
export function boltAbility(p) {
  if (!K || !has(p, 'bTurret')) return null;
  return K.mountTurret(p);
}
// Estados próprios: boltHook (Gancho), boltRain (disparo para o alto). Devolve 'end' ou nada.
export function boltStateTick(p, dt, world) {
  if (!K) return 'end';
  if (p.state === 'boltHook') return K.hookTick(p, dt, world);
  if (p.state === 'boltRain') return p.stateTime >= BES.rain.pose ? 'end' : null;
  return 'end';
}
// Troca de arma/herói, partida nova.
export function boltReset(p) {
  if (K) K.dropFor(p);
  p.bBar = null; p.bJam = 0; p.bPerfect = false; p.bRecoil = null; p.bStill = 0; p.bAim = false; p.bRollFired = false;
  p.bHook = null; p.bHookCd = 0; p.bChan = null; p.bShotN = 0; p.bRoul = null; p.bTurret = null; p.bTurretCd = 0; p.bBellCd = 0; p.bEat = false;
  if (p.weapon) p.weapon.visible = true;
}

export class BoltKit {
  constructor(c) {
    this.c = c; K = this;
    this.scene = c.scene;
    this.time = 0;
    this.flames = []; this.nets = []; this.anchors = []; this.nails = []; this.bells = []; this.clouds = []; this.rains = []; this.drops = [];
    this.steals = []; this.spirits = []; this.divMarks = new Map();
    this.holds = new Map(); // inimigo preso (rede, prego, armadilha): fica parado no lugar
    this.ropes = new Ropes(this.scene);
    this.room = undefined;
    this.burnCd = 0;
  }
  get rk() { return this.c.rogue; }
  log(o) { if (this.c.log) this.c.log(o); }
  dmg(p, n) { return Math.max(1, Math.round(n * ((p && p.stats && p.stats.damageMul) || 1))); }
  rm(o) { if (o) { o.removeFromParent(); dispose(o); } }
  foes() { return this.c.enemies.filter((e) => e.targetable && !e.undead && !(e.data && e.data.phantom)); }
  near(x, z, r, skip = null) {
    let best = null, bd = r;
    for (const e of this.foes()) {
      if (skip && (skip.has ? skip.has(e) : skip === e)) continue;
      const d = Math.hypot(e.position.x - x, e.position.z - z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  hold(e, t) { // prende no lugar (sem empurrão) por t segundos
    const h = this.holds.get(e);
    this.holds.set(e, { x: e.position.x, z: e.position.z, t: Math.max(t, h ? h.t : 0) });
    if (e.vel) e.vel.set(0, 0, 0);
  }
  stunFor(e, t, boss) { const tt = e.data.boss ? boss : t; e.daze(tt); return tt; }
  wallAt(x, z) { const w = this.c.world; return !!(w && w.blocked(x, z, 0.05)); }

  // ---------- Disparo (rogue.fire) ----------
  // src: 'shot' (ataque normal), 'roll' (Tiro Acrobático), 'auto' (Recarga no Pulo).
  onFire(p, it, src) {
    if (!isBesta(p)) return;
    const w = W(p);
    it.src = src;
    if (it.step && it.step.perfect) { p.bPerfect = false; this.tint(it, 0xffd24a); this.log({ type: 'bPerfectShot' }); }
    if (src === 'shot' && p.bAim) { // Mira de Atirador: atravessa tudo
      p.bAim = false; p.bStill = 0;
      it.sniper = true; it.pierce = 99;
      this.tint(it, 0xff4040);
      this.c.text.add('Tiro certeiro!', p.position, 'crit', 3.2);
      this.log({ type: 'bSniperShot' });
    }
    if (w.bRoulette) { // Roleta: a cada 5 tiros, o próximo é especial
      if (p.bRoul) { it.elem = p.bRoul; p.bRoul = null; p.bShotN = 0; this.tint(it, it.elem.color); this.log({ type: 'bRouletteShot', elem: it.elem.id }); }
      else if (++p.bShotN >= BES.roulette.every) {
        p.bRoul = ELEMS[Math.floor(Math.random() * ELEMS.length)];
        this.c.text.add(`Roleta: ${p.bRoul.name}!`, p.position, 'crit', 3.4);
        this.log({ type: 'bRouletteArm', elem: p.bRoul.id });
      }
    }
    if (src === 'shot' && w.bReload) { // Recarga Perfeita: barrinha
      if (!p.bBarG) { p.bBarG = reloadBar(BES.reload.a, BES.reload.b); this.scene.add(p.bBarG); }
      p.bBar = { t: 0, done: false, end: 0 };
      setReloadBar(p.bBarG, 0, 'reset'); p.bBarG.userData.zone.material.color.setHex(0xffc83a); p.bBarG.userData.cur.material.color.setHex(0xffffff); p.bBarG.userData.bg.material.color.setHex(0x14100c);
      p.bBarG.visible = true;
    }
    if (w.bDivine) this.divine(p, it); // Divindade: a entidade atira junto
    if (src === 'shot' && w.bRecoil) { // Recuo
      p.bRecoil = { t: BES.recoil.time, x: -Math.sin(it.a), z: -Math.cos(it.a) };
      this.log({ type: 'bRecoil' });
    }
  }
  // ---------- Divindade ----------
  divine(p, it) {
    const D = BES.divine, a = it.a;
    const g = divineSpirit(); g.scale.setScalar(D.scale); // o Ladino fica dentro do peito da entidade
    g.position.set(p.position.x - Math.sin(a) * D.back, 0, p.position.z - Math.cos(a) * D.back); g.rotation.y = a;
    this.scene.add(g);
    this.spirits.push({ g, t: 0, p, a });
    // a flecha de luz sai junto com o virote, na mesma direção
    const f = this.spawnShot(p, p.position.x + Math.sin(a) * 0.4, p.position.z + Math.cos(a) * 0.4, a, { dmg: it.step.damage * D.mul, pierce: 99, speed: 1.15, life: 2.5 });
    f.divine = true;
    f.g.visible = false; // no lugar do modelo do virote, uma flecha de luz roxa
    f.fx = divineArrow(); f.fx.userData.it = f; this.scene.add(f.fx); f.fx.position.set(f.x, 2.0, f.z); f.fx.rotation.y = a;
    audio.play('zap', p.position.x, p.position.z, { v: 0.5 });
    this.log({ type: 'bDivine' });
  }
  divMark(e) {
    const was = e.bDivT > 0;
    e.bDivT = BES.divine.mark;
    if (!this.divMarks.has(e)) { const s = glowSprite(0xb060ff, 1.1, 0.75); this.scene.add(s); this.divMarks.set(e, s); }
    if (!was) this.c.text.add('Marcado!', e.position, 'crit', 3);
  }
  tickDivine(dt) {
    const D = BES.divine;
    for (let i = this.spirits.length - 1; i >= 0; i--) {
      const s = this.spirits[i], p = s.p;
      s.t += dt;
      s.g.position.x += (p.position.x - Math.sin(s.a) * D.back - s.g.position.x) * Math.min(1, dt * 10); // segue o Ladino por trás
      s.g.position.z += (p.position.z - Math.cos(s.a) * D.back - s.g.position.z) * Math.min(1, dt * 10);
      animDivine(s.g, s.t / D.life, this.time);
      if (s.t >= D.life) { this.rm(s.g); this.spirits.splice(i, 1); }
    }
    for (const [e, sp] of this.divMarks) {
      e.bDivT -= dt;
      if (e.bDivT <= 0 || !e.alive) { e.bDivT = 0; this.rm(sp); this.divMarks.delete(e); continue; }
      sp.position.set(e.position.x, 2.9 * (e.group ? e.group.scale.y || 1 : 1), e.position.z);
      sp.material.opacity = 0.45 + 0.3 * Math.sin(this.time * 8);
    }
    // a flecha de luz acompanha o virote invisível (e some com ele)
    for (const f of this.c.scene.children.filter((o) => o.userData && o.userData.divineArrow)) {
      const it = f.userData.it;
      if (it && it.state === 'fly' && this.rk.items.includes(it)) { f.position.set(it.x, 2.0, it.z); continue; }
      f.userData.fade = (f.userData.fade || 0) + dt;
      f.traverse((o) => { if (o.material) o.material.opacity = Math.max(0, (o.userData.op ?? 1) * (1 - f.userData.fade / 0.2)); });
      if (f.userData.fade >= 0.2) this.rm(f);
    }
  }

  // ---------- Golpe Baixo ----------
  steal(it, e) {
    const wpn = e.weapons && e.weapons.find((x) => x !== e.shieldMesh && !(e.data.shield && x === e.weapons[1]));
    if (!wpn || !wpn.parent) return false;
    const rec = { e, wpn, it, parent: wpn.parent, lp: wpn.position.clone(), lq: wpn.quaternion.clone(), ls: wpn.scale.clone(), state: 'fly',
      decoy: { decoy: true, ally: true, alive: true, state: 'idle', position: v3(it.x, 0, it.z), radius: 0.3, hero: { radius: 0.3 }, facing: 0, navVel: { x: 0, z: 0 }, hit: () => {} } };
    e.weapons.splice(e.weapons.indexOf(wpn), 1);
    it.g.attach(wpn);
    e.rogueDisarmed = true; e.bStolen = rec;
    it.stolen = rec;
    it.pierce = (it.pierce || 0) + 1; // o virote segue voando com a arma
    this.steals.push(rec);
    this.c.text.add('Golpe Baixo!', e.position, 'crit', 3.3);
    audio.play('metal', e.position.x, e.position.z);
    this.log({ type: 'bSteal', enemy: e });
    return true;
  }
  tickSteals() {
    for (let i = this.steals.length - 1; i >= 0; i--) {
      const r = this.steals[i], e = r.e, it = r.it;
      if (r.state === 'fly') {
        r.decoy.position.set(it.x, 0, it.z);
        if (!(it.state === 'fly' && this.rk.items.includes(it))) { // o virote parou (ou sumiu/foi pego): a arma fica no chão ali
          this.scene.attach(r.wpn);
          r.wpn.position.set(it.x, 0.12, it.z);
          r.wpn.rotation.set(0, 0, Math.PI / 2); r.wpn.rotateX(Math.random() * 6.28);
          r.state = 'ground';
          this.log({ type: 'bStealDrop', x: it.x, z: it.z });
        }
      }
      if (!e.alive || !this.c.enemies.includes(e)) { r.decoy.alive = false; e.bStolen = null; r.wpn.removeFromParent(); this.steals.splice(i, 1); continue; }
      if (r.state !== 'ground') continue;
      const d = Math.hypot(e.position.x - r.decoy.position.x, e.position.z - r.decoy.position.z);
      if (d <= e.data.radius + Math.max(BES.steal.pick, (e.data.attackRange || 2) * 0.8)) this.giveBack(r, i);
    }
  }
  giveBack(r, i) {
    const e = r.e;
    r.parent.add(r.wpn);
    r.wpn.position.copy(r.lp); r.wpn.quaternion.copy(r.lq); r.wpn.scale.copy(r.ls);
    e.weapons.push(r.wpn);
    e.rogueDisarmed = false; e.bStolen = null;
    r.decoy.alive = false;
    this.steals.splice(i, 1);
    this.c.text.add('Pegou a arma', e.position, 'miss', 2.8);
    audio.play('metal', e.position.x, e.position.z, { v: 0.5 });
    this.log({ type: 'bStealBack', enemy: e });
  }

  tint(it, color) {
    const s = it.g && it.g.children[1];
    if (s && s.material) { s.material.color.setHex(color); s.material.opacity = 0.95; s.scale.setScalar(1.6); }
  }

  // Virote extra (Divisor, Eco, torre): não gasta munição e some quando para.
  spawnShot(p, x, z, a, o = {}) {
    const g = makeRogueShot('bolt');
    if (o.ghost) g.userData.inner.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.6; m.material.emissive = new THREE.Color(0x4ab8ff); m.material.emissiveIntensity = 0.9; } });
    g.position.set(x, 1.3, z); g.rotation.y = a;
    this.scene.add(g);
    const sp = BOLT.speed * (o.speed || 1);
    const it = { id: ++this.rk.seq, kind: 'bolt', owner: p, state: 'fly', x, z, y: 1.3, a, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp,
      life: o.life || BOLT.life, stack: 0, g, step: { damage: o.dmg, throw: 'bolt' }, sneak: false, pierce: o.pierce || 0,
      hitSet: new Set(o.skip ? [...o.skip] : []), fake: true, home: o.target || null, echoN: o.echoN || 0, src: o.src || 'fake' };
    if (o.color != null) this.tint(it, o.color);
    if (o.ghost) this.tint(it, 0x6fd8ff);
    this.rk.items.push(it);
    return it;
  }
  // Virote extra parou: some com um brilho.
  fakeEnd(it, x, z) {
    this.c.vfx.sparks(v3(x, 1.0, z), it.ghost ? 0x6fd8ff : 0xffc46a, 4);
    const i = this.rk.items.indexOf(it);
    if (i >= 0) this.rk.drop(i);
    it.state = 'gone';
  }

  // ---------- Virote voando (rogue.updateItem, antes de andar) ----------
  flyTick(it, dt) {
    const p = it.owner;
    if (!isBesta(p)) return;
    const w = W(p);
    const sp = Math.hypot(it.vx, it.vz) || 1;
    // Eco: o fantasma vira um pouco atrás do alvo.
    if (it.home && it.home.targetable) {
      const want = Math.atan2(it.home.position.x - it.x, it.home.position.z - it.z);
      const d = Math.atan2(Math.sin(want - it.a), Math.cos(want - it.a));
      it.a += Math.sign(d) * Math.min(Math.abs(d), dt * 7);
      it.vx = Math.sin(it.a) * sp; it.vz = Math.cos(it.a) * sp; it.g.rotation.y = it.a;
    }
    it.flown = (it.flown || 0) + sp * dt;
    // Virote Divisor: no meio do voo vira 3.
    if (w.bSplit && !it.fake && !it.splitDone && it.flown >= BES.split.at) {
      it.splitDone = true;
      const S = BES.split, da = S.spread * Math.PI / 180;
      for (const s of [-1, 1]) this.spawnShot(p, it.x, it.z, it.a + s * da, { dmg: it.step.damage * S.mul, skip: it.hitSet, pierce: it.sniper ? 99 : 0 });
      this.c.vfx.sparks(v3(it.x, 1.3, it.z), 0xffc46a, 8);
      audio.play('arrow', it.x, it.z, { v: 0.6 });
      this.log({ type: 'bSplit' });
    }
    // Rastro Incendiário: fogo no chão por onde passa.
    if (w.bFire) {
      it.fireD = (it.fireD || 0) + sp * dt;
      while (it.fireD >= BES.fire.every) { it.fireD -= BES.fire.every; this.addFlame(p, it.x, it.z); }
    }
  }
  addFlame(p, x, z, t = BES.fire.t) {
    if (this.wallAt(x, z)) return;
    const g = flame(); g.position.set(x, 0.35, z);
    this.scene.add(g);
    this.flames.push({ p, x, z, t, life: t, g, ph: Math.random() * 6 });
    if (this.flames.length > 260) { const f = this.flames.shift(); this.rm(f.g); }
  }

  // Quique na Parede: bateu na parede, vai direto no inimigo mais perto (true = quicou).
  wallBounce(it, dx, dz) {
    const p = it.owner;
    if (!has(p, 'bBounce') || it.bounced) return false;
    const bx = it.x - dx * 0.6, bz = it.z - dz * 0.6;
    const t = this.near(bx, bz, BES.bounce, it.hitSet);
    if (!t) return false;
    it.bounced = true; it.x = bx; it.z = bz;
    this.redirect(it, t);
    this.c.vfx.sparks(v3(it.x, 1.2, it.z), 0xffc46a, 8);
    audio.play('block', it.x, it.z, { v: 0.5 });
    this.c.text.add('Quicou!', v3(it.x, 0, it.z), 'crit', 2.8);
    this.log({ type: 'bBounce' });
    return true;
  }
  redirect(it, t) {
    const a = Math.atan2(t.position.x - it.x, t.position.z - it.z), sp = Math.hypot(it.vx, it.vz);
    it.vx = Math.sin(a) * sp; it.vz = Math.cos(a) * sp; it.a = a; it.g.rotation.y = a; it.life = Math.max(it.life, 1.5);
    it.g.position.set(it.x, it.y, it.z);
  }
  // Ricochete no Escudo: o escudo segurou o virote, ele vai para outro inimigo (true = ricocheteou).
  shieldRico(it, e) {
    const p = it.owner;
    it.bHitAny = true;
    if (!has(p, 'bShieldRico') || (it.rico || 0) >= BES.rico) return false;
    it.hitSet.add(e);
    const t = this.near(e.position.x, e.position.z, BES.bounce, it.hitSet);
    if (!t) return false;
    it.rico = (it.rico || 0) + 1;
    const sp = Math.hypot(it.vx, it.vz) || 1;
    it.x -= it.vx / sp * 0.4; it.z -= it.vz / sp * 0.4;
    this.redirect(it, t);
    this.c.vfx.sparks(v3(it.x, 1.3, it.z), 0xcfe4ff, 12);
    this.c.text.add('Ricochete!', e.position, 'crit', 3);
    this.log({ type: 'bShieldRico', from: e, to: t });
    return true;
  }

  // ---------- Virote acertou um inimigo (rogue.hitEnemy, depois do dano) ----------
  onHit(it, e, r) {
    const p = it.owner;
    if (!isBesta(p)) return;
    const w = W(p), c = this.c;
    it.bHitAny = true;
    if (r !== 'hit' && r !== 'kill') return;
    if (it.divine) { if (r === 'hit' && e.alive) this.divMark(e); this.log({ type: 'bDivineHit', enemy: e, r }); return; } // Divindade: só marca
    if (w.bSteal && !it.fake && r === 'hit' && e.alive && !it.stolen && !e.data.boss && !e.rogueDisarmed && !e.undead) this.steal(it, e); // Golpe Baixo
    const sp = Math.hypot(it.vx, it.vz) || 1, nx = it.vx / sp, nz = it.vz / sp;
    if (it.sniper && r === 'hit' && e.alive) { const t = this.stunFor(e, BES.sniper.stun, BES.sniper.boss); this.log({ type: 'bSniperStun', enemy: e, t }); }
    if (it.elem) this.elemHit(p, it.elem, e, r);
    // Eco do Tiro: matou -> fantasma no próximo.
    if (r === 'kill' && w.bEcho && (it.echoN || 0) < BES.echo.max) {
      const skip = new Set(it.hitSet); skip.add(e);
      const t = this.near(e.position.x, e.position.z, BES.echo.range, skip);
      if (t) {
        const a = Math.atan2(t.position.x - e.position.x, t.position.z - e.position.z);
        const g = this.spawnShot(p, e.position.x + Math.sin(a) * 0.6, e.position.z + Math.cos(a) * 0.6, a, { dmg: it.step.damage * BES.echo.mul, ghost: true, target: t, skip, echoN: (it.echoN || 0) + 1, speed: 0.8 });
        g.ghost = true;
        c.text.add('Eco!', e.position, 'crit', 3);
        this.log({ type: 'bEcho', to: t, n: (it.echoN || 0) + 1 });
      }
    }
    if (r !== 'hit' || !e.alive) return;
    // Prego: parede logo atrás -> pregado.
    if (w.bNail && !this.nails.some((n) => n.e === e)) {
      const R = e.data.radius;
      for (let d = 0.2; d <= BES.nail.scan; d += 0.2) {
        if (!this.wallAt(e.position.x + nx * (R + d), e.position.z + nz * (R + d))) continue;
        e.position.x += nx * Math.max(0, d - 0.15); e.position.z += nz * Math.max(0, d - 0.15);
        if (c.world) c.world.resolveCircle(e.position, R);
        e.group && e.group.position.copy(e.position);
        const t = this.stunFor(e, BES.nail.t, BES.nail.boss);
        this.hold(e, t);
        const g = nailBolt();
        g.position.set(e.position.x + nx * R * 0.6, 1.25 * (e.group.scale.y || 1), e.position.z + nz * R * 0.6);
        g.rotation.y = Math.atan2(nx, nz);
        this.scene.add(g);
        this.nails.push({ e, g, t });
        c.text.add('Pregado!', e.position, 'crit', 3.3);
        c.vfx.sparks(v3(e.position.x + nx * R, 1.3, e.position.z + nz * R), 0xffffff, 10);
        audio.play('block', e.position.x, e.position.z);
        this.log({ type: 'bNail', enemy: e, t });
        break;
      }
    }
    // Âncora: corda no chão, ele só anda em volta.
    if (w.bAnchor && !this.anchors.some((a) => a.e === e)) {
      const g = stake(); g.position.set(e.position.x, 0, e.position.z);
      this.scene.add(g);
      const t = e.data.boss ? BES.anchor.boss : BES.anchor.t;
      this.anchors.push({ e, x: e.position.x, z: e.position.z, t, g });
      c.text.add('Ancorado!', e.position, 'crit', 3);
      this.log({ type: 'bAnchor', enemy: e, t });
    }
  }
  // Roleta: efeito do virote especial no inimigo.
  elemHit(p, el, e, r) {
    const c = this.c, R = BES.roulette;
    if (el.id === 'ice' && r === 'hit' && e.alive) { if (e.data.boss) e.slow = Math.max(e.slow || 0, 2); else e.freeze(R.freeze, c); }
    if (el.id === 'fire' && r === 'hit' && e.alive) { e.burn = Math.max(e.burn || 0, R.burn); e.burnDps = Math.max(e.burnDps || 0, R.burnDps); e.burnBy = p; if (!(e.burnTick > 0)) e.burnTick = 0.5; c.text.add('Queimando!', e.position, 'burn', 3); }
    if (el.id === 'zap') { c.chainLightning(e, R.chain, p); audio.play('zap', e.position.x, e.position.z); }
    if (el.id === 'smoke') this.addCloud(p, e.position.x, e.position.z, R.smoke);
    this.log({ type: 'bElem', elem: el.id, enemy: e });
  }

  // ---------- Virote de verdade parou no chão (rogue.toGround) ----------
  onGround(it, why) {
    const p = it.owner;
    if (!isBesta(p) || it.fake) return;
    const w = W(p), miss = !it.bHitAny;
    if (w.bNet && why !== 'quiet') this.dropNet(p, it.x, it.z);
    if (w.bBell && why !== 'quiet' && !(p.bBellCd > 0)) this.ringBell(p, it.x, it.z);
    if (miss && why !== 'quiet' && it.elem) { // Roleta que errou: fumaça vira nuvem, fogo vira uma poça
      if (it.elem.id === 'smoke') this.addCloud(p, it.x, it.z, BES.roulette.smoke);
      if (it.elem.id === 'fire') for (let k = 0; k < 6; k++) this.addFlame(p, it.x + Math.sin(k) * 0.9, it.z + Math.cos(k) * 0.9);
    }
    if (!miss || why === 'quiet') return;
    if (w.bSmoke) this.addCloud(p, it.x, it.z, BES.smoke.t);
    if (w.bTrap && !it.trap) {
      it.trap = bearTrap();
      it.trap.position.set(0, -0.16, 0);
      it.g.add(it.trap);
      this.c.text.add('Armadilha!', v3(it.x, 0, it.z), 'miss', 2.6);
      this.log({ type: 'bTrapSet' });
    }
  }
  // No chão, a cada quadro (antes do dono pegar). true = item saiu da lista.
  groundTick(it, i, dt) {
    if (!it.trap || it.trapUsed) return false;
    const p = it.owner, T = BES.trap;
    for (const e of this.foes()) {
      if (Math.hypot(e.position.x - it.x, e.position.z - it.z) > T.r + e.data.radius * 0.5) continue;
      it.trapUsed = true; it.trapT = 0;
      setTrapOpen(it.trap, 0);
      e.position.x = it.x; e.position.z = it.z; e.group && e.group.position.copy(e.position);
      this.c.bonusDamage(e, this.dmg(p, T.dmg), 0, 0, 'dmg', p, true);
      const t = e.alive ? this.stunFor(e, T.t, T.boss) : 0;
      if (e.alive) this.hold(e, t);
      it.trapHold = t;
      this.c.text.add('Preso!', e.position, 'crit', 3.2);
      this.c.vfx.sparks(v3(it.x, 0.5, it.z), 0xd0d4dc, 12);
      audio.play('spikes', it.x, it.z, { v: 1.3 });
      this.log({ type: 'bTrap', enemy: e, t });
      break;
    }
    return false;
  }
  // Pegou do chão (rogue.pickUp): Recarga no Pulo.
  onPick(p, it) {
    if (it.trap) { it.g.remove(it.trap); dispose(it.trap); it.trap = null; }
    if (!has(p, 'bAuto') || !(p.ammo && p.ammo.length) || p.bTurret || it.src === 'auto') return; // o virote do tiro automático não atira de novo (sem metralhadora parada)
    const t = this.near(p.position.x, p.position.z, BES.auto.range);
    if (!t) return;
    const a = Math.atan2(t.position.x - p.position.x, t.position.z - p.position.z);
    p.facing = a; p.group.rotation.y = a;
    this.rk.fire(p, p.hero.combo[0], a, 'auto');
    this.c.text.add('Recarga no Pulo!', p.position, 'crit', 3);
    this.log({ type: 'bAuto', target: t });
  }

  // ---------- Rede / sino / fumaça ----------
  dropNet(p, x, z) {
    const N = BES.net, g = netMesh(N.r);
    g.position.set(x, 2.2, z); g.scale.setScalar(0.3);
    this.scene.add(g);
    let n = 0;
    for (const e of this.foes()) {
      if (Math.hypot(e.position.x - x, e.position.z - z) > N.r + e.data.radius * 0.5) continue;
      const t = this.stunFor(e, N.t, N.boss);
      this.hold(e, t); n++;
    }
    this.nets.push({ g, t: N.t + 0.4, life: N.t + 0.4 });
    audio.play('swing', x, z, { v: 1.1 });
    if (n) this.c.text.add(n > 1 ? `Rede! ×${n}` : 'Rede!', v3(x, 0, z), 'crit', 3.2);
    this.log({ type: 'bNet', n });
  }
  ringBell(p, x, z) {
    const B = BES.bell, g = bellMesh();
    g.position.set(x, 0, z);
    this.scene.add(g);
    const pos = v3(x, 0, z);
    const decoy = { decoy: true, ally: true, alive: true, state: 'idle', position: pos, radius: 0.4, hero: { radius: 0.4 }, facing: 0, navVel: { x: 0, z: 0 },
      hit: () => { this.c.vfx.sparks(v3(x, 1.4, z), 0xffd060, 5); audio.play('bell', x, z, { v: 0.4 }); } };
    const set = new Set();
    for (const e of this.foes()) if (!e.data.boss && Math.hypot(e.position.x - x, e.position.z - z) <= B.r) set.add(e);
    this.bells.push({ p, g, t: B.t, decoy, set, ring: 0 });
    p.bBellCd = B.cd;
    audio.play('bell', x, z);
    this.c.text.add('Dlim-dlom!', pos, 'crit', 3);
    this.log({ type: 'bBell', n: set.size });
  }
  lureFor(e) {
    if (e.bStolen && e.bStolen.decoy.alive) return e.bStolen.decoy; // Golpe Baixo: vai buscar a arma
    for (const b of this.bells) if (b.t > 0 && b.set.has(e)) return b.decoy;
    return null;
  }
  addCloud(p, x, z, t) {
    const S = BES.smoke, g = smokeDisc(S.r);
    g.position.set(x, 0.06, z);
    this.scene.add(g);
    this.clouds.push({ p, x, z, t, life: t, g, puff: 0, lost: new Map() });
    this.c.vfx.smoke(v3(x, 0.4, z), 0x8a8f9c, 16);
    audio.play('dodge', x, z, { v: 1.2 });
    this.log({ type: 'bSmoke' });
  }

  // ---------- Gancho ----------
  startHook(p, camera) {
    const a = p.aimAngle(camera);
    p.facing = a; p.group.rotation.y = a;
    p.setState('boltHook');
    p.combo = 0; p.queued = false;
    p.anim.play('Throw', { once: true, restart: true, speed: 2.4, fade: 0.05 });
    const g = hookMesh(); g.rotation.y = a;
    this.scene.add(g);
    p.bHook = { phase: 'fly', a, x: p.position.x + Math.sin(a) * 0.8, z: p.position.z + Math.cos(a) * 0.8, d: 0, t: 0, g, e: null, ax: 0, az: 0, stuck: 0 };
    g.position.set(p.bHook.x, 1.3, p.bHook.z);
    audio.play('swing', p.position.x, p.position.z, { v: 1.1 });
    this.log({ type: 'bHook' });
    return true;
  }
  hookTick(p, dt, world) {
    const H = BES.hook, h = p.bHook;
    if (!h) return 'end';
    h.t += dt;
    if (h.phase === 'fly') {
      let left = H.speed * dt;
      while (left > 0 && h.phase === 'fly') {
        const st = Math.min(0.3, left); left -= st;
        h.x += Math.sin(h.a) * st; h.z += Math.cos(h.a) * st; h.d += st;
        const e = this.near(h.x, h.z, 1.4);
        if (e && Math.hypot(e.position.x - h.x, e.position.z - h.z) < e.data.radius + 0.35) { h.phase = 'pull'; h.e = e; h.t = 0; break; }
        if (this.wallAt(h.x, h.z)) { h.x -= Math.sin(h.a) * 0.4; h.z -= Math.cos(h.a) * 0.4; h.phase = 'pull'; h.t = 0; break; }
        if (h.d >= H.range) { h.phase = 'back'; h.t = 0; }
      }
      if (h.phase === 'pull') {
        this.c.vfx.sparks(v3(h.x, 1.3, h.z), 0xcfe4ff, 8);
        audio.play('block', h.x, h.z, { v: 0.6 });
        p.anim.play('Jump_Idle', { fade: 0.08 });
        this.c.text.add(h.e ? 'Fisgou!' : 'Gancho!', p.position, 'crit', 3);
        this.log({ type: 'bHookCatch', enemy: h.e });
      }
    } else if (h.phase === 'pull') {
      if (h.e && h.e.alive) { h.x = h.e.position.x; h.z = h.e.position.z; }
      const dx = h.x - p.position.x, dz = h.z - p.position.z, d = Math.hypot(dx, dz);
      const stop = h.e ? h.e.data.radius + p.hero.radius + 0.3 : p.hero.radius + 0.5;
      p.iframes = Math.max(p.iframes || 0, 0.15);
      p.facing = Math.atan2(dx, dz); p.group.rotation.y = p.facing;
      if (d > stop) {
        const ox = p.position.x, oz = p.position.z;
        p.move(dx / d, dz / d, Math.min(d - stop, H.pull * dt), world);
        h.stuck = Math.hypot(p.position.x - ox, p.position.z - oz) < 0.02 ? h.stuck + 1 : 0;
      }
      if (d <= stop + 0.05 || h.t >= H.maxT || h.stuck >= 4) {
        if (h.e && h.e.alive && d <= stop + 0.6) {
          this.c.bonusDamage(h.e, this.dmg(p, H.dmg), dx / (d || 1), dz / (d || 1), 'dmg', p);
          if (h.e.alive && !h.e.data.boss) h.e.daze(H.daze);
        }
        this.log({ type: 'bHookArrive', d });
        return this.endHook(p);
      }
    } else if (h.phase === 'back') {
      const hx = p.position.x + Math.sin(h.a) * 0.8, hz = p.position.z + Math.cos(h.a) * 0.8;
      h.x += (hx - h.x) * Math.min(1, dt * 14); h.z += (hz - h.z) * Math.min(1, dt * 14);
      if (h.t >= 0.25) return this.endHook(p);
    }
    h.g.position.set(h.x, 1.3, h.z);
    return null;
  }
  endHook(p) {
    if (p.bHook) this.rm(p.bHook.g);
    p.bHook = null; p.bHookCd = BES.hook.cd;
    return 'end';
  }

  // ---------- Chuva de Virotes ----------
  startRain(p, camera) {
    const c = this.rk.takeCharge(p);
    if (!c) return false;
    const R = BES.rain, to = v3(0, 0, 0);
    let ok = false;
    if (camera && p.ctl && p.ctl.aimPoint && p.ctl.aimPoint(camera, to)) ok = Math.hypot(to.x - p.position.x, to.z - p.position.z) <= R.range;
    if (!ok) { const a = p.aimAngle(camera); to.set(p.position.x + Math.sin(a) * 9, 0, p.position.z + Math.cos(a) * 9); }
    if (this.c.world) { if (this.c.world.clampInside) this.c.world.clampInside(to, 1); this.c.world.resolveCircle(to, 0.8); }
    p.facing = Math.atan2(to.x - p.position.x, to.z - p.position.z); p.group.rotation.y = p.facing;
    p.setState('boltRain'); p.combo = 0; p.queued = false;
    p.anim.play('Ranged_1H_Shoot', { once: true, restart: true, speed: 2.2, fade: 0.05 });
    const up = boltMesh(0xffc46a); up.rotation.x = -Math.PI / 2; up.position.set(p.position.x, 1.6, p.position.z);
    this.scene.add(up);
    const mk = rainMarker(R.r); mk.position.set(to.x, 0, to.z); this.scene.add(mk);
    this.rains.push({ p, x: to.x, z: to.z, t: 0, up, mk, n: 0, done: false });
    audio.play('arrow', p.position.x, p.position.z, { v: 1.3 });
    this.c.text.add('Chuva de Virotes!', p.position, 'crit', 3.4);
    this.log({ type: 'bRain', x: to.x, z: to.z });
    return true;
  }
  rainTick(dt) {
    const R = BES.rain;
    for (let i = this.rains.length - 1; i >= 0; i--) {
      const r = this.rains[i];
      r.t += dt;
      if (r.up) { r.up.position.y += dt * 30; if (r.up.position.y > 16) { this.rm(r.up); r.up = null; } }
      const k = Math.min(1, r.t / R.delay);
      r.mk.userData.fill.material.opacity = 0.1 + 0.25 * k * (0.6 + 0.4 * Math.sin(r.t * 18));
      r.mk.userData.ring.scale.setScalar(1.15 - 0.15 * k);
      if (r.t >= R.delay) { // virotes caindo
        const want = Math.min(R.n, Math.floor((r.t - R.delay) / R.spread * R.n) + 1);
        while (r.n < want) {
          r.n++;
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R.r;
          const g = boltMesh(0xffc46a); g.rotation.x = Math.PI / 2;
          const x = r.x + Math.sin(a) * d, z = r.z + Math.cos(a) * d;
          g.position.set(x, 11, z); this.scene.add(g);
          this.drops.push({ p: r.p, g, x, z, y: 11, real: r.n === R.n });
        }
        if (r.n >= R.n && !r.done) { r.done = true; }
      }
      if (r.done && r.t >= R.delay + R.spread + 0.5) { this.rm(r.mk); if (r.up) this.rm(r.up); this.rains.splice(i, 1); }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.y -= dt * 42; d.g.position.y = Math.max(0.3, d.y);
      if (d.y > 0.3) continue;
      this.rm(d.g); this.drops.splice(i, 1);
      this.c.vfx.dust(v3(d.x, 0.1, d.z), v3(0, 0, 1), 3);
      let n = 0;
      for (const e of this.foes()) {
        const dx = e.position.x - d.x, dz = e.position.z - d.z, dd = Math.hypot(dx, dz);
        if (dd > BES.rain.hitR + e.data.radius * 0.5) continue;
        this.c.bonusDamage(e, this.dmg(d.p, BES.rain.dmg), dx / (dd || 1), dz / (dd || 1), 'dmg', d.p); n++;
      }
      if (n) this.log({ type: 'bRainHit', n });
      audio.play('arrow', d.x, d.z, { v: 0.4 });
      if (d.real && d.p && this.c.players.includes(d.p)) this.dropReal(d.p, d.x, d.z); // o virote do Ladino fica no chão
    }
  }
  // Põe um virote de verdade do Ladino no chão (para pegar de volta).
  dropReal(p, x, z) {
    const g = makeRogueShot('bolt');
    this.scene.add(g);
    const it = { id: ++this.rk.seq, kind: 'bolt', owner: p, state: 'fly', x, z, y: 1, a: p.facing, vx: 0, vz: 1, life: 0, stack: 0, g, step: p.hero.combo[0], sneak: false, pierce: 0, hitSet: new Set(), bHitAny: true };
    this.rk.items.push(it);
    this.rk.toGround(it, x, z, false, 'rain');
  }

  // ---------- Besta Montada ----------
  mountTurret(p) {
    const T = BES.turret;
    if (p.bTurret) return false;
    if (p.bTurretCd > 0) {
      if (!(p.bTurretWarn > 0)) { this.c.text.add(`Besta em ${Math.ceil(p.bTurretCd)} s`, p.position, 'miss', 3); p.bTurretWarn = 0.8; }
      return false;
    }
    const at = v3(p.position.x + Math.sin(p.facing) * 1.1, 0, p.position.z + Math.cos(p.facing) * 1.1);
    if (this.c.world) this.c.world.resolveCircle(at, 0.5);
    const g = turretMesh(); g.position.copy(at); g.userData.head.rotation.y = p.facing;
    this.scene.add(g);
    p.bTurret = { x: at.x, z: at.z, t: T.t, shot: 0.35, g, a: p.facing };
    p.bTurretCd = T.cd;
    if (p.weapon) p.weapon.visible = false;
    this.c.vfx.puff(v3(at.x, 0.3, at.z));
    audio.play('block', at.x, at.z);
    this.c.text.add('Besta montada!', p.position, 'crit', 3.3);
    this.log({ type: 'bTurret' });
    return true;
  }
  turretTick(p, dt) {
    const T = BES.turret, tu = p.bTurret;
    tu.t -= dt; tu.shot -= dt;
    const e = this.near(tu.x, tu.z, T.range);
    if (e) {
      const want = Math.atan2(e.position.x - tu.x, e.position.z - tu.z);
      const d = Math.atan2(Math.sin(want - tu.a), Math.cos(want - tu.a));
      tu.a += Math.sign(d) * Math.min(Math.abs(d), dt * 12);
      if (tu.shot <= 0 && Math.abs(d) < 0.3) {
        tu.shot = T.every;
        this.spawnShot(p, tu.x + Math.sin(tu.a) * 0.9, tu.z + Math.cos(tu.a) * 0.9, tu.a, { dmg: p.hero.combo[0].damage * T.mul, color: 0xffc46a, src: 'turret' });
        audio.play('arrow', tu.x, tu.z, { v: 0.7 });
        tu.g.userData.head.position.y = 1.08; // tranco do tiro
        this.log({ type: 'bTurretShot', enemy: e });
      }
    }
    tu.g.userData.head.position.y += (1.15 - tu.g.userData.head.position.y) * Math.min(1, dt * 10);
    tu.g.userData.head.rotation.y = tu.a;
    tu.g.userData.ring.material.opacity = 0.25 + 0.25 * Math.sin(this.time * 6);
    if (tu.t <= 0) this.unmount(p);
  }
  unmount(p) {
    const tu = p.bTurret;
    if (!tu) return;
    this.c.vfx.puff(v3(tu.x, 0.3, tu.z));
    this.rm(tu.g);
    p.bTurret = null;
    if (p.weapon) p.weapon.visible = true;
    if (p.state === 'attack' && p.xstep && p.xstep.boltKick) { /* o chute termina sozinho */ }
    this.c.text.add('Besta de volta!', p.position, 'miss', 2.8);
    this.log({ type: 'bTurretEnd' });
  }

  // ---------- Herói, a cada quadro ----------
  playerTick(p, dt, input, camera, world, moving) {
    const w = W(p), c = this.c;
    p.bHookCd = Math.max(0, (p.bHookCd || 0) - dt);
    p.bBellCd = Math.max(0, (p.bBellCd || 0) - dt);
    p.bTurretCd = Math.max(0, (p.bTurretCd || 0) - dt);
    p.bTurretWarn = Math.max(0, (p.bTurretWarn || 0) - dt);
    if (p.state !== 'dodge') p.bRollFired = false;
    if (p.state === 'dead') { if (p.bTurret) this.unmount(p); if (p.bBarG) p.bBarG.visible = false; p.bBar = null; return; }
    if (p.bTurret) this.turretTick(p, dt);
    // Besta travada (errou a faixa): o ataque não sai.
    if (p.bJam > 0) {
      p.bJam -= dt;
      if (input.attack && input.attack()) { p.bEat = true; if (!(p.bJamTxt > 0)) { c.text.add('Travada!', p.position, 'miss', 2.6); p.bJamTxt = 0.5; } }
    }
    p.bJamTxt = Math.max(0, (p.bJamTxt || 0) - dt);
    // Recarga Perfeita: a barrinha corre; apertar o ataque nela = tentativa de recarga.
    const B = p.bBar;
    if (B && p.bBarG) {
      const R = BES.reload;
      B.t += dt;
      const k = Math.min(1, B.t / R.dur);
      p.bBarG.position.set(p.position.x, 3.4, p.position.z);
      if (!B.done) {
        setReloadBar(p.bBarG, k);
        if (input.attack && input.attack() && !p.bEat) {
          p.bEat = true; B.done = true; B.end = B.t;
          if (k >= R.a && k <= R.b) {
            p.bPerfect = true;
            setReloadBar(p.bBarG, k, 'ok');
            c.text.add('Recarga perfeita!', p.position, 'crit', 3.4);
            c.vfx.sparks(v3(p.position.x, 1.5, p.position.z), 0xffd24a, 14);
            audio.play('reload', p.position.x, p.position.z);
            if (p.state === 'attack' && p.hitDone) { p.combo = 0; p.queued = false; p.setState('idle'); p.anim.play('Ranged_1H_Reload', { once: true, restart: true, speed: 3, fade: 0.05, onFinish: () => { if (p.state === 'idle') p.anim.play(p.hero.anims.idle, { fade: 0.1 }); } }); }
            this.log({ type: 'bReloadOk', k });
          } else {
            p.bJam = R.jam;
            setReloadBar(p.bBarG, k, 'bad');
            c.text.add('Travou!', p.position, 'miss', 3.2);
            c.vfx.smoke(v3(p.position.x, 1.4, p.position.z), 0x6a6a6a, 5);
            audio.play('jam', p.position.x, p.position.z);
            this.log({ type: 'bReloadJam', k });
          }
        }
        if (k >= 1 && !B.done) { B.done = true; B.end = B.t; this.log({ type: 'bReloadMiss' }); }
      }
      if (B.done && B.t - B.end > 0.35) { p.bBar = null; p.bBarG.visible = false; }
    }
    // Recuo: o tiro joga o Ladino para trás.
    if (p.bRecoil) {
      const R = BES.recoil, st = Math.min(dt, p.bRecoil.t);
      p.bRecoil.t -= dt;
      if (st > 0) p.move(p.bRecoil.x, p.bRecoil.z, R.dist / R.time * st, world);
      if (p.bRecoil.t <= 0) p.bRecoil = null;
    }
    // Mira de Atirador: parado 1,5 s com virote na mão.
    if (w.bSniper) {
      const still = !moving && (p.state === 'idle' || (p.state === 'attack' && !p.hitDone)) && p.ammo && p.ammo.length && !p.bTurret;
      if (moving || !(p.ammo && p.ammo.length) || p.bTurret) { p.bStill = 0; if (p.bAim) { p.bAim = false; this.log({ type: 'bSniperLost' }); } }
      else if (still) {
        p.bStill = (p.bStill || 0) + dt;
        if (!p.bAim && p.bStill >= BES.sniper.still) { p.bAim = true; c.text.add('Na mira!', p.position, 'crit', 3); audio.play('reload', p.position.x, p.position.z, { v: 0.6 }); this.log({ type: 'bSniperReady' }); }
      }
      if (p.bAim) {
        if (!p.bLaser) { p.bLaser = laserLine(); this.scene.add(p.bLaser); }
        const a = p.state === 'attack' ? p.facing : p.aimAngle(camera);
        let len = 0.8;
        while (len < 30 && !this.wallAt(p.position.x + Math.sin(a) * len, p.position.z + Math.cos(a) * len)) len += 0.4;
        setLaser(p.bLaser, p.position.x + Math.sin(a) * 0.6, p.position.z + Math.cos(a) * 0.6, a, len - 0.6, this.time);
        p.bLaser.visible = true;
      } else if (p.bLaser) p.bLaser.visible = false;
    } else if (p.bLaser) p.bLaser.visible = false;
  }

  // ---------- A cada quadro (combat.update) ----------
  tick(dt) {
    this.time += dt;
    const rv = this.rk ? this.rk.room : undefined;
    if (rv !== this.room) { this.room = rv; this.clearRoom(); }
    // Fogo no chão: queima quem pisa.
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i];
      f.t -= dt;
      const k = Math.max(0, f.t / f.life);
      f.g.material.opacity = Math.min(0.85, k * 2) * (0.7 + 0.3 * Math.sin(this.time * 17 + f.ph));
      f.g.scale.setScalar(0.8 + 0.35 * Math.sin(this.time * 11 + f.ph));
      if (f.t <= 0) { this.rm(f.g); this.flames.splice(i, 1); }
    }
    this.burnCd -= dt;
    if (this.burnCd <= 0 && this.flames.length) {
      this.burnCd = 0.25;
      const F = BES.fire;
      for (const e of this.foes()) {
        const f = this.flames.find((q) => Math.hypot(q.x - e.position.x, q.z - e.position.z) <= F.r + e.data.radius * 0.5);
        if (!f) continue;
        const was = e.burn > 0;
        e.burn = Math.max(e.burn || 0, F.burn); e.burnDps = Math.max(e.burnDps || 0, F.dps); e.burnBy = f.p;
        if (!(e.burnTick > 0)) e.burnTick = 0.5;
        if (!was) this.log({ type: 'bFireBurn', enemy: e });
      }
    }
    // Rede caindo e sumindo.
    for (let i = this.nets.length - 1; i >= 0; i--) {
      const n = this.nets[i];
      n.t -= dt;
      const age = n.life - n.t;
      n.g.position.y = Math.max(0, 2.2 - age * 14);
      n.g.scale.setScalar(Math.min(1, 0.3 + age * 5));
      if (n.t < 0.4) n.g.traverse((o) => { if (o.material) { o.material.transparent = true; o.material.opacity = Math.max(0, n.t / 0.4); } });
      if (n.t <= 0) { this.rm(n.g); this.nets.splice(i, 1); }
    }
    // Pregos.
    for (let i = this.nails.length - 1; i >= 0; i--) {
      const n = this.nails[i];
      n.t -= dt;
      if (n.t <= 0 || !n.e.alive) { this.rm(n.g); this.nails.splice(i, 1); }
    }
    // Sinos.
    for (let i = this.bells.length - 1; i >= 0; i--) {
      const b = this.bells[i];
      b.t -= dt; b.ring -= dt;
      b.g.userData.swing.rotation.z = Math.sin(this.time * 9) * 0.5 * Math.max(0, Math.min(1, b.t));
      if (b.ring <= 0 && b.t > 0) { b.ring = 0.6; this.c.vfx.ring(b.decoy.position, 0xffd060, 3); audio.play('bell', b.decoy.position.x, b.decoy.position.z, { v: 0.5 }); }
      if (b.t <= -0.3) { b.decoy.alive = false; this.rm(b.g); this.bells.splice(i, 1); }
    }
    // Nuvens de fumaça: o Ladino dentro some; inimigos dentro perdem ele.
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const cl = this.clouds[i], S = BES.smoke;
      cl.t -= dt; cl.puff -= dt;
      cl.g.material.opacity = 0.35 * Math.min(1, cl.t / 0.6);
      if (cl.puff <= 0 && cl.t > 0.5) { cl.puff = 0.35; const a = Math.random() * 6.28, d = Math.random() * S.r * 0.8; this.c.vfx.smoke(v3(cl.x + Math.sin(a) * d, 0.5, cl.z + Math.cos(a) * d), 0x8a8f9c, 4); }
      for (const p of this.c.players) {
        if (p.state === 'dead' || Math.hypot(p.position.x - cl.x, p.position.z - cl.z) > S.r) continue;
        if (!(p.stealth > 0)) this.log({ type: 'bSmokeHide' });
        p.stealth = Math.max(p.stealth || 0, 0.2);
      }
      const r2 = this.c.rogue2;
      if (r2) for (const e of this.foes()) {
        if (Math.hypot(e.position.x - cl.x, e.position.z - cl.z) > S.r + e.data.radius) continue;
        const last = cl.lost.get(e) || -9;
        if (this.time - last < 0.6) continue;
        cl.lost.set(e, this.time);
        if (r2.lose(e, S.lose, { x: cl.x, z: cl.z })) this.log({ type: 'bSmokeLost', enemy: e });
      }
      if (cl.t <= 0) { this.rm(cl.g); this.clouds.splice(i, 1); }
    }
    this.rainTick(dt);
    this.tickDivine(dt);
    this.tickSteals();
    // Armadilhas que já morderam: somem depois do tempo preso.
    if (this.rk) for (const it of this.rk.items) {
      if (!it.trap || !it.trapUsed) continue;
      it.trapT += dt;
      if (it.trapT >= (it.trapHold || 0) + 0.6) { it.g.remove(it.trap); dispose(it.trap); it.trap = null; }
    }
  }
  // Depois dos inimigos andarem: presos ficam no lugar, ancorados só em volta da estaca.
  afterMove(dt) {
    for (const [e, h] of this.holds) {
      h.t -= dt;
      if (h.t <= 0 || !e.alive) { this.holds.delete(e); continue; }
      e.position.x = h.x; e.position.z = h.z;
      if (e.vel) e.vel.set(0, 0, 0);
      e.group && e.group.position.copy(e.position);
    }
    this.ropes.begin();
    for (let i = this.anchors.length - 1; i >= 0; i--) {
      const a = this.anchors[i];
      a.t -= dt;
      if (a.t <= 0 || !a.e.alive) { this.rm(a.g); this.anchors.splice(i, 1); continue; }
      const e = a.e, dx = e.position.x - a.x, dz = e.position.z - a.z, d = Math.hypot(dx, dz), R = BES.anchor.r;
      if (d > R) { e.position.x = a.x + dx / d * R; e.position.z = a.z + dz / d * R; if (e.vel) e.vel.multiplyScalar(0.3); e.group && e.group.position.copy(e.position); if (!a.tug) { a.tug = true; this.log({ type: 'bAnchorTug', enemy: e }); } }
      this.ropes.add(a.x, 0.72, a.z, e.position.x, 1.0 * (e.group.scale.y || 1), e.position.z);
    }
    for (const p of this.c.players) {
      const h = p.bHook;
      if (h && h.g) this.ropes.add(p.position.x + Math.sin(p.facing) * 0.4, 1.3, p.position.z + Math.cos(p.facing) * 0.4, h.x, 1.3, h.z);
    }
    this.ropes.end();
  }

  // Sala nova: tudo some (o RogueKit já tirou os virotes).
  clearRoom() {
    for (const f of this.flames) this.rm(f.g);
    for (const n of this.nets) this.rm(n.g);
    for (const a of this.anchors) this.rm(a.g);
    for (const n of this.nails) this.rm(n.g);
    for (const b of this.bells) { b.decoy.alive = false; this.rm(b.g); }
    for (const cl of this.clouds) this.rm(cl.g);
    for (const r of this.rains) { this.rm(r.mk); if (r.up) this.rm(r.up); }
    for (const d of this.drops) this.rm(d.g);
    for (const sp of this.spirits) this.rm(sp.g);
    for (const r of this.steals) { r.decoy.alive = false; if (r.e) r.e.bStolen = null; r.wpn.removeFromParent(); }
    for (const [e, sp] of this.divMarks) { e.bDivT = 0; this.rm(sp); }
    for (const f of this.c.scene.children.filter((o) => o.userData && o.userData.divineArrow)) this.rm(f);
    this.flames = []; this.nets = []; this.anchors = []; this.nails = []; this.bells = []; this.clouds = []; this.rains = []; this.drops = [];
    this.spirits = []; this.steals = []; this.divMarks.clear();
    this.holds.clear();
    this.ropes.clear();
    for (const p of this.c.players) if (p.bTurret) this.unmount(p);
  }
  dropFor(p) {
    if (p.bTurret) { this.rm(p.bTurret.g); p.bTurret = null; }
    if (p.bHook) { this.rm(p.bHook.g); p.bHook = null; }
    if (p.bBarG) p.bBarG.visible = false;
    if (p.bLaser) p.bLaser.visible = false;
    this.rains = this.rains.filter((r) => { if (r.p !== p) return true; this.rm(r.mk); if (r.up) this.rm(r.up); return false; });
    this.drops = this.drops.filter((d) => { if (d.p !== p) return true; this.rm(d.g); return false; });
  }
  clear() {
    this.clearRoom();
    for (const p of this.c.players) {
      if (p.bHook) { this.rm(p.bHook.g); p.bHook = null; }
      if (p.bBarG) p.bBarG.visible = false;
      if (p.bLaser) p.bLaser.visible = false;
    }
  }
}
