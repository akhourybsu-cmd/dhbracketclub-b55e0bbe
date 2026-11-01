import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { initialOrientations, replayActions, rotatableCells, scoreRound, traceValidatedPuzzle } from '@/lib/showdown/prism/engine';
import { solvePuzzle, validatePublishedPuzzle } from '@/lib/showdown/prism/solver';
import type { PrismPuzzle } from '@/lib/showdown/prism/types';

interface CatalogEntry extends PrismPuzzle {
  title: string;
  minimumRotations: number;
  validation: { validated: boolean; solverStates: number; stateBudget: number; rotatableMirrors: number; receivers: number; definitionSha256: string };
}
const library = JSON.parse(readFileSync(resolve('supabase/seed/prism-break-library.json'), 'utf8')) as CatalogEntry[];
const seed = readFileSync(resolve('supabase/migrations/20261101020000_prism_break_library.sql'), 'utf8');
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as Record<string, unknown>)[key])])) : value;
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const publicPuzzle = ({ title: _title, minimumRotations: _minimum, validation: _validation, ...puzzle }: CatalogEntry) => puzzle;

/** Geometry remains distinct even when colors, starting rotations and board symmetries are ignored. */
function geometrySignature(puzzle: PrismPuzzle) {
  const variants = [];
  for (let reflected = 0; reflected < 2; reflected++) for (let rotation = 0; rotation < 4; rotation++) {
    const cells = puzzle.tiles.flatMap((tile, cell) => {
      if (tile.kind === 'empty' || tile.kind === 'wall') return [];
      let x = cell % puzzle.width, y = Math.floor(cell / puzzle.width);
      if (reflected) x = puzzle.width - 1 - x;
      for (let turn = 0; turn < rotation; turn++) [x, y] = [puzzle.width - 1 - y, x];
      return [`${tile.kind}${tile.kind === 'mirror' && !tile.rotatable ? '-fixed' : ''}@${x},${y}`];
    }).sort();
    variants.push(`${puzzle.width}:${cells.join(';')}`);
  }
  return variants.sort()[0];
}

