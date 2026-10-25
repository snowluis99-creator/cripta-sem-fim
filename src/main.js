// Inicialização e loop do jogo. Modos: menu, sozinho, anfitrião do co-op (roda o jogo) e Jogador 2 (só desenha).
import * as THREE from 'three';
import { createLoadingScreen, loadAll } from './assets.js';
import { createCamera } from './camera.js';
import { ROOMS } from './dungeon/rooms.js';
import { piecesForRoom } from './dungeon/builder.js';
import { initInput, input } from './input.js';
import { ANIM_FILES, buildClipLibrary } from './animation.js';
import { HEROES, allHeroModels } from './heroes.js';
import { ENEMIES, modelsForEnemy } from './enemies.js';
import { Player } from './player.js';
import { CollisionWorld } from './collision.js';
import { Vfx } from './vfx.js';
import { Debris, DEBRIS_MODELS } from './debris.js';
import { Combat } from './combat.js';
import { WaveManager } from './waves.js';
import { Hud } from './hud.js';
import { BLESSINGS, RARITY } from './blessings.js';
import { createSelfTest } from './selftest.js';
import { Ui } from './ui.js';
import { Run, PLAYER_COLORS } from './run.js';
import { REWARD_MODELS, ownerRing } from './rewards.js';
import { MERCHANT_MODELS } from './merchant.js';
import { PROJECTILE_MODELS } from './projectiles.js';
import { Menu } from './menu.js';
import { PauseMenu } from './pause.js';
import { settings } from './settings.js';
import { Net, makeCode, PUBLIC_URL } from './net.js';
import { CoopHost } from './coop.js';
import { Replica } from './replica.js';
import { CoopClient } from './client.js';
import { Teamwork } from './teamwork.js';
import { Ultimates } from './ultimate.js';
import { audio } from './audio.js';
import { Music } from './music.js';
import './voice.js';
import { shieldMax } from './shield.js';
import { save } from './save.js';
import { TAVERN_MODELS } from './tavern.js';

// Modo de teste: tecla I dentro do jogo (ou ?debug=1 local).
let DEBUG = new URLSearchParams(location.search).has('debug') || location.hash.startsWith('#debug');
// Estado exposto para os testes automáticos.
const state = (window.__game = { ready: false, errors: [], frames: 0, timeScale: 1, mode: 'menu' });

const loading = createLoadingScreen();
addEventListener('unhandledrejection', (e) => { state.errors.push(String(e.reason?.message || e.reason)); });

export const CAPE_P2 = 0x2f6fe0; // capa azul do Jogador 2

