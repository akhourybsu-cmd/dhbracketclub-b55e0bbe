import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { withTimeout, QUERY_TIMEOUT_MS, HYDRATE_TIMEOUT_MS } from '@/lib/asyncGuards';
import { chainRpc } from '@/lib/nfl/chainBoardImport';
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
  void_reason?: string | null;
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
  game_id?: string;
  void_reason?: string | null;
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
  perfect_games?: number;
  pending_games?: number;
  profiles?: { display_name: string; avatar_url: string | null } | null;
}


export interface CrazyChainGameCard {
  entry_id: string; game_id: string; week_id: string; week_number: number; kickoff_at: string;
  chain_lock_at: string; status: ChainCardStatus; game_status: string; home_team_id: string; away_team_id: string;
  links_risked: number; hits: number; misses: number; voids: number; pending: number;
}
async function checked<T>(request: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const result = await withTimeout(request, QUERY_TIMEOUT_MS, 'NFL data');
  if (result.error) throw new Error(/schema cache|does not exist/.test(result.error.message)
    ? 'Apply the NFL per-game database update to enable this feature.' : result.error.message);
  return result.data;
}
function useChainQuery<T>(key: (string | undefined)[], enabled: boolean, queryFn: (signal: AbortSignal) => Promise<T>) {
  return useQuery({ queryKey: key, enabled, retry: 1, refetchInterval: 30_000,
    queryFn: ({ signal }) => withTimeout(queryFn(signal), HYDRATE_TIMEOUT_MS, 'Crazy Chain refresh') });
}
export function useCrazyChainMarkets(weekId?: string) {
  const { club } = useClub();
  const query = useChainQuery(['crazy-chain-markets',club?.id,weekId],!!club && !!weekId, async signal =>
    checked(supabase.from('nfl_chain_markets').select('*').eq('club_id',club!.id).eq('week_id',weekId!).order('created_at').abortSignal(signal)));
  return { markets: (query.data || []) as CrazyChainMarket[], loading: query.isLoading, error: query.error?.message || null, refetch: query.refetch };
}
export function useMyCrazyChainEntry(weekId?: string) {
  const { user } = useAuth(); const { club } = useClub();
  const query = useChainQuery(['crazy-chain-entry',club?.id,user?.id,weekId],!!club && !!user && !!weekId, async signal =>
    checked(supabase.from('nfl_chain_entries').select('*, legs:nfl_chain_legs(*)').eq('club_id',club!.id)
      .eq('week_id',weekId!).eq('user_id',user!.id).abortSignal(signal).maybeSingle()));
  return { entry: (query.data || null) as CrazyChainEntry | null, loading: query.isLoading, error: query.error?.message || null, refetch: query.refetch };
}
export function useCrazyChainStandings(seasonId?: string) {
  const { club } = useClub();
  const query = useChainQuery(['crazy-chain-standings',club?.id,seasonId],!!club && !!seasonId, async signal => {
    // The standings table only holds members who have locked a card, so the
    // board used to hide everyone else. Fill the roster in here so the league
    // shows every member from day one, with non-players sorted last.
    const [rows, members] = await Promise.all([
      checked(supabase.from('nfl_chain_standings').select('*, profiles:user_id(display_name, avatar_url)').eq('club_id',club!.id)
        .eq('season_id',seasonId!).order('rank',{ascending:true,nullsFirst:false}).order('user_id').abortSignal(signal)),
      checked(supabase.from('club_members').select('user_id').eq('club_id',club!.id).abortSignal(signal)),
    ]);
    const played = new Set((rows || []).map(row => row.user_id));
    const missing = (members || []).map(member => member.user_id).filter(id => !played.has(id));
    // club_members has no foreign key to profiles, so names come from a second read.
    const profiles = missing.length
      ? await checked(supabase.from('profiles').select('id, display_name, avatar_url').in('id',missing).abortSignal(signal))
      : [];
    const idle = missing.map(id => {
      const profile = (profiles || []).find(row => row.id === id);
      return {
        id: `roster-${id}`, user_id: id, season_id: seasonId!,
        current_chain: 0, best_chain: 0, perfect_weeks: 0, total_hit_legs: 0, total_cards: 0,
        busted_cards: 0, longest_card: 0, last_settled_week: null, rank: null,
        perfect_games: 0, pending_games: 0,
        profiles: profile ? { display_name: profile.display_name, avatar_url: profile.avatar_url } : null,
      };
    }) as CrazyChainStanding[];
    idle.sort((a, b) => (a.profiles?.display_name || '').localeCompare(b.profiles?.display_name || ''));
    return [...((rows || []) as unknown as CrazyChainStanding[]), ...idle];
  });
  return { standings: (query.data || []) as CrazyChainStanding[], loading: query.isLoading,
    error: query.error?.message || null, refetch: query.refetch, updatedAt: query.dataUpdatedAt };
}
export function useMyCrazyChainHistory(seasonId?: string) {
  const { user } = useAuth(); const { club } = useClub();
  const query = useChainQuery(['crazy-chain-history',club?.id,user?.id,seasonId],!!club && !!user && !!seasonId, async signal => {
    const rows = await checked(supabase.from('nfl_chain_entries').select('*, legs:nfl_chain_legs(*, market:nfl_chain_markets(game_id)), week:nfl_weeks(week_number,label)')
      .eq('club_id',club!.id).eq('season_id',seasonId!).eq('user_id',user!.id).order('locked_at',{ascending:false}).abortSignal(signal));
    return (rows || []).map(row => ({...row, legs:row.legs.map(leg=>({...leg,game_id:leg.market?.game_id})),week_number:row.week?.week_number, week_label:row.week?.label})) as CrazyChainEntry[];
  });
  return { entries: query.data || [], loading: query.isLoading, error: query.error?.message || null, refetch: query.refetch };
}
export function useMyCrazyChainGameCards(weekId?: string, seasonId?: string, enabled = true) {
  const { user } = useAuth(); const { club } = useClub();
  const query = useChainQuery(['crazy-chain-game-cards',club?.id,user?.id,weekId,seasonId],enabled && !!club && !!user && !!(weekId || seasonId), async signal => {
    // New security-invoker view; generated types follow database deployment.
    let request = (supabase as SupabaseClient).from('nfl_chain_game_cards').select('*').eq('club_id',club!.id).eq('user_id',user!.id);
    if (weekId) request = request.eq('week_id',weekId);
    if (seasonId) request = request.eq('season_id',seasonId);
    return await checked(request.order('kickoff_at').abortSignal(signal)) as CrazyChainGameCard[];
  });
  return { cards: query.data || [], loading: query.isLoading, error: query.error?.message || null, refetch: query.refetch };
}
export async function saveCrazyChainGame(gameId: string, marketIds: string[]) {
  return checked(chainRpc(supabase,'save_nfl_chain_game',{_game_id:gameId,_market_ids:marketIds}).abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)));
}
export async function saveCrazyChainCard(weekId: string, marketIds: string[]) {
  return checked(supabase.rpc('save_nfl_chain_card',{_week_id:weekId,_market_ids:marketIds}).abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)));
}
export async function settleCrazyChainMarket(marketId: string, actualValue: number | null, voided = false) {
  return checked(supabase.rpc('settle_nfl_chain_market',{_market_id:marketId,_actual_value:actualValue,_void:voided}).abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)));
}
