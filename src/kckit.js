// Bênçãos COMUNS das 5 armas do Cavaleiro (lista do dono, 11/11/2026): os efeitos.
// Dados e textos em kcbless.js (números em KC). combat.kc = KCKit. Partes do herói (velocidade do golpe,
// rolamento, voo do Ringue, investida da Determinação) ficam nas funções exportadas no fim.
import * as THREE from 'three';
import { audio } from './audio.js';
import { KC, lv } from './kcbless.js';
import { knockDown, fear } from './axekit3.js';
import { repairShield } from './shield.js';

const W = (p) => (p && p.stats && p.stats.w) || {};
const wpn = (p, id) => !!(p && p.heroId === 'knight' && p.hero && p.hero.weaponId === id);
const idxOf = (p, step) => (p && p.hero && step ? p.hero.combo.indexOf(step) : -1);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const DEG = Math.PI / 180;
const shooterType = (e) => e.type === 'archer' || e.type === 'mage';
const dazed = (e) => e.state === 'hurt' || e.state === 'axeDown' || e.offBalanceT > 0 || e.frozenT > 0;
const NEW_HITS = () => [new Set(), new Set(), new Set(), new Set(), new Set()];
// Estado de cada herói (combo, contadores, barras).
export const kcS = (p) => p.kcs || (p.kcs = { hits: NEW_HITS(), lastHurt: -99, heavyN: 0, embN: 0, embT: 0, links: 0, ponta: 0, seqN: 0, nos: 0, bellN: 0, wallN: 0, kills: [], champT: 0, spinT: 0, trophy: 0 });
const anyKc = (w) => { for (const k in w) if (k.startsWith('kc')) return true; return false; };

let C = null; // o kit da partida (para as funções do herói)

export class KCKit {
  constructor(c) {
    this.c = c; C = this;
    this.t = 0;
    this.pulls = [];   // Gancho de Esquerda: puxados até o herói
    this.whirls = [];  // Aliado dos Ventos: redemoinhos
  }
  log(o) { if (this.c.log) this.c.log(o); }
  get players() { return this.c.players; }

  // ---------- Antes do dano: multiplicador e crítico ----------
  damage(p, e, step) {
    let mul = 1, crit = false;
    if (e.kcLineT > 0) mul *= 1 + KC.linha.mul; // Manter a Linha: marcado leva +25% de qualquer herói
    const w = W(p);
    if (!p || !p.hero || !anyKc(w)) return { mul, crit };
    const s = kcS(p), idx = idxOf(p, step);
    e.kcStun = dazed(e); // Lootear: estava tonto antes do golpe
    e.kcCharging = e.state === 'charge' || e.state === 'chargeWind'; // Contra-Investida
    // Espada e Escudo
    if (w.kcCerteiro && step.heavy && s.certeiro && wpn(p, 'espada')) crit = true;
    if (w.kcTroco && s.trocoLive) mul *= 1 + lv(KC.troco, w.kcTroco);
    if (w.kcFio && idx === 2 && s.hits[0].has(e) && s.hits[1].has(e)) { mul *= 1 + lv(KC.fio, w.kcFio); s.fioHit = e; }
    if (w.kcCacador && shooterType(e)) mul *= 1 + lv(KC.cacador, w.kcCacador);
    // Machado
    if (w.kcAbertura && e.hp >= e.maxHp) {
      const list = lv(KC.abertura, w.kcAbertura);
      if (!list || (!e.data.boss && list.includes(e.type))) { crit = true; s.opened = e; }
    }
    if (w.kcCabeca && step.heavy && s.cool) mul *= 1 + lv(KC.cabeca.mul, w.kcCabeca);
    // Mangual
    if (w.kcBola && step.heavy && dazed(e)) mul *= 1 + lv(KC.bola, w.kcBola);
    if (w.kcMuralha && s.wallLive) crit = true;
    // Lança
    if (w.kcPrimeira && idx === 0 && s.firstCrit) crit = true;
    if (w.kcAtiradores && shooterType(e)) mul *= 1 + lv(KC.atiradores, w.kcAtiradores);
    // Manopla
    if (w.kcUmDois && ((idx === 1 && s.hits[0].has(e)) || (w.kcUmDois >= 3 && idx === 2 && s.hits[0].has(e) && s.hits[1].has(e)))) crit = true;
    if (w.kcSeq && s.seqN > 0) mul *= 1 + KC.sequencia.per * s.seqN;
    if (w.kcBoxe && s.boxe) { crit = true; s.boxeUse = true; }
    if (w.kcNos && step.heavy && s.nos >= 1) { mul *= 2; s.nosUse = true; }
    return { mul, crit };
  }

  // ---------- No golpe (antes de procurar quem acertou) ----------
  onSwing(p, step) {
    const w = W(p);
    if (!p.hero || !anyKc(w)) return;
    const s = kcS(p), idx = idxOf(p, step);
    s.swingHits = new Set(); s.swingKills = 0; s.swingStep = step;
    if (idx === 0) { // combo novo
      s.hits = NEW_HITS();
      s.trocoLive = !!s.trocoArm; s.trocoArm = false;
    }
    if (w.kcCerteiro && step.heavy) { s.heavyN++; s.certeiro = s.heavyN % lv(KC.certeiro, w.kcCerteiro) === 0; }
    if (w.kcCabeca) s.cool = !!step.heavy && this.t - s.lastHurt >= KC.cabeca.t;
    if (w.kcMuralha) { s.wallLive = s.wallN >= lv(KC.muralha, w.kcMuralha); s.wallN = 0; }
    if (w.kcPrimeira && idx === 0) s.firstCrit = Math.random() < lv(KC.primeira, w.kcPrimeira);
    if (w.kcBadalo && s.bellArm && wpn(p, 'mangual')) { s.bellArm = false; this.dong(p); }
    if (w.kcDivino && idx === 2 && wpn(p, 'mangual') && Math.random() < lv(KC.divino.chance, w.kcDivino)) this.divine(p);
    if (w.kcVentos && step.arc === 360 && wpn(p, 'machado')) this.whirl(p);
  }

