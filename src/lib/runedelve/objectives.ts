import type { CombatState } from "./combatEngine";
import type { Enemy } from "./dungeonGenerator";
import type { ObjectiveType } from "./levelGenerator";
import { combatObjectiveScore, scoreTargetForEnemies } from "./scoring";

interface ScoreEncounter {
  objective_type: string;
  objective_target: number;
  enemy_config: Array<Pick<Enemy, "hp"> & Partial<Pick<Enemy, "maxHp">>>;
  modifiers?: unknown;
}

/** Old persisted level rows used opening HP/turn points as their score goal.
 * Normalize them at the read boundary; active checkpoints keep all earned
 * damage/kills and no stored progress, result, or level row is rewritten. */
export function normalizeScoreObjectiveTarget(level: ScoreEncounter): number {
  if (level.objective_type !== "reach_score") return level.objective_target;
  const modifiers = level.modifiers as
    | {
        score_objective_version?: number;
        waves?: Array<{ enemies?: ScoreEncounter["enemy_config"] }>;
      }
    | undefined;
  if (
    modifiers?.score_objective_version === 2 &&
    Number.isFinite(level.objective_target) &&
    level.objective_target > 0
  )
    return Math.max(1, Math.round(level.objective_target));
  return scoreTargetForEnemies([
    ...level.enemy_config,
    ...(modifiers?.waves ?? []).flatMap((wave) => wave.enemies ?? []),
  ]);
}

export interface ObjectiveStatus {
  over: boolean;
  cleared: boolean;
}

export interface ObjectiveProgress {
  current: number;
  total: number;
  percent: number;
  text: string;
}

export function isPriorityEnemy(enemy: Enemy): boolean {
  // Splitter copies retain their source tier for artwork/phases, but the
  // authored champion remains the objective and rule owner after a split.
  if (/-echo(?:$|-)/.test(enemy.id) || /^Echo of /.test(enemy.name)) return false;
  return (
    enemy.tier === "boss" ||
    enemy.tier === "mini" ||
    /^(Elite |Boss |Mini-Boss )/.test(enemy.name)
  );
}

export function getPriorityEnemy(enemies: Enemy[]): Enemy | undefined {
  return [...enemies].reverse().find(isPriorityEnemy);
}

/** The single source of truth for campaign objective completion. */
export function evaluateObjective(
  state: CombatState,
  maxTurns: number,
  type: ObjectiveType,
  target: number,
): ObjectiveStatus {
  if (state.hp <= 0) return { over: true, cleared: false };

  if (type === "survive") {
    const requiredTurns = Math.max(1, Math.min(maxTurns, target || maxTurns));
    const turnsSurvived = Math.max(0, maxTurns - state.turnsRemaining);
    if (
      state.enemies.every((enemy) => enemy.hp <= 0) ||
      turnsSurvived >= requiredTurns
    ) {
      return { over: true, cleared: true };
    }
    return { over: state.turnsRemaining <= 0, cleared: false };
  }

  if (type === "reach_score") {
    if (combatObjectiveScore(state) >= Math.max(1, target))
      return { over: true, cleared: true };
    if (
      state.turnsRemaining <= 0 ||
      state.enemies.every((enemy) => enemy.hp <= 0)
    ) {
      return { over: true, cleared: false };
    }
    return { over: false, cleared: false };
  }

  if (type === "defeat_elite") {
    const priority = getPriorityEnemy(state.enemies);
    if (priority?.hp !== undefined && priority.hp <= 0)
      return { over: true, cleared: true };
    // Legacy/custom levels may not have target metadata. Preserve a safe
    // defeat-all fallback so an otherwise valid encounter can still finish.
    if (
      !priority &&
      state.enemies.length > 0 &&
      state.enemies.every((enemy) => enemy.hp <= 0)
    ) {
      return { over: true, cleared: true };
    }
    if (state.turnsRemaining <= 0) return { over: true, cleared: false };
    return { over: false, cleared: false };
  }

  if (state.enemies.every((enemy) => enemy.hp <= 0))
    return { over: true, cleared: true };
  if (state.turnsRemaining <= 0) return { over: true, cleared: false };
  void maxTurns;
  return { over: false, cleared: false };
}

export function getObjectiveProgress(
  state: CombatState,
  maxTurns: number,
  type: ObjectiveType,
  target: number,
): ObjectiveProgress {
  let current = 0;
  let total = 1;
  let text = "";

  if (type === "survive") {
    total = Math.max(1, Math.min(maxTurns, target || maxTurns));
    current = Math.min(total, Math.max(0, maxTurns - state.turnsRemaining));
    const remaining = Math.max(0, total - current);
    text =
      remaining > 0
        ? `${remaining} turn${remaining === 1 ? "" : "s"} to endure`
        : "Survived";
  } else if (type === "reach_score") {
    current = combatObjectiveScore(state);
    total = Math.max(1, target);
    text = `${current.toLocaleString()} / ${total.toLocaleString()}`;
  } else if (type === "defeat_elite") {
    const priority = getPriorityEnemy(state.enemies);
    if (!priority) {
      current = 0;
      total = 1;
      text = "Champion awaits";
    } else {
      total = Math.max(1, priority.maxHp);
      current = Math.min(total, Math.max(0, priority.maxHp - priority.hp));
      text =
        priority.hp > 0
          ? `${Math.max(0, priority.hp)} HP left`
          : "Champion defeated";
    }
  } else {
    total = Math.max(1, state.enemies.length);
    const alive = state.enemies.filter((enemy) => enemy.hp > 0).length;
    current = total - alive;
    text =
      alive > 0
        ? `${alive} foe${alive === 1 ? "" : "s"} remain`
        : "Chamber cleared";
  }

  return {
    current,
    total,
    percent: Math.min(100, Math.max(0, Math.round((current / total) * 100))),
    text,
  };
}
