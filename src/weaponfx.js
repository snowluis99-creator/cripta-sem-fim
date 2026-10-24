// Enfeites brilhantes das armas da Maga (feitos em código): cada arma fica com uma cara bem diferente.
// makeWeaponFx(tipo, alturaDaPonta) devolve um grupo para pendurar na arma; userData.tick(dt) anima.
import * as THREE from 'three';
import { getGlowTexture } from './dungeon/builder.js';

function glowSprite(color, size, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getGlowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity,
  }));
  s.scale.setScalar(size);
  return s;
}
const bright = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });

// Anel de runas (traços em volta de um círculo).
function runeRing(color, r, n = 10) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(new THREE.RingGeometry(r * 0.92, r, 40), mat));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.12, r * 0.24), mat);
    m.position.set(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, 0);
    m.rotation.z = a + (i % 2 ? 0.5 : -0.3);
    g.add(m);
  }
  return g;
}

export function makeWeaponFx(kind, tip = 1) {
  const g = new THREE.Group();
  g.position.y = tip;
  const ticks = [];
  let t = Math.random() * 10;
  switch (kind) {
    case 'arcane': { // Cajado Arcano: cristal roxo flutuando + anel de runas girando
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), bright(0xe6c8ff));
      crystal.scale.set(1, 1.6, 1);
      crystal.position.y = 0.12;
      const halo = glowSprite(0xb070ff, 1.3);
      halo.position.y = 0.12;
      const ring = runeRing(0xc890ff, 0.42);
      ring.position.y = 0.12;
      g.add(crystal, halo, ring);
      ticks.push((dt) => {
        crystal.rotation.y += dt * 2;
        crystal.position.y = halo.position.y = 0.12 + Math.sin(t * 3) * 0.05;
        ring.rotation.x = Math.PI / 2 + Math.sin(t) * 0.3; ring.rotation.z += dt * 1.2;
        halo.material.opacity = 0.75 + 0.25 * Math.sin(t * 5);
      });
      break;
    }
    case 'star': { // Varinha Estelar: estrela dourada na ponta + brilhinhos girando
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.07 : 0.17;
        if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      const star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false }), bright(0xfff2a0));
      star.position.y = 0.1;
      const halo = glowSprite(0xffd84a, 0.9);
      halo.position.y = 0.1;
      g.add(star, halo);
      const dots = [];
      for (let i = 0; i < 4; i++) { const d = glowSprite(0xfff6c0, 0.18); g.add(d); dots.push(d); }
      ticks.push((dt) => {
        star.rotation.y += dt * 3;
        dots.forEach((d, i) => {
          const a = t * 3 + (i / dots.length) * Math.PI * 2;
          d.position.set(Math.cos(a) * 0.28, 0.1 + Math.sin(a * 2) * 0.1, Math.sin(a) * 0.28);
        });
        halo.material.opacity = 0.7 + 0.3 * Math.sin(t * 9);
      });
      break;
    }
    case 'tome': { // Grimório: círculo verde de runas em pé sobre o livro + páginas brilhando
      const ring = runeRing(0x4dff9a, 0.55, 12);
      ring.position.set(0, 0, 0.35);
      const inner = runeRing(0x9dffc8, 0.3, 6);
      inner.position.set(0, 0, 0.35);
      const pages = glowSprite(0x4dff9a, 1.1);
      pages.position.z = 0.1;
      g.add(ring, inner, pages);
      ticks.push((dt) => {
        ring.rotation.z += dt * 0.9; inner.rotation.z -= dt * 1.6;
        pages.material.opacity = 0.6 + 0.3 * Math.sin(t * 4);
      });
      break;
    }
    case 'ice': { // Cajado de Gelo: 3 lascas de gelo + névoa azul
      const mat = new THREE.MeshStandardMaterial({ color: 0xbff0ff, emissive: 0x6fd8ff, emissiveIntensity: 0.9, transparent: true, opacity: 0.88, roughness: 0.15 });
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 5), mat);
        const a = (i / 3) * Math.PI * 2;
        c.position.set(Math.cos(a) * 0.07, 0.18, Math.sin(a) * 0.07);
        c.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
        g.add(c);
      }
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), mat);
      core.position.y = 0.32;
      core.scale.set(1, 1.8, 1);
      const halo = glowSprite(0x8fe3ff, 1.2);
      halo.position.y = 0.25;
      g.add(core, halo);
      const flakes = [];
      for (let i = 0; i < 5; i++) { const d = glowSprite(0xe8fbff, 0.12); g.add(d); flakes.push({ d, o: Math.random() * 3 }); }
      ticks.push((dt) => {
        core.rotation.y += dt * 1.4;
        halo.material.opacity = 0.65 + 0.2 * Math.sin(t * 2.5);
        flakes.forEach((f) => {
          const k = (t * 0.6 + f.o) % 1;
          f.d.position.set(Math.sin(f.o * 5 + t) * 0.25, 0.2 - k * 0.6, Math.cos(f.o * 7 + t) * 0.25);
          f.d.material.opacity = 1 - k;
        });
      });
      break;
    }
    case 'fire': { // Cajado de Fogo: chama na ponta (tremendo) + brasas subindo
      const flames = [];
      const cols = [0xff3a0a, 0xff7a1a, 0xffd060];
      cols.forEach((c, i) => { const f = glowSprite(c, 0.9 - i * 0.22); f.position.y = 0.12 + i * 0.1; g.add(f); flames.push(f); });
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), bright(0xfff0b0));
      core.position.y = 0.12;
      g.add(core);
      const embers = [];
      for (let i = 0; i < 6; i++) { const e = glowSprite(0xff9a3c, 0.1); g.add(e); embers.push({ e, o: Math.random() }); }
      ticks.push(() => {
        flames.forEach((f, i) => {
          const k = 1 + 0.25 * Math.sin(t * (13 + i * 4) + i) + 0.1 * Math.sin(t * 31);
          f.scale.set((0.9 - i * 0.22) * k * 0.85, (0.9 - i * 0.22) * k * 1.25, 1);
        });
        embers.forEach((m) => {
          const k = (t * 0.9 + m.o) % 1;
          m.e.position.set(Math.sin(m.o * 20 + t * 2) * 0.12 * (1 + k), 0.15 + k * 0.9, Math.cos(m.o * 13) * 0.12);
          m.e.material.opacity = 1 - k;
        });
      });
      break;
    }
    default: break;
  }
  g.userData.tick = (dt) => { t += dt; for (const f of ticks) f(dt); };
  return g;
}

// Pinta o modelo da arma (multiplica a cor) — ex.: cajado de gelo bem claro, cajado de fogo escuro.
export function tintWeapon(obj, color) {
  obj.traverse((o) => {
    if (!o.isMesh || o.userData.fxPart) return;
    o.material = o.material.clone();
    o.material.color = new THREE.Color(color);
  });
}

// Anima todos os enfeites dentro de um objeto.
export function tickWeaponFx(obj, dt) {
  if (!obj || !obj.userData.fx) return;
  obj.userData.fx.userData.tick(dt);
}
