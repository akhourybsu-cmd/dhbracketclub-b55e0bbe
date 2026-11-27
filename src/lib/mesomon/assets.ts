import type { BattleState, SpeciesId } from './types';

/** Original Port Marche artwork, loaded only by the Mesomon route. */
const version = 5;
// Keep unchanged images available under the URLs already held in browser caches.
const originalArtVersion = 4;
const artUrl = (path: string, revision = originalArtVersion) => `/games/mesomon/${path}.png?v=${revision}`;

export const MESOMON_ASSETS = {
  fieldcase: artUrl('fieldcase'),
  version,
  root: '/games/mesomon/',
  cover: `/games/mesomon/cover.webp?v=${version}`,
  coverThumbnail: artUrl('cover', version),
  scenery: artUrl('scenery', version),
  tiles: artUrl('harbor-tiles'),
  people: artUrl('people', version),
  creatures: artUrl('mesomon', version),
  battle: artUrl('creature-battle-v1'),
  portraits: artUrl('portraits'),
} as const;
export const PEOPLE = ['tavian', 'nia', 'bram', 'seli', 'pell', 'captain', 'edda', 'fisher', 'worker', 'porter', 'lanternkeeper', 'vendor'] as const;
export const CREATURES = ['rillik', 'muddren', 'gleamwing', 'tressel', 'rift-wretch'] as const;
export function fieldPlateUrl(id: SpeciesId): string {
  return `/games/mesomon/field-guide/${id}.webp?v=${originalArtVersion}`;
}
export function battleSceneUrl(id: BattleState['id']): string {
  return `/games/mesomon/battle-scenes-v1/${id}.webp`;
}
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
  return artUrl(`portraits/${PORTRAITS.has(normalized) ? normalized : 'tavian'}`);
}

/** Notes and stage directions have no speaking face. Named harbor workers
 * retain their own illustrations instead of borrowing Tavian's portrait. */
export function dialoguePortrait(speaker: string): string | null {
  const label = speaker.toLowerCase();
  const aliases: Record<string, string> = {
    'dock worker': 'worker', 'crane rigger': 'worker',
    'lamp keeper': 'lanternkeeper', 'rope maker': 'porter',
    merchant: 'vendor', 'road keeper': 'worker', 'quay runner': 'porter',
  };
  const first = label.split(/\s+/)[0].replace(/['’]s$/, '');
  const id = aliases[label] ?? (PEOPLE.some(person => person === first) ? first : null);
  return id ? portraitUrl(id) : null;
}

export const SCENERY = {
  crane: { x: 0, y: 0, width: 48, height: 48 },
  wheel: { x: 48, y: 0, width: 32, height: 32 },
  skiff: { x: 80, y: 0, width: 48, height: 32 },
} as const;
