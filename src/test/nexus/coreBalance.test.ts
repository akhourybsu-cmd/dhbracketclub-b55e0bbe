import { describe, it, expect } from "vitest";
import { ENDLESS, UPGRADES } from "@/lib/nexus/core/catalog";
import {
  activateAbility,
  buyUpgrade,
  createRun,
  distance,
  isFinished,
  startWave,
  stepRun,
} from "@/lib/nexus/core/engine";
import {
  simulateCore as simulateRuleset,
  type BuildStrategy,
} from "@/lib/nexus/core/simulator";
import { endlessCredits } from "@/lib/nexus/core/economy";
import { milestoneCredits } from "@/lib/nexus/core/progression";
import type { CoreLoadout } from "@/lib/nexus/core/types";
// Archive guardrails deliberately remain fixed to the released ruleset.
function simulateCore(...args: Parameters<typeof simulateRuleset>) {
  args[6] = 5;
  return simulateRuleset(...args);
}
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
describe("Archived ruleset-5 Endless balance guardrails", () => {
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
  it.each(loadouts)(
    "keeps deployed systems viable with loadout %j",
    (loadout) => {
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
    },
  );
  it("makes a full loadout stronger than the starter cannon", () => {
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

  it("keeps the ramp finite even with every deployed system at its cap, while allowing late milestones", () => {
    const waves = [];
    for (const loadout of loadouts) {
      let s = createRun(ENDLESS, research(10), "capacity-test", 42, loadout, 5);
      s.energy = 1_000_000; // Capacity stress test, beyond a normally earned run budget.
      for (const upgrade of UPGRADES)
        for (let i = 0; i < upgrade.max; i++)
          s = buyUpgrade(s, ENDLESS, upgrade.id);
      s = startWave(s, ENDLESS);
      for (let i = 0; i < 24000 && !isFinished(s); i++) {
        if (i % 15 === 0) {
          if (
            s.enemies.filter((e) => distance(e) < 180).length >= 3 ||
            s.enemies.some((e) => e.kind === "boss" && distance(e) < 150)
          )
            s = activateAbility(s, ENDLESS, "nova");
          if (
            s.enemies.filter((e) => distance(e) < 350).length >= 5 ||
            s.enemies.some((e) => e.kind === "boss" && distance(e) < 250)
          )
            s = activateAbility(s, ENDLESS, "overdrive");
        }
        s = stepRun(s, ENDLESS);
      }
      expect(s.phase).toBe("defeat");
      expect(s.cleared).toBeLessThan(40);
      waves.push(s.cleared);
    }
    expect(Math.max(...waves)).toBeGreaterThanOrEqual(25);
  });
});
