import { runeRequest } from "@/lib/runedelve/request";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { HeroClass } from "@/lib/runedelve/classConfig";

export interface RuneDelveHero {
  id: string;
  user_id: string;
  hero_name: string;
  class: HeroClass;
  level: number;
  xp: number;
  current_streak: number;
  best_streak: number;
  lifetime_runs: number;
  lifetime_score: number;
  cosmetic_title: string | null;
  last_run_date: string | null;
}

export function useRuneDelveHero() {
  const { user } = useAuth();
  return useQuery({
    retry: false,
    queryKey: ["rune-delve-hero", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<RuneDelveHero | null> => {
      if (!user) return null;
      const { data, error } = await runeRequest(
        supabase
          .from("rune_delve_heroes")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
      );
      if (error && error.code !== "PGRST116") throw error;
      return (data as RuneDelveHero) ?? null;
    },
  });
}

export function useEnsureHero() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { hero_name?: string; cls?: HeroClass }) => {
      if (!user) throw new Error("Not authenticated");
      const payload = {
        user_id: user.id,
        hero_name: params.hero_name ?? "Adventurer",
        class: params.cls ?? "warrior",
      };
      const { data, error } = await runeRequest(
        supabase
          .from("rune_delve_heroes")
          .upsert(payload, { onConflict: "user_id", ignoreDuplicates: true })
          .select()
          .maybeSingle(),
      );
      if (error) throw error;
      if (data) return data as RuneDelveHero;
      const { data: canonical } = await runeRequest(
        supabase
          .from("rune_delve_heroes")
          .select("*")
          .eq("user_id", user.id)
          .single(),
      );
      return canonical as RuneDelveHero;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rune-delve-hero", user?.id] });
    },
  });
}

export function useUpdateHero() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<RuneDelveHero>) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await runeRequest(
        supabase
          .from("rune_delve_heroes")
          .update(patch)
          .eq("user_id", user.id)
          .select()
          .single(),
      );
      if (error) throw error;
      return data as RuneDelveHero;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rune-delve-hero", user?.id] });
    },
  });
}
