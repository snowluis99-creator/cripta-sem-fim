// Co-op, lado do anfitrião: o jogo inteiro roda aqui. O Jogador 2 manda os comandos (RemoteInput)
// e recebe ~15 vezes por segundo o que precisa desenhar (heróis, esqueletos, recompensas, projéteis, efeitos).
import { shieldMax } from './shield.js';
import { ammoInfo } from './rogue.js';
import { cleanUps } from './save.js';
import { equippedWeapon, selectedHero, WEAPONS } from './heroes.js';
import * as THREE from 'three';
import { clipNames } from './animation.js';
import { ENEMIES } from './enemies.js';
import { sizeOf } from './net.js';
import { audio } from './audio.js';

export const ENEMY_TYPES = Object.keys(ENEMIES);
export const PICKUP_KINDS = ['blessing', 'gold', 'potion', 'chest', 'shop', 'bed'];
const SEND_EVERY = 1 / 15;
const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;
const clipIdx = (anim) => clipNames.indexOf(anim.currentName);
export const PROJ_KINDS = ['arrow', 'orb', 'wave', 'star', 'shard', 'kunai', 'bolt'];
const vec = (a) => (a && a.isVector3 ? { v: [r2(a.x), r2(a.y), r2(a.z)] } : a);

// Comandos do Jogador 2 chegando pela rede, com a mesma "cara" do teclado/controle (input.js).
export class RemoteInput {
  constructor() { this.reset(); }
  reset() {
    this.mx = 0; this.mz = 0; this.aim = null; this.blk = false;
    this.last = null;                       // últimos contadores recebidos
    this.pend = { atk: 0, dge: 0, pot: 0, use: 0, ult: 0 };
    this.now = { atk: false, dge: false, pot: false, use: false, ult: false };
    this.retries = 0;
    this.seq = 0; this.seqAt = 0;           // último envio recebido do Jogador 2 (e quando chegou)
  }
  // pkt.in = [mx, mz, aim, bloqueando, ataques, rolamentos, poções, usar, recomeçar] (contadores somam sempre)
  apply(arr, sq, now = 0) {
    if (Number.isFinite(sq) && sq !== this.seq) { this.seq = sq; this.seqAt = now; }
    if (!Array.isArray(arr) || arr.length < 9) return;
    const num = (v) => (Number.isFinite(v) ? v : 0);
    this.mx = Math.max(-1, Math.min(1, num(arr[0])));
    this.mz = Math.max(-1, Math.min(1, num(arr[1])));
    this.aim = Number.isFinite(arr[2]) ? arr[2] : null;
    this.blk = !!arr[3];
    const c = { atk: num(arr[4]), dge: num(arr[5]), pot: num(arr[6]), use: num(arr[7]), rt: num(arr[8]), ult: num(arr[9]) };
    if (this.last) {
      for (const k of ['atk', 'dge', 'pot', 'use', 'ult']) this.pend[k] = Math.min(3, this.pend[k] + Math.max(0, c[k] - this.last[k]));
      this.retries += Math.max(0, c.rt - this.last.rt);
    }
    this.last = c;
  }
  // Uma vez por passo do jogo: cada botão apertado vira "apertou agora" por um passo.
  beginFrame() {
    for (const k in this.pend) if (!this.now[k] && this.pend[k] > 0) { this.pend[k]--; this.now[k] = true; }
  }
  endFrame() { for (const k in this.now) this.now[k] = false; }
  moveDir(out) {
    out.set(this.mx, 0, this.mz);
    if (out.lengthSq() > 1) out.normalize();
    return out;
  }
  aimAngle() {
    if (this.mx * this.mx + this.mz * this.mz > 0.04) return Math.atan2(this.mx, this.mz);
    return this.aim;
  }
  attack() { return this.now.atk; }
  dodge() { return this.now.dge; }
  potion() { return this.now.pot; }
  interact() { return this.now.use; }
  ultimate() { return this.now.ult; }
  blocking() { return this.blk; }
}

