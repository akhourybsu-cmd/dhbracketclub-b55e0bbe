import type { RuneType } from "../dungeonGenerator";
import type {
  PuzzleDirection,
  PuzzleMoveResult,
  PuzzleRoom,
  PuzzleState,
} from "./types";

export const PUZZLE_DIRECTIONS: readonly PuzzleDirection[] = [
  "up",
  "right",
  "down",
  "left",
];
export const MAX_PUZZLE_ACTIONS = 1200;
export const PUZZLE_AREA_CELLS = 36;
export const MAX_PUZZLE_AREAS = 3;
const COLORS: readonly RuneType[] = ["red", "blue", "green", "gold"];

export function puzzleAreaIndex(cell: number): number {
  return Math.floor(cell / PUZZLE_AREA_CELLS);
}

export function puzzleAreaCount(room: Pick<PuzzleRoom, "areas">): number {
  return Array.isArray(room.areas) && room.areas.length ? room.areas.length : 1;
}

/** Passage travel happens once on entry, never recursively from its destination. */
export function puzzlePassageDestination(
  room: Pick<PuzzleRoom, "passages">,
  cell: number,
): number | null {
  const passage = room.passages?.find(
    (item) => item.a === cell || item.b === cell,
  );
  return passage ? (passage.a === cell ? passage.b : passage.a) : null;
}

/** Orthogonal neighbors stay inside their area and never wrap rows or boards. */
export function puzzleNeighbor(
  room: Pick<PuzzleRoom, "width" | "height" | "areas">,
  cell: number,
  direction: PuzzleDirection,
): number | null {
  if (
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell >= puzzleAreaCount(room) * PUZZLE_AREA_CELLS
  )
    return null;
  const localCell = cell % PUZZLE_AREA_CELLS;
  const r = Math.floor(localCell / room.width);
  const c = localCell % room.width;
  if (direction === "up") return r > 0 ? cell - room.width : null;
  if (direction === "right") return c + 1 < room.width ? cell + 1 : null;
  if (direction === "down")
    return r + 1 < room.height ? cell + room.width : null;
  if (direction === "left") return c > 0 ? cell - 1 : null;
  return null;
}

export function puzzleSigilsFilled(
  room: PuzzleRoom,
  state: PuzzleState,
): number {
  return room.sigils.filter((sigil) =>
    state.stones.some(
      (stone) => stone.cell === sigil.cell && stone.color === sigil.color,
    ),
  ).length;
}

/** Guardians are calmed by their runes. They remain alive and can be bypassed. */
export function puzzleGuardianCalm(
  room: PuzzleRoom,
  state: PuzzleState,
): boolean {
  if (!room.guardian) return true;
  const sigils = room.sigils.filter(
    (sigil) => sigil.color === room.guardian.color,
  );
  return (
    sigils.length > 0 &&
    sigils.every((sigil) =>
      state.stones.some(
        (stone) => stone.cell === sigil.cell && stone.color === sigil.color,
      ),
    )
  );
}

/** An occupied gate stays open until its occupant has safely left it. */
export function puzzleOpenGates(
  room: PuzzleRoom,
  state: PuzzleState,
): number[] {
  const occupied = new Set([
    state.player,
    ...state.stones.map((stone) => stone.cell),
  ]);
  return room.plates.some((cell) => occupied.has(cell))
    ? room.gates.slice()
    : room.gates.filter((cell) => occupied.has(cell));
}

/** Keys are reusable; collecting one opens every matching door in the adventure. */
export function puzzleOpenDoors(
  room: Pick<PuzzleRoom, "doors">,
  state: Pick<PuzzleState, "keys">,
): number[] {
  return (room.doors ?? [])
    .filter((door) => state.keys?.includes(door.color))
    .map((door) => door.cell);
}

function collectKey(room: PuzzleRoom, state: PuzzleState): void {
  const key = room.keys?.find((item) => item.cell === state.player);
  if (key && !state.keys?.includes(key.color))
    state.keys = [...(state.keys ?? []), key.color].sort();
}

function isSolved(room: PuzzleRoom, state: PuzzleState): boolean {
  return (
    state.player === room.exit &&
    puzzleSigilsFilled(room, state) === room.sigils.length
  );
}

