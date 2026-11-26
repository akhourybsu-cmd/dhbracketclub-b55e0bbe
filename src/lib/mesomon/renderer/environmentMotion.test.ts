import { describe, expect, it } from 'vitest';
import { MAPS } from '../data/maps';
import type { MapId } from '../types';
import { ENVIRONMENT_MOTION_FRAME_MS, MAX_ENVIRONMENT_MOTION_RECTS, paintEnvironmentMotion, type EnvironmentMotionState, type EnvironmentMotionView } from './environmentMotion';

const state: EnvironmentMotionState = { gateOpened: false, sluiceOpen: false, riftSealed: false, reducedMotion: false, paused: false };
type Rect = { color: number; alpha: number; x: number; y: number; width: number; height: number };
function draw(id: MapId, time = 0, patch: Partial<EnvironmentMotionState> = {}, view?: EnvironmentMotionView) {
  const rects: Rect[] = [];
  let color = 0, alpha = 1;
  const graphics = {
    fillStyle(next: number, opacity = 1) { color = next; alpha = opacity; },
    fillRect(x: number, y: number, width: number, height: number) { rects.push({ color, alpha, x, y, width, height }); },
  };
  const map = MAPS[id];
  const count = paintEnvironmentMotion(graphics, map, view ?? { left: 0, top: 0, right: map.width * 16, bottom: map.height * 16 }, time, { ...state, ...patch });
  expect(count).toBe(rects.length);
  return rects;
}
const intersects = (rect: Rect, x: number, y: number, width: number, height: number) => rect.x < x + width && rect.x + rect.width > x && rect.y < y + height && rect.y + rect.height > y;

describe('bounded Port Marche environment motion', () => {
  it('paints no motion in menus or under reduced motion, including after a cached animated frame', () => {
    for (const id of Object.keys(MAPS) as MapId[]) {
      expect(draw(id).length).toBeGreaterThan(0);
      expect(draw(id, 2000, { paused: true })).toEqual([]);
      expect(draw(id, 2000, { reducedMotion: true })).toEqual([]);
    }
  });
  it('quantizes authored movement without drawing fractional pixels or exceeding a room budget', () => {
    for (const id of Object.keys(MAPS) as MapId[]) {
      const before = structuredClone(MAPS[id]);
      for (let phase = 0; phase < 8; phase++) {
        const rects = draw(id, phase * ENVIRONMENT_MOTION_FRAME_MS);
        expect(rects).toEqual(draw(id, phase * ENVIRONMENT_MOTION_FRAME_MS + 300));
        expect(rects.length).toBeLessThanOrEqual(MAX_ENVIRONMENT_MOTION_RECTS);
        for (const rect of rects) {
          expect([rect.x, rect.y, rect.width, rect.height].every(Number.isInteger)).toBe(true);
          expect(rect.alpha).toBeGreaterThan(0);
          expect(rect.alpha).toBeLessThanOrEqual(1);
        }
      }
      expect(draw(id, 0)).not.toEqual(draw(id, 3 * ENVIRONMENT_MOTION_FRAME_MS));
      expect(MAPS[id]).toEqual(before);
    }
  });
  it('culls unseen landmarks and clips border marks to the native camera and map', () => {
    expect(draw('harbor', 0, {}, { left: 0, top: 0, right: 160, bottom: 144 })).toEqual([]);
    const view = { left: 350.4, top: 530.2, right: 359.8, bottom: 535.9 };
    const rects = draw('harbor', 0, {}, view);
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(Math.ceil(view.left));
      expect(rect.y).toBeGreaterThanOrEqual(Math.ceil(view.top));
      expect(rect.x + rect.width).toBeLessThanOrEqual(Math.floor(view.right));
      expect(rect.y + rect.height).toBeLessThanOrEqual(Math.floor(view.bottom));
    }
    expect(draw('ship', 0, {}, { left: 500, top: 500, right: 660, bottom: 644 })).toEqual([]);
  });
  it('leaves a drained passage crossing completely dry and sends runoff to its outfall', () => {
    for (let phase = 0; phase < 8; phase++) {
      const time = phase * ENVIRONMENT_MOTION_FRAME_MS;
      expect(draw('passage', time).some(rect => intersects(rect, 160, 176, 32, 64))).toBe(true);
      const drained = draw('passage', time, { sluiceOpen: true });
      expect(drained.some(rect => intersects(rect, 160, 176, 32, 64))).toBe(false);
      expect(drained.some(rect => intersects(rect, 122, 290, 26, 8))).toBe(true);
    }
  });
  it('shows spillway flow only after the tide wheel works and calms the sealed chamber', () => {
    expect(draw('tide-stairs').some(rect => intersects(rect, 155, 160, 34, 8))).toBe(false);
    expect(draw('tide-stairs', 0, { gateOpened: true }).some(rect => intersects(rect, 155, 160, 34, 8))).toBe(true);
    const active = draw('chamber');
    const sealed = draw('chamber', 0, { riftSealed: true });
    expect(active).not.toEqual(sealed);
    expect(active.some(rect => rect.color === 0xaca0ba || rect.color === 0x998ba9)).toBe(true);
    expect(sealed.some(rect => rect.color === 0xaca0ba || rect.color === 0x998ba9)).toBe(false);
  });
  it('keeps daylight in the workshop window and broken reflections in the water behind the ship', () => {
    for (let phase = 0; phase < 8; phase++) {
      const time = phase * ENVIRONMENT_MOTION_FRAME_MS;
      const daylight = draw('workshop', time).filter(rect => rect.color === 0xf0d69c);
      expect(daylight.length).toBeGreaterThanOrEqual(3);
      for (const rect of daylight) {
        expect(rect.x).toBeGreaterThanOrEqual(106);
        expect(rect.x + rect.width).toBeLessThanOrEqual(133);
        expect(rect.y).toBeGreaterThanOrEqual(49);
        expect(rect.y + rect.height).toBeLessThanOrEqual(67);
      }
      const stern = draw('ship', time, {}, { left: 74, top: 214, right: 180, bottom: 224 });
      expect(stern.length).toBeGreaterThanOrEqual(4);
    }
  });
  it('keeps every story variant within the paint budget, including after revisits', () => {
    for (const id of Object.keys(MAPS) as MapId[]) {
      for (const pageFound of [true, false]) for (const sluiceOpen of [true, false]) {
        for (const riftSealed of [true, false]) for (let phase = 0; phase < 8; phase++) {
          const rects = draw(id, phase * ENVIRONMENT_MOTION_FRAME_MS, { pageFound, sluiceOpen, riftSealed, gateOpened: pageFound });
          expect(rects.length).toBeLessThanOrEqual(MAX_ENVIRONMENT_MOTION_RECTS);
        }
      }
    }
  });
});
