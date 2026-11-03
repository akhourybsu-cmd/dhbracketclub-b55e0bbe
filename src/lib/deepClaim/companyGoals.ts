import { BUILDING_INFO, RESOURCE_BY_ID, buildingEffect, resourceQuantity } from './catalog';
import { DEEP_CLAIM_BUILDING_IDS, DEEP_CLAIM_RESOURCE_IDS, type DeepClaimBuildingId, type DeepClaimBusinessMetric, type DeepClaimResourceId, type DeepClaimResources, type DeepClaimSnapshot } from './types';

export type CompanyGoalRef =
  | { kind: 'building'; key: DeepClaimBuildingId; level: number }
  | { kind: 'research'; key: string }
  | { kind: 'contract'; key: string }
  | { kind: 'milestone'; key: string };
export type CompanyGoalState = 'complete' | 'working' | 'ready' | 'locked' | 'saving';
export interface CompanyGoalRequirement {
  key: string;
  label: string;
  current: number;
  target: number;
  kind: 'cash' | 'resource' | 'building' | 'research' | 'contract' | 'metric';
  resourceId?: DeepClaimResourceId;
}
export interface CompanyGoal {
  id: string;
  ref: CompanyGoalRef;
  name: string;
  detail: string;
  state: CompanyGoalState;
  requirements: CompanyGoalRequirement[];
  blockers: string[];
  /** Fraction of requirements actually fulfilled, never elapsed-time progress. */
  progress: number;
  reward?: number;
  completesAt?: string;
}

/** Read a preference as an identity only. All goal facts are reevaluated from the snapshot. */
export function parseCompanyGoalRef(value: unknown): CompanyGoalRef | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(entry, 'kind') || !Object.prototype.hasOwnProperty.call(entry, 'key')) return null;
  if (typeof entry.key !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/.test(entry.key)) return null;
  if (entry.kind === 'building') {
    return Object.keys(entry).length === 3 && Object.prototype.hasOwnProperty.call(entry, 'level') && DEEP_CLAIM_BUILDING_IDS.some(key => key === entry.key)
      && Number.isSafeInteger(entry.level) && Number(entry.level) >= 1 && Number(entry.level) <= 6
      ? { kind: 'building', key: entry.key as DeepClaimBuildingId, level: Number(entry.level) } : null;
  }
  return Object.keys(entry).length === 2 && (entry.kind === 'research' || entry.kind === 'contract' || entry.kind === 'milestone')
    ? { kind: entry.kind, key: entry.key } : null;
}

export function goalRefId(ref: CompanyGoalRef): string {
  return ref.kind === 'building' ? `building:${ref.key}:${ref.level}` : `${ref.kind}:${ref.key}`;
}

const count = (value: number | undefined): number => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
const fulfilled = (item: CompanyGoalRequirement): boolean => item.current >= item.target;
const METRIC_LABELS: Record<DeepClaimBusinessMetric, string> = {
  completed_mining_expeditions: 'Mining shifts completed', completed_surveys: 'Surveys completed', total_surveyed_tiles: 'Tiles surveyed',
  installed_infrastructure: 'Projects installed', max_completed_mining_depth: 'Deepest mining shift', collected_production_batches: 'Production batches collected',
  collected_processed_units: 'Processed units collected', completed_research: 'Research completed', completed_contracts: 'Contracts delivered',
  total_contract_credits: 'Contract credits earned', kept_discoveries: 'Specimens kept',
};
function milestoneDetail(metric: DeepClaimBusinessMetric, target: number): string {
  const amount = target.toLocaleString(), plural = target === 1 ? '' : 's';
  const details: Record<DeepClaimBusinessMetric, string> = {
    completed_mining_expeditions: `Complete ${amount} mining shift${plural}`,
    completed_surveys: `Complete ${amount} survey${plural}`,
    total_surveyed_tiles: `Survey ${amount} tile${plural}`,
    installed_infrastructure: `Install ${amount} project${plural}`,
    max_completed_mining_depth: `Complete a mining shift at ${amount}m`,
    collected_production_batches: `Collect ${amount} production ${target === 1 ? 'batch' : 'batches'}`,
    collected_processed_units: `Collect ${amount} processed unit${plural}`,
    completed_research: `Complete ${amount} research project${plural}`,
    completed_contracts: `Deliver ${amount} contract${plural}`,
    total_contract_credits: `Earn ${amount} credits from contracts`,
    kept_discoveries: `Keep ${amount} specimen${plural}`,
  };
  return details[metric];
}
function result(ref: CompanyGoalRef, name: string, detail: string, state: CompanyGoalState, requirements: CompanyGoalRequirement[], blockers: string[], extra: Pick<CompanyGoal, 'reward' | 'completesAt'> = {}): CompanyGoal {
  return {
    id: goalRefId(ref), ref: { ...ref }, name, detail, state,
    requirements, blockers,
    progress: requirements.length ? requirements.filter(fulfilled).length / requirements.length : 0,
    ...extra,
  };
}

