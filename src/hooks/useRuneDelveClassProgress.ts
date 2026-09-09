import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { HeroClass } from '@/lib/runedelve/classConfig';
import { titleForLevel } from '@/lib/runedelve/classConfig';

/**
 * Per-class progression track. One row per (user_id, class).
 * Decoupled from `rune_delve_heroes` so a single hero can hold separate
 * level/XP/title state for warrior, mage, rogue, and cleric.
 */
export interface ClassProgress {
  id: string;
  user_id: string;
  class: HeroClass;
  xp: number;
  level: number;
  cosmetic_title: string | null;
  lifetime_runs: number;
  lifetime_score: number;
  highest_unlocked_level: number;
  highest_completed_level: number;
  total_levels_cleared: number;
  current_chapter: number;
}

export function useAllClassProgress() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['rune-delve-class-progress', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<ClassProgress[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('rune_delve_class_progress')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return (data ?? []) as ClassProgress[];
    },
  });
}

/** Pull a single class's track, lazily creating a fresh one if missing. */
export function useEnsureClassProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cls: HeroClass): Promise<ClassProgress> => {
      if (!user) throw new Error('Not authenticated');
      const { data: existing } = await supabase
        .from('rune_delve_class_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('class', cls)
        .maybeSingle();
      if (existing) return existing as ClassProgress;
      const { data, error } = await supabase
        .from('rune_delve_class_progress')
        .insert({
          user_id: user.id,
          class: cls,
          xp: 0,
          level: 1,
          cosmetic_title: titleForLevel(1, cls),
        })
        .select()
        .single();
      if (error) throw error;
      return data as ClassProgress;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rune-delve-class-progress', user?.id] });
    },
  });
}

/** Apply XP / level / title / lifetime totals to a specific class track. */
export function useUpdateClassProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { cls: HeroClass; patch: Partial<ClassProgress> }) => {
      if (!user) throw new Error('Not authenticated');
      // Upsert keeps this safe if a class row hasn't been created yet (e.g.
      // legacy hero whose backfill missed an edge case).
      const { data, error } = await supabase
        .from('rune_delve_class_progress')
        .upsert(
          { user_id: user.id, class: params.cls, ...params.patch },
          { onConflict: 'user_id,class' },
        )
        .select()
        .single();
      if (error) throw error;
      return data as ClassProgress;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rune-delve-class-progress', user?.id] });
    },
  });
}
