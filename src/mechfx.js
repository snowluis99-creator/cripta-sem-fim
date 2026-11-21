// Forma Final (robô gigante): efeitos próprios — rachaduras no chão, pilares de luz, pedras voando, runa de
// pouso, raio do céu, rastro da espada, fenda de energia e a explosão final. Tudo passa pelo vfx do jogo
// (vfx.add), então some sozinho na troca de sala.
import * as THREE from 'three';

const GOLD = 0xffc850, HOT = 0xfff0c0, EMBER = 0xff7a1e;
const rnd = (a, b) => a + Math.random() * (b - a);

function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Rachaduras: linhas quebradas que saem do centro e se dividem.
function crackTexture(seed) {
  let s = seed * 9301 + 49297;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return canvasTex(256, (g, S) => {
    g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
    const branch = (x, y, a, len, w, depth) => {
      g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
      const n = 4 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        a += (r() - 0.5) * 0.9; x += Math.cos(a) * len / n; y += Math.sin(a) * len / n; g.lineTo(x, y);
        if (depth > 0 && r() < 0.42) { g.stroke(); branch(x, y, a + (r() < 0.5 ? 1 : -1) * (0.5 + r() * 0.6), len * 0.55, w * 0.6, depth - 1); g.lineWidth = w; g.beginPath(); g.moveTo(x, y); }
      }
      g.stroke();
    };
    const n = 7 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) branch(S / 2, S / 2, (i / n) * Math.PI * 2 + r() * 0.5, S * (0.3 + r() * 0.16), 5.5, 2);
    const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.2);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    // some na borda
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.5);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(0, 0, S, S);
  });
}

function runeTexture() {
  return canvasTex(256, (g, S) => {
    const c = S / 2;
    g.strokeStyle = '#fff'; g.fillStyle = '#fff';
    for (const [rad, w] of [[122, 5], [108, 2], [70, 3]]) { g.lineWidth = w; g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); g.stroke(); }
    g.lineWidth = 3;
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r0 = i % 2 ? 110 : 108, r1 = i % 2 ? 118 : 122; g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); g.stroke(); }
    for (const off of [0, Math.PI / 4]) { g.beginPath(); for (let i = 0; i <= 4; i++) { const a = off + (i / 4) * Math.PI * 2; g.lineTo(c + Math.cos(a) * 106, c + Math.sin(a) * 106); } g.stroke(); }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; g.beginPath(); g.arc(c + Math.cos(a) * 88, c + Math.sin(a) * 88, 7, 0, Math.PI * 2); g.fill(); }
    // espada no meio
    g.beginPath(); g.moveTo(c, c - 58); g.lineTo(c + 9, c - 40); g.lineTo(c + 7, c + 22); g.lineTo(c - 7, c + 22); g.lineTo(c - 9, c - 40); g.closePath(); g.fill();
    g.fillRect(c - 26, c + 22, 52, 8); g.fillRect(c - 4, c + 30, 8, 22); g.beginPath(); g.arc(c, c + 56, 7, 0, Math.PI * 2); g.fill();
  });
}

