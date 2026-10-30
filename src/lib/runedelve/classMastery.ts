// Class Mastery — a 5-tier progression track per hero class. Tiers unlock
// purely from `rune_delve_class_progress.level` (no DB schema change needed)
// and apply gentle, build-defining buffs that reward mastering a class.
//
// Each tier has a stable id (used by masteryEffects.ts at combat time) and
// human-readable name + description for the codex.

import type { HeroClass } from "./classConfig";

export type MasteryId =
  // Warrior
  | "warrior_t1_red_chain"
  | "warrior_t2_chapter_hp"
  | "warrior_t3_cleave_buff"
  | "warrior_t4_panic_shield"
  | "warrior_t5_last_stand"
  // Mage
  | "mage_t1_starting_mana"
  | "mage_t2_blue_heal"
  | "mage_t3_arc_chain"
  | "mage_t4_mana_cap"
  | "mage_t5_overflow"
  // Rogue
  | "rogue_t1_gold_score"
  | "rogue_t2_first_crit"
  | "rogue_t3_shadow_cd"
  | "rogue_t4_chain_crit"
  | "rogue_t5_master_thief"
  // Cleric
  | "cleric_t1_first_heal"
  | "cleric_t2_long_shield"
  | "cleric_t3_sanctuary_buff"
  | "cleric_t4_revive_burst"
  | "cleric_t5_aegis";

export interface MasteryTier {
  id: MasteryId;
  tier: 1 | 2 | 3 | 4 | 5;
  unlockLevel: number;
  name: string;
  /** One-line summary for the codex tile. */
  summary: string;
}

export const MASTERY_UNLOCK_LEVELS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 5,
  2: 15,
  3: 30,
  4: 50,
  5: 75,
};
export const MAGE_OVERFLOW_MANA_INTERVAL = 6;

export const MASTERY_TIERS: Record<HeroClass, MasteryTier[]> = {
  warrior: [
    {
      id: "warrior_t1_red_chain",
      tier: 1,
      unlockLevel: 5,
      name: "Crimson Fervor",
      summary: "+5% damage on all red chains.",
    },
    {
      id: "warrior_t2_chapter_hp",
      tier: 2,
      unlockLevel: 15,
      name: "Iron Constitution",
      summary: "+6 max HP, plus 2 per chapter cleared.",
    },
    {
      id: "warrior_t3_cleave_buff",
      tier: 3,
      unlockLevel: 30,
      name: "Honed Cleave",
      summary: "Cleave hits for 50 damage (was 40).",
    },
    {
      id: "warrior_t4_panic_shield",
      tier: 4,
      unlockLevel: 50,
      name: "Brace",
      summary: "First time HP ≤ 25%: gain a 2-turn shield (1×/run).",
    },
    {
      id: "warrior_t5_last_stand",
      tier: 5,
      unlockLevel: 75,
      name: "Last Stand",
      summary: "Below 20% HP, red chains deal +50% damage.",
    },
  ],
  mage: [
    {
      id: "mage_t1_starting_mana",
      tier: 1,
      unlockLevel: 5,
      name: "Spark of Insight",
      summary: "Start every run with 1 mana already charged.",
    },
    {
      id: "mage_t2_blue_heal",
      tier: 2,
      unlockLevel: 15,
      name: "Arcane Wellspring",
      summary: "Blue chains heal +2 HP each.",
    },
    {
      id: "mage_t3_arc_chain",
      tier: 3,
      unlockLevel: 30,
      name: "Arc Cascade",
      summary: "Arc Burst chains to a 2nd target at 30% damage.",
    },
    {
      id: "mage_t4_mana_cap",
      tier: 4,
      unlockLevel: 50,
      name: "Deep Reserve",
      summary: "Your ability costs 2 mana instead of 3.",
    },
    {
      id: "mage_t5_overflow",
      tier: 5,
      unlockLevel: 75,
      name: "Overflow",
      summary: `Every ${MAGE_OVERFLOW_MANA_INTERVAL} mana spent refunds 1. Free casts do not count.`,
    },
  ],
  rogue: [
    {
      id: "rogue_t1_gold_score",
      tier: 1,
      unlockLevel: 5,
      name: "Gilded Eye",
      summary: "+2 score per gold rune cleared.",
    },
    {
      id: "rogue_t2_first_crit",
      tier: 2,
      unlockLevel: 15,
      name: "Opening Strike",
      summary: "First red chain each run crits (×1.5).",
    },
    {
      id: "rogue_t3_shadow_cd",
      tier: 3,
      unlockLevel: 30,
      name: "Veilcut",
      summary: "Shadowstep interrupts one charged enemy ability.",
    },
    {
      id: "rogue_t4_chain_crit",
      tier: 4,
      unlockLevel: 50,
      name: "Quickblade",
      summary: "10% crit chance on chains of 4+.",
    },
    {
      id: "rogue_t5_master_thief",
      tier: 5,
      unlockLevel: 75,
      name: "Master Thief",
      summary: "+1 shard per chain.",
    },
  ],
  cleric: [
    {
      id: "cleric_t1_first_heal",
      tier: 1,
      unlockLevel: 5,
      name: "Morning Prayer",
      summary: "First two chains each run heal 5 HP.",
    },
    {
      id: "cleric_t2_long_shield",
      tier: 2,
      unlockLevel: 15,
      name: "Steadfast Aegis",
      summary: "Shields you cast last +1 turn.",
    },
    {
      id: "cleric_t3_sanctuary_buff",
      tier: 3,
      unlockLevel: 30,
      name: "Greater Sanctuary",
      summary: "Sanctuary heals 40 (was 30).",
    },
    {
      id: "cleric_t4_revive_burst",
      tier: 4,
      unlockLevel: 50,
      name: "Resurgent Light",
      summary: "On revive (any source), burn adjacent enemies.",
    },
    {
      id: "cleric_t5_aegis",
      tier: 5,
      unlockLevel: 75,
      name: "Eternal Aegis",
      summary: "Once per run, fully block a fatal hit.",
    },
  ],
};

/** Active mastery ids for a class at a given class level. */
export function getActiveMasteries(
  cls: HeroClass,
  classLevel: number,
): MasteryId[] {
  return MASTERY_TIERS[cls]
    .filter((t) => classLevel >= t.unlockLevel)
    .map((t) => t.id);
}

/** Returns the mastery just unlocked when crossing prev → next level (or null). */
export function masteryUnlockedAt(
  cls: HeroClass,
  prevLevel: number,
  nextLevel: number,
): MasteryTier | null {
  if (nextLevel <= prevLevel) return null;
  const newly = MASTERY_TIERS[cls].find(
    (t) => t.unlockLevel > prevLevel && t.unlockLevel <= nextLevel,
  );
  return newly ?? null;
}

/** Next un-earned tier for the codex "next unlock" hint (or null at max). */
export function nextMasteryFor(
  cls: HeroClass,
  classLevel: number,
): MasteryTier | null {
  return MASTERY_TIERS[cls].find((t) => classLevel < t.unlockLevel) ?? null;
}
