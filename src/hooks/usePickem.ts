import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useQuery } from '@tanstack/react-query';
import { withTimeout, QUERY_TIMEOUT_MS, HYDRATE_TIMEOUT_MS } from '@/lib/asyncGuards';
import { chainGameIsOpen, chainGameLockAt } from '../../supabase/functions/_shared/chainGameRules';

export type NflTeam = {
  id: string;
  abbr: string;
  name: string;
  city: string;
  conference: 'AFC' | 'NFC';
  division: 'North' | 'South' | 'East' | 'West';
  primary_color: string | null;
  logo_url: string | null;
};

export type NflSeason = {
  id: string;
  year: number;
  name: string;
  status: 'upcoming' | 'active' | 'complete';
  current_week: number;
  starts_at: string;
  ends_at: string;
  pick_lock_minutes: number;
  hide_unresolved_future_weeks: boolean;
  visible_week_window: number | null;
  require_finalized_schedule: boolean;
};

export type NflWeek = {
  id: string;
  season_id: string;
  week_number: number;
  label: string;
  starts_at: string;
  ends_at: string;
  status: 'upcoming' | 'open' | 'partially_locked' | 'closed' | 'scored';
  featured_game_id: string | null;
};

export type NflGame = {
  id: string;
  season_id: string;
  week_id: string;
  away_team_id: string;
  home_team_id: string;
  kickoff_at: string;
  chain_lock_at?: string | null;
  status: 'scheduled' | 'live' | 'final';
  away_score: number | null;
  home_score: number | null;
  winner_team_id: string | null;
  away_team?: NflTeam;
  home_team?: NflTeam;
};

export type NflPick = {
  id: string;
  user_id: string;
  game_id: string;
  week_id: string;
  season_id: string;
  picked_team_id: string;
  is_correct: boolean | null;
  points_awarded: number;
};

export type NflPickInsight = {
  game_id: string;
  total_picks: number;
  team_counts: Record<string, number>;
};

export type NflWeeklyStanding = {
  id: string;
  user_id: string;
  week_id: string;
  season_id: string;
  correct_picks: number;
  total_picks: number;
  accuracy: number;
  tiebreak_delta: number | null;
  rank: number | null;
  profiles?: { display_name: string; avatar_url: string | null };
};

export type NflSeasonStanding = {
  id: string;
  user_id: string;
  season_id: string;
  total_correct: number;
  total_picked: number;
  accuracy: number;
  weekly_wins: number;
  avg_weekly_rank: number | null;
  rank: number | null;
  profiles?: { display_name: string; avatar_url: string | null };
};

export type NflTeamRecord = {
  team_id: string;
  season_id: string;
  wins: number;
  losses: number;
  ties: number;
  games_played: number;
  point_diff_avg: number;
  /** Newest-left up to 5 chars: "WWLWL". May be null if no completed games. */
  recent_form: string | null;
};

/** Platform admins and owners can see commissioner-only Pick'em controls. */
export function usePickemAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    (supabase as any)
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'owner'])
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!cancelled) {
          setIsAdmin(!!data);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [user]);

  return { isAdmin, loading };
}

/* Active season */
export function useActiveSeason() {
  const [season, setSeason] = useState<NflSeason | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    // Prefer 'active', fall back to most recent 'upcoming'
    const { data: active } = await (supabase as any)
      .from('nfl_seasons')
      .select('*')
      .eq('status', 'active')
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (active) {
      setSeason(active);
      setLoading(false);
      return;
    }
    const { data: upcoming } = await (supabase as any)
      .from('nfl_seasons')
      .select('*')
      .eq('status', 'upcoming')
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle();
    setSeason(upcoming || null);
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);
  return { season, loading, refetch };
}

/* All teams (cached after first call) */
export function useTeams() {
  const [teams, setTeams] = useState<NflTeam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase as any).from('nfl_teams').select('*').order('abbr').then(({ data }: any) => {
      setTeams(data || []);
      setLoading(false);
    });
  }, []);

  return { teams, loading };
}

