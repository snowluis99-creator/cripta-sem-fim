// Som do jogo: tudo sintetizado na hora com Web Audio (sem arquivos de som).
// audio.play('nome', x, z) toca um efeito; o volume diminui com a distância até o herói deste computador.
// Volumes vêm das Configurações (settings.js): geral, música e efeitos (a voz do chefe segue os efeitos).
import { settings } from './settings.js';

const VOL = { master: 0.9, music: 0.36, sfx: 0.6, voice: 0.25 }; // 31/10: efeitos um pouco mais baixos para combinar com as músicas (antes sfx 0,75 e voz 0,3)
// Ajuste fino de volume por efeito (os sopros e chiados saem mais baixos que os impactos).
const GAIN = { swing: 2.4, swingHeavy: 1.5, dodge: 2.8, miss: 2.2, rise: 2.6, spin: 2.6, creak: 3, summon: 2, clear: 2, win: 2, heal: 1.6, orb: 1.4, thunder: 1.5 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export const audio = {
  ctx: null,
  mode: 0,
  listener: { x: 0, z: 0 },
  onPlay: null,          // co-op: o anfitrião manda os sons para o Jogador 2
  last: new Map(),       // limite de repetição por som
  noiseBuf: null,
  readyCbs: [],

  // Liga o áudio já ao abrir o jogo (31/10, versão 114). Se o navegador bloquear o som automático,
  // ele liga no primeiro clique/tecla. Tenta de novo algumas vezes (alguns navegadores liberam após carregar).
  boot() {
    const start = () => {
      if (!this.ctx) this.create();
      if (this.ctx && this.ctx.state === 'suspended' && !this.hold) this.ctx.resume().catch(() => {});
    };
    for (const ev of ['pointerdown', 'pointerup', 'mousedown', 'click', 'keydown', 'keyup', 'touchstart', 'touchend']) addEventListener(ev, start, { capture: true });
    start();
    let tries = 0;
    const retry = setInterval(() => { if (++tries > 20 || (this.ctx && this.ctx.state === 'running')) clearInterval(retry); else start(); }, 500);
    addEventListener('focus', start);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    settings.onChange(() => this.applyMode());
  },

  create() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(ctx.destination);
    this.master = ctx.createGain(); this.master.connect(comp);
    // Reverberação de cripta (eco longo).
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8, 2.6);
    this.revOut = ctx.createGain(); this.revOut.gain.value = 0.9;
    this.reverb.connect(this.revOut); this.revOut.connect(this.master);
    const bus = (v, rev) => {
      const g = ctx.createGain(); g.gain.value = v; g.connect(this.master);
      const s = ctx.createGain(); s.gain.value = rev; g.connect(s); s.connect(this.reverb);
      return g;
    };
    this.musicBus = bus(VOL.music, 0.35);
    this.sfxBus = bus(VOL.sfx, 0.18);
    this.voiceBus = bus(VOL.voice, 0.55);
    const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
    this.applyMode();
    this.readyCbs.forEach((cb) => cb(ctx));
  },

  // Pausa (sozinho): congela música e sons onde estão.
  setHold(on) {
    this.hold = on;
    if (!this.ctx) return;
    if (on && this.ctx.state === 'running') this.ctx.suspend();
    if (!on && this.ctx.state === 'suspended') this.ctx.resume();
  },

  onReady(cb) { if (this.ctx) cb(this.ctx); else this.readyCbs.push(cb); },

  impulse(sec, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** decay;
    }
    return b;
  },

  applyMode() {
    const v = (k) => settings[k] / 100;
    this.mode = settings.master <= 0 ? 2 : 0; // 2 = mudo (nem cria os sons)
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Curva ao quadrado: o controle fica mais natural para o ouvido.
    this.master.gain.setTargetAtTime(VOL.master * v('master') ** 2, t, 0.05);
    this.musicBus.gain.setTargetAtTime(VOL.music * v('music') ** 2, t, 0.3);
    this.sfxBus.gain.setTargetAtTime(VOL.sfx * v('sfx') ** 2, t, 0.05);
    this.voiceBus.gain.setTargetAtTime(VOL.voice * v('sfx') ** 2, t, 0.05);
  },

  // Fonte de ruído (já tocando a partir de t).
  noise(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
    return s;
  },

  // Saída de um efeito: volume pela distância + lado esquerdo/direito.
  out(x, z, vol = 1) {
    const ctx = this.ctx, g = ctx.createGain();
    let v = vol;
    if (x !== undefined && x !== null) {
      const d = Math.hypot(x - this.listener.x, z - this.listener.z);
      v *= 1 / (1 + Math.max(0, d - 7) / 9);
    }
    g.gain.value = v;
    if (ctx.createStereoPanner && x !== undefined && x !== null) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp((x - this.listener.x) / 16, -0.7, 0.7);
      g.connect(p); p.connect(this.sfxBus);
    } else g.connect(this.sfxBus);
    return g;
  },

  // Toca um efeito. opts.net = false: não manda para o outro computador.
  play(name, x, z, opts = {}) {
    if (this.onPlay && opts.net !== false) this.onPlay(name, x, z, opts.v);
    if (!this.ctx || this.mode === 2 || this.ctx.state !== 'running') return;
    // Voz do chefe: "voice:tipo:semente" e "grunt:semente" (voice.js).
    if (this.voiceFn && /^(voice|grunt):/.test(name)) { try { this.voiceFn(name, x, z, opts.v ?? 1); } catch (e) { /* nada */ } return; }
    const fn = SFX[name];
    if (!fn) return;
    // Muitos iguais no mesmo instante (golpe em 6 esqueletos): toca só alguns.
    const now = performance.now(), l = this.last.get(name) || { t: 0, n: 0 };
    if (now - l.t > 60) { l.t = now; l.n = 0; }
    if (++l.n > (fn.max || 2)) return;
    this.last.set(name, l);
    try { fn(this, this.ctx.currentTime + 0.005, this.out(x, z, (opts.v ?? 1) * (GAIN[name] || 1))); } catch (e) { /* som com defeito: ignora */ }
  },
};

