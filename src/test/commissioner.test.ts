import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COMMISSIONER_MUTATION_ERROR, deriveCommissionerInbox, deriveCommissionerParticipation,
  deriveCommissionerPoints, deriveCommissionerReadiness, fetchCommissionerPresets, fetchCommissionerPlan,
  fetchCommissionerWorkspace, mutateCommissioner, previewPointAdjustment, previewSeasonRemoval,
} from '@/lib/draft/commissioner';
import { commissionerFixture } from './fixtures/commissionerWorkspace';

const wire = vi.hoisted(() => ({
  client: { from: vi.fn(), rpc: vi.fn() },
  rows: {} as Record<string, Record<string, unknown>[]>,
  calls: [] as { table: string; filters: [string, unknown][]; selected: string }[],
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: wire.client }));
type Response = { data: unknown; error: unknown };
class Query implements PromiseLike<Response> {
  private filters: [string, unknown][] = [];
  private from = 0;
  private to = Infinity;
  private single = false;
  private selected = '';
  constructor(private table: string) {}
  select(columns: string) { this.selected = columns; return this; }
  eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
  in(column: string, values: unknown[]) { this.filters.push([column, values]); return this; }
  order() { return this; }
  range(from: number, to: number) { this.from = from; this.to = to; return this; }
  maybeSingle() { this.single = true; return this; }
  then<T = Response, E = never>(resolve?: ((value: Response) => T | PromiseLike<T>) | null, reject?: ((error: unknown) => E | PromiseLike<E>) | null): PromiseLike<T | E> {
    wire.calls.push({ table: this.table, filters: this.filters, selected: this.selected });
    const rows = (wire.rows[this.table] ?? []).filter(row => this.filters.every(([key, value]) => Array.isArray(value) ? value.includes(row[key]) : row[key] === value)).slice(this.from, this.to + 1);
    return Promise.resolve({ data: this.single ? rows[0] ?? null : rows, error: null }).then(resolve, reject);
  }
}
beforeEach(() => {
  vi.resetAllMocks(); wire.calls = []; wire.rows = {};
  wire.client.from.mockImplementation((table: string) => new Query(table));
  wire.client.rpc.mockImplementation(function (this: unknown, name: string) {
    if (this !== wire.client) throw new Error('RPC receiver was lost');
    return Promise.resolve({ data: name === 'draft_commissioner_workspace' ? { plans: [], presets: [], adjustments: [], audit: [], reminders: [] } : { ok: true, record: null, audit_id: 'audit-1' }, error: null });
  });
});

describe('commissioner points explanations and previews', () => {
  it('explains best-of placement points separately from DH awards, uses stable drop selection and active signed ledger entries', () => {
    const data = commissionerFixture();
    data.adjustments.push({ ...data.adjustments[0], id: 'revoked', delta: 99, revoked_at: '2026-10-06' });
    const a = deriveCommissionerPoints(data).find(row => row.userId === 'a')!;
    expect(a.basePoints).toBe(17); expect(a.adjustmentPoints).toBe(-2); expect(a.projectedPoints).toBe(15);
    expect(a.pointsDelta).toBe(0); expect(a.counted.map(row => row.draftId)).toEqual(['d1', 'd2']);
    expect(a.dropped.map(row => row.draftId)).toEqual(['d3']);
    expect(a.counted[0]).toMatchObject({ placementPoints: 10, dhPoints: 50, counted: true });
    expect(a.wins).toBe(1); expect(a.podiums).toBe(3); expect(a.averageFinish).toBe(1.67);
    expect(deriveCommissionerPoints(data).map(row => row.userId)).not.toContain('outsider');
  });

  it('ignores playoff results and invisible identities without manufacturing a public player', () => {
    const data = commissionerFixture();
    data.entries[2].is_playoff = true;
    data.profiles = data.profiles.filter(profile => profile.id !== 'b');
    const rows = deriveCommissionerPoints(data);
    expect(rows).toHaveLength(1); expect(rows[0].draftsPlayed).toBe(2);
    expect(previewSeasonRemoval(data, 'd3')).toEqual([]);
  });

  it('previews the replacement best-of result and authoritative point-only rank plus full tiebreak seed effects', () => {
    const data = commissionerFixture();
    const impact = previewSeasonRemoval(data, 'd1').find(row => row.userId === 'a')!;
    expect(impact).toMatchObject({ before: 15, after: 12, delta: -3, rowRemoved: false, beforeSeed: 2, afterSeed: 2 });
    const adjustment = previewPointAdjustment(data, 'a', 6)!;
    expect(adjustment).toMatchObject({ before: 15, after: 21, delta: 6, beforeSeed: 2, afterSeed: 1, afterRank: 1 });
    expect(data.adjustments).toHaveLength(1);
  });

  it('shows removal from standings after the last eligible result while retaining the independent ledger', () => {
    const data = commissionerFixture();
    data.entries = data.entries.slice(0, 1);
    const impact = previewSeasonRemoval(data, 'd1').find(row => row.userId === 'a')!;
    expect(impact).toMatchObject({ before: 8, after: null, delta: -8, rowRemoved: true, afterSeed: null, afterRank: null });
    const after = deriveCommissionerPoints({ ...data, entries: [] }).find(row => row.userId === 'a')!;
    expect(after.adjustmentPoints).toBe(0); expect(after.projectedPoints).toBe(0);
    expect(data.adjustments[0].revoked_at).toBeNull();
  });

  it('preserves locked playoff ranks and seeds while showing signed adjustment effects', () => {
    const data = commissionerFixture(); data.season.status = 'playoffs';
    expect(previewPointAdjustment(data, 'a', -100)).toMatchObject({ before: 15, after: -85, afterSeed: 2, afterRank: 2, seedsLocked: true });
    expect(previewPointAdjustment(data, 'a', 0)).toBeNull();
    expect(previewPointAdjustment(data, 'a', 1.5)).toBeNull();
    expect(previewPointAdjustment(data, 'a', 101)).toBeNull();
  });
});

