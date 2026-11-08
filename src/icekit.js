// Bênçãos novas do Cajado de Gelo (lista do dono, 07/11/2026): as regras. As coisas que ficam na sala estão em iceprops.js.
// Sem import de combat.js: o combate cria o IceKit (combat.ice2) e chama os ganchos; enemies.js, magic.js,
// projectiles.js e wbhooks.js chamam por combat.ice2 (sem import circular). player.js usa iceStartDodge e iceSpeedMul.
import * as THREE from 'three';
import { audio } from './audio.js';
import { IceProps } from './iceprops.js';

export const ICE = {
  curl: { speed: 15, time: 1.4, dmg: 8, daze: 1.2, push: 8 },        // Curling
  statue: { life: 10, freeze: 2.2, touch: 0.25 },                    // Estátua: clone de gelo (armadilha) de quem morre
  sticky: { t: 5, cd: 6, pad: 0.15 },                                 // Grudento: preso 5 s
  flake: { n: 6, dmg: 6, speed: 15, life: 0.6 },                      // Floco Gigante: 6 lascas
  fatal: 0.2,                                                         // Quebra Fatal: menos de 20% de vida
  rink: { r: 2.6, life: 5, grip: 1.4 },                               // Pista de Gelo (grip: quanto conseguem mudar de direção)
  wall: { time: 4, dist: 2.4, width: 4.2, blocks: 5 },                // Parede de Gelo
  spikes: { n: 7, r: 1.6, hitR: 2.3, dmg: 8, slow: 2, delay: 0.2 },   // Estalagmites
  hail: { time: 3, every: 0.22, r: 4.5, dmg: 3, hitR: 0.9, fall: 0.45 }, // Granizo
  igloo: { at: 0.3, time: 2, heal: 20 },                              // Iglu: com 30% de vida; 2 s; cura 20
  skin: 2.2,                                                          // Pele Gélida: congela quem bate (2,2 s)
  fog: { time: 4, cd: 3, r: 3.0, lost: 0.3 },                         // Neblina: só quem está dentro perde a Maga de vista
  crystal: { heal: 4, life: 12, pick: 1.1 },                          // Cristais
  skate: 1.4,                                                         // Patins: +40% de velocidade no gelo
  chill: { r: 2.4, dps: 4, every: 0.5 },                              // Contágio Gélido: dano por segundo perto de congelado
  wet: { time: 4, freeze: 2.2 },                                      // Encharcado
  aval: { n: 3, gap: 3, freeze: 2.2 },                                // Avalanche Lenta
  snowman: { time: 8, every: 0.9, range: 12, dmg: 4, speed: 13, slow: 1.5 }, // Boneco de Neve
  time: { n: 3, time: 3, cd: 6 },                                   // Tempo Congelado
};
const BOSS_FREEZE = 0.25; // chefes congelam 1/4 do tempo (igual ao Cajado de Gelo)
const BLUE = 0x8fe3ff;
const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const isIce = (p) => !!(p && p.heroId === 'mage' && p.hero && p.hero.weaponId === 'gelo');
const has = (p, k) => isIce(p) && !!W(p)[k];
let K = null;

// Neblina (rolar). Chamado pelo player.js no começo do rolamento.
export function iceStartDodge(p) { if (K) K.fog(p); }
// Patins: mais rápida andando no gelo.
export function iceSpeedMul(p) { return K && has(p, 'iSkate') && K.onIce(p.position.x, p.position.z) ? ICE.skate : 1; }

