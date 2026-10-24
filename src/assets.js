// Carregamento de modelos com cache e tela de loading.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const cache = new Map(); // caminho -> gltf

export function createLoadingScreen() {
  const root = document.getElementById('loading');
  const fill = root.querySelector('.fill');
  const msg = root.querySelector('.msg');
  return {
    progress(p) { fill.style.width = `${Math.round(p * 100)}%`; },
    message(text, isError = false) { msg.textContent = text; msg.classList.toggle('error', isError); },
    hide() { root.classList.add('done'); },
  };
}

// Carrega uma lista de caminhos (relativos à pasta assets/). onProgress(0..1).
export async function loadAll(paths, onProgress = () => {}) {
  const manager = new THREE.LoadingManager();
  const loader = new GLTFLoader(manager);
  const todo = paths.filter((p) => !cache.has(p));
  let done = 0;
  onProgress(todo.length ? 0 : 1);
  // Os modelos vêm agrupados em poucos pacotes em packed/ (gerados por tools/build.py).
  await Promise.all(todo.map((p) => loadPacked(loader, p).then((gltf) => {
    gltf.scene.traverse((o) => {
      if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; }
    });
    cache.set(p, gltf);
    done++;
    onProgress(done / todo.length);
  }).catch((err) => {
    throw new Error(`Falha ao carregar ${p}: ${err.message || err}`);
  })));
}

// Pacotes: packed/index.json diz em qual pacote está cada modelo; cada pacote é baixado uma vez só.
const fetched = new Map();
const getJson = (url) => {
  if (!fetched.has(url)) {
    fetched.set(url, fetch(url).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} em ${url}`);
      return res.json();
    }));
  }
  return fetched.get(url);
};

// O site do Artifact não serve .glb nem deixa buscar "data:" URIs, então cada modelo
// é remontado aqui como um GLB em memória (JSON + bloco binário) e entregue ao GLTFLoader.
async function loadPacked(loader, path) {
  const index = await getJson('packed/index.json');
  const bundle = index[path];
  if (!bundle) throw new Error('modelo fora dos pacotes');
  const entry = (await getJson(`packed/${bundle}.json`))[path];
  const doc = structuredClone(entry.doc);
  let bin = new Uint8Array(0);
  if (doc.buffers?.length) {
    const raw = atob(entry.bin);
    bin = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
  }
  const enc = new TextEncoder();
  let json = enc.encode(JSON.stringify(doc));
  const pad4 = (n) => (n + 3) & ~3;
  const jsonLen = pad4(json.length), binLen = pad4(bin.length);
  const total = 12 + 8 + jsonLen + (bin.length ? 8 + binLen : 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLen, true); dv.setUint32(16, 0x4e4f534a, true);
  out.set(json, 20); out.fill(0x20, 20 + json.length, 20 + jsonLen);
  if (bin.length) {
    const o = 20 + jsonLen;
    dv.setUint32(o, binLen, true); dv.setUint32(o + 4, 0x004e4942, true);
    out.set(bin, o + 8);
  }
  return loader.parseAsync(out.buffer, 'packed/'); // texturas em packed/tex/
}

// Devolve uma cópia pronta para colocar na cena.
export function instance(path) {
  const gltf = cache.get(path);
  if (!gltf) throw new Error(`Modelo não carregado: ${path}`);
  let hasSkin = false;
  gltf.scene.traverse((o) => { if (o.isSkinnedMesh) hasSkin = true; });
  return hasSkin ? SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true);
}

export function getGltf(path) { return cache.get(path); }

// Atalho para peças da masmorra.
export const dungeonPath = (name) => `dungeon/${name}.gltf`;
