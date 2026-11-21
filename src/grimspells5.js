// Grimório Ancestral, lote 3 (14/11/2026), parte 2: Foice do Ceifador, Raio Arcano, Chuva de Estrelas, Portal e
// Gravidade Zero. Mesmo formato do lote 1 (grimspells.js): { id, name, color, cast(K, p) }. Números em l1bless.js.
import * as THREE from 'three';
import { audio } from './audio.js';
import { grimTex, handsPoint, castCircle, VIOLET, GOLD, PALE } from './grimlook.js';
import { GRIM as G, v3, rnd, VOID, addMat, flatGeo, floorGlow, grab, release } from './grimspells.js';
import { aimDir, wallEnd } from './grimspells2.js';

const ARC = 0xc77dff, STAR = 0xfff3c4;
const foesIn = (K, x, z, r) => K.foes().filter((e) => Math.hypot(e.position.x - x, e.position.z - z) <= r + e.data.radius);
const sprite = (K, color, tex = null, add = true) => { const s = K.vfx.sprite(tex || K.vfx.sparkTex, add); s.material.color.setHex(color); return s; };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- 22) Foice do Ceifador ----------
// Foice gigante de sombra: o cabo sai da Maga e a lâmina varre a sala inteira em volta dela (2 voltas).
function makeScythe(R) {
  const g = new THREE.Group(), RT = R; R = Math.min(R * 0.6, 8.5); // o cabo/lâmina visíveis na tela; o rastro cobre a sala toda
  const dark = new THREE.MeshStandardMaterial({ color: 0x0a0610, emissive: 0x3a0a6a, emissiveIntensity: 0.6, roughness: 0.7, transparent: true, opacity: 1 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, R, 8).rotateZ(Math.PI / 2).translate(R / 2, 0, 0), dark); g.add(pole);
  for (const x of [R * 0.25, R * 0.55, R * 0.82]) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 6, 12).rotateY(Math.PI / 2), dark); b.position.x = x; g.add(b); }
  // Lâmina: meia-lua comprida na ponta, curvada para o lado do giro (-z) e para trás.
  const L = 5.5, sh = new THREE.Shape();
  sh.moveTo(0, 0.3); sh.quadraticCurveTo(L * 0.55, -0.9, L, -2.2); sh.quadraticCurveTo(L * 0.45, -0.2, 0, -0.5); sh.lineTo(0, 0.3); // curva para dentro (para a Maga)
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }).translate(0, 0, -0.06)
    .applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0))); // deitada, apontando para a frente do giro
  const blade = new THREE.Mesh(geo, dark); blade.position.set(R - 0.1, 0.1, 0); g.add(blade);
  const edge = new THREE.Mesh(geo, addMat(ARC, 0.8, null, THREE.DoubleSide)); edge.position.copy(blade.position); edge.scale.set(1.05, 2.5, 1.05); g.add(edge);
  // Rastro: leque escuro atrás do cabo.
  const trail = new THREE.Mesh(new THREE.RingGeometry(0.6, RT + 0.4, 48, 1, 0, 1.1).rotateX(-Math.PI / 2), addMat(ARC, 0.35, null, THREE.DoubleSide));
  trail.position.y = -0.4; g.add(trail);
  const dk = new THREE.Mesh(new THREE.RingGeometry(0.6, RT + 0.4, 48, 1, 0, 0.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
  dk.position.y = -0.45; g.add(dk);
  return { g, dark, edge, trail, dk };
}
function reaperScythe(K, p) {
  const S = G.scythe, B = K.bounds(), x0 = p.position.x, z0 = p.position.z;
  let R = 0; for (const [cx, cz] of [[B.x, B.z], [-B.x, B.z], [B.x, -B.z], [-B.x, -B.z]]) R = Math.max(R, Math.hypot(cx - x0, cz - z0));
  R = Math.min(R + 0.5, 28);
  const sc = makeScythe(R), a0 = p.facing + Math.PI / 2;
  sc.g.position.set(x0, 1.3, z0); sc.g.rotation.y = a0; sc.g.scale.setScalar(0.01);
  K.scene.add(sc.g);
  K.ui.dim(S.appear + S.dur);
  K.fx.smoke(v3(x0, 1.5, z0), 10, 1.6); K.fx.shock(x0, z0, 5, VOID, 0.5);
  audio.play('summon', x0, z0, { v: 1 }); audio.play('bladeSing', x0, z0, { v: 1 });
  const last = new Map(); let ang = 0, whooshT = 0, gone = false;
  const cleanup = () => { if (!gone) { gone = true; K.scene.remove(sc.g); } };
  const total = S.appear + S.dur + 0.35;
  K.effect({ dur: total, onFrame: (dt, ef) => {
    const t = ef.t, x = p.position.x, z = p.position.z;
    sc.g.position.set(x, 1.3, z);
    if (t < S.appear) { const k = t / S.appear; sc.g.scale.setScalar(0.2 + 0.8 * k * k); sc.g.rotation.y = a0 - k * 0.6; return; }
    sc.g.scale.setScalar(1);
    const k = Math.min(1, (t - S.appear) / S.dur), ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const prev = ang; ang = ease * S.turns * Math.PI * 2;
    sc.g.rotation.y = a0 - 0.6 - ang; // gira no sentido horário visto de cima
    const fade = t > S.appear + S.dur ? Math.max(0, 1 - (t - S.appear - S.dur) / 0.35) : 1;
    sc.dark.opacity = fade; sc.edge.material.opacity = 0.8 * fade; sc.trail.material.opacity = 0.5 * fade * Math.min(1, (ang - prev) / Math.max(dt, 1e-3) / 3); sc.dk.material.opacity = 0.45 * fade;
    K.glow(x, z, VOID, 18);
    whooshT -= ang - prev; if (whooshT <= 0 && k < 1) { whooshT = Math.PI * 0.9; audio.play('swingHeavy', x, z, { v: 1 }); audio.play('spin', x, z, { v: 0.6 }); K.shake(p, 0.25); }
    if (k >= 1) return;
    // Quem a lâmina passa por cima leva o golpe (uma vez por volta).
    const cur = sc.g.rotation.y, from = a0 - 0.6 - prev;
    for (const e of K.foes()) {
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz);
      if (d > R + e.data.radius) continue;
      const ea = Math.atan2(-dz, dx); // ângulo no mesmo jeito que rotation.y (cabo apontando para +x local)
      const w0 = wrap(from - ea);
      if (w0 < -0.02 || w0 > from - cur + 0.02 || (last.get(e) || -9) > ef.t - 0.45) continue; // a lâmina passou por ele agora
      last.set(e, ef.t);
      const nx = -dz / (d || 1), nz = dx / (d || 1);
      K.hurt(e, S.dmg, nx, nz, 'dmg big', p);
      K.vfx.sparks(v3(e.position.x, 1.2, e.position.z), ARC, 8); K.fx.flare(v3(e.position.x, 1.2, e.position.z), 2.2, VOID, 0.2);
      audio.play('hit', e.position.x, e.position.z, { v: 0.7 });
      if (e.alive && e.vel && !e.data.boss) e.vel.set(nx, 0, nz).multiplyScalar(7);
    }
  }, onEnd: () => { cleanup(); K.fx.smoke(v3(p.position.x, 1.3, p.position.z), 8, 1.4); }, onClear: cleanup });
}

