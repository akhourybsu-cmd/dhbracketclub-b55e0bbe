import { runeRequest } from "@/lib/runedelve/request";
// ─────────────────────────────────────────────────────────────────────────────
// useBestiary — per-player monster journal.
//
// • useBestiary()           → list of every entry the current player owns.
// • useRecordDefeats()      → mutation that upserts defeat counts after a run.
//
// Discovery rule: an enemy is "discovered" when it has been DEFEATED at least
// once. Encounters alone don't unlock anything — keeps the moment satisfying.
// The mutation accepts a list of `{ archetypeId, count }` so the play page can
// log every kill from a single run in one atomic upsert.
// ─────────────────────────────────────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface BestiaryEntry {
  id: string;
  user_id: string;
  archetype_id: string;
  defeat_count: number;
  first_defeated_at: string;
  last_defeated_at: string;
  highest_level_defeated: number;
  created_at: string;
  updated_at: string;
}

export interface DefeatRecord {
  archetypeId: string;
  count: number;
  /** Optional level the defeat happened on — used to track furthest-defeated. */
  levelNumber?: number;
}

export function useBestiary() {
  const { user } = useAuth();
  return useQuery({
    retry: false,
    queryKey: ["rune-delve-bestiary", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<BestiaryEntry[]> => {
      if (!user) return [];
      const { data, error } = await runeRequest(
        supabase.from("rune_delve_bestiary").select("*").eq("user_id", user.id),
      );
      if (error) throw error;
      return (data ?? []) as BestiaryEntry[];
    },
  });
}

/**
 * Records a batch of defeats from a single run. Returns the list of archetype
 * ids that were discovered for the FIRST time so the caller can surface a
 * "Bestiary Updated" toast / log line.
 */
export function useRecordDefeats() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      defeats: DefeatRecord[],
    ): Promise<{ newlyDiscovered: string[] }> => {
      if (!user || defeats.length === 0) return { newlyDiscovered: [] };

      // Aggregate counts client-side so the same archetype only hits the DB once.
      const totals = new Map<string, { count: number; level: number }>();
      for (const d of defeats) {
        if (!d.archetypeId) continue;
        const prev = totals.get(d.archetypeId);
        const lvl = d.levelNumber ?? 1;
        if (prev) {
          prev.count += d.count;
          if (lvl > prev.level) prev.level = lvl;
        } else {
          totals.set(d.archetypeId, { count: d.count, level: lvl });
        }
      }
      if (totals.size === 0) return { newlyDiscovered: [] };

      const ids = Array.from(totals.keys());
      const { data: existing } = await runeRequest(
        supabase
          .from("rune_delve_bestiary")
          .select("archetype_id, defeat_count, highest_level_defeated")
          .eq("user_id", user.id)
          .in("archetype_id", ids),
      );
      const existingMap = new Map<
        string,
        { defeat_count: number; highest_level_defeated: number }
      >(
        (existing ?? []).map((r) => [
          r.archetype_id as string,
          {
            defeat_count: r.defeat_count as number,
            highest_level_defeated: r.highest_level_defeated as number,
          },
        ]),
      );

      const newlyDiscovered: string[] = [];
      const now = new Date().toISOString();

      // Process sequentially — kept simple and ordering-stable for the UI.
      for (const [archetypeId, { count, level }] of totals.entries()) {
        const prior = existingMap.get(archetypeId);
        if (!prior) {
          const { error } = await runeRequest(
            supabase.from("rune_delve_bestiary").insert({
              user_id: user.id,
              archetype_id: archetypeId,
              defeat_count: count,
              first_defeated_at: now,
              last_defeated_at: now,
              highest_level_defeated: level,
            }),
          );
          if (!error) newlyDiscovered.push(archetypeId);
        } else {
          await runeRequest(
            supabase
              .from("rune_delve_bestiary")
              .update({
                defeat_count: prior.defeat_count + count,
                last_defeated_at: now,
                highest_level_defeated: Math.max(
                  prior.highest_level_defeated,
                  level,
                ),
              })
              .eq("user_id", user.id)
              .eq("archetype_id", archetypeId),
          );
        }
      }

      return { newlyDiscovered };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rune-delve-bestiary", user?.id] });
    },
  });
}
