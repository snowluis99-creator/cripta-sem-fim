// Cena de desbloqueio do Ladino na Taverna ("Facas na parede", escolha do dono): ele sobe na mesa,
// provoca todo mundo e arremessa adagas que prendem a capa de cada um na parede do fundo; depois desce,
// faz uma reverência, estala os dedos e as adagas somem (todos caem no chão e comemoram). No fim, o aviso.
// Usa o mesmo UnlockScene (unlock.js): s = a cena (atores, câmera, aviso).
import * as THREE from 'three';
import { audio } from './audio.js';
import { instance } from './assets.js';

const KNIFE = 'weapons/heroes/dagger.gltf';
const TABLE = new THREE.Vector3(-9, 1.0, 4.4);   // em cima da mesa dos heróis
const FLOOR = new THREE.Vector3(-0.5, 0, -5.2);  // onde ele desce para a reverência (na frente da parede)
const WALL_Z = -11.05;                            // frente da parede do fundo
const PINS = [-6.8, -1.6, 1.6, 4.6, 7.6, 10.6, 13.2]; // lugares livres na parede (sem barris)
const START_VIEW = new THREE.Vector3(-5, 0, 0), THROW_VIEW = new THREE.Vector3(-1, 0, -3), WALL_VIEW = new THREE.Vector3(1.5, 0, -6.5);
const T = { stand: 0, jump: 0.6, land: 1.35, taunt: 1.5, throw0: 2.2, gap: 0.42, flight: 0.2, fly: 0.32 };

function knife() {
  const k = instance(KNIFE);
  k.scale.setScalar(1.25);
  const g = new THREE.Group();
  g.add(k);
  k.rotation.x = Math.PI / 2; // lâmina para a frente (+Z do grupo)
  k.position.z = -0.5;
  return g;
}

export function startRogue(s) {
  s.mode = 'rogue';
  s.knives = [];
  s.endAt = FLOOR.clone();
  s.focus = new THREE.Vector3(-4, 0, -1);  // começa entre a mesa e a parede; depois vai para a parede
  if (s.cam.setBaseZoom) s.cam.setBaseZoom(0.95);
  // Cada ator ganha um lugar na parede (ordenado pela posição para ninguém cruzar).
  const order = [...s.actors].sort((a, b) => a.group.position.x - b.group.position.x);
  order.forEach((a, i) => {
    a.pin = new THREE.Vector3(PINS[Math.min(i, PINS.length - 1)] + (i >= PINS.length ? (i - PINS.length + 1) * 1.2 : 0), 0.55, WALL_Z + 0.45);
    a.state = 'wait';
  });
  s.throwOrder = order;
  // Luz própria no Ladino (a taverna é escura no meio): dá para ver ele na mesa e na reverência.
  // (usa uma das luzes que já ficam apagadas na Taverna: acender uma luz nova trava o jogo um instante)
  s.rogueLight = (s.tavern.fireLights || [])[0] || null;
  if (s.rogueLight) { s.rogueLight.color.setHex(0xffd2a0); s.rogueLight.intensity = 14; s.rogueLight.distance = 10; }
  s.thrown = 0;
  s.mage.anim.play('Sit_Chair_StandUp', { once: true, restart: true, speed: 1.6, fade: 0.1 });
}

