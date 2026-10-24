// Morte do Rei Skullbone (cena): ele cambaleia, anda até o herói, a cabeça cai no caminho,
// o corpo sem cabeça agarra o herói e levanta com as mãos... e desmonta pouco depois.
// Co-op: o parceiro corre e dá o golpe final no corpo, que desmonta na hora.
// Só o anfitrião roda a cena; o Jogador 2 recebe o "código" do chefe (5/6/7) e a altura dos heróis.
import * as THREE from 'three';
import { audio } from './audio.js';
import { sayLine } from './voice.js';
import { aimBone } from './abilities.js';
import { findBone, setFlash } from './characters.js';

const GRAV = 26;
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (k) => k * k * (3 - 2 * k);

// Solta a cabeça (crânio, mandíbula, olhos e elmo) do esqueleto e deixa cair como um pedaço solto.
export function detachHead(e, scene, debris) {
  if (e.headOff) return null;
  e.headOff = true;
  const head = findBone(e.model, 'head');
  if (!head) return null;
  e.model.updateMatrixWorld(true);
  const parts = [];
  e.model.traverse((o) => { if (o.isSkinnedMesh && /_(Head|Jaw|Eyes)$/.test(o.name)) parts.push(o); });
  const outer = new THREE.Group();
  let placed = false;
  for (const sm of parts) {
    const idx = sm.skeleton.bones.indexOf(head);
    if (idx < 0) continue;
    const inv = sm.skeleton.boneInverses[idx];
    if (!placed) {
      // Pivô no pescoço, com os eixos "de pé" do modelo (para a cabeça cair e ficar em pé no chão).
      _p.setFromMatrixPosition(_m.copy(inv).invert());
      _m.copy(head.matrixWorld).multiply(inv).multiply(new THREE.Matrix4().makeTranslation(_p.x, _p.y, _p.z));
      _m.decompose(outer.position, outer.quaternion, outer.scale);
      outer.userData.pivot = _p.clone();
      placed = true;
    }
    const piv = outer.userData.pivot;
    const mesh = new THREE.Mesh(sm.geometry, sm.material);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.makeTranslation(-piv.x, -piv.y, -piv.z).multiply(sm.bindMatrix);
    mesh.frustumCulled = false;
    outer.add(mesh);
    sm.visible = false;
  }
  if (!placed) return null;
  scene.add(outer);
  outer.updateMatrixWorld(true);
  // Elmo (preso no osso da cabeça) vai junto.
  for (const c of [...head.children]) if (c.isMesh || c.isGroup) outer.attach(c);
  const f = e.facing;
  const vel = new THREE.Vector3(Math.sin(f) * 2.2 + (Math.random() - 0.5), 3.5, Math.cos(f) * 2.2 + (Math.random() - 0.5));
  const spin = new THREE.Vector3(4 + Math.random() * 3, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3);
  debris.add(outer, vel, spin, { x: 0, z: 0 }, 0, 14);
  return outer;
}

// Corpo grande desmontando em muitos ossos.
export function shatterBoss(e, debris, vfx, dirX, dirZ) {
  e.group.visible = false;
  const s = e.group.scale.x || 1;
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Vector3(e.position.x + (Math.random() - 0.5) * s * 0.6, 0, e.position.z + (Math.random() - 0.5) * s * 0.6);
    debris.skeleton(p, dirX, dirZ, true, { y: 0.8 + i * s * 0.5, scale: 1 + s * 0.25 });
  }
  vfx.puff(e.position);
  vfx.dust(e.position, new THREE.Vector3(dirX, 0, dirZ), 10);
}

// Braços do corpo levantando o herói (por cima da animação). w = 0..1.
export function liftArms(e, w) {
  if (w <= 0) return;
  if (!e.liftBones) e.liftBones = ['upperarm.r', 'lowerarm.r', 'wrist.r', 'upperarm.l', 'lowerarm.l', 'wrist.l'].map((n) => findBone(e.model, n));
  const [ur, lr, wr, ul, ll, wl] = e.liftBones;
  if (!ur || !ul) return;
  _d.set(Math.sin(e.facing) * 0.45, 1.0, Math.cos(e.facing) * 0.45).normalize(); // braços quase na vertical
  aimBone(ur, lr, _d, w); aimBone(lr, wr, _d, w);
  aimBone(ul, ll, _d, w); aimBone(ll, wl, _d, w);
}

// Ponto entre as mãos (onde o herói fica pendurado).
export function handsPoint(e, out) {
  if (!e.handBones) e.handBones = [findBone(e.model, 'hand.r'), findBone(e.model, 'hand.l')];
  const [r, l] = e.handBones;
  e.model.updateMatrixWorld(true);
  r.getWorldPosition(_a); l.getWorldPosition(_b);
  return out.addVectors(_a, _b).multiplyScalar(0.5);
}

export class BossFinale {
  constructor(combat) { this.combat = combat; this.cur = null; }
  get active() { return !!this.cur; }

