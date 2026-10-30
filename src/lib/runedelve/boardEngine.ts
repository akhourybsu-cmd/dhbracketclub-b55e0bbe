import { BOARD_SIZE, RUNE_TYPES, type RuneType } from "./dungeonGenerator";
import { rngInt, type Rng } from "./prng";

export type Cell = { r: number; c: number };

export function isAdjacent(a: Cell, b: Cell): boolean {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  // 8-direction: orthogonal + diagonal neighbours.
  return dr <= 1 && dc <= 1 && dr + dc > 0;
}

export function cellKey(c: Cell): string {
  return `${c.r}-${c.c}`;
}

/** A bounded three-cell search; finding a playable move never needs an exponential longest-path search. */
function availablePath(
  grid: RuneType[][],
  seals?: Set<string>,
  eclipse?: Set<string>,
  sameColor = true,
): Cell[] | null {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const first = { r, c };
      if (seals?.has(cellKey(first)) || eclipse?.has(cellKey(first))) continue;
      const search = (path: Cell[]): Cell[] | null => {
        if (path.length === 3) return path;
        const tail = path[path.length - 1];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const target = { r: tail.r + dr, c: tail.c + dc };
            const type = grid[target.r]?.[target.c];
            if (!type || seals?.has(cellKey(target))) continue;
            if (sameColor && type !== grid[r][c]) continue;
            if (path.some((cell) => cell.r === target.r && cell.c === target.c))
              continue;
            const found = search([...path, target]);
            if (found) return found;
          }
        }
        return null;
      };
      const found = search([first]);
      if (found) return found;
    }
  }
  return null;
}

/** Find a legal move using the same seals, eclipse-start, and diagonal rules as player input. */
export function findAvailableChain(
  grid: RuneType[][],
  seals?: Set<string>,
  eclipse?: Set<string>,
): Cell[] | null {
  return availablePath(grid, seals, eclipse);
}

/**
 * A dead board is a board problem, never a lost player turn. Reroll only
 * unlocked runes; if random attempts fail, plant one legal three-rune path.
 * Unplayable seal topology is returned explicitly rather than looping forever.
 */
export function ensurePlayableBoard(
  grid: RuneType[][],
  rng: Rng,
  seals?: Set<string>,
  eclipse?: Set<string>,
): { grid: RuneType[][]; reshuffled: boolean; chain: Cell[] | null } {
  const existing = findAvailableChain(grid, seals, eclipse);
  if (existing) return { grid, reshuffled: false, chain: existing };
  const openPath = availablePath(grid, seals, eclipse, false);
  if (!openPath) return { grid, reshuffled: false, chain: null };
  const next = grid.map((row) => row.slice());
  for (let attempt = 0; attempt < 8; attempt++) {
    for (let r = 0; r < next.length; r++) {
      for (let c = 0; c < next[r].length; c++) {
        if (!seals?.has(`${r}-${c}`))
          next[r][c] = RUNE_TYPES[rngInt(rng, RUNE_TYPES.length)];
      }
    }
    const chain = findAvailableChain(next, seals, eclipse);
    if (chain) return { grid: next, reshuffled: true, chain };
  }
  const color = RUNE_TYPES[rngInt(rng, RUNE_TYPES.length)];
  for (const cell of openPath) next[cell.r][cell.c] = color;
  return { grid: next, reshuffled: true, chain: openPath };
}

// Validate a proposed chain: all cells share the same rune type and form a contiguous path of adjacents.
// When `seals` is provided, sealed cells can never be part of a chain.
// When `eclipse` is provided, the FIRST cell of a chain cannot be eclipsed
// (Eclipse Tiles mechanic — band L56-L65). Eclipsed cells may extend a chain.
export function isValidChain(
  grid: RuneType[][],
  chain: Cell[],
  seals?: Set<string>,
  eclipse?: Set<string>,
): boolean {
  if (chain.length < 3) return false;
  const type = grid[chain[0].r]?.[chain[0].c];
  if (!type) return false;
  if (eclipse?.has(cellKey(chain[0]))) return false;
  for (let i = 0; i < chain.length; i++) {
    const cur = chain[i];
    if (seals?.has(cellKey(cur))) return false;
    if (grid[cur.r]?.[cur.c] !== type) return false;
    if (i > 0 && !isAdjacent(chain[i - 1], cur)) return false;
  }
  // No duplicate cells
  const seen = new Set<string>();
  for (const c of chain) {
    const k = cellKey(c);
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

// Apply gravity (remove matched cells, drop above cells), then refill empty cells using rng.
// Sealed cells act like immovable stone: they stay in place, runes above them
// do NOT fall through them, and refills happen above them column-locally.
export function resolveBoard(
  grid: RuneType[][],
  chain: Cell[],
  rng: Rng,
  seals?: Set<string>,
): RuneType[][] {
  const removed = new Set(chain.map(cellKey));
  const next: (RuneType | null)[][] = grid.map((row) => row.slice());
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (removed.has(`${r}-${c}`)) next[r][c] = null;
    }
  }
  // Apply gravity column by column.
  // If seals exist, a sealed cell partitions its column into independent
  // gravity segments — runes above a seal can't pass through it.
  for (let c = 0; c < BOARD_SIZE; c++) {
    let segmentBottom = BOARD_SIZE - 1;
    for (let r = BOARD_SIZE - 1; r >= -1; r--) {
      const isSealed = r >= 0 && (seals?.has(`${r}-${c}`) ?? false);
      const isBoundary = r < 0 || isSealed;
      if (!isBoundary) continue;
      const stack: RuneType[] = [];
      for (let rr = segmentBottom; rr > r; rr--) {
        const v = next[rr][c];
        if (v) stack.push(v);
      }
      for (let rr = segmentBottom; rr > r; rr--) {
        const v = stack.shift();
        next[rr][c] = v ?? RUNE_TYPES[rngInt(rng, RUNE_TYPES.length)];
      }
      segmentBottom = r - 1;
    }
  }
  return next as RuneType[][];
}
