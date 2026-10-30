import { UPGRADES, RESEARCH, ENDLESS } from "../src/lib/nexus/core/catalog";
import { ARMORY } from "../src/lib/nexus/core/progression";
import {
  upgradeCost,
  researchCost,
  upgradeCap,
} from "../src/lib/nexus/core/systems";
import { DIFFICULTIES } from "../src/lib/nexus/core/difficulty";
import { simulateCore } from "../src/lib/nexus/core/simulator";
import type { CoreLoadout } from "../src/lib/nexus/core/types";
const builds: CoreLoadout[] = [
  { weapons: ["rail", "orbit"], module: "repair" },
  { weapons: ["laser", "venom"], module: "capacitor" },
  { weapons: ["flak", "mortar"], module: "thorns" },
];
console.log(
  JSON.stringify({
    armory: ARMORY,
    difficulties: DIFFICULTIES,
    upgrades: UPGRADES.map((u) => ({
      ...u,
      cap: upgradeCap(u.id, 6),
      totals: Array.from({ length: upgradeCap(u.id, 6) + 1 }, (_, level) =>
        Array.from({ length: level }, (_, i) => upgradeCost(u.id, i)).reduce(
          (a, b) => a + b,
          0,
        ),
      ),
    })),
    research: RESEARCH.flatMap((r) =>
      Array.from({ length: 30 }, (_, level) => ({
        id: r.id,
        level,
        cost: researchCost(r.id, level),
      })),
    ),
    runs: [4, 5, 6].map((v) =>
      simulateCore(ENDLESS, "balanced", 42, {}, 1800, builds[0], v),
    ),
    newRuns: builds
      .slice(1)
      .map((l, i) =>
        simulateCore(ENDLESS, "balanced", 42, {}, 1800, l, 6, i + 1),
      ),
  }),
);
