// Endless Survival Mode — daily challenge
//
// Replaces the old "play a seeded level with modifiers" daily with a 2-minute
// timed survival arena. Pure helpers only (no React/Supabase). The play page
// drives the timer and combat loop; this module owns:
//   - time/wave constants
//   - reward-tier curve (kills → shards/xp/title)
//   - star derivation from kill count
//   - enemy-spawn factory that scales HP by current wave
//
// Class-only arena: campaign relics/masteries stay in campaign. Daily best improvements
// settle atomically on the server; these values also drive previews.

import {
  ENEMY_ROSTER,
  rosterPoolForLevel,
  type RosterEntry,
} from "./enemyRoster";
import type { Enemy } from "./dungeonGenerator";
import { mulberry32, rngInt, type Rng } from "./prng";

/** Total run length in seconds. Tuned for one tense, mobile-friendly burst. */
export const ENDLESS_TIME_LIMIT_SEC = 120;

/** Wave breakpoints (start time in seconds). Used to ramp difficulty. */
export interface WaveTier {
  index: number; // 1..5
  startSec: number; // inclusive
  hpMult: number; // applied to base enemy HP
  damageMult: number; // applied to base enemy damage
  spawnMin: number; // min enemies per spawn batch
  spawnMax: number; // max enemies per spawn batch
  /** Cooldown between auto-spawns when the field has 0 alive enemies. */
  respawnDelayMs: number;
  /** Allow mini-boss / boss variants from the bestiary. */
  allowMini: boolean;
  allowBoss: boolean;
  label: string;
}

export const ENDLESS_WAVES: WaveTier[] = [
  {
    index: 1,
    startSec: 0,
    hpMult: 1.0,
    damageMult: 1.0,
    spawnMin: 1,
    spawnMax: 1,
    respawnDelayMs: 600,
    allowMini: false,
    allowBoss: false,
    label: "Skirmish",
  },
  {
    index: 2,
    startSec: 20,
    hpMult: 1.2,
    damageMult: 1.0,
    spawnMin: 2,
    spawnMax: 2,
    respawnDelayMs: 550,
    allowMini: false,
    allowBoss: false,
    label: "Pressure",
  },
  {
    index: 3,
    startSec: 40,
    hpMult: 1.5,
    damageMult: 1.1,
    spawnMin: 1,
    spawnMax: 2,
    respawnDelayMs: 500,
    allowMini: true,
    allowBoss: false,
    label: "Onslaught",
  },
  // More simultaneous targets demand area attacks and guard management.
  {
    index: 4,
    startSec: 60,
    hpMult: 1.8,
    damageMult: 1.2,
    spawnMin: 2,
    spawnMax: 2,
    respawnDelayMs: 450,
    allowMini: true,
    allowBoss: false,
    label: "Swarm",
  },
  // A bounded elite adds final-wave pressure without consuming the whole clock.
  {
    index: 5,
    startSec: 90,
    hpMult: 2.5,
    damageMult: 1.3,
    spawnMin: 2,
    spawnMax: 3,
    respawnDelayMs: 400,
    allowMini: true,
    allowBoss: true,
    label: "Final Push",
  },
];

/** Resolve which wave is active given elapsed seconds. */
export function waveForElapsed(elapsedSec: number): WaveTier {
  let active = ENDLESS_WAVES[0];
  for (const w of ENDLESS_WAVES) {
    if (elapsedSec >= w.startSec) active = w;
  }
  return active;
}

/** Cadence (in ms) for the enemy auto-attack tick. Faster as waves progress. */
export function enemyTickIntervalMs(elapsedSec: number): number {
  const w = waveForElapsed(elapsedSec);
  // 4500ms at wave 1 → 2400ms at wave 5
  const base = 4500 - (w.index - 1) * 525;
  return Math.max(2400, base);
}

// ── Reward tiers ────────────────────────────────────────────────────────────

export interface EndlessReward {
  shards: number;
  xp: number;
  title?: string;
}

export const ENDLESS_REWARD_TIERS: ReadonlyArray<{
  kills: number;
  shards: number;
  title?: string;
}> = [
  { kills: 0, shards: 0 },
  { kills: 1, shards: 25 },
  { kills: 3, shards: 75 },
  { kills: 6, shards: 150 },
  { kills: 10, shards: 250 },
  { kills: 15, shards: 400 },
  { kills: 22, shards: 600, title: "Endless Conqueror" },
  { kills: 30, shards: 900, title: "Eternal" },
];
export const ENDLESS_STAR_THRESHOLDS = [3, 8, 16] as const;

/**
 * Total daily reward entitlement. Better attempts pay only the positive difference.
 */
