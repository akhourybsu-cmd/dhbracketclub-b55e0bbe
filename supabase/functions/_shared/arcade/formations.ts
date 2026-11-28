import { nextWord } from './random.ts';
import type { Enemy, EnemyKind, RunState, WardCell } from './model.ts';

// Rows describe silhouettes across lanes; gaps give each wave a different approach.
const formations = [
  ['.f.f.f.', 'f.f.f.f', '.ff.ff.'],
  ['.h...h.', 'ff.f.ff', '.fffff.', '..f.f..'],
  ['.s.h.s.', 's.f.f.s', '.ff.ff.', 'f..f..f'],
  ['s.h.h.s', '.ff.ff.', 'f..d..f', '.s.f.s.'],
  ['.h.h.h.', 's.s.s.s', '.d.f.d.', 'f..s..f'],
  ['h...h..', '.sf..sf', '..dff..', 'ss..d.s'],
  ['..h.h..', '.f.s.f.', 'd.s.s.d', '.ff.ff.', 's..f..s'],
  ['.h...h.', 's.d.d.s', '.f.s.f.', 's..h..s', '.f...f.'],
] as const;
const species: Record<string, EnemyKind> = { f: 'flicker', s: 'sliver', h: 'herald', d: 'diver' };

export function randomIndex(s: RunState, size: number) {
  s.rng = nextWord(s.rng);
  return s.rng % size;
}

function spawn(s: RunState, kind: EnemyKind, homeX: number, homeY: number): Enemy {
  const hp = kind === 'anchor' ? Math.min(13, 4 + Math.floor(s.wave / 4)) : 1;
  const nodes = kind === 'anchor' ? Math.min(4, 1 + Math.floor(s.wave / 5)) : 0;
  return {
    id: s.nextId++, kind, homeX, homeY, x: s.originX + homeX, y: s.originY + homeY,
    hp, maxHp: hp, nodes: [nodes, nodes], tellUntil: -1, diveStart: -1, diveX: 0, diveY: 0,
    diveTargetX: 0, dazedUntil: -1
  };
}

export function createWards(): WardCell[] {
  const cells: WardCell[] = [];
  for (const center of [33, 80, 127]) {
    for (let row = 0; row < 3; row++) {
      for (let col = -2; col <= 2; col++) {
        if ((row === 0 && Math.abs(col) === 2) || (row === 2 && col === 0)) continue;
        cells.push({ x: center + col * 3, y: 105 + row * 3, hp: 2 });
      }
    }
  }
  return cells;
}

export function beginWave(s: RunState) {
  s.wave++;
  s.phase = 'play';
  s.waveTick = 0;
  s.waveHit = false;
  s.originX = 80;
  s.originY = 21;
  s.direction = randomIndex(s, 2) ? 1 : -1;
  s.stepInterval = Math.max(7, 32 - s.wave * 2);
  s.drop = Math.min(6, 3 + Math.floor(s.wave / 6));
  s.shotInterval = s.wave <= 2 ? 335 - s.wave * 28 : Math.max(38, 142 - s.wave * 8);
  s.nextShot = 110;
  s.nextStep = 30;
  s.nextDive = 230;
  s.waveLimit = 60 * Math.max(53, 126 - Math.min(26, s.wave) * 3);
  s.projectiles.length = 0;
  s.warnings.length = 0;
  s.enemies.length = 0;
  if (s.wave % 5 === 0) {
    s.originY = 33;
    s.enemies.push(spawn(s, 'anchor', 0, 0));
    for (const side of [-1, 1]) {
      s.enemies.push(spawn(s, 'sliver', side * 29, 10));
      s.enemies.push(spawn(s, 'flicker', side * 44, -5));
      if (s.wave >= 10) s.enemies.push(spawn(s, 'diver', side * 16, 20));
    }
  } else {
    const module = s.wave <= 4 ? s.wave - 1 : 4 + (s.wave <= 9 ? (s.wave - 6) : randomIndex(s, 4));
    const rows = formations[module];
    const mirrored = randomIndex(s, 2) === 0;
    const spacing = 13 + randomIndex(s, 3);
    for (let row = 0; row < rows.length; row++) {
      for (let col = 0; col < rows[row].length; col++) {
        const kind = species[rows[row][col]];
        if (kind) s.enemies.push(spawn(s, kind, (col - 3) * spacing * (mirrored ? -1 : 1), row * 10));
      }
    }
  }
  s.population = s.enemies.length;
  s.events.push({ kind: 'wave-start', x: s.playerX, y: 21, value: s.wave });
}
