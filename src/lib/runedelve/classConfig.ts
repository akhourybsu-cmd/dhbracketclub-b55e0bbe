export type HeroClass = 'warrior' | 'mage' | 'rogue' | 'cleric';

export interface ClassDef {
  id: HeroClass;
  name: string;
  emoji: string;
  color: string; // tailwind class fragment for accents
  passive: string;
  abilityName: string;
  abilityDesc: string;
  abilityCost: number; // mana orbs needed
}

export const CLASS_LIST: ClassDef[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    emoji: '⚔️',
    color: 'destructive',
    passive: 'Red chains deal +30% damage',
    abilityName: 'Cleave',
    abilityDesc: 'Damage all enemies (40 dmg)',
    abilityCost: 3,
  },
  {
    id: 'mage',
    name: 'Mage',
    emoji: '🔮',
    color: 'accent',
    passive: 'Blue chains charge +1 mana orb',
    abilityName: 'Arc Burst',
    abilityDesc: 'Heavy single-target (80 dmg)',
    abilityCost: 3,
  },
  {
    id: 'rogue',
    name: 'Rogue',
    emoji: '🗡️',
    color: 'gold',
    passive: 'Red chains of 5+ deal +15% damage; any 5+ chain grants +15% run score',
    abilityName: 'Shadowstep',
    abilityDesc: 'Next attack: +100% dmg & score',
    abilityCost: 3,
  },
  {
    id: 'cleric',
    name: 'Cleric',
    emoji: '✨',
    color: 'success',
    passive: 'Green chains heal +50%',
    abilityName: 'Sanctuary',
    abilityDesc: 'Heal 30 + 2-turn shield',
    abilityCost: 3,
  },
];

export function getClass(id: HeroClass): ClassDef {
  return CLASS_LIST.find(c => c.id === id) ?? CLASS_LIST[0];
}

// XP curve — gentle, cosmetic only.
export function xpForLevel(level: number): number {
  return 100 + (level - 1) * 50;
}

export function levelFromXp(totalXp: number): { level: number; intoLevel: number; needed: number } {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
    if (level > 99) break;
  }
  return { level, intoLevel: remaining, needed: xpForLevel(level) };
}

// ─── Class-specific cosmetic title ladders ────────────────────────────────
// Titles are PRESTIGE ONLY. They never affect combat, scoring, or fairness.
// Unlock at milestone levels: 1, 10, 20, 30, … 150.

export const TITLE_MILESTONES = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150] as const;

const TITLE_LADDERS: Record<HeroClass, string[]> = {
  warrior: [
    'Squire of Steel', 'Rune Sellsword', 'Iron Delver', 'Crypt Vanguard',
    'Shieldbearer', 'Vaultbreaker', 'Warden of Stone', 'Crimson Bastion',
    'Relic Guardian', 'Runeblade Captain', 'Mythic Warlord', 'Deepforge Sentinel',
    'Titan of the Vault', 'Doomgate Marshal', 'Ember Crown', 'Eternal Warforged',
  ],
  mage: [
    'Candle Adept', 'Rune Scholar', 'Arcane Delver', 'Sigil Weaver',
    'Vault Magus', 'Crystal Sage', 'Spellwarden', 'Astral Channeler',
    'Relic Arcanist', 'Keeper of Sigils', 'Mythic Sorcerer', 'Starvault Seer',
    'Archon of Runes', 'Eclipse Magister', 'Voidglass Oracle', 'Eternal Archsage',
  ],
  rogue: [
    'Alley Cutpurse', 'Shadow Initiate', 'Rune Stalker', 'Crypt Skirmisher',
    'Silent Fang', 'Vault Runner', 'Nightblade', 'Relic Thief',
    'Veilstrider', 'Master of Locks', 'Mythic Shade', 'Deep Crypt Phantom',
    'Dagger Sovereign', 'Eclipse Stalker', 'Whisper King', 'Eternal Shadow',
  ],
  cleric: [
    'Shrine Acolyte', 'Lightbearer', 'Rune Healer', 'Crypt Warden',
    'Sanctum Keeper', 'Vault Priest', 'Soul Mendicant', 'Dawn Channeler',
    'Relic Shepherd', 'Guardian of Grace', 'Mythic Hierophant', 'Deep Chapel Saint',
    'Luminary of Runes', 'Eclipse Vicar', 'Halo Sovereign', 'Eternal Beacon',
  ],
};

/** Highest milestone index unlocked at this level, or -1 if none. */
function milestoneIndex(level: number): number {
  let idx = -1;
  for (let i = 0; i < TITLE_MILESTONES.length; i += 1) {
    if (level >= TITLE_MILESTONES[i]) idx = i;
    else break;
  }
  return idx;
}

/** Class-specific title for a hero at a given level. */
export function titleForLevel(level: number, cls: HeroClass = 'warrior'): string | null {
  const idx = milestoneIndex(level);
  if (idx < 0) return null;
  return TITLE_LADDERS[cls][idx] ?? null;
}

/** Full ladder for a class (UI: hero profile title list). */
export function titleLadderFor(cls: HeroClass): { level: number; title: string }[] {
  return TITLE_MILESTONES.map((lvl, i) => ({ level: lvl, title: TITLE_LADDERS[cls][i] }));
}

/** Returns the newly-unlocked title if leveling up crossed a milestone — else null. */
export function newTitleUnlocked(
  cls: HeroClass,
  prevLevel: number,
  nextLevel: number,
): { previous: string | null; next: string } | null {
  if (nextLevel <= prevLevel) return null;
  const prevIdx = milestoneIndex(prevLevel);
  const nextIdx = milestoneIndex(nextLevel);
  if (nextIdx > prevIdx) {
    return {
      previous: prevIdx >= 0 ? TITLE_LADDERS[cls][prevIdx] : null,
      next: TITLE_LADDERS[cls][nextIdx],
    };
  }
  return null;
}
