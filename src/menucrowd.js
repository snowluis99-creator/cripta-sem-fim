// Esqueletos do jogo passeando na frente da cripta (menu inicial). Usado por menuscene.js.
// Modelos e animações reais (packed/), desenhados num canvas 3D transparente entre o fundo e a grama.
// Um "diretor" escolhe de tempos em tempos uma cena curta: patrulha, duelo, emboscada, amigos,
// cortejo do Rei Skullbone, ritual do Necromante e o Ceifador que espanta todo mundo.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { loadAll, getGltf } from './assets.js';
import { makePlays } from './menuplays.js';

let view = null; // dados da cena 2D (tamanho, mouse, posição da cripta, sons) — vem de menuscene.js
const cache = { get: (p) => getGltf(p) };

const ANIMS = ['General', 'MovementBasic', 'MovementAdvanced', 'CombatMelee', 'Special', 'Simulation', 'CombatRanged'].map((n) => `animations/Rig_Medium_${n}.glb`);
const KINDS = {
  minion: { model: 'enemies/Skeleton_Minion.glb', r: 'weapons/skeletons/Skeleton_Blade.gltf' },
  warrior: { model: 'enemies/Skeleton_Warrior.glb', r: 'weapons/skeletons/Skeleton_Axe.gltf', l: 'weapons/skeletons/Skeleton_Shield_Large_A.gltf', shield: true },
  archer: { model: 'enemies/Skeleton_Rogue.glb', r: 'weapons/skeletons/Skeleton_Crossbow.gltf' },
  mage: { model: 'enemies/Skeleton_Mage.glb', r: 'weapons/skeletons/Skeleton_Staff.gltf' },
  assassin: { model: 'enemies/Skeleton_Rogue.glb', r: 'weapons/extra/dagger_A.gltf', l: 'weapons/extra/dagger_A.gltf', tint: 0x26262e },
  king: { model: 'enemies/Skeleton_Warrior.glb', r: 'weapons/skeletons/Skeleton_Axe.gltf', l: 'weapons/skeletons/Skeleton_Shield_Large_B.gltf', scale: 1.4, shield: true },
  necro: { model: 'enemies/Skeleton_Mage.glb', r: 'weapons/skeletons/Skeleton_Staff.gltf', scale: 1.8 },
  reaper: { model: 'enemies/Skeleton_Rogue.glb', r: 'weapons/extra/halberd.gltf', scale: 2.0, tint: 0x170f22 },
};
const clips = new Map();

// ---------- palco ----------
let renderer = null;
const scene = new THREE.Scene();
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const TILT = 0.21;
let ppu = 50, halfW = 10;
const hemi = new THREE.HemisphereLight(0x8d93cc, 0x1c1c16, 1.15); scene.add(hemi);
const moon = new THREE.DirectionalLight(0xd2e6da, 1.7); moon.position.set(2, 10, -6); scene.add(moon);
const fill = new THREE.DirectionalLight(0x7070a8, 0.7); fill.position.set(-2, 4, 10); scene.add(fill);
const torchL = new THREE.PointLight(0xff8a3a, 40, 16, 2), torchR = new THREE.PointLight(0xff8a3a, 40, 16, 2);
const door = new THREE.PointLight(0xa050ff, 22, 13, 2);
scene.add(torchL, torchR, door);
const toWorldX = (sx) => (sx - view.W / 2) / ppu;
let camX = 0; // a câmera acompanha o mouse
// Ponto da tela (fundo 2D: cripta, árvores, lápides) -> chão do mundo 3D (y = 0).
const screenToWorld = (sx, sy) => ({ x: (sx - view.W / 2) / ppu + camX, z: (sy - view.H * 0.9) / (Math.sin(TILT) * ppu) });

function resize() {
  const W = view.W, H = view.H;
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.setSize(W, H, false);
  ppu = H * 0.068; halfW = W / 2 / ppu;
  cam.left = -halfW; cam.right = halfW; cam.top = (H * 0.9) / ppu; cam.bottom = -(H * 0.1) / ppu; cam.updateProjectionMatrix();
}

// ---------- efeitos ----------
function glowTex(r, g, b) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, `rgba(${r},${g},${b},1)`); gr.addColorStop(.35, `rgba(${r},${g},${b},.5)`); gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
const TEX = { purple: glowTex(200, 120, 255), orange: glowTex(255, 170, 80), shadow: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })() };
TEX.star = glowTex(255, 230, 120);
const fx = [];
function spark(pos, tex, n, spread, life, grav = -6, size = .25) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    m.position.copy(pos); m.scale.setScalar(size);
    scene.add(m);
    fx.push({ m, v: new THREE.Vector3((Math.random() - .5) * spread, Math.random() * spread, (Math.random() - .5) * spread * .4), life, t: 0, grav, size });
  }
}
function ring(x, z, color, life = 2.2, size = 5) {
  const m = new THREE.Mesh(new THREE.RingGeometry(.6, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, .05, z); scene.add(m);
  fx.push({ m, ring: true, life, t: 0, size });
}
const shots = [];
function shoot(from, to, kind, onHit, miss = false) {
  let m;
  if (kind === 'bolt') { m = new THREE.Mesh(new THREE.BoxGeometry(.7, .06, .06), new THREE.MeshStandardMaterial({ color: 0x6b4a2a })); }
  else { m = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.purple, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); m.scale.setScalar(1.1); }
  m.position.copy(from); scene.add(m);
  const end = to.clone(); if (miss) end.add(new THREE.Vector3(Math.sign(to.x - from.x) * 30, 0, 0));
  const dist = from.distanceTo(end), speed = kind === 'bolt' ? 22 : 9;
  shots.push({ m, from: from.clone(), to: end, t: 0, dur: dist / speed, onHit: miss ? null : onHit, hitAt: miss ? 0 : 1, kind });
}

