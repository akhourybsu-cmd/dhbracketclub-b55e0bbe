import { MAPS } from './data/maps';
import { canWalk, DELTAS, getVisibleObjects } from './engine';
import type { Direction, MapId, MapObject, MesomonSaveV1 } from './types';

interface Point { x: number; y: number }
interface Destination { map: MapId; targets: string[] }
interface Crossing { from: MapId; to: MapId; door: string; requires?: string[] }

const crossings: Crossing[] = [
  { from: 'ship', to: 'harbor', door: 'gangplank', requires: ['captain_met'] },
  { from: 'harbor', to: 'workshop', door: 'workshop-door', requires: ['nia_met'] },
  { from: 'workshop', to: 'harbor', door: 'workshop-exit' },
  { from: 'harbor', to: 'tide-stairs', door: 'tide-door', requires: ['bram_met'] },
  { from: 'tide-stairs', to: 'harbor', door: 'stairs-exit' },
  { from: 'tide-stairs', to: 'passage', door: 'passage-door', requires: ['rillik_bonded'] },
  { from: 'passage', to: 'tide-stairs', door: 'passage-exit' },
  { from: 'passage', to: 'chamber', door: 'chamber-door', requires: ['tutorial_complete', 'currents_followed'] },
  { from: 'chamber', to: 'passage', door: 'chamber-exit' },
];

function chapterDestination(save: MesomonSaveV1): Destination | undefined {
  const has = (key: string) => save.questFlags[key] === true;
  const at = (map: MapId, ...targets: string[]) => ({ map, targets });
  if (!has('captain_met')) return at('ship', 'captain');
  if (!has('disembarked')) return at('ship', 'gangplank');
  if (!has('nia_met')) return at('harbor', 'nia');
  if (!has('workshop_entered')) return at('harbor', 'workshop-door');
  if (!has('clues_complete')) {
    const clues = [['clue_chart', 'chart'], ['clue_hook', 'satchel-hook'], ['clue_map', 'field-map']];
    return at('workshop', ...clues.filter(([flag]) => !has(flag)).map(([, id]) => id));
  }
  if (!has('bram_met')) return at('harbor', 'bram');
  if (!has('gate_opened')) return at('tide-stairs', has('brace_found') ? 'gate-wheel' : 'gate-brace');
  if (!has('rillik_bonded')) return at('tide-stairs', 'rillik-bond');
  if (!has('current_eddy')) return at('passage', 'sense-eddy');
  if (!has('sluice_open')) return at('passage', 'sluice');
  if (!has('tutorial_complete')) return at('passage', 'tressel');
  if (!has('currents_followed')) return at('passage', 'sense-channel');
  if (!has('rift_sealed')) return at('chamber', 'rift');
  if (!has('page_found')) return at('chamber', 'page');
  if (!has('chapter_complete')) return at('workshop', 'closing');
}

function nextDoor(save: MesomonSaveV1, destination: MapId): string | undefined {
  const start = save.player.mapId;
  const queue: { map: MapId; first?: string }[] = [{ map: start }];
  const seen = new Set<MapId>([start]);
  for (const { map, first } of queue) {
    for (const crossing of crossings) {
      if (crossing.from !== map || seen.has(crossing.to) || crossing.requires?.some(flag => save.questFlags[flag] !== true)) continue;
      const door = first ?? crossing.door;
      if (crossing.to === destination) return door;
      seen.add(crossing.to);
      queue.push({ map: crossing.to, first: door });
    }
  }
}

export interface ChartRoute {
  target: MapObject;
  label: string;
  points: Point[];
  legs: { direction: Direction; steps: number }[];
  facing?: Direction;
}

const directions = Object.keys(DELTAS) as Direction[];
function towards(from: Point, to: Point) {
  return directions.find(direction => from.x + DELTAS[direction].x === to.x && from.y + DELTAS[direction].y === to.y);
}

export function findWalkingPath<T extends Point>(save: MesomonSaveV1, targets: T[], reach: 0 | 1): { points: Point[]; target: T } | undefined {
  if (!targets.length) return;
  const map = MAPS[save.player.mapId];
  const index = ({ x, y }: Point) => y * map.width + x;
  const start = { x: save.player.x, y: save.player.y };
  const previous = new Map<number, Point | null>([[index(start), null]]);
  const queue = [start];
  for (const tile of queue) {
    const target = targets.find(({ x, y }) => Math.abs(tile.x - x) + Math.abs(tile.y - y) <= reach);
    if (target) {
      const points: Point[] = [];
      for (let back: Point | null = tile; back; back = previous.get(index(back)) ?? null) points.push(back);
      points.reverse();
      return { points, target };
    }
    for (const direction of directions) {
      const next = { x: tile.x + DELTAS[direction].x, y: tile.y + DELTAS[direction].y };
      if (!previous.has(index(next)) && canWalk(save, next.x, next.y)) {
        previous.set(index(next), tile);
        queue.push(next);
      }
    }
  }
}

export function getChartRoute(save: MesomonSaveV1): ChartRoute | undefined {
  const destination = chapterDestination(save);
  if (!destination) return;
  const ids = destination.map === save.player.mapId ? destination.targets : [nextDoor(save, destination.map)];
  const targets = getVisibleObjects(save).filter(object => ids.includes(object.id));
  if (!targets.length) return;

  const path = findWalkingPath(save, targets, 1);
  if (!path) return;
  const { points, target } = path;
  const tile = points[points.length - 1];
  const legs: ChartRoute['legs'] = [];
  for (let i = 1; i < points.length; i++) {
    const direction = towards(points[i - 1], points[i])!;
    const last = legs[legs.length - 1];
    if (last?.direction === direction) last.steps++;
    else legs.push({ direction, steps: 1 });
  }
  // The opening in the chamber has no name until Tavian sees it.
  const label = target.id === 'rift' && !save.questFlags.boss_introduced ? 'Chamber basin' : target.label;
  return { target, label, points, legs, facing: towards(tile, target) };
}
