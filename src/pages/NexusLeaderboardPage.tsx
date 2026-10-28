import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { useClub } from "@/contexts/ClubContext";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout, QUERY_TIMEOUT_MS } from "@/lib/asyncGuards";
import { CoreBack, CoreHeading } from "@/components/nexus/core/CoreUI";
import type { CoreMode } from "@/lib/nexus/core/types";

interface RecordRow {
  user_id: string;
  score: number;
  waves: number;
  scenario_id: string;
  display_name: string | null;
}
export default function NexusLeaderboardPage() {
  const { club } = useClub();
  const [mode, setMode] = useState<CoreMode>("endless");
  const query = useQuery({
    queryKey: ["nexus-core-records", club?.id, mode],
    enabled: !!club,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await withTimeout(
        supabase.rpc(
          "nexus_core_records" as never,
          { p_club_id: club!.id, p_mode: mode } as never,
        ),
        QUERY_TIMEOUT_MS,
        "core records",
      );
      if (error) throw new Error(error.message);
      return (data || []) as unknown as RecordRow[];
    },
  });
  return (
    <>
      <CoreBack />
      <CoreHeading
        eyebrow={`${club?.name || "Club"} / records`}
        title="Hold a little longer."
      >
        Best run per club member. Endless ranks by waves cleared, then score.
        Campaign and challenges rank by score.
      </CoreHeading>
      <div className="nc-tabs" role="tablist" aria-label="Record mode">
        {(["endless", "campaign", "challenge"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
          >
            {m === "challenge" ? "Challenges" : m[0].toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
      {query.isError ? (
        <div className="nc-empty">
          <h2>Records unavailable</h2>
          <p>Reconnect to see your club’s latest runs.</p>
          <button className="nc-button" onClick={() => query.refetch()}>
            Try again
          </button>
        </div>
      ) : query.isPending ? (
        <div className="nc-empty" role="status">
          <p>Loading club records…</p>
          <button className="nc-back" onClick={() => query.refetch()}>
            Retry connection
          </button>
        </div>
      ) : !query.data?.length ? (
        <div className="nc-empty">
          <Trophy size={32} />
          <h2>The first record is yours to set.</h2>
          <p>
            Finish a run to appear here. Records from the original path game
            stay separate.
          </p>
        </div>
      ) : (
        <div className="nc-panel">
          {query.data.map((r, i) => (
            <div className="nc-record-row" key={r.user_id}>
              <span className="nc-record-rank">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="nc-record-name">
                {r.display_name || "Defender"}
                <small>
                  {mode === "endless"
                    ? "Endless"
                    : mode === "campaign"
                      ? `Sector ${r.scenario_id}`
                      : r.scenario_id}{" "}
                  · {r.waves} waves cleared
                </small>
              </div>
              <div className="nc-record-score">
                {mode === "endless" ? r.waves : r.score.toLocaleString()}
                <small>{mode === "endless" ? "WAVES" : "POINTS"}</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
