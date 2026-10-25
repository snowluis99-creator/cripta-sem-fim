import { audio } from './audio.js';
import { ENEMIES } from './enemies.js';
// Ondas de esqueletos dentro de uma sala. A sala dá a lista de ondas; quando a última acaba, chama onClear.

const MARK_TIME = 0.8;   // aviso no chão antes de nascer
const GAP = 0.35;        // intervalo entre um nascimento e outro
const NEXT_WAVE = 1.4;   // pausa entre ondas

export class WaveManager {
  constructor({ combat, vfx, hud, player, world }) {
    Object.assign(this, { combat, vfx, hud, player, world });
    this.paused = false;
    this.cleared = 0;      // ondas vencidas na partida (para a tela final)
    this.onClear = null;
    this.stop();
  }

  stop() {
    this.waves = [];
    this.wave = -1;
    this.queue = [];
    this.state = 'idle';   // idle | wait | spawning | fighting
    this.timer = 0;
  }

  // waves: lista de ondas; cada onda = lista de [tipo, quantidade]. opts: { hpScale, dmgScale, bounds:{halfW, halfD} }
  start(waves, opts) {
    this.waves = waves;
    this.opts = opts;
    this.combat.hazards.bounds = opts.bounds; // círculos do Guardião cobrindo o chão
    this.wave = -1;
    this.queue = [];
    this.state = 'wait';
    this.timer = opts.delay ?? 1.0;
  }

  get active() { return this.state !== 'idle'; }

  startWave() {
    this.wave++;
    const list = [];
    for (const [type, n] of this.waves[this.wave]) for (let i = 0; i < this.count(type, n); i++) list.push(type);
    list.sort(() => Math.random() - 0.5);
    // O chefe nasce por último (os lacaios aparecem primeiro).
    const isBoss = (t) => (ENEMIES[t]?.boss ? 1 : 0);
    list.sort((a, b) => isBoss(a) - isBoss(b));
    const used = [];
    this.queue = list.map((type, i) => {
      const p = this.pickSpot(used, isBoss(type) ? 1.6 : 0.9);
      used.push(p);
      this.vfx.spawnMarker(p, MARK_TIME + i * GAP);
      return { type, x: p.x, z: p.z, t: MARK_TIME + i * GAP };
    });
    this.state = 'spawning';
    this.hud.setWave(`Onda ${this.wave + 1}/${this.waves.length}`);
    this.hud.banner(this.wave === this.waves.length - 1 && this.waves.length > 1 ? 'Última onda' : `Onda ${this.wave + 1}`, 'small');
  }

  // Co-op: o dobro de esqueletos (os chefes continuam um só, mas com o dobro de vida).
  count(type, n) { return ENEMIES[type]?.boss ? n : Math.max(n, Math.round(n * (this.opts?.mult || 1))); }

  // Herói de referência para o nascimento: um dos heróis vivos, sorteado (co-op).
  anchor() {
    const alive = this.combat.alivePlayers;
    return alive.length ? alive[Math.floor(Math.random() * alive.length)] : this.player;
  }

  // Esqueletos invocados pelo chefe (também nascem nas costas do herói).
  summon(list) {
    if (this.state === 'idle') return;
    const types = [];
    for (const [type, n] of list) for (let i = 0; i < this.count(type, n); i++) types.push(type);
    const used = [];
    types.forEach((type, i) => {
      const p = this.pickSpot(used, 0.9);
      used.push(p);
      const t = MARK_TIME + i * 0.2;
      this.vfx.spawnMarker(p, t);
      this.queue.push({ type, x: p.x, z: p.z, t });
    });
    this.queue.sort((a, b) => a.t - b.t);
    this.state = 'spawning';
  }

  // Lugar para nascer: sempre nas costas do herói (atrás de onde ele está olhando), dentro da sala,
  // fora dos obstáculos e longe de outros nascimentos. Se não couber atrás, abre o leque para os lados.
  pickSpot(used, r) {
    const { halfW, halfD } = this.opts.bounds;
    const hw = halfW - 2.5, hd = halfD - 2.5;
    const h = this.anchor();
    const p = h.position, back = h.facing + Math.PI;
    for (const spread of [0.6, 1.1, 1.6]) {
      for (let i = 0; i < 24; i++) {
        const a = back + (Math.random() * 2 - 1) * spread;
        const dist = 3.2 + Math.random() * 2.6;
        const x = p.x + Math.sin(a) * dist, z = p.z + Math.cos(a) * dist;
        if (Math.abs(x) > hw + 1 || Math.abs(z) > hd + 1) continue;
        if (this.world.blocked(x, z, r + 0.4)) continue;
        if (used.some((u) => Math.hypot(x - u.x, z - u.z) < 1.8)) continue;
        return { x, z };
      }
    }
    return this.pickAnywhere(used, r);
  }

  // Plano B (herói de costas para a parede): o lugar livre mais "atrás" possível (de lado, perto das costas).
  pickAnywhere(used, r) {
    const { halfW, halfD } = this.opts.bounds;
    const hw = halfW - 2, hd = halfD - 2;
    const h = this.anchor();
    const p = h.position, fx = Math.sin(h.facing), fz = Math.cos(h.facing);
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 80; i++) {
      const x = (Math.random() * 2 - 1) * hw, z = (Math.random() * 2 - 1) * hd;
      const dx = x - p.x, dz = z - p.z, dist = Math.hypot(dx, dz) || 1;
      let score = -((dx * fx + dz * fz) / dist) * 10 - Math.abs(dist - 4.5); // atrás e a uns 4,5 de distância
      if (dist < 2.5) score -= 100;
      if (this.world.blocked(x, z, r + 0.4)) score -= 1000;
      for (const u of used) if (Math.hypot(x - u.x, z - u.z) < 1.8) score -= 50;
      if (score > bestScore) { bestScore = score; best = { x, z }; }
    }
    return best;
  }

  update(dt) {
    if (this.paused || this.state === 'idle' || !this.combat.alivePlayers.length) return;
    if (this.state === 'wait') {
      this.timer -= dt;
      if (this.timer <= 0) this.startWave();
      return;
    }
    for (const s of this.queue) s.t -= dt;
    while (this.queue.length && this.queue[0].t <= 0) {
      const s = this.queue.shift();
      const to = this.combat.nearestPlayer(s.x, s.z).position;
      const facing = Math.atan2(to.x - s.x, to.z - s.z);
      const boss = ENEMIES[s.type]?.boss;
      const e = this.combat.spawn(s.type, s.x, s.z, { facing, hpScale: this.opts.hpScale * (boss ? this.opts.bossMul || 1 : 1), dmgScale: this.opts.dmgScale });
      if (e.data.boss) this.hud.showBoss(e);
      audio.play('rise', s.x, s.z);
    }
    if (!this.queue.length) this.state = 'fighting';
    if (this.state === 'fighting' && this.combat.aliveCount === 0) {
      this.cleared++;
      if (this.wave >= this.waves.length - 1) {
        this.state = 'idle';
        this.hud.setWave('');
        if (this.onClear) this.onClear();
      } else {
        this.state = 'wait';
        this.timer = NEXT_WAVE;
      }
    }
  }
}
