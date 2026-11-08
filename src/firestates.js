// Estado do esqueleto da bênção Pânico (Cajado de Fogo): pegando fogo, corre sem rumo e põe fogo em quem encostar.
// Sem imports de combate (axekit2.js chama daqui; o FireKit fica em combat.fire2).
export const FIRE_STATES = ['firePanic'];
const PANIC = { speed: 1.4, touch: 0.2 };

const back = (e) => { e.firePanic = null; e.setState('chase'); e.anim.play(e.data.anims.idle, { fade: 0.15 }); };

export function fireEnemyTick(e, dt, ctx) {
  const c = ctx.combat, d = e.data, F = e.firePanic;
  if (!F || !(e.firePanicT > 0) || !(e.burn > 0)) return back(e);
  F.turn -= dt;
  if (F.turn <= 0) { F.ang += (Math.random() - 0.5) * 2.2; F.turn = 0.35 + Math.random() * 0.5; }
  const sp = (d.speed || 3) * PANIC.speed * dt;
  const nx = e.position.x + Math.sin(F.ang) * sp, nz = e.position.z + Math.cos(F.ang) * sp;
  if (ctx.world.blocked(nx, nz, d.radius)) { F.ang += Math.PI * (0.6 + Math.random() * 0.8); F.turn = 0.4; }
  else { e.position.x = nx; e.position.z = nz; }
  e.facing = F.ang + Math.sin(e.t * 14) * 0.35; // se debatendo
  e.anim.play(d.anims.walk, { speed: (d.walkAnimSpeed || 1) * 1.7 });
  if (Math.random() < dt * 12) c.vfx.sparks(e.position.clone().setY(1.4), 0xff7a2a, 1);
  // Encostou em outro esqueleto: ele pega fogo também.
  if (!c.fire2) return;
  for (const o of c.enemies) {
    if (o === e || !o.targetable || o.undead) continue;
    if (Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) > o.data.radius + d.radius + PANIC.touch) continue;
    c.fire2.panicTouch(e, o);
  }
}

export function fireLeaveState(e, from) {
  if (from === 'firePanic') e.firePanic = null;
}
