// Menu inicial: jogar sozinho, criar uma sala co-op (anfitrião) ou entrar na sala de um amigo.

export class Menu {
  constructor() {
    const root = document.createElement('div');
    root.id = 'menu';
    root.innerHTML = `
      <div class="box">
        <h1>Cripta Sem Fim</h1>
        <p class="tag">Desça. Morra. Volte mais forte.</p>
        <section data-s="main">
          <button type="button" data-a="solo">Jogar sozinho</button>
          <button type="button" data-a="host">Criar sala (2 jogadores)</button>
          <button type="button" data-a="join">Entrar ou assistir a sala de um amigo</button>
          <div class="row"><button type="button" class="ghost" data-a="config">⚙ Configurações</button><button type="button" class="ghost" data-a="controls">🎮 Controles</button></div>
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
    this.$ = (s) => root.querySelector(s);
    this.on = {};          // solo, host, join(code), watch(code), back, msgok, config, controls
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const a = b.dataset.a;
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
    this.show('main');
  }

  fire(name, arg) { if (this.on[name]) this.on[name](arg); }

  get visible() { return !this.root.classList.contains('hide'); }

  show(screen) {
    this.root.classList.remove('hide');
    this.root.querySelectorAll('section').forEach((s) => { s.hidden = s.dataset.s !== screen; });
    this.screen = screen;
    if (screen === 'join') setTimeout(() => this.$('input').focus(), 50);
  }

  hide() { this.root.classList.add('hide'); }

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
