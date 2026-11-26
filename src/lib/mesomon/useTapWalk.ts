import { useCallback, useEffect, useRef, useState } from 'react';
import { canWalk, DELTAS, getPhase, getVisibleObjects, nearbyInteractions } from './engine';
import { createWalkClock } from './input';
import { findWalkingPath } from './wayfinding';
import type { Direction, GameAction, GameSession, MapId } from './types';

interface Point { x: number; y: number }
interface Walk { map: MapId; points: Point[]; destination: Point; face?: Direction }
const directions = Object.keys(DELTAS) as Direction[];
const directionTo = (a: Point, b: Point) => directions.find(dir =>
  a.x + DELTAS[dir].x === b.x && a.y + DELTAS[dir].y === b.y);

/** A tap requests an ordinary walk. Only the current tile is committed to a save. */
export function useTapWalk(session: GameSession | null, active: boolean, act: (action: GameAction) => void, notice: (text: string) => void) {
  const [clock] = useState(createWalkClock);
  const [walk, setWalk] = useState<Walk | null>(null);
  const pending = useRef<Walk | null>(null);
  const latest = useRef({ session, active });
  latest.current = { session, active };
  const cancel = useCallback(() => {
    clock.cancel();
    pending.current = null;
    setWalk(null);
  }, [clock]);
  const map = session?.save.player.mapId;
  useEffect(() => {
    cancel();
    return clock.cancel;
  }, [active, map, cancel, clock]);
  const manualStep = useCallback((direction: Direction) => {
    cancel();
    const source = latest.current;
    if (!source.active || !source.session) return;
    const map = source.session.save.player.mapId;
    clock.request(() => {
      const now = latest.current;
      if (now.active && now.session?.save.player.mapId === map && !document.hidden) {
        act({ type: 'move', direction });
      }
    });
  }, [act, cancel, clock]);
  const tap = useCallback((tile: Point, id?: string) => {
    const { session, active } = latest.current;
    if (!active || !session || getPhase(session) !== 'explore') return;
    cancel();
    const save = session.save;
    const object = id ? getVisibleObjects(save).find(o => o.id === id) : undefined;
    if (id && !object) return;
    if (object && nearbyInteractions(save).some(o => o.id === object.id)) {
      act({ type: 'interact', id: object.id });
      return;
    }
    const path = findWalkingPath(save, [object ?? tile], object ? 1 : 0);
    if (!path) { notice('No path to that spot.'); return; }
    if (path.points.length < 2) return;
    const destination = path.points[path.points.length - 1];
    const next: Walk = { map: save.player.mapId, points: path.points, destination, face: object ? directionTo(destination, object) : undefined };
    pending.current = next;
    setWalk(next);
  }, [act, cancel, notice]);
  const x = session?.save.player.x, y = session?.save.player.y;
  useEffect(() => {
    if (!walk || pending.current !== walk) return;
    const { session } = latest.current;
    if (!active || !session || walk.map !== map) { cancel(); return; }
    const index = walk.points.findIndex(p => p.x === x && p.y === y);
    const next = index < 0 ? undefined : walk.points[index + 1];
    if (!next) {
      cancel();
      if (index >= 0 && walk.face && session.save.player.facing !== walk.face) act({ type: 'face', direction: walk.face });
      return;
    }
    return clock.request(() => {
      const now = latest.current;
      if (pending.current !== walk || !now.active || !now.session || document.hidden) return;
      const save = now.session.save;
      const direction = directionTo(save.player, next);
      if (!direction || save.player.mapId !== walk.map || !canWalk(save, next.x, next.y)) { cancel(); return; }
      act({ type: 'move', direction });
    });
  }, [walk, x, y, map, active, act, cancel, clock]);
  return { tap, cancel, manualStep, destination: walk?.destination };
}
