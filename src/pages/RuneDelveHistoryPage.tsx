import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ClassBadge } from "@/components/runedelve/ClassBadge";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import { chapterFor } from "@/lib/runedelve/levelGenerator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuestDefinitions } from "@/hooks/useQuests";
import { runeRequest } from "@/lib/runedelve/request";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import { RunePager } from "@/components/runedelve/RunePager";
import { useRuneViewport } from "@/hooks/useRuneViewport";
import type { ActiveQuest } from "@/lib/runedelve/quests";
import "@/components/runedelve/runeCodex.css";

interface LevelRun {
  id: string;
  level_number: number | null;
  score: number;
  enemies_defeated: number;
  longest_chain: number;
  dungeon_cleared: boolean;
  xp_earned: number;
  hero_class: string;
  completed_at: string;
  attempts?: number | null;
  clears?: number | null;
  best_turns_used?: number | null;
}
interface DailyRunRow {
  id: string;
  daily_date: string;
  score: number;
  stars: number;
  kills_count: number;
  hero_class: HeroClass;
}

function useLevelHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rune-delve-level-history", user?.id, 50],
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<LevelRun[]> => {
      if (!user) return [];
      const { data } = await runeRequest(
        supabase
          .from("rune_delve_runs")
          .select(
            "id, level_id, level_number, score, enemies_defeated, longest_chain, dungeon_cleared, xp_earned, hero_class, completed_at, attempts, clears, best_turns_used",
          )
          .eq("user_id", user.id)
          .order("last_played_at", { ascending: false })
          .limit(50),
      );
      return (data ?? []) as LevelRun[];
    },
  });
}
function useDailyHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rune-delve-daily-history", user?.id, 60],
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<DailyRunRow[]> => {
      if (!user) return [];
      const { data } = await runeRequest(
        supabase
          .from("rune_delve_daily_runs")
          .select("id, daily_date, score, stars, kills_count, hero_class")
          .eq("user_id", user.id)
          .order("daily_date", { ascending: false })
          .limit(60),
      );
      return (data ?? []) as unknown as DailyRunRow[];
    },
  });
}
function useQuestHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rune-delve-quest-history", user?.id, 120],
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<ActiveQuest[]> => {
      if (!user) return [];
      const { data } = await runeRequest(
        supabase
          .from("rune_delve_active_quests" as never)
          .select("*")
          .eq("user_id", user.id)
          .order("period_key", { ascending: false })
          .limit(120),
      );
      return (data ?? []) as unknown as ActiveQuest[];
    },
  });
}

export default function RuneDelveHistoryPage() {
  const [tab, setTab] = useState("levels");
  return (
    <div className="rd-screen rd-codex-page" data-testid="rune-history">
      <header className="rd-codex-heading">
        <div>
          <h1 className="rd-title">History</h1>
          <p>Recent campaign, daily arena and quest records.</p>
        </div>
      </header>
      <Tabs value={tab} onValueChange={setTab} className="rd-codex-tabs">
        <TabsList className="rd-codex-tabbar">
          <TabsTrigger value="levels">Levels</TabsTrigger>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="quests">Quests</TabsTrigger>
        </TabsList>
        <TabsContent value="levels" className="rd-codex-tab-content">
          <LevelsTab />
        </TabsContent>
        <TabsContent value="daily" className="rd-codex-tab-content">
          <DailyTab />
        </TabsContent>
        <TabsContent value="quests" className="rd-codex-tab-content">
          <QuestsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HistoryPages<T>({
  rows,
  kind,
  label,
  summary,
  renderRow,
}: {
  rows: T[];
  kind: "levels" | "daily" | "quests";
  label: string;
  summary: ReactNode;
  renderRow: (row: T) => ReactNode;
}) {
  const viewport = useRuneViewport();
  const [requestedPage, setPage] = useState(0);
  const wide = viewport.landscape && viewport.width >= 640;
  const pageSize =
    kind === "quests"
      ? wide
        ? 1
        : viewport.short
          ? 2
          : 3
      : wide
        ? 2
        : viewport.short
          ? 3
          : 5;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requestedPage, pageCount - 1);
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <section className="rd-codex-records" aria-label={label}>
      <div className="rd-codex-summary">{summary}</div>
      <div
        className="rd-codex-record-grid"
        style={{
          gridTemplateColumns:
            wide && kind !== "quests" ? "repeat(2, minmax(0, 1fr))" : "1fr",
          gridTemplateRows: `repeat(${wide ? 1 : visible.length}, minmax(0, 1fr))`,
        }}
      >
        {visible.map(renderRow)}
      </div>
      <RunePager
        page={page}
        pageCount={pageCount}
        onPageChange={setPage}
        label={label}
      />
    </section>
  );
}

