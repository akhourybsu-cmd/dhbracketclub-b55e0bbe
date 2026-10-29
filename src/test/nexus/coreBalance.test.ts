import { describe, it, expect } from "vitest";
import { ENDLESS } from "@/lib/nexus/core/catalog";
import { simulateCore, type BuildStrategy } from "@/lib/nexus/core/simulator";
import { endlessCredits } from "@/lib/nexus/core/economy";
import { milestoneCredits } from "@/lib/nexus/core/progression";
import type { CoreLoadout } from "@/lib/nexus/core/types";
const seeds = [42, 7961];
const policies: BuildStrategy[] = [
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
const loadouts: CoreLoadout[] = [
  { weapons: ["arc", "orbit"], module: "stasis" },
  { weapons: ["rail", "orbit"], module: "repair" },
  { weapons: ["arc", "mortar"], module: "siphon" },
  { weapons: ["mortar", "orbit"], module: "stasis" },
];
describe("Endless balance guardrails", () => {
  it("supports active starter builds and puts the first weapon within two completed runs", () => {
    for (const policy of policies)
      for (const seed of seeds) {
        const run = simulateCore(ENDLESS, policy, seed);
        expect(run.finished).toBe(true);
        expect(run.waves).toBeGreaterThanOrEqual(10);
        expect(run.waves).toBeLessThanOrEqual(18);
        expect(
          endlessCredits(run.waves) * 2 + milestoneCredits(run.waves),
        ).toBeGreaterThanOrEqual(90);
        expect(run.energy + run.energySpent).toBe(run.energyEarned);
      }
    for (const seed of seeds)
      expect(simulateCore(ENDLESS, "idle", seed).waves).toBeLessThan(6);
  });
  it("makes full loadouts useful while keeping different loadout types viable", () => {
    for (const loadout of loadouts)
      for (const policy of policies) {
        const run = simulateCore(
          ENDLESS,
          policy,
          42,
          research(3),
          1800,
          loadout,
        );
        expect(run.finished).toBe(true);
        expect(run.waves).toBeGreaterThanOrEqual(16);
        expect(run.waves).toBeLessThanOrEqual(24);
        expect(run.energy + run.energySpent).toBe(run.energyEarned);
        for (const weapon of loadout.weapons)
          expect(run.damage[weapon]).toBeGreaterThan(0);
      }
    const starter = simulateCore(ENDLESS, "balanced", 42),
      armed = simulateCore(ENDLESS, "balanced", 42, {}, 1800, loadouts[2]);
    expect(armed.waves).toBeGreaterThan(starter.waves);
  });
  it("gives permanent research measurable survival gains across each full loadout", () => {
    for (const loadout of loadouts) {
      const fresh = simulateCore(ENDLESS, "balanced", 42, {}, 1800, loadout),
        trained = simulateCore(
          ENDLESS,
          "balanced",
          42,
          research(10),
          1800,
          loadout,
        );
      expect(trained.waves).toBeGreaterThanOrEqual(fresh.waves + 3);
      expect(trained.finished).toBe(true);
      expect(trained.waves).toBeLessThan(35);
    }
  });
  it("cannot turn maximum research into endless idle income or an immortal active core", () => {
    const idle = simulateCore(
      ENDLESS,
      "idle",
      42,
      research(10),
      1800,
      loadouts[3],
    );
    const active = simulateCore(
      ENDLESS,
      "balanced",
      42,
      research(10),
      1800,
      loadouts[3],
    );
    expect(idle.finished).toBe(true);
    expect(idle.waves).toBeLessThan(active.waves / 2);
    expect(active.finished).toBe(true);
    expect(active.waves).toBeGreaterThanOrEqual(20);
    expect(active.waves).toBeLessThan(35);
  });
});
