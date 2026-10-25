// Dificuldade BRUTAL (pedido do dono, 24/10/2026): tudo aqui, para ajustar fácil.
// Aplicado uma vez nos dados dos inimigos (enemies.js) ao carregar.
export const DIFF = {
  // Esqueletos comuns
  hp: 1.25,            // vida (lacaio 38: um combo inteiro do Cavaleiro ainda derruba)
  speed: 1.15,         // andar
  attackSpeed: 1.1,    // golpe sai mais rápido (menos tempo para reagir)
  cooldown: 0.6,       // tempo entre um ataque e outro (menor = ataca mais)
  abilityRate: 1.25,   // salto, investida, sumir… acontecem 25% mais vezes
  // Chefes
  bossHp: { guardian: 1.9, necromancer: 1.6, reaper: 1.5 },
  bossSpeed: 1.1,
  bossCooldown: 0.75,
  bossAbilityRate: 1.3,
  rageAt: { guardian: 0.6 },                // Rei Skullbone se enfurece com 60% da vida
  phaseAt: { necromancer: [0.75, 0.45], reaper: [0.6] },
  // Salas (run.js / waves.js)
  waveMult: 1.35,      // esqueletos por onda (sozinho)
  coopWaveMult: 2.3,   // no co-op
  coopBossMul: 2.7,    // vida do chefe no co-op
  floorDmg: [1.4, 1.6, 1.8], // dano dos inimigos por andar (era 1 / 1,15 / 1,25)
};

const scaleArr = (a, k) => (Array.isArray(a) ? a.map((v) => v * k) : a);

function tuneStats(s, boss) {
  if (!s) return;
  if (s.cooldown) s.cooldown = scaleArr(s.cooldown, boss ? DIFF.bossCooldown : DIFF.cooldown);
  if (s.speed) s.speed *= boss ? DIFF.bossSpeed : DIFF.speed;
  if (!boss && s.attack?.speed) s.attack = { ...s.attack, speed: s.attack.speed * DIFF.attackSpeed };
}

export function applyDifficulty(ENEMIES) {
  for (const [type, d] of Object.entries(ENEMIES)) {
    if (d._tuned) continue;
    d._tuned = true;
    const boss = !!d.boss;
    d.hp = Math.round(d.hp * (boss ? DIFF.bossHp[type] || 1.5 : DIFF.hp));
    tuneStats(d, boss);
    d.abilityRate = boss ? DIFF.bossAbilityRate : DIFF.abilityRate;
    if (d.rage) { if (DIFF.rageAt[type]) d.rage.at = DIFF.rageAt[type]; tuneStats(d.rage.stats, true); }
    if (d.phases) d.phases.forEach((ph, i) => {
      if (DIFF.phaseAt[type]?.[i] != null) ph.at = DIFF.phaseAt[type][i];
      tuneStats(ph.stats, true);
    });
  }
}
