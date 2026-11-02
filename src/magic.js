// Magias da Maga (saem no momento do golpe, no lugar do corte de espada).
// bolt = orbe que voa e acerta o 1º esqueleto (blast = explode em área); beam = raio reto que atravessa todos;
// cone = sopro de fogo de perto. Efeitos: slow (lento), freeze (congela/imobiliza), burn (queima).
import * as THREE from 'three';
import { audio } from './audio.js';
import { getGlowTexture } from './dungeon/builder.js';
import { addFireField } from './wbhooks.js';
import { markDark } from './undead.js';

const FREEZE_BOSS = 0.25; // chefes: 1/4 do tempo (comuns ficam o dobro do que ficavam; chefes, o mesmo de antes)

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
  if (c.type === 'bolt' && c.instant) { lightningCast(combat, p, step, o, rangeMul); return; }
  if (c.type === 'bolt') {
    if (c.roomZap) roomZap(combat, p, c.roomZap); // Cajado Elétrico: todo 3º golpe dá dano em todos da sala
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
  if (c.type === 'beam' || c.type === 'fireline') {
    const len = c.length * rangeMul;
    // Grimório: o raio mira sozinho na direção que pega mais esqueletos dentro do alcance.
    if (c.aimGroup) {
      const a = groupAngle(combat, p, len, c.width);
      if (a !== null) { p.facing = a; p.group.rotation.y = a; Object.assign(o, origin(p)); }
    }
    const fx = Math.sin(o.a), fz = Math.cos(o.a);
    if (c.type === 'fireline') {
      // Cajado de Fogo: conjuração de fogo em linha reta (chama estreita + rastro no chão).
      combat.vfx.flameCone(new THREE.Vector3(p.position.x, 1.1, p.position.z), o.a, len + 0.9, THREE.MathUtils.degToRad(11), c.color, false);
      combat.vfx.beamLine(new THREE.Vector3(o.x, 0.5, o.z), new THREE.Vector3(o.x + fx * len, 0.5, o.z + fz * len), 0xffb04a, c.width * 0.8);
      combat.props.hitLine(o.x, o.z, o.x + fx * len, o.z + fz * len, c.width, p);
      audio.play('swingHeavy', o.x, o.z);
      let hits = 0;
      for (const e of [...combat.enemies]) {
        if (!e.targetable) continue;
        const dx = e.position.x - o.x, dz = e.position.z - o.z;
        const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
        if (along < -1 || along > len || side > c.width / 2 + e.data.radius) continue;
        if (spellHit(combat, p, e, step, fx, fz)) hits++;
      }
      hitFeel(combat, p, step, hits, o);
      return;
    }
    combat.vfx.beamLine(new THREE.Vector3(o.x, 1.25, o.z), new THREE.Vector3(o.x + fx * len, 1.25, o.z + fz * len), c.color, c.width);
    combat.props.hitLine(o.x, o.z, o.x + fx * len, o.z + fz * len, c.width, p);
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
    // Grimório: o cone mira sozinho na direção que pega mais esqueletos dentro do alcance.
    if (c.aimGroup) {
      const a = groupAngle(combat, p, range, 0, half);
      if (a !== null) { p.facing = a; p.group.rotation.y = a; Object.assign(o, origin(p)); }
    }
    if (c.arcane) {
      combat.vfx.sector(p.position, o.a, range, half, c.color);
      combat.vfx.flameCone(new THREE.Vector3(p.position.x, 1.1, p.position.z), o.a, range, half, c.color, step.heavy, 0xd8ffe8);
    } else combat.vfx.flameCone(new THREE.Vector3(p.position.x, 1.1, p.position.z), o.a, range, half, c.color, step.heavy);
    combat.props.strikeArc(p, range, half);
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
    combat.props.hitCircle(p.position.x, p.position.z, radius, p);
    audio.play('boom', o.x, o.z);
    if (st.w && st.w.fireField) addFireField(combat, p, p.position.x, p.position.z, radius * 0.8); // Inferno
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

// Cajado Elétrico: raio instantâneo do cajado até o inimigo (mira sozinho no mais perto à frente, ±40°).
// Sem ninguém: o raio vai reto até o fim do alcance. Atravessar: o raio segue para o próximo inimigo à frente.
const LIGHTNING_ARC = 40 * Math.PI / 180;
function pickLightning(combat, x, z, a, range, skip) {
  let best = null, bs = Infinity;
  for (const e of combat.enemies) {
    if (!e.targetable || skip.has(e)) continue;
    const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz);
    if (d > range + e.data.radius) continue;
    let da = Math.atan2(dx, dz) - a; da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
    if (da > LIGHTNING_ARC && d > e.data.radius + 0.6) continue;
    const score = d + da * 5;
    if (score < bs) { bs = score; best = e; }
  }
  return best;
}
function lightningCast(combat, p, step, o, rangeMul) {
  const c = step.cast;
  if (c.roomZap) roomZap(combat, p, c.roomZap); // todo 3º golpe dá dano em todos da sala
  const range = p.hero.attackRange * rangeMul, n = c.count || 1, used = new Set();
  for (let i = 0; i < n; i++) {
    const a = o.a + (n > 1 ? THREE.MathUtils.degToRad(c.spread || 14) * (i - (n - 1) / 2) : 0);
    const fx = Math.sin(a), fz = Math.cos(a);
    let from = new THREE.Vector3(p.position.x + fx * 0.55, 1.75, p.position.z + fz * 0.55); // ponta do cajado
    const targets = [];
    let t = pickLightning(combat, p.position.x, p.position.z, a, range, used);
    while (t) {
      targets.push(t); used.add(t);
      if (targets.length > (c.pierce || 0)) break;
      t = pickLightning(combat, t.position.x, t.position.z, Math.atan2(t.position.x - p.position.x, t.position.z - p.position.z), range * 0.6, used);
    }
    if (!targets.length) {
      const end = new THREE.Vector3(p.position.x + fx * range, 1.1, p.position.z + fz * range);
      combat.vfx.lightning(from, end, c.color);
      combat.props.hitLine(p.position.x, p.position.z, end.x, end.z, 0.8, p);
      if (c.blast) boltImpact(combat, { x: end.x, z: end.z, vx: fx, vz: fz, step, owner: p }, null);
      continue;
    }
    for (const e of targets) {
      const to = new THREE.Vector3(e.position.x, 1.2, e.position.z);
      combat.vfx.lightning(from, to, c.color);
      const dx = to.x - p.position.x, dz = to.z - p.position.z, d = Math.hypot(dx, dz) || 1;
      if (e.targetable) boltImpact(combat, { x: to.x, z: to.z, vx: dx / d, vz: dz / d, step, owner: p }, e);
      from = to;
    }
    if (combat.log) combat.log({ type: 'lightning', targets: targets.length });
  }
  audio.play('zap', o.x, o.z);
}

// Direção (ângulo) do raio/cone que acerta mais esqueletos ao alcance; empate = a mais perto de onde ela olha. null = ninguém.
// half > 0 = cone (medido a partir da Maga); senão, raio reto de largura width.
function groupAngle(combat, p, len, width, half = 0) {
  const px = p.position.x, pz = p.position.z;
  const list = combat.enemies.filter((e) => e.targetable && Math.hypot(e.position.x - px, e.position.z - pz) <= len + 0.9 + e.data.radius);
  if (!list.length) return null;
  let best = null, bestN = 0, bestTurn = Infinity;
  for (const t of list) {
    const a = Math.atan2(t.position.x - px, t.position.z - pz);
    const fx = Math.sin(a), fz = Math.cos(a), ox = px + fx * 0.9, oz = pz + fz * 0.9;
    let n = 0;
    for (const e of list) {
      if (half > 0) {
        const dx = e.position.x - px, dz = e.position.z - pz, d = Math.hypot(dx, dz) || 0.01;
        let da = Math.atan2(dx, dz) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
        if (d <= len + e.data.radius && Math.abs(da) <= half) n++;
        continue;
      }
      const dx = e.position.x - ox, dz = e.position.z - oz;
      const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (along >= -0.5 && along <= len && side <= width / 2 + e.data.radius) n++;
    }
    let turn = a - p.facing; turn = Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn)));
    if (n > bestN || (n === bestN && turn < bestTurn)) { best = a; bestN = n; bestTurn = turn; }
  }
  return best;
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
  if (c.darkMark && e.targetable) markDark(combat, p, e); // Cajado das Trevas: 3º golpe marca (antes do dano: o golpe que mata também vale)
  const r = combat.damageEnemy(p, e, step, nx, nz, { spell: true, staggers: true }); // toda magia interrompe (igual à espada)
  if (!r) return false;
  if (!e.alive) return true;
  // 3º golpe do Grimório: empurra mais para trás.
  if (c.knock && r === 'hit' && e.vel) e.vel.set(nx, 0, nz).multiplyScalar(c.knock * Math.max(e.data.knockback ?? 1, 0.35));
  if (c.slow) e.slow = Math.max(e.slow || 0, c.slow);
  const w = p.stats.w || {};
  if (c.burn) { e.burn = 3 + (w.burnTime || 0); e.burnDps = c.burn * p.stats.damageMul; e.burnTick = 0.5; e.burnBy = p; }
  // Congelar (3º golpe do Cajado de Gelo) pega sempre, até no meio de um golpe ou habilidade.
  if (c.freeze && e.freeze) {
    e.freeze(c.freeze * (e.data.boss ? FREEZE_BOSS : 1), combat);
    if (w.freezeAoe) { // Zero Absoluto: congela também quem estiver perto
      for (const o of combat.enemies) {
        if (o === e || !o.targetable || !o.freeze || o.data.boss) continue;
        if (Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) <= w.freezeAoe + o.data.radius) o.freeze(c.freeze, combat);
      }
      combat.vfx.ring(new THREE.Vector3(e.position.x, 0, e.position.z), 0x8fe3ff, w.freezeAoe);
    }
  }
  return true;
}

