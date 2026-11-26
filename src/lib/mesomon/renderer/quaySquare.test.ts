import { describe, expect, it } from 'vitest';
import { MAPS } from '../data/maps';
import { foregroundForMap, paintForeground } from './foreground';
import { paintQuaySquare, quayFixtures } from './quaySquare';

describe('lower quay fixtures', () => {
  it('fits both transparent cutouts and attaches their baselines to occupied workers’ tiles', () => {
    for (const piece of quayFixtures) {
      expect(foregroundForMap('harbor')).toContain(piece);
      const colors = new Set<string>();
      const ctx = {
        fillStyle: '',
        fillRect(x: number, y: number, w: number, h: number) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x + w).toBeLessThanOrEqual(piece.width);
          expect(y + h).toBeLessThanOrEqual(piece.height);
          colors.add(this.fillStyle);
        },
      };
      paintForeground(ctx as unknown as CanvasRenderingContext2D, piece);
      expect(colors.size).toBeGreaterThan(8);
      const npc = MAPS.harbor.objects.find(object => object.id === (piece.id === 'quay-bell' ? 'bell-worker' : 'rope-worker'))!;
      expect(npc.solid).toBe(true);
      expect(Math.floor(piece.footY / 16)).toBe(npc.y);
      expect(piece.footY).toBeLessThan((npc.y + 1) * 16);
    }
  });
  it('keeps port-specific survey and shadow paint off the other maps', () => {
    let marks = 0;
    const ctx = { fillRect() { marks++; } } as unknown as CanvasRenderingContext2D;
    for (const map of Object.values(MAPS).filter(value => value.id !== 'harbor')) paintQuaySquare(ctx, map);
    expect(marks).toBe(0);
    paintQuaySquare(ctx, MAPS.harbor);
    expect(marks).toBeGreaterThan(20);
  });
});
