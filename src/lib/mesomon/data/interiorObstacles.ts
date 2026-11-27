import type { FieldObstacle, MapId } from '../types';

export const workshopFurniture = {
  cuttingBench: { id: 'sail-cutting-bench', x: 6, y: 9, width: 4, height: 2 },
  chartDrawers: { id: 'chart-drawers', x: 2, y: 4, width: 2, height: 1 },
  mapCabinet: { id: 'map-cabinet', x: 12, y: 4, width: 2, height: 1 },
} satisfies Record<string, FieldObstacle>;

export const inspectionRails = [
  { id: 'survey-gallery-rail', x: 6, y: 8, width: 1, height: 4 },
  { id: 'stilling-well-rail', x: 11, y: 9, width: 1, height: 3 },
] satisfies FieldObstacle[];

export const tongueStops = [
  { id: 'west-deck-stop', x: 8, y: 7, width: 1, height: 1 },
  { id: 'east-deck-stop', x: 10, y: 7, width: 1, height: 1 },
] satisfies FieldObstacle[];

export const interiorObstacles: Partial<Record<MapId, readonly FieldObstacle[]>> = {
  workshop: Object.values(workshopFurniture),
  chamber: [
    ...inspectionRails, ...tongueStops,
    // The old water tiles cover the hole; the dressed stone rises on either
    // shoulder. The narrow plank at (9,6) and its approach at (9,7) stay dry.
    { id: 'basin-northwest-lip', x: 7, y: 4, width: 2, height: 1 },
    { id: 'basin-northeast-lip', x: 10, y: 4, width: 2, height: 1 },
    { id: 'basin-west-rim', x: 7, y: 6, width: 1, height: 1 },
    { id: 'basin-east-rim', x: 11, y: 6, width: 1, height: 1 },
  ],
};
