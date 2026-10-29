import { describe, expect, it } from "vitest";
import { leaderboardMembers } from "@/lib/feats/leaderboard";
import type { FeatLeader } from "@/lib/feats/types";

const member = (
  user_id: string,
  rank: number,
  display_name = "Sam",
): FeatLeader => ({
  user_id,
  rank,
  display_name,
  avatar_url: null,
  score: 100,
  unlocked: 4,
});
describe("DH Score leaderboard identity", () => {
  it("shows the caller exactly once with their latest authoritative standing", () => {
    const me = member("me", 2);
    expect(
      leaderboardMembers(
        [member("a", 1), member("me", 3), member("me", 3)],
        me,
      ),
    ).toEqual([member("a", 1), me]);
  });
  it("preserves distinct members who share a name and a tied rank", () => {
    expect(
      leaderboardMembers([member("b", 1), member("a", 1)], null).map(
        (m) => m.user_id,
      ),
    ).toEqual(["a", "b"]);
  });
  it("includes the caller outside the board cutoff once without inventing a rank", () => {
    const me = member("me", 151);
    expect(leaderboardMembers([member("a", 1), member("b", 100)], me)).toEqual([
      member("a", 1),
      member("b", 100),
      me,
    ]);
  });
  it("allows an unranked private session and an empty board", () => {
    expect(leaderboardMembers([], null)).toEqual([]);
  });
});
