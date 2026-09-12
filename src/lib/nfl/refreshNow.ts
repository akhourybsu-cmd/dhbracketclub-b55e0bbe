import { supabase } from '@/integrations/supabase/client';

export interface NflCheckResult {
  weekNumber: number;
  ok: boolean;
  upserts: number;
  finals: number;
  scoredUsers: number;
  error?: string;
}

/**
 * Admin-triggered "check everything now" pass. `sync-nfl-week` pulls the ESPN
 * slate/scores for a week and, when games are final, scores Pick'em and the
 * Crazy Chain in the same call — so refreshing the recent weeks is enough to
 * bring standings fully up to date without waiting for the nightly job.
 */
export async function runNflCheck(seasonYear: number, currentWeek: number): Promise<NflCheckResult[]> {
  const weekNumbers = [...new Set([currentWeek - 1, currentWeek, currentWeek + 1])]
    .filter(week => week >= 1 && week <= 18);
  const results: NflCheckResult[] = [];
  for (const weekNumber of weekNumbers) {
    try {
      const { data, error } = await supabase.functions.invoke('sync-nfl-week', {
        body: { season_year: seasonYear, week_number: weekNumber },
      });
      if (error) throw error;
      results.push({
        weekNumber, ok: data?.ok !== false,
        upserts: data?.upserts ?? 0, finals: data?.finals ?? 0,
        scoredUsers: data?.scored?.scored_users ?? 0,
        error: data?.error,
      });
    } catch (error) {
      results.push({
        weekNumber, ok: false, upserts: 0, finals: 0, scoredUsers: 0,
        error: error instanceof Error ? error.message : 'Check failed',
      });
    }
  }
  return results;
}

export function summarizeNflCheck(results: NflCheckResult[]): string {
  const failed = results.filter(result => !result.ok);
  const games = results.reduce((total, result) => total + result.upserts, 0);
  const finals = results.reduce((total, result) => total + result.finals, 0);
  if (failed.length === results.length) return failed[0]?.error || 'Nothing could be checked. Try again shortly.';
  const tail = failed.length ? ` · ${failed.length} week${failed.length === 1 ? '' : 's'} need a retry` : '';
  return `${games} game${games === 1 ? '' : 's'} refreshed · ${finals} final${tail}`;
}
