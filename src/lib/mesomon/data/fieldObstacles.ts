import type { FieldObstacle, MapId } from '../types';
import { exteriorObstacles } from './exteriorObstacles';
import { interiorObstacles } from './interiorObstacles';
import { tideObstacles } from './tideObstacles';

const footprints: Partial<Record<MapId, readonly FieldObstacle[]>> = {
  ...exteriorObstacles, ...interiorObstacles, ...tideObstacles,
};
const empty: readonly FieldObstacle[] = [];

export function fieldObstaclesForMap(id: MapId): readonly FieldObstacle[] {
  return footprints[id] ?? empty;
}

export function fieldObstacleAt(id: MapId, x: number, y: number): FieldObstacle | undefined {
  return fieldObstaclesForMap(id).find(foot =>
    x >= foot.x && x < foot.x + foot.width && y >= foot.y && y < foot.y + foot.height);
}
