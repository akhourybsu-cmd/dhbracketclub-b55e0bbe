// Headless combat/board sweep, with no live account reads or writes.
// Bundle: node_modules/esbuild/bin/esbuild scripts/balance-rune-campaign.ts --bundle --platform=node --format=esm --outfile=/tmp/rune-balance.mjs
// Run: node /tmp/rune-balance.mjs [--runs=24] [--all] [--profile=naked|progression|earned-proposal|earned-affordable|both] [--canonical] [--levels=1,50,150] [--output=/tmp/rune-campaign-balance.json]
import { writeFileSync } from "node:fs";
import { CLASS_LIST } from "../src/lib/runedelve/classConfig";
import {
  NAKED_SIM_PROFILE,
  progressionSimProfile,
  proposedEarnedSimProfile,
  affordableSimProfile,
  simulateLevel,
} from "../src/lib/runedelve/simulator";

const canonicalBoard = process.argv.includes("--canonical");
const runs = Math.min(
  200,
  Math.max(
    1,
    Number(
      process.argv.find((arg) => arg.startsWith("--runs="))?.slice(7) ||
        (canonicalBoard ? 1 : 24),
    ),
  ),
);
const output =
  process.argv.find((arg) => arg.startsWith("--output="))?.slice(9) ||
  "/tmp/rune-campaign-balance.json";
const requestedProfile =
  process.argv.find((arg) => arg.startsWith("--profile="))?.slice(10) ||
  "naked";
if (
  ![
    "naked",
    "progression",
    "earned-proposal",
    "earned-affordable",
    "both",
  ].includes(requestedProfile)
)
  throw new Error(
    "--profile must be naked, progression, earned-proposal, earned-affordable, or both",
  );
if (!Number.isFinite(runs)) throw new Error("--runs must be a finite number");
const profiles =
  requestedProfile === "both" ? ["naked", "progression"] : [requestedProfile];
const explicitLevels = process.argv
  .find((arg) => arg.startsWith("--levels="))
  ?.slice(9);
const levels = explicitLevels
  ? explicitLevels.split(",").map(Number)
  : process.argv.includes("--all")
    ? Array.from({ length: 150 }, (_, index) => index + 1)
    : [
        1, 5, 10, 15, 20, 25, 30, 34, 40, 50, 51, 60, 68, 75, 80, 85, 90, 100,
        102, 106, 110, 119, 120, 125, 130, 136, 140, 150,
      ];
if (
  levels.some((level) => !Number.isInteger(level) || level < 1 || level > 150)
)
  throw new Error("--levels must list integer chambers from 1 to 150");
