// Cena 3D da tela inicial. O Cavaleiro, ajoelhado de costas na beira de um penhasco, de DIA (sol, grama,
// flores). Lá embaixo, bem longe, no fundo do vale, a cripta com as cores da masmorra (NOITE: escuro, roxo,
// névoa, lanternas). A noite vem pela altura: tudo que fica abaixo da beira do penhasco escurece aos poucos.
// Usado por title.js (cliques, música, transição).
import * as THREE from 'three';
import { loadAll, instance, getGltf } from './assets.js';
import { gfxAtStart } from './graphics.js';

const M = {
  knight: 'heroes/Knight.glb',
  sword: 'weapons/heroes/sword_1handed.gltf',
  crypt: 'props/crypt/crypt.gltf',
  treeL: 'props/crypt/tree_dead_large.gltf',
  treeM: 'props/crypt/tree_dead_medium.gltf',
  treeS: 'props/crypt/tree_dead_small.gltf',
  fence: 'props/crypt/fence.gltf',
  fenceB: 'props/crypt/fence_broken.gltf',
  gate: 'props/crypt/fence_gate.gltf',
  stone: 'props/crypt/gravestone.gltf',
  graveA: 'props/crypt/gravemarker_A.gltf',
  graveB: 'props/crypt/gravemarker_B.gltf',
  postL: 'props/crypt/post_lantern.gltf',
  skel: 'enemies/Skeleton_Minion.glb',
  skelW: 'enemies/Skeleton_Warrior.glb',
  anims: 'animations/Rig_Medium_Special.glb',
};
export const TITLE_MODELS = Object.values(M);

// ---------- palco ----------
// Câmera logo atrás do cavaleiro (bem grande, de costas, no topo da colina, espada fincada ao lado).
// À direita, a colina acaba e começa o vale cheio de névoa; a cripta fica lá no fundo, bem longe.
export const FOV = 40;
const DROP = 30;                                             // altura da colina sobre o vale
const KNIGHT_Z = -5.5;
const KNIGHT_SCALE = 1.4, SWORD_SCALE = 1.1;
const CRYPT_POS = new THREE.Vector3(215, 0, -350);           // y vem do chão do vale
const CRYPT_SCALE = 3.4;
const WIND = new THREE.Vector3(1, 0, -0.22).normalize();    // sopra do campo para o vale
const NIGHT_TOP = -1.5, NIGHT_LOW = -14;                     // a noite começa abaixo do topo
const CAM_BACK = 6.5, CAM_SIDE = 1.3, CAM_H = 2.7, CAM_YAW = 0.42, CAM_PITCH = -0.13; // radianos
const FOG_VALE = [0.4, 0.36, 0.5];                         // névoa cinza-arroxeada do vale
const U = {
  time: { value: 0 }, gust: { value: 0.6 },
  lampPos: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
  lampCol: { value: [new THREE.Color(0xffa040), new THREE.Color(0xffa040), new THREE.Color(0xb070ff)] },
  lampPow: { value: [1, 1, 1] },
};

// Beira do penhasco: o campo fica onde x < edgeX(z); depois disso é o abismo.
// Perto do cavaleiro a beira faz uma ponta arredondada; à frente dele ela recua (ele fica na ponta).
function edgeX(z) {
  const d = z - KNIGHT_Z;
  const tip = 2.4 * Math.exp(-(d * d) / 30) - 0.22 * Math.max(0, -d - 4);
  return -1 + 0.25 * z + tip + 0.4 * Math.sin(z * 0.37 + 0.4) + 0.22 * Math.sin(z * 1.1 + 2) + 0.08 * Math.sin(z * 3.3);
}
const KNIGHT_POS = new THREE.Vector3(edgeX(KNIGHT_Z) - 2.6, 0, KNIGHT_Z);

// Altura do campo (em cima do penhasco): ondulado de leve, subindo em colinas para a esquerda
function groundH(x, z) {
  const roll = 0.3 * Math.sin(x * 0.13 + 1.3) * Math.sin(z * 0.11) + 0.22 * Math.sin(x * 0.06 - z * 0.05);
  const near = Math.min(1, Math.hypot(x - KNIGHT_POS.x, z - KNIGHT_POS.z) / 6); // plano onde ele se ajoelha
  const rise = Math.max(0, -(x - edgeX(z)) - 18) * 0.05;
  const t = Math.min(1, Math.max(0, (x - edgeX(z) + 2.2) / 2.2)); // ombro arredondado da colina
  return (roll + rise) * near - 1.3 * t * t;
}
// Chão do vale lá embaixo
function valleyH(x, z) {
  return -DROP + 1.4 * Math.sin(x * 0.045 + 0.7) * Math.sin(z * 0.038) + 0.8 * Math.sin(x * 0.02 - z * 0.03 + 1);
}

// Câmera: atrás do cavaleiro, virada um pouco para a direita (para a cripta)
const _dirC = Math.atan2(CRYPT_POS.x - KNIGHT_POS.x, CRYPT_POS.z - KNIGHT_POS.z);
const _yaw = _dirC + CAM_YAW;
const _f = new THREE.Vector3(Math.sin(_yaw), 0, Math.cos(_yaw)), _r = new THREE.Vector3(-_f.z, 0, _f.x);
const CAM_POS = KNIGHT_POS.clone().addScaledVector(_f, -CAM_BACK).addScaledVector(_r, CAM_SIDE).setY(CAM_H);
const LOOK = CAM_POS.clone().addScaledVector(_f, 30).setY(CAM_H + Math.tan(CAM_PITCH) * 30);
export const CAM = { pos: CAM_POS, look: LOOK };

// Pedaço de shader comum: quanto de "noite" há num ponto do mundo (pela altura)
const NIGHT_GLSL = `
  float nightAt(vec3 p) { return smoothstep(${NIGHT_TOP.toFixed(2)}, ${NIGHT_LOW.toFixed(2)}, p.y); }`;

