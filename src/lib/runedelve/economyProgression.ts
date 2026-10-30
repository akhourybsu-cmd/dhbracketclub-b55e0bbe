import { failureMultiplier, failureProgress } from "./shardEconomy";

export interface CampaignXpArgs {
  levelNumber: number;
  score: number;
  cleared: boolean;
  isFirstClear: boolean;
  previousBestScore?: number;
  failureCount?: number;
  enemiesKilled?: number;
  totalEnemies?: number;
  turnsUsed?: number;
  turnLimit?: number;
  bossPhaseReached?: number;
  bossHasRule?: boolean;
  meaningful?: boolean;
}

/** XP follows the encounter played; a one-point record cannot repay a full clear. */
export function campaignXpForAttempt(args: CampaignXpArgs): number {
  if (args.meaningful === false) return 0;
  const depth = Math.max(1, Math.min(150, Math.floor(args.levelNumber)));
  const base =
    30 +
    Math.floor(Math.max(0, depth - 50) * 1.2) +
    Math.min(10, Math.floor(Math.max(0, args.score) / 1000));
  if (args.cleared) {
    if (args.isFirstClear) return base + (depth % 25 === 0 ? 25 : 0);
    const improvement = Math.max(
      0,
      args.score - (args.previousBestScore ?? args.score),
    );
    return (
      Math.max(8, Math.min(45, Math.round(base * 0.25))) +
      Math.min(20, Math.floor(improvement / 100))
    );
  }
  const progress = failureProgress({
    enemiesKilled: args.enemiesKilled ?? 0,
    totalEnemies: args.totalEnemies ?? 1,
    turnsUsed: args.turnsUsed ?? 0,
    turnLimit: args.turnLimit ?? 18,
    bossPhaseReached: args.bossPhaseReached ?? 0,
    bossHasRule: args.bossHasRule ?? false,
  });
  return Math.max(
    1,
    Math.round(
      base * 0.2 * progress * failureMultiplier(args.failureCount ?? 1),
    ),
  );
}

/** Daily improvements pay the missing portion, with a single bounded daily total. */
export function dailyRewardDelta(
  best: { shards: number; xp: number },
  paid: { shards: number; xp: number },
): { shards: number; xp: number } {
  return {
    shards: Math.max(0, Math.min(900, best.shards) - Math.max(0, paid.shards)),
    xp: Math.max(0, Math.min(500, best.xp) - Math.max(0, paid.xp)),
  };
}
