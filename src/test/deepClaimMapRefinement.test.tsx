import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimCanvas, type DeepClaimCanvasDiagnostics } from '@/components/deepClaim/renderer/DeepClaimCanvas';
import { BUILDING_ART } from '@/components/deepClaim/renderer/artManifest';
import { fitSurfaceCamera, mineToScreen, pinchMine, screenToMine } from '@/components/deepClaim/renderer/camera';
import type { DeepClaimExpedition } from '@/lib/deepClaim/types';
import { companySnapshot } from './fixtures/deepClaim';

vi.mock('@/components/deepClaim/renderer/authoredAtlas', () => ({ preloadDeepClaimAtlas: () => Promise.resolve('failed'), subscribeDeepClaimAtlas: () => () => {}, getDeepClaimAtlasDiagnostics: () => ({ state: 'failed' }), drawAuthoredSprite: () => false }));
vi.mock('@/components/deepClaim/renderer/ancientAtlas', () => ({ preloadDeepClaimAddon: () => Promise.resolve('failed'), subscribeDeepClaimAddon: () => () => {}, getDeepClaimAddonDiagnostics: () => ({ state: 'failed' }), drawDeepClaimAddon: () => false }));
const viewport = { width: 390, height: 500 }, bounds = { width: 96, depth: 149 };
const contexts: MockContext[] = [];
class MockContext {
  fillStyle: string | CanvasGradient | CanvasPattern = ''; strokeStyle = ''; lineWidth = 1; imageSmoothingEnabled = true;
  fills: string[] = []; images: unknown[] = [];
  setTransform = vi.fn(); save = vi.fn(); restore = vi.fn(); translate = vi.fn(); scale = vi.fn(); strokeRect = vi.fn(); fillText = vi.fn();
  beginPath = vi.fn(); moveTo = vi.fn(); lineTo = vi.fn(); closePath = vi.fn(); fill = vi.fn(); stroke = vi.fn(); setLineDash = vi.fn();
  fillRect = vi.fn(() => this.fills.push(String(this.fillStyle)));
  drawImage = vi.fn((image: unknown) => this.images.push(image));
  constructor() { contexts.push(this); }
}
const frames = new Map<number, FrameRequestCallback>();
let frameTime = 0;
let frameId = 0, visibility: DocumentVisibilityState = 'visible';
const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
const box = { ...viewport, x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 500, toJSON: () => ({}) };
function frame(at = 1000) { act(() => { const elapsed = Math.max(0, at - frameTime); frameTime = at; vi.advanceTimersByTime(elapsed); const queue = [...frames.values()]; frames.clear(); queue.forEach(callback => callback(at)); }); }
function pointer(element: HTMLElement, type: string, x: number, y: number, pointerId = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId, clientX: x, clientY: y, pointerType: 'touch', isPrimary: pointerId === 1 }); fireEvent(element, event);
}
beforeEach(() => {
  contexts.length = 0; frames.clear(); frameId = 0; frameTime = 0; visibility = 'visible';
  vi.useFakeTimers({ toFake: ['setTimeout','clearTimeout'] });
  vi.spyOn(performance, 'now').mockImplementation(() => frameTime);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(box);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () { return new MockContext() as unknown as CanvasRenderingContext2D; } as unknown as typeof HTMLCanvasElement.prototype.getContext);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});

afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); frames.clear();
  if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility); else delete (document as unknown as Record<string, unknown>).visibilityState;
});

