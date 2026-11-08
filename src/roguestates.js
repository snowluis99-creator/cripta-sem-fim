// Estados do esqueleto das bênçãos novas das Duas Adagas (Ladino). Sem imports (axekit2.js chama daqui).
// rogueLost = Bomba de Fumaça (perdeu o Ladino de vista e fica procurando);
// rogueBlind = Areia nos Olhos (cego: cambaleia e ataca a esmo, sem acertar ninguém).
export const ROGUE_STATES = ['rogueLost', 'rogueBlind'];

const back = (e) => { e.rogueSt = null; e.setState('chase'); e.anim.play(e.data.anims.idle, { fade: 0.15 }); };

function wander(e, dt, ctx, S, speed) {
  const d = e.data;
  S.turn -= dt;
  if (S.turn <= 0) { S.ang += (Math.random() - 0.5) * 2.6; S.turn = 0.45 + Math.random() * 0.6; }
  const sp = (d.speed || 3) * speed * dt;
  const nx = e.position.x + Math.sin(S.ang) * sp, nz = e.position.z + Math.cos(S.ang) * sp;
  if (ctx.world.blocked(nx, nz, d.radius)) { S.ang += Math.PI * (0.6 + Math.random() * 0.8); S.turn = 0.4; return false; }
  e.position.x = nx; e.position.z = nz;
  return true;
}

export function rogueEnemyTick(e, dt, ctx) {
  const S = e.rogueSt;
  if (!S) return back(e);
  S.t -= dt;
  if (S.t <= 0) return back(e);
  const d = e.data;
  if (e.state === 'rogueLost') {
    wander(e, dt, ctx, S, 0.45);
    e.facing = S.ang + Math.sin(S.t * 5) * 0.7; // olhando para os lados, procurando
    e.anim.play(d.anims.walk, { speed: (d.walkAnimSpeed || 1) * 0.6 });
    return;
  }
  // Cego: anda torto e de vez em quando dá um golpe no ar.
  S.swing -= dt;
  if (S.swinging > 0) {
    S.swinging -= dt;
    if (S.swinging <= 0) e.anim.play(d.anims.walk, { speed: (d.walkAnimSpeed || 1) * 0.5, fade: 0.15 });
    return;
  }
  wander(e, dt, ctx, S, 0.35);
  e.facing = S.ang + Math.sin(S.t * 9) * 0.5;
  if (S.swing <= 0 && d.attack) {
    S.swing = 0.8 + Math.random() * 0.5;
    S.swinging = 0.55;
    S.ang += (Math.random() - 0.5) * 3;
    e.facing = S.ang;
    e.anim.play(d.attack.clip, { once: true, restart: true, speed: (d.attack.speed || 1) * 1.3, fade: 0.08 });
    S.misses = (S.misses || 0) + 1;
    if (ctx.combat && ctx.combat.rogue2) ctx.combat.rogue2.blindSwing(e);
  } else e.anim.play(d.anims.walk, { speed: (d.walkAnimSpeed || 1) * 0.5 });
}

export function rogueLeaveState(e, from) {
  if (ROGUE_STATES.includes(from)) e.rogueSt = null;
}
