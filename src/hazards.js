// Perigos no chão: círculos do Guardião que prendem o herói (fica imóvel e sem defesa).
// Aparecem rápido (sem aviso piscando) e já prendem; enfurecido, o Guardião cobre 3/4 do chão.
// Depois de se soltar, o herói fica um instante sem poder ser preso de novo (não fica preso para sempre).
import * as THREE from 'three';

function circleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(120,40,200,0.35)');
  grad.addColorStop(0.7, 'rgba(150,60,255,0.45)');
  grad.addColorStop(0.86, 'rgba(225,190,255,1)');
  grad.addColorStop(1, 'rgba(120,40,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  // Runas: 6 traços em volta.
  g.strokeStyle = 'rgba(235,210,255,0.9)';
  g.lineWidth = 4;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.beginPath();
    g.moveTo(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30);
    g.lineTo(64 + Math.cos(a + 0.5) * 44, 64 + Math.sin(a + 0.5) * 44);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const geo = new THREE.PlaneGeometry(1, 1);

export class Hazards {
  constructor(scene, vfx, text) {
    Object.assign(this, { scene, vfx, text });
    this.tex = circleTexture();
    this.circles = [];
    this.onRoot = null; // teste automático
    this.bounds = null; // { halfW, halfD } da sala atual (colocado pelas ondas)
    this.world = null;
    this.time = 0;
    this.immuneUntil = 0;
  }

  // Círculos espalhados em grade cobrindo uma fração (fill) do chão da sala.
  fillSpots(cfg) {
    const { halfW, halfD } = this.bounds;
    const step = cfg.radius * 1.75, hw = halfW - 1.2, hd = halfD - 1.2;
    const nx = Math.max(1, Math.round((hw * 2) / step)), nz = Math.max(1, Math.round((hd * 2) / step));
    const sx = (hw * 2) / nx, sz = (hd * 2) / nz;
    const cells = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = -hw + sx * (i + 0.5), z = -hd + sz * (j + 0.5);
      if (this.world && this.world.blocked(x, z, 0.4)) continue;
      cells.push({ x, z });
    }
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    return cells.slice(0, Math.round(cells.length * cfg.fill));
  }

  // Normal: três círculos (um embaixo do herói e dois perto). Com cfg.fill: 3/4 do chão.
  rootCircles(p, cfg) {
    if (cfg.fill && this.bounds) { this.spawnCircles(this.fillSpots(cfg), cfg); return; }
    const spots = [{ x: p.position.x, z: p.position.z }];
    for (let i = 1; i < cfg.count; i++) {
      const a = p.facing + (i === 1 ? 0 : Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1)) + (Math.random() - 0.5) * 0.6;
      const r = 2.6 + Math.random() * 1.2;
      spots.push({ x: p.position.x + Math.sin(a) * r, z: p.position.z + Math.cos(a) * r });
    }
    this.spawnCircles(spots, cfg);
  }

  spawnCircles(spots, cfg) {
    for (const s of spots) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        map: this.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
      }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(s.x, 0.14, s.z);
      mesh.scale.setScalar(cfg.radius * 2);
      this.scene.add(mesh);
      this.circles.push({ id: s.id ?? (this.nextId = (this.nextId || 0) + 1), x: s.x, z: s.z, r: cfg.radius, t: 0, warn: cfg.warn, life: cfg.life, root: cfg.root, mesh });
    }
  }

  remove(c) {
    if (!this.circles.includes(c)) return;
    this.scene.remove(c.mesh);
    c.mesh.material.dispose();
    this.circles.splice(this.circles.indexOf(c), 1);
  }

  // players: heróis que os círculos podem prender (co-op: os dois; no computador do Jogador 2, nenhum).
  update(dt, players) {
    this.time += dt;
    if (!Array.isArray(players)) players = players ? [players] : [];
    for (const c of [...this.circles]) {
      c.t += dt;
      const m = c.mesh;
      m.rotation.z += dt * 0.8;
      if (c.t < c.warn) {
        // Surge rápido (ainda não prende).
        m.material.opacity = c.t / c.warn;
        m.scale.setScalar(c.r * 2 * (0.6 + 0.4 * c.t / c.warn));
        continue;
      }
      const left = c.warn + c.life - c.t;
      if (left <= 0) { this.remove(c); continue; }
      m.material.opacity = Math.min(1, left / 0.4) * (0.85 + 0.15 * Math.sin(c.t * 6));
      m.scale.setScalar(c.r * 2);
      for (const p of players) {
        if (p.state === 'dead' || p.state === 'dodge' || p.state === 'rooted' || this.time < (p.rootImmune || 0)) continue;
        if (Math.hypot(p.position.x - c.x, p.position.z - c.z) < c.r + p.hero.radius * 0.5) {
          p.root(c.root);
          p.rootImmune = this.time + c.root + 0.8;
          this.immuneUntil = p.rootImmune;
          this.text.add('Preso!', p.position, 'block', 3.0);
          this.vfx.burst(p.position, 0x9a40ff);
          if (this.onRoot) this.onRoot();
          this.remove(c);
          break;
        }
      }
    }
  }

  clear() { for (const c of [...this.circles]) this.remove(c); }
}
