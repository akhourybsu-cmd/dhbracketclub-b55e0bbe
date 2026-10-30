import { useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Flame, Gem, Timer, Trophy } from "lucide-react";
import {
  useTodayDaily,
  useMyDailyRun,
  useMyDailyStreak,
  useDailyLeaderboard,
} from "@/hooks/useDailyChallenge";
import { ClassBadge } from "@/components/runedelve/ClassBadge";
import { RUNE_PORTAL_ART } from "@/components/runedelve/RuneArtwork";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import { endlessRewardFor, endlessStarsFor } from "@/lib/runedelve/endlessMode";
import type { HeroClass } from "@/lib/runedelve/classConfig";

export default function RuneDelveDailyPage() {
  const today = useTodayDaily();
  const runQuery = useMyDailyRun();
  const { data: streak } = useMyDailyStreak();
  const boardQuery = useDailyLeaderboard(10);
  const [view, setView] = useState<"standings" | "rewards">("standings");
  const run = runQuery.data;
  if (runQuery.isLoading || runQuery.isError)
    return (
      <RuneDataState
        loading={runQuery.isLoading}
        error={runQuery.isError}
        onRetry={() => void runQuery.refetch()}
        label="Opening today’s arena…"
      />
    );
  return (
    <section className="space-y-3 pb-2">
      <div className="rd-sanctum" style={{ minHeight: 250 }}>
        <img src={RUNE_PORTAL_ART} alt="" />
        <div className="rd-sanctum-copy">
          <p className="rd-eyebrow">
            <Flame size={13} /> Daily arena · {today.dateStr}
          </p>
          <h1>{run ? `${run.kills_count} slain.` : "Race the darkness."}</h1>
          <p>
            {run
              ? `${"★".repeat(run.stars)}${"☆".repeat(3 - run.stars)} · ${run.score.toLocaleString()} points`
              : "Two minutes. Rising waves. Your class, your skill."}
          </p>
          <Link
            to={run ? "/rune-delve/expedition" : "/rune-delve/endless"}
            className="rd-primary-action"
          >
            <Flame />
            {run ? "Take on an Expedition" : "Enter daily arena"}
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: Timer, label: "Time limit", value: "2:00" },
          {
            icon: Flame,
            label: "Day streak",
            value: String(streak?.current_streak ?? 0),
          },
          { icon: Calendar, label: "Resets", value: "00:00 UTC" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border bg-card p-3 text-center"
          >
            <item.icon size={16} className="text-gold mx-auto mb-1" />
            <strong className="block text-sm">{item.value}</strong>
            <small className="text-[10px] text-muted-foreground">
              {item.label}
            </small>
          </div>
        ))}
      </div>
      <div
        role="tablist"
        aria-label="Arena details"
        className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
      >
        {(["standings", "rewards"] as const).map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={view === tab}
            aria-controls={`daily-${tab}`}
            key={tab}
            onClick={() => setView(tab)}
            className={`min-h-11 rounded-lg text-xs font-bold ${view === tab ? "bg-card text-primary" : "text-muted-foreground"}`}
          >
            {tab === "standings" ? "Today’s standings" : "Rewards"}
          </button>
        ))}
      </div>
      {view === "standings" ? (
        <div
          role="tabpanel"
          id="daily-standings"
          className="rounded-2xl border border-border bg-card p-4"
        >
          <h2 className="flex items-center gap-2 text-sm font-bold mb-3">
            <Trophy size={16} className="text-gold" />
            Club arena
          </h2>
          {boardQuery.isLoading || boardQuery.isError ? (
            <RuneDataState
              loading={boardQuery.isLoading}
              error={boardQuery.isError}
              onRetry={() => void boardQuery.refetch()}
              label="Loading standings…"
            />
          ) : !boardQuery.data?.length ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              The arena awaits its first challenger.
            </p>
          ) : (
            boardQuery.data.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-2.5 border-b border-border/40 py-3 last:border-0"
              >
                <span className="w-5 text-xs font-mono text-muted-foreground">
                  {row.rank}
                </span>
                <ClassBadge cls={row.hero_class as HeroClass} size="sm" />
                <strong className="flex-1 truncate text-xs">
                  {row.profile.display_name ?? "Adventurer"}
                </strong>
                <span className="text-xs font-bold text-gold">
                  {row.kills_count} slain
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div
          role="tabpanel"
          id="daily-rewards"
          className="rounded-2xl border border-border bg-card p-4"
        >
          <h2 className="flex gap-2 items-center text-sm font-bold mb-3">
            <Gem size={16} className="text-primary" />
            One daily reward
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {[0, 5, 10, 15, 20, 30, 50].map((kills) => (
              <div key={kills} className="rounded-xl border border-border p-3">
                <strong className="block text-xs">
                  {kills}+ slain{" "}
                  <span className="text-gold">
                    {"★".repeat(endlessStarsFor(kills))}
                  </span>
                </strong>
                <span className="text-xs text-primary">
                  {endlessRewardFor(kills).shards} shards
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Your first result banks the day’s shards and XP. Relics and
            masteries stay in campaign; the arena uses base class powers.
          </p>
        </div>
      )}
    </section>
  );
}
