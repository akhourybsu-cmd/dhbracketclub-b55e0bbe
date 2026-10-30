// Rune Delve — Chamber Layout Zones
//
// Translates the COUNT metadata stored on each `runeLayouts.ts` layout
// (treasureZones, hazardZones, lockedZones) into actual 5×5 grid cell
// coordinates so the play engine can act on them.
//
// The counts were defined ages ago but never wired into the engine —
// every chamber rendered the same plain grid regardless of which
// layout it was assigned. This file fills the gap.
//
// Determinism:
// - All cell assignments use a mulberry32 PRNG seeded from the level's
//   generation seed (offset by +7777 so we don't collide with other
//   consumers of the same base seed).
// - That means the same level always lays out treasure / hazard cells
//   in the same positions for every player. Re-playing the same level
//   doesn't shuffle them around — the player learns the layout.
//
// Effect contract (consumed by RuneDelvePlayPage.handleChain):
// - Treasure cells: when a chain passes through one, the player gets
//   bonus score and a small shard drop per cell. Treasure cells persist
//   across the run (they're a board property, not a tile property —
//   refilling runes doesn't remove the treasure spot).
// - Hazard cells: when a chain passes through one, the player takes
//   small HP damage per cell, capped so a single chain through multiple
//   hazards can't insta-wipe.
// - Locked cells: present in the metadata but NOT yet wired in this
//   first pass. Adding them touches isValidChain (match-validation
//   layer), which is higher risk; reserved for a follow-up.
//
// Allocation order: treasure → hazard → locked. If a layout's combined
// counts exceed half the board (12 cells on 5×5), allocation stops so
// there's always plain board to chain through. In practice no layout
// declares more than ~6 special cells combined, so this safety cap
// never fires today — it's belt-and-suspenders.

import { mulberry32 } from './prng';
import { getLayout, type RuneLayoutId } from './runeLayouts';
import { BOARD_SIZE } from './dungeonGenerator';
import { cellKey } from './boardEngine';
import type { Cell } from './boardEngine';

export interface LayoutZones {
  /** Cells (in `${r}-${c}` cellKey format) that grant treasure bonuses
   *  when matched through. */
  treasure: Set<string>;
  /** Cells that damage the hero when matched through. */
  hazard: Set<string>;
  /** Cells that are inert / require unlocking to match. NOT yet
   *  consumed by the engine — kept for a future pass. */
  locked: Set<string>;
}

export const EMPTY_ZONES: LayoutZones = Object.freeze({
  treasure: new Set<string>(),
  hazard: new Set<string>(),
  locked: new Set<string>(),
}) as LayoutZones;

/** Score gained per treasure cell touched in a chain. */
export const TREASURE_SCORE_BONUS = 75;
/** Bonus shards gained per treasure cell touched in a chain. */
export const TREASURE_SHARD_BONUS = 5;
/** A treasure coordinate pays once per encounter; deeper chapters pay more. */
export function treasureShardValue(levelNumber: number): number {
  return Math.max(1, Math.min(3, Math.ceil(levelNumber / 50)));
}

/** HP damage taken per hazard cell touched in a chain. */
export const HAZARD_DAMAGE = 5;
/** Max total hazard damage that a SINGLE chain can deal — caps the
 *  worst case if the chain happens to thread through every hazard. */
export const HAZARD_MAX_DAMAGE_PER_CHAIN = 12;

/** Half-board safety cap so we never carpet-bomb the grid with
 *  zones — a player needs plain cells to actually chain. */
const TOTAL_ZONE_CAP = Math.floor((BOARD_SIZE * BOARD_SIZE) / 2);

/**
 * Compute the deterministic zone layout for a given (layout, seed) pair.
 * Returns frozen-empty zones when the layout is unknown OR declares
 * zero special cells — same shape either way so callers don't need
 * undefined-guards.
 */
export function computeLayoutZones(
  layoutId: RuneLayoutId | null | undefined,
  levelSeed: number,
): LayoutZones {
  const layout = getLayout(layoutId);
  if (!layout) return EMPTY_ZONES;
  const p = layout.preview;
  if (p.treasureZones + p.hazardZones + p.lockedZones === 0) return EMPTY_ZONES;

  const rng = mulberry32(levelSeed + 7777);

  // Generate the shuffled cell list once; treasure/hazard/locked each
  // consume the next N cells in order.
  const cells: string[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) cells.push(`${r}-${c}`);
  }
  // Fisher–Yates with seeded PRNG so the order is reproducible.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  let cursor = 0;
  const allocate = (count: number): Set<string> => {
    const out = new Set<string>();
    for (let n = 0; n < count && cursor < TOTAL_ZONE_CAP && cursor < cells.length; n++, cursor++) {
      out.add(cells[cursor]);
    }
    return out;
  };

  return {
    treasure: allocate(p.treasureZones),
    hazard:   allocate(p.hazardZones),
    locked:   allocate(p.lockedZones),
  };
}

/** Count how many cells in a chain fall inside the given zone set. */
export function countChainInZone(chain: Cell[], zone: Set<string>): number {
  let n = 0;
  for (const c of chain) if (zone.has(cellKey(c))) n++;
  return n;
}
