// Colisão simples: personagens são círculos, paredes são retângulos no chão (x, z).

export class CollisionWorld {
  constructor() { this.rects = []; }

  addRect(minX, minZ, maxX, maxZ) { this.version = (this.version || 0) + 1; this.rects.push({ minX, minZ, maxX, maxZ }); }

  clear() { this.version = (this.version || 0) + 1; this.rects.length = 0; this.bounds = null; }

  // Limites da sala (parte de dentro das paredes). Ninguém pode ficar fora disso (nem com salto, investida ou cena).
  setBounds(halfW, halfD, wallHalf) { this.bounds = { x: halfW - wallHalf, z: halfD - wallHalf }; }

  // Puxa o ponto para dentro da sala (r = raio, no máximo 1, para chefes grandes não ficarem presos no meio).
  clampInside(pos, r = 0) {
    const b = this.bounds;
    if (!b) return pos;
    const m = Math.min(r, 1);
    const mx = Math.max(0, b.x - m), mz = Math.max(0, b.z - m);
    if (pos.x > mx) pos.x = mx; else if (pos.x < -mx) pos.x = -mx;
    if (pos.z > mz) pos.z = mz; else if (pos.z < -mz) pos.z = -mz;
    return pos;
  }

  // Um círculo nesse ponto encostaria em alguma parede ou obstáculo?
  blocked(x, z, r) {
    for (const b of this.rects) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
    }
    return false;
  }

  // Empurra o círculo (pos.x, pos.z, raio r) para fora de qualquer parede.
  resolveCircle(pos, r) {
    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.rects) {
        const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
        const dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x += (dx / d) * (r - d);
          pos.z += (dz / d) * (r - d);
        } else {
          // Centro dentro do retângulo: sai pelo lado mais próximo.
          const opts = [
            [pos.x - b.minX + r, -1, 0], [b.maxX - pos.x + r, 1, 0],
            [pos.z - b.minZ + r, 0, -1], [b.maxZ - pos.z + r, 0, 1],
          ].sort((a, c) => a[0] - c[0]);
          pos.x += opts[0][1] * opts[0][0];
          pos.z += opts[0][2] * opts[0][0];
        }
      }
    }
    return this.clampInside(pos, r);
  }
}
