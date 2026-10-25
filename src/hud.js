// Interface: barra de vida, poções, onda atual, avisos e tela de morte.

const FLASK = `<svg viewBox="0 0 24 32" width="22" height="29" aria-hidden="true">
  <path d="M9 2h6v3h-1v5.5c4 1.6 7 5.3 7 9.8C21 26 17 30 12 30S3 26 3 20.3c0-4.5 3-8.2 7-9.8V5H9z"
    fill="#3a0f14" stroke="#e9dcc4" stroke-width="1.5"/>
  <path class="liquid" d="M4.8 19h14.4c.1.4.1.9.1 1.3C19.3 24.8 16 28.3 12 28.3S4.7 24.8 4.7 20.3c0-.4 0-.9.1-1.3z" fill="#e2384b"/>
  <ellipse cx="9" cy="21" rx="1.3" ry="2.4" fill="#ff9aa5" opacity=".7"/>
</svg>`;

export class Hud {
  constructor() {
    const root = document.createElement('div');
    root.id = 'hud';
    root.innerHTML = `
      <div class="hp">
        <div class="hp-bar"><div class="hp-ghost"></div><div class="hp-fill"></div><span class="hp-text"></span></div>
        <div class="shield" title="Escudo: cada bloqueio gasta 1"><span class="si">⛉</span><span class="pips"></span></div>
        <div class="ammo" title="Munição: o que você arremessou fica no chão até ser pego"><span class="ai"></span><span class="apips"></span><b class="ast"></b></div>
        <div class="smoke" title="Bomba de fumaça (botão direito)"><span class="sic">☁</span><span class="stx"></span></div>
        <div class="ult" title="Ultimate: derrote inimigos para encher"><b class="key uk">R</b><div class="ub"><div class="uf"></div></div><span class="ut"></span></div>
        <div class="potions"><span class="flasks"></span><b class="key">Q</b><span class="gold"><i></i><span class="gv">0</span></span><span class="soul" title="Ouro de Alma"><i></i><span class="sv">0</span></span></div>
        <div class="bless"></div>
        <div class="ally"><span class="an"></span><div class="ab"><div class="af"></div></div><span class="at"></span></div>
        <div class="ally"><span class="an"></span><div class="ab"><div class="af"></div></div><span class="at"></span></div>
        <div class="watchers"></div>
      </div>
      <div class="minimap"></div>
      <div class="boss"><span class="bn"></span><div class="bb"><div class="bf"></div></div></div>
      <div class="wave"></div>
      <div class="banner"></div>
      <div class="vignette"></div>
      <div class="dead">
        <h2>Você morreu</h2>
        <p class="stats"></p>
        <button type="button">Voltar à Taverna</button>
        <p class="hint">Enter, R ou A no controle</p>
      </div>`;
    document.body.appendChild(root);
    this.$ = (s) => root.querySelector(s);
    this.fill = this.$('.hp-fill');
    this.ghost = this.$('.hp-ghost');
    this.hpText = this.$('.hp-text');
    this.flasks = this.$('.flasks');
    this.potionBox = this.$('.potions');
    this.waveEl = this.$('.wave');
    this.bannerEl = this.$('.banner');
    this.vignette = this.$('.vignette');
    this.deadEl = this.$('.dead');
    this.ghostPct = 1;
    this.hurtAmt = 0;
    this.shown = { hp: -1, max: -1, potions: -1 };
    this.onRetry = null;
    this.goldEl = this.$('.gold');
    this.blessEl = this.$('.bless');
    this.mapEl = this.$('.minimap');
    this.bossEl = this.$('.boss');
    this.bossFill = this.$('.bf');
    this.boss = null;
    this.root = root;
    this.allyEls = [...root.querySelectorAll('.ally')];
    this.allyShown = ['', ''];
    this.spectator = false;
    this.$('.dead button').addEventListener('click', () => this.onRetry && this.onRetry());
  }

  setHealth(hp, max) {
    if (hp === this.shown.hp && max === this.shown.max) return;
    this.shown.hp = hp; this.shown.max = max;
    const pct = Math.max(0, hp / max);
    this.fill.style.width = `${pct * 100}%`;
    this.fill.classList.toggle('low', pct <= 0.3);
    this.hpText.textContent = `${Math.max(0, Math.ceil(hp))} / ${max}`;
    if (pct > this.ghostPct) this.ghostPct = pct; // curou: a barra branca acompanha na hora
  }

