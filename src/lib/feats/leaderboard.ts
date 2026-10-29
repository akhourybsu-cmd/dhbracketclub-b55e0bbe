import type { FeatLeader } from "./types";

/** A member occupies one row, including when their rank is outside the top 100. */
export function leaderboardMembers(rows: FeatLeader[], me: FeatLeader | null) {
  const members = new Map(rows.map((member) => [member.user_id, member]));
  if (me) members.set(me.user_id, me);
  return [...members.values()].sort(
    (a, b) =>
      a.rank - b.rank ||
      (a.display_name || "").localeCompare(b.display_name || "") ||
      a.user_id.localeCompare(b.user_id),
  );
}
