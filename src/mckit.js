// Bênçãos COMUNS dos 5 cajados da Maga (lista do dono, 11/11/2026): os efeitos.
// Dados e textos em mcbless.js (números em MC). combat.mc = MCKit. Ganchos: wbhooks (dano, acerto, abate, estilhaço),
// magic.js (conjuração, orbes, raios, explosão), projectiles.js (orbes cortando flechas, orbe que erra),
// combat.js (dano recebido, alvo dos mortos-vivos, escudo x fogo, fogo nos lacaios), undead.js, enemies.js, ranged.js, player.js.
import * as THREE from 'three';
import { audio } from './audio.js';
import { MC, lv } from './mcbless.js';
import { fear } from './axekit3.js';
import { repairShield } from './shield.js';
import { markDark } from './undead.js';
import { addBleed } from './wbhooks.js';
import { getGlowTexture } from './dungeon/builder.js';

const W = (p) => (p && p.stats && p.stats.w) || {};
const staff = (p) => (p && p.heroId === 'mage' && p.hero ? p.hero.weaponId : null);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const dm = (p) => (p && p.stats ? p.stats.damageMul || 1 : 1);
const shooterType = (e) => e.type === 'archer' || e.type === 'mage';
const metalType = (e) => e.type === 'warrior' || !!(e.data && e.data.shield);
const dist = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
const anyMc = (w) => { for (const k in w) if (k.startsWith('mc')) return true; return false; };
// Estado de cada heroína.
export const mcS = (p) => p.mcs || (p.mcs = { still: 0, lastCast: -99, orbHits: 0, shellCd: 0, fireT: 0, healT: 0, crossed: null });

let C = null; // o kit da partida (para as funções do herói)

