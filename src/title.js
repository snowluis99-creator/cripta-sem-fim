// Tela inicial (capa): o Cavaleiro ajoelhado no alto do penhasco, olhando a cripta lá embaixo no vale.
// Clicar na cripta (ou Enter / A no controle) leva ao menu da cripta (menu.js + menuscene.js).
// Música: a do menu inicial toca aqui; ao entrar na cripta ela some (o dono vai escolher outra).
import * as THREE from 'three';
import { buildTitleScene, FOV } from './titlescene.js';
import { pixelRatio } from './graphics.js';
import { audio } from './audio.js';

const ACT_MS = 2600, HOLD_MS = 500; // levantar + apontar; pausa apontando antes da câmera ir

export class Title {
  constructor() {
    this.on = {};           // enter (clicou na cripta)
    this.visible = false;
    this.busy = false;
    const root = document.createElement('div');
    root.id = 'title';
    root.className = 'hide intro'; // abertura: tela branca com o nome; a cena aparece aos poucos
    root.innerHTML = `<canvas></canvas>
      <div class="ti-white"></div>
      <div class="ti-name"><h1>Cripta Sem Fim</h1></div>
      <div class="ti-label">Entrar na cripta</div>
      <div class="ti-hint">Clique na cripta para começar</div>
      <div class="ti-fade"></div>`;
    document.body.appendChild(root);
    this.root = root;
    this.canvas = root.querySelector('canvas');
    this.label = root.querySelector('.ti-label');
    this.hint = root.querySelector('.ti-hint');
    this.hover = false;
    this.t = 0;
    this.ready = this.build();
    root.addEventListener('pointermove', (e) => this.move(e.clientX, e.clientY));
    root.addEventListener('pointerleave', () => this.setHover(false));
    root.addEventListener('click', (e) => { this.move(e.clientX, e.clientY); if (this.hover) this.enter(); });
    addEventListener('keydown', (e) => {
      if (!this.visible || this.busy || document.body.classList.contains('pmenu')) return;
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') { e.preventDefault(); this.enter(); }
      // testes: Shift+P congela o cavaleiro em pontos da ação (levantar → puxar → apontar); Shift+O solta
      if (e.shiftKey && e.code === 'KeyP') { const st = [0.15, 0.3, 0.42, 0.55, 0.7, 0.85, 1]; this.testI = ((this.testI ?? -1) + 1) % st.length; this.testAct = st[this.testI]; }
      if (e.shiftKey && e.code === 'KeyO') { this.testAct = null; this.testI = -1; if (this.view) this.view.state.act = 0; }
    });
    addEventListener('resize', () => this.resize());
  }

  async build() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.view = await buildTitleScene();
    this.resize();
  }

  resize() {
    if (!this.renderer) return;
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(pixelRatio());
    this.renderer.setSize(w, h, false);
    const cam = this.view.camera;
    cam.aspect = w / h;
    // Tela estreita (retrato): abre o campo de visão para o cavaleiro e a cripta caberem
    cam.fov = w / h < 1.2 ? FOV * Math.min(1.7, 1.2 / (w / h)) : FOV;
    cam.updateProjectionMatrix();
  }

  move(cx, cy) {
    if (!this.view) return;
    const x = cx / innerWidth, y = cy / innerHeight;
    this.view.state.mouseX = x * 2 - 1; this.view.state.mouseY = y * 2 - 1;
    const r = this.view.cryptRect();
    this.setHover(x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
  }

  setHover(on) {
    if (this.busy) on = false;
    this.hover = on;
    this.root.classList.toggle('over', on);
  }

  async show() {
    await this.ready;
    this.busy = false;
    this.view.state.zoom = 0; this.view.state.act = 0; this.actFrom = 0; this.zoomFrom = 0;
    this.root.classList.remove('hide', 'leaving');
    this.visible = true;
    this.shownAt = performance.now();
    if (!this.introDone) { this.introDone = true; setTimeout(() => this.root.classList.remove('intro'), 2200); }
    this.hint.classList.remove('on');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => { if (this.visible && !this.busy) this.hint.classList.add('on'); }, this.introDone === 1 ? 4000 : 6500); this.introDone = 1;
    if (!this.loop) { this.last = performance.now(); this.loop = true; requestAnimationFrame((n) => this.frame(n)); }
  }

  hide() {
    this.visible = false;
    this.loop = false;
    this.root.classList.add('hide');
    this.setHover(false);
  }

  // Avança a câmera até a cripta, escurece e chama on.enter
  enter(instant = false) {
    if (!this.visible || this.busy) return;
    this.busy = true;
    this.setHover(false);
    this.hint.classList.remove('on');
    if (instant) { this.hide(); this.fire('enter'); return; }
    // primeiro o cavaleiro levanta, puxa a espada e aponta para a cripta; depois a câmera vai até lá
    this.actFrom = performance.now();
    audio.play('select', null, null, { net: false });
    if (this.on.click) this.on.click();
  }

  skip() { if (this.visible) this.enter(true); } // testes
  // Testes (o navegador de teste é lento): para o laço e desenha um quadro no tempo t
  still(t = 3, hover = false) { this.loop = false; this.t = t; this.view.update(0.05, t, hover); this.view.update(0.05, t, hover); this.renderer.render(this.view.scene, this.view.camera); }

  fire(n) { if (this.on[n]) this.on[n](); }

  frame(now) {
    if (!this.loop) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    this.t += dt;
    const v = this.view;
    if (this.busy && this.actFrom) {
      const e = now - this.actFrom;
      v.state.act = Math.min(1, e / ACT_MS);
      if (e >= ACT_MS + HOLD_MS) { this.actFrom = 0; this.zoomFrom = now; this.root.classList.add('leaving'); }
    }
    if (!this.busy && this.testAct != null) v.state.act = this.testAct;
    if (this.busy && this.zoomFrom) {
      const k = Math.min(1, (now - this.zoomFrom) / 1400);
      v.state.zoom = k;
      if (k >= 1) { this.zoomFrom = 0; this.hide(); this.fire('enter'); return; }
    }
    // posição do rótulo "Entrar na cripta" sobre a cripta
    if (this.hover) {
      const r = v.cryptRect();
      this.label.style.left = `${((r.x0 + r.x1) / 2) * 100}%`;
      this.label.style.top = `${r.y1 * 100}%`;
    }
    v.update(dt, this.t, this.hover);
    this.renderer.render(v.scene, v.camera);
    requestAnimationFrame((n) => this.frame(n));
  }

  // Controle: A entra na cripta
  nav(pressed) { if (this.visible && !this.busy && pressed('PadA')) this.enter(); }
}
