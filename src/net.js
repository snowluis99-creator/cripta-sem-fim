// Conexão do co-op: usa a "sala" da página do Claude (quem está com o jogo aberto agora).
// O anfitrião cria uma sala com um código; o Jogador 2 entra nela. Duas salas por partida:
//   cripta-<código>     -> estado do jogo (anfitrião) e comandos (Jogador 2)
//   cripta-<código>-fx  -> projéteis e efeitos (anfitrião)
// Tudo vai pela "presença" (cada um publica o próprio objeto; o outro lê o mais recente).

import { P2PRoom, p2pAvailable } from './p2p.js';

// Link do jogo fora do Claude (onde o co-op com amigos funciona).
export const PUBLIC_URL = 'https://snowluis99-creator.github.io/cripta-sem-fim/';

const MAX_BYTES = 4000; // limite da presença: 4 KiB
const enc = new TextEncoder();
export const sizeOf = (o) => enc.encode(JSON.stringify(o)).length;

export class Net {
  constructor() {
    this.room = null;
    this.role = null;      // 'host' | 'guest' | 'spec' (espectador: só assiste)
    this.code = '';
    this.a = null; this.b = null;
    this.onStatus = null;  // (texto) para o menu
    this.direct = false;   // true = conexão direta (jogo aberto fora do Claude)
  }

  // Liga a sala da página. Devolve false se o co-op não estiver disponível (fora do Claude, por exemplo).
  async init() {
    try {
      const use = window.claude && window.claude.use;
      this.room = use ? await use.call(window.claude, 'room') : null;
    } catch (e) { this.room = null; }
    // Fora do Claude (ou o Claude não liberou a sala): conexão direta entre os computadores.
    if (!this.room && p2pAvailable()) {
      try { this.room = new P2PRoom(); this.direct = true; await this.room.ready; } catch (e) { this.room = null; }
    }
    return !!this.room;
  }

  // Salas de outras pessoas (ou suas em outra aba): [{ code, peer, open }]
  // open = esperando o Jogador 2; senão a partida já começou (dá para assistir).
  openRooms() {
    if (!this.room) return [];
    const seen = new Set();
    return this.room.peers()
      .filter((p) => !p.sameTab && p.presence && p.presence.coop && (p.presence.coop.open || p.presence.coop.live))
      .map((p) => ({ code: String(p.presence.coop.code || '').slice(0, 8), peer: p.peer, open: !!p.presence.coop.open }))
      .filter((r) => /^[A-Z0-9]{3,8}$/.test(r.code) && !seen.has(r.code) && seen.add(r.code));
  }

  onLobby(fn) { return this.room ? this.room.onPeers(fn, () => {}) : () => {}; }

  async joinRooms(code) {
    const name = `cripta-${code.toLowerCase()}`;
    this.a = await this.room.join(name);
    this.b = await this.room.join(`${name}-fx`);
  }

  // Anfitrião: cria a sala e anuncia o código no "saguão".
  async host(code) {
    this.role = 'host';
    this.code = code;
    await this.joinRooms(code);
    await this.a.presence({ role: 'host' });
    await this.room.presence({ coop: { code, open: true } });
  }

  // Sala cheia (o Jogador 2 entrou) ou fechada.
  async closeLobby() { try { await this.room.presence({ coop: null }); } catch (e) { /* tanto faz */ } }
  // Partida começou: a sala some da lista de "entrar", mas continua aparecendo para assistir.
  async markLive() { try { await this.room.presence({ coop: { code: this.code, open: false, live: true } }); } catch (e) { /* tanto faz */ } }

  // Espectador: entra na sala só para assistir (o anfitrião não cria herói para ele).
  async spectate(code) {
    this.role = 'spec';
    this.code = code;
    await this.joinRooms(code);
    await this.a.presence({ role: 'spec' });
  }

  // Quantas pessoas estão assistindo (contando a partir da sala A).
  spectators() {
    if (!this.a) return 0;
    try { return this.a.peers().filter((p) => p.presence && p.presence.role === 'spec').length; } catch (e) { return 0; }
  }

  // Jogador 2: entra na sala do código.
  async join(code) {
    this.role = 'guest';
    this.code = code;
    await this.joinRooms(code);
    await this.a.presence({ role: 'guest', in: null });
  }

  // O outro jogador (na sala A) e o que ele publicou.
  other(roomObj, role) {
    if (!roomObj) return null;
    return roomObj.peers().find((p) => !p.sameTab && p.presence && p.presence.role === role) || null;
  }

  // Publica (com limite de tamanho). Devolve false se não coube.
  send(roomObj, obj) {
    if (!roomObj) return false;
    if (sizeOf(obj) > MAX_BYTES) return false;
    roomObj.presence(obj).catch(() => {});
    return true;
  }

  async leave() {
    try { if (this.a) await this.a.leave(); if (this.b) await this.b.leave(); } catch (e) { /* tanto faz */ }
    this.a = this.b = null;
    this.closeLobby();
  }
}

// Código curto e fácil de ditar (sem letras confusas).
export function makeCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += L[Math.floor(Math.random() * L.length)];
  return s;
}
