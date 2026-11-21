// Bênçãos ÉPICAS, lote 2 (lista do dono, 11/11/2026): os efeitos — as 8 do Ladino.
// Dados e textos em e2bless.js (números em E2). combat.e2 = E2Kit. Partes do herói (estados e2Snipe / e2Ghost,
// velocidade da fera, crânio do Disfarce) ficam nas funções exportadas no fim.
// Ganchos: wbhooks (damage/onHit/onKill), combat (tick, clear, foeScale, onHurt, loveTarget), rogue.js (onCatch,
// onBoltHit, onBoltEnd), player.js (estados, velocidade, invencível, reset), run.js (roomStart), main.js (camFocus).
import * as THREE from 'three';
import { audio } from './audio.js';
import { E2 } from './e2bless.js';
import { fear } from './axekit3.js';
import { setFlash } from './characters.js';
import { wearSkull, headMark, animMark, dropMark, makeCrosshair, shotLine, bulletUi, moonUi, sniperUi, hideAllUi } from './e2props.js';

const W = (p) => (p && p.stats && p.stats.w) || {};
const wpn = (p, hero, id) => !!(p && p.heroId === hero && p.hero && p.hero.weaponId === id);
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const e2S = (p) => p.e2s || (p.e2s = {
  disguise: null, disgWave: null, disgSeq: -1, disgCd: 0,         // Disfarce
  catches: [], btWave: null,                                     // Tempo de Bala
  moonK: 0, beastT: 0, beastK: 1, fearCd: 0, healSeq: -1,         // Lua Cheia
  regen: [], regenAcc: 0, regenShown: 0, regenShowT: 0,           // Regeneração
  destWave: null, ghost: null,                                   // Destruição
  snKills: 0, snPending: false, sn: null, lastWave: null,         // Sniper
  cupid: null,                                                   // Flecha do Cupido
});
const anyE2 = (w) => { for (const k in w) if (k.startsWith('e2')) return true; return false; };
const FREE = ['idle', 'run', 'attack'];

let C = null; // o kit da partida (para as funções do herói)

export class E2Kit {
  constructor(c) {
    this.c = c; C = this;
    this.t = 0;
    this.room = 0;      // conta as salas (a "onda" é sala + número da onda)
    this.slowT = 0;     // Tempo de Bala: segundos que faltam
    this.lines = [];    // linhas dos tiros do Sniper: { l, t }
  }
  log(o) { if (this.c.log) this.c.log(o); }
  get players() { return this.c.players; }
  bounds() { const b = this.c.world && this.c.world.bounds; return b || { x: 12, z: 10 }; }
  waves() { return this.c.kit2 && this.c.kit2.waves; }
  waveKey() { const w = this.waves(); return this.room * 1000 + (w ? w.wave : 0); }
  camera() { return this.c.cam && this.c.cam.camera; }
  foes() { return this.c.enemies.filter((e) => e.alive && !e.undead); }
  // Tem luta na sala (inimigos vivos ou nascendo)? Sala sem inimigos (descanso, tesouro): o Sniper espera.
  fightOn() { const wm = this.waves(); return this.foes().length > 0 || !!(wm && wm.queue && wm.queue.length); }

  // ---------- Antes do dano: Disfarce (×3 no 1º golpe disfarçado) ----------
  damage(p) {
    const s = p.e2s;
    if (!s) return null;
    if ((s.disguise && s.disguise.seq !== p.swingSeq) || (s.disgSeq >= 0 && s.disgSeq === p.swingSeq)) return { mul: E2.disfarce.mul }; // o golpe que derrubou e vestiu o crânio não conta
    return null;
  }

  // ---------- Cada inimigo acertado ----------
  onHit(p, e, step, r) {
    const w = W(p);
    if (!anyE2(w) && !p.e2s) return;
    const s = e2S(p);
    // Disfarce: o golpe revela (os outros acertados no mesmo golpe também levam ×3).
    if (s.disguise && s.disguise.seq !== p.swingSeq) { s.disgSeq = p.swingSeq; this.reveal(p, s, e); }
    // Lua Cheia: a fera cura a cada golpe que acerta.
    if (s.beastT > 0 && s.healSeq !== p.swingSeq) {
      s.healSeq = p.swingSeq;
      const got = p.heal(E2.lua.heal);
      if (got) this.c.text.add(`+${got}`, p.position, 'heal small');
    }
    if (!wpn(p, 'rogue', 'rapieira') || !e || e.undead) return;
    // Destruição: o golpe marca (uma vez por onda).
    if (w.e2Destruicao && !step.e2Ghost && e.alive && !(s.ghost)) {
      const key = this.waveKey();
      if (!e.e2Mark || e.e2Mark.wave !== key) {
        if (e.e2Mark) dropMark(e.e2Mark.g);
        e.e2Mark = { wave: key, g: headMark(e, 'mark') };
        this.c.text.add('Marcado', e.position, 'gold', 2.6);
        this.log({ type: 'e2Mark', enemy: e });
      }
    }
    // Ponto Vital: 2 críticos no mesmo inimigo = execução (chefe: 10% da vida máxima).
    if (w.e2Vital && r && r.crit && !r.died && e.alive) {
      e.e2Crits = (e.e2Crits || 0) + 1;
      if (e.e2Crits >= E2.vital.crits) { e.e2Crits = 0; this.vital(p, e, r.nx || 0, r.nz || 1); }
      else this.c.text.add('Ponto Vital 1/2', e.position, 'bleed', 2.8);
    }
  }

