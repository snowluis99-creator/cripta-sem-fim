// Cenário animado do menu inicial: noite, lua, nuvens, raios, cripta com tochas, lápides, corvos, grama e névoa
// (desenhado em 2D) + os esqueletos 3D de menucrowd.js num canvas entre o fundo e a frente.
// Tem seu próprio som (vento, cliques, golpes) com o volume das Configurações. Só roda enquanto o menu está aberto.
import { settings } from './settings.js';
import { startCrowd } from './menucrowd.js';

let running = false, busy = false;

const mk = (id, tag = 'canvas') => { const e = document.createElement(tag); e.id = id; e.setAttribute('aria-hidden', 'true'); document.body.appendChild(e); return e; };
const cv = mk('ms-scene'), ctxB = cv.getContext('2d');
const crowdCanvas = mk('ms-three');
const fcv = mk('ms-front'), ctxF = fcv.getContext('2d');
let ctx = ctxB; // o fundo é desenhado em ctxB; a frente (árvores próximas, grama, névoa) em ctxF, por cima dos esqueletos 3D
const wcv = mk('ms-wipe'), wctx = wcv.getContext('2d');
const tav = mk('ms-tavern', 'div'); tav.innerHTML = '<span>Rumo à Taverna…</span>';
let W = 0, H = 0, DPR = 1;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('pointermove', (e) => { mouse.tx = e.clientX / innerWidth - .5; mouse.ty = e.clientY / innerHeight - .5; });
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

// Ruído suave (repete na horizontal a cada "px" células, para as nuvens rolarem sem emenda)
function makeNoise(seed) {
  const r = rng(seed), G = new Float32Array(256 * 256);
  for (let i = 0; i < G.length; i++) G[i] = r();
  const h = (i, j) => G[(j & 255) * 256 + (i & 255)];
  const n = (x, y, px) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const w = (v) => (px ? ((v % px) + px) % px : v);
    const a = h(w(xi), yi), b = h(w(xi + 1), yi), c = h(w(xi), yi + 1), d = h(w(xi + 1), yi + 1);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
  };
  return (x, y, oct = 5, px = 0) => { let s = 0, amp = .5, f = 1, norm = 0; for (let o = 0; o < oct; o++) { s += amp * n(x * f, y * f, px ? px * f : 0); norm += amp; amp *= .5; f *= 2; } return s / norm; };
}
const fbm = makeNoise(7);

// ---------- texturas pré-desenhadas ----------
let T = {};
function cloudTex(seed, tw, th, cover, dark, lit) {
  const c = canvas(tw, th), g = c.getContext('2d'), img = g.createImageData(tw, th), d = img.data;
  const per = 6;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const u = x / tw * per, v = y / th * 2.2 + seed;
    const warp = fbm(u * 1.3 + 10, v * 1.3, 3, per * 1.3) * .8;
    const n = fbm(u + warp, v + warp * .5, 6, per);
    const fall = smooth(0, .35, y / th) * (1 - smooth(.6, 1, y / th));
    const den = smooth(cover, cover + .25, n) * fall;
    const light = clamp((n - cover) * 2.4) * (1 - y / th * .6);
    const i = (y * tw + x) * 4;
    d[i] = lerp(dark[0], lit[0], light); d[i + 1] = lerp(dark[1], lit[1], light); d[i + 2] = lerp(dark[2], lit[2], light); d[i + 3] = den * 255;
  }
  g.putImageData(img, 0, 0); return c;
}
function fogTex(seed, tw, th) {
  const c = canvas(tw, th), g = c.getContext('2d'), img = g.createImageData(tw, th), d = img.data, per = 5;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const n = fbm(x / tw * per, y / th * 1.6 + seed, 5, per);
    const fall = Math.sin(Math.PI * y / th);
    const i = (y * tw + x) * 4; d[i] = 176; d[i + 1] = 190; d[i + 2] = 196; d[i + 3] = smooth(.35, .8, n) * fall * 255;
  }
  g.putImageData(img, 0, 0); return c;
}
// Pedra: grão + blocos com argamassa (tons de cinza, multiplicado sobre a cor)
function stoneTex(size, blockW, blockH, mortarOn = true) {
  const c = canvas(size, size), g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data, r = rng(91);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = fbm(x / size * 8, y / size * 8, 5, 8), grain = r() * .12;
    const row = Math.floor(y / blockH), off = row % 2 ? blockW / 2 : 0;
    const bx = (x + off) % blockW, by = y % blockH;
    const edge = Math.min(bx, blockW - bx, by, blockH - by);
    const mortar = !mortarOn ? 1 : edge < 1.6 ? .55 : edge < 3 ? .8 : 1;
    const v = clamp((.62 + n * .5 - grain) * mortar) * 255;
    const i = (y * size + x) * 4; d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // rachaduras
  g.strokeStyle = 'rgba(30,30,30,.55)'; g.lineWidth = 1;
  for (let k = 0; k < 7; k++) { let x = r() * size, y = r() * size; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - .5) * 18; y += r() * 12; g.lineTo(x, y); } g.stroke(); }
  return c;
}
function grainTex(size) {
  const c = canvas(size, size), g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  g.putImageData(img, 0, 0); return c;
}
// Árvore retorcida: galhos curvos que afinam, com gravetos
function treeTex(seed, h, lean) {
  const r = rng(seed), w = h * 2.2, H0 = h, c = canvas(w, h * 1.35), g = c.getContext('2d');
  h = c.height; // folga em cima e dos lados: nenhum galho é cortado
  g.lineCap = 'round'; g.lineJoin = 'round';
  const br = (x, y, a, len, wd, d) => {
    const bend = (r() - .5) * .6;
    const x2 = x + Math.sin(a) * len, y2 = y - Math.cos(a) * len;
    const mx = x + Math.sin(a + bend) * len * .55, my = y - Math.cos(a + bend) * len * .55;
    g.strokeStyle = '#0b0910'; g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx, my, x2, y2); g.stroke();
    if (wd > 4) { g.strokeStyle = 'rgba(120,120,150,.10)'; g.lineWidth = wd * .25; g.beginPath(); g.moveTo(x - wd * .25, y); g.quadraticCurveTo(mx - wd * .25, my, x2 - wd * .2, y2); g.stroke(); }
    if (d <= 0 || wd < .7) return;
    const kids = d > 5 ? 2 : 2 + (r() < .4 ? 1 : 0);
    for (let k = 0; k < kids; k++) br(x2, y2, a + (k - (kids - 1) / 2) * (.5 + r() * .45) + (r() - .5) * .3 + lean * .1, len * (.66 + r() * .16), wd * (.6 + r() * .08), d - 1);
  };
  // raízes
  g.fillStyle = '#0b0910'; g.beginPath(); g.ellipse(w / 2, h, H0 * .08, H0 * .02, 0, 0, 7); g.fill();
  br(w / 2, h, lean * .25, H0 * .27, H0 * .045, 9);
  return c;
}
function makeVignette() {
  const c = canvas(W, H), g = c.getContext('2d');
  const v = g.createRadialGradient(W * .55, H * .5, Math.min(W, H) * .3, W * .55, H * .5, Math.hypot(W, H) * .62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.75)'); g.fillStyle = v; g.fillRect(0, 0, W, H); return c;
}

