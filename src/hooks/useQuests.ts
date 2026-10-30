import { runeRequest, runeRpc } from "@/lib/runedelve/request";
import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRuneDelveHero } from "@/hooks/useRuneDelveHero";
import {
  dailyPeriodKey,
  weeklyPeriodKey,
  type QuestDefinition,
  type ActiveQuest,
  type QuestProgressEvent,
  type QuestScope,
} from "@/lib/runedelve/quests";
import { toast } from "sonner";
import {
  progressionRewardItems,
  type RuneProgressionReceipt,
} from "@/lib/runedelve/rewardPresentation";
import { useRuneRewardReveal } from "@/hooks/useRuneRewardReveal";

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
 * SQL assigns the current UTC periods and persists canonical quest targets.
 */
export function useActiveQuests() {
  const { user } = useAuth();
  const { data: hero } = useRuneDelveHero();
  const { data: defs } = useQuestDefinitions();
  const dailyKey = dailyPeriodKey();
  const weeklyKey = weeklyPeriodKey();

  return useQuery({
    retry: false,
    queryKey: [...ACTIVE_QK(user?.id), dailyKey, weeklyKey, hero?.class],
    enabled: !!user && !!hero && !!defs,
    staleTime: 30_000,
    queryFn: async (): Promise<ActiveQuest[]> => {
      if (!user || !hero || !defs) return [];
      const { data } = await runeRpc<ActiveQuest[]>(
        "rune_delve_assign_quests",
        {},
        "Load current quests",
      );
      const defMap = new Map(
        defs.map((definition) => [definition.id, definition]),
      );
      if (
        !Array.isArray(data) ||
        data.some(
          (quest) =>
            !quest?.id ||
            quest.user_id !== user.id ||
            !defMap.has(quest.quest_id),
        )
      )
        throw new Error("Quests were not confirmed. Please retry.");
      // Server periods and assigned IDs are authoritative, including on a
      // device whose local date is wrong. Do not reroll or reset existing rows.
      const all = data.map((quest) => ({
        ...quest,
        definition: defMap.get(quest.quest_id),
      }));
      all.sort((a, b) => {
        if (a.scope !== b.scope) return a.scope === "daily" ? -1 : 1;
        const ap = a.definition?.is_personal ? 1 : 0;
        const bp = b.definition?.is_personal ? 1 : 0;
        return ap - bp || a.quest_id.localeCompare(b.quest_id);
      });
      return all;
    },
  });
}

/** Legacy imports cannot report arbitrary progress outside settlement. */
export function useReportQuestProgress() {
  return useCallback(async (_event: QuestProgressEvent): Promise<void> => {
    throw new Error("Quest progress is managed by the server. Please refresh.");
  }, []);
}

/** Claim a completed quest — pays out shards (+ XP) and marks it claimed. */
export function useClaimQuest() {
  const { data: hero } = useRuneDelveHero();
  const { reveal } = useRuneRewardReveal();
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
      const rewardClass = def.hero_class ?? hero?.class;
      const { data } = await runeRpc<
        RuneProgressionReceipt & {
          shards: number;
          xp: number;
          title: string;
          scope: QuestScope;
          alreadyClaimed?: boolean;
        }
      >(
        "rune_delve_claim_quest",
        {
          p_quest_id: quest.id,
        },
        "Claim quest reward",
      );
      if (!data) throw new Error("Reward was not confirmed. Please retry.");
      return { ...data, rewardClass };
    },
    onSuccess: (result, quest) => {
      if (!result.alreadyClaimed && (result.shards > 0 || result.xp > 0))
        reveal({
          id: `quest:${quest.id}`,
          title: "Quest complete",
          eyebrow: `${result.scope === "weekly" ? "Weekly" : "Daily"} reward claimed`,
          detail: result.title,
          items: [
            ...(result.rewardClass
              ? progressionRewardItems(result.rewardClass, result)
              : []),
            ...(result.shards > 0
              ? [
                  {
                    kind: "shards" as const,
                    label: "Rune Shards",
                    amount: result.shards,
                    detail: "Ready to spend in the forge.",
                  },
                ]
              : []),
            ...(result.xp > 0
              ? [
                  {
                    kind: "xp" as const,
                    label: "Class XP",
                    amount: result.xp,
                    detail: "Progress toward your next mastery.",
                  },
                ]
              : []),
          ],
        });
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
