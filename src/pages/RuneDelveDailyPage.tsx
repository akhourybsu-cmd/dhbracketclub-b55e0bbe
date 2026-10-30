import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Flame, Gem, Timer, Trophy } from "lucide-react";
import {
  useTodayDaily,
  useMyDailyRun,
  useMyDailyStreak,
  useDailyLeaderboard,
} from "@/hooks/useDailyChallenge";
import { ClassBadge } from "@/components/runedelve/ClassBadge";
import { RUNE_PORTAL_ART } from "@/components/runedelve/RuneArtwork";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import { RunePager } from "@/components/runedelve/RunePager";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRuneViewport } from "@/hooks/useRuneViewport";
import {
  endlessRewardFor,
  endlessStarsFor,
  ENDLESS_REWARD_TIERS,
  ENDLESS_STAR_THRESHOLDS,
} from "@/lib/runedelve/endlessMode";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import "@/components/runedelve/runeDailyCompact.css";

const REWARD_THRESHOLDS = [
  ...new Set([
    ...ENDLESS_REWARD_TIERS.map((tier) => tier.kills),
    ...ENDLESS_STAR_THRESHOLDS,
  ]),
].sort((a, b) => a - b);

export default function RuneDelveDailyPage() {
  const today = useTodayDaily();
  const runQuery = useMyDailyRun();
  const streakQuery = useMyDailyStreak();
  const boardQuery = useDailyLeaderboard(10);
  const viewport = useRuneViewport();
  const [view, setView] = useState<"standings" | "rewards">("standings");
  const [boardPage, setBoardPage] = useState(0);
  const [rewardPage, setRewardPage] = useState(0);
  const pageSize = viewport.short ? 2 : 4;
  const boardCount = Math.max(
    1,
    Math.ceil((boardQuery.data?.length ?? 0) / pageSize),
  );
  const currentBoardPage = Math.min(boardPage, boardCount - 1);
  const rewardCount = Math.ceil(REWARD_THRESHOLDS.length / pageSize);
  const currentRewardPage = Math.min(rewardPage, rewardCount - 1);
  const rows =
    boardQuery.data?.slice(
      currentBoardPage * pageSize,
      (currentBoardPage + 1) * pageSize,
    ) ?? [];
  const rewards = REWARD_THRESHOLDS.slice(
    currentRewardPage * pageSize,
    (currentRewardPage + 1) * pageSize,
  );
  const run = runQuery.data;

  if (runQuery.isLoading || runQuery.isError)
    return (
      <section className="rd-screen rd-daily-compact rd-daily-loading">
        <RuneDataState
          loading={runQuery.isLoading}
          error={runQuery.isError}
          onRetry={() => void runQuery.refetch()}
          label="Opening today’s arena…"
        />
      </section>
    );

  return (
    <section
      className="rd-screen rd-daily-compact"
      data-landscape={viewport.landscape}
    >
      <header className="rd-daily-entry">
        <img src={RUNE_PORTAL_ART} alt="" />
        <div className="rd-daily-entry-copy">
          <p className="rd-daily-date">
            <Flame size={12} aria-hidden /> {today.dateStr}
          </p>
          <h1 className="rd-title">
            {run ? `${run.kills_count} slain.` : "Daily arena"}
          </h1>
          <p>
            {run
              ? `${"★".repeat(run.stars)}${"☆".repeat(3 - run.stars)} · ${run.score.toLocaleString()} points`
              : "Two minutes. Rising waves."}
          </p>
        </div>
        <Link to="/rune-delve/endless" className="rd-daily-primary">
          <span>{run ? "Improve today's best" : "Enter daily arena"}</span>
          <ArrowRight size={15} aria-hidden />
        </Link>
      </header>

      <div className="rd-daily-body">
        <aside className="rd-daily-summary" aria-label="Arena rules and streak">
          <div className="rd-daily-stats">
            <div>
              <Timer size={13} aria-hidden />
              <strong>2:00</strong>
              <span>Time limit</span>
            </div>
            {streakQuery.isError ? (
              <button
                type="button"
                onClick={() => void streakQuery.refetch()}
                aria-label="Retry day streak"
              >
                <Flame size={13} aria-hidden />
                <strong>Retry</strong>
                <span>Day streak</span>
              </button>
            ) : (
              <div>
                <Flame size={13} aria-hidden />
                <strong>{streakQuery.data?.current_streak ?? 0}</strong>
                <span>Day streak</span>
              </div>
            )}
            <div>
              <Calendar size={13} aria-hidden />
              <strong>00:00 UTC</strong>
              <span>Resets</span>
            </div>
          </div>
          <p>
            Base class powers. Campaign relics and masteries stay in the
            campaign.
          </p>
        </aside>

        <div className="rd-daily-details">
          <Tabs
            value={view}
            onValueChange={(value) => setView(value as typeof view)}
          >
            <TabsList className="rd-daily-tabs" aria-label="Arena details">
              <TabsTrigger
                value="standings"
                id="daily-standings-tab"
                aria-controls="daily-standings"
              >
                Today’s standings
              </TabsTrigger>
              <TabsTrigger
                value="rewards"
                id="daily-rewards-tab"
                aria-controls="daily-rewards"
              >
                Rewards
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {view === "standings" ? (
            <section
              role="tabpanel"
              id="daily-standings"
              aria-labelledby="daily-standings-tab"
              className="rd-daily-panel"
            >
              <h2>
                <Trophy size={15} aria-hidden /> Club arena
              </h2>
              {boardQuery.isLoading || boardQuery.isError ? (
                <RuneDataState
                  loading={boardQuery.isLoading}
                  error={boardQuery.isError}
                  onRetry={() => void boardQuery.refetch()}
                  label="Loading standings…"
                />
              ) : !boardQuery.data?.length ? (
                <p className="rd-daily-empty">
                  The arena awaits its first challenger.
                </p>
              ) : (
                <div
                  className="rd-daily-standings rd-motion-collection"
                  key={currentBoardPage}
                >
                  {rows.map((row) => (
                    <article
                      key={row.id}
                      className="rd-daily-standing"
                      aria-label={`Rank ${row.rank}: ${row.profile.display_name ?? "Adventurer"}`}
                    >
                      <span className="rd-daily-rank">#{row.rank}</span>
                      <ClassBadge cls={row.hero_class as HeroClass} size="sm" />
                      <strong>
                        {row.profile.display_name ?? "Adventurer"}
                      </strong>
                      <span className="rd-daily-kills">
                        {row.kills_count} slain
                      </span>
                    </article>
                  ))}
                </div>
              )}
              {!boardQuery.isLoading && !boardQuery.isError && (
                <RunePager
                  page={currentBoardPage}
                  pageCount={boardCount}
                  onPageChange={setBoardPage}
                  label="Arena standings"
                />
              )}
            </section>
          ) : (
            <section
              role="tabpanel"
              id="daily-rewards"
              aria-labelledby="daily-rewards-tab"
              className="rd-daily-panel"
            >
              <h2>
                <Gem size={15} aria-hidden /> Your best daily reward
              </h2>
              <div
                className="rd-daily-rewards rd-motion-collection"
                key={currentRewardPage}
              >
                {rewards.map((kills) => (
                  <article
                    key={kills}
                    className="rd-daily-reward"
                    aria-label={`${kills}+ slain reward`}
                  >
                    <strong>
                      {kills}+ slain{" "}
                      <span aria-label={`${endlessStarsFor(kills)} stars`}>
                        {"★".repeat(endlessStarsFor(kills))}
                      </span>
                    </strong>
                    <span>{endlessRewardFor(kills).shards} shards</span>
                  </article>
                ))}
              </div>
              <p className="rd-daily-reward-note">
                Better tiers pay the difference. Up to 900 shards and 500 XP
                each day.
              </p>
              <RunePager
                page={currentRewardPage}
                pageCount={rewardCount}
                onPageChange={setRewardPage}
                label="Arena rewards"
              />
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
