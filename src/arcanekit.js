// Bênçãos novas do Cajado Arcano da Maga (lista do dono, 06/11/2026) — números e ganchos do lado da heroína.
// Orbe que erra: Ponto de Estouro, Mina Arcana, Órbita. Orbe grande: Bolha, Esfera Moedora, Encolher, Levitar,
// Troca de Lugar, Repulsor. Na sala: Triângulo Arcano, Constelação. Ritmo: Ressonância, Carga Paciente, Fusão, Devorador.
// Diferentes: Pancada de Cajado, Armadura Arcana, Piscar, Gêmea Arcana, Caos Arcano.
// O que fica na sala (minas, runas, estrelas, bolhas, gêmea...) mora em arcanekit2.js (combat.arcane).
import * as THREE from 'three';

export const ARC = {
  burst: { r: 1.6 },                                                    // Ponto de Estouro: raio da explosão
  bash: { near: 1.6, reach: 2.4, arc: 200, mul: 1.6, min: 5, push: 3.2, daze: 1.0, boss: 0.4 }, // Pancada de Cajado
  armor: { max: 5, per: 3 },                                            // Armadura Arcana
  bubble: { t: 3, r: 2.6, dmg: 14 },                                    // Bolha Arcana
  grind: { speed: 0.35, size: 1.35, tick: 0.25, mul: 0.4, range: 1.25 }, // Esfera Moedora
  mine: { max: 8, life: 15, trig: 1.0, r: 2.0, mul: 2, arm: 0.3 },     // Mina Arcana
  orbit: { t: 4, r: 1.9, spin: 3.4, back: 20, cd: 0.6, max: 10 },      // Órbita
  rune: { max: 3, tick: 0.4, dmg: 3, w: 0.6, slow: 1.5 },              // Triângulo Arcano
  star: { t: 6, range: 7, links: 3, tick: 0.6, dmg: 2 },               // Constelação
  shrink: { t: 4, k: 0.55 },                                            // Encolher
  lev: { t: 2, h: 1.7, dmg: 12 },                                       // Levitar
  swap: { iframes: 0.4 },                                               // Troca de Lugar
  repel: { r: 3.5, push: 16, daze: 0.5 },                              // Repulsor
  res: { t: 1, r: 3, dmg: 22 },                                         // Ressonância
  patient: { wait: 2, every: 0.5, max: 5 },                            // Carga Paciente
  fuse: { seek: 9, boost: 1.7, grow: 1.3, max: 3 },                    // Fusão
  devour: { grow: 1.15, dmg: 1.25, max: 3 },                           // Devorador
  blink: { dist: 5.5, t: 1, r: 2.2, dmg: 10 },                         // Piscar
  twin: { t: 3, side: 1.6 },                                            // Gêmea Arcana
  chaos: { every: 8 },                                                  // Caos Arcano
};

// Tipos do Caos Arcano (efeito do cajado daquele elemento).
export const CHAOS = [
  { id: 'gelo', name: 'Gelo', color: 0x8fe3ff, fx: { freeze: 1.5 } },
  { id: 'fogo', name: 'Fogo', color: 0xff6a1a, fx: { burn: 3 } },
  { id: 'raio', name: 'Raio', color: 0x7fd8ff, fx: { chain: 3 } },
  { id: 'sombra', name: 'Sombra', color: 0x9a4dff, fx: { darkMark: true } },
  { id: 'veneno', name: 'Veneno', color: 0x7dff5a, fx: { poison: true } },
];

let C = null;
export const setArcCombat = (c) => { C = c; };
export const W = (p) => (p && p.stats && p.stats.w) || {};
export const isArc = (p) => !!(p && p.heroId === 'mage' && p.hero && p.hero.weaponId === 'cajado');

// Começo de uma magia de orbe. true = virou outra coisa (Pancada de Cajado: sem orbe).
export function arcBeforeCast(c, p, step) {
  if (!isArc(p) || !c.arcane) return false;
  return !!(W(p).aBash && c.arcane.staffBash(p, step));
}

