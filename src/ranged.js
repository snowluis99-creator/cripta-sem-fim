// Ataques à distância: o Arqueiro (mantém distância, foge se o herói chega perto e atira com a besta)
// e a saraivada de flechas do Guardião enfurecido. Sem aviso: só a pose de mirar.
import * as THREE from 'three';
import { stepToward, fleePoint, aimAngle, targetBusy, lineClear } from './brain.js';
import { audio } from './audio.js';
const rand = ([a, b]) => a + Math.random() * (b - a);

// Tem caminho livre (sem obstáculo) até o herói?
function clearShot(e, p, world) {
  const dx = p.position.x - e.position.x, dz = p.position.z - e.position.z;
  const n = Math.ceil(Math.hypot(dx, dz));
  for (let i = 1; i < n; i++) {
    if (world.blocked(e.position.x + (dx * i) / n, e.position.z + (dz * i) / n, 0.1)) return false;
  }
  return true;
}

// Movimento do Arqueiro enquanto persegue. Devolve true se começou a atirar.
// Cérebro (brain.js): foge para um lugar livre, dá a volta nos obstáculos para ter linha de tiro
// e, com mira livre, anda de lado mantendo distância.
export function archerChase(e, dt, ctx, dist, dx, dz) {
  const d = e.data, R = d.ranged, p = ctx.player;
  const shot = clearShot(e, p, ctx.world);
  if (targetBusy(p)) e.cooldown -= dt; // herói ocupado: atira mais cedo
  if (e.cooldown <= 0 && dist <= R.max + 2 && shot) { startShot(e, R); return true; }
  let tx = null, tz = null, mode = 'idle';
  const keep = R.keep || R.max * 0.7;
  if (dist < R.flee) {
    // Muito perto: corre para longe.
    const f = fleePoint(e, ctx, dist);
    if (f) { tx = f.x; tz = f.z; mode = 'run'; }
    else { tx = e.position.x + (dz / dist) * 3 * e.strafe; tz = e.position.z - (dx / dist) * 3 * e.strafe; mode = 'run'; } // encurralado: escapa de lado
  } else if (dist < keep) {
    // Perto demais: anda de costas, de frente para o herói (pronto para atirar).
    const b = backStep(e, ctx, dx, dz, dist);
    if (b) { tx = b.x; tz = b.z; mode = 'back'; }
  } else if (dist > R.max || !shot) { tx = p.position.x; tz = p.position.z; mode = 'walk'; } // chega mais perto / procura mira
  else { tx = e.position.x + (dz / dist) * 2 * e.strafe; tz = e.position.z - (dx / dist) * 2 * e.strafe; mode = 'walk'; } // anda de lado
  const moved = tx !== null && stepToward(e, ctx, dt, tx, tz, mode === 'run' ? 1.25 : mode === 'back' ? 0.75 : 1);
  if (moved && mode === 'back') e.moveAng = null; // continua olhando para o herói
  if (moved) e.anim.play(mode === 'run' ? 'Running_A' : mode === 'back' ? 'Walking_Backwards' : d.anims.walk, { speed: mode === 'run' ? 1.1 : mode === 'back' ? 1.2 : d.walkAnimSpeed });
  else e.anim.play(d.anims.idle);
  return false;
}

// Um passo para trás (para longe do herói), livre de paredes; se a parede está atrás, vai de lado.
function backStep(e, ctx, dx, dz, dist) {
  const w = ctx.world, r = e.data.radius * 0.9;
  for (const side of [0, 0.6 * e.strafe, -0.6 * e.strafe, 1.2 * e.strafe, -1.2 * e.strafe]) {
    const a = Math.atan2(-dx, -dz) + side;
    const x = e.position.x + Math.sin(a) * 2, z = e.position.z + Math.cos(a) * 2;
    if (!w.blocked(x, z, r) && lineClear(w, e.position.x, e.position.z, x, z, r)) return { x, z };
  }
  return null;
}

function startShot(e, R) {
  e.releaseToken();
  e.setState('aim');
  e.shot = R;
  e.hitDone = false;
  e.anim.play(R.aimClip, { fade: 0.12 });
}

