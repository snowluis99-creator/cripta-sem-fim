// Co-op, lado do Jogador 2: aqui nada é simulado. O computador do anfitrião manda o estado do jogo
// e este arquivo só desenha: sala, heróis, esqueletos, recompensas, projéteis e efeitos (suavizando o movimento).
import * as THREE from 'three';
import { ROOMS } from './dungeon/rooms.js';
import { buildRoom } from './dungeon/builder.js';
import { decorateDoors, PLAYER_COLORS } from './run.js';
import { Enemy, ENEMIES } from './enemies.js';
import { applyEnemyRoll } from './ranged.js';
import { Pickup } from './rewards.js';
import { Merchant } from './merchant.js';
import { Hazards } from './hazards.js';
import { Projectiles, makeProjectileMesh } from './projectiles.js';
import { BoneSword } from './bonesword.js';
import { updateSpikes } from './traps.js';
import { raiseRightArm } from './abilities.js';
import { setFlash } from './characters.js';
import { clipNames } from './animation.js';
import { BLESSINGS, BLESSING_BY_ID, RARITY } from './blessings.js';
import { ENEMY_TYPES, PICKUP_KINDS, PROJ_KINDS } from './coop.js';
import { makeRogueShot, ammoSmoke } from './rogue.js';
import { OmenView } from './teamwork.js';
import { audio } from './audio.js';
import { detachHead, shatterBoss, liftArms } from './finale.js';
import { shieldVisual } from './shield.js';
import { setGhost } from './shadow.js';
import { Tavern } from './tavern.js';
import { save } from './save.js';
import { WEAPONS, heroWith, ownsHero } from './heroes.js';
import { UnlockScene } from './unlock.js';
import { updateFlail } from './flail.js';
import { tickDome } from './ultimate.js';
import { input } from './input.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (dt, k = 14) => 1 - Math.exp(-k * dt);
const unvec = (a) => (a && a.v ? new THREE.Vector3(a.v[0], a.v[1], a.v[2]) : a);

// Repete a animação que o outro computador começou (mesmo clipe, velocidade e "uma vez/loop").
function syncAnim(anim, pid, clip, speed, once) {
  const name = clipNames[clip];
  if (!name) return;
  if (pid !== anim.syncId) {
    anim.syncId = pid;
    try { anim.play(name, { once: !!once, speed, restart: true, fade: 0.12 }); } catch (e) { /* clipe desconhecido */ }
  } else if (anim.current && anim.current.timeScale !== speed) anim.current.timeScale = speed;
}

export class Replica {
  // g: { scene, world, vfx, debris, hud, ui, cam, text, heroes: [Jogador 1, Jogador 2] }
  constructor(g) {
    Object.assign(this, g);
    this.enemies = new Map();
    this.pickups = new Map();
    this.shots = new Map();
    this.icons = [];
    this.built = null;
    this.rv = -1;
    this.npc = null;
    this.lastEv = 0;
    this.hostTime = 0;
    this.got = false;        // já chegou algum estado?
    // "combate" de mentira para as peças que só desenham (mercador, lâmina de ossos, chuva de crânios).
    this.shim = {
      scene: this.scene, vfx: this.vfx, debris: this.debris, cam: this.cam, world: this.world, text: this.text,
      players: [], merchant: null, hazards: { bounds: null }, projectiles: { fire() {} },
      nearestPlayer: () => this.heroes[1],
    };
    this.hazards = new Hazards(this.scene, this.vfx, this.text);
    this.rain = new Projectiles(this.scene, this.shim);
    this.rain.visual = true;
    this.omen = new OmenView(this.scene); // Visão Espectral (avisos vermelhos no chão)
    this.omens = [];
    this.heroState = [null, null];
    this.rolls = [-1, -1];
    this.mm = '';
    this.go = 0;
    this.choiceId = 0;
    this.blessKey = '';
    this.onChoice = null;     // (id, options, título) — abre o menu de bênção
    this.onChoiceGone = null;
    this.tavern = new Tavern({ scene: this.scene, ui: this.ui });
    this.inTavern = false;
    this.spectator = false;   // só assiste (não é o Jogador 2)
    this.sp = 0;              // quantas pessoas assistindo
  }

  get me() { return this.heroes[1]; }
  get mine() { return this.heroState[1]; }

