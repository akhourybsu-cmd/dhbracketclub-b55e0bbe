import { describe, expect, it } from 'vitest';
import {
  compareMatch, initialOrientations, PrismValidationError, reflectDirection, replayActions,
  rotateOrientation, scoreRound, traceBeams, validatePuzzleShape,
} from '@/lib/showdown/prism/engine';
import { solvePuzzle, validatePublishedPuzzle } from '@/lib/showdown/prism/solver';
import { PRISM_MAX_ACTIONS, type Direction, type MirrorOrientation, type PrismAction, type PrismPuzzle, type PrismTile } from '@/lib/showdown/prism/types';

function puzzle(pieces: [number, number, PrismTile][], id = 'test-prism'): PrismPuzzle {
  const tiles: PrismTile[] = Array.from({ length: 25 }, () => ({ kind: 'empty' }));
  pieces.forEach(([x, y, tile]) => { tiles[y * 5 + x] = tile; });
  return { id, version: 1, difficulty: 'easy', width: 5, height: 5, tiles };
}
const mirror = (orientation: MirrorOrientation, rotatable = true): PrismTile => ({ kind: 'mirror', orientation, rotatable });
function oneTurn(): PrismPuzzle {
  return puzzle([
    [0, 2, { kind: 'emitter', direction: 'E', color: 'cyan' }],
    [2, 2, mirror('\\')], [2, 0, { kind: 'receiver', color: 'cyan', label: 'A' }],
    [4, 4, mirror('/')],
  ]);
}
function twoBranches(): PrismPuzzle {
  return puzzle([
    [0, 2, { kind: 'emitter', direction: 'E', color: 'white' }],
    [2, 2, { kind: 'splitter', rules: [{ incoming: 'E', inputColor: 'white', outputs: [{ direction: 'N', color: 'cyan' }, { direction: 'E', color: 'gold' }] }] }],
    [2, 1, mirror('/')], [3, 2, mirror('/')],
    [0, 1, { kind: 'receiver', color: 'cyan', label: 'A' }],
    [3, 4, { kind: 'receiver', color: 'gold', label: 'B' }],
  ]);
}

describe('Prism mirror mathematics', () => {
  it.each<[MirrorOrientation, Direction, Direction]>([
    ['/', 'N', 'E'], ['/', 'E', 'N'], ['/', 'S', 'W'], ['/', 'W', 'S'],
    ['\\', 'N', 'W'], ['\\', 'W', 'N'], ['\\', 'S', 'E'], ['\\', 'E', 'S'],
  ])('%s reflects %s to %s', (mirror, incoming, expected) => {
    expect(reflectDirection(incoming, mirror)).toBe(expected);
  });
  it('rotates each orientation back after two taps', () => {
    expect(rotateOrientation('/')).toBe('\\');
    expect(rotateOrientation(rotateOrientation('/'))).toBe('/');
  });
  it('rejects unsupported direction and orientation values', () => {
    expect(() => reflectDirection('NE' as Direction, '/')).toThrow(PrismValidationError);
    expect(() => rotateOrientation('horizontal' as MirrorOrientation)).toThrow(PrismValidationError);
  });
});

