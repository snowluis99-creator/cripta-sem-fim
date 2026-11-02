// Menu inicial: jogar sozinho, criar uma sala co-op (anfitrião) ou entrar na sala de um amigo.
// Visual: cena noturna da cripta com esqueletos (menuscene.js) e opções à esquerda com a espada apontando.
import { menuScene } from './menuscene.js';

const SWORD = `<svg viewBox="0 0 96 44"><defs>
  <linearGradient id="msbl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7ff"/><stop offset=".5" stop-color="#b9c2d4"/><stop offset="1" stop-color="#7d8698"/></linearGradient>
  <linearGradient id="msgd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset="1" stop-color="#b8801f"/></linearGradient></defs>
  <circle cx="6" cy="22" r="5" fill="url(#msgd)"/><rect x="10" y="18.5" width="16" height="7" rx="2" fill="#5b3418"/>
  <rect x="13" y="18.5" width="2" height="7" fill="#7a4a22"/><rect x="19" y="18.5" width="2" height="7" fill="#7a4a22"/>
  <path d="M26 8 L32 8 L32 36 L26 36 Z" fill="url(#msgd)"/><path d="M32 17 L84 17 L94 22 L84 27 L32 27 Z" fill="url(#msbl)"/>
  <path d="M32 22 L90 22" stroke="#8f98aa" stroke-width="1.2"/></svg>`;

