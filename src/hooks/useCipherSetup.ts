import { useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { CipherSetupSession } from '@/lib/showdown/cipher/setup';

function deviceStorage() { try { return window.localStorage; } catch { return null; } }
export function useCipherSetupDraft(recipientId: string | undefined, rematchOf?: string | null) {
  const { user, loading: authLoading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  const ready = !!user?.id && !!club?.id && !!recipientId && !authLoading && !clubLoading;
  const key = `dh:showdown:cipher:setup:v1:${user?.id ?? ''}:${club?.id ?? ''}:${recipientId ?? ''}:${rematchOf ?? 'new'}`;
  const session = useMemo(() => new CipherSetupSession(key, ready ? deviceStorage() : null), [key, ready]);
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useLayoutEffect(() => { session.activate(); return () => session.dispose(); }, [session]);
  return { ...state, onDraftChange: session.changeDraft, prepare: session.prepare, complete: session.complete, ready };
}
