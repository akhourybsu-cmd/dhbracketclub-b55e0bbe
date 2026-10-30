import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout, QUERY_TIMEOUT_MS } from "@/lib/asyncGuards";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import type {
  ExpeditionRun,
  ExpeditionTicket,
} from "@/lib/runedelve/expedition";

export interface ExpeditionProfile {
  highest_ascension: number;
  best_score: number;
  total_runs: number;
  total_clears: number;
  active_run: ExpeditionTicket | null;
}
export interface ExpeditionReceipt {
  reward: number;
  xpAwarded?: number;
  previousClassLevel?: number;
  classLevel?: number;
  classXp?: number;
  slotsUnlocked?: number;
  rooms: number;
  cleared: boolean;
  highest_ascension: number;
  best_score: number;
}
async function request<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.rpc(name as never, args as never),
    QUERY_TIMEOUT_MS,
    name,
  );
  if (error) throw new Error(error.message);
  if (!data)
    throw new Error(
      "The expedition did not return a save confirmation. Please retry.",
    );
  return data as T;
}
export function useRuneExpedition() {
  const { user } = useAuth();
  const { club } = useClub();
  const client = useQueryClient();
  const key = ["rune-expedition", user?.id, club?.id];
  const query = useQuery({
    queryKey: key,
    enabled: !!user && !!club,
    staleTime: 30000,
    retry: 1,
    queryFn: () =>
      request<ExpeditionProfile>("rune_delve_expedition_profile", {
        p_club_id: club!.id,
      }),
  });
  async function begin(id: string, heroClass: HeroClass, ascension: number) {
    if (!user || !club)
      throw new Error("Choose a club before entering the dungeon.");
    const ticket = await request<ExpeditionTicket>(
      "rune_delve_expedition_begin",
      {
        p_id: id,
        p_club_id: club.id,
        p_hero_class: heroClass,
        p_ascension: ascension,
      },
    );
    void client.invalidateQueries({ queryKey: key });
    return ticket;
  }
  async function finish(run: ExpeditionRun) {
    if (!user || !club) throw new Error("Sign in to save your expedition.");
    const receipt = await request<ExpeditionReceipt>(
      "rune_delve_expedition_finish",
      {
        p_id: run.id,
        p_rooms: run.roomsCleared,
        p_score: Math.floor(run.score),
        p_turns: run.totalTurns,
        p_cleared: run.phase === "won",
      },
    );
    for (const prefix of [
      "rune-expedition",
      "rune-delve-wallet",
      "rd-active-quests",
      "home-signals",
      "dh-score",
      "dh-feats",
      "rune-delve-class-progress",
      "rune-delve-hero",
    ])
      void client.invalidateQueries({ queryKey: [prefix] });
    return receipt;
  }
  return { ...query, userId: user?.id, clubId: club?.id, begin, finish };
}
