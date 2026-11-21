// Grimório Ancestral, lote 3 (14/11/2026), parte 1: Dragão de Fogo, Esfera de Plasma, Mãos do Abismo, Exército das
// Sombras e Eclipse. Mesmo formato do lote 1 (grimspells.js): { id, name, color, cast(K, p) }. Números em l1bless.js
// (L1.grim). Ganchos do Exército e do Eclipse em grimkit.js (onDeath, shadeHit, blindTarget, blindStrike, hit).
import * as THREE from 'three';
import { audio } from './audio.js';
import { setFlash } from './characters.js';
import { grimTex, handsPoint, VIOLET } from './grimlook.js';
import { GRIM as G, v3, rnd, FIRE, EMBER, VOID, addMat, flatGeo, floorGlow, flame, embers, grab, release } from './grimspells.js';
import { aimDir, wallEnd } from './grimspells2.js';

const PLASMA = 0x7fd8ff, SHADOW = 0x2a0a40;
const foesIn = (K, x, z, r) => K.foes().filter((e) => Math.hypot(e.position.x - x, e.position.z - z) <= r + e.data.radius);
const sprite = (K, color, tex = null, add = true) => { const s = K.vfx.sprite(tex || K.vfx.sparkTex, add); s.material.color.setHex(color); return s; };