describe('commissioner action and participation derivation', () => {
  it('finds report gaps and pending disputes while respecting real saved snake progress, skips and paused clocks', () => {
    const data = commissionerFixture();
    data.results = data.results.filter(result => result.draft_id !== 'd3');
    data.disputes = [{ id: 'q1', draft_id: 'd1', pick_id: 'pick-d1-a', user_id: 'a', status: 'pending', reason: 'Review this rating', created_at: '2026-10-06', resolved_at: null, commissioner_rationale: null, resolution: null }];
    const draft = data.drafts[1]; draft.status = 'in_progress'; draft.current_pick_user_id = 'a'; draft.is_live = true; draft.pick_deadline_at = '2026-10-01T12:00:00Z';
    data.picks = data.picks.filter(pick => pick.draft_id !== 'd2');
    data.skips = [{ id: 'skip1', draft_id: 'd2', user_id: 'a', pick_number: 1, round: 1, created_at: '2026-10-01' }];
    data.matches = [{ id: 'm1', season_id: 's1', round: 'sf', match_number: 1, seed_a: 1, seed_b: 2, user_a: 'a', user_b: 'b', draft_id: null, winner_user_id: null, status: 'awaiting_topic', topic_picker_user_id: 'b' }];
    const items = deriveCommissionerInbox(data, Date.parse('2026-10-07'));
    expect(items.map(item => item.kind).sort()).toEqual(['dispute', 'playoff_topic', 'report', 'stalled_turn']);
    expect(items.find(item => item.kind === 'stalled_turn')).toMatchObject({ userId: 'b', href: '/drafts/live/d2' });
    draft.clock_paused_at = '2026-10-01';
    expect(deriveCommissionerInbox(data, Date.parse('2026-10-07')).some(item => item.kind === 'stalled_turn')).toBe(false);
  });

  it('reports actual skips and eligible missed events without inventing absences for outsiders or late members', () => {
    const data = commissionerFixture();
    data.participants = data.participants.filter(row => row.id !== 'd3-a');
    data.skips = [{ id: 'skip1', draft_id: 'd2', user_id: 'a', pick_number: 1, round: 1, created_at: '2026-10-01' }];
    const rows = deriveCommissionerParticipation(data);
    expect(rows.find(row => row.userId === 'a')).toMatchObject({ joined: 2, completed: 2, skipped: 1, missed: 1, participationRate: 66.67 });
    expect(rows.some(row => row.userId === 'outsider')).toBe(false);
    data.members.find(row => row.user_id === 'a')!.joined_at = '2026-10-10';
    expect(deriveCommissionerParticipation(data).find(row => row.userId === 'a')!.missed).toBe(0);
  });

  it('mirrors existing playoff completion/qualifier conditions and separately counts full report verification', () => {
    const data = commissionerFixture();
    expect(deriveCommissionerReadiness(data)).toMatchObject({ readyForPlayoffs: true, verifiedReports: 3, completedDrafts: 3, rosterSize: 2 });
    data.results.pop();
    expect(deriveCommissionerReadiness(data)).toMatchObject({ readyForPlayoffs: true, verifiedReports: 2 });
    data.drafts[0].status = 'setup';
    expect(deriveCommissionerReadiness(data)).toMatchObject({ readyForPlayoffs: false, remainingDrafts: 1 });
  });
});

