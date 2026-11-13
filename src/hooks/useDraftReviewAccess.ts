import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';

/** Review permission follows the draft's actual season, including archived seasons. */
export function useDraftReviewAccess(draftId: string | undefined, clubId: string | undefined) {
  const { user } = useAuth();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const key = `${user?.id ?? ''}:${clubId ?? ''}:${draftId ?? ''}:${revision}`;
  const [state, setState] = useState<{ key: string; seasonId: string | null; allowed: boolean; verified: boolean }>({ key: '', seasonId: null, allowed: false, verified: false });
  useEffect(() => {
    if (!draftId || !clubId || !user?.id) return;
    let cancelled = false;
    void (async () => {
      const { data: entry, error } = await withTimeout(supabase.from('draft_season_entries')
        .select('season_id').eq('draft_id', draftId).eq('club_id', clubId).maybeSingle(), QUERY_TIMEOUT_MS, 'Draft review season');
      if (cancelled) return;
      if (error || !entry) {
        setState({ key, seasonId: null, allowed: false, verified: !error });
        return;
      }
      const permission = await withTimeout(supabase.rpc('draft_commissioner_can_manage' as never, { p_season_id: entry.season_id } as never), QUERY_TIMEOUT_MS, 'Draft review permission');
      if (!cancelled) setState({ key, seasonId: entry.season_id, allowed: !permission.error && permission.data === true, verified: true });
    })().catch(() => { if (!cancelled) setState({ key, seasonId: null, allowed: false, verified: false }); });
    return () => { cancelled = true; };
  }, [draftId, clubId, user?.id, key]);
  return state.key === key ? { seasonId: state.seasonId, allowed: state.allowed, verified: state.verified, resolved: true, refresh } : { seasonId: null, allowed: false, verified: false, resolved: false, refresh };
}
