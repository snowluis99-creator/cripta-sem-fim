// Bênçãos COMUNS das 5 armas do Ladino (lista do dono, 11/11/2026): os efeitos.
// Dados e textos em rcbless.js (números em RC). combat.rc = RCKit. Ganchos: wbhooks (dano, acerto, abate),
// combat.js (Toque Final, Ponta Fina, Esgrima Defensiva, dano recebido), rogue.js (kunais e virotes: disparo, acerto,
// chão, pegar, corrente), player.js (rolamento, velocidade do ataque e do passo, Dança Curta), brain.js (Kunai Gelada),
// roguekit.js (golpe dos cegos), kunaikit.js (Assobio), run.js (começo da sala).
import * as THREE from 'three';
import { audio } from './audio.js';
import { RC, ABERTURA, CONTORNO, lv } from './rcbless.js';
import { addBleed } from './wbhooks.js';
import { iconSprite, glowSprite, flyingBlade, dispose } from './rogueprops.js';

const DEG = Math.PI / 180;
const W = (p) => (p && p.stats && p.stats.w) || {};
const wpn = (p) => (p && p.heroId === 'rogue' && p.hero ? p.hero.weaponId : null);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const dm = (p) => (p && p.stats ? p.stats.damageMul || 1 : 1);
const dist = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const anyRc = (w) => { for (const k in w) if (k.startsWith('rc')) return true; return false; };
const typeOk = (table, n, e) => { const t = lv(table, n); return !t || t.includes(e.type); };
const isStab = (p, step) => !!step && !step.cone && p.hero.combo.includes(step); // Rapieira: 1º e 3º golpe
const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1e-6;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
};
const WIND = new Set(['attack', 'aim', 'leapWind', 'chargeWind', 'spinWind', 'ambushWind']); // Instinto: preparando o golpe
const ICON = { vuln: ['◎', 0xff7a3a, 2.75], grab: ['◎', 0xff3a5a, 2.75], inst: ['!', 0xffd24a, 3.05] };
// Estado de cada Ladino.
export const rcS = (p) => p.rcs || (p.rcs = {
  chain: 0, dance: 0, danceReady: false, danceSeq: -1, danceIgnore: false,
  crossed: null, firstDone: false, side: null, sideD: 99, arrows: null, felino: false,
  furT: 0, flourishT: 0, flourishMul: 0, salute: false, saluteOpen: false, saluteSeq: undefined, still: 0, scar: 0,
  whistles: 0, quick: 0, fastShot: false, firstShot: true, lastThrow: -99, kMiss: 0, mag: [], magN: 0,
});

let C = null; // o kit da partida (para as funções do herói)

