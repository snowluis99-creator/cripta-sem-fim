// Habilidades das sombras (andar 3). Os números ficam em ENEMIES (enemies.js).
// - vanish (Assassino Sombrio): some numa fumaça, anda quase invisível e reaparece nas costas do herói
//   com um golpe duplo. Acertar enquanto ele está invisível revela e atordoa.
// - shade (Ceifador Sombrio): afunda numa sombra no chão (não dá para acertar) e sai dela nas costas do herói
//   com um golpe de cima para baixo.
// - clones (Ceifador): some e aparecem ele + 2 ou 3 cópias em volta do herói; todos soltam os cortes longos.
//   As cópias somem com 1 golpe ou depois de alguns segundos.
// - reap (Ceifador e cópias): cortes longos — ondas roxas que atravessam a sala (leque; na 2ª fase, círculo).
import * as THREE from 'three';
import { audio } from './audio.js';
import { spotBehind } from './abilities.js';

const rand = ([a, b]) => a + Math.random() * (b - a);
export const SHADOW_STATES = ['vanish', 'stalk', 'ambushWind', 'shadeOut', 'shadeIn', 'clones', 'reap'];
export const SHADOW_KEYS = ['vanish', 'shade', 'clones', 'reap'];
// Estados em que o inimigo está transparente (ao sair deles ele volta ao normal).
export const GHOST_STATES = new Set(['vanish', 'stalk', 'ambushWind', 'shadeOut', 'shadeIn']);
// Estados em que não dá para acertar (dentro da sombra no chão).
export const HIDDEN_STATES = new Set(['shadeOut', 'shadeIn']);

// Transparência do inimigo inteiro (corpo, olhos e armas). a = 1 normal, 0 invisível.
export function setGhost(e, a) {
  if (!e.ghostMats) {
    const own = new Set([...e.bodyMats, ...e.eyes]);
    e.ghostMats = [];
    e.model.traverse((o) => {
      if (!o.isMesh) return;
      if (!own.has(o.material)) o.material = o.material.clone(); // armas: material próprio
      e.ghostMats.push(o.material);
    });
    e.shadowMesh = e.group.children.find((o) => o !== e.model && o.isMesh);
  }
  e.alpha = a;
  const t = a < 0.999;
  for (const m of e.ghostMats) {
    if (m.transparent !== t) { m.transparent = t; m.depthWrite = !t; m.needsUpdate = true; }
    m.opacity = a;
  }
  if (e.shadowMesh) e.shadowMesh.visible = a > 0.3;
}

function begin(e, state, clip, speed = 1) {
  e.releaseToken();
  e.setState(state);
  e.hitDone = false;
  e.hit2 = false;
  if (clip) e.anim.play(clip, { once: true, restart: true, speed, fade: 0.12 });
  return true;
}

// Chamado enquanto persegue. Devolve true se começou uma habilidade.
export function tryShadow(e, ctx, dist) {
  const d = e.data, cd = e.cd, c = ctx.combat;
  if (d.clones && cd.clones <= 0) { audio.play('spell', e.position.x, e.position.z); return begin(e, 'clones', 'Skeletons_Taunt', 1.6); }
  if (d.shade && cd.shade <= 0 && dist >= d.shade.range[0] && dist <= d.shade.range[1]) {
    audio.play('dodge', e.position.x, e.position.z);
    c.vfx.smoke(e.position, 0x2a1a40, 10);
    begin(e, 'shadeOut', 'Crouching', 1);
    e.anim.play('Crouching', { fade: 0.15 });
    return true;
  }
  if (d.reap && cd.reap <= 0 && dist >= (d.reap.range || 0)) return begin(e, 'reap', 'Melee_2H_Attack_Slice', d.reap.speed);
  if (d.vanish && cd.vanish <= 0 && dist >= d.vanish.range[0] && dist <= d.vanish.range[1]) {
    audio.play('dodge', e.position.x, e.position.z);
    c.vfx.smoke(e.position, 0x302040, 8);
    begin(e, 'vanish');
    e.anim.play(d.anims.idle, { fade: 0.1 });
    return true;
  }
  return false;
}

