import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearPuzzleCheckpoint,
  inspectPuzzleCheckpoint,
  puzzleCheckpointKey,
  PUZZLE_CHECKPOINT_MAX_AGE_MS,
  readPuzzleCheckpoint,
  writePuzzleCheckpoint,
} from "@/lib/runedelve/puzzles/checkpoint";
import { replayPuzzle } from "@/lib/runedelve/puzzles/engine";
import type {
  PuzzleDirection,
  PuzzleRoom,
} from "@/lib/runedelve/puzzles/types";

const now = Date.UTC(2026, 9, 31, 12);
const requestId = "00000000-0000-4000-8000-000000000001";
const room: PuzzleRoom = {
  id: "checkpoint-room",
  version: 1,
  order: 1,
  chapter: 1,
  title: "The first seal",
  lesson: "Restore the red sigil.",
  mechanic: "runes",
  width: 6,
  height: 6,
  walls: Array.from({ length: 36 }, (_, cell) => cell).filter(
    (cell) => cell < 6 || cell >= 30 || cell % 6 === 0 || cell % 6 === 5,
  ),
  start: 13,
  exit: 16,
  stones: [{ id: "red", color: "red", cell: 14 }],
  sigils: [{ color: "red", cell: 15 }],
  plates: [],
  gates: [],
  ice: [],
  treasures: [19],
  parPushes: 1,
  solution: ["down", "up", "right", "down", "right", "right", "up"],
};
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("spatial puzzle checkpoints", () => {
  it("restores canonical moves with independent account, room and version identities", () => {
    expect(
      writePuzzleCheckpoint("alice", room, { actions: ["down"] }, now),
    ).toBe(true);
    const save = readPuzzleCheckpoint("alice", room, now);
    expect(save).toEqual({ actions: ["down"], savedAt: now });
    expect(replayPuzzle(room, save!.actions).state.collected).toEqual([19]);
    expect(readPuzzleCheckpoint("bob", room, now)).toBeNull();
    expect(
      readPuzzleCheckpoint("alice", { ...room, version: 2 }, now),
    ).toBeNull();
    expect(
      readPuzzleCheckpoint("alice", { ...room, id: "other" }, now),
    ).toBeNull();
    expect(puzzleCheckpointKey("a:b", "c", 1)).not.toBe(
      puzzleCheckpointKey("a", "b:c", 1),
    );
  });

  it("rejects blocked/forged actions and never trusts a serialized solved state", () => {
    expect(
      writePuzzleCheckpoint("alice", room, { actions: ["left"] }, now),
    ).toBe(false);
    expect(
      writePuzzleCheckpoint(
        "alice",
        room,
        { actions: ["teleport" as PuzzleDirection] },
        now,
      ),
    ).toBe(false);
    expect(
      writePuzzleCheckpoint(
        "alice",
        room,
        { actions: [], requestId: "not-a-request" },
        now,
      ),
    ).toBe(false);
    expect(
      writePuzzleCheckpoint(
        "alice",
        room,
        { actions: Array(1201).fill("up") },
        now,
      ),
    ).toBe(false);
    const key = puzzleCheckpointKey("alice", room.id, room.version);
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        userId: "alice",
        roomId: room.id,
        definitionVersion: 1,
        actions: ["left"],
        state: { status: "solved" },
        savedAt: now,
      }),
    );
    expect(inspectPuzzleCheckpoint("alice", room, now).problem).toBe("invalid");
    localStorage.setItem(key, "{bad json");
    expect(inspectPuzzleCheckpoint("alice", room, now).problem).toBe("invalid");
  });

  it("expires active boards but retains solved pending receipts until acknowledged", () => {
    const later = now + PUZZLE_CHECKPOINT_MAX_AGE_MS + 1;
    writePuzzleCheckpoint("alice", room, { actions: ["down"] }, now);
    expect(inspectPuzzleCheckpoint("alice", room, later).problem).toBe(
      "expired",
    );
    expect(replayPuzzle(room, room.solution).state.status).toBe("solved");
    expect(
      writePuzzleCheckpoint(
        "alice",
        room,
        { actions: room.solution, requestId },
        now,
      ),
    ).toBe(true);
    expect(readPuzzleCheckpoint("alice", room, later)?.requestId).toBe(
      requestId,
    );
    expect(clearPuzzleCheckpoint("bob", room)).toBe(true);
    expect(readPuzzleCheckpoint("alice", room, later)).not.toBeNull();
    expect(clearPuzzleCheckpoint("alice", room)).toBe(true);
    expect(readPuzzleCheckpoint("alice", room, later)).toBeNull();
  });

  it("rejects replay continuation after escape and future-dated data", () => {
    expect(
      writePuzzleCheckpoint(
        "alice",
        room,
        { actions: [...room.solution, "left"] },
        now,
      ),
    ).toBe(false);
    expect(
      writePuzzleCheckpoint("alice", room, { actions: [] }, now + 60_001),
    ).toBe(true);
    expect(inspectPuzzleCheckpoint("alice", room, now).problem).toBe("invalid");
  });

  it("surfaces unavailable device storage rather than pretending a save succeeded", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(inspectPuzzleCheckpoint("alice", room, now).problem).toBe(
      "unavailable",
    );
    expect(writePuzzleCheckpoint("alice", room, { actions: [] }, now)).toBe(
      false,
    );
    expect(clearPuzzleCheckpoint("alice", room)).toBe(false);
  });
});
