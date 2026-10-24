// Voz do Rei Skullbone: palavras que não existem, faladas por um sintetizador de vogais (formantes)
// com voz muito grave, uma oitava abaixo e um zumbido "de outro mundo". Também grunhidos quando apanha muito.
// A mesma semente gera as mesmas palavras e o mesmo som nos dois computadores do co-op.
import { audio } from './audio.js';

// Vogais: formantes F1, F2, F3 (Hz) — multiplicados por 0,78 (garganta enorme).
const VOWELS = { a: [730, 1090, 2440], o: [570, 840, 2410], u: [320, 800, 2240], e: [530, 1840, 2480], i: [300, 2200, 3000], y: [480, 1150, 2300] };
// Consoantes: tipo (f = sopro, p = estalo, n = nasal, r = vibrante), frequência do ruído, se tem voz junto.
const CONS = {
  k: ['p', 1800], g: ['p', 900, 1], d: ['p', 1400, 1], t: ['p', 2600], kh: ['f', 1300], x: ['f', 1100], z: ['f', 4800, 1], zh: ['f', 2600, 1],
  s: ['f', 6200], sh: ['f', 3000], th: ['f', 5200], v: ['f', 2200, 1], r: ['r', 0, 1], m: ['n', 0, 1], n: ['n', 0, 1], gr: ['r', 900, 1],
  vr: ['r', 2200, 1], h: ['f', 900], '': null,
};
const C_LIST = ['k', 'g', 'd', 'kh', 'x', 'z', 'zh', 's', 'sh', 'th', 'v', 'r', 'm', 'n', 'gr', 'vr', 'h', '', 'k', 'z', 'gr', 'th'];
const V_LIST = ['a', 'o', 'u', 'e', 'i', 'y', 'a', 'o', 'u', 'aa', 'oo', 'uu'];
const CODA = ['', '', '', 'n', 'r', 'th', 'sh', 'k', 'x', 'z', 'm'];

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];

// Monta as palavras. kind: move | rage | dying | death
export function makeLine(seed, kind) {
  const r = rng(seed);
  const nWords = kind === 'rage' ? 3 + Math.floor(r() * 2) : kind === 'dying' ? 2 + Math.floor(r() * 2) : kind === 'death' ? 1 : 2 + Math.floor(r() * 1.6);
  const words = [];
  for (let w = 0; w < nWords; w++) {
    const n = kind === 'death' ? 1 : 1 + Math.floor(r() * (kind === 'rage' ? 3 : 2.4));
    const syl = [];
    for (let i = 0; i < n; i++) {
      const c = kind === 'death' ? 'gr' : pick(r, C_LIST), v = kind === 'death' ? 'aa' : pick(r, V_LIST);
      syl.push({ c, v: v[0], long: v.length > 1, coda: i === n - 1 ? pick(r, CODA) : '' });
    }
    // Moribundo: gagueja (repete a primeira sílaba).
    if (kind === 'dying' && w === 0) syl.unshift({ ...syl[0], coda: '', cut: true });
    words.push(syl);
  }
  const text = words.map((syl, wi) => {
    let s = syl.map((x, i) => (x.cut ? `${x.c}${x.v}-` : (i > 0 && syl.length > 2 && i === 1 ? "'" : '') + x.c + x.v + (x.long ? x.v : '') + x.coda)).join('');
    if (wi === 0) s = s.charAt(0).toUpperCase() + s.slice(1);
    return s;
  }).join(' ') + (kind === 'dying' ? '…' : '!');
  return { text, words, kind };
}

