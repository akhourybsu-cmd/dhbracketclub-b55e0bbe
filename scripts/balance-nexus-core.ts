// Run: node --import tsx scripts/balance-nexus-core.ts [--quick|--all] [--version=4|5] [--output=/tmp/nexus-balance.json]
import { writeFileSync } from "node:fs";
import { ENDLESS } from "../src/lib/nexus/core/catalog";
import {
  simulateCore,
  type BuildStrategy,
} from "../src/lib/nexus/core/simulator";
import type { CoreLoadout } from "../src/lib/nexus/core/types";
import {
  AUXILIARIES,
  MODULES,
  loadoutError,
} from "../src/lib/nexus/core/progression";
import { BALANCE_VERSION } from "../src/lib/nexus/core/systems";
const quick = process.argv.includes("--quick");
const all = process.argv.includes("--all");
const version = Number(
  process.argv.find((x) => x.startsWith("--version="))?.slice(10) ||
    BALANCE_VERSION,
);
const output =
  process.argv.find((x) => x.startsWith("--output="))?.slice(9) ||
  "/tmp/nexus-balance.json";
const seeds = Array.from(
  { length: quick ? 2 : all ? 4 : 8 },
  (_, i) => 42 + i * 7919,
);
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
if (all) {
  for (const key of Object.keys(loadouts)) delete loadouts[key];
  const weapons = AUXILIARIES.filter(
    (a) => version >= 6 || !["laser", "venom", "flak"].includes(a.id),
  ).map((a) => a.id as CoreLoadout["weapons"][number]);
  const sets = [
    [],
    ...weapons.map((id) => [id]),
    ...weapons.flatMap((a, i) => weapons.slice(i + 1).map((b) => [a, b])),
  ];
  for (const set of sets)
    for (const module of [
      null,
      ...MODULES.filter(
        (m) => version >= 6 || !["capacitor", "thorns"].includes(m.id),
      ).map((m) => m.id as CoreLoadout["module"]),
    ]) {
      const loadout: CoreLoadout = { weapons: set, module };
      if (!loadoutError(loadout))
        loadouts[`${set.join("+") || "pulse"}/${module || "none"}`] = loadout;
    }
}
const rows = [];
for (const level of all ? [0, 3, 6, 10] : [0, 3, 10])
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
          ...simulateCore(
            ENDLESS,
            strategy,
            seed,
            research,
            1800,
            loadout,
            version,
          ),
          research: level,
          build: name,
        });
      }
    console.log(`Completed ${name}, research ${level}`);
  }
writeFileSync(output, JSON.stringify(rows, null, 2) + "\n");
console.log(`Saved ${rows.length} simulations to ${output}`);
