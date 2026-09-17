import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface PwSeason {
  id: string;
  club_id: string;
  year: number;
  quarter: number;
  starts_on: string;
  ends_on: string;
  status: 'upcoming' | 'active' | 'completed';
  starting_cash: number;
  finalized_at: string | null;
}

export interface PwPortfolio {
  id: string;
  season_id: string;
  club_id: string;
  user_id: string;
  cash: number;
  holdings_value: number;
  total_value: number;
  valued_at: string | null;
  final_rank: number | null;
}

export interface PwHolding {
  id: string;
  portfolio_id: string;
  symbol: string;
  shares: number;
  avg_cost: number;
}

export interface PwTrade {
  id: string;
  portfolio_id: string;
  user_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
  amount: number;
  realized_pl: number | null;
  trading_date: string;
  created_at: string;
}

export interface PwQuote {
  symbol: string;
  price: number;
  prev_close: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  fetched_at: string;
}

export interface PwSettings {
  club_id: string;
  starting_cash: number;
  max_trades_per_day: number;
  max_position_pct: number;
}

export interface PwSymbol {
  symbol: string;
  name: string;
  exchange: string | null;
}

const db = supabase as any;

/* ── Season + settings ─────────────────────────────────────────────── */

/** Ensures the club has an active quarterly season and the member has a portfolio. */
export function usePwSeason() {
  const { club } = useClub();
  const { user } = useAuth();
  const clubId = club?.id;
  return useQuery({
    queryKey: ['pw-season', clubId, user?.id],
    enabled: !!clubId && !!user?.id,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data: existing } = await db.from('pw_seasons').select('*')
        .eq('club_id', clubId).eq('status', 'active')
        .order('starts_on', { ascending: false }).limit(1).maybeSingle();

      let season = existing as PwSeason | null;
      if (!season) {
        const { error } = await supabase.functions.invoke('pw-bootstrap', { body: { club_id: clubId } });
        if (error) throw error;
        const { data: fresh } = await db.from('pw_seasons').select('*')
          .eq('club_id', clubId).eq('status', 'active')
          .order('starts_on', { ascending: false }).limit(1).maybeSingle();
        season = fresh as PwSeason | null;
      }
      if (!season) return null;

      const { data: portfolio } = await db.from('pw_portfolios').select('*')
        .eq('season_id', season.id).eq('user_id', user!.id).maybeSingle();
      if (!portfolio) {
        await supabase.functions.invoke('pw-bootstrap', { body: { club_id: clubId } });
      }
      return season;
    },
  });
}

export function usePwSettings() {
  const { club } = useClub();
  const clubId = club?.id;
  return useQuery({
    queryKey: ['pw-settings', clubId],
    enabled: !!clubId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data } = await db.from('pw_league_settings').select('*').eq('club_id', clubId).maybeSingle();
      return (data as PwSettings) ?? {
        club_id: clubId!, starting_cash: 50000, max_trades_per_day: 5, max_position_pct: 40,
      };
    },
  });
}

/* ── Portfolio ─────────────────────────────────────────────────────── */

export function usePwPortfolio(seasonId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['pw-portfolio', seasonId, user?.id],
    enabled: !!seasonId && !!user?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: portfolio } = await db.from('pw_portfolios').select('*')
        .eq('season_id', seasonId).eq('user_id', user!.id).maybeSingle();
      if (!portfolio) return null;
      const { data: holdings } = await db.from('pw_holdings').select('*')
        .eq('portfolio_id', portfolio.id).order('symbol');
      return {
        portfolio: portfolio as PwPortfolio,
        holdings: (holdings ?? []) as PwHolding[],
      };
    },
  });
}

export function usePwTradesToday(portfolioId?: string) {
  return useQuery({
    queryKey: ['pw-trades-today', portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      const { count } = await db.from('pw_trades')
        .select('id', { count: 'exact', head: true })
        .eq('portfolio_id', portfolioId).eq('trading_date', today);
      return count ?? 0;
    },
    staleTime: 1000 * 10,
  });
}

