import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actOnShowdown, createShowdown, fetchShowdownMatch, lockCipherCode, parseShowdownMatch, submitCipherGuess, surrenderCipher } from '@/lib/showdown/service';
import { getShowdownGame } from '@/lib/showdown/registry';
import { showdownMatchStructuralSharing } from '@/lib/showdown/monotonic';
import { isGameShellRoute } from '@/lib/appNavigation';
import { cipherFixtureDetail as detail, CIPHER_CODE_A, CIPHER_CODE_B } from './fixtures/cipher';

const backend = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc(...args: unknown[]) { return backend.rpc(...args); } } }));
beforeEach(() => backend.rpc.mockReset().mockResolvedValue({ data: detail(), error: null }));
afterEach(() => vi.restoreAllMocks());

describe('Cipher production transport and registration', () => {
  it('registers a versioned duel without numeric scores or a three-round setup', () => {
    const game = getShowdownGame('cipher_duel', 1)!;
    expect(game.name).toBe('CIPHER DUEL'); expect(game.matchMaxScore).toBeNull(); expect(game.setupMode).toBe('secret_code');
    expect(game.Gameplay).toBeDefined(); expect(game.Results).toBeDefined(); expect(game.Board).toBeDefined();
    expect(getShowdownGame('cipher_duel', 2)).toBeUndefined(); expect(isGameShellRoute('/showdown/cipher/new')).toBe(true);
  });
  it('never creates a Cipher invitation without a valid code', async () => {
    await expect(createShowdown({ recipientId: 'member-b', gameKey: 'cipher_duel' })).rejects.toThrow(/Lock your four-color code/);
    await expect(createShowdown({ recipientId: 'member-b', gameKey: 'cipher_duel', secretCode: ['red', 'blue'] as never })).rejects.toThrow();
    expect(backend.rpc).not.toHaveBeenCalled();
  });
  it('creates the invitation and locked code through one authoritative request, without client result authority', async () => {
    const input = { recipientId: 'member-b', gameKey: 'cipher_duel', secretCode: CIPHER_CODE_A, requestId: 'stable-create', rematchOf: 'old-duel', winnerId: 'member-a', totalScore: 1000 };
    await createShowdown(input);
    expect(backend.rpc).toHaveBeenCalledExactlyOnceWith('showdown_create_cipher', { p_recipient_id: 'member-b', p_code: CIPHER_CODE_A, p_request_id: 'stable-create', p_rematch_of: 'old-duel' });
  });
  it('uses shared GET and decline; opening an invitation does not send a code-lock request', async () => {
    backend.rpc.mockResolvedValue({ data: detail({ phase: 'create_code' }), error: null });
    const invitation = await fetchShowdownMatch('cipher-match', true);
    expect(invitation.can_decline).toBe(true);
    expect(backend.rpc).toHaveBeenCalledExactlyOnceWith('showdown_get', { p_challenge_id: 'cipher-match', p_start: true });
    await actOnShowdown('cipher-match', 'decline', 'decline-retry');
    expect(backend.rpc).toHaveBeenLastCalledWith('showdown_act', { p_challenge_id: 'cipher-match', p_action: 'decline', p_request_id: 'decline-retry' });
  });
  it('submits a code, guess, or surrender with explicit stable identities and authoritative expected count', async () => {
    await lockCipherCode({ challengeId: 'cipher-match', code: CIPHER_CODE_A, requestId: 'lock-retry' });
    await submitCipherGuess({ challengeId: 'cipher-match', guess: CIPHER_CODE_B, expectedGuessCount: 3, requestId: 'guess-retry' });
    await surrenderCipher({ challengeId: 'cipher-match', expectedGuessCount: 3, requestId: 'surrender-retry' });
    expect(backend.rpc.mock.calls).toEqual([
      ['showdown_lock_cipher_code', { p_challenge_id: 'cipher-match', p_code: CIPHER_CODE_A, p_request_id: 'lock-retry' }],
      ['showdown_submit_cipher_guess', { p_challenge_id: 'cipher-match', p_guess: CIPHER_CODE_B, p_expected_guess_count: 3, p_request_id: 'guess-retry' }],
      ['showdown_surrender_cipher', { p_challenge_id: 'cipher-match', p_expected_guess_count: 3, p_request_id: 'surrender-retry' }],
    ]);
  });
  it('accepts zero frozen puzzle rounds and rejects fabricated legacy rounds', () => {
    expect(parseShowdownMatch(detail()).rounds).toEqual([]);
    const fake = detail(); fake.rounds = [{} as never]; expect(() => parseShowdownMatch(fake)).toThrow(/could not be verified/);
  });
  it('rejects opponent secrets, private history fields and final outcomes before both players finish', () => {
    const secret = detail(); Object.assign(secret.cipher!, { opponent_code: CIPHER_CODE_B }); expect(() => parseShowdownMatch(secret)).toThrow();
    const history = detail(); Object.assign(history.cipher!, { opponent_guesses: [] }); expect(() => parseShowdownMatch(history)).toThrow();
    const result = detail(); result.challenge.winner_id = 'member-a'; expect(() => parseShowdownMatch(result)).toThrow(/could not be verified/);
    const premature = detail({ phase: 'completed' }); premature.challenge.status = 'active'; expect(() => parseShowdownMatch(premature)).toThrow();
  });
  it('rejects invalid official feedback and missing mandatory career statistics', () => {
    const value = detail({ guesses: [CIPHER_CODE_A] }); value.cipher!.own_guesses[0].exact = 5;
    expect(() => parseShowdownMatch(value)).toThrow();
    const stats = detail(); delete stats.cipher_statistics; expect(() => parseShowdownMatch(stats)).toThrow(/statistics/);
  });
  it('allows both original codes and verified complete histories only in authorized completed results', () => {
    const value = parseShowdownMatch(detail({ phase: 'completed' }));
    expect(value.cipher!.results).toHaveLength(2); expect(value.challenge.outcome).toBe('draw');
    expect(value.cipher!.results!.every(result => result.attempt.solved && result.guesses.length === 1)).toBe(true);
  });
  it('cannot rewind an official guess, code-lock or final attempt through a delayed poll', () => {
    const old = detail(); const next = detail({ guesses: [CIPHER_CODE_A] });
    expect(showdownMatchStructuralSharing(next, old)).toBe(next);
    const locked = detail(); const unlocked = detail({ phase: 'create_code' });
    expect(showdownMatchStructuralSharing(locked, unlocked)).toBe(locked);
    const sealed = detail({ attemptStatus: 'surrendered' });
    expect(showdownMatchStructuralSharing(sealed, old)).toBe(sealed);
  });
});
