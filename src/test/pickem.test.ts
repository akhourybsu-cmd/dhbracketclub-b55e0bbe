import { describe, expect, it } from 'vitest';
import {
  deriveWeekStatus,
  filterVisibleWeeks,
  isWeekLocked,
  weekLockAt,
  type NflGame,
  type NflSeason,
  type NflWeek,
} from '@/hooks/usePickem';

const season = {
  id: 'season-1',
  year: 2026,
  name: '2026 NFL Pick’em',
  status: 'active',
  current_week: 1,
  starts_at: '2026-09-01T00:00:00.000Z',
  ends_at: '2027-02-20T00:00:00.000Z',
  pick_lock_minutes: 10,
  hide_unresolved_future_weeks: false,
  visible_week_window: null,
  require_finalized_schedule: true,
} satisfies NflSeason;

function game(overrides: Partial<NflGame> = {}): NflGame {
  return {
    id: 'game-1',
    season_id: season.id,
    week_id: 'week-1',
    away_team_id: 'away',
    home_team_id: 'home',
    kickoff_at: '2026-09-10T00:00:00.000Z',
    status: 'scheduled',
    away_score: null,
    home_score: null,
    winner_team_id: null,
    ...overrides,
  };
}

function week(number: number, status: NflWeek['status']): NflWeek {
  return {
    id: `week-${number}`,
    season_id: season.id,
    week_number: number,
    label: `Week ${number}`,
    starts_at: `2026-09-${String(number).padStart(2, '0')}T00:00:00.000Z`,
    ends_at: `2026-09-${String(number + 1).padStart(2, '0')}T00:00:00.000Z`,
    status,
    featured_game_id: null,
  };
}

describe('NFL Pick’em rules', () => {
  it('freezes the whole card at the configured offset before first kickoff', () => {
    const games = [
      game({ id: 'late', kickoff_at: '2026-09-10T03:00:00.000Z' }),
      game({ id: 'early', kickoff_at: '2026-09-10T00:00:00.000Z' }),
    ];

    expect(weekLockAt(games, season)?.toISOString()).toBe('2026-09-09T23:50:00.000Z');
    expect(isWeekLocked(games, season, Date.parse('2026-09-09T23:49:59.999Z'))).toBe(false);
    expect(isWeekLocked(games, season, Date.parse('2026-09-09T23:50:00.000Z'))).toBe(true);
  });

  it('locks defensively as soon as a game is reported live', () => {
    expect(isWeekLocked([game({ status: 'live' })], season, Date.parse('2026-09-01T00:00:00.000Z'))).toBe(true);
  });

  it('preserves a scored status instead of regressing to awaiting final', () => {
    const final = game({ status: 'final', winner_team_id: 'home', home_score: 24, away_score: 17 });
    expect(deriveWeekStatus([final], 'scored', Date.parse('2026-09-11T00:00:00.000Z'))).toBe('scored');
    expect(deriveWeekStatus([final], 'closed', Date.parse('2026-09-11T00:00:00.000Z'))).toBe('closed');
  });

  it('derives open and in-progress states from kickoff and provider status', () => {
    const beforeKickoff = Date.parse('2026-09-09T20:00:00.000Z');
    expect(deriveWeekStatus([game()], 'upcoming', beforeKickoff)).toBe('open');
    expect(deriveWeekStatus([game({ status: 'live' })], 'open', beforeKickoff)).toBe('partially_locked');
  });

  it('honors finalized-schedule and visible-window controls', () => {
    const weeks = [week(1, 'scored'), week(2, 'open'), week(3, 'upcoming')];
    const configured = { ...season, visible_week_window: 1 };
    expect(filterVisibleWeeks(weeks, configured, { 'week-1': 16, 'week-2': 16, 'week-3': 0 }, false).map((item) => item.week_number))
      .toEqual([1, 2]);
    expect(filterVisibleWeeks(weeks, configured, {}, true)).toEqual(weeks);
  });
});