export function initialPuzzleState(room: PuzzleRoom): PuzzleState {
  const state: PuzzleState = {
    player: room.start,
    stones: room.stones.map((stone) => ({ ...stone })),
    collected: room.treasures.includes(room.start) ? [room.start] : [],
    moves: 0,
    pushes: 0,
    status: "playing",
  };
  if (room.keys?.length || room.doors?.length) {
    state.keys = [];
    collectKey(room, state);
  }
  if (puzzleAreaCount(room) > 1)
    state.visitedAreas = [puzzleAreaIndex(room.start)];
  if (isSolved(room, state)) state.status = "solved";
  return state;
}

type BlockReason = Exclude<PuzzleMoveResult["reason"], "finished">;
function blocked(
  room: PuzzleRoom,
  state: PuzzleState,
  cell: number | null,
  ignoreStone?: string,
  forStone = false,
): BlockReason | undefined {
  if (
    cell === null ||
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell >= puzzleAreaCount(room) * PUZZLE_AREA_CELLS ||
    room.walls.includes(cell)
  )
    return "wall";
  if (
    state.stones.some(
      (stone) => stone.id !== ignoreStone && stone.cell === cell,
    )
  )
    return "stone";
  if (room.gates.includes(cell) && !puzzleOpenGates(room, state).includes(cell))
    return "gate";
  const door = room.doors?.find((item) => item.cell === cell);
  if (door && !state.keys?.includes(door.color)) return "door";
  if (room.guardian?.cell === cell && !puzzleGuardianCalm(room, state))
    return "guardian";
  if (forStone && puzzlePassageDestination(room, cell) !== null)
    return "passage";
  return undefined;
}

/** One player intent. A push can slide, but neither walking nor pushes are random. */
export function movePuzzle(
  room: PuzzleRoom,
  state: PuzzleState,
  direction: PuzzleDirection,
): PuzzleMoveResult {
  if (state.status === "solved")
    return { state, moved: false, pushed: false, reason: "finished" };
  const nextCell = puzzleNeighbor(room, state.player, direction);
  const stone = state.stones.find((item) => item.cell === nextCell);
  // A stone can have entered a calm guardian's cell before its color stopped
  // matching. Moving it again must not let the hero enter an active ward.
  const heroReason = blocked(room, state, nextCell, stone?.id);
  if (heroReason)
    return { state, moved: false, pushed: false, reason: heroReason };
  const landing = stone
    ? puzzleNeighbor(room, stone.cell, direction)
    : nextCell;
  const reason = blocked(room, state, landing, stone?.id, Boolean(stone));
  if (reason) return { state, moved: false, pushed: false, reason };
  const destination = stone
    ? nextCell!
    : (puzzlePassageDestination(room, nextCell!) ?? nextCell!);
  const destinationReason = blocked(room, state, destination, stone?.id);
  if (destinationReason)
    return { state, moved: false, pushed: false, reason: destinationReason };
  // Walking into a non-stone cell and the initial landing of a push both use
  // pre-action plates/guardian state. The hero then occupies the old stone cell.
  const next: PuzzleState = {
    ...state,
    player: destination,
    stones: state.stones.map((item) => ({ ...item })),
    collected: state.collected.slice(),
    moves: state.moves + 1,
    pushes: state.pushes + (stone ? 1 : 0),
  };
  // As with a newly occupied pressure plate, a revealed key can affect the
  // remainder of an ice slide. Its initial landing was checked above first.
  collectKey(room, next);
  if (stone) {
    const moving = next.stones.find((item) => item.id === stone.id)!;
    moving.cell = landing!;
    // Every ice step sees current stone/hero occupancy, so a plate released
    // during a slide can close the next gate. Stones never push other stones.
    while (room.ice.includes(moving.cell)) {
      const slide = puzzleNeighbor(room, moving.cell, direction);
      if (blocked(room, next, slide, moving.id, true)) break;
      moving.cell = slide!;
    }
  }
  if (puzzleAreaCount(room) > 1)
    next.visitedAreas = [
      ...new Set([
        ...(state.visitedAreas ?? [puzzleAreaIndex(state.player)]),
        puzzleAreaIndex(next.player),
      ]),
    ].sort((a, b) => a - b);
  if (
    room.treasures.includes(next.player) &&
    !next.collected.includes(next.player)
  ) {
    next.collected.push(next.player);
    next.collected.sort((a, b) => a - b);
  }
  if (isSolved(room, next)) next.status = "solved";
  return { state: next, moved: true, pushed: Boolean(stone) };
}

