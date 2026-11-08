// Vassalo (pedido do dono, 04/11): em vez de ficar dourado, o esqueleto nomeado cavaleiro ganha a capa do
// Cavaleiro (a mesma malha do herói, presa nos ossos do esqueleto: todos usam o esqueleto Rig_Medium)
// e duas ombreiras de aço com borda dourada (feitas em código, presas no peito).
import * as THREE from 'three';
import { getGltf } from './assets.js';
import { findBone } from './characters.js';

const STEEL = new THREE.MeshStandardMaterial({ color: 0xd2dae4, metalness: 0.15, roughness: 0.4, emissive: 0x2a3440, emissiveIntensity: 0.6 }); // sem mapa de reflexo: metal alto fica preto
const TRIM = new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 0.2, roughness: 0.35, emissive: 0x6a4200, emissiveIntensity: 0.6 });
const DOME = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
const RIM = new THREE.TorusGeometry(1, 0.12, 6, 18).rotateX(Math.PI / 2);
const RIDGE = new THREE.BoxGeometry(0.16, 0.35, 1.5);

let capeSrc;
function findCape() {
  if (capeSrc !== undefined) return capeSrc;
  capeSrc = null;
  const g = getGltf('heroes/Knight.glb');
  if (g) g.scene.traverse((o) => { if (o.isSkinnedMesh && /Cape/.test(o.name)) capeSrc = o; });
  return capeSrc;
}

// Capa do Cavaleiro presa no esqueleto do inimigo.
function addCape(model) {
  const src = findCape();
  let body = null;
  model.traverse((o) => { if (o.isSkinnedMesh && !body) body = o; });
  if (!src || !body) return null;
  const bones = src.skeleton.bones.map((b) => body.skeleton.bones.find((x) => x.name === b.name) || null);
  if (bones.some((b) => !b)) return null;
  const mat = Array.isArray(src.material) ? src.material.map((m) => m.clone()) : src.material.clone();
  const cape = new THREE.SkinnedMesh(src.geometry, mat);
  cape.name = 'Vassal_Cape';
  cape.frustumCulled = false;
  body.parent.add(cape);
  cape.bind(new THREE.Skeleton(bones, src.skeleton.boneInverses.map((m) => m.clone())), src.bindMatrix.clone());
  return cape;
}

// Ombreira: domo de aço + borda e crista douradas, virado para cima e para fora do ombro.
function makePauldron() {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(DOME, STEEL);
  const rim = new THREE.Mesh(RIM, TRIM);
  const ridge = new THREE.Mesh(RIDGE, TRIM);
  ridge.position.y = 0.82; ridge.scale.set(1, 1, 0.8);
  g.add(dome, rim, ridge);
  return g;
}

function addPauldrons(e) {
  const model = e.model;
  const chest = findBone(model, 'chest'), head = findBone(model, 'head');
  if (!chest) return [];
  model.updateMatrixWorld(true);
  const ws = chest.getWorldScale(new THREE.Vector3()).x / Math.max(1e-6, e.group.getWorldScale(new THREE.Vector3()).x);
  const inv = new THREE.Matrix4().copy(chest.matrixWorld).invert();
  const up = head ? head.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).normalize() : new THREE.Vector3(0, 1, 0);
  const out = [];
  for (const side of ['l', 'r']) {
    const arm = findBone(model, `upperarm.${side}`);
    if (!arm) continue;
    const at = arm.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv); // ombro no espaço do peito
    const lat = at.clone().sub(up.clone().multiplyScalar(at.dot(up))).normalize(); // para fora (lado)
    const dir = up.clone().multiplyScalar(0.55).add(lat.clone().multiplyScalar(0.85)).normalize();
    const pad = makePauldron();
    pad.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    // Para fora do ombro (o capacete do Guerreiro é largo e esconderia a ombreira em cima do ombro).
    pad.position.copy(at).addScaledVector(lat, 0.13 / ws).addScaledVector(up, -0.03 / ws);
    pad.scale.set(0.24 / ws, 0.17 / ws, 0.23 / ws);
    pad.name = 'Vassal_Pauldron';
    chest.add(pad);
    out.push(pad);
  }
  return out;
}

// Veste o vassalo (uma vez só). Esconde a capa/manto original do esqueleto, se tiver.
export function addVassalGear(e) {
  if (!e || !e.model || e.vassalGear) return;
  const hidden = [];
  e.model.traverse((o) => { if (o.isMesh && /Cloak|Cape/.test(o.name) && o.name !== 'Vassal_Cape') { o.visible = false; hidden.push(o); } });
  const cape = addCape(e.model);
  const pads = addPauldrons(e);
  e.vassalGear = { cape, pads, hidden };
}
