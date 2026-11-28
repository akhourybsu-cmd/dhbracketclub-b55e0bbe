import { describe, expect, it } from 'vitest';
import { makeCompanion } from '@/lib/mesomon/battle';
import { rillikBasin, rillikGangway, rillikLanding } from '@/lib/mesomon/data/tideObstacles';
import { fieldObstaclesForMap } from '@/lib/mesomon/data/fieldObstacles';
import { MAPS } from '@/lib/mesomon/data/maps';
import { canWalk, createNewSave, createSession, DELTAS, getVisibleObjects, reduceGame } from '@/lib/mesomon/engine';
import type { Direction, MapId, MesomonSaveV1 } from '@/lib/mesomon/types';
import { findWalkingPath } from '@/lib/mesomon/wayfinding';

type Point = { x: number; y: number };
const keys = Object.keys(DELTAS) as Direction[];
const rooms = Object.values(MAPS);
const key = (point: Point) => `${point.x},${point.y}`;
const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function saveAt(mapId: MapId, flags: string[] = [], position = MAPS[mapId].spawn) {
  const save = createNewSave(1, 100);
  Object.assign(save.player, { mapId, ...position });
  for (const flag of flags) save.questFlags[flag] = true;
  if (flags.includes('rillik_bonded')) {
    const rillik = makeCompanion('rillik', 'rillik-first', 100);
    save.party = [rillik];
    save.collection[rillik.id] = structuredClone(rillik);
  }
  if (flags.includes('rift_sealed')) save.rifts['port-marche'] = 'sealed';
  return save;
}

/** Check the whole room independently from the pathfinder's selected route. */
function reachableFrom(save: MesomonSaveV1) {
  const queue: Point[] = [save.player];
  const seen = new Set([key(save.player)]);
  for (const tile of queue) {
    for (const delta of Object.values(DELTAS)) {
      const next = { x: tile.x + delta.x, y: tile.y + delta.y };
      const id = key(next);
      if (seen.has(id) || !canWalk(save, next.x, next.y)) continue;
      seen.add(id);
      queue.push(next);
    }
  }
  return seen;
}

const returnJourney = [
  'captain_met', 'nia_met', 'workshop_entered', 'clues_complete', 'bram_met', 'gate_opened', 'brace_found',
  'rillik_bonded', 'current_eddy', 'sluice_open', 'tutorial_complete', 'currents_followed', 'rift_sealed', 'page_found',
];
const storyVisits: Record<MapId, string[][]> = {
  ship: [[], ['captain_met']],
  harbor: [['captain_met', 'disembarked'], ['nia_met', 'whistle_accepted'], ['workshop_entered', 'clues_complete'], returnJourney],
  workshop: [['workshop_entered'], ['workshop_entered', 'bram_met'], returnJourney],
  'tide-stairs': [['bram_met'], ['bram_met', 'gate_opened', 'brace_found'], returnJourney],
  passage: [['rillik_bonded'], ['rillik_bonded', 'current_eddy', 'sluice_open'], returnJourney],
  chamber: [[], returnJourney],
};
const landings: Record<MapId, Point[]> = {
  ship: [MAPS.ship.spawn],
  harbor: [MAPS.harbor.spawn, { x: 9, y: 16 }, { x: 34, y: 22 }],
  workshop: [MAPS.workshop.spawn],
  'tide-stairs': [MAPS['tide-stairs'].spawn, { x: 15, y: 6 }],
  passage: [MAPS.passage.spawn, { x: 18, y: 4 }],
  chamber: [MAPS.chamber.spawn],
};

