import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useShowdownLobby, useShowdownMatch } from '@/hooks/useShowdown';
import { ShowdownError } from '@/lib/showdown/service';
import { showdownMatchStructuralSharing } from '@/lib/showdown/monotonic';
import type { PrismAction, PrismPuzzle } from '@/lib/showdown/prism/types';
import type { ShowdownChallenge, ShowdownCursor, ShowdownLobbyData, ShowdownMatchDetail, ShowdownRoundInput } from '@/lib/showdown/types';

const wire = vi.hoisted(() => ({
  userId: 'member-a', clubId: 'club-1', ready: true,
  lobby: vi.fn(), match: vi.fn(), create: vi.fn(), act: vi.fn(), save: vi.fn(), submit: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: wire.userId ? { id: wire.userId } : null, loading: false }) }));
vi.mock('@/contexts/ClubContext', () => ({ useClub: () => ({ club: wire.clubId ? { id: wire.clubId } : null, loading: !wire.ready }) }));
vi.mock('@/lib/showdown/service', async () => ({
  ...await vi.importActual<typeof import('@/lib/showdown/service')>('@/lib/showdown/service'),
  fetchShowdownLobby: wire.lobby, fetchShowdownMatch: wire.match, createShowdown: wire.create,
  actOnShowdown: wire.act, saveShowdownRound: wire.save, submitShowdownRound: wire.submit,
}));

const firstTurn: PrismAction = { type: 'rotate', cell: 12 };
const solved: PrismAction[] = [firstTurn, { type: 'rotate', cell: 22 }];
const record = { wins: 0, losses: 0, draws: 0, played: 0 };
function puzzle(round: number): PrismPuzzle {
  return { id: `hook-round-${round}`, version: 1, difficulty: round === 1 ? 'easy' : round === 2 ? 'medium' : 'hard', width: 5, height: 5,
    tiles: Array.from({ length: 25 }, (_, cell) => cell === 10 ? { kind: 'emitter', direction: 'E', color: 'cyan' } : cell === 24 ? { kind: 'receiver', color: 'cyan', label: 'A' } : cell === 12 || cell === 22 ? { kind: 'mirror', orientation: '/', rotatable: true } : { kind: 'empty' }),
  };
}
function detail({ id = 'challenge-1', userId = 'member-a', clubId = 'club-1', completed = 0, actions = [] as PrismAction[], revision = 0, final = false } = {}): ShowdownMatchDetail {
  const opponentId = userId === 'member-a' ? 'member-b' : 'member-a';
  const current = completed < 3 ? completed + 1 : null;
  return {
    challenge: { id, club_id: clubId, game_key: 'prism_break', rules_version: 1, status: final ? 'completed' : 'active', challenger_id: userId, recipient_id: opponentId,
      created_at: '2026-11-01T00:00:00Z', expires_at: '2026-11-04T00:00:00Z', completed_at: final ? '2026-11-01T00:03:00Z' : null, winner_id: null, outcome: final ? 'draw' : null, rematch_of: null,
      players: [
        { user_id: userId, display_name: 'Alex', avatar_url: null, started_at: '2026-11-01T00:00:00Z', finished_at: completed === 3 ? '2026-11-01T00:02:00Z' : null, rounds_completed: completed, total_score: completed * 500, solved_count: completed, rotations: completed * 2 },
        { user_id: opponentId, display_name: 'Blair', avatar_url: null, started_at: final ? '2026-11-01T00:00:00Z' : null, finished_at: final ? '2026-11-01T00:03:00Z' : null, rounds_completed: final ? 3 : 0, total_score: final ? 1500 : null, solved_count: final ? 3 : null, rotations: final ? 6 : null },
      ] },
    rounds: [1, 2, 3].map(number => ({ round_number: number, difficulty: puzzle(number).difficulty, puzzle_id: puzzle(number).id, puzzle_version: 1, title: `Hook board ${number}`, puzzle: number <= completed || number === current ? puzzle(number) : null, minimum_rotations: number <= completed ? 2 : null,
      me: { actions: number <= completed ? [...solved] : number === current ? [...actions] : [], revision: number <= completed ? 1 : number === current ? revision : 0, submitted: number <= completed, skipped: false, solved: number <= completed, score: number <= completed ? 500 : null, rotations: number <= completed ? 2 : number === current ? actions.filter(action => action.type === 'rotate').length : 0 },
      opponent: final ? { actions: [...solved], revision: 1, submitted: true, skipped: false, solved: true, score: 500, rotations: 2 } : null,
    })),
    current_round: current, can_play: completed < 3, can_decline: false, can_cancel: false, readonly_reason: completed === 3 && !final ? 'Your attempt is sealed.' : null,
    record, rivalry: { ...record, opponent_id: opponentId, display_name: 'Blair', avatar_url: null },
  };
}
function lobby(clubId = wire.clubId, userId = wire.userId, challenges?: ShowdownChallenge[]): ShowdownLobbyData {
  return { games: [{ game_key: 'prism_break', current_rules_version: 1, name: 'Prism Break', description: 'Bend the light.', enabled: true }], members: [], challenges: challenges ?? [detail({ clubId, userId, id: `${clubId}-active` }).challenge], next_cursor: null, record, rivalries: [], standings: [] };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const clients: QueryClient[] = [];
function provider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  clients.push(client);
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); wire.userId = 'member-a'; wire.clubId = 'club-1'; wire.ready = true;
  wire.lobby.mockImplementation(async () => lobby()); wire.match.mockImplementation(async () => detail({ userId: wire.userId, clubId: wire.clubId }));
  wire.create.mockResolvedValue(detail({ id: 'new-challenge' })); wire.act.mockResolvedValue(detail());
  wire.save.mockImplementation(async (input: ShowdownRoundInput) => detail({ actions: input.actions, revision: input.expectedRevision + 1, completed: input.roundNumber - 1 }));
  wire.submit.mockImplementation(async (input: ShowdownRoundInput) => detail({ completed: input.roundNumber }));
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); localStorage.clear(); });

