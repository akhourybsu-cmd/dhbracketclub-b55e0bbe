import { describe, expect, it } from 'vitest';
import { MAPS } from '../data/maps';
import { bypassMain, intakeStrainer, scupperWall, stairCheeks } from '../data/tideObstacles';
import { canWalk, createNewSave, createSession, DELTAS, nearbyInteractions, reduceGame } from '../engine';
import { migrateSave } from '../save';
import type { Direction, MapId } from '../types';
import { paintTideworks, tideRelief, type TideworksState } from './tideworks';
import { paintEnvironmentMotion, ENVIRONMENT_MOTION_FRAME_MS } from './environmentMotion';

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
  it('lowers the sea-wall counterweight as the gate rises and leaves the sill in place', () => {
    const closed = surface('tide-stairs');
    const open = surface('tide-stairs', { ...idle, gateOpen: true });
    const yAtWeight = (pixels: Map<number, string>) =>
      Array.from({ length: 44 }, (_, i) => i + 131).find(y => pixels.get(y * 1024 + 44) === '#c0a076');
    expect(yAtWeight(closed)).toBe(143);
    expect(yAtWeight(open)).toBe(156);
    expect(open.get(125 * 1024 + 40)).toBe(closed.get(125 * 1024 + 40));
  });
  it('turns the pump spindle only on a drained, animated passage', () => {
    function hubAt(phase: number, sluiceOpen: boolean, reducedMotion = false) {
      const marks: number[][] = [];
      paintEnvironmentMotion({
        fillStyle() {}, fillRect(x, y, width, height) { marks.push([x, y, width, height]); },
      }, MAPS.passage, { left: 170, top: 140, right: 181, bottom: 151 }, phase * ENVIRONMENT_MOTION_FRAME_MS,
      { gateOpened: true, riftSealed: false, paused: false, reducedMotion, sluiceOpen });
      return marks;
    }
    expect(hubAt(0, false)).toHaveLength(0);
    expect(hubAt(3, true, true)).toHaveLength(0);
    const frames = Array.from({ length: 8 }, (_, phase) => JSON.stringify(hubAt(phase, true)));
    expect(new Set(frames).size).toBe(8);
  });
  it('paints a stair cheek under each blocked tile and leaves the middle cross-landing unrailed', () => {
    const stairs = surface('tide-stairs');
    for (const cheek of stairCheeks) {
      const cx = cheek.x * 16 + 8;
      for (let row = cheek.y; row < cheek.y + cheek.height; row++) {
        expect(stairs.get((row * 16 + 8) * 1024 + cx)).toBe('#85968a');
      }
      // In this recorder translucent sunlight and cast shadow are the topmost
      // fills over the cross-landing's two flagstones.
      const landing = ['#95a298', '#99a69a', '#ddd0a819', '#254a4d17'];
      for (const row of [6, 7]) expect(landing).toContain(stairs.get((row * 16 + 8) * 1024 + cx));
    }
    for (let col = 0; col < scupperWall.width; col++) {
      expect(stairs.get(scupperWall.y * 16 * 1024 + (scupperWall.x + col) * 16 + 8)).toBe('#a9ad97');
    }
  });
  it('puts the raised coping and basket bails above their solid supports and over a reachable aisle', () => {
    for (const piece of tideRelief) {
      const save = createNewSave();
      save.player.mapId = piece.mapId;
      const painted = new Set<string>();
      const ctx = {
        fillStyle: '',
        fillRect(x: number, y: number, width: number, height: number) {
          for (let j = y; j < y + height; j++) for (let i = x; i < x + width; i++) {
            expect(i >= 0 && i < piece.width && j >= 0 && j < piece.height).toBe(true);
            painted.add(`${i},${j}`);
          }
        },
      };
      piece.paint(ctx as unknown as CanvasRenderingContext2D);
      const aisleY = Math.floor(piece.y / 16);
      expect(Array.from(painted).some(key => {
        const [x, y] = key.split(',').map(Number);
        return Math.floor((piece.y + y) / 16) === aisleY && canWalk(save, Math.floor((piece.x + x) / 16), aisleY);
      })).toBe(true);
      expect(canWalk(save, Math.floor(piece.x / 16), Math.floor(piece.footY / 16))).toBe(false);
      if (piece.id === 'intake-lifting-bails') expect(painted.has('12,5')).toBe(false);
    }
  });
  it('keeps the intake bed and pipe visible across their full ground footprints in either water state', () => {
    for (const sluiceOpen of [false, true]) {
      const passage = surface('passage', { ...idle, sluiceOpen });
      for (const [obstacle, material] of [[intakeStrainer, '#344e50'], [bypassMain, '#574e43']] as const) {
        for (let tile = 0; tile < obstacle.width; tile++) {
          const x = (obstacle.x + tile) * 16;
          const y = obstacle.y * 16;
          const visible = Array.from({ length: 256 }, (_, i) => passage.get((y + (i >> 4)) * 1024 + x + i % 16));
          expect(visible).toContain(material);
        }
      }
    }
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
  it('restores each legacy basin position to dry ground with a legal next step', () => {
    for (const [x, y] of waterCells) {
      const save = createNewSave();
      Object.assign(save.player, { mapId: 'chamber', x, y });
      const restored = migrateSave(JSON.parse(JSON.stringify(save)));
      expect(restored?.player).toEqual(save.player);
      if (!restored) throw new Error('Missing restored chamber save');
      expect(canWalk(restored, x, y)).toBe(false);
      const session = createSession(restored);
      const landing = session.save.player;
      expect(canWalk(session.save, landing.x, landing.y)).toBe(true);
      const move = (Object.keys(DELTAS) as Direction[]).find(dir =>
        canWalk(session.save, landing.x + DELTAS[dir].x, landing.y + DELTAS[dir].y));
      if (!move) throw new Error(`No exit at ${x},${y}`);
      const next = reduceGame(session, { type: 'move', direction: move });
      expect(next.save.player).toMatchObject({ mapId: 'chamber', x: landing.x + DELTAS[move].x, y: landing.y + DELTAS[move].y });
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
    // Step clear of the two deck stops before turning east, then follow the
    // upper bank of the stilling well to the recovered page.
    walk('down', 'down', 'right', 'right', 'up', 'right', 'up', 'up');
    expect(nearbyInteractions(session.save).map(obj => obj.id)).toContain('page');
    walk('down', 'down', 'left', 'down', 'left', 'left', 'down', 'down', 'down', 'down', 'down', 'left', 'down');
    expect(nearbyInteractions(session.save).map(obj => obj.id)).toContain('chamber-exit');
  });
});
