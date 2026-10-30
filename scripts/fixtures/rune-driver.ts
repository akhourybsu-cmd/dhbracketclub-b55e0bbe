// Read-only action planner for browser QA. The runner clicks production controls;
// this module never writes a checkpoint, changes an encounter or grants power.
import {
  applyChain,
  chainTier,
  useAbility as castAbility,
  type CombatState,
} from "../../src/lib/runedelve/combatEngine";
import { advanceResonance } from "../../src/lib/runedelve/resonance";
import { generateLevel } from "../../src/lib/runedelve/levelGenerator";
import {
  expeditionAbility,
  expeditionChain,
  type ExpeditionRun,
} from "../../src/lib/runedelve/expedition";
import type { HeroClass } from "../../src/lib/runedelve/classConfig";
import type { RuneType } from "../../src/lib/runedelve/dungeonGenerator";
import type { Cell } from "../../src/lib/runedelve/boardEngine";
import type { RunSnapshot } from "../../src/lib/runedelve/runSnapshot";

export type QaAction = { kind: "chain"; cells: Cell[] } | { kind: "ability" };

function candidates(
  grid: RuneType[][],
  blocked: string[] = [],
  eclipsed: string[] = [],
): Cell[][] {
  const sealed = new Set(blocked),
    noStart = new Set(eclipsed);
  const best: Partial<Record<RuneType, Cell[][]>> = {};
  // Separate budgets keep one large component from starving other colors.
  for (const type of ["red", "blue", "green", "gold"] as const) {
    let budget = 3500;
    function visit(path: Cell[], seen: Set<string>) {
      if (--budget < 0) return;
      const last = path[path.length - 1];
      if (path.length >= 3) {
        const previous = best[type] ?? [];
        if (!previous.length || path.length > previous[0].length)
          best[type] = [path];
        else if (path.length === previous[0].length && previous.length < 3)
          best[type] = [...previous, path];
      }
      if (path.length >= 8) return;
      for (let r = Math.max(0, last.r - 1); r <= Math.min(4, last.r + 1); r++) {
        for (
          let c = Math.max(0, last.c - 1);
          c <= Math.min(4, last.c + 1);
          c++
        ) {
          const key = `${r}-${c}`;
          if (!seen.has(key) && !sealed.has(key) && grid[r][c] === type) {
            visit([...path, { r, c }], new Set([...seen, key]));
          }
        }
      }
    }
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++) {
        const key = `${r}-${c}`;
        if (grid[r][c] === type && !sealed.has(key) && !noStart.has(key))
          visit([{ r, c }], new Set([key]));
      }
  }
  return Object.values(best).flat();
}

function utility(before: CombatState, after: CombatState) {
  const alive = before.enemies.filter((enemy) => enemy.hp > 0).length;
  const missingHealth = before.maxHp - before.hp;
  return (
    after.totalDamage -
    before.totalDamage +
    (after.hp - before.hp) * (missingHealth > 40 ? 1.7 : 0.8) +
    (after.mana - before.mana) * 23 +
    Math.max(0, after.shieldTurns - before.shieldTurns) * (alive * 4) +
    (after.enemiesDefeated - before.enemiesDefeated) * 22 +
    (after.shadowstepActive && !before.shadowstepActive ? 40 : 0)
  );
}

export function campaignAction(
  snapshot: RunSnapshot,
  cls: HeroClass,
  policy = "win",
): QaAction {
  const level = generateLevel(snapshot.levelNumber);
  const bossRule = level.modifiers?.boss_rule ?? null;
  const paths = candidates(
    snapshot.grid,
    snapshot.seals,
    snapshot.eclipsedCells,
  );
  if (!paths.length)
    throw new Error(`No playable chain in campaign ${snapshot.levelNumber}`);
  if (policy !== "win") {
    const score = (path: Cell[]) => {
      const type = snapshot.grid[path[0].r][path[0].c];
      if (policy === "timeout")
        return (
          (type === "green"
            ? snapshot.combat.hp < 80
              ? 500
              : 300
            : type === "blue"
              ? 400
              : type === "gold"
                ? -100
                : -1000) - path.length
        );
      return (
        (type === "blue"
          ? 500
          : type === "gold"
            ? 100
            : type === "green"
              ? -100
              : -500) - path.length
      );
    };
    const path = [...paths].sort((a, b) => score(b) - score(a))[0];
    return { kind: "chain", cells: path.slice(0, 3) };
  }
  if (snapshot.combat.mana >= 3) {
    const ability = castAbility(
      snapshot.combat,
      cls,
      bossRule,
      [],
      snapshot.levelNumber,
    );
    if (ability.ok) return { kind: "ability" };
  }
  const value = (path: Cell[]) => {
    const type = snapshot.grid[path[0].r][path[0].c];
    const { next } = applyChain(
      snapshot.combat,
      type,
      path.length,
      cls,
      bossRule,
      5,
      snapshot.levelNumber,
      { tierMultiplier: chainTier(path.length).damageMultiplier },
    );
    const after = advanceResonance(
      next,
      type,
      snapshot.levelNumber,
      bossRule,
    ).next;
    return (
      utility(snapshot.combat, after) +
      (path.length >= 7 && !snapshot.bonusUsedThisCycle ? 20 : 0)
    );
  };
  return {
    kind: "chain",
    cells: [...paths].sort((a, b) => value(b) - value(a))[0],
  };
}

export function expeditionAction(run: ExpeditionRun, policy = "win"): QaAction {
  const paths = candidates(run.grid);
  if (!paths.length)
    throw new Error(`No playable Expedition chain in room ${run.room}`);
  if (policy !== "win") {
    const rank = (path: Cell[]) => {
      const type = run.grid[path[0].r][path[0].c];
      return (
        (type === "blue"
          ? 100
          : type === "gold"
            ? 25
            : type === "green"
              ? -50
              : -100) - path.length
      );
    };
    return {
      kind: "chain",
      cells: [...paths].sort((a, b) => rank(b) - rank(a))[0].slice(0, 3),
    };
  }
  const value = (after: ExpeditionRun) => {
    if (after === run) return -1e6;
    if (after.phase === "lost") return -1e5;
    // Spending mana is free: count the damage without charging for that spend.
    return (
      utility(run.combat, after.combat) +
      Math.max(0, run.combat.mana - after.combat.mana) * 23 +
      (after.phase === "boon" || after.phase === "won" ? 1000 : 0)
    );
  };
  let action: QaAction = { kind: "ability" },
    score = value(expeditionAbility(run));
  for (const cells of paths) {
    const candidateScore = value(expeditionChain(run, cells));
    if (candidateScore > score) {
      action = { kind: "chain", cells };
      score = candidateScore;
    }
  }
  return action;
}

export function expeditionDraft(
  run: ExpeditionRun,
  kind: "boon" | "route",
  choices: string[],
): string {
  const weights: Record<string, number> =
    kind === "boon"
      ? {
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
        }
      : {
          crypt: 70,
          hunt: run.combat.hp > 70 ? 55 : 15,
          vault: 30,
          shrine: run.combat.hp < 80 ? 90 : 45,
        };
  return [...choices].sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0))[0];
}
