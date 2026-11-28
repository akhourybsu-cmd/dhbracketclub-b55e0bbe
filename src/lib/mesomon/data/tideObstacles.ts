import type { FieldObstacle, MapId } from '../types';

export const stairCheeks: readonly FieldObstacle[] = [
  { id: 'west-upper-balustrade', x: 7, y: 4, width: 1, height: 2 },
  { id: 'east-upper-balustrade', x: 11, y: 4, width: 1, height: 2 },
  { id: 'west-lower-balustrade', x: 7, y: 8, width: 1, height: 2 },
  { id: 'east-lower-balustrade', x: 11, y: 8, width: 1, height: 2 },
];
export const scupperWall: FieldObstacle = { id: 'scupper-parapet', x: 13, y: 8, width: 4, height: 1 };
export const timberCrib: FieldObstacle = { id: 'stop-log-crib', x: 4, y: 10, width: 2, height: 1 };
export const intakeStrainer: FieldObstacle = { id: 'intake-strainer', x: 2, y: 17, width: 3, height: 1 };
export const bypassMain: FieldObstacle = { id: 'raised-bypass-main', x: 18, y: 8, width: 3, height: 1 };

// The two planked tiles are the only footholds in this flooded service bay.
export const rillikBasin = { x: 12, y: 10, width: 4, height: 4 } as const;
export const rillikGangway = { x: 12, y: 12 } as const;
export const rillikLanding = { x: 13, y: 12 } as const;

export const tideObstacles: Partial<Record<MapId, readonly FieldObstacle[]>> = {
  'tide-stairs': [
    ...stairCheeks, scupperWall, timberCrib,
    { id: 'wheel-rack', x: 9, y: 9, width: 1, height: 1 },
  ],
  passage: [
    intakeStrainer, bypassMain,
    // The recessed timber gallery south of the lever ends at the channel.
    { id: 'braced-gallery', x: 7, y: 14, width: 3, height: 1 },
  ],
};
