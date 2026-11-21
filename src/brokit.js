// Venham, Irmãos (lendária do Mangual, 12/11/2026): o Cavaleiro toca a corneta e cavaleiros da Ordem pulam de fora
// da sala para dentro, 1 por segundo, enquanto houver inimigos (até 30 ao mesmo tempo). combat.bro = BroKit.
// Números em l1bless.js (L1.bro); quem é cada irmão (arma, cor, tamanho, cavalo) em brolook.js.
// - Cada irmão é um aliado do mesmo tipo dos mortos-vivos da Maga (Enemy com undead = herói): ataca o inimigo mais
//   perto e quem apanha dele revida nele (todos os inimigos, até chefes, podem matar os irmãos).
// - Pulo: nasce fora do muro (N, L ou O), pula por cima e cai dentro (pouso dá dano e deixa tontos em volta).
//   No ar ele não é um inimigo da sala; entra na lista só ao pousar.
// - Sem inimigos: seguem o Cavaleiro em volta dele. Sala limpa: comemoram. Troca de sala: os vivos vão junto
//   (carryOut/carryIn, chamados pelo run.js), com a mesma cara e a vida que tinham.
// - Horda nova depois de uma pausa: o Cavaleiro toca a corneta de novo (só o som) e voltam a pular.
// Ganchos: combat.js (tick, after, clear, mortos), undead.js (escudo, não desmoronam), run.js (salas), player.js (reset).
import * as THREE from 'three';
import { audio } from './audio.js';
import { Enemy } from './enemies.js';
import { findBone } from './characters.js';
import { getClip, mountedClip } from './animation.js';
import { MechFx } from './mechfx.js';
import { L1 } from './l1bless.js';
import { rollBrother, broData, broDress, broLookKey, broArmKey } from './brolook.js';

const R = L1.bro;
const GOLD = 0xffc850;
const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const rnd = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const isFlailHero = (p) => !!(p && p.heroId === 'knight' && p.hero && p.hero.weaponId === 'mangual');
export const broHas = (p) => !!W(p).brothers && isFlailHero(p);

let C = null;

// Nova partida / troca de herói ou arma: sem irmãos.
export function broReset(p) {
  if (p.bro && p.bro.phase === 'intro' && p.state === 'cine') p.exitCine();
  if (C) { C.dropHorn(p); C.ui.show(p, false); }
  p.bro = null;
}

// ---------- Tela: faixas de cinema e título dourado ----------
class BroUi {
  build() {
    if (this.el || typeof document === 'undefined') return;
    const st = document.createElement('style');
    st.textContent = `
#brocine { position:fixed; inset:0; pointer-events:none; z-index:6; }
#brocine .dim { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 45%, rgba(40,25,5,0) 20%, rgba(18,10,2,.78) 82%); opacity:0; transition:opacity .45s; }
#brocine .bars::before, #brocine .bars::after { content:""; position:absolute; left:0; right:0; height:0; background:#000; transition:height .4s cubic-bezier(.2,.8,.2,1); }
#brocine .bars::before { top:0; } #brocine .bars::after { bottom:0; }
#brocine.on .dim { opacity:1; } #brocine.on .bars::before, #brocine.on .bars::after { height:9vh; }
#brocine .title { position:absolute; left:0; right:0; top:17%; text-align:center; opacity:0; font-family:"Titulo", Georgia, serif; }
#brocine .title .t1 { font-size:clamp(34px, 8vw, 92px); letter-spacing:.1em; text-transform:uppercase; background:linear-gradient(#fff8dc, #ffd36a 45%, #b0700f); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; filter:drop-shadow(0 0 16px rgba(255,190,70,.9)) drop-shadow(0 3px 0 #3a2200); }
#brocine .title .t2 { margin-top:2px; font:bold clamp(12px, 1.9vw, 20px) Georgia, serif; letter-spacing:.45em; color:#ffe7a8; text-shadow:0 1px 3px #000, 0 0 10px #c08a20; }
#brocine .title.go { animation:brotitle 2.6s cubic-bezier(.15,.85,.25,1) forwards; }
@keyframes brotitle { 0% { opacity:0; transform:scale(2.1); } 10% { opacity:1; transform:scale(1); } 80% { opacity:1; transform:scale(1.04); } 100% { opacity:0; transform:scale(1.1); } }`;
    document.head.appendChild(st);
    const el = (this.el = document.createElement('div')); el.id = 'brocine';
    el.innerHTML = '<div class="dim"></div><div class="bars"></div><div class="title"><div class="t1">Venham, Irmãos!</div><div class="t2">O CHAMADO DA ORDEM · LENDÁRIA</div></div>';
    document.body.appendChild(el);
  }
  mine(p) { return !C || !C.c || p === C.c.player; }
  show(p, on) { if (!this.mine(p)) return; this.build(); if (this.el) this.el.classList.toggle('on', on); }
  title(p) { if (!this.mine(p)) return; this.build(); if (!this.el) return; const t = this.el.querySelector('.title'); t.classList.remove('go'); void t.offsetWidth; t.classList.add('go'); }
}