// ---------- 4) Dragão de Fogo ----------
// Serpente de chamas que entra por um lado da sala, ondula passando pelo grupo de inimigos e sai pelo outro lado.
let DRG = null;
function makeDragon(n) {
  if (!DRG) DRG = { seg: new THREE.SphereGeometry(1, 12, 8), cone: new THREE.ConeGeometry(1, 1, 6), box: new THREE.BoxGeometry(1, 1, 1) };
  const body = new THREE.MeshStandardMaterial({ color: 0x8a1a06, emissive: 0xff4a10, emissiveIntensity: 1.1, roughness: 0.6, flatShading: true });
  const belly = new THREE.MeshStandardMaterial({ color: 0xffb040, emissive: 0xffa020, emissiveIntensity: 1.2, flatShading: true });
  const horn = new THREE.MeshStandardMaterial({ color: 0x2a1208, emissive: 0x401000, roughness: 0.7, flatShading: true });
  const segs = [];
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1), r = 0.78 * (1 - k * 0.78) + 0.12;
    const g = new THREE.Group();
    const m = new THREE.Mesh(DRG.seg, body); m.scale.set(r, r * 0.9, r * 1.25); g.add(m);
    if (i % 2 === 0 && i > 1) { const sp = new THREE.Mesh(DRG.cone, horn); sp.scale.set(r * 0.35, r * 0.9, r * 0.35); sp.position.y = r * 0.95; sp.rotation.x = -0.5; g.add(sp); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: null, color: FIRE, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(r * 3.4); g.add(glow);
    segs.push({ g, r, glow });
  }
  // Cabeça: focinho comprido, mandíbula, chifres para trás, olhos amarelos, bigodes de fogo.
  const head = new THREE.Group();
  const skull = new THREE.Mesh(DRG.box, body); skull.scale.set(1.1, 0.75, 1.3); head.add(skull);
  const snout = new THREE.Mesh(DRG.box, body); snout.scale.set(0.8, 0.5, 1.2); snout.position.set(0, -0.05, 1.05); head.add(snout);
  const jaw = new THREE.Mesh(DRG.box, belly); jaw.scale.set(0.72, 0.22, 1.3); jaw.position.set(0, -0.42, 0.85); head.add(jaw);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(DRG.cone, horn); h.scale.set(0.16, 1.3, 0.16); h.position.set(s * 0.4, 0.45, -0.45); h.rotation.set(-1.15, 0, s * 0.25); head.add(h);
    const eye = new THREE.Mesh(DRG.seg, new THREE.MeshBasicMaterial({ color: 0xfff27a })); eye.scale.setScalar(0.13); eye.position.set(s * 0.42, 0.18, 0.5); head.add(eye);
    const nose = new THREE.Mesh(DRG.cone, horn); nose.scale.set(0.08, 0.3, 0.08); nose.position.set(s * 0.25, 0.25, 1.45); nose.rotation.x = 0.6; head.add(nose);
  }
  head.scale.setScalar(1.15);
  return { segs, head, mats: [body, belly, horn] };
}
function fireDragon(K, p) {
  const D = G.dragon, { dx, dz, t } = aimDir(K, p, 4), B = K.bounds();
  const px = -dz, pz = dx, L = Math.hypot(B.x, B.z) + 7, ph = rnd(0, 6.28);
  // O caminho passa pelo grupo mirado: c = ponto mirado (ou à frente da Maga).
  const cx = t.x, cz = t.z;
  const path = (s) => {
    const w = Math.sin(s * 0.42 + ph) * D.amp * Math.min(1, (L - Math.abs(s)) / 6 + 0.35);
    return { x: cx + dx * s + px * w, z: cz + dz * s + pz * w, y: 1.9 + Math.sin(s * 0.33 + ph) * 0.7 };
  };
  const drg = makeDragon(D.segs);
  for (const s of drg.segs) { s.glow.material.map = K.vfx.sparkTex; K.scene.add(s.g); }
  K.scene.add(drg.head);
  const bodyLen = D.segs * D.gap, total = (2 * L + bodyLen) / D.speed;
  const hit = new Set();
  const burn = (e) => K.effect({ dur: D.burn, tick: 0.5, onTick: () => { if (e.alive) { K.hurt(e, D.burnDmg, 0, 0, 'dmg', p, true); embers(K, e.position.x, 1, e.position.z, 3, 0.4, FIRE, 3); } } });
  audio.play('rexRoar', p.position.x, p.position.z, { v: 1.1 }); audio.play('fireRoar', p.position.x, p.position.z, { v: 1.2 });
  K.shake(p, 0.4);
  let trailT = 0, floorT = 0, roarT = 1.2, gone = false;
  const cleanup = () => { if (gone) return; gone = true; for (const s of drg.segs) K.scene.remove(s.g); K.scene.remove(drg.head); };
  K.effect({ dur: total, onFrame: (dt, ef) => {
    const sh = -L + ef.t * D.speed;
    for (let i = 0; i < drg.segs.length; i++) {
      const s = sh - (i + 1) * D.gap, a = path(s), b = path(s + 0.3), sg = drg.segs[i];
      sg.g.position.set(a.x, a.y, a.z); sg.g.lookAt(b.x, b.y, b.z);
      sg.glow.material.opacity = 0.55 + 0.25 * Math.sin(ef.t * 18 + i);
      const out = Math.abs(s) > L - 1 ? 0 : 1; sg.g.visible = out > 0;
    }
    const h = path(sh), h2 = path(sh + 0.4);
    drg.head.position.set(h.x, h.y + 0.15, h.z); drg.head.lookAt(h2.x, h2.y + 0.15, h2.z);
    drg.head.visible = Math.abs(sh) < L - 0.5;
    if (!drg.head.visible) return;
    K.glow(h.x, h.z, FIRE, 30);
    trailT -= dt;
    if (trailT <= 0) { // fogo saindo do corpo e chamas da boca
      trailT = 0.025;
      const i = Math.floor(Math.random() * drg.segs.length), sg = drg.segs[i];
      if (sg.g.visible) { const s = sprite(K, Math.random() < 0.5 ? FIRE : EMBER); s.position.copy(sg.g.position); const sc = rnd(0.9, 1.7) * sg.r * 2; K.vfx.add(s, 0.5, (o, k) => { o.scale.setScalar(sc * (1 - k * 0.6)); o.material.opacity = 0.85 * (1 - k); o.position.y += 0.03; }); }
      const f = sprite(K, Math.random() < 0.6 ? EMBER : 0xfff0b0), fx = (h2.x - h.x) / 0.4, fz = (h2.z - h.z) / 0.4;
      f.position.set(h.x + fx * 1.6, h.y - 0.1, h.z + fz * 1.6); const fs = rnd(0.8, 1.4);
      K.vfx.add(f, 0.3, (o, k) => { o.position.x += fx * 0.12; o.position.z += fz * 0.12; o.scale.setScalar(fs * (1 + k)); o.material.opacity = 1 - k; });
    }
    floorT -= dt;
    if (floorT <= 0 && Math.abs(h.x) < B.x - 0.5 && Math.abs(h.z) < B.z - 0.5) { floorT = 0.07; flame(K, h.x + rnd(-0.5, 0.5), h.z + rnd(-0.5, 0.5), rnd(0.8, 1.3), 1.4); }
    roarT -= dt; if (roarT <= 0) { roarT = 1.4; audio.play('fireRoar', h.x, h.z, { v: 0.7 }); }
    for (const e of foesIn(K, h.x, h.z, D.r)) { // abocanha e queima quem está no caminho
      if (hit.has(e)) continue; hit.add(e);
      K.hurt(e, D.dmg, unit(h, h2).x, unit(h, h2).z, 'dmg big', p);
      if (e.alive) { burn(e); if (e.vel && !e.data.boss) e.vel.set(px, 0, pz).multiplyScalar(Math.sign(Math.random() - 0.5) * 9); }
      K.fx.explosion(v3(e.position.x, 1.3, e.position.z), 1.0); K.fx.shock(e.position.x, e.position.z, 3, FIRE, 0.35);
      audio.play('rexBite', e.position.x, e.position.z, { v: 0.6 });
    }
  }, onEnd: cleanup, onClear: cleanup });
}
const unit = (a, b) => { const x = b.x - a.x, z = b.z - a.z, d = Math.hypot(x, z) || 1; return { x: x / d, z: z / d }; };