// ---------- Peças básicas ----------
function env(g, t, a, peak, d, end = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(end, t + a + d);
}
function tone(A, t, type, f0, f1, dur, peak, out, a = 0.004) {
  const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env(g, t, a, peak, dur);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + a + dur + 0.05);
  return o;
}
function hiss(A, t, type, f0, f1, q, dur, peak, out, a = 0.004) {
  const ctx = A.ctx, s = A.noise(t, a + dur), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + a + dur);
  env(g, t, a, peak, dur);
  s.connect(f); f.connect(g); g.connect(out);
}
// Metal batendo: parciais desafinados (soa como sino/espada).
function metal(A, t, base, dur, peak, out) {
  [1, 2.76, 5.4, 8.93].forEach((r, i) => tone(A, t, 'sine', base * r, base * r * 0.995, dur / (1 + i * 0.6), peak / (1 + i), out, 0.002));
}

// ---------- Efeitos ----------
export const SFX = {
  swing: (A, t, o) => hiss(A, t, 'bandpass', 900, 2600, 1.4, 0.16, 0.5, o, 0.03),
  swingHeavy: (A, t, o) => { hiss(A, t, 'bandpass', 500, 1800, 1.2, 0.28, 0.7, o, 0.05); tone(A, t, 'sine', 160, 70, 0.25, 0.25, o, 0.04); },
  bladeSing: (A, t, o) => {     // Lâmina Cantante: a rapieira vibra (metal que canta)
    metal(A, t, 1320, 0.9, 0.35, o);
    tone(A, t, 'sine', 1980, 1960, 0.7, 0.12, o, 0.01);
  },
  pistol: (A, t, o) => {        // Mosqueteiro: estampido seco
    hiss(A, t, 'lowpass', 3000, 400, 0.8, 0.22, 1.2, o, 0.002);
    tone(A, t, 'triangle', 180, 50, 0.18, 0.7, o, 0.002);
    hiss(A, t + 0.02, 'bandpass', 900, 300, 1.2, 0.5, 0.25, o, 0.02);
  },
  bell: (A, t, o) => {          // Sino (Besta): sininho tocando
    metal(A, t, 980, 1.3, 0.32, o);
    metal(A, t + 0.32, 980, 1.0, 0.22, o);
  },
  reload: (A, t, o) => {        // Recarga Perfeita (Besta): clique da corda armando
    metal(A, t, 2200, 0.12, 0.25, o);
    tone(A, t + 0.04, 'square', 900, 1500, 0.06, 0.12, o, 0.002);
  },
  jam: (A, t, o) => {           // besta travou: estalo seco
    tone(A, t, 'square', 160, 70, 0.12, 0.3, o, 0.002);
    hiss(A, t, 'lowpass', 1200, 300, 1, 0.1, 0.4, o);
  },
  hit: (A, t, o) => {           // lâmina no osso
    hiss(A, t, 'bandpass', 2600, 1400, 2.5, 0.07, 0.8, o);
    tone(A, t, 'triangle', 420, 160, 0.08, 0.5, o);
    hiss(A, t + 0.01, 'highpass', 5000, 5000, 0.7, 0.05, 0.25, o);
  },
  hitHeavy: (A, t, o) => {
    hiss(A, t, 'lowpass', 1800, 300, 0.8, 0.25, 1.0, o);
    tone(A, t, 'sine', 120, 38, 0.35, 1.0, o);
    hiss(A, t, 'bandpass', 2200, 900, 2, 0.12, 0.6, o);
  },
  block: (A, t, o) => { metal(A, t, 820, 0.45, 0.35, o); hiss(A, t, 'highpass', 3000, 3000, 0.7, 0.06, 0.4, o); },
  shieldBlock: (A, t, o) => { metal(A, t, 520, 0.35, 0.3, o); tone(A, t, 'sine', 180, 90, 0.12, 0.5, o); },
  hurt: (A, t, o) => { tone(A, t, 'sine', 140, 55, 0.22, 0.9, o); hiss(A, t, 'lowpass', 1200, 300, 0.7, 0.15, 0.6, o); },
  dodge: (A, t, o) => hiss(A, t, 'bandpass', 600, 1700, 1, 0.22, 0.35, o, 0.06),
  miss: (A, t, o) => { tone(A, t, 'sine', 900, 1500, 0.1, 0.12, o); },
  // Esqueleto desmontando: chocalho de ossos caindo.
  bones: Object.assign((A, t, o) => {
    for (let i = 0; i < 9; i++) {
      const tt = t + Math.random() * 0.35 + (i > 5 ? 0.25 : 0);
      tone(A, tt, 'triangle', 700 + Math.random() * 1300, 300 + Math.random() * 300, 0.05, 0.25 + Math.random() * 0.25, o, 0.001);
      hiss(A, tt, 'bandpass', 2500 + Math.random() * 2500, 2000, 4, 0.03, 0.25, o, 0.001);
    }
    tone(A, t, 'sine', 110, 50, 0.2, 0.35, o);
  }, { max: 3 }),
  crunch: (A, t, o) => { hiss(A, t, 'bandpass', 1500, 600, 1.5, 0.12, 0.7, o); tone(A, t, 'square', 220, 60, 0.08, 0.15, o); },
  rise: (A, t, o) => {          // esqueleto saindo do chão
    hiss(A, t, 'lowpass', 300, 900, 1, 0.6, 0.35, o, 0.25);
    for (let i = 0; i < 5; i++) tone(A, t + 0.2 + i * 0.09, 'triangle', 900 + Math.random() * 900, 400, 0.04, 0.12, o, 0.001);
  },
  potion: (A, t, o) => { for (let i = 0; i < 4; i++) tone(A, t + i * 0.11, 'sine', 300 + i * 70, 700 + i * 90, 0.08, 0.3, o, 0.01); },
  heal: (A, t, o) => [0, 4, 7, 12].forEach((s, i) => tone(A, t + i * 0.06, 'triangle', mtof(76 + s), mtof(76 + s), 0.35, 0.15, o, 0.01)),
  gold: (A, t, o) => { tone(A, t, 'sine', 1900, 1900, 0.18, 0.25, o, 0.001); tone(A, t + 0.06, 'sine', 2850, 2850, 0.3, 0.2, o, 0.001); },
  blessing: (A, t, o) => [0, 7, 12, 16, 19, 24].forEach((s, i) => tone(A, t + i * 0.05, 'sine', mtof(72 + s), mtof(72 + s), 0.6, 0.12, o, 0.01)),
  chest: (A, t, o) => { tone(A, t, 'square', 140, 90, 0.18, 0.12, o); hiss(A, t, 'lowpass', 800, 300, 1, 0.25, 0.4, o); SFX.gold(A, t + 0.2, o); },
  door: (A, t, o) => { hiss(A, t, 'lowpass', 220, 120, 2, 1.2, 0.9, o, 0.2); tone(A, t, 'sine', 55, 45, 1.2, 0.5, o, 0.2); },
  clear: (A, t, o) => {          // fanfarra curta de sala limpa
    [[62, 0], [66, 0.12], [69, 0.24], [74, 0.36]].forEach(([m, d]) => {
      tone(A, t + d, 'sawtooth', mtof(m), mtof(m), 0.5, 0.06, o, 0.03);
      tone(A, t + d, 'triangle', mtof(m), mtof(m), 0.6, 0.12, o, 0.02);
    });
  },
  arrow: (A, t, o) => { tone(A, t, 'triangle', 260, 120, 0.12, 0.35, o, 0.001); hiss(A, t, 'highpass', 3000, 6000, 0.7, 0.15, 0.2, o); },
  zap: (A, t, o) => { hiss(A, t, 'highpass', 2500, 5000, 1.2, 0.18, 0.55, o, 0.002); tone(A, t, 'sawtooth', 1400, 180, 0.22, 0.12, o, 0.002); hiss(A, t + 0.03, 'bandpass', 900, 300, 2, 0.25, 0.4, o, 0.01); },
  // Raio (Cajado Elétrico): estalo seco + crepitar + ronco curto de trovão.
  thunder: (A, t, o) => {
    hiss(A, t, 'highpass', 1500, 900, 0.8, 0.09, 1.0, o, 0.001);
    for (let i = 0; i < 5; i++) hiss(A, t + 0.01 + Math.random() * 0.12, 'bandpass', 2500 + Math.random() * 3500, 2000, 3, 0.025, 0.5, o, 0.001);
    tone(A, t, 'sawtooth', 900, 120, 0.12, 0.12, o, 0.001);
    hiss(A, t + 0.02, 'lowpass', 500, 110, 1, 0.65, 0.7, o, 0.02);
    tone(A, t + 0.02, 'sine', 75, 38, 0.55, 0.45, o, 0.02);
  },
  orb: (A, t, o) => { tone(A, t, 'sine', 300, 900, 0.3, 0.2, o, 0.02); tone(A, t, 'triangle', 450, 1300, 0.3, 0.08, o, 0.02); },
  // Cena de desbloqueio na Taverna.
  fireRoar: (A, t, o) => {     // fogo pegando em tudo (rugido + estalos)
    hiss(A, t, 'lowpass', 300, 1600, 0.8, 2.2, 0.9, o, 0.25);
    tone(A, t, 'sine', 60, 40, 1.6, 0.5, o, 0.2);
    for (let i = 0; i < 14; i++) hiss(A, t + 0.15 + Math.random() * 2.2, 'highpass', 2500, 2500, 1, 0.03, 0.35, o, 0.002);
  },
  iceWave: (A, t, o) => {      // onda de gelo (vento + cristais)
    hiss(A, t, 'bandpass', 4000, 900, 1.2, 1.1, 0.8, o, 0.03);
    [0, 5, 9, 12, 17].forEach((s, i) => tone(A, t + 0.08 + i * 0.07, 'triangle', mtof(88 + s), mtof(88 + s), 0.6, 0.12, o, 0.005));
    tone(A, t, 'sine', 120, 60, 0.6, 0.6, o, 0.01);
  },
  thaw: (A, t, o) => { hiss(A, t, 'highpass', 3500, 5000, 1, 0.12, 0.3, o); tone(A, t + 0.02, 'triangle', 2600, 3400, 0.18, 0.12, o, 0.002); },
  unlock: (A, t, o) => {       // cadeado abrindo + fanfarra
    metal(A, t, 900, 0.18, 0.4, o);
    metal(A, t + 0.12, 1400, 0.25, 0.35, o);
    [0, 4, 7, 12].forEach((s, i) => tone(A, t + 0.3 + i * 0.12, 'triangle', mtof(67 + s), mtof(67 + s), 0.5, 0.25, o, 0.01));
    [0, 4, 7, 12, 16].forEach((s) => tone(A, t + 0.8, 'sine', mtof(67 + s), mtof(67 + s), 1.4, 0.12, o, 0.02));
  },
  boom: (A, t, o) => { tone(A, t, 'sine', 90, 30, 0.7, 1.0, o, 0.005); hiss(A, t, 'lowpass', 900, 120, 0.8, 0.6, 0.9, o); },
  spin: (A, t, o) => { for (let i = 0; i < 4; i++) hiss(A, t + i * 0.18, 'bandpass', 500, 1500, 1, 0.16, 0.45, o, 0.05); },
  summon: (A, t, o) => { tone(A, t, 'sawtooth', 70, 110, 1.2, 0.12, o, 0.4); hiss(A, t, 'bandpass', 300, 1200, 3, 1.1, 0.3, o, 0.4); },
  spell: (A, t, o) => { tone(A, t, 'sine', 600, 200, 0.5, 0.2, o, 0.05); tone(A, t, 'sine', 900, 300, 0.5, 0.1, o, 0.05); },
  charge: (A, t, o) => { hiss(A, t, 'lowpass', 400, 1600, 1, 0.5, 0.6, o, 0.1); tone(A, t, 'sine', 70, 140, 0.4, 0.3, o, 0.05); },
  spikes: (A, t, o) => { metal(A, t, 1400, 0.18, 0.12, o); hiss(A, t, 'highpass', 4000, 4000, 0.7, 0.08, 0.2, o); },
  heroDeath: (A, t, o) => { tone(A, t, 'sawtooth', 220, 55, 1.6, 0.25, o, 0.02); tone(A, t, 'sine', 110, 40, 1.4, 0.6, o, 0.02); },
  creak: (A, t, o) => {          // ossos rangendo (corpo do chefe tremendo)
    for (let i = 0; i < 6; i++) tone(A, t + i * 0.06 + Math.random() * 0.03, 'sawtooth', 130 + Math.random() * 60, 90, 0.07, 0.07, o, 0.004);
  },
  bigShatter: (A, t, o) => { SFX.boom(A, t, o); SFX.bones(A, t, o); SFX.bones(A, t + 0.12, o); SFX.bones(A, t + 0.3, o); },
  headThud: (A, t, o) => { tone(A, t, 'sine', 140, 60, 0.3, 0.9, o); hiss(A, t, 'lowpass', 900, 200, 1, 0.2, 0.6, o); SFX.bones(A, t + 0.02, o); },
  grab: (A, t, o) => { hiss(A, t, 'bandpass', 700, 1500, 1.4, 0.2, 0.5, o, 0.02); SFX.creak(A, t + 0.1, o); },
  warcry: (A, t, o) => {        // Grito de Guerra: rugido grave
    tone(A, t, 'sawtooth', 120, 85, 0.9, 0.35, o, 0.03); tone(A, t, 'sawtooth', 182, 120, 0.8, 0.2, o, 0.03);
    hiss(A, t, 'bandpass', 500, 300, 1.5, 0.8, 0.6, o, 0.04); SFX.boom(A, t + 0.02, o);
  },
  thump: (A, t, o) => { tone(A, t, 'sine', 110, 45, 0.25, 0.8, o); hiss(A, t, 'lowpass', 700, 200, 1, 0.12, 0.5, o); },
  select: (A, t, o) => {        // capa: clicou para entrar na cripta (brilho + sino grave)
    hiss(A, t, 'bandpass', 1200, 5200, 1.1, 0.35, 0.35, o, 0.03);
    [0, 7, 12, 19].forEach((s, i) => tone(A, t + 0.03 + i * 0.055, 'triangle', mtof(74 + s), mtof(74 + s), 0.55, 0.16, o, 0.004));
    metal(A, t + 0.02, 330, 1.1, 0.22, o);
    tone(A, t, 'sine', 110, 82, 0.6, 0.45, o, 0.01);
  },
  // Coração de Fênix: grito de ave de rapina (dois "kiaaa" descendo, com vibrato).
  phoenixCry: (A, t, o) => {
    for (const [d, f0, f1, len] of [[0, 2500, 1500, 0.5], [0.58, 2900, 1250, 0.85]]) {
      const ctx = A.ctx, osc = ctx.createOscillator(), g = ctx.createGain(), bp = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      const s = t + d;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f0 * 0.75, s);
      osc.frequency.exponentialRampToValueAtTime(f0, s + 0.07);
      osc.frequency.exponentialRampToValueAtTime(f1, s + len);
      lfo.frequency.value = 34; lg.gain.value = f0 * 0.035;
      lfo.connect(lg); lg.connect(osc.frequency);
      bp.type = 'bandpass'; bp.frequency.value = f0 * 1.05; bp.Q.value = 2.2;
      env(g, s, 0.03, 0.4, len);
      osc.connect(bp); bp.connect(g); g.connect(o);
      osc.start(s); osc.stop(s + len + 0.1); lfo.start(s); lfo.stop(s + len + 0.1);
      tone(A, s, 'square', f0 * 0.5, f1 * 0.5, len * 0.9, 0.05, o, 0.03);
      hiss(A, s, 'bandpass', 3800, 2200, 3, len * 0.8, 0.14, o, 0.02);
    }
  },
  win: (A, t, o) => {
    [[62, 0], [66, 0.18], [69, 0.36], [74, 0.54], [78, 0.72]].forEach(([m, d]) => {
      tone(A, t + d, 'sawtooth', mtof(m), mtof(m), 0.9, 0.06, o, 0.03);
      tone(A, t + d, 'triangle', mtof(m - 12), mtof(m - 12), 1.2, 0.15, o, 0.03);
    });
  },
};
