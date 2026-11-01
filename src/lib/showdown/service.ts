import { supabase } from '@/integrations/supabase/client';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';
import { validatePuzzleShape } from './prism/engine';
import type { ShowdownCreateInput, ShowdownCursor, ShowdownLobbyData, ShowdownMatchDetail, ShowdownRoundInput } from './types';

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
export function parseShowdownMatch(value: unknown): ShowdownMatchDetail {
  if (!object(value) || !object(value.challenge) || typeof value.challenge.id !== 'string' || !Array.isArray(value.challenge.players)
    || value.challenge.players.length !== 2 || !Array.isArray(value.rounds) || value.rounds.length !== 3) throw new ShowdownError('The saved match could not be verified. Refresh and try again.', 'data');
  const completed = value.challenge.status === 'completed';
  for (let i = 0; i < value.rounds.length; i++) {
    const round = value.rounds[i];
    if (!object(round) || round.round_number !== i + 1 || !object(round.me) || !Array.isArray(round.me.actions)
      || !Number.isInteger(round.me.revision) || !completed && round.opponent !== null) throw new ShowdownError('The saved match could not be verified. Refresh and try again.', 'data');
    if (round.puzzle !== null) validatePuzzleShape(round.puzzle);
    if (!round.me.submitted && round.minimum_rotations !== null) throw new ShowdownError('The saved match could not be verified. Refresh and try again.', 'data');
  }
  return value as unknown as ShowdownMatchDetail;
}
export async function fetchShowdownLobby(gameKey = 'prism_break', cursor: ShowdownCursor | null = null): Promise<ShowdownLobbyData> {
  const value = await rpc('showdown_lobby', { p_game_key: gameKey, p_cursor: cursor, p_limit: 30 });
  if (!object(value) || !['games','members','challenges','rivalries','standings'].every(key => Array.isArray(value[key])) || !object(value.record)) throw new ShowdownError('The Showdown lobby could not be verified. Retry loading it.', 'data');
  return value as unknown as ShowdownLobbyData;
}
export async function createShowdown(input: ShowdownCreateInput): Promise<ShowdownMatchDetail> {
  return parseShowdownMatch(await rpc('showdown_create', { p_recipient_id: input.recipientId, p_game_key: input.gameKey, p_request_id: input.requestId ?? crypto.randomUUID(), p_rematch_of: input.rematchOf ?? null }));
}
export async function fetchShowdownMatch(challengeId: string, start = true): Promise<ShowdownMatchDetail> {
  return parseShowdownMatch(await rpc('showdown_get', { p_challenge_id: challengeId, p_start: start }));
}
const roundArgs = (input: ShowdownRoundInput) => ({ p_challenge_id: input.challengeId, p_round_number: input.roundNumber, p_actions: input.actions, p_expected_revision: input.expectedRevision, p_request_id: input.requestId });
export async function saveShowdownRound(input: ShowdownRoundInput): Promise<ShowdownMatchDetail> {
  return parseShowdownMatch(await rpc('showdown_save_round', roundArgs(input)));
}
export async function submitShowdownRound(input: ShowdownRoundInput, skip: boolean): Promise<ShowdownMatchDetail> {
  return parseShowdownMatch(await rpc('showdown_submit_round', { ...roundArgs(input), p_skip: skip }));
}
export async function actOnShowdown(challengeId: string, action: 'decline' | 'cancel', requestId: string = crypto.randomUUID()): Promise<ShowdownMatchDetail> {
  return parseShowdownMatch(await rpc('showdown_act', { p_challenge_id: challengeId, p_action: action, p_request_id: requestId }));
}
