import { calculateFeedback, compareAttempts } from '@/lib/showdown/cipher/engine';
import type { CipherAttempt, CipherAttemptStatus, CipherCode, CipherGuess, CipherPhase, CipherStats, CipherView } from '@/lib/showdown/cipher/types';
import type { ShowdownChallenge, ShowdownMatchDetail } from '@/lib/showdown/types';

export const CIPHER_TEST_A = 'member-a';
export const CIPHER_TEST_B = 'member-b';
export const CIPHER_TEST_MATCH = 'cipher-match';
export const CIPHER_CODE_A: CipherCode = ['red', 'red', 'blue', 'green'];
export const CIPHER_CODE_B: CipherCode = ['purple', 'orange', 'purple', 'orange'];
const created = '2026-11-01T00:00:00.000Z';
const started = '2026-11-01T00:01:00.000Z';
const finished = '2026-11-01T00:03:00.000Z';
const invitationExpires = '2026-11-04T00:00:00.000Z';
const gameplayExpires = '2026-11-04T00:01:00.000Z';
export interface CipherFixtureOptions {
  id?: string;
  userId?: string;
  clubId?: string;
  phase?: CipherPhase;
  guesses?: readonly CipherCode[];
  opponentGuesses?: readonly CipherCode[];
  attemptStatus?: CipherAttemptStatus;
  opponentStatus?: CipherAttemptStatus;
  opponentFinished?: boolean;
  ownCode?: CipherCode | null;
  opponentCode?: CipherCode;
  closedStatus?: 'expired' | 'declined' | 'cancelled';
}
function history(codes: readonly CipherCode[], secret: CipherCode): CipherGuess[] {
  return codes.map((colors, index) => ({ sequence: index + 1, colors: [...colors], ...calculateFeedback(secret, colors), submitted_at: `2026-11-01T00:02:${String(index).padStart(2, '0')}.000Z` }));
}
function attempt(status: CipherAttemptStatus, guesses: CipherGuess[]): CipherAttempt {
  return { status, guesses_used: guesses.length, solved: status === 'solved', finished_at: ['solved','exhausted','surrendered'].includes(status) ? finished : null };
}
/** Realistic test-only DTO: no manufactured puzzle rounds, private rivals stay sealed. */
export function cipherFixtureDetail(options: CipherFixtureOptions = {}): ShowdownMatchDetail {
  const id = options.id ?? CIPHER_TEST_MATCH, userId = options.userId ?? (options.phase === 'create_code' ? CIPHER_TEST_B : CIPHER_TEST_A), clubId = options.clubId ?? 'club-1';
  const opponentId = userId === CIPHER_TEST_A ? CIPHER_TEST_B : CIPHER_TEST_A;
  const phase = options.phase ?? 'codebreaking', complete = phase === 'completed', closed = phase === 'closed';
  const pregame = phase === 'create_code' || phase === 'waiting_code';
  const ownDefault = userId === CIPHER_TEST_A ? CIPHER_CODE_A : CIPHER_CODE_B;
  const ownCode = options.ownCode === undefined ? phase === 'create_code' ? null : [...ownDefault] as CipherCode : options.ownCode;
  const opponentCode = options.opponentCode ?? (userId === CIPHER_TEST_A ? CIPHER_CODE_B : CIPHER_CODE_A);
  const ownGuesses = history(options.guesses ?? (complete ? [opponentCode] : []), opponentCode);
  const opponentGuesses = history(options.opponentGuesses ?? (complete ? [ownCode ?? ownDefault] : []), ownCode ?? ownDefault);
  const ownStatus = options.attemptStatus ?? (complete ? 'solved' : phase === 'attempt_sealed' ? 'surrendered' : pregame ? 'pending' : 'playing');
  const opponentStatus = options.opponentStatus ?? (complete ? 'solved' : pregame ? 'pending' : 'playing');
  const ownAttempt = attempt(ownStatus, ownGuesses), opponentAttempt = attempt(opponentStatus, opponentGuesses);
  const opponentFinished = options.opponentFinished ?? opponentAttempt.finished_at !== null;
  const comparison = complete ? compareAttempts(ownAttempt, opponentAttempt) : null;
  const winnerId = comparison === 'first' ? userId : comparison === 'second' ? opponentId : null;
  const record = { played: complete ? 1 : 0, wins: comparison === 'first' ? 1 : 0, losses: comparison === 'second' ? 1 : 0, draws: comparison === 'draw' ? 1 : 0 };
  const stats: CipherStats = { ...record, solved_count: complete && ownAttempt.solved ? 1 : 0, failed_count: complete && !ownAttempt.solved ? 1 : 0,
    successful_guesses_total: complete && ownAttempt.solved ? ownGuesses.length : 0,
    average_guesses_to_solve: complete && ownAttempt.solved ? ownGuesses.length : null, best_guess_count: complete && ownAttempt.solved ? ownGuesses.length : null,
    first_guess_solves: complete && ownAttempt.solved && ownGuesses.length === 1 ? 1 : 0, current_win_streak: record.wins, longest_win_streak: record.wins };
  const view: CipherView = { phase, own_code: ownCode ? [...ownCode] : null, own_code_locked_at: ownCode ? created : null,
    opponent_code_locked: phase !== 'waiting_code', opponent_finished: opponentFinished,
    invitation_expires_at: invitationExpires, gameplay_started_at: pregame ? null : started, gameplay_expires_at: pregame ? null : gameplayExpires,
    own_guesses: ownGuesses, own_attempt: ownAttempt,
    results: complete ? [{ user_id: userId, code: [...ownCode!], guesses: ownGuesses, attempt: ownAttempt }, { user_id: opponentId, code: [...opponentCode], guesses: opponentGuesses, attempt: opponentAttempt }] : null };
  const status: ShowdownChallenge['status'] = closed ? options.closedStatus ?? 'expired' : complete ? 'completed' : pregame ? 'pending' : 'active';
  return { challenge: { id, club_id: clubId, game_key: 'cipher_duel', rules_version: 1, status, challenger_id: CIPHER_TEST_A, recipient_id: CIPHER_TEST_B,
      created_at: created, expires_at: pregame ? invitationExpires : gameplayExpires, completed_at: complete ? finished : null, winner_id: winnerId, outcome: complete ? winnerId ? 'winner' : 'draw' : null, rematch_of: null,
      players: [userId,opponentId].map((memberId, index) => ({ user_id: memberId, display_name: index === 0 ? 'Alex' : 'Blair', avatar_url: null,
        started_at: pregame ? memberId === CIPHER_TEST_A ? created : null : started,
        finished_at: (index === 0 ? ownAttempt : opponentAttempt).finished_at, rounds_completed: 0,
        total_score: index === 0 || complete ? 0 : null, solved_count: index === 0 || complete ? Number((index === 0 ? ownAttempt : opponentAttempt).solved) : null, rotations: index === 0 || complete ? 0 : null })),
      cipher: { own_code_locked: ownCode !== null, opponent_code_locked: view.opponent_code_locked, own_status: ownStatus, own_guesses_used: ownGuesses.length, opponent_finished: opponentFinished, gameplay_started_at: view.gameplay_started_at } },
    rounds: [], current_round: null, cipher: view, cipher_statistics: stats,
    can_play: phase === 'codebreaking', can_decline: phase === 'create_code' && userId === CIPHER_TEST_B, can_cancel: phase === 'waiting_code' && userId === CIPHER_TEST_A,
    readonly_reason: closed ? 'Challenge expired' : phase === 'attempt_sealed' ? 'Your attempt is sealed.' : null,
    record, rivalry: { ...record, opponent_id: opponentId, display_name: 'Blair', avatar_url: null } };
}
