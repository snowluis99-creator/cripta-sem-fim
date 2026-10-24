// Magias do Mago Esqueleto e do Necromante (chefe final). Os números ficam em ENEMIES (enemies.js).
// - revive: levanta esqueletos caídos (os restos ficam em combat.graves por 14 s).
// - teleport: some numa fumaça e aparece longe do herói (quando o herói chega perto).
// - rain: chuva de crânios caindo do alto (um em cima do herói, o resto espalhado perto dele).
// - ring: anel de orbes saindo para todos os lados (enfurecido: dois anéis).
// - nova: explosão em volta dele quando o herói chega muito perto.
// - fases: com 66% e 33% da vida o Necromante provoca, cresce (na 3ª) e troca de magias.
import * as THREE from 'three';
import { initAbilities } from './abilities.js';
import { audio } from './audio.js';

const rand = ([a, b]) => a + Math.random() * (b - a);
export const SPELL_STATES = ['tpOut', 'tpIn', 'revive', 'rain', 'ring', 'nova'];
export const SPELL_KEYS = ['teleport', 'revive', 'rain', 'ring', 'nova'];

const gravesNear = (e, combat, range) => combat.graves
  .filter((g) => Math.hypot(g.x - e.position.x, g.z - e.position.z) <= range)
  .sort((a, b) => Math.hypot(a.x - e.position.x, a.z - e.position.z) - Math.hypot(b.x - e.position.x, b.z - e.position.z));

const SPELL_SFX = { revive: 'summon', rain: 'spell', ring: 'orb', nova: 'charge', tpOut: 'dodge' };
function begin(e, state, clip, speed = 1) {
  if (SPELL_SFX[state]) audio.play(SPELL_SFX[state], e.position.x, e.position.z);
  e.releaseToken();
  e.setState(state);
  e.hitDone = false;
  e.hit2 = false;
  if (clip) e.anim.play(clip, { once: true, restart: true, speed, fade: 0.12 });
  return true;
}

// Chamado enquanto persegue. Devolve true se começou uma magia.
export function trySpell(e, ctx, dist) {
  const d = e.data, cd = e.cd, combat = ctx.combat;
  if (d.nova && cd.nova <= 0 && dist <= d.nova.range) return begin(e, 'nova', 'Ranged_Magic_Spellcasting', 1.4);
  if (d.teleport && cd.teleport <= 0 && dist <= d.teleport.near) {
    combat.vfx.smoke(e.position);
    return begin(e, 'tpOut');
  }
  if (d.revive && cd.revive <= 0) {
    if (gravesNear(e, combat, d.revive.range).length >= (d.revive.min || 1)) {
      if (d.revive.text) combat.text.add(d.revive.text, e.position, 'block', 2.6 + 2.2 * (e.data.scale || 1));
      return begin(e, 'revive', 'Ranged_Magic_Summon', 2.0);
    }
    cd.revive = 1.2;
  }
  if (d.rain && cd.rain <= 0) return begin(e, 'rain', 'Ranged_Magic_Raise', 1.0);
  if (d.ring && cd.ring <= 0) return begin(e, 'ring', 'Ranged_Magic_Spellcasting', 1.2);
  return false;
}

// Lugar longe do herói, dentro da sala e livre.
function farSpot(e, ctx) {
  const b = ctx.combat.hazards.bounds || { halfW: 12, halfD: 10 };
  const p = ctx.player.position, r = e.data.radius + 0.4;
  let best = null, bestD = -1;
  for (let i = 0; i < 40; i++) {
    const x = (Math.random() * 2 - 1) * (b.halfW - 2.5), z = (Math.random() * 2 - 1) * (b.halfD - 2.5);
    if (ctx.world.blocked(x, z, r)) continue;
    const dd = Math.hypot(x - p.x, z - p.z);
    if (dd >= 8 && dd <= 14) return { x, z };
    if (dd > bestD && dd < 16) { bestD = dd; best = { x, z }; }
  }
  return best || { x: e.position.x, z: e.position.z };
}

