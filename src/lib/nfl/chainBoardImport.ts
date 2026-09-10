import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../integrations/supabase/types.ts';
import { collectChainBoard, type ExistingChainMarket } from '../../../supabase/functions/_shared/chainBoardPipeline.ts';
import { fetchNflData, validateBoardSlate, type BoardGame, type BoardTeam, type EspnScoreboard } from './chainBoardData.ts';

type Client = SupabaseClient<Database>;
export type ChainBoardPreview = Awaited<ReturnType<typeof collectChainBoard>>;
const queryDeadline = () => AbortSignal.timeout(15_000);

// Narrow adapter until the migration is reflected in generated Supabase types.
export function chainRpc(client: Client, name: string, args: Record<string, Json>) {
  return (client.rpc as unknown as (name: string, args: Record<string, Json>) => ReturnType<Client['rpc']>)(name, args);
}

export async function prepareChainBoard(client: Client, weekId: string, progress?: (message: string) => void): Promise<ChainBoardPreview> {
  const { data: clubId, error: clubError } = await client.rpc('current_user_club_id').abortSignal(queryDeadline());
  if (clubError || !clubId) throw new Error(clubError?.message || 'Select an active club first.');
  const { data: week, error: weekError } = await client.from('nfl_weeks').select('*').eq('id', weekId).abortSignal(queryDeadline()).single();
  if (weekError || !week) throw new Error(weekError?.message || 'Week not found.');
  const [season, games, teams, existing] = await Promise.all([
    client.from('nfl_seasons').select('year,pick_lock_minutes').eq('id', week.season_id).abortSignal(queryDeadline()).single(),
    client.from('nfl_games').select('*').eq('week_id', weekId).order('kickoff_at').abortSignal(queryDeadline()),
    client.from('nfl_teams').select('*').abortSignal(queryDeadline()),
    client.from('nfl_chain_markets').select('*').eq('club_id', clubId).eq('week_id', weekId).abortSignal(queryDeadline()),
  ]);
  for (const result of [season, games, teams, existing]) if (result.error) throw new Error(result.error.message);
  return collectChainBoard({
    clubId, weekId, weekNumber: week.week_number, year: season.data!.year,
    lockMinutes: season.data!.pick_lock_minutes ?? 10,
    games: games.data as BoardGame[], teams: teams.data as BoardTeam[], existing: existing.data as ExistingChainMarket[],
  }, progress);
}

export async function publishChainBoard(client: Client, preview: ChainBoardPreview) {
  if (Date.now() - preview.createdAt > 10 * 60_000) throw new Error('Preview expired. Refresh the board before publishing.');
  const [games, teams, scoreboard] = await Promise.all([
    client.from('nfl_games').select('*').eq('week_id', preview.weekId).abortSignal(queryDeadline()),
    client.from('nfl_teams').select('*').abortSignal(queryDeadline()),
    fetchNflData<EspnScoreboard>(`scoreboard?dates=${preview.year}&seasontype=2&week=${preview.weekNumber}`),
  ]);
  if (games.error || teams.error) throw new Error(games.error?.message || teams.error?.message);
  const eligible = validateBoardSlate(scoreboard, games.data as BoardGame[], teams.data as BoardTeam[], preview.year, preview.weekNumber, Date.now(), true, 0);
  if (preview.gameIds.some(id => !eligible.some(game => game.id === id))) throw new Error('A game just locked. Refresh the preview.');
  const { data, error } = await chainRpc(client, 'publish_nfl_chain_board', {
    _week_id: preview.weekId, _club_id: preview.clubId,
    _markets: preview.markets as unknown as Json, _availability: preview.availability as unknown as Json,
    _checked_at: new Date(preview.createdAt).toISOString(), _warnings: preview.warnings,
  }).abortSignal(AbortSignal.timeout(25_000));
  if (error) throw new Error(/schema cache|does not exist/.test(error.message)
    ? 'Apply the Crazy Chain remaining-games database update before publishing.' : error.message);
  return data as unknown as { inserted: number; existing: number; reviewed: number; paused: number; lock_at: string };
}
