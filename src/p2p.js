// Co-op fora do Claude: uma "sala" igual à do Claude (mesmas funções que o net.js usa),
// mas com conexão direta entre os computadores (WebRTC).
// - Para os computadores se acharem, os recados curtos (oi / oferta / resposta / salas abertas)
//   passam por um serviço público de mensagens (ntfy.sh). Depois disso, o jogo vai direto
//   de um computador para o outro.
// - Teste local (?p2ptest): os recados passam por BroadcastChannel (abas do mesmo navegador).

const APP = 'cripta-sem-fim-v1';
const NTFY = 'https://ntfy.sh';
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }];
const LOBBY_EVERY = 100;   // s: o anfitrião repete o anúncio da sala
const LOBBY_TTL = 240;     // s: anúncio mais velho que isso some da lista
const PEER_SILENT = 30;    // s sem notícia = jogador saiu
const CONNECT_TIMEOUT = 40; // s para a conexão direta abrir
const RESEND_EVERY = 1;    // s: repete a própria presença (mensagens podem se perder)

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------- Recados (sinalização) ----------
class NtfySignal {
  constructor(topic) { this.topic = `${APP}-${topic}`.replace(/[^a-zA-Z0-9_-]/g, ''); this.es = null; }
  listen(fn, sinceSec = 0) {
    return new Promise((resolve) => {
      const url = `${NTFY}/${this.topic}/sse${sinceSec ? `?since=${sinceSec}s` : ''}`;
      const es = new EventSource(url);
      this.es = es;
      let done = false;
      const ok = () => { if (!done) { done = true; resolve(true); } };
      es.onopen = ok;
      es.onmessage = (ev) => {
        try { const m = JSON.parse(ev.data); if (m.event === 'message' && m.message) fn(JSON.parse(m.message), m.time || 0); } catch (e) { /* ignora */ }
      };
      es.onerror = () => { if (!done) { done = true; resolve(false); } };
      setTimeout(ok, 6000);
    });
  }
  send(obj) {
    return fetch(`${NTFY}/${this.topic}`, { method: 'POST', body: JSON.stringify(obj) }).then((r) => r.ok).catch(() => false);
  }
  close() { if (this.es) this.es.close(); this.es = null; }
}

class LocalSignal { // teste: abas do mesmo navegador
  constructor(topic) { this.name = `${APP}-${topic}`; this.ch = null; }
  listen(fn, sinceSec = 0) {
    this.ch = new BroadcastChannel(this.name);
    this.ch.onmessage = (ev) => fn(ev.data, Date.now() / 1000);
    if (sinceSec) { // simula o histórico do ntfy
      try {
        const old = JSON.parse(localStorage.getItem(this.name) || '[]');
        for (const [m, t] of old) if (Date.now() / 1000 - t < sinceSec) fn(m, t);
      } catch (e) { /* tanto faz */ }
    }
    return Promise.resolve(true);
  }
  send(obj) {
    try {
      const old = JSON.parse(localStorage.getItem(this.name) || '[]').slice(-40);
      old.push([obj, Date.now() / 1000]);
      localStorage.setItem(this.name, JSON.stringify(old));
    } catch (e) { /* tanto faz */ }
    new BroadcastChannel(this.name).postMessage(obj);
    return Promise.resolve(true);
  }
  close() { if (this.ch) this.ch.close(); this.ch = null; }
}

const useLocal = () => /[?&#]p2ptest/.test(location.href);
const makeSignal = (topic) => (useLocal() ? new LocalSignal(topic) : new NtfySignal(topic));

// Espera juntar os "endereços" do computador para mandar tudo num recado só:
// até terminar, ou 1,5 s depois do primeiro endereço, ou no máximo 6 s.
function gathered(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    let first = null;
    const done = () => { clearTimeout(cap); clearTimeout(first); resolve(); };
    const cap = setTimeout(done, 6000);
    pc.addEventListener('icecandidate', (ev) => {
      if (!ev.candidate) return done();
      if (!first) first = setTimeout(done, 1500);
    });
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') done(); });
  });
}

// ---------- Malha: conexões diretas entre todos que entraram no mesmo código ----------
class Mesh {
  constructor(base, me) {
    this.base = base;
    this.me = me;
    this.sig = makeSignal(`m-${base}`);
    this.links = new Map(); // id -> { pc, dc, last }
    this.subs = new Map();  // nome da sala -> SubRoom
    this.ready = null;
    this.timer = null;
  }

  start() {
    if (!this.ready) {
      this.ready = this.sig.listen((m) => this.onSignal(m)).then(async (ok) => {
        if (!ok) throw Object.assign(new Error('sem conexão com o servidor de salas'), { code: 'offline' });
        await this.sig.send({ t: 'hello', from: this.me });
        this.timer = setInterval(() => this.tick(), 500);
      });
    }
    return this.ready;
  }