  // ---------- Depois do dano (r: { dmg, died, crit, spell, nx, nz }) ----------
  onHit(p, e, step, r) {
    const w = W(p);
    if (!p.hero || !anyKc(w)) return;
    const s = kcS(p), idx = idxOf(p, step), c = this.c;
    if (idx >= 0 && s.hits[idx]) s.hits[idx].add(e);
    if (s.swingHits && s.swingStep === step) { s.swingHits.add(e); if (r.died) s.swingKills++; }
    if (w.kcLinha && wpn(p, 'lanca')) { if (!(e.kcLineT > 0) && !r.died) c.text.add('Marcado!', e.position, 'hurt', 3.0); e.kcLineT = lv(KC.linha.t, w.kcLinha); }
    if (w.kcRachador && !r.died) this.crack(p, e, r.nx, r.nz);
    if (w.kcEspeto && wpn(p, 'lanca') && s.espetoSeq !== p.swingSeq) { s.espetoSeq = p.swingSeq; this.skewer(p, e, r.dmg, w); }
    if (r.died) return;
    const boss = !!e.data.boss;
    // Machado: Peso Morto
    if (w.kcPeso && step.heavy && wpn(p, 'machado') && !boss && !e.undead && e.hp < e.maxHp * lv(KC.pesoMorto, w.kcPeso)) {
      if (c.fist.launch(p, e, r.nx, r.nz, { speed: 18, distTotal: 9, path: 10, land: 8, label: 'Peso Morto!' })) { this.log({ type: 'kcPeso', enemy: e }); return; }
    }
    // Mangual
    if (w.kcQuente && wpn(p, 'mangual')) e.kcHotBy = p;
    if (w.kcCalar && e.type === 'mage') this.silence(e, lv(KC.calar, w.kcCalar));
    if (w.kcMuralha && s.wallLive && e.offBalance && e.offBalance(r.nx, r.nz, 0.8, 22)) { c.text.add('Empurrão!', e.position, 'crit', 3.2); this.log({ type: 'kcWallPush', enemy: e }); }
    // Lança
    if (w.kcContra && e.kcCharging && e.type === 'warrior' && e.daze) {
      e.kcCharging = false;
      if (e.daze(lv(KC.contra, w.kcContra))) { c.text.add('Investida parada!', e.position, 'crit', 3.4); this.log({ type: 'kcContra', enemy: e }); }
    }
    if (w.kcFerida) {
      e.kcWound = (e.kcWound || 0) + 1;
      if (e.kcWound >= lv(KC.ferida, w.kcFerida)) { e.kcWound = 0; this.bleed(p, e, 1); }
    }
    if (w.kcGelado && idx === 1 && e.freeze && Math.random() < lv(KC.gelado.chance, w.kcGelado)) { e.freeze(boss ? 0.4 : KC.gelado.t, c); this.log({ type: 'kcGelado', enemy: e }); }
    if (w.kcAtiradores >= 3 && step.heavy && shooterType(e) && e.hp < e.maxHp * 0.5) { c.text.add('Abatido!', e.position, 'crit', 3.4); this.kill(p, e, r.nx, r.nz); return; }
    // Manopla
    if (w.kcUmDois >= 2 && idx === 1 && s.hits[0].has(e) && e.offBalance && e.offBalance(r.nx, r.nz, 0.6, 4)) c.text.add('Desequilibrado!', e.position, 'hurt', 3.2);
    if (w.kcBoxe >= 3 && s.boxeUse && e.daze && e.daze(boss ? 0.4 : 1.2)) c.text.add('Atordoado!', e.position, 'hurt', 3.2);
    if (w.kcNocaute && step.heavy && wpn(p, 'manopla') && !boss && !e.undead && !e.finale && e.hp <= e.maxHp * lv(KC.nocaute, w.kcNocaute)) {
      this.kill(p, e, r.nx, r.nz);
      c.fist.launch(p, e, r.nx, r.nz, { dead: true, speed: 17, distTotal: 9, path: 10, label: 'Nocaute!' });
      this.log({ type: 'kcNocaute', enemy: e });
      return;
    }
    if (w.kcEmpurra && wpn(p, 'manopla')) e.kcShove = { p, t: 0.7, dmg: lv(KC.empurra, w.kcEmpurra) };
    if (w.kcGancho && idx === 2 && wpn(p, 'manopla') && !boss) this.pull(p, e);
  }

  // Golpe que o escudo do Guerreiro segurou (Rachador conta também).
  onBlocked(p, e, step, nx = 0, nz = 1) {
    const w = W(p);
    if (w.kcRachador) this.crack(p, e, nx, nz);
  }

