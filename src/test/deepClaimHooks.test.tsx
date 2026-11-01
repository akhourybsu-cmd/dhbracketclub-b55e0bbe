import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDeepClaim } from '@/hooks/useDeepClaim';
import { companySnapshot } from './fixtures/deepClaim';
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
