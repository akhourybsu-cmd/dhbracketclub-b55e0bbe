import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Review permission follows the draft's actual season, including archived seasons. */
export function useDraftReviewAccess(draftId: string | undefined, clubId: string | undefined) {
  const { user } = useAuth();
  const key = `${user?.id ?? ''}:${clubId ?? ''}:${draftId ?? ''}`;
  const [state, setState] = useState<{ key: string; seasonId: string | null; allowed: boolean; verified: boolean }>({ key: '', seasonId: null, allowed: false, verified: false });
  useEffect(() => {
    if (!draftId || !clubId || !user?.id) return;
    let cancelled = false;
    void (async () => {
      const { data: entry, error } = await supabase.from('draft_season_entries')
        .select('season_id').eq('draft_id', draftId).eq('club_id', clubId).maybeSingle();
      if (cancelled) return;
      if (error || !entry) {
        setState({ key, seasonId: null, allowed: false, verified: !error });
        return;
      }
      const permission = await supabase.rpc('draft_commissioner_can_manage' as never, { p_season_id: entry.season_id } as never);
      if (!cancelled) setState({ key, seasonId: entry.season_id, allowed: !permission.error && permission.data === true, verified: true });
    })().catch(() => { if (!cancelled) setState({ key, seasonId: null, allowed: false, verified: false }); });
    return () => { cancelled = true; };
  }, [draftId, clubId, user?.id, key]);
  return state.key === key ? { seasonId: state.seasonId, allowed: state.allowed, verified: state.verified, resolved: true } : { seasonId: null, allowed: false, verified: false, resolved: false };
}
