import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { actOnShowdown, createShowdown, fetchShowdownLobby, fetchShowdownMatch, saveShowdownRound, submitShowdownRound, startAfterimageStudy, saveAfterimageReconstruction, submitAfterimageReconstruction, lockCipherCode as writeCipherCode, submitCipherGuess as writeCipherGuess, surrenderCipher as writeCipherSurrender } from '@/lib/showdown/service';
import { ShowdownRoundSession } from '@/lib/showdown/roundSession';
import { AfterimageSession } from '@/lib/showdown/afterimage/session';
import { CipherSession } from '@/lib/showdown/cipher/session';
import { showdownMatchStructuralSharing } from '@/lib/showdown/monotonic';
import type { ShowdownCreateInput, ShowdownCursor, ShowdownLobbyData, ShowdownMatchDetail } from '@/lib/showdown/types';

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Showdown could not load. Retry when you are connected.';
const deviceStorage = () => { try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; } };
function useIdentity() {
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  return { userId: user?.id, clubId: club?.id, ready: !!user?.id && !!club?.id && !authLoading && !clubLoading };
}

export function useShowdownLobby(gameKey = 'prism_break') {
  const { userId, clubId, ready } = useIdentity();
  const cache = useQueryClient();
  const scope = `${userId ?? ''}:${clubId ?? ''}`;
  const query = useInfiniteQuery({
    queryKey: ['showdown', userId, clubId, 'lobby', gameKey], enabled: ready,
    initialPageParam: null as ShowdownCursor | null,
    queryFn: ({ pageParam }) => fetchShowdownLobby(gameKey, pageParam),
    getNextPageParam: page => page.next_cursor ?? undefined,
    staleTime: 10_000, refetchInterval: 30_000, refetchOnWindowFocus: true, retry: 1,
  });
  const requests = useRef({ scope, generation: 0, busy: false, intents: new Map<string, string>() }).current;
  const stateListeners = useRef(new Set<() => void>()).current;
  const subscribe = useCallback((listener: () => void) => { stateListeners.add(listener); return () => { stateListeners.delete(listener); }; }, [stateListeners]);
  const busy = useSyncExternalStore(subscribe, () => requests.scope === scope && requests.busy, () => false);
  useLayoutEffect(() => { requests.scope = scope; requests.generation++; requests.busy = false; requests.intents.clear(); stateListeners.forEach(listener => listener()); }, [scope, requests, stateListeners]);
  const refetch = query.refetch;
  const refresh = useCallback(async () => { await refetch(); }, [refetch]);
  const mutation = useCallback(async (intent: string, operation: (identity: string) => Promise<ShowdownMatchDetail>, supplied?: string) => {
    if (!ready || requests.scope !== scope) throw new Error('Sign in to your club before creating a challenge.');
    if (requests.busy) throw new Error('Another challenge action is still saving.');
    const generation = requests.generation;
    const requestId = supplied ?? requests.intents.get(intent) ?? crypto.randomUUID();
    requests.intents.set(intent, requestId); requests.busy = true; stateListeners.forEach(listener => listener());
    try {
      const detail = await operation(requestId);
      if (requests.scope === scope && requests.generation === generation) {
        requests.intents.delete(intent);
        cache.setQueryData(['showdown', userId, clubId, 'match', detail.challenge.id], detail);
        void cache.invalidateQueries({ queryKey: ['showdown', userId, clubId, 'lobby'] });
      }
      return detail;
    } finally { if (requests.scope === scope && requests.generation === generation) { requests.busy = false; stateListeners.forEach(listener => listener()); } }
  }, [ready, requests, scope, stateListeners, cache, userId, clubId]);
  const create = useCallback((input: ShowdownCreateInput) => mutation(JSON.stringify(['create', input.recipientId, input.gameKey, input.rematchOf]), id => createShowdown({ ...input, requestId: id }), input.requestId), [mutation]);
  const act = useCallback((id: string, action: 'decline' | 'cancel') => mutation(`${action}:${id}`, requestId => actOnShowdown(id, action, requestId)), [mutation]);
  const data = useMemo<ShowdownLobbyData | null>(() => {
    if (!ready || !query.data?.pages.length) return null;
    const first = query.data.pages[0];
    const challenges = [...new Map(query.data.pages.flatMap(page => page.challenges).map(challenge => [challenge.id, challenge])).values()];
    return { ...first, challenges, next_cursor: query.data.pages[query.data.pages.length - 1]?.next_cursor ?? null };
  }, [ready, query.data]);
  return { data, loading: ready && query.isLoading, refreshing: query.isRefetching, error: query.error ? errorMessage(query.error) : null,
    refresh, create, act, busy, hasMore: !!query.hasNextPage, loadingMore: query.isFetchingNextPage,
    loadMore: async () => { if (query.hasNextPage && !query.isFetchingNextPage) await query.fetchNextPage(); } };
}

