import { describe, expect, it } from 'vitest';
import { MAPS } from '../data/maps';
import type { MapId } from '../types';
import { paintExteriors } from './exteriors';
import { paintExteriorLife } from './exteriorLife';
import type { EnvironmentMotionState } from './environmentMotion';

const running: EnvironmentMotionState = { gateOpened: false, sluiceOpen: false, riftSealed: false, paused: false, reducedMotion: false };

function motion(id: MapId, phase: number, state = running) {
  const marks: { x: number; y: number; w: number; h: number; alpha: number; ink: number }[] = [];
  paintExteriorLife(id, phase, state, (ink, alpha, x, y, w = 1, h = 1) => {
    marks.push({ x, y, w, h, alpha, ink });
  });
  return marks;
}

describe('Wayfarer and quay artwork', () => {
  it('attaches the ship rigging and the tern to the rail and keeps the stern reflections below the hull', () => {
    for (let phase = 0; phase < 8; phase++) {
      const paint = motion('ship', phase);
      expect(paint.some(mark => mark.x === 108 && mark.y === 59)).toBe(true);
      expect(paint.some(mark => mark.x >= 203 && mark.x < 213 && mark.y >= 113 && mark.y <= 122)).toBe(true);
      const reflection = paint.filter(mark => mark.ink === 0xac8668 || mark.ink === 0xd5bf96);
      expect(reflection).toHaveLength(2);
      for (const mark of reflection) expect(mark.y).toBeGreaterThanOrEqual(213);
    }
    expect(motion('ship', 0)).not.toEqual(motion('ship', 4));
  });

  it('registers eight jack positions behind the rope rack and holds the tide float offshore', () => {
    const tips = [];
    for (let phase = 0; phase < 8; phase++) {
      const marks = motion('harbor', phase);
      const tip = marks.find(mark => mark.ink === 0xf0cf93)!;
      expect(tip.x).toBeGreaterThanOrEqual(388);
      expect(tip.x).toBeLessThanOrEqual(396);
      expect(tip.y).toBeGreaterThanOrEqual(391);
      expect(tip.y).toBeLessThanOrEqual(399);
      tips.push([tip.x, tip.y].join(','));
      const float = marks.find(mark => mark.ink === 0xbc8059)!;
      for (const x of [float.x, float.x + float.w - 1]) {
        expect(MAPS.harbor.tiles[Math.floor(float.y / 16)][Math.floor(x / 16)]).toBe('water');
      }
    }
    expect(new Set(tips).size).toBe(8);
  });

  it('paints only supported rooms, with a bounded native-pixel budget per cel', () => {
    for (const id of Object.keys(MAPS) as MapId[]) {
      expect(motion(id, 4, { ...running, reducedMotion: true })).toEqual([]);
      expect(motion(id, 4, { ...running, paused: true })).toEqual([]);
      for (let phase = 0; phase < 8; phase++) {
        const marks = motion(id, phase);
        if (id !== 'ship' && id !== 'harbor') expect(marks).toEqual([]);
        expect(marks.length).toBeLessThanOrEqual(40);
        for (const mark of marks) {
          expect([mark.x, mark.y, mark.w, mark.h].every(Number.isInteger)).toBe(true);
          expect(mark.x + mark.w).toBeLessThanOrEqual(MAPS[id].width * 16);
          expect(mark.y + mark.h).toBeLessThanOrEqual(MAPS[id].height * 16);
        }
      }
    }
  });

  it('places both deckhouses on the original blocked roofs and the freight scales on their timber yard', () => {
    const structures: { x: number; y: number }[] = [];
    const ctx = {
      fillStyle: '', save() {}, restore() {}, clip() {}, beginPath() {}, rect() {},
      fillRect(x: number, y: number) { structures.push({ x, y }); },
    } as unknown as CanvasRenderingContext2D;
    paintExteriors(ctx, MAPS.ship);
    for (const x of [65, 145]) {
      expect(MAPS.ship.tiles[3][Math.floor(x / 16)]).toBe('roof');
      expect(structures.some(mark => mark.x === x + 1 && mark.y === 76)).toBe(true);
    }
    structures.length = 0;
    paintExteriors(ctx, MAPS.harbor);
    expect(MAPS.harbor.tiles[19][26]).toBe('wood');
    expect(structures.some(mark => mark.x === 401 && mark.y === 310)).toBe(true);
    expect(structures.some(mark => mark.x === 475 && mark.y === 468)).toBe(true);
  });
});
