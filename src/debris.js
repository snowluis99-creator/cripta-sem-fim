// Pedaços que voam e quicam no chão: ossos do esqueleto e a arma que ele solta ao morrer.
import * as THREE from 'three';
import { instance } from './assets.js';

export const DEBRIS_MODELS = ['props/crypt/bone_A.gltf', 'props/crypt/bone_B.gltf', 'props/crypt/bone_C.gltf',
  'props/crypt/skull.gltf', 'props/crypt/ribcage.gltf'];

const GRAVITY = 26;
const LIFE = 6;      // segundos no chão antes de afundar
const SINK = 0.8;

export class Debris {
  constructor(scene) {
    this.scene = scene;
    this.pieces = [];
  }

  // obj já posicionado no mundo. rest = rotação final (deitado no chão).
  add(obj, vel, spin, rest = { x: 0, z: 0 }, ground = 0, life = LIFE) {
    this.scene.add(obj);
    this.pieces.push({ obj, vel, spin, rest, ground, age: 0, settled: false, life });
  }

  // Esqueleto se desmontando: crânio, costelas e ossos voando a partir de pos.
  // opts: { y (altura de onde saem), scale } — corpo do chefe desmontando.
  skeleton(pos, dirX, dirZ, big = false, opts = {}) {
    const list = ['props/crypt/skull.gltf', 'props/crypt/ribcage.gltf', 'props/crypt/bone_A.gltf',
      'props/crypt/bone_B.gltf', 'props/crypt/bone_C.gltf', 'props/crypt/bone_A.gltf'];
    const scale = { 'props/crypt/skull.gltf': 0.75, 'props/crypt/ribcage.gltf': 0.85 };
    for (const path of list) {
      const o = instance(path);
      o.scale.setScalar((scale[path] || 1) * (big ? 1.15 : 1) * (opts.scale || 1));
      o.position.set(pos.x + (Math.random() - 0.5) * 0.6, (opts.y ?? 0.8) + Math.random() * 0.8, pos.z + (Math.random() - 0.5) * 0.6);
      o.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3;
      const vel = new THREE.Vector3(Math.cos(a) * sp + dirX * 3, 4 + Math.random() * 4, Math.sin(a) * sp + dirZ * 3);
      const spin = new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 16);
      this.add(o, vel, spin, { x: 0, z: 0 });
    }
  }

  // Solta um objeto preso ao esqueleto (arma/escudo) e deixa cair.
  drop(obj, dirX, dirZ) {
    this.scene.attach(obj); // mantém a posição no mundo
    const vel = new THREE.Vector3(dirX * 2 + (Math.random() - 0.5) * 2, 3 + Math.random() * 2, dirZ * 2 + (Math.random() - 0.5) * 2);
    const spin = new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 10);
    // Armas ficam em pé no modelo: deitadas = 90° em x.
    this.add(obj, vel, spin, { x: -Math.PI / 2, z: 0 }, 0.12);
  }

  update(dt) {
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      const o = p.obj;
      p.age += dt;
      if (!p.settled) {
        p.vel.y -= GRAVITY * dt;
        o.position.addScaledVector(p.vel, dt);
        o.rotation.x += p.spin.x * dt; o.rotation.y += p.spin.y * dt; o.rotation.z += p.spin.z * dt;
        if (o.position.y <= p.ground) {
          o.position.y = p.ground;
          if (Math.abs(p.vel.y) < 2.5) p.settled = true;
          p.vel.y *= -0.35; p.vel.x *= 0.5; p.vel.z *= 0.5;
          p.spin.multiplyScalar(0.5);
        }
      } else {
        // No chão: escorrega um pouco e deita.
        o.position.x += p.vel.x * dt; o.position.z += p.vel.z * dt;
        p.vel.multiplyScalar(Math.exp(-8 * dt));
        const k = 1 - Math.exp(-14 * dt);
        o.rotation.x += (nearest(o.rotation.x, p.rest.x) - o.rotation.x) * k;
        o.rotation.z += (nearest(o.rotation.z, p.rest.z) - o.rotation.z) * k;
        o.position.y += (p.ground - o.position.y) * k;
      }
      if (p.age > p.life) {
        o.position.y -= (0.9 / SINK) * dt; // afunda no chão
        if (p.age > p.life + SINK) { this.scene.remove(o); this.pieces.splice(i, 1); }
      }
    }
  }

  clear() {
    for (const p of this.pieces) this.scene.remove(p.obj);
    this.pieces.length = 0;
  }
}

// Ângulo equivalente a "rest" mais perto do ângulo atual (para não girar voltas inteiras).
function nearest(cur, rest) {
  const tau = Math.PI * 2;
  return rest + Math.round((cur - rest) / tau) * tau;
}
