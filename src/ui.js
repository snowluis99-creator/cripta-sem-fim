// Menus e textos por cima do jogo: escolha de bênção, rótulos das portas, aviso de interação,
// escurecer entre salas e tela de fim de andar.
import * as THREE from 'three';
import { RARITY, describe } from './blessings.js';
import { input } from './input.js';

const tmp = new THREE.Vector3();

export class Ui {
  constructor() {
    const root = document.createElement('div');
    root.id = 'ui';
    root.innerHTML = `
      <div class="labels"></div>
      <div class="prompt"></div>
      <div class="choice"><h2></h2><p class="sub"></p><div class="cards"></div><p class="hint"></p></div>
      <div class="fade"></div>
      <div class="win"><h2>Vitória!</h2><p class="sub2">O Ceifador Sombrio caiu e a cripta enfim descansa.</p><p class="stats"></p>
        <button type="button">Voltar à Taverna</button><p class="hint">Enter, R ou A no controle</p></div>`;
    document.body.appendChild(root);
    this.$ = (s) => root.querySelector(s);
    this.labelLayer = this.$('.labels');
    this.promptEl = this.$('.prompt');
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
  }

  // --- Escolha de bênção (o jogo fica pausado) ---
  openChoice(options, owned, onPick, title = 'Escolha uma bênção', sub = '') {
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
        + `<span class="rar">${r.name}${lvl ? ` · nível ${lvl + 1}` : ''}</span><span class="ds">${describe(b, owned)}</span>`;
      card.addEventListener('click', () => this.pick(i));
      card.addEventListener('pointerenter', () => this.highlight(i));
      cards.appendChild(card);
    });
    this.$('.choice .hint').innerHTML = input.device === 'pad'
      ? 'Analógico escolhe · <b>A</b> confirma' : `Clique, ou ${options.map((_, i) => `<b>${i + 1}</b>`).join(' ')}, ou setas + <b>Enter</b>`;
    this.choice = { options, index: 0, onPick };
    this.highlight(0);
    this.choiceEl.classList.add('show');
    this.navCooldown = 0.25; // evita escolher sem querer com o clique/tecla que abriu o menu
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
  }

  // Fecha o menu sem escolher (co-op: o anfitrião cancelou).
  closeChoice() { this.choice = null; this.choiceEl.classList.remove('show'); }

  // Controles do menu (teclado e controle), chamado a cada quadro enquanto o menu está aberto.
  updateModal(dt) {
    if (!this.choice) return;
    this.navCooldown = Math.max(0, this.navCooldown - dt);
    const n = this.choice.options.length;
    for (let i = 0; i < n; i++) if (input.wasPressed(`Digit${i + 1}`) || input.wasPressed(`Numpad${i + 1}`)) { this.pick(i); return; }
    const left = input.wasPressed('ArrowLeft') || input.wasPressed('KeyA') || input.wasPressed('PadLeft');
    const right = input.wasPressed('ArrowRight') || input.wasPressed('KeyD') || input.wasPressed('PadRight');
    if (left) this.highlight((this.choice.index + n - 1) % n);
    if (right) this.highlight((this.choice.index + 1) % n);
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
