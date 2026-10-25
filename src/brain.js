// Cérebro dos esqueletos: navegação (contornar pilares, mesas, caixões) e tática de grupo.
// - Mapa de caminhos: grade de 0,5 sobre a sala; distância até o herói calculada por busca (cache por casa).
// - Andar: se a linha reta está livre, vai direto; senão segue o caminho, cortando cantos com linha de visão.
// - Preso (quase não andou): usa o caminho por 1 s e troca o lado de rodear.
// - Cerco: os esqueletos corpo a corpo de um mesmo alvo se espalham em volta dele (vêm por lados diferentes).
// - Escudo levantado: quem está na frente do escudo espera e rodeia; quem está pelas costas/lado ataca.
// - Punição: herói atacando, bebendo poção, tomando dano ou preso → recarga do ataque anda 2,2× mais rápido.
// - Mira: arqueiros, magos e saraivadas atiram onde o herói VAI estar (velocidade do herói).
const CELL = 0.5;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const BUSY = new Set(['attack', 'drink', 'hurt', 'rooted', 'emote']);

class NavGrid {
  constructor(world, clearance) {
    const b = world.bounds;
    this.world = world; this.r = clearance;
    this.hx = b ? b.x : 30; this.hz = b ? b.z : 30;
    this.cols = Math.max(1, Math.ceil((this.hx * 2) / CELL));
    this.rows = Math.max(1, Math.ceil((this.hz * 2) / CELL));
    const n = this.cols * this.rows;
    this.free = new Uint8Array(n);
    for (let j = 0; j < this.rows; j++) for (let i = 0; i < this.cols; i++) {
      const x = -this.hx + (i + 0.5) * CELL, z = -this.hz + (j + 0.5) * CELL;
      this.free[j * this.cols + i] = world.blocked(x, z, clearance) ? 0 : 1;
    }
    this.fields = new Map(); // casa do alvo → distâncias
    this.queue = new Int32Array(n);
  }
  cellOf(x, z) {
    const i = Math.min(this.cols - 1, Math.max(0, Math.floor((x + this.hx) / CELL)));
    const j = Math.min(this.rows - 1, Math.max(0, Math.floor((z + this.hz) / CELL)));
    return j * this.cols + i;
  }
  center(c) { return { x: -this.hx + ((c % this.cols) + 0.5) * CELL, z: -this.hz + (Math.floor(c / this.cols) + 0.5) * CELL }; }
  // Casa livre mais perto (o alvo pode estar encostado num obstáculo).
  nearestFree(c) {
    if (this.free[c]) return c;
    const ci = c % this.cols, cj = Math.floor(c / this.cols);
    for (let rad = 1; rad < 8; rad++) for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== rad) continue;
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) continue;
      if (this.free[j * this.cols + i]) return j * this.cols + i;
    }
    return c;
  }
  // Distância (em passos) de cada casa até o alvo. Busca em largura com 8 vizinhos (sem cortar quinas).
  field(x, z) {
    const goal = this.nearestFree(this.cellOf(x, z));
    let f = this.fields.get(goal);
    if (f) return f;
    if (this.fields.size > 12) this.fields.clear();
    const n = this.cols * this.rows, C = this.cols;
    f = new Uint16Array(n).fill(65535);
    const q = this.queue;
    let h = 0, t = 0;
    f[goal] = 0; q[t++] = goal;
    while (h < t) {
      const c = q[h++], ci = c % C, cj = (c / C) | 0, d = f[c] + 1;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= C || j >= this.rows) continue;
        const k = j * C + i;
        if (!this.free[k] || f[k] <= d) continue;
        if (di && dj && (!this.free[cj * C + i] || !this.free[j * C + ci])) continue;
        f[k] = d; q[t++] = k;
      }
    }
    this.fields.set(goal, f);
    return f;
  }
}

// Grade da sala para um tamanho de corpo (refeita quando a sala muda).
function gridFor(world, radius) {
  const r = radius > 0.9 ? 1.0 : 0.6;
  const ver = `${world.rects.length}:${world.bounds ? world.bounds.x + ',' + world.bounds.z : ''}:${world.version || 0}`;
  if (!world._nav || world._nav.ver !== ver) world._nav = { ver, grids: {} };
  return world._nav.grids[r] || (world._nav.grids[r] = new NavGrid(world, r));
}

// Linha reta livre para um corpo de raio r?
export function lineClear(world, ax, az, bx, bz, r) {
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
  const n = Math.ceil(len / 0.4);
  for (let i = 1; i <= n; i++) if (world.blocked(ax + (dx * i) / n, az + (dz * i) / n, r)) return false;
  return true;
}

