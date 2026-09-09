// Mechanic registry — single source of truth for every mechanic family in the
// Rune Delve campaign. Each mechanic has a stable id, a compact icon, a short
// label, and a one-line rule that's safe to render on a small phone screen.
//
// Mechanics are introduced in level bands and become part of the
// deterministic level definition (see levelGenerator.ts).
//
// V2 (post-L31 freshness pass): we tightened the cadence to insert three new
// "board variety" mechanics into the L31-75 dead zone (Shifting / Linked /
// Eclipse) and shifted the threat/hazard bands later so the campaign keeps a
// steady drip of new ideas through L100.

export type MechanicId =
  | 'sealed_tiles'
  | 'shifting_runes'
  | 'linked_pairs'
  | 'eclipse_tiles'
  | 'telegraphed_attacks'
  | 'corrupted_tiles'
  | 'multi_objective'
  | 'boss_modifier'
  | 'thorns';

export interface MechanicDef {
  id: MechanicId;
  name: string;
  /** Short, single-word group label shown on chips. */
  family: string;
  /** Single emoji works well at any size and avoids extra icon assets. */
  icon: string;
  /** One-line rule. Keep it under ~80 chars so it never wraps awkwardly. */
  oneLiner: string;
  /** Actionable coaching shown the first time the rule appears. */
  tip: string;
  /** First level (inclusive) where this mechanic is taught. */
  introLevel: number;
  /** Last level (inclusive) of the band that introduces it. */
  bandEnd: number;
}

export const MECHANICS: Record<MechanicId, MechanicDef> = {
  sealed_tiles: {
    id: 'sealed_tiles',
    name: 'Sealed Runes',
    family: 'Board',
    icon: '🔒',
    oneLiner: 'Sealed runes can\'t be chained. Match a rune next to a seal to break it.',
    tip: 'Break an edge seal first so the center of the board stays easy to route.',
    introLevel: 26,
    bandEnd: 35,
  },
  shifting_runes: {
    id: 'shifting_runes',
    name: 'Shifting Runes',
    family: 'Board',
    icon: '🌬️',
    oneLiner: 'One column drifts down by 1 each turn. Plan around the slide.',
    tip: 'Finish valuable chains before ending a turn beside the marked column.',
    introLevel: 36,
    bandEnd: 45,
  },
  linked_pairs: {
    id: 'linked_pairs',
    name: 'Linked Pairs',
    family: 'Board',
    icon: '🔗',
    oneLiner: 'Some runes are linked. Match one — its twin clears too.',
    tip: 'A linked twin is free value; include either marked rune when it helps your route.',
    introLevel: 46,
    bandEnd: 55,
  },
  eclipse_tiles: {
    id: 'eclipse_tiles',
    name: 'Eclipse Tiles',
    family: 'Board',
    icon: '🌑',
    oneLiner: 'Dimmed runes can\'t START a chain but extend one normally.',
    tip: 'Begin on a bright rune, then route through dim runes after the chain is active.',
    introLevel: 56,
    bandEnd: 65,
  },
  telegraphed_attacks: {
    id: 'telegraphed_attacks',
    name: 'Telegraphed Attacks',
    family: 'Threat',
    icon: '⚠️',
    oneLiner: 'A ⚡ counter ticks down each turn. At 1, strike or Guard before it lands.',
    tip: 'The ▶ marker shows your Attack target; focus a foe at ⚡1 or raise a Gold guard.',
    introLevel: 66,
    bandEnd: 80,
  },
  corrupted_tiles: {
    id: 'corrupted_tiles',
    name: 'Corrupted Tiles',
    family: 'Hazard',
    icon: '☠️',
    oneLiner: 'Corruption spreads each turn; chaining it costs HP. Clear ☠ sources first.',
    tip: 'Route through the ☠ source when healthy. Ordinary corruption stops spreading once every source is gone.',
    introLevel: 81,
    bandEnd: 100,
  },
  multi_objective: {
    id: 'multi_objective',
    name: 'Layered Goals',
    family: 'Quest',
    icon: '🎯',
    oneLiner: 'Clear the main goal to win. The Bonus goal pays extra score and shards.',
    tip: 'Treat Bonus as a risk/reward choice—skip it whenever it would endanger the clear.',
    introLevel: 101,
    bandEnd: 125,
  },
  boss_modifier: {
    id: 'boss_modifier',
    name: 'Boss Rule',
    family: 'Boss',
    icon: '👑',
    oneLiner: 'Boss chambers show one special rule above the fight. That rule is mandatory.',
    tip: 'Read the red Boss Rule banner before your first chain; there are no hidden boss rules.',
    introLevel: 126,
    bandEnd: 150,
  },
  thorns: {
    id: 'thorns',
    name: 'Shield Thorns',
    family: 'Defense',
    icon: '🌵',
    oneLiner: 'Your shield reflects part of every hit back at the attacker.',
    tip: 'Use Gold before a heavy enemy turn to reduce damage and return some of it.',
    // Always-on once unlocked — surfaced via gameplay (first time you take a
    // shielded hit) rather than a level band, so introLevel/bandEnd are 1/150.
    introLevel: 1,
    bandEnd: 150,
  },
};

