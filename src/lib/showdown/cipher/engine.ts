import {
  CIPHER_CODE_LENGTH, CIPHER_COLOR_IDS, CIPHER_MAX_GUESSES,
  type CipherAttempt, type CipherCode, type CipherColorId, type CipherFeedback,
  type CipherGuess, type CipherMatchComparison, type CipherResult, type CipherStats,
  type CipherView, type CipherViewValidationOptions,
} from './types';

export class CipherValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'CipherValidationError'; }
}
function fail(message: string): never { throw new CipherValidationError(message); }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const only = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
const integer = (value: unknown, min: number, max: number): value is number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const userId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;
const terminal = new Set(['solved', 'exhausted', 'surrendered']);

/** Codes have exactly four pegs. Repeated colors, including four equal pegs, are legal. */
export function validateCode(value: unknown): asserts value is CipherCode {
  if (!Array.isArray(value) || value.length !== CIPHER_CODE_LENGTH
    || !Array.from(value).every(color => (CIPHER_COLOR_IDS as readonly unknown[]).includes(color))) fail('Choose exactly four valid Cipher colors.');
}

/** Aggregate feedback only: consume exact pegs first, then each remaining secret peg once. */
export function calculateFeedback(secret: readonly CipherColorId[], guess: readonly CipherColorId[]): CipherFeedback {
  validateCode(secret); validateCode(guess);
  let exact = 0, color_only = 0;
  const remaining = new Map<CipherColorId, number>();
  for (let i = 0; i < CIPHER_CODE_LENGTH; i++) {
    if (secret[i] === guess[i]) exact++;
    else remaining.set(secret[i], (remaining.get(secret[i]) ?? 0) + 1);
  }
  for (let i = 0; i < CIPHER_CODE_LENGTH; i++) {
    if (secret[i] === guess[i]) continue;
    const available = remaining.get(guess[i]) ?? 0;
    if (available > 0) { color_only++; remaining.set(guess[i], available - 1); }
  }
  return { exact, color_only };
}

export function validateCipherAttempt(value: unknown): asserts value is CipherAttempt {
  if (!record(value) || !only(value, ['status', 'guesses_used', 'solved', 'finished_at'])
    || !['pending', 'playing', 'solved', 'exhausted', 'surrendered'].includes(String(value.status))
    || !integer(value.guesses_used, 0, CIPHER_MAX_GUESSES) || typeof value.solved !== 'boolean'
    || value.finished_at !== null && !timestamp(value.finished_at)) fail('Invalid Cipher attempt.');
  if (value.solved !== (value.status === 'solved')
    || terminal.has(String(value.status)) !== (value.finished_at !== null)
    || value.status === 'pending' && value.guesses_used !== 0
    || value.status === 'playing' && value.guesses_used >= CIPHER_MAX_GUESSES
    || value.status === 'solved' && value.guesses_used < 1
    || value.status === 'exhausted' && value.guesses_used !== CIPHER_MAX_GUESSES
    || value.status === 'surrendered' && value.guesses_used >= CIPHER_MAX_GUESSES) fail('Invalid Cipher attempt progression.');
}

/** Only solved status and guesses used decide the outcome; failures and surrenders draw. */
export function compareAttempts(first: CipherAttempt, second: CipherAttempt): CipherMatchComparison {
  validateCipherAttempt(first); validateCipherAttempt(second);
  if (!terminal.has(first.status) || !terminal.has(second.status)) fail('Finish both Cipher attempts before comparing results.');
  if (first.solved !== second.solved) return first.solved ? 'first' : 'second';
  if (!first.solved || first.guesses_used === second.guesses_used) return 'draw';
  return first.guesses_used < second.guesses_used ? 'first' : 'second';
}

