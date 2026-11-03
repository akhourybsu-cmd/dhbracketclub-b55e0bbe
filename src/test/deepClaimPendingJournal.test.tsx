import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeepClaim } from '@/hooks/useDeepClaim';
import { clearPendingJournal, pendingPointerKey, readPendingJournal, resetPendingJournalMemory, writePendingJournal, type DeepClaimPending } from '@/lib/deepClaim/pendingJournal';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';

const wire = vi.hoisted(() => ({ rpc: vi.fn(), user: 'user-a', club: 'club-a' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: wire.rpc } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: wire.user }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: wire.club }, loading: false }) }));
vi.mock('@/hooks/useClubAssets', () => ({ useClubAssets: () => ({ loading: false, isInstalled: () => true }) }));

const POINTER = pendingPointerKey('user-a', 'club-a');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const entry = (id: string, label: string, createdAt: number): DeepClaimPending => ({ operation: 'dc_upgrade', args: { p_building_key: label, p_expected_revision: 3, p_request_id: id }, fingerprint: JSON.stringify(['dc_upgrade', label]), label: 'Upgrade building', createdAt });
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return { client, Wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); resetPendingJournalMemory(); onlineManager.setOnline(true);
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); wire.rpc.mockResolvedValue({ data: phaseFourSnapshot(), error: null }); });
afterEach(() => { cleanup(); localStorage.clear(); });

describe('Deep Claim pending-action journal', () => {
  it('keeps one tab\'s uncertain receipt when another tab clears its own', () => {
    writePendingJournal(POINTER, entry(A, 'mine_shaft', 1));
    writePendingJournal(POINTER, entry(B, 'yard', 2));
    expect(JSON.parse(localStorage.getItem(POINTER)!).args.p_request_id).toBe(A);
    clearPendingJournal(POINTER, B);
    expect(readPendingJournal(POINTER).map(e => e.args.p_request_id)).toEqual([A]);
    expect(JSON.parse(localStorage.getItem(POINTER)!).args.p_request_id).toBe(A);
    writePendingJournal(POINTER, entry(B, 'yard', 2));
    clearPendingJournal(POINTER, A);
    // Pointer moves to the remaining request instead of disappearing.
    expect(JSON.parse(localStorage.getItem(POINTER)!).args.p_request_id).toBe(B);
    expect(localStorage.getItem(`${POINTER}:${A}`)).toBeNull();
  });
  it('migrates a legacy pointer-only receipt into a leaf and ignores corrupt or oversized entries', () => {
    localStorage.setItem(POINTER, JSON.stringify(entry(A, 'mine_shaft', 0)));
    localStorage.setItem(`${POINTER}:${B}`, '{not json');
    localStorage.setItem(`${POINTER}:33333333-3333-4333-8333-333333333333`, JSON.stringify({ ...entry('33333333-3333-4333-8333-333333333333', 'x', 0), label: 'x'.repeat(500) }));
    expect(readPendingJournal(POINTER).map(e => e.args.p_request_id)).toEqual([A]);
    expect(localStorage.getItem(`${POINTER}:${A}`)).not.toBeNull();
  });
  it('a second mounted hook sees the first hook\'s uncertain action, blocks new actions, and retries the exact request', async () => {
    let lost = true; const server = phaseFourSnapshot();
    wire.rpc.mockImplementation(async (name: string) => {
      if (name === 'dc_upgrade' && lost) { lost = false; return { data: null, error: { code: 'NETWORK' } }; }
      return { data: server, error: null };
    });
    const one = wrapper(), two = wrapper();
    const first = renderHook(() => useDeepClaim(), { wrapper: one.Wrapper });
    const second = renderHook(() => useDeepClaim(), { wrapper: two.Wrapper });
    await waitFor(() => expect(second.result.current.data).not.toBeNull());
    await act(async () => { await expect(first.result.current.upgrade('mine_shaft')).rejects.toThrow(); });
    await waitFor(() => expect(second.result.current.pendingAction).toBe('Upgrade building'));
    await act(async () => { await expect(second.result.current.sell({ resource_key: 'stone', quantity: 1 })).rejects.toThrow('earlier action'); });
    expect(wire.rpc.mock.calls.some(([name]) => name === 'dc_sell')).toBe(false);
    await act(async () => { await second.result.current.retryPending(); });
    const upgrades = wire.rpc.mock.calls.filter(([name]) => name === 'dc_upgrade');
    expect(upgrades).toHaveLength(2); expect(upgrades[1][1]).toEqual(upgrades[0][1]);
    await waitFor(() => expect(first.result.current.pendingAction).toBeNull());
    expect(readPendingJournal(POINTER)).toEqual([]);
  });
  it('treats a foreign returned snapshot as uncertain and keeps the receipt', async () => {
    const foreign = phaseFourSnapshot();
    wire.rpc.mockImplementation(async (name: string) => name === 'dc_upgrade'
      ? { data: { ...foreign, company: { ...foreign.company!, user_id: 'user-b' } }, error: null } : { data: phaseFourSnapshot(), error: null });
    const { Wrapper } = wrapper(); const { result } = renderHook(() => useDeepClaim(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    await act(async () => { await expect(result.current.upgrade('mine_shaft')).rejects.toThrow('could not be verified'); });
    expect(result.current.pendingAction).toBe('Upgrade building');
    expect(readPendingJournal(POINTER)).toHaveLength(1);
    expect(result.current.data?.company?.user_id).toBe('user-a');
  });
  it('returns the newer accepted cache snapshot when a replayed receipt answers with an older revision', async () => {
    wire.rpc.mockImplementation(async (name: string) => name === 'dc_upgrade' ? { data: phaseFourSnapshot(3), error: null } : { data: phaseFourSnapshot(7), error: null });
    const { Wrapper } = wrapper(); const { result } = renderHook(() => useDeepClaim(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.revision).toBe(7));
    let returned: { revision: number } | null = null;
    await act(async () => { returned = await result.current.upgrade('mine_shaft'); });
    expect(returned!.revision).toBe(7); expect(result.current.data?.revision).toBe(7);
  });
});