export class RCKit {
  constructor(c) {
    this.c = c; C = this;
    this.t = 0;
    this.knives = [];  // Esquiva Afiada: adagas voando até o atirador
    this.pulls = [];   // Virote Magnético: inimigos puxados
    this.zones = [];   // Virote Magnético: puxão entre 2 paredes
    this.glows = new Map(); // brilho das kunais amaldiçoadas / virotes brilhantes
    this.iconE = new Set(); // inimigos com ícone (vulnerável, Instinto)
  }
  log(o) { if (this.c.log) this.c.log(o); }
  get players() { return this.c.players; }
  text(s, pos, cls = 'crit', size = 3.0) { this.c.text.add(s, pos, cls, size); }
  foes() { return this.c.enemies.filter((e) => e.targetable && !e.undead && !(e.data && e.data.phantom)); }
  nearest(x, z, r, skip) {
    let best = null, bd = r;
    for (const e of this.foes()) {
      if (e === skip) continue;
      const d = Math.hypot(e.position.x - x, e.position.z - z) - e.data.radius;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  heal(p, n) { if (!(n > 0) || p.state === 'dead') return 0; const got = p.heal(Math.round(n)); if (got) this.c.text.add(`+${got}`, p.position, 'heal small'); return got; }
  rm(o) { if (o) { if (o.parent) o.parent.remove(o); dispose(o); } }

  // ---------- Ícones em cima dos inimigos ----------
  icon(e, kind) {
    const ic = e.rcIcons || (e.rcIcons = {});
    if (ic[kind]) return;
    const [ch, color] = ICON[kind];
    ic[kind] = iconSprite(ch, color, kind === 'inst' ? 1.1 : 0.85);
    this.c.scene.add(ic[kind]);
    this.iconE.add(e);
  }
  dropIcon(e, kind) {
    const ic = e.rcIcons;
    if (!ic || !ic[kind]) return;
    this.rm(ic[kind]); ic[kind] = null;
  }
  vulnerable(p, e, t, kind) {
    if (kind === 'vuln') { e.rcVulnT = t; e.rcVulnBy = p; } else { e.rcGrabT = t; e.rcGrabBy = p; }
    this.icon(e, kind);
    this.text('Vulnerável!', e.position, 'hurt', 3.0);
    this.c.vfx.sparks(v3(e.position.x, 1.6, e.position.z), 0xff7a3a, 8);
    this.log({ type: kind === 'vuln' ? 'rcVuln' : 'rcGrab', enemy: e });
  }

  // ---------- Antes do dano: multiplicador e crítico (ctx.crit = já ia ser crítico) ----------
  damage(p, e, step, ctx) {
    let mul = 1, crit = false;
    const w = W(p);
    if (!p || !p.hero || p.heroId !== 'rogue' || !anyRc(w)) return { mul, crit };
    const s = wpn(p), S = rcS(p), shot = this.c.rcShot, nat = !!ctx.crit;
    if (s === 'adagas' && !step.rogueExtra && !ctx.ranged) {
      if (w.rcEncad && S.chain > 0 && Math.random() < S.chain) crit = true; // Crítico Encadeado
      if (w.rcRolar && e.rcVulnT > 0 && e.rcVulnBy === p) { // Rolar e Cortar
        crit = true;
        if (nat) { mul *= 1 + lv(RC.rolar.crit, w.rcRolar); this.log({ type: 'rcVulnBonus', enemy: e }); }
      }
      if (w.rcPrimeiro && !(e.rcTouched && e.rcTouched.has(p))) { // Primeiro Sangue
        (e.rcTouched || (e.rcTouched = new Set())).add(p);
        if (Math.random() < lv(RC.primeiro, w.rcPrimeiro)) { crit = true; this.log({ type: 'rcFirstBlood', enemy: e }); }
      }
      if (w.rcCaca && e.type === 'mage') { crit = true; mul *= 1 + RC.caca[Math.min(3, w.rcCaca) - 1]; } // Caça-Magos
    }
    if (s === 'garras' && !ctx.ranged) {
      if (w.rcRasgo && p.hero.combo.indexOf(step) === 4) crit = true; // Rasgo Final
      if (w.rcUnhas && e.rcGrabT > 0 && e.rcGrabBy === p) { // Unhas Grudentas: gasta a marca
        e.rcGrabT = 0; this.dropIcon(e, 'grab');
        crit = true;
        if (nat) mul *= 1 + RC.unhas.crit;
        this.log({ type: 'rcGrabUse', enemy: e, nat });
      }
      if (w.rcPresa && (e.type === 'archer' || e.type === 'mage')) mul *= 1 + lv(RC.presa, w.rcPresa); // Presa Fácil
      if (w.rcInstinto && e.rcInstBy === p) { e.rcInstBy = null; e.rcInstT = 0; this.dropIcon(e, 'inst'); crit = true; this.log({ type: 'rcInstinctHit', enemy: e }); } // Instinto
    }
    if (s === 'rapieira' && !ctx.ranged) {
      if (w.rcAbertura && isStab(p, step) && e.hp >= e.maxHp && typeOk(ABERTURA, w.rcAbertura, e)) { crit = true; this.log({ type: 'rcOpening', enemy: e }); } // Estocada de Abertura
      if (w.rcSaudacao && S.salute && (S.saluteSeq === undefined || S.saluteSeq === p.swingSeq)) { // Saudação: vale para o 1º golpe
        S.saluteSeq = p.swingSeq;
        crit = true; mul *= 1 + lv(RC.saudacao.mul, w.rcSaudacao);
        this.log({ type: 'rcSaluteHit', enemy: e });
      }
      if (w.rcCicatriz && S.scar > 0 && Math.random() < S.scar) crit = true; // Cicatriz
    }
    if (s === 'kunai' && ctx.ranged && shot && shot.kind === 'kunai') {
      if (w.rcMira && e.rcKunBy === p && e.rcKunShot !== shot.id && this.t - e.rcKunAt <= RC.mira) { crit = true; this.log({ type: 'rcAimCrit', enemy: e }); } // Mira Treinada
      if (w.rcGemeas && shot.rcTwin) mul *= 1 + lv(RC.gemeas.mul, w.rcGemeas); // Lâminas Gêmeas
    }
    if (s === 'besta' && ctx.ranged && shot && shot.kind === 'bolt') {
      if (shot.rcFirst) { crit = true; mul *= 1 + lv(RC.tiro1.mul, w.rcTiro1); } // Primeiro Tiro
      if (w.rcDistante && shot.rcFx !== undefined) { // Tiro Distante
        const d = Math.hypot(e.position.x - shot.rcFx, e.position.z - shot.rcFz);
        mul *= 1 + lv(RC.distante.per, w.rcDistante) * Math.max(0, d - RC.distante.from);
      }
      if (w.rcDuelo && e.type === 'archer') mul *= 1 + lv(RC.duelo, w.rcDuelo); // Duelo de Besteiros
    }
    return { mul, crit };
  }

  // Toque Final (Rapieira): o inimigo comum com menos de 30% da vida morre com a estocada.
  beforeHit(p, e, step, nx, nz, opts) {
    const w = W(p);
    if (!w.rcToque || wpn(p) !== 'rapieira' || opts.ranged || opts.spell || !isStab(p, step) || e.data.boss || e.undead || !e.alive || e.hp >= e.maxHp * RC.toque) return false;
    return this.c.rogue2.execute(p, e, nx, nz, 'Toque Final!', 'rcTouche');
  }
  // Ponta Fina (Rapieira): a estocada passa pelo escudo (chamado só quando o escudo ia segurar).
  pierce(p, e, step, opts) {
    const w = W(p);
    if (!w.rcPonta || wpn(p) !== 'rapieira' || opts.ranged || opts.spell || !isStab(p, step)) return false;
    if (Math.random() >= lv(RC.ponta, w.rcPonta)) return false;
    this.text('Passou pelo escudo!', e.position, 'crit', 3.0);
    this.log({ type: 'rcPierce', enemy: e });
    return true;
  }
  // Esgrima Defensiva (Rapieira): durante a estocada, chance de desviar.
  fence(p, e, opts) {
    const w = W(p);
    if (!w.rcEsgrima || wpn(p) !== 'rapieira' || p.state !== 'attack' || p.xstep || opts.contact) return false;
    const step = p.hero.combo[p.combo];
    if (!step || step.cone || Math.random() >= lv(RC.esgrima, w.rcEsgrima)) return false;
    this.text('Desviou!', p.position, 'miss', 3.0);
    p.iframes = Math.max(p.iframes || 0, 0.2);
    audio.play('miss', p.position.x, p.position.z);
    this.log({ type: 'rcFence' });
    return true;
  }

  // ---------- Depois do dano (r: { dmg, died, crit, ranged, nx, nz }) ----------
  onHit(p, e, step, r) {
    const w = W(p);
    if (!p.hero || p.heroId !== 'rogue' || !anyRc(w)) return;
    const s = wpn(p), S = rcS(p), c = this.c, shot = c.rcShot;
    if (s === 'adagas' && !step.rogueExtra && !r.ranged) {
      if (w.rcEncad) { // Crítico Encadeado
        if (r.crit) { S.chain = Math.min(RC.encadeado.cap, S.chain + lv(RC.encadeado.per, w.rcEncad)); this.log({ type: 'rcChain', chain: S.chain }); }
        else S.chain = 0;
      }
      if (w.rcSeq && !r.died && p.hero.combo.indexOf(step) === 1 && Math.random() < lv(RC.sequencia, w.rcSeq)) { addBleed(c, p, e, 1); this.log({ type: 'rcSeqBleed', enemy: e }); } // Sequência Mortal
      if (w.rcVeneno && r.crit && !r.died) this.poison(p, e, lv(RC.veneno.dps, w.rcVeneno) * dm(p)); // Veneno Fraco
      if (w.rcMaos && r.crit && !e.rcPotion && Math.random() < lv(RC.maos, w.rcMaos)) this.dropPotion(e); // Mãos Ladras
      if (w.rcCaca && e.type === 'mage' && !r.died) this.interrupt(e, 0.6, 'Interrompido!'); // Caça-Magos
      if (w.rcDanca && S.danceSeq !== p.swingSeq) { // Dança Curta: conta golpes que acertam
        S.danceSeq = p.swingSeq;
        if (S.danceIgnore && step.heavy) S.danceIgnore = false;
        else if (++S.dance >= RC.danca && !S.danceReady) { S.danceReady = true; this.text('Dança Curta!', p.position, 'crit', 3.2); this.log({ type: 'rcDanceReady' }); }
      }
      return;
    }
    if (s === 'garras' && !r.ranged) {
      if (w.rcUnhas && !r.died && this.streak(p, e, 'rcGrab') >= RC.unhas.n && !(e.rcGrabT > 0)) { e.rcGrabN = 0; this.vulnerable(p, e, RC.unhas.t, 'grab'); } // Unhas Grudentas
      return;
    }
    if (s === 'rapieira' && !r.ranged) {
      if (w.rcDuelista && !r.died && this.streak(p, e, 'rcDuel') >= RC.duelista.n) { // Marca do Duelista
        e.rcDuelN = 0;
        if (e.offBalance && e.offBalance(r.nx, r.nz, lv(RC.duelista.t, w.rcDuelista), 3)) this.text('Desequilibrado!', e.position, 'hurt', 3.2);
        this.log({ type: 'rcDuelist', enemy: e });
      }
      if (w.rcCicatriz && r.died && r.crit) { // Cicatriz
        S.scar += lv(RC.cicatriz, w.rcCicatriz);
        this.text(`Cicatriz: +${Math.round(S.scar * 100)}% crítico`, p.position, 'crit', 3.0);
        this.log({ type: 'rcScar', scar: S.scar });
      }
      return;
    }
    if (s === 'kunai' && shot && shot.kind === 'kunai') {
      S.kMiss = 0;
      e.rcKunAt = this.t; e.rcKunShot = shot.id; e.rcKunBy = p; // Mira Treinada
      if (w.rcGelada && !r.died && shot.stack >= lv(RC.gelada.n, w.rcGelada)) this.chill(e); // Kunai Gelada
      if (w.rcExplo && shot.stack >= RC.explosiva.n) this.kunaiBoom(p, shot, e, lv(RC.explosiva.r, w.rcExplo)); // Corrente Explosiva
      return;
    }
    if (s === 'besta' && shot && shot.kind === 'bolt' && !shot.fake) {
      if (w.rcFarpa && !r.died) addBleed(c, p, e, Math.min(3, w.rcFarpa)); // Farpa
      if (w.rcDerruba) this.knockBehind(p, shot, e, lv(RC.derrubada.n, w.rcDerruba)); // Derrubada
      if (w.rcInterr && e.type === 'mage' && !r.died) this.interrupt(e, lv(RC.interromper, w.rcInterr), 'Sem magia!'); // Interromper
      if (w.rcTeimoso && !shot.rcBack && Math.random() < lv(RC.teimoso, w.rcTeimoso)) shot.rcBack = true; // Virote Teimoso
      if (w.rcIma && shot.rcMagSign && !shot.rcMagDone) this.magMark(p, shot, { e }); // Virote Magnético
    }
  }
  // Acertos seguidos no mesmo inimigo (1 por golpe; um golpe que não o acerta recomeça a conta).
  streak(p, e, key) {
    const seq = p.swingSeq;
    if (e[`${key}Seq`] === seq && e[`${key}P`] === p) return e[`${key}N`] || 0;
    const cont = e[`${key}Seq`] === seq - 1 && e[`${key}P`] === p;
    e[`${key}N`] = cont ? (e[`${key}N`] || 0) + 1 : 1;
    e[`${key}Seq`] = seq; e[`${key}P`] = p;
    return e[`${key}N`];
  }

  // ---------- Inimigo derrotado pelo Ladino ----------
  onKill(e, by) {
    const w = W(by);
    if (!by || !by.hero || by.heroId !== 'rogue' || !anyRc(w)) return;
    const s = wpn(by), S = rcS(by), c = this.c;
    if (s === 'adagas') {
      if (w.rcVeneno && e.poisonT > 0 && e.rcVenomBy === by) { // Veneno Fraco: passa para outro perto
        const o = this.nearest(e.position.x, e.position.z, RC.veneno.pass, e);
        if (o) {
          this.poison(by, o, e.rcVenomDps || RC.veneno.dps[0]);
          c.vfx.bolt(v3(e.position.x, 1.1, e.position.z), v3(o.position.x, 1.1, o.position.z), 0x7dff4a);
          this.log({ type: 'rcPoisonPass', from: e, to: o });
        }
      }
      if (w.rcSaida && by.state !== 'dead') { // Corte de Saída
        by.vanishT = Math.max(by.vanishT || 0, lv(RC.saida, w.rcSaida));
        c.vfx.smoke(v3(by.position.x, 0.6, by.position.z), 0x8a8f9c, 8);
        this.text('Sumiu!', by.position, 'miss', 3.0);
        this.log({ type: 'rcExitCut' });
      }
    }
    if (s === 'garras' && e.bleedStacks > 0) {
      if (w.rcLambida) { this.heal(by, lv(RC.lambida, w.rcLambida)); this.log({ type: 'rcLick' }); } // Lambida
      if (w.rcFera) { // Marca da Fera
        let n = 0;
        for (const o of this.foes()) {
          if (o === e || dist(o, e) > RC.fera.r + o.data.radius) continue;
          addBleed(c, by, o, Math.min(3, w.rcFera)); n++;
          c.vfx.bolt(v3(e.position.x, 1, e.position.z), v3(o.position.x, 1, o.position.z), 0xc8102e);
        }
        if (n) this.log({ type: 'rcBeastMark', n });
      }
    }
    if (s === 'rapieira' && w.rcFloreio) { // Floreio
      S.flourishT = RC.floreio.t; S.flourishMul = lv(RC.floreio.mul, w.rcFloreio);
      this.text('Floreio!', by.position, 'crit', 2.8);
      this.log({ type: 'rcFlourish' });
    }
  }

  // ---------- Herói tomou dano ----------
  onHurt(p) {
    const w = W(p);
    if (p.heroId !== 'rogue' || !anyRc(w)) return;
    const S = rcS(p);
    S.dance = 0; S.danceReady = false; // Dança Curta
    if (wpn(p) === 'garras' && w.rcPelagem && p.state !== 'dead') { // Pelagem Arrepiada
      if (!(S.furT > 0)) this.text('Pelagem arrepiada!', p.position, 'crit', 3.0);
      S.furT = lv(RC.pelagem.t, w.rcPelagem);
      this.log({ type: 'rcFur' });
    }
  }

  // ---------- Efeitos ----------
  poison(p, e, dps) { // Veneno Fraco (usa o veneno das Duas Adagas)
    this.c.rogue2.poison(e, p, RC.veneno.t);
    e.poisonDps = Math.max(e.poisonDps || 0, dps);
    e.rcVenomBy = p; e.rcVenomDps = dps;
    this.log({ type: 'rcPoison', enemy: e, dps });
  }
  dropPotion(e) { // Mãos Ladras
    e.rcPotion = true;
    const pos = v3(e.position.x, 0, e.position.z);
    if (this.c.props && this.c.props.onDrop) this.c.props.onDrop(pos);
    else this.text('Poção!', pos, 'heal', 3);
    this.c.vfx.sparks(v3(pos.x, 1.2, pos.z), 0xe2384b, 10);
    this.log({ type: 'rcPotion', enemy: e });
  }
  interrupt(e, t, label) { // Caça-Magos / Interromper
    const casting = e.state === 'aim' || e.state === 'revive' || e.state === 'cast';
    if (casting && e.daze) e.daze(0.3);
    e.kcSilT = Math.max(e.kcSilT || 0, t); // o kit do Cavaleiro segura a recarga enquanto durar
    e.cooldown = Math.max(e.cooldown || 0, t);
    if (e.cd && e.cd.revive !== undefined) e.cd.revive = Math.max(e.cd.revive, t);
    this.text(casting ? 'Interrompido!' : label, e.position, 'miss', 3.2);
    this.c.vfx.sparks(v3(e.position.x, 2.0, e.position.z), 0xc890ff, 10);
    this.log({ type: 'rcInterrupt', enemy: e, t, casting });
  }
  chill(e) { // Kunai Gelada: MUITO lento
    if (!(e.rcIceT > 0)) this.text('Muito lento!', e.position, 'block', 3.0);
    e.rcIceT = RC.gelada.t; e.slow = Math.max(e.slow || 0, RC.gelada.t);
    this.c.vfx.sparks(v3(e.position.x, 1, e.position.z), 0x9fe8ff, 10);
    this.log({ type: 'rcIce', enemy: e });
  }
  kunaiBoom(p, it, e, r) { // Corrente Explosiva
    const c = this.c, at = v3(e.position.x, 0, e.position.z);
    const dmg = Math.max(1, Math.round(c.rogue.kunaiDamage(p, it.stack) * RC.explosiva.mul * dm(p)));
    c.vfx.heavyImpact(at, r / 2);
    c.vfx.ring(at, 0x6fe3ff, r);
    c.vfx.sparks(v3(at.x, 1, at.z), 0xbff4ff, 16);
    audio.play('boom', at.x, at.z, { v: 0.6 });
    let n = 0;
    for (const o of this.foes()) {
      if (o === e || dist(o, e) > r + o.data.radius) continue;
      const dx = o.position.x - at.x, dz = o.position.z - at.z, d = Math.hypot(dx, dz) || 1;
      c.bonusDamage(o, dmg, dx / d, dz / d, 'dmg', p); n++;
    }
    this.log({ type: 'rcKunaiBoom', n, dmg, r });
  }
  knockBehind(p, it, e, n) { // Derrubada: derruba quem está logo atrás
    const sp = Math.hypot(it.vx, it.vz) || 1, dx = it.vx / sp, dz = it.vz / sp, D = RC.derrubada;
    const cand = [];
    for (const o of this.foes()) {
      if (o === e) continue;
      const rx = o.position.x - e.position.x, rz = o.position.z - e.position.z;
      const along = rx * dx + rz * dz, side = Math.abs(rx * dz - rz * dx);
      if (along > 0 && along <= D.len && side <= D.w + o.data.radius) cand.push([along, o]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    let k = 0;
    for (const [, o] of cand.slice(0, n)) {
      if (o.offBalance && o.offBalance(dx, dz, D.t, 6)) { this.text('Derrubado!', o.position, 'hurt', 3.0); k++; }
    }
    if (k) this.log({ type: 'rcKnock', n: k });
  }

  // ---------- Rolamento (player.js) ----------
  dodge(p, phase) {
    const w = W(p);
    if (p.heroId !== 'rogue' || !anyRc(w)) return;
    const S = rcS(p), s = wpn(p);
    if (phase === 'start') {
      S.crossed = new Set(); S.firstDone = false; S.side = null; S.sideD = 99; S.arrows = new Set();
      if (s === 'kunai' && w.rcAssobio) this.whistle(p, S, w);
      return;
    }
    if (s === 'rapieira' && w.rcContorno && S.side) this.contour(p, S.side, w.rcContorno);
    S.crossed = null; S.side = null; S.arrows = null;
  }
  rollTick(p, S, w, s) {
    for (const e of this.foes()) {
      const d = dist(e, p);
      if (s === 'rapieira' && w.rcContorno && d <= RC.contorno.r + e.data.radius && d < S.sideD && typeOk(CONTORNO, w.rcContorno, e)) { S.side = e; S.sideD = d; } // Contorno
      if (S.crossed.has(e) || d > e.data.radius + p.hero.radius + 0.25) continue;
      S.crossed.add(e);
      const first = !S.firstDone;
      S.firstDone = true;
      if (s === 'adagas' && w.rcRolar && first) this.vulnerable(p, e, lv(RC.rolar.t, w.rcRolar), 'vuln'); // Rolar e Cortar
      if (s === 'rapieira' && w.rcLuz && first && this.c.rogue2.lose(e, lv(RC.luz, w.rcLuz), p.position)) this.log({ type: 'rcLight', enemy: e }); // Velocidade da Luz
      if (s === 'garras' && w.rcFelino && !S.felino) { S.felino = true; this.text('Salto Felino!', p.position, 'crit', 2.8); this.log({ type: 'rcFeline' }); } // Salto Felino
    }
    if (s === 'adagas' && w.rcEsquiva) { // Esquiva Afiada: rolou por dentro de uma flecha
      for (const a of this.c.projectiles.list) {
        if (!a || a.hits !== 'player' || a.kind !== 'arrow' || a.stuck >= 0 || S.arrows.has(a)) continue;
        if (Math.hypot(a.x - p.position.x, a.z - p.position.z) > RC.esquiva.r) continue;
        S.arrows.add(a);
        const src = a.owner;
        if (src && src.alive && src.targetable && !src.undead && this.c.enemies.includes(src)) this.throwKnife(p, src, lv(RC.esquiva.dmg, w.rcEsquiva));
      }
    }
  }
  throwKnife(p, e, dmg) {
    const g = flyingBlade(undefined, 0.9, 0xbfe6ff);
    const x = p.position.x, z = p.position.z;
    g.position.set(x, 1.3, z);
    this.c.scene.add(g);
    this.knives.push({ g, x, z, e, p, dmg: Math.max(1, Math.round(dmg * dm(p))), life: 2 });
    audio.play('swing', x, z, { v: 0.8 });
    this.text('Adaga!', p.position, 'crit', 2.8);
    this.log({ type: 'rcKnife', enemy: e });
  }
  contour(p, e, n) { // Contorno: termina nas costas do inimigo
    if (!e.alive || !e.targetable) return;
    const fx = Math.sin(e.facing), fz = Math.cos(e.facing), back = e.data.radius + p.hero.radius + RC.contorno.gap;
    const v = v3(e.position.x - fx * back, 0, e.position.z - fz * back);
    const w = this.c.world;
    if (w) { w.resolveCircle(v, p.hero.radius); if (w.clampInside) w.clampInside(v, p.hero.radius); }
    this.c.vfx.puff(v3(p.position.x, 0, p.position.z));
    p.position.x = v.x; p.position.z = v.z;
    p.facing = Math.atan2(e.position.x - v.x, e.position.z - v.z);
    if (p.group) p.group.rotation.y = p.facing;
    if (n >= 3) p.iframes = Math.max(p.iframes || 0, RC.contorno.inv);
    this.c.vfx.sparks(v3(v.x, 1, v.z), 0xffe27a, 10);
    this.text('Contorno!', p.position, 'crit', 3.0);
    this.log({ type: 'rcContour', enemy: e });
  }
  whistle(p, S, w) { // Assobio: rolar sem kunais na mão
    if (p.ammo && p.ammo.length) return;
    if (S.whistles >= lv(RC.assobio, w.rcAssobio)) return;
    const R = this.c.rogue;
    if (!R || !R.items.some((it) => it.owner === p && it.kind === 'kunai' && ['ground', 'pop', 'fly', 'stuck'].includes(it.state))) return;
    S.whistles++;
    R.k2.pullAll(p);
    for (const it of R.items) if (it.owner === p && it.state === 'pull') it.rcWhistle = true; // voltam sem cortar ninguém
    this.text('♪ Assobio!', p.position, 'gold', 3.4);
    audio.play('gold', p.position.x, p.position.z, { v: 0.8 });
    this.log({ type: 'rcWhistle', left: lv(RC.assobio, w.rcAssobio) - S.whistles });
  }

  // ---------- Começo do ataque (player.js) ----------
  // Dança Curta: o 5º golpe vira o golpe forte (antes de escolher o golpe).
  pickCombo(p) {
    if (wpn(p) !== 'adagas' || !W(p).rcDanca) return;
    const S = rcS(p);
    if (!S.danceReady || p.combo === p.hero.heavyIdx) return;
    p.combo = p.hero.heavyIdx;
    S.danceReady = false; S.dance = 0; S.danceIgnore = true;
    this.log({ type: 'rcDance' });
  }
  // Velocidade só deste golpe: Salto Felino, Cheiro de Sangue, Coleta Ligeira.
  onStart(p, step) {
    p.rcStepMul = 1;
    const w = W(p);
    if (p.heroId !== 'rogue' || !anyRc(w)) return;
    const s = wpn(p), S = rcS(p);
    if (s === 'garras') {
      if (w.rcFelino && S.felino) { S.felino = false; p.rcStepMul *= 1 + RC.felino; this.log({ type: 'rcFelineHit' }); }
      if (w.rcCheiro) {
        const t = this.frontFoe(p);
        if (t && t.bleedStacks > 0) { p.rcStepMul *= 1 + lv(RC.cheiro, w.rcCheiro); this.log({ type: 'rcScent', enemy: t }); }
      }
    }
    if (s === 'besta' && step.throw === 'bolt' && S.fastShot) { S.fastShot = false; p.rcStepMul *= RC.coleta.mul; this.log({ type: 'rcFastShot' }); }
  }
  frontFoe(p) {
    const range = p.hero.attackRange * (p.stats.rangeMul || 1) + 0.6;
    let best = null, bd = 99;
    for (const e of this.foes()) {
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz);
      if (d > range + e.data.radius || Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) > 70 * DEG) continue;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  atkMul(p) {
    let m = p.rcStepMul || 1;
    const S = p.rcs;
    if (S && S.furT > 0 && wpn(p) === 'garras' && W(p).rcPelagem) m *= 1 + RC.pelagem.mul; // Pelagem Arrepiada
    return m;
  }
  moveMul(p) {
    const S = p.rcs;
    return S && S.flourishT > 0 && wpn(p) === 'rapieira' ? 1 + S.flourishMul : 1; // Floreio
  }

  // ---------- Kunais e virotes (rogue.js) ----------
  onFire(p, it) {
    const w = W(p);
    if (p.heroId !== 'rogue') return;
    const S = rcS(p);
    it.rcFx = it.x; it.rcFz = it.z;
    if (it.kind === 'kunai') {
      if (w.rcGemeas && this.t - S.lastThrow < RC.gemeas.t) { it.rcTwin = true; this.log({ type: 'rcTwin' }); } // Lâminas Gêmeas
      S.lastThrow = this.t;
      return;
    }
    if (w.rcTiro1 && S.firstShot) { it.rcFirst = true; this.log({ type: 'rcFirstShot' }); } // Primeiro Tiro
    S.firstShot = false;
    if (w.rcIma) { S.magN++; it.rcMagSign = S.magN % 2 === 1 ? 1 : -1; } // Virote Magnético: + e depois −
  }
  catchBonus(p) { // Pegada Rápida
    if (wpn(p) !== 'kunai' || !W(p).rcPegada) return 0;
    this.log({ type: 'rcQuickCatch' });
    return 1;
  }
  // Uma kunai errou (parede ou fim do voo, sem acertar ninguém). true = Corrente Viva segura a corrente.
  keepChain(it) {
    const p = it.owner, w = W(p);
    if (wpn(p) !== 'kunai') return false;
    const S = rcS(p);
    S.kMiss++;
    if (!w.rcViva || !(it.stack > 0) || S.kMiss > lv(RC.viva, w.rcViva)) return false;
    this.text('Corrente viva!', v3(it.x, 0, it.z), 'crit', 2.8);
    this.log({ type: 'rcKeepChain', miss: S.kMiss });
    return true;
  }
  // Item caiu no chão (fim de toGround). before = corrente antes de cair.
  onGround(it, why, before) {
    const p = it.owner, w = W(p);
    if (!p || p.heroId !== 'rogue') return;
    it.rcLandT = this.t;
    if (it.kind === 'kunai') {
      if (it.rcExtra && before > 0 && !(it.stack > 0)) this.vanishExtra(it); // Estoque Escondido: a corrente zerou
      return;
    }
    if (w.rcIma && it.rcMagSign && !it.rcMagDone) this.magMark(p, it, { x: it.x, z: it.z }); // Virote Magnético: parede/chão
    if (it.rcBack) { // Virote Teimoso: volta direto para a mão
      const R = this.c.rogue, i = R.items.indexOf(it);
      if (i >= 0 && wpn(p) === 'besta' && p.state !== 'dead') {
        this.c.vfx.bolt(v3(it.x, 0.6, it.z), v3(p.position.x, 1.2, p.position.z), 0xffc46a);
        R.pickUp(it, i, p);
        this.text('Voltou!', p.position, 'crit', 2.8);
        this.log({ type: 'rcBoltBack' });
      }
    }
  }
  onPick(p, it) { // Coleta Ligeira
    const w = W(p);
    if (it.kind !== 'bolt' || wpn(p) !== 'besta' || !w.rcColeta) return;
    const S = rcS(p);
    if (it.rcLandT === undefined || this.t - it.rcLandT > RC.coleta.win || S.quick >= lv(RC.coleta.n, w.rcColeta)) return;
    S.quick++; S.fastShot = true;
    this.text('Coleta ligeira!', p.position, 'crit', 2.8);
    this.log({ type: 'rcQuickPick', n: S.quick });
  }
  onRefill(p) { // Estoque Escondido: 1 kunai extra no começo da sala
    if (wpn(p) !== 'kunai' || !W(p).rcEstoque || !p.ammo) return;
    p.ammo.push({ stack: 0, rcExtra: true });
    this.text('+1 kunai escondida', p.position, 'gold', 3.0);
    this.log({ type: 'rcExtra' });
  }
  onStreakBreak(p) { // tomou dano: a kunai extra com corrente some
    if (!p.ammo) return;
    const n0 = p.ammo.length;
    p.ammo = p.ammo.filter((c) => !(c.rcExtra && c.stack > 0));
    if (p.ammo.length < n0) { this.text('A kunai extra sumiu', p.position, 'miss', 2.8); this.log({ type: 'rcExtraGone' }); }
    const R = this.c.rogue;
    if (R) for (const it of [...R.items]) if (it.owner === p && it.rcExtra && it.stack > 0 && ['fly', 'pop', 'ground'].includes(it.state)) this.vanishExtra(it);
  }
  vanishExtra(it) {
    const R = this.c.rogue, i = R.items.indexOf(it);
    if (i < 0) return;
    this.c.vfx.puff(v3(it.x, 0.3, it.z));
    this.text('A kunai extra sumiu', v3(it.x, 0, it.z), 'miss', 2.8);
    R.drop(i);
    it.state = 'gone';
    this.log({ type: 'rcExtraGone' });
  }
  // Prego no Escudo: a kunai bateu no escudo.
  nail(it, e) {
    const p = it.owner, w = W(p);
    if (!w.rcPrego || wpn(p) !== 'kunai' || !e.data.shield || e.shieldBroken || !e.alive) return;
    e.rcNails = (e.rcNails || 0) + 1;
    this.log({ type: 'rcNail', enemy: e, n: e.rcNails });
    if (e.rcNails >= lv(RC.prego, w.rcPrego)) {
      const sp = Math.hypot(it.vx, it.vz) || 1;
      this.c.breakEnemyShield(e, it.vx / sp, it.vz / sp, p);
      this.log({ type: 'rcNailBreak', enemy: e });
      return;
    }
    it.rcNailed = e;
    this.text('Cravou no escudo!', e.position, 'block', 2.8);
  }

  // ---------- Virote Magnético ----------
  magMark(p, it, tgt) {
    it.rcMagDone = true;
    const S = rcS(p), sign = it.rcMagSign || 1;
    const icon = iconSprite(sign > 0 ? '+' : '−', sign > 0 ? 0xff4a3a : 0x4aa0ff, 1.5);
    const m = { sign, e: tgt.e || null, x: tgt.e ? tgt.e.position.x : tgt.x, z: tgt.e ? tgt.e.position.z : tgt.z, icon };
    icon.position.set(m.x, m.e ? 2.9 : 0.9, m.z);
    this.c.scene.add(icon);
    if (sign > 0) { for (const o of S.mag) this.rm(o.icon); S.mag = []; }
    S.mag.push(m);
    this.log({ type: 'rcMagMark', sign, enemy: m.e });
    if (sign < 0) this.magFire(p, S);
  }
  magFire(p, S) {
    const A = S.mag.find((m) => m.sign > 0), B = S.mag.find((m) => m.sign < 0);
    for (const m of S.mag) this.rm(m.icon);
    S.mag = [];
    if (!A || !B) return;
    const c = this.c, I = RC.ima, dmg = Math.max(1, Math.round(I.dmg * dm(p)));
    const live = (m) => (m.e && m.e.alive && m.e.targetable ? m.e : null);
    const pos = (m) => (m.e ? { x: m.e.position.x, z: m.e.position.z } : { x: m.x, z: m.z });
    const a = live(A), b = live(B), pa = pos(A), pb = pos(B);
    c.vfx.bolt(v3(pa.x, 1, pa.z), v3(pb.x, 1, pb.z), 0xc080ff);
    audio.play('thunder', (pa.x + pb.x) / 2, (pa.z + pb.z) / 2, { v: 0.4 });
    let mode;
    if (a && b && a !== b) { // dois inimigos: se atraem, batem e caem
      mode = 'enemies';
      const mx = (pa.x + pb.x) / 2, mz = (pa.z + pb.z) / 2;
      for (const [e, o] of [[a, b], [b, a]]) {
        const dx = o.position.x - e.position.x, dz = o.position.z - e.position.z, d = Math.hypot(dx, dz) || 1;
        this.pull(e, mx - dx / d * e.data.radius, mz - dz / d * e.data.radius, dmg, p, dx / d, dz / d);
      }
    } else if (a && b) { mode = 'same'; this.slam(a, dmg, p, 0, 1); } // o mesmo inimigo duas vezes
    else if (a || b) { // inimigo e parede: ele voa até a marca
      mode = 'wall';
      const e = a || b, P = a ? pb : pa;
      const dx = P.x - e.position.x, dz = P.z - e.position.z, d = Math.hypot(dx, dz) || 1;
      const stop = Math.max(0, d - e.data.radius - 0.2);
      this.pull(e, e.position.x + dx / d * stop, e.position.z + dz / d * stop, dmg, p, dx / d, dz / d);
    } else { // duas paredes: puxa para o meio quem estiver entre elas
      mode = 'walls';
      this.zones.push({ ax: pa.x, az: pa.z, bx: pb.x, bz: pb.z, t: I.holdT, p, n: 0 });
    }
    this.text('Ímãs!', p.position, 'crit', 3.0);
    this.log({ type: 'rcMagnet', mode });
  }
  pull(e, tx, tz, dmg, p, nx, nz) {
    e.releaseToken && e.releaseToken();
    this.pulls.push({ e, fx: e.position.x, fz: e.position.z, tx, tz, t: 0, T: RC.ima.pullT, dmg, p, nx, nz });
  }
  slam(e, dmg, p, nx, nz) {
    if (!e.alive) return;
    this.c.bonusDamage(e, dmg, nx, nz, 'dmg', p);
    this.c.vfx.sparks(v3(e.position.x, 1.1, e.position.z), 0xc080ff, 12);
    if (e.alive && e.offBalance && e.offBalance(nx, nz, RC.ima.fall, 2)) this.text('Caiu!', e.position, 'hurt', 3.0);
    this.log({ type: 'rcSlam', enemy: e });
  }

  // ---------- Golpe a esmo dos cegos (roguekit.js): Virote Brilhante ----------
  blindSwing(e) {
    if (!e.rcGlowBlind || !(e.blindT > 0)) return;
    const a = e.data.attack || {}, reach = (a.reach || 1.8) + 0.5;
    let best = null, bd = 99;
    for (const o of this.foes()) {
      if (o === e) continue;
      const d = dist(o, e);
      if (d <= reach + o.data.radius && d < bd) { bd = d; best = o; }
    }
    if (!best || Math.random() < 0.35) return; // às vezes ataca o vento
    const dx = best.position.x - e.position.x, dz = best.position.z - e.position.z, d = Math.hypot(dx, dz) || 1;
    e.facing = Math.atan2(dx, dz); e.group.rotation.y = e.facing;
    const dmg = Math.max(1, Math.round((a.damage || e.damage || 5) * (e.dmgScale || 1)));
    this.c.bonusDamage(best, dmg, dx / d, dz / d, 'dmg', null);
    this.text('Golpe cego!', best.position, 'hurt', 2.8);
    this.log({ type: 'rcBlindHit', enemy: best, dmg });
  }

  // ---------- Começo de cada sala (run.js) ----------
  roomStart() {
    for (const p of this.players) {
      if (p.heroId !== 'rogue') continue;
      const S = rcS(p);
      S.whistles = 0; S.quick = 0; S.firstShot = true; S.scar = 0; S.kMiss = 0;
      S.salute = false; S.saluteOpen = true; S.saluteSeq = undefined; S.still = 0;
      for (const m of S.mag) this.rm(m.icon);
      S.mag = [];
    }
  }

  // ---------- A cada quadro ----------
  tick(dt) {
    this.t += dt;
    for (const p of this.players) {
      if (!p.rcs && !anyRc(W(p))) continue;
      const S = rcS(p), w = W(p), s = wpn(p);
      if (S.furT > 0) S.furT -= dt;
      if (S.flourishT > 0) S.flourishT -= dt;
      if (S.crossed && p.state === 'dodge') this.rollTick(p, S, w, s);
      if (s === 'rapieira' && w.rcSaudacao) this.saluteTick(p, S, dt);
      if (S.salute && S.saluteSeq !== undefined && p.swingSeq !== S.saluteSeq) { S.salute = false; S.saluteSeq = undefined; }
      if (s === 'garras' && w.rcInstinto && p.state !== 'dead') this.instinctTick(p);
      for (const m of S.mag) if (m.e && m.e.alive) { m.x = m.e.position.x; m.z = m.e.position.z; m.icon.position.set(m.x, 2.9 + 0.1 * Math.sin(this.t * 5), m.z); }
    }
    this.tickEnemies(dt);
    this.tickItems(dt);
    this.tickKnives(dt);
    this.tickPulls(dt);
  }
  saluteTick(p, S, dt) { // Saudação: parado 1 s antes da 1ª onda
    if (!S.saluteOpen || S.salute) return;
    if (this.c.enemies.some((e) => e.alive && !e.undead)) { S.saluteOpen = false; return; }
    S.still = p.state === 'idle' ? S.still + dt : 0;
    if (S.still < RC.saudacao.still) return;
    S.salute = true; S.saluteOpen = false; S.saluteSeq = undefined;
    this.text('Saudação!', p.position, 'crit', 3.4);
    this.c.vfx.sparks(v3(p.position.x, 2.2, p.position.z), 0xffe27a, 14);
    audio.play('gold', p.position.x, p.position.z, { v: 0.6 });
    this.log({ type: 'rcSalute' });
  }
  instinctTick(p) { // Instinto: inimigo preparando golpe atrás do Ladino
    for (const e of this.c.enemies) {
      if (!e.alive || e.undead || e.rcInstBy === p || e.target !== p || !WIND.has(e.state) || (e.state === 'attack' && e.hitDone)) continue;
      const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z;
      if (Math.hypot(dx, dz) > RC.instinto.range || Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) < RC.instinto.back * DEG) continue;
      e.rcInstBy = p; e.rcInstT = 3;
      this.icon(e, 'inst');
      this.text('!', p.position, 'hurt', 4.2);
      audio.play('block', p.position.x, p.position.z, { v: 0.4 });
      this.log({ type: 'rcInstinct', enemy: e });
    }
  }
  tickEnemies(dt) {
    const c = this.c;
    for (const e of c.enemies) {
      if (e.rcVulnT > 0 && ((e.rcVulnT -= dt) <= 0 || !e.alive)) { e.rcVulnT = 0; this.dropIcon(e, 'vuln'); }
      if (e.rcGrabT > 0 && ((e.rcGrabT -= dt) <= 0 || !e.alive)) { e.rcGrabT = 0; this.dropIcon(e, 'grab'); }
      if (e.rcInstT > 0 && ((e.rcInstT -= dt) <= 0 || !e.alive)) { e.rcInstT = 0; e.rcInstBy = null; this.dropIcon(e, 'inst'); }
      if (e.rcIceT > 0) e.rcIceT -= dt;
      if (e.rcBlindCd > 0) e.rcBlindCd -= dt;
      if (e.rcGlowBlind && !(e.blindT > 0)) e.rcGlowBlind = false;
      // Sangue Fervente (Garras): 3+ sangramentos = dano por segundo.
      const by = e.bleedBy;
      if (e.alive && e.targetable && e.bleedStacks >= RC.fervente.min && wpn(by) === 'garras' && W(by).rcFervente) {
        e.rcBoilT = (e.rcBoilT || 0) + dt;
        if (Math.random() < dt * 4) c.vfx.sparks(v3(e.position.x, 1.4, e.position.z), 0xff3a2a, 1);
        if (e.rcBoilT >= 1) {
          e.rcBoilT = 0;
          c.bonusDamage(e, Math.max(1, Math.round(lv(RC.fervente.dps, W(by).rcFervente) * dm(by))), 0, 0, 'bleed', by, true);
          this.log({ type: 'rcBoil', enemy: e });
        }
      } else e.rcBoilT = 0;
    }
    for (const e of [...this.iconE]) {
      const ic = e.rcIcons;
      const gone = !c.enemies.includes(e) || !e.alive;
      if (!ic) { this.iconE.delete(e); continue; }
      let any = false;
      for (const k of Object.keys(ic)) {
        const s = ic[k];
        if (!s) continue;
        if (gone) { this.rm(s); ic[k] = null; continue; }
        any = true;
        s.position.set(e.position.x, ICON[k][2] * (e.group.scale.y || 1) + 0.12 * Math.sin(this.t * 6), e.position.z);
      }
      if (!any) this.iconE.delete(e);
    }
  }
  tickItems(dt) {
    const R = this.c.rogue;
    const seen = new Set();
    if (R) for (const it of R.items) {
      const p = it.owner, w = W(p);
      if (it.rcNailed) { // Prego no Escudo: a kunai acompanha o escudo
        const e = it.rcNailed;
        if (it.state !== 'ground' || !e.alive || e.shieldBroken || !this.c.enemies.includes(e)) {
          it.rcNailed = null;
          if (it.state === 'ground') it.g.position.y = 0.18;
        } else {
          const a = e.facing + 0.6;
          it.x = e.position.x + Math.sin(a) * (e.data.radius + 0.15); it.z = e.position.z + Math.cos(a) * (e.data.radius + 0.15);
          it.g.position.set(it.x, 1.15, it.z); it.g.rotation.y = e.facing + Math.PI;
          if (it.mark) it.mark.position.set(it.x, 0.09, it.z);
        }
      }
      if (it.state !== 'ground' || it.rcNailed) continue;
      if (it.kind === 'kunai' && wpn(p) === 'kunai' && w.rcMaldita) { // Adaga Amaldiçoada: afasta os inimigos
        seen.add(it); this.itemGlow(it, 0x7a20ff, 2.2);
        const M = RC.maldita;
        if (Math.random() < dt * 6) this.c.vfx.sparks(v3(it.x + (Math.random() - 0.5), 0.5, it.z + (Math.random() - 0.5)), 0xb060ff, 1);
        if (Math.random() < dt * 3) this.c.vfx.smoke(v3(it.x, 0.3, it.z), 0x7a20ff, 2); // fumaça roxa da maldição
        for (const e of this.foes()) {
          const dx = e.position.x - it.x, dz = e.position.z - it.z, d = Math.hypot(dx, dz) || 0.01;
          if (d > M.r + e.data.radius || e.data.boss) continue;
          const k = M.push * dt * (1.2 - d / (M.r + e.data.radius));
          e.position.x += dx / d * k; e.position.z += dz / d * k;
          if (this.c.world) this.c.world.resolveCircle(e.position, e.data.radius);
          if (!it.rcCursed) { it.rcCursed = true; this.log({ type: 'rcCurse', enemy: e }); }
        }
      }
      if (it.kind === 'bolt' && wpn(p) === 'besta' && w.rcBrilho) { // Virote Brilhante: cega quem está perto
        seen.add(it); this.itemGlow(it, 0xffe27a, 2.2);
        const B = RC.brilho;
        for (const e of this.foes()) {
          if (e.data.boss || e.rcBlindCd > 0 || e.blindT > 0 || dist(e, { position: { x: it.x, z: it.z } }) > B.r + e.data.radius) continue;
          const t = lv(B.t, w.rcBrilho);
          this.c.rogue2.blind(e, t);
          e.rcGlowBlind = true; e.rcBlindCd = t + B.cd;
          this.log({ type: 'rcGlowBlind', enemy: e });
        }
      }
    }
    for (const [it, g] of this.glows) {
      if (seen.has(it)) { g.position.set(it.x, 0.5, it.z); g.material.opacity = 0.55 + 0.25 * Math.sin(this.t * 5); continue; }
      this.rm(g); this.glows.delete(it);
    }
  }
  itemGlow(it, color, size) {
    if (this.glows.has(it)) return;
    const g = glowSprite(color, size, 0.7);
    this.c.scene.add(g);
    this.glows.set(it, g);
  }
  tickKnives(dt) { // Esquiva Afiada
    for (let i = this.knives.length - 1; i >= 0; i--) {
      const k = this.knives[i], e = k.e;
      k.life -= dt;
      const tx = e.position.x, tz = e.position.z;
      const dx = tx - k.x, dz = tz - k.z, d = Math.hypot(dx, dz) || 0.01;
      const st = Math.min(d, RC.esquiva.speed * dt);
      k.x += dx / d * st; k.z += dz / d * st;
      k.g.position.set(k.x, 1.3, k.z);
      k.g.rotation.y = Math.atan2(dx, dz);
      const hit = e.alive && e.targetable && d <= e.data.radius + 0.35;
      if (hit) { this.c.bonusDamage(e, k.dmg, dx / d, dz / d, 'dmg', k.p); this.c.vfx.sparks(v3(k.x, 1.3, k.z), 0xffffff, 8); this.log({ type: 'rcKnifeHit', enemy: e, dmg: k.dmg }); }
      if (hit || k.life <= 0 || !e.alive) { this.rm(k.g); this.knives.splice(i, 1); }
    }
  }
  tickPulls(dt) { // Virote Magnético
    for (let i = this.pulls.length - 1; i >= 0; i--) {
      const q = this.pulls[i], e = q.e;
      q.t += dt;
      if (!e.alive) { this.pulls.splice(i, 1); continue; }
      const k = Math.min(1, q.t / q.T);
      e.vel.set(0, 0, 0);
      e.position.x = q.fx + (q.tx - q.fx) * k; e.position.z = q.fz + (q.tz - q.fz) * k;
      if (Math.random() < 0.5) this.c.vfx.sparks(v3(e.position.x, 1, e.position.z), 0xc080ff, 1);
      if (k < 1) continue;
      this.pulls.splice(i, 1);
      if (this.c.world) this.c.world.resolveCircle(e.position, e.data.radius);
      this.slam(e, q.dmg, q.p, q.nx, q.nz);
    }
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t -= dt;
      if (z.t <= 0) { this.zones.splice(i, 1); this.log({ type: 'rcMagZoneEnd', n: z.n }); continue; }
      const mx = (z.ax + z.bx) / 2, mz = (z.az + z.bz) / 2;
      if (Math.random() < dt * 10) this.c.vfx.bolt(v3(z.ax, 0.8, z.az), v3(z.bx, 0.8, z.bz), 0xc080ff);
      for (const e of this.foes()) {
        if (segDist(e.position.x, e.position.z, z.ax, z.az, z.bx, z.bz) > RC.ima.segR + e.data.radius) continue;
        if (!e.rcZoneHit) { e.rcZoneHit = true; z.n++; }
        const dx = mx - e.position.x, dz = mz - e.position.z, d = Math.hypot(dx, dz);
        if (d < 0.3) continue;
        const st = Math.min(d, 7 * dt);
        e.position.x += dx / d * st; e.position.z += dz / d * st;
        if (this.c.world) this.c.world.resolveCircle(e.position, e.data.radius);
      }
    }
  }

  clear() {
    for (const k of this.knives) this.rm(k.g);
    for (const g of this.glows.values()) this.rm(g);
    for (const e of this.iconE) if (e.rcIcons) for (const k of Object.keys(e.rcIcons)) { this.rm(e.rcIcons[k]); e.rcIcons[k] = null; }
    this.knives = []; this.pulls = []; this.zones = [];
    this.glows.clear(); this.iconE.clear();
    for (const p of this.players) if (p.rcs) { for (const m of p.rcs.mag) this.rm(m.icon); p.rcs.mag = []; }
  }
}

// Ganchos do herói (player.js).
export function rcDodge(p, phase) { if (C) C.dodge(p, phase); }
export function rcPickCombo(p) { if (C) C.pickCombo(p); }
export function rcOnStart(p, step) { if (C) C.onStart(p, step); else p.rcStepMul = 1; }
export function rcAtkMul(p) { return C ? C.atkMul(p) : 1; }
export function rcMoveMul(p) { return C ? C.moveMul(p) : 1; }
export function rcReset(p) { p.rcs = null; p.rcStepMul = 1; }
