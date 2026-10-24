// Salvamento do progresso permanente (Ouro de Alma, armas compradas e equipadas, recordes).
// Guarda em dois lugares: no navegador (localStorage) e, quando o link do Claude permite, na conta do jogador
// (capacidade `db`, pasta privada de cada um). Ao abrir, vale a cópia mais nova (número `rev` maior).
const KEY = 'cripta.save';

export function emptySave() {
  return { v: 1, rev: 0, soul: 0, ups: {}, runs: 0, best: 0, wins: 0, soulTotal: 0 };
}

// Melhorias antigas da Taverna (removidas): o Ouro de Alma gasto nelas volta para o jogador.
const OLD_UPGRADE_PRICES = {
  vida: [40, 70, 110, 160, 220], afiar: [60, 100, 150, 210, 280], escudo: [50, 90, 150], pocao: [90, 200],
  bolsa: [40, 80, 130], bencao: [180], fenix: [350],
};

// ups = o que foi desbloqueado: "w_<herói>_<arma>" = 1 (arma comprada), "eq_<herói>" = arma equipada.
export const UPS_KEY = /^[a-z0-9_]{2,24}$/;
export function cleanUps(raw) {
  const num = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const ups = {};
  let refund = 0;
  if (raw && typeof raw === 'object') {
    for (const [k, n] of Object.entries(raw)) {
      if (OLD_UPGRADE_PRICES[k]) { refund += OLD_UPGRADE_PRICES[k].slice(0, num(n)).reduce((a, b) => a + b, 0); continue; }
      if (UPS_KEY.test(k)) ups[k] = Math.min(9, num(n));
    }
  }
  return { ups, refund };
}

function clean(s) {
  const e = emptySave();
  if (!s || typeof s !== 'object') return e;
  const num = (v, d = 0) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : d);
  const { ups, refund } = cleanUps(s.ups);
  return { v: 1, rev: num(s.rev) + (refund ? 1 : 0), soul: num(s.soul) + refund, ups, runs: num(s.runs), best: num(s.best), wins: num(s.wins), soulTotal: num(s.soulTotal) };
}

function readLocal() {
  try { const t = localStorage.getItem(KEY); return t ? clean(JSON.parse(t)) : null; } catch (e) { return null; }
}
function writeLocal(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* navegador sem armazenamento: só nesta visita */ }
}

class SaveStore {
  constructor() {
    this.data = readLocal() || emptySave();
    this.doc = null;          // documento na conta (db), se disponível
    this.where = 'navegador';
    this.listeners = [];
  }

  // Liga a conta do Claude (quando der). Não atrasa o jogo: o navegador já vale desde o começo.
  async connect() {
    try {
      if (!window.claude || !window.claude.use) return;
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const id = await user.id();
      if (!id) return;
      const doc = db.doc(`data/users/${id}/save`);
      const snap = await doc.get();
      const remote = snap && snap.exists ? clean(snap.data()) : null;
      this.doc = doc;
      this.where = 'conta';
      if (remote && remote.rev > this.data.rev) { this.data = remote; writeLocal(remote); this.emit(); }
      else if (!remote || remote.rev < this.data.rev) await this.push();
    } catch (e) { this.doc = null; this.where = 'navegador'; }
  }

  async push() {
    if (!this.doc) return;
    try { await this.doc.set({ ...this.data }); } catch (e) { if (e && (e.code === 'invalid_argument' || e.code === 'permission_denied')) { this.doc = null; this.where = 'navegador'; } }
  }

  onChange(fn) { this.listeners.push(fn); }
  emit() { for (const fn of this.listeners) fn(this.data); }

  // Muda e grava (navegador na hora, conta logo depois).
  update(fn) {
    fn(this.data);
    this.data.rev++;
    writeLocal(this.data);
    this.emit();
    if (this.doc) {
      clearTimeout(this.pushTimer);
      this.pushTimer = setTimeout(() => this.push(), 400);
    }
  }

  // Co-op (Jogador 2): o anfitrião manda os números novos; grava se mudou.
  adopt(soul, ups, runs, best) {
    const d = this.data;
    const upsKey = JSON.stringify(ups || {});
    if (d.soul === soul && JSON.stringify(d.ups) === upsKey && d.runs === runs && d.best === best) return;
    this.update((s) => { s.soul = soul; s.ups = { ...ups }; s.runs = runs; s.best = best; });
  }
}

export const save = new SaveStore();
// Para testes automáticos (página nova = progresso zerado).
export function resetSave() { save.update((s) => Object.assign(s, emptySave(), { rev: s.rev })); }
