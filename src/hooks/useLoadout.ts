import { runeRequest, runeRpc } from "@/lib/runedelve/request";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { HeroClass } from "@/lib/runedelve/classConfig";

export interface Loadout {
  id?: string;
  user_id: string;
  class: HeroClass;
  slot_1: string | null;
  slot_2: string | null;
  slot_3: string | null;
}

const empty = (cls: HeroClass, userId: string): Loadout => ({
  user_id: userId,
  class: cls,
  slot_1: null,
  slot_2: null,
  slot_3: null,
});

export function useLoadout(cls: HeroClass | undefined) {
  const { user } = useAuth();
  return useQuery({
    retry: false,
    queryKey: ["rune-delve-loadout", user?.id, cls],
    enabled: !!user && !!cls,
    staleTime: 30_000,
    queryFn: async (): Promise<Loadout> => {
      if (!user || !cls) return empty("warrior", "");
      const { data } = await runeRequest(
        supabase
          .from("rune_delve_loadouts")
          .select("*")
          .eq("user_id", user.id)
          .eq("class", cls)
          .maybeSingle(),
      );
      return (data as Loadout) ?? empty(cls, user.id);
    },
  });
}

export function useAllLoadouts() {
  const { user } = useAuth();
  return useQuery({
    retry: false,
    queryKey: ["rune-delve-loadouts-all", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<Loadout[]> => {
      if (!user) return [];
      const { data, error } = await runeRequest(
        supabase.from("rune_delve_loadouts").select("*").eq("user_id", user.id),
      );
      if (error) throw error;
      return (data ?? []) as Loadout[];
    },
  });
}

export function useUpdateLoadout() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      cls: HeroClass;
      slot_1: string | null;
      slot_2: string | null;
      slot_3: string | null;
    }) => {
      if (!user) throw new Error("Not authenticated");
      // Guardrail: prevent the same relic in two slots.
      const slots = [params.slot_1, params.slot_2, params.slot_3].filter(
        Boolean,
      );
      if (new Set(slots).size !== slots.length) {
        throw new Error("Each relic can only be equipped once.");
      }
      const { data } = await runeRpc<Loadout>(
        "rune_delve_equip",
        {
          p_class: params.cls,
          p_slot_1: params.slot_1,
          p_slot_2: params.slot_2,
          p_slot_3: params.slot_3,
        },
        "Equip relics",
      );
      if (!data) throw new Error("Loadout was not confirmed. Please retry.");
      return data as Loadout;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["rune-delve-loadout", user?.id, vars.cls],
      });
      qc.invalidateQueries({ queryKey: ["rune-delve-loadouts-all", user?.id] });
    },
  });
}
