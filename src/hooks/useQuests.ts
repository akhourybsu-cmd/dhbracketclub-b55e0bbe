import { runeRequest, runeRpc } from "@/lib/runedelve/request";
import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRuneDelveHero } from "@/hooks/useRuneDelveHero";
import {
  dailyPeriodKey,
  weeklyPeriodKey,
  rollQuestSet,
  scopeLabel,
  type QuestDefinition,
  type ActiveQuest,
  type QuestProgressEvent,
  type QuestScope,
} from "@/lib/runedelve/quests";
import { toast } from "sonner";

const DEFS_QK = ["rd-quest-defs"];
const ACTIVE_QK = (uid: string | undefined) => ["rd-active-quests", uid];

/** Catalog of all quest templates — cached aggressively. */
export function useQuestDefinitions() {
  return useQuery({
    retry: false,
    queryKey: DEFS_QK,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<QuestDefinition[]> => {
      const { data, error } = await runeRequest(
        supabase.from("rune_delve_quest_definitions" as never).select("*"),
      );
      if (error) throw error;
      return (data ?? []) as unknown as QuestDefinition[];
    },
  });
}

/**
 * Player's active quests for the current daily + weekly periods. Auto-rolls
 * the set on first read and ensures rows exist for every quest in the set.
 */
export function useActiveQuests() {
  const { user } = useAuth();
  const { data: hero } = useRuneDelveHero();
  const { data: defs } = useQuestDefinitions();
  const qc = useQueryClient();

  const dailyKey = dailyPeriodKey();
  const weeklyKey = weeklyPeriodKey();

  return useQuery({
    retry: false,
    queryKey: [...ACTIVE_QK(user?.id), dailyKey, weeklyKey, hero?.class],
    enabled: !!user && !!hero && !!defs,
    staleTime: 30_000,
    queryFn: async (): Promise<ActiveQuest[]> => {
      if (!user || !hero || !defs) return [];

      // Fetch existing rows for both current periods.
      const { data: existing, error: readErr } = await runeRequest(
        supabase
          .from("rune_delve_active_quests" as never)
          .select("*")
          .eq("user_id", user.id)
          .in("period_key", [dailyKey, weeklyKey]),
      );
      if (readErr) throw readErr;

      const existingRows = (existing ?? []) as unknown as ActiveQuest[];

      // Pull RECENT history for anti-repeat: last 5 daily periods + last 3
      // weekly periods. Any quest the player saw in those windows is
      // excluded from the new roll, guaranteeing fresh objectives every
      // period (until the catalog cycles back).
      const { data: recent } = await runeRequest(
        supabase
          .from("rune_delve_active_quests" as never)
          .select("quest_id, scope, period_key")
          .eq("user_id", user.id)
          .neq("period_key", dailyKey)
          .neq("period_key", weeklyKey)
          .order("period_key", { ascending: false })
          .limit(50),
      );

      const recentRows = (recent ?? []) as unknown as Array<{
        quest_id: string;
        scope: QuestScope;
        period_key: string;
      }>;
      const recentDailyPeriods = new Set<string>();
      const recentWeeklyPeriods = new Set<string>();
      const recentDailyIds = new Set<string>();
      const recentWeeklyIds = new Set<string>();
      for (const r of recentRows) {
        if (
          r.scope === "daily" &&
          (recentDailyPeriods.has(r.period_key) || recentDailyPeriods.size < 5)
        ) {
          recentDailyPeriods.add(r.period_key);
          recentDailyIds.add(r.quest_id);
        } else if (
          r.scope === "weekly" &&
          (recentWeeklyPeriods.has(r.period_key) ||
            recentWeeklyPeriods.size < 3)
        ) {
          recentWeeklyPeriods.add(r.period_key);
          recentWeeklyIds.add(r.quest_id);
        }
      }

      // Roll the expected set for each scope and ensure rows exist.
      const desiredDaily = rollQuestSet({
        defs,
        scope: "daily",
        periodKey: dailyKey,
        userId: user.id,
        heroClass: hero?.class ?? null,
        recentlyUsedIds: recentDailyIds,
      });
      const desiredWeekly = rollQuestSet({
        defs,
        scope: "weekly",
        periodKey: weeklyKey,
        userId: user.id,
        heroClass: hero?.class ?? null,
        recentlyUsedIds: recentWeeklyIds,
      });

      const missing: Array<Omit<ActiveQuest, "id" | "definition">> = [];
      const ensure = (def: QuestDefinition, periodKey: string) => {
        const has = existingRows.some(
          (r) => r.quest_id === def.id && r.period_key === periodKey,
        );
        if (!has) {
          missing.push({
            user_id: user.id,
            quest_id: def.id,
            scope: def.scope,
            period_key: periodKey,
            progress: 0,
            target_value: def.target_value,
            status: "active",
            claimed_at: null,
          });
        }
      };
      desiredDaily.forEach((d) => ensure(d, dailyKey));
      desiredWeekly.forEach((d) => ensure(d, weeklyKey));

      if (missing.length > 0) {
        const { data: inserted, error: insErr } = await runeRequest(
          supabase
            .from("rune_delve_active_quests" as never)
            .upsert(missing as never, {
              onConflict: "user_id,quest_id,period_key",
              ignoreDuplicates: true,
            })
            .select("*"),
        );
        if (insErr) throw insErr;
        existingRows.push(...((inserted ?? []) as unknown as ActiveQuest[]));
        if ((inserted?.length ?? 0) < missing.length) {
          const { data: canonical } = await runeRequest(
            supabase
              .from("rune_delve_active_quests" as never)
              .select("*")
              .eq("user_id", user.id)
              .in("period_key", [dailyKey, weeklyKey]),
          );
          existingRows.splice(
            0,
            existingRows.length,
            ...((canonical ?? []) as unknown as ActiveQuest[]),
          );
        }
      }

      // Attach definitions for the UI layer.
      const defMap = new Map(defs.map((d) => [d.id, d]));
      const all = existingRows
        .filter((r) => {
          // Hide quests not in the current rolled set (e.g., personal quest
          // changed because user switched class) — keep DB rows but don't show.
          const desired = r.scope === "daily" ? desiredDaily : desiredWeekly;
          return desired.some((d) => d.id === r.quest_id);
        })
        .map((r) => ({ ...r, definition: defMap.get(r.quest_id) }));
      // Sort: daily first, then by personal flag, then by id for stability.
      all.sort((a, b) => {
        if (a.scope !== b.scope) return a.scope === "daily" ? -1 : 1;
        const ap = a.definition?.is_personal ? 1 : 0;
        const bp = b.definition?.is_personal ? 1 : 0;
        if (ap !== bp) return ap - bp;
        return a.quest_id.localeCompare(b.quest_id);
      });
      return all;
    },
  });
}

