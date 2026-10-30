import { progressionRewardItems } from "@/lib/runedelve/rewardPresentation";
import { useRuneRewardReveal } from "@/hooks/useRuneRewardReveal";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Crown,
  Droplet,
  Feather,
  Flame,
  Gem,
  Heart,
  Hourglass,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Sun,
  Sword,
  Swords,
  Trophy,
  Wind,
  X,
  Zap,
} from "lucide-react";
import {
  useRuneExpedition,
  type ExpeditionReceipt,
} from "@/hooks/useRuneExpedition";
import { useRuneDelveHero } from "@/hooks/useRuneDelveHero";
import {
  CLASS_LIST,
  getClass,
  type HeroClass,
} from "@/lib/runedelve/classConfig";
import {
  EXPEDITION_ASCENSIONS,
  EXPEDITION_BOONS,
  EXPEDITION_ROUTES,
  chooseExpeditionBoon,
  chooseExpeditionRoute,
  clearExpedition,
  createExpedition,
  expeditionAbility,
  expeditionBoonChoices,
  expeditionBoonDescription,
  expeditionBoonGain,
  expeditionChain,
  expeditionReward,
  expeditionRouteChoices,
  expeditionStorageKey,
  loadExpedition,
  previewExpeditionChain,
  saveExpedition,
  type ExpeditionBoon,
  type ExpeditionRun,
} from "@/lib/runedelve/expedition";
import type { Cell } from "@/lib/runedelve/boardEngine";
import { RuneBoard } from "@/components/runedelve/RuneBoard";
import { EnemyDisplay } from "@/components/runedelve/EnemyDisplay";
import { HeroStatusBar } from "@/components/runedelve/HeroStatusBar";
import { CombatFeedback } from "@/components/runedelve/CombatFeedback";
import { ResonanceMeter } from "@/components/runedelve/ResonanceMeter";
import { RunePager } from "@/components/runedelve/RunePager";
import { useRuneViewport } from "@/hooks/useRuneViewport";
import {
  RuneHeroArt,
  RUNE_PORTAL_ART,
} from "@/components/runedelve/RuneArtwork";
import { cn } from "@/lib/utils";
import "@/components/runedelve/expedition.css";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  sword: Sword,
  zap: Zap,
  heart: Heart,
  shield: Shield,
  droplet: Droplet,
  sun: Sun,
  wind: Wind,
  sparkles: Sparkles,
  crown: Crown,
  flame: Flame,
  feather: Feather,
  hourglass: Hourglass,
  skull: Skull,
  swords: Swords,
  gem: Gem,
};
function BoonIcon({
  boon,
  className,
}: {
  boon: ExpeditionBoon;
  className?: string;
}) {
  const Icon = ICONS[boon.icon] ?? Sparkles;
  return <Icon className={className} />;
}
function ExpeditionDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="rd-exp-dialog-backdrop" />
        <DialogPrimitive.Content
          className="rd-mode rd-dialog-theme rd-exp-modal rd-exp-dialog"

          aria-describedby={undefined}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
