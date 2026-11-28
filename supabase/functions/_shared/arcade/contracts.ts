/** The public arcade contract is shared by the browser and Edge Function. */
export interface ArcadeScope {
  clubId: string;
  gameKey: string;
  rulesetVersion: string;
}

export type ArcadePeriod = 'all_time' | 'week' | 'today';

export interface ArcadeBoardEntry {
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  wave: number;
  achievedAt: string;
  isMe: boolean;
}

export interface ArcadeBoard {
  period: ArcadePeriod;
  entries: ArcadeBoardEntry[];
  personalBest: ArcadeBoardEntry | null;
  totalMembers: number;
}

export interface ArcadeSummary {
  score: number;
  wave: number;
  kills: number;
  simulationTicks: number;
}

export interface ArcadeVerifiedResult extends ArcadeSummary {
  status: 'verified';
  personalBest: number;
  isPersonalBest: boolean;
  rank: number;
  previousRank: number | null;
  rankChange: number | null;
  leaderboard: ArcadeBoard;
}

export type ArcadeStatus = 'started' | 'submitted' | 'verified' | 'rejected' | 'expired';

export interface ArcadeRunSession extends ArcadeScope {
  runId: string;
  seed: string;
  startedAt: string;
  expiresAt: string;
  status: ArcadeStatus;
  rejectionCode?: string | null;
  result?: ArcadeVerifiedResult | null;
}