  start(e, by) {
    const c = this.combat;
    const alive = c.alivePlayers;
    if (!alive.length) return false;
    const victim = by && alive.includes(by) ? by : c.nearestPlayer(e.position.x, e.position.z);
    const ally = alive.find((p) => p !== victim) || null;
    this.cur = e.finale = { e, victim, ally, phase: 'stagger', t: 0, code: 7, w: 0, vy: 0, lift0: null, hold: new THREE.Vector3(), creak: 0 };
    for (const p of alive) p.enterCine();
    e.vel.set(0, 0, 0);
    e.anim.play('Hit_B', { once: true, restart: true, speed: 0.6, fade: 0.05 });
    e.flash = 1;
    c.addHitstop(0.22);
    c.cam.shake(0.7);
    audio.play('hitHeavy', e.position.x, e.position.z);
    sayLine('death', Math.floor(Math.random() * 1e9), e, c);
    victim.facing = Math.atan2(e.position.x - victim.position.x, e.position.z - victim.position.z);
    victim.anim.play(victim.hero.anims.idle, { fade: 0.2 });
    return true;
  }

  set(phase) { this.cur.phase = phase; this.cur.t = 0; }

  update(dt) {
    const F = this.cur;
    if (!F) return;
    const c = this.combat, e = F.e, v = F.victim;
    F.t += dt;
    const s = e.group.scale.x || 1;
    const dx = v.position.x - e.position.x, dz = v.position.z - e.position.z, dist = Math.hypot(dx, dz) || 0.001;
    const turn = (k) => { e.facing += wrap(Math.atan2(dx, dz) - e.facing) * (1 - Math.exp(-k * dt)); };
    switch (F.phase) {
      case 'stagger':
        turn(2);
        if (F.t >= 0.9) { this.set('walk'); e.anim.play('Skeletons_Walking', { speed: 0.75, fade: 0.25 }); }
        break;
      case 'walk': {
        turn(4);
        const reach = 0.62 * s + v.hero.radius;
        // Chega pelo lado do herói (esquerda ou direita na tela): assim a câmera vê os dois de perfil.
        if (F.side === undefined) F.side = e.position.x >= v.position.x ? 1 : -1;
        let gx = v.position.x + F.side * reach, gz = v.position.z;
        if (c.world.blocked && c.world.blocked(gx, gz, e.data.radius)) { F.side = -F.side; gx = v.position.x + F.side * reach; }
        const tx = gx - e.position.x, tz = gz - e.position.z, td = Math.hypot(tx, tz);
        if (td > 0.05) {
          const sp = Math.min(1.1 * s, td / dt);
          e.position.x += (tx / td) * sp * dt; e.position.z += (tz / td) * sp * dt;
        }
        e.group.rotation.z = Math.sin(F.t * 5) * 0.05; // cambaleando
        if (F.t >= 0.6 && !e.headOff) {
          detachHead(e, c.scene, c.debris);
          F.code = 5;
          c.vfx.dust(e.position, new THREE.Vector3(dx / dist, 0, dz / dist), 4);
          audio.play('crunch', e.position.x, e.position.z);
          F.thud = 0.55;
        }
        if (td <= 0.15 || F.t > 5) {
          e.group.rotation.z = 0;
          this.set('grab');
          F.code = 6;
          e.anim.play('Skeletons_Idle', { fade: 0.3 });
          v.anim.play('Hit_B', { once: true, restart: true, fade: 0.08 });
          audio.play('grab', v.position.x, v.position.z);
          F.lift0 = v.position.clone();
        }
        break;
      }
      case 'grab': {
        F.w = Math.min(1, F.t / 0.45);
        if (F.t > 0.35 && v.anim.currentName !== 'Jump_Idle') v.anim.play('Jump_Idle', { fade: 0.2 });
        if (F.t >= 0.75) { this.set('hold'); if (F.ally) { F.ally.anim.play(F.ally.hero.anims.run, { fade: 0.15 }); } }
        break;
      }
      case 'hold': {
        // Sozinho: o corpo treme, range e desmonta. Co-op: espera o golpe do parceiro.
        F.creak -= dt;
        if (F.creak <= 0) { F.creak = 0.45; audio.play('creak', e.position.x, e.position.z); }
        const k = Math.min(1, F.t / 2);
        e.group.position.x = e.position.x; // (posição é o próprio grupo)
        e.group.rotation.z = (Math.random() - 0.5) * 0.05 * k;
        if (F.t > 0.6 && Math.random() < dt * 3) v.facing += (Math.random() - 0.5) * 0.4; // herói se debatendo
        if (F.ally && F.ally.state === 'cine') { if (this.allyStrike(F, dt)) break; }
        else if (F.t >= 2.0) this.collapse(Math.sin(e.facing), Math.cos(e.facing));
        break;
      }
      case 'drop': {
        F.vy -= GRAV * dt;
        v.position.y = Math.max(0, v.position.y + F.vy * dt);
        if (v.position.y <= 0 && !F.landed) {
          F.landed = true;
          v.anim.play('Jump_Land', { once: true, restart: true, fade: 0.05 });
          audio.play('thump', v.position.x, v.position.z);
          c.shakeFor(v, 0.35);
          c.vfx.dust(v.position, new THREE.Vector3(0, 0, 1), 6);
        }
        if (F.landed && F.t > 0.3 && F.landT === undefined) F.landT = F.t;
        if (F.landT !== undefined && F.t - F.landT > 0.55) this.finish();
        break;
      }
      default: break;
    }
    if (F.thud !== undefined && (F.thud -= dt) <= 0) { F.thud = undefined; audio.play('headThud', e.position.x + Math.sin(e.facing) * 2, e.position.z + Math.cos(e.facing) * 2); }
    if (!this.cur) return;
    e.group.rotation.y = e.facing;
    // Braços e herói pendurado nas mãos.
    if (F.phase === 'grab' || F.phase === 'hold') {
      liftArms(e, F.phase === 'hold' ? 1 : smooth(F.w));
      handsPoint(e, F.hold);
      F.hold.y = Math.max(1.1, F.hold.y - 1.25); // herói pendurado pelas mãos dele, bem acima do chão
      // Na frente do corpo (não dentro dele).
      const out = 0.5 * s + v.hero.radius;
      F.hold.x = e.position.x + Math.sin(e.facing) * out; F.hold.z = e.position.z + Math.cos(e.facing) * out;
      const k = F.phase === 'hold' ? 1 : smooth(Math.min(1, F.t / 0.75));
      v.position.lerpVectors(F.lift0, F.hold, k);
      v.facing = Math.atan2(e.position.x - v.position.x, e.position.z - v.position.z);
    }
    for (const p of [v, F.ally]) if (p) p.group.rotation.y = p.facing;
    if (e.eyes.length) setFlash(e.eyes, e.headOff ? 0 : 1.2, 1, 0.1, 0.05);
  }

