import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimCanvas, type DeepClaimCanvasProps, type DeepClaimWorkerFrame } from '@/components/deepClaim/renderer/DeepClaimCanvas';
import { mineToScreen } from '@/components/deepClaim/renderer/camera';
import type { DeepClaimExpedition, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { companySnapshot } from './fixtures/deepClaim';

vi.mock('@/components/deepClaim/renderer/authoredAtlas', () => ({ preloadDeepClaimAtlas: () => Promise.resolve('failed'), subscribeDeepClaimAtlas: () => () => {}, getDeepClaimAtlasDiagnostics: () => ({ state: 'failed' }), drawAuthoredSprite: () => false }));
vi.mock('@/components/deepClaim/renderer/ancientAtlas', () => ({ preloadDeepClaimAddon: () => Promise.resolve('failed'), subscribeDeepClaimAddon: () => () => {}, getDeepClaimAddonDiagnostics: () => ({ state: 'failed' }), drawDeepClaimAddon: () => false }));
class MockContext {
  fillStyle = ''; strokeStyle = ''; lineWidth = 1; imageSmoothingEnabled = false; globalAlpha = 1;
  setTransform = vi.fn(); save = vi.fn(); restore = vi.fn(); translate = vi.fn(); scale = vi.fn(); strokeRect = vi.fn(); fillText = vi.fn();
  beginPath = vi.fn(); moveTo = vi.fn(); lineTo = vi.fn(); closePath = vi.fn(); fill = vi.fn(); stroke = vi.fn(); setLineDash = vi.fn(); fillRect = vi.fn(); drawImage = vi.fn();
}
const viewport = { width: 390, height: 500 };
const box = { ...viewport, x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 500, toJSON: () => ({}) };
const frames = new Map<number, FrameRequestCallback>();
let clock = 0, frameId = 0;
const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
function frame(at = clock) {
  act(() => { const elapsed = Math.max(0, at - clock); clock = at; vi.advanceTimersByTime(elapsed); const due = [...frames.values()]; frames.clear(); due.forEach(callback => callback(at)); });
}
function pointer(canvas: HTMLElement, type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true }); fireEvent(canvas, event);
}
function crews(): DeepClaimSnapshot {
  const snapshot = companySnapshot();
  snapshot.company!.crew_slots = 2;
  snapshot.world!.tiles = Array.from({ length: 30 }, (_, index) => ({ x: 48, y: index + 1, terrain: 'excavated' as const, material: null, remaining: 0, initial_amount: 0 }));
  snapshot.workers.push(...snapshot.workers.map(worker => ({ ...worker, id: `${worker.id}-second`, name: `${worker.name} second` })));
  snapshot.expeditions = [10, 14].map((depth, index): DeepClaimExpedition => ({
    id: `crew-${index}`, mode: index ? 'survey' : 'extract', status: 'active', worker_ids: snapshot.workers.slice(index * 3, index * 3 + 3).map(worker => worker.id),
    target: { x: 48, y: depth }, path: [{ x: 48, y: 0 }, { x: 48, y: depth }], stage: 'work',
    stages: [{ key: 'work', starts_at: '2026-11-01T11:59:00Z', ends_at: '2026-11-01T12:19:00Z' }],
    started_at: '2026-11-01T11:59:00Z', completes_at: '2026-11-01T12:19:00Z', duration_minutes: 20, duration_seconds: 1200,
    tutorial: false, wages: 3, energy_per_worker: 1, config_version: 1, cargo: null,
  }));
  snapshot.workers.forEach((worker, index) => { worker.assigned_job_id = snapshot.expeditions[Math.floor(index / 3)].id; });
  return snapshot;
}
function harness(snapshot = crews(), extra: Partial<DeepClaimCanvasProps> = {}) {
  const samples: DeepClaimWorkerFrame[] = [];
  const props: DeepClaimCanvasProps = { snapshot, view: 'mine', selectedTile: null, onSelectTile: vi.fn(), onSelectBuilding: vi.fn(), reducedMotion: true,
    onWorkerFrame: sample => { samples.push(sample); }, ...extra };
  const root = render(<DeepClaimCanvas {...props} />);
  frame();
  return { root, props, samples, latest: () => samples.at(-1)! };
}
beforeEach(() => {
  frames.clear(); clock = 0; frameId = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('dc-mine-controls') ? { ...box, x: 190, left: 190, width: 200, height: 46, bottom: 46 } : box;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => new MockContext() as unknown as CanvasRenderingContext2D);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});
