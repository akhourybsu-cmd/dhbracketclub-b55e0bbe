import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Flame,
  Pause,
  Play,
  Skull,
  Sparkles,
  Timer,
  Trophy,
} from "lucide-react";
import { useRuneDelveHero } from "@/hooks/useRuneDelveHero";
import { useMyDailyRun, useSubmitDailyRun } from "@/hooks/useDailyChallenge";
import { useAuth } from "@/contexts/AuthContext";
import {
  initialCombat,
  useAbility as castAbility,
} from "@/lib/runedelve/combatEngine";
import {
  ensurePlayableBoard,
  isValidChain,
  resolveBoard,
  type Cell,
} from "@/lib/runedelve/boardEngine";
import { generateBoard } from "@/lib/runedelve/dungeonGenerator";
import {
  ENDLESS_TIME_LIMIT_SEC,
  endlessScore,
  endlessStarsFor,
  enemyTickIntervalMs,
  spawnBatch,
  waveForElapsed,
} from "@/lib/runedelve/endlessMode";
import { mulberry32 } from "@/lib/runedelve/prng";
import {
  arenaStorageKey,
  parseArenaRun,
  previewArenaChain,
  type ArenaRun,
} from "@/lib/runedelve/arenaState";
import { RuneBoard } from "@/components/runedelve/RuneBoard";
import { EnemyDisplay } from "@/components/runedelve/EnemyDisplay";
import { HeroStatusBar } from "@/components/runedelve/HeroStatusBar";
import { CombatFeedback } from "@/components/runedelve/CombatFeedback";
import { ResonanceMeter } from "@/components/runedelve/ResonanceMeter";
import {
  RuneHeroArt,
  RUNE_PORTAL_ART,
} from "@/components/runedelve/RuneArtwork";
import { getClass } from "@/lib/runedelve/classConfig";