function RoomTrail({ run }: { run: ExpeditionRun }) {
  return (
    <div
      className="rd-exp-trail"
      aria-label={`Chamber ${run.room} of 6 · ${run.roomsCleared} cleared`}
    >
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          className={cn(
            i < run.roomsCleared && "is-cleared",
            i + 1 === run.room && "is-current",
          )}
          aria-hidden="true"
        >
          {i < run.roomsCleared ? <Check /> : i === 5 ? <Crown /> : i + 1}
        </span>
      ))}
    </div>
  );
}
export default function RuneDelveExpeditionPage() {
  const { reveal } = useRuneRewardReveal();
  const game = useRuneExpedition();
  const { data: hero } = useRuneDelveHero();
  const [heroClass, setHeroClass] = useState<HeroClass>("warrior");
  const [ascension, setAscension] = useState(0);
  const [run, setRun] = useState<ExpeditionRun | null>(null);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<ExpeditionReceipt | null>(null);
  const [showBuild, setShowBuild] = useState(false);
  const [buildPage, setBuildPage] = useState(0);
  const [boonPage, setBoonPage] = useState(0);
  const viewport = useRuneViewport();
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);
  const startId = useRef<string | null>(null);
  const actionLock = useRef(false);
  const mutationLock = useRef(false);
  const key =
    game.userId && game.clubId
      ? expeditionStorageKey(game.userId, game.clubId)
      : null;
  // Every scope visit has a distinct identity, including Alice → Bob → Alice.
  const activeScope = useRef({ key });
  if (activeScope.current.key !== key) activeScope.current = { key };
  const scope = activeScope.current;
  const hasRun = !!run;
  const runPhase = run?.phase;

  useEffect(() => {
    startId.current = null;
  }, [heroClass, ascension]);
  useEffect(() => {
    if (hero?.class) setHeroClass(hero.class);
  }, [hero?.class]);
  useEffect(() => {
    const checkpoint = key ? loadExpedition(key) : null;
    setRun(checkpoint);
    setPaused(!!checkpoint);
    setReceipt(null);
    setError("");
    setBusy(false);
    setShowBuild(false);
    startId.current = null;
    mutationLock.current = false;
    setHydratedKey(key);
  }, [key]);
  useEffect(() => {
    if (!key || key !== hydratedKey || !run || receipt) return;
    setSaved(saveExpedition(key, run));
    const save = () => {
      saveExpedition(key, run);
    };
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [key, hydratedKey, run, receipt]);
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && runPhase === "combat") setPaused(true);
    };
    const pause = () => {
      if (hasRun) setPaused(true);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("rune-delve:pause", pause);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("rune-delve:pause", pause);
    };
  }, [runPhase, hasRun]);

  async function start() {
    if (
      mutationLock.current ||
      !key ||
      key !== hydratedKey ||
      activeScope.current !== scope
    )
      return;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    const storageKey = key;
    startId.current ??= crypto.randomUUID();
    try {
      const ticket = await game.begin(startId.current, heroClass, ascension);
      if (activeScope.current !== scope) return;
      const fresh = createExpedition(ticket);
      setRun(fresh);
      setPaused(false);
      setReceipt(null);
      setSaved(saveExpedition(storageKey, fresh));
      startId.current = null;
    } catch (err) {
      if (activeScope.current === scope)
        setError(
          err instanceof Error
            ? err.message
            : "Could not enter the dungeon. Retry your expedition.",
        );
    } finally {
      if (activeScope.current === scope) {
        mutationLock.current = false;
        setBusy(false);
      }
    }
  }
  function recover() {
    if (
      !game.data?.active_run ||
      !key ||
      key !== hydratedKey ||
      activeScope.current !== scope
    )
      return;
    const fresh = createExpedition(game.data.active_run);
    setRun(fresh);
    setPaused(false);
    setReceipt(null);
    setError("");
    setSaved(saveExpedition(key, fresh));
  }
  function act(chain?: Cell[]) {
    if (
      paused ||
      busy ||
      showBuild ||
      actionLock.current ||
      !key ||
      key !== hydratedKey ||
      activeScope.current !== scope
    )
      return;
    actionLock.current = true;
    setRun((previous) =>
      previous
        ? chain
          ? expeditionChain(previous, chain)
          : expeditionAbility(previous)
        : previous,
    );
    requestAnimationFrame(() => {
      actionLock.current = false;
    });
  }
  async function bank() {
    if (
      !run ||
      mutationLock.current ||
      !key ||
      key !== hydratedKey ||
      activeScope.current !== scope
    )
      return;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    const storageKey = key;
    try {
      const result = await game.finish(run);
      if (activeScope.current !== scope) return;
      setReceipt(result);
      const unlocks = progressionRewardItems(run.heroClass, result);
      if (unlocks.length)
        reveal({
          id: `expedition:${run.id}:progression`,
          title: "Your legend grows",
          eyebrow: "Expedition progression",
          items: unlocks,
        });
      setPaused(false);
      clearExpedition(storageKey);
    } catch (err) {
      if (activeScope.current === scope)
        setError(
          err instanceof Error
            ? err.message
            : "Your reward was not confirmed. Retry to bank it safely.",
        );
    } finally {
      if (activeScope.current === scope) {
        mutationLock.current = false;
        setBusy(false);
      }
    }
  }
  function reset() {
    if (key !== hydratedKey || activeScope.current !== scope) return;
    if (key) clearExpedition(key);
    setRun(null);
    setReceipt(null);
    setPaused(false);
    setError("");
    void game.refetch();
  }
  const ready = hydratedKey === key && !!key;
  const isOver = run?.phase === "won" || run?.phase === "lost";
  const selectedClass = getClass(heroClass);
  const highest = game.data?.highest_ascension ?? 0;
  const buildPageSize = viewport.landscape ? 1 : viewport.short ? 2 : 3;
  const buildBoons = EXPEDITION_BOONS.filter((boon) => run?.boons[boon.id]);
  const buildPageCount = Math.max(
    1,
    Math.ceil(buildBoons.length / buildPageSize),
  );
  const currentBuildPage = Math.min(buildPage, buildPageCount - 1);
  const offeredBoons = run?.phase === "boon" ? expeditionBoonChoices(run) : [];
  const boonPageSize = !viewport.landscape && viewport.short ? 1 : 3;
  const boonPageCount = Math.max(
    1,
    Math.ceil(offeredBoons.length / boonPageSize),
  );
  const currentBoonPage = Math.min(boonPage, boonPageCount - 1);

  if (!ready || game.isLoading)
    return (
      <section className="rd-expedition rd-exp-loading" aria-busy="true">
        <Sparkles className="rd-breath" />
        <p>Opening the dungeon…</p>
        <button
          className="rd-exp-secondary"
          onClick={() => void game.refetch()}
        >
          Retry connection
        </button>
      </section>
    );
  if (game.isError && !game.data && !run)
    return (
      <section className="rd-expedition rd-exp-loading">
        <Sparkles />
        <h1>The dungeon is out of reach</h1>
        <p>
          {game.error instanceof Error
            ? game.error.message
            : "Check your connection and try again."}
        </p>
        <button className="rd-exp-primary" onClick={() => void game.refetch()}>
          Retry connection
        </button>
        <Link to="/rune-delve" className="rd-exp-secondary">
          Return to camp
        </Link>
      </section>
    );

  return (
    <div
      className="rd-expedition rd-screen"
      data-phase={run?.phase ?? "entry"}
      data-testid="expedition-page"
    >
      {!run ? (
        <>
          <header className="rd-exp-page-heading">
            <div>
              <p className="rd-exp-eyebrow">ROGUELITE ADVENTURE</p>
              <h1>Expeditions</h1>
            </div>
            <Link
              to="/rune-delve"
              aria-label="Back to camp"
              className="rd-exp-icon"
            >
              <X />
            </Link>
          </header>
          <div
            className="rd-exp-entry-art"
            style={{ backgroundImage: `url(${RUNE_PORTAL_ART})` }}
          >
            <div>
              <span>ONE RUN. A NEW BUILD.</span>
              <h2>Into the Hollow</h2>
              <p>Six chambers. Every choice changes your journey.</p>
            </div>
          </div>
          <div className="rd-exp-stats">
            <span>
              <Trophy />
              {(game.data?.best_score ?? 0).toLocaleString()}
              <small>BEST SCORE</small>
            </span>
            <span>
              <Crown />
              {game.data?.total_clears ?? 0}
              <small>EXPEDITIONS CLEARED</small>
            </span>
            <span>
              <Gem />
              {expeditionReward(6, ascension, true)}
              <small>CLEAR REWARD</small>
            </span>
          </div>
          {game.data?.active_run ? (
            <div className="rd-exp-recovery">
              <h2>Your expedition is waiting</h2>
              <p>
                This device has no saved board. Restart the same seeded run from
                chamber 1.
              </p>
              <button
                data-testid="expedition-recover"
                className="rd-exp-primary"
                onClick={recover}
              >
                <RotateCcw />
                Restart lost expedition
              </button>
            </div>
          ) : (
            <>
              <div className="rd-exp-class-grid" aria-label="Expedition class">
                {CLASS_LIST.map((cls) => (
                  <button
                    key={cls.id}
                    className={cn(
                      "rd-exp-class",
                      heroClass === cls.id && "is-selected",
                    )}
                    aria-pressed={heroClass === cls.id}
                    disabled={busy}
                    onClick={() => setHeroClass(cls.id)}
                  >
                    <RuneHeroArt cls={cls.id} />
                    <span>{cls.name}</span>
                  </button>
                ))}
              </div>
              <p className="rd-exp-class-passive">
                <Sparkles />
                {heroClass === "rogue"
                  ? "Shadowstep costs mana, not a move. Long attack chains hit harder."
                  : selectedClass.passive}
              </p>
              <div className="rd-exp-ascension-heading">
                <h2>Ascension {ascension + 1}</h2>
                <span>
                  {ascension === 0
                    ? "The first descent"
                    : `+${ascension * 16}% foe HP · +${ascension * 8}% damage`}
                </span>
              </div>
              <div
                className="rd-exp-ascensions"
                aria-label="Ascension difficulty"
              >
                {Array.from({ length: EXPEDITION_ASCENSIONS }, (_, i) => (
                  <button
                    key={i}
                    disabled={i > highest || busy}
                    aria-label={`Ascension ${i + 1}${i > highest ? ", locked" : ""}`}
                    aria-pressed={ascension === i}
                    onClick={() => setAscension(i)}
                    className={cn(ascension === i && "is-selected")}
                  >
                    {i > highest ? <LockKeyhole /> : i + 1}
                  </button>
                ))}
              </div>
              <button
                data-testid="expedition-start"
                className="rd-exp-primary rd-exp-start"
                disabled={busy || !hero}
                onClick={() => void start()}
              >
                {busy ? <Sparkles className="rd-breath" /> : <Swords />}
                {busy ? "Entering…" : "Start expedition"}
                <ArrowRight />
              </button>
              <p className="rd-exp-footnote">
                Fresh build each run · No entry cost · Progress saves on this
                device
              </p>
            </>
          )}
        </>
      ) : (
        <>
          <header className="rd-exp-run-heading">
            {!saved && !receipt && (
              <span
                className="rd-save-warning"
                role="status"
                title="Device storage is unavailable. Keep this page open to retain your board."
              >
                Unsaved
                <span className="sr-only">
                  . Keep this page open to retain your board.
                </span>
              </span>
            )}
            <div>
              <p className="rd-exp-eyebrow">
                ASCENSION {run.ascension + 1} ·{" "}
                {getClass(run.heroClass).name.toUpperCase()}
              </p>
              <h1>
                {isOver
                  ? run.phase === "won"
                    ? "Sovereign defeated"
                    : "The descent ends"
                  : run.phase === "boon"
                    ? "Claim a blessing"
                    : run.phase === "route"
                      ? "Choose your path"
                      : `Chamber ${run.room}`}
              </h1>
            </div>
            {run.phase === "combat" && (
              <strong className="rd-exp-moves">
                {run.combat.turnsRemaining} moves
              </strong>
            )}
            {Object.keys(run.boons).length > 0 && (
              <button
                className="rd-exp-icon"
                aria-label="Your expedition build"
                onClick={() => setShowBuild(true)}
              >
                <Sparkles />
              </button>
            )}
            <button
              className="rd-exp-icon"
              aria-label="Pause expedition"
              onClick={() => setPaused(true)}
            >
              <Pause />
            </button>
          </header>
          <RoomTrail run={run} />
          {!isOver && run.phase === "combat" && (
            <CombatFeedback
              className="rd-battle rd-exp-combat"
              data-testid="expedition-combat"
              state={run.combat}
              cls={run.heroClass}
              scope={`${run.id}-${run.room}`}
              disabled={paused || busy || showBuild}
            >
              <div className="rd-battle-side">
                <section className="rd-exp-enemy-stage">
                  <div className="rd-exp-stage-label">
                    <span>
                      {run.room === 6
                        ? "THE HOLLOW THRONE"
                        : EXPEDITION_ROUTES[run.route].name.toUpperCase()}
                    </span>
                    <strong>{run.combat.turnsRemaining} moves</strong>
                  </div>
                  <EnemyDisplay
                    enemies={run.combat.enemies}
                    primaryTargetId={
                      run.combat.enemies.find((enemy) => enemy.hp > 0)?.id
                    }
                  />
                </section>
                <HeroStatusBar
                  state={run.combat}
                  cls={run.heroClass}
                  onAbility={() => act()}
                  disabled={paused || busy || showBuild}
                />
                <ResonanceMeter state={run.combat} />
              </div>
              <div className="rd-exp-board-area rd-battle-board">
                <RuneBoard
                  grid={run.grid}
                  onChainComplete={(chain) => act(chain)}
                  disabled={paused || busy || showBuild}
                  effectOverride={{
                    red: (length) =>
                      previewExpeditionChain(run, "red", length).text,
                    blue: (length) =>
                      previewExpeditionChain(run, "blue", length).text,
                    green: (length) =>
                      previewExpeditionChain(run, "green", length).text,
                    gold: (length) =>
                      previewExpeditionChain(run, "gold", length).text,
                  }}
                />
              </div>
              <div className="rd-exp-action-status" role="status">
                {run.lastAction}
              </div>
            </CombatFeedback>
          )}
          {run.phase === "boon" && (
            <section
              className="rd-exp-choice-screen"
              data-testid="expedition-boons"
            >
              <div className="rd-exp-reward-seal">
                <Sparkles />
                <span>CHAMBER CLEARED</span>
                <strong>+8 HP with your blessing</strong>
              </div>
              {run.route === "hunt" && (
                <p className="rd-exp-hunt-bonus">
                  <Swords />
                  Hunt reward · empowered blessings
                </p>
              )}
              <div className="rd-exp-boon-choices">
                {offeredBoons
                  .slice(
                    currentBoonPage * boonPageSize,
                    (currentBoonPage + 1) * boonPageSize,
                  )
                  .map((boon) => (
                    <button
                      key={boon.id}
                      data-testid={`expedition-boon-${boon.id}`}
                      className="rd-exp-boon-choice"
                      onClick={() => {
                        const next = chooseExpeditionBoon(run, boon.id);
                        if (next === run || next.phase !== "route") return;
                        setRun(next);
                        reveal({
                          id: `blessing:${run.id}:${run.room}`,
                          title: boon.name,
                          eyebrow: "Blessing acquired",
                          detail:
                            "Your build grows stronger for this expedition.",
                          items: [
                            {
                              kind: "blessing",
                              glyph: boon.icon,
                              label: `Rank ${next.boons[boon.id]}`,
                              detail: expeditionBoonDescription(
                                boon.id,
                                next.boons[boon.id] ?? 1,
                              ),
                            },
                          ],
                        });
                      }}
                    >
                      <span
                        className="rd-exp-boon-symbol"
                        style={{ color: `hsl(var(--${boon.color}))` }}
                      >
                        <BoonIcon boon={boon} />
                      </span>
                      <span>
                        <strong>{boon.name}</strong>
                        <small>
                          {expeditionBoonDescription(
                            boon.id,
                            (run.boons[boon.id] ?? 0) +
                              expeditionBoonGain(run, boon.id),
                          )}
                        </small>
                        {run.boons[boon.id] ? (
                          <em>
                            Rank {run.boons[boon.id]} →{" "}
                            {run.boons[boon.id]! +
                              expeditionBoonGain(run, boon.id)}
                          </em>
                        ) : null}
                      </span>
                      <ChevronRight />
                    </button>
                  ))}
              </div>
              <RunePager
                page={currentBoonPage}
                pageCount={boonPageCount}
                onPageChange={setBoonPage}
                label="Blessings"
              />
            </section>
          )}
          {run.phase === "route" && (
            <section
              className="rd-exp-choice-screen"
              data-testid="expedition-routes"
            >
              <div className="rd-exp-path-heading">
                <h2>
                  {run.room === 5
                    ? "The final approach"
                    : "Two paths into the dark"}
                </h2>
                <p>
                  {Math.round(run.combat.hp)} / {run.combat.maxHp} HP · Your
                  build carries forward
                </p>
              </div>
              <div className="rd-exp-route-choices">
                {expeditionRouteChoices(run).map((id) => {
                  const route = EXPEDITION_ROUTES[id];
                  const Icon = ICONS[route.icon] ?? Skull;
                  return (
                    <button
                      key={id}
                      data-testid={`expedition-route-${id}`}
                      className={`rd-exp-route rd-exp-route-${id}`}
                      onClick={() => setRun(chooseExpeditionRoute(run, id))}
                    >
                      <Icon />
                      <strong>{route.name}</strong>
                      <span>{route.description}</span>
                      <small>{route.detail}</small>
                      <ArrowRight />
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          {isOver && (
            <section
              className={`rd-exp-summary${receipt ? " rd-reward-receipt is-new" : ""}`}
              data-testid="expedition-summary"
            >
              <div
                className={cn(
                  "rd-exp-result-symbol",
                  run.phase === "won" && "is-victory",
                )}
              >
                {run.phase === "won" ? <Crown /> : <Skull />}
              </div>
              <p className="rd-exp-eyebrow">
                {run.phase === "won"
                  ? "EXPEDITION COMPLETE"
                  : run.combat.hp <= 0
                    ? "FALLEN IN THE HOLLOW"
                    : run.combat.turnsRemaining <= 0
                      ? "OUT OF MOVES"
                      : "SAFELY RETREATED"}
              </p>
              <h2>
                {run.phase === "won"
                  ? "A legend in the making"
                  : "Every descent teaches."}
              </h2>
              <div className="rd-exp-stats">
                <span>
                  {run.roomsCleared}/6<small>CHAMBERS</small>
                </span>
                <span>
                  {run.score.toLocaleString()}
                  <small>SCORE</small>
                </span>
                <span>
                  <Gem />+
                  {receipt?.reward ??
                    expeditionReward(
                      run.roomsCleared,
                      run.ascension,
                      run.phase === "won",
                    )}
                  <small>{receipt ? "SHARDS BANKED" : "SHARDS TO BANK"}</small>
                  <small>
                    +
                    {receipt
                      ? (receipt.xpAwarded ?? 0)
                      : expeditionReward(
                          run.roomsCleared,
                          run.ascension,
                          run.phase === "won",
                        )}{" "}
                    class XP
                  </small>
                </span>
              </div>
              {receipt && run.phase === "won" && run.ascension < 7 && (
                <p className="rd-exp-unlock">
                  <LockKeyhole />
                  Ascension {Math.min(8, run.ascension + 2)} unlocked
                </p>
              )}
              {receipt ? (
                <>
                  <button className="rd-exp-primary" onClick={reset}>
                    <RotateCcw />
                    Another expedition
                  </button>
                  <Link to="/rune-delve" className="rd-exp-secondary">
                    Return to camp
                  </Link>
                </>
              ) : (
                <button
                  data-testid="expedition-bank"
                  className="rd-exp-primary"
                  disabled={busy}
                  onClick={() => void bank()}
                >
                  {busy ? <Sparkles className="rd-breath" /> : <Gem />}
                  {busy ? "Banking…" : "Bank rewards"}
                </button>
              )}
            </section>
          )}
          {receipt && run.roomsCleared > 0 && (
            <Link to="/feats" className="rd-exp-build-button">
              <Trophy />
              View DH Feats
              <ChevronRight className="ml-auto" />
            </Link>
          )}
          {Object.keys(run.boons).length > 0 && (
            <button
              className="rd-exp-build-button"
              onClick={() => setShowBuild(true)}
            >
              <Sparkles />
              Your build
              <span>
                {Object.values(run.boons).reduce(
                  (sum, value) => sum + (value ?? 0),
                  0,
                )}{" "}
                blessings
              </span>
              <ChevronRight />
            </button>
          )}
          {!saved && !receipt && (
            <p className="rd-exp-warning">
              Device storage is unavailable. Keep this page open to retain your
              current board.
            </p>
          )}
        </>
      )}
      {error && (
        <ExpeditionDialog
          open
          onOpenChange={(open) => {
            if (!open) setError("");
          }}
        >
          <DialogPrimitive.Title>Expedition update</DialogPrimitive.Title>
          <p role="alert">{error}</p>
          <button className="rd-exp-primary" onClick={() => setError("")}>
            Back to expedition
          </button>
        </ExpeditionDialog>
      )}
      {run && (
        <ExpeditionDialog open={paused} onOpenChange={setPaused}>
          <Pause />
          <DialogPrimitive.Title>Expedition paused</DialogPrimitive.Title>
          <p>
            Chamber {run.room} · {run.roomsCleared} cleared ·{" "}
            {Math.round(run.combat.hp)} HP
          </p>
          <button
            data-testid="expedition-resume"
            className="rd-exp-primary"
            onClick={() => setPaused(false)}
          >
            <Play />
            Resume expedition
          </button>
          {!isOver && (
            <button
              className="rd-exp-secondary"
              onClick={() => {
                setRun({ ...run, phase: "lost", lastAction: "Retreated" });
                setPaused(false);
              }}
            >
              Retreat · bank{" "}
              {expeditionReward(run.roomsCleared, run.ascension, false)} shards
            </button>
          )}
          <Link to="/rune-delve" className="rd-exp-secondary">
            {saved ? "Save & return to camp" : "Return to camp · board resets"}
          </Link>
        </ExpeditionDialog>
      )}
      {run && (
        <ExpeditionDialog open={showBuild} onOpenChange={setShowBuild}>
          <div className="rd-exp-build-modal">
            <header>
              <DialogPrimitive.Title>
                Your expedition build
              </DialogPrimitive.Title>
              <button
                className="rd-exp-icon"
                aria-label="Close build"
                onClick={() => setShowBuild(false)}
              >
                <X />
              </button>
            </header>
            <div className="rd-exp-build-list">
              {buildBoons
                .slice(
                  currentBuildPage * buildPageSize,
                  (currentBuildPage + 1) * buildPageSize,
                )
                .map((boon) => (
                  <div key={boon.id}>
                    <BoonIcon boon={boon} />
                    <span>
                      <strong>
                        {boon.name} · {run.boons[boon.id]}
                      </strong>
                      <small>
                        {boon.id === "phoenix" && run.phoenixUsed
                          ? "Used this run"
                          : expeditionBoonDescription(
                              boon.id,
                              run.boons[boon.id],
                            )}
                      </small>
                    </span>
                  </div>
                ))}
            </div>
            <RunePager
              page={currentBuildPage}
              pageCount={buildPageCount}
              onPageChange={setBuildPage}
              label="Build blessings"
            />
          </div>
        </ExpeditionDialog>
      )}
    </div>
  );
}