// ---------- personagens ----------
const actors = new Set();
class Actor {
  constructor(kind, x, z, dir = 1) {
    const k = KINDS[kind]; this.kind = kind; this.k = k;
    this.root = new THREE.Group(); this.model = SkeletonUtils.clone(cache.get(k.model).scene);
    this.model.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; if (k.tint && /Hood|Cape/.test(o.name)) { o.material = o.material.clone(); o.material.map = null; o.material.color.setHex(k.tint); } } });
    const hand = (n) => this.model.getObjectByName(n) || this.model.getObjectByName(n.replace(/\./g, ''));
    if (k.r) hand('handslot.r').add(cache.get(k.r).scene.clone(true));
    if (k.l) hand('handslot.l').add(cache.get(k.l).scene.clone(true));
    this.root.add(this.model);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: TEX.shadow, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = .03; this.root.add(sh); this.shadow = sh;
    this.scale = k.scale || 1; this.root.scale.setScalar(this.scale);
    this.root.position.set(x, 0, z); scene.add(this.root); actors.add(this);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.mixer.addEventListener('finished', (e) => { if (e.action === this.action) this.clipDone = true; });
    this.dir = dir; this.yaw = dir * 1.2; this.wantYaw = this.yaw;
    this.tx = null; this.speed = 1.6; this.walkClip = 'Skeletons_Walking'; this.idleClip = 'Skeletons_Idle';
    this.hold = 0; this.dead = false; this.sink = 0; this.fly = null;
    this.group = curGroup; this.tz = null; this.waitT = 0; this.ghost = 0; this.cool = 0; this.animSpeed = 1;
    this.path = null; this.alpha = 1; this.follow = null;
    this.play(this.idleClip);
  }
  get x() { return this.root.position.x; }
  get z() { return this.root.position.z; }
  chest() { return new THREE.Vector3(this.x, 1.25 * this.scale, this.z); }
  play(name, { once = false, speed = 1, fade = .18 } = {}) {
    const clip = clips.get(name); if (!clip) return;
    const a = this.mixer.clipAction(clip);
    if (this.action === a && !once) { a.timeScale = speed; return; }
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); a.clampWhenFinished = once; a.timeScale = speed;
    if (this.action && this.action !== a) a.crossFadeFrom(this.action, fade, false);
    a.play(); this.action = a; this.clipName = name; this.clipDone = false; this.clipLen = clip.duration / speed;
  }
  // Tocar uma animação uma vez e esperar acabar: yield ator.once('Clip')
  once(name, speed = 1, fade = .12) { this.play(name, { once: true, speed, fade }); return () => this.clipDone; }
  walkTo(x, speed = 1.6, clip = 'Skeletons_Walking', animSpeed = 1) {
    this.tx = x; this.speed = speed; this.walkClip = clip; this.animSpeed = animSpeed; this.dir = Math.sign(x - this.x) || this.dir; this.wantYaw = this.dir * 1.2;
    this.play(clip, { speed: animSpeed }); return () => this.tx === null;
  }
  // Caminho livre (fora das faixas: até a porta da cripta, a árvore, a cova). y = altura final (degraus).
  goTo(x, z, { speed = 1.6, clip = 'Skeletons_Walking', animSpeed = 1, back = false, y = null, keepClip = false } = {}) {
    this.tx = null; this.tz = null;
    this.path = { x, z, y, speed, back, keepClip, y0: this.root.position.y, d0: Math.hypot(x - this.x, z - this.z) || 1e-3 };
    if (clip) this.play(clip, { speed: animSpeed });
    return () => this.path === null;
  }
  // Transparência (entrando/saindo da cripta). Materiais próprios na primeira vez.
  setAlpha(a) {
    if (!this.ownMats) {
      this.ownMats = [];
      this.root.traverse((o) => { if (o.isMesh && o !== this.shadow) { o.material = o.material.clone(); this.ownMats.push(o.material); } });
    }
    this.alpha = a;
    for (const m of this.ownMats) { m.transparent = a < 1; m.opacity = a; m.depthWrite = a >= 1; }
    this.shadow.material.opacity = a;
  }
  face(other) { this.dir = Math.sign((typeof other === 'number' ? other : other.x) - this.x) || this.dir; this.wantYaw = this.dir * 1.35; }
  idle() { this.tx = null; this.play(this.idleClip); }
  // Susto rápido sem perder o caminho (usado no relâmpago)
  startle() { if (this.dead || this.busy || this.hold > 0 || this.fly) return; this.hold = .7; this.play('Hit_A', { once: true, speed: 1.3, fade: .08 }); }
  die() { this.dead = true; this.tx = null; view.sfx.thud(); return this.once('Skeletons_Death', 1.2); }
  update(dt) {
    this.mixer.update(dt);
    if (this.fly) { // arremessado pelo chute do Rei
      const f = this.fly; f.t += dt; const u = Math.min(1, f.t / f.dur);
      this.root.position.x = f.x0 + (f.x1 - f.x0) * u; this.root.position.y = Math.sin(u * Math.PI) * f.h; this.model.rotation.x = -u * Math.PI * 1.6 * f.spin;
      if (u >= 1) { this.fly = null; this.root.position.y = 0; this.model.rotation.x = 0; }
    }
    if (this.path) { // caminho livre (sem trânsito: fora das faixas)
      const P = this.path, dx = P.x - this.x, dz = P.z - this.z, d = Math.hypot(dx, dz), st = P.speed * dt;
      if (d <= st) {
        this.root.position.x = P.x; this.root.position.z = P.z; if (P.y !== null) this.root.position.y = P.y; this.path = null; if (!P.keepClip) this.play(this.idleClip);
        if (this.afterPath !== undefined) { this.tz = this.afterPath; this.afterPath = undefined; if (this.tx !== null) this.play(this.walkClip, { speed: this.animSpeed }); }
      }
      else {
        this.root.position.x += dx / d * st; this.root.position.z += dz / d * st;
        if (P.y !== null) this.root.position.y = P.y + (P.y0 - P.y) * Math.min(1, d / P.d0);
        const yaw = Math.atan2(dx, dz) + (P.back ? Math.PI : 0);
        this.wantYaw = this.yaw + Math.atan2(Math.sin(yaw - this.yaw), Math.cos(yaw - this.yaw));
        if (Math.abs(dx) > 1e-3) this.dir = Math.sign(dx) * (P.back ? -1 : 1);
      }
    } else if (this.hold > 0) { this.hold -= dt; if (this.hold <= 0 && this.tx !== null) this.play(this.walkClip); }
    else if (this.tx !== null) {
      const d = this.tx - this.x;
      let step = Math.min(this.speed * dt, Math.abs(d));
      step = this.traffic(step, dt); // ninguém atravessa ninguém (antes, quem esperava 3 s virava "fantasma")
      if (Math.abs(d) < 1e-4 || (step > 0 && step >= Math.abs(d) - 1e-6)) { this.root.position.x = this.tx; this.tx = null; if (this.clipName === this.walkClip) this.play(this.idleClip); } // chegou: para de andar
      else this.root.position.x += Math.sign(d) * step;
      // Empacado (empurrado de volta por quem vem na contramão, mesmo "andando"): desvia pela frente.
      if (this.tx !== null) {
        if (this.progX === undefined || Math.abs(this.x - this.progX) > .4) { this.progX = this.x; this.progT = 0; }
        else if ((this.progT += dt) > 2) { this.progT = 0; this.detour(); }
      }
      // parado esperando passagem: fica em pé em vez de andar no lugar
      if (this.tx !== null) {
        if (step > 1e-4 || this.tz !== null) { this.waitT = 0; if (this.clipName !== this.walkClip) this.play(this.walkClip, { speed: this.animSpeed }); }
        else { this.waitT += dt; if (this.waitT > .25 && this.clipName !== this.idleClip) this.play(this.idleClip); if (this.waitT > 2.5) { this.waitT = 0; this.unstick(); } }
      }
    }
    if (this.cool > 0) this.cool -= dt;
    this.yaw += (this.wantYaw - this.yaw) * Math.min(1, dt * 8); this.root.rotation.y = this.yaw;
    if (this.follow) { const f = this.follow; this.root.position.x = f.a.x + f.dx; this.root.position.z = f.a.z + f.dz; }
    if (this.sink) { this.root.position.y -= dt * .35; if (this.root.position.y < -2.6) this.remove(); }
  }
  // Preso esperando passagem: troca de faixa; sem faixa livre, quem não está numa cena dá meia-volta.
  unstick() {
    const z2 = otherLane(this.z);
    if (laneFree(this, z2)) { this.tz = z2; return; }
    if (this.busy && !this.leaving) return;
    this.exitX = -(this.exitX ?? -edge(this.dir));
    this.walkTo(this.exitX, this.speed, this.walkClip, this.animSpeed);
  }
  // Desvio: sai das faixas (passa pela frente delas) e continua do outro lado de quem estava bloqueando.
  // Vale também para quem está numa cena (antes, duas cenas ao mesmo tempo podiam se travar para sempre).
  detour() {
    const z2 = otherLane(this.z);
    if (this.tz === null && laneFree(this, z2) && (!this.busy || this.leaving)) { this.tz = z2; return; }
    const lane = Math.abs(this.z - LANES[0]) < Math.abs(this.z - LANES[1]) ? LANES[0] : LANES[1];
    const x = this.x + this.dir * 3.2, toX = Math.sign(this.tx - x) === this.dir ? x : this.tx; // não passa do destino
    this.tz = null;
    this.path = { x: toX, z: 1.4, y: null, speed: this.speed, back: false, keepClip: true, y0: this.root.position.y, d0: Math.hypot(toX - this.x, 1.4 - this.z) || 1e-3 };
    this.afterPath = lane; // depois volta para a faixa (o tx continua: a cena só segue quando ele chegar)
  }
  remove() { this.removed = true; scene.remove(this.root); actors.delete(this); }
  // Trânsito: ninguém atravessa ninguém. Devolve quanto pode andar neste quadro.
  traffic(step, dt) {
    if (this.tz !== null) { // trocando de faixa (passo para o lado); espera no meio se a faixa nova encher
      const dz = this.tz - this.z, s = laneFree(this, this.tz) ? 2.6 * dt : 0;
      if (s === 0) this.wantYaw = this.dir * 1.2;
      else if (Math.abs(dz) <= s) { this.root.position.z = this.tz; this.tz = null; this.wantYaw = this.dir * 1.2; }
      else { this.root.position.z += Math.sign(dz) * s; this.wantYaw = Math.atan2(this.dir * .7, Math.sign(dz)); }
    }
    const canStep = !this.busy || this.leaving;
    if (canStep && this.tz === null && overlapping(this)) { const z2 = otherLane(this.z); if (laneFree(this, z2)) this.tz = z2; return step; } // encostado: a separação (separate) afasta os dois
    const hit = aheadOf(this, step + .05);
    if (!hit) return step;
    const o = hit.o, room = Math.max(0, hit.d - gap(this, o));
    const oWalking = o.tx !== null && o.hold <= 0;
    if (o.group === this.group && this.group) { // a cena já cuida dos colegas; na contramão, um dá um passo para o lado
      if (o.dir === this.dir) return Math.min(step, room);
      if (canStep && this.tz === null && room < .6) { const z2 = otherLane(this.z); if (laneFree(this, z2)) this.tz = z2; }
      return step;
    }
    // dois andando um contra o outro: TROMBADA
    if (!this.busy && !o.busy && oWalking && o.dir === -this.dir && this.cool <= 0 && o.cool <= 0 && this.tz === null && o.tz === null && Math.abs(this.x) < halfW - 1) {
      if (room <= .02) { this.hold = o.hold = 99; this.tz = o.tz = null; run(bonk(this, o)); return 0; }
      return Math.min(step, room);
    }
    // fila: o da frente vai no mesmo sentido e quase tão rápido → acompanha
    if (oWalking && o.dir === this.dir && o.speed >= this.speed * .8) return Math.min(step, room);
    // senão: dá um passo para a outra faixa (se estiver livre); quem está numa cena espera
    if (canStep && this.tz === null) { const z2 = otherLane(this.z); if (laneFree(this, z2)) this.tz = z2; }
    return Math.min(step, room);
  }
}
const gap = (a, b) => .7 * (a.scale + b.scale);
const otherLane = (z) => (z > LANES[1] / 2 ? LANES[1] : LANES[0]);
const solid = (a, o) => o !== a && !o.dead && !o.fly && !o.removed && !o.path && !o.pinned && o.alpha > .5 && o.root.position.y > -.5 && o.root.position.y < .5;
function aheadOf(a, range) {
  let best = null, bd = Infinity;
  for (const o of actors) {
    if (!solid(a, o) || Math.abs(o.z - a.z) >= 1) continue;
    const dx = o.x - a.x; if (Math.sign(dx) !== a.dir) continue;
    const d = Math.abs(dx); if (d < gap(a, o) + range && d < bd) { bd = d; best = o; }
  }
  return best && { o: best, d: bd };
}
function overlapping(a) {
  for (const o of actors) if (solid(a, o) && o.group !== a.group && Math.abs(o.z - a.z) < 1 && Math.abs(o.x - a.x) < gap(a, o) * .7) return true;
  return false;
}
function laneFree(a, z) {
  for (const o of actors) if (solid(a, o) && Math.abs(o.z - z) < 1.2 && Math.abs(o.x - a.x) < gap(a, o) * 1.5) return false;
  return true;
}
// estrelinhas girando em volta da cabeça
function dizzy(a, life = 1.8) {
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.star, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    m.scale.setScalar(.3 * a.scale); scene.add(m); fx.push({ m, orbit: a, ph: i * 2.094, life, t: 0 });
  }
}
// Trombada: batem a cabeça, veem estrelas; às vezes um (ou os dois) cai sentado. Depois um dá passagem.
function* bonk(a, b) {
  a.face(b); b.face(a);
  const mid = new THREE.Vector3((a.x + b.x) / 2, 1.7 * Math.min(a.scale, b.scale), (a.z + b.z) / 2);
  view.sfx.bonk ? view.sfx.bonk() : view.sfx.hit(); spark(mid, TEX.orange, 12, 4, .4, -7, .24);
  for (const s of [a, b]) { s.play(pick(['Hit_A', 'Hit_B']), { once: true, speed: 1.3, fade: .05 }); s.root.position.x -= s.dir * .35; }
  dizzy(a); dizzy(b);
  yield .75;
  const r = Math.random();
  if (r < .3) { // os dois caem
    view.sfx.thud(); yield all(a.once('Skeletons_Death', 1.5), b.once('Skeletons_Death', 1.5)); yield .6;
    yield all(a.once('Skeletons_Awaken_Floor', 1.3), b.once('Skeletons_Awaken_Floor', 1.3));
    yield all(a.once('Skeletons_Taunt'), b.once(pick(['Skeletons_Taunt', 'Idle_B'])));
  } else if (r < .65) { // um cai, o outro tira sarro
    const [l, w] = Math.random() < .5 ? [a, b] : [b, a];
    view.sfx.thud(); const fall = l.once('Skeletons_Death', 1.5);
    yield .3; yield all(fall, w.once(pick(['Cheering', 'Skeletons_Taunt'])));
    yield l.once('Skeletons_Awaken_Floor', 1.3);
  } else { // discutem
    yield all(a.once('Skeletons_Taunt'), b.once(pick(['Skeletons_Taunt', 'Idle_B']))); yield .2;
  }
  // um dá passagem pela outra faixa (se as duas estiverem ocupadas, passa raspando)
  const side = laneFree(a, otherLane(a.z)) ? a : laneFree(b, otherLane(b.z)) ? b : null;
  if (side) side.tz = otherLane(side.z);
  else { const back = !a.busy ? a : !b.busy ? b : null; if (back) { back.exitX = -(back.exitX ?? -edge(back.dir)); back.dir = -back.dir; } } // sem faixa livre: um dá meia-volta
  for (const s of [a, b]) { if (s.removed) continue; s.cool = 8; s.hold = 0; if (s.exitX !== undefined) s.walkTo(s.exitX, s.speed, s.walkClip, s.animSpeed); s.wantYaw = s.dir * 1.2; s.play(s.walkClip, { speed: s.animSpeed }); }
}

