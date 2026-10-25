// Habilidades especiais dos inimigos (os números ficam em ENEMIES, em enemies.js):
// - Lacaio: salto para as costas do herói + golpe rápido.
// - Guerreiro: investida muito rápida em linha reta.
// - Arqueiro: atira com a besta (ranged.js).
// - Guardião (chefe): giro de 360°, invocar esqueletos e círculos no chão que prendem o herói.
//   Com metade da vida ele se enfurece: dobra de tamanho, fica mais forte e ganha o salto, a investida e flechas.
// Sem avisos no chão (pedido do dono): só a pose/animação do inimigo denuncia a habilidade.
import * as THREE from 'three';
import { runRanged, startVolley } from './ranged.js';
import { setFlash, findBone } from './characters.js';
import { BoneSword } from './bonesword.js';
import { audio } from './audio.js';
import { sayLine } from './voice.js';
import { trySpell, runSpell, SPELL_STATES, SPELL_KEYS } from './necro.js';
import { tryShadow, runShadow, SHADOW_STATES, SHADOW_KEYS } from './shadow.js';
import { tryToss, runToss, TOSS_STATES } from './toss.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rand = ([a, b]) => a + Math.random() * (b - a);

// Estados controlados por este arquivo (o resto fica em enemies.js).
export const ABILITY_STATES = new Set(['leap', 'leapWind', 'chargeWind', 'charge', 'recover', 'spinWind', 'spinMove', 'spinGather', 'spin', 'summon', 'cast', 'aim', 'shot', 'roll', 'hop', 'reload', 'grab', 'rage', ...TOSS_STATES, ...SPELL_STATES, ...SHADOW_STATES]);

// Avisos antigos (anéis e faixas no chão) foram removidos; nada a esconder.
export function hideTelegraphs() {}

function eyes(e, v) { if (e.eyes.length) setFlash(e.eyes, v, 1, 0.1, 0.05); }

// ---------- Começo ----------
export function initAbilities(e) {
  const d = e.data;
  e.cd = {};
  for (const k of ['leap', 'charge', 'spin', 'summon', 'cast', 'volley', 'toss', ...SPELL_KEYS, ...SHADOW_KEYS]) if (d[k]) e.cd[k] = rand(d[k].first || [0, 0]);
}

// Chamado enquanto o inimigo persegue o herói. Devolve true se começou uma habilidade.
export function tryAbility(e, ctx, dist) {
  const d = e.data, p = ctx.player, cd = e.cd;
  if (p.state === 'dead') return false;
  if (d.spin && cd.spin <= 0 && dist <= d.spin.range) return start(e, 'spinWind');
  if (d.summon && cd.summon <= 0) {
    const minions = ctx.combat.enemies.filter((o) => o.alive && o !== e).length;
    if (minions < d.summon.cap * (ctx.combat.players.length > 1 ? 2 : 1)) return start(e, 'summon');
    cd.summon = 3;
  }
  if (d.cast && cd.cast <= 0 && dist > 2.5) return start(e, 'cast');
  if (tryToss(e, ctx, dist)) return true;
  if (trySpell(e, ctx, dist)) return true;
  if (tryShadow(e, ctx, dist)) return true;
  if (d.leap && cd.leap <= 0 && dist >= d.leap.range[0] && dist <= d.leap.range[1]) return startLeap(e, ctx);
  if (d.charge && cd.charge <= 0 && dist >= d.charge.range[0] && dist <= d.charge.range[1]
    && Math.abs(wrap(Math.atan2(p.position.x - e.position.x, p.position.z - e.position.z) - e.facing)) < 1.2) return start(e, 'chargeWind');
  if (d.volley && cd.volley <= 0 && dist >= d.volley.range) { startVolley(e); return true; }
  return false;
}

function start(e, state) {
  const d = e.data;
  e.releaseToken();
  // Enfurecido: antes do giro ele vai até o meio da sala e monta a espada de esqueletos.
  if (state === 'spinWind' && d.spin.boneSword) state = 'spinMove';
  e.setState(state);
  e.hitDone = false;
  switch (state) {
    case 'spinWind': e.anim.play('Melee_2H_Idle', { fade: 0.1 }); audio.play('charge', e.position.x, e.position.z); break;
    case 'spinMove': e.anim.play(d.anims.walk, { speed: d.walkAnimSpeed * 1.4, fade: 0.15 }); break;
    case 'summon':
      e.anim.play('Ranged_Magic_Summon', { once: true, restart: true, speed: 2.4, fade: 0.15 });
      e.combat.text.add('Levantem-se!', e.position, 'block', 2.6 + 2.2 * (d.scale || 1));
      audio.play('summon', e.position.x, e.position.z);
      break;
    case 'cast': e.anim.play('Ranged_Magic_Raise', { once: true, restart: true, speed: 1.0, fade: 0.12 }); audio.play('spell', e.position.x, e.position.z); break; // para e levanta a mão direita
    case 'chargeWind': e.anim.play('Crouching', { fade: 0.12 }); audio.play('charge', e.position.x, e.position.z); break;
    default: break;
  }
  if (state === 'summon') e.cd.summon = rand(d.summon.cooldown);
  if (state === 'cast') e.cd.cast = rand(d.cast.cooldown);
  return true;
}