// Order matters — bands are processed in this order to determine which one a
// level "lives in" (the last band whose introLevel ≤ level).
export const MECHANIC_LIST: MechanicDef[] = [
  MECHANICS.sealed_tiles,
  MECHANICS.shifting_runes,
  MECHANICS.linked_pairs,
  MECHANICS.eclipse_tiles,
  MECHANICS.telegraphed_attacks,
  MECHANICS.corrupted_tiles,
  MECHANICS.multi_objective,
];

export function getMechanic(id: MechanicId): MechanicDef {
  return MECHANICS[id];
}

// Which mechanic, if any, is being introduced AT this exact level number.
// Returns the mechanic only on the very first level of the band — used to
// decide when to show the one-time intro modal.
export function introMechanicForLevel(level: number): MechanicId | null {
  const m = MECHANIC_LIST.find(m => m.introLevel === level);
  return m?.id ?? null;
}

/**
 * Focus encounters already ask the player to track a special victory rule or
 * a boss. They teach/remix only one campaign mechanic so challenge never
 * turns into a wall of simultaneous instructions.
 */
function isFocusedEncounter(level: number): boolean {
  const bossBeat = level % 10 === 0 || level % 25 === 0;
  const surviveBeat = level >= 15 && level % 13 === 0;
  const scoreBeat = level >= 30 && level % 17 === 0;
  return bossBeat || surviveBeat || scoreBeat;
}

// Every mechanic that should be active on a given level number.
// Combine rule (mobile-first readability):
//   • The mechanic of the level's CURRENT band is always active (the "primary").
//   • The first 3 levels of any band run the new mechanic SOLO so players can
//     learn it without distraction.
//   • Otherwise, on roughly 1-in-3 levels we layer a SINGLE previously-taught
//     mechanic on top — picked deterministically from the level number so two
//     players see the same combo. This keeps deep levels fresh without ever
//     piling 3+ mechanics onto a single phone screen.
export function mechanicsForLevel(level: number): MechanicId[] {
  // Mid/chapter bosses (every 25th level) already carry a dedicated boss rule
  // and high-pressure layout. Do not add a separate campaign mechanic.
  if (level > 0 && level % 25 === 0) return [];

  // Chapter 3 finale: remix one previously taught rule at a time. Boss levels
  // return no campaign mechanic because their dedicated Boss Rule is the
  // encounter's single headline twist.
  if (level >= 126) {
    if (level % 10 === 0) return [];
    const remix = MECHANIC_LIST[(level - 126) % MECHANIC_LIST.length];
    return remix ? [remix.id] : [];
  }

  const unlocked = MECHANIC_LIST.filter(m => level >= m.introLevel);
  if (unlocked.length === 0) return [];
  const primary = unlocked[unlocked.length - 1]; // band the level lives in
  const isIntroPhase = level - primary.introLevel < 3; // first 3 levels of the band
  if (isIntroPhase || unlocked.length === 1 || isFocusedEncounter(level)) return [primary.id];
  // Deterministic combine cadence — every 3rd level past the intro phase.
  const shouldCombine = (level - primary.introLevel) % 3 === 0;
  if (!shouldCombine) return [primary.id];
  // Pick one previously-taught mechanic; rotate by level so it varies.
  const previous = unlocked.slice(0, -1);
  const pick = previous[(level * 7) % previous.length];
  return [pick.id, primary.id];
}

// localStorage key for "this user has already seen the intro for mechanic X".
export const seenMechanicKey = (id: MechanicId) => `rd_seen_mechanic_${id}`;