// ---------- roteiros (cada cena é uma função geradora: yield segundos ou uma condição) ----------
const running = [];
let curGroup = 0, groupSeq = 0; // cada cena tem um número; os atores dela não "trombam" entre si
function run(gen, group = curGroup) { running.push({ it: gen, wait: 0, cond: null, group }); }
function tickScripts(dt) {
  for (let i = running.length - 1; i >= 0; i--) {
    const s = running[i];
    if (s.wait > 0) { s.wait -= dt; continue; }
    if (s.cond && !s.cond()) continue;
    s.cond = null;
    curGroup = s.group; const r = s.it.next(); curGroup = 0;
    if (r.done) { running.splice(i, 1); continue; }
    if (typeof r.value === 'number') s.wait = r.value; else if (typeof r.value === 'function') s.cond = r.value;
  }
}
const all = (...c) => () => c.every((f) => f());
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (l) => l[Math.random() * l.length | 0];
const edge = (dir) => (dir > 0 ? -halfW - 2.5 : halfW + 2.5); // de onde entra quem anda nessa direção
const center = () => toWorldX(view.cx) + rnd(-1.5, 1.5);
const LANES = [0, -2.6];
const offscreen = (a) => () => Math.abs(a.x) > halfW + 2;
// Sai de cena andando até passar da borda. Só some fora da tela (antes, quem parava no meio sumia do nada).
function* leave(a, speed = 1.6, clip = 'Skeletons_Walking', animSpeed = 1) {
  a.leaving = true; a.exitX = -edge(a.dir);
  a.walkTo(a.exitX, speed, clip, animSpeed);
  while (!a.removed) {
    if (a.tx === null && !a.path && Math.abs(a.x) > halfW + 1.5) break;
    if (a.tx === null && !a.path && !a.busy && !a.dead && a.hold <= 0 && !a.fly) a.walkTo(a.exitX, speed, clip, animSpeed);
    yield .1;
  }
  if (!a.removed) a.remove();
}
function* sinkLater(a, t = 4) { yield t; a.sink = 1; }
function hitFx(target, blocked) {
  const p = target.chest(); p.x -= target.dir * .3;
  if (blocked) { view.sfx.clang(); spark(p, TEX.orange, 10, 4, .35, -9, .22); } else { view.sfx.hit(); spark(p, TEX.orange, 4, 2, .25, -9, .16); }
}