// ---------- 23) Raio Arcano ----------
function arcaneBeam(K, p) {
  const R = G.beam, { a } = aimDir(K, p, 3), dx = Math.sin(a), dz = Math.cos(a);
  castCircle(K.vfx, p, ARC, 3.6);
  audio.play('charge', p.position.x, p.position.z, { v: 1.3 });
  for (let i = 0; i < 30; i++) { // luz sendo puxada para as mãos
    const s = sprite(K, i % 2 ? ARC : 0xffffff), ang = rnd(0, 6.28), r = rnd(2, 5), h = rnd(0, 3), sc = rnd(0.15, 0.3);
    K.vfx.add(s, R.charge, (o, k) => { const hp = handsPoint(p), rr = r * (1 - k); o.position.set(hp.x + Math.cos(ang) * rr, hp.y + (h - hp.y) * (1 - k), hp.z + Math.sin(ang) * rr); o.scale.setScalar(sc); o.material.opacity = Math.min(1, k * 3); });
  }
  K.later(R.charge, () => {
    const g = new THREE.Group();
    const mk = (r, color, op, side = THREE.FrontSide) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, R.len, 20, 1, true).rotateX(Math.PI / 2).translate(0, 0, R.len / 2), addMat(color, op, null, side)); g.add(m); return m; };
    const core = mk(0.42, 0xffffff, 1), mid = mk(0.95, ARC, 0.7), outer = mk(R.w + 0.2, 0x6a2cff, 0.28, THREE.DoubleSide);
    const rings = [];
    for (let i = 0; i < 10; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(R.w * 0.85, 0.07, 6, 28), addMat(i % 2 ? ARC : 0xffffff, 0.8)); g.add(r); rings.push({ m: r, z: i * 4 }); }
    const mouth = sprite(K, 0xffffff); mouth.scale.setScalar(5); g.add(mouth);
    K.scene.add(g);
    K.ui.flash(p, true); K.shake(p, 0.7);
    audio.play('mechPower', p.position.x, p.position.z, { v: 1.1 }); audio.play('zap', p.position.x, p.position.z, { v: 1.3 });
    const hp0 = handsPoint(p), wall = wallEnd(K, hp0.x, hp0.z, dx, dz, 60, 0.3);
    let gone = false, humT = 0, wallT = 0;
    const cleanup = () => { if (!gone) { gone = true; K.scene.remove(g); } };
    K.effect({ dur: R.dur, tick: R.tick, onTick: () => {
      const o = g.position;
      for (const e of K.foes()) {
        const ex = e.position.x - o.x, ez = e.position.z - o.z, along = ex * dx + ez * dz, side = Math.abs(ex * dz - ez * dx);
        if (along < -0.5 || side > R.w + e.data.radius) continue;
        K.hurt(e, R.dmg, dx, dz, 'dmg', p, true);
        if (e.alive && !e.data.boss && e.state !== 'lanceFly') { e.position.x += dx * R.push * R.tick; e.position.z += dz * R.push * R.tick; if (K.c.world) K.c.world.resolveCircle(e.position, e.data.radius); }
        if (Math.random() < 0.5) K.vfx.sparks(v3(e.position.x, 1.3, e.position.z), ARC, 4);
      }
    }, onFrame: (dt, ef) => {
      const hp = handsPoint(p);
      g.position.set(hp.x, 1.3, hp.z); g.rotation.y = a;
      const k = ef.t / R.dur, on = Math.min(1, ef.t / 0.08) * (k > 0.85 ? (1 - k) / 0.15 : 1), wob = 1 + 0.12 * Math.sin(ef.t * 40);
      core.scale.set(on * wob, on * wob, 1); mid.scale.set(on * (2 - wob), on * (2 - wob), 1); outer.scale.set(on, on, 1);
      mid.material.opacity = 0.7 * on; outer.material.opacity = 0.28 * on; mouth.material.opacity = on; mouth.scale.setScalar(4 + 2 * Math.random());
      for (const r of rings) { r.z = (r.z + dt * 30) % 40; r.m.position.z = r.z; r.m.scale.setScalar(on * (0.7 + 0.3 * Math.sin(r.z))); r.m.material.opacity = 0.8 * on * (1 - r.z / 40); }
      K.glow(hp.x + dx * 4, hp.z + dz * 4, ARC, 60);
      if (Math.random() < 0.3) K.shake(p, 0.15);
      humT -= dt; if (humT <= 0) { humT = 0.35; audio.play('zap', hp.x, hp.z, { v: 0.6 }); }
      wallT -= dt;
      if (wallT <= 0 && wall.d < R.len) { // atravessa a parede: o ponto onde ela é furada solta faíscas e pedras
        wallT = 0.12;
        const wx = hp.x + dx * (wall.d + 0.6), wz = hp.z + dz * (wall.d + 0.6);
        K.fx.flare(v3(wx, 1.3, wz), rnd(3, 5), ARC, 0.15); K.vfx.sparks(v3(wx, 1.3, wz), 0xffffff, 6);
        if (Math.random() < 0.4) K.fx.rocks(wx - dx * 0.8, wz - dz * 0.8, 2, 0.6);
      }
    }, onEnd: cleanup, onClear: cleanup });
  });
}