function beamTexture() { // claro embaixo, some em cima
  return canvasTex(64, (g, S) => {
    const gr = g.createLinearGradient(0, S, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
}

function ringTexture() { // anel fino e forte
  return canvasTex(128, (g, S) => {
    const gr = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.72, 'rgba(255,255,255,0.12)'); gr.addColorStop(0.9, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
}

function arcTexture() { // meia-lua do corte (claro na borda de fora)
  return canvasTex(128, (g, S) => {
    const gr = g.createRadialGradient(S / 2, S / 2, S * 0.12, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.8, 'rgba(255,255,255,0.2)'); gr.addColorStop(0.94, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  });
}

let TEX = null;
const tex = () => TEX || (TEX = { cracks: [crackTexture(1), crackTexture(2), crackTexture(3)], rune: runeTexture(), beam: beamTexture(), ring: ringTexture(), arc: arcTexture() });

export class MechFx {
  constructor(vfx) {
    this.vfx = vfx;
    this.plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.tube = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).translate(0, 0.5, 0);
    this.rock = new THREE.DodecahedronGeometry(0.5, 0);
    this.arcGeo = {};
  }
  flat(map, color, additive = true, opacity = 1) {
    return new THREE.Mesh(this.plane, new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
  }

  // Chão rachado: marca escura que fica uns segundos + brilho dourado que apaga rápido.
  crack(x, z, r, life = 5, glowColor = GOLD) {
    const T = tex(), map = T.cracks[Math.floor(Math.random() * T.cracks.length)], rot = Math.random() * Math.PI * 2;
    const d = this.flat(map, 0x050403, false, 0.9); d.position.set(x, 0.07, z); d.rotation.y = rot; d.scale.setScalar(r * 2); d.renderOrder = 1;
    this.vfx.add(d, life, (o, k) => { o.material.opacity = 0.9 * (1 - Math.max(0, (k - 0.6) / 0.4)); });
    const gl = this.flat(map, glowColor); gl.position.set(x, 0.09, z); gl.rotation.y = rot; gl.scale.setScalar(r * 2); gl.renderOrder = 2;
    this.vfx.add(gl, Math.min(life, 1.3), (o, k) => { o.material.opacity = (1 - k) ** 1.5; });
  }

  // Anel de choque largo.
  shock(x, z, r, color = GOLD, life = 0.5, y = 0.2) {
    const m = this.flat(tex().ring, color); m.position.set(x, y, z);
    this.vfx.add(m, life, (o, k) => { o.scale.setScalar(r * 2 * (0.15 + 0.85 * (1 - (1 - k) ** 3))); o.material.opacity = (1 - k) ** 1.2; });
  }

  // Pilar de luz que sobe do chão.
  pillar(x, z, h, w, color = GOLD, life = 0.45) {
    const m = new THREE.Mesh(this.tube, new THREE.MeshBasicMaterial({ map: tex().beam, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.position.set(x, 0.05, z);
    this.vfx.add(m, life, (o, k) => { const up = Math.min(1, k * 5); o.scale.set(w * (1 - k * 0.75), h * up, w * (1 - k * 0.75)); o.material.opacity = 1 - k * k; });
  }

  // Pedras do chão voando.
  rocks(x, z, n = 10, power = 1) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.rock, new THREE.MeshLambertMaterial({ color: Math.random() < 0.5 ? 0x4a4650 : 0x35323a, transparent: true }));
      const a = Math.random() * Math.PI * 2, sp = rnd(3, 9) * power, s = rnd(0.18, 0.55);
      const vel = new THREE.Vector3(Math.cos(a) * sp, rnd(6, 13) * power, Math.sin(a) * sp), spin = new THREE.Vector3(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8));
      m.position.set(x + Math.cos(a) * rnd(0, 0.8), 0.2, z + Math.sin(a) * rnd(0, 0.8)); m.scale.set(s, s * rnd(0.6, 1), s);
      this.vfx.add(m, rnd(0.9, 1.5), (o, k, dt) => {
        vel.y -= 30 * dt; o.position.addScaledVector(vel, dt);
        if (o.position.y < 0.12) { o.position.y = 0.12; vel.y *= -0.35; vel.x *= 0.6; vel.z *= 0.6; }
        o.rotation.x += spin.x * dt; o.rotation.y += spin.y * dt; o.rotation.z += spin.z * dt;
        o.material.opacity = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      });
    }
  }

  // Brasas subindo.
  embers(pos, n = 8, spread = 1, color = GOLD, up = 3) {
    for (let i = 0; i < n; i++) {
      const s = this.vfx.sprite(this.vfx.sparkTex); s.material.color.setHex(color);
      s.position.set(pos.x + rnd(-spread, spread), pos.y + rnd(-0.3, 0.6), pos.z + rnd(-spread, spread));
      const vel = new THREE.Vector3(rnd(-0.8, 0.8), rnd(up * 0.5, up * 1.4), rnd(-0.8, 0.8)), size = rnd(0.14, 0.34), ph = Math.random() * 6;
      this.vfx.add(s, rnd(0.6, 1.3), (o, k, dt) => { o.position.addScaledVector(vel, dt); o.position.x += Math.sin(ph + k * 9) * dt * 0.8; o.scale.setScalar(size * (1 - k * 0.5)); o.material.opacity = 1 - k * k; });
    }
  }

  // Vapor (escapamento, juntas).
  steam(pos, dir, n = 3, size = 1) {
    for (let i = 0; i < n; i++) {
      const s = this.vfx.sprite(this.vfx.dustTex, false);
      s.position.copy(pos);
      const vel = new THREE.Vector3(dir.x + rnd(-0.5, 0.5), dir.y + rnd(0.2, 1), dir.z + rnd(-0.5, 0.5)).multiplyScalar(rnd(1.2, 2.4)), sz = rnd(0.7, 1.3) * size;
      this.vfx.add(s, rnd(0.6, 1.0), (o, k, dt) => { o.position.addScaledVector(vel, dt); vel.multiplyScalar(Math.exp(-2 * dt)); o.scale.setScalar(sz * (0.5 + k * 1.6)); o.material.opacity = 0.55 * (1 - k); });
    }
  }

  // Fumaça escura grossa (explosões).
  smoke(pos, n = 8, size = 1) {
    for (let i = 0; i < n; i++) {
      const s = this.vfx.sprite(this.vfx.dustTex, false); s.material.color.setHex(0x2a2622);
      s.position.set(pos.x + rnd(-1, 1) * size, pos.y + rnd(0, 1.5) * size, pos.z + rnd(-1, 1) * size);
      const vel = new THREE.Vector3(rnd(-1, 1), rnd(1.5, 4), rnd(-1, 1)), sz = rnd(1.5, 3) * size;
      this.vfx.add(s, rnd(1.2, 2.2), (o, k, dt) => { o.position.addScaledVector(vel, dt); vel.multiplyScalar(Math.exp(-1.2 * dt)); o.scale.setScalar(sz * (0.6 + k * 1.5)); o.material.opacity = 0.75 * (1 - k) * Math.min(1, k * 8); });
    }
  }

  // Clarão redondo.
  flare(pos, size, color = HOT, life = 0.3) {
    const s = this.vfx.sprite(this.vfx.sparkTex); s.material.color.setHex(color); s.position.copy(pos);
    this.vfx.add(s, life, (o, k) => { o.scale.setScalar(size * (0.5 + k * 0.9)); o.material.opacity = (1 - k) ** 1.4; });
    this.vfx.flash.position.set(pos.x, pos.y + 1, pos.z); this.vfx.flashTime = 0.18;
  }

  // Runa dourada no chão (ponto de pouso): cresce, gira e some.
  rune(x, z, r, life) {
    const m = this.flat(tex().rune, GOLD); m.position.set(x, 0.1, z);
    this.vfx.add(m, life, (o, k, dt) => {
      const grow = Math.min(1, k * 4); o.scale.setScalar(r * 2 * (1 - (1 - grow) ** 3)); o.rotation.y += dt * (1.2 + k * 5);
      o.material.opacity = k > 0.85 ? (1 - k) / 0.15 : 0.55 + 0.45 * Math.sin(k * 40);
    });
    const m2 = this.flat(tex().ring, HOT); m2.position.set(x, 0.12, z);
    this.vfx.add(m2, life, (o, k) => { o.scale.setScalar(r * 2.3 * (1 - (k * 3 % 1) * 0.9)); o.material.opacity = 0.7 * (k * 3 % 1); });
  }

  // Coluna de luz do céu.
  skyBeam(x, z, w, life, color = GOLD) {
    const mk = (ww, c, op) => {
      const m = new THREE.Mesh(this.tube, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.position.set(x, 0, z);
      this.vfx.add(m, life, (o, k) => { const kk = Math.min(1, k * 6) * (1 - Math.max(0, (k - 0.7) / 0.3)); o.scale.set(ww * kk * (0.9 + 0.1 * Math.sin(k * 90)), 60, ww * kk); o.material.opacity = op * kk; });
    };
    mk(w, color, 0.35); mk(w * 0.45, HOT, 0.7);
  }

  // Meia-lua no chão acompanhando o corte (dir = +1 da direita para a esquerda).
  slash(x, z, facing, range, half, dir, color = GOLD) {
    const key = Math.round(half * 100);
    const geo = this.arcGeo[key] || (this.arcGeo[key] = (() => {
      const g = new THREE.RingGeometry(0.18, 1, 40, 1, Math.PI / 2 - half, half * 2).rotateX(-Math.PI / 2);
      const p = g.attributes.position, uv = g.attributes.uv; // uv radial: casa com a textura redonda
      for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) * 0.5, 0.5 - p.getZ(i) * 0.5);
      return g;
    })());
    for (const [c, y, sc, op, life] of [[color, 0.22, 1, 0.95, 0.36], [HOT, 0.26, 0.96, 0.55, 0.2]]) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex().arc, color: c, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.rotation.y = facing;
      this.vfx.add(m, life, (o, k) => { o.scale.setScalar(range * sc * (0.82 + 0.22 * (1 - (1 - k) ** 2))); o.rotation.y = facing + dir * 0.25 * k; o.material.opacity = op * (1 - k) ** 1.3; });
    }
  }

  // Fenda de energia: corre em linha reta abrindo o chão, com pilares de luz em sequência.
  fissure(x, z, ang, len, onStep) {
    const fx = Math.sin(ang), fz = Math.cos(ang), n = Math.max(3, Math.round(len / 1.5));
    let done = 0;
    const ctl = new THREE.Object3D();
    this.vfx.add(ctl, 0.32, (o, k) => {
      const upto = Math.floor(k * n + 0.001);
      while (done < upto && done < n) {
        const d = (done + 0.6) * (len / n), px = x + fx * d + rnd(-0.3, 0.3), pz = z + fz * d + rnd(-0.3, 0.3);
        this.crack(px, pz, 1.7, 5, EMBER);
        this.pillar(px, pz, rnd(4.5, 7.5), rnd(0.9, 1.4), done % 2 ? HOT : GOLD, 0.5);
        this.rocks(px, pz, 3, 0.8);
        this.vfx.sparks(new THREE.Vector3(px, 0.6, pz), GOLD, 5);
        if (onStep) onStep(px, pz, done);
        done++;
      }
    });
    // Risco aceso no chão ao longo da fenda.
    const line = new THREE.Mesh(this.plane, new THREE.MeshBasicMaterial({ color: HOT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    line.position.set(x + fx * len / 2, 0.11, z + fz * len / 2); line.rotation.y = ang;
    this.vfx.add(line, 0.9, (o, k) => { const kk = Math.min(1, k * 3.2); o.scale.set(0.45 * (1 - k), 1, len * kk); o.position.set(x + fx * len * kk / 2, 0.11, z + fz * len * kk / 2); o.material.opacity = 1 - k; });
  }

  // Impacto grande (pouso, golpe de cima, pancada): rachadura + anéis + pedras + clarão.
  impact(x, z, scale = 1, color = GOLD) {
    this.crack(x, z, 3.2 * scale, 6, color);
    this.shock(x, z, 5.5 * scale, color, 0.5);
    this.shock(x, z, 3.5 * scale, HOT, 0.32, 0.26);
    this.rocks(x, z, Math.round(10 * scale), 0.9 + scale * 0.2);
    this.vfx.heavyImpact(new THREE.Vector3(x, 0, z), 1.6 * scale);
    this.flare(new THREE.Vector3(x, 1.2, z), 7 * scale);
    this.vfx.dust(new THREE.Vector3(x, 0, z), new THREE.Vector3(0, 1, 0), 10);
  }

  // Explosão (bola de fogo + fumaça + faíscas).
  explosion(pos, scale = 1) {
    this.flare(pos, 6 * scale, HOT, 0.28);
    this.flare(pos, 4 * scale, EMBER, 0.5);
    this.vfx.sparks(pos, GOLD, Math.round(14 * scale));
    this.vfx.sparks(pos, EMBER, Math.round(10 * scale));
    this.smoke(pos, Math.round(4 * scale), scale * 0.7);
  }
}

// Rastro da espada: fita de luz entre a base e a ponta da lâmina, nos últimos quadros.
export function makeTrail(scene, n = 26) {
  const pos = new Float32Array(n * 2 * 3), col = new Float32Array(n * 2 * 3), idx = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.visible = false;
  scene.add(mesh);
  const pts = []; // { b, t, age }
  const LIFE = 0.26;
  return {
    mesh,
    update(dt, on, base, tip) {
      for (const p of pts) p.age += dt;
      while (pts.length && pts[pts.length - 1].age > LIFE) pts.pop();
      if (on) { pts.unshift({ b: base.clone(), t: tip.clone(), age: 0 }); if (pts.length > n) pts.pop(); }
      mesh.visible = pts.length > 1;
      if (!mesh.visible) return;
      for (let i = 0; i < n; i++) {
        const p = pts[Math.min(i, pts.length - 1)], f = i < pts.length ? (1 - p.age / LIFE) ** 1.6 : 0, o = i * 6;
        pos[o] = p.b.x; pos[o + 1] = p.b.y; pos[o + 2] = p.b.z; pos[o + 3] = p.t.x; pos[o + 4] = p.t.y; pos[o + 5] = p.t.z;
        col[o] = 1.0 * f * 0.45; col[o + 1] = 0.42 * f * 0.45; col[o + 2] = 0.08 * f * 0.45;
        col[o + 3] = 1.0 * f; col[o + 4] = 0.88 * f; col[o + 5] = 0.55 * f;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    },
    clear() { pts.length = 0; mesh.visible = false; },
    dispose() { scene.remove(mesh); geo.dispose(); mesh.material.dispose(); },
  };
}
