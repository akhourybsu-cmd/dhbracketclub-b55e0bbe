import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRunePuzzleHint } from "@/hooks/useRunePuzzleHint";
import {
  initialPuzzleState,
  puzzleStars,
  replayPuzzle,
} from "@/lib/runedelve/puzzles/engine";
import { puzzleStateKey, solvePuzzle } from "@/lib/runedelve/puzzles/solver";
import type { PuzzleRoom } from "@/lib/runedelve/puzzles/types";

/** The key is in a dead end: leaving it returns to an identical physical board.
 * A planner must retain that newly gained inventory instead of pruning it. */
function keyDetour(): PuzzleRoom {
  const floor = new Set([1, 7, 13, 14, 15, 16, 19, 20, 21, 22, 28]);
  return {
    id: "key-history",
    version: 1,
    order: 1,
    chapter: 5,
    title: "A remembered key",
    lesson: "Bring the key back to the lock.",
    mechanic: "keys",
    width: 6,
    height: 6,
    walls: Array.from({ length: 36 }, (_, cell) => cell).filter(
      (cell) => !floor.has(cell),
    ),
    start: 7,
    exit: 28,
    stones: [{ id: "blue", color: "blue", cell: 20 }],
    sigils: [{ color: "blue", cell: 21 }],
    plates: [],
    gates: [],
    ice: [],
    treasures: [13],
    keys: [{ color: "red", cell: 1 }],
    doors: [{ color: "red", cell: 15 }],
    parPushes: 1,
    solution: [
      "up",
      "down",
      "down",
      "down",
      "right",
      "up",
      "right",
      "right",
      "down",
      "down",
    ],
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("adventure planning and hint history", () => {
  it("plans a required key detour even when it returns to the same physical position", () => {
    const room = keyDetour();
    const result = solvePuzzle(room, undefined, {
      maxStates: 5_000,
      requireTreasure: true,
    });
    expect(result.status).toBe("solved");
    expect(result.pushes).toBe(1);
    expect(result.actions).toHaveLength(10);
    const replay = replayPuzzle(room, result.actions);
    expect(replay.valid).toBe(true);
    expect(replay.state.keys).toEqual(["red"]);
    expect(puzzleStars(room, replay.state)).toBe(3);
  });

  it("includes key inventory in solver identity while ignoring cosmetic discovery history", () => {
    const room = keyDetour();
    const start = initialPuzzleState(room);
    const returned = replayPuzzle(room, ["up", "down"]).state;
    expect(returned.player).toBe(start.player);
    expect(returned.stones).toEqual(start.stones);
    expect(returned.collected).toEqual(start.collected);
    expect(puzzleStateKey(returned)).not.toBe(puzzleStateKey(start));
    expect(puzzleStateKey({ ...returned, visitedAreas: [0, 1, 2] })).toBe(
      puzzleStateKey(returned),
    );
  });

  it("does not reuse the earlier authored hint after the same board has acquired a key", () => {
    vi.stubGlobal("Worker", undefined);
    const room = keyDetour();
    const { result } = renderHook(() => useRunePuzzleHint(room));
    act(() => result.current.request(initialPuzzleState(room)));
    expect(result.current.direction).toBe("up");
    const returned = replayPuzzle(room, ["up", "down"]).state;
    act(() => result.current.request(returned));
    expect(result.current.direction).toBe("down");
    expect(result.current.message).toBe("Try moving down.");
    expect(result.current.busy).toBe(false);
  });
});