// Patrulha: fila de lacaios; o último às vezes se distrai e corre para alcançar
function* patrol() {
  const dir = pick([1, -1]), z = pick(LANES), n = 2 + (Math.random() * 3 | 0), list = [];
  for (let i = 0; i < n; i++) list.push(new Actor(i === 0 && Math.random() < .5 ? 'warrior' : 'minion', edge(dir) - dir * i * 1.7, z, dir));
  const distracted = Math.random() < .6;
  list.forEach((a, i) => { if (!(distracted && i === n - 1)) run(leave(a)); });
  if (distracted) {
    const last = list[n - 1];
    last.walkTo(-edge(dir));
    const stopAt = center(); yield () => Math.abs(last.x - stopAt) < 1.5 || last.removed;
    if (last.removed) return;
    last.tx = null; last.busy = true; yield last.once(pick(['Skeletons_Taunt', 'Idle_B', 'Interact']));
    last.busy = false; run(leave(last, 4.6, 'Running_A'));
  }
}
// Quem vai atacar dá um passo até ficar ao alcance da arma (o empurrão do golpe anterior afasta)
const REACH = 1.6;
function* closeIn(atk, def) {
  const want = def.x - Math.sign(def.x - atk.x) * REACH;
  if (Math.abs(atk.x - want) > .15) { yield atk.walkTo(want, 2.2); }
  atk.face(def); def.face(atk); yield .12;
}
// Duelo: dois esqueletos brigam; quem perde cai. Às vezes um Mago aparece e revive o caído.
function* duel() {
  const z = pick(LANES), c = center();
  const A = new Actor(pick(['warrior', 'minion', 'assassin']), edge(1), z, 1), B = new Actor(pick(['minion', 'warrior', 'assassin']), edge(-1), z, -1);
  A.busy = B.busy = true;
  yield all(A.walkTo(c - .8), B.walkTo(c + .8)); // perto o bastante para a arma encostar
  A.face(B); B.face(A); A.idle(); B.idle();
  yield .3; const ta = A.once('Skeletons_Taunt'); yield .45; const tb = B.once(pick(['Skeletons_Taunt', 'Melee_Block'])); yield all(ta, tb);
  const rounds = 2 + (Math.random() * 3 | 0); let atk = Math.random() < .5 ? A : B;
  for (let r = 0; r < rounds; r++) {
    const def = atk === A ? B : A, clip = atk.k.l && atk.kind === 'assassin' ? pick(['Melee_Dualwield_Attack_Slice', 'Melee_Dualwield_Attack_Chop']) : pick(['Melee_1H_Attack_Chop', 'Melee_1H_Attack_Slice_Diagonal', 'Melee_1H_Attack_Slice_Horizontal']);
    yield* closeIn(atk, def);
    atk.play(clip, { once: true, speed: 1.1, fade: .1 });
    yield atk.clipLen * .5;
    const blocked = def.k.shield && Math.random() < .55;
    if (blocked) def.play('Melee_Block_Hit', { once: true, speed: 1.6, fade: .05 });
    else { def.play(pick(['Hit_A', 'Hit_B']), { once: true, speed: 1.2, fade: .05 }); def.root.position.x += def.dir * -.25; }
    hitFx(def, blocked);
    yield atk.clipLen * .5; atk.idle(); yield .2; def.idle(); yield rnd(.2, .5);
    atk = Math.random() < .65 ? def : atk;
  }
  // golpe final
  const loser = Math.random() < .5 ? A : B, winner = loser === A ? B : A;
  yield* closeIn(winner, loser);
  winner.play('Melee_1H_Attack_Chop', { once: true, speed: 1, fade: .1 }); yield winner.clipLen * .55; hitFx(loser, false);
  yield loser.die(); yield .3;
  yield winner.once('Cheering');
  const plan = Math.random();
  if (plan < .5) { yield* PLAYS.bury(winner, loser); return; } // o vencedor enterra o caído numa das covas
  winner.busy = false; run(leave(winner));
  if (plan < .85) {
    yield 1;
    const dir = pick([1, -1]), M = new Actor('mage', edge(dir), z, dir); M.busy = true;
    yield M.walkTo(loser.x - dir * 1.8); M.face(loser);
    M.play('Ranged_Magic_Spellcasting', { speed: 1 }); view.sfx.magic(); ring(loser.x, z, 0xa050ff, 2.6, 2.4);
    for (let i = 0; i < 12; i++) { spark(new THREE.Vector3(loser.x + rnd(-.6, .6), .2, z), TEX.purple, 1, 1.5, 1.1, 2.5, .3); yield .15; }
    yield loser.once('Skeletons_Death_Resurrect', 1); loser.dead = false;
    M.idle(); yield loser.once('Skeletons_Taunt');
    loser.face(-edge(M.dir)); M.busy = loser.busy = false;
    run(leave(M)); yield .6; run(leave(loser));
  } else run(sinkLater(loser));
}
// Emboscada: arqueiro mira num lacaio distraído; às vezes o lacaio pula e a flecha erra
function* ambush() {
  const dir = pick([1, -1]);
  const R = new Actor('archer', edge(dir), LANES[1], dir), V = new Actor('minion', edge(-dir), 0, -dir);
  R.busy = V.busy = true;
  run((function* () { yield V.walkTo(edge(dir) * .1 + center() * .5, 1.5); })());
  yield R.walkTo(edge(dir) + dir * 5, 2.2);
  R.face(V); R.play('Ranged_2H_Aiming');
  yield () => V.tx === null;
  V.face(R); yield V.once('Idle_B');
  R.play('Ranged_2H_Shoot', { once: true, speed: 1.2 }); view.sfx.shoot();
  const dodge = Math.random() < .4;
  if (dodge) {
    V.play('Jump_Full_Short', { once: true, speed: 1.3, fade: .05 });
    shoot(new THREE.Vector3(R.x + R.dir * .6, 1.4, R.z), V.chest(), 'bolt', null, true);
    yield .8; yield V.once('Skeletons_Taunt');
    R.play('Ranged_2H_Reload', { once: true }); yield .4;
    R.busy = V.busy = false; run(leave(V, 4.6, 'Running_A')); yield 1; run(leave(R));
  } else {
    let hit = false; shoot(new THREE.Vector3(R.x + R.dir * .6, 1.4, R.z), V.chest(), 'bolt', () => { hit = true; });
    yield () => hit; hitFx(V, false); yield V.die();
    yield R.once('Ranged_2H_Reload');
    if (Math.random() < .6) { yield* PLAYS.bury(R, V); return; } // o arqueiro enterra a vítima
    R.busy = false; run(leave(R)); run(sinkLater(V, 3));
  }
}
// Amigos: dois lacaios se encontram, acenam, comemoram e vão embora juntos
function* friends() {
  const z = pick(LANES), c = center();
  const A = new Actor('minion', edge(1), z, 1), B = new Actor(pick(['minion', 'archer', 'mage']), edge(-1), z, -1);
  A.busy = B.busy = true;
  yield all(A.walkTo(c - 1.1), B.walkTo(c + 1.1)); A.face(B); B.face(A);
  yield all(A.once('Waving'), B.once('Waving'));
  yield all(A.once(pick(['Cheering', 'Skeletons_Taunt'])), B.once('Cheering'));
  const d = pick([1, -1]); A.busy = B.busy = false; A.dir = B.dir = d;
  run(leave(A)); yield .5; run(leave(B));
}
// Rei Skullbone: cortejo; um lacaio distraído atravessa, leva um chute e voa
function* king() {
  const dir = pick([1, -1]), Kg = new Actor('king', edge(dir), 0, dir); Kg.busy = true;
  const esc = [1, 2].map((i) => new Actor('minion', edge(dir) - dir * (i * 2.4 + .6), 0, dir)); esc.forEach((e) => (e.busy = true));
  const c = center();
  [Kg, ...esc].forEach((a, i) => a.walkTo(c - dir * i * 2.4, 1.1, 'Skeletons_Walking', .75));
  yield () => Kg.tx === null;
  esc.forEach((e) => e.idle());
  Kg.idle(); yield Kg.once('Skeletons_Taunt', .9);
  const L = new Actor('minion', edge(-dir), 0, -dir); L.busy = true;
  yield L.walkTo(Kg.x + dir * 1.7, 4.2, 'Running_A');
  L.face(Kg); L.play('Hit_A', { once: true }); yield .35;
  Kg.play('Melee_Unarmed_Attack_Kick', { once: true, speed: 1.1, fade: .08 }); yield Kg.clipLen * .45;
  hitFx(L, false); view.sfx.thud();
  L.fly = { t: 0, dur: 1.0, x0: L.x, x1: L.x + dir * 6, h: 2.8, spin: 1 }; L.play('Skeletons_Death', { once: true, speed: 2 });
  yield 1.1; esc.forEach((e) => e.play('Cheering'));
  yield Kg.once('Skeletons_Taunt', 1.1);
  esc.forEach((e) => e.idle());
  [Kg, ...esc].forEach((a) => { a.busy = false; run(leave(a, 1.1, 'Skeletons_Walking', .75)); });
  yield 1.5; yield L.once('Skeletons_Awaken_Floor', 1.2); L.face(edge(dir)); L.busy = false;
  run(leave(L, 1.0, 'Skeletons_Walking', .7));
}
// Necromante: para no meio, faz o ritual e levanta lacaios do chão, que o seguem
function* necro() {
  const dir = pick([1, -1]), N = new Actor('necro', edge(dir), LANES[1], dir); N.busy = true;
  yield N.walkTo(center(), 1.3);
  N.face(-edge(dir)); N.wantYaw = .3;
  N.play('Ranged_Magic_Summon', { once: true, speed: .8 }); view.sfx.magic();
  ring(N.x, N.z, 0xa050ff, 3, 6);
  const raised = [];
  for (const off of [-2.6, 2.6, -dir * 4.6]) {
    yield .45; const r = new Actor('minion', N.x + off, 0, Math.sign(off) || 1); r.busy = true;
    ring(r.x, 0, 0x8a40ff, 1.6, 2.2); spark(new THREE.Vector3(r.x, .2, 0), TEX.purple, 8, 2.5, .9, 1.5, .35);
    r.play('Skeletons_Awaken_Floor', { once: true, speed: 1.1, fade: 0 }); raised.push(r);
  }
  yield 2.2; raised.forEach((r) => { r.face(N); r.play('Skeletons_Taunt', { once: true }); });
  yield N.once('Ranged_Magic_Spellcasting', 1.2);
  N.busy = false; N.dir = dir; run(leave(N, 1.3));
  for (const r of raised) { yield .35; r.busy = false; r.dir = dir; run(leave(r)); }
}
// Ceifador: dois lacaios conversando o veem chegando, levam um susto e fogem correndo
function* reaper() {
  const dir = pick([1, -1]), Rp = new Actor('reaper', edge(dir), LANES[1], dir); Rp.busy = true;
  const a = new Actor('minion', center() + 1.6, 0, -1), b = new Actor(pick(['minion', 'archer']), center() - 1.6, 0, 1);
  a.busy = b.busy = true; a.face(b); b.face(a);
  a.play('Waving'); b.play('Cheering');
  Rp.leaving = true; Rp.walkTo(-edge(dir), 1.0, 'Skeletons_Walking', .6);
  yield () => Math.abs(Rp.x - a.x) < 7;
  a.face(Rp); b.face(Rp); a.play('Hit_A', { once: true, fade: .05 }); b.play('Hit_B', { once: true, fade: .05 });
  yield .7;
  Rp.tx = null; Rp.face(a); Rp.play('Melee_2H_Attack_Slice', { once: true, speed: .9 });
  for (const m of [a, b]) { m.dir = dir; m.busy = false; run(leave(m, 5.2, 'Running_A', 1.2)); }
  yield Rp.clipLen; Rp.busy = false; Rp.dir = dir; run(leave(Rp, 1.0, 'Skeletons_Walking', .6));
}
// Trombada: dois distraídos vêm na mesma faixa, um contra o outro… e batem a cabeça
function* bump() {
  const z = pick(LANES), dir = pick([1, -1]);
  const A = new Actor(pick(['minion', 'minion', 'warrior']), edge(dir), z, dir), B = new Actor(pick(['minion', 'archer', 'mage']), edge(-dir), z, -dir);
  B.group = ++groupSeq; // cenas diferentes para o trânsito: assim eles se trombam
  run(leave(A, 1.7), A.group); run(leave(B, 1.9), B.group);
}
// Cenas novas (menuplays.js): cripta, árvore, cova, bola de caveira, treino, soneca.
const PLAYS = makePlays({
  Actor, run, all, rnd, pick, edge, center, LANES, leave, spark, ring, dizzy, hitFx, TEX, scene, cache, laneFree, actors,
  get view() { return view; }, get halfW() { return halfW; }, get ppu() { return ppu; }, screenToWorld,
});
const SCENES = [[bump, 3], [patrol, 2.5], [duel, 3], [ambush, 2], [friends, 1.6], [king, 1.1], [necro, 1.1], [reaper, 1],
  [PLAYS.crypt, 2.4], [PLAYS.tree, 2.2], [PLAYS.catchSkull, 1.8], [PLAYS.workout, 1.5], [PLAYS.nap, 1.6], [PLAYS.mourn, 1.2]];
