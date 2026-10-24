// Co-op: jogadas em dupla (só com 2 heróis).
// - Golpe Duplo: os dois soltam o golpe forte (3º do combo) juntos, um de frente para o outro ->
//   a tela pisca em amarelo e TODOS os esqueletos sofrem dano.
// - Visão Espectral: o herói caído aperta E (uma vez por sala) e, por 15 s, os ataques dos esqueletos
//   aparecem no chão (círculos e faixas vermelhas) para quem está vivo.
// - Costas com Costas: os dois bloqueando encostados -> ficam de costas um para o outro, defendendo
//   por todos os lados, e andam juntos.
// - Poção Compartilhada: a cura que sobra da poção vai para o parceiro.
import * as THREE from 'three';

export const TEAM = {
  combo: { window: 0.45, maxDist: 7, faceDeg: 60, damage: 2 },
  spectral: { time: 15 },
  back: { gap: 0.45, speed: 4.5 },   // gap = folga para "encostar"; speed = velocidade andando de costas
};

const DEG = Math.PI / 180;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

// ---------- Desenho dos avisos (usado no anfitrião e no Jogador 2) ----------
// Formas: [0, x, z, raio, k] = círculo; [1, x, z, ângulo, comprimento, largura, k] = faixa. k = 0..1 (quanto falta).
export class OmenView {
  constructor(scene) {
    this.scene = scene;
    this.rings = []; this.lines = [];
    const red = (o) => new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide });
    this.geo = {
      disc: new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
      edge: new THREE.RingGeometry(0.93, 1, 48).rotateX(-Math.PI / 2),
      plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5),
    };
    this.red = red;
  }

  ring(i) {
    if (!this.rings[i]) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(this.geo.disc, this.red(0.2)), new THREE.Mesh(this.geo.edge, this.red(0.8)));
      g.position.y = 0.06; g.renderOrder = 2;
      this.scene.add(g);
      this.rings[i] = g;
    }
    return this.rings[i];
  }

  line(i) {
    if (!this.lines[i]) {
      const m = new THREE.Mesh(this.geo.plane, this.red(0.35));
      m.position.y = 0.07; m.renderOrder = 2;
      this.scene.add(m);
      this.lines[i] = m;
    }
    return this.lines[i];
  }

  show(shapes) {
    let nr = 0, nl = 0;
    const pulse = 0.75 + 0.25 * Math.sin(performance.now() / 70);
    for (const s of shapes || []) {
      if (s[0] === 0) {
        const [, x, z, r, k] = s, g = this.ring(nr++);
        g.visible = true;
        g.position.set(x, 0.06, z);
        g.scale.setScalar(Math.max(0.3, r));
        g.children[0].material.opacity = (0.12 + 0.3 * k) * pulse;
        g.children[1].material.opacity = 0.9 * pulse;
      } else {
        const [, x, z, a, len, w, k] = s, m = this.line(nl++);
        m.visible = true;
        m.position.set(x, 0.07, z);
        m.rotation.y = a;
        m.scale.set(w, 1, len);
        m.material.opacity = (0.2 + 0.35 * k) * pulse;
      }
    }
    for (let i = nr; i < this.rings.length; i++) this.rings[i].visible = false;
    for (let i = nl; i < this.lines.length; i++) this.lines[i].visible = false;
  }

  clear() { this.show([]); }
}

// O que cada esqueleto está para fazer, em formas para desenhar.
function enemyOmens(e, out) {
  const d = e.data, x = e.position.x, z = e.position.z, f = e.facing, s = d.scale || 1;
  const r2 = (v) => Math.round(v * 100) / 100;
  switch (e.state) {
    case 'attack': {
      const a = e.atk, pr = e.anim.progress();
      if (a && pr < a.hit) out.push([0, r2(x), r2(z), r2((a.reach || 2) + 0.3), r2(pr / a.hit)]);
      break;
    }
    case 'leap':
      if (e.leapTo) out.push([0, r2(e.leapTo.x), r2(e.leapTo.z), r2((d.leap.attack?.reach || 2.4) + 0.3), 0.3]);
      break;
    case 'leapWind':
      out.push([0, r2(x), r2(z), r2((d.leap.attack?.reach || 2.4) + 0.3), r2(Math.min(1, e.t / d.leap.wind))]);
      break;
    case 'chargeWind':
      out.push([1, r2(x), r2(z), r2(f), d.charge.distance, r2(1.6 * s + 0.6), r2(Math.min(1, e.t / d.charge.wind))]);
      break;
    case 'aim': {
      const R = e.shot;
      if (!R) break;
      const n = R.count || 1, k = r2(Math.min(1, e.t / R.aim));
      for (let i = 0; i < n; i++) {
        const a = f + (n > 1 ? (i / (n - 1) - 0.5) * R.spread : 0);
        out.push([1, r2(x), r2(z), r2(a), 22, r2(0.35 * (R.scale || 1) + 0.25), k]);
      }
      break;
    }
    case 'spinWind': case 'spinMove': case 'spinGather':
      out.push([0, r2(x), r2(z), r2(Math.min(d.spin.radius, 26)), r2(e.state === 'spinWind' ? Math.min(1, e.t / d.spin.wind) : 0.5)]);
      break;
    case 'nova':
      if (d.nova) out.push([0, r2(x), r2(z), d.nova.radius, r2(Math.min(1, e.t / (d.nova.wind || 0.5)))]);
      break;
    default: break;
  }
}

