// Timed, class-only Arena sweep through the production clock and combat helpers.
// Bundle with esbuild --bundle --platform=node --format=esm, then run with Node.
import { writeFileSync } from "node:fs";
import {
  initialCombat,
  useAbility as castAbility,
  type CombatState,
} from "../src/lib/runedelve/combatEngine";
import {
  advanceArenaClock,
  previewArenaChain,
  spawnArenaEnemies,
  type ArenaRun,
} from "../src/lib/runedelve/arenaState";
import {
  ensurePlayableBoard,
  isAdjacent,
  resolveBoard,
  type Cell,
} from "../src/lib/runedelve/boardEngine";
import {
  generateBoard,
  type RuneType,
} from "../src/lib/runedelve/dungeonGenerator";
import {
  endlessRewardFor,
  enemyTickIntervalMs,
  waveForElapsed,
} from "../src/lib/runedelve/endlessMode";
import { CLASS_LIST, type HeroClass } from "../src/lib/runedelve/classConfig";
import { mulberry32 } from "../src/lib/runedelve/prng";

function candidates(run: ArenaRun): Cell[][] {
  const found = new Map<string, Cell[]>();
  let budget = 0;
  function search(path: Cell[], seen: Set<number>) {
    if (--budget < 0) return;
    const tail = path[path.length - 1],
      type = run.grid[tail.r][tail.c];
    if (path.length >= 3) found.set(`${type}:${path.length}`, path);
    if (path.length >= 8) return;
    for (let r = Math.max(0, tail.r - 1); r <= Math.min(4, tail.r + 1); r++)
      for (let c = Math.max(0, tail.c - 1); c <= Math.min(4, tail.c + 1); c++) {
        const key = r * 5 + c;
        if (
          seen.has(key) ||
          run.grid[r][c] !== type ||
          !isAdjacent(tail, { r, c })
        )
          continue;
        search([...path, { r, c }], new Set([...seen, key]));
      }
  }
  for (let i = 0; i < 25; i++) {
    budget = 90; // Every start gets a budget; one large early cluster must not hide the other colors.
    const start = (i + run.tick * 7) % 25,
      r = Math.floor(start / 5),
      c = start % 5;
    search([{ r, c }], new Set([start]));
  }
  return [...found.values()];
}

function utility(
  before: CombatState,
  next: CombatState,
  type: RuneType,
  cls: HeroClass,
) {
  const alive = before.enemies.filter((enemy) => enemy.hp > 0).length;
  const manaValue =
    cls === "mage"
      ? 80 / 3
      : cls === "warrior"
        ? (40 * alive) / 3
        : cls === "cleric"
          ? (22 * alive + Math.min(30, before.maxHp - before.hp)) / 3
          : 20;
  const incoming = before.enemies
    .filter((enemy) => enemy.hp > 0)
    .reduce((n, e) => n + e.damage, 0);
  return (
    next.totalDamage -
    before.totalDamage +
    (next.hp - before.hp) * (before.hp < before.maxHp * 0.5 ? 1.7 : 0.75) +
    Math.max(0, next.mana - before.mana) * manaValue +
    Math.max(
      0,
      Math.min(2, next.shieldTurns) - Math.min(2, before.shieldTurns),
    ) *
      incoming *
      0.6 +
    (next.enemiesDefeated - before.enemiesDefeated) * 25 +
    (type === "red" ? 0.01 : 0)
  );
}

