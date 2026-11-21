// Bênção de Odin (lendária do Machado de Duas Mãos, 12/11/2026): o Cavaleiro vira o Deus do Trovão até o fim da
// partida. combat.thor = ThorKit. Números em l1bless.js (L1.thor); visual em thorlook.js.
// - Os bônus de ficha (+100% dano/ataque/movimento, +100 de vida) entram na hora pela própria bênção.
// - Fases: wait (acabou de pegar) -> intro (cena: raios na sala, raio gigante no Cavaleiro) -> play (até o fim).
// - Todo golpe: relâmpago em todos os inimigos perto, com o dano do golpe (strike).
// - Atacar sem ninguém no alcance: o golpe vira um arremesso (thorOverride): o machado leva os inimigos até a
//   parede e lá explode executando todos (chefes levam 150); depois volta sozinho para a mão.
// - Rolar: raio instantâneo (thorStartDodge). Apanhar: explosão na sala inteira, 1 vez a cada 3 s (onHurt).
// Ganchos: player.js (startAttack, startDodge, reset), combat.js (playerStrike, hitPlayer, tick, clear), main.js (tecla).
import * as THREE from 'three';
import { audio } from './audio.js';
import { instance } from './assets.js';
import { L1 } from './l1bless.js';
import { MechFx } from './mechfx.js';
import { axeRangeMul } from './axekit.js';
import { e1RangeMul } from './e1kit.js';
import { BLUE, WHITE, thorDress, thorUndress, thorLookTick, thorAxeGlow } from './thorlook.js';

const T = L1.thor;
const DEG = Math.PI / 180;
const W = (p) => (p && p.stats && p.stats.w) || {};
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (a, b) => a + Math.random() * (b - a);
const isAxeHero = (p) => !!(p && p.heroId === 'knight' && p.hero && p.hero.weaponId === 'machado');

let C = null; // o kit da partida

export const thorOn = (p) => !!(p && p.thor && p.thor.phase === 'play');
const thorHas = (p) => !!W(p).thorForm && isAxeHero(p);

// Passo do combo que arremessa o machado (o clipe "Throw" já é usado pelo Arremesso Mortal).
const THROW_STEP = { clip: 'Throw', speed: 1.7, hit: 0.4, end: 0.72, lunge: 0.1, damage: 0, kit: 'thorThrow', keepFacing: true };

// Tem inimigo ao alcance deste golpe, olhando para "facing"?
function inReach(p, step, facing) {
  if (!C) return true;
  const h = p.hero;
  const range = h.attackRange * p.stats.rangeMul * axeRangeMul(p, step) * e1RangeMul(p) + (step.heavy ? 1.2 : 0.3);
  const arc = (step.arc || h.attackArc) / 2 * DEG;
  for (const e of C.c.enemies) {
    if (!e.targetable) continue;
    const dx = e.position.x - p.position.x, dz = e.position.z - p.position.z, d = Math.hypot(dx, dz) || 0.001;
    if (d > range + e.data.radius) continue;
    if (arc >= Math.PI || Math.abs(wrap(Math.atan2(dx, dz) - facing)) <= arc + 0.2) return true;
  }
  return false;
}

// Começo do golpe: sem ninguém no alcance, o golpe vira o arremesso do machado (devolve o passo) ou nada.
export function thorOverride(p, camera) {
  if (!thorOn(p) || p.thorAxe || p.axeAway || p.axeSaw) return null;
  const step = p.hero.combo[p.combo] || p.hero.combo[0];
  const facing = p.frozen ? p.facing : p.aimAngle(camera);
  if (inReach(p, step, facing)) return null;
  p.facing = facing;
  return THROW_STEP;
}
// O machado está voando: não dá para golpear até ele voltar.
export const thorNoAxe = (p) => !!(p && p.thorAxe);