export class CoopHost {
  // g: { net, scene, combat, run, hud, ui, cam, vfx, waves }
  constructor(g) {
    Object.assign(this, g);
    this.input = new RemoteInput();
    this.events = [];      // [{ s, t, e }]
    this.seq = 0;
    this.time = 0;
    this.sendT = 0;
    this.lastChoicePick = 0;
    this.wrap();
    this.run.onUnlock = (h) => this.event(['U', h]); // cena de desbloqueio também na tela do Jogador 2
  }

  // Tudo que é "efeito" (faíscas, números de dano, tremidas, avisos) também vai para o Jogador 2.
  wrap() {
    const push = (e) => { if (!this.combat.netMuted) this.event(e); };
    // Sons: o Jogador 2 toca os mesmos (com o volume pela distância até o herói dele).
    audio.onPlay = (name, x, z, v) => push(['s', name, x == null ? null : r1(x), z == null ? null : r1(z), v ?? 1]);
    const vfx = this.vfx;
    for (const name of ['heavyImpact', 'dust', 'sparks', 'puff', 'spawnMarker', 'ice', 'burst', 'bolt', 'smoke', 'beam', 'beamLine', 'flameCone', 'ring']) {
      const fn = vfx[name].bind(vfx);
      // Só a chamada "de fora" vai pela rede (burst chama sparks por dentro: não duplica).
      vfx[name] = (...args) => {
        if (!this.vfxDepth) push(['v', name, ...args.map(vec)]);
        this.vfxDepth = (this.vfxDepth || 0) + 1;
        try { return fn(...args); } finally { this.vfxDepth--; }
      };
    }
    const text = this.combat.text, add = text.add.bind(text);
    text.add = (t, pos, cls = '', h = 2.4) => { push(['t', String(t), r2(pos.x), r2(pos.z), cls, h]); return add(t, pos, cls, h); };
    const cam = this.cam;
    cam.shakeLocal = cam.shake.bind(cam);
    cam.shake = (a) => { push(['k', r2(a)]); cam.shakeLocal(a); };
    const hud = this.hud;
    hud.bannerLocal = hud.banner.bind(hud);
    hud.banner = (t, size = 'big') => { push(['b', t, size]); hud.bannerLocal(t, size); };
    const hz = this.combat.hazards, spawn = hz.spawnCircles.bind(hz), remove = hz.remove.bind(hz);
    hz.spawnCircles = (spots, cfg) => {
      const before = hz.circles.length;
      spawn(spots, cfg);
      const ids = hz.circles.slice(before).map((c) => [c.id, r2(c.x), r2(c.z)]);
      push(['hz', ids, cfg.radius, cfg.warn, cfg.life]);
    };
    hz.remove = (c) => { if (hz.circles.includes(c)) push(['hzr', c.id]); remove(c); };
    const pr = this.combat.projectiles, rain = pr.rain.bind(pr);
    pr.rain = (spots, cfg) => { push(['rain', spots.map((s) => [r2(s.x), r2(s.z), r2(s.delay || 0)]), cfg.fall, cfg.radius]); rain(spots, cfg); };
  }

  event(e) {
    this.events.push({ s: ++this.seq, t: this.time, e });
    if (this.events.length > 120) this.events.splice(0, this.events.length - 120);
  }

  // Avisos só para a tela do Jogador 2.
  remoteUx() {
    const to = (...e) => this.event(['T', ...e]);
    return {
      hurt: (a) => to('hurt', r2(a)),
      shake: (a) => to('k', r2(a)),
      potionWarn: () => to('pw'),
      goldWarn: () => to('gw'),
      shieldWarn: () => to('sw'),
      banner: (t, size = 'big') => to('b', t, size),
    };
  }

  // Lê o que o Jogador 2 publicou (comandos, bênção escolhida, recomeçar).
  receive(peer) {
    const pr = peer && peer.presence;
    if (!pr) return;
    this.input.apply(pr.in, pr.sq, this.time);
    // Progresso permanente do Jogador 2 (Ouro de Alma e melhorias): vale o que chegou primeiro; depois o anfitrião manda.
    const p2 = this.combat.players[1];
    if (p2 && !p2.saveData && Array.isArray(pr.sv)) {
      const [soul, ups, runs, best] = pr.sv;
      const num = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
      const { ups: clean, refund } = cleanUps(ups);
      p2.saveData = { soul: num(soul) + refund, ups: clean, runs: num(runs), best: num(best), rev: 0 };
      const hero = selectedHero(clean);
      p2.setHero(hero, equippedWeapon(clean, hero));
      if (this.run.inTavern) this.run.tavernVersion = (this.run.tavernVersion || 0) + 1;
    }
    const pk = pr.pk;
    if (Array.isArray(pk) && pk[0] !== this.lastChoicePick) {
      this.lastChoicePick = pk[0];
      this.run.resolveRemoteChoice(pk[0], pk[1] | 0);
    }
  }