// ---------- montagem da cena ----------
const S = {};
function build() {
  const r = rng(51);
  const q = W * H > 2e6 ? .75 : 1;
  T.cloudFar = cloudTex(1.3, 480 * q, 150 * q, .46, [34, 26, 52], [150, 140, 175]);
  T.cloudNear = cloudTex(4.7, 520 * q, 170 * q, .5, [22, 17, 34], [120, 112, 150]);
  T.fogA = fogTex(2.1, 420 * q, 90 * q); T.fogB = fogTex(8.4, 420 * q, 90 * q);
  T.stone = stoneTex(256, 64, 30); T.stonePat = ctx.createPattern(T.stone, 'repeat');
  T.rock = stoneTex(256, 999, 999, false); T.rockPat = ctx.createPattern(T.rock, 'repeat');
  T.grain = grainTex(200); T.grainPat = ctx.createPattern(T.grain, 'repeat');
  T.vig = makeVignette();
  T.trees = [
    { img: treeTex(3, H * 1.05, .4), x: .03, y: 1.04, par: -40 },
    { img: treeTex(9, H * .9, -.5), x: 1.0, y: 1.02, par: -38 },
    { img: treeTex(17, H * .42, .2), x: .86, y: .82, par: -18, fog: .35 },
    { img: treeTex(23, H * .34, -.3), x: .32, y: .8, par: -16, fog: .45 },
  ];
  // linha de árvores ao longe
  S.forest = []; for (let x = -40; x < W + 40; x += 6 + r() * 10) S.forest.push([x, H * (.05 + r() * .07)]);
  S.stars = []; for (let i = 0; i < 160; i++) S.stars.push([r() * W, r() * H * .5, r() * 1.2 + .2, r() * 6]);
  S.stones = [];
  for (let i = 0; i < 14; i++) {
    const depth = r(); const x = r() < .5 ? lerp(.36, .5, r()) : lerp(.7, .98, r());
    S.stones.push({ x, y: lerp(.8, .95, depth), s: lerp(.6, 1.5, depth), tilt: (r() - .5) * .25, kind: r() < .25 ? 'cross' : 'round', w: 3 + r() * 1.5, h: 4.5 + r() * 2.5 });
  }
  S.stones.sort((a, b) => a.y - b.y);
  S.grass = [];
  for (let i = 0; i < W * 1.4; i++) { const y = lerp(.93, 1.03, r()); S.grass.push({ x: r() * (W + 140) - 70, y: y * H, par: -28 - (y - .93) * 80, h: lerp(.025, .09, r()) * H * (y - .85) * 6, w: 1 + r() * 2.2, c: ['#1a2216', '#212b1b', '#161c13', '#2a3320'][r() * 4 | 0], hi: r() < .25 }); }
  S.grass.sort((a, b) => a.y - b.y);
  S.crows = []; for (let i = 0; i < 4; i++) S.crows.push({ x: r() * W, y: lerp(.12, .32, r()) * H, v: 25 + r() * 25, s: 5 + r() * 4, ph: r() * 6 });
  S.embers = []; for (let i = 0; i < 26; i++) S.embers.push({ x: 0, y: -1, ph: r() * 6, s: r(), side: r() < .5 ? -1 : 1 });
  S.flash = 0; S.next = 5; S.bolt = null;
}

function wind(x, t) { return Math.sin(t * 1.3 + x * .009) * .35 + Math.sin(t * .45 - x * .003) * .55 + Math.sin(t * 2.9 + x * .04) * .08; }
function sky(t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#07060f'); g.addColorStop(.35, '#1a1430'); g.addColorStop(.62, '#3a3350'); g.addColorStop(.8, '#4c4d58');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const [x, y, s, p] of S.stars) { ctx.globalAlpha = (.25 + .5 * Math.abs(Math.sin(t * 1.1 + p))) * (1 - y / (H * .5)); ctx.fillStyle = '#dfe6ff'; ctx.fillRect(x, y, s, s); }
  ctx.globalAlpha = 1;
}
function moon(mx, my, mr) {
  const halo = ctx.createRadialGradient(mx, my, mr * .9, mx, my, mr * 6);
  halo.addColorStop(0, 'rgba(210,240,215,.35)'); halo.addColorStop(.3, 'rgba(170,200,190,.12)'); halo.addColorStop(1, 'rgba(150,180,170,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.clip();
  const body = ctx.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .1, mx, my, mr);
  body.addColorStop(0, '#f4fbef'); body.addColorStop(1, '#bccfc0'); ctx.fillStyle = body; ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
  ctx.globalAlpha = .18; ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(T.rock, 0, 0, 160, 160, mx - mr, my - mr, mr * 2, mr * 2);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .22; ctx.fillStyle = '#6f8478';
  for (const [a, b, c] of [[-.35, -.15, .22], [.25, .2, .16], [-.05, .45, .12], [.4, -.35, .09]]) { ctx.beginPath(); ctx.arc(mx + a * mr, my + b * mr, c * mr, 0, 7); ctx.fill(); }
  ctx.restore(); ctx.globalAlpha = 1;
}
function scroll(img, y, h, speed, t, alpha, px) {
  const w = h / img.height * img.width * 1.0; const ww = Math.max(w, W * 1.2);
  let x = -((t * speed) % ww) + px; ctx.globalAlpha = alpha;
  ctx.drawImage(img, x - ww, y, ww, h); ctx.drawImage(img, x, y, ww, h); ctx.drawImage(img, x + ww, y, ww, h); ctx.globalAlpha = 1;
}
function stonePath(fn, base, shade, pat) {
  ctx.save(); ctx.beginPath(); fn(); ctx.clip();
  ctx.fillStyle = base; ctx.fill();
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = pat || T.stonePat; ctx.fill();
  if (shade) { ctx.fillStyle = shade; ctx.fill(); }
  ctx.restore();
}

