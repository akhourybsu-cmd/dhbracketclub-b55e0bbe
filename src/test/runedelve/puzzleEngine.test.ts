import { describe, expect, it } from "vitest";
import {
  initialPuzzleState,
  movePuzzle,
  puzzleGuardianCalm,
  puzzleOpenGates,
  puzzleSigilsFilled,
  puzzleStars,
  replayPuzzle,
  validatePuzzleRoom,
} from "@/lib/runedelve/puzzles/engine";
import type {
  PuzzleDirection,
  PuzzleRoom,
  PuzzleState,
} from "@/lib/runedelve/puzzles/types";

function room(overrides: Partial<PuzzleRoom> = {}): PuzzleRoom {
  return {
    id: "test-room",
    version: 1,
    order: 1,
    chapter: 1,
    title: "The first sigil",
    lesson: "Restore the sigil and reach the portal.",
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
function frozen<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) frozen(entry);
    Object.freeze(value);
  }
  return value;
}
function walk(definition: PuzzleRoom, actions: PuzzleDirection[]): PuzzleState {
  const result = replayPuzzle(definition, actions);
  expect(result.valid).toBe(true);
  return result.state;
}

describe("spatial Rune Delve · movement and room victory", () => {
  it("requires both matching sigils and reaching the exit, with the final legal move winning", () => {
    const definition = room();
    const untouched = walk(definition, ["down", "right"]);
    expect(untouched.player).toBe(definition.exit);
    expect(untouched.status).toBe("playing");
    const restored = walk(definition, ["right"]);
    expect(puzzleSigilsFilled(definition, restored)).toBe(1);
    expect(restored.status).toBe("playing");
    const escaped = movePuzzle(definition, restored, "down");
    expect(escaped.moved).toBe(true);
    expect(escaped.state.status).toBe("solved");
    expect(escaped.state.moves).toBe(2);
    expect(escaped.state.pushes).toBe(1);
  });

  it("does not treat a stone on the wrong-colored sigil as restored", () => {
    const definition = room({
      stones: [
        { id: "blue", color: "blue", cell: 8 },
        { id: "red", color: "red", cell: 15 },
      ],
      sigils: [
        { color: "red", cell: 9 },
        { color: "blue", cell: 15 },
      ],
      exit: 35,
    });
    const state = walk(definition, ["right"]);
    expect(puzzleSigilsFilled(definition, state)).toBe(0);
    expect(state.status).toBe("playing");
  });

  it("prevents row wrapping and ignores blocked moves without spending a turn", () => {
    const definition = room({ start: 5 });
    const state = initialPuzzleState(definition);
    const blocked = movePuzzle(definition, state, "right");
    expect(blocked.moved).toBe(false);
    expect(blocked.reason).toBe("wall");
    expect(blocked.state).toEqual(state);
    expect(blocked.state.moves).toBe(0);
  });

  it("never pushes a second stone and never mutates frozen definitions or states", () => {
    const definition = frozen(
      room({
        stones: [
          { id: "blue", color: "blue", cell: 8 },
          { id: "red", color: "red", cell: 9 },
        ],
        sigils: [
          { color: "blue", cell: 10 },
          { color: "red", cell: 11 },
        ],
      }),
    );
    const state = frozen(initialPuzzleState(definition));
    const blocked = movePuzzle(definition, state, "right");
    expect(blocked.moved).toBe(false);
    expect(blocked.reason).toBe("stone");
    expect(blocked.state).toEqual(state);
    const moved = movePuzzle(definition, state, "down");
    expect(moved.state.player).toBe(13);
    expect(state.player).toBe(7);
    expect(definition.stones.map((stone) => stone.cell)).toEqual([8, 9]);
  });

  it("collects treasure only with the hero, and only once", () => {
    const definition = room();
    const loop = walk(definition, ["down", "up", "down"]);
    expect(loop.collected).toEqual([13]);
    const underStone = room({
      treasures: [9],
      sigils: [{ color: "blue", cell: 10 }],
    });
    const pushed = walk(underStone, ["right"]);
    expect(pushed.stones[0].cell).toBe(9);
    expect(pushed.collected).toEqual([]);
  });

  it("retains living guardians on a solved board and opens their tile when their sigils are restored", () => {
    const definition = room({
      exit: 35,
      guardian: {
        cell: 13,
        color: "blue",
        archetypeId: "rune_wraith",
        name: "Rune Wraith",
      },
    });
    const initial = initialPuzzleState(definition);
    expect(puzzleGuardianCalm(definition, initial)).toBe(false);
    expect(movePuzzle(definition, initial, "down")).toMatchObject({
      moved: false,
      reason: "guardian",
    });
    const restored = walk(definition, ["right", "left"]);
    expect(puzzleGuardianCalm(definition, restored)).toBe(true);
    expect(movePuzzle(definition, restored, "down").state.player).toBe(13);
    const solved = walk(definition, [
      "right",
      "down",
      "down",
      "down",
      "down",
      "right",
      "right",
      "right",
    ]);
    expect(solved.status).toBe("solved");
    expect(definition.guardian?.name).toBe("Rune Wraith");
  });

  it("cannot push through a guardian that reactivated under the stone", () => {
    const definition = room({
      start: 6,
      exit: 35,
      stones: [{ id: "blue", color: "blue", cell: 7 }],
      sigils: [{ color: "blue", cell: 7 }],
      guardian: {
        cell: 8,
        color: "blue",
        archetypeId: "rune_wraith",
        name: "Rune Wraith",
      },
    });
    const before = initialPuzzleState(definition);
    expect(puzzleGuardianCalm(definition, before)).toBe(true);
    const moved = movePuzzle(definition, before, "right");
    expect(moved.moved).toBe(true);
    expect(moved.state.stones[0].cell).toBe(8);
    expect(puzzleGuardianCalm(definition, moved.state)).toBe(false);
    const blocked = movePuzzle(definition, moved.state, "right");
    expect(blocked).toMatchObject({ moved: false, reason: "guardian" });
    expect(blocked.state).toEqual(moved.state);
  });

  it("keeps completion immutable and rejects malformed or padded action receipts", () => {
    const definition = room();
    const state = walk(definition, ["right", "down"]);
    expect(movePuzzle(definition, state, "left")).toMatchObject({
      moved: false,
      reason: "finished",
      state,
    });
    expect(
      replayPuzzle(definition, ["north"] as unknown as PuzzleDirection[]).valid,
    ).toBe(false);
    expect(replayPuzzle(room({ start: 5 }), ["right"]).valid).toBe(false);
    expect(replayPuzzle(definition, ["right", "down", "left"]).valid).toBe(
      false,
    );
    expect(replayPuzzle(definition, Array(1201).fill("up"))).toMatchObject({
      valid: false,
      error: "invalid_actions",
      state: { moves: 0 },
    });
    expect(
      replayPuzzle(definition, null as unknown as PuzzleDirection[]).valid,
    ).toBe(false);
  });

  it("awards distinct solve, push-efficiency and treasure medals", () => {
    const definition = room();
    expect(puzzleStars(definition, initialPuzzleState(definition))).toBe(0);
    const direct = walk(definition, ["right", "down"]);
    expect(puzzleStars(definition, direct)).toBe(2);
    const full = walk(definition, definition.solution);
    expect(puzzleStars(definition, full)).toBe(3);
    expect(puzzleStars(definition, { ...full, pushes: 2 })).toBe(2);
  });
});

