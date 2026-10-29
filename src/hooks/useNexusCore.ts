import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import { supabase } from "@/integrations/supabase/client";
import { QUERY_TIMEOUT_MS, withTimeout } from "@/lib/asyncGuards";
import { createRun, stats } from "@/lib/nexus/core/engine";
import { getScenario } from "@/lib/nexus/core/catalog";
import type {
  CoreProfile,
  CoreLoadout,
  CoreRun,
  CoreScenario,
  Research,
  ResearchId,
  UnlockId,
} from "@/lib/nexus/core/types";
import { STARTER_LOADOUT } from "@/lib/nexus/core/progression";

interface ProfileRow {
  credits: number;
  research: Research;
  campaign: Record<string, number>;
  challenges: Record<string, number>;
  best_wave: number;
  total_runs: number;
  endless_best: number;
  total_waves: number;
  unlocks: UnlockId[];
  loadout: CoreLoadout;
}
function profileFromRow(row: ProfileRow): CoreProfile {
  return {
    credits: row.credits,
    research: row.research || {},
    campaign: row.campaign || {},
    challenges: row.challenges || {},
    bestWave: row.endless_best || 0,
    totalRuns: row.total_runs,
    totalWaves: row.total_waves || 0,
    unlocks: row.unlocks || [],
    loadout: row.loadout || STARTER_LOADOUT,
  };
}

async function rpc<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.rpc(name as never, args as never),
    QUERY_TIMEOUT_MS,
    name,
  );
  if (error) throw new Error(error.message);
  return data as T;
}

export function useNexusCore() {
  const { user } = useAuth();
  const { club } = useClub();
  const client = useQueryClient();
  const queryKey = ["nexus-core-profile", user?.id];
  const query = useQuery({
    queryKey,
    queryFn: async () =>
      profileFromRow(await rpc<ProfileRow>("nexus_core_profile")),
    enabled: !!user,
    staleTime: 30_000,
    retry: 1,
  });
  async function research(track: ResearchId) {
    const row = await rpc<ProfileRow>("nexus_core_research", {
      p_track: track,
    });
    client.setQueryData(queryKey, profileFromRow(row));
    await client.invalidateQueries({
      queryKey: ["nexus-core-ledger", user?.id],
    });
  }
  async function unlock(item: UnlockId) {
    const row = await rpc<ProfileRow>("nexus_core_unlock", { p_item: item });
    client.setQueryData(queryKey, profileFromRow(row));
    void client.invalidateQueries({
      queryKey: ["nexus-core-ledger", user?.id],
    });
  }
  async function saveLoadout(loadout: CoreLoadout) {
    const row = await rpc<ProfileRow>("nexus_core_loadout", {
      p_loadout: loadout,
    });
    client.setQueryData(queryKey, profileFromRow(row));
  }
  async function begin(
    scenario: CoreScenario,
    id: string,
    loadout: CoreLoadout = query.data?.loadout || STARTER_LOADOUT,
  ) {
    if (!club) throw new Error("Choose a club before deploying");
    if (scenario.mode !== "endless") throw new Error("Deploy in Endless mode");
    const ticket = await rpc<{
      id: string;
      seed: number;
      research: Research;
      loadout: CoreLoadout;
    }>("nexus_core_begin_endless", {
      p_id: id,
      p_club_id: club.id,
      p_loadout: loadout,
    });
    return {
      ...createRun(
        scenario,
        ticket.research,
        ticket.id,
        ticket.seed,
        ticket.loadout,
      ),
      registered: true,
    };
  }
  async function registerLegacy(run: CoreRun) {
    if (!club) throw new Error("Choose a club to restore your run");
    await rpc("nexus_core_begin", {
      p_id: run.id,
      p_scenario: run.scenarioId,
      p_club_id: club.id,
      p_legacy: true,
    });
    return { ...run, registered: true, legacy: true };
  }
  async function finish(run: CoreRun) {
    if (!club) throw new Error("Choose a club to save your run");
    const scenario = getScenario(run.scenarioId)!;
    const payload = {
      p_club_id: club.id,
      p_run: {
        id: run.id,
        scenarioId: scenario.id,
        phase: run.phase,
        cleared: run.cleared,
        hpRatio: Math.min(1, run.hp / stats(run, scenario).maxHp),
        score: run.score,
        kills: run.kills,
        time: Math.floor(run.time),
        upgrades: run.upgrades,
        energy: run.energy,
        earned: run.metrics?.energyEarned,
        spent: run.metrics?.energySpent,
      },
    };
    type Receipt = {
      profile: ProfileRow;
      reward: number;
      stars: number;
      waves: number;
      bonus: number;
    };
    let result: Receipt;
    try {
      result = await rpc<Receipt>(
        (run.balanceVersion || 0) >= 4
          ? "nexus_core_finish_endless"
          : "nexus_core_finish",
        payload,
      );
    } catch (e) {
      if (
        !run.balanceVersion &&
        !run.registered &&
        e instanceof Error &&
        e.message.includes("Deploy your nexus before")
      ) {
        await registerLegacy(run);
        result = await rpc<Receipt>("nexus_core_finish", payload);
      } else throw e;
    }
    client.setQueryData(queryKey, profileFromRow(result.profile));
    void client.invalidateQueries({
      queryKey: ["nexus-core-ledger", user?.id],
    });
    void client.invalidateQueries({ queryKey: ["nexus-core-records"] });
    return {
      reward: result.reward,
      stars: result.stars,
      waves: result.waves,
      bonus: result.bonus,
    };
  }
  return {
    ...query,
    profile: query.data,
    userId: user?.id,
    clubId: club?.id,
    research,
    unlock,
    saveLoadout,
    begin,
    registerLegacy,
    finish,
  };
}

export interface CreditEntry {
  id: number;
  kind: "run" | "research" | "unlock";
  delta: number;
  balance: number;
  details: {
    scenario?: string;
    track?: string;
    level?: number;
    first_clear?: number;
    milestones?: number;
    item?: UnlockId;
  };
  created_at: string;
}
export function useNexusLedger() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["nexus-core-ledger", user?.id],
    enabled: !!user,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await withTimeout(
        supabase
          .from("nexus_core_ledger" as never)
          .select("id,kind,delta,balance,details,created_at")
          .order("id", { ascending: false })
          .limit(12),
        QUERY_TIMEOUT_MS,
        "credit history",
      );
      if (error) throw new Error(error.message);
      return (data || []) as unknown as CreditEntry[];
    },
  });
}
