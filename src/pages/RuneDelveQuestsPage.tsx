import { Link } from "react-router-dom";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import {
  useActiveQuests,
  useClaimQuest,
  useQuestDefinitions,
} from "@/hooks/useQuests";
import {
  dailyPeriodKey,
  weeklyPeriodKey,
  type ActiveQuest,
} from "@/lib/runedelve/quests";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import { useRuneDelveHero } from "@/hooks/useRuneDelveHero";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RunePager } from "@/components/runedelve/RunePager";
import "@/components/runedelve/runeCodex.css";

export default function RuneDelveQuestsPage() {
  const query = useActiveQuests();
  const cache = useQueryClient();
  const heroQuery = useRuneDelveHero();
  const definitionsQuery = useQuestDefinitions();
  const claim = useClaimQuest();
  const claiming = useRef(false);
  const [scope, setScope] = useState("daily");
  const onClaim = async (quest: ActiveQuest) => {
    if (claiming.current) return;
    claiming.current = true;
    try {
      await claim.mutateAsync(quest);
    } catch {
      /* Mutation supplies a retryable error. */
    } finally {
      claiming.current = false;
    }
  };
  const retry = () => {
    void cache.invalidateQueries({ queryKey: ["rd-active-quests"] });
    void heroQuery.refetch();
    void definitionsQuery.refetch();
  };
  const isLoading =
    heroQuery.isLoading || definitionsQuery.isLoading || query.isLoading;
  const isError =
    heroQuery.isError || definitionsQuery.isError || query.isError;

  return (
    <div className="rd-screen rd-codex-page" data-testid="rune-quests">
      <header className="rd-codex-heading">
        <Link
          to="/rune-delve"
          aria-label="Back to sanctum"
          className="rd-codex-back"
        >
          <ArrowLeft size={17} />
        </Link>
        <div className="flex-1">
          <h1 className="rd-title">Quests</h1>
          <p>Play, complete objectives, claim bonus shards.</p>
        </div>
      </header>
      {isError ? (
        <RuneDataState error onRetry={retry} />
      ) : isLoading ? (
        <RuneDataState label="Loading your quests…" onRetry={retry} />
      ) : !heroQuery.data ? (
        <div className="rd-codex-empty">
          <Link to="/rune-delve">Create a hero to unlock quests</Link>
        </div>
      ) : (
        <Tabs value={scope} onValueChange={setScope} className="rd-codex-tabs">
          <TabsList className="rd-codex-tabbar">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="guide">Guide</TabsTrigger>
          </TabsList>
          {(["daily", "weekly"] as const).map((value) => (
            <TabsContent
              key={value}
              value={value}
              className="rd-codex-tab-content"
            >
              <QuestDeck
                scope={value}
                quests={(query.data ?? []).filter(
                  (quest) => quest.scope === value,
                )}
                onClaim={(quest) => void onClaim(quest)}
                claiming={claim.isPending}
              />
            </TabsContent>
          ))}
          <TabsContent value="guide" className="rd-codex-tab-content">
            <section className="rd-quest-guide">
              <div>
                <h2 className="rd-title text-base">How it works</h2>
                <p>
                  Each day and week brings{" "}
                  <b>2 shared quests and 1 personal quest</b>. Progress updates
                  as you play.
                </p>
              </div>
              <div>
                <p>
                  Complete an objective, then press <b>Claim</b> to bank its
                  shards and XP.
                </p>
                <p className="mt-2">
                  Claim before the reset: daily at midnight UTC, weekly on
                  Monday.
                </p>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function QuestDeck({
  scope,
  quests,
  onClaim,
  claiming,
}: {
  scope: "daily" | "weekly";
  quests: ActiveQuest[];
  onClaim: (quest: ActiveQuest) => void;
  claiming: boolean;
}) {
  const [requestedPage, setPage] = useState(0);
  const page = Math.min(requestedPage, Math.max(0, quests.length - 1));
  const quest = quests[page];
  const definition = quest?.definition;
  const title = scope === "daily" ? "Daily Quests" : "Weekly Quests";
  const reset =
    scope === "daily"
      ? `Midnight UTC · ${dailyPeriodKey()}`
      : `Monday · ${weeklyPeriodKey()}`;
  const pct = quest
    ? Math.min(
        100,
        Math.round((quest.progress / Math.max(1, quest.target_value)) * 100),
      )
    : 0;
  return (
    <section className="rd-codex-records" aria-label={title}>
      <div className="rd-codex-summary">
        <h2 className="text-xs font-extrabold">{title}</h2>
        <span className="text-[10px] text-muted-foreground">{reset}</span>
      </div>
      {!definition ? (
        <div className="rd-codex-empty">
          No active quests — check back next reset.
        </div>
      ) : (
        <article className="rd-codex-card rd-quest-card flex-1">
          <div>
            <span className="rd-quest-status">
              {definition.is_personal
                ? "Personal objective"
                : "Shared objective"}
            </span>
            <h3>{definition.title}</h3>
            <p className="mt-2">{definition.description}</p>
          </div>
          <div className="rd-quest-reward">
            <div className="rd-codex-card-foot">
              <strong className="text-gold text-base">
                +{definition.shard_reward} shards
              </strong>
              <small>+{definition.xp_reward} XP</small>
            </div>
            <div>
              <div className="rd-codex-card-foot mb-1">
                <small>Progress</small>
                <small>
                  {quest.progress}/{quest.target_value}
                </small>
              </div>
              <div
                className="rd-quest-progress"
                role="progressbar"
                aria-label={`${definition.title} progress`}
                aria-valuenow={quest.progress}
                aria-valuemin={0}
                aria-valuemax={quest.target_value}
              >
                <span style={{ width: `${pct}%` }} />
              </div>
            </div>
            {quest.status === "completed" ? (
              <button
                type="button"
                className="rd-quest-action"
                disabled={claiming}
                onClick={() => onClaim(quest)}
              >
                {claiming
                  ? "Claiming…"
                  : `Claim +${definition.shard_reward} 💎`}
              </button>
            ) : quest.status === "claimed" ? (
              <p className="text-center" role="status">
                Reward claimed · Resets next period
              </p>
            ) : (
              <p className="text-center text-muted-foreground">
                Progress is tracked as you play.
              </p>
            )}
          </div>
        </article>
      )}
      <RunePager
        page={page}
        pageCount={quests.length}
        onPageChange={setPage}
        label={scope === "daily" ? "Daily quest" : "Weekly quest"}
      />
    </section>
  );
}
