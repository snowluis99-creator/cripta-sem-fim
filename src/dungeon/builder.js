// Transforma um template de sala (rooms.js) em peças 3D: piso, paredes, portas com grades, tochas,
// decoração e obstáculos (com colisão calculada pela caixa do próprio modelo).
import * as THREE from 'three';
import { instance, dungeonPath } from '../assets.js';
import { TILE } from './rooms.js';
import { applyTorchQuality } from '../graphics.js';

const TORCH_HEIGHT = 2.3;
const WALL_HALF_THICK = 0.5;
export const MAX_TORCH_LIGHTS = 6; // sempre 6 luzes: trocar a quantidade de luzes faz o jogo travar recompilando
const BAR_OPEN_Y = -3.6;

// Caminho de uma peça: sem "/" = kit da masmorra; com "/" = outra pasta de assets.
export const propPath = (name) => (name.includes('/') ? `${name}.gltf` : dungeonPath(name));

// Lista de peças necessárias para montar uma sala (para o carregador).
export function piecesForRoom(room) {
  const set = new Set([room.floor, room.floorSmall || 'floor_tile_small', 'wall_corner', 'torch_mounted', 'wall_doorway', 'wall']);
  if (room.spikes?.length) set.add('floor_tile_big_spikes');
  room.floorDetails.forEach((d) => set.add(d[3]));
  Object.values(room.walls).forEach((list) => list.forEach((p) => set.add(p)));
  (room.props || []).forEach((p) => set.add(p[0]));
  (room.wallDeco || []).forEach((p) => set.add(p[0]));
  return [...set].map(propPath);
}

function place(group, name, x, y, z, rotY = 0) {
  const obj = instance(propPath(name));
  obj.position.set(x, y, z);
  obj.rotation.y = rotY;
  group.add(obj);
  return obj;
}

// Textura de brilho (círculo suave) gerada em código.
let glowTexture = null;
export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,230,170,1)');
  grad.addColorStop(0.25, 'rgba(255,150,50,0.8)');
  grad.addColorStop(1, 'rgba(255,80,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

// Grade de ferro da porta (feita em código): desce para dentro do chão quando a porta abre.
const barMat = new THREE.MeshStandardMaterial({ color: 0x2c2a30, metalness: 0.7, roughness: 0.45 });
const barGeoV = new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6);
const barGeoH = new THREE.BoxGeometry(2.6, 0.14, 0.14);
function makeBars() {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(barGeoV, barMat);
    b.position.set(-1.2 + i * 0.4, 1.7, 0);
    g.add(b);
  }
  for (const y of [0.9, 2.5]) {
    const h = new THREE.Mesh(barGeoH, barMat);
    h.position.y = y;
    g.add(h);
  }
  return g;
}

