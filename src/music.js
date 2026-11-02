// Música feita na hora (Web Audio): "explore" = aventura/exploração épica; "boss" = luta tensa contra o chefe.
// Um agendador olha 0,3 s à frente e marca as notas. Troca de música com fade de ~2 s.
import { audio, mtof } from './audio.js';

const LOOK = 0.3;
const chordNotes = (root, q) => [root, root + (q === 'm' ? 3 : 4), root + 7];

// ---------- Instrumentos ----------
function voiceGain(ctx, out, t, a, peak, hold, rel) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  g.connect(out);
  return g;
}
// Cordas: dois "serrotes" desafinados, filtro suave, ataque lento.
function pad(ctx, out, t, notes, dur, vol = 0.05, cut = 1100) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; f.Q.value = 0.6;
  const g = voiceGain(ctx, out, t, 0.7, vol, Math.max(0, dur - 0.7), 1.4);
  f.connect(g);
  for (const m of notes) for (const det of [-8, 7]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
    o.connect(f); o.start(t); o.stop(t + dur + 1.5);
  }
}
// Coro sombrio ("aah"): serrote passando por filtros de vogal.
function choir(ctx, out, t, notes, dur, vol = 0.05) {
  const sum = ctx.createGain(); sum.gain.value = 1;
  const g = voiceGain(ctx, out, t, 0.5, vol, Math.max(0, dur - 0.5), 1.2);
  [[650, 1, 5], [1080, 0.5, 7], [2650, 0.2, 9]].forEach(([fr, gg, q]) => {
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr; f.Q.value = q;
    const k = ctx.createGain(); k.gain.value = gg * 4;
    sum.connect(f); f.connect(k); k.connect(g);
  });
  for (const m of notes) for (const det of [-12, 0, 11]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 4.5 + Math.random(); lg.gain.value = 6;
    lfo.connect(lg); lg.connect(o.detune); lfo.start(t); lfo.stop(t + dur + 1.3);
    o.connect(sum); o.start(t); o.stop(t + dur + 1.3);
  }
}
// Harpa: nota dedilhada curta.
function harp(ctx, out, t, m, vol = 0.07) {
  const g = voiceGain(ctx, out, t, 0.004, vol, 0, 1.1);
  for (const [type, mul, v] of [['triangle', 1, 1], ['sine', 2, 0.3]]) {
    const o = ctx.createOscillator(), k = ctx.createGain(); o.type = type; o.frequency.value = mtof(m) * mul; k.gain.value = v;
    o.connect(k); k.connect(g); o.start(t); o.stop(t + 1.2);
  }
}
// Trompa: serrote filtrado com vibrato (melodia heroica).
function horn(ctx, out, t, m, dur, vol = 0.06, bright = 1) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(1700 * bright, t + 0.08); f.frequency.linearRampToValueAtTime(1100 * bright, t + 0.4);
  const g = voiceGain(ctx, out, t, 0.06, vol, Math.max(0, dur - 0.1), 0.35);
  f.connect(g);
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(9, t + 0.35);
  lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.5);
  for (const det of [-5, 5]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
    lg.connect(o.detune); o.connect(f); o.start(t); o.stop(t + dur + 0.5);
  }
}
// Cordas curtas (ostinato).
function stac(ctx, out, t, m, vol = 0.05, len = 0.13) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
  f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(400, t + len);
  const g = voiceGain(ctx, out, t, 0.004, vol, 0, len);
  f.connect(g);
  for (const det of [-6, 6]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
    o.connect(f); o.start(t); o.stop(t + len + 0.05);
  }
}
// Metais curtos (acorde forte).
function brass(ctx, out, t, notes, vol = 0.04, len = 0.32) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.5;
  f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(700, t + len);
  const g = voiceGain(ctx, out, t, 0.015, vol, 0.04, len);
  f.connect(g);
  for (const m of notes) for (const det of [-9, 0, 9]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
    o.connect(f); o.start(t); o.stop(t + len + 0.1);
  }
}
// Tambor grande (taiko).
function taiko(ctx, out, t, vol = 0.5) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(115, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.3);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.75);
  const n = audio.noise(t, 0.15), f = ctx.createBiquadFilter(), ng = ctx.createGain();
  f.type = 'lowpass'; f.frequency.value = 500; ng.gain.setValueAtTime(vol * 0.6, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  n.connect(f); f.connect(ng); ng.connect(out);
}
function snare(ctx, out, t, vol = 0.18) {
  const n = audio.noise(t, 0.25), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  n.connect(f); f.connect(g); g.connect(out);
  const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
  og.gain.setValueAtTime(vol * 0.8, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.12);
}
function shaker(ctx, out, t, vol = 0.03) {
  const n = audio.noise(t, 0.06), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'highpass'; f.frequency.value = 6500;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  n.connect(f); f.connect(g); g.connect(out);
}
function swell(ctx, out, t, dur, vol = 0.08) {   // prato subindo (antes de uma parte nova)
  const n = audio.noise(t, dur), f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = 'highpass'; f.frequency.setValueAtTime(3000, t); f.frequency.linearRampToValueAtTime(8000, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
  n.connect(f); f.connect(g); g.connect(out);
}
function sub(ctx, out, t, m, dur, vol = 0.12) {
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m);
  const g = voiceGain(ctx, out, t, 0.05, vol, Math.max(0, dur - 0.1), 0.3);
  o.connect(g); o.start(t); o.stop(t + dur + 0.4);
}