// Fala uma linha (plan = makeLine). x, z = de onde vem a voz.
export function speak(plan, x, z, opts = {}) {
  const A = audio;
  if (!A.ctx || A.mode === 2 || A.ctx.state !== 'running') return 0;
  const ctx = A.ctx, t0 = ctx.currentTime + 0.03;
  const kind = plan.kind;
  const f0 = (opts.pitch || 1) * (kind === 'rage' ? 66 : kind === 'dying' ? 74 : kind === 'death' ? 82 : 60);
  const fmul = 0.78;
  const out = A.out(x, z, (opts.v ?? 1) * (kind === 'rage' ? 1.25 : 1.05));
  out.disconnect();
  out.connect(A.voiceBus);
  // Fonte: serrote + uma oitava abaixo + sopro.
  const saw = ctx.createOscillator(); saw.type = 'sawtooth';
  const subO = ctx.createOscillator(); subO.type = 'square';
  const subG = ctx.createGain(); subG.gain.value = 0.32;
  const breath = A.noise(t0, 8); const brG = ctx.createGain(); brG.gain.value = 0.18;
  const src = ctx.createGain(); src.gain.value = 1;
  saw.connect(src); subO.connect(subG); subG.connect(src); breath.connect(brG); brG.connect(src);
  // Zumbido alienígena: o volume treme rápido (modulação em ~43 Hz).
  const am = ctx.createGain(); am.gain.value = 0.62;
  const lfo = ctx.createOscillator(); lfo.frequency.value = kind === 'death' ? 28 : 43; const lfoG = ctx.createGain(); lfoG.gain.value = 0.38;
  lfo.connect(lfoG); lfoG.connect(am.gain);
  const amp = ctx.createGain(); amp.gain.value = 0;
  src.connect(amp); amp.connect(am);
  // Filtros de vogal.
  const forms = [[1, 6], [0.55, 9], [0.28, 11]].map(([g, q]) => {
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    const k = ctx.createGain(); k.gain.value = g * 3.2;
    am.connect(f); f.connect(k);
    return { f, k };
  });
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const v = i / 512 - 1; curve[i] = Math.tanh(v * 2.2); }
  shaper.curve = curve;
  forms.forEach(({ k }) => k.connect(shaper));
  shaper.connect(out);
  // Consoantes (ruído filtrado, fora dos filtros de vogal).
  const cNoise = A.noise(t0, 8), cF = ctx.createBiquadFilter(), cG = ctx.createGain();
  cF.type = 'bandpass'; cF.Q.value = 2.5; cG.gain.value = 0;
  cNoise.connect(cF); cF.connect(cG); cG.connect(out);

  const r = rng((plan.text.length * 7919) ^ 0x5eed);
  let t = t0;
  const P = (v, tt) => { saw.frequency.setTargetAtTime(v, tt, 0.04); subO.frequency.setTargetAtTime(v / 2, tt, 0.04); };
  saw.frequency.setValueAtTime(f0, t0); subO.frequency.setValueAtTime(f0 / 2, t0);
  const slow = kind === 'rage' ? 1.35 : kind === 'dying' ? 1.25 : kind === 'death' ? 1 : 1.05;
  plan.words.forEach((syl, wi) => {
    syl.forEach((x, si) => {
      const last = si === syl.length - 1, lastWord = wi === plan.words.length - 1;
      const C = CONS[x.c];
      // Consoante.
      if (C) {
        const [type, fr, voiced] = C;
        const len = (type === 'p' ? 0.035 : type === 'f' ? 0.09 : 0.07) * slow;
        if (type === 'f' || type === 'p') {
          cF.frequency.setValueAtTime(fr, t);
          cG.gain.setValueAtTime(0.0001, t);
          cG.gain.exponentialRampToValueAtTime(type === 'p' ? 0.9 : 0.5, t + 0.012);
          cG.gain.exponentialRampToValueAtTime(0.0001, t + len);
        }
        if (type === 'r') { // vibrante: voz batendo rápido
          for (let k = 0; k < 3; k++) { amp.gain.setValueAtTime(0.8, t + k * 0.025); amp.gain.setValueAtTime(0.15, t + k * 0.025 + 0.012); }
          if (fr) { cF.frequency.setValueAtTime(fr, t); cG.gain.setValueAtTime(0.25, t); cG.gain.setTargetAtTime(0.0001, t + 0.05, 0.02); }
        } else if (type === 'n' || voiced) {
          amp.gain.setValueAtTime(0.3, t);
          setVowel(forms, VOWELS.u, t, fmul * 0.7);
        } else amp.gain.setValueAtTime(0.0001, t);
        t += len;
      }
      // Vogal.
      const vow = VOWELS[x.v] || VOWELS.a;
      const vl = (x.cut ? 0.1 : (x.long ? 0.36 : 0.2) + r() * 0.06) * slow * (kind === 'death' ? 6 : 1) * (last && lastWord ? 1.5 : 1);
      setVowel(forms, vow, t, fmul * (0.95 + r() * 0.1));
      amp.gain.setTargetAtTime(kind === 'death' ? 1.1 : 0.95, t, 0.015);
      // Entonação: sobe no começo da palavra, cai no fim; exclamação final cai muito.
      const base = f0 * (1 + (r() - 0.5) * 0.18) * (kind === 'dying' ? 1 - wi * 0.06 : 1);
      P(base * (si === 0 ? 1.12 : 1), t);
      if (last) P(base * (lastWord ? (kind === 'dying' ? 0.6 : kind === 'death' ? 0.35 : 0.72) : 0.88), t + vl * 0.5);
      if (kind === 'death') { lfo.frequency.setValueAtTime(28, t); lfo.frequency.linearRampToValueAtTime(11, t + vl); }
      // Tremor de quem está morrendo.
      if (kind === 'dying') for (let k = 0; k < 5; k++) P(base * (1 + (r() - 0.5) * 0.25), t + (vl * k) / 5);
      t += vl;
      if (x.cut) { amp.gain.setTargetAtTime(0.0001, t, 0.01); t += 0.12; }
      // Fim da sílaba: consoante final.
      const coda = CONS[x.coda];
      if (coda) {
        const [type, fr] = coda;
        if (type === 'f' || type === 'p') {
          amp.gain.setTargetAtTime(0.0001, t, 0.02);
          cF.frequency.setValueAtTime(fr, t);
          cG.gain.setValueAtTime(0.0001, t); cG.gain.exponentialRampToValueAtTime(0.4, t + 0.015); cG.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
          t += 0.1;
        } else { setVowel(forms, VOWELS.u, t, fmul * 0.7); amp.gain.setTargetAtTime(0.4, t, 0.02); t += 0.08; }
      }
    });
    amp.gain.setTargetAtTime(0.0001, t, 0.03);
    t += (kind === 'rage' ? 0.16 : 0.1) + r() * 0.06;
  });
  const end = t + 0.3;
  [saw, subO, lfo].forEach((o) => { o.start(t0); o.stop(end); });
  amp.gain.setTargetAtTime(0, t, 0.05);
  setTimeout(() => { try { out.disconnect(); } catch (e) { /* nada */ } }, (end - ctx.currentTime + 3) * 1000);
  return end - t0;
}

