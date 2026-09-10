// Independent five-minute job: a results-feed failure must not prevent checks
// between Crazy Chain's 30-minute lock and the actual kickoff.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { fetchNflData, type BoardGame, type BoardTeam } from '../_shared/chainBoardData.ts';
import { collectConfirmedAbsences, type EligibilitySummary } from '../_shared/chainEligibility.ts';

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secret = Deno.env.get('CRON_SHARED_SECRET');
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (!(serviceKey && token === serviceKey) && !(secret && req.headers.get('x-cron-secret') === secret)) return reply({ error: 'Unauthorized' }, 401);
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey!);
    const now = Date.now();
    const games = await db.from('nfl_games').select('*').eq('status', 'scheduled').eq('external_provider', 'espn')
      .gt('kickoff_at', new Date(now).toISOString()).lte('kickoff_at', new Date(now + 86400_000).toISOString())
      .order('crazy_chain_availability_checked_at', { nullsFirst: true }).order('kickoff_at').limit(16)
      .abortSignal(AbortSignal.timeout(15_000));
    if (games.error) throw games.error;
    if (!games.data?.length) return reply({ ok: true, results: [] });
    const [teams, seasons] = await Promise.all([
      db.from('nfl_teams').select('id,external_id,external_provider,city,name')
        .in('id', [...new Set(games.data.flatMap(game => [game.home_team_id, game.away_team_id]))]).abortSignal(AbortSignal.timeout(15_000)),
      db.from('nfl_seasons').select('id,year').in('id', [...new Set(games.data.map(game => game.season_id))]).abortSignal(AbortSignal.timeout(15_000)),
    ]);
    if (teams.error) throw teams.error;
    if (seasons.error) throw seasons.error;
    const results: Array<Record<string, unknown>> = [];
    // NFL has at most 16 games in a slate. Keep provider/database work bounded,
    // isolate failures per game, and return an unsuccessful status for monitoring.
    for (let start = 0; start < games.data.length; start += 4) {
      await Promise.all(games.data.slice(start, start + 4).map(async (game: BoardGame) => {
        try {
          const year = seasons.data.find(season => season.id === game.season_id)?.year;
          if (!year) throw new Error('Missing season identity');
          const summary = await fetchNflData<EligibilitySummary>(`summary?event=${encodeURIComponent(game.external_id!)}`);
          const checked = Date.now();
          const checks = collectConfirmedAbsences(summary, game, teams.data as BoardTeam[], year, checked);
          const applied = await db.rpc('apply_nfl_chain_availability', {
            _game_id: game.id, _event_id: game.external_id, _kickoff_at: game.kickoff_at,
            _checks: checks, _checked_at: new Date(checked).toISOString(),
          }).abortSignal(AbortSignal.timeout(20_000));
          if (applied.error) throw applied.error;
          results.push({ game_id: game.id, ...applied.data });
        } catch (error) {
          results.push({ game_id: game.id, error: error instanceof Error ? error.message : 'Availability update failed' });
        }
      }));
    }
    const ok = !results.some(result => result.error);
    return reply({ ok, results }, ok ? 200 : 502);
  } catch (error) {
    console.error('Crazy Chain availability check failed', error);
    return reply({ error: 'Availability check failed. Existing picks were not cancelled from missing data.' }, 500);
  }
});