  // ---------- Depois do golpe inteiro ----------
  afterStrike(p, step, hits) {
    const w = W(p);
    if (!p.hero || !anyKc(w)) return;
    const s = kcS(p), idx = idxOf(p, step), c = this.c;
    const n = s.swingHits ? s.swingHits.size : 0;
    if (w.kcElo && wpn(p, 'mangual')) s.links = n ? Math.min(lv(KC.elo.max, w.kcElo), s.links + 1) : s.links;
    if (w.kcLenhador && s.swingKills >= 2) { s.lumberArm = true; c.text.add('Embalo!', p.position, 'crit', 3.2); this.log({ type: 'kcLumber' }); }
    if (w.kcVentos && step.arc === 360 && n >= KC.ventos.n) this.liftAll(p, s.swingHits);
    if (w.kcSatisf && idx === 2 && s.hits[0].size && s.hits[1].size && s.hits[2].size) this.heal(p, KC.satisfacao, 'kcSatisf');
    if (w.kcSeq && step.heavy && wpn(p, 'manopla') && p.hero.combo.slice(0, 4).every((_, i) => s.hits[i] && s.hits[i].size)) {
      const max = lv(KC.sequencia.max, w.kcSeq);
      if (s.seqN < max) { s.seqN++; c.text.add(`Sequência ×${s.seqN}`, p.position, 'crit', 3.2); }
      this.log({ type: 'kcSeq', n: s.seqN });
    }
    if (w.kcVarredura && step.heavy && wpn(p, 'lanca')) this.sweep(p, step, s);
    if (w.kcBadalo && wpn(p, 'mangual') && n) {
      s.bellN += n;
      if (s.bellN >= lv(KC.badalo.n, w.kcBadalo)) { s.bellN = 0; s.bellArm = true; }
    }
    if (s.boxeUse) { s.boxeUse = false; s.boxe = false; if (w.kcBoxe >= 2 && n) this.heal(p, 3, 'kcBoxeHeal'); }
    if (s.nosUse) { s.nosUse = false; s.nos = 0; }
    if (step.heavy) s.trocoLive = false;
    if (s.cool && step.heavy) s.lastHurt = this.t; // Cabeça Fria: gastou, conta 5 s de novo
    s.wallLive = false; s.cool = false; s.certeiro = false;
    s.swingStep = null;
  }

  // ---------- Inimigo derrotado pelo herói ----------
  onKill(e, by) {
    const w = W(by);
    if (!by.hero || !anyKc(w)) return;
    const s = kcS(by), c = this.c, st = s.swingStep;
    if (w.kcEmbalo) { s.embN = Math.min(w.kcEmbalo, s.embN + 1); s.embT = KC.embalo.t; }
    if (w.kcGrito && st && st.heavy && wpn(by, 'espada')) this.shout(by, lv(KC.grito.t, w.kcGrito));
    if (w.kcCorte && st && st.heavy && wpn(by, 'machado')) this.followCut(by, e, st);
    if (w.kcTrofeu) {
      s.trophy++;
      if (s.trophy >= lv(KC.trofeu, w.kcTrofeu)) {
        s.trophy = 0;
        if (!(by.ultTime > 0)) by.ult = Math.min(by.ultNeed, (by.ult || 0) + 1);
        c.text.add('+1 ultimate', by.position, 'crit', 3.2);
        this.log({ type: 'kcTrophy' });
      }
    }
    if (w.kcConsc && st && wpn(by, 'mangual')) this.topple(by, e, lv(KC.consciencia, w.kcConsc));
    if (w.kcLoot && e.kcStun && Math.random() < lv(KC.loot, w.kcLoot) && c.props && c.props.onDrop) { c.props.onDrop(v3(e.position.x, 0, e.position.z)); this.log({ type: 'kcLoot', enemy: e }); }
    if (w.kcPonta && wpn(by, 'lanca') && s.ponta < KC.ponta.max) s.ponta++;
    if (w.kcNos && wpn(by, 'manopla') && s.nos < 1) {
      s.nos = Math.min(1, s.nos + lv(KC.nos, w.kcNos) + 1e-9);
      if (s.nos >= 1) c.text.add('Sangue nos Nós!', by.position, 'crit', 3.4);
    }
    if (w.kcCampeao && wpn(by, 'manopla')) {
      s.kills = s.kills.filter((t) => this.t - t <= KC.campeao.win); s.kills.push(this.t);
      if (s.kills.length >= KC.campeao.n) { s.kills = []; s.champT = KC.campeao.t; c.text.add('Campeão!', by.position, 'crit', 3.4); this.log({ type: 'kcChamp' }); }
    }
  }

  // ---------- Escudo do herói segurou um golpe ----------
  onBlock(p, e, opts, res) {
    const w = W(p);
    if (!anyKc(w)) return;
    const s = kcS(p);
    if (w.kcTroco) s.trocoArm = true;
    if (w.kcMuralha) s.wallN++;
  }

  // ---------- Herói tomou dano ----------
  onHurt(p, src) {
    const w = W(p);
    if (!anyKc(w)) return;
    const s = kcS(p), c = this.c;
    s.lastHurt = this.t;
    if (s.links) { s.links = 0; this.log({ type: 'kcLinksReset' }); }
    if (w.kcCotovelo && src && src.alive && src.targetable && wpn(p, 'manopla')) {
      const dx = src.position.x - p.position.x, dz = src.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      if (d < 3.4 + src.data.radius && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > 100 * DEG) {
        const dmg = Math.max(1, Math.round(lv(KC.cotovelada, w.kcCotovelo) * p.stats.damageMul));
        c.vfx.sparks(v3(src.position.x, 1.3, src.position.z), 0xffd36a, 10);
        audio.play('hitHeavy', src.position.x, src.position.z, { v: 0.8 });
        c.text.add('Cotovelada!', p.position, 'crit', 3.2);
        c.bonusDamage(src, dmg, dx / d, dz / d, 'dmg', p);
        this.log({ type: 'kcElbow', enemy: src, dmg });
      }
    }
  }

