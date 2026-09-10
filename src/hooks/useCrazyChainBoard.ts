import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClub } from '@/contexts/ClubContext';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';
import { chainRpc } from '@/lib/nfl/chainBoardImport';
import type { NflGame, NflSeason } from '@/hooks/usePickem';
import { chainGameIsOpen, chainGameLockAt } from '../../supabase/functions/_shared/chainGameRules';

interface BoardState {
  mode?: 'per_game_48h' | 'per_game_30m'; games?: { game_id: string; lock_at: string; unlocked: boolean }[];
  lock_at: string | null; unlocked: boolean; catch_up: boolean; game_ids: string[];
  checked_at: string | null; warnings: string[];
}

export function useCrazyChainBoard(weekId: string | undefined, games: NflGame[], _season?: NflSeason | null) {
  const { club } = useClub();
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15_000); return () => window.clearInterval(timer); }, []);
  const query = useQuery({
    queryKey: ['crazy-chain-board-state', club?.id, weekId], enabled: !!club && !!weekId,
    refetchInterval: 60_000, retry: 1,
    queryFn: async ({ signal }) => {
      const { data, error } = await withTimeout(chainRpc(supabase, 'get_nfl_chain_board', { _week_id: weekId! })
        .abortSignal(signal), QUERY_TIMEOUT_MS, 'Crazy Chain board');
      // Fail closed during rollout; never offer per-game writes against legacy
      // whole-week server rules.
      if (error && /schema cache|does not exist/.test(error.message)) return { ready: false, board: null };
      if (error) throw new Error(error.message);
      const board = data as unknown as BoardState | null;
      return { ready: board?.mode === 'per_game_30m', board };
    },
  });
  const board = query.data?.board;
  const deadlines = games.filter(game => chainGameIsOpen(game,now)).map(chainGameLockAt);
  const lockAt = board?.lock_at ? new Date(board.lock_at) : deadlines.length ? new Date(Math.min(...deadlines)) : null;
  return { board, migrationReady: query.data?.ready || false,
    pickemMigrationReady: board?.mode === 'per_game_48h' || board?.mode === 'per_game_30m', lockAt, now,
    locked: !!query.error || !query.data?.ready || !board?.unlocked || deadlines.length === 0,
    loading: query.isLoading, error: query.error, refetch: query.refetch };
}
