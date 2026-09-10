import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../integrations/supabase/types.ts';
import {
  buildBoardMarkets, fetchNflData, validateBoardSlate, verifiedStarters,
  type BoardGame, type BoardMarket, type BoardPlayer, type BoardTeam,
  type EspnDepthChart, type EspnRoster, type EspnScoreboard,
} from './chainBoardData.ts';

type Client = SupabaseClient<Database>;
export interface ChainBoardPreview {
  clubId: string;
  weekId: string;
  weekNumber: number;
  year: number;
  gameCount: number;
  playerCount: number;
  createdAt: number;
  warnings: string[];
  markets: BoardMarket[];
}

export async function prepareChainBoard(client: Client, weekId: string, progress?: (message: string) => void): Promise<ChainBoardPreview> {
  const { data: clubId, error: clubError } = await client.rpc('current_user_club_id').abortSignal(AbortSignal.timeout(12_000));
  if (clubError || !clubId) throw new Error(clubError?.message || 'Select an active club first.');
  const { data: week, error: weekError } = await client.from('nfl_weeks').select('*').eq('id', weekId).abortSignal(AbortSignal.timeout(12_000)).single();
  if (weekError || !week) throw new Error(weekError?.message || 'Week not found.');
  const [seasonResult, gamesResult, teamsResult, lockResult] = await Promise.all([
    client.from('nfl_seasons').select('year').eq('id', week.season_id).abortSignal(AbortSignal.timeout(12_000)).single(),
    client.from('nfl_games').select('*').eq('week_id', weekId).order('kickoff_at').abortSignal(AbortSignal.timeout(12_000)),
    client.from('nfl_teams').select('*').abortSignal(AbortSignal.timeout(12_000)),
    client.rpc('is_nfl_week_unlocked', { _week_id: weekId }).abortSignal(AbortSignal.timeout(12_000)),
  ]);
  for (const result of [seasonResult, gamesResult, teamsResult, lockResult]) {
    if (result.error) throw new Error(result.error.message);
  }
  if (!lockResult.data) throw new Error('This weekly card is locked. Choose a future week.');
  const year = seasonResult.data!.year;
  const games = gamesResult.data as BoardGame[];
  const teams = teamsResult.data as BoardTeam[];
  progress?.('Verifying matchups and kickoff times…');
  const scoreboard = await fetchNflData<EspnScoreboard>(`scoreboard?dates=${year}&seasontype=2&week=${week.week_number}`);
  validateBoardSlate(scoreboard, games, teams, year, week.week_number);

  const teamIds = [...new Set(games.flatMap(game => [game.away_team_id, game.home_team_id]))];
  const playersByTeam = new Map<string, BoardPlayer[]>();
  const warnings: string[] = [];
  // Four teams at a time keeps the public data service and small devices responsive.
  for (let start = 0; start < teamIds.length; start += 4) {
    await Promise.all(teamIds.slice(start, start + 4).map(async teamId => {
      const team = teams.find(item => item.id === teamId)!;
      try {
        const [roster, depth] = await Promise.all([
          fetchNflData<EspnRoster>(`teams/${encodeURIComponent(team.external_id!)}/roster`),
          fetchNflData<EspnDepthChart>(`teams/${encodeURIComponent(team.external_id!)}/depthcharts`),
        ]);
        const verified = verifiedStarters(roster, depth, team.external_id!, year);
        playersByTeam.set(teamId, verified.players);
        warnings.push(...verified.warnings);
        if (!verified.players.length) warnings.push(`${team.city} ${team.name}: no verified available starters; team predictions only.`);
      } catch (error) {
        warnings.push(`${team.city} ${team.name}: ${error instanceof Error ? error.message : 'Roster unavailable'}`);
      }
    }));
    progress?.(`Checked ${Math.min(start + 4, teamIds.length)} of ${teamIds.length} teams…`);
  }
  return {
    clubId, weekId, weekNumber: week.week_number, year, gameCount: games.length,
    playerCount: [...playersByTeam.values()].reduce((count, players) => count + players.length, 0),
    createdAt: Date.now(), warnings: warnings.sort(), markets: buildBoardMarkets(clubId, games, teams, playersByTeam),
  };
}

export async function publishChainBoard(client: Client, preview: ChainBoardPreview) {
  if (Date.now() - preview.createdAt > 10 * 60_000) throw new Error('This preview has expired. Preview again to refresh player availability.');
  const [clubResult, lockResult, existingResult] = await Promise.all([
    client.rpc('current_user_club_id').abortSignal(AbortSignal.timeout(12_000)),
    client.rpc('is_nfl_week_unlocked', { _week_id: preview.weekId }).abortSignal(AbortSignal.timeout(12_000)),
    client.from('nfl_chain_markets').select('external_id,game_id,market_type,subject_team_id,subject_external_id,subject_label,operator,threshold')
      .eq('club_id', preview.clubId).eq('week_id', preview.weekId).abortSignal(AbortSignal.timeout(12_000)),
  ]);
  for (const result of [clubResult, lockResult, existingResult]) {
    if (result.error) throw new Error(result.error.message);
  }
  if (clubResult.data !== preview.clubId) throw new Error('Active club changed. Preview this board again.');
  if (!lockResult.data) throw new Error('This weekly card has locked. No new predictions were published.');
  const existing = existingResult.data || [];
  const rows = preview.markets.filter(market => !existing.some(item => item.external_id === market.external_id
    || (item.game_id === market.game_id && item.market_type === market.market_type && item.operator === market.operator
      && Number(item.threshold) === market.threshold
      && (market.subject_external_id
        ? item.subject_external_id === market.subject_external_id || item.subject_label.toLowerCase() === market.subject_label.toLowerCase()
        : item.subject_team_id === market.subject_team_id))));
  if (!rows.length) return { inserted: 0, existing: existing.length };
  // One request/transaction; DO NOTHING preserves selected predictions and results
  // even if another commissioner imports the exact board at the same time.
  const { data, error } = await client.from('nfl_chain_markets')
    .upsert(rows, { onConflict: 'club_id,week_id,external_id', ignoreDuplicates: true })
    .select('id').abortSignal(AbortSignal.timeout(20_000));
  if (error) throw new Error(error.message);
  return { inserted: data?.length || 0, existing: existing.length };
}
