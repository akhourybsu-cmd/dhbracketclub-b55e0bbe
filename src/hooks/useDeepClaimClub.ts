import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { DeepClaimError, fetchDeepClaimClub, shareDeepClaimClubView } from '@/lib/deepClaim/service';
import type { DeepClaimSnapshot, DeepClaimStandingMetric } from '@/lib/deepClaim/types';

const online = () => typeof navigator === 'undefined' || navigator.onLine;
const listen = (listener: () => void) => {
  window.addEventListener('online', listener); window.addEventListener('offline', listener);
  return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); };
};

/** Optional club records never delay or replace private mining state. */
export function useDeepClaimClub({ enabled, metric = 'weekly_mining_value', page = 0 }: { enabled: boolean; metric?: DeepClaimStandingMetric; page?: number }) {
  const { user, loading: authLoading } = useAuth(), { club, loading: clubLoading } = useClub();
  const assets = useClubAssets(), cache = useQueryClient();
  const connected = useSyncExternalStore(listen, online, () => true);
  const ready = enabled && !!user && !!club && !authLoading && !clubLoading && !assets.loading && assets.isInstalled('deep-claim');
  const subscribeCompany = useCallback((listener: () => void) => cache.getQueryCache().subscribe(event => {
    const key = event.query.queryKey;
    if (key[0] === 'deep-claim' && key[1] === user?.id && key[2] === club?.id) listener();
  }), [cache, user?.id, club?.id]);
  const ownRevision = useSyncExternalStore(subscribeCompany, () => cache.getQueryData<DeepClaimSnapshot>(['deep-claim', user?.id, club?.id])?.revision ?? -1, () => -1);
  const query = useQuery({
    queryKey: ['deep-claim-club', user?.id, club?.id, metric, page], enabled: ready,
    queryFn: async () => {
      const next = await fetchDeepClaimClub(metric, page);
      if (!user || !club || next.user_id !== user.id || next.club_id !== club.id) throw new DeepClaimError('Club records do not belong to your active account and club.', 'access');
      return next;
    },
    staleTime: 10_000, gcTime: 60_000, retry: (failures, error) => !(error instanceof DeepClaimError && ['access','data','rule'].includes(error.code)) && failures < 1, refetchOnWindowFocus: true,
    refetchInterval: () => document.visibilityState === 'visible' ? 15_000 : false,
    structuralSharing: shareDeepClaimClubView,
  });
  const refetch = query.refetch;
  const refresh = useCallback(async () => { await refetch(); }, [refetch]);
  const sharedOwnRevision = query.data?.own_revision ?? -1;
  useEffect(() => {
    if (ready && ownRevision >= 0 && ownRevision < sharedOwnRevision) void cache.invalidateQueries({ queryKey: ['deep-claim', user?.id, club?.id] });
  }, [ready, ownRevision, sharedOwnRevision, cache, user?.id, club?.id]);
  useEffect(() => {
    const resume = () => { if (ready && online() && document.visibilityState === 'visible') void refetch(); };
    document.addEventListener('visibilitychange', resume); window.addEventListener('online', resume);
    return () => { document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); };
  }, [ready, refetch]);
  const data = ready && !(query.error instanceof DeepClaimError && query.error.code === 'access') ? query.data ?? null : null;
  return { data, loading: ready && connected && query.isLoading, refreshing: query.isFetching,
    readOnly: !ready || !connected || !!query.error,
    error: query.error instanceof Error ? query.error.message : !connected ? 'Connect to the internet to refresh club records. Private crews continue working.' : null,
    refresh };
}
