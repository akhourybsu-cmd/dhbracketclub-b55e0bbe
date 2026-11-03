import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { DEEP_CLAIM_MUTATIONS, DeepClaimError, deepClaimDispatchArgs, deepClaimOperationArgs, fetchDeepClaim, mutateDeepClaim, previewDeepClaim, shareDeepClaimSnapshot, type DeepClaimMutation } from '@/lib/deepClaim/service';
import { clearPendingJournal, pendingRequestId, readPendingJournal, subscribePendingJournal, writePendingJournal, type DeepClaimPending } from '@/lib/deepClaim/pendingJournal';
import type { DeepClaimBuildingId, DeepClaimDispatchInput, DeepClaimResources, DeepClaimSellInput, DeepClaimSnapshot, DeepClaimSocialPreferencesInput, DeepClaimStatId } from '@/lib/deepClaim/types';

type Pending = DeepClaimPending;
const online = () => typeof navigator === 'undefined' || navigator.onLine;
const listenOnline = (listener: () => void) => { window.addEventListener('online', listener); window.addEventListener('offline', listener); return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); }; };

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
  const pendingRef = useRef<Pending | null>(readPendingJournal(receiptKey)[0] ?? null);
  const [pendingState, setPending] = useState(pendingRef.current);
  const syncPending = useCallback(() => { const next = readPendingJournal(receiptKey)[0] ?? null; pendingRef.current = next; setPending(next); return next; }, [receiptKey]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const clock = useRef({ server: Date.now(), received: performance.now() });
  const query = useQuery({ queryKey: key, enabled: ready, queryFn: async () => {
    const data = await fetchDeepClaim();
    if (data.company && (data.company.user_id !== user?.id || data.company.club_id !== club?.id)) throw new DeepClaimError('The company does not belong to your active club.', 'access');
    return data;
  }, staleTime: 10_000, refetchInterval: state => document.visibilityState !== 'visible' ? false
    : state.state.data?.expeditions.some(job => job.status === 'active' && job.tutorial) ? 2_000
    : state.state.data?.expeditions.some(job => job.status === 'active') || state.state.data?.production_jobs?.some(job => job.status === 'active') || state.state.data?.business?.research.some(job => job.status === 'active') ? 10_000 : 30_000,
  refetchOnWindowFocus: true, retry: 1, structuralSharing: shareDeepClaimSnapshot });
  const refetch = query.refetch;
  useLayoutEffect(() => {
    generation.current++; write.current = false; setBusy(false); setActionError(null);
    syncPending();
    return subscribePendingJournal(receiptKey, syncPending);
  }, [receiptKey, syncPending]);
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
    // Re-read durable state: another tab or mounted hook may have recorded an uncertain intent since mount.
    const journal = readPendingJournal(receiptKey);
    const oldest = journal[0] ?? null;
    const pending = resume ? oldest : journal.find(entry => entry.fingerprint === fingerprint) ?? null;
    if (journal.length && !pending) throw new DeepClaimError('An earlier action still needs to sync. Retry it before making another change.', 'rule');
    if (resume && !pending) return cache.getQueryData<DeepClaimSnapshot>(key) ?? null;
    const intent: Pending = pending ?? { operation, args: { ...args, p_request_id: crypto.randomUUID() }, fingerprint, label, createdAt: Date.now() };
    const requestId = pendingRequestId(intent);
    if (!pending) writePendingJournal(receiptKey, intent);
    pendingRef.current = journal[0] ?? intent; setPending(pendingRef.current);
    write.current = true; setBusy(true); setActionError(null);
    try {
      const updated = await mutateDeepClaim(intent.operation, intent.args);
      if (activeIdentity.current !== identity || generation.current !== attempt) throw new DeepClaimError('Your account or club changed. Reopen the operation in its original club.', 'access');
      // A snapshot for another member/club cannot prove the transaction outcome: keep the receipt for a safe retry.
      if (!updated || (updated.company && (updated.company.user_id !== user?.id || updated.company.club_id !== club?.id)))
        throw new DeepClaimError('The confirmation could not be verified for your company. Retry sync to confirm it safely.', 'data');
      clearPendingJournal(receiptKey, requestId); syncPending();
      cache.setQueryData(key, (before: DeepClaimSnapshot | undefined) => shareDeepClaimSnapshot(before, updated));
      void cache.invalidateQueries({ queryKey: ['deep-claim-club', user?.id, club?.id] });
      // Monotonic: a replayed old receipt returns the accepted newer cache snapshot rather than stale data.
      return cache.getQueryData<DeepClaimSnapshot>(key) ?? updated;
    } catch (error) {
      if (activeIdentity.current === identity && generation.current === attempt) {
        // These errors are guaranteed server transaction rejection, so the intent can be reviewed anew.
        if (error instanceof DeepClaimError && ['access','rule','conflict'].includes(error.code)) {
          clearPendingJournal(receiptKey, requestId); syncPending();
          void refetch();
          void cache.invalidateQueries({ queryKey: ['deep-claim-club', user?.id, club?.id] });
        }
        setActionError(error instanceof Error ? error.message : 'The action could not be confirmed. Retry sync.');
      }
      throw error;
    } finally { if (activeIdentity.current === identity && generation.current === attempt) { write.current = false; setBusy(false); } }
  }, [ready, identity, receiptKey, cache, key, user?.id, club?.id, refetch, syncPending]);
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
    preview: (input: DeepClaimDispatchInput) => previewDeepClaim(input, data?.schema_version ?? 1),
    dispatch: (input: DeepClaimDispatchInput, expectedRevision = revision) => perform((data?.schema_version ?? 1) >= 3 ? 'dc_dispatch_operation' : 'dc_dispatch', { ...((data?.schema_version ?? 1) >= 3 ? deepClaimOperationArgs(input) : deepClaimDispatchArgs(input)), p_expected_revision: expectedRevision }, 'Dispatch crew'),
    collect: (id: string) => perform('dc_collect', { p_job_id: id }, 'Collect haul'),
    sell: (input: DeepClaimSellInput) => perform('dc_sell', { p_resource_key: input.resource_key, p_quantity: input.quantity, p_expected_revision: revision }, 'Sell materials'),
    upgrade: (building: DeepClaimBuildingId) => perform('dc_upgrade', { p_building_key: building, p_expected_revision: revision }, 'Upgrade building'),
    hire: (candidateId: string) => perform('dc_hire', { p_candidate_id: candidateId, p_expected_revision: revision }, 'Hire employee'),
    train: (workerId: string, stat: DeepClaimStatId) => perform('dc_train', { p_worker_id: workerId, p_stat: stat, p_expected_revision: revision }, 'Train employee'),
    assignEquipment: (itemId: string, workerId: string | null) => perform('dc_assign_equipment', { p_item_id: itemId, p_worker_id: workerId, p_expected_revision: revision }, 'Assign equipment'),
    repairEquipment: (itemId: string) => perform('dc_repair_equipment', { p_item_id: itemId, p_expected_revision: revision }, 'Repair equipment'),
    retireEquipment: (itemId: string) => perform('dc_retire_equipment', { p_item_id: itemId, p_expected_revision: revision }, 'Retire equipment'),
    startProduction: (recipeKey: string, batches: number) => perform('dc_start_production', { p_recipe_key: recipeKey, p_batches: batches, p_expected_revision: revision }, 'Start production'),
    collectProduction: (jobId: string) => perform('dc_collect_production', { p_job_id: jobId }, 'Collect production'),
    resolveDiscovery: (discoveryId: string, choice: 'keep' | 'sell' | 'salvage', expectedRevision = revision) => perform('dc_resolve_discovery', { p_discovery_id: discoveryId, p_choice: choice, p_expected_revision: expectedRevision }, 'Review discovery'),
    startResearch: (researchKey: string, expectedRevision = revision) => perform('dc_start_research', { p_research_key: researchKey, p_expected_revision: expectedRevision }, 'Start research'),
    fulfillContract: (contractKey: string, expectedRevision = revision) => perform('dc_fulfill_contract', { p_contract_key: contractKey, p_expected_revision: expectedRevision }, 'Deliver contract'),
    claimMilestone: (milestoneKey: string, expectedRevision = revision) => perform('dc_claim_milestone', { p_milestone_key: milestoneKey, p_expected_revision: expectedRevision }, 'Claim company milestone'),
    setSocialPreferences: (input: DeepClaimSocialPreferencesInput, expectedRevision = revision) => perform('dc_set_social_preferences', { p_standings: input.standings_enabled, p_showcase: input.showcase_enabled, p_featured_discovery_ids: [...input.featured_discovery_ids], p_expected_revision: expectedRevision }, 'Update company sharing'),
    contributeProject: (projectKey: string, resources: DeepClaimResources, expectedRevision = revision) => perform('dc_contribute_project', { p_project_key: projectKey, p_resources: { ...resources }, p_expected_revision: expectedRevision }, 'Contribute materials'),
    claimProject: (projectKey: string, expectedRevision = revision) => perform('dc_claim_project', { p_project_key: projectKey, p_expected_revision: expectedRevision }, 'Claim club project'),
    retryPending: () => { const oldest = readPendingJournal(receiptKey)[0]; return oldest ? perform(oldest.operation, {}, oldest.label, true) : Promise.resolve(data); },
  };
}
