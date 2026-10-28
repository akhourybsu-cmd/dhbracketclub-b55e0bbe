import { describe, it, expect } from "vitest";
import { CAMPAIGN, ENDLESS } from "@/lib/nexus/core/catalog";
import { simulateCore, type BuildStrategy } from "@/lib/nexus/core/simulator";
const seeds = [42, 7961, 15880, 23799];
const builds: BuildStrategy[] = [
  "balanced",
  "gunner",
  "bulwark",
  "control",
  "economy",
];
const research = (level: number) => ({
  weapons: level,
  reactor: level,
  plating: level,
  barrier: level,
  salvage: level,
  nova: level,
});
describe("core balance guardrails", () => {
  it("supports different opening builds while unattended cores fail", () => {
    for (const strategy of builds)
      for (const seed of seeds)
        expect(
          simulateCore(CAMPAIGN[0], strategy, seed).victory,
          `${strategy} ${seed}`,
        ).toBe(true);
    for (const seed of seeds)
      expect(simulateCore(CAMPAIGN[0], "idle", seed).victory).toBe(false);
  });
  it("makes mid-level research meaningful in the final sector", () => {
    const fresh = seeds.map((seed) =>
      simulateCore(CAMPAIGN[7], "balanced", seed),
    );
    const trained = seeds.map((seed) =>
      simulateCore(CAMPAIGN[7], "balanced", seed, research(3)),
    );
    expect(trained.filter((r) => r.victory).length).toBeGreaterThanOrEqual(3);
    expect(trained.filter((r) => r.victory).length).toBeGreaterThan(
      fresh.filter((r) => r.victory).length,
    );
  });
  it("keeps endless finite and several build paths within a competitive survival band", () => {
    for (const strategy of builds) {
      const rows = seeds.map((seed) =>
        simulateCore(ENDLESS, strategy, seed, research(3)),
      );
      expect(rows.every((r) => r.finished)).toBe(true);
      const avg = rows.reduce((sum, r) => sum + r.waves, 0) / rows.length;
      expect(avg, `${strategy} waves`).toBeGreaterThanOrEqual(16);
      expect(avg).toBeLessThanOrEqual(25);
    }
  });
  it("cannot turn maximum permanent research into unlimited idle rewards", () => {
    const s = simulateCore(ENDLESS, "balanced", 42, research(10));
    expect(s.finished).toBe(true);
    expect(s.waves).toBeGreaterThan(20);
    expect(s.waves).toBeLessThan(40);
    expect(s.energy + s.energySpent).toBe(s.energyEarned);
  });
});
