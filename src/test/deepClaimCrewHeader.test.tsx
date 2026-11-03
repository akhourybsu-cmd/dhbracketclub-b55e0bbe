import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeepClaimPage from '@/pages/DeepClaimPage';
import { continueDeepClaimCompany } from './fixtures/deepClaimTutorialMock';
import type { DeepClaimExpedition, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';

const wire = vi.hoisted(() => ({ data: null as DeepClaimSnapshot | null, noop: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-a' }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: 'club-a' }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => true }) }));
vi.mock('@/components/deepClaim/menu/DeepClaimMenuBackdrop', () => ({ DeepClaimMenuBackdrop: () => null }));
vi.mock('@/hooks/useDeepClaimTutorial', async () => ({ useDeepClaimTutorial: (await import('./fixtures/deepClaimTutorialMock')).useDeepClaimTutorialMock }));
vi.mock('@/hooks/useDeepClaim', () => ({ useDeepClaim: () => ({ data: wire.data, loading: false, refreshing: false, error: null, busy: false, readOnly: false, pendingAction: null,
  serverNow: () => Date.parse('2026-11-01T12:00:00Z'), refresh: wire.noop, startResearch: wire.noop, fulfillContract: wire.noop, claimMilestone: wire.noop,
  preview: wire.noop, dispatch: wire.noop, resolveDiscovery: wire.noop, hire: wire.noop, train: wire.noop, assignEquipment: wire.noop, repairEquipment: wire.noop,
  retireEquipment: wire.noop, startProduction: wire.noop, collectProduction: wire.noop, upgrade: wire.noop, retryPending: wire.noop, collect: wire.noop, sell: wire.noop,
}) }));
vi.mock('@/lib/deepClaim/audio', () => ({ createDeepClaimAudio: () => {
  const settings = { master: false, music: true, ambient: true, sfx: true, volume: .65 };
  return { getSnapshot: () => settings, subscribe: () => () => {}, setScene: vi.fn(), updateSettings: vi.fn(), unlock: vi.fn(), play: vi.fn(), setActive: vi.fn(), dispose: vi.fn() };
} }));
vi.mock('@/components/deepClaim/renderer/authoredAtlas', () => ({ preloadDeepClaimAtlas: () => Promise.resolve('failed'), subscribeDeepClaimAtlas: () => () => {}, getDeepClaimAtlasDiagnostics: () => ({ state: 'failed' }), drawAuthoredSprite: () => false }));
vi.mock('@/components/deepClaim/renderer/ancientAtlas', () => ({ preloadDeepClaimAddon: () => Promise.resolve('failed'), subscribeDeepClaimAddon: () => () => {}, getDeepClaimAddonDiagnostics: () => ({ state: 'failed' }), drawDeepClaimAddon: () => false }));

class MockContext {
  fillStyle = ''; strokeStyle = ''; lineWidth = 1; imageSmoothingEnabled = false; globalAlpha = 1;
  setTransform = vi.fn(); save = vi.fn(); restore = vi.fn(); translate = vi.fn(); scale = vi.fn(); strokeRect = vi.fn(); fillText = vi.fn();
  beginPath = vi.fn(); moveTo = vi.fn(); lineTo = vi.fn(); closePath = vi.fn(); fill = vi.fn(); stroke = vi.fn(); setLineDash = vi.fn(); fillRect = vi.fn(); drawImage = vi.fn();
}
const contexts = new WeakMap<HTMLCanvasElement, MockContext>();
const frames = new Map<number, FrameRequestCallback>();
let clock = 0, frameId = 0;
const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
const box = { width: 320, height: 350, x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 350, toJSON: () => ({}) };
function frame() { act(() => { clock += 100; vi.advanceTimersByTime(100); const queue = [...frames.values()]; frames.clear(); queue.forEach(callback => callback(clock)); }); }
function App() { return <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DeepClaimPage /></MemoryRouter>; }
function activeCompany() {
  const snapshot = phaseFourSnapshot(); snapshot.company!.tutorial_used = true; snapshot.company!.crew_slots = 2;
  snapshot.world!.tiles = Array.from({ length: 30 }, (_, index) => ({ x: 48, y: index + 1, terrain: 'excavated' as const, material: null, remaining: 0, initial_amount: 0 }));
  snapshot.workers.push(...snapshot.workers.map(worker => ({ ...worker, id: `${worker.id}-second`, name: `${worker.name} second` })));
  snapshot.expeditions = [10, 14].map((depth, index): DeepClaimExpedition => ({
    id: `crew-${index}`, mode: 'extract', status: 'active', worker_ids: snapshot.workers.slice(index * 3, index * 3 + 3).map(worker => worker.id),
    target: { x: 48, y: depth }, path: [{ x: 48, y: 0 }, { x: 48, y: depth }], stage: 'work',
    stages: [{ key: 'work', starts_at: '2026-11-01T11:59:00Z', ends_at: '2026-11-01T12:19:00Z' }], started_at: '2026-11-01T11:59:00Z', completes_at: '2026-11-01T12:19:00Z',
    duration_minutes: 20, duration_seconds: 1200, tutorial: false, wages: 3, energy_per_worker: 1, config_version: 3, cargo: null,
  }));
  snapshot.workers.forEach((worker, index) => { worker.assigned_job_id = snapshot.expeditions[Math.floor(index / 3)].id; });
  return snapshot;
}
function follow() { fireEvent.click(screen.getAllByRole('button', { name: 'Follow crew' })[0]); frame(); return screen.getByRole('group', { name: 'Crew tracking' }); }

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); clock = 0; frameId = 0; frames.clear(); wire.data = activeCompany(); wire.noop.mockResolvedValue(wire.data);
  localStorage.setItem('dh:deep-claim:visuals:v1:user-a', JSON.stringify({ reducedMotion: true, reducedGraphics: false }));
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('dc-mine-controls') ? { ...box, y: -50, top: -50, bottom: -4, left: 120, x: 120, width: 200, height: 46 } : box;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) { const context = new MockContext(); contexts.set(this, context); return context as unknown as CanvasRenderingContext2D; } as unknown as typeof HTMLCanvasElement.prototype.getContext);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});
afterEach(() => { cleanup(); frames.clear(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility); });

