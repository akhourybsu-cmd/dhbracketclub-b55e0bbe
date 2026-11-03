import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrewPresentation, CrewWorkerPresentation } from '@/lib/deepClaim/crewPresentation';
import { CREW_DETAIL_MIN_SCALE, CREW_MARKER_HEIGHT, CREW_MARKER_WIDTH, UNDERGROUND_WORKER_SCALE, paintCrewMarker, paintCrewWorker } from '@/components/deepClaim/renderer/crewPaint';
import { paintWorker } from '@/components/deepClaim/renderer/pixelArt';

vi.mock('@/components/deepClaim/renderer/pixelArt', () => ({ paintWorker: vi.fn() }));

class PaintContext {
  fillStyle = ''; strokeStyle = ''; lineWidth = 1; globalAlpha = 1;
  font = ''; textAlign = ''; textBaseline = '';
  save = vi.fn(); restore = vi.fn(); translate = vi.fn(); scale = vi.fn();
  beginPath = vi.fn(); moveTo = vi.fn(); lineTo = vi.fn(); closePath = vi.fn();
  rectangles: { x: number; y: number; width: number; height: number; color: string }[] = [];
  strokes: { color: string; width: number }[] = [];
  text: { value: string; x: number; y: number; color: string }[] = [];
  fill = vi.fn();
  stroke = vi.fn(() => { this.strokes.push({ color: this.strokeStyle, width: this.lineWidth }); });
  fillRect = vi.fn((x: number, y: number, width: number, height: number) => { this.rectangles.push({ x, y, width, height, color: this.fillStyle }); });
  fillText = vi.fn((value: string, x: number, y: number) => { this.text.push({ value, x, y, color: this.fillStyle }); });
  get canvasContext(): CanvasRenderingContext2D { return this as unknown as CanvasRenderingContext2D; }
}

