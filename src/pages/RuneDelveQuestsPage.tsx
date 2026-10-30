import { Link } from "react-router-dom";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Sparkles,
  Trophy,
  Check,
  Lock,
} from "lucide-react";
import { useActiveQuests, useClaimQuest } from "@/hooks/useQuests";
import {
  dailyPeriodKey,
  weeklyPeriodKey,
  type ActiveQuest,
} from "@/lib/runedelve/quests";
import { cn } from "@/lib/utils";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import { useRuneDelveHero } from "@/hooks/useRuneDelveHero";
import { useQuestDefinitions } from "@/hooks/useQuests";

export default function RuneDelveQuestsPage() {
  const query = useActiveQuests();
  const cache = useQueryClient();
  const heroQuery = useRuneDelveHero();
  const definitionsQuery = useQuestDefinitions();
  const { data: quests } = query;
  const claim = useClaimQuest();
  const claiming = useRef(false);
  const onClaim = async (quest: ActiveQuest) => {
    if (claiming.current) return;
    claiming.current = true;
    try {
      await claim.mutateAsync(quest);
    } catch {
      /* The mutation shows a retryable error. */
    } finally {
      claiming.current = false;
    }
  };
  const retry = () => {
    // Invalidate the dependent query; it resumes after prerequisite data loads.
    void cache.invalidateQueries({ queryKey: ["rd-active-quests"] });
    void heroQuery.refetch();
    void definitionsQuery.refetch();
  };
  const isLoading =
    heroQuery.isLoading || definitionsQuery.isLoading || query.isLoading;
  const isError =
    heroQuery.isError || definitionsQuery.isError || query.isError;

  const daily = (quests ?? []).filter((q) => q.scope === "daily");
  const weekly = (quests ?? []).filter((q) => q.scope === "weekly");

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <Link
          to="/rune-delve"
          aria-label="Back to sanctum"
          className="glass-card w-11 h-11 rounded-xl flex items-center justify-center btn-press"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="rd-title text-xl tracking-wide flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" /> Quests
          </h1>
          <p className="text-[11px] text-muted-foreground">
            Earn bonus shards by completing daily and weekly objectives.
          </p>
        </div>
      </div>

      {isError ? (
        <RuneDataState error onRetry={retry} />
      ) : isLoading ? (
        <RuneDataState label="Loading your quests…" onRetry={retry} />
      ) : !heroQuery.data ? (
        <Link to="/rune-delve" className="rd-primary-action">
          Create a hero to unlock quests
        </Link>
      ) : (
        <>
          <QuestSection
            scope="daily"
            title="Daily Quests"
            subtitle={`Resets midnight UTC · ${dailyPeriodKey()}`}
            quests={daily}
            onClaim={(q) => void onClaim(q)}
            claiming={claim.isPending}
          />
          <QuestSection
            scope="weekly"
            title="Weekly Quests"
            subtitle={`Resets Monday · ${weeklyPeriodKey()}`}
            quests={weekly}
            onClaim={(q) => void onClaim(q)}
            claiming={claim.isPending}
          />
        </>
      )}

      <div className="glass-card p-3 text-[11px] text-muted-foreground leading-relaxed">
        <p className="font-extrabold text-foreground/85 mb-1">How it works</p>
        <ul className="space-y-0.5 list-disc pl-4">
          <li>
            <span className="font-bold text-foreground/80">
              2 shared + 1 personal
            </span>{" "}
            quest at each scope.
          </li>
          <li>Progress is tracked automatically as you play.</li>
          <li>
            Tap <span className="font-bold text-accent">Claim</span> when
            complete to earn bonus 💎 shards.
          </li>
          <li>Unclaimed quests roll over until the next reset.</li>
        </ul>
      </div>
    </div>
  );
}

function QuestSection({
  scope,
  title,
  subtitle,
  quests,
  onClaim,
  claiming,
}: {
  scope: "daily" | "weekly";
  title: string;
  subtitle: string;
  quests: ActiveQuest[];
  onClaim: (q: ActiveQuest) => void;
  claiming: boolean;
}) {
  const Icon = scope === "daily" ? Calendar : Trophy;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center flex-wrap gap-2 mb-2 px-1">
        <Icon className="w-3.5 h-3.5 text-accent" />
        <h2 className="font-rd-display font-extrabold text-[12px] tracking-[0.18em] uppercase text-accent">
          {title}
        </h2>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums">
          {subtitle}
        </span>
      </div>
      <div className="space-y-2 rd-stagger">
        {quests.length === 0 ? (
          <div className="glass-card p-4 text-center text-[11px] text-muted-foreground">
            No active quests — check back next reset.
          </div>
        ) : (
          quests.map((q) => (
            <QuestCard
              key={q.id}
              quest={q}
              onClaim={onClaim}
              claiming={claiming}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}

function QuestCard({
  quest,
  onClaim,
  claiming,
}: {
  quest: ActiveQuest;
  onClaim: (q: ActiveQuest) => void;
  claiming: boolean;
}) {
  const def = quest.definition;
  if (!def) return null;
  const pct = Math.min(
    100,
    Math.round((quest.progress / quest.target_value) * 100),
  );
  const isComplete = quest.status === "completed";
  const isClaimed = quest.status === "claimed";
  const isPersonal = def.is_personal;

  return (
    <div
      className={cn(
        "glass-card p-3.5 relative overflow-hidden transition-all",
        isClaimed && "opacity-60",
      )}
      style={
        isComplete
          ? {
              background:
                "linear-gradient(135deg, hsl(var(--accent) / 0.14), hsl(var(--gold) / 0.08))",
              borderColor: "hsl(var(--accent) / 0.4)",
            }
          : undefined
      }
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <p className="font-extrabold text-[13px] truncate">{def.title}</p>
            {isPersonal && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/15 text-primary uppercase tracking-wider">
                Personal
              </span>
            )}
            {isClaimed && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider inline-flex items-center gap-1">
                <Check className="w-2.5 h-2.5" /> Claimed
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            {def.description}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p
            className="font-mono font-extrabold text-[13px] tabular-nums"
            style={{ color: "hsl(var(--gold))" }}
          >
            +{def.shard_reward} 💎
          </p>
          {def.xp_reward > 0 && (
            <p className="text-[10px] font-bold text-primary tabular-nums">
              +{def.xp_reward} XP
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${pct}%`,
              background: isComplete
                ? "linear-gradient(90deg, hsl(var(--accent)), hsl(var(--gold)))"
                : "hsl(var(--primary))",
            }}
          />
        </div>
        <span className="text-[10px] font-mono font-extrabold tabular-nums text-foreground/75 shrink-0">
          {quest.progress}/{quest.target_value}
        </span>
      </div>

      {isComplete && (
        <button
          onClick={() => onClaim(quest)}
          disabled={claiming}
          className="mt-2.5 w-full min-h-11 rounded-lg font-extrabold text-[12px] btn-press disabled:opacity-50"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--accent)), hsl(var(--gold)))",
            color: "hsl(var(--accent-foreground))",
            boxShadow: "var(--shadow-glow)",
          }}
        >
          {claiming ? "Claiming…" : `Claim +${def.shard_reward} 💎`}
        </button>
      )}
      {isClaimed && (
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-bold text-muted-foreground">
          <Lock className="w-2.5 h-2.5" /> Reward claimed · Resets next period
        </div>
      )}
    </div>
  );
}
