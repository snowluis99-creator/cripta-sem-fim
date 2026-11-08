// Menus e textos por cima do jogo: escolha de bênção, rótulos das portas, aviso de interação,
// escurecer entre salas e tela de fim de andar.
import * as THREE from 'three';
import { RARITY, describe } from './blessings.js';
import { weaponById } from './heroes.js';
// Bênção exclusiva: nome curto da arma ("Espada", "Kunais"...).
const wName = (b) => { if (!b.weapon) return ''; const [h, w] = b.weapon.split('.'); return weaponById(h, w).short; };
import { input, input2 } from './input.js';

const tmp = new THREE.Vector3();

export class Ui {
  constructor() {
    const root = document.createElement('div');
    root.id = 'ui';
    root.innerHTML = `
      <div class="labels"></div>
      <div class="prompt"></div>
      <div class="prompt p2"></div>
      <div class="choice"><h2></h2><p class="sub"></p><div class="cards"></div><p class="hint"></p></div>
      <div class="fade"></div>
      <div class="win"><h2>Vitória!</h2><p class="sub2">O Ceifador Sombrio caiu e a cripta enfim descansa.</p><p class="stats"></p>
        <button type="button">Voltar à Taverna</button><p class="hint">Enter, R ou A no controle</p></div>`;
    document.body.appendChild(root);
    this.$ = (s) => root.querySelector(s);
    this.labelLayer = this.$('.labels');
    this.promptEl = this.$('.prompt');
    this.promptEl2 = this.$('.prompt.p2');
    this.prompt2 = null;
    this.queue = [];         // co-op local: menus esperando (um de cada vez na tela)
    this.choiceEl = this.$('.choice');
    this.fadeEl = this.$('.fade');
    this.winEl = this.$('.win');
    this.labels = [];
    this.choice = null;      // { options, index, onPick }
    this.onRetry = null;
    this.$('.win button').addEventListener('click', () => this.onRetry && this.onRetry());
    this.prompt = null;
    this.navCooldown = 0;
  }

  get modal() { return !!this.choice; }

  // --- Rótulos presos a pontos do mundo (portas) ---
  addLabel(html, pos, cls = '') {
    const el = document.createElement('div');
    el.className = `wl ${cls}`;
    el.innerHTML = html;
    this.labelLayer.appendChild(el);
    const l = { el, pos: pos.clone() };
    this.labels.push(l);
    return l;
  }

  clearLabels() { this.labels.forEach((l) => l.el.remove()); this.labels.length = 0; }

  // Aviso "E — fazer algo" em cima de um objeto. null = esconde.
  setPrompt(text, pos) {
    this.prompt = text ? { text, pos } : null;
    if (!text) { this.promptEl.style.display = 'none'; return; }
    const key = input.device === 'pad' ? 'Y' : 'E';
    const html = `<b>${key}</b> ${text}`;
    if (this.promptEl.innerHTML !== html) this.promptEl.innerHTML = html;
    this.promptEl.style.display = 'block';
  }

  // Co-op local: aviso do Jogador 2 (tecla dele).
  setPrompt2(text, pos) {
    this.prompt2 = text ? { text, pos } : null;
    if (!text) { this.promptEl2.style.display = 'none'; return; }
    const html = `<b>${input2.device === 'pad' ? 'Y' : 'O'}</b> ${text}`;
    if (this.promptEl2.innerHTML !== html) this.promptEl2.innerHTML = html;
    this.promptEl2.style.display = 'block';
  }

  project(pos, camera) {
    tmp.copy(pos).project(camera);
    return { x: (tmp.x * 0.5 + 0.5) * innerWidth, y: (-tmp.y * 0.5 + 0.5) * innerHeight, behind: tmp.z > 1 };
  }