/* All weeks for a season */
export function useSeasonWeeks(seasonId?: string) {
  const query=useNflQuery(['weeks',seasonId],!!seasonId,async signal=>
    nflData(supabase.from('nfl_weeks').select('*').eq('season_id',seasonId!).order('week_number').abortSignal(signal)));
  return {weeks:(query.data || []) as NflWeek[],loading:query.isLoading,error:query.error?.message || null,refetch:query.refetch};
}

/* Current week (matches season.current_week) */
export function useCurrentWeek(season?: NflSeason | null) {
  const [week, setWeek] = useState<NflWeek | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!season) { setWeek(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('nfl_weeks')
      .select('*')
      .eq('season_id', season.id)
      .eq('week_number', season.current_week)
      .maybeSingle();
    setWeek(data || null);
    setLoading(false);
  }, [season]);

  useEffect(() => { refetch(); }, [refetch]);
  return { week, loading, refetch };
}

/* Games for a specific week, with team objects joined */
async function nflData<T>(request: PromiseLike<{data:T;error:{message:string}|null}>): Promise<T> {
  const {data,error}=await withTimeout(request,QUERY_TIMEOUT_MS,'NFL data');
  if(error) throw new Error(error.message);
  return data;
}
function useNflQuery<T>(key:(string|undefined)[],enabled:boolean,load:(signal:AbortSignal)=>Promise<T>) {
  const {club}=useClub();
  return useQuery({queryKey:['nfl-live',club?.id,...key],enabled:!!club && enabled,retry:1,refetchInterval:30_000,
    queryFn:({signal})=>withTimeout(load(signal),HYDRATE_TIMEOUT_MS,'NFL refresh')});
}
export function useWeekGames(weekId?: string) {
  const query=useNflQuery(['games',weekId],!!weekId,async signal=>{
    const [games,teams]=await Promise.all([
      nflData(supabase.from('nfl_games').select('*').eq('week_id',weekId!).order('kickoff_at').abortSignal(signal)),
      nflData(supabase.from('nfl_teams').select('*').abortSignal(signal)),
    ]);
    const teamMap=new Map((teams || []).map(team=>[team.id,team as NflTeam]));
    return (games || []).map(game=>({...game,away_team:teamMap.get(game.away_team_id),home_team:teamMap.get(game.home_team_id)})) as NflGame[];
  });
  return {games:query.data || [],loading:query.isLoading,error:query.error?.message || null,refetch:query.refetch};
}

export function useMyWeekPicks(weekId?: string) {
  const {user}=useAuth();
  const query=useNflQuery(['picks',weekId,user?.id],!!weekId && !!user,async signal=>
    nflData(supabase.from('nfl_picks').select('*').eq('week_id',weekId!).eq('user_id',user!.id).abortSignal(signal)));
  return {picks:(query.data || []) as NflPick[],loading:query.isLoading,error:query.error?.message || null,refetch:query.refetch};
}

export function useMyTiebreaker(weekId?: string) {
  const {user}=useAuth();
  const query=useNflQuery(['tiebreaker',weekId,user?.id],!!weekId && !!user,async signal=>
    nflData(supabase.from('nfl_tiebreakers').select('*').eq('week_id',weekId!).eq('user_id',user!.id).abortSignal(signal).maybeSingle()));
  return {tiebreaker:query.data || null,refetch:query.refetch};
}

export function useWeekPickInsights(weekId?: string, revealed = false) {
  const query=useNflQuery(['insights',weekId],!!weekId && revealed,async signal=>{
    const rows=await nflData(supabase.from('nfl_picks').select('game_id,picked_team_id').eq('week_id',weekId!).abortSignal(signal));
    const result=new Map<string,NflPickInsight>();
    for(const row of rows || []){
      const current=result.get(row.game_id) || {game_id:row.game_id,total_picks:0,team_counts:{}};
      current.total_picks++;current.team_counts[row.picked_team_id]=(current.team_counts[row.picked_team_id] || 0)+1;
      result.set(row.game_id,current);
    }
    return result;
  });
  return {insights:revealed?query.data || new Map<string,NflPickInsight>():new Map<string,NflPickInsight>(),loading:query.isLoading,refetch:query.refetch};
}

