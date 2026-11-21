// Estados do esqueleto das bênçãos comuns do Cavaleiro (sem imports, para não criar ciclos com axekit2.js).
// kcLift = Aliado dos Ventos (levantado pelo redemoinho do Machado). Quem mexe é combat.kc (kckit.js).
export const KC_STATES = ['kcLift'];

export function kcEnemyTick(e, dt, ctx) {
  const k = ctx && ctx.combat && ctx.combat.kc;
  if (k) k.liftTick(e, dt);
}

// Saiu do estado no meio (morreu, congelou...): volta ao chão.
export function kcLeaveState(e, from) {
  if (!KC_STATES.includes(from)) return;
  e.position.y = 0;
  if (e.model) { e.model.rotation.x = 0; e.model.rotation.z = 0; }
  e.kcLift = null;
}
