import { describe, expect, it } from 'vitest';
import { WALK_STEP_MS } from '../input';
import { MAPS } from '../data/maps';
import { createNewSave, canWalk } from '../engine';
import type { TileKind } from '../types';
import { creatureIdleCel, paintCastShadow, paintFootfall, strideLift, type FieldStep } from './fieldStride';
import { foregroundForMap, paintForeground } from './foreground';

function print(surface: TileKind, age = 0, direction: FieldStep['direction'] = 'down') {
  const marks: number[][] = [];
  paintFootfall({ fillStyle() {}, fillRect(...bounds) { marks.push(bounds); } }, { x: 32, y: 29, surface, direction }, age);
  return marks;
}

describe('grounding on the walking map', () => {
  it('lifts the body a single native pixel during a stride and returns to the ground at rest', () => {
    expect([0, 0.25, 0.5, 0.75, 1].map(strideLift)).toEqual([0, 1, 1, 0, 0]);
  });
  it('holds a readable Rillik gesture between rests and gives a hovering creature its own cadence', () => {
    expect([0, 1640, 1900, 2080].map(time => creatureIdleCel('rillik', time, false))).toEqual([0, 1, 1, 0]);
    expect(creatureIdleCel('gleamwing', 300, false)).toBe(1);
    expect(creatureIdleCel('muddren', 300, false)).toBe(0);
    for (const time of [0, 300, 1800, 2400]) expect(creatureIdleCel('rillik', time, true)).toBe(0);
  });
  it('leaves brief directional footsteps on soft ground and keeps hard surfaces clean', () => {
    expect(print('sand')).toHaveLength(2);
    expect(print('sand', 0, 'left')).not.toEqual(print('sand'));
    expect(print('reeds', WALK_STEP_MS - 1)).not.toEqual(print('reeds', WALK_STEP_MS));
    for (const surface of ['stone', 'floor', 'wood', 'stairs', 'roof', 'water'] as const) expect(print(surface)).toEqual([]);
    expect(print('sand', WALK_STEP_MS * 2)).toEqual([]);
    expect(print('grass', -1)).toEqual([]);
  });
  it('casts away from the light on either side of the basin and fades in unlit passages', () => {
    function cast(map: 'chamber' | 'passage', x: number, y: number) {
      const marks: number[][] = [];
      paintCastShadow({ fillStyle() {}, fillRect(...bounds) { marks.push(bounds); } }, map, x, y);
      return marks;
    }
    expect(cast('chamber', 120, 105)[0][0]).toBeLessThan(120);
    expect(cast('chamber', 180, 105)[0][0]).toBeGreaterThan(180);
    expect(cast('passage', 36, 265)).toEqual([]);
  });
  it('gives every room a raised fixture with a walkable approach behind its front edge', () => {
    const save = createNewSave(1, 72);
    for (const map of Object.values(MAPS)) {
      save.player = { ...save.player, mapId: map.id, ...map.spawn };
      const pieces = foregroundForMap(map.id).filter(piece => 'paint' in piece);
      expect(pieces.length, map.id).toBeGreaterThan(0);
      expect(new Set(pieces.map(piece => piece.id)).size).toBe(pieces.length);
      for (const piece of pieces) {
        let reachableOverlap = false;
        const right = piece.x + piece.width, bottom = piece.y + piece.height;
        for (let y = Math.floor(piece.y / 16); y <= Math.floor(bottom / 16); y++) {
          for (let x = Math.floor(piece.x / 16); x <= Math.floor(right / 16); x++) {
            const foot = (y + 1) * 16;
            if (x * 16 < right && (x + 1) * 16 > piece.x && foot > piece.y &&
                foot <= piece.footY && canWalk(save, x, y)) reachableOverlap = true;
          }
        }
        expect(reachableOverlap, `${map.id} / ${piece.id}`).toBe(true);
      }
    }
  });

  it('provides a foot-sorted transparent foreground in each zone, including the three new cutouts', () => {
    for (const map of Object.values(MAPS)) expect(foregroundForMap(map.id).length).toBeGreaterThan(0);
    for (const id of ['ship', 'tide-stairs', 'chamber'] as const) {
      const [piece] = foregroundForMap(id);
      const marks = new Set<number>();
      const ctx = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(piece.width);
        expect(y + h).toBeLessThanOrEqual(piece.height);
        marks.add(y * piece.width + x);
      } };
      paintForeground(ctx as unknown as CanvasRenderingContext2D, piece);
      expect(marks.size).toBeGreaterThan(40);
      expect(marks.size).toBeLessThan(piece.width * piece.height * 0.8);
      expect(piece.footY).toBe(piece.y + piece.height - 1);
    }
  });
});
