// Headless combat/board sweep, with no live account reads or writes.
// Bundle: node_modules/esbuild/bin/esbuild scripts/balance-rune-campaign.ts --bundle --platform=node --format=esm --outfile=/tmp/rune-balance.mjs
// Run: node /tmp/rune-balance.mjs [--runs=24] [--all] [--output=/tmp/rune-campaign-balance.json]
import { writeFileSync } from "node:fs";
import { CLASS_LIST } from "../src/lib/runedelve/classConfig";
import { simulateLevel } from "../src/lib/runedelve/simulator";

const runs = Math.min(
  200,
  Math.max(
    1,
    Number(
      process.argv.find((arg) => arg.startsWith("--runs="))?.slice(7) || 24,
    ),
  ),
);
const output =
  process.argv.find((arg) => arg.startsWith("--output="))?.slice(9) ||
  "/tmp/rune-campaign-balance.json";
const levels = process.argv.includes("--all")
  ? Array.from({ length: 150 }, (_, index) => index + 1)
  : [
      1, 5, 10, 15, 20, 25, 30, 34, 40, 50, 51, 60, 68, 75, 80, 85, 90, 100,
      102, 106, 110, 119, 120, 125, 130, 136, 140, 150,
    ];
const cells = [];
for (const cls of CLASS_LIST) {
  for (const level of levels) {
    const result = simulateLevel(level, cls.id, runs, 0xd311e);
    for (const run of result.runs) {
      if (
        [
          run.hpRemaining,
          run.totalDamage,
          run.turnsUsed,
          run.resonanceBursts,
          run.bonusActions,
        ].some((value) => !Number.isFinite(value) || value < 0)
      ) {
        throw new Error(`Invalid combat state: ${cls.id}, chamber ${level}`);
      }
    }
    cells.push({
      cls: cls.id,
      level,
      clearRate: result.aggregate.clearRate,
      avgHpRemaining: result.aggregate.avgHpRemaining,
      avgTurnsUsed: result.aggregate.avgTurnsUsed,
      resonanceBursts:
        result.runs.reduce((sum, run) => sum + run.resonanceBursts, 0) / runs,
      bonusActions:
        result.runs.reduce((sum, run) => sum + run.bonusActions, 0) / runs,
      heavyStrikeFires: result.aggregate.avgHeavyStrikeFires,
    });
  }
}
const summary = CLASS_LIST.map((cls) => {
  const rows = cells.filter((cell) => cell.cls === cls.id);
  const mean = (part: typeof rows) =>
    Number(
      (
        part.reduce((sum, row) => sum + row.clearRate, 0) /
        Math.max(1, part.length)
      ).toFixed(3),
    );
  return {
    cls: cls.id,
    chapter1: mean(rows.filter((row) => row.level <= 50)),
    chapter2: mean(rows.filter((row) => row.level > 50 && row.level <= 100)),
    chapter3: mean(rows.filter((row) => row.level > 100)),
    lowest: [...rows]
      .sort((a, b) => a.clearRate - b.clearRate)
      .slice(0, 5)
      .map((row) => ({ level: row.level, clearRate: row.clearRate })),
  };
});
const report = {
  model:
    "Deterministic attentive-player heuristic; baseline class, no relics/masteries, board hazards/seals or boss phase damage bumps. Includes objectives, armor, enemy abilities, telegraphed attacks, waves, chain tiers/free actions, Convergence, and dead-board recovery.",
  seed: 0xd311e,
  runsPerClassLevel: runs,
  totalRuns: cells.length * runs,
  summary,
  cells,
};
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({ output, totalRuns: report.totalRuns, summary }, null, 2),
);
