import { runeRequest } from "@/lib/runedelve/request";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import { bootstrapRuneDelve } from "@/hooks/useRuneDelveHero";

export interface RuneWallet {
  user_id: string;
  shards: number;
  lifetime_shards_earned: number;
  slots_unlocked: number;
}

export function useRuneWallet() {
  const { user } = useAuth();
  return useQuery({
    retry: false,
    queryKey: ["rune-delve-wallet", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<RuneWallet | null> => {
      if (!user) return null;
      const { data, error } = await runeRequest(
        supabase
          .from("rune_delve_wallet")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
      );
      if (error && error.code !== "PGRST116") throw error;
      if (data) return data as RuneWallet;
      const { wallet } = await bootstrapRuneDelve();
      if (wallet.user_id !== user.id)
        throw new Error("Wallet was not confirmed. Please retry.");
      return wallet;
    },
  });
}

/** Legacy imports cannot credit/debit arbitrary amounts outside settlement. */
function useServerManagedShards() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (_amount: number): Promise<RuneWallet> => {
      if (!user) throw new Error("Not authenticated");
      throw new Error("Rune Shards are managed by the server. Please refresh.");
    },
  });
}

export function useEarnShards() {
  return useServerManagedShards();
}

export function useSpendShards() {
  return useServerManagedShards();
}

export function useUnlockSlot() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (newSlotCount: number): Promise<RuneWallet> => {
      if (!user) throw new Error("Not authenticated");
      // Bootstrap derives slots from canonical class levels. Never forward
      // the requested count from a cached character sheet.
      const { wallet } = await bootstrapRuneDelve();
      if (wallet.user_id !== user.id)
        throw new Error("Relic slots were not confirmed. Please retry.");
      if (wallet.slots_unlocked < newSlotCount)
        throw new Error("The third relic slot unlocks at class level 25.");
      return wallet;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rune-delve-wallet", user?.id] });
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

export function useFailureRow(
  levelNumber: number | null,
  heroClass: HeroClass | undefined,
) {
  const { user } = useAuth();
  return useQuery({
    retry: false,
    queryKey: ["rune-delve-failure", user?.id, heroClass, levelNumber],
    enabled: !!user && !!heroClass && levelNumber != null,
    staleTime: 0,
    queryFn: async (): Promise<FailureRow | null> => {
      if (!user || !heroClass || levelNumber == null) return null;
      const { data } = await runeRequest(
        supabase
          .from("rune_delve_failure_rewards")
          .select("level_number, hero_class, failure_count, last_awarded_at")
          .eq("user_id", user.id)
          .eq("level_number", levelNumber)
          .eq("hero_class", heroClass)
          .maybeSingle(),
      );
      return data as FailureRow | null;
    },
  });
}

type FailureParams = { levelNumber: number; heroClass: HeroClass };

/** Failure counters are written only alongside an acknowledged run. */
export function useBumpFailure() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (_params: FailureParams): Promise<number> => {
      if (!user) throw new Error("Not authenticated");
      throw new Error(
        "Failure rewards are managed by the server. Please refresh.",
      );
    },
  });
}

export function useResetFailure() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (_params: FailureParams): Promise<void> => {
      if (!user) throw new Error("Not authenticated");
      throw new Error(
        "Failure rewards are managed by the server. Please refresh.",
      );
    },
  });
}