// Cajado Elétrico (3º golpe): um raio cai em cada inimigo da sala.
function roomZap(combat, p, dmg) {
  const n = Math.max(1, Math.round(dmg * p.stats.damageMul));
  let hits = 0;
  for (const e of [...combat.enemies]) {
    if (!e.targetable) continue;
    combat.vfx.bolt(new THREE.Vector3(e.position.x + (Math.random() - 0.5), 7, e.position.z + (Math.random() - 0.5)), new THREE.Vector3(e.position.x, 1.2, e.position.z), 0xbff0ff);
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
    combat.bonusDamage(e, n, dx / d, dz / d, 'burn', p);
    hits++;
  }
  if (hits) audio.play('boom', p.position.x, p.position.z, { v: 0.5 });
  if (combat.log) combat.log({ type: 'roomZap', hits, dmg: n });
}

// Orbe acertou alguém (ou explodiu): dano no alvo + explosão em área (blast).
export function boltImpact(combat, a, target) {
  const step = a.step, c = step.cast, p = a.owner;
  const sp = Math.hypot(a.vx, a.vz) || 1, nx = a.vx / sp, nz = a.vz / sp;
  let hits = 0;
  if (target && spellHit(combat, p, target, step, nx, nz)) hits++;
  // Cajado Elétrico: o raio pula para os inimigos perto do atingido (mesmo dano).
  if (c.chain && target) {
    const from = new THREE.Vector3(target.position.x, 1.3, target.position.z);
    for (const o of [...combat.enemies]) {
      if (o === target || !o.targetable) continue;
      const dx = o.position.x - target.position.x, dz = o.position.z - target.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > c.chain + o.data.radius) continue;
      combat.vfx.bolt(from, new THREE.Vector3(o.position.x, 1.3, o.position.z), c.color);
      if (spellHit(combat, p, o, step, dx / d, dz / d)) hits++;
    }
  }
  if (c.pull) { // Singularidade: puxa os inimigos em volta para o ponto do impacto
    for (const e of combat.enemies) {
      if (!e.targetable || e.data.boss || e === target) continue;
      const dx = a.x - e.position.x, dz = a.z - e.position.z, d = Math.hypot(dx, dz);
      if (d > c.pull + e.data.radius || d < 0.3) continue;
      e.vel.set(dx / d, 0, dz / d).multiplyScalar(Math.min(16, d * 5));
    }
    combat.vfx.ring(new THREE.Vector3(a.x, 0, a.z), 0x6a2aff, c.pull);
  }
  combat.props.hitCircle(a.x, a.z, c.blast ? c.blast * (p.stats.heavyRadiusMul || 1) : 0.5, p); // objetos quebráveis
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
