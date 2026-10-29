// Progression pacing with actual combat outcomes; not an optimal-player model.
import { writeFileSync } from "node:fs";
import { ENDLESS, RESEARCH } from "../src/lib/nexus/core/catalog";
import { ARMORY, milestoneCredits } from "../src/lib/nexus/core/progression";
import { endlessCredits } from "../src/lib/nexus/core/economy";
import { researchCost } from "../src/lib/nexus/core/systems";
import { simulateCore } from "../src/lib/nexus/core/simulator";
import type {
  CoreLoadout,
  Research,
  UnlockId,
} from "../src/lib/nexus/core/types";
const journeys = [];
for (const policy of ["arsenal", "research"] as const)
  for (const seed of [42, 7961]) {
    const research: Research = {},
      unlocks: UnlockId[] = [];
    let credits = 0,
      totalWaves = 0,
      best = 0;
    const rows = [];
    for (let index = 1; index <= 40; index++) {
      const weapons: CoreLoadout["weapons"] = unlocks.includes("mortar")
        ? ["mortar", "orbit"]
        : unlocks.includes("arc")
          ? ["arc", "orbit"]
          : unlocks.includes("orbit")
            ? ["orbit"]
            : [];
      const module = unlocks.includes("stasis")
        ? "stasis"
        : unlocks.includes("repair")
          ? "repair"
          : null;
      const run = simulateCore(
        ENDLESS,
        "balanced",
        seed + index * 7919,
        research,
        1800,
        { weapons, module },
      );
      const payout =
        endlessCredits(run.waves) + milestoneCredits(run.waves, best);
      credits += payout;
      totalWaves += run.waves;
      best = Math.max(best, run.waves);
      const purchases = [];
      let purchased = true;
      while (purchased) {
        purchased = false;
        const next = ARMORY.find((a) => !unlocks.includes(a.id));
        const track = [...RESEARCH]
          .sort((a, b) => (research[a.id] || 0) - (research[b.id] || 0))
          .find((r) => (research[r.id] || 0) < 3);
        const prioritizeResearch =
          policy === "research" && unlocks.includes("orbit") && !!track;
        if (
          next &&
          !prioritizeResearch &&
          totalWaves >= next.waves &&
          credits >= next.cost
        ) {
          credits -= next.cost;
          unlocks.push(next.id);
          purchases.push(next.id);
          purchased = true;
        } else if (
          track &&
          (!next || prioritizeResearch || credits < next.cost)
        ) {
          const price = researchCost(track.id, research[track.id] || 0);
          // Arsenal policy saves for equipment while any remains locked.
          if ((!next || prioritizeResearch) && credits >= price) {
            credits -= price;
            research[track.id] = (research[track.id] || 0) + 1;
            purchases.push(track.id + ":" + research[track.id]);
            purchased = true;
          }
        }
      }
      rows.push({
        run: index,
        waves: run.waves,
        seconds: run.seconds,
        payout,
        credits,
        purchases,
        unlocks: [...unlocks],
        research: { ...research },
      });
      if (
        unlocks.length === ARMORY.length &&
        RESEARCH.every((r) => (research[r.id] || 0) >= 3)
      )
        break;
    }
    journeys.push({ policy, seed, rows });
  }
writeFileSync(
  "/tmp/nexus-progression-pacing.json",
  JSON.stringify(journeys, null, 2) + "\n",
);
for (const j of journeys) {
  const first = j.rows.find((r) => r.unlocks.includes("orbit"))?.run,
    all = j.rows.find((r) => r.unlocks.length === 7)?.run,
    trained = j.rows.find((r) =>
      RESEARCH.every((t) => (r.research[t.id] || 0) >= 3),
    )?.run;
  console.log(
    j.policy,
    j.seed,
    "first weapon",
    first,
    "all equipment",
    all,
    "all research level 3",
    trained,
    "minutes",
    Math.round(j.rows.reduce((sum, r) => sum + r.seconds, 0) / 60),
  );
}
