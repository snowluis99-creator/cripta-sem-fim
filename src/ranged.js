// Ataques à distância: o Arqueiro (mantém distância, foge se o herói chega perto e atira com a besta)
// e a saraivada de flechas do Guardião enfurecido. Sem aviso: só a pose de mirar.
import { stepToward, fleePoint, aimAngle, targetBusy } from './brain.js';
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
  let tx = null, tz = null, run = false;
  if (dist < R.flee) {
    const f = fleePoint(e, ctx, dist);
    if (f) { tx = f.x; tz = f.z; run = true; }
    else { tx = e.position.x + (dz / dist) * 3 * e.strafe; tz = e.position.z - (dx / dist) * 3 * e.strafe; run = true; } // encurralado: escapa de lado
  } else if (dist > R.max || !shot) { tx = p.position.x; tz = p.position.z; }      // chega mais perto / procura mira
  else { tx = e.position.x + (dz / dist) * 2 * e.strafe; tz = e.position.z - (dx / dist) * 2 * e.strafe; } // anda de lado
  const moved = tx !== null && stepToward(e, ctx, dt, tx, tz, run ? 1.25 : 1);
  if (moved) e.anim.play(run ? 'Running_A' : d.anims.walk, { speed: run ? 1.1 : d.walkAnimSpeed });
  else e.anim.play(d.anims.idle);
  return false;
}

function startShot(e, R) {
  e.releaseToken();
  e.setState('aim');
  e.shot = R;
  e.hitDone = false;
  e.anim.play(R.aimClip, { fade: 0.12 });
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
    // Mira onde o herói vai estar (projéteis que seguem o herói miram menos na frente).
    const aim = R.homing ? toPlayer : aimAngle(e, ctx.player, R.speed);
    return e.t < R.aim - 0.12 ? { target: aim, turn: R.turn ?? 9 } : null; // trava a mira no fim
  }
  // 'shot': recuo do disparo.
  if (e.t >= R.recover) {
    if (!e.data.volley || e.shot !== e.data.volley) e.cooldown = rand(e.data.cooldown);
    e.setState('chase');
    e.anim.play(e.data.anims.idle, { fade: 0.15 });
  }
  return null;
}
