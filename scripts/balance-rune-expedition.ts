// Actual Expedition engine sweep; deterministic seeds, no accounts/network/DB.
// Bundle for Node with esbuild, then execute. RUNE_EXP_SAMPLES defaults to12.
// RUNE_EXP_POLICIES=smart,ordinary,legacy; RUNE_EXP_ASCENSIONS=1,4,8.
// Optional RUNE_EXP_RUNS writes raw simulation records to a local JSON file.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  createExpedition,
  expeditionAbility,
  expeditionBoonChoices,
  expeditionBoonGain,
  expeditionChain,
  expeditionRouteChoices,
  chooseExpeditionBoon,
  chooseExpeditionRoute,
  expeditionReward,
  type ExpeditionBoonId,
  type ExpeditionRouteId,
  type ExpeditionRun,
} from "../src/lib/runedelve/expedition";
import { isAdjacent, type Cell } from "../src/lib/runedelve/boardEngine";
import type { HeroClass } from "../src/lib/runedelve/classConfig";
import type { RuneType } from "../src/lib/runedelve/dungeonGenerator";

export type ExpeditionPolicy = "smart" | "ordinary" | "legacy";
const CLASSES: HeroClass[] = ["warrior", "mage", "rogue", "cleric"];

/** Frozen historical search/weights make previous balance reports comparable. */
function legacyCandidates(run: ExpeditionRun): Cell[][] {
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
  for (let index = 0; index < 25; index++) {
    const j = (index + run.totalTurns * 7) % 25,
      r = Math.floor(j / 5),
      c = j % 5;
    dfs([{ r, c }], new Set([`${r}-${c}`]));
  }
  return Object.values(best).flat();
}

/** Every start gets its own budget; a large cluster cannot hide other colors. */
export function expeditionCandidates(
  run: ExpeditionRun,
  maximum = 10,
): Cell[][] {
  const best = new Map<string, Cell[][]>();
  const signatures = new Map<string, Set<string>>();
  for (let index = 0; index < 25; index++) {
    let budget = 160;
    const j = (index + run.totalTurns * 7) % 25,
      r = Math.floor(j / 5),
      c = j % 5;
    const type = run.grid[r][c];
    function dfs(path: Cell[], seen: Set<string>) {
      if (--budget < 0) return;
      if (path.length >= 3) {
        const key = `${type}:${path.length}`;
        const paths = best.get(key) ?? [];
        const signature = [...seen].sort().join(",");
        const previous = signatures.get(key) ?? new Set<string>();
        if (paths.length < 2 && !previous.has(signature)) {
          best.set(key, [...paths, path]);
          previous.add(signature);
          signatures.set(key, previous);
        }
      }
      if (path.length >= maximum) return;
      const last = path[path.length - 1];
      for (
        let nr = Math.max(0, last.r - 1);
        nr <= Math.min(4, last.r + 1);
        nr++
      )
        for (
          let nc = Math.max(0, last.c - 1);
          nc <= Math.min(4, last.c + 1);
          nc++
        ) {
          const key = `${nr}-${nc}`;
          if (seen.has(key) || run.grid[nr][nc] !== type) continue;
          const next = new Set(seen);
          next.add(key);
          dfs([...path, { r: nr, c: nc }], next);
        }
    }
    dfs([{ r, c }], new Set([`${r}-${c}`]));
  }
  return [...best.values()].flat();
}

function actionValue(
  before: ExpeditionRun,
  after: ExpeditionRun,
  policy: ExpeditionPolicy,
  length: number,
) {
  if (after === before) return -1e6;
  if (after.phase === "lost") return -1e5;
  const damage = after.combat.totalDamage - before.combat.totalDamage;
  const health = after.combat.hp - before.combat.hp;
  const mana = Math.max(0, after.combat.mana - before.combat.mana);
  const guard = after.combat.shieldTurns - before.combat.shieldTurns;
  const kill = after.combat.enemiesDefeated - before.combat.enemiesDefeated;
  const clear = after.phase === "boon" || after.phase === "won" ? 1000 : 0;
  const primed =
    after.combat.shadowstepActive && !before.combat.shadowstepActive ? 40 : 0;
  if (policy === "legacy")
    return (
      damage +
      health * 1.45 +
      mana * 23 +
      guard * 4 +
      kill * 22 +
      primed +
      clear +
      (length ? 0 : 0.5)
    );
  const fraction = before.combat.hp / before.combat.maxHp;
  const healingWeight =
    ((before.heroClass === "warrior" || before.heroClass === "mage"
      ? 0.9
      : 0.5) +
      1.9 * (1 - fraction) ** 2) *
    (before.combat.turnsRemaining < 5 && fraction > 0.4 ? 0.5 : 1);
  const manaValue = { warrior: 26, mage: 28, rogue: 22, cleric: 24 }[
    before.heroClass
  ];
  const usefulGuard =
    Math.min(after.combat.shieldTurns, 4) -
    Math.min(before.combat.shieldTurns, 4);
  return (
    damage +
    health * healingWeight +
    mana * manaValue +
    usefulGuard * 4 +
    kill * 24 +
    primed +
    clear +
    length * 0.35
  );
}

