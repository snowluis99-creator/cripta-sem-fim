// Cena de desbloqueio de herói na Taverna (Maga): ela pula para o meio da taverna, põe fogo em tudo,
// todo mundo corre e se esconde, ela solta uma onda de gelo que apaga o fogo e congela todos; aos poucos
// o gelo derrete. No fim, aviso "Maga desbloqueada" (moldura, cadeado abrindo, arte da Maga ao fundo).
import * as THREE from 'three';
import { audio } from './audio.js';
import { setFlash, makeFlashable } from './characters.js';
import { getGlowTexture } from './dungeon/builder.js';
import { makeIceBlock } from './magic.js';
import { HEROES } from './heroes.js';

export const UNLOCK_ART = { mage: 'art/maga.jpg' };
const CENTER = new THREE.Vector3(0, 0, -0.5);
// Lugares para se esconder (cantos com barris/caixas).
const HIDE = [[-13.2, -8.4], [12.6, 8.2], [-13, 7.4], [13.4, -9], [-4.2, -9.2], [10.2, 9.6], [4.5, -9.4], [-10.5, 9.4]];
// Linha do tempo (segundos).
const T = { stand: 0, jump: 0.7, land: 1.5, cast: 1.8, fire: 2.1, panic: 2.3, raise: 4.9, wave: 5.4, thaw: 7.0, popup: 9.6 };

// Cor de gelo num personagem (o jogador repinta a si mesmo a cada quadro: usa cineTint).
function iceTint(a, v) {
  if (a.player) a.player.cineTint = v;
  else setFlash(a.mats, v, 0.45, 0.8, 1);
}

function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
  s.scale.setScalar(size);
  return s;
}

// Textura de labareda (gota de fogo apontando para cima).
let flameTex = null;
function getFlameTex() {
  if (flameTex) return flameTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.beginPath();
  g.moveTo(32, 2);
  g.bezierCurveTo(44, 40, 62, 66, 60, 94);
  g.bezierCurveTo(58, 118, 44, 126, 32, 126);
  g.bezierCurveTo(20, 126, 6, 118, 4, 94);
  g.bezierCurveTo(2, 66, 20, 40, 32, 2);
  const grad = g.createRadialGradient(32, 100, 2, 32, 90, 70);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.filter = 'blur(3px)';
  g.fill();
  flameTex = new THREE.CanvasTexture(c);
  return flameTex;
}
function flame(color, w) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: getFlameTex(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.center.set(0.5, 0.05); // cresce para cima a partir da base
  s.scale.set(w, w * 2, 1);
  return s;
}

// Uma fogueira: 3 labaredas tremendo + brilho no chão + brasas.
function makeFire(size) {
  const g = new THREE.Group();
  const base = glow(0xff5a1a, size * 2.2, 0.55);
  base.position.y = size * 0.25;
  g.add(base);
  const parts = [0xff3a0a, 0xff8a1a, 0xffe080].map((c, i) => {
    const s = flame(c, size * (1.1 - i * 0.28));
    s.position.set((Math.random() - 0.5) * size * 0.3, 0.05, (Math.random() - 0.5) * size * 0.3);
    g.add(s); return s;
  });
  const embers = [];
  for (let i = 0; i < 4; i++) { const e = glow(0xffa040, size * 0.18); g.add(e); embers.push({ e, o: Math.random() }); }
  g.userData = { parts, embers, k: 0, out: 0, size, seed: Math.random() * 10 };
  return g;
}

const g0 = (f) => f.children[0]; // brilho no chão da fogueira

export class UnlockScene {
  // g: { scene, vfx, tavern, players, cam }
  constructor(g) {
    Object.assign(this, g);
    this.active = false;
  }

