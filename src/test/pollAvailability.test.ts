import { describe, expect, it } from 'vitest';
import {
  formatDateOptionLabel,
  fromDateKey,
  nextResponse,
  pendingMembers,
  rankDateOptions,
  summarizeTally,
  toDateKey,
  type AvailabilityVote,
  type DateOption,
} from '@/lib/polls/availability';

const options: DateOption[] = [
  { id: 'a', date: '2026-11-27', label: 'Fri, Nov 27' },
  { id: 'b', date: '2026-11-28', label: 'Sat, Nov 28' },
  { id: 'c', date: '2026-11-29', label: 'Sun, Nov 29' },
];

const members = [
  { user_id: 'u1', display_name: 'Alex' },
  { user_id: 'u2', display_name: 'CT' },
  { user_id: 'u3', display_name: 'Sam' },
];

function vote(user_id: string, option_id: string, response: AvailabilityVote['response']): AvailabilityVote {
  return { user_id, option_id, response };
}

describe('date keys', () => {
  it('round-trips a local calendar date without shifting', () => {
    const key = '2026-11-27';
    expect(toDateKey(fromDateKey(key))).toBe(key);
  });

  it('labels a date with weekday and month', () => {
    expect(formatDateOptionLabel('2026-11-27')).toBe('Fri, Nov 27');
  });
});

describe('nextResponse cycle', () => {
  it('cycles yes → maybe → no → cleared', () => {
    expect(nextResponse(null)).toBe('yes');
    expect(nextResponse('yes')).toBe('maybe');
    expect(nextResponse('maybe')).toBe('no');
    expect(nextResponse('no')).toBeNull();
  });

  it('skips maybe when the poll disallows it', () => {
    expect(nextResponse('yes', false)).toBe('no');
  });
});

describe('rankDateOptions', () => {
  it('puts an everyone-available date first', () => {
    const votes = [
      vote('u1', 'a', 'yes'), vote('u2', 'a', 'no'),
      vote('u1', 'b', 'yes'), vote('u2', 'b', 'yes'),
    ];
    const ranked = rankDateOptions(options, votes, members);
    expect(ranked[0].option.id).toBe('b');
    expect(ranked[0].allAvailable).toBe(true);
    expect(ranked[0].yes.map(m => m.display_name)).toEqual(['Alex', 'CT']);
  });

  it('breaks ties by yes, then maybe, then fewest no, then earliest date', () => {
    const votes = [
      vote('u1', 'a', 'yes'), vote('u2', 'a', 'no'),
      vote('u1', 'b', 'yes'), vote('u2', 'b', 'maybe'),
      vote('u1', 'c', 'yes'),
    ];
    const ranked = rankDateOptions(options, votes, members);
    expect(ranked.map(r => r.option.id)).toEqual(['b', 'c', 'a']);
  });

  it('never marks a date as everyone-available with zero answers', () => {
    const ranked = rankDateOptions(options, [], members);
    expect(ranked.every(r => !r.allAvailable)).toBe(true);
    expect(summarizeTally(ranked[0])).toBe('No answers yet');
  });
});

describe('pendingMembers', () => {
  it('lists members who answered no dates at all', () => {
    const votes = [vote('u1', 'a', 'yes'), vote('u2', 'b', 'no')];
    expect(pendingMembers(members, votes).map(m => m.display_name)).toEqual(['Sam']);
  });
});
