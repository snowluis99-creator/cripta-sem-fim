// Cavalo Fantasma (pedido do dono, 04/11: "igual a um cavalo mesmo"). Não há modelo de cavalo nos assets, então
// ele é montado em código com formas arredondadas: corpo, peito e garupa, pescoço inclinado, cabeça com focinho,
// orelhas e olhos, crina e cauda de fogo azul, sela e pernas com joelho e casco. O galope mexe as quatro
// pernas em tempos diferentes (galope de verdade), balança o corpo, o pescoço e a cauda.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

export function makeHorse() {
  const mats = [];
  const mat = (color, emissive, ei, op) => {
    const m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, transparent: true, opacity: op, roughness: 0.55, metalness: 0.05 });
    m.userData.op = op; mats.push(m); return m;
  };
  const coat = mat(0xe4ecf2, 0x3d6a9a, 0.35, 0.95);
  const dark = mat(0x2c3542, 0x1a4f90, 0.5, 0.95);
  const glow = mat(0xb8f0ff, 0x3aa8ff, 1.5, 0.85);
  const leather = mat(0x6a3f22, 0x1a0c04, 0.2, 0.97);
  const gold = mat(0xe8b84a, 0x4a3000, 0.4, 0.97);
  glow.depthWrite = false;
  const g = new THREE.Group();
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const sphere = (r, sx = 1, sy = 1, sz = 1) => new THREE.SphereGeometry(r, 18, 12).scale(sx, sy, sz);
  // Cilindro de a até b (afinando de ra para rb).
  const limb = (parent, a, b, ra, rb, m) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const o = add(parent, new THREE.CylinderGeometry(rb, ra, len, 12), m);
    o.position.copy(a).addScaledVector(d, 0.5);
    o.quaternion.setFromUnitVectors(UP, d.normalize());
    return o;
  };
  const v = (x, y, z) => new THREE.Vector3(x, y, z);

  // Tronco (balança junto com o galope).
  const body = new THREE.Group(); g.add(body);
  add(body, new THREE.CapsuleGeometry(0.3, 0.85, 8, 16).rotateX(Math.PI / 2).scale(1, 1.1, 1), coat, 0, 1.05, 0);
  add(body, sphere(0.34, 0.95, 1.05, 1), coat, 0, 1.08, 0.5);    // peito
  add(body, sphere(0.35, 1.02, 1, 1.05), coat, 0, 1.1, -0.48);  // garupa
  // Sela com borda dourada e manta.
  add(body, new THREE.CylinderGeometry(0.34, 0.34, 0.42, 16, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(1, 0.55, 1), leather, 0, 1.33, -0.02);
  add(body, new THREE.BoxGeometry(0.66, 0.04, 0.5), gold, 0, 1.2, -0.02);
  // Manta: tecido azul com barra dourada, caindo dos dois lados.
  const cloth = mat(0x5a8ee0, 0x2a5aa8, 0.6, 0.97);
  for (const sd of [-1, 1]) {
    const c = add(body, new THREE.BoxGeometry(0.035, 0.36, 0.5), cloth, 0.335 * sd, 1.08, -0.02); c.rotation.z = 0.12 * sd;
    const t = add(body, new THREE.BoxGeometry(0.04, 0.05, 0.52), gold, 0.355 * sd, 0.9, -0.02); t.rotation.z = 0.12 * sd;
  }

  // Pescoço e cabeça.
  const neck = new THREE.Group(); neck.position.set(0, 1.25, 0.62); body.add(neck);
  limb(neck, v(0, -0.05, -0.05), v(0, 0.55, 0.36), 0.27, 0.17, coat);
  add(neck, sphere(0.2, 1, 1.2, 1), coat, 0, 0.3, 0.17); // pescoço mais cheio
  const head = new THREE.Group(); head.position.set(0, 0.58, 0.4); neck.add(head);
  add(head, sphere(0.18, 1, 1, 1.1), coat, 0, 0, 0);
  limb(head, v(0, 0, 0.02), v(0, -0.2, 0.44), 0.16, 0.115, coat);  // cara alongada até o focinho
  add(head, sphere(0.12, 1, 0.9, 1.15), dark, 0, -0.22, 0.46);         // focinho
  for (const s of [-1, 1]) {
    add(head, sphere(0.032), mat(0x0a0f1a, 0x58c8ff, 2.2, 1), 0.145 * s, 0.03, 0.09);        // olho brilhando
    const ear = add(head, new THREE.ConeGeometry(0.05, 0.19, 8), coat, 0.08 * s, 0.2, -0.04);
    ear.rotation.set(-0.25, 0, 0.2 * s);
  }
  // Rédeas: duas tiras do focinho até a sela.
  for (const s of [-1, 1]) limb(body, v(0.1 * s, 1.75, 1.15), v(0.18 * s, 1.36, 0.22), 0.012, 0.012, leather);

  // Crina: mechas de fogo azul ao longo do pescoço (balançam).
  const mane = [];
  for (let i = 0; i < 7; i++) {
    const k = i / 6;
    const m = add(neck, new THREE.ConeGeometry(0.06, 0.32 - k * 0.1, 6), glow, 0, 0.06 + k * 0.56, -0.08 + k * 0.4);
    m.rotation.x = -2.1; m.userData.base = -2.1; mane.push(m);
  }
  const forelock = add(head, new THREE.ConeGeometry(0.05, 0.2, 6), glow, 0, 0.16, 0.06);
  forelock.rotation.x = 1.2;

  // Cauda: 3 pedaços encadeados que ondulam.
  const tail = [];
  let parent = body;
  const t0 = new THREE.Group(); t0.position.set(0, 1.22, -0.8); t0.rotation.x = -0.9; body.add(t0); parent = t0;
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group(); seg.position.y = i ? -0.26 : 0; parent.add(seg);
    add(seg, new THREE.CylinderGeometry(0.07 - i * 0.01, 0.1 - i * 0.015, 0.3, 8), glow, 0, -0.14, 0);
    tail.push(seg); parent = seg;
  }

  // Pernas: quadril -> coxa -> joelho -> canela -> casco.
  const legs = [];
  const LEG = [[-0.18, 0.5, true, 0.45], [0.18, 0.5, true, 0.55], [-0.18, -0.5, false, 0], [0.18, -0.5, false, 0.1]];
  for (const [x, z, front, ph] of LEG) {
    const hip = new THREE.Group(); hip.position.set(x, 1.0, z); g.add(hip);
    add(hip, sphere(front ? 0.15 : 0.17, 1, 1.3, 1.1), coat, 0, -0.05, front ? 0 : -0.02);
    limb(hip, v(0, -0.02, 0), v(0, -0.44, front ? 0 : -0.04), front ? 0.13 : 0.15, 0.075, coat);
    const knee = new THREE.Group(); knee.position.set(0, -0.44, front ? 0 : -0.04); hip.add(knee);
    add(knee, sphere(0.075), coat);
    limb(knee, v(0, 0, 0), v(0, -0.4, 0), 0.06, 0.05, coat);
    const hoof = add(knee, new THREE.CylinderGeometry(0.065, 0.08, 0.1, 10), dark, 0, -0.44, 0.01);
    add(knee, new THREE.SphereGeometry(0.075, 8, 6).scale(1, 0.6, 1), glow, 0, -0.33, 0); // tufo brilhando no boleto
    legs.push({ hip, knee, hoof, front, ph });
  }
  g.traverse((o) => { if (o.isMesh) { o.renderOrder = 2; o.castShadow = false; } });

  // Galope: t = tempo (s). Pernas em 4 tempos, corpo sobe e desce, pescoço e cauda acompanham.
  const animate = (t, fade = 1) => {
    const f = 2.1; // passadas por segundo
    for (const L of legs) {
      const a = (t * f + L.ph) * Math.PI * 2;
      const swing = Math.sin(a);
      L.hip.rotation.x = swing * (L.front ? 0.75 : 0.65) - (L.front ? 0.05 : -0.1);
      const lift = Math.max(0, Math.cos(a)); // perna voltando para a frente: dobra o joelho
      L.knee.rotation.x = L.front ? lift * 1.5 : -lift * 1.1 + 0.15;
    }
    const b = Math.sin(t * f * Math.PI * 2);
    body.position.y = Math.abs(Math.sin(t * f * Math.PI)) * 0.08;
    body.rotation.x = b * 0.06;
    neck.rotation.x = -b * 0.12;
    head.rotation.x = b * 0.08;
    mane.forEach((m, i) => { m.rotation.x = m.userData.base + Math.sin(t * 14 - i * 0.7) * 0.25; });
    tail.forEach((s, i) => { s.rotation.x = (i ? 0.25 : 0) + Math.sin(t * 9 - i * 0.9) * 0.3; s.rotation.z = Math.sin(t * 6 - i) * 0.2; });
    for (const m of mats) m.opacity = m.userData.op * Math.max(0.15, fade);
    return body.position.y;
  };
  animate(0);
  return { g, legs, mats, animate };
}