// Ficha de cada conjuração (os orbes do mesmo golpe dividem: Troca de Lugar só uma vez, Bolha não estoura com o irmão).
let castN = 0;
export function arcCastToken(c, p, step) {
  if (!isArc(p) || !c.arcane) return null;
  const idx = p.hero.combo.indexOf(step);
  // Ressonância: o 1º golpe do combo começa a contagem de novo.
  if (idx === 0) p.arcRes = p.hero.combo.map(() => new Set());
  return { id: ++castN, idx, swapped: false, twin: false };
}

// Cada orbe disparado (da Maga ou da Gêmea): marca e aplica Esfera Moedora / Caos Arcano.
export function arcDecorate(c, p, step, a, tok) {
  if (!a) return;
  const w = W(p);
  a.arcP = p; a.castId = tok.id; a.comboIdx = tok.idx; a.tok = tok; a.fromTwin = tok.twin;
  if (step.heavy && w.aGrind) { // Esfera Moedora: bem devagar, maior, atravessa todos
    const G = ARC.grind;
    a.vx *= G.speed; a.vz *= G.speed; a.speed *= G.speed; a.life *= G.range / G.speed;
    a.scale *= G.size; a.r *= G.size; a.g.scale.setScalar(a.scale);
    a.grind = { tick: 0 }; a.noSteer = true; a.pierceLeft = 0;
    // Visual: bola translúcida lilás (o miolo branco sólido ficava pesado demais nesse tamanho).
    a.g.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: 0xe2c6ff, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }); });
  }
  if (w.aChaos && !tok.twin) { // Caos Arcano: a cada 8 orbes, o próximo sai de um tipo aleatório
    if (p.arcChaosNext) {
      p.arcChaosNext = false; p.arcOrbN = 0;
      const t = CHAOS[Math.floor(Math.random() * CHAOS.length)];
      a.chaos = t.id;
      a.step = { ...a.step, cast: { ...a.step.cast, ...t.fx, color: t.color } };
      a.color = t.color;
      a.g.traverse((o) => { if (o.isSprite) o.material.color.setHex(t.color); });
      c.text.add(`Caos: ${t.name}!`, p.position, 'crit', 3.4);
      if (c.log) c.log({ type: 'arcChaos', kind: t.id });
    } else if ((p.arcOrbN = (p.arcOrbN || 0) + 1) >= ARC.chaos.every) p.arcChaosNext = true;
  }
}

// Depois de soltar os orbes: Carga Paciente, Gêmea Arcana, runa do Triângulo.
export function arcAfterCast(c, p, step, tok) {
  const w = W(p), k = c.arcane;
  if (tok.twin) return;
  if (w.aPatient && p.arcCharge > 0) k.fireCharge(p, tok);
  k.twinsCast(p, step, tok);
  if (step.heavy) {
    if (w.aRunes) k.addRune(p);
    if (w.aTwin) k.spawnTwin(p);
  }
}

// Dispara orbes iguais aos do golpe a partir de (x, z) virados para o ângulo a (Gêmea, Carga Paciente).
export function fireOrbs(c, p, step, x, z, a, tok, n = null) {
  const cst = step.cast, cnt = n ?? (cst.count || 1), rangeMul = p.stats.rangeMul || 1;
  const spread = n ? 12 : (cst.spread || 14);
  for (let i = 0; i < cnt; i++) {
    const ang = a + (cnt > 1 ? THREE.MathUtils.degToRad(spread) * (i - (cnt - 1) / 2) : 0);
    const pr = c.projectiles.fire(x, z, ang, {
      speed: cst.speed, damage: step.damage, kind: 'orb', color: cst.color, scale: cst.size,
      hits: 'spell', owner: p, step, life: (p.hero.attackRange * rangeMul) / cst.speed, height: 1.25, silent: true,
    });
    arcDecorate(c, p, step, pr, tok);
  }
}

// Piscar: o rolamento vira teletransporte.
export function arcStartDodge(p) {
  if (!isArc(p) || !W(p).aBlink || !C || !C.arcane) return false;
  return C.arcane.blink(p);
}

// Troca de arma/herói, nova partida: tudo volta ao normal.
export function arcReset(p) {
  if (C && C.arcane) C.arcane.dropFor(p);
  p.arcArmor = 0; p.arcCharge = 0; p.arcChargeT = 0; p.arcIdle = 0; p.arcOrbN = 0; p.arcChaosNext = false; p.arcRes = null;
}