/* Save / upsert a pick */
export async function savePick(args: {
  user_id: string; game_id: string; week_id: string; season_id: string; picked_team_id: string;
}) {
  const { data, error } = await (supabase as any)
    .from('nfl_picks')
    .upsert(args, { onConflict: 'user_id,game_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function saveTiebreaker(args: {
  user_id: string; week_id: string; season_id: string; predicted_total: number;
}) {
  const { data, error } = await (supabase as any)
    .from('nfl_tiebreakers')
    .upsert(args, { onConflict: 'user_id,week_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* Weekly standings (for a week) */
export function useWeeklyStandings(weekId?: string) {
  const query=useNflQuery(['weekly-standings',weekId],!!weekId,async signal=>{
    const rows=await nflData(supabase.from('nfl_weekly_standings').select('*')
      .eq('week_id',weekId!).order('rank',{ascending:true,nullsFirst:false}).abortSignal(signal));
    if(!rows?.length) return [];
    const profiles=await nflData(supabase.from('profiles').select('id,display_name,avatar_url').in('id',rows.map(row=>row.user_id)).abortSignal(signal));
    return rows.map(row=>({...row,profiles:profiles?.find(profile=>profile.id===row.user_id)}));
  });
  return {standings:(query.data || []) as NflWeeklyStanding[],loading:query.isLoading,error:query.error?.message || null,refetch:query.refetch};
}

export function useSeasonStandings(seasonId?: string) {
  const query=useNflQuery(['season-standings',seasonId],!!seasonId,async signal=>{
    const rows=await nflData(supabase.from('nfl_season_standings').select('*')
      .eq('season_id',seasonId!).order('rank',{ascending:true,nullsFirst:false}).abortSignal(signal));
    if(!rows?.length) return [];
    const profiles=await nflData(supabase.from('profiles').select('id,display_name,avatar_url').in('id',rows.map(row=>row.user_id)).abortSignal(signal));
    return rows.map(row=>({...row,profiles:profiles?.find(profile=>profile.id===row.user_id)}));
  });
  return {standings:(query.data || []) as NflSeasonStanding[],loading:query.isLoading,error:query.error?.message || null,refetch:query.refetch};
}

export function useSeasonTeamRecords(seasonId?: string) {
  const [records, setRecords] = useState<Map<string, NflTeamRecord>>(new Map());
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!seasonId) { setRecords(new Map()); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('nfl_team_records')
      .select('*')
      .eq('season_id', seasonId);
    const map = new Map<string, NflTeamRecord>();
    for (const r of (data ?? []) as NflTeamRecord[]) map.set(r.team_id, r);
    setRecords(map);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { refetch(); }, [refetch]);

  // Records derive from nfl_games. When a game flips to 'final', the view
  // updates automatically — but we still need a client-side trigger to
  // refetch. Listen on the underlying table.
  useEffect(() => {
    if (!seasonId) return;
    const ch = supabase.channel(`nfl-team-records-${seasonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nfl_games', filter: `season_id=eq.${seasonId}` },
        () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [seasonId, refetch]);

  return { records, loading, refetch };
}

/* Helpers */
export function deriveWeekStatus(
  games: NflGame[],
  persistedStatus?: NflWeek['status'],
  nowMs = Date.now(),
): NflWeek['status'] {
  if (persistedStatus === 'scored') return 'scored';
  if (games.length === 0) return 'upcoming';
  const editable = games.filter((game) => chainGameIsOpen(game, nowMs)).length;
  if (editable === games.length) return 'open';
  return editable === 0 ? 'closed' : 'partially_locked';
}

/**
 * Returns the next individual game deadline (or the last deadline when closed).
 * Returns null if there are no games yet.
 */
export function weekLockAt(games: NflGame[], _season?: NflSeason | null, nowMs = Date.now()): Date | null {
  const open=games.filter(game=>chainGameIsOpen(game,nowMs)).map(chainGameLockAt);
  if(open.length) return new Date(Math.min(...open));
  const valid=games.map(chainGameLockAt).filter(Number.isFinite);
  return valid.length ? new Date(Math.max(...valid)) : null;
}
/** The week closes only when no matchup remains editable. */
export function isWeekLocked(games: NflGame[], _season?: NflSeason | null, nowMs = Date.now()): boolean {
  return games.length === 0 || !games.some(game=>chainGameIsOpen(game,nowMs));
}
export function isGameLocked(game: NflGame, _games?: NflGame[], _season?: NflSeason | null, nowMs = Date.now()): boolean {
  return !chainGameIsOpen(game,nowMs);
}
export function useWeekLock(games: NflGame[], season?: NflSeason | null) {
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  return {lockAt:weekLockAt(games,season,now),locked:isWeekLocked(games,season,now),now};
}



/** Delete a single pick (tap-to-unselect). */
export async function deleteMyPick(pickId: string) {
  const { data, error } = await withTimeout(supabase.from('nfl_picks').delete().eq('id', pickId).select('id'),QUERY_TIMEOUT_MS,'Remove pick');
  if (error) throw error;
  if (!data?.length) throw new Error('This pick could not be removed. The game may have just locked.');
}

/**
 * Apply commissioner visibility rules to the week list for non-admins.
 * Admins always see everything.
 */
export function filterVisibleWeeks(
  weeks: NflWeek[],
  season: NflSeason | null,
  weekGameCounts: Record<string, number>,
  isAdmin: boolean,
): NflWeek[] {
  if (!season || isAdmin) return weeks;
  let list = [...weeks];

  if (season.require_finalized_schedule) {
    list = list.filter((w) => (weekGameCounts[w.id] ?? 0) > 0);
  }

  if (season.hide_unresolved_future_weeks) {
    // Show all weeks up to the first non-scored week (inclusive).
    const sorted = [...list].sort((a, b) => a.week_number - b.week_number);
    const cutoffIdx = sorted.findIndex((w) => w.status !== 'scored');
    if (cutoffIdx >= 0) list = sorted.slice(0, cutoffIdx + 1);
  }

  if (season.visible_week_window && season.visible_week_window > 0) {
    const sorted = [...list].sort((a, b) => a.week_number - b.week_number);
    const firstUnscored = sorted.findIndex((w) => w.status !== 'scored');
    const start = firstUnscored < 0 ? 0 : firstUnscored;
    const scored = sorted.slice(0, start);
    const window = sorted.slice(start, start + season.visible_week_window);
    list = [...scored, ...window];
  }

  return list;
}

/** Lightweight count-of-games-per-week for visibility filtering. */
export function useSeasonWeekGameCounts(seasonId?: string) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!seasonId) { setCounts({}); setLoading(false); return; }
    setLoading(true);
    (supabase as any)
      .from('nfl_games')
      .select('week_id')
      .eq('season_id', seasonId)
      .then(({ data }: any) => {
        const acc: Record<string, number> = {};
        for (const row of data || []) acc[row.week_id] = (acc[row.week_id] ?? 0) + 1;
        setCounts(acc);
        setLoading(false);
      });
  }, [seasonId]);
  return { counts, loading };
}

/** Personal "lock my card" guard — localStorage only, per (user, week). */
export function useCardLock(userId?: string, weekId?: string) {
  const key = userId && weekId ? `dh_pickem_card_lock_v1:${userId}:${weekId}` : null;
  const [locked, setLocked] = useState<boolean>(() => {
    if (!key) return false;
    try { return localStorage.getItem(key) === '1'; } catch { return false; }
  });
  useEffect(() => {
    if (!key) { setLocked(false); return; }
    try { setLocked(localStorage.getItem(key) === '1'); } catch { setLocked(false); }
  }, [key]);
  const setAndPersist = useCallback((next: boolean) => {
    setLocked(next);
    if (!key) return;
    try {
      if (next) localStorage.setItem(key, '1');
      else localStorage.removeItem(key);
    } catch { /* ignore */ }
  }, [key]);
  return { locked, setLocked: setAndPersist };
}
