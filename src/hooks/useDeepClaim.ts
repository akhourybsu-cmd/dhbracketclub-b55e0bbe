import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { DeepClaimError, deepClaimDispatchArgs, fetchDeepClaim, mutateDeepClaim, previewDeepClaim, shareDeepClaimSnapshot } from '@/lib/deepClaim/service';
import type { DeepClaimBuildingId, DeepClaimDispatchInput, DeepClaimSellInput, DeepClaimSnapshot } from '@/lib/deepClaim/types';

type Pending = { operation: 'dc_bootstrap' | 'dc_dispatch' | 'dc_collect' | 'dc_sell' | 'dc_upgrade'; args: Record<string, unknown>; fingerprint: string; label: string };
const online = () => typeof navigator === 'undefined' || navigator.onLine;
const listenOnline = (listener: () => void) => { window.addEventListener('online', listener); window.addEventListener('offline', listener); return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); }; };
function storage(): Storage | null { try { return window.localStorage; } catch { return null; } }
function readPending(key: string): Pending | null {
  try {
    const value = JSON.parse(storage()?.getItem(key) ?? 'null');
    return value && ['dc_bootstrap','dc_dispatch','dc_collect','dc_sell','dc_upgrade'].includes(value.operation)
      && typeof value.args?.p_request_id === 'string' && /^[a-f\d-]{36}$/i.test(value.args.p_request_id)
      && typeof value.fingerprint === 'string' && typeof value.label === 'string' ? value as Pending : null;
  } catch { return null; }
}
function savePending(key: string, pending: Pending | null) { try { if (pending) storage()?.setItem(key, JSON.stringify(pending)); else storage()?.removeItem(key); } catch { /* In-memory receipt still protects this session. */ } }

