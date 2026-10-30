// Actual-engine career model, with explicit clock speed and no idle-time padding.
// node --import tsx scripts/balance-nexus-long-game.ts [--hours=60] [--output=/tmp/nexus-long-game.json]
import { writeFileSync } from "node:fs";
import { ENDLESS, RESEARCH } from "../src/lib/nexus/core/catalog";
import { DIFFICULTIES } from "../src/lib/nexus/core/difficulty";
import { ARMORY, milestoneCredits } from "../src/lib/nexus/core/progression";
import { endlessCredits } from "../src/lib/nexus/core/economy";
import { researchCost } from "../src/lib/nexus/core/systems";
import { simulateCore } from "../src/lib/nexus/core/simulator";
import type {
  CoreLoadout,
  Research,
  UnlockId,
} from "../src/lib/nexus/core/types";

const hours = Number(
  process.argv.find((a) => a.startsWith("--hours="))?.slice(8) || 60,
);
const output =
  process.argv.find((a) => a.startsWith("--output="))?.slice(9) ||
  "/tmp/nexus-long-game.json";
const speed = 2; // Fastest game speed. Menus and breaks outside the engine excluded.
const rows = [];
const research: Research = {};
const unlocks: UnlockId[] = [];
let credits = 0,
  totalWaves = 0,
  best = 0,
  seconds = 0;
const cache = new Map<string, ReturnType<typeof simulateCore>>();
for (let index = 1; seconds < hours * 3600 && index <= 1500; index++) {
  const loadout: CoreLoadout = {
    weapons: unlocks.includes("venom")
      ? ["venom", "arc"]
      : unlocks.includes("rail")
        ? ["rail", "orbit"]
        : unlocks.includes("arc")
          ? ["arc", "orbit"]
          : unlocks.includes("orbit")
            ? ["orbit"]
            : [],
    module: unlocks.includes("repair") ? "repair" : null,
  };
  const minResearch = Math.min(...RESEARCH.map((r) => research[r.id] || 0));
  const threat = [...DIFFICULTIES]
    .reverse()
    .find(
      (d) =>
        totalWaves >= d.waves && minResearch >= [0, 4, 8, 12, 18, 24][d.id - 1],
    )!;
  // Two seeds per state; repeats reuse actual outcomes, never extrapolate DPS.
  const seed = index % 2 ? 42 : 7961;
  const key = JSON.stringify([loadout, research, threat.id, seed]);
  let run = cache.get(key);
  if (!run) {
    run = simulateCore(
      ENDLESS,
      "balanced",
      seed,
      research,
      2400,
      loadout,
      6,
      threat.id,
    );
    if (!run.finished) throw new Error(`Unfinished simulation: ${key}`);
    cache.set(key, run);
  }
  const payout =
    Math.floor(endlessCredits(run.waves) * threat.reward) +
    milestoneCredits(run.waves, best);
  credits += payout;
  totalWaves += run.waves;
  best = Math.max(best, run.waves);
  seconds += run.seconds / speed;
  const purchases: string[] = [];
  let buying = true;
  while (buying) {
    buying = false;
    const item = [...ARMORY]
      .sort((a, b) => a.cost - b.cost)
      .find((a) => !unlocks.includes(a.id) && totalWaves >= a.waves);
    if (item && credits >= item.cost) {
      credits -= item.cost;
      unlocks.push(item.id);
      purchases.push(item.id);
      buying = true;
      continue;
    }
    const track = [...RESEARCH]
      .filter((r) => (research[r.id] || 0) < r.max)
      .sort(
        (a, b) =>
          researchCost(a.id, research[a.id] || 0) -
          researchCost(b.id, research[b.id] || 0),
      )[0];
    // Save for near-term equipment; otherwise invest in the cheapest next level.
    if (track && (!item || item.cost > payout * 3)) {
      const cost = researchCost(track.id, research[track.id] || 0);
      if (credits >= cost) {
        credits -= cost;
        research[track.id] = (research[track.id] || 0) + 1;
        purchases.push(`${track.id}:${research[track.id]}`);
        buying = true;
      }
    }
  }
  rows.push({
    run: index,
    clockHours: Number((seconds / 3600).toFixed(3)),
    waves: run.waves,
    gameSeconds: run.seconds,
    totalWaves,
    threat: threat.id,
    payout,
    credits,
    purchases,
    unlocks: [...unlocks],
    research: { ...research },
  });
  if (index % 50 === 0)
    console.log(
      `Career ${index}: ${(seconds / 3600).toFixed(1)}h, ${totalWaves} waves, threat ${threat.id}, research ${minResearch}`,
    );
}
const report = {
  assumptions: {
    speed,
    strategy: "balanced",
    seedPool: [42, 7961],
    excludes: "menu time, offline waits, manual ability optimization",
    policy:
      "cheapest research, near-term equipment saving, conservative threat entry",
  },
  simulatedStates: cache.size,
  checkpoints: [1, 5, 10, 25, 50, hours].map((h) => ({
    hours: h,
    state: rows.find((r) => r.clockHours >= h) || rows.at(-1),
  })),
  rows,
};
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    output,
    simulatedStates: cache.size,
    checkpoints: report.checkpoints.map((c) => ({
      hours: c.hours,
      waves: c.state?.totalWaves,
      threat: c.state?.threat,
      unlocks: c.state?.unlocks.length,
      research: c.state?.research,
      credits: c.state?.credits,
    })),
  }),
);