// Chega nas costas do herói (ou o mais perto disso).
function behind(e, ctx, dist) {
  return spotBehind(ctx.player, ctx.world, dist, e.data.radius + 0.1) || { x: e.position.x, z: e.position.z };
}

export function runShadow(e, dt, ctx, { toPlayer }) {
  const d = e.data, p = ctx.player, c = ctx.combat;
  const back = () => { e.setState('chase'); e.anim.play(d.anims.idle, { fade: 0.2 }); };
  switch (e.state) {
    // --- Assassino ---
    case 'vanish': {
      const V = d.vanish, k = Math.min(1, e.t / V.fade);
      setGhost(e, 1 - (1 - V.alpha) * k);
      if (k >= 1) { e.setState('stalk'); e.stalkTime = rand(V.time); }
      return null;
    }
    case 'stalk': {
      const V = d.vanish;
      setGhost(e, V.alpha + 0.04 * Math.sin(e.t * 20)); // só um tremido no ar
      const s = behind(e, ctx, V.behind);
      const dx = s.x - e.position.x, dz = s.z - e.position.z, dd = Math.hypot(dx, dz);
      if (dd > 0.2) {
        const st = Math.min(dd, V.speed * dt);
        e.position.x += (dx / dd) * st; e.position.z += (dz / dd) * st;
        e.anim.play('Running_A', { speed: 1.3 });
      } else e.anim.play(d.anims.idle);
      if (e.t >= e.stalkTime) {
        // Aparece nas costas do herói.
        e.position.set(s.x, 0, s.z);
        e.facing = Math.atan2(p.position.x - s.x, p.position.z - s.z);
        c.vfx.smoke(e.position, 0x302040, 6);
        audio.play('swing', e.position.x, e.position.z);
        e.setState('ambushWind');
        e.anim.play(d.anims.idle, { fade: 0.05 });
      }
      return { target: toPlayer, turn: 12 };
    }
    case 'ambushWind': {
      const V = d.vanish;
      setGhost(e, Math.min(1, V.alpha + e.t / 0.15));
      if (e.t >= V.wind) {
        setGhost(e, 1);
        e.cd.vanish = rand(V.cooldown);
        e.hasToken = true; c.attackers++;
        e.startAttack(V.attack);
      }
      return { target: toPlayer, turn: 14 };
    }
    // --- Ceifador ---
    case 'shadeOut': {
      const S = d.shade, sc = e.data.scale || 1;
      const k = Math.min(1, e.t / S.sink);
      e.group.position.y = -2.4 * sc * k * k;
      setGhost(e, 1 - k);
      if (Math.random() < dt * 20) c.vfx.smoke(e.position, 0x1a1028, 1);
      if (e.t >= S.sink + S.hidden) {
        const s = behind(e, ctx, S.behind);
        e.position.set(s.x, 0, s.z);
        e.facing = Math.atan2(p.position.x - s.x, p.position.z - s.z);
        c.vfx.smoke(e.position, 0x1a1028, 12);
        audio.play('rise', e.position.x, e.position.z);
        e.setState('shadeIn');
        e.anim.play(d.anims.idle, { fade: 0.05 });
      }
      return null;
    }
    case 'shadeIn': {
      const S = d.shade, sc = e.data.scale || 1;
      const k = Math.min(1, e.t / S.rise);
      e.group.position.y = -2.4 * sc * (1 - k) * (1 - k);
      setGhost(e, k);
      if (k >= 1) {
        e.group.position.y = 0;
        setGhost(e, 1);
        e.cd.shade = rand(S.cooldown);
        e.hasToken = true; c.attackers++;
        e.startAttack(S.attack);
      }
      return { target: toPlayer, turn: 14 };
    }
    case 'clones': {
      const C = d.clones;
      if (!e.hitDone && e.t >= 0.45) {
        e.hitDone = true;
        splitIntoClones(e, ctx, C);
      }
      if (e.t >= C.time) { e.cd.clones = rand(C.cooldown); e.cd.reap = 0; back(); }
      return { target: toPlayer, turn: 6 };
    }
    case 'reap': {
      const R = d.reap, pr = e.anim.progress();
      if (!e.hitDone && pr >= 0.36) { e.hitDone = true; fireReap(e, c, R, 0); }
      if (R.slashes > 1 && !e.hit2 && e.t >= 0.36 * e.anim.current.getClip().duration / R.speed + R.gap) {
        e.hit2 = true; fireReap(e, c, R, R.spread >= 6 ? Math.PI / R.count : 0.18);
      }
      if (pr >= 0.92) { e.cd.reap = rand(R.cooldown); back(); }
      return pr < 0.3 ? { target: toPlayer, turn: 5 } : null;
    }
    default: return null;
  }
}

