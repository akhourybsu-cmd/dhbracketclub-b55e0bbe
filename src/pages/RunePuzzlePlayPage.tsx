import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  CircleHelp,
  Compass,
  DoorOpen,
  Gem,
  Lightbulb,
  KeyRound,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Undo2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCompleteRunePuzzle,
  useRunePuzzleProgress,
} from "@/hooks/useRunePuzzles";
import { useRunePuzzleHint } from "@/hooks/useRunePuzzleHint";
import { useRuneDelveSfx } from "@/hooks/useRuneDelveSfx";
import {
  initialPuzzleState,
  movePuzzle,
  puzzleGuardianCalm,
  puzzleAreaIndex,
  puzzleSigilsFilled,
  replayPuzzle,
} from "@/lib/runedelve/puzzles/engine";
import {
  clearPuzzleCheckpoint,
  inspectPuzzleCheckpoint,
  writePuzzleCheckpoint,
} from "@/lib/runedelve/puzzles/checkpoint";
import { getPuzzleRoom, PUZZLE_ROOMS } from "@/lib/runedelve/puzzles/rooms";
import type {
  PuzzleCompletionReceipt,
  PuzzleDirection,
  PuzzleRoom,
  PuzzleState,
} from "@/lib/runedelve/puzzles/types";
import type { HeroClass } from "@/lib/runedelve/classConfig";
import type { RuneType } from "@/lib/runedelve/dungeonGenerator";
import {
  getPuzzleCoach,
  getPuzzleCoachIntro,
  getPuzzleTutorialProgress,
} from "@/lib/runedelve/puzzles/tutorial";
import { RunePuzzleBoard } from "@/components/runedelve/RunePuzzleBoard";
import {
  PuzzleDataState,
  PuzzleStars,
} from "@/components/runedelve/RunePuzzleChrome";
import { puzzleRoomHref } from "@/lib/runedelve/puzzles/links";
import { RuneEnemyArt } from "@/components/runedelve/RuneArtwork";
import { RuneSigil } from "@/components/runedelve/RuneSigil";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRuneDialogFocus } from "@/components/runedelve/useRuneDialogFocus";
import { useRuneViewport } from "@/hooks/useRuneViewport";

interface RouteState {
  actions: PuzzleDirection[];
  requestId?: string;
}
const KEY_DIRECTION: Record<string, PuzzleDirection> = {
  ArrowUp: "up",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowLeft: "left",
  w: "up",
  d: "right",
  s: "down",
  a: "left",
};
const DIRECTION_ICON = {
  up: ArrowUp,
  right: ArrowRight,
  down: ArrowDown,
  left: ArrowLeft,
};
const BLOCK_REASON = {
  wall: "Stone wall. Find another way.",
  stone: "The runestone cannot move there.",
  gate: "Hold a pressure plate to open that gate.",
  guardian: "Restore its matching sigils to calm the guardian.",
  door: "Find the matching key to unlock this door.",
  passage: "Only your delver can travel through a passage or rift.",
  finished: "This chamber is already restored.",
};
const guidancePreferenceKey = (userId: string) =>
  `rd-puzzle-guidance:v1:${encodeURIComponent(userId)}`;
function readGuidancePreference(userId: string) {
  try {
    return localStorage.getItem(guidancePreferenceKey(userId)) !== "off";
  } catch {
    return true;
  }
}

export default function RunePuzzlePlayPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [search] = useSearchParams();
  const { user } = useAuth();
  const query = useRunePuzzleProgress();
  const room = getPuzzleRoom(roomId ?? "");
  const rehearsal = search.get("tutorial") === "1" && !!room && room.order <= 3;
  if (!room)
    return (
      <section className="rd-screen rp-screen rp-data">
        <h1 className="rd-title">This chamber is uncharted.</h1>
        <Link className="rp-primary" to="/rune-delve/journey">
          Return to the journey
        </Link>
      </section>
    );
  if (query.isLoading)
    return <PuzzleDataState retry={() => void query.refetch()} />;
  if (query.isError || !query.data || !user)
    return <PuzzleDataState error retry={() => void query.refetch()} />;
  if (room.order > query.data.unlocked)
    return (
      <section className="rd-screen rp-screen rp-data">
        <h1 className="rd-title">The way is sealed.</h1>
        <p>Restore the earlier chambers to reach this portal.</p>
        <Link className="rp-primary" to="/rune-delve/journey">
          Return to the journey
        </Link>
      </section>
    );
  return (
    <PuzzleRoomSession
      key={`${user.id}:${room.id}:${room.version}:${rehearsal ? "tutorial" : "journey"}`}
      room={room}
      userId={user.id}
      avatar={query.data.avatar}
      rehearsal={rehearsal}
      rehearsalGuidance={search.get("guidance") !== "off"}
      learning={
        !query.data.records.some(
          (record) =>
            record.room_id === room.id &&
            record.definition_version === room.version,
        )
      }
    />
  );
}

