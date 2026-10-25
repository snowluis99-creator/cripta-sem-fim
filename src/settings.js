// Configurações do jogador (ficam salvas neste navegador): volumes, tremida da câmera, dicas de controle e gráficos.
const KEY = 'cripta.config';
const DEFAULTS = { master: 100, music: 100, sfx: 100, shake: true, hints: true, gfx: 'high' };

function load() {
  const s = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(s, JSON.parse(raw));
    else {
      // Botão de som antigo: 1 = sem música, 2 = mudo.
      const old = +(localStorage.getItem('cripta.som') || 0);
      if (old === 1) s.music = 0;
      if (old === 2) s.master = 0;
    }
  } catch (e) { /* sem localStorage: fica o padrão */ }
  for (const k of ['master', 'music', 'sfx']) s[k] = Math.max(0, Math.min(100, Math.round(+s[k] || 0)));
  s.shake = s.shake !== false; s.hints = s.hints !== false;
  if (!['high', 'medium', 'low'].includes(s.gfx)) s.gfx = 'high';
  return s;
}

const listeners = new Set();
export const settings = {
  ...load(),
  // Muda um valor, salva e avisa quem precisa (som, câmera, dicas).
  set(key, value) {
    this[key] = value;
    try {
      const { master, music, sfx, shake, hints, gfx } = this;
      localStorage.setItem(KEY, JSON.stringify({ master, music, sfx, shake, hints, gfx }));
    } catch (e) { /* nada */ }
    listeners.forEach((cb) => cb(this, key));
  },
  onChange(cb) { listeners.add(cb); cb(this, null); },
};
