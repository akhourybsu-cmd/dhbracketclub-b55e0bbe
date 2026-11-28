import { useCallback, useContext, useEffect, useRef, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import {
  ChevronRight,
  Compass,
  BookOpen,
  Feather,
  LogOut,
  Settings,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useClub } from "@/contexts/ClubContext";
import { useClubAssets } from "@/hooks/useClubAssets";
import { useMesomonSave } from "@/hooks/useMesomonSave";
import { DeleteFileDialog } from "@/components/mesomon/DeleteFileDialog";
import { HarborTitleArt } from "@/components/mesomon/HarborTitleArt";
import { saveFingerprint } from "@/lib/mesomon/save";
import { FirstBondScene } from "@/components/mesomon/FirstBondScene";
import { ArrivalCinematic } from "@/components/mesomon/ArrivalCinematic";
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
import { BattlePanel } from "@/components/mesomon/BattlePanel";
import { MESOMON_ASSETS, fieldPlateUrl } from "@/lib/mesomon/assets";
import { readingVoice } from "@/lib/mesomon/reading";
import { PocketDevice, PocketDpad, PocketActionKeys } from "@/components/pocket/PocketHandheld";
import { PocketDeviceContext } from "@/components/pocket/deviceContext";
import { MesomonExit } from "@/components/mesomon/MesomonExit";
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

function titleSession(file: GameSession["save"] | null, slot: 1 | 2 | 3, userId?: string | null) {
  const restored = createSession(file ?? createNewSave(slot));
  if (!file) {
    restored.save.settings.reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }
  Object.assign(restored.save.settings, readPreferences(userId));
  return restored;
}

export default function MesomonPage() {
  const assets = useClubAssets();
  if (assets.loading || !assets.isInstalled("mesomon")) {
    return (
      <div className="mesomon mm-access">
        <h1>Mesomon</h1>
        <p>{assets.loading ? "Opening Port Marche…" : "Install Mesomon in your club’s Apps to enter Port Marche."}</p>
        {assets.loading && <button onClick={() => void assets.refresh()}>Retry</button>}
        <MesomonExit />
      </div>
    );
  }
  return <PocketMesomon />;
}

/** Both entry points verify the club's cartridge catalog before mounting the game. */
export function PocketMesomon({ onExitPocketGame }: { onExitPocketGame?: () => void }) {
  const { user, loading } = useAuth();
  const { club, loading: clubLoading } = useClub();
  if (loading || clubLoading || !user || !club) {
    return (
      <div className="mesomon mm-access">
        <h1>Mesomon</h1>
        <p>{loading || clubLoading ? "Opening Port Marche…" : "Open Mesomon from your club to play."}</p>
        <MesomonExit onExitPocketGame={onExitPocketGame} />
      </div>
    );
  }
  return <MesomonGame key={`${user.id}:${club.id}`} userId={user.id} clubId={club.id} onExitPocketGame={onExitPocketGame} />;
}

/** The same game runs in the app and the isolated interaction test harness. */
interface MesomonGameProps {
  userId?: string | null;
  clubId?: string | null;
  initialSlot?: 1 | 2 | 3;
  onExitPocketGame?: () => void;
}

export function MesomonGame(props: MesomonGameProps) {
  const device = useContext(PocketDeviceContext);
  return device ? <MesomonCartridge {...props} /> : <PocketDevice><MesomonCartridge {...props} /></PocketDevice>;
}

function MesomonCartridge({ userId, clubId, initialSlot = 1, onExitPocketGame }: MesomonGameProps) {
  const [slot, setSlot] = useState<1 | 2 | 3>(initialSlot);
  const [slotSwitched, setSlotSwitched] = useState(false);

  function selectSlot(next: 1 | 2 | 3) {
    if (next === slot) return;
    setSlotSwitched(true);
    setSlot(next);
  }
  return (
    <Chapter
      key={`${userId ?? "guest"}:${slot}`}
      userId={userId}
      clubId={clubId}
      slot={slot}
      onSlot={selectSlot}
      focusSelectedFile={slotSwitched}
      onExitPocketGame={onExitPocketGame}
    />
  );
}

function Chapter({
  userId,
  clubId,
  slot,
  onSlot,
  focusSelectedFile,
  onExitPocketGame,
}: {
  userId?: string | null;
  clubId?: string | null;
  slot: 1 | 2 | 3;
  onSlot: (slot: 1 | 2 | 3) => void;
  focusSelectedFile: boolean;
  onExitPocketGame?: () => void;
}) {
  const { fullscreen, beforePowerOff } = useContext(PocketDeviceContext)!;
  const sync = useMesomonSave({ userId, clubId, slot });
  const [session, setSession] = useState<GameSession | null>(null);
  const [entry, setEntry] = useState<"title" | "arrival" | "field">("title");
  const playing = entry !== "title";
  const opening = entry === "arrival";
  const openingRef = useRef(opening);
  openingRef.current = opening;
  const [fileToDelete, setFileToDelete] = useState<{ location: string; minutes: number; fingerprint: string } | null>(null);
  const [fileDeleted, setFileDeleted] = useState(false);
  const focusNewSelection = useRef(focusSelectedFile);
  const selectFileButton = useCallback((button: HTMLButtonElement | null) => {
    if (button && focusNewSelection.current) {
      focusNewSelection.current = false;
      button.focus({ preventScroll: true });
    }
  }, []);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const journeyTrigger = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<MenuTab | null>(null);
  const closeMenu = useCallback(() => {
    restoreMenuFocus.current = true;
    setMenu(null);
  }, []);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const restoreMenuFocus = useRef(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [artReady, setArtReady] = useState(false);
  const sceneReady = artReady || viewError !== null;
  const [viewRetry, setViewRetry] = useState(0);
  const [held, setHeld] = useState<Direction | null>(null);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [revealed, setRevealed] = useState(false);
  const [textCount, setTextCount] = useState(0);
  const [sealProgress, setSealProgress] = useState(0);
  const lastCheckpoint = useRef("");
  const audioMoment = useRef({ cuffGlowing: false, bonded: false, sealed: false, battle: "" });
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
  const bondShot = session?.dialogue?.id === "first-bond"
    ? session.dialogue.lines[session.dialogue.index]?.bondShot : undefined;
  const showBondScene = playing && !!bondShot;
  const layersCovered = !!menu || opening || !!fileToDelete;
  const fieldPaused = !playing || hidden || layersCovered || showBondScene;
  const pauseOnViewLoad = useRef(fieldPaused);
  pauseOnViewLoad.current = fieldPaused;
  const scenePaused = !playing || !sceneReady || layersCovered || hidden || sync.blocked;
  const walking = useTapWalk(
    session,
    !scenePaused && phase === "explore",
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
      if (action.type !== "tick" && action.type !== "settings") {
        if (scenePaused) return;
        cancelWalk();
      }
      act(action);
    },
    [act, cancelWalk, scenePaused],
  );
  useEffect(() => {
    if (
      !sync.loading &&
      (!session || (!playing && adoptedSave.current !== sync.save))
    ) {
      const restored = titleSession(sync.save, slot, userId);
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
        value.pause(pauseOnViewLoad.current);
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
    view.current?.pause(fieldPaused);
  }, [fieldPaused]);
  useEffect(() => { audio.current?.pause(scenePaused); }, [scenePaused]);
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
    const battle = session.save.battle;
    const moment = {
      cuffGlowing: bondShot === "glow",
      bonded: bondShot === "bond" || session.save.questFlags.rillik_bonded === true,
      sealed: session.save.rifts["port-marche"] === "sealed",
      battle: battle?.id ?? "",
    };
    if (playingRef.current && moment.cuffGlowing && !audioMoment.current.cuffGlowing)
      audio.current?.cue("cuff-answer");
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
    if (battle && !scenePaused) audio.current?.battleBeat(battle);
    audioMoment.current = moment;
  }, [session, scenePaused, bondShot]);
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
    if (!playing || hidden || layersCovered) return;
    const timer = window.setInterval(
      () => dispatch({ type: "tick", seconds: 1 }),
      1000,
    );
    const cloudTimer = window.setInterval(() => void flush.current(), 15000);
    return () => {
      clearInterval(timer);
      clearInterval(cloudTimer);
    };
  }, [playing, hidden, layersCovered, dispatch]);
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
        node.inert = layersCovered;
      });
    if (!layersCovered && restoreMenuFocus.current) {
      restoreMenuFocus.current = false;
      menuTrigger.current?.focus({ preventScroll: true });
    }
  }, [layersCovered, playing]);
  const approaching = session?.dialogue?.approach?.actor;
  const stepsLeft = session?.dialogue?.approach?.steps.length ?? 0;
  const reducedMotion = session?.save.settings.reducedMotion ?? false;
  useEffect(() => {
    if (scenePaused || !approaching) return;
    const timer = window.setTimeout(() => {
      act({ type: "approach-step", actor: approaching, remaining: stepsLeft });
    }, reducedMotion ? 0 : WALK_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [scenePaused, approaching, stepsLeft, reducedMotion, act]);
  const line = approaching ? undefined : session?.dialogue?.lines[session.dialogue.index];
  const voice = line ? readingVoice(line.speaker) : null;
  const lineKey = `${session?.dialogue?.id}:${session?.dialogue?.index}`;
  const textSpeed = session?.save.settings.textSpeed;
  const textLength = line?.text.length ?? 0;
  // Show the complete question alongside its replies, including on a resumed choice.
  const choicePrompt = session?.dialogue && session.dialogue.index === session.dialogue.lines.length - 1
    ? session.dialogue.choices : undefined;
  const textComplete = !!choicePrompt?.length || reducedMotion || revealed || textSpeed === "fast" || textCount >= textLength;
  useEffect(() => {
    setRevealed(false);
    setTextCount(0);
  }, [lineKey]);
  useEffect(() => {
    if (scenePaused || textComplete) return;
    const timer = window.setInterval(
      () => setTextCount((value) => Math.min(textLength, value + 2)),
      textSpeed === "slow" ? 45 : 24,
    );
    return () => clearInterval(timer);
  }, [scenePaused, textComplete, textLength, textSpeed]);
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
      if (sync.blocked || openingRef.current) return;
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
        if (!current.current || !playingRef.current) return;
        if (menuRef.current) closeMenu();
        else setMenu("start");
        audio.current?.cue("menu");
        return;
      }
      if (menuRef.current) {
        if (action === "cancel") closeMenu();
        return;
      }
      if (scenePaused || current.current?.dialogue?.approach) return;
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
      scenePaused,
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
      if (openingRef.current || event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input,textarea,select,[contenteditable="true"]')) return;
      const action = keyboardAction(event.key);
      // Enter can repeat a native click on the control that just replaced the previous one.
      if (action === "confirm" && event.repeat) {
        event.preventDefault();
        return;
      }
      if (menuRef.current || !action || !playingRef.current) return;
      const control = target?.closest<HTMLElement>("button,a");
      // Z is the handheld A button even when Start or a direction key still has focus.
      const gameConfirm = playingRef.current && event.key.toLowerCase() === "z" && !!control?.dataset.mmAction;
      if (current.current?.save.battle && !current.current.dialogue &&
          (isDirection(action) || (action === "confirm" && (!control || gameConfirm)))) {
        event.preventDefault();
        if (!event.repeat) {
          const command = document.querySelector<HTMLButtonElement>(".mm-battle-panel button:enabled[data-battle-default]");
          command?.focus({ preventScroll: true });
          if (action === "confirm") command?.click();
        }
        return;
      }
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
    if (scenePaused || phase !== "explore") {
      setHeld(null);
      return;
    }
    if (!held) return;
    const timer = window.setInterval(() => pressRef.current(held), WALK_STEP_MS);
    return () => clearInterval(timer);
  }, [held, scenePaused, phase]);
  const sealActive = session?.save.seal.active ?? false;
  const dialogueActive =
    session?.dialogue !== null && session?.dialogue !== undefined;
  const sealAssist = session?.save.settings.sealAssist ?? false;
  useEffect(() => {
    if (!sealActive) {
      pausedSealTime.current = 0;
      return;
    }
    if (!playing || dialogueActive || hidden || layersCovered || reducedMotion || sealAssist) return;
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
  }, [sealActive, dialogueActive, hidden, layersCovered, reducedMotion, sealAssist, playing]);

  const begin = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (sync.blocked || sync.loading || fileToDelete || sync.deleting) return;
    setFileDeleted(false);
    fullscreen.enterOnPlay(event.nativeEvent);
    // A cloud restore or completed deletion may precede the title's adoption effect.
    if (adoptedSave.current !== sync.save) {
      const restored = titleSession(sync.save, slot, userId);
      adoptedSave.current = sync.save;
      current.current = restored;
      setSession(restored);
    }
    awakenAudio();
    playingRef.current = true;
    setEntry(sync.save ? "field" : "arrival");
    if (current.current) saveLocal.current(current.current.save);
  };
  const finishOpening = useCallback(() => {
    restoreMenuFocus.current = true;
    setEntry(stage => stage === "arrival" ? "field" : stage);
  }, []);
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
    setEntry("title");
    setHeld(null);
    setMenu(null);
    cancelWalk();
  }, [sync.blocked, cancelWalk]);
  const reloadFile = async () => {
    playingRef.current = false;
    setEntry("title");
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
    setEntry("title");
    setHeld(null);
    setMenu(null);
    adoptedSave.current = undefined;
    await sync.useCloud();
    resolvingCloud.current = false;
  };
  const leave = useCallback(() => {
    if (current.current && playingRef.current) saveLocal.current(current.current.save);
    void flush.current();
  }, []);
  useEffect(() => {
    beforePowerOff.current = leave;
    return () => { beforePowerOff.current = null; };
  }, [beforePowerOff, leave]);
  const advanceBattleBeat = useCallback((turn: number, index: number) => {
    dispatch({ type: "battle-beat", turn, index });
  }, [dispatch]);
  const battleAction = (action: BattleAction) => {
    if (current.current?.save.settings.haptics) navigator.vibrate?.(12);
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

  const pocketTitle = !!onExitPocketGame && !playing;
  const browseFiles = useCallback((direction: Direction) => {
    const step = direction === "left" || direction === "up" ? -1 : 1;
    onSlot(((slot - 1 + step + 3) % 3 + 1) as 1 | 2 | 3);
  }, [onSlot, slot]);
  useEffect(() => {
    if (!pocketTitle || layersCovered || sync.blocked || sync.loading || !session || !onExitPocketGame) return;
    const handleTitleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const key = event.key.toLowerCase();
      if (event.key.startsWith("Arrow")) {
        const direction = keyboardAction(event.key);
        if (direction && isDirection(direction)) browseFiles(direction);
      } else if (key === "z" || key === "a") {
        journeyTrigger.current?.click();
      } else if (key === "x" || key === "b" || key === "escape") {
        leave();
        onExitPocketGame();
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", handleTitleKey);
    return () => window.removeEventListener("keydown", handleTitleKey);
  }, [pocketTitle, layersCovered, sync.blocked, sync.loading, session, onExitPocketGame, leave, browseFiles]);

  function openDelete(open: boolean) {
    if (!open) {
      if (!sync.deleting) setFileToDelete(null);
      return;
    }
    if (!sync.save || sync.blocked || sync.conflict || sync.loading) return;
    setFileToDelete({
      location: getMap(sync.save).name,
      minutes: Math.floor(sync.save.playtimeSeconds / 60),
      fingerprint: saveFingerprint(sync.save),
    });
  }

  async function deleteSelectedFile() {
    if (!fileToDelete || !sync.save || sync.blocked || sync.conflict || saveFingerprint(sync.save) !== fileToDelete.fingerprint) {
      throw new Error("This file changed. Close this window and review the latest save.");
    }
    await sync.deleteSave();
  }

  return (
    <AlertDialog.Root open={!!fileToDelete} onOpenChange={openDelete}>
    <div
      className={`mesomon mm-phase-${phase}${pocketTitle ? " pocket-menu-frame pocket-file-screen" : ""}`}
      data-title-arrival={focusSelectedFile ? undefined : true}
      data-playing={playing}
      data-entry={entry}
      data-map-id={session?.save.player.mapId}
      data-player-x={session?.save.player.x}
      data-player-y={session?.save.player.y}
      data-reduced-motion={session?.save.settings.reducedMotion || undefined}
    >
      <h1 className="mm-sr-only">Mesomon</h1>
      {!session ? (
        <div className={pocketTitle ? "mm-loading pocket-lcd" : "mm-loading"}>
          <img src={MESOMON_ASSETS.cover} alt="Port Marche harbor" />
          <h2>Opening the harbor</h2>
          <p>
            {sync.loading
              ? "Finding your field notes…"
              : "Your journey is safe on this device."}
          </p>
          <button onClick={() => void sync.reload()}>Retry</button>
          <MesomonExit onExitPocketGame={onExitPocketGame} />
        </div>
      ) : (
        <>
          <main
            className={pocketTitle ? "mm-game pocket-lcd" : "mm-game"}
            data-mm-layer
            aria-hidden={layersCovered || undefined}
          >
            <div className="mm-display-slot">
              <div className="mm-screen" data-art-ready={artReady}>
                <div
                  ref={pixels}
                  className="mm-pixels"
                  aria-hidden={showBondScene || undefined}
                  role="img"
                  aria-label={`Port Marche game view. Tavian at ${session.save.player.x}, ${session.save.player.y} in ${getMap(session.save).name}.`}
                />
                {playing && bondShot && (
                  <FirstBondScene shot={bondShot} reducedMotion={reducedMotion} paused={scenePaused} />
                )}
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
                    <button onClick={() => {
                      setArtReady(false);
                      setViewError(null);
                      setViewRetry(value => value + 1);
                    }}>
                      Reload artwork
                    </button>
                  </div>
                )}
                {!playing && (
                  <div className="mm-title">
                    <HarborTitleArt />
                    <div className="mm-title-copy">
                      <small>CHAPTER I</small>
                      <h2>
                        PORT
                        <br />
                        <em>MARCHE</em>
                      </h2>
                      <p>{CHAPTER_TITLE}</p>
                      <div className="mm-slot-tabs" role="group" aria-label="Save slots">
                        {([1, 2, 3] as const).map((value) => (
                          <button
                            key={value}
                            ref={value === slot ? selectFileButton : undefined}
                            aria-pressed={value === slot}
                            onClick={() => onSlot(value)}
                          >
                            File {value}
                          </button>
                        ))}
                        {sync.save && (
                          <AlertDialog.Trigger asChild>
                            <button type="button" className="mm-delete-trigger" ref={deleteTrigger}
                              disabled={sync.loading || sync.blocked || !!sync.conflict}
                              aria-label={`Delete File ${slot}`}>
                              <Trash2 size={15} aria-hidden="true" /> Delete
                            </button>
                          </AlertDialog.Trigger>
                        )}
                      </div>
                      <div className="mm-title-actions">
                        <button
                          className="mm-primary"
                          ref={journeyTrigger}
                          disabled={sync.blocked || sync.loading || sync.deleting}
                          onClick={begin}
                        >
                          {sync.save ? "Continue journey" : "Begin journey"}
                          <ChevronRight size={18} />
                        </button>
                        <button
                          type="button"
                          className="mm-title-tool"
                          ref={menuTrigger}
                          aria-label="Settings"
                          title="Settings"
                          aria-haspopup="dialog"
                          disabled={sync.blocked}
                          onClick={() => setMenu("settings")}
                        >
                          <Settings size={20} aria-hidden="true" />
                        </button>
                        {!sync.blocked && (
                          <MesomonExit className="mm-title-tool" iconOnly onLeave={leave} onExitPocketGame={onExitPocketGame}>
                            <LogOut size={20} aria-hidden="true" />
                          </MesomonExit>
                        )}
                      </div>
                      <span className="mm-title-note" aria-live="polite" aria-atomic="true">
                        {fileDeleted && !sync.save ? `File ${slot} deleted.` : sync.save
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
                    <img src={fieldPlateUrl("rillik")} alt="Rillik" />
                    <small>MESOMON · CHAPTER I: PORT MARCHE</small>
                    <h2>
                      The harbor
                      <br />
                      has one voice.
                    </h2>
                    <p>
                      In the morning, Tavian and Nia will ask who saw Edda on the inland road. Tonight his bag stays under the bench.
                    </p>
                    <button
                      className="mm-primary"
                      onClick={() => dispatch({ type: "advance" })}
                    >
                      Revisit the harbor
                    </button>
                  </div>
                )}
              </div>
            </div>
            {playing && (
              <section
                className={`mm-event ${session.dialogue ? "mm-dialogue" : ""}`}
                data-voice={voice?.kind}
                aria-label={session.dialogue ? "Conversation" : session.save.battle ? "Battle" : "Field notes"}
              >
                {approaching ? (
                  <p className="mm-objective" role="status">
                    {approaching === "nia" ? "Nia approaches." : "Bram approaches."}
                  </p>
                ) : line && voice ? (
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
                    {choicePrompt?.length ? (
                      <div className="mm-tone-choices">
                        {choicePrompt.map((choice) => (
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
                    key={session.save.battle.id}
                    save={session.save}
                    battle={session.save.battle}
                    paused={scenePaused}
                    onBeat={advanceBattleBeat}
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
              aria-hidden={layersCovered || undefined}
            >
              <PocketDpad onDirection={press} hold={{ direction: held, start: startHold, stop: () => setHeld(null) }} />
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
              <PocketActionKeys onConfirm={() => press("confirm")} onBack={() => press("cancel")}
                confirmLabel="Confirm" backLabel="Cancel" confirmCaption="LOOK / TALK" />
            </div>
          )}
          {playing && (phase === "battle" || phase === "ending") && (
            <div className="mm-system-deck" data-mm-layer aria-hidden={layersCovered || undefined}>
              {startKey}
            </div>
          )}
          <footer className="mm-footnote" data-mm-layer aria-hidden={layersCovered || undefined}>
            {playing
              ? "Arrows / WASD · Z / Enter · X / Esc · M for Start"
              : "An independent, non-canon story in Mesoplasia."}
          </footer>
          {opening && !sync.blocked && (
            <ArrivalCinematic onFinish={finishOpening} reducedMotion={reducedMotion} />
          )}
          {!sync.blocked && menu && (
            <MesomonStartMenu
              playing={playing}
              saveStatus={sync.status}
              saveLabel={SAVE_LABELS[sync.status]}
              fullscreen={fullscreen}
              tab={menu}
              onTab={setMenu}
              session={session}
              onClose={closeMenu}
              onSettings={updateSettings}
              onExit={leave}
              onExitPocketGame={onExitPocketGame}
              onSave={() => {
                saveLocal.current(session.save);
                void sync.flush();
              }}
              onTitle={() => {
                leave();
                closeMenu();
                setEntry("title");
              }}
              onCompanion={() =>
                act({
                  type: "companion",
                  released: !session.save.questFlags.companion_released,
                })
              }
            />
          )}
          {fileToDelete && (
            <DeleteFileDialog
              slot={slot} location={fileToDelete.location} minutes={fileToDelete.minutes}
              cloud={!!(clubId && userId)}
              onDelete={deleteSelectedFile}
              onDeleted={() => {
                lastSave.current = null;
                lastCheckpoint.current = "";
                setFileDeleted(true);
                setFileToDelete(null);
              }}
              restoreFocus={() => (deleteTrigger.current || journeyTrigger.current)?.focus({ preventScroll: true })}
            />
          )}
          {sync.blocked && (
            <div className="mm-sync-alert" role="alert">
              <span>
                {sync.blockReason ||
                  "This file changed in another window. Reload it before continuing."}
              </span>
              <button onClick={() => void reloadFile()}>Reload file</button>
              <MesomonExit onLeave={leave} onExitPocketGame={onExitPocketGame} />
            </div>
          )}
          {!sync.blocked &&
            !layersCovered &&
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
      {pocketTitle && onExitPocketGame && (
        <div className="mm-control-deck" data-mm-layer aria-hidden={layersCovered || undefined}>
          <PocketDpad onDirection={browseFiles} browseLabel="Browse save files" disabled={sync.loading || sync.deleting || !session} />
          <PocketActionKeys onConfirm={begin} onBack={() => { leave(); onExitPocketGame(); }}
            confirmLabel={sync.save ? "Continue journey" : "Begin journey"} backLabel="Eject cartridge" confirmCaption="PLAY"
            disabled={!session || sync.blocked || sync.loading || sync.deleting} />
        </div>
      )}
    </div>
    </AlertDialog.Root>
  );
}
