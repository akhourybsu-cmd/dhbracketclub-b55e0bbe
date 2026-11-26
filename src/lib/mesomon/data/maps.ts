import type { MapDefinition, MapId, MapObject, TileKind } from '../types';

function grid(width: number, height: number, tile: TileKind): TileKind[][] { return Array.from({ length: height }, () => Array<TileKind>(width).fill(tile)); }
function fill(tiles: TileKind[][], x: number, y: number, width: number, height: number, tile: TileKind) { for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) if (tiles[row]?.[col] !== undefined) tiles[row][col] = tile; }
function object(id: string, x: number, y: number, label: string, kind: MapObject['kind'], sprite = id, solid = true): MapObject { return { id, x, y, label, kind, sprite, solid }; }

const ship = grid(16, 14, 'water');
fill(ship, 3, 2, 10, 10, 'wood'); fill(ship, 3, 2, 10, 1, 'wall'); fill(ship, 3, 2, 1, 10, 'wall'); fill(ship, 12, 2, 1, 10, 'wall'); fill(ship, 4, 3, 3, 3, 'roof'); fill(ship, 9, 3, 3, 3, 'roof');

const harbor = grid(40, 36, 'water');
fill(harbor, 2, 3, 36, 24, 'stone'); fill(harbor, 2, 3, 36, 2, 'wall');
fill(harbor, 2, 5, 2, 21, 'wall'); fill(harbor, 36, 5, 2, 21, 'wall');
fill(harbor, 4, 6, 10, 8, 'roof'); fill(harbor, 4, 13, 10, 2, 'wall'); fill(harbor, 8, 14, 3, 2, 'stone');
fill(harbor, 19, 7, 10, 7, 'roof'); fill(harbor, 18, 13, 12, 2, 'wood');
fill(harbor, 24, 25, 5, 9, 'wood'); fill(harbor, 9, 26, 20, 3, 'wood'); fill(harbor, 3, 26, 5, 6, 'wood');
fill(harbor, 30, 26, 6, 3, 'sand'); fill(harbor, 31, 29, 6, 4, 'reeds');
fill(harbor, 16, 3, 5, 2, 'stone'); fill(harbor, 32, 19, 5, 5, 'stairs');
fill(harbor, 5, 18, 3, 3, 'wood'); fill(harbor, 13, 19, 3, 2, 'wood');
fill(harbor, 25, 19, 3, 2, 'wood'); fill(harbor, 8, 4, 1, 2, 'grass');

const workshop = grid(16, 14, 'wall');
fill(workshop, 2, 2, 12, 11, 'floor'); fill(workshop, 3, 3, 3, 2, 'wood'); fill(workshop, 10, 3, 3, 2, 'wood'); fill(workshop, 3, 8, 3, 3, 'wood'); fill(workshop, 11, 8, 2, 3, 'wood'); fill(workshop, 7, 12, 3, 1, 'floor');

const stairs = grid(20, 18, 'dark-water');
fill(stairs, 3, 2, 14, 13, 'stone'); fill(stairs, 3, 2, 14, 1, 'wall'); fill(stairs, 3, 2, 1, 13, 'wall'); fill(stairs, 7, 4, 5, 6, 'stairs'); fill(stairs, 10, 10, 6, 4, 'wood'); fill(stairs, 4, 14, 4, 2, 'stone');

const passage = grid(24, 22, 'wall');
fill(passage, 2, 10, 5, 11, 'floor'); fill(passage, 2, 11, 19, 4, 'floor');
fill(passage, 15, 3, 6, 12, 'floor'); fill(passage, 7, 6, 3, 7, 'floor');
fill(passage, 10, 11, 2, 4, 'wood'); fill(passage, 21, 5, 1, 7, 'dark-water'); fill(passage, 8, 6, 2, 1, 'wood');

const chamber = grid(18, 16, 'dark-water');
fill(chamber, 2, 2, 14, 12, 'floor'); fill(chamber, 2, 2, 14, 1, 'wall'); fill(chamber, 2, 2, 1, 12, 'wall'); fill(chamber, 15, 2, 1, 12, 'wall'); fill(chamber, 3, 3, 3, 3, 'dark-water'); fill(chamber, 12, 8, 3, 4, 'dark-water'); fill(chamber, 7, 13, 3, 2, 'floor');

// The chamber dial's rounded opening is wet on both sides of a maintenance
// tongue. Its southern approach (9,6) ends beside the central rift at (9,5).
fill(chamber, 9, 4, 1, 1, 'dark-water');
fill(chamber, 7, 5, 5, 1, 'dark-water');
fill(chamber, 8, 6, 1, 1, 'dark-water');
fill(chamber, 10, 6, 1, 1, 'dark-water');

