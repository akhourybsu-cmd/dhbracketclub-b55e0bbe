import type { DeepClaimLogEntry } from './types';

export const DEEP_CLAIM_ACTIVITY_CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'mine', label: 'Mine' },
  { key: 'crew', label: 'Crew' },
  { key: 'workshop', label: 'Workshop' },
  { key: 'company', label: 'Company' },
  { key: 'trade', label: 'Trade' },
] as const;

export type DeepClaimActivityCategory = typeof DEEP_CLAIM_ACTIVITY_CATEGORIES[number]['key'];
export type DeepClaimActivityArt = 'office' | 'pickaxe' | 'cargo' | 'worker' | 'research' | 'contract' | 'milestone' | 'production' | 'survey' | 'record';
interface ActivityPresentation {
  category: Exclude<DeepClaimActivityCategory, 'all'> | 'other';
  label: string;
  art: DeepClaimActivityArt;
}

/** Presentation only: kinds are server receipts, never evidence for extra rewards. */
const ACTIVITY: Readonly<Record<string, ActivityPresentation>> = {
  founded: { category: 'company', label: 'Founded', art: 'office' },
  dispatched: { category: 'mine', label: 'Dispatched', art: 'pickaxe' },
  haul_ready: { category: 'mine', label: 'Haul ready', art: 'cargo' },
  collected: { category: 'mine', label: 'Stored', art: 'cargo' },
  sold: { category: 'trade', label: 'Sale', art: 'contract' },
  upgraded: { category: 'company', label: 'Building', art: 'office' },
  hired: { category: 'crew', label: 'Hired', art: 'worker' },
  trained: { category: 'crew', label: 'Training', art: 'research' },
  equipped: { category: 'crew', label: 'Gear', art: 'pickaxe' },
  repaired: { category: 'crew', label: 'Repair', art: 'pickaxe' },
  retired: { category: 'crew', label: 'Retired', art: 'pickaxe' },
  production_started: { category: 'workshop', label: 'Queued', art: 'production' },
  production_ready: { category: 'workshop', label: 'Production ready', art: 'production' },
  production_collected: { category: 'workshop', label: 'Stored', art: 'production' },
  field_return: { category: 'mine', label: 'Field return', art: 'survey' },
  find_resolved: { category: 'mine', label: 'Discovery', art: 'survey' },
  research_started: { category: 'company', label: 'Research started', art: 'research' },
  research_completed: { category: 'company', label: 'Research complete', art: 'research' },
  contract_completed: { category: 'trade', label: 'Delivered', art: 'contract' },
  milestone_claimed: { category: 'company', label: 'Milestone', art: 'milestone' },
};
const UNKNOWN_ACTIVITY: ActivityPresentation = { category: 'other', label: 'Record', art: 'record' };

export function activityPresentation(kind: string): Readonly<ActivityPresentation> {
  return Object.prototype.hasOwnProperty.call(ACTIVITY, kind) ? ACTIVITY[kind] : UNKNOWN_ACTIVITY;
}

/** Do not reorder the authoritative snapshot. Equal timestamps use a stable ID tie-break. */
export function orderCompanyActivity(entries: readonly DeepClaimLogEntry[]): DeepClaimLogEntry[] {
  return [...entries].sort((left, right) => {
    const byTime = Date.parse(right.created_at) - Date.parse(left.created_at);
    return byTime || (left.id < right.id ? 1 : left.id > right.id ? -1 : 0);
  });
}

export function activityDateFormatter(timezone: string | undefined): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' };
  try { return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone ?? 'UTC' }); }
  catch { return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }); }
}
