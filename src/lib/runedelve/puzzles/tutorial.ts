import {
  initialPuzzleState,
  MAX_PUZZLE_ACTIONS,
  PUZZLE_DIRECTIONS,
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
  kind: "instruction" | "objective" | "introduction";
  cell?: number;
}

export interface PuzzleCoachOptions {
  /** The current, undoable route, not a lifetime move counter. */
  actions?: readonly PuzzleDirection[];
}

export interface PuzzleTutorialProgress {
  phase: "learn" | "practice" | "trial";
  label: "Learn" | "Practice" | "Trial";
  stage: 1 | 2 | 3;
  stages: 3;
  step: number;
  steps: number;
  complete: boolean;
}

function positionKey(state: PuzzleState) {
  return JSON.stringify([
    state.player,
    state.stones.map((stone) => [stone.id, stone.color, stone.cell]),
    [...state.collected].sort((a, b) => a - b),
    [...(state.keys ?? [])].sort(),
  ]);
}

interface LessonEvidence {
  meaningful: boolean;
  plate: boolean;
  gate: boolean;
  ice: boolean;
  passage: boolean;
  key: boolean;
  door: boolean;
  rift: boolean;
}

function occupiedPlate(room: PuzzleRoom, state: PuzzleState) {
  return room.plates.some(
    (cell) =>
      state.player === cell || state.stones.some((stone) => stone.cell === cell),
  );
}

/** Current state supplies safe evidence when an older caller has no route. */
function stateEvidence(room: PuzzleRoom, state: PuzzleState): LessonEvidence {
  const initial = initialPuzzleState(room);
  const moved = state.moves > 0;
  const key = (state.keys ?? []).some(
    (color) => !initial.keys?.includes(color),
  );
  return {
    meaningful:
      state.pushes > 0 ||
      state.collected.some((cell) => !initial.collected.includes(cell)) ||
      puzzleSigilsFilled(room, state) > puzzleSigilsFilled(room, initial) ||
      key,
    plate: moved && occupiedPlate(room, state),
    gate: moved && room.gates.includes(state.player),
    // Distance beyond all pushes proves a slide. The route below also remembers
    // the demonstration after a rune has left the ice or returned toward home.
    ice:
      moved &&
      state.stones.some((stone) => {
        const start = room.stones.find((item) => item.id === stone.id);
        if (!start || puzzleAreaIndex(start.cell) !== puzzleAreaIndex(stone.cell))
          return false;
        const distance =
          Math.abs(Math.floor(start.cell / 6) - Math.floor(stone.cell / 6)) +
          Math.abs((start.cell % 6) - (stone.cell % 6));
        return distance > state.pushes;
      }),
    passage:
      (state.visitedAreas?.length ?? 1) > 1 ||
      puzzleAreaIndex(state.player) !== puzzleAreaIndex(room.start),
    key,
    door:
      moved &&
      Boolean(
        room.doors?.some(
          (door) => door.cell === state.player && state.keys?.includes(door.color),
        ),
      ),
    rift:
      moved &&
      Boolean(
        room.passages?.some(
          (passage) =>
            passage.kind === "rift" &&
            (passage.a === state.player || passage.b === state.player),
        ),
      ),
  };
}

/** Replay real inputs, never the answer, so discovery fades until it is undone. */
function lessonEvidence(
  room: PuzzleRoom,
  state: PuzzleState,
  options: PuzzleCoachOptions,
): LessonEvidence {
  const fallback = stateEvidence(room, state);
  const actions = options.actions;
  if (
    !actions ||
    actions.length !== state.moves ||
    actions.length > MAX_PUZZLE_ACTIONS
  )
    return fallback;
  let before = initialPuzzleState(room);
  const evidence = stateEvidence(room, before);
  for (const direction of actions) {
    const result = movePuzzle(room, before, direction);
    if (!result.moved) return fallback;
    const after = result.state;
    const current = stateEvidence(room, after);
    const entry = puzzleNeighbor(room, before.player, direction);
    const passage = room.passages?.find(
      (item) => item.a === entry || item.b === entry,
    );
    evidence.meaningful ||= current.meaningful;
    evidence.plate ||= current.plate;
    evidence.gate ||= current.gate;
    evidence.key ||= current.key;
    evidence.door ||= current.door;
    evidence.passage ||=
      Boolean(passage) &&
      puzzleAreaIndex(before.player) !== puzzleAreaIndex(after.player);
    evidence.rift ||= passage?.kind === "rift";
    if (result.pushed) {
      const oldStone = before.stones.find((stone) => stone.cell === entry)!;
      const newStone = after.stones.find((stone) => stone.id === oldStone.id)!;
      evidence.ice ||=
        newStone.cell !== puzzleNeighbor(room, oldStone.cell, direction);
    }
    before = after;
  }
  return positionKey(before) === positionKey(state) &&
    before.pushes === state.pushes &&
    before.status === state.status
    ? evidence
    : fallback;
}

