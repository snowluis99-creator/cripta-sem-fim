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

// ---------- 1º golpe que o Arqueiro leva: cambalhota até as costas do herói, pulo para longe e recarrega ----------
// Lugar livre (x, z) + caminho livre até lá, saindo de (fx, fz) no ângulo a0 (tenta um pouco para os lados).
function freeSpot(w, e, fx, fz, a0, dist, offs, ks = [1, 0.75, 0.5]) {
  for (const off of offs) {
    for (const k of ks) {
      const a = a0 + off, x = fx + Math.sin(a) * dist * k, z = fz + Math.cos(a) * dist * k;
      if (!w || (!w.blocked(x, z, e.data.radius) && lineClear(w, e.position.x, e.position.z, x, z, e.data.radius * 0.8))) return { x, z };
    }
  }
  return null;
}

// Cambalhota de verdade (o modelo gira para a frente em volta da cintura), como a do herói. k = 0..1; k < 0 = desfaz.
export function applyEnemyRoll(e, k) {
  const m = e.model;
  if (!m) return;
  if (k < 0 || k >= 1) { m.rotation.x = 0; m.position.set(0, 0, 0); return; }
  const c = 0.9, s = k * k * (3 - 2 * k), a = s * Math.PI * 2;
  m.rotation.x = a;
  m.position.set(0, c - c * Math.cos(a) - Math.sin(k * Math.PI) * 0.35, -c * Math.sin(a));
}

// (dirX, dirZ) = direção do golpe. O destino é atrás do herói que bateu (nas costas dele).
export function startRoll(e, dirX, dirZ) {
  const Rl = e.data.ranged.roll, c = e.combat, w = c && c.world;
  e.releaseToken();
  const h = e.lastHitBy && e.lastHitBy.position ? e.lastHitBy : c && c.player;
  let to = null;
  if (h && Math.hypot(h.position.x - e.position.x, h.position.z - e.position.z) < Rl.reach) {
    // Atrás do herói: do lado oposto para onde ele olha (ou, se não der, do outro lado dele em relação ao arqueiro).
    const back = (h.facing ?? Math.atan2(h.position.x - e.position.x, h.position.z - e.position.z)) + Math.PI;
    to = freeSpot(w, e, h.position.x, h.position.z, back, Rl.behind, [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2], [1, 0.8]);
    if (!to) { const across = Math.atan2(h.position.x - e.position.x, h.position.z - e.position.z); to = freeSpot(w, e, h.position.x, h.position.z, across, Rl.behind, [0, 0.6, -0.6]); }
  }
  if (!to) {
    // Herói longe (ou sem espaço atrás dele): cambalhota para o lado.
    let a0 = Math.atan2(dirX, dirZ);
    if (!Number.isFinite(a0) || (!dirX && !dirZ)) a0 = e.facing + Math.PI;
    to = freeSpot(w, e, e.position.x, e.position.z, a0, Rl.dist, [Math.PI / 2 * e.strafe, -Math.PI / 2 * e.strafe, 0, 1.0, -1.0]);
  }
  e.rollFrom = { x: e.position.x, z: e.position.z };
  e.rollTo = to || { x: e.position.x, z: e.position.z };
  e.rollHero = h;
  e.rollK = 0;
  e.vel.set(0, 0, 0);
  e.setState('roll');
  // Rola para a frente: olha para onde vai.
  const ang = Math.atan2(e.rollTo.x - e.rollFrom.x, e.rollTo.z - e.rollFrom.z);
  if (Number.isFinite(ang) && (e.rollTo.x !== e.rollFrom.x || e.rollTo.z !== e.rollFrom.z)) e.facing = ang;
  e.anim.play('Crouching', { fade: 0.06, restart: true });
  if (c) {
    c.vfx.dust(e.position, new THREE.Vector3(Math.sin(e.facing), 0, Math.cos(e.facing)), 6);
    c.text.add('Rolou!', e.position, 'miss', 2.6);
    if (c.log) c.log({ type: 'archerRoll', enemy: e, to: { ...e.rollTo }, hero: h });
  }
  audio.play('dodge', e.position.x, e.position.z);
}

function runRoll(e, dt, ctx) {
  const Rl = e.data.ranged.roll, k = Math.min(1, e.t / Rl.time), ease = k * k * (3 - 2 * k);
  e.position.x = e.rollFrom.x + (e.rollTo.x - e.rollFrom.x) * ease;
  e.position.z = e.rollFrom.z + (e.rollTo.z - e.rollFrom.z) * ease;
  e.rollK = k;
  applyEnemyRoll(e, k);
  if (k >= 1) { e.rollK = -1; applyEnemyRoll(e, -1); startHop(e, ctx); }
  return null;
}

// Pulo para longe do herói (para longe das costas dele), para ter tempo de recarregar.
function startHop(e, ctx) {
  const Rl = e.data.ranged.roll, h = e.rollHero || ctx.player;
  const away = Math.atan2(e.position.x - h.position.x, e.position.z - h.position.z);
  const to = freeSpot(ctx.world, e, e.position.x, e.position.z, away, Rl.hop, [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.3, -2.3], [1, 0.7, 0.45]);
  e.hopFrom = { x: e.position.x, z: e.position.z };
  e.hopTo = to || { x: e.position.x, z: e.position.z };
  e.setState('hop');
  const ang = Math.atan2(e.hopTo.x - e.hopFrom.x, e.hopTo.z - e.hopFrom.z);
  if (to) e.facing = ang;
  e.anim.play('Jump_Full_Short', { once: true, restart: true, speed: 1.05 / Rl.hopTime, fade: 0.06 });
  audio.play('swing', e.position.x, e.position.z);
  if (ctx.combat && ctx.combat.log) ctx.combat.log({ type: 'archerHop', enemy: e, to: { ...e.hopTo } });
}

function runHop(e, dt, ctx) {
  const Rl = e.data.ranged.roll, k = Math.min(1, e.t / Rl.hopTime);
  e.position.x = e.hopFrom.x + (e.hopTo.x - e.hopFrom.x) * k;
  e.position.z = e.hopFrom.z + (e.hopTo.z - e.hopFrom.z) * k;
  e.group.position.y = Rl.hopHeight * 4 * k * (1 - k);
  if (k >= 1) {
    e.group.position.y = 0;
    if (ctx.combat) ctx.combat.vfx.dust(e.position, new THREE.Vector3(0, 0, 0), 5);
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
  if (e.state === 'hop') return runHop(e, dt, ctx);
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
