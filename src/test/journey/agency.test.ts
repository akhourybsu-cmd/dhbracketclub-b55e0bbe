import { describe, expect, it } from 'vitest';
import {
  dominantJourneyPath,
  journeyPathLabel,
  journeyPathScores,
  parseDecisionImpact,
} from '@/lib/journey/agency';
import { EMPTY_RUN_STATE } from '@/lib/journey/types';

describe('journey agency helpers', () => {
  it('normalizes path scores and identifies the strongest identity', () => {
    const state = {
      ...EMPTY_RUN_STATE,
      variables: {
        PATH_GUARDIAN: 2,
        PATH_SEEKER: '4',
        PATH_DEFIANT: -3,
        PATH_MAKER: 'not-a-number',
      },
    };

    expect(journeyPathScores(state).map(({ key, score }) => [key, score])).toEqual([
      ['guardian', 2],
      ['seeker', 4],
      ['defiant', 0],
      ['maker', 0],
    ]);
    expect(dominantJourneyPath(state)?.key).toBe('seeker');
    expect(dominantJourneyPath(EMPTY_RUN_STATE)).toBeNull();
  });

  it('parses safe consequence metadata with a path-label fallback', () => {
    expect(parseDecisionImpact({
      choice_text: 'Stand beside Bethella.',
      path: 'guardian',
      outcome_text: 'Bethella remembers who stayed.',
      impact: ['Bethella trusts you', 4, '', 'Family route opened'],
    })).toEqual({
      choice_text: 'Stand beside Bethella.',
      path: 'guardian',
      path_label: 'Guardian',
      outcome_text: 'Bethella remembers who stayed.',
      impact: ['Bethella trusts you', 'Family route opened'],
    });
    expect(journeyPathLabel('maker')).toBe('Maker');
    expect(parseDecisionImpact({ path: 'maker' })).toBeNull();
  });
});