function setVowel(forms, v, t, mul) {
  forms.forEach(({ f }, i) => f.frequency.setTargetAtTime(v[i] * mul, t, 0.03));
}

// Grunhido curto de dor ("Hngh", "Ugh", "Grrh").
export function grunt(seed, x, z, v = 1) {
  const A = audio;
  if (!A.ctx || A.mode === 2 || A.ctx.state !== 'running') return;
  const ctx = A.ctx, r = rng(seed), t = ctx.currentTime + 0.02;
  const out = A.out(x, z, v * 1.1); out.disconnect(); out.connect(A.voiceBus);
  const dur = 0.22 + r() * 0.2, f0 = 64 + r() * 22;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0 * 1.25, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + dur);
  const sub = ctx.createOscillator(); sub.type = 'square'; sub.frequency.setValueAtTime(f0 * 0.62, t); sub.frequency.exponentialRampToValueAtTime(f0 * 0.35, t + dur);
  const sg = ctx.createGain(); sg.gain.value = 0.35;
  const n = A.noise(t, dur + 0.1), ng = ctx.createGain(); ng.gain.value = 0.35;
  const src = ctx.createGain();
  o.connect(src); sub.connect(sg); sg.connect(src); n.connect(ng); ng.connect(src);
  // Voz "rouca": volume batendo em ~30 Hz.
  const am = ctx.createGain(); am.gain.value = 0.5;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 24 + r() * 14; const lg = ctx.createGain(); lg.gain.value = 0.5;
  lfo.connect(lg); lg.connect(am.gain);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(1, t + 0.03); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(am); am.connect(env);
  const vw = [VOWELS.u, VOWELS.y, VOWELS.a][Math.floor(r() * 3)];
  const sh = ctx.createWaveShaper(), curve = new Float32Array(512);
  for (let i = 0; i < 512; i++) curve[i] = Math.tanh((i / 256 - 1) * 3);
  sh.curve = curve; sh.connect(out);
  [[1, 5], [0.5, 8], [0.25, 10]].forEach(([g, q], i) => {
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q; f.frequency.value = vw[i] * 0.75;
    const k = ctx.createGain(); k.gain.value = g * 3;
    env.connect(f); f.connect(k); k.connect(sh);
  });
  [o, sub, lfo].forEach((s) => { s.start(t); s.stop(t + dur + 0.05); });
}

