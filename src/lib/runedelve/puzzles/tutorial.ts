import {
  initialPuzzleState,
  movePuzzle,
  puzzleAreaIndex,
  puzzleNeighbor,
  puzzleOpenGates,
  puzzleSigilsFilled,
} from "./engine";
import type { PuzzleDirection, PuzzleRoom, PuzzleState } from "./types";

export interface PuzzleCoach {
  id: string;
  title: string;
  text: string;
  cell?: number;
}

function positionKey(state: PuzzleState) {
  return JSON.stringify([
    state.player,
    state.stones.map((stone) => [stone.id, stone.color, stone.cell]),
    [...state.collected].sort((a, b) => a - b),
    [...(state.keys ?? [])].sort(),
  ]);
}

/** A cue suggests a real next input only while the delver follows a verified route. */
function authoredNext(
  room: PuzzleRoom,
  state: PuzzleState,
): PuzzleDirection | undefined {
  const key = positionKey(state);
  let canonical = initialPuzzleState(room);
  for (const direction of room.solution) {
    if (positionKey(canonical) === key) return direction;
    const next = movePuzzle(room, canonical, direction);
    if (!next.moved) break;
    canonical = next.state;
  }
  return undefined;
}

/** Presentation only. Prompts never move the delver, lock inputs or award progress. */
export function getPuzzleCoach(
  room: PuzzleRoom,
  state: PuzzleState,
): PuzzleCoach | null {
  if (state.status === "solved") return null;
  const currentArea = puzzleAreaIndex(state.player);
  const local = (cell: number | undefined) =>
    cell !== undefined && puzzleAreaIndex(cell) === currentArea
      ? cell
      : undefined;
  const restored = puzzleSigilsFilled(room, state) === room.sigils.length;

  if (room.order === 1) {
    if (restored) {
      const cache = room.treasures.find(
        (cell) => !state.collected.includes(cell),
      );
      return cache !== undefined
        ? {
            id: "first-cache",
            title: "A secret worth finding",
            text: "The gold cache is optional. Explore for a bonus star, or head to the portal.",
            cell: local(cache),
          }
        : {
            id: "first-exit",
            title: "The way is open",
            text: "Step into the glowing portal to finish your first chamber.",
            cell: local(room.exit),
          };
    }
    const direction = authoredNext(room, state);
    const nextCell = direction
      ? puzzleNeighbor(room, state.player, direction)
      : undefined;
    const pushing = state.stones.some((stone) => stone.cell === nextCell);
    if (state.moves === 0)
      return {
        id: "first-step",
        title: "Your first move",
        text: pushing
          ? "Stand behind a rune. Tap the glowing tile to push it onto its symbol."
          : "Tap the glowing neighboring tile. You can also swipe a direction.",
        cell: local(nextCell ?? undefined),
      };
    return direction
      ? {
          id: "first-push",
          title: "Restore the seal",
          text: pushing
            ? "Push the rune onto its matching symbol. Only one rune moves at a time."
            : "Walk around the rune to reach its pushing side. Take your time.",
          cell: local(nextCell ?? undefined),
        }
      : {
          id: "first-experiment",
          title: "You can always undo",
          text: "Stand behind the rune to push. Undo and Restart are free, so experiment.",
        };
  }
  if (room.order === 2 && !restored)
    return {
      id: "pushing-side",
      title: "Find another angle",
      text: "Walk around the rune. Efficient pushes earn a star; walking is free.",
      cell: local(
        (() => {
          const next = authoredNext(room, state);
          return next
            ? (puzzleNeighbor(room, state.player, next) ?? undefined)
            : undefined;
        })(),
      ),
    };
  if (room.order === 3 && !restored)
    return {
      id: "matching-colors",
      title: "Choose your order",
      text: "Each rune matches its own symbol. A restored rune can still block another route.",
    };
  if (room.order === 7) {
    const open = puzzleOpenGates(room, state);
    return open.length
      ? {
          id: "gate-held",
          title: "The passage is open",
          text: "An occupied plate opens the gates. An occupied gate waits until you leave.",
          cell: local(open[0]),
        }
      : {
          id: "first-plate",
          title: "A living key",
          text: "Stand on a pressure plate, or leave a rune on it, to open the gates.",
          cell: local(room.plates[0]),
        };
  }
  if (room.order === 13)
    return {
      id: "first-ice",
      title: "Read the ice",
      text: "Pushed runes slide across ice. Your delver still walks one tile at a time.",
      cell: local(room.ice[0]),
    };
  if (room.order === 19) {
    const endpoint = room.passages
      ?.flatMap((passage) => [passage.a, passage.b])
      .find((cell) => puzzleAreaIndex(cell) === currentArea);
    return (state.visitedAreas?.length ?? 1) > 1
      ? {
          id: "room-discovered",
          title: "A room discovered",
          text: "Your earlier room stays as you left it. Restore every seal before escaping.",
        }
      : {
          id: "first-passage",
          title: "Beyond this room",
          text: "Step through a doorway to explore. Only the delver travels; runes stay here.",
          cell: endpoint,
        };
  }
  if (room.order === 25) {
    const key = room.keys?.find((item) => !state.keys?.includes(item.color));
    const localKey = key ? local(key.cell) : undefined;
    const doorway = room.passages
      ?.flatMap((passage) => [passage.a, passage.b])
      .find((cell) => puzzleAreaIndex(cell) === currentArea);
    return key
      ? {
          id: "first-key",
          title: "Keep what you discover",
          text:
            localKey === undefined
              ? "The matching key waits in another room. Explore a doorway and bring it back."
              : "Walk over a key. It opens every matching lock, even in an earlier room.",
          cell: localKey ?? doorway,
        }
      : {
          id: "key-attuned",
          title: "Key attuned",
          text: "Matching doors are open. Carry your discovery back through the passages.",
          cell: local(room.doors?.[0]?.cell),
        };
  }
  if (room.order === 31) {
    const endpoint = room.passages
      ?.filter((passage) => passage.kind === "rift")
      .flatMap((passage) => [passage.a, passage.b])
      .find((cell) => puzzleAreaIndex(cell) === currentArea);
    return {
      id: "first-rift",
      title: "A different approach",
      text: "A rift moves you to its pair. Runes cannot enter, so plan your approach.",
      cell: endpoint,
    };
  }
  return null;
}
