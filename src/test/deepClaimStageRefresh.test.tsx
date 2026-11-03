import { act, cleanup, renderHook } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeepClaim } from '@/hooks/useDeepClaim';
import type { DeepClaimExpedition, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { validateDeepClaimSnapshot } from '@/lib/deepClaim/world';
import { companySnapshot } from './fixtures/deepClaim';

const wire = vi.hoisted(() => ({ rpc: vi.fn(), user: 'user-a', club: 'club-a', installed: true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: wire.rpc } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: wire.user }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: wire.club }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => wire.installed }) }));

const BASE = Date.parse('2026-11-01T12:00:00Z');
const at = (milliseconds: number) => new Date(BASE + milliseconds).toISOString();
const clients: QueryClient[] = [];
let visibility: DocumentVisibilityState = 'visible';
const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
function running({ stage = 'travel', now = 0, revision = 1, travel = 1 }: { stage?: DeepClaimExpedition['stage']; now?: number; revision?: number; travel?: number } = {}): DeepClaimSnapshot {
  const snapshot = companySnapshot(revision); snapshot.server_now = at(now);
  let cursor = 0;
  const lengths = [travel, 2, 1196 - travel, 1, 1];
  const stages = (['travel', 'setup', 'work', 'haul', 'return'] as const).map((key, index) => {
    const start = cursor; cursor += lengths[index] * 1000;
    return { key, starts_at: at(start), ends_at: at(cursor) };
  });
  snapshot.expeditions = [{ id: 'crew-a', mode: 'explore', status: 'active', stage, worker_ids: ['worker-a'],
    target: { x: 47, y: 1 }, path: [{ x: 48, y: 0 }, { x: 48, y: 1 }, { x: 47, y: 1 }], stages,
    started_at: at(0), completes_at: at(1_200_000), duration_minutes: 20, duration_seconds: 1200,
    tutorial: false, wages: 2, energy_per_worker: 1, config_version: 1, cargo: null }];
  snapshot.workers[0].assigned_job_id = 'crew-a';
  validateDeepClaimSnapshot(snapshot);
  return snapshot;
}
function harness(snapshot = running()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  client.setQueryData(['deep-claim', wire.user, wire.club], snapshot);
  function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client, ...renderHook(() => useDeepClaim(), { wrapper: Wrapper }) };
}
const tick = (milliseconds: number) => act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
function setVisibility(next: DocumentVisibilityState) { visibility = next; document.dispatchEvent(new Event('visibilitychange')); }
beforeEach(() => {
  vi.useFakeTimers({ now: BASE, toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.clearAllMocks(); localStorage.clear(); wire.user = 'user-a'; wire.club = 'club-a'; wire.installed = true; visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); onlineManager.setOnline(true);
  wire.rpc.mockResolvedValue({ data: running(), error: null });
});
afterEach(() => {
  cleanup(); clients.splice(0).forEach(client => client.clear()); vi.useRealTimers(); vi.restoreAllMocks(); localStorage.clear(); onlineManager.setOnline(true);
  if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor); else delete (document as unknown as Record<string, unknown>).visibilityState;
  if (onlineDescriptor) Object.defineProperty(navigator, 'onLine', onlineDescriptor); else delete (navigator as unknown as Record<string, unknown>).onLine;
});

