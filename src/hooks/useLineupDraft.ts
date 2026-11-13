import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { HYDRATE_TIMEOUT_MS, QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';
import { parseLineupConfig, type LineupConfig } from '@/lib/draft/lineup';
import { isCompleteDraftReport } from '@/lib/draft/resultIntegrity';
import type { DraftResult } from '@/hooks/useDraftResults';
import type { DraftArtworkSource } from '@/lib/draft/artwork';

export interface LineupDraft {
  id: string; club_id: string; competition_id: string; topic: string; created_by: string;
  created_at: string; num_rounds: number; status: string; draft_format: 'lineup';
  lineup_config: LineupConfig; ai_context: string | null;
  current_pick_user_id: string | null; current_pick_number: number; current_round: number;
  competitions?: { description: string | null } | null;
}
export interface LineupParticipant {
  id: string; user_id: string; pick_order: number;
  profiles?: { display_name: string | null; avatar_url?: string | null } | null;
}
export interface LineupPick {
  id: string; draft_id: string; user_id: string; pick_text: string; pick_number: number;
  round: number; picked_at: string; lineup_slot_id: string;
}
export interface LineupDraftSummary extends LineupDraft { participant_count: number; joined: boolean }
export interface LineupActionResult { draft_id: string; action?: string; pick_id?: string; replayed?: boolean }
export interface PendingLineupAction { requestId: string; action: string; payload: Record<string, unknown> }
interface LineupSnapshot {
  draft: LineupDraft; participants: LineupParticipant[]; picks: LineupPick[];
  results: DraftResult[]; artwork: Map<string, DraftArtworkSource>; hasResults: boolean;
}

export function lineupError(error: unknown, fallback = 'That action could not be completed. Try again.'): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    const message = error.message.replace(/^LINEUP_[A-Z_]+:\s*/, '').trim();
    if (/column .*does not exist|function .*does not exist|schema cache/i.test(message)) return 'Lineup Drafts is being updated. Refresh in a moment.';
    return message.slice(0, 280);
  }
  return fallback;
}

export async function runLineupAction(clubId: string, draftId: string | null, requestId: string, action: string, payload: Record<string, unknown> = {}): Promise<LineupActionResult> {
  const response = await withTimeout(supabase.rpc('draft_lineup_action' as never, {
    p_club_id: clubId, p_draft_id: draftId, p_request_id: requestId, p_action: action, p_payload: payload,
  } as never), QUERY_TIMEOUT_MS, 'Lineup action');
  if (response.error) throw response.error;
  const data = response.data as unknown;
  if (!data || typeof data !== 'object' || !('draft_id' in data) || typeof data.draft_id !== 'string') throw new Error('The server did not confirm this action. Retry to check it safely.');
  return data as LineupActionResult;
}

export function createLineupDraft(input: { clubId: string; userId: string; requestId: string; topic: string; description: string; aiContext: string; lineupConfig: LineupConfig }): Promise<LineupActionResult> {
  return runLineupAction(input.clubId, null, input.requestId, 'create', {
    topic: input.topic.trim(), description: input.description.trim(), ai_context: input.aiContext.trim(), lineup_config: input.lineupConfig,
  });
}

