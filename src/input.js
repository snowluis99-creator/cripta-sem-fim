// Teclado e mouse. Guarda o que está apertado e o que foi apertado neste quadro.
import * as THREE from 'three';

const down = new Set();
const pressed = new Set();
const mouse = { x: 0, y: 0, left: false, right: false, moved: false };
// Controle (Gamepad API, layout padrão Xbox): A=0, B=1, X=2, Y=3, LB=4, RB=5, LT=6, RT=7.
const PAD_DEAD = 0.25;
const pad = { side: 0, connected: false, lx: 0, lz: 0, rx: 0, rz: 0, buttons: [], prev: [] };
let lastDevice = 'keys'; // 'keys' | 'mouse' | 'pad'
let onDeviceChange = null;
const setDevice = (d) => { if (d !== lastDevice) { lastDevice = d; if (onDeviceChange) onDeviceChange(d); } };
const stick = (v) => (Math.abs(v) < PAD_DEAD ? 0 : (v - Math.sign(v) * PAD_DEAD) / (1 - PAD_DEAD));
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tmpDir = new THREE.Vector3();
const tmpAim = new THREE.Vector3();

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    const k = e.code;
    if (!down.has(k)) pressed.add(k);
    down.add(k);
    if (k === 'Space' || k.startsWith('Arrow')) e.preventDefault();
    if (k !== 'KeyI' && k !== 'KeyO' && k !== 'KeyT') setDevice('keys');
  });
  addEventListener('keyup', (e) => down.delete(e.code));
  addEventListener('blur', () => { down.clear(); mouse.left = mouse.right = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true; setDevice('mouse');
  });
  canvas.addEventListener('pointerdown', (e) => {
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true; setDevice('mouse');
    if (e.button === 0) { mouse.left = true; pressed.add('MouseLeft'); }
    if (e.button === 2) { mouse.right = true; pressed.add('MouseRight'); }
  });
  addEventListener('pointerup', (e) => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
}

// Lê o controle (chamar uma vez por quadro, antes de atualizar o jogo).
function pollPad() {
  let gp = null;
  try {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of list) if (g && g.connected) { gp = g; break; }
  } catch (e) { gp = null; } // o navegador pode bloquear o controle dentro de alguns sites
  pad.connected = !!gp;
  pad.prev = pad.buttons;
  if (!gp) { pad.buttons = []; pad.lx = pad.lz = pad.rx = pad.rz = 0; return; }
  pad.buttons = gp.buttons.map((b) => b.pressed || b.value > 0.5);
  pad.lx = stick(gp.axes[0] || 0); pad.lz = stick(gp.axes[1] || 0);
  pad.rx = stick(gp.axes[2] || 0); pad.rz = stick(gp.axes[3] || 0);
  const names = { 0: 'PadA', 1: 'PadB', 2: 'PadX', 3: 'PadY', 4: 'PadLB', 5: 'PadRB', 6: 'PadLT', 7: 'PadRT', 8: 'PadBack', 9: 'PadStart', 12: 'PadUp', 13: 'PadDown', 14: 'PadLeft', 15: 'PadRight' };
  let active = Math.hypot(pad.lx, pad.lz) > 0 || Math.hypot(pad.rx, pad.rz) > 0;
  pad.buttons.forEach((b, i) => {
    if (b) active = true;
    if (b && !pad.prev[i] && names[i]) pressed.add(names[i]);
  });
  // Analógico empurrado para os lados conta como "apertou" (para navegar nos menus).
  const side = pad.lx < -0.6 ? -1 : pad.lx > 0.6 ? 1 : 0;
  if (side !== pad.side) { if (side < 0) pressed.add('PadLeft'); if (side > 0) pressed.add('PadRight'); }
  pad.side = side;
  if (active) setDevice('pad');
}
const padHeld = (i) => !!pad.buttons[i];

export const input = {
  poll: pollPad,
  get device() { return lastDevice; },
  get padConnected() { return pad.connected; },
  onDevice(cb) { onDeviceChange = cb; },
  isDown: (code) => down.has(code),
  wasPressed: (code) => pressed.has(code),
  // Direção de movimento (x, z) normalizada, já pensando na câmera olhando para -z.
  moveDir(out) {
    let x = 0, z = 0;
    if (down.has('KeyW') || down.has('ArrowUp')) z -= 1;
    if (down.has('KeyS') || down.has('ArrowDown')) z += 1;
    if (down.has('KeyA') || down.has('ArrowLeft')) x -= 1;
    if (down.has('KeyD') || down.has('ArrowRight')) x += 1;
    if (x === 0 && z === 0 && (pad.lx || pad.lz)) {
      // Analógico: mantém a intensidade (meio empurrado = mais devagar).
      out.set(pad.lx, 0, pad.lz);
      if (out.lengthSq() > 1) out.normalize();
      return out;
    }
    out.set(x, 0, z);
    if (out.lengthSq() > 0) out.normalize();
    return out;
  },
  // Para onde o golpe vai: analógico direito > direção em que está andando > mouse (se for o último usado).
  // Devolve um ângulo ou null (= manter a direção atual).
  aimAngle(camera, from) {
    if (Math.hypot(pad.rx, pad.rz) > 0.3) return Math.atan2(pad.rx, pad.rz);
    const m = this.moveDir(tmpDir);
    if (m.lengthSq() > 0.04) return Math.atan2(m.x, m.z);
    if (lastDevice === 'mouse' && mouse.moved && this.aimPoint(camera, tmpAim)) {
      const dx = tmpAim.x - from.x, dz = tmpAim.z - from.z;
      if (dx * dx + dz * dz > 0.04) return Math.atan2(dx, dz);
    }
    return null;
  },
  attack: () => pressed.has('MouseLeft') || pressed.has('KeyJ') || pressed.has('PadX') || pressed.has('PadRB'),
  dodge: () => pressed.has('Space') || pressed.has('PadA') || pressed.has('PadB'),
  potion: () => pressed.has('KeyQ') || pressed.has('PadY'),
  interact: () => pressed.has('KeyE') || pressed.has('PadY'),
  ultimate: () => pressed.has('KeyR') || pressed.has('PadRT'),
  pause: () => pressed.has('PadStart'),
  retry: () => pressed.has('Enter') || pressed.has('KeyR') || pressed.has('PadA'),
  blocking: () => mouse.right || down.has('ShiftLeft') || down.has('KeyK') || padHeld(4) || padHeld(6),
  // Ponto do chão (y = 0) sob o mouse.
  aimPoint(camera, out) {
    ndc.set((mouse.x / innerWidth) * 2 - 1, -(mouse.y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(groundPlane, out);
  },
  // Solta tudo (abrir a pausa: o herói não sai andando sozinho).
  clear() { down.clear(); pressed.clear(); mouse.left = mouse.right = false; },
  // Chamar no fim de cada quadro.
  endFrame() { pressed.clear(); },
};
