// ─── Rune Delve Relics ────────────────────────────────────────────────────
// Permanent unlocks players spend Rune Shards on. Equip up to 3 in their
// loadout (per class) to apply small but meaningful modifiers to a run.
//
// Balance philosophy: every relic is a *modifier*, not a stat multiplier.
// Class identity (passive + ability) still drives playstyle. Relics solve
// specific problems or favour a build — they never trivialise a chapter.
//
// ── Ranks (R1 base → R5 max) ───────────────────────────────────────────────
// Owned relics can be upgraded with shards. Each rank applies a small bump
// (≤10–15% of base). All damage/heal/shield outputs round to whole integers.

import type { HeroClass } from './classConfig';

export type RelicCategory = 'offense' | 'mana' | 'survival' | 'board' | 'tempo' | 'objective';
export type RelicTier = 1 | 2 | 3;

export interface RelicDef {
  id: string;
  name: string;
  category: RelicCategory;
  tier: RelicTier;
  cost: number;       // Rune Shards (R1 unlock cost)
  icon: string;       // emoji
  description: string;
  flavor?: string;
}

export const RELIC_CATALOG: RelicDef[] = [
  // ── Tier 1 — gentle helpers (chapter 1+) ──────────────────────────────
  { id: 'ember_edge',       name: 'Ember Edge',        category: 'offense',   tier: 1, cost: 100, icon: '🔥', description: 'First red chain each run deals +50% damage.' },
  { id: 'aether_spark',     name: 'Aether Spark',      category: 'mana',      tier: 1, cost: 100, icon: '💠', description: 'Start each run with 2 mana.' },
  { id: 'iron_resolve',     name: 'Iron Resolve',      category: 'survival',  tier: 1, cost: 120, icon: '🛡️', description: 'Start each run with a 1-turn shield.' },
  { id: 'verdant_heart',    name: 'Verdant Heart',     category: 'survival',  tier: 1, cost: 100, icon: '🌿', description: 'Green chains heal +1 HP per rune.' },
  { id: 'keysight',         name: 'Keysight',          category: 'board',     tier: 1, cost: 120, icon: '🗝️', description: 'Sealed tiles unlock 1 turn faster.' },
  { id: 'quickstep',        name: 'Quickstep',         category: 'tempo',     tier: 1, cost: 110, icon: '👣', description: 'First chain each run counts as +1 length.' },
  { id: 'shrine_ward',      name: 'Shrine Ward',       category: 'objective', tier: 1, cost: 130, icon: '🕯️', description: 'Boss & elite damage to you reduced 10% on turn 1.' },
  { id: 'wanderers_compass',name: "Wanderer's Compass",category: 'objective', tier: 1, cost: 150, icon: '🧭', description: '+15% Rune Shards from this run.' },
  // NEW T1
  { id: 'mirror_shard',     name: 'Mirror Shard',      category: 'offense',   tier: 1, cost: 140, icon: '🪞', description: 'Every 2nd chain deals +30% damage (red) or grants a bonus orb / heal / shield (others).' },
  { id: 'brambleward',      name: 'Brambleward',       category: 'survival',  tier: 1, cost: 130, icon: '🌵', description: 'Shield Thorns reflect +15% more damage. Stacks with Spiked Aegis.' },

  // ── Tier 2 — mechanic-aware (chapter 2+) ──────────────────────────────
  { id: 'crimson_tide',     name: 'Crimson Tide',      category: 'offense',   tier: 2, cost: 280, icon: '🩸', description: 'Every 5th red chain deals +75% damage.' },
  { id: 'sapphire_flow',    name: 'Sapphire Flow',     category: 'mana',      tier: 2, cost: 300, icon: '💎', description: 'Blue chains grant +1 mana on chains of 4+.' },
  { id: 'last_stand',       name: 'Last Stand',        category: 'survival',  tier: 2, cost: 380, icon: '💔', description: 'Once per run, survive lethal damage at 1 HP.' },
  { id: 'cleansing_touch',  name: 'Cleansing Touch',   category: 'board',     tier: 2, cost: 320, icon: '✨', description: 'First corrupted source cleared each run is free (no HP cost).' },
  { id: 'momentum',         name: 'Momentum',          category: 'tempo',     tier: 2, cost: 280, icon: '⚡', description: "Rogue's chain bonus threshold becomes 4+ (was 5+). Other classes: chains of 4+ score +10%." },
  { id: 'foresight',        name: 'Foresight',         category: 'objective', tier: 2, cost: 350, icon: '👁️', description: 'Telegraphed heavy strikes take 1 extra turn to charge.' },
  { id: 'bulwark',          name: 'Bulwark',           category: 'survival',  tier: 2, cost: 320, icon: '🪨', description: 'Gold chains grant +1 shield turn.' },
  { id: 'spiked_aegis',     name: 'Spiked Aegis',      category: 'survival',  tier: 2, cost: 340, icon: '🌵', description: 'Shield reflects more damage back at attackers (+10% / +20% / +35%).' },
  // NEW T2
  { id: 'vampiric_sigil',   name: 'Vampiric Sigil',    category: 'survival',  tier: 2, cost: 360, icon: '🧛', description: 'Heal 20% of red-chain damage dealt back as HP.' },
  { id: 'rune_echo',        name: 'Rune Echo',         category: 'tempo',     tier: 2, cost: 340, icon: '🌀', description: 'Every 4th chain repeats its effect at 50% strength.' },

  // ── Tier 3 — specialised synergy (chapter 3+) ─────────────────────────
  { id: 'executioners_mark',name: "Executioner's Mark",category: 'offense',   tier: 3, cost: 600, icon: '🎯', description: '+30% damage vs enemies below 25% HP.' },
  { id: 'first_light',      name: 'First Light',       category: 'mana',      tier: 3, cost: 650, icon: '☀️', description: 'First class ability each run is free (costs 0 mana).' },
  { id: 'bloodbond',        name: 'Bloodbond',         category: 'survival',  tier: 3, cost: 700, icon: '❤️', description: 'Killing an enemy heals 4 HP.' },
  { id: 'desperate_surge',  name: 'Desperate Surge',   category: 'tempo',     tier: 3, cost: 600, icon: '💢', description: 'Below 30% HP: red chains deal +25% damage.' },
  { id: 'cracked_crown',    name: 'Cracked Crown',     category: 'objective', tier: 3, cost: 750, icon: '👑', description: 'Boss-rule damage modifiers softened by 15%.' },
  // NEW T3
  { id: 'foreseers_lens',   name: "Foreseer's Lens",   category: 'objective', tier: 3, cost: 700, icon: '🔮', description: 'Gain +1 turn on every level. Higher ranks add more.' },
  { id: 'void_pact',        name: 'Void Pact',         category: 'offense',   tier: 3, cost: 800, icon: '🌌', description: 'Sacrifice 10 max HP. All chains deal +20% effect.' },
  { id: 'phoenix_heart',    name: 'Phoenix Heart',     category: 'survival',  tier: 3, cost: 850, icon: '🔥', description: 'Once per run, on lethal damage, revive at 50% HP.' },
];

