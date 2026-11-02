// Cajado das Trevas (Maga): marca e mortos-vivos aliados.
// - O 3º golpe marca os inimigos atingidos (chefes não).
// - Inimigo marcado que morre levanta logo depois com 1 de vida e luta do lado da Maga.
// - Os inimigos só batem nele depois que ele bate neles (provokedBy). No 1º ataque dele, TODOS os inimigos focam nele.
// - Sem inimigos na sala por um tempo, ele desmorona sozinho.
import * as THREE from 'three';
import { getGlowTexture } from './dungeon/builder.js';
import { setFlash } from './characters.js';
import { audio } from './audio.js';

const RAISE_DELAY = 0.9; // tempo entre cair e levantar
const IDLE_CRUMBLE = 3.5; // sem inimigos por este tempo: desmorona
const MARK_COLOR = 0x9a4dff;

// Marca um inimigo atingido pelo 3º golpe do Cajado das Trevas.
export function markDark(combat, p, e) {
  if (!e.alive || e.undead || e.data.boss || e.data.phantom) return;
  const first = !e.darkMark;
  e.darkMark = p;
  if (!e.darkFx) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: MARK_COLOR, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    const sc = e.group.scale.x || 1;
    s.position.y = 2.55 / sc;
    s.scale.setScalar(0.9 / sc);
    const skull = new THREE.Mesh(new THREE.OctahedronGeometry(0.13 / sc, 0), new THREE.MeshBasicMaterial({ color: 0xe0c8ff }));
    skull.position.y = 2.55 / sc;
    e.group.add(s, skull);
    e.darkFx = { s, skull };
  }
  const w = (p.stats && p.stats.w) || {};
  if (first && w.markHeal > 0 && p.state !== 'dead') { const h = p.heal(w.markHeal); if (h) combat.text.add(`+${h}`, p.position, 'heal small'); } // Pacto Sombrio
  if (first) {
    combat.text.add('Marcado!', e.position, 'bleed', 3.2);
    combat.vfx.smoke(e.position, MARK_COLOR, 6);
  }
  if (combat.log) combat.log({ type: 'darkMark', enemy: e });
}

// Inimigo morreu (combat.killed): se estava marcado, levanta depois.
export function onEnemyKilled(combat, e) {
  if (!e.darkMark || e.undead || e.data.boss || e.raiseQueued) return;
  e.raiseQueued = true;
  if (e.darkFx) { e.darkFx.s.visible = false; e.darkFx.skull.visible = false; }
  (combat.raising || (combat.raising = [])).push({
    type: e.type, x: e.position.x, z: e.position.z, t: RAISE_DELAY, owner: e.darkMark, hpScale: e.hpScale, dmgScale: e.dmgScale, facing: e.facing,
  });
}

// Alvo do morto-vivo: o inimigo mais perto que ainda dá para acertar. Ninguém: fica parado.
export function undeadTarget(combat, u) {
  let best = null, bd = Infinity;
  for (const o of combat.enemies) {
    if (o === u || o.undead || !o.targetable) continue;
    const d = Math.hypot(o.position.x - u.position.x, o.position.z - u.position.z);
    if (d < bd) { bd = d; best = o; }
  }
  if (best) { u.idleT = 0; return best; }
  return u.restSpot || (u.restSpot = { position: u.position.clone(), state: 'dead', facing: u.facing });
}

// Golpe do morto-vivo num inimigo: dano com o crédito da Maga e o inimigo passa a revidar nele.
export function undeadHit(combat, u, o, dmg) {
  if (!o.targetable || o.undead) return;
  const dx = o.position.x - u.position.x, dz = o.position.z - u.position.z, d = Math.hypot(dx, dz) || 1;
  o.provokedBy = u;
  // 1º ataque deste morto-vivo (pedido do dono, 31/10): todos os inimigos da sala passam a focar nele.
  if (!u.drewAggro) {
    u.drewAggro = true;
    for (const x of combat.enemies) if (!x.undead && x.alive && !(x.provokedBy && x.provokedBy.alive)) x.provokedBy = u;
    combat.text.add('Provocou!', u.position, 'bleed', 3.2);
  }
  combat.vfx.sparks(new THREE.Vector3(o.position.x, 1.2, o.position.z), MARK_COLOR, 8);
  audio.play('hit', o.position.x, o.position.z);
  const by = u.undead && u.undead.hero ? u.undead : null;
  const w = (by && by.stats && by.stats.w) || {};
  combat.bonusDamage(o, Math.max(1, Math.round(dmg * (1 + (w.undeadDmg || 0)))), dx / d, dz / d, 'dmg', by); // Fúria dos Mortos
  if (combat.log) combat.log({ type: 'undeadHit', enemy: o, dmg });
}

