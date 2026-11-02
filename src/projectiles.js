// Flechas (Arqueiro, Guardião enfurecido e o Mercador revidando). Voam em linha reta, param na parede,
// atravessam o herói durante o rolamento e o escudo do herói bloqueia de frente.
// hits: 'player' (padrão: acerta o herói e também o mercador) ou 'enemies' (flecha do mercador num esqueleto:
// atravessa o herói e acerta esqueletos).
import * as THREE from 'three';
import { audio } from './audio.js';
import { boltImpact } from './magic.js';
import { hitUndead, undeadHit } from './undead.js';
import { useShield } from './shield.js';
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
      kind, homing: opts.homing || 0, pierce: !!opts.pierce, hitSet: new Set(), age: 0, step: opts.step, burn: opts.burn || 0,
      pierceLeft: (opts.step && opts.step.cast && opts.step.cast.pierce) || 0, // magia que atravessa (bênçãos)
      onEnd: opts.onEnd, // Arqueiro: avisa onde a flecha parou (ela cai no chão para ele buscar)
    });
  }

  update(dt) {
    const c = this.combat;
    this.updateRain(dt);
    if (this.bolts) for (const b of [...this.bolts]) if (!b.owner || !b.owner.alive) this.takeBolt(b); // dono morreu: o virote some
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
      // Magia da Maga (Cajado, Gelo, Varinha): segue o inimigo dentro do alcance que ainda falta voar.
      if (a.hits === 'spell') this.steerSpell(a, dt);
      // Rebatido pela barreira da Maga: volta para quem atirou.
      if (a.hits === 'reflected') this.steerReflected(a, dt);
      // Orbe teleguiado: vira devagar na direção do herói (só no primeiro 1,4 s).
      const hp = !(a.homing && a.age < 1.4) ? null : a.hits === 'player' ? c.nearestPlayer(a.x, a.z)
        : a.hits === 'undead' && a.owner && a.owner.target && a.owner.target.targetable ? a.owner.target : null;
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
        if (c.world.blocked(a.x, a.z, 0.05) && !(a.hits !== 'player' && a.hits !== 'reflected' && c.props.hitAt(a.x, a.z, a.owner))) { // objeto quebrável: quebra e o disparo segue
          if (a.hits === 'spell') { boltImpact(c, a, null); this.removeA(a); done = true; break; }
          if (a.hits === 'reflected') { c.vfx.sparks(new THREE.Vector3(a.x, a.g.position.y, a.z), 0x9fd8ff, 6); this.remove(i); done = true; break; }
          if (a.kind !== 'arrow') { c.vfx.sparks(new THREE.Vector3(a.x, a.g.position.y, a.z), 0xc890ff, 6); this.remove(i); done = true; break; }
          if (a.onEnd) { this.remove(i); done = true; break; } // flecha do Arqueiro: cai no chão (vira virote para buscar)
          a.stuck = 0; done = true; break;
        }
        if (a.hits === 'spell') { // magia da Maga: para no 1º esqueleto (ou no mercador)
          const e = c.enemies.find((en) => en.targetable && !a.hitSet.has(en) && Math.hypot(en.position.x - a.x, en.position.z - a.z) < en.data.radius + a.r);
          const m = c.merchant;
          if (!e && m && m.alive && !m.ally && Math.hypot(m.position.x - a.x, m.position.z - a.z) < m.radius + a.r) {
            m.hit(Math.round(a.damage * a.owner.stats.damageMul), a.owner); this.remove(i); done = true; continue;
          }
          if (e && a.pierceLeft > 0) { // Atravessar: acerta e segue voando
            a.pierceLeft--; a.hitSet.add(e); a.target = null;
            boltImpact(c, a, e);
            if (!this.list.includes(a)) { done = true; break; }
            continue;
          }
          if (e) { boltImpact(c, a, e); this.removeA(a); done = true; }
          continue;
        }
        if (a.hits === 'reflected') { // rebatido: acerta inimigos (o mesmo dano que daria no herói)
          const e = c.enemies.find((en) => en.targetable && !a.hitSet.has(en) && Math.hypot(en.position.x - a.x, en.position.z - a.z) < en.data.radius + a.r);
          if (e) {
            a.hitSet.add(e);
            c.bonusDamage(e, a.damage, dx, dz, 'dmg', a.by);
            c.vfx.sparks(new THREE.Vector3(e.position.x, 1.2, e.position.z), 0x9fd8ff, 10);
            audio.play('hit', e.position.x, e.position.z);
            if (c.log) c.log({ type: 'reflectHit', enemy: e, dmg: a.damage, owner: a.owner });
            if (!this.list.includes(a)) { done = true; break; } // chefe morreu e a lista foi limpa
            // Ricochete: pula para outro inimigo perto
            if (a.bounces > 0) {
              const nx = c.enemies.filter((en) => en.targetable && !a.hitSet.has(en)).sort((u, v) => Math.hypot(u.position.x - a.x, u.position.z - a.z) - Math.hypot(v.position.x - a.x, v.position.z - a.z))[0];
              if (nx && Math.hypot(nx.position.x - a.x, nx.position.z - a.z) < 12) { a.bounces--; a.target = nx; a.life = 2; continue; }
            }
            this.removeA(a); done = true;
          }
          continue;
        }
        if (a.hits === 'undead') { // tiro de um morto-vivo da Maga: acerta inimigos, atravessa heróis e outros mortos-vivos
          const e = c.enemies.find((en) => !en.undead && en.targetable && Math.hypot(en.position.x - a.x, en.position.z - a.z) < en.data.radius + a.r);
          if (e) { undeadHit(c, a.owner, e, a.damage); this.removeA(a); done = true; }
          continue;
        }
        if (a.hits === 'hero') { // onda do herói: acerta cada esqueleto uma vez e segue
          for (const en of c.enemies) {
            if (!en.targetable || a.hitSet.has(en)) continue;
            if (Math.hypot(en.position.x - a.x, en.position.z - a.z) < en.data.radius + a.r) {
              a.hitSet.add(en);
              c.bonusDamage(en, a.damage, dx, dz, 'dmg', a.owner && a.owner.hero ? a.owner : null);
              if (a.burn && en.alive) { en.burn = 3; en.burnDps = Math.max(en.burnDps || 0, a.burn); en.burnTick = 0.5; en.burnBy = a.owner; } // Lança do Dragão
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
        // Morto-vivo da Maga (Cajado das Trevas) no caminho: leva a flecha/magia.
        const ud = c.enemies.find((en) => en.undead && en.alive && en !== a.owner && Math.hypot(en.position.x - a.x, en.position.z - a.z) < en.data.radius + a.r);
        if (ud) { hitUndead(c, ud, a.damage, a.x - dx * 3, a.z - dz * 3); this.remove(i); done = true; continue; }
        const m = c.merchant;
        if (m && m.alive && a.owner !== m && Math.hypot(m.position.x - a.x, m.position.z - a.z) < m.radius + a.r) {
          m.hit(a.damage, a.owner && a.owner.alive !== undefined ? a.owner : c.player);
          this.remove(i); done = true; continue;
        }
        for (const p of c.players) {
          if (p.state === 'dead') continue;
          if (Math.hypot(p.position.x - a.x, p.position.z - a.z) >= p.hero.radius + a.r) continue;
          if (p.state === 'dodge') { // rolando: a flecha passa direto
            if (!(a.dodgedBy ||= new Set()).has(p)) { a.dodgedBy.add(p); c.text.add('Esquivou!', p.position, 'miss'); c.reflex(p); c.dodgeUlt(p); }
            continue;
          }
          if (p.invulnerable) continue;
          // Rapieira: aparar no instante certo também segura flechas e magias (o projétil some).
          if (c.rogue && c.rogue.tryParry(p, { position: new THREE.Vector3(a.x - dx * 3, 0, a.z - dz * 3), alive: false, data: {} }, { shot: true })) {
            c.vfx.sparks(new THREE.Vector3(a.x, a.g.position.y, a.z), 0xffe27a, 10);
            this.remove(i); done = true; break;
          }
          // Barreira da Maga: rebate (flecha, orbe, onda do Ceifador...) de volta para quem atirou.
          if (p.reflects(a.x - dx * 3, a.z - dz * 3)) { this.reflect(a, p); done = true; break; }
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

  // Magia da Maga: escolhe o inimigo mais perto que ainda dá para alcançar (de preferência à frente) e vira para ele.
  steerSpell(a, dt) {
    const c = this.combat, sp = Math.hypot(a.vx, a.vz) || 1, reach = sp * a.life;
    const cur = Math.atan2(a.vx, a.vz);
    const ok = (e) => e && e.targetable && !a.hitSet.has(e) && Math.hypot(e.position.x - a.x, e.position.z - a.z) <= reach + e.data.radius;
    if (!ok(a.target)) {
      a.target = null; let best = Infinity;
      for (const e of c.enemies) {
        if (!ok(e)) continue;
        const d = Math.hypot(e.position.x - a.x, e.position.z - a.z);
        let da = Math.atan2(e.position.x - a.x, e.position.z - a.z) - cur; da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
        if (da > (a.age < 0.05 ? 1.2 : 1.9)) continue; // no disparo: só quem está mais ou menos na frente
        const score = d + da * 3;
        if (score < best) { best = score; a.target = e; }
      }
    }
    if (a.target) this.turnTo(a, a.target.position.x, a.target.position.z, Math.max(9, sp * 0.6) * dt); // mais rápida = vira mais (curva sempre curta)
  }

  steerReflected(a, dt) {
    const t = a.target;
    if (t && t.targetable) this.turnTo(a, t.position.x, t.position.z, 12 * dt);
  }

  turnTo(a, x, z, maxTurn) {
    const want = Math.atan2(x - a.x, z - a.z), cur = Math.atan2(a.vx, a.vz);
    let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d));
    const na = cur + Math.max(-maxTurn, Math.min(maxTurn, d)), sp0 = Math.hypot(a.vx, a.vz);
    a.vx = Math.sin(na) * sp0; a.vz = Math.cos(na) * sp0;
    a.g.rotation.y = na;
  }

  // Barreira da Maga rebateu o projétil: volta (mais rápido) para quem atirou, com o mesmo dano que daria nela.
  reflect(a, p) {
    const c = this.combat, st = p.stats;
    a.hits = 'reflected';
    a.by = p;
    a.damage = Math.round(a.damage * (st.reflectMul || 1));
    a.bounces = st.reflectBounce || 0;
    a.hitSet = new Set();
    a.homing = 0;
    const o = a.owner;
    a.target = o && o.targetable && c.enemies.includes(o) ? o : null;
    const sp = Math.max(a.speed || Math.hypot(a.vx, a.vz), 14) * 1.25;
    const ang = a.target ? Math.atan2(a.target.position.x - a.x, a.target.position.z - a.z) : Math.atan2(-a.vx, -a.vz);
    a.vx = Math.sin(ang) * sp; a.vz = Math.cos(ang) * sp;
    a.g.rotation.y = ang;
    a.life = 3; a.age = 0;
    a.x = p.position.x + Math.sin(ang) * (p.hero.radius + a.r + 0.15); a.z = p.position.z + Math.cos(ang) * (p.hero.radius + a.r + 0.15);
    const nx = -Math.sin(ang), nz = -Math.cos(ang);
    const res = useShield(p, c, o); // cada rebatida gasta 1 da barreira (quebra com 10, igual ao escudo)
    p.blockedHit(0, nx, nz);
    c.vfx.sparks(new THREE.Vector3(a.x, 1.3, a.z), 0x9fd8ff, 14);
    if (res !== 'break') c.text.add('Refletiu!', p.position, 'block');
    else { p.setState('hurt'); p.anim.play(p.hero.anims.hit, { once: true, speed: 1.6, fade: 0.05, restart: true }); }
    if (st.reflectHeal > 0) { const h = p.heal(st.reflectHeal); if (h) c.text.add(`+${h}`, p.position, 'heal'); }
    if (st.reflectCounter) p.counterReady = true;
    c.addHitstop(0.04);
    if (c.log) c.log({ type: 'reflected', kind: a.kind, owner: o, p });
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
        c.hitPlayer(src, d.damage, { push: 5, noRepel: true, bossSkill: true, target: p });
        if (c.log) c.log({ type: 'rainHit' });
      }
      this.scene.remove(d.skull); this.scene.remove(d.sh); d.sh.geometry.dispose(); d.sh.material.dispose();
      this.drops.splice(i, 1);
    }
  }

  // Tira um projétil pelo objeto (seguro mesmo se a lista mudou durante o impacto).
  removeA(a) { const i = this.list.indexOf(a); if (i >= 0) this.remove(i); }

  // A flecha parou (parede, herói, escudo, fim do voo): chama onEnd uma vez só.
  ended(a) {
    if (!a.onEnd || a.endDone || this.clearing) return;
    a.endDone = true;
    const sp = Math.hypot(a.vx, a.vz) || 1;
    a.onEnd(a.x, a.z, Math.atan2(a.vx, a.vz), a.vx / sp, a.vz / sp);
  }

  // Virote caído no chão (Arqueiro vai buscar). Some na troca de sala ou quando o dono morre.
  dropBolt(x, z, angle, owner) {
    const g = makeProjectileMesh('arrow', 0, 1);
    g.position.set(x, 0.12, z);
    g.rotation.set(0.28, angle, 0, 'YXZ'); // ponta enfiada no chão
    this.scene.add(g);
    const it = { x, z, g, owner };
    (this.bolts ||= []).push(it);
    return it;
  }

  takeBolt(it) {
    if (!it || !this.bolts) return;
    const i = this.bolts.indexOf(it);
    if (i >= 0) { this.scene.remove(it.g); this.bolts.splice(i, 1); }
  }

  remove(i) {
    if (!this.list[i]) return;
    this.ended(this.list[i]);
    this.scene.remove(this.list[i].g);
    this.list.splice(i, 1);
  }

  clear() {
    this.clearing = true;
    for (let i = this.list.length - 1; i >= 0; i--) this.remove(i);
    this.clearing = false;
    for (const b of this.bolts || []) this.scene.remove(b.g);
    if (this.bolts) this.bolts.length = 0;
    for (const d of this.drops) { this.scene.remove(d.skull); this.scene.remove(d.sh); }
    this.drops.length = 0;
  }
}
