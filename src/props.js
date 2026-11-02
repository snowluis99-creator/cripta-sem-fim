// Objetos quebráveis da sala (pedido do dono, 30/10): golpes, magias, kunais e virotes quebram barris, caixas,
// baús, cadeiras, mesas, velas, caixões... O objeto some com lascas e poeira e libera a passagem.
// Baús (trunk_*) têm 10% de chance de soltar uma poção. Qualquer um tem 10% de soltar umas moedas.
import * as THREE from 'three';
import { audio } from './audio.js';

export const CHEST_POTION_CHANCE = 0.1;
export const COIN_CHANCE = 0.1;  // qualquer quebrável: 10% de ter umas moedas dentro (pedido do dono, 31/10)
const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Breakables {
  constructor(combat) {
    this.combat = combat;
    this.list = [];
    this.world = null;
    this.onBreak = null;  // co-op: avisa o Jogador 2 (índice do objeto)
    this.onDrop = null;   // run.js: solta a poção do baú
    this.onCoins = null;  // run.js: moedas que estavam dentro do objeto
    this.rng = Math.random;
  }

  // Sala nova: liga cada objeto ao retângulo de colisão dele no mundo.
  setRoom(built, world) {
    this.world = world;
    this.list = built ? built.breakables || [] : [];
    for (const b of this.list) b.rect = b.colIdx >= 0 ? world.rects[b.colIdx] : null;
  }

  clear() { this.list = []; }

  // Golpe corpo a corpo / cone: tudo dentro do alcance e do arco (e da onda do golpe forte).
  strikeArc(p, range, arc, impact = null, blast = 0) {
    let n = 0;
    for (const b of this.list) {
      if (b.broken) continue;
      const dx = b.x - p.position.x, dz = b.z - p.position.z, d = Math.hypot(dx, dz) || 0.01;
      const inArc = d <= range + b.r && Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) <= arc;
      const inBlast = impact && blast > 0 && Math.hypot(b.x - impact.x, b.z - impact.z) <= blast + b.r;
      if (inArc || inBlast) { this.smash(b, dx / d, dz / d, p); n++; }
    }
    return n;
  }

  // Ponto com raio (orbe batendo, explosão, kunai na "parede").
  hitCircle(x, z, r = 0.3, by = null) {
    let n = 0;
    for (const b of this.list) {
      if (b.broken) continue;
      const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz) || 0.01;
      if (d <= r + b.r) { this.smash(b, dx / d, dz / d, by); n++; }
    }
    return n;
  }

  // Linha (raio reto, linha de fogo): amostras ao longo do caminho.
  hitLine(x0, z0, x1, z1, width = 0.6, by = null) {
    const len = Math.hypot(x1 - x0, z1 - z0), steps = Math.max(1, Math.ceil(len / 0.8));
    let n = 0;
    for (let i = 0; i <= steps; i++) n += this.hitCircle(x0 + (x1 - x0) * i / steps, z0 + (z1 - z0) * i / steps, width / 2, by);
    return n;
  }

  // Projétil batendo num obstáculo: se for um quebrável, quebra (devolve true).
  hitAt(x, z, by = null) { return this.hitCircle(x, z, 0.35, by) > 0; }

  smash(b, nx = 0, nz = 1, by = null) {
    if (b.broken) return;
    const i = this.list.indexOf(b);
    this.breakLocal(b, nx, nz, true);
    if (this.onBreak && i >= 0) this.onBreak(i, nx, nz);
    if (this.combat.log) this.combat.log({ type: 'propBreak', name: b.name, chest: b.chest });
    const luck = by && by.stats && by.stats.luck; // Sorte Grande: 25% em vez de 10%
    if (b.chest && this.rng() < (luck ? 0.25 : CHEST_POTION_CHANCE) && this.onDrop) this.onDrop(new THREE.Vector3(b.x, 0, b.z), by);
    if (this.onCoins && this.rng() < (luck ? 0.25 : COIN_CHANCE)) this.onCoins(new THREE.Vector3(b.x, 0, b.z), by);
  }

  // Mesa Virada (knightkit2.js): o objeto sai do lugar chutado (libera a passagem; o modelo vira projétil).
  kickOut(b) {
    if (b.broken) return;
    const i = this.list.indexOf(b);
    b.broken = true;
    if (b.rect && this.world) {
      const k = this.world.rects.indexOf(b.rect);
      if (k >= 0) { this.world.rects.splice(k, 1); this.world.version = (this.world.version || 0) + 1; }
    }
    if (this.onBreak && i >= 0) this.onBreak(i, 0, 1); // co-op: some na tela do Jogador 2
  }

  // O objeto chutado bateu: lascas onde caiu e a mesma chance de moedas/poção de quando quebra.
  kickBurst(b, x, z, nx, nz, by = null) {
    b.x = x; b.z = z;
    this.breakLocal(b, nx, nz, true);
    if (this.combat.log) this.combat.log({ type: 'propBreak', name: b.name, chest: b.chest, kicked: true });
    const luck = by && by.stats && by.stats.luck;
    if (b.chest && this.rng() < (luck ? 0.25 : CHEST_POTION_CHANCE) && this.onDrop) this.onDrop(new THREE.Vector3(x, 0, z), by);
    if (this.onCoins && this.rng() < (luck ? 0.25 : COIN_CHANCE)) this.onCoins(new THREE.Vector3(x, 0, z), by);
  }

  // Também usado pelo Jogador 2 (replica.js) para mostrar a quebra que veio pela rede (fx = false: o efeito já veio).
  breakLocal(b, nx = 0, nz = 1, fx = true) {
    b.broken = true;
    b.obj.visible = false;
    if (b.rect && this.world) {
      const k = this.world.rects.indexOf(b.rect);
      if (k >= 0) { this.world.rects.splice(k, 1); this.world.version = (this.world.version || 0) + 1; }
    }
    if (!fx) return;
    const c = this.combat, at = new THREE.Vector3(b.x, Math.min(1.2, b.h * 0.5), b.z);
    c.vfx.dust(new THREE.Vector3(b.x, 0, b.z), new THREE.Vector3(-nx, 0, -nz), 9);
    c.vfx.sparks(at, b.name.includes('candle') || b.name.includes('lantern') ? 0xffb050 : 0xc8a070, 10);
    if (c.debris && c.debris.splinters) c.debris.splinters(at, nx, nz, b.r);
    audio.play(/coffin|trunk|crate|box|barrel|keg|chair|table|bench|shelf/.test(b.name) ? 'crunch' : 'bones', b.x, b.z);
  }
}
export { DEG };
