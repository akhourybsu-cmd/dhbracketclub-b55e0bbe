// Per-run snapshot persistence for Rune Delve so backgrounding the WebView
// (especially on iOS PWAs) doesn't wipe live combat state.
//
// We serialize to sessionStorage under a per-user + per-class + per-level key, with
// JSON-safe conversions for Set / Map. Runs are tied to a level's
// `generation_seed` so a re-seed (admin reseed, schema change) safely bails
// to a fresh board instead of restoring stale state.

import type { RuneType } from "./dungeonGenerator";
import type { CombatState } from "./combatEngine";
import type { CorruptionState } from "./corruptedTiles";
import type { ActiveRelics } from "./relicEffects";
import type { MasteryId } from "./classMastery";
import type { BossPhaseIndex } from "./bossPhases";
import type { CombatLogEntry } from "@/components/runedelve/CombatLog";
import type { SubmitLevelRunInput } from "@/hooks/useRuneDelveCampaign";

export interface PendingCampaignSettlement {
  input: SubmitLevelRunInput;
  cleared: boolean;
  totals: {
    goldRunesCleared: number;
    bonusShardsFromMastery: number;
    bonusScoreFromTreasure: number;
    bonusShardsFromTreasure: number;
    abilityUsedCount: number;
  };
  display: {
    cleared: boolean;
    reason: "cleared" | "defeated" | "timeout";
    score: number;
    isNewBest: boolean;
    shards: number;
  };
}

// v3 saves all board mechanics and one-use counters. Older local checkpoints
// cannot reconstruct consumed twins/treasure or revive usage honestly. Persistent
// campaign, class, wallet and collection progress are unaffected.
export const SNAPSHOT_VERSION = 3;
export const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

export interface RunSnapshot {
  version: number;
  levelNumber: number;
  generationSeed: number;
  savedAt: number;
  grid: RuneType[][];
  combat: CombatState;
  /** Actual opening turn budget after relic/daily bonuses. */
  initialTurns?: number;
  seals: string[];
  corruption: { cells: string[]; sources: string[] };
  log: CombatLogEntry[];
  lastStandUsed: number;
  /** Phoenix Heart single-use revive flag (optional for back-compat). */
  phoenixUsed?: boolean;
  bonusUsedThisCycle: boolean;
  redChainCount: number;
  chainCountTotal: number;
  abilityUsedCount: number;
  corruptCleansedCount: number;
  defeatedArchetypes: Array<[string, number]>;
  wavesSpawned: number;
  rngTick: number;
  // Stored as JSON-safe shape — relic ranks Map flattened to entries.
  activeRelicsSnapshot: {
    ranks: Array<[string, number]>;
  } | null;
  /** R3: id of the active run modifier ("steady_path" if none).
   *  Optional for back-compat with snapshots written before R3 shipped —
   *  loaders treat absence as Steady Path so old snapshots resume safely. */
  activeModifierId?: string;
  pendingModifierOfferIds?: string[];
  /** Complete run-local state: restoring a page must not restore spent powers. */
  shiftingColumn?: number;
  linkedPairs?: Array<[string, string]>;
  eclipsedCells?: string[];
  chainsThisFight?: number;
  bonusShardsFromMastery?: number;
  bonusScoreFromTreasure?: number;
  bonusShardsFromTreasure?: number;
  totalManaSpent?: number;
  goldRunesCleared?: number;
  braceFired?: boolean;
  aegisFired?: boolean;
  tookDamage?: boolean;
  masteryIds?: MasteryId[];
  bossPhases?: Array<[string, BossPhaseIndex]>;
  pendingSettlement?: PendingCampaignSettlement;
}

export function snapshotKey(
  userId: string,
  levelId: string,
  heroClass: string,
  variant?: string,
): string {
  return `rd-run:${userId}:${heroClass}:${levelId}${variant ? `:${encodeURIComponent(variant)}` : ""}`;
}

export interface BuildSnapshotInput {
  levelNumber: number;
  generationSeed: number;
  grid: RuneType[][];
  combat: CombatState;
  initialTurns?: number;
  seals: Set<string>;
  corruption: CorruptionState;
  log: CombatLogEntry[];
  lastStandUsed: number;
  phoenixUsed?: boolean;
  bonusUsedThisCycle: boolean;
  redChainCount: number;
  chainCountTotal: number;
  abilityUsedCount: number;
  corruptCleansedCount: number;
  defeatedArchetypes: Map<string, number>;
  wavesSpawned: number;
  rngTick: number;
  activeRelicsSnapshot: ActiveRelics | null;
  /** R3 modifier id — see RunSnapshot. */
  activeModifierId?: string;
  pendingModifierOfferIds?: string[];
  /** Complete run-local state: restoring a page must not restore spent powers. */
  shiftingColumn?: number;
  linkedPairs?: Array<[string, string]>;
  eclipsedCells?: string[];
  chainsThisFight?: number;
  bonusShardsFromMastery?: number;
  bonusScoreFromTreasure?: number;
  bonusShardsFromTreasure?: number;
  totalManaSpent?: number;
  goldRunesCleared?: number;
  braceFired?: boolean;
  aegisFired?: boolean;
  tookDamage?: boolean;
  masteryIds?: MasteryId[];
  bossPhases?: Array<[string, BossPhaseIndex]>;
  pendingSettlement?: PendingCampaignSettlement;
}

