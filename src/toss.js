// Arremesso do Rei Skullbone: puxa um esqueleto que está perto dele, levanta na mão e joga no herói.
// O esqueleto voa em arco até onde o herói vai estar; ao cair, machuca quem estiver perto e fica tonto um pouco.
// Estados do Rei: tossGrab (puxa o esqueleto até a mão) → tossThrow (animação de arremesso; solta no meio).
// Estados do esqueleto: held (na mão do Rei) → thrown (voando) → hurt (tonto ao cair) → volta a lutar.
import * as THREE from 'three';
import { findBone } from './characters.js';
import { audio } from './audio.js';
import { aimAngle } from './brain.js';

export const TOSS_STATES = ['tossGrab', 'tossThrow', 'held', 'thrown'];
const rand = ([a, b]) => a + Math.random() * (b - a);
const _v = new THREE.Vector3();

// Um esqueleto que dá para pegar: comum, vivo, no chão, perto do Rei.
function pickVictim(e, ctx, reach) {
  let best = null, bd = Infinity;
  for (const o of ctx.combat.enemies) {
    if (o === e || !o.alive || o.data.boss || o.data.phantom || (o.data.radius || 0) > 0.9) continue;
    if (!['chase', 'attack', 'block', 'hurt', 'aim', 'shot'].includes(o.state)) continue;
    if (o.frozenT > 0) continue;
    const d = Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z);
    if (d < reach && d < bd) { bd = d; best = o; }
  }
  return best;
}

export function tryToss(e, ctx, dist) {
  const T = e.data.toss;
  if (!T || !(e.cd.toss <= 0)) return false;
  if (dist < T.minDist || dist > T.maxDist) return false;
  const v = pickVictim(e, ctx, T.reach);
  if (!v) { e.cd.toss = 1.2; return false; }
  e.releaseToken();
  v.releaseToken();
  e.setState('tossGrab');
  e.tossing = v;
  e.hitDone = false;
  v.setState('held');
  v.vel.set(0, 0, 0);
  v.heldFrom = { x: v.position.x, y: 0, z: v.position.z };
  v.anim.play('Jump_Idle', { fade: 0.1 });
  e.anim.play('PickUp', { once: true, restart: true, speed: 1.3 / (T.pull + 0.25), fade: 0.1 });
  e.combat.text.add('Agarra um esqueleto!', e.position, 'block', 2.6 + 2.2 * (e.data.scale || 1));
  audio.play('swingHeavy', e.position.x, e.position.z);
  e.cd.toss = rand(T.cooldown);
  if (e.combat.log) e.combat.log({ type: 'tossGrab', enemy: e, victim: v });
  return true;
}

// Onde fica a mão direita do Rei (no mundo).
function handPos(e, out) {
  if (!e.handBone) e.handBone = findBone(e.model, 'handslot.r') || findBone(e.model, 'wrist.r');
  if (e.handBone) { e.handBone.updateWorldMatrix(true, false); e.handBone.getWorldPosition(out); }
  else out.set(e.position.x, 2.2 * (e.data.scale || 1), e.position.z);
  return out;
}

// O Rei foi interrompido (apanhou, morreu, se enfureceu): larga o esqueleto no chão.
export function dropHeld(e) {
  const v = e.tossing;
  e.tossing = null;
  if (!v || !v.alive || v.state !== 'held') return;
  v.position.y = 0;
  v.setState('hurt');
  v.stunTime = 0.4;
  v.anim.play(v.data.anims.hit, { once: true, restart: true, fade: 0.05 });
}

