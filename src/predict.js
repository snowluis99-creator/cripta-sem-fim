// Co-op, lado do Jogador 2: o herói dele responde na hora na própria tela (andar, rolar, começar o golpe),
// sem esperar o anfitrião. Quando a posição "oficial" chega, ela é somada ao que este computador andou depois
// e a diferença é corrigida aos poucos (sem trancos).
import * as THREE from 'three';

const smooth = (dt, k) => 1 - Math.exp(-k * dt);
const SNAP = 4;          // diferença maior que isso = pula direto para a posição certa
const HIST_MAX = 2.5;    // segundos de histórico guardados
const WAIT_MAX = 1.5;    // tempo máximo esperando o anfitrião "alcançar" uma ação feita aqui

export class Predictor {
  constructor(world) {
    this.world = world;
    this.pred = new THREE.Vector3();
    this.ready = false;
    this.hist = [];        // { seq, age, dx, dz }: o que este computador andou depois de cada envio
    this.seq = 0; this.seqT = 0; this.time = 0;
    this.info = null;      // [ack, ackAge, livre, velocidade, distância do rolamento, tempo do rolamento, rolamento pronto, recarga]
    this.srv = null;       // posição oficial mais recente
    this.press = { dodge: false, attack: false };
    this.move = new THREE.Vector3();
    this.aim = null;
    this.blocking = false;
    this.roll = null;      // rolamento acontecendo aqui
    this.rollAt = -9;
    this.dodgeCd = 0;
    this.wait = null;      // { seq, t, kind }: ação feita aqui que o anfitrião ainda não processou
    this.predClip = null;  // golpe começado aqui (quando o mesmo golpe chegar do anfitrião, não recomeça)
    this.facing = 0;
  }

  // Um envio de comandos saiu agora com este número.
  sent(seq) { this.seq = seq; this.seqT = this.time; }

  // Comandos deste computador neste quadro.
  input(move, aim, dodge, attack, blocking) {
    this.move.copy(move);
    this.aim = aim;
    if (dodge) this.press.dodge = true;
    if (attack) this.press.attack = true;
    this.blocking = blocking;
  }

  server(x, z, info) {
    this.srv = [x, z];
    if (info) this.info = info;
  }

  reset() { this.ready = false; this.hist.length = 0; this.roll = null; this.wait = null; this.predClip = null; }

  // Herói anda com colisão (passos curtos, igual ao Player.move).
  step(p, dx, dz, dist) {
    const x0 = this.pred.x, z0 = this.pred.z;
    const steps = Math.max(1, Math.ceil(dist / 0.25)), d = dist / steps;
    for (let i = 0; i < steps; i++) {
      this.pred.x += dx * d; this.pred.z += dz * d;
      this.world.resolveCircle(this.pred, p.hero.radius);
    }
    this.hist.push({ seq: this.seq, age: this.time - this.seqT, dx: this.pred.x - x0, dz: this.pred.z - z0 });
  }

