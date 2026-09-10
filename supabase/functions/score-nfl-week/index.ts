// Score one NFL week and rebuild weekly + season standings.
// Safe to run repeatedly from an authorized admin or the protected NFL cron.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { readAllNflRows } from '../_shared/nflReadAll.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

type PickRow = {
  id: string;
  club_id: string;
  user_id: string;
  game_id: string;
  picked_team_id: string;
  is_correct: boolean | null;
};

type StandingRow = {
  club_id: string;
  user_id: string;
  rank?: number;
  [key: string]: unknown;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const cronSecret = Deno.env.get('CRON_SHARED_SECRET');
    const isTrustedCron = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;
    if (!isTrustedCron) {
      const authHeader = req.headers.get('Authorization') || '';
      const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const { data: { user }, error: userError } = await admin.auth.getUser(jwt);
      if (userError || !user) return json({ error: 'Unauthorized' }, 401);

      const { data: role } = await admin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'owner'])
        .limit(1)
        .maybeSingle();
      if (!role) return json({ error: 'Admin only' }, 403);
    }

    const { week_id: weekId } = await req.json().catch(() => ({}));
    if (!weekId) return json({ error: 'week_id required' }, 400);

    const { data: week, error: weekError } = await admin
      .from('nfl_weeks')
      .select('*')
      .eq('id', weekId)
      .single();
    if (weekError || !week) return json({ error: 'Week not found' }, 404);

    const [gamesResult, picksResult, tiebreakersResult] = await Promise.all([
      admin.from('nfl_games').select('*').eq('week_id', weekId),
      readAllNflRows((from,to)=>admin.from('nfl_picks').select('*').eq('week_id', weekId).order('id').range(from,to).abortSignal(AbortSignal.timeout(15_000))),
      readAllNflRows((from,to)=>admin.from('nfl_tiebreakers').select('*').eq('week_id', weekId).order('id').range(from,to).abortSignal(AbortSignal.timeout(15_000))),
    ]);
    if (gamesResult.error) throw gamesResult.error;
    if (picksResult.error) throw picksResult.error;
    if (tiebreakersResult.error) throw tiebreakersResult.error;

    const games = gamesResult.data || [];
    const picks = (picksResult.data || []) as PickRow[];
    const tiebreakers = tiebreakersResult.data || [];
    const finalById = new Map(
      games
        .filter((game: any) => game.status === 'final' && Number.isFinite(game.home_score) && Number.isFinite(game.away_score))
        .map((game: any) => [game.id, game]),
    );

    // Score in memory first so this same invocation calculates fresh standings.
    const scoredPicks = picks.map((pick) => {
      const game: any = finalById.get(pick.game_id);
      if (!game) return pick;
      const winner=game.home_score>game.away_score?game.home_team_id:game.away_score>game.home_score?game.away_team_id:null;
      return { ...pick, is_correct: !!winner && winner === pick.picked_team_id };
    });
    const changedPicks = scoredPicks.filter((pick, index) => pick.is_correct !== picks[index].is_correct);
    const finalPicks = scoredPicks.filter((pick) => finalById.has(pick.game_id));
    const pickWriteResults = await Promise.all(finalPicks.map((pick) =>
      admin.from('nfl_picks').update({
        is_correct: pick.is_correct,
        points_awarded: pick.is_correct ? 1 : 0,
      }).eq('id', pick.id)
    ));
    const pickWriteError = pickWriteResults.find((result) => result.error)?.error;
    if (pickWriteError) throw pickWriteError;

    const featured: any = games.find((game: any) => game.id === week.featured_game_id);
    const featuredTotal = featured && finalById.has(featured.id)
      ? Number(featured.away_score) + Number(featured.home_score)
      : null;
    const scoredTiebreakers = tiebreakers.map((entry: any) => ({
      ...entry,
      delta: featuredTotal == null ? entry.delta : Math.abs(featuredTotal - entry.predicted_total),
    }));
    if (featuredTotal != null) {
      const tbResults = await Promise.all(scoredTiebreakers.map((entry: any) =>
        admin.from('nfl_tiebreakers').update({
          actual_total: featuredTotal,
          delta: entry.delta,
        }).eq('id', entry.id)
      ));
      const tbError = tbResults.find((result) => result.error)?.error;
      if (tbError) throw tbError;
    }

    const weeklyByClub = new Map<string, StandingRow[]>();
    const entrants = new Map<string, { clubId: string; userId: string }>();
    for (const pick of scoredPicks) entrants.set(`${pick.club_id}:${pick.user_id}`, { clubId: pick.club_id, userId: pick.user_id });
    for (const entry of scoredTiebreakers) entrants.set(`${entry.club_id}:${entry.user_id}`, { clubId: entry.club_id, userId: entry.user_id });

    for (const { clubId, userId } of entrants.values()) {
      const userPicks = scoredPicks.filter((pick) => pick.club_id === clubId && pick.user_id === userId);
      const completed = userPicks.filter((pick) => pick.is_correct !== null);
      const correct = completed.filter((pick) => pick.is_correct === true).length;
      const tb = scoredTiebreakers.find((entry: any) => entry.club_id === clubId && entry.user_id === userId);
      const row: StandingRow = {
        club_id: clubId,
        user_id: userId,
        week_id: weekId,
        season_id: week.season_id,
        correct_picks: correct,
        total_picks: completed.length,
        accuracy: completed.length ? correct / completed.length : 0,
        tiebreak_delta: tb?.delta ?? null,
      };
      weeklyByClub.set(clubId, [...(weeklyByClub.get(clubId) || []), row]);
    }

    const weeklyRows: StandingRow[] = [];
    for (const rows of weeklyByClub.values()) {
      rows.sort((a: any, b: any) =>
        (b.correct_picks - a.correct_picks)
        || ((a.tiebreak_delta ?? Infinity) - (b.tiebreak_delta ?? Infinity))
      );
      assignCompetitionRanks(rows, (row: any) => `${row.correct_picks}|${row.tiebreak_delta ?? 'null'}`);
      weeklyRows.push(...rows);
    }
    for (const row of weeklyRows) {
      const { error } = await admin.from('nfl_weekly_standings').upsert(row, { onConflict: 'user_id,week_id' });
      if (error) throw error;
    }

    const allFinal = games.length > 0 && games.every((game: any) => finalById.has(game.id));
    if (allFinal) {
      const { error } = await admin.from('nfl_weeks').update({ status: 'scored' }).eq('id', weekId);
      if (error) throw error;
      const { error: advanceError } = await admin
        .from('nfl_seasons')
        .update({ current_week: week.week_number + 1 })
        .eq('id', week.season_id)
        .eq('current_week', week.week_number)
        .lt('current_week', 18);
      if (advanceError) throw advanceError;
    }

    const [seasonPicksResult, seasonWeeklyResult, scoredWeeksResult] = await Promise.all([
      readAllNflRows((from,to)=>admin.from('nfl_picks').select('club_id, user_id, is_correct').eq('season_id', week.season_id).order('id').range(from,to).abortSignal(AbortSignal.timeout(15_000))),
      readAllNflRows((from,to)=>admin.from('nfl_weekly_standings').select('*').eq('season_id', week.season_id).order('id').range(from,to).abortSignal(AbortSignal.timeout(15_000))),
      admin.from('nfl_weeks').select('id').eq('season_id',week.season_id).eq('status','scored'),
    ]);
    if (seasonPicksResult.error) throw seasonPicksResult.error;
    if (seasonWeeklyResult.error) throw seasonWeeklyResult.error;
    if (scoredWeeksResult.error) throw scoredWeeksResult.error;
    const scoredWeekIds=new Set((scoredWeeksResult.data || []).map(row=>row.id));

    const seasonPicks = seasonPicksResult.data || [];
    const allWeekly = seasonWeeklyResult.data || [];
    const seasonByClub = new Map<string, StandingRow[]>();
    const seasonEntrants = new Map<string, { clubId: string; userId: string }>();
    for (const pick of seasonPicks) seasonEntrants.set(`${pick.club_id}:${pick.user_id}`, { clubId: pick.club_id, userId: pick.user_id });

    for (const { clubId, userId } of seasonEntrants.values()) {
      const completed = seasonPicks.filter((pick: any) => pick.club_id === clubId && pick.user_id === userId && pick.is_correct !== null);
      const correct = completed.filter((pick: any) => pick.is_correct === true).length;
      const weekly = allWeekly.filter((row: any) => row.club_id === clubId && row.user_id === userId && row.total_picks > 0 && scoredWeekIds.has(row.week_id));
      const ranks = weekly.map((row: any) => row.rank).filter((rank: any) => rank != null);
      const row: StandingRow = {
        club_id: clubId,
        user_id: userId,
        season_id: week.season_id,
        total_correct: correct,
        total_picked: completed.length,
        accuracy: completed.length ? correct / completed.length : 0,
        weekly_wins: weekly.filter((entry: any) => entry.rank === 1).length,
        avg_weekly_rank: ranks.length ? ranks.reduce((sum: number, rank: number) => sum + rank, 0) / ranks.length : null,
      };
      seasonByClub.set(clubId, [...(seasonByClub.get(clubId) || []), row]);
    }

    const seasonRows: StandingRow[] = [];
    for (const rows of seasonByClub.values()) {
      rows.sort((a: any, b: any) =>
        (b.total_correct - a.total_correct)
        || ((a.avg_weekly_rank ?? Infinity) - (b.avg_weekly_rank ?? Infinity))
        || (b.weekly_wins - a.weekly_wins)
      );
      assignCompetitionRanks(rows, (row: any) => `${row.total_correct}|${row.avg_weekly_rank ?? 'null'}|${row.weekly_wins}`);
      seasonRows.push(...rows);
    }
    for (const row of seasonRows) {
      const { error } = await admin.from('nfl_season_standings').upsert(row, { onConflict: 'user_id,season_id' });
      if (error) throw error;
    }

    // Keep Crazy Chain settlement attached to the existing score pipeline.
    // A deployment lag or optional-chain error must never block Pick'em scoring.
    let crazyChain: unknown = null;
    try {
      const chainResponse = await fetch(`${supabaseUrl}/functions/v1/score-nfl-crazy-chain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({ week_id: weekId }),
        signal: AbortSignal.timeout(95_000),
      });
      crazyChain = await chainResponse.json().catch(() => ({ ok: false, error: `HTTP ${chainResponse.status}` }));
      if (!chainResponse.ok) console.warn('Crazy Chain scoring was deferred', crazyChain);
    } catch (chainError) {
      crazyChain = { ok: false, error: (chainError as Error).message };
      console.warn('Crazy Chain scoring was deferred', chainError);
    }

    return json({
      ok: true,
      scored_picks: changedPicks.length,
      scored_users: weeklyRows.length,
      scored_clubs: weeklyByClub.size,
      week_status: allFinal ? 'scored' : week.status,
      crazy_chain: crazyChain,
    });
  } catch (error) {
    console.error('score-nfl-week error', error);
    return json({ error: (error as Error).message }, 500);
  }
});

function assignCompetitionRanks(rows: StandingRow[], signature: (row: StandingRow) => string) {
  let prior = '';
  let rank = 0;
  rows.forEach((row, index) => {
    const current = signature(row);
    if (index === 0 || current !== prior) rank = index + 1;
    row.rank = rank;
    prior = current;
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
