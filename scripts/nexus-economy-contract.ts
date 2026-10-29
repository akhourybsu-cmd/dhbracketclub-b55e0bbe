import {
  UPGRADES,
  RESEARCH,
  CAMPAIGN,
  CHALLENGES,
  ENDLESS,
} from "../src/lib/nexus/core/catalog";
import { upgradeCost, researchCost } from "../src/lib/nexus/core/systems";
import { waveCredits } from "../src/lib/nexus/core/economy";
import { simulateCore } from "../src/lib/nexus/core/simulator";
const costs = UPGRADES.filter((u) => u.id !== "mortar").flatMap((u) =>
  Array.from({ length: u.max }, (_, i) => ({
    id: u.id,
    level: i + 1,
    total: Array.from({ length: i + 1 }, (_, lv) =>
      upgradeCost(u.id, lv),
    ).reduce((a, b) => a + b, 0),
  })),
);
const research = RESEARCH.flatMap((r) =>
  Array.from({ length: r.max }, (_, lv) => ({
    id: r.id,
    level: lv,
    cost: researchCost(r.id, lv),
  })),
);
const rewards = [...CAMPAIGN, ...CHALLENGES, ENDLESS].flatMap((s) =>
  [0, 1, s.waves || 10].map((w) => ({
    id: s.id,
    waves: w,
    credits: waveCredits(s, w),
  })),
);
console.log(
  JSON.stringify({
    costs,
    research,
    rewards,
    run: simulateCore(CAMPAIGN[0], "balanced", 42),
  }),
);
