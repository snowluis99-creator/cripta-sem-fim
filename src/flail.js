// Mangual feito em código (a KayKit não tem um): cabo de madeira + corrente + bola de ferro com espinhos.
// A bola balança de verdade: é simulada no mundo (gravidade + corrente esticada até a ponta do cabo),
// então acompanha o giro do braço e fica para trás nos golpes.
import * as THREE from 'three';

const LINKS = 6;
const CHAIN = 0.62;      // comprimento da corrente
const BALL_R = 0.2;
const GRAVITY = 18;

let mats = null;
function materials() {
  if (mats) return mats;
  mats = {
    wood: new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.85 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.45, metalness: 0.7 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x4a4f57, roughness: 0.5, metalness: 0.6 }),
  };
  return mats;
}

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

// Devolve o grupo do mangual (preso no osso da mão). O cabo aponta para +Y, como as outras armas.
export function makeFlail() {
  const m = materials();
  const g = new THREE.Group();
  g.name = 'flail';
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.8, 10), m.wood.clone());
  handle.position.y = 0.1;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 10), m.dark.clone());
  grip.position.y = -0.28;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.14, 10), m.metal.clone());
  cap.position.y = 0.55;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 6, 12), m.metal.clone());
  ring.position.y = 0.65;
  g.add(handle, grip, cap, ring);
  // Elos da corrente e a bola: ficam no grupo, mas a posição é calculada no mundo a cada quadro.
  const linkGeo = new THREE.TorusGeometry(0.045, 0.014, 6, 10);
  const links = [];
  for (let i = 0; i < LINKS; i++) { const l = new THREE.Mesh(linkGeo, m.metal.clone()); g.add(l); links.push(l); }
  const ball = new THREE.Group();
  ball.add(new THREE.Mesh(new THREE.IcosahedronGeometry(BALL_R, 1), m.dark.clone()));
  const spikeGeo = new THREE.ConeGeometry(0.05, 0.16, 6);
  const ico = new THREE.IcosahedronGeometry(1, 0).getAttribute('position');
  const seen = new Set();
  for (let i = 0; i < ico.count; i++) {
    tmp.fromBufferAttribute(ico, i).normalize();
    const k = tmp.toArray().map((v) => v.toFixed(2)).join();
    if (seen.has(k)) continue;
    seen.add(k);
    const s = new THREE.Mesh(spikeGeo, m.metal.clone());
    s.position.copy(tmp).multiplyScalar(BALL_R + 0.05);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp);
    ball.add(s);
  }
  g.add(ball);
  g.userData.flail = { links, ball, anchor: new THREE.Vector3(0, 0.68, 0), pos: null, prev: null };
  return g;
}

// Simula a bola (chamar a cada quadro, depois da animação). scale = tamanho do mangual (Lâmina Longa).
export function updateFlail(g, dt) {
  const f = g.userData.flail;
  if (!f) return;
  g.updateWorldMatrix(true, false);
  const anchor = tmp.copy(f.anchor).applyMatrix4(g.matrixWorld);
  const len = CHAIN * g.getWorldScale(tmp2).y;
  if (!f.pos || dt <= 0 || dt > 0.2) {
    f.pos = anchor.clone().add(new THREE.Vector3(0, -len, 0));
    f.prev = f.pos.clone();
  } else {
    // Verlet: inércia + gravidade, com um pouco de atrito.
    const vx = (f.pos.x - f.prev.x) * 0.985, vy = (f.pos.y - f.prev.y) * 0.985, vz = (f.pos.z - f.prev.z) * 0.985;
    f.prev.copy(f.pos);
    f.pos.x += vx; f.pos.y += vy - GRAVITY * dt * dt; f.pos.z += vz;
    const d = tmp2.subVectors(f.pos, anchor);
    const dist = d.length() || 1e-4;
    if (dist > len) f.pos.copy(anchor).addScaledVector(d, len / dist);
    if (f.pos.y < BALL_R + 0.02) f.pos.y = BALL_R + 0.02; // não atravessa o chão
  }
  // Coloca bola e elos (posições do mundo -> locais do grupo).
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const a = anchor.clone().applyMatrix4(inv);
  const b = f.pos.clone().applyMatrix4(inv);
  f.ball.position.copy(b);
  const dir = tmp2.subVectors(b, a);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  f.links.forEach((l, i) => {
    l.position.copy(a).addScaledVector(dir, (i + 0.5) / LINKS);
    l.quaternion.copy(q);
    if (i % 2) l.rotateY(Math.PI / 2);
    l.rotateX(Math.PI / 2);
  });
}