// ---------- Regras (rodam no anfitrião) ----------
export class Teamwork {
  // g: { scene, combat, run, hud, vfx, cam, world }
  constructor(g) {
    Object.assign(this, g);
    this.view = new OmenView(this.scene);
    this.time = 0;
    this.spectral = 0;          // segundos de Visão Espectral que faltam
    this.shapes = [];           // avisos atuais (vão também para o Jogador 2)
    this.rv = -1;
    this.emit = null;           // co-op: manda um efeito para a tela do Jogador 2
    this.pair = null;           // Costas com Costas: { a, b, ux, uz }
  }

  get duo() { const ps = this.combat.players; return ps.length > 1 ? ps : null; }
  partner(p) { const d = this.duo; return d ? (d[0] === p ? d[1] : d[0]) : null; }

  reset() {
    this.spectral = 0; this.shapes = []; this.view.clear(); this.breakPair();
    for (const p of this.combat.players) { p.spectralUsed = false; p.lastHeavy = -9; }
  }

  // Tela piscando nas duas telas.
  flash(color, time) {
    this.hud.flash(color, time);
    if (this.emit) this.emit(['fl', color, time]);
  }

  // ----- Golpe Duplo -----
  heavy(p) {
    const o = this.partner(p);
    p.lastHeavy = this.time;
    if (!o || o.state === 'dead' || this.time - (o.lastHeavy ?? -9) > TEAM.combo.window) return;
    const C = TEAM.combo;
    const dx = o.position.x - p.position.x, dz = o.position.z - p.position.z, dist = Math.hypot(dx, dz);
    if (dist > C.maxDist) return;
    const faceP = Math.abs(wrap(Math.atan2(dx, dz) - p.facing)) <= C.faceDeg * DEG;
    const faceO = Math.abs(wrap(Math.atan2(-dx, -dz) - o.facing)) <= C.faceDeg * DEG;
    if (!faceP || !faceO) return;
    p.lastHeavy = o.lastHeavy = -9;
    const mid = tmpA.set((p.position.x + o.position.x) / 2, 0, (p.position.z + o.position.z) / 2);
    this.flash('#ffe14a', 0.18);
    this.vfx.burst(mid.clone(), 0xffe14a);
    this.cam.shake(0.35);
    this.combat.text.add('Golpe Duplo!', mid, 'crit', 3.6);
    for (const e of [...this.combat.enemies]) {
      if (!e.alive || !e.targetable) continue;
      const ex = e.position.x - mid.x, ez = e.position.z - mid.z, d = Math.hypot(ex, ez) || 1;
      this.combat.bonusDamage(e, C.damage, ex / d, ez / d, 'dmg', p);
    }
    if (this.combat.log) this.combat.log({ type: 'duo' });
  }

  // ----- Poção Compartilhada -----
  // Quanto sobrou da poção vai para o parceiro vivo.
  shareHeal(p, extra) {
    const o = this.partner(p);
    if (!o || o.state === 'dead' || extra <= 0) return 0;
    const got = o.heal(extra);
    if (got > 0) {
      this.combat.text.add(`+${got}`, o.position, 'heal');
      this.vfx.sparks(new THREE.Vector3(o.position.x, 1.4, o.position.z), 0x7dff8a, 10);
      this.vfx.bolt(new THREE.Vector3(p.position.x, 1.3, p.position.z), new THREE.Vector3(o.position.x, 1.3, o.position.z), 0x7dff8a);
    }
    return got;
  }
  // Vale beber com a vida cheia se o parceiro precisa.
  partnerNeedsHeal(p) {
    const o = this.partner(p);
    return !!o && o.state !== 'dead' && o.hp < o.maxHp;
  }