export function replayPuzzle(
  room: PuzzleRoom,
  actions: readonly unknown[],
): { state: PuzzleState; valid: boolean; error?: string } {
  let state = initialPuzzleState(room);
  if (!Array.isArray(actions) || actions.length > MAX_PUZZLE_ACTIONS)
    return { state, valid: false, error: "invalid_actions" };
  for (let index = 0; index < actions.length; index++) {
    const direction = actions[index];
    if (!PUZZLE_DIRECTIONS.includes(direction as PuzzleDirection))
      return { state, valid: false, error: `invalid_direction:${index}` };
    const result = movePuzzle(room, state, direction as PuzzleDirection);
    if (!result.moved)
      return { state, valid: false, error: `${result.reason}:${index}` };
    state = result.state;
  }
  return { state, valid: true };
}

/** Medals reward solving, push efficiency and exploration. Walking is a tiebreaker. */
export function puzzleStars(room: PuzzleRoom, state: PuzzleState): number {
  if (state.status !== "solved" || !isSolved(room, state)) return 0;
  return (
    1 +
    Number(state.pushes <= room.parPushes) +
    Number(room.treasures.every((cell) => state.collected.includes(cell)))
  );
}

/** Definition validation is independent of solution verification, for authoring tools. */
export function validatePuzzleRoom(room: PuzzleRoom): string[] {
  const errors: string[] = [];
  if (!room || typeof room !== "object") return ["Room must be an object"];
  if (
    typeof room.id !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(room.id)
  )
    errors.push("Room id is invalid");
  if (!Number.isInteger(room.version) || room.version < 1)
    errors.push("Room version must be a positive integer");
  if (!Number.isInteger(room.order) || room.order < 1)
    errors.push("Room order must be a positive integer");
  if (![1, 2, 3, 4, 5, 6].includes(room.chapter))
    errors.push("Room chapter must be between 1 and 6");
  if (
    !["runes", "gates", "ice", "passages", "keys", "rifts"].includes(
      room.mechanic,
    )
  )
    errors.push("Unknown puzzle mechanic");
  if (
    room.areas !== undefined &&
    (!Array.isArray(room.areas) ||
      room.areas.length < 1 ||
      room.areas.length > MAX_PUZZLE_AREAS ||
      room.areas.some(
        (area) =>
          !area ||
          typeof area.id !== "string" ||
          !area.id.trim() ||
          typeof area.title !== "string" ||
          !area.title.trim(),
      ) ||
      new Set(room.areas.map((area) => area.id)).size !== room.areas.length)
  )
    errors.push("Areas need 1 to 3 named boards with unique ids");
  if (room.width !== 6 || room.height !== 6)
    errors.push("Rooms must be 6 by 6");
  if (!Number.isInteger(room.parPushes) || room.parPushes < 0)
    errors.push("Par pushes must be a nonnegative integer");
  const validCell = (cell: unknown): cell is number =>
    Number.isInteger(cell) &&
    Number(cell) >= 0 &&
    Number(cell) < puzzleAreaCount(room) * PUZZLE_AREA_CELLS;
  const arrays = ["walls", "plates", "gates", "ice", "treasures"] as const;
  for (const key of arrays) {
    if (!Array.isArray(room[key]) || !room[key].every(validCell))
      errors.push(`${key} contains invalid cells`);
    else if (new Set(room[key]).size !== room[key].length)
      errors.push(`${key} contains duplicate cells`);
  }
  for (const key of ["keys", "doors", "passages"] as const)
    if (room[key] !== undefined && !Array.isArray(room[key]))
      errors.push(`${key} must be an array`);
  if (
    !validCell(room.start) ||
    !validCell(room.exit) ||
    room.start === room.exit
  )
    errors.push("Start and exit must be distinct board cells");
  if (
    !Array.isArray(room.stones) ||
    !room.stones.length ||
    room.stones.length > 8
  )
    errors.push("Rooms need 1 to 8 stones");
  if (
    !Array.isArray(room.sigils) ||
    !room.sigils.length ||
    room.sigils.length > 8
  )
    errors.push("Rooms need 1 to 8 sigils");
  if (
    errors.some((error) =>
      /invalid cells|must be 6|need 1|must be an array/.test(error),
    )
  )
    return errors;
  const walls = new Set(room.walls);
  const floorCell = (cell: unknown) => validCell(cell) && !walls.has(cell);
  for (const key of ["start", "exit"] as const)
    if (!floorCell(room[key])) errors.push(`${key} must be on floor`);
  for (const key of ["plates", "gates", "ice", "treasures"] as const)
    if (room[key].some((cell) => walls.has(cell)))
      errors.push(`${key} must be on floor`);
  if (!room.treasures.length)
    errors.push("Every room needs at least one optional treasure");
  if (
    room.stones.some(
      (stone) =>
        !stone ||
        typeof stone.id !== "string" ||
        !stone.id.length ||
        !COLORS.includes(stone.color) ||
        !floorCell(stone.cell),
    )
  ) {
    errors.push("Stone identity, color or cell is invalid");
    return errors;
  }
  if (new Set(room.stones.map((stone) => stone.id)).size !== room.stones.length)
    errors.push("Stone ids must be unique");
  if (
    new Set(room.stones.map((stone) => stone.cell)).size !== room.stones.length
  )
    errors.push("Stones cannot overlap");
  if (room.stones.some((stone) => stone.cell === room.start))
    errors.push("Start cannot overlap a stone");
  if (
    room.sigils.some(
      (sigil) =>
        !sigil || !COLORS.includes(sigil.color) || !floorCell(sigil.cell),
    )
  ) {
    errors.push("Sigil color or cell is invalid");
    return errors;
  }
  if (
    new Set(room.sigils.map((sigil) => sigil.cell)).size !== room.sigils.length
  )
    errors.push("Sigils cannot overlap each other");
  for (const color of COLORS)
    if (
      room.sigils.filter((sigil) => sigil.color === color).length >
      room.stones.filter((stone) => stone.color === color).length
    )
      errors.push(`Not enough ${color} stones for its sigils`);
  if (room.guardian) {
    const guardian = room.guardian;
    if (
      !floorCell(guardian.cell) ||
      !COLORS.includes(guardian.color) ||
      typeof guardian.name !== "string" ||
      !guardian.name ||
      typeof guardian.archetypeId !== "string" ||
      !guardian.archetypeId
    )
      errors.push("Guardian identity, color or cell is invalid");
    if (
      [
        room.start,
        room.exit,
        ...room.gates,
        ...room.stones.map((stone) => stone.cell),
      ].includes(guardian.cell)
    )
      errors.push("Guardian overlaps an actor, gate or exit");
    if (!room.sigils.some((sigil) => sigil.color === guardian.color))
      errors.push("Guardian needs at least one matching sigil");
  }
  if (room.gates.length && !room.plates.length)
    errors.push("Gates need a pressure plate");
  for (const key of ["keys", "doors"] as const) {
    const markers = room[key] ?? [];
    if (
      markers.some(
        (marker) =>
          !marker || !COLORS.includes(marker.color) || !floorCell(marker.cell),
      )
    )
      errors.push(`${key} color or cell is invalid`);
    else if (
      new Set(markers.map((marker) => marker.cell)).size !== markers.length
    )
      errors.push(`${key} cannot overlap each other`);
  }
  if (errors.some((error) => /keys|doors/.test(error))) return errors;
  if (
    room.doors?.some(
      (door) => !room.keys?.some((key) => key.color === door.color),
    )
  )
    errors.push("Every door needs a matching key");
  const reserved = new Set([
    ...room.walls,
    room.start,
    room.exit,
    ...room.stones.map((stone) => stone.cell),
    ...room.sigils.map((sigil) => sigil.cell),
    ...room.plates,
    ...room.gates,
    ...room.ice,
    ...room.treasures,
    ...(room.keys ?? []).map((key) => key.cell),
    ...(room.doors ?? []).map((door) => door.cell),
    ...(room.guardian ? [room.guardian.cell] : []),
  ]);
  const endpoints = new Set<number>();
  for (const passage of room.passages ?? []) {
    if (
      !passage ||
      !floorCell(passage.a) ||
      !floorCell(passage.b) ||
      (passage.kind !== undefined &&
        !["passage", "rift"].includes(passage.kind))
    ) {
      errors.push("Passage endpoints or kind are invalid");
      continue;
    }
    if (
      passage.a === passage.b ||
      endpoints.has(passage.a) ||
      endpoints.has(passage.b)
    )
      errors.push("Passage endpoints must be distinct and unique");
    endpoints.add(passage.a);
    endpoints.add(passage.b);
    if (reserved.has(passage.a) || reserved.has(passage.b))
      errors.push(
        "Passage endpoints cannot overlap actors, markers, start or exit",
      );
  }
  if (
    !Array.isArray(room.solution) ||
    room.solution.length > MAX_PUZZLE_ACTIONS ||
    room.solution.some((direction) => !PUZZLE_DIRECTIONS.includes(direction))
  )
    errors.push("Solution actions are invalid");
  return errors;
}
