// Coração de Fênix (pedido do dono, 04/11): ao voltar da morte, o jogo congela igual à ultimate, a câmera chega
// perto do herói, uma fênix de fogo aparece na tela com um grito de ave e o herói se levanta em chamas.
import * as THREE from 'three';
import { audio } from './audio.js';

export const PHOENIX = { time: 3.0, fall: 0.55, bird: 0.6, rise: 1.15, zoom: 0.5, iframes: 3 };

// Desenho da fênix (SVG feito em código): asas abertas de penas de fogo, cabeça com crista e cauda longa.
function phoenixSvg() {
  const feathers = (side) => {
    let out = '';
    for (let i = 0; i < 7; i++) {
      const a = -18 - i * 13, len = 150 - i * 9, w = 22 - i;
      const x = 0, y = -10 + i * 6;
      out += `<path transform="translate(${side * 22} ${y}) scale(${side} 1) rotate(${a})" d="M0 0 C ${len * 0.3} ${-w}, ${len * 0.75} ${-w * 0.9}, ${len} 0 C ${len * 0.75} ${w * 0.55}, ${len * 0.3} ${w * 0.65}, 0 0 Z" fill="url(#pf${i % 3})" opacity="${0.95 - i * 0.06}"/>`;
    }
    return out;
  };
  let tail = '';
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 11;
    tail += `<path transform="translate(0 40) rotate(${a})" d="M0 0 C -14 50, 14 95, -6 ${150 - Math.abs(i - 2) * 22} C 18 100, 16 45, 0 0 Z" fill="url(#pf${(i + 1) % 3})" opacity="0.9"/>`;
  }
  return `<svg viewBox="-260 -170 520 360" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="pf0" x1="0" x2="1"><stop offset="0" stop-color="#fff4b0"/><stop offset=".45" stop-color="#ffb02a"/><stop offset="1" stop-color="#e2320c" stop-opacity=".2"/></linearGradient>
    <linearGradient id="pf1" x1="0" x2="1"><stop offset="0" stop-color="#ffe07a"/><stop offset=".5" stop-color="#ff7a18"/><stop offset="1" stop-color="#b8160a" stop-opacity=".15"/></linearGradient>
    <linearGradient id="pf2" x1="0" x2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#ffd04a"/><stop offset="1" stop-color="#ff5014" stop-opacity=".15"/></linearGradient>
    <radialGradient id="pglow"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".95"/><stop offset=".4" stop-color="#ff8a20" stop-opacity=".45"/><stop offset="1" stop-color="#ff3a00" stop-opacity="0"/></radialGradient>
  </defs>
  <circle r="170" fill="url(#pglow)"/>
  <g class="pw l">${feathers(-1)}</g>
  <g class="pw r">${feathers(1)}</g>
  ${tail}
  <path d="M-20 -20 C -26 10, -16 42, 0 52 C 16 42, 26 10, 20 -20 C 12 -34, -12 -34, -20 -20 Z" fill="url(#pf2)"/>
  <path d="M0 -26 C -14 -40, -10 -62, 2 -70 C 14 -64, 16 -48, 10 -36 Z" fill="#fff0a8"/>
  <path d="M8 -66 L 30 -60 L 10 -56 Z" fill="#ffcf3a"/>
  <path d="M-2 -68 C -12 -92, 4 -104, -4 -122 C 14 -104, 12 -88, 4 -70 Z" fill="url(#pf1)"/>
  <path d="M-8 -64 C -26 -82, -22 -98, -34 -110 C -12 -98, -8 -84, -2 -68 Z" fill="url(#pf0)"/>
  <circle cx="4" cy="-62" r="2.6" fill="#7a1400"/>
</svg>`;
}

let el = null;
function overlay() {
  if (el) return el;
  el = document.createElement('div');
  el.className = 'phoenixfx';
  el.innerHTML = phoenixSvg();
  const st = document.createElement('style');
  st.textContent = `.phoenixfx{position:fixed;left:50%;top:44%;width:min(70vw,620px);transform:translate(-50%,-50%) scale(.4);opacity:0;
    pointer-events:none;z-index:6;filter:drop-shadow(0 0 18px #ff8a2a) drop-shadow(0 0 40px #ff4a0a);transition:none}
    .phoenixfx svg{width:100%;height:auto;display:block}
    .phoenixfx.on{animation:phx 1.9s ease-out forwards}
    .phoenixfx.on .pw{animation:phwing .38s ease-in-out infinite alternate}
    .phoenixfx .pw.l{transform-origin:-20px 0}.phoenixfx .pw.r{transform-origin:20px 0}
    @keyframes phx{0%{opacity:0;transform:translate(-50%,-10%) scale(.35)}18%{opacity:1;transform:translate(-50%,-50%) scale(1)}
      70%{opacity:1;transform:translate(-50%,-56%) scale(1.06)}100%{opacity:0;transform:translate(-50%,-90%) scale(1.25)}}
    @keyframes phwing{from{transform:scaleY(1)}to{transform:scaleY(.72) rotate(-4deg)}}`;
  document.head.appendChild(st);
  document.body.appendChild(el);
  return el;
}

function showBird() {
  const o = overlay();
  o.classList.remove('on');
  void o.offsetWidth; // reinicia a animação
  o.classList.add('on');
  setTimeout(() => o.classList.remove('on'), 2000);
}

// Cena da Fênix para o Ultimates.scene (ultimate.js). g: { vfx, hud, flash, combat }
export function phoenixScene(p, g) {
  const P = PHOENIX;
  let bird = false, rose = false;
  const pos = () => p.position.clone();
  return {
    p, time: P.time, zoom: P.zoom, actors: [],
    start() {
      p.combo = 0; p.queued = false; p.vel.set(0, 0, 0);
      if (p.clearRoll) p.clearRoll();
      p.setState('ultCine');
      p.anim.play(p.hero.anims.death, { once: true, restart: true, fade: 0.06, speed: 1.7 });
      g.hud.banner('Coração de Fênix!', 'ult');
      audio.play('heroDeath', p.position.x, p.position.z, { v: 0.6 });
    },
    tick(t) {
      if (!bird && t >= P.bird) {
        bird = true;
        showBird();
        audio.play('phoenixCry', p.position.x, p.position.z);
        audio.play('fireRoar', p.position.x, p.position.z, { v: 0.5 });
        g.flash('#ff9a2a', 0.18);
        g.vfx.burst(pos(), 0xffc24a);
        g.vfx.ring(pos(), 0xff7a1a, 3.2);
      }
      if (!rose && t >= P.rise) {
        rose = true;
        p.anim.play('Lie_StandUp', { once: true, restart: true, fade: 0.1, speed: 1.35 });
        g.vfx.burst(pos(), 0xff7a1a);
      }
      if (bird) {
        p.setGlow(0.7 + 0.3 * Math.sin(t * 16));
        if (Math.random() < 0.6) g.vfx.sparks(new THREE.Vector3(p.position.x + (Math.random() - 0.5), 0.3 + Math.random() * 1.6, p.position.z + (Math.random() - 0.5)), Math.random() < 0.5 ? 0xff7a1a : 0xffd04a, 2);
      }
    },
    end() {
      p.setGlow(0);
      if (p.state === 'dead') return;
      p.iframes = Math.max(p.iframes || 0, P.iframes);
      p.setState('idle');
      p.anim.play(p.hero.anims.idle, { fade: 0.2 });
      if (g.combat && g.combat.log) g.combat.log({ type: 'phoenixEnd' });
    },
  };
}