  // ---------- Estado (sala A) ----------
  applyState(s) {
    if (!s) return;
    this.got = true;
    if (s.rv !== this.rv && s.rm) this.buildRoom(s);
    if (this.built) this.built.setDoorsOpen(!!s.do);
    this.hostTime = s.t || 0;
    this.sp = s.sp || 0;
    this.inTavern = !!s.tv;
    // Taverna: alguém trocou de herói -> remonta a mesa e o suporte (com o herói deste jogador).
    if (this.inTavern && this.built && s.tvv !== this.tvv) {
      this.tvv = s.tvv;
      this.buildTavernDecor();
      for (const p of this.pickups.values()) this.removePickup(p);
      this.pickups.clear();
    }
    s.h.forEach((h, i) => { if (h) this.heroState[i] = h; });
    if (this.pred && s.h[1]) this.pred.server(s.h[1][0], s.h[1][1], s.p2 || null);
    this.omens = s.om || [];
    this.applyEnemies(s.e || []);
    this.applyPickups(s.pk || []);
    this.applyMerchant(s.mc);
    this.ultState = s.ul || [];
    const mm = JSON.stringify(s.mm || 0);
    if (mm !== this.mm && s.mm) { this.mm = mm; this.hud.setMinimap(...s.mm); }
    this.hud.setWave(s.wv || '');
    if (s.bs) {
      if (!this.hud.boss) this.hud.showBoss({ data: { name: s.bs[0] }, hp: s.bs[1], maxHp: s.bs[2], alive: true });
      this.hud.boss.hp = s.bs[1]; this.hud.boss.maxHp = s.bs[2];
    } else if (this.hud.boss) this.hud.hideBoss();
    this.ui.fade(!!s.fd);
    if (s.pr && !this.spectator) this.ui.setPrompt(s.pr[0], new THREE.Vector3(s.pr[1], s.pr[2], s.pr[3])); else this.ui.setPrompt(null);
    // Fim de jogo / vitória.
    if (s.go !== this.go) {
      this.go = s.go;
      this.hud.hideDeath(); this.ui.hideWin();
      if (s.go === 1) this.hud.showDeath(s.gs);
      if (s.go === 2) this.ui.showWin(s.gs);
    }
    // Bênção para escolher.
    const ch = s.ch;
    if (ch && ch[0] !== this.choiceId) {
      this.choiceId = ch[0];
      const opts = ch[2].map((id) => BLESSING_BY_ID[id]).filter(Boolean);
      if (this.onChoice) this.onChoice(ch[0], opts, ch[1]);
    } else if (!ch && this.choiceId && this.onChoiceGone) { this.onChoiceGone(); }
    if (!ch) this.choiceId = 0;
  }

  buildRoom(s) {
    this.clear();
    this.rv = s.rv;
    const [roomId, slots, infos] = s.rm;
    const room = ROOMS[roomId];
    if (!room) return;
    const built = buildRoom(room, { doors: slots });
    this.built = built;
    this.scene.add(built.group);
    this.world.clear();
    built.colliders.forEach((r) => this.world.addRect(...r));
    this.world.setBounds(built.halfW, built.halfD, built.wallHalf ?? 0.5);
    this.icons = decorateDoors(this.scene, this.ui, built, infos);
    if (room.special === 'tavern') { this.tvv = s.tvv; this.buildTavernDecor(this.world); }
    this.shim.hazards.bounds = built;
    this.hazards.bounds = built;
    // Heróis aparecem direto no lugar novo (sem deslizar pela sala).
    this.snapHeroes = true;
  }

  buildTavernDecor(world = null) {
    const me = this.heroes[1];
    this.tavern.buildDecor(world, me.heroId, (h) => ownsHero(save.data.ups, h));
  }

  // Cena de desbloqueio (o anfitrião avisa; aqui só a decoração da Taverna se mexe).
  playUnlock(heroId) {
    if (!this.inTavern) return;
    if (!this.unlockScene) this.unlockScene = new UnlockScene({ scene: this.scene, vfx: this.vfx, tavern: this.tavern, players: [], cam: this.cam, text: this.text });
    this.unlockScene.play(heroId, null, () => this.buildTavernDecor());
  }

  clear() {
    if (this.unlockScene) this.unlockScene.abort();
    if (this.built) this.scene.remove(this.built.group);
    this.built = null;
    for (const e of this.enemies.values()) this.removeEnemy(e);
    this.enemies.clear();
    for (const p of this.pickups.values()) this.removePickup(p);
    this.pickups.clear();
    for (const a of this.shots.values()) this.scene.remove(a.g);
    this.shots.clear();
    for (const i of this.icons) this.scene.remove(i);
    this.icons.length = 0;
    if (this.npc) { this.scene.remove(this.npc.group); this.npc = null; }
    this.tavern.clear();
    this.hazards.clear();
    this.rain.clear();
    this.debris.clear();
    this.vfx.clear();
    this.ui.clearLabels();
  }

