import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { QUERY_TIMEOUT_MS, withTimeout } from '@/lib/asyncGuards';

export interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  rollout: { user_ids?: string[] } | null;
  updated_at: string;
}

function isOnFor(flag: FeatureFlag | undefined, userId?: string) {
  if (!flag) return false;
  if (flag.enabled) return true;
  const ids = flag.rollout?.user_ids;
  return Boolean(userId && Array.isArray(ids) && ids.includes(userId));
}

async function fetchFlags(): Promise<FeatureFlag[]> {
  const query = supabase.from('app_feature_flags').select('*').order('key');
  const { data, error } = await withTimeout<any>(Promise.resolve(query), QUERY_TIMEOUT_MS, 'feature flags');
  if (error) throw error;
  return (data ?? []) as FeatureFlag[];
}

/**
 * Single-flag check. Returns `enabled` when the flag is on platform-wide OR
 * the signed-in user is listed in the flag's rollout allow-list.
 */
export function useFeatureFlag(key: string) {
  const { user } = useAuth();
  const [flag, setFlag] = useState<FeatureFlag | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchFlags()
      .then(rows => {
        if (!alive) return;
        setFlag(rows.find(r => r.key === key));
      })
      .catch(() => {
        /* flags are additive — a failure just means "off" */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [key]);

  return { enabled: isOnFor(flag, user?.id), loading, flag };
}

/** Admin list + mutators for the feature-flag console. */
export function useFeatureFlags() {
  const { user } = useAuth();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setFlags(await fetchFlags());
    } catch (err: any) {
      setError(err?.message || 'Could not load feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setEnabled = useCallback(
    async (key: string, enabled: boolean) => {
      const snapshot = flags;
      setFlags(prev => prev.map(f => (f.key === key ? { ...f, enabled } : f)));
      const { error: updateError } = await supabase
        .from('app_feature_flags')
        .update({ enabled })
        .eq('key', key);
      if (updateError) {
        setFlags(snapshot);
        throw updateError;
      }
    },
    [flags],
  );

  const toggleMe = useCallback(
    async (key: string) => {
      if (!user?.id) return;
      const current = flags.find(f => f.key === key);
      const ids = new Set(current?.rollout?.user_ids ?? []);
      if (ids.has(user.id)) ids.delete(user.id);
      else ids.add(user.id);
      const rollout = { ...(current?.rollout ?? {}), user_ids: [...ids] };
      const snapshot = flags;
      setFlags(prev => prev.map(f => (f.key === key ? { ...f, rollout } : f)));
      const { error: updateError } = await supabase
        .from('app_feature_flags')
        .update({ rollout } as any)
        .eq('key', key);
      if (updateError) {
        setFlags(snapshot);
        throw updateError;
      }
    },
    [flags, user?.id],
  );

  const myFlags = useMemo(
    () => new Set(flags.filter(f => isOnFor(f, user?.id)).map(f => f.key)),
    [flags, user?.id],
  );

  return { flags, loading, error, refresh, setEnabled, toggleMe, myFlags, userId: user?.id };
}
