import { describe, expect, it } from 'vitest';
import { calculateFeedback, CipherValidationError, compareAttempts, validateCipherAttempt, validateCipherView, validateCode } from '@/lib/showdown/cipher/engine';
import { CIPHER_COLOR_IDS, CIPHER_MAX_GUESSES, type CipherAttempt, type CipherCode, type CipherColorId, type CipherGuess, type CipherView } from '@/lib/showdown/cipher/types';

const colors: Record<string, CipherColorId> = { R: 'red', B: 'blue', G: 'green', Y: 'yellow', P: 'purple', O: 'orange' };
const code = (short: string): CipherCode => short.split('').map(letter => colors[letter]) as CipherCode;
const at = '2026-11-01T12:00:00.000Z';
const end = '2026-11-01T12:01:00.000Z';
const expiry = '2026-11-04T12:00:00.000Z';
const attempt = (status: CipherAttempt['status'], guesses_used = 0): CipherAttempt => ({ status, guesses_used, solved: status === 'solved', finished_at: ['solved','exhausted','surrendered'].includes(status) ? end : null });
const guess = (colors: CipherCode, sequence: number, exact = 0, color_only = 0): CipherGuess => ({ sequence, colors, exact, color_only, submitted_at: at });
function view(): CipherView {
  return { phase: 'create_code', own_code: null, own_code_locked_at: null, opponent_code_locked: false, opponent_finished: false,
    invitation_expires_at: expiry, gameplay_started_at: null, gameplay_expires_at: null, own_guesses: [], own_attempt: attempt('pending'), results: null };
}
function playing(): CipherView {
  return { ...view(), phase: 'codebreaking', own_code: code('RGBY'), own_code_locked_at: at, opponent_code_locked: true,
    gameplay_started_at: at, gameplay_expires_at: expiry, own_attempt: attempt('playing') };
}
function completed(): CipherView {
  const own = code('RGBY'), rival = code('POPO');
  const ownGuess = guess(rival, 1, 4), rivalGuess = guess(own, 1, 4), sealed = attempt('solved', 1);
  return { ...playing(), phase: 'completed', opponent_finished: true, own_guesses: [ownGuess], own_attempt: sealed,
    results: [{ user_id: 'member-a', code: own, guesses: [ownGuess], attempt: sealed }, { user_id: 'member-b', code: rival, guesses: [rivalGuess], attempt: sealed }] };
}

describe('Cipher Duel version-one feedback', () => {
  it.each([
    ['RGBY','RGBY',4,0], ['RRBG','RBRY',1,2], ['RRBB','RRRR',2,0],
    ['RRBB','BBRR',0,4], ['RRRR','GGGG',0,0], ['RGBY','POPO',0,0],
  ])('evaluates %s against %s as exact=%i color-only=%i', (secret, choice, exact, color_only) => {
    expect(calculateFeedback(code(String(secret)), code(String(choice)))).toEqual({ exact, color_only });
  });
  it('allows repeated colors, including all four equal pegs, without mutating either code', () => {
    const secret = Object.freeze(code('RRRR')), choice = Object.freeze(code('RRRB'));
    expect(() => validateCode(secret)).not.toThrow();
    expect(calculateFeedback(secret, choice)).toEqual({ exact: 3, color_only: 0 });
    expect(secret).toEqual(code('RRRR')); expect(choice).toEqual(code('RRRB'));
  });
  it('rejects incomplete codes, out-of-range colors, sparse pegs, uppercase IDs and extra pegs', () => {
    for (const invalid of [null, {}, [], ['red'], Array(4), ['red','blue','green',null], ['red','blue','green','cyan'], ['RED','blue','green','yellow'], [...code('RGBY'),'orange']]) {
      expect(() => validateCode(invalid)).toThrow(CipherValidationError);
    }
  });
  it('matches an independent frequency oracle for every one of 1,679,616 secret/guess pairs', () => {
    const all: { code: CipherCode; frequencies: number[] }[] = [];
    for (const a of CIPHER_COLOR_IDS) for (const b of CIPHER_COLOR_IDS) for (const c of CIPHER_COLOR_IDS) for (const d of CIPHER_COLOR_IDS) {
      const pegs: CipherCode = [a,b,c,d];
      all.push({ code: pegs, frequencies: CIPHER_COLOR_IDS.map(color => pegs.filter(peg => peg === color).length) });
    }
    let tested = 0;
    for (const secret of all) for (const choice of all) {
      const exact = secret.code.reduce((total, peg, index) => total + Number(peg === choice.code[index]), 0);
      const common = secret.frequencies.reduce((total, count, index) => total + Math.min(count, choice.frequencies[index]), 0);
      const actual = calculateFeedback(secret.code, choice.code);
      if (actual.exact !== exact || actual.color_only !== common - exact || actual.exact + actual.color_only > 4) {
        throw new Error(`Feedback mismatch for ${JSON.stringify(secret.code)} / ${JSON.stringify(choice.code)}: ${JSON.stringify(actual)}`);
      }
      tested++;
    }
    expect(all).toHaveLength(1296); expect(tested).toBe(1_679_616);
  }, 20_000);
});