export function useLineupDrafts() {
  const { user } = useAuth();
  const { club } = useClub();
  const clubId = club?.id, userId = user?.id;
  const query = useQuery({
    queryKey: ['draft-lineup-list', clubId, userId], enabled: !!clubId && !!userId,
    queryFn: async (): Promise<LineupDraftSummary[]> => {
      const response = await withTimeout(supabase.from('drafts').select('*,draft_participants(user_id)')
        .eq('club_id', clubId!).eq('draft_format' as never, 'lineup').order('created_at', { ascending: false }).limit(50), QUERY_TIMEOUT_MS, 'Lineup rooms');
      if (response.error) throw response.error;
      const rows = (response.data ?? []) as unknown as Array<LineupDraft & { draft_participants: Array<{ user_id: string }> }>;
      return rows.flatMap(row => {
        const config = parseLineupConfig(row.lineup_config);
        return config ? [{ ...row, lineup_config: config, participant_count: row.draft_participants?.length ?? 0, joined: row.draft_participants?.some(p => p.user_id === userId) ?? false }] : [];
      });
    }, staleTime: 10_000, refetchInterval: 30_000, retry: 1,
  });
  const refetch = query.refetch;
  const refresh = useCallback(async () => { await refetch(); }, [refetch]);
  useEffect(() => {
    if (!clubId || !userId) return;
    const channel = supabase.channel(`lineup-list:${clubId}:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drafts', filter: `club_id=eq.${clubId}` }, () => { void refresh(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [clubId, userId, refresh]);
  return { drafts: query.data ?? [], loading: query.isPending && !!clubId && !!userId, refreshing: query.isFetching,
    error: query.error ? lineupError(query.error, 'Lineups could not be loaded.') : '', refresh };
}

async function fetchLineupDraft(clubId: string, draftId: string): Promise<LineupSnapshot> {
  const responses = await withTimeout(Promise.all([
    withTimeout(supabase.from('drafts').select('*,competitions(description)').eq('id', draftId).eq('club_id', clubId).eq('draft_format' as never, 'lineup').maybeSingle(), QUERY_TIMEOUT_MS, 'Lineup room'),
    withTimeout(supabase.from('draft_participants').select('*,profiles:user_id(display_name,avatar_url)').eq('draft_id', draftId).eq('club_id', clubId).order('pick_order').limit(32), QUERY_TIMEOUT_MS, 'Lineup players'),
    withTimeout(supabase.from('draft_picks').select('*').eq('draft_id', draftId).eq('club_id', clubId).order('pick_number').limit(640), QUERY_TIMEOUT_MS, 'Lineup picks'),
    withTimeout(supabase.from('draft_results').select('*').eq('draft_id', draftId).eq('club_id', clubId).order('rank').limit(32), QUERY_TIMEOUT_MS, 'Lineup results'),
  ]), HYDRATE_TIMEOUT_MS, 'Lineup room loading');
  for (const response of responses) if (response.error) throw response.error;
  const draft = responses[0].data as unknown as LineupDraft | null;
  const config = parseLineupConfig(draft?.lineup_config);
  if (!draft || !config) throw new Error('This lineup is unavailable in your active club.');
  const participants = responses[1].data as unknown as LineupParticipant[] ?? [];
  const picks = responses[2].data as unknown as LineupPick[] ?? [];
  const results = responses[3].data as unknown as DraftResult[] ?? [];
  const artwork = new Map<string, DraftArtworkSource>();
  // Artwork is optional; it never blocks the actual draft or report.
  if (picks.length) {
    try {
      // Long rosters can exceed a proxy's URL limit if every UUID goes into
      // one `in` filter. Small bounded pages also isolate image-query failures.
      const pages = Array.from({ length: Math.ceil(picks.length / 80) }, (_, index) => picks.slice(index * 80, (index + 1) * 80));
      const enriched = await withTimeout(Promise.allSettled(pages.map(page => withTimeout(
        supabase.from('item_enrichments').select('item_id,image_url,thumbnail_url')
          .eq('item_type', 'draft_pick').in('item_id', page.map(pick => pick.id)).limit(80), 3_000, 'Lineup artwork page',
      ))), 5_000, 'Lineup artwork');
      for (const response of enriched) if (response.status === 'fulfilled' && !response.value.error)
        for (const row of response.value.data ?? []) artwork.set(row.item_id, row);
    } catch { /* The initials fallback remains available during image outages. */ }
  }
  return { draft: { ...draft, lineup_config: config }, participants, picks, results, artwork,
    hasResults: draft.status === 'complete' && isCompleteDraftReport(results, participants.map(p => p.user_id), picks) };
}

function readPending(key: string): PendingLineupAction | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (value && typeof value === 'object' && 'requestId' in value && typeof value.requestId === 'string'
      && 'action' in value && typeof value.action === 'string' && 'payload' in value && value.payload && typeof value.payload === 'object') return value as PendingLineupAction;
  } catch { /* Storage may be unavailable in private browsing. */ }
  return null;
}

export function useLineupDraft(draftId: string | undefined) {
  const { user } = useAuth();
  const { club } = useClub();
  const clubId = club?.id, userId = user?.id;
  const scope = `${userId ?? ''}:${clubId ?? ''}:${draftId ?? ''}`;
  const pendingKey = `dh:lineup:pending:v1:${scope}`;
  const [pendingState, setPendingState] = useState<{ scope: string; pending: PendingLineupAction | null }>({ scope, pending: readPending(pendingKey) });
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState('');
  const [judging, setJudging] = useState(false);
  const [judgeError, setJudgeError] = useState('');
  const inFlight = useRef(false), judgeFlight = useRef(false);
  const activeScope = useRef(scope); activeScope.current = scope;
  const client = useQueryClient();
  const pending = pendingState.scope === scope ? pendingState.pending : readPending(pendingKey);
  const query = useQuery({ queryKey: ['draft-lineup', clubId, userId, draftId], enabled: !!clubId && !!userId && !!draftId,
    queryFn: () => fetchLineupDraft(clubId!, draftId!), staleTime: 5_000, refetchInterval: 20_000, retry: 1 });
  const refetch = query.refetch;
  const refresh = useCallback(async () => { await refetch(); }, [refetch]);
  useEffect(() => {
    if (!clubId || !userId || !draftId) return;
    const channel = supabase.channel(`lineup-room:${clubId}:${draftId}:${userId}`);
    for (const table of ['draft_participants', 'draft_picks', 'draft_results']) channel.on('postgres_changes', {
      event: '*', schema: 'public', table, filter: `draft_id=eq.${draftId}`,
    }, () => { void refresh(); });
    channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'drafts', filter: `id=eq.${draftId}` }, () => { void refresh(); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [clubId, userId, draftId, refresh]);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        try { localStorage.removeItem(pendingKey); } catch { /* Optional recovery storage. */ }
        setPendingState({ scope, pending: null });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [pendingKey, scope]);
  const mutate = useCallback(async (action: string, payload: Record<string, unknown> = {}, retry?: PendingLineupAction) => {
    if (!clubId || !userId || !draftId || inFlight.current) return null;
    const existing = readPending(pendingKey) ?? (pendingState.scope === scope ? pendingState.pending : null);
    if (existing && !retry && (existing.action !== action || JSON.stringify(existing.payload) !== JSON.stringify(payload))) {
      setPendingState({ scope, pending: existing });
      setActionError('Retry the saved action before making another change.'); return null;
    }
    const request = retry ?? existing ?? { requestId: crypto.randomUUID(), action, payload };
    inFlight.current = true; setWorking(true); setActionError('');
    setPendingState({ scope, pending: request });
    try { localStorage.setItem(pendingKey, JSON.stringify(request)); } catch { /* The same request stays in memory for retry. */ }
    try {
      const result = await runLineupAction(clubId, draftId, request.requestId, request.action, request.payload);
      if (activeScope.current === scope) {
        try { localStorage.removeItem(pendingKey); } catch { /* Optional recovery storage. */ }
        setPendingState({ scope, pending: null });
        await refresh();
        void client.invalidateQueries({ queryKey: ['draft-lineup-list', clubId, userId] });
      }
      return result;
    } catch (error) {
      if (activeScope.current === scope) {
        setActionError(lineupError(error));
        // A returned SQL rejection proves the transaction did not commit.
        const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
        if (/^(P\d|22|23|42|54)/.test(code)) {
          try { localStorage.removeItem(pendingKey); } catch { /* Optional recovery storage. */ }
          setPendingState({ scope, pending: null });
        }
        void refresh();
      }
      return null;
    } finally { inFlight.current = false; if (activeScope.current === scope) setWorking(false); }
  }, [clubId, userId, draftId, pendingKey, pendingState, scope, refresh, client]);
  const retryPending = useCallback(() => pending ? mutate(pending.action, pending.payload, pending) : Promise.resolve(null), [pending, mutate]);
  const reportSource = query.data;
  const generateResults = useCallback(async () => {
    if (!draftId || !reportSource || reportSource.draft.status !== 'complete' || reportSource.hasResults || judgeFlight.current) return;
    judgeFlight.current = true; setJudging(true); setJudgeError('');
    try {
      // Preserve Arena's one-batch-per-report policy instead of calling the
      // catalog/AI gateway after every pick. Artwork is optional to judging.
      try { await withTimeout(supabase.functions.invoke('enrich-draft-picks', { body: { draft_id: draftId } }), QUERY_TIMEOUT_MS, 'Lineup report artwork'); } catch { /* Judge from the saved picks if art is unavailable. */ }
      const response = await withTimeout(supabase.functions.invoke('rate-draft', { body: { draft_id: draftId } }), 90_000, 'Lineup judging');
      if (response.error) throw response.error;
      const data = response.data as { error?: string } | null;
      if (data?.error) throw new Error(data.error);
      if (activeScope.current === scope) {
        const updated = await refetch();
        if (!updated.data?.hasResults) throw new Error('The saved report is incomplete. Your picks are safe; retry judging.');
      }
    } catch (error) { if (activeScope.current === scope) setJudgeError(lineupError(error, 'Judging could not finish. Your picks are saved; retry the report.')); }
    finally { judgeFlight.current = false; if (activeScope.current === scope) setJudging(false); }
  }, [draftId, reportSource, refetch, scope]);
  return { ...query.data, loading: query.isPending && !!clubId && !!userId && !!draftId, refreshing: query.isFetching,
    error: query.error ? lineupError(query.error, 'This lineup could not be loaded.') : '', refresh,
    working, actionError, pending, mutate, retryPending, judging, judgeError, generateResults };
}
