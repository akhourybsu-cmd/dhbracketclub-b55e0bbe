import { describe, expect, it } from 'vitest';
import { deriveBroadcastMoments } from './broadcast';

describe('deriveBroadcastMoments', () => {
  it('creates factual pick, speed, round, and completion moments', () => {
    const moments = deriveBroadcastMoments([
      { id: 'a', user_id: 'u1', pick_text: 'Alpha', pick_number: 1, round: 1, picked_at: '2026-01-01T00:00:00Z', profiles: { display_name: 'Alex' } },
      { id: 'b', user_id: 'u2', pick_text: 'Beta', pick_number: 2, round: 1, picked_at: '2026-01-01T00:00:08Z', profiles: { display_name: 'Nick' } },
    ], 2);
    expect(moments.some(moment => moment.kind === 'speed' && moment.headline.includes('8s'))).toBe(true);
    expect(moments.some(moment => moment.kind === 'round')).toBe(true);
    expect(moments[0].kind).toBe('complete');
  });

  it('does not invent a speed moment without valid timestamps', () => {
    const moments = deriveBroadcastMoments([
      { id: 'a', user_id: 'u1', pick_text: 'Alpha', pick_number: 1, round: 1 },
    ], 3);
    expect(moments.some(moment => moment.kind === 'speed')).toBe(false);
  });
});