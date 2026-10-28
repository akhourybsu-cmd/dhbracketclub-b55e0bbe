import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Hexagon,
  Maximize,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import "@/components/nexus/core/battle.css";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Crosshair,
  Heart,
  Orbit,
  Pause,
  Play,
  Shield,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { UPGRADES, getScenario } from "@/lib/nexus/core/catalog";
import { upgradePreview } from "@/lib/nexus/core/systems";
import { CoreWeaponPanel } from "@/components/nexus/core/CoreWeaponPanel";
import { toast } from "sonner";
import {
  activateAbility,
  buyUpgrade,
  isFinished,
  startWave,
  stats,
  stepRun,
  STEP,
  upgradeBlocked,
  upgradeCost,
} from "@/lib/nexus/core/engine";
import { readCoreRun, saveCoreRun } from "@/lib/nexus/core/persistence";
import type {
  CoreRun,
  CoreScenario,
  Targeting,
  UpgradeId,
} from "@/lib/nexus/core/types";
import { useNexusCore } from "@/hooks/useNexusCore";
import { useNexusSfx } from "@/hooks/useNexusSfx";
import { CoreArena } from "@/components/nexus/core/CoreArena";
import {
  CoreBack,
  CoreHeading,
  CoreIcon,
  CoreLink,
  CoreProfileGate,
} from "@/components/nexus/core/CoreUI";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function NexusBattlePage() {
  const { missionId } = useParams();
  const { userId, clubId } = useNexusCore();
  const scenario = getScenario(missionId);
  if (!scenario)
    return (
      <div className="nc-main">
        <CoreBack />
        <CoreHeading eyebrow="No signal" title="Choose your deployment." />
        <CoreLink to="/nexus/missions">Campaign sectors</CoreLink>
      </div>
    );
  return (
    <CoreProfileGate>
      <Combat key={`${userId}:${clubId}:${scenario.id}`} scenario={scenario} />
    </CoreProfileGate>
  );
}