// Corneta de marfim com anéis dourados (feita em código).
function makeHorn() {
  const g = new THREE.Group();
  const ivory = new THREE.MeshStandardMaterial({ color: 0xf1e3c2, roughness: 0.45, metalness: 0.05 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0x6a4000, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.7 });
  const curve = new THREE.QuadraticBezierCurve3(v3(0, 0, 0), v3(0, 0.32, 0.18), v3(0, 0.25, 0.62));
  const pts = 14, path = curve.getPoints(pts);
  for (let i = 0; i < pts; i++) { // segmentos que vão engrossando até a boca
    const a = path[i], b = path[i + 1], d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const r0 = 0.025 + 0.075 * (i / pts) ** 1.6, r1 = 0.025 + 0.075 * ((i + 1) / pts) ** 1.6;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len * 1.05, 10), i % 5 === 4 ? gold : ivory);
    seg.position.copy(a).addScaledVector(d, 0.5); seg.quaternion.setFromUnitVectors(v3(0, 1, 0), d.normalize()); g.add(seg);
  }
  const end = path[pts], dir = new THREE.Vector3().subVectors(end, path[pts - 1]).normalize();
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.12, 14, 1, true), gold);
  bell.material.side = THREE.DoubleSide;
  bell.position.copy(end).addScaledVector(dir, 0.04); bell.quaternion.setFromUnitVectors(v3(0, 1, 0), dir); g.add(bell);
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), gold); g.add(mouth);
  g.userData.bell = bell;
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

export class BroKit {
  constructor(c) {
    this.c = c; C = this;
    this.fx = new MechFx(c.vfx);
    this.ui = new BroUi();
    this.jumps = [];   // irmãos no ar: { e, s, p, from, to, y0, t, dur, h, spin, hop }
    this.queue = [];   // vindos da sala anterior, esperando para entrar: { s, hp, p, t }
    this.seq = 0;
    this.every = R.every; this.force = null; // testes
  }
  log(o) { if (this.c.log) this.c.log(o); }
  get scene() { return this.c.vfx.scene; }
  mine(p) { return this.c.enemies.filter((e) => e.bro && e.undead === p && e.alive); }
  count(p) { return this.mine(p).length + this.jumps.filter((j) => j.p === p).length + this.queue.filter((q) => q.p === p).length; }
  specs() { return [...this.c.enemies.filter((e) => e.bro && e.alive).map((e) => e.bro), ...this.jumps.map((j) => j.s), ...this.queue.map((q) => q.s)]; }
  foes() { return this.c.enemies.some((e) => !e.undead && e.alive && !e.data.phantom); }

