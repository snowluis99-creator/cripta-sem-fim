// Flechas (Arqueiro, Guardião enfurecido e o Mercador revidando). Voam em linha reta, param na parede,
// atravessam o herói durante o rolamento e o escudo do herói bloqueia de frente.
// hits: 'player' (padrão: acerta o herói e também o mercador) ou 'enemies' (flecha do mercador num esqueleto:
// atravessa o herói e acerta esqueletos).
import * as THREE from 'three';
import { audio } from './audio.js';
import { boltImpact } from './magic.js';
import { instance } from './assets.js';

import { getGlowTexture } from './dungeon/builder.js';

export const PROJECTILE_MODELS = ['weapons/skeletons/Skeleton_Arrow.gltf', 'props/crypt/skull.gltf'];

// Orbe mágico (Mago, Necromante) ou onda do Eco do Golpe: esfera brilhante feita em código.
const orbGeo = new THREE.SphereGeometry(0.32, 12, 10);
export function makeOrb(color, kind) {
  const g = new THREE.Group();
  if (kind === 'wave') {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 6, 24, Math.PI),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.set(Math.PI / 2, 0, Math.PI); // arco virado para a frente
    g.add(m);
  } else {
    g.add(new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff })));
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(kind === 'wave' ? 2.6 : 1.7);
  g.add(s);
  return g;
}

// Modelo de um projétil (também usado no computador do Jogador 2, que só desenha).
export function makeProjectileMesh(kind, color, s) {
  const g = new THREE.Group();
  if (kind === 'arrow') {
    const arrow = instance(PROJECTILE_MODELS[0]);
    arrow.rotation.x = -Math.PI / 2; // a ponta do modelo fica em -Y: vira para +Z (frente)
    g.add(arrow);
    g.scale.setScalar(2.4 * s); // maior que o modelo: fácil de ver voando
  } else if (kind === 'star' || kind === 'shard') {
    g.add(makeSpellMesh(color, kind));
    g.scale.setScalar(s);
  } else {
    g.add(makeOrb(color, kind));
    g.scale.setScalar(s);
  }
  return g;
}

// Magias da Maga: estrela dourada (Varinha) e lasca de gelo (Cajado de Gelo). children[1] = brilho que gira.
const starGeo = (() => {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.12 : 0.3;
    if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false });
})();
const shardGeo = new THREE.OctahedronGeometry(0.3, 0);
function makeSpellMesh(color, kind) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(kind === 'star' ? starGeo : shardGeo, new THREE.MeshBasicMaterial({ color: kind === 'star' ? 0xfff6c0 : new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35) }));
  if (kind === 'shard') m.scale.set(0.7, 0.7, 2.2); // lasca comprida apontando para a frente
  g.add(m);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(1.6);
  g.add(s);
  g.userData.spin = m;
  return g;
}

export class Projectiles {
  constructor(scene, combat) {
    this.scene = scene;
    this.combat = combat;
    this.list = [];
    this.drops = [];
  }

  // Dispara uma flecha de (x, z) na direção do ângulo. opts: { speed, damage, scale, height, owner }
  // opts extras (M4): kind 'arrow' | 'orb' | 'wave'; color; homing (rad/s virando para o herói);
  // hits 'hero' = disparo do herói (acerta esqueletos); pierce = atravessa; life (s).
  fire(x, z, angle, opts) {
    const kind = opts.kind || 'arrow';
    if (!this.visual && !opts.silent) audio.play(kind === 'arrow' ? 'arrow' : kind === 'orb' ? 'orb' : 'swingHeavy', x, z);
    const s = opts.scale || 1;
    const g = makeProjectileMesh(kind, opts.color ?? 0xb070ff, s);
    g.position.set(x, opts.height ?? 1.3, z);
    g.rotation.y = angle;
    this.scene.add(g);
    this.list.push({
      id: (this.nextId = (this.nextId || 0) + 1), color: opts.color ?? 0xb070ff, scale: s, speed: opts.speed,
      g, x, z, vx: Math.sin(angle) * opts.speed, vz: Math.cos(angle) * opts.speed,
      damage: opts.damage, r: (kind === 'arrow' ? 0.25 : kind === 'wave' ? 0.9 : 0.35) * s, life: opts.life || (kind === 'orb' ? 4.5 : 3),
      stuck: -1, owner: opts.owner, dodged: false, hits: opts.hits || 'player',
      kind, homing: opts.homing || 0, pierce: !!opts.pierce, hitSet: new Set(), age: 0, step: opts.step,
    });
  }

