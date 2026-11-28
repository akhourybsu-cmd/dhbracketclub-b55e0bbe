import { describe, expect, it } from 'vitest';
import { makeCompanion } from '@/lib/mesomon/battle';
import { canWalk, createNewSave, createSession, DELTAS, getVisibleObjects, reduceGame } from '@/lib/mesomon/engine';
import { MAPS } from '@/lib/mesomon/data/maps';
import { fieldObstaclesForMap } from '@/lib/mesomon/data/fieldObstacles';
import { findWalkingPath } from '@/lib/mesomon/wayfinding';
import { migrateSave, parseCloudSave } from '@/lib/mesomon/save';
import { parseLocalEnvelope } from '@/lib/mesomon/storage';
import type { MapId } from '@/lib/mesomon/types';

function standing(mapId: MapId, x: number, y: number) {
  const save = createNewSave(1, 4081);
  Object.assign(save.player, { mapId, x, y, facing: 'left' });
  if (mapId === 'passage' || mapId === 'chamber') {
    save.questFlags = { gate_opened: true, rillik_bonded: true };
    const starter = makeCompanion('rillik', 'rillik-first', 4081);
    save.party = [starter];
    save.collection[starter.id] = structuredClone(starter);
  }
  if (mapId === 'chamber') Object.assign(save.questFlags, { sluice_open: true, currents_followed: true, tutorial_complete: true });
  return save;
}

