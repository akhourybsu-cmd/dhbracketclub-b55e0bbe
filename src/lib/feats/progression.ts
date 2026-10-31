import type { FeatBoard, FeatDefinition, FeatUnlock } from "./types";

export const FEAT_TIERS = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Mythic",
] as const;
export const FEAT_CATEGORIES: Record<
  string,
  { name: string; asset?: string; path: string; icon: string }
> = {
  club: { name: "DH Club", path: "/club", icon: "Sparkles" },
  drop: {
    name: "The Drop",
    asset: "daily-find",
    path: "/finds",
    icon: "Bookmark",
  },
  posts: {
    name: "Posts",
    asset: "posts",
    path: "/posts",
    icon: "MessageSquare",
  },
  lore: { name: "Lore", asset: "lore", path: "/lore", icon: "ScrollText" },
  polls: { name: "Polls", asset: "polls", path: "/polls", icon: "Vote" },
  rankings: {
    name: "Rankings",
    asset: "rankings",
    path: "/rankings",
    icon: "ListOrdered",
  },
  draft: {
    name: "Draft Arena",
    asset: "draft-arena",
    path: "/drafts",
    icon: "Trophy",
  },
  nexus: {
    name: "Nexus Defense",
    asset: "nexus-defense",
    path: "/nexus",
    icon: "Shield",
  },
  rune: {
    name: "Rune Delve",
    asset: "rune-delve",
    path: "/rune-delve",
    icon: "Swords",
  },
  forge: {
    name: "FORGE",
    asset: "workout-competition",
    path: "/workouts",
    icon: "Flame",
  },
  portfolio: {
    name: "Portfolio Wars",
    asset: "portfolio-wars",
    path: "/portfolio-wars",
    icon: "TrendingUp",
  },
  readshift: {
    name: "READSHIFT",
    asset: "readshift",
    path: "/readshift",
    icon: "ScanEye",
  },
  nfl: {
    name: "NFL Game Center",
    asset: "nfl-pickem",
    path: "/nfl",
    icon: "Goal",
  },
  brackets: {
    name: "Brackets",
    asset: "brackets",
    path: "/brackets",
    icon: "GitBranch",
  },
  lockbox: {
    name: "Lockbox",
    asset: "lockbox",
    path: "/lockbox",
    icon: "KeyRound",
  },
  events: {
    name: "Events",
    asset: "events",
    path: "/events",
    icon: "CalendarDays",
  },
  narrative: {
    name: "Narrative RPG",
    asset: "narrative-rpg",
    path: "/narrative",
    icon: "BookOpen",
  },
  journey: {
    name: "Splendid Journey",
    asset: "splendid-journey",
    path: "/journey",
    icon: "Compass",
  },
};
/** Feature action for a selected goal, including mode-specific collections. */
export function featActionPath(
  feat: Pick<FeatDefinition, "key" | "category">,
): string {
  if (feat.key.startsWith("rune_puzzle_")) return "/rune-delve/journey";
  if (feat.key.startsWith("rune_expedition_")) return "/rune-delve/expedition";
  if (feat.category === "rune") return "/rune-delve/legacy";
  return FEAT_CATEGORIES[feat.category]?.path || "/club";
}

const RANKS = [
  { name: "Newcomer", score: 0 },
  { name: "Regular", score: 250 },
  { name: "Contender", score: 750 },
  { name: "Veteran", score: 1500 },
  { name: "All-Star", score: 3000 },
  { name: "Legend", score: 6000 },
  { name: "DH Icon", score: 10000 },
];
const safe = (n: number) =>
  Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0;
export function dhRank(score: number) {
  const total = safe(score);
  let index = 0;
  RANKS.forEach((r, i) => {
    if (total >= r.score) index = i;
  });
  const rank = RANKS[index],
    next = RANKS[index + 1] || null;
  return {
    ...rank,
    level: index + 1,
    next,
    remaining: next ? next.score - total : 0,
    progress: next ? (total - rank.score) / (next.score - rank.score) : 1,
  };
}
export function featProgress(
  def: FeatDefinition,
  value: number,
  unlocks: FeatUnlock[],
) {
  const earned = unlocks.filter((u) => u.feat_key === def.key),
    tiers = new Set(earned.map((u) => u.tier));
  const next = def.thresholds.findIndex((_, i) => !tiers.has(i + 1)),
    maxed = next < 0;
  const index = maxed ? def.thresholds.length - 1 : next,
    target = def.thresholds[index];
  // Saved receipts are permanent, even if the original content is removed.
  const current = Math.max(
    safe(value),
    ...earned.map((u) => safe(u.target)),
    0,
  );
  const floor = index > 0 ? def.thresholds[index - 1] : 0;
  return {
    earned: earned.length,
    maxed,
    index,
    tier: FEAT_TIERS[index],
    target,
    current,
    progress: maxed
      ? 1
      : Math.max(0, Math.min(1, (current - floor) / (target - floor))),
    points: def.points[index] || 0,
    earnedPoints: earned.reduce((sum, u) => sum + safe(u.points), 0),
  };
}
export function formatFeatValue(
  value: number,
  unit: FeatDefinition["unit"],
  compact = false,
) {
  const n = safe(value),
    formatted = new Intl.NumberFormat("en-US", {
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: unit === "count" || unit === "money" ? 0 : 1,
    }).format(n);
  return unit === "money"
    ? "$" + formatted
    : unit === "percent"
      ? formatted + "%"
      : unit === "minutes"
        ? formatted + " min"
        : unit === "miles"
          ? formatted + " mi"
          : formatted;
}
export function nextFeats(board: FeatBoard, available: FeatDefinition[]) {
  return available
    .filter((f) => !featProgress(f, board.progress[f.key], board.unlocks).maxed)
    .sort(
      (a, b) =>
        featProgress(b, board.progress[b.key], board.unlocks).progress -
          featProgress(a, board.progress[a.key], board.unlocks).progress ||
        a.sort_order - b.sort_order,
    );
}
export function unseenFeats(board: FeatBoard) {
  return board.unlocks.filter(
    (u) => !u.historical && Date.parse(u.earned_at) > Date.parse(board.seen_at),
  );
}
