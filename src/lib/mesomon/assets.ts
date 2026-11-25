/** Original Port Marche artwork, loaded only by the Mesomon route. */
export const MESOMON_ASSETS = {
  version: 2,
  root: '/games/mesomon/',
  cover: '/games/mesomon/cover.png',
  tiles: '/games/mesomon/harbor-tiles.png?v=2',
  people: '/games/mesomon/people.png?v=2',
  creatures: '/games/mesomon/mesomon.png?v=2',
  battle: '/games/mesomon/battle.png',
  portraits: '/games/mesomon/portraits.png',
} as const;
export const PEOPLE = ['tavian', 'nia', 'bram', 'seli', 'pell', 'captain', 'edda', 'fisher', 'worker', 'porter', 'lanternkeeper', 'vendor'] as const;
export const CREATURES = ['rillik', 'muddren', 'gleamwing', 'tressel', 'rift-wretch'] as const;
export const TILES = ['water', 'water2', 'dock', 'stone', 'grass', 'mud', 'wall', 'roof', 'door', 'stair', 'reeds', 'floor', 'shelf', 'table', 'crate', 'gate', 'bridge', 'rift', 'rope', 'rail', 'lamp', 'sand', 'channel', 'flower', 'chart', 'map', 'satchel', 'rock', 'sign', 'awning', 'window', 'ship', 'planks', 'black', 'arch', 'gear', 'port', 'starboard', 'bow', 'gangplank', 'cabin-0-0', 'cabin-1-0', 'cabin-2-0', 'cabin-0-1', 'cabin-1-1', 'cabin-2-1', 'cabin-0-2', 'cabin-1-2', 'cabin-2-2'] as const;
type TileArt = typeof TILES[number];
const ROLE_ART: Record<string, typeof PEOPLE[number]> = {
  dockworker: 'worker', 'lamp-keeper': 'lanternkeeper', 'bell-worker': 'worker',
  merchant: 'vendor', 'rope-worker': 'porter',
};
export function personArt(id: string, sprite: string) {
  return ROLE_ART[id] ?? sprite;
}
const PROP_ART: Record<string, TileArt> = {
  hook: 'satchel', 'satchel-hook': 'satchel', stairs: 'stair', wheel: 'gear',
  timber: 'crate', note: 'map', kettle: 'table', current: 'channel', tincture: 'lamp',
  lantern: 'lamp', crane: 'gear', crystal: 'lamp',
};
export function propArt(sprite: string): TileArt {
  return TILES.find(tile => tile === sprite) ?? PROP_ART[sprite] ?? 'sign';
}
const PORTRAITS = new Set<string>([...PEOPLE, ...CREATURES]);
export function portraitUrl(id: string): string {
  const normalized = id.toLowerCase().replace(/_/g, '-');
  return `/games/mesomon/portraits/${PORTRAITS.has(normalized) ? normalized : 'tavian'}.png`;
}

/** Notes and stage directions have no speaking face. Named harbor workers
 * retain their own illustrations instead of borrowing Tavian's portrait. */
export function dialoguePortrait(speaker: string): string | null {
  const label = speaker.toLowerCase();
  const aliases: Record<string, string> = {
    'dock worker': 'worker', 'crane rigger': 'worker',
    'lamp keeper': 'lanternkeeper', 'rope maker': 'porter',
    merchant: 'vendor', 'road keeper': 'worker',
  };
  const first = label.split(/\s+/)[0].replace(/['’]s$/, '');
  const id = aliases[label] ?? (PEOPLE.some(person => person === first) ? first : null);
  return id ? portraitUrl(id) : null;
}