// Ponto atrás do herói (do lado oposto ao que ele está olhando), livre de paredes e obstáculos.
export function spotBehind(p, world, dist, r) {
  const back = p.facing + Math.PI;
  for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
    for (const k of [1, 0.75, 0.5]) {
      const a = back + off;
      const x = p.position.x + Math.sin(a) * dist * k, z = p.position.z + Math.cos(a) * dist * k;
      if (!world.blocked(x, z, r)) return { x, z };
    }
  }
  return null;
}

// Destino do salto: um lugar livre num círculo em volta do herói (de preferência atrás dele),
// longe dos outros esqueletos e de onde os outros estão caindo — assim eles cercam em roda em vez de empilhar.
export function leapSpot(e, ctx, dist) {
  const p = ctx.player, w = ctx.world, r = e.data.radius + 0.1, back = p.facing + Math.PI;
  const others = [];
  for (const o of ctx.combat.enemies) {
    if (o === e || !o.alive) continue;
    others.push(o.state === 'leap' && o.leapTo ? o.leapTo : o.position);
  }
  const gap = (e.data.radius + 0.6) * 2; // espaço livre entre um e outro
  let best = null, bs = -Infinity;
  for (let i = 0; i < 24; i++) {
    const a = back + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 12);
    for (const k of [1, 0.8, 0.6]) {
      const x = p.position.x + Math.sin(a) * dist * k, z = p.position.z + Math.cos(a) * dist * k;
      if (w.blocked(x, z, r)) continue;
      let sc = -Math.abs(wrap(a - back)) * 0.8 - (1 - k) * 2;
      for (const o of others) { const dd = Math.hypot(o.x - x, o.z - z); if (dd < gap) sc -= (gap - dd) * 6; }
      if (sc > bs) { bs = sc; best = { x, z }; }
      break;
    }
  }
  return best;
}

function startLeap(e, ctx) {
  const L = e.data.leap;
  const spot = leapSpot(e, ctx, L.behind);
  if (!spot) { e.cd.leap = 1; return false; }
  start(e, 'leap');
  audio.play('swingHeavy', e.position.x, e.position.z);
  e.leapFrom = { x: e.position.x, z: e.position.z };
  e.leapTo = spot;
  e.leapHero = { x: ctx.player.position.x, z: ctx.player.position.z }; // onde o herói estava quando ele pulou
  e.anim.play('Jump_Full_Short', { once: true, restart: true, speed: 1.17 / L.time * 0.85, fade: 0.08 });
  return true;
}