describe('Published Prism Break launch library', () => {
  it('has six authored, versioned and genuinely different boards at each difficulty', () => {
    expect(library).toHaveLength(18);
    expect(new Set(library.map(board => `${board.id}:${board.version}`)).size).toBe(18);
    expect(new Set(library.map(board => board.title)).size).toBe(18);
    expect(new Set(library.map(geometrySignature)).size).toBe(18);
    for (const difficulty of ['easy', 'medium', 'hard']) expect(library.filter(board => board.difficulty === difficulty)).toHaveLength(6);
    expect(fingerprint(library)).toBe('da1e5d08205632c72403a463dbd493b1ebd06fc957754e1c1d0b3b05b1193a0a');
  });

  it.each(library)('$id independently confirms the exact par and all receiver requirements', board => {
    const validation = validatePublishedPuzzle(board);
    expect(validation.errors).toEqual([]);
    expect(validation.valid).toBe(true);
    expect(traceValidatedPuzzle(board, initialOrientations(board)).solved).toBe(false);
    const cells = rotatableCells(board);
    expect(cells.length).toBeLessThanOrEqual(12);
    const initial = initialOrientations(board);
    // Exhaustive enumeration is independent of the BFS queue/parent algorithm.
    let exactMinimum = Infinity, solutions = 0;
    for (let state = 0; state < 2 ** cells.length; state++) {
      const orientations = { ...initial };
      let moves = 0;
      cells.forEach((cell, bit) => {
        if (state & (1 << bit)) { moves++; orientations[cell] = initial[cell] === '/' ? '\\' : '/'; }
      });
      const trace = traceValidatedPuzzle(board, orientations);
      if (trace.solved) { solutions++; exactMinimum = Math.min(exactMinimum, moves); }
    }
    expect(solutions).toBeGreaterThan(0);
    expect(exactMinimum).toBe(board.minimumRotations);
    const solution = solvePuzzle(board, { maxStates: 4096 });
    expect(solution.exhausted).toBe(false);
    expect(solution.minimumRotations).toBe(exactMinimum);
    const replay = replayActions(board, solution.actions);
    expect(replay.solved).toBe(true);
    expect(replay.trace.activatedReceivers).toEqual(replay.trace.requiredReceivers);
    expect(scoreRound(board.minimumRotations, replay.rotations)).toBe(500);
    expect(scoreRound(board.minimumRotations, 0, true)).toBe(0);
    expect(board.validation.validated).toBe(true);
    expect(board.validation.solverStates).toBeLessThanOrEqual(4096);
    expect(board.validation.definitionSha256).toBe(fingerprint(publicPuzzle(board)));
  });

  it('introduces filters, simultaneous emitters, multiple receivers and cascaded prisms rather than relabeling boards', () => {
    const medium = library.filter(board => board.difficulty === 'medium');
    const hard = library.filter(board => board.difficulty === 'hard');
    expect(medium.every(board => board.tiles.some(tile => tile.kind === 'filter'))).toBe(true);
    expect(medium.some(board => board.tiles.filter(tile => tile.kind === 'emitter').length === 2)).toBe(true);
    expect(hard.every(board => board.tiles.filter(tile => tile.kind === 'receiver').length >= 2)).toBe(true);
    expect(hard.every(board => board.tiles.some(tile => tile.kind === 'splitter'))).toBe(true);
    expect(hard.some(board => board.tiles.filter(tile => tile.kind === 'splitter').length === 2)).toBe(true);
    expect(library.filter(board => board.difficulty === 'easy').every(board => board.minimumRotations >= 2 && board.minimumRotations <= 3)).toBe(true);
    expect(medium.every(board => board.minimumRotations >= 4 && board.minimumRotations <= 5)).toBe(true);
    expect(hard.every(board => board.minimumRotations >= 6 && board.minimumRotations <= 7)).toBe(true);
  });

  it('refuses a plausible but inaccurate minimum, and publishes only definitions with validation certificates', () => {
    const board = library[0];
    expect(validatePublishedPuzzle({ ...board, minimumRotations: board.minimumRotations + 1 }).valid).toBe(false);
    expect(seed).toContain('published');
    expect(seed).toContain('Published Prism puzzle version is immutable');
    const match = seed.match(/\$prism_definitions\$([\s\S]*?)\$prism_definitions\$::jsonb/);
    expect(match).not.toBeNull();
    const records = JSON.parse(match![1]) as { definition: PrismPuzzle; minimumRotations: number; validation: CatalogEntry['validation'] }[];
    expect(records).toHaveLength(18);
    for (const record of records) {
      const board = library.find(board => board.id === record.definition.id)!;
      expect(record.definition).toEqual(publicPuzzle(board));
      expect(record.minimumRotations).toBe(board.minimumRotations);
      expect(record.validation).toEqual(board.validation);
      expect(record.definition).not.toHaveProperty('minimumRotations');
      expect(record.definition).not.toHaveProperty('solution');
      expect(record.definition).not.toHaveProperty('actions');
      expect(record.definition).not.toHaveProperty('validation');
    }
  });

  it('keeps the offline solver and private catalog outside every production application import', () => {
    const violations: string[] = [];
    function visit(directory: string) {
      for (const item of readdirSync(directory, { withFileTypes: true })) {
        const path = resolve(directory, item.name);
        if (item.isDirectory()) { if (item.name !== 'test') visit(path); continue; }
        if (!/\.[jt]sx?$/.test(path) || path.endsWith('/showdown/prism/solver.ts')) continue;
        const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
        function check(node: ts.Node) {
          const module = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null;
          if (module && ts.isStringLiteral(module) && /prism(?:-break-library|\/solver)|author-prism-break/.test(module.text)) violations.push(`${path}: ${module.text}`);
          ts.forEachChild(node, check);
        }
        check(file);
      }
    }
    visit(resolve('src'));
    expect(violations).toEqual([]);
  });
});
