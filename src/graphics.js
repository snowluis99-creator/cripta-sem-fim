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

export function pixelRatio() {
  const g = gfx();
  return Math.min(window.devicePixelRatio || 1, g.maxRatio) * g.scale;
}

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
  settings.onChange((s, key) => {
    if (key && key !== 'gfx') return;
    apply();
    if (key) rooms.forEach(applyTorchQuality);
  });
}