// Direção para chegar em (tx, tz). anchor = herói (o caminho é calculado até ele).
// Devolve [x, z] (comprimento 1) ou null se já chegou.
export function navDir(e, world, tx, tz, anchor, dt) {
  const px = e.position.x, pz = e.position.z;
  const dx = tx - px, dz = tz - pz, d = Math.hypot(dx, dz);
  if (d < 0.05) return null;
  const nav = e.nav || (e.nav = { t: 0, wx: tx, wz: tz, force: 0, lx: px, lz: pz, stuck: 0, want: false });
  nav.t -= dt; nav.force -= dt;
  const r = Math.min(e.data.radius, 1.0) * 0.85;
  if (nav.t <= 0) {
    nav.t = 0.12 + Math.random() * 0.06;
    if (nav.force <= 0 && lineClear(world, px, pz, tx, tz, r)) { nav.wx = tx; nav.wz = tz; nav.direct = true; }
    else {
      nav.direct = false;
      const g = gridFor(world, e.data.radius), a = anchor || { x: tx, z: tz };
      const f = g.field(a.x, a.z);
      // Desce o caminho e pega a casa mais longe que ainda dá para ver em linha reta.
      let c = g.cellOf(px, pz);
      if (!g.free[c] || f[c] === 65535) c = g.nearestFree(c);
      let best = null;
      for (let s = 0; s < 14; s++) {
        const ci = c % g.cols, cj = (c / g.cols) | 0;
        let nc = c, nd = f[c];
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= g.cols || j >= g.rows) continue;
          const k = j * g.cols + i;
          if (f[k] < nd) { nd = f[k]; nc = k; }
        }
        if (nc === c) break;
        c = nc;
        const p = g.center(c);
        if (s < 2 || lineClear(world, px, pz, p.x, p.z, r)) best = p; else break;
      }
      if (best) { nav.wx = best.x; nav.wz = best.z; } else { nav.wx = tx; nav.wz = tz; }
    }
  }
  const wx = nav.wx - px, wz = nav.wz - pz, wl = Math.hypot(wx, wz);
  if (wl < 0.05) return [dx / d, dz / d];
  return [wx / wl, wz / wl];
}

// Chamado depois de andar: se quase não saiu do lugar, está preso → usa o caminho e troca de lado.
export function checkStuck(e, dt, expected) {
  const nav = e.nav;
  if (!nav) return;
  const moved = Math.hypot(e.position.x - nav.lx, e.position.z - nav.lz);
  nav.lx = e.position.x; nav.lz = e.position.z;
  if (expected > 1e-4 && moved < expected * 0.35) nav.stuck += dt; else nav.stuck = Math.max(0, nav.stuck - dt * 2);
  if (nav.stuck > 0.35) { nav.stuck = 0; nav.force = 1.2; nav.t = 0; e.strafe *= -1; }
}

// Anda na direção (já limitada pela velocidade). Devolve true se andou.
export function stepToward(e, ctx, dt, tx, tz, speedMul = 1) {
  const p = ctx.player;
  const dir = navDir(e, ctx.world, tx, tz, p.position, dt);
  if (!dir) return false;
  const k = e.data.speed * speedMul * (e.slow > 0 ? 0.45 : 1) * dt;
  const left = Math.hypot(tx - e.position.x, tz - e.position.z);
  const step = Math.min(k, left);
  e.position.x += dir[0] * step; e.position.z += dir[1] * step;
  e.moveAng = Math.atan2(dir[0], dir[1]);
  ctx.world.resolveCircle(e.position, e.data.radius);
  checkStuck(e, dt, step);
  return true;
}

