// Estados do esqueleto das bênçãos do Cajado Arcano (sem imports, para não criar ciclos com axekit2.js).
// orbFloat = Levitar (flutuando indefeso); orbBubble = Bolha Arcana (preso na bolha). Quem mexe é combat.arcane.
export const ORB_STATES = ['orbFloat', 'orbBubble'];

export function arcEnemyTick(e, dt, ctx) {
  const k = ctx && ctx.combat && ctx.combat.arcane;
  if (k) k.enemyTick(e, dt);
}

// Saiu do estado no meio (morreu, congelou...): volta ao chão e tira a bolha.
export function arcLeaveState(e, from) {
  if (!ORB_STATES.includes(from)) return;
  e.position.y = 0;
  if (e.model) { e.model.rotation.x = 0; e.model.rotation.z = 0; }
  e.arcLev = null;
  if (e.arcBubble) { e.arcBubble.gone = true; e.arcBubble = null; }
}