// ---------- A cada quadro (estados especiais) ----------
// Devolve { target, turn } para o inimigo virar, ou null.
export function runAbility(e, dt, ctx, { dist, toPlayer }) {
  const d = e.data, p = ctx.player, combat = ctx.combat;
  switch (e.state) {
    // --- Lacaio ---
    case 'leap': {
      const L = d.leap, k = Math.min(1, e.t / L.time);
      // Recalcula o destino no começo do salto se o herói se mexeu muito (continua caindo nas costas dele).
      if (k < 0.35) {
        const s = leapSpot(e, ctx, L.behind);
        if (s) e.leapTo = s;
      }
      e.position.x = e.leapFrom.x + (e.leapTo.x - e.leapFrom.x) * k;
      e.position.z = e.leapFrom.z + (e.leapTo.z - e.leapFrom.z) * k;
      e.group.position.y = L.height * 4 * k * (1 - k);
      // Encostou no herói durante o salto (baixo, não por cima da cabeça): agarra e imobiliza.
      // (só se o herói se mexeu para dentro do salto: parado, o esqueleto passa por cima e cai nas costas).
      const moved = e.leapHero ? Math.hypot(p.position.x - e.leapHero.x, p.position.z - e.leapHero.z) : 0;
      if (L.grab && k > 0.12 && e.group.position.y < 1.1 && moved > 0.6 && canGrab(e, p)) { startGrab(e, ctx, p); return { target: toPlayer, turn: 20 }; }
      if (k >= 1) {
        e.group.position.y = 0;
        combat.vfx.dust(e.position, new THREE.Vector3(0, 0, 0), 5);
        e.setState('leapWind');
        e.anim.play(d.anims.idle, { fade: 0.08 });
      }
      return { target: toPlayer, turn: 14 };
    }
    case 'grab': {
      // Segurando o herói: fica colado nas costas/lado dele até soltar.
      const G = d.leap, h = e.grabbed;
      if (h && h.state !== 'dead') {
        const ang = Math.atan2(e.position.x - h.position.x, e.position.z - h.position.z);
        const R = d.radius + h.hero.radius - 0.15;
        e.position.x = h.position.x + Math.sin(ang) * R; e.position.z = h.position.z + Math.cos(ang) * R;
      }
      if (e.t >= G.grab || !h || h.state === 'dead') {
        releaseGrab(e);
        // Solta e já emenda o golpe rápido (sem a preparação inteira: dá tempo de rolar ao ser solto).
        e.setState('leapWind');
        e.t = Math.max(0, d.leap.wind - (G.afterGrab ?? 0.2));
        e.anim.play(d.anims.idle, { fade: 0.08 });
      }
      return { target: toPlayer, turn: 20 };
    }
    case 'leapWind': {
      if (e.t >= d.leap.wind) {
        e.cd.leap = rand(d.leap.cooldown);
        e.hasToken = true; combat.attackers++;
        e.startAttack(d.leap.attack);
      }
      return { target: toPlayer, turn: 10 };
    }
    // --- Guerreiro ---
    case 'chargeWind': {
      const C = d.charge, k = Math.min(1, e.t / C.wind);
      if (e.t >= C.wind) {
        e.setState('charge');
        e.chargeLeft = C.distance;
        e.hitDone = false;
        e.chargeHit = new Set();
        e.anim.play('Running_A', { speed: 2.2, fade: 0.05 });
        combat.vfx.dust(e.position, new THREE.Vector3(-Math.sin(e.facing), 0, -Math.cos(e.facing)), 8);
      }
      // Mira no herói até perto do fim; depois trava a direção (dá para sair da frente).
      return k < 0.7 ? { target: toPlayer, turn: 7 } : null;
    }
    case 'charge': {
      const C = d.charge;
      const fx = Math.sin(e.facing), fz = Math.cos(e.facing);
      let left = C.speed * dt, stop = false;
      while (left > 0 && !stop) {
        const st = Math.min(0.3, left);
        left -= st; e.chargeLeft -= st;
        const bx = e.position.x, bz = e.position.z;
        e.position.x += fx * st; e.position.z += fz * st;
        ctx.world.resolveCircle(e.position, d.radius);
        const moved = Math.hypot(e.position.x - bx, e.position.z - bz);
        if (moved < st * 0.5) stop = true; // bateu na parede
        // Atropela qualquer herói no caminho (co-op: cada um só uma vez por investida).
        for (const h of combat.alivePlayers) {
          if (e.chargeHit && e.chargeHit.has(h)) continue;
          if (Math.hypot(h.position.x - e.position.x, h.position.z - e.position.z) >= d.radius + h.hero.radius + 0.5) continue;
          (e.chargeHit ||= new Set()).add(h);
          e.hitDone = true;
          combat.hitPlayer(e, C.damage, { push: C.push, target: h });
          if (e.state !== 'charge') return null; // o escudo do herói empurrou de volta
          stop = true;
        }
        if (e.chargeLeft <= 0) stop = true;
      }
      if (Math.random() < dt * 30) combat.vfx.dust(e.position, new THREE.Vector3(-fx, 0, -fz), 1);
      if (stop) {
        combat.cam.shake(0.15);
        e.setState('recover');
        e.cd.charge = rand(C.cooldown);
        e.anim.play('Hit_B', { once: true, restart: true, speed: 0.9, fade: 0.08 });
      }
      return null;
    }
    case 'recover':
      if (e.t >= d.charge.recover) { e.setState('chase'); e.anim.play(d.anims.idle, { fade: 0.15 }); }
      return null;
    // --- Guardião ---
    case 'spinWind': {
      const S = d.spin;
      if (e.t >= S.wind) {
        e.setState('spin');
        e.hitDone = false;
        e.anim.play('Melee_2H_Attack_Spinning', { once: true, restart: true, speed: S.speed, fade: 0.05 });
        audio.play('spin', e.position.x, e.position.z);
      }
      return { target: toPlayer, turn: 3 };
    }
    case 'spinMove': {
      // Anda até o meio da sala (o centro da sala é o ponto 0,0).
      const B = d.spin.boneSword, cx = -e.position.x, cz = -e.position.z, dc = Math.hypot(cx, cz);
      if (dc < 0.8 || e.t >= B.walkTimeout) {
        e.setState('spinGather');
        e.boneSword = new BoneSword(e, combat, B);
        e.anim.play('Melee_2H_Idle', { fade: 0.2 });
        combat.text.add('A Lâmina dos Mortos!', e.position, 'block', 9);
        combat.cam.shake(0.3);
        return { target: toPlayer, turn: 3 };
      }
      const st = Math.min(dc, d.speed * 1.6 * dt);
      e.position.x += (cx / dc) * st; e.position.z += (cz / dc) * st;
      return { target: Math.atan2(cx, cz), turn: 8 };
    }
    case 'spinGather': {
      const B = d.spin.boneSword;
      if (e.boneSword.update(dt)) {
        e.gatherDone = (e.gatherDone || 0) + dt;
        if (e.gatherDone >= B.hold) {
          e.gatherDone = 0;
          e.setState('spin');
          e.hitDone = false;
          e.anim.play('Melee_2H_Attack_Spinning', { once: true, restart: true, speed: d.spin.speed, fade: 0.05 });
          audio.play('spin', e.position.x, e.position.z);
        }
      }
      return { target: toPlayer, turn: 2 };
    }
    case 'spin': {
      const S = d.spin, pr = e.anim.progress();
      if (e.boneSword) e.boneSword.update(dt);
      if (!e.hitDone && pr >= S.hit) {
        e.hitDone = true;
        combat.vfx.heavyImpact(e.position, Math.min(S.radius, 8) / 2.3);
        combat.cam.shake(S.global ? 0.6 : 0.3);
        // Enfurecido: o giro pega a sala inteira e não dá para rolar; só o escudo defende.
        for (const h of combat.alivePlayers) {
          const dh = Math.hypot(h.position.x - e.position.x, h.position.z - e.position.z);
          if (S.global || dh <= S.radius + h.hero.radius) combat.hitPlayer(e, S.damage, { push: S.push, noRepel: true, unDodgeable: S.global, target: h });
        }
      }
      if (pr >= 0.98) {
        e.cd.spin = rand(S.cooldown);
        if (e.boneSword) { e.boneSword.shatter(); e.boneSword = null; combat.cam.shake(0.3); }
        e.setState('chase');
        e.anim.play(d.anims.idle, { fade: 0.15 });
      }
      return null;
    }
    case 'summon': {
      if (!e.hitDone && e.t >= d.summon.time * 0.45) {
        e.hitDone = true;
        combat.vfx.burst(e.position, 0xb070ff);
        if (combat.onSummon) combat.onSummon(e, d.summon.list);
      }
      if (e.t >= d.summon.time) { e.setState('chase'); e.anim.play(d.anims.idle, { fade: 0.2 }); }
      return { target: toPlayer, turn: 2 };
    }
    case 'cast': {
      const Cs = d.cast;
      if (!e.hitDone && e.t >= Cs.time * 0.5) {
        e.hitDone = true;
        combat.hazards.rootCircles(p, Cs);
        e.weapons[0]?.getWorldPosition && combat.vfx.burst(e.weapons[0].getWorldPosition(new THREE.Vector3()), 0xb070ff);
      }
      if (e.t >= Cs.time) { e.setState('chase'); e.anim.play(d.anims.idle, { fade: 0.2 }); }
      return null; // parado, com a mão direita levantada
    }
    case 'aim': case 'shot': case 'roll': case 'hop': case 'reload': return runRanged(e, dt, ctx, { toPlayer, dist });
    case 'tpOut': case 'tpIn': case 'revive': case 'rain': case 'ring': case 'nova': return runSpell(e, dt, ctx, { dist, toPlayer });
    case 'tossGrab': case 'tossThrow': case 'held': case 'thrown': return runToss(e, dt, ctx, { dist, toPlayer });
    case 'vanish': case 'stalk': case 'ambushWind': case 'shadeOut': case 'shadeIn': case 'clones': case 'reap': return runShadow(e, dt, ctx, { dist, toPlayer });
    // --- Guardião se enfurecendo: cresce até o dobro do tamanho ---
    case 'rage': {
      const R = e.rageCfg, k = Math.min(1, e.t / R.grow);
      const s = R.from + (R.to - R.from) * (1 - (1 - k) ** 3);
      e.group.scale.setScalar(s);
      eyes(e, 1.4 + 3 * k);
      if (Math.random() < dt * 12) combat.vfx.dust(e.position, new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5), 2);
      if (e.t >= R.time) { e.setState('chase'); e.anim.play(d.anims.idle, { fade: 0.2 }); }
      return null;
    }
    default: return null;
  }
}

