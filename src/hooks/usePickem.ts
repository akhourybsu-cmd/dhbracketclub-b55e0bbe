import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  const [weeks, setWeeks] = useState<NflWeek[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!seasonId) { setWeeks([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('nfl_weeks')
      .select('*')
      .eq('season_id', seasonId)
      .order('week_number');
    setWeeks(data || []);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { refetch(); }, [refetch]);
  return { weeks, loading, refetch };
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
export function useWeekGames(weekId?: string) {
  const [games, setGames] = useState<NflGame[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!weekId) { setGames([]); setLoading(false); return; }
    setLoading(true);
    const [{ data: gamesData }, { data: teamsData }] = await Promise.all([
      (supabase as any).from('nfl_games').select('*').eq('week_id', weekId).order('kickoff_at'),
      (supabase as any).from('nfl_teams').select('*'),
    ]);
    const teamMap = new Map<string, NflTeam>((teamsData || []).map((t: NflTeam) => [t.id, t]));
    const enriched = (gamesData || []).map((g: NflGame) => ({
      ...g,
      away_team: teamMap.get(g.away_team_id),
      home_team: teamMap.get(g.home_team_id),
    }));
    setGames(enriched);
    setLoading(false);
  }, [weekId]);

  useEffect(() => { refetch(); }, [refetch]);

  // Realtime: refresh on game updates for this week
  useEffect(() => {
    if (!weekId) return;
    const channel = supabase.channel(`nfl-games-${weekId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nfl_games', filter: `week_id=eq.${weekId}` },
        () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [weekId, refetch]);

  // Defensive poll while ANY game in the slate is live. Realtime usually
  // catches DB writes within seconds, but if the websocket drops or a
  // sync invocation just lands on the server, this guarantees viewers
  // never sit on stale scores during a live slate.
  const hasLiveGame = games.some((g) => g.status === 'live');
  useEffect(() => {
    if (!weekId || !hasLiveGame) return;
    const id = window.setInterval(refetch, 30_000);
    return () => window.clearInterval(id);
  }, [weekId, hasLiveGame, refetch]);

  return { games, loading, refetch };
}

/* User's picks for a week */
export function useMyWeekPicks(weekId?: string) {
  const { user } = useAuth();
  const [picks, setPicks] = useState<NflPick[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!weekId || !user) { setPicks([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('nfl_picks')
      .select('*')
      .eq('week_id', weekId)
      .eq('user_id', user.id);
    setPicks(data || []);
    setLoading(false);
  }, [weekId, user]);

  useEffect(() => { refetch(); }, [refetch]);
  return { picks, loading, refetch };
}

/* User's tiebreaker for a week */
export function useMyTiebreaker(weekId?: string) {
  const { user } = useAuth();
  const [tiebreaker, setTiebreaker] = useState<any>(null);

  const refetch = useCallback(async () => {
    if (!weekId || !user) { setTiebreaker(null); return; }
    const { data } = await (supabase as any)
      .from('nfl_tiebreakers')
      .select('*')
      .eq('week_id', weekId)
      .eq('user_id', user.id)
      .maybeSingle();
    setTiebreaker(data || null);
  }, [weekId, user]);

  useEffect(() => { refetch(); }, [refetch]);
  return { tiebreaker, refetch };
}

/**
 * Club pick totals become visible only after the server-side week lock.
 * The matching RLS policy still protects unrevealed picks if a client clock
 * is wrong or this query is called early.
 */
export function useWeekPickInsights(weekId?: string, revealed = false) {
  const [insights, setInsights] = useState<Map<string, NflPickInsight>>(new Map());
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!weekId || !revealed) {
      setInsights(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('nfl_picks')
      .select('game_id, picked_team_id')
      .eq('week_id', weekId);
    const next = new Map<string, NflPickInsight>();
    for (const row of data || []) {
      const current = next.get(row.game_id) ?? {
        game_id: row.game_id,
        total_picks: 0,
        team_counts: {},
      };
      current.total_picks += 1;
      current.team_counts[row.picked_team_id] = (current.team_counts[row.picked_team_id] ?? 0) + 1;
      next.set(row.game_id, current);
    }
    setInsights(next);
    setLoading(false);
  }, [weekId, revealed]);

  useEffect(() => { refetch(); }, [refetch]);
  return { insights, loading, refetch };
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
  const [standings, setStandings] = useState<NflWeeklyStanding[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!weekId) { setStandings([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('nfl_weekly_standings')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('week_id', weekId)
      .order('rank', { ascending: true, nullsFirst: false });
    setStandings(data || []);
    setLoading(false);
  }, [weekId]);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!weekId) return;
    const channel = supabase.channel(`nfl-week-stand-${weekId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nfl_weekly_standings', filter: `week_id=eq.${weekId}` },
        () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [weekId, refetch]);

  return { standings, loading, refetch };
}

/* Season standings */
export function useSeasonStandings(seasonId?: string) {
  const [standings, setStandings] = useState<NflSeasonStanding[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!seasonId) { setStandings([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('nfl_season_standings')
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('season_id', seasonId)
      .order('rank', { ascending: true, nullsFirst: false });
    setStandings(data || []);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    if (!seasonId) return;
    const channel = supabase.channel(`nfl-season-stand-${seasonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nfl_season_standings', filter: `season_id=eq.${seasonId}` },
        () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [seasonId, refetch]);

  return { standings, loading, refetch };
}

/* Team records for a season (derived view: nfl_team_records).
   Returns a Map keyed by team_id for O(1) lookup in render loops. */
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
  const kicked = games.filter((g) => new Date(g.kickoff_at).getTime() <= nowMs || g.status !== 'scheduled');
  const finals = games.filter((g) => g.status === 'final');
  if (kicked.length === 0) return 'open';
  if (finals.length === games.length) return 'closed';
  return 'partially_locked';
}

/**
 * Returns the moment picks for the entire week freeze:
 * (first scheduled kickoff) − season.pick_lock_minutes.
 * Returns null if there are no games yet.
 */
export function weekLockAt(games: NflGame[], season?: NflSeason | null): Date | null {
  if (!games.length) return null;
  const firstMs = Math.min(...games.map((g) => new Date(g.kickoff_at).getTime()));
  const lockMin = season?.pick_lock_minutes ?? 10;
  return new Date(firstMs - lockMin * 60_000);
}

/** True once the entire week's pick window has closed. */
export function isWeekLocked(games: NflGame[], season?: NflSeason | null, nowMs = Date.now()): boolean {
  const lock = weekLockAt(games, season);
  if (!lock) return false;
  if (nowMs >= lock.getTime()) return true;
  // Defensive: if any game has already kicked, the week is locked regardless.
  return games.some((g) => g.status !== 'scheduled');
}

/** Back-compat: per-game lock derived from the week-level lock. */
export function isGameLocked(game: NflGame, games?: NflGame[], season?: NflSeason | null, nowMs = Date.now()): boolean {
  if (game.status !== 'scheduled') return true;
  if (games && games.length) return isWeekLocked(games, season, nowMs);
  return new Date(game.kickoff_at).getTime() <= nowMs;
}

/** Keeps lock-dependent controls honest when the cutoff passes while a page is open. */
export function useWeekLock(games: NflGame[], season?: NflSeason | null) {
  const [now, setNow] = useState(() => Date.now());
  const lockAt = weekLockAt(games, season);
  const lockAtMs = lockAt?.getTime() ?? null;

  useEffect(() => {
    if (!lockAtMs || now >= lockAtMs) return;
    const remaining = lockAtMs - now;
    const delay = Math.max(1_000, Math.min(15_000, remaining + 50));
    const id = window.setTimeout(() => setNow(Date.now()), delay);
    return () => window.clearTimeout(id);
  }, [lockAtMs, now]);

  return { lockAt, locked: isWeekLocked(games, season, now), now };
}

/** Delete a single pick (tap-to-unselect). */
export async function deleteMyPick(pickId: string) {
  const { error } = await (supabase as any).from('nfl_picks').delete().eq('id', pickId);
  if (error) throw error;
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