// ---------- Rolar para longe (1º golpe que o Arqueiro leva) e recarregar ----------
// (dirX, dirZ) = direção do golpe (para longe de quem bateu).
export function startRoll(e, dirX, dirZ) {
  const Rl = e.data.ranged.roll, w = e.combat && e.combat.world;
  e.releaseToken();
  let a0 = Math.atan2(dirX, dirZ);
  if (!Number.isFinite(a0) || (!dirX && !dirZ)) a0 = e.facing + Math.PI;
  // Procura um lugar livre para onde rolar (reto para trás, ou um pouco de lado).
  let to = null;
  for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
    for (const k of [1, 0.7, 0.45]) {
      const a = a0 + off, x = e.position.x + Math.sin(a) * Rl.dist * k, z = e.position.z + Math.cos(a) * Rl.dist * k;
      if (!w || (!w.blocked(x, z, e.data.radius) && lineClear(w, e.position.x, e.position.z, x, z, e.data.radius * 0.8))) { to = { x, z }; break; }
    }
    if (to) break;
  }
  e.rollFrom = { x: e.position.x, z: e.position.z };
  e.rollTo = to || { x: e.position.x, z: e.position.z };
  e.vel.set(0, 0, 0);
  e.setState('roll');
  // Rola de costas: vira de frente para quem bateu (o rolamento "para trás" leva para longe).
  e.facing = Math.atan2(e.rollFrom.x - e.rollTo.x, e.rollFrom.z - e.rollTo.z) || e.facing;
  e.anim.play('Dodge_Backward', { once: true, restart: true, speed: 0.4 / Rl.time, fade: 0.05 });
  if (e.combat) {
    e.combat.vfx.dust(e.position, new THREE.Vector3(-Math.sin(e.facing), 0, -Math.cos(e.facing)), 6);
    e.combat.text.add('Rolou!', e.position, 'miss', 2.6);
    if (e.combat.log) e.combat.log({ type: 'archerRoll', enemy: e });
  }
  audio.play('dodge', e.position.x, e.position.z);
}

function runRoll(e, dt, ctx) {
  const Rl = e.data.ranged.roll, k = Math.min(1, e.t / Rl.time), ease = 1 - (1 - k) ** 2;
  e.position.x = e.rollFrom.x + (e.rollTo.x - e.rollFrom.x) * ease;
  e.position.z = e.rollFrom.z + (e.rollTo.z - e.rollFrom.z) * ease;
  if (k >= 1) {
    e.setState('reload');
    e.anim.play(Rl.clip, { once: true, restart: true, speed: 1.6 / Rl.reload, fade: 0.1 });
    audio.play('creak', e.position.x, e.position.z);
  }
  return null;
}

// Saraivada do Guardião (quando o herói está longe).
export function startVolley(e) {
  startShot(e, e.data.volley);
  e.cd.volley = rand(e.data.volley.cooldown);
}

// Estados 'aim' (mirando) e 'shot' (disparou). Devolve { target, turn } ou null.
export function runRanged(e, dt, ctx, { toPlayer }) {
  const R = e.shot;
  if (e.state === 'aim') {
    if (e.t >= R.aim) {
      e.setState('shot');
      e.anim.play(R.shootClip, { once: true, restart: true, speed: R.shootSpeed || 1, fade: 0.05 });
      const s = e.data.scale || 1;
      const n = R.count || 1;
      for (let i = 0; i < n; i++) {
        const a = e.facing + (n > 1 ? (i / (n - 1) - 0.5) * R.spread : 0);
        const fx = e.position.x + Math.sin(a) * (0.9 * s), fz = e.position.z + Math.cos(a) * (0.9 * s);
        ctx.combat.projectiles.fire(fx, fz, a, {
          speed: R.speed, damage: Math.round(R.damage * (e.dmgScale || 1)), scale: R.scale || 1, height: 0.55 * s + 0.6, owner: e,
          kind: R.kind, homing: R.homing, color: R.color,
        });
      }
    }
    // Andando para trás enquanto mira (se o herói está mais perto que a distância que ele gosta).
    const keep = e.data.ranged && e.shot === e.data.ranged ? (R.keep || 0) : 0;
    const dist = Math.hypot(ctx.player.position.x - e.position.x, ctx.player.position.z - e.position.z);
    if (keep && R.back && dist < keep) {
      const dx = ctx.player.position.x - e.position.x, dz = ctx.player.position.z - e.position.z;
      const b = backStep(e, ctx, dx, dz, dist);
      if (b) {
        const L = Math.hypot(b.x - e.position.x, b.z - e.position.z) || 1, st = R.back * dt;
        e.position.x += ((b.x - e.position.x) / L) * st; e.position.z += ((b.z - e.position.z) / L) * st;
        ctx.world.resolveCircle(e.position, e.data.radius);
      }
    }
    // Mira onde o herói vai estar (projéteis que seguem o herói miram menos na frente).
    const aim = R.homing ? toPlayer : aimAngle(e, ctx.player, R.speed);
    return e.t < R.aim - 0.12 ? { target: aim, turn: R.turn ?? 9 } : null; // trava a mira no fim
  }
  if (e.state === 'roll') return runRoll(e, dt, ctx);
  if (e.state === 'reload') {
    // Recarregando a besta, parado.
    if (e.t >= e.data.ranged.roll.reload) { e.setState('chase'); e.cooldown = 0.15; e.anim.play(e.data.anims.idle, { fade: 0.15 }); }
    return { target: toPlayer, turn: 6 };
  }
  // 'shot': recuo do disparo.
  if (e.t >= R.recover) {
    if (!e.data.volley || e.shot !== e.data.volley) e.cooldown = rand(e.data.cooldown);
    e.setState('chase');
    e.anim.play(e.data.anims.idle, { fade: 0.15 });
  }
  return null;
}
