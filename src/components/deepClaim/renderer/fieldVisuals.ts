import { chunkAddress, tileKey } from '@/lib/deepClaim/world';
import type { DeepClaimDiscovery, DeepClaimInfrastructure, DeepClaimPoint, DeepClaimSnapshot, DeepClaimTile } from '@/lib/deepClaim/types';

export interface FieldOverlayIndex {
  infrastructure: Map<string, DeepClaimInfrastructure[]>;
  discoveries: Map<string, DeepClaimDiscovery[]>;
  infrastructureById: Map<string, DeepClaimInfrastructure>;
}
export interface CellRange { minX: number; maxX: number; minY: number; maxY: number }
function add<T extends DeepClaimPoint>(map: Map<string, T[]>, entry: T) {
  const key = chunkAddress(entry).key, group = map.get(key) ?? []; group.push(entry); map.set(key, group);
}
/** Only server-published records on known committed ground become map markers. */
export function indexPublicField(snapshot: Pick<DeepClaimSnapshot, 'world' | 'infrastructure' | 'discoveries' | 'server_now'>): FieldOverlayIndex {
  const infrastructure = new Map<string, DeepClaimInfrastructure[]>(), discoveries = new Map<string, DeepClaimDiscovery[]>();
  const infrastructureById = new Map<string, DeepClaimInfrastructure>();
  const known = new Map((snapshot.world?.tiles ?? []).map(tile => [tileKey(tile), tile]));
  for (const entry of snapshot.infrastructure ?? []) {
    const tile = known.get(tileKey(entry));
    if (!tile || tile.remaining !== 0) continue;
    add(infrastructure, entry); infrastructureById.set(entry.id, entry);
  }
  const server = Date.parse(snapshot.server_now);
  for (const entry of snapshot.discoveries ?? []) {
    const tile = known.get(tileKey(entry));
    if (!tile || tile.remaining !== 0 || !Number.isFinite(Date.parse(entry.discovered_at)) || Date.parse(entry.discovered_at) > server) continue;
    add(discoveries, entry);
  }
  return { infrastructure, discoveries, infrastructureById };
}
export function visibleFieldEntries<T extends DeepClaimPoint>(index: Map<string, T[]>, range: CellRange, padding = 0): T[] {
  const result: T[] = [];
  const minX = range.minX - padding, maxX = range.maxX + padding, minY = range.minY - padding, maxY = range.maxY + padding;
  for (let cx = Math.floor(minX / 32); cx <= Math.floor(maxX / 32); cx++) for (let cy = Math.floor(minY / 32); cy <= Math.floor(maxY / 32); cy++) {
    for (const entry of index.get(`${cx}:${cy}`) ?? []) if (entry.x >= minX && entry.x <= maxX && entry.y >= minY && entry.y <= maxY) result.push(entry);
  }
  return result;
}
export function infrastructureInstalled(entry: DeepClaimInfrastructure, serverNow: string) {
  return entry.status === 'installed' && entry.installed_at != null && Date.parse(entry.installed_at) <= Date.parse(serverNow);
}
/** Open geometry is joined only when the adjacent public cell really is open. */
export function knownRoomNeighbors(tile: DeepClaimTile, known: Map<string, DeepClaimTile>) {
  const offsets = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]];
  return offsets.reduce((mask, [dx, dy, bit]) => known.get(`${tile.x + dx}:${tile.y + dy}`)?.terrain === 'excavated' ? mask | bit : mask, 0);
}
export function fieldMarkerAt(point: DeepClaimPoint, markers: readonly { point: DeepClaimPoint; screen: DeepClaimPoint }[]) {
  const hits = markers.map(marker => ({ ...marker, distance: Math.hypot(point.x - marker.screen.x, point.y - marker.screen.y) }))
    .filter(marker => marker.distance <= 22).sort((a, b) => a.distance - b.distance);
  return hits[0]?.point ?? null;
}
