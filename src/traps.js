// Armadilhas de espinho (andar 2+). Ciclo de cada placa (em segundos, com atraso "phase" por placa):
// escondido -> os espinhos tremem um pouco para fora -> sobem de uma vez (machucam) -> ficam em cima -> descem.
// Machucam o herói (rolando passa) e também os esqueletos (dá para atrair eles para a armadilha).
import * as THREE from 'three';

export const SPIKES = {
  period: 3.4,
  peek: 2.0,      // começa a aparecer (só a pontinha)
  rise: 2.45,     // sobe de uma vez
  down: 3.15,     // começa a descer
  heroDamage: 14,
  enemyDamage: 20,
  half: 1.15,     // metade do quadrado com espinhos
};
const HIDDEN = -2.05, PEEK = -1.75;

// visual = true: só mexe os espinhos (co-op: computador do Jogador 2; o dano é do anfitrião).
export function updateSpikes(spikes, dt, time, combat, visual = false) {
  if (!spikes || !spikes.length) return;
  const S = SPIKES;
  for (const s of spikes) {
    const t = ((time + s.phase) % S.period + S.period) % S.period;
    let y = HIDDEN, deadly = false;
    if (t >= S.peek && t < S.rise) y = PEEK + Math.sin(t * 60) * 0.03;
    else if (t >= S.rise && t < S.down) { y = Math.min(0, PEEK + (t - S.rise) * 40); deadly = true; }
    else if (t >= S.down) y = Math.max(HIDDEN, -((t - S.down) / (S.period - S.down)) * 2.05);
    if (t < S.rise) s.hit.clear();
    if (deadly && !s.wasUp && !visual) { combat.vfx.dust(new THREE.Vector3(s.x, 0, s.z), new THREE.Vector3(0, 0, 0), 4); }
    s.wasUp = deadly;
    s.obj.position.y = y;
    s.up = deadly;
    if (!deadly || visual) continue;
    const inside = (pos, r) => Math.abs(pos.x - s.x) < S.half + r && Math.abs(pos.z - s.z) < S.half + r;
    // Rolando por cima: passa ileso (mas se parar em cima, machuca).
    for (const p of combat.players) {
      if (s.hit.has(p) || p.state === 'dead' || p.state === 'dodge' || !inside(p.position, p.hero.radius * 0.4)) continue;
      s.hit.add(p);
      // A "origem" fica atrás do herói: o escudo não protege dos espinhos.
      const src = { position: new THREE.Vector3(p.position.x - Math.sin(p.facing), 0, p.position.z - Math.cos(p.facing)), alive: false, data: { boss: true } };
      const hurt = combat.hitPlayer(src, S.heroDamage, { push: 3, noRepel: true, contact: true, target: p });
      if (combat.log) combat.log({ type: 'spike', who: 'hero', hurt });
    }
    for (const e of combat.enemies) {
      if (!e.targetable || e.data.boss || s.hit.has(e) || e.state === 'leap') continue;
      if (!inside(e.position, e.data.radius * 0.5)) continue;
      s.hit.add(e);
      const died = e.takeDamage(S.enemyDamage, 0, 0, 1, false);
      combat.text.add(String(S.enemyDamage), e.position, 'dmg');
      combat.vfx.sparks(new THREE.Vector3(e.position.x, 0.8, e.position.z), 0xffffff, 6);
      if (combat.log) combat.log({ type: 'spike', who: e.type, died });
      if (died) combat.killed(e, 0, 1);
    }
  }
}
