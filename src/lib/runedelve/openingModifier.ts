import { MAX_MANA, type CombatState } from "./combatEngine";
import { resolveEffect, type RunModifier } from "./runModifiers";

/** Apply the chosen chamber bargain once, before the first playable action. */
export function applyOpeningModifier(
  state: CombatState,
  modifier: RunModifier | null,
): CombatState {
  const effect = resolveEffect(modifier);
  const maxHp = Math.max(10, Math.round(state.maxHp * effect.hpMult));
  return {
    ...state,
    maxHp,
    hp: Math.min(maxHp, Math.round(state.hp * effect.hpMult)),
    mana: Math.min(MAX_MANA, state.mana + effect.manaStart),
    turnsRemaining: Math.max(3, state.turnsRemaining + effect.turnDelta),
  };
}
