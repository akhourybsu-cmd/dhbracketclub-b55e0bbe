import { solvePuzzle } from "./solver";
import type { PuzzleRoom, PuzzleState } from "./types";

type HintRequest = { id: number; room: PuzzleRoom; state: PuzzleState };
const bridge = self as unknown as {
  onmessage: ((event: MessageEvent<HintRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};
bridge.onmessage = (event) => {
  const { id, room, state } = event.data;
  try {
    bridge.postMessage({
      id,
      result: solvePuzzle(room, state, { maxStates: 75_000 }),
    });
  } catch {
    bridge.postMessage({ id, error: true });
  }
};
