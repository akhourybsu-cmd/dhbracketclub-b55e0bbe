// Node 22.18+ / 24: node --env-file=.env scripts/load-crazy-chain.mjs --year 2026 --week 2 [--publish]
// Supply DH_NFL_EMAIL and DH_NFL_PASSWORD in the process environment, never in source.
// Preview is read-only. Publishing adds missing predictions to the signed-in admin's club.
import { createClient } from '@supabase/supabase-js';
import { prepareChainBoard, publishChainBoard } from '../src/lib/nfl/chainBoardImport.ts';

const args = process.argv.slice(2);
const value = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const year = Number(value('--year'));
const weekNumber = Number(value('--week'));
if (!Number.isInteger(year) || year < 2020 || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 18) {
  throw new Error('Supply --year YYYY and --week 1..18.');
}
const email = process.env.DH_NFL_EMAIL;
const password = process.env.DH_NFL_PASSWORD;
if (!email || !password) throw new Error('Set DH_NFL_EMAIL and DH_NFL_PASSWORD in the process environment.');
const client = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
try {
  const { error: authError } = await client.auth.signInWithPassword({ email, password });
  if (authError) throw new Error(authError.message);
  const { data: season, error: seasonError } = await client.from('nfl_seasons').select('id').eq('year', year).abortSignal(AbortSignal.timeout(12_000)).single();
  if (seasonError) throw new Error(seasonError.message);
  const { data: week, error: weekError } = await client.from('nfl_weeks').select('id').eq('season_id', season.id).eq('week_number', weekNumber).abortSignal(AbortSignal.timeout(12_000)).single();
  if (weekError) throw new Error(weekError.message);
  const preview = await prepareChainBoard(client, week.id, message => console.log(message));
  const byType = {};
  for (const market of preview.markets) byType[market.market_type] = (byType[market.market_type] || 0) + 1;
  console.log(JSON.stringify({
    mode: args.includes('--publish') ? 'publish' : 'preview',
    year, week: weekNumber, games: preview.gameCount, excludedGames: preview.skippedGames, players: preview.playerCount,
    predictions: preview.markets.length, types: byType, warnings: preview.warnings,
    sample: preview.markets.slice(0, 18).map(market => market.display_text),
  }, null, 2));
  if (args.includes('--publish')) {
    const result = await publishChainBoard(client, preview);
    const { count, error } = await client.from('nfl_chain_markets').select('id', { count: 'exact', head: true })
      .eq('club_id', preview.clubId).eq('week_id', preview.weekId).abortSignal(AbortSignal.timeout(12_000));
    if (error) throw new Error(error.message);
    console.log(JSON.stringify({ uploaded: result.inserted, previouslyExisting: result.existing, verifiedWeekTotal: count,
      availabilityRechecked: result.reviewed, paused: result.paused, locksAt: result.lock_at }));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'NFL board import failed.');
  process.exitCode = 1;
}