  removeEnemy(e) {
    if (e.boneSword) { e.boneSword.shatter(true); e.boneSword = null; }
    this.scene.remove(e.group);
  }

  applyEnemies(list) {
    const seen = new Set();
    for (const a of list) {
      const [id, ti, x, z, f, y, sc, pid, clip, spd, once, flash, eyes, code, imm = 0, alpha = 1, rk = -1] = a;
      seen.add(id);
      let e = this.enemies.get(id);
      if (!e) {
        const type = ENEMY_TYPES[ti];
        if (!type) continue;
        e = new Enemy(type, x, z, { awake: true, passive: true, abilities: false, facing: f });
        e.anim.syncId = -1;
        e.code = 0;
        this.scene.add(e.group);
        this.enemies.set(id, e);
      }
      e.tx = x; e.tz = z; e.tf = f;
      e.group.position.y = y;
      e.group.scale.setScalar(sc);
      if (rk >= 0 || e.netRoll) { applyEnemyRoll(e, rk); e.netRoll = rk >= 0; } // cambalhota do Arqueiro
      if (e.code !== 1 && e.code !== 2) syncAnim(e.anim, pid, clip, spd, once);
      e.netFlash = flash; e.netEyes = eyes;
      e.netImmune = !!imm;
      if (alpha !== (e.alpha ?? 1)) setGhost(e, alpha);
      this.enemyCode(e, code);
    }
    for (const [id, e] of this.enemies) if (!seen.has(id)) { this.removeEnemy(e); this.enemies.delete(id); }
  }

  enemyCode(e, code) {
    if (code === e.code) return;
    const was = e.code;
    e.code = code;
    if (e.data.phantom && (code === 1 || code === 2)) { e.group.visible = false; this.vfx.smoke(e.position, 0x1a1028, 12); return; } // cópia do Ceifador
    // Lâmina de ossos do Guardião: monta aqui também (os esqueletos voando são só enfeite).
    if (code === 3 && !e.boneSword && e.weapons[0]) {
      const cfg = ENEMIES.guardian.rage.stats.spin.boneSword;
      e.boneSword = new BoneSword(e, this.shim, cfg);
    }
    if (code !== 3 && e.boneSword) { e.boneSword.shatter(); e.boneSword = null; }
    if (code === 4) e.t = 0;
    const cine = (c) => c === 5 || c === 6 || c === 7;
    if (cine(code) && !cine(was) && was !== 1) {
      // Cena de morte do Rei Skullbone começou: a arma e o escudo caem.
      for (const w of e.weapons) this.debris.drop(w, -Math.sin(e.facing), -Math.cos(e.facing));
      e.weapons.length = 0;
    }
    if ((code === 5 || code === 6) && !e.headOff) detachHead(e, this.scene, this.debris);
    if (code === 2 && cine(was)) {
      shatterBoss(e, this.debris, this.vfx, Math.sin(e.facing), Math.cos(e.facing));
      return;
    }
    if ((code === 1 || code === 2) && was !== 1 && was !== 2) {
      // Morreu: a arma cai da mão.
      for (const w of e.weapons) this.debris.drop(w, -Math.sin(e.facing), -Math.cos(e.facing));
      e.weapons.length = 0;
      try { e.anim.play(e.data.anims.death, { once: true, restart: true, fade: 0.05, speed: 1.4 }); } catch (err) { /* nada */ }
    }
    if (code === 2) {
      // Desmontou em ossos.
      e.group.visible = false;
      const me = this.me.position;
      const dx = e.position.x - me.x, dz = e.position.z - me.z, d = Math.hypot(dx, dz) || 1;
      this.debris.skeleton(e.position, dx / d, dz / d, e.type !== 'minion');
      this.vfx.puff(e.position);
    }
  }

