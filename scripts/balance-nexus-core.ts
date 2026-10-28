// Run: node --import tsx scripts/balance-nexus-core.ts [--quick] [--output=/tmp/nexus-balance.json]
import { writeFileSync } from "node:fs";
import {
  ALL_SCENARIOS,
  simulateCore,
  type BuildStrategy,
} from "../src/lib/nexus/core/simulator";
const quick = process.argv.includes("--quick");
const output =
  process.argv.find((x) => x.startsWith("--output="))?.slice(9) ||
  "/tmp/nexus-balance.json";
const seeds = Array.from({ length: quick ? 2 : 8 }, (_, i) => 42 + i * 7919);
const strategies: BuildStrategy[] = quick
  ? ["balanced", "bulwark", "gunner", "control"]
  : ["balanced", "gunner", "bulwark", "control", "economy", "idle"];
const rows = [];
for (const level of [0, 3])
  for (const scenario of ALL_SCENARIOS) {
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
          ...simulateCore(scenario, strategy, seed, research),
          research: level,
        });
      }
    console.log(`Completed ${scenario.id}, research ${level}`);
  }
writeFileSync(output, JSON.stringify(rows, null, 2) + "\n");
console.log(`Saved ${rows.length} simulations to ${output}`);
