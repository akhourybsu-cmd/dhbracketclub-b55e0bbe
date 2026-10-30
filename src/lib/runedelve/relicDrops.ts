// Rune Delve — relic drop probability helpers for previews and simulation.
//
// On a chamber clear, the player has a chance to roll a free relic
// drop — independent of the shard economy. Gives runs a "what will I
// pull?" moment that the game otherwise lacks (today, relics are
// purely bought with shards at the shop).
//
// Drop rate scales with depth so the rare T2/T3 relics show up in
// the chapters where they're actually unlocked. Boss / chapter-boss
// clears get bumps so milestone runs feel rewarding.
//
// Live ownership is delivered by rune_delve_save_run and its immutable
// receipt. Clients cannot grant drops or insert ownership directly.

import { RELIC_CATALOG, tierUnlockedForChapter, type RelicDef } from './relics';
import { chapterFor } from './levelGenerator';
import { mulberry32 } from './prng';

export interface RollOptions {
  /** Was the chamber cleared? Drops only on clear. */
  cleared: boolean;
  /** Level number — drives chapter, scaling, boss bonuses. */
  levelNumber: number;
  /** Ids of relics the player already owns; excluded from the pool. */
  ownedRelicIds: Set<string>;
  /** Seed for deterministic test rolls. Defaults to Date.now() at
   *  finalize-time which is fine for production (each clear gets a
   *  fresh roll). */
  seed?: number;
  /** Additive bonus to the base drop chance (R2 Elite Path adds 0.08).
   *  Stacks BEFORE the MAX_DROP_RATE ceiling so a luck-boosted Elite
   *  chapter-boss clear still can't exceed the hard cap. */
  bonusChance?: number;
}

export interface RelicDropResult {
  relic: RelicDef;
  /** The drop chance that this roll landed under (for UI displays
   *  like "you got lucky — 11% chance"). */
  rolledAt: number;
}

// Tunables — adjust here to balance economy.
const BASE_DROP_RATE = 0.08;       // 8% on any clear
const CHAPTER_BONUS = 0.01;        // +1% per chapter past 1
const MINI_BOSS_BONUS = 0.02;      // every 10th level
const CHAPTER_BOSS_BONUS = 0.05;   // every 50th level
const MAX_DROP_RATE = 0.25;        // hard cap

/**
 * Effective drop chance for a given clear. Returns 0 on fail. Pure
 * function — useful for UI ("Today's daily has a 13% drop chance").
 */
export function dropChanceFor(levelNumber: number, cleared: boolean): number {
  if (!cleared) return 0;
  const chapter = chapterFor(levelNumber);
  let rate = BASE_DROP_RATE + Math.max(0, chapter - 1) * CHAPTER_BONUS;
  if (levelNumber % 50 === 0) rate += CHAPTER_BOSS_BONUS;
  else if (levelNumber % 10 === 0) rate += MINI_BOSS_BONUS;
  return Math.min(MAX_DROP_RATE, rate);
}

/**
 * Roll for a drop. Returns the relic + the rate it landed under,
 * or null when no drop happens (failed clear, RNG miss, or the
 * tier-eligible pool is exhausted because the player owns everything
 * available at their chapter).
 */
export function rollRelicDrop(opts: RollOptions): RelicDropResult | null {
  if (!opts.cleared) return null;

  // Base rate from depth, then add any bonus (Path Variant etc.),
  // clamp to the global MAX so totals can't run away.
  const baseRate = dropChanceFor(opts.levelNumber, opts.cleared);
  const rate = Math.min(MAX_DROP_RATE, baseRate + Math.max(0, opts.bonusChance ?? 0));
  if (rate <= 0) return null;

  const rng = mulberry32(((opts.seed ?? Date.now()) >>> 0) || 1);

  // First roll: did we get any drop at all?
  if (rng() >= rate) return null;

  // Second roll: which relic? Filter to UNOWNED + tier-unlocked.
  const chapter = chapterFor(opts.levelNumber);
  const pool = RELIC_CATALOG.filter(r =>
    !opts.ownedRelicIds.has(r.id) && tierUnlockedForChapter(r.tier, chapter),
  );
  if (pool.length === 0) return null;

  // Slight weighting: lower-tier relics drop more often than higher
  // (since they're cheaper and there's more of them in the catalog).
  // We pick uniformly from the eligible pool — chapter gating already
  // handles tier-3 rarity by gating them to chapter 3+. No fancier
  // weights needed for first cut.
  const idx = Math.floor(rng() * pool.length);
  return { relic: pool[idx], rolledAt: rate };
}
