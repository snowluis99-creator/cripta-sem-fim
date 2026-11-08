// Bênçãos do Mangual e Escudo (lista do dono, 06/11/2026) que mudam o combate.
// - Corrente Enroscada: o golpe forte enterra (1,5 s) o inimigo mais distante atingido.
// - Impacto Sísmico: o golpe forte marca os atingidos (6 s): marcados sofrem mais dano.
// - Estrela da Manhã: o 1º e o 2º golpe atordoam 1 s.
// - Corrente: escudo segurou flecha/magia → a corrente vai em quem atirou e puxa (usa o gancho do knightkit).
// - Reflexo: bloqueou → lança a bola do mangual no inimigo mais distante (sem levar dano durante e por 1 s depois).
// Rodopio (destrói projéteis) e Equilíbrio (atacar defendendo) ficam em combat.js / player.js.
import * as THREE from 'three';
import { audio } from './audio.js';

export const FLAIL = {
  snare: { time: 1.5, boss: 0.5, depth: 0.95, bossDepth: 0.45 }, // Corrente Enroscada: enterra
  seismic: { time: 6 },
  star: { time: 1, boss: 0.5 },
  chain: { range: 18 },
  lash: { range: 14, out: 0.16, hold: 0.06, back: 0.2, after: 1.0 }, // Reflexo: ponta lançada até o mais distante
};

// Reflexo: golpe automático que lança a bola do mangual, esticando a corrente até o inimigo mais distante.
export const LASH_STEP = { clip: 'Melee_1H_Attack_Chop', speed: 1.15, hit: 0.42, end: 0.9, lunge: 0, damage: 13, kit: 'flailLash', keepFacing: true };
const lashes = []; // { p, e, x, z, t, hit }

const W = (p) => (p && p.stats && p.stats.w) || {};
export const isFlail = (p) => !!(p && p.heroId === 'knight' && p.hero && p.hero.weaponId === 'mangual');
const stunMul = (p) => 1 + (W(p).stun || 0); // Pancada Atordoante vale para tudo que atordoa

const marks = new Map();  // inimigo -> anel no chão (Impacto Sísmico)
const snares = new Map(); // inimigo -> { g, t } (Corrente Enroscada)
let metal = null;
const metalMat = () => metal || (metal = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.45, metalness: 0.7 }));

// Depois do dano de um golpe corpo a corpo (wbhooks.wbOnHit), antes do "atordoa mais tempo".
export function flailOnHit(c, p, e, step) {
  const w = W(p);
  if (!e.alive) return;
  // Estrela da Manhã: 1º e 2º golpe atordoam.
  if (w.morningStar && !step.heavy && e.daze) {
    const t = e.data.boss ? FLAIL.star.boss : FLAIL.star.time;
    if (e.daze(t)) { e.t = 0; c.text.add('Atordoado!', e.position, 'hurt', 3.2); if (c.log) c.log({ type: 'flailStar', enemy: e }); }
  }
  if (!step.heavy) return;
  // Impacto Sísmico: marca.
  if (w.seismic) {
    e.markT = Math.max(e.markT || 0, FLAIL.seismic.time);
    e.markMul = Math.max(e.markMul || 0, w.seismic);
    e.seismicT = FLAIL.seismic.time;
    c.text.add('Marcado!', e.position, 'crit', 3.4);
    if (c.log) c.log({ type: 'flailMark', enemy: e });
  }
  // Corrente Enroscada: guarda o mais distante deste golpe.
  if (w.snare) {
    const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
    const s = p.snarePick;
    if (!s || s.seq !== p.swingSeq || d > s.d) p.snarePick = { seq: p.swingSeq, e, d };
  }
}

// Fim do golpe (combat.playerStrike): aplica a Corrente Enroscada.
export function flailAfterStrike(c, p, step) {
  const s = p.snarePick;
  p.snarePick = null;
  if (!step.heavy || !s || s.seq !== p.swingSeq || !W(p).snare) return;
  const e = s.e;
  if (!e.alive || !e.targetable || !e.daze) return;
  const t = (e.data.boss ? FLAIL.snare.boss : FLAIL.snare.time) * stunMul(p);
  if (!e.daze(t)) return;
  e.vel.set(0, 0, 0);
  c.text.add('Enterrado!', e.position, 'block', 3.4);
  audio.play('headThud', e.position.x, e.position.z, { v: 0.9 });
  c.vfx.dust(new THREE.Vector3(e.position.x, 0.1, e.position.z), new THREE.Vector3(0, 1, 0), 14);
  addSnare(c, e, t);
  if (c.log) c.log({ type: 'flailSnare', enemy: e, d: s.d });
}

// Montinho de terra em volta do enterrado (o modelo afunda no chão enquanto dura).
let dirtMat = null;
function addSnare(c, e, t) {
  let s = snares.get(e);
  if (!s) {
    const g = new THREE.Group();
    const mat = dirtMat || (dirtMat = new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 1 }));
    const r = Math.max(0.55, e.data.radius * 1.15);
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 1.25, 0.28, 14, 1), mat);
    mound.position.y = 0.1;
    g.add(mound);
    for (let i = 0; i < 7; i++) { // torrões
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + Math.random() * 0.07, 0), mat);
      m.position.set(Math.sin(a) * r * 1.2, 0.08, Math.cos(a) * r * 1.2);
      g.add(m);
    }
    c.scene.add(g);
    s = { g, t: 0, total: 0, depth: e.data.boss ? FLAIL.snare.bossDepth : FLAIL.snare.depth };
    snares.set(e, s);
  }
  s.t = Math.max(s.t, t);
  s.total = Math.max(s.total, s.t);
}
function unbury(c, e, s) {
  c.scene.remove(s.g);
  if (e.model) e.model.position.y = 0;
  snares.delete(e);
}

