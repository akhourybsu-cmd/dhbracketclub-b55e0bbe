import { describe, expect, it } from "vitest";
import {
  initialPuzzleState,
  movePuzzle,
  puzzleAreaCount,
  puzzleAreaIndex,
  puzzleNeighbor,
  puzzleOpenDoors,
  puzzleOpenGates,
  puzzlePassageDestination,
  replayPuzzle,
  validatePuzzleRoom,
} from "@/lib/runedelve/puzzles/engine";
import type {
  PuzzleDirection,
  PuzzleRoom,
  PuzzleState,
} from "@/lib/runedelve/puzzles/types";

function adventure(overrides: Partial<PuzzleRoom> = {}): PuzzleRoom {
  return {
    id: "rules-adventure",
    version: 1,
    order: 19,
    chapter: 4,
    title: "A door beyond the courtyard",
    lesson: "Explore the connected rooms and return to the runestone.",
    mechanic: "passages",
    width: 6,
    height: 6,
    areas: [
      { id: "courtyard", title: "Courtyard" },
      { id: "library", title: "Library" },
    ],
    walls: [],
    start: 7,
    exit: 58,
    stones: [{ id: "ember", color: "red", cell: 14 }],
    sigils: [{ color: "red", cell: 15 }],
    passages: [{ a: 8, b: 43 }],
    plates: [],
    gates: [],
    ice: [],
    treasures: [57],
    parPushes: 1,
    solution: [],
    ...overrides,
  };
}

