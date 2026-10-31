import type { HeroClass } from "../classConfig";
import type { RuneType } from "../dungeonGenerator";

export type PuzzleDirection = "up" | "right" | "down" | "left";
export type PuzzleMechanic = "runes" | "gates" | "ice";
export interface PuzzleStone { id: string; color: RuneType; cell: number }
export interface PuzzleSigil { color: RuneType; cell: number }
export interface PuzzleGuardian {
  cell: number;
  color: RuneType;
  archetypeId: string;
  name: string;
}
/** Cell indices are row-major, 0..35. Definitions are immutable per id/version. */
export interface PuzzleRoom {
  id: string;
  version: number;
  order: number;
  chapter: 1 | 2 | 3;
  title: string;
  lesson: string;
  mechanic: PuzzleMechanic;
  width: 6;
  height: 6;
  walls: number[];
  start: number;
  exit: number;
  stones: PuzzleStone[];
  sigils: PuzzleSigil[];
  plates: number[];
  gates: number[];
  ice: number[];
  treasures: number[];
  guardian?: PuzzleGuardian;
  parPushes: number;
  solution: PuzzleDirection[];
}
export interface PuzzleState {
  player: number;
  stones: PuzzleStone[];
  collected: number[];
  moves: number;
  pushes: number;
  status: "playing" | "solved";
}
export interface PuzzleMoveResult {
  state: PuzzleState;
  moved: boolean;
  pushed: boolean;
  reason?: "wall" | "stone" | "gate" | "guardian" | "finished";
}
export interface PuzzleSolveResult {
  status: "solved" | "unsolvable" | "budget";
  actions: PuzzleDirection[];
  pushes: number;
  explored: number;
}
export interface PuzzleRecord {
  room_id: string;
  definition_version: number;
  stars: number;
  best_pushes: number;
  best_moves: number;
  treasure_collected: boolean;
}
export interface PuzzleProgress {
  unlocked: number;
  completed: number;
  stars: number;
  avatar: HeroClass;
  records: PuzzleRecord[];
}
export interface PuzzleCompletionReceipt {
  requestId: string;
  roomId: string;
  definitionVersion: number;
  stars: number;
  starsGained: number;
  pushes: number;
  moves: number;
  treasureCollected: boolean;
  firstClear: boolean;
  unlocked: number;
  progress: PuzzleProgress;
}