// Rolamento instantâneo: um raio leva o Cavaleiro até o fim do rolamento na hora.
export function thorStartDodge(p) {
  if (!thorOn(p) || !C) return false;
  return C.blink(p);
}

// Nova partida / troca de herói ou arma: tira o Thor.
export function thorReset(p) {
  if (C) C.dropAxe(p, true);
  if (p.thor && p.thor.phase === 'intro' && p.state === 'cine') p.exitCine();
  p.thor = null; p.thorAxe = null; p.thorBoomCd = 0;
  thorUndress(p);
  if (C) C.ui.show(p, false);
}

// ---------- Tela: faixas de cinema e título ----------
class ThorUi {
  build() {
    if (this.el || typeof document === 'undefined') return;
    const st = document.createElement('style');
    st.textContent = `
#thorcine { position:fixed; inset:0; pointer-events:none; z-index:6; }
#thorcine .dim { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 45%, rgba(10,20,40,0) 15%, rgba(2,6,18,.86) 80%); opacity:0; transition:opacity .45s; }
#thorcine .bars::before, #thorcine .bars::after { content:""; position:absolute; left:0; right:0; height:0; background:#000; transition:height .4s cubic-bezier(.2,.8,.2,1); }
#thorcine .bars::before { top:0; } #thorcine .bars::after { bottom:0; }
#thorcine.on .dim { opacity:1; } #thorcine.on .bars::before, #thorcine.on .bars::after { height:9vh; }
#thorcine .title { position:absolute; left:0; right:0; top:18%; text-align:center; opacity:0; font-family:"Titulo", Georgia, serif; }
#thorcine .title .t1 { font-size:clamp(36px, 8.6vw, 96px); letter-spacing:.12em; text-transform:uppercase; background:linear-gradient(#ffffff, #9fdcff 45%, #2a7bd8); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; filter:drop-shadow(0 0 18px rgba(80,170,255,.95)) drop-shadow(0 3px 0 #061a3a); }
#thorcine .title .t2 { margin-top:2px; font:bold clamp(12px, 1.9vw, 20px) Georgia, serif; letter-spacing:.45em; color:#bfe6ff; text-shadow:0 1px 3px #000, 0 0 10px #3a9cff; }
#thorcine .title.go { animation:thortitle 2.4s cubic-bezier(.15,.85,.25,1) forwards; }
#thorcine .flash { position:absolute; inset:0; background:#e4f4ff; opacity:0; }
#thorcine .flash.go { animation:thorflash .45s ease-out; }
#thorcine .flash.soft.go { animation:thorflash2 .3s ease-out; }
@keyframes thortitle { 0% { opacity:0; transform:scale(2.2); } 10% { opacity:1; transform:scale(1); } 80% { opacity:1; transform:scale(1.04); } 100% { opacity:0; transform:scale(1.1); } }
@keyframes thorflash { 0% { opacity:.9; } 100% { opacity:0; } }
@keyframes thorflash2 { 0% { opacity:.35; } 100% { opacity:0; } }`;
    document.head.appendChild(st);
    const el = (this.el = document.createElement('div')); el.id = 'thorcine';
    el.innerHTML = '<div class="dim"></div><div class="bars"></div><div class="flash"></div><div class="title"><div class="t1">Deus do Trovão</div><div class="t2">BÊNÇÃO DE ODIN · LENDÁRIA</div></div>';
    document.body.appendChild(el);
  }
  mine(p) { return !C || !C.c || p === C.c.player; }
  show(p, on) { if (!this.mine(p)) return; this.build(); if (this.el) this.el.classList.toggle('on', on); }
  title(p) { if (!this.mine(p)) return; this.build(); if (!this.el) return; const t = this.el.querySelector('.title'); t.classList.remove('go'); void t.offsetWidth; t.classList.add('go'); }
  flash(p, soft = false) { if (!this.mine(p)) return; this.build(); if (!this.el) return; const f = this.el.querySelector('.flash'); f.classList.toggle('soft', soft); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
}

export class ThorKit {
  constructor(c) {
    this.c = c; C = this;
    this.fx = new MechFx(c.vfx);
    this.ui = new ThorUi();
    this.axes = [];   // machados voando: { p, g, spin, phase: 'out'|'back', dx, dz, dist, carried: [], bossHit: Set }
    this.light = null;
  }
  log(o) { if (this.c.log) this.c.log(o); }
  get scene() { return this.c.vfx.scene; }
  text(t, pos, cls, h) { this.c.text.add(t, pos, cls, h); }

