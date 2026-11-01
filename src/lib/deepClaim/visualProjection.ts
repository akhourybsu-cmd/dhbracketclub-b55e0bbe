import type { DeepClaimExpedition, DeepClaimPoint, DeepClaimTile, DeepClaimWorld } from './types';

export interface PublicWorldIndex {
  chunks: Map<string, DeepClaimTile[]>;
  known: Map<string, DeepClaimTile>;
  totalTiles: number;
  roomNeighbors: WeakMap<DeepClaimTile, number>;
}
const worlds = new WeakMap<DeepClaimTile[], PublicWorldIndex>();
/** Index validated, immutable public arrays once. No hidden terrain is generated. */
export function indexRevealedWorld(world: DeepClaimWorld): PublicWorldIndex {
  const previous = worlds.get(world.tiles);
  if (previous?.totalTiles === world.tiles.length) return previous;
  const chunks = new Map<string, DeepClaimTile[]>(), known = new Map<string, DeepClaimTile>();
  for (const tile of world.tiles) {
    known.set(`${tile.x}:${tile.y}`, tile);
    const key = `${Math.floor(tile.x / 32)}:${Math.floor(tile.y / 32)}`;
    const group = chunks.get(key);
    if (group) group.push(tile); else chunks.set(key, [tile]);
  }
  const roomNeighbors = new WeakMap<DeepClaimTile, number>();
  for (const tile of world.tiles) if (tile.formation) {
    let mask = 0;
    if (known.get(`${tile.x}:${tile.y - 1}`)?.terrain === 'excavated') mask |= 1;
    if (known.get(`${tile.x + 1}:${tile.y}`)?.terrain === 'excavated') mask |= 2;
    if (known.get(`${tile.x}:${tile.y + 1}`)?.terrain === 'excavated') mask |= 4;
    if (known.get(`${tile.x - 1}:${tile.y}`)?.terrain === 'excavated') mask |= 8;
    roomNeighbors.set(tile, mask);
  }
  const index = { chunks, known, roomNeighbors, totalTiles: world.tiles.length };
  worlds.set(world.tiles, index); return index;
}
interface PathGeometry { ends: Float64Array; total: number }
const paths = new WeakMap<DeepClaimPoint[], PathGeometry>();
/** Reuses forward geometry for both directions; never reverses a saved path. */
export function pointAlongPublicPath(path: DeepClaimPoint[], progress: number): DeepClaimPoint {
  if (!path.length) return { x: 48, y: 0 };
  let geometry = paths.get(path);
  if (!geometry || geometry.ends.length !== Math.max(0, path.length - 1)) {
    const ends = new Float64Array(Math.max(0, path.length - 1)); let total = 0;
    for (let index = 1; index < path.length; index++) {
      total += Math.abs(path[index].x - path[index - 1].x) + Math.abs(path[index].y - path[index - 1].y); ends[index - 1] = total;
    }
    geometry = { ends, total }; paths.set(path, geometry);
  }
  if (!geometry.ends.length) return { ...path[0] };
  const distance = geometry.total * Math.max(0, Math.min(1, progress));
  let left = 0, right = geometry.ends.length - 1;
  while (left < right) { const middle = (left + right) >>> 1; if (geometry.ends[middle] >= distance) right = middle; else left = middle + 1; }
  const before = left ? geometry.ends[left - 1] : 0, length = geometry.ends[left] - before;
  const ratio = length > 0 ? (distance - before) / length : 0;
  return { x: path[left].x + (path[left + 1].x - path[left].x) * ratio, y: path[left].y + (path[left + 1].y - path[left].y) * ratio };
}
interface PublicStageProjection { job: DeepClaimExpedition; start: number; end: number }
const jobs = new WeakMap<DeepClaimExpedition[], Map<string, PublicStageProjection>>();
export function indexPublicWorkerStages(expeditions: DeepClaimExpedition[]): Map<string, PublicStageProjection> {
  const previous = jobs.get(expeditions); if (previous) return previous;
  const result = new Map<string, PublicStageProjection>();
  for (const job of expeditions) {
    if (job.status !== 'active') continue;
    const stage = job.stages.find(entry => entry.key === job.stage); if (!stage) continue;
    result.set(job.id, { job, start: Date.parse(stage.starts_at), end: Date.parse(stage.ends_at) });
  }
  jobs.set(expeditions, result); return result;
}
