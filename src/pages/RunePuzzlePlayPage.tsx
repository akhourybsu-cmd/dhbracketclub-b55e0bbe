import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CircleHelp,
  DoorOpen,
  Gem,
  Lightbulb,
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
  finished: "This chamber is already restored.",
};

export default function RunePuzzlePlayPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const query = useRunePuzzleProgress();
  const room = getPuzzleRoom(roomId ?? "");
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
      key={`${user.id}:${room.id}:${room.version}`}
      room={room}
      userId={user.id}
      avatar={query.data.avatar}
    />
  );
}

function PuzzleRoomSession({
  room,
  userId,
  avatar,
}: {
  room: PuzzleRoom;
  userId: string;
  avatar: HeroClass;
}) {
  const complete = useCompleteRunePuzzle();
  const { play } = useRuneDelveSfx();
  const navigate = useNavigate();
  const viewport = useRuneViewport();
  const [initial] = useState(() => inspectPuzzleCheckpoint(userId, room));
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
    [paused, setPaused] = useState(false);
  const {
    busy: hintBusy,
    direction: hintDirection,
    message: hintMessage,
    clear: clearHint,
    request: requestHint,
  } = useRunePuzzleHint(room);
  const helpFocus = useRuneDialogFocus(),
    resultFocus = useRuneDialogFocus();
  const stars = receipt?.stars ?? 0,
    sigils = puzzleSigilsFilled(room, state),
    allSigils = sigils === room.sigils.length;
  const treasure = state.collected.length === room.treasures.length;
  const frozen = state.status === "solved" || saving || help || paused;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (receipt) return;
    if (!writePuzzleCheckpoint(userId, room, route)) setStorageProblem(true);
  }, [userId, room, route, receipt]);
  const commit = useCallback(
    (next: RouteState, nextState: PuzzleState) => {
      routeRef.current = next;
      stateRef.current = nextState;
      clearHint();
      setRoute(next);
      setNotice("");
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
        move.state.collected.length > current.collected.length
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
    [room, help, paused, commit, clearHint, play],
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
    clearPuzzleCheckpoint(userId, room);
    commit({ actions: [] }, initialPuzzleState(room));
  }, [receipt, room, userId, commit]);
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
      clearPuzzleCheckpoint(userId, room);
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
  }, [complete, room, userId, receipt, play]);
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

  return (
    <section
      className="rd-screen rp-screen rp-play"
      data-testid="puzzle-play"
      data-landscape={viewport.landscape}
      data-compact={viewport.short && !viewport.landscape}
      data-room={room.id}
    >
      <header className="rp-play-heading">
        <div>
          <p className="rp-eyebrow">
            CHAMBER {String(room.order).padStart(2, "0")}
          </p>
          <h1>{room.title}</h1>
        </div>
        <button
          type="button"
          className="rp-icon-button"
          aria-label="Puzzle rules"
          onClick={() => setHelp(true)}
        >
          <CircleHelp size={19} />
        </button>
      </header>
      <div className="rp-play-stage">
        <div className="rp-board-area">
          <RunePuzzleBoard
            room={room}
            state={state}
            avatar={avatar}
            disabled={frozen}
            hint={hintDirection}
            onDirection={step}
            onDistantTap={() =>
              setNotice("Tap a neighboring tile or swipe to move.")
            }
          />
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
          <p className="rp-feedback" role="status" aria-live="polite">
            {hintMessage || notice || "Tap a neighbor. Swipe a direction."}
          </p>
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
                : "An occupied plate opens every gate. A gate stays open while something occupies it."}
            </p>
          )}
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
          <DialogTitle className="rd-title">Chamber restored</DialogTitle>
          <DialogDescription>
            {receipt
              ? receipt.starsGained > 0
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
                <Link
                  className="rp-primary"
                  to={
                    nextRoom && nextRoom.order <= receipt.unlocked
                      ? puzzleRoomHref(nextRoom)
                      : "/rune-delve/journey"
                  }
                >
                  {nextRoom && nextRoom.order <= receipt.unlocked
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