  // ---------- O que o Jogador 2 precisa desenhar ----------
  heroEntry(p) {
    const m = p.bodyMats[0];
    const rollT = p.state === 'dodge' ? r2(p.stateTime / p.hero.dodge.time) : -1;
    const bl = Object.entries(p.blessings).filter(([, n]) => n > 0).map(([k, n]) => `${k}:${n}`).join(',');
    return [r2(p.position.x), r2(p.position.z), r2(p.facing), p.anim.playId, clipIdx(p.anim), r2(p.anim.netSpeed), p.anim.netOnce ? 1 : 0,
      rollT, r2(p.glow), r2(m.emissive.r), r2(m.emissive.g), r2(m.emissive.b), r2(m.emissiveIntensity),
      Math.ceil(p.hp), p.maxHp, p.potions, p.gold, p.spectralReady ? 1 : 0, p.group.visible ? 1 : 0, p.state === 'dead' ? 1 : 0, bl, r2(p.position.y), p.shield, shieldMax(p), r2(p.stats.rangeMul),
      `${p.heroId}/${p.weaponId}`,
      ...(p.saveData ? [p.saveData.soul, p.saveData.ups, p.saveData.runs, p.saveData.best] : [])];
  }

  enemyEntry(e) {
    // 5/6/7 = cena de morte do Rei Skullbone (7 cambaleando, 5 sem cabeça, 6 segurando o herói).
    const code = e.finale ? e.finale.code : !e.alive ? (e.shattered ? 2 : 1) : (e.state === 'spinGather' || e.state === 'spin') && e.boneSword ? 3 : e.state === 'cast' ? 4 : 0;
    const eyes = e.eyes.length ? r1(e.eyes[0].emissiveIntensity) : 0;
    return [e.id, ENEMY_TYPES.indexOf(e.type), r2(e.position.x), r2(e.position.z), r2(e.facing), r2(e.group.position.y), r2(e.group.scale.x),
      e.anim.playId, clipIdx(e.anim), r2(e.anim.netSpeed), e.anim.netOnce ? 1 : 0, r1(e.flash), eyes, code, e.immune ? 1 : 0, r2(e.alpha ?? 1), e.state === 'roll' ? r2(e.rollK ?? -1) : -1];
  }

