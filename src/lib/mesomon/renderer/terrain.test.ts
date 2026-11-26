import { describe, expect, it } from 'vitest';
import { MAPS } from '../data/maps';
import type { MapDefinition, TileKind } from '../types';
import { paintTerrainDepth } from './terrain';

function paintedRects(tiles: TileKind[][], id: MapDefinition['id'] = 'harbor') {
  const fills: number[][] = [];
  const context = { fillStyle: '', fillRect: (...rect: number[]) => fills.push(rect) };
  paintTerrainDepth(context as unknown as CanvasRenderingContext2D, {
    ...MAPS[id], tiles, width: tiles[0].length, height: tiles.length,
  });
  return fills;
}

describe('Port Marche terrain depth', () => {
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