export class Menu {
  constructor() {
    const root = document.createElement('div');
    root.id = 'menu';
    root.className = 'hide'; // começa escondido: a capa (title.js) vem primeiro
    root.innerHTML = `
      <div class="box">
        <h1>Cripta Sem Fim</h1>
        <div class="sword" aria-hidden="true">${SWORD}</div>
        <section data-s="main">
          <button type="button" data-a="solo">Jogar sozinho</button>
          <button type="button" data-a="host">Criar sala (2 jogadores)</button>
          <button type="button" data-a="join">Entrar ou assistir a sala de um amigo</button>
          <button type="button" class="ghost" data-a="config">Configurações</button>
          <button type="button" class="ghost" data-a="controls">Controles</button>
          <button type="button" class="ghost" data-a="field">← Voltar ao campo</button>
          <p class="note"></p>
        </section>
        <section data-s="host">
          <p>Código da sala</p>
          <div class="code"></div>
          <p class="wait">Esperando o Jogador 2 entrar…</p>
          <p class="small">Mande este link do jogo para o seu amigo. Ele abre, clica em <b>Entrar ou assistir a sala de um amigo</b> e escolhe esta sala. Quem quiser só assistir entra com o mesmo código em <b>Assistir</b>.</p>
          <button type="button" class="ghost" data-a="back">Cancelar</button>
        </section>
        <section data-s="join">
          <p>Salas abertas agora</p>
          <div class="rooms"></div>
          <p class="small">Ou digite o código:</p>
          <div class="row"><input maxlength="8" placeholder="ABCD" autocomplete="off" spellcheck="false"><button type="button" data-a="go">Entrar</button><button type="button" class="watch" data-a="gowatch">👁 Assistir</button></div>
          <button type="button" class="ghost" data-a="back">Voltar</button>
        </section>
        <section data-s="msg">
          <p class="msgtext"></p>
          <button type="button" class="ghost" data-a="msgok">OK</button>
        </section>
      </div>`;
    document.body.appendChild(root);
    this.root = root;
    this.sword = root.querySelector('.sword');
    // espada acompanha a opção com o mouse em cima / em foco
    root.addEventListener('pointerover', (e) => { const b = e.target.closest('button'); if (b && !b.disabled && b !== document.activeElement) b.focus({ preventScroll: true }); });
    root.addEventListener('focusin', (e) => { const b = e.target.closest('button'); if (b) this.point(b); });
    addEventListener('keydown', (e) => {
      if (!this.visible || document.body.classList.contains('pmenu') || e.target.tagName === 'INPUT') return;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); this.move(1); }
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); this.move(-1); }
    });
    this.$ = (s) => root.querySelector(s);
    this.on = {};          // solo, host, join(code), watch(code), back, msgok, config, controls
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const a = b.dataset.a;
      menuScene.sfx.confirm();
      b.animate([{ transform: 'translateX(6px) scale(1)' }, { transform: 'translateX(14px) scale(1.06)' }, { transform: 'translateX(6px) scale(1)' }], { duration: 260 });
      if (a === 'go') return this.fire('join', this.$('input').value.trim().toUpperCase());
      if (a === 'room') return this.fire('join', b.dataset.code);
      if (a === 'gowatch') return this.fire('watch', this.$('input').value.trim().toUpperCase());
      if (a === 'watchroom') return this.fire('watch', b.dataset.code);
      this.fire(a);
    });
    this.$('input').addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.fire('join', this.$('input').value.trim().toUpperCase());
    });
  }

  fire(name, arg) { if (this.on[name]) this.on[name](arg); }

  get visible() { return !this.root.classList.contains('hide'); }

  show(screen) {
    this.root.classList.remove('hide');
    this.root.querySelectorAll('section').forEach((s) => { s.hidden = s.dataset.s !== screen; });
    this.screen = screen;
    menuScene.start();
    if (screen === 'join') setTimeout(() => this.$('input').focus(), 50);
    else requestAnimationFrame(() => { const it = this.items(); if (it[0]) it[0].focus({ preventScroll: true }); });
  }

  hide() { this.root.classList.add('hide'); menuScene.stop(); }

  // Espiral até o preto e então entra no jogo (Jogar sozinho)
  enter(go) { menuScene.spiral(() => { this.hide(); go(); }); }
  get busy() { return menuScene.busy; }

  items() { const sec = this.root.querySelector(`section[data-s="${this.screen}"]`); return sec ? [...sec.querySelectorAll('button:not(:disabled)')] : []; }
  move(d) {
    const it = this.items(); if (!it.length) return;
    let i = it.indexOf(document.activeElement);
    i = i < 0 ? 0 : (i + d + it.length) % it.length; it[i].focus({ preventScroll: true });
  }
  point(b) {
    const box = this.root.querySelector('.box').getBoundingClientRect(), r = b.getBoundingClientRect();
    this.sword.style.transform = `translate(${r.left - box.left - 50}px, ${r.top - box.top + r.height / 2 - 11}px)`;
    this.sword.style.opacity = '1';
    this.root.querySelectorAll('button.on').forEach((o) => o.classList.remove('on')); b.classList.add('on');
    if (this.lastPointed !== b) { this.lastPointed = b; menuScene.sfx.tick(); }
  }
  // Controle: direcional cima/baixo, A escolhe, B volta
  nav(pressed) {
    if (!this.visible || this.busy) return;
    if (pressed('PadDown')) this.move(1);
    if (pressed('PadUp')) this.move(-1);
    if (pressed('PadA') && document.activeElement && document.activeElement.tagName === 'BUTTON' && this.root.contains(document.activeElement)) document.activeElement.click();
    if (pressed('PadB')) this.fire(this.screen === 'main' ? 'field' : this.screen === 'msg' ? 'msgok' : 'back');
  }

  setCoop(available, note = '') {
    this.root.querySelectorAll('[data-a="host"], [data-a="join"]').forEach((b) => { b.disabled = !available; });
    this.$('.note').textContent = note;
  }

  setCode(code) { this.$('.code').textContent = code; }
  setWait(text) { this.$('.wait').textContent = text; }

  setRooms(list) {
    const el = this.$('.rooms');
    const key = list.map((r) => `${r.code}${r.open ? '+' : ''}`).join(',');
    if (key === this.roomsKey) return;
    this.roomsKey = key;
    el.innerHTML = '';
    if (!list.length) { el.innerHTML = '<p class="small">Nenhuma sala aberta ainda.</p>'; return; }
    for (const r of list) {
      const row = document.createElement('div');
      row.className = 'row';
      const add = (a, text, cls = '') => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.a = a;
        b.dataset.code = r.code;
        b.textContent = text;
        if (cls) b.className = cls;
        row.appendChild(b);
      };
      if (r.open) add('room', `Entrar na sala ${r.code}`);
      add('watchroom', r.open ? '👁 Assistir' : `👁 Assistir a sala ${r.code} (jogando)`, 'watch');
      el.appendChild(row);
    }
  }

  message(text) { this.$('.msgtext').textContent = text; this.show('msg'); }
}
