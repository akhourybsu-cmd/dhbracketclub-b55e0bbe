// Run: node --import tsx scripts/balance-nexus-core.ts [--quick] [--output=/tmp/nexus-balance.json]
import { writeFileSync } from "node:fs";
import { ENDLESS } from "../src/lib/nexus/core/catalog";
import {
  simulateCore,
  type BuildStrategy,
} from "../src/lib/nexus/core/simulator";
import type { CoreLoadout } from "../src/lib/nexus/core/types";
const quick = process.argv.includes("--quick");
const output =
  process.argv.find((x) => x.startsWith("--output="))?.slice(9) ||
  "/tmp/nexus-balance.json";
const seeds = Array.from({ length: quick ? 2 : 8 }, (_, i) => 42 + i * 7919);
const strategies: BuildStrategy[] = quick
  ? ["balanced", "bulwark", "gunner"]
  : ["balanced", "gunner", "bulwark", "control", "economy", "idle"];
const loadouts: Record<string, CoreLoadout> = {
  starter: { weapons: [], module: null },
  first_unlock: { weapons: ["orbit"], module: "repair" },
  chain_guard: { weapons: ["arc", "orbit"], module: "stasis" },
  armor_breaker: { weapons: ["rail", "orbit"], module: "repair" },
  bombardment: { weapons: ["arc", "mortar"], module: "siphon" },
  siege_guard: { weapons: ["mortar", "orbit"], module: "stasis" },
};
const rows = [];
for (const level of [0, 3, 10])
  for (const [name, loadout] of Object.entries(loadouts)) {
    for (const strategy of strategies)
      for (const seed of seeds) {
        const research = {
          weapons: level,
          reactor: level,
          plating: level,
          barrier: level,
          salvage: level,
          nova: level,
        };
        rows.push({
          ...simulateCore(ENDLESS, strategy, seed, research, 1800, loadout),
          research: level,
          build: name,
        });
      }
    console.log(`Completed ${name}, research ${level}`);
  }
writeFileSync(output, JSON.stringify(rows, null, 2) + "\n");
console.log(`Saved ${rows.length} simulations to ${output}`);
