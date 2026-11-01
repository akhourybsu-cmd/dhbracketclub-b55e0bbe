/** Offline authoring/validation only. Do not import this module into the client game registry. */
import { initialOrientations, rotatableCells, traceValidatedPuzzle, validatePuzzleShape } from './engine';
import { PRISM_MAX_ROTATABLE_MIRRORS, type PrismAction, type PrismPuzzle } from './types';

export interface PrismSolverResult {
  solvable: boolean;
  minimumRotations: number | null;
  actions: PrismAction[];
  visitedStates: number;
  exhausted: boolean;
}
export interface PublishedPrismPuzzle extends PrismPuzzle { minimumRotations: number }
export interface PrismPublicationValidation { valid: boolean; errors: string[]; solution: PrismSolverResult | null }

/** Every movable piece is binary; BFS finds an exact shortest rotation path. */
export function solvePuzzle(puzzle: PrismPuzzle, options: { maxStates?: number } = {}): PrismSolverResult {
  validatePuzzleShape(puzzle);
  const cells = rotatableCells(puzzle);
  const stateCount = 2 ** cells.length;
  const maxStates = Math.min(stateCount, options.maxStates ?? 2 ** PRISM_MAX_ROTATABLE_MIRRORS);
  if (!Number.isInteger(maxStates) || maxStates < 1) throw new Error('The solver needs a positive bounded state budget.');
  const initial = initialOrientations(puzzle);
  const queue: number[] = [0];
  const seen = new Set<number>([0]);
  const parents = new Map<number, { state: number; mirror: number }>();
  let visitedStates = 0;
  for (let cursor = 0; cursor < queue.length && visitedStates < maxStates; cursor++) {
    const state = queue[cursor];
    const orientations = { ...initial };
    cells.forEach((cell, bit) => { if (state & (1 << bit)) orientations[cell] = initial[cell] === '/' ? '\\' : '/'; });
    visitedStates++;
    if (traceValidatedPuzzle(puzzle, orientations).solved) {
      const actions: PrismAction[] = [];
      let current = state;
      while (parents.has(current)) {
        const previous = parents.get(current)!;
        actions.push({ type: 'rotate', cell: cells[previous.mirror] });
        current = previous.state;
      }
      actions.reverse();
      return { solvable: true, minimumRotations: actions.length, actions, visitedStates, exhausted: false };
    }
    for (let mirror = 0; mirror < cells.length; mirror++) {
      const next = state ^ (1 << mirror);
      if (!seen.has(next)) { seen.add(next); parents.set(next, { state, mirror }); queue.push(next); }
    }
  }
  return { solvable: false, minimumRotations: null, actions: [], visitedStates, exhausted: visitedStates < stateCount };
}

/** A definition becomes published content only after this exact-par certificate passes. */
export function validatePublishedPuzzle(definition: PublishedPrismPuzzle): PrismPublicationValidation {
  const errors: string[] = [];
  try { validatePuzzleShape(definition); }
  catch (error) { return { valid: false, errors: [error instanceof Error ? error.message : 'Invalid puzzle shape.'], solution: null }; }
  if (definition.width < 5 || definition.width > 7 || definition.height < 5 || definition.height > 7) errors.push('Published boards must fit a 5–7 cell mobile grid.');
  const movable = rotatableCells(definition).length;
  if (movable > 12) errors.push('Published boards must have at most 12 rotatable mirrors.');
  if (!Number.isInteger(definition.minimumRotations) || definition.minimumRotations < 1 || definition.minimumRotations > movable) errors.push('A published minimum must be a positive reachable rotation count.');
  const initial = traceValidatedPuzzle(definition, initialOrientations(definition));
  if (initial.solved) errors.push('A published puzzle cannot begin solved.');
  // Refuse oversized mobile boards before spending the authoring search budget.
  if (errors.length) return { valid: false, errors, solution: null };
  const solution = solvePuzzle(definition, { maxStates: 4096 });
  if (solution.exhausted) errors.push('The validation search exhausted its mobile complexity budget.');
  if (!solution.solvable) errors.push('No configuration activates every required receiver.');
  else if (solution.minimumRotations !== definition.minimumRotations) errors.push(`Reported minimum ${definition.minimumRotations} differs from verified minimum ${solution.minimumRotations}.`);
  return { valid: errors.length === 0, errors, solution };
}
