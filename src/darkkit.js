// Bênçãos novas do Cajado das Trevas (lista do dono, 06/11/2026) — as 6 "fáceis".
// Tambores de Guerra (golpe forte = todos os mortos-vivos atacam), Praga (marca passa adiante),
// Dízimo (fim da sala: mortos-vivos viram vida), Banquete (morto-vivo mata = cura),
// Pacto de Sangue Sombrio (segurar o ataque: 8 de vida = 1 esqueleto), Rei dos Mortos (ficam até a sala seguinte).
import * as THREE from 'three';
import { audio } from './audio.js';

export const DARK = {
  drums: { leap: 4 },                      // Tambores: quem está longe pula até 4 de distância para bater junto
  plague: { range: 9 },                    // Praga: alcance da marca que passa adiante
  tithe: 4,                                // Dízimo: vida por morto-vivo
  feast: 2,                                // Banquete: vida por inimigo derrubado por morto-vivo
  blood: { cost: 8, hp: 10, hold: 0.4, cd: 1.5, type: 'minion' }, // Pacto de Sangue Sombrio
};
const COLOR = 0x9a4dff;
const W = (p) => (p && p.stats && p.stats.w) || {};
let C = null;
export const setDarkCombat = (c) => { C = c; };
export const isDark = (p) => !!(p && p.heroId === 'mage' && p.hero && p.hero.weaponId === 'trevas');
const mine = (combat, p) => combat.enemies.filter((u) => u.undead === p && u.alive);

// Tambores de Guerra: no golpe forte, todos os mortos-vivos da Maga atacam juntos.
export function darkHeavy(combat, p, step) {
  if (!step.heavy || !isDark(p) || !W(p).dDrums) return;
  let n = 0;
  for (const u of mine(combat, p)) {
    if (u.state === 'spawn') continue;
    const t = u.target;
    if (t && !t.undead && t.alive && t.position) {
      const dx = t.position.x - u.position.x, dz = t.position.z - u.position.z, d = Math.hypot(dx, dz) || 1;
      const reach = (u.data.attack && u.data.attack.reach) || 1.6;
      if (!u.data.ranged && d > reach) { // pula para perto (até 4)
        const m = Math.min(DARK.drums.leap, d - reach * 0.8);
        combat.vfx.smoke(u.position, COLOR, 4);
        u.position.x += (dx / d) * m; u.position.z += (dz / d) * m;
      }
      u.facing = Math.atan2(dx, dz);
      if (u.group) u.group.rotation.y = u.facing;
    }
    if (u.data.ranged) u.cooldown = 0; else u.startAttack();
    combat.vfx.ring(new THREE.Vector3(u.position.x, 0, u.position.z), COLOR, 1.1);
    n++;
  }
  if (n) { combat.text.add('Ataquem!', p.position, 'bleed', 3.2); audio.play('summon', p.position.x, p.position.z); }
  if (combat.log) combat.log({ type: 'darkDrums', n });
}

// Praga: marcado morreu, a marca pula para o inimigo mais perto (que ainda não está marcado).
export function darkPlague(combat, e, markDark) {
  const p = e.darkMark;
  if (!p || !W(p).dPlague) return;
  let best = null, bd = DARK.plague.range;
  for (const o of combat.enemies) {
    if (o === e || o.undead || !o.alive || o.darkMark || o.data.boss || o.data.phantom || !o.targetable) continue;
    const d = Math.hypot(o.position.x - e.position.x, o.position.z - e.position.z);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best) return;
  combat.vfx.sparks(new THREE.Vector3(best.position.x, 1.4, best.position.z), COLOR, 10);
  markDark(combat, p, best);
  if (combat.log) combat.log({ type: 'darkPlague', enemy: best });
}

// Banquete: inimigo derrubado por um morto-vivo cura a Maga.
export function darkFeast(combat, u, o) {
  const p = u.undead;
  if (o.alive || !p || !p.hero || !W(p).dFeast || p.state === 'dead') return;
  const h = p.heal(DARK.feast);
  if (h) combat.text.add(`+${h}`, p.position, 'heal small');
}

// Pacto de Sangue Sombrio: segurando o ataque, 8 de vida levantam um esqueleto na frente da Maga (a cada 1,5 s).
export function darkHoldCheck(p, input) {
  const combat = C;
  if (!isDark(p) || !W(p).dBlood || !combat) return false;
  if ((p.dBloodCd || 0) > 0 || p.stateTime < DARK.blood.hold || !(input.attackHeld && input.attackHeld())) return false;
  if (p.hp <= DARK.blood.cost) { if (!p.dBloodWarn) { p.dBloodWarn = true; combat.text.add('Pouca vida!', p.position, 'hurt small'); } return false; }
  p.dBloodWarn = false;
  p.dBloodCd = DARK.blood.cd;
  p.hp -= DARK.blood.cost;
  combat.text.add(`-${DARK.blood.cost}`, p.position, 'hurt small');
  const x = p.position.x + Math.sin(p.facing) * 1.6, z = p.position.z + Math.cos(p.facing) * 1.6;
  combat.vfx.smoke(new THREE.Vector3(x, 0, z), 0xff3a6a, 8);
  (combat.raising || (combat.raising = [])).push({ type: DARK.blood.type, x, z, t: 0.35, owner: p, hpScale: 1, dmgScale: 1, facing: p.facing, hp: DARK.blood.hp });
  if (combat.log) combat.log({ type: 'darkBlood' });
  return false; // o golpe continua normal
}

// A cada quadro: recarga do Pacto.
export function darkTick(combat, dt) {
  for (const p of combat.alivePlayers) if (p.dBloodCd > 0) p.dBloodCd -= dt;
}

// Rei dos Mortos: morto-vivo da Maga não desmorona por falta de inimigo.
export const darkKeeps = (u) => !!(W(u.undead).dKing && !u.carried);

// Sala limpa: Dízimo (vira vida) e os que vieram da sala anterior (Rei dos Mortos) desmoronam.
export function darkRoomClear(combat, die) {
  for (const u of [...combat.enemies]) {
    if (!u.undead || !u.alive) continue;
    const p = u.undead;
    if (W(p).dTithe) {
      if (p.state !== 'dead') { const h = p.heal(DARK.tithe); if (h) combat.text.add(`+${h}`, p.position, 'heal small'); }
      combat.vfx.sparks(new THREE.Vector3(u.position.x, 1.2, u.position.z), 0x7dff8a, 8);
      die(u);
    } else if (u.carried) die(u);
  }
}

// Saindo da sala: Rei dos Mortos leva os mortos-vivos para a sala seguinte.
export function darkCarryOut(combat) {
  return combat.enemies.filter((u) => u.undead && u.alive && darkKeeps(u))
    .map((u) => ({ type: u.type, hp: Math.max(1, u.hp), owner: u.undead, hpScale: u.hpScale, dmgScale: u.giant ? 1 : u.dmgScale, giant: !!u.giant }));
}
export function darkCarryIn(combat, list) {
  list.forEach((c, i) => {
    const p = c.owner; if (!p || !p.position) return;
    const a = p.facing + Math.PI + (i - (list.length - 1) / 2) * 0.7;
    (combat.raising || (combat.raising = [])).push({ type: c.type, x: p.position.x + Math.sin(a) * 1.8, z: p.position.z + Math.cos(a) * 1.8, t: 0.6 + i * 0.15, owner: p,
      hpScale: c.hpScale, dmgScale: c.dmgScale, facing: p.facing, hp: c.hp, carried: true, giant: c.giant });
  });
}
