// Estatísticas da descida (pedido do dono, 31/10): dano causado, inimigos derrotados por tipo, ouro juntado.
// Cada herói guarda as suas em p.rs (zerado no começo da descida). O quadro aparece na tela de derrota.
import { BLESSING_BY_ID, RARITY } from './blessings.js';
import { weaponById } from './heroes.js';

let fallback = null; // herói que leva o crédito quando não se sabe quem acertou (Jogador 1)
export function setStatsFallback(p) { fallback = p; }

export function resetStats(p) { p.rs = { dmg: 0, gold: 0, kills: {}, killsN: 0 }; }

const owner = (e) => {
  const b = e.lastHitBy;
  if (b && b.rs) return b;
  if (b && b.undead && b.undead.rs) return b.undead; // morto-vivo da Maga: crédito dela
  return fallback && fallback.rs ? fallback : null;
};

// Inimigo perdeu vida (só conta a vida que ele tinha: sem "dano a mais" no golpe final).
export function statDamage(e, amount, hpBefore) {
  if (!e || e.undead || !(amount > 0)) return;
  const real = Math.min(amount, Math.max(0, hpBefore));
  const p = owner(e);
  if (p && real > 0) p.rs.dmg += real;
}

export function statKill(e, by) {
  const p = by && by.rs ? by : by && by.undead && by.undead.rs ? by.undead : owner(e);
  if (!p) return;
  const name = (e.data && e.data.name) || 'Inimigo';
  p.rs.kills[name] = (p.rs.kills[name] || 0) + 1;
  p.rs.killsN++;
}

export function statGold(p, n) { if (p && p.rs && n > 0) p.rs.gold += n; }

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Quadro de um herói (HTML).
export function statsPanel(p, title = '') {
  const rs = p.rs || { dmg: 0, gold: 0, kills: {}, killsN: 0 };
  let wName = '—';
  try { const w = weaponById(p.heroId, p.weaponId); if (w) wName = w.name || w.short || wName; } catch (e) { /* sem arma */ }
  const kills = Object.entries(rs.kills).sort((a, b) => b[1] - a[1])
    .map(([n, k]) => `<li><span>${esc(n)}</span><b>${k}</b></li>`).join('') || '<li class="none">Nenhum</li>';
  const bl = Object.entries(p.blessings || {}).map(([id, lv]) => [BLESSING_BY_ID[id], lv]).filter(([b]) => b)
    .map(([b, lv]) => `<span class="bl" style="--rc:${(RARITY[b.rarity] || {}).color || '#ccc'}">${b.icon} ${esc(b.name)}${lv > 1 ? ` <i>×${lv}</i>` : ''}</span>`).join('')
    || '<span class="none">Nenhuma</span>';
  return `<div class="rsp">${title ? `<h3>${esc(title)}</h3>` : ''}
    <div class="rsrow"><span>Herói</span><b>${esc((p.hero && p.hero.name) || '—')}</b></div>
    <div class="rsrow"><span>Arma usada</span><b>${esc(wName)}</b></div>
    <div class="rsrow"><span>Dano total causado</span><b>${Math.round(rs.dmg).toLocaleString('pt-BR')}</b></div>
    <div class="rsrow"><span>Ouro total juntado</span><b class="g">${Math.round(rs.gold)}</b></div>
    <div class="rssec">Inimigos derrotados (${rs.killsN})</div><ul class="rsk">${kills}</ul>
    <div class="rssec">Bênçãos escolhidas</div><div class="rsb">${bl}</div></div>`;
}
