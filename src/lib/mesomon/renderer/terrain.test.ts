import { describe, expect, it } from 'vitest';
import { MAPS } from '../data/maps';
import type { MapDefinition, TileKind } from '../types';
import { paintTerrainDepth } from './terrain';
import { paintTidalWater } from './tidalWater';

function paintedRects(tiles: TileKind[][], id: MapDefinition['id'] = 'harbor') {
  const fills: number[][] = [];
  const context = { fillStyle: '', fillRect: (...rect: number[]) => fills.push(rect) };
  paintTerrainDepth(context as unknown as CanvasRenderingContext2D, {
    ...MAPS[id], tiles, width: tiles[0].length, height: tiles.length,
  });
  return fills;
}

describe('Port Marche terrain depth', () => {
  it('masks the tidal surface to the actual wet tiles and keeps the workshop dry', () => {
    for (const map of Object.values(MAPS)) {
      const wet = new Set<string>();
      let clipped = false, restored = false;
      const ctx = {
        fillStyle: '', save() {}, beginPath() {},
        rect(x: number, y: number, w: number, h: number) {
          expect(h).toBe(16);
          for (let px = x; px < x + w; px += 16) wet.add(`${px / 16},${y / 16}`);
        },
        clip() { clipped = true; },
        fillRect() { expect(clipped).toBe(true); },
        restore() { restored = true; },
      };
      paintTidalWater(ctx as unknown as CanvasRenderingContext2D, map);
      for (const [row, tiles] of map.tiles.entries()) {
        tiles.forEach((tile, col) => expect(wet.has(`${col},${row}`)).toBe(tile === 'water' || tile === 'dark-water'));
      }
      expect(restored).toBe(wet.size > 0);
    }
  });
  it('extends dock faces and pilings into the water only at the exposed edge', () => {
    const fills = paintedRects([['wood', 'wood'], ['wood', 'wood'], ['water', 'water']]);
    expect(fills).toContainEqual([0, 31, 16, 4]);
    expect(fills).toContainEqual([3, 32, 4, 9]);
    expect(fills).not.toContainEqual([0, 15, 16, 4]);
    expect(fills).not.toContainEqual([19, 32, 4, 9]);
  });
  it('gives the ship a hull without dock pilings', () => {
    const fills = paintedRects([['wood'], ['water']], 'ship');
    expect(fills).toContainEqual([0, 15, 16, 4]);
    expect(fills).not.toContainEqual([3, 16, 4, 9]);
  });
});
