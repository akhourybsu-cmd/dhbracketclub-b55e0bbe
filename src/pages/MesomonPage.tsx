import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  BookOpen,
  Feather,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import { useClubAssets } from "@/hooks/useClubAssets";
import { useMesomonSave } from "@/hooks/useMesomonSave";
import { MesomonStartMenu, type MenuTab } from "@/components/mesomon/MesomonStartMenu";
import {
  CHAPTER_TITLE,
  createNewSave,
  createSession,
  getMap,
  getObjective,
  getPhase,
  interactionLabel,
  nearbyInteractions,
  reduceGame,
} from "@/lib/mesomon/engine";
import { isDirection, keyboardAction, WALK_STEP_MS } from "@/lib/mesomon/input";
import { MOVES, SPECIES } from "@/lib/mesomon/data/species";
import { resonanceEligibility } from "@/lib/mesomon/battle";
import { MESOMON_ASSETS, portraitUrl } from "@/lib/mesomon/assets";
import { readingVoice } from "@/lib/mesomon/reading";
import { useMesomonFullscreen } from "@/lib/mesomon/useMesomonFullscreen";
import { useTapWalk } from "@/lib/mesomon/useTapWalk";
import { MesomonAudio } from "@/lib/mesomon/audio";
import { readPreferences, writePreferences } from "@/lib/mesomon/preferences";
import type {
  BattleAction,
  Direction,
  GameAction,
  GameSession,
  InputAction,
  MesomonSettings,
} from "@/lib/mesomon/types";
import "@/components/mesomon/mesomon.css";

const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];
const SEAL_PERIOD_MS = 1800;
const SAVE_LABELS = {
  saving: "Saving",
  saved: "Saved",
  offline: "Offline",
  attention: "Sync needs attention",
  local: "On this device",
};
type MesomonView = Awaited<
  ReturnType<
    typeof import("@/lib/mesomon/renderer/createGame").createMesomonView
  >
>;