function workingCrews() {
  const snapshot = companySnapshot();
  snapshot.workers.push(...snapshot.workers.map(worker => ({ ...worker, id: `${worker.id}-second`, name: `${worker.name} second` })));
  snapshot.expeditions = [10, 30].map((depth, index): DeepClaimExpedition => ({
    id: `crew-${index}`, mode: 'explore', status: 'active', worker_ids: snapshot.workers.slice(index * 3, index * 3 + 3).map(worker => worker.id),
    target: { x: 48, y: depth }, path: [{ x: 48, y: 1 }, { x: 48, y: depth }], stage: 'work',
    stages: [{ key: 'work', starts_at: '2026-11-01T11:59:00Z', ends_at: '2026-11-01T12:19:00Z' }],
    started_at: '2026-11-01T11:59:00Z', completes_at: '2026-11-01T12:19:00Z', duration_minutes: 20, duration_seconds: 1200,
    tutorial: false, wages: 3, energy_per_worker: 1, config_version: 1, cargo: null,
  }));
  snapshot.workers.forEach((worker, index) => { worker.assigned_job_id = snapshot.expeditions[Math.floor(index / 3)].id; });
  return snapshot;
}
function cameraProbe() {
  const samples: DeepClaimCanvasDiagnostics[] = [];
  return { samples, record: (sample: DeepClaimCanvasDiagnostics) => { samples.push(sample); }, latest: () => samples.at(-1)!.camera };
}

describe('Deep Claim camp framing and touch camera', () => {
  it.each([{ width: 320, height: 440 }, { width: 844, height: 220 }, { width: 1440, height: 200 }, { width: 1440, height: 800 }])('fits every owned building roof and footprint in $width×$height', size => {
    const buildings = Object.values(BUILDING_ART), camera = fitSurfaceCamera(size, bounds, buildings);
    for (const building of buildings) {
      const topLeft = mineToScreen({ x: building.x, y: building.y }, camera, size);
      const bottomRight = mineToScreen({ x: building.x + building.width, y: building.y + building.height }, camera, size);
      expect(topLeft.x).toBeGreaterThanOrEqual(11.999); expect(topLeft.y).toBeGreaterThanOrEqual(11.999);
      expect(bottomRight.x).toBeLessThanOrEqual(size.width - 11.999); expect(bottomRight.y).toBeLessThanOrEqual(size.height - 11.999);
    }
  });
  it('keeps the same mine point between the fingers while translating and zooming together', () => {
    const camera = { x: 48, y: 40, scale: 20 };
    const before = [{ x: 100, y: 200 }, { x: 200, y: 200 }] as const;
    const after = [{ x: 120, y: 220 }, { x: 240, y: 220 }] as const;
    const anchored = screenToMine({ x: 150, y: 200 }, camera, viewport);
    const moved = pinchMine(camera, before, after, viewport, bounds);
    expect(moved.scale).toBe(24);
    expect(screenToMine({ x: 180, y: 220 }, moved, viewport)).toEqual(anchored);
  });
  it('supports two-finger translation and still pans when the zoom ceiling is reached', () => {
    for (const scale of [20, 46]) {
      const camera = { x: 48, y: 40, scale };
      const moved = pinchMine(camera, [{ x: 100, y: 200 }, { x: 200, y: 200 }], [{ x: 140, y: 230 }, { x: 240, y: 230 }], viewport, bounds);
      expect(moved.scale).toBe(scale);
      expect(moved.x).toBeCloseTo(camera.x - 40 / scale); expect(moved.y).toBeCloseTo(camera.y - 30 / scale);
    }
  });
  it('routes native pointer pairs through combined pan/zoom and never selects a tile after pinching', () => {
    const probe = cameraProbe(), select = vi.fn();
    render(<DeepClaimCanvas snapshot={companySnapshot()} view="mine" selectedTile={null} onSelectTile={select} onSelectBuilding={vi.fn()} onDiagnostics={probe.record} reducedMotion />);
    frame(); const initial = probe.latest();
    const anchor = screenToMine({ x: 180, y: 240 }, initial, viewport), canvas = screen.getByTestId('deep-claim-canvas');
    pointer(canvas, 'pointerdown', 130, 240, 1); pointer(canvas, 'pointerdown', 230, 240, 2);
    pointer(canvas, 'pointermove', 150, 260, 1); pointer(canvas, 'pointermove', 250, 260, 2); frame(2000);
    const moved = probe.latest(), actualAnchor = screenToMine({ x: 200, y: 260 }, moved, viewport);
    expect(actualAnchor.x).toBeCloseTo(anchor.x); expect(actualAnchor.y).toBeCloseTo(anchor.y); expect(moved.scale).toBeCloseTo(initial.scale);
    pointer(canvas, 'pointerup', 150, 260, 1);
    pointer(canvas, 'pointermove', 270, 260, 2); frame(3000);
    expect(probe.latest().x).toBeCloseTo(moved.x - 20 / moved.scale);
    pointer(canvas, 'pointerup', 270, 260, 2); expect(select).not.toHaveBeenCalled();
  });
});

