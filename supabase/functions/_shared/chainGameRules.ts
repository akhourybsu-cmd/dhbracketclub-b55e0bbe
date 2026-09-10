export const CHAIN_LOCK_HOURS = 48;
export const CHAIN_LOCK_MS = CHAIN_LOCK_HOURS * 3600_000;

export function chainGameLockAt(game: { kickoff_at: string; chain_lock_at?: string | null }): number {
  const kickoff = Date.parse(game.kickoff_at);
  const frozen = game.chain_lock_at ? Date.parse(game.chain_lock_at) : Infinity;
  return Number.isFinite(kickoff) && !Number.isNaN(frozen) ? Math.min(kickoff - CHAIN_LOCK_MS, frozen) : NaN;
}

export function chainGameIsOpen(game: { kickoff_at: string; status: string; chain_lock_at?: string | null }, now = Date.now()): boolean {
  return game.status === 'scheduled' && now < chainGameLockAt(game);
}