export const MAPS: Record<MapId, MapDefinition> = {
  ship: { id: 'ship', name: 'The Wayfarer · arrival deck', width: 16, height: 14, tiles: ship, spawn: { x: 8, y: 9 }, ambience: 'harbor', objects: [
    object('captain', 8, 5, 'Captain', 'npc'), object('gangplank', 8, 11, 'Go ashore', 'door', 'gangplank', false), object('ship-rail', 11, 8, 'Watch the harbor', 'sign', 'rope'),
  ] },
  harbor: { id: 'harbor', name: 'Port Marche · lower quay', width: 40, height: 36, tiles: harbor, spawn: { x: 26, y: 30 }, ambience: 'harbor', objects: [
    object('nia', 25, 28, 'Nia', 'npc'), object('workshop-door', 9, 15, 'Edda’s workshop', 'door', 'door', false),
    object('seli', 22, 16, 'Seli · provisions', 'npc'), object('pell', 30, 26, 'Pell', 'npc'), object('fisher', 5, 28, 'Fisher', 'npc'),
    object('dockworker', 11, 24, 'Dock worker', 'npc'), object('bell-worker', 20, 23, 'Crane rigger', 'npc', 'worker'), object('lamp-keeper', 31, 17, 'Lamp keeper', 'npc', 'worker'),
    object('bram', 33, 21, 'Bram · tide supervisor', 'npc'), object('tide-door', 35, 21, 'Old tide stairs', 'door', 'stairs', false),
    object('inland-gate', 18, 4, 'Inland road gate', 'sign', 'gate'), object('whistle-reeds', 32, 29, 'Search the reeds', 'search', 'reeds'),
    object('harbor-sign', 17, 25, 'Harbor district map', 'sign', 'sign'), object('muddren-catch', 6, 29, 'Muddren in the net', 'encounter', 'muddren'),
    object('harbor-crane', 7, 22, 'Working crane', 'sign', 'crane'), object('merchant', 17, 17, 'Awning merchant', 'npc', 'worker'), object('rope-worker', 23, 25, 'Rope maker', 'npc', 'worker'),
    object('departure-pier', 26, 33, 'Arrival pier', 'sign', 'rope'),
  ] },
  workshop: { id: 'workshop', name: 'Edda’s workshop', width: 16, height: 14, tiles: workshop, spawn: { x: 8, y: 11 }, ambience: 'workshop', objects: [
    object('chart', 4, 4, 'Resonance chart', 'clue', 'chart'), object('field-map', 11, 4, 'Damp field map', 'clue', 'map'), object('satchel-hook', 12, 9, 'Empty satchel hook', 'clue', 'hook'),
    object('workshop-note', 4, 9, 'Edda’s unfinished note', 'sign', 'note'), object('kettle', 5, 7, 'Dry kettle', 'sign', 'kettle'),
    object('workshop-exit', 8, 12, 'Return to the quay', 'door', 'door', false), object('closing', 8, 6, 'Nia', 'npc', 'nia'),
    object('rest-rope', 12, 11, 'Rest beside the window', 'crystal', 'rope'),
  ] },
  'tide-stairs': { id: 'tide-stairs', name: 'The old tide stairs', width: 20, height: 18, tiles: stairs, spawn: { x: 5, y: 4 }, ambience: 'underwharf', objects: [
    object('stairs-exit', 4, 4, 'Return to the quay', 'door', 'stairs', false), object('gate-wheel', 8, 8, 'Jammed tide wheel', 'gate', 'wheel'),
    object('gate-brace', 5, 12, 'Loose timber brace', 'pickup', 'timber'), object('tide-lattice', 10, 9, 'Bent tide lattice', 'sign', 'gate'),
    object('rillik-bond', 13, 11, 'Frightened Rillik', 'encounter', 'rillik'), object('passage-door', 16, 5, 'Under-wharf passage', 'door', 'door', false), object('nia-stairs', 6, 7, 'Nia', 'npc', 'nia'),
  ] },
  passage: { id: 'passage', name: 'Under the working harbor', width: 24, height: 22, tiles: passage, spawn: { x: 4, y: 19 }, ambience: 'underwharf', objects: [
    object('passage-exit', 4, 20, 'Return to the tide stairs', 'door', 'stairs', false), object('sense-eddy', 4, 15, 'The eddy beneath the boards', 'sense', 'current', false),
    object('sluice', 9, 12, 'Maintenance sluice', 'gate', 'wheel'), object('tressel', 16, 12, 'Agitated Tressel', 'encounter', 'tressel'),
    object('sense-channel', 18, 6, 'The second current', 'sense', 'current', false), object('pickup-tincture', 5, 10, 'Sealed healing tincture', 'pickup', 'tincture'),
    object('gleamwing', 8, 7, 'Gleamwing by the lantern', 'encounter', 'gleamwing'), object('save-lamp', 19, 9, 'Lantern alcove · rest', 'crystal', 'lantern'),
    object('chamber-door', 19, 3, 'Old tide chamber', 'door', 'door', false), object('maintenance-plaque', 3, 11, 'Maintenance marks', 'sign', 'sign'),
  ] },
  chamber: { id: 'chamber', name: 'The chamber in two voices', width: 18, height: 16, tiles: chamber, spawn: { x: 8, y: 12 }, ambience: 'underwharf', objects: [
    object('chamber-exit', 8, 14, 'Return to the passage', 'door', 'door', false), object('rift', 9, 5, 'The first rift', 'rift', 'rift'), object('page', 12, 4, 'A dry page beneath the stone', 'clue', 'note'),
    object('chamber-markings', 4, 9, 'Old survey cuts', 'sign', 'sign'),
  ] },
};

export const WALKABLE_TILES: ReadonlySet<TileKind> = new Set(['stone', 'wood', 'sand', 'floor', 'stairs', 'grass', 'reeds']);