  // ---------- Golpe trocado (devolve true = este golpe já foi feito aqui) ----------
  strike(p, step) {
    const w = W(p);
    if (!p.hero || !anyKc(w)) return false;
    const s = kcS(p);
    if (s.spinLive && w.kcEsquiva && wpn(p, 'mangual')) { s.spinLive = false; this.heavySpin(p, step, w); return true; }
    if (w.kcDeterm && step.heavy && wpn(p, 'lanca') && idxOf(p, step) >= 0 && !p.kcDashing) return this.determination(p, step);
    return false;
  }

  // Alcance extra (Elo Extra, Ponta de Troféu).
  rangeMul(p) {
    const w = W(p), s = p && p.kcs;
    if (!s) return 1;
    let m = 1;
    if (w.kcElo && s.links) m *= 1 + KC.elo.per * s.links;
    if (w.kcPonta && s.ponta) m *= 1 + lv(KC.ponta.per, w.kcPonta) * s.ponta;
    return m;
  }

  // Escudo Espelhado: a flecha bloqueada volta (true = rebater).
  mirror(p, a, dx, dz) {
    const w = W(p);
    if (!w.kcEspelho || !wpn(p, 'espada') || a.kind !== 'arrow' || !(p.shield > 0)) return false;
    if (!p.blocksFrom(a.x - dx * 3, a.z - dz * 3)) return false;
    if (Math.random() >= lv(KC.espelho, w.kcEspelho)) return false;
    this.log({ type: 'kcMirror' });
    return true;
  }

  // Sala nova: Brasão Restaurado; Sequência e Ponta de Troféu zeram.
  roomStart() {
    for (const p of this.players) {
      const s = kcS(p), w = W(p);
      s.ponta = 0; s.seqN = 0; s.links = 0; s.kills = [];
      if (w.kcBrasao && p.shield !== undefined && !(p.hero && p.hero.noShield)) {
        const got = repairShield(p, lv(KC.brasao, w.kcBrasao));
        if (got > 0 && this.c.text) { this.c.text.add(`Escudo +${got}`, p.position, 'heal', 3.0); this.log({ type: 'kcBrasao', n: got }); }
      }
    }
  }

  tick(dt) {
    this.t += dt;
    const c = this.c;
    for (const p of this.players) {
      const s = p.kcs;
      if (!s) continue;
      if (s.embT > 0 && (s.embT -= dt) <= 0) s.embN = 0;
      if (s.champT > 0) s.champT -= dt;
      if (s.spinT > 0) s.spinT -= dt;
    }
    for (const e of c.enemies) {
      if (e.kcLineT > 0) e.kcLineT -= dt;
      if (e.kcSilT > 0) { // Calar o Mago
        e.kcSilT -= dt;
        e.cooldown = Math.max(e.cooldown || 0, e.kcSilT);
        if (e.cd && e.cd.revive !== undefined) e.cd.revive = Math.max(e.cd.revive, e.kcSilT);
      }
      if (e.kcHotBy) this.hotTick(e, dt);
      if (e.kcShove) this.shoveTick(e, dt);
    }
    for (const pl of [...this.pulls]) { // Gancho de Esquerda
      const e = pl.e;
      pl.t += dt;
      if (!e.alive) { this.pulls.splice(this.pulls.indexOf(pl), 1); continue; }
      const k = Math.min(1, pl.t / pl.T);
      e.vel.set(0, 0, 0);
      e.position.x = pl.fx + (pl.tx - pl.fx) * k; e.position.z = pl.fz + (pl.tz - pl.fz) * k;
      if (k >= 1) { this.pulls.splice(this.pulls.indexOf(pl), 1); if (c.world) c.world.resolveCircle(e.position, e.data.radius); }
    }
  }

  clear() {
    this.pulls.length = 0;
    this.whirls.length = 0;
  }

