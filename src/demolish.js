// Demolidor (bênção da Espada e Escudo, pedido do dono 04/11; entrou no lugar da Mesa Virada):
// o golpe forte do Cavaleiro derruba o pilar/estrutura que não quebra mais perto da frente dele, caindo na direção
// do maior grupo de inimigos. Quem estiver na faixa onde ele cai perde 50% da vida máxima (chefes: 10%).
// A estrutura fica caída um instante e se desfaz em poeira (libera a passagem).
import * as THREE from 'three';
import { audio } from './audio.js';

export const DEMO = { reach: 2.4, arc: 80, width: 1.6, minLen: 2.5, maxLen: 5, dmg: 0.5, bossDmg: 0.2, fall: 0.6, lie: 1.2, sink: 0.6 };
const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

export class Demolisher {
  constructor(combat) {
    this.c = combat;
    this.list = [];     // estruturas da sala (builder.js: solids)
    this.falling = [];
    this.world = null;
    this.onTopple = null; // co-op: avisa o Jogador 2
  }

  setRoom(built, world) {
    this.clear();
    this.world = world;
    this.list = built ? built.solids || [] : [];
    for (const s of this.list) s.rect = s.colIdx >= 0 ? world.rects[s.colIdx] : null;
  }

  clear() {
    for (const f of this.falling) if (f.s.obj) f.s.obj.visible = false;
    this.falling.length = 0;
    this.list = [];
  }

  // Quantos inimigos ficam na faixa de queda (x, z) -> direção (dx, dz), comprimento len.
  inStrip(x, z, dx, dz, len) {
    const out = [];
    for (const e of this.c.enemies) {
      if (!e.targetable || e.undead) continue;
      const rx = e.position.x - x, rz = e.position.z - z;
      const along = rx * dx + rz * dz, side = Math.abs(rx * dz - rz * dx);
      if (along > -0.3 && along < len + e.data.radius && side < DEMO.width / 2 + e.data.radius) out.push(e);
    }
    return out;
  }

  // Golpe forte do herói (combat.playerStrike). Devolve true se derrubou alguma coisa.
  strike(p) {
    let best = null, bd = Infinity;
    for (const s of this.list) {
      if (s.down) continue;
      const dx = s.x - p.position.x, dz = s.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > DEMO.reach + s.r || (d > s.r + 0.6 && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > DEMO.arc * DEG)) continue;
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) return false;
    const s = best, len = Math.max(DEMO.minLen, Math.min(DEMO.maxLen, s.h));
    // Direção: a que pega mais inimigos (empate: a mais parecida com para onde o herói empurrou).
    const push = Math.atan2(s.x - p.position.x, s.z - p.position.z);
    let dir = push, most = 0, bestScore = -Infinity;
    for (let i = 0; i < 32; i++) {
      const a = i / 32 * Math.PI * 2, dx = Math.sin(a), dz = Math.cos(a);
      if (this.world && this.world.blocked(s.x + dx * Math.min(len, 1.5), s.z + dz * Math.min(len, 1.5), 0.05) && !this.inStrip(s.x, s.z, dx, dz, 1.5).length) continue; // parede logo ali
      const n = this.inStrip(s.x, s.z, dx, dz, len).length;
      const score = n * 10 + Math.cos(wrap(a - push)) * 0.5;
      if (score > bestScore) { bestScore = score; dir = a; most = n; }
    }
    s.down = true;
    if (s.rect && this.world) {
      const k = this.world.rects.indexOf(s.rect);
      if (k >= 0) { this.world.rects.splice(k, 1); this.world.version = (this.world.version || 0) + 1; }
    }
    const dx = Math.sin(dir), dz = Math.cos(dir);
    s.q0 = s.obj.quaternion.clone();
    this.falling.push({ s, p, dx, dz, len, t: 0, hit: false });
    this.c.text.add('Derrubou!', p.position, 'crit', 3.0);
    this.c.vfx.dust(v3(s.x, 0, s.z), v3(dx, 0, dz), 8);
    audio.play('creak', s.x, s.z);
    audio.play('crunch', s.x, s.z, { v: 0.8 });
    const i = this.list.indexOf(s);
    if (this.onTopple && i >= 0) this.onTopple(i, dx, dz);
    if (this.c.log) this.c.log({ type: 'demolish', name: s.name, aim: most });
    return true;
  }

  // Esmaga quem estiver na faixa quando a estrutura bate no chão.
  impact(f) {
    const { s, p, dx, dz, len } = f, c = this.c;
    let n = 0;
    for (const e of this.inStrip(s.x, s.z, dx, dz, len)) {
      if (c.kit2 && c.kit2.duelBlocks(p, e)) continue;
      const amt = Math.max(1, Math.round(e.maxHp * (e.data.boss ? DEMO.bossDmg : DEMO.dmg)));
      c.bonusDamage(e, amt, dx, dz, 'crit', p);
      if (e.alive && !e.data.boss && e.daze) e.daze(1.0);
      n++;
    }
    const mid = v3(s.x + dx * len / 2, 0, s.z + dz * len / 2);
    c.vfx.heavyImpact(mid, Math.min(1.6, len / 3));
    for (let k = 0.5; k <= len; k += 1) c.vfx.dust(v3(s.x + dx * k, 0, s.z + dz * k), v3(-dz, 0, dx), 4);
    c.props.hitLine(s.x, s.z, s.x + dx * len, s.z + dz * len, DEMO.width, p); // quebra barris e caixas no caminho
    c.shakeFor(p, 0.45);
    audio.play('boom', mid.x, mid.z);
    audio.play('bigShatter', mid.x, mid.z, { v: 0.6 });
    if (c.log) c.log({ type: 'demolishHit', hits: n });
  }

  update(dt) {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i], s = f.s, o = s.obj;
      f.t += dt;
      const k = Math.min(1, f.t / DEMO.fall);
      const ang = k * k * Math.PI / 2 * 0.97;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(f.dz, 0, -f.dx), ang);
      o.quaternion.copy(q).multiply(s.q0);
      if (k >= 1 && !f.hit) { f.hit = true; this.impact(f); }
      const after = f.t - DEMO.fall - DEMO.lie;
      if (after > 0) {
        o.position.y = -after / DEMO.sink * 1.2;
        if (!f.dusted) { f.dusted = true; for (let d = 0.5; d <= f.len; d += 1.2) this.c.vfx.puff(v3(s.x + f.dx * d, 0, s.z + f.dz * d)); }
      }
      if (after >= DEMO.sink) { o.visible = false; this.falling.splice(i, 1); }
    }
  }
}

// Peças sólidas que não quebram e dá para derrubar (builder.js). Cama, entulho e escadas ficam.
export const TOPPLE = /pillar|column|grave|tree_dead|shrine|plaque|barrier|crypt\/arch|fence_pillar|gravestone|lantern_standing|statue/;
