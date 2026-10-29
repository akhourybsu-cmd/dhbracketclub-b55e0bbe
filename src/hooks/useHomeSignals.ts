import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import { supabase } from "@/integrations/supabase/client";
import { QUERY_TIMEOUT_MS, withTimeout } from "@/lib/asyncGuards";
import { readCoreRun } from "@/lib/nexus/core/persistence";
import {
  nexusHomeCheckpoint,
  type HomeDrop,
  type HomePortfolio,
  type HomeProgress,
  type HomeSignals,
} from "@/lib/home/signals";

async function load<T>(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  label: string,
): Promise<T> {
  const { data, error } = await withTimeout(query, QUERY_TIMEOUT_MS, label);
  if (error) throw new Error(error.message);
  return data as T;
}
export function useHomeSignals(installed: Set<string>) {
  const { user } = useAuth(),
    { club } = useClub(),
    cache = useQueryClient(),
    uid = user?.id,
    cid = club?.id;
  const root = ["home-signals", uid, cid],
    ready = !!uid && !!cid;
  const [checkpoint, setCheckpoint] = useState<HomeSignals["checkpoint"]>(null);
  const nexusEnabled = installed.has("nexus-defense");
  useEffect(() => {
    const read = () =>
      setCheckpoint(
        nexusEnabled ? nexusHomeCheckpoint(readCoreRun(uid, cid)) : null,
      );
    read();
    window.addEventListener("focus", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("focus", read);
      window.removeEventListener("storage", read);
    };
  }, [uid, cid, nexusEnabled]);
  const progress = useQuery({
    queryKey: [...root, "progress"],
    enabled: ready,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
    queryFn: async () => {
      const data = await load<HomeProgress>(
        supabase.rpc("dh_home_progress" as never, { p_club_id: cid } as never),
        "Home progress",
      );
      cache.setQueryData(["dh-score", uid, cid], {
        score: data.score,
        unlocked: data.unlocked,
      });
      return data;
    },
  });
  const drop = useQuery({
    queryKey: [...root, "drop"],
    enabled: ready && installed.has("daily-find"),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
    queryFn: () =>
      load<HomeDrop[]>(
        supabase
          .from("daily_finds" as never)
          .select("id,title,kind,created_at,profiles:user_id(display_name)")
          .eq("club_id", cid)
          .order("created_at", { ascending: false })
          .limit(3),
        "Home Drop",
      ),
  });
  const portfolio = useQuery({
    queryKey: [...root, "portfolio"],
    enabled: ready && installed.has("portfolio-wars"),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
    queryFn: async () => {
      const row = await load<{
        id: string;
        total_value: number;
        valued_at: string | null;
        season: HomePortfolio["season"];
      } | null>(
        supabase
          .from("pw_portfolios" as never)
          .select(
            "id,total_value,valued_at,season:pw_seasons!inner(starting_cash,status)",
          )
          .eq("club_id", cid)
          .eq("user_id", uid)
          .eq("season.status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        "Home portfolio",
      );
      if (!row) return null;
      const history = await load<HomePortfolio["history"]>(
        supabase
          .from("pw_daily_values" as never)
          .select("value,trading_date")
          .eq("club_id", cid)
          .eq("portfolio_id", row.id)
          .order("trading_date", { ascending: false })
          .limit(7),
        "Home portfolio history",
      ).catch(() => []);
      return { ...row, history: (history || []).slice().reverse() };
    },
  });
  const nexus = useQuery({
    queryKey: [...root, "nexus"],
    enabled: ready && nexusEnabled,
    staleTime: 30_000,
    retry: 1,
    queryFn: () =>
      load<{ endless_best: number } | null>(
        supabase
          .from("nexus_core_profiles" as never)
          .select("endless_best")
          .eq("user_id", uid)
          .maybeSingle(),
        "Home Nexus",
      ),
  });
  const forge = useQuery({
    queryKey: [...root, "forge"],
    enabled: ready && installed.has("workout-competition"),
    staleTime: 30_000,
    retry: 1,
    queryFn: () =>
      load<{ id: string; title: string | null } | null>(
        supabase
          .from("workout_log_sessions" as never)
          .select("id,title")
          .eq("club_id", cid)
          .eq("user_id", uid)
          .eq("status", "in_progress")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        "Home FORGE",
      ),
  });
  const signal = <T>(q: { data: T; isLoading: boolean; isError: boolean }) => ({
    data: q.data,
    loading: q.isLoading,
    error: q.isError,
  });
  return {
    data: {
      progress: signal(progress),
      drop: signal(drop),
      portfolio: signal(portfolio),
      nexus: signal(nexus),
      forge: signal(forge),
      checkpoint,
    } satisfies HomeSignals,
    refresh: () =>
      Promise.allSettled([
        progress.refetch(),
        ...(installed.has("daily-find") ? [drop.refetch()] : []),
        ...(installed.has("portfolio-wars") ? [portfolio.refetch()] : []),
        ...(nexusEnabled ? [nexus.refetch()] : []),
        ...(installed.has("workout-competition") ? [forge.refetch()] : []),
      ]),
    refreshing:
      progress.isFetching ||
      drop.isFetching ||
      portfolio.isFetching ||
      nexus.isFetching ||
      forge.isFetching,
  };
}
