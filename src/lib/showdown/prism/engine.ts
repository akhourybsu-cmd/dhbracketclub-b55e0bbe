import {
  PRISM_COLORS, PRISM_DIRECTIONS, PRISM_MAX_ACTIONS, PRISM_MAX_ROTATABLE_MIRRORS,
  type BeamColor, type BeamSegment, type Direction, type MirrorOrientation, type PrismAction,
  type PrismMatchComparison, type PrismMatchStanding, type PrismOrientations, type PrismPuzzle,
  type PrismReplay, type PrismTile, type PrismTrace,
} from './types';

export class PrismValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'PrismValidationError'; }
}
const vectors: Record<Direction, readonly [number, number]> = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
const reflection: Record<MirrorOrientation, Record<Direction, Direction>> = {
  '/': { N: 'E', E: 'N', S: 'W', W: 'S' },
  '\\': { N: 'W', W: 'N', S: 'E', E: 'S' },
};
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const direction = (value: unknown): value is Direction => typeof value === 'string' && (PRISM_DIRECTIONS as readonly string[]).includes(value);
const color = (value: unknown): value is BeamColor => typeof value === 'string' && (PRISM_COLORS as readonly string[]).includes(value);
const orientation = (value: unknown): value is MirrorOrientation => value === '/' || value === '\\';
const allowedKeys = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));

export function reflectDirection(incoming: Direction, mirror: MirrorOrientation): Direction {
  if (!direction(incoming) || !orientation(mirror)) throw new PrismValidationError('Invalid mirror reflection.');
  return reflection[mirror][incoming];
}
export function rotateOrientation(current: MirrorOrientation): MirrorOrientation {
  if (!orientation(current)) throw new PrismValidationError('Invalid mirror orientation.');
  return current === '/' ? '\\' : '/';
}

/** Validate untrusted persisted board content before any rendering or simulation. */
export function validatePuzzleShape(value: unknown): asserts value is PrismPuzzle {
  if (!object(value) || typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(value.id)
    || !Number.isInteger(value.version) || Number(value.version) < 1
    || !['easy', 'medium', 'hard'].includes(String(value.difficulty))
    || !Number.isInteger(value.width) || !Number.isInteger(value.height)
    || Number(value.width) < 2 || Number(value.width) > 10 || Number(value.height) < 2 || Number(value.height) > 10
    || !Array.isArray(value.tiles) || value.tiles.length !== Number(value.width) * Number(value.height)) {
    throw new PrismValidationError('Invalid Prism Break puzzle.');
  }
  let emitters = 0, receivers = 0, rotatable = 0;
  const labels = new Set<string>();
  for (const tile of value.tiles) {
    if (!object(tile)) throw new PrismValidationError('Invalid puzzle tile.');
    let valid = false;
    switch (tile.kind) {
      case 'empty': case 'wall': valid = allowedKeys(tile, ['kind']); break;
      case 'emitter':
        emitters++;
        valid = allowedKeys(tile, ['kind', 'direction', 'color']) && direction(tile.direction) && color(tile.color);
        break;
      case 'mirror':
        if (tile.rotatable === true) rotatable++;
        valid = allowedKeys(tile, ['kind', 'orientation', 'rotatable']) && orientation(tile.orientation) && typeof tile.rotatable === 'boolean';
        break;
      case 'receiver':
        receivers++;
        valid = allowedKeys(tile, ['kind', 'color', 'label']) && color(tile.color) && typeof tile.label === 'string'
          && tile.label.trim().length > 0 && tile.label.length <= 24 && !labels.has(tile.label);
        if (typeof tile.label === 'string') labels.add(tile.label);
        break;
      case 'filter':
        valid = allowedKeys(tile, ['kind', 'accepts', 'output']) && Array.isArray(tile.accepts) && tile.accepts.length > 0
          && tile.accepts.length <= PRISM_COLORS.length && tile.accepts.every(color)
          && new Set(tile.accepts).size === tile.accepts.length && (tile.output === undefined || color(tile.output));
        break;
      case 'splitter': {
        const matches = new Set<string>();
        valid = allowedKeys(tile, ['kind', 'rules']) && Array.isArray(tile.rules) && tile.rules.length > 0 && tile.rules.length <= 28
          && tile.rules.every(rule => {
            if (!object(rule) || !allowedKeys(rule, ['incoming', 'inputColor', 'outputs']) || !direction(rule.incoming)
              || !color(rule.inputColor) || !Array.isArray(rule.outputs) || rule.outputs.length < 1 || rule.outputs.length > 4) return false;
            const key = `${rule.incoming}:${rule.inputColor}`;
            if (matches.has(key)) return false;
            matches.add(key);
            const outputs = new Set<string>();
            return rule.outputs.every(output => {
              if (!object(output) || !allowedKeys(output, ['direction', 'color']) || !direction(output.direction) || !color(output.color)) return false;
              const outputKey = `${output.direction}:${output.color}`;
              if (outputs.has(outputKey)) return false;
              outputs.add(outputKey); return true;
            });
          });
        break;
      }
    }
    if (!valid) throw new PrismValidationError('Invalid puzzle tile configuration.');
  }
  if (emitters < 1 || emitters > 8 || receivers < 1 || receivers > 12 || rotatable < 1 || rotatable > PRISM_MAX_ROTATABLE_MIRRORS) {
    throw new PrismValidationError('Puzzle piece counts are outside the supported limits.');
  }
}