  // ================= Efeitos =================
  heal(p, n, type) {
    if (p.state === 'dead') return;
    const got = p.heal(n);
    if (got) this.c.text.add(`+${got}`, p.position, 'heal small');
    this.log({ type, n: got });
  }
  bleed(p, e, n) {
    e.bleedStacks = (e.bleedStacks || 0) + n;
    e.bleedBy = p;
    this.c.text.add(e.bleedStacks > 1 ? `Sangramento ×${e.bleedStacks}` : 'Sangrando!', e.position, 'bleed', 3.0);
    this.log({ type: 'kcBleed', enemy: e });
  }
  kill(p, e, nx, nz) { // derrota na hora (com a vida que sobrou)
    if (!e.alive) return;
    this.c.bonusDamage(e, Math.max(1, Math.ceil(e.hp)), nx, nz, 'dmg big', p);
  }
  silence(e, t) {
    e.kcSilT = Math.max(e.kcSilT || 0, t);
    if ((e.state === 'aim' || e.state === 'revive') && e.daze) e.daze(0.3); // cancela a magia
    e.cooldown = Math.max(e.cooldown || 0, t);
    this.c.text.add('Silenciado!', e.position, 'miss', 3.2);
    this.c.vfx.sparks(v3(e.position.x, 2.0, e.position.z), 0xc890ff, 10);
    this.log({ type: 'kcSilence', enemy: e, t });
  }
  // Rachador: golpes no escudo do Guerreiro (1 por golpe).
  crack(p, e, nx, nz) {
    if (e.type !== 'warrior' || !e.data.shield || e.shieldBroken || !e.alive) return;
    if (e.kcCrackSeq === p.swingSeq) return;
    e.kcCrackSeq = p.swingSeq;
    e.kcCrack = (e.kcCrack || 0) + 1;
    const need = lv(KC.rachador, W(p).kcRachador);
    if (e.kcCrack >= need) { this.c.breakEnemyShield(e, nx, nz, p); this.log({ type: 'kcCrack', enemy: e }); }
    else this.c.text.add(`Rachando ${e.kcCrack}/${need}`, e.position, 'block', 3.0);
  }
  // Espeto Duplo: quem está atrás do 1º acertado na linha da estocada.
  skewer(p, e, dmg, w) {
    const fx = Math.sin(p.facing), fz = Math.cos(p.facing), c = this.c, s = kcS(p);
    let best = null, bd = Infinity;
    for (const o of c.enemies) {
      if (o === e || !o.targetable || (s.swingHits && s.swingHits.has(o))) continue;
      const rx = o.position.x - e.position.x, rz = o.position.z - e.position.z;
      const along = rx * fx + rz * fz, side = Math.abs(rx * fz - rz * fx);
      if (along <= 0 || along > KC.espeto.reach + o.data.radius || side > o.data.radius + 0.7) continue;
      if (along < bd) { bd = along; best = o; }
    }
    if (!best) return;
    const d = Math.max(1, Math.round(dmg * lv(KC.espeto.mul, w.kcEspeto)));
    c.vfx.sparks(v3(best.position.x, 1.2, best.position.z), 0x7fd6ff, 8);
    c.bonusDamage(best, d, fx, fz, 'dmg', p);
    this.log({ type: 'kcSkewer', enemy: best, dmg: d });
  }
  // Varredura: a estocada forte pega os lados com metade do dano.
  sweep(p, step, s) {
    const c = this.c, R = KC.varredura.r;
    const dmg = Math.max(1, Math.round(step.damage * p.stats.damageMul * KC.varredura.mul));
    c.vfx.sector(p.position, p.facing + Math.PI / 2, R, 40 * DEG, 0x7fd6ff);
    c.vfx.sector(p.position, p.facing - Math.PI / 2, R, 40 * DEG, 0x7fd6ff);
    let n = 0;
    for (const o of [...c.enemies]) {
      if (!o.targetable || (s.swingHits && s.swingHits.has(o))) continue;
      const dx = o.position.x - p.position.x, dz = o.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      const a = Math.abs(wrap(Math.atan2(dx, dz) - p.facing));
      if (d > R + o.data.radius || a < 30 * DEG || a > 130 * DEG) continue;
      c.bonusDamage(o, dmg, dx / d, dz / d, 'dmg', p); n++;
    }
    this.log({ type: 'kcSweep', n });
  }
  // Corte Seguido: o golpe forte que mata continua no de trás.
  followCut(p, e, step) {
    const c = this.c, s = kcS(p);
    const dx0 = e.position.x - p.position.x, dz0 = e.position.z - p.position.z, d0 = Math.hypot(dx0, dz0) || 1;
    const fx = dx0 / d0, fz = dz0 / d0;
    let best = null, bd = Infinity;
    for (const o of c.enemies) {
      if (o === e || !o.targetable || (s.swingHits && s.swingHits.has(o))) continue;
      const rx = o.position.x - e.position.x, rz = o.position.z - e.position.z;
      const along = rx * fx + rz * fz, side = Math.abs(rx * fz - rz * fx);
      if (along <= -0.2 || along > KC.corte.reach + o.data.radius || side > o.data.radius + 1.2) continue;
      if (along < bd) { bd = along; best = o; }
    }
    if (!best) return;
    if (s.swingHits) s.swingHits.add(best);
    const dmg = Math.max(1, Math.round(step.damage * p.stats.damageMul * KC.corte.mul));
    c.vfx.sector(e.position, Math.atan2(fx, fz), 2.4, 30 * DEG, 0xff8a4a);
    c.text.add('Corte Seguido!', best.position, 'crit', 3.2);
    c.bonusDamage(best, dmg, fx, fz, 'dmg big', p);
    this.log({ type: 'kcFollow', enemy: best, dmg });
  }
  // Grito do Cavaleiro: quem está em volta foge.
  shout(p, t) {
    const c = this.c;
    let n = 0;
    for (const o of c.enemies) {
      if (!o.alive || o.undead) continue;
      if (Math.hypot(o.position.x - p.position.x, o.position.z - p.position.z) > KC.grito.r + o.data.radius) continue;
      if (fear(o, p, t)) n++;
    }
    c.vfx.ring(v3(p.position.x, 0.2, p.position.z), 0xffd36a, KC.grito.r);
    audio.play('warcry', p.position.x, p.position.z, { v: 0.8 });
    c.text.add('Fujam!', p.position, 'crit', 3.4);
    this.log({ type: 'kcShout', n, t });
  }
  // Peso na Consciência: o derrotado cai e derruba quem está atrás.
  topple(p, e, r) {
    const c = this.c;
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
    const nx = dx / d, nz = dz / d, cx = e.position.x + nx * 1.0, cz = e.position.z + nz * 1.0;
    let n = 0;
    for (const o of c.enemies) {
      if (o === e || !o.targetable || o.data.boss) continue;
      const ox = o.position.x - e.position.x, oz = o.position.z - e.position.z;
      if (Math.hypot(o.position.x - cx, o.position.z - cz) > r + o.data.radius || ox * nx + oz * nz < -0.3) continue;
      if (knockDown(o, nx, nz)) { n++; c.text.add('Derrubado!', o.position, 'hurt', 3.2); }
    }
    c.vfx.dust(v3(cx, 0.1, cz), v3(nx, 0, nz), 8);
    c.vfx.ring(v3(cx, 0.1, cz), 0xb9a2ff, r);
    if (n) audio.play('thump', cx, cz, { v: 0.8 });
    this.log({ type: 'kcTopple', n });
  }
  // Badalo: DONG em volta.
  dong(p) {
    const c = this.c, R = KC.badalo.r;
    let n = 0;
    for (const o of c.enemies) {
      if (!o.targetable || o.undead) continue;
      if (Math.hypot(o.position.x - p.position.x, o.position.z - p.position.z) > R + o.data.radius) continue;
      if (o.daze && o.daze(KC.badalo.t)) n++;
    }
    c.vfx.ring(v3(p.position.x, 0.4, p.position.z), 0xffd36a, R);
    c.vfx.ring(v3(p.position.x, 0.4, p.position.z), 0xfff2b0, R * 0.6);
    audio.play('bell', p.position.x, p.position.z, { v: 1.0 });
    c.text.add('DONG!', p.position, 'crit', 3.6);
    this.log({ type: 'kcDong', n });
  }
  // Mangual Divino: todos no chão levam 1 e ficam tontos.
  divine(p) {
    const c = this.c, D = KC.divino;
    let n = 0;
    for (const o of [...c.enemies]) {
      if (!o.targetable || o.undead || (o.position.y || 0) > 0.3) continue;
      c.vfx.sparks(v3(o.position.x, 0.4, o.position.z), 0xffe27a, 6);
      c.bonusDamage(o, D.dmg, 0, 1, 'dmg', p, true);
      if (o.alive && o.daze) o.daze(D.t);
      n++;
    }
    c.vfx.ring(v3(p.position.x, 0.2, p.position.z), 0xffe27a, 9);
    audio.play('thunder', p.position.x, p.position.z, { v: 0.5 });
    c.text.add('Mangual Divino!', p.position, 'crit', 3.6);
    this.log({ type: 'kcDivine', n });
  }
  // Corrente Quente: dano enquanto o inimigo está tonto.
  hotTick(e, dt) {
    if (!e.alive || !(e.state === 'hurt' || e.state === 'axeDown')) {
      if (e.alive && (e.kcHotAcc || 0) >= 0.5) this.c.bonusDamage(e, 1, 0, 1, 'burn', e.kcHotBy, true);
      e.kcHotBy = null; e.kcHotAcc = 0; return;
    }
    const p = e.kcHotBy;
    e.kcHotAcc = (e.kcHotAcc || 0) + lv(KC.quente, W(p).kcQuente) * dt;
    if (e.kcHotAcc >= 1) {
      const d = Math.floor(e.kcHotAcc);
      e.kcHotAcc -= d;
      this.c.vfx.sparks(v3(e.position.x, 1.0, e.position.z), 0xff7a2a, 3);
      this.c.bonusDamage(e, d, 0, 1, 'burn', p, true);
      this.log({ type: 'kcHot', enemy: e, dmg: d });
    }
  }
  // Empurra-Empurra: empurrado que bate em outro.
  shoveTick(e, dt) {
    const S = e.kcShove;
    S.t -= dt;
    if (S.t <= 0 || !e.alive) { e.kcShove = null; return; }
    if (Math.hypot(e.vel.x, e.vel.z) < 2.2) return;
    const c = this.c;
    for (const o of c.enemies) {
      if (o === e || !o.targetable) continue;
      if (Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) > (o.data.radius + e.data.radius) * 1.08) continue;
      e.kcShove = null;
      const dmg = Math.max(1, Math.round(S.dmg * S.p.stats.damageMul));
      c.vfx.sparks(v3((o.position.x + e.position.x) / 2, 1.1, (o.position.z + e.position.z) / 2), 0xffd36a, 10);
      audio.play('hit', o.position.x, o.position.z, { v: 0.8 });
      c.text.add('Trombada!', o.position, 'crit', 3.0);
      const nx = o.position.x - e.position.x, nz = o.position.z - e.position.z, d = Math.hypot(nx, nz) || 1;
      c.bonusDamage(o, dmg, nx / d, nz / d, 'dmg', S.p);
      c.bonusDamage(e, dmg, -nx / d, -nz / d, 'dmg', S.p);
      this.log({ type: 'kcShove', a: e, b: o, dmg });
      return;
    }
  }
  // Gancho de Esquerda: puxa até a frente do herói.
  pull(p, e) {
    if (!e.alive || e.undead) return;
    const r = p.hero.radius + e.data.radius + 0.25, a = p.facing;
    e.vel.set(0, 0, 0);
    this.pulls = this.pulls.filter((x) => x.e !== e);
    this.pulls.push({ e, t: 0, T: 0.14, fx: e.position.x, fz: e.position.z, tx: p.position.x + Math.sin(a) * r, tz: p.position.z + Math.cos(a) * r });
    if (e.daze) e.daze(0.5);
    this.c.text.add('Gancho!', e.position, 'crit', 3.0);
    this.log({ type: 'kcHook', enemy: e });
  }
  // Aliado dos Ventos: o giro vira redemoinho.
  whirl(p) {
    const c = this.c;
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 0.9, 2.8, 28, 1, true), mat);
    cone.position.y = 1.4; g.add(cone);
    const cone2 = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 0.6, 2.2, 20, 1, true), mat.clone());
    cone2.position.y = 1.2; g.add(cone2);
    g.position.set(p.position.x, 0, p.position.z);
    c.vfx.add(g, 0.8, (o, k, dt) => {
      o.position.set(p.position.x, 0, p.position.z);
      cone.rotation.y += dt * 16; cone2.rotation.y -= dt * 22;
      const a = 0.34 * (1 - k * k);
      cone.material.opacity = a; cone2.material.opacity = a * 0.8;
      o.scale.set(0.7 + 0.5 * k, 0.8 + 0.3 * Math.sin(k * Math.PI), 0.7 + 0.5 * k);
    });
    c.vfx.dust(v3(p.position.x, 0.1, p.position.z), v3(0, 0, 0), 10);
    this.log({ type: 'kcWhirl' });
  }
  liftAll(p, set) {
    let n = 0;
    for (const e of set) {
      if (!e.alive || e.data.boss || e.undead || e.immune || e.frozenT > 0) continue;
      if (['held', 'thrown', 'spawn', 'rage', 'dead', 'roll', 'hop', 'headless', 'tpOut', 'tpIn', 'fistFly', 'fistHeld', 'lanceHeld', 'lanceFly'].includes(e.state)) continue;
      e.releaseToken();
      e.vel.set(0, 0, 0);
      e.setState('kcLift');
      e.kcLift = { t: 0, total: KC.ventos.t, vy: 0, spin: (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 2) };
      e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.4 });
      n++;
    }
    if (n) { this.c.text.add('Ao vento!', p.position, 'crit', 3.4); audio.play('spin', p.position.x, p.position.z, { v: 0.9 }); }
    this.log({ type: 'kcLift', n });
  }
  liftTick(e, dt) {
    const L = e.kcLift;
    if (!L) { e.setState('chase'); return; }
    L.t += dt;
    e.vel.set(0, 0, 0);
    if (L.t < L.total) {
      const want = KC.ventos.h + Math.sin(L.t * 4) * 0.2;
      e.position.y += (want - e.position.y) * Math.min(1, dt * 7);
      e.facing += L.spin * dt; e.group.rotation.y = e.facing;
      if (e.model) e.model.rotation.z = Math.sin(L.t * 3) * 0.35;
      return;
    }
    L.vy -= 30 * dt;
    e.position.y += L.vy * dt;
    if (e.position.y > 0) return;
    e.position.y = 0;
    if (e.model) { e.model.rotation.x = 0; e.model.rotation.z = 0; }
    e.kcLift = null;
    e.setState('hurt'); e.stunTime = 0.35;
    e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05 });
    this.c.vfx.dust(v3(e.position.x, 0.1, e.position.z), v3(0, 0, 0), 5);
    audio.play('thump', e.position.x, e.position.z, { v: 0.5 });
  }
  // Esquiva Pesada: a bola gira em volta, rápida.
  heavySpin(p, step, w) {
    const c = this.c, h = p.hero;
    const range = h.attackRange * p.stats.rangeMul * this.rangeMul(p);
    const sp = { ...step, arc: 360, damage: step.damage * lv(KC.esquiva.mul, w.kcEsquiva) };
    c.vfx.sector(p.position, p.facing, range, Math.PI, 0xb9a2ff);
    c.vfx.ring(v3(p.position.x, 0.3, p.position.z), 0xb9a2ff, range);
    audio.play('spin', p.position.x, p.position.z, { v: 0.8 });
    let hits = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.001;
      if (d > range + e.data.radius) continue;
      if (c.damageEnemy(p, e, sp, dx / d, dz / d)) hits++;
    }
    c.text.add('Esquiva Pesada!', p.position, 'crit', 3.2);
    if (hits) { audio.play('hit', p.position.x, p.position.z); c.addHitstop(0.05); }
    this.log({ type: 'kcHeavySpin', hits });
  }
  // Determinação: o 3º golpe sempre acha alguém (vira; sem ninguém no alcance, investe).
  determination(p, step) {
    const c = this.c, h = p.hero;
    const range = h.attackRange * p.stats.rangeMul * this.rangeMul(p), arc = (step.arc || h.attackArc) / 2 * DEG;
    let inArc = false, side = null, sd = Infinity, near = null, nd = Infinity;
    for (const e of c.enemies) {
      if (!e.targetable) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz);
      if (d <= range + e.data.radius) {
        if (Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) <= arc) inArc = true;
        else if (d < sd) { sd = d; side = e; }
      } else if (d < nd && d <= KC.determ.range) { nd = d; near = e; }
    }
    if (inArc) return false;
    if (side) { p.facing = Math.atan2(side.position.x - p.position.x, side.position.z - p.position.z); p.group.rotation.y = p.facing; this.log({ type: 'kcDetermTurn', enemy: side }); return false; }
    if (!near) return false;
    const dx = near.position.x - p.position.x, dz = near.position.z - p.position.z, d = Math.hypot(dx, dz) || 1;
    const stop = Math.max(0, d - Math.min(range * 0.6, 3));
    p.facing = Math.atan2(dx, dz); p.group.rotation.y = p.facing;
    p.iframes = Math.max(p.iframes || 0, KC.determ.iframes);
    p.kcFly = { kind: 'dash', e: near, step, t: 0, T: Math.max(0.12, stop / KC.determ.speed), h: 0.35, fx: p.position.x, fz: p.position.z, tx: p.position.x + dx / d * stop, tz: p.position.z + dz / d * stop };
    p.setState('kcDash');
    p.setGlow && p.setGlow(1);
    c.text.add('Determinação!', p.position, 'crit', 3.2);
    c.vfx.dust(v3(p.position.x, 0.1, p.position.z), v3(-dx / d, 0, -dz / d), 6);
    this.log({ type: 'kcDash', enemy: near });
    return true;
  }
}

