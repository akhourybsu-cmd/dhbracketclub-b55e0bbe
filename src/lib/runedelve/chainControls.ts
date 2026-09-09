import { cellKey, isAdjacent, type Cell } from './boardEngine';
import type { RuneType } from './dungeonGenerator';

export type ChainStepReason =
  | 'sealed'
  | 'eclipsed-start'
  | 'already-selected'
  | 'not-adjacent'
  | 'wrong-rune';

export interface ChainStepResult {
  chain: Cell[];
  changed: boolean;
  reason?: ChainStepReason;
}

/**
 * Advance a chain by one cell for either drag or tap controls.
 * Keeping this pure makes every input method obey exactly the same rules.
 */
export function advanceChainSelection(
  grid: RuneType[][],
  current: Cell[],
  target: Cell,
  seals?: Set<string>,
  eclipsedCells?: Set<string>,
): ChainStepResult {
  const key = cellKey(target);
  if (seals?.has(key)) return { chain: current, changed: false, reason: 'sealed' };

  if (current.length === 0) {
    if (eclipsedCells?.has(key)) {
      return { chain: current, changed: false, reason: 'eclipsed-start' };
    }
    return { chain: [target], changed: true };
  }

  if (current.length >= 2 && cellKey(current[current.length - 2]) === key) {
    return { chain: current.slice(0, -1), changed: true };
  }
  if (current.some(cell => cellKey(cell) === key)) {
    return { chain: current, changed: false, reason: 'already-selected' };
  }

  const last = current[current.length - 1];
  if (!isAdjacent(last, target)) {
    return { chain: current, changed: false, reason: 'not-adjacent' };
  }
  const startType = grid[current[0].r]?.[current[0].c];
  if (grid[target.r]?.[target.c] !== startType) {
    return { chain: current, changed: false, reason: 'wrong-rune' };
  }
  return { chain: [...current, target], changed: true };
}