describe('Deterministic beam propagation', () => {
  it('spawns every explicitly encoded colored splitter branch and activates all receivers simultaneously', () => {
    const board = puzzle([
      [0, 2, { kind: 'emitter', direction: 'E', color: 'white' }],
      [2, 2, { kind: 'splitter', rules: [{ incoming: 'E', inputColor: 'white', outputs: [{ direction: 'N', color: 'cyan' }, { direction: 'E', color: 'gold' }, { direction: 'S', color: 'magenta' }] }] }],
      [2, 0, { kind: 'receiver', color: 'cyan', label: 'A' }],
      [4, 2, { kind: 'receiver', color: 'gold', label: 'B' }],
      [2, 4, { kind: 'receiver', color: 'magenta', label: 'C' }],
      [0, 4, mirror('/')],
    ]);
    const trace = traceBeams(board);
    expect(trace.activatedReceivers).toEqual([2, 14, 22]);
    expect(trace.requiredReceivers).toEqual([2, 14, 22]);
    expect(trace.solved).toBe(true);
    expect(new Set(trace.segments.map(segment => segment.color))).toEqual(new Set(['white', 'cyan', 'gold', 'magenta']));
  });
  it('requires the splitter’s incoming travel direction and input color to match', () => {
    const board = twoBranches();
    const splitter = board.tiles[12];
    if (splitter.kind !== 'splitter') throw new Error('Fixture has no splitter');
    splitter.rules[0].inputColor = 'magenta';
    expect(traceBeams(board).segments.some(segment => segment.fromCell === 12)).toBe(false);
    splitter.rules[0].inputColor = 'white';
    splitter.rules[0].incoming = 'W';
    expect(traceBeams(board).segments.some(segment => segment.fromCell === 12)).toBe(false);
  });
  it('filters accepted input, changes only its explicit output color and blocks incompatible light', () => {
    const board = puzzle([
      [0, 2, { kind: 'emitter', direction: 'E', color: 'white' }],
      [2, 2, { kind: 'filter', accepts: ['white'], output: 'cyan' }],
      [4, 2, { kind: 'receiver', color: 'cyan', label: 'A' }], [0, 4, mirror('/')],
    ]);
    expect(traceBeams(board).solved).toBe(true);
    board.tiles[12] = { kind: 'filter', accepts: ['magenta'], output: 'cyan' };
    expect(traceBeams(board).solved).toBe(false);
    board.tiles[12] = { kind: 'filter', accepts: ['white'] };
    expect(traceBeams(board).solved).toBe(false);
  });
  it('tracks colors independently even when two beams traverse the same cells and directions', () => {
    const board = puzzle([
      [0, 2, { kind: 'emitter', direction: 'E', color: 'white' }],
      [1, 2, { kind: 'splitter', rules: [{ incoming: 'E', inputColor: 'white', outputs: [{ direction: 'E', color: 'cyan' }, { direction: 'E', color: 'magenta' }] }] }],
      [3, 2, { kind: 'filter', accepts: ['magenta'], output: 'gold' }],
      [4, 2, { kind: 'receiver', color: 'gold', label: 'A' }], [0, 4, mirror('/')],
    ]);
    expect(traceBeams(board).solved).toBe(true);
    expect(traceBeams(board).segments.filter(segment => segment.toCell === 12).map(segment => segment.color)).toEqual(['cyan', 'magenta']);
  });
  it('does not activate a receiver with the wrong color and treats every receiver as a beam stop', () => {
    const board = puzzle([
      [0, 2, { kind: 'emitter', direction: 'E', color: 'cyan' }],
      [2, 2, { kind: 'receiver', color: 'magenta', label: 'A' }],
      [4, 2, { kind: 'receiver', color: 'cyan', label: 'B' }], [0, 4, mirror('/')],
    ]);
    expect(traceBeams(board).activatedReceivers).toEqual([]);
    board.tiles[12] = { kind: 'receiver', color: 'cyan', label: 'A' };
    expect(traceBeams(board).activatedReceivers).toEqual([12]);
    expect(traceBeams(board).solved).toBe(false);
  });
  it('stops at walls and encodes a precise board-edge endpoint', () => {
    const board = oneTurn();
    board.tiles[11] = { kind: 'wall' };
    expect(traceBeams(board).segments).toHaveLength(1);
    expect(traceBeams(board).segments[0].toCell).toBe(11);
    board.tiles[10] = { kind: 'emitter', direction: 'W', color: 'cyan' };
    expect(traceBeams(board).segments).toEqual([{ from: { x: 0.5, y: 2.5 }, to: { x: 0, y: 2.5 }, fromCell: 10, toCell: null, color: 'cyan', direction: 'W' }]);
  });
  it('terminates an actual closed splitter/mirror cycle within the finite beam-state bound', () => {
    const board = puzzle([
      [0, 1, { kind: 'emitter', direction: 'E', color: 'cyan' }],
      [1, 1, { kind: 'splitter', rules: [
        { incoming: 'E', inputColor: 'cyan', outputs: [{ direction: 'E', color: 'cyan' }] },
        { incoming: 'N', inputColor: 'cyan', outputs: [{ direction: 'E', color: 'cyan' }] },
      ] }],
      [3, 1, mirror('\\', false)], [3, 3, mirror('/', false)], [1, 3, mirror('\\', false)],
      [4, 4, { kind: 'receiver', color: 'cyan', label: 'A' }], [4, 0, mirror('/')],
    ]);
    const trace = traceBeams(board);
    expect(trace.repeatedStates).toBeGreaterThan(0);
    expect(trace.visitedStates).toBeLessThanOrEqual(25 * 4 * 7);
    expect(trace.segments.length).toBeLessThan(100);
    expect(trace.solved).toBe(false);
  });
  it('does not allow a fixed mirror override through the rendering orientation map', () => {
    const board = oneTurn();
    board.tiles[24] = mirror('/', false);
    expect(() => traceBeams(board, { ...initialOrientations(board), 24: '\\' })).toThrow('Invalid mirror configuration');
  });
});