// ---------- 16) Esfera de Plasma ----------
function plasmaOrb(K, p) {
  const P = G.plasma, { dx, dz } = aimDir(K, p, 4), hp = handsPoint(p);
  const end = wallEnd(K, hp.x, hp.z, dx, dz, 60, 1);
  const g = new THREE.Group(); g.position.set(hp.x, 1.7, hp.z);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff })); g.add(core);
  const mid = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16), addMat(PLASMA, 0.45)); g.add(mid);
  const out = new THREE.Mesh(new THREE.SphereGeometry(1.45, 24, 16), addMat(0x3a8fff, 0.25, null, THREE.BackSide)); g.add(out);
  const halo = sprite(K, PLASMA); halo.scale.setScalar(6); g.add(halo);
  const rings = [];
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.04, 6, 40), addMat(i ? PLASMA : 0xffffff, 0.8)); r.rotation.set(rnd(0, 3), rnd(0, 3), 0); g.add(r); rings.push(r); }
  K.scene.add(g);
  audio.play('charge', hp.x, hp.z, { v: 1 }); audio.play('zap', hp.x, hp.z, { v: 1.1 });
  K.fx.flare(hp.clone(), 4, PLASMA, 0.3);
  const travel = Math.min(P.maxT, end.d / P.speed);
  let arcT = 0, humT = 0, gone = false;
  const cleanup = () => { if (!gone) { gone = true; K.scene.remove(g); } };
  K.effect({ dur: travel, tick: P.tick, onTick: () => {
    for (const e of foesIn(K, g.position.x, g.position.z, P.r)) {
      const to = v3(e.position.x, 1.2, e.position.z);
      K.vfx.lightning(g.position.clone(), to, PLASMA, 0.35); K.vfx.lightning(g.position.clone(), to, 0xffffff, 0.12);
      K.vfx.sparks(to, PLASMA, 4);
      const ddx = e.position.x - g.position.x, ddz = e.position.z - g.position.z, d = Math.hypot(ddx, ddz) || 0.01;
      K.hurt(e, P.dmg, ddx / d, ddz / d, 'dmg', p, true);
    }
    audio.play('zap', g.position.x, g.position.z, { v: 0.45 });
  }, onFrame: (dt, ef) => {
    const k = Math.min(1, ef.t / Math.max(0.01, travel)), x = hp.x + dx * end.d * k, z = hp.z + dz * end.d * k;
    g.position.set(x, 1.7 + Math.sin(ef.t * 4) * 0.15, z);
    const pulse = 1 + 0.12 * Math.sin(ef.t * 30) + 0.05 * Math.random();
    mid.scale.setScalar(pulse); out.scale.setScalar(1 + 0.08 * Math.sin(ef.t * 13)); halo.material.opacity = 0.6 + 0.3 * Math.random();
    rings.forEach((r, i) => { r.rotation.x += dt * (3 + i); r.rotation.y += dt * (4 - i); });
    K.glow(x, z, PLASMA, 30 + 15 * Math.random());
    arcT -= dt;
    if (arcT <= 0) { // faíscas estalando em volta da bola
      arcT = 0.04;
      const a = rnd(0, 6.28), b = rnd(-1, 1), r = rnd(1.4, 2.6);
      K.vfx.lightning(g.position.clone(), v3(x + Math.cos(a) * r, g.position.y + b * 1.2, z + Math.sin(a) * r), Math.random() < 0.5 ? PLASMA : 0xffffff, 0.12);
    }
    humT -= dt; if (humT <= 0) { humT = 0.5; audio.play('orb', x, z, { v: 0.5 }); }
    for (const e of foesIn(K, x, z, P.r)) { // puxa devagar para perto
      if (e.data.boss || e.state === 'lanceFly') continue;
      const ddx = x - e.position.x, ddz = z - e.position.z, d = Math.hypot(ddx, ddz) || 0.01;
      if (d < 1.4) continue;
      e.position.x += ddx / d * P.pull * dt; e.position.z += ddz / d * P.pull * dt;
      if (K.c.world) K.c.world.resolveCircle(e.position, e.data.radius);
    }
  }, onEnd: () => { // estoura na parede
    const x = g.position.x, z = g.position.z;
    cleanup();
    K.fx.flare(v3(x, 1.7, z), 12, 0xffffff, 0.35); K.fx.flare(v3(x, 1.7, z), 8, PLASMA, 0.5);
    K.fx.shock(x, z, P.boomR * 1.4, PLASMA, 0.6); K.fx.crack(x, z, 3, 4, PLASMA);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; K.vfx.lightning(v3(x, 1.7, z), v3(x + Math.cos(a) * P.boomR, 0.3, z + Math.sin(a) * P.boomR), PLASMA, 0.3); }
    K.vfx.sparks(v3(x, 1.5, z), PLASMA, 22);
    K.glow(x, z, PLASMA, 80); K.shake(p, 0.6); K.ui.flash(p, true);
    audio.play('thunder', x, z, { v: 1.1 }); audio.play('boom', x, z, { v: 0.8 });
    for (const e of foesIn(K, x, z, P.boomR)) { const ddx = e.position.x - x, ddz = e.position.z - z, d = Math.hypot(ddx, ddz) || 0.01; K.hurt(e, P.boom, ddx / d, ddz / d, 'dmg big', p); }
  }, onClear: cleanup });
}