function validateHistory(value: unknown, attempt: CipherAttempt): asserts value is CipherGuess[] {
  if (!Array.isArray(value) || value.length !== attempt.guesses_used) fail('Invalid Cipher guess history.');
  let previousTime = -Infinity;
  for (let i = 0; i < value.length; i++) {
    const guess = value[i];
    if (!record(guess) || !only(guess, ['sequence', 'colors', 'exact', 'color_only', 'submitted_at'])
      || guess.sequence !== i + 1 || !integer(guess.exact, 0, CIPHER_CODE_LENGTH)
      || !integer(guess.color_only, 0, CIPHER_CODE_LENGTH) || guess.exact + guess.color_only > CIPHER_CODE_LENGTH
      || guess.exact === 3 && guess.color_only === 1 || !timestamp(guess.submitted_at)) fail('Invalid Cipher feedback.');
    validateCode(guess.colors);
    if (Date.parse(guess.submitted_at) < previousTime || guess.exact === CIPHER_CODE_LENGTH && (i !== value.length - 1 || !attempt.solved)) fail('Invalid Cipher guess progression.');
    previousTime = Date.parse(guess.submitted_at);
  }
  if (attempt.solved && value[value.length - 1]?.exact !== CIPHER_CODE_LENGTH) fail('A solved Cipher attempt must end in four exact pegs.');
  if (attempt.finished_at !== null && Date.parse(attempt.finished_at) < previousTime) fail('Invalid Cipher completion time.');
}

function validateStatistics(value: unknown): asserts value is CipherStats {
  const counts = ['played', 'wins', 'losses', 'draws', 'solved_count', 'failed_count', 'successful_guesses_total', 'first_guess_solves', 'current_win_streak', 'longest_win_streak'];
  if (!record(value) || !only(value, [...counts, 'average_guesses_to_solve', 'best_guess_count'])
    || counts.some(key => !integer(value[key], 0, Number.MAX_SAFE_INTEGER))) fail('Invalid Cipher statistics.');
  const stats = value as unknown as CipherStats;
  if (stats.played !== stats.wins + stats.losses + stats.draws || stats.played !== stats.solved_count + stats.failed_count
    || stats.first_guess_solves > stats.solved_count || stats.successful_guesses_total < stats.solved_count
    || stats.successful_guesses_total > stats.solved_count * CIPHER_MAX_GUESSES
    || stats.current_win_streak > stats.longest_win_streak || stats.longest_win_streak > stats.wins) fail('Invalid Cipher statistics totals.');
  if (stats.solved_count === 0) {
    if (stats.average_guesses_to_solve !== null || stats.best_guess_count !== null) fail('Invalid unsolved Cipher statistics.');
  } else if (typeof stats.average_guesses_to_solve !== 'number' || !Number.isFinite(stats.average_guesses_to_solve)
    || stats.average_guesses_to_solve < 1 || stats.average_guesses_to_solve > CIPHER_MAX_GUESSES
    || !integer(stats.best_guess_count, 1, CIPHER_MAX_GUESSES)
    || stats.best_guess_count > stats.average_guesses_to_solve
    || (stats.first_guess_solves > 0) !== (stats.best_guess_count === 1)) fail('Invalid solved Cipher statistics.');
}
export { validateStatistics as validateCipherStatistics };

/**
 * Strict member-facing transport validation. Only a completed shared challenge
 * may reveal the opponent's code and history; all other payloads reject them.
 */
