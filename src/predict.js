// Co-op, lado do Jogador 2: o herói dele responde na hora na própria tela (andar, rolar, o combo inteiro),
// sem esperar o anfitrião. Quando a posição "oficial" chega, ela é somada ao que este computador andou depois
// e a diferença é corrigida aos poucos (sem trancos).
import * as THREE from 'three';
import { audio } from './audio.js';

const smooth = (dt, k) => 1 - Math.exp(-k * dt);
const SNAP = 4;          // diferença maior que isso = pula direto para a posição certa
const HIST_MAX = 2.5;    // segundos de histórico guardados
const WAIT_MAX = 1.5;    // tempo máximo esperando o anfitrião "alcançar" uma ação feita aqui
const CLIP_MEMO = 1.6;   // golpes tocados aqui nos últimos s (quando chegam do anfitrião, não recomeçam)
const ECHO = 1.0;
const AUTH_MAX = 3;      // anfitrião usa a nossa posição: só corrige se a diferença passar disso (troca de sala etc.)        // som de golpe/acerto tocado aqui: o mesmo som do anfitrião até ECHO s depois é ignorado

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
    this.clips = [];       // { name, t }: golpes tocados aqui há pouco
    this.atk = null;       // combo acontecendo aqui: { idx, t, dur, step, hitDone, queued }
    this.atkEndAt = -9;    // quando o combo daqui acabou
    this.echo = { swing: [], hit: [] }; // sons tocados aqui (para não tocar de novo quando o anfitrião mandar)
    this.onHit = null;     // (herói, golpe, alcance) => acerto mostrado aqui na hora (replica.js)
    this.facing = 0;
    this.rolls = 0;        // rolamentos feitos aqui (vai para o anfitrião no lugar do botão: ele rola quando nós rolamos)
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

  reset() { this.ready = false; this.hist.length = 0; this.roll = null; this.wait = null; this.predClip = null; this.atk = null; this.clips.length = 0; }

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
    const [ack, ackAge, hostFree, speed, rollDist, rollTime, rollReady, rollCd, atkSpeed = 1, rangeMul = 1, hostAtk = 0, auth = 0, canRoll = 0] = info;
    // O anfitrião já processou a ação feita aqui?
    if (this.wait && (ack >= this.wait.seq || this.time - this.wait.t > WAIT_MAX)) {
      // Rolamento: solta quando o anfitrião ficou livre OU já está golpeando (o golpe dele começou depois do rolamento).
      if (this.wait.kind !== 'dodge' || hostFree || hostAtk || this.time - this.wait.t > WAIT_MAX) this.wait = null;
    }
    const waitingAttack = this.wait && this.wait.kind !== 'dodge';
    // Combo daqui acabou e o anfitrião ainda termina o dele (atrasado pela internet): já anda aqui.
    const tail = !!hostAtk && !this.atk && this.time - this.atkEndAt < 2.5;
    const free = (!!hostFree || tail) && !waitingAttack;
    let local = false;
    const moving = this.move.lengthSq() > 0;

    if (this.atk && (this.blocking || this.atk.abort)) { this.atk = null; this.atkEndAt = -9; } // bloqueio corta o golpe (o anfitrião decide o resto)
    // Rolar corta o golpe (igual ao Player: rolar funciona no meio do combo). Antes o golpe continuava aqui
    // enquanto o anfitrião já rolava, e a correção de posição arrastava o herói (deslizando).
    // Recarga: depois de um rolamento daqui, vale a contagem daqui (a do anfitrião chega atrasada).
    const rollOk = (rollReady || this.time - this.rollAt < 1.5) && this.dodgeCd <= 0;
    const rollNow = press.dodge && !this.roll && rollOk && (this.atk || free || this.wait || canRoll);
    if (rollNow) {
      this.atk = null; this.atkEndAt = -9;
      this.startRoll(p, rollDist, rollTime);
      local = true;
    } else if (this.atk) {
      local = this.tickAttack(p, dt, press, moving, atkSpeed, rangeMul);
    } else if (this.roll) {
      const r = this.roll;
      this.facing = Math.atan2(r.dx, r.dz);
      r.t += dt / r.time;
      if (press.attack && r.t > 0.4) r.atk = true; // apertou no fim do rolamento: golpe guardado (o anfitrião faz igual)
      this.step(p, r.dx, r.dz, (r.dist / r.time) * dt);
      if (r.t < 1) p.applyRoll(r.t);
      else {
        p.clearRoll(); this.roll = null; this.dodgeCd = rollCd;
        if (r.atk && p.hero.combo && p.hero.combo[0]) this.startStep(p, 0, atkSpeed);
      }
      if (!this.atk) this.facing = Math.atan2(r.dx, r.dz);
      local = true;
    } else if (free || (this.wait && this.wait.kind === 'dodge')) {
      if (press.attack && (!this.wait || this.wait.kind === 'dodge') && p.hero.combo && p.hero.combo[0]) {
        // (logo depois de rolar também: não espera o anfitrião confirmar o fim do rolamento)
        // Golpe: o combo inteiro toca aqui; o anfitrião decide o dano.
        this.startStep(p, 0, atkSpeed);
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
    if (auth && err <= AUTH_MAX) { /* o anfitrião usa a nossa posição: nada a corrigir (sem deslizar) */ }
    else if (err > SNAP) { this.pred.x = rx; this.pred.z = rz; } else {
      const k = smooth(dt, local ? 5 : 12);
      this.pred.x += ex * k; this.pred.z += ez * k;
    }
    p.position.x = this.pred.x; p.position.z = this.pred.z;
    if (!local) this.facing = hostFacing;
    return { local, roll: !!this.roll || this.time - this.rollAt < 1.6, facing: this.facing };
  }

  // Rolamento: começa aqui na hora.
  startRoll(p, rollDist, rollTime) {
    let dx = this.move.x, dz = this.move.z;
    const l = Math.hypot(dx, dz);
    if (l > 0) { dx /= l; dz /= l; } else { dx = Math.sin(this.facing); dz = Math.cos(this.facing); }
    this.roll = { t: 0, dx, dz, dist: rollDist, time: rollTime };
    this.rollAt = this.time;
    this.rolls++;
    this.wait = { seq: this.seq + 1, t: this.time, kind: 'dodge' }; // vai no próximo envio
    this.facing = Math.atan2(dx, dz);
    p.anim.play(p.hero.dodge.pose, { fade: 0.06, restart: true });
    p.anim.syncId = null;
  }

  // Golpe idx do combo começa aqui (igual ao Player.startAttack).
  startStep(p, idx, atkSpeed) {
    const step = p.hero.combo[idx];
    if (!step) { this.atk = null; return; }
    if (this.aim !== null) this.facing = this.aim;
    p.anim.play(step.clip, { once: true, speed: step.speed * atkSpeed, restart: true, fade: 0.08 });
    p.anim.syncId = null;
    const dur = (p.anim.current && p.anim.current.getClip().duration) || 1;
    this.atk = { idx, t: 0, dur, step, hitDone: false, queued: false };
    this.predClip = { name: step.clip, t: this.time };
    this.clips.push({ name: step.clip, t: this.time });
    if (this.clips.length > 12) this.clips.shift();
    this.wait = { seq: this.seq, t: this.time, kind: 'attack' };
    audio.play(step.heavy ? 'swingHeavy' : 'swing', p.position.x, p.position.z);
    this.echo.swing.push(this.time);
  }

  // Um quadro do golpe daqui (mesmas regras do Player, caso 'attack'). Devolve true = herói controlado aqui.
  tickAttack(p, dt, press, moving, atkSpeed, rangeMul) {
    const a = this.atk, step = a.step, h = p.hero;
    a.t += dt;
    const k = a.t * step.speed * atkSpeed / a.dur;
    if (k < step.hit) {
      const v = step.lunge * (h.lungeMul ?? 1) / (step.hit * a.dur / (step.speed * atkSpeed));
      this.step(p, Math.sin(this.facing), Math.cos(this.facing), v * dt);
    }
    if (!a.hitDone && k >= step.hit) {
      a.hitDone = true;
      if (this.onHit && !h.ammo && !step.throw && !step.cast) this.onHit(p, step, h.attackRange * rangeMul);
    }
    if (press.attack) a.queued = true;
    const last = a.idx >= h.combo.length - 1;
    const win = step.window ?? 0.4;
    const combo = !h.ammo; // Kunais/Besta: só o 1º golpe aqui (munição é do anfitrião)
    if (combo && a.queued && !last && k >= win && a.hitDone) this.startStep(p, a.idx + 1, atkSpeed);
    else if (k >= (step.end || 0.98)) {
      if (combo && last && a.queued) this.startStep(p, 0, atkSpeed);
      else { this.atk = null; this.atkEndAt = this.time; }
    } else if (moving && (last
      ? a.hitDone && k >= Math.min(step.cancel ?? h.attackCancel, step.hit + 0.08)
      : k >= (step.cancel ?? h.attackCancel) && !a.queued)) {
      this.atk = null; this.atkEndAt = this.time;
    }
    return true;
  }

  // Herói controlado aqui e o anfitrião mandou uma animação nova: golpe que já tocamos = só anota;
  // parado/correndo = ignora (é o anfitrião atrasado); outra coisa (dano, habilidade, arremesso) = o anfitrião manda.
  note(p, anim, pid, name) {
    if (pid === anim.syncId || !name) return false;
    const recent = this.clips.some((c) => c.name === name && this.time - c.t < CLIP_MEMO);
    if (recent) { anim.syncId = pid; return false; }
    if (!this.atk) return false;
    const h = p.hero;
    if (name === h.anims.idle || name === h.anims.run || name === h.anims.walk || name === h.dodge.pose) return false;
    this.atk = null; this.atkEndAt = -9; this.wait = null;
    return true; // o replica toca a animação do anfitrião
  }

  // Som que o anfitrião mandou: se já tocamos o mesmo aqui há pouco, não toca de novo.
  echoed(kind) {
    const q = this.echo[kind];
    while (q.length && this.time - q[0] > ECHO) q.shift();
    if (!q.length) return false;
    q.shift();
    return true;
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