describe('Showdown query and mutation lifecycle', () => {
  it('opens a recipient directly with start=true and restores the actual current checkpoint', async () => {
    wire.match.mockResolvedValue(detail({ actions: [firstTurn], revision: 3 }));
    const { wrapper } = provider();
    const { result } = renderHook(() => useShowdownMatch('challenge-1'), { wrapper });
    await waitFor(() => expect(result.current.data?.current_round).toBe(1));
    expect(wire.match).toHaveBeenCalledExactlyOnceWith('challenge-1', true);
    expect(result.current.actions).toEqual([firstTurn]);
    expect(result.current.saveState).toBe('saved');
    expect(result.current.data?.rounds[0].opponent).toBeNull();
  });

  it('appends terminal history pages while deduplicating the all-active challenge snapshot', async () => {
    const active = detail({ id: 'open' }).challenge;
    const oldA = { ...detail({ id: 'old-a' }).challenge, status: 'expired' as const };
    const oldB = { ...detail({ id: 'old-b' }).challenge, status: 'declined' as const };
    const cursor: ShowdownCursor = { created_at: oldA.created_at, id: oldA.id };
    wire.lobby.mockImplementation(async (_game: string, page: ShowdownCursor | null) => ({ ...lobby('club-1', 'member-a', page ? [active, oldB] : [active, oldA]), next_cursor: page ? null : cursor }));
    const { wrapper } = provider(); const { result } = renderHook(() => useShowdownLobby(), { wrapper });
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    await act(async () => { await result.current.loadMore(); });
    expect(wire.lobby).toHaveBeenLastCalledWith('prism_break', cursor);
    await waitFor(() => expect(result.current.data?.challenges.map(challenge => challenge.id)).toEqual(['open', 'old-a', 'old-b']));
    expect(result.current.hasMore).toBe(false);
  });

  it('keeps create and decline request identities across failed retries, without sharing their UUIDs', async () => {
    const { wrapper } = provider(); const { result } = renderHook(() => useShowdownLobby(), { wrapper });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    const input = { recipientId: 'member-b', gameKey: 'prism_break' };
    wire.create.mockRejectedValueOnce(new Error('Response lost')).mockResolvedValue(detail({ id: 'new-challenge' }));
    await act(async () => { await expect(result.current.create(input)).rejects.toThrow('Response lost'); });
    await act(async () => { await result.current.create(input); });
    expect(wire.create.mock.calls[0][0].requestId).toBe(wire.create.mock.calls[1][0].requestId);
    wire.act.mockRejectedValueOnce(new Error('Response lost')).mockResolvedValue(detail());
    await act(async () => { await expect(result.current.act('challenge-1', 'decline')).rejects.toThrow('Response lost'); });
    await act(async () => { await result.current.act('challenge-1', 'decline'); });
    expect(wire.act.mock.calls[0][2]).toBe(wire.act.mock.calls[1][2]);
    expect(wire.act.mock.calls[0][2]).not.toBe(wire.create.mock.calls[0][0].requestId);
    expect(result.current.busy).toBe(false);
  });

  it('retires another club’s pending reads and callbacks immediately on member/club changes', async () => {
    const old = deferred<ShowdownLobbyData>();
    wire.lobby.mockReturnValueOnce(old.promise).mockImplementation(async () => lobby());
    const { wrapper } = provider(); const { result, rerender } = renderHook(() => useShowdownLobby(), { wrapper });
    const staleCreate = result.current.create;
    wire.userId = 'member-b'; wire.clubId = 'club-2'; rerender();
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data?.challenges[0].club_id).toBe('club-2'));
    await act(async () => old.resolve(lobby('club-1', 'member-a')));
    expect(result.current.data?.challenges[0].club_id).toBe('club-2');
    await expect(staleCreate({ recipientId: 'member-b', gameKey: 'prism_break' })).rejects.toThrow('Sign in to your club');
    expect(wire.create).not.toHaveBeenCalled();
  });

  it('does not let an A→B→A late create clear a newer mutation or populate its cache', async () => {
    const old = deferred<ShowdownMatchDetail>(), current = deferred<ShowdownMatchDetail>();
    const { wrapper, client } = provider(); const { result, rerender } = renderHook(() => useShowdownLobby(), { wrapper });
    await waitFor(() => expect(result.current.data).not.toBeNull());
    wire.create.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    let first!: Promise<ShowdownMatchDetail>, second!: Promise<ShowdownMatchDetail>;
    act(() => { first = result.current.create({ recipientId: 'member-b', gameKey: 'prism_break' }); });
    expect(result.current.busy).toBe(true);
    wire.clubId = 'club-2'; rerender();
    await waitFor(() => expect(result.current.data?.challenges[0].club_id).toBe('club-2'));
    wire.clubId = 'club-1'; rerender();
    await waitFor(() => expect(result.current.data?.challenges[0].club_id).toBe('club-1'));
    act(() => { second = result.current.create({ recipientId: 'member-b', gameKey: 'prism_break' }); });
    await act(async () => { old.resolve(detail({ id: 'retired-challenge' })); await first; });
    expect(result.current.busy).toBe(true);
    expect(client.getQueryData(['showdown', 'member-a', 'club-1', 'match', 'retired-challenge'])).toBeUndefined();
    await act(async () => { current.resolve(detail({ id: 'current-challenge' })); await second; });
    expect(result.current.busy).toBe(false);
    expect(client.getQueryData<ShowdownMatchDetail>(['showdown', 'member-a', 'club-1', 'match', 'current-challenge'])?.challenge.id).toBe('current-challenge');
  });

  it('allows a completed rematch with the correct rival and rejects replay invitations from unfinished matches', async () => {
    wire.match.mockResolvedValue(detail({ completed: 3, final: true }));
    const { wrapper, client } = provider(); const { result, rerender } = renderHook(({ id }) => useShowdownMatch(id), { wrapper, initialProps: { id: 'challenge-1' } });
    await waitFor(() => expect(result.current.data?.challenge.status).toBe('completed'));
    wire.create.mockRejectedValueOnce(new Error('Response lost')).mockResolvedValue(detail({ id: 'rematch' }));
    await act(async () => { await expect(result.current.rematch()).rejects.toThrow('Response lost'); });
    await act(async () => { await result.current.rematch(); });
    expect(wire.create.mock.calls[0][0]).toMatchObject({ recipientId: 'member-b', gameKey: 'prism_break', rematchOf: 'challenge-1' });
    expect(wire.create.mock.calls[0][0].requestId).toBe(wire.create.mock.calls[1][0].requestId);
    wire.match.mockResolvedValue(detail({ id: 'unfinished-challenge' }));
    rerender({ id: 'unfinished-challenge' });
    await waitFor(() => expect(result.current.data?.challenge.status).toBe('active'));
    await expect(result.current.rematch()).rejects.toThrow('Complete this match');
    expect(wire.create).toHaveBeenCalledTimes(2);
    expect(client.getQueryData<ShowdownMatchDetail>(['showdown', 'member-a', 'club-1', 'match', 'challenge-1'])?.challenge.status).toBe('completed');
  });

  it('keeps the next board and its action log together when an older polling response arrives after submission', async () => {
    const stalePoll = deferred<ShowdownMatchDetail>();
    wire.match.mockResolvedValueOnce(detail()).mockReturnValueOnce(stalePoll.promise);
    const { wrapper, client } = provider();
    const { result } = renderHook(() => useShowdownMatch('challenge-1'), { wrapper });
    await waitFor(() => expect(result.current.data?.current_round).toBe(1));
    let polling!: Promise<void>;
    act(() => { polling = client.refetchQueries({ queryKey: ['showdown', 'member-a', 'club-1', 'match', 'challenge-1'], exact: true }); });
    await waitFor(() => expect(wire.match).toHaveBeenCalledTimes(2));
    act(() => result.current.onActionsChange(solved));
    await act(async () => { await result.current.submit(solved, 'solved'); });
    expect(result.current.data?.current_round).toBe(2);
    await act(async () => { stalePoll.resolve(detail()); await polling; });
    expect(result.current.data?.current_round).toBe(2);
    expect(result.current.data?.rounds[0].me.submitted).toBe(true);
    expect(result.current.data?.rounds[1].puzzle?.id).toBe('hook-round-2');
    expect(result.current.actions).toEqual([]);
    expect(client.getQueryData<ShowdownMatchDetail>(['showdown', 'member-a', 'club-1', 'match', 'challenge-1'])?.current_round).toBe(2);
  });

  it('does not reopen a terminal challenge when an earlier active polling result resolves', async () => {
    const stalePoll = deferred<ShowdownMatchDetail>();
    wire.match.mockResolvedValueOnce(detail()).mockReturnValueOnce(stalePoll.promise);
    const { wrapper, client } = provider();
    const { result } = renderHook(() => useShowdownMatch('challenge-1'), { wrapper });
    await waitFor(() => expect(result.current.data?.current_round).toBe(1));
    let polling!: Promise<void>;
    act(() => { polling = client.refetchQueries({ queryKey: ['showdown', 'member-a', 'club-1', 'match', 'challenge-1'], exact: true }); });
    await waitFor(() => expect(wire.match).toHaveBeenCalledTimes(2));
    const closed: ShowdownMatchDetail = { ...detail(), challenge: { ...detail().challenge, status: 'expired' }, current_round: null, can_play: false, readonly_reason: 'Challenge expired' };
    act(() => client.setQueryData(['showdown', 'member-a', 'club-1', 'match', 'challenge-1'], closed));
    await waitFor(() => expect(result.current.data?.challenge.status).toBe('expired'));
    await act(async () => { stalePoll.resolve(detail()); await polling; });
    expect(result.current.data?.challenge.status).toBe('expired');
    expect(result.current.data?.can_play).toBe(false);
    expect(result.current.busy).toBe(false);
  });

  it('submits a solved round through the real outbox and resumes round two after reload', async () => {
    let server = detail();
    wire.match.mockImplementation(async () => server);
    wire.submit.mockImplementation(async (input: ShowdownRoundInput) => { server = detail({ completed: input.roundNumber }); return server; });
    const first = provider(); const mounted = renderHook(() => useShowdownMatch('challenge-1'), { wrapper: first.wrapper });
    await waitFor(() => expect(mounted.result.current.data?.current_round).toBe(1));
    act(() => mounted.result.current.onActionsChange(solved));
    await act(async () => { await mounted.result.current.submit(solved, 'solved'); });
    await waitFor(() => expect(mounted.result.current.data?.current_round).toBe(2));
    expect(wire.submit).toHaveBeenCalledWith(expect.objectContaining({ roundNumber: 1, expectedRevision: 0, actions: solved }), false);
    mounted.unmount();
    const reloaded = provider(); const next = renderHook(() => useShowdownMatch('challenge-1'), { wrapper: reloaded.wrapper });
    await waitFor(() => expect(next.result.current.data?.current_round).toBe(2));
    expect(next.result.current.actions).toEqual([]);
    expect(next.result.current.data?.rounds[0].me).toMatchObject({ submitted: true, score: 500 });
    expect(next.result.current.data?.rounds[1].puzzle?.id).toBe('hook-round-2');
  });

  it('restores unsynced moves after reload and retries the exact pending checkpoint identity', async () => {
    wire.save.mockRejectedValueOnce(new ShowdownError('Connection lost'));
    const first = provider(); const mounted = renderHook(() => useShowdownMatch('challenge-1'), { wrapper: first.wrapper });
    await waitFor(() => expect(mounted.result.current.data?.current_round).toBe(1));
    act(() => mounted.result.current.onActionsChange([firstTurn]));
    await act(async () => { await expect(mounted.result.current.checkpoint()).rejects.toThrow('Connection lost'); });
    expect(mounted.result.current.saveState).toBe('offline');
    const lostRequest = wire.save.mock.calls[0][0];
    mounted.unmount();
    const reloaded = provider(); const restored = renderHook(() => useShowdownMatch('challenge-1'), { wrapper: reloaded.wrapper });
    await waitFor(() => expect(restored.result.current.actions).toEqual([firstTurn]));
    await act(async () => { await restored.result.current.retrySave(); });
    expect(wire.save.mock.calls[1][0]).toEqual(lostRequest);
    expect(restored.result.current.saveState).toBe('saved');
    expect(restored.result.current.actions).toEqual([firstTurn]);
  });
});