  // Luz azul que acompanha o Thor (criada uma vez: ligar/desligar luzes obriga o jogo a refazer os materiais).
  glow(pos, want) {
    if (!this.light) { this.light = new THREE.PointLight(0x5ab4ff, 0, 12, 1.6); this.scene.add(this.light); }
    this.light.position.set(pos.x, 2.2, pos.z);
    this.light.intensity += (want - this.light.intensity) * 0.25;
  }
  spike(pos, v = 40) { this.glow(pos, 0); this.light.intensity = v; }

  // Raio do céu até um ponto.
  skyBolt(x, z, y = 0.15, big = false) {
    const top = v3(x + rnd(-1.2, 1.2), 13, z + rnd(-1.2, 1.2));
    this.c.vfx.lightning(top, v3(x, y, z), big ? WHITE : BLUE, big ? 0.5 : 0.22);
    if (big) this.c.vfx.lightning(top.clone().add(v3(rnd(-0.6, 0.6), 0, rnd(-0.6, 0.6))), v3(x, y, z), BLUE, 0.3);
    this.fx.flare(v3(x, Math.max(0.3, y), z), big ? 3 : 1.3, BLUE, big ? 0.35 : 0.2);
  }

  // ---------- Transformação ----------
  begin(p) {
    p.thor = { phase: 'intro', t: 0, boltT: 0, struck: false };
    p.thorBoomCd = 0;
    p.enterCine();
    p.anim.play('Cheering', { fade: 0.12, restart: true });
    this.ui.show(p, true);
    audio.play('thunder', p.position.x, p.position.z, { v: 1.3 });
    this.text('BÊNÇÃO DE ODIN!', p.position, 'big', 3.6);
    this.fx.shock(p.position.x, p.position.z, 3, BLUE, 0.6);
    this.log({ type: 'thorBegin' });
  }
  strikeKnight(p) {
    const x = p.position.x, z = p.position.z, I = T.intro;
    p.thor.struck = true;
    this.fx.skyBeam(x, z, 1.7, 0.7, BLUE);
    for (let i = 0; i < 3; i++) this.skyBolt(x, z, 1.2, i === 0);
    this.fx.shock(x, z, I.push, BLUE, 0.7);
    this.fx.shock(x, z, I.push * 0.55, WHITE, 0.45);
    this.fx.crack(x, z, 3.6, 5, BLUE);
    this.fx.rocks(x, z, 12, 1);
    this.fx.embers(v3(x, 0.5, z), 20, 1.5, BLUE, 5);
    this.spike(p.position, 60);
    this.ui.flash(p); this.ui.title(p);
    this.c.shakeFor(p, 0.7);
    audio.play('thunder', x, z, { v: 1.6 });
    audio.play('mechPower', x, z, { v: 0.8 });
    thorDress(p);
    // A onda empurra os inimigos para longe e deixa todos tontos (sem dano).
    for (const e of this.c.enemies) {
      if (!e.alive || !e.targetable) continue;
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      if (d > I.push + e.data.radius) continue;
      if (e.vel && !e.data.boss) e.vel.set(dx / d, 0, dz / d).multiplyScalar(14 * Math.max(0.4, 1 - d / I.push));
      if (e.daze) e.daze(e.data.boss ? 0.5 : I.daze);
    }
    this.log({ type: 'thorStrike' });
  }
  finishIntro(p) {
    if (!p.thor) return;
    if (!p.thor.struck) this.strikeKnight(p);
    p.thor.phase = 'play';
    this.ui.show(p, false);
    if (p.state === 'cine') p.exitCine();
    this.log({ type: 'thorPlay' });
  }