export function usePwMyTrades(portfolioId?: string, limit = 40) {
  return useQuery({
    queryKey: ['pw-my-trades', portfolioId, limit],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data } = await db.from('pw_trades').select('*')
        .eq('portfolio_id', portfolioId).order('created_at', { ascending: false }).limit(limit);
      return (data ?? []) as PwTrade[];
    },
  });
}

export function usePwEquityCurve(portfolioId?: string) {
  return useQuery({
    queryKey: ['pw-equity', portfolioId],
    enabled: !!portfolioId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data } = await db.from('pw_daily_values')
        .select('trading_date, value').eq('portfolio_id', portfolioId)
        .order('trading_date', { ascending: true });
      return (data ?? []) as Array<{ trading_date: string; value: number }>;
    },
  });
}

/* ── Quotes ────────────────────────────────────────────────────────── */

/** Shared quote cache for a set of symbols, refreshed server-side. */
export function usePwQuotes(symbols: string[], enabled = true) {
  const key = useMemo(() => [...new Set(symbols)].sort().join(','), [symbols]);
  return useQuery({
    queryKey: ['pw-quotes', key],
    enabled: enabled && !!key,
    refetchInterval: 30_000,
    queryFn: async () => {
      const list = key.split(',').filter(Boolean);
      await supabase.functions.invoke('pw-quotes-refresh', { body: { symbols: list } })
        .catch(() => null);
      const { data } = await db.from('pw_quotes').select('*').in('symbol', list);
      const map: Record<string, PwQuote> = {};
      for (const q of (data ?? []) as PwQuote[]) map[q.symbol] = q;
      return map;
    },
  });
}

export function usePwSymbolSearch(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ['pw-symbol-search', q.toUpperCase()],
    enabled: q.length >= 1,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const upper = q.toUpperCase();
      const { data: bySymbol } = await db.from('pw_symbols')
        .select('symbol, name, exchange').eq('active', true)
        .like('symbol', `${upper}%`).order('symbol').limit(12);
      const { data: byName } = await db.from('pw_symbols')
        .select('symbol, name, exchange').eq('active', true)
        .ilike('name', `%${q}%`).order('symbol').limit(12);
      const seen = new Set<string>();
      const out: PwSymbol[] = [];
      for (const row of [...(bySymbol ?? []), ...(byName ?? [])] as PwSymbol[]) {
        if (seen.has(row.symbol)) continue;
        seen.add(row.symbol);
        out.push(row);
      }
      return out.slice(0, 16);
    },
  });
}

/* ── Leaderboard + activity ────────────────────────────────────────── */

export interface PwStanding extends PwPortfolio {
  profile: { id: string; display_name: string | null; avatar_url: string | null } | null;
  return_pct: number;
  top_holding: { symbol: string; value: number } | null;
}