export const RELIC_BY_ID: Record<string, RelicDef> = Object.fromEntries(RELIC_CATALOG.map(r => [r.id, r]));

export function getRelic(id: string | null | undefined): RelicDef | null {
  if (!id) return null;
  return RELIC_BY_ID[id] ?? null;
}

export function relicsByTier(tier: RelicTier): RelicDef[] {
  return RELIC_CATALOG.filter(r => r.tier === tier);
}

export function relicsByCategory(cat: RelicCategory): RelicDef[] {
  return RELIC_CATALOG.filter(r => r.category === cat);
}

// Tier unlock — gated by chapter (every 50 levels = 1 chapter).
export function tierUnlockedForChapter(tier: RelicTier, chapter: number): boolean {
  if (tier === 1) return true;
  if (tier === 2) return chapter >= 2;
  return chapter >= 3;
}

export const CATEGORY_META: Record<RelicCategory, { label: string; emoji: string; hint: string }> = {
  offense:   { label: 'Offense',   emoji: '⚔️', hint: 'Damage & elite hunting' },
  mana:      { label: 'Mana',      emoji: '💠', hint: 'Ability charge & casts' },
  survival:  { label: 'Survival',  emoji: '🛡️', hint: 'Health, shields & life-saves' },
  board:     { label: 'Board',     emoji: '🧩', hint: 'Hazards & tile control' },
  tempo:     { label: 'Tempo',     emoji: '⚡', hint: 'Chain bonuses & efficiency' },
  objective: { label: 'Utility',   emoji: '🎯', hint: 'Objectives & boss aid' },
};

// All relics are class-agnostic in MVP. A future pass can gate certain
// relics to a specific class via this helper.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function relicAllowedForClass(_relic: RelicDef, _cls: HeroClass): boolean {
  return true;
}

// ─── Ranks ────────────────────────────────────────────────────────────────

export const MAX_RANK = 5;

/** Cost in shards to upgrade FROM (rank-1) TO `rank`. R1 is the unlock cost,
 *  not a rank-up. Returns 0 if rank <= 1 or rank > MAX_RANK. */
