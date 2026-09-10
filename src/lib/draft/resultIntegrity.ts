interface StoredPickRating {
  pick_id?: unknown;
  score?: unknown;
}

interface StoredDraftResult {
  user_id?: unknown;
  rank?: unknown;
  total_score?: unknown;
  pick_ratings?: unknown;
}

interface DraftPickOwner {
  id: string;
  user_id: string;
}

/**
 * A report is displayable only when it is complete and internally consistent.
 * This keeps legacy zero rows and partial AI responses from being treated as a
 * finished report while the server-side repair path regenerates them.
 */
export function isCompleteDraftReport(
  results: StoredDraftResult[],
  participantIds: string[],
  picks: DraftPickOwner[],
): boolean {
  if (participantIds.length === 0 || results.length !== participantIds.length) return false;

  const participantSet = new Set(participantIds);
  const seenUsers = new Set<string>();
  const seenRanks = new Set<number>();
  const expectedPicksByUser = new Map<string, Set<string>>();
  for (const participantId of participantIds) expectedPicksByUser.set(participantId, new Set());
  for (const pick of picks) expectedPicksByUser.get(pick.user_id)?.add(pick.id);

  for (const result of results) {
    if (typeof result.user_id !== 'string' || !participantSet.has(result.user_id)) return false;
    if (seenUsers.has(result.user_id)) return false;
    seenUsers.add(result.user_id);

    const rank = Number(result.rank);
    if (!Number.isInteger(rank) || rank < 1 || rank > participantIds.length || seenRanks.has(rank)) return false;
    seenRanks.add(rank);

    const total = Number(result.total_score);
    if (!Number.isFinite(total) || total <= 0) return false;
    if (!Array.isArray(result.pick_ratings)) return false;

    const expectedPickIds = expectedPicksByUser.get(result.user_id);
    if (!expectedPickIds?.size || result.pick_ratings.length !== expectedPickIds.size) return false;

    const seenPicks = new Set<string>();
    let calculatedTotal = 0;
    for (const value of result.pick_ratings) {
      const rating = value as StoredPickRating;
      if (typeof rating?.pick_id !== 'string' || !expectedPickIds.has(rating.pick_id)) return false;
      if (seenPicks.has(rating.pick_id)) return false;
      seenPicks.add(rating.pick_id);
      if (typeof rating.score !== 'number' || !Number.isFinite(rating.score)) return false;
      if (rating.score < 1 || rating.score > 10) return false;
      calculatedTotal += rating.score;
    }

    if (Math.abs(calculatedTotal - total) > 0.051) return false;
  }

  return seenUsers.size === participantIds.length && seenRanks.size === participantIds.length;
}
