import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import { supabase } from "@/integrations/supabase/client";
import { QUERY_TIMEOUT_MS, withTimeout } from "@/lib/asyncGuards";
import { stats } from "@/lib/nexus/core/engine";
import { getScenario } from "@/lib/nexus/core/catalog";
import type {
  CoreProfile,
  CoreRun,
  Research,
  ResearchId,
} from "@/lib/nexus/core/types";

interface ProfileRow {
  credits: number;
  research: Research;
  campaign: Record<string, number>;
  challenges: Record<string, number>;
  best_wave: number;
  total_runs: number;
}
function profileFromRow(row: ProfileRow): CoreProfile {
  return {
    credits: row.credits,
    research: row.research || {},
    campaign: row.campaign || {},
    challenges: row.challenges || {},
    bestWave: row.best_wave,
    totalRuns: row.total_runs,
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
  }
  async function finish(run: CoreRun) {
    if (!club) throw new Error("Choose a club to save your run");
    const scenario = getScenario(run.scenarioId)!;
    const result = await rpc<{
      profile: ProfileRow;
      reward: number;
      stars: number;
    }>("nexus_core_finish", {
      p_club_id: club.id,
      p_run: {
        id: run.id,
        scenarioId: scenario.id,
        phase: run.phase,
        cleared: run.cleared,
        hpRatio: run.hp / stats(run, scenario).maxHp,
        score: run.score,
        kills: run.kills,
        time: Math.floor(run.time),
      },
    });
    client.setQueryData(queryKey, profileFromRow(result.profile));
    return { reward: result.reward, stars: result.stars };
  }
  return {
    ...query,
    profile: query.data,
    userId: user?.id,
    clubId: club?.id,
    research,
    finish,
  };
}