  // ---------- Corneta ----------
  holdHorn(p) {
    if (p.broHorn) return;
    const hand = findBone(p.model, 'handslot.r');
    if (!hand) return;
    const h = makeHorn();
    const ws = hand.getWorldScale(new THREE.Vector3()).x / Math.max(1e-6, p.group.getWorldScale(new THREE.Vector3()).x);
    h.scale.setScalar(1.1 / (ws || 1));
    h.position.set(0, 0.05 / (ws || 1), 0); h.rotation.set(-0.4, 0, 0);
    hand.add(h);
    p.broHorn = h;
  }
  dropHorn(p) { if (p.broHorn) { p.broHorn.parent && p.broHorn.parent.remove(p.broHorn); p.broHorn = null; } }
  blast(p, loud = true) { // som + ondas douradas saindo do Cavaleiro
    const x = p.position.x, z = p.position.z;
    audio.play('horn', x, z, { v: loud ? 1.4 : 1 });
    this.fx.shock(x, z, loud ? 9 : 6, GOLD, 0.7, 0.3);
    this.fx.shock(x, z, loud ? 5 : 3.5, 0xfff0c0, 0.45, 0.3);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      ring.position.set(x + Math.sin(p.facing) * 0.6, 1.7, z + Math.cos(p.facing) * 0.6);
      ring.rotation.y = p.facing;
      const dx = Math.sin(p.facing), dz = Math.cos(p.facing), d0 = i * 0.12;
      this.c.vfx.add(ring, 0.9, (o, k) => { const kk = Math.max(0, k - d0); o.position.set(x + dx * (0.6 + kk * 5), 1.7 + kk * 0.8, z + dz * (0.6 + kk * 5)); o.scale.setScalar(1 + kk * 4); o.material.opacity = (1 - kk) * (k > d0 ? 0.9 : 0); });
    }
    this.log({ type: 'broHorn', loud });
  }

  // ---------- Cena: o Cavaleiro toca a corneta ----------
  begin(p) {
    p.bro = { phase: 'intro', t: 0, spawnT: 0, quiet: 0, blew: false, titled: false, answered: 0 };
    p.enterCine();
    p.anim.play('Use_Item', { fade: 0.12, restart: true, speed: 0.75 });
    this.holdHorn(p);
    this.ui.show(p, true);
    this.c.text.add('VENHAM, IRMÃOS!', p.position, 'big', 3.6);
    this.log({ type: 'broBegin' });
  }
  finishIntro(p) {
    if (!p.bro) return;
    p.bro.phase = 'play';
    this.dropHorn(p);
    this.ui.show(p, false);
    if (p.state === 'cine') p.exitCine();
    this.log({ type: 'broPlay' });
  }

  // ---------- Pulo para dentro da sala ----------
  // Um irmão novo pula por cima de um muro (N, L ou O). spec = irmão (vindo da sala anterior: carried).
  jumpIn(p, opt = {}) {
    const s = opt.s || rollBrother(this.specs(), this.force || {});
    if (!s) return null;
    const { data } = broData(s);
    const w = this.c.world, b = w && w.bounds;
    let from, to, top = R.jump.top;
    if (opt.near || !b) { // vindo junto com o Cavaleiro: pulinho de trás dele até um lugar em volta
      const i = opt.i || 0, a = p.facing + Math.PI + (i % 2 ? 1 : -1) * (0.4 + 0.35 * Math.floor(i / 2));
      from = v3(p.position.x - Math.sin(p.facing) * 2.5, 0, p.position.z - Math.cos(p.facing) * 2.5);
      to = this.freeSpot(p.position.x + Math.sin(a) * (2.6 + (i % 6) * 0.5), p.position.z + Math.cos(a) * (2.6 + (i % 6) * 0.5), data.radius) || v3(p.position.x, 0, p.position.z);
      top = 0;
    } else {
      const side = Math.random() < 0.5 ? 'N' : Math.random() < 0.5 ? 'E' : 'W';
      for (let k = 0; k < 12 && !to; k++) {
        if (side === 'N') { const u = rnd(-b.x + 1.5, b.x - 1.5); from = v3(u, 0, -b.z - 2.2); to = this.freeSpot(u + rnd(-2, 2), -b.z + rnd(2.2, 6), data.radius); }
        else { const sd = side === 'E' ? 1 : -1, u = rnd(-b.z + 1.5, b.z - 1.5); from = v3(sd * (b.x + 2.2), 0, u); to = this.freeSpot(sd * (b.x - rnd(2.2, 6)), u + rnd(-2, 2), data.radius); }
      }
      if (!to) to = this.freeSpot(p.position.x + rnd(-3, 3), p.position.z + rnd(-3, 3), data.radius) || v3(p.position.x, 0, p.position.z);
    }
    const e = new Enemy('brother', from.x, from.z, { data, awake: true, undead: p, facing: Math.atan2(to.x - from.x, to.z - from.z) });
    e.bro = s;
    broDress(e, s);
    e.position.y = top;
    this.scene.add(e.group);
    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    const dur = opt.near ? 0.5 + i0(opt.i) * 0.02 : R.jump.base + dist * R.jump.perM;
    const j = { e, s, p, from, to, y0: top, t: 0, dur, h: opt.near ? 1.3 : R.jump.h, spin: !opt.near && !e.horse && Math.random() < 0.3, hp: opt.hp, carried: !!opt.near };
    const clip = e.horse ? mountedClip('Idle_A') : opt.near ? 'Jump_Full_Short' : 'Jump_Full_Long';
    e.anim.play(clip, { once: true, restart: true, fade: 0, speed: getClip(clip).duration / (dur * 1.05) });
    if (e.horse) e.horse.leap();
    this.jumps.push(j);
    this.log({ type: 'broSpawn', name: s.name, carried: j.carried });
    return j;
  }
  freeSpot(x, z, r) {
    const w = this.c.world;
    if (!w) return v3(x, 0, z);
    const pos = v3(x, 0, z);
    if (w.clampInside) w.clampInside(pos, r + 0.3);
    if (w.blocked(pos.x, pos.z, r + 0.1)) {
      for (let k = 1; k <= 8; k++) {
        const a = k * 2.4, q = v3(pos.x + Math.sin(a) * k * 0.6, 0, pos.z + Math.cos(a) * k * 0.6);
        if (w.clampInside) w.clampInside(q, r + 0.3);
        if (!w.blocked(q.x, q.z, r + 0.1)) return q;
      }
      return null;
    }
    return pos;
  }
  updateJumps(dt) {
    for (let i = this.jumps.length - 1; i >= 0; i--) {
      const j = this.jumps[i], e = j.e;
      j.t += dt;
      const k = Math.min(1, j.t / j.dur);
      e.position.x = j.from.x + (j.to.x - j.from.x) * k;
      e.position.z = j.from.z + (j.to.z - j.from.z) * k;
      e.position.y = j.y0 * (1 - k) + 4 * j.h * k * (1 - k);
      if (j.spin) e.model.rotation.y = k * Math.PI * 2;
      if (!j.carried && Math.random() < dt * 22) this.c.vfx.sparks(v3(e.position.x, e.position.y + 1.1, e.position.z), GOLD, 2); // rastro dourado no ar
      e.anim.update(dt);
      if (e.horse) e.horse.leap();
      if (k >= 1) { this.jumps.splice(i, 1); this.land(j); }
    }
  }
  land(j) {
    const c = this.c, e = j.e, p = j.p;
    e.position.y = 0; e.model.rotation.y = 0;
    e.id = (c.enemySeq = (c.enemySeq || 0) + 1);
    e.dmgScale = 1; e.hpScale = 1; e.damage = e.data.damage; e.combat = c;
    e.maxHp = R.hp; e.hp = j.hp ? Math.min(R.hp, Math.max(1, j.hp)) : R.hp;
    e.drewAggro = true; e.noGrave = true; e.noUltCharge = true;
    e.cooldown = 0.2 + Math.random() * 0.4;
    e.setState('chase'); e.anim.play(e.data.anims.idle, { fade: 0.1 });
    c.enemies.push(e);
    const x = e.position.x, z = e.position.z;
    c.vfx.dust(e.position, v3(0, 0, 0), j.carried ? 4 : 10);
    if (!j.carried) {
      this.fx.shock(x, z, R.jump.land, GOLD, 0.4, 0.2);
      audio.play('broLand', x, z);
      // Pouso: quem estiver embaixo leva o dano da arma e fica tonto.
      for (const o of [...c.enemies]) {
        if (o.undead || !o.targetable) continue;
        const dx = o.position.x - x, dz = o.position.z - z, d = Math.hypot(dx, dz) || 0.01;
        if (d > R.jump.land + o.data.radius) continue;
        c.bonusDamage(o, e.data.damage, dx / d, dz / d, 'dmg', p);
        if (o.alive && !o.data.boss && o.daze) o.daze(R.jump.daze);
      }
    }
    c.text.add(e.bro.name, e.position, 'crit', 3.0);
    this.log({ type: 'broLand', name: e.bro.name, carried: j.carried });
  }

  // ---------- A cada quadro (antes dos inimigos andarem) ----------
  tick(dt) {
    const c = this.c;
    for (const p of c.players) {
      if (!broHas(p)) { if (p.bro) broReset(p); continue; }
      if (!p.bro) {
        if ((p.state === 'idle' || p.state === 'run') && !p.frozen && !p.choosing && c.world) this.begin(p);
        continue;
      }
      const B = p.bro;
      if (B.phase === 'intro') {
        B.t += dt;
        const I = R.intro;
        p.aimForward && p.aimForward();
        if (!B.blew && B.t >= I.horn) { B.blew = true; this.blast(p, true); c.shakeFor(p, 0.3); }
        if (!B.titled && B.t >= I.title) { B.titled = true; this.ui.title(p); }
        if (B.t >= I.answer && B.answered < R.answer && B.t >= I.answer + B.answered * 0.22) { // os primeiros respondem ao chamado
          B.answered++;
          if (B.answered === 1) audio.play('hornFar', p.position.x, p.position.z);
          if (this.count(p) < R.max) this.jumpIn(p);
        }
        if (B.t >= I.end) this.finishIntro(p);
        continue;
      }
      // Luta: 1 irmão por segundo até acabarem os inimigos (máximo de 30 ao mesmo tempo).
      if (this.foes()) {
        if (B.quiet >= R.hornCd && p.state !== 'dead') this.blast(p, false); // horda nova: toca a corneta de novo
        B.quiet = 0;
        B.spawnT -= dt;
        if (B.spawnT <= 0 && p.state !== 'dead') {
          B.spawnT = this.every;
          if (this.count(p) < R.max) this.jumpIn(p);
        }
      } else { B.quiet += dt; B.spawnT = 0; }
    }
    // Vindos da sala anterior.
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      if ((q.t -= dt) > 0) continue;
      this.queue.splice(i, 1);
      if (broHas(q.p) && q.p.state !== 'dead') this.jumpIn(q.p, { s: q.s, hp: q.hp, near: true, i: q.i });
    }
    this.updateJumps(dt);
    this.follow(dt);
  }

  // Sem inimigos: cada irmão vai para um lugar em volta do Cavaleiro (anéis atrás dele).
  follow(dt) {
    const c = this.c, foe = this.foes();
    for (const p of c.players) {
      const list = this.mine(p);
      list.forEach((e, i) => {
        if (e.cheerT > 0) e.cheerT -= dt;
        if (foe) { if (e.state === 'broFollow') { e.setState('chase'); e.anim.play(e.data.anims.idle, { fade: 0.15 }); } return; }
        if (e.state !== 'chase' && e.state !== 'broFollow') return;
        if (e.cheerT > 0) return;
        const ring = Math.floor(i / 8), a = p.facing + Math.PI + ((i % 8) - 3.5) * 0.42;
        const r = 2.8 + ring * 1.7;
        const tx = p.position.x + Math.sin(a) * r, tz = p.position.z + Math.cos(a) * r;
        const dx = tx - e.position.x, dz = tz - e.position.z, d = Math.hypot(dx, dz);
        if (e.state !== 'broFollow') e.setState('broFollow');
        if (d > 0.9) {
          const sp = Math.min(d, e.data.speed * (d > 6 ? 1.25 : 1) * dt);
          e.position.x += (dx / d) * sp; e.position.z += (dz / d) * sp;
          e.facing += wrap(Math.atan2(dx, dz) - e.facing) * Math.min(1, dt * 10);
          e.anim.play(e.horse ? e.data.anims.idle : 'Running_A', { fade: 0.15 });
        } else {
          e.facing += wrap(p.facing - e.facing) * Math.min(1, dt * 4);
          e.anim.play(e.data.anims.idle, { fade: 0.25 });
        }
      });
    }
  }

  // ---------- Depois dos inimigos andarem: cavalos, mortes ----------
  after(dt) {
    for (const e of this.c.enemies) {
      if (!e.bro) continue;
      if (!e.alive) {
        if (!e.broDead) {
          e.broDead = true;
          this.c.text.add(`${e.bro.name} caiu!`, e.position, 'crit', 3.2);
          if (e.horse) e.model.position.y = 0;
          if (e.headgear) e.headgear.visible = true;
          this.log({ type: 'broDied', name: e.bro.name });
        }
        continue;
      }
      if (e.horse) {
        const lx = e.lastX ?? e.position.x, lz = e.lastZ ?? e.position.z;
        const sp = Math.hypot(e.position.x - lx, e.position.z - lz) / Math.max(dt, 1e-4);
        e.horseT += dt * (sp > 0.6 ? Math.min(1.4, 0.5 + sp / 8) : 1);
        if (sp > 0.6) e.horse.animate(e.horseT); else e.horse.stand(e.horseT);
      }
      e.lastX = e.position.x; e.lastZ = e.position.z;
    }
  }

  // Irmão morto: cai e some numa luz dourada (combat.js, no lugar de desmontar em ossos). true = já tratou.
  dying(e, dt, i) {
    if (!e.bro) return false;
    e.deathTimer = (e.deathTimer || 0) + dt;
    if (!e.shattered && e.deathTimer >= 1.4) {
      e.shattered = true; e.group.visible = false;
      this.fx.embers(v3(e.position.x, 0.8, e.position.z), 10, 0.8, GOLD, 3);
      this.c.vfx.puff(e.position);
    }
    if (e.deathTimer > 1.6) { this.scene.remove(e.group); this.c.enemies.splice(i, 1); }
    return true;
  }

  // Irmão com escudo segura parte dos golpes que vêm pela frente (undead.js, hitUndead).
  blocks(u, fx, fz) {
    if (!u.bro || !u.data.shield || !u.shieldCovers(fx, fz) || Math.random() > 0.5) return false;
    u.anim.play(u.data.anims.block, { once: true, restart: true, fade: 0.05 });
    u.setState('block');
    this.c.text.add('Bloqueou!', u.position, 'miss', 2.4);
    this.c.vfx.sparks(v3(u.position.x, 1.2, u.position.z), 0xffe0a0, 6);
    audio.play('block', u.position.x, u.position.z);
    this.log({ type: 'broBlock' });
    return true;
  }

  // Sala limpa: comemoram.
  roomClear() {
    for (const e of this.c.enemies) {
      if (!e.bro || !e.alive) continue;
      e.cheerT = 1.6 + Math.random() * 0.6;
      e.setState('broFollow');
      e.anim.play(e.horse ? mountedClip('Cheering') : 'Cheering', { once: true, restart: true, fade: 0.15 });
    }
  }

  // Troca de sala (run.js): os vivos vão junto, com a mesma cara e a vida que tinham.
  carryOut() {
    const out = [];
    for (const e of this.c.enemies) if (e.bro && e.alive && broHas(e.undead)) out.push({ s: e.bro, hp: e.hp, p: e.undead });
    for (const j of this.jumps) if (broHas(j.p)) out.push({ s: j.s, hp: j.hp || R.hp, p: j.p });
    for (const q of this.queue) out.push({ s: q.s, hp: q.hp, p: q.p });
    return out;
  }
  carryIn(list) {
    (list || []).forEach((it, i) => { if (broHas(it.p)) this.queue.push({ ...it, t: 0.45 + i * 0.08, i }); });
  }

  clear() {
    for (const j of this.jumps) this.scene.remove(j.e.group);
    this.jumps.length = 0;
    this.queue.length = 0;
  }
}
const i0 = (i) => i || 0;