describe('Deep Claim authoritative declared-stage refresh', () => {
  it('reads at the nearest declared deadline and schedules the next stage only from the server response', async () => {
    const next = running({ stage: 'setup', now: 1000, revision: 2 });
    const work = running({ stage: 'work', now: 3000, revision: 3 });
    wire.rpc.mockResolvedValueOnce({ data: next, error: null }).mockResolvedValueOnce({ data: work, error: null });
    const { result } = harness(); await tick(999); expect(wire.rpc).not.toHaveBeenCalled(); expect(result.current.data?.expeditions[0].stage).toBe('travel');
    await tick(1); await tick(1); expect(wire.rpc).toHaveBeenCalledExactlyOnceWith('dc_get', {}); expect(result.current.data?.expeditions[0].stage).toBe('setup');
    const untilNext = Date.parse(next.expeditions[0].stages[1].ends_at) - result.current.serverNow();
    await tick(untilNext - 1); expect(wire.rpc).toHaveBeenCalledTimes(1);
    await tick(1); await tick(1); expect(wire.rpc).toHaveBeenCalledTimes(2); expect(result.current.data?.expeditions[0].stage).toBe('work');
    expect(result.current.data?.resources).toEqual({ stone: 8 }); expect(result.current.data?.company?.cash).toBe(180);
  });
  it('does not repeatedly read or advance a stale declared stage after its deadline', async () => {
    const initial = running(), original = JSON.stringify(initial), { result, rerender } = harness(initial);
    await tick(1000); await tick(0); expect(wire.rpc).toHaveBeenCalledTimes(1);
    rerender(); await tick(7000); expect(wire.rpc).toHaveBeenCalledTimes(1);
    expect(result.current.data?.expeditions[0].stage).toBe('travel'); expect(JSON.stringify(initial)).toBe(original);
  });
  it('leaves a failed boundary read to the existing bounded query retry instead of adding a timer retry loop', async () => {
    wire.rpc.mockResolvedValue({ data: null, error: { code: 'NETWORK' } });
    const { result } = harness(); await tick(1000); await tick(1000); await tick(0);
    expect(wire.rpc).toHaveBeenCalledTimes(2); expect(result.current.readOnly).toBe(true);
    await tick(6000); expect(wire.rpc).toHaveBeenCalledTimes(2); expect(result.current.data?.expeditions[0].stage).toBe('travel');
  });
  it('services distinct current crew deadlines once each even if the first response stays stale', async () => {
    const snapshot = running(); const second = running({ travel: 2 }).expeditions[0];
    snapshot.expeditions.push({ ...second, id: 'crew-b', worker_ids: ['worker-b'] }); snapshot.workers[1].assigned_job_id = 'crew-b';
    validateDeepClaimSnapshot(snapshot); wire.rpc.mockResolvedValue({ data: snapshot, error: null }); harness(snapshot);
    await tick(999); expect(wire.rpc).not.toHaveBeenCalled(); await tick(1); await tick(1); expect(wire.rpc).toHaveBeenCalledTimes(1);
    await tick(999); await tick(1); expect(wire.rpc).toHaveBeenCalledTimes(2); await tick(6000); expect(wire.rpc).toHaveBeenCalledTimes(2);
  });
  it('coalesces simultaneous declared crew boundaries into one authoritative read', async () => {
    const snapshot = running();
    snapshot.expeditions.push({ ...snapshot.expeditions[0], id: 'crew-b', worker_ids: ['worker-b'] }); snapshot.workers[1].assigned_job_id = 'crew-b';
    validateDeepClaimSnapshot(snapshot); wire.rpc.mockResolvedValue({ data: snapshot, error: null }); harness(snapshot);
    await tick(1000); await tick(1); expect(wire.rpc).toHaveBeenCalledExactlyOnceWith('dc_get', {});
    await tick(7000); expect(wire.rpc).toHaveBeenCalledTimes(1);
  });
  it('does not schedule hidden work and shares one fresh read when visibility returns after a boundary', async () => {
    visibility = 'hidden'; const { result } = harness(); await tick(4000); expect(wire.rpc).not.toHaveBeenCalled();
    act(() => { setVisibility('visible'); }); await tick(0);
    expect(wire.rpc).toHaveBeenCalledTimes(1); expect(result.current.data?.expeditions[0].stage).toBe('travel');
    await tick(1000); expect(wire.rpc).toHaveBeenCalledTimes(1);
  });
  it('cancels a scheduled deadline when the app backgrounds', async () => {
    harness(); await tick(500); act(() => { setVisibility('hidden'); }); await tick(5000); expect(wire.rpc).not.toHaveBeenCalled();
  });
  it('does not issue boundary reads while disconnected or after the asset is disabled', async () => {
    const { rerender } = harness(); await tick(400);
    act(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); onlineManager.setOnline(false); window.dispatchEvent(new Event('offline')); });
    await tick(2000); expect(wire.rpc).not.toHaveBeenCalled();
    wire.installed = false; rerender();
    act(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); onlineManager.setOnline(true); window.dispatchEvent(new Event('online')); });
    await tick(2000); expect(wire.rpc).not.toHaveBeenCalled();
  });
  it.each(['user', 'club'] as const)('cleans up an old %s scope and isolates a new company boundary', async field => {
    const { client, rerender } = harness(); await tick(400);
    const other = running({ travel: 2, now: 400 }); other.company!.id = 'company-b';
    if (field === 'user') { wire.user = 'user-b'; other.company!.user_id = wire.user; }
    else { wire.club = 'club-b'; other.company!.club_id = wire.club; }
    client.setQueryData(['deep-claim', wire.user, wire.club], other); wire.rpc.mockResolvedValue({ data: other, error: null }); rerender();
    await tick(600); expect(wire.rpc).not.toHaveBeenCalled();
    await tick(1000); await tick(0); expect(wire.rpc).toHaveBeenCalledExactlyOnceWith('dc_get', {});
  });
  it('removes its deadline on unmount without issuing a late read', async () => {
    const { unmount } = harness(); await tick(500); unmount(); await tick(8000); expect(wire.rpc).not.toHaveBeenCalled();
  });
  it('joins an existing read at a boundary without cancelling or duplicating it', async () => {
    let finish!: (value: { data: DeepClaimSnapshot; error: null }) => void;
    wire.rpc.mockImplementation(() => new Promise(done => { finish = done; }));
    const { result } = harness(); await tick(900);
    let refresh!: Promise<void>; act(() => { refresh = result.current.refresh(); }); await tick(100);
    expect(wire.rpc).toHaveBeenCalledTimes(1); expect(result.current.data?.expeditions[0].stage).toBe('travel');
    await act(async () => { finish({ data: running({ stage: 'setup', now: 1000, revision: 2 }), error: null }); await refresh; });
    await tick(0); expect(wire.rpc).toHaveBeenCalledTimes(1); expect(result.current.data?.expeditions[0].stage).toBe('setup');
  });
  it('uses the monotonic server estimate instead of a changed device calendar', async () => {
    harness(); vi.setSystemTime(BASE + 86_400_000); await tick(999); expect(wire.rpc).not.toHaveBeenCalled();
    await tick(1); expect(wire.rpc).toHaveBeenCalledTimes(1);
  });
});
