// Estados do esqueleto das bênçãos do Cajado Elétrico (sem imports, para não criar ciclos com axekit2.js).
// eleLost = Blecaute (perdido no escuro, andando sem rumo); elePuppet = Marionete (espasmo: golpeia o aliado mais perto).
export const ELE_STATES = ['eleLost', 'elePuppet'];

const back = (e) => { e.setState('chase'); e.anim.play(e.data.anims.idle, { fade: 0.15 }); };

export function eleEnemyTick(e, dt, ctx) {
  const c = ctx.combat, d = e.data;
  if (e.state === 'eleLost') {
    const L = e.eleLost;
    if (!L) return back(e);
    L.t -= dt; L.turn -= dt;
    if (L.t <= 0) { e.eleLost = null; return back(e); }
    if (L.turn <= 0) { L.ang += (Math.random() - 0.5) * 2.4; L.turn = 0.5 + Math.random() * 0.7; }
    const sp = (d.speed || 3) * L.speed * dt;
    const nx = e.position.x + Math.sin(L.ang) * sp, nz = e.position.z + Math.cos(L.ang) * sp;
    if (ctx.world.blocked(nx, nz, d.radius)) { L.ang += Math.PI * (0.6 + Math.random() * 0.8); L.turn = 0.5; }
    else { e.position.x = nx; e.position.z = nz; }
    e.facing = L.ang + Math.sin(L.t * 3) * 0.4; // olhando para os lados, procurando
    e.anim.play(d.anims.walk, { speed: (d.walkAnimSpeed || 1) * 0.7 });
    return;
  }
  if (e.state === 'elePuppet') {
    const P = e.elePup;
    if (!P) return back(e);
    P.t += dt;
    const o = P.target;
    if (o && o.alive) e.facing = Math.atan2(o.position.x - e.position.x, o.position.z - e.position.z);
    e.model.rotation.z = Math.sin(P.t * 60) * 0.06; // tremendo com o choque
    const pr = e.anim.progress();
    if (!P.hit && pr >= 0.5) {
      P.hit = true;
      if (o && o.targetable && Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z) <= P.reach + o.data.radius) {
        const dx = o.position.x - e.position.x, dz = o.position.z - e.position.z, dd = Math.hypot(dx, dz) || 0.01;
        c.bonusDamage(o, P.dmg, dx / dd, dz / dd, 'dmg', P.by);
        if (o.alive && o.hitReact) o.hitReact();
        if (c.log) c.log({ type: 'elePuppetHit', enemy: e, target: o, dmg: P.dmg });
      }
    }
    if (pr >= 0.92 || P.t > 1.4) { e.model.rotation.z = 0; e.elePup = null; back(e); }
  }
}

export function eleLeaveState(e, from) {
  if (from === 'eleLost') e.eleLost = null;
  if (from === 'elePuppet') { e.elePup = null; if (e.model) e.model.rotation.z = 0; }
}
