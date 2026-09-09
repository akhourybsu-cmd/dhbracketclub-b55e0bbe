import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { HeroClass } from '@/lib/runedelve/classConfig';

export interface RuneWallet {
  user_id: string;
  shards: number;
  lifetime_shards_earned: number;
  slots_unlocked: number;
}

export function useRuneWallet() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['rune-delve-wallet', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<RuneWallet | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('rune_delve_wallet')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) return data as RuneWallet;
      // Lazy create with defaults.
      const { data: created, error: insErr } = await supabase
        .from('rune_delve_wallet')
        .insert({ user_id: user.id, shards: 0, lifetime_shards_earned: 0, slots_unlocked: 2 })
        .select()
        .single();
      if (insErr) throw insErr;
      return created as RuneWallet;
    },
  });
}

export function useEarnShards() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (amount: number): Promise<RuneWallet> => {
      if (!user) throw new Error('Not authenticated');
      if (amount <= 0) throw new Error('Amount must be positive');
      // Atomic server-side add (relative arithmetic) — no read-modify-write race.
      const { data, error } = await (supabase as any).rpc('rune_delve_earn_shards', { p_amount: amount });
      if (error) throw error;
      // Postgres functions returning a composite come back as the row object.
      return (Array.isArray(data) ? data[0] : data) as RuneWallet;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rune-delve-wallet', user?.id] });
    },
  });
}

export function useSpendShards() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (amount: number): Promise<RuneWallet> => {
      if (!user) throw new Error('Not authenticated');
      if (amount <= 0) throw new Error('Amount must be positive');
      // Atomic server-side deduct with an overdraw guard — the WHERE clause runs
      // under the row lock, so two concurrent spends can never both succeed.
      const { data, error } = await (supabase as any).rpc('rune_delve_spend_shards', { p_amount: amount });
      if (error) {
        // Normalize the DB guard message to the player-facing copy callers expect.
        if (String(error.message ?? '').includes('insufficient_shards')) {
          throw new Error('Not enough Rune Shards');
        }
        throw error;
      }
      return (Array.isArray(data) ? data[0] : data) as RuneWallet;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rune-delve-wallet', user?.id] });
    },
  });
}

export function useUnlockSlot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (newSlotCount: number): Promise<RuneWallet> => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('rune_delve_wallet')
        .update({ slots_unlocked: newSlotCount })
        .eq('user_id', user.id)
        .select()
        .single();
      if (error) throw error;
      return data as RuneWallet;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rune-delve-wallet', user?.id] });
    },
  });
}

// Failure tracker — drives diminishing-returns curve. Resets on clear.
export interface FailureRow {
  level_number: number;
  hero_class: HeroClass;
  failure_count: number;
  last_awarded_at: string;
}

export function useFailureRow(levelNumber: number | null, heroClass: HeroClass | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['rune-delve-failure', user?.id, heroClass, levelNumber],
    enabled: !!user && !!heroClass && levelNumber != null,
    staleTime: 0,
    queryFn: async (): Promise<FailureRow | null> => {
      if (!user || !heroClass || levelNumber == null) return null;
      const { data } = await supabase
        .from('rune_delve_failure_rewards')
        .select('level_number, hero_class, failure_count, last_awarded_at')
        .eq('user_id', user.id)
        .eq('level_number', levelNumber)
        .eq('hero_class', heroClass)
        .maybeSingle();
      return data as FailureRow | null;
    },
  });
}

export function useBumpFailure() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ levelNumber, heroClass }: { levelNumber: number; heroClass: HeroClass }): Promise<number> => {
      if (!user) throw new Error('Not authenticated');
      const { data: existing } = await supabase
        .from('rune_delve_failure_rewards')
        .select('*')
        .eq('user_id', user.id)
        .eq('level_number', levelNumber)
        .eq('hero_class', heroClass)
        .maybeSingle();
      const next = (existing?.failure_count ?? 0) + 1;
      const { error } = await supabase
        .from('rune_delve_failure_rewards')
        .upsert({
          user_id: user.id,
          level_number: levelNumber,
          hero_class: heroClass,
          failure_count: next,
          last_awarded_at: new Date().toISOString(),
        }, { onConflict: 'user_id,level_number,hero_class' });
      if (error) throw error;
      return next;
    },
    onSuccess: (_, { levelNumber, heroClass }) => {
      qc.invalidateQueries({ queryKey: ['rune-delve-failure', user?.id, heroClass, levelNumber] });
    },
  });
}

export function useResetFailure() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ levelNumber, heroClass }: { levelNumber: number; heroClass: HeroClass }) => {
      if (!user) throw new Error('Not authenticated');
      // Just zero it — don't delete, so we keep timestamps for analytics later.
      await supabase
        .from('rune_delve_failure_rewards')
        .upsert({
          user_id: user.id,
          level_number: levelNumber,
          hero_class: heroClass,
          failure_count: 0,
          last_awarded_at: new Date().toISOString(),
        }, { onConflict: 'user_id,level_number,hero_class' });
    },
    onSuccess: (_, { levelNumber, heroClass }) => {
      qc.invalidateQueries({ queryKey: ['rune-delve-failure', user?.id, heroClass, levelNumber] });
    },
  });
}
