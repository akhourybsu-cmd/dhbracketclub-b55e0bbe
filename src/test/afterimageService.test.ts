import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShowdown, parseShowdownMatch, startAfterimageStudy, saveAfterimageReconstruction, submitAfterimageReconstruction } from '@/lib/showdown/service';
import { showdownMatchStructuralSharing } from '@/lib/showdown/monotonic';
import { getShowdownGame } from '@/lib/showdown/registry';
import type { ShowdownReconstructionInput } from '@/lib/showdown/types';
import { afterimageFixtureDetail as detail, afterimageFixtureScene } from './fixtures/afterimage';

const backend = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc(...args: unknown[]) { return backend.rpc(...args); } } }));
beforeEach(() => backend.rpc.mockReset().mockResolvedValue({ data: detail({ phase: 'ready', revision: 0 }), error: null }));
afterEach(() => vi.restoreAllMocks());

describe('Afterimage production transport and privacy', () => {
  it('registers a versioned second game with its own375 cap and result adapter while preserving Prism', () => {
    const game = getShowdownGame('afterimage', 1)!;
    expect(game.matchMaxScore).toBe(375); expect(game.roundNoun).toBe('scenes'); expect(game.Gameplay).toBeDefined(); expect(game.Results).toBeDefined();
    expect(game.compareResults({ totalScore: 200, perfectRounds: 1 }, { totalScore: 200, perfectRounds: 0 })).toBe('first');
    expect(getShowdownGame('afterimage', 2)).toBeUndefined(); expect(getShowdownGame('prism_break', 1)!.matchMaxScore).toBe(1500);
  });
  it('creates Afterimage through the same invitation RPC without sending scores or private scenes', async () => {
    await createShowdown({ recipientId: 'member-b', gameKey: 'afterimage', requestId: 'create-retry' });
    expect(backend.rpc).toHaveBeenCalledExactlyOnceWith('showdown_create', { p_recipient_id: 'member-b', p_game_key: 'afterimage', p_request_id: 'create-retry', p_rematch_of: null });
  });
  it('starts observation with only match, round and retry identity; the server owns the clock', async () => {
    backend.rpc.mockResolvedValue({ data: detail({ phase: 'study' }), error: null });
    const value = await startAfterimageStudy('memory-match', 1, 'study-retry');
    expect(backend.rpc).toHaveBeenCalledExactlyOnceWith('showdown_start_study', { p_challenge_id: 'memory-match', p_round_number: 1, p_request_id: 'study-retry' });
    expect(value.rounds[0].scene?.observation_remaining_ms).toBeGreaterThan(0);
    expect(value.rounds[0].scene?.observation_remaining_ms).toBeLessThanOrEqual(6000);
  });
  it('uses server timestamp differences and monotonic receipt time despite manipulated device wall time', () => {
    vi.spyOn(Date, 'now').mockReturnValue(9_999_999_999_999);
    const value = parseShowdownMatch(detail({ phase: 'study' }), 750);
    expect(value.rounds[0].scene?.observation_remaining_ms).toBe(5250);
    expect(value.rounds[0].scene?.observation_received_at).toBeGreaterThanOrEqual(0);
    expect(parseShowdownMatch(detail({ phase: 'study' }), 7000).rounds[0].scene?.observation_remaining_ms).toBe(0);
  });
  it('sends only final placements, revision and stable retry ID for editable saves and final submissions', async () => {
    const input: ShowdownReconstructionInput = { challengeId: 'memory-match', roundNumber: 1, placements: [{ object_id: 'object-book', slot_id: 'place-1' }], expectedRevision: 2, requestId: 'placement-retry' };
    await saveAfterimageReconstruction(input); await submitAfterimageReconstruction(input);
    const args = { p_challenge_id: input.challengeId, p_round_number: 1, p_placements: input.placements, p_expected_revision: 2, p_request_id: 'placement-retry' };
    expect(backend.rpc.mock.calls).toEqual([['showdown_save_reconstruction', args], ['showdown_submit_reconstruction', args]]);
  });
  it('rejects private answer maps, hidden original coordinates and correctness hints before submission', () => {
    const leaked = detail(); leaked.rounds[0].scene!.answers = [{ object_id: 'object-book', slot_id: 'place-1' }];
    expect(() => parseShowdownMatch(leaked)).toThrow();
    const original = detail(); original.rounds[0].scene!.objects = afterimageFixtureScene().objects;
    expect(() => parseShowdownMatch(original)).toThrow();
    const feedback = detail(); feedback.rounds[0].me.correct_count = 1;
    expect(() => parseShowdownMatch(feedback)).toThrow(/could not be verified/);
    const opponent = detail(); opponent.rounds[0].opponent = { ...opponent.rounds[0].me, placements: [] };
    expect(() => parseShowdownMatch(opponent)).toThrow(/could not be verified/);
  });
  it('rejects invalid or duplicate placement identities returned by an unexpected response', () => {
    const duplicated = detail({ placements: [{ object_id: 'object-book', slot_id: 'place-1' }, { object_id: 'object-lantern', slot_id: 'place-1' }] });
    expect(() => parseShowdownMatch(duplicated)).toThrow(/at most once/);
    expect(() => parseShowdownMatch(detail({ placements: [{ object_id: 'unknown-object', slot_id: 'place-1' }] }))).toThrow();
  });
  it('allows canonical scene comparison only in a completed match', () => {
    const value = parseShowdownMatch(detail({ completed: 3, final: true }));
    expect(value.rounds.every(round => round.scene?.phase === 'review' && round.scene.answers?.length)).toBe(true);
    const pending = detail({ completed: 3, final: true }); pending.challenge.status = 'active';
    expect(() => parseShowdownMatch(pending)).toThrow();
  });
  it('keeps reconstruction when an older study response arrives, but accepts a fresh terminal closure', () => {
    const reconstruction = detail(); const oldStudy = detail({ phase: 'study' });
    expect(showdownMatchStructuralSharing(reconstruction, oldStudy)).toBe(reconstruction);
    const closed = detail({ phase: 'ready' }); closed.challenge.status = 'cancelled'; closed.can_play = false;
    expect(showdownMatchStructuralSharing(reconstruction, closed)).toBe(closed);
    expect(showdownMatchStructuralSharing(closed, oldStudy)).toBe(closed);
  });
  it('opens closed history safely when all scene art is removed but the member’s own saved placements remain', () => {
    const closed = detail({ placements: [{ object_id: 'object-book', slot_id: 'place-1' }] });
    closed.challenge.status = 'expired'; closed.can_play = false;
    closed.rounds.forEach(round => { round.scene = null; });
    expect(parseShowdownMatch(closed).challenge.status).toBe('expired');
  });
  it('rejects a scene whose content version disagrees with its frozen round', () => {
    const changed = detail(); changed.rounds[0].scene!.version = 2;
    expect(() => parseShowdownMatch(changed)).toThrow(/scene version could not be verified/);
  });
});