// ---------- Músicas ----------
// Exploração: Ré menor, 88 bpm, 8 compassos por parte: intro calma -> tema heroico -> tema alto -> respiro.
const EX_PROG = [[50, 'm'], [46, 'M'], [53, 'M'], [48, 'M'], [50, 'm'], [46, 'M'], [43, 'm'], [45, 'M']];
const MEL_A = [
  [[0, 69, 6], [6, 74, 2], [8, 76, 4], [12, 77, 4]], [[0, 74, 8], [8, 70, 4], [12, 72, 4]],
  [[0, 72, 6], [6, 69, 2], [8, 72, 4], [12, 77, 4]], [[0, 76, 12], [12, 72, 4]],
  [[0, 69, 6], [6, 74, 2], [8, 77, 4], [12, 81, 4]], [[0, 79, 6], [6, 77, 2], [8, 74, 8]],
  [[0, 74, 4], [4, 77, 4], [8, 79, 4], [12, 77, 4]], [[0, 76, 12], [12, 73, 4]],
];
const MEL_B = [
  [[0, 81, 8], [8, 79, 4], [12, 77, 4]], [[0, 77, 6], [6, 74, 2], [8, 70, 8]],
  [[0, 72, 4], [4, 77, 4], [8, 81, 6], [14, 79, 2]], [[0, 79, 8], [8, 76, 8]],
  [[0, 77, 4], [4, 79, 4], [8, 81, 4], [12, 84, 4]], [[0, 82, 8], [8, 81, 4], [12, 79, 4]],
  [[0, 79, 6], [6, 77, 2], [8, 74, 4], [12, 79, 4]], [[0, 76, 16]],
];
const COUNTER = [[[0, 62, 16]], [[0, 58, 16]], [[0, 60, 8], [8, 65, 8]], [[0, 64, 16]], [[0, 62, 8], [8, 57, 8]], [[0, 58, 16]], [[0, 55, 8], [8, 58, 8]], [[0, 61, 16]]];