describe('Replay and rotation authority', () => {
  it('counts reverse rotations and never refunds them when the board is reset', () => {
    const board = oneTurn();
    const original = JSON.stringify(board);
    const actions: PrismAction[] = [{ type: 'rotate', cell: 24 }, { type: 'rotate', cell: 24 }, { type: 'reset' }, { type: 'rotate', cell: 12 }];
    const replay = replayActions(board, actions);
    expect(replay.rotations).toBe(3);
    expect(replay.solved).toBe(true);
    expect(replay.orientations[24]).toBe('/');
    expect(JSON.stringify(board)).toBe(original);
  });
  it('rejects any additional action after a solved board rather than rewriting a completed attempt', () => {
    expect(() => replayActions(oneTurn(), [{ type: 'rotate', cell: 12 }, { type: 'reset' }])).toThrow('already complete');
  });
  it.each<unknown>([
    { type: 'rotate', cell: 0 }, { type: 'rotate', cell: -1 }, { type: 'rotate', cell: 25 },
    { type: 'rotate', cell: 12.1 }, { type: 'rotate', cell: '12' }, { type: 'reset', rotations: 0 },
    { type: 'rotate', cell: 12, score: 500 }, { type: 'teleport', cell: 12 }, null,
  ])('rejects an illegal action payload %j', action => {
    expect(() => replayActions(oneTurn(), [action] as PrismAction[])).toThrow(PrismValidationError);
  });
  it('bounds checkpoint and replay work, including reset spam', () => {
    expect(replayActions(oneTurn(), Array.from({ length: PRISM_MAX_ACTIONS }, () => ({ type: 'reset' })))).toMatchObject({ rotations: 0, solved: false });
    expect(() => replayActions(oneTurn(), Array.from({ length: PRISM_MAX_ACTIONS + 1 }, () => ({ type: 'reset' })))).toThrow('action limit');
  });
});