export function endlessRewardFor(kills: number): EndlessReward {
  const count = Number.isFinite(kills) ? Math.max(0, Math.floor(kills)) : 0;
  let tier = ENDLESS_REWARD_TIERS[0];
  for (const candidate of ENDLESS_REWARD_TIERS)
    if (count >= candidate.kills) tier = candidate;
  return {
    shards: tier.shards,
    xp: Math.min(500, count * 10),
    title: tier.title,
  };
}

/** Star derivation — replaces the old daily 0–3★ scoring. */
export function endlessStarsFor(kills: number): 0 | 1 | 2 | 3 {
  if (kills >= ENDLESS_STAR_THRESHOLDS[2]) return 3;
  if (kills >= ENDLESS_STAR_THRESHOLDS[1]) return 2;
  if (kills >= ENDLESS_STAR_THRESHOLDS[0]) return 1;
  return 0;
}

// ── Enemy spawning ─────────────────────────────────────────────────────────

let endlessSpawnSeq = 0;
const nextSpawnId = () => `eX-${++endlessSpawnSeq}`;

/**
 * Pick an archetype to spawn appropriate to the current wave. Boss / mini
 * variants only appear in their unlocked waves. We pull from the campaign
 * roster (chapters 1–3) so visuals/abilities match the rest of the game.
 */
function pickArchetype(wave: WaveTier, rng: Rng): RosterEntry {
  // Use a deeper roster as waves progress so visual variety scales too.
  const pseudoLevel = 5 + wave.index * 20; // 25, 45, 65, 85, 105
  const pool = rosterPoolForLevel(pseudoLevel).filter(
    (e) => e.role !== "minion",
  );
  const fallback = pool.length
    ? pool
    : ENEMY_ROSTER.filter((e) => e.role !== "minion");
  return fallback[rngInt(rng, fallback.length)];
}

/** Build a single Enemy at the wave's HP/damage scale. */
export function spawnEnemy(
  elapsedSec: number,
  rng: Rng,
  allowPromotion = true,
): Enemy {
  const wave = waveForElapsed(elapsedSec);
  const arc = pickArchetype(wave, rng);
  // Promote to mini/boss variants in higher waves on a coin flip.
  let tier: "mini" | "boss" | undefined;
  let hpMul = wave.hpMult;
  let dmgMul = wave.damageMult;
  let prefix = "";
  if (allowPromotion && wave.allowBoss && rngInt(rng, 10) === 0) {
    tier = "boss";
    hpMul *= 1.7;
    dmgMul *= 1.35;
    prefix = "Dread ";
  } else if (allowPromotion && wave.allowMini && rngInt(rng, 4) === 0) {
    tier = "mini";
    hpMul *= 1.35;
    dmgMul *= 1.15;
    prefix = "Greater ";
  }
  // Roster depth, wave scaling and promotion must not multiply into a late
  // 900-HP sponge in a 30-second window. Pressure comes from attack cadence,
  // simultaneous foes and a bounded elite, with readable kill breakpoints.
  const baseCeiling = [60, 85, 115, 140, 175][wave.index - 1];
  const variant = tier === "boss" ? 1.7 : tier === "mini" ? 1.35 : 1;
  const hp = Math.max(
    20,
    Math.round(Math.min(arc.baseHp * hpMul, baseCeiling * variant)),
  );
  const damage = Math.max(2, Math.round(arc.baseDamage * dmgMul));
  return {
    id: nextSpawnId(),
    name: `${prefix}${arc.name}`,
    emoji: arc.emoji,
    hp,
    maxHp: hp,
    damage,
    archetypeId: arc.id,
    family: arc.family,
    role: arc.role,
    ability: arc.ability,
    abilityCooldown: arc.abilityCooldown,
    abilityCooldownMax: arc.abilityCooldown,
    telegraphLabel: arc.telegraphLabel,
    tier,
  };
}

/**
 * Generate a fresh batch of enemies for one spawn pulse. Caller decides
 * when to invoke this (e.g. when the field empties, or on a fixed cadence).
 */
export function spawnBatch(elapsedSec: number, seed: number): Enemy[] {
  const wave = waveForElapsed(elapsedSec);
  const rng = mulberry32(seed);
  const count = wave.spawnMin + rngInt(rng, wave.spawnMax - wave.spawnMin + 1);
  const out: Enemy[] = [];
  let promoted = false;
  for (let i = 0; i < count; i++) {
    const enemy = spawnEnemy(elapsedSec, rng, !promoted);
    promoted ||= !!enemy.tier;
    out.push(enemy);
  }
  return out;
}

/** Score formula — kill-count weighted with damage as a secondary factor. */
export function endlessScore(kills: number, totalDamage: number): number {
  return kills * 250 + Math.floor(totalDamage * 0.5);
}