  tick(dt) {
    const c = this.c;
    let want = 0, at = null;
    for (const p of c.players) {
      if (!thorHas(p)) { if (p.thor || p.thorLook) thorReset(p); continue; }
      if (!p.thor) {
        const ok = (p.state === 'idle' || p.state === 'run') && !p.frozen && !p.choosing && c.world;
        if (ok) this.begin(p);
        continue;
      }
      const th = p.thor;
      if (p.thorBoomCd > 0) p.thorBoomCd -= dt;
      if (th.phase === 'intro') {
        th.t += dt; th.boltT -= dt;
        const I = T.intro;
        p.aimForward && p.aimForward();
        if (th.t < I.call && th.boltT <= 0) { // raios caindo pela sala
          th.boltT = rnd(0.08, 0.16);
          const a = Math.random() * Math.PI * 2, r = rnd(2.5, 9);
          const x = p.position.x + Math.cos(a) * r, z = p.position.z + Math.sin(a) * r;
          if (!c.world || !c.world.blocked(x, z, 0.3)) { this.skyBolt(x, z); if (Math.random() < 0.4) audio.play('zap', x, z, { v: 0.5 }); }
        }
        if (!th.struck && th.t >= I.call) this.strikeKnight(p);
        if (th.t >= I.end) this.finishIntro(p);
        want = th.struck ? 14 : 4 + 6 * Math.random(); at = p.position;
      } else {
        if (!p.thorLook) thorDress(p);
        thorAxeGlow(p); // arma nova (ex.: a mesma depois de rebuild): azul de novo
        want = 7 + 2 * Math.sin(performance.now() / 90) * Math.random(); at = p.position;
      }
      thorLookTick(p, dt, c.vfx, p.state === 'attack');
    }
    if (at) this.glow(at, want); else if (this.light) this.light.intensity *= 0.8;
    this.updateAxes(dt);
  }

  // ---------- Golpes ----------
  // Chamado no impacto de todo golpe. true = o golpe foi trocado (arremesso).
  strike(p, step) {
    if (!thorOn(p)) return false;
    if (step.kit === 'thorThrow') { this.throwAxe(p); return true; }
    this.zap(p, step);
    return false;
  }
  // Relâmpago: todos os inimigos perto levam o dano do golpe.
  zap(p, step) {
    const c = this.c, x = p.position.x, z = p.position.z;
    const dmg = Math.max(1, Math.round((step.damage || 0) * p.stats.damageMul));
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      if (d > T.zapR + e.data.radius) continue;
      if (n < 10) this.skyBolt(e.position.x, e.position.z, 1.2);
      c.bonusDamage(e, dmg, dx / d, dz / d, 'dmg', p);
      n++;
    }
    if (n) { audio.play('zap', x, z, { v: 0.9 }); this.spike(p.position, 22); }
    this.log({ type: 'thorZap', n, dmg });
  }