// Deixa um material "dia → noite": abaixo da beira escurece e azula como na cripta, a névoa fica roxa,
// e soma a luz das lanternas e da porta (que continuam acesas no escuro).
function nightify(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uLampPos = U.lampPos; sh.uniforms.uLampCol = U.lampCol; sh.uniforms.uLampPow = U.lampPow;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vNW;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        vec4 nwp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          nwp = instanceMatrix * nwp;
        #endif
        vNW = (modelMatrix * nwp).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vNW;
        uniform vec3 uLampPos[3]; uniform vec3 uLampCol[3]; uniform float uLampPow[3];
        ${NIGHT_GLSL}`)
      .replace('#include <fog_fragment>', `
        float nf = nightAt(vNW);
        vec3 base = gl_FragColor.rgb;
        vec3 night = base * vec3(0.22, 0.2, 0.42) + vec3(0.01, 0.008, 0.03);
        gl_FragColor.rgb = mix(base, night, nf);
        for (int i = 0; i < 3; i++) {
          vec3 dl = uLampPos[i] - vNW;
          float a = uLampPow[i] / (1.0 + dot(dl, dl) * 0.03);
          gl_FragColor.rgb += base * uLampCol[i] * a * nf;
        }
        #ifdef USE_FOG
          float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
          // no vale a névoa é roxa e começa mais longe (para a cripta aparecer)
          float fogN = 0.22 + smoothstep( 0.0, 460.0, vFogDepth ) * 0.42;
          vec3 fogC = mix(fogColor, vec3(${FOG_VALE.join(', ')}), nf);
          gl_FragColor.rgb = mix( gl_FragColor.rgb, fogC, mix(fogFactor, fogN, nf) );
        #endif`);
  };
  mat.needsUpdate = true;
  return mat;
}
// Clona os materiais (o jogo usa os mesmos modelos nas salas) e deixa todos dia → noite
function nightifyObject(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map((m) => nightify(m.clone())) : nightify(o.material.clone());
  });
  return obj;
}

// ---------- céu (de dia; perto do horizonte do vale, uma bruma lilás) ----------
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sun: { value: new THREE.Vector3(-0.55, 0.42, -0.7).normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position.z = gl_Position.w; }',
    fragmentShader: `varying vec3 vD; uniform vec3 sun;
      void main(){
        vec3 d = normalize(vD); float h = clamp(d.y, -0.2, 1.0);
        vec3 dz = vec3(0.24,0.48,0.86), dh = vec3(0.72,0.85,0.97);
        vec3 c = mix(dh, dz, smoothstep(0.0, 0.55, h));
        float s = max(dot(d, sun), 0.0);
        c += vec3(1.0,0.92,0.7) * pow(s, 14.0) * 0.35 + vec3(1.0,0.97,0.85) * smoothstep(0.9975, 0.999, s) * 1.5;
        // lado do vale (direita): bruma lilás descendo até o roxo escuro da névoa da cripta
        float vale = smoothstep(-0.25, 0.35, atan(d.x, -d.z));
        vec3 haze = mix(vec3(0.6,0.56,0.72), vec3(${FOG_VALE.join(',')}), smoothstep(0.05, -0.03, d.y));
        c = mix(c, haze, vale * smoothstep(0.22, -0.01, d.y));
        if (d.y < 0.0) c = mix(c, mix(vec3(0.62,0.7,0.6), vec3(${FOG_VALE.join(',')}), vale), smoothstep(0.0, -0.06, d.y));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
  m.renderOrder = -1;
  return m;
}

function cloudTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  for (let i = 0; i < 22; i++) {
    const px = 40 + Math.random() * 176, py = 50 + Math.random() * 40 - (Math.abs(px - 128) < 50 ? 18 : 0), r = 18 + Math.random() * 26;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.6, 'rgba(250,250,255,.5)'); g.addColorStop(1, 'rgba(250,250,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- chão ----------
const GRASS_BASE = new THREE.Color(0x4a8530), GRASS_TIP = new THREE.Color(0xa9cf6a);
// Textura de manchas (mesma para o campo e o vale)
function patchy(mat, k1, k2) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW = (modelMatrix * vec4(position,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vGW;
      float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hs(i),hs(i+vec2(1,0)),f.x), mix(hs(i+vec2(0,1)),hs(i+1.),f.x), f.y); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float n = vn(vGW.xz*0.06)*0.55 + vn(vGW.xz*0.35)*0.3 + vn(vGW.xz*2.0)*0.15;
        diffuseColor.rgb *= mix(vec3(${k1}), vec3(${k2}), n);`);
    if (prev) prev(sh, r);
  };
  return mat;
}

// Campo em cima do penhasco (termina exatamente na beira)
function makeField() {
  const g = new THREE.PlaneGeometry(440, 380, 300, 300); g.rotateX(-Math.PI / 2); g.translate(-180, 0, -160);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i), x = Math.min(p.getX(i), edgeX(z));
    p.setX(i, x); p.setY(i, groundH(x, z));
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, nightify(patchy(new THREE.MeshLambertMaterial({ color: 0x5a9a38 }), '0.72,0.84,0.62', '1.12,1.1,0.86')));
  m.receiveShadow = true;
  return m;
}

