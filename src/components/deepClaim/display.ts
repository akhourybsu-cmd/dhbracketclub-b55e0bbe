import type { DeepClaimMode, DeepClaimPoint, DeepClaimSnapshot } from '@/lib/deepClaim/types';

/** The version-one introductory worksite is already revealed in every new claim. */
export function claimIntroAvailable(snapshot: DeepClaimSnapshot): boolean {
  if (!snapshot.company || snapshot.company.tutorial_used || !snapshot.world) return false;
  const first = snapshot.world.tiles.find(tile => tile.x === 47 && tile.y === 1);
  const second = snapshot.world.tiles.find(tile => tile.x === 49 && tile.y === 1);
  return !!first?.material && first.remaining >= 10 && !!second?.material && second.remaining >= 12
    && !snapshot.expeditions.some(job => job.status === 'active' && job.target.y === 1 && [47, 49].includes(job.target.x));
}

export function claimTargets(snapshot: Pick<DeepClaimSnapshot, 'world' | 'infrastructure'>, mode: DeepClaimMode): DeepClaimPoint[] {
  const world = snapshot.world;
  if (!world) return [];
  const revealed = new Map(world.tiles.map(tile => [`${tile.x}:${tile.y}`, tile]));
  // Revealing a deposit does not create a passage through it. Match the public
  // part of the server route: enter only depleted cells connected to the shaft.
  const queue: DeepClaimPoint[] = [{ x: 48, y: 0 }];
  const connected = new Set(['48:0']);
  const points = new Map<string, DeepClaimPoint>();
  for (let head = 0; head < queue.length; head++) {
    const point = queue[head];
    for (const [x, y] of [[point.x + 1, point.y], [point.x - 1, point.y], [point.x, point.y + 1], [point.x, point.y - 1]]) {
      if (x < 0 || x >= world.width || y < 0) continue;
      const key = `${x}:${y}`;
      const tile = revealed.get(key);
      if (tile?.remaining === 0 && !connected.has(key)) { connected.add(key); queue.push({ x, y }); }
      if (x === 48 || y < 1 || y > world.max_depth) continue;
      if (mode === 'explore' ? !tile : mode === 'extract' && !!tile?.material && tile.remaining > 0) points.set(key, { x, y });
    }
  }
  if (mode === 'survey' || mode === 'infrastructure') {
    return queue.filter(point => point.y >= 1 && point.y <= world.max_depth && revealed.has(`${point.x}:${point.y}`))
      .filter(point => mode !== 'infrastructure' || !snapshot.infrastructure?.some(item => item.x === point.x && item.y === point.y))
      .sort((a, b) => a.y - b.y || Math.abs(a.x - 48) - Math.abs(b.x - 48) || a.x - b.x);
  }
  return [...points.values()].sort((a, b) => a.y - b.y || Math.abs(a.x - 48) - Math.abs(b.x - 48) || a.x - b.x);
}


/** Display time only. Completion and rewards still come from the server snapshot. */
export function claimTimeLeft(timestamp: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(timestamp) - now) / 1000));
  if (!Number.isFinite(seconds)) return 'Sync needed';
  if (seconds === 0) return 'Check return';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
