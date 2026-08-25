import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';

export type ClubRequest = {
  id: string;
  proposed_name: string;
  reason: string | null;
  user_note: string | null;
  status: 'pending' | 'needs_info' | 'approved' | 'rejected' | 'cancelled';
  review_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OnboardingState =
  | 'loading'
  | 'approved'
  | 'pending'
  | 'needs_info'
  | 'rejected'
  | 'no_request';

export function useOnboardingStatus() {
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading, isPlatformOwner } = useClub();
  const [request, setRequest] = useState<ClubRequest | null>(null);
  const [requestLoading, setRequestLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setRequest(null);
      setRequestLoading(false);
      return;
    }
    setRequestLoading(true);
    try {
      const { data } = await withTimeout(
        (supabase as any)
          .from('club_requests')
          .select('id, proposed_name, reason, user_note, status, review_notes, created_at, updated_at')
          .eq('requested_by', user.id)
          .in('status', ['pending', 'needs_info', 'rejected'])
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        QUERY_TIMEOUT_MS,
        'club request status',
      );
      setRequest((data as ClubRequest) ?? null);
    } catch (err) {
      console.error('[useOnboardingStatus] request load failed', err);
      setRequest(null);
    } finally {
      setRequestLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const loading = authLoading || clubLoading || requestLoading;

  let state: OnboardingState = 'loading';
  if (!loading) {
    if (club || isPlatformOwner) state = 'approved';
    else if (request?.status === 'pending') state = 'pending';
    else if (request?.status === 'needs_info') state = 'needs_info';
    else if (request?.status === 'rejected') state = 'rejected';
    else state = 'no_request';
  }

  return { state, request, club, isPlatformOwner, loading, refresh: load };
}

export function resolvePostLoginDestination(
  state: OnboardingState,
  isPlatformOwner: boolean,
  intended: string | null,
): string {
  if (state === 'approved') return intended || '/dashboard';
  if (isPlatformOwner) return '/admin/clubs';
  return '/club/request';
}