// ---------- Ligação com o jogo ----------
// O som chega pelo audio.play (assim também vai para o Jogador 2 do co-op).
audio.voiceFn = (name, x, z, v) => {
  const [k, a, b] = name.split(':');
  if (k === 'grunt') grunt(+a, x, z, v);
  else speak(makeLine(+b, a), x, z, { v });
};

const seedNow = () => (Math.random() * 1e9) | 0;

// Fala uma linha (som + legenda com as palavras por cima da cabeça). kind: move | rage | dying | death
export function sayLine(kind, seed, e, combat) {
  const plan = makeLine(seed, kind);
  const s = e.group.scale.x || 1;
  combat.text.add(plan.text, e.position, kind === 'move' ? 'say' : 'say big', 1.2 + 2.5 * s);
  audio.play(`voice:${kind}:${seed}`, e.position.x, e.position.z);
  e.voice = e.voice || {};
  e.voice.talk = kind === 'rage' ? 2.6 : kind === 'move' ? 1.4 : 2.2; // não grunhe por cima da fala
  e.voice.cd = kind === 'move' ? 3.2 + Math.random() * 2 : 2.5;
}

// Golpes depois dos quais ele fala (o golpe comum só às vezes).
const AFTER_MOVE = new Set(['spin', 'spinWind', 'summon', 'cast', 'recover', 'shot', 'leap', 'charge']);

// Chamado em Enemy.setState (só chefes com data.voice).
export function voiceState(e, prev, next) {
  if (!e.alive || !e.combat || next !== 'chase') return;
  const v = (e.voice = e.voice || { cd: 0, talk: 0 });
  if (v.cd > 0 || v.talk > 0) return;
  if (prev === 'spawn') { sayLine('move', seedNow(), e, e.combat); return; } // chegando na sala
  const special = AFTER_MOVE.has(prev);
  if (special ? Math.random() < 0.85 : prev === 'attack' && Math.random() < 0.3) sayLine('move', seedNow(), e, e.combat);
}

// Chamado quando o chefe apanha: muitos golpes seguidos = grunhido.
export function voiceHit(e, heavy) {
  if (!e.alive || !e.combat) return;
  const v = (e.voice = e.voice || { cd: 0, talk: 0 });
  v.hits = (v.hits || []).filter((t) => v.clock - t < 1.6);
  v.hits.push(v.clock || 0);
  if (v.talk > 0 || (v.gruntCd || 0) > 0) return;
  if (v.hits.length >= 3 || (heavy && Math.random() < 0.45)) {
    v.gruntCd = 1.1 + Math.random() * 0.6;
    v.hits.length = 0;
    audio.play(`grunt:${seedNow()}`, e.position.x, e.position.z);
  }
}

// Todo quadro (Enemy.update): relógios e a fala de quase morto.
export function voiceTick(e, dt) {
  const v = (e.voice = e.voice || { cd: 0, talk: 0 });
  v.clock = (v.clock || 0) + dt;
  v.cd -= dt; v.talk -= dt; v.gruntCd = (v.gruntCd || 0) - dt;
  if (!v.dying && v.talk <= 0 && e.alive && e.combat && e.state !== 'rage' && e.hp > 0 && e.hp <= e.maxHp * 0.15) {
    v.dying = true;
    sayLine('dying', seedNow(), e, e.combat);
  }
}
