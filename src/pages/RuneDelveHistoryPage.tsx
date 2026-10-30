import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Sparkles, Trophy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ClassBadge } from "@/components/runedelve/ClassBadge";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import { chapterFor } from "@/lib/runedelve/levelGenerator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuestDefinitions } from "@/hooks/useQuests";
import type { DailyModifierId } from "@/lib/runedelve/dailyModifiers";
import { runeRequest } from "@/lib/runedelve/request";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import { cn } from "@/lib/utils";
import type { ActiveQuest } from "@/lib/runedelve/quests";

interface LevelRun {
  id: string;
  level_id: string;
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
  dungeon_cleared: boolean;
  modifiers: DailyModifierId[];
  hero_class: HeroClass;
  completed_at: string;
}

function useLevelHistory(limit = 50) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rune-delve-level-history", user?.id, limit],
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
          .limit(limit),
      );
      return (data ?? []) as LevelRun[];
    },
  });
}

function useDailyRunHistory(limit = 60) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rune-delve-daily-history", user?.id, limit],
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<DailyRunRow[]> => {
      if (!user) return [];
      const { data } = await runeRequest(
        supabase
          .from("rune_delve_daily_runs")
          .select(
            "id, daily_date, score, stars, kills_count, dungeon_cleared, modifiers, hero_class, completed_at",
          )
          .eq("user_id", user.id)
          .order("daily_date", { ascending: false })
          .limit(limit),
      );
      return (data ?? []) as unknown as DailyRunRow[];
    },
  });
}

function useQuestHistory(limit = 100) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["rune-delve-quest-history", user?.id, limit],
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
          .limit(limit),
      );
      return (data ?? []) as unknown as ActiveQuest[];
    },
  });
}

