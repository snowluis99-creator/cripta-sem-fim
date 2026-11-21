// Mangual e Escudo, 2ª leva (lista do dono, 09/11/2026): o visual. As regras ficam em flailkit2.js.
// Corda/corrente entre dois pontos, olhos e dentes da Bola Faminta, gaiola, sino, cometa, flechas presas no
// escudo, chão escorregadio da Panela de Pressão e as cabeças da Hidra.
import * as THREE from 'three';

const mats = {};
const mat = (k, make) => mats[k] || (mats[k] = make());
const keep = (m) => { m.userData.keep = true; return m; };
const metal = () => mat('metal', () => keep(new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.45, metalness: 0.7 })));
const dark = () => mat('dark', () => keep(new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.5, metalness: 0.6 })));
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// Corrente esticada entre dois pontos (cilindro de comprimento 1 ao longo de +Z). setRope(m, a, b) posiciona.
export function rope(color = 0xb8c4d6, w = 0.05) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(w, w, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.6 }));
  m.userData.rope = true;
  return m;
}
export function setRope(m, a, b) {
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 0.001;
  m.position.set(a.x, a.y, a.z);
  m.lookAt(b.x, b.y, b.z);
  m.scale.set(1, 1, d);
}

// Bola com espinhos (cabeças da Hidra, cometa).
export function spikeBall(r = 0.2, color = null) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), color ? new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.6 }) : dark().clone());
  g.add(body);
  const spike = new THREE.ConeGeometry(r * 0.25, r * 0.8, 6);
  const ico = new THREE.IcosahedronGeometry(1, 0).getAttribute('position');
  const seen = new Set(), t = new THREE.Vector3();
  for (let i = 0; i < ico.count; i++) {
    t.fromBufferAttribute(ico, i).normalize();
    const k = t.toArray().map((v) => v.toFixed(2)).join();
    if (seen.has(k)) continue;
    seen.add(k);
    const s = new THREE.Mesh(spike, metal());
    s.position.copy(t).multiplyScalar(r * 1.25);
    s.quaternion.setFromUnitVectors(v3(0, 1, 0), t);
    g.add(s);
  }
  g.userData.body = body;
  return g;
}

// Bola Faminta: olhos e dentes presos na bola do mangual (raio da bola ~0,2).
export function faceParts() {
  const g = new THREE.Group();
  const white = mat('eyeW', () => keep(new THREE.MeshBasicMaterial({ color: 0xffffff })));
  const black = mat('eyeB', () => keep(new THREE.MeshBasicMaterial({ color: 0x111111 })));
  const red = mat('eyeR', () => keep(new THREE.MeshBasicMaterial({ color: 0xff3030 })));
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), white);
    eye.position.set(sx * 0.09, 0.08, 0.17);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), black);
    pupil.position.set(0, 0, 0.055);
    eye.add(pupil);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.03), red);
    brow.position.set(0, 0.075, 0.03); brow.rotation.z = sx * -0.45;
    eye.add(brow);
    g.add(eye);
  }
  const jaw = new THREE.Group(); jaw.name = 'jaw';
  const tooth = new THREE.ConeGeometry(0.025, 0.07, 5);
  const twhite = mat('tooth', () => keep(new THREE.MeshStandardMaterial({ color: 0xf4f0e0, roughness: 0.6 })));
  for (let i = 0; i < 6; i++) {
    const a = -0.7 + i * 0.28;
    const up = new THREE.Mesh(tooth, twhite); up.position.set(Math.sin(a) * 0.17, -0.02, Math.cos(a) * 0.17); up.rotation.x = Math.PI;
    const lo = new THREE.Mesh(tooth, twhite); lo.position.set(Math.sin(a) * 0.16, -0.1, Math.cos(a) * 0.16);
    g.add(up); jaw.add(lo);
  }
  g.add(jaw);
  return g;
}

// Gaiola de Correntes: postes em volta e correntes ligando os postes.
export function cageMesh(R) {
  const g = new THREE.Group();
  const n = 12;
  const post = new THREE.CylinderGeometry(0.09, 0.12, 1.6, 8);
  const cap = new THREE.SphereGeometry(0.13, 8, 6);
  const link = new THREE.TorusGeometry(0.09, 0.025, 5, 10);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    const p = new THREE.Mesh(post, dark()); p.position.set(Math.sin(a) * R, 0.8, Math.cos(a) * R); g.add(p);
    const c = new THREE.Mesh(cap, metal()); c.position.set(Math.sin(a) * R, 1.62, Math.cos(a) * R); g.add(c);
    const a2 = (i + 1) / n * Math.PI * 2;
    const x0 = Math.sin(a) * R, z0 = Math.cos(a) * R, x1 = Math.sin(a2) * R, z1 = Math.cos(a2) * R;
    const segs = 7;
    for (const h of [0.55, 1.25]) {
      for (let k = 0; k < segs; k++) {
        const u = (k + 0.5) / segs;
        const l = new THREE.Mesh(link, metal());
        l.position.set(x0 + (x1 - x0) * u, h - 0.12 * Math.sin(u * Math.PI), z0 + (z1 - z0) * u);
        l.rotation.y = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
        if (k % 2) l.rotation.x = Math.PI / 2;
        g.add(l);
      }
    }
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(R - 0.12, R + 0.12, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.position.y = 0.05; ring.name = 'glow';
  g.add(ring);
  return g;
}

// Sino da Catedral: sininho dourado que aparece em cima do escudo.
export function bellMesh() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, roughness: 0.3, metalness: 0.9, emissive: 0x6a4400, emissiveIntensity: 0.6 });
  const pts = [];
  for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push(new THREE.Vector2(0.08 + 0.32 * Math.pow(u, 1.6), 0.55 - u * 0.55)); }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), gold);
  body.material.side = THREE.DoubleSide;
  const top = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 12), gold); top.position.y = 0.6;
  const clap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), gold); clap.position.y = -0.04;
  g.add(body, top, clap);
  return g;
}

// Cometa: bola em brasa branca com rastro.
export function meteorMesh() {
  const g = spikeBall(0.45, 0xffe6c0);
  g.userData.body.material.emissive = new THREE.Color(0xffd080); g.userData.body.material.emissiveIntensity = 2.2;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff9a40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(2.4);
  g.add(glow);
  return g;
}
// Sombra/alvo no chão onde o cometa vai cair.
export function targetRing(r) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.85, r, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff7030, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.y = 0.06;
  return m;
}
let gtex = null;
function glowTex() {
  if (gtex) return gtex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,200,120,0.6)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  gtex = new THREE.CanvasTexture(c);
  return gtex;
}

// Escudo Coletor: flecha (ou orbe de magia) presa no escudo.
export function stuckShot(kind, color = 0xb070ff) {
  const g = new THREE.Group();
  if (kind === 'arrow') {
    const wood = mat('shaft', () => keep(new THREE.MeshStandardMaterial({ color: 0x7a5530, roughness: 0.8 })));
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 5), wood); shaft.position.y = 0.27;
    const fl = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.01), mat('flet', () => keep(new THREE.MeshStandardMaterial({ color: 0xd8d0c0 }))));
    fl.position.y = 0.5;
    g.add(shaft, fl);
  } else {
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color }));
    o.position.y = 0.06;
    g.add(o);
  }
  return g;
}

// Panela de Pressão: chão molhado/escorregadio.
export function slickDisc(R) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(R, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
  m.position.y = 0.04;
  return m;
}
