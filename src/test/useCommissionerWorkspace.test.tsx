import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommissionerWorkspace } from '@/hooks/useCommissionerWorkspace';
import type { CommissionerMutationResult, CommissionerWorkspaceData } from '@/lib/draft/commissioner';
import { commissionerFixture } from './fixtures/commissionerWorkspace';

const wire = vi.hoisted(() => ({ userId: 'a', clubId: 'club-1', fetch: vi.fn(), mutate: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: wire.userId }, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: wire.clubId }, loading: false }) }));
vi.mock('@/lib/draft/commissioner', async () => ({
  ...await vi.importActual<typeof import('@/lib/draft/commissioner')>('@/lib/draft/commissioner'),
  fetchCommissionerWorkspace: wire.fetch, mutateCommissioner: wire.mutate,
}));
function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const saved: CommissionerMutationResult = { ok: true, record: null, audit_id: 'audit-1' };
beforeEach(() => {
  vi.resetAllMocks(); wire.userId = 'a'; wire.clubId = 'club-1';
  wire.fetch.mockResolvedValue(commissionerFixture()); wire.mutate.mockResolvedValue(saved);
});
afterEach(cleanup);

describe('commissioner workspace lifecycle', () => {
  it('retains verified cached data after a background read fails and exposes a separate refresh error', async () => {
    const { result } = renderHook(() => useCommissionerWorkspace('s1'));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    const data = result.current.data;
    wire.fetch.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { await result.current.refresh(); });
    expect(result.current.data).toBe(data);
    expect(result.current.error).toMatch(/could not be loaded/);
    expect(result.current.loading).toBe(false); expect(result.current.refreshing).toBe(false);
  });

  it('clears data on an account/club change and ignores prior-scope reads and saved callback invocations', async () => {
    const old = pending<CommissionerWorkspaceData>();
    wire.fetch.mockReturnValueOnce(old.promise).mockResolvedValueOnce(commissionerFixture());
    const { result, rerender } = renderHook(() => useCommissionerWorkspace('s1'));
    const oldMutate = result.current.mutate;
    wire.userId = 'b'; wire.clubId = 'club-2'; rerender();
    await waitFor(() => expect(result.current.data).not.toBeNull());
    const current = result.current.data;
    const stale = commissionerFixture(); stale.season.name = 'Old private season';
    await act(async () => { old.resolve(stale); });
    expect(result.current.data).toBe(current);
    expect(result.current.data!.season.name).not.toBe('Old private season');
    await expect(oldMutate('add_adjustment', { user_id: 'a', delta: 1 }, 'A reason')).rejects.toThrow('active commissioner workspace');
    expect(wire.mutate).not.toHaveBeenCalled();
    expect(wire.fetch).toHaveBeenLastCalledWith('club-2', 's1');
  });

  it('hides the previous season immediately and does no private reads while disabled', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useCommissionerWorkspace('s1', enabled), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    const requests = wire.fetch.mock.calls.length;
    rerender({ enabled: false });
    expect(result.current.data).toBeNull(); expect(result.current.canManage).toBe(false);
    expect(result.current.points).toEqual([]); expect(wire.fetch).toHaveBeenCalledTimes(requests);
  });

  it('keeps the same intent UUID across failed transport retries and creates a fresh UUID after a committed intent', async () => {
    const { result } = renderHook(() => useCommissionerWorkspace('s1'));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    wire.mutate.mockRejectedValueOnce(new Error('Connection interrupted'));
    const payload = { user_id: 'a', delta: 2 };
    await act(async () => { await expect(result.current.mutate('add_adjustment', payload, 'Correct ruling')).rejects.toThrow('Connection interrupted'); });
    expect(result.current.busy).toBe(false);
    await act(async () => { await result.current.mutate('add_adjustment', payload, 'Correct ruling'); });
    expect(wire.mutate.mock.calls[0][4]).toBe(wire.mutate.mock.calls[1][4]);
    await act(async () => { await result.current.mutate('add_adjustment', payload, 'Correct ruling'); });
    expect(wire.mutate.mock.calls[2][4]).not.toBe(wire.mutate.mock.calls[1][4]);
  });

  it('reports mutation success separately from a failed post-save refresh so the write is not repeated', async () => {
    const { result } = renderHook(() => useCommissionerWorkspace('s1'));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    wire.fetch.mockRejectedValueOnce(new Error('Read unavailable'));
    await act(async () => { await expect(result.current.mutate('send_reminder', { kind: 'pick', draft_id: 'd1', target_user_id: 'a' }, 'Please take your pick')).resolves.toEqual(saved); });
    expect(result.current.error).toMatch(/could not be loaded/);
    expect(result.current.mutationError).toBeNull(); expect(result.current.data).not.toBeNull();
    expect(wire.mutate).toHaveBeenCalledTimes(1);
  });

  it('prevents simultaneous writes and ignores an old mutation completion after a scope switch', async () => {
    const mutation = pending<CommissionerMutationResult>();
    const { result, rerender } = renderHook(() => useCommissionerWorkspace('s1'));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    wire.mutate.mockReturnValueOnce(mutation.promise);
    let request!: Promise<CommissionerMutationResult>;
    act(() => { request = result.current.mutate('add_adjustment', { user_id: 'a', delta: 1 }, 'A reason'); });
    await expect(result.current.mutate('add_adjustment', { user_id: 'a', delta: 1 }, 'A reason')).rejects.toThrow('still saving');
    wire.clubId = 'club-2'; rerender();
    await waitFor(() => expect(result.current.data).not.toBeNull());
    const fetchCount = wire.fetch.mock.calls.length;
    await act(async () => { mutation.resolve(saved); await request; });
    expect(wire.fetch).toHaveBeenCalledTimes(fetchCount); expect(result.current.busy).toBe(false);
  });

  it('does not let an older mutation clear a new busy intent after leaving and re-entering the same scope', async () => {
    const old = pending<CommissionerMutationResult>(), current = pending<CommissionerMutationResult>();
    const { result, rerender } = renderHook(() => useCommissionerWorkspace('s1'));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    wire.mutate.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    let oldRequest!: Promise<CommissionerMutationResult>, currentRequest!: Promise<CommissionerMutationResult>;
    act(() => { oldRequest = result.current.mutate('add_adjustment', { user_id: 'a', delta: 1 }, 'Old ruling'); });
    wire.clubId = 'club-2'; rerender();
    await waitFor(() => expect(result.current.data).not.toBeNull());
    wire.clubId = 'club-1'; rerender();
    await waitFor(() => expect(result.current.data).not.toBeNull());
    act(() => { currentRequest = result.current.mutate('add_adjustment', { user_id: 'a', delta: 2 }, 'New ruling'); });
    const fetchCount = wire.fetch.mock.calls.length;
    await act(async () => { old.resolve(saved); await oldRequest; });
    expect(result.current.busy).toBe(true); expect(wire.fetch).toHaveBeenCalledTimes(fetchCount);
    await act(async () => { current.resolve(saved); await currentRequest; });
    expect(result.current.busy).toBe(false);
  });
});