// ---------- 25) Chuva de Estrelas ----------
let STARTEX = null;
function starTex() { // estrela de 4 pontas brilhante
  if (STARTEX) return STARTEX;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,250,220,0.6)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath(); g.moveTo(64, 2); g.quadraticCurveTo(70, 58, 126, 64); g.quadraticCurveTo(70, 70, 64, 126); g.quadraticCurveTo(58, 70, 2, 64); g.quadraticCurveTo(58, 58, 64, 2); g.fill();
  STARTEX = new THREE.CanvasTexture(c); STARTEX.colorSpace = THREE.SRGBColorSpace;
  return STARTEX;
}
const STAR_COLORS = [0xffffff, STAR, 0x9fe8ff, 0xffb8f0, GOLD];
function starfall(K, p) {
  const S = G.stars, B = K.bounds(), x0 = p.position.x, z0 = p.position.z;
  K.ui.tint('rgba(4,8,40,0.95)', 0.8, 99, 'rgba(10,20,60,0.3)');
  audio.play('bell', x0, z0, { v: 1 }); audio.play('summon', x0, z0, { v: 0.7 });
  for (let i = 0; i < 45; i++) { // céu estrelado no alto
    const s = sprite(K, STAR_COLORS[i % 5], starTex()), sx = rnd(-B.x - 4, B.x + 4), sz = rnd(-B.z - 8, B.z), sy = rnd(7, 10), sc = rnd(0.25, 0.7), ph = rnd(0, 6.28);
    K.vfx.add(s, S.dur + 0.6, (o, k) => { o.position.set(sx, sy, sz); o.scale.setScalar(sc * (0.7 + 0.3 * Math.sin(k * 40 + ph))); o.material.opacity = Math.min(1, k * 8) * (k > 0.9 ? (1 - k) / 0.1 : 1); });
  }
  const drop = (tx, tz) => {
    const col = STAR_COLORS[Math.floor(Math.random() * 5)], st = sprite(K, col, starTex()), from = v3(tx - 6, 15, tz - 4), sc = rnd(1.2, 1.9);
    let trailT = 0, done = false;
    K.vfx.add(st, S.fall, (o, k, dt) => {
      o.position.lerpVectors(from, v3(tx, 0.5, tz), k * k); o.scale.setScalar(sc); o.material.rotation += dt * 8;
      trailT -= dt;
      if (trailT <= 0) { trailT = 0.02; const t = sprite(K, col); t.position.copy(o.position); const ts = sc * 0.6; K.vfx.add(t, 0.3, (q, kk) => { q.scale.setScalar(ts * (1 - kk)); q.material.opacity = 0.8 * (1 - kk); }); }
      if (k >= 1 && !done) {
        done = true;
        K.fx.flare(v3(tx, 0.8, tz), 3.4, col, 0.25); K.fx.shock(tx, tz, S.r * 1.3, col, 0.35); K.vfx.sparks(v3(tx, 0.5, tz), col, 6);
        floorGlow(K, tx, tz, 1, col, 0.8, 0.6, starTex());
        K.glow(tx, tz, col, 30);
        audio.play('zap', tx, tz, { v: 0.4 });
        for (const e of foesIn(K, tx, tz, S.r)) { const ddx = e.position.x - tx, ddz = e.position.z - tz, d = Math.hypot(ddx, ddz) || 0.01; K.hurt(e, S.dmg, ddx / d, ddz / d, 'dmg', p); }
      }
    });
  };
  let n = 0;
  K.effect({ dur: S.dur, tick: S.every, onTick: () => {
    n++;
    const foes = K.foes();
    if (foes.length && Math.random() < S.aimed) { const e = foes[Math.floor(Math.random() * foes.length)]; drop(e.position.x + rnd(-0.6, 0.6), e.position.z + rnd(-0.6, 0.6)); }
    else for (let t = 0; t < 10; t++) { const x = rnd(-B.x + 1, B.x - 1), z = rnd(-B.z + 1, B.z - 1); if (K.c.world && K.c.world.blocked(x, z, 0.3)) continue; drop(x, z); break; }
    if (n % 12 === 0) audio.play('bladeSing', x0, z0, { v: 0.4 });
  }, onEnd: () => K.later(0.5, () => K.ui.tintOff()) });
}