const EXPLORE = {
  bpm: 88, bars: 32,
  step(ctx, out, t, bar, s, sp, I) {
    const part = Math.floor(bar / 8) % 4, b = bar % 8, [root, q] = EX_PROG[b], ch = chordNotes(root, q);
    const barLen = sp * 16;
    if (s === 0) {
      pad(ctx, out, t, [ch[0], ch[1] + 12, ch[2], ch[0] + 12], barLen, part === 0 || part === 3 ? 0.035 : 0.045, part === 2 ? 1500 : 1000);
      sub(ctx, out, t, root - 12, barLen, part === 0 ? 0.06 : 0.1);
      if (b === 7 && part !== 3) swell(ctx, out, t + barLen * 0.5, barLen * 0.5, 0.05);
    }
    // Harpa em colcheias (arpejo do acorde).
    if (s % 2 === 0 && part !== 2) {
      const arp = [ch[0] + 12, ch[2] + 12, ch[0] + 24, ch[1] + 24, ch[2] + 24, ch[1] + 24, ch[0] + 24, ch[2] + 12];
      harp(ctx, out, t, arp[s / 2], part === 0 ? 0.06 : 0.045);
    }
    // Ostinato grave nas partes cheias.
    if ((part === 1 || part === 2) && s % 2 === 0) stac(ctx, out, t, (s % 8 === 4 ? ch[2] : ch[0]) - (s % 4 ? 0 : 12), 0.04);
    // Melodia da trompa.
    const mel = part === 1 ? MEL_A : part === 2 ? MEL_B : part === 3 ? COUNTER : null;
    if (mel) for (const [at, m, len] of mel[b]) if (at === s) horn(ctx, out, t, m, len * sp, part === 3 ? 0.04 : 0.055, part === 3 ? 0.7 : 1);
    // Tambores.
    if (part === 0 && s === 0) taiko(ctx, out, t, 0.3);
    if (part === 3 && (s === 0 || s === 8)) taiko(ctx, out, t, 0.25);
    if (part === 1 || part === 2) {
      const hits = { 0: 0.5, 6: 0.28, 8: 0.4, 14: part === 2 ? 0.25 : 0 };
      if (hits[s]) taiko(ctx, out, t, hits[s]);
      if (s % 2 === 0) shaker(ctx, out, t, s % 4 === 2 ? 0.03 : 0.015);
      if (part === 2 && (s === 4 || s === 12)) snare(ctx, out, t, 0.08);
    }
  },
};

// Chefe: Dó menor, 140 bpm, galope nas cordas graves, tambores pesados, coro e metais.
const BS_PROG = [[48, 'm'], [44, 'M'], [41, 'm'], [43, 'M'], [48, 'm'], [49, 'M'], [48, 'm'], [43, 'M']];
const BS_MOTIF = [[[0, 72, 6], [6, 71, 2], [8, 68, 8]], [[0, 68, 4], [4, 67, 4], [8, 63, 8]], [[0, 65, 6], [6, 68, 2], [8, 72, 8]], [[0, 71, 16]],
  [[0, 75, 6], [6, 74, 2], [8, 72, 8]], [[0, 73, 8], [8, 68, 8]], [[0, 72, 4], [4, 75, 4], [8, 79, 8]], [[0, 78, 8], [8, 74, 8]]];