describe("spatial Rune Delve · plate and gate dependencies", () => {
  it("opens all gates from a hero plate, and holds only an occupied gate after the plate is released", () => {
    const definition = room({
      start: 7,
      exit: 35,
      stones: [{ id: "blue", color: "blue", cell: 20 }],
      sigils: [{ color: "blue", cell: 21 }],
      plates: [7],
      gates: [8, 25],
      mechanic: "gates",
    });
    const initial = initialPuzzleState(definition);
    expect(puzzleOpenGates(definition, initial)).toEqual([8, 25]);
    const onGate = movePuzzle(definition, initial, "right");
    expect(onGate.moved).toBe(true);
    expect(puzzleOpenGates(definition, onGate.state)).toEqual([8]);
    const beyond = movePuzzle(definition, onGate.state, "right");
    expect(beyond.moved).toBe(true);
    expect(puzzleOpenGates(definition, beyond.state)).toEqual([]);
    expect(movePuzzle(definition, beyond.state, "left")).toMatchObject({
      moved: false,
      reason: "gate",
    });
  });

  it("lets a stone hold a gate until it and the hero have vacated", () => {
    const definition = room({
      exit: 35,
      plates: [9],
      gates: [10, 25],
      sigils: [{ color: "blue", cell: 11 }],
      mechanic: "gates",
    });
    const first = walk(definition, ["right"]);
    expect(puzzleOpenGates(definition, first)).toEqual([10, 25]);
    const stoneOnGate = walk(definition, ["right", "right", "up"]);
    expect(stoneOnGate.stones[0].cell).toBe(10);
    expect(puzzleOpenGates(definition, stoneOnGate)).toEqual([10]);
    const vacated = walk(definition, ["right", "right", "right", "down"]);
    expect(puzzleOpenGates(definition, vacated)).toEqual([]);
  });
});

