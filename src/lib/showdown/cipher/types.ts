/** Cipher Duel v1 identities are stable across rendering, transport and server rules. */
export const CIPHER_RULES_VERSION = 1;
export const CIPHER_CODE_LENGTH = 4;
export const CIPHER_MAX_GUESSES = 10;
export const CIPHER_COLOR_IDS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const;
export type CipherColorId = typeof CIPHER_COLOR_IDS[number];
/** Editable device-only draft; callers keep exactly four slots, using null for blanks. */
export type CipherDraft = (CipherColorId | null)[];
export type CipherCode = [CipherColorId, CipherColorId, CipherColorId, CipherColorId];
export interface CipherFeedback { exact: number; color_only: number }
export interface CipherGuess extends CipherFeedback { sequence: number; colors: CipherCode; submitted_at: string }
export type CipherAttemptStatus = 'pending' | 'playing' | 'solved' | 'exhausted' | 'surrendered';
export interface CipherAttempt {
  status: CipherAttemptStatus;
  guesses_used: number;
  solved: boolean;
  finished_at: string | null;
}
export type CipherPhase = 'create_code' | 'waiting_code' | 'codebreaking' | 'attempt_sealed' | 'completed' | 'closed';
export interface CipherResult { user_id: string; code: CipherCode; guesses: CipherGuess[]; attempt: CipherAttempt }
export interface CipherStats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  solved_count: number;
  failed_count: number;
  successful_guesses_total: number;
  average_guesses_to_solve: number | null;
  best_guess_count: number | null;
  first_guess_solves: number;
  current_win_streak: number;
  longest_win_streak: number;
}
export interface CipherView {
  phase: CipherPhase;
  own_code: CipherCode | null;
  own_code_locked_at: string | null;
  opponent_code_locked: boolean;
  opponent_finished: boolean;
  invitation_expires_at: string;
  gameplay_started_at: string | null;
  gameplay_expires_at: string | null;
  own_guesses: CipherGuess[];
  own_attempt: CipherAttempt;
  /** Both secrets and both histories are revealed only after match completion. */
  results: [CipherResult, CipherResult] | null;
  statistics?: CipherStats;
}
export interface CipherViewValidationOptions {
  completed: boolean;
  viewerId?: string;
  participantIds?: readonly string[];
}
export type CipherMatchComparison = 'first' | 'second' | 'draw';
