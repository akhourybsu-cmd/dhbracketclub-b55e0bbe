import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';

/**
 * Trading-desk extras for Portfolio Wars: personal watchlists, resting orders
 * (limit + queued-while-closed), price alerts, and full stock detail data.
 *
 * Orders are never written from the client — `pw_orders` has no insert policy.
 * Everything goes through the `pw-order` edge function so market hours, cash,
 * caps and symbol validity stay server-authoritative.
 */

const db = supabase as any;

/* ── Types ─────────────────────────────────────────────────────────── */

export interface PwWatchlist {
  id: string;
  name: string;
  sort_order: number;
  items: PwWatchlistItem[];
}

export interface PwWatchlistItem {
  id: string;
  watchlist_id: string;
  symbol: string;
  note: string | null;
  sort_order: number;
}

export interface PwOrder {
  id: string;
  season_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  order_type: 'market' | 'limit';
  shares: number | null;
  amount: number | null;
  limit_price: number | null;
  time_in_force: 'day' | 'gtc';
  status: 'open' | 'filled' | 'cancelled' | 'expired' | 'rejected';
  filled_shares: number | null;
  filled_price: number | null;
  filled_at: string | null;
  reject_reason: string | null;
  created_at: string;
}

export interface PwAlert {
  id: string;
  symbol: string;
  direction: 'above' | 'below';
  target_price: number;
  status: 'armed' | 'triggered' | 'cancelled';
  triggered_at: string | null;
  triggered_price: number | null;
  created_at: string;
}

export interface PwStockDetail {
  symbol: string;
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prev_close: number | null;
  profile: {
    name: string | null;
    exchange: string | null;
    industry: string | null;
    logo: string | null;
    market_cap: number | null;
    ipo: string | null;
    weburl: string | null;
  };
  stats: {
    week52_high: number | null;
    week52_low: number | null;
    pe: number | null;
    beta: number | null;
    dividend_yield: number | null;
    avg_volume_10d: number | null;
  };
  series: { t: number; c: number }[];
  range: '3m' | '1y';
}

/* ── Watchlists ────────────────────────────────────────────────────── */

export function usePwWatchlists() {
  const { user } = useAuth();
  const { club } = useClub();
  return useQuery<PwWatchlist[]>({
    queryKey: ['pw-watchlists', club?.id, user?.id],
    enabled: !!user?.id && !!club?.id,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data: lists, error } = await db
        .from('pw_watchlists')
        .select('id, name, sort_order')
        .eq('user_id', user!.id)
        .eq('club_id', club!.id)
        .order('sort_order');
      if (error) throw error;
      const ids = (lists ?? []).map((l: any) => l.id);
      let items: PwWatchlistItem[] = [];
      if (ids.length) {
        const { data: rows, error: itemErr } = await db
          .from('pw_watchlist_items')
          .select('id, watchlist_id, symbol, note, sort_order')
          .in('watchlist_id', ids)
          .order('sort_order');
        if (itemErr) throw itemErr;
        items = (rows ?? []) as PwWatchlistItem[];
      }
      return (lists ?? []).map((l: any) => ({
        ...l,
        items: items.filter((i) => i.watchlist_id === l.id),
      }));
    },
  });
}

export function usePwWatchlistMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { club } = useClub();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['pw-watchlists'] });

  const createList = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await db.from('pw_watchlists')
        .insert({ user_id: user!.id, club_id: club!.id, name: name.trim().slice(0, 60) })
        .select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
  });

  const renameList = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await db.from('pw_watchlists')
        .update({ name: name.trim().slice(0, 60) }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('pw_watchlists').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addSymbol = useMutation({
    mutationFn: async ({ watchlistId, symbol }: { watchlistId: string; symbol: string }) => {
      const { error } = await db.from('pw_watchlist_items').insert({
        watchlist_id: watchlistId,
        user_id: user!.id,
        symbol: symbol.toUpperCase().trim(),
      });
      if (error && !`${error.message}`.includes('duplicate')) throw error;
    },
    onSuccess: invalidate,
  });

  const removeSymbol = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await db.from('pw_watchlist_items').delete().eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { createList, renameList, deleteList, addSymbol, removeSymbol };
}

/* ── Orders ────────────────────────────────────────────────────────── */