describe('Cipher Duel terminal attempts and winners', () => {
  it('compares four versus seven solved guesses and eight solved guesses versus failure', () => {
    expect(compareAttempts(attempt('solved', 4), attempt('solved', 7))).toBe('first');
    expect(compareAttempts(attempt('solved', 8), attempt('exhausted', 10))).toBe('first');
    expect(compareAttempts(attempt('surrendered', 2), attempt('solved', 10))).toBe('second');
  });
  it('draws equal solved counts or any two failed attempts, independently of elapsed time', () => {
    expect(compareAttempts(attempt('solved', 6), { ...attempt('solved', 6), finished_at: expiry })).toBe('draw');
    expect(compareAttempts(attempt('exhausted', 10), attempt('exhausted', 10))).toBe('draw');
    expect(compareAttempts(attempt('surrendered', 0), attempt('exhausted', 10))).toBe('draw');
    expect(compareAttempts(attempt('surrendered', 1), attempt('surrendered', 9))).toBe('draw');
  });
  it('permits a first-guess and tenth-guess solve but prevents an eleventh guess or premature comparison', () => {
    expect(CIPHER_MAX_GUESSES).toBe(10);
    expect(() => validateCipherAttempt(attempt('solved', 1))).not.toThrow();
    expect(() => validateCipherAttempt(attempt('solved', 10))).not.toThrow();
    expect(compareAttempts(attempt('solved', 1), attempt('solved', 10))).toBe('first');
    expect(() => validateCipherAttempt(attempt('solved', 11))).toThrow();
    expect(() => validateCipherAttempt(attempt('solved', 0))).toThrow();
    expect(() => validateCipherAttempt(attempt('playing', 10))).toThrow();
    expect(() => validateCipherAttempt(attempt('exhausted', 9))).toThrow();
    expect(() => validateCipherAttempt(attempt('surrendered', 10))).toThrow();
    expect(() => compareAttempts(attempt('playing', 0), attempt('solved', 4))).toThrow(/Finish both/);
  });
});