describe('Deep Claim actual Page crew header integration', () => {
  it('docks Follow crew in the Page header apart from camera controls, and Stop redraws in reduced motion', () => {
    render(<App />); continueDeepClaimCompany(); frame(); const hud = follow();
    const target = document.querySelector('.dcl-crew-status-target'); expect(target).toBeInTheDocument(); expect(target).toContainElement(hud);
    expect(target!.closest('.dcl-map-heading')).toBeInTheDocument(); expect(hud).toHaveClass('is-docked');
    const controls = screen.getByRole('group', { name: 'Mine view controls' }); expect(target).not.toContainElement(controls);
    expect(controls.parentElement).not.toBe(target); expect(controls.closest('.dcl-map-heading')).toBe(target!.closest('.dcl-map-heading'));
    expect(hud).toHaveTextContent('Crew 1 · 3 workers');
    const context = contexts.get(screen.getByTestId('deep-claim-canvas') as HTMLCanvasElement)!;
    const paints = context.setTransform.mock.calls.length;
    fireEvent.click(within(hud).getByRole('button', { name: 'Stop following crew' })); frame();
    expect(target).toBeEmptyDOMElement(); expect(context.setTransform.mock.calls.length).toBeGreaterThan(paints);
  });

  it('keeps the exact same empty tracking portal and camera target across repeated tab switches', () => {
    render(<App />); continueDeepClaimCompany(); frame(); const hud = follow();
    fireEvent.click(within(hud).getByRole('button', { name: 'Stop following crew' })); frame();
    const target = document.querySelector('.dcl-crew-status-target')!, controls = screen.getByRole('group', { name: 'Mine view controls' }), cameraTarget = controls.parentElement;
    for (const name of ['Surface', 'Mine', 'Crew', 'Surface', 'Mine', 'Surface']) {
      fireEvent.click(screen.getByRole('tab', { name })); frame();
      expect(document.querySelector('.dcl-crew-status-target')).toBe(target); expect(target).toBeEmptyDOMElement();
      expect(document.querySelector('[aria-label="Mine view controls"]')).toBe(controls); expect(controls.parentElement).toBe(cameraTarget);
    }
  });

  it('clears the header HUD when company ownership scope changes', () => {
    const root = render(<App />); continueDeepClaimCompany(); frame(); follow();
    const target = document.querySelector('.dcl-crew-status-target')!;
    wire.data = structuredClone(wire.data); wire.data!.company!.id = 'another-company';
    root.rerender(<App />); frame();
    expect(screen.queryByRole('group', { name: 'Crew tracking' })).not.toBeInTheDocument();
    expect(target).toBeEmptyDOMElement();
  });
});
