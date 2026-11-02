import { RESOURCE_BY_ID } from '@/lib/deepClaim/catalog';
import type { DeepClaimMode, DeepClaimPoint, DeepClaimTile } from '@/lib/deepClaim/types';
const keyOf = (point: DeepClaimPoint) => `${point.x}:${point.y}`;

/** Display labels use public terrain only. Exact coordinates remain internal IDs. */
export function worksiteName(point: DeepClaimPoint, mode: DeepClaimMode, tiles: ReadonlyMap<string, DeepClaimTile>): string {
  const tile = tiles.get(keyOf(point));
  if (tile?.material && tile.remaining > 0) return RESOURCE_BY_ID[tile.material].name;
  if (tile?.remaining === 0) return 'Connected passage';
  return mode === 'explore' ? 'New frontier' : 'Unknown ground';
}

export function worksiteBranch(point: DeepClaimPoint): string {
  return point.x === 48 ? 'Main shaft' : `${point.x < 48 ? 'West' : 'East'} ${Math.abs(point.x - 48)}m`;
}

