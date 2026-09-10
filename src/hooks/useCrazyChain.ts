import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import type { ChainCardStatus, ChainLegStatus, ChainOperator } from '@/lib/nfl/crazyChain';

export interface CrazyChainMarket {
  id: string;
  club_id: string;
  season_id: string;
  week_id: string;
  game_id: string;
  market_type: string;
  subject_label: string;
  subject_team_id: string | null;
  subject_external_id: string | null;
  operator: ChainOperator;
  threshold: number;
  display_text: string;
  source_provider: string;
  external_id: string | null;
  status: 'open' | 'settled' | 'void';
  actual_value: number | null;
  result: boolean | null;
  settled_at: string | null;
  created_at: string;
  availability_status?: 'verified' | 'review';
  availability_checked_at?: string | null;
  availability_note?: string | null;
}

export interface CrazyChainLeg {
  id: string;
  entry_id: string;
  market_id: string;
  position: number;
  display_text: string;
  market_type: string;
  subject_label: string;
  operator: ChainOperator;
  threshold: number;
  status: ChainLegStatus;
  actual_value: number | null;
}

export interface CrazyChainEntry {
  id: string;
  club_id: string;
  season_id: string;
  week_id: string;
  user_id: string;
  status: ChainCardStatus;
  links_risked: number;
  hit_legs: number;
  missed_legs: number;
  void_legs: number;
  links_won: number;
  locked_at: string;
  settled_at: string | null;
  legs: CrazyChainLeg[];
  week_number?: number;
  week_label?: string;
}

export interface CrazyChainStanding {
  id: string;
  user_id: string;
  season_id: string;
  current_chain: number;
  best_chain: number;
  perfect_weeks: number;
  total_hit_legs: number;
  total_cards: number;
  busted_cards: number;
  longest_card: number;
  last_settled_week: number | null;
  rank: number | null;
  profiles?: { display_name: string; avatar_url: string | null } | null;
}

function friendlyChainError(error: unknown): string {
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message || '');
  if (/relation .*nfl_chain|schema cache/i.test(message)) {
    return 'Crazy Chain is waiting for its Game Center database update.';
  }
  return message || 'Crazy Chain could not be loaded.';
}

export function useCrazyChainMarkets(weekId?: string) {
  const { club } = useClub();
  const [markets, setMarkets] = useState<CrazyChainMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!weekId || !club) {
      setMarkets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('nfl_chain_markets')
      .select('*')
      .eq('club_id', club.id)
      .eq('week_id', weekId)
      .order('created_at');
    if (queryError) {
      setMarkets([]);
      setError(friendlyChainError(queryError));
    } else {
      setMarkets((data || []) as CrazyChainMarket[]);
      setError(null);
    }
    setLoading(false);
  }, [club, weekId]);

  useEffect(() => { void refetch(); }, [refetch]);
  return { markets, loading, error, refetch };
}

export function useMyCrazyChainEntry(weekId?: string) {
  const { user } = useAuth();
  const { club } = useClub();
  const [entry, setEntry] = useState<CrazyChainEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!weekId || !user || !club) {
      setEntry(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: entryData, error: entryError } = await supabase
      .from('nfl_chain_entries')
      .select('*')
      .eq('club_id', club.id)
      .eq('week_id', weekId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (entryError) {
      setEntry(null);
      setError(friendlyChainError(entryError));
      setLoading(false);
      return;
    }
    if (!entryData) {
      setEntry(null);
      setError(null);
      setLoading(false);
      return;
    }
    const { data: legData, error: legError } = await supabase
      .from('nfl_chain_legs')
      .select('*')
      .eq('entry_id', entryData.id)
      .order('position');
    if (legError) {
      setEntry(null);
      setError(friendlyChainError(legError));
    } else {
      setEntry({ ...entryData, legs: legData || [] } as CrazyChainEntry);
      setError(null);
    }
    setLoading(false);
  }, [club, user, weekId]);

  useEffect(() => { void refetch(); }, [refetch]);
  return { entry, loading, error, refetch };
}

export function useCrazyChainStandings(seasonId?: string) {
  const { club } = useClub();
  const [standings, setStandings] = useState<CrazyChainStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!seasonId || !club) {
      setStandings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from('nfl_chain_standings')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('club_id', club.id)
      .eq('season_id', seasonId)
      .order('rank', { ascending: true, nullsFirst: false });
    if (queryError) {
      setStandings([]);
      setError(friendlyChainError(queryError));
    } else {
      setStandings((data || []) as CrazyChainStanding[]);
      setError(null);
    }
    setLoading(false);
  }, [club, seasonId]);

  useEffect(() => { void refetch(); }, [refetch]);
  return { standings, loading, error, refetch };
}

export function useMyCrazyChainHistory(seasonId?: string) {
  const { user } = useAuth();
  const { club } = useClub();
  const [entries, setEntries] = useState<CrazyChainEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!seasonId || !user || !club) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: entryData, error: entryError } = await supabase
      .from('nfl_chain_entries')
      .select('*')
      .eq('club_id', club.id)
      .eq('season_id', seasonId)
      .eq('user_id', user.id)
      .order('locked_at', { ascending: false });
    if (entryError) {
      setEntries([]);
      setError(friendlyChainError(entryError));
      setLoading(false);
      return;
    }
    const rows = (entryData || []) as Omit<CrazyChainEntry, 'legs'>[];
    const entryIds = rows.map(row => row.id);
    const weekIds = [...new Set(rows.map(row => row.week_id))];
    const [legsResponse, weeksResponse] = await Promise.all([
      entryIds.length
        ? supabase.from('nfl_chain_legs').select('*').in('entry_id', entryIds).order('position')
        : Promise.resolve({ data: [], error: null }),
      weekIds.length
        ? supabase.from('nfl_weeks').select('id, week_number, label').in('id', weekIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (legsResponse.error || weeksResponse.error) {
      setEntries([]);
      setError(friendlyChainError(legsResponse.error || weeksResponse.error));
    } else {
      const weeks = new Map<string, { id: string; week_number: number; label: string | null }>(
        (weeksResponse.data || []).map(week => [week.id, week]),
      );
      const legs = (legsResponse.data || []) as CrazyChainLeg[];
      setEntries(rows.map(row => ({
        ...row,
        legs: legs.filter(leg => leg.entry_id === row.id),
        week_number: weeks.get(row.week_id)?.week_number,
        week_label: weeks.get(row.week_id)?.label,
      })) as CrazyChainEntry[]);
      setError(null);
    }
    setLoading(false);
  }, [club, seasonId, user]);

  useEffect(() => { void refetch(); }, [refetch]);
  return { entries, loading, error, refetch };
}

export async function saveCrazyChainCard(weekId: string, marketIds: string[]) {
  const { data, error } = await supabase.rpc('save_nfl_chain_card', {
    _week_id: weekId,
    _market_ids: marketIds,
  });
  if (error) throw error;
  return data;
}

export async function settleCrazyChainMarket(marketId: string, actualValue: number | null, voided = false) {
  const { data, error } = await supabase.rpc('settle_nfl_chain_market', {
    _market_id: marketId,
    _actual_value: actualValue,
    _void: voided,
  });
  if (error) throw error;
  return data;
}
