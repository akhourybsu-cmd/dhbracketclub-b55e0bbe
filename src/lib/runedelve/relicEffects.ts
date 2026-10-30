// ─── Pure helpers that read an active relic loadout and return tweaks ────
// Combat and shard code consume these — relics never reach into engine
// internals directly. Keeps the modifier surface small and auditable.
//
// Rank-aware: every effect now reads its scaled value from RANK_EFFECTS in
// relics.ts. All damage/heal/shield outputs are rounded to whole integers.

import type { CombatState } from "./combatEngine";
import {
  effectValue,
  clampRank,
  relicRankMaxHpBonus,
  RELIC_BY_ID,
} from "./relics";

export interface ActiveRelics {
  /** id -> rank (1..5). Presence implies equipped/owned at that rank. */
  ranks: Map<string, number>;
}

/** Build an ActiveRelics from up to 3 equipped slot ids and an optional
 *  collection lookup that resolves each id to its current rank. Slots
 *  without an entry default to rank 1. */
export function buildActive(
  slots: (string | null | undefined)[],
  rankLookup?: Map<string, number> | Record<string, number>,
): ActiveRelics {
  const map = new Map<string, number>();
  const lookup = (id: string): number => {
    if (!rankLookup) return 1;
    if (rankLookup instanceof Map) return clampRank(rankLookup.get(id) ?? 1);
    return clampRank((rankLookup as Record<string, number>)[id] ?? 1);
  };
  for (const id of slots) {
    if (id) map.set(id, lookup(id));
  }
  return { ranks: map };
}

export const has = (a: ActiveRelics, id: string) => a.ranks.has(id);
export const rankOf = (a: ActiveRelics, id: string): number =>
  a.ranks.get(id) ?? 0;

/** Three equipped R5 relics contribute at most 24 max HP. Unknown IDs add nothing. */
export function getRelicRankMaxHpBonus(a: ActiveRelics): number {
  const bonus = [...a.ranks].reduce(
    (sum, [id, rank]) =>
      sum +
      (Object.prototype.hasOwnProperty.call(RELIC_BY_ID, id)
        ? relicRankMaxHpBonus(rank)
        : 0),
    0,
  );
  return Math.min(24, bonus);
}

/** Healing uses actual HP damage and cannot exceed a fifth of max HP per action. */
export function getLifestealHealAmount(
  a: ActiveRelics,
  actualRedDamage: number,
  maxHp: number,
): number {
  if (
    !has(a, "vampiric_sigil") ||
    !Number.isFinite(actualRedDamage) ||
    !Number.isFinite(maxHp)
  )
    return 0;
  const fraction = effectValue("vampiric_sigil", rankOf(a, "vampiric_sigil"));
  return Math.max(
    0,
    Math.min(Math.round(actualRedDamage * fraction), Math.floor(maxHp * 0.2)),
  );
}

// ── Pre-run modifiers ────────────────────────────────────────────────────
export function getStartingMana(a: ActiveRelics): number {
  if (!has(a, "aether_spark")) return 0;
  return Math.round(effectValue("aether_spark", rankOf(a, "aether_spark")));
}

export function getStartingShieldTurns(a: ActiveRelics): number {
  if (!has(a, "iron_resolve")) return 0;
  return Math.round(effectValue("iron_resolve", rankOf(a, "iron_resolve")));
}

export function getTelegraphReadyEarly(a: ActiveRelics): number {
  // Returns turns of early reveal (0 if not equipped).
  if (!has(a, "foresight")) return 0;
  return Math.round(effectValue("foresight", rankOf(a, "foresight")));
}

export function getSealedTilesSpeedup(a: ActiveRelics): number {
  if (!has(a, "keysight")) return 0;
  return Math.round(effectValue("keysight", rankOf(a, "keysight")));
}

/** Each eligible source is free; other corrupted runes still deal their bite. */
export function cleansingTouchHpCost(
  a: ActiveRelics,
  hpCost: number,
  sourcesCleared: number,
  sourcesClearedBefore: number,
  damagePerSource: number,
): number {
  if (!has(a, "cleansing_touch")) return hpCost;
  const freeSources = Math.max(
    0,
    Math.round(effectValue("cleansing_touch", rankOf(a, "cleansing_touch"))) -
      sourcesClearedBefore,
  );
  return Math.max(
    0,
    hpCost - Math.min(freeSources, sourcesCleared) * damagePerSource,
  );
}

// ── Per-chain modifiers (called from RuneDelvePlayPage handleChain) ─────
export interface ChainContext {
  chainType: "red" | "blue" | "green" | "gold";
  length: number;
  redChainCountSoFar: number; // including the current one
  isFirstChainOfRun: boolean;
  hpRatio: number; // 0..1 hero hp / maxHp
  enemyHpRatioBeforeHit: number; // 0..1 of the targeted enemy
  /** Total chains made this run INCLUDING the current one (1-indexed). */
  chainNumberThisRun?: number;
}