describe('Showdown snapshot ordering', () => {
  it('rejects a lower same-round revision and a formerly submitted round becoming unfinished', () => {
    const current = detail({ actions: [firstTurn], revision: 3 });
    expect(showdownMatchStructuralSharing(current, detail({ revision: 2 }))).toBe(current);
    const next = detail({ completed: 1 });
    expect(showdownMatchStructuralSharing(next, detail())).toBe(next);
  });

  it('preserves observed opponent participation and completion metadata', () => {
    const current = detail();
    current.challenge.players[1] = { ...current.challenge.players[1], started_at: '2026-11-01T00:00:01Z', rounds_completed: 1 };
    expect(showdownMatchStructuralSharing(current, detail())).toBe(current);
    const finished = detail({ completed: 3 });
    const regressed = detail({ completed: 3 });
    regressed.challenge.players[0].finished_at = null;
    expect(showdownMatchStructuralSharing(finished, regressed)).toBe(finished);
  });

  it('preserves revealed opponent round checkpoints after a completed result', () => {
    const final = detail({ completed: 3, final: true });
    const hiddenAgain = detail({ completed: 3, final: true });
    hiddenAgain.rounds[0].opponent = null;
    expect(showdownMatchStructuralSharing(final, hiddenAgain)).toBe(final);
    const olderAttempt = detail({ completed: 3, final: true });
    olderAttempt.rounds[0].opponent!.revision = 0;
    expect(showdownMatchStructuralSharing(final, olderAttempt)).toBe(final);
  });

  it('keeps immutable terminal and frozen-rule identity while allowing newer record aggregates', () => {
    const final = detail({ completed: 3, final: true });
    expect(showdownMatchStructuralSharing(final, detail({ completed: 3 }))).toBe(final);
    const wrongVersion = detail({ completed: 3, final: true });
    wrongVersion.challenge.rules_version = 2;
    expect(showdownMatchStructuralSharing(final, wrongVersion)).toBe(final);
    const updatedStats = detail({ completed: 3, final: true });
    updatedStats.record = { wins: 3, losses: 1, draws: 1, played: 5 };
    expect(showdownMatchStructuralSharing(final, updatedStats)).toBe(updatedStats);
  });

  it('accepts a fresh terminal closure and the first snapshot of another challenge', () => {
    const current = detail();
    const closed = { ...detail(), challenge: { ...detail().challenge, status: 'expired' as const }, current_round: null, can_play: false, readonly_reason: 'Challenge expired' };
    expect(showdownMatchStructuralSharing(current, closed)).toBe(closed);
    const another = detail({ id: 'another-challenge' });
    expect(showdownMatchStructuralSharing(closed, another)).toBe(another);
    expect(showdownMatchStructuralSharing(undefined, current)).toBe(current);
  });
});