  // Parceiro corre até o corpo e dá o golpe forte. Devolve true se desmontou.
  allyStrike(F, dt) {
    const a = F.ally, e = F.e, c = this.combat;
    const dx = e.position.x - a.position.x, dz = e.position.z - a.position.z, d = Math.hypot(dx, dz) || 0.001;
    const want = e.data.radius + 1.2;
    if (!F.swing) {
      a.facing = Math.atan2(dx, dz);
      if (d > want && F.t < 2.6) {
        const st = Math.min(a.hero.moveSpeed * dt, d - want);
        a.position.x += (dx / d) * st; a.position.z += (dz / d) * st;
        c.world.resolveCircle(a.position, a.hero.radius);
      } else {
        F.swing = true;
        const step = a.hero.combo[a.hero.heavyIdx];
        a.anim.play(step.clip, { once: true, restart: true, speed: step.speed, fade: 0.08 });
        a.setGlow(1);
        audio.play('swingHeavy', a.position.x, a.position.z);
      }
      return false;
    }
    a.facing = Math.atan2(dx, dz);
    if (!F.struck && a.anim.progress() >= a.hero.combo[a.hero.heavyIdx].hit) {
      F.struck = true;
      a.setGlow(0);
      const at = new THREE.Vector3(e.position.x - (dx / d) * 0.8, 0, e.position.z - (dz / d) * 0.8);
      c.vfx.heavyImpact(at, 1.4);
      c.vfx.sparks(new THREE.Vector3(at.x, 2, at.z), 0xffb050, 16);
      audio.play('hitHeavy', at.x, at.z);
      c.addHitstop(0.15);
      c.hud.banner(`Jogador ${a.id} acabou com ele!`, 'small');
      this.collapse(dx / d, dz / d);
      return true;
    }
    return false;
  }

  collapse(dirX, dirZ) {
    const F = this.cur, c = this.combat, e = F.e;
    shatterBoss(e, c.debris, c.vfx, dirX, dirZ);
    F.code = 2;
    e.shattered = true;
    audio.play('bigShatter', e.position.x, e.position.z);
    c.cam.shake(0.8);
    c.hud.banner('O Rei Skullbone foi destruído!', 'big');
    F.vy = 2.5;
    this.set('drop');
    F.victim.anim.play('Jump_Idle', { fade: 0.1 });
  }

  finish() {
    const F = this.cur;
    if (!F) return;
    const e = F.e;
    for (const p of [F.victim, F.ally]) if (p && p.state === 'cine') p.exitCine();
    if (!e.shattered) { e.shattered = true; e.group.visible = false; }
    e.finale = null;
    e.deathTimer = 0.75;
    this.cur = null;
  }

  // Sala trocada / partida nova no meio da cena.
  cancel() {
    const F = this.cur;
    if (!F) return;
    F.e.shattered = true;
    this.finish();
  }
}
