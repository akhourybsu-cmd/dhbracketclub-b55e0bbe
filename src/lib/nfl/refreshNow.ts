import { supabase } from '@/integrations/supabase/client';

export interface NflCheckResult {
  weekNumber: number;
  ok: boolean;
  upserts: number;
  finals: number;
  scoredUsers: number;
  error?: string;
}

export interface NflCheckSummary {
  weeks: NflCheckResult[];
  boardsRefreshed: number;
}

const WEEK_WINDOW_DAYS = 8;

/**
 * Work out which weeks a manual check should touch. A single "current week"
 * number is not enough: a week stays unscored until every game is final, so a
 * check pressed on Monday night has to revisit the slate that is still running
 * as well as the one already on the board. We look at real kickoff times.
 */
async function weeksToCheck(seasonYear: number, currentWeek: number): Promise<number[]> {
  const numbers = new Set<number>();
  for (const candidate of [currentWeek - 1, currentWeek, currentWeek + 1]) {
    if (candidate >= 1 && candidate <= 18) numbers.add(candidate);
  }
  try {
    const since = new Date(Date.now() - WEEK_WINDOW_DAYS * 86_400_000).toISOString();
    const until = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const { data } = await supabase
      .from('nfl_games')
      .select('nfl_weeks!nfl_games_week_id_fkey!inner(week_number,nfl_seasons!inner(year))')
      .gte('kickoff_at', since)
      .lte('kickoff_at', until);
    for (const row of (data || []) as any[]) {
      const week = row?.nfl_weeks;
      if (week?.nfl_seasons?.year === seasonYear && week.week_number >= 1 && week.week_number <= 18) {
        numbers.add(week.week_number);
      }
    }
  } catch {
    // Fall back to the ±1 window when the lookup is unavailable.
  }
  return [...numbers].sort((a, b) => a - b);
}

/**
 * Manual "check everything now" pass. `sync-nfl-week` pulls the ESPN slate and
 * scores Pick'em plus the Crazy Chain in the same call, so syncing every week
 * that has recent or imminent kickoffs brings games, live scores and standings
 * fully up to date. Chain boards are then rebuilt so new results show there too.
 */
export async function runNflCheck(seasonYear: number, currentWeek: number): Promise<NflCheckSummary> {
  const weekNumbers = await weeksToCheck(seasonYear, currentWeek);
  const weeks: NflCheckResult[] = [];
  const weekIds: string[] = [];
  for (const weekNumber of weekNumbers) {
    try {
      const { data, error } = await supabase.functions.invoke('sync-nfl-week', {
        body: { season_year: seasonYear, week_number: weekNumber },
      });
      if (error) throw error;
      if (data?.week_id) weekIds.push(data.week_id);
      weeks.push({
        weekNumber,
        ok: data?.ok !== false,
        upserts: data?.upserts ?? 0,
        finals: data?.finals ?? 0,
        scoredUsers: data?.scored?.scored_users ?? 0,
        error: data?.error,
      });
    } catch (error) {
      weeks.push({
        weekNumber, ok: false, upserts: 0, finals: 0, scoredUsers: 0,
        error: error instanceof Error ? error.message : 'Check failed',
      });
    }
  }

  // Best effort: chain boards are a per-club projection of the same games.
  let boardsRefreshed = 0;
  for (const weekId of weekIds) {
    try {
      const { data, error } = await supabase.functions.invoke('refresh-nfl-chain-boards', {
        body: { week_id: weekId },
      });
      if (!error && data?.ok !== false) boardsRefreshed += 1;
    } catch {
      // A club without chain boards is not an error for the score check.
    }
  }

  return { weeks, boardsRefreshed };
}

export function summarizeNflCheck(summary: NflCheckSummary): string {
  const { weeks } = summary;
  const failed = weeks.filter(week => !week.ok);
  const games = weeks.reduce((total, week) => total + week.upserts, 0);
  const finals = weeks.reduce((total, week) => total + week.finals, 0);
  const scored = weeks.reduce((total, week) => total + week.scoredUsers, 0);
  if (!weeks.length) return 'No weeks were available to check.';
  if (failed.length === weeks.length) return failed[0]?.error || 'Nothing could be checked. Try again shortly.';
  const tail = failed.length ? ` · ${failed.length} week${failed.length === 1 ? '' : 's'} need a retry` : '';
  const standings = scored ? ` · standings updated for ${scored} entr${scored === 1 ? 'y' : 'ies'}` : '';
  return `${games} game${games === 1 ? '' : 's'} refreshed · ${finals} final${standings}${tail}`;
}
