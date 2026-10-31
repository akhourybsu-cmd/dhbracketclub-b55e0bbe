import type { CommissionerAudit, CommissionerWorkspaceData } from '@/lib/draft/commissioner';

const FIELDS: [string, string][] = [
  ['name', 'Name'], ['topic', 'Topic'], ['subtitle', 'Subtitle'], ['status', 'Status'],
  ['delta', 'Point change'], ['user_id', 'Player'], ['target_user_id', 'Recipient'], ['kind', 'Reminder type'],
  ['revoked_at', 'Ledger state'], ['num_rounds', 'Rounds'], ['best_of', 'Best-of results'],
  ['regular_season_drafts', 'Regular draft target'], ['commissioner_user_id', 'Commissioner'],
  ['week_number', 'Draft slot'], ['draft_id', 'Linked draft'], ['notes', 'Planning notes'],
  ['ai_context', 'Judging instructions'], ['is_live', 'LIVE mode'], ['scheduled_at', 'Scheduled start'],
  ['due_at', 'Deadline'], ['commissioner_rationale', 'Rationale'], ['resolution', 'Resolution'],
  ['notification_id', 'In-app notification'],
];
const LIVE_FIELDS: [string, string][] = [['pickSeconds', 'Pick clock (seconds)'], ['timeoutBehavior', 'Clock expiry'], ['ceremony', 'Order ceremony'], ['sound', 'Projector sound'], ['announce', 'Pick announcements'], ['ticker', 'Recent-pick ticker'], ['broadcast', 'Broadcast moments'], ['autoStartClock', 'Automatic pick clock'], ['reportBroadcast', 'Report broadcast']];
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export interface CommissionerSavedChange { label: string; before: string; after: string }

/** Whitelist product fields so audit detail never becomes a raw JSON/identity dump. */
export function commissionerSavedChanges(record: CommissionerAudit, data: Pick<CommissionerWorkspaceData, 'profiles' | 'drafts'>): CommissionerSavedChange[] {
  const before = object(record.before_data), after = object(record.after_data);
  function format(key: string, value: unknown): string {
    if (key === 'revoked_at') return value ? 'Revoked' : 'Active';
    if (value == null || value === '') return '—';
    if (key === 'notification_id') return 'Recorded';
    if (key.endsWith('user_id')) return data.profiles.find(profile => profile.id === value)?.display_name ?? 'Season member';
    if (key === 'draft_id') return data.drafts.find(draft => draft.id === value)?.topic ?? 'Season draft';
    if (typeof value === 'boolean') return value ? 'On' : 'Off';
    if (key.endsWith('_at') && typeof value === 'string') { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Not scheduled'; }
    return typeof value === 'string' ? (['status', 'kind', 'timeoutBehavior'].includes(key) ? value.replace(/_/g, ' ') : value) : typeof value === 'number' ? String(value) : '—';
  }
  const changes: CommissionerSavedChange[] = [];
  function collect(fields: [string,string][], previous: Record<string,unknown>, next: Record<string,unknown>) {
    for (const [key,label] of fields) {
      if (!(key in previous) && !(key in next)) continue;
      if (JSON.stringify(previous[key]) === JSON.stringify(next[key])) continue;
      changes.push({ label, before: key === 'revoked_at' && !Object.keys(previous).length ? '—' : format(key, previous[key]), after: format(key,next[key]) });
    }
  }
  collect(FIELDS,before,after);
  collect(FIELDS,object(before.config),object(after.config));
  collect(LIVE_FIELDS,object(before.live_settings ?? object(before.config).live_settings),object(after.live_settings ?? object(after.config).live_settings));
  return changes;
}