function PuzzleRoomSession({
  room,
  userId,
  avatar,
  learning,
  rehearsal,
  rehearsalGuidance,
}: {
  room: PuzzleRoom;
  userId: string;
  avatar: HeroClass;
  learning: boolean;
  rehearsal: boolean;
  rehearsalGuidance: boolean;
}) {
  const complete = useCompleteRunePuzzle();
  const { play } = useRuneDelveSfx();
  const navigate = useNavigate();
  const [, setSearch] = useSearchParams();
  const viewport = useRuneViewport();
  const checkpointScope = rehearsal ? `${userId}:tutorial` : userId;
  const [trainingActive] = useState(
    () => room.order <= 3 && (learning || rehearsal),
  );
  const [initial] = useState(() =>
    inspectPuzzleCheckpoint(checkpointScope, room),
  );
  const [guidance, setGuidance] = useState(() =>
    rehearsal ? rehearsalGuidance : learning && readGuidancePreference(userId),
  );
  const [introRequested, setIntroRequested] = useState(false);
  const [route, setRoute] = useState<RouteState>(() => {
    const saved = initial.checkpoint;
    const actions = saved?.actions ?? [];
    const restored = replayPuzzle(room, actions);
    return {
      actions: restored.valid ? actions : [],
      requestId:
        restored.valid && restored.state.status === "solved"
          ? (saved?.requestId ?? crypto.randomUUID())
          : undefined,
    };
  });
  const routeRef = useRef(route);
  routeRef.current = route;
  const state = useMemo(() => {
    const replay = replayPuzzle(room, route.actions);
    return replay.valid ? replay.state : initialPuzzleState(room);
  }, [room, route.actions]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const active = useRef(true),
    busy = useRef(false),
    submitted = useRef<string | null>(null);
  const [receipt, setReceipt] = useState<PuzzleCompletionReceipt | null>(null);
  const [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState("");
  const [storageProblem, setStorageProblem] = useState(
    initial.problem === "unavailable",
  );
  const [notice, setNotice] = useState(
    initial.problem === "invalid" || initial.problem === "expired"
      ? "Your previous route could not be restored. The chamber is ready to restart."
      : "",
  );
  const [help, setHelp] = useState(false),
    [mapOpen, setMapOpen] = useState(false),
    [paused, setPaused] = useState(false);
  const {
    busy: hintBusy,
    direction: hintDirection,
    message: hintMessage,
    clear: clearHint,
    request: requestHint,
  } = useRunePuzzleHint(room);
  const helpFocus = useRuneDialogFocus(),
    mapFocus = useRuneDialogFocus(),
    resultFocus = useRuneDialogFocus();
  const stars = receipt?.stars ?? 0,
    sigils = puzzleSigilsFilled(room, state),
    allSigils = sigils === room.sigils.length;
  const treasure = state.collected.length === room.treasures.length;
  const area = puzzleAreaIndex(state.player);
  const areas = room.areas ?? [{ id: "chamber", title: room.title }];
  const discovered = state.visitedAreas ?? [area];
  const carriedKeys = state.keys ?? [];
  const coach = useMemo(
    () =>
      guidance
        ? (getPuzzleCoach(room, state, { actions: route.actions }) ??
          (introRequested ? getPuzzleCoachIntro(room) : null))
        : null,
    [guidance, introRequested, room, state, route.actions],
  );
  const tutorial = trainingActive
    ? getPuzzleTutorialProgress(room, state, {
        actions: route.actions,
      })
    : null;
  const changeGuidance = (enabled: boolean) => {
    setGuidance(enabled);
    setIntroRequested(enabled);
    setNotice("");
    clearHint();
    if (rehearsal) {
      setSearch(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set("guidance", enabled ? "on" : "off");
          return next;
        },
        { replace: true },
      );
    }
    try {
      localStorage.setItem(
        guidancePreferenceKey(userId),
        enabled ? "on" : "off",
      );
    } catch {
      /* Guidance also works without device storage. */
    }
  };
  const previousKeys = useRef([...carriedKeys]);
  const pickupTimer = useRef<number>();
  const [keyPickup, setKeyPickup] = useState<RuneType | null>(null);
  const frozen =
    state.status === "solved" || saving || help || mapOpen || paused;

  useEffect(() => {
    const keys = state.keys ?? [];
    const added = keys.find((key) => !previousKeys.current.includes(key));
    const removed = previousKeys.current.some((key) => !keys.includes(key));
    previousKeys.current = [...keys];
    if (!added) {
      if (removed) {
        window.clearTimeout(pickupTimer.current);
        setKeyPickup(null);
      }
      return;
    }
    window.clearTimeout(pickupTimer.current);
    setKeyPickup(added);
    pickupTimer.current = window.setTimeout(() => setKeyPickup(null), 1100);
  }, [state.keys]);
  useEffect(() => () => window.clearTimeout(pickupTimer.current), []);
  useEffect(() => {
    const clearPickup = () => {
      window.clearTimeout(pickupTimer.current);
      setKeyPickup(null);
    };
    if (help || mapOpen || paused || saving) clearPickup();
    const visibility = () => {
      if (document.hidden) clearPickup();
    };
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    document.addEventListener("visibilitychange", visibility);
    reduced?.addEventListener?.("change", clearPickup);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      reduced?.removeEventListener?.("change", clearPickup);
    };
  }, [help, mapOpen, paused, saving]);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (receipt) return;
    if (!writePuzzleCheckpoint(checkpointScope, room, route))
      setStorageProblem(true);
  }, [checkpointScope, room, route, receipt]);
  const commit = useCallback(
    (next: RouteState, nextState: PuzzleState) => {
      routeRef.current = next;
      stateRef.current = nextState;
      clearHint();
      setRoute(next);
      setNotice("");
      setIntroRequested(false);
    },
    [clearHint],
  );
  const step = useCallback(
    (direction: PuzzleDirection) => {
      const current = stateRef.current;
      if (
        !active.current ||
        current.status !== "playing" ||
        busy.current ||
        help ||
        mapOpen ||
        paused ||
        document.hidden
      )
        return;
      if (routeRef.current.actions.length >= 1200) {
        setNotice("Your route is long. Undo or restart to try a clearer path.");
        return;
      }
      const move = movePuzzle(room, current, direction);
      if (!move.moved) {
        clearHint();
        setNotice(
          move.reason ? BLOCK_REASON[move.reason] : "Choose another route.",
        );
        return;
      }
      const pushedStone = current.stones.find(
        (stone) =>
          move.state.stones.find((next) => next.id === stone.id)?.cell !==
          stone.cell,
      );
      play(
        move.state.collected.length > current.collected.length ||
          (move.state.keys?.length ?? 0) > (current.keys?.length ?? 0)
          ? "coin.pickup"
          : move.pushed && pushedStone
            ? `rune.fire.${pushedStone.color}`
            : "rune.tap",
      );
      const next: RouteState = {
        actions: [...routeRef.current.actions, direction],
        requestId:
          move.state.status === "solved" ? crypto.randomUUID() : undefined,
      };
      commit(next, move.state);
    },
    [room, help, mapOpen, paused, commit, clearHint, play],
  );
  const undo = useCallback(() => {
    if (
      stateRef.current.status !== "playing" ||
      busy.current ||
      !routeRef.current.actions.length
    )
      return;
    const actions = routeRef.current.actions.slice(0, -1),
      restored = replayPuzzle(room, actions);
    if (restored.valid) commit({ actions }, restored.state);
  }, [room, commit]);
  const restart = useCallback(() => {
    if (busy.current || (stateRef.current.status === "solved" && !receipt))
      return;
    setReceipt(null);
    setSaveError("");
    submitted.current = null;
    setPaused(false);
    setKeyPickup(null);
    clearPuzzleCheckpoint(checkpointScope, room);
    commit({ actions: [] }, initialPuzzleState(room));
  }, [receipt, room, checkpointScope, commit]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.metaKey ||
        event.ctrlKey ||
        event.repeat ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')
      )
        return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input,textarea,select,[contenteditable="true"]'))
        return;
      const direction =
        KEY_DIRECTION[event.key] ?? KEY_DIRECTION[event.key.toLowerCase()];
      if (direction) {
        event.preventDefault();
        step(direction);
      } else if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
    };
    const pause = () => {
      if (stateRef.current.status === "playing") {
        setPaused(true);
        clearHint();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("rune-delve:pause", pause);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("rune-delve:pause", pause);
    };
  }, [step, undo, clearHint]);
  const save = useCallback(async () => {
    const pending = routeRef.current;
    if (
      busy.current ||
      !pending.requestId ||
      stateRef.current.status !== "solved" ||
      receipt
    )
      return;
    busy.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const saved = await complete.mutateAsync({
        roomId: room.id,
        definitionVersion: room.version,
        actions: [...pending.actions],
        requestId: pending.requestId,
      });
      if (!active.current || routeRef.current.requestId !== pending.requestId)
        return;
      if (
        saved.requestId !== pending.requestId ||
        saved.roomId !== room.id ||
        saved.definitionVersion !== room.version
      )
        throw new Error("Your route could not be confirmed. Please retry.");
      setReceipt(saved);
      play("victory");
      clearPuzzleCheckpoint(checkpointScope, room);
    } catch (error) {
      if (active.current)
        setSaveError(
          error instanceof Error
            ? error.message
            : "Your route could not be saved. Please retry.",
        );
    } finally {
      if (active.current) {
        busy.current = false;
        setSaving(false);
      }
    }
  }, [complete, room, checkpointScope, receipt, play]);
  useEffect(() => {
    if (
      state.status === "solved" &&
      route.requestId &&
      !receipt &&
      submitted.current !== route.requestId
    ) {
      submitted.current = route.requestId;
      void save();
    }
  }, [state.status, route.requestId, receipt, save]);
  const nextRoom = PUZZLE_ROOMS.find((item) => item.order === room.order + 1);
  const graduated = !!receipt && room.order === 3 && trainingActive;
  const resumeRoom = receipt
    ? PUZZLE_ROOMS.find((item) => item.order === receipt.unlocked)
    : undefined;
  const nextHref =
    rehearsal && room.order === 3
      ? resumeRoom
        ? puzzleRoomHref(resumeRoom)
        : "/rune-delve/journey"
      : nextRoom && receipt && nextRoom.order <= receipt.unlocked
        ? `${puzzleRoomHref(nextRoom)}${rehearsal && nextRoom.order <= 3 ? `?tutorial=1${guidance ? "" : "&guidance=off"}` : ""}`
        : "/rune-delve/journey";

  return (
    <section
      className="rd-screen rp-screen rp-play"
      data-testid="puzzle-play"
      data-landscape={viewport.landscape}
      data-compact={viewport.short && !viewport.landscape}
      data-room={room.id}
      data-puzzle-keys={carriedKeys.join(",")}
      data-puzzle-visited={(state.visitedAreas ?? []).join(",")}
      data-tutorial-phase={tutorial?.phase ?? "none"}
      data-tutorial-replay={rehearsal}
      data-guidance={guidance ? "on" : "off"}
    >
      <header className="rp-play-heading">
        <div className="rp-play-title">
          <p className="rp-eyebrow">
            {tutorial ? (
              <span
                className="rp-tutorial-phase"
                data-testid="puzzle-tutorial-phase"
                data-phase={tutorial.phase}
              >
                {tutorial.label} {tutorial.stage}/{tutorial.stages}
              </span>
            ) : (
              `CHAMBER ${String(room.order).padStart(2, "0")}`
            )}
            {areas.length > 1 && (
              <span>
                · ROOM {area + 1}/{areas.length}
              </span>
            )}
          </p>
          <h1>
            {areas.length > 1 ? (areas[area]?.title ?? room.title) : room.title}
          </h1>
        </div>
        <div className="rp-play-heading-tools">
          {areas.length > 1 && (
            <button
              type="button"
              className="rp-icon-button rp-map-trigger"
              aria-label="Open chamber map"
              disabled={state.status === "solved" || saving}
              onClick={() => setMapOpen(true)}
            >
              <Compass size={19} />
              <small>
                {discovered.length}/{areas.length}
              </small>
            </button>
          )}
          <button
            type="button"
            className="rp-icon-button"
            aria-label="Puzzle rules"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={19} />
          </button>
        </div>
      </header>
      <div className="rp-play-stage">
        <div className="rp-board-area">
          <RunePuzzleBoard
            room={room}
            state={state}
            avatar={avatar}
            disabled={frozen}
            motionPaused={help || mapOpen || paused || saving}
            hint={hintDirection}
            coachedCell={hintDirection ? undefined : coach?.cell}
            onDirection={step}
            onDistantTap={() =>
              setNotice("Tap a neighboring tile or swipe to move.")
            }
          />
          {keyPickup && (
            <div
              className="rp-key-discovery"
              data-color={keyPickup}
              role="status"
              aria-live="polite"
            >
              <span>
                <KeyRound />
              </span>
              <strong>Key discovered</strong>
              <small>Matching locks are open</small>
            </div>
          )}
          {paused && (
            <div className="rp-pause">
              <b>Take a breath.</b>
              <p>
                {storageProblem
                  ? "Your board stays here while this screen is open."
                  : "Your route is saved on this device."}
              </p>
              <button
                className="rp-primary"
                type="button"
                onClick={() => setPaused(false)}
              >
                Resume puzzle
              </button>
            </div>
          )}
        </div>
        <aside className="rp-play-deck">
          <div className="rp-goal">
            <span aria-hidden="true">
              <Sparkles size={16} />
            </span>
            <b>
              {allSigils
                ? "Reach the glowing portal"
                : "Restore the matching sigils"}
            </b>
            {room.keys?.length || room.doors?.length ? (
              <span
                className="rp-keyring"
                role="img"
                aria-label={`Keys carried: ${carriedKeys.join(", ") || "none"}`}
              >
                {carriedKeys.length ? (
                  carriedKeys.map((color) => (
                    <KeyRound
                      key={color}
                      data-color={color}
                      aria-hidden="true"
                    />
                  ))
                ) : (
                  <KeyRound className="is-missing" aria-hidden="true" />
                )}
              </span>
            ) : null}
            <span>
              {sigils}/{room.sigils.length}
            </span>
          </div>
          <div
            className="rp-sigil-track"
            aria-label={`${sigils} of ${room.sigils.length} sigils restored`}
          >
            {room.sigils.map((sigil, index) => (
              <span
                key={index}
                data-color={sigil.color}
                className={
                  state.stones.some(
                    (stone) =>
                      stone.cell === sigil.cell && stone.color === sigil.color,
                  )
                    ? "is-lit"
                    : ""
                }
              >
                <RuneSigil type={sigil.color} />
              </span>
            ))}
            <DoorOpen
              className={allSigils ? "is-open" : ""}
              aria-hidden="true"
            />
          </div>
          <div className="rp-route-stats">
            <span>
              <b>{state.pushes}</b> pushes <small>par {room.parPushes}</small>
            </span>
            <span>
              <b>{state.moves}</b> steps
            </span>
            <span>
              <Gem size={15} />
              <b>
                {state.collected.length}/{room.treasures.length}
              </b>
            </span>
          </div>
          <p className="rp-lesson">{room.lesson}</p>
          {room.guardian && (
            <div className="rp-guardian-card">
              <span>
                <RuneEnemyArt
                  archetypeId={room.guardian.archetypeId}
                  name={room.guardian.name}
                />
              </span>
              <div>
                <b>{room.guardian.name}</b>
                <small>
                  {puzzleGuardianCalm(room, state)
                    ? "The ward is calm"
                    : "Restore its matching sigils"}
                </small>
              </div>
            </div>
          )}
          <div
            className="rp-feedback"
            role="status"
            aria-live="polite"
            data-coaching={!!coach && !hintMessage && !notice}
          >
            {hintMessage ||
              notice ||
              (coach ? (
                <span className="rp-tutorial-controls">
                  <span
                    className="rp-coach"
                    data-testid="puzzle-coach"
                    data-coach-step={coach.id}
                    data-coach-phase={tutorial?.phase ?? "introduction"}
                    data-coach-step-index={tutorial?.step}
                    data-coach-step-count={tutorial?.steps}
                  >
                    <Lightbulb aria-hidden="true" />
                    <span>
                      <b>
                        {coach.title}
                        {tutorial?.phase === "learn" && (
                          <small className="rp-coach-step">
                            {" "}
                            · Step {tutorial.step}/{tutorial.steps}
                          </small>
                        )}
                      </b>
                      <small>{coach.text}</small>
                    </span>
                  </span>
                  <button
                    type="button"
                    className="rp-coach-dismiss"
                    aria-label="Try on my own"
                    title="Try on my own"
                    onClick={() => changeGuidance(false)}
                  >
                    Solo
                  </button>
                </span>
              ) : (
                "Tap a neighbor. Swipe a direction."
              ))}
          </div>
          {(viewport.landscape || !viewport.short) && (
            <div className="rp-direction-pad" aria-label="Move delver">
              {(["left", "up", "down", "right"] as PuzzleDirection[]).map(
                (direction) => {
                  const Icon = DIRECTION_ICON[direction];
                  return (
                    <button
                      type="button"
                      disabled={frozen}
                      key={direction}
                      aria-label={`Move ${direction}`}
                      onClick={() => step(direction)}
                    >
                      <Icon size={18} />
                    </button>
                  );
                },
              )}
            </div>
          )}
          <div className="rp-command-deck">
            <button
              type="button"
              disabled={frozen || !route.actions.length}
              onClick={undo}
              aria-label="Undo last step"
            >
              <Undo2 size={18} />
              <span>Undo</span>
            </button>
            <button
              type="button"
              disabled={frozen}
              onClick={restart}
              aria-label="Restart chamber"
            >
              <RotateCcw size={18} />
              <span>Restart</span>
            </button>
            <button
              type="button"
              disabled={frozen || hintBusy}
              onClick={() => requestHint(stateRef.current)}
              aria-label="Show a hint"
            >
              <Lightbulb size={18} />
              <span>{hintBusy ? "Thinking…" : "Hint"}</span>
            </button>
          </div>
          {storageProblem && (
            <p className="rp-storage-warning" role="status">
              Device storage is unavailable. Resume may not work after leaving.
            </p>
          )}
        </aside>
      </div>
      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent {...mapFocus} className="rd-dialog-theme rp-map-dialog">
          <DialogTitle className="rd-title">Chamber map</DialogTitle>
          <DialogDescription>
            {room.title} · {discovered.length}/{areas.length} rooms explored
          </DialogDescription>
          <div className="rp-discovery-map">
            {areas.map((place, index) => {
              const known = discovered.includes(index);
              const localSigils = room.sigils.filter(
                (sigil) => puzzleAreaIndex(sigil.cell) === index,
              );
              const lit = localSigils.filter((sigil) =>
                state.stones.some(
                  (stone) =>
                    stone.cell === sigil.cell && stone.color === sigil.color,
                ),
              ).length;
              return (
                <article
                  key={place.id}
                  data-map-area={index}
                  data-discovered={known}
                  aria-current={area === index ? "location" : undefined}
                  className={`${known ? "is-discovered" : "is-unknown"}${area === index ? " is-current" : ""}`}
                >
                  <span>{known ? <Compass /> : <LockKeyhole />}</span>
                  <small>ROOM {String(index + 1).padStart(2, "0")}</small>
                  <h3>{known ? place.title : "Uncharted room"}</h3>
                  <p>
                    {known
                      ? `${lit}/${localSigils.length} sigils restored`
                      : "Find a doorway to reveal it"}
                  </p>
                  {area === index && <b>You are here</b>}
                </article>
              );
            })}
          </div>
          <div className="rp-map-links" aria-label="Discovered connections">
            {room.passages
              ?.filter(
                (passage) =>
                  puzzleAreaIndex(passage.a) !== puzzleAreaIndex(passage.b) &&
                  (discovered.includes(puzzleAreaIndex(passage.a)) ||
                    discovered.includes(puzzleAreaIndex(passage.b))),
              )
              .map((passage, index) => {
                const a = puzzleAreaIndex(passage.a),
                  b = puzzleAreaIndex(passage.b);
                return (
                  <span key={index}>
                    {discovered.includes(a) ? `Room ${a + 1}` : "?"}{" "}
                    <ArrowLeftRight size={12} aria-hidden="true" />{" "}
                    {discovered.includes(b) ? `Room ${b + 1}` : "?"}
                  </span>
                );
              })}
          </div>
          <p className="rp-map-note">
            Doorways connect the rooms. Walk back to revisit your discoveries.
          </p>
          <button
            type="button"
            className="rp-primary"
            onClick={() => setMapOpen(false)}
          >
            Return to exploration
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent
          {...helpFocus}
          className="rd-dialog-theme rp-rules-dialog"
        >
          <DialogTitle className="rd-title">Read the room</DialogTitle>
          <DialogDescription>
            Plan a route. Every push matters.
          </DialogDescription>
          <div className="rp-rules-grid">
            <article>
              <RuneSigil type="blue" />
              <b>Restore</b>
              <p>Push each runestone onto its matching sigil.</p>
            </article>
            <article>
              <DoorOpen />
              <b>Escape</b>
              <p>Stand on the portal once all sigils are lit.</p>
            </article>
            <article>
              <Gem />
              <b>Master</b>
              <p>Collect the cache. Reach par pushes for another star.</p>
            </article>
            <article>
              <Undo2 />
              <b>Experiment</b>
              <p>Tap neighbors or swipe. Undo and restart freely.</p>
            </article>
          </div>
          {room.mechanic !== "runes" && (
            <p className="rp-rule-note">
              {room.mechanic === "ice"
                ? "Pushed stones slide across ice until clear ground or an obstacle."
                : room.mechanic === "passages"
                  ? "Step into a doorway to travel. Runes stay in their room; every room keeps its state."
                  : room.mechanic === "keys"
                    ? "Collect a colored key to open every matching lock across the chamber. Keys are reusable."
                    : room.mechanic === "rifts"
                      ? "Rifts move your delver to their paired endpoint. Runes cannot enter a doorway or rift."
                      : "An occupied plate opens every gate. A gate stays open while something occupies it."}
            </p>
          )}
          <button
            type="button"
            className="rp-guidance-toggle rp-secondary"
            aria-label={guidance ? "Turn guidance off" : "Turn guidance on"}
            aria-pressed={guidance}
            onClick={() => changeGuidance(!guidance)}
          >
            <Lightbulb size={17} aria-hidden="true" />
            {guidance ? "Guidance on · Try on my own" : "Turn guidance on"}
          </button>
          <button
            type="button"
            className="rp-primary"
            onClick={() => setHelp(false)}
          >
            Back to the chamber
          </button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={state.status === "solved"}
        onOpenChange={(open) => {
          if (!open && receipt) navigate("/rune-delve/journey");
        }}
      >
        <DialogContent
          {...resultFocus}
          className="rd-dialog-theme rp-result-dialog"
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (!receipt) event.preventDefault();
          }}
        >
          <p className="rp-eyebrow">DH CLUB ✦ RUNE DELVE</p>
          <span className="rp-result-seal" aria-hidden="true">
            <DoorOpen />
          </span>
          <DialogTitle
            className={`rd-title${graduated ? " rp-tutorial-graduation" : ""}`}
          >
            {graduated ? "Tutorial complete" : "Chamber restored"}
          </DialogTitle>
          <DialogDescription>
            {receipt
              ? graduated
                ? "The Hollow is yours to explore. New mechanics arrive as your journey unfolds."
                : tutorial?.phase === "learn"
                  ? "Learn complete. Next, find a route of your own in Practice."
                  : tutorial?.phase === "practice"
                    ? "Practice complete. Your Trial brings the skills together."
                    : receipt.starsGained > 0
                      ? `+${receipt.starsGained} mastery star${receipt.starsGained > 1 ? "s" : ""} added to your journey.`
                      : "Your best mastery is retained. Every return is a chance to refine the route."
              : "Saving your route and mastery…"}
          </DialogDescription>
          <PuzzleStars count={stars} label="Saved best mastery" />
          <div className="rp-result-objectives">
            <span className="is-done">
              <Sparkles size={16} /> Restore the sigils
            </span>
            <span className={state.pushes <= room.parPushes ? "is-done" : ""}>
              <ArrowRight size={16} /> {state.pushes} pushes · par{" "}
              {room.parPushes}
            </span>
            <span className={treasure ? "is-done" : ""}>
              <Gem size={16} />{" "}
              {treasure ? "Cache recovered" : "Cache still hidden"}
            </span>
          </div>
          {saveError && (
            <p className="rp-error" role="alert">
              {saveError}
            </p>
          )}
          <div className="rp-result-actions">
            {!receipt ? (
              <button
                type="button"
                className="rp-primary"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Retry save"}
              </button>
            ) : (
              <>
                <Link className="rp-primary" to={nextHref}>
                  {rehearsal && room.order === 3
                    ? "Continue your journey"
                    : nextRoom && nextRoom.order <= receipt.unlocked
                      ? "Enter the next chamber"
                      : "Return to the journey"}
                  <ArrowRight size={17} />
                </Link>
                <button
                  type="button"
                  className="rp-secondary"
                  onClick={restart}
                >
                  Refine this route
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
