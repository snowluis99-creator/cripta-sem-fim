// Bênçãos exclusivas do co-op (pedido do dono, 30/10): só aparecem com 2 heróis e funcionam com a interação
// entre eles. Mistura de 3 estilos: ficar perto, combos entre os dois e salvar o parceiro.
// Os números ficam em stats (s.cLaco etc.); as regras rodam no anfitrião (combat.js chama as funções daqui).
import * as THREE from 'three';
import { audio } from './audio.js';

export const CB = {
  near: 6,          // "perto" = até 6 de distância
  aura: { every: 2, radius: 6 },
  shield: { mul: 0.8, radius: 6 },
  mark: { time: 3 },
  link: { every: 0.8, damage: 3, maxDist: 12, width: 0.9 },
  rescue: { time: 5, radius: 2.4, hp: 0.4 },
  angel: { heal: 25 },
};

const s0 = (s, k, v) => { s[k] = (s[k] || 0) + v; };
export const COOP_BLESSINGS = [
  // --- Ficar perto ---
  { id: 'c_laco', name: 'Laço de Irmãos', icon: '⚭', rarity: 'common', max: 3,
    desc: (n) => `Com o parceiro perto (até 6), você causa +${n * 12}% de dano.`,
    apply: (s) => s0(s, 'cLaco', 0.12) },
  { id: 'c_aura', name: 'Aura Curativa', icon: '✚', rarity: 'rare', max: 2,
    desc: (n) => `Durante a luta, com o parceiro perto, vocês dois recuperam ${n} de vida a cada 2 s.`,
    apply: (s) => s0(s, 'cAura', 1) },
  { id: 'c_escudo', name: 'Escudo Partilhado', icon: '⛨', rarity: 'epic', max: 1,
    desc: () => 'Com o parceiro perto, vocês dois tomam 20% menos dano.',
    apply: (s) => { s.cEscudo = 1; } },
  // --- Combos entre os dois ---
  { id: 'c_marca', name: 'Marca do Caçador', icon: '⌖', rarity: 'common', max: 2,
    desc: (n) => `Seus golpes marcam o inimigo por 3 s. O parceiro causa +${n * 25}% de dano em quem está marcado.`,
    apply: (s) => s0(s, 'cMarca', 0.25) },
  { id: 'c_vinganca', name: 'Vingança', icon: '⚡', rarity: 'rare', max: 1,
    desc: () => 'Quando o parceiro toma dano, o seu próximo golpe é crítico.',
    apply: (s) => { s.cVinganca = 1; } },
  { id: 'c_elo', name: 'Elo de Raios', icon: '⌁', rarity: 'epic', max: 1,
    desc: () => 'Um raio liga você ao parceiro (até 12 de distância): inimigos no meio do caminho tomam 3 de dano a cada 0,8 s.',
    apply: (s) => { s.cElo = 1; } },
  // --- Salvar o parceiro ---
  { id: 'c_mao', name: 'Mão Amiga', icon: '✋', rarity: 'rare', max: 1,
    desc: () => 'Fique 5 s ao lado do parceiro caído para levantá-lo com 40% da vida (uma vez por sala).',
    apply: (s) => { s.cMao = 1; } },
  { id: 'c_anjo', name: 'Anjo da Guarda', icon: '☼', rarity: 'legendary', max: 1,
    desc: () => 'A 1ª vez em cada sala que o parceiro cairia, ele fica com 1 de vida e você o cura em 25.',
    apply: (s) => { s.cAnjo = 1; } },
];
for (const b of COOP_BLESSINGS) b.coop = true;

const near = (a, b, r = CB.near) => !!a && !!b && a.state !== 'dead' && b.state !== 'dead'
  && Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) <= r;
const partnerOf = (combat, p) => (combat.players.length > 1 ? combat.players.find((o) => o !== p) : null);

// Multiplicador de dano do herói p no inimigo e (Laço de Irmãos, Marca do Caçador). Chamado em damageEnemy.
export function coopDamageMul(combat, p, e) {
  if (combat.players.length < 2) return 1;
  const o = partnerOf(combat, p), st = p.stats;
  let m = 1;
  if (st.cLaco && near(p, o)) m *= 1 + st.cLaco;
  if (e.coopMark && e.coopMark.by !== p && e.coopMark.until > combat.coopT) m *= 1 + (e.coopMark.by.stats.cMarca || 0);
  return m;
}

// Depois do acerto: marca o inimigo (Marca do Caçador). Vingança: devolve true se o golpe tem que sair crítico.
export function coopAfterHit(combat, p, e) {
  if (p.stats.cMarca && e.alive) {
    const had = e.coopMark && e.coopMark.until > combat.coopT && e.coopMark.by === p;
    e.coopMark = { by: p, until: combat.coopT + CB.mark.time };
    if (!had) combat.text.add('Marcado!', e.position, 'miss', 2.8);
  }
}
export function coopTakeCrit(p) {
  if (!p.coopVengeance) return false;
  p.coopVengeance = false;
  return true;
}

// Dano no herói (Escudo Partilhado). Chamado em hitPlayer antes do dano.
export function coopTakenMul(combat, p) {
  if (combat.players.length < 2) return 1;
  const o = partnerOf(combat, p);
  if ((p.stats.cEscudo || (o && o.stats.cEscudo)) && near(p, o, CB.shield.radius)) return CB.shield.mul;
  return 1;
}