describe('Cipher Duel public transport privacy and progression', () => {
  it('validates code creation, waiting for a rival code, and active codebreaking without revealing a rival secret', () => {
    const waiting: CipherView = { ...view(), phase: 'waiting_code', own_code: code('RRRR'), own_code_locked_at: at };
    for (const publicView of [view(), waiting, playing()]) expect(() => validateCipherView(publicView, { completed: false })).not.toThrow();
    const active = playing(); active.own_guesses = [guess(code('RRRR'), 1, 1, 0)]; active.own_attempt.guesses_used = 1;
    expect(() => validateCipherView(active, { completed: false })).not.toThrow();
  });
  it('rejects unknown fields, opponent secrets/histories, answer positions and results before shared completion', () => {
    for (const leaked of [
      { ...playing(), opponent_code: code('POPO') }, { ...playing(), opponent_guesses: [] },
      { ...playing(), results: completed().results }, { ...playing(), own_guesses: [{ ...guess(code('RRRR'), 1), positions: [0,1,2,3] }] },
    ]) expect(() => validateCipherView(leaked, { completed: false })).toThrow();
    expect(() => validateCipherView(completed(), { completed: false })).toThrow(/sealed/);
  });
  it('requires contiguous guesses, valid aggregate feedback, one final exact solve and the ten-guess limit', () => {
    const badSequence = playing(); badSequence.own_guesses = [guess(code('RRRR'), 2)]; badSequence.own_attempt.guesses_used = 1;
    expect(() => validateCipherView(badSequence, { completed: false })).toThrow(/feedback/);
    const positionalImpossible = playing(); positionalImpossible.own_guesses = [guess(code('RRRR'), 1, 3, 1)]; positionalImpossible.own_attempt.guesses_used = 1;
    expect(() => validateCipherView(positionalImpossible, { completed: false })).toThrow(/feedback/);
    const ignoredSolve = playing(); ignoredSolve.own_guesses = [guess(code('POPO'), 1, 4)]; ignoredSolve.own_attempt.guesses_used = 1;
    expect(() => validateCipherView(ignoredSolve, { completed: false })).toThrow(/progression/);
    const exhausted = playing(); exhausted.phase = 'attempt_sealed'; exhausted.own_guesses = Array.from({ length: 10 }, (_, i) => guess(code('RRRR'), i + 1)); exhausted.own_attempt = attempt('exhausted', 10);
    expect(() => validateCipherView(exhausted, { completed: false })).not.toThrow();
    const tenthSolve = { ...exhausted, own_guesses: [...exhausted.own_guesses.slice(0, 9), guess(code('POPO'), 10, 4)], own_attempt: attempt('solved', 10) };
    expect(() => validateCipherView(tenthSolve, { completed: false })).not.toThrow();
  });
  it('opens only two distinct terminal participant results and verifies feedback against the opposite chosen code', () => {
    const options = { completed: true, viewerId: 'member-a', participantIds: ['member-a','member-b'] };
    expect(() => validateCipherView(completed(), options)).not.toThrow();
    const forged = completed(); forged.results![0].guesses[0] = guess(code('RRRR'), 1, 4); forged.own_guesses = forged.results![0].guesses;
    expect(() => validateCipherView(forged, options)).toThrow(/feedback/);
    const outsider = completed(); outsider.results![1].user_id = 'outsider';
    expect(() => validateCipherView(outsider, options)).toThrow(/membership/);
    const duplicated = completed(); duplicated.results![1].user_id = 'member-a';
    expect(() => validateCipherView(duplicated, options)).toThrow(/membership/);
    expect(() => validateCipherView(playing(), options)).toThrow(/completed/);
  });
  it('validates completed-only career metrics without inventing averages for zero solves', () => {
    const fresh = view();
    fresh.statistics = { played: 0, wins: 0, losses: 0, draws: 0, solved_count: 0, failed_count: 0,
      successful_guesses_total: 0, average_guesses_to_solve: null, best_guess_count: null,
      first_guess_solves: 0, current_win_streak: 0, longest_win_streak: 0 };
    expect(() => validateCipherView(fresh, { completed: false })).not.toThrow();
    const veteran = completed();
    veteran.statistics = { played: 4, wins: 2, losses: 1, draws: 1, solved_count: 3, failed_count: 1,
      successful_guesses_total: 12, average_guesses_to_solve: 4, best_guess_count: 1,
      first_guess_solves: 1, current_win_streak: 1, longest_win_streak: 2 };
    expect(() => validateCipherView(veteran, { completed: true })).not.toThrow();
    veteran.statistics.failed_count = 0;
    expect(() => validateCipherView(veteran, { completed: true })).toThrow(/statistics totals/);
    fresh.statistics.average_guesses_to_solve = 0;
    expect(() => validateCipherView(fresh, { completed: false })).toThrow(/unsolved/);
  });
  it('validates phase/deadline boundaries and accepts closed matches without exposing secret review', () => {
    const missingClock = playing(); missingClock.gameplay_started_at = null;
    expect(() => validateCipherView(missingClock, { completed: false })).toThrow(/window/);
    const resetWindow = playing(); resetWindow.gameplay_expires_at = at;
    expect(() => validateCipherView(resetWindow, { completed: false })).toThrow(/window/);
    const closed = { ...playing(), phase: 'closed' as const };
    expect(() => validateCipherView(closed, { completed: false })).not.toThrow();
    const leaked = { ...closed, results: completed().results };
    expect(() => validateCipherView(leaked, { completed: false })).toThrow(/sealed/);
  });
});
