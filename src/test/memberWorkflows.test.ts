import { describe, expect, it } from 'vitest';
import { mergeUniqueById, moveListItem, nextRsvpStatus, optimisticGoingCount } from '@/lib/memberWorkflows';

describe('member workflows', () => {
  it('toggles the selected RSVP off', () => {
    expect(nextRsvpStatus('going', 'going')).toBeNull();
    expect(nextRsvpStatus('maybe', 'going')).toBe('going');
  });

  it('updates the going count for optimistic RSVP changes without going negative', () => {
    expect(optimisticGoingCount(2, null, 'going')).toBe(3);
    expect(optimisticGoingCount(2, 'going', 'maybe')).toBe(1);
    expect(optimisticGoingCount(0, 'going', null)).toBe(0);
  });

  it('reorders ranking items without mutating the source', () => {
    const source = ['A', 'B', 'C'];
    expect(moveListItem(source, 1, 'up')).toEqual(['B', 'A', 'C']);
    expect(moveListItem(source, 1, 'down')).toEqual(['A', 'C', 'B']);
    expect(source).toEqual(['A', 'B', 'C']);
  });

  it('ignores invalid reorder requests', () => {
    expect(moveListItem(['A', 'B'], 0, 'up')).toEqual(['A', 'B']);
    expect(moveListItem(['A', 'B'], 1, 'down')).toEqual(['A', 'B']);
  });

  it('deduplicates realtime rows when loading another page', () => {
    const current = [{ id: '2' }, { id: '1' }];
    const incoming = [{ id: '1' }, { id: '0' }];
    expect(mergeUniqueById(current, incoming).map(item => item.id)).toEqual(['2', '1', '0']);
  });
});