function LevelsTab() {
  const query = useLevelHistory();
  if (query.isError || query.isLoading)
    return (
      <RuneDataState
        error={query.isError}
        onRetry={() => void query.refetch()}
        label="Loading campaign records…"
      />
    );
  const rows = (query.data ?? []).filter((row) => row.level_number != null);
  if (!rows.length)
    return (
      <div className="rd-codex-empty">
        <p>No campaign records yet — start your campaign!</p>
        <Link to="/rune-delve/levels">Open campaign</Link>
      </div>
    );
  return (
    <HistoryPages
      rows={rows}
      kind="levels"
      label="Campaign history"
      summary={
        <span>
          {rows.length} records ·{" "}
          <strong>
            {rows.filter((row) => row.dungeon_cleared).length} cleared
          </strong>
        </span>
      }
      renderRow={(row) => (
        <article key={row.id} className="rd-codex-card">
          <div className="rd-codex-card-head">
            <ClassBadge cls={row.hero_class as HeroClass} size="sm" />
            <div>
              <h2>
                Level {row.level_number}{" "}
                <small>· Ch. {chapterFor(row.level_number ?? 1)}</small>
              </h2>
              <small>
                {row.dungeon_cleared ? "CLEAR" : "ATTEMPT"} ·{" "}
                {row.enemies_defeated} kills · chain {row.longest_chain}
              </small>
            </div>
            <strong>{row.score.toLocaleString()}</strong>
          </div>
          <div className="rd-codex-card-foot">
            <small>+{row.xp_earned} XP</small>
            <small>
              {row.clears ?? Number(row.dungeon_cleared)}/{row.attempts ?? 1}{" "}
              clears
              {row.best_turns_used != null
                ? ` · best ${row.best_turns_used} moves`
                : ""}
            </small>
          </div>
        </article>
      )}
    />
  );
}

function DailyTab() {
  const query = useDailyHistory();
  if (query.isError || query.isLoading)
    return (
      <RuneDataState
        error={query.isError}
        onRetry={() => void query.refetch()}
        label="Loading daily records…"
      />
    );
  const rows = query.data ?? [];
  if (!rows.length)
    return (
      <div className="rd-codex-empty">
        <p>No daily challenges attempted yet.</p>
        <Link to="/rune-delve/daily">Try today’s arena</Link>
      </div>
    );
  return (
    <HistoryPages
      rows={rows}
      kind="daily"
      label="Daily history"
      summary={
        <span>
          {rows.length} plays ·{" "}
          <strong>
            {rows.reduce((total, row) => total + (row.kills_count ?? 0), 0)}{" "}
            kills
          </strong>{" "}
          · {rows.filter((row) => row.stars === 3).length} three-star runs
        </span>
      }
      renderRow={(row) => (
        <article key={row.id} className="rd-codex-card">
          <div className="rd-codex-card-head">
            <ClassBadge cls={row.hero_class} size="sm" />
            <div>
              <h2>{row.daily_date}</h2>
              <small>
                {row.kills_count ?? 0} kills · {row.stars} of 3 stars
              </small>
            </div>
            <strong>{row.score.toLocaleString()}</strong>
          </div>
        </article>
      )}
    />
  );
}

function QuestsTab() {
  const query = useQuestHistory();
  const definitions = useQuestDefinitions();
  const retry = () => {
    void query.refetch();
    void definitions.refetch();
  };
  if (
    query.isError ||
    definitions.isError ||
    query.isLoading ||
    definitions.isLoading
  )
    return (
      <RuneDataState
        error={query.isError || definitions.isError}
        onRetry={retry}
        label="Loading quest records…"
      />
    );
  const rows = query.data ?? [];
  if (!rows.length)
    return (
      <div className="rd-codex-empty">
        <p>No quest history yet.</p>
        <Link to="/rune-delve/quests">View today’s quests</Link>
      </div>
    );
  const byId = new Map(
    (definitions.data ?? []).map((definition) => [definition.id, definition]),
  );
  return (
    <HistoryPages
      rows={rows}
      kind="quests"
      label="Quest history"
      summary={
        <span>
          {rows.length} seen ·{" "}
          <strong>
            {rows.filter((row) => row.status !== "active").length} complete
          </strong>{" "}
          · {rows.filter((row) => row.status === "claimed").length} claimed
        </span>
      }
      renderRow={(row) => {
        const definition = byId.get(row.quest_id);
        return (
          <article key={row.id} className="rd-codex-card">
            <div className="rd-codex-card-head">
              <div>
                <small>
                  {row.scope === "weekly" ? "Week" : "Day"} · {row.period_key}
                </small>
                <h2>{definition?.title ?? "Quest"}</h2>
              </div>
              {definition && <strong>+{definition.shard_reward}</strong>}
            </div>
            {definition && <p>{definition.description}</p>}
            <div className="rd-codex-card-foot">
              <small>
                {row.progress}/{row.target_value}
              </small>
              <strong className="text-[11px] text-primary">
                {row.status === "claimed"
                  ? "Claimed"
                  : row.status === "completed"
                    ? "Ready to claim"
                    : "In progress"}
              </strong>
            </div>
          </article>
        );
      }}
    />
  );
}