// Ninguém fica dentro do outro: quem está encostado (mesma faixa) é afastado aos poucos.
function separate(dt) {
  const list = [...actors].filter((a) => solid(null, a));
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (Math.abs(a.z - b.z) >= 1) continue;
    const dx = b.x - a.x, need = gap(a, b) * .85, d = Math.abs(dx);
    if (d >= need) continue;
    const m = Math.min(need - d, 4 * dt), sg = dx > 0 || (dx === 0 && a.root.id < b.root.id) ? 1 : -1;
    const fa = a.busy && !a.leaving ? .25 : 1, fb = b.busy && !b.leaving ? .25 : 1; // quem está numa cena quase não sai do lugar
    a.root.position.x -= sg * m * fa / (fa + fb); b.root.position.x += sg * m * fb / (fa + fb);
  }
}
const groupScene = new Map();
let next = 1.2, lastScene = null, sceneLog = [], simT = 0;
function director(dt) {
  // Antes: só começava uma cena com o palco quase vazio (e quem empacava na saída travava tudo por minutos).
  // Agora: até 2 cenas ao mesmo tempo e um intervalo curto entre elas.
  const onStage = [...actors].filter((a) => !a.dead && Math.abs(a.x) < halfW + 1).length;
  const live = new Set([...actors].filter((a) => !a.dead && !a.removed && (a.busy || Math.abs(a.x) < halfW)).map((a) => a.group));
  const scenesNow = [...live].filter((g) => [...actors].some((a) => a.group === g && a.busy && !a.dead && !a.leaving)).length;
  const playing = new Set([...live].map((g) => groupScene.get(g)).filter(Boolean)); // a mesma cena (mesmo lugar: cripta, árvore...) não repete ao mesmo tempo
  next -= dt; if (next > 0) return;
  if (onStage > 6 || scenesNow >= 2) { next = .5; return; }
  let total = 0; const opts = SCENES.filter(([f]) => f !== lastScene && !playing.has(f)); opts.forEach(([, w]) => (total += w));
  if (!opts.length) { next = .5; return; }
  let r = Math.random() * total; let f = opts[0][0];
  for (const [g, w] of opts) { if ((r -= w) <= 0) { f = g; break; } }
  lastScene = f; sceneLog.push([+simT.toFixed(1), f.name]); if (sceneLog.length > 60) sceneLog.shift(); groupScene.set(++groupSeq, f); if (groupScene.size > 40) groupScene.delete(groupScene.keys().next().value); run(f(), groupSeq); next = rnd(2.5, 5);
}

