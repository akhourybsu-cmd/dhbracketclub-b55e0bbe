// Actual-engine ruleset-6 sweep; emits JSON lines. No live account writes.
import { simulateCore } from "../src/lib/nexus/core/simulator";
import { ENDLESS } from "../src/lib/nexus/core/catalog";
import type { CoreLoadout } from "../src/lib/nexus/core/types";
const builds: Record<string, CoreLoadout> = {
  starter: { weapons: [], module: null },
  rail: { weapons: ["rail", "orbit"], module: "repair" },
  beam: { weapons: ["laser", "flak"], module: "capacitor" },
  corrosion: { weapons: ["venom", "arc"], module: "stasis" },
  contact: { weapons: ["flak", "orbit"], module: "thorns" },
};
const rows = [];
for (const tier of [1, 3, 6])
  for (const level of [0, 10, 30])
    for (const [name, build] of Object.entries(builds)) {
      if (name === "starter" && (tier > 1 || level > 0)) continue;
      const r = Object.fromEntries(
        ["weapons", "reactor", "plating", "barrier", "salvage", "nova"].map(
          (id) => [id, level],
        ),
      );
      const a = simulateCore(ENDLESS, "balanced", 42, r, 2400, build, 6, tier);
      if (!a.finished || a.energy + a.energySpent !== a.energyEarned)
        throw new Error(
          `Unbounded or invalid energy: ${name}, research ${level}, tier ${tier}`,
        );
      rows.push({
        tier,
        level,
        build: name,
        waves: a.waves,
        seconds: a.seconds,
        finished: a.finished,
        credits: a.credits,
        damage: a.damage,
        energy: a.energy + a.energySpent === a.energyEarned,
      });
      console.log(JSON.stringify(rows.at(-1)));
    }