export function runToss(e, dt, ctx, { toPlayer }) {
  const T = e.data.toss, combat = ctx.combat, p = ctx.player;
  switch (e.state) {
    case 'tossGrab': {
      const v = e.tossing;
      if (!v || !v.alive || v.state !== 'held') { e.tossing = null; backToChase(e); return null; }
      // Puxa o esqueleto até a mão (rápido, como quem agarra pelo pescoço).
      const k = Math.min(1, e.t / T.pull), hp = handPos(e, _v);
      v.position.x = v.heldFrom.x + (hp.x - v.heldFrom.x) * k;
      v.position.z = v.heldFrom.z + (hp.z - v.heldFrom.z) * k;
      v.position.y = Math.max(0, (hp.y - 1.0) * k);
      if (k >= 1) {
        e.setState('tossThrow');
        e.anim.play('Throw', { once: true, restart: true, speed: T.throwSpeed, fade: 0.08 });
      }
      return { target: toPlayer, turn: 6 };
    }
    case 'tossThrow': {
      const v = e.tossing, pr = e.anim.progress();
      if (v && v.alive && v.state === 'held' && !e.hitDone) {
        const hp = handPos(e, _v);
        v.position.set(hp.x, Math.max(0, hp.y - 1.0), hp.z);
        v.facing = e.facing;
        if (pr >= T.release) {
          // Solta: voa até onde o herói vai estar.
          e.hitDone = true;
          const a = aimAngle(e, p, 14);
          const d0 = Math.hypot(p.position.x - v.position.x, p.position.z - v.position.z);
          let tx = v.position.x + Math.sin(a) * d0, tz = v.position.z + Math.cos(a) * d0;
          const w = ctx.world;
          if (w.blocked(tx, tz, v.data.radius)) { tx = p.position.x; tz = p.position.z; }
          v.thrown = { fx: v.position.x, fy: v.position.y, fz: v.position.z, tx, tz, by: e, T };
          v.setState('thrown');
          v.anim.play('Jump_Idle', { fade: 0.05 });
          e.tossing = null;
          audio.play('swingHeavy', e.position.x, e.position.z);
          if (combat.log) combat.log({ type: 'toss', enemy: e, victim: v });
        }
      }
      if (pr >= 0.95) { e.tossing = null; backToChase(e); }
      return pr < T.release ? { target: aimAngle(e, p, 14), turn: 8 } : null;
    }
    case 'held':
      // Quem mexe nele é o Rei; se o Rei largou sem soltar, volta ao chão.
      if (e.t > 3) { e.position.y = 0; backToChase(e); }
      return null;
    case 'thrown': {
      const th = e.thrown, k = Math.min(1, e.t / th.T.flight);
      e.position.x = th.fx + (th.tx - th.fx) * k;
      e.position.z = th.fz + (th.tz - th.fz) * k;
      e.position.y = th.fy * (1 - k) + th.T.height * 4 * k * (1 - k);
      e.facing += dt * 14; // gira no ar
      if (k >= 1) land(e, ctx);
      return null;
    }
    default: return null;
  }
}

function backToChase(e) {
  e.setState('chase');
  e.anim.play(e.data.anims.idle, { fade: 0.2 });
}

// Caiu: estrondo, machuca quem está perto e fica tonto.
function land(e, ctx) {
  const th = e.thrown, T = th.T, combat = ctx.combat, by = th.by;
  e.position.y = 0;
  e.thrown = null;
  combat.vfx.heavyImpact(e.position, T.radius / 2.3);
  combat.vfx.dust(e.position, new THREE.Vector3(0, 0, 0), 10);
  combat.cam.shake(0.35);
  audio.play('boom', e.position.x, e.position.z);
  for (const h of combat.alivePlayers) {
    const d = Math.hypot(h.position.x - e.position.x, h.position.z - e.position.z);
    if (d <= T.radius + h.hero.radius) combat.hitPlayer(e, Math.round(T.damage * ((by && by.dmgScale) || e.dmgScale || 1)), { push: T.push, noRepel: true, target: h });
  }
  e.setState('hurt');
  e.stunTime = T.stun;
  e.anim.play('Hit_B', { once: true, restart: true, fade: 0.05 });
  if (combat.log) combat.log({ type: 'tossLand', enemy: e });
}