// ---------- laço ----------
let auto = true;
function sim(dt) {
  simT += dt;
  if (auto) director(dt); tickScripts(dt);
  for (const a of actors) a.update(dt);
  separate(dt);
  PLAYS.update(dt);
  for (let i = shots.length - 1; i >= 0; i--) {
    const p = shots[i]; p.t += dt; const u = Math.min(1, p.t / p.dur);
    p.m.position.lerpVectors(p.from, p.to, u);
    if (p.kind === 'bolt') p.m.rotation.y = p.to.x < p.from.x ? Math.PI : 0;
    if (u >= 1) { scene.remove(p.m); shots.splice(i, 1); if (p.onHit) p.onHit(); }
  }
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt; const u = f.t / f.life;
    if (f.orbit) { const a = f.orbit, ang = f.t * 7 + f.ph, s = a.scale; f.m.position.set(a.x + Math.cos(ang) * .4 * s, a.root.position.y + 2.05 * s + Math.sin(f.t * 5) * .05, a.z + Math.sin(ang) * .4 * s); f.m.material.opacity = 1 - u * u; }
    else if (f.ring) { f.m.scale.setScalar(1 + u * f.size); f.m.material.opacity = (1 - u) * .9; }
    else { f.v.y += f.grav * dt; f.m.position.addScaledVector(f.v, dt); f.m.material.opacity = 1 - u; f.m.scale.setScalar(f.size * (1 - u * .5)); }
    if (u >= 1) { scene.remove(f.m); fx.splice(i, 1); }
  }
}
let flashSeen = 0, last = performance.now(), t = 0, live = false;
function frame(now) {
  if (!live) return;
  const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
  if (view.W !== frame.w || view.H !== frame.h) { frame.w = view.W; frame.h = view.H; resize(); }
  // câmera acompanha o mouse igual ao chão do fundo
  const cx = view.mouse.x * 30 / ppu; camX = cx;
  cam.position.set(cx, Math.sin(TILT) * 60, Math.cos(TILT) * 60); cam.lookAt(cx, 0, 0);
  // luzes das tochas e da porta no lugar certo da cripta
  const s = view.s, base = view.base;
  torchL.position.set(toWorldX(view.cx - 20 * s) + cx, 3.2, -4); torchR.position.set(toWorldX(view.cx + 21 * s) + cx, 3.2, -4);
  const fl = 1 + Math.sin(t * 17) * .12 + Math.sin(t * 29) * .08; torchL.intensity = 40 * fl; torchR.intensity = 40 * (2 - fl);
  door.position.set(toWorldX(view.cx) + cx, 1.5, -6); door.intensity = 22 * (.62 + .25 * Math.sin(t * 1.4));
  hemi.intensity = 1.15 + view.flash * 3;
  if (view.flashCount !== flashSeen) { flashSeen = view.flashCount; for (const a of actors) if (Math.random() < .5) a.startle(); }
  sim(dt);
  renderer.render(scene, cam);
  requestAnimationFrame(frame);
}