export function usePwOrders(seasonId?: string) {
  const { user } = useAuth();
  return useQuery<PwOrder[]>({
    queryKey: ['pw-orders', seasonId, user?.id],
    enabled: !!seasonId && !!user?.id,
    refetchInterval: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await db
        .from('pw_orders')
        .select('id, season_id, symbol, side, order_type, shares, amount, limit_price, time_in_force, status, filled_shares, filled_price, filled_at, reject_reason, created_at')
        .eq('season_id', seasonId)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data ?? []) as PwOrder[];
    },
  });
}

export interface PwOrderInput {
  seasonId: string;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  shares?: number;
  amount?: number;
  limitPrice?: number;
  timeInForce?: 'day' | 'gtc';
}

export interface PwOrderResult {
  ok: boolean;
  status: 'filled' | 'open';
  market_open: boolean;
  fill?: { symbol: string; side: string; shares: number; price: number; amount: number; cash: number; realized_pl: number | null };
  order?: PwOrder;
}

export function usePwPlaceOrder() {
  const qc = useQueryClient();
  return useMutation<PwOrderResult, Error, PwOrderInput>({
    mutationFn: async (input) => {
      const data = await invokeFn('pw-order', {
          season_id: input.seasonId,
          symbol: input.symbol,
          side: input.side,
          order_type: input.orderType,
          shares: input.shares,
          amount: input.amount,
          limit_price: input.limitPrice,
          time_in_force: input.timeInForce ?? 'gtc',
      });
      return data as PwOrderResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pw-orders'] });
      qc.invalidateQueries({ queryKey: ['pw-portfolio'] });
      qc.invalidateQueries({ queryKey: ['pw-trades-today'] });
      qc.invalidateQueries({ queryKey: ['pw-my-trades'] });
      qc.invalidateQueries({ queryKey: ['pw-standings'] });
      qc.invalidateQueries({ queryKey: ['pw-activity'] });
      qc.invalidateQueries({ queryKey: ['pw-equity'] });
      qc.invalidateQueries({ queryKey: ['pw-quotes'] });
    },
  });
}

export function usePwCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await db.from('pw_orders')
        .update({ status: 'cancelled' }).eq('id', orderId).eq('status', 'open');
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pw-orders'] }),
  });
}

/* ── Price alerts ──────────────────────────────────────────────────── */

export function usePwAlerts() {
  const { user } = useAuth();
  const { club } = useClub();
  return useQuery<PwAlert[]>({
    queryKey: ['pw-alerts', club?.id, user?.id],
    enabled: !!user?.id && !!club?.id,
    refetchInterval: 1000 * 60,
    queryFn: async () => {
      const { data, error } = await db
        .from('pw_price_alerts')
        .select('id, symbol, direction, target_price, status, triggered_at, triggered_price, created_at')
        .eq('user_id', user!.id)
        .eq('club_id', club!.id)
        .order('created_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as PwAlert[];
    },
  });
}

export function usePwAlertMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { club } = useClub();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['pw-alerts'] });

  const createAlert = useMutation({
    mutationFn: async ({ symbol, direction, targetPrice }: { symbol: string; direction: 'above' | 'below'; targetPrice: number }) => {
      const { error } = await db.from('pw_price_alerts').insert({
        user_id: user!.id,
        club_id: club!.id,
        symbol: symbol.toUpperCase().trim(),
        direction,
        target_price: targetPrice,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const cancelAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('pw_price_alerts')
        .update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const clearAlert = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('pw_price_alerts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { createAlert, cancelAlert, clearAlert };
}

/* ── Stock detail ──────────────────────────────────────────────────── */

export function usePwStock(symbol?: string, range: '3m' | '1y' = '3m') {
  return useQuery<PwStockDetail>({
    queryKey: ['pw-stock', symbol, range],
    enabled: !!symbol,
    staleTime: 1000 * 20,
    refetchInterval: 1000 * 60,
    queryFn: async () => {
      const data = await invokeFn('pw-stock', { symbol, range });
      return data as PwStockDetail;
    },
  });
}

/**
 * Calls an edge function and surfaces the server's own error message.
 * supabase-js hides the response body on non-2xx, so read it off `context`.
 */
async function invokeFn(name: string, body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    const ctx = (error as any).context;
    if (ctx && typeof ctx.json === 'function') {
      const payload = await ctx.json().catch(() => null);
      if (payload && typeof payload.error === 'string') message = payload.error;
    }
    throw new Error(message || 'Something went wrong');
  }
  if (data && typeof data.error === 'string') throw new Error(data.error);
  return data;
}
