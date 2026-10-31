import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDraftReviewAccess } from '@/hooks/useDraftReviewAccess';

const backend = vi.hoisted(() => ({
  userId: 'commissioner',
  entries: [{ draft_id: 'old-draft', club_id: 'club-a', season_id: 'archived-season' }],
  rpc: vi.fn(),
  failRead: false,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: backend.userId } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: (...args: unknown[]) => backend.rpc(...args),
  from: () => {
    const filters = new Map<string, unknown>();
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.set(key, value); return query; },
      maybeSingle: async () => ({
        data: backend.entries.find(row => [...filters].every(([key, value]) => row[key as keyof typeof row] === value)) ?? null,
        error: backend.failRead ? { message: 'Denied' } : null,
      }),
    };
    return query;
  },
} }));

beforeEach(() => {
  backend.userId = 'commissioner';
  backend.failRead = false;
  backend.rpc.mockReset().mockResolvedValue({ data: true, error: null });
});

describe('Draft review scope', () => {
  it('checks the draft’s archived season instead of the current season', async () => {
    const { result } = renderHook(() => useDraftReviewAccess('old-draft', 'club-a'));
    await waitFor(() => expect(result.current.allowed).toBe(true));
    expect(backend.rpc).toHaveBeenCalledWith('draft_commissioner_can_manage', { p_season_id: 'archived-season' });
    expect(result.current.seasonId).toBe('archived-season');
  });
  it('does not carry permission across club boundaries', async () => {
    const { result, rerender } = renderHook(({ club }) => useDraftReviewAccess('old-draft', club), { initialProps: { club: 'club-a' } });
    await waitFor(() => expect(result.current.allowed).toBe(true));
    rerender({ club: 'club-b' });
    expect(result.current.allowed).toBe(false);
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.seasonId).toBeNull();
    expect(backend.rpc).toHaveBeenCalledTimes(1);
  });
  it('fails closed when the server denies review or a read fails', async () => {
    backend.rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
    const denied = renderHook(() => useDraftReviewAccess('old-draft', 'club-a'));
    await waitFor(() => expect(denied.result.current.resolved).toBe(true));
    expect(denied.result.current.allowed).toBe(false);
    denied.unmount();
    backend.failRead = true;
    const failed = renderHook(() => useDraftReviewAccess('old-draft', 'club-a'));
    await waitFor(() => expect(failed.result.current.resolved).toBe(true));
    expect(failed.result.current.allowed).toBe(false);
    expect(failed.result.current.verified).toBe(false);
  });
  it('ignores a permission response from the previous account', async () => {
    let resolveOld!: (value: { data: boolean; error: null }) => void;
    backend.rpc.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    const { result, rerender } = renderHook(() => useDraftReviewAccess('old-draft', 'club-a'));
    await waitFor(() => expect(backend.rpc).toHaveBeenCalledTimes(1));
    backend.userId = 'ordinary-member';
    backend.rpc.mockResolvedValue({ data: false, error: null });
    rerender();
    await waitFor(() => expect(result.current.resolved).toBe(true));
    await act(async () => resolveOld({ data: true, error: null }));
    expect(result.current.allowed).toBe(false);
  });
});
