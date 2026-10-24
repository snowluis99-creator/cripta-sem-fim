// Efeitos visuais simples e baratos: onda de choque, faíscas, poeira, clarão.
import * as THREE from 'three';

function softCircleTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Anel desenhado em textura (borda clara, centro vazio).
function ringTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 20, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,200,120,0)');
  grad.addColorStop(0.7, 'rgba(255,170,70,0.35)');
  grad.addColorStop(0.88, 'rgba(255,235,180,1)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Vfx {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.sparkTex = softCircleTexture('rgba(255,240,190,1)', 'rgba(255,120,20,0)');
    this.dustTex = softCircleTexture('rgba(200,180,160,0.7)', 'rgba(120,100,90,0)');
    this.ringTex = ringTexture();
    this.iceTex = softCircleTexture('rgba(150,220,255,0.9)', 'rgba(60,140,255,0)');
    this.ringGeo = new THREE.PlaneGeometry(1, 1);
    // Uma luz reaproveitada para os clarões (não cria luzes novas durante o jogo).
    this.flash = new THREE.PointLight(0xffa040, 0, 9, 1.6);
    scene.add(this.flash);
    this.flashTime = 0;
  }

  add(obj, life, tick) {
    this.scene.add(obj);
    this.items.push({ obj, life, age: 0, tick });
  }

  sprite(tex, additive = true) {
    return new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
  }

  // Golpe pesado: onda de choque no chão + faíscas + clarão.
  heavyImpact(pos, scale = 1) {
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
      map: this.ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.25, pos.z); // um pouco acima do piso (os pisos têm relevo)
    this.add(ring, 0.35, (o, k) => {
      o.scale.setScalar((0.6 + 4.2 * (1 - (1 - k) ** 3)) * scale);
      o.material.opacity = 1 - k;
    });
    for (let i = 0; i < 14; i++) {
      const s = this.sprite(this.sparkTex);
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 6;
      const vel = new THREE.Vector3(Math.cos(a) * sp, 3 + Math.random() * 5, Math.sin(a) * sp);
      s.position.set(pos.x, 0.6, pos.z);
      const size = 0.4 + Math.random() * 0.4;
      this.add(s, 0.3 + Math.random() * 0.25, (o, k, dt) => {
        vel.y -= 22 * dt;
        o.position.addScaledVector(vel, dt);
        if (o.position.y < 0.1) { o.position.y = 0.1; vel.y *= -0.3; }
        o.scale.setScalar(size * (1 - k * 0.7));
        o.material.opacity = 1 - k;
      });
    }
    // Clarão no ponto do impacto (brilho grande que some rápido).
    const burst = this.sprite(this.sparkTex);
    burst.position.set(pos.x, 0.8, pos.z);
    this.add(burst, 0.22, (o, k) => {
      o.scale.setScalar(1.5 + 2.5 * k);
      o.material.opacity = 1 - k;
    });
    this.flash.position.set(pos.x, 1.5, pos.z);
    this.flashTime = 0.18;
  }

  // Poeira no chão (começo e fim do rolamento).
  dust(pos, dir, count = 6) {
    for (let i = 0; i < count; i++) {
      const s = this.sprite(this.dustTex, false);
      const vel = new THREE.Vector3(
        -dir.x * 1.5 + (Math.random() - 0.5) * 3, 0.6 + Math.random(), -dir.z * 1.5 + (Math.random() - 0.5) * 3);
      s.position.set(pos.x + (Math.random() - 0.5) * 0.6, 0.3, pos.z + (Math.random() - 0.5) * 0.6);
      const size = 0.6 + Math.random() * 0.5;
      this.add(s, 0.45 + Math.random() * 0.2, (o, k, dt) => {
        o.position.addScaledVector(vel, dt);
        vel.multiplyScalar(1 - 4 * dt);
        o.scale.setScalar(size * (1 + k * 1.2));
        o.material.opacity = 0.55 * (1 - k);
      });
    }
  }

  // Faíscas pequenas no ponto do golpe.
  sparks(pos, color = 0xffffff, count = 6) {
    for (let i = 0; i < count; i++) {
      const s = this.sprite(this.sparkTex);
      s.material.color.setHex(color);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 9, 1 + Math.random() * 5, (Math.random() - 0.5) * 9);
      s.position.copy(pos);
      const size = 0.25 + Math.random() * 0.25;
      this.add(s, 0.18 + Math.random() * 0.15, (o, k, dt) => {
        vel.y -= 20 * dt;
        o.position.addScaledVector(vel, dt);
        o.scale.setScalar(size * (1 - k * 0.6));
        o.material.opacity = 1 - k;
      });
    }
    const burst = this.sprite(this.sparkTex);
    burst.material.color.setHex(color);
    burst.position.copy(pos);
    this.add(burst, 0.12, (o, k) => { o.scale.setScalar(0.8 + 1.4 * k); o.material.opacity = 1 - k; });
  }

  // Nuvem de poeira em volta (esqueleto virando ossos).
  puff(pos) {
    for (let i = 0; i < 10; i++) {
      const s = this.sprite(this.dustTex, false);
      const a = (i / 10) * Math.PI * 2;
      const vel = new THREE.Vector3(Math.cos(a) * 2.5, 0.5 + Math.random() * 1.5, Math.sin(a) * 2.5);
      s.position.set(pos.x, 0.5 + Math.random() * 0.8, pos.z);
      const size = 0.9 + Math.random() * 0.6;
      this.add(s, 0.5 + Math.random() * 0.3, (o, k, dt) => {
        o.position.addScaledVector(vel, dt);
        vel.multiplyScalar(1 - 3 * dt);
        o.scale.setScalar(size * (1 + k));
        o.material.opacity = 0.6 * (1 - k);
      });
    }
  }

  // Círculo roxo no chão avisando onde um esqueleto vai nascer.
  spawnMarker(pos, life) {
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
      map: this.ringTex, color: 0xb070ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.22, pos.z);
    this.add(ring, life, (o, k) => {
      o.scale.setScalar(2.6 - k * 0.8);
      o.material.opacity = Math.min(1, k * 4) * (0.6 + 0.4 * Math.sin(k * 30));
    });
  }

  // Poça de gelo (Rastro de Gelo) no chão.
  ice(pos, r, life) {
    const disc = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
      map: this.iceTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    disc.rotation.x = -Math.PI / 2;
    disc.rotation.z = Math.random() * 6;
    disc.position.set(pos.x, 0.2, pos.z);
    disc.scale.setScalar(r * 2.2);
    this.add(disc, life, (o, k) => { o.material.opacity = Math.min(1, k * 8) * (1 - k * k) * 0.8; });
  }

  // Anel subindo em volta de um ponto (cura, bênção).
  burst(pos, color) {
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
      map: this.ringTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.25, pos.z);
    this.add(ring, 0.6, (o, k) => { o.scale.setScalar(1 + 4 * k); o.position.y = 0.25 + k * 1.5; o.material.opacity = 1 - k; });
    this.sparks(new THREE.Vector3(pos.x, 1.2, pos.z), color, 14);
  }

  // Raio em zigue-zague entre dois pontos (Corrente de Raios).
  bolt(a, b, color = 0xbfe6ff) {
    const pts = [];
    const n = 7;
    for (let i = 0; i <= n; i++) {
      const p = a.clone().lerp(b, i / n);
      if (i > 0 && i < n) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.7));
      pts.push(p);
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.add(line, 0.22, (o, k) => { o.material.opacity = 1 - k; });
    this.sparks(b, color, 6);
  }

  // Fumaça roxa (Necromante sumindo/aparecendo, Mago revivendo).
  smoke(pos, color = 0x9a40ff, count = 14) {
    for (let i = 0; i < count; i++) {
      const s = this.sprite(this.dustTex, true);
      s.material.color.setHex(color);
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.5;
      const vel = new THREE.Vector3(Math.cos(a) * sp, 1 + Math.random() * 2.5, Math.sin(a) * sp);
      s.position.set(pos.x, 0.4 + Math.random() * 1.6, pos.z);
      const size = 1.2 + Math.random() * 0.8;
      this.add(s, 0.6 + Math.random() * 0.3, (o, k, dt) => {
        o.position.addScaledVector(vel, dt);
        vel.multiplyScalar(1 - 2.5 * dt);
        o.scale.setScalar(size * (1 + k));
        o.material.opacity = 0.9 * (1 - k);
      });
    }
  }

  // Feixe subindo de um ponto (revivendo um esqueleto).
  beam(pos, color = 0x7dff8a) {
    const geo = new THREE.CylinderGeometry(0.5, 0.8, 6, 12, 1, true);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.position.set(pos.x, 3, pos.z);
    this.add(m, 0.9, (o, k) => { o.material.opacity = 0.6 * (1 - k); o.scale.set(1 - k * 0.6, 1, 1 - k * 0.6); });
  }

  // Raio reto de magia (Grimório): feixe brilhante de a até b que afina e some.
  beamLine(a, b, color = 0x4dff9a, width = 0.8) {
    const len = a.distanceTo(b);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const mk = (w, c, op) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(w, w, len, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.position.copy(mid);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      return m;
    };
    this.add(mk(width * 0.5, color, 0.55), 0.32, (o, k) => { o.material.opacity = 0.55 * (1 - k); o.scale.set(1 + k, 1, 1 + k); });
    this.add(mk(width * 0.16, 0xffffff, 1), 0.22, (o, k) => { o.material.opacity = 1 - k; o.scale.set(1 - k * 0.8, 1, 1 - k * 0.8); });
    for (let i = 0; i < 8; i++) this.sparks(a.clone().lerp(b, Math.random()), color, 1);
    this.sparks(b, color, 6);
  }

  // Sopro de fogo em cone (Cajado de Fogo): chamas saindo do herói na direção do ângulo.
  flameCone(pos, angle, range, half, color = 0xff7a2a, big = false) {
    const n = big ? 26 : 16;
    for (let i = 0; i < n; i++) {
      const s = this.sprite(this.sparkTex);
      const a = angle + (Math.random() * 2 - 1) * half;
      const sp = range * (2.4 + Math.random() * 1.2);
      const vel = new THREE.Vector3(Math.sin(a) * sp, 0.6 + Math.random() * 1.2, Math.cos(a) * sp);
      s.material.color.setHex(Math.random() < 0.35 ? 0xffd060 : color);
      s.position.set(pos.x + Math.sin(angle) * 0.6, pos.y, pos.z + Math.cos(angle) * 0.6);
      const size = (big ? 1.1 : 0.8) + Math.random() * 0.5;
      this.add(s, 0.3 + Math.random() * 0.12, (o, k, dt) => {
        o.position.addScaledVector(vel, dt);
        vel.multiplyScalar(1 - 2.5 * dt);
        o.scale.setScalar(size * (0.5 + k * 1.6));
        o.material.opacity = (1 - k) * 0.95;
      });
    }
  }

  // Anel colorido que se abre no chão (explosão de magia).
  ring(pos, color, radius = 2) {
    const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
      map: this.ringTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.3, pos.z);
    this.add(ring, 0.4, (o, k) => { o.scale.setScalar(radius * 2.2 * (0.3 + 0.7 * (1 - (1 - k) ** 2))); o.material.opacity = 1 - k; });
  }

  // Remove tudo (troca de sala).
  clear() {
    for (const it of this.items) { this.scene.remove(it.obj); it.obj.material.dispose(); }
    this.items.length = 0;
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      const k = Math.min(it.age / it.life, 1);
      it.tick(it.obj, k, dt);
      if (k >= 1) {
        this.scene.remove(it.obj);
        it.obj.material.dispose();
        this.items.splice(i, 1);
      }
    }
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.flash.intensity = Math.max(0, this.flashTime / 0.18) * 30;
    } else this.flash.intensity = 0;
  }
}