  update(dt, camera) {
    for (const l of this.labels) {
      const s = this.project(l.pos, camera);
      l.el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    if (this.prompt) {
      const s = this.project(this.prompt.pos, camera);
      this.promptEl.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    if (this.prompt2) {
      const s = this.project(this.prompt2.pos, camera);
      const up = this.prompt && this.prompt.pos.distanceTo(this.prompt2.pos) < 0.5 ? 34 : 0; // mesmo objeto: um em cima do outro
      this.promptEl2.style.transform = `translate(${s.x.toFixed(1)}px, ${(s.y - up).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  // --- Escolha de bênção (o jogo fica pausado) ---
  // who = 2: menu do Jogador 2 no co-op local (só os botões dele mexem). Com outro menu aberto, espera na fila.
  openChoice(options, owned, onPick, title = 'Escolha uma bênção', sub = '', who = 1) {
    if (this.choice) { this.queue.push(['openChoice', options, owned, onPick, title, sub, who]); return; }
    this.$('.choice h2').textContent = title;
    this.$('.choice .sub').textContent = sub;
    const cards = this.$('.choice .cards');
    cards.innerHTML = '';
    options.forEach((b, i) => {
      const r = RARITY[b.rarity];
      const lvl = owned[b.id] || 0;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = b.rarity === 'risky' ? 'card risky' : 'card';
      card.style.setProperty('--rc', r.color);
      card.innerHTML = `<span class="num">${i + 1}</span><span class="ico">${b.icon}</span><span class="nm">${b.name}</span>`
        + `<span class="rar">${r.name}${b.weapon ? ` · ${wName(b)}` : ''}${lvl ? ` · nível ${lvl + 1}` : ''}</span><span class="ds">${describe(b, owned)}</span>`;
      card.addEventListener('click', () => this.pick(i));
      card.addEventListener('pointerenter', () => this.highlight(i));
      cards.appendChild(card);
    });
    this.$('.choice .hint').innerHTML = this.hintFor(who, `Clique, ou ${options.map((_, i) => `<b>${i + 1}</b>`).join(' ')}, ou setas + <b>Enter</b>`, 'Analógico escolhe · <b>A</b> confirma');
    this.choice = { options, index: 0, onPick, who };
    this.choiceEl.classList.toggle('p2', who === 2);
    this.highlight(0);
    this.choiceEl.classList.remove('confirm');
    this.choiceEl.classList.add('show');
    this.navCooldown = 0.25; // evita escolher sem querer com o clique/tecla que abriu o menu
  }

  // --- Confirmação simples Sim/Não (porta). onPick(opção, i): i = 0 → Sim, 1 → Não. ---
  openConfirm(title, sub, onPick, who = 1) {
    if (this.choice) { this.queue.push(['openConfirm', title, sub, onPick, who]); return; }
    this.$('.choice h2').textContent = title;
    this.$('.choice .sub').textContent = sub || '';
    const cards = this.$('.choice .cards');
    cards.innerHTML = '';
    const opts = [{ id: 'yes', icon: '🚪', name: 'Sim', ds: 'Entrar agora', color: '#7dd87d' }, { id: 'no', icon: '✋', name: 'Não', ds: 'Ficar na sala', color: '#c9b79a' }];
    opts.forEach((o, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card yn';
      card.style.setProperty('--rc', o.color);
      card.innerHTML = `<span class="num">${i + 1}</span><span class="ico">${o.icon}</span><span class="nm">${o.name}</span><span class="ds">${o.ds}</span>`;
      card.addEventListener('click', () => this.pick(i));
      card.addEventListener('pointerenter', () => this.highlight(i));
      cards.appendChild(card);
    });
    this.$('.choice .hint').innerHTML = this.hintFor(who, 'Clique, ou <b>1</b> sim · <b>2</b> não, ou setas + <b>Enter</b> · <b>Esc</b> não', 'Analógico escolhe · <b>A</b> confirma · <b>B</b> não');
    this.choice = { options: opts, index: 0, onPick, confirm: true, who };
    this.choiceEl.classList.toggle('p2', who === 2);
    this.highlight(0);
    this.choiceEl.classList.add('show', 'confirm');
    this.navCooldown = 0.25;
  }

  hintFor(who, keys, pad) {
    if (who === 2) return input2.device === 'pad' ? `Jogador 2: ${pad}` : 'Jogador 2: <b>setas</b> escolhem · <b>J</b> confirma';
    return input.device === 'pad' ? pad : keys;
  }

  // Abre o próximo menu da fila (co-op local).
  next() {
    const q = this.queue.shift();
    if (q) this[q[0]](...q.slice(1));
  }

  highlight(i) {
    if (!this.choice) return;
    this.choice.index = i;
    this.$('.choice .cards').querySelectorAll('.card').forEach((c, j) => c.classList.toggle('sel', j === i));
  }

  pick(i) {
    if (!this.choice || this.navCooldown > 0) return;
    const { options, onPick } = this.choice;
    this.choice = null;
    this.choiceEl.classList.remove('show');
    onPick(options[i], i);
    if (!this.choice) this.next();
  }

  // Fecha o menu sem escolher (co-op: o anfitrião cancelou). Perguntas de porta na fila também saem.
  closeChoice() {
    this.choice = null; this.choiceEl.classList.remove('show');
    this.queue = this.queue.filter((q) => q[0] !== 'openConfirm');
    this.next();
  }

  // Controles do menu (teclado e controle), chamado a cada quadro enquanto o menu está aberto.
  updateModal(dt) {
    if (!this.choice) return;
    this.navCooldown = Math.max(0, this.navCooldown - dt);
    const n = this.choice.options.length;
    if (this.choice.who === 2) { // só o Jogador 2 (setas/J ou o controle dele)
      const m = input2.menu();
      if (m.left) this.highlight((this.choice.index + n - 1) % n);
      if (m.right) this.highlight((this.choice.index + 1) % n);
      if (this.choice.confirm && m.no) { this.navCooldown = 0; this.pick(1); return; }
      if (m.ok) this.pick(this.choice.index);
      return;
    }
    if (input.local) { // co-op local: menu do Jogador 1 só com os botões dele (A/D, Enter, Espaço, E, controle dele)
      const P = (c) => input.isPressedOwn(c);
      for (let i = 0; i < n; i++) if (P(`Digit${i + 1}`)) { this.pick(i); return; }
      if (P('KeyA') || P('PadLeft')) this.highlight((this.choice.index + n - 1) % n);
      if (P('KeyD') || P('PadRight')) this.highlight((this.choice.index + 1) % n);
      if (this.choice.confirm && (P('Escape') || P('PadB'))) { this.navCooldown = 0; this.pick(1); return; }
      if (P('Enter') || P('Space') || P('KeyE') || P('PadA')) this.pick(this.choice.index);
      return;
    }
    for (let i = 0; i < n; i++) if (input.wasPressed(`Digit${i + 1}`) || input.wasPressed(`Numpad${i + 1}`)) { this.pick(i); return; }
    const left = input.wasPressed('ArrowLeft') || input.wasPressed('KeyA') || input.wasPressed('PadLeft');
    const right = input.wasPressed('ArrowRight') || input.wasPressed('KeyD') || input.wasPressed('PadRight');
    if (left) this.highlight((this.choice.index + n - 1) % n);
    if (right) this.highlight((this.choice.index + 1) % n);
    if (this.choice.confirm && (input.wasPressed('Escape') || input.wasPressed('PadB'))) { this.navCooldown = 0; this.pick(1); return; }
    if (input.wasPressed('Enter') || input.wasPressed('Space') || input.wasPressed('KeyE') || input.wasPressed('PadA')) {
      this.pick(this.choice.index);
    }
  }

  // --- Escurecer a tela (troca de sala) ---
  fade(on) { this.fadeEl.classList.toggle('on', on); }

  showWin(stats) { this.$('.win .stats').innerHTML = stats; this.winEl.classList.add('show'); }
  hideWin() { this.winEl.classList.remove('show'); }
  get winVisible() { return this.winEl.classList.contains('show'); }
}
