import { describe, expect, it } from 'vitest';
import { battlePose } from './battleMotion';

describe('the native battle sprites', () => {
  it('steps toward the opponent on action, recoils away on hit and returns to the same landing', () => {
    for (const side of ['ally', 'enemy'] as const) {
      const rest = battlePose(side, 'ready', 0, false);
      const direction = side === 'ally' ? 1 : -1;
      expect((battlePose(side, 'act', 110, false).x - rest.x) * direction).toBeGreaterThan(0);
      expect((battlePose(side, 'hit', 40, false).x - rest.x) * direction).toBeLessThan(0);
      expect(battlePose(side, 'hit', 40, false).spark).toBe(true);
      for (const cue of ['act', 'hit'] as const) {
        expect(battlePose(side, cue, 300, false)).toEqual(rest);
        expect(battlePose(side, cue, 80, true)).toEqual(rest);
      }
    }
  });
});