export function initialOrientations(puzzle: PrismPuzzle): PrismOrientations {
  const result: PrismOrientations = {};
  puzzle.tiles.forEach((tile, cell) => { if (tile.kind === 'mirror') result[cell] = tile.orientation; });
  return result;
}
export function rotatableCells(puzzle: PrismPuzzle): number[] {
  return puzzle.tiles.flatMap((tile, cell) => tile.kind === 'mirror' && tile.rotatable ? [cell] : []);
}

interface Ray { cell: number; direction: Direction; color: BeamColor }
function traceValidated(puzzle: PrismPuzzle, orientations: PrismOrientations): PrismTrace {
  const { width, height, tiles } = puzzle;
  const rays: Ray[] = [];
  const segments: BeamSegment[] = [];
  const requiredReceivers: number[] = [];
  const active = new Set<number>();
  const visited = new Set<string>();
  let repeatedStates = 0;
  tiles.forEach((tile, cell) => {
    if (tile.kind === 'emitter') rays.push({ cell, direction: tile.direction, color: tile.color });
    if (tile.kind === 'receiver') requiredReceivers.push(cell);
  });
  for (let cursor = 0; cursor < rays.length; cursor++) {
    let ray: Ray | undefined = rays[cursor];
    while (ray) {
      const fromX = ray.cell % width, fromY = Math.floor(ray.cell / width);
      const [dx, dy] = vectors[ray.direction];
      const x = fromX + dx, y = fromY + dy;
      const from = { x: fromX + 0.5, y: fromY + 0.5 };
      if (x < 0 || x >= width || y < 0 || y >= height) {
        segments.push({ from, to: { x: Math.max(0, Math.min(width, from.x + dx * 0.5)), y: Math.max(0, Math.min(height, from.y + dy * 0.5)) }, direction: ray.direction, color: ray.color, fromCell: ray.cell, toCell: null });
        break;
      }
      const cell = y * width + x;
      const state = `${cell}:${ray.direction}:${ray.color}`;
      segments.push({ from, to: { x: x + 0.5, y: y + 0.5 }, direction: ray.direction, color: ray.color, fromCell: ray.cell, toCell: cell });
      if (visited.has(state)) { repeatedStates++; break; }
      visited.add(state);
      const tile = tiles[cell];
      if (tile.kind === 'wall' || tile.kind === 'emitter') break;
      if (tile.kind === 'receiver') {
        if (tile.color === ray.color) active.add(cell);
        break;
      }
      if (tile.kind === 'mirror') {
        ray = { cell, direction: reflection[orientations[cell] ?? tile.orientation][ray.direction], color: ray.color };
      } else if (tile.kind === 'filter') {
        if (!tile.accepts.includes(ray.color)) break;
        ray = { cell, direction: ray.direction, color: tile.output ?? ray.color };
      } else if (tile.kind === 'splitter') {
        const rule = tile.rules.find(rule => rule.incoming === ray!.direction && rule.inputColor === ray!.color);
        if (rule) rule.outputs.forEach(output => rays.push({ cell, direction: output.direction, color: output.color }));
        break;
      } else ray = { cell, direction: ray.direction, color: ray.color };
    }
  }
  const activatedReceivers = [...active].sort((a, b) => a - b);
  return { segments, activatedReceivers, requiredReceivers, solved: requiredReceivers.length > 0 && activatedReceivers.length === requiredReceivers.length, repeatedStates, visitedStates: visited.size };
}

