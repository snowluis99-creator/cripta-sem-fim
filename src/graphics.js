// Qualidade gráfica (Configurações → Gráficos). Alto = o visual original do jogo.
// Resolução e tochas acesas mudam na hora; suavização de bordas e iluminação simples valem ao abrir o jogo de novo.
import * as THREE from 'three';
import { settings } from './settings.js';

export const GFX_LEVELS = ['high', 'medium', 'low'];
export const GFX = {
  high:   { label: 'Alto',  maxRatio: 2,    scale: 1,    torches: 6, boost: 1,    aa: true,  simple: false },
  medium: { label: 'Médio', maxRatio: 1,    scale: 1,    torches: 4, boost: 1.2,  aa: true,  simple: false },
  low:    { label: 'Baixo', maxRatio: 1,    scale: 0.75, torches: 3, boost: 1.45, aa: false, simple: true },
};

export const gfx = () => GFX[settings.gfx] || GFX.high;
// O que só vale ao abrir o jogo (fica fixo nesta sessão).
export const gfxAtStart = gfx();

// Teto de pixels desenhados por quadro (tela grande/alta densidade no Alto pesava e atrasava os comandos).
const PIXEL_BUDGET = { high: 2560 * 1440, medium: 1920 * 1080, low: 1600 * 900 };
export function basePixelRatio() {
  const g = gfx();
  let r = Math.min(window.devicePixelRatio || 1, g.maxRatio) * g.scale;
  const area = Math.max(1, innerWidth * innerHeight);
  const budget = PIXEL_BUDGET[settings.gfx] || PIXEL_BUDGET.high;
  if (area * r * r > budget) r = Math.sqrt(budget / area);
  return r;
}
export function pixelRatio() { return basePixelRatio() * dynRes.scale; }

// Resolução dinâmica (08/11): se o jogo cai abaixo de ~50 quadros por segundo, a placa de vídeo está
// atrasada e os comandos aparecem na tela um ou dois quadros depois. Baixa a resolução aos poucos
// (até 60%) e sobe de novo quando sobra folga. Medido pelo intervalo real entre quadros.
export const dynRes = {
  scale: 1, min: 0.6, acc: 0, n: 0, fast: 0, cool: 0, apply: null,
  tick(elapsed) {
    if (document.hidden || !(elapsed > 0) || elapsed > 0.25) return; // aba escondida ou engasgo de carregamento
    this.cool = Math.max(0, this.cool - elapsed);
    this.acc += elapsed; this.n++;
    if (this.acc < 1) return;
    const avg = this.acc / this.n; this.acc = 0; this.n = 0;
    if (this.cool > 0) return;
    let next = this.scale;
    if (avg > 1 / 50) { next = Math.max(this.min, this.scale * 0.85); this.fast = 0; } // lento: −15%
    else if (avg < 1 / 57) { if (++this.fast >= 4 && this.scale < 1) { next = Math.min(1, this.scale * 1.1); this.fast = 0; } } // 4 s com folga: +10%
    else this.fast = 0;
    if (next !== this.scale) { this.scale = next; this.cool = 1.5; if (this.apply) this.apply(); }
  },
};

// Iluminação simples (Baixo): troca o material "físico" por um mais barato, mantendo textura e cores.
export function simplifyMaterial(m) {
  if (!m || !m.isMeshStandardMaterial) return m;
  const s = new THREE.MeshLambertMaterial({
    name: m.name, color: m.color, map: m.map, emissive: m.emissive, emissiveMap: m.emissiveMap,
    emissiveIntensity: m.emissiveIntensity, transparent: m.transparent, opacity: m.opacity,
    alphaTest: m.alphaTest, side: m.side, vertexColors: m.vertexColors, depthWrite: m.depthWrite,
  });
  s.userData = m.userData;
  return s;
}

// Tochas de uma sala: deixa acesas só algumas, espalhadas, e as acesas um pouco mais fortes.
// A quantidade de luzes ligadas é sempre a mesma em todas as salas (mudar isso faz o jogo travar recompilando).
const rooms = [];
export function applyTorchQuality(torches) {
  if (!rooms.includes(torches)) { rooms.push(torches); if (rooms.length > 3) rooms.shift(); }
  const g = gfx();
  const real = torches.filter((t) => t.sprite);
  const keep = new Set();
  if (g.torches >= torches.length) torches.forEach((t) => keep.add(t));
  else if (real.length) {
    keep.add(real[0]);
    while (keep.size < Math.min(g.torches, real.length)) {
      let best = null, bestD = -1;
      for (const t of real) {
        if (keep.has(t)) continue;
        let d = Infinity;
        for (const k of keep) d = Math.min(d, t.light.position.distanceToSquared(k.light.position));
        if (d > bestD) { bestD = d; best = t; }
      }
      keep.add(best);
    }
    // Sala com menos tochas de verdade: completa com as luzes apagadas (contagem fixa).
    for (const t of torches) if (keep.size < g.torches && !keep.has(t)) keep.add(t);
  }
  for (const t of torches) {
    t.light.visible = keep.has(t);
    t.boost = g.torches >= torches.length ? 1 : g.boost;
  }
}

// Renderizador: liga a resolução à configuração.
export function bindRenderer(renderer) {
  const apply = () => { renderer.setPixelRatio(pixelRatio()); renderer.setSize(innerWidth, innerHeight); };
  dynRes.apply = apply;
  settings.onChange((s, key) => {
    if (key && key !== 'gfx') return;
    if (key) dynRes.scale = 1; // mudou a qualidade: recomeça a medir
    apply();
    if (key) rooms.forEach(applyTorchQuality);
  });
}