// Paredão de pedra: da beira até o fundo do vale, com saliências e camadas
function makeCliff() {
  const nz = 560, nv = 44, z0 = -340, z1 = 30;
  const pos = [], col = [], idx = [];
  const rock = (z, v) => 0.9 * Math.sin(z * 0.8 + v * 7) + 0.55 * Math.sin(z * 2.1 - v * 13 + 1) + 0.3 * Math.sin(z * 4.7 + v * 29) + 0.6 * Math.sin(v * 17 + z * 0.15);
  const c = new THREE.Color();
  for (let i = 0; i <= nz; i++) {
    const z = z0 + (z1 - z0) * i / nz, ex = edgeX(z), top = groundH(ex, z);
    for (let j = 0; j <= nv; j++) {
      const v = j / nv;
      const out = 7 * Math.pow(v, 0.8) + rock(z, v) * Math.min(1, v * 6) * 1.1;
      const y = top * (1 - v) + (-DROP - 3) * v + (j === 1 ? -0.25 : 0);
      pos.push(ex + Math.max(0, out) + (j === 0 ? 0 : 0.15), y, z);
      // camadas de pedra; a borda de cima com um pouco de terra/grama
      const strata = 0.5 + 0.5 * Math.sin(y * 1.7 + Math.sin(z * 0.3) * 1.5);
      c.setRGB(0.52 + strata * 0.1, 0.48 + strata * 0.08, 0.44 + strata * 0.06);
      if (j <= 1) c.setRGB(0.36, 0.52, 0.24);
      else if (j === 2) c.setRGB(0.42, 0.36, 0.28);
      col.push(c.r, c.g, c.b);
      if (i < nz && j < nv) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, nightify(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
}

// Vale lá embaixo (paleta da cripta)
function makeValley() {
  const g = new THREE.PlaneGeometry(1100, 760, 200, 150); g.rotateX(-Math.PI / 2); g.translate(140, 0, -300);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, valleyH(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  return new THREE.Mesh(g, nightify(patchy(new THREE.MeshLambertMaterial({ color: 0x5c6a58 }), '0.6,0.62,0.7', '1.1,1.05,1.0')));
}

// Colinas ao fundo, em cima, do lado de dia
function makeHills() {
  const grp = new THREE.Group();
  const mat = nightify(new THREE.MeshLambertMaterial({ color: 0x6b9e4c }));
  // só onde há campo embaixo (nada de morro flutuando sobre o vale)
  const onField = (x, z, r) => { for (let a = 0; a < 6.3; a += 0.4) { const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r * 0.55; if (px > edgeX(pz) - 6 || px < -395 || pz < -345) return false; } return true; };
  const list = [];
  for (const [z, r, h] of [[-70, 45, 14], [-120, 60, 20], [-170, 70, 24], [-230, 80, 30], [-290, 70, 26]]) {
    let x = edgeX(z) - r - 8;
    while (!onField(x, z, r) && x > -390 + r) x -= 5;
    if (onField(x, z, r)) list.push([x, z, r, h]);
  }
  for (const [x, z, r, h] of list) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    m.scale.set(r, h, r * 0.55); m.position.set(x, -0.3, z); grp.add(m);
  }
  return grp;
}

// Pedras na beira, em cima
const ROCKS = [];
function makeRocks() {
  const grp = new THREE.Group();
  const mat = nightify(new THREE.MeshLambertMaterial({ color: 0x8a847a, flatShading: true }));
  for (const [dz, dx, s] of [[-9, -1.6, 1.1], [-14, -1.4, 0.8], [-20, -2, 1.3]]) {
    // A esfera vem com os triângulos soltos: cada canto tem que mudar igual nos triângulos vizinhos,
    // senão abrem frestas e a grama aparece por dentro. A deformação depende só da posição do canto.
    const geo = new THREE.IcosahedronGeometry(1, 2), p = geo.attributes.position, seed = dz * 3.7;
    for (let i = 0; i < p.count; i++) {
      const x0 = p.getX(i), y0 = p.getY(i), z0 = p.getZ(i);
      const k = 0.82 + 0.2 * Math.sin(x0 * 5.1 + seed) * Math.cos(z0 * 4.3 - seed) + 0.1 * Math.sin(y0 * 7.7 + x0 * 3 + seed);
      p.setXYZ(i, x0 * k, Math.max(y0, -0.35) * k * 0.7, z0 * k);
    }
    geo.computeVertexNormals();
    const z = KNIGHT_Z + dz, x = edgeX(z) + dx;
    const m = new THREE.Mesh(geo, mat); m.scale.setScalar(s); m.position.set(x, groundH(x, z) + s * 0.1, z);
    m.rotation.y = Math.random() * 6; m.castShadow = true; grp.add(m);
    ROCKS.push([x, z, s * 1.4, 0]);
  }
  return grp;
}

// Névoa roxa rasteira no vale
function makeMist() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const px = Math.random() * 256, py = Math.random() * 256, r = 20 + Math.random() * 50;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const grp = new THREE.Group(), mats = [];
  // some aos poucos com a distância (senão vira um lençol liso no horizonte)
  for (const [y, op, col, sp] of [[3, 0.6, 0x8a7aa8, [0.004, 0.002]], [8, 0.5, 0x9d8fb8, [-0.003, 0.004]], [15, 0.35, 0xa89cc0, [0.002, -0.003]]]) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { map: { value: tex }, color: { value: new THREE.Color(col) }, opacity: { value: op }, off: { value: new THREE.Vector2() }, clear: { value: new THREE.Vector2(CRYPT_POS.x, CRYPT_POS.z) } },
      vertexShader: 'varying vec2 vUv; varying float vD; varying vec2 vW; void main(){ vUv = uv * 3.0; vW = (modelMatrix * vec4(position,1.)).xz; vec4 mv = modelViewMatrix * vec4(position,1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform sampler2D map; uniform vec3 color; uniform float opacity; uniform vec2 off; uniform vec2 clear; varying vec2 vUv; varying float vD; varying vec2 vW;
        void main(){ float a = texture2D(map, vUv + off).a * opacity * (1.0 - smoothstep(330.0, 520.0, vD)) * smoothstep(8.0, 40.0, vD) * (0.25 + 0.75 * smoothstep(45.0, 110.0, distance(vW, clear)));
          gl_FragColor = vec4(color, a); }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(260, -DROP + y, -360);
    grp.add(m); mats.push([mat, sp]);
  }
  // Bancos de névoa (nuvens baixas) espalhados pelo vale, indo devagar com o vento
  const bank = cloudTex(), banks = [];
  for (let i = 0; i < 46; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: bank, color: 0xa496c0, transparent: true, opacity: 0.3 + Math.random() * 0.25, depthWrite: false, fog: false }));
    const z = -30 - Math.random() * 380, x = edgeX(z) + 12 + Math.random() * 300, w = 50 + Math.random() * 70;
    // deixa uma janela livre na linha de visão até a cripta
    const dA = Math.atan2(x - CAM_POS.x, z - CAM_POS.z) - Math.atan2(CRYPT_POS.x - CAM_POS.x, CRYPT_POS.z - CAM_POS.z);
    if (Math.hypot(x - CRYPT_POS.x, z - CRYPT_POS.z) < 70 || Math.abs(Math.atan2(Math.sin(dA), Math.cos(dA))) < 0.1) { i--; continue; }
    s.scale.set(w, w * 0.3, 1); s.position.set(x, -DROP + 2 + Math.random() * 10, z);
    s.userData.v = 0.6 + Math.random() * 1.2;
    grp.add(s); banks.push(s);
  }
  grp.userData.update = (t, dt = 0) => {
    for (const [m, sp] of mats) m.uniforms.off.value.set(t * sp[0], t * sp[1]);
    for (const b of banks) { b.position.x += b.userData.v * dt; if (b.position.x > 420) b.position.x = edgeX(b.position.z) + 12; }
  };
  return grp;
}
// ---------- grama: tufos de folhas finas e curvas, cor variando, balançando com o vento ----------
function bladeGeo(seg) {
  // Uma folha: 4 segmentos, curva, mais fina na ponta. Um tufo = 3 folhas abertas em leque.
  const pos = [], col = [], idx = [];
  const blades = [[0, 0, 0, 1], [0.04, 2.1, 0.25, 0.8], [-0.04, -2.0, -0.2, 0.7]];
  let base = 0;
  for (const [ox, rot, lean, hh] of blades) {
    const w = 0.045, c = Math.cos(rot), s = Math.sin(rot);
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, ww = w * (1 - t) ** 0.8 + 0.003;
      const fwd = lean * t * t + 0.12 * t * t, y = t * hh;
      for (const sx of [-ww, ww]) {
        const lx = sx + ox, lz = fwd;
        pos.push(lx * c - lz * s, y, lx * s + lz * c);
        col.push(t, t, t);
      }
      if (i < seg) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    base += (seg + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); // r = altura na folha (0 base, 1 ponta)
  g.setIndex(idx);
  return g;
}

function makeGrass(count, avoid, seg, place) {
  const geo = bladeGeo(seg);
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, vertexColors: true }); // cor do vértice = altura na folha
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time; sh.uniforms.uGust = U.gust;
    sh.uniforms.uBase = { value: GRASS_BASE }; sh.uniforms.uTip = { value: GRASS_TIP };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uGust; uniform vec3 uBase; uniform vec3 uTip; varying vec3 vGC;')
      .replace('#include <color_vertex>', `#include <color_vertex>
        float gt = color.r;
        vec3 ic = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          ic = instanceColor.rgb;
        #endif
        vGC = mix(uBase * 0.75, uTip, pow(gt, 1.3)) * ic;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3][0], 0., instanceMatrix[3][2]);
        float k = color.r * color.r;
        float wave = sin(uTime*1.8 - ip.x*0.32 - ip.z*0.1) * 0.5 + 0.5;
        float flick = sin(uTime*6.0 + ip.x*3.1 + ip.z*2.3) * 0.06;
        float bend = (0.12 + uGust * 0.42 * wave + flick) * k;`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = vec4(transformed, 1.0);
        mvPosition = instanceMatrix * mvPosition;
        mvPosition.xyz += vec3(${WIND.x.toFixed(3)}, -0.3 * bend, ${WIND.z.toFixed(3)}) * bend * instanceMatrix[1][1];
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`)
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\ntransformedNormal = normalMatrix * vec3(0.,1.,0.);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGC;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb = vGC;');
  };
  nightify(mat);
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  const tilt = new THREE.Quaternion(), ax = new THREE.Vector3(1, 0, 0);
  let n = 0;
  const put = (x, z, hh) => {
    if (n >= count) return;
    for (const [axx, az, ar, ah] of avoid) { const d = Math.hypot(x - axx, z - az); if (d < ar) { if (ah === 0) return; hh = Math.min(hh, ah + (hh - ah) * (d / ar) ** 2); } }
    q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
    q.multiply(tilt.setFromAxisAngle(ax, (Math.random() - 0.5) * 0.35));
    const sc = 0.8 + Math.random() * 0.6;
    s.set(sc, hh * (0.65 + Math.random() * 0.6), sc); p.set(x, groundH(x, z) - 0.02, z);
    m.compose(p, q, s); mesh.setMatrixAt(n, m);
    c.setHSL(0.24 + Math.random() * 0.06, 0.55 + Math.random() * 0.2, 0.42 + Math.random() * 0.16);
    c.multiplyScalar(1.6);
    mesh.setColorAt(n, c); n++;
  };
  let guard = 0;
  while (n < count && guard++ < count * 4) place(put);
  mesh.count = n; mesh.frustumCulled = false;
  mesh.instanceColor.needsUpdate = true;
  return mesh;
}

// Florzinhas no campo, em cima
function makeFlowers() {
  const n = 700, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const pal = [[1, 0.95, 0.55], [1, 1, 1], [0.98, 0.62, 0.82], [0.72, 0.78, 1]];
  let k = 0;
  while (k < n) {
    const z = -32 + Math.random() * 45, x = edgeX(z) - 0.6 - Math.random() * 22;
    pos[k * 3] = x; pos[k * 3 + 1] = groundH(x, z) + 0.28 + Math.random() * 0.2; pos[k * 3 + 2] = z;
    col.set(pal[(Math.random() * pal.length) | 0], k * 3); k++;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, nightify(new THREE.PointsMaterial({ size: 0.07, vertexColors: true })));
}

// Folhinhas levadas pelo vento, do campo para o abismo (lá fora vão caindo)
function makeLeaves() {
  const n = 60, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
  const seeds = [];
  const spawn = (s, any) => { s.z = -16 + Math.random() * 20; s.x = edgeX(s.z) - (any ? Math.random() * 14 : 14); s.y = 0.6 + Math.random() * 3.5; s.v = 2 + Math.random() * 2.5; s.ph = Math.random() * 6; };
  for (let i = 0; i < n; i++) { const s = {}; spawn(s, true); seeds.push(s); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
  x.fillStyle = '#d8e89a'; x.beginPath(); x.ellipse(16, 16, 12, 5, 0.6, 0, 7); x.fill();
  const pts = new THREE.Points(g, nightify(new THREE.PointsMaterial({ size: 0.13, map: new THREE.CanvasTexture(c), transparent: true, alphaTest: 0.3, color: 0xe8f0b0 })));
  pts.frustumCulled = false;
  pts.userData.update = (dt, t, gust) => {
    for (let i = 0; i < n; i++) {
      const s = seeds[i];
      s.x += WIND.x * s.v * (0.5 + gust) * dt; s.z += WIND.z * s.v * (0.5 + gust) * dt;
      s.y += Math.sin(t * 2 + s.ph) * 0.4 * dt;
      if (s.x > edgeX(s.z) + 1) s.y -= 1.2 * dt; // no abismo, vai caindo
      if (s.x > edgeX(s.z) + 26) spawn(s, false);
      pos[i * 3] = s.x; pos[i * 3 + 1] = s.y + Math.sin(t * 3 + s.ph) * 0.15; pos[i * 3 + 2] = s.z;
    }
    g.attributes.position.needsUpdate = true;
  };
  return pts;
}

// Vaga-lumes / brilhos perto da cripta
function makeFireflies(center) {
  const n = 50, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seeds = [];
  for (let i = 0; i < n; i++) seeds.push({ x: center.x - 45 + Math.random() * 90, z: center.z - 20 + Math.random() * 70, y: center.y + 1 + Math.random() * 8, ph: Math.random() * 7 });
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
  const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,240,170,1)'); gr.addColorStop(1, 'rgba(255,220,120,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  pts.frustumCulled = false;
  pts.userData.update = (t) => {
    for (let i = 0; i < n; i++) {
      const s = seeds[i];
      pos[i * 3] = s.x + Math.sin(t * 0.4 + s.ph) * 2; pos[i * 3 + 1] = s.y + Math.sin(t * 0.9 + s.ph * 2) * 0.7; pos[i * 3 + 2] = s.z + Math.cos(t * 0.3 + s.ph) * 2;
    }
    g.attributes.position.needsUpdate = true;
  };
  return pts;
}

// ---------- cavaleiro ajoelhado ----------
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
// Gira o osso para que a direção osso→filho fique igual a dir (no espaço do personagem).
function aim(bone, child, dir) {
  bone.updateWorldMatrix(true, true);
  bone.getWorldPosition(_a); child.getWorldPosition(_b);
  const cur = _b.sub(_a).normalize();
  _q1.setFromUnitVectors(cur, dir.clone().normalize());
  bone.getWorldQuaternion(_q2); bone.parent.getWorldQuaternion(_q3);
  bone.quaternion.copy(_q3.invert().multiply(_q1.multiply(_q2)));
  bone.updateWorldMatrix(false, true);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function makeKnight() {
  const root = new THREE.Group();
  const k = instance(M.knight);
  root.add(k);
  const B = {};
  k.traverse((o) => { if (o.isBone) B[o.name] = o; if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  k.updateMatrixWorld(true);
  // Ossos que a pose usa (para guardar e misturar as poses: ajoelhado → em pé → apontando)
  const POSE = ['hips', 'spine', 'chest', 'head', 'upperlegl', 'lowerlegl', 'footl', 'upperlegr', 'lowerlegr', 'footr',
    'upperarml', 'lowerarml', 'upperarmr', 'lowerarmr'].filter((n) => B[n]);
  const snap = () => ({ q: POSE.map((n) => B[n].quaternion.clone()), hy: B.hips.position.y });
  const put = (P) => { POSE.forEach((n, i) => B[n].quaternion.copy(P.q[i])); B.hips.position.y = P.hy; k.updateMatrixWorld(true); };
  const bind = snap();
  B.hips.position.y -= 0.21; // quadril baixo (ajoelhado)
  B.hips.updateWorldMatrix(true, true);
  // Perna direita: coxa para a frente, canela em pé, pé no chão
  aim(B.upperlegr, B.lowerlegr, V(-0.12, -0.12, 1));
  aim(B.lowerlegr, B.footr, V(0, -1, 0.04));
  aim(B.footr, B.toesr, V(0, -0.75, 0.66));
  // Perna esquerda: joelho no chão, canela deitada para trás, ponta do pé apoiada
  aim(B.upperlegl, B.lowerlegl, V(0.1, -1, -0.12));
  aim(B.lowerlegl, B.footl, V(0.02, -0.1, -1));
  aim(B.footl, B.toesl, V(0, -0.85, -0.5));
  // Tronco levemente inclinado e cabeça baixa
  aim(B.spine, B.chest, V(0, 1, 0.12));
  aim(B.chest, B.head, V(0, 1, 0.2));
  // Braço esquerdo relaxado sobre a coxa; o direito segura o cabo da espada fincada ao lado (lado do vale)
  aim(B.upperarml, B.lowerarml, V(0.3, -0.85, 0.35));
  aim(B.lowerarml, B.wristl, V(0.05, -0.45, 1));
  const sword = instance(M.sword);
  sword.rotation.set(Math.PI, 0, 0.06);
  sword.scale.setScalar(SWORD_SCALE);
  sword.updateMatrixWorld(true);
  const sb = new THREE.Box3().setFromObject(sword);       // lâmina para baixo: min.y = ponta
  const grip = V(-0.62, -sb.min.y - 0.22, 0.3);            // ponta 0,22 enterrada no chão
  k.updateMatrixWorld(true);
  const sh = new THREE.Vector3(); B.upperarmr.getWorldPosition(sh);
  aim(B.upperarmr, B.lowerarmr, grip.clone().sub(sh).add(V(-0.25, 0.15, -0.1)));
  const el = new THREE.Vector3(); B.lowerarmr.getWorldPosition(el);
  aim(B.lowerarmr, B.wristr, grip.clone().sub(el));
  k.updateMatrixWorld(true);
  const hand = new THREE.Vector3(); B.handslotr.getWorldPosition(hand);
  sword.position.set(hand.x, grip.y, hand.z);
  sword.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.add(sword);
  root.updateMatrixWorld(true);
  // A espada fica presa ao cavaleiro (não à mão): fincada no chão, ela só SOBE quando ele a puxa.
  const P0 = snap(), SW0 = sword.quaternion.clone();
  const GRIP = sword.position.clone();   // cabo, no espaço do cavaleiro
  const LIFT = 0.42;                      // quanto a espada sobe ao sair do chão
  const ARM = ['upperarmr', 'lowerarmr'].map((n) => POSE.indexOf(n));
  let P1 = P0, PB = P0, P2 = P0, Q2 = SW0, yaw0 = 0, yaw2 = 0;
  const cur = { q: POSE.map(() => new THREE.Quaternion()), hy: 0 };
  const _t = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Vector3(), _w = new THREE.Vector3(), _h = new THREE.Vector3(), _n = new THREE.Vector3(), _g = new THREE.Vector3(), _qa = new THREE.Quaternion();
  const UP = V(0, 1, 0);
  const loc = (x, y, z) => V(x, y, z).applyQuaternion(root.quaternion); // direção do corpo → mundo

  // Braço direito (2 ossos) levando a mão até o ponto p (espaço do cavaleiro). Cotovelo para fora e para trás.
  const reach = (p) => {
    const T = root.localToWorld(_t.copy(p)), goal = T.clone(), pole = loc(-1, -0.25, -0.5);
    for (let it = 0; it < 3; it++) {
      B.upperarmr.updateWorldMatrix(true, true);
      B.upperarmr.getWorldPosition(_s); B.lowerarmr.getWorldPosition(_e); B.wristr.getWorldPosition(_w);
      const a = _e.distanceTo(_s), b = _w.distanceTo(_e);
      const d = goal.clone().sub(_s), len = Math.max(0.01, Math.min(d.length(), (a + b) * 0.999)); d.normalize();
      const cosA = Math.min(1, Math.max(-1, (a * a + len * len - b * b) / (2 * a * len))), sinA = Math.sqrt(1 - cosA * cosA);
      _n.copy(pole).addScaledVector(d, -pole.dot(d)).normalize();
      const elbow = _s.clone().addScaledVector(d, a * cosA).addScaledVector(_n, a * sinA);
      aim(B.upperarmr, B.lowerarmr, elbow.sub(_s));
      B.lowerarmr.getWorldPosition(_e);
      aim(B.lowerarmr, B.wristr, goal.clone().sub(_e));
      B.handslotr.getWorldPosition(_h);
      goal.add(T.clone().sub(_h)); // corrige: quem tem que chegar no cabo é a palma, não o pulso
    }
  };
  // Gira um osso em volta do eixo vertical do mundo
  const turn = (bone, ang) => {
    bone.updateWorldMatrix(true, false);
    bone.getWorldQuaternion(_q2); _q1.setFromAxisAngle(UP, ang).multiply(_q2);
    bone.parent.getWorldQuaternion(_q3);
    bone.quaternion.copy(_q3.invert().multiply(_q1));
    bone.updateWorldMatrix(false, true);
  };
  const setYaw = (y) => { root.rotation.y = y; root.updateMatrixWorld(true); };

  // Poses da ação (feitas depois que o cavaleiro já está no lugar e virado):
  // P1 em pé com a mão no cabo (espada ainda no chão) → PB espada puxada para cima →
  // P2 em guarda: lado direito à frente, esquerdo atrás, braço direito estendido apontando a espada para a cripta.
  root.userData.makeAction = (target) => {
    yaw0 = root.rotation.y;
    const toT = Math.atan2(target.x - root.position.x, target.z - root.position.z);
    let dA = toT - yaw0; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
    yaw2 = yaw0 + dA * 0.95;
    setYaw(yaw0);
    put(bind);
    aim(B.upperarml, B.lowerarml, loc(0.35, -1, -0.05));
    aim(B.lowerarml, B.wristl, loc(0.1, -1, 0.15));
    P1 = snap();
    reach(_g.copy(GRIP).setY(GRIP.y + LIFT));
    PB = snap();
    // Em guarda (já virado para a cripta)
    setYaw(yaw2);
    put(bind);
    const toe = (f, t) => { f.updateWorldMatrix(true, true); return t.getWorldPosition(new THREE.Vector3()).sub(f.getWorldPosition(new THREE.Vector3())); };
    const fr = toe(B.footr, B.toesr), fl = toe(B.footl, B.toesl);
    B.hips.position.y = bind.hy - 0.05;
    turn(B.hips, 1.0); // quadril de lado: direito à frente
    aim(B.upperlegr, B.lowerlegr, loc(-0.12, -1, 0.42));
    aim(B.lowerlegr, B.footr, loc(-0.05, -1, 0.1));
    aim(B.upperlegl, B.lowerlegl, loc(0.16, -1, -0.38));
    aim(B.lowerlegl, B.footl, loc(0.14, -1, -0.4));
    aim(B.footr, B.toesr, fr.applyAxisAngle(UP, 0.25));
    aim(B.footl, B.toesl, fl.applyAxisAngle(UP, 1.0)); // pé de trás virado para fora
    aim(B.spine, B.chest, loc(0, 1, 0.06));
    turn(B.chest, 0.2);
    turn(B.head, -1.0); // olha para a cripta
    aim(B.upperarml, B.lowerarml, loc(0.42, -1, -0.45)); // braço esquerdo solto, para trás
    aim(B.lowerarml, B.wristl, loc(0.2, -1, -0.15));
    B.upperarmr.updateWorldMatrix(true, false);
    const sh = B.upperarmr.getWorldPosition(new THREE.Vector3());
    const dir = target.clone().sub(sh).normalize(); dir.y = Math.max(dir.y, 0) + 0.12; dir.normalize();
    aim(B.upperarmr, B.lowerarmr, dir);
    aim(B.lowerarmr, B.wristr, dir);
    P2 = snap();
    // espada: gira da lâmina para baixo até a direção da cripta (no espaço do cavaleiro)
    const rq = root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const dl = dir.clone().applyQuaternion(rq), down = V(0, 1, 0).applyQuaternion(SW0);
    Q2 = new THREE.Quaternion().setFromUnitVectors(down, dl).multiply(SW0);
    setYaw(yaw0);
    put(P0);
    sword.position.copy(GRIP); sword.quaternion.copy(SW0);
  };
  const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  // u: 0 = ajoelhado; até 0,3 levanta (mão no cabo); até 0,55 puxa a espada para cima; até 0,95 entra em guarda e aponta
  const pose = (u) => {
    const a = ease(u / 0.3), b = ease((u - 0.3) / 0.25), c = ease((u - 0.55) / 0.4);
    if (c <= 0) {
      setYaw(yaw0);
      POSE.forEach((n, i) => cur.q[i].copy(P0.q[i]).slerp(P1.q[i], a));
      cur.hy = P0.hy + (P1.hy - P0.hy) * a;
      put(cur);
      _g.copy(GRIP); _g.y += LIFT * b;
      if (u > 0) {
        reach(_g);
        const w = ease(u / 0.06);
        for (const i of ARM) { const bn = B[POSE[i]]; _qa.copy(bn.quaternion); bn.quaternion.copy(P0.q[i]).slerp(_qa, w); }
        k.updateMatrixWorld(true);
      }
      sword.position.copy(_g); sword.quaternion.copy(SW0);
    } else {
      setYaw(yaw0 + (yaw2 - yaw0) * c);
      POSE.forEach((n, i) => cur.q[i].copy(PB.q[i]).slerp(P2.q[i], c));
      cur.hy = PB.hy + (P2.hy - PB.hy) * c;
      put(cur);
      B.handslotr.getWorldPosition(_h); root.worldToLocal(_h);
      _g.copy(GRIP); _g.y += LIFT;
      sword.position.copy(_g).lerp(_h, Math.min(1, c * 3));
      sword.quaternion.copy(SW0).slerp(Q2, c);
    }
  };

  // Capa ao vento: deforma a capa depois do esqueleto (quanto mais baixo, mais balança).
  const capeU = { uWind: { value: new THREE.Vector3() }, uFloor: { value: 0.03 } };
  k.traverse((o) => {
    if (!o.isMesh || o.name !== 'Knight_Cape') return;
    o.material = o.material.clone();
    o.material.side = THREE.DoubleSide;
    o.material.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, capeU, { uTime: U.time, uGust: U.gust });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uGust; uniform vec3 uWind; uniform float uFloor;')
        .replace('#include <skinning_vertex>', `#include <skinning_vertex>
          float w = clamp((1.22 - position.y) / 1.12, 0.0, 1.0);
          float w2 = w * w;
          float ph = uTime * 5.5 - position.y * 6.0 + position.x * 4.0;
          float flap = sin(ph) * 0.5 + 0.5;
          float side = sin(uTime * 3.1 + position.x * 2.0 - position.y * 3.0);
          vec3 wd = normalize(uWind + vec3(0.0, 0.0, 0.001));
          transformed += wd * w2 * (0.3 + uGust * 0.6) * (0.6 + 0.4 * flap);
          transformed.z -= w2 * (0.22 + 0.15 * uGust + 0.08 * side);
          transformed.y += w2 * (0.2 + 0.25 * uGust) * (0.7 + 0.3 * flap) + w * 0.04 * side;
          transformed.y = max(transformed.y, uFloor);`);
    };
  });
  root.userData.update = (t, windLocal, act = 0) => {
    capeU.uWind.value.copy(windLocal);
    pose(act);
    const calm = 1 - Math.min(1, act * 3);
    B.chest.quaternion.multiply(_q1.setFromAxisAngle(V(1, 0, 0), Math.sin(t * 1.4) * 0.025));
    B.head.quaternion.multiply(_q1.setFromAxisAngle(V(0, 1, 0), Math.sin(t * 0.37) * 0.06 * calm));
  };
  root.scale.setScalar(KNIGHT_SCALE);
  return root;
}

// ---------- cripta lá no fundo (noite) ----------
function glowSprite(color, size) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, color); g.addColorStop(0.3, color.replace(/[\d.]+\)$/, '0.45)')); g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.setScalar(size);
  return s;
}

function makeCrypt() {
  const g = new THREE.Group();
  const add = (p, x, z, ry = 0, s = 1) => { const o = nightifyObject(instance(p)); o.position.set(x, 0, z); o.rotation.y = ry; o.scale.setScalar(s); g.add(o); return o; };
  const crypt = add(M.crypt, 0, 0, 0);
  add(M.treeL, -7, -3, 0.4, 1.4); add(M.treeM, 6.5, -4, 2, 1.3); add(M.treeS, 9, 2, 1); add(M.treeL, 13, -8, 2.5, 1.2);
  for (let i = -3; i <= 3; i++) { if (i !== 0) add(i === -2 || i === 2 ? M.fenceB : M.fence, i * 4, 8, 0); }
  add(M.gate, 0, 8, 0);
  add(M.postL, -2.6, 8.6, 0); add(M.postL, 2.6, 8.6, Math.PI);
  add(M.stone, -9, 4, 0.3); add(M.graveA, -11, 1, -0.2); add(M.graveB, 10, 5, 0.5); add(M.stone, 11, 0, -0.4); add(M.graveA, -5, 11, 0.2);
  g.position.copy(CRYPT_POS).setY(valleyH(CRYPT_POS.x, CRYPT_POS.z));
  g.scale.setScalar(CRYPT_SCALE);
  g.lookAt(CAM_POS.x, g.position.y, CAM_POS.z); // de frente para quem olha
  // Luzes: lanternas do portão e porta roxa (somadas no shader; brilhos por cima)
  const lamps = [V(-2.6, 3.0, 8.6), V(2.6, 3.0, 8.6), V(0, 2.2, 4.2)];
  g.updateMatrixWorld(true);
  lamps.forEach((l, i) => U.lampPos.value[i].copy(l).applyMatrix4(g.matrixWorld));
  const glows = [glowSprite('rgba(255,180,90,1)', 3.4), glowSprite('rgba(255,180,90,1)', 3.4), glowSprite('rgba(190,120,255,1)', 8)];
  glows.forEach((s, i) => { s.position.copy(lamps[i]); g.add(s); });
  g.userData.glows = glows;
  g.userData.main = crypt;
  return g;
}

// Árvores secas e lápides espalhadas pelo vale
function makeValleyProps() {
  const g = new THREE.Group();
  const kinds = [M.treeL, M.treeM, M.treeS, M.treeL, M.stone, M.graveA, M.graveB];
  let n = 0, guard = 0;
  while (n < 70 && guard++ < 900) {
    const z = -40 - Math.random() * 300, x = edgeX(z) + 10 + Math.random() * 190;
    if (Math.hypot(x - CRYPT_POS.x, z - CRYPT_POS.z) < 26) continue;
    const kind = kinds[(Math.random() * kinds.length) | 0];
    const o = nightifyObject(instance(kind));
    const tree = kind === M.treeL || kind === M.treeM || kind === M.treeS;
    o.position.set(x, valleyH(x, z), z); o.rotation.y = Math.random() * 6.3; o.scale.setScalar((tree ? 1.6 : 1.4) + Math.random() * 0.8);
    g.add(o); n++;
  }
  return g;
}

// Esqueletos andando em volta da cripta (lá longe: só dá para notar o movimento)
function makeSkeletons(center) {
  const g = new THREE.Group(), list = [];
  const clip = (() => {
    const src = getGltf(M.anims).animations.find((c) => c.name === 'Skeletons_Walking');
    const c = src.clone(); c.tracks = c.tracks.filter((t) => t.name !== 'root.position'); return c;
  })();
  for (let i = 0; i < 9; i++) {
    const o = nightifyObject(instance(i % 3 ? M.skel : M.skelW));
    o.scale.setScalar(3.2);
    const mixer = new THREE.AnimationMixer(o);
    const act = mixer.clipAction(clip); act.play(); act.time = Math.random() * clip.duration;
    const r = 6 + Math.random() * 38, dir = Math.random() < 0.5 ? 1 : -1;
    list.push({ o, mixer, r, a: Math.random() * Math.PI * 2, w: dir * 2.3 / r, wob: Math.random() * 6 });
    g.add(o);
  }
  g.userData.update = (dt, t) => {
    for (const s of list) {
      s.mixer.update(dt);
      s.a += s.w * dt;
      const r = s.r + Math.sin(t * 0.2 + s.wob) * 4;
      const x = center.x + Math.cos(s.a) * r, z = center.z + Math.sin(s.a) * r * 0.35;
      s.o.position.set(x, valleyH(x, z), z);
      s.o.rotation.y = Math.atan2(-Math.sin(s.a) * s.w, Math.cos(s.a) * s.w * 0.35);
    }
  };
  return g;
}

export async function buildTitleScene() {
  await loadAll(TITLE_MODELS);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb8cbe0, 60, 300);
  scene.add(makeSky());
  const sunDir = new THREE.Vector3(-0.5, 0.55, 0.2).normalize();
  scene.add(new THREE.HemisphereLight(0xd6e6ff, 0x4f7a32, 1.5));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.4);
  scene.add(sun);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 60 });
  sun.shadow.bias = -0.0008;
  scene.add(makeField(), makeCliff(), makeValley(), makeHills(), makeRocks());
  const mist = makeMist(); scene.add(mist);
  scene.add(makeValleyProps());

  // Nuvens no céu de dia
  const ctex = cloudTex(), clouds = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctex, transparent: true, opacity: 0.85, fog: false, depthWrite: false }));
    const w = 60 + Math.random() * 70; s.scale.set(w, w * 0.42, 1);
    s.position.set(-280 + Math.random() * 360, 60 + Math.random() * 70, -270 - Math.random() * 100);
    scene.add(s); clouds.push(s);
  }

  const knight = makeKnight();
  knight.position.copy(KNIGHT_POS).setY(groundH(KNIGHT_POS.x, KNIGHT_POS.z) - 0.02);
  scene.add(knight);
  const crypt = makeCrypt(); scene.add(crypt);
  // De costas para a câmera, olhando para a cripta lá embaixo
  const toCrypt = Math.atan2(CRYPT_POS.x - knight.position.x, CRYPT_POS.z - knight.position.z);
  const away = Math.atan2(knight.position.x - CAM_POS.x, knight.position.z - CAM_POS.z);
  let dA = toCrypt - away; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
  knight.rotation.y = away + dA * 0.6;
  knight.userData.makeAction(crypt.userData.main.getWorldPosition(new THREE.Vector3()).add(V(0, 6, 0)));
  sun.position.copy(knight.position).addScaledVector(sunDir, 30);
  sun.target = knight;

  // Grama só em cima (perto: folhas com mais curvas; longe: folhas simples, mais leve)
  const avoid = [[knight.position.x, knight.position.z, 1.6, 0.14], ...ROCKS];
  const q = gfxAtStart.simple ? 0.5 : 1;
  scene.add(makeGrass(Math.round(24000 * q), avoid, 4, (put) => {
    const z = -14 + Math.random() * 27, x = edgeX(z) - 0.15 - Math.random() * (12 + Math.max(0, z) * 0.6);
    put(x, z, 0.35);
  }));
  scene.add(makeGrass(Math.round(24000 * q), avoid, 1, (put) => {
    const z = -60 + Math.random() * 64, x = edgeX(z) - 0.15 - Math.random() * (z < -14 ? 45 : 40);
    if (z < -14 || x < edgeX(z) - 12) put(x, z, 0.6);
  }));
  scene.add(makeFlowers());
  const leaves = makeLeaves(); scene.add(leaves);
  const flies = makeFireflies(crypt.position); scene.add(flies);
  // na frente da cripta (lado de quem olha), onde a névoa é mais rala
  const skC = crypt.position.clone().add(V(CAM_POS.x - crypt.position.x, 0, CAM_POS.z - crypt.position.z).setLength(48));
  const skels = makeSkeletons(skC); scene.add(skels);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 1400);
  const _inv = new THREE.Quaternion(), _wl = new THREE.Vector3();
  const state = { mouseX: 0, mouseY: 0, mx: 0, my: 0, zoom: 0, act: 0 };
  const look = new THREE.Vector3();
  // Transição: a câmera mergulha do penhasco até a porta da cripta
  const toCam = V(CAM_POS.x - crypt.position.x, 0, CAM_POS.z - crypt.position.z).normalize();
  const zoomPos = crypt.position.clone().addScaledVector(toCam, 80).add(V(-6, 16, 0)), zoomLook = crypt.position.clone().add(V(0, 9, 0));
  const startLook = LOOK.clone();

  return {
    scene, camera, knight, crypt, state, skels, mist,
    // Caixa da cripta na tela (para o clique). Devolve {x0,y0,x1,y1} em 0..1.
    cryptRect() {
      const box = new THREE.Box3().setFromObject(crypt.userData.main).expandByScalar(5);
      const xs = [], ys = [];
      for (let i = 0; i < 8; i++) {
        const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
        xs.push(p.x * 0.5 + 0.5); ys.push(0.5 - p.y * 0.5);
      }
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    },
    update(dt, t, hover) {
      U.time.value = t;
      const gust = 0.55 + 0.3 * Math.sin(t * 0.45) + 0.15 * Math.sin(t * 1.27 + 1);
      U.gust.value = gust;
      knight.getWorldQuaternion(_inv).invert();
      _wl.copy(WIND).applyQuaternion(_inv);
      knight.userData.update(t, _wl, state.act);
      leaves.userData.update(dt, t, gust);
      flies.userData.update(t);
      skels.userData.update(dt, t);
      mist.userData.update(t, dt);
      for (const c of clouds) { c.position.x += dt * 2.2; if (c.position.x > 90) c.position.x = -290; }
      // lanternas tremulando; a porta acende com o mouse em cima
      const fl = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
      U.lampPow.value[0] = 1.4 * fl; U.lampPow.value[1] = 1.4 * (1.7 - fl);
      const door = hover ? 5 : 1.4 + 0.4 * Math.sin(t * 2);
      U.lampPow.value[2] += (door - U.lampPow.value[2]) * Math.min(1, dt * 5);
      const gl = crypt.userData.glows;
      gl[0].material.opacity = 0.7 * fl; gl[1].material.opacity = 0.7 * (1.7 - fl);
      gl[2].scale.setScalar(4 + U.lampPow.value[2] * 1.4);
      // câmera: leve movimento com o mouse; zoom = mergulho até a cripta na transição
      state.mx += (state.mouseX - state.mx) * Math.min(1, dt * 2.5);
      state.my += (state.mouseY - state.my) * Math.min(1, dt * 2.5);
      const z = state.zoom * state.zoom * (3 - 2 * state.zoom);
      camera.position.copy(CAM_POS).add(_a.set(state.mx * 0.35, -state.my * 0.15 + Math.sin(t * 0.6) * 0.02, 0));
      look.copy(startLook).add(_b.set(state.mx * 1.2, -state.my * 0.6, 0));
      // primeiro avança, depois desce (para não atravessar o penhasco)
      const zy = z * z;
      camera.position.set(
        camera.position.x + (zoomPos.x - camera.position.x) * z,
        camera.position.y + (zoomPos.y - camera.position.y) * zy,
        camera.position.z + (zoomPos.z - camera.position.z) * z);
      look.lerp(zoomLook, Math.min(1, z * 1.6));
      camera.lookAt(look);
    },
  };
}