  // Co-op: barra pequena com a vida do parceiro (idx 1 = segunda barra, usada pelo espectador). null = esconde.
  setAlly(name, hp, max, color, idx = 0) {
    const key = name === null ? '' : `${name}|${Math.ceil(hp)}|${max}`;
    if (key === this.allyShown[idx]) return;
    this.allyShown[idx] = key;
    const el = this.allyEls[idx];
    el.classList.toggle('show', name !== null);
    if (name === null) return;
    const q = (s) => el.querySelector(s);
    q('.an').textContent = name;
    q('.an').style.color = color || '';
    q('.af').style.width = `${Math.max(0, hp / max) * 100}%`;
    q('.af').style.background = color ? `linear-gradient(${color}, ${color}88)` : '';
    q('.at').textContent = hp > 0 ? `${Math.ceil(hp)}/${max}` : 'caído';
  }

  // Quem está assistindo (olho no canto). Espectador: mostra "Assistindo".
  setWatchers(n) {
    const text = this.spectator ? `👁 Assistindo${n > 1 ? ` (${n} assistindo)` : ''}` : n > 0 ? `👁 ${n} assistindo` : '';
    if (text === this.watchShown) return;
    this.watchShown = text;
    const el = this.$('.watchers');
    el.textContent = text;
    el.classList.toggle('show', !!text);
  }

  // Modo espectador: esconde a vida/poções próprias, a tela de fim não tem botão.
  setSpectator(on) {
    this.spectator = on;
    this.root.classList.toggle('spec', on);
    document.body.classList.toggle('spec', on);
    this.$('.dead h2').textContent = on ? 'Fim da partida' : 'Você morreu';
    this.watchShown = null;
  }

  // Escudo: um tracinho por bloqueio que ainda aguenta (quebrado = vermelho piscando).
  setShield(n, max) {
    const key = `${n}|${max}`;
    if (key === this.shieldShown) return;
    this.shieldShown = key;
    const el = this.$('.shield');
    el.style.display = max > 0 ? '' : 'none'; // arma sem escudo
    el.classList.toggle('broken', n <= 0);
    let html = '';
    for (let i = 0; i < max; i++) html += `<i class="${i < n ? 'on' : ''}"></i>`;
    this.$('.pips').innerHTML = html + (n <= 0 ? '<b>quebrado</b>' : '');
  }
  shieldWarn() {
    const el = this.$('.shield');
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }

  // Ultimate: barra que enche com inimigos derrotados. key = tecla mostrada (R ou RT).
  // Ladino: kunais/virotes na mão. info = { n, max, kind, stack } ou null (arma sem munição).
  setAmmo(info) {
    const key = info ? `${info.n}|${info.max}|${info.kind}|${info.stack}` : '';
    if (key === this.ammoShown) return;
    this.ammoShown = key;
    const el = this.$('.ammo');
    el.style.display = info ? 'flex' : 'none';
    if (!info) return;
    el.classList.toggle('empty', info.n <= 0);
    this.$('.ai').textContent = info.kind === 'kunai' ? '✧' : '➹';
    let html = '';
    for (let i = 0; i < info.max; i++) html += `<i class="${i < info.n ? 'on' : ''}"></i>`;
    this.$('.apips').innerHTML = html + (info.n <= 0 ? '<b>pegue do chão</b>' : '');
    this.$('.ast').textContent = info.stack > 0 ? `corrente ×${info.stack + 1}` : '';
  }
  ammoWarn() {
    const el = this.$('.ammo');
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }
  // Bomba de fumaça: cd < 0 = arma sem fumaça; 0 = pronta; > 0 = segundos para recarregar.
  setSmoke(cd, hidden) {
    const key = cd < 0 ? '' : `${Math.ceil(cd)}|${hidden ? 1 : 0}`;
    if (key === this.smokeShown) return;
    this.smokeShown = key;
    const el = this.$('.smoke');
    el.style.display = cd < 0 ? 'none' : 'flex';
    if (cd < 0) return;
    el.classList.toggle('ready', cd <= 0);
    this.$('.stx').textContent = hidden ? 'invisível!' : cd <= 0 ? 'fumaça pronta' : `fumaça em ${Math.ceil(cd)} s`;
  }

  setUlt(n, need, key = 'R') {
    const k = `${n}|${need}|${key}`;
    if (k === this.ultShown) return;
    this.ultShown = k;
    const el = this.$('.ult'), full = n >= need;
    el.classList.toggle('full', full);
    this.$('.uf').style.width = `${Math.min(1, n / Math.max(1, need)) * 100}%`;
    this.$('.uk').textContent = key;
    this.$('.ut').textContent = full ? 'Ultimate pronta!' : `${n}/${need}`;
  }

  setPotions(n, max) {
    if (n === this.shown.potions) return;
    this.shown.potions = n;
    let html = '';
    for (let i = 0; i < Math.max(n, max); i++) html += `<span class="flask${i < n ? '' : ' empty'}">${FLASK}</span>`;
    this.flasks.innerHTML = html;
  }

  // Aviso curto perto das poções (ex.: "Vida cheia").
  potionWarn() {
    this.potionBox.classList.remove('shake');
    void this.potionBox.offsetWidth; // reinicia a animação
    this.potionBox.classList.add('shake');
  }

