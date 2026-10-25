// Câmera em 3/4 (vista de cima, inclinada), estilo Hades.
import * as THREE from 'three';
import { settings } from './settings.js';

export const CAMERA_CONFIG = {
  fov: 40,
  height: 27,   // altura acima do alvo
  back: 20.5,    // distância para trás (eixo +z)
};

export function createCamera() {
  let baseZoom = 1;
  let forced = 0; // espectador: zoom fixo para a sala inteira caber (0 = normal)
  const cam = new THREE.PerspectiveCamera(CAMERA_CONFIG.fov, innerWidth / innerHeight, 0.5, 200);
  const target = new THREE.Vector3(0, 0, 0);
  // Em telas estreitas (retrato), afasta a câmera para a sala inteira caber na largura.
  let zoom = 1;
  const fitWidth = 18; // largura mínima visível (unidades do mundo)
  const updateZoom = () => {
    const d = Math.hypot(CAMERA_CONFIG.height, CAMERA_CONFIG.back);
    const visible = 2 * d * Math.tan(THREE.MathUtils.degToRad(CAMERA_CONFIG.fov / 2)) * cam.aspect;
    zoom = (forced || Math.max(1, fitWidth / visible)) * baseZoom;
  };
  updateZoom();
  // Tremida: intensidade que cai rápido; o deslocamento é aplicado depois do lookAt.
  let shakeAmp = 0, shakeT = 0;
  const place = () => {
    cam.position.set(target.x, target.y + CAMERA_CONFIG.height * zoom, target.z + CAMERA_CONFIG.back * zoom);
    cam.lookAt(target);
    if (shakeAmp > 0.001) {
      cam.position.x += Math.sin(shakeT * 71) * shakeAmp;
      cam.position.y += Math.sin(shakeT * 53 + 1.3) * shakeAmp * 0.6;
      cam.position.z += Math.cos(shakeT * 61) * shakeAmp * 0.5;
    }
  };
  place();
  return {
    camera: cam,
    target,
    // Segue um ponto com suavidade (usado a partir do M1).
    follow(point, dt, stiffness = 6) {
      target.lerp(point, 1 - Math.exp(-stiffness * dt));
      shakeT += dt;
      shakeAmp *= Math.exp(-14 * dt);
      place();
    },
    shake(amount) { if (settings.shake) shakeAmp = Math.max(shakeAmp, amount); }, // Configurações: tremida desligável
    setBaseZoom(z) { baseZoom = z; updateZoom(); place(); },
    // Espectador: afasta até a sala inteira (chão e topo das paredes do fundo) caber na tela, olhando o meio dela.
    // Devolve o ponto para onde a câmera deve olhar.
    fitRoom(halfW, halfD, wallH = 4) {
      if (!halfW) { forced = 0; updateZoom(); return new THREE.Vector3(); }
      const probe = cam.clone();
      const pts = [];
      for (const x of [-halfW, halfW]) {
        pts.push(new THREE.Vector3(x, 0, halfD), new THREE.Vector3(x, 0, -halfD), new THREE.Vector3(x, wallH, -halfD));
      }
      const look = new THREE.Vector3(0, 0, 0.6);
      const fits = (z) => {
        probe.position.set(look.x, CAMERA_CONFIG.height * z, look.z + CAMERA_CONFIG.back * z);
        probe.lookAt(look);
        probe.updateMatrixWorld(true);
        return pts.every((p) => { const v = p.clone().project(probe); return Math.abs(v.x) <= 0.97 && v.y <= 0.86 && v.y >= -0.97; });
      };
      let lo = 0.3, hi = 6;
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
      forced = hi;
      updateZoom();
      return look;
    },
    resize() { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); updateZoom(); place(); },
  };
}
