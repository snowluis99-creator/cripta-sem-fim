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

// Lê os controles (chamar uma vez por quadro, antes de atualizar o jogo).
// Co-op local (05/11): cada controle tem um dono. P1 = controle de índice slots.p1 (-1 = nenhum: só teclado/mouse),
// P2 = slots.p2. Os botões do P1 viram "PadX", os do P2 "P2PadX"; os de qualquer controle também "AnyPadX" (menus).
const PAD_NAMES = { 0: 'PadA', 1: 'PadB', 2: 'PadX', 3: 'PadY', 4: 'PadLB', 5: 'PadRB', 6: 'PadLT', 7: 'PadRT', 8: 'PadBack', 9: 'PadStart', 12: 'PadUp', 13: 'PadDown', 14: 'PadLeft', 15: 'PadRight' };
const blankPad = () => ({ side: 0, connected: false, lx: 0, lz: 0, rx: 0, rz: 0, buttons: [], prev: [] });
const pads = new Map();          // índice do controle -> estado
const pad2 = blankPad();          // controle do Jogador 2 (co-op local)
let local = false;                // co-op local ligado
const slots = { p1: 0, p2: -1 };
function readPad(gp, st) {
  st.connected = true;
  st.prev = st.buttons;
  st.buttons = gp.buttons.map((b) => b.pressed || b.value > 0.5);
  st.lx = stick(gp.axes[0] || 0); st.lz = stick(gp.axes[1] || 0);
  st.rx = stick(gp.axes[2] || 0); st.rz = stick(gp.axes[3] || 0);
}
function edges(st, prefix, out) {
  let active = Math.hypot(st.lx, st.lz) > 0 || Math.hypot(st.rx, st.rz) > 0;
  st.buttons.forEach((b, i) => {
    if (b) active = true;
    if (b && !st.prev[i] && PAD_NAMES[i]) out.push(PAD_NAMES[i]);
  });
  // Analógico empurrado para os lados/cima/baixo conta como "apertou" (para navegar nos menus).
  const side = st.lx < -0.6 ? -1 : st.lx > 0.6 ? 1 : 0;
  if (side !== st.side) { if (side < 0) out.push('PadLeft'); if (side > 0) out.push('PadRight'); }
  st.side = side;
  return active;
}
function pollPad() {
  let list = [];
  try { list = navigator.getGamepads ? [...navigator.getGamepads()].filter((g) => g && g.connected) : []; } catch (e) { list = []; } // o navegador pode bloquear o controle
  // Quem é quem: 2+ controles = P1 no 1º e P2 no 2º; 1 controle no co-op local = é do P2 (P1 fica no teclado).
  if (local) { slots.p1 = list.length >= 2 ? list[0].index : -1; slots.p2 = list.length >= 2 ? list[1].index : list.length ? list[0].index : -1; }
  else { slots.p1 = list.length ? list[0].index : -1; slots.p2 = -1; }
  const seen = new Set();
  for (const gp of list) {
    seen.add(gp.index);
    const st = pads.get(gp.index) || blankPad();
    pads.set(gp.index, st);
    readPad(gp, st);
    const names = [];
    const active = edges(st, '', names);
    for (const n of names) {
      pressed.add('Any' + n);
      if (gp.index === slots.p1) pressed.add(n);
      if (gp.index === slots.p2) pressed.add('P2' + n);
    }
    if (active && gp.index === slots.p1) setDevice('pad');
  }
  for (const k of [...pads.keys()]) if (!seen.has(k)) pads.delete(k);
  const mine = pads.get(slots.p1), theirs = pads.get(slots.p2);
  Object.assign(pad, mine ? { connected: true, lx: mine.lx, lz: mine.lz, rx: mine.rx, rz: mine.rz, buttons: mine.buttons } : { connected: false, lx: 0, lz: 0, rx: 0, rz: 0, buttons: [] });
  Object.assign(pad2, theirs ? { connected: true, lx: theirs.lx, lz: theirs.lz, rx: theirs.rx, rz: theirs.rz, buttons: theirs.buttons } : { connected: false, lx: 0, lz: 0, rx: 0, rz: 0, buttons: [] });
}
const padHeld = (i) => !!pad.buttons[i];