/** Only Learn may suggest a verified next input. Practice and Trial never do. */
function authoredNext(
  room: PuzzleRoom,
  state: PuzzleState,
): PuzzleDirection | undefined {
  const key = positionKey(state);
  let canonical = initialPuzzleState(room);
  for (const direction of room.solution) {
    if (positionKey(canonical) === key)
      return movePuzzle(room, state, direction).moved ? direction : undefined;
    const next = movePuzzle(room, canonical, direction);
    if (!next.moved) break;
    canonical = next.state;
  }
  return undefined;
}

/** A glowing Learn tile always accepts an input, even when the goal is distant. */
function learnTarget(room: PuzzleRoom, state: PuzzleState, goal: number) {
  const authored = authoredNext(room, state);
  if (authored) return puzzleNeighbor(room, state.player, authored) ?? undefined;
  const adjacent = PUZZLE_DIRECTIONS.find(
    (direction) =>
      puzzleNeighbor(room, state.player, direction) === goal &&
      movePuzzle(room, state, direction).moved,
  );
  return adjacent ? goal : undefined;
}

/** Teaching progress belongs to the real board; undo and restart rewind it. */
export function getPuzzleTutorialProgress(
  room: PuzzleRoom,
  state: PuzzleState,
  options: PuzzleCoachOptions = {},
): PuzzleTutorialProgress | null {
  const complete = state.status === "solved";
  const restored = puzzleSigilsFilled(room, state) === room.sigils.length;
  if (room.order === 1) {
    const cache = room.treasures.some((cell) => !state.collected.includes(cell));
    return {
      phase: "learn",
      label: "Learn",
      stage: 1,
      stages: 3,
      step: complete ? 4 : restored ? (cache ? 3 : 4) : state.moves > 0 ? 2 : 1,
      steps: 4,
      complete,
    };
  }
  if (room.order === 2)
    return {
      phase: "practice",
      label: "Practice",
      stage: 2,
      stages: 3,
      step: restored ? 2 : 1,
      steps: 2,
      complete,
    };
  if (room.order === 3)
    return {
      phase: "trial",
      label: "Trial",
      stage: 3,
      stages: 3,
      step: complete || lessonEvidence(room, state, options).meaningful ? 2 : 1,
      steps: 2,
      complete,
    };
  return null;
}

/** True once teaching is demonstrated; it never awards a chamber clear. */
export function isPuzzleCoachComplete(
  room: PuzzleRoom,
  state: PuzzleState,
  options: PuzzleCoachOptions = {},
): boolean {
  if (state.status === "solved") return true;
  if (room.order === 1 || room.order === 2) return false;
  const evidence = lessonEvidence(room, state, options);
  if (room.order === 3) return evidence.meaningful;
  if (room.order === 7) return evidence.gate;
  if (room.order === 13) return evidence.ice;
  if (room.order === 19) return evidence.passage;
  if (room.order === 25) return evidence.key && evidence.door;
  if (room.order === 31) return evidence.rift;
  return true;
}

