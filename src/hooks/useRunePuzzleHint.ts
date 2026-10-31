import { useCallback, useEffect, useRef, useState } from "react";
import { solvePuzzle } from "@/lib/runedelve/puzzles/solver";
import { initialPuzzleState, movePuzzle } from "@/lib/runedelve/puzzles/engine";
import type {
  PuzzleDirection,
  PuzzleRoom,
  PuzzleSolveResult,
  PuzzleState,
} from "@/lib/runedelve/puzzles/types";

/** A hint is a suggestion, never an automatic input or a paid advantage. */
export function useRunePuzzleHint(room: PuzzleRoom) {
  const worker = useRef<Worker | null>(null);
  const sequence = useRef(0),
    alive = useRef(true),
    fallbackTimer = useRef<number>(),
    pendingId = useRef<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [direction, setDirection] = useState<PuzzleDirection | null>(null);
  const [message, setMessage] = useState("");
  const invalidate = useCallback(() => {
    sequence.current++;
    pendingId.current = null;
    window.clearTimeout(fallbackTimer.current);
  }, []);
  const accept = useCallback((id: number, result?: PuzzleSolveResult) => {
    if (!alive.current || sequence.current !== id) return;
    pendingId.current = null;
    setBusy(false);
    const next = result?.status === "solved" ? result.actions[0] : null;
    setDirection(next ?? null);
    setMessage(
      next
        ? `Try moving ${next}.`
        : result?.status === "unsolvable"
          ? "A runestone is trapped. Undo a push to reopen your route."
          : "Try a different route, or undo your last push.",
    );
  }, []);
  useEffect(() => {
    alive.current = true;
    try {
      if (typeof Worker !== "undefined") {
        const next = new Worker(
          new URL("../lib/runedelve/puzzles/hint.worker.ts", import.meta.url),
          { type: "module" },
        );
        worker.current = next;
        next.onmessage = (
          event: MessageEvent<{ id: number; result?: PuzzleSolveResult }>,
        ) => {
          if (worker.current === next) accept(event.data.id, event.data.result);
        };
        next.onerror = () => {
          if (worker.current !== next) return;
          next.terminate();
          worker.current = null;
          if (pendingId.current !== null) accept(pendingId.current);
        };
      }
    } catch {
      worker.current = null;
    }
    return () => {
      alive.current = false;
      invalidate();
      worker.current?.terminate();
      worker.current = null;
    };
  }, [room.id, room.version, accept, invalidate]);
  const clear = useCallback(() => {
    invalidate();
    setDirection(null);
    setMessage("");
    setBusy(false);
  }, [invalidate]);
  const request = useCallback(
    (state: PuzzleState) => {
      if (state.status !== "playing") return;
      window.clearTimeout(fallbackTimer.current);
      const id = ++sequence.current;
      pendingId.current = id;
      setBusy(true);
      setDirection(null);
      setMessage("Finding a way through…");
      // An authored solution prefix can supply a verified next step without
      // searching. It remains a suggestion; the board never moves itself.
      const key = (value: PuzzleState) =>
        JSON.stringify([
          value.player,
          value.stones.map((stone) => [stone.id, stone.color, stone.cell]),
          [...value.collected].sort((a, b) => a - b),
        ]);
      const currentKey = key(state);
      let canonical = initialPuzzleState(room);
      for (const action of room.solution) {
        if (key(canonical) === currentKey) {
          accept(id, {
            status: "solved",
            actions: [action],
            pushes: 0,
            explored: 0,
          });
          return;
        }
        const moved = movePuzzle(room, canonical, action);
        if (!moved.moved) break;
        canonical = moved.state;
      }
      if (worker.current) {
        try {
          worker.current.postMessage({ id, room, state });
          return;
        } catch {
          worker.current.terminate();
          worker.current = null;
        }
      }
      fallbackTimer.current = window.setTimeout(() => {
        try {
          accept(id, solvePuzzle(room, state, { maxStates: 12_000 }));
        } catch {
          accept(id);
        }
      }, 20);
    },
    [room, accept],
  );
  return { busy, direction, message, clear, request };
}