// ---------- 27) Portal ----------
function portalDisc(K, r, color) {
  const g = new THREE.Group();
  const dark = new THREE.Mesh(flatGeo(), new THREE.MeshBasicMaterial({ map: K.vfx.sparkTex, color: 0x000000, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })); dark.scale.setScalar(r * 2.1); g.add(dark);
  const rings = [];
  for (const [s, c, sp] of [[2.3, color, 2], [1.7, PALE, -3], [1.1, color, 4.5]]) { const m = new THREE.Mesh(flatGeo(), addMat(c, 0.85, grimTex().circle, THREE.DoubleSide)); m.scale.setScalar(r * s); m.position.y = 0.01; g.add(m); rings.push({ m, sp }); }
  const swirl = new THREE.Mesh(flatGeo(), addMat(color, 0.5, K.vfx.ringTex, THREE.DoubleSide)); swirl.scale.setScalar(r * 2.4); g.add(swirl); rings.push({ m: swirl, sp: 6 });
  return { g, rings, dark };
}
function portal(K, p) {
  const P = G.portal, t = K.aim(p, P.r), x = t.x, z = t.z;
  const low = portalDisc(K, P.r, VIOLET), high = portalDisc(K, P.r * 0.8, 0x6fd8ff);
  low.g.position.set(x, 0.1, z); low.g.scale.setScalar(0.01); K.scene.add(low.g);
  high.g.position.set(x, P.h, z); high.g.scale.setScalar(0.01); K.scene.add(high.g);
  audio.play('portalOpen', x, z, { v: 1.3 });
  const eaten = [], s0 = new Map();
  let gone = false;
  const restore = (e) => { e.group.visible = true; if (s0.has(e)) e.group.scale.copy(s0.get(e)); };
  const cleanup = () => {
    if (gone) return; gone = true; K.scene.remove(low.g); K.scene.remove(high.g);
    for (const e of eaten) if (e.alive && e.state === 'lanceFly') { restore(e); e.grimSpin = null; release(K, e, 0, 1, 0, 0, p); }
  };
  const spit = (e, i) => K.later(i * 0.1, () => { // cai do portal do teto
    if (gone || !e.alive || e.state !== 'lanceFly') return;
    restore(e);
    const sx = x + rnd(-P.r * 0.6, P.r * 0.6), sz = z + rnd(-P.r * 0.6, P.r * 0.6);
    e.position.set(sx, P.h - 0.5, sz);
    K.fx.flare(v3(sx, P.h - 0.5, sz), 3, 0x6fd8ff, 0.2);
    let vy = 0;
    K.effect({ dur: 2, onFrame: (dt, ef) => {
      if (!e.alive || e.state !== 'lanceFly') { ef.dur = ef.t; return; }
      vy -= 32 * dt; e.position.y = Math.max(0, e.position.y + vy * dt); e.group.rotation.y += dt * 10; if (e.model) e.model.rotation.x = Math.PI * 0.9;
      if (e.position.y <= 0) {
        ef.dur = ef.t; e.grimSpin = null;
        K.fx.shock(sx, sz, P.landR * 1.4, VIOLET, 0.35); K.fx.rocks(sx, sz, 8, 0.9); K.fx.crack(sx, sz, 1.6, 3, VIOLET);
        K.shake(p, 0.35); audio.play('headThud', sx, sz, { v: 0.9 });
        for (const o of foesIn(K, sx, sz, P.landR)) if (o !== e) { const ddx = o.position.x - sx, ddz = o.position.z - sz, d = Math.hypot(ddx, ddz) || 0.01; K.hurt(o, P.landDmg, ddx / d, ddz / d, 'dmg', p); }
        release(K, e, 0, 1, 0, P.dmg, p);
      }
    } });
  });
  K.effect({ dur: P.dur + 0.4 + 1.6, onFrame: (dt, ef) => {
    const T = ef.t, openLow = T < P.dur ? Math.min(1, T / 0.3) : Math.max(0, 1 - (T - P.dur) / 0.3);
    const openHigh = T < P.dur ? 0 : T < P.dur + 1.3 ? Math.min(1, (T - P.dur) / 0.3) : Math.max(0, 1 - (T - P.dur - 1.3) / 0.3);
    low.g.scale.setScalar(Math.max(0.01, openLow)); high.g.scale.setScalar(Math.max(0.01, openHigh));
    for (const d of [low, high]) for (const r of d.rings) r.m.rotation.y += dt * r.sp;
    if (T >= P.dur && !ef.spat) { ef.spat = true; audio.play('portalOpen', x, z, { v: 1 }); K.fx.flare(v3(x, P.h, z), 6, 0x6fd8ff, 0.3); eaten.forEach(spit); for (const e of foesIn(K, x, z, P.r)) if (e.data.boss) K.hurt(e, P.boss, 0, 1, 'dmg big', p); }
    if (T >= P.dur) return;
    K.glow(x, z, VIOLET, 25);
    if (Math.random() < 0.4) { const a = rnd(0, 6.28), r = rnd(2, P.r * 1.5), s = sprite(K, VIOLET), sc = rnd(0.15, 0.35); K.vfx.add(s, 0.5, (q, kk) => { const rr = r * (1 - kk), aa = a + kk * 4; q.position.set(x + Math.cos(aa) * rr, 0.3 + kk * 0.2, z + Math.sin(aa) * rr); q.scale.setScalar(sc); q.material.opacity = 1 - kk; }); }
    for (const e of K.foes()) { // puxa para o centro; quem chega no meio é engolido
      const ddx = x - e.position.x, ddz = z - e.position.z, d = Math.hypot(ddx, ddz) || 0.01;
      if (d > P.r * 1.6 + e.data.radius) continue;
      if (!e.data.boss && d < 1.1 && grab(e)) {
        e.grimSpin = { portal: true }; eaten.push(e); s0.set(e, e.group.scale.clone());
        const s = s0.get(e).clone(), ex = e.position.x, ez = e.position.z;
        K.effect({ dur: 0.3, onFrame: (dt2, ef2) => { if (!e.alive || e.state !== 'lanceFly') return; const k = ef2.t / 0.3; e.group.scale.copy(s).multiplyScalar(Math.max(0.05, 1 - k)); e.position.set(ex + (x - ex) * k, -k * 1.2, ez + (z - ez) * k); e.group.rotation.y += dt2 * 20; }, onEnd: () => { if (e.state === 'lanceFly' && !gone) e.group.visible = false; } });
        K.text('Engolido!', e.position, 'block', 3); audio.play('crunch', e.position.x, e.position.z, { v: 0.5 });
        continue;
      }
      const sp = P.pull * (e.data.boss ? 0.15 : 1) * (0.4 + 0.6 * (1 - Math.min(1, d / (P.r * 1.6))));
      e.position.x += ddx / d * Math.min(d, sp * dt); e.position.z += ddz / d * Math.min(d, sp * dt);
      if (e.vel) e.vel.set(0, 0, 0);
    }
  }, onEnd: cleanup, onClear: cleanup });
}