  setWave(text) { this.waveEl.textContent = text; }

  setGold(n) { this.$('.gv').textContent = n; }
  // Ouro de Alma: aparece na Taverna (onde se gasta).
  setSoul(n, show) {
    const key = show ? n : -1;
    if (key === this.soulShown) return;
    this.soulShown = key;
    this.$('.soul').classList.toggle('show', !!show);
    this.$('.sv').textContent = n;
  }
  goldWarn() {
    this.goldEl.classList.remove('shake');
    void this.goldEl.offsetWidth;
    this.goldEl.classList.add('shake');
  }

  // Ícones das bênçãos que o herói já tem (cor = raridade, número = nível).
  setBlessings(owned, list, rarity) {
    this.blessEl.innerHTML = list.filter((b) => owned[b.id] > 0).map((b) =>
      `<span class="bi" style="--rc:${rarity[b.rarity].color}" title="${b.name}">${b.icon}${owned[b.id] > 1 ? `<sub>${owned[b.id]}</sub>` : ''}</span>`).join('');
  }

  // Minimapa: as salas do andar em fila (visitadas com ícone, a atual em destaque, as próximas vazias).
  setMinimap(history, total, current, floorNum = 1) {
    this.mm = [history.slice(), total, current, floorNum]; // co-op: vai para o outro computador
    const ICON = { blessing: '✦', gold: '●', potion: '♥', ult: '★', treasure: '▣', merchant: '$', rest: '☾', elite: '☠', boss: '♛' };
    if (!floorNum) { this.mapEl.innerHTML = '<span class="fl">Taverna</span>'; return; }
    let html = `<span class="fl">A${floorNum}</span>`;
    for (let i = 0; i < total; i++) {
      const k = history[i];
      const cls = i === current ? 'cur' : i < current ? 'done' : 'todo';
      const end = floorNum >= 3 ? (i === total - 1 ? '♛' : '') : i === total - 2 ? (floorNum === 2 ? '♛' : '☠') : i === total - 1 ? '⇣' : '';
      const ic = k ? ICON[k] || '•' : end;
      html += `${i ? '<i class="ln"></i>' : ''}<span class="nd ${cls}">${ic}</span>`;
    }
    this.mapEl.innerHTML = html;
  }

  showBoss(e) {
    this.boss = e;
    this.$('.bn').textContent = e.data.name;
    this.bossEl.classList.add('show');
  }
  hideBoss() { this.boss = null; this.bossEl.classList.remove('show'); }

  banner(text, size = 'big') {
    const b = this.bannerEl;
    b.textContent = text;
    b.className = `banner ${size}`;
    void b.offsetWidth;
    b.classList.add('show');
  }

  // Tela inteira piscando numa cor (co-op: Golpe Duplo em amarelo, Visão Espectral em azul).
  flash(color, time = 0.2) {
    if (!this.flashEl) {
      this.flashEl = document.createElement('div');
      Object.assign(this.flashEl.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '6', opacity: '0', mixBlendMode: 'screen' });
      document.body.appendChild(this.flashEl);
    }
    const el = this.flashEl;
    el.style.transition = 'none';
    el.style.background = color;
    el.style.opacity = '0.6';
    void el.offsetWidth;
    el.style.transition = `opacity ${time}s ease-out`;
    el.style.opacity = '0';
  }

  // Borda vermelha quando o herói apanha.
  hurt(amount) { this.hurtAmt = Math.max(this.hurtAmt, amount); }

  showDeath(stats) {
    this.$('.stats').innerHTML = stats;
    this.deadEl.classList.add('show');
  }

  hideDeath() { this.deadEl.classList.remove('show'); }
  get deathVisible() { return this.deadEl.classList.contains('show'); }

  update(dt, hpPct) {
    if (this.boss) {
      this.bossFill.style.width = `${Math.max(0, this.boss.hp / this.boss.maxHp) * 100}%`;
      if (!this.boss.alive) this.hideBoss();
    }
    // A barra branca ("dano recente") desce devagar atrás da vermelha.
    if (this.ghostPct > hpPct) {
      this.ghostPct = Math.max(hpPct, this.ghostPct - dt * 0.5);
      this.ghost.style.width = `${this.ghostPct * 100}%`;
    } else if (this.ghost.style.width !== `${hpPct * 100}%`) this.ghost.style.width = `${hpPct * 100}%`;
    // Vinheta: forte ao apanhar; pulsa de leve com pouca vida.
    this.hurtAmt = Math.max(0, this.hurtAmt - dt * 2.5);
    const low = hpPct > 0 && hpPct <= 0.3 ? 0.25 + 0.15 * Math.sin(performance.now() / 180) : 0;
    this.vignette.style.opacity = Math.max(this.hurtAmt * 0.9, low).toFixed(3);
  }
}