  // ----- Costas com Costas -----
  canPair(a, b) {
    return a.state === 'block' && b.state === 'block'
      && Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) <= a.hero.radius + b.hero.radius + TEAM.back.gap;
  }

  makePair(a, b) {
    let ux = b.position.x - a.position.x, uz = b.position.z - a.position.z;
    const l = Math.hypot(ux, uz);
    if (l < 1e-3) { ux = Math.sin(a.facing); uz = Math.cos(a.facing); } else { ux /= l; uz /= l; }
    this.pair = { a, b, ux, uz };
    a.backToBack = b.backToBack = true;
    const mid = new THREE.Vector3((a.position.x + b.position.x) / 2, 0, (a.position.z + b.position.z) / 2);
    this.combat.text.add('Costas com costas!', mid, 'block', 3.4);
    this.vfx.sparks(mid.setY(1.3), 0xcfe4ff, 12);
  }

  breakPair() {
    if (!this.pair) return;
    this.pair.a.backToBack = this.pair.b.backToBack = false;
    this.pair = null;
  }

  updatePair(dt) {
    const duo = this.duo;
    if (!duo) { this.breakPair(); return; }
    const [a, b] = duo;
    if (this.pair && !(a.state === 'block' && b.state === 'block')) this.breakPair();
    if (!this.pair) { if (this.canPair(a, b)) this.makePair(a, b); else return; }
    const P = this.pair;
    // Cada um olha para o lado oposto ao parceiro.
    a.facing = Math.atan2(-P.ux, -P.uz); b.facing = Math.atan2(P.ux, P.uz);
    a.group.rotation.y = a.facing; b.group.rotation.y = b.facing;
    // Andam juntos: soma das duas direções (no máximo velocidade cheia).
    a.ctl.moveDir(tmpA); b.ctl.moveDir(tmpB);
    tmpA.add(tmpB);
    if (tmpA.lengthSq() > 1) tmpA.normalize();
    const half = (a.hero.radius + b.hero.radius) / 2;
    const mx = (a.position.x + b.position.x) / 2 + tmpA.x * TEAM.back.speed * dt;
    const mz = (a.position.z + b.position.z) / 2 + tmpA.z * TEAM.back.speed * dt;
    a.position.set(mx - P.ux * half, 0, mz - P.uz * half);
    b.position.set(mx + P.ux * half, 0, mz + P.uz * half);
    this.world.resolveCircle(a.position, a.hero.radius);
    this.world.resolveCircle(b.position, b.hero.radius);
    // Parede empurrou um deles: o outro acompanha (continuam encostados).
    const cx = (a.position.x + b.position.x) / 2, cz = (a.position.z + b.position.z) / 2;
    a.position.set(cx - P.ux * half, 0, cz - P.uz * half);
    b.position.set(cx + P.ux * half, 0, cz + P.uz * half);
  }

  // ----- Visão Espectral -----
  updateSpectral(dt) {
    const duo = this.duo;
    if (duo) {
      for (const p of duo) {
        if (p.state !== 'dead') { p.deadHint = false; continue; }
        if (!p.deadHint) {
          p.deadHint = true;
          if (!p.spectralUsed && p.ux && this.partner(p).state !== 'dead') setTimeout(() => p.ux.banner('Aperte E: Visão Espectral para o parceiro (1x por sala)', 'small'), 1800);
        }
        if (!p.spectralUsed && p.ctl.interact() && this.partner(p).state !== 'dead') {
          p.spectralUsed = true;
          this.spectral = TEAM.spectral.time;
          this.flash('#8fd0ff', 0.25);
          this.hud.banner(`Visão Espectral! ${TEAM.spectral.time} s`, 'small');
          this.vfx.burst(this.partner(p).position.clone(), 0x8fd0ff);
        }
      }
    }
    if (this.spectral > 0) {
      this.spectral -= dt;
      if (this.spectral <= 0) this.hud.banner('A Visão Espectral se apagou', 'small');
    }
    const shapes = [];
    if (this.spectral > 0) for (const e of this.combat.enemies) if (e.alive) enemyOmens(e, shapes);
    this.shapes = shapes;
    this.view.show(shapes);
  }

  update(dt) {
    this.time += dt;
    if (this.run.roomVersion !== this.rv) {
      // Sala nova: a Visão Espectral pode ser usada de novo.
      this.rv = this.run.roomVersion;
      this.spectral = 0;
      for (const p of this.combat.players) { p.spectralUsed = false; p.deadHint = false; }
    }
    this.updatePair(dt);
    this.updateSpectral(dt);
  }
}
