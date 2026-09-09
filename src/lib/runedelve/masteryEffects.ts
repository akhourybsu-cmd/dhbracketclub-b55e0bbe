// Combat-side helpers for the Class Mastery system. These are designed to be
// pure functions so they can be called inline from the combat loop without
// any extra state plumbing — every helper takes (activeMasteries, ...args).
//
// Pairs with classMastery.ts (data) and is consumed by RuneDelvePlayPage.tsx
// (combat hooks) when the player has the matching tier unlocked.

import type { MasteryId } from './classMastery';
import type { RuneType } from './dungeonGenerator';

/** Starting mana bonus (Mage T1). */
export function getMasteryStartingMana(active: MasteryId[]): number {
  return active.includes('mage_t1_starting_mana') ? 1 : 0;
}

/**
 * Mana cost to fire the class ability (Mage T4 "Deep Reserve" drops it 3 → 2).
 * Previously this tier tried to raise a mana CAP that the engine hard-locks at
 * MAX_MANA = 3, so it was a complete no-op. Repurposed to a genuine efficiency
 * payoff: the Mage casts at 2 orbs instead of 3.
 */
export function getMasteryAbilityManaCost(active: MasteryId[], baseCost: number): number {
  return active.includes('mage_t4_mana_cap') ? Math.max(1, baseCost - 1) : baseCost;
}

/** Per-chapter HP bonus (Warrior T2). Caller multiplies by chapters cleared. */
export function getMasteryHpPerChapter(active: MasteryId[]): number {
  return active.includes('warrior_t2_chapter_hp') ? 1 : 0;
}

/** Damage multiplier for chains of a given color (called per chain). */
export function getMasteryChainDamageMult(active: MasteryId[], runeType: RuneType): number {
  let mult = 1;
  if (runeType === 'red' && active.includes('warrior_t1_red_chain')) mult *= 1.05;
  return mult;
}

/** True if the player should deal +50% damage right now (Warrior T5, low HP). */
export function isLastStandActive(active: MasteryId[], hp: number, maxHp: number): boolean {
  if (!active.includes('warrior_t5_last_stand')) return false;
  return maxHp > 0 && hp / maxHp < 0.2;
}

/** Bonus heal from a blue chain (Mage T2). */
export function getMasteryBlueChainHeal(active: MasteryId[]): number {
  return active.includes('mage_t2_blue_heal') ? 2 : 0;
}

/** Bonus score per gold rune cleared (Rogue T1). */
export function getMasteryGoldScoreBonus(active: MasteryId[], goldCleared: number): number {
  return active.includes('rogue_t1_gold_score') ? 2 * goldCleared : 0;
}

/** First-chain-of-fight crit multiplier (Rogue T2). */
export function getMasteryOpeningCritMult(active: MasteryId[], chainsThisFight: number): number {
  if (!active.includes('rogue_t2_first_crit')) return 1;
  return chainsThisFight === 0 ? 1.5 : 1;
}

/** Chain-of-4+ crit chance (Rogue T4) — caller rolls. */
export function getMasteryChainCritChance(active: MasteryId[], chainLength: number): number {
  if (!active.includes('rogue_t4_chain_crit')) return 0;
  return chainLength >= 4 ? 0.10 : 0;
}

/** Bonus shards per chain (Rogue T5). */
export function getMasteryShardsPerChain(active: MasteryId[]): number {
  return active.includes('rogue_t5_master_thief') ? 1 : 0;
}

/** Cleave damage override (Warrior T3). Returns null when not unlocked. */
export function getMasteryCleaveDamage(active: MasteryId[]): number | null {
  return active.includes('warrior_t3_cleave_buff') ? 50 : null;
}

/** Sanctuary heal override (Cleric T3). Returns null when not unlocked. */
export function getMasterySanctuaryHeal(active: MasteryId[]): number | null {
  return active.includes('cleric_t3_sanctuary_buff') ? 40 : null;
}

/** Bonus shield duration (Cleric T2). */
export function getMasteryShieldBonus(active: MasteryId[]): number {
  return active.includes('cleric_t2_long_shield') ? 1 : 0;
}

/** First-chain-of-fight heal (Cleric T1). */
export function getMasteryOpeningHeal(active: MasteryId[], chainsThisFight: number): number {
  if (!active.includes('cleric_t1_first_heal')) return 0;
  return chainsThisFight === 0 ? 5 : 0;
}

/** Arc Burst chain bonus (Mage T3) — fraction of dmg dealt to a 2nd target. */
export function getMasteryArcChainFraction(active: MasteryId[]): number {
  return active.includes('mage_t3_arc_chain') ? 0.30 : 0;
}

/** Once-per-run fatal-hit block (Cleric T5). */
export function hasMasteryAegis(active: MasteryId[]): boolean {
  return active.includes('cleric_t5_aegis');
}

/** Once-per-run panic shield trigger (Warrior T4). */
export function hasMasteryPanicShield(active: MasteryId[]): boolean {
  return active.includes('warrior_t4_panic_shield');
}

/** Mana refund cadence (Mage T5). Returns true if THIS spend should refund. */
export function shouldMasteryRefundMana(active: MasteryId[], totalManaSpent: number): boolean {
  if (!active.includes('mage_t5_overflow')) return false;
  return totalManaSpent > 0 && totalManaSpent % 4 === 0;
}

/** Shadowstep clears a cooldown (Rogue T3). */
export function shadowstepClearsCooldown(active: MasteryId[]): boolean {
  return active.includes('rogue_t3_shadow_cd');
}

/** Revive triggers an adjacent burst (Cleric T4). */
export function reviveBurstActive(active: MasteryId[]): boolean {
  return active.includes('cleric_t4_revive_burst');
}