// ---------- Tática de grupo (chamada uma vez por quadro em combat.update) ----------
// Velocidade dos heróis (para mirar na frente) e vagas do cerco.
export function tactics(combat, dt) {
  for (const p of combat.players) {
    const lx = p._navX ?? p.position.x, lz = p._navZ ?? p.position.z;
    const vx = (p.position.x - lx) / Math.max(dt, 1e-3), vz = (p.position.z - lz) / Math.max(dt, 1e-3);
    const ok = Math.hypot(vx, vz) < 30; // teleporte/troca de sala: ignora
    const k = 1 - Math.exp(-10 * dt);
    p.navVel = p.navVel || { x: 0, z: 0 };
    p.navVel.x += ((ok ? vx : 0) - p.navVel.x) * k; p.navVel.z += ((ok ? vz : 0) - p.navVel.z) * k;
    p._navX = p.position.x; p._navZ = p.position.z;
  }
  // Cerco: por alvo, esqueletos corpo a corpo (sem os chefes) em ordem de ângulo, espaçados por igual.
  const groups = new Map();
  for (const e of combat.enemies) {
    if (!e.alive || e.data.boss || e.data.ranged || e.data.phantom || !e.target) continue;
    let g = groups.get(e.target);
    if (!g) groups.set(e.target, g = []);
    g.push(e);
  }
  for (const [t, list] of groups) {
    const n = list.length;
    for (const e of list) e._ang = Math.atan2(e.position.x - t.position.x, e.position.z - t.position.z);
    if (n === 1) { list[0].slotAng = list[0]._ang; continue; }
    list.sort((a, b) => a._ang - b._ang);
    const step = (Math.PI * 2) / n;
    let sx = 0, sz = 0;
    list.forEach((e, i) => { const a = e._ang - i * step; sx += Math.sin(a); sz += Math.cos(a); });
    const base = Math.atan2(sx, sz);
    list.forEach((e, i) => { e.slotAng = wrap(base + i * step); });
  }
}

// Ângulo para onde o esqueleto deve virar ao atacar: um pouco na frente do herói (lead em segundos).
export function leadAngle(e, p, lead) {
  const v = p.navVel || { x: 0, z: 0 };
  return Math.atan2(p.position.x + v.x * lead - e.position.x, p.position.z + v.z * lead - e.position.z);
}

// Mira de projétil: onde o herói estará quando o tiro chegar (80% da previsão, no máximo 0,9 s).
export function aimAngle(e, p, speed) {
  const dist = Math.hypot(p.position.x - e.position.x, p.position.z - e.position.z);
  const t = Math.min(0.9, dist / Math.max(speed, 1)) * 0.8;
  return leadAngle(e, p, t);
}

// Herói ocupado (atacando, bebendo, tomando dano, preso): hora de punir.
export function targetBusy(p) { return !!p && BUSY.has(p.state); }

// O herói está com o escudo erguido virado para este esqueleto?
export function facingShield(e, p) {
  if (!p || p.state !== 'block') return false;
  const ang = Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z);
  return Math.abs(wrap(ang - (p.facing || 0))) < 1.1;
}

// Movimento corpo a corpo enquanto persegue. ready = pode atacar agora.
// Devolve true se está em posição de atacar.
export function meleeMove(e, dt, ctx, dist, ready) {
  const d = e.data, p = ctx.player;
  const shieldFront = facingShield(e, p);
  // Escolhe o ponto em volta do herói: a vaga do cerco (ou a posição atual se for o único).
  let ang = e.slotAng ?? Math.atan2(e.position.x - p.position.x, e.position.z - p.position.z);
  // Escudo de frente: dá a volta para o lado das costas dele.
  if (shieldFront) ang = (p.facing || 0) + Math.PI + 0.9 * e.strafe;
  const ring = ready ? d.attackRange * 0.8 : d.attackRange + 0.9;
  const pr = Math.max(0.6, (p.hero?.radius || 0.6));
  const R = Math.max(ring, pr + d.radius + 0.1);
  const tx = p.position.x + Math.sin(ang) * R, tz = p.position.z + Math.cos(ang) * R;
  const toSlot = Math.hypot(tx - e.position.x, tz - e.position.z);
  let moved = false;
  e.moveAng = null;
  if (toSlot > 0.35) moved = stepToward(e, ctx, dt, tx, tz, ready ? 1.15 : 1);
  else if (e.nav) checkStuck(e, dt, 0);
  e.anim.play(moved ? d.anims.walk : d.anims.idle, moved ? { speed: d.walkAnimSpeed * (e.slow > 0 ? 0.5 : 1) } : undefined);
  return !shieldFront || dist < d.attackRange * 0.6; // colado no escudo: bate assim mesmo
}

// Foge do herói: procura um ponto livre longe dele (não corre para a parede).
export function fleePoint(e, ctx, dist0) {
  const p = ctx.player, w = ctx.world;
  let best = null, bs = -Infinity;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = e.position.x + Math.sin(a) * 5, z = e.position.z + Math.cos(a) * 5;
    if (w.blocked(x, z, e.data.radius)) continue;
    const s = Math.hypot(x - p.position.x, z - p.position.z) - (lineClear(w, e.position.x, e.position.z, x, z, e.data.radius * 0.8) ? 0 : 6);
    if (s > bs) { bs = s; best = { x, z }; }
  }
  return best && bs > dist0 ? best : null;
}