describe('Exact bounded solver and publication validation', () => {
  it('finds the exact optimal one-turn solution and replays it successfully', () => {
    const solution = solvePuzzle(oneTurn());
    expect(solution.solvable).toBe(true);
    expect(solution.minimumRotations).toBe(1);
    expect(solution.actions).toEqual([{ type: 'rotate', cell: 12 }]);
    expect(replayActions(oneTurn(), solution.actions).solved).toBe(true);
  });
  it('finds an exact two-mirror minimum with both colored receivers simultaneously active', () => {
    const board = twoBranches();
    const solution = solvePuzzle(board);
    expect(solution).toMatchObject({ solvable: true, minimumRotations: 2, exhausted: false });
    expect(replayActions(board, solution.actions).trace.activatedReceivers).toEqual([5, 23]);
  });
  it('distinguishes an impossible puzzle from an unfinished bounded search', () => {
    const board = oneTurn();
    expect(solvePuzzle(board, { maxStates: 1 })).toMatchObject({ solvable: false, minimumRotations: null, exhausted: true });
    board.tiles[7] = { kind: 'wall' };
    expect(solvePuzzle(board)).toMatchObject({ solvable: false, minimumRotations: null, exhausted: false });
  });
  it('rejects false par, already solved boards and inaccessible receivers before publication', () => {
    const board = oneTurn();
    expect(validatePublishedPuzzle({ ...board, minimumRotations: 1 }).valid).toBe(true);
    const falsePar = validatePublishedPuzzle({ ...board, minimumRotations: 2 });
    expect(falsePar.valid).toBe(false);
    expect(falsePar.errors.join(' ')).toContain('verified minimum 1');
    board.tiles[12] = mirror('/');
    expect(validatePublishedPuzzle({ ...board, minimumRotations: 1 }).errors.join(' ')).toContain('begin solved');
    board.tiles[12] = mirror('\\'); board.tiles[7] = { kind: 'wall' };
    expect(validatePublishedPuzzle({ ...board, minimumRotations: 1 }).errors.join(' ')).toContain('No configuration');
  });
  it('rejects ambiguous splitter branches, duplicate receiver labels and nonfinite dimensions', () => {
    const board = twoBranches();
    const splitter = board.tiles[12];
    if (splitter.kind !== 'splitter') throw new Error('Fixture has no splitter');
    splitter.rules.push(splitter.rules[0]);
    expect(() => validatePuzzleShape(board)).toThrow('tile configuration');
    const duplicate = oneTurn(); duplicate.tiles[23] = { kind: 'receiver', color: 'gold', label: 'A' };
    expect(() => validatePuzzleShape(duplicate)).toThrow('tile configuration');
    expect(() => validatePuzzleShape({ ...oneTurn(), width: Infinity })).toThrow('Invalid Prism');
  });
});

describe('Transparent Prism scoring and outcome comparison', () => {
  it('awards 500 for optimal play, decreases efficiency only and gives skips zero', () => {
    expect(scoreRound(3, 3)).toBe(500);
    expect(scoreRound(3, 4)).toBe(450);
    expect(scoreRound(1, 3)).toBe(367);
    expect(scoreRound(1, 0, true)).toBe(0);
    expect(scoreRound(3, 512, true)).toBe(0);
    expect(() => scoreRound(3, 2)).toThrow('validated minimum');
    expect(() => scoreRound(1, 1.5)).toThrow('rotation count');
  });
  it('uses total score, solved count and then rotations without including elapsed time', () => {
    expect(compareMatch({ totalScore: 1000, solvedRounds: 2, totalRotations: 6 }, { totalScore: 999, solvedRounds: 3, totalRotations: 8 })).toBe('first');
    expect(compareMatch({ totalScore: 1000, solvedRounds: 2, totalRotations: 6 }, { totalScore: 1000, solvedRounds: 3, totalRotations: 8 })).toBe('second');
    expect(compareMatch({ totalScore: 1000, solvedRounds: 2, totalRotations: 6 }, { totalScore: 1000, solvedRounds: 2, totalRotations: 7 })).toBe('first');
  });
  it('records an exact or all-skipped tie as a legitimate draw', () => {
    const result = { totalScore: 1500, solvedRounds: 3, totalRotations: 12 };
    expect(compareMatch(result, { ...result })).toBe('draw');
    expect(compareMatch({ totalScore: 0, solvedRounds: 0, totalRotations: 0 }, { totalScore: 0, solvedRounds: 0, totalRotations: 0 })).toBe('draw');
    expect(() => compareMatch({ totalScore: NaN, solvedRounds: 0, totalRotations: 0 }, result)).toThrow('match totals');
  });
});
