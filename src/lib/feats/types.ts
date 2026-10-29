export type FeatKind = "volume" | "mastery" | "variety";
export interface FeatDefinition {
  key: string;
  category: string;
  title: string;
  description: string;
  thresholds: number[];
  points: number[];
  kind: FeatKind;
  unit: "count" | "money" | "percent" | "minutes" | "miles";
  sort_order: number;
}
export interface FeatUnlock {
  feat_key: string;
  tier: number;
  points: number;
  target: number;
  earned_at: string;
  historical: boolean;
}
export interface FeatLeader {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  unlocked: number;
  rank: number;
}
export interface FeatBoard {
  version: number;
  as_of: string;
  seen_at: string;
  pinned: string[];
  score: number;
  unlocked: number;
  catalog: FeatDefinition[];
  progress: Record<string, number>;
  unlocks: FeatUnlock[];
  leaders: FeatLeader[];
  monthly_leaders: FeatLeader[];
  me: FeatLeader | null;
  monthly_me: FeatLeader | null;
  members: number;
}
export interface DHScoreSummary {
  score: number;
  unlocked: number;
}
