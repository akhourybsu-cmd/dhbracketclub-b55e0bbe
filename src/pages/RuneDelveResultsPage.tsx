import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Trophy,
  Swords,
  Heart,
  Clock,
  Sparkles,
  ChevronRight,
  Star,
  Shield,
  RefreshCw,
  Skull,
  Gem,
} from "lucide-react";
import {
  useLevel,
  useMyLevelRun,
  useLevelBestScores,
  useMyProgress,
} from "@/hooks/useRuneDelveCampaign";
import { useRuneDelveHero } from "@/hooks/useRuneDelveHero";
import { Confetti } from "@/components/Confetti";
import { RuneDataState } from "@/components/runedelve/RuneDataState";
import { starsFor } from "@/lib/runedelve/levelGenerator";
import { readRuneResult } from "@/lib/runedelve/resultSnapshot";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { CountUp } from "@/components/runedelve/fx/CountUp";
import { useRuneDelveSfx } from "@/hooks/useRuneDelveSfx";
import { useReducedMotion, motion } from "framer-motion";
import "@/components/runedelve/runeMenus.css";

export default function RuneDelveResultsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { levelNumber: levelParam } = useParams<{ levelNumber: string }>();
  const levelNumber = Math.max(1, parseInt(levelParam ?? "1", 10) || 1);
  const levelQuery = useLevel(levelNumber);
  const heroQuery = useRuneDelveHero();
  const { data: level } = levelQuery;
  const { data: hero } = heroQuery;
  const runQuery = useMyLevelRun(level?.id, levelNumber, hero?.class);
  const { data: run } = runQuery;
  const { data: progress } = useMyProgress(hero?.class);
  const { data: topRuns } = useLevelBestScores(level?.id);
  const latest = useMemo(
    () =>
      user?.id && hero?.class
        ? readRuneResult(user.id, hero.class, levelNumber)
        : null,
    [user?.id, hero?.class, levelNumber],
  );
  const [view, setView] = useState<"summary" | "records">("summary");
  const [showConfetti, setShowConfetti] = useState(false);
  const [graceElapsed, setGraceElapsed] = useState(false);
  const reducedMotion = useReducedMotion();
  const { play: rdSfx } = useRuneDelveSfx();
  const cleared = latest?.dungeonCleared ?? run?.dungeon_cleared ?? false;

  useEffect(() => {
    setGraceElapsed(false);
    const timer = window.setTimeout(() => setGraceElapsed(true), 1800);
    return () => window.clearTimeout(timer);
  }, [levelNumber, hero?.class]);
  useEffect(() => {
    if (!run && !latest) return;
    rdSfx(cleared ? "victory" : "defeat");
    if (cleared && !reducedMotion) {
      setShowConfetti(true);
      const timer = window.setTimeout(() => setShowConfetti(false), 2400);
      return () => window.clearTimeout(timer);
    }
    // The result identity is stable; refetching best records must not replay FX.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.ts, !!run, cleared, reducedMotion]);

  const queries = [levelQuery, heroQuery, runQuery];
  const retry = () => queries.forEach((query) => void query.refetch());
  if (!level || !hero || (!run && !latest)) {
    if (queries.some((query) => query.isError))
      return <RuneDataState error onRetry={retry} />;
    if (
      !graceElapsed ||
      queries.some((query) => query.isLoading || query.isFetching)
    )
      return <RuneDataState onRetry={retry} />;
    return (
      <div className="rd-menu-surface py-10 text-center space-y-3">
        <RefreshCw className="h-8 w-8 mx-auto text-primary" />
        <h1 className="rd-title text-xl">No saved run yet</h1>
        <p className="rd-menu-note">Retry loading or return to the dungeon.</p>
        <div className="flex gap-2 justify-center">
          <button type="button" onClick={retry} className="rd-menu-link">
            Retry
          </button>
          <Link to="/rune-delve/levels" className="rd-menu-link">
            Dungeon
          </Link>
        </div>
      </div>
    );
  }

  const result = latest
    ? {
        score: latest.score,
        damage: latest.totalDamage,
        kills: latest.enemiesDefeated,
        hp: latest.hpRemaining,
        turns: latest.turnsUsed,
        chain: latest.longestChain,
        xp: latest.xpEarned,
      }
    : {
        score: run!.score,
        damage: run!.total_damage,
        kills: run!.enemies_defeated,
        hp: run!.hp_remaining,
        turns: run!.turns_used,
        chain: run!.longest_chain,
        xp: run!.xp_earned,
      };
  const stars = starsFor(result.score, levelNumber, cleared);
  const nextUnlocked =
    (progress?.highest_unlocked_level ?? 1) >= levelNumber + 1;
  const totalHp = level.enemy_config.reduce(
    (sum, enemy) => sum + (enemy.maxHp ?? enemy.hp ?? 0),
    0,
  );
  const nearMiss = !cleared && totalHp > 0 && result.damage / totalHp >= 0.6;
  const stats = [
    { label: "Damage", value: result.damage, Icon: Swords },
    { label: "Defeated", value: result.kills, Icon: Skull },
    { label: "Health", value: result.hp, Icon: Heart },
    { label: "Turns", value: result.turns, Icon: Clock },
    { label: "Best chain", value: result.chain, Icon: Sparkles },
    { label: latest ? "XP gained" : "Best XP", value: result.xp, Icon: Gem },
  ];

  return (
    <div className="space-y-4 pb-3">
      <Confetti active={showConfetti} />
      <section
        className="rd-menu-surface text-center !py-6 relative overflow-hidden"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, hsl(var(--${cleared ? "gold" : "primary"}) / .18), transparent 75%), hsl(var(--card))`,
        }}
      >
        <p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-muted-foreground mb-3">
          {latest ? "Run complete" : "Personal record"} · Chamber {levelNumber}
        </p>
        <motion.div
          initial={reducedMotion ? false : { scale: 0.6, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          className="h-20 w-20 rounded-3xl border mx-auto mb-3 grid place-items-center"
          style={{
            background: `hsl(var(--${cleared ? "gold" : "primary"}) / .12)`,
            borderColor: `hsl(var(--${cleared ? "gold" : "primary"}) / .25)`,
          }}
        >
          {cleared ? (
            <Trophy className="h-10 w-10 text-gold" strokeWidth={1.3} />
          ) : result.hp <= 0 ? (
            <Skull className="h-10 w-10 text-primary" strokeWidth={1.3} />
          ) : (
            <Clock className="h-10 w-10 text-primary" strokeWidth={1.3} />
          )}
        </motion.div>
        <h1 className="rd-title text-2xl">
          {cleared
            ? "Chamber conquered"
            : result.hp <= 0
              ? "Fallen, not finished"
              : "Out of moves"}
        </h1>
        <CountUp
          value={result.score}
          duration={reducedMotion ? 0 : 900}
          format={(n) => n.toLocaleString()}
          className="block font-mono text-4xl font-black tabular-nums text-gold mt-2"
        />
        <p className="text-[9px] font-bold tracking-widest text-muted-foreground mt-1">
          SCORE
        </p>
        {cleared && (
          <div
            className="flex justify-center gap-2 mt-4"
            aria-label={`${stars} of 3 stars`}
          >
            {[1, 2, 3].map((star) => (
              <motion.div
                key={star}
                initial={reducedMotion ? false : { opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: reducedMotion ? 0 : 0.3 + star * 0.15,
                  type: "spring",
                }}
              >
                <Star
                  className={`h-7 w-7 text-gold ${star <= stars ? "fill-current" : "opacity-25"}`}
                />
              </motion.div>
            ))}
          </div>
        )}
        {latest && (
          <div className="flex items-center justify-center gap-4 mt-4 text-xs font-extrabold">
            <span className="flex items-center gap-1.5 text-primary">
              <Gem className="h-4 w-4" />+{latest.shardsAwarded} shards
            </span>
            <span className="text-muted-foreground">+{latest.xpEarned} XP</span>
          </div>
        )}
        {latest?.wasNewBest && (
          <p className="mt-3 text-[10px] font-extrabold text-gold uppercase tracking-widest">
            New personal best
          </p>
        )}
      </section>
      {latest && (
        <div className="flex flex-wrap gap-2">
          {latest.firstClear && (
            <span className="rounded-full px-3 py-1.5 text-[10px] font-bold bg-gold/10 text-gold">
              First clear
            </span>
          )}
          {latest.improvedChain && (
            <span className="rounded-full px-3 py-1.5 text-[10px] font-bold bg-primary/10 text-primary">
              Longest chain · {latest.longestChain}
            </span>
          )}
          {latest.improvedTurns && (
            <span className="rounded-full px-3 py-1.5 text-[10px] font-bold bg-primary/10 text-primary">
              Fastest clear · {latest.turnsUsed} moves
            </span>
          )}
        </div>
      )}
      <div
        role="tablist"
        aria-label="Result view"
        className="rd-menu-tabs grid-cols-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === "summary"}
          onClick={() => setView("summary")}
        >
          This {latest ? "run" : "record"}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "records"}
          onClick={() => setView("records")}
        >
          Records
        </button>
      </div>
      {view === "summary" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {stats.map(({ label, value, Icon }) => (
              <div key={label} className="rd-menu-surface !p-3 text-center">
                <Icon className="h-4 w-4 text-primary mx-auto mb-1.5" />
                <strong className="font-mono text-lg tabular-nums block">
                  {value.toLocaleString()}
                </strong>
                <span className="text-[9px] font-bold text-muted-foreground">
                  {label}
                </span>
              </div>
            ))}
          </div>
          {nearMiss && (
            <p className="rd-menu-note text-center">
              You dealt {Math.round((result.damage / totalHp) * 100)}% of their
              health. A different relic could turn the tide.
            </p>
          )}
          <Link to="/rune-delve/armory" className="rd-menu-link w-full">
            <Shield className="h-4 w-4 text-primary" /> Refine your loadout{" "}
            <ChevronRight className="h-4 w-4 ml-auto" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {run && (
            <section className="rd-menu-surface">
              <h2 className="text-xs font-extrabold mb-3">
                Your {hero.class} record
              </h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <strong className="block text-base font-mono text-gold">
                    {run.score.toLocaleString()}
                  </strong>
                  <span className="text-[9px] text-muted-foreground">
                    Score
                  </span>
                </div>
                <div>
                  <strong className="block text-base font-mono">
                    {run.longest_chain}
                  </strong>
                  <span className="text-[9px] text-muted-foreground">
                    Chain
                  </span>
                </div>
                <div>
                  <strong className="block text-base font-mono">
                    {run.best_turns_used ?? "—"}
                  </strong>
                  <span className="text-[9px] text-muted-foreground">
                    Fastest clear
                  </span>
                </div>
              </div>
            </section>
          )}
          <section className="rd-menu-surface">
            <h2 className="text-xs font-extrabold mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" /> Club records
            </h2>
            {topRuns?.length ? (
              <div className="space-y-3">
                {topRuns.slice(0, 5).map((record) => (
                  <div
                    key={record.id}
                    className="flex gap-2 items-center text-xs"
                  >
                    <span className="text-muted-foreground w-5 font-mono">
                      {record.rank}
                    </span>
                    <span className="truncate flex-1 font-bold">
                      {record.hero?.hero_name ?? "Hero"}
                    </span>
                    <strong className="font-mono text-gold">
                      {record.score.toLocaleString()}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rd-menu-note">Be the first to leave your mark.</p>
            )}
          </section>
        </div>
      )}
      <div className="rd-result-actions">
        <button
          type="button"
          className="bg-muted/40"
          onClick={() => navigate(`/rune-delve/play/${levelNumber}`)}
        >
          Play again
        </button>
        {cleared && nextUnlocked ? (
          <button
            type="button"
            className="bg-primary text-primary-foreground"
            onClick={() => navigate(`/rune-delve/play/${levelNumber + 1}`)}
          >
            Next chamber <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <Link
            to={cleared ? "/rune-delve/levels" : "/rune-delve/armory"}
            className="bg-primary text-primary-foreground"
          >
            {cleared ? "Dungeon" : "Tune build"}{" "}
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