export interface ChainMods {
  bonusDamageMult: number; // 1 = no change
  bonusManaFlat: number; // extra mana orbs to add (capped by engine)
  bonusHealFlat: number; // extra HP to heal
  bonusShieldTurns: number; // extra shield turns to add (gold)
  effectiveLengthBonus: number; // adds to length AFTER the chain
  /** % of red-chain damage to lifesteal back as HP (0 = none). */
  lifestealPctOfDamage: number;
  /** Echo multiplier 0..1 — applied as a 2nd resolution of this chain at this strength. */
  echoMult: number;
}

const noop: ChainMods = {
  bonusDamageMult: 1,
  bonusManaFlat: 0,
  bonusHealFlat: 0,
  bonusShieldTurns: 0,
  effectiveLengthBonus: 0,
  lifestealPctOfDamage: 0,
  echoMult: 0,
};

/**
 * Apply a "+X% to chain effect" multiplier (Mirror Shard / Void Pact) as a
 * GUARANTEED per-type bonus. Red scales damage directly. Non-red chains used to
 * route through `effectiveLengthBonus`, which only mattered when it happened to
 * cross a discrete threshold (mana-5, floor(len/3) shield) — so most blue/gold
 * procs did nothing. This grants a concrete flat bonus every time instead.
 */
function applyUniversalMult(
  m: ChainMods,
  type: ChainContext["chainType"],
  length: number,
  mult: number,
): void {
  const pct = Math.max(0, mult - 1); // 0.30 .. 0.50
  switch (type) {
    case "red":
      m.bonusDamageMult *= mult;
      break;
    case "blue":
      // +1 mana orb (mana is coarse; the engine still clamps to MAX_MANA).
      m.bonusManaFlat += 1;
      break;
    case "green":
      // Heal a slice of the chain's rough value (6 HP/rune baseline).
      m.bonusHealFlat += Math.max(1, Math.round(pct * length * 6));
      break;
    case "gold":
      // At least +1 shield turn, scaling up with the multiplier.
      m.bonusShieldTurns += Math.max(1, Math.round(pct * 4));
      break;
  }
}

export function computeChainMods(
  a: ActiveRelics,
  ctx: ChainContext,
): ChainMods {
  const m: ChainMods = { ...noop };

  if (ctx.chainType === "red") {
    if (has(a, "ember_edge") && ctx.redChainCountSoFar === 1) {
      m.bonusDamageMult *= effectValue("ember_edge", rankOf(a, "ember_edge"));
    }
    if (
      has(a, "crimson_tide") &&
      ctx.redChainCountSoFar > 0 &&
      ctx.redChainCountSoFar % 3 === 0
    ) {
      m.bonusDamageMult *= effectValue(
        "crimson_tide",
        rankOf(a, "crimson_tide"),
      );
    }
    if (has(a, "executioners_mark") && ctx.enemyHpRatioBeforeHit <= 0.25) {
      m.bonusDamageMult *= effectValue(
        "executioners_mark",
        rankOf(a, "executioners_mark"),
      );
    }
    if (has(a, "desperate_surge") && ctx.hpRatio < 0.3) {
      m.bonusDamageMult *= effectValue(
        "desperate_surge",
        rankOf(a, "desperate_surge"),
      );
    }
    if (has(a, "vampiric_sigil")) {
      m.lifestealPctOfDamage = effectValue(
        "vampiric_sigil",
        rankOf(a, "vampiric_sigil"),
      );
    }
  }
  if (ctx.chainType === "blue") {
    if (has(a, "sapphire_flow") && ctx.length >= 4) {
      m.bonusManaFlat += Math.round(
        effectValue("sapphire_flow", rankOf(a, "sapphire_flow")),
      );
    }
  }
  if (ctx.chainType === "green") {
    if (has(a, "verdant_heart")) {
      // Heal = round(multiplier * length), e.g. R3 (1.2) on len 5 -> 6 HP.
      const mult = effectValue("verdant_heart", rankOf(a, "verdant_heart"));
      m.bonusHealFlat += Math.round(mult * ctx.length);
    }
  }
  if (ctx.chainType === "gold") {
    if (has(a, "bulwark")) {
      m.bonusShieldTurns += Math.round(
        effectValue("bulwark", rankOf(a, "bulwark")),
      );
    }
  }
  if (has(a, "quickstep") && ctx.isFirstChainOfRun) {
    m.effectiveLengthBonus += Math.round(
      effectValue("quickstep", rankOf(a, "quickstep")),
    );
  }
  // Mirror Shard — every 2nd chain (1-indexed: 2, 4, 6, ...) gets a bump.
  const chainNum = ctx.chainNumberThisRun ?? 0;
  if (has(a, "mirror_shard") && chainNum > 0 && chainNum % 2 === 0) {
    applyUniversalMult(
      m,
      ctx.chainType,
      ctx.length,
      effectValue("mirror_shard", rankOf(a, "mirror_shard")),
    );
  }
  // Rune Echo — every 4th chain (4, 8, 12, ...) echoes its effect.
  if (has(a, "rune_echo") && chainNum > 0 && chainNum % 4 === 0) {
    m.echoMult = effectValue("rune_echo", rankOf(a, "rune_echo"));
  }
  // Void Pact — universal +X% to chain effect.
  if (has(a, "void_pact")) {
    applyUniversalMult(
      m,
      ctx.chainType,
      ctx.length,
      effectValue("void_pact", rankOf(a, "void_pact")),
    );
  }

  return m;
}

