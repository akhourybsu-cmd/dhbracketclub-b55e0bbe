// Draft seasons hooks – commissioner controls, standings, entries, playoffs
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';

export interface DraftSeason {
  id: string;
  name: string;
  year: number | null;
  season_label: string | null;
  season_number: number | null;
  subtitle: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  regular_season_weeks: number;
  regular_season_drafts: number;
  playoff_weeks: number;
  best_of: number;
  commissioner_user_id: string | null;
  champion_user_id?: string | null;
  runner_up_user_id?: string | null;
  third_place_user_id?: string | null;
  regular_season_champion_user_id?: string | null;
  archived_at?: string | null;
  summary?: {
    finalized_at?: string;
    series_score?: Record<string, number>;
    finals?: Array<{ game: number; winner: string; draft_id: string | null }>;
    third_place_match_id?: string | null;
  } | null;
}

/**
 * Display helper: "Season {N}" when season_number is set, else fall back to the
 * stored name (preserves legacy custom-named seasons).
 */
export function formatSeasonTitle(s: Pick<DraftSeason, 'season_number' | 'name'> | null | undefined): string {
  if (!s) return '';
  if (typeof s.season_number === 'number' && s.season_number > 0) return `Season ${s.season_number}`;
  return s.name || '';
}

/** Short chip label, e.g. "S4". Falls back to legacy formatting. */
export function formatSeasonChip(
  s: Pick<DraftSeason, 'season_number' | 'season_label' | 'year'> | null | undefined,
): string | null {
  if (!s) return null;
  if (typeof s.season_number === 'number' && s.season_number > 0) return `S${s.season_number}`;
  if (s.season_label) return s.season_label;
  if (s.year) return `'${String(s.year).slice(-2)}`;
  return null;
}

export interface SeasonStanding {
  id: string;
  season_id: string;
  user_id: string;
  season_points: number;
  drafts_played: number;
  wins: number;
  podiums: number;
  avg_finish: number;
  avg_score: number;
  best_score: number;
  worst_score: number;
  consistency: number;
  rank: number | null;
  playoff_seed: number | null;
  is_eliminated: boolean;
  profiles?: { display_name: string; avatar_url: string | null };
}

export interface SeasonEntry {
  id: string;
  season_id: string;
  draft_id: string;
  week_number: number; // DB column name — represents sequential draft number
  is_playoff: boolean;
  season_points_awarded: Record<string, number>;
  drafts?: { topic: string; status: string };
}

export interface PlayoffMatch {
  id: string;
  season_id: string;
  round: string;
  match_number: number;
  seed_a: number;
  seed_b: number;
  user_a: string | null;
  user_b: string | null;
  draft_id: string | null;
  winner_user_id: string | null;
  status: string;
  topic_picker_user_id: string | null;
}

// Season points by placement
const SEASON_POINTS: Record<number, number> = {
  1: 10,
  2: 7,
  3: 5,
  4: 3,
  5: 2,
};
const PARTICIPATION_POINTS = 1;

export function getSeasonPointsForRank(rank: number): number {
  return SEASON_POINTS[rank] || PARTICIPATION_POINTS;
}

/** Get the total number of regular-season drafts for a season (draft-count model) */
export function getSeasonDraftTarget(season: DraftSeason): number {
  return season.regular_season_drafts || season.regular_season_weeks || 12;
}

export function useCurrentSeason(selectedSeasonId?: string) {
  const { user } = useAuth();
  const { club } = useClub();
  const scope = `${user?.id ?? ''}:${club?.id ?? ''}:${selectedSeasonId ?? 'current'}`;
  const [snapshot, setSnapshot] = useState<{ scope: string; season: DraftSeason | null }>({ scope: '', season: null });
  const [loading, setLoading] = useState(true);
  const loadedScope = useRef('');
  const generation = useRef({ value: 0 }).current;

  const refetch = useCallback(async () => {
    const ticket = ++generation.value;
    // Refreshes keep the current workspace mounted; route/account changes do not
    // inherit the previous season's permission or race with its pending read.
    if (loadedScope.current !== scope) setLoading(true);
    let found: DraftSeason | null = null;
    try {
      if (selectedSeasonId) {
        const { data, error } = await supabase.from('draft_seasons').select('*').eq('id', selectedSeasonId).maybeSingle();
        if (error) throw error;
        found = data as unknown as DraftSeason | null;
      } else {
        const { data, error } = await supabase.from('draft_seasons').select('*')
          .in('status', ['regular_season', 'playoffs']).order('starts_at', { ascending: false }).limit(1);
        if (error) throw error;
        if (data?.length) found = data[0] as unknown as DraftSeason;
        else {
          const { data: fallback, error: fallbackError } = await supabase.from('draft_seasons').select('*')
            .order('starts_at', { ascending: false }).limit(1);
          if (fallbackError) throw fallbackError;
          found = fallback?.length ? fallback[0] as unknown as DraftSeason : null;
        }
      }
      if (ticket === generation.value) {
        loadedScope.current = scope;
        setSnapshot({ scope, season: found });
      }
    } catch {
      if (ticket === generation.value && loadedScope.current !== scope) setSnapshot({ scope, season: null });
    } finally { if (ticket === generation.value) setLoading(false); }
  }, [scope, selectedSeasonId, generation]);

  useEffect(() => { void refetch(); return () => { generation.value++; }; }, [refetch, generation]);
  return { season: snapshot.scope === scope ? snapshot.season : null, loading: loading || snapshot.scope !== scope, refetch };
}