describe("spatial Rune Delve · ice is a deliberate pushing rule", () => {
  it("slides a pushed stone across ice, stopping on the first ordinary tile with one push", () => {
    const definition = room({
      exit: 35,
      ice: [9, 10],
      sigils: [{ color: "blue", cell: 11 }],
      mechanic: "ice",
    });
    const state = walk(definition, ["right"]);
    expect(state.player).toBe(8);
    expect(state.stones[0].cell).toBe(11);
    expect(state.moves).toBe(1);
    expect(state.pushes).toBe(1);
  });

  it("stops at walls, another stone or the row edge without wrapping or chain-pushing", () => {
    const wall = room({
      exit: 35,
      ice: [9, 10],
      walls: [11],
      sigils: [{ color: "blue", cell: 10 }],
      mechanic: "ice",
    });
    expect(walk(wall, ["right"]).stones[0].cell).toBe(10);
    const stone = room({
      exit: 35,
      ice: [9, 10],
      stones: [
        { id: "blue", color: "blue", cell: 8 },
        { id: "red", color: "red", cell: 11 },
      ],
      sigils: [
        { color: "blue", cell: 10 },
        { color: "red", cell: 20 },
      ],
      mechanic: "ice",
    });
    expect(walk(stone, ["right"]).stones.map((piece) => piece.cell)).toEqual([
      10, 11,
    ]);
    const edge = room({
      start: 3,
      exit: 35,
      ice: [5],
      stones: [{ id: "blue", color: "blue", cell: 4 }],
      sigils: [{ color: "blue", cell: 5 }],
      mechanic: "ice",
    });
    expect(walk(edge, ["right"]).stones[0].cell).toBe(5);
  });

  it("does not slide the walking hero", () => {
    const definition = room({
      ice: [8, 9],
      stones: [{ id: "blue", color: "blue", cell: 20 }],
      sigils: [{ color: "blue", cell: 21 }],
      mechanic: "ice",
    });
    expect(walk(definition, ["right"]).player).toBe(8);
  });

  it("rechecks a gate during sliding after the hero has left its plate", () => {
    const definition = room({
      exit: 35,
      plates: [7],
      gates: [10],
      ice: [9],
      mechanic: "ice",
    });
    const state = walk(definition, ["right"]);
    expect(state.player).toBe(8);
    expect(state.stones[0].cell).toBe(9);
    expect(puzzleOpenGates(definition, state)).toEqual([]);
  });

  it("uses the hero's new plate while a pushed stone slides", () => {
    const definition = room({
      start: 6,
      exit: 35,
      stones: [{ id: "blue", color: "blue", cell: 7 }],
      sigils: [{ color: "blue", cell: 10 }],
      plates: [7],
      gates: [10],
      ice: [8, 9],
      mechanic: "ice",
    });
    const state = walk(definition, ["right"]);
    expect(state.player).toBe(7);
    expect(state.stones[0].cell).toBe(10);
    expect(puzzleOpenGates(definition, state)).toEqual([10]);
  });
});

describe("spatial Rune Delve · definition validation", () => {
  it("accepts a coherent authored room and rejects corrupt topology or identity", () => {
    expect(validatePuzzleRoom(room())).toEqual([]);
    expect(validatePuzzleRoom(room({ start: 36 }))).not.toEqual([]);
    expect(validatePuzzleRoom(room({ walls: [7] }))).not.toEqual([]);
    expect(validatePuzzleRoom(room({ walls: [1, 1] }))).not.toEqual([]);
    expect(
      validatePuzzleRoom(
        room({
          stones: [
            { id: "same", color: "blue", cell: 8 },
            { id: "same", color: "blue", cell: 10 },
          ],
          sigils: [
            { color: "blue", cell: 9 },
            { color: "blue", cell: 11 },
          ],
        }),
      ),
    ).not.toEqual([]);
    expect(
      validatePuzzleRoom(
        room({ stones: [{ id: "red", color: "red", cell: 8 }] }),
      ),
    ).not.toEqual([]);
    expect(validatePuzzleRoom(null as unknown as PuzzleRoom)).not.toEqual([]);
    expect(validatePuzzleRoom(room({ walls: [Number.NaN] }))).not.toEqual([]);
    expect(
      validatePuzzleRoom(
        room({ stones: null as unknown as PuzzleRoom["stones"] }),
      ),
    ).not.toEqual([]);
  });
});