// ---------- 19) Mãos do Abismo ----------
let HAND = null;
function abyssHand(mat) {
  if (!HAND) HAND = { arm: new THREE.CylinderGeometry(0.2, 0.28, 1.8, 7).translate(0, 0.9, 0), palm: new THREE.BoxGeometry(0.55, 0.6, 0.24), seg: new THREE.CylinderGeometry(0.06, 0.08, 0.42, 5).translate(0, 0.21, 0) };
  const g = new THREE.Group();
  g.add(new THREE.Mesh(HAND.arm, mat));
  const palm = new THREE.Mesh(HAND.palm, mat); palm.position.y = 2.05; g.add(palm);
  const fingers = [];
  for (let i = 0; i < 5; i++) {
    const thumb = i === 4, base = new THREE.Group();
    base.position.set(thumb ? -0.3 : -0.2 + i * 0.135, thumb ? 2.0 : 2.32, 0);
    if (thumb) base.rotation.z = 0.9;
    const a = new THREE.Mesh(HAND.seg, mat); base.add(a);
    const j = new THREE.Group(); j.position.y = 0.4; base.add(j);
    const b = new THREE.Mesh(HAND.seg, mat); b.scale.set(0.85, 0.9, 0.85); j.add(b);
    g.add(base); fingers.push({ base, j });
  }
  return { g, fingers };
}
function abyssHands(K, p) {
  const A = G.abyss, foes = K.c.enemies.filter((e) => e.alive && !e.undead && !e.data.phantom); // quem ainda está nascendo também
  K.ui.dim(1.6);
  audio.play('rise', p.position.x, p.position.z, { v: 1.2 }); audio.play('summon', p.position.x, p.position.z, { v: 0.8 });
  if (!foes.length) { for (let i = 0; i < 5; i++) { const a = rnd(0, 6.28), r = rnd(2, 6); K.fx.smoke(v3(p.position.x + Math.cos(a) * r, 0.2, p.position.z + Math.sin(a) * r), 4, 1); } return; }
  const mat = new THREE.MeshStandardMaterial({ color: 0x0c0612, emissive: 0x5a1aa0, emissiveIntensity: 0.55, roughness: 0.85, flatShading: true, transparent: true, opacity: 1 });
  foes.forEach((e, i) => K.later(i * A.stagger, () => grabDown(K, p, e, mat)));
}
function grabDown(K, p, e, mat) {
  const A = G.abyss;
  if (!e.alive) return;
  const boss = !!e.data.boss, x0 = e.position.x, z0 = e.position.z, rr = e.data.radius + 0.25;
  // Poça escura no chão.
  const pool = new THREE.Mesh(flatGeo(), new THREE.MeshBasicMaterial({ map: grimTex().circle, color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
  pool.position.set(x0, 0.09, z0); pool.renderOrder = 3; K.scene.add(pool);
  const rim = floorGlow(K, x0, z0, rr + 1, VOID, A.rise + A.hold + A.sink + 0.5, 0.5);
  const hands = [];
  const n = boss ? 5 : 3, a0 = rnd(0, 6.28);
  for (let i = 0; i < n; i++) { const h = abyssHand(mat), a = a0 + (i / n) * 6.28; h.g.position.set(x0 + Math.cos(a) * rr, -2.6, z0 + Math.sin(a) * rr); h.g.rotation.y = -a + Math.PI / 2; h.g.scale.setScalar(boss ? 1.5 : 1.05); K.scene.add(h.g); hands.push({ ...h, a }); }
  K.fx.smoke(v3(x0, 0.3, z0), 5, 1.2);
  audio.play('crunch', x0, z0, { v: 0.5 });
  let held = false;
  const T1 = A.rise, T2 = T1 + A.hold, T3 = T2 + A.sink;
  const cleanup = () => { for (const h of hands) K.scene.remove(h.g); K.scene.remove(pool); };
  K.effect({ dur: T3 + 0.45, onFrame: (dt, ef) => {
    const t = ef.t;
    pool.scale.setScalar((rr + 1.1) * 2 * Math.min(1, t / 0.25)); pool.material.opacity = 0.85 * (t > T3 ? Math.max(0, 1 - (t - T3) / 0.45) : 1);
    pool.rotation.y += dt;
    const ex = e.alive ? e.position.x : x0, ez = e.alive ? e.position.z : z0;
    let up, curl, lean;
    if (t < T1) { const k = t / T1; up = -2.6 + 2.6 * (1 - (1 - k) ** 3); curl = 0; lean = 0.15; }
    else if (t < T2) { up = 0; curl = Math.min(1, (t - T1) / 0.15); lean = 0.55; }
    else { const k = Math.min(1, (t - T2) / A.sink); up = -3.2 * k * k; curl = 1; lean = 0.55; }
    for (const h of hands) {
      h.g.position.set(ex + Math.cos(h.a) * rr, up + (boss ? 0 : -0.35), ez + Math.sin(h.a) * rr);
      h.g.rotation.set(0, -h.a + Math.PI / 2, 0); h.g.rotateZ(lean); // inclinada para dentro, por cima dele
      for (const f of h.fingers) { f.base.rotation.x = -0.9 * curl; f.j.rotation.x = -1.1 * curl; }
    }
    if (t >= T1 && !held && e.alive) { // agarrou
      held = true;
      if (!boss && grab(e)) e.grimSpin = { abyss: true };
      else if (e.daze) e.daze(A.hold + A.sink);
      K.text('Agarrado!', e.position, 'bleed', 3);
      audio.play('grab', ex, ez, { v: 0.7 });
    }
    if (held && e.alive && e.state === 'lanceFly' && e.grimSpin && e.grimSpin.abyss) { // afundando no chão
      const k = t < T2 ? 0 : Math.min(1, (t - T2) / A.sink);
      e.position.y = -2.9 * k * k + (t < T2 ? Math.sin(t * 50) * 0.05 : 0);
      e.position.x = x0; e.position.z = z0;
      if (Math.random() < 0.3) K.fx.embers(v3(x0, 0.2, z0), 2, 0.6, VOID, 2);
    }
    if (t >= T3 && held !== 'done') {
      held = 'done';
      const under = e.alive && e.state === 'lanceFly' && e.grimSpin && e.grimSpin.abyss;
      K.fx.shock(x0, z0, 3, VOID, 0.4); K.fx.smoke(v3(x0, 0.2, z0), 8, 1.4); K.glow(x0, z0, VOID, 40);
      audio.play('headThud', x0, z0, { v: 0.8 });
      if (!e.alive) return;
      if (under) { // lá embaixo: quem não aguenta fica de vez (sem corpo); quem aguenta escala de volta
        e.grimSpin = null;
        e.noGrave = true; e.group.visible = false;
        release(K, e, 0, 0, 0, 0, p); // volta a ser alvo (lá embaixo ainda) para levar o dano
        K.hurt(e, A.dmg, 0, 1, 'dmg big', p);
        if (!e.alive) K.text('Arrastado para o abismo!', v3(x0, 0, z0), 'crit', 3.4);
        else { e.noGrave = false; e.group.visible = true; K.fx.smoke(v3(x0, 0.4, z0), 6, 1); K.text('Escapou!', e.position, 'block', 3); }
      } else K.hurt(e, boss ? A.boss : A.dmg, 0, 1, 'dmg big', p);
    }
  }, onEnd: cleanup, onClear: cleanup });
}

// ---------- 20) Exército das Sombras ----------
function shadowArmy(K, p) {
  const A = G.army, B = K.bounds();
  const spots = K.fallen.splice(Math.max(0, K.fallen.length - A.max));
  K.fallen.length = 0;
  while (spots.length < A.min) { const a = p.facing + rnd(-1.6, 1.6), r = rnd(2, 4); spots.push({ type: Math.random() < 0.3 ? 'warrior' : 'minion', x: p.position.x + Math.sin(a) * r, z: p.position.z + Math.cos(a) * r, facing: p.facing }); }
  K.text('LEVANTEM-SE!', p.position, 'crit', 3.6);
  K.ui.dim(0.8);
  audio.play('summon', p.position.x, p.position.z, { v: 1.2 }); audio.play('warcry', p.position.x, p.position.z, { v: 0.6 });
  K.fx.shock(p.position.x, p.position.z, 10, VOID, 0.8);
  spots.forEach((s, i) => K.later(0.2 + i * 0.1, () => {
    let x = Math.max(-B.x + 1, Math.min(B.x - 1, s.x)), z = Math.max(-B.z + 1, Math.min(B.z - 1, s.z));
    if (K.c.world && K.c.world.blocked(x, z, 0.5)) { x = p.position.x + rnd(-2, 2); z = p.position.z + rnd(-2, 2); }
    const pool = floorGlow(K, x, z, 1.6, VOID, 1.6, 0.7, grimTex().circle);
    pool.material.color.setHex(0x6a20c0);
    K.fx.pillar(x, z, 5, 1, VOID, 0.5); K.fx.smoke(v3(x, 0.3, z), 6, 1.2);
    const u = K.c.spawn(s.type, x, z, { revived: true, spawnAnim: 'Skeletons_Death_Resurrect', facing: s.facing || 0, undead: p });
    u.grimShade = true; u.noGrave = true; u.noUltCharge = true;
    u.hp = u.maxHp = A.hp;
    shadeLook(K, u);
    audio.play('rise', x, z, { v: 0.6 });
    K.log({ type: 'grimShade', enemy: u });
  }));
}
// Sombra: corpo quase preto com brilho roxo, olhos vermelhos e fumaça escura em volta.
function shadeLook(K, u) {
  for (const m of u.bodyMats) if (m.color) m.color.multiplyScalar(0.12);
  setFlash(u.bodyMats, 0.35, 0.35, 0.05, 0.7); setFlash(u.eyes, 3, 1, 0.1, 0.15);
  const aura = sprite(K, 0x000000, K.vfx.dustTex, false); aura.material.opacity = 0.4; aura.scale.set(2, 2.6, 1); aura.position.y = 1.2;
  u.group.add(aura);
  const glow = sprite(K, VOID); glow.material.opacity = 0.18; glow.scale.set(1.8, 2.4, 1); glow.position.y = 1.1; u.group.add(glow);
  u.grimAura = { aura, glow };
}

// ---------- 21) Eclipse ----------
let ECL = null;
function eclipseTex() {
  if (ECL) return ECL;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 50, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,240,220,1)'); gr.addColorStop(0.08, 'rgba(255,200,140,0.9)'); gr.addColorStop(0.35, 'rgba(200,120,255,0.35)'); gr.addColorStop(1, 'rgba(120,40,200,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, l = 70 + Math.random() * 55; g.strokeStyle = `rgba(255,220,190,${0.15 + Math.random() * 0.3})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); g.moveTo(128 + Math.cos(a) * 52, 128 + Math.sin(a) * 52); g.lineTo(128 + Math.cos(a) * l, 128 + Math.sin(a) * l); g.stroke(); }
  g.fillStyle = '#000'; g.beginPath(); g.arc(128, 128, 50, 0, 6.29); g.fill();
  ECL = new THREE.CanvasTexture(c); ECL.colorSpace = THREE.SRGBColorSpace;
  return ECL;
}
function eclipse(K, p) {
  const E = G.eclipse;
  K.ui.tint('rgba(0,0,0,0.97)', 0.88, 99, 'rgba(12,0,24,0.3)'); // apaga no fim do efeito (tempo de jogo)
  K.ui.flash(p, true);
  audio.play('portalOpen', p.position.x, p.position.z, { v: 1 }); audio.play('bell', p.position.x, p.position.z, { v: 0.9 });
  // O sol sendo coberto, no alto da sala.
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: eclipseTex(), transparent: true, depthWrite: false, depthTest: false }));
  sun.renderOrder = 5;
  K.vfx.add(sun, E.dur + 0.4, (o, k, dt) => { o.position.set(p.position.x, 7.5, p.position.z - 8); const s = 6.5 * Math.min(1, k * 6); o.scale.setScalar(s); o.material.rotation += dt * 0.2; o.material.opacity = Math.min(1, k * 6) * (k > 0.9 ? (1 - k) / 0.1 : 1); });
  const blind = [];
  for (const e of K.c.enemies.filter((o) => o.alive && !o.undead && !o.data.phantom)) {
    if (e.data.boss) { e.daze && e.daze(E.boss); K.text('Cego!', e.position, 'block', 3); continue; }
    e.grimBlindT = E.dur; e.grimBlindPick = 0;
    // Venda de sombra nos olhos + "?".
    const sc = e.group.scale.x || 1, band = sprite(K, 0x000000, K.vfx.dustTex, false);
    band.material.opacity = 1; band.scale.set(1.4 / sc, 0.7 / sc, 1); band.position.y = 1.95 / sc; e.group.add(band);
    const ring = sprite(K, VIOLET); ring.material.opacity = 0.8; ring.scale.set(1.8 / sc, 0.8 / sc, 1); ring.position.y = 1.95 / sc; e.group.add(ring);
    blind.push({ e, band, ring });
    K.text('?', e.position, 'block', 3);
  }
  const off = () => { for (const b of blind) { b.e.grimBlindT = 0; b.e.betrayLeft = 0; b.e.grimBlindSpot = null; b.band.parent && b.band.parent.remove(b.band); b.ring.parent && b.ring.parent.remove(b.ring); } };
  K.effect({ dur: E.dur, onFrame: (dt, ef) => {
    for (const b of blind) {
      if (!b.e.alive) continue;
      b.e.grimBlindT = E.dur - ef.t; b.e.betrayLeft = b.e.grimBlindT; // arqueiros atiram nos outros
      b.ring.material.opacity = 0.65 + 0.3 * Math.sin(ef.t * 8 + b.e.id);
    }
    K.glow(p.position.x, p.position.z, VIOLET, 6);
  }, onEnd: () => { off(); K.ui.tintOff(); K.ui.flash(p, true); audio.play('bell', p.position.x, p.position.z, { v: 0.6 }); }, onClear: off });
  K.log({ type: 'grimEclipse', n: blind.length });
}

export const SPELLS4 = [
  { id: 'dragao', name: 'Dragão de Fogo', color: FIRE, cast: fireDragon },
  { id: 'plasma', name: 'Esfera de Plasma', color: PLASMA, cast: plasmaOrb },
  { id: 'abismo', name: 'Mãos do Abismo', color: VOID, cast: abyssHands },
  { id: 'exercito', name: 'Exército das Sombras', color: VOID, cast: shadowArmy },
  { id: 'eclipse', name: 'Eclipse', color: SHADOW, cast: eclipse },
];