  applyPickups(list) {
    const seen = new Set();
    for (const a of list) {
      const [id, ki, x, z, color, ring, isPotion, price, size, hidden, gold, wid = 0, eqd = 0] = a;
      seen.add(id);
      let p = this.pickups.get(id);
      if (!p) {
        const kind = PICKUP_KINDS[ki];
        if (!kind) continue;
        const isW = typeof wid === 'string' && wid[0] === 'w';
        const opts = { color: color || undefined, size, item: isPotion ? 'potion' : isW ? 'weapon' : wid === 'h' ? 'hero' : wid === 'm' ? 'hire' : 'blessing', gold: gold ? undefined : false };
        if (isW) { // suporte de armas: mostra a arma do herói deste jogador
          const me = this.heroes[1], slot = +wid.slice(1);
          opts.slot = slot;
          opts.weapon = WEAPONS[me.heroId][slot] || WEAPONS.knight[slot];
          opts.arms = heroWith(me.heroId, opts.weapon.id).weapons;
          opts.color = opts.weapon.color;
        }
        if (ring >= 0) opts.ringColor = ring;
        p = new Pickup(kind, new THREE.Vector3(x, 0, z), opts);
        this.scene.add(p.group);
        if (kind === 'shop' && price > 0) p.label = this.ui.addLabel(`<span class="price">${price}</span>`, p.pos.clone().setY(2.6), 'tag');
        this.pickups.set(id, p);
      }
      p.group.visible = !hidden;
      if (p.setEquipped) p.setEquipped(!!eqd);
      if (p.label) p.label.el.style.display = hidden ? 'none' : '';
    }
    for (const [id, p] of this.pickups) if (!seen.has(id)) { this.removePickup(p); this.pickups.delete(id); }
  }

  removePickup(p) {
    this.scene.remove(p.group);
    if (p.label) p.label.el.remove();
  }

  applyMerchant(m) {
    if (!m) { if (this.npc) { this.scene.remove(this.npc.group); this.npc = null; } return; }
    const [x, z, rot, pid, clip, spd, once, flash, alive, roll = -1] = m;
    if (!this.npc) { this.npc = new Merchant(this.scene, this.shim, x, z); this.npc.anim.syncId = -1; }
    this.npc.group.rotation.y = rot;
    // Mercador contratado (luta do chefe): anda e rola.
    this.npc.position.x += (x - this.npc.position.x) * 0.5; this.npc.position.z += (z - this.npc.position.z) * 0.5;
    if (roll > 0) this.npc.applyRoll(roll); else this.npc.clearRoll();
    syncAnim(this.npc.anim, pid, clip, spd, once);
    this.npc.flash = flash;
    this.npc.alive = !!alive;
  }

  // ---------- Projéteis e efeitos (sala B) ----------
  applyFx(f) {
    if (!f) return;
    const seen = new Set();
    for (const a of f.p || []) {
      const [id, k, color, sc, x, z, y, ang, speed] = a;
      seen.add(id);
      let s = this.shots.get(id);
      if (!s) {
        const kind = PROJ_KINDS[k] || 'orb';
        const g = kind === 'kunai' || kind === 'bolt' ? makeRogueShot(kind) : makeProjectileMesh(kind, color, sc);
        g.position.set(x, y, z);
        this.scene.add(g);
        s = { g, k };
        this.shots.set(id, s);
      }
      s.x = x; s.z = z; s.speed = speed;
      s.g.position.y = y;
      s.g.rotation.y = ang;
      // Corrige a posição sem dar "tranco" (a flecha continua andando entre um pacote e outro).
      if (Math.hypot(s.g.position.x - x, s.g.position.z - z) > 3) s.g.position.set(x, y, z);
    }
    for (const [id, s] of this.shots) if (!seen.has(id)) { this.scene.remove(s.g); this.shots.delete(id); }
    for (const item of f.ev || []) {
      const [s] = item;
      if (s <= this.lastEv) continue;
      this.lastEv = s;
      try { this.event(item.slice(1)); } catch (e) { /* efeito com defeito: ignora */ }
    }
  }

