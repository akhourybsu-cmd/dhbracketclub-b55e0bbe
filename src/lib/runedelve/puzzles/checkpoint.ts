import { replayPuzzle } from "./engine";
import type { PuzzleDirection, PuzzleRoom } from "./types";

export const PUZZLE_CHECKPOINT_MAX_ACTIONS = 1200;
export const PUZZLE_CHECKPOINT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DIRECTIONS = new Set<PuzzleDirection>(["up", "right", "down", "left"]);
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export interface PuzzleCheckpoint {
  actions: PuzzleDirection[];
  requestId?: string;
  savedAt: number;
}
export type PuzzleCheckpointProblem = "unavailable" | "invalid" | "expired";
export interface PuzzleCheckpointRead {
  checkpoint: PuzzleCheckpoint | null;
  problem: PuzzleCheckpointProblem | null;
}

export function puzzleCheckpointKey(
  userId: string,
  roomId: string,
  version: number,
): string {
  return `rd-puzzle:v1:${encodeURIComponent(userId)}:${encodeURIComponent(roomId)}:${version}`;
}

/** Only replayed canonical actions are restored. Serialized board state is never trusted. */
export function inspectPuzzleCheckpoint(
  userId: string,
  room: PuzzleRoom,
  now = Date.now(),
): PuzzleCheckpointRead {
  let raw: string | null;
  try {
    raw = localStorage.getItem(
      puzzleCheckpointKey(userId, room.id, room.version),
    );
  } catch {
    return { checkpoint: null, problem: "unavailable" };
  }
  if (raw === null) return { checkpoint: null, problem: null };
  try {
    if (!userId || raw.length > 50_000) throw new Error("Invalid checkpoint");
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Invalid checkpoint");
    const save = value as Record<string, unknown>;
    if (
      save.version !== 1 ||
      save.userId !== userId ||
      save.roomId !== room.id ||
      save.definitionVersion !== room.version ||
      typeof save.savedAt !== "number" ||
      !Number.isFinite(save.savedAt) ||
      save.savedAt < 0 ||
      save.savedAt > now + 60_000 ||
      !Array.isArray(save.actions) ||
      save.actions.length > PUZZLE_CHECKPOINT_MAX_ACTIONS ||
      !save.actions.every(
        (action): action is PuzzleDirection =>
          typeof action === "string" &&
          DIRECTIONS.has(action as PuzzleDirection),
      ) ||
      (save.requestId !== undefined &&
        (typeof save.requestId !== "string" || !UUID.test(save.requestId)))
    )
      throw new Error("Invalid checkpoint");
    const replay = replayPuzzle(room, save.actions);
    if (!replay.valid) throw new Error("Invalid checkpoint path");
    // A solved run awaiting its immutable receipt must survive ordinary active-save expiry.
    if (
      now - save.savedAt > PUZZLE_CHECKPOINT_MAX_AGE_MS &&
      !(replay.state.status === "solved" && save.requestId)
    )
      return { checkpoint: null, problem: "expired" };
    return {
      checkpoint: {
        actions: [...save.actions],
        savedAt: save.savedAt,
        ...(save.requestId ? { requestId: save.requestId as string } : {}),
      },
      problem: null,
    };
  } catch {
    return { checkpoint: null, problem: "invalid" };
  }
}

export function readPuzzleCheckpoint(
  userId: string,
  room: PuzzleRoom,
  now = Date.now(),
): PuzzleCheckpoint | null {
  return inspectPuzzleCheckpoint(userId, room, now).checkpoint;
}

export function writePuzzleCheckpoint(
  userId: string,
  room: PuzzleRoom,
  checkpoint: { actions: PuzzleDirection[]; requestId?: string },
  now = Date.now(),
): boolean {
  if (
    !userId ||
    !Number.isFinite(now) ||
    now < 0 ||
    checkpoint.actions.length > PUZZLE_CHECKPOINT_MAX_ACTIONS ||
    !checkpoint.actions.every((action) => DIRECTIONS.has(action)) ||
    (checkpoint.requestId !== undefined && !UUID.test(checkpoint.requestId))
  )
    return false;
  try {
    if (!replayPuzzle(room, checkpoint.actions).valid) return false;
    localStorage.setItem(
      puzzleCheckpointKey(userId, room.id, room.version),
      JSON.stringify({
        version: 1,
        userId,
        roomId: room.id,
        definitionVersion: room.version,
        actions: checkpoint.actions,
        requestId: checkpoint.requestId,
        savedAt: now,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearPuzzleCheckpoint(
  userId: string,
  room: PuzzleRoom,
): boolean {
  try {
    localStorage.removeItem(puzzleCheckpointKey(userId, room.id, room.version));
    return true;
  } catch {
    return false;
  }
}
