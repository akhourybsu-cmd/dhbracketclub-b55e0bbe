export const CHAIN_LOCK_MINUTES = 30;
export const CHAIN_LOCK_MS = CHAIN_LOCK_MINUTES * 60_000;
export const PICKEM_LOCK_MS = 48 * 3600_000;

type GameDeadlines = {
  kickoff_at: string;
  /** Legacy database name: this remains Weekly Pick'em's frozen 48-hour cutoff. */
  chain_lock_at?: string | null;
  crazy_chain_lock_at?: string | null;
};
function frozenDeadline(kickoffAt: string, frozenAt: string | null | undefined, leadMs: number): number {
  const kickoff = Date.parse(kickoffAt);
  const frozen = frozenAt ? Date.parse(frozenAt) : Infinity;
  return Number.isFinite(kickoff) && !Number.isNaN(frozen) ? Math.min(kickoff - leadMs, frozen) : NaN;
}
export function chainGameLockAt(game: GameDeadlines): number {
  return frozenDeadline(game.kickoff_at, game.crazy_chain_lock_at, CHAIN_LOCK_MS);
}
export function chainGameIsOpen(game: GameDeadlines & { status: string }, now = Date.now()): boolean {
  return game.status === 'scheduled' && now < chainGameLockAt(game);
}
export function pickemGameLockAt(game: GameDeadlines): number {
  return frozenDeadline(game.kickoff_at, game.chain_lock_at, PICKEM_LOCK_MS);
}
export function pickemGameIsOpen(game: GameDeadlines & { status: string }, now = Date.now()): boolean {
  return game.status === 'scheduled' && now < pickemGameLockAt(game);
}