  // heroId = herói desbloqueado; buyer = quem comprou; onDone() no fim (depois de fechar o aviso).
  play(heroId, buyer, onDone, opts = {}) {
    const seat = this.tavern.seats[heroId];
    if (!seat) { onDone && onDone(); return; }
    this.heroId = heroId;
    this.buyer = buyer;
    this.onDone = onDone;
    this.fast = !!opts.fast;       // testes: aviso fecha sozinho
    this.t = 0;
    this.active = true;
    this.mage = seat;
    this.fires = [];
    this.iceDiscs = [];
    this.waveR = -1;
    this.popupShown = false;
    this.from = seat.group.position.clone();
    this.focus = new THREE.Vector3(-1, 0, 0.5); // a câmera olha para o meio da taverna
    if (this.cam.setBaseZoom) this.cam.setBaseZoom(1.18);
    for (const l of this.tavern.labels) l.el.style.visibility = 'hidden';
    // Quem foge: taverneiro, os outros heróis da mesa e os jogadores.
    this.actors = [];
    for (const n of this.tavern.npcs) {
      if (n === seat) continue;
      if (!n.mats) n.mats = makeFlashable(n.group.children[0]).mats;
      const keeper = n === this.tavern.keeper;
      this.actors.push({ group: n.group, anim: n.anim, mats: n.mats, keeper, seated: !keeper, idle: keeper ? 'Idle_B' : 'Idle_A' });
    }
    for (const p of this.players) {
      if (p.state === 'dead') continue;
      p.enterCine();
      p.anim.play(p.hero.anims.idle, { fade: 0.2 });
      this.actors.push({ group: p.group, anim: p.anim, mats: p.bodyMats, player: p, idle: p.hero.anims.idle });
    }
    const spots = [...HIDE].sort(() => Math.random() - 0.5);
    this.actors.forEach((a, i) => {
      const [x, z] = spots[i % spots.length];
      a.to = new THREE.Vector3(x + (Math.random() - 0.5), 0, z + (Math.random() - 0.5));
      a.state = 'wait';
    });
    // Fogo: espalhado pela taverna, acende do meio para fora.
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 12.5;
      const x = Math.max(-14.5, Math.min(14.5, CENTER.x + Math.cos(a) * r * 1.2)), z = Math.max(-10.5, Math.min(10.5, CENTER.z + Math.sin(a) * r * 0.8));
      const f = makeFire(1.1 + Math.random() * 0.9);
      f.position.set(x, 0.05, z);
      f.visible = false;
      f.userData.at = T.fire + (Math.hypot(x - CENTER.x, z - CENTER.z) / 16) * 1.3;
      this.scene.add(f);
      this.fires.push(f);
    }
    seat.anim.play('Sit_Chair_StandUp', { once: true, restart: true, speed: 1.6, fade: 0.1 });
  }

  // Fala para o resto do jogo: está rodando? (bloqueia portas e avisos)
  get busy() { return this.active; }

  update(dt) {
    if (!this.active) return;
    const t0 = this.t, t = (this.t += dt);
    const at = (k) => t0 < k && t >= k;
    const m = this.mage;
    // 1) Pula para o meio.
    if (at(T.jump)) {
      m.anim.play('Jump_Full_Long', { once: true, restart: true, speed: 1.3, fade: 0.08 });
      audio.play('dodge', this.from.x, this.from.z);
    }
    if (t >= T.jump && t < T.land) {
      const k = (t - T.jump) / (T.land - T.jump);
      m.group.position.lerpVectors(this.from, CENTER, k);
      m.group.position.y = Math.sin(k * Math.PI) * 2.6;
      m.group.rotation.y = Math.atan2(CENTER.x - this.from.x, CENTER.z - this.from.z);
    }
    if (at(T.land)) {
      m.group.position.copy(CENTER);
      m.group.rotation.y = 0;
      m.anim.play('Jump_Land', { once: true, restart: true, fade: 0.05 });
      this.vfx.dust(CENTER, new THREE.Vector3(0, 0, 1), 10);
      audio.play('thump', CENTER.x, CENTER.z);
      this.cam.shake(0.25);
    }
    // 2) Fogo em tudo.
    if (at(T.cast)) {
      m.anim.play('Ranged_Magic_Spellcasting_Long', { once: true, restart: true, speed: 1.1, fade: 0.1 });
      audio.play('spell', CENTER.x, CENTER.z);
    }
    if (at(T.fire)) { audio.play('fireRoar'); this.vfx.flameCone(new THREE.Vector3(CENTER.x, 1.2, CENTER.z), 0, 6, Math.PI, 0xff7a2a, true); }
    for (const f of this.fires) {
      const u = f.userData;
      if (!f.visible && t >= u.at && u.out === 0) { f.visible = true; this.vfx.sparks(new THREE.Vector3(f.position.x, 0.6, f.position.z), 0xff9a3c, 4); }
      if (!f.visible) continue;
      u.k = Math.min(1, u.k + dt * 2.5) * (u.out ? Math.max(0, 1 - u.out) : 1);
      if (u.out) { u.out += dt * 3; if (u.out >= 1) { f.visible = false; continue; } }
      const tt = t * 1 + u.seed;
      u.parts.forEach((s, i) => {
        const w = u.size * (1.1 - i * 0.28) * u.k;
        s.scale.set(w * (1 + 0.12 * Math.sin(tt * (13 + i * 4))), w * 2 * (1 + 0.25 * Math.sin(tt * (9 + i * 6) + i)), 1);
        s.material.rotation = 0.12 * Math.sin(tt * (5 + i * 3));
      });
      g0(f).scale.setScalar(u.size * 2.2 * u.k * (1 + 0.1 * Math.sin(tt * 7)));
      u.embers.forEach((e) => {
        const k = (tt * 0.8 + e.o) % 1;
        e.e.position.set(Math.sin(e.o * 30 + tt) * 0.4, u.size * (0.3 + k * 1.6), Math.cos(e.o * 17) * 0.4);
        e.e.material.opacity = (1 - k) * u.k;
      });
    }
    const lights = this.tavern.fireLights || [];
    const fireLevel = this.fireLevel();
    // Fogo: luz laranja tremendo. Depois da onda de gelo: luz azul fria que vai sumindo.
    const cold = t >= T.wave ? Math.min(1, (t - T.wave) * 3) * Math.max(0, 1 - Math.max(0, t - T.thaw) / 2.5) : 0;
    lights.forEach((l, i) => {
      if (cold > 0 && fireLevel < 0.05) { l.color.setHex(0x8fd8ff); l.intensity = 22 * cold; }
      else { l.color.setHex(0xff7a2a); l.intensity = fireLevel * (26 + 8 * Math.sin(t * (9 + i * 3))); }
    });
    // 3) Todo mundo corre e se esconde.
    for (const a of this.actors) this.updateActor(a, t, t0, dt);
    // 4) Onda de gelo: apaga o fogo e congela quem estiver no caminho.
    if (at(T.raise)) {
      m.anim.play('Ranged_Magic_Raise', { once: true, restart: true, speed: 1.2, fade: 0.1 });
      audio.play('charge', CENTER.x, CENTER.z);
    }
    if (at(T.wave)) {
      this.waveR = 0;
      audio.play('iceWave');
      this.cam.shake(0.3);
      this.waveMesh = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64), new THREE.MeshBasicMaterial({
        color: 0xbff0ff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }));
      this.waveMesh.rotation.x = -Math.PI / 2;
      this.waveMesh.position.set(CENTER.x, 0.35, CENTER.z);
      this.scene.add(this.waveMesh);
    }
    if (this.waveR >= 0 && this.waveR < 30) {
      const r0 = this.waveR;
      this.waveR += dt * 20;
      this.waveMesh.scale.setScalar(this.waveR);
      this.waveMesh.material.opacity = 0.9 * Math.max(0, 1 - this.waveR / 30);
      for (const f of this.fires) {
        const d = Math.hypot(f.position.x - CENTER.x, f.position.z - CENTER.z);
        if (d >= r0 && d < this.waveR && f.userData.out === 0) {
          f.userData.out = 0.001;
          this.vfx.smoke(new THREE.Vector3(f.position.x, 0.4, f.position.z), 0x55606c, 3);
        }
      }
      for (const a of this.actors) {
        const d = Math.hypot(a.group.position.x - CENTER.x, a.group.position.z - CENTER.z);
        if (!a.frozen && d < this.waveR) this.freezeActor(a);
      }
      // Gelo no chão por onde a onda passa.
      for (let i = 0; i < 1; i++) {
        const ang = Math.random() * Math.PI * 2, rr = r0 + Math.random() * (this.waveR - r0);
        const x = CENTER.x + Math.cos(ang) * rr, z = CENTER.z + Math.sin(ang) * rr;
        if (Math.abs(x) < 15 && Math.abs(z) < 11) this.vfx.ice(new THREE.Vector3(x, 0, z), 0.8 + Math.random() * 0.9, 5 + Math.random() * 1.5);
      }
      if (this.waveR >= 30) { this.scene.remove(this.waveMesh); this.waveMesh = null; }
    }
    // 5) Derrete aos poucos (um de cada vez).
    this.actors.forEach((a, i) => {
      if (!a.frozen) return;
      const start = T.thaw + i * Math.min(0.35, 1.3 / this.actors.length); // um de cada vez, todos antes do aviso
      if (t < start) return;
      const k = Math.min(1, (t - start) / 1.1);
      a.ice.userData.mat.opacity = 0.55 * (1 - k);
      a.ice.userData.glow.opacity = 0.5 * (1 - k);
      a.ice.scale.setScalar(1 - k * 0.25);
      iceTint(a, 0.5 * (1 - k));
      if (k >= 1) this.thawActor(a);
    });
    if (at(T.thaw + 0.2)) m.anim.play('Cheering', { once: true, restart: true, fade: 0.2, onFinish: () => m.anim.play('Idle_A', { fade: 0.2 }) });
    // 6) Aviso.
    if (t >= T.popup && !this.popupShown) this.showPopup();
    if (this.popupShown && this.fast && t >= T.popup + 0.6) this.closePopup();
  }

  fireLevel() {
    let lit = 0;
    for (const f of this.fires) if (f.visible) lit += f.userData.k;
    return Math.min(1, lit / 12);
  }

  updateActor(a, t, t0, dt) {
    if (a.frozen) return;
    if (a.state === 'wait' && t >= T.panic + (a.keeper ? 0 : Math.random() * 0.25)) {
      if (a.keeper) { // taverneiro se agacha atrás do balcão
        a.state = 'hide';
        a.anim.play('Crouching', { fade: 0.15 });
        return;
      }
      if (a.seated) { a.state = 'stand'; a.anim.play('Sit_Chair_StandUp', { once: true, restart: true, speed: 2.2, fade: 0.08 }); a.standT = t; return; }
      a.state = 'run';
      a.anim.play('Running_A', { fade: 0.1 });
    }
    if (a.state === 'stand' && t - a.standT > 0.4) { a.state = 'run'; a.anim.play('Running_A', { fade: 0.1 }); }
    if (a.state === 'run') {
      const p = a.group.position, dx = a.to.x - p.x, dz = a.to.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { a.state = 'hide'; a.anim.play('Crouching', { fade: 0.15 }); a.group.rotation.y = Math.atan2(CENTER.x - p.x, CENTER.z - p.z) + Math.PI; return; }
      const sp = Math.min(d, 7.5 * dt);
      p.x += (dx / d) * sp; p.z += (dz / d) * sp;
      a.group.rotation.y = Math.atan2(dx, dz);
      if (a.player) a.player.facing = a.group.rotation.y;
    }
  }

  freezeActor(a) {
    a.frozen = true;
    a.anim.mixer.timeScale = 0;
    const s = a.group.scale.x || 1;
    a.ice = makeIceBlock(0.75 / s, 2.3);
    a.group.add(a.ice);
    iceTint(a, 0.5);
    this.vfx.sparks(new THREE.Vector3(a.group.position.x, 1.2, a.group.position.z), 0xbff0ff, 8);
  }

  thawActor(a) {
    a.frozen = false;
    a.thawed = true;
    a.group.remove(a.ice);
    a.ice = null;
    iceTint(a, 0);
    a.anim.mixer.timeScale = 1;
    a.anim.play(a.keeper ? 'Idle_B' : 'Cheering', { once: !a.keeper, restart: true, fade: 0.2, onFinish: () => a.anim.play(a.idle, { fade: 0.2 }) });
    audio.play('thaw', a.group.position.x, a.group.position.z);
    this.vfx.sparks(new THREE.Vector3(a.group.position.x, 1.1, a.group.position.z), 0xe8fbff, 10);
  }

  showPopup() {
    this.popupShown = true;
    audio.play('unlock');
    const name = HEROES[this.heroId].name;
    const el = document.createElement('div');
    el.id = 'unlock';
    el.innerHTML = `
      <div class="uframe">
        <div class="uart" style="background-image:url('${UNLOCK_ART[this.heroId] || ''}')"></div>
        <div class="ushade"></div>
        <i class="uc tl"></i><i class="uc tr"></i><i class="uc bl"></i><i class="uc br"></i>
        <div class="ucontent">
          <svg class="ulock" viewBox="0 0 64 80" aria-hidden="true">
            <defs><linearGradient id="ulg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a8"/><stop offset="1" stop-color="#c7891e"/></linearGradient></defs>
            <path class="ushackle" d="M18 36 V22 a14 14 0 0 1 28 0 V36" fill="none" stroke="url(#ulg)" stroke-width="7" stroke-linecap="round"/>
            <rect x="8" y="34" width="48" height="40" rx="7" fill="url(#ulg)" stroke="#6b4310" stroke-width="2.5"/>
            <circle cx="32" cy="50" r="5.5" fill="#5a3508"/><rect x="29.5" y="52" width="5" height="12" rx="2" fill="#5a3508"/>
          </svg>
          <h2>${name} desbloqueada</h2>
          <p class="usub">Agora ela pode descer à Cripta. Escolha-a na mesa da Taverna.</p>
          <p class="uhint">Clique ou aperte E para continuar</p>
        </div>
      </div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    this.popup = el;
    this.popupAt = performance.now();
    const close = (e) => {
      if (performance.now() - this.popupAt < 1200) return;
      if (e.type === 'keydown' && !['KeyE', 'Enter', 'Space', 'Escape'].includes(e.code)) return;
      this.closePopup();
    };
    this.closeFn = close;
    el.addEventListener('pointerdown', close);
    addEventListener('keydown', close);
    this.padPoll = setInterval(() => {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
      if (pads.some((p) => p.buttons[0]?.pressed || p.buttons[3]?.pressed)) close({ type: 'pad' });
    }, 100);
  }

  closePopup() {
    if (!this.popup) return;
    removeEventListener('keydown', this.closeFn);
    clearInterval(this.padPoll);
    const el = this.popup;
    this.popup = null;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
    this.finish();
  }

  finish() {
    for (const f of this.fires) this.scene.remove(f);
    this.fires.length = 0;
    if (this.waveMesh) { this.scene.remove(this.waveMesh); this.waveMesh = null; }
    for (const a of this.actors) {
      if (a.frozen) this.thawActor(a);
      if (a.player) a.player.exitCine();
    }
    for (const l of this.tavern.fireLights || []) l.intensity = 0;
    for (const l of this.tavern.labels) l.el.style.visibility = '';
    if (this.cam.setBaseZoom) this.cam.setBaseZoom(1);
    this.active = false;
    const cb = this.onDone;
    this.onDone = null;
    if (cb) cb(CENTER.clone());
  }

  // Sair da Taverna no meio da cena (ex.: teste): limpa sem chamar onDone.
  abort() {
    if (!this.active) return;
    this.onDone = null;
    if (this.popup) { this.popup.remove(); this.popup = null; removeEventListener('keydown', this.closeFn); clearInterval(this.padPoll); }
    this.finish();
  }
}
