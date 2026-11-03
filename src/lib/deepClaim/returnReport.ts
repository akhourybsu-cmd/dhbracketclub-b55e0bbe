import { DEEP_CLAIM_RESOURCE_IDS, type DeepClaimDiscovery, type DeepClaimProductionStation, type DeepClaimResources, type DeepClaimSnapshot } from './types';

export interface ReturnReportScope { userId: string; clubId: string; companyId: string }
export interface ReturnReportReceipt {
  version: 1;
  scope: ReturnReportScope;
  baselineAt: string;
  seen: { hauls: string[]; production: string[]; finds: string[]; research: string[] };
}
export type ReturnReportAction = { kind: 'haul'; id: string } | { kind: 'production'; station: DeepClaimProductionStation } | { kind: 'finds' } | { kind: 'research'; key: string };
export interface ReturnReportData {
  scopeKey: string;
  since: string;
  observedAt: string;
  hauls: { id: string; depth: number; resources: DeepClaimResources }[];
  production: { id: string; name: string; station: DeepClaimProductionStation; resources: DeepClaimResources; equipmentOutputs: string[] }[];
  finds: Pick<DeepClaimDiscovery, 'id' | 'name' | 'kind' | 'quality'>[];
  research: { key: string; name: string }[];
}

const LIMIT = 128;
const PREFIX = 'dh:deep-claim:returns:v1:';
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 160;
const validScope = (scope: ReturnReportScope): boolean => !!scope && validId(scope.userId) && validId(scope.clubId) && validId(scope.companyId);
const owns = (scope: ReturnReportScope, snapshot: DeepClaimSnapshot): boolean => validScope(scope) && snapshot.company?.id === scope.companyId && snapshot.company.user_id === scope.userId && snapshot.company.club_id === scope.clubId && Number.isFinite(Date.parse(snapshot.server_now));
const ids = (values: readonly string[]): string[] => [...new Set(values.filter(validId))].slice(-LIMIT);
const resources = (value: DeepClaimResources): DeepClaimResources => Object.fromEntries(DEEP_CLAIM_RESOURCE_IDS.flatMap(key => Number.isSafeInteger(value[key]) && value[key]! > 0 ? [[key, value[key]]] : [])) as DeepClaimResources;

/** Presentation metadata only: never stock, money, rewards or an economic receipt. */
export function returnReportKey(scope: ReturnReportScope): string {
  return `${PREFIX}${[scope.userId, scope.clubId, scope.companyId].map(encodeURIComponent).join(':')}`;
}

function validReceipt(value: unknown): value is ReturnReportReceipt {
  if (!value || typeof value !== 'object') return false;
  const receipt = value as ReturnReportReceipt;
  return receipt.version === 1 && validScope(receipt.scope) && typeof receipt.baselineAt === 'string' && receipt.baselineAt.length <= 64 && Number.isFinite(Date.parse(receipt.baselineAt)) && !!receipt.seen
    && (['hauls', 'production', 'finds', 'research'] as const).every(kind => Array.isArray(receipt.seen[kind]) && receipt.seen[kind].length <= LIMIT && receipt.seen[kind].every(validId));
}

export function readReturnReport(key: string): ReturnReportReceipt | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return key.startsWith(PREFIX) && validReceipt(value) && returnReportKey(value.scope) === key ? value : null;
  } catch { return null; }
}

export function saveReturnReport(key: string, receipt: ReturnReportReceipt): void {
  if (!validReceipt(receipt) || returnReportKey(receipt.scope) !== key) return;
  try { localStorage.setItem(key, JSON.stringify(receipt)); } catch { /* In-memory presentation continues when device storage is unavailable. */ }
}

function visibleIds(snapshot: DeepClaimSnapshot): ReturnReportReceipt['seen'] {
  return {
    hauls: ids(snapshot.expeditions.filter(job => job.status === 'ready').map(job => job.id)),
    production: ids((snapshot.production_jobs ?? []).filter(job => job.status === 'ready').map(job => job.id)),
    finds: ids((snapshot.discoveries ?? []).filter(find => find.status === 'pending').map(find => find.id)),
    research: ids((snapshot.business?.research ?? []).filter(order => order.status === 'completed').map(order => order.key)),
  };
}

