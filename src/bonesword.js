// Espada de esqueletos do Guardião enfurecido (giro na sala toda):
// ele anda até o meio da sala, esqueletos saem do chão e voam para grudar na arma dele,
// um atrás do outro, até a lâmina ficar do tamanho da sala. Só então ele gira.
import * as THREE from 'three';
import { makeCharacter } from './characters.js';
import { Animator } from './animation.js';

const MINION = 'enemies/Skeleton_Minion.glb';
const SEG = 1.7;          // quanto cada par de esqueletos aumenta a lâmina
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

export class BoneSword {
  // e = Guardião, weapon = arma na mão direita, bounds = { halfW, halfD } da sala.
  constructor(e, combat, cfg) {
    this.e = e; this.combat = combat; this.cfg = cfg;
    this.weapon = e.weapons[0];
    const b = combat.hazards.bounds || { halfW: 14, halfD: 12 };
    this.halfW = b.halfW; this.halfD = b.halfD;
    // Comprimento total da lâmina (da mão até a ponta) = até a parede mais longe a partir do meio.
    this.length = Math.max(b.halfW, b.halfD);
    this.root = new THREE.Group();           // segue a arma (posição e giro), mas sem a escala do chefe
    combat.scene.add(this.root);
    // Núcleo fantasma da lâmina: cresce a cada esqueleto que gruda.
    this.core = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xb070ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.core.scale.y = 0.001;
    this.root.add(this.core);
    this.flying = [];   // { obj, anim, from, t, slot }
    this.stuck = [];
    this.spawned = 0;
    this.timer = 0;
    this.base = 1;      // comprimento da arma de verdade (no mundo)
    this.follow();
  }

  get done() { return this.spawned >= this.cfg.count && this.flying.length === 0; }

  // Posição de cada esqueleto na lâmina (em pares, alternando o lado e girando).
  slot(i) {
    const n = this.cfg.count, pair = Math.floor(i / 2), side = i % 2 ? 1 : -1;
    const span = this.length - this.base;
    const y = this.base + ((pair + 0.5) / Math.ceil(n / 2)) * span - SEG * 0.5;
    return {
      pos: new THREE.Vector3(side * 0.28, y, side * 0.12),
      rot: new THREE.Euler(0, side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5, side * 0.25 + (pair % 2 ? 0.15 : -0.15)),
      tip: y + SEG,
    };
  }

  follow() {
    this.weapon.updateWorldMatrix(true, false);
    this.weapon.matrixWorld.decompose(_p, _q, _s);
    this.root.position.copy(_p);
    this.root.quaternion.copy(_q);
    this.base = _s.y * 1.0; // a arma tem ~1 de comprimento no modelo
  }

  spawnOne() {
    const { world } = this.combat;
    let x = 0, z = 0;
    for (let k = 0; k < 12; k++) {
      x = (Math.random() * 2 - 1) * (this.halfW - 2.5);
      z = (Math.random() * 2 - 1) * (this.halfD - 2.5);
      if (!world.blocked(x, z, 0.8) && Math.hypot(x - this.e.position.x, z - this.e.position.z) > 4) break;
    }
    const { group, model } = makeCharacter(MINION);
    group.remove(group.children[1]); // sem sombra
    group.position.set(x, -2.4, z);
    group.rotation.y = Math.atan2(this.e.position.x - x, this.e.position.z - z);
    this.combat.scene.add(group);
    const anim = new Animator(model);
    anim.play('Skeletons_Awaken_Standing', { once: true, speed: 2.2, fade: 0 });
    this.combat.vfx.dust(group.position.clone().setY(0), new THREE.Vector3(0, 0, 0), 6);
    this.flying.push({ obj: group, anim, t: 0, i: this.spawned, from: null });
    this.spawned++;
  }

  // Devolve true quando a lâmina está completa.
  // No anfitrião do co-op os efeitos daqui não vão pela rede: o outro computador monta a própria lâmina.
  update(dt) {
    this.combat.netMuted = (this.combat.netMuted || 0) + 1;
    try { return this.updateInner(dt); } finally { this.combat.netMuted--; }
  }

  updateInner(dt) {
    this.follow();
    this.timer -= dt;
    if (this.spawned < this.cfg.count && this.timer <= 0) { this.timer = this.cfg.every; this.spawnOne(); }
    const RISE = 0.35, fly = this.cfg.fly;
    for (let k = this.flying.length - 1; k >= 0; k--) {
      const f = this.flying[k];
      f.t += dt;
      f.anim.update(dt);
      if (f.t < RISE) { f.obj.position.y = -2.4 + 2.4 * (f.t / RISE); continue; }
      if (!f.from) {
        f.from = { p: f.obj.position.clone(), q: f.obj.quaternion.clone() };
        f.anim.play('Jump_Idle', { fade: 0.1 });
      }
      const k01 = Math.min(1, (f.t - RISE) / fly), ease = k01 * k01 * (3 - 2 * k01);
      const s = this.slot(f.i);
      const target = s.pos.clone().applyMatrix4(this.root.matrixWorld);
      const tq = this.root.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(s.rot));
      f.obj.position.lerpVectors(f.from.p, target, ease);
      f.obj.position.y += Math.sin(k01 * Math.PI) * 4;
      f.obj.quaternion.slerpQuaternions(f.from.q, tq, ease);
      if (k01 >= 1) {
        this.root.add(f.obj);
        f.obj.position.copy(s.pos);
        f.obj.rotation.copy(s.rot);
        f.anim.play('Skeletons_Taunt', { speed: 0.8 + Math.random() * 0.6, fade: 0.1 });
        this.stuck.push(f);
        this.flying.splice(k, 1);
        this.setCore(Math.max(...this.stuck.map((o) => this.slot(o.i).tip)));
        this.combat.vfx.sparks(target, 0xb070ff, 5);
        this.combat.cam.shake(0.08);
      }
    }
    for (const f of this.stuck) f.anim.update(dt);
    return this.done;
  }

  setCore(tip) {
    const len = Math.max(0.01, tip - this.base * 0.6);
    this.core.scale.y = len;
    this.core.position.y = this.base * 0.6 + len / 2;
  }

  // Depois do giro (ou se o chefe for interrompido): os esqueletos se desmancham em ossos.
  shatter(quiet = false) {
    this.combat.netMuted = (this.combat.netMuted || 0) + 1;
    try { this.shatterInner(quiet); } finally { this.combat.netMuted--; }
  }

  shatterInner(quiet) {
    if (this.gone) return;
    this.gone = true;
    const { debris, vfx, scene } = this.combat;
    for (const f of [...this.stuck, ...this.flying]) {
      if (quiet) { f.obj.removeFromParent(); continue; }
      f.obj.getWorldPosition(_p);
      _p.y = Math.max(0.3, _p.y);
      const dx = _p.x - this.e.position.x, dz = _p.z - this.e.position.z, d = Math.hypot(dx, dz) || 1;
      debris.skeleton(_p, dx / d, dz / d);
      vfx.puff(_p);
      f.obj.removeFromParent();
    }
    this.stuck.length = 0; this.flying.length = 0;
    scene.remove(this.root);
    this.core.geometry.dispose(); this.core.material.dispose();
  }
}
