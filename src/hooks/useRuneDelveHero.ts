import { runeRequest, runeRpc } from "@/lib/runedelve/request";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import type { ClassProgress } from "@/hooks/useRuneDelveClassProgress";
import type { RuneWallet } from "@/hooks/useRuneShards";
import type { RuneDelveProgress } from "@/hooks/useRuneDelveCampaign";

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

export interface RuneBootstrapResult {
  hero: RuneDelveHero | null;
  track: ClassProgress | null;
  wallet: RuneWallet;
  progress: RuneDelveProgress | null;
}

/** Only identity preferences cross this boundary; progression comes from SQL. */
export async function bootstrapRuneDelve(
  params: {
    cls?: HeroClass;
    heroName?: string;
    createHero?: boolean;
  } = {},
): Promise<RuneBootstrapResult> {
  const { data } = await runeRpc<RuneBootstrapResult>(
    "rune_delve_bootstrap",
    {
      p_class: params.cls ?? null,
      p_hero_name: params.heroName ?? null,
      p_create_hero: params.createHero ?? false,
    },
    "Load Rune Delve account",
  );
  if (!data?.wallet)
    throw new Error("Rune Delve account was not confirmed. Please retry.");
  return data;
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
      const result = await bootstrapRuneDelve({
        cls: params.cls,
        heroName: params.hero_name,
        createHero: true,
      });
      if (!result.hero?.id || result.hero.user_id !== user.id)
        throw new Error("Hero was not confirmed. Please retry.");
      return result.hero;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rune-delve-hero", user?.id] });
      qc.invalidateQueries({
        queryKey: ["rune-delve-class-progress", user?.id],
      });
      qc.invalidateQueries({ queryKey: ["rune-delve-wallet", user?.id] });
    },
  });
}

export function useUpdateHero() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<RuneDelveHero>) => {
      if (!user) throw new Error("Not authenticated");
      if (patch.class) {
        // Older callers include a cached copy of XP/title. SQL selects the
        // canonical track atomically; none of those cached stats are sent.
        const { data } = await runeRpc<RuneDelveHero>(
          "rune_delve_select_class",
          { p_class: patch.class },
          "Select hero class",
        );
        if (!data?.id || data.user_id !== user.id || data.class !== patch.class)
          throw new Error("Class selection was not confirmed. Please retry.");
        return data;
      }
      const name = patch.hero_name?.trim();
      if (!name || name.length < 2 || name.length > 24)
        throw new Error("Hero name must be between 2 and 24 characters.");
      const { data, error } = await runeRequest(
        supabase
          .from("rune_delve_heroes")
          .update({ hero_name: name })
          .eq("user_id", user.id)
          .select()
          .single(),
      );
      if (error) throw error;
      if (!data?.id || data.user_id !== user.id || data.hero_name !== name)
        throw new Error("Hero name was not confirmed. Please retry.");
      return data as RuneDelveHero;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rune-delve-hero", user?.id] });
      qc.invalidateQueries({
        queryKey: ["rune-delve-class-progress", user?.id],
      });
      qc.invalidateQueries({ queryKey: ["rune-delve-progress", user?.id] });
      qc.invalidateQueries({ queryKey: ["rune-delve-wallet", user?.id] });
      qc.invalidateQueries({ queryKey: ["rd-active-quests", user?.id] });
    },
  });
}