function Combat({ scenario }: { scenario: CoreScenario }) {
  const { userId, clubId, profile, registerLegacy } = useNexusCore();
  const navigate = useNavigate();
  const location = useLocation();
  const [run, setRun] = useState<CoreRun | null>(() => {
    const saved = readCoreRun(userId, clubId);
    if (saved?.scenarioId === scenario.id) return saved;
    const fresh = (location.state as { freshRun?: CoreRun } | null)?.freshRun;
    return !saved && fresh?.scenarioId === scenario.id ? fresh : null;
  });
  const runRef = useRef(run);
  const [paused, setPaused] = useState(!!run && run.phase !== "ready");
  const [speed, setSpeed] = useState(1);
  const [category, setCategory] = useState<
    "attack" | "weapons" | "defense" | "utility"
  >("attack");
  const [muted, setMuted] = useState(true);
  const [systemsOpen, setSystemsOpen] = useState(false);
  const [entering, setEntering] = useState(false);
  const [nativeFullScreen, setNativeFullScreen] = useState(
    !!document.fullscreenElement,
  );
  useEffect(() => {
    const sync = () => setNativeFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const pauseButton = useRef<HTMLButtonElement>(null);
  const systemsButton = useRef<HTMLButtonElement>(null);
  const upgradeList = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (upgradeList.current) {
      upgradeList.current.scrollLeft = 0;
      upgradeList.current.scrollTop = 0;
    }
  }, [category]);
  useEffect(() => {
    if (!entering) return;
    const timer = window.setTimeout(() => setEntering(false), 1100);
    return () => window.clearTimeout(timer);
  }, [entering]);

  const [restoring, setRestoring] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const lastSave = useRef(0);
  const warned = useRef(false);
  const sfx = useNexusSfx();
  const sound = useRef({ muted, play: sfx.play });
  sound.current = { muted, play: sfx.play };
  const locked =
    scenario.mode === "campaign" &&
    Number(scenario.id) > 1 &&
    !profile?.campaign[String(Number(scenario.id) - 1)];
  useEffect(() => {
    if (!run || locked) return;
    document.documentElement.classList.add("nc-battle-active");
    document.body.classList.add("nc-battle-active");
    return () => {
      document.documentElement.classList.remove("nc-battle-active");
      document.body.classList.remove("nc-battle-active");
    };
    // The run identity determines ownership of the fullscreen surface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, locked]);
  const persist = (s: CoreRun) => {
    const ok = saveCoreRun(s, userId, clubId);
    if (!ok && !warned.current) {
      warned.current = true;
      setStorageError(true);
    }
  };
  const commit = (s: CoreRun) => {
    runRef.current = s;
    setRun(s);
    persist(s);
  };

  useEffect(() => {
    if (locked || paused || systemsOpen) return;
    const timer = window.setInterval(() => {
      const prev = runRef.current;
      if (!prev || prev.phase === "ready" || isFinished(prev)) return;
      let next = prev;
      for (let i = 0; i < speed && !isFinished(next); i++)
        next = stepRun(next, scenario);
      runRef.current = next;
      setRun(next);
      if (!sound.current.muted) {
        for (const kind of ["pulse", "arc", "rail"] as const)
          if (
            (next.metrics?.shots[kind] || 0) > (prev.metrics?.shots[kind] || 0)
          )
            sound.current.play(`shot.${kind}`);
        if (next.kills > prev.kills) sound.current.play("enemy.die");
        else if (next.damageTaken > prev.damageTaken)
          sound.current.play("leak");
        if (next.cleared > prev.cleared) sound.current.play("wave.clear");
      }
      if (Date.now() - lastSave.current > 1500 || isFinished(next)) {
        lastSave.current = Date.now();
        if (!saveCoreRun(next, userId, clubId) && !warned.current) {
          warned.current = true;
          setStorageError(true);
        }
      }
    }, STEP * 1000);
    return () => window.clearInterval(timer);
  }, [scenario, paused, systemsOpen, speed, userId, clubId, locked]);

  useEffect(() => {
    const flush = () => {
      if (runRef.current) saveCoreRun(runRef.current, userId, clubId);
    };
    const hide = () => {
      if (document.hidden) {
        setPaused(true);
        flush();
      }
    };
    const blur = () => {
      setPaused(true);
      flush();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("blur", blur);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [userId, clubId]);

  useEffect(() => {
    if (run && isFinished(run)) {
      saveCoreRun(run, userId, clubId);
      navigate(`/nexus/results/${scenario.id}`, {
        replace: true,
        state: { completedRun: run },
      });
    }
  }, [run, userId, clubId, scenario.id, navigate]);

  if (!run || locked)
    return (
      <div className="nc-main">
        <CoreBack />
        <CoreHeading
          eyebrow="Deployment required"
          title={locked ? "Sector locked." : "Your core is waiting."}
        >
          Prepare a new run, or resume your saved defense from the command
          center.
        </CoreHeading>
        <CoreLink
          to={locked ? "/nexus/missions" : `/nexus/loadout/${scenario.id}`}
        >
          {locked ? "Choose an open sector" : "Prepare core"}
        </CoreLink>
      </div>
    );
  const v = stats(run, scenario);
  const buy = (id: UpgradeId) => {
    const prev = runRef.current!;
    const next = buyUpgrade(prev, scenario, id);
    if (next !== prev) {
      commit(next);
      if (!muted) sfx.play("upgrade");
    }
  };
  const cast = (ability: "nova" | "overdrive") => {
    const next = activateAbility(runRef.current!, scenario, ability);
    if (next !== runRef.current) {
      commit(next);
      if (!muted)
        sfx.play(ability === "nova" ? "ability.cast.emp" : "ability.ready");
    }
  };
  const begin = async () => {
    if (restoring) return;
    if (!runRef.current!.balanceVersion && !runRef.current!.registered) {
      setRestoring(true);
      try {
        commit(await registerLegacy(runRef.current!));
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not restore this run",
        );
        return;
      } finally {
        setRestoring(false);
      }
    }
    const starting = runRef.current?.phase === "ready";
    if (starting) commit(startWave(runRef.current, scenario));
    if (
      starting &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      setEntering(true);
    setPaused(false);
  };
  const pause = () => {
    setPaused(true);
    persist(runRef.current!);
  };
  const inspect = () => {
    persist(runRef.current!);
    setSystemsOpen(true);
  };
  const requestFullScreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };
  return createPortal(
    <main
      className={`nx-mode nc-shell nc-battle nc-play-screen ${entering ? "nc-entering" : ""}`}
      aria-label="Nexus Defense battle"
    >
      <header className="nc-battle-top">
        <div>
          <h1>{scenario.title}</h1>
          <p>{scenario.subtitle}</p>
        </div>
        <div className="nc-session-state">
          <i className="nc-live-dot" />
          AUTO DEFENSE
          <span>
            {Math.floor(run.time / 60)}:
            {String(Math.floor(run.time % 60)).padStart(2, "0")}
          </span>
        </div>
      </header>
      <div className="nc-battle-grid">
        <section className="nc-live-stage" aria-label="Battle arena">
          <div className="nc-field">
            <div className="nc-wave-badge">
              <strong>
                {String(run.wave || 1).padStart(2, "0")}
                <small>
                  {scenario.waves
                    ? ` / ${String(scenario.waves).padStart(2, "0")}`
                    : " / ∞"}
                </small>
              </strong>
              <p>Current wave</p>
            </div>
            <div className="nc-threat-count">
              <i />
              {run.enemies.length} incoming
            </div>
            {run.phase === "intermission" && (
              <div className="nc-wave-message" role="status">
                <span>Wave secured · Next in {Math.ceil(run.breakTime)}s</span>
                <button
                  onClick={() => commit(startWave(runRef.current!, scenario))}
                >
                  Send next wave now <ChevronRight size={13} />
                </button>
              </div>
            )}
            <CoreArena run={run} scenario={scenario} />
            {entering && (
              <div className="nc-entry-reveal" aria-hidden="true">
                <Hexagon size={28} />
                <span>NEXUS ONLINE</span>
              </div>
            )}
          </div>
          <div className="nc-vitals">
            <Meter
              label="Hull integrity"
              value={run.hp}
              max={v.maxHp}
              color={
                run.hp / v.maxHp < 0.3 ? "hsl(0 92% 68%)" : "hsl(173 88% 70%)"
              }
              icon={<Heart size={11} />}
            />
            <Meter
              label="Barrier"
              value={run.shield}
              max={v.maxShield}
              color="hsl(200 90% 70%)"
              icon={<Shield size={11} />}
            />
          </div>
        </section>
        <section className="nc-command-deck" aria-label="Battle controls">
          <div className="nc-ability-row">
            <button
              className="nc-ability"
              disabled={run.novaCd > 0 || run.phase !== "wave"}
              onClick={() => cast("nova")}
              aria-label={`Nova burst${run.novaCd > 0 ? ` ready in ${Math.ceil(run.novaCd)} seconds` : " ready"}`}
              style={
                {
                  "--nc-charge": `${(1 - run.novaCd / 20) * 100}%`,
                } as React.CSSProperties
              }
            >
              <Orbit size={22} />
              <span>
                <strong>Nova burst</strong>
                <small>Damage + knockback</small>
              </span>
              <span>
                {run.novaCd > 0 ? `${Math.ceil(run.novaCd)}s` : "READY"}
              </span>
            </button>
            <button
              className="nc-ability"
              disabled={run.overdriveCd > 0 || run.phase !== "wave"}
              onClick={() => cast("overdrive")}
              aria-label={`Overdrive${run.overdriveCd > 0 ? ` ready in ${Math.ceil(run.overdriveCd)} seconds` : " ready"}`}
              style={
                {
                  "--nc-charge": `${(1 - run.overdriveCd / 30) * 100}%`,
                } as React.CSSProperties
              }
            >
              <Zap size={22} />
              <span>
                <strong>Overdrive</strong>
                <small>2× weapon output · 6s</small>
              </span>
              <span>
                {run.overdriveTime > 0
                  ? "ACTIVE"
                  : run.overdriveCd > 0
                    ? `${Math.ceil(run.overdriveCd)}s`
                    : "READY"}
              </span>
            </button>
          </div>
          <div className="nc-command-toolbar">
            <button
              className="nc-deck-control"
              ref={pauseButton}
              aria-label="Pause defense"
              onClick={pause}
            >
              <Pause size={18} />
            </button>
            <div
              className="nc-energy"
              aria-label={`${Math.floor(run.energy)} energy`}
            >
              <Zap size={16} />
              <strong>{Math.floor(run.energy)}</strong>
              <small>ENERGY</small>
            </div>
            <button
              className="nc-deck-control"
              aria-label={`Battle speed ${speed} times. Change speed.`}
              onClick={() => setSpeed(speed === 1 ? 2 : 1)}
            >
              {speed}×
            </button>
            <button
              className="nc-deck-control"
              ref={systemsButton}
              aria-label="Open weapon systems"
              onClick={inspect}
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
          <div className="nc-upgrade-heading">
            <span>UPGRADE YOUR CORE</span>
            <span className="nc-swipe-hint">
              Swipe for more <ChevronRight size={12} />
            </span>
          </div>
          <div
            className="nc-upgrade-list"
            ref={upgradeList}
            id="core-upgrades"
            role="tabpanel"
            aria-labelledby={`tab-${category}`}
          >
            {UPGRADES.filter((u) => u.category === category).map((u) => {
              const level = run.upgrades[u.id] || 0,
                price = upgradeCost(u.id, level),
                max = level >= u.max,
                blocked = upgradeBlocked(u.id, scenario);
              return (
                <button
                  key={u.id}
                  className="nc-upgrade"
                  disabled={max || blocked || run.energy < price}
                  onClick={() => buy(u.id)}
                  aria-label={`${u.name}, level ${level}, ${blocked ? "disabled in this challenge" : max ? "maximum level" : `${price} energy`}`}
                >
                  <CoreIcon name={u.icon} />
                  <span className="nc-upgrade-copy">
                    <strong>
                      {u.name}
                      <em>{level > 0 ? `L${level}` : ""}</em>
                    </strong>
                    <small>
                      {blocked
                        ? "Offline for this challenge"
                        : max
                          ? u.description
                          : upgradePreview(run, scenario, u.id)}
                    </small>
                  </span>
                  <span className="nc-upgrade-price">
                    {blocked ? (
                      "OFF"
                    ) : max ? (
                      "MAX"
                    ) : (
                      <>
                        <Zap size={11} />
                        {price}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="nc-tabs" role="tablist" aria-label="Upgrade category">
            {(["attack", "weapons", "defense", "utility"] as const).map((c) => (
              <button
                key={c}
                id={`tab-${c}`}
                role="tab"
                aria-selected={category === c}
                aria-controls="core-upgrades"
                onClick={() => setCategory(c)}
              >
                {c[0].toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </section>
      </div>
      {storageError && (
        <p className="nc-storage-notice" role="alert">
          Device storage unavailable. Keep this tab open to finish.
        </p>
      )}
      <AlertDialog
        open={
          !systemsOpen && !isFinished(run) && (paused || run.phase === "ready")
        }
        onOpenChange={(open) => {
          if (!open && run.phase !== "ready") setPaused(false);
        }}
      >
        <AlertDialogContent
          className={`nx-mode nc-shell nc-dialog nc-game-dialog ${run.phase === "ready" ? "nc-deployment-dialog" : "nc-pause-dialog"}`}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            pauseButton.current?.focus();
          }}
        >
          {run.phase === "ready" ? (
            <>
              <div className="nc-deployment-label">
                <span className="nc-live-dot" />
                {scenario.subtitle} / DEPLOYMENT
              </div>
              <div className="nc-deployment-seal" aria-hidden="true">
                <i />
                <i />
                <Hexagon size={62} />
                <span>N</span>
              </div>
              <div className="nc-deployment-copy">
                <div className="nc-eyebrow">DEFEND THE CENTER</div>
                <AlertDialogTitle>{scenario.title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {scenario.waves
                    ? `${scenario.waves} waves. One core. Hold the perimeter.`
                    : "One core. Endless waves. Set your next record."}
                </AlertDialogDescription>
              </div>
              <div className="nc-deployment-systems">
                <span>
                  <Crosshair size={17} />
                  AUTO TARGET
                </span>
                <span>
                  <Shield size={17} />
                  CORE SHIELD
                </span>
                <span>
                  <Orbit size={17} />
                  NOVA BURST
                </span>
              </div>
              <div className="nc-deployment-actions">
                <p>
                  Your core fires automatically. Build upgrades with the energy
                  you earn.
                </p>
                <button
                  className="nc-button"
                  onClick={begin}
                  disabled={restoring}
                >
                  <Play size={17} />
                  {restoring ? "Restoring…" : "Start defense"}
                </button>
                <button
                  className="nc-back"
                  onClick={() => {
                    persist(runRef.current!);
                    navigate("/nexus");
                  }}
                >
                  Back to command center
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="nc-sheet-grip" />
              <div className="nc-eyebrow">CORE ON STANDBY</div>
              <AlertDialogTitle>Defense paused.</AlertDialogTitle>
              <AlertDialogDescription>
                {scenario.title} · Wave {run.wave} · Saved on this device
              </AlertDialogDescription>
              <div className="nc-pause-stats">
                <span>
                  <strong>{run.kills}</strong>Neutralized
                </span>
                <span>
                  <strong>{run.score.toLocaleString()}</strong>Score
                </span>
                <span>
                  <strong>{Math.round(v.damage)}</strong>Pulse damage
                </span>
              </div>
              <div className="nc-menu-actions">
                <button
                  onClick={() => setMuted(!muted)}
                  aria-label={
                    muted ? "Enable battle sound" : "Mute battle sound"
                  }
                >
                  {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}Sound{" "}
                  {muted ? "off" : "on"}
                </button>
                {document.fullscreenEnabled && (
                  <button onClick={requestFullScreen}>
                    <Maximize size={18} />
                    {nativeFullScreen ? "Exit full screen" : "Full screen"}
                  </button>
                )}
              </div>
              <button
                className="nc-button"
                onClick={begin}
                disabled={restoring}
              >
                <Play size={17} />
                {restoring ? "Restoring…" : "Resume defense"}
              </button>
              <button
                className="nc-button nc-button-secondary"
                onClick={() => {
                  persist(runRef.current!);
                  navigate("/nexus");
                }}
              >
                <ArrowLeft size={16} />
                Save & exit
              </button>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={systemsOpen} onOpenChange={setSystemsOpen}>
        <DialogContent
          className="nx-mode nc-shell nc-game-dialog nc-systems-dialog"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            systemsButton.current?.focus();
          }}
        >
          <div className="nc-sheet-grip" />
          <DialogTitle>Weapon systems</DialogTitle>
          <DialogDescription>
            Defense paused while you inspect your core.
          </DialogDescription>
          <div className="nc-systems-scroll">
            <CoreWeaponPanel
              run={run}
              scenario={scenario}
              expanded
              onInstall={() => {
                setCategory("weapons");
                setSystemsOpen(false);
              }}
            />
            <div className="nc-targeting">
              <Crosshair size={16} />
              <label htmlFor="core-priority">Prioritize</label>
              <select
                id="core-priority"
                value={run.targeting}
                onChange={(e) =>
                  commit({
                    ...runRef.current!,
                    targeting: e.target.value as Targeting,
                  })
                }
              >
                <option value="nearest">Nearest to core</option>
                <option value="strongest">Strongest enemy</option>
                <option value="fastest">Fastest enemy</option>
              </select>
            </div>
          </div>
          <button className="nc-button" onClick={() => setSystemsOpen(false)}>
            Return to defense
            <ChevronRight size={17} />
          </button>
        </DialogContent>
      </Dialog>
    </main>,
    document.body,
  );
}

function Meter({
  label,
  value,
  max,
  color,
  icon,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <div className="nc-meter-label">
        <span>
          {icon}
          {label}
        </span>
        <strong>
          {Math.ceil(value)} / {max}
        </strong>
      </div>
      <div
        className="nc-meter"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.ceil(value)}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <i
          style={{
            width: `${max ? Math.max(0, (value / max) * 100) : 0}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
}