export function traceBeams(puzzle: PrismPuzzle, orientations: PrismOrientations = initialOrientations(puzzle)): PrismTrace {
  validatePuzzleShape(puzzle);
  for (const [key, value] of Object.entries(orientations)) {
    const cell = Number(key), tile = puzzle.tiles[cell];
    if (!Number.isInteger(cell) || !tile || tile.kind !== 'mirror' || !orientation(value)
      || (!tile.rotatable && value !== tile.orientation)) throw new PrismValidationError('Invalid mirror configuration.');
  }
  return traceValidated(puzzle, orientations);
}

export function validateAction(value: unknown, puzzle: PrismPuzzle): asserts value is PrismAction {
  if (!object(value)) throw new PrismValidationError('Invalid puzzle action.');
  if (value.type === 'reset' && allowedKeys(value, ['type'])) return;
  if (value.type !== 'rotate' || !allowedKeys(value, ['type', 'cell']) || !Number.isInteger(value.cell)) throw new PrismValidationError('Invalid puzzle action.');
  const tile = puzzle.tiles[Number(value.cell)];
  if (!tile || tile.kind !== 'mirror' || !tile.rotatable) throw new PrismValidationError('Only movable mirrors can rotate.');
}

/** Reconstructs the complete attempt; a reset restores positions without refunding rotations. */
export function replayActions(puzzle: PrismPuzzle, actions: readonly PrismAction[]): PrismReplay {
  validatePuzzleShape(puzzle);
  if (!Array.isArray(actions) || actions.length > PRISM_MAX_ACTIONS) throw new PrismValidationError('This puzzle reached its action limit. Skip to continue.');
  let orientations = initialOrientations(puzzle), rotations = 0;
  let trace = traceValidated(puzzle, orientations);
  for (const action of actions) {
    if (trace.solved) throw new PrismValidationError('This puzzle is already complete.');
    validateAction(action, puzzle);
    if (action.type === 'reset') orientations = initialOrientations(puzzle);
    else { orientations[action.cell] = rotateOrientation(orientations[action.cell]); rotations++; }
    trace = traceValidated(puzzle, orientations);
  }
  return { rotations, orientations, solved: trace.solved, trace };
}

export function scoreRound(minimumRotations: number, playerRotations: number, skipped = false): number {
  if (!Number.isInteger(minimumRotations) || minimumRotations < 1 || !Number.isInteger(playerRotations) || playerRotations < 0) throw new PrismValidationError('Invalid rotation count.');
  if (skipped) return 0;
  if (playerRotations < minimumRotations) throw new PrismValidationError('A completed attempt cannot beat the validated minimum.');
  return 300 + Math.min(200, Math.round(200 * minimumRotations / playerRotations));
}

export function compareMatch(first: PrismMatchStanding, second: PrismMatchStanding): PrismMatchComparison {
  for (const standing of [first, second]) {
    if (![standing.totalScore, standing.solvedRounds, standing.totalRotations].every(value => Number.isInteger(value) && value >= 0)
      || standing.totalScore > 1500 || standing.solvedRounds > 3 || standing.totalRotations > 3 * PRISM_MAX_ACTIONS) throw new PrismValidationError('Invalid match totals.');
  }
  const difference = first.totalScore - second.totalScore || first.solvedRounds - second.solvedRounds || second.totalRotations - first.totalRotations;
  return difference > 0 ? 'first' : difference < 0 ? 'second' : 'draw';
}

/** Solver-only fast path: callers validate once before exploring a bounded state space. */
export const traceValidatedPuzzle = traceValidated;
export type { PrismAction, PrismPuzzle, PrismTile, PrismTrace };
