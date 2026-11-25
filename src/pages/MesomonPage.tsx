import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Menu,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import { useClubAssets } from "@/hooks/useClubAssets";
import { useMesomonSave } from "@/hooks/useMesomonSave";
import {
  createNewSave,
  createSession,
  getMap,
  getObjective,
  getPhase,
  getQuestSteps,
  nearbyInteractions,
  reduceGame,
} from "@/lib/mesomon/engine";
import { keyboardAction } from "@/lib/mesomon/input";
import { MOVES, SPECIES } from "@/lib/mesomon/data/species";
import { resonanceEligibility } from "@/lib/mesomon/battle";
import { portraitUrl, dialoguePortrait } from "@/lib/mesomon/assets";
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
const SAVE_LABELS = {
  saving: "Saving",
  saved: "Saved",
  offline: "Offline",
  attention: "Sync needs attention",
  local: "On this device",
};
type MenuTab = "party" | "journal" | "settings" | "save";
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
        <Link to="/compete">Return to DH Club</Link>
      </div>
    );
  if (!user || !club || !assets.isInstalled("mesomon"))
    return (
      <div className="mesomon mm-access">
        <h1>Mesomon</h1>
        <p>Install Mesomon in your club’s Apps to enter Port Marche.</p>
        <Link to="/compete">Return to DH Club</Link>
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
  return (
    <Chapter
      key={`${userId ?? "guest"}:${slot}`}
      userId={userId}
      clubId={clubId}
      slot={slot}
      onSlot={setSlot}
    />
  );
}

