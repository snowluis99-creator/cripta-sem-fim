// Magias da Maga (saem no momento do golpe, no lugar do corte de espada).
// bolt = orbe que voa e acerta o 1º esqueleto (blast = explode em área); beam = raio reto que atravessa todos;
// cone = sopro de fogo de perto. Efeitos: slow (lento), freeze (congela/imobiliza), burn (queima).
import * as THREE from 'three';
import { audio } from './audio.js';
import { getGlowTexture } from './dungeon/builder.js';

const FREEZE_BOSS = 0.5; // chefes ficam congelados metade do tempo

// Ponto de onde a magia sai (na frente do peito/cajado).
function origin(p) {
  const a = p.facing;
  return { x: p.position.x + Math.sin(a) * 0.9, z: p.position.z + Math.cos(a) * 0.9, a };
}

export function castSpell(combat, p, step) {
  const c = step.cast;
  const st = p.stats;
  const o = origin(p);
  combat.spellCount = (combat.spellCount || 0) + 1;
  if (combat.log) combat.log({ type: 'swing', hits: 0, heavy: !!step.heavy, cast: c.type });
  if (step.heavy && st.echo > 0) combat.echoWave(p, Math.round(st.echo * st.damageMul));
  const rangeMul = st.rangeMul || 1;
  if (c.type === 'bolt') {
    const n = c.count || 1;
    for (let i = 0; i < n; i++) {
      const a = o.a + (n > 1 ? THREE.MathUtils.degToRad(c.spread) * (i - (n - 1) / 2) : 0);
      combat.projectiles.fire(o.x, o.z, a, {
        speed: c.speed, damage: step.damage, kind: c.star ? 'star' : c.shard ? 'shard' : 'orb', color: c.color, scale: c.size,
        hits: 'spell', owner: p, step, life: (p.hero.attackRange * rangeMul) / c.speed, height: 1.25, silent: true,
      });
    }
    audio.play(step.heavy ? 'swingHeavy' : 'orb', o.x, o.z);
    return;
  }
  if (c.type === 'beam') {
    const len = c.length * rangeMul, fx = Math.sin(o.a), fz = Math.cos(o.a);
    combat.vfx.beamLine(new THREE.Vector3(o.x, 1.25, o.z), new THREE.Vector3(o.x + fx * len, 1.25, o.z + fz * len), c.color, c.width);
    audio.play('swingHeavy', o.x, o.z);
    let hits = 0;
    for (const e of [...combat.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - o.x, dz = e.position.z - o.z;
      const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (along < -0.5 || along > len || side > c.width / 2 + e.data.radius) continue;
      if (spellHit(combat, p, e, step, fx, fz)) hits++;
    }
    hitFeel(combat, p, step, hits, o);
    return;
  }
  if (c.type === 'cone') {
    const range = c.range * rangeMul, half = THREE.MathUtils.degToRad(c.arc / 2);
    combat.vfx.flameCone(new THREE.Vector3(p.position.x, 1.1, p.position.z), o.a, range, half, c.color, step.heavy);
    audio.play('swingHeavy', o.x, o.z);
    let hits = 0;
    for (const e of [...combat.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      let da = Math.atan2(dx, dz) - o.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (d > range + e.data.radius || Math.abs(da) > half) continue;
      if (spellHit(combat, p, e, step, dx / d, dz / d)) hits++;
    }
    hitFeel(combat, p, step, hits, o);
    return;
  }
  if (c.type === 'nova') { // explosão de fogo em volta da Maga: acerta todos perto, em 360°
    const radius = c.radius * rangeMul;
    const at = new THREE.Vector3(p.position.x, 0, p.position.z);
    combat.vfx.flameCone(new THREE.Vector3(p.position.x, 1.0, p.position.z), o.a, radius * 0.75, Math.PI, c.color, true);
    combat.vfx.flameCone(new THREE.Vector3(p.position.x, 0.6, p.position.z), o.a + Math.PI, radius * 0.6, Math.PI, 0xff7a2a, true);
    combat.vfx.ring(at, c.color, radius);
    combat.vfx.heavyImpact(at, radius / 2.3);
    audio.play('boom', o.x, o.z);
    let hits = 0;
    for (const e of [...combat.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > radius + e.data.radius) continue;
      if (spellHit(combat, p, e, step, dx / d, dz / d)) hits++;
    }
    hitFeel(combat, p, step, hits, o);
  }
}

function hitFeel(combat, p, step, hits, o) {
  if (!hits) return;
  combat.endCounter(p, hits);
  audio.play(step.heavy ? 'hitHeavy' : 'hit', o.x, o.z);
  combat.addHitstop(step.heavy ? 0.07 : 0.03);
  combat.shakeFor(p, step.heavy ? 0.2 : 0.06);
}

// Um esqueleto atingido por magia (orbe, raio ou fogo). Devolve true se acertou.
export function spellHit(combat, p, e, step, nx, nz) {
  const c = step.cast;
  const r = combat.damageEnemy(p, e, step, nx, nz, { spell: true });
  if (!r) return false;
  if (!e.alive) return true;
  // Lento e congelar só pegam esqueleto andando/parado: magia nunca corta um ataque ou habilidade no meio.
  const busy = e.state !== 'chase' && e.state !== 'idle' && e.state !== 'block';
  if (c.slow && !busy) e.slow = Math.max(e.slow || 0, c.slow);
  if (c.burn) { e.burn = 3; e.burnDps = c.burn * p.stats.damageMul; e.burnTick = 0.5; e.burnBy = p; }
  // Congelar (3º golpe do Cajado de Gelo) pega sempre, até no meio de um golpe ou habilidade.
  if (c.freeze && e.freeze) e.freeze(c.freeze * (e.data.boss ? FREEZE_BOSS : 1), combat);
  return true;
}

// Orbe acertou alguém (ou explodiu): dano no alvo + explosão em área (blast).
export function boltImpact(combat, a, target) {
  const step = a.step, c = step.cast, p = a.owner;
  const sp = Math.hypot(a.vx, a.vz) || 1, nx = a.vx / sp, nz = a.vz / sp;
  let hits = 0;
  if (target && spellHit(combat, p, target, step, nx, nz)) hits++;
  if (c.blast) {
    const at = new THREE.Vector3(a.x, 0, a.z);
    const radius = c.blast * (p.stats.heavyRadiusMul || 1);
    combat.vfx.heavyImpact(at, radius / 2.3);
    combat.vfx.ring(at, c.color, radius);
    for (const e of [...combat.enemies]) {
      if (e === target || !e.targetable) continue;
      const dx = e.position.x - a.x, dz = e.position.z - a.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > radius + e.data.radius) continue;
      if (spellHit(combat, p, e, step, dx / d, dz / d)) hits++;
    }
  } else combat.vfx.sparks(new THREE.Vector3(a.x, 1.2, a.z), c.color, 8);
  hitFeel(combat, p, step, hits, a);
}

// Bloco de gelo em volta de um esqueleto/herói congelado (some sozinho).
const iceGeo = new THREE.IcosahedronGeometry(1, 1);
export function makeIceBlock(radius, height) {
  const m = new THREE.Mesh(iceGeo, new THREE.MeshStandardMaterial({
    color: 0xcff4ff, emissive: 0x4fb8ff, emissiveIntensity: 0.35, transparent: true, opacity: 0.55, roughness: 0.1, depthWrite: false,
  }));
  m.scale.set(radius * 1.25, height * 0.62, radius * 1.25);
  m.position.y = height * 0.5;
  m.renderOrder = 2;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0x8fe3ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 }));
  s.scale.setScalar(radius * 3);
  s.position.y = height * 0.5;
  const g = new THREE.Group();
  g.add(m, s);
  g.userData.mat = m.material;
  g.userData.glow = s.material;
  return g;
}
