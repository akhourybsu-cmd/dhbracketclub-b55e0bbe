// Actual Expedition engine sweep. No network, accounts or live database writes.
// Run by bundling with esbuild for Node, then executing the resulting module.
import {
  createExpedition,
  expeditionAbility,
  expeditionBoonChoices,
  expeditionChain,
  expeditionRouteChoices,
  chooseExpeditionBoon,
  chooseExpeditionRoute,
  expeditionReward,
  type ExpeditionRun,
} from "../src/lib/runedelve/expedition";
import { isAdjacent, type Cell } from "../src/lib/runedelve/boardEngine";
import type { HeroClass } from "../src/lib/runedelve/classConfig";
import type { RuneType } from "../src/lib/runedelve/dungeonGenerator";
function candidates(run: ExpeditionRun): Cell[][] {
  const best: Partial<Record<RuneType, Cell[][]>> = {};
  let budget = 2500;
  function dfs(path: Cell[], seen: Set<string>) {
    if (--budget < 0) return;
    const last = path[path.length - 1],
      type = run.grid[last.r][last.c];
    if (path.length >= 3) {
      const previous = best[type] ?? [];
      if (!previous.length || path.length > previous[0].length)
        best[type] = [path];
      else if (path.length === previous[0].length && previous.length < 2)
        best[type] = [...previous, path];
    }
    if (path.length >= 8) return;
    for (let r = Math.max(0, last.r - 1); r <= Math.min(4, last.r + 1); r++)
      for (let c = Math.max(0, last.c - 1); c <= Math.min(4, last.c + 1); c++) {
        const key = `${r}-${c}`;
        if (
          !seen.has(key) &&
          run.grid[r][c] === type &&
          isAdjacent(last, { r, c })
        ) {
          const next = new Set(seen);
          next.add(key);
          dfs([...path, { r, c }], next);
        }
      }
  }
  // Rotate entry order by turn to avoid a persistent top-left search preference.
  for (let index = 0; index < 25; index++) {
    const j = (index + run.totalTurns * 7) % 25,
      r = Math.floor(j / 5),
      c = j % 5;
    dfs([{ r, c }], new Set([`${r}-${c}`]));
  }
  return Object.values(best).flat();
}
function value(before: ExpeditionRun, after: ExpeditionRun, ability: boolean) {
  if (after === before) return -1e6;
  if (after.phase === "lost") return -1e5;
  const damage = after.combat.totalDamage - before.combat.totalDamage;
  const health = after.combat.hp - before.combat.hp;
  const mana = after.combat.mana - before.combat.mana;
  return (
    damage +
    health * 1.45 +
    Math.max(0, mana) * 23 +
    (after.combat.shieldTurns - before.combat.shieldTurns) * 4 +
    (after.combat.enemiesDefeated - before.combat.enemiesDefeated) * 22 +
    (after.combat.shadowstepActive && !before.combat.shadowstepActive
      ? 40
      : 0) +
    (after.phase === "boon" || after.phase === "won" ? 1000 : 0) +
    (ability ? 0.5 : 0)
  );
}
function simulate(seed: number, cls: HeroClass, ascension: number) {
  let run = createExpedition({
    id: "sim",
    seed,
    hero_class: cls,
    ascension,
    started_at: "2026-10-30T00:00:00Z",
  });
  let steps = 0;
  while (run.phase !== "won" && run.phase !== "lost" && steps++ < 200) {
    if (run.phase === "boon") {
      const weights = {
        ember: 65,
        echo: 60,
        verdant: run.combat.hp < 60 ? 90 : 45,
        bastion: 25,
        siphon: 40,
        firstlight: 50,
        tempest: 80,
        battery: 45,
        thorns: 35,
        fury: 25,
        phoenix: 85,
        hourglass: 30,
      };
      const choices = expeditionBoonChoices(run).sort(
        (a, b) => weights[b.id] - weights[a.id],
      );
      run = chooseExpeditionBoon(run, choices[0].id);
      continue;
    }
    if (run.phase === "route") {
      const paths = expeditionRouteChoices(run);
      const weights = {
        crypt: 70,
        hunt: run.combat.hp > 70 ? 55 : 15,
        vault: 30,
        shrine: run.combat.hp < 80 ? 90 : 45,
      };
      paths.sort((a, b) => weights[b] - weights[a]);
      run = chooseExpeditionRoute(run, paths[0]);
      continue;
    }
    let next = expeditionAbility(run),
      best = value(run, next, true);
    for (const chain of candidates(run)) {
      const candidate = expeditionChain(run, chain),
        score = value(run, candidate, false);
      if (score > best) {
        best = score;
        next = candidate;
      }
    }
    if (next === run)
      throw new Error(`Unplayable board ${seed}/${cls}/${ascension}`);
    run = next;
  }
  if (steps >= 200) throw new Error("Unbounded expedition");
  return {
    cleared: run.phase === "won",
    rooms: run.roomsCleared,
    turns: run.totalTurns,
    score: run.score,
    reward: expeditionReward(run.roomsCleared, ascension, run.phase === "won"),
    build: Object.keys(run.boons),
  };
}
const samples = Number(process.env.RUNE_EXP_SAMPLES ?? 12),
  rows = [];
for (const ascension of [0, 3, 7])
  for (const cls of ["warrior", "mage", "rogue", "cleric"] as HeroClass[]) {
    const runs = Array.from({ length: samples }, (_, i) =>
      simulate(728391 + i * 1777, cls, ascension),
    );
    const row = {
      ascension: ascension + 1,
      class: cls,
      samples,
      clearRate: Math.round(
        (runs.filter((r) => r.cleared).length / samples) * 100,
      ),
      averageRooms: +(runs.reduce((n, r) => n + r.rooms, 0) / samples).toFixed(
        2,
      ),
      averageTurns: Math.round(runs.reduce((n, r) => n + r.turns, 0) / samples),
      averageReward: Math.round(
        runs.reduce((n, r) => n + r.reward, 0) / samples,
      ),
      distinctBuilds: new Set(runs.map((r) => r.build.join(","))).size,
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
console.log(
  JSON.stringify({
    totalRuns: rows.length * samples,
    policy:
      "one-action-lookahead,3–8rune chains,mana-aware,defensive route draft; no purchased power",
    complete: true,
  }),
);
