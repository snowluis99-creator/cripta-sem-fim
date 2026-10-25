// Co-op, lado do Jogador 2: lê o que o anfitrião publica, desenha (replica.js) e manda os comandos de volta.
import * as THREE from 'three';
import { input } from './input.js';
import { save } from './save.js';
import { Predictor } from './predict.js';

const tmp = new THREE.Vector3();

const SEND_EVERY = 1 / 20;
const LOST_AFTER = 5; // segundos sem o anfitrião = caiu a conexão

export class CoopClient {
  // g: { net, replica, ui, hud, cam, text, onLost, spectator }
  // spectator = só assiste: não manda comandos, não escolhe bênção e a câmera mostra a sala inteira.
  constructor(g) {
    Object.assign(this, g);
    this.spectator = !!g.spectator;
    this.fitKey = '';
    this.look = new THREE.Vector3();
    this.cnt = { atk: 0, dge: 0, pot: 0, use: 0, rt: 0, ult: 0 };
    this.pick = 0;
    this.sendT = 0;
    this.lastA = null; this.lastB = null;
    this.missing = 0;
    this.time = 0;
    const r = this.replica;
    r.spectator = this.spectator;
    this.sq = 0;
    if (this.spectator) { this.hud.setSpectator(true); return; }
    r.pred = new Predictor(r.world);
    r.onChoice = (id, options, title) => {
      this.ui.openChoice(options, r.me.blessings || {}, (b, i) => { this.pick = [id, i]; this.send(true); }, title);
    };
    r.onChoiceGone = () => { if (this.ui.modal) this.ui.closeChoice(); };
    this.hud.onRetry = () => { this.cnt.rt++; };
    this.ui.onRetry = () => { this.cnt.rt++; };
  }

  // Comandos deste computador (contadores sempre somando: nada se perde se um pacote não chegar).
  readInput() {
    const blocked = this.ui.modal;
    let atk = false, dge = false, now = false;
    const blk = !blocked && input.blocking();
    if (!blocked) {
      if (input.attack()) { this.cnt.atk++; atk = true; }
      if (input.dodge()) { this.cnt.dge++; dge = true; }
      if (input.potion()) { this.cnt.pot++; now = true; }
      if (input.interact()) { this.cnt.use++; now = true; }
      if (input.ultimate() && !this.hud.deathVisible) { this.cnt.ult++; now = true; }
    }
    // Botão apertado (ou bloqueio mudou) = manda já, sem esperar o próximo envio.
    if (atk || dge || now || blk !== this.lastBlk) this.sendNow = true;
    this.lastBlk = blk;
    const pred = this.replica.pred;
    if (pred) {
      const m = blocked ? tmp.set(0, 0, 0) : input.moveDir(tmp);
      const aim = blocked ? null : input.aimAngle(this.cam.camera, this.replica.me.position);
      pred.input(m, aim, dge, atk, blk);
    }
    if ((this.hud.deathVisible || this.ui.winVisible) && input.retry()) this.cnt.rt++;
  }

  send(force = false) {
    if (this.spectator) { // só avisa de vez em quando que continua aqui
      if (this.sendT > 0) return;
      this.sendT = 3;
      this.net.send(this.net.a, { role: 'spec' });
      return;
    }
    if (this.sendNow) { force = true; this.sendNow = false; }
    if (!force && this.sendT > 0) return;
    this.sendT = SEND_EVERY;
    this.sq++;
    if (this.replica.pred) this.replica.pred.sent(this.sq);
    const m = this.ui.modal ? tmp.set(0, 0, 0) : input.moveDir(tmp);
    const me = this.replica.me;
    const aim = this.ui.modal ? null : input.aimAngle(this.cam.camera, me.position);
    const c = this.cnt;
    this.net.send(this.net.a, {
      role: 'guest',
      in: [Math.round(m.x * 100) / 100, Math.round(m.z * 100) / 100, aim === null ? null : Math.round(aim * 100) / 100,
        !this.ui.modal && input.blocking() ? 1 : 0, c.atk, c.dge, c.pot, c.use, c.rt, c.ult],
      pk: this.pick || 0,
      sq: this.sq,
      sv: [save.data.soul, save.data.ups, save.data.runs, save.data.best],
    });
  }

  update(dt) {
    this.time += dt;
    this.sendT -= dt;
    const host = this.net.other(this.net.a, 'host');
    if (host) {
      this.missing = 0;
      if (host.presence !== this.lastA) { this.lastA = host.presence; this.replica.applyState(host.presence.s); }
      const fx = this.net.b && this.net.b.peers().find((p) => !p.sameTab && p.presence && p.presence.f);
      if (fx && fx.presence !== this.lastB) { this.lastB = fx.presence; this.replica.applyFx(fx.presence.f); }
    } else if ((this.missing += dt) > LOST_AFTER && this.replica.got && this.onLost) { this.onLost(); this.onLost = null; }
    if (!this.spectator) this.readInput();
    if (this.ui.modal) this.ui.updateModal(dt);
    this.send();
    this.replica.update(dt, this.time);
    const host2 = this.replica.sp;
    this.hud.setWatchers(this.spectator ? Math.max(1, host2 || 1) : host2 || 0);
    if (this.spectator) { this.spectate(dt); return; }
    const me = this.replica.me, other = this.replica.heroes[0];
    const follow = me.netDead && other.group.visible ? other : me;
    const us = this.replica.unlockScene;
    this.cam.follow(us && us.active ? us.focus : follow.position, dt, us && us.active ? 2.5 : 5);
    this.text.update(dt, this.cam.camera);
    this.ui.update(dt, this.cam.camera);
  }

  // Espectador: câmera parada mostrando a sala inteira (refaz o enquadramento ao trocar de sala ou de tamanho de tela).
  spectate(dt) {
    const b = this.replica.built, us = this.replica.unlockScene;
    const key = b ? `${b.halfW}|${b.halfD}|${this.cam.camera.aspect.toFixed(3)}` : '';
    if (key !== this.fitKey) {
      this.fitKey = key;
      this.look.copy(this.cam.fitRoom(b ? b.halfW : 0, b ? b.halfD : 0));
      this.cam.target.copy(this.look);
    }
    this.cam.follow(us && us.active ? us.focus : this.look, dt, 2.5);
    this.text.update(dt, this.cam.camera);
    this.ui.update(dt, this.cam.camera);
  }
}