  link(id) {
    let L = this.links.get(id);
    if (L) return L;
    const pc = new RTCPeerConnection({ iceServers: ICE });
    L = { pc, dc: null, last: performance.now() / 1000, born: performance.now() / 1000, open: false, offering: false };
    this.links.set(id, L);
    pc.onconnectionstatechange = () => {
      if (window.__p2pdebug) console.log('state', id, pc.connectionState, (performance.now() / 1000 - L.born).toFixed(1)); if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.drop(id); };
    pc.ondatachannel = (ev) => this.wire(id, ev.channel);
    return L;
  }

  wire(id, dc) {
    const L = this.links.get(id);
    if (!L) return;
    L.dc = dc;
    dc.onopen = () => { L.open = true; L.last = performance.now() / 1000; for (const s of this.subs.values()) s.push(); };
    dc.onmessage = (ev) => {
      L.last = performance.now() / 1000; L.open = true; L.recv = (L.recv || 0) + 1;
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.bye) { L.bye = true; this.drop(id); return; }
      const s = this.subs.get(m.r);
      if (s) s.receive(id, m);
    };
    dc.onclose = () => this.drop(id);
    if (dc.readyState === 'open') dc.onopen(); // às vezes já chega aberto
  }

  async offer(id) {
    const L = this.link(id);
    L.offering = true;
    this.wire(id, L.pc.createDataChannel('jogo', { ordered: false, maxRetransmits: 0 }));
    await L.pc.setLocalDescription(await L.pc.createOffer());
    await gathered(L.pc);
    if (this.links.get(id) !== L) return;
    this.sig.send({ t: 'offer', from: this.me, to: id, sdp: L.pc.localDescription.sdp });
  }

  async onSignal(m) {
    if (!m || m.from === this.me) return;
    if (window.__p2pdebug) console.log('sig', m.t, m.from, m.to, this.me);
    try {
      if (m.t === 'hello') {
        if (!this.links.has(m.from)) await this.offer(m.from);
      } else if (m.t === 'offer' && m.to === this.me) {
        let L = this.links.get(m.from);
        if (L && L.offering) {
          if (this.me < m.from) return;  // os dois ofereceram ao mesmo tempo: vale a oferta do menor
          this.drop(m.from, true);
        } else if (L) this.drop(m.from, true);
        L = this.link(m.from);
        await L.pc.setRemoteDescription({ type: 'offer', sdp: m.sdp });
        await L.pc.setLocalDescription(await L.pc.createAnswer());
        await gathered(L.pc);
        if (this.links.get(m.from) !== L) return;
        this.sig.send({ t: 'answer', from: this.me, to: m.from, sdp: L.pc.localDescription.sdp });
      } else if (m.t === 'answer' && m.to === this.me) {
        const L = this.links.get(m.from);
        if (window.__p2pdebug) console.log('ans', !!L, L && L.offering, L && L.pc.signalingState, (m.sdp.match(/a=candidate/g) || []).length);
        if (L && L.offering && L.pc.signalingState === 'have-local-offer') await L.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp });
      }
    } catch (e) { console.warn('p2p', e); }
  }

  drop(id, quiet = false) {
    const L = this.links.get(id);
    if (!L) return;
    if (window.__p2pdebug) console.log('drop', id, (performance.now() / 1000 - L.born).toFixed(1), L.open, L.dc && L.dc.readyState, L.sent, L.recv, L.err, new Error().stack.split('\n').slice(1, 4).join(' | '));
    this.links.delete(id);
    try { L.pc.close(); } catch (e) { /* tanto faz */ }
    if (!quiet) for (const s of this.subs.values()) s.forget(id);
    // Caiu sem se despedir: pede para reconectar (no máximo a cada 5 s).
    if (!quiet && !L.bye && !this.closed) {
      const now = performance.now() / 1000;
      if (!(this.helloAt > now - 5)) { this.helloAt = now; setTimeout(() => { if (!this.closed) this.sig.send({ t: 'hello', from: this.me }); }, 800); }
    }
  }

  sendTo(obj) {
    const txt = JSON.stringify(obj);
    for (const L of this.links.values()) if (L.dc && L.dc.readyState === 'open') { try { L.dc.send(txt); L.sent = (L.sent || 0) + 1; } catch (e) { L.err = String(e); } }
  }

  tick() {
    const now = performance.now() / 1000;
    for (const [id, L] of this.links) if (L.open ? now - L.last > PEER_SILENT : now - L.born > CONNECT_TIMEOUT) this.drop(id);
    for (const s of this.subs.values()) if (now - s.sentAt > RESEND_EVERY) s.push();
  }

  close() {
    this.closed = true;
    this.sendTo({ bye: 1 });
    clearInterval(this.timer);
    for (const id of [...this.links.keys()]) this.drop(id, true);
    this.sig.close();
  }
}

