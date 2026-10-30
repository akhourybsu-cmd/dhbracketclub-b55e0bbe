import { describe, expect, it } from "vitest";
import {
  endlessRewardFor,
  endlessStarsFor,
  ENDLESS_REWARD_TIERS,
} from "@/lib/runedelve/endlessMode";

describe("Arena reward milestones", () => {
  it.each([
    [0, 0, 0, 0],
    [1, 25, 10, 0],
    [2, 25, 20, 0],
    [3, 75, 30, 1],
    [5, 75, 50, 1],
    [6, 150, 60, 1],
    [8, 150, 80, 2],
    [10, 250, 100, 2],
    [15, 400, 150, 2],
    [16, 400, 160, 3],
    [22, 600, 220, 3],
    [30, 900, 300, 3],
    [50, 900, 500, 3],
    [100, 900, 500, 3],
  ])(
    "%i kills grants %i total shards, %i XP and %i stars",
    (kills, shards, xp, stars) => {
      expect(endlessRewardFor(kills)).toMatchObject({ shards, xp });
      expect(endlessStarsFor(kills)).toBe(stars);
    },
  );

  it("makes every shard milestone worthwhile and caps the total daily entitlement", () => {
    for (const tier of ENDLESS_REWARD_TIERS.slice(1)) {
      expect(endlessRewardFor(tier.kills).shards).toBeGreaterThan(
        endlessRewardFor(tier.kills - 1).shards,
      );
    }
    expect(endlessRewardFor(-1)).toMatchObject({ shards: 0, xp: 0 });
    expect(endlessRewardFor(Number.NaN)).toMatchObject({ shards: 0, xp: 0 });
    expect(endlessRewardFor(30).title).toBe("Eternal");
    expect(endlessRewardFor(22).title).toBe("Endless Conqueror");
  });
});