export function useShowdownMatch(challengeId: string | undefined) {
  const { userId, clubId, ready } = useIdentity();
  const cache = useQueryClient();
  const key = useMemo(() => ['showdown', userId, clubId, 'match', challengeId] as const, [userId, clubId, challengeId]);
  const scope = ready && challengeId ? `${userId}:${clubId}:${challengeId}` : '';
  const query = useQuery({ queryKey: key, enabled: !!scope, queryFn: () => fetchShowdownMatch(challengeId!, true),
    staleTime: 5_000, refetchOnMount: 'always', refetchInterval: 20_000, refetchOnWindowFocus: true, retry: 1,
    structuralSharing: showdownMatchStructuralSharing });
  const session = useMemo(() => new ShowdownRoundSession(challengeId ?? '', `dh:showdown:outbox:v1:${scope}`, deviceStorage(), {
    fetch: () => fetchShowdownMatch(challengeId!, false), save: saveShowdownRound, submit: submitShowdownRound,
  }, detail => cache.setQueryData(key, detail)), [challengeId, scope, cache, key]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const memory = useMemo(() => new AfterimageSession(challengeId ?? '', `dh:showdown:afterimage:v1:${scope}`, deviceStorage(), {
    fetch: () => fetchShowdownMatch(challengeId!, false), start: (round, requestId) => startAfterimageStudy(challengeId!, round, requestId),
    save: saveAfterimageReconstruction, submit: submitAfterimageReconstruction,
  }, detail => cache.setQueryData(key, detail)), [challengeId, scope, cache, key]);
  const memoryState = useSyncExternalStore(memory.subscribe, memory.getSnapshot, memory.getSnapshot);
  const cipher = useMemo(() => new CipherSession(challengeId ?? '', `dh:showdown:cipher:match:v1:${scope}`, deviceStorage(), {
    fetch: () => fetchShowdownMatch(challengeId!, false), lock: writeCipherCode, guess: writeCipherGuess, surrender: writeCipherSurrender,
  }, detail => cache.setQueryData(key, detail)), [challengeId, scope, cache, key]);
  const cipherState = useSyncExternalStore(cipher.subscribe, cipher.getSnapshot, cipher.getSnapshot);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const operations = useRef({ scope, generation: 0, busy: false, intents: new Map<string, string>() }).current;
  const operationListeners = useRef(new Set<() => void>()).current;
  const subscribe = useCallback((listener: () => void) => { operationListeners.add(listener); return () => { operationListeners.delete(listener); }; }, [operationListeners]);
  const mutationBusy = useSyncExternalStore(subscribe, () => operations.scope === scope && operations.busy, () => false);
  useLayoutEffect(() => {
    session.activate(); memory.activate(); cipher.activate(); operations.scope = scope; operations.generation++; operations.busy = false; operations.intents.clear();
    return () => { session.dispose(); memory.dispose(); cipher.dispose(); };
  }, [session, memory, cipher, operations, scope]);
  useLayoutEffect(() => { if (scope && query.data) { session.accept(query.data); memory.accept(query.data); cipher.accept(query.data); } }, [scope, query.data, session, memory, cipher]);
  const refetchMatch = query.refetch;
  useEffect(() => {
    const sync = () => { if (document.visibilityState === 'visible') { void refetchMatch(); void session.retry().catch(() => {}); void memory.retry().catch(() => {}); void cipher.flush().catch(() => {}); } };
    const online = () => { void session.retry().catch(() => {}); void memory.retry().catch(() => {}); void cipher.flush().catch(() => {}); void refetchMatch(); };
    document.addEventListener('visibilitychange', sync); window.addEventListener('online', online);
    return () => { document.removeEventListener('visibilitychange', sync); window.removeEventListener('online', online); };
  }, [session, memory, cipher, refetchMatch]);
  const completed = query.data?.challenge.status === 'completed';
  useEffect(() => {
    if (!completed || !userId || !clubId) return;
    void cache.invalidateQueries({ queryKey: ['dh-score', userId, clubId] });
    void cache.invalidateQueries({ queryKey: ['dh-feats', userId, clubId] });
    void cache.invalidateQueries({ queryKey: ['showdown', userId, clubId, 'lobby'] });
  }, [completed, userId, clubId, cache]);
  const mutation = useCallback(async (intent: string, work: (requestId: string) => Promise<ShowdownMatchDetail>) => {
    if (!scope || operations.scope !== scope || operations.busy) throw new Error('Another challenge action is still saving.');
    operations.busy = true; operationListeners.forEach(listener => listener());
    const generation = operations.generation;
    const requestId = operations.intents.get(intent) ?? crypto.randomUUID(); operations.intents.set(intent, requestId);
    try {
      const detail = await work(requestId);
      if (activeScope.current === scope && operations.generation === generation) {
        operations.intents.delete(intent);
        cache.setQueryData(['showdown', userId, clubId, 'match', detail.challenge.id], detail);
        void cache.invalidateQueries({ queryKey: ['showdown', userId, clubId, 'lobby'] });
      }
      return detail;
    } finally { if (activeScope.current === scope && operations.generation === generation) { operations.busy = false; operationListeners.forEach(listener => listener()); } }
  }, [scope, operations, operationListeners, cache, userId, clubId]);
  const act = useCallback((action: 'decline' | 'cancel') => mutation(action, requestId => actOnShowdown(challengeId!, action, requestId)), [mutation, challengeId]);
  const rematch = useCallback(() => {
    const challenge = query.data?.challenge;
    if (!challenge || challenge.status !== 'completed' || !userId) return Promise.reject(new Error('Complete this match before starting a rematch.'));
    if (challenge.game_key === 'cipher_duel') return Promise.reject(new Error('Create a fresh secret code to begin this rematch.'));
    return mutation('rematch', requestId => createShowdown({ recipientId: challenge.challenger_id === userId ? challenge.recipient_id : challenge.challenger_id,
      gameKey: challenge.game_key, rematchOf: challenge.id, requestId }));
  }, [query.data?.challenge, userId, mutation]);
  const afterimage = query.data?.challenge.game_key === 'afterimage';
  const cipherGame = query.data?.challenge.game_key === 'cipher_duel';
  const progress = cipherGame ? cipherState : afterimage ? memoryState : state;
  return { data: scope ? query.data ?? null : null, loading: !!scope && query.isLoading,
    error: query.error ? errorMessage(query.error) : null, refreshing: query.isRefetching,
    refresh: async () => { await query.refetch(); }, actions: state.actions, onActionsChange: session.changeActions,
    checkpoint: cipherGame ? cipher.flush : afterimage ? memory.flush : session.flush, submit: session.submit, retrySave: cipherGame ? cipher.retry : afterimage ? memory.retry : session.retry, saveState: progress.saveState, saveError: progress.error,
    placements: memoryState.placements, onPlacementsChange: memory.changePlacements,
    startStudy: memory.startStudy, refreshStudy: memory.refresh, submitReconstruction: memory.submit,
    startingStudy: memoryState.starting,
    cipherDraft: cipherState.draft, onCipherDraftChange: cipher.changeDraft, cipherPendingCode: cipherState.pendingCode,
    lockCipherCode: cipher.lockCode, submitCipherGuess: cipher.submitGuess, surrenderCipher: cipher.surrender,
    submitting: progress.submitting, busy: mutationBusy || progress.submitting || memoryState.starting || (progress.blocked && !!query.data?.can_play),
    act, rematch };
}
