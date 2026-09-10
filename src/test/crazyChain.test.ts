import { describe, expect, it } from 'vitest';
import {
  calculateChainProgress,
  deriveChainCardStatus,
  evaluateChainLeg,
  formatThreshold,
} from '@/lib/nfl/crazyChain';

describe('NFL Crazy Chain rules', () => {
  it('evaluates supported statistical comparisons exactly', () => {
    expect(evaluateChainLeg(2, 'gte', 1)).toBe(true);
    expect(evaluateChainLeg(49, 'gte', 50)).toBe(false);
    expect(evaluateChainLeg(2, 'lte', 2)).toBe(true);
    expect(evaluateChainLeg(1, 'eq', 1)).toBe(true);
  });

  it('settles the whole card all-or-nothing while ignoring voids', () => {
    expect(deriveChainCardStatus(['hit', 'hit', 'void'])).toBe('won');
    expect(deriveChainCardStatus(['hit', 'miss', 'pending'])).toBe('lost');
    expect(deriveChainCardStatus(['hit', 'pending'])).toBe('locked');
    expect(deriveChainCardStatus(['void', 'void'])).toBe('void');
  });

  it('adds every hit on perfect cards and resets after a miss', () => {
    const progress = calculateChainProgress([
      { weekNumber: 1, status: 'won', linksWon: 2, linksRisked: 2, hitLegs: 2 },
      { weekNumber: 2, status: 'won', linksWon: 5, linksRisked: 5, hitLegs: 5 },
      { weekNumber: 3, status: 'lost', linksWon: 0, linksRisked: 3, hitLegs: 2 },
      { weekNumber: 4, status: 'void', linksWon: 0, linksRisked: 1, hitLegs: 0 },
      { weekNumber: 5, status: 'won', linksWon: 1, linksRisked: 1, hitLegs: 1 },
    ]);

    expect(progress.currentChain).toBe(1);
    expect(progress.bestChain).toBe(7);
    expect(progress.perfectWeeks).toBe(3);
    expect(progress.totalHitLegs).toBe(10);
    expect(progress.totalCards).toBe(4);
    expect(progress.bustedCards).toBe(1);
    expect(progress.longestCard).toBe(5);
    expect(progress.lastSettledWeek).toBe(5);
  });

  it('preserves the active chain across skipped and unresolved weeks', () => {
    const progress = calculateChainProgress([
      { weekNumber: 1, status: 'won', linksWon: 3, linksRisked: 3, hitLegs: 3 },
      { weekNumber: 3, status: 'locked', linksWon: 0, linksRisked: 4, hitLegs: 1 },
    ]);
    expect(progress.currentChain).toBe(3);
    expect(progress.lastSettledWeek).toBe(1);
  });

  it('formats member-facing thresholds clearly', () => {
    expect(formatThreshold('gte', 75)).toBe('75+');
    expect(formatThreshold('lte', 2)).toBe('2 or fewer');
    expect(formatThreshold('eq', 1)).toBe('exactly 1');
  });
});