  event(e) {
    const [type] = e;
    switch (type) {
      case 'U': this.playUnlock(e[1]); break;
      case 'v': { const fn = this.vfx[e[1]]; if (fn) fn.apply(this.vfx, e.slice(2).map(unvec)); break; }
      case 't': this.text.add(e[1], { x: e[2], z: e[3] }, e[4], e[5]); break;
      case 'k': this.cam.shake(e[1]); break;
      case 's': audio.play(e[1], e[2] ?? undefined, e[3] ?? undefined, { net: false, v: e[4] }); break;
      case 'fl': this.hud.flash(e[1], e[2]); break;
      case 'b': this.hud.banner(e[1], e[2]); break;
      case 'T': {
        if (this.spectator) break; // avisos só para a tela do Jogador 2
        const [, sub, a, b] = e;
        if (sub === 'hurt') this.hud.hurt(a);
        else if (sub === 'k') this.cam.shake(a);
        else if (sub === 'pw') this.hud.potionWarn();
        else if (sub === 'gw') this.hud.goldWarn();
        else if (sub === 'sw') this.hud.shieldWarn();
        else if (sub === 'b') this.hud.banner(a, b);
        break;
      }
      case 'rain': this.rain.rain(e[1].map(([x, z, delay]) => ({ x, z, delay })), { fall: e[2], radius: e[3] }); break;
      case 'hz': this.hazards.spawnCircles(e[1].map(([id, x, z]) => ({ id, x, z })), { radius: e[2], warn: e[3], life: e[4] }); break;
      case 'hzr': { const c = this.hazards.circles.find((o) => o.id === e[1]); if (c) this.hazards.remove(c); break; }
      default: break;
    }
  }