describe('Port Marche field barriers', () => {
  it.each(rooms)('$id keeps every landing, clear aisle and visible interaction accessible at its story stage', map => {
    for (const flags of storyVisits[map.id]) {
      const save = saveAt(map.id, flags);
      const seen = reachableFrom(save);
      const behindGate = ({ x, y }: Point) =>
        (map.id === 'passage' && !save.questFlags.sluice_open && x >= 12)
        || (map.id === 'tide-stairs' && !save.questFlags.gate_opened &&
          ((x === rillikLanding.x && y === rillikLanding.y) || (x === 13 && y === 11)));
      const disconnected: string[] = [];
      const wronglyConnected: string[] = [];
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        if (!canWalk(save, x, y)) continue;
        const tile = { x, y };
        if (behindGate(tile)) {
          if (seen.has(key(tile))) wronglyConnected.push(key(tile));
        } else if (!seen.has(key(tile))) disconnected.push(key(tile));
      }
      expect(disconnected, `${map.id} with ${flags.join(', ')}`).toEqual([]);
      expect(wronglyConnected, 'Closed crossing has a walkable bypass').toEqual([]);
      for (const landing of landings[map.id]) expect(canWalk(save, landing.x, landing.y), key(landing)).toBe(true);
      for (const object of getVisibleObjects(save)) {
        const path = findWalkingPath(save, [object], 1);
        if (behindGate(object)) expect(path, object.id).toBeUndefined();
        else {
          expect(path, object.id).toBeDefined();
          expect(distance(path!.points.at(-1)!, object), object.id).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('limits rescue to the dry landing and keeps the catch basin impassable after Rillik leaves', () => {
    const save = saveAt('tide-stairs', ['bram_met']);
    const rillik = MAPS['tide-stairs'].objects.find(object => object.id === 'rillik-bond')!;
    expect(findWalkingPath(save, [rillik], 1)).toBeUndefined();
    expect(findWalkingPath(save, [rillikGangway], 0)).toBeUndefined();
    expect(findWalkingPath(save, [rillikLanding], 0)).toBeUndefined();
    save.questFlags.gate_opened = true;
    const path = findWalkingPath(save, [rillik], 1)!;
    expect(path.points.slice(-2)).toEqual([rillikGangway, rillikLanding]);
    save.questFlags.rillik_bonded = true;
    for (let x: number = rillikBasin.x; x < rillikBasin.x + rillikBasin.width; x++) {
      for (let y: number = rillikBasin.y; y < rillikBasin.y + rillikBasin.height; y++) {
        expect(canWalk(save, x, y), key({ x, y })).toBe(y === rillikLanding.y && (x === rillikGangway.x || x === rillikLanding.x));
      }
    }
  });

  it.each(rooms)('$id rejects ground taps and directional inputs into its fixtures from every exposed side', map => {
    const save = saveAt(map.id, returnJourney);
    const footprintTiles: Point[] = [];
    for (const fixture of fieldObstaclesForMap(map.id)) {
      for (let y = fixture.y; y < fixture.y + fixture.height; y++) for (let x = fixture.x; x < fixture.x + fixture.width; x++) {
        expect(canWalk(save, x, y), `${fixture.id} at ${x},${y}`).toBe(false);
        footprintTiles.push({ x, y });
        for (const direction of keys) {
          const delta = DELTAS[direction];
          const from = { x: x - delta.x, y: y - delta.y };
          if (!canWalk(save, from.x, from.y)) continue;
          const session = createSession({ ...save, player: { ...save.player, ...from } });
          const step = reduceGame(session, { type: 'move', direction });
          expect(step.save.player, `${fixture.id} from ${key(from)}`).toMatchObject({ ...from, facing: direction });
        }
      }
    }
    expect(footprintTiles.length).toBeGreaterThan(0);
    expect(findWalkingPath(save, footprintTiles, 0)).toBeUndefined();
  });

  it('keeps the east quay routes open from every reachable approach to Bram', () => {
    const save = saveAt('harbor', ['workshop_entered', 'clues_complete']);
    save.settings.reducedMotion = true;
    const bram = getVisibleObjects(save).find(object => object.id === 'bram')!;
    const posts = new Set<string>();
    for (let y = bram.y - 4; y <= bram.y + 4; y++) for (let x = bram.x - 4; x <= bram.x + 4; x++) {
      if (distance({ x, y }, bram) !== 4 || !canWalk(save, x, y)) continue;
      for (const direction of keys) {
        const entry = { x: x + DELTAS[direction].x, y: y + DELTAS[direction].y };
        if (distance(entry, bram) !== 3 || !canWalk(save, entry.x, entry.y)) continue;
        const approaching = createSession({ ...save, player: { ...save.player, x, y } });
        let meeting = reduceGame(approaching, { type: 'move', direction });
        expect(meeting.dialogue?.id, `Meeting from ${x},${y} ${direction}`).toBe('bram');
        while (meeting.dialogue) meeting = reduceGame(meeting, { type: 'advance' });
        const post = meeting.save.quayResidents!.bram!;
        if (posts.has(key(post))) continue;
        posts.add(key(post));
        const clear = reachableFrom(meeting.save);
        for (const landing of landings.harbor) expect(clear.has(key(landing)), `Bram at ${key(post)}`).toBe(true);
        for (const door of MAPS.harbor.objects.filter(object => object.kind === 'door')) expect(clear.has(key(door)), door.id).toBe(true);
      }
    }
    expect(posts.size).toBeGreaterThan(1);
  });

  const detours: { zone: MapId; landmark: string; from: Point; to: Point }[] = [
    { zone: 'ship', landmark: 'lashed chest', from: { x: 8, y: 8 }, to: { x: 8, y: 6 } },
    { zone: 'harbor', landmark: 'timber stocks', from: { x: 14, y: 18 }, to: { x: 14, y: 21 } },
    { zone: 'workshop', landmark: 'sail-cutting table', from: { x: 8, y: 11 }, to: { x: 8, y: 8 } },
    { zone: 'tide-stairs', landmark: 'scupper wall', from: { x: 14, y: 7 }, to: { x: 14, y: 9 } },
    { zone: 'passage', landmark: 'intake strainer', from: { x: 4, y: 18 }, to: { x: 4, y: 16 } },
    { zone: 'chamber', landmark: 'west masonry race', from: { x: 5, y: 10 }, to: { x: 7, y: 10 } },
  ];
  it.each(detours)('$zone takes the player around the $landmark and back by real movement', ({ zone, from, to }) => {
    let session = createSession(saveAt(zone, returnJourney, from));
    expect(canWalk(session.save, from.x, from.y)).toBe(true);
    for (const target of [to, from]) {
      const path = findWalkingPath(session.save, [target], 0);
      expect(path).toBeDefined();
      expect(path!.points.length - 1).toBeGreaterThan(distance(from, to));
      for (const next of path!.points.slice(1)) {
        const player = session.save.player;
        const direction = keys.find(dir => player.x + DELTAS[dir].x === next.x && player.y + DELTAS[dir].y === next.y);
        expect(direction).toBeDefined();
        session = reduceGame(session, { type: 'move', direction: direction! });
        expect(session.save.player).toMatchObject(next);
      }
      expect(session.save.player).toMatchObject(target);
    }
  });
});
