import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useShowdownMatch } from '@/hooks/useShowdown';
import type { ShowdownMatchDetail, ShowdownReconstructionInput } from '@/lib/showdown/types';
import { afterimageFixtureDetail as detail } from './fixtures/afterimage';

const wire = vi.hoisted(() => ({
  userId: 'member-a', clubId: 'club-1', match: vi.fn(), start: vi.fn(), save: vi.fn(), submit: vi.fn(),
  prismSave: vi.fn(), prismSubmit: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: wire.userId ? { id: wire.userId } : null, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: wire.clubId ? { id: wire.clubId } : null, loading: false }) }));
vi.mock('@/lib/showdown/service', async () => ({
  ...await vi.importActual<typeof import('@/lib/showdown/service')>('@/lib/showdown/service'),
  fetchShowdownMatch: wire.match, startAfterimageStudy: wire.start,
  saveAfterimageReconstruction: wire.save, submitAfterimageReconstruction: wire.submit,
  saveShowdownRound: wire.prismSave, submitShowdownRound: wire.prismSubmit,
}));

const first = { object_id: 'object-book', slot_id: 'place-1' };
const other = { object_id: 'object-lantern', slot_id: 'place-2' };
const queryKey = (user = 'member-a', club = 'club-1') => ['showdown', user, club, 'match', 'memory-match'];
const clients: QueryClient[] = [];
function provider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  clients.push(client);
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); wire.userId = 'member-a'; wire.clubId = 'club-1';
  wire.match.mockImplementation(async () => detail({ userId: wire.userId, clubId: wire.clubId }));
  wire.start.mockResolvedValue(detail({ phase: 'study', revision: 1 }));
  wire.save.mockImplementation(async (input: ShowdownReconstructionInput) => detail({ completed: input.roundNumber - 1, placements: input.placements, revision: input.expectedRevision + 1 }));
  wire.submit.mockImplementation(async (input: ShowdownReconstructionInput) => detail({ completed: input.roundNumber, phase: 'ready', revision: 0 }));
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); localStorage.clear(); });

