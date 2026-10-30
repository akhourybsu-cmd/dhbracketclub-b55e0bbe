// ─── Rune Shards economy ──────────────────────────────────────────────────
// Shard rewards for clears, replays, and failed attempts.
// Failure rewards use diminishing returns per-level so retries always pay
// SOMETHING (anti-frustration) but pure farming dies off fast.

export interface ClearShardArgs {
  levelNumber: number;
  isFirstClear: boolean;
  bossClear: boolean; // L25/50/75/100/125/150
  chapterCleared: boolean; // first time finishing a chapter
  compassEquipped: boolean; // Wanderer's Compass relic equipped
  /** Wanderer's Compass rank-aware multiplier (1.15 R1 → 1.27 R5). When
   *  omitted but `compassEquipped`, defaults to 1.15. */
  compassMultiplier?: number;
}

export interface FailShardArgs {
  levelNumber: number;
  failureCount: number; // count INCLUDING this failure
  enemiesKilled: number;
  totalEnemies: number;
  turnsUsed: number;
  turnLimit: number;
  bossPhaseReached: number; // 0..3
  bossHasRule: boolean;
  compassEquipped: boolean;
  compassMultiplier?: number;
}

export interface ShardBreakdown {
  base: number;
  bonuses: { label: string; amount: number }[];
  multiplier: number; // diminishing-returns or compass
  total: number;
}

// Early-game (L1-15) gets a flat +5 bump so the first relic is reachable
// in ~6-8 clears instead of ~12. Beyond L15 the curve is unchanged.
const baseClearValue = (level: number) => 10 + level + (level <= 15 ? 5 : 0);
const baseReplayValue = (level: number) => 6 + Math.floor(level / 5);

export function computeClearShards(args: ClearShardArgs): ShardBreakdown {
  const base = args.isFirstClear
    ? baseClearValue(args.levelNumber)
    : baseReplayValue(args.levelNumber);
  const bonuses: { label: string; amount: number }[] = [];
  if (args.bossClear) bonuses.push({ label: "Boss bonus", amount: args.isFirstClear ? 50 : 8 });
  if (args.chapterCleared && args.isFirstClear)
    bonuses.push({ label: "Chapter complete", amount: 200 });
  const multiplier = args.compassEquipped
    ? (args.compassMultiplier ?? 1.15)
    : 1;
  const subtotal = base + bonuses.reduce((s, b) => s + b.amount, 0);
  const total = Math.max(1, Math.round(subtotal * multiplier));
  return { base, bonuses, multiplier, total };
}

// Diminishing returns curve per level — resets when the level is cleared.
// 1st: 100%, 2nd: 70%, 3rd: 50%, 4th: 30%, 5th+: 15%
export function failureMultiplier(failureCount: number): number {
  if (failureCount <= 1) return 1.0;
  if (failureCount === 2) return 0.7;
  if (failureCount === 3) return 0.5;
  if (failureCount === 4) return 0.3;
  return 0.15;
}

export function failureProgress(args: Pick<FailShardArgs,
  "enemiesKilled" | "totalEnemies" | "turnsUsed" | "turnLimit" | "bossPhaseReached" | "bossHasRule"
>): number {
  const bounded = (value: number) => Math.max(0, Math.min(1, value));
  const enemy = args.totalEnemies > 0 ? bounded(args.enemiesKilled / args.totalEnemies) : 0;
  const turns = args.turnLimit > 0 ? bounded(args.turnsUsed / args.turnLimit) : 0;
  const boss = args.bossHasRule ? bounded(args.bossPhaseReached / 3) : enemy;
  return 0.4 + 0.6 * (enemy * 0.4 + boss * 0.4 + turns * 0.2);
}

export function computeFailureShards(args: FailShardArgs): ShardBreakdown {
  // Progress factor 0.4..1.0 — even a feeble attempt earns something (40%).
  const progress = failureProgress(args);

  // Gentle: 20% of clear value scaled by progress.
  const baseClearVal = baseClearValue(args.levelNumber);
  const base = Math.max(1, Math.round(baseClearVal * 0.2 * progress));

  const dimMult = failureMultiplier(args.failureCount);
  const compassMult = args.compassEquipped
    ? (args.compassMultiplier ?? 1.15)
    : 1;
  const multiplier = dimMult * compassMult;

  const bonuses: { label: string; amount: number }[] = [];
  // Surface the diminishing curve subtly in the breakdown when it kicks in.
  if (dimMult < 1) {
    const note = `Repeat fail ×${dimMult.toFixed(2)}`;
    bonuses.push({ label: note, amount: 0 });
  }

  const total = Math.max(1, Math.round(base * multiplier));
  return { base, bonuses, multiplier, total };
}

// Slot-unlock threshold: any class hitting THIRD_SLOT_UNLOCK_LEVEL grants a
// hero-wide 3rd relic slot. Tied to per-class XP (combat investment), not
// dungeon progression — rewards mastery of a chosen class.
export const THIRD_SLOT_UNLOCK_LEVEL = 25;
export function slotsForClassLevels(maxClassLevel: number): number {
  return maxClassLevel >= THIRD_SLOT_UNLOCK_LEVEL ? 3 : 2;
}

// Helper used by the Home unlock-banner heuristic.
export function affordableNextRelicCost(
  currentShards: number,
  ownedIds: Set<string>,
): number | null {
  // The cheapest UNOWNED relic the player can afford right now.
  // Live-imported to avoid a circular dep at module top.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { RELIC_CATALOG } = require("./relics");
  const candidates = RELIC_CATALOG.filter(
    (r: { id: string; cost: number }) =>
      !ownedIds.has(r.id) && r.cost <= currentShards,
  ).sort((a: { cost: number }, b: { cost: number }) => b.cost - a.cost);
  return candidates[0]?.cost ?? null;
}