function readRun(key: string): ArenaRun | null {
  try {
    return parseArenaRun(sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

/** Timed daily arena: class-only combat with active-play time and a single atomic result receipt. */
export default function RuneDelveEndlessPage() {
  const { user } = useAuth();
  const heroQuery = useRuneDelveHero();
  const dailyQuery = useMyDailyRun();
  const submitDaily = useSubmitDailyRun();
  const saveDaily = submitDaily.mutateAsync;
  const key = user ? arenaStorageKey(user.id) : "";
  // Returning to the same account must not revive callbacks from its previous visit.
  const activeScope = useRef({ key });
  if (activeScope.current.key !== key) activeScope.current = { key };
  const scope = activeScope.current;
  const [run, setRun] = useState<ArenaRun | null>(null);
  const runRef = useRef<ArenaRun | null>(null);
  const lastTick = useRef(0);
  const busy = useRef(false);
  const autoSubmitted = useRef(false);
  const [inspecting, setInspecting] = useState(false);
  const inspectRef = useRef(false);
  const actionLock = useRef(false);
  const [saved, setSaved] = useState<Awaited<
    ReturnType<typeof submitDaily.mutateAsync>
  > | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [checkpointSaved, setCheckpointSaved] = useState(true);
  const hero = heroQuery.data;
  const cls = run?.cls ?? hero?.class ?? "warrior";
  const inspectChange = useCallback((open: boolean) => {
    inspectRef.current = open;
    lastTick.current = performance.now();
    setInspecting(open);
  }, []);

  const commit = useCallback(
    (next: ArenaRun | null) => {
      if (activeScope.current !== scope) return;
      const stamped = next ? { ...next, savedAt: Date.now() } : null;
      runRef.current = stamped;
      setRun(stamped);
      if (!key) return;
      try {
        if (stamped) sessionStorage.setItem(key, JSON.stringify(stamped));
        else sessionStorage.removeItem(key);
        setCheckpointSaved(true);
      } catch {
        setCheckpointSaved(false);
      }
    },
    [key, scope],
  );

  useEffect(() => {
    commit(key ? readRun(key) : null);
    autoSubmitted.current = false;
    busy.current = false;
    inspectRef.current = false;
    setInspecting(false);
    setSaving(false);
    setSaved(null);
    setSaveError(false);
  }, [key, commit]);

  const timerEnabled = !!run && !run.paused && !run.result;
  useEffect(() => {
    if (!timerEnabled) return;
    lastTick.current = performance.now();
    const timer = window.setInterval(() => {
      const current = runRef.current;
      const now = performance.now();
      if (
        !current ||
        current.paused ||
        current.result ||
        inspectRef.current ||
        activeScope.current !== scope
      ) {
        lastTick.current = now;
        return;
      }
      const elapsed = Math.min(
        ENDLESS_TIME_LIMIT_SEC,
        current.elapsed + Math.min(1, (now - lastTick.current) / 1000),
      );
      lastTick.current = now;
      const next = { ...current, elapsed };
      if (elapsed >= ENDLESS_TIME_LIMIT_SEC) {
        next.result = {
          reason: "timeout",
          kills: next.combat.enemiesDefeated,
          score: endlessScore(
            next.combat.enemiesDefeated,
            next.combat.totalDamage,
          ),
        };
      } else if (
        elapsed >= current.attackAt &&
        current.combat.enemies.some((e) => e.hp > 0)
      ) {
        // Arena enemies have one readable real-time attack; terrain abilities belong to campaign/Expedition.
        const incoming = current.combat.enemies
          .filter((e) => e.hp > 0)
          .reduce((sum, e) => sum + e.damage, 0);
        const damage =
          current.combat.shieldTurns > 0
            ? Math.round(incoming * 0.4)
            : incoming;
        next.combat = {
          ...current.combat,
          hp: Math.max(0, current.combat.hp - damage),
          shieldTurns: Math.max(0, current.combat.shieldTurns - 1),
        };
        next.attackAt = elapsed + enemyTickIntervalMs(elapsed) / 1000;
        if (next.combat.hp <= 0)
          next.result = {
            reason: "defeated",
            kills: next.combat.enemiesDefeated,
            score: endlessScore(
              next.combat.enemiesDefeated,
              next.combat.totalDamage,
            ),
          };
      }
      if (!next.result && next.combat.enemies.every((e) => e.hp <= 0)) {
        if (next.spawnAt === null)
          next.spawnAt =
            elapsed + waveForElapsed(elapsed).respawnDelayMs / 1000;
        else if (elapsed >= next.spawnAt) {
          next.tick += 1;
          next.combat = {
            ...next.combat,
            enemies: spawnBatch(elapsed, next.seed ^ next.tick).map((e) => ({
              ...e,
              ability: undefined,
              abilityCooldown: undefined,
              abilityCooldownMax: undefined,
              telegraphLabel: undefined,
            })),
          };
          next.spawnAt = null;
          next.attackAt = elapsed + enemyTickIntervalMs(elapsed) / 1000;
        }
      }
      commit(next);
    }, 100);
    const pause = () => {
      if (runRef.current && !runRef.current.result)
        commit({ ...runRef.current, paused: true });
    };
    const onHide = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("rune-delve:pause", pause);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("rune-delve:pause", pause);
    };
  }, [timerEnabled, commit, scope]);

  const saveResult = useCallback(async () => {
    const current = runRef.current;
    if (!current?.result || busy.current) return;
    busy.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      const receipt = await saveDaily({
        kills: current.result.kills,
        score: current.result.score,
        heroClass: current.cls,
        requestId: current.requestId,
      });
      if (activeScope.current !== scope) return;
      setSaved(receipt);
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* optional */
      }
    } catch {
      if (activeScope.current === scope) setSaveError(true);
    } finally {
      if (activeScope.current === scope) {
        busy.current = false;
        setSaving(false);
      }
    }
  }, [key, saveDaily, scope]);

  useEffect(() => {
    if (run?.result && runRef.current === run && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void saveResult();
    }
  }, [run, saveResult]);

  function start() {
    if (
      !hero ||
      runRef.current ||
      dailyQuery.isLoading ||
      dailyQuery.isError ||
      dailyQuery.data
    )
      return;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const rng = mulberry32(seed);
    const grid = ensurePlayableBoard(generateBoard(rng), rng).grid;
    const enemies = spawnBatch(0, seed).map((e) => ({
      ...e,
      ability: undefined,
      abilityCooldown: undefined,
      abilityCooldownMax: undefined,
      telegraphLabel: undefined,
    }));
    commit({
      version: 1,
      requestId: crypto.randomUUID(),
      savedAt: Date.now(),
      cls: hero.class,
      seed,
      tick: 0,
      grid,
      combat: initialCombat(enemies, 9999),
      elapsed: 0,
      attackAt: enemyTickIntervalMs(0) / 1000,
      spawnAt: null,
      paused: false,
      result: null,
    });
  }
  function chainAction(chain: Cell[]) {
    const current = runRef.current;
    if (
      !current ||
      current.paused ||
      current.result ||
      inspectRef.current ||
      actionLock.current ||
      !isValidChain(current.grid, chain)
    )
      return;
    const type = current.grid[chain[0].r][chain[0].c];
    actionLock.current = true;
    requestAnimationFrame(() => {
      actionLock.current = false;
    });
    const next = previewArenaChain(current, type, chain.length).next;
    const rng = mulberry32(current.seed ^ (current.tick + 1));
    commit({
      ...current,
      tick: current.tick + 1,
      combat: next,
      grid: ensurePlayableBoard(resolveBoard(current.grid, chain, rng), rng)
        .grid,
    });
  }
  function abilityAction() {
    const current = runRef.current;
    if (
      !current ||
      current.paused ||
      current.result ||
      inspectRef.current ||
      actionLock.current
    )
      return;
    actionLock.current = true;
    requestAnimationFrame(() => {
      actionLock.current = false;
    });
    const { next, ok } = castAbility(current.combat, current.cls);
    if (ok) commit({ ...current, combat: next });
  }

  if (heroQuery.isError || dailyQuery.isError)
    return (
      <div className="rd-load-error" role="alert">
        <p>The arena couldn’t connect.</p>
        <button
          onClick={() => {
            void heroQuery.refetch();
            void dailyQuery.refetch();
          }}
        >
          Try again
        </button>
      </div>
    );
  if (heroQuery.isLoading || dailyQuery.isLoading)
    return (
      <div className="rd-load-error">
        <Sparkles className="animate-pulse" />
        <p>Preparing the arena…</p>
        <button
          onClick={() => {
            void heroQuery.refetch();
            void dailyQuery.refetch();
          }}
        >
          Reconnect
        </button>
      </div>
    );
  if (!hero)
    return (
      <div className="rd-load-error">
        <p>Choose a hero to enter.</p>
        <Link className="rd-primary-action" to="/rune-delve">
          Create hero
        </Link>
      </div>
    );

  const remaining = Math.max(
    0,
    ENDLESS_TIME_LIMIT_SEC - Math.floor(run?.elapsed ?? 0),
  );
  const wave = waveForElapsed(run?.elapsed ?? 0);
  return (
    <section className="rd-arena space-y-3 pb-3" data-testid="rune-arena">
      {!run && (
        <>
          <div className="rd-sanctum" style={{ minHeight: 280 }}>
            <img src={RUNE_PORTAL_ART} alt="" />
            <div className="rd-sanctum-copy">
              <p className="rd-eyebrow">
                <Flame size={13} /> Daily arena
              </p>
              <h1>
                Two minutes.
                <br />
                Every rune counts.
              </h1>
              <p>Pure class combat. No relic or mastery advantage.</p>
              {dailyQuery.data ? (
                <Link to="/rune-delve/daily" className="rd-primary-action">
                  <Trophy />
                  Today’s result
                </Link>
              ) : (
                <button className="rd-primary-action btn-press" onClick={start}>
                  <Play />
                  Begin arena
                </button>
              )}
            </div>
          </div>
          <div className="rd-class-info">
            <span className="h-12 w-12 rounded-xl overflow-hidden">
              <RuneHeroArt cls={cls} />
            </span>
            <div>
              <strong>{getClass(cls).name}</strong>
              <small>
                Chain to act. Enemies strike on a timer. Backgrounding pauses.
              </small>
            </div>
          </div>
        </>
      )}
      {run && !run.result && (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Flame size={16} className="text-gold" />
            <span className="flex-1 text-xs font-bold">
              {wave.label} · {run.combat.enemiesDefeated} slain
            </span>
            <Timer size={14} />
            <span className="font-mono text-sm tabular-nums">
              {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, "0")}
            </span>
            <button
              className="min-h-11 min-w-11 grid place-items-center"
              aria-label={run.paused ? "Resume arena" : "Pause arena"}
              onClick={() => commit({ ...run, paused: !run.paused })}
            >
              {run.paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
          </div>
          {run.paused ? (
            <div className="rd-load-error">
              <Pause />
              <p>
                {checkpointSaved
                  ? "Arena paused · your run is saved."
                  : "Arena paused · keep this page open to retain your run."}
              </p>
              <button onClick={() => commit({ ...run, paused: false })}>
                Resume arena
              </button>
            </div>
          ) : (
            <div className="rd-battle-layout">
              <CombatFeedback
                className="rd-battle-stage"
                state={run.combat}
                cls={cls}
                scope={run.requestId}
                disabled={inspecting}
              >
                <EnemyDisplay
                  enemies={run.combat.enemies}
                  onInspectChange={inspectChange}
                />
                <HeroStatusBar
                  state={run.combat}
                  cls={cls}
                  onAbility={abilityAction}
                  disabled={inspecting}
                />
                <ResonanceMeter state={run.combat} />
                <div
                  className="h-1 rounded bg-muted overflow-hidden"
                  aria-label="Next enemy strike"
                >
                  <div
                    className="h-full bg-destructive"
                    style={{
                      width: `${Math.max(0, Math.min(100, (1 - (run.attackAt - run.elapsed) / (enemyTickIntervalMs(run.elapsed) / 1000)) * 100))}%`,
                    }}
                  />
                </div>
              </CombatFeedback>
              <RuneBoard
                grid={run.grid}
                onChainComplete={chainAction}
                disabled={inspecting}
                effectOverride={{
                  red: (n) => previewArenaChain(run, "red", n).text,
                  blue: (n) => previewArenaChain(run, "blue", n).text,
                  green: (n) => previewArenaChain(run, "green", n).text,
                  gold: (n) => previewArenaChain(run, "gold", n).text,
                }}
              />
            </div>
          )}
        </>
      )}
      {run?.result && (
        <div className="glass-card p-5 space-y-4 text-center">
          <p className="rd-eyebrow justify-center">
            {run.result.reason === "defeated" ? (
              <Skull size={14} />
            ) : (
              <Timer size={14} />
            )}
            Arena complete
          </p>
          <h1 className="rd-title text-3xl text-gold">
            {"★".repeat(endlessStarsFor(run.result.kills))}
            {"☆".repeat(3 - endlessStarsFor(run.result.kills))}
          </h1>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted p-3">
              <strong className="block text-2xl">{run.result.kills}</strong>
              <small>Enemies slain</small>
            </div>
            <div className="rounded-xl bg-muted p-3">
              <strong className="block text-2xl">
                {run.result.score.toLocaleString()}
              </strong>
              <small>Score</small>
            </div>
          </div>
          {saving ? (
            <p className="text-xs text-muted-foreground">Saving your result…</p>
          ) : saveError ? (
            <div role="alert">
              <p className="text-xs mb-2">
                {checkpointSaved
                  ? "Your result is safe on this device. Reconnect to bank it."
                  : "Keep this page open. Reconnect to bank your result."}
              </p>
              <button
                onClick={() => void saveResult()}
                className="rd-primary-action"
              >
                Retry save
              </button>
            </div>
          ) : saved ? (
            <p className="text-sm text-primary">
              {saved.rewarded
                ? `+${saved.reward.shards} shards · +${saved.reward.xp} XP`
                : "Daily result confirmed · reward already claimed"}
            </p>
          ) : null}
          <Link className="rd-primary-action" to="/rune-delve/daily">
            Return to daily arena
          </Link>
        </div>
      )}
      {run && !saved && !checkpointSaved && (
        <p
          className="rounded-xl border border-gold/40 bg-gold/10 p-3 text-xs text-gold"
          role="status"
        >
          Device storage is unavailable. Keep this page open to retain your
          current board.
        </p>
      )}
    </section>
  );
}