export const input = {
  poll: pollPad,
  get device() { return lastDevice; },
  get padConnected() { return pad.connected; },
  onDevice(cb) { onDeviceChange = cb; },
  isDown: (code) => down.has(code),
  wasPressed: (code) => pressed.has(code) || (code.startsWith('Pad') && pressed.has('Any' + code)), // menus: qualquer controle
  // Co-op local ligado/desligado (divide teclado e controles entre os 2 jogadores).
  setLocal(on) { local = !!on; },
  isPressedOwn: (code) => pressed.has(code), // só o que é do Jogador 1 (sem "qualquer controle")
  get local() { return local; },
  get pads() { return pads.size; },
  // Direção de movimento (x, z) normalizada, já pensando na câmera olhando para -z.
  moveDir(out) {
    let x = 0, z = 0;
    const ar = !local; // co-op local: as setas são do Jogador 2
    if (down.has('KeyW') || (ar && down.has('ArrowUp'))) z -= 1;
    if (down.has('KeyS') || (ar && down.has('ArrowDown'))) z += 1;
    if (down.has('KeyA') || (ar && down.has('ArrowLeft'))) x -= 1;
    if (down.has('KeyD') || (ar && down.has('ArrowRight'))) x += 1;
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
  attack: () => pressed.has('MouseLeft') || (!local && pressed.has('KeyJ')) || pressed.has('PadX') || pressed.has('PadRB'),
  dodge: () => pressed.has('Space') || pressed.has('PadA') || pressed.has('PadB'),
  attackHeld: () => mouse.left || (!local && down.has('KeyJ')) || padHeld(2) || padHeld(5), // Pião: gira enquanto segura
  dodgeHeld: () => down.has('Space') || padHeld(0) || padHeld(1), // Trenó de Escudo: desliza enquanto segura
  potion: () => pressed.has('KeyQ') || pressed.has('PadY'),
  interact: () => pressed.has('KeyE') || pressed.has('PadY'),
  ultimate: () => pressed.has('KeyR') || pressed.has('PadRT'),
  pause: () => pressed.has('AnyPadStart'),
  retry: () => pressed.has('Enter') || pressed.has('KeyR') || pressed.has('AnyPadA'),
  blocking: () => mouse.right || down.has('ShiftLeft') || (!local && down.has('KeyK')) || padHeld(4) || padHeld(6),
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

// Jogador 2 no mesmo computador (co-op local): controle do P2 ou, sem controle, teclado
// (setas = andar, J = atacar, K = rolar, L = bloquear, U = poção, O = usar, P = ultimate).
// Mesma "cara" do input do P1 / RemoteInput (o Player não sabe a diferença).
const p2Held = (i) => !!pad2.buttons[i];
const P2 = (n) => pressed.has('P2' + n);
export const input2 = {
  remote: false,
  retries: 0,
  beginFrame() {}, endFrame() {},
  get device() { return pad2.connected ? 'pad' : 'keys'; },
  moveDir(out) {
    let x = 0, z = 0;
    if (down.has('ArrowUp')) z -= 1;
    if (down.has('ArrowDown')) z += 1;
    if (down.has('ArrowLeft')) x -= 1;
    if (down.has('ArrowRight')) x += 1;
    if (x === 0 && z === 0 && (pad2.lx || pad2.lz)) {
      out.set(pad2.lx, 0, pad2.lz);
      if (out.lengthSq() > 1) out.normalize();
      return out;
    }
    out.set(x, 0, z);
    if (out.lengthSq() > 0) out.normalize();
    return out;
  },
  aimAngle() {
    if (Math.hypot(pad2.rx, pad2.rz) > 0.3) return Math.atan2(pad2.rx, pad2.rz);
    const m = this.moveDir(tmpDir);
    if (m.lengthSq() > 0.04) return Math.atan2(m.x, m.z);
    return null;
  },
  attack: () => pressed.has('KeyJ') || pressed.has('Numpad1') || P2('PadX') || P2('PadRB'),
  dodge: () => pressed.has('KeyK') || pressed.has('Numpad2') || P2('PadA') || P2('PadB'),
  attackHeld: () => down.has('KeyJ') || down.has('Numpad1') || p2Held(2) || p2Held(5),
  dodgeHeld: () => down.has('KeyK') || down.has('Numpad2') || p2Held(0) || p2Held(1),
  potion: () => pressed.has('KeyU') || pressed.has('Numpad4') || P2('PadY'),
  interact: () => pressed.has('KeyO') || pressed.has('Numpad5') || P2('PadY'),
  ultimate: () => pressed.has('KeyP') || pressed.has('Numpad6') || P2('PadRT'),
  blocking: () => down.has('KeyL') || down.has('Numpad3') || p2Held(4) || p2Held(6),
  // Menus do P2 (bênção / porta)
  menu: () => ({
    left: pressed.has('ArrowLeft') || P2('PadLeft'), right: pressed.has('ArrowRight') || P2('PadRight'),
    ok: pressed.has('KeyJ') || pressed.has('Numpad1') || pressed.has('NumpadEnter') || P2('PadA'),
    no: P2('PadB'),
  }),
};