export function buildRoom(room, opts = {}) {
  const group = new THREE.Group();
  group.name = room.name;
  const halfW = (room.width * TILE) / 2;
  const halfD = (room.depth * TILE) / 2;
  const usedDoors = opts.doors ?? room.doors; // segmentos da parede N que viram portas
  const nX = (i) => -halfW + TILE + i * TILE;
  const sideZ = (i) => -halfD + TILE + i * TILE;

  // --- Piso ---
  const details = new Map();
  room.floorDetails.forEach(([tx, tz, q, piece]) => details.set(`${tx},${tz}`, { q, piece }));
  // Armadilhas de espinho (andar 2+): o piso da casa vira a placa com espinhos; os espinhos sobem e descem.
  const spikes = [];
  const spikeAt = new Map((room.spikes || []).map(([tx, tz, phase]) => [`${tx},${tz}`, phase || 0]));
  for (let tx = 0; tx < room.width; tx++) {
    for (let tz = 0; tz < room.depth; tz++) {
      const cx = -halfW + TILE / 2 + tx * TILE;
      const cz = -halfD + TILE / 2 + tz * TILE;
      if (spikeAt.has(`${tx},${tz}`)) {
        const tile = place(group, 'floor_tile_big_spikes', cx, 0, cz);
        const sp = tile.getObjectByName('spikes');
        spikes.push({ x: cx, z: cz, obj: sp, phase: spikeAt.get(`${tx},${tz}`), up: 0, hit: new Set() });
        continue;
      }
      const d = details.get(`${tx},${tz}`);
      if (!d) { place(group, room.floor, cx, 0, cz); continue; }
      for (let q = 0; q < 4; q++) {
        const ox = (q % 2 === 0 ? -1 : 1), oz = (q < 2 ? -1 : 1);
        place(group, q === d.q ? d.piece : (room.floorSmall || 'floor_tile_small'), cx + ox, 0, cz + oz);
      }
    }
  }

  // --- Paredes ---
  const doors = [];
  room.walls.N.forEach((p, i) => {
    const isDoor = usedDoors.includes(i);
    const piece = isDoor ? 'wall_doorway' : (p === 'wall_doorway' ? 'wall' : p);
    place(group, piece, nX(i), 0, -halfD);
    if (isDoor) {
      const bars = makeBars();
      bars.position.set(nX(i), 0, -halfD);
      group.add(bars);
      // Brilho na passagem quando a porta abre.
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getGlowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
      }));
      glow.position.set(nX(i), 1.6, -halfD - 0.2);
      glow.scale.set(3.2, 3.6, 1);
      group.add(glow);
      doors.push({ slot: i, x: nX(i), z: -halfD, bars, glow, open: false, k: 0 });
    }
  });
  room.walls.W.forEach((p, i) => place(group, p, -halfW, 0, sideZ(i), Math.PI / 2));
  room.walls.E.forEach((p, i) => place(group, p, halfW, 0, sideZ(i), -Math.PI / 2));
  // Parede da frente (perto da câmera): fica transparente quando o herói passa atrás dela.
  const front = [];
  const addFront = (obj) => {
    obj.traverse((o) => { if (o.isMesh) o.material = o.material.clone(); });
    front.push({ obj, x: obj.position.x, opacity: 1 });
  };
  const entranceX = nX(room.entrance);
  room.walls.S.forEach((p, i) => addFront(place(group, i === room.entrance ? 'wall_doorway' : p, nX(i), 0, halfD, Math.PI)));
  const entryBars = makeBars();
  entryBars.position.set(entranceX, 0, halfD);
  group.add(entryBars);
  front.push({ obj: entryBars, x: entranceX, opacity: 1, shared: true });
  // Cantos (a peça original abre para -x e +z).
  place(group, 'wall_corner', halfW, 0, -halfD, 0);
  place(group, 'wall_corner', -halfW, 0, -halfD, Math.PI / 2);
  addFront(place(group, 'wall_corner', halfW, 0, halfD, -Math.PI / 2));
  addFront(place(group, 'wall_corner', -halfW, 0, halfD, Math.PI));

  // --- Decoração de parede ---
  const wallSpot = (side, i, inset) => {
    if (side === 'N') return { x: nX(i), z: -halfD + inset, rot: 0 };
    if (side === 'W') return { x: -halfW + inset, z: sideZ(i), rot: Math.PI / 2 };
    return { x: halfW - inset, z: sideZ(i), rot: -Math.PI / 2 };
  };
  for (const [name, side, i, y] of room.wallDeco || []) {
    const s = wallSpot(side, i, WALL_HALF_THICK + 0.18);
    place(group, name, s.x, y, s.z, s.rot);
  }

  // --- Tochas (sempre MAX_TORCH_LIGHTS luzes; as que sobram ficam apagadas) ---
  const torches = room.torches.slice(0, MAX_TORCH_LIGHTS).map(([side, i]) => {
    const s = wallSpot(side, i, WALL_HALF_THICK);
    return addTorch(group, s.x, s.z, s.rot, room.torchColor);
  });
  while (torches.length < MAX_TORCH_LIGHTS) {
    const light = new THREE.PointLight(0xff8a3a, 0, 1);
    group.add(light);
    torches.push({ light, sprite: null, base: 0, seed: 0 });
  }
  applyTorchQuality(torches); // Gráficos Médio/Baixo: menos tochas acesas

  // --- Paredes (colisão): cada parede tem 1 unidade de espessura ---
  const t = WALL_HALF_THICK;
  const colliders = [
    [-halfW - t, -halfD - t, halfW + t, -halfD + t],
    [-halfW - t, halfD - t, halfW + t, halfD + t],
    [-halfW - t, -halfD - t, -halfW + t, halfD + t],
    [halfW - t, -halfD - t, halfW + t, halfD + t],
  ];

  // --- Obstáculos e enfeites no chão ---
  const box = new THREE.Box3();
  for (const [name, x, z, rotDeg, solid, y = 0] of room.props || []) {
    const obj = place(group, name, x, y, z, THREE.MathUtils.degToRad(rotDeg || 0));
    if (!solid) continue;
    obj.updateMatrixWorld(true);
    box.setFromObject(obj);
    const m = 0.08; // um pouco menor que a caixa, para não "bater no ar"
    colliders.push([box.min.x + m, box.min.z + m, box.max.x - m, box.max.z - m]);
  }

  return {
    room, group, halfW, halfD, colliders, doors, spikes,
    entrance: { x: entranceX, z: halfD - 2.2 },
    reward: new THREE.Vector3(room.reward?.[0] ?? 0, 0, room.reward?.[1] ?? 0),
    setDoorsOpen(open) { for (const d of doors) d.open = open; },
    // Parede da frente inteira some quando o herói ou algum inimigo está perto dela (atrás dela na câmera).
    // positions: lista de {x, z} (herói + inimigos vivos).
    updateFrontWall(positions, dt) {
      const anyone = positions.some((p) => p.z > halfD - 4);
      const target = anyone ? 0 : 1;
      for (const f of front) {
        if (Math.abs(f.opacity - target) < 0.005) continue;
        f.opacity += (target - f.opacity) * (1 - Math.exp(-14 * dt));
        if (Math.abs(f.opacity - target) < 0.02) f.opacity = target;
        f.obj.visible = f.opacity > 0.02;
        if (f.shared) { f.obj.visible = f.opacity > 0.5; continue; } // grade da entrada
        const see = f.opacity < 0.999;
        f.obj.traverse((o) => {
          if (!o.isMesh) return;
          if (o.material.transparent !== see) {
            o.material.transparent = see;
            o.material.depthWrite = !see;
            o.material.needsUpdate = true; // trocar "transparent" exige recompilar o material
          }
          o.material.opacity = f.opacity;
        });
      }
    },
    get frontHidden() { return front.every((f) => !f.obj.visible); },
    update(t, dt) {
      for (const tc of torches) {
        if (!tc.sprite) continue;
        const f = Math.sin(t * 9 + tc.seed) * 0.5 + Math.sin(t * 23 + tc.seed * 2) * 0.3;
        tc.light.intensity = tc.base * (tc.boost || 1) * (1 + f * 0.12);
        tc.sprite.scale.setScalar(1.15 + f * 0.12);
      }
      // Grades das portas descendo/subindo.
      for (const d of doors) {
        const target = d.open ? 1 : 0;
        d.k += (target - d.k) * Math.min(1, dt * 3.5);
        if (Math.abs(d.k - target) < 0.002) d.k = target;
        d.bars.position.y = BAR_OPEN_Y * d.k;
        d.bars.visible = d.k < 0.99;
        d.glow.material.opacity = d.k * (0.55 + Math.sin(t * 3 + d.x) * 0.1);
      }
    },
  };
}

function addTorch(group, x, z, rotY, color = 0xff8a3a) {
  place(group, 'torch_mounted', x, TORCH_HEIGHT, z, rotY);
  const tip = new THREE.Vector3(0, 0.78, 0.42).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  const fx = x + tip.x, fy = TORCH_HEIGHT + tip.y, fz = z + tip.z;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getGlowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  sprite.position.set(fx, fy, fz);
  sprite.scale.setScalar(1.2);
  group.add(sprite);
  if (color !== 0xff8a3a) sprite.material.color.setHex(color).lerp(new THREE.Color(0xffffff), 0.35);
  const light = new THREE.PointLight(color, 28, 16, 1.8);
  const out = new THREE.Vector3(0, 0, 0.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
  light.position.set(fx + out.x, fy, fz + out.z);
  group.add(light);
  return { sprite, light, base: 28, seed: Math.random() * 100 };
}