export default function RuneDelveHistoryPage() {
  const [tab, setTab] = useState<"levels" | "daily" | "quests">("levels");

  return (
    <div className="space-y-4 pb-8">
      <div className="space-y-1">
        <h1 className="page-header-title">History</h1>
        <p className="text-[11px] text-muted-foreground">
          Recent campaign records, daily arenas, and quest rewards.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="w-full h-auto grid grid-cols-3">
          <TabsTrigger
            value="levels"
            className="min-h-11 text-[11px] font-extrabold"
          >
            Levels
          </TabsTrigger>
          <TabsTrigger
            value="daily"
            className="min-h-11 text-[11px] font-extrabold"
          >
            Daily
          </TabsTrigger>
          <TabsTrigger
            value="quests"
            className="min-h-11 text-[11px] font-extrabold"
          >
            Quests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="levels" className="mt-3">
          <LevelsTab />
        </TabsContent>
        <TabsContent value="daily" className="mt-3">
          <DailyTab />
        </TabsContent>
        <TabsContent value="quests" className="mt-3">
          <QuestsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LevelsTab() {
  const query = useLevelHistory(50);
  const { data: runs, isLoading } = query;
  const cleared = (runs ?? []).filter((r) => r.level_number != null);

  if (query.isError || isLoading)
    return (
      <RuneDataState
        error={query.isError}
        onRetry={() => void query.refetch()}
        label="Loading campaign records…"
      />
    );
  if (cleared.length === 0)
    return (
      <div className="glass-card p-6 text-center text-xs text-muted-foreground">
        No campaign records yet — start your campaign!
      </div>
    );

  return (
    <div className="space-y-2 rd-stagger">
      {cleared.map((r) => (
        <article
          key={r.id}
          className="glass-card p-3 flex items-center gap-3 hover:bg-muted/20 transition-colors"
        >
          <ClassBadge cls={r.hero_class as HeroClass} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold">
              Level {r.level_number}
              <span className="text-[10px] text-muted-foreground font-normal ml-1.5">
                · Ch. {chapterFor(r.level_number ?? 1)}
              </span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              {r.dungeon_cleared && (
                <span className="font-bold text-success">CLEAR · </span>
              )}
              {r.enemies_defeated} kills · chain {r.longest_chain}
              {(r.attempts ?? 0) > 1 && (
                <span className="ml-1.5 px-1.5 py-[1px] rounded-md bg-muted/40 font-bold tabular-nums">
                  {r.clears ?? 0}/{r.attempts}
                </span>
              )}
              {r.best_turns_used != null && (
                <span className="ml-1.5 text-foreground/70">
                  · ⚡ {r.best_turns_used}t
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <p
              className="font-mono font-extrabold tabular-nums"
              style={{ color: "hsl(var(--gold))" }}
            >
              {r.score.toLocaleString()}
            </p>
            <p className="text-[9px] text-muted-foreground">
              +{r.xp_earned} XP
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function DailyTab() {
  const query = useDailyRunHistory(60);
  const { data: runs, isLoading } = query;

  if (query.isError || isLoading)
    return (
      <RuneDataState
        error={query.isError}
        onRetry={() => void query.refetch()}
        label="Loading your history…"
      />
    );
  if (!runs || runs.length === 0) {
    return (
      <div className="glass-card p-6 text-center space-y-2">
        <Calendar className="w-6 h-6 mx-auto text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          No daily challenges attempted yet.
        </p>
        <Link
          to="/rune-delve/daily"
          className="inline-block text-[11px] font-bold text-accent"
        >
          Try today's trial →
        </Link>
      </div>
    );
  }

  const totals = {
    plays: runs.length,
    kills: runs.reduce((sum, run) => sum + (run.kills_count ?? 0), 0),
    threeStars: runs.filter((r) => r.stars === 3).length,
    bestScore: Math.max(0, ...runs.map((r) => r.score)),
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        <StatBlock label="Plays" value={totals.plays} />
        <StatBlock label="Slain" value={totals.kills} />
        <StatBlock label="3★" value={totals.threeStars} />
        <StatBlock
          label="Best"
          value={totals.bestScore.toLocaleString()}
          mono
        />
      </div>
      <div className="space-y-2 rd-stagger">
        {runs.map((r) => (
          <div key={r.id} className="glass-card p-3 flex items-center gap-3">
            <ClassBadge cls={r.hero_class} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-accent" /> {r.daily_date}
                {r.dungeon_cleared && (
                  <span className="text-[9px] font-bold text-success">
                    CLEAR
                  </span>
                )}
              </p>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground">
                  {r.kills_count ?? 0} slain
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums ml-1">
                  {"★".repeat(r.stars)}
                  {"☆".repeat(3 - r.stars)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p
                className="font-mono font-extrabold tabular-nums"
                style={{ color: "hsl(var(--gold))" }}
              >
                {r.score.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestsTab() {
  const definitions = useQuestDefinitions();
  const query = useQuestHistory(120);
  const { data: defs } = definitions;
  const { data: rows } = query;

  if (
    query.isError ||
    definitions.isError ||
    query.isLoading ||
    definitions.isLoading
  )
    return (
      <RuneDataState
        error={query.isError || definitions.isError}
        onRetry={() => {
          void query.refetch();
          void definitions.refetch();
        }}
        label="Loading quest history…"
      />
    );
  if (!rows || rows.length === 0) {
    return (
      <div className="glass-card p-6 text-center space-y-2">
        <Sparkles className="w-6 h-6 mx-auto text-muted-foreground" />
        <p className="text-xs text-muted-foreground">No quest history yet.</p>
        <Link
          to="/rune-delve/quests"
          className="inline-block text-[11px] font-bold text-accent"
        >
          View today's quests →
        </Link>
      </div>
    );
  }

  const defMap = new Map((defs ?? []).map((d) => [d.id, d]));
  // Group by period_key.
  const byPeriod = new Map<string, ActiveQuest[]>();
  for (const r of rows) {
    if (!byPeriod.has(r.period_key)) byPeriod.set(r.period_key, []);
    byPeriod.get(r.period_key)!.push(r);
  }
  const periods = Array.from(byPeriod.keys()).sort((a, b) =>
    b.localeCompare(a),
  );

  const totals = {
    seen: rows.length,
    completed: rows.filter(
      (r) => r.status === "completed" || r.status === "claimed",
    ).length,
    claimed: rows.filter((r) => r.status === "claimed").length,
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <StatBlock label="Total" value={totals.seen} />
        <StatBlock label="Completed" value={totals.completed} />
        <StatBlock label="Claimed" value={totals.claimed} />
      </div>

      {periods.map((periodKey) => {
        const list = byPeriod.get(periodKey)!;
        const isWeekly = periodKey.includes("W");
        return (
          <div key={periodKey} className="space-y-1.5">
            <div className="flex items-center gap-2 px-1">
              {isWeekly ? (
                <Trophy className="w-3 h-3 text-accent" />
              ) : (
                <Calendar className="w-3 h-3 text-accent" />
              )}
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {isWeekly ? "Week" : "Day"} · {periodKey}
              </p>
            </div>
            {list.map((q) => {
              const def = defMap.get(q.quest_id);
              const isComplete =
                q.status === "completed" || q.status === "claimed";
              const isClaimed = q.status === "claimed";
              const pct = Math.min(
                100,
                Math.round((q.progress / Math.max(1, q.target_value)) * 100),
              );
              return (
                <div
                  key={q.id}
                  className={cn("glass-card p-3", isClaimed && "opacity-70")}
                  style={
                    isComplete
                      ? {
                          borderColor: "hsl(var(--accent) / 0.35)",
                        }
                      : undefined
                  }
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-extrabold text-[12px] truncate">
                          {def?.title ?? "Quest"}
                        </p>
                        {isClaimed && (
                          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider inline-flex items-center gap-0.5">
                            <Check className="w-2 h-2" /> Claimed
                          </span>
                        )}
                        {isComplete && !isClaimed && (
                          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-accent/20 text-accent uppercase tracking-wider">
                            Ready
                          </span>
                        )}
                      </div>
                      {def && (
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          {def.description}
                        </p>
                      )}
                    </div>
                    {def && (
                      <p
                        className="font-mono font-extrabold text-[11px] tabular-nums shrink-0"
                        style={{ color: "hsl(var(--gold))" }}
                      >
                        +{def.shard_reward}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${pct}%`,
                          background: isComplete
                            ? "linear-gradient(90deg, hsl(var(--accent)), hsl(var(--gold)))"
                            : "hsl(var(--primary))",
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-mono font-extrabold tabular-nums text-foreground/70">
                      {q.progress}/{q.target_value}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function StatBlock({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div className="glass-card p-2 text-center">
      <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "font-extrabold text-sm mt-0.5 tabular-nums",
          mono && "font-mono text-[12px]",
        )}
        style={{ color: "hsl(var(--gold))" }}
      >
        {value}
      </p>
    </div>
  );
}
