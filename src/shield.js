// Escudo do herói: bloquear protege 100% do dano, mas cada golpe/flecha bloqueado gasta 1 de resistência.
// Com 10 bloqueios (mais as bênçãos) ele quebra e o herói fica sem bloquear até descansar na cama
// ou pegar uma bênção que conserta (Escudo Reforçado; Forja Viva conserta sozinho com o tempo).
import * as THREE from 'three';
import { audio } from './audio.js';

export const SHIELD = {
  base: 10,            // bloqueios até quebrar
  parryWindow: 0.22,   // Aparar: bloquear nos primeiros 0,22 s não gasta o escudo
  forgeEvery: 6,       // Forja Viva: conserta 1 a cada 6 s sem bloquear
  shardDamage: 40, shardRadius: 4.2, // Estilhaços: explosão quando quebra
};

export const shieldMax = (p) => (p.hero && p.hero.noShield ? 0 : SHIELD.base + (p.stats.shieldBonus || 0));

// Liga o modelo do escudo (materiais próprios para escurecer conforme ele se desgasta).
export function initShield(p, mesh) {
  p.shieldMesh = mesh;
  p.shieldMats = [];
  if (mesh) mesh.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); p.shieldMats.push({ m: o.material, c: o.material.color.clone() }); } });
  p.shield = shieldMax(p);
  p.forgeT = 0;
  shieldVisual(p);
}

// Desgaste visível: escurece e avermelha um pouco; quebrado = some da mão.
export function shieldVisual(p) {
  if (!p.shieldMesh) return;
  const max = shieldMax(p), k = Math.max(0, p.shield) / max;
  p.shieldMesh.visible = p.shield > 0;
  for (const { m, c } of p.shieldMats) m.color.copy(c).lerp(new THREE.Color(0x5a2a1a), (1 - k) * 0.55);
  p.shieldShown = p.shield;
}

export function repairShield(p, n = Infinity) {
  const before = p.shield;
  p.shield = Math.min(shieldMax(p), p.shield + n);
  if (p.shield !== before) shieldVisual(p);
  return p.shield - before;
}

// Chamado quando o escudo segurou um golpe. Devolve 'parry' | 'block' | 'break'.
export function useShield(p, combat, attacker) {
  p.forgeT = 0;
  const st = p.stats;
  if (st.parry && p.state === 'block' && p.stateTime <= SHIELD.parryWindow) return 'parry';
  if (st.mithril > 0 && Math.random() < st.mithril) return 'block';
  p.shield = Math.max(0, p.shield - 1);
  shieldVisual(p);
  if (p.shield > 0) return 'block';
  breakShield(p, combat, attacker);
  return 'break';
}

function breakShield(p, combat, attacker) {
  const pos = p.position;
  audio.play('crunch', pos.x, pos.z);
  audio.play('shieldBlock', pos.x, pos.z, { v: 1.4 });
  combat.vfx.sparks(new THREE.Vector3(pos.x, 1.3, pos.z), 0xffc070, 18);
  combat.vfx.puff(new THREE.Vector3(pos.x, 0, pos.z));
  const wall = p.hero.block && p.hero.block.wall;
  combat.text.add(wall ? 'Barreira quebrada!' : 'Escudo quebrado!', pos, 'hurt', 3.4);
  combat.shakeFor(p, 0.35);
  if (p.ux) p.ux.banner(`${wall ? 'Barreira quebrada' : 'Escudo quebrado'}! Descanse ou pegue uma bênção para consertar`, 'small');
  if (combat.log) combat.log({ type: 'shieldBreak' });
  // Estilhaços: o escudo explode e machuca os esqueletos em volta.
  if (p.stats.shards) {
    combat.vfx.heavyImpact(new THREE.Vector3(pos.x, 0, pos.z), SHIELD.shardRadius / 2.3);
    for (const o of [...combat.enemies]) {
      if (!o.targetable) continue;
      const dx = o.position.x - pos.x, dz = o.position.z - pos.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > SHIELD.shardRadius + o.data.radius) continue;
      combat.bonusDamage(o, Math.round(SHIELD.shardDamage * p.stats.damageMul), dx / d, dz / d, 'dmg big', p);
      if (o.alive && !o.data.boss) o.repelled(dx / d, dz / d);
    }
  }
}

// A cada quadro: Forja Viva e o aviso "sem escudo".
export function updateShield(p, dt) {
  if (p.shieldShown !== p.shield) shieldVisual(p);
  p.noShieldCd = Math.max(0, (p.noShieldCd || 0) - dt);
  if (!p.stats.forge || p.state === 'dead') return;
  if (p.state === 'block' || p.shield >= shieldMax(p)) { p.forgeT = 0; return; }
  p.forgeT = (p.forgeT || 0) + dt;
  if (p.forgeT >= SHIELD.forgeEvery) { p.forgeT = 0; repairShield(p, 1); }
}
