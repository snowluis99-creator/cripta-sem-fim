// Ultimate: carrega com inimigos derrotados (10; Pacto do Ceifador: 6). R no teclado, RT no controle.
// - Cavaleiro: invulnerável por 3 s (domo dourado em volta).
// - Maga: magia que acerta todos os inimigos da sala (15 de dano).
// Inimigos derrotados durante a ultimate (ou pela magia dela) não carregam a barra de novo.
import * as THREE from 'three';
import { audio } from './audio.js';

export const ULT = {
  knight: { name: 'Fortaleza Dourada', time: 3 },
  mage: { name: 'Chuva Arcana', damage: 15, delay: 0.45, clip: 'Ranged_Magic_Spellcasting', speed: 1.5 },
};

// Domo dourado do Cavaleiro (também usado na tela do Jogador 2).
export function tickDome(p, on, dt) {
  if (!p.dome) {
    if (!on) return;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.6, 40).rotateX(-Math.PI / 2), mat);
    ring.position.y = 0.1;
    p.dome = new THREE.Group();
    p.dome.add(dome, ring);
    p.dome.userData = { k: 0, t: 0, mat };
    p.group.add(p.dome);
  }
  const u = p.dome.userData;
  u.k += ((on ? 1 : 0) - u.k) * Math.min(1, dt * 10);
  u.t += dt;
  p.dome.visible = u.k > 0.02;
  if (!p.dome.visible) return;
  u.mat.opacity = u.k * (0.32 + 0.12 * Math.sin(u.t * 10));
  p.dome.scale.setScalar(0.8 + 0.2 * u.k + 0.03 * Math.sin(u.t * 6));
}

export class Ultimates {
  // g: { combat, vfx, hud, run, flash(color, time) }
  constructor(g) { Object.assign(this, g); }

  ready(p) { return p.ult >= p.ultNeed; }

  // Pode usar agora? (vivo, com a barra cheia, fora da Taverna e de cenas)
  canUse(p) {
    return this.ready(p) && !this.run.inTavern && !this.run.transition
      && ['idle', 'run', 'attack', 'block', 'hurt'].includes(p.state);
  }

  use(p) {
    if (!this.canUse(p)) return false;
    p.ult = 0;
    const kind = ULT[p.heroId] ? p.heroId : 'knight';
    const say = (t) => this.combat.text.add(t, p.position, 'crit', 3.6);
    if (kind === 'knight') {
      p.ultTime = ULT.knight.time;
      p.iframes = 0;
      say(`${ULT.knight.name}!`);
      this.vfx.burst(p.position.clone(), 0xffd24a);
      this.vfx.ring(p.position.clone(), 0xffd24a, 3);
      audio.play('blessing', p.position.x, p.position.z);
      this.flash('#ffd24a', 0.15);
    } else {
      const U = ULT.mage;
      p.combo = 0;
      p.emote(U.clip, { speed: U.speed, end: 0.8 });
      say(`${U.name}!`);
      this.vfx.burst(p.position.clone(), 0xb070ff);
      audio.play('spell', p.position.x, p.position.z);
      this.run.delay(U.delay, () => this.mageStrike(p));
    }
    if (this.combat.log) this.combat.log({ type: 'ultimate', hero: kind, p });
    return true;
  }

  // Raios do céu em todos os inimigos da sala.
  mageStrike(p) {
    const U = ULT.mage;
    this.flash('#b070ff', 0.22);
    audio.play('boom', p.position.x, p.position.z);
    p.ultCasting = true; // quem morrer agora não carrega a barra
    let hits = 0;
    for (const e of [...this.combat.enemies]) {
      if (!e.alive || !e.targetable) continue;
      const at = new THREE.Vector3(e.position.x, 1.1, e.position.z);
      this.vfx.bolt(new THREE.Vector3(e.position.x + 0.6, 9, e.position.z - 0.4), at, 0xd7a8ff);
      this.vfx.sparks(at, 0xc890ff, 8);
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
      this.combat.bonusDamage(e, U.damage, dx / d, dz / d, 'crit', p);
      hits++;
    }
    p.ultCasting = false;
    if (this.combat.log) this.combat.log({ type: 'ultStrike', hits });
  }

  update(dt) {
    for (const p of this.combat.players) {
      if (p.ultTime > 0) p.ultTime = Math.max(0, p.ultTime - dt);
      tickDome(p, p.ultTime > 0 && p.state !== 'dead', dt);
      if (p.ctl.ultimate && p.ctl.ultimate()) this.use(p);
      // Aviso uma vez quando enche.
      const full = this.ready(p);
      if (full && !p.ultWarned) {
        p.ultWarned = true;
        const t = 'Ultimate pronta!';
        if (p.ux) p.ux.banner(t, 'small'); else this.hud.banner(t, 'small');
      }
      if (!full) p.ultWarned = false;
    }
  }
}
