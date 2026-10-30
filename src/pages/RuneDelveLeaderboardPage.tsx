import { useState } from "react";
import { useCampaignLeaderboard } from "@/hooks/useRuneDelveCampaign";
import { useAuth } from "@/contexts/AuthContext";
import { ClassBadge } from "@/components/runedelve/ClassBadge";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import { RunePager } from "@/components/runedelve/RunePager";
import { useRuneViewport } from "@/hooks/useRuneViewport";
import "@/components/runedelve/runeCodex.css";

export default function RuneDelveLeaderboardPage() {
  const { user } = useAuth();
  const query = useCampaignLeaderboard();
  const viewport = useRuneViewport();
  const [requestedPage, setPage] = useState(0);
  const wide = viewport.landscape && viewport.width >= 640;
  const pageSize = wide ? 2 : viewport.short ? 3 : 5;
  const rows = query.data ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requestedPage, pageCount - 1);
  const mine = rows.findIndex((row) => row.user_id === user?.id);
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="rd-screen rd-codex-page" data-testid="rune-leaderboard">
      <header className="rd-codex-heading">
        <div>
          <h1 className="rd-title">Campaign Leaders</h1>
          <p>Highest depth, then total levels cleared.</p>
        </div>
        {mine >= 0 && (
          <button
            type="button"
            className="rd-codex-rank-link"
            onClick={() => setPage(Math.floor(mine / pageSize))}
            aria-label={`Show your rank, ${rows[mine].rank}`}
          >
            You · #{rows[mine].rank}
          </button>
        )}
      </header>
      {query.isLoading ? (
        <RuneDataState
          label="Loading campaign standings…"
          onRetry={() => void query.refetch()}
        />
      ) : query.isError ? (
        <RuneDataState error onRetry={() => void query.refetch()} />
      ) : !rows.length ? (
        <div className="rd-codex-empty">
          No heroes have delved yet — be the first!
        </div>
      ) : (
        <>
          <div
            className="rd-codex-record-grid"
            role="list"
            aria-label="Campaign standings"
            style={{
              gridTemplateColumns: wide ? "repeat(2, minmax(0, 1fr))" : "1fr",
              gridTemplateRows: `repeat(${wide ? 1 : visible.length}, minmax(0, 1fr))`,
            }}
          >
            {visible.map((row) => (
              <article
                role="listitem"
                key={row.id}
                className={`rd-codex-card rd-codex-leader${row.user_id === user?.id ? " is-me" : ""}`}
              >
                <span className="rd-codex-leader-rank">#{row.rank}</span>
                {row.hero?.class && (
                  <ClassBadge cls={row.hero.class as HeroClass} size="sm" />
                )}
                <div className="rd-codex-leader-name">
                  <strong>
                    {(row.hero?.hero_name as string) ??
                      row.profile.display_name}
                    {row.user_id === user?.id && (
                      <span className="text-primary"> (you)</span>
                    )}
                  </strong>
                  <small>
                    {row.total_levels_cleared} cleared
                    {row.hero?.level ? ` · Lv ${row.hero.level}` : ""}
                    {row.hero?.current_streak
                      ? ` · ${row.hero.current_streak}-day streak`
                      : ""}
                  </small>
                  {row.hero?.cosmetic_title && (
                    <small className="text-primary">
                      {row.hero.cosmetic_title as string}
                    </small>
                  )}
                </div>
                <div className="rd-codex-leader-depth">
                  <small>Highest</small>
                  <strong>L{row.highest_completed_level}</strong>
                </div>
              </article>
            ))}
          </div>
          <RunePager
            page={page}
            pageCount={pageCount}
            onPageChange={setPage}
            label="Standings"
          />
        </>
      )}
    </div>
  );
}