// ================= Herói (player.js) =================
// Velocidade do golpe: Embalo, Embalo do Lenhador, Campeão, Esquiva Pesada.
export function kcAtkMul(p) {
  const s = p.kcs;
  if (!s) return 1;
  const w = W(p);
  let m = 1;
  if (w.kcEmbalo && s.embN > 0) m *= 1 + KC.embalo.spd * s.embN;
  if (w.kcLenhador && s.lumberLive) m *= 1 + lv(KC.lenhador, w.kcLenhador);
  if (w.kcCampeao && s.champT > 0) m *= 1 + lv(KC.campeao.spd, w.kcCampeao);
  if (s.spinLive) m *= KC.esquiva.spd;
  return m;
}
// Começo de um golpe (antes da animação): combo novo liga o Embalo do Lenhador e a Esquiva Pesada.
export function kcOnStart(p, step) {
  const w = W(p);
  if (!p.kcs && !anyKc(w)) return;
  const s = kcS(p);
  if (p.xstep || p.combo !== 0) return;
  s.lumberLive = !!s.lumberArm; s.lumberArm = false;
  s.spinLive = !!(w.kcEsquiva && s.spinT > 0 && wpn(p, 'mangual')); s.spinT = 0;
}
// Rolamento: Esquiva de Boxe (começo) e Esquiva Pesada (fim).
export function kcDodge(p, phase) {
  const w = W(p);
  if (!anyKc(w)) return;
  const s = kcS(p);
  if (phase === 'end') { if (w.kcEsquiva && wpn(p, 'mangual')) s.spinT = KC.esquiva.window; return; }
  if (w.kcBoxe && wpn(p, 'manopla') && C) {
    const near = C.c.enemies.some((e) => e.alive && !e.undead && ['attack', 'chargeWind', 'charge', 'leapWind', 'leap', 'spinWind', 'spin', 'grab'].includes(e.state)
      && Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) < 3.4 + e.data.radius);
    if (near) { s.boxe = true; C.c.text.add('Esquiva de boxe!', p.position, 'crit', 3.2); C.log({ type: 'kcBoxe' }); }
  }
}
// Ringue: rolou contra a parede -> voa até a parede do outro lado. Devolve true se começou.
export function kcRollWall(p, world) {
  const w = W(p);
  if (!w.kcRingue || !wpn(p, 'manopla') || !world || !C) return false;
  const r = p.hero.radius, dx = p.dodgeDir.x, dz = p.dodgeDir.z;
  if (!world.blocked(p.position.x + dx * (r + 0.3), p.position.z + dz * (r + 0.3), 0.15)) return false;
  let d = 0;
  for (let k = 0.3; k < 60; k += 0.3) {
    if (world.blocked(p.position.x - dx * k, p.position.z - dz * k, r)) break;
    d = k;
  }
  if (d < 3) return false;
  const R = KC.ringue;
  p.clearRoll && p.clearRoll();
  p.kcFly = { kind: 'ring', t: 0, T: Math.max(0.3, d / R.speed), h: R.h, fx: p.position.x, fz: p.position.z, tx: p.position.x - dx * d, tz: p.position.z - dz * d };
  p.facing = Math.atan2(-dx, -dz); p.group.rotation.y = p.facing;
  p.setState('kcFly');
  p.anim.play(p.hero.dodge.pose, { fade: 0.06, restart: true });
  C.c.text.add('Ringue!', p.position, 'crit', 3.4);
  C.c.vfx.dust(v3(p.position.x, 0.1, p.position.z), v3(-dx, 0, -dz), 8);
  audio.play('thump', p.position.x, p.position.z, { v: 0.8 });
  C.log({ type: 'kcRing', d });
  return true;
}
// Voo do Ringue / investida da Determinação. Devolve 'end' quando acabou.
export function kcStateTick(p, dt, world) {
  const F = p.kcFly;
  if (!F) return 'end';
  F.t += dt;
  if (F.kind === 'rest') { if (F.t >= F.T) { p.kcFly = null; return 'end'; } return null; } // depois da estocada da Determinação
  const k = Math.min(1, F.t / F.T);
  p.position.x = F.fx + (F.tx - F.fx) * k; p.position.z = F.fz + (F.tz - F.fz) * k;
  p.model.position.y = F.h * 4 * k * (1 - k);
  if (F.kind === 'ring') p.model.rotation.x = k * Math.PI * 2;
  if (k < 1) return null;
  p.model.position.y = 0; p.model.rotation.x = 0;
  if (world) world.resolveCircle(p.position, p.hero.radius);
  p.kcFly = null;
  if (F.kind === 'ring') {
    p.iframes = Math.max(p.iframes || 0, KC.ringue.after);
    if (C) { C.c.vfx.dust(v3(p.position.x, 0.1, p.position.z), v3(0, 0, 0), 8); C.log({ type: 'kcRingLand' }); }
    audio.play('thump', p.position.x, p.position.z, { v: 0.7 });
    return 'end';
  }
  // Determinação: chegou, golpeia.
  const e = F.e;
  if (e && e.alive) { p.facing = Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z); p.group.rotation.y = p.facing; }
  p.anim.play('Melee_2H_Attack_Stab', { once: true, restart: true, fade: 0.04, speed: 1.8 });
  p.setGlow && p.setGlow(0);
  if (C) { p.kcDashing = true; C.c.playerStrike(p, F.step); p.kcDashing = false; C.log({ type: 'kcDashHit', enemy: e }); }
  p.kcFly = { kind: 'rest', t: 0, T: 0.28 };
  return null;
}
export const kcInvuln = (p) => p.state === 'kcFly' || p.state === 'kcDash';