  // Chamado pelo replica.js a cada quadro para o herói deste computador.
  // Devolve o que foi decidido aqui: { local: animação/direção daqui, roll: ignorar o rolamento do anfitrião }
  drive(p, dt, hostFacing, snap) {
    this.time += dt;
    this.dodgeCd -= dt;
    const press = this.press;
    this.press = { dodge: false, attack: false };
    if (!this.srv) return null;
    if (!this.ready || snap) {
      this.pred.set(this.srv[0], 0, this.srv[1]);
      this.hist.length = 0; this.roll = null; this.wait = null;
      this.ready = true;
      this.facing = hostFacing;
    }
    const info = this.info || [0, 0, 1, p.hero.moveSpeed, p.hero.dodge.distance, p.hero.dodge.time, 1, p.hero.dodge.cooldown];
    const [ack, ackAge, hostFree, speed, rollDist, rollTime, rollReady, rollCd] = info;
    // O anfitrião já processou a ação feita aqui?
    if (this.wait && (ack >= this.wait.seq || this.time - this.wait.t > WAIT_MAX)) {
      if (this.wait.kind !== 'dodge' || hostFree || this.time - this.wait.t > WAIT_MAX) this.wait = null;
    }
    const waitingAttack = this.wait && this.wait.kind !== 'dodge';
    const free = !!hostFree && !waitingAttack;
    let local = false;
    const moving = this.move.lengthSq() > 0;

    if (this.roll) {
      const r = this.roll;
      r.t += dt / r.time;
      this.step(p, r.dx, r.dz, (r.dist / r.time) * dt);
      if (r.t < 1) p.applyRoll(r.t);
      else { p.clearRoll(); this.roll = null; this.dodgeCd = rollCd; }
      this.facing = Math.atan2(r.dx, r.dz);
      local = true;
    } else if (free || (this.wait && this.wait.kind === 'dodge')) {
      if (press.dodge && rollReady && this.dodgeCd <= 0) {
        // Rolamento: começa aqui na hora.
        let dx = this.move.x, dz = this.move.z;
        const l = Math.hypot(dx, dz);
        if (l > 0) { dx /= l; dz /= l; } else { dx = Math.sin(this.facing); dz = Math.cos(this.facing); }
        this.roll = { t: 0, dx, dz, dist: rollDist, time: rollTime };
        this.rollAt = this.time;
        this.wait = { seq: this.seq, t: this.time, kind: 'dodge' };
        this.facing = Math.atan2(dx, dz);
        p.anim.play(p.hero.dodge.pose, { fade: 0.06, restart: true });
        p.anim.syncId = null;
        local = true;
      } else if (press.attack && !this.wait) {
        // Golpe: a animação começa aqui; o anfitrião decide o resto (combo, dano).
        if (this.aim !== null) this.facing = this.aim;
        const step = p.hero.combo[0];
        p.anim.play(step.clip, { once: true, speed: step.speed, restart: true, fade: 0.08 });
        p.anim.syncId = null;
        this.predClip = { name: step.clip, t: this.time };
        this.wait = { seq: this.seq, t: this.time, kind: 'attack' };
        local = true;
      } else if (!this.blocking) {
        // Andar.
        if (moving) {
          this.step(p, this.move.x, this.move.z, speed * dt);
          this.facing = Math.atan2(this.move.x, this.move.z);
        }
        const want = moving ? p.hero.anims.run : p.hero.anims.idle;
        if (p.anim.currentName !== want) { p.anim.play(want, { fade: 0.15 }); }
        p.anim.syncId = null;
        local = true;
      }
    } else if (waitingAttack) local = true; // golpe começado aqui: segura a animação até o anfitrião confirmar

    // Posição oficial + o que andamos aqui depois dela.
    if (this.hist.length > HIST_MAX * 120) this.hist.splice(0, this.hist.length - HIST_MAX * 120);
    let rx = this.srv[0], rz = this.srv[1];
    for (const h of this.hist) if (h.seq > ack || (h.seq === ack && h.age > ackAge)) { rx += h.dx; rz += h.dz; }
    this.hist = this.hist.filter((h) => h.seq >= ack);
    const ex = rx - this.pred.x, ez = rz - this.pred.z, err = Math.hypot(ex, ez);
    if (err > SNAP) { this.pred.x = rx; this.pred.z = rz; } else {
      const k = smooth(dt, local ? 5 : 12);
      this.pred.x += ex * k; this.pred.z += ez * k;
    }
    p.position.x = this.pred.x; p.position.z = this.pred.z;
    if (!local) this.facing = hostFacing;
    return { local, roll: !!this.roll || this.time - this.rollAt < 1.6, facing: this.facing };
  }

  // O golpe que começou aqui chegou do anfitrião: continua sem recomeçar a animação.
  adopt(anim, pid, name, speed) {
    const pc = this.predClip;
    if (!pc || pc.name !== name || this.time - pc.t > 1.2 || pid === anim.syncId) return false;
    anim.syncId = pid;
    if (anim.current) anim.current.timeScale = speed;
    this.predClip = null;
    return true;
  }
}
