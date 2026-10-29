import { UPGRADES, RESEARCH, ENDLESS } from "../src/lib/nexus/core/catalog";
import {
  ARMORY,
  MILESTONES,
  STARTER_LOADOUT,
} from "../src/lib/nexus/core/progression";
import { upgradeCost, researchCost } from "../src/lib/nexus/core/systems";
import { endlessCredits } from "../src/lib/nexus/core/economy";
import { simulateCore } from "../src/lib/nexus/core/simulator";
import type { CoreLoadout } from "../src/lib/nexus/core/types";
const loadouts: CoreLoadout[] = [
  STARTER_LOADOUT,
  { weapons: ["rail", "orbit"], module: "repair" },
  { weapons: ["arc", "mortar"], module: "siphon" },
  { weapons: ["mortar", "orbit"], module: "stasis" },
];
console.log(
  JSON.stringify({
    armory: ARMORY,
    milestones: MILESTONES,
    costs: UPGRADES.flatMap((u) =>
      Array.from({ length: u.max + 1 }, (_, level) => ({
        id: u.id,
        level,
        total: Array.from({ length: level }, (_, i) =>
          upgradeCost(u.id, i),
        ).reduce((a, b) => a + b, 0),
      })),
    ),
    research: RESEARCH.flatMap((r) =>
      Array.from({ length: r.max }, (_, level) => ({
        id: r.id,
        level,
        cost: researchCost(r.id, level),
      })),
    ),
    rewards: [0, 1, 5, 10, 15, 20, 50, 10000].map((wave) => ({
      wave,
      credits: endlessCredits(wave),
    })),
    runs: loadouts.map((loadout) =>
      simulateCore(ENDLESS, "balanced", 42, {}, 1800, loadout),
    ),
  }),
);
