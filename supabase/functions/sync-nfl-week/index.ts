// Sync an NFL week from ESPN's public scoreboard API.
// Idempotent: upserts games keyed on (week_id, external_id).
// After sync, if any games are final, invokes score-nfl-week to refresh standings.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { parseNflScore } from '../_shared/chainFinalStats.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type SyncBody = {
  season_year?: number;
  week_number?: number;
  seasontype?: number; // 1=preseason, 2=regular, 3=postseason. Default 2.
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    const cronSecret = Deno.env.get('CRON_SHARED_SECRET');
    const isTrustedCron = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;
    if (!isTrustedCron && !authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (!isTrustedCron) {
      const token = authHeader!.replace('Bearer ', '');
      const { data: userData, error: userErr } = await admin.auth.getUser(token);
      if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

      const { data: roleRow } = await admin
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.user.id)
        .in('role', ['admin', 'owner'])
        .limit(1)
        .maybeSingle();
      if (!roleRow) return json({ error: 'Forbidden' }, 403);
    }

    const body: SyncBody = await req.json().catch(() => ({}));
    const seasontype = body.seasontype ?? 2;
    if (!body.season_year || !body.week_number) {
      return json({ error: 'season_year and week_number required' }, 400);
    }

    // Resolve season
    const { data: season, error: seasonErr } = await admin
      .from('nfl_seasons')
      .select('id, year, current_week')
      .eq('year', body.season_year)
      .maybeSingle();
    if (seasonErr || !season) return json({ error: `No season for year ${body.season_year}` }, 404);

    // Fetch ESPN scoreboard for this week
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=${seasontype}&week=${body.week_number}&dates=${body.season_year}`;
    // ESPN rejects requests without a browser-like UA/Accept pair with 403.
    const r = await fetch(espnUrl,{signal:AbortSignal.timeout(15_000),headers:{
      'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      'Accept':'application/json, text/plain, */*','Referer':'https://www.espn.com/',
    }});
    if (!r.ok) return json({ error: `ESPN fetch failed: ${r.status}` }, 502);
    const data = await r.json();
    if (data?.season?.year !== body.season_year || data?.season?.type !== seasontype || data?.week?.number !== body.week_number) {
      return json({ error: 'ESPN returned a different season or week; no games were changed.' }, 502);
    }

    const events: any[] = data?.events ?? [];
    if (events.length === 0) {
      return json({
        ok: true,
        empty: true,
        upserts: 0,
        finals: 0,
        message: `ESPN has no games published for ${body.season_year} season (seasontype=${seasontype}, week=${body.week_number}). The schedule may not be released yet.`,
      });
    }

    // Resolve/create the nfl_week row using ESPN's week boundaries
    let weekStart: string | null = null;
    let weekEnd: string | null = null;
    for (const ev of events) {
      const dt = ev?.date as string | undefined;
      if (!dt) continue;
      if (!weekStart || dt < weekStart) weekStart = dt;
      if (!weekEnd || dt > weekEnd) weekEnd = dt;
    }
    weekStart ??= new Date().toISOString();
    weekEnd ??= weekStart;
    // pad end by 4h so trigger sees the slate as fully past after Sunday/Monday games end
    weekEnd = new Date(new Date(weekEnd).getTime() + 4 * 60 * 60 * 1000).toISOString();

    const { data: existingWeek } = await admin
      .from('nfl_weeks')
      .select('id, status, featured_game_id')
      .eq('season_id', season.id)
      .eq('week_number', body.week_number)
      .maybeSingle();

    let weekId: string;
    if (existingWeek) {
      weekId = existingWeek.id;
      // refresh boundaries (don't downgrade scored)
      await admin.from('nfl_weeks').update({ starts_at: weekStart, ends_at: weekEnd }).eq('id', weekId);
    } else {
      const { data: newWeek, error: weekErr } = await admin
        .from('nfl_weeks')
        .insert({
          season_id: season.id,
          week_number: body.week_number,
          label: `Week ${body.week_number}`,
          starts_at: weekStart,
          ends_at: weekEnd,
          status: 'upcoming',
        })
        .select('id')
        .single();
      if (weekErr || !newWeek) return json({ error: weekErr?.message ?? 'Failed to create week' }, 500);
      weekId = newWeek.id;
    }

    // Load team mapping (espn_id → uuid)
    const { data: teams } = await admin
      .from('nfl_teams')
      .select('id, external_id')
      .eq('external_provider', 'espn');
    const teamByEspnId = new Map<string, string>();
    for (const t of teams ?? []) {
      if (t.external_id) teamByEspnId.set(String(t.external_id), t.id);
    }

    let upserts = 0;
    let finals = 0;
    let skipped = 0;
    const missingTeams = new Set<string>();

    for (const ev of events) {
      const comp = ev?.competitions?.[0];
      if (!comp) { skipped++; continue; }
      const competitors = comp.competitors ?? [];
      const homeC = competitors.find((c: any) => c.homeAway === 'home');
      const awayC = competitors.find((c: any) => c.homeAway === 'away');
      if (!homeC || !awayC) { skipped++; continue; }

      const homeId = teamByEspnId.get(String(homeC.team?.id));
      const awayId = teamByEspnId.get(String(awayC.team?.id));
      if (!homeId || !awayId) {
        skipped++;
        if (!homeId) missingTeams.add(`${homeC.team?.abbreviation ?? homeC.team?.displayName ?? 'Unknown'} (${homeC.team?.id ?? '?'})`);
        if (!awayId) missingTeams.add(`${awayC.team?.abbreviation ?? awayC.team?.displayName ?? 'Unknown'} (${awayC.team?.id ?? '?'})`);
        continue;
      }

      const stateRaw = comp.status?.type?.state ?? ev.status?.type?.state;
      const completed = comp.status?.type?.completed ?? ev.status?.type?.completed;
      // BUGFIX: previously emitted 'in_progress' which violates the
      // nfl_games.status CHECK constraint (only allows scheduled/live/final).
      // Every live ESPN game would silently fail to update — viewers saw
      // games stuck on 'scheduled' even mid-broadcast.
      const status = completed ? 'final' : stateRaw === 'in' ? 'live' : 'scheduled';

      // ESPN represents not-yet-started scores as the string "0". Keep those
      // as null so admin controls and viewers never mistake a future 0–0 for
      // a real result.
      const homeScore = status === 'scheduled' ? null : parseNflScore(homeC.score);
      const awayScore = status === 'scheduled' ? null : parseNflScore(awayC.score);
      if (status !== 'scheduled' && (homeScore === null || awayScore === null)) {
        skipped++;
        console.warn('Incomplete scoreboard result; preserving stored game', ev.id);
        continue;
      }
      const winnerId =
        status === 'final' && homeScore != null && awayScore != null
          ? homeScore > awayScore
            ? homeId
            : awayScore > homeScore
              ? awayId
              : null
          : null;

      const externalId = String(ev.id);
      const kickoff = ev.date ?? comp.date;

      // Try update first by external_id
      const { data: existingGame } = await admin
        .from('nfl_games')
        .select('id, status')
        .eq('week_id', weekId)
        .eq('external_provider', 'espn')
        .eq('external_id', externalId)
        .maybeSingle();

      if (existingGame) {
        // A transient provider regression must not erase an already-final result.
        if (existingGame.status === 'final' && status !== 'final') { skipped++; continue; }
        const { error: updErr } = await admin
          .from('nfl_games')
          .update({
            kickoff_at: kickoff,
            status,
            home_score: homeScore,
            away_score: awayScore,
            winner_team_id: winnerId,
          })
          .eq('id', existingGame.id);
        if (updErr) throw updErr;
        upserts++;
      } else {
        const { error: insErr } = await admin.from('nfl_games').insert({
          season_id: season.id,
          week_id: weekId,
          home_team_id: homeId,
          away_team_id: awayId,
          kickoff_at: kickoff,
          status,
          home_score: homeScore,
          away_score: awayScore,
          winner_team_id: winnerId,
          external_id: externalId,
          external_provider: 'espn',
        });
        if (insErr) throw insErr;
        upserts++;
      }
      if (status === 'final') finals++;
    }

    // Pick a sensible tiebreaker automatically (latest kickoff), but never
    // overwrite a commissioner's explicit choice.
    if (!existingWeek?.featured_game_id) {
      const { data: latestGame } = await admin
        .from('nfl_games')
        .select('id')
        .eq('week_id', weekId)
        .order('kickoff_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestGame?.id) {
        const { error } = await admin.from('nfl_weeks').update({ featured_game_id: latestGame.id }).eq('id', weekId);
        if (error) throw error;
      }
    }

    // If any games are final, score with the same verified user context or
    // protected cron secret that authorized this sync.
    let scored: any = null;
    if (finals > 0) {
      const scoreResponse = await fetch(`${supabaseUrl}/functions/v1/score-nfl-week`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isTrustedCron
            ? { 'x-cron-secret': cronSecret! }
            : { Authorization: authHeader! }),
        },
        body: JSON.stringify({ week_id: weekId }),
        signal: AbortSignal.timeout(110_000),
      });
      scored = await scoreResponse.json().catch(() => null);
      if (!scoreResponse.ok) throw new Error(scored?.error || `Scoring failed: ${scoreResponse.status}`);
    }

    return json({
      ok: true,
      week_id: weekId,
      events: events.length,
      upserts,
      finals,
      skipped,
      missing_teams: [...missingTeams],
      scored,
    });
  } catch (e) {
    console.error('sync-nfl-week error', e);
    return json({ error: (e as Error).message }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
