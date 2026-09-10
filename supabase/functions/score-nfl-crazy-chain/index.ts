// Deterministically settles Crazy Chain markets backed by the existing NFL game feed.
// Player props stay open until a commissioner or future stat provider settles them.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

type GameRow = {
  id: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  winner_team_id: string | null;
};

type MarketRow = {
  id: string;
  market_type: string;
  game_id: string;
  subject_team_id: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const cronSecret = Deno.env.get('CRON_SHARED_SECRET');
    const authHeader = req.headers.get('Authorization') || '';
    const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const isTrustedCron = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;
    const isInternalService = jwt === serviceKey;

    if (!isTrustedCron && !isInternalService) {
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

    const [gamesResult, marketsResult] = await Promise.all([
      admin.from('nfl_games').select('id,status,home_team_id,away_team_id,home_score,away_score,winner_team_id').eq('week_id', weekId),
      admin.from('nfl_chain_markets').select('id,market_type,game_id,subject_team_id').eq('week_id', weekId).eq('status', 'open'),
    ]);
    if (gamesResult.error) throw gamesResult.error;
    if (marketsResult.error) throw marketsResult.error;

    const games = new Map(((gamesResult.data || []) as GameRow[]).map((game) => [game.id, game]));
    const markets = (marketsResult.data || []) as MarketRow[];
    const results: Array<{ market_id: string; status: 'settled' | 'skipped' | 'error'; reason?: string }> = [];

    for (const market of markets) {
      const game = games.get(market.game_id);
      if (!game || game.status !== 'final') {
        results.push({ market_id: market.id, status: 'skipped', reason: 'Game is not final' });
        continue;
      }

      const actualValue = automaticActualValue(market, game);
      if (actualValue == null) {
        results.push({ market_id: market.id, status: 'skipped', reason: 'Requires player-stat or commissioner settlement' });
        continue;
      }

      const { error } = await admin.rpc('settle_nfl_chain_market', {
        _market_id: market.id,
        _actual_value: actualValue,
        _void: false,
      });
      if (error) {
        results.push({ market_id: market.id, status: 'error', reason: error.message });
      } else {
        results.push({ market_id: market.id, status: 'settled' });
      }
    }

    return json({
      ok: !results.some((result) => result.status === 'error'),
      week_id: weekId,
      settled: results.filter((result) => result.status === 'settled').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      errors: results.filter((result) => result.status === 'error'),
      results,
    });
  } catch (error) {
    console.error('score-nfl-crazy-chain error', error);
    return json({ error: (error as Error).message }, 500);
  }
});

function automaticActualValue(market: MarketRow, game: GameRow): number | null {
  if (market.market_type === 'game_total') {
    if (game.home_score == null || game.away_score == null) return null;
    return Number(game.home_score) + Number(game.away_score);
  }

  if (market.market_type === 'team_win') {
    if (!market.subject_team_id) return null;
    // A final tie has no winner and correctly grades every "to win" market as a miss.
    return game.winner_team_id === market.subject_team_id ? 1 : 0;
  }

  if (market.market_type === 'team_points') {
    if (market.subject_team_id === game.home_team_id && game.home_score != null) return Number(game.home_score);
    if (market.subject_team_id === game.away_team_id && game.away_score != null) return Number(game.away_score);
  }

  return null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
