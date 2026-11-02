import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DeepClaimError } from '@/lib/deepClaim/service';
import { applyTutorialPatch, createTutorialProgress, validateTutorialPatch } from '@/lib/deepClaim/tutorial/progress';
import { fetchDeepClaimTutorial, saveDeepClaimTutorial } from '@/lib/deepClaim/tutorial/service';
import type { TutorialProgress, TutorialProgressPatch, TutorialScope } from '@/lib/deepClaim/tutorial/types';

interface Intent { id: string; patch: TutorialProgressPatch; expected: number | null }
const SETS = ['completed_steps', 'reviewed_lessons', 'practiced_lessons', 'skipped_lessons', 'seen_dialogue'] as const;
const PATCH_KEYS = new Set<string>([...SETS, 'active_lesson_id', 'active_step_id', 'campaign_status', 'commentary_enabled']);
const online = () => typeof navigator === 'undefined' || navigator.onLine;
const listen = (listener: () => void) => { window.addEventListener('online', listener); window.addEventListener('offline', listener); return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); }; };
const sameScope = (a: TutorialScope, b: TutorialScope) => a.user_id === b.user_id && a.club_id === b.club_id && a.company_id === b.company_id;
function readQueue(key: string): Intent[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(value) || value.length > 128) return [];
    return value.filter((item): item is Intent => !!item && typeof item === 'object'
      && typeof item.id === 'string' && /^[a-f\d-]{36}$/i.test(item.id)
      && (item.expected === null || Number.isSafeInteger(item.expected) && item.expected >= 0)
      && !!item.patch && typeof item.patch === 'object' && !Array.isArray(item.patch)
      && Object.keys(item.patch).every(key => PATCH_KEYS.has(key))).filter(item => {
        try { validateTutorialPatch(item.patch); return true; } catch { return false; }
      });
  } catch { return []; }
}
function persist(key: string, queue: readonly Intent[]) { try { if (queue.length) localStorage.setItem(key, JSON.stringify(queue)); else localStorage.removeItem(key); } catch { /* Current-session progress remains usable without device storage. */ } }
function newest(before: TutorialProgress | undefined, next: TutorialProgress): TutorialProgress { return before && sameScope(before, next) && before.revision > next.revision ? before : next; }