export class MCKit {
  constructor(c) {
    this.c = c; C = this;
    this.t = 0;
    this.chillMul = 1;    // Calafrio: cooldown dos lentos anda mais devagar
    this.sparks = [];     // Faísca Residual: faíscas no chão
    this.zones = [];      // Orbe do Brago: zonas de gravidade
    this.echoes = [];     // Eco Arcano: explosões repetidas
    this.puddles = [];    // Poça de Gelo
    this.cubes = [];      // Picolé
    this.flames = [];     // Pavio Longo (chamas no chão)
    this.moon = false;    // Lua Negra: falta levantar o lacaio desta sala
    this.labareda = false; // Labareda: o 1º golpe da sala ainda não saiu
  }
  log(o) { if (this.c.log) this.c.log(o); }
  get players() { return this.c.players; }
  text(s, pos, cls = 'crit', size = 3.0) { this.c.text.add(s, pos, cls, size); }
  owner(key, weapon) { return this.players.find((p) => W(p)[key] && (!weapon || staff(p) === weapon) && p.state !== 'dead') || null; }
  foes() { return this.c.enemies.filter((e) => e.targetable && !e.undead); }
  near(x, z, r, skip) { return this.foes().filter((e) => e !== skip && Math.hypot(e.position.x - x, e.position.z - z) <= r + e.data.radius); }
  ultBonus(p, e) {
    if (!p || p.ultTime > 0 || p.ultCasting || p.state === 'dead') return;
    p.ult = Math.min(p.ultNeed, (p.ult || 0) + 1);
    this.text('Ultimate ×2!', e.position, 'heal', 3.0);
    this.log({ type: 'mcUlt2' });
  }
  heal(p, n) { if (!(n > 0) || p.state === 'dead') return 0; const got = p.heal(Math.round(n)); if (got) this.c.text.add(`+${got}`, p.position, 'heal small'); return got; }
  hurt(e, dmg, from, by, cls = 'dmg', noStagger = false) {
    if (!e.targetable) return;
    const dx = e.position.x - from.x, dz = e.position.z - from.z, d = Math.hypot(dx, dz) || 1;
    this.c.bonusDamage(e, Math.max(1, Math.round(dmg)), dx / d, dz / d, cls, by, noStagger);
  }
  addMesh(o) { this.c.scene.add(o); return o; }
  dropMesh(o) { if (o) { if (o.parent) o.parent.remove(o); o.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }); } }
  glow(color, size, opacity = 1) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
    s.scale.setScalar(size); return s;
  }
  disc(color, r, opacity, additive = false) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
    m.rotation.x = -Math.PI / 2; return m;
  }

  // ---------- Antes do dano: multiplicador e crítico ----------
  damage(p, e, step, ctx) {
    let mul = 1, crit = false;
    const w = W(p);
    if (!p || !p.hero || !anyMc(w)) return { mul, crit };
    const s = staff(p);
    const shot = this.c.mcShot;
    if (s === 'cajado') {
      if (w.mcMira && shot && shot.mcAim) crit = true; // Mira Firme
      if (w.mcCorta >= 2 && ctx.spell && e.type === 'archer') mul *= 1 + MC.corta.archer; // Corta-Flechas N2
    }
    if (s === 'eletrico' && w.mcMetal && metalType(e)) mul *= 1 + lv(MC.metal, w.mcMetal); // Metal Conduz
    if (s === 'fogo') {
      if (w.mcGulosa) { // Chama Gulosa: cada inimigo queimando na sala
        const n = Math.min(MC.gulosa.max, this.c.enemies.filter((o) => o.alive && !o.undead && o.burn > 0).length);
        mul *= 1 + lv(MC.gulosa.per, w.mcGulosa) * n;
      }
      // Ferro em Brasa N1: o fogo passa pelo escudo com metade do dano.
      if (w.mcFerro === 1 && ctx.spell && e.data.shield && !e.shieldBroken && e.shieldCovers(p.position.x, p.position.z)) mul *= 0.5;
    }
    return { mul, crit };
  }

  // Ferro em Brasa: o fogo da Maga não para no escudo do guerreiro.
  fireThrough(p, opts) { return !!(opts.spell && staff(p) === 'fogo' && W(p).mcFerro); }

  // ---------- Depois do dano (r: { dmg, died, crit, spell, nx, nz }) ----------
  onHit(p, e, step, r) {
    const w = W(p);
    if (!p.hero || !anyMc(w) || !r.spell) return;
    const s = staff(p), c = this.c;
    e.mcLastDmg = r.dmg;
    if (s === 'cajado') {
      if (w.mcEstouro && r.died && step.heavy && Math.random() < lv(MC.estouro, w.mcEstouro)) this.ultBonus(p, e); // Estouro de Mana
      if (w.mcCorta >= 3 && !r.died && e.type === 'archer' && e.daze && e.daze(MC.corta.daze)) this.text('Atordoado!', e.position, 'hurt', 3.2);
      return;
    }
    if (s === 'eletrico') {
      if (r.died) { if (w.mcFaiscas) this.killSparks(p, e); return; }
      if (w.mcCarga) { if (!(e.mcChargeT > 0)) c.vfx.sparks(v3(e.position.x, 1.4, e.position.z), 0xffe04a, 5); e.mcChargeT = MC.carga.t; e.mcChargeBy = p; }
      if (w.mcParal) this.paralyze(p, e);
      return;
    }
    if (s === 'trevas') {
      if (w.mcOlhar && step.heavy && !r.died && Math.random() < lv(MC.olhar, w.mcOlhar)) { addBleed(c, p, e, 1); this.log({ type: 'mcBleed', enemy: e }); }
      return;
    }
    if (s === 'gelo') {
      if (r.died) return;
      if (w.mcGeada && Math.random() < lv(MC.geada.chance, w.mcGeada)) { // Geada Rachada
        if (!(e.mcFrostT > 0)) this.text('Queimadura de frio!', e.position, 'block', 2.8);
        e.mcFrostT = MC.geada.t; e.mcFrostBy = p; e.mcFrostTick = e.mcFrostTick > 0 ? e.mcFrostTick : 1;
      }
      if ((e.mcWetT > 0 || e.mcPuddleT > 0) && !step.heavy && e.freeze && !(e.frozenT > 0)) { // Poça de Gelo / Vento Úmido: molhado congela com 1 orbe
        e.mcWetT = 0; e.mcPuddleT = 0;
        e.freeze(MC.poca.freeze * (e.data.boss ? 0.25 : 1), c);
        this.log({ type: 'mcWetFreeze', enemy: e });
      }
      return;
    }
    if (s === 'fogo') {
      if (w.mcIsq && e.mcSparkMark) { e.mcSparkMark = false; this.lighter(p, e); } // Isqueiro
      if (w.mcComb && step.heavy && e.burn > 0 && !e.mcCombT) this.combust(p, e, lv(MC.combustivel.dmg, w.mcComb)); // Combustível (já queimava antes da explosão)
    }
  }

  // ---------- Inimigo derrotado pelo herói ----------
  onKill(e, by) {
    const w = W(by);
    if (!by || !by.hero || !anyMc(w)) return;
    const s = staff(by), S = mcS(by);
    if (w.mcCasca && S.shellCd <= 0 && !by.mcShell) { by.mcShell = true; this.shellFx(by); this.text('Casca de Mana!', by.position, 'block', 2.8); this.log({ type: 'mcShell' }); } // Casca de Mana
    if (s === 'gelo' && e.diedFrozen) {
      if (w.mcRest && repairShield(by, 1)) { this.text('+1 barreira', by.position, 'block', 2.8); this.log({ type: 'mcRest' }); } // Gelo Restaurador
      if (w.mcPicole && !e.data.boss) this.addCube(by, e, lv(MC.picole.dmg, w.mcPicole)); // Picolé
    }
    if (s === 'fogo' && e.burn > 0) {
      if (w.mcPavio) this.addFlames(by, e.position.x, e.position.z, w.mcPavio); // Pavio Longo
      if (w.mcCalor && Math.random() < lv(MC.calor, w.mcCalor)) this.ultBonus(by, e); // Calor do Combate
    }
  }

  // ---------- Conjuração (magic.js) ----------
  // Contagem: o próximo orbe pequeno sai como o orbe grande do combo.
  castStep(p, step) {
    const w = W(p);
    if (staff(p) !== 'cajado' || !w.mcConta || step.heavy || !step.cast || step.cast.type !== 'bolt') return step;
    const S = mcS(p);
    if (!S.bigNext) return step;
    const big = p.hero.combo.find((x) => x.heavy && x.cast);
    if (!big) return step;
    S.bigNext = false;
    this.text('Contagem!', p.position, 'crit', 3.0);
    this.log({ type: 'mcCount' });
    return big;
  }
  // Começo da magia. true = virou outra coisa (Labareda).
  beforeCast(p, step) {
    const w = W(p);
    if (!p.hero || !anyMc(w)) return false;
    const S = mcS(p), s = staff(p);
    S.battN = s === 'eletrico' && w.mcBateria && this.t - S.lastCast >= MC.bateria.idle ? lv(MC.bateria.jumps, w.mcBateria) : 0; // Bateria Cheia
    if (S.battN) { this.text('Bateria cheia!', p.position, 'crit', 2.8); this.log({ type: 'mcBattery', n: S.battN }); }
    S.lastCast = this.t;
    S.aimArm = s === 'cajado' && w.mcMira && S.still >= MC.mira.still; // Mira Firme
    if (s === 'fogo' && w.mcLabareda && this.labareda && this.foes().length) { this.labareda = false; this.blaze(p); return true; }
    return false;
  }
  // Cada orbe disparado (Cajado Arcano / Gelo): Orbe Teleguiado, Mira Firme.
  decorate(p, step, a, i) {
    if (!a) return;
    const w = W(p), S = mcS(p);
    a.mcP = p;
    if (staff(p) !== 'cajado') return;
    if (w.mcGuia && p.hero.combo.indexOf(step) === 0) a.life *= 2; // Orbe Teleguiado
    if (S.aimArm) { // Mira Firme: crítico e maior
      const k = 1 + lv(MC.mira.size, w.mcMira);
      a.mcAim = true; a.scale *= k; a.r *= k; a.g.scale.setScalar(a.scale);
      if (i === 0) { this.text('Mira firme!', p.position, 'crit', 2.8); this.log({ type: 'mcAim' }); }
    }
  }
  afterCast(p) { const S = mcS(p); S.aimArm = false; S.still = 0; }
  // Raio Errante / Bateria Cheia: pulos a mais do raio.
  extraJumps(p) {
    const w = W(p);
    if (staff(p) !== 'eletrico') return 0;
    let n = mcS(p).battN || 0;
    if (w.mcErrante && Math.random() < lv(MC.errante, w.mcErrante)) { n++; this.log({ type: 'mcErrante' }); }
    return n;
  }
  // Ricochete Cego: o raio terminou no último alvo sem achar outro (nem no pulo em volta).
  blindRico(p, e, chainHits) {
    const w = W(p);
    if (staff(p) !== 'eletrico' || !w.mcRico || !e || !e.targetable || chainHits > 0) return;
    const dmg = Math.max(1, Math.round((e.mcLastDmg || 3) * lv(MC.rico, w.mcRico)));
    const top = v3(e.position.x, 2.6, e.position.z);
    this.c.vfx.lightning(top, v3(e.position.x, 1.2, e.position.z), 0xffe04a, 0.18);
    this.hurt(e, dmg, { x: p.position.x, z: p.position.z }, p);
    this.text('Ricochete!', e.position, 'crit', 2.6);
    this.log({ type: 'mcRico', enemy: e, dmg });
  }
  // Choque da sala (3º golpe do Cajado Elétrico): Pane.
  onRoomZap(p, e) {
    const w = W(p);
    if (staff(p) !== 'eletrico' || !e.alive) return;
    if (w.mcPane && Math.random() < lv(MC.pane, w.mcPane)) this.thunder(p, e);
    if (w.mcParal) this.paralyze(p, e);
  }
  // Orbe acertou alguém ou explodiu (magic.boltImpact).
  onBolt(a, target, chainHits) {
    const p = a.owner, w = W(p), step = a.step;
    if (!p || !p.hero || !anyMc(w) || !step || !step.cast) return;
    if (staff(p) !== 'cajado' || step.cast.instant) return;
    const S = mcS(p);
    if (target && w.mcConta && !S.bigNext && ++S.orbHits >= lv(MC.contagem, w.mcConta)) { S.orbHits = 0; S.bigNext = true; } // Contagem
    if (step.cast.blast) {
      const r = step.cast.blast * (p.stats.heavyRadiusMul || 1);
      if (w.mcBrago) this.addZone(p, a.x, a.z, r, w.mcBrago);
      if (w.mcEco) this.echoes.push({ x: a.x, z: a.z, r, t: MC.eco.t, dmg: Math.max(1, Math.round(step.damage * dm(p) * lv(MC.eco.mul, w.mcEco))), p });
    } else if (target && w.mcSalto && !a.mcBounce && Math.random() < lv(MC.salto.chance, w.mcSalto)) this.bounce(p, a, target);
  }
  // Orbe pequeno que chegou ao fim do caminho (ou bateu na parede) sem acertar ninguém.
  orbMiss(a) {
    const p = a.owner, w = W(p);
    if (!p || staff(p) !== 'cajado' || !w.mcFaisca || a.hitSet.size || a.mcBounce) return;
    const sp = Math.hypot(a.vx, a.vz) || 1;
    const x = a.x - (a.vx / sp) * 0.4, z = a.z - (a.vz / sp) * 0.4;
    const g = new THREE.Group();
    const core = this.glow(0xd59bff, 0.9); core.position.y = 0.35;
    const halo = this.disc(0xb070ff, MC.faisca.r * 0.45, 0.35, true); halo.position.y = 0.16;
    g.add(core, halo); g.position.set(x, 0, z);
    this.sparks.push({ x, z, p, t: lv(MC.faisca.t, w.mcFaisca), arm: 0.15, g: this.addMesh(g), core });
    this.log({ type: 'mcSpark' });
  }

  // ---------- Projéteis (antes de andarem) ----------
  prepass() {
    const c = this.c, L = c.projectiles.list;
    if (!L.length) return;
    const foeShots = L.filter((o) => o.hits === 'player' && !(o.stuck >= 0));
    if (!foeShots.length) return;
    for (const a of L) {
      if (a.hits !== 'spell' || !a.mcP) continue;
      const w = W(a.mcP), s = staff(a.mcP);
      const corta = s === 'cajado' && w.mcCorta, gelo = s === 'gelo' && w.mcFlechas;
      if (!corta && !gelo) continue;
      for (const o of foeShots) {
        if (o.kind !== 'arrow' || !L.includes(o) || !L.includes(a)) continue;
        if (Math.hypot(o.x - a.x, o.z - a.z) > a.r + o.r + 0.35) continue;
        c.projectiles.removeA(o);
        c.vfx.sparks(v3(o.x, 1.25, o.z), gelo ? 0xbff0ff : 0xd59bff, 10);
        audio.play('block', o.x, o.z, { v: 0.5 });
        this.text(gelo ? 'Flecha congelada!' : 'Cortou!', v3(o.x, 0, o.z), 'block', 2.6);
        this.log({ type: gelo ? 'mcIceArrow' : 'mcCutArrow' });
        if (gelo) {
          if (w.mcFlechas >= 3 && o.owner && o.owner.alive && o.owner.freeze && !o.owner.undead) o.owner.freeze(MC.flechas.freeze * (o.owner.data.boss ? 0.25 : 1), c); // N3: congela quem atirou
          if (w.mcFlechas < 2) { c.projectiles.removeA(a); break; } // N1: o orbe se gasta
        }
      }
    }
  }

  // ---------- Herói tomou dano / vai tomar ----------
  // Casca de Mana: anula a próxima flecha ou magia.
  shell(p, opts) {
    if (!p.mcShell || !opts.shooter) return false;
    p.mcShell = false;
    mcS(p).shellCd = lv(MC.casca, W(p).mcCasca);
    this.dropMesh(p.mcShellFx); p.mcShellFx = null;
    p.iframes = Math.max(p.iframes || 0, 0.3);
    this.text('Anulado!', p.position, 'block');
    this.c.vfx.burst(p.position, 0xd59bff);
    this.log({ type: 'mcShellUse' });
    return true;
  }
  shellFx(p) {
    this.dropMesh(p.mcShellFx);
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 12), new THREE.MeshBasicMaterial({ color: 0xc89bff, transparent: true, opacity: 0.26, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.y = 1.1;
    p.group.add(m);
    p.mcShellFx = m;
  }
  // Escudo de Ossos: cada morto-vivo da Maga reduz o dano recebido (um em cima do outro).
  takenMul(p) {
    const w = W(p);
    if (!w.mcOssos || staff(p) !== 'trevas') return 1;
    const n = this.c.enemies.filter((u) => u.undead === p && u.alive).length;
    return n ? Math.pow(1 - lv(MC.ossos, w.mcOssos), n) : 1;
  }
  onHurt(p, src) {
    const w = W(p);
    if (staff(p) === 'gelo' && w.mcAdren && p.state !== 'dead') this.adrenaline(p, src); // Adrenalina
  }

  // ---------- Rolamento (player.js) ----------
  dodge(p, phase) {
    const w = W(p);
    if (!anyMc(w)) return;
    const S = mcS(p);
    if (phase === 'start') {
      S.crossed = new Set(); S.wetDone = false;
      if (staff(p) === 'eletrico' && w.mcDescarga) { // Descarga ao Rolar
        const R = MC.descarga.r;
        this.c.vfx.ring(v3(p.position.x, 0.2, p.position.z), 0xffe04a, R);
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; this.c.vfx.bolt(v3(p.position.x, 1, p.position.z), v3(p.position.x + Math.sin(a) * R, 0.6, p.position.z + Math.cos(a) * R), 0xffe04a); }
        audio.play('thunder', p.position.x, p.position.z, { v: 0.4 });
        for (const e of this.near(p.position.x, p.position.z, R)) this.thunder(p, e);
        this.log({ type: 'mcDischarge' });
      }
    } else S.crossed = null;
  }
  // Inimigos atravessados no rolamento (Vento Úmido, Isqueiro).
  rollCross(p) {
    const w = W(p), S = mcS(p);
    if (!S.crossed || p.state !== 'dodge') return;
    const s = staff(p);
    if (!(s === 'gelo' && w.mcVento) && !(s === 'fogo' && w.mcIsq)) return;
    for (const e of this.foes()) {
      if (S.crossed.has(e) || dist(e, p) > e.data.radius + p.hero.radius + 0.25) continue;
      S.crossed.add(e);
      if (s === 'gelo' && !S.wetDone) { S.wetDone = true; e.mcWetT = MC.vento.t; this.text('Molhado!', e.position, 'block', 2.8); this.c.vfx.sparks(v3(e.position.x, 1, e.position.z), 0x6ab8ff, 10); this.log({ type: 'mcWet', enemy: e }); }
      if (s === 'fogo') { e.mcSparkMark = true; this.text('Faísca!', e.position, 'crit', 2.6); this.c.vfx.sparks(v3(e.position.x, 1.4, e.position.z), 0xffb04a, 8); this.log({ type: 'mcSparkMark', enemy: e }); }
    }
  }

  // ---------- Inimigos ----------
  // Fumaça nos Olhos: arqueiro/mago queimando erra o tiro (desvio no ângulo).
  aimOffset(e) {
    if (!(e.burn > 0) || !shooterType(e) || e.undead) return 0;
    const p = e.burnBy, w = W(p);
    if (!w.mcFumaca || staff(p) !== 'fogo' || Math.random() >= lv(MC.fumaca, w.mcFumaca)) return 0;
    this.text('Errou!', e.position, 'miss', 2.6);
    this.log({ type: 'mcSmokeMiss', enemy: e });
    return (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.35);
  }
  // Ossos Secos: o fogo nos lacaios tira vida mais rápido (a sobra vai somando).
  burnMul(e, dmg) {
    const w = W(e.burnBy);
    if (e.type !== 'minion' || !w.mcSecos || staff(e.burnBy) !== 'fogo') return dmg;
    e.mcBurnFrac = (e.mcBurnFrac || 0) + dmg * lv(MC.ossosSecos, w.mcSecos);
    const extra = Math.floor(e.mcBurnFrac);
    e.mcBurnFrac -= extra;
    return dmg + extra;
  }
  // Descongelou (enemies.updateFrozen): Poça de Gelo.
  onThaw(e) {
    const p = this.owner('mcPoca', 'gelo');
    if (!p) return;
    const g = this.disc(0x3f8fff, MC.poca.r, 0.55); g.position.set(e.position.x, 0.15, e.position.z);
    const sh = this.disc(0xcff4ff, MC.poca.r * 0.55, 0.25, true); sh.position.set(e.position.x, 0.17, e.position.z);
    this.puddles.push({ x: e.position.x, z: e.position.z, t: lv(MC.poca.t, W(p).mcPoca), p, g: this.addMesh(g), sh: this.addMesh(sh) });
    this.log({ type: 'mcPuddle' });
  }
  onShatter(p, e) { // Lascas
    const w = W(p);
    if (staff(p) !== 'gelo' || !w.mcLascas) return;
    const list = this.foes().filter((o) => o !== e && dist(o, e) <= MC.lascas.range).sort((a, b) => dist(a, e) - dist(b, e)).slice(0, lv([1, 2, 3], w.mcLascas));
    for (const o of list) {
      this.c.vfx.beamLine(v3(e.position.x, 1.1, e.position.z), v3(o.position.x, 1.1, o.position.z), 0xcff4ff, 0.18);
      this.c.vfx.sparks(v3(o.position.x, 1.2, o.position.z), 0xcff4ff, 8);
      this.hurt(o, MC.lascas.dmg * dm(p), e.position, p, 'block');
    }
    if (list.length) this.log({ type: 'mcShards', n: list.length });
  }

  // ---------- Mortos-vivos (Cajado das Trevas) ----------
  undeadTarget(u) { // Comandante: o inimigo mais forte da sala
    const p = u.undead;
    if (!W(p).mcCmd) return null;
    let best = null;
    for (const o of this.c.enemies) {
      if (o === u || o.undead || !o.targetable) continue;
      if (!best || o.maxHp > best.maxHp || (o.maxHp === best.maxHp && o.hp > best.hp)) best = o;
    }
    if (best) u.idleT = 0;
    return best;
  }
  undeadCount(p) { return this.c.enemies.filter((u) => u.undead === p && u.alive).length; }
  undeadDmgMul(u) {
    const p = u.undead, w = W(p);
    let k = 1;
    if (w.mcCmd >= 2) k *= 1 + lv(MC.comandante, w.mcCmd);
    if (w.mcRecruta) k *= 1 + lv(MC.recrutador, w.mcRecruta) * this.undeadCount(p);
    return k;
  }
  undeadTakenMul(u) {
    const p = u.undead, w = W(p);
    return w.mcRecruta ? 1 / (1 + lv(MC.recrutador, w.mcRecruta) * this.undeadCount(p)) : 1;
  }
  afterUndeadHit(u, o) { // Vampiros
    const p = u.undead;
    if (!W(p).mcVamp || o.alive || !u.alive) return;
    const before = u.hp;
    u.hp = Math.min(u.maxHp, u.hp + MC.vampiro);
    if (u.hp > before) { this.c.text.add(`+${u.hp - before}`, u.position, 'heal small'); this.log({ type: 'mcVamp', got: u.hp - before }); }
  }
  onRise(u) { // Pacto Menor
    const p = u.undead, w = W(p);
    if (w.mcPacto && p.hero) { const got = this.heal(p, lv(MC.pacto, w.mcPacto)); this.log({ type: 'mcPact', got }); }
  }
  onUndeadDeath(u) { // Último Abraço
    const p = u.undead, w = W(p);
    if (!w.mcAbraco || !p.hero) return;
    const R = MC.abraco.r, at = v3(u.position.x, 0, u.position.z);
    this.c.vfx.smoke(u.position, 0x2a0a40, 12);
    this.c.vfx.ring(at, 0x9a4dff, R);
    this.c.vfx.heavyImpact(at, R / 2.6);
    audio.play('boom', at.x, at.z, { v: 0.5 });
    const dmg = lv(MC.abraco.dmg, w.mcAbraco) * dm(p);
    for (const o of this.near(at.x, at.z, R)) this.hurt(o, dmg, at, p);
    this.log({ type: 'mcHug' });
  }
  onMark(p, e) { // Medo das Trevas
    const w = W(p);
    if (!w.mcMedo || e.data.boss || !e.alive) return;
    if (Math.random() < lv(MC.medo.chance, w.mcMedo) && fear(e, p, MC.medo.t)) { this.text('Medo!', e.position, 'hurt', 3.0); this.log({ type: 'mcFear', enemy: e }); }
  }
  onMarkedDeath(e) { // Marca Passada
    const p = e.darkMark, w = W(p);
    if (!w.mcPassa || !p.hero) return;
    const list = this.foes().filter((o) => o !== e && !o.darkMark && !o.data.boss && dist(o, e) <= MC.passada.range).sort((a, b) => dist(a, e) - dist(b, e)).slice(0, lv(MC.passada.n, w.mcPassa));
    for (const o of list) { this.c.vfx.beamLine(v3(e.position.x, 1.6, e.position.z), v3(o.position.x, 1.6, o.position.z), 0x9a4dff, 0.2); markDark(this.c, p, o); }
    if (list.length) this.log({ type: 'mcMarkPass', n: list.length });
  }

  // ---------- Começo de cada sala ----------
  roomStart() {
    this.moon = this.players.some((p) => W(p).mcLua && staff(p) === 'trevas');
    this.labareda = true;
    for (const p of this.players) { const S = mcS(p); S.orbHits = 0; S.bigNext = false; }
  }

  // ---------- Partes de cada bênção ----------
  paralyze(p, e) { // Paralisia
    const w = W(p);
    e.mcShocks = (e.mcShocks || 0) + 1;
    if (e.mcShocks < lv(MC.paralisia.n, w.mcParal)) return;
    e.mcShocks = 0;
    if (e.daze && e.daze(e.data.boss ? MC.paralisia.boss : MC.paralisia.t)) {
      this.text('Paralisado!', e.position, 'hurt', 3.2);
      this.c.vfx.sparks(v3(e.position.x, 1.3, e.position.z), 0xffe04a, 14);
      this.log({ type: 'mcParalyze', enemy: e });
    }
  }
  thunder(p, e) { // marca do trovão (Descarga ao Rolar / Pane)
    if (!e.alive) return;
    e.mcThunder = (e.mcThunder || 0) + 1;
    this.c.vfx.sparks(v3(e.position.x, 2.1, e.position.z), 0xffe04a, 6);
    if (e.mcThunder < MC.trovao.n) { this.text(`Trovão ×${e.mcThunder}`, e.position, 'block', 2.4); return; }
    e.mcThunder = 0;
    if (e.daze && e.daze(e.data.boss ? MC.trovao.boss : MC.trovao.t)) {
      this.text('Atordoado!', e.position, 'hurt', 3.2);
      this.c.vfx.lightning(v3(e.position.x, 6, e.position.z), v3(e.position.x, 1.1, e.position.z), 0xffe04a, 0.3);
      this.log({ type: 'mcThunderStun', enemy: e });
    }
  }
  killSparks(p, e) { // Faíscas de Abate
    const n = lv(MC.faiscas.n, W(p).mcFaiscas);
    const list = this.foes().filter((o) => o !== e && dist(o, e) <= MC.faiscas.range).sort((a, b) => dist(a, e) - dist(b, e)).slice(0, n);
    for (const o of list) {
      this.c.vfx.bolt(v3(e.position.x, 1.3, e.position.z), v3(o.position.x, 1.3, o.position.z), 0xffe04a);
      this.hurt(o, MC.faiscas.dmg * dm(p), e.position, p);
    }
    this.c.vfx.sparks(v3(e.position.x, 1.3, e.position.z), 0xffe04a, 10);
    this.log({ type: 'mcKillSparks', n: list.length });
  }
  bounce(p, a, target) { // Orbe Saltitante
    const other = this.foes().filter((o) => o !== target && dist(o, target) <= MC.salto.range).sort((x, y) => dist(x, target) - dist(y, target))[0];
    if (!other) return;
    const ang = Math.atan2(other.position.x - target.position.x, other.position.z - target.position.z);
    const sx = target.position.x + Math.sin(ang) * (target.data.radius + 0.3), sz = target.position.z + Math.cos(ang) * (target.data.radius + 0.3);
    const cst = a.step.cast, d = dist(other, target);
    const pr = this.c.projectiles.fire(sx, sz, ang, {
      speed: cst.speed, damage: a.step.damage, kind: 'orb', color: cst.color, scale: cst.size,
      hits: 'spell', owner: p, step: a.step, life: (d + 1.5) / cst.speed, height: 1.25, silent: true,
    });
    pr.hitSet.add(target); pr.target = other; pr.mcBounce = true; pr.mcP = p;
    this.text('Ricocheteou!', target.position, 'crit', 2.6);
    this.log({ type: 'mcBounce' });
  }
  addZone(p, x, z, r, n) { // Orbe do Brago
    const g = new THREE.Group();
    const dark = this.disc(0x1a0630, r, 0.8); dark.position.y = 0.15;
    const rim = new THREE.Mesh(new THREE.RingGeometry(r * 0.86, r, 36), new THREE.MeshBasicMaterial({ color: 0x9a4dff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    rim.rotation.x = -Math.PI / 2; rim.position.y = 0.18;
    const core = this.glow(0x5a1a9a, r * 1.1, 0.8); core.position.y = 0.3;
    g.add(dark, rim, core);
    const motes = [];
    for (let i = 0; i < 12; i++) { const m = this.glow(i % 2 ? 0xb070ff : 0x6a2aff, 0.5, 0.9); g.add(m); motes.push({ m, a: Math.random() * 6.3, k: Math.random() }); }
    g.position.set(x, 0, z);
    this.zones.push({ x, z, r, t: lv(MC.brago.t, n), p, g: this.addMesh(g), rim, motes });
    this.log({ type: 'mcZone', r });
  }
  addCube(p, e, dmg) { // Picolé
    const s = Math.max(0.55, e.data.radius * 1.2);
    const m = new THREE.Mesh(new THREE.BoxGeometry(s * 1.6, s * 1.6, s * 1.6), new THREE.MeshStandardMaterial({ color: 0xcff4ff, emissive: 0x4fb8ff, emissiveIntensity: 0.4, transparent: true, opacity: 0.75, roughness: 0.15 }));
    m.position.set(e.position.x, s * 0.8, e.position.z);
    m.rotation.y = Math.random() * Math.PI;
    this.cubes.push({ x: e.position.x, z: e.position.z, r: s, t: MC.picole.life, vx: 0, vz: 0, fly: false, dmg: dmg * dm(p), p, m: this.addMesh(m) });
    this.text('Picolé!', e.position, 'block', 2.8);
    this.log({ type: 'mcCube' });
  }
  addFlames(p, x, z, n) { // Pavio Longo
    const f = this.c.fireFields || (this.c.fireFields = []);
    f.push({ x, z, r: MC.pavio.r, age: 0, life: lv(MC.pavio.t, n), tick: 0.25, dmg: Math.max(1, Math.round(3 * dm(p))), by: p });
    this.c.vfx.ring(v3(x, 0, z), 0xff5a1a, MC.pavio.r);
    this.log({ type: 'mcWick', t: lv(MC.pavio.t, n) });
  }
  setBurn(p, e, dps = 3) { if (!e.alive) return; e.burn = Math.max(e.burn || 0, 3); e.burnDps = Math.max(e.burnDps || 0, dps * dm(p)); e.burnTick = e.burnTick > 0 ? e.burnTick : 0.5; e.burnBy = p; }
  lighter(p, e) { // Isqueiro
    const R = MC.isqueiro.r, at = v3(e.position.x, 0, e.position.z);
    this.c.vfx.flameCone(v3(at.x, 0.8, at.z), 0, R * 0.8, Math.PI, 0xff7a2a, true);
    this.c.vfx.ring(at, 0xffb04a, R);
    audio.play('boom', at.x, at.z, { v: 0.5 });
    for (const o of this.near(at.x, at.z, R)) { this.hurt(o, MC.isqueiro.dmg * dm(p), at, p, 'burn'); this.setBurn(p, o); }
    this.log({ type: 'mcLighter' });
  }
  combust(p, e, dmg) { // Combustível
    const R = MC.combustivel.r, at = v3(e.position.x, 0, e.position.z);
    e.mcCombT = 0.3;
    this.c.vfx.flameCone(v3(at.x, 0.8, at.z), 0, R * 0.8, Math.PI, 0xff5a1a, true);
    this.c.vfx.ring(at, 0xff7a2a, R);
    for (const o of this.near(at.x, at.z, R)) this.hurt(o, dmg * dm(p), at, p, 'burn', true);
    this.log({ type: 'mcCombust', enemy: e });
  }
  blaze(p) { // Labareda: explosão de fogo na sala toda
    const at = v3(p.position.x, 0, p.position.z);
    const nova = p.hero.combo.find((s) => s.heavy) || p.hero.combo[0];
    this.c.vfx.flameCone(v3(at.x, 1.0, at.z), p.facing, 4, Math.PI, 0xffb04a, true);
    this.c.vfx.ring(at, 0xff7a2a, 14);
    this.c.vfx.heavyImpact(at, 3);
    audio.play('boom', at.x, at.z);
    let n = 0;
    for (const e of this.foes()) {
      this.c.vfx.flameCone(v3(e.position.x, 0.8, e.position.z), 0, 1.4, Math.PI, 0xff7a2a, true);
      this.hurt(e, (nova.damage || 6) * dm(p), at, p, 'burn');
      this.setBurn(p, e, 2); n++;
    }
    this.c.shakeFor(p, 0.35);
    this.text('Labareda!', p.position, 'crit', 3.6);
    this.log({ type: 'mcBlaze', n });
  }
  adrenaline(p, src) { // Adrenalina: cone de gelo na direção do golpe
    const A = MC.adrenalina;
    const ang = src && src.position ? Math.atan2(src.position.x - p.position.x, src.position.z - p.position.z) : p.facing;
    const half = A.arc * Math.PI / 360;
    this.c.vfx.flameCone(v3(p.position.x, 1.1, p.position.z), ang, A.range, half, 0x8fe3ff, true, 0xe8fbff);
    this.c.vfx.sector(p.position, ang, A.range, half, 0x8fe3ff);
    let n = 0;
    for (const e of this.foes()) {
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      let da = Math.atan2(dx, dz) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (d > A.range + e.data.radius || Math.abs(da) > half) continue;
      if (e.freeze) { e.freeze(e.data.boss ? A.boss : A.t, this.c); n++; }
    }
    this.text('Adrenalina!', p.position, 'block', 3.0);
    this.log({ type: 'mcAdren', n });
  }

  // ---------- A cada quadro ----------
  tick(dt) {
    this.t += dt;
    const c = this.c;
    // Calafrio: o maior nível entre as Magas de gelo.
    const cal = this.players.reduce((m, p) => (staff(p) === 'gelo' && W(p).mcCalafrio ? Math.max(m, lv(MC.calafrio, W(p).mcCalafrio)) : m), 0);
    this.chillMul = 1 / (1 + cal);
    for (const p of this.players) {
      if (!p.mcs && !anyMc(W(p))) continue;
      const S = mcS(p), w = W(p);
      if (S.shellCd > 0) S.shellCd -= dt;
      if (p.mcShellFx) p.mcShellFx.material.opacity = 0.22 + 0.08 * Math.sin(this.t * 6);
      S.still = p.state === 'idle' ? S.still + dt : 0;
      this.rollCross(p);
      if (staff(p) === 'fogo' && w.mcFogueira) this.campfire(p, S, dt);
      else if (S.fire) { this.dropMesh(S.fire); S.fire = null; }
      if (staff(p) === 'eletrico' && w.mcPara) this.rod(p, S, dt);
      if (this.moon && W(p).mcLua && staff(p) === 'trevas' && this.foes().length) this.raiseMoon(p);
    }
    this.tickEnemies(dt);
    this.tickSparks(dt);
    this.tickZones(dt);
    this.tickEchoes(dt);
    this.tickPuddles(dt);
    this.tickCubes(dt);
  }
  campfire(p, S, dt) { // Fogueira Pessoal
    const lit = S.still >= MC.fogueira.still && p.state !== 'dead';
    if (!lit) { if (S.fire) { this.dropMesh(S.fire); S.fire = null; } S.healT = 0; return; }
    if (!S.fire) {
      const g = new THREE.Group();
      const glow = this.glow(0xff7a2a, 1.8, 0.9); glow.position.y = 0.4;
      const base = this.disc(0xff5a1a, 0.8, 0.35, true); base.position.y = 0.16;
      g.add(glow, base);
      S.fire = this.addMesh(g);
      this.text('Fogueira!', p.position, 'heal', 2.6);
      this.log({ type: 'mcCampfire' });
    }
    S.fire.position.set(p.position.x, 0, p.position.z);
    if (Math.random() < dt * 8) this.c.vfx.flameCone(v3(p.position.x + (Math.random() - 0.5) * 0.6, 0.2, p.position.z + (Math.random() - 0.5) * 0.6), 0, 0.5, Math.PI, 0xff7a2a, false);
    S.healT += dt;
    if (S.healT >= 1) { S.healT -= 1; const got = this.heal(p, lv(MC.fogueira.heal, W(p).mcFogueira)); this.log({ type: 'mcCampHeal', got }); }
  }
  rod(p, S, dt) { // Para-raios de Bolso
    if (S.rodCd > 0) { S.rodCd -= dt; return; }
    const R = MC.pararaios.r;
    const o = this.c.projectiles.list.find((a) => a.hits === 'player' && !(a.stuck >= 0) && Math.hypot(a.x - p.position.x, a.z - p.position.z) <= R);
    if (!o) return;
    this.c.vfx.lightning(v3(p.position.x, 1.9, p.position.z), v3(o.x, 1.2, o.z), 0xffe04a, 0.2);
    this.c.vfx.sparks(v3(o.x, 1.2, o.z), 0xffe04a, 10);
    this.c.projectiles.removeA(o);
    audio.play('thunder', o.x, o.z, { v: 0.35 });
    this.text('Para-raios!', p.position, 'block', 2.6);
    S.rodCd = lv(MC.pararaios.cd, W(p).mcPara);
    this.log({ type: 'mcRod' });
  }
  raiseMoon(p) { // Lua Negra: 1 lacaio do lado da Maga
    this.moon = false;
    const a = p.facing + Math.PI * 0.75;
    let x = p.position.x + Math.sin(a) * 1.6, z = p.position.z + Math.cos(a) * 1.6;
    if (this.c.world.blocked(x, z, 0.5)) { x = p.position.x; z = p.position.z; }
    (this.c.raising || (this.c.raising = [])).push({ type: 'minion', x, z, t: 0.2, owner: p, hp: MC.lua.hp, hpScale: 1, dmgScale: 1, facing: p.facing });
    this.text('Lua Negra!', p.position, 'bleed', 3.0);
    this.log({ type: 'mcMoon' });
  }
  tickEnemies(dt) {
    const c = this.c, list = c.enemies;
    for (const e of list) {
      if (!e.alive || e.undead) continue;
      if (e.mcCombT > 0) e.mcCombT -= dt;
      if (e.mcWetT > 0) { e.mcWetT -= dt; if (Math.random() < dt * 6) c.vfx.sparks(v3(e.position.x, 1.6, e.position.z), 0x6ab8ff, 1); }
      if (e.mcPuddleT > 0) e.mcPuddleT -= dt;
      if (e.mcSparkMark && Math.random() < dt * 5) c.vfx.sparks(v3(e.position.x, 1.8, e.position.z), 0xffb04a, 1);
      // Geada Rachada: queimadura de frio.
      if (e.mcFrostT > 0) {
        e.mcFrostT -= dt; e.mcFrostTick -= dt;
        if (e.mcFrostTick <= 0) { e.mcFrostTick = 1; this.hurt(e, MC.geada.dps * dm(e.mcFrostBy), { x: e.position.x, z: e.position.z - 1 }, e.mcFrostBy, 'block', true); if (!e.alive) continue; }
      }
      // Carga Estática: dois carregados que se encostam.
      if (e.mcChargeT > 0) {
        e.mcChargeT -= dt;
        if (Math.random() < dt * 4) c.vfx.sparks(v3(e.position.x, 1.5, e.position.z), 0xffe04a, 1);
        for (const o of list) {
          if (o === e || !(o.mcChargeT > 0) || !o.alive || o.undead || !e.targetable || !o.targetable) continue;
          if (dist(o, e) > e.data.radius + o.data.radius + 0.35) continue;
          const p = e.mcChargeBy, dmg = lv(MC.carga.dmg, W(p).mcCarga) * dm(p);
          e.mcChargeT = 0; o.mcChargeT = 0;
          c.vfx.lightning(v3(e.position.x, 1.3, e.position.z), v3(o.position.x, 1.3, o.position.z), 0xffe04a, 0.25);
          audio.play('thunder', e.position.x, e.position.z, { v: 0.35 });
          this.hurt(e, dmg, o.position, p); this.hurt(o, dmg, e.position, p);
          this.log({ type: 'mcStatic' });
          break;
        }
      }
      // Frio Contagioso: o congelado congela quem encostar nele (quem pegou o frio assim não passa adiante).
      if (e.frozenT > 0 && !e.mcCold) {
        const p = this.owner('mcFrio', 'gelo');
        if (p) for (const o of list) {
          if (o === e || o.undead || !o.targetable || o.frozenT > 0 || !o.freeze) continue;
          if (dist(o, e) > e.data.radius + o.data.radius + 0.3) continue;
          o.freeze(lv(MC.frio, W(p).mcFrio) * (o.data.boss ? 0.25 : 1), c);
          o.mcCold = true;
          this.log({ type: 'mcContagion', enemy: o });
        }
      }
      if (e.mcCold && !(e.frozenT > 0)) e.mcCold = false;
      // Ferro em Brasa N3: guerreiro queimando 3 s perde o escudo.
      if (e.burn > 0 && e.data.shield && !e.shieldBroken && W(e.burnBy).mcFerro >= 3 && !e.data.boss) {
        e.mcMeltT = (e.mcMeltT || 0) + dt;
        if (e.mcMeltT >= MC.ferro.melt) { c.breakEnemyShield(e, 0, 1, e.burnBy); this.text('Derreteu!', e.position, 'crit', 3.0); this.log({ type: 'mcMelt', enemy: e }); }
      } else if (!(e.burn > 0)) e.mcMeltT = 0;
    }
  }
  tickSparks(dt) { // Faísca Residual
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.t -= dt; s.arm -= dt;
      s.core.scale.setScalar(0.8 + 0.25 * Math.sin(this.t * 12 + i));
      const hit = s.arm <= 0 && this.foes().find((e) => Math.hypot(e.position.x - s.x, e.position.z - s.z) <= e.data.radius + MC.faisca.trig);
      if (hit) {
        const at = v3(s.x, 0, s.z);
        this.c.vfx.ring(at, 0xd59bff, MC.faisca.r);
        this.c.vfx.sparks(v3(s.x, 0.8, s.z), 0xd59bff, 14);
        audio.play('boom', s.x, s.z, { v: 0.4 });
        for (const e of this.near(s.x, s.z, MC.faisca.r)) this.hurt(e, MC.faisca.dmg * dm(s.p), at, s.p);
        this.log({ type: 'mcSparkBoom' });
      }
      if (hit || s.t <= 0) { this.dropMesh(s.g); this.sparks.splice(i, 1); }
    }
  }
  tickZones(dt) { // Orbe do Brago
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t -= dt;
      z.rim.rotation.z += dt * 3;
      for (const m of z.motes) { // partículas descendo em espiral para o centro
        m.k = (m.k + dt * 1.3) % 1; m.a += dt * 4;
        const rr = z.r * (1 - m.k); m.m.position.set(Math.sin(m.a) * rr, 1.6 * (1 - m.k) + 0.1, Math.cos(m.a) * rr);
      }
      for (const e of this.foes()) {
        if (e.data.boss || !e.vel) continue;
        const dx = z.x - e.position.x, dz = z.z - e.position.z, d = Math.hypot(dx, dz);
        if (d > z.r + e.data.radius || d < 0.25) continue;
        e.vel.set(dx / d, 0, dz / d).multiplyScalar(Math.min(MC.brago.pull, d * 5));
        e.mcPulled = true;
      }
      if (z.t <= 0) { this.dropMesh(z.g); this.zones.splice(i, 1); }
    }
  }
  tickEchoes(dt) { // Eco Arcano
    for (let i = this.echoes.length - 1; i >= 0; i--) {
      const o = this.echoes[i];
      if ((o.t -= dt) > 0) continue;
      this.echoes.splice(i, 1);
      const at = v3(o.x, 0, o.z);
      this.c.vfx.heavyImpact(at, o.r / 2.3);
      this.c.vfx.ring(at, 0xd59bff, o.r);
      audio.play('boom', o.x, o.z, { v: 0.5 });
      let n = 0;
      for (const e of this.near(o.x, o.z, o.r)) { this.hurt(e, o.dmg, at, o.p); n++; }
      this.log({ type: 'mcEcho', n, dmg: o.dmg });
    }
  }
  tickPuddles(dt) { // Poça de Gelo
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const u = this.puddles[i];
      u.t -= dt;
      u.sh.material.opacity = 0.18 + 0.08 * Math.sin(this.t * 5 + i);
      for (const e of this.foes()) {
        if (Math.hypot(e.position.x - u.x, e.position.z - u.z) > MC.poca.r + e.data.radius * 0.5) continue;
        if (!(e.mcPuddleT > 0)) { this.text('Molhado!', e.position, 'block', 2.4); this.log({ type: 'mcWet', enemy: e }); }
        e.mcPuddleT = 0.25; // molhado enquanto está em cima
      }
      if (u.t <= 0) { this.dropMesh(u.g); this.dropMesh(u.sh); this.puddles.splice(i, 1); }
    }
  }
  tickCubes(dt) { // Picolé
    const c = this.c;
    for (let i = this.cubes.length - 1; i >= 0; i--) {
      const k = this.cubes[i];
      k.t -= dt;
      let gone = k.t <= 0;
      if (!k.fly) { // herói andando contra o cubo: chuta
        for (const p of this.players) {
          if (p.state === 'dead' || p.state === 'idle') continue;
          const dx = k.x - p.position.x, dz = k.z - p.position.z, d = Math.hypot(dx, dz);
          if (d > k.r + p.hero.radius + 0.15) continue;
          k.fly = true; k.t = 1.6; k.vx = (dx / (d || 1)) * MC.picole.speed; k.vz = (dz / (d || 1)) * MC.picole.speed;
          audio.play('hitHeavy', k.x, k.z, { v: 0.6 });
          this.text('Chute!', p.position, 'crit', 2.6);
          this.log({ type: 'mcKick' });
          break;
        }
      } else {
        let left = MC.picole.speed * dt;
        while (left > 0 && !gone) {
          const st = Math.min(0.3, left); left -= st;
          k.x += (k.vx / MC.picole.speed) * st; k.z += (k.vz / MC.picole.speed) * st;
          if (c.world.blocked(k.x, k.z, k.r * 0.6)) { gone = true; break; }
          const e = this.foes().find((o) => Math.hypot(o.position.x - k.x, o.position.z - k.z) <= o.data.radius + k.r);
          if (e) { this.hurt(e, k.dmg, { x: k.x - k.vx, z: k.z - k.vz }, k.p); this.text('Picolé!', e.position, 'crit', 3.0); this.log({ type: 'mcCubeHit', enemy: e, dmg: Math.round(k.dmg) }); gone = true; }
        }
        k.m.rotation.y += dt * 9;
      }
      k.m.position.set(k.x, k.r * 0.8, k.z);
      if (gone) { c.vfx.sparks(v3(k.x, 0.8, k.z), 0xcff4ff, 14); this.dropMesh(k.m); this.cubes.splice(i, 1); }
    }
  }

  clear() {
    for (const s of this.sparks) this.dropMesh(s.g);
    for (const z of this.zones) this.dropMesh(z.g);
    for (const u of this.puddles) { this.dropMesh(u.g); this.dropMesh(u.sh); }
    for (const k of this.cubes) this.dropMesh(k.m);
    this.sparks = []; this.zones = []; this.echoes = []; this.puddles = []; this.cubes = [];
    for (const p of this.players) {
      const S = p.mcs;
      if (S && S.fire) { this.dropMesh(S.fire); S.fire = null; }
    }
  }
}

// Rolamento da Maga (player.js).
export function mcDodge(p, phase) { if (C) C.dodge(p, phase); }
// Nova partida / troca de herói.
export function mcReset(p) {
  if (p.mcShellFx && C) C.dropMesh(p.mcShellFx);
  p.mcShellFx = null; p.mcShell = false;
  if (p.mcs && p.mcs.fire && C) C.dropMesh(p.mcs.fire);
  p.mcs = null;
}