export function useDeepClaim() {
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  const assets = useClubAssets();
  const identity = `${user?.id ?? ''}:${club?.id ?? ''}`;
  const ready = !!user && !!club && !authLoading && !clubLoading && !assets.loading && assets.isInstalled('deep-claim');
  const key = useMemo(() => ['deep-claim', user?.id, club?.id] as const, [user?.id, club?.id]);
  const receiptKey = `dh:deep-claim:pending:v1:${identity}`;
  const cache = useQueryClient();
  const connected = useSyncExternalStore(listenOnline, online, () => true);
  const activeIdentity = useRef(identity); activeIdentity.current = identity;
  const generation = useRef(0);
  const write = useRef(false);
  const pendingRef = useRef<Pending | null>(readPending(receiptKey));
  const [pendingState, setPending] = useState(pendingRef.current);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const clock = useRef({ server: Date.now(), received: performance.now() });
  const query = useQuery({ queryKey: key, enabled: ready, queryFn: async () => {
    const data = await fetchDeepClaim();
    if (data.company && (data.company.user_id !== user?.id || data.company.club_id !== club?.id)) throw new DeepClaimError('The company does not belong to your active club.', 'access');
    return data;
  }, staleTime: 10_000, refetchInterval: state => document.visibilityState !== 'visible' ? false
    : state.state.data?.expeditions.some(job => job.status === 'active' && job.tutorial) ? 2_000
    : state.state.data?.expeditions.some(job => job.status === 'active') ? 10_000 : 30_000,
  refetchOnWindowFocus: true, retry: 1, structuralSharing: shareDeepClaimSnapshot });
  const refetch = query.refetch;
  useLayoutEffect(() => {
    generation.current++; write.current = false; setBusy(false); setActionError(null);
    pendingRef.current = readPending(receiptKey); setPending(pendingRef.current);
  }, [receiptKey]);
  useLayoutEffect(() => { if (query.data) clock.current = { server: Date.parse(query.data.server_now), received: performance.now() }; }, [query.data]);
  useEffect(() => {
    const refresh = () => { if (ready && online() && document.visibilityState === 'visible') void refetch(); };
    document.addEventListener('visibilitychange', refresh); window.addEventListener('online', refresh);
    return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh); };
  }, [ready, refetch]);
  const data = ready && query.error instanceof DeepClaimError && query.error.code === 'access' ? null : ready ? query.data ?? null : null;
  const perform = useCallback(async (operation: Pending['operation'], args: Record<string, unknown>, label: string, resume = false) => {
    if (!ready || activeIdentity.current !== identity) throw new DeepClaimError('Sign in to your club before managing a company.', 'access');
    if (!online()) throw new DeepClaimError('Connect to the internet to confirm company actions.');
    if (write.current) throw new DeepClaimError('Another company action is still saving.', 'rule');
    const attempt = generation.current;
    const fingerprint = JSON.stringify([operation, args]);
    const previous = pendingRef.current;
    if (previous && !resume && previous.fingerprint !== fingerprint) throw new DeepClaimError('An earlier action still needs to sync. Retry it before making another change.', 'rule');
    const pending = previous ?? { operation, args: { ...args, p_request_id: crypto.randomUUID() }, fingerprint, label };
    pendingRef.current = pending; setPending(pending); savePending(receiptKey, pending);
    write.current = true; setBusy(true); setActionError(null);
    try {
      const updated = await mutateDeepClaim(pending.operation, pending.args);
      if (activeIdentity.current !== identity || generation.current !== attempt) throw new DeepClaimError('Your account or club changed. Reopen the operation in its original club.', 'access');
      if (updated.company && (updated.company.user_id !== user?.id || updated.company.club_id !== club?.id)) throw new DeepClaimError('The company does not belong to your active club.', 'access');
      pendingRef.current = null; setPending(null); savePending(receiptKey, null);
      cache.setQueryData(key, (before: DeepClaimSnapshot | undefined) => shareDeepClaimSnapshot(before, updated));
      return updated;
    } catch (error) {
      if (activeIdentity.current === identity && generation.current === attempt) {
        // These errors are guaranteed server transaction rejection, so the intent can be reviewed anew.
        if (error instanceof DeepClaimError && ['access','rule','conflict'].includes(error.code)) {
          pendingRef.current = null; setPending(null); savePending(receiptKey, null);
          void refetch();
        }
        setActionError(error instanceof Error ? error.message : 'The action could not be confirmed. Retry sync.');
      }
      throw error;
    } finally { if (activeIdentity.current === identity && generation.current === attempt) { write.current = false; setBusy(false); } }
  }, [ready, identity, receiptKey, cache, key, user?.id, club?.id, refetch]);
  const revision = data?.revision ?? 0;
  return {
    data, loading: ready && connected && query.isLoading, refreshing: query.isFetching, busy,
    error: actionError ?? (query.error instanceof Error ? query.error.message : !connected && !data
      ? 'Connect to the internet to open your company. Dispatched crews continue working while you are away.' : null),
    readOnly: !ready || !connected || !!query.error || !!pendingState,
    pendingAction: pendingState?.label ?? null,
    serverNow: () => clock.current.server + Math.max(0, performance.now() - clock.current.received),
    refresh: async () => { await refetch(); },
    bootstrap: (name: string) => perform('dc_bootstrap', { p_name: name.trim() }, 'Create company'),
    preview: (input: DeepClaimDispatchInput) => previewDeepClaim(input),
    dispatch: (input: DeepClaimDispatchInput, expectedRevision = revision) => perform('dc_dispatch', { ...deepClaimDispatchArgs(input), p_expected_revision: expectedRevision }, 'Dispatch crew'),
    collect: (id: string) => perform('dc_collect', { p_job_id: id }, 'Collect haul'),
    sell: (input: DeepClaimSellInput) => perform('dc_sell', { p_resource_key: input.resource_key, p_quantity: input.quantity, p_expected_revision: revision }, 'Sell materials'),
    upgrade: (building: DeepClaimBuildingId) => perform('dc_upgrade', { p_building_key: building, p_expected_revision: revision }, 'Upgrade building'),
    retryPending: () => pendingRef.current ? perform(pendingRef.current.operation, {}, pendingRef.current.label, true) : Promise.resolve(data),
  };
}