export function buildSnapshot(input: BuildSnapshotInput): RunSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    levelNumber: input.levelNumber,
    generationSeed: input.generationSeed,
    savedAt: Date.now(),
    grid: input.grid,
    combat: input.combat,
    initialTurns: input.initialTurns ?? input.combat.turnsRemaining,
    seals: Array.from(input.seals),
    corruption: {
      cells: Array.from(input.corruption.cells),
      sources: Array.from(input.corruption.sources),
    },
    log: input.log,
    lastStandUsed: input.lastStandUsed,
    phoenixUsed: input.phoenixUsed ?? false,
    bonusUsedThisCycle: input.bonusUsedThisCycle,
    redChainCount: input.redChainCount,
    chainCountTotal: input.chainCountTotal,
    abilityUsedCount: input.abilityUsedCount,
    corruptCleansedCount: input.corruptCleansedCount,
    defeatedArchetypes: Array.from(input.defeatedArchetypes.entries()),
    wavesSpawned: input.wavesSpawned,
    rngTick: input.rngTick,
    activeRelicsSnapshot: input.activeRelicsSnapshot
      ? {
          ranks: Array.from(input.activeRelicsSnapshot.ranks.entries()),
        }
      : null,
    activeModifierId: input.activeModifierId,
    pendingModifierOfferIds: input.pendingModifierOfferIds,
    shiftingColumn: input.shiftingColumn ?? -1,
    linkedPairs: input.linkedPairs ?? [],
    eclipsedCells: input.eclipsedCells ?? [],
    chainsThisFight: input.chainsThisFight ?? 0,
    bonusShardsFromMastery: input.bonusShardsFromMastery ?? 0,
    bonusScoreFromTreasure: input.bonusScoreFromTreasure ?? 0,
    bonusShardsFromTreasure: input.bonusShardsFromTreasure ?? 0,
    totalManaSpent: input.totalManaSpent ?? 0,
    goldRunesCleared: input.goldRunesCleared ?? 0,
    braceFired: input.braceFired ?? false,
    aegisFired: input.aegisFired ?? false,
    tookDamage: input.tookDamage ?? false,
    masteryIds: input.masteryIds ?? [],
    bossPhases: input.bossPhases,
    pendingSettlement: input.pendingSettlement,
  };
}

export function saveSnapshot(key: string, snapshot: RunSnapshot): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    /* sessionStorage may be unavailable / quota exceeded */
  }
}

export function ensureUniqueCombatLogIds(
  log: CombatLogEntry[],
  snapshotNonce: number,
): CombatLogEntry[] {
  const seenLogIds = new Set<string>();
  return log.map((entry, index) => {
    const originalId =
      typeof entry.id === "string" && entry.id.length > 0 ? entry.id : "log";
    let repairedId = originalId;
    if (seenLogIds.has(repairedId)) {
      repairedId = `${originalId}-${snapshotNonce}-${index}`;
      while (seenLogIds.has(repairedId)) repairedId += "-r";
    }
    seenLogIds.add(repairedId);
    return repairedId === entry.id ? entry : { ...entry, id: repairedId };
  });
}

export function loadSnapshot(
  key: string,
  expectedSeed: number,
): RunSnapshot | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RunSnapshot;
    if (!parsed || parsed.version !== SNAPSHOT_VERSION) return null;
    if (parsed.generationSeed !== expectedSeed) return null;
    if (
      !Number.isFinite(parsed.savedAt) ||
      Date.now() - parsed.savedAt > SNAPSHOT_MAX_AGE_MS ||
      parsed.savedAt > Date.now() + 60_000
    )
      return null;
    if (
      !Array.isArray(parsed.grid) ||
      parsed.grid.length !== 5 ||
      parsed.grid.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== 5 ||
          row.some((rune) => !["red", "blue", "green", "gold"].includes(rune)),
      )
    )
      return null;
    if (
      !parsed.combat ||
      !Number.isFinite(parsed.combat.hp) ||
      !Number.isFinite(parsed.combat.turnsRemaining) ||
      !Array.isArray(parsed.combat.enemies)
    )
      return null;
    if (
      !Array.isArray(parsed.seals) ||
      !parsed.corruption ||
      !Array.isArray(parsed.corruption.cells) ||
      !Array.isArray(parsed.corruption.sources)
    )
      return null;
    if (
      parsed.bossPhases !== undefined &&
      (!Array.isArray(parsed.bossPhases) ||
        parsed.bossPhases.some(
          (entry) =>
            !Array.isArray(entry) ||
            entry.length !== 2 ||
            typeof entry[0] !== "string" ||
            ![1, 2, 3].includes(entry[1]),
        ))
    )
      return null;
    if (parsed.pendingSettlement !== undefined) {
      const pending = parsed.pendingSettlement;
      if (
        !pending ||
        !pending.input ||
        !pending.totals ||
        !pending.display ||
        typeof pending.input.level_id !== "string" ||
        typeof pending.input.hero_class !== "string" ||
        typeof pending.cleared !== "boolean" ||
        !Number.isFinite(pending.input.score) ||
        !Number.isFinite(pending.display.score) ||
        !Number.isFinite(pending.display.shards) ||
        [
          pending.totals.goldRunesCleared,
          pending.totals.bonusShardsFromMastery,
          pending.totals.bonusScoreFromTreasure,
          pending.totals.bonusShardsFromTreasure,
          pending.totals.abilityUsedCount,
        ].some((value) => !Number.isFinite(value) || value < 0)
      )
        return null;
    }

    // Older hot-reloaded sessions could persist repeated short ids such as
    // `l-1`. Framer Motion requires stable, unique keys for every animated
    // chronicle row, so repair only collisions while preserving valid ids.
    parsed.log = ensureUniqueCombatLogIds(
      Array.isArray(parsed.log) ? parsed.log : [],
      parsed.savedAt,
    );

    return parsed;
  } catch {
    return null;
  }
}

export function clearSnapshot(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export function rehydrateRelics(
  stored: RunSnapshot["activeRelicsSnapshot"],
): ActiveRelics | null {
  if (!stored) return null;
  return {
    ranks: new Map(stored.ranks),
  };
}
