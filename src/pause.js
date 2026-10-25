// Pausa (Esc / Start / botão ⚙), Configurações e Controles.
// Sozinho, o jogo congela; no co-op ele continua rodando (o outro jogador não para).
import { settings } from './settings.js';

const SLIDERS = [['master', 'Volume geral'], ['music', 'Música'], ['sfx', 'Efeitos e vozes']];
const TOGGLES = [['shake', 'Tremida da câmera'], ['hints', 'Dicas de controle na tela']];

const KEYS = [
  ['WASD / setas', 'andar'], ['Mouse', 'mirar'], ['Clique', 'atacar (combo)'], ['Espaço', 'rolar'],
  ['Botão direito / Shift', 'bloquear'], ['Q', 'beber poção'], ['E', 'usar / pegar'], ['R', 'ultimate'], ['Esc', 'pausa'],
];
const PAD = [
  ['Analógico esq.', 'andar'], ['Analógico dir.', 'mirar'], ['X / RB', 'atacar (combo)'], ['A', 'rolar'],
  ['LB / LT', 'bloquear'], ['Y', 'poção / usar'], ['RT', 'ultimate'], ['Start', 'pausa'],
];

export class PauseMenu {
  constructor() {
    const root = document.createElement('div');
    root.id = 'pause';
    root.className = 'hide';
    const list = (rows) => rows.map(([k, v]) => `<div><b>${k}</b><span>${v}</span></div>`).join('');
    root.innerHTML = `
      <div class="box">
        <section data-s="pause">
          <h2>Pausado</h2>
          <p class="note coopnote">No co-op o jogo continua rodando.</p>
          <button type="button" data-a="resume">Continuar</button>
          <button type="button" class="ghost" data-a="config">Configurações</button>
          <button type="button" class="ghost" data-a="controls">Controles</button>
          <button type="button" class="ghost" data-a="quit">Desistir da partida</button>
          <button type="button" class="ghost" data-a="mainmenu">Menu principal</button>
        </section>
        <section data-s="config">
          <h2>Configurações</h2>
          ${SLIDERS.map(([k, label]) => `
            <label class="slider"><span>${label}</span><input type="range" min="0" max="100" step="5" data-k="${k}"><output data-o="${k}"></output></label>`).join('')}
          ${TOGGLES.map(([k, label]) => `
            <button type="button" class="toggle" data-t="${k}"><span>${label}</span><i></i></button>`).join('')}
          <button type="button" class="ghost" data-a="back">Voltar</button>
        </section>
        <section data-s="controls">
          <h2>Controles</h2>
          <div class="cols">
            <div class="keys"><h3>Teclado e mouse</h3>${list(KEYS)}</div>
            <div class="keys"><h3>Controle</h3>${list(PAD)}</div>
          </div>
          <button type="button" class="ghost" data-a="back">Voltar</button>
        </section>
        <section data-s="confirm">
          <h2 class="ctitle"></h2>
          <p class="ctext"></p>
          <button type="button" data-a="yes">Sim</button>
          <button type="button" class="ghost" data-a="no">Não</button>
        </section>
      </div>`;
    document.body.appendChild(root);
    this.root = root;
    this.$ = (s) => root.querySelector(s);
    this.on = {};      // resume, quit, mainmenu (o main.js liga)
    this.screen = null;
    this.from = 'pause'; // 'pause' (no jogo) ou 'menu' (aberto pelo menu principal)

    root.addEventListener('pointerdown', (e) => e.stopPropagation());
    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-t]');
      if (t) { settings.set(t.dataset.t, !settings[t.dataset.t]); return; }
      const b = e.target.closest('button[data-a]');
      if (b) this.action(b.dataset.a);
    });
    root.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (k) settings.set(k, +e.target.value);
    });
    // Teclas dentro do menu não vão para o jogo (setas mexem no volume).
    root.addEventListener('keydown', (e) => { if (e.code !== 'Escape') e.stopPropagation(); });
    settings.onChange(() => this.refresh());

    // Botão no canto (onde ficava o botão de som).
    const btn = document.createElement('button');
    btn.id = 'menubtn';
    btn.type = 'button';
    btn.title = 'Pausa e configurações (Esc)';
    btn.textContent = '⚙';
    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    btn.addEventListener('click', (e) => { e.stopPropagation(); btn.blur(); this.fire('button'); });
    document.body.appendChild(btn);
    this.btn = btn;
  }

  fire(name) { if (this.on[name]) this.on[name](); }

  get visible() { return !this.root.classList.contains('hide'); }

  // opts: { coop, canQuit, canMenu }
  open(screen = 'pause', opts = {}) {
    this.from = screen === 'pause' ? 'pause' : 'menu';
    this.opts = opts;
    this.$('.coopnote').hidden = !opts.coop;
    this.$('[data-a="quit"]').hidden = !opts.canQuit;
    this.$('[data-a="mainmenu"]').hidden = !opts.canMenu;
    this.root.classList.remove('hide');
    document.body.classList.toggle('pmenu', this.from === 'menu'); // aberto pelo menu principal: esconde o menu atrás
    this.show(screen);
  }

  close() { this.root.classList.add('hide'); this.screen = null; document.body.classList.remove('pmenu'); }

  show(screen) {
    this.screen = screen;
    this.root.querySelectorAll('section').forEach((s) => { s.hidden = s.dataset.s !== screen; });
    this.refresh();
    this.focusFirst();
  }

  // Esc / B: volta uma tela (ou fecha).
  back() {
    if (this.screen === 'pause' || this.from === 'menu') { this.close(); this.fire('closed'); return; }
    this.show('pause');
  }

  action(a) {
    switch (a) {
      case 'resume': this.close(); this.fire('closed'); break;
      case 'config': case 'controls': this.show(a); break;
      case 'back': case 'no': this.back(); break;
      case 'quit': this.confirm('quit', 'Desistir da partida?', 'Você volta para a Taverna. O ouro que tem agora vira Ouro de Alma, como se tivesse caído.'); break;
      case 'mainmenu': this.confirm('mainmenu', 'Voltar ao menu principal?', this.opts.canQuit
        ? 'A partida acaba. O ouro que tem agora vira Ouro de Alma, como se tivesse caído.' : 'Seu progresso da Taverna fica salvo.'); break;
      case 'yes': { const w = this.pending; this.close(); this.fire(w); break; }
      default: break;
    }
  }

  confirm(what, title, text) {
    this.pending = what;
    this.$('.ctitle').textContent = title;
    this.$('.ctext').textContent = text;
    this.show('confirm');
  }

  refresh() {
    for (const [k] of SLIDERS) {
      const inp = this.$(`input[data-k="${k}"]`);
      if (document.activeElement !== inp) inp.value = settings[k];
      this.$(`output[data-o="${k}"]`).textContent = settings[k] ? `${settings[k]}%` : 'Mudo';
    }
    for (const [k] of TOGGLES) {
      const b = this.$(`[data-t="${k}"]`);
      b.classList.toggle('on', !!settings[k]);
      b.querySelector('i').textContent = settings[k] ? 'Ligada' : 'Desligada';
    }
  }

  // ---------- Controle (gamepad) e teclado ----------
  items() {
    const sec = this.root.querySelector(`section[data-s="${this.screen}"]`);
    return sec ? [...sec.querySelectorAll('button, input')].filter((el) => !el.hidden && el.offsetParent !== null) : [];
  }

  focusFirst() {
    const it = this.items();
    if (it.length) setTimeout(() => it[0].focus({ preventScroll: true }), 0);
  }

  // Chamado a cada quadro com o menu aberto. pressed(code) = apertou neste quadro.
  nav(pressed) {
    const it = this.items();
    if (!it.length) return;
    let i = it.indexOf(document.activeElement);
    const move = (d) => { i = i < 0 ? 0 : (i + d + it.length) % it.length; it[i].focus({ preventScroll: true }); };
    if (pressed('PadDown')) move(1);
    if (pressed('PadUp')) move(-1);
    const el = it[i];
    if (el && el.type === 'range' && (pressed('PadLeft') || pressed('PadRight'))) {
      const v = Math.max(0, Math.min(100, +el.value + (pressed('PadRight') ? 10 : -10)));
      settings.set(el.dataset.k, v);
      el.value = v;
    }
    if (pressed('PadA') && el && el.tagName === 'BUTTON') el.click();
    if (pressed('PadB')) this.back();
  }
}