// Caveira esculpida em pedra/osso: crânio, têmporas, órbitas fundas, nariz, maçãs do rosto e dentes
function skull(kx, ky, u, pulse) {
  ctx.save(); ctx.translate(kx, ky);
  const head = () => {
    ctx.beginPath();
    ctx.moveTo(-1.55 * u, .55 * u);
    ctx.bezierCurveTo(-2.15 * u, -.3 * u, -1.9 * u, -2.25 * u, 0, -2.3 * u);
    ctx.bezierCurveTo(1.9 * u, -2.25 * u, 2.15 * u, -.3 * u, 1.55 * u, .55 * u);
    ctx.bezierCurveTo(1.5 * u, 1.05 * u, 1.15 * u, 1.25 * u, 1.0 * u, 1.55 * u);
    ctx.lineTo(.95 * u, 2.1 * u); ctx.quadraticCurveTo(0, 2.35 * u, -.95 * u, 2.1 * u);
    ctx.lineTo(-1.0 * u, 1.55 * u);
    ctx.bezierCurveTo(-1.15 * u, 1.25 * u, -1.5 * u, 1.05 * u, -1.55 * u, .55 * u);
    ctx.closePath();
  };
  // relevo: sombra projetada na pedra
  ctx.save(); ctx.translate(.28 * u, .3 * u); head(); ctx.fillStyle = 'rgba(10,8,14,.55)'; ctx.fill(); ctx.restore();
  head();
  const bone = ctx.createRadialGradient(-.6 * u, -1.1 * u, .2 * u, 0, 0, 2.6 * u);
  bone.addColorStop(0, '#ece6d4'); bone.addColorStop(.55, '#c2b9a3'); bone.addColorStop(1, '#7d7464');
  ctx.fillStyle = bone; ctx.fill();
  ctx.save(); head(); ctx.clip();
  // textura da pedra por cima, bem leve
  ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = .55; ctx.fillStyle = T.rockPat; ctx.fillRect(-3 * u, -3 * u, 6 * u, 6 * u);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // têmporas e maçãs do rosto
  for (const sx of [-1, 1]) {
    const tg = ctx.createRadialGradient(sx * 1.75 * u, -.35 * u, 0, sx * 1.75 * u, -.35 * u, .9 * u); tg.addColorStop(0, 'rgba(40,32,30,.55)'); tg.addColorStop(1, 'rgba(40,32,30,0)'); ctx.fillStyle = tg; ctx.fillRect(-3 * u, -3 * u, 6 * u, 6 * u);
    const cg = ctx.createRadialGradient(sx * 1.05 * u, 1.25 * u, 0, sx * 1.05 * u, 1.25 * u, .55 * u); cg.addColorStop(0, 'rgba(30,24,22,.6)'); cg.addColorStop(1, 'rgba(30,24,22,0)'); ctx.fillStyle = cg; ctx.fillRect(-3 * u, -3 * u, 6 * u, 6 * u);
  }
  // rachaduras
  ctx.strokeStyle = 'rgba(50,40,36,.7)'; ctx.lineWidth = Math.max(.7, u * .07);
  ctx.beginPath(); ctx.moveTo(.3 * u, -2.25 * u); ctx.lineTo(.45 * u, -1.8 * u); ctx.lineTo(.25 * u, -1.5 * u); ctx.lineTo(.5 * u, -1.15 * u); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1.6 * u, -1.2 * u); ctx.lineTo(-1.25 * u, -1.0 * u); ctx.lineTo(-1.3 * u, -.75 * u); ctx.stroke();
  ctx.restore();
  // órbitas fundas
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.translate(sx * .72 * u, .05 * u); ctx.rotate(sx * -.18);
    ctx.beginPath(); ctx.moveTo(-.62 * u, -.1 * u); ctx.bezierCurveTo(-.6 * u, -.6 * u, .6 * u, -.62 * u, .62 * u, -.05 * u); ctx.bezierCurveTo(.6 * u, .55 * u, -.55 * u, .6 * u, -.62 * u, -.1 * u);
    const eg = ctx.createRadialGradient(0, .05 * u, .05 * u, 0, 0, .7 * u); eg.addColorStop(0, '#07040a'); eg.addColorStop(.6, '#1c1418'); eg.addColorStop(1, '#5a4e44'); ctx.fillStyle = eg; ctx.fill();
    // arco da sobrancelha iluminado
    ctx.strokeStyle = 'rgba(250,245,230,.55)'; ctx.lineWidth = Math.max(.8, u * .1); ctx.beginPath(); ctx.moveTo(-.55 * u, -.38 * u); ctx.quadraticCurveTo(0, -.68 * u, .55 * u, -.36 * u); ctx.stroke();
    // brilho roxo lá no fundo
    const gl = ctx.createRadialGradient(0, .05 * u, 0, 0, .05 * u, .32 * u); gl.addColorStop(0, `rgba(210,140,255,${.75 * pulse})`); gl.addColorStop(1, 'rgba(150,60,230,0)'); ctx.fillStyle = gl; ctx.fillRect(-.4 * u, -.35 * u, .8 * u, .8 * u);
    ctx.restore();
  }
  // nariz (abertura em forma de coração invertido)
  ctx.beginPath(); ctx.moveTo(0, .55 * u); ctx.bezierCurveTo(-.32 * u, .8 * u, -.3 * u, 1.15 * u, -.06 * u, 1.2 * u); ctx.lineTo(0, 1.1 * u); ctx.lineTo(.06 * u, 1.2 * u); ctx.bezierCurveTo(.3 * u, 1.15 * u, .32 * u, .8 * u, 0, .55 * u);
  ctx.fillStyle = '#140e12'; ctx.fill();
  // dentes
  const ty = 1.55 * u, th = .48 * u, n = 8, tw = 1.8 * u / n;
  for (let i = 0; i < n; i++) {
    const x = -.9 * u + i * tw, k = 1 - Math.abs(i - (n - 1) / 2) / n * .5;
    ctx.fillStyle = i % 3 === 1 ? '#bfb59e' : '#d9d1bc'; ctx.beginPath(); ctx.moveTo(x + tw * .1, ty); ctx.lineTo(x + tw * .9, ty); ctx.lineTo(x + tw * .82, ty + th * k); ctx.quadraticCurveTo(x + tw * .5, ty + th * k * 1.15, x + tw * .18, ty + th * k); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(30,22,20,.75)'; ctx.lineWidth = Math.max(.6, u * .06); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(30,22,20,.6)'; ctx.lineWidth = Math.max(.7, u * .08); ctx.beginPath(); ctx.moveTo(-.95 * u, ty); ctx.quadraticCurveTo(0, ty - .12 * u, .95 * u, ty); ctx.stroke();
  ctx.restore();
}
function crypt(cx, base, s, t) {
  const m = new DOMMatrix().translate(cx, base).scale(s / 13); T.stonePat.setTransform(m); T.rockPat.setTransform(m);
  const X = (v) => cx + v * s, Y = (v) => base - v * s;
  const rect = (x, y, w, h) => () => ctx.rect(X(x), Y(y + h), w * s, h * s);
  const lightL = (x0, x1) => { const g = ctx.createLinearGradient(X(x0), 0, X(x1), 0); g.addColorStop(0, 'rgba(225,230,235,1)'); g.addColorStop(1, 'rgba(85,85,110,1)'); return g; };
  // sombra no chão
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(X(0), Y(-.3), 24 * s, 3 * s, 0, 0, 7); ctx.fill();
  // degraus
  [[-18, 0, 36], [-16.8, 1.2, 33.6], [-15.6, 2.4, 31.2]].forEach(([x, y, w]) => {
    stonePath(rect(x, y, w, 1.2), '#6a6670', lightL(x, x + w));
    ctx.fillStyle = 'rgba(210,225,220,.18)'; ctx.fillRect(X(x), Y(y + 1.2), w * s, s * .18);
  });
  // corpo
  stonePath(rect(-14, 3.6, 28, 14), '#5f5b68', lightL(-14, 14));
  // porta: escuridão + brilho roxo pulsando
  const pulse = .62 + .25 * Math.sin(t * 1.4) + .08 * Math.sin(t * 3.7);
  ctx.save(); ctx.beginPath(); ctx.moveTo(X(-3.6), Y(3.6)); ctx.lineTo(X(-3.6), Y(10.2)); ctx.arc(X(0), Y(10.2), 3.6 * s, Math.PI, 0); ctx.lineTo(X(3.6), Y(3.6)); ctx.closePath();
  ctx.fillStyle = '#05030a'; ctx.fill(); ctx.clip();
  const dg = ctx.createRadialGradient(X(0), Y(6), 0, X(0), Y(6), 7 * s); dg.addColorStop(0, `rgba(190,110,255,${.9 * pulse})`); dg.addColorStop(.5, `rgba(110,40,200,${.5 * pulse})`); dg.addColorStop(1, 'rgba(40,10,80,0)');
  ctx.fillStyle = dg; ctx.fillRect(X(-4), Y(14), 8 * s, 11 * s);
  ctx.restore();
  // moldura da porta
  ctx.strokeStyle = 'rgba(40,36,50,.9)'; ctx.lineWidth = s * .8; ctx.beginPath(); ctx.moveTo(X(-4), Y(3.6)); ctx.lineTo(X(-4), Y(10.2)); ctx.arc(X(0), Y(10.2), 4 * s, Math.PI, 0); ctx.lineTo(X(4), Y(3.6)); ctx.stroke();
  // colunas
  for (const x of [-12.6, -8.4, 6, 10.2]) {
    ctx.fillStyle = 'rgba(8,6,14,.45)'; ctx.fillRect(X(x + 2.4), Y(15.8), 1.1 * s, 12.2 * s);
    stonePath(rect(x, 3.6, 2.4, 12.2), '#86828e', (() => { const g = ctx.createLinearGradient(X(x), 0, X(x + 2.4), 0); g.addColorStop(0, 'rgba(250,250,255,1)'); g.addColorStop(.35, 'rgba(225,225,232,1)'); g.addColorStop(1, 'rgba(80,80,105,1)'); return g; })(), T.rockPat);
    ctx.strokeStyle = 'rgba(20,18,28,.35)'; ctx.lineWidth = Math.max(1, s * .12); for (const f of [.6, 1.2, 1.8]) { ctx.beginPath(); ctx.moveTo(X(x + f), Y(4.3)); ctx.lineTo(X(x + f), Y(15)); ctx.stroke(); }
    stonePath(rect(x - .4, 15, 3.2, .9), '#8a8692', lightL(x - .4, x + 2.8), T.rockPat);
    stonePath(rect(x - .4, 3.6, 3.2, .7), '#8a8692', lightL(x - .4, x + 2.8), T.rockPat);
  }
  // entablamento e frontão
  stonePath(rect(-15, 15.8, 30, 1.9), '#86828e', lightL(-15, 15), T.rockPat);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(X(-15), Y(15.8), 30 * s, s * .4);
  stonePath(() => { ctx.moveTo(X(-16.2), Y(17.7)); ctx.lineTo(X(0), Y(24.6)); ctx.lineTo(X(16.2), Y(17.7)); ctx.closePath(); }, '#76727f', lightL(-16, 16), T.rockPat);
  ctx.strokeStyle = 'rgba(220,235,225,.35)'; ctx.lineWidth = s * .25; ctx.beginPath(); ctx.moveTo(X(-16.2), Y(17.7)); ctx.lineTo(X(0), Y(24.6)); ctx.stroke();
  skull(X(0), Y(20.4), s * .95, pulse);
  // musgo
  ctx.save(); ctx.globalAlpha = .4; const mr = rng(5);
  for (let i = 0; i < 260; i++) { const x = -15 + mr() * 30, y = mr() < .65 ? 3.6 + mr() * mr() * 4 : 15.6 + mr() * mr() * 2.4; if (Math.abs(x) < 4.4 && y < 14.5) continue; ctx.fillStyle = mr() < .5 ? '#22351f' : '#2c4224'; ctx.beginPath(); ctx.arc(X(x), Y(y), (.12 + mr() * .3) * s, 0, 7); ctx.fill(); }
  ctx.restore();
  // hera descendo pelo lado esquerdo
  ctx.strokeStyle = '#1d2c19'; ctx.lineWidth = s * .25; const vr = rng(8);
  for (let k = 0; k < 4; k++) { let x = -13.6 + k * 1.1, y = 17.4; ctx.beginPath(); ctx.moveTo(X(x), Y(y)); for (let i = 0; i < 10; i++) { x += (vr() - .5) * .8; y -= .6 + vr() * .5; ctx.lineTo(X(x), Y(y)); } ctx.stroke(); }
  // luz da porta escorrendo pelos degraus
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const sg = ctx.createRadialGradient(X(0), Y(2), 0, X(0), Y(2), 12 * s); sg.addColorStop(0, `rgba(140,70,220,${.32 * pulse})`); sg.addColorStop(1, 'rgba(80,30,160,0)');
  ctx.fillStyle = sg; ctx.fillRect(X(-12), Y(14), 24 * s, 24 * s); ctx.restore();
}
function torch(x, y, s, t, seed) {
  const fl = 1 + Math.sin(t * 17 + seed) * .12 + Math.sin(t * 31 + seed * 2) * .08 + Math.sin(t * 7 + seed) * .06;
  // suporte de ferro
  ctx.fillStyle = '#17131a'; ctx.fillRect(x - .35 * s, y, .7 * s, 9 * s); ctx.fillRect(x - 1.1 * s, y - .2 * s, 2.2 * s, .6 * s);
  ctx.fillStyle = '#2a1e16'; ctx.beginPath(); ctx.moveTo(x - 1 * s, y - .2 * s); ctx.lineTo(x + 1 * s, y - .2 * s); ctx.lineTo(x + .6 * s, y - 1.4 * s); ctx.lineTo(x - .6 * s, y - 1.4 * s); ctx.fill();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const big = ctx.createRadialGradient(x, y - 2 * s, 0, x, y - 2 * s, 22 * s * fl); big.addColorStop(0, 'rgba(255,150,60,.35)'); big.addColorStop(.3, 'rgba(255,110,40,.12)'); big.addColorStop(1, 'rgba(255,90,30,0)');
  const br2 = 22 * s * fl; ctx.fillStyle = big; ctx.fillRect(x - br2, y - 2 * s - br2, br2 * 2, br2 * 2);
  // chama em camadas
  const flame = (h, w, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x - w * s, y - 1.4 * s); ctx.quadraticCurveTo(x - w * 1.2 * s, y - (1.4 + h * .5) * s, x + Math.sin(t * 9 + seed) * .4 * s, y - (1.4 + h * fl) * s); ctx.quadraticCurveTo(x + w * 1.2 * s, y - (1.4 + h * .5) * s, x + w * s, y - 1.4 * s); ctx.fill(); };
  flame(4.2, 1.1, 'rgba(255,90,30,.55)'); flame(3.2, .8, 'rgba(255,160,60,.75)'); flame(1.9, .45, 'rgba(255,240,190,.9)');
  ctx.restore();
}
function gravestone(st, t, cxCrypt, s0) {
  const s = s0 * st.s, x = st.x * W + mouse.x * (-20 - 10 * (st.s - .6) / .9), y = st.y * H;
  const w = st.w * s, h = st.h * s;
  // terra e sombra na base: a lápide fica presa no chão
  const sh = ctx.createRadialGradient(x, y, 0, x, y, w * 1.3); sh.addColorStop(0, 'rgba(5,6,5,.75)'); sh.addColorStop(1, 'rgba(5,6,5,0)');
  ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(x, y, w * 1.3, w * .38, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(x, y + h * .08); ctx.rotate(st.tilt);
  const shape = () => {
    if (st.kind === 'cross') { ctx.rect(-w * .18, -h * 1.15, w * .36, h * 1.15); ctx.rect(-w * .55, -h * .9, w * 1.1, w * .34); }
    else { ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2, -h + w / 2); ctx.arc(0, -h + w / 2, w / 2, Math.PI, 0); ctx.lineTo(w / 2, 0); ctx.closePath(); }
  };
  ctx.beginPath(); shape(); ctx.save(); ctx.clip();
  ctx.fillStyle = '#55525e'; ctx.fill();
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = T.rockPat; ctx.fill();
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(80,80,105,1)'); ctx.fillStyle = g; ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  const fog = ctx.createLinearGradient(0, -h, 0, 0); fog.addColorStop(0, 'rgba(150,165,170,0)'); fog.addColorStop(1, `rgba(150,165,170,${.25 + (1 - st.s) * .3})`); ctx.fillStyle = fog; ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(220,240,230,.25)'; ctx.lineWidth = Math.max(1, s * .2); ctx.beginPath(); ctx.moveTo(-w / 2, -h * .2); ctx.lineTo(-w / 2, -h + w / 2); ctx.stroke();
  ctx.fillStyle = '#121510'; ctx.beginPath(); ctx.ellipse(0, -h * .04, w * .8, w * .2, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function lightning(t) {
  S.next -= 1 / 60;
  if (S.next < 0) {
    S.flash = 1; S.next = 7 + Math.random() * 8; view.flashCount++;
    const r = Math.random; let x = W * (.55 + r() * .4), y = 0; const pts = [[x, y]];
    while (y < H * .55) { x += (r() - .5) * 40; y += 14 + r() * 26; pts.push([x, y]); }
    S.bolt = pts; S.boltT = .25;
    setTimeout(() => sfx.thunder(), 500 + Math.random() * 900);
  }
}
let last = performance.now(), time = 0, frameN = 0;
function draw(dt, t) {
  sky(t);
  const mx = W * .62 + mouse.x * -6, my = H * .2, mr = Math.min(W, H) * .085;
  moon(mx, my, mr);
  if (S.bolt && S.boltT > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(220,220,255,${S.boltT * 4})`; ctx.lineWidth = 2; ctx.shadowColor = '#c8c8ff'; ctx.shadowBlur = 18;
    ctx.beginPath(); S.bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore(); S.boltT -= dt;
  }
  scroll(T.cloudFar, -H * .02, H * .42, 6, t, .9, mouse.x * -8);
  // contorno prateado nas nuvens perto da lua
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; const sl = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 4.5); sl.addColorStop(0, 'rgba(120,140,130,.25)'); sl.addColorStop(1, 'rgba(120,140,130,0)'); ctx.fillStyle = sl; ctx.fillRect(0, 0, W, H); ctx.restore();
  scroll(T.cloudNear, H * .02, H * .38, 14, t, .85, mouse.x * -12);
  if (S.flash > 0) { ctx.fillStyle = `rgba(200,205,255,${S.flash * .28})`; ctx.fillRect(0, 0, W, H); S.flash -= dt * 2.5; }
  // floresta distante
  const fpx = mouse.x * -12; ctx.fillStyle = '#26222f'; ctx.beginPath(); ctx.moveTo(-40, H);
  for (const [x, h] of S.forest) { const by = H * .7 + Math.sin(x * .006) * H * .02; ctx.lineTo(x + fpx - 5, by); ctx.lineTo(x + fpx, by - h); ctx.lineTo(x + fpx + 5, by); }
  ctx.lineTo(W + 40, H); ctx.fill();
  scroll(T.fogB, H * .62, H * .14, 10, t, .5, 0);
  // colina
  const hp = mouse.x * -20; const hg = ctx.createLinearGradient(0, H * .72, 0, H); hg.addColorStop(0, '#2b2d2c'); hg.addColorStop(1, '#0e100e');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(-40, H); ctx.lineTo(-40, H * .82); ctx.quadraticCurveTo(W * .35 + hp, H * .74, W * .6 + hp, H * .76); ctx.quadraticCurveTo(W * .85 + hp, H * .78, W + 40, H * .8); ctx.lineTo(W + 40, H); ctx.fill();
  // árvores ao fundo (com névoa)
  for (const tr of T.trees) if (tr.fog) { ctx.globalAlpha = 1 - tr.fog * .6; ctx.drawImage(tr.img, tr.x * W - tr.img.width / 2 + mouse.x * tr.par, tr.y * H - tr.img.height); ctx.globalAlpha = 1; }
  const s = Math.max(4, Math.min(W / 95, H / 62));
  const cx = W * .6 + mouse.x * -22, base = H * .8;
  // caminho até a porta
  ctx.save(); ctx.beginPath(); ctx.moveTo(cx - 4 * s, base); ctx.lineTo(cx + 4 * s, base); ctx.lineTo(cx + 14 * s, H + 5); ctx.lineTo(cx - 10 * s, H + 5); ctx.closePath(); ctx.clip();
  ctx.fillStyle = '#3a3640'; ctx.fill(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = T.stonePat; ctx.fill();
  const pg = ctx.createLinearGradient(0, base, 0, H); pg.addColorStop(0, 'rgba(130,110,170,1)'); pg.addColorStop(1, 'rgba(30,30,35,1)'); ctx.fillStyle = pg; ctx.fill(); ctx.restore();
  for (const st of S.stones) if (st.y < .86) gravestone(st, t, cx, s * .9);
  crypt(cx, base, s, t);
  torch(cx - 20 * s, base - 8.5 * s, s, t, 1); torch(cx + 21 * s, base - 8.5 * s, s, t, 4);
  // brasas subindo das tochas
  for (const e of S.embers) {
    if (e.y < 0 || e.y < H * .35) { e.x = cx + e.side * (e.side < 0 ? 20 : 21) * s; e.y = base - 11 * s - Math.random() * 10; e.v = 20 + Math.random() * 30; }
    e.y -= e.v * dt; e.x += Math.sin(t * 2 + e.ph) * 14 * dt + 6 * dt;
    ctx.globalAlpha = clamp((e.y - H * .35) / (H * .2)); ctx.fillStyle = '#ffb060'; ctx.fillRect(e.x, e.y, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
  scroll(T.fogA, H * .74, H * .16, 18, t, .55, 0);
  for (const st of S.stones) if (st.y >= .86) gravestone(st, t, cx, s * .9);
  // corvos
  for (const b of S.crows) {
    b.x += b.v * dt; if (b.x > W + 30) b.x = -30;
    const f = Math.sin(t * 8 + b.ph) * b.s * .6, y = b.y + Math.sin(t * .7 + b.ph) * 8;
    ctx.fillStyle = '#08060c'; ctx.beginPath(); ctx.moveTo(b.x - b.s * 1.2, y - f); ctx.quadraticCurveTo(b.x - b.s * .4, y - f * .3 - 1, b.x, y); ctx.quadraticCurveTo(b.x + b.s * .4, y - f * .3 - 1, b.x + b.s * 1.2, y - f); ctx.quadraticCurveTo(b.x, y + 1.5, b.x - b.s * 1.2, y - f); ctx.fill();
  }
  // daqui para baixo: camada da frente (por cima dos esqueletos)
  ctxF.clearRect(0, 0, W, H); ctx = ctxF;
  // árvores da frente
  for (const tr of T.trees) if (!tr.fog) { const sway = Math.sin(t * .6 + tr.x * 3) * .006; ctx.save(); ctx.translate(tr.x * W + mouse.x * tr.par, tr.y * H); ctx.transform(1, 0, sway, 1, 0, 0); ctx.drawImage(tr.img, -tr.img.width / 2, -tr.img.height); ctx.restore(); }
  // grama
  for (const b of S.grass) {
    const bx = b.x + mouse.x * b.par; // grama presa no chão: anda junto com o terreno quando a câmera se mexe
    const sw = (wind(b.x, t) + .1) * b.h * .45, tx = bx + sw, ty = b.y - b.h * (1 - Math.abs(sw) / b.h * .25);
    ctx.fillStyle = b.c; ctx.beginPath(); ctx.moveTo(bx - b.w, b.y); ctx.quadraticCurveTo(bx + sw * .3, b.y - b.h * .55, tx, ty); ctx.quadraticCurveTo(bx + sw * .3 + b.w * .4, b.y - b.h * .5, bx + b.w, b.y); ctx.fill();
    if (b.hi) { ctx.strokeStyle = 'rgba(170,190,180,.18)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(bx + sw * .5, b.y - b.h * .6); ctx.lineTo(tx, ty); ctx.stroke(); }
  }
  scroll(T.fogA, H * .86, H * .2, 26, t + 40, .35, 0);
  ctx.drawImage(T.vig, 0, 0, W, H);
  // grão de filme
  ctx.save(); ctx.globalAlpha = .035; ctx.translate(Math.random() * 200, Math.random() * 200); ctx.fillStyle = T.grainPat; ctx.fillRect(-200, -200, W + 400, H + 400); ctx.restore();
  ctx = ctxB;
  lightning(t);
}

function resize() {
  DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  for (const c of [cv, fcv, wcv]) { c.width = W * DPR; c.height = H * DPR; }
  ctxB.setTransform(DPR, 0, 0, DPR, 0, 0); ctxF.setTransform(DPR, 0, 0, DPR, 0, 0); wctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  build();
}
let rt = 0; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });

// ---------- som ----------
let ac = null, windNode = null, out = null;
const sfx = {
  on() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
    if (!out) { out = ac.createGain(); out.connect(ac.destination); settings.onChange(volume); }
    if (ac.state === 'suspended' && running) ac.resume();
    if (!windNode) this.wind();
  },
  noise(len) { const b = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ac.createBufferSource(); s.buffer = b; return s; },
  // vento de fundo, bem baixo
  wind() {
    const n = this.noise(4); n.loop = true; const lp = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 420; g.gain.value = .035; lfo.frequency.value = .13; lg.gain.value = .025;
    lfo.connect(lg).connect(g.gain); n.connect(lp).connect(g).connect(out); n.start(); lfo.start(); windNode = n;
  },
  tick() {
    if (!ac || ac.state !== 'running') return; const t = ac.currentTime;
    for (const [f, v] of [[1760, .06], [2640, .03], [3950, .015]]) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .28); o.connect(g).connect(out); o.start(t); o.stop(t + .3); }
    const n = this.noise(.05), bp = ac.createBiquadFilter(), g = ac.createGain(); bp.type = 'highpass'; bp.frequency.value = 5000; g.gain.setValueAtTime(.05, t); g.gain.exponentialRampToValueAtTime(.0001, t + .05); n.connect(bp).connect(g).connect(out); n.start(t);
  },
  confirm() {
    if (!ac || ac.state !== 'running') return; const t = ac.currentTime;
    const n = this.noise(.6), bp = ac.createBiquadFilter(), g = ac.createGain(); bp.type = 'bandpass'; bp.Q.value = 3; bp.frequency.setValueAtTime(900, t); bp.frequency.exponentialRampToValueAtTime(7000, t + .45);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.22, t + .08); g.gain.exponentialRampToValueAtTime(.0001, t + .55); n.connect(bp).connect(g).connect(out); n.start(t);
    const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + .5); og.gain.setValueAtTime(.35, t); og.gain.exponentialRampToValueAtTime(.0001, t + .6); o.connect(og).connect(out); o.start(t); o.stop(t + .65);
  },
  // golpes e magias dos esqueletos
  clang() {
    if (!ac || ac.state !== 'running') return; const t = ac.currentTime;
    for (const [f, v] of [[2300, .05], [3420, .035], [5100, .02]]) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = f * (.95 + Math.random() * .1); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + .45); o.connect(g).connect(out); o.start(t); o.stop(t + .5); }
    const n = this.noise(.08), hp = ac.createBiquadFilter(), g = ac.createGain(); hp.type = 'highpass'; hp.frequency.value = 2500; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .08); n.connect(hp).connect(g).connect(out); n.start(t);
  },
  hit() {
    if (!ac || ac.state !== 'running') return; const t = ac.currentTime;
    const n = this.noise(.12), bp = ac.createBiquadFilter(), g = ac.createGain(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.5; g.gain.setValueAtTime(.16, t); g.gain.exponentialRampToValueAtTime(.0001, t + .12); n.connect(bp).connect(g).connect(out); n.start(t);
  },
  thud() {
    if (!ac || ac.state !== 'running') return; const t = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + .3); g.gain.setValueAtTime(.18, t); g.gain.exponentialRampToValueAtTime(.0001, t + .35); o.connect(g).connect(out); o.start(t); o.stop(t + .4);
    const n = this.noise(.25), lp = ac.createBiquadFilter(), g2 = ac.createGain(); lp.type = 'lowpass'; lp.frequency.value = 900; g2.gain.setValueAtTime(.08, t); g2.gain.exponentialRampToValueAtTime(.0001, t + .25); n.connect(lp).connect(g2).connect(out); n.start(t);
  },
  // trombada de crânio: "toc" oco
  bonk() {
    if (!ac || ac.state !== 'running') return; const t = ac.currentTime;
    for (const [f, v, d] of [[620, .22, .12], [940, .12, .08], [310, .16, .18]]) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * .7, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(out); o.start(t); o.stop(t + d + .02); }
    const n = this.noise(.04), bp = ac.createBiquadFilter(), g = ac.createGain(); bp.type = 'bandpass'; bp.frequency.value = 1800; g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .04); n.connect(bp).connect(g).connect(out); n.start(t);
  },
  shoot() {
    if (!ac || ac.state !== 'running') return; const t = ac.currentTime;
    const n = this.noise(.25), bp = ac.createBiquadFilter(), g = ac.createGain(); bp.type = 'bandpass'; bp.Q.value = 4; bp.frequency.setValueAtTime(3000, t); bp.frequency.exponentialRampToValueAtTime(500, t + .22); g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .24); n.connect(bp).connect(g).connect(out); n.start(t);
  },
  magic() {
    if (!ac || ac.state !== 'running') return; const t = ac.currentTime;
    for (const [f, d] of [[220, 0], [330, .05], [440, .1]]) { const o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f, t + d); o.frequency.exponentialRampToValueAtTime(f * 2, t + 1.6); l.frequency.value = 7; lg.gain.value = .02; l.connect(lg).connect(g.gain);
      g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.05, t + d + .3); g.gain.exponentialRampToValueAtTime(.0001, t + 1.9); o.connect(g).connect(out); o.start(t + d); l.start(t + d); o.stop(t + 2); l.stop(t + 2); }
  },
  thunder() {
    if (!ac || ac.state !== 'running') return; const t = ac.currentTime;
    const n = this.noise(3.5), lp = ac.createBiquadFilter(), g = ac.createGain(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(120, t + 3);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.3, t + .08); g.gain.setValueAtTime(.22, t + .5); g.gain.exponentialRampToValueAtTime(.0001, t + 3.4); n.connect(lp).connect(g).connect(out); n.start(t);
  },
};
// ---------- espiral até o preto ----------
function spiral(atBlack) {
  if (busy) return; busy = true; const DUR = 1.5, t0 = performance.now(); const R = Math.hypot(W, H) * .62, cx = W / 2, cy = H / 2;
  const step = (now) => {
    const p = Math.min(1, (now - t0) / 1000 / DUR), e = p * p * (3 - 2 * p);
    wctx.clearRect(0, 0, W, H); wctx.fillStyle = '#000';
    const rot = e * Math.PI * 4, scale = 2.1 * (1 - e);
    wctx.beginPath(); wctx.rect(0, 0, W, H);
    if (scale > 0.001) {
      const N = 240;
      for (let k = 0; k <= N; k++) { const a = k / N * Math.PI * 2, rr = R * scale * (.45 + .55 * k / N);
        const x = cx + Math.cos(a + rot) * rr, y = cy + Math.sin(a + rot) * rr; if (k === 0) wctx.moveTo(x, y); else wctx.lineTo(x, y); }
      wctx.closePath();
    }
    wctx.fill('evenodd');
    wctx.fillStyle = `rgba(0,0,0,${Math.max(0, (e - .7) / .3)})`; wctx.fillRect(0, 0, W, H);
    if (p < 1) requestAnimationFrame(step);
    else { tav.classList.add('show'); wctx.clearRect(0, 0, W, H); try { atBlack && atBlack(); } catch (e) { console.error(e); } setTimeout(reset, 1400); }
  };
  requestAnimationFrame(step);
}
function reset() {
  // a camada preta (com o texto) some aos poucos e mostra o jogo
  wctx.clearRect(0, 0, W, H); tav.classList.remove('show');
  setTimeout(() => { busy = false; }, 650);
}


function volume(st) { if (out) out.gain.value = (st.master / 100) ** 2 * (st.sfx / 100) ** 2; }
const wake = () => { if (running) sfx.on(); };
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, wake, { capture: true });

function frame(now) {
  if (!running) return;
  const dt = Math.min(.05, (now - last) / 1000); last = now; const k = reduce ? .25 : 1; time += dt * k;
  mouse.x += (mouse.tx - mouse.x) * .04; mouse.y += (mouse.ty - mouse.y) * .04;
  draw(dt * k, time);
  requestAnimationFrame(frame);
}
// dados para os esqueletos 3D
const view = { get W() { return W; }, get H() { return H; }, mouse,
  // Para os esqueletos 3D (menuplays.js): porta da cripta, árvores do fundo e lápides, em pixels da tela (já com o mouse).
  get door() { const s = Math.max(4, Math.min(W / 95, H / 62)); return { x: W * .6 + mouse.x * -22, base: H * .8, top: H * .8 - 3.6 * s, s }; },
  get trees() { return (T.trees || []).filter((tr) => tr.fog).map((tr) => ({ x: tr.x * W + mouse.x * tr.par, y: tr.y * H, h: tr.img.height / 1.35 })); },
  get stones() { return (S.stones || []).map((st) => ({ x: st.x * W + mouse.x * (-20 - 10 * (st.s - .6) / .9), y: st.y * H, s: st.s, w: st.w })); }, get s() { return Math.max(4, Math.min(W / 95, H / 62)); }, get cx() { return W * .6; }, get base() { return H * .8; }, get flash() { return Math.max(0, S.flash); }, flashCount: 0, sfx };
let crowd = null, built = false;

export const menuScene = {
  sfx,
  get running() { return running; },
  start() {
    if (running) return; running = true;
    document.body.classList.add('mscene');
    if (!built) { resize(); built = true; }
    if (ac && ac.state === 'suspended') ac.resume();
    last = performance.now(); requestAnimationFrame(frame);
    if (!crowd) crowd = startCrowd(view, crowdCanvas); else crowd.resume();
  },
  stop() {
    if (!running) return; running = false;
    document.body.classList.remove('mscene');
    if (crowd) crowd.pause();
    if (ac && ac.state === 'running') ac.suspend();
  },
  // Espiral até o preto ("Rumo à Taverna…"); atBlack roda com a tela toda preta.
  spiral(atBlack) { spiral(atBlack); },
  get busy() { return busy; },
  get crowd() { return crowd; }, // testes
};