// ---------- Agarrão (salto do Lacaio que encosta no herói) ----------
function canGrab(e, p) {
  if (!p || !p.hero || p.state === 'dead' || p.state === 'rooted' || p.state === 'cine' || p.invulnerable) return false;
  if ((p.grabImmune || 0) > 0) return false; // acabou de ser solto: não emenda outro agarrão
  return Math.hypot(p.position.x - e.position.x, p.position.z - e.position.z) < e.data.radius + p.hero.radius + 0.15;
}

function startGrab(e, ctx, p) {
  const G = e.data.leap;
  e.group.position.y = 0;
  e.setState('grab');
  e.grabbed = p;
  e.cd.leap = rand(G.cooldown);
  p.root(G.grab, 'grab');
  p.grabImmune = G.grab + 1.6;
  e.anim.play('Interact', { once: true, restart: true, speed: 1.6, fade: 0.06 }); // braços para a frente, segurando
  const c = ctx.combat;
  c.text.add('Agarrado!', p.position, 'hurt', 3.2);
  c.vfx.dust(e.position, new THREE.Vector3(0, 0, 0), 4);
  if (c.shakeFor) c.shakeFor(p, 0.2); else c.cam.shake(0.2);
  audio.play('swingHeavy', e.position.x, e.position.z);
  if (c.log) c.log({ type: 'grab', enemy: e });
}

