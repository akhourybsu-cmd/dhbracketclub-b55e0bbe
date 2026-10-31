/* eslint-disable @typescript-eslint/no-explicit-any -- Browser-local transport mirrors heterogeneous RPC records. */
// The production service and UI stay intact. Only server transport is local.
type Row = Record<string, any>;
export const commissionerTables = {
  plans: 'draft_commissioner_plans', presets: 'draft_commissioner_presets',
  adjustments: 'draft_commissioner_adjustments', audit: 'draft_commissioner_audit',
  reminders: 'draft_commissioner_reminders',
};

export function createCommissionerFixture(tables: Record<string, Row[]>, userId: string,
  commit: (table: string, mode: string, rows: Row[]) => void) {
  const clone = <T,>(value: T): T => structuredClone(value);
  const seasonRows = (table: string, seasonId: string) => (tables[table] || []).filter((row) => row.season_id === seasonId);
  const allowed = (seasonId: string) => tables.draft_seasons.some((row) => row.id === seasonId && row.commissioner_user_id === userId && row.club_id === 'club');
  const error = (message: string, code = 'P0001') => ({ data: null, error: { message, code } });

  function recalculate(seasonId: string) {
    const season = tables.draft_seasons.find((row) => row.id === seasonId);
    const ids = new Set(seasonRows('draft_season_entries', seasonId).filter((row) => !row.is_playoff).map((row) => row.draft_id));
    const results = tables.draft_results.filter((row) => ids.has(row.draft_id));
    const adjustments = seasonRows(commissionerTables.adjustments, seasonId).filter((row) => !row.revoked_at);
    const points = (rank: number) => ({ 1: 10, 2: 7, 3: 5, 4: 3, 5: 2 }[rank] || 1);
    for (const standing of seasonRows('draft_season_standings', seasonId)) {
      const base = results.filter((row) => row.user_id === standing.user_id).map((row) => points(row.rank)).sort((a, b) => b - a).slice(0, season?.best_of || 10).reduce((sum, value) => sum + value, 0);
      standing.season_points = base + adjustments.filter((row) => row.user_id === standing.user_id).reduce((sum, row) => sum + row.delta, 0);
    }
    const standings = seasonRows('draft_season_standings', seasonId).sort((a, b) => b.season_points - a.season_points || b.wins - a.wins || b.podiums - a.podiums || a.avg_finish - b.avg_finish || b.avg_score - a.avg_score);
    if (!['playoffs', 'complete'].includes(season?.status)) standings.forEach((row, index) => { row.rank = index + 1; row.playoff_seed = index + 1; });
    commit('draft_season_standings', 'update', standings);
  }

  return {
    handles: (name: string) => name.startsWith('draft_commissioner_') || name === 'recalculate_draft_season_standings',
    async rpc(name: string, args: Row) {
      const seasonId = args.p_season_id;
      if (name === 'draft_commissioner_can_manage') return { data: allowed(seasonId), error: null };
      if (name === 'recalculate_draft_season_standings') {
        if (!tables.club_members.some((row) => row.club_id === 'club' && row.user_id === userId)) return error('Season unavailable.', '42501');
        recalculate(seasonId); return { data: null, error: null };
      }
      if (!allowed(seasonId)) return error('Commissioner access is required for this season.', '42501');
      if (name === 'draft_commissioner_workspace') return {
        data: Object.fromEntries(Object.entries(commissionerTables).map(([key, table]) => [key, clone(seasonRows(table, seasonId)).reverse()])), error: null,
      };
      if (name !== 'draft_commissioner_mutate') return error('Unknown commissioner RPC.');
      const { p_action: action, p_payload: payload, p_reason: reason, p_request_id: requestId } = args;
      if (!reason?.trim() || reason.trim().length < 3 || !requestId || !payload) return error('A reason and request identity are required.');
      const previous = (tables[commissionerTables.audit] || []).find((row) => row.request_id === requestId);
      if (previous) return { data: { ok: true, record: clone(previous.after_data), audit_id: previous.id }, error: null };
      const now = new Date().toISOString();
      const base = { season_id: seasonId, club_id: 'club', created_by: userId, created_at: now };
      let record: Row | null = null, before: Row | null = null;
      const changed: { table: string; mode: string; rows: Row[] }[] = [];
      const store = (table: string, value: Row) => { (tables[table] ||= []).push(value); changed.push({ table, mode: 'insert', rows: [value] }); return value; };
      if (action === 'add_adjustment') {
        if (!Number.isInteger(payload.delta) || payload.delta === 0 || Math.abs(payload.delta) > 100 || !tables.profiles.some((row) => row.id === payload.user_id)) return error('Invalid adjustment.');
        record = store(commissionerTables.adjustments, { ...base, id: crypto.randomUUID(), user_id: payload.user_id, delta: payload.delta, reason, revoked_at: null, revoked_by: null, revocation_reason: null });
        recalculate(seasonId);
      } else if (action === 'revoke_adjustment') {
        record = seasonRows(commissionerTables.adjustments, seasonId).find((row) => row.id === payload.id) || null;
        if (!record) return error('Adjustment not found.');
        before = clone(record); Object.assign(record, { revoked_at: now, revoked_by: userId, revocation_reason: reason });
        changed.push({ table: commissionerTables.adjustments, mode: 'update', rows: [record] }); recalculate(seasonId);
      } else if (action === 'upsert_plan' || action === 'upsert_preset') {
        const table = action === 'upsert_plan' ? commissionerTables.plans : commissionerTables.presets;
        const existing = payload.id ? seasonRows(table, seasonId).find((row) => row.id === payload.id) : null;
        if (payload.id && !existing) return error('Record not found.');
        if (existing && payload.expected_version !== existing.version) return error('This record changed on another device.', '40001');
        const { expected_version: _expected, ...fields } = payload;
        if (existing) {
          before = clone(existing); Object.assign(existing, clone(fields), { version: existing.version + 1, updated_by: userId, updated_at: now }); record = existing;
          changed.push({ table, mode: 'update', rows: [existing] });
        } else record = store(table, { ...base, ...(action === 'upsert_plan' ? { notes: '', ai_context: '', scheduled_at: null, due_at: null, draft_id: null, preset_id: null, status: 'planned' } : {}), ...clone(fields), id: crypto.randomUUID(), version: 1, updated_by: userId, updated_at: now });
      } else if (action === 'delete_plan' || action === 'delete_preset') {
        const table = action === 'delete_plan' ? commissionerTables.plans : commissionerTables.presets;
        const existing = seasonRows(table, seasonId).find((row) => row.id === payload.id);
        if (!existing) return error('Record not found.');
        if (payload.expected_version !== existing.version) return error('This record changed on another device.', '40001');
        before = clone(existing); tables[table] = tables[table].filter((row) => row.id !== payload.id); changed.push({ table, mode: 'delete', rows: [existing] });
      } else if (action === 'send_reminder') {
        if (!tables.profiles.some((row) => row.id === payload.target_user_id)) return error('Reminder target not found.');
        if (payload.kind === 'pick' && !tables.drafts.some((row) => row.id === payload.draft_id && row.status === 'in_progress' && row.current_pick_user_id === payload.target_user_id)) return error('The current picker changed.');
        const plan = payload.kind === 'plan' ? seasonRows(commissionerTables.plans, seasonId).find((row) => row.id === payload.plan_id && ['planned', 'ready'].includes(row.status)) : null;
        if (payload.kind === 'plan' && !plan) return error('Scheduled season recipient unavailable.');
        if (seasonRows(commissionerTables.reminders, seasonId).some((row) => row.kind === payload.kind && row.target_user_id === payload.target_user_id && row.draft_id === (payload.draft_id || null) && row.plan_id === (payload.plan_id || null) && Date.parse(row.created_at) > Date.now() - 3_600_000)) return error('A reminder was already sent recently. Try again later.');
        const live = tables.drafts.find((row) => row.id === payload.draft_id)?.is_live;
        const notification = store('notifications', { id: crypto.randomUUID(), user_id: payload.target_user_id, club_id: 'club', type: 'draft', title: payload.kind === 'plan' ? `Upcoming draft: ${plan?.topic}` : 'Your draft pick is waiting', body: reason, url: payload.draft_id ? `/drafts/${live ? 'live/' : ''}${payload.draft_id}` : '/drafts?tab=season', actor_user_id: userId, created_at: now, read_at: null });
        record = store(commissionerTables.reminders, { ...base, id: crypto.randomUUID(), target_user_id: payload.target_user_id, draft_id: payload.draft_id || null, match_id: payload.match_id || null, plan_id: payload.plan_id || null, kind: payload.kind, notification_id: notification.id });
      } else return error(`Unsupported fixture action: ${action}`);
      const audit = store(commissionerTables.audit, { id: crypto.randomUUID(), season_id: seasonId, club_id: 'club', actor_user_id: userId, action, reason, before_data: clone(before), after_data: clone(record), request_id: requestId, created_at: now });
      for (const change of changed) commit(change.table, change.mode, change.rows);
      return { data: { ok: true, record: clone(record), audit_id: audit.id }, error: null };
    },
  };
}