async function start() {
  // Renderizador
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.getElementById('game').appendChild(renderer.domElement);
  initInput(renderer.domElement);

  // Cena
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07060a);
  scene.fog = new THREE.Fog(0x07060a, 45, 90);
  scene.add(new THREE.HemisphereLight(0x6f78a8, 0x1a1210, 0.3));
  const moon = new THREE.DirectionalLight(0x9aa8ff, 0.25);
  moon.position.set(-8, 20, 6);
  scene.add(moon);

  const cam = createCamera();
  // Som: liga no primeiro clique/tecla (regra do navegador). Botão ♫ no canto troca: tudo / sem música / mudo.
  audio.boot();
  const music = new Music();
  // Música: exploração; chefe vivo (ou na cena de morte) = música tensa; mais intensa quando ele se enfurece.
  const pickMusic = (bosses, dead) => {
    if (dead) { music.set(null); return; }
    const b = bosses[0];
    music.set(b ? 'boss' : 'explore');
    if (b) music.setIntensity(b.group.scale.x > (b.type && ENEMIES[b.type].scale || 1) * 1.3 || (b.type === 'reaper' && b.phaseIdx > 0) ? 1 : 0);
  };
  const dbg = document.getElementById('debug');
  const showDebug = () => { dbg.style.display = DEBUG ? 'block' : 'none'; };

  // Assets
  const hero = HEROES.knight;
  loading.message('Carregando a masmorra…');
  const models = [
    ...Object.values(ROOMS).flatMap(piecesForRoom),
    ...REWARD_MODELS, ...MERCHANT_MODELS,
    ...allHeroModels(),
    ...Object.values(ENEMIES).flatMap(modelsForEnemy),
    ...DEBRIS_MODELS, ...PROJECTILE_MODELS, ...TAVERN_MODELS,
    ...ANIM_FILES,
  ];
  await loadAll([...new Set(models)], (p) => loading.progress(p));
  buildClipLibrary();

  const world = new CollisionWorld();

  // Herói (luz quente própria para destacar do cenário)
  const heroLight = (p) => {
    const l = new THREE.PointLight(0xffd2a0, 6, 7, 1.5);
    l.position.set(0, 3.2, 0.5);
    p.group.add(l);
  };
  const player = new Player(hero, { id: 1 });
  player.reset(0, 0);
  scene.add(player.group);
  heroLight(player);

  const hud = new Hud();
  const vfx = new Vfx(scene);
  const debris = new Debris(scene);
  const combat = new Combat({ scene, player, world, vfx, debris, cam, hud });
  const waves = new WaveManager({ combat, vfx, hud, player, world });
  const ui = new Ui();
  const run = new Run({ scene, player, combat, waves, world, vfx, debris, hud, ui, cam });
  const team = new Teamwork({ scene, combat, run, hud, vfx, cam, world }); // jogadas em dupla (co-op)
  const ult = new Ultimates({ combat, vfx, hud, run, flash: (c, t) => team.flash(c, t) }); // ultimate (R / RT)
  let mode = 'menu';           // menu | solo | host | client
  let coop = null;             // CoopHost (anfitrião)
  let client = null;           // CoopClient (Jogador 2)
  let guestMissing = 0;
  const setMode = (m) => { mode = m; state.mode = m; };

  // Avisos que só aparecem na tela deste computador (no co-op, o Jogador 2 recebe os dele pela rede).
  player.ux = {
    hurt: (a) => hud.hurt(a),
    shake: (a) => (cam.shakeLocal || cam.shake)(a),
    potionWarn: () => hud.potionWarn(),
    goldWarn: () => hud.goldWarn(),
    banner: (t, size) => (hud.bannerLocal || hud.banner).call(hud, t, size),
    shieldWarn: () => hud.shieldWarn(),
  };

  // Rastro de Gelo: poças de gelo ao longo do rolamento (cada herói).
  const iceTrail = (p, dt) => {
    if (!(p.iceTimer > 0)) return;
    p.iceTimer -= dt; p.iceGap = (p.iceGap || 0) - dt;
    if (p.iceGap <= 0) {
      p.iceGap = 0.06;
      const z = { x: p.position.x, z: p.position.z, r: 1.3, age: 0, life: 3 };
      combat.ice.push(z);
      vfx.ice(p.position, z.r, z.life);
    }
  };
  let deathTimer = -1;
  // Ligações de um herói com o resto do jogo (o Jogador 2 do co-op usa as mesmas).
  const setupHero = (p) => {
    p.onDodge = (h, phase) => {
      vfx.dust(h.position, h.dodgeDir, phase === 'start' ? 7 : 4);
      if (phase === 'start' && h.stats.iceTrail) h.iceTimer = 0.3;
    };
    p.onRevive = (h) => {
      h.ux.banner('Coração de Fênix!', 'big');
      vfx.burst(h.position, 0xffc24a);
      if (h === player) hud.setBlessings(h.blessings, BLESSINGS, RARITY);
      h.ux.shake(0.4);
    };
    p.onHit = (h, step) => { combat.playerStrike(h, step); if (step.heavy) team.heavy(h); };
    p.canShareHeal = (h) => team.partnerNeedsHeal(h);
    p.onHealOverflow = (h, extra) => team.shareHeal(h, extra);
    p.onHeal = (h, amount) => {
      combat.text.add(`+${amount}`, h.position, 'heal');
      vfx.sparks(new THREE.Vector3(h.position.x, 1.4, h.position.z), 0x7dff8a, 10);
    };
    p.onPotionFail = (h) => h.ux.potionWarn();
    p.onNoShield = (h) => { combat.text.add(h.hero.block.wall ? 'Sem barreira!' : 'Sem escudo!', h.position, 'miss', 3.2); if (h.ux.shieldWarn) h.ux.shieldWarn(); };
    p.onDeath = (h) => {
      h.ux.shake(0.4);
      if (combat.alivePlayers.length === 0) deathTimer = 1.6;
      else hud.banner(`Jogador ${h.id} caiu! A sala de descanso traz de volta`, 'small');
    };
  };
  setupHero(player);
  combat.onKill = (e, by) => {
    by = by || player;
    by.gold += Math.round(2 * by.stats.goldMul);
    if (by === player) hud.setGold(by.gold);
    if (e.data.final || e.data.finale) waves.queue.length = 0; // chefe morreu: ninguém mais nasce
  };
  combat.onSummon = (boss, list) => { waves.summon(list); hud.banner(`${boss.data.short || 'O chefe'} invoca esqueletos!`, 'small'); };

  // Recomeçar depois de morrer (ou ganhar).
  const restart = () => {
    hud.hideDeath();
    ui.hideWin();
    if (ui.modal) ui.closeChoice();
    deathTimer = -1;
    combat.kills = 0;
    waves.cleared = 0;
    run.won = false;
    if (coop) { coop.gameOver = 0; coop.input.retries = 0; }
    run.start();
    team.reset();
    hud.setWave('');
    hud.setGold(0);
    hud.setBlessings({}, BLESSINGS, RARITY);
  };
  hud.onRetry = () => { if (mode !== 'client') restart(); };
  ui.onRetry = () => { if (mode !== 'client') restart(); };
  restart();

  cam.target.copy(player.position);
  cam.follow(player.position, 1);

  addEventListener('resize', () => {
    cam.resize();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ---------- Menu e co-op ----------
  const menu = new Menu();

  // Pausa (Esc / Start / botão ⚙). Sozinho congela o jogo; no co-op só abre o menu.
  const pause = new PauseMenu();
  state.pause = pause; // testes
  const pauseOpts = () => ({
    coop: mode === 'host' || mode === 'client',
    canQuit: mode === 'solo' && !run.inTavern && !run.won,
    canMenu: mode === 'solo',
  });
  const setPaused = (on) => {
    document.body.classList.toggle('paused', on);
    audio.setHold(on && mode === 'solo');
    input.clear();
  };
  const openPause = () => { if (pause.visible) return; pause.open('pause', pauseOpts()); setPaused(true); };
  pause.on.closed = () => setPaused(false);
  const togglePause = () => { if (pause.visible) pause.back(); else if (mode !== 'menu') openPause(); };
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !e.repeat && !selfTest.running) { e.preventDefault(); togglePause(); } });
  pause.on.button = () => {
    if (pause.visible) { pause.back(); return; }
    if (mode === 'menu') pause.open('config', {}); else openPause();
  };
  // Desistir: o ouro vira Ouro de Alma (como se tivesse caído) e volta para a Taverna.
  const giveUp = () => {
    if (!run.inTavern && !run.won) run.bankSoul(false);
    restart();
  };
  pause.on.quit = () => { setPaused(false); giveUp(); hud.banner('Você voltou para a Taverna', 'small'); };
  pause.on.mainmenu = () => { setPaused(false); giveUp(); setMode('menu'); menu.show('main'); };
  menu.on.config = () => pause.open('config', {});
  menu.on.controls = () => pause.open('controls', {});
  // Dicas de controle na tela (Configurações).
  settings.onChange((st) => document.getElementById('controls').classList.toggle('off', !st.hints));
  const net = new Net();
  menu.setCoop(false, 'Procurando a conexão para 2 jogadores…');
  net.init().then((ok) => menu.setCoop(ok, ok ? '' : (PUBLIC_URL
    ? `Para jogar com amigos, abra o jogo por este link: ${PUBLIC_URL}`
    : 'O modo 2 jogadores não está disponível neste navegador.')));
  let unLobby = null;
  const leaveNet = () => { net.leave(); if (unLobby) { unLobby(); unLobby = null; } };

  menu.on.solo = () => { menu.hide(); setMode('solo'); };
  menu.on.back = () => { leaveNet(); menu.show('main'); };
  menu.on.msgok = () => menu.show('main');
  menu.on.host = async () => {
    const code = makeCode();
    menu.setCode(code);
    menu.setWait('Abrindo a sala…');
    menu.show('host');
    try {
      await net.host(code);
      menu.setWait('Esperando o Jogador 2 entrar…');
    } catch (e) { menu.message(`Não deu para criar a sala (${e.code || e.message || e}).`); }
  };
  // Assistir: entra na sala só para ver os dois jogando (sem herói, sem mexer em nada).
  menu.on.watch = async (code) => {
    if (!/^[A-Z0-9]{3,8}$/.test(code || '')) { menu.message('Digite o código da sala para assistir.'); return; }
    try {
      await net.spectate(code);
      startClient(true);
    } catch (e) { menu.message(`Não deu para assistir a sala ${code} (${e.code || e.message || e}).`); }
  };
  menu.on.join = async (code) => {
    if (code === undefined) {
      menu.show('join');
      menu.setRooms(net.openRooms());
      if (!unLobby) unLobby = net.onLobby(() => menu.setRooms(net.openRooms()));
      return;
    }
    if (!/^[A-Z0-9]{3,8}$/.test(code)) { menu.message('Código inválido.'); return; }
    try {
      await net.join(code);
      startClient();
    } catch (e) { menu.message(`Não deu para entrar na sala ${code} (${e.code || e.message || e}).`); }
  };

  // Anfitrião: o Jogador 2 chegou -> cria o segundo cavaleiro (capa azul) e começa a partida.
  let p2 = null;
  const addGuest = () => {
    coop = new CoopHost({ net, scene, combat, run, hud, ui, cam, vfx, waves, team });
    team.emit = (e) => coop.event(e);
    p2 = new Player(hero, { id: 2, input: coop.input, cape: CAPE_P2 });
    p2.ux = coop.remoteUx();
    p2.saveData = net.a ? null : { soul: 0, ups: {}, runs: 0, best: 0, rev: 0 }; // robô de teste: progresso zerado
    setupHero(p2);
    heroLight(p2);
    scene.add(p2.group);
    p2.group.add(ownerRing(PLAYER_COLORS[2], 0.95));
    player.group.add(ownerRing(PLAYER_COLORS[1], 0.95));
    combat.players.push(p2);
    if (net.a) net.markLive(); else net.closeLobby(); // a sala continua na lista para quem quiser assistir
    menu.hide();
    setMode('host');
    restart();
    hud.banner('Jogador 2 entrou!', 'big');
  };
  const removeGuest = () => {
    if (!p2) return;
    run.resolveRemoteChoice(run.pendingChoice?.id, -1);
    team.breakPair();
    combat.players.splice(combat.players.indexOf(p2), 1);
    scene.remove(p2.group);
    p2 = null;
    hud.setAlly(null);
    hud.banner('O Jogador 2 saiu', 'small');
  };

  // Jogador 2: o jogo deste computador para de simular e só desenha o que o anfitrião manda.
  const startClient = (spectator = false) => {
    run.clearRoom();
    scene.remove(player.group);
    const h1 = new Player(hero, { id: 1 });
    const h2 = new Player(hero, { id: 2, cape: CAPE_P2 });
    for (const h of [h1, h2]) { scene.add(h.group); heroLight(h); h.group.add(ownerRing(PLAYER_COLORS[h.id], 0.95)); }
    const replica = new Replica({ scene, world, vfx, debris, hud, ui, cam, text: combat.text, heroes: [h1, h2] });
    client = new CoopClient({
      net, replica, ui, hud, cam, text: combat.text, spectator,
      onLost: () => { menu.message(spectator ? 'A partida terminou ou a conexão caiu. Recarregue a página para assistir de novo.'
        : 'A conexão com o anfitrião caiu. Recarregue a página para jogar de novo.'); },
    });
    if (spectator) { if (unLobby) { unLobby(); unLobby = null; } }
    hud.setWave('');
    menu.hide();
    hud.banner(spectator ? 'Entrando para assistir…' : 'Conectando…', 'small');
    setMode('client');
  };

  // Teclas de teste: I = liga o modo de teste (FPS/estado); com ele ligado:
  // O = câmera lenta, T = teste automático, N = pula para a próxima onda, H = herói invencível.
  let god = false;
  // Teste do co-op (tecla Z com o modo de teste ligado): o Jogador 2 vira um robô que caça esqueletos.
  let bot = null;
  const makeBot = () => {
    let t = 0, n = 0;
    return (dt) => {
      if (!p2 || !coop) return;
      t += dt;
      const ri = coop.input;
      const foe = combat.enemies.filter((e) => e.alive && e.targetable)
        .sort((a, b) => a.position.distanceTo(p2.position) - b.position.distanceTo(p2.position))[0];
      let mx = 0, mz = 0, atk = false;
      if (foe) {
        const dx = foe.position.x - p2.position.x, dz = foe.position.z - p2.position.z, d = Math.hypot(dx, dz);
        if (d > 2.2) { mx = dx / d; mz = dz / d; } else atk = true;
        ri.aim = Math.atan2(dx, dz);
      } else {
        const orb = run.pickups.find((pk) => !pk.taken && (!pk.opts.owner || pk.opts.owner === p2));
        const door = run.doorsOpen && run.built && run.built.doors.find((d) => d.node);
        const goal = orb ? orb.pos : door ? { x: door.x, z: door.z } : null;
        if (goal) { const dx = goal.x - p2.position.x, dz = goal.z - p2.position.z, d = Math.hypot(dx, dz) || 1; if (d > 0.3) { mx = dx / d; mz = dz / d; } }
      }
      ri.mx = mx; ri.mz = mz;
      if (atk && t > 0.25) { t = 0; ri.pend.atk = Math.min(ri.pend.atk + 1, 2); }
      if (++n % 400 === 0) ri.pend.dge++;
      if (run.pendingChoice) run.resolveRemoteChoice(run.pendingChoice.id, 0);
      // O Jogador 1 também pega o que é dele e escolhe a 1ª bênção (para o teste andar sozinho).
      if (!foe && !run.transition) {
        const mine = run.pickups.find((pk) => !pk.taken && pk.auto && pk.opts.owner === player);
        if (mine && player.state !== 'dead') player.position.set(mine.pos.x, 0, mine.pos.z);
        if (!mine && run.doorsOpen && player.state !== 'dead') {
          const shop = run.pickups.find((pk) => !pk.taken && pk.kind === 'chest' && pk.opts.owner === player);
          if (shop) player.position.set(shop.pos.x + 1.5, 0, shop.pos.z);
        }
      }
      if (ui.modal) ui.pick(0);
    };
  };
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyI') { DEBUG = !DEBUG; showDebug(); e.preventDefault(); return; }
    if (!DEBUG || mode === 'client') return;
    if (e.code === 'KeyO') state.timeScale = state.timeScale === 1 ? 0.25 : state.timeScale === 0.25 ? 0.1 : 1;
    if (e.code === 'KeyN') { combat.enemies.forEach((en) => en.alive && en.die()); waves.timer = 0; }
    if (e.code === 'KeyG') { player.gold += 100; hud.setGold(player.gold); }
    if (e.code === 'KeyP' && run.built) { // abre as portas na hora (pular sala)
      waves.stop(); combat.enemies.forEach((en) => en.alive && en.die()); run.pickups.length && run.pickups.forEach((p) => { if (p.auto) p.taken = true; });
      run.openDoors(true);
    }
    if (e.code === 'KeyH') god = !god;
    // K = Rei Skullbone com 1 de vida na frente do herói (para ver a cena de morte).
    if (e.code === 'KeyK' && run.built) {
      const b = combat.spawn('guardian', player.position.x, player.position.z - 6, { awake: true, facing: 0 });
      b.hp = 1; b.raged = true; b.voice = { dying: true, cd: 0, talk: 0 }; hud.showBoss(b);
    }
    if (e.code === 'KeyZ') { if (!p2) addGuest(); bot = bot ? null : makeBot(); hud.banner(bot ? 'Robô no Jogador 2' : 'Robô desligado', 'small'); }
    // F = desce para o próximo andar; B = vai direto para o Ceifador (chefe final); C = vai para o Necromante (andar 2).
    if (e.code === 'KeyF') { if (run.inTavern) run.beginDescent(); else if (run.floorNum < 3) run.nextFloor(); }
    if (e.code === 'KeyB') game.gotoBoss(3);
    if (e.code === 'KeyC') game.gotoBoss(2);
  });
  showDebug();

  const clock = new THREE.Clock();
  let fpsAcc = 0, fpsFrames = 0;
  // Testes automáticos: recomeçam direto na masmorra (sem Taverna e sem melhorias).
  const game = { player, combat, waves, hud, debris, cam, renderer, scene, ult, restart: () => { restart(); run.beginDescent({ noUpgrades: true }); hud.hideBanner && hud.hideBanner(); }, toTavern: restart, save, run, ui, team, addGuest: () => { if (!p2) addGuest(); return p2; },
    // Teste: vai direto para a sala do chefe do andar n.
    gotoBoss: (n) => {
      run.nextFloor(n);
      const st = run.floor.steps, i = st.findIndex((o) => o[0].kind === 'boss');
      run.step = i + 1; run.enter(st[i][0], true);
    } };
  Object.defineProperty(game, 'client', { get: () => client }); // testes do co-op
  Object.defineProperty(game, 'coop', { get: () => coop });
  state.game = game; // testes automáticos
  const selfTest = createSelfTest(state, game, () => DEBUG);
  Object.defineProperty(state, 'game', { value: game, enumerable: false }); // testes automáticos

  // Um passo do jogo. Durante o hitstop (pausa no impacto) a simulação para, mas a câmera e os números continuam.
  let simTime = 0;
  const players = combat.players;
  const step = (dt) => {
    // Menu de bênção aberto: sozinho, o jogo pausa; no co-op continua (só este herói fica parado escolhendo).
    if (ui.modal && players.length < 2) {
      ui.updateModal(dt);
      ui.update(dt, cam.camera);
      input.endFrame();
      return;
    }
    if (ui.modal) ui.updateModal(dt);
    if (coop) coop.input.beginFrame();
    const sim = combat.simDt(dt);
    if (sim > 0) {
      simTime += sim;
      if (god) for (const p of players) if (p.state !== 'dead') p.hp = Math.max(p.hp, 60);
      for (const p of players) { p.update(sim, cam.camera, world); iceTrail(p, sim); }
      team.update(sim);
      ult.update(sim);
      combat.update(sim);
      waves.update(sim);
      run.update(sim, simTime);
      debris.update(sim);
      vfx.update(sim);
      if (run.built) run.built.update(simTime, sim);
    }
    // Câmera no herói deste computador (caído: no parceiro).
    const follow = player.state === 'dead' && p2 && p2.state !== 'dead' ? p2 : player;
    cam.follow(run.unlock.active ? run.unlock.focus : follow.position, dt, run.unlock.active ? 2.5 : 5); // cena da Taverna: câmera no meio
    if (run.built) run.built.updateFrontWall([...players.filter((p) => p.group.visible).map((p) => p.position), ...combat.enemies.filter((e) => e.alive).map((e) => e.position)], dt);
    combat.text.update(dt, cam.camera);
    ui.update(dt, cam.camera);
    hud.setHealth(player.hp, player.maxHp);
    hud.setPotions(player.potions, Math.max(1, hero.potions)); // pelo menos 1 frasco (vazio) no HUD
    hud.setGold(player.gold);
    hud.setShield(player.shield, shieldMax(player));
    hud.setUlt(player.ult, player.ultNeed, input.device === 'pad' ? 'RT' : 'R');
    updateHint(player.hero);
    hud.setSoul(save.data.soul, run.inTavern);
    hud.update(dt, player.hp / player.maxHp);
    if (p2) hud.setAlly('Jogador 2', p2.hp, p2.maxHp, `#${PLAYER_COLORS[2].toString(16)}`);
    if (deathTimer > 0) {
      deathTimer -= dt;
      if (deathTimer <= 0) {
        const stats = `Andar: <b>${run.floorNum}</b> &nbsp;·&nbsp; Salas: <b>${run.step + 1}</b> &nbsp;·&nbsp; Ondas vencidas: <b>${waves.cleared}</b> &nbsp;·&nbsp; Esqueletos destruídos: <b>${combat.kills}</b>${run.bankSoul(false)}`;
        hud.showDeath(stats);
        if (coop) { coop.gameOver = 1; coop.gameOverStats = stats; }
      }
    }
    if (coop && ui.winVisible && coop.gameOver !== 2) { coop.gameOver = 2; coop.gameOverStats = run.winStats || ''; }
    if ((hud.deathVisible || ui.winVisible) && (input.retry() || (coop && coop.input.retries > 0))) restart();
    // Durante o hitstop os botões apertados ficam guardados (o clique do combo não se perde).
    if (sim > 0) { input.endFrame(); if (coop) coop.input.endFrame(); }
  };

  // Anfitrião: lê os comandos do Jogador 2 e percebe se ele saiu.
  const hostNet = (dt) => {
    if (!net.a) return; // robô de teste (sem rede)
    const guest = net.other(net.a, 'guest');
    if (!p2) { if (guest && menu.screen === 'host' && menu.visible) addGuest(); return; }
    if (guest) { guestMissing = 0; if (guest.presence !== coop.lastPresence) { coop.lastPresence = guest.presence; coop.receive(guest); } }
    else if ((guestMissing += dt) > 5) removeGuest();
  };

  // Dica de controles: troca entre teclado/mouse e controle conforme o que o jogador usa.
  // Muda com a arma: combo de 3 ou 4; sem escudo, sem "bloquear".
  const hint = document.getElementById('controls');
  let hintDev = 'keys', hintKey = '';
  const hintHtml = (d, h) => {
    const n = `${h.combo.length}x = combo`, block = !h.noShield;
    const atk = h.caster ? 'magia' : 'atacar', blk = h.block && h.block.wall ? 'barreira' : 'bloquear';
    return d === 'pad'
      ? `<span><b>Analógico</b> andar</span><span><b>X</b> ${atk} (${n})</span><span><b>A</b> rolar</span>${block ? `<span><b>LB</b> ${blk}</span>` : ''}<span><b>Y</b> poção / usar</span><span><b>RT</b> ultimate</span><span><b>Analógico dir.</b> mirar</span><span><b>Start</b> pausa</span>`
      : `<span><b>WASD</b> andar</span><span><b>Clique</b> ${atk} (${n})</span><span><b>Espaço</b> rolar</span>${block ? `<span><b>Botão direito</b> ou <b>Shift</b> ${blk}</span>` : ''}<span><b>Q</b> poção</span><span><b>E</b> usar</span><span><b>R</b> ultimate</span><span><b>Esc</b> pausa</span>`;
  };
  const updateHint = (h) => {
    const k = `${hintDev}|${h.id}|${h.weaponId}`;
    if (k === hintKey) return;
    hintKey = k;
    hint.innerHTML = hintHtml(hintDev, h);
  };
  input.onDevice((d) => { hintDev = d === 'pad' ? 'pad' : 'keys'; });

  const frame = () => {
    const elapsed = clock.getDelta();
    const realDt = Math.min(elapsed, 0.1);
    input.poll();
    // Start do controle: abre ou volta no menu de pausa (Esc é tratado na hora, no keydown).
    if (!selfTest.running) {
      if (input.pause()) togglePause();
      else if (pause.visible) pause.nav(input.wasPressed);
    }
    if (pause.visible && mode === 'solo' && !selfTest.running) {
      // Sozinho: tudo congelado, só desenha.
      input.endFrame();
    } else if (mode === 'client') {
      client.update(realDt);
      if (client.replica.me && !client.spectator) updateHint(client.replica.me.hero);
      input.endFrame();
    } else if (selfTest.running) {
      if (mode === 'menu') { menu.hide(); setMode('solo'); }
      // Teste automático: vários passos fixos por quadro (não depende do FPS) até um ponto congelado.
      for (let i = 0; i < selfTest.stepsPerFrame; i++) {
        const d = selfTest.update();
        if (!d) break;
        step(d);
      }
    } else if (mode === 'menu') {
      if (net.a) hostNet(realDt);
      cam.follow(player.position, realDt, 5);
      input.endFrame();
    } else {
      if (mode === 'host') hostNet(realDt);
      if (bot) bot(realDt);
      // Aba escondida (quadros raros): o anfitrião alcança o tempo real em passos de até 0,1 s.
      const n = document.hidden && mode === 'host' ? Math.min(10, Math.ceil(elapsed / 0.1)) : 1;
      for (let i = 0; i < n; i++) step((n > 1 ? elapsed / n : realDt) * state.timeScale);
      if (coop && p2) coop.update(realDt, simTime);
      if (mode === 'host') hud.setWatchers(net.spectators());
    }
    // Som: ouvido no herói deste computador; música conforme a luta.
    const me = mode === 'client' ? client.replica.me : (player.state === 'dead' && p2 && p2.state !== 'dead' ? p2 : player);
    const ear = mode === 'client' && client.spectator ? cam.target : me.position;
    audio.listener.x = ear.x; audio.listener.z = ear.z;
    if (mode === 'client') {
      pickMusic([...client.replica.enemies.values()].filter((e) => e.data.boss && e.code !== 1 && e.code !== 2), hud.deathVisible);
    } else pickMusic(combat.enemies.filter((e) => e.data.boss && (e.alive || e.finale)), hud.deathVisible || (mode === 'solo' && player.state === 'dead'));
    renderer.render(scene, cam.camera);
    state.frames++;
    if (DEBUG) {
      fpsAcc += realDt; fpsFrames++;
      if (fpsAcc >= 0.5) {
        dbg.textContent = `FPS ${Math.round(fpsFrames / fpsAcc)} | ${mode} | draw ${renderer.info.render.calls} | ${player.state}`
          + ` | vida ${player.hp} | inimigos ${combat.aliveCount} (atacando ${combat.attackers})`
          + `${god ? ' | INVENCÍVEL' : ''}${state.timeScale !== 1 ? ' | lento' : ''}`
          + `${p2 ? ` | J2 ${p2.state} ${Math.ceil(p2.hp)} (${p2.position.x.toFixed(1)}, ${p2.position.z.toFixed(1)})` : ''}`
          + `${state.errors.length ? ` | ERROS ${state.errors.length}: ${state.errors[state.errors.length - 1]}` : ''}`;
        fpsAcc = 0; fpsFrames = 0;
      }
    }
  };
  renderer.setAnimationLoop(frame);
  // Aba escondida: o navegador para de desenhar; o jogo continua devagar (o co-op não cai).
  setInterval(() => { if (document.hidden) frame(); }, 100);

  save.connect(); // progresso na conta do Claude (se der); o navegador já vale desde o começo
  loading.hide();
  state.ready = true;
}

// Erros durante o jogo aparecem na tela (o console do iframe nem sempre é acessível nos testes).
addEventListener('error', (e) => {
  state.errors.push(String(e.message));
  const d = document.getElementById('debug');
  d.style.display = 'block';
  d.style.color = '#f88';
  d.textContent = 'ERRO: ' + e.message + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno;
});

start().catch((err) => {
  console.error(err);
  state.errors.push(String(err.message || err));
  loading.message(`Algo deu errado: ${err.message || err}`, true);
});
