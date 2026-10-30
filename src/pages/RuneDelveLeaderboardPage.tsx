import { Link } from "react-router-dom";
import { Flame } from "lucide-react";
import { useCampaignLeaderboard } from "@/hooks/useRuneDelveCampaign";
import { useAuth } from "@/contexts/AuthContext";
import { ClassBadge } from "@/components/runedelve/ClassBadge";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import { cn } from "@/lib/utils";
import { RuneDataState } from "@/components/runedelve/RuneDataState";

export default function RuneDelveLeaderboardPage() {
  const { user } = useAuth();
  const query = useCampaignLeaderboard();
  const { data: rows, isLoading } = query;

  return (
    <div className="space-y-4 pb-8">
      <div className="space-y-1">
        <h1 className="rd-title page-header-title text-2xl">
          Campaign Leaders
        </h1>
        <p className="text-[12px] text-foreground/80">
          Ranked by highest level cleared, then total levels cleared.
        </p>
      </div>

      {isLoading ? (
        <RuneDataState
          label="Loading campaign standings…"
          onRetry={() => void query.refetch()}
        />
      ) : query.isError ? (
        <RuneDataState error onRetry={() => void query.refetch()} />
      ) : (rows ?? []).length === 0 ? (
        <div className="glass-card p-6 text-center text-xs text-muted-foreground">
          No heroes have delved yet — be the first!
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="divide-y divide-border/10 rd-stagger">
            {(rows ?? []).map((r) => {
              const isMe = r.user_id === user?.id;
              const heroName = r.hero?.hero_name as string | undefined;
              const title = r.hero?.cosmetic_title as string | undefined;
              const lvl = r.hero?.level as number | undefined;
              return (
                <div
                  key={r.id}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-3",
                    isMe && "bg-primary/5 border-l-2 border-l-primary",
                  )}
                >
                  <span className="w-6 font-mono font-extrabold text-sm tabular-nums text-muted-foreground">
                    #{r.rank}
                  </span>
                  {r.hero?.class && (
                    <ClassBadge cls={r.hero.class as HeroClass} size="sm" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-rd-display text-[14px] font-extrabold truncate tracking-wide">
                      {heroName ?? r.profile.display_name}
                      {isMe && (
                        <span className="text-[10px] text-primary ml-1 font-sans">
                          (you)
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-foreground/75 truncate">
                      {lvl ? (
                        <span className="font-extrabold">Lv {lvl}</span>
                      ) : null}
                      {title ? (
                        <>
                          <span>·</span>
                          <span className="text-primary/80 font-bold truncate">
                            {title}
                          </span>
                        </>
                      ) : null}
                      <span>·</span>
                      <span>{r.total_levels_cleared} cleared</span>
                      {r.hero?.current_streak ? (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-0.5">
                            <Flame className="w-3 h-3 text-gold" />
                            {r.hero.current_streak}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                      Highest
                    </p>
                    <p
                      className="font-mono text-base font-extrabold tabular-nums"
                      style={{ color: "hsl(var(--gold))" }}
                    >
                      L{r.highest_completed_level}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
