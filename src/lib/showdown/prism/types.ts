/** Version-one public Prism Break data. Private par/solver metadata is never part of a play payload. */
export const PRISM_RULES_VERSION = 1;
export const PRISM_MAX_ACTIONS = 512;
export const PRISM_MAX_ROTATABLE_MIRRORS = 16;
export const PRISM_DIRECTIONS = ['N', 'E', 'S', 'W'] as const;
export const PRISM_COLORS = ['cyan', 'magenta', 'gold', 'white', 'red', 'green', 'blue'] as const;

export type Direction = typeof PRISM_DIRECTIONS[number];
export type BeamColor = typeof PRISM_COLORS[number];
export type MirrorOrientation = '/' | '\\';
export type PrismDifficulty = 'easy' | 'medium' | 'hard';
export interface PrismPoint { x: number; y: number }
export interface PrismOutput { direction: Direction; color: BeamColor }
export interface PrismSplitterRule { incoming: Direction; inputColor: BeamColor; outputs: PrismOutput[] }
export type PrismTile =
  | { kind: 'empty' }
  | { kind: 'wall' }
  | { kind: 'emitter'; direction: Direction; color: BeamColor }
  | { kind: 'mirror'; orientation: MirrorOrientation; rotatable: boolean }
  | { kind: 'receiver'; color: BeamColor; label: string }
  | { kind: 'filter'; accepts: BeamColor[]; output?: BeamColor }
  | { kind: 'splitter'; rules: PrismSplitterRule[] };

export interface PrismPuzzle {
  id: string;
  version: number;
  difficulty: PrismDifficulty;
  width: number;
  height: number;
  tiles: PrismTile[];
}
export type PrismAction = { type: 'rotate'; cell: number } | { type: 'reset' };
export type PrismOrientations = Record<number, MirrorOrientation>;
export interface BeamSegment {
  from: PrismPoint;
  to: PrismPoint;
  direction: Direction;
  color: BeamColor;
  fromCell: number;
  toCell: number | null;
}
export interface PrismTrace {
  segments: BeamSegment[];
  activatedReceivers: number[];
  requiredReceivers: number[];
  solved: boolean;
  repeatedStates: number;
  visitedStates: number;
}
export interface PrismReplay {
  rotations: number;
  orientations: PrismOrientations;
  solved: boolean;
  trace: PrismTrace;
}
export interface PrismMatchStanding {
  totalScore: number;
  solvedRounds: number;
  totalRotations: number;
}
export type PrismMatchComparison = 'first' | 'second' | 'draw';