const BOSS = {
  bpm: 140, bars: 16,
  step(ctx, out, t, bar, s, sp, I) {
    const part = Math.floor(bar / 8) % 2, b = bar % 8, [root, q] = BS_PROG[b], ch = chordNotes(root, q);
    const barLen = sp * 16;
    if (s === 0) {
      choir(ctx, out, t, [ch[0] + 12, ch[1] + 12, ch[2] + 12], barLen, 0.035 + I * 0.01);
      sub(ctx, out, t, root - 12, barLen, 0.13);
      if (b === 7) swell(ctx, out, t + barLen * 0.25, barLen * 0.75, 0.08 + I * 0.04);
    }
    // Galope: 16 avos, acentos no 1 e no "e".
    const acc = [1, 0.35, 0.6, 0.35, 0.9, 0.35, 0.6, 0.35][s % 8];
    stac(ctx, out, t, root - 12 + (s % 8 === 6 ? 12 : 0), 0.05 * acc, 0.1);
    if (I > 0 && s % 2 === 1) stac(ctx, out, t, ch[s % 3] + 24, 0.012, 0.08); // cordas agudas tremendo (fúria)
    // Tambores.
    const kit = [0.7, 0, 0, 0.4, 0, 0, 0.55, 0, 0.65, 0, 0.3, 0, 0.5, 0, 0.35 + I * 0.2, I * 0.3];
    if (kit[s]) taiko(ctx, out, t, kit[s]);
    if (part === 1 && (s === 4 || s === 12)) snare(ctx, out, t, 0.14);
    if (s % 2 === 0) shaker(ctx, out, t, 0.02);
    // Metais: no 1 e no contratempo (parte 2 ou fúria).
    if ((part === 1 || I > 0) && (s === 0 || s === 10)) brass(ctx, out, t, [ch[0], ch[2], ch[0] + 12], s === 0 ? 0.035 : 0.025);
    if (part === 1) for (const [at, m, len] of BS_MOTIF[b]) if (at === s) horn(ctx, out, t, m - 12, len * sp, 0.05, 0.8);
  },
};

// Tensão (inimigos vivos, sem chefe): Ré menor, 104 bpm. Pulso grave constante, batida de coração, cordas com
// semitom dissonante e um sino agudo que pinga. Sem melodia: deixa o combate na frente.
const TN_PROG = [[50, 'm'], [50, 'm'], [46, 'M'], [49, 'M'], [50, 'm'], [51, 'M'], [46, 'M'], [45, 'M']];
const TENSION = {
  bpm: 104, bars: 8, fadeIn: 3,
  step(ctx, out, t, bar, s, sp) {
    const [root, q] = TN_PROG[bar % 8], ch = chordNotes(root, q), barLen = sp * 16;
    if (s === 0) {
      pad(ctx, out, t, [ch[0], ch[0] + 1, ch[2]], barLen, 0.03, 800);      // semitom: inquieto
      sub(ctx, out, t, root - 12, barLen, 0.11);
      if (bar % 4 === 3) swell(ctx, out, t + barLen * 0.5, barLen * 0.5, 0.05);
    }
    // Pulso grave em semicolcheias (acento a cada 4).
    stac(ctx, out, t, root - 12 + (s % 8 === 7 ? 1 : 0), s % 4 === 0 ? 0.05 : 0.025, 0.09);
    // Batida de coração: tum-tum no 1 e no 9.
    if (s === 0 || s === 8) taiko(ctx, out, t, 0.42);
    if (s === 2 || s === 10) taiko(ctx, out, t, 0.24);
    if (s % 4 === 2) shaker(ctx, out, t, 0.018);
    // Sino agudo esparso.
    if (s === 12 && bar % 2 === 1) harp(ctx, out, t, ch[2] + 24, 0.035);
  },
};

export const SYNTH_TRACKS = { explore: EXPLORE, boss: BOSS, tension: TENSION }; // antigas (sem uso)

