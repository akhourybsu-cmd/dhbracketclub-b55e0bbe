import { describe, expect, it } from "vitest";
import {
  campaignXpForAttempt,
  dailyRewardDelta,
} from "@/lib/runedelve/economyProgression";
import { computeClearShards } from "@/lib/runedelve/shardEconomy";
import { levelFromXp } from "@/lib/runedelve/classConfig";
import { treasureShardValue } from "@/lib/runedelve/layoutZones";

describe("Rune economy pacing", () => {
  it("keeps earned levels in XP displays and shows the real remaining XP instead of lower-level progress", () => {
    const retained = levelFromXp(700, 80);
    expect(retained.level).toBe(80);
    expect(retained.intoLevel).toBe(0);
    expect(retained.needed).toBe(38900);
    expect(levelFromXp(700, 150)).toEqual({
      level: 150,
      intoLevel: 1,
      needed: 1,
    });
    expect(levelFromXp(700, 1)).toEqual(levelFromXp(700));
  });
  it("reaches meaningful class milestones across one campaign", () => {
    let xp = 0;
    const levels = new Map<number, number>();
    for (let chamber = 1; chamber <= 150; chamber++) {
      xp += campaignXpForAttempt({
        levelNumber: chamber,
        score: 2500,
        cleared: true,
        isFirstClear: true,
      });
      if ([15, 50, 100, 150].includes(chamber))
        levels.set(chamber, levelFromXp(xp).level);
    }
    expect(levels.get(15)).toBe(5);
    expect(levels.get(50)).toBe(12);
    expect(levels.get(100)).toBe(23);
    expect(levels.get(150)).toBe(39);
  });

  it("rewards a meaningful replay without repaying full XP for a tiny score record", () => {
    const replay = {
      levelNumber: 100,
      score: 3000,
      previousBestScore: 3000,
      cleared: true,
      isFirstClear: false,
    };
    expect(campaignXpForAttempt(replay)).toBeGreaterThan(0);
    expect(campaignXpForAttempt({ ...replay, score: 3001 })).toBe(
      campaignXpForAttempt(replay),
    );
    expect(campaignXpForAttempt({ ...replay, meaningful: false })).toBe(0);
    expect(
      campaignXpForAttempt({ ...replay, isFirstClear: true }),
    ).toBeGreaterThan(campaignXpForAttempt(replay));
  });

  it("diminishes failed attempts and keeps progress XP below a successful frontier clear", () => {
    const failed = {
      levelNumber: 100,
      score: 1800,
      cleared: false,
      isFirstClear: false,
      enemiesKilled: 2,
      totalEnemies: 3,
      turnsUsed: 8,
      turnLimit: 10,
      bossHasRule: true,
      bossPhaseReached: 2,
    };
    expect(campaignXpForAttempt(failed)).toBeGreaterThan(
      campaignXpForAttempt({ ...failed, failureCount: 5 }),
    );
    expect(campaignXpForAttempt(failed)).toBeLessThan(
      campaignXpForAttempt({ ...failed, cleared: true, isFirstClear: true }),
    );
  });

  it("retains first-clear chapter celebrations while reducing the replay boss premium", () => {
    const args = {
      levelNumber: 50,
      bossClear: true,
      chapterCleared: true,
      compassEquipped: false,
    };
    expect(computeClearShards({ ...args, isFirstClear: true }).total).toBe(310);
    expect(computeClearShards({ ...args, isFirstClear: false }).total).toBe(24);
    expect([1, 50, 51, 100, 101, 150].map(treasureShardValue)).toEqual([
      1, 1, 2, 2, 3, 3,
    ]);
  });

  it("pays only missing daily best-tier rewards", () => {
    expect(
      dailyRewardDelta({ shards: 150, xp: 100 }, { shards: 25, xp: 0 }),
    ).toEqual({ shards: 125, xp: 100 });
    expect(
      dailyRewardDelta({ shards: 150, xp: 100 }, { shards: 150, xp: 100 }),
    ).toEqual({ shards: 0, xp: 0 });
    expect(
      dailyRewardDelta({ shards: 75, xp: 50 }, { shards: 150, xp: 100 }),
    ).toEqual({ shards: 0, xp: 0 });
  });
});