// Uma sala dentro do código (estado do jogo / efeitos). Mesma cara da sala do Claude.
class SubRoom {
  constructor(mesh, name, owner) {
    this.mesh = mesh; this.name = name; this.owner = owner;
    this.mine = {}; this.seq = 0; this.sentAt = 0;
    this.others = new Map(); // id -> { peer, presence, seq }
  }
  presence(patch) {
    for (const k in patch) { if (patch[k] === null) delete this.mine[k]; else this.mine[k] = patch[k]; }
    this.push();
    return Promise.resolve();
  }
  push() {
    this.sentAt = performance.now() / 1000;
    this.mesh.sendTo({ r: this.name, q: ++this.seq, p: this.mine });
  }
  receive(id, m) {
    const o = this.others.get(id);
    if (o && m.q <= o.seq && m.q > o.seq - 1000) return; // chegou atrasada: a mais nova já veio
    this.others.set(id, { peer: id, sameTab: false, isMe: false, kind: 'viewer', guest: false, by: null, presence: m.p, seq: m.q });
  }
  forget(id) { this.others.delete(id); }
  peers() {
    return [{ peer: this.mesh.me, sameTab: true, isMe: true, kind: 'viewer', guest: false, by: null, presence: this.mine }, ...this.others.values()];
  }
  onPeers() { return () => {}; }
  leave() { this.owner.leaveSub(this); return Promise.resolve(); }
}

// ---------- A "sala" principal (saguão com a lista de salas abertas) ----------
export class P2PRoom {
  constructor() {
    this.me = rid();
    this.meshes = new Map();
    this.lobby = makeSignal('lobby');
    this.ads = new Map();   // id -> { presence, at }
    this.mine = {};
    this.listeners = new Set();
    this.adTimer = null;
    window.__p2p = this; // para os testes
    // Fechou a aba: avisa os outros na hora.
    addEventListener('pagehide', () => { for (const m of this.meshes.values()) m.sendTo({ bye: 1 }); });
    this.ready = this.lobby.listen((m, t) => this.onAd(m, t), LOBBY_TTL);
  }

  onAd(m, t) {
    if (!m || m.from === this.me || m.t !== 'ad') return;
    const at = Math.min(t || Date.now() / 1000, Date.now() / 1000);
    if (!m.p || !m.p.coop) this.ads.delete(m.from);
    else { const old = this.ads.get(m.from); if (!old || old.at <= at) this.ads.set(m.from, { presence: m.p, at }); }
    this.emitPeers();
  }

  emitPeers() { const list = this.peers(); for (const fn of this.listeners) { try { fn(list); } catch (e) { /* tanto faz */ } } }

  peers() {
    const now = Date.now() / 1000, out = [{ peer: this.me, sameTab: true, isMe: true, kind: 'viewer', guest: false, by: null, presence: this.mine }];
    for (const [id, a] of this.ads) {
      if (now - a.at > LOBBY_TTL) { this.ads.delete(id); continue; }
      out.push({ peer: id, sameTab: false, isMe: false, kind: 'viewer', guest: false, by: null, presence: a.presence });
    }
    return out;
  }

  onPeers(fn) {
    this.listeners.add(fn);
    const iv = setInterval(() => fn(this.peers()), 5000); // tira da lista as salas velhas
    return () => { this.listeners.delete(fn); clearInterval(iv); };
  }

  async presence(patch) {
    for (const k in patch) { if (patch[k] === null) delete this.mine[k]; else this.mine[k] = patch[k]; }
    await this.lobby.send({ t: 'ad', from: this.me, p: this.mine });
    clearInterval(this.adTimer);
    if (this.mine.coop) this.adTimer = setInterval(() => this.lobby.send({ t: 'ad', from: this.me, p: this.mine }), LOBBY_EVERY * 1000);
  }

  async join(name) {
    const base = name.replace(/-fx$/, '');
    let mesh = this.meshes.get(base);
    if (!mesh) { mesh = new Mesh(base, this.me); this.meshes.set(base, mesh); }
    const sub = new SubRoom(mesh, name, this);
    mesh.subs.set(name, sub);
    try { await mesh.start(); } catch (e) { this.leaveSub(sub); throw e; }
    return sub;
  }

  leaveSub(sub) {
    const mesh = sub.mesh;
    mesh.subs.delete(sub.name);
    if (!mesh.subs.size) { mesh.close(); this.meshes.delete(mesh.base); }
  }
}

// Fora do Claude (o navegador deixa conectar): devolve a sala direta.
export function p2pAvailable() {
  return typeof RTCPeerConnection === 'function' && typeof EventSource === 'function';
}