function worker(overrides: Partial<CrewWorkerPresentation> = {}): CrewWorkerPresentation {
  return { worker_id: 'worker-a', job_id: 'job-a', name: 'Mara Flint', specialty: 'miner', x: 47, y: 10,
    stage: 'work', progress: .4, elapsed_seconds: 2, pose: 'mine', facing: -1, animation_phase_ms: 440,
    moving: false, awaiting_sync: false, crew_slot: 0, crew_number: 2, ...overrides };
}
function crew(overrides: Partial<CrewPresentation> = {}): CrewPresentation {
  return { job_id: 'job-a', number: 2, mode: 'extract', worker_ids: ['worker-a', 'worker-b', 'worker-c'],
    x: 47, y: 10, target: { x: 48, y: 10 }, stage: 'work', awaiting_sync: false, ...overrides };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('Deep Claim worker foot anchors and animation', () => {
  it('fits underground feet at the bottom center of the disclosed cell without changing source state', () => {
    const context = new PaintContext(), point = worker({ x: 47.25, y: 10.5 }), saved = JSON.stringify(point);
    const gear = { headTier: 2 as const, toolTier: 3 as const, utility: 'cargo' as const, utilityBroken: true };
    const savedGear = JSON.stringify(gear);
    paintCrewWorker(context.canvasContext, point, 3, gear, { underground: true, animate: true });
    expect(context.translate).toHaveBeenCalledWith(Math.round(47.75 * 16), Math.round(11.44 * 16));
    expect(context.scale).toHaveBeenCalledWith(UNDERGROUND_WORKER_SCALE, UNDERGROUND_WORKER_SCALE);
    expect(21 * UNDERGROUND_WORKER_SCALE).toBeLessThan(16);
    expect(paintWorker).toHaveBeenCalledWith(context.canvasContext, 0, 0, 'miner', 'mine', 2440, -1, 3, true, gear);
    expect(context.fillRect).not.toHaveBeenCalled(); // No stacked light rectangle over the sprites.
    expect(JSON.stringify(point)).toBe(saved); expect(JSON.stringify(gear)).toBe(savedGear);
    expect(context.save).toHaveBeenCalledTimes(1); expect(context.restore).toHaveBeenCalledTimes(1);
  });

  it('keeps full-size surface workers on the shared surface floor', () => {
    const context = new PaintContext();
    paintCrewWorker(context.canvasContext, worker({ y: 0 }), 0, {}, { underground: false, animate: false });
    expect(context.translate).toHaveBeenCalledWith(47.5 * 16, 0);
    expect(context.scale).not.toHaveBeenCalled();
    expect(vi.mocked(paintWorker).mock.calls[0][5]).toBe(0);
    expect(vi.mocked(paintWorker).mock.calls[0][8]).toBe(false);
  });

  it('crosses the shaft entrance continuously without a one-cell foot or sprite-size jump', () => {
    const depths = [0, .001, .5, .999, 1, 1.001];
    const rendered = depths.map(y => {
      const context = new PaintContext();
      paintCrewWorker(context.canvasContext, worker({ y, pose: 'walk', moving: true }), 0, {}, { underground: y > 0, animate: true });
      return { foot: context.translate.mock.calls[0][1] as number, scale: (context.scale.mock.calls[0]?.[0] as number | undefined) ?? 1 };
    });
    expect(rendered[0]).toEqual({ foot: 0, scale: 1 });
    expect(Math.abs(rendered[1].foot - rendered[0].foot)).toBeLessThanOrEqual(1);
    expect(Math.abs(rendered[1].scale - rendered[0].scale)).toBeLessThan(.001);
    expect(rendered[2].foot).toBe(Math.round(.5 * 1.94 * 16)); expect(rendered[2].scale).toBeCloseTo(.85);
    expect(Math.abs(rendered[3].foot - rendered[4].foot)).toBeLessThanOrEqual(1);
    expect(Math.abs(rendered[3].scale - rendered[4].scale)).toBeLessThan(.001);
    expect(rendered[4].scale).toBe(UNDERGROUND_WORKER_SCALE); expect(rendered[5].scale).toBe(UNDERGROUND_WORKER_SCALE);
    expect(Math.abs(rendered[5].foot - rendered[4].foot)).toBeLessThanOrEqual(1);
  });

  it('stops haul leg animation when workers are stationary, but allows actual route movement', () => {
    const context = new PaintContext();
    paintCrewWorker(context.canvasContext, worker({ stage: 'haul', pose: 'haul', moving: false }), 0, {}, { underground: true, animate: true });
    expect(vi.mocked(paintWorker).mock.calls[0][5]).toBe(0);
    expect(vi.mocked(paintWorker).mock.calls[0][8]).toBe(false);
    paintCrewWorker(context.canvasContext, worker({ stage: 'return', pose: 'haul', moving: true }), 0, {}, { underground: true, animate: true });
    expect(vi.mocked(paintWorker).mock.calls[1][8]).toBe(true);
  });

  it.each(['mine', 'survey', 'build', 'walk'] as const)('freezes %s poses under reduced motion or while awaiting server sync', pose => {
    const context = new PaintContext();
    paintCrewWorker(context.canvasContext, worker({ pose }), 0, {}, { underground: true, animate: false });
    paintCrewWorker(context.canvasContext, worker({ pose, awaiting_sync: true, moving: true }), 0, {}, { underground: true, animate: true });
    for (const call of vi.mocked(paintWorker).mock.calls) { expect(call[5]).toBe(0); expect(call[8]).toBe(false); }
  });

  it('uses the provided stable phase solely for animation and preserves the assigned specialty', () => {
    const context = new PaintContext(), first = worker({ specialty: 'surveyor', pose: 'survey', animation_phase_ms: 220 });
    const second = worker({ specialty: 'engineer', pose: 'build', animation_phase_ms: 660 });
    paintCrewWorker(context.canvasContext, first, 0, {}, { underground: true, animate: true });
    paintCrewWorker(context.canvasContext, second, 1, {}, { underground: true, animate: true });
    expect(vi.mocked(paintWorker).mock.calls.map(call => [call[3], call[4], call[5]])).toEqual([['surveyor', 'survey', 2220], ['engineer', 'build', 2660]]);
    expect(first.progress).toBe(second.progress);
  });
});

describe('Deep Claim screen-space crew markers', () => {
  it.each([6, CREW_DETAIL_MIN_SCALE, 46])('keeps crew identity and an at least 44px tap target readable at scale %s', scale => {
    const context = new PaintContext(), entry = crew(), saved = JSON.stringify(entry);
    const hit = paintCrewMarker(context.canvasContext, entry, { x: 100, y: 60 }, scale, false);
    expect(hit).toEqual({ job_id: 'job-a', left: 100 - CREW_MARKER_WIDTH / 2, top: 38, right: 100 + CREW_MARKER_WIDTH / 2, bottom: 82, width: CREW_MARKER_WIDTH, height: 44 });
    expect(hit.width).toBeGreaterThanOrEqual(44); expect(hit.height).toBeGreaterThanOrEqual(44);
    expect(context.text.map(item => item.value)).toEqual(['C2', '3']);
    expect(context.text.every(item => item.x >= hit.left && item.x <= hit.right && item.y >= hit.top && item.y <= hit.bottom)).toBe(true);
    expect(context.rectangles.every(item => item.y >= 60 - CREW_MARKER_HEIGHT / 2 && item.y + item.height <= 60 + CREW_MARKER_HEIGHT / 2)).toBe(true);
    expect(JSON.stringify(entry)).toBe(saved);
  });

  it.each(['dark', 'light'] as const)('uses a stronger focused outline and keeps marker geometry stable in %s theme', theme => {
    const context = new PaintContext();
    const normal = paintCrewMarker(context.canvasContext, crew(), { x: 100, y: 60 }, 25, false, theme);
    const focused = paintCrewMarker(context.canvasContext, crew(), { x: 100, y: 60 }, 25, true, theme);
    expect(focused).toEqual(normal);
    expect(context.strokes[0].width).toBe(1); expect(context.strokes[1].width).toBe(2);
    expect(context.strokes[0].color).not.toBe(context.strokes[1].color);
    expect(context.save).toHaveBeenCalledTimes(2); expect(context.restore).toHaveBeenCalledTimes(2);
  });

  it('uses distinct objective glyphs while keeping labels independent of progress', () => {
    const glyphs = (['explore', 'extract', 'survey', 'infrastructure'] as const).map(mode => {
      const context = new PaintContext();
      paintCrewMarker(context.canvasContext, crew({ mode }), { x: 100, y: 60 }, 6, false);
      expect(context.text.map(item => item.value)).toEqual(['C2', '3']);
      return JSON.stringify(context.rectangles);
    });
    expect(new Set(glyphs).size).toBe(4);
  });
});
