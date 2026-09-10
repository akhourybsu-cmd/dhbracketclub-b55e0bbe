// Cron-invoked: every 30 min. Refreshes the active NFL week, then broadcasts:
//   - "Week N open" once per week
//   - "Picks lock in 1 hour" once before the lock cutoff
// Dedupes via notification_sent_log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const WINDOW_MIN = 17; // 30-min cron, half + slack

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const expected = Deno.env.get("CRON_SHARED_SECRET");
  if (!expected || (req.headers.get("x-cron-secret") || "") !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const fnBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`;

  const broadcast = (title: string, message: string, url: string, tag: string) =>
    fetch(fnBase, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": expected },
      body: JSON.stringify({ type: "pickem", title, message, url, tag }),
    }).then((r) => r.json()).catch(() => ({}));

  const dedupe = async (id: string, variant: string) => {
    const { data } = await supabase.from("notification_sent_log")
      .select("id").eq("type", "pickem").eq("entity_id", id).eq("variant", variant).maybeSingle();
    return !!data;
  };
  const logSent = (id: string, variant: string) =>
    supabase.from("notification_sent_log").insert({ type: "pickem", entity_id: id, variant });

  let sent = 0;

  // Keep the active slate and scores current before evaluating notifications.
  // sync-nfl-week performs its own matching cron-secret validation.
  const { data: activeSeason } = await supabase
    .from('nfl_seasons')
    .select('id, year, current_week, pick_lock_minutes')
    .eq('status', 'active')
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle();
  let syncResult: unknown = null;
  if (activeSeason) {
    syncResult = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-nfl-week`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': expected },
      body: JSON.stringify({ season_year: activeSeason.year, week_number: activeSeason.current_week, seasontype: 2 }),
    }).then((response) => response.json()).catch((error) => ({ error: String(error) }));
  }

  // Reuse this already-authenticated schedule for Crazy Chain publishing and
  // availability checks; no new secret or browser-open requirement is introduced.
  const chainRefreshPromise = fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/refresh-nfl-chain-boards`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': expected },
    body: '{}', signal: AbortSignal.timeout(110_000),
  }).then(async response => ({ status: response.status, ...await response.json() }))
    .catch(() => ({ error: 'Crazy Chain refresh timed out or was unavailable' }));

  // 1) Week-open broadcast
  const { data: openWeeks } = activeSeason
    ? await supabase
      .from("nfl_weeks")
      .select("id, week_number, status, season_id")
      .eq('season_id', activeSeason.id)
      .in("status", ["open", "partially_locked"])
    : { data: [] };

  for (const w of openWeeks || []) {
    if (!(await dedupe(w.id, "open"))) {
      const r = await broadcast(
        `NFL Pick'em — Week ${w.week_number}`,
        "Picks are open. Lock yours in before kickoff.",
        `/pickem/week/${w.week_number}`,
        `dh-pickem-${w.id}-open`,
      );
      sent += r?.sent || 0;
      await logSent(w.id, "open");
    }

    // One reminder per game, one hour before its individual 48-hour cutoff.
    const {data:games}=await supabase.from('nfl_games').select('id,kickoff_at,chain_lock_at').eq('week_id',w.id).eq('status','scheduled');
    for(const game of games || []){
      if(!game.chain_lock_at) continue; // SQL rollout has not completed.
      const targetMs=Date.parse(game.chain_lock_at)-3600_000;
      if(Math.abs(targetMs-Date.now())>WINDOW_MIN*60_000 || await dedupe(game.id,'game-48h')) continue;
      const r=await broadcast(
        'NFL game picks lock in 1 hour',
        'The game kicking off '+new Date(game.kickoff_at).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET closes soon. Later games keep their own deadlines.',
        '/pickem/week/'+w.week_number,'dh-pickem-'+game.id+'-48h',
      );
      sent+=r?.sent || 0;
      await logSent(game.id,'game-48h');
    }
  }

  // Deliver the existing reminders without waiting for the larger roster refresh.
  const chainRefresh = await chainRefreshPromise;
  return new Response(JSON.stringify({ ok: true, sent, sync: syncResult, crazy_chain: chainRefresh }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
