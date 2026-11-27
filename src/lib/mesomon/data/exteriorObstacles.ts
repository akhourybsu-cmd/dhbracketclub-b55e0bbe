import type { FieldObstacle, MapId } from '../types';

/** Ground footprints in tile coordinates. Eaves, hanging sails, shadows, the
 * inlaid compass and the public loading strips remain clear beneath the art. */
export const exteriorObstacles = {
  ship: [
    { id: 'mail-locker', x: 7, y: 7, width: 3, height: 1 },
    { id: 'raised-hatch', x: 4, y: 8, width: 2, height: 1 },
  ],
  harbor: [
    { id: 'workshop-west-jamb', x: 8, y: 14, width: 1, height: 1 },
    { id: 'workshop-east-jamb', x: 10, y: 14, width: 1, height: 1 },
    { id: 'market-counter', x: 19, y: 13, width: 10, height: 1 },
    { id: 'salt-store', x: 5, y: 18, width: 3, height: 2 },
    { id: 'timber-stocks', x: 13, y: 19, width: 3, height: 2 },
    { id: 'barrel-dray', x: 25, y: 19, width: 3, height: 2 },
    { id: 'fish-trestle', x: 18, y: 17, width: 3, height: 1 },
    { id: 'oyster-tanks', x: 31, y: 10, width: 3, height: 2 },
    { id: 'rope-drying-rack', x: 19, y: 25, width: 4, height: 1 },
    { id: 'upper-quay-curb', x: 32, y: 19, width: 1, height: 2 },
    { id: 'lower-quay-curb', x: 32, y: 22, width: 1, height: 2 },
    { id: 'east-quay-curb', x: 36, y: 19, width: 1, height: 5 },
  ],
} satisfies Partial<Record<MapId, readonly FieldObstacle[]>>;
