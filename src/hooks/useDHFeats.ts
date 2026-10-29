import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import { supabase } from "@/integrations/supabase/client";
import { QUERY_TIMEOUT_MS, withTimeout } from "@/lib/asyncGuards";
import type { DHScoreSummary, FeatBoard } from "@/lib/feats/types";

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.rpc(name as never, args as never),
    QUERY_TIMEOUT_MS,
    "DH Score",
  );
  if (error)
    throw new Error(error.message || "DH Score could not sync. Try again.");
  return data as unknown as T;
}
export function useDHScore() {
  const { user } = useAuth(),
    { club } = useClub();
  return useQuery({
    queryKey: ["dh-score", user?.id, club?.id],
    enabled: !!user && !!club,
    queryFn: () =>
      rpc<DHScoreSummary>("dh_feats_summary", { p_club_id: club!.id }),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}
export function useDHFeats() {
  const { user } = useAuth(),
    { club } = useClub(),
    cache = useQueryClient();
  const key = ["dh-feats", user?.id, club?.id];
  const query = useQuery({
    queryKey: key,
    enabled: !!user && !!club,
    queryFn: async () => {
      const board = await rpc<FeatBoard>("dh_feats_board", {
        p_club_id: club!.id,
      });
      cache.setQueryData(["dh-score", user?.id, club?.id], {
        score: board.score,
        unlocked: board.unlocked,
      });
      return board;
    },
    staleTime: 15_000,
    refetchInterval: 45_000,
    retry: 1,
  });
  const pins = useMutation({
    mutationKey: ["dh-feat-pins", user?.id],
    mutationFn: (keys: string[]) =>
      rpc<string[]>("dh_feats_pin", { p_keys: keys }),
    onMutate: async (keys: string[]) => {
      await cache.cancelQueries({ queryKey: key });
      const before = cache.getQueryData<FeatBoard>(key);
      cache.setQueryData<FeatBoard>(key, (old) =>
        old ? { ...old, pinned: keys } : old,
      );
      return before;
    },
    onError: (_error, _keys, before) => {
      if (before)
        cache.setQueryData<FeatBoard>(key, (old) =>
          old ? { ...old, pinned: before.pinned } : old,
        );
    },
    onSuccess: (keys) =>
      cache.setQueryData<FeatBoard>(key, (old) =>
        old ? { ...old, pinned: keys } : old,
      ),
  });
  const seen = useMutation({
    mutationFn: (through: string) =>
      rpc<void>("dh_feats_seen", { p_through: through }),
    onSuccess: (_result, through) =>
      cache.setQueryData<FeatBoard>(key, (old) =>
        old
          ? {
              ...old,
              seen_at:
                Date.parse(through) > Date.parse(old.seen_at)
                  ? through
                  : old.seen_at,
            }
          : old,
      ),
  });
  return { ...query, pins, seen };
}