function simulate(seed: number, cls: HeroClass, cadence: number) {
  const rng = mulberry32(seed);
  let run: ArenaRun = {
    version: 1,
    requestId: "00000000-0000-4000-8000-000000000001",
    cls,
    seed,
    tick: 0,
    grid: ensurePlayableBoard(generateBoard(rng), rng).grid,
    combat: initialCombat(spawnArenaEnemies(0, seed), 9999),
    elapsed: 0,
    attackAt: enemyTickIntervalMs(0) / 1000,
    spawnAt: null,
    paused: false,
    savedAt: 0,
    result: null,
  };
  let nextAction = 0.8,
    actions = 0,
    casts = 0,
    minHp = 100;
  const killsByWave = [0, 0, 0, 0, 0],
    types = { red: 0, blue: 0, green: 0, gold: 0 };
  for (let step = 0; !run.result && step < 1300; step++) {
    run = advanceArenaClock(run, 0.1);
    minHp = Math.min(minHp, run.combat.hp);
    if (
      run.result ||
      run.elapsed + 0.001 < nextAction ||
      !run.combat.enemies.some((enemy) => enemy.hp > 0)
    )
      continue;
    const beforeKills = run.combat.enemiesDefeated;
    const ability =
      cls === "rogue" && run.combat.shadowstepActive
        ? { ok: false, next: run.combat }
        : castAbility(run.combat, cls);
    if (ability.ok) {
      run = { ...run, combat: ability.next };
      casts++;
      actions++;
      nextAction = run.elapsed + 0.3; // A ready ability is a quick tap, not another full chain-selection interval.
    } else {
      let best: {
        cells: Cell[];
        type: RuneType;
        next: CombatState;
        score: number;
      } | null = null;
      for (const cells of candidates(run)) {
        const type = run.grid[cells[0].r][cells[0].c];
        const next = previewArenaChain(run, type, cells.length).next;
        const score = utility(run.combat, next, type, cls);
        if (!best || score > best.score) best = { cells, type, next, score };
      }
      if (!best) throw Error(`Unplayable Arena board: ${seed}/${cls}`);
      const random = mulberry32(run.seed ^ (run.tick + 1));
      run = {
        ...run,
        tick: run.tick + 1,
        combat: best.next,
        grid: ensurePlayableBoard(
          resolveBoard(run.grid, best.cells, random),
          random,
        ).grid,
      };
      types[best.type]++;
      actions++;
      nextAction = run.elapsed + cadence;
    }
    killsByWave[waveForElapsed(run.elapsed).index - 1] +=
      run.combat.enemiesDefeated - beforeKills;
  }
  if (!run.result) throw Error("Arena clock did not terminate");
  return {
    survived: run.result.reason === "timeout",
    elapsed: run.elapsed,
    kills: run.result.kills,
    hp: run.combat.hp,
    minHp,
    actions,
    casts,
    shards: endlessRewardFor(run.result.kills).shards,
    killsByWave,
    types,
  };
}

const samples = Math.max(
  1,
  Math.min(
    200,
    Number(
      process.argv.find((arg) => arg.startsWith("--samples="))?.slice(10) || 30,
    ),
  ),
);
const output =
  process.argv.find((arg) => arg.startsWith("--output="))?.slice(9) ||
  "/tmp/rune-arena-balance.json";
const rows = [];
for (const cadence of [1.3, 2, 3.5, 5])
  for (const cls of CLASS_LIST) {
    const runs = Array.from({ length: samples }, (_, i) =>
      simulate(728391 + i * 1777, cls.id, cadence),
    );
    const mean = (read: (run: (typeof runs)[number]) => number) =>
      +(runs.reduce((n, run) => n + read(run), 0) / samples).toFixed(2);
    const kills = runs.map((run) => run.kills).sort((a, b) => a - b);
    const row = {
      cls: cls.id,
      cadence,
      samples,
      survival: mean((run) => +run.survived),
      kills: mean((run) => run.kills),
      p10: kills[Math.floor((samples - 1) * 0.1)],
      p90: kills[Math.floor((samples - 1) * 0.9)],
      elapsed: mean((run) => run.elapsed),
      hp: mean((run) => run.hp),
      casts: mean((run) => run.casts),
      actions: mean((run) => run.actions),
      shards: mean((run) => run.shards),
      killsByWave: [0, 1, 2, 3, 4].map((i) =>
        mean((run) => run.killsByWave[i]),
      ),
      chains: Object.fromEntries(
        (["red", "blue", "green", "gold"] as RuneType[]).map((type) => [
          type,
          mean((run) => run.types[type]),
        ]),
      ),
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
const report = {
  model:
    "Production Arena clock, class-only chain/ability helpers, 100ms time steps. Bounded greedy 3–8-rune search; fixed 1.3/2/3.5/5-second decision cadences and 300ms ready-ability taps. Does not model human touch errors or inspection planning.",
  seed: 728391,
  totalRuns: rows.length * samples,
  rows,
};
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({ output, totalRuns: report.totalRuns, complete: true }),
);