export function useSeasonStandings(seasonId: string | undefined) {
  const [standings, setStandings] = useState<SeasonStanding[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!seasonId) { setLoading(false); return; }
    const { data } = await supabase
      .from('draft_season_standings' as any)
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('season_id', seasonId)
      .order('season_points', { ascending: false });
    setStandings((data || []) as unknown as SeasonStanding[]);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { standings, loading, refetch: fetch };
}

export function useSeasonEntries(seasonId: string | undefined) {
  const [entries, setEntries] = useState<SeasonEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!seasonId) { setLoading(false); return; }
    const { data } = await supabase
      .from('draft_season_entries' as any)
      .select('*, drafts:draft_id(topic, status)')
      .eq('season_id', seasonId)
      .order('week_number');
    setEntries((data || []) as unknown as SeasonEntry[]);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { entries, loading, refetch: fetch };
}

export function usePlayoffMatches(seasonId: string | undefined) {
  const [matches, setMatches] = useState<PlayoffMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!seasonId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('draft_playoff_matches' as any)
        .select('*')
        .eq('season_id', seasonId)
        .order('round')
        .order('match_number');
      setMatches((data || []) as unknown as PlayoffMatch[]);
      setLoading(false);
    })();
  }, [seasonId]);

  return { matches, loading };
}

export function useAllSeasons() {
  const [seasons, setSeasons] = useState<DraftSeason[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('draft_seasons' as any)
        .select('*')
        .order('season_number', { ascending: false, nullsFirst: false })
        .order('starts_at', { ascending: false });
      setSeasons((data || []) as unknown as DraftSeason[]);
      setLoading(false);
    })();
  }, []);

  return { seasons, loading };
}

export function useLifetimeStats(userId: string | undefined) {
  const [stats, setStats] = useState<{
    totalSeasons: number;
    totalWins: number;
    totalPodiums: number;
    totalPlayoffs: number;
    totalChampionships: number;
    avgSeasonFinish: number;
    bestSeasonPoints: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      const { data: allStandings } = await supabase
        .from('draft_season_standings' as any)
        .select('*')
        .eq('user_id', userId);

      const { data: playoffWins } = await supabase
        .from('draft_playoff_matches' as any)
        .select('*')
        .eq('winner_user_id', userId)
        .eq('round', 'final');

      const rows = (allStandings || []) as unknown as SeasonStanding[];
      // Championships = best-of-3 series clinches, NOT individual game wins.
      // A user must win ≥2 final games in the same season to claim the title.
      const finalGameWins = ((playoffWins || []) as unknown as PlayoffMatch[]);
      const winsBySeason = new Map<string, number>();
      for (const w of finalGameWins) {
        winsBySeason.set(w.season_id, (winsBySeason.get(w.season_id) || 0) + 1);
      }
      const championships = Array.from(winsBySeason.values()).filter(n => n >= 2).length;

      if (rows.length === 0) {
        setStats(null);
      } else {
        const ranks = rows.filter(r => r.rank).map(r => r.rank!);
        setStats({
          totalSeasons: rows.length,
          totalWins: rows.reduce((s, r) => s + r.wins, 0),
          totalPodiums: rows.reduce((s, r) => s + r.podiums, 0),
          totalPlayoffs: rows.filter(r => r.playoff_seed !== null).length,
          totalChampionships: championships,
          avgSeasonFinish: ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0,
          bestSeasonPoints: Math.max(...rows.map(r => r.season_points), 0),
        });
      }
      setLoading(false);
    })();
  }, [userId]);

  return { stats, loading };
}