// Um inimigo (ou flecha) acertou o morto-vivo.
export function hitUndead(combat, u, dmg, fromX, fromZ) {
  if (!u.alive) return;
  const dx = u.position.x - fromX, dz = u.position.z - fromZ, d = Math.hypot(dx, dz) || 1;
  const died = u.takeDamage(Math.max(1, Math.round(dmg)), dx / d, dz / d, 4, false);
  combat.text.add(String(Math.max(1, Math.round(dmg))), u.position, 'hurt small', 2.0);
  combat.vfx.sparks(new THREE.Vector3(u.position.x, 1.2, u.position.z), 0xffffff, 6);
  if (died) undeadDied(combat, u);
  if (combat.log) combat.log({ type: 'undeadHurt', dmg, died });
}

export function undeadDied(combat, u) {
  if (u.undeadGone) return;
  u.undeadGone = true;
  if (!u.alive) u.deathTimer = 0;
  for (const w of u.weapons) combat.debris.drop(w, 0, 1);
  u.weapons.length = 0;
  combat.vfx.smoke(u.position, MARK_COLOR, 10);
  audio.play('crunch', u.position.x, u.position.z);
  for (const o of combat.enemies) if (o.provokedBy === u) o.provokedBy = null;
}

// A cada quadro (combat.update, antes dos inimigos andarem).
export function undeadTick(combat, dt) {
  const R = combat.raising;
  if (R) for (let i = R.length - 1; i >= 0; i--) {
    const r = R[i];
    if ((r.t -= dt) > 0) continue;
    R.splice(i, 1);
    const u = combat.spawn(r.type, r.x, r.z, {
      revived: true, spawnAnim: 'Skeletons_Death_Resurrect', hpScale: r.hpScale, dmgScale: r.dmgScale, facing: r.facing, undead: r.owner,
    });
    const w = (r.owner && r.owner.stats && r.owner.stats.w) || {};
    u.hp = 1 + (w.undeadHp || 0); u.maxHp = Math.max(u.hp, u.maxHp); // Ossos Fortes
    u.noGrave = true; u.noUltCharge = true;
    combat.vfx.smoke(u.position, MARK_COLOR, 12);
    combat.vfx.ring(new THREE.Vector3(u.position.x, 0, u.position.z), MARK_COLOR, 1.6);
    combat.text.add('Levantou!', u.position, 'heal', 2.8);
    audio.play('rise', u.position.x, u.position.z);
    if (combat.log) combat.log({ type: 'undeadRise', enemy: u });
  }
  for (const u of combat.enemies) {
    if (u.undead) {
      if (!u.alive) continue;
      const foe = combat.enemies.some((o) => !o.undead && o.alive);
      u.idleT = foe ? 0 : (u.idleT || 0) + dt;
      if (u.idleT > IDLE_CRUMBLE && !u.vassal) { u.die(); undeadDied(combat, u); } // Vassalo: fica até o fim da sala
      continue;
    }
    // Marca pulsando em cima da cabeça.
    if (u.darkFx && u.alive) {
      const k = 0.75 + 0.25 * Math.sin(performance.now() / 160 + u.id);
      u.darkFx.s.material.opacity = k;
      u.darkFx.skull.rotation.y += dt * 3;
    }
  }
}

// Depois de os inimigos se mexerem: brilho roxo e olhos verdes nos mortos-vivos.
export function undeadLook(combat) {
  for (const u of combat.enemies) {
    if (!u.undead || !u.alive) continue;
    if (u.vassal) { if (!(u.flash > 0)) setFlash(u.bodyMats, 0.35, 1, 0.8, 0.3); setFlash(u.eyes, 3, 1, 0.85, 0.3); continue; } // Vassalo: dourado
    if (!(u.flash > 0)) setFlash(u.bodyMats, 0.45, 0.45, 0.15, 0.9);
    setFlash(u.eyes, 3, 0.3, 1, 0.45);
  }
}
