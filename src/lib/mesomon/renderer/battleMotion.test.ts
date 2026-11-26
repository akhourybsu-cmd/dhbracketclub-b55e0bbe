import { describe, expect, it } from 'vitest';
import { CREATURES } from '../assets';
import { BATTLE_CELL, BATTLE_POSES, BATTLE_RENDER_SCALE, FIELD_SCREEN, battleFrame, battlePose } from './battleMotion';

describe('the Port Marche battle atlas', () => {
  it('maps every species to its own four source frames at their original resolution', () => {
    expect(CREATURES).toEqual(['rillik', 'muddren', 'gleamwing', 'tressel', 'rift-wretch']);
    const indices = CREATURES.flatMap(species => BATTLE_POSES.map(pose => battleFrame(species, pose)));
    expect(indices).toEqual(Array.from({ length: 20 }, (_, index) => index));
    expect([FIELD_SCREEN.width * BATTLE_RENDER_SCALE, FIELD_SCREEN.height * BATTLE_RENDER_SCALE]).toEqual([640, 576]);
    expect(BATTLE_CELL / BATTLE_RENDER_SCALE).toBe(48);
  });

  it('holds its landing through anticipation, action, recoil and recovery', () => {
    for (const side of ['ally', 'enemy'] as const) {
      const rest = battlePose(side, 'ready', 0, false);
      const direction = side === 'ally' ? 1 : -1;
      expect(battlePose(side, 'act', 20, false).cel).toBe('ready');
      const action = battlePose(side, 'act', 110, false);
      expect(action.cel).toBe('action');
      expect((action.x - rest.x) * direction).toBeGreaterThan(0);
      const hit = battlePose(side, 'hit', 40, false);
      expect(hit.cel).toBe('recoil');
      expect((hit.x - rest.x) * direction).toBeLessThan(0);
      expect(hit.spark).toBe(true);
      for (const cue of ['act', 'hit'] as const) expect(battlePose(side, cue, 300, false)).toEqual(rest);
    }
  });

  it('breathes without sliding and staggers the two fighters', () => {
    expect(battlePose('ally', 'ready', 550, false)).toEqual({ x: 45, y: 98, cel: 'rest', spark: false });
    expect(battlePose('enemy', 'ready', 550, false)).toEqual({ x: 116, y: 67, cel: 'ready', spark: false });
    expect(battlePose('ally', 'ready', 1000, false)).toEqual({ x: 45, y: 98, cel: 'ready', spark: false });
  });

  it('keeps a single legible pose for each cue with reduced motion', () => {
    for (const side of ['ally', 'enemy'] as const) {
      const { x, y } = battlePose(side, 'ready', 0, true);
      for (const [cue, cel] of [['ready', 'rest'], ['act', 'action'], ['hit', 'recoil']] as const) {
        for (const time of [0, 90, 300, 1000, 2200]) {
          expect(battlePose(side, cue, time, true)).toEqual({ x, y, cel, spark: false });
        }
      }
    }
  });
});
