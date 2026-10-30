import { RUNE_TYPES, type RuneType } from "./dungeonGenerator";
import {
  campaignPowerMultiplier,
  damageEnemies,
  MAX_MANA,
  type CombatState,
} from "./combatEngine";
import type { BossRuleId } from "./bossRules";

export interface ResonanceBurst {
  damageDealt: number;
  enemyKills: string[];
  manaGained: number;
  guardGained: number;
}

/** Old snapshots naturally resume with an empty ring. Duplicate/unknown sigils cannot accelerate it. */
export function getResonanceColors(
  state: Pick<CombatState, "resonance">,
): RuneType[] {
  return [
    ...new Set(
      (state.resonance?.colors ?? []).filter((color) =>
        RUNE_TYPES.includes(color),
      ),
    ),
  ].slice(0, 3);
}

export function resonanceWillBurst(
  state: Pick<CombatState, "resonance">,
  rune: RuneType,
): boolean {
  const colors = getResonanceColors(state);
  return colors.length === 3 && !colors.includes(rune);
}

/**
 * Every four distinct rune colors release one Convergence. Resolve AFTER
 * chain/relic effects, before enemies act, so damage multipliers never
 * accidentally amplify the separate area burst. Repeats keep earned sigils.
 */
export function advanceResonance(
  state: CombatState,
  rune: RuneType,
  level = 1,
  bossRule: BossRuleId | null = null,
): { next: CombatState; burst: ResonanceBurst | null } {
  if (state.hp <= 0) return { next: state, burst: null };
  const colors = getResonanceColors(state);
  if (colors.includes(rune)) return { next: state, burst: null };
  const previousBursts = Math.max(0, Math.floor(state.resonance?.bursts ?? 0));
  const filled = [...colors, rune];
  if (filled.length < 4) {
    return {
      next: { ...state, resonance: { colors: filled, bursts: previousBursts } },
      burst: null,
    };
  }
  const impact = damageEnemies(
    state,
    Math.round(20 * campaignPowerMultiplier(level)),
    bossRule,
  );
  const next: CombatState = {
    ...impact.next,
    resonance: { colors: [], bursts: previousBursts + 1 },
  };
  const burst: ResonanceBurst = {
    damageDealt: impact.damageDealt,
    enemyKills: impact.enemyKills,
    manaGained: 0,
    guardGained: 1,
  };
  const beforeMana = next.mana;
  next.mana = Math.min(MAX_MANA, next.mana + 1);
  burst.manaGained = next.mana - beforeMana;
  next.shieldTurns += 1;
  return { next, burst };
}