// Solta o herói (acabou o tempo, ou o esqueleto apanhou/morreu).
export function releaseGrab(e) {
  const h = e.grabbed;
  e.grabbed = null;
  if (h && h.state === 'rooted' && h.rootKind === 'grab') h.rootTime = Math.min(h.rootTime, 0);
}

// Metade da vida: o Guardião se enfurece (dobra de tamanho, habilidades mais fortes + as dos outros esqueletos).
export function startRage(e, combat) {
  const base = e.data, R = base.rage;
  e.raged = true;
  e.releaseToken();
  e.rageCfg = { from: base.scale || 1, to: R.stats.scale, grow: R.grow, time: R.time };
  e.data = { ...base, ...R.stats };
  e.damage = Math.round(e.data.damage * (e.dmgScale || 1));
  e.cooldown = 1;
  initAbilities(e);
  e.setState('rage');
  e.vel.set(0, 0, 0);
  e.anim.play('Skeletons_Taunt', { once: true, restart: true, speed: 1.1, fade: 0.15 });
  combat.cam.shake(0.7);
  combat.vfx.burst(e.position, 0xff3030);
  combat.hud.banner('O Rei Skullbone se enfurece!', 'big');
  audio.play('boom', e.position.x, e.position.z);
  if (base.voice) sayLine('rage', (Math.random() * 1e9) | 0, e, combat); // metade da vida: discurso furioso
}

// Círculos: o Guardião fica parado com o braço direito esticado para cima (por cima da animação).
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
const _q = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _id = new THREE.Quaternion();
export function aimBone(bone, child, dir, w) {
  bone.updateWorldMatrix(true, true);
  bone.getWorldPosition(_a); child.getWorldPosition(_b);
  _q.setFromUnitVectors(_b.sub(_a).normalize(), dir);
  if (w < 1) _q.slerpQuaternions(_id, _q.clone(), w);
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq)));
}
export function raiseRightArm(e) {
  if (!e.armBones) e.armBones = ['upperarm.r', 'lowerarm.r', 'wrist.r'].map((n) => findBone(e.model, n));
  const [up, low, wrist] = e.armBones;
  if (!up || !low || !wrist) return;
  const T = e.data.cast.time, w = Math.min(1, e.t / 0.2, (T - e.t) / 0.2 + 0.0001);
  if (w <= 0) return;
  // para cima, um pouco para o lado direito dele (para não sumir atrás da cabeça grande)
  const sf = Math.sin(e.facing), cf = Math.cos(e.facing);
  _d.set(sf * 0.15 - cf * 0.45, 1, cf * 0.15 + sf * 0.45).normalize();
  aimBone(up, low, _d, w);
  aimBone(low, wrist, _d, w);
}

// Recarga das habilidades (fora delas).
export function tickCooldowns(e, dt) {
  if (!e.cd || ABILITY_STATES.has(e.state)) return;
  const k2 = dt * (e.data.abilityRate || 1); // dificuldade: habilidades mais frequentes
  for (const k in e.cd) e.cd[k] -= k2;
}
