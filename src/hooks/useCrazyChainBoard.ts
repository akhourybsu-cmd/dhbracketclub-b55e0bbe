import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClub } from '@/contexts/ClubContext';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';
import { chainRpc } from '@/lib/nfl/chainBoardImport';
import { useWeekLock, type NflGame, type NflSeason } from '@/hooks/usePickem';

interface BoardState {
  lock_at: string; unlocked: boolean; catch_up: boolean; game_ids: string[];
  checked_at: string | null; warnings: string[];
}

export function useCrazyChainBoard(weekId: string | undefined, games: NflGame[], season?: NflSeason | null) {
  const { club } = useClub();
  const legacy = useWeekLock(games, season);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15_000); return () => window.clearInterval(timer); }, []);
  const query = useQuery({
    queryKey: ['crazy-chain-board-state', club?.id, weekId], enabled: !!club && !!weekId,
    refetchInterval: 60_000, retry: 1,
    queryFn: async ({ signal }) => {
      const { data, error } = await withTimeout(chainRpc(supabase, 'get_nfl_chain_board', { _week_id: weekId! })
        .abortSignal(signal), QUERY_TIMEOUT_MS, 'Crazy Chain board');
      // Keep existing full-week play working during rollout. A catch-up card stays
      // locked under the old server rules until the migration is actually applied.
      if (error && /schema cache|does not exist/.test(error.message)) return { ready: false, board: null };
      if (error) throw new Error(error.message);
      return { ready: true, board: data as unknown as BoardState | null };
    },
  });
  const board = query.data?.board;
  const lockAt = board?.lock_at ? new Date(board.lock_at) : legacy.lockAt;
  return { board, migrationReady: query.data?.ready || false, lockAt, now,
    locked: !!query.error || (board ? !board.unlocked || !lockAt || now >= lockAt.getTime() : legacy.locked),
    loading: query.isLoading, error: query.error, refetch: query.refetch };
}
