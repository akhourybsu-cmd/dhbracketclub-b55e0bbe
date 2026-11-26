import { describe, expect, it } from 'vitest';
import { canWalk, createNewSave, createSession, DELTAS, getVisibleObjects, reduceGame } from '@/lib/mesomon/engine';
import { resonanceEligibility } from '@/lib/mesomon/battle';
import { findWalkingPath, getChartRoute } from '@/lib/mesomon/wayfinding';
import type { GameSession, MesomonSaveV1 } from '@/lib/mesomon/types';

function followChart(session: GameSession) {
  const route = getChartRoute(session.save)!;
  expect(route).toBeDefined();
  expect(getVisibleObjects(session.save).map(object => object.id)).toContain(route.target.id);
  for (const leg of route.legs) {
    for (let count = 0; count < leg.steps; count++) {
      const { x, y } = session.save.player;
      const delta = DELTAS[leg.direction];
      expect(canWalk(session.save, x + delta.x, y + delta.y)).toBe(true);
      session = reduceGame(session, { type: 'move', direction: leg.direction });
    }
  }
  expect(session.save.player).toMatchObject(route.points[route.points.length - 1]);
  // A directional input faces a solid object. It can also step onto a door.
  if (route.facing) session = reduceGame(session, { type: 'move', direction: route.facing });
  session = reduceGame(session, { type: 'input', action: 'confirm' });
  return { session, id: route.target.id };
}

describe('Port Marche location chart', () => {
  it('guides an entire real chapter using the displayed directions, including the trip home', () => {
    let session = createSession(createNewSave());
    const visited: string[] = [];
    for (let turn = 0; turn < 400 && !session.save.questFlags.chapter_complete; turn++) {
      if (session.dialogue) {
        session = reduceGame(session, session.dialogue.choices && session.dialogue.index === session.dialogue.lines.length - 1
          ? { type: 'choice', id: 'direct' } : { type: 'advance' });
      } else if (session.save.battle) {
        const action = resonanceEligibility(session.save.battle, session.save.inventory['crystal-bud']).eligible
          ? { type: 'resonate' as const } : { type: 'move' as const, moveId: 'resonant-cry' as const };
        session = reduceGame(session, session.save.battle.phase === 'choosing' ? { type: 'battle', action } : { type: 'advance' });
      } else if (session.save.seal.active) {
        session = reduceGame(session, { type: 'seal', accuracy: 1 });
      } else {
        const next = followChart(session);
        session = next.session;
        visited.push(next.id);
      }
    }
    expect(session.save.questFlags.chapter_complete, visited.join(' → ')).toBe(true);
    expect(visited.slice(0, 4)).toEqual(['captain', 'gangplank', 'nia', 'workshop-door']);
    expect(new Set(visited.slice(4, 7))).toEqual(new Set(['chart', 'field-map', 'satchel-hook']));
    expect(visited.slice(7)).toEqual([
      'workshop-exit', 'bram', 'tide-door', 'gate-brace', 'gate-wheel', 'rillik-bond', 'passage-door',
      'sense-eddy', 'sluice', 'tressel', 'sense-channel', 'chamber-door', 'rift', 'page',
      'chamber-exit', 'passage-exit', 'stairs-exit', 'workshop-door', 'closing',
    ]);
    expect(getChartRoute(session.save)).toBeUndefined();
  });

  function passageProgress(): MesomonSaveV1 {
    const save = createNewSave();
    for (const key of ['captain_met', 'disembarked', 'nia_met', 'workshop_entered', 'clues_complete', 'bram_met', 'gate_opened', 'rillik_bonded']) save.questFlags[key] = true;
    save.player = { ...save.player, mapId: 'passage', x: 4, y: 19 };
    return save;
  }
  it('finds exact floor tiles and interaction range while honoring solid scenery and moving gates', () => {
    const save = passageProgress();
    const empty = { x: 4, y: 16 };
    const exact = findWalkingPath(save, [empty], 0)!;
    expect(exact.target).toBe(empty);
    expect(exact.points).toEqual([{ x: 4, y: 19 }, { x: 4, y: 18 }, { x: 4, y: 17 }, empty]);
    expect(findWalkingPath(save, [{ x: 4, y: 19 }], 0)?.points).toHaveLength(1);
    const sluice = getVisibleObjects(save).find(object => object.id === 'sluice')!;
    expect(findWalkingPath(save, [sluice], 0)).toBeUndefined();
    expect(findWalkingPath(save, [sluice], 1)?.target).toBe(sluice);
    const farBank = { x: 16, y: 13 };
    expect(findWalkingPath(save, [farBank], 0)).toBeUndefined();
    save.questFlags.sluice_open = true;
    expect(findWalkingPath(save, [farBank], 0)?.target).toBe(farBank);
    expect(findWalkingPath(save, [], 1)).toBeUndefined();
  });
  it('avoids the flooded crossing and sends a detouring player back by unlocked doors', () => {
    const save = passageProgress();
    const first = getChartRoute(save)!;
    expect(first.target.id).toBe('sense-eddy');
    expect(first.points.some(({ x }) => x >= 10)).toBe(false);
    save.questFlags.current_eddy = true;
    expect(getChartRoute(save)?.target.id).toBe('sluice');
    save.player = { ...save.player, mapId: 'workshop', x: 8, y: 11 };
    expect(getChartRoute(save)?.target.id).toBe('workshop-exit');
    save.player = { ...save.player, mapId: 'harbor', x: 9, y: 16 };
    expect(getChartRoute(save)?.target.id).toBe('tide-door');
    save.questFlags.bram_met = false;
    expect(getChartRoute(save)?.target.id).toBe('bram');
  });
  it('never charts a future chapter encounter while its gate is still shut', () => {
    const save = passageProgress();
    Object.assign(save.questFlags, { current_eddy: true, sluice_open: true, currents_followed: true });
    expect(getChartRoute(save)?.target.id).toBe('tressel');
    save.questFlags.tutorial_complete = true;
    expect(getChartRoute(save)?.target.id).toBe('chamber-door');
    save.player = { ...save.player, mapId: 'chamber', x: 8, y: 12 };
    expect(getChartRoute(save)?.label).toBe('Chamber basin');
    save.questFlags.boss_introduced = true;
    expect(getChartRoute(save)?.label).toBe('The first rift');
  });
});
