// Rune Delve — Level → Chamber layout assignment
//
// Pure deterministic mapping from a level number to a chamber layout id.
// Same level always resolves to the same chamber so two players see the
// same dungeon shape on the same level. Reuses existing helpers from
// levelGenerator (chapterFor, isMilestoneLevel, isChapterOpener) so we
// don't drift from the canonical level structure.
//
// Assignment rules (in priority order):
//   1. Final boss of a chapter (level % 50 === 0) → Final Seal Chamber
//   2. Mid-chapter milestone (every 25th)         → Cursed Vault / Shadow Reliquary
//   3. Chapter opener (level - 1) % 50 === 0      → Ancient Gate
//   4. Mechanic-introduction levels                → Spiral Sanctum / Crystal Archive
//   5. Otherwise → cycle through path layouts deterministically by level
//
// Engine impact: the selected layout's hazard and treasure counts are mapped
// onto deterministic 5×5 board cells by `layoutZones.ts`. The illustrated
// path shape, entries, and rune-slot dots remain presentation metadata only.

import { isMilestoneLevel, isChapterOpener, chapterFor } from './levelGenerator';
import { introMechanicForLevel } from './mechanics';
import { type RuneLayoutId, getLayout, RUNE_LAYOUTS } from './runeLayouts';

const PATH_ROTATION: RuneLayoutId[] = [
  'split_passage',
  'ember_hollow',
  'forgotten_catacomb',
  'rune_crossroads',
];

const SANCTUM_ROTATION: RuneLayoutId[] = [
  'spiral_sanctum',
  'crystal_archive',
];

const VAULT_ROTATION: RuneLayoutId[] = [
  'cursed_vault',
  'shadow_reliquary',
];

/**
 * Resolve which chamber layout a given level deploys on. Pure, deterministic,
 * cheap (constant-time). Falls back to 'ancient_gate' if anything looks
 * unexpected so callers never crash on a bad input.
 */
export function getLayoutIdForLevel(level: number): RuneLayoutId {
  if (!Number.isFinite(level) || level < 1) return 'ancient_gate';

  // 1. Chapter boss — every 50th level
  if (level % 50 === 0) return 'final_seal_chamber';

  // 2. Mid-chapter milestone (every 25th, including 25/75/125…) — alternate vault flavors
  if (isMilestoneLevel(level) && level % 50 !== 0) {
    const idx = Math.floor(level / 25) % VAULT_ROTATION.length;
    return VAULT_ROTATION[idx];
  }

  // 3. Chapter opener — first level of any chapter
  if (isChapterOpener(level)) return 'ancient_gate';

  // 4. Mechanic-introduction levels get sanctum-flavored layouts so the briefing
  //    framing matches the new mechanic's "study this carefully" energy.
  if (introMechanicForLevel(level)) {
    const idx = level % SANCTUM_ROTATION.length;
    return SANCTUM_ROTATION[idx];
  }

  // 5. Default rotation — cycle by level so adjacent levels feel different
  //    without being chaotic. Anchored on chapter so chapter starts are
  //    consistent across users.
  const offset = (level - chapterFor(level)) % PATH_ROTATION.length;
  return PATH_ROTATION[Math.max(0, offset)];
}

/**
 * Convenience that returns the full layout object. Returns the default
 * layout if anything fails to resolve.
 */
export function getLayoutForLevel(level: number) {
  const id = getLayoutIdForLevel(level);
  return getLayout(id) ?? RUNE_LAYOUTS.ancient_gate;
}
