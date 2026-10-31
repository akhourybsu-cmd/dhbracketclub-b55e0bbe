import { describe, expect, it } from "vitest";
import {
  initialPuzzleState,
  movePuzzle,
  replayPuzzle,
} from "@/lib/runedelve/puzzles/engine";
import { solvePuzzle } from "@/lib/runedelve/puzzles/solver";
import type { PuzzleRoom } from "@/lib/runedelve/puzzles/types";

function room(overrides: Partial<PuzzleRoom> = {}): PuzzleRoom {
  return {
    id: "solver-room",
    version: 1,
    order: 1,
    chapter: 1,
    title: "A deliberate detour",
    lesson: "Choose between the exit and the cache.",
    mechanic: "runes",
    width: 6,
    height: 6,
    walls: [],
    start: 7,
    exit: 14,
    stones: [{ id: "blue", color: "blue", cell: 8 }],
    sigils: [{ color: "blue", cell: 9 }],
    plates: [],
    gates: [],
    ice: [],
    treasures: [13],
    parPushes: 1,
    solution: ["down", "up", "right", "down"],
    ...overrides,
  };
}

describe("spatial Rune Delve · bounded puzzle planning", () => {
  it("can finish at the action limit using a feasible higher-push route", () => {
    const floor = new Set([0, 1, 2, 3, 6, 9, 12, 13, 14, 15, 18, 19, 20]);
    const definition = room({
      walls: Array.from({ length: 36 }, (_, cell) => cell).filter(
        (cell) => !floor.has(cell),
      ),
      start: 15,
      exit: 20,
      stones: [{ id: "blue", color: "blue", cell: 14 }],
      sigils: [{ color: "blue", cell: 15 }],
      treasures: [19],
    });
    // This physical position is reachable after 596 harmless up/down loops.
    // The one-push detour needs ten moves, but only eight actions remain.
    const state = { ...initialPuzzleState(definition), moves: 1192 };
    const result = solvePuzzle(definition, state, { maxStates: 5_000 });
    expect(result.status).toBe("solved");
    expect(result.pushes).toBe(3);
    expect(result.actions).toHaveLength(8);
    const final = result.actions.reduce(
      (current, action) => movePuzzle(definition, current, action).state,
      state,
    );
    expect(final.status).toBe("solved");
    expect(final.moves).toBe(1200);
  });

  it("prefers a longer walking detour when the shorter route wastes pushes", () => {
    const floor = new Set([0, 1, 2, 3, 6, 9, 12, 13, 14, 15, 18, 19, 20]);
    const definition = room({
      walls: Array.from({ length: 36 }, (_, cell) => cell).filter(
        (cell) => !floor.has(cell),
      ),
      start: 15,
      exit: 20,
      stones: [{ id: "blue", color: "blue", cell: 14 }],
      sigils: [{ color: "blue", cell: 15 }],
      treasures: [19],
      solution: [
        "up",
        "up",
        "left",
        "left",
        "left",
        "down",
        "down",
        "right",
        "right",
        "down",
      ],
    });
    const quick = replayPuzzle(definition, [
      "left",
      "down",
      "left",
      "left",
      "up",
      "right",
      "right",
      "down",
    ]);
    expect(quick).toMatchObject({
      valid: true,
      state: { status: "solved", moves: 8, pushes: 3 },
    });
    const result = solvePuzzle(definition, undefined, { maxStates: 5_000 });
    expect(result.status).toBe("solved");
    expect(result.pushes).toBe(1);
    expect(result.actions).toHaveLength(10);
    expect(replayPuzzle(definition, result.actions)).toMatchObject({
      valid: true,
      state: { status: "solved", pushes: 1 },
    });
  });

  it("finds the least-push solution and uses walking distance as its tie breaker", () => {
    const definition = room();
    const result = solvePuzzle(definition, initialPuzzleState(definition), {
      maxStates: 5_000,
    });
    expect(result.status).toBe("solved");
    expect(result.pushes).toBe(1);
    expect(result.actions).toHaveLength(2);
    const replay = replayPuzzle(definition, result.actions);
    expect(replay.valid).toBe(true);
    expect(replay.state.status).toBe("solved");
    expect(replay.state.collected).toEqual([]);
  });

  it("distinguishes a collected-cache return state from the same position before collection", () => {
    const definition = room();
    const result = solvePuzzle(definition, undefined, {
      maxStates: 5_000,
      requireTreasure: true,
    });
    expect(result.status).toBe("solved");
    expect(result.pushes).toBe(1);
    expect(result.actions).toHaveLength(4);
    const replay = replayPuzzle(definition, result.actions);
    expect(replay.valid).toBe(true);
    expect(replay.state.status).toBe("solved");
    expect(replay.state.collected).toEqual([13]);
  });

  it("plans through a hero-held plate and a gate which closes behind the player", () => {
    const floor = new Set([7, 8, 9, 15, 16, 21, 22]);
    const definition = room({
      walls: Array.from({ length: 36 }, (_, cell) => cell).filter(
        (cell) => !floor.has(cell),
      ),
      start: 7,
      exit: 22,
      plates: [7],
      gates: [8],
      mechanic: "gates",
      stones: [{ id: "blue", color: "blue", cell: 15 }],
      sigils: [{ color: "blue", cell: 21 }],
      treasures: [16],
      solution: ["right", "right", "down", "right", "down"],
    });
    const result = solvePuzzle(definition, undefined, {
      maxStates: 5_000,
      requireTreasure: true,
    });
    expect(result.status).toBe("solved");
    expect(result.pushes).toBe(1);
    expect(result.actions).toHaveLength(5);
    expect(replayPuzzle(definition, result.actions)).toMatchObject({
      valid: true,
      state: { status: "solved", collected: [16] },
    });
  });

  it("detects a deadlocked corner rather than inventing a shuffle or a hint", () => {
    const definition = room({
      stones: [{ id: "blue", color: "blue", cell: 0 }],
    });
    const before = JSON.stringify(definition);
    const result = solvePuzzle(definition, undefined, { maxStates: 500 });
    expect(result.status).toBe("unsolvable");
    expect(result.actions).toEqual([]);
    expect(result.explored).toBeLessThanOrEqual(500);
    expect(JSON.stringify(definition)).toBe(before);
  });

  it("returns a bounded-budget outcome instead of stalling a hint request", () => {
    const definition = room();
    const state = initialPuzzleState(definition);
    const before = JSON.stringify(state);
    const result = solvePuzzle(definition, state, { maxStates: 1 });
    expect(result.status).toBe("budget");
    expect(result.actions).toEqual([]);
    expect(result.explored).toBeLessThanOrEqual(1);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("returns no new actions for an already-completed board", () => {
    const definition = room();
    const final = replayPuzzle(definition, ["right", "down"]).state;
    const result = solvePuzzle(definition, final, { maxStates: 1 });
    expect(result.status).toBe("solved");
    expect(result.actions).toEqual([]);
  });
});