function walk(room: PuzzleRoom, actions: PuzzleDirection[]): PuzzleState {
  const replay = replayPuzzle(room, actions);
  expect(replay.valid, replay.error).toBe(true);
  return replay.state;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

describe("Rune adventures · local boards and passages", () => {
  it("keeps every ordinary neighbor within its own 6×6 area", () => {
    const room = adventure({
      areas: [...adventure().areas!, { id: "tower", title: "Tower" }],
    });
    expect(puzzleAreaCount(room)).toBe(3);
    expect([0, 35, 36, 71, 72, 107].map(puzzleAreaIndex)).toEqual([
      0, 0, 1, 1, 2, 2,
    ]);
    for (const area of [0, 1, 2]) {
      const offset = area * 36;
      expect(puzzleNeighbor(room, offset, "up")).toBeNull();
      expect(puzzleNeighbor(room, offset, "left")).toBeNull();
      expect(puzzleNeighbor(room, offset + 5, "right")).toBeNull();
      expect(puzzleNeighbor(room, offset + 35, "down")).toBeNull();
      expect(puzzleNeighbor(room, offset + 35, "right")).toBeNull();
      expect(puzzleNeighbor(room, offset + 7, "right")).toBe(offset + 8);
      expect(puzzleNeighbor(room, offset + 7, "down")).toBe(offset + 13);
    }
    expect(puzzleNeighbor(room, 108, "right")).toBeNull();
    expect(puzzleNeighbor(room, -1, "down")).toBeNull();
    const edge = initialPuzzleState(adventure({ start: 35 }));
    expect(movePuzzle(adventure({ start: 35 }), edge, "right")).toMatchObject({
      moved: false,
      reason: "wall",
      state: edge,
    });
  });

  it("travels once on entry and lets the delver walk away before returning", () => {
    const room = adventure();
    expect(puzzlePassageDestination(room, 8)).toBe(43);
    expect(puzzlePassageDestination(room, 43)).toBe(8);
    expect(puzzlePassageDestination(room, 44)).toBeNull();
    const across = walk(room, ["right"]);
    expect(across).toMatchObject({
      player: 43,
      moves: 1,
      pushes: 0,
      visitedAreas: [0, 1],
    });
    expect(across.stones).toEqual(room.stones);
    expect(walk(room, ["right", "right"]).player).toBe(44);
    const returned = walk(room, ["right", "right", "left"]);
    expect(returned.player).toBe(8);
    expect(returned.visitedAreas).toEqual([0, 1]);
    expect(returned.moves).toBe(3);
  });

  it("uses the same explicit entry rule for an in-room rift", () => {
    const room = adventure({
      areas: undefined,
      chapter: 6,
      mechanic: "rifts",
      passages: [{ a: 8, b: 21, kind: "rift" }],
      exit: 22,
      treasures: [28],
    });
    expect(validatePuzzleRoom(room)).toEqual([]);
    const warped = walk(room, ["right"]);
    expect(warped.player).toBe(21);
    expect(warped.moves).toBe(1);
    expect(warped.visitedAreas).toBeUndefined();
    expect(walk(room, ["right", "down", "up"]).player).toBe(8);
  });

  it("refuses to push a stone into a player-only passage", () => {
    const room = adventure({
      start: 13,
      passages: [{ a: 15, b: 43 }],
      sigils: [{ color: "red", cell: 16 }],
    });
    const state = initialPuzzleState(room);
    expect(movePuzzle(room, state, "right")).toMatchObject({
      moved: false,
      pushed: false,
      reason: "passage",
      state,
    });
  });

  it("stops an ice slide before the passage without moving or teleporting another actor", () => {
    const room = adventure({
      start: 13,
      ice: [15, 16],
      passages: [{ a: 17, b: 43, kind: "rift" }],
      sigils: [{ color: "red", cell: 16 }],
    });
    const state = walk(room, ["right"]);
    expect(state.player).toBe(14);
    expect(state.stones[0].cell).toBe(16);
    expect(state.moves).toBe(1);
    expect(state.pushes).toBe(1);
    expect(state.visitedAreas).toEqual([0]);
  });

  it("keeps plate pressure meaningful across a passage and a second room", () => {
    const room = adventure({ plates: [14], gates: [44] });
    expect(puzzleOpenGates(room, initialPuzzleState(room))).toEqual([44]);
    expect(walk(room, ["right", "right"]).player).toBe(44);
    const released = walk(room, ["down", "right", "up"]);
    expect(released.player).toBe(43);
    expect(released.stones[0].cell).toBe(15);
    expect(puzzleOpenGates(room, released)).toEqual([]);
    expect(movePuzzle(room, released, "right")).toMatchObject({
      moved: false,
      reason: "gate",
    });
  });
});

describe("Rune adventures · reusable keys and persistent exploration", () => {
  it("opens only matching doors, retains the key through multiple doors and collects colors deterministically", () => {
    const room = adventure({
      chapter: 5,
      mechanic: "keys",
      keys: [
        { color: "red", cell: 13 },
        { color: "blue", cell: 49 },
      ],
      doors: [
        { color: "red", cell: 44 },
        { color: "red", cell: 50 },
        { color: "blue", cell: 51 },
      ],
    });
    expect(puzzleOpenDoors(room, initialPuzzleState(room))).toEqual([]);
    expect(movePuzzle(room, walk(room, ["right"]), "right")).toMatchObject({
      moved: false,
      reason: "door",
    });
    const afterTwoDoors = walk(room, ["down", "up", "right", "right", "down"]);
    expect(afterTwoDoors.player).toBe(50);
    expect(afterTwoDoors.keys).toEqual(["red"]);
    expect(puzzleOpenDoors(room, afterTwoDoors)).toEqual([44, 50]);
    expect(movePuzzle(room, afterTwoDoors, "right")).toMatchObject({
      moved: false,
      reason: "door",
    });
    const allKeys = walk(room, [
      "down",
      "up",
      "right",
      "right",
      "down",
      "left",
      "right",
      "right",
    ]);
    expect(allKeys.player).toBe(51);
    expect(allKeys.keys).toEqual(["blue", "red"]);
    expect(puzzleOpenDoors(room, allKeys)).toEqual([44, 50, 51]);
  });

  it("lets a runestone cover a key, but only the delver can collect it", () => {
    const room = adventure({
      start: 13,
      keys: [{ color: "red", cell: 15 }],
      doors: [{ color: "red", cell: 44 }],
      sigils: [{ color: "red", cell: 16 }],
    });
    const covered = walk(room, ["right"]);
    expect(covered.stones[0].cell).toBe(15);
    expect(covered.keys).toEqual([]);
    const collected = walk(room, ["right", "right"]);
    expect(collected.player).toBe(15);
    expect(collected.stones[0].cell).toBe(16);
    expect(collected.keys).toEqual(["red"]);
  });

  it("collects an initial key and blocks stone landings behind unowned locks", () => {
    const room = adventure({
      start: 13,
      keys: [{ color: "red", cell: 13 }],
      doors: [{ color: "red", cell: 15 }],
      sigils: [{ color: "red", cell: 16 }],
    });
    const initial = initialPuzzleState(room);
    expect(initial.keys).toEqual(["red"]);
    expect(movePuzzle(room, initial, "right").state.stones[0].cell).toBe(15);
    expect(movePuzzle(room, { ...initial, keys: [] }, "right")).toMatchObject({
      moved: false,
      reason: "door",
    });
  });

  it("collects a revealed key before an ice continuation, while initial landing still uses pre-action keys", () => {
    const room = adventure({
      start: 13,
      keys: [{ color: "red", cell: 14 }],
      doors: [{ color: "red", cell: 17 }],
      ice: [15, 16],
      sigils: [{ color: "red", cell: 18 }],
    });
    const after = walk(room, ["right"]);
    expect(after.player).toBe(14);
    expect(after.keys).toEqual(["red"]);
    expect(after.stones[0].cell).toBe(17);
    expect(after.pushes).toBe(1);

    const immediateLock = {
      ...room,
      doors: [{ color: "red" as const, cell: 15 }],
    };
    const initial = initialPuzzleState(immediateLock);
    expect(movePuzzle(immediateLock, initial, "right")).toMatchObject({
      moved: false,
      reason: "door",
      state: initial,
    });
    expect(initial.keys).toEqual([]);
  });

  it("replay-based undo restores locks and discovery rather than leaking later progress", () => {
    const room = adventure({
      keys: [{ color: "red", cell: 13 }],
      doors: [{ color: "red", cell: 44 }],
    });
    const crossed = walk(room, ["down", "up", "right"]);
    expect(crossed).toMatchObject({
      keys: ["red"],
      visitedAreas: [0, 1],
      player: 43,
    });
    const beforeCrossing = walk(room, ["down", "up"]);
    expect(beforeCrossing).toMatchObject({
      keys: ["red"],
      visitedAreas: [0],
      player: 7,
    });
    const beforeKey = walk(room, []);
    expect(beforeKey).toMatchObject({ keys: [], visitedAreas: [0], player: 7 });
    expect(puzzleOpenDoors(room, beforeKey)).toEqual([]);
  });

  it("does not mutate frozen key/discovery state and preserves the old state shape", () => {
    const room = freeze(
      adventure({
        keys: [{ color: "red", cell: 13 }],
        doors: [{ color: "red", cell: 44 }],
      }),
    );
    const state = freeze(initialPuzzleState(room));
    expect(movePuzzle(room, state, "down").state.keys).toEqual(["red"]);
    expect(movePuzzle(room, state, "right").state.visitedAreas).toEqual([0, 1]);
    expect(state.keys).toEqual([]);
    expect(state.visitedAreas).toEqual([0]);
    const legacy = adventure({
      areas: undefined,
      passages: undefined,
      exit: 22,
      treasures: [21],
    });
    const oldState = walk(legacy, ["down"]);
    expect(Object.prototype.hasOwnProperty.call(oldState, "keys")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(oldState, "visitedAreas")).toBe(
      false,
    );
  });
});

describe("Rune adventures · authored topology validation", () => {
  it("accepts extended cells only inside one to three clearly identified areas", () => {
    expect(validatePuzzleRoom(adventure())).toEqual([]);
    const third = adventure({
      areas: [...adventure().areas!, { id: "tower", title: "Tower" }],
      walls: [107],
    });
    expect(validatePuzzleRoom(third)).toEqual([]);
    for (const invalid of [
      adventure({ areas: [] }),
      adventure({
        areas: [...third.areas!, { id: "fourth", title: "Fourth" }],
      }),
      adventure({
        areas: [
          { id: "same", title: "First" },
          { id: "same", title: "Second" },
        ],
      }),
      adventure({
        areas: [
          { id: "first", title: "" },
          { id: "second", title: "Second" },
        ],
      }),
      adventure({ walls: [72] }),
    ])
      expect(
        validatePuzzleRoom(invalid),
        invalid.areas?.map((area) => area.id).join(","),
      ).not.toEqual([]);
  });

  it("rejects duplicate, self-linked and out-of-bounds passage endpoints", () => {
    for (const passages of [
      [{ a: 8, b: 8 }],
      [{ a: 8, b: 72 }],
      [
        { a: 8, b: 43 },
        { a: 21, b: 43 },
      ],
      [{ a: 8, b: 43, kind: "ladder" as "passage" }],
    ])
      expect(
        validatePuzzleRoom(adventure({ passages })),
        JSON.stringify(passages),
      ).not.toEqual([]);
  });

  it("keeps passage endpoints free of actors, goals and every other marker", () => {
    const overlaps: Array<Partial<PuzzleRoom>> = [
      { start: 8 },
      { exit: 8 },
      { walls: [8] },
      { stones: [{ id: "ember", color: "red", cell: 8 }] },
      { sigils: [{ color: "red", cell: 8 }] },
      { plates: [8] },
      { plates: [19], gates: [8] },
      { ice: [8] },
      { treasures: [8] },
      {
        keys: [{ color: "red", cell: 8 }],
        doors: [{ color: "red", cell: 44 }],
      },
      {
        keys: [{ color: "red", cell: 13 }],
        doors: [{ color: "red", cell: 8 }],
      },
      {
        guardian: {
          cell: 8,
          color: "red",
          archetypeId: "rune_wraith",
          name: "Wraith",
        },
      },
    ];
    for (const overlap of overlaps)
      expect(
        validatePuzzleRoom(adventure(overlap)),
        JSON.stringify(overlap),
      ).not.toEqual([]);
  });

  it("requires valid key/door colors and cells without duplicate pickups or locks", () => {
    const valid = adventure({
      keys: [{ color: "red", cell: 13 }],
      doors: [{ color: "red", cell: 44 }],
    });
    expect(validatePuzzleRoom(valid)).toEqual([]);
    for (const invalid of [
      adventure({ keys: [{ color: "purple" as "red", cell: 13 }] }),
      adventure({ keys: [{ color: "red", cell: 72 }] }),
      adventure({
        keys: [
          { color: "red", cell: 13 },
          { color: "blue", cell: 13 },
        ],
      }),
      adventure({ doors: [{ color: "purple" as "red", cell: 44 }] }),
      adventure({ doors: [{ color: "red", cell: 72 }] }),
      adventure({
        keys: valid.keys,
        doors: [
          { color: "red", cell: 44 },
          { color: "red", cell: 44 },
        ],
      }),
      adventure({ doors: [{ color: "red", cell: 44 }] }),
    ])
      expect(
        validatePuzzleRoom(invalid),
        JSON.stringify([invalid.keys, invalid.doors]),
      ).not.toEqual([]);
  });
});