/** A first authorized hydration is a quiet baseline, not an invented away session. */
export function acknowledgeReturnReport(previous: ReturnReportReceipt | null, snapshot: DeepClaimSnapshot, scope: ReturnReportScope): ReturnReportReceipt | null {
  if (!owns(scope, snapshot)) return null;
  const validPrevious = validReceipt(previous) && returnReportKey(previous.scope) === returnReportKey(scope) ? previous : null;
  const current = visibleIds(snapshot);
  return { version: 1, scope: { ...scope }, baselineAt: snapshot.server_now, seen: {
    hauls: ids([...(validPrevious?.seen.hauls ?? []), ...current.hauls]),
    production: ids([...(validPrevious?.seen.production ?? []), ...current.production]),
    finds: ids([...(validPrevious?.seen.finds ?? []), ...current.finds]),
    research: ids([...(validPrevious?.seen.research ?? []), ...current.research]),
  } };
}

function report(snapshot: DeepClaimSnapshot, scope: ReturnReportScope, previous: ReturnReportReceipt | null): ReturnReportData | null {
  if (!owns(scope, snapshot)) return null;
  const unseen = (kind: keyof ReturnReportReceipt['seen'], id: string) => !previous?.seen[kind].includes(id);
  const value: ReturnReportData = {
    scopeKey: returnReportKey(scope), since: previous?.baselineAt ?? snapshot.server_now, observedAt: snapshot.server_now,
    hauls: snapshot.expeditions.filter(job => job.status === 'ready' && unseen('hauls', job.id)).slice(0, 64)
      .map(job => ({ id: job.id, depth: job.target.y, resources: resources(job.cargo ?? {}) })),
    production: (snapshot.production_jobs ?? []).filter(job => job.status === 'ready' && unseen('production', job.id)).slice(0, 16)
      .map(job => ({ id: job.id, name: snapshot.recipes?.find(recipe => recipe.key === job.recipe_key)?.name ?? job.recipe_snapshot?.name ?? 'Production order', station: job.station, resources: resources(job.outputs), equipmentOutputs: [...job.equipment_outputs] })),
    finds: (snapshot.discoveries ?? []).filter(find => find.status === 'pending' && unseen('finds', find.id)).slice(0, 48)
      .map(find => ({ id: find.id, name: find.name, kind: find.kind, quality: find.quality })),
    // Status and completion time both come from the backend. An elapsed client
    // clock, active order or historical unobserved record is never completion.
    research: previous ? (snapshot.business?.research ?? []).filter(order => order.status === 'completed' && unseen('research', order.key)
      && !!order.completed_at && Date.parse(order.completed_at) >= Date.parse(previous.baselineAt) && Date.parse(order.completed_at) <= Date.parse(snapshot.server_now)).slice(0, 64)
      .map(order => ({ key: order.key, name: snapshot.business_catalog?.research.find(node => node.key === order.key)?.name ?? 'Research completed' })) : [],
  };
  return value.hauls.length || value.production.length || value.finds.length || value.research.length ? value : null;
}

/** Reading does not acknowledge. The caller can wait until the report is read. */
export function observeReturnReport(previous: ReturnReportReceipt | null, snapshot: DeepClaimSnapshot, scope: ReturnReportScope): { receipt: ReturnReportReceipt | null; report: ReturnReportData | null } {
  if (!owns(scope, snapshot)) return { receipt: null, report: null };
  if (!validReceipt(previous) || returnReportKey(previous.scope) !== returnReportKey(scope)) return { receipt: acknowledgeReturnReport(null, snapshot, scope), report: null };
  return { receipt: previous, report: report(snapshot, scope, previous) };
}

/** Explicit overview: current uncollected work and pending finds, even if seen. */
export function currentReturnReport(snapshot: DeepClaimSnapshot, scope: ReturnReportScope): ReturnReportData | null {
  return report(snapshot, scope, null);
}

export function firstReturnReportAction(value: ReturnReportData): ReturnReportAction | null {
  if (value.hauls.length) return { kind: 'haul', id: value.hauls[0].id };
  if (value.production.length) return { kind: 'production', station: value.production[0].station };
  if (value.finds.length) return { kind: 'finds' };
  if (value.research.length) return { kind: 'research', key: value.research[0].key };
  return null;
}