// Começa a multidão (uma vez); depois é só pausar/continuar junto com o menu.
export function startCrowd(v, canvas) {
  view = v;
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  live = true;
  const paths = [...new Set([...Object.values(KINDS).flatMap((k) => [k.model, k.r, k.l]).filter(Boolean), ...PLAYS.models]), ...ANIMS];
  const api = {
    actors, run, sim, render: () => renderer.render(scene, cam), manual: () => { auto = false; }, Actor, bonk, newGroup: () => ++groupSeq, ppu: () => ppu,
    SCENES: Object.fromEntries(SCENES.map(([f]) => [f.name, f])), PLAYS, screenToWorld, solid, gap,
    pause() { live = false; },
    resume() { if (live) return; live = true; last = performance.now(); if (api.ready) requestAnimationFrame(frame); },
    ready: false,
    stats: () => ({ t: simT, next, actors: [...actors].map((a) => `${a.kind}${a.dead ? '†' : ''}${a.busy ? '*' : ''}@${a.x.toFixed(1)}`), scenes: sceneLog.slice() }),
  };
  loadAll(paths).then(() => {
    // cópias dos clipes sem o deslocamento da raiz (o jogo usa os originais)
    for (const f of ANIMS) for (const c of getGltf(f).animations) { const cc = c.clone(); cc.tracks = cc.tracks.filter((tr) => tr.name !== 'root.position'); clips.set(cc.name, cc); }
    api.ready = true; frame.w = 0; last = performance.now();
    if (live) requestAnimationFrame(frame);
  }).catch((e) => console.error('esqueletos do menu:', e));
  window.__crowd = api; // testes
  return api;
}
