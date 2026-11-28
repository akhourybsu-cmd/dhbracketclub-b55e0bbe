import { BASE_POINTS, CHAIN_TICKS, INPUT, MAX_TICKS, PULSE_RADIUS } from './rules.ts';
import { beginWave, createWards, randomIndex } from './formations.ts';
import { seedWord } from './random.ts';
import type { Enemy, EventKind, Projectile, RunState, RunSummary, ShotKind, Telegraph } from './model.ts';

export { INPUT, MAX_TICKS, TICK_RATE, PULSE_RADIUS } from './rules.ts';
export type { Enemy, EnemyKind, Projectile, RunEvent, RunState, RunSummary, WardCell } from './model.ts';

const LINE = 126;
const MAX_SHOTS = 18;
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }

export function createRun(seed: string): RunState {
  const s: RunState = {
    tick: 0, waveTick: 0, wave: 0, score: 0, kills: 0, phase: 'play', reason: null,
    playerX: 80, playerY: 132, integrity: 3, invulnerableUntil: 0, pulse: 0,
    pulseAt: -1000, lastFire: -1000, input: 0, chain: 0, lastKill: -1000, waveHit: false,
    waveBonus: { clear: 0, perfect: 0, wards: 0 }, rng: seedWord(seed), nextId: 1, enemies: [],
    projectiles: [], wards: createWards(), warnings: [], events: [], originX: 0, originY: 0,
    direction: 1, nextStep: 0, nextShot: 0, nextDive: 0, population: 0, stepInterval: 0, drop: 0,
    shotInterval: 0, waveLimit: 0, tallyStart: -1,
  };
  beginWave(s);
  return s;
}
export function summarize(s: RunState): RunSummary {
  return { score: s.score, wave: s.wave, kills: s.kills, simulationTicks: s.tick };
}
function emit(s: RunState, kind: EventKind, x: number, y: number, value = 0) {
  s.events.push({ kind, x, y, value });
}
function end(s: RunState, reason: 'line' | 'integrity') {
  s.phase = 'over'; s.reason = reason;
  emit(s, 'over', s.playerX, s.playerY);
}
function damage(s: RunState) {
  if (s.tick < s.invulnerableUntil || s.integrity === 0) return;
  s.integrity--;
  s.invulnerableUntil = s.tick + 120;
  s.waveHit = true;
  s.chain = 0;
  emit(s, 'hit', s.playerX, s.playerY, s.integrity);
  if (!s.integrity) end(s, 'integrity');
}

/** Round half up once, on the multiplied base. Anchor's wave bounty is separate. */
export function killPoints(kind: Enemy['kind'], chain: number, wave: number) {
  const quarters = 4 + clamp(chain - 1, 0, 4);
  return Math.floor((BASE_POINTS[kind] * quarters + 2) / 4) + (kind === 'anchor' ? 50 * wave : 0);
}
function kill(s: RunState, index: number) {
  const enemy = s.enemies[index];
  s.enemies.splice(index, 1);
  s.kills++;
  s.chain = Math.min(5, s.chain + 1);
  s.lastKill = s.tick;
  const points = killPoints(enemy.kind, s.chain, s.wave);
  s.score += points;
  s.pulse = Math.min(100, s.pulse + 6);
  emit(s, 'kill', enemy.x, enemy.y, points);
}
function clearWave(s: RunState) {
  const wards = s.wards.reduce((sum, cell) => sum + (cell.hp > 0 ? 5 : 0), 0);
  const clear = 200 * s.wave;
  const perfect = s.waveHit ? 0 : 150 * s.wave;
  s.waveBonus = { clear, perfect, wards };
  s.score += clear + perfect + wards;
  if (s.wave % 5 === 0) {
    // Bring back a few cells on each structure, starting with the most damaged.
    for (const center of [33, 80, 127]) {
      const damaged = s.wards.filter(cell => Math.abs(cell.x - center) <= 6 && cell.hp < 2);
      damaged.sort((a, b) => a.hp - b.hp || a.y - b.y || a.x - b.x);
      for (const cell of damaged.slice(0, 4)) cell.hp++;
    }
  }
  s.chain = 0;
  s.phase = 'tally'; s.tallyStart = s.tick;
  s.projectiles.length = 0; s.warnings.length = 0;
  emit(s, 'wave-clear', s.playerX, 72, clear + perfect + wards);
}
function pulse(s: RunState) {
  s.pulse = 0; s.pulseAt = s.tick;
  for (let i = s.projectiles.length - 1; i >= 0; i--) {
    const p = s.projectiles[i];
    const dx = p.x - s.playerX, dy = p.y - s.playerY;
    if (p.kind !== 'player' && dx * dx + dy * dy <= PULSE_RADIUS * PULSE_RADIUS) s.projectiles.splice(i, 1);
  }
  for (const e of s.enemies) {
    if (e.diveStart >= 0 || e.kind === 'diver' && e.tellUntil > s.tick) e.dazedUntil = s.tick + 48;
  }
  emit(s, 'pulse', s.playerX, s.playerY);
}
function shot(s: RunState, kind: ShotKind, x: number, y: number, vx: number, vy: number) {
  s.projectiles.push({ id: s.nextId++, kind, x, y, vx, vy });
  emit(s, kind === 'player' ? 'fire' : 'enemy-fire', x, y, kind === 'heavy' ? 1 : kind === 'anchor' ? 2 : 0);
}
function runInput(s: RunState, mask: number) {
  const direction = Number(!!(mask & INPUT.right)) - Number(!!(mask & INPUT.left));
  s.playerX = clamp(s.playerX + direction * 1.25, 5, 154);
  if ((mask & INPUT.pulse) && !(s.input & INPUT.pulse) && s.pulse === 100) pulse(s);
  if ((mask & INPUT.fire) && s.tick - s.lastFire >= 12 && !s.projectiles.some(p => p.kind === 'player')) {
    s.lastFire = s.tick;
    shot(s, 'player', s.playerX, s.playerY - 5, 0, -2.25);
  }
}