export function rankCost(baseCost: number, rank: number): number {
  if (rank <= 1 || rank > MAX_RANK) return 0;
  // rankCost(rank) = round(baseCost * 0.6 * 2^(rank-2))
  return Math.round(baseCost * 0.6 * Math.pow(2, rank - 2));
}

export function totalRankCost(baseCost: number, throughRank: number): number {
  let sum = 0;
  for (let r = 2; r <= Math.min(MAX_RANK, throughRank); r++) sum += rankCost(baseCost, r);
  return sum;
}

/** Per-rank effect values. Index 0 = R1 (base), index 4 = R5 (max).
 *  Multipliers are decimals; flat values are integers. */
export type RankTable = readonly [number, number, number, number, number];

export const RANK_EFFECTS: Record<string, RankTable> = {
  // Offense (multipliers — small +0.05 bumps)
  ember_edge:        [1.50, 1.55, 1.60, 1.65, 1.70],
  crimson_tide:      [1.75, 1.80, 1.85, 1.90, 1.95],
  executioners_mark: [1.30, 1.36, 1.42, 1.48, 1.55],
  desperate_surge:   [1.25, 1.30, 1.36, 1.42, 1.50],

  // Mana (flat — integer breakpoints)
  // Values above the 3-mana cap convert to opening shield turns, so every
  // rank remains a real upgrade instead of silently wasting overflow.
  aether_spark:      [2,    3,    4,    5,    6   ],
  sapphire_flow:     [1,    1,    2,    2,    3   ],
  first_light:       [1,    1,    2,    2,    3   ], // free uses

  // Survival
  iron_resolve:      [1,    2,    2,    3,    3   ], // shield turns
  verdant_heart:     [1.0,  1.1,  1.2,  1.3,  1.4 ], // heal multiplier on length
  bloodbond:         [4,    5,    6,    7,    8   ], // HP heal on kill
  last_stand:        [1,    1,    2,    2,    3   ], // uses per run
  bulwark:           [1,    2,    2,    3,    3   ], // shield turns added on gold
  spiked_aegis:      [1.10, 1.15, 1.20, 1.28, 1.35], // thorns multiplier (composes with class base)

  // Board / tempo / utility
  keysight:          [1,    2,    2,    3,    3   ], // sealed speedup turns
  cleansing_touch:   [1,    1,    2,    2,    3   ], // free clears
  quickstep:         [1,    2,    2,    3,    3   ], // length bonus on first chain
  momentum:          [1.10, 1.13, 1.16, 1.20, 1.25],
  foresight:         [1,    1,    2,    2,    3   ], // extra turns to charge heavy strikes
  shrine_ward:       [0.90, 0.88, 0.86, 0.84, 0.82], // damage multiplier (lower = better)
  wanderers_compass: [1.15, 1.18, 1.21, 1.24, 1.27],
  cracked_crown:     [0.85, 0.83, 0.81, 0.79, 0.77], // boss soften (lower = better)

  // ── New relics ─────────────────────────────────────────────────────────
  mirror_shard:      [1.30, 1.35, 1.40, 1.45, 1.50], // bonus mult on every 2nd chain
  brambleward:       [1.15, 1.20, 1.25, 1.32, 1.40], // extra thorns multiplier
  vampiric_sigil:    [0.20, 0.24, 0.28, 0.32, 0.40], // lifesteal % of red dmg
  rune_echo:         [0.50, 0.55, 0.60, 0.70, 0.80], // echo strength on every 4th chain
  foreseers_lens:    [1,    1,    2,    2,    3   ], // bonus turns per level
  void_pact:         [1.20, 1.24, 1.28, 1.34, 1.40], // damage mult on all chains
  phoenix_heart:     [0.50, 0.55, 0.60, 0.70, 0.80], // revive HP fraction of maxHp
};

export function clampRank(rank: number | null | undefined): number {
  if (!rank || rank < 1) return 1;
  if (rank > MAX_RANK) return MAX_RANK;
  return Math.floor(rank);
}

/** Resolve an effect value for a relic + rank. Falls back to R1 if missing. */
export function effectValue(relicId: string, rank: number): number {
  const table = RANK_EFFECTS[relicId];
  if (!table) return 1;
  return table[clampRank(rank) - 1];
}

// ─── Rank-aware descriptions ──────────────────────────────────────────────
// Builds a description string that reflects the relic's *current rank*
// values, so cards in the Armory and Shop show what the player actually has
// (or will get on next purchase) — not just the R1 baseline copy.

