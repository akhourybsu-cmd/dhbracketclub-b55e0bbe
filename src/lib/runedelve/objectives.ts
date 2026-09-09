import type { CombatState } from './combatEngine';
import type { Enemy } from './dungeonGenerator';
import type { ObjectiveType } from './levelGenerator';
import { liveScore } from './scoring';

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
  return enemy.tier === 'boss'
    || enemy.tier === 'mini'
    || /^(Elite |Boss |Mini-Boss )/.test(enemy.name);
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

  if (type === 'survive') {
    const requiredTurns = Math.max(1, target || maxTurns);
    const turnsSurvived = Math.max(0, maxTurns - state.turnsRemaining);
    if (state.enemies.every(enemy => enemy.hp <= 0) || turnsSurvived >= requiredTurns) {
      return { over: true, cleared: true };
    }
    return { over: false, cleared: false };
  }

  if (type === 'reach_score') {
    if (liveScore(state) >= target) return { over: true, cleared: true };
    if (state.turnsRemaining <= 0 || state.enemies.every(enemy => enemy.hp <= 0)) {
      return { over: true, cleared: false };
    }
    return { over: false, cleared: false };
  }

  if (type === 'defeat_elite') {
    const priority = getPriorityEnemy(state.enemies);
    if (priority?.hp !== undefined && priority.hp <= 0) return { over: true, cleared: true };
    // Legacy/custom levels may not have target metadata. Preserve a safe
    // defeat-all fallback so an otherwise valid encounter can still finish.
    if (!priority && state.enemies.length > 0 && state.enemies.every(enemy => enemy.hp <= 0)) {
      return { over: true, cleared: true };
    }
    if (state.turnsRemaining <= 0) return { over: true, cleared: false };
    return { over: false, cleared: false };
  }

  if (state.enemies.every(enemy => enemy.hp <= 0)) return { over: true, cleared: true };
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
  let text = '';

  if (type === 'survive') {
    total = Math.max(1, target || maxTurns);
    current = Math.min(total, Math.max(0, maxTurns - state.turnsRemaining));
    const remaining = Math.max(0, total - current);
    text = remaining > 0
      ? `${remaining} turn${remaining === 1 ? '' : 's'} to endure`
      : 'Survived';
  } else if (type === 'reach_score') {
    current = liveScore(state);
    total = Math.max(1, target);
    text = `${current.toLocaleString()} / ${total.toLocaleString()}`;
  } else if (type === 'defeat_elite') {
    const priority = getPriorityEnemy(state.enemies);
    if (!priority) {
      current = 0;
      total = 1;
      text = 'Champion awaits';
    } else {
      total = Math.max(1, priority.maxHp);
      current = Math.min(total, Math.max(0, priority.maxHp - priority.hp));
      text = priority.hp > 0 ? `${Math.max(0, priority.hp)} HP left` : 'Champion defeated';
    }
  } else {
    total = Math.max(1, state.enemies.length);
    const alive = state.enemies.filter(enemy => enemy.hp > 0).length;
    current = total - alive;
    text = alive > 0 ? `${alive} foe${alive === 1 ? '' : 's'} remain` : 'Chamber cleared';
  }

  return {
    current,
    total,
    percent: Math.min(100, Math.max(0, Math.round((current / total) * 100))),
    text,
  };
}