export default function MesomonPage() {
  const { user, loading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  const assets = useClubAssets();
  if (loading || clubLoading || assets.loading)
    return (
      <div className="mesomon mm-access">
        <h1>Mesomon</h1>
        <p>Opening Port Marche…</p>
        <button onClick={() => void assets.refresh()}>Retry</button>
        <Link to="/compete">Exit game</Link>
      </div>
    );
  if (!user || !club || !assets.isInstalled("mesomon"))
    return (
      <div className="mesomon mm-access">
        <h1>Mesomon</h1>
        <p>Install Mesomon in your club’s Apps to enter Port Marche.</p>
        <Link to="/compete">Exit game</Link>
      </div>
    );
  return (
    <MesomonGame
      key={`${user.id}:${club.id}`}
      userId={user.id}
      clubId={club.id}
    />
  );
}

/** The same game runs in the app and the isolated interaction test harness. */
export function MesomonGame({
  userId,
  clubId,
  initialSlot = 1,
}: {
  userId?: string | null;
  clubId?: string | null;
  initialSlot?: 1 | 2 | 3;
}) {
  const [slot, setSlot] = useState<1 | 2 | 3>(initialSlot);
  const device = useRef<HTMLDivElement>(null);
  const fullscreen = useMesomonFullscreen(device);

  return createPortal(
    <div className="mm-device" ref={device}>
      <Chapter
        key={`${userId ?? "guest"}:${slot}`}
        userId={userId}
        clubId={clubId}
        slot={slot}
        onSlot={setSlot}
        fullscreen={fullscreen}
      />
    </div>,
    document.body,
  );
}

function Chapter({
  userId,
  clubId,
  slot,
  onSlot,
  fullscreen,
}: {
  userId?: string | null;
  clubId?: string | null;
  slot: 1 | 2 | 3;
  onSlot: (slot: 1 | 2 | 3) => void;
  fullscreen: ReturnType<typeof useMesomonFullscreen>;
}) {
  const sync = useMesomonSave({ userId, clubId, slot });
  const [session, setSession] = useState<GameSession | null>(null);
  const [playing, setPlaying] = useState(false);
  const [menu, setMenu] = useState<MenuTab | null>(null);
  const [restart, setRestart] = useState(false);
  const closeMenu = useCallback(() => {
    restoreMenuFocus.current = true;
    setMenu(null);
  }, []);
  const closeRestart = useCallback(() => setRestart(false), []);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const restoreMenuFocus = useRef(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [artReady, setArtReady] = useState(false);
  const [viewRetry, setViewRetry] = useState(0);
  const [held, setHeld] = useState<Direction | null>(null);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [revealed, setRevealed] = useState(false);
  const [textCount, setTextCount] = useState(0);
  const [sealProgress, setSealProgress] = useState(0);
  const lastCheckpoint = useRef("");
  const audioMoment = useRef({ bonded: false, sealed: false, battle: "" });
  const adoptedSave = useRef<GameSession["save"] | null | undefined>(undefined);
  const resolvingCloud = useRef(false);
  const pixels = useRef<HTMLDivElement>(null);
  const view = useRef<MesomonView | null>(null);
  const audio = useRef<MesomonAudio | null>(null);
  const current = useRef(session);
  const saveLocal = useRef(sync.saveLocal);
  const flush = useRef(sync.flush);
  const playingRef = useRef(playing);
  const menuRef = useRef(menu);
  const sealOrigin = useRef(0);
  const pausedSealTime = useRef(0);
  const lastSave = useRef<GameSession["save"] | null>(null);
  current.current = session;
  saveLocal.current = sync.saveLocal;
  flush.current = sync.flush;
  playingRef.current = playing;
  menuRef.current = menu;

  const act = useCallback((action: GameAction) => {
    setSession((value) => (value ? reduceGame(value, action) : value));
  }, []);
  const showNotice = useCallback((notice: string) => {
    setSession((value) => (value ? { ...value, notice } : value));
  }, []);
  const phase = session ? getPhase(session) : "explore";
  const walking = useTapWalk(
    session,
    playing && !menu && !hidden && !sync.blocked && phase === "explore",
    act,
    showNotice,
  );
  const { cancel: cancelWalk, manualStep, tap } = walking;
  const tapWorld = useCallback((tile: { x: number; y: number }, id?: string) => {
    setHeld(null);
    tap(tile, id);
  }, [tap]);
  const destination = useRef(walking.destination);
  destination.current = walking.destination;
  const dispatch = useCallback(
    (action: GameAction) => {
      if (action.type !== "tick" && action.type !== "settings") cancelWalk();
      act(action);
    },
    [act, cancelWalk],
  );
  useEffect(() => {
    if (
      !sync.loading &&
      (!session || (!playing && adoptedSave.current !== sync.save))
    ) {
      const restored = createSession(sync.save ?? createNewSave(slot));
      const save = restored.save;
      if (!sync.save)
        save.settings.reducedMotion =
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
          false;
      save.settings = { ...save.settings, ...readPreferences(userId) };
      adoptedSave.current = sync.save;
      setSession(restored);
    }
  }, [sync.loading, sync.save, session, slot, playing, userId]);

  useEffect(() => {
    if (
      !playing ||
      !session ||
      resolvingCloud.current ||
      lastSave.current === session.save
    )
      return;
    lastSave.current = session.save;
    saveLocal.current(session.save);
  }, [session, playing]);

  useEffect(() => {
    const parent = pixels.current;
    if (!parent || !session) return;
    const abort = new AbortController();
    let instance: MesomonView | null = null;
    setArtReady(false);
    setViewError(null);
    import("@/lib/mesomon/renderer/createGame")
      .then(({ createMesomonView }) =>
        createMesomonView(parent, {
          signal: abort.signal,
          onFirstFrame: () => {
            if (!abort.signal.aborted) setArtReady(true);
          },
          onTap: tapWorld,
          walkDestination: () => destination.current,
          onError: (message) => {
            if (!abort.signal.aborted) setViewError(message);
          },
        }),
      )
      .then((value) => {
        if (abort.signal.aborted) {
          value.destroy();
          return;
        }
        instance = value;
        view.current = value;
        value.pause(
          document.hidden || !!menuRef.current || !playingRef.current,
        );
        if (current.current) value.update(current.current);
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setViewError(
            error instanceof Error
              ? error.message
              : "The harbor could not load.",
          );
      });
    return () => {
      abort.abort();
      instance?.destroy();
      if (view.current === instance) view.current = null;
    };
    // A view owns a whole chapter lifecycle; session updates go through update().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!session, viewRetry]);
  useEffect(() => {
    if (session) view.current?.update(session);
  }, [session]);
  useEffect(() => {
    view.current?.pause(hidden || !!menu || !playing);
    audio.current?.pause(hidden || !!menu || !playing);
  }, [hidden, menu, playing]);
  useEffect(() => {
    if (!session) return;
    audio.current?.setSettings(session.save.settings);
    audio.current?.setScene(
      session.save.battle
        ? session.save.battle.enemy.speciesId === "rift-wretch"
          ? "boss"
          : "battle"
        : session.save.player.mapId,
    );
    const moment = {
      bonded: session.save.questFlags.rillik_bonded === true,
      sealed: session.save.rifts["port-marche"] === "sealed",
      battle: session.save.battle?.id ?? "",
    };
    if (playingRef.current && moment.bonded && !audioMoment.current.bonded)
      audio.current?.cue("bond");
    if (playingRef.current && moment.sealed && !audioMoment.current.sealed)
      audio.current?.cue("seal");
    if (
      playingRef.current &&
      moment.battle &&
      moment.battle !== audioMoment.current.battle &&
      session.save.battle
    )
      audio.current?.cue(session.save.battle.enemy.speciesId);
    audioMoment.current = moment;
  }, [session]);
  useEffect(
    () => () => {
      audio.current?.destroy();
      audio.current = null;
    },
    [],
  );
  useEffect(() => {
    const visibility = () => {
      setHidden(document.hidden);
      cancelWalk();
      setHeld(null);
      if (document.hidden && playingRef.current && current.current) {
        saveLocal.current(current.current.save);
        void flush.current();
      }
    };
    const checkpoint = () => {
      if (playingRef.current && current.current) {
        saveLocal.current(current.current.save);
        void flush.current();
      }
    };
    const blur = () => { setHeld(null); cancelWalk(); };
    const pageHide = () => { blur(); checkpoint(); };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("blur", blur);
      checkpoint();
    };
  }, [cancelWalk]);
  useEffect(() => {
    if (!playing || hidden || menu) return;
    const timer = window.setInterval(
      () => dispatch({ type: "tick", seconds: 1 }),
      1000,
    );
    const cloudTimer = window.setInterval(() => void flush.current(), 15000);
    return () => {
      clearInterval(timer);
      clearInterval(cloudTimer);
    };
  }, [playing, hidden, menu, dispatch]);
  const checkpoint = session
    ? `${session.save.player.mapId}:${session.save.party.length}:${session.save.battle?.turn ?? 0}:${phase}:${session.save.seal.pulses}:${getObjective(session.save)}`
    : "";
  useEffect(() => {
    if (
      !playing ||
      !current.current ||
      !checkpoint ||
      lastCheckpoint.current === checkpoint
    )
      return;
    lastCheckpoint.current = checkpoint;
    saveLocal.current(current.current.save);
    void flush.current();
  }, [checkpoint, playing]);
  useEffect(() => {
    document
      .querySelectorAll<HTMLElement>(".mesomon [data-mm-layer]")
      .forEach((node) => {
        node.inert = !!menu;
      });
    if (!menu && restoreMenuFocus.current) {
      restoreMenuFocus.current = false;
      menuTrigger.current?.focus({ preventScroll: true });
    }
  }, [menu, playing]);
  const line = session?.dialogue?.lines[session.dialogue.index];
  const voice = line ? readingVoice(line.speaker) : null;
  const lineKey = `${session?.dialogue?.id}:${session?.dialogue?.index}`;
  const textSpeed = session?.save.settings.textSpeed;
  useEffect(() => {
    setRevealed(false);
    setTextCount(0);
  }, [lineKey]);
  useEffect(() => {
    if (!line || revealed || textSpeed === "fast" || menu || hidden) return;
    const timer = window.setInterval(
      () => setTextCount((value) => Math.min(line.text.length, value + 2)),
      textSpeed === "slow" ? 45 : 24,
    );
    return () => clearInterval(timer);
  }, [line, revealed, textSpeed, menu, hidden]);
  const textComplete =
    !line || revealed || textSpeed === "fast" || textCount >= line.text.length;
  const readyText = textComplete ? line?.text : line?.text.slice(0, textCount);

  const awakenAudio = useCallback(() => {
    if (!audio.current) audio.current = new MesomonAudio();
    if (current.current) {
      audio.current.setSettings(current.current.save.settings);
      audio.current.setScene(
        current.current.save.battle
          ? current.current.save.battle.enemy.speciesId === "rift-wretch"
            ? "boss"
            : "battle"
          : current.current.save.player.mapId,
      );
    }
    void audio.current.unlock().catch(() => {
      /* Audio is optional; gameplay remains usable. */
    });
  }, []);
  const hitSeal = useCallback(() => {
    const save = current.current?.save;
    if (!save) return;
    const progress = ((performance.now() - sealOrigin.current) % SEAL_PERIOD_MS) / SEAL_PERIOD_MS;
    const accuracy =
      save.settings.sealAssist || save.settings.reducedMotion
        ? 1
        : Math.max(0, 1 - Math.abs(progress - 0.72) / 0.3);
    dispatch({ type: "seal", accuracy });
    audio.current?.cue("confirm");
    if (save.settings.haptics) navigator.vibrate?.(15);
  }, [dispatch]);
  const press = useCallback(
    (action: InputAction) => {
      if (sync.blocked) return;
      awakenAudio();
      if (
        isDirection(action) &&
        playingRef.current &&
        !menuRef.current
      ) {
        manualStep(action);
        return;
      }
      cancelWalk();
      if (action === "menu") {
        setHeld(null);
        if (!current.current) return;
        if (menuRef.current) closeMenu();
        else setMenu("start");
        audio.current?.cue("menu");
        return;
      }
      if (menuRef.current) {
        if (action === "cancel") closeMenu();
        return;
      }
      if (!playingRef.current) return;
      if (
        action === "confirm" &&
        current.current?.save.seal.active &&
        !current.current.dialogue
      ) {
        hitSeal();
        return;
      }
      if (action === "confirm" && line && !textComplete) {
        setRevealed(true);
        return;
      }
      audio.current?.cue(action === "cancel" ? "cancel" : "confirm");
      dispatch({ type: "input", action });
    },
    [
      sync.blocked,
      closeMenu,
      cancelWalk,
      awakenAudio,
      dispatch,
      hitSeal,
      line,
      textComplete,
      manualStep,
    ],
  );
  const pressRef = useRef(press);
  pressRef.current = press;
  const heldRef = useRef<Direction | null>(null);
  heldRef.current = held;
  const startHold = useCallback((direction: Direction) => {
    if (heldRef.current === direction) return;
    heldRef.current = direction;
    setHeld(direction);
    pressRef.current(direction);
  }, []);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input,textarea,select,[contenteditable="true"]'))
        return;
      if (menuRef.current) return;
      const action = keyboardAction(event.key);
      if (!action || (!playingRef.current && action !== "menu")) return;
      const control = target?.closest<HTMLElement>("button,a");
      const gameConfirm = playingRef.current && event.key.toLowerCase() === "z" && control?.dataset.mmAction === "menu";
      if (control && action === "confirm" && !gameConfirm) {
        if (event.key.toLowerCase() === "z" && control instanceof HTMLButtonElement) {
          event.preventDefault();
          if (!event.repeat) control.click();
        }
        return;
      }
      event.preventDefault();
      if (event.repeat) return;
      if (isDirection(action)) startHold(action);
      else pressRef.current(action);
    };
    const up = (event: KeyboardEvent) => {
      const action = keyboardAction(event.key);
      if (DIRECTIONS.includes(action as Direction))
        setHeld((value) => (value === action ? null : value));
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [startHold]);
  useEffect(() => {
    if (hidden || menu || !playing || sync.blocked || phase !== "explore") {
      setHeld(null);
      return;
    }
    if (!held) return;
    const timer = window.setInterval(() => pressRef.current(held), WALK_STEP_MS);
    return () => clearInterval(timer);
  }, [held, hidden, menu, playing, phase, sync.blocked]);
  const sealActive = session?.save.seal.active ?? false;
  const dialogueActive =
    session?.dialogue !== null && session?.dialogue !== undefined;
  const reducedMotion = session?.save.settings.reducedMotion ?? false;
  const sealAssist = session?.save.settings.sealAssist ?? false;
  useEffect(() => {
    if (!sealActive) {
      pausedSealTime.current = 0;
      return;
    }
    if (!playing || dialogueActive || hidden || menu || reducedMotion || sealAssist) return;
    const now = performance.now();
    sealOrigin.current = now - pausedSealTime.current;
    setSealProgress(pausedSealTime.current / SEAL_PERIOD_MS);
    const timer = window.setInterval(() => {
      setSealProgress(((performance.now() - sealOrigin.current) % SEAL_PERIOD_MS) / SEAL_PERIOD_MS);
    }, 40);
    return () => {
      clearInterval(timer);
      pausedSealTime.current = (performance.now() - sealOrigin.current) % SEAL_PERIOD_MS;
    };
  }, [sealActive, dialogueActive, hidden, menu, reducedMotion, sealAssist, playing]);

  const begin = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (sync.blocked || sync.loading) return;
    fullscreen.enterOnPlay(event.nativeEvent);
    // A cloud response can arrive just before the title's adoption effect.
    // Never begin with an older blank session against that cloud revision.
    if (sync.save && adoptedSave.current !== sync.save) {
      const restored = createSession(sync.save);
      restored.save.settings = {
        ...restored.save.settings,
        ...readPreferences(userId),
      };
      adoptedSave.current = sync.save;
      current.current = restored;
      setSession(restored);
    }
    awakenAudio();
    playingRef.current = true;
    setPlaying(true);
    if (current.current) saveLocal.current(current.current.save);
  };
  const updateSettings = (settings: Partial<MesomonSettings>) => {
    const snapshot = current.current;
    if (!snapshot) return;
    const next = reduceGame(snapshot, { type: "settings", settings });
    writePreferences(userId, next.save.settings);
    current.current = next;
    setSession(next);
  };
  useEffect(() => {
    if (!sync.blocked) return;
    playingRef.current = false;
    setPlaying(false);
    setHeld(null);
    setMenu(null);
    setRestart(false);
    cancelWalk();
  }, [sync.blocked, cancelWalk]);
  const reloadFile = async () => {
    playingRef.current = false;
    setPlaying(false);
    setHeld(null);
    setMenu(null);
    // Keep the preloaded world mounted when reopening a file offline.
    adoptedSave.current = undefined;
    await sync.reload();
  };
  const restoreCloud = async () => {
    if (!sync.conflict?.cloud) return;
    resolvingCloud.current = true;
    playingRef.current = false;
    setPlaying(false);
    setHeld(null);
    setMenu(null);
    adoptedSave.current = undefined;
    await sync.useCloud();
    resolvingCloud.current = false;
  };
  const leave = () => {
    if (current.current && playing) saveLocal.current(current.current.save);
    void sync.flush();
  };
  const battleAction = (action: BattleAction) => {
    awakenAudio();
    audio.current?.cue("confirm");
    dispatch({ type: "battle", action });
  };

  const startKey = (
    <button
      type="button"
      className="mm-start-key"
      ref={menuTrigger}
      data-mm-action="menu"
      aria-label="Start"
      aria-haspopup="dialog"
      aria-keyshortcuts="M"
      disabled={!session || sync.blocked}
      onClick={() => press("menu")}
    >
      Start
    </button>
  );

  return (
    <div
      className={`mesomon mm-phase-${phase}`}
      data-playing={playing}
      data-map-id={session?.save.player.mapId}
      data-player-x={session?.save.player.x}
      data-player-y={session?.save.player.y}
      data-reduced-motion={session?.save.settings.reducedMotion || undefined}
    >
      <h1 className="mm-sr-only">Mesomon</h1>
      {!session ? (
        <div className="mm-loading">
          <img src={MESOMON_ASSETS.cover} alt="Port Marche harbor" />
          <h2>Opening the harbor</h2>
          <p>
            {sync.loading
              ? "Finding your field notes…"
              : "Your journey is safe on this device."}
          </p>
          <button onClick={() => void sync.reload()}>Retry</button>
          <Link to="/compete">Exit game</Link>
        </div>
      ) : (
        <>
          <main
            className="mm-game"
            data-mm-layer
            aria-hidden={menu ? true : undefined}
          >
            <div className="mm-display-slot">
              <div className="mm-screen" data-art-ready={artReady}>
                <div
                  ref={pixels}
                  className="mm-pixels"
                  role="img"
                  aria-label={`Port Marche game view. Tavian at ${session.save.player.x}, ${session.save.player.y} in ${getMap(session.save).name}.`}
                />
                {playing && !artReady && !viewError && (
                  <div className="mm-opening-scene" role="status">
                    <img src={MESOMON_ASSETS.cover} alt="" />
                    <span>
                      Opening {getMap(session.save).name.split(" · ")[0]}…
                    </span>
                  </div>
                )}
                {viewError && (
                  <div className="mm-view-error" role="alert">
                    <p>{viewError}</p>
                    <button onClick={() => setViewRetry((value) => value + 1)}>
                      Reload artwork
                    </button>
                  </div>
                )}
                {!playing && (
                  <div className="mm-title">
                    <div className="mm-title-art" aria-hidden="true">
                      <img src={MESOMON_ASSETS.cover} alt="" />
                    </div>
                    <div className="mm-title-copy">
                      <small>CHAPTER I</small>
                      <h2>
                        PORT
                        <br />
                        <em>MARCHE</em>
                      </h2>
                      <p>{CHAPTER_TITLE}</p>
                      <div className="mm-slot-tabs" aria-label="Save slots">
                        {([1, 2, 3] as const).map((value) => (
                          <button
                            key={value}
                            aria-pressed={value === slot}
                            onClick={() => onSlot(value)}
                          >
                            File {value}
                          </button>
                        ))}
                      </div>
                      <div className="mm-title-actions">
                        <button
                          className="mm-primary"
                          disabled={sync.blocked || sync.loading}
                          onClick={begin}
                        >
                          {sync.save ? "Continue journey" : "Begin journey"}
                          <ChevronRight size={18} />
                        </button>
                        {startKey}
                      </div>
                      <span className="mm-title-note">
                        {sync.save
                          ? `${Math.floor(sync.save.playtimeSeconds / 60)} min · ${getMap(sync.save).name}`
                          : "Arrival aboard the Wayfarer"}
                      </span>
                    </div>
                  </div>
                )}
                {playing && phase === "seal" && !session.dialogue && (
                  <div className="mm-seal" aria-label="Rift seal">
                    <p>Close the rift</p>
                    <div className="mm-seal-circles" aria-hidden="true">
                      <i />
                      <b
                        style={{
                          transform: `scale(${session.save.settings.sealAssist || session.save.settings.reducedMotion ? 0.94 : 0.22 + sealProgress})`,
                        }}
                      />
                    </div>
                    <div
                      className="mm-seal-pips"
                      aria-label={`${session.save.seal.pulses} of 3 pulses aligned`}
                    >
                      {[0, 1, 2].map((i) => (
                        <span key={i} data-lit={i < session.save.seal.pulses}>
                          ◆
                        </span>
                      ))}
                    </div>
                    <button className="mm-primary" onClick={hitSeal}>
                      Seal pulse
                    </button>
                    <span>
                      {session.save.settings.sealAssist ||
                      session.save.settings.reducedMotion
                        ? "Press three times. No timing needed."
                        : "Press A when the rings meet."}
                    </span>
                  </div>
                )}
                {playing && phase === "ending" && !session.dialogue && (
                  <div className="mm-end">
                    <img src={portraitUrl("rillik")} alt="Rillik resting" />
                    <small>MESOMON · CHAPTER I: PORT MARCHE</small>
                    <h2>
                      The harbor
                      <br />
                      has one voice.
                    </h2>
                    <p>
                      Edda marked the inland road. Tavian’s journey pauses here.
                    </p>
                    <button
                      className="mm-primary"
                      onClick={() => dispatch({ type: "advance" })}
                    >
                      Revisit the harbor
                    </button>
                    <Link to="/compete" onClick={leave}>
                      Exit game
                    </Link>
                  </div>
                )}
              </div>
            </div>
            {playing && (
              <section
                className={`mm-event ${session.dialogue ? "mm-dialogue" : ""}`}
                data-voice={voice?.kind}
                aria-label={session.dialogue ? "Conversation" : "Field notes"}
              >
                {line && voice ? (
                  <>
                    <div className="mm-speaker">
                      {voice.portrait && (
                        <img
                          key={voice.portrait}
                          src={voice.portrait}
                          alt=""
                          onError={(event) => {
                            event.currentTarget.style.visibility = "hidden";
                          }}
                        />
                      )}
                      {voice.kind === "document" && (
                        <Feather size={14} aria-hidden="true" />
                      )}
                      {voice.kind === "guide" && (
                        <BookOpen size={14} aria-hidden="true" />
                      )}
                      <strong
                        className={
                          voice.kind === "scene" ? "mm-sr-only" : undefined
                        }
                      >
                        {voice.credit}
                      </strong>
                    </div>
                    <p className="mm-dialogue-text">
                      <span aria-hidden="true">
                        {readyText}
                        <span className="mm-continue-mark">
                          {textComplete ? " ▾" : ""}
                        </span>
                      </span>
                      <span
                        className="mm-sr-only"
                        aria-live="polite"
                        aria-atomic="true"
                      >
                        {line.text}
                      </span>
                    </p>
                    {session.dialogue?.choices &&
                    session.dialogue.index >=
                      session.dialogue.lines.length - 1 ? (
                      <div className="mm-tone-choices">
                        {session.dialogue.choices.map((choice) => (
                          <button
                            key={choice.id}
                            onClick={() =>
                              dispatch({ type: "choice", id: choice.id })
                            }
                          >
                            <small>{choice.label}</small>
                            {choice.text}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        className="mm-dialogue-next"
                        onClick={() => press("confirm")}
                      >
                        {textComplete ? "Continue" : "Show text"}
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </>
                ) : session.save.battle ? (
                  <BattlePanel
                    session={session}
                    onAction={battleAction}
                    onContinue={() => dispatch({ type: "advance" })}
                  />
                ) : (
                  <>
                    <p className="mm-objective" data-mm-objective>
                      {getObjective(session.save)}
                    </p>
                    <p className="mm-notice" role="status">
                      {session.notice}
                    </p>
                    <div className="mm-nearby">
                      {nearbyInteractions(session.save).map((object, index) => (
                        <button
                          key={object.id}
                          className={
                            index === 0 ? "mm-facing-target" : undefined
                          }
                          data-mm-object={object.id}
                          onClick={() =>
                            dispatch({ type: "interact", id: object.id })
                          }
                        >
                          {index === 0 && <kbd aria-hidden="true">A</kbd>}
                          {interactionLabel(session.save, object)}
                          <ChevronRight size={13} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
          </main>
          {playing && phase !== "battle" && phase !== "ending" && (
            <div
              className="mm-control-deck"
              data-mm-layer
              aria-hidden={menu ? true : undefined}
            >
              <div
                className="mm-dpad"
                aria-label="Movement controls"
                onPointerDown={(event) => {
                  if (event.pointerType === "mouse" && event.button !== 0)
                    return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const target = (
                    event.target as HTMLElement
                  ).closest<HTMLButtonElement>("[data-mm-action]");
                  if (
                    target &&
                    DIRECTIONS.includes(target.dataset.mmAction as Direction)
                  )
                    startHold(target.dataset.mmAction as Direction);
                }}
                onPointerMove={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId))
                    return;
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const dx = event.clientX - bounds.left - bounds.width / 2,
                    dy = event.clientY - bounds.top - bounds.height / 2;
                  if (Math.abs(dx) + Math.abs(dy) < 12) {
                    setHeld(null);
                    return;
                  }
                  startHold(
                    Math.abs(dx) > Math.abs(dy)
                      ? dx > 0
                        ? "right"
                        : "left"
                      : dy > 0
                        ? "down"
                        : "up",
                  );
                }}
                onPointerUp={(event) => {
                  setHeld(null);
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={() => setHeld(null)}
                onLostPointerCapture={() => setHeld(null)}
              >
                {DIRECTIONS.map((direction) => {
                  const Icon = {
                    up: ChevronUp,
                    right: ChevronRight,
                    down: ChevronDown,
                    left: ChevronLeft,
                  }[direction];
                  return (
                    <button
                      key={direction}
                      className={`mm-direction mm-${direction}`}
                      data-mm-action={direction}
                      aria-label={`Move ${direction}`}
                      aria-pressed={held === direction}
                      onClick={(event) => {
                        if (event.detail === 0) press(direction);
                      }}
                    >
                      <Icon size={22} />
                    </button>
                  );
                })}
                <span aria-hidden="true" className="mm-dpad-center">
                  ◆
                </span>
              </div>
              <div className="mm-quick-actions">
                {startKey}
                <button
                  aria-label="Current Sense"
                  disabled={
                    !session.save.party.length ||
                    !!session.dialogue ||
                    !!session.save.battle
                  }
                  onClick={() => dispatch({ type: "sense" })}
                >
                  <Compass size={17} />
                  <span>Sense</span>
                </button>
                <span className="mm-control-hint">
                  {session.save.party.length
                    ? (session.save.questFlags.companion_released ? "Rillik walks beside you" : "Rillik is resting")
                    : "Tap ground to walk"}
                </span>
              </div>
              <div className="mm-ab">
                <button
                  className="mm-b"
                  data-mm-action="cancel"
                  aria-label="B — Cancel"
                  onClick={() => press("cancel")}
                >
                  B
                </button>
                <button
                  className="mm-a"
                  data-mm-action="confirm"
                  aria-label="A — Confirm"
                  onClick={() => press("confirm")}
                >
                  A
                </button>
                <span>BACK</span>
                <span>LOOK / TALK</span>
              </div>
            </div>
          )}
          {playing && (phase === "battle" || phase === "ending") && (
            <div className="mm-system-deck" data-mm-layer aria-hidden={menu ? true : undefined}>
              {startKey}
            </div>
          )}
          <footer className="mm-footnote" data-mm-layer aria-hidden={menu ? true : undefined}>
            {playing
              ? "Arrows / WASD · Z / Enter · X / Esc · M for Start"
              : "An independent, non-canon story in Mesoplasia."}
          </footer>
          {!sync.blocked && menu && !restart && (
            <MesomonStartMenu
              playing={playing}
              saveStatus={sync.status}
              saveLabel={!playing && !sync.save && (sync.status === "local" || sync.status === "saved")
                ? "New file"
                : SAVE_LABELS[sync.status]}
              fullscreen={fullscreen}
              tab={menu}
              onTab={setMenu}
              session={session}
              onClose={closeMenu}
              onSettings={updateSettings}
              onExit={leave}
              onSave={() => {
                saveLocal.current(session.save);
                void sync.flush();
              }}
              onTitle={() => {
                leave();
                closeMenu();
                setPlaying(false);
              }}
              onRestart={() => setRestart(true)}
              onCompanion={() =>
                dispatch({
                  type: "companion",
                  released: !session.save.questFlags.companion_released,
                })
              }
            />
          )}
          {!sync.blocked && restart && (
            <RestartConfirmation
              slot={slot}
              onCancel={closeRestart}
              onConfirm={() => {
                if (sync.blocked) return;
                const next = createNewSave(slot);
                next.settings = session.save.settings;
                setSession(createSession(next));
                saveLocal.current(next);
                setRestart(false);
                closeMenu();
                setPlaying(true);
              }}
            />
          )}
          {sync.blocked && (
            <div className="mm-sync-alert" role="alert">
              <span>
                {sync.blockReason ||
                  "This file changed in another window. Reload it before continuing."}
              </span>
              <button onClick={() => void reloadFile()}>Reload file</button>
              <Link to="/compete" onClick={leave}>Exit game</Link>
            </div>
          )}
          {!sync.blocked &&
            !menu &&
            !restart &&
            (sync.conflict || sync.status === "attention") && (
              <div className="mm-sync-alert" role="status">
                <span>
                  {sync.conflict
                    ? `Another save: ${sync.conflict.cloud ? getMap(sync.conflict.cloud).name + " · " + Math.floor(sync.conflict.cloud.playtimeSeconds / 60) + " min" : "cloud file missing"}. This device: ${Math.floor(sync.conflict.local.playtimeSeconds / 60)} min.`
                    : sync.error ||
                      "Cloud sync needs attention. Your device save is safe."}
                </span>
                {sync.conflict ? (
                  <>
                    <button
                      onClick={() => void restoreCloud()}
                      disabled={!sync.conflict.cloud}
                    >
                      Use cloud save
                    </button>
                    <button onClick={() => void sync.keepLocal()}>
                      Keep this device
                    </button>
                  </>
                ) : (
                  <button onClick={() => void sync.retry()}>Retry sync</button>
                )}
              </div>
            )}
        </>
      )}
    </div>
  );
}

function BattlePanel({
  session,
  onAction,
  onContinue,
}: {
  session: GameSession;
  onAction: (action: BattleAction) => void;
  onContinue: () => void;
}) {
  const [tab, setTab] = useState<"moves" | "switch" | "pack" | "log">("moves");
  const [busy, setBusy] = useState(false);
  const locked = useRef(false),
    cooldown = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (cooldown.current) clearTimeout(cooldown.current);
    },
    [],
  );
  const choose = (action: BattleAction) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    onAction(action);
    cooldown.current = setTimeout(
      () => {
        locked.current = false;
        setBusy(false);
      },
      session.save.settings.battleSpeed === "fast" ? 170 : 520,
    );
  };
  const battle = session.save.battle!;
  const ally = battle.allies[battle.activeIndex];
  if (battle.phase !== "choosing")
    return (
      <div className="mm-battle-result">
        <h2>
          {battle.phase === "resonated"
            ? "A willing bond."
            : battle.phase === "won"
              ? battle.enemy.speciesId === "rift-wretch"
                ? "Pushed back. Not yet sealed."
                : "The current settles."
              : battle.phase === "lost"
                ? "A moment to catch your breath."
                : "You leave them room."}
        </h2>
        <p>{battle.log.at(-1)}</p>
        <button className="mm-primary" onClick={onContinue}>
          Continue
        </button>
      </div>
    );
  const eligibility = resonanceEligibility(
    battle,
    session.save.inventory["crystal-bud"] ?? 0,
    session.save.party.length < 3,
  );
  return (
    <fieldset className="mm-battle-controls" disabled={busy}>
      <div className="mm-battle-vitals">
        <div>
          <strong>{SPECIES[ally.speciesId].name}</strong>
          <span>
            {ally.vitality}/{ally.maxVitality} Vitality
          </span>
          <meter
            min={0}
            max={ally.maxVitality}
            value={ally.vitality}
            aria-label="Companion vitality"
          />
        </div>
        <div>
          <strong>{SPECIES[battle.enemy.speciesId].name}</strong>
          <span>
            {battle.enemy.speciesId === "rift-wretch"
              ? `Stability ${battle.stability}/${battle.maxStability}`
              : `Agitation ${battle.agitation}`}
          </span>
          <meter
            min={0}
            max={
              battle.enemy.speciesId === "rift-wretch"
                ? battle.maxStability
                : battle.enemy.maxVitality
            }
            value={
              battle.enemy.speciesId === "rift-wretch"
                ? battle.stability
                : battle.enemy.vitality
            }
            aria-label={
              battle.enemy.speciesId === "rift-wretch"
                ? "Demon stability"
                : "Wild Mesomon vitality"
            }
          />
        </div>
      </div>
      <p className="mm-battle-log" role="status">
        {battle.log.at(-1) || "Choose a move."}
      </p>
      <div className="mm-battle-tabs" aria-label="Battle actions">
        {(["moves", "switch", "pack", "log"] as const).map((value) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value === "moves"
              ? "Moves"
              : value === "switch"
                ? "Switch"
                : value === "pack"
                  ? "Satchel"
                  : "Log"}
          </button>
        ))}
      </div>
      {tab === "moves" ? (
        <>
          <div className="mm-moves">
            {ally.moves.map((id) => (
              <button
                key={id}
                title={MOVES[id].description}
                onClick={() => choose({ type: "move", moveId: id })}
              >
                <strong>{MOVES[id].name}</strong>
                <small>
                  {MOVES[id].kind === "calm"
                    ? battle.enemy.speciesId === "rift-wretch"
                      ? "Loosen hold"
                      : "Calm"
                    : MOVES[id].kind === "guard"
                      ? "Guard"
                      : MOVES[id].kind === "evade"
                        ? "Evade"
                        : "Attack"}{" "}
                  · {MOVES[id].affinity}
                </small>
              </button>
            ))}
          </div>
          <div className="mm-battle-utility">
            <button onClick={() => choose({ type: "guard" })}>Guard</button>
            <button
              disabled={!eligibility.eligible}
              onClick={() => choose({ type: "resonate" })}
            >
              Resonate
            </button>
          </div>
          <p className="mm-resonance-reason">{eligibility.reason}</p>
        </>
      ) : tab === "switch" ? (
        <div className="mm-switch-list">
          {battle.allies.map((member, index) => (
            <button
              key={member.id}
              disabled={index === battle.activeIndex || member.vitality <= 0}
              onClick={() => {
                choose({ type: "switch", index });
                setTab("moves");
              }}
            >
              <img src={portraitUrl(member.speciesId)} alt="" />
              <span>
                {SPECIES[member.speciesId].name}
                <small>
                  {member.vitality}/{member.maxVitality} Vitality
                </small>
              </span>
              {index === battle.activeIndex ? "Active" : "Call"}
            </button>
          ))}
        </div>
      ) : tab === "log" ? (
        <ol className="mm-turn-history" aria-label="Recent battle actions">
          {battle.log.map((message, index) => (
            <li key={index}>{message}</li>
          ))}
        </ol>
      ) : (
        <div className="mm-pack">
          <button
            disabled={
              (session.save.inventory.tincture ?? 0) - battle.usedTinctures <= 0
            }
            onClick={() => choose({ type: "item", itemId: "tincture" })}
          >
            Healing tincture · up to 26 vitality{" "}
            <span>
              ×
              {Math.max(
                0,
                (session.save.inventory.tincture ?? 0) - battle.usedTinctures,
              )}
            </span>
          </button>
          {battle.enemy.speciesId !== "rift-wretch" && (
            <button onClick={() => choose({ type: "flee" })}>
              Give them space
            </button>
          )}
        </div>
      )}
    </fieldset>
  );
}

function RestartConfirmation({
  slot,
  onCancel,
  onConfirm,
}: {
  slot: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current
      ?.querySelector<HTMLButtonElement>("[data-mm-keep]")
      ?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key.toLowerCase() === "x") {
        event.preventDefault();
        onCancel();
      }
      if (event.key !== "Tab") return;
      const buttons =
        dialog.current?.querySelectorAll<HTMLButtonElement>("button");
      if (!buttons?.length) return;
      if (event.shiftKey && document.activeElement === buttons[0]) {
        event.preventDefault();
        buttons[buttons.length - 1].focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === buttons[buttons.length - 1]
      ) {
        event.preventDefault();
        buttons[0].focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [onCancel]);
  return (
    <div className="mm-modal-backdrop">
      <section
        ref={dialog}
        className="mm-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="mm-restart-title"
      >
        <h2 id="mm-restart-title">Begin again in File {slot}?</h2>
        <p>
          This replaces this file’s journey. Your other two files stay safe.
        </p>
        <button className="mm-primary" onClick={onConfirm}>
          Replace this file
        </button>
        <button data-mm-keep onClick={onCancel}>
          Keep my journey
        </button>
      </section>
    </div>
  );
}
