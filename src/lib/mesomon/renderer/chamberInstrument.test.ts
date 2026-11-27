import { describe, expect, it } from 'vitest';
import { MAPS } from '../data/maps';
import { paintChamberInstrument, paintRecorderMotion } from './chamberInstrument';

function chamber(sealed: boolean) {
  const marks: { x: number; y: number; w: number; h: number; color: string }[] = [];
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      marks.push({ x, y, w, h, color: this.fillStyle });
    },
  };
  paintChamberInstrument(ctx as unknown as CanvasRenderingContext2D, sealed);
  return marks;
}

describe('the chamber tide recorder', () => {
  it('records two traces in the fixed case, synchronizing their shapes only after sealing', () => {
    for (const sealed of [false, true]) {
      const marks = chamber(sealed);
      const waveform = (ink: string, origin: number) => marks.filter(({ color }) => color === ink).map(({ y }) => y - origin);
      const upper = waveform('#486963', 37), lower = waveform('#81574d', 43);
      expect(upper).toHaveLength(24);
      expect(lower).toHaveLength(upper.length);
      expect(upper.every((y, i) => lower[i] === y)).toBe(sealed);
      for (let phase = 0; phase < 8; phase++) {
        const tips: number[] = [];
        paintRecorderMotion(phase, sealed, (color, _alpha, x, y) => {
          expect(x >= 161 && x <= 165 && y >= 31 && y < 49).toBe(true);
          expect(['wall', 'dark-water']).toContain(MAPS.chamber.tiles[Math.floor(y / 16)][Math.floor(x / 16)]);
          if (color === 0x4c5b56) tips.push(y);
        });
        expect(tips).toEqual([37 + upper[phase * 2], 43 + lower[phase * 2]]);
      }
    }
  });
  it('levels the floats in their stilling wells and leaves the full inspection deck clear', () => {
    for (const sealed of [false, true]) {
      const marks = chamber(sealed);
      const floats = marks.filter(({color}) => color === '#dab387');
      expect(floats.map(({y}, i) => y - [48, 128][i])).toEqual(sealed ? [13, 13] : [10, 17]);
      for (const { x, y } of floats) expect(MAPS.chamber.tiles[Math.floor(y / 16)][Math.floor(x / 16)]).toBe('dark-water');
      expect(marks.some(({x,y,w,h}) => x < 160 && x + w > 144 && y < 123 && y + h > 96)).toBe(false);
    }
  });
});
