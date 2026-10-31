import type { CommissionerWorkspaceData } from '@/lib/draft/commissioner';

export function commissionerFixture(): CommissionerWorkspaceData {
  const profiles = ['a', 'b', 'outsider'].map(id => ({ id, display_name: `Player ${id}`, avatar_url: null }));
  const drafts = [1, 2, 3].map(n => ({ id: `d${n}`, topic: `Topic ${n}`, status: 'complete', num_rounds: 1, is_live: false, created_at: `2026-10-0${n}T12:00:00Z`, updated_at: `2026-10-0${n}T13:00:00Z`, current_pick_user_id: null, current_pick_number: 3, pick_deadline_at: null, clock_started_at: null, clock_paused_at: null }));
  const participants = drafts.flatMap(draft => ['a', 'b'].map((user_id, index) => ({ id: `${draft.id}-${user_id}`, draft_id: draft.id, user_id, pick_order: index + 1 })));
  const picks = participants.map(row => ({ id: `pick-${row.id}`, draft_id: row.draft_id, user_id: row.user_id, pick_text: `Choice ${row.id}`, pick_number: row.pick_order, round: 1, picked_at: '2026-10-01T12:10:00Z' }));
  const results = participants.map(row => {
    const rank = (row.draft_id === 'd1' ? row.user_id === 'a' : row.user_id === 'b') ? 1 : 2;
    return { id: `result-${row.id}`, draft_id: row.draft_id, user_id: row.user_id, rank, total_score: rank === 1 ? 9 : 8, points_awarded: rank === 1 ? 50 : 25, created_at: '2026-10-04T12:00:00Z', pick_ratings: [{ pick_id: `pick-${row.id}`, score: rank === 1 ? 9 : 8 }] };
  });
  return {
    season: { id: 's1', name: 'Season One', year: 2026, season_label: 'S1', season_number: 1, subtitle: null, starts_at: '2026-10-01', ends_at: '2026-12-01', status: 'regular_season', regular_season_weeks: 3, regular_season_drafts: 3, playoff_weeks: 2, best_of: 2, commissioner_user_id: 'a' },
    standings: ['b', 'a'].map((user_id, index) => ({ id: `standing-${user_id}`, season_id: 's1', user_id, season_points: user_id === 'a' ? 15 : 20, drafts_played: 3, wins: user_id === 'a' ? 1 : 2, podiums: 3, avg_finish: user_id === 'a' ? 1.67 : 1.33, avg_score: user_id === 'a' ? 8.33 : 8.67, best_score: 9, worst_score: 8, consistency: 0.47, rank: index + 1, playoff_seed: index + 1, is_eliminated: false })),
    entries: drafts.map((draft, index) => ({ id: `entry-${draft.id}`, season_id: 's1', draft_id: draft.id, week_number: index + 1, is_playoff: false, season_points_awarded: {} })),
    drafts, participants, picks, results, profiles, matches: [], disputes: [], plans: [], presets: [], audit: [], reminders: [], skips: [],
    members: profiles.map(profile => ({ user_id: profile.id, joined_at: '2026-01-01T00:00:00Z' })),
    adjustments: [{ id: 'adjustment-a', season_id: 's1', club_id: 'club-1', user_id: 'a', delta: -2, reason: 'League ruling', created_by: 'a', created_at: '2026-10-05', revoked_at: null, revoked_by: null, revocation_reason: null }],
  };
}
