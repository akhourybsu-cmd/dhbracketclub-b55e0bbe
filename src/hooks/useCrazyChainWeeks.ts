import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClub } from '@/contexts/ClubContext';
import { withTimeout, QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';

export interface CrazyChainBoardWeek {
  id: string;
  week_number: number;
  label: string;
  starts_at: string;
  marketCount: number;
}

export function chooseChainBoardWeek(weeks: CrazyChainBoardWeek[], requested: number, current = 1) {
  const sorted = [...weeks].sort((a, b) => a.week_number - b.week_number);
  return sorted.find(week => week.week_number === requested)
    || sorted.find(week => week.week_number === current && week.marketCount > 0)
    || sorted.find(week => week.week_number >= current && week.marketCount > 0)
    || sorted.find(week => week.week_number === current)
    || sorted[0];
}

export function useCrazyChainWeeks(seasonId?: string) {
  const { club } = useClub();
  const query = useQuery({
    queryKey: ['crazy-chain-board-weeks', club?.id, seasonId],
    enabled: !!club && !!seasonId,
    queryFn: async ({ signal }) => {
      const { data, error } = await withTimeout(supabase.from('nfl_weeks')
        .select('id,week_number,label,starts_at,markets:nfl_chain_markets(count)')
        .eq('season_id', seasonId!).eq('markets.club_id', club!.id)
        .order('week_number').abortSignal(signal), QUERY_TIMEOUT_MS, 'Crazy Chain weeks');
      if (error) throw new Error(error.message);
      return (data || []).map(week => ({
        id: week.id, week_number: week.week_number, label: week.label, starts_at: week.starts_at,
        marketCount: week.markets?.[0]?.count || 0,
      })) as CrazyChainBoardWeek[];
    },
  });
  return { weeks: query.data || [], loading: query.isFetching, error: query.error, refetch: query.refetch };
}
