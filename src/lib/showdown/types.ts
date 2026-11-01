import type { PrismAction, PrismDifficulty, PrismPuzzle } from './prism/types';

export type ShowdownStatus = 'pending' | 'active' | 'completed' | 'declined' | 'cancelled' | 'expired';
export interface ShowdownMember { user_id: string; display_name: string; avatar_url: string | null }
export interface ShowdownGame { game_key: string; current_rules_version: number; name: string; description: string; enabled: boolean }
export interface ShowdownRecord { wins: number; losses: number; draws: number; played: number }
export interface ShowdownRivalry extends ShowdownRecord { opponent_id: string; display_name: string; avatar_url: string | null }
export interface ShowdownStanding extends ShowdownRecord, ShowdownMember { points: number }
export interface ShowdownPlayer extends ShowdownMember {
  started_at: string | null; finished_at: string | null; rounds_completed: number;
  total_score: number | null; solved_count: number | null; rotations: number | null;
}
export interface ShowdownChallenge {
  id: string; club_id: string; game_key: string; rules_version: number; status: ShowdownStatus;
  challenger_id: string; recipient_id: string; created_at: string; expires_at: string; completed_at: string | null;
  winner_id: string | null; outcome: 'winner' | 'draw' | null; rematch_of: string | null; players: ShowdownPlayer[];
}
export interface ShowdownRoundState {
  actions: PrismAction[]; revision: number; submitted: boolean; skipped: boolean; solved: boolean;
  score: number | null; rotations: number;
}
export interface ShowdownRound {
  round_number: number; difficulty: PrismDifficulty; puzzle_id: string; puzzle_version: number; title: string;
  puzzle: PrismPuzzle | null; minimum_rotations: number | null; me: ShowdownRoundState; opponent: ShowdownRoundState | null;
}
export interface ShowdownMatchDetail {
  challenge: ShowdownChallenge; rounds: ShowdownRound[]; current_round: number | null;
  can_play: boolean; can_decline: boolean; can_cancel: boolean; readonly_reason: string | null;
  record: ShowdownRecord; rivalry: ShowdownRivalry;
}
export interface ShowdownCursor { created_at: string; id: string }
export interface ShowdownLobbyData {
  games: ShowdownGame[]; members: ShowdownMember[]; challenges: ShowdownChallenge[];
  next_cursor: ShowdownCursor | null; record: ShowdownRecord; rivalries: ShowdownRivalry[]; standings: ShowdownStanding[];
}
export interface ShowdownCreateInput { recipientId: string; gameKey: string; requestId?: string; rematchOf?: string | null }
export interface ShowdownRoundInput {
  challengeId: string; roundNumber: number; actions: PrismAction[]; expectedRevision: number; requestId: string;
}
export type ShowdownSaveState = 'saved' | 'saving' | 'offline';
