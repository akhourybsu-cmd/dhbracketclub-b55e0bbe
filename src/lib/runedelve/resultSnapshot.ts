import type { HeroClass } from "./classConfig";

/** The best-run row is merged on every attempt; keep this attempt separate. */
export interface RuneResultSnapshot {
  version: 2;
  userId: string;
  heroClass: HeroClass;
  levelNumber: number;
  ts: number;
  score: number;
  totalDamage: number;
  enemiesDefeated: number;
  hpRemaining: number;
  turnsUsed: number;
  longestChain: number;
  xpEarned: number;
  dungeonCleared: boolean;
  shardsAwarded: number;
  wasNewBest: boolean;
  improvedChain: boolean;
  improvedTurns: boolean;
  improvedHp: boolean;
  firstClear: boolean;
}

export const runeResultKey = (
  userId: string,
  cls: HeroClass,
  levelNumber: number,
) => `rd-result-v2:${userId}:${cls}:${levelNumber}`;

export function parseRuneResult(
  raw: string | null,
  userId: string,
  cls: HeroClass,
  levelNumber: number,
  now = Date.now(),
): RuneResultSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as RuneResultSnapshot;
    if (
      value.version !== 2 ||
      value.userId !== userId ||
      value.heroClass !== cls ||
      value.levelNumber !== levelNumber
    )
      return null;
    if (
      !Number.isFinite(value.ts) ||
      value.ts > now + 60_000 ||
      now - value.ts > 86_400_000
    )
      return null;
    const numbers = [
      value.score,
      value.totalDamage,
      value.enemiesDefeated,
      value.hpRemaining,
      value.turnsUsed,
      value.longestChain,
      value.xpEarned,
      value.shardsAwarded,
    ];
    if (numbers.some((n) => !Number.isFinite(n) || n < 0)) return null;
    const flags = [
      value.dungeonCleared,
      value.wasNewBest,
      value.improvedChain,
      value.improvedTurns,
      value.improvedHp,
      value.firstClear,
    ];
    if (flags.some((flag) => typeof flag !== "boolean")) return null;
    return value;
  } catch {
    return null;
  }
}

export function readRuneResult(
  userId: string,
  cls: HeroClass,
  levelNumber: number,
): RuneResultSnapshot | null {
  try {
    return parseRuneResult(
      sessionStorage.getItem(runeResultKey(userId, cls, levelNumber)),
      userId,
      cls,
      levelNumber,
    );
  } catch {
    return null;
  }
}