function chooseBoon(
  run: ExpeditionRun,
  policy: ExpeditionPolicy,
): ExpeditionBoonId {
  const fraction = run.combat.hp / run.combat.maxHp;
  const averageMoves = run.totalTurns / Math.max(1, run.roomsCleared);
  const legacy: Record<ExpeditionBoonId, number> = {
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
  const smart: Record<ExpeditionBoonId, number> = {
    ember: 74 / (1 + (run.boons.ember ?? 0) * 0.14),
    echo: run.heroClass === "rogue" ? 72 : 78,
    tempest: 92 / (1 + (run.boons.tempest ?? 0) * 0.12),
    fury: 52 + (fraction < 0.5 ? 35 : 0),
    hourglass:
      (run.heroClass === "cleric" ? 86 : run.heroClass === "rogue" ? 76 : 46) +
      Math.max(0, averageMoves - 9) * 5,
    verdant:
      (fraction < 0.45 ? 110 : fraction < 0.7 ? 70 : 30) -
      (run.heroClass === "cleric" ? 10 : 0),
    bastion:
      (run.heroClass === "warrior" ? 60 : 42) + (fraction < 0.5 ? 18 : 0),
    siphon: (fraction < 0.6 ? 70 : 42) - (run.heroClass === "cleric" ? 14 : 0),
    firstlight:
      60 -
      (run.boons.firstlight ?? 0) * 14 -
      (run.heroClass === "mage" ? 10 : 0),
    battery:
      (run.heroClass === "cleric" ? 66 : 52) - (run.boons.battery ?? 0) * 10,
    thorns:
      (run.heroClass === "warrior" ? 62 : 38) + (run.boons.bastion ?? 0) * 6,
    phoenix:
      fraction < 0.4
        ? 110
        : run.heroClass === "cleric"
          ? 38
          : run.heroClass === "rogue"
            ? 72
            : run.ascension >= 3
              ? 100
              : 85,
  };
  const weights =
    policy === "legacy"
      ? legacy
      : policy === "ordinary"
        ? { ...legacy, fury: 60, phoenix: fraction < 0.5 ? 90 : 55 }
        : smart;
  return [...expeditionBoonChoices(run)].sort(
    (a, b) =>
      weights[b.id] * (policy === "smart" ? expeditionBoonGain(run, b.id) : 1) -
      weights[a.id] * (policy === "smart" ? expeditionBoonGain(run, a.id) : 1),
  )[0].id;
}
function chooseRoute(
  run: ExpeditionRun,
  policy: ExpeditionPolicy,
): ExpeditionRouteId {
  const fraction = run.combat.hp / run.combat.maxHp;
  const legacy: Record<ExpeditionRouteId, number> = {
    crypt: 70,
    hunt: run.combat.hp > 70 ? 55 : 15,
    vault: 30,
    shrine: run.combat.hp < 80 ? 90 : 45,
  };
  const smart: Record<ExpeditionRouteId, number> = {
    crypt: 62,
    hunt: fraction > 0.65 ? 80 : fraction > 0.45 ? 45 : 20,
    vault:
      fraction > 0.75 && (run.boons.tempest ?? 0) + (run.boons.echo ?? 0) >= 2
        ? 75
        : 45,
    shrine: fraction < 0.7 ? 100 : 50,
  };
  const weights = policy === "smart" ? smart : legacy;
  return [...expeditionRouteChoices(run)].sort(
    (a, b) => weights[b] - weights[a],
  )[0];
}
export function simulateExpedition(
  seed: number,
  cls: HeroClass,
  ascension: number,
  policy: ExpeditionPolicy = "smart",
) {
  let run = createExpedition({
    id: "sim",
    seed,
    hero_class: cls,
    ascension,
    started_at: "2026-10-30T00:00:00Z",
  });
  const drafts: Array<{
    room: number;
    offered: ExpeditionBoonId[];
    picked: ExpeditionBoonId;
    gain: number;
  }> = [];
  const routes: Array<{
    room: number;
    offered: ExpeditionRouteId[];
    picked: ExpeditionRouteId;
  }> = [];
  const rooms: Array<{
    room: number;
    entryHP: number;
    exitHP: number;
    turns: number;
    cleared: boolean;
  }> = [];
  const actions: Record<RuneType | "ability", number> = {
    red: 0,
    blue: 0,
    green: 0,
    gold: 0,
    ability: 0,
  };
  let entryHP = run.combat.hp,
    entryTurn = 0,
    steps = 0;
  while (run.phase !== "won" && run.phase !== "lost" && steps++ < 400) {
    if (run.phase === "boon") {
      const offered = expeditionBoonChoices(run),
        picked = chooseBoon(run, policy);
      drafts.push({
        room: run.room,
        offered: offered.map((b) => b.id),
        picked,
        gain: expeditionBoonGain(run, picked),
      });
      run = chooseExpeditionBoon(run, picked);
      continue;
    }
    if (run.phase === "route") {
      const offered = expeditionRouteChoices(run),
        picked = chooseRoute(run, policy);
      routes.push({ room: run.room + 1, offered, picked });
      run = chooseExpeditionRoute(run, picked);
      entryHP = run.combat.hp;
      entryTurn = run.totalTurns;
      continue;
    }
    let next = run,
      selected: RuneType | "ability" = "ability",
      best = -Infinity;
    if (policy === "ordinary") {
      // Visible, basic priorities: heal when hurt, use a ready ability, then
      // connect an available long red path; no simulated retaliation/refills.
      const paths = expeditionCandidates(run, 5);
      const priority: RuneType[] =
        run.combat.hp < run.combat.maxHp * 0.55
          ? ["green", "red", "blue", "gold"]
          : ["red", "blue", "gold", "green"];
      const ability = expeditionAbility(run);
      if (ability !== run) next = ability;
      else
        for (const color of priority) {
          const chain = paths
            .filter((p) => run.grid[p[0].r][p[0].c] === color)
            .sort((a, b) => b.length - a.length)[0];
          if (!chain) continue;
          if (color === "blue" && run.combat.mana === 3) continue;
          if (color === "green" && run.combat.hp === run.combat.maxHp) continue;
          next = expeditionChain(run, chain);
          selected = color;
          break;
        }
      if (next === run && paths.length) {
        const chain = [...paths].sort((a, b) => b.length - a.length)[0];
        next = expeditionChain(run, chain);
        selected = run.grid[chain[0].r][chain[0].c];
      }
    } else {
      const ability = expeditionAbility(run);
      if (ability !== run) {
        next = ability;
        best = actionValue(run, ability, policy, 0);
      }
      const paths =
        policy === "legacy" ? legacyCandidates(run) : expeditionCandidates(run);
      for (const chain of paths) {
        const candidate = expeditionChain(run, chain);
        const score = actionValue(run, candidate, policy, chain.length);
        if (score > best) {
          best = score;
          next = candidate;
          selected = run.grid[chain[0].r][chain[0].c];
        }
      }
    }
    if (next === run)
      throw new Error(`No valid action: ${seed}/${cls}/${ascension}/${policy}`);
    actions[selected]++;
    run = next;
    if (run.phase !== "combat")
      rooms.push({
        room: run.room,
        entryHP,
        exitHP: run.combat.hp,
        turns: run.totalTurns - entryTurn,
        cleared: run.phase !== "lost",
      });
  }
  if (steps >= 400)
    throw new Error(`Unbounded Expedition: ${seed}/${cls}/${policy}`);
  return {
    seed,
    class: cls,
    ascension: ascension + 1,
    policy,
    cleared: run.phase === "won",
    roomsCleared: run.roomsCleared,
    turns: run.totalTurns,
    hp: run.combat.hp,
    maxHP: run.combat.maxHp,
    loss: run.phase === "won" ? null : run.combat.hp <= 0 ? "hp" : "moves",
    lossRoom: run.phase === "won" ? null : run.room,
    score: run.score,
    reward: expeditionReward(run.roomsCleared, ascension, run.phase === "won"),
    boons: run.boons,
    phoenixUsed: run.phoenixUsed,
    drafts,
    routes,
    rooms,
    actions,
  };
}
function counts(values: string[]) {
  return values.reduce<Record<string, number>>((all, value) => {
    all[value] = (all[value] ?? 0) + 1;
    return all;
  }, {});
}
function mean(values: number[]) {
  return +(
    values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
  ).toFixed(2);
}
function main() {
  const samples = Math.max(
    1,
    Math.min(
      1000,
      Math.floor(Number(process.env.RUNE_EXP_SAMPLES ?? 12)) || 12,
    ),
  );
  const policies = (
    process.env.RUNE_EXP_POLICIES ?? "smart,ordinary,legacy"
  ).split(",") as ExpeditionPolicy[];
  if (policies.some((p) => !["smart", "ordinary", "legacy"].includes(p)))
    throw new Error("Unknown Expedition policy");
  const ascensions = (process.env.RUNE_EXP_ASCENSIONS ?? "1,4,8")
    .split(",")
    .map(Number);
  if (ascensions.some((a) => !Number.isInteger(a) || a < 1 || a > 8))
    throw new Error("Ascensions must be1–8");
  const raw: ReturnType<typeof simulateExpedition>[] = [];
  for (const policy of policies)
    for (const ascension of ascensions)
      for (const cls of CLASSES) {
        const runs = Array.from({ length: samples }, (_, index) =>
          simulateExpedition(728391 + index * 1777, cls, ascension - 1, policy),
        );
        raw.push(...runs);
        const wins = runs.filter((r) => r.cleared);
        console.log(
          JSON.stringify({
            ascension,
            class: cls,
            policy,
            samples,
            clearRate: +((wins.length / samples) * 100).toFixed(1),
            averageRooms: mean(runs.map((r) => r.roomsCleared)),
            averageTurns: mean(runs.map((r) => r.turns)),
            averageHP: mean(runs.map((r) => r.hp)),
            averageWinnerHPpct: mean(wins.map((r) => (r.hp / r.maxHP) * 100)),
            averageReward: mean(runs.map((r) => r.reward)),
            hpDeaths: runs.filter((r) => r.loss === "hp").length,
            moveDeaths: runs.filter((r) => r.loss === "moves").length,
            failureRooms: counts(
              runs
                .filter((r) => r.lossRoom !== null)
                .map((r) => String(r.lossRoom)),
            ),
            distinctBuilds: new Set(
              runs.map((r) => JSON.stringify(Object.entries(r.boons).sort())),
            ).size,
            boonsOffered: counts(
              runs.flatMap((r) => r.drafts.flatMap((d) => d.offered)),
            ),
            boonsPicked: counts(
              runs.flatMap((r) => r.drafts.map((d) => d.picked)),
            ),
            routesOffered: counts(
              runs.flatMap((r) => r.routes.flatMap((d) => d.offered)),
            ),
            routesPicked: counts(
              runs.flatMap((r) => r.routes.map((d) => d.picked)),
            ),
            survival: Array.from({ length: 6 }, (_, index) => ({
              room: index + 1,
              entered: runs.filter((r) =>
                r.rooms.some((room) => room.room === index + 1),
              ).length,
              cleared: runs.filter((r) => r.roomsCleared >= index + 1).length,
              turns: mean(
                runs.flatMap((r) =>
                  r.rooms
                    .filter((room) => room.room === index + 1)
                    .map((room) => room.turns),
                ),
              ),
            })),
          }),
        );
      }
  if (process.env.RUNE_EXP_RUNS)
    writeFileSync(process.env.RUNE_EXP_RUNS, JSON.stringify(raw));
  console.log(
    JSON.stringify({
      totalRuns: raw.length,
      policies,
      complete: true,
      model:
        "smart:per-start-budget,3–10rune,tactical,class/cap-aware drafts; ordinary:3–5rune visible priorities; legacy:frozen historical global-budget policy; no purchased power",
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
