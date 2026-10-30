// The real combat engine with deterministic player policies, not a DPS approximation.
import { ENDLESS } from "./catalog";
import { STARTER_LOADOUT, upgradeAvailable } from "./progression";
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
import {
  BALANCE_VERSION,
  WEAPON_IDS,
  emptyMetrics,
  upgradeCap,
} from "./systems";
import type { CoreLoadout, CoreScenario, Research, UpgradeId } from "./types";

export type BuildStrategy =
  "balanced" | "gunner" | "bulwark" | "control" | "economy" | "idle";
export const BUILD_PLANS: Record<
  Exclude<BuildStrategy, "idle">,
  UpgradeId[]
> = {
  balanced: [
    "laser",
    "venom",
    "flak",
    "cooldown",
    "thorns",
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
    "mortar",
    "regen",
    "multishot",
    "frost",
    "damage",
    "armor",
    "critical",
    "range",
  ],
  gunner: [
    "laser",
    "venom",
    "flak",
    "cooldown",
    "thorns",
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
    "mortar",
  ],
  bulwark: [
    "laser",
    "venom",
    "flak",
    "cooldown",
    "thorns",
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
    "mortar",
    "income",
  ],
  control: [
    "laser",
    "venom",
    "flak",
    "cooldown",
    "thorns",
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
    "mortar",
    "shield",
  ],
  economy: [
    "laser",
    "venom",
    "flak",
    "cooldown",
    "thorns",
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
    "mortar",
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
  loadout: CoreLoadout = STARTER_LOADOUT,
  balanceVersion = BALANCE_VERSION,
  difficulty = 1,
) {
  let s = startWave(
      createRun(
        scenario,
        research,
        "simulation",
        seed,
        loadout,
        balanceVersion,
        difficulty,
      ),
      scenario,
    ),
    cursor = 0,
    nextDecision = 0;
  const plan = strategy === "idle" ? [] : BUILD_PLANS[strategy];
  let firstShot: number | null = null,
    firstKill: number | null = null,
    firstBoss: number | null = null,
    intermissionSeconds = 0,
    approachSeconds = 0,
    waveStarted = 0,
    peakEnemies = 0;
  const purchases: number[] = [],
    waveSeconds: number[] = [];
  for (let i = 0; i < maxSeconds / 0.05 && !isFinished(s); i++) {
    const spent = s.metrics!.energySpent;
    if (strategy !== "idle" && s.time >= nextDecision) {
      nextDecision = s.time + 0.75;
      // Emergency fortification costs compete with the planned weapon investment.
      if (s.hp < stats(s, scenario).maxHp * 0.45)
        s = buyUpgrade(s, scenario, "hull");
      let attempts = 0;
      while (attempts++ < plan.length) {
        const id = plan[cursor % plan.length];
        if (
          upgradeBlocked(id, scenario) ||
          !upgradeAvailable(s, id) ||
          (s.upgrades[id] || 0) >= upgradeCap(id, s.balanceVersion || 3)
        ) {
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
    if (s.metrics!.energySpent > spent) purchases.push(s.time);
    const phase = s.phase,
      cleared = s.cleared,
      wave = s.wave;
    if (phase === "intermission") intermissionSeconds += 0.05;
    else {
      const range = stats(s, scenario).range;
      if (!s.enemies.some((e) => distance(e) <= range)) approachSeconds += 0.05;
    }
    s = stepRun(s, scenario);
    if (firstShot === null && WEAPON_IDS.some((id) => s.metrics!.shots[id] > 0))
      firstShot = s.time;
    if (firstKill === null && s.kills > 0) firstKill = s.time;
    if (firstBoss === null && s.enemies.some((e) => e.kind === "boss"))
      firstBoss = s.time;
    if (s.cleared > cleared)
      waveSeconds.push(Number((s.time - waveStarted).toFixed(2)));
    if (s.wave > wave) waveStarted = s.time;
    peakEnemies = Math.max(peakEnemies, s.enemies.length);
  }
  const metrics = s.metrics || emptyMetrics();
  return {
    scenario: scenario.id,
    strategy,
    seed,
    balanceVersion: s.balanceVersion,
    difficulty: s.difficulty || 1,
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
    loadout: s.loadout,
    pacing: {
      firstShot,
      firstKill,
      firstBoss,
      intermissionSeconds: Math.round(intermissionSeconds),
      approachSeconds: Math.round(approachSeconds),
      peakEnemies,
      purchases: purchases.map((t) => Number(t.toFixed(2))),
      waveSeconds,
    },
  };
}
export const ALL_SCENARIOS = [ENDLESS];