// Corrente: o escudo segurou uma flecha/magia de "shooter".
export function flailShotBlocked(c, p, shooter) {
  if (!W(p).chainPull || !isFlail(p) || !c.kit) return;
  if (!shooter || !shooter.targetable || !c.enemies.includes(shooter)) return;
  if (c.kit.hooks.some((h) => h.p === p)) return; // já tem uma corrente indo/puxando
  const dx = shooter.position.x - p.position.x, dz = shooter.position.z - p.position.z;
  if (Math.hypot(dx, dz) > FLAIL.chain.range) return;
  c.kit.fireHook(p, { target: shooter, range: FLAIL.chain.range });
  c.text.add('Corrente!', p.position, 'crit', 3.2);
  if (c.log) c.log({ type: 'flailChain', enemy: shooter });
}

// Reflexo: escolhe o inimigo mais distante (até FLAIL.lash.range) para lançar a bola. null = ninguém.
export function flailCounterTarget(c, p) {
  let best = null, bd = -1;
  for (const e of c.enemies) {
    if (!e.targetable || e.ally || e.undead) continue;
    const d = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z);
    if (d <= FLAIL.lash.range && d > bd) { bd = d; best = e; }
  }
  return best;
}

// Golpe do Reflexo (combat.playerStrike): a bola sai voando até o alvo guardado em p.flailLashTarget.
export function flailStrike(c, p, step) {
  if (step.kit !== 'flailLash') return false;
  const e = p.flailLashTarget; p.flailLashTarget = null;
  const fx = Math.sin(p.facing), fz = Math.cos(p.facing);
  const x = e ? e.position.x : p.position.x + fx * 6, z = e ? e.position.z : p.position.z + fz * 6;
  const L = FLAIL.lash;
  p.iframes = Math.max(p.iframes, L.out + L.hold + L.back + L.after); // sem dano durante o lançamento e por 1 s depois
  for (let i = lashes.length - 1; i >= 0; i--) if (lashes[i].p === p) lashes.splice(i, 1);
  lashes.push({ p, e, x, z, t: 0, hit: false, step });
  audio.play('swingHeavy', p.position.x, p.position.z);
  if (c.log) c.log({ type: 'flailLash', enemy: e });
  return true;
}

function lashTick(c, dt) {
  const L = FLAIL.lash;
  for (let i = lashes.length - 1; i >= 0; i--) {
    const l = lashes[i], p = l.p, f = p.weapon && p.weapon.userData.flail;
    l.t += dt;
    if (l.e && l.e.alive && !l.hit) { l.x = l.e.position.x; l.z = l.e.position.z; }
    const k = l.t < L.out ? l.t / L.out : l.t < L.out + L.hold ? 1 : Math.max(0, 1 - (l.t - L.out - L.hold) / L.back);
    if (!l.hit && l.t >= L.out) {
      l.hit = true;
      const e = l.e;
      if (e && e.alive && e.targetable && c.enemies.includes(e)) {
        const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
        c.damageEnemy(p, e, l.step, dx / d, dz / d);
        c.vfx.sparks(new THREE.Vector3(e.position.x, 1.1, e.position.z), 0xffe0a0, 12);
        c.shakeFor(p, 0.15);
        c.addHitstop(0.05);
        audio.play('hitHeavy', e.position.x, e.position.z);
      }
    }
    if (l.t >= L.out + L.hold + L.back || p.state === 'dead' || !f) {
      if (f) f.lash = null;
      lashes.splice(i, 1);
      continue;
    }
    f.lash = { x: l.x, y: 1.1, z: l.z, k: Math.max(0.0001, k) };
  }
}

// A cada quadro (wbhooks.wbTick): anéis das marcas e correntes nas pernas.
export function flailTick(c, dt) {
  lashTick(c, dt);
  for (const e of c.enemies) {
    if (e.seismicT > 0) {
      e.seismicT -= dt;
      if (!marks.has(e) && e.alive) {
        const m = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 24).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
        c.scene.add(m);
        marks.set(e, m);
      }
    }
  }
  for (const [e, m] of marks) {
    if (!(e.seismicT > 0) || !e.alive || !c.enemies.includes(e)) { c.scene.remove(m); m.geometry.dispose(); m.material.dispose(); marks.delete(e); continue; }
    m.position.set(e.position.x, 0.06, e.position.z);
    m.material.opacity = 0.45 + 0.3 * Math.sin(performance.now() / 120) * Math.min(1, e.seismicT);
  }
  for (const [e, s] of snares) { // Corrente Enroscada: afunda, fica preso e sai do chão
    s.t -= dt;
    if (s.t <= 0 || !e.alive || !c.enemies.includes(e) || e.frozenT > 0 || ['held', 'thrown', 'dead'].includes(e.state)) {
      if (e.alive && s.t <= 0) c.vfx.dust(new THREE.Vector3(e.position.x, 0.1, e.position.z), new THREE.Vector3(0, 1, 0), 8);
      unbury(c, e, s); continue;
    }
    if (e.state === 'hurt') e.stunTime = Math.max(e.stunTime || 0, s.t);
    e.vel.set(0, 0, 0);
    const el = s.total - s.t, k = Math.min(1, el / 0.12, s.t / 0.2);
    if (e.model) e.model.position.y = -s.depth * k;
    s.g.position.set(e.position.x, 0, e.position.z);
  }
}

export function flailClear(c) {
  for (const l of lashes) { const f = l.p.weapon && l.p.weapon.userData.flail; if (f) f.lash = null; }
  lashes.length = 0;
  for (const m of marks.values()) c.scene.remove(m);
  for (const [e, s] of [...snares]) unbury(c, e, s);
  marks.clear();
}