  vital(p, e, nx, nz) {
    const c = this.c;
    c.text.add('Ponto Vital!', e.position, 'crit', 3.8);
    c.vfx.sparks(v3(e.position.x, 1.4, e.position.z), 0xff3040, 20);
    c.vfx.ring(v3(e.position.x, 0.2, e.position.z), 0xff3040, 1.6);
    audio.play('hitHeavy', e.position.x, e.position.z, { v: 1.2 });
    c.addHitstop(0.1); c.shakeFor(p, 0.25);
    if (e.data.boss) {
      const n = Math.max(1, Math.round(e.maxHp * E2.vital.boss));
      c.bonusDamage(e, n, nx, nz, 'dmg big', p);
      this.log({ type: 'e2Vital', enemy: e, boss: true, dmg: n });
      return;
    }
    e.lastHitBy = p;
    const n = Math.max(1, Math.ceil(e.hp));
    const died = e.takeDamage(n, nx, nz, 6, true);
    c.text.add(`${n}!`, e.position, 'dmg big');
    this.log({ type: 'e2Vital', enemy: e, boss: false, died });
    if (died) c.killed(e, nx, nz, p);
  }

  // ---------- Inimigo derrotado ----------
  onKill(e, by) {
    if (!by || !by.hero) return;
    const w = W(by);
    if (!anyE2(w)) return;
    const s = e2S(by), key = this.waveKey(), c = this.c;
    // Disfarce: veste o crânio de quem derrubou (uma vez por onda).
    if (w.e2Disfarce && wpn(by, 'rogue', 'adagas') && !s.disguise && s.disgWave !== key && !e.data.boss && by.state !== 'dead') {
      s.disgWave = key;
      s.disguise = { g: wearSkull(by), t: 0, seq: by.swingSeq };
      s.disgCd = 0;
      c.text.add('Disfarçado!', by.position, 'gold', 3.6);
      c.vfx.smoke(v3(by.position.x, 1.6, by.position.z), 0xd8d0b8, 8);
      audio.play('bones', by.position.x, by.position.z, { v: 0.8 });
      this.log({ type: 'e2Disguise' });
    }
    // Lua Cheia: a lua sobe a cada abate.
    if (w.e2Lua && wpn(by, 'rogue', 'garras') && !(s.beastT > 0)) {
      s.moonK = Math.min(E2.lua.kills, s.moonK + 1);
      if (s.moonK >= E2.lua.kills) this.beast(by, s);
    }
    // Sniper: conta os abates (não conta lá em cima da parede).
    if (w.e2Sniper && wpn(by, 'rogue', 'besta') && !s.sn && s.snKills < E2.sniper.kills) {
      s.snKills++;
      const left = E2.sniper.kills - s.snKills;
      if (left === 5 || left === 0) c.text.add(left ? `Sniper: falta ${left}` : 'Sniper pronto!', by.position, 'gold', 3.4);
    }
  }

  // ---------- Herói tomou dano (dmg = o que saiu da vida) ----------
  onHurt(p, dmg) {
    if (!(dmg > 0) || !W(p).e2Regen || !wpn(p, 'rogue', 'garras')) return;
    const s = e2S(p);
    s.regen.push({ left: dmg, rate: dmg / E2.regen.time });
    this.log({ type: 'e2RegenAdd', dmg });
  }