export function updateRogue(s, dt) {
  const t0 = s.t, t = (s.t += dt);
  const at = (k) => t0 < k && t >= k;
  const r = s.mage; // o Ladino (cadeira dele)
  // Câmera: mesa + parede enquanto arremessa; depois chega perto da parede (reverência e todos presos).
  const want = s.downT !== undefined ? WALL_VIEW : t > T.throw0 ? THROW_VIEW : START_VIEW;
  s.focus.lerp(want, Math.min(1, dt * 1.5));
  if (s.rogueLight) s.rogueLight.position.set(r.group.position.x, r.group.position.y + 3.4, r.group.position.z + 1);
  // 1) Sobe na mesa.
  if (at(T.jump)) { r.anim.play('Jump_Full_Long', { once: true, restart: true, speed: 1.3, fade: 0.08 }); audio.play('dodge', s.from.x, s.from.z); }
  if (t >= T.jump && t < T.land) {
    const k = (t - T.jump) / (T.land - T.jump);
    r.group.position.lerpVectors(s.from, TABLE, k);
    r.group.position.y = TABLE.y * k + Math.sin(k * Math.PI) * 2.2;
    r.group.rotation.y = Math.atan2(TABLE.x - s.from.x, TABLE.z - s.from.z);
  }
  if (at(T.land)) {
    r.group.position.copy(TABLE);
    r.group.rotation.y = Math.PI; // de frente para o fundo da taverna
    r.anim.play('Jump_Land', { once: true, restart: true, fade: 0.05 });
    audio.play('thump', TABLE.x, TABLE.z);
    s.cam.shake(0.2);
  }
  // 2) Provoca: todo mundo levanta assustado.
  if (at(T.taunt)) {
    s.say('Ei, vocês! Olhem para cá!', r.group.position);
    r.anim.play('Waving', { once: true, restart: true, speed: 1.4, fade: 0.1 });
    for (const a of s.actors) {
      if (a.keeper) { a.anim.play('Idle_B', { fade: 0.2 }); continue; }
      if (a.seated) a.anim.play('Sit_Chair_StandUp', { once: true, restart: true, speed: 2, fade: 0.08 });
      a.state = 'stand';
    }
  }
  // 3) Uma adaga para cada um: voa, acerta a capa e prende o ator na parede.
  const due = T.throw0 + s.thrown * T.gap;
  if (s.thrown < s.throwOrder.length && t >= due) {
    const a = s.throwOrder[s.thrown++];
    const from = r.group.position.clone().setY(TABLE.y + 1.4);
    r.group.rotation.y = Math.atan2(a.group.position.x - from.x, a.group.position.z - from.z);
    r.anim.play('Throw', { once: true, restart: true, speed: 2.2, fade: 0.05 });
    audio.play('swing', from.x, from.z);
    const k = knife();
    k.position.copy(from);
    s.scene.add(k);
    s.knives.push({ g: k, a, from, t: 0, state: 'fly' });
  }
  for (const a of s.actors) updatePinned(s, a, t, dt);
  for (const kn of s.knives) updateKnife(s, kn, dt);
  // 4) Todos presos: desce da mesa e faz uma reverência.
  const allPinned = s.thrown >= s.throwOrder.length && s.actors.every((a) => a.state === 'pinned');
  if (allPinned && s.downT === undefined) s.downT = t + 0.5;
  if (s.downT !== undefined) {
    const d0 = s.downT, d1 = d0 + 0.7, bow = d1 + 0.35, snap = bow + 1.3;
    if (at(d0)) { r.anim.play('Jump_Full_Short', { once: true, restart: true, speed: 1.4, fade: 0.08 }); s.jumpFrom = r.group.position.clone(); }
    if (t >= d0 && t < d1) {
      const k = (t - d0) / (d1 - d0);
      r.group.position.lerpVectors(s.jumpFrom, FLOOR, k);
      r.group.position.y = s.jumpFrom.y * (1 - k) + Math.sin(k * Math.PI) * 1.4;
      r.group.rotation.y = Math.atan2(FLOOR.x - s.jumpFrom.x, FLOOR.z - s.jumpFrom.z);
    }
    if (at(d1)) {
      r.group.position.copy(FLOOR);
      r.group.rotation.y = 0; // de frente para a câmera
      r.anim.play('Idle_A', { fade: 0.15 });
      audio.play('thump', FLOOR.x, FLOOR.z, { v: 0.6 });
    }
    // Reverência: inclina o corpo para a frente e volta.
    const model = r.group.children[0];
    if (t >= bow && t < bow + 1.1) {
      const k = (t - bow) / 1.1, e = k < 0.3 ? k / 0.3 : k > 0.75 ? (1 - k) / 0.25 : 1;
      model.rotation.x = 0.6 * e * e * (3 - 2 * e);
      model.position.y = -0.15 * e;
    } else if (t >= bow + 1.1) { model.rotation.x = 0; model.position.y = 0; }
    if (at(bow + 0.25)) s.say('Às suas ordens.', r.group.position);
    // 5) Estala os dedos: as adagas somem e todos caem (e aplaudem).
    if (at(snap)) { r.anim.play('Interact', { once: true, restart: true, speed: 1.5, fade: 0.1 }); audio.play('gold', FLOOR.x, FLOOR.z); }
    s.actors.forEach((a, i) => { if (a.state === 'pinned' && t >= snap + 0.25 + i * 0.22) release(s, a); });
    if (s.knives.every((k) => k.state === 'gone') && s.popAt === undefined && t >= snap + 0.25) s.popAt = t + 1.6;
    if (at(snap + 1.2)) r.anim.play('Cheering', { once: true, restart: true, fade: 0.2, onFinish: () => r.anim.play('Idle_A', { fade: 0.2 }) });
  }
  if (s.popAt !== undefined && t >= s.popAt && !s.popupShown) s.showPopup();
  if (s.popupShown && s.fast && t >= s.popAt + 0.6) s.closePopup();
}

