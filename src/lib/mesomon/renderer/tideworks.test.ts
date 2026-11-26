import { describe, expect, it } from 'vitest';
import { MAPS } from '../data/maps';
import { canWalk, createNewSave, createSession, DELTAS, nearbyInteractions, reduceGame } from '../engine';
import { migrateSave } from '../save';
import type { Direction, MapId } from '../types';
import { paintTideworks, type TideworksState } from './tideworks';

const idle = { gateOpen: false, sluiceOpen: false, sealed: false };
function surface(mapId: MapId, flags: TideworksState = idle) {
  const pixels = new Map<number, string>();
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      for (let row = y; row < y + h; row++) {
        for (let col = x; col < x + w; col++) pixels.set(row * 1024 + col, this.fillStyle);
      }
    },
  };
  paintTideworks(ctx as unknown as CanvasRenderingContext2D, MAPS[mapId], flags);
  return pixels;
}
describe('Tideworks architectural states', () => {
  it('drains all four blocked rows of the maintenance crossing and preserves both banks', () => {
    const flooded = surface('passage'), drained = surface('passage', { ...idle, sluiceOpen: true });
    const changesPerRow = [0, 0, 0, 0];
    for (const [key, color] of drained) {
      if (flooded.get(key) === color) continue;
      const x = key % 1024, y = Math.floor(key / 1024);
      if (x < 160 || x >= 192 || y < 176 || y >= 240) throw new Error('The changing crossing overpainted a bank');
      changesPerRow[Math.floor((y - 176) / 16)]++;
    }
    expect(changesPerRow.every(count => count > 200)).toBe(true);
  });
  it('moves the wheel rack, and settles the chamber basin after the seal', () => {
    const rack = 140 * 1024 + 150, basin = 94 * 1024 + 170;
    expect(surface('tide-stairs').get(rack)).not.toEqual(surface('tide-stairs', { ...idle, gateOpen: true }).get(rack));
    expect(surface('chamber').get(basin)).not.toEqual(surface('chamber', { ...idle, sealed: true }).get(basin));
    expect(surface('harbor').size).toBe(0);
  });
});

describe('chamber basin footing', () => {
  const waterCells = [[9, 4], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [8, 6], [10, 6]];
  it('puts the curved water and maintenance deck on the correct tile centers', () => {
    const open = surface('chamber');
    const sealed = surface('chamber', { ...idle, sealed: true });
    for (let y = 4; y <= 6; y++) for (let x = 7; x <= 11; x++) {
      const center = (y * 16 + 8) * 1024 + x * 16 + 8;
      expect(open.get(center) !== sealed.get(center), `footing at ${x},${y}`).toBe(MAPS.chamber.tiles[y][x] === 'dark-water');
    }
  });
  it('gives every legacy basin position a one-step exit on restoring its save', () => {
    for (const [x, y] of waterCells) {
      const save = createNewSave();
      Object.assign(save.player, { mapId: 'chamber', x, y });
      const restored = migrateSave(JSON.parse(JSON.stringify(save)));
      expect(restored?.player).toEqual(save.player);
      if (!restored) throw new Error('Missing restored chamber save');
      expect(canWalk(restored, x, y)).toBe(false);
      const move = (Object.keys(DELTAS) as Direction[]).find(dir =>
        canWalk(restored, x + DELTAS[dir].x, y + DELTAS[dir].y));
      if (!move) throw new Error(`No exit at ${x},${y}`);
      const next = reduceGame(createSession(restored), { type: 'move', direction: move });
      expect(next.save.player).toMatchObject({ mapId: 'chamber', x: x + DELTAS[move].x, y: y + DELTAS[move].y });
    }
  });
  it('reaches the rift from the dry deck and the recovered page from the east passage', () => {
    const save = createNewSave();
    Object.assign(save.player, { mapId: 'chamber', ...MAPS.chamber.spawn });
    let session = createSession(save);
    const walk = (...directions: Direction[]) => {
      for (const direction of directions) {
        const { x, y } = session.save.player;
        expect(canWalk(session.save, x + DELTAS[direction].x, y + DELTAS[direction].y)).toBe(true);
        session = reduceGame(session, { type: 'move', direction });
      }
    };
    walk('right', 'up', 'up', 'up', 'up', 'up', 'up');
    expect(session.save.player).toMatchObject({ x: 9, y: 6 });
    expect(nearbyInteractions(session.save).map(obj => obj.id)).toContain('rift');
    session.save.rifts['port-marche'] = 'sealed';
    walk('down', 'right', 'right', 'right', 'up', 'up');
    expect(nearbyInteractions(session.save).map(obj => obj.id)).toContain('page');
    walk('down', 'down', 'left', 'left', 'left', 'down', 'down', 'down', 'down', 'down', 'left', 'down');
    expect(nearbyInteractions(session.save).map(obj => obj.id)).toContain('chamber-exit');
  });
});
