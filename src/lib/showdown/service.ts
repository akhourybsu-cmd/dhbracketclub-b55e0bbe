import { supabase } from '@/integrations/supabase/client';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';
import { validatePuzzleShape } from './prism/engine';
import { validateSceneView, validatePlacements } from './afterimage/engine';
import { validateCode, validateCipherView, validateCipherStatistics } from './cipher/engine';
import type { ShowdownCreateInput, ShowdownCursor, ShowdownLobbyData, ShowdownMatchDetail, ShowdownRoundInput, ShowdownReconstructionInput, CipherCodeInput, CipherGuessInput, CipherSurrenderInput } from './types';

export class ShowdownError extends Error {
  constructor(message: string, public readonly code: string = 'network') { super(message); this.name = 'ShowdownError'; }
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const SAFE_MESSAGES = new Set([
  'Challenge expired', 'Challenge is no longer active', 'Challenge unavailable', 'Club membership required',
  'Opponent is no longer a club member', 'Cannot challenge yourself', 'Choose a member of your club',
  'This round was already submitted', 'Round is not available', 'Too many active challenges',
  'Challenge rate limit reached. Try again later', 'A newer round save exists. Reload before continuing',
  'Saved moves cannot be removed or changed', 'Game is not enabled', 'No validated puzzles are available',
  'Choose another club member', 'This game is not available', 'Challenge limit reached. Try again later.',
  'Finish an open challenge before creating another.', 'This ranked round is already submitted', 'Round unavailable',
  'Finish the current round first', 'Too many updates. Wait a moment.', 'Activate every receiver before submitting',
  'This challenge is already complete', 'This invitation can no longer be declined or cancelled',
  'Recipient unavailable', 'Rematch unavailable', 'Rules version unavailable', 'Validated puzzle library is not available',
  'Open the challenge before playing', 'Only marked mirrors can rotate', 'The puzzle was already solved',
  'Start the observation before reconstructing', 'The observation is still in progress',
  'Observation is still active', 'Start the study session first', 'This scene is already submitted',
  'Invalid reconstruction', 'Invalid object or slot', 'Invalid placements',
  'Start the study phase before reconstructing', 'The study phase is still active',
  'This challenge uses different game controls', 'Each tray object and slot may be used once',
  'Invalid reconstruction placements',
  'Both codes must be locked before guessing', 'Your code is locked and cannot be changed',
  'Your attempt is already finished', 'Enter exactly four permitted colors',
  'Lock your four-color code before sending this invitation.',
  'Choose four colors from the six-color palette', 'Your secret code is already locked',
  'Your attempt is already sealed', 'Both players must lock a code first',
]);
function failure(error: unknown): ShowdownError {
  const code = object(error) && typeof error.code === 'string' ? error.code : '';
  const message = object(error) && typeof error.message === 'string' ? error.message : '';
  if (code === '40001') return new ShowdownError('This round changed on another device. Its saved moves will be restored.', 'conflict');
  if (code === '42501') return new ShowdownError('This challenge is unavailable in your active club.', 'access');
  if (code === 'P0001' && SAFE_MESSAGES.has(message)) return new ShowdownError(message, 'rule');
  return new ShowdownError('Showdown could not sync. Your saved moves are kept; check your connection and retry.');
}
async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    const { data, error } = await withTimeout(supabase.rpc(name as never, args as never), QUERY_TIMEOUT_MS, 'Showdown');
    if (error) throw error;
    return data;
  } catch (error) { throw failure(error); }
}
export function parseShowdownMatch(value: unknown, requestElapsedMs = 0): ShowdownMatchDetail {
  if (!object(value) || !object(value.challenge) || typeof value.challenge.id !== 'string' || !Array.isArray(value.challenge.players)
    || value.challenge.players.length !== 2 || !Array.isArray(value.rounds) || value.rounds.length !== (value.challenge.game_key === 'cipher_duel' ? 0 : 3)) throw new ShowdownError('The saved match could not be verified. Refresh and try again.', 'data');
  const completed = value.challenge.status === 'completed';
  const closed = ['cancelled', 'declined', 'expired'].includes(String(value.challenge.status));
  if (value.challenge.game_key === 'cipher_duel') {
    validateCipherView(value.cipher, { completed, participantIds: [String(value.challenge.challenger_id), String(value.challenge.recipient_id)] });
    validateCipherStatistics(value.cipher_statistics);
    if (value.current_round !== null || closed !== (value.cipher.phase === 'closed')
      || !completed && (value.challenge.winner_id !== null || value.challenge.outcome !== null || value.challenge.completed_at !== null)) throw new ShowdownError('The saved duel could not be verified. Refresh and try again.', 'data');
    return value as unknown as ShowdownMatchDetail;
  }
  for (let i = 0; i < value.rounds.length; i++) {
    const round = value.rounds[i];
    if (!object(round) || round.round_number !== i + 1 || !object(round.me) || !Array.isArray(round.me.actions)
      || !Number.isInteger(round.me.revision) || !completed && round.opponent !== null) throw new ShowdownError('The saved match could not be verified. Refresh and try again.', 'data');
    if (value.challenge.game_key === 'afterimage') {
      if (round.puzzle !== null || round.minimum_rotations !== null || !Array.isArray(round.me.placements)
        || !round.me.submitted && (round.me.correct_count != null || round.me.perfect != null)) throw new ShowdownError('The saved match could not be verified. Refresh and try again.', 'data');
      if (round.scene !== null) {
        validateSceneView(round.scene);
        if (round.scene.id !== round.puzzle_id || round.scene.version !== round.puzzle_version || round.scene.difficulty !== round.difficulty) throw new ShowdownError('The saved scene version could not be verified. Refresh and try again.', 'data');
        if (!completed && (round.scene.phase === 'review' || round.scene.answers !== undefined)) throw new ShowdownError('The saved match could not be verified. Refresh and try again.', 'data');
        validatePlacements(round.me.placements, round.scene);
        if (round.scene.phase === 'study') {
          const remaining = Date.parse(round.scene.study_expires_at ?? '') - Date.parse(round.scene.server_now ?? '');
          if (!Number.isFinite(remaining)) throw new ShowdownError('The observation clock could not be verified. Refresh and try again.', 'data');
          // Subtract the entire round trip conservatively. Device wall-clock changes
          // cannot extend an observation, and server expiry still gates every write.
          round.scene.observation_remaining_ms = Math.max(0, Math.min(7000, remaining) - Math.max(0, requestElapsedMs));
          round.scene.observation_received_at = performance.now();
        }
      } else if (completed || !closed && round.me.placements.length) throw new ShowdownError('The saved match could not be verified. Refresh and try again.', 'data');
    } else if (round.puzzle !== null) validatePuzzleShape(round.puzzle);
    if (!round.me.submitted && round.minimum_rotations !== null) throw new ShowdownError('The saved match could not be verified. Refresh and try again.', 'data');
  }
  return value as unknown as ShowdownMatchDetail;
}
async function matchRpc(name: string, args: Record<string, unknown>): Promise<ShowdownMatchDetail> {
  const started = performance.now();
  const value = await rpc(name, args);
  return parseShowdownMatch(value, performance.now() - started);
}
export async function fetchShowdownLobby(gameKey = 'prism_break', cursor: ShowdownCursor | null = null): Promise<ShowdownLobbyData> {
  const value = await rpc('showdown_lobby', { p_game_key: gameKey, p_cursor: cursor, p_limit: 30 });
  if (!object(value) || !['games','members','challenges','rivalries','standings'].every(key => Array.isArray(value[key])) || !object(value.record)) throw new ShowdownError('The Showdown lobby could not be verified. Retry loading it.', 'data');
  if (gameKey === 'cipher_duel') validateCipherStatistics(value.cipher_statistics);
  return value as unknown as ShowdownLobbyData;
}
export async function createShowdown(input: ShowdownCreateInput): Promise<ShowdownMatchDetail> {
  if (input.gameKey === 'cipher_duel') {
    if (!input.secretCode) throw new ShowdownError('Lock your four-color code before sending this invitation.', 'rule');
    validateCode(input.secretCode);
    return matchRpc('showdown_create_cipher', { p_recipient_id: input.recipientId, p_code: input.secretCode, p_request_id: input.requestId ?? crypto.randomUUID(), p_rematch_of: input.rematchOf ?? null });
  }
  return matchRpc('showdown_create', { p_recipient_id: input.recipientId, p_game_key: input.gameKey, p_request_id: input.requestId ?? crypto.randomUUID(), p_rematch_of: input.rematchOf ?? null });
}
export async function fetchShowdownMatch(challengeId: string, start = true): Promise<ShowdownMatchDetail> {
  return matchRpc('showdown_get', { p_challenge_id: challengeId, p_start: start });
}
const roundArgs = (input: ShowdownRoundInput) => ({ p_challenge_id: input.challengeId, p_round_number: input.roundNumber, p_actions: input.actions, p_expected_revision: input.expectedRevision, p_request_id: input.requestId });
export async function saveShowdownRound(input: ShowdownRoundInput): Promise<ShowdownMatchDetail> {
  return matchRpc('showdown_save_round', roundArgs(input));
}
export async function submitShowdownRound(input: ShowdownRoundInput, skip: boolean): Promise<ShowdownMatchDetail> {
  return matchRpc('showdown_submit_round', { ...roundArgs(input), p_skip: skip });
}
export async function actOnShowdown(challengeId: string, action: 'decline' | 'cancel', requestId: string = crypto.randomUUID()): Promise<ShowdownMatchDetail> {
  return matchRpc('showdown_act', { p_challenge_id: challengeId, p_action: action, p_request_id: requestId });
}
export async function startAfterimageStudy(challengeId: string, roundNumber: number, requestId: string): Promise<ShowdownMatchDetail> {
  return matchRpc('showdown_start_study', { p_challenge_id: challengeId, p_round_number: roundNumber, p_request_id: requestId });
}
const reconstructionArgs = (input: ShowdownReconstructionInput) => ({ p_challenge_id: input.challengeId, p_round_number: input.roundNumber, p_placements: input.placements, p_expected_revision: input.expectedRevision, p_request_id: input.requestId });
export async function saveAfterimageReconstruction(input: ShowdownReconstructionInput): Promise<ShowdownMatchDetail> {
  return matchRpc('showdown_save_reconstruction', reconstructionArgs(input));
}
export async function submitAfterimageReconstruction(input: ShowdownReconstructionInput): Promise<ShowdownMatchDetail> {
  return matchRpc('showdown_submit_reconstruction', reconstructionArgs(input));
}
export async function lockCipherCode(input: CipherCodeInput): Promise<ShowdownMatchDetail> {
  validateCode(input.code);
  return matchRpc('showdown_lock_cipher_code', { p_challenge_id: input.challengeId, p_code: input.code, p_request_id: input.requestId });
}
export async function submitCipherGuess(input: CipherGuessInput): Promise<ShowdownMatchDetail> {
  validateCode(input.guess);
  return matchRpc('showdown_submit_cipher_guess', { p_challenge_id: input.challengeId, p_guess: input.guess, p_expected_guess_count: input.expectedGuessCount, p_request_id: input.requestId });
}
export async function surrenderCipher(input: CipherSurrenderInput): Promise<ShowdownMatchDetail> {
  return matchRpc('showdown_surrender_cipher', { p_challenge_id: input.challengeId, p_expected_guess_count: input.expectedGuessCount, p_request_id: input.requestId });
}