describe('commissioner authenticated services', () => {
  it('keeps the real Supabase RPC receiver and exact reason/request identity for idempotent retries', async () => {
    await expect(mutateCommissioner('s1', 'add_adjustment', { user_id: 'a', delta: 2 }, '  Correct ruling  ', 'request-1')).resolves.toMatchObject({ ok: true });
    expect(wire.client.rpc).toHaveBeenCalledWith('draft_commissioner_mutate', { p_season_id: 's1', p_action: 'add_adjustment', p_payload: { user_id: 'a', delta: 2 }, p_reason: 'Correct ruling', p_request_id: 'request-1' });
  });

  it.each([
    [{ code: 'P0001', message: 'A reminder was already sent recently. Try again later' }, 'A reminder was already sent recently. Try again later.'],
    [{ code: 'P0001', message: 'Season rules are locked' }, 'Season rules are locked.'],
    [{ code: 'P0001', message: 'Plan changed. Reload before saving' }, 'Plan changed. Reload before saving.'],
    [{ code: 'P0001', message: 'private actor UUID or SQL details' }, COMMISSIONER_MUTATION_ERROR],
    [{ code: '23514', message: 'private constraint values' }, COMMISSIONER_MUTATION_ERROR],
  ])('exposes only curated business messages (%j)', async (error, message) => {
    wire.client.rpc.mockResolvedValueOnce({ data: null, error });
    await expect(mutateCommissioner('s1', 'send_reminder', {}, 'Valid reason')).rejects.toThrow(message);
  });

  it('rejects invalid rationale before sending any request', async () => {
    await expect(mutateCommissioner('s1', 'add_adjustment', {}, ' x ')).rejects.toThrow('between 3 and 1,000');
    expect(wire.client.rpc).not.toHaveBeenCalled();
  });

  it('pages club-scoped presets without loading a private commissioner snapshot', async () => {
    wire.rows.draft_commissioner_presets = Array.from({ length: 1001 }, (_, index) => ({ id: `p${index}`, club_id: 'club-1', season_id: 's1', name: `Preset ${index}` }));
    expect(await fetchCommissionerPresets('club-1', 's1')).toHaveLength(1001);
    expect(wire.calls).toHaveLength(2);
    expect(wire.calls.every(call => call.filters.some(([key, value]) => key === 'club_id' && value === 'club-1'))).toBe(true);
    expect(wire.client.rpc).not.toHaveBeenCalled();
  });

  it('loads only explicit club/season public data, honors profile visibility and never queries private desks', async () => {
    const data = commissionerFixture();
    const scoped = (rows: unknown[]) => rows.map(row => ({ ...(row as Record<string, unknown>), club_id: 'club-1' }));
    wire.rows = { draft_seasons: scoped([data.season]), draft_season_standings: scoped(data.standings), draft_season_entries: scoped(data.entries), draft_playoff_matches: [], club_members: scoped(data.members), drafts: scoped(data.drafts), draft_participants: scoped(data.participants), draft_picks: scoped(data.picks), draft_results: scoped(data.results), draft_pick_disputes: [], draft_skips: [], profiles: data.profiles.filter(profile => profile.id !== 'b').map(profile => ({ ...profile })) };
    const result = await fetchCommissionerWorkspace('club-1', 's1');
    expect(result.results.every(row => row.user_id !== 'b')).toBe(true);
    expect(result.participants.every(row => row.user_id !== 'b')).toBe(true);
    expect(wire.calls.every(call => call.table === 'profiles' || call.filters.some(([key, value]) => key === 'club_id' && value === 'club-1'))).toBe(true);
    expect(wire.calls.some(call => call.table.includes('desk'))).toBe(false);
    expect(wire.client.rpc).toHaveBeenCalledWith('draft_commissioner_workspace', { p_season_id: 's1' });
  });

  it('reads one explicit plan only within the requested club and season', async () => {
    wire.rows.draft_commissioner_plans = [{ id: 'plan-1', season_id: 's1', club_id: 'club-1', topic: 'Planned event' }];
    await expect(fetchCommissionerPlan('club-1', 's1', 'plan-1')).resolves.toMatchObject({ id: 'plan-1' });
    await expect(fetchCommissionerPlan('club-2', 's1', 'plan-1')).resolves.toBeNull();
    await expect(fetchCommissionerPlan('club-1', 'another-season', 'plan-1')).resolves.toBeNull();
    expect(wire.client.rpc).not.toHaveBeenCalled();
  });
});