// A cada quadro nos estados de magia. Devolve { target, turn } ou null.
export function runSpell(e, dt, ctx, { dist, toPlayer }) {
  const d = e.data, p = ctx.player, combat = ctx.combat;
  const sc = e.data.scale || 1;
  const back = () => { e.setState('chase'); e.anim.play(d.anims.idle, { fade: 0.2 }); };
  switch (e.state) {
    case 'tpOut': {
      const k = Math.min(1, e.t / 0.35);
      e.group.scale.setScalar(sc * (1 - k));
      if (k >= 1) {
        const s = farSpot(e, ctx);
        e.position.set(s.x, 0, s.z);
        e.facing = Math.atan2(p.position.x - s.x, p.position.z - s.z);
        combat.vfx.smoke(e.position);
        e.setState('tpIn');
        e.anim.play(d.anims.idle, { fade: 0 });
      }
      return null;
    }
    case 'tpIn': {
      const k = Math.min(1, e.t / 0.35);
      e.group.scale.setScalar(sc * k);
      if (k >= 1) { e.group.scale.setScalar(sc); e.cd.teleport = rand(d.teleport.cooldown); e.cooldown = Math.min(e.cooldown, 0.4); back(); }
      return { target: toPlayer, turn: 12 };
    }
    case 'revive': {
      const R = d.revive;
      if (!e.hitDone && e.t >= R.time * 0.45) {
        e.hitDone = true;
        const list = gravesNear(e, combat, R.range).slice(0, R.max);
        for (const g of list) combat.reviveGrave(g);
        combat.vfx.burst(e.position, 0x7dff8a);
      }
      if (e.t >= R.time) { e.cd.revive = rand(R.cooldown); back(); }
      return { target: toPlayer, turn: 3 };
    }
    case 'rain': {
      const R = d.rain;
      if (!e.hitDone && e.t >= 0.45) {
        e.hitDone = true;
        const spots = [{ x: p.position.x, z: p.position.z, delay: 0 }];
        const b = combat.hazards.bounds || { halfW: 12, halfD: 10 };
        for (let i = 1; i < R.count; i++) {
          const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * R.spread;
          const x = THREE.MathUtils.clamp(p.position.x + Math.sin(a) * r, -b.halfW + 1.5, b.halfW - 1.5);
          const z = THREE.MathUtils.clamp(p.position.z + Math.cos(a) * r, -b.halfD + 1.5, b.halfD - 1.5);
          spots.push({ x, z, delay: i * R.every });
        }
        combat.projectiles.rain(spots, { fall: R.fall, radius: R.radius, damage: Math.round(R.damage * (e.dmgScale || 1)), owner: e });
        combat.vfx.burst(e.position, 0xa040ff);
      }
      if (e.t >= R.time) { e.cd.rain = rand(R.cooldown); back(); }
      return null;
    }
    case 'ring': {
      const R = d.ring;
      const fireRing = (off) => {
        for (let i = 0; i < R.count; i++) {
          const a = (i / R.count) * Math.PI * 2 + off;
          combat.projectiles.fire(e.position.x + Math.sin(a) * 1.2 * sc, e.position.z + Math.cos(a) * 1.2 * sc, a, {
            speed: R.speed, damage: Math.round(R.damage * (e.dmgScale || 1)), kind: 'orb', color: 0xff5ad0, scale: 1.3, height: 1.2, owner: e,
          });
        }
        combat.cam.shake(0.12);
      };
      if (!e.hitDone && e.t >= 0.5) { e.hitDone = true; fireRing(Math.random()); }
      if (R.waves > 1 && !e.hit2 && e.t >= 0.95) { e.hit2 = true; fireRing(Math.PI / R.count + Math.random() * 0.1); }
      if (e.t >= R.time) { e.cd.ring = rand(R.cooldown); back(); }
      return null;
    }
    case 'nova': {
      const N = d.nova;
      if (!e.hitDone && e.t >= N.wind) {
        e.hitDone = true;
        combat.vfx.heavyImpact(e.position, N.radius / 2.3);
        audio.play('boom', e.position.x, e.position.z);
        combat.vfx.smoke(e.position, 0xff3a6a, 10);
        combat.cam.shake(0.4);
        for (const h of combat.alivePlayers) {
          if (Math.hypot(h.position.x - e.position.x, h.position.z - e.position.z) <= N.radius + h.hero.radius) {
            combat.hitPlayer(e, Math.round(N.damage * (e.dmgScale || 1)), { push: N.push, noRepel: true, target: h });
          }
        }
      }
      if (e.t >= N.wind + 0.3) {
        e.cd.nova = rand(N.cooldown);
        // Depois da explosão ele some (se puder).
        if (d.teleport) { e.cd.teleport = 0; combat.vfx.smoke(e.position); begin(e, 'tpOut'); } else back();
      }
      return null;
    }
    default: return null;
  }
}

// Troca de fase (66% e 33% da vida): provoca, cresce e fica invulnerável por um instante; magias novas.
export function checkPhase(e, combat) {
  const ph = e.basePhases[e.phaseIdx];
  if (!ph || e.hp > e.maxHp * ph.at) return;
  e.phaseIdx++;
  e.releaseToken();
  const from = e.data.scale || 1;
  e.data = { ...e.data, ...ph.stats };
  e.damage = Math.round(e.data.damage * (e.dmgScale || 1));
  e.rageCfg = { from, to: e.data.scale || from, grow: ph.grow, time: ph.time };
  e.cooldown = 1;
  initAbilities(e);
  e.setState('rage');
  e.vel.set(0, 0, 0);
  e.group.scale.setScalar(from);
  e.anim.play('Skeletons_Taunt', { once: true, restart: true, speed: 1.1, fade: 0.15 });
  combat.cam.shake(0.7);
  combat.vfx.burst(e.position, 0xa040ff);
  combat.vfx.smoke(e.position, 0xa040ff, 18);
  combat.hud.banner(ph.banner, 'big');
  audio.play('boom', e.position.x, e.position.z);
  if (combat.log) combat.log({ type: 'phase', enemy: e, phase: e.phaseIdx + 1 });
}
