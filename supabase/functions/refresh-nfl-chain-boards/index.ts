// Called by the existing protected 30-minute NFL reminder cron. Also supports a
// commissioner JWT + week_id for an explicit refresh of their own club only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { collectChainBoard } from '../_shared/chainBoardPipeline.ts';
import { chainGameLockAt } from '../_shared/chainGameRules.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info,x-cron-secret' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
const deadline = () => AbortSignal.timeout(15_000);

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(url, serviceKey);
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
    const secret = Deno.env.get('CRON_SHARED_SECRET');
    const scheduled = token === serviceKey || (!!secret && req.headers.get('x-cron-secret') === secret);
    const body = await req.json().catch(() => ({}));
    let requestedClub: string | null = null;
    if (!scheduled) {
      const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } } });
      const user = await client.auth.getUser();
      if (user.error || !user.data.user) return reply({ error: 'Unauthorized' }, 401);
      const [club, admin, owner] = await Promise.all([
        client.rpc('current_user_club_id').abortSignal(deadline()),
        client.rpc('is_app_admin', { _user_id: user.data.user.id }).abortSignal(deadline()),
        client.rpc('is_platform_owner', { _user: user.data.user.id }).abortSignal(deadline()),
      ]);
      if (club.error || admin.error || owner.error) return reply({ error: 'Could not verify commissioner access' }, 403);
      if (!club.data || (!admin.data && !owner.data)) return reply({ error: 'Club commissioner access required' }, 403);
      requestedClub = club.data;
      if (typeof body.week_id !== 'string') return reply({ error: 'week_id required' }, 400);
    }

    const [installs, seasons, teams] = await Promise.all([
      db.from('club_installed_assets').select('club_id,platform_assets!inner(slug)').eq('enabled', true).eq('platform_assets.slug', 'nfl-pickem').abortSignal(deadline()),
      db.from('nfl_seasons').select('id,year,pick_lock_minutes').in('status', ['active','upcoming']).abortSignal(deadline()),
      db.from('nfl_teams').select('*').abortSignal(deadline()),
    ]);
    for (const result of [installs, seasons, teams]) if (result.error) throw result.error;
    const clubs = [...new Set((installs.data || []).map(item => item.club_id))].filter(id => !requestedClub || requestedClub === id);
    if (requestedClub && !clubs.length) return reply({ error: 'NFL Game Center is not installed in this club' }, 403);
    const results: Array<Record<string, unknown>> = [];
    const started = Date.now();
    let completed = 0;
    for (const season of seasons.data || []) {
      const weeks = await db.from('nfl_weeks').select('id,week_number,starts_at,ends_at').eq('season_id', season.id)
        .lte('starts_at', new Date(Date.now() + 8 * 86400_000).toISOString())
        .gte('ends_at', new Date().toISOString()).order('week_number').abortSignal(deadline());
      if (weeks.error) throw weeks.error;
      for (const week of weeks.data || []) {
        if (requestedClub && week.id !== body.week_id) continue;
        for (const clubId of clubs) {
          if (completed >= 4 || Date.now() - started > 100_000) return reply({ ok: !results.some(r => r.error), results, deferred: true });
          try {
            const [board, games, existing] = await Promise.all([
              db.from('nfl_chain_boards').select('*').eq('week_id', week.id).eq('club_id', clubId).abortSignal(deadline()).maybeSingle(),
              db.from('nfl_games').select('*').eq('week_id', week.id).order('kickoff_at').abortSignal(deadline()),
              db.from('nfl_chain_markets').select('*').eq('week_id', week.id).eq('club_id', clubId).abortSignal(deadline()),
            ]);
            for (const result of [board,games,existing]) if (result.error) throw result.error;
            const remaining = (games.data || []).filter(game => game.status === 'scheduled'
              && Date.parse(game.kickoff_at) > Date.now());
            if (!remaining.length) continue;
            // Every 6h normally; every 30m within a day of any remaining kickoff.
            const nearKickoff = remaining.some(game => {
              const untilKickoff=Date.parse(game.kickoff_at)-Date.now();
              const untilDeadline=chainGameLockAt(game)-Date.now();
              return untilKickoff<86400_000 || (untilDeadline>0 && untilDeadline<86400_000);
            });
            const interval = nearKickoff ? 25 * 60_000 : 6 * 3600_000;
            if (scheduled && board.data?.checked_at && Date.now() - Date.parse(board.data.checked_at) < interval) continue;
            completed++;
            const preview = await collectChainBoard({
              clubId,weekId:week.id,weekNumber:week.week_number,year:season.year,lockMinutes:season.pick_lock_minutes ?? 10,
              games:games.data || [],teams:teams.data || [],existing:existing.data || [],
            });
            const published = await db.rpc('publish_nfl_chain_board', {
              _week_id:week.id,_club_id:clubId,_markets:preview.markets,_availability:preview.availability,
              _checked_at:new Date(preview.createdAt).toISOString(),_warnings:preview.warnings,
            }).abortSignal(AbortSignal.timeout(25_000));
            if (published.error) throw published.error;
            results.push({club_id:clubId,week:week.week_number,...published.data});
          } catch (error) {
            // Leave prior data untouched on schedule/provider failures. The save RPC
            // independently refuses new player selections once evidence is stale.
            results.push({club_id:clubId,week:week.week_number,error:error instanceof Error ? error.message : String((error as {message?:string}).message || 'Refresh failed')});
          }
        }
      }
    }
    return reply({ok:!results.some(result=>result.error),results});
  } catch (error) {
    console.error('Crazy Chain refresh failed', error);
    return reply({error:'Crazy Chain refresh failed. Check server logs.'},500);
  }
});