  // Apanhou: explosão de raio na sala inteira (1 vez a cada 3 s).
  onHurt(p) {
    if (!thorOn(p) || p.state === 'dead' || p.hp <= 0 || p.thorBoomCd > 0) return;
    p.thorBoomCd = T.boom.cd;
    const c = this.c, x = p.position.x, z = p.position.z;
    const chest = v3(x, 1.3, z);
    this.fx.shock(x, z, 16, BLUE, 0.7);
    this.fx.shock(x, z, 7, WHITE, 0.4);
    this.fx.flare(chest, 4, BLUE, 0.35);
    this.skyBolt(x, z, 1.4, true);
    this.spike(p.position, 70);
    this.ui.flash(p, true);
    c.shakeFor(p, 0.5);
    audio.play('thunder', x, z, { v: 1.5 });
    this.text('TROVÃO!', p.position, 'crit', 3.8);
    let n = 0;
    for (const e of [...c.enemies]) {
      if (!e.targetable) continue;
      const dx = e.position.x - x, dz = e.position.z - z, d = Math.hypot(dx, dz) || 0.01;
      if (n < 12) { c.vfx.lightning(chest.clone(), v3(e.position.x, 1.2, e.position.z), BLUE, 0.3); this.skyBolt(e.position.x, e.position.z, 1.1); }
      c.bonusDamage(e, T.boom.dmg, dx / d, dz / d, 'dmg big', p);
      n++;
    }
    this.log({ type: 'thorBoom', n });
  }

  // Rolamento: raio instantâneo até o fim do caminho (para na parede).
  blink(p) {
    const wd = this.c.world;
    if (p.ctl) p.ctl.moveDir(p.dodgeDir);
    if (p.dodgeDir.lengthSq() === 0) p.dodgeDir.set(Math.sin(p.facing), 0, Math.cos(p.facing)); else p.dodgeDir.normalize();
    const dx = p.dodgeDir.x, dz = p.dodgeDir.z, x0 = p.position.x, z0 = p.position.z, r = p.hero.radius * 0.8;
    const len = p.hero.dodge.distance * (p.stats.dodgeMul || 1);
    let x = x0, z = z0;
    for (let s = 0.25; s <= len + 1e-6; s += 0.25) {
      const nx = x0 + dx * s, nz = z0 + dz * s;
      if (wd && wd.blocked(nx, nz, r)) break;
      x = nx; z = nz;
    }
    p.position.x = x; p.position.z = z;
    if (wd) wd.resolveCircle(p.position, p.hero.radius);
    const vfx = this.c.vfx;
    vfx.lightning(v3(x0, 1.1, z0), v3(p.position.x, 1.1, p.position.z), BLUE, 0.3);
    vfx.lightning(v3(x0, 0.3, z0), v3(p.position.x, 0.5, p.position.z), WHITE, 0.15);
    this.fx.flare(v3(x0, 1, z0), 1.6, BLUE, 0.2);
    this.fx.flare(v3(p.position.x, 1, p.position.z), 2, BLUE, 0.25);
    this.fx.shock(p.position.x, p.position.z, 1.6, BLUE, 0.3);
    this.spike(p.position, 26);
    p.facing = Math.atan2(dx, dz); p.group.rotation.y = p.facing;
    p.iframes = Math.max(p.iframes || 0, T.blink.iframes);
    p.combo = 0; p.queued = false; p.clearRoll(); p.setGlow(0);
    if (p.state !== 'idle' && p.state !== 'run') p.setState('idle');
    p.anim.play(p.hero.anims.idle, { fade: 0.08 });
    p.dodgeCooldown = p.hero.dodge.cooldown;
    audio.play('zap', p.position.x, p.position.z, { v: 1.1 });
    if (p.onDodge) { p.onDodge(p, 'start'); p.onDodge(p, 'end'); }
    this.log({ type: 'thorBlink', d: Math.hypot(p.position.x - x0, p.position.z - z0) });
    return true;
  }