describe('legacy field footing on resume', () => {
  it.each(Object.values(MAPS))('restores $id scenery positions to reachable walking ground', map => {
    for (const obstacle of fieldObstaclesForMap(map.id)) {
      const x = obstacle.x + Math.floor(obstacle.width / 2);
      const y = obstacle.y + Math.floor(obstacle.height / 2);
      const save = standing(map.id, x, y);
      save.questFlags.sluice_open = true;
      const resumed = createSession(save).save;
      expect(canWalk(resumed, resumed.player.x, resumed.player.y), obstacle.id).toBe(true);
      expect(findWalkingPath(resumed, [map.spawn], 0), obstacle.id).toBeDefined();
      expect(resumed.player.facing).toBe('left');
      expect(createSession(resumed).save).toEqual(resumed);
      expect(save.player).toMatchObject({ mapId: map.id, x, y });
    }
  });

  it('returns a stranded player to the reachable bank but preserves the position once the sluice opens', () => {
    const flooded = standing('passage', 11, 12);
    const entry = createSession(flooded).save;
    expect(entry.player.x).toBeLessThan(10);
    expect(findWalkingPath(entry, [MAPS.passage.spawn], 0)).toBeDefined();
    const across = standing('passage', 13, 12);
    expect(canWalk(across, 13, 12)).toBe(true);
    expect(createSession(across).save.player.x).toBeLessThan(10);
    across.questFlags.sluice_open = true;
    expect(createSession(across).save).toEqual(across);
  });

  it('returns a legacy player on the isolated rescue landing to the near bank until the gangway opens', () => {
    const save = standing('tide-stairs', 13, 12);
    const resumed = createSession(save).save;
    expect(resumed.player).not.toEqual(save.player);
    expect(findWalkingPath(resumed, [MAPS['tide-stairs'].spawn], 0)).toBeDefined();
    save.questFlags.gate_opened = true;
    expect(createSession(save).save).toEqual(save);
  });

  it.each(['passage', 'chamber'] as const)('reopens a pre-bond save from %s at the rescue without awarding the skipped encounter', room => {
    const save = standing(room, 8, 12);
    delete save.questFlags.rillik_bonded;
    save.party = [];
    save.collection = {};
    save.dialogue = { id: 'boss-intro', index: 0, lines: [{ speaker: 'Tavian', text: 'Listen.' }], onFinish: 'boss-introduced' };
    save.seal.active = true;
    const resumed = createSession(migrateSave(save)!);
    expect(resumed.save.player).toMatchObject({ mapId: 'tide-stairs', ...MAPS['tide-stairs'].spawn });
    expect(resumed.dialogue).toBeNull();
    expect(resumed.save.seal.active).toBe(false);
    expect(resumed.save.party).toEqual([]);
    expect(resumed.save.questFlags).toEqual(save.questFlags);
    expect(createSession(resumed.save)).toEqual(resumed);
    expect(save.player.mapId).toBe(room);
  });

  it('repairs only empty deep-room parties and never duplicates a stored starter', () => {
    const stored = standing('chamber', 8, 12);
    stored.party = [];
    stored.questFlags.companion_released = false;
    const resumed = createSession(stored).save;
    expect(resumed.player).toEqual(stored.player);
    expect(resumed.party).toEqual(Object.values(stored.collection));
    expect(resumed.collection).toEqual(stored.collection);
    expect(resumed.questFlags.companion_released).toBe(false);
    expect(createSession(resumed).save).toEqual(resumed);
    stored.collection = {};
    const missing = createSession(stored).save;
    expect(missing.player.mapId).toBe('tide-stairs');
    expect(missing.questFlags.rillik_bonded).toBe(false);
    expect(missing.party).toEqual([]);
    expect(missing.collection).toEqual({});
  });

  it.each(['sluice_open', 'tutorial_complete', 'currents_followed'])('requires the missing %s milestone on resuming inside the chamber', missing => {
    const save = standing('chamber', 8, 12);
    delete save.questFlags[missing];
    const resumed = createSession(save);
    expect(resumed.save.player).toMatchObject({ mapId: 'passage', ...MAPS.passage.spawn });
    expect(resumed.save.questFlags[missing]).toBeUndefined();
    expect(createSession(resumed.save)).toEqual(resumed);
  });

  it('preserves receipts and saved dialogue while healing the playable copy deterministically', () => {
    const save = standing('workshop', 8, 10);
    save.dialogue = { id: 'legacy', lines: [{ speaker: 'Nia', text: 'Here, sit by the stove.' }], index: 0 };
    const cloud = parseCloudSave({ state: save, slot: 1, revision: 2, updated_at: save.savedAt })!;
    const pending = { requestId: 'a54fc831-fb90-413d-b74c-a93afc096586', expectedRevision: 2, state: save };
    const local = parseLocalEnvelope({ version: 1, save, cloudRevision: 2, cloudUpdatedAt: save.savedAt,
      dirty: true, pending: structuredClone(pending), writtenAt: 100 }, 1)!;
    const resumed = createSession(local.save);
    expect(resumed).toEqual(createSession(cloud.state));
    expect(resumed.save.player).toMatchObject({ x: 8, y: 11 });
    expect(resumed.dialogue).toEqual(save.dialogue);
    expect(resumed.save.savedAt).toBe(save.savedAt);
    expect(local.pending).toEqual(pending);
    expect(cloud.state.player).toEqual(save.player);
  });

  it('reroutes Bram through the stair rail opening without restarting or skipping the conversation', () => {
    const save = standing('harbor', 31, 20);
    save.quayResidents = { bram: { x: 33, y: 21, facing: 'left' } };
    save.dialogue = {
      id: 'bram', lines: [{ speaker: 'Bram', text: 'Smell the tide on those stairs?' }], index: 0, onFinish: 'bram-met',
      approach: { actor: 'bram', steps: ['left', 'up'] },
    };
    let scene = createSession(migrateSave(save)!);
    expect(scene.dialogue?.approach?.steps).toEqual(['left', 'left']);
    while (scene.dialogue?.approach) {
      const { actor, steps } = scene.dialogue.approach;
      const npc = scene.save.quayResidents!.bram!;
      const next = DELTAS[steps[0]];
      expect(canWalk(scene.save, npc.x + next.x, npc.y + next.y)).toBe(true);
      scene = reduceGame(scene, { type: 'approach-step', actor, remaining: steps.length });
    }
    expect(scene.save.quayResidents?.bram).toMatchObject({ x: 31, y: 21, facing: 'up' });
    expect(scene.dialogue?.lines).toEqual(save.dialogue.lines);
    expect(scene.save.questFlags.bram_met).toBeUndefined();
    expect(reduceGame(scene, { type: 'advance' }).save.questFlags.bram_met).toBe(true);
  });

  it('finishes a saved meeting even when its old staging is out of walking range', () => {
    const save = standing('harbor', 31, 20);
    save.quayResidents = { bram: { x: 24, y: 23, facing: 'left' } };
    save.dialogue = {
      id: 'bram', lines: [{ speaker: 'Bram', text: 'Here we are.' }], index: 0, onFinish: 'bram-met',
      approach: { actor: 'bram', steps: ['up'] },
    };
    const scene = createSession(save);
    const bram = scene.save.quayResidents!.bram!;
    expect(Math.abs(bram.x - 31) + Math.abs(bram.y - 20)).toBe(1);
    expect(scene.dialogue?.approach).toBeUndefined();
    expect(scene.dialogue?.lines).toEqual(save.dialogue.lines);
    expect(scene.save.questFlags.bram_met).toBeUndefined();
    expect(reduceGame(scene, { type: 'advance' }).save.questFlags.bram_met).toBe(true);
  });

  it('gives a parked resident a legal landing even when the player reopens another room', () => {
    const save = standing('workshop', 8, 11);
    save.quayResidents = { bram: { x: 25, y: 19, facing: 'up' } };
    const resumed = createSession(save).save;
    expect(resumed.player).toEqual(save.player);
    const bram = resumed.quayResidents!.bram!;
    const harbor = { ...resumed, player: { ...resumed.player, mapId: 'harbor' as const } };
    const others = getVisibleObjects(harbor).filter(object => object.id !== 'bram');
    expect(canWalk(harbor, bram.x, bram.y, others)).toBe(true);
    expect(bram).not.toEqual(save.quayResidents.bram);
    expect(createSession(resumed).save).toEqual(resumed);
  });
});
