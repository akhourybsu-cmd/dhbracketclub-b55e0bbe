// The real combat engine with deterministic player policies, not a DPS approximation.
import { CAMPAIGN, CHALLENGES, ENDLESS, UPGRADES } from "./catalog";
import {
  activateAbility,
  buyUpgrade,
  createRun,
  distance,
  isFinished,
  startWave,
  stats,
  stepRun,
  upgradeBlocked,
} from "./engine";
import { rewardBreakdown } from "./economy";
import { WEAPON_IDS, emptyMetrics } from "./systems";
import type { CoreScenario, Research, UpgradeId } from "./types";

export type BuildStrategy =
  "balanced" | "gunner" | "bulwark" | "control" | "economy" | "idle";
export const BUILD_PLANS: Record<
  Exclude<BuildStrategy, "idle">,
  UpgradeId[]
> = {
  balanced: [
    "damage",
    "haste",
    "orbit",
    "hull",
    "arc",
    "damage",
    "income",
    "haste",
    "shield",
    "rail",
    "regen",
    "multishot",
    "frost",
    "damage",
    "armor",
    "critical",
    "range",
  ],
  gunner: [
    "damage",
    "haste",
    "damage",
    "multishot",
    "rail",
    "haste",
    "critical",
    "range",
    "damage",
    "rail",
    "hull",
    "arc",
  ],
  bulwark: [
    "orbit",
    "damage",
    "hull",
    "shield",
    "regen",
    "armor",
    "arc",
    "multishot",
    "orbit",
    "haste",
    "frost",
    "damage",
    "rail",
    "income",
  ],
  control: [
    "arc",
    "damage",
    "haste",
    "frost",
    "range",
    "multishot",
    "orbit",
    "hull",
    "arc",
    "damage",
    "rail",
    "shield",
  ],
  economy: [
    "income",
    "damage",
    "haste",
    "income",
    "orbit",
    "hull",
    "arc",
    "income",
    "damage",
    "shield",
    "rail",
    "multishot",
    "regen",
  ],
};
export function simulateCore(
  scenario: CoreScenario,
  strategy: BuildStrategy,
  seed: number,
  research: Research = {},
  maxSeconds = 1800,
) {
  let s = startWave(
      createRun(scenario, research, "simulation", seed),
      scenario,
    ),
    cursor = 0,
    nextDecision = 0;
  const plan = strategy === "idle" ? [] : BUILD_PLANS[strategy];
  for (let i = 0; i < maxSeconds / 0.05 && !isFinished(s); i++) {
    if (strategy !== "idle" && s.time >= nextDecision) {
      nextDecision = s.time + 0.75;
      // Emergency fortification costs compete with the planned weapon investment.
      if (s.hp < stats(s, scenario).maxHp * 0.45)
        s = buyUpgrade(s, scenario, "hull");
      let attempts = 0;
      while (attempts++ < plan.length) {
        const id = plan[cursor % plan.length],
          def = UPGRADES.find((u) => u.id === id)!;
        if (upgradeBlocked(id, scenario) || (s.upgrades[id] || 0) >= def.max) {
          cursor++;
          continue;
        }
        const next = buyUpgrade(s, scenario, id);
        if (next !== s) {
          s = next;
          cursor++;
        }
        break;
      }
      if (
        s.enemies.filter((e) => distance(e) < 180).length >= 3 ||
        s.enemies.some((e) => e.kind === "boss" && distance(e) < 150)
      )
        s = activateAbility(s, scenario, "nova");
      if (
        s.enemies.filter((e) => distance(e) < stats(s, scenario).range)
          .length >= 5 ||
        s.enemies.some((e) => e.kind === "boss" && distance(e) < 250)
      )
        s = activateAbility(s, scenario, "overdrive");
    }
    s = stepRun(s, scenario);
  }
  const metrics = s.metrics || emptyMetrics();
  return {
    scenario: scenario.id,
    strategy,
    seed,
    finished: isFinished(s),
    victory: s.phase === "victory",
    waves: s.cleared,
    seconds: Math.round(s.time),
    hullRatio: Number((s.hp / stats(s, scenario).maxHp).toFixed(3)),
    score: s.score,
    kills: s.kills,
    credits: rewardBreakdown(s, scenario, {
      campaign: { [scenario.id]: 1 },
      challenges: { [scenario.id]: 1 },
    }).total,
    energy: s.energy,
    energyEarned: metrics.energyEarned,
    energySpent: metrics.energySpent,
    damage: Object.fromEntries(
      WEAPON_IDS.map((k) => [k, Math.round(metrics.damage[k])]),
    ),
    upgrades: s.upgrades,
  };
}
export const ALL_SCENARIOS = [...CAMPAIGN, ...CHALLENGES, ENDLESS];