export function usePwLeaderboard(seasonId?: string, startingCash = 50000) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['pw-standings', seasonId],
    enabled: !!seasonId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: portfolios } = await db.from('pw_portfolios').select('*').eq('season_id', seasonId);
      const rows = (portfolios ?? []) as PwPortfolio[];
      if (!rows.length) return [] as PwStanding[];

      const ids = rows.map((p) => p.id);
      const [{ data: profs }, { data: holdings }, { data: quotes }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url').in('id', rows.map((r) => r.user_id)),
        db.from('pw_holdings').select('portfolio_id, symbol, shares, avg_cost').in('portfolio_id', ids),
        db.from('pw_quotes').select('symbol, price'),
      ]);
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      const priceOf = new Map(((quotes ?? []) as any[]).map((q) => [q.symbol, Number(q.price)]));
      const topOf = new Map<string, { symbol: string; value: number }>();
      for (const h of ((holdings ?? []) as any[])) {
        const value = Number(h.shares) * (priceOf.get(h.symbol) ?? Number(h.avg_cost));
        const cur = topOf.get(h.portfolio_id);
        if (!cur || value > cur.value) topOf.set(h.portfolio_id, { symbol: h.symbol, value });
      }

      return rows.map((p) => ({
        ...p,
        profile: profMap.get(p.user_id) ?? null,
        return_pct: ((Number(p.total_value) - startingCash) / startingCash) * 100,
        top_holding: topOf.get(p.id) ?? null,
      })).sort((a, b) => Number(b.total_value) - Number(a.total_value)) as PwStanding[];
    },
  });

  useEffect(() => {
    if (!seasonId) return;
    const channel = supabase.channel(`pw-standings-${seasonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pw_portfolios', filter: `season_id=eq.${seasonId}` },
        () => qc.invalidateQueries({ queryKey: ['pw-standings', seasonId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [seasonId, qc]);

  return query;
}

export interface PwActivityItem extends PwTrade {
  profile: { display_name: string | null; avatar_url: string | null } | null;
}

export function usePwActivity(seasonId?: string, limit = 50) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['pw-activity', seasonId, limit],
    enabled: !!seasonId,
    queryFn: async () => {
      const { data: trades } = await db.from('pw_trades').select('*')
        .eq('season_id', seasonId).order('created_at', { ascending: false }).limit(limit);
      const rows = (trades ?? []) as PwTrade[];
      if (!rows.length) return [] as PwActivityItem[];
      const { data: profs } = await supabase.from('profiles')
        .select('id, display_name, avatar_url').in('id', [...new Set(rows.map((t) => t.user_id))]);
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return rows.map((t) => ({ ...t, profile: profMap.get(t.user_id) ?? null }));
    },
  });

  useEffect(() => {
    if (!seasonId) return;
    const channel = supabase.channel(`pw-activity-${seasonId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pw_trades', filter: `season_id=eq.${seasonId}` },
        () => qc.invalidateQueries({ queryKey: ['pw-activity', seasonId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [seasonId, qc]);

  return query;
}

/* ── Past seasons ──────────────────────────────────────────────────── */

export function usePwPastSeasons() {
  const { club } = useClub();
  const clubId = club?.id;
  return useQuery({
    queryKey: ['pw-past-seasons', clubId],
    enabled: !!clubId,
    queryFn: async () => {
      const { data: seasons } = await db.from('pw_seasons').select('*')
        .eq('club_id', clubId).eq('status', 'completed')
        .order('year', { ascending: false }).order('quarter', { ascending: false });
      const rows = (seasons ?? []) as PwSeason[];
      if (!rows.length) return [] as Array<PwSeason & { winner: { display_name: string | null; total_value: number } | null }>;
      const { data: winners } = await db.from('pw_portfolios')
        .select('season_id, user_id, total_value, final_rank')
        .in('season_id', rows.map((s) => s.id)).eq('final_rank', 1);
      const { data: profs } = winners?.length
        ? await supabase.from('profiles').select('id, display_name')
          .in('id', (winners as any[]).map((w) => w.user_id))
        : { data: [] as any[] };
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      const winMap = new Map(((winners ?? []) as any[]).map((w) => [w.season_id, {
        display_name: profMap.get(w.user_id)?.display_name ?? null,
        total_value: Number(w.total_value),
      }]));
      return rows.map((s) => ({ ...s, winner: winMap.get(s.id) ?? null }));
    },
  });
}

/* ── Trading ───────────────────────────────────────────────────────── */

export interface PwTradeResult {
  ok: boolean;
  symbol: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
  amount: number;
  realized_pl: number | null;
  cash: number;
  total_value: number;
  trades_today: number;
  trade_limit: number;
}

export function usePwTrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      seasonId: string; symbol: string; side: 'buy' | 'sell';
      shares?: number; amount?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('pw-trade', {
        body: {
          season_id: input.seasonId,
          symbol: input.symbol,
          side: input.side,
          shares: input.shares,
          amount: input.amount,
        },
      });
      if (error) {
        // Surface the server's message rather than a generic edge-function error.
        const ctx = (error as any).context;
        let message = error.message;
        try {
          const body = await ctx?.json?.();
          if (body?.error) message = typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
        } catch { /* keep default */ }
        throw new Error(message);
      }
      if ((data as any)?.error) throw new Error(String((data as any).error));
      return data as PwTradeResult;
    },
    onSuccess: () => {
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