afterEach(() => {
  cleanup(); frames.clear(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
});

describe('Deep Claim crew tracking in the real canvas', () => {
  it('paints each assigned worker once in known open cells and retains the source snapshot', () => {
    const snapshot = crews(), saved = JSON.stringify(snapshot), { latest } = harness(snapshot);
    const sample = latest(); expect(sample.workers).toHaveLength(6);
    expect(new Set(sample.workers.map(worker => worker.worker_id)).size).toBe(6);
    for (const worker of sample.workers) {
      expect(worker.painted).toBe(true);
      expect(snapshot.world!.tiles.find(tile => tile.x === Math.floor(worker.x) && tile.y === Math.floor(worker.y))?.remaining).toBe(0);
    }
    expect(new Set(sample.workers.map(worker => `${worker.x}:${worker.y}`)).size).toBe(6);
    expect(JSON.stringify(snapshot)).toBe(saved);
  });

  it('focuses a complete crew with matching HUD and keeps all three members visible', () => {
    const { latest } = harness(); fireEvent.click(screen.getByRole('button', { name: 'Focus crew' })); frame();
    const hud = screen.getByRole('group', { name: 'Crew tracking' });
    expect(hud).toHaveTextContent('Crew 1 · 3 workers'); expect(hud).toHaveTextContent('Mine a deposit');
    expect(hud).toHaveTextContent('Worker a, Worker b, Worker c');
    expect(latest().followed_job_id).toBe('crew-0');
    for (const worker of latest().workers.filter(worker => worker.job_id === 'crew-0')) {
      const feet = mineToScreen({ x: worker.x + .5, y: worker.y + .94 }, latest().camera, viewport);
      expect(feet.x).toBeGreaterThan(0); expect(feet.x).toBeLessThan(viewport.width);
      expect(feet.y).toBeGreaterThan(40); expect(feet.y).toBeLessThan(viewport.height);
    }
    fireEvent.keyDown(screen.getByTestId('deep-claim-canvas'), { key: 'c' }); frame();
    expect(hud).toHaveTextContent('Crew 2 · 3 workers'); expect(latest().followed_job_id).toBe('crew-1');
  });

  it('continues following disclosed route movement as the monotonic clock advances', () => {
    const snapshot = crews(); snapshot.expeditions = [snapshot.expeditions[0]]; snapshot.workers = snapshot.workers.slice(0, 3);
    snapshot.expeditions[0] = { ...snapshot.expeditions[0], stage: 'travel', target: { x: 48, y: 20 }, path: [{ x: 48, y: 0 }, { x: 48, y: 20 }], stages: [{ key: 'travel', starts_at: snapshot.server_now, ends_at: '2026-11-01T12:01:40Z' }] };
    const { latest } = harness(snapshot, { reducedMotion: false });
    fireEvent.click(screen.getByRole('button', { name: 'Focus crew' })); frame(1000); const first = latest();
    frame(50000); const later = latest();
    expect(later.followed_job_id).toBe('crew-0'); expect(later.workers[0].y).toBeGreaterThan(first.workers[0].y + 8);
    expect(later.camera.y).toBeGreaterThan(first.camera.y + 5);
    expect(snapshot.expeditions[0].stage).toBe('travel'); expect(snapshot.expeditions[0].cargo).toBeNull();
  });

  it.each(['pan', 'zoom'] as const)('stops camera tracking after intentional manual %s', action => {
    const { latest } = harness(); fireEvent.click(screen.getByRole('button', { name: 'Focus crew' })); frame();
    if (action === 'zoom') fireEvent.click(screen.getByRole('button', { name: 'Zoom into mine' }));
    else { const canvas = screen.getByTestId('deep-claim-canvas'); pointer(canvas, 'pointerdown', 100, 200); pointer(canvas, 'pointermove', 140, 230); pointer(canvas, 'pointerup', 140, 230); }
    frame(); expect(screen.queryByRole('group', { name: 'Crew tracking' })).not.toBeInTheDocument(); expect(latest().followed_job_id).toBeNull();
  });

  it('selects the real screen-space crew marker without selecting its underlying tile', () => {
    const onCrewFocus = vi.fn(), { latest, props } = harness(crews(), { onCrewFocus });
    const marker = latest().markers.find(entry => entry.job_id === 'crew-1')!; expect(marker).toBeDefined();
    const x = (marker.left + marker.right) / 2, y = (marker.top + marker.bottom) / 2;
    const canvas = screen.getByTestId('deep-claim-canvas'); pointer(canvas, 'pointerdown', x, y); pointer(canvas, 'pointerup', x, y); frame();
    expect(latest().followed_job_id).toBe('crew-1'); expect(onCrewFocus).toHaveBeenCalledWith('crew-1'); expect(props.onSelectTile).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Crew tracking' })).toHaveTextContent('Crew 2 · 3 workers');
  });

  it('honors explicit follow requests and the accessible stop control', () => {
    const { latest } = harness(crews(), { focusRequest: { id: 'follow-one', jobId: 'crew-1', point: { x: 48, y: 14 } } });
    expect(latest().followed_job_id).toBe('crew-1');
    fireEvent.click(within(screen.getByRole('group', { name: 'Crew tracking' })).getByRole('button', { name: 'Stop following crew' })); frame();
    expect(latest().followed_job_id).toBeNull(); expect(screen.queryByRole('group', { name: 'Crew tracking' })).not.toBeInTheDocument();
  });

  it('portals tracking into a stable explicit target and clears its selected paint on Stop', () => {
    const target = document.createElement('div'); target.className = 'test-crew-tracking-target'; document.body.append(target);
    const { root, props, latest } = harness(crews(), { trackingTarget: target });
    fireEvent.click(screen.getByRole('button', { name: 'Focus crew' })); frame();
    const hud = screen.getByRole('group', { name: 'Crew tracking' });
    expect(target).toContainElement(hud); expect(hud).toHaveClass('is-docked');
    expect(screen.getByTestId('deep-claim-map')).not.toContainElement(hud);
    root.rerender(<DeepClaimCanvas {...props} selectedTile={{ x: 48, y: 1 }} />); frame();
    expect(target).toContainElement(screen.getByRole('group', { name: 'Crew tracking' }));
    fireEvent.click(within(hud).getByRole('button', { name: 'Stop following crew' })); frame();
    expect(target).toBeEmptyDOMElement(); expect(latest().followed_job_id).toBeNull();
    root.unmount(); target.remove();
  });

  it.each(['completion', 'company switch'] as const)('clears stale tracking on %s', change => {
    const { root, props, latest } = harness(); fireEvent.click(screen.getByRole('button', { name: 'Focus crew' })); frame();
    const next = structuredClone(props.snapshot);
    if (change === 'completion') { next.expeditions[0].status = 'collected'; next.workers.slice(0, 3).forEach(worker => { worker.assigned_job_id = null; }); }
    else next.company!.id = 'different-company';
    root.rerender(<DeepClaimCanvas {...props} snapshot={next} />); frame();
    expect(latest().followed_job_id).toBeNull(); expect(screen.queryByRole('group', { name: 'Crew tracking' })).not.toBeInTheDocument();
  });

  it('keeps worker identities out of aggregate diagnostics and tolerates an optional observer failure', () => {
    const onDiagnostics = vi.fn(), onWorkerFrame = vi.fn(() => { throw new Error('local observer unavailable'); });
    harness(crews(), { onDiagnostics, onWorkerFrame });
    expect(onWorkerFrame).toHaveBeenCalled(); expect(onDiagnostics).toHaveBeenCalled();
    const diagnostic = JSON.stringify(onDiagnostics.mock.calls[0][0]);
    expect(diagnostic).not.toContain('worker-a'); expect(diagnostic).not.toContain('Worker a'); expect(diagnostic).not.toContain('crew-0');
    expect(screen.getByTestId('deep-claim-canvas')).toBeInTheDocument();
  });

  it.each(['travel', 'return'] as const)('faces the direction of the disclosed horizontal %s route', stage => {
    const snapshot = crews(); snapshot.expeditions = [snapshot.expeditions[0]]; snapshot.workers = snapshot.workers.slice(0, 3);
    snapshot.world!.tiles.push(...[45, 46, 47].map(x => ({ x, y: 10, terrain: 'excavated' as const, material: null, remaining: 0, initial_amount: 0 })));
    const now = Date.parse(snapshot.server_now), progress = stage === 'travel' ? .92 : .08;
    snapshot.expeditions[0] = { ...snapshot.expeditions[0], stage, target: { x: 45, y: 10 }, path: [{ x: 48, y: 0 }, { x: 48, y: 10 }, { x: 45, y: 10 }],
      stages: [{ key: stage, starts_at: new Date(now - progress * 100000).toISOString(), ends_at: new Date(now + (1 - progress) * 100000).toISOString() }] };
    const { latest } = harness(snapshot); const lead = latest().workers.find(worker => worker.job_id === 'crew-0')!;
    expect(lead.x).toBeGreaterThan(45); expect(lead.x).toBeLessThan(48); expect(lead.y).toBe(10);
    expect(lead.facing).toBe(stage === 'travel' ? -1 : 1);
  });
});