  // ---------- Kunai pega no ar (rogue.js) ----------
  onCatch(p) {
    if (!W(p).e2Bala || !wpn(p, 'rogue', 'kunai')) return;
    const s = e2S(p), now = this.t;
    s.catches = s.catches.filter((t) => now - t <= E2.bala.window);
    s.catches.push(now);
    if (s.catches.length >= 2 && !(this.slowT > 0) && s.btWave !== this.waveKey()) this.bullet(p, s);
  }
  bullet(p, s) {
    s.btWave = this.waveKey();
    s.catches.length = 0;
    this.slowT = E2.bala.time;
    bulletUi.show(); bulletUi.set(1);
    this.c.text.add('Tempo de Bala!', p.position, 'crit', 3.8);
    this.c.vfx.ring(v3(p.position.x, 0.3, p.position.z), 0x8fd8ff, 6);
    audio.play('charge', p.position.x, p.position.z, { v: 1.2 });
    this.log({ type: 'e2Bullet' });
  }
  // Velocidade dos inimigos e dos tiros deles (combat.update).
  foeScale() { return this.slowT > 0 ? E2.bala.scale : 1; }

  // ---------- Virote (rogue.js): Flecha do Cupido ----------
  onBoltHit(it, e) {
    if (it.fake || it.e2Hit) return;
    const p = it.owner;
    if (!W(p).e2Cupido || !wpn(p, 'rogue', 'besta')) return;
    it.e2Hit = e;
    const s = e2S(p), prev = s.cupid && s.cupid.e;
    const can = (x) => x && x.alive && !x.undead && !x.data.boss && !x.e2Love;
    if (prev && prev !== e && can(prev) && can(e)) { this.love(prev, e, p); s.cupid = null; return; }
    s.cupid = e.alive ? { e } : null;
    if (s.cupid) this.log({ type: 'e2CupidArm', enemy: e });
  }
  onBoltEnd(it) {
    if (it.fake || it.e2Done) return;
    it.e2Done = true;
    const p = it.owner;
    if (!p || !W(p).e2Cupido || !p.e2s) return;
    if (!it.e2Hit && p.e2s.cupid) { p.e2s.cupid = null; this.log({ type: 'e2CupidMiss' }); } // errou: recomeça
  }
  love(a, b, p) {
    const c = this.c, K = E2.cupido;
    for (const [x, o] of [[a, b], [b, a]]) {
      x.e2Love = { partner: o, by: p, g: headMark(x, 'heart'), alone: false };
      x.dmgScale = (x.dmgScale || 1) * K.dmg;
      x.maxHp = Math.round(x.maxHp * K.hp); x.hp = x.maxHp;
      x.releaseToken();
      c.vfx.burst(x.position, 0xff6fb0);
      c.text.add('Apaixonado!', x.position, 'crit', 3.4);
    }
    const mid = v3((a.position.x + b.position.x) / 2, 1.6, (a.position.z + b.position.z) / 2);
    c.vfx.lightning(v3(a.position.x, 1.6, a.position.z), v3(b.position.x, 1.6, b.position.z), 0xff6fb0, 0.18);
    c.vfx.sparks(mid, 0xff6fb0, 16);
    audio.play('bell', mid.x, mid.z, { v: 0.8 });
    this.log({ type: 'e2Love', a, b });
  }
  // Quem o apaixonado persegue (combat.pickTarget): o inimigo mais perto que não é o par. Ninguém: o herói.
  loveTarget(e) {
    const L = e.e2Love;
    if (!L || !e.alive) return null;
    let best = null, bd = Infinity;
    for (const o of this.c.enemies) {
      if (o === e || !o.alive || o.undead || o.e2Love || !o.targetable) continue;
      const d = Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z);
      if (d < bd) { bd = d; best = o; }
    }
    if (best) return best;
    if (!L.alone && !this.c.enemies.some((o) => o.alive && !o.undead && !o.e2Love)) {
      L.alone = true;
      this.c.text.add('Agora é você!', e.position, 'hurt', 3.4);
      this.log({ type: 'e2LoveTurn', enemy: e });
    }
    return null;
  }

  // ---------- Disfarce ----------
  reveal(p, s, e) {
    const c = this.c, D = s.disguise;
    s.disguise = null;
    if (D && D.g && D.g.parent) D.g.parent.remove(D.g);
    c.text.add('Surpresa!', p.position, 'crit', 3.6);
    c.vfx.smoke(v3(p.position.x, 1.8, p.position.z), 0xd8d0b8, 10);
    audio.play('bones', p.position.x, p.position.z, { v: 0.7 });
    this.log({ type: 'e2Reveal', enemy: e });
  }
  // Os inimigos (menos chefes) perdem o Ladino de vista.
  hide(p, t) {
    const r2 = this.c.rogue2;
    if (!r2) return;
    for (const e of this.foes()) {
      if (e.data.boss) continue;
      if (e.state === 'rogueLost' && e.rogueSt) { e.rogueSt.t = Math.max(e.rogueSt.t, t); continue; }
      r2.lose(e, t, p.position);
    }
  }

  // ---------- Lua Cheia ----------
  beast(p, s) {
    const c = this.c;
    s.moonK = 0;
    s.beastT = E2.lua.time;
    c.text.add('Lua Cheia!', p.position, 'crit', 4.0);
    c.text.add('Auuuuu!', p.position, 'hurt', 3.0);
    c.vfx.burst(p.position, 0xff4a2a);
    c.vfx.ring(v3(p.position.x, 0.2, p.position.z), 0xffe6b0, 4);
    audio.play('warcry', p.position.x, p.position.z, { v: 1.2 });
    c.shakeFor(p, 0.35);
    s.fearCd = 0;
    this.log({ type: 'e2Beast' });
  }
  beastTick(p, s, dt) {
    const c = this.c;
    s.beastT -= dt;
    if (p.state === 'dead') s.beastT = 0;
    if (s.beastT > 0) {
      setFlash(p.bodyMats, 0.32 + 0.18 * Math.sin(this.t * 9), 0.75, 0.1, 0.05);
      if ((s.fearCd -= dt) <= 0) {
        s.fearCd = 0.3;
        for (const e of this.foes()) {
          if (e.data.boss) continue;
          if (Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z) > E2.lua.fearR) continue;
          if (e.state === 'axeFear' && e.fear) { e.fear.t = Math.max(e.fear.t, 0.8); e.fear.run = Math.max(e.fear.run, 0.5); e.fear.from = p; continue; }
          if (fear(e, p, 0.9)) this.log({ type: 'e2Flee', enemy: e });
        }
      }
      if (Math.random() < dt * 8) c.vfx.sparks(v3(p.position.x + (Math.random() - 0.5) * 0.8, 1.2 + Math.random(), p.position.z + (Math.random() - 0.5) * 0.8), 0xff5a3a, 2);
    } else {
      s.beastT = 0;
      setFlash(p.bodyMats, 0);
      if (p.state !== 'dead') c.text.add('A lua se pôs', p.position, 'miss', 3.0);
      this.log({ type: 'e2BeastEnd' });
    }
  }

  // ---------- Regeneração ----------
  regenTick(p, s, dt) {
    if (p.state === 'dead') { s.regen.length = 0; return; }
    let sum = 0;
    for (const r of s.regen) { const d = Math.min(r.left, r.rate * dt); r.left -= d; sum += d; }
    s.regen = s.regen.filter((r) => r.left > 1e-6);
    s.regenAcc += sum;
    while (s.regenAcc >= 1) { s.regenAcc -= 1; if (p.heal(1)) s.regenShown++; }
    if (!s.regen.length && s.regenAcc > 0.999) { s.regenAcc = 0; if (p.heal(1)) s.regenShown++; } // arredondamento do fim
    s.regenShowT -= dt;
    if (s.regenShowT <= 0) {
      s.regenShowT = 2;
      if (s.regenShown > 0) { this.c.text.add(`+${s.regenShown}`, p.position, 'heal small'); s.regenShown = 0; }
    }
  }

  // ---------- Destruição ----------
  destCheck(p, s) {
    const key = this.waveKey();
    if (s.destWave === key || s.ghost || !FREE.includes(p.state)) return;
    const wm = this.waves();
    if (wm && wm.queue && wm.queue.length) return; // a onda ainda está nascendo
    const foes = this.foes();
    if (foes.filter((e) => e.targetable).length < E2.destruicao.min) return;
    if (!foes.every((e) => e.e2Mark && e.e2Mark.wave === key)) return;
    this.startGhost(p, s, foes.filter((e) => e.targetable));
  }
  startGhost(p, s, foes) {
    const c = this.c, D = E2.destruicao;
    s.destWave = this.waveKey();
    // Ordem: sempre o mais perto do anterior.
    const list = [];
    let at = { x: p.position.x, z: p.position.z };
    const left = [...foes];
    while (left.length) {
      let bi = 0, bd = Infinity;
      left.forEach((e, i) => { const d = Math.hypot(e.position.x - at.x, e.position.z - at.z); if (d < bd) { bd = d; bi = i; } });
      const e = left.splice(bi, 1)[0];
      list.push(e); at = e.position;
    }
    list.forEach((e, i) => { if (e.daze) e.daze(D.daze + D.gap * i); });
    p.combo = 0; p.queued = false; p.vel.set(0, 0, 0);
    if (p.clearRoll) p.clearRoll();
    p.setGlow(0);
    p.setState('e2Ghost');
    s.ghost = { list, i: -1, t: 0, phase: 'vanish', hit: false, n: 0 };
    p.model.visible = false;
    c.vfx.smoke(v3(p.position.x, 1.0, p.position.z), 0x2a2030, 12);
    c.text.add('Destruição!', p.position, 'crit', 4.0);
    audio.play('dodge', p.position.x, p.position.z, { v: 1.2 });
    this.log({ type: 'e2Ghost', n: list.length });
  }
  ghostTick(p, dt) {
    const s = p.e2s, G = s && s.ghost, c = this.c, D = E2.destruicao;
    if (!G) return 'end';
    G.t += dt;
    if (G.phase === 'vanish') {
      if (G.t < 0.14) return null;
      // próximo alvo vivo
      let e = null;
      while (++G.i < G.list.length) { const x = G.list[G.i]; if (x.alive && x.targetable) { e = x; break; } }
      if (!e) return this.endGhost(p);
      const f = e.facing || 0;
      const pos = v3(e.position.x - Math.sin(f) * 1.15, 0, e.position.z - Math.cos(f) * 1.15);
      if (c.world) { c.world.resolveCircle(pos, p.hero.radius); c.world.clampInside(pos, p.hero.radius); }
      p.position.x = pos.x; p.position.z = pos.z;
      p.facing = Math.atan2(e.position.x - pos.x, e.position.z - pos.z);
      p.group.rotation.y = p.facing;
      p.model.visible = true;
      c.vfx.smoke(v3(pos.x, 1.0, pos.z), 0x2a2030, 8);
      p.anim.play('Melee_1H_Attack_Stab', { once: true, restart: true, fade: 0.03, speed: 2.4 });
      audio.play('swingHeavy', pos.x, pos.z, { v: 0.9 });
      G.e = e; G.phase = 'strike'; G.t = 0; G.hit = false;
      return null;
    }
    if (G.phase === 'strike') {
      const e = G.e;
      if (!G.hit && G.t >= D.strike) {
        G.hit = true;
        if (e.alive && e.targetable) {
          const h = p.hero, heavy = h.combo[Math.max(0, h.heavyIdx)];
          const step = { ...heavy, damage: heavy.damage * D.mul, heavy: true, e2Ghost: true };
          const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
          p.swingSeq = (p.swingSeq || 0) + 1;
          c.damageEnemy(p, e, step, dx / d, dz / d, { forceCrit: true });
          c.vfx.sparks(v3(e.position.x, 1.3, e.position.z), 0xffd36a, 12);
          c.addHitstop(0.05);
          c.shakeFor(p, 0.15);
          G.n++;
          this.log({ type: 'e2GhostHit', enemy: e });
        }
      }
      if (G.t >= D.gap) {
        p.model.visible = false;
        c.vfx.smoke(v3(p.position.x, 1.0, p.position.z), 0x2a2030, 6);
        G.phase = 'vanish'; G.t = 0;
      }
      return null;
    }
    return this.endGhost(p);
  }
  endGhost(p) {
    const s = p.e2s;
    if (s) s.ghost = null;
    p.model.visible = true;
    p.iframes = Math.max(p.iframes || 0, 0.6);
    if (this.c) this.c.vfx.smoke(v3(p.position.x, 1.0, p.position.z), 0x2a2030, 8);
    this.log({ type: 'e2GhostEnd' });
    return 'end';
  }

  // ---------- Sniper ----------
  startSniper(p, s) {
    const c = this.c, b = this.bounds(), N = E2.sniper;
    s.snPending = false; s.snKills = 0;
    const x = Math.max(-b.x + 1.5, Math.min(b.x - 1.5, p.position.x));
    const cross = makeCrosshair(N.r);
    const aim = v3(x, 0, Math.min(b.z - 2, -b.z + 6));
    cross.position.set(aim.x, 0.1, aim.z);
    c.scene.add(cross);
    s.sn = { phase: 'jump', t: 0, from: { x: p.position.x, z: p.position.z }, spot: { x, z: -b.z + 0.7 }, aim, cross, focus: v3(aim.x, 0, aim.z),
      target: null, mark: null, time: N.time, cd: 0, kills: 0, hideCd: 0, mouse: null };
    p.combo = 0; p.queued = false; p.vel.set(0, 0, 0);
    if (p.clearRoll) p.clearRoll();
    p.setGlow(0);
    p.setState('e2Snipe');
    p.anim.play('Jump_Full_Long', { once: true, restart: true, fade: 0.05, speed: 1.6 });
    p.camFocus = s.sn.focus;
    sniperUi.show(); sniperUi.set(N.time);
    c.text.add('Sniper!', p.position, 'crit', 4.0);
    audio.play('dodge', p.position.x, p.position.z, { v: 1.1 });
    this.hide(p, E2.disfarce.lost);
    this.log({ type: 'e2Sniper' });
  }
  pickX(S) {
    const list = this.c.enemies.filter((e) => e.alive && !e.undead && e.targetable && e !== S.target);
    if (!list.length) return false;
    const e = list[Math.floor(Math.random() * list.length)];
    if (S.mark) dropMark(S.mark);
    S.target = e; S.mark = headMark(e, 'x'); S.time = E2.sniper.time;
    this.c.text.add('Alvo!', e.position, 'hurt', 3.0);
    this.log({ type: 'e2SniperX', enemy: e });
    return true;
  }
  snipeTick(p, dt, world, input, camera) {
    const s = p.e2s, S = s && s.sn, N = E2.sniper, c = this.c;
    if (!S) return 'end';
    S.t += dt;
    const wallOff = 1.2;
    if (S.phase === 'jump') {
      const k = Math.min(1, S.t / N.jump);
      p.position.x = S.from.x + (S.spot.x - S.from.x) * k; p.position.z = S.from.z + (S.spot.z - S.from.z) * k;
      p.facing = 0; p.group.rotation.y = 0;
      p.model.position.y = N.wallH * k + 2.4 * Math.sin(Math.PI * k);
      p.model.position.z = -wallOff * k;
      if (k >= 1) {
        S.phase = 'aim'; S.t = 0;
        p.anim.play('Ranged_1H_Aiming', { fade: 0.1 });
        c.vfx.dust(v3(S.spot.x, N.wallH, S.spot.z - wallOff), v3(0, 1, 0), 8);
        audio.play('thump', S.spot.x, S.spot.z, { v: 0.7 });
      }
      return null;
    }
    if (S.phase === 'down') {
      const k = Math.min(1, S.t / 0.4);
      p.model.position.y = N.wallH * (1 - k) + 1.2 * Math.sin(Math.PI * k);
      p.model.position.z = -wallOff * (1 - k);
      if (k >= 1) return this.endSniper(p);
      return null;
    }
    // ---- mirando ----
    p.facing = 0; p.group.rotation.y = 0;
    p.position.x = S.spot.x; p.position.z = S.spot.z;
    p.model.position.y = N.wallH; p.model.position.z = -wallOff;
    // a mira: setas/analógico movem; o mouse aponta
    const mv = v3(0, 0, 0);
    if (input && input.moveDir) input.moveDir(mv);
    if (mv.lengthSq() > 0) { if (mv.lengthSq() > 1) mv.normalize(); S.aim.x += mv.x * N.aimSpeed * dt; S.aim.z += mv.z * N.aimSpeed * dt; }
    else if (input && input.aimPoint && input.device === 'mouse' && camera) {
      const mp = input.aimPoint(camera, v3(0, 0, 0));
      if (mp && (!S.mouse || Math.hypot(mp.x - S.mouse.x, mp.z - S.mouse.z) > 0.02)) { if (S.mouse) S.aim.set(mp.x, 0, mp.z); S.mouse = mp.clone(); }
    }
    if (c.world) c.world.clampInside(S.aim, 0.5);
    S.cross.position.set(S.aim.x, 0.1, S.aim.z);
    S.cross.rotation.y += dt * 1.5;
    S.focus.set(S.aim.x * 0.5 + S.spot.x * 0.15, 0, S.aim.z * 0.6 + S.spot.z * 0.4); // câmera entre a parede e a mira
    // o Ladino vira para a mira (só o corpo; o grupo fica parado na parede)
    const wx = S.spot.x, wz = S.spot.z - wallOff;
    p.model.rotation.y = wrap(Math.atan2(S.aim.x - wx, S.aim.z - wz));
    // ninguém vê o Ladino lá em cima (chefes não se enganam, mas também não acertam)
    if ((S.hideCd -= dt) <= 0) { S.hideCd = 0.35; this.hide(p, E2.disfarce.lost); }
    // o X: passou para outro quando o marcado caiu
    if (S.target && !S.target.alive) { S.kills++; c.text.add('Abatido!', S.target.position, 'crit', 3.2); this.log({ type: 'e2SniperKill', enemy: S.target }); dropMark(S.mark); S.mark = null; S.target = null; }
    if (!S.target) {
      if (!this.pickX(S)) {
        const wm = this.waves();
        const more = this.c.enemies.some((e) => e.alive && !e.undead) || (wm && wm.queue && wm.queue.length);
        if (!more) return this.descend(p, 'vazio');
      }
    }
    if (S.target) {
      S.time -= dt;
      sniperUi.set(S.time);
      if (S.time <= 0) return this.descend(p, 'tempo');
    }
    // tiro
    S.cd -= dt;
    if (S.cd <= 0 && input && input.attack && input.attack()) this.snipeShot(p, S, wx, wz);
    return null;
  }
  snipeShot(p, S, wx, wz) {
    const c = this.c, N = E2.sniper;
    S.cd = N.cd;
    p.anim.play('Ranged_1H_Shoot', { once: true, restart: true, fade: 0.04, speed: 2.2 });
    const from = v3(wx, N.wallH + 1.4, wz);
    let best = null, bd = Infinity;
    for (const e of c.enemies) {
      if (!e.alive || e.undead || !e.targetable) continue;
      const d = Math.hypot(e.position.x - S.aim.x, e.position.z - S.aim.z);
      if (d <= N.r + e.data.radius && d < bd) { bd = d; best = e; }
    }
    const to = best ? v3(best.position.x, 1.3, best.position.z) : v3(S.aim.x, 0.1, S.aim.z);
    const l = shotLine(from, to);
    c.scene.add(l);
    this.lines.push({ l, t: 0.18 });
    audio.play('arrow', S.aim.x, S.aim.z, { v: 1.1 });
    if (!best) { c.vfx.dust(v3(S.aim.x, 0.1, S.aim.z), v3(0, 1, 0), 6); this.log({ type: 'e2SnipeMiss' }); return; }
    const dx = best.position.x - wx, dz = best.position.z - wz, d = Math.hypot(dx, dz) || 0.01;
    const step = { damage: p.hero.combo[0].damage, heavy: false };
    const isX = best === S.target;
    best.rapPierced = true; // de cima da parede: o escudo não segura
    c.damageEnemy(p, best, step, dx / d, dz / d, { ranged: true, forceCrit: isX });
    best.rapPierced = false;
    c.vfx.sparks(v3(best.position.x, 1.4, best.position.z), 0xff4040, 10);
    this.log({ type: 'e2SnipeHit', enemy: best, x: isX });
  }
  descend(p, why) {
    const S = p.e2s && p.e2s.sn;
    if (!S || S.phase === 'down') return null;
    S.phase = 'down'; S.t = 0;
    if (S.mark) { dropMark(S.mark); S.mark = null; }
    S.target = null;
    p.model.rotation.y = 0;
    p.anim.play('Jump_Full_Long', { once: true, restart: true, fade: 0.05, speed: 1.8 });
    this.c.text.add(why === 'tempo' ? 'Tempo esgotado' : 'Descendo', p.position, 'miss', 3.0);
    sniperUi.hide();
    this.log({ type: 'e2SniperDown', why, kills: S.kills });
    return null;
  }
  endSniper(p) {
    const s = p.e2s, S = s && s.sn;
    if (S) {
      if (S.cross && S.cross.parent) S.cross.parent.remove(S.cross);
      if (S.mark) dropMark(S.mark);
      s.sn = null;
    }
    p.camFocus = null;
    if (p.model) { p.model.position.y = 0; p.model.position.z = 0; p.model.rotation.y = 0; }
    p.iframes = Math.max(p.iframes || 0, 0.6);
    sniperUi.hide();
    this.log({ type: 'e2SniperEnd' });
    return 'end';
  }

  // ---------- Sala nova ----------
  roomStart() {
    this.room++;
    this.slowT = 0; bulletUi.hide();
    for (const p of this.players) {
      const s = p.e2s;
      if (!s) continue;
      if (s.disguise) { const g = s.disguise.g; if (g && g.parent) g.parent.remove(g); s.disguise = null; }
      if (s.sn) { this.endSniper(p); if (p.state === 'e2Snipe') { p.setState('idle'); p.anim.play(p.hero.anims.idle, { fade: 0.1 }); } }
      if (s.ghost) { this.endGhost(p); if (p.state === 'e2Ghost') { p.setState('idle'); p.anim.play(p.hero.anims.idle, { fade: 0.1 }); } }
      s.cupid = null; s.catches.length = 0;
    }
    this.clearLines();
  }
  clearLines() { for (const L of this.lines) if (L.l.parent) L.l.parent.remove(L.l); this.lines.length = 0; }

  tick(dt) {
    this.t += dt;
    const c = this.c, cam = this.camera();
    // Tempo de Bala
    if (this.slowT > 0) {
      this.slowT -= dt;
      bulletUi.set(this.slowT / E2.bala.time);
      if (this.slowT <= 0) { this.slowT = 0; bulletUi.hide(); this.log({ type: 'e2BulletEnd' }); }
    }
    for (const p of this.players) {
      const w = W(p);
      if (!p.e2s && !anyE2(w)) continue;
      const s = e2S(p);
      // Disfarce: os inimigos seguem sem ver o Ladino
      if (s.disguise) {
        if (p.state === 'dead' || !wpn(p, 'rogue', 'adagas')) { const g = s.disguise.g; if (g && g.parent) g.parent.remove(g); s.disguise = null; }
        else if ((s.disgCd -= dt) <= 0) { s.disgCd = E2.disfarce.refresh; this.hide(p, E2.disfarce.lost); }
      }
      if (s.beastT > 0) this.beastTick(p, s, dt);
      // Tamanho da fera (cresce e volta devagar)
      const want = s.beastT > 0 ? E2.lua.scale : 1;
      if (Math.abs(s.beastK - want) > 0.001) {
        s.beastK += (want - s.beastK) * Math.min(1, dt * 6);
        if (Math.abs(s.beastK - want) < 0.002) s.beastK = want;
        if (p.model) p.model.scale.setScalar(s.beastK);
      }
      if (s.regen.length || s.regenShown) this.regenTick(p, s, dt);
      if (w.e2Destruicao && wpn(p, 'rogue', 'rapieira') && p.state !== 'dead') this.destCheck(p, s);
      // Sniper: virou a onda com a contagem cheia -> sobe na parede
      const key = this.waveKey();
      if (s.lastWave !== key) { if (s.lastWave !== null && s.snKills >= E2.sniper.kills) s.snPending = true; s.lastWave = key; }
      if (s.snPending && !s.sn && w.e2Sniper && wpn(p, 'rogue', 'besta') && ['idle', 'run'].includes(p.state) && this.fightOn()) this.startSniper(p, s);
      if (s.sn && s.sn.mark) animMark(s.sn.mark, this.t, cam);
    }
    // Lua (tela deste computador)
    const me = c.player, ms = me && me.e2s;
    if (me && W(me).e2Lua && wpn(me, 'rogue', 'garras') && me.state !== 'dead') moonUi.set(ms ? (ms.beastT > 0 ? 1 : ms.moonK / E2.lua.kills) : 0, ms ? ms.moonK : 0, E2.lua.kills, !!(ms && ms.beastT > 0));
    else if (moonUi.on) moonUi.hide();
    // Marcas (Destruição / coração) olhando para a câmera
    for (const e of c.enemies) {
      if (e.e2Mark && e.e2Mark.g) { if (!e.alive || e.e2Mark.wave !== this.waveKey()) { dropMark(e.e2Mark.g); e.e2Mark = null; } else animMark(e.e2Mark.g, this.t, cam); }
      if (e.e2Love && e.e2Love.g) { if (!e.alive) { dropMark(e.e2Love.g); e.e2Love.g = null; } else { animMark(e.e2Love.g, this.t, cam); if (!(e.flash > 0)) setFlash(e.bodyMats, 0.28, 1, 0.45, 0.75); } }
    }
    // Linhas dos tiros
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const L = this.lines[i];
      L.t -= dt;
      L.l.material.opacity = Math.max(0, L.t / 0.18);
      if (L.t <= 0) { if (L.l.parent) L.l.parent.remove(L.l); this.lines.splice(i, 1); }
    }
  }

  clear() {
    this.slowT = 0;
    this.clearLines();
    for (const p of this.players) e2Reset(p);
    hideAllUi();
  }
}