const cells = [];
for (const profileName of profiles) {
  for (const cls of CLASS_LIST) {
    for (const level of levels) {
      const profile =
        profileName === "earned-affordable"
          ? affordableSimProfile(level, cls.id)
          : profileName === "earned-proposal"
            ? proposedEarnedSimProfile(level)
            : profileName === "progression"
              ? progressionSimProfile(level)
              : NAKED_SIM_PROFILE;
      const result = simulateLevel(level, cls.id, runs, 0xd311e, profile, {
        canonicalBoard,
      });
      for (const run of result.runs) {
        if (
          [
            run.hpRemaining,
            run.totalDamage,
            run.turnsUsed,
            run.resonanceBursts,
            run.bonusActions,
            run.turnsRemaining,
            run.turnBudget,
          ].some((value) => !Number.isFinite(value) || value < 0)
        ) {
          throw new Error(`Invalid combat state: ${cls.id}, chamber ${level}`);
        }
        if (
          run.turnsUsed + run.turnsRemaining !== run.turnBudget ||
          run.wavesSpawned > run.wavesTotal
        )
          throw new Error(
            `Invalid wave/turn accounting: ${cls.id}, chamber ${level}`,
          );
      }
      cells.push({
        cls: cls.id,
        profile: profile.id,
        classLevel: profile.classLevel,
        slots: profile.slots ?? [],
        ranks: profile.ranks ?? {},
        level,
        clearRate: result.aggregate.clearRate,
        avgHpRemaining: result.aggregate.avgHpRemaining,
        avgTurnsUsed: result.aggregate.avgTurnsUsed,
        avgTurnsRemaining: result.aggregate.avgTurnsRemaining,
        avgTurnBudget: result.aggregate.avgTurnBudget,
        hpPerTurnBudget: result.aggregate.hpPerTurnBudget,
        nearDeathRate: result.aggregate.nearDeathRate,
        avgMinHp: result.aggregate.avgMinHp,
        avgIncomingPerTurn: result.aggregate.avgIncomingPerTurn,
        wavesSpawned:
          result.runs.reduce((sum, run) => sum + run.wavesSpawned, 0) / runs,
        phaseTransitions:
          result.runs.reduce((sum, run) => sum + run.phaseTransitions, 0) /
          runs,
        failures: Object.fromEntries(
          ["hp", "turns", "objective", "board", "safety"].map((reason) => [
            reason,
            result.runs.filter((run) => run.failureReason === reason).length,
          ]),
        ),
        resonanceBursts:
          result.runs.reduce((sum, run) => sum + run.resonanceBursts, 0) / runs,
        bonusActions:
          result.runs.reduce((sum, run) => sum + run.bonusActions, 0) / runs,
        heavyStrikeFires: result.aggregate.avgHeavyStrikeFires,
      });
    }
  }
}
const summary = profiles.flatMap((profile) =>
  CLASS_LIST.map((cls) => {
    const rows = cells.filter(
      (cell) => cell.cls === cls.id && cell.profile === profile,
    );
    const mean = (part: typeof rows) =>
      Number(
        (
          part.reduce((sum, row) => sum + row.clearRate, 0) /
          Math.max(1, part.length)
        ).toFixed(3),
      );
    const metrics = (part: typeof rows) => {
      const average = (
        key:
          | "avgMinHp"
          | "avgTurnsUsed"
          | "avgTurnsRemaining"
          | "avgIncomingPerTurn",
      ) =>
        Number(
          (
            part.reduce((sum, row) => sum + row[key], 0) /
            Math.max(1, part.length)
          ).toFixed(2),
        );
      return {
        clearRate: mean(part),
        minHp: average("avgMinHp"),
        turnsUsed: average("avgTurnsUsed"),
        turnsRemaining: average("avgTurnsRemaining"),
        incomingPerTurn: average("avgIncomingPerTurn"),
      };
    };
    return {
      cls: cls.id,
      profile,
      chapterMetrics: [
        metrics(rows.filter((row) => row.level <= 50)),
        metrics(rows.filter((row) => row.level > 50 && row.level <= 100)),
        metrics(rows.filter((row) => row.level > 100)),
      ],
      chapter1: mean(rows.filter((row) => row.level <= 50)),
      chapter2: mean(rows.filter((row) => row.level > 50 && row.level <= 100)),
      chapter3: mean(rows.filter((row) => row.level > 100)),
      lowest: [...rows]
        .sort((a, b) => a.clearRate - b.clearRate)
        .slice(0, 5)
        .map((row) => ({ level: row.level, clearRate: row.clearRate })),
    };
  }),
);
const report = {
  modelVersion: 4,
  curveId: "2026-10-balanced-campaign",
  affordableBuild:
    "earned-affordable uses class anchors1/5/12/24/40 at chambers1/15/50/100/150 and R1–3 gear. Rogue Ember+Iron; others Ember+Aether. Class25 adds the remaining item in the unlocked third slot. Mage purchases Aether first. Authoritative class ability costs and first-red Opening Strike are modelled. Historical progression/earned-proposal preserve their two-item comparison loadouts.",
  model:
    "Deterministic attentive-player heuristic driving the shared combat and board engines. Includes combat-earned objectives/legacy goal normalization, all authored reinforcement waves and turn grants, armor/enemy abilities, telegraphs, phase damage transitions, seals/eclipse/linked pairs/shifting/corruption, layout hazard damage, chain tiers/free actions, Convergence, and dead-board/seal-topology recovery. Naked is class level 1 with no equipment. Progression interpolates class levels 1/5/12/20/25 at chambers 1/15/50/100/150 and uses up to two explicitly modelled R1–3 relics plus mastery tiers 1–2. Separately selected earned-proposal uses proposed class anchors 12/24/40 at50/100/150, including tier-three abilities via the shared engine; this does not change the progression baseline.",
  limitations: [
    canonicalBoard
      ? "Canonical board mode matches campaign's opening generation seed and per-chain generation_seed+1000+rngTick refill sequence. Repeated runs are identical deterministic cases, not independent player samples."
      : "Each sample varies board RNG from the fixed seed; this estimates board variance, not the exact canonical production board/refill sequence. Use --canonical for the campaign opening/refill seeds.",
    "The heuristic caps searched chains at nine runes, uses immediate utility, and does not optimize several turns ahead or reserve mana across authored waves.",
    "Steady path, no bargain, Daily modifiers, secondary-goal rewards, settlement treasure score/shards, or persistence. Those rewards do not alter the simulated primary combat goal.",
    "Profiles reject unsupported equipment and class level 50+ rather than silently omit echo, revival, random critical, First Light, or higher-tier page-level mastery procs. Preset gear is an affordable comparison loadout, not best in slot or a live-account reconstruction. Historical progression/earned-proposal deliberately keep two slots; earned-affordable equips the unlocked third slot.",
  ],
  seed: 0xd311e,
  boardMode: canonicalBoard ? "canonical" : "varied",
  runsPerClassLevel: runs,
  totalRuns: cells.length * runs,
  summary,
  cells,
};
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({ output, totalRuns: report.totalRuns, summary }, null, 2),
);
