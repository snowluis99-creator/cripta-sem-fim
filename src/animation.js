// Biblioteca de clipes (Rig_Medium) + controlador de animação por personagem.
import * as THREE from 'three';
import { getGltf } from './assets.js';

export const ANIM_FILES = ['General', 'MovementBasic', 'MovementAdvanced', 'CombatMelee', 'Special', 'Simulation', 'CombatRanged']
  .map((n) => `animations/Rig_Medium_${n}.glb`);

const clips = new Map();
// Lista fixa de nomes (mesma ordem nos dois computadores do co-op: o número do clipe viaja pela rede).
export const clipNames = [];

// Junta os clipes de todos os arquivos de animação. Remove o deslocamento do osso "root"
// (o jogo é quem move o personagem).
export function buildClipLibrary() {
  for (const f of ANIM_FILES) {
    const gltf = getGltf(f);
    if (!gltf) continue;
    for (const clip of gltf.animations) {
      clip.tracks = clip.tracks.filter((t) => t.name !== 'root.position');
      clips.set(clip.name, clip);
    }
  }
  clipNames.length = 0;
  clipNames.push(...[...clips.keys()].sort());
  return clips;
}

export function getClip(name) {
  const c = clips.get(name);
  if (!c) throw new Error(`Animação não encontrada: ${name}`);
  return c;
}

export class Animator {
  constructor(root) {
    this.mixer = new THREE.AnimationMixer(root);
    this.current = null;
    this.currentName = '';
    this.onFinish = null;
    this.playId = 0;      // muda a cada animação nova (co-op: o outro computador repete a mesma)
    this.netSpeed = 1;
    this.netOnce = false;
    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.current && this.onFinish) {
        const cb = this.onFinish; this.onFinish = null; cb();
      }
    });
  }

  // opts: { once, fade, speed, restart, onFinish }
  play(name, opts = {}) {
    const { once = false, fade = 0.15, speed = 1, restart = false } = opts;
    if (this.currentName === name && !restart) {
      this.current.timeScale = speed;
      this.netSpeed = speed;
      return this.current;
    }
    this.playId++;
    this.netSpeed = speed;
    this.netOnce = once;
    const action = this.mixer.clipAction(getClip(name));
    action.reset();
    action.timeScale = speed;
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = once;
    action.enabled = true;
    // warp = false: com warp o Three.js volta a velocidade do clipe para 1 no fim da transição.
    if (this.current && this.current !== action) action.crossFadeFrom(this.current, fade, false);
    action.play();
    this.current = action;
    this.currentName = name;
    this.onFinish = opts.onFinish || null;
    return action;
  }

  // Progresso 0..1 do clipe atual.
  progress() {
    if (!this.current) return 0;
    return this.current.time / this.current.getClip().duration;
  }

  update(dt) { this.mixer.update(dt); }
}