export class IceKit {
  constructor(c) {
    this.c = c; K = this;
    this.props = new IceProps(c);
    this.time = 0;
    this.stopT = 0; this.stopCd = 0; this.veilOn = false;
    this.curls = new Set();
  }
  log(o) { if (this.c.log) this.c.log(o); }
  owner(k) { return this.c.players.find((p) => p.state !== 'dead' && has(p, k)) || null; }
  who(e, k) { return has(e && e.lastHitBy, k) ? e.lastHitBy : this.owner(k); }
  foe(o) { return o && o.alive && !o.undead && !o.data.phantom; }
  onIce(x, z) {
    if (this.props.inRink(x, z)) return true;
    return this.c.ice.some((g) => Math.hypot(x - g.x, z - g.z) < g.r);
  }
  stopped(e) { return this.stopT > 0 && !e.undead; } // Tempo Congelado: o inimigo não se mexe

  // ---------- Congelou (enemies.js, só na 1ª vez) ----------
  onFreeze(e) {
    this.log({ type: 'iceFreeze', enemy: e });
    // Quebra Fatal: com menos de 20% de vida, quebra na hora.
    const pf = this.who(e, 'iFatal');
    if (pf && e.alive && !e.data.boss && !e.undead && e.hp < e.maxHp * ICE.fatal) {
      const p = pf;
      e.lastHitBy = p;
      if (e.takeDamage(e.hp, 0, 0, 0, false, true) || !e.alive) {
        this.c.text.add('Quebrou!', e.position, 'crit', 3.6);
        this.c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), 0xcff4ff, 20);
        audio.play('bigShatter', e.position.x, e.position.z, { v: 0.6 });
        this.log({ type: 'iceFatal', enemy: e });
        this.shatterFx(p, e);
        const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
        this.c.killed(e, dx / d, dz / d, p);
      }
      return;
    }
    this.checkTimeStop();
  }

  // ---------- Descongelou (enemies.js) ----------
  onThaw(e) {
    if (!e.alive) return;
    if (e.noWet) { e.noWet = false; return; } // o congelamento do Encharcado não deixa molhado de novo
    if (!this.who(e, 'iWet') || e.data.boss) return;
    e.wetT = ICE.wet.time;
    this.c.text.add('Molhado!', e.position, 'block', 2.6);
    this.log({ type: 'iceWetOn', enemy: e });
  }

  // ---------- Cada magia do Cajado de Gelo que acerta (magic.js, antes de congelar) ----------
  onSpellHit(p, e, step) {
    if (!isIce(p) || !e.alive || e.frozenT > 0 || !e.freeze) return;
    const c = step.cast, w = W(p), boss = e.data.boss ? BOSS_FREEZE : 1;
    if (c.freeze) return;
    // Encharcado: molhado congela de novo com um orbe só.
    if (w.iWet && e.wetT > 0) {
      e.wetT = 0; e.noWet = true; e.avalN = 0;
      e.freeze(ICE.wet.freeze * boss, this.c);
      this.log({ type: 'iceWetFreeze', enemy: e });
      return;
    }
    // Avalanche Lenta: 3 lentidões seguidas (menos de 3 s entre elas) congelam sozinhas.
    if (w.iAval && c.slow) {
      if (this.time - (e.avalAt ?? -99) > ICE.aval.gap) e.avalN = 0;
      e.avalAt = this.time;
      e.avalN = (e.avalN || 0) + 1;
      if (e.avalN >= ICE.aval.n) {
        e.avalN = 0;
        e.freeze(ICE.aval.freeze * boss, this.c);
        this.c.text.add('Avalanche!', e.position, 'crit', 3.2);
        this.log({ type: 'iceAval', enemy: e });
      } else this.c.text.add(`Frio ×${e.avalN}`, e.position, 'block', 2.2);
    }
  }

  // ---------- O 3º golpe congelou alguém (magic.js) ----------
  onHeavyFreeze(p, e) {
    if (!has(p, 'iRink')) return;
    if (this.rinkCast === this.c.spellCount) return; // uma pista por golpe
    this.rinkCast = this.c.spellCount;
    this.props.rink(e.position.x, e.position.z, ICE.rink);
  }

  // ---------- Golpe forte saindo (magic.js) ----------
  onCast(p, step) {
    if (!step.heavy || !isIce(p)) return;
    const w = W(p);
    if (w.iWall) this.props.wall(p, ICE.wall);
    if (w.iHail) this.props.startHail(p, ICE.hail);
  }

  // ---------- Estilhaçou um congelado (wbhooks.js) ----------
  onShatter(p, e) { this.shatterFx(p, e); }
  shatterFx(p, e) {
    if (!isIce(p)) return;
    const w = W(p), x = e.position.x, z = e.position.z;
    if (w.iFlake) { // Floco Gigante: 6 lascas para todos os lados
      const a0 = Math.random() * Math.PI;
      for (let i = 0; i < ICE.flake.n; i++) {
        const a = a0 + (i / ICE.flake.n) * Math.PI * 2;
        const pr = this.c.projectiles.fire(x + Math.sin(a) * 0.4, z + Math.cos(a) * 0.4, a, {
          speed: ICE.flake.speed, damage: Math.max(1, Math.round(ICE.flake.dmg * p.stats.damageMul)), kind: 'shard', color: 0x4a9bff,
          hits: 'hero', pierce: true, height: 1.1, life: ICE.flake.life, scale: 0.9, owner: p, silent: true,
        });
        pr.hitSet.add(e);
      }
      this.c.text.add('Floco!', e.position, 'block', 3.0);
      audio.play('iceWave', x, z, { v: 0.6 });
      this.log({ type: 'iceFlake' });
    }
    if (w.iSpikes) this.props.spikeRing(x, z, ICE.spikes, p, e); // Estalagmites
    if (w.iCrystal) this.props.crystal(x + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6, ICE.crystal); // Cristais
  }

  // ---------- Acertou um congelado (combat.damageEnemy) ----------
  onHitFrozen(p, e, nx, nz, died) {
    if (died || !e.alive || !has(p, 'iCurl') || e.data.boss) return;
    this.launch(e, nx, nz, ICE.curl.speed, p);
  }
  launch(e, nx, nz, speed, p) {
    const d = Math.hypot(nx, nz) || 1;
    e.curl = { vx: nx / d, vz: nz / d, sp: speed, t: 0, p, hit: new Set([e]) };
    e.vel.set(0, 0, 0);
    this.curls.add(e);
    this.c.text.add('Curling!', e.position, 'block', 2.8);
    this.log({ type: 'iceCurl', enemy: e });
  }
  tickCurl(e, dt) {
    const k = e.curl, c = this.c;
    k.t += dt;
    if (!e.alive || !(e.frozenT > 0) || k.t > ICE.curl.time || k.sp < 2) { e.curl = null; this.curls.delete(e); return; }
    let left = k.sp * dt;
    while (left > 0) {
      const st = Math.min(0.2, left); left -= st;
      e.position.x += k.vx * st; e.position.z += k.vz * st;
      if (c.world.blocked(e.position.x, e.position.z, e.data.radius)) { // bateu na parede: para
        c.world.resolveCircle(e.position, e.data.radius);
        c.vfx.sparks(v3(e.position.x, 0.8, e.position.z), 0xcff4ff, 8);
        audio.play('block', e.position.x, e.position.z, { v: 0.5 });
        e.curl = null; this.curls.delete(e);
        this.log({ type: 'iceCurlWall', enemy: e });
        return;
      }
      for (const o of [...c.enemies]) {
        if (k.hit.has(o) || !o.targetable) continue;
        const dx = o.position.x - e.position.x, dz = o.position.z - e.position.z, dd = Math.hypot(dx, dz) || 0.01;
        if (dd > o.data.radius + e.data.radius + 0.1) continue;
        k.hit.add(o);
        const side = dx * k.vz - dz * k.vx >= 0 ? 1 : -1; // empurra para o lado (como pino de boliche)
        const px = k.vx * 0.6 + k.vz * side * 0.8, pz = k.vz * 0.6 - k.vx * side * 0.8;
        c.bonusDamage(o, Math.max(1, Math.round(ICE.curl.dmg * k.p.stats.damageMul)), px, pz, 'block', k.p);
        c.vfx.sparks(v3(o.position.x, 1.0, o.position.z), 0xcff4ff, 10);
        audio.play('hitHeavy', o.position.x, o.position.z, { v: 0.6 });
        this.log({ type: 'iceCurlHit', enemy: o });
        if (!o.alive) continue;
        if (o.frozenT > 0 && !o.data.boss) { this.launch(o, px, pz, k.sp * 0.8, k.p); continue; } // outro congelado: vira pedra também
        if (o.daze && o.daze(ICE.curl.daze)) c.text.add('Derrubado!', o.position, 'hurt', 3.0);
        if (o.vel) o.vel.set(px, 0, pz).multiplyScalar(ICE.curl.push * Math.max(0.4, o.data.knockback ?? 1));
        k.sp *= 0.85;
      }
    }
    k.sp *= Math.exp(-1.0 * dt);
  }

  // ---------- Morreu (combat.killed): Estátua / Boneco de Neve ----------
  onKilled(e, by) {
    if (e.data.boss || e.data.phantom || e.undead || e.data.final || e.data.finale) return;
    const p = has(by, 'iStatue') || has(by, 'iSnowman') ? by : this.owner('iStatue') || this.owner('iSnowman');
    if (!p) return;
    const w = W(p);
    if (w.iStatue) { // Estátua: qualquer morte deixa um clone de gelo no lugar (o inimigo morre normal)
      this.props.statue(e, ICE.statue);
    } else if (w.iSnowman && e.diedFrozen) {
      this.props.snowman(e, p, ICE.snowman);
      e.group.visible = false;
      e.shattered = true;
    }
  }

  // ---------- Flecha/magia inimiga voando (projectiles.js). true = já resolveu ----------
  shotHit(a) {
    const p = this.owner('iMirror');
    if (!p) return false;
    const c = this.c;
    const e = c.enemies.find((o) => o !== a.owner && o.alive && o.frozenT > 0 && Math.hypot(o.position.x - a.x, o.position.z - a.z) < o.data.radius + a.r + 0.1);
    if (!e) return false;
    // Espelho de Gelo: volta para quem atirou (mais rápida), acertando inimigos.
    a.hits = 'reflected'; a.by = p; a.bounces = 0; a.homing = 0;
    a.hitSet = new Set([e]);
    const o = a.owner;
    a.target = o && o.targetable && c.enemies.includes(o) ? o : null;
    const sp = Math.max(a.speed || Math.hypot(a.vx, a.vz), 14) * 1.2;
    const ang = a.target ? Math.atan2(a.target.position.x - a.x, a.target.position.z - a.z) : Math.atan2(-a.vx, -a.vz);
    a.vx = Math.sin(ang) * sp; a.vz = Math.cos(ang) * sp; a.g.rotation.y = ang;
    a.life = 3; a.age = 0;
    c.vfx.sparks(v3(a.x, 1.3, a.z), 0xcff4ff, 12);
    c.text.add('Refletiu!', e.position, 'block', 2.6);
    audio.play('block', a.x, a.z, { v: 0.6 });
    this.log({ type: 'iceMirror', enemy: e });
    return true;
  }

  // ---------- A Maga vai tomar dano (combat.hitPlayer): Iglu ----------
  beforeHurt(p, dmg) {
    if (!has(p, 'iIgloo') || p.iglooUsed || p.iglooT > 0) return dmg;
    if (p.hp - dmg > p.maxHp * ICE.igloo.at) return dmg;
    p.iglooUsed = true;
    dmg = Math.min(dmg, p.hp - 1); // não morre com o golpe que fecha o iglu
    p.iglooT = ICE.igloo.time; p.iglooTick = 0.5; p.iglooHeal = ICE.igloo.heal;
    p.frozen = true; p.iframes = Math.max(p.iframes, ICE.igloo.time + 0.1);
    p.iglooMesh = this.props.igloo(p);
    this.c.text.add('Iglu!', p.position, 'block', 3.6);
    audio.play('iceWave', p.position.x, p.position.z);
    this.log({ type: 'iceIgloo' });
    return dmg;
  }
  // ---------- A Maga tomou dano: Pele Gélida ----------
  onHurt(p, src) {
    if (p.iglooT > 0) p.iframes = Math.max(p.iframes, p.iglooT + 0.05); // o golpe que fechou o iglu não encurta a imunidade
    if (!has(p, 'iSkin') || !src || !this.c.enemies.includes(src) || !this.foe(src)) return;
    src.freeze(ICE.skin * (src.data.boss ? BOSS_FREEZE : 1), this.c); // Pele Gélida: quem bate na Maga congela
    this.c.vfx.sparks(v3(src.position.x, 1.2, src.position.z), 0xcff4ff, 8);
    this.log({ type: 'iceSkin', enemy: src });
  }

  // ---------- Rolou: Neblina ----------
  fog(p) {
    if (!has(p, 'iFog') || (p.fogCd || 0) > 0) return;
    p.fogCd = ICE.fog.cd;
    this.props.fog(p.position.x, p.position.z, ICE.fog); // quem está dentro perde a Maga de vista (tick)
    this.c.text.add('Neblina!', p.position, 'block', 3.0);
    audio.play('iceWave', p.position.x, p.position.z, { v: 0.5 });
    this.log({ type: 'iceFog' });
  }

  // ---------- Tempo Congelado ----------
  checkTimeStop() {
    if (this.stopT > 0 || this.stopCd > 0) return;
    const p = this.owner('iTime');
    if (!p) return;
    const frozen = this.c.enemies.filter((o) => this.foe(o) && o.frozenT > 0);
    if (frozen.length < ICE.time.n) return;
    this.stopT = ICE.time.time;
    for (const o of frozen) o.frozenT += ICE.time.time; // ninguém descongela durante a parada
    this.setVeil(true);
    this.c.text.add('Tempo Congelado!', p.position, 'crit', 4.0);
    audio.play('iceWave', p.position.x, p.position.z);
    this.log({ type: 'iceTimeStop', n: frozen.length });
  }
  setVeil(on) {
    this.veilOn = on;
    let el = document.getElementById('iceVeil');
    if (!el) {
      el = document.createElement('div');
      el.id = 'iceVeil';
      el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0;transition:opacity .25s;'
        + 'background:radial-gradient(ellipse at 50% 50%, rgba(170,225,255,0.10) 30%, rgba(90,170,230,0.45) 80%);';
      document.body.appendChild(el);
    }
    el.style.opacity = on ? '1' : '0';
  }

  // ---------- A cada quadro, antes dos inimigos andarem ----------
  tick(dt) {
    const c = this.c;
    this.time += dt;
    if (this.stopCd > 0) this.stopCd -= dt;
    if (this.stopT > 0) { this.stopT -= dt; if (this.stopT <= 0) { this.stopT = 0; this.stopCd = ICE.time.cd; this.setVeil(false); } }
    for (const p of c.players) this.tickPlayer(p, dt);
    for (const e of [...this.curls]) this.tickCurl(e, dt);
    const chillP = this.owner('iChill'), stickyP = this.owner('iSticky');
    // Neblina: só os inimigos dentro da nuvem perdem a Maga de vista (enquanto estão nela e um pouquinho depois).
    for (const f of this.props.fogs) {
      for (const e of c.enemies) {
        if (!this.foe(e) || e.data.boss || Math.hypot(e.position.x - f.x, e.position.z - f.z) > f.r + e.data.radius * 0.5) continue;
        if (!(e.fogT > 0)) { if (!e.passive) { e.passive = true; e.fogPassive = true; } this.log({ type: 'iceFogIn', enemy: e }); }
        e.fogT = Math.max(e.fogT || 0, ICE.fog.lost);
      }
    }
    for (const e of c.enemies) e.chillHit = false; // Contágio: cada inimigo conta 1 vez por quadro
    for (const e of c.enemies) {
      if (e.wetT > 0) e.wetT -= dt;
      if (e.rootT > 0) e.rootT -= dt;
      if (e.stickCd > 0) e.stickCd -= dt;
      if (e.fogT > 0) { e.fogT -= dt; if (e.fogT <= 0 && e.fogPassive) { e.passive = false; e.fogPassive = false; } }
      // Pista de Gelo: guarda onde estava (afterMove faz escorregar).
      e.rinkPrev = this.foe(e) && !e.data.boss && !(e.frozenT > 0) && this.props.rinks.length && this.props.inRink(e.position.x, e.position.z, e.data.radius * 0.5) ? { x: e.position.x, z: e.position.z } : null;
      if (!e.rinkPrev && e.skid) e.skid = null;
      if (!this.foe(e) || !(e.frozenT > 0)) continue;
      // Gelo saindo do congelado: Contágio Gélido (lentidão em volta) e Grudento (pés grudados).
      if (!chillP && !stickyP) continue;
      if (chillP && Math.random() < dt * 4) c.vfx.sparks(v3(e.position.x + (Math.random() - 0.5), 0.4, e.position.z + (Math.random() - 0.5)), 0xdff6ff, 1);
      for (const o of c.enemies) {
        if (o === e || !this.foe(o) || o.frozenT > 0) continue;
        const d = Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z);
        if (chillP && d < ICE.chill.r + o.data.radius && !o.chillHit) { // Contágio Gélido: o frio dá dano por segundo
          o.chillHit = true;
          o.chillT = (o.chillT ?? ICE.chill.every) - dt;
          if (o.chillT <= 0) {
            o.chillT = ICE.chill.every;
            const nx = d ? (o.position.x - e.position.x) / d : 0, nz = d ? (o.position.z - e.position.z) / d : 0;
            c.bonusDamage(o, Math.max(1, Math.round(ICE.chill.dps * ICE.chill.every * chillP.stats.damageMul)), nx, nz, 'dmg', chillP, true);
            this.log({ type: 'iceChill', enemy: o });
          }
        }
        if (stickyP && !o.data.boss && !(o.stickCd > 0) && d < o.data.radius + e.data.radius + ICE.sticky.pad) {
          o.rootT = ICE.sticky.t; o.stickCd = ICE.sticky.cd; o.rootPos = { x: o.position.x, z: o.position.z };
          c.vfx.ice(v3(o.position.x, 0, o.position.z), 0.8, ICE.sticky.t);
          c.text.add('Grudou!', o.position, 'block', 2.6);
          this.log({ type: 'iceSticky', enemy: o });
        }
      }
    }
    this.props.update(dt);
  }

  tickPlayer(p, dt) {
    if (p.fogCd > 0) p.fogCd -= dt;
    // Iglu: parada, imune, curando.
    if (p.iglooT > 0) {
      p.iglooT -= dt; p.iglooTick -= dt;
      p.iframes = Math.max(p.iframes, p.iglooT + 0.05);
      if (p.iglooMesh) p.iglooMesh.position.set(p.position.x, 0, p.position.z);
      if (p.iglooTick <= 0 && p.iglooHeal > 0 && p.state !== 'dead') {
        p.iglooTick = 0.5;
        const n = Math.min(p.iglooHeal, ICE.igloo.heal / 4); p.iglooHeal -= n;
        const got = p.heal(n); if (got) this.c.text.add(`+${got}`, p.position, 'heal small');
      }
      if (p.iglooT <= 0 || p.state === 'dead') this.endIgloo(p);
    }
    // Patins: no gelo, continua deslizando quando para de andar.
    if (has(p, 'iSkate') && p.state !== 'dead') {
      const on = this.onIce(p.position.x, p.position.z);
      const prev = p.skPrev;
      p.skPrev = { x: p.position.x, z: p.position.z };
      if (!on || !prev || dt <= 0) { p.glide = null; return; }
      if (p.state === 'run') { p.glide = { x: (p.position.x - prev.x) / dt, z: (p.position.z - prev.z) / dt }; return; }
      if (p.state === 'idle' && p.glide) {
        const sp = Math.hypot(p.glide.x, p.glide.z);
        if (sp < 0.6) { p.glide = null; return; }
        p.vel.set(p.glide.x, 0, p.glide.z);
        const k = Math.exp(-1.6 * dt); p.glide.x *= k; p.glide.z *= k;
        if (!p.skateLogged) { p.skateLogged = true; this.log({ type: 'iceSkate' }); }
      } else p.glide = null;
    }
  }
  endIgloo(p) {
    p.iglooT = 0;
    if (p.iglooHeal > 0 && p.state !== 'dead') { const got = p.heal(p.iglooHeal); if (got) this.c.text.add(`+${got}`, p.position, 'heal small'); }
    p.iglooHeal = 0;
    if (p.frozen && p.state !== 'cine') p.frozen = false;
    if (p.iglooMesh) { this.c.scene.remove(p.iglooMesh); p.iglooMesh = null; }
    this.c.vfx.sparks(v3(p.position.x, 1.2, p.position.z), 0xcff4ff, 18);
    audio.play('thaw', p.position.x, p.position.z);
  }

  // ---------- Depois de todos andarem ----------
  afterMove(dt) {
    const c = this.c;
    for (const e of c.enemies) {
      if (!e.alive) continue;
      // Grudento: pés presos no gelo.
      if (e.rootT > 0 && e.rootPos && !(e.frozenT > 0)) { e.position.x = e.rootPos.x; e.position.z = e.rootPos.z; }
      // Pista de Gelo: o passo vira deslize (demora para mudar de direção e continua escorregando).
      const pr = e.rinkPrev;
      if (!pr || dt <= 0) continue;
      const vx = (e.position.x - pr.x) / dt, vz = (e.position.z - pr.z) / dt;
      if (!e.skid) { e.skid = { x: vx, z: vz }; this.log({ type: 'iceSlip', enemy: e }); }
      const k = 1 - Math.exp(-ICE.rink.grip * dt);
      if (Math.hypot(vx, vz) > Math.hypot(e.skid.x, e.skid.z) + 2.5) { e.skid.x = vx; e.skid.z = vz; } // empurrão: sai deslizando na hora
      else { e.skid.x += (vx - e.skid.x) * k; e.skid.z += (vz - e.skid.z) * k; } // andando: demora para virar e para frear
      if (Math.hypot(vx, vz) < 0.3) { e.skid.x *= Math.exp(-0.4 * dt); e.skid.z *= Math.exp(-0.4 * dt); } // parado: continua escorregando
      const sp = Math.hypot(e.skid.x, e.skid.z), max = 9;
      if (sp > max) { e.skid.x *= max / sp; e.skid.z *= max / sp; }
      e.position.x = pr.x + e.skid.x * dt; e.position.z = pr.z + e.skid.z * dt;
      c.world.resolveCircle(e.position, e.data.radius);
    }
  }

  clear() {
    this.props.clear();
    this.curls.clear();
    this.stopT = 0; this.stopCd = 0;
    if (this.veilOn) this.setVeil(false);
    for (const p of this.c.players) {
      if (p.iglooT > 0 || p.iglooMesh) this.endIgloo(p);
      p.iglooUsed = false; p.glide = null; p.skPrev = null; p.fogCd = 0;
    }
  }
}
