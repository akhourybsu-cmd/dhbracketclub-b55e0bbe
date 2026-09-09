// Layered Goals — Band 4 (levels 101-125).
//
// Levels with this mechanic carry a SECONDARY objective in addition to their
// primary one. The primary clears the chamber; the secondary is an optional
// score + shard bonus. We keep bonus goals small and orthogonal to the primary:
//
// • `min_hp`        — finish with at least N HP remaining (encourages defence)
// • `min_chain`     — make a chain of length ≥ N at least once
// • `max_turns`     — finish in ≤ N turns (tighter speed bonus)
//
// We deliberately avoid combining with primary `survive` / `reach_score`
// objectives (the level generator handles that gating).

import { mulberry32, rngInt } from './prng';
import type { CombatState } from './combatEngine';

export type SecondaryObjectiveType = 'min_hp' | 'min_chain' | 'max_turns';

export interface SecondaryObjective {
  type: SecondaryObjectiveType;
  target: number;
}

export function rollSecondaryObjective(seed: number, level: number, turnLimit: number): SecondaryObjective {
  const rng = mulberry32(seed ^ 0x4a4a);
  const pick = rngInt(rng, 3);
  if (pick === 0) {
    // min_hp: scales gently with level so deep levels demand stronger defence.
    const target = level >= 115 ? 35 : 25;
    return { type: 'min_hp', target };
  }
  if (pick === 1) {
    return { type: 'min_chain', target: level >= 115 ? 5 : 4 };
  }
  // max_turns: trims 2-3 turns off the budget.
  return { type: 'max_turns', target: Math.max(4, turnLimit - 3) };
}

export function secondaryLabel(o: SecondaryObjective): string {
  switch (o.type) {
    case 'min_hp':    return `Finish with ≥ ${o.target} HP`;
    case 'min_chain': return `Land a ${o.target}+ rune chain`;
    case 'max_turns': return `Clear in ≤ ${o.target} turns`;
  }
}

export function secondaryShort(o: SecondaryObjective): string {
  switch (o.type) {
    case 'min_hp':    return `${o.target} HP`;
    case 'min_chain': return `${o.target}+ chain`;
    case 'max_turns': return `${o.target} turns`;
  }
}

/**
 * Did the player satisfy the secondary objective?
 * `turnLimit` is the level's original turn budget — used to compute turns
 * USED from `turnsRemaining`.
 */
export function secondaryMet(
  o: SecondaryObjective,
  state: CombatState,
  turnLimit: number,
): boolean {
  if (o.type === 'min_hp')    return state.hp >= o.target;
  if (o.type === 'min_chain') return state.longestChain >= o.target;
  /* max_turns */
  const used = turnLimit - state.turnsRemaining;
  return used <= o.target;
}