// O herói p vai tomar dmg. Anjo da Guarda (do parceiro) segura a queda: devolve o dano que pode entrar.
export function coopAngel(combat, p, dmg) {
  if (combat.players.length < 2 || dmg < p.hp) return dmg;
  const o = partnerOf(combat, p);
  if (!o || o.state === 'dead' || !o.stats.cAnjo || p.angelRoom === combat.coopRoom) return dmg;
  p.angelRoom = combat.coopRoom;
  combat.coopFx = (combat.coopFx || 0) + 1;
  setTimeout0(combat, () => {
    const got = p.heal(CB.angel.heal);
    combat.text.add('Anjo da Guarda!', p.position, 'crit', 3.6);
    if (got) combat.text.add(`+${got}`, p.position, 'heal');
    combat.vfx.burst(p.position, 0xfff1a0);
    combat.vfx.bolt(new THREE.Vector3(o.position.x, 1.4, o.position.z), new THREE.Vector3(p.position.x, 1.4, p.position.z), 0xfff1a0);
    audio.play('heal', p.position.x, p.position.z);
    if (combat.log) combat.log({ type: 'coopAngel' });
  });
  return Math.max(0, p.hp - 1);
}
// Executa logo depois do dano (o herói já está com 1 de vida).
function setTimeout0(combat, fn) { (combat.coopLater ||= []).push(fn); }

// Parceiro tomou dano: quem tem Vingança fica com o próximo golpe crítico.
export function coopOnHurt(combat, p) {
  const o = partnerOf(combat, p);
  if (o && o.state !== 'dead' && o.stats.cVinganca && !o.coopVengeance) {
    o.coopVengeance = true;
    combat.text.add('Vingança!', o.position, 'crit', 3.0);
  }
}

// A cada quadro (anfitrião): Aura Curativa, Elo de Raios, Mão Amiga, tempo das marcas, reinício por sala.
export function coopUpdate(combat, run, dt) {
  combat.coopT = (combat.coopT || 0) + dt;
  if (combat.coopLater && combat.coopLater.length) { const l = combat.coopLater; combat.coopLater = []; l.forEach((f) => f()); }
  if (combat.players.length < 2) return;
  if (run && run.roomVersion !== combat.coopRoom) {
    combat.coopRoom = run.roomVersion;
    for (const p of combat.players) { p.rescueUsed = false; p.rescueT = 0; p.auraT = 0; p.eloT = 0; }
  }
  const [a, b] = combat.players;
  const fighting = combat.aliveCount > 0;
  for (const p of combat.players) {
    const o = p === a ? b : a, st = p.stats;
    // Aura Curativa: cura os dois.
    if (st.cAura && fighting && near(p, o, CB.aura.radius) && (p.auraT = (p.auraT || 0) + dt) >= CB.aura.every) {
      p.auraT = 0;
      for (const h of [p, o]) {
        const got = h.heal(st.cAura);
        if (got) { combat.text.add(`+${got}`, h.position, 'heal', 2.2); combat.vfx.sparks(new THREE.Vector3(h.position.x, 1.5, h.position.z), 0x7dff8a, 4); }
      }
    }
    // Elo de Raios: raio entre os dois; acerta quem está no meio.
    if (st.cElo && fighting && o.state !== 'dead' && p.state !== 'dead' && (p.eloT = (p.eloT || 0) + dt) >= CB.link.every) {
      p.eloT = 0;
      const ax = p.position.x, az = p.position.z, bx = o.position.x, bz = o.position.z;
      const len = Math.hypot(bx - ax, bz - az);
      if (len > 1 && len <= CB.link.maxDist) {
        combat.vfx.lightning(new THREE.Vector3(ax, 1.3, az), new THREE.Vector3(bx, 1.3, bz), 0xffe46a, 0.12);
        const ux = (bx - ax) / len, uz = (bz - az) / len, dmg = Math.max(1, Math.round(CB.link.damage * st.damageMul));
        let hits = 0;
        for (const e of [...combat.enemies]) {
          if (!e.targetable) continue;
          const dx = e.position.x - ax, dz = e.position.z - az, along = dx * ux + dz * uz, side = Math.abs(dx * uz - dz * ux);
          if (along < 0 || along > len || side > CB.link.width / 2 + e.data.radius) continue;
          combat.bonusDamage(e, dmg, -uz, ux, 'dmg', p);
          hits++;
        }
        if (combat.log) combat.log({ type: 'coopLink', hits });
      }
    }
    // Mão Amiga: ao lado do parceiro caído, levanta ele.
    if (st.cMao && !p.rescueUsed && p.state !== 'dead' && o.state === 'dead' && o.group.visible
      && Math.hypot(p.position.x - o.position.x, p.position.z - o.position.z) <= CB.rescue.radius) {
      const before = p.rescueT || 0;
      p.rescueT = before + dt;
      if (Math.floor(before * 2) !== Math.floor(p.rescueT * 2)) combat.text.add(`Levantando… ${Math.max(0, Math.ceil(CB.rescue.time - p.rescueT))}`, o.position, 'heal', 2.6);
      if (p.rescueT >= CB.rescue.time) {
        p.rescueUsed = true; p.rescueT = 0;
        o.revive();
        o.hp = Math.max(1, Math.round(o.maxHp * CB.rescue.hp));
        combat.vfx.burst(o.position, 0x8ad8ff);
        combat.text.add('De pé!', o.position, 'heal', 3.4);
        audio.play('heal', o.position.x, o.position.z);
        if (combat.log) combat.log({ type: 'coopRescue' });
      }
    } else if (p.rescueT) p.rescueT = 0;
  }
}
