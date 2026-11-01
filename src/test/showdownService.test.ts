import { beforeEach, describe, expect, it, vi } from 'vitest';
import { actOnShowdown, createShowdown, fetchShowdownLobby, fetchShowdownMatch, parseShowdownMatch, saveShowdownRound, ShowdownError, submitShowdownRound } from '@/lib/showdown/service';
import { getShowdownGame } from '@/lib/showdown/registry';
import type { ShowdownMatchDetail, ShowdownRoundInput } from '@/lib/showdown/types';
import type { PrismPuzzle } from '@/lib/showdown/prism/types';
import { getRouteTitle, isGameShellRoute, isMobilePrimaryActive, navPathForRoute } from '@/lib/appNavigation';
import { NAV_ASSET_SLUGS } from '@/types/assets';
import { notifIcon } from '@/components/notifications/meta';

const backend = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc(...args: unknown[]) { return backend.rpc(...args); } } }));
function match(): ShowdownMatchDetail {
  const puzzle: PrismPuzzle = { id: 'service-board', version: 1, difficulty: 'easy', width: 5, height: 5, tiles: Array.from({ length: 25 }, () => ({ kind: 'empty' })) };
  puzzle.tiles[5] = { kind: 'emitter', direction: 'E', color: 'cyan' };
  puzzle.tiles[7] = { kind: 'mirror', orientation: '\\', rotatable: true };
  puzzle.tiles[2] = { kind: 'receiver', color: 'cyan', label: 'A' };
  const record = { wins: 0, losses: 0, draws: 0, played: 0 };
  return { challenge: { id: 'challenge-a', club_id: 'club-a', game_key: 'prism_break', rules_version: 1, status: 'active', challenger_id: 'a', recipient_id: 'b', created_at: '', expires_at: '', completed_at: null, winner_id: null, outcome: null, rematch_of: null,
    players: ['a','b'].map(user_id => ({ user_id, display_name: user_id, avatar_url: null, started_at: null, finished_at: null, rounds_completed: 0, total_score: null, solved_count: null, rotations: null })) },
    rounds: [1,2,3].map(round_number => ({ round_number, difficulty: round_number === 1 ? 'easy' : round_number === 2 ? 'medium' : 'hard', puzzle_id: puzzle.id, puzzle_version: 1, title: 'Service board', puzzle: round_number === 1 ? puzzle : null, minimum_rotations: null,
      me: { actions: [], revision: 0, submitted: false, skipped: false, solved: false, score: null, rotations: 0 }, opponent: null })),
    current_round: 1, can_play: true, can_decline: false, can_cancel: true, readonly_reason: null, record, rivalry: { ...record, opponent_id: 'b', display_name: 'b', avatar_url: null } };
}
beforeEach(() => { backend.rpc.mockReset().mockResolvedValue({ data: match(), error: null }); });