/** Movement uses multiples of 1/16 pixel, integer phases and sampled parabolas. */
function dive(s: RunState, e: Enemy) {
  if (s.tick < e.dazedUntil) { e.diveStart++; return; }
  const age = s.tick - e.diveStart;
  const length = 204;
  const homeX = s.originX + e.homeX, homeY = s.originY + e.homeY;
  if (age >= length) { e.diveStart = -1; e.x = homeX; e.y = homeY; return; }
  const part = age <= length / 2 ? age : length - age;
  const startX = age <= length / 2 ? e.diveX : homeX;
  const startY = age <= length / 2 ? e.diveY : homeY;
  e.x = startX + Math.trunc((e.diveTargetX - startX) * part / (length / 2));
  e.y = startY + Math.trunc((s.playerY - startY) * part * (length - part) / ((length / 2) ** 2));
  if (Math.abs(e.x - s.playerX) <= 6 && Math.abs(e.y - s.playerY) <= 4) damage(s);
}
function moveFormation(s: RunState) {
  const closing = s.waveTick >= s.waveLimit || s.tick >= MAX_TICKS - 120;
  if (closing) {
    // During the final two seconds even a newly arriving formation follows the
    // same, visible closing front. Its foremost unit reaches LINE by the last tick.
    s.originY = Math.max(s.originY + 1.5, LINE + 5 - (MAX_TICKS - s.tick - 1) * 1.5);
  }
  if (s.waveTick >= s.nextStep && !closing) {
    let min = 160, max = 0;
    for (const e of s.enemies) {
      const base = s.originX + e.homeX, half = e.kind === 'anchor' ? 14 : 7;
      min = Math.min(min, base - half);
      max = Math.max(max, base + half);
    }
    if ((s.direction < 0 && min <= 4) || (s.direction > 0 && max >= 155)) {
      s.direction *= -1;
      s.originY += s.drop;
    }
    s.originX += s.direction * 2;
    s.nextStep = s.waveTick + Math.max(4, Math.floor(s.stepInterval * (0.35 + 0.65 * s.enemies.length / s.population)));
  }
  for (const e of s.enemies) {
    // Final descent recalls divers to their lanes. A dive by itself is never a breach.
    if (e.diveStart >= 0 && !closing) {
      dive(s, e);
      if (s.phase === 'over') return;
      continue;
    }
    e.x = s.originX + e.homeX;
    e.y = s.originY + e.homeY;
    if (e.kind === 'sliver' && (Math.floor(s.waveTick / 36) + e.id) % 4 === 0) e.x += 3 * s.direction;
    if (e.y >= LINE) { end(s, 'line'); return; }
    if (e.kind === 'diver' && e.tellUntil >= 0 && s.tick >= e.tellUntil && !closing && s.tick >= e.dazedUntil) {
      e.tellUntil = -1;
      e.diveStart = s.tick;
      e.diveX = e.x; e.diveY = e.y;
    }
  }
  if (!closing && s.waveTick >= s.nextDive) {
    const divers = s.enemies.filter(e => e.kind === 'diver' && e.diveStart < 0 && e.tellUntil < 0);
    if (divers.length) {
      const e = divers[randomIndex(s, divers.length)];
      e.tellUntil = s.tick + 50;
      e.diveTargetX = s.playerX; // Show this lane throughout windup; no retarget in flight.
    }
    s.nextDive = s.waveTick + Math.max(155, 310 - s.wave * 6);
  }
}
function addWarning(s: RunState, source: Enemy, x: number, kind: Telegraph['kind'], vx = 0) {
  const y = source.y + 5;
  if (y >= 118 || x < 3 || x > 156 || s.warnings.length >= 6) return;
  s.warnings.push({ source: source.id, x, y, kind, vx, fireTick: s.tick + (kind === 'shard' ? 28 : 45) });
}
function scheduleFire(s: RunState) {
  if (s.waveTick >= s.nextShot && s.enemies.length) {
    const anchor = s.enemies.find(e => e.kind === 'anchor');
    const eligible = s.enemies.filter(e => e.diveStart < 0 && e.tellUntil < 0 && e.y < 111);
    if (eligible.length) {
      const e = anchor && randomIndex(s, 3) !== 0 ? anchor : eligible[randomIndex(s, eligible.length)];
      if (e.kind === 'anchor') {
        const coreOpen = !e.nodes[0] && !e.nodes[1];
        if (coreOpen) {
          for (const offset of [-16, 0, 16]) addWarning(s, e, e.x + offset, 'anchor', offset / 64);
        } else {
          for (const side of [-1, 1]) if (e.nodes[side === -1 ? 0 : 1]) addWarning(s, e, e.x + side * 9, 'anchor', side / 8);
        }
      } else if (e.kind === 'sliver') {
        addWarning(s, e, e.x - 4, 'shard', -.125);
        addWarning(s, e, e.x + 4, 'shard', .125);
      } else if (e.kind === 'herald') {
        addWarning(s, e, e.x, 'heavy');
        // A Herald signals the frontmost occupied neighboring lane.
        const ally = eligible.find(a => a !== e && Math.abs(a.homeX - e.homeX) <= 16 && a.homeY > e.homeY);
        if (ally) addWarning(s, ally, ally.x, 'heavy');
      } else addWarning(s, e, e.x, 'shard');
    }
    const pressure = s.enemies.length / s.population;
    s.nextShot = s.waveTick + Math.floor(s.shotInterval * (.7 + .3 * pressure)) + randomIndex(s, 17);
  }
  for (let i = s.warnings.length - 1; i >= 0; i--) {
    const w = s.warnings[i];
    if (s.tick < w.fireTick) continue;
    s.warnings.splice(i, 1);
    if (s.projectiles.length >= MAX_SHOTS - 1 || !s.enemies.some(e => e.id === w.source)) continue;
    const speed = w.kind === 'heavy' ? .625 : w.kind === 'anchor' ? .875 : .75;
    shot(s, w.kind, w.x, w.y, w.vx, speed + Math.min(6, s.wave - 1) / 16);
  }
}
function impactEnemy(s: RunState, p: Projectile) {
  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i], dx = p.x - e.x, dy = p.y - e.y;
    const width = e.kind === 'anchor' ? 13 : e.kind === 'herald' ? 5 : e.kind === 'diver' ? 4 : 3;
    if (Math.abs(dx) > width || Math.abs(dy) > (e.kind === 'anchor' ? 6 : 3)) continue;
    if (e.kind === 'anchor' && (e.nodes[0] || e.nodes[1])) {
      const side = dx < 0 ? 0 : 1;
      if (Math.abs(Math.abs(dx) - 9) <= 3 && e.nodes[side] > 0) {
        e.nodes[side]--;
        emit(s, 'node', e.x + (dx < 0 ? -9 : 9), e.y + 1, e.nodes[side]);
      }
      return true;
    }
    if (--e.hp === 0) kill(s, i);
    return true;
  }
  return false;
}
function projectiles(s: RunState) {
  for (let i = s.projectiles.length - 1; i >= 0; i--) {
    const p = s.projectiles[i];
    p.x += p.vx; p.y += p.vy;
    let remove = p.x < 0 || p.x >= 160 || p.y < 13 || p.y >= 144;
    if (!remove && p.y >= 103 && p.y <= 113) {
      const hit = s.wards.find(c => c.hp > 0 && Math.abs(c.x - p.x) <= 1.5 && Math.abs(c.y - p.y) <= 1.5);
      if (hit) { hit.hp--; emit(s, 'ward', hit.x, hit.y, hit.hp); remove = true; }
    }
    if (!remove && p.kind === 'player') remove = impactEnemy(s, p);
    if (!remove && p.kind !== 'player' && Math.abs(s.playerX - p.x) <= 3 && Math.abs(s.playerY - p.y) <= 2) {
      damage(s); remove = true;
    }
    if (remove) s.projectiles.splice(i, 1);
    if (s.phase === 'over') break;
  }
}

/** Advance exactly one deterministic tick. No rendering, clocks or external randomness. */
export function stepRun(s: RunState, mask: number) {
  if (s.phase === 'over') return;
  s.events.length = 0;
  if (s.phase === 'tally' && s.tick >= MAX_TICKS - 120) beginWave(s);
  if (s.phase === 'tally') {
    if (s.tick - s.tallyStart >= ((mask & INPUT.fire) ? 12 : 48)) beginWave(s);
  } else {
    s.waveTick++;
    if (s.tick - s.lastKill > CHAIN_TICKS) s.chain = 0;
    if (s.waveTick % 36 === 0) s.pulse = Math.min(100, s.pulse + 1);
    runInput(s, mask);
    moveFormation(s);
    if (s.phase === 'play') {
      scheduleFire(s);
      projectiles(s);
      if (s.integrity > 0 && s.enemies.length === 0) clearWave(s);
    }
  }
  s.input = mask;
  s.tick++;
}