  // ---------- A cada quadro ----------
  update(dt, time) {
    const k = smooth(dt);
    this.omen.show(this.omens);
    // Heróis.
    this.heroState.forEach((h, i) => {
      const p = this.heroes[i];
      if (!h) { p.group.visible = false; return; }
      const [x, z, f, pid, clip, spd, once, roll, glow, fr, fg, fb, fi, hp, mhp, pot, gold, spec, vis, dead, , y = 0, sh = 10, , rm = 1, wid] = h;
      if (wid) {
        const [hid, w] = String(wid).includes('/') ? String(wid).split('/') : ['knight', wid];
        if (hid !== p.heroId) p.setHero(hid, w); else if (w !== p.weaponId) p.setWeapon(w);
      }
      if (p.shield !== sh) { p.shield = sh; shieldVisual(p); }
      if (p.weaponMul !== rm && p.syncWeaponSize) p.syncWeaponSize(rm);
      // Herói deste computador: responde na hora (predict.js); o anfitrião só corrige.
      const pr = i === 1 && this.pred ? this.pred.drive(p, dt, f, this.snapHeroes) : null;
      if (pr) p.facing += wrap(pr.facing - p.facing) * smooth(dt, pr.local ? 22 : 14);
      else {
        if (this.snapHeroes) p.position.set(x, 0, z);
        else { p.position.x += (x - p.position.x) * k; p.position.z += (z - p.position.z) * k; }
        p.facing += wrap(f - p.facing) * k;
      }
      p.position.y += (y - p.position.y) * k; // levantado pelo Rei Skullbone
      p.group.rotation.y = p.facing;
      p.group.visible = !!vis;
      if (!pr || !pr.local) { if (!(pr && this.pred.adopt(p.anim, pid, clipNames[clip], spd))) syncAnim(p.anim, pid, clip, spd, once); }
      // Cambalhota: continua girando entre um pacote e outro (a do Jogador 2 já gira aqui na hora).
      if (pr && pr.roll) { /* rolamento feito aqui */ } else if (roll >= 0) {
        if (this.rolls[i] < 0 || Math.abs(this.rolls[i] - roll) > 0.35) this.rolls[i] = roll;
        this.rolls[i] += dt / p.hero.dodge.time;
        if (this.rolls[i] < 1) p.applyRoll(this.rolls[i]); else p.clearRoll();
      } else if (this.rolls[i] >= 0) { this.rolls[i] = -1; p.clearRoll(); }
      p.setGlow(glow);
      setFlash(p.bodyMats, fi, fr, fg, fb);
      p.hp = hp; p.potions = pot; p.gold = gold;
      p.stats.spectral = !!spec; p.spectralCd = 0;
      p.updateSpectral(dt);
      const us = (this.ultState || [])[i];
      tickDome(p, !!(us && us[2] > 0) && !dead && p.heroId === 'knight', dt);
      ammoSmoke(p, !!(us && us[5])); // Ladino invisível: transparente também na tela do Jogador 2
      p.netDead = !!dead;
      p.anim.update(dt);
      if (p.weapon && p.weapon.userData.flail) updateFlail(p.weapon, dt);
    });
    this.snapHeroes = false;
    // HUD do Jogador 2 (ele mesmo) e a barrinha do parceiro.
    const mine = this.spectator ? null : this.mine;
    if (this.spectator) {
      const [a, b] = this.heroState;
      if (a) this.hud.setAlly('Jogador 1', a[13], a[14], `#${PLAYER_COLORS[1].toString(16).padStart(6, '0')}`, 0);
      if (b) this.hud.setAlly('Jogador 2', b[13], b[14], `#${PLAYER_COLORS[2].toString(16).padStart(6, '0')}`, 1);
      this.hud.setSoul(0, false);
      this.hud.update(dt, 1);
    }
    if (mine) {
      this.hud.setHealth(mine[13], mine[14]);
      this.hud.setPotions(mine[15], 1);
      this.hud.setGold(mine[16]);
      if (mine[22] !== undefined) this.hud.setShield(mine[22], mine[23]);
      const um = (this.ultState || [])[1];
      if (um) this.hud.setUlt(um[0], um[1], input.device === 'pad' ? 'RT' : 'R');
      if (um) { const a = um[3]; this.hud.setAmmo(a ? { n: a[0], max: a[1], kind: a[2], stack: a[3] } : null); this.hud.setSmoke(um[4] ?? -1, !!um[5]); }
      if (mine[26] !== undefined) save.adopt(mine[26], mine[27], mine[28], mine[29]);
      this.hud.setSoul(save.data.soul, this.inTavern);
      const bk = mine[20] || '';
      if (bk !== this.blessKey) {
        this.blessKey = bk;
        const owned = {};
        for (const part of bk.split(',')) { const [id, n] = part.split(':'); if (id) owned[id] = +n; }
        this.me.blessings = owned;
        this.hud.setBlessings(owned, BLESSINGS, RARITY);
      }
      this.hud.update(dt, mine[13] / mine[14]);
    }
    const host = this.heroState[0];
    if (host && !this.spectator) this.hud.setAlly('Jogador 1', host[13], host[14], `#${PLAYER_COLORS[1].toString(16)}`);
    // Esqueletos.
    for (const e of this.enemies.values()) {
      if (e.tx === undefined) continue;
      e.position.x += (e.tx - e.position.x) * k;
      e.position.z += (e.tz - e.position.z) * k;
      e.facing += wrap(e.tf - e.facing) * k;
      e.group.rotation.y = e.facing;
      setFlash(e.bodyMats, (e.netFlash || 0) * 1.6);
      if (e.eyes.length) setFlash(e.eyes, e.netEyes || 0, 1, 0.1, 0.05);
      e.anim.update(dt);
      if (e.boneSword) e.boneSword.update(dt);
      if (e.data.boss) e.updateImmuneFx(dt, e.netImmune);
      if (e.code === 4 && e.data.cast) { e.t += dt; if (e.t < e.data.cast.time) raiseRightArm(e); }
      if (e.code === 6) { e.liftW = Math.min(1, (e.liftW || 0) + dt / 0.45); liftArms(e, e.liftW); }
    }
    if (this.npc) {
      this.npc.anim.update(dt);
      setFlash(this.npc.flashMats, this.npc.flash || 0);
    }
    // Projéteis: andam para a frente até o próximo pacote.
    for (const s of this.shots.values()) {
      if (s.speed > 0) {
        s.g.position.x += Math.sin(s.g.rotation.y) * s.speed * dt;
        s.g.position.z += Math.cos(s.g.rotation.y) * s.speed * dt;
        s.g.position.x += (s.x - s.g.position.x) * smooth(dt, 4);
        s.g.position.z += (s.z - s.g.position.z) * smooth(dt, 4);
      } else { s.g.position.x = s.x; s.g.position.z = s.z; }
    }
    for (const p of this.pickups.values()) p.update(dt);
    if (this.inTavern) this.tavern.update(dt, this.heroes.filter((h) => h.group.visible));
    if (this.unlockScene && this.unlockScene.active) this.unlockScene.update(dt);
    for (const i of this.icons) { i.rotation.y += dt * 1.2; i.position.y = 5.2 + Math.sin(time * 2 + i.position.x) * 0.15; }
    this.hazards.update(dt, []);
    this.rain.updateRain(dt);
    this.hostTime += dt;
    if (this.built) {
      updateSpikes(this.built.spikes, dt, this.hostTime, this.shim, true);
      this.built.update(time, dt);
      const pos = [...this.heroes.filter((h) => h.group.visible).map((h) => h.position),
        ...[...this.enemies.values()].filter((e) => e.code === 0).map((e) => e.position)];
      this.built.updateFrontWall(pos, dt);
    }
    this.debris.update(dt);
    this.vfx.update(dt);
  }
}