  update(dt) {
    const c = this.combat;
    this.updateRain(dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      if (!a) continue; // a lista pode ter sido limpa no meio (magia matou o chefe -> clear())
      if (a.stuck >= 0) { // presa na parede: some depois de um tempo
        a.stuck += dt;
        if (a.stuck > 1.2) this.remove(i);
        continue;
      }
      a.life -= dt;
      a.age += dt;
      if (a.life <= 0) {
        if (a.hits === 'spell' && a.step.cast.blast) boltImpact(c, a, null); // orbe grande explode no fim do caminho
        this.removeA(a); continue;
      }
      // Orbe teleguiado: vira devagar na direção do herói (só no primeiro 1,4 s).
      const hp = a.homing && a.age < 1.4 ? c.nearestPlayer(a.x, a.z) : null;
      if (hp && hp.state !== 'dead') {
        const p = hp;
        const want = Math.atan2(p.position.x - a.x, p.position.z - a.z), cur = Math.atan2(a.vx, a.vz);
        let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d));
        const na = cur + Math.max(-a.homing * dt, Math.min(a.homing * dt, d)), sp0 = Math.hypot(a.vx, a.vz);
        a.vx = Math.sin(na) * sp0; a.vz = Math.cos(na) * sp0;
        a.g.rotation.y = na;
      }
      if (a.kind !== 'arrow') a.g.children[0].children[1] && (a.g.children[0].children[1].material.rotation += dt * 4);
      if (a.g.children[0].userData.spin) a.g.children[0].userData.spin.rotation.z += dt * 14;
      // Anda em passos curtos (não atravessa parede nem herói com FPS baixo).
      let left = Math.hypot(a.vx, a.vz) * dt;
      const sp = Math.hypot(a.vx, a.vz), dx = a.vx / sp, dz = a.vz / sp;
      let done = false;
      while (left > 0 && !done) {
        const st = Math.min(0.3, left);
        left -= st;
        a.x += dx * st; a.z += dz * st;
        if (c.world.blocked(a.x, a.z, 0.05)) {
          if (a.hits === 'spell') { boltImpact(c, a, null); this.removeA(a); done = true; break; }
          if (a.kind !== 'arrow') { c.vfx.sparks(new THREE.Vector3(a.x, a.g.position.y, a.z), 0xc890ff, 6); this.remove(i); done = true; break; }
          a.stuck = 0; done = true; break;
        }
        if (a.hits === 'spell') { // magia da Maga: para no 1º esqueleto (ou no mercador)
          const e = c.enemies.find((en) => en.targetable && Math.hypot(en.position.x - a.x, en.position.z - a.z) < en.data.radius + a.r);
          const m = c.merchant;
          if (!e && m && m.alive && !m.ally && Math.hypot(m.position.x - a.x, m.position.z - a.z) < m.radius + a.r) {
            m.hit(Math.round(a.damage * a.owner.stats.damageMul), a.owner); this.remove(i); done = true; continue;
          }
          if (e) { boltImpact(c, a, e); this.removeA(a); done = true; }
          continue;
        }
        if (a.hits === 'hero') { // onda do herói: acerta cada esqueleto uma vez e segue
          for (const en of c.enemies) {
            if (!en.targetable || a.hitSet.has(en)) continue;
            if (Math.hypot(en.position.x - a.x, en.position.z - a.z) < en.data.radius + a.r) {
              a.hitSet.add(en);
              c.bonusDamage(en, a.damage, dx, dz, 'dmg', a.owner && a.owner.hero ? a.owner : null);
              c.vfx.sparks(new THREE.Vector3(en.position.x, 1.2, en.position.z), 0xffd36a, 6);
            }
          }
          if (!this.list.includes(a)) { done = true; break; } // chefe morreu e a lista foi limpa
          continue;
        }
        if (a.hits === 'enemies') { // flecha do mercador: acerta esqueletos, atravessa o herói
          const e = c.enemies.find((en) => en.targetable && Math.hypot(en.position.x - a.x, en.position.z - a.z) < en.data.radius + a.r);
          if (e) { c.merchantShot(e, a.damage, dx, dz); this.removeA(a); done = true; }
          continue;
        }
        const m = c.merchant;
        if (m && m.alive && a.owner !== m && Math.hypot(m.position.x - a.x, m.position.z - a.z) < m.radius + a.r) {
          m.hit(a.damage, a.owner && a.owner.alive !== undefined ? a.owner : c.player);
          this.remove(i); done = true; continue;
        }
        for (const p of c.players) {
          if (p.state === 'dead') continue;
          if (Math.hypot(p.position.x - a.x, p.position.z - a.z) >= p.hero.radius + a.r) continue;
          if (p.state === 'dodge') { // rolando: a flecha passa direto
            if (!(a.dodgedBy ||= new Set()).has(p)) { a.dodgedBy.add(p); c.text.add('Esquivou!', p.position, 'miss'); c.reflex(p); }
            continue;
          }
          if (p.invulnerable) continue;
          // A "origem" do golpe fica atrás da flecha: é dali que o escudo precisa estar virado.
          const src = { position: new THREE.Vector3(a.x - dx * 3, 0, a.z - dz * 3), alive: false, data: { boss: true } };
          c.hitPlayer(src, a.damage, { push: 4, noRepel: true, target: p });
          if (a.kind === 'orb') c.vfx.burst(p.position, 0xb070ff);
          if (c.log) c.log({ type: 'arrow', owner: a.owner, merchant: a.owner === c.merchant });
          this.remove(i);
          done = true;
          break;
        }
      }
      if (done && !this.list.includes(a)) continue;
      a.g.position.x = a.x; a.g.position.z = a.z;
    }
  }

  // Chuva de crânios (Necromante): cada crânio cai do alto num ponto e machuca quem estiver embaixo.
  // A sombra no chão cresce enquanto ele cai. spots: [{x, z, delay}]. cfg: { fall, radius, damage, owner }
  rain(spots, cfg) {
    for (const sp of spots) {
      const skull = instance(PROJECTILE_MODELS[1]);
      skull.scale.setScalar(1.5);
      skull.visible = false;
      this.scene.add(skull);
      const sh = new THREE.Mesh(new THREE.CircleGeometry(cfg.radius, 20),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(sp.x, 0.13, sp.z);
      this.scene.add(sh);
      this.drops.push({ x: sp.x, z: sp.z, t: -(sp.delay || 0), fall: cfg.fall, r: cfg.radius, damage: cfg.damage, owner: cfg.owner, skull, sh,
        spin: (Math.random() - 0.5) * 8 });
    }
  }

  updateRain(dt) {
    const c = this.combat;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      if (d.t < 0) continue;
      const k = Math.min(1, d.t / d.fall);
      d.skull.visible = true;
      d.skull.position.set(d.x, 16 * (1 - k * k), d.z);
      d.skull.rotation.x += d.spin * dt; d.skull.rotation.z += d.spin * 0.6 * dt;
      d.sh.material.opacity = 0.15 + 0.4 * k;
      d.sh.scale.setScalar(0.4 + 0.6 * k);
      if (k < 1) continue;
      // Caiu.
      const at = new THREE.Vector3(d.x, 0, d.z);
      if (!this.visual) {
        c.vfx.puff(at);
        c.vfx.sparks(new THREE.Vector3(d.x, 0.6, d.z), 0xc890ff, 8);
        c.cam.shake(0.08);
      }
      for (const p of this.visual ? [] : c.players) {
        if (p.state === 'dead' || Math.hypot(p.position.x - d.x, p.position.z - d.z) >= d.r + p.hero.radius * 0.6) continue;
        const src = { position: new THREE.Vector3(d.x, 0, d.z - 0.01), alive: false, data: { boss: true } };
        c.hitPlayer(src, d.damage, { push: 5, noRepel: true, target: p });
        if (c.log) c.log({ type: 'rainHit' });
      }
      this.scene.remove(d.skull); this.scene.remove(d.sh); d.sh.geometry.dispose(); d.sh.material.dispose();
      this.drops.splice(i, 1);
    }
  }

  // Tira um projétil pelo objeto (seguro mesmo se a lista mudou durante o impacto).
  removeA(a) { const i = this.list.indexOf(a); if (i >= 0) this.remove(i); }

  remove(i) {
    if (!this.list[i]) return;
    this.scene.remove(this.list[i].g);
    this.list.splice(i, 1);
  }

  clear() {
    for (let i = this.list.length - 1; i >= 0; i--) this.remove(i);
    for (const d of this.drops) { this.scene.remove(d.skull); this.scene.remove(d.sh); }
    this.drops.length = 0;
  }
}
