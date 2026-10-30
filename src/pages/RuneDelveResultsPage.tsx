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
import { RuneMenuSigil } from "@/components/runedelve/RuneMenuSigil";
import { starsFor } from "@/lib/runedelve/levelGenerator";
import { readRuneResult } from "@/lib/runedelve/resultSnapshot";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { CountUp } from "@/components/runedelve/fx/CountUp";
import { useRuneDelveSfx } from "@/hooks/useRuneDelveSfx";
import { useReducedMotion, motion } from "framer-motion";
import { RunePager } from "@/components/runedelve/RunePager";
import { useRuneViewport } from "@/hooks/useRuneViewport";
import "@/components/runedelve/runeMenus.css";
import "@/components/runedelve/runeMapResults.css";

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
  const [view, setView] = useState<"summary" | "stats" | "records">("summary");
  const [recordAnchor, setRecordAnchor] = useState(0);
  const viewport = useRuneViewport();
  const recordPageSize = viewport.landscape ? 1 : viewport.short ? 2 : 5;
  const recordPageCount = Math.max(
    1,
    Math.ceil((topRuns?.length ?? 0) / recordPageSize),
  );
  const visibleRecordPage = Math.min(
    Math.floor(recordAnchor / recordPageSize),
    recordPageCount - 1,
  );
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
      <div className="rd-menu-surface rd-results-empty">
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

  const views = ["summary", "stats", "records"] as const;
  return (
    <div
      className="rd-menu-page rd-results-page rd-results-screen"
      data-cleared={cleared}
      data-short={viewport.short}
      data-landscape={viewport.landscape}
    >
      <Confetti active={showConfetti} />
      <section className="rd-menu-surface rd-result-hero rd-result-heading">
        <p className="rd-result-context">
          {latest ? "Run complete" : "Personal record"} · Chamber {levelNumber}
        </p>
        <motion.div
          initial={reducedMotion ? false : { scale: 0.6, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 18 }}
          className="rd-result-seal"
          aria-hidden="true"
        >
          <RuneMenuSigil />
          {cleared ? (
            <Trophy strokeWidth={1.3} />
          ) : result.hp <= 0 ? (
            <Skull strokeWidth={1.3} />
          ) : (
            <Clock strokeWidth={1.3} />
          )}
        </motion.div>
        <h1 className="rd-title">
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
          className="rd-result-score font-mono"
        />
        <span className="rd-result-score-label">Score</span>
      </section>
      <div
        role="tablist"
        aria-label="Result view"
        className="rd-menu-tabs rd-result-tabs"
        onKeyDown={(event) => {
          const current = views.indexOf(view);
          const next =
            event.key === "ArrowRight"
              ? (current + 1) % views.length
              : event.key === "ArrowLeft"
                ? (current + views.length - 1) % views.length
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? views.length - 1
                    : -1;
          if (next < 0) return;
          event.preventDefault();
          setView(views[next]);
          event.currentTarget
            .querySelector<HTMLButtonElement>(`#rd-result-tab-${views[next]}`)
            ?.focus();
        }}
      >
        {views.map((tab) => (
          <button
            key={tab}
            id={`rd-result-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={view === tab}
            aria-controls="rd-result-panel"
            tabIndex={view === tab ? 0 : -1}
            onClick={() => setView(tab)}
          >
            {tab === "summary"
              ? `This ${latest ? "run" : "record"}`
              : tab === "stats"
                ? "Stats"
                : "Records"}
          </button>
        ))}
      </div>
      <div
        id="rd-result-panel"
        role="tabpanel"
        aria-labelledby={`rd-result-tab-${view}`}
        className="rd-result-panel"
        data-view={view}
      >
        {view === "summary" && (
          <section className="rd-menu-surface rd-result-summary">
            {cleared && (
              <div
                className="rd-result-stars"
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
                      className={star <= stars ? "fill-current" : "opacity-25"}
                    />
                  </motion.div>
                ))}
              </div>
            )}
            {latest ? (
              <div className="rd-result-rewards">
                <span>
                  <Gem /> +{latest.shardsAwarded} shards
                </span>
                <span>+{latest.xpEarned} XP</span>
              </div>
            ) : (
              <p className="rd-menu-note">
                Your best saved {hero.class} run in this chamber.
              </p>
            )}
            {latest && (
              <div className="rd-result-records">
                {latest.wasNewBest && <span>New personal best</span>}
                {latest.firstClear && <span>First clear</span>}
                {latest.improvedChain && (
                  <span>Longest chain · {latest.longestChain}</span>
                )}
                {latest.improvedTurns && (
                  <span>Fastest clear · {latest.turnsUsed} moves</span>
                )}
              </div>
            )}
            {nearMiss && (
              <p className="rd-menu-note">
                You dealt {Math.round((result.damage / totalHp) * 100)}% of
                their health. A different relic could turn the tide.
              </p>
            )}
            {!cleared && !nearMiss && (
              <p className="rd-menu-note">
                Refine your loadout, then return to the chamber.
              </p>
            )}
          </section>
        )}
        {view === "stats" && (
          <div className="rd-result-stats">
            {stats.map(({ label, value, Icon }) => (
              <div key={label} className="rd-menu-surface">
                <Icon aria-hidden="true" />
                <strong className="font-mono">{value.toLocaleString()}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}
        {view === "records" && (
          <div className="rd-result-record-page">
            {run && (
              <section
                className="rd-menu-surface rd-result-personal"
                aria-label={`Your ${hero.class} record`}
              >
                <h2>Your {hero.class} record</h2>
                <dl>
                  <div>
                    <dt>Score</dt>
                    <dd>{run.score.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Chain</dt>
                    <dd>{run.longest_chain}</dd>
                  </div>
                  <div>
                    <dt>Fastest clear</dt>
                    <dd>{run.best_turns_used ?? "—"}</dd>
                  </div>
                </dl>
              </section>
            )}
            <section className="rd-menu-surface rd-result-club">
              <h2>
                <Trophy aria-hidden="true" /> Club records
              </h2>
              {topRuns?.length ? (
                <ol start={visibleRecordPage * recordPageSize + 1}>
                  {topRuns
                    .slice(
                      visibleRecordPage * recordPageSize,
                      (visibleRecordPage + 1) * recordPageSize,
                    )
                    .map((record) => (
                      <li key={record.id}>
                        <span className="rd-result-rank">{record.rank}</span>
                        <span className="rd-result-name">
                          {record.hero?.hero_name ?? "Hero"}
                        </span>
                        <strong>{record.score.toLocaleString()}</strong>
                      </li>
                    ))}
                </ol>
              ) : (
                <p className="rd-menu-note">Be the first to leave your mark.</p>
              )}
            </section>
            <RunePager
              page={visibleRecordPage}
              pageCount={recordPageCount}
              onPageChange={(next) => setRecordAnchor(next * recordPageSize)}
              label="Club records"
            />
          </div>
        )}
      </div>
      <div className="rd-result-actions rd-result-footer">
        <Link to="/rune-delve/armory" aria-label="Refine your loadout">
          <Shield aria-hidden="true" /> Armory
        </Link>
        <button
          type="button"
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
            Next chamber <ChevronRight aria-hidden="true" />
          </button>
        ) : (
          <Link
            to={cleared ? "/rune-delve/levels" : "/rune-delve/armory"}
            className="bg-primary text-primary-foreground"
          >
            {cleared ? "Dungeon" : "Tune build"}{" "}
            <ChevronRight aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
