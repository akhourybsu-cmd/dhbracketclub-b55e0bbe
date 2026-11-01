import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeepClaim } from '@/hooks/useDeepClaim';
import { companySnapshot } from './fixtures/deepClaim';
import { phaseTwoSnapshot } from './fixtures/deepClaimPhase2';
import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';
const wire = vi.hoisted(() => ({ rpc: vi.fn(), user: 'user-a', club: 'club-a', installed: true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: wire.rpc } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: wire.user }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: wire.club }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => wire.installed }) }));
function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client, Wrapper };
}
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); wire.user = 'user-a'; wire.club = 'club-a'; wire.installed = true;
  onlineManager.setOnline(true); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); wire.rpc.mockResolvedValue({ data: companySnapshot(), error: null }); });
afterEach(() => { cleanup(); localStorage.clear(); });
describe('Deep Claim company query and transaction recovery', () => {
  it.each([
    ['dc_start_production', { p_recipe_key: 'smelt_copper', p_batches: 2, p_expected_revision: 1 }, 'Start production'],
    ['dc_hire', { p_candidate_id: 'candidate-a', p_expected_revision: 1 }, 'Hire employee'],
    ['dc_train', { p_worker_id: 'worker-a', p_stat: 'mining', p_expected_revision: 1 }, 'Train employee'],
    ['dc_assign_equipment', { p_item_id: 'item-a', p_worker_id: null, p_expected_revision: 1 }, 'Assign equipment'],
    ['dc_repair_equipment', { p_item_id: 'item-a', p_expected_revision: 1 }, 'Repair equipment'],
    ['dc_retire_equipment', { p_item_id: 'item-a', p_expected_revision: 1 }, 'Retire equipment'],
    ['dc_collect_production', { p_job_id: 'production-a' }, 'Collect production'],
  ] as const)('recovers a persisted %s request with its exact identity after a reload', async (operation, args, label) => {
    const request = { ...args, p_request_id: '00000000-0000-4000-8000-000000000090' };
    localStorage.setItem('dh:deep-claim:pending:v1:user-a:club-a', JSON.stringify({ operation, args: request, label, fingerprint: JSON.stringify([operation, args]) }));
    const { Wrapper } = harness(); const { result } = renderHook(() => useDeepClaim(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.revision).toBe(1));
    expect(result.current.readOnly).toBe(true); expect(result.current.pendingAction).toBe(label);
    await act(async () => { await result.current.retryPending(); });
    expect(wire.rpc).toHaveBeenCalledWith(operation, request);
    expect(result.current.pendingAction).toBeNull();
    expect(localStorage.getItem('dh:deep-claim:pending:v1:user-a:club-a')).toBeNull();
  });
  it('keeps a confirmed crafting request recoverable when its version-two response is corrupted', async () => {
    const snapshot = phaseTwoSnapshot();
    wire.rpc.mockImplementation(async (name: string) => ({ data: name === 'dc_start_production'
      ? { ...snapshot, equipment_catalog: [] } : snapshot, error: null }));
    const { Wrapper } = harness(); const { result } = renderHook(() => useDeepClaim(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.schema_version).toBe(2));
    await act(async () => { await expect(result.current.startProduction('smelt_copper', 1)).rejects.toThrow('could not be verified'); });
    const first = wire.rpc.mock.calls.find(([name]) => name === 'dc_start_production');
    expect(result.current.pendingAction).toBe('Start production'); expect(result.current.readOnly).toBe(true);
    wire.rpc.mockResolvedValue({ data: phaseTwoSnapshot(3), error: null });
    await act(async () => { await result.current.retryPending(); });
    const attempts = wire.rpc.mock.calls.filter(([name]) => name === 'dc_start_production');
    expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(first);
    expect(result.current.pendingAction).toBeNull(); expect(result.current.data?.revision).toBe(3);
  });
  it('clears an explicitly rejected daily training attempt so the worker can be reviewed again', async () => {
    const snapshot = phaseTwoSnapshot();
    wire.rpc.mockImplementation(async (name: string) => name === 'dc_train'
      ? { data: null, error: { code: 'P0001', message: 'This worker already trained today.' } }
      : { data: snapshot, error: null });
    const { Wrapper } = harness(); const { result } = renderHook(() => useDeepClaim(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.schema_version).toBe(2));
    await act(async () => { await expect(result.current.train(snapshot.workers[0].id, 'mining')).rejects.toThrow('already trained'); });
    expect(result.current.pendingAction).toBeNull();
    expect(localStorage.getItem('dh:deep-claim:pending:v1:user-a:club-a')).toBeNull();
    expect(result.current.error).toContain('already trained');
  });
  it('shows an actionable connection state instead of perpetual loading when first opened offline', () => {
    onlineManager.setOnline(false); Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const { Wrapper } = harness(); const { result } = renderHook(() => useDeepClaim(), { wrapper: Wrapper });
    expect(result.current.loading).toBe(false); expect(result.current.error).toContain('Connect to the internet');
    expect(result.current.readOnly).toBe(true); expect(wire.rpc).not.toHaveBeenCalled();
  });
  it('does not issue company reads while the club asset is unavailable', () => {
    wire.installed = false; const { Wrapper } = harness(); const { result } = renderHook(() => useDeepClaim(), { wrapper: Wrapper });
    expect(result.current.data).toBeNull(); expect(result.current.readOnly).toBe(true); expect(wire.rpc).not.toHaveBeenCalled();
  });
  it('keeps confirmed state read-only when disconnected and refuses economic writes', async () => {
    const { Wrapper } = harness(); const { result } = renderHook(() => useDeepClaim(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.company?.cash).toBe(180));
    act(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')); });
    expect(result.current.readOnly).toBe(true);
    await expect(result.current.sell({ resource_key: 'stone', quantity: 1 })).rejects.toThrow('Connect to the internet');
    expect(wire.rpc.mock.calls.every(([name]) => name === 'dc_get')).toBe(true);
  });
  it('persists an unacknowledged sale across reload and retries the exact request without selling twice', async () => {
    let server = companySnapshot(), lost = true;
    wire.rpc.mockImplementation(async (name: string) => {
      if (name === 'dc_sell') {
        if (lost) { lost = false; server = companySnapshot(2); server.company!.cash = 183; server.resources.stone = 5; server.company!.warehouse_used = 5;
          return { data: null, error: { message: 'Response lost', code: 'NETWORK' } }; }
        return { data: server, error: null };
      }
      return { data: server, error: null };
    });
    const first = harness(); const hook = renderHook(() => useDeepClaim(), { wrapper: first.Wrapper });
    await waitFor(() => expect(hook.result.current.data?.revision).toBe(1));
    await act(async () => { await expect(hook.result.current.sell({ resource_key: 'stone', quantity: 3 })).rejects.toThrow('safe retry'); });
    expect(hook.result.current.pendingAction).toBe('Sell materials'); hook.unmount(); first.client.clear();
    const next = harness(); const restored = renderHook(() => useDeepClaim(), { wrapper: next.Wrapper });
    await waitFor(() => expect(restored.result.current.data?.revision).toBe(2));
    expect(restored.result.current.readOnly).toBe(true);
    await act(async () => { await restored.result.current.retryPending(); });
    expect(restored.result.current.pendingAction).toBeNull(); expect(restored.result.current.data?.company?.cash).toBe(183);
    const sales = wire.rpc.mock.calls.filter(([name]) => name === 'dc_sell');
    expect(sales).toHaveLength(2); expect(sales[0][1]).toEqual(sales[1][1]);
    expect(localStorage.getItem('dh:deep-claim:pending:v1:user-a:club-a')).toBeNull();
  });
  it('blocks a second concurrent purchase and retires a rejected stale revision', async () => {
    let resolve!: (value: { data: DeepClaimSnapshot | null; error: unknown }) => void;
    wire.rpc.mockImplementation((name: string) => name === 'dc_upgrade' ? new Promise(done => { resolve = done; }) : Promise.resolve({ data: companySnapshot(), error: null }));
    const { Wrapper } = harness(); const { result } = renderHook(() => useDeepClaim(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.revision).toBe(1));
    let purchase!: Promise<DeepClaimSnapshot>;
    act(() => { purchase = result.current.upgrade('warehouse'); });
    await expect(result.current.upgrade('mine_shaft')).rejects.toThrow('still saving');
    await act(async () => { resolve({ data: null, error: { code: '40001' } }); await expect(purchase).rejects.toThrow('another device'); });
    expect(result.current.pendingAction).toBeNull(); expect(wire.rpc.mock.calls.filter(([name]) => name === 'dc_upgrade')).toHaveLength(1);
  });
});