// ── Post-kill (Bloodbond) ────────────────────────────────────────────────
export function onEnemyKilled(
  a: ActiveRelics,
  state: CombatState,
): CombatState {
  if (!has(a, "bloodbond") || state.hp <= 0) return state;
  const target = Math.round(effectValue("bloodbond", rankOf(a, "bloodbond")));
  const heal = Math.min(target, state.maxHp - state.hp);
  if (heal <= 0) return state;
  return { ...state, hp: state.hp + heal };
}

// ── Lethal-damage save (Last Stand) — engine should call before zeroing HP
export interface LastStandResult {
  saved: boolean;
  hp: number;
}
export function tryLastStand(
  a: ActiveRelics,
  incomingFinalHp: number,
  alreadyUsedCount: boolean | number,
): LastStandResult {
  if (!has(a, "last_stand")) return { saved: false, hp: incomingFinalHp };
  const maxUses = Math.round(
    effectValue("last_stand", rankOf(a, "last_stand")),
  );
  const usedCount =
    typeof alreadyUsedCount === "boolean"
      ? alreadyUsedCount
        ? 1
        : 0
      : alreadyUsedCount;
  if (usedCount >= maxUses) return { saved: false, hp: incomingFinalHp };
  if (incomingFinalHp <= 0) return { saved: true, hp: 1 };
  return { saved: false, hp: incomingFinalHp };
}

// ── Ability cost (First Light) ───────────────────────────────────────────
export function abilityFreeFirstUse(
  a: ActiveRelics,
  abilityUsedCount: boolean | number,
): boolean {
  if (!has(a, "first_light")) return false;
  const freeUses = Math.round(
    effectValue("first_light", rankOf(a, "first_light")),
  );
  const used =
    typeof abilityUsedCount === "boolean"
      ? abilityUsedCount
        ? 1
        : 0
      : abilityUsedCount;
  return used < freeUses;
}

// ── Boss-rule incoming damage soften (Cracked Crown) ────────────────────
export function bossRuleSoften(a: ActiveRelics): number {
  if (!has(a, "cracked_crown")) return 1;
  return effectValue("cracked_crown", rankOf(a, "cracked_crown"));
}

// ── Shrine Ward (early-game incoming damage on turn 1) ──────────────────
export function shrineWardTurn1Mult(
  a: ActiveRelics,
  isTurnOne: boolean,
): number {
  if (!has(a, "shrine_ward") || !isTurnOne) return 1;
  return effectValue("shrine_ward", rankOf(a, "shrine_ward"));
}

// ── Score-end mods ──────────────────────────────────────────────────────
export function compassShardBonus(a: ActiveRelics): number {
  if (!has(a, "wanderers_compass")) return 1;
  return effectValue("wanderers_compass", rankOf(a, "wanderers_compass"));
}

export function momentumScoreBonusMult(
  a: ActiveRelics,
  longestChain: number,
): number {
  if (!has(a, "momentum") || longestChain < 4) return 1;
  return effectValue("momentum", rankOf(a, "momentum"));
}

// ── Spiked Aegis + Brambleward (extra Thorns multiplier on shielded hits) ─
// Both relics compose multiplicatively on top of the class base thorns rate.
export function thornsRelicMultiplier(a: ActiveRelics): number {
  let mult = 1;
  if (has(a, "spiked_aegis"))
    mult *= effectValue("spiked_aegis", rankOf(a, "spiked_aegis"));
  if (has(a, "brambleward"))
    mult *= effectValue("brambleward", rankOf(a, "brambleward"));
  return mult;
}

// ── Foreseer's Lens — bonus turns added to every level's turn limit ──────
export function getForeseerBonusTurns(a: ActiveRelics): number {
  if (!has(a, "foreseers_lens")) return 0;
  return Math.round(effectValue("foreseers_lens", rankOf(a, "foreseers_lens")));
}

// ── Void Pact — sacrifice max HP at run start in exchange for damage mult.
// Returns the flat HP to subtract from both maxHp and starting hp.
export function getVoidPactHpCost(a: ActiveRelics): number {
  if (!has(a, "void_pact")) return 0;
  return 10;
}

// ── Phoenix Heart — full revive once per run on lethal damage. Returns the
// HP to revive at, or null if not equipped / already used.
export function tryPhoenixHeart(
  a: ActiveRelics,
  maxHp: number,
  alreadyUsed: boolean,
): number | null {
  if (!has(a, "phoenix_heart") || alreadyUsed) return null;
  const frac = effectValue("phoenix_heart", rankOf(a, "phoenix_heart"));
  return Math.max(1, Math.round(maxHp * frac));
}
