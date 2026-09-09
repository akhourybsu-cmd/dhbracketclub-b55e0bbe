// Per-run snapshot persistence for Rune Delve so backgrounding the WebView
// (especially on iOS PWAs) doesn't wipe live combat state.
//
// We serialize to sessionStorage under a per-user + per-class + per-level key, with
// JSON-safe conversions for Set / Map. Runs are tied to a level's
// `generation_seed` so a re-seed (admin reseed, schema change) safely bails
// to a fresh board instead of restoring stale state.

import type { RuneType } from './dungeonGenerator';
import type { CombatState } from './combatEngine';
import type { CorruptionState } from './corruptedTiles';
import type { ActiveRelics } from './relicEffects';
import type { CombatLogEntry } from '@/components/runedelve/CombatLog';

// v2 rejects snapshots created before run initialization waited for the full
// loadout/relic/mastery build, preventing an accidentally empty build restore.
export const SNAPSHOT_VERSION = 2;
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
}

export function snapshotKey(userId: string, levelId: string, heroClass: string): string {
  return `rd-run:${userId}:${heroClass}:${levelId}`;
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
    const originalId = typeof entry.id === 'string' && entry.id.length > 0
      ? entry.id
      : 'log';
    let repairedId = originalId;
    if (seenLogIds.has(repairedId)) {
      repairedId = `${originalId}-${snapshotNonce}-${index}`;
      while (seenLogIds.has(repairedId)) repairedId += '-r';
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
    if (Date.now() - parsed.savedAt > SNAPSHOT_MAX_AGE_MS) return null;

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
  stored: RunSnapshot['activeRelicsSnapshot'],
): ActiveRelics | null {
  if (!stored) return null;
  return {
    ranks: new Map(stored.ranks),
  };
}
