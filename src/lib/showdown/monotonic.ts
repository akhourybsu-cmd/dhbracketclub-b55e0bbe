import type { ShowdownMatchDetail, ShowdownRoundState } from './types';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const terminal = new Set(['completed', 'declined', 'cancelled', 'expired']);
function match(value: unknown): value is ShowdownMatchDetail {
  return object(value) && object(value.challenge) && typeof value.challenge.id === 'string'
    && Array.isArray(value.challenge.players) && Array.isArray(value.rounds)
    && value.challenge.players.every(player => object(player) && typeof player.user_id === 'string' && Number.isInteger(player.rounds_completed))
    && value.rounds.every(round => object(round) && object(round.me) && Number.isInteger(round.round_number) && Number.isInteger(round.me.revision));
}
const regresses = (before: ShowdownRoundState, after: ShowdownRoundState) =>
  !after || after.revision < before.revision || before.submitted && !after.submitted;

/**
 * Polling and mutation replies can arrive out of order. Keep the authoritative
 * checkpoint already observed by this scoped query, rather than rendering an
 * older board beside a newer local action log. Used by React Query for both
 * fetch results and setQueryData; it does not perform side effects or scoring.
 */
export function showdownMatchStructuralSharing(previous: unknown, incoming: unknown): unknown {
  if (!match(previous) || !match(incoming) || previous.challenge.id !== incoming.challenge.id) return incoming;
  const before = previous.challenge, after = incoming.challenge;
  if (before.club_id !== after.club_id || before.game_key !== after.game_key || before.rules_version !== after.rules_version) return previous;
  if (terminal.has(before.status) && after.status !== before.status || before.status === 'active' && after.status === 'pending') return previous;
  for (const player of before.players) {
    const next = after.players.find(value => value.user_id === player.user_id);
    if (!next || next.rounds_completed < player.rounds_completed || player.started_at != null && next.started_at == null || player.finished_at != null && next.finished_at == null) return previous;
  }
  for (const round of previous.rounds) {
    const next = incoming.rounds.find(value => value.round_number === round.round_number);
    if (!next || next.puzzle_id !== round.puzzle_id || next.puzzle_version !== round.puzzle_version || regresses(round.me, next.me)) return previous;
    if (round.opponent && (!next.opponent || regresses(round.opponent, next.opponent))) return previous;
    if (!terminal.has(after.status) && round.scene && next.scene) {
      const phases = ['ready', 'study', 'reconstruct', 'submitted', 'review'];
      if (phases.indexOf(next.scene.phase) < phases.indexOf(round.scene.phase)) return previous;
    }
  }
  // Win/loss and rivalry aggregates may legitimately change after other
  // completed matches. Do not use those totals as snapshot ordering signals.
  return incoming;
}