/** Educational state has its own queue and revision. It never writes company state. */
export function useDeepClaimTutorial({ scope, enabled }: { scope: TutorialScope; enabled: boolean }) {
  const cache = useQueryClient();
  const owner = useMemo(() => ({ user_id: scope.user_id, club_id: scope.club_id, company_id: scope.company_id }), [scope.user_id, scope.club_id, scope.company_id]);
  const identity = `${scope.user_id}:${scope.club_id}:${scope.company_id ?? 'unfounded'}`;
  const key = useMemo(() => ['deep-claim-tutorial', scope.user_id, scope.club_id, scope.company_id] as const, [scope.user_id, scope.club_id, scope.company_id]);
  const queueKey = `dh:deep-claim:training:pending:v1:${identity}`;
  const connected = useSyncExternalStore(listen, online, () => true);
  const current = useRef(identity); current.current = identity;
  const generation = useRef(0);
  const [initialQueue] = useState(() => readQueue(queueKey));
  const queue = useRef<Intent[]>(initialQueue);
  const server = useRef<TutorialProgress>(createTutorialProgress(scope));
  const draining = useRef(false);
  const [epoch, setEpoch] = useState(0);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const query = useQuery({ queryKey: key, enabled: enabled && connected, queryFn: async () => {
    const result = await fetchDeepClaimTutorial();
    if (!sameScope(result, owner)) throw new DeepClaimError('This Training Journal belongs to another company. Reopen your current claim.', 'access');
    return result;
  }, staleTime: 15_000, retry: 1, refetchOnWindowFocus: true,
  structuralSharing: (before, next) => newest(before as TutorialProgress | undefined, next as TutorialProgress) });
  const refetch = query.refetch;
  useLayoutEffect(() => {
    generation.current++; draining.current = false; queue.current = readQueue(queueKey);
    server.current = createTutorialProgress(scope); setFailure(null); setSaving(false); setEpoch(value => value + 1);
  // Scope is represented by identity; its object may change during ordinary clock ticks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, queueKey]);
  useLayoutEffect(() => { if (query.data && sameScope(query.data, owner)) { server.current = newest(server.current, query.data); setEpoch(value => value + 1); } }, [query.data, owner]);

  const drain = useCallback(async () => {
    if (draining.current || !enabled || !scope.company_id || !online() || current.current !== identity) return;
    const attempt = generation.current; draining.current = true; setSaving(true);
    try {
      while (queue.current.length && current.current === identity && generation.current === attempt && online()) {
        const intent = queue.current[0];
        if (intent.expected === null) { intent.expected = server.current.revision; persist(queueKey, queue.current); }
        try {
          const result = await saveDeepClaimTutorial(intent.patch, intent.expected, intent.id);
          if (current.current !== identity || generation.current !== attempt) return;
          if (!sameScope(result, owner)) throw new DeepClaimError('Journal identity changed. Return to your current company.', 'access');
          server.current = newest(server.current, result);
          cache.setQueryData(key, (before: TutorialProgress | undefined) => newest(before, result));
          queue.current.shift(); persist(queueKey, queue.current); setFailure(null); setEpoch(value => value + 1);
        } catch (error) {
          if (current.current !== identity || generation.current !== attempt) return;
          if (error instanceof DeepClaimError && error.code === 'conflict') {
            const fresh = await fetchDeepClaimTutorial();
            if (current.current !== identity || generation.current !== attempt || !sameScope(fresh, owner)) return;
            server.current = newest(server.current, fresh); cache.setQueryData(key, fresh);
            // Another device owns the newer cursor. Preserve completed learning,
            // but never replay an old navigation intent over its current chapter.
            const merge: TutorialProgressPatch = {};
            for (const field of SETS) if (intent.patch[field]?.length) Object.assign(merge, { [field]: intent.patch[field] });
            queue.current.shift();
            for (const queued of queue.current) { for (const field of ['active_lesson_id', 'active_step_id', 'campaign_status', 'commentary_enabled'] as const) delete queued.patch[field]; queued.expected = null; }
            if (Object.keys(merge).length) queue.current.unshift({ id: crypto.randomUUID(), expected: null, patch: merge });
            persist(queueKey, queue.current); setEpoch(value => value + 1); continue;
          }
          if (error instanceof DeepClaimError && error.code === 'rule') {
            queue.current.shift(); persist(queueKey, queue.current); setEpoch(value => value + 1);
          }
          setFailure(error instanceof Error ? error.message : 'The Training Journal could not sync. Your company is unaffected.');
          return;
        }
      }
    } catch (error) {
      if (current.current === identity && generation.current === attempt) setFailure(error instanceof Error ? error.message : 'The Training Journal could not reconnect. Retry when online.');
    } finally { if (current.current === identity && generation.current === attempt) { draining.current = false; setSaving(false); } }
  }, [enabled, identity, owner, scope.company_id, queueKey, cache, key]);
  useEffect(() => { if (connected && enabled && query.data) void drain(); }, [connected, enabled, query.data, drain]);
  useEffect(() => {
    const refresh = () => { if (enabled && online() && document.visibilityState === 'visible') { void refetch(); void drain(); } };
    window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [enabled, refetch, drain]);
  const update = useCallback((patch: TutorialProgressPatch) => {
    if (!enabled || !scope.company_id || current.current !== identity) return;
    if (queue.current.length >= 128) { setFailure('The Training Journal has many unsynchronized notes. Reconnect before adding more.'); return; }
    queue.current.push({ id: crypto.randomUUID(), expected: null, patch }); persist(queueKey, queue.current); setEpoch(value => value + 1); void drain();
  }, [enabled, scope.company_id, identity, queueKey, drain]);
  const progress = useMemo(() => {
    let value = sameScope(server.current, scope) ? server.current : createTutorialProgress(scope);
    for (const intent of queue.current) {
      try { value = applyTutorialPatch(value, intent.patch); }
      catch { /* A partial cursor can wait for its actual server lesson to load. */ }
    }
    return value;
  // Epoch reflects both persisted replies and queued educational intentions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, epoch]);
  return { progress, update, loading: query.isLoading && connected, saving,
    pending: queue.current.length, synced: !!query.data && !queue.current.length && !query.error && !failure,
    error: failure ?? (query.error instanceof Error ? query.error.message : null),
    refresh: async () => { setFailure(null); await query.refetch(); await drain(); } };
}
