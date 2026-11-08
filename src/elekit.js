// Bênçãos novas do Cajado Elétrico da Maga (lista do dono, 06/11/2026) — números e ganchos do lado da heroína.
// Ímã/Polaridade: mexem nos inimigos atingidos. Na sala: Poça Elétrica, Torre Tesla, Nuvem Pessoal, Rede Elétrica.
// Nos inimigos: Marionete, Curto-Circuito, Sobrecarga, Blecaute. Movimento/defesa: Passo Relâmpago, Para-choque,
// Gerador, Bateria. Raio: Arco Voltaico, Ping-Pong, Ionizar, Ossos Magnéticos. Co-op: Choque Amigo.
// O que fica na sala mora em elekit2.js (combat.ele).

export const ELE = {
  pol: { t: 5, range: 6, pull: 55, push: 40, repel: 3.5, dmg: 10, daze: 0.8 }, // Polaridade
  mag: { k: 3.5, max: 14 },                                     // Ímã: puxa ~40% da distância até o meio do grupo
  pud: { t: 3, r: 1.3, tick: 0.5, dmg: 2, max: 10 },            // Poça Elétrica
  tesla: { t: 5, tick: 0.6, range: 5.5, n: 2, dmg: 4, max: 2 }, // Torre Tesla
  cloud: { t: 5, tick: 0.8, range: 5, dmg: 6, h: 4.2 },         // Nuvem Pessoal
  net: { t: 2, tick: 0.4, dmg: 3, max: 12 },                    // Rede Elétrica
  pup: { reach: 2.6, cd: 1.5 },                                 // Marionete
  short: { mul: 2, touch: 0.6 },                                // Curto-Circuito
  over: { hits: 5, t: 2, r: 2.5, dmg: 18 },                     // Sobrecarga
  black: { t: 3, cd: 10, speed: 0.45 },                         // Blecaute (recarga de 10 s)
  dash: { dist: 5.5, t: 3, hit: 5, tick: 0.4, dmg: 3, w: 0.55 }, // Passo Relâmpago
  bump: { dmg: 4, push: 11, daze: 0.5, cd: 0.8 },               // Para-choque
  gen: { fill: 3, drain: 1, mul: 2 },                           // Gerador: barra cheia em 3 s andando = raio ×3
  bat: { max: 10, per: 3 },                                     // Bateria
  arc: { tick: 0.18, dmg: 1.5, ramp: 0.6, max: 4, reach: 1.25, delay: 0.32 }, // Arco Voltaico
  ping: { n: 4, mul: 0.6, gap: 0.12 },                          // Ping-Pong
  ion: { t: 4 },                                                // Ionizar
  bones: { dmg: 8, speed: 13, range: 8, life: 1.6 },            // Ossos Magnéticos
  friend: { heal: 2, haste: 2, mul: 1.35, cd: 0.5 },            // Choque Amigo
};

let C = null;
export const setEleCombat = (c) => { C = c; };
export const EW = (p) => (p && p.stats && p.stats.w) || {};
export const isEle = (p) => !!(p && p.heroId === 'mage' && p.hero && p.hero.weaponId === 'eletrico');

// Choque Amigo: parceiro mais rápido por 2 s.
export const eleSpeedMul = (p) => (p.eleHasteT > 0 ? ELE.friend.mul : 1);

// Passo Relâmpago: o rolamento vira um avanço em forma de raio.
export function eleStartDodge(p) {
  if (!isEle(p) || !EW(p).eDash || !C || !C.ele) return false;
  return C.ele.dash(p);
}

// Arco Voltaico: segurando o ataque depois do 1º raio, o raio fica grudado no inimigo.
export function eleHoldCheck(p, input) {
  if (!isEle(p) || !EW(p).eArc || p.xstep || p.combo !== 0 || !p.hitDone) return false;
  if (p.stateTime < ELE.arc.delay || !(input.attackHeld && input.attackHeld())) return false;
  p.setState('eleBeam');
  p.eleBeam = { t: 0, tick: 0, target: null, snd: 0 };
  p.queued = false;
  const cast = p.hero.combo[p.hero.combo.length - 1];
  p.anim.play(cast.clip, { fade: 0.12, speed: 0.5 });
  return true;
}

// Segurando o raio. 'end' = soltou o botão.
export function eleBeamTick(p, dt, input) {
  if (!(input.attackHeld && input.attackHeld()) || !C || !C.ele) { p.eleBeam = null; return 'end'; }
  C.ele.beamTick(p, dt);
  return null;
}

// Troca de arma/herói, nova partida: tudo volta ao normal.
export function eleReset(p) {
  if (C && C.ele) C.ele.dropFor(p);
  p.eleGen = 0; p.eleBat = 0; p.eleBlackCd = 0; p.eleBeam = null;
}
