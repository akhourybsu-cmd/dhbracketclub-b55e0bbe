import { describe, expect, it } from "vitest";
import { ARMORY, STARTER_LOADOUT } from "@/lib/nexus/core/progression";
import {
  careerMedals,
  careerOutcome,
  careerSnapshot,
  defenderRank,
  DEFENDER_RANKS,
  nextCareerObjective,
  nextWaveTarget,
} from "@/lib/nexus/core/career";
import type { CoreProfile } from "@/lib/nexus/core/types";
const profile = (patch: Partial<CoreProfile> = {}): CoreProfile => ({
  credits: 0,
  research: {},
  campaign: {},
  challenges: {},
  bestWave: 0,
  totalRuns: 0,
  totalWaves: 0,
  unlocks: [],
  loadout: STARTER_LOADOUT,
  ...patch,
});
describe("defender career", () => {
  it("advances exactly at rank boundaries and keeps progress bounded", () => {
    for (const [i, rank] of DEFENDER_RANKS.entries()) {
      expect(defenderRank(rank.waves).index).toBe(i);
      if (i) expect(defenderRank(rank.waves - 1).index).toBe(i - 1);
    }
    for (let waves = 0; waves < 17000; waves += 7) {
      const r = defenderRank(waves);
      expect(r.progress).toBeGreaterThanOrEqual(0);
      expect(r.progress).toBeLessThanOrEqual(1);
      expect(r.remaining).toBeGreaterThanOrEqual(0);
    }
    expect(defenderRank(2500)).toMatchObject({
      name: "Nexus Prime",
      next: { name: "Starforged", waves: 4200 },
    });
    expect(defenderRank(15000)).toMatchObject({
      name: "Infinite",
      next: null,
      progress: 1,
    });
  });
  it("does not produce invalid progress from missing or corrupt counters", () => {
    for (const value of [-2, NaN, Infinity])
      expect(defenderRank(value)).toMatchObject({ index: 0, progress: 0 });
    expect(defenderRank(24.9).remaining).toBe(1);
  });
  it("requires banked progress for medals and gives no zero-wave first-defense medal", () => {
    expect(
      careerMedals(profile({ totalRuns: 50 })).some((m) => m.unlocked),
    ).toBe(false);
    const earned = careerMedals(profile({ totalWaves: 6, bestWave: 6 }))
      .filter((m) => m.unlocked)
      .map((m) => m.id);
    expect(earned).toEqual(["first-light", "siegebreaker"]);
  });
  it("keeps ownership medals when credits are spent and equipment is removed", () => {
    const p = profile({
      unlocks: ARMORY.map((a) => a.id),
      credits: 0,
      loadout: STARTER_LOADOUT,
    });
    const earned = careerMedals(p)
      .filter((m) => m.unlocked)
      .map((m) => m.id);
    expect(earned).toEqual([
      "armed",
      "arsenal",
      "tactician",
      "arsenal-master",
      "support-master",
    ]);
  });
  it("keeps original collection medals when the catalog expands", () => {
    const earned = careerMedals(
      profile({
        unlocks: [
          "orbit",
          "arc",
          "rail",
          "mortar",
          "repair",
          "siphon",
          "stasis",
        ],
      }),
    );
    expect(earned.find((m) => m.id === "arsenal")?.unlocked).toBe(true);
    expect(earned.find((m) => m.id === "tactician")?.unlocked).toBe(true);
    expect(earned.find((m) => m.id === "arsenal-master")?.unlocked).toBe(false);
  });
  it("counts actual research levels and caps each known track", () => {
    const p = profile({ research: { weapons: 10, reactor: 5 } });
    expect(careerMedals(p).find((m) => m.id === "engineer")).toMatchObject({
      unlocked: true,
      current: 15,
    });
    expect(
      careerMedals(profile({ research: { weapons: 100 } })).find(
        (m) => m.id === "engineer",
      ),
    ).toMatchObject({ unlocked: true, current: 15 });
  });
  it("celebrates a promotion and newly earned medals only when saved progression advances", () => {
    const before = profile({ totalWaves: 20, bestWave: 10 });
    const after = profile({ totalWaves: 35, bestWave: 15 });
    const outcome = careerOutcome(careerSnapshot(before), after);
    expect(outcome).toMatchObject({
      promoted: true,
      bankedWaves: 15,
      rank: { name: "Sentinel" },
    });
    expect(careerOutcome(careerSnapshot(after), after)).toMatchObject({
      promoted: false,
      bankedWaves: 0,
      medals: [],
    });
    expect(
      careerOutcome(
        careerSnapshot(profile()),
        profile({ totalWaves: 6, bestWave: 6 }),
      ).medals,
    ).toHaveLength(2);
  });
  it("directs owned-but-unequipped weapons back to the loadout", () => {
    expect(
      nextCareerObjective(
        profile({ unlocks: ["orbit"], credits: 1000, totalWaves: 100 }),
      ),
    ).toMatchObject({
      kind: "equip",
      href: "/nexus/loadout/endless?item=orbit",
    });
  });
  it("only recommends equipment that meets both currency and lifetime gates", () => {
    expect(
      nextCareerObjective(profile({ credits: 100, totalWaves: 4 })).kind,
    ).toBe("wave");
    expect(
      nextCareerObjective(profile({ credits: 89, totalWaves: 5 })).kind,
    ).toBe("wave");
    expect(
      nextCareerObjective(profile({ credits: 90, totalWaves: 5 })),
    ).toMatchObject({
      kind: "unlock",
      href: "/nexus/research?tab=armory&item=orbit",
    });
  });
  it("tracks unclaimed milestones and continues record goals after the final bonus", () => {
    expect(nextWaveTarget(0)).toEqual({ wave: 5, credits: 20 });
    expect(nextWaveTarget(5, 10)).toEqual({ wave: 15, credits: 55 });
    expect(nextWaveTarget(25)).toEqual({ wave: 30, credits: 0 });
    expect(nextCareerObjective(profile({ bestWave: 27 }))).toMatchObject({
      kind: "wave",
      wave: 30,
      credits: 0,
    });
  });
});
