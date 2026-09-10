import { describe, expect, it } from 'vitest';
import {
  rankValidatedDraftGrades,
  validateDraftGradingResults,
  validatePickRegrade,
  type DraftGradingParticipant,
} from '../../supabase/functions/_shared/draftGrading';
import { isCompleteDraftReport } from '@/lib/draft/resultIntegrity';

const roster: DraftGradingParticipant[] = [
  {
    participantKey: 'participant_1',
    userId: 'user-a',
    picks: [
      { pickKey: 'participant_1_pick_1', pickId: 'pick-a1', pickText: 'Alpha' },
      { pickKey: 'participant_1_pick_2', pickId: 'pick-a2', pickText: 'Beta' },
    ],
  },
  {
    participantKey: 'participant_2',
    userId: 'user-b',
    picks: [
      { pickKey: 'participant_2_pick_1', pickId: 'pick-b1', pickText: 'Gamma' },
      { pickKey: 'participant_2_pick_2', pickId: 'pick-b2', pickText: 'Delta' },
    ],
  },
];

const validPayload = [
  {
    participant_key: 'participant_2',
    summary: 'A complete second report.',
    pick_ratings: [
      { pick_key: 'participant_2_pick_2', score: 7.24, explanation: 'Solid.' },
      { pick_key: 'participant_2_pick_1', score: 8.6, explanation: 'Strong.' },
    ],
  },
  {
    participant_key: 'participant_1',
    summary: 'A complete first report.',
    total_score: 0,
    pick_ratings: [
      { pick_key: 'participant_1_pick_1', score: 9.1, explanation: 'Elite.' },
      { pick_key: 'participant_1_pick_2', score: 8.2, explanation: 'Excellent.' },
    ],
  },
];

describe('draft grading output validation', () => {
  it('maps short AI keys back to exact database ids and derives totals locally', () => {
    const results = validateDraftGradingResults(validPayload, roster);

    expect(results.map(result => result.user_id)).toEqual(['user-a', 'user-b']);
    expect(results[0].total_score).toBe(17.3);
    expect(results[0].pick_ratings.map(rating => rating.pick_id)).toEqual(['pick-a1', 'pick-a2']);
    expect(results[1].total_score).toBe(15.8);
    expect(results[1].pick_ratings[1].score).toBe(7.2);
  });

  it('rejects a missing participant instead of creating a zero row', () => {
    expect(() => validateDraftGradingResults(validPayload.slice(0, 1), roster))
      .toThrow(/Expected 2 participant results/);
  });

  it('rejects duplicate or missing pick keys', () => {
    const broken = structuredClone(validPayload);
    broken[1].pick_ratings[1].pick_key = 'participant_1_pick_1';

    expect(() => validateDraftGradingResults(broken, roster)).toThrow(/Duplicate pick_key/);
  });

  it.each([0, -1, 10.1, Number.NaN, '8.4'])(
    'rejects an invalid score value (%s)',
    score => {
      const broken = structuredClone(validPayload) as Array<{
        pick_ratings: Array<{ score: unknown }>;
      }>;
      broken[0].pick_ratings[0].score = score;
      expect(() => validateDraftGradingResults(broken, roster)).toThrow(/score must/);
    },
  );

  it('validates dispute scores and required explanations', () => {
    expect(validatePickRegrade({
      new_score: 8.26,
      new_explanation: 'Corrected factual context.',
      resolution_note: 'The dispute was valid.',
    }).new_score).toBe(8.3);

    expect(() => validatePickRegrade({
      new_score: 0,
      new_explanation: '',
      resolution_note: '',
    })).toThrow(/new_score/);
  });

  it('ranks only from validated totals and deterministic tiebreakers', () => {
    const results = validateDraftGradingResults(validPayload, roster);
    const ranked = rankValidatedDraftGrades(results, new Map([
      ['user-a', '2026-01-01T00:00:00Z'],
      ['user-b', '2026-01-02T00:00:00Z'],
    ]));

    expect(ranked.map(result => result.user_id)).toEqual(['user-a', 'user-b']);
  });
});

describe('stored draft report integrity', () => {
  const participants = ['user-a', 'user-b'];
  const picks = [
    { id: 'pick-a1', user_id: 'user-a' },
    { id: 'pick-b1', user_id: 'user-b' },
  ];
  const results = [
    { user_id: 'user-a', rank: 1, total_score: 8.4, pick_ratings: [{ pick_id: 'pick-a1', score: 8.4 }] },
    { user_id: 'user-b', rank: 2, total_score: 7.9, pick_ratings: [{ pick_id: 'pick-b1', score: 7.9 }] },
  ];

  it('accepts a complete, internally consistent report', () => {
    expect(isCompleteDraftReport(results, participants, picks)).toBe(true);
  });

  it('rejects zero, partial, duplicated, and mismatched reports', () => {
    expect(isCompleteDraftReport([
      { user_id: 'user-a', rank: 1, total_score: 0, pick_ratings: [] },
      results[1],
    ], participants, picks)).toBe(false);
    expect(isCompleteDraftReport(results.slice(0, 1), participants, picks)).toBe(false);
    expect(isCompleteDraftReport([
      results[0],
      { ...results[1], user_id: 'user-a' },
    ], participants, picks)).toBe(false);
    expect(isCompleteDraftReport([
      { ...results[0], total_score: 9.9 },
      results[1],
    ], participants, picks)).toBe(false);
  });
});
