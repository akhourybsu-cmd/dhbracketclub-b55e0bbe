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
// Class-only arena: campaign relics/masteries stay in campaign. Daily rewards
// are settled exactly once by the server; these values also drive previews.

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
    spawnMin: 1,
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
  // Smoothed wave 4: 1.5 → 1.8 (was 2.0). Keeps the swarm tense without
  // wall-checking under-leveled mages/clerics who lack burst.
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
  // Final Push: 2.5× regular (was 3.0). Bosses still feel meaty thanks to the
  // ×4 boss multiplier in spawnEnemy, but no longer un-killable in 30s.
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

/**
 * Reward ladder keyed off enemy kill count for the first daily result.
 */
export function endlessRewardFor(kills: number): EndlessReward {
  const xp = Math.min(500, kills * 10);
  let shards = 25; // participation (0–4 kills)
  let title: string | undefined;
  if (kills >= 5) shards = 75;
  if (kills >= 10) shards = 150;
  if (kills >= 15) shards = 250;
  if (kills >= 20) shards = 400;
  if (kills >= 30) {
    shards = 600;
    title = "Endless Conqueror";
  }
  if (kills >= 50) {
    shards = 900;
    title = "Eternal";
  }
  return { shards, xp, title };
}

/** Star derivation — replaces the old daily 0–3★ scoring. */
export function endlessStarsFor(kills: number): 0 | 1 | 2 | 3 {
  if (kills >= 25) return 3;
  if (kills >= 15) return 2;
  if (kills >= 5) return 1;
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
export function spawnEnemy(elapsedSec: number, rng: Rng): Enemy {
  const wave = waveForElapsed(elapsedSec);
  const arc = pickArchetype(wave, rng);
  // Promote to mini/boss variants in higher waves on a coin flip.
  let tier: "mini" | "boss" | undefined;
  let hpMul = wave.hpMult;
  let dmgMul = wave.damageMult;
  let prefix = "";
  if (wave.allowBoss && rngInt(rng, 10) === 0) {
    tier = "boss";
    hpMul *= 3; // was 4 — keeps bosses meaty but killable in ~10–15s
    dmgMul *= 1.5; // was 1.6
    prefix = "Dread ";
  } else if (wave.allowMini && rngInt(rng, 4) === 0) {
    tier = "mini";
    hpMul *= 1.8; // was 2 — softens the mini-boss spike
    dmgMul *= 1.2; // was 1.25
    prefix = "Greater ";
  }
  const hp = Math.max(20, Math.round(arc.baseHp * hpMul));
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
  for (let i = 0; i < count; i++) out.push(spawnEnemy(elapsedSec, rng));
  return out;
}

/** Score formula — kill-count weighted with damage as a secondary factor. */
export function endlessScore(kills: number, totalDamage: number): number {
  return kills * 250 + Math.floor(totalDamage * 0.5);
}
