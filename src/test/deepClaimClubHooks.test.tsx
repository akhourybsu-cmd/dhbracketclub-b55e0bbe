import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeepClaim } from '@/hooks/useDeepClaim';
import { useDeepClaimClub } from '@/hooks/useDeepClaimClub';
import { shareDeepClaimClubView } from '@/lib/deepClaim/service';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';
import { phaseFiveClubView } from './fixtures/deepClaimPhase5';

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
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); wire.user = 'user-a'; wire.club = 'club-a'; wire.installed = true;
  onlineManager.setOnline(true); Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  wire.rpc.mockResolvedValue({ data: phaseFiveClubView(), error: null });
});
afterEach(() => { cleanup(); localStorage.clear(); });

describe('Deep Claim optional club query and durable social decisions', () => {
  it('does not load club records while closed or uninstalled, even with a prior cached view', () => {
    const { client, Wrapper } = harness(); client.setQueryData(['deep-claim-club','user-a','club-a','weekly_mining_value',0], phaseFiveClubView());
    const hook = renderHook(({ enabled }) => useDeepClaimClub({ enabled }), { wrapper: Wrapper, initialProps: { enabled: false } });
    expect(hook.result.current.data).toBeNull(); expect(wire.rpc).not.toHaveBeenCalled();
    wire.installed = false; hook.rerender({ enabled: true });
    expect(hook.result.current.data).toBeNull(); expect(hook.result.current.readOnly).toBe(true); expect(wire.rpc).not.toHaveBeenCalled();
  });
  it('sends only the selected public board and page, leaving club ownership to the server', async () => {
    wire.rpc.mockResolvedValue({ data: phaseFiveClubView({ metric: 'operational_depth' }), error: null });
    const { Wrapper } = harness(), hook = renderHook(() => useDeepClaimClub({ enabled: true, metric: 'operational_depth' }), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.data?.metric).toBe('operational_depth'));
    expect(wire.rpc).toHaveBeenCalledWith('dc_get_club', { p_metric: 'operational_depth', p_page: 0 });
  });
  it('hides a wrong-club response instead of displaying another club’s identities', async () => {
    const wrong = phaseFiveClubView(); wrong.club_id = 'other-club'; wire.rpc.mockResolvedValue({ data: wrong, error: null });
    const { Wrapper } = harness(), hook = renderHook(() => useDeepClaimClub({ enabled: true }), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.error).toContain('active account and club'));
    expect(hook.result.current.data).toBeNull(); expect(hook.result.current.readOnly).toBe(true);
  });
  it('refreshes private state when a club read reconciles a newer company revision, including initial-load races', async () => {
    let reads = 0;
    wire.rpc.mockImplementation(async (name: string) => ({ data: name === 'dc_get' ? phaseFourSnapshot(++reads === 1 ? 4 : 5) : phaseFiveClubView({ ownRevision: 5 }), error: null }));
    const { Wrapper } = harness(), hook = renderHook(() => ({ company: useDeepClaim(), club: useDeepClaimClub({ enabled: true }) }), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.company.data?.revision).toBe(5));
    expect(hook.result.current.club.data?.own_revision).toBe(5); expect(reads).toBe(2);
  });
  it('keeps cached club records read-only while disconnected and does not claim an unsent action is saved', async () => {
    const { Wrapper } = harness(), hook = renderHook(() => useDeepClaimClub({ enabled: true }), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.data?.version).toBe(1));
    act(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')); });
    expect(hook.result.current.data?.version).toBe(1); expect(hook.result.current.readOnly).toBe(true);
    expect(hook.result.current.error).toContain('Connect to the internet'); expect(hook.result.current.error).not.toContain('saved');
  });
  it('keeps club cache identities separate when the active club changes', async () => {
    wire.rpc.mockImplementation(async () => ({ data: { ...phaseFiveClubView(), club_id: wire.club }, error: null }));
    const { Wrapper } = harness(), hook = renderHook(() => useDeepClaimClub({ enabled: true }), { wrapper: Wrapper });
    await waitFor(() => expect(hook.result.current.data?.club_id).toBe('club-a'));
    wire.club = 'club-b'; hook.rerender();
    expect(hook.result.current.data?.club_id).not.toBe('club-a');
    await waitFor(() => expect(hook.result.current.data?.club_id).toBe('club-b'));
  });
  it('does not restore older sharing or project state from an earlier background read', () => {
    const before = phaseFiveClubView({ ownRevision: 5 }), older = phaseFiveClubView({ ownRevision: 4 });
    before.own.standings_enabled = true;
    expect(shareDeepClaimClubView(before, older)).toBe(before);
    const next = { ...before, server_now: '2026-11-02T12:00:01Z' };
    expect(shareDeepClaimClubView(before, next)).toBe(next);
  });
  it.each(['sharing','contribution','claim'] as const)('recovers %s after a committed lost acknowledgement using exactly the original request', async kind => {
    const endpoint = kind === 'sharing' ? 'dc_set_social_preferences' : kind === 'contribution' ? 'dc_contribute_project' : 'dc_claim_project';
    let server = phaseFourSnapshot(), lost = true;
    wire.rpc.mockImplementation(async (name: string) => {
      if (name === endpoint && lost) { lost = false; server = phaseFourSnapshot(5); return { data: null, error: { code: 'NETWORK' } }; }
      return { data: server, error: null };
    });
    const first = harness(), hook = renderHook(() => useDeepClaim(), { wrapper: first.Wrapper });
    await waitFor(() => expect(hook.result.current.data?.revision).toBe(4));
    const perform = () => kind === 'sharing' ? hook.result.current.setSocialPreferences({ standings_enabled: false, showcase_enabled: false, featured_discovery_ids: [] }, 3)
      : kind === 'contribution' ? hook.result.current.contributeProject('camp_supply', { stone: 3 }, 3) : hook.result.current.claimProject('camp_supply', 3);
    await act(async () => { await expect(perform()).rejects.toThrow('safe retry'); });
    const original = wire.rpc.mock.calls.find(([name]) => name === endpoint);
    expect(original?.[1]).toMatchObject({ p_expected_revision: 3, p_request_id: expect.any(String) });
    expect(original?.[1]).not.toHaveProperty('p_score'); expect(original?.[1]).not.toHaveProperty('p_reward');
    hook.unmount(); first.client.clear();
    const next = harness(), invalidate = vi.spyOn(next.client, 'invalidateQueries');
    const resumed = renderHook(() => useDeepClaim(), { wrapper: next.Wrapper });
    await waitFor(() => expect(resumed.result.current.data?.revision).toBe(5));
    expect(resumed.result.current.readOnly).toBe(true);
    await act(async () => { await resumed.result.current.retryPending(); });
    expect(wire.rpc.mock.calls.filter(([name]) => name === endpoint)).toEqual([original, original]);
    expect(resumed.result.current.pendingAction).toBeNull(); expect(invalidate).toHaveBeenCalledWith({ queryKey: ['deep-claim-club','user-a','club-a'] });
  });
});
