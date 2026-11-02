// Cenas extras dos esqueletos do menu (usadas por menucrowd.js): entrar e sair da cripta, subir na árvore,
// enterrar o derrotado numa cova, jogar bola com uma caveira, treino do sargento, soneca interrompida e luto na lápide.
// Recebe as ferramentas do palco (H) para não depender de menucrowd.js (sem import circular).
import * as THREE from 'three';

const SKULL = 'props/crypt/skull.gltf';

export function makePlays(H) {
  const { Actor, run, all, rnd, pick, edge, center, LANES, leave, spark, ring, dizzy, TEX, scene, cache } = H;
  const TILT = 0.21, cosT = Math.cos(TILT);
  const tweens = [], zzz = [], mounds = [];
  // Anima um número de 'from' até 'to' em 'dur' segundos (set recebe o valor e a fração). Devolve a condição de fim.
  const tween = (dur, set, ease = (u) => u) => { const tw = { t: 0, dur, set, ease, done: false }; tweens.push(tw); set(0, 0); return () => tw.done; };
  const toY = (px) => px / (cosT * H.ppu); // altura na tela (px) -> altura no mundo
  const back = () => LANES[1];

  // ---- terra / poeira ----
  const dirtTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(70,52,36,1)'); g.addColorStop(1, 'rgba(70,52,36,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
  const zTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.font = 'bold 48px serif'; x.fillStyle = '#dfe8ff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Z', 32, 34); return new THREE.CanvasTexture(c); })();
  const dirt = (x, z, n = 8) => {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: dirtTex, transparent: true, depthWrite: false }));
      m.position.set(x + rnd(-.3, .3), .2, z + rnd(-.2, .2)); m.scale.setScalar(rnd(.2, .4)); scene.add(m);
      const v = new THREE.Vector3(rnd(-1.5, 1.5), rnd(2, 4), rnd(-.5, .5));
      tween(rnd(.5, .8), (u) => { if (u >= 1) { scene.remove(m); return; } v.y -= 9 * (1 / 60); m.position.addScaledVector(v, 1 / 60); m.material.opacity = 1 - u; });
    }
  };
  const mound = (x, z) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3b2c1e, roughness: 1, transparent: true }));
    m.position.set(x, 0, z); m.scale.set(.01, .01, .01); scene.add(m);
    mounds.push({ m, t: 0 });
    tween(1.2, (u) => m.scale.set(.9 * u, .28 * u, .5 * u));
  };

  // ---- onde estão as coisas do fundo (no mundo 3D) ----
  const doorSpot = () => {
    const d = H.view.door, b = H.screenToWorld(d.x, d.base);
    return { x: b.x, zBase: b.z + .5, zDoor: b.z - .25, yDoor: toY(d.base - d.top) };
  };
  const visible = (x) => Math.abs(x) < H.halfW - 1.5;
  const pickTree = () => {
    const list = H.view.trees.map((t) => ({ ...H.screenToWorld(t.x, t.y), h: t.h })).filter((t) => visible(t.x));
    return list.length ? pick(list) : null;
  };
  // Cova: a lápide mais perto (na frente dela, um pouco abaixo na tela).
  const graveNear = (x) => {
    const list = H.view.stones.filter((st) => st.y > H.view.H * .81 && st.y < H.view.H * .95).map((st) => ({ ...H.screenToWorld(st.x, st.y), s: st.s })).filter((g) => visible(g.x));
    if (!list.length) return null;
    list.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
    const g = list[Math.random() < .7 ? 0 : Math.min(1, list.length - 1)];
    return { x: g.x, z: g.z + .55 * g.s };
  };

  // ================= CRIPTA: entrar e sair =================
  function* enterCrypt(a) {
    const D = doorSpot();
    a.busy = true;
    yield a.goTo(D.x, D.zBase, { speed: 1.6 });
    a.wantYaw = Math.PI; yield .25;
    if (Math.random() < .4) { a.wantYaw = 0; yield a.once(pick(['Waving', 'Skeletons_Taunt'])); a.wantYaw = Math.PI; yield .2; }
    yield a.goTo(D.x, D.zDoor, { speed: 1.2, y: D.yDoor, animSpeed: .9 }); // sobe os degraus
    a.play('Skeletons_Walking'); a.pinned = true;
    const z0 = a.z;
    yield tween(.8, (u) => { a.root.position.z = z0 - u * .9; a.setAlpha(1 - u); });
    ring(a.x, a.z, 0xa050ff, 1, 1.5);
    a.remove();
  }
  function* exitCrypt(kind, dir) {
    const D = doorSpot();
    const a = new Actor(kind, D.x, D.zDoor - .9, dir); a.busy = true; a.pinned = true;
    a.root.position.y = D.yDoor; a.setAlpha(0); a.wantYaw = a.yaw = 0;
    a.play('Skeletons_Walking');
    spark(new THREE.Vector3(a.x, D.yDoor + 1, a.z), TEX.purple, 6, 1.5, .8, 1, .3);
    yield tween(.8, (u) => { a.root.position.z = D.zDoor - .9 + u * .9; a.setAlpha(u); });
    a.setAlpha(1); a.pinned = false;
    yield a.goTo(D.x, D.zBase, { speed: 1.2, y: 0, animSpeed: .9 }); // desce os degraus
    if (Math.random() < .5) yield a.once(pick(['Idle_B', 'Skeletons_Taunt', 'Cheering']));
    yield a.goTo(D.x + dir * .6, back(), { speed: 1.6 });
    a.busy = false; run(leave(a));
  }
  function* crypt() {
    const r = Math.random(), dir = pick([1, -1]);
    if (r < .4) { // um entra
      const a = new Actor(pick(['minion', 'warrior', 'mage', 'archer']), edge(dir), back(), dir);
      yield* enterCrypt(a);
    } else if (r < .7) { // saem um ou dois
      run(exitCrypt(pick(['minion', 'warrior', 'archer']), dir));
      if (Math.random() < .6) { yield 2.2; run(exitCrypt(pick(['minion', 'mage']), -dir)); }
      yield 4;
    } else { // troca de turno: um entra e logo sai outro
      const a = new Actor(pick(['warrior', 'minion']), edge(dir), back(), dir);
      yield* enterCrypt(a);
      yield 1.2;
      yield* exitCrypt(pick(['minion', 'archer', 'mage']), -dir);
    }
  }

  // ================= ÁRVORE =================
  function* tree() {
    const T = pickTree();
    if (!T) return;
    const dir = T.x < 0 ? 1 : -1;
    const a = new Actor(pick(['minion', 'minion', 'archer', 'assassin']), edge(dir), back(), dir); a.busy = true;
    yield a.walkTo(T.x - dir * 1.2);
    yield a.goTo(T.x, T.z + .45, { speed: 1.4 });
    a.wantYaw = Math.PI; yield .3;
    // sobe: engatinhando de pé contra o tronco (a animação de engatinhar virada na vertical)
    const top = Math.max(1.6, toY(T.h * .36));
    a.pinned = true;
    a.model.rotation.x = -Math.PI / 2; a.model.position.z = .35;
    a.play('Crawling', { speed: 1.3 });
    yield tween(2.6, (u) => { a.root.position.y = top * u; });
    // senta no galho, olhando para a frente
    a.model.rotation.x = 0; a.model.position.z = 0;
    a.root.position.y = top - .15; a.wantYaw = a.yaw = rnd(-.4, .4);
    a.play('Sit_Floor_Idle', { fade: .1 });
    yield rnd(1.8, 2.8);
    if (Math.random() < .35) { // escorrega e cai
      a.play('Hit_A', { once: true, fade: .05 }); yield .25;
      const y0 = a.root.position.y;
      yield tween(.45, (u) => { a.root.position.y = y0 * (1 - u * u); a.root.position.z = T.z + .45 + u * .8; });
      H.view.sfx.thud(); spark(new THREE.Vector3(a.x, .3, a.z), TEX.orange, 6, 2, .3, -6, .2);
      yield a.once('Skeletons_Death', 1.6); dizzy(a, 2); yield 1.2;
      yield a.once('Skeletons_Awaken_Floor', 1.2);
      yield a.once('Skeletons_Taunt');
    } else { // pula de volta, todo orgulhoso
      if (Math.random() < .5) { a.play('Waving'); yield 1.4; a.play('Sit_Floor_Idle'); yield .4; }
      a.play('Jump_Full_Short', { once: true, speed: 1.1, fade: .08 });
      yield .25;
      const y0 = a.root.position.y;
      yield tween(.55, (u) => { a.root.position.y = y0 * (1 - u) + Math.sin(u * Math.PI) * .6; a.root.position.z = T.z + .45 + u * .9; });
      a.root.position.y = 0;
      yield .35; yield a.once(pick(['Cheering', 'Skeletons_Taunt']));
    }
    a.pinned = false;
    yield a.goTo(a.x, back(), { speed: 1.6 });
    a.busy = false; run(leave(a));
  }

  // ================= COVA: o vencedor enterra o derrotado =================
  function* bury(w, corpse) {
    w.busy = true; w.leaving = false; w.tx = null;
    if (w.removed || corpse.removed) return;
    const G = graveNear(corpse.x) || { x: corpse.x + (corpse.x < 0 ? 2.5 : -2.5), z: corpse.z - 1.2 };
    const side = Math.sign(G.x - corpse.x) || 1;
    // fica entre o corpo e a cova, olhando para o corpo
    yield w.goTo(corpse.x + side * 1.05, corpse.z, { speed: 1.8 });
    w.face(corpse); w.wantYaw = -side * 1.35; yield .25;
    yield w.once('PickUp', 1.2);
    // arrasta andando de costas até a cova
    corpse.follow = { a: w, dx: corpse.x - w.x, dz: corpse.z - w.z };
    yield w.goTo(G.x - corpse.follow.dx, G.z - corpse.follow.dz, { speed: 1.1, clip: 'Walking_Backwards', back: true });
    corpse.follow = null;
    w.wantYaw = -side * 1.35; w.dir = -side;
    // cava (com a própria arma) e o corpo afunda
    for (let i = 0; i < 3; i++) { w.play('Melee_1H_Attack_Chop', { once: true, speed: 1.3, fade: .08 }); yield w.clipLen * .55; dirt(corpse.x, corpse.z, 7); H.view.sfx.thud(); yield w.clipLen * .45; }
    const y0 = corpse.root.position.y;
    yield tween(1.4, (u) => { corpse.root.position.y = y0 - u * 1.4; corpse.setAlpha(1 - u * u); });
    mound(corpse.x, corpse.z);
    corpse.remove();
    yield w.once('Interact', 1.1);
    yield w.once(pick(['Cheering', 'Skeletons_Taunt', 'Waving']));
    yield w.goTo(w.x, Math.abs(w.z - LANES[0]) < Math.abs(w.z - LANES[1]) ? LANES[0] : LANES[1], { speed: 1.6 });
    w.busy = false; run(leave(w));
  }

  // ================= BOLA DE CAVEIRA =================
  function* catchSkull() {
    const z = pick(LANES), c = center();
    const A = new Actor(pick(['minion', 'warrior']), edge(1), z, 1), B = new Actor(pick(['minion', 'archer']), edge(-1), z, -1);
    A.busy = B.busy = true;
    yield all(A.walkTo(c - 2.4), B.walkTo(c + 2.4)); A.face(B); B.face(A); A.idle(); B.idle();
    const ball = cache.get(SKULL).scene.clone(true); ball.scale.setScalar(.32); scene.add(ball);
    ball.position.set(A.x + .5, 1.3, z);
    yield A.once('Skeletons_Taunt');
    const throws = 3 + (Math.random() * 3 | 0);
    let from = A, to = B;
    for (let i = 0; i <= throws; i++) {
      const last = i === throws;
      from.play('Throw', { once: true, speed: 1.2, fade: .08 }); yield from.clipLen * .4;
      H.view.sfx.shoot && H.view.sfx.shoot();
      const x0 = from.x + from.dir * .5, x1 = last ? to.x + from.dir * 9 : to.x - from.dir * .4, hh = last ? 3.5 : 1.6;
      if (last) to.play('Jump_Full_Short', { once: true, speed: 1.2 });
      yield tween(last ? 1.2 : .75, (u) => { ball.position.set(x0 + (x1 - x0) * u, 1.3 + Math.sin(u * Math.PI) * hh - (last ? u * 1.2 : 0), z); ball.rotation.z += .25; });
      if (last) break;
      to.play('Interact', { once: true, speed: 1.5, fade: .05 }); yield .45;
      [from, to] = [to, from];
    }
    // errou: quem não pegou corre atrás da caveira
    yield .3;
    to.wantYaw = from.dir * 1.2; to.dir = from.dir;
    const chase = to;
    run((function* () { chase.busy = false; yield* leave(chase, 4.6, 'Running_A'); })());
    yield tween(1.5, (u) => { ball.position.x += from.dir * .12; ball.position.y = Math.max(.3, ball.position.y - .05); ball.rotation.z += .3; if (u >= 1) scene.remove(ball); });
    yield from.once(pick(['Cheering', 'Skeletons_Taunt']));
    from.busy = false; run(leave(from));
  }

  // ================= TREINO DO SARGENTO =================
  function* workout() {
    const c = center(), dir = pick([1, -1]);
    const S = new Actor('warrior', edge(dir), back(), dir); S.busy = true;
    const M = [new Actor('minion', edge(dir) - dir * 1.8, 0, dir), new Actor('minion', edge(dir) - dir * 3.6, 0, dir)];
    M.forEach((m) => { m.busy = true; });
    yield all(S.walkTo(c), M[0].walkTo(c - 1.6), M[1].walkTo(c + 1.6));
    S.wantYaw = 0; M.forEach((m) => { m.wantYaw = Math.PI; });
    yield S.once('Skeletons_Taunt');
    M.forEach((m) => m.play('Push_Ups', { speed: 1.1 }));
    for (let i = 0; i < 3; i++) { yield 1.1; S.play(i % 2 ? 'Skeletons_Taunt' : 'Idle_B', { once: true }); }
    M.forEach((m) => m.play('Sit_Ups', { speed: 1.1 }));
    yield 2.4;
    const weak = pick(M);
    weak.play('Lie_Idle', { fade: .3 }); yield .8;
    S.face(weak); yield S.once('Skeletons_Taunt', 1.3);
    yield weak.once('Lie_StandUp', 1.1);
    M.forEach((m) => { m.idle(); m.wantYaw = 0; });
    yield .3;
    yield all(...M.map((m) => m.once('Cheering')));
    const out = pick([1, -1]);
    [S, ...M].forEach((a, i) => { a.dir = out; a.busy = false; run((function* () { yield i * .3; yield* leave(a, 4.2, 'Running_A'); })()); });
  }

  // ================= SONECA =================
  function* nap() {
    const c = center(), dir = pick([1, -1]), z = back();
    const Sl = new Actor('minion', edge(dir), z, dir); Sl.busy = true;
    yield Sl.walkTo(c);
    yield Sl.once('Lie_Down', 1);
    Sl.play('Lie_Idle'); Sl.sleeping = true;
    yield rnd(2.5, 3.5);
    const K = new Actor(pick(['minion', 'warrior', 'assassin']), edge(-dir), z, -dir); K.busy = true;
    yield K.walkTo(Sl.x + dir * 1.5);
    K.face(Sl); yield .4;
    K.play('Melee_Unarmed_Attack_Kick', { once: true, speed: 1.1, fade: .08 }); yield K.clipLen * .45;
    H.view.sfx.hit(); spark(new THREE.Vector3(Sl.x, .6, Sl.z), TEX.orange, 8, 3, .3, -7, .2);
    Sl.sleeping = false; dizzy(Sl, 1.2);
    yield Sl.once('Lie_StandUp', 1.4);
    Sl.face(K); yield Sl.once('Skeletons_Taunt', 1.2);
    K.dir = -dir; K.busy = false; run(leave(K, 4.8, 'Running_A'));
    yield .5; Sl.dir = -dir; Sl.busy = false; run(leave(Sl, 4.6, 'Running_A'));
  }

  // ================= LUTO NA LÁPIDE =================
  function* mourn() {
    const dir = pick([1, -1]);
    const st = graveNear(rnd(-H.halfW * .6, H.halfW * .6));
    if (!st) return;
    const a = new Actor(pick(['mage', 'minion']), edge(dir), back(), dir); a.busy = true;
    yield a.walkTo(st.x - dir * 1.5);
    yield a.goTo(st.x, st.z + .5, { speed: 1.2 });
    a.wantYaw = Math.PI; yield .3;
    yield a.once('Sit_Floor_Down', 1);
    a.play('Sit_Floor_Idle');
    for (let i = 0; i < 6; i++) { spark(new THREE.Vector3(st.x + rnd(-.3, .3), .4, st.z), TEX.purple, 1, .6, 1.6, 1.2, .35); yield .4; }
    ring(st.x, st.z, 0x8a60ff, 1.6, 2);
    yield a.once('Sit_Floor_StandUp', 1);
    a.wantYaw = Math.PI; yield a.once('Waving', 1);
    yield a.goTo(a.x, back(), { speed: 1.4 });
    a.busy = false; run(leave(a));
  }

  function update(dt) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i]; tw.t += dt; const u = Math.min(1, tw.t / tw.dur);
      tw.set(tw.ease(u), u);
      if (u >= 1) { tw.done = true; tweens.splice(i, 1); }
    }
    for (let i = mounds.length - 1; i >= 0; i--) { const m = mounds[i]; m.t += dt; if (m.t > 22) { m.m.material.opacity = Math.max(0, 1 - (m.t - 22) / 3); if (m.t > 25) { scene.remove(m.m); mounds.splice(i, 1); } } }
    for (let i = zzz.length - 1; i >= 0; i--) { const z = zzz[i]; z.t += dt; z.m.position.y += dt * .6; z.m.position.x += Math.sin(z.t * 3) * dt * .3; z.m.material.opacity = 1 - z.t / 2; if (z.t > 2) { scene.remove(z.m); zzz.splice(i, 1); } }
    snoreT -= dt;
    if (snoreT <= 0) {
      snoreT = .7;
      for (const a of H.actors || []) if (a.sleeping && !a.removed) {
        const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false }));
        m.position.set(a.x + .3, 1.1, a.z); m.scale.setScalar(.45); scene.add(m); zzz.push({ m, t: 0 });
      }
    }
  }
  let snoreT = 0;

  return { crypt, tree, bury, catchSkull, workout, nap, mourn, update, models: [SKULL], enterCrypt, exitCrypt };
}