// Músicas do dono (mp3 em music/, volume igualado em -18 LUFS no preparo). Pedido de 31/10: tocar em
// volume ambiente e trocar aos poucos, de forma suave. As músicas feitas na hora (acima) ficaram sem uso.
const FILES = {
  menu: 'music/menu.mp3',          // capa (cavaleiro no campo)
  crypt: 'music/cripta.mp3',       // menu da cripta
  tavern: 'music/taverna.mp3',     // Taverna
  explore: 'music/exploracao.mp3', // masmorra sem monstros
  tension: 'music/combate.mp3',    // inimigos na tela
  boss1: 'music/chefe1.mp3',       // Rei Skullbone (andar 1)
  boss2: 'music/chefe2.mp3',       // Necromante (andar 2)
  boss3: 'music/chefe3.mp3',       // Ceifador Sombrio (andar 3)
  defeat: 'music/derrota.mp3',     // tela de derrota (toca uma vez)
};
const ONCE = new Set(['defeat']);
// Ajuste de volume por faixa (pedido do dono, 31/10: a da capa estava baixa)
const GAIN = { menu: 1.35 };
const FROM_START = new Set(['boss1', 'boss2', 'boss3', 'defeat']); // as outras continuam de onde pararam
const LEVEL = 0.7;   // volume de cada faixa no barramento de música (ambiente; o jogador ainda tem o controle "Música")
// Chefe (pedido do dono, 31/10): a música entra normal e vai subindo devagar até um volume mediano, mais alto.
const BOSS_MUL = 1.6;  // volume final da música do chefe (× o volume normal)
const BOSS_RISE = 14;  // segundos para chegar lá (depois de entrar)
const BOSSES = new Set(['boss1', 'boss2', 'boss3']);
const FADE_IN = { explore: 4, tension: 3.5, defeat: 1.5 };   // segundos
const FADE_OUT = { explore: 3.5, tension: 4.5, defeat: 1.5 };
const BOSS_OF = { guardian: 'boss1', necromancer: 'boss2', reaper: 'boss3' };
export const bossTrack = (type) => BOSS_OF[type] || 'boss1';

export class Music {
  constructor() {
    this.want = null;     // faixa pedida (null = silêncio)
    this.tracks = {};     // nome → { el, gain, vol }
    this.intensity = 0;
    this.last = 0;
    audio.onReady(() => { this.timer = setInterval(() => this.tick(), 50); });
  }

  set(name) {
    if (name === this.want) return;
    this.want = name;
    const tr = name && this.tracks[name];
    if (tr && FROM_START.has(name) && tr.vol <= 0.001) { tr.boost = 0; try { tr.el.currentTime = 0; } catch (e) { /* ainda carregando */ } }
  }

  setIntensity(v) { this.intensity = v; }

  track(name) {
    if (this.tracks[name]) return this.tracks[name];
    const ctx = audio.ctx;
    const el = new Audio(FILES[name]);
    el.loop = !ONCE.has(name);
    el.preload = 'auto';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    try { ctx.createMediaElementSource(el).connect(gain); gain.connect(audio.musicBus); } catch (e) { /* sem Web Audio */ }
    return (this.tracks[name] = { el, gain, vol: 0, boost: 0 });
  }

  tick() {
    const ctx = audio.ctx;
    if (!ctx) return;
    const nowMs = performance.now(), dt = Math.min(0.25, (nowMs - (this.last || nowMs)) / 1000);
    this.last = nowMs;
    const running = ctx.state === 'running';
    if (this.want && FILES[this.want]) this.track(this.want);
    for (const [name, tr] of Object.entries(this.tracks)) {
      const on = name === this.want;
      if (running) {
        const fade = on ? FADE_IN[name] || 2.5 : FADE_OUT[name] || 2.5;
        tr.vol = on ? Math.min(1, tr.vol + dt / fade) : Math.max(0, tr.vol - dt / fade);
        if (BOSSES.has(name)) tr.boost = on && tr.vol >= 1 ? Math.min(1, tr.boost + dt / BOSS_RISE) : tr.vol <= 0 ? 0 : tr.boost;
      }
      // Curva suave (seno): a troca entre duas faixas fica sem "buraco" no meio.
      const b = tr.boost || 0, rise = b * b * (3 - 2 * b); // sobe suave
      const g = Math.sin(tr.vol * Math.PI / 2) * LEVEL * (GAIN[name] || 1) * (1 + (BOSS_MUL - 1) * rise);
      tr.gain.gain.setTargetAtTime(g, ctx.currentTime, 0.05);
      const shouldPlay = running && tr.vol > 0 && !(ONCE.has(name) && tr.el.ended);
      if (shouldPlay && tr.el.paused) tr.el.play().catch(() => {});
      else if (!shouldPlay && !tr.el.paused) tr.el.pause(); // pausa guarda a posição
    }
  }
}
