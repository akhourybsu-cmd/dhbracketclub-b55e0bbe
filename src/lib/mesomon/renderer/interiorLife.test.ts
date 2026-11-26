import { describe, expect, it } from 'vitest';
import { MAPS } from '../data/maps';
import type { MapId } from '../types';
import type { EnvironmentMotionState, EnvironmentRect } from './environmentMotion';
import { paintInteriorLife } from './interiorLife';
import { paintInterior } from './interiors';

const cold: EnvironmentMotionState = { gateOpened: false, sluiceOpen: false, riftSealed: false, reducedMotion: false, paused: false };

function artwork(map: MapId, state = cold) {
  const pixels = new Map<number, string>();
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      for (let row = y; row < y + h; row++) {
        for (let col = x; col < x + w; col++) pixels.set(row * 1024 + col, this.fillStyle);
      }
    },
  };
  paintInterior(ctx as unknown as CanvasRenderingContext2D, map, state);
  return (x: number, y: number) => pixels.get(y * 1024 + x);
}

function strokes(map: MapId, state: EnvironmentMotionState, phase: number) {
  const marks: { x: number; y: number; w: number; h: number }[] = [];
  const rect: EnvironmentRect = (_color, _alpha, x, y, w = 1, h = 1) => { marks.push({ x, y, w, h }); };
  paintInteriorLife(map, phase, state, rect);
  return marks;
}

describe('the workshop and the maintenance passage', () => {
  it('lights the cold stove only on Nia’s return, including on a still frame', () => {
    const warm = { ...cold, pageFound: true };
    expect(artwork('workshop', warm)(87, 121)).not.toBe(artwork('workshop')(87, 121));
    for (let phase = 0; phase < 8; phase++) {
      const bySpout = ({ x, y }: { x: number; y: number }) => x >= 74 && x < 83 && y >= 85 && y <= 102;
      expect(strokes('workshop', cold, phase).filter(bySpout)).toHaveLength(0);
      expect(strokes('workshop', warm, phase).filter(bySpout).length).toBeGreaterThanOrEqual(2);
    }
  });
  it('keeps the wind pennant on its pin and its moving hem inside the wall vent', () => {
    const frames = Array.from({ length: 8 }, (_, i) => strokes('workshop', cold, i).filter(({ x }) => x < 32));
    expect(frames.every(frame => frame.every(({ x, y, w, h }) =>
      x >= 20 && x + w <= 29 && y >= 108 && y + h <= 120))).toBe(true);
    expect(new Set(frames.map(frame => JSON.stringify(frame))).size).toBeGreaterThanOrEqual(3);
  });
  it('shows the float on the waterline even without animation and keeps moving water off the lane', () => {
    const open = { ...cold, sluiceOpen: true };
    const high = artwork('passage'), low = artwork('passage', open);
    expect(high(179, 250)).toBe(low(179, 267));
    expect(high(179, 250)).not.toBe(low(179, 250));
    expect(high(169, 255)).toBe(low(169, 272));
    for (let phase = 0; phase < 8; phase++) {
      const closed = strokes('passage', cold, phase), drained = strokes('passage', open, phase);
      // The small waterfall only runs through the outfall after the crossing drains.
      expect(closed.filter(({ x }) => x < 150)).toHaveLength(0);
      expect(drained.filter(({ x }) => x < 150)).toHaveLength(6);
      for (const { x, y, w, h } of [...closed, ...drained]) {
        expect(MAPS.passage.tiles[Math.floor(y / 16)][Math.floor(x / 16)]).toBe('wall');
        expect(MAPS.passage.tiles[Math.floor((y + h - 1) / 16)][Math.floor((x + w - 1) / 16)]).toBe('wall');
      }
    }
  });
  it('leaves other rooms to their own artists', () => {
    expect(strokes('chamber', cold, 0)).toEqual([]);
    expect(strokes('harbor', cold, 5)).toEqual([]);
  });
});