  state() {
    const run = this.run, [p1, p2] = this.combat.players;
    const s = {
      rv: run.roomVersion,
      rm: run.built ? [run.node.room, run.slots, run.doorInfos, run.floorNum] : 0,
      do: run.doorsOpen ? 1 : 0,
      tv: run.inTavern ? 1 : 0,
      tvv: run.tavernVersion || 0,
      h: [this.heroEntry(p1), p2 ? this.heroEntry(p2) : 0],
      e: this.combat.enemies.map((e) => this.enemyEntry(e)),
      pk: run.pickups.filter((p) => p.kind !== 'bed').map((p) => [p.id, PICKUP_KINDS.indexOf(p.kind), r2(p.pos.x), r2(p.pos.z),
        p.opts.color ?? 0, p.opts.ringColor ?? -1, p.opts.item === 'potion' ? 1 : 0, p.opts.price || 0, p.opts.size || 1,
        (p.boughtBy && p2 && p.boughtBy.has(p2)) || p.taken ? 1 : 0, p.opts.gold === false ? 0 : 1, p.opts.item === 'weapon' ? `w${p.opts.slot}` : p.opts.item === 'hero' ? 'h' : p.opts.item === 'hire' ? 'm' : 0,
        p.opts.item === 'weapon' && p2 && p2.weaponId === (WEAPONS[p2.heroId][p.opts.slot] || {}).id ? 1 : 0]),
      mc: run.npc ? [r2(run.npc.position.x), r2(run.npc.position.z), r2(run.npc.group.rotation.y), run.npc.anim.playId, clipIdx(run.npc.anim),
        r2(run.npc.anim.netSpeed), run.npc.anim.netOnce ? 1 : 0, r1(run.npc.flash), run.npc.alive ? 1 : 0, run.npc.ally ? r2(run.npc.rollK || 0) : -1] : 0,
      // ultimate + Ladino: munição [n, max, tipo, corrente], fumaça (recarga) e invisível.
      ul: this.combat.players.map((p) => { const a = ammoInfo(p); return [p.ult || 0, p.ultNeed, r2(p.ultTime || 0), a ? [a.n, a.max, a.kind, a.stack] : 0,
        p.hero.ability === 'smoke' ? r1(p.smokeCd || 0) : -1, p.stealth > 0 ? 1 : 0]; }),
      mm: this.hud.mm || 0,
      wv: this.hud.waveEl.textContent,
      bs: this.hud.boss ? [this.hud.boss.data.name, Math.max(0, Math.round(this.hud.boss.hp)), this.hud.boss.maxHp] : 0,
      fd: run.transition ? 1 : 0,
      go: this.gameOver || 0,
      gs: this.gameOver ? this.gameOverStats || '' : '',
      pr: run.remotePrompt ? [run.remotePrompt.text, r2(run.remotePrompt.pos.x), r2(run.remotePrompt.pos.y), r2(run.remotePrompt.pos.z)] : 0,
      ch: run.pendingChoice ? [run.pendingChoice.id, run.pendingChoice.title, run.pendingChoice.options.map((b) => b.id)] : 0,
      om: this.team ? this.team.shapes.slice(0, 14) : 0,
      t: r2(this.simTime || 0),
      sp: this.net.spectators ? this.net.spectators() : 0,
      p2: p2 ? this.predInfo(p2) : 0,
    };
    // Sala muito cheia: corta esqueletos de longe até caber.
    while (sizeOf({ role: 'host', s }) > 3900 && s.e.length) s.e.pop();
    return s;
  }

  // Para o Jogador 2 andar na hora na tela dele (predict.js): qual comando dele já foi usado aqui e se o herói está livre.
  predInfo(p) {
    const free = (p.state === 'idle' || p.state === 'run') && !p.frozen && !p.choosing ? 1 : 0;
    const d = p.hero.dodge;
    return [this.input.seq, r2(Math.max(0, this.time - this.input.seqAt)), free, r2(p.hero.moveSpeed * p.moveMul),
      r2(d.distance * p.stats.dodgeMul), r2(d.time), p.dodgeCooldown <= 0 ? 1 : 0, r2(d.cooldown)];
  }

  fx() {
    const list = this.combat.projectiles.list.map((a) => [a.id, PROJ_KINDS.indexOf(a.kind), a.color, r2(a.scale),
      r2(a.x), r2(a.z), r2(a.g.position.y), r2(a.g.rotation.y), a.stuck >= 0 ? 0 : r1(Math.hypot(a.vx, a.vz))]);
    if (this.combat.rogue) list.push(...this.combat.rogue.netList(PROJ_KINDS)); // kunais e virotes do Ladino
    const f = { p: list, ev: [] };
    // Efeitos do último segundo (o outro lado ignora os que já viu), do mais novo para o mais velho, até caber.
    let size = sizeOf({ f });
    for (let i = this.events.length - 1; i >= 0; i--) {
      const ev = this.events[i];
      if (this.time - ev.t > 1.0) break;
      const item = [ev.s, ...ev.e];
      const add = sizeOf(item) + 1;
      if (size + add > 3900) break;
      f.ev.unshift(item);
      size += add;
    }
    while (sizeOf({ f }) > 3950 && f.p.length) f.p.pop();
    return f;
  }

  // Chamado a cada quadro do anfitrião.
  update(dt, simTime) {
    this.time += dt;
    this.simTime = simTime;
    this.sendT -= dt;
    if (this.sendT > 0) return;
    this.sendT = SEND_EVERY;
    this.net.send(this.net.a, { role: 'host', s: this.state() });
    this.net.send(this.net.b, { f: this.fx() });
  }
}