export function validateCipherView(value: unknown, options: CipherViewValidationOptions): asserts value is CipherView {
  const fields = ['phase', 'own_code', 'own_code_locked_at', 'opponent_code_locked', 'opponent_finished', 'invitation_expires_at',
    'gameplay_started_at', 'gameplay_expires_at', 'own_guesses', 'own_attempt', 'results', 'statistics'];
  if (!record(value) || !only(value, fields)
    || !['create_code', 'waiting_code', 'codebreaking', 'attempt_sealed', 'completed', 'closed'].includes(String(value.phase))
    || typeof value.opponent_code_locked !== 'boolean' || typeof value.opponent_finished !== 'boolean'
    || !timestamp(value.invitation_expires_at)
    || value.own_code_locked_at !== null && !timestamp(value.own_code_locked_at)
    || value.gameplay_started_at !== null && !timestamp(value.gameplay_started_at)
    || value.gameplay_expires_at !== null && !timestamp(value.gameplay_expires_at)) fail('Invalid Cipher view.');
  if (value.own_code !== null) validateCode(value.own_code);
  if ((value.own_code !== null) !== (value.own_code_locked_at !== null)) fail('Invalid locked Cipher code.');
  validateCipherAttempt(value.own_attempt); validateHistory(value.own_guesses, value.own_attempt);
  const started = value.gameplay_started_at !== null;
  if (started !== (value.gameplay_expires_at !== null)
    || started && (value.own_code === null || !value.opponent_code_locked
      || Date.parse(value.gameplay_expires_at as string) <= Date.parse(value.gameplay_started_at as string))
    || value.opponent_finished && !started) fail('Invalid Cipher gameplay window.');
  if (value.phase === 'create_code' && (value.own_code !== null || started || value.own_attempt.status !== 'pending')
    || value.phase === 'waiting_code' && (value.own_code === null || value.opponent_code_locked || started || value.own_attempt.status !== 'pending')
    || value.phase === 'codebreaking' && (!started || value.own_attempt.status !== 'playing')
    || value.phase === 'attempt_sealed' && (!started || !terminal.has(value.own_attempt.status))) fail('Invalid Cipher phase progression.');
  if (!options.completed) {
    if (value.results !== null || value.phase === 'completed') fail('Cipher secrets remain sealed until both attempts finish.');
  } else {
    if (value.phase !== 'completed' || !value.opponent_finished || !started || !terminal.has(value.own_attempt.status) || !Array.isArray(value.results) || value.results.length !== 2) fail('Invalid completed Cipher results.');
    for (const result of value.results) {
      if (!record(result) || !only(result, ['user_id', 'code', 'guesses', 'attempt']) || !userId(result.user_id)) fail('Invalid Cipher participant result.');
      validateCode(result.code); validateCipherAttempt(result.attempt); validateHistory(result.guesses, result.attempt);
      if (!terminal.has(result.attempt.status)) fail('Both Cipher attempts must finish before review.');
    }
    const results = value.results as [CipherResult, CipherResult];
    if (results[0].user_id === results[1].user_id
      || options.participantIds && (options.participantIds.length !== 2 || new Set(options.participantIds).size !== 2
        || results.some(result => !options.participantIds!.includes(result.user_id)))) fail('Invalid Cipher result membership.');
    for (let i = 0; i < results.length; i++) for (const guess of results[i].guesses) {
      const expected = calculateFeedback(results[1 - i].code, guess.colors);
      if (guess.exact !== expected.exact || guess.color_only !== expected.color_only) fail('Invalid completed Cipher feedback.');
    }
    if (options.viewerId) {
      const mine = results.find(result => result.user_id === options.viewerId);
      if (!mine || JSON.stringify(mine.code) !== JSON.stringify(value.own_code)
        || mine.attempt.status !== value.own_attempt.status || mine.attempt.guesses_used !== value.own_attempt.guesses_used
        || mine.attempt.solved !== value.own_attempt.solved || mine.attempt.finished_at !== value.own_attempt.finished_at
        || mine.guesses.length !== value.own_guesses.length || mine.guesses.some((guess, i) => {
          const own = value.own_guesses[i];
          return guess.sequence !== own.sequence || guess.exact !== own.exact || guess.color_only !== own.color_only
            || guess.submitted_at !== own.submitted_at || JSON.stringify(guess.colors) !== JSON.stringify(own.colors);
        })) fail('The Cipher review does not match your sealed attempt.');
    }
  }
  if (value.statistics !== undefined) validateStatistics(value.statistics);
}
