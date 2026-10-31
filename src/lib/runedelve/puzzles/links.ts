import type { PuzzleRoom } from "./types";

export const puzzleRoomHref = (room: Pick<PuzzleRoom, "id">) =>
  `/rune-delve/chamber/${encodeURIComponent(room.id)}`;