/** A presentation of existing paid actions and recorded achievements. It never authorizes one. */
export function evaluateCompanyGoal(snapshot: DeepClaimSnapshot, input: CompanyGoalRef): CompanyGoal | null {
  const ref = parseCompanyGoalRef(input);
  if (!ref || !snapshot.company) return null;
  const requirements: CompanyGoalRequirement[] = [];
  const blockers: string[] = [];
  let locked = false;
  const catalog = snapshot.business_catalog, business = snapshot.business;
  const completedResearch = new Set(business?.research.filter(item => item.status === 'completed').map(item => item.key));
  const completedContracts = new Set(business?.contracts.filter(item => item.status === 'completed').map(item => item.key));
  function addRequirement(item: CompanyGoalRequirement, blocker: string, hard = false) {
    requirements.push(item);
    if (!fulfilled(item)) { blockers.push(blocker); locked ||= hard; }
  }
  function money(cost: number) {
    addRequirement({ key: 'cash', label: 'Credits · includes 2 cr reserve', kind: 'cash', current: count(snapshot.company?.cash), target: cost + 2 }, 'Keep 2 credits for operating reserve after paying the cost.');
  }
  function materials(inputs: DeepClaimResources) {
    for (const resourceId of DEEP_CLAIM_RESOURCE_IDS) {
      const target = count(inputs[resourceId]);
      if (target > 0) addRequirement({ key: `resource:${resourceId}`, label: RESOURCE_BY_ID[resourceId].name, kind: 'resource', resourceId, current: count(resourceQuantity(snapshot.resources, resourceId)), target }, `Need ${target} ${RESOURCE_BY_ID[resourceId].name} in collected stock.`);
    }
  }
  function building(key: DeepClaimBuildingId, target: number) {
    addRequirement({ key: `building:${key}`, label: `${BUILDING_INFO[key].name} level`, kind: 'building', current: count(snapshot.buildings.find(item => item.key === key)?.level), target }, `${BUILDING_INFO[key].name} level ${target} is required.`, true);
  }
  function research(keys: readonly string[]) {
    for (const key of keys) {
      const label = catalog?.research.find(item => item.key === key)?.name ?? key;
      addRequirement({ key: `research:${key}`, label, kind: 'research', current: completedResearch.has(key) ? 1 : 0, target: 1 }, `Complete ${label} first.`, true);
    }
  }
  function reportRequired() {
    if (!business) { blockers.push('Refresh the company development report.'); locked = true; }
  }
  const pendingState = (): CompanyGoalState => locked ? 'locked' : blockers.length ? 'saving' : 'ready';

  if (ref.kind === 'building') {
    const owned = snapshot.buildings.find(item => item.key === ref.key);
    if (!owned || ref.level > owned.max_level || ref.level > owned.level + 1) return null;
    let detail: string;
    try { detail = buildingEffect(ref.key, ref.level); } catch { return null; }
    const name = `${BUILDING_INFO[ref.key].name} · Lv ${ref.level}`;
    if (owned.level >= ref.level) return result(ref, name, detail, 'complete', [{ key: `building:${ref.key}`, label: `${BUILDING_INFO[ref.key].name} level`, kind: 'building', current: owned.level, target: ref.level }], []);
    // Only the next level has a published server price. Never price a future target locally.
    if (!Number.isSafeInteger(owned.upgrade_cost) || Number(owned.upgrade_cost) < 0) return null;
    money(Number(owned.upgrade_cost));
    if (snapshot.schema_version === 5 && snapshot.deep_catalog && ref.key === 'mine_shaft' && ref.level === snapshot.deep_catalog.shaft.max_level) {
      reportRequired(); research(snapshot.deep_catalog.shaft.required_research);
    }
    return result(ref, name, detail, pendingState(), requirements, blockers);
  }

  if (ref.kind === 'research') {
    const node = catalog?.research.find(item => item.key === ref.key);
    if (!node) return null;
    const completion = { key: `research:${node.key}`, label: node.name, kind: 'research' as const, current: completedResearch.has(node.key) ? 1 : 0, target: 1 };
    if (completedResearch.has(node.key)) return result(ref, node.name, node.description, 'complete', [completion], []);
    const order = business?.research.find(item => item.key === node.key && item.status === 'active');
    if (order) return result(ref, node.name, node.description, 'working', [completion], [], { completesAt: order.completes_at });
    reportRequired(); building('research_office', node.required_building_level); research(node.requires);
    const freeSlot = !!business && !business.research.some(item => item.status === 'active');
    addRequirement({ key: 'research:slot', label: 'Research slot free', kind: 'research', current: freeSlot ? 1 : 0, target: 1 }, business ? 'One research project can run at a time.' : 'Refresh to check the research slot.', true);
    money(node.cash_cost); materials(node.inputs);
    return result(ref, node.name, node.description, pendingState(), requirements, blockers);
  }

  if (ref.kind === 'contract') {
    const order = catalog?.contracts.find(item => item.key === ref.key);
    if (!order) return null;
    const detail = `${order.reward.toLocaleString()} cr for a complete delivery`;
    if (completedContracts.has(order.key)) return result(ref, order.name, detail, 'complete', [{ key: `contract:${order.key}`, label: 'Delivery recorded', kind: 'contract', current: 1, target: 1 }], [], { reward: order.reward });
    reportRequired(); building('trading_post', order.tier);
    for (const key of order.requires_contracts) {
      const label = catalog?.contracts.find(item => item.key === key)?.name ?? key;
      addRequirement({ key: `contract:${key}`, label, kind: 'contract', current: completedContracts.has(key) ? 1 : 0, target: 1 }, `Deliver ${label} first.`, true);
    }
    research(order.required_research); materials(order.inputs);
    return result(ref, order.name, detail, pendingState(), requirements, blockers, { reward: order.reward });
  }

  const milestone = catalog?.milestones.find(item => item.key === ref.key);
  if (!milestone) return null;
  const record = business?.milestones.find(item => item.key === milestone.key);
  const detail = milestoneDetail(milestone.metric, milestone.target);
  const requirement: CompanyGoalRequirement = { key: `metric:${milestone.metric}`, label: METRIC_LABELS[milestone.metric], kind: 'metric', current: count(record?.progress), target: milestone.target };
  if (record?.claimed_at) return result(ref, milestone.name, detail, 'complete', [requirement], [], { reward: milestone.reward });
  if (!record) return result(ref, milestone.name, detail, 'locked', [requirement], ['Refresh to load this milestone’s recorded progress.'], { reward: milestone.reward });
  addRequirement(requirement, 'Recorded company progress has not reached this milestone.');
  return result(ref, milestone.name, detail, pendingState(), requirements, blockers, { reward: milestone.reward });
}

/** Next known building levels and the existing finite research/order/milestone catalog. */
export function companyGoals(snapshot: DeepClaimSnapshot): CompanyGoal[] {
  if (!snapshot.company) return [];
  const catalog = snapshot.business_catalog;
  const refs: CompanyGoalRef[] = [
    ...snapshot.buildings.filter(item => item.level < item.max_level).map(item => ({ kind: 'building' as const, key: item.key, level: item.level + 1 })),
    ...(catalog?.research.map(item => ({ kind: 'research' as const, key: item.key })) ?? []),
    ...(catalog?.contracts.map(item => ({ kind: 'contract' as const, key: item.key })) ?? []),
    ...(catalog?.milestones.map(item => ({ kind: 'milestone' as const, key: item.key })) ?? []),
  ];
  const goals = new Map<string, CompanyGoal>();
  for (const ref of refs) { const goal = evaluateCompanyGoal(snapshot, ref); if (goal) goals.set(goal.id, goal); }
  return [...goals.values()];
}
