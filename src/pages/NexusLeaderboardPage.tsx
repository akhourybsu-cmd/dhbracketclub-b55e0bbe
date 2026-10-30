import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { useClub } from "@/contexts/ClubContext";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout, QUERY_TIMEOUT_MS } from "@/lib/asyncGuards";
import { CoreHeading, CoreLink } from "@/components/nexus/core/CoreUI";
import { BALANCE_VERSION } from "@/lib/nexus/core/systems";
import { DIFFICULTIES } from "@/lib/nexus/core/difficulty";
import "@/components/nexus/core/threat.css";

interface RecordRow {
  user_id: string;
  score: number;
  waves: number;
  scenario_id: string;
  display_name: string | null;
}
export default function NexusLeaderboardPage() {
  const { club } = useClub();
  const mode = "endless";
  const [difficulty, setDifficulty] = useState(1);
  const list = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0),
    [pageSize, setPageSize] = useState(4);
  const query = useQuery({
    queryKey: [
      "nexus-core-records",
      club?.id,
      mode,
      BALANCE_VERSION,
      difficulty,
    ],
    enabled: !!club,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await withTimeout(
        supabase.rpc(
          "nexus_core_records" as never,
          {
            p_club_id: club!.id,
            p_mode: mode,
            p_difficulty: difficulty,
          } as never,
        ),
        QUERY_TIMEOUT_MS,
        "core records",
      );
      if (error) throw new Error(error.message);
      return (data || []) as unknown as RecordRow[];
    },
  });
  useEffect(() => {
    if (!list.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setPageSize(Math.max(1, Math.floor(entry.contentRect.height / 62))),
    );
    observer.observe(list.current);
    return () => observer.disconnect();
  }, [query.data?.length]);
  const lastPage = Math.max(
      0,
      Math.ceil((query.data?.length || 0) / pageSize) - 1,
    ),
    current = Math.min(page, lastPage);
  return (
    <section className="nc-deck-screen nc-records-screen">
      <CoreHeading
        eyebrow={`${club?.name || "Club"} / records`}
        title="Club records"
      >
        Best wave · Score breaks ties
      </CoreHeading>
      <div className="nc-threat-control">
        <label>
          <span>RECORD THREAT</span>
          <select
            aria-label="Record threat level"
            value={difficulty}
            onChange={(e) => {
              setDifficulty(Number(e.target.value));
              setPage(0);
            }}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id} · {d.name}
              </option>
            ))}
          </select>
        </label>
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
          <h2>No records yet</h2>
          <p>Set the first club record.</p>
          <CoreLink to="/nexus">Play</CoreLink>
        </div>
      ) : (
        <>
          <div className="nc-panel nc-records-list" ref={list}>
            {query.data
              .slice(current * pageSize, (current + 1) * pageSize)
              .map((r, i) => (
                <div className="nc-record-row" key={r.user_id}>
                  <span className="nc-record-rank">
                    {String(current * pageSize + i + 1).padStart(2, "0")}
                  </span>
                  <div className="nc-record-name">
                    {r.display_name || "Defender"}
                    <small>Endless · {r.waves} waves cleared</small>
                  </div>
                  <div className="nc-record-score">
                    {mode === "endless" ? r.waves : r.score.toLocaleString()}
                    <small>{mode === "endless" ? "WAVES" : "POINTS"}</small>
                  </div>
                </div>
              ))}
          </div>
          <div className="nc-record-pages" aria-label="Record pages">
            <button
              aria-label="Previous records"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={19} />
            </button>
            <span>
              {current + 1} / {lastPage + 1}
            </span>
            <button
              aria-label="Next records"
              disabled={current === lastPage}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={19} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
