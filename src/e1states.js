// Estados do esqueleto das bênçãos ÉPICAS, lote 1 (sem imports, para não criar ciclos com axekit2.js).
// e1Pit = Chute Espartano (caiu no poço). Quem mexe é combat.e1 (e1kit.js).
export const E1_STATES = ['e1Pit'];

export function e1EnemyTick(e, dt, ctx) {
  const k = ctx && ctx.combat && ctx.combat.e1;
  if (k) k.pitTick(e, dt);
}

// Saiu do estado no meio (congelou, morreu...): volta ao chão e aparece de novo.
export function e1LeaveState(e, from) {
  if (!E1_STATES.includes(from)) return;
  if (e.model) { e.model.position.y = 0; e.model.rotation.x = 0; }
  if (e.hp > 0) e.group.visible = true;
  if (e.e1Pit && e.e1Pit.pit) e.e1Pit.pit.e = null;
  e.e1Pit = null;
}