/** Rebuild persisted standings atomically, including the commissioner adjustment ledger. */
export async function recalculateSeasonStandings(seasonId: string) {
  const { error } = await supabase.rpc('recalculate_draft_season_standings' as never, { p_season_id: seasonId } as never);
  if (error) throw error;
}

/** All season management changes share server authorization, idempotency and history. */
async function mutateSeason(seasonId: string, action: string, payload: Record<string, unknown>, reason: string) {
  const { data, error } = await supabase.rpc('draft_commissioner_mutate' as never, {
    p_season_id: seasonId,
    p_action: action,
    p_payload: payload,
    p_reason: reason,
    p_request_id: crypto.randomUUID(),
  } as never);
  if (error) throw error;
  return data as unknown as { record: { week_number?: number } | null };
}

/** Create a new season (draft-count based). Auto-assigns the next per-club season_number. */
export async function createSeason(params: {
  startsAt: string;
  endsAt: string;
  subtitle?: string | null;
  regularSeasonDrafts?: number;
  bestOf?: number;
  commissionerUserId?: string;
}) {
  const target = params.regularSeasonDrafts ?? 12;
  const best = params.bestOf ?? 10;
  if (!Number.isInteger(target) || target < 1 || target > 50 || !Number.isInteger(best) || best < 1 || best > target) {
    throw new Error('Choose 1–50 regular drafts and a best-of count between 1 and that total.');
  }
  // Resolve current user's club to compute next season_number per club.
  const { data: clubRow } = await supabase.rpc('current_user_club_id' as any);
  const clubId = (clubRow as unknown as string) || null;

  let nextNumber = 1;
  if (clubId) {
    const { data: maxRow } = await supabase
      .from('draft_seasons' as any)
      .select('season_number')
      .eq('club_id', clubId)
      .order('season_number', { ascending: false, nullsFirst: false })
      .limit(1);
    const cur = (maxRow && (maxRow as any[])[0]?.season_number) as number | null | undefined;
    nextNumber = (cur || 0) + 1;
  }

  const cleanSubtitle = (params.subtitle || '').trim() || null;
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('Sign in to create a season.');
  const commissionerUserId = params.commissionerUserId || authData.user.id;

  const { data, error } = await supabase
    .from('draft_seasons' as any)
    .insert({
      name: `Season ${nextNumber}`,
      season_number: nextNumber,
      subtitle: cleanSubtitle,
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      regular_season_drafts: params.regularSeasonDrafts || 12,
      regular_season_weeks: params.regularSeasonDrafts || 12, // keep in sync for compat
      best_of: params.bestOf || 10,
      status: 'regular_season',
      commissioner_user_id: commissionerUserId,
      club_id: clubId,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Set the commissioner on a season (admin / commissioner-only via RLS). */
export async function setSeasonCommissioner(seasonId: string, userId: string) {
  await mutateSeason(seasonId, 'transfer_commissioner', { user_id: userId }, 'Commissioner role transferred to the selected club member.');
}

/** Assign a draft to the current season (draft_number = sequential position) */
export async function assignDraftToSeason(seasonId: string, draftId: string, _draftNumber: number, isPlayoff = false) {
  if (isPlayoff) throw new Error('Playoff drafts are assigned by the bracket system.');
  await addDraftToSeason(seasonId, draftId);
}

/** Check if the current user is the commissioner for the active season */
export function useIsCommissioner(season: DraftSeason | null) {
  const { user } = useAuth();
  return !!(season && user && season.commissioner_user_id === user.id);
}

/** Fetch all drafts NOT assigned to any season (candidates for commissioner to add) */
export function useUnassignedDrafts(seasonId: string | undefined) {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!seasonId) { setLoading(false); return; }

    // Get every draft_id that's been assigned to ANY season (regular or playoff).
    // A draft can only ever belong to one season — once it's claimed, it's
    // permanently off the candidate list for every other season.
    const { data: entries } = await supabase
      .from('draft_season_entries' as any)
      .select('draft_id');

    const assignedIds = new Set((entries || []).map((e: any) => e.draft_id));

    // Get all drafts
    const { data: allDrafts } = await supabase
      .from('drafts')
      .select('id, topic, status, created_at, category, num_rounds, profiles:created_by(display_name)')
      .eq('is_live', false)
      .order('created_at', { ascending: false });

    const unassigned = (allDrafts || []).filter(d => !assignedIds.has(d.id));
    setDrafts(unassigned);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { drafts, loading, refetch: fetch };
}

/** Commissioner: add a draft to the season with auto-numbered position */
export async function addDraftToSeason(seasonId: string, draftId: string) {
  const result = await mutateSeason(seasonId, 'add_draft', { draft_id: draftId }, 'Commissioner added this draft to the regular season.');
  return result.record?.week_number;
}

/** Remove only season membership; the draft and its original report stay intact. */
export async function removeDraftFromSeason(draftId: string, reason = 'Commissioner removed this draft from the regular season.') {
  const { data: entry, error } = await supabase
    .from('draft_season_entries')
    .select('season_id')
    .eq('draft_id', draftId)
    .single();
  if (error) throw error;
  if (!entry) throw new Error('This draft is no longer assigned to a season.');
  await mutateSeason(entry.season_id, 'remove_draft', { draft_id: draftId }, reason);
}

/** Trigger playoff advancement (transition + winner scoring + next-round generation) */
export async function advancePlayoffs(seasonId: string) {
  const { data, error } = await supabase.functions.invoke('advance-playoffs', {
    body: { seasonId },
  });
  if (error) throw error;
  return data;
}

/** Fetch 3 AI-generated topic options for a playoff matchup. */
export async function suggestPlayoffTopics(seasonId: string, matchId: string): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke('suggest-playoff-topics', {
    body: { seasonId, matchId },
  });
  if (data && (data as any).error === 'Rate limit reached') {
    throw new Error("You've hit the AI helper limit for now. Try again in a bit.");
  }
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return ((data as any)?.topics || []) as string[];
}

/** Higher seed locks in a topic → creates the draft + participants and links to the match. */
export async function startPlayoffMatch(matchId: string, topic: string) {
  const { data, error } = await supabase.functions.invoke('start-playoff-match', {
    body: { matchId, topic },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { ok: boolean; draft_id: string };
}

/** Bulk lookup: playoff match metadata for a set of draft IDs. Used to render
 *  tournament chrome on draft list/dashboard rows in a single query. */
export function usePlayoffMatchByDraftIds(draftIds: string[]) {
  const [matchByDraft, setMatchByDraft] = useState<Map<string, PlayoffMatch>>(new Map());
  const key = draftIds.slice().sort().join(',');

  useEffect(() => {
    if (!draftIds.length) { setMatchByDraft(new Map()); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('draft_playoff_matches' as any)
        .select('*')
        .in('draft_id', draftIds);
      if (cancelled) return;
      const map = new Map<string, PlayoffMatch>();
      ((data || []) as unknown as PlayoffMatch[]).forEach(m => {
        if (m.draft_id) map.set(m.draft_id, m);
      });
      setMatchByDraft(map);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return matchByDraft;
}

/** Live subscription to playoff matches for a season — re-fetches whenever any row changes. */
export function usePlayoffMatchesLive(seasonId: string | undefined) {
  const [matches, setMatches] = useState<PlayoffMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!seasonId) { setLoading(false); return; }
    const { data } = await supabase
      .from('draft_playoff_matches' as any)
      .select('*')
      .eq('season_id', seasonId)
      .order('round')
      .order('match_number');
    setMatches((data || []) as unknown as PlayoffMatch[]);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => {
    fetch();
    if (!seasonId) return;
    const ch = supabase
      .channel(`playoff-matches-${seasonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_playoff_matches', filter: `season_id=eq.${seasonId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [seasonId, fetch]);

  return { matches, loading, refetch: fetch };
}

/** Fetch a single season by id. */
export function useSeasonById(seasonId: string | undefined) {
  const [season, setSeason] = useState<DraftSeason | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!seasonId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('draft_seasons' as any)
        .select('*')
        .eq('id', seasonId)
        .maybeSingle();
      setSeason((data as unknown as DraftSeason) ?? null);
      setLoading(false);
    })();
  }, [seasonId]);
  return { season, loading };
}

/** Fetch display profile rows for a list of user ids. */
export function useProfilesByIds(ids: Array<string | null | undefined>) {
  const key = Array.from(new Set(ids.filter(Boolean) as string[])).sort().join(',');
  const [map, setMap] = useState<Map<string, { display_name: string; avatar_url: string | null }>>(new Map());
  useEffect(() => {
    if (!key) { setMap(new Map()); return; }
    const idArr = key.split(',');
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', idArr);
      const m = new Map<string, { display_name: string; avatar_url: string | null }>();
      (data || []).forEach((p: any) => m.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url }));
      setMap(m);
    })();
  }, [key]);
  return map;
}