function Chapter({
  userId,
  clubId,
  slot,
  onSlot,
}: {
  userId?: string | null;
  clubId?: string | null;
  slot: 1 | 2 | 3;
  onSlot: (slot: 1 | 2 | 3) => void;
}) {
  const sync = useMesomonSave({ userId, clubId, slot });
  const [session, setSession] = useState<GameSession | null>(null);
  const [playing, setPlaying] = useState(false);
  const [menu, setMenu] = useState<MenuTab | null>(null);
  const [restart, setRestart] = useState(false);
  const closeMenu = useCallback(() => setMenu(null), []);
  const closeRestart = useCallback(() => setRestart(false), []);
  const [viewError, setViewError] = useState<string | null>(null);
  const [viewRetry, setViewRetry] = useState(0);
  const [held, setHeld] = useState<Direction | null>(null);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [revealed, setRevealed] = useState(false);
  const [textCount, setTextCount] = useState(0);
  const [size, setSize] = useState({ width: 160, height: 144 });
  const [sealProgress, setSealProgress] = useState(0);
  const lastCheckpoint = useRef("");
  const audioMoment = useRef({ bonded: false, sealed: false, battle: "" });
  const adoptedSave = useRef<GameSession["save"] | null | undefined>(undefined);
  const resolvingCloud = useRef(false);
  const pixels = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const view = useRef<MesomonView | null>(null);
  const audio = useRef<MesomonAudio | null>(null);
  const current = useRef(session);
  const saveLocal = useRef(sync.saveLocal);
  const flush = useRef(sync.flush);
  const playingRef = useRef(playing);
  const menuRef = useRef(menu);
  const sealOrigin = useRef(performance.now());
  const lastSave = useRef<GameSession["save"] | null>(null);
  const moveBuffer = useRef<{
    last: number;
    direction: Direction | null;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ last: -Infinity, direction: null, timer: null });
  const clearMoveBuffer = useCallback(() => {
    if (moveBuffer.current.timer) clearTimeout(moveBuffer.current.timer);
    moveBuffer.current.timer = null;
    moveBuffer.current.direction = null;
  }, []);
  useEffect(() => clearMoveBuffer, [clearMoveBuffer]);
  useEffect(() => {
    if (hidden || menu || !playing) clearMoveBuffer();
  }, [hidden, menu, playing, clearMoveBuffer]);
  current.current = session;
  saveLocal.current = sync.saveLocal;
  flush.current = sync.flush;
  playingRef.current = playing;
  menuRef.current = menu;

  const dispatch = useCallback((action: GameAction) => {
    setSession((value) => (value ? reduceGame(value, action) : value));
  }, []);
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

  const hasSession = session !== null;
  useLayoutEffect(() => {
    const node = screen.current;
    if (!node) return;
    const resize = () => {
      const { clientWidth: width, clientHeight: height } = node;
      const fit = Math.max(0.1, Math.min(width / 160, height / 144));
      const integer = Math.floor(fit);
      const handheld = window.matchMedia?.(
        "(max-width: 767px), (orientation: landscape) and (max-height: 600px)",
      ).matches;
      const scale =
        !handheld && integer >= 1 && integer / fit >= 0.78 ? integer : fit;
      setSize({
        width: Math.floor(160 * scale),
        height: Math.floor(144 * scale),
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasSession, playing]);

  useEffect(() => {
    const parent = pixels.current;
    if (!parent || !session) return;
    const abort = new AbortController();
    let instance: MesomonView | null = null;
    setViewError(null);
    import("@/lib/mesomon/renderer/createGame")
      .then(({ createMesomonView }) =>
        createMesomonView(parent, {
          signal: abort.signal,
          onInteract: (id) => {
            if (playingRef.current && !menuRef.current)
              dispatch({ type: "interact", id });
          },
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
      setHeld(null);
      if (document.hidden && playingRef.current && current.current) {
        saveLocal.current(current.current.save);
        void flush.current();
      }
    };
    const pageHide = () => {
      if (playingRef.current && current.current) {
        saveLocal.current(current.current.save);
        void flush.current();
      }
    };
    const blur = () => setHeld(null);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("blur", blur);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("blur", blur);
      pageHide();
    };
  }, []);
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
  useEffect(() => {
    const node = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    const previous = node?.content;
    if (node) node.content = "#102224";
    return () => {
      if (node && previous !== undefined) node.content = previous;
    };
  }, []);

  const phase = session ? getPhase(session) : "explore";
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
  }, [menu, playing]);
  const line = session?.dialogue?.lines[session.dialogue.index];
  const speakerArt = line ? dialoguePortrait(line.speaker) : null;
  const lineKey = `${session?.dialogue?.id}:${session?.dialogue?.index}`;
  const textSpeed = session?.save.settings.textSpeed;
  useEffect(() => {
    setRevealed(false);
    setTextCount(0);
  }, [lineKey]);
  useEffect(() => {
    if (!line || revealed || textSpeed === "fast") return;
    const timer = window.setInterval(
      () => setTextCount((value) => Math.min(line.text.length, value + 2)),
      textSpeed === "slow" ? 45 : 24,
    );
    return () => clearInterval(timer);
  }, [line, revealed, textSpeed]);
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
    const progress = ((performance.now() - sealOrigin.current) % 1800) / 1800;
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
        DIRECTIONS.includes(action as Direction) &&
        playingRef.current &&
        !menuRef.current
      ) {
        const buffer = moveBuffer.current,
          elapsed = performance.now() - buffer.last;
        if (elapsed >= 140) {
          clearMoveBuffer();
          buffer.last = performance.now();
          dispatch({ type: "input", action });
        } else {
          buffer.direction = action as Direction;
          if (!buffer.timer)
            buffer.timer = setTimeout(() => {
              const direction = buffer.direction;
              buffer.timer = null;
              buffer.direction = null;
              if (
                direction &&
                playingRef.current &&
                !menuRef.current &&
                !document.hidden
              ) {
                buffer.last = performance.now();
                dispatch({ type: "input", action: direction });
              }
            }, 140 - elapsed);
        }
        return;
      }
      clearMoveBuffer();
      if (action === "menu") {
        setHeld(null);
        setMenu((value) => (value ? null : "party"));
        audio.current?.cue("menu");
        return;
      }
      if (menuRef.current) {
        if (action === "cancel") setMenu(null);
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
    [sync.blocked, awakenAudio, dispatch, hitSeal, line, textComplete, clearMoveBuffer],
  );
  const pressRef = useRef(press);
  pressRef.current = press;
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input,textarea,select,[contenteditable="true"]'))
        return;
      if (menuRef.current) return;
      const action = keyboardAction(event.key);
      if (!action || !playingRef.current) return;
      if (target?.closest("button,a") && action === "confirm") {
        if (event.key.toLowerCase() === "z" && target.closest("button")) {
          event.preventDefault();
          (target.closest("button") as HTMLButtonElement).click();
        }
        return;
      }
      event.preventDefault();
      if (DIRECTIONS.includes(action as Direction))
        setHeld(action as Direction);
      else if (!event.repeat) pressRef.current(action);
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
  }, []);
  useEffect(() => {
    if (!held || hidden || menu || !playing) return;
    pressRef.current(held);
    const timer = window.setInterval(() => pressRef.current(held), 155);
    return () => clearInterval(timer);
  }, [held, hidden, menu, playing]);
  const sealActive = session?.save.seal.active ?? false;
  const dialogueActive =
    session?.dialogue !== null && session?.dialogue !== undefined;
  const reducedMotion = session?.save.settings.reducedMotion ?? false;
  const sealAssist = session?.save.settings.sealAssist ?? false;
  useEffect(() => {
    if (
      !sealActive ||
      dialogueActive ||
      hidden ||
      menu ||
      reducedMotion ||
      sealAssist
    )
      return;
    sealOrigin.current = performance.now();
    const timer = window.setInterval(
      () =>
        setSealProgress(
          ((performance.now() - sealOrigin.current) % 1800) / 1800,
        ),
      40,
    );
    return () => clearInterval(timer);
  }, [sealActive, dialogueActive, hidden, menu, reducedMotion, sealAssist]);

  const begin = () => {
    if (sync.blocked || sync.loading) return;
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
    clearMoveBuffer();
  }, [sync.blocked, clearMoveBuffer]);
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

  const content = (
    <div
      className={`mesomon mm-phase-${phase}`}
      data-playing={playing}
      data-map-id={session?.save.player.mapId}
      data-player-x={session?.save.player.x}
      data-player-y={session?.save.player.y}
      data-reduced-motion={session?.save.settings.reducedMotion || undefined}
    >
      <header
        className="mm-header"
        data-mm-layer
        aria-hidden={menu ? true : undefined}
      >
        <Link
          to="/compete"
          onClick={leave}
          aria-label="Return to DH Club"
          className="mm-icon"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="mm-wordmark">
          <span>DH GAMES</span>
          <h1>MESOMON</h1>
        </div>
        <button
          className="mm-icon"
          aria-label={
            session?.save.settings.mute ? "Unmute audio" : "Mute audio"
          }
          onClick={() => {
            awakenAudio();
            updateSettings({ mute: !session?.save.settings.mute });
          }}
        >
          {session?.save.settings.mute ? (
            <VolumeX size={17} />
          ) : (
            <Volume2 size={17} />
          )}
        </button>
        <button
          className="mm-icon"
          data-mm-action="menu"
          aria-label="Menu"
          disabled={!session || sync.blocked}
          onClick={() => press("menu")}
        >
          <Menu size={19} />
        </button>
      </header>
      {!session ? (
        <div className="mm-loading">
          <img src="/games/mesomon/cover.png" alt="Port Marche harbor" />
          <h2>Opening the harbor</h2>
          <p>
            {sync.loading
              ? "Finding your field notes…"
              : "Your journey is safe on this device."}
          </p>
          <button onClick={() => void sync.reload()}>Retry</button>
          <Link to="/compete">Return to DH Club</Link>
        </div>
      ) : (
        <>
          <main
            className="mm-game"
            data-mm-layer
            aria-hidden={menu ? true : undefined}
          >
            <div className="mm-location">
              <span>
                <Compass size={12} />
                {getMap(session.save).name}
              </span>
              <span
                className={`mm-save-status mm-save-${sync.status}`}
                role="status"
              >
                {sync.save || sync.status === "attention"
                  ? SAVE_LABELS[sync.status]
                  : "New file"}
              </span>
            </div>
            <div className="mm-display-slot">
              <div className="mm-screen" ref={screen}>
                <div
                  ref={pixels}
                  className="mm-pixels"
                  style={{ width: size.width, height: size.height }}
                  role="img"
                  aria-label={`Port Marche game view. Tavian at ${session.save.player.x}, ${session.save.player.y} in ${getMap(session.save).name}.`}
                />
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
                      <img src="/games/mesomon/cover.png" alt="" />
                    </div>
                    <div className="mm-title-copy">
                      <small>CHAPTER I</small>
                      <h2>
                        PORT
                        <br />
                        <em>MARCHE</em>
                      </h2>
                      <p>A Harbor in Two Voices</p>
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
                      <button
                        className="mm-primary"
                        disabled={sync.blocked || sync.loading}
                        onClick={begin}
                      >
                        {sync.save ? "Continue journey" : "Begin journey"}
                        <ChevronRight size={18} />
                      </button>
                      <span className="mm-title-note">
                        {sync.save
                          ? `${Math.floor(sync.save.playtimeSeconds / 60)} min · ${getMap(sync.save).name}`
                          : "Tavian Merrow returns to a harbor he knows."}
                      </span>
                    </div>
                  </div>
                )}
                {playing && phase === "seal" && !session.dialogue && (
                  <div className="mm-seal" aria-label="Rift seal">
                    <p>Find the same voice.</p>
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
                    <p>The inland road is not yet open in this build.</p>
                    <button
                      className="mm-primary"
                      onClick={() => dispatch({ type: "advance" })}
                    >
                      Revisit the harbor
                    </button>
                    <Link to="/compete" onClick={leave}>
                      Return to DH Club
                    </Link>
                  </div>
                )}
              </div>
            </div>
            {playing && (
              <section
                className={`mm-event ${session.dialogue ? "mm-dialogue" : ""}`}
                aria-label={session.dialogue ? "Conversation" : "Field notes"}
              >
                {line ? (
                  <>
                    <div className="mm-speaker">
                      {speakerArt && (
                        <img
                          key={speakerArt}
                          src={speakerArt}
                          alt=""
                          onError={(event) => {
                            event.currentTarget.style.visibility = "hidden";
                          }}
                        />
                      )}
                      <strong>{line.speaker}</strong>
                    </div>
                    <p className="mm-dialogue-text">
                      <span aria-hidden="true">
                        {readyText}
                        <span className="mm-continue-mark">
                          {textComplete ? " ▾" : ""}
                        </span>
                      </span>
                      <span className="mm-sr-only">{line.text}</span>
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
                      {session.notice ||
                        "Walk close to something. Press A to look."}
                    </p>
                    <div className="mm-nearby">
                      {nearbyInteractions(session.save).map((object) => (
                        <button
                          key={object.id}
                          data-mm-object={object.id}
                          onClick={() =>
                            dispatch({ type: "interact", id: object.id })
                          }
                        >
                          {object.label}
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
                    setHeld(target.dataset.mmAction as Direction);
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
                  setHeld(
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
                    ? "Rillik is with you"
                    : "PORT MARCHE"}
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
          <footer className="mm-footnote">
            {playing
              ? "Arrows / WASD · Z / Enter · X / Esc · M"
              : "An independent, non-canon story in Mesoplasia."}
          </footer>
          {!sync.blocked && menu && !restart && (
            <GameMenu
              tab={menu}
              onTab={setMenu}
              session={session}
              onClose={closeMenu}
              onSettings={updateSettings}
              onSave={() => {
                saveLocal.current(session.save);
                void sync.flush();
              }}
              onTitle={() => {
                leave();
                setMenu(null);
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
                setMenu(null);
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
  return createPortal(content, document.body);
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
  const [tab, setTab] = useState<"moves" | "switch" | "pack">("moves");
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
        {(["moves", "switch", "pack"] as const).map((value) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {value === "moves"
              ? "Moves"
              : value === "switch"
                ? "Switch"
                : "Satchel"}
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
                    ? "Calm"
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
      ) : (
        <div className="mm-pack">
          <button
            disabled={
              (session.save.inventory.tincture ?? 0) - battle.usedTinctures <= 0
            }
            onClick={() => choose({ type: "item", itemId: "tincture" })}
          >
            Healing tincture{" "}
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

function GameMenu({
  tab,
  onTab,
  session,
  onClose,
  onSettings,
  onSave,
  onTitle,
  onRestart,
  onCompanion,
}: {
  tab: MenuTab;
  onTab: (tab: MenuTab) => void;
  session: GameSession;
  onClose: () => void;
  onSettings: (value: Partial<MesomonSettings>) => void;
  onSave: () => void;
  onTitle: () => void;
  onRestart: () => void;
  onCompanion: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key.toLowerCase() === "x") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const nodes = [
        ...dialog.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a,input",
        ),
      ];
      const first = nodes[0],
        last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("keydown", keyboard);
      previous?.focus({ preventScroll: true });
    };
  }, [onClose]);
  const s = session.save.settings;
  return (
    <div className="mm-modal-backdrop">
      <section
        ref={dialog}
        className="mm-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Game menu"
      >
        <header>
          <div>
            <small>TAVIAN’S</small>
            <h2>Fieldcase</h2>
          </div>
          <button
            className="mm-icon"
            aria-label="Close menu"
            data-mm-action="cancel"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <nav aria-label="Fieldcase sections">
          {(["party", "journal", "settings", "save"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={value === tab}
              onClick={() => onTab(value)}
            >
              {value === "party"
                ? "Companions"
                : value === "save"
                  ? "Save & exit"
                  : value === "journal"
                    ? "Journal"
                    : "Settings"}
            </button>
          ))}
        </nav>
        <div className="mm-menu-body">
          {tab === "party" && (
            <>
              {session.save.party.length ? (
                session.save.party.map((member) => (
                  <article className="mm-party-member" key={member.id}>
                    <img
                      src={portraitUrl(member.speciesId)}
                      alt={SPECIES[member.speciesId].name}
                    />
                    <div>
                      <h3>
                        {SPECIES[member.speciesId].name}
                        <small>
                          Lv. {member.level} ·{" "}
                          {SPECIES[member.speciesId].affinities.join(" / ")}
                        </small>
                      </h3>
                      <meter
                        min={0}
                        max={member.maxVitality}
                        value={member.vitality}
                        aria-label={`${SPECIES[member.speciesId].name} vitality`}
                      />
                      <p>
                        {member.vitality}/{member.maxVitality} Vitality
                      </p>
                      <p>{SPECIES[member.speciesId].description}</p>
                    </div>
                  </article>
                ))
              ) : (
                <p>There’s room beside you. You haven’t formed a bond yet.</p>
              )}
              {!!session.save.party.length && (
                <button onClick={onCompanion}>
                  {session.save.questFlags.companion_released
                    ? "Call Rillik to the crystal"
                    : "Release Rillik beside you"}
                </button>
              )}
            </>
          )}
          {tab === "journal" && (
            <>
              <h3>A Harbor in Two Voices</h3>
              <p className="mm-journal-objective">
                {getObjective(session.save)}
              </p>
              <ol className="mm-quest-steps">
                {getQuestSteps(session.save).map((step) => (
                  <li
                    key={step.id}
                    data-complete={step.complete}
                    aria-current={step.active ? "step" : undefined}
                  >
                    <span aria-hidden="true">{step.complete ? "◆" : "◇"}</span>
                    {step.label}
                  </li>
                ))}
              </ol>
              <h3>Recent conversations</h3>
              <div className="mm-conversation-log">
                {session.save.dialogueHistory.length ? (
                  session.save.dialogueHistory
                    .slice(-32)
                    .map((entry, index) => (
                      <p key={index}>
                        <strong>{entry.speaker}</strong>
                        {entry.text}
                      </p>
                    ))
                ) : (
                  <p>Your field notes begin at the quay.</p>
                )}
              </div>
            </>
          )}
          {tab === "settings" && (
            <>
              <Setting
                label="Text"
                values={["slow", "normal", "fast"]}
                value={s.textSpeed}
                onChange={(value) =>
                  onSettings({
                    textSpeed: value as MesomonSettings["textSpeed"],
                  })
                }
                labels={["Slow", "Normal", "Instant"]}
              />
              <Setting
                label="Battles"
                values={["normal", "fast"]}
                value={s.battleSpeed}
                onChange={(value) =>
                  onSettings({
                    battleSpeed: value as MesomonSettings["battleSpeed"],
                  })
                }
              />
              <Toggle
                label="Reduced motion"
                checked={s.reducedMotion}
                onChange={(reducedMotion) => onSettings({ reducedMotion })}
              />
              <Toggle
                label="Seal Assist · no timed input"
                checked={s.sealAssist}
                onChange={(sealAssist) => onSettings({ sealAssist })}
              />
              <Toggle
                label="Haptics"
                checked={s.haptics}
                onChange={(haptics) => onSettings({ haptics })}
              />
              <Toggle
                label="Mute"
                checked={s.mute}
                onChange={(mute) => onSettings({ mute })}
              />
              <label className="mm-range">
                Music{" "}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={s.musicVolume}
                  onChange={(event) =>
                    onSettings({ musicVolume: Number(event.target.value) })
                  }
                />
              </label>
              <label className="mm-range">
                Harbor ambience{" "}
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={s.ambientVolume}
                  onChange={(event) =>
                    onSettings({ ambientVolume: Number(event.target.value) })
                  }
                />
              </label>
            </>
          )}
          {tab === "save" && (
            <>
              <div className="mm-save-file">
                <small>FIELD NOTES · FILE {session.save.slot}</small>
                <h3>{getMap(session.save).name}</h3>
                <p>
                  {Math.floor(session.save.playtimeSeconds / 60)} minutes ·{" "}
                  {session.save.party.length} companions
                </p>
              </div>
              <button className="mm-primary" onClick={onSave}>
                Save now
              </button>
              <button onClick={onTitle}>Title screen</button>
              <Link to="/compete" onClick={onSave}>
                Return to DH Club
              </Link>
              <button className="mm-danger" onClick={onRestart}>
                Begin this file again
              </button>
            </>
          )}
        </div>
        <footer>Independent, non-canon Mesoplasia story.</footer>
      </section>
    </div>
  );
}
function Setting({
  label,
  values,
  value,
  onChange,
  labels,
}: {
  label: string;
  values: string[];
  value: string;
  onChange: (value: string) => void;
  labels?: string[];
}) {
  return (
    <fieldset className="mm-setting">
      <legend>{label}</legend>
      <div>
        {values.map((item, index) => (
          <button
            key={item}
            aria-pressed={value === item}
            onClick={() => onChange(item)}
          >
            {labels?.[index] ?? item}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      className="mm-toggle"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span>{label}</span>
      <b>{checked ? "On" : "Off"}</b>
    </button>
  );
}
