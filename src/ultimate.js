// Ultimate: carrega com inimigos derrotados (10; Pacto do Ceifador: 6). R no teclado, RT no controle.
// - Cavaleiro: invulnerável por 3 s (domo dourado em volta).
// - Maga: magia que acerta todos os inimigos da sala (15 de dano).
// Inimigos derrotados durante a ultimate (ou pela magia dela) não carregam a barra de novo.
import * as THREE from 'three';
import { audio } from './audio.js';
import { ROGUE_ULT } from './rogue.js';

export const ULT = {
  knight: { name: 'Fortaleza Dourada', time: 3 },
  rogue: ROGUE_ULT, // Precisão Invejável: 100% de crítico por 5 s
  mage: { name: 'Chuva Arcana', damage: 15, delay: 0.45, clip: 'Ranged_Magic_Spellcasting', speed: 1.5, repeatGap: 0.7 },
  blastRadius: 5,   // Explosão de Poder
  // Cena ao ativar: o jogo congela, a câmera chega perto, o herói levanta a arma e grita o nome; depois a ultimate sai.
  cine: { time: 1.55, zoom: 0.55, clip: { knight: 'Cheering', mage: 'Ranged_Magic_Raise', rogue: 'Cheering' },
    speed: { knight: 1.3, mage: 0.9, rogue: 1.4 }, color: { knight: '#ffd24a', mage: '#c890ff', rogue: '#ff5a4a' } },
  burnRadius: 2.6,  // Domo Ardente
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

// Faixas pretas de cinema durante a cena da ultimate.
function bars(on) {
  let el = document.querySelector('.ultbars');
  if (!el) { el = document.createElement('div'); el.className = 'ultbars'; document.body.appendChild(el); }
  el.classList.toggle('on', on);
}

export class Ultimates {
  // g: { combat, vfx, hud, run, flash(color, time), cam }
  constructor(g) { Object.assign(this, g); this.cinematic = true; this.cine = null; }

  ready(p) { return p.ult >= p.ultNeed; }

  // Pode usar agora? (vivo, com a barra cheia, fora da Taverna e de cenas)
  canUse(p) {
    return this.ready(p) && !this.run.inTavern && !this.run.transition
      && ['idle', 'run', 'attack', 'block', 'hurt'].includes(p.state);
  }

  use(p) {
    if (!this.canUse(p) || this.cine) return false;
    if (this.cinematic) { this.startCine(p); return true; }
    return this.fire(p);
  }

  // Começa a cena da ultimate (tudo congela; só o herói se mexe).
  startCine(p) {
    const C = ULT.cine, kind = ULT[p.heroId] ? p.heroId : 'knight';
    this.cine = { p, t: 0, kind };
    p.combo = 0; p.queued = false; p.vel.set(0, 0, 0);
    if (p.clearRoll) p.clearRoll();
    p.setState('ultCine');
    this.cine.facing = p.facing; p.facing = 0; p.group.rotation.y = 0; // vira para a câmera
    p.anim.play(C.clip[kind], { once: true, restart: true, fade: 0.08, speed: C.speed[kind] });
    p.setGlow(1);
    this.hud.banner(`${ULT[kind].name}!`, 'ult');
    this.vfx.burst(p.position.clone(), parseInt(C.color[kind].slice(1), 16));
    audio.play('charge', p.position.x, p.position.z);
    this.flash(C.color[kind], 0.12);
    if (this.cam && this.cam.setCine) this.cam.setCine(C.zoom);
    bars(true);
    if (this.combat.log) this.combat.log({ type: 'ultCine', hero: kind, p });
  }

  // A cada quadro da cena (no lugar da simulação). Ao terminar, a ultimate sai.
  updateCine(dt) {
    const c = this.cine;
    if (!c) return;
    const p = c.p;
    c.t += dt;
    p.anim.update(dt);
    const k = Math.min(1, c.t / 0.35);
    p.setGlow(0.6 + 0.4 * Math.sin(c.t * 18) * k);
    if (c.t < ULT.cine.time && p.state !== 'dead') return;
    this.cine = null;
    bars(false);
    if (this.cam && this.cam.setCine) this.cam.setCine(1);
    p.setGlow(0);
    p.facing = c.facing; p.group.rotation.y = c.facing;
    if (p.state === 'dead') return;
    p.setState('idle');
    p.anim.play(p.hero.anims.idle, { fade: 0.15 });
    this.fire(p);
  }

  fire(p) {
    const st = p.stats;
    p.ult = st.ultRefund ? Math.floor(p.ultNeed * st.ultRefund) : 0; // Carga Guardada
    if (st.ultPower > 0) { p.powerLeft = st.ultPower; p.powerActive = false; p.combo = 0; } // Poder Acumulado: os 2 próximos combos
    const kind = ULT[p.heroId] ? p.heroId : 'knight';
    const say = (t) => this.combat.text.add(t, p.position, 'crit', 3.6);
    this.boons(p);
    if (kind === 'knight') {
      p.ultTime = ULT.knight.time + (st.domeTime || 0);
      p.domeTick = 0;
      p.iframes = 0;
      say(`${ULT.knight.name}!`);
      this.vfx.burst(p.position.clone(), 0xffd24a);
      this.vfx.ring(p.position.clone(), 0xffd24a, 3);
      audio.play('blessing', p.position.x, p.position.z);
      this.flash('#ffd24a', 0.15);
    } else if (kind === 'rogue') {
      p.ultTime = ROGUE_ULT.time + (st.aimTime || 0);
      say(`${ROGUE_ULT.name}!`);
      this.vfx.burst(p.position.clone(), 0xff4a3a);
      this.vfx.ring(p.position.clone(), 0xffd24a, 2.4);
      audio.play('charge', p.position.x, p.position.z);
      this.flash('#ff4a3a', 0.15);
    } else {
      const U = ULT.mage;
      p.combo = 0;
      p.emote(U.clip, { speed: U.speed, end: 0.8 });
      say(`${U.name}!`);
      this.vfx.burst(p.position.clone(), 0xb070ff);
      audio.play('spell', p.position.x, p.position.z);
      this.run.delay(U.delay, () => this.mageStrike(p));
      if (st.rainRepeat) this.run.delay(U.delay + ULT.mage.repeatGap, () => this.mageStrike(p, true)); // Chuva Dupla
    }
    if (this.combat.log) this.combat.log({ type: 'ultimate', hero: kind, p });
    return true;
  }

  // Bênçãos da Ultimate que valem para todos os heróis: cura e explosão em volta ao ativar.
  boons(p) {
    const st = p.stats;
    // Amedrontador: todos os inimigos ficam atordoados.
    if (st.ultStun > 0) {
      let n = 0;
      for (const e of this.combat.enemies) if (e.targetable && e.daze && e.daze(st.ultStun)) n++;
      if (n) this.combat.text.add('Amedrontados!', p.position, 'hurt', 3.6);
      if (this.combat.log) this.combat.log({ type: 'ultStun', n });
    }
    if (st.ultHeal > 0) {
      const healed = p.heal(st.ultHeal);
      if (healed) this.combat.text.add(`+${healed}`, p.position, 'heal');
      this.vfx.burst(p.position.clone(), 0x7dff8a);
    }
    if (st.ultBlast > 0) {
      this.vfx.ring(p.position.clone(), 0xff9a2a, ULT.blastRadius);
      this.combat.shakeFor(p, 0.3);
      audio.play('boom', p.position.x, p.position.z);
      p.ultCasting = true;
      let hits = 0;
      for (const e of [...this.combat.enemies]) {
        if (!e.alive || !e.targetable) continue;
        const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
        if (d > ULT.blastRadius + e.data.radius) continue;
        this.combat.bonusDamage(e, st.ultBlast, dx / d, dz / d, 'crit', p);
        if (e.alive && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(14 * (e.data.knockback ?? 1));
        hits++;
      }
      p.ultCasting = false;
      if (this.combat.log) this.combat.log({ type: 'ultBlast', hits });
    }
  }

  // Raios do céu em todos os inimigos da sala. again = 2ª chuva (Chuva Dupla).
  mageStrike(p, again = false) {
    const U = ULT.mage, st = p.stats;
    if (p.state === 'dead') return;
    this.flash('#b070ff', 0.22);
    audio.play('boom', p.position.x, p.position.z);
    p.ultCasting = true; // quem morrer agora não carrega a barra
    let hits = 0;
    for (const e of [...this.combat.enemies]) {
      if (!e.alive || !e.targetable) continue;
      const at = new THREE.Vector3(e.position.x, 1.1, e.position.z);
      this.vfx.bolt(new THREE.Vector3(e.position.x + 0.6, 9, e.position.z - 0.4), at, st.rainAcid ? 0x9dff5a : 0xd7a8ff);
      this.vfx.sparks(at, 0xc890ff, 8);
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
      this.combat.bonusDamage(e, U.damage + (st.rainDamage || 0), dx / d, dz / d, 'crit', p);
      if (st.rainAcid > 0 && e.alive) { // Chuva Ácida: marcado leva mais dano de todos os heróis por 6 s
        if (!(e.acidT > 0)) this.combat.text.add('Ácido!', e.position, 'heal', 2.6);
        e.acidT = 6; e.acidMul = Math.max(e.acidMul || 0, st.rainAcid);
      }
      hits++;
    }
    p.ultCasting = false;
    if (this.combat.log) this.combat.log({ type: 'ultStrike', hits, again });
  }

  // Domo Ardente: queima quem estiver perto do Cavaleiro enquanto o domo está ligado.
  domeBurn(p, dt) {
    const st = p.stats;
    if (!(st.domeBurn > 0) || !(p.ultTime > 0) || p.state === 'dead') return;
    p.domeTick = (p.domeTick || 0) - dt;
    if (p.domeTick > 0) return;
    p.domeTick = 0.5;
    p.ultCasting = true;
    let hits = 0;
    for (const e of [...this.combat.enemies]) {
      if (!e.alive || !e.targetable) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
      if (d > ULT.burnRadius + e.data.radius) continue;
      this.combat.bonusDamage(e, st.domeBurn, dx / d, dz / d, 'burn', p);
      this.vfx.sparks(new THREE.Vector3(e.position.x, 1.0, e.position.z), 0xff8a2a, 5);
      hits++;
    }
    p.ultCasting = false;
    if (hits && this.combat.log) this.combat.log({ type: 'domeBurn', hits });
  }

  update(dt) {
    for (const p of this.combat.players) {
      if (p.ultTime > 0) { this.domeBurn(p, dt); p.ultTime = Math.max(0, p.ultTime - dt); }
      tickDome(p, p.ultTime > 0 && p.state !== 'dead' && p.heroId === 'knight', dt);
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
