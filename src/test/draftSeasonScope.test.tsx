import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentSeason } from '@/hooks/useDraftSeasons';

const backend = vi.hoisted(() => ({ userId: 'commissioner', clubId: 'club-a', fetch: vi.fn() }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: { id: backend.clubId } }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: backend.userId } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => {
    let seasonId = '';
    const query = {
      select: () => query,
      eq: (_key: string, value: string) => { seasonId = value; return query; },
      maybeSingle: () => backend.fetch(seasonId),
    };
    return query;
  },
} }));
const season = (id: string) => ({ id, name: id, commissioner_user_id: 'commissioner' });
beforeEach(() => { backend.userId = 'commissioner'; backend.clubId = 'club-a'; backend.fetch.mockReset(); });

describe('Selected commissioner season', () => {
  it('cannot regain access from a late response for another selected season', async () => {
    let resolveOld!: (value: unknown) => void;
    backend.fetch.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValue({ data: season('season-b'), error: null });
    const { result, rerender } = renderHook(({ id }) => useCurrentSeason(id), { initialProps: { id: 'season-a' } });
    await waitFor(() => expect(backend.fetch).toHaveBeenCalledWith('season-a'));
    rerender({ id: 'season-b' });
    expect(result.current.season).toBeNull();
    await waitFor(() => expect(result.current.season?.id).toBe('season-b'));
    await act(async () => resolveOld({ data: season('season-a'), error: null }));
    expect(result.current.season?.id).toBe('season-b');
  });
  it('retires a season when the same member moves to another active club', async () => {
    backend.fetch.mockResolvedValueOnce({ data: season('season-a'), error: null });
    const { result, rerender } = renderHook(() => useCurrentSeason('season-a'));
    await waitFor(() => expect(result.current.season?.id).toBe('season-a'));
    backend.clubId = 'club-b';
    backend.fetch.mockResolvedValueOnce({ data: null, error: null });
    rerender();
    expect(result.current.season).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.season).toBeNull();
  });
  it('keeps the mounted workspace visible during a same-season refresh', async () => {
    backend.fetch.mockResolvedValueOnce({ data: season('season-a'), error: null });
    const { result } = renderHook(() => useCurrentSeason('season-a'));
    await waitFor(() => expect(result.current.season?.id).toBe('season-a'));
    let finish!: (value: unknown) => void;
    backend.fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refetch(); });
    expect(result.current.loading).toBe(false);
    expect(result.current.season?.id).toBe('season-a');
    await act(async () => { finish({ data: null, error: { message: 'Temporary network failure' } }); await refresh; });
    expect(result.current.season?.id).toBe('season-a');
  });
  it('clears a previous account’s season while the new account is checked', async () => {
    backend.fetch.mockResolvedValueOnce({ data: season('season-a'), error: null });
    const { result, rerender } = renderHook(() => useCurrentSeason('season-a'));
    await waitFor(() => expect(result.current.season?.id).toBe('season-a'));
    backend.userId = 'ordinary-member';
    backend.fetch.mockResolvedValueOnce({ data: null, error: { message: 'Denied' } });
    rerender();
    expect(result.current.season).toBeNull();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.season).toBeNull();
  });
});