describe('Deep Claim crew navigation', () => {
  it('focuses each expedition once regardless of crew size, then cycles to the first crew', () => {
    const snapshot = workingCrews(), saved = JSON.stringify(snapshot), probe = cameraProbe();
    render(<DeepClaimCanvas snapshot={snapshot} view="mine" selectedTile={null} onSelectTile={vi.fn()} onSelectBuilding={vi.fn()} onDiagnostics={probe.record} reducedMotion />);
    const focus = screen.getByRole('button', { name: 'Focus crew' });
    fireEvent.click(focus); frame(); expect(probe.latest().y).toBe(12); expect(screen.getByText(/Worker a and crew, work, depth 10 metres/)).toBeInTheDocument();
    fireEvent.click(focus); frame(2000); expect(probe.latest().y).toBe(32);
    fireEvent.click(focus); frame(3000); expect(probe.latest().y).toBe(12);
    expect(JSON.stringify(snapshot)).toBe(saved);
  });
  it('keeps the last focused identity across reordered workers and moves to the other crew', () => {
    const snapshot = workingCrews(), probe = cameraProbe();
    const props = { view: 'mine' as const, selectedTile: null, onSelectTile: vi.fn(), onSelectBuilding: vi.fn(), onDiagnostics: probe.record, reducedMotion: true };
    const root = render(<DeepClaimCanvas {...props} snapshot={snapshot} />);
    fireEvent.click(screen.getByRole('button', { name: 'Focus crew' })); frame(); expect(probe.latest().y).toBe(12);
    root.rerender(<DeepClaimCanvas {...props} snapshot={{ ...snapshot, workers: [...snapshot.workers].reverse() }} />);
    fireEvent.keyDown(screen.getByTestId('deep-claim-canvas'), { key: 'c' }); frame(2000); expect(probe.latest().y).toBe(32);
  });
  it('falls back to distinct idle workers when no expeditions are active', () => {
    render(<DeepClaimCanvas snapshot={companySnapshot()} view="surface" selectedTile={null} onSelectTile={vi.fn()} onSelectBuilding={vi.fn()} reducedMotion />);
    const focus = screen.getByRole('button', { name: 'Focus crew' });
    fireEvent.click(focus); expect(screen.getByText('Worker a, idle, depth 0 metres.')).toBeInTheDocument();
    fireEvent.click(focus); expect(screen.getByText('Worker b, idle, depth 0 metres.')).toBeInTheDocument();
  });
  it.each([1, 2])('ignores mouse button %s without capturing, selecting or panning', button => {
    const select = vi.fn(), building = vi.fn(), interacted = vi.fn(), canvasCapture = vi.fn();
    render(<DeepClaimCanvas snapshot={companySnapshot()} view="mine" selectedTile={null} onSelectTile={select} onSelectBuilding={building} onInteraction={interacted} reducedMotion />);
    const canvas = screen.getByTestId('deep-claim-canvas'); Object.assign(canvas, { setPointerCapture: canvasCapture });
    for (const [type, x] of [['pointerdown', 195], ['pointermove', 230], ['pointerup', 230]] as const) {
      const event = new Event(type, { bubbles: true }); Object.assign(event, { pointerType: 'mouse', pointerId: 1, button, clientX: x, clientY: 250 }); fireEvent(canvas, event);
    }
    expect(canvasCapture).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled(); expect(building).not.toHaveBeenCalled(); expect(interacted).not.toHaveBeenCalled();
  });
});