/** Presentation only: never moves the delver, restricts input or awards progress. */
export function getPuzzleCoach(
  room: PuzzleRoom,
  state: PuzzleState,
  options: PuzzleCoachOptions = {},
): PuzzleCoach | null {
  if (isPuzzleCoachComplete(room, state, options)) return null;
  const currentArea = puzzleAreaIndex(state.player);
  const local = (cell: number | undefined) =>
    cell !== undefined && puzzleAreaIndex(cell) === currentArea
      ? cell
      : undefined;
  const restored = puzzleSigilsFilled(room, state) === room.sigils.length;

  if (room.order === 1) {
    if (restored) {
      const cache = room.treasures.find((cell) => !state.collected.includes(cell));
      return cache !== undefined
        ? {
            id: "first-cache",
            kind: "instruction",
            title: "A secret worth finding",
            text: "The gold cache is optional. Explore for a bonus star, or head to the portal.",
            cell: local(learnTarget(room, state, cache)),
          }
        : {
            id: "first-exit",
            kind: "instruction",
            title: "The way is open",
            text: "Step into the glowing portal to finish your first chamber.",
            cell: local(learnTarget(room, state, room.exit)),
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
        kind: "instruction",
        title: "Your first move",
        text: "Tap the glowing neighboring tile or swipe a direction.",
        cell: local(nextCell ?? undefined),
      };
    return direction
      ? {
          id: "first-push",
          kind: "instruction",
          title: "Restore the seal",
          text: pushing
            ? "Push the rune onto its matching symbol. Only one rune moves at a time."
            : "Walk around the rune to reach its pushing side. Take your time.",
          cell: local(nextCell ?? undefined),
        }
      : {
          id: "first-experiment",
          kind: "instruction",
          title: "You can always undo",
          text: "Stand behind the rune to push. Undo, Restart and Hints are free.",
        };
  }
  if (room.order === 2)
    return restored
      ? {
          id: "practice-exit",
          kind: "objective",
          title: "Find your way out",
          text: "The seals are restored. Reach the portal; the gold cache is optional.",
        }
      : {
          id: "pushing-side",
          kind: "objective",
          title: "Find another angle",
          text: "Restore the matching seal, then reach the portal. Walk around the rune; Undo and Hints are free.",
        };
  if (room.order === 3)
    return {
      id: "matching-colors",
      kind: "introduction",
      title: "Your first trial",
      text: "Match both colors and find the portal. Choose your order; Undo and Hints are here if you need them.",
    };
  if (room.order === 7) {
    const evidence = lessonEvidence(room, state, options);
    const open = puzzleOpenGates(room, state);
    return open.length
      ? {
          id: "gate-held",
          kind: "introduction",
          title: "The gate is open",
          text: "An occupied plate opens the gates. Step into the open gate; it waits until you leave.",
          cell: local(open[0]),
        }
      : {
          id: "first-plate",
          kind: "introduction",
          title: evidence.plate ? "Keep the way open" : "A living key",
          text: evidence.plate
            ? "The gate closes when the plate is empty. Step back onto the plate, or leave a rune on it."
            : "Stand on a pressure plate, or leave a rune on it, to open the gates.",
          cell: local(room.plates[0]),
        };
  }
  if (room.order === 13)
    return {
      id: "first-ice",
      kind: "introduction",
      title: "Read the ice",
      text: "Pushed runes slide across ice until they reach dry ground or an obstacle. You still walk one tile at a time.",
      cell: local(room.ice[0]),
    };
  if (room.order === 19) {
    const endpoint = room.passages
      ?.flatMap((passage) => [passage.a, passage.b])
      .find((cell) => puzzleAreaIndex(cell) === currentArea);
    return {
      id: "first-passage",
      kind: "introduction",
      title: "Beyond this room",
      text: "Step through a doorway to explore. Only you travel; runes and earlier rooms stay as you left them.",
      cell: endpoint,
    };
  }
  if (room.order === 25) {
    const evidence = lessonEvidence(room, state, options);
    if (evidence.key)
      return {
        id: "key-attuned",
        kind: "introduction",
        title: "Matching locks are open",
        text: "Your key stays with you. Cross a matching lock, even back in an earlier room.",
        cell: local(
          room.doors?.find((door) => state.keys?.includes(door.color))?.cell,
        ),
      };
    const key = room.keys?.find((item) => !state.keys?.includes(item.color));
    const localKey = key ? local(key.cell) : undefined;
    const doorway = room.passages
      ?.flatMap((passage) => [passage.a, passage.b])
      .find((cell) => puzzleAreaIndex(cell) === currentArea);
    return {
      id: "first-key",
      kind: "introduction",
      title: "Keep what you discover",
      text:
        localKey === undefined
          ? "Explore for a key. It opens every matching lock, even back in an earlier room."
          : state.stones.some((stone) => stone.cell === localKey)
            ? "Move the rune off the key to collect it. Keys stay with you and open every matching lock."
            : "Walk over a key. It stays with you and opens every matching lock.",
      cell: localKey ?? doorway,
    };
  }
  if (room.order === 31) {
    const endpoint = room.passages
      ?.filter((passage) => passage.kind === "rift")
      .flatMap((passage) => [passage.a, passage.b])
      .find((cell) => puzzleAreaIndex(cell) === currentArea);
    return {
      id: "first-rift",
      kind: "introduction",
      title: "A different approach",
      text: "A rift moves you to its pair. Runes cannot enter, so plan your approach.",
      cell: endpoint,
    };
  }
  return null;
}

/** An introduction for menus/rehearsal; requesting it never resets real progress. */
export function getPuzzleCoachIntro(room: PuzzleRoom): PuzzleCoach | null {
  return getPuzzleCoach(room, initialPuzzleState(room));
}