function pctBonus(mult: number): number {
  // 1.50 → 50, 1.75 → 75, etc. (rounded)
  return Math.round((mult - 1) * 100);
}

function pctReduction(mult: number): number {
  // 0.90 → 10, 0.85 → 15, etc.
  return Math.round((1 - mult) * 100);
}

function turnsLabel(n: number): string {
  return `${n} turn${n === 1 ? '' : 's'}`;
}

/** Produces a rank-aware description string for a relic.
 *  Falls back to the static description if the relic has no rank table or
 *  no rank-aware template. */
export function describeRelicAtRank(relic: RelicDef, rank: number): string {
  const r = clampRank(rank);
  const v = RANK_EFFECTS[relic.id]?.[r - 1];
  if (v == null) return relic.description;

  switch (relic.id) {
    // Offense — % red-chain damage on first chain
    case 'ember_edge':
      return `First red chain each run deals +${pctBonus(v)}% damage.`;
    case 'crimson_tide':
      return `Every 5th red chain deals +${pctBonus(v)}% damage.`;
    case 'executioners_mark':
      return `+${pctBonus(v)}% damage vs enemies below 25% HP.`;
    case 'desperate_surge':
      return `Below 30% HP: red chains deal +${pctBonus(v)}% damage.`;
    case 'momentum':
      return `Rogue's chain bonus threshold becomes 4+ (was 5+). Other classes: chains of 4+ score +${pctBonus(v)}%.`;
    case 'mirror_shard':
      return `Every 2nd chain deals +${pctBonus(v)}% damage (red) or grants a bonus orb / heal / shield (others).`;
    case 'void_pact':
      return `Sacrifice 10 max HP. All chains deal +${pctBonus(v)}% effect.`;

    // Mana
    case 'aether_spark':
      return v <= 3
        ? `Start each run with ${Math.round(v)} mana.`
        : `Start at full mana; ${Math.round(v - 3)} overflow becomes shield turn${v - 3 === 1 ? '' : 's'}.`;
    case 'sapphire_flow':
      return `Blue chains grant +${Math.round(v)} mana on chains of 4+.`;
    case 'first_light': {
      const n = Math.round(v);
      return `First ${n} class ability use${n === 1 ? '' : 's'} each run cost 0 mana.`;
    }

    // Survival
    case 'iron_resolve':
      return `Start each run with a ${turnsLabel(Math.round(v))} shield.`;
    case 'verdant_heart':
      return `Green chains heal +${v.toFixed(1)} HP per rune.`;
    case 'bloodbond':
      return `Killing an enemy heals ${Math.round(v)} HP.`;
    case 'last_stand': {
      const n = Math.round(v);
      return `${n === 1 ? 'Once' : `${n} times`} per run, survive lethal damage at 1 HP.`;
    }
    case 'bulwark':
      return `Gold chains grant +${turnsLabel(Math.round(v))} of shield.`;
    case 'spiked_aegis':
      return `Shield reflects +${pctBonus(v)}% damage back at attackers.`;
    case 'brambleward':
      return `Shield Thorns reflect +${pctBonus(v)}% more damage. Stacks with Spiked Aegis.`;
    case 'vampiric_sigil':
      return `Heal ${Math.round(v * 100)}% of red-chain damage dealt back as HP.`;
    case 'phoenix_heart':
      return `Once per run, on lethal damage, revive at ${Math.round(v * 100)}% HP.`;

    // Board / tempo / utility
    case 'keysight':
      return `Sealed tiles unlock ${turnsLabel(Math.round(v))} faster.`;
    case 'cleansing_touch': {
      const n = Math.round(v);
      return `First ${n} corrupted source${n === 1 ? '' : 's'} cleared each run ${n === 1 ? 'is' : 'are'} free (no HP cost).`;
    }
    case 'quickstep':
      return `First chain each run counts as +${Math.round(v)} length.`;
    case 'foresight':
      return `Telegraphed heavy strikes take ${turnsLabel(Math.round(v))} longer to charge.`;
    case 'shrine_ward':
      return `Boss & elite damage to you reduced ${pctReduction(v)}% on turn 1.`;
    case 'wanderers_compass':
      return `+${pctBonus(v)}% Rune Shards from this run.`;
    case 'cracked_crown':
      return `Boss-rule damage modifiers softened by ${pctReduction(v)}%.`;
    case 'rune_echo':
      return `Every 4th chain repeats its effect at ${Math.round(v * 100)}% strength.`;
    case 'foreseers_lens':
      return `Gain +${turnsLabel(Math.round(v))} on every level.`;

    default:
      return relic.description;
  }
}
