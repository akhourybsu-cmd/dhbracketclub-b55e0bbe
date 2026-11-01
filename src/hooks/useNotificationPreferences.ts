import { useCallback, useRef } from 'react';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';

export interface NotificationPreferences {
  chat_messages: boolean; polls: boolean; events: boolean; drafts: boolean;
  mentions: boolean; lockbox: boolean; portfolio_wars: boolean; pickem: boolean;
  rankings: boolean; posts: boolean; lore: boolean; celebrations: boolean;
  narrative: boolean; brackets: boolean; nexus: boolean; runedelve: boolean;
  deep_claim: boolean; system: boolean;
}
export const NOTIFICATION_DEFAULTS: NotificationPreferences = {
  chat_messages: true, polls: true, events: true, drafts: true, mentions: true,
  lockbox: true, portfolio_wars: true, pickem: true, rankings: true, posts: true,
  lore: true, celebrations: true, narrative: true, brackets: true, nexus: true,
  runedelve: true, deep_claim: true, system: true,
};
const columns = Object.keys(NOTIFICATION_DEFAULTS).join(',');
const message = (error: unknown) => error instanceof Error ? error.message : 'Notification preferences could not sync.';

/** Existing global preferences, shared by Profile and game settings. */
export function useNotificationPreferences() {
  const { user } = useAuth();
  const uid = user?.id;
  const identity = useRef(uid); identity.current = uid;
  const cache = useQueryClient();
  const key = ['notification-preferences', uid] as const;
  const writes = ['notification-preferences', uid, 'write'];
  const saving = useIsMutating({ mutationKey: writes }) > 0;
  const query = useQuery({
    queryKey: key, enabled: !!uid && !saving, staleTime: 30_000, retry: 1,
    queryFn: async (): Promise<NotificationPreferences> => {
      const result = await withTimeout(supabase.from('notification_preferences').select(columns)
        .eq('user_id', uid!).maybeSingle(), QUERY_TIMEOUT_MS, 'Notification preferences');
      if (result.error) throw new Error(result.error.message || 'Notification preferences could not load.');
      const stored = result.data as Partial<NotificationPreferences> | null;
      return { ...NOTIFICATION_DEFAULTS, ...stored };
    },
  });
  const mutation = useMutation({
    mutationKey: writes,
    mutationFn: async ({ field, value, owner }: { field: keyof NotificationPreferences; value: boolean; owner: string }) => {
      if (owner !== identity.current) throw new Error('Your account changed. Load its notification preferences first.');
      // Upsert only the changed field, preserving other devices' settings.
      const result = await withTimeout(supabase.from('notification_preferences').upsert({
        user_id: owner, [field]: value, updated_at: new Date().toISOString(),
      } as never, { onConflict: 'user_id' }), QUERY_TIMEOUT_MS, 'Save notification preference');
      if (result.error) throw new Error(result.error.message || 'Notification preference could not save.');
    },
    onMutate: async ({ field, value, owner }) => {
      const scoped = ['notification-preferences', owner] as const;
      await cache.cancelQueries({ queryKey: scoped, exact: true });
      const previous = cache.getQueryData<NotificationPreferences>(scoped)?.[field] ?? NOTIFICATION_DEFAULTS[field];
      cache.setQueryData<NotificationPreferences>(scoped, old => ({ ...NOTIFICATION_DEFAULTS, ...old, [field]: value }));
      return { previous, scoped };
    },
    onError: (_error, { field }, context) => {
      if (context) cache.setQueryData<NotificationPreferences>(context.scoped, old => ({ ...NOTIFICATION_DEFAULTS, ...old, [field]: context.previous }));
    },
    onSettled: (_data, _error, { owner }) => {
      if (owner === identity.current) void cache.invalidateQueries({ queryKey: ['notification-preferences', owner], exact: true });
    },
  });
  const update = useCallback(async (field: keyof NotificationPreferences, value: boolean) => {
    if (!uid || uid !== identity.current) throw new Error('Sign in to update notification preferences.');
    if (query.isPending || query.isError) throw new Error('Load notification preferences before changing them.');
    if (cache.isMutating({ mutationKey: ['notification-preferences', uid, 'write'] })) throw new Error('Wait for the current preference to save.');
    await mutation.mutateAsync({ field, value, owner: uid });
    if (uid !== identity.current) throw new Error('Your account changed while this preference was saving.');
  }, [uid, query.isPending, query.isError, cache, mutation]);
  const refresh = useCallback(async () => { mutation.reset(); await query.refetch(); }, [query, mutation]);
  const error = query.error || (mutation.variables?.owner === uid ? mutation.error : null);
  return { prefs: uid ? query.data ?? NOTIFICATION_DEFAULTS : NOTIFICATION_DEFAULTS,
    loading: !!uid && query.isPending, saving, error: error ? message(error) : null, update, refresh };
}