describe('Showdown production transport', () => {
  it('starts directly from the invitation and preserves server-closed states', async () => {
    const open = await fetchShowdownMatch('challenge-a');
    expect(open.can_play).toBe(true);
    expect(backend.rpc).toHaveBeenCalledWith('showdown_get', { p_challenge_id: 'challenge-a', p_start: true });
    const expired = { ...match(), challenge: { ...match().challenge, status: 'expired' }, can_play: false, readonly_reason: 'Challenge expired' };
    backend.rpc.mockResolvedValue({ data: expired, error: null });
    expect((await fetchShowdownMatch('challenge-a', false)).can_play).toBe(false);
  });
  it('rejects any unfinished opponent action log or private minimum in the response', () => {
    const leaked = match(); leaked.rounds[0].opponent = { ...leaked.rounds[0].me, score: 500 };
    expect(() => parseShowdownMatch(leaked)).toThrow(/could not be verified/);
    const par = match(); par.rounds[0].minimum_rotations = 1;
    expect(() => parseShowdownMatch(par)).toThrow(/could not be verified/);
  });
  it('rejects malformed board content before it reaches the renderer', () => {
    const broken = match(); broken.rounds[0].puzzle!.tiles = [];
    expect(() => parseShowdownMatch(broken)).toThrow();
    expect(() => parseShowdownMatch({ ...match(), rounds: [] })).toThrow(/could not be verified/);
  });
  it('sends request identities and a rematch reference without client score authority', async () => {
    const input = { recipientId: 'b', gameKey: 'prism_break', rematchOf: 'old', requestId: 'fixed-request', totalScore: 1500, winnerId: 'a' };
    await createShowdown(input);
    expect(backend.rpc).toHaveBeenCalledExactlyOnceWith('showdown_create', { p_recipient_id: 'b', p_game_key: 'prism_break', p_request_id: 'fixed-request', p_rematch_of: 'old' });
  });
  it('forwards only replay actions, expected revision and the same retry identity for saves and skips', async () => {
    const round: ShowdownRoundInput = { challengeId: 'challenge-a', roundNumber: 1, actions: [{ type: 'reset' }], expectedRevision: 4, requestId: 'retry-id' };
    await saveShowdownRound(round); await submitShowdownRound(round, true);
    const payload = { p_challenge_id: 'challenge-a', p_round_number: 1, p_actions: [{ type: 'reset' }], p_expected_revision: 4, p_request_id: 'retry-id' };
    expect(backend.rpc.mock.calls).toEqual([['showdown_save_round', payload], ['showdown_submit_round', { ...payload, p_skip: true }]]);
  });
  it('keeps rule/rate errors actionable while hiding private database diagnostics', async () => {
    backend.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'Challenge limit reached. Try again later.' } });
    await expect(createShowdown({ recipientId: 'b', gameKey: 'prism_break' })).rejects.toThrow('Challenge limit reached. Try again later.');
    backend.rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX000', message: 'secret database internals' } });
    await expect(fetchShowdownMatch('a')).rejects.toThrow('Showdown could not sync');
  });
  it('distinguishes access denial and conflicting device revisions', async () => {
    backend.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'internal membership join' } });
    await expect(fetchShowdownMatch('a')).rejects.toMatchObject({ code: 'access' });
    backend.rpc.mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'revision' } });
    await expect(fetchShowdownMatch('a')).rejects.toBeInstanceOf(ShowdownError);
  });
  it('pages terminal history through the existing club-scoped lobby RPC and rejects incomplete responses', async () => {
    const lobby = { games: [], members: [], challenges: [], rivalries: [], standings: [], next_cursor: null, record: { wins: 0, losses: 0, draws: 0, played: 0 } };
    backend.rpc.mockResolvedValueOnce({ data: lobby, error: null });
    const cursor = { id: 'last', created_at: '2026-11-01T00:00:00Z' };
    await expect(fetchShowdownLobby('prism_break', cursor)).resolves.toEqual(lobby);
    expect(backend.rpc).toHaveBeenCalledWith('showdown_lobby', { p_game_key: 'prism_break', p_cursor: cursor, p_limit: 30 });
    backend.rpc.mockResolvedValueOnce({ data: {}, error: null });
    await expect(fetchShowdownLobby()).rejects.toThrow(/could not be verified/);
  });
  it('closes invitations with a retryable request identity', async () => {
    await actOnShowdown('challenge-a', 'decline', 'same-action');
    expect(backend.rpc).toHaveBeenCalledWith('showdown_act', { p_challenge_id: 'challenge-a', p_action: 'decline', p_request_id: 'same-action' });
  });
});

describe('Showdown extension points', () => {
  it('registers immutable Prism rules and playable/results adapters without accepting unknown versions', () => {
    const game = getShowdownGame('prism_break', 1)!;
    expect(game.enabled).toBe(true); expect(game.Gameplay).toBeDefined(); expect(game.Results).toBeDefined(); expect(game.Board).toBeDefined();
    expect(game.scoreRound(3, 3)).toBe(500);
    expect(getShowdownGame('prism_break', 2)).toBeUndefined(); expect(getShowdownGame('unknown')).toBeUndefined();
  });
  it('uses installed-game discovery, immersive routing and the existing notification metadata', () => {
    expect(NAV_ASSET_SLUGS['/showdown']).toBe('dh-showdown');
    expect(isGameShellRoute('/showdown/challenge-a')).toBe(true);
    expect(isMobilePrimaryActive('/showdown/a', '/compete')).toBe(true);
    expect(navPathForRoute('/showdown/a')).toBe('/showdown');
    expect(getRouteTitle('/showdown')).toBe('DH Showdown');
    expect(notifIcon('showdown')).not.toEqual(notifIcon('unknown'));
  });
});
