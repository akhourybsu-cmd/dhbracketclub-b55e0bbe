// Telegraphed Attacks (Band 2, levels 51+).
//
// Each living enemy carries an `intent` countdown. At the start of every
// player action it ticks down by 1; when it reaches 0 the enemy unleashes a
// HEAVY strike during the enemy phase that turn and the counter resets to
// its `intentMax`. Killing the enemy before the strike fires interrupts it
// — that's the whole skill expression of the mechanic.
//
// We keep the data model deliberately small (two ints per enemy) so it
// composes cleanly with future bands: corrupted tiles, layered goals, and
// boss rules can all read/write the same intent fields without coupling.

import type { Enemy } from "./dungeonGenerator";
import { mulberry32, rngInt } from "./prng";

export const HEAVY_DAMAGE_MULT = 1.6;
/** Heavy strikes pierce half of an active guard. */
export const HEAVY_GUARD_PIERCE = 0.5;

/**
 * Deterministic intent assignment for a level. Mirrors how seals are seeded
 * so two players on the same level see identical telegraphs.
 *
 * - Charge length scales gently with level (2 turns early band → 3 deep band)
 *   so the mechanic stays readable instead of overwhelming.
 * - Each enemy gets a small offset so they don't all fire on the same turn.
 */
export function applyInitialIntents(
  enemies: Enemy[],
  seed: number,
  level: number,
): Enemy[] {
  const rng = mulberry32(seed ^ 0x7e1e9);
  const baseCharge = level >= 65 ? 3 : 2;
  return enemies.map((e, i) => {
    // Stagger so the first enemy fires soonest, others arrive later. We clamp
    // the result to a MINIMUM of 1 so no enemy starts at 0 (which would let
    // them heavy-strike on the player's very first action — felt unfair and
    // unreadable in playtests).
    const offset = i === 0 ? 0 : rngInt(rng, 2); // 0 or 1
    const raw = baseCharge - (i % (baseCharge + 1)) + offset;
    const clamped = Math.max(1, Math.min(baseCharge, raw || baseCharge));
    return {
      ...e,
      intentMax: baseCharge,
      intent: clamped,
    };
  });
}

export function tickIntents(enemies: Enemy[]): Enemy[] {
  return enemies.map((e) => {
    if (e.hp <= 0 || e.intent == null) return e;
    return { ...e, intent: Math.max(0, e.intent - 1) };
  });
}

/**
 * Compute total enemy damage for the turn given current intents.
 * Returns the damage AND a fresh enemy list with fired intents reset.
 */
export function resolveEnemyAttack(
  enemies: Enemy[],
  shieldActive: boolean,
): {
  enemies: Enemy[];
  totalDamage: number;
  heavyFired: boolean;
} {
  let totalDamage = 0;
  let heavyFired = false;
  const next = enemies.map((e) => {
    if (e.hp <= 0) return e;
    const isHeavy = e.intent != null && e.intent <= 0;
    let dmg = e.damage;
    if (isHeavy) {
      dmg = Math.round(dmg * HEAVY_DAMAGE_MULT);
      heavyFired = true;
    }
    // Only a heavy strike pierces guard. A charging ally does not make
    // every other enemy's ordinary attack pierce it as well.
    const guardMult = !shieldActive
      ? 1
      : isHeavy
        ? 0.4 + (1 - 0.4) * HEAVY_GUARD_PIERCE
        : 0.4;
    totalDamage += dmg * guardMult;
    return isHeavy && e.intentMax != null ? { ...e, intent: e.intentMax } : e;
  });
  return { enemies: next, totalDamage: Math.round(totalDamage), heavyFired };
}