// Cortes longos: ondas roxas grandes saindo do Ceifador (leque à frente, ou círculo na 2ª fase).
function fireReap(e, c, R, off) {
  e.reaped = (e.reaped || 0) + 1; // (teste)
  const sc = e.data.scale || 1, ring = R.spread >= 6;
  for (let i = 0; i < R.count; i++) {
    const a = ring ? e.facing + off + (i / R.count) * Math.PI * 2
      : e.facing + off + (R.count > 1 ? (i / (R.count - 1) - 0.5) * R.spread : 0);
    c.projectiles.fire(e.position.x + Math.sin(a) * 1.4 * sc, e.position.z + Math.cos(a) * 1.4 * sc, a, {
      speed: R.shot, damage: Math.round(R.damage * (e.dmgScale || 1)), kind: 'wave', color: 0x8a4cff, scale: R.scale, height: 1.0, life: 2.6, owner: e,
    });
  }
  c.cam.shake(0.18);
  audio.play('swingHeavy', e.position.x, e.position.z);
}

// Ceifador some e aparecem ele + cópias em volta do herói (posições sorteadas: ninguém sabe qual é o de verdade).
function splitIntoClones(e, ctx, C) {
  const c = ctx.combat, p = ctx.player.position, b = c.hazards.bounds || { halfW: 18, halfD: 14 };
  const n = C.count + 1, a0 = Math.random() * Math.PI * 2;
  const spots = [];
  for (let i = 0; i < n; i++) {
    let x = 0, z = 0;
    for (let k = 0; k < 6; k++) {
      const a = a0 + (i / n) * Math.PI * 2 + k * 0.35, r = C.dist * (1 - k * 0.12);
      x = THREE.MathUtils.clamp(p.x + Math.sin(a) * r, -b.halfW + 3, b.halfW - 3);
      z = THREE.MathUtils.clamp(p.z + Math.cos(a) * r, -b.halfD + 3, b.halfD - 3);
      if (!ctx.world.blocked(x, z, e.data.radius + 0.2)) break;
    }
    spots.push({ x, z });
  }
  c.vfx.smoke(e.position, 0x1a1028, 14);
  const real = Math.floor(Math.random() * n);
  spots.forEach((s, i) => {
    const facing = Math.atan2(p.x - s.x, p.z - s.z);
    c.vfx.smoke(new THREE.Vector3(s.x, 0, s.z), 0x1a1028, 10);
    if (i === real) { e.position.set(s.x, 0, s.z); e.facing = facing; e.group.rotation.y = facing; return; }
    const k = c.spawn('reaperClone', s.x, s.z, { awake: true, facing, dmgScale: e.dmgScale });
    k.group.scale.setScalar(e.group.scale.x);
    k.life = C.life;
    k.cd.reap = 0.05; // solta os cortes junto com o Ceifador de verdade
    k.cooldown = 1.2;
  });
  c.hud.banner('Qual deles é o verdadeiro?', 'small');
  audio.play('summon', e.position.x, e.position.z);
}

// A cada quadro (fora das habilidades também): as cópias somem com o tempo.
export function shadowTick(e, dt, combat) {
  if (!e.data.phantom || !e.alive) return;
  e.life = (e.life ?? 9) - dt;
  if (e.life <= 0) { e.die(); combat.killed(e, 0, 1, null); }
}

// Cópia morreu (golpe ou tempo): some numa fumaça, sem ossos e sem ouro.
export function vanishPhantom(e, combat) {
  e.shattered = true;
  e.group.visible = false;
  combat.vfx.smoke(e.position, 0x1a1028, 12);
  combat.text.add('Falso!', e.position, 'miss', 3.6);
  audio.play('dodge', e.position.x, e.position.z);
  for (const w of e.weapons) w.visible = false;
}
