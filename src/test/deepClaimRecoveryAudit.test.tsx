import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeepClaim } from '@/hooks/useDeepClaim';
import { forgetPendingAction, readPendingActions, rememberPendingAction, type DeepClaimPendingAction } from '@/lib/deepClaim/pendingActions';
import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { companySnapshot } from './fixtures/deepClaim';

const wire = vi.hoisted(() => ({ rpc: vi.fn(), user: 'user-a', club: 'club-a', installed: true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: wire.rpc } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: wire.user }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: wire.club }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => wire.installed }) }));

const receiptKey = 'dh:deep-claim:pending:v1:user-a:club-a';
const companyKey = ['deep-claim', 'user-a', 'club-a'] as const;
const firstId = '00000000-0000-4000-8000-000000000041';
const secondId = '00000000-0000-4000-8000-000000000042';
function pending(id = firstId, quantity = 3): DeepClaimPendingAction {
  const args = { p_resource_key: 'stone', p_quantity: quantity, p_expected_revision: 1 };
  return { operation: 'dc_sell', args: { ...args, p_request_id: id }, fingerprint: JSON.stringify(['dc_sell', args]), label: 'Sell materials' };
}
function storageEvent(key: string | null) {
  window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }));
}
function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
  return { client, Wrapper };
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); wire.user = 'user-a'; wire.club = 'club-a'; wire.installed = true;
  onlineManager.setOnline(true); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  wire.rpc.mockResolvedValue({ data: companySnapshot(), error: null });
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe('Deep Claim multi-tab recovery audit', () => {
  it('synchronizes an uncertain action across two mounted hooks before permitting a different purchase', async () => {
    let lost = true;
    wire.rpc.mockImplementation(async (name: string) => {
      if (name === 'dc_sell' && lost) { lost = false; return { data: null, error: { code: 'NETWORK' } }; }
      return { data: companySnapshot(name === 'dc_sell' ? 2 : 1), error: null };
    });
    const first = harness(), second = harness();
    const a = renderHook(() => useDeepClaim(), { wrapper: first.Wrapper });
    const b = renderHook(() => useDeepClaim(), { wrapper: second.Wrapper });
    await waitFor(() => expect(a.result.current.data?.revision).toBe(1));
    await waitFor(() => expect(b.result.current.data?.revision).toBe(1));
    await act(async () => { await expect(a.result.current.sell({ resource_key: 'stone', quantity: 3 })).rejects.toThrow('safe retry'); });
    expect(a.result.current.pendingAction).toBe('Sell materials');
    expect(b.result.current.pendingAction).toBe('Sell materials'); expect(b.result.current.readOnly).toBe(true);
    await act(async () => { await expect(b.result.current.upgrade('warehouse')).rejects.toThrow('earlier action'); });
    expect(wire.rpc.mock.calls.filter(([name]) => name === 'dc_upgrade')).toHaveLength(0);
    const original = wire.rpc.mock.calls.find(([name]) => name === 'dc_sell');
    await act(async () => { await b.result.current.retryPending(); });
    expect(wire.rpc.mock.calls.filter(([name]) => name === 'dc_sell')).toEqual([original, original]);
    expect(a.result.current.pendingAction).toBeNull(); expect(b.result.current.pendingAction).toBeNull();
    expect(readPendingActions(receiptKey)).toEqual([]);
  });

  it('checks durable storage again before writing even without a delivered storage event', async () => {
    const { Wrapper } = harness(), hook = renderHook(() => useDeepClaim(), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.data?.revision).toBe(1));
    const saved = pending(); rememberPendingAction(receiptKey, saved);
    expect(hook.result.current.pendingAction).toBeNull();
    await act(async () => { await expect(hook.result.current.upgrade('warehouse')).rejects.toThrow('earlier action'); });
    expect(readPendingActions(receiptKey)).toEqual([saved]);
    expect(hook.result.current.pendingAction).toBe('Sell materials');
    expect(wire.rpc.mock.calls.filter(([name]) => name === 'dc_upgrade')).toHaveLength(0);
  });

  it.each(['acknowledged', 'rejected'] as const)('clears only its own %s UUID when two recoverable actions are queued', async outcome => {
    const first = pending(), second = pending(secondId, 5);
    rememberPendingAction(receiptKey, first);
    const firstHarness = harness(), a = renderHook(() => useDeepClaim(), { wrapper: firstHarness.Wrapper });
    await waitFor(() => expect(a.result.current.data?.revision).toBe(1));
    act(() => { rememberPendingAction(receiptKey, second); storageEvent(receiptKey); });
    const secondHarness = harness(), b = renderHook(() => useDeepClaim(), { wrapper: secondHarness.Wrapper });
    await waitFor(() => expect(b.result.current.data?.revision).toBe(1));
    wire.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => name === 'dc_sell'
      ? args.p_request_id === firstId && outcome === 'rejected'
        ? { data: null, error: { code: '40001' } }
        : { data: companySnapshot(args.p_request_id === firstId ? 2 : 3), error: null }
      : { data: companySnapshot(), error: null });
    await act(async () => {
      if (outcome === 'rejected') await expect(a.result.current.retryPending()).rejects.toThrow('another device');
      else await a.result.current.retryPending();
    });
    expect(wire.rpc.mock.calls.filter(([name]) => name === 'dc_sell')).toEqual([['dc_sell', first.args]]);
    expect(readPendingActions(receiptKey)).toEqual([second]);
    expect(a.result.current.readOnly).toBe(true); expect(b.result.current.readOnly).toBe(true);
    await act(async () => { await b.result.current.retryPending(); });
    expect(wire.rpc.mock.calls.filter(([name]) => name === 'dc_sell')).toEqual([['dc_sell', first.args], ['dc_sell', second.args]]);
    expect(readPendingActions(receiptKey)).toEqual([]);
    expect(a.result.current.pendingAction).toBeNull(); expect(b.result.current.pendingAction).toBeNull();
  });

  it('responds to scoped leaf, pointer and clear events while ignoring another club’s journal', async () => {
    const { Wrapper } = harness(), hook = renderHook(() => useDeepClaim(), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.data?.revision).toBe(1));
    rememberPendingAction(receiptKey, pending());
    act(() => { storageEvent('dh:deep-claim:pending:v1:user-a:other-club'); });
    expect(hook.result.current.pendingAction).toBeNull();
    act(() => { storageEvent(`${receiptKey}:request:${firstId}`); });
    expect(hook.result.current.pendingAction).toBe('Sell materials'); expect(hook.result.current.readOnly).toBe(true);
    act(() => { forgetPendingAction(receiptKey, firstId); storageEvent(receiptKey); });
    expect(hook.result.current.pendingAction).toBeNull();
    act(() => { rememberPendingAction(receiptKey, pending()); storageEvent(receiptKey); });
    expect(hook.result.current.pendingAction).toBe('Sell materials');
    act(() => { localStorage.clear(); storageEvent(null); });
    expect(hook.result.current.pendingAction).toBeNull(); expect(hook.result.current.readOnly).toBe(false);
    expect(wire.rpc.mock.calls.every(([name]) => name === 'dc_get')).toBe(true);
  });

  it.each(['user', 'club'] as const)('retains an uncertain intent when a mutation returns another %s’s snapshot', async scope => {
    const foreign = companySnapshot(2);
    if (scope === 'user') foreign.company!.user_id = 'another-user'; else foreign.company!.club_id = 'another-club';
    wire.rpc.mockImplementation(async (name: string) => ({ data: name === 'dc_sell' ? foreign : companySnapshot(), error: null }));
    const { Wrapper } = harness(), hook = renderHook(() => useDeepClaim(), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.data?.revision).toBe(1));
    await act(async () => { await expect(hook.result.current.sell({ resource_key: 'stone', quantity: 3 })).rejects.toMatchObject({ code: 'data' }); });
    const original = wire.rpc.mock.calls.find(([name]) => name === 'dc_sell');
    expect(hook.result.current.pendingAction).toBe('Sell materials'); expect(hook.result.current.readOnly).toBe(true);
    expect(hook.result.current.data?.company).toMatchObject({ user_id: 'user-a', club_id: 'club-a' });
    expect(readPendingActions(receiptKey)[0]?.args).toEqual(original?.[1]);
    wire.rpc.mockResolvedValue({ data: companySnapshot(2), error: null });
    await act(async () => { await hook.result.current.retryPending(); });
    expect(wire.rpc.mock.calls.filter(([name]) => name === 'dc_sell')).toEqual([original, original]);
    expect(hook.result.current.pendingAction).toBeNull();
  });

  it('returns the newer cached company when an exact old receipt replay acknowledges an older snapshot', async () => {
    rememberPendingAction(receiptKey, pending());
    const current = companySnapshot(9); current.company!.cash = 333;
    const old = companySnapshot(2); old.company!.cash = 183;
    wire.rpc.mockResolvedValue({ data: old, error: null });
    const { client, Wrapper } = harness(); client.setQueryData(companyKey, current);
    const hook = renderHook(() => useDeepClaim(), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.data?.revision).toBe(9));
    let result: DeepClaimSnapshot | null | undefined;
    await act(async () => { result = await hook.result.current.retryPending(); });
    expect(result).toMatchObject({ revision: 9, company: { cash: 333 } });
    expect(hook.result.current.data?.revision).toBe(9);
    expect(client.getQueryData<DeepClaimSnapshot>(companyKey)?.company?.cash).toBe(333);
    expect(hook.result.current.pendingAction).toBeNull();
    expect(wire.rpc.mock.calls).toEqual([['dc_sell', pending().args]]);
  });
});
