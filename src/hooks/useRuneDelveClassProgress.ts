import { runeRequest } from "@/lib/runedelve/request";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import { bootstrapRuneDelve } from "@/hooks/useRuneDelveHero";

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
    retry: false,
    queryKey: ["rune-delve-class-progress", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<ClassProgress[]> => {
      if (!user) return [];
      const { data, error } = await runeRequest(
        supabase
          .from("rune_delve_class_progress")
          .select("*")
          .eq("user_id", user.id),
      );
      if (error) throw error;
      return (data ?? []) as ClassProgress[];
    },
  });
}

/** Let SQL restore legacy state or create a fresh class with safe defaults. */
export function useEnsureClassProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cls: HeroClass): Promise<ClassProgress> => {
      if (!user) throw new Error("Not authenticated");
      const { track } = await bootstrapRuneDelve({ cls });
      if (!track?.id || track.user_id !== user.id || track.class !== cls)
        throw new Error("Class progress was not confirmed. Please retry.");
      return track;
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["rune-delve-class-progress", user?.id],
      });
      qc.invalidateQueries({ queryKey: ["rune-delve-wallet", user?.id] });
    },
  });
}

/** Retained for old imports; only acknowledged settlements can credit XP. */
export function useUpdateClassProgress() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (params: {
      cls: HeroClass;
      patch: Partial<ClassProgress>;
    }): Promise<ClassProgress> => {
      if (!user) throw new Error("Not authenticated");
      throw new Error(
        "Class progress is managed by the server. Please refresh.",
      );
    },
  });
}
