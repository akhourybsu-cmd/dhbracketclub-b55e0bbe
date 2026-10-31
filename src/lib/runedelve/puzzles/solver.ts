import {
  initialPuzzleState,
  MAX_PUZZLE_ACTIONS,
  movePuzzle,
  PUZZLE_DIRECTIONS,
  validatePuzzleRoom,
} from "./engine";
import type {
  PuzzleDirection,
  PuzzleRoom,
  PuzzleSolveResult,
  PuzzleState,
} from "./types";

export const DEFAULT_PUZZLE_SOLVER_BUDGET = 75_000;

interface SearchNode {
  state: PuzzleState;
  key: string;
  parent: SearchNode | null;
  action?: PuzzleDirection;
  serial: number;
}
interface Cost {
  pushes: number;
  moves: number;
}
const cheaper = (a: Cost, b: Cost) =>
  a.pushes < b.pushes || (a.pushes === b.pushes && a.moves < b.moves);
const sameCost = (a: Cost, b: Cost) =>
  a.pushes === b.pushes && a.moves === b.moves;
const dominates = (a: Cost, b: Cost) =>
  a.pushes <= b.pushes && a.moves <= b.moves;
const earlier = (a: SearchNode, b: SearchNode) =>
  cheaper(a.state, b.state) ||
  (sameCost(a.state, b.state) && a.serial < b.serial);

class SearchHeap {
  private nodes: SearchNode[] = [];
  get size() {
    return this.nodes.length;
  }
  push(node: SearchNode) {
    this.nodes.push(node);
    let index = this.nodes.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!earlier(this.nodes[index], this.nodes[parent])) break;
      [this.nodes[parent], this.nodes[index]] = [
        this.nodes[index],
        this.nodes[parent],
      ];
      index = parent;
    }
  }
  pop(): SearchNode {
    const first = this.nodes[0];
    const last = this.nodes.pop()!;
    if (this.nodes.length) {
      this.nodes[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let next = index;
        if (
          left < this.nodes.length &&
          earlier(this.nodes[left], this.nodes[next])
        )
          next = left;
        if (
          right < this.nodes.length &&
          earlier(this.nodes[right], this.nodes[next])
        )
          next = right;
        if (next === index) break;
        [this.nodes[next], this.nodes[index]] = [
          this.nodes[index],
          this.nodes[next],
        ];
        index = next;
      }
    }
    return first;
  }
}

/** Every mechanic is derived from exact actor positions, not a flood-fill representative.
 * Equal-color stones are interchangeable; their stable ids do not affect room rules. */
export function puzzleStateKey(state: PuzzleState): string {
  return `${state.player}|${state.stones
    .map((stone) => `${stone.color}:${stone.cell}`)
    .sort()
    .join(",")}|${state.collected
    .slice()
    .sort((a, b) => a - b)
    .join(",")}`;
}

function actionsTo(node: SearchNode): PuzzleDirection[] {
  const actions: PuzzleDirection[] = [];
  let cursor: SearchNode | null = node;
  while (cursor?.parent) {
    actions.push(cursor.action!);
    cursor = cursor.parent;
  }
  return actions.reverse();
}

/** Exact bounded Dijkstra search: minimize pushes first, then walking.
 * `pushes` is the terminal run total; `actions` is only the remaining route.
 * A budget result never claims that the puzzle is impossible. */
export function solvePuzzle(
  room: PuzzleRoom,
  startState?: PuzzleState,
  options: { maxStates?: number; requireTreasure?: boolean } = {},
): PuzzleSolveResult {
  if (validatePuzzleRoom(room).length)
    return {
      status: "unsolvable",
      actions: [],
      pushes: startState?.pushes ?? 0,
      explored: 0,
    };
  const initialState = startState ?? initialPuzzleState(room);
  const empty = (
    status: "unsolvable" | "budget",
    explored: number,
  ): PuzzleSolveResult => ({
    status,
    actions: [],
    pushes: initialState.pushes,
    explored,
  });
  const goal = (state: PuzzleState) =>
    state.status === "solved" &&
    (!options.requireTreasure ||
      room.treasures.every((cell) => state.collected.includes(cell)));
  if (goal(initialState))
    return {
      status: "solved",
      actions: [],
      pushes: initialState.pushes,
      explored: 0,
    };
  if (
    initialState.status === "solved" ||
    initialState.moves >= MAX_PUZZLE_ACTIONS
  )
    return empty("unsolvable", 0);
  const maxStates = Number.isFinite(options.maxStates)
    ? Math.max(0, Math.min(300_000, Math.floor(options.maxStates!)))
    : DEFAULT_PUZZLE_SOLVER_BUDGET;
  if (maxStates === 0) return empty("budget", 0);

  const initial: SearchNode = {
    state: initialState,
    key: puzzleStateKey(initialState),
    parent: null,
    serial: 0,
  };
  const heap = new SearchHeap();
  heap.push(initial);
  // A lower-push detour can take more steps. Keep its shorter higher-push
  // alternative too: the latter may be the only route fitting the trail cap.
  const best = new Map<string, Cost[]>([
    [initial.key, [{ pushes: initialState.pushes, moves: initialState.moves }]],
  ]);
  let serial = 0;
  let explored = 0;
  while (heap.size) {
    const node = heap.pop();
    const cost = best.get(node.key);
    if (!cost?.some((candidate) => sameCost(candidate, node.state))) continue;
    if (goal(node.state))
      return {
        status: "solved",
        actions: actionsTo(node),
        pushes: node.state.pushes,
        explored,
      };
    if (explored >= maxStates) return empty("budget", explored);
    explored += 1;
    if (node.state.moves >= MAX_PUZZLE_ACTIONS) continue;
    for (const action of PUZZLE_DIRECTIONS) {
      const moved = movePuzzle(room, node.state, action);
      if (!moved.moved) continue;
      // A finished portal cannot be left again to fetch missed treasure.
      if (moved.state.status === "solved" && !goal(moved.state)) continue;
      const key = puzzleStateKey(moved.state);
      const previous = best.get(key);
      if (previous?.some((cost) => dominates(cost, moved.state))) continue;
      best.set(key, [
        ...(previous ?? []).filter((cost) => !dominates(moved.state, cost)),
        { pushes: moved.state.pushes, moves: moved.state.moves },
      ]);
      heap.push({
        state: moved.state,
        key,
        parent: node,
        action,
        serial: ++serial,
      });
    }
  }
  return empty("unsolvable", explored);
}