// ---------- 28) Gravidade Zero ----------
function zeroGravity(K, p) {
  const Z = G.zero, B = K.bounds(), x0 = p.position.x, z0 = p.position.z;
  K.fx.shock(x0, z0, Math.hypot(B.x, B.z), VIOLET, 0.9); K.ui.flash(p, true);
  audio.play('portalOpen', x0, z0, { v: 0.9 }); audio.play('charge', x0, z0, { v: 1 });
  for (let i = 0; i < 50; i++) { // poeira e pedrinhas subindo devagar pela sala
    const s = sprite(K, i % 3 ? 0xd8c8ff : VIOLET, i % 2 ? K.vfx.dustTex : null, i % 2 === 0), sx = rnd(-B.x, B.x), sz = rnd(-B.z, B.z), sc = rnd(0.1, 0.3), sp = rnd(0.4, 1.2);
    K.vfx.add(s, Z.dur, (o, k) => { o.position.set(sx + Math.sin(k * 6 + sx) * 0.3, 0.2 + sp * k * Z.dur, sz); o.scale.setScalar(sc); o.material.opacity = Math.min(1, k * 6) * (k > 0.85 ? (1 - k) / 0.15 : 1); });
  }
  const floaters = [];
  for (const e of K.c.enemies.filter((o) => o.alive && !o.undead && !o.data.phantom)) {
    if (e.data.boss) { e.daze && e.daze(1); floaters.push({ e, boss: true }); continue; }
    if (!grab(e)) continue;
    e.grimSpin = { zero: true };
    const f = { e, h: rnd(Z.h * 0.75, Z.h * 1.25), ph: rnd(0, 6.28), spin: rnd(-1.5, 1.5), tx: rnd(-0.5, 0.5), tz: rnd(-0.5, 0.5), x: e.position.x, z: e.position.z };
    f.ring = floorGlow(K, e.position.x, e.position.z, 1.1, VIOLET, Z.dur + 0.3, 0.5, grimTex().circle);
    floaters.push(f);
  }
  K.text('Gravidade zero!', p.position, 'crit', 3.4);
  let slammed = false;
  const drop = () => {
    slammed = true;
    K.fx.shock(x0, z0, Math.hypot(B.x, B.z), VIOLET, 0.6); K.shake(p, 0.9); K.ui.flash(p, true);
    audio.play('boom', x0, z0, { v: 1.2 }); audio.play('mechSlam', x0, z0, { v: 0.9 });
    for (const f of floaters) {
      const e = f.e;
      if (!e.alive) continue;
      if (f.boss) { K.hurt(e, Z.boss, 0, 1, 'dmg big', p); continue; }
      if (e.state !== 'lanceFly' || !e.grimSpin || !e.grimSpin.zero) continue;
      const y0 = e.position.y;
      K.effect({ dur: 0.16, onFrame: (dt, ef) => { if (e.alive && e.state === 'lanceFly') e.position.y = y0 * (1 - (ef.t / 0.16) ** 2); }, onEnd: () => {
        if (!e.alive || e.state !== 'lanceFly') return;
        const x = e.position.x, z = e.position.z;
        e.grimSpin = null;
        K.fx.shock(x, z, Z.r * 1.4, VIOLET, 0.35); K.fx.crack(x, z, 1.8, 3, VIOLET); K.fx.rocks(x, z, 8, 1); K.vfx.dust(v3(x, 0.2, z), v3(0, 1, 0), 6);
        audio.play('headThud', x, z, { v: 0.8 });
        for (const o of foesIn(K, x, z, Z.r)) if (o !== e) K.hurt(o, Z.splash, 0, 1, 'dmg', p, true);
        release(K, e, 0, 1, 0, Z.dmg, p);
      } });
    }
  };
  K.effect({ dur: Z.dur, onFrame: (dt, ef) => {
    K.glow(x0, z0, VIOLET, 8);
    for (const f of floaters) {
      if (f.boss) continue;
      const e = f.e;
      if (!e.alive || e.state !== 'lanceFly' || !e.grimSpin || !e.grimSpin.zero) continue;
      const up = Math.min(1, ef.t / Z.rise), k = 1 - (1 - up) ** 3;
      e.position.set(f.x + f.tx * ef.t, f.h * k + Math.sin(ef.t * 2 + f.ph) * 0.2, f.z + f.tz * ef.t);
      e.group.rotation.y += dt * f.spin;
      if (e.model) { e.model.rotation.x = Math.sin(ef.t * 1.3 + f.ph) * 0.9; e.model.rotation.z = Math.cos(ef.t * 1.1 + f.ph) * 0.6; }
      if (Math.random() < 0.05) K.vfx.sparks(v3(e.position.x, e.position.y + 1, e.position.z), VIOLET, 2);
    }
  }, onEnd: () => { if (!slammed) drop(); }, onClear: () => { for (const f of floaters) if (!f.boss && f.e.alive && f.e.state === 'lanceFly') { f.e.grimSpin = null; release(K, f.e, 0, 1, 0, 0, p); } } });
}

export const SPELLS5 = [
  { id: 'foice', name: 'Foice do Ceifador', color: VOID, cast: reaperScythe },
  { id: 'arcano', name: 'Raio Arcano', color: ARC, cast: arcaneBeam },
  { id: 'estrelas', name: 'Chuva de Estrelas', color: STAR, cast: starfall },
  { id: 'portal', name: 'Portal', color: VIOLET, cast: portal },
  { id: 'gravidade', name: 'Gravidade Zero', color: VIOLET, cast: zeroGravity },
];