  // ---------- Machado arremessado ----------
  throwAxe(p) {
    if (p.thorAxe) return;
    const mesh = instance(p.hero.weapons.right.model);
    mesh.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); if (o.material.emissive) { o.material.emissive.setHex(0x2f8cff); o.material.emissiveIntensity = 1.1; } } });
    const g = new THREE.Group(), spin = new THREE.Group();
    g.add(spin); spin.add(mesh);
    mesh.rotation.z = Math.PI / 2; mesh.position.x = -0.6;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
    g.add(halo);
    const a = p.facing;
    g.position.set(p.position.x + Math.sin(a) * 1.0, 1.15, p.position.z + Math.cos(a) * 1.0);
    this.scene.add(g);
    const it = { p, g, spin, halo, phase: 'out', dx: Math.sin(a), dz: Math.cos(a), dist: 0, carried: [], bossHit: new Set(), zapT: 0 };
    this.axes.push(it);
    p.thorAxe = it;
    if (p.weapon) p.weapon.visible = false;
    audio.play('swingHeavy', p.position.x, p.position.z, { v: 1.2 });
    audio.play('zap', p.position.x, p.position.z, { v: 0.8 });
    this.log({ type: 'thorThrow' });
  }

  updateAxes(dt) {
    const c = this.c, S = T.throw;
    for (const it of [...this.axes]) {
      const p = it.p, g = it.g;
      it.spin.rotation.y += dt * 26;
      it.halo.material.opacity = 0.18 + 0.15 * Math.random();
      if (!c.players.includes(p)) { this.dropAxe(p, true); continue; }
      it.zapT -= dt;
      if (it.zapT <= 0) { it.zapT = rnd(0.04, 0.09); c.vfx.lightning(g.position.clone(), g.position.clone().add(v3(rnd(-1, 1), rnd(-0.8, 0.5), rnd(-1, 1))), BLUE, 0.1); }
      if (it.phase === 'out') {
        const sub = 4, st = S.speed * dt / sub;
        let wall = false;
        for (let k = 0; k < sub && !wall; k++) {
          const nx = g.position.x + it.dx * st, nz = g.position.z + it.dz * st;
          if (c.world && c.world.blocked(nx, nz, 0.35)) { wall = true; break; }
          g.position.x = nx; g.position.z = nz; it.dist += st;
          this.sweep(it);
          if (it.dist >= S.max) { wall = true; break; }
        }
        this.carry(it);
        if (wall) this.explode(it);
      } else {
        const dx = p.position.x - g.position.x, dz = p.position.z - g.position.z, d = Math.hypot(dx, dz) || 0.001;
        if (d <= S.catch + S.back * dt || p.state === 'dead') { this.dropAxe(p, false); continue; }
        g.position.x += dx / d * S.back * dt; g.position.z += dz / d * S.back * dt;
      }
    }
  }

  // Quem o machado encostar vai junto com ele (chefes só levam 150 e são empurrados).
  sweep(it) {
    const c = this.c, g = it.g, S = T.throw;
    for (const e of c.enemies) {
      if (!e.targetable || it.carried.includes(e) || it.bossHit.has(e)) continue;
      if (Math.hypot(e.position.x - g.position.x, e.position.z - g.position.z) > S.r + e.data.radius) continue;
      if (e.data.boss || e.finale || e.immune || e.data.phantom) {
        it.bossHit.add(e);
        c.bonusDamage(e, S.boss, it.dx, it.dz, 'dmg big', it.p);
        if (e.vel) e.vel.set(it.dx, 0, it.dz).multiplyScalar(10);
        this.skyBolt(e.position.x, e.position.z, 1.4);
        this.log({ type: 'thorBossHit', enemy: e });
        continue;
      }
      e.releaseToken && e.releaseToken();
      if (e.atk && e.state === 'attack' && e.endAttack) e.endAttack();
      if (e.vel) e.vel.set(0, 0, 0);
      e.setState('lanceFly'); // sem corpo, não pode ser acertado, ninguém mexe nele (quem mexe é o ThorKit)
      e.anim.play(e.data.anims.hit, { once: true, restart: true, fade: 0.05, speed: 0.6 });
      e.thorSlot = it.carried.length;
      it.carried.push(e);
      c.vfx.sparks(v3(e.position.x, 1.2, e.position.z), BLUE, 8);
      this.text('Pego!', e.position, 'block', 3.2);
      this.log({ type: 'thorGrab', enemy: e });
    }
    if (c.props && c.props.hitAt) c.props.hitAt(g.position.x, g.position.z, it.p);
  }
  // Os pegos vão grudados na frente do machado, uns atrás dos outros.
  carry(it) {
    const g = it.g;
    it.carried = it.carried.filter((e) => e.alive && e.state === 'lanceFly');
    it.carried.forEach((e, i) => {
      const back = 0.4 + (i % 3) * 0.25, lat = ((i % 3) - 1) * 0.7 + Math.floor(i / 3) * 0.2;
      e.position.x = g.position.x + it.dx * back + it.dz * lat;
      e.position.z = g.position.z + it.dz * back - it.dx * lat;
      e.position.y = 0.55;
      e.facing = Math.atan2(-it.dx, -it.dz); e.group.rotation.y = e.facing;
      if (e.model) e.model.rotation.x = -0.9;
      if (e.vel) e.vel.set(0, 0, 0);
    });
  }
  // Bateu na parede: explosão de raio que executa todos que vieram junto.
  explode(it) {
    const c = this.c, g = it.g, p = it.p, x = g.position.x, z = g.position.z;
    it.phase = 'back';
    this.fx.skyBeam(x, z, 1.4, 0.5, BLUE);
    this.skyBolt(x, z, 0.2, true);
    this.skyBolt(x, z, 0.2);
    this.fx.shock(x, z, 4.5, BLUE, 0.55);
    this.fx.crack(x, z, 2.6, 4, BLUE);
    this.fx.rocks(x, z, 8, 0.8);
    this.fx.flare(v3(x, 1, z), 3.5, BLUE, 0.3);
    c.vfx.sparks(v3(x, 1.2, z), BLUE, 16);
    c.shakeFor(p, 0.4);
    audio.play('thunder', x, z, { v: 1.3 });
    audio.play('boom', x, z, { v: 0.7 });
    let n = 0;
    for (const e of it.carried) {
      if (!e.alive) continue;
      e.position.y = 0;
      e.setState('hurt'); e.stunTime = 0.4;
      if (c.world) c.world.resolveCircle(e.position, e.data.radius);
      this.text('Executado!', e.position, 'crit', 3.4);
      c.bonusDamage(e, Math.max(1, Math.ceil(e.hp)), it.dx, it.dz, 'dmg big', p);
      n++;
    }
    it.carried = [];
    this.log({ type: 'thorExplode', n });
  }

  // Tira o machado de cena (pegou de volta, troca de sala, nova partida). Soltar os pegos se ainda estiverem no ar.
  dropAxe(p, silent) {
    const it = this.axes.find((a) => a.p === p);
    if (!it) { p.thorAxe = null; return; }
    for (const e of it.carried) if (e.alive && e.state === 'lanceFly') { e.position.y = 0; e.setState('hurt'); e.stunTime = 0.5; if (this.c.world) this.c.world.resolveCircle(e.position, e.data.radius); }
    it.carried = [];
    this.axes.splice(this.axes.indexOf(it), 1);
    this.scene.remove(it.g);
    it.g.traverse((o) => { if (o.isMesh) { o.material.dispose(); if (o === it.halo) o.geometry.dispose(); } });
    p.thorAxe = null;
    if (p.weapon && !p.axeAway && !p.axeSaw) p.weapon.visible = true;
    if (!silent) { audio.play('block', p.position.x, p.position.z, { v: 0.5 }); this.fx.flare(v3(p.position.x, 1.3, p.position.z), 1.4, BLUE, 0.2); this.log({ type: 'thorCatch' }); }
  }

  // Troca de sala: o machado volta para a mão; a cena termina na hora.
  clear() {
    for (const it of [...this.axes]) this.dropAxe(it.p, true);
    for (const p of this.c.players) if (p.thor && p.thor.phase === 'intro') this.finishIntro(p);
    if (this.light) this.light.intensity = 0;
  }
}