// ================= Herói (player.js) =================
export const e2Invuln = (p) => p.state === 'e2Snipe' || p.state === 'e2Ghost';
export const e2CanDodge = (p) => !e2Invuln(p);
export const e2MoveMul = (p) => (p.e2s && p.e2s.beastT > 0 ? E2.lua.move : 1);
export const e2AtkMul = (p) => (p.e2s && p.e2s.beastT > 0 ? E2.lua.atk : 1);
export const e2Disguised = (p) => !!(p.e2s && p.e2s.disguise);

// Tira tudo (reset do herói, fim da partida).
export function e2Reset(p) {
  const s = p.e2s;
  if (s) {
    if (s.disguise && s.disguise.g && s.disguise.g.parent) s.disguise.g.parent.remove(s.disguise.g);
    if (s.sn) { if (s.sn.cross && s.sn.cross.parent) s.sn.cross.parent.remove(s.sn.cross); if (s.sn.mark) dropMark(s.sn.mark); }
    if (s.beastT > 0 && p.bodyMats) setFlash(p.bodyMats, 0);
  }
  p.e2s = null;
  p.camFocus = null;
  if (p.model) { p.model.visible = true; p.model.rotation.y = 0; }
}

// Estados do herói: e2Snipe (em cima da parede), e2Ghost (Destruição). 'end' = acabou.
export function e2StateTick(p, dt, world, input, move, camera) {
  if (!C) return 'end';
  if (p.state === 'e2Snipe') return C.snipeTick(p, dt, world, input, camera);
  if (p.state === 'e2Ghost') return C.ghostTick(p, dt);
  return 'end';
}
