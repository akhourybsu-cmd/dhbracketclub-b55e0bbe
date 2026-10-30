import type { Enemy } from "./dungeonGenerator";

export interface ScoreInputs {
  totalDamage: number;
  enemiesDefeated: number;
  hpRemaining: number;
  turnsRemaining: number;
  longestChain: number;
  cleared: boolean;
  rogueBonus?: boolean; // applies +15% to total score if rogue triggered a chain ≥ 5
  /** Band 4: secondary objective satisfied — flat +250 line item. */
  secondaryBonus?: boolean;
}

export interface ScoreBreakdown {
  damage: number;
  enemiesPts: number;
  hpPts: number;
  turnsPts: number;
  chainPts: number;
  clearBonus: number;
  rogueBonus: number;
  secondaryBonus: number;
  total: number;
}

export type LiveScoreInputs = Pick<
  ScoreInputs,
  "totalDamage" | "enemiesDefeated" | "turnsRemaining" | "longestChain"
> & { hp?: number; hpRemaining?: number };

/** Score visible while a run is active, before clear/optional bonuses. */
export function liveScore(i: LiveScoreInputs): number {
  const hp = i.hpRemaining ?? i.hp ?? 0;
  return (
    i.totalDamage +
    i.enemiesDefeated * 200 +
    Math.max(0, hp) * 5 +
    Math.max(0, i.turnsRemaining) * 50 +
    i.longestChain * 25
  );
}

/** Combat objectives measure work earned in the encounter, separate from the
 * final-score rewards for surviving healthy and saving turns. */
export function combatObjectiveScore(
  i: Pick<ScoreInputs, "totalDamage" | "enemiesDefeated" | "longestChain">,
): number {
  const damage = Math.max(
    0,
    Number.isFinite(i.totalDamage) ? i.totalDamage : 0,
  );
  if (damage <= 0) return 0;
  const defeats = Math.max(
    0,
    Math.floor(Number.isFinite(i.enemiesDefeated) ? i.enemiesDefeated : 0),
  );
  // A longest-chain bonus can be earned once; repeating resource chains cannot
  // grind unlimited objective progress or win before any combat damage lands.
  const chain = Math.min(
    8,
    Math.max(0, (Number.isFinite(i.longestChain) ? i.longestChain : 0) - 2),
  );
  return Math.round(damage + defeats * 100 + chain * 10);
}

/** Authored from the whole encounter's damage/defeat budget, including waves. */
export function scoreTargetForEnemies(
  enemies: Array<Pick<Enemy, "hp"> & Partial<Pick<Enemy, "maxHp">>>,
): number {
  const budget = enemies.reduce((sum, enemy) => {
    const hp = enemy.maxHp ?? enemy.hp;
    return sum + Math.max(1, Number.isFinite(hp) ? hp : 1) + 100;
  }, 0);
  return Math.max(100, Math.ceil((budget * 0.78) / 5) * 5);
}

export function calculateScore(i: ScoreInputs): ScoreBreakdown {
  const damage = i.totalDamage;
  const enemiesPts = i.enemiesDefeated * 200;
  const hpPts = Math.max(0, i.hpRemaining) * 5;
  const turnsPts = Math.max(0, i.turnsRemaining) * 50;
  const chainPts = i.longestChain * 25;
  const clearBonus = i.cleared ? 500 : 0;
  const secondaryBonus = i.secondaryBonus ? 250 : 0;
  let total =
    damage +
    enemiesPts +
    hpPts +
    turnsPts +
    chainPts +
    clearBonus +
    secondaryBonus;
  // Rogue's signature: long chains turn the whole run into a payout. +15% is
  // the sweet spot — meaningful on its own and synergises with Rogue T1/T5
  // masteries without nuking class balance.
  const rogueBonus = i.rogueBonus ? Math.round(total * 0.15) : 0;
  total += rogueBonus;
  return {
    damage,
    enemiesPts,
    hpPts,
    turnsPts,
    chainPts,
    clearBonus,
    rogueBonus,
    secondaryBonus,
    total,
  };
}

// XP earned scales with score, capped to keep progression gentle.
export function xpForRun(score: number, cleared: boolean): number {
  const base = Math.min(120, Math.floor(score / 30));
  return base + (cleared ? 20 : 0);
}
