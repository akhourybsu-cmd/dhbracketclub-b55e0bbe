import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import {
  COMMISSIONER_LOAD_ERROR, deriveCommissionerInbox, deriveCommissionerParticipation,
  deriveCommissionerPoints, deriveCommissionerReadiness, fetchCommissionerWorkspace, mutateCommissioner,
  type CommissionerAction, type CommissionerMutationResult, type CommissionerWorkspaceData,
} from '@/lib/draft/commissioner';

interface WorkspaceState {
  scope: string; data: CommissionerWorkspaceData | null; loading: boolean;
  error: string | null; mutationError: string | null; busyAction: CommissionerAction | null;
}
const emptyState = (scope: string, loading = false): WorkspaceState => ({ scope, data: null, loading, error: null, mutationError: null, busyAction: null });

/** Private management data is scoped to the authenticated member, club and selected season. */
export function useCommissionerWorkspace(seasonId: string | null | undefined, enabled = true) {
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  const clubId = club?.id;
  const scope = enabled && !authLoading && !clubLoading && user && club && seasonId ? `${user.id}:${club.id}:${seasonId}` : '';
  const [state, setState] = useState<WorkspaceState>(() => emptyState(scope, Boolean(scope)));
  const requests = useRef({ scope: '', active: false, generation: 0, fetch: 0, mutationBusy: false, intents: new Map<string, string>() }).current;

  const refresh = useCallback(async () => {
    if (!scope || !clubId || !seasonId || !requests.active || requests.scope !== scope) return;
    const request = ++requests.fetch;
    setState(current => ({ ...(current.scope === scope ? current : emptyState(scope)), loading: true, error: null }));
    try {
      const data = await fetchCommissionerWorkspace(clubId, seasonId);
      if (requests.active && requests.scope === scope && request === requests.fetch) setState(current => ({ ...current, scope, data, loading: false, error: null }));
    } catch {
      if (requests.active && requests.scope === scope && request === requests.fetch) setState(current => ({ ...current, loading: false, error: COMMISSIONER_LOAD_ERROR }));
    }
  }, [clubId, requests, scope, seasonId]);

  useLayoutEffect(() => {
    requests.scope = scope;
    requests.active = true;
    requests.generation++;
    requests.mutationBusy = false;
    requests.intents.clear();
    setState(emptyState(scope, Boolean(scope)));
    void refresh();
    return () => { requests.active = false; requests.generation++; requests.fetch++; };
  }, [requests, scope, refresh]);

  const mutate = useCallback(async (
    action: CommissionerAction, payload: Record<string, unknown>, reason: string, requestId?: string,
  ): Promise<CommissionerMutationResult> => {
    if (!scope || !seasonId || !requests.active || requests.scope !== scope) throw new Error('Choose an active commissioner workspace first.');
    if (requests.mutationBusy) throw new Error('Another change is still saving.');
    const generation = requests.generation;
    const isCurrent = () => requests.active && requests.scope === scope && requests.generation === generation;
    const intent = JSON.stringify([action, payload, reason.trim()]);
    const identity = requestId ?? requests.intents.get(intent) ?? crypto.randomUUID();
    requests.intents.set(intent, identity);
    requests.mutationBusy = true;
    setState(current => ({ ...current, busyAction: action, mutationError: null }));
    try {
      const result = await mutateCommissioner(seasonId, action, payload, reason, identity);
      if (isCurrent()) {
        requests.intents.delete(intent);
        // A committed mutation remains successful even when the following read fails.
        await refresh();
      }
      return result;
    } catch (error) {
      if (isCurrent()) setState(current => ({ ...current, mutationError: error instanceof Error ? error.message : 'The change could not be saved.' }));
      throw error;
    } finally {
      if (isCurrent()) {
        requests.mutationBusy = false;
        setState(current => ({ ...current, busyAction: null }));
      }
    }
  }, [requests, scope, seasonId, refresh]);

  const current = state.scope === scope && scope ? state : emptyState(scope);
  const data = current.data;
  const points = useMemo(() => data ? deriveCommissionerPoints(data) : [], [data]);
  const actions = useMemo(() => data ? deriveCommissionerInbox(data) : [], [data]);
  const participation = useMemo(() => data ? deriveCommissionerParticipation(data) : [], [data]);
  const readiness = useMemo(() => data ? deriveCommissionerReadiness(data) : null, [data]);
  return {
    data, points, actions, participation, readiness, canManage: Boolean(data),
    loading: Boolean(scope) && !data && current.loading, refreshing: Boolean(data) && current.loading,
    error: current.error, mutationError: current.mutationError, busy: Boolean(current.busyAction),
    busyAction: current.busyAction, refresh, mutate,
  };
}
