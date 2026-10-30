import { useRuneActionIds } from "@/lib/runedelve/useRuneActionIds";
import { useClub } from "@/contexts/ClubContext";
import { runeClubMemberIds } from "@/lib/runedelve/clubDirectory";
import { runeRequest, runeRpc } from "@/lib/runedelve/request";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  todayUtcDateString,
  ENDLESS_TIME_LIMIT_SEC,
  endlessRewardFor,
} from "@/lib/runedelve/dailyChallenge";
import type { HeroClass } from "@/lib/runedelve/classConfig";

export interface DailyRunRow {
  id: string;
  user_id: string;
  daily_date: string;
  score: number;
  stars: number;
  /** Legacy field — always false in endless mode. Kept for back-compat. */
  dungeon_cleared: boolean;
  /** Legacy field — always [] in endless mode. */
  modifiers: unknown[];
  hero_class: HeroClass;
  kills_count: number;
  completed_at: string;
  reward_shards_awarded?: number | null;
  reward_xp_awarded?: number | null;
}

export interface DailyStreakRow {
  user_id: string;
  current_streak: number;
  best_streak: number;
  last_completed_date: string | null;
  lifetime_clears: number;
}

/** Today's daily metadata — date + format. Pure, no network. */
export function useTodayDaily() {
  return {
    dateStr: todayUtcDateString(),
    timeLimitSec: ENDLESS_TIME_LIMIT_SEC,
  };
}

/** The current player's daily run row for today (null if not played). */
export function useMyDailyRun() {
  const { user } = useAuth();
  const dateStr = todayUtcDateString();
  return useQuery({
    retry: false,
    queryKey: ["rd-daily-run", user?.id, dateStr],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<DailyRunRow | null> => {
      if (!user) return null;
      const { data, error } = await runeRequest(
        supabase
          .from("rune_delve_daily_runs")
          .select("*")
          .eq("user_id", user.id)
          .eq("daily_date", dateStr)
          .maybeSingle(),
      );
      if (error) throw error;
      return (data as unknown as DailyRunRow) ?? null;
    },
  });
}

/** Player's streak record (null until they've played a daily). */
export function useMyDailyStreak() {
  const { user } = useAuth();
  return useQuery({
    retry: false,
    queryKey: ["rd-daily-streak", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<DailyStreakRow | null> => {
      if (!user) return null;
      const { data, error } = await runeRequest(
        supabase
          .from("rune_delve_daily_streaks")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
      );
      if (error) throw error;
      return (data as unknown as DailyStreakRow) ?? null;
    },
  });
}

/** Today's leaderboard — ranked by kill count, score as tiebreaker. */
export function useDailyLeaderboard(limit = 10) {
  const dateStr = todayUtcDateString();
  const { user } = useAuth();
  const { club } = useClub();
  return useQuery({
    retry: false,
    queryKey: ["rd-daily-leaderboard", dateStr, limit, user?.id, club?.id],
    enabled: !!user && !!club,
    staleTime: 30_000,
    queryFn: async () => {
      if (!club) return [];
      const memberIds = await runeClubMemberIds(club.id);
      if (!memberIds.length) return [];
      const { data, error } = await runeRequest(
        supabase
          .from("rune_delve_daily_runs")
          .select(
            "id, user_id, score, stars, dungeon_cleared, hero_class, kills_count, completed_at",
          )
          .eq("daily_date", dateStr)
          .in("user_id", memberIds)
          .order("kills_count", { ascending: false })
          .order("score", { ascending: false })
          .limit(limit),
      );
      if (error) throw error;
      const ids = (data ?? []).map((d) => d.user_id);
      let profiles: Record<
        string,
        { display_name: string | null; avatar_url: string | null }
      > = {};
      if (ids.length) {
        const { data: profs } = await runeRequest(
          supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .in("id", ids),
        );
        profiles = Object.fromEntries(
          (profs ?? []).map((p) => [
            p.id,
            { display_name: p.display_name, avatar_url: p.avatar_url },
          ]),
        );
      }
      return (data ?? []).map((row, i) => ({
        ...row,
        kills_count: row.kills_count ?? 0,
        rank: i + 1,
        profile: profiles[row.user_id] ?? {
          display_name: null,
          avatar_url: null,
        },
      }));
    },
  });
}

/**
 * Submit today's endless run. One row per (user, daily_date) — we keep the
 * best attempt (highest kill count, then highest score). Streak bumps when
 * the player kills ≥5 enemies (the new "meaningful attempt" threshold).
 */
export interface SavedDailyRun {
  stars: number;
  reward: ReturnType<typeof endlessRewardFor>;
  dateStr: string;
  kills: number;
  rewarded: boolean;
  dailyRewardTotal?: { shards: number; xp: number };
  firstAttempt?: boolean;
  previousBestKills?: number;
  bestKills?: number;
  improvedReward?: boolean;
  previousClassLevel: number;
  classLevel: number;
  slotsUnlocked: number;
}

export function useSubmitDailyRun() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const actions = useRuneActionIds();
  return useMutation({
    retry: false,
    mutationFn: async (params: {
      kills: number;
      score: number;
      heroClass: HeroClass;
      requestId?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const key = `${user.id}:daily:${todayUtcDateString()}:${JSON.stringify(params)}`;
      const { data } = await runeRpc<SavedDailyRun>(
        "rune_delve_save_daily",
        {
          p_kills: params.kills,
          p_score: params.score,
          p_class: params.heroClass,
          p_request_id: params.requestId ?? actions.get(key),
        },
        "Save daily arena",
      );
      if (!data?.reward || !data.dateStr)
        throw new Error("Daily result was not confirmed. Please retry.");
      actions.complete(key);
      return data;
    },
    onSuccess: () => {
      for (const prefix of [
        "rd-daily-run",
        "rd-active-quests",
        "rd-daily-streak",
        "rd-daily-leaderboard",
        "rune-delve-wallet",
        "rune-delve-hero",
        "rune-delve-class-progress",
        "home-signals",
        "dh-score",
        "dh-feats",
      ]) {
        qc.invalidateQueries({ queryKey: [prefix] });
      }
    },
  });
}
