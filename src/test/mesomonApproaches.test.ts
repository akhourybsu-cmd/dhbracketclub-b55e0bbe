import { describe, expect, it } from 'vitest';
import { canWalk, createNewSave, createSession, getPhase, getVisibleObjects, nearbyInteractions, reduceGame } from '@/lib/mesomon/engine';
import { migrateSave } from '@/lib/mesomon/save';
import type { ApproachingNpc, GameSession } from '@/lib/mesomon/types';

function land(reducedMotion = false) {
  const save = createNewSave();
  save.questFlags.captain_met = true;
  save.settings.reducedMotion = reducedMotion;
  save.player = { ...save.player, mapId: 'ship', x: 8, y: 10, facing: 'down' };
  return reduceGame(createSession(save), { type: 'interact', id: 'gangplank' });
}

function step(session: GameSession) {
  const { actor, steps } = session.dialogue!.approach!;
  return reduceGame(session, { type: 'approach-step', actor, remaining: steps.length });
}

function finish(session: GameSession) {
  while (session.dialogue?.approach) session = step(session);
  while (session.dialogue) session = reduceGame(session, { type: 'advance' });
  return session;
}

function resident(session: GameSession, actor: ApproachingNpc) {
  return getVisibleObjects(session.save).find(o => o.id === actor)!;
}

describe('NPCs who come to meet Tavian', () => {
  it('walks Nia down the pier, pauses the player, and resumes a saved walk before speaking', () => {
    let scene = land();
    expect(scene.save.player).toMatchObject({ mapId: 'harbor', x: 26, y: 30 });
    expect(scene.dialogue?.id).toBe('nia');
    expect(scene.dialogue?.approach?.steps).toHaveLength(2);
    expect(getPhase(scene)).toBe('dialogue');
    expect(reduceGame(scene, { type: 'advance' })).toBe(scene);
    expect(reduceGame(scene, { type: 'move', direction: 'up' })).toBe(scene);
    expect(reduceGame(scene, { type: 'input', action: 'cancel' })).toBe(scene);
    const firstStep = step(scene);
    expect(resident(firstStep, 'nia')).not.toEqual(resident(scene, 'nia'));
    expect(reduceGame(firstStep, { type: 'approach-step', actor: 'nia', remaining: 2 })).toBe(firstStep);
    scene = createSession(migrateSave(firstStep.save)!);
    expect(scene.dialogue?.approach?.steps).toHaveLength(1);
    scene = step(scene);
    expect(scene.dialogue?.approach).toBeUndefined();
    expect(scene.dialogue?.index).toBe(0);
    expect(scene.dialogue?.lines[0].speaker).toBe('Nia');
    expect(scene.save.questFlags.nia_met).toBeUndefined();
    expect(nearbyInteractions(scene.save)[0].id).toBe('nia');
    const onPier = resident(scene, 'nia');
    expect(canWalk(scene.save, onPier.x, onPier.y)).toBe(false);
    scene = finish(scene);
    expect(scene.save.questFlags.nia_met).toBe(true);
    expect(resident(scene, 'nia')).toEqual(onPier);
    expect(reduceGame(scene, { type: 'interact', id: 'nia' }).dialogue?.id).toBe('nia-repeat');
  });

  it('uses the same meeting and final positions under reduced motion', () => {
    const immediate = land(true);
    expect(immediate.dialogue?.approach).toBeUndefined();
    expect(immediate.dialogue?.lines).toEqual(land().dialogue?.lines);
    expect(finish(immediate).save.quayResidents).toEqual(finish(land()).save.quayResidents);
    const during = reduceGame(land(), { type: 'settings', settings: { reducedMotion: true } });
    expect(step(during).save.quayResidents).toEqual(immediate.save.quayResidents);
  });

  it('lets Bram interrupt a walk after the three clues, then keeps his post clear and opens the stairs once', () => {
    const save = createNewSave();
    save.player = { ...save.player, mapId: 'harbor', x: 29, y: 21 };
    save.questFlags = { disembarked: true, nia_met: true, workshop_entered: true };
    expect(reduceGame(createSession(save), { type: 'move', direction: 'right' }).dialogue).toBeNull();
    save.questFlags.clues_complete = true;
    let scene = reduceGame(createSession(save), { type: 'move', direction: 'right' });
    expect(scene.dialogue?.id).toBe('bram');
    expect(scene.dialogue?.approach?.steps).toHaveLength(2);
    const playerTile = { x: scene.save.player.x, y: scene.save.player.y };
    scene = finish(scene);
    expect(scene.save.player).toMatchObject(playerTile);
    expect(scene.save.questFlags.bram_met).toBe(true);
    expect(resident(scene, 'bram')).toMatchObject({ x: 31, y: 21, direction: 'left' });
    expect(canWalk(scene.save, 33, 21)).toBe(true);
    expect(reduceGame(scene, { type: 'move', direction: 'down' }).dialogue).toBeNull();
    expect(reduceGame(scene, { type: 'interact', id: 'bram' }).dialogue?.id).toBe('bram-repeat');
  });

  it('honors completed introductions from older files', () => {
    const save = createNewSave();
    save.player = { ...save.player, mapId: 'harbor', x: 29, y: 21 };
    save.questFlags = { disembarked: true, nia_met: true, clues_complete: true, bram_met: true };
    expect(save.quayResidents).toBeUndefined();
    const scene = reduceGame(createSession(migrateSave(save)!), { type: 'move', direction: 'right' });
    expect(scene.dialogue).toBeNull();
    expect(resident(scene, 'bram')).toMatchObject({ x: 33, y: 21 });
  });
});
