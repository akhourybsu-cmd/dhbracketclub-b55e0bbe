import { useLayoutEffect, useRef, useState } from "react";
import {
  puzzleAreaIndex,
  puzzleNeighbor,
  puzzleOpenGates,
  puzzlePassageDestination,
  puzzleSigilsFilled,
} from "@/lib/runedelve/puzzles/engine";
import type { PuzzleRoom, PuzzleState } from "@/lib/runedelve/puzzles/types";

export const PUZZLE_MOTION_MS = 420;
export interface PuzzleMotionActor {
  id: string;
  from: number;
  to: number;
  color?: PuzzleState["stones"][number]["color"];
}
export interface PuzzleMotion {
  sequence: number;
  kind: "step" | "push" | "travel";
  actors: PuzzleMotionActor[];
  effects: Map<number, string[]>;
}

/** Visual receipts for one committed forward input. Never queues or simulates moves. */
export function useRunePuzzleMotion(
  room: PuzzleRoom,
  state: PuzzleState,
  paused = false,
) {
  const previous = useRef({ room: `${room.id}:${room.version}`, state });
  const sequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [motion, setMotion] = useState<PuzzleMotion | null>(null);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [hidden, setHidden] = useState(() => document.hidden);

  useLayoutEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const preference = () => setReduced(query.matches);
    const visibility = () => setHidden(document.hidden);
    query.addEventListener("change", preference);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      query.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", visibility);
      clearTimeout(timer.current);
    };
  }, []);

  useLayoutEffect(() => {
    const baseline = previous.current;
    previous.current = { room: `${room.id}:${room.version}`, state };
    clearTimeout(timer.current);
    if (
      paused || reduced || hidden || document.hidden ||
      baseline.room !== `${room.id}:${room.version}` ||
      state.moves !== baseline.state.moves + 1 ||
      state.pushes < baseline.state.pushes
    ) {
      setMotion(null);
      return;
    }
    const before = baseline.state;
    const area = puzzleAreaIndex(state.player);
    const entry = puzzlePassageDestination(room, state.player);
    const crossedPassage = entry !== null &&
      (["up", "right", "down", "left"] as const).some(
        (direction) => puzzleNeighbor(room, before.player, direction) === entry,
      );
    // A rift can fold within the same room, even back to the starting cell.
    // Show arrival rather than sliding the delver through intervening walls.
    const travel = crossedPassage || puzzleAreaIndex(before.player) !== area;
    const effects = new Map<number, string[]>();
    const effect = (cell: number, type: string) => {
      if (puzzleAreaIndex(cell) === area)
        effects.set(cell, [...(effects.get(cell) ?? []), type]);
    };
    const actors: PuzzleMotionActor[] = [];
    if (!travel && before.player !== state.player)
      actors.push({ id: "delver", from: before.player, to: state.player });
    for (const stone of state.stones) {
      const old = before.stones.find((item) => item.id === stone.id);
      if (old && old.cell !== stone.cell && puzzleAreaIndex(stone.cell) === area)
        actors.push({ id: stone.id, from: old.cell, to: stone.cell, color: stone.color });
    }
    for (const sigil of room.sigils) {
      const matched = (snapshot: PuzzleState) => snapshot.stones.some(
        (stone) => stone.cell === sigil.cell && stone.color === sigil.color,
      );
      if (!matched(before) && matched(state)) effect(sigil.cell, "seal");
    }
    for (const cell of state.collected)
      if (!before.collected.includes(cell)) effect(cell, "pickup");
    for (const key of room.keys ?? [])
      if (state.keys?.includes(key.color) && !before.keys?.includes(key.color))
        effect(key.cell, "pickup");
    const beforeGates = new Set(puzzleOpenGates(room, before));
    const gates = new Set(puzzleOpenGates(room, state));
    for (const cell of room.gates)
      if (beforeGates.has(cell) !== gates.has(cell)) effect(cell, "gate");
    for (const door of room.doors ?? [])
      if (state.keys?.includes(door.color) && !before.keys?.includes(door.color))
        effect(door.cell, "door");
    if (puzzleSigilsFilled(room, before) < room.sigils.length &&
      puzzleSigilsFilled(room, state) === room.sigils.length)
      effect(room.exit, "portal");
    // A legal input changes at most the delver and one stone. The cap also
    // bounds rendering if a future resolver introduces several moved actors.
    const next: PuzzleMotion = {
      sequence: ++sequence.current,
      kind: travel ? "travel" : state.pushes > before.pushes ? "push" : "step",
      actors: actors.slice(0, 5),
      effects,
    };
    setMotion(next);
    timer.current = setTimeout(() => setMotion(null), PUZZLE_MOTION_MS);
  }, [room, state, paused, reduced, hidden]);

  return { motion, sequence: sequence.current, paused: paused || reduced || hidden };
}