describe('Afterimage integrated Showdown hook lifecycle', () => {
  it('keeps Ready free of study art and adopts the server phase only after an explicit Ready request', async () => {
    const study = deferred<ShowdownMatchDetail>();
    wire.match.mockResolvedValue(detail({ phase: 'ready', revision: 0 }));
    wire.start.mockReturnValue(study.promise);
    const { client, wrapper } = provider();
    const { result } = renderHook(() => useShowdownMatch('memory-match'), { wrapper });
    await waitFor(() => expect(result.current.data?.rounds[0].scene?.phase).toBe('ready'));
    expect(result.current.data?.can_play).toBe(true);
    expect(result.current.data?.rounds[0].scene?.objects).toEqual([]);
    expect(wire.match).toHaveBeenCalledExactlyOnceWith('memory-match', true);
    expect(wire.start).not.toHaveBeenCalled();
    act(() => result.current.onPlacementsChange([first]));
    expect(result.current.placements).toEqual([]);
    let opening!: Promise<void>;
    act(() => { opening = result.current.startStudy(); });
    expect(result.current.startingStudy).toBe(true);
    expect(result.current.busy).toBe(true);
    expect(wire.start).toHaveBeenCalledExactlyOnceWith('memory-match', 1, expect.any(String));
    expect(result.current.data?.rounds[0].scene?.phase).toBe('ready');
    await act(async () => { study.resolve(detail({ phase: 'study', revision: 1 })); await opening; });
    await waitFor(() => expect(result.current.data?.rounds[0].scene?.phase).toBe('study'));
    expect(client.getQueryData<ShowdownMatchDetail>(queryKey())?.rounds[0].scene?.phase).toBe('study');
    expect(result.current.startingStudy).toBe(false);
    expect(result.current.data?.rounds[0].scene?.objects).toHaveLength(9);
    expect(wire.save).not.toHaveBeenCalled();
    expect(wire.prismSave).not.toHaveBeenCalled();
  });

  it('restores a checkpoint and sends edited placements and resets at the actual authoritative revision', async () => {
    wire.match.mockResolvedValue(detail({ revision: 4, placements: [first] }));
    const { client, wrapper } = provider();
    const { result } = renderHook(() => useShowdownMatch('memory-match'), { wrapper });
    await waitFor(() => expect(result.current.placements).toEqual([first]));
    act(() => result.current.onPlacementsChange([first, other]));
    expect(result.current.saveState).toBe('saving');
    await act(async () => { await result.current.checkpoint(); });
    expect(wire.save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      challengeId: 'memory-match', roundNumber: 1, placements: [first, other], expectedRevision: 4,
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    }));
    await waitFor(() => expect(result.current.saveState).toBe('saved'));
    expect(client.getQueryData<ShowdownMatchDetail>(queryKey())?.rounds[0].me.revision).toBe(5);
    act(() => result.current.onPlacementsChange([]));
    await act(async () => { await result.current.checkpoint(); });
    expect(wire.save).toHaveBeenLastCalledWith(expect.objectContaining({ placements: [], expectedRevision: 5 }));
    expect(result.current.placements).toEqual([]);
    expect(result.current.data?.rounds[0].me.score).toBeNull();
    expect(wire.prismSave).not.toHaveBeenCalled();
    expect(wire.submit).not.toHaveBeenCalled();
  });

  it('seals one arrangement, displays the received score and opens round two Ready without starting its study', async () => {
    wire.match.mockResolvedValue(detail({ revision: 3, placements: [first] }));
    const advanced = detail({ completed: 1, phase: 'ready', revision: 0 });
    Object.assign(advanced.rounds[0].me, { placements: [first], revision: 4, score: 42, solved: false, correct_count: 1, perfect: false });
    Object.assign(advanced.challenge.players[0], { total_score: 42, solved_count: 0, perfect_count: 0 });
    wire.submit.mockResolvedValue(advanced);
    const { client, wrapper } = provider();
    const { result } = renderHook(() => useShowdownMatch('memory-match'), { wrapper });
    await waitFor(() => expect(result.current.placements).toEqual([first]));
    await act(async () => { await result.current.submitReconstruction(); });
    expect(wire.submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      challengeId: 'memory-match', roundNumber: 1, expectedRevision: 3, placements: [first],
    }));
    await waitFor(() => expect(result.current.data?.current_round).toBe(2));
    expect(result.current.placements).toEqual([]);
    expect(result.current.data?.rounds[0].me.score).toBe(42);
    expect(result.current.data?.rounds[1].scene).toMatchObject({ phase: 'ready', objects: [], slots: [], tray: [] });
    expect(result.current.data?.rounds[2].scene).toBeNull();
    expect(client.getQueryData<ShowdownMatchDetail>(queryKey())?.current_round).toBe(2);
    expect(result.current.data?.can_play).toBe(true);
    expect(result.current.submitting).toBe(false);
    expect(wire.start).not.toHaveBeenCalled();
    expect(wire.prismSubmit).not.toHaveBeenCalled();
  });

  it('rejects a delayed study poll after reconstruction unlocks and preserves an unsaved local arrangement', async () => {
    const oldStudy = deferred<ShowdownMatchDetail>();
    wire.match.mockResolvedValueOnce(detail({ phase: 'study' })).mockReturnValueOnce(oldStudy.promise)
      .mockResolvedValue(detail({ phase: 'reconstruct' }));
    const { client, wrapper } = provider();
    const { result } = renderHook(() => useShowdownMatch('memory-match'), { wrapper });
    await waitFor(() => expect(result.current.data?.rounds[0].scene?.phase).toBe('study'));
    let polling!: Promise<void>;
    act(() => { polling = result.current.refresh(); });
    await act(async () => { await result.current.refreshStudy(); });
    await waitFor(() => expect(result.current.data?.rounds[0].scene?.phase).toBe('reconstruct'));
    act(() => result.current.onPlacementsChange([first]));
    await act(async () => { oldStudy.resolve(detail({ phase: 'study' })); await polling; });
    expect(result.current.data?.rounds[0].scene?.phase).toBe('reconstruct');
    expect(client.getQueryData<ShowdownMatchDetail>(queryKey())?.rounds[0].scene?.phase).toBe('reconstruct');
    expect(result.current.placements).toEqual([first]);
    await act(async () => { await result.current.checkpoint(); });
    expect(wire.save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ placements: [first], expectedRevision: 1 }));
    expect(wire.start).not.toHaveBeenCalled();
  });

  it('isolates an old save across account and club A → B → A without overwriting the new scoped checkpoint', async () => {
    const lateSave = deferred<ShowdownMatchDetail>();
    let returningToA = false;
    wire.match.mockImplementation(async () => detail({ userId: wire.userId, clubId: wire.clubId,
      revision: wire.userId === 'member-a' && returningToA ? 3 : 1,
      placements: wire.userId === 'member-a' && returningToA ? [other] : [],
    }));
    wire.save.mockReturnValueOnce(lateSave.promise);
    const { client, wrapper } = provider();
    const { result, rerender } = renderHook(() => useShowdownMatch('memory-match'), { wrapper });
    await waitFor(() => expect(result.current.data?.challenge.club_id).toBe('club-1'));
    act(() => result.current.onPlacementsChange([first]));
    let saving!: Promise<void>;
    act(() => { saving = result.current.checkpoint(); });
    expect(wire.save).toHaveBeenCalledTimes(1);
    wire.userId = 'member-b'; wire.clubId = 'club-2'; rerender();
    await waitFor(() => expect(result.current.data?.challenge.club_id).toBe('club-2'));
    expect(result.current.placements).toEqual([]);
    // Mark the background A snapshot stale so returning fetches the newer
    // authoritative checkpoint rather than reusing its five-second cache.
    await act(async () => { await client.invalidateQueries({ queryKey: queryKey() }); });
    returningToA = true; wire.userId = 'member-a'; wire.clubId = 'club-1'; rerender();
    await waitFor(() => expect(result.current.data?.rounds[0].me.revision).toBe(3));
    expect(result.current.placements).toEqual([other]);
    await act(async () => { lateSave.resolve(detail({ revision: 2, placements: [first] })); await saving; });
    expect(result.current.data?.rounds[0].me.revision).toBe(3);
    expect(result.current.placements).toEqual([other]);
    expect(client.getQueryData<ShowdownMatchDetail>(queryKey())?.rounds[0].me.placements).toEqual([other]);
    expect(client.getQueryData<ShowdownMatchDetail>(queryKey('member-b', 'club-2'))?.rounds[0].me.placements).toEqual([]);
    expect(wire.save).toHaveBeenCalledTimes(1);
  });

  it('invalidates existing DH score, Feats and Showdown discovery queries only when the match completes', async () => {
    wire.match.mockResolvedValue(detail({ completed: 2, revision: 4 }));
    const completed = detail({ completed: 3, final: true });
    completed.rounds[2].me.revision = 5;
    wire.submit.mockResolvedValue(completed);
    const { client, wrapper } = provider();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useShowdownMatch('memory-match'), { wrapper });
    await waitFor(() => expect(result.current.data?.current_round).toBe(3));
    expect(invalidate).not.toHaveBeenCalled();
    expect(result.current.data?.rounds[0].opponent).toBeNull();
    await act(async () => { await result.current.submitReconstruction(); });
    await waitFor(() => expect(result.current.data?.challenge.status).toBe('completed'));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dh-feats', 'member-a', 'club-1'] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dh-score', 'member-a', 'club-1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['showdown', 'member-a', 'club-1', 'lobby'] });
    expect(result.current.data?.rounds.every(round => round.opponent?.submitted)).toBe(true);
    expect(result.current.data?.current_round).toBeNull();
    expect(result.current.data?.can_play).toBe(false);
    expect(localStorage.getItem('dh:showdown:afterimage:v1:member-a:club-1:memory-match')).toBeNull();
  });
});
