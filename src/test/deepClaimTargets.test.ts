import { describe, expect, it } from 'vitest';
import { claimTargets } from '@/components/deepClaim/display';
import type { DeepClaimSnapshot, DeepClaimTile } from '@/lib/deepClaim/types';

function tile(x: number, y: number, remaining: number, material: DeepClaimTile['material'] = 'stone'): DeepClaimTile {
  return { x, y, remaining, initial_amount: Math.max(remaining, 10), material, terrain: remaining === 0 ? 'excavated' : 'stone' };
}
function claim(tiles: DeepClaimTile[], maxDepth = 49): DeepClaimSnapshot {
  return { schema_version: 1, revision: 0, server_now: '2026-11-02T12:00:00Z', company: null, workers: [], resources: {}, buildings: [], expeditions: [], log: [], world: { width: 96, chunk_size: 32, revision: 0, max_depth: maxDepth, tiles } };
}
const fresh = () => claim([
  ...[1, 2, 3, 4, 5, 6].map(y => tile(48, y, 0, null)),
  tile(47, 1, 10, 'coal'), tile(49, 1, 12, 'stone'), tile(46, 1, 16, 'clay'), tile(50, 1, 18, 'copper_ore'),
  tile(47, 2, 12, 'tin_ore'), tile(49, 2, 15, 'iron_ore'), tile(47, 3, 8, 'quartz'), tile(49, 3, 3, 'silver_ore'),
]);

describe('Deep Claim reachable public worksite choices', () => {
  it('selects a frontier beside the actual fresh shaft and excludes frontiers behind revealed deposit walls', () => {
    const targets = claimTargets(fresh(), 'explore');
    expect(targets[0]).toEqual({ x: 47, y: 4 });
    expect(targets).not.toContainEqual({ x: 45, y: 1 });
    expect(targets).not.toContainEqual({ x: 46, y: 2 });
    expect(targets.every(point => point.x !== 48 && point.y >= 1 && point.y <= 49)).toBe(true);
  });
  it('offers only deposits adjacent to connected walkable ground, then opens deeper targets after depletion', () => {
    const snapshot = fresh();
    expect(claimTargets(snapshot, 'extract')).toEqual([1, 2, 3].flatMap(y => [{ x: 47, y }, { x: 49, y }]));
    snapshot.world!.tiles = snapshot.world!.tiles.map(value => value.x === 47 && value.y === 1 ? { ...value, remaining: 0, terrain: 'excavated' } : value);
    expect(claimTargets(snapshot, 'extract')).toContainEqual({ x: 46, y: 1 });
    expect(claimTargets(snapshot, 'explore')).not.toContainEqual({ x: 46, y: 2 });
    expect(claimTargets(snapshot, 'explore')).not.toContainEqual({ x: 45, y: 1 });
    snapshot.world!.tiles = snapshot.world!.tiles.map(value => value.x === 46 && value.y === 1 ? { ...value, remaining: 0, terrain: 'excavated' } : value);
    expect(claimTargets(snapshot, 'explore')).toContainEqual({ x: 46, y: 2 });
    expect(claimTargets(snapshot, 'explore')).toContainEqual({ x: 45, y: 1 });
  });
  it('does not use an isolated excavated pocket as a route and respects boundaries and supported depth', () => {
    const snapshot = claim([tile(48, 1, 0, null), tile(48, 2, 0, null), tile(47, 1, 20), tile(20, 10, 0), tile(21, 10, 20, 'silver_ore')], 2);
    expect(claimTargets(snapshot, 'extract')).toEqual([{ x: 47, y: 1 }]);
    expect(claimTargets(snapshot, 'explore').every(point => point.y <= 2 && point.x >= 0 && point.x < 96 && point.x !== 48)).toBe(true);
    expect(claimTargets(snapshot, 'explore')).not.toContainEqual({ x: 19, y: 10 });
  });
  it('terminates connected-cell cycles and deduplicates shared frontier edges deterministically', () => {
    const snapshot = claim([tile(48, 1, 0), tile(47, 1, 0), tile(48, 2, 0), tile(47, 2, 0)]);
    const targets = claimTargets(snapshot, 'explore');
    expect(targets.length).toBeGreaterThan(0);
    expect(new Set(targets.map(point => `${point.x}:${point.y}`)).size).toBe(targets.length);
    expect(claimTargets({ ...snapshot, world: { ...snapshot.world!, tiles: [...snapshot.world!.tiles].reverse() } }, 'explore')).toEqual(targets);
  });
});