function updateKnife(s, kn, dt) {
  if (kn.state === 'gone') return;
  if (kn.state === 'fly') {
    kn.t += dt;
    const a = kn.a, to = a.group.position.clone().setY(1.6);
    const k = Math.min(1, kn.t / T.flight);
    kn.g.position.lerpVectors(kn.from, to, k);
    kn.g.rotation.y = Math.atan2(to.x - kn.from.x, to.z - kn.from.z);
    if (k >= 1) { // acertou: o ator voa para a parede
      kn.state = 'carry';
      a.state = 'flying';
      a.flyT = 0;
      a.flyFrom = a.group.position.clone();
      a.anim.play('Hit_B', { once: true, restart: true, fade: 0.05 });
      if (a.player) a.player.facing = 0;
      audio.play('hit', to.x, to.z);
      s.vfx.sparks(to, 0xffffff, 6);
    }
    return;
  }
  if (kn.state === 'carry') {
    // A adaga vai junto com o ator e crava na parede, presa na capa (na altura do ombro).
    const a = kn.a;
    kn.g.position.set(a.group.position.x + 0.35, a.group.position.y + 1.75, a.group.position.z - 0.15);
    kn.g.rotation.set(0, Math.PI, 0); // ponta para dentro da parede
    if (a.state === 'pinned') kn.state = 'stuck';
  }
}

function updatePinned(s, a, t, dt) {
  if (a.state === 'stand' && !a.keeper) { // assustado: dá uns passos para trás
    a.group.position.z -= dt * 0.6;
    return;
  }
  if (a.state === 'flying') {
    a.flyT += dt;
    const k = Math.min(1, a.flyT / T.fly);
    a.group.position.lerpVectors(a.flyFrom, a.pin, k);
    a.group.position.y = a.flyFrom.y * (1 - k) + a.pin.y * k + Math.sin(k * Math.PI) * 1.0;
    a.group.rotation.y = 0;
    if (a.player) a.player.facing = 0;
    if (k >= 1) {
      a.state = 'pinned';
      a.anim.play('Jump_Idle', { fade: 0.1 }); // pendurado, pernas soltas
      a.wiggle = Math.random() * 6;
      audio.play('thump', a.pin.x, a.pin.z, { v: 0.7 });
      s.vfx.dust(new THREE.Vector3(a.pin.x, 1.5, a.pin.z), new THREE.Vector3(0, 0, 1), 5);
      s.cam.shake(0.12);
    }
    return;
  }
  if (a.state === 'pinned') { // esperneia de leve
    a.wiggle += dt;
    a.group.rotation.z = 0.08 * Math.sin(a.wiggle * 7);
    return;
  }
  if (a.state === 'falling') {
    a.fallT += dt;
    const k = Math.min(1, a.fallT / 0.3);
    a.group.position.y = a.pin.y * (1 - k * k);
    a.group.position.z = a.pin.z + 0.6 * k;
    if (k >= 1) {
      a.state = 'free';
      a.group.position.y = 0;
      a.anim.play('Jump_Land', { once: true, restart: true, fade: 0.05,
        onFinish: () => a.anim.play(a.keeper ? 'Idle_B' : 'Cheering', { once: !a.keeper, restart: true, fade: 0.15, onFinish: () => a.anim.play(a.idle, { fade: 0.2 }) }) });
    }
  }
}

function release(s, a) {
  a.state = 'falling';
  a.fallT = 0;
  a.group.rotation.z = 0;
  const kn = s.knives.find((k) => k.a === a);
  if (kn && kn.state !== 'gone') {
    s.vfx.sparks(kn.g.position.clone(), 0x6fe3ff, 8);
    s.vfx.smoke(kn.g.position.clone(), 0x8a8f9c, 3);
    s.scene.remove(kn.g);
    kn.state = 'gone';
  }
  audio.play('dodge', a.pin.x, a.pin.z, { v: 0.6 });
}

// Limpa tudo (fim da cena ou saiu da Taverna no meio).
export function finishRogue(s) {
  for (const kn of s.knives || []) s.scene.remove(kn.g);
  s.knives = [];
  for (const a of s.actors) {
    a.group.rotation.z = 0;
    a.group.position.y = 0;
    if (a.state === 'pinned' || a.state === 'flying' || a.state === 'falling') {
      if (a.pin) a.group.position.set(a.pin.x, 0, a.pin.z + 0.6);
      a.anim.play(a.idle, { fade: 0.2 });
    }
  }
  const model = s.mage && s.mage.group.children[0];
  if (model) { model.rotation.x = 0; model.position.y = 0; }
  if (s.rogueLight) { s.rogueLight.intensity = 0; s.rogueLight.distance = 22; s.rogueLight.position.set(-6, 3, -3); s.rogueLight = null; }
}