/**
 * Fan a single progress event out to all matching active quests for the
 * player. Updates progress in DB; flips status to `completed` when target hit.
 * Best-effort — never throws into the gameplay loop.
 */
export function useReportQuestProgress() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: activeQuests } = useActiveQuests();

  return useCallback(
    async (event: QuestProgressEvent) => {
      if (!user || !activeQuests || activeQuests.length === 0) return;
      try {
        const { data: completed } = await runeRpc<string[]>(
          "rune_delve_report_quest",
          {
            p_event: {
              ...event,
              questIds: activeQuests.map((quest) => quest.id),
            },
          },
          "Update quest progress",
        );
        qc.invalidateQueries({ queryKey: ["rd-active-quests", user.id] });
        for (const title of completed ?? []) {
          toast.success(`Quest complete · ${title}`, {
            description: "Claim your reward in Quests.",
            duration: 4000,
          });
        }
      } catch (error) {
        console.warn("[quest-progress] update failed", error);
      }
    },
    [user, activeQuests, qc],
  );
}

/** Claim a completed quest — pays out shards (+ XP) and marks it claimed. */
export function useClaimQuest() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (quest: ActiveQuest) => {
      if (!user) throw new Error("Not authenticated");
      if (quest.status !== "completed") throw new Error("Quest not completed");
      const def = quest.definition;
      if (!def) throw new Error("Quest definition missing");

      // Status change and both currencies commit together. A lost response
      // can be retried safely: claimed quests return zero additional reward.
      const { data } = await runeRpc<{
        shards: number;
        xp: number;
        title: string;
        scope: QuestScope;
        alreadyClaimed?: boolean;
      }>(
        "rune_delve_claim_quest",
        {
          p_quest_id: quest.id,
        },
        "Claim quest reward",
      );
      if (!data) throw new Error("Reward was not confirmed. Please retry.");
      return data as {
        shards: number;
        xp: number;
        title: string;
        scope: QuestScope;
        alreadyClaimed?: boolean;
      };
    },
    onSuccess: (result) => {
      const xpSuffix = result.xp > 0 ? ` · +${result.xp} XP` : "";
      toast.success(
        `+${result.shards} 💎${xpSuffix} — ${scopeLabel(result.scope)} Reward`,
        {
          description: result.title,
          duration: 4000,
        },
      );
      qc.invalidateQueries({ queryKey: ["rd-active-quests"] });
      qc.invalidateQueries({ queryKey: ["rune-delve-wallet"] });
      qc.invalidateQueries({ queryKey: ["rune-delve-class-progress"] });
      qc.invalidateQueries({ queryKey: ["rune-delve-hero"] });
    },
    onError: (e: Error) => {
      toast.error(`Couldn't claim quest: ${e.message}`);
    },
  });
}

/** Lightweight summary for the home-page badge. */
export function useQuestSummary() {
  const { data: quests } = useActiveQuests();
  return useMemo(() => {
    const list = quests ?? [];
    return {
      total: list.length,
      claimable: list.filter((q) => q.status === "completed").length,
      claimed: list.filter((q) => q.status === "claimed").length,
    };
  }, [quests]);
}
