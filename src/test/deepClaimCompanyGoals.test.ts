import { describe, expect, it } from 'vitest';
import { companyGoals, evaluateCompanyGoal, goalRefId, parseCompanyGoalRef, type CompanyGoalRef } from '@/lib/deepClaim/companyGoals';
import type { DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';
import { phaseSevenSnapshot } from './fixtures/deepClaimPhase7';

const researchRef = { kind: 'research', key: 'excavation_1' } as const;
const orderRef = { kind: 'contract', key: 'yard_foundations' } as const;
const milestoneRef = { kind: 'milestone', key: 'first_shift' } as const;
function prepareResearch(): DeepClaimSnapshot {
  const snapshot = phaseFourSnapshot();
  snapshot.company!.cash = 72;
  snapshot.buildings.find(item => item.key === 'research_office')!.level = 1;
  snapshot.resources = { stone: 12, clay: 6 };
  return snapshot;
}
function prepareOrder(): DeepClaimSnapshot {
  const snapshot = phaseFourSnapshot();
  snapshot.buildings.find(item => item.key === 'trading_post')!.level = 1;
  snapshot.resources = { stone: 20 };
  return snapshot;
}

describe('Company Goal preference identities', () => {
  it('accepts only bounded known building identities or finite catalog keys', () => {
    expect(parseCompanyGoalRef({ kind: 'building', key: 'warehouse', level: 2 })).toEqual({ kind: 'building', key: 'warehouse', level: 2 });
    expect(parseCompanyGoalRef(researchRef)).toEqual(researchRef);
    expect(parseCompanyGoalRef(Object.assign(Object.create({ kind: 'research', key: 'excavation_1' }), { extra: 1, other: 2 }))).toBeNull();
    expect(parseCompanyGoalRef(Object.assign(Object.create({ level: 2 }), { kind: 'building', key: 'warehouse', extra: 1 }))).toBeNull();
    for (const value of [null, [], {}, { kind: 'building', key: 'vault', level: 1 }, { kind: 'building', key: 'warehouse', level: 0 }, { kind: 'building', key: 'warehouse', level: 7 }, { kind: 'building', key: 'warehouse', level: 1.5 }, { kind: 'research', key: 'excavation_1', reward: 999 }, { kind: 'contract', key: '../other-company' }, { kind: 'unknown', key: 'anything' }]) expect(parseCompanyGoalRef(value)).toBeNull();
  });
  it('uses stable IDs that distinguish successive building targets', () => {
    expect(goalRefId({ kind: 'building', key: 'warehouse', level: 2 })).toBe('building:warehouse:2');
    expect(goalRefId({ kind: 'building', key: 'warehouse', level: 3 })).not.toBe(goalRefId({ kind: 'building', key: 'warehouse', level: 2 }));
    expect(goalRefId(researchRef)).toBe('research:excavation_1');
  });
  it('offers no private-company goal before a company exists', () => {
    const snapshot = phaseFourSnapshot(); snapshot.company = null;
    expect(companyGoals(snapshot)).toEqual([]); expect(evaluateCompanyGoal(snapshot, researchRef)).toBeNull();
  });
});

describe('Source-backed building goals', () => {
  const ref = { kind: 'building', key: 'warehouse', level: 2 } as const;
  it('uses the exact published next-level price and retains two credits', () => {
    const snapshot = phaseFourSnapshot(); snapshot.buildings.find(item => item.key === 'warehouse')!.upgrade_cost = 137;
    snapshot.company!.cash = 138;
    let goal = evaluateCompanyGoal(snapshot, ref)!;
    expect(goal.state).toBe('saving'); expect(goal.requirements).toEqual([expect.objectContaining({ kind: 'cash', current: 138, target: 139 })]);
    snapshot.company!.cash = 139; goal = evaluateCompanyGoal(snapshot, ref)!;
    expect(goal.state).toBe('ready'); expect(goal.progress).toBe(1); expect(goal.blockers).toEqual([]);
  });
  it('rejects future, missing, malformed or unpriced levels instead of inventing costs', () => {
    const snapshot = phaseFourSnapshot();
    expect(evaluateCompanyGoal(snapshot, { ...ref, level: 3 })).toBeNull();
    expect(evaluateCompanyGoal(snapshot, { ...ref, level: 4 })).toBeNull();
    expect(evaluateCompanyGoal(snapshot, { ...ref, level: 0 })).toBeNull();
    snapshot.buildings.find(item => item.key === 'warehouse')!.upgrade_cost = null;
    expect(evaluateCompanyGoal(snapshot, ref)).toBeNull();
    snapshot.buildings = snapshot.buildings.filter(item => item.key !== 'warehouse'); expect(evaluateCompanyGoal(snapshot, ref)).toBeNull();
  });
  it('keeps an achieved pinned level complete after later upgrades and spending', () => {
    const snapshot = phaseFourSnapshot(); const warehouse = snapshot.buildings.find(item => item.key === 'warehouse')!;
    warehouse.level = 3; warehouse.upgrade_cost = null; snapshot.company!.cash = 0;
    const goal = evaluateCompanyGoal(snapshot, ref)!;
    expect(goal.state).toBe('complete'); expect(goal.progress).toBe(1); expect(goal.requirements).toEqual([expect.objectContaining({ kind: 'building', current: 3, target: 2 })]);
    expect(goal.blockers).toEqual([]); expect(goal.requirements.some(item => item.kind === 'cash')).toBe(false);
    expect(companyGoals(snapshot).some(item => item.ref.kind === 'building' && item.ref.key === 'warehouse')).toBe(false);
  });
  it('requires the confirmed Ancient Deep research for the sixth shaft purchase', () => {
    const snapshot = phaseSevenSnapshot(); const shaft = snapshot.buildings.find(item => item.key === 'mine_shaft')!;
    shaft.level = 5; shaft.upgrade_cost = 24_000; snapshot.company!.cash = 24_002;
    const deepRef = { kind: 'building', key: 'mine_shaft', level: 6 } as const;
    expect(evaluateCompanyGoal(snapshot, deepRef)!.state).toBe('locked');
    for (const key of snapshot.deep_catalog!.shaft.required_research) snapshot.business!.research.push({ key, status: 'completed', started_at: snapshot.server_now, completes_at: snapshot.server_now, completed_at: snapshot.server_now });
    expect(evaluateCompanyGoal(snapshot, deepRef)!.state).toBe('ready');
    expect(evaluateCompanyGoal(snapshot, deepRef)!.requirements.filter(item => item.kind === 'research')).toHaveLength(snapshot.deep_catalog!.shaft.required_research.length);
  });
});

describe('Existing research and delivery goals', () => {
  it('shows the real fee, materials and prerequisites before a research purchase', () => {
    const snapshot = prepareResearch(); const goal = evaluateCompanyGoal(snapshot, researchRef)!;
    expect(goal.state).toBe('ready');
    expect(goal.requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'building:research_office', current: 1, target: 1 }),
      expect.objectContaining({ key: 'cash', current: 72, target: 72 }),
      expect.objectContaining({ resourceId: 'stone', current: 12, target: 12 }),
      expect.objectContaining({ resourceId: 'clay', current: 6, target: 6 }),
    ]));
    snapshot.company!.cash = 71; expect(evaluateCompanyGoal(snapshot, researchRef)!.state).toBe('saving');
    snapshot.buildings.find(item => item.key === 'research_office')!.level = 0; expect(evaluateCompanyGoal(snapshot, researchRef)!.state).toBe('locked');
  });
  it('counts fulfilled requirements rather than inventing fractional completion from money', () => {
    const snapshot = prepareResearch(); snapshot.resources.clay = 5;
    const goal = evaluateCompanyGoal(snapshot, researchRef)!;
    const met = goal.requirements.filter(item => item.current >= item.target).length;
    expect(goal.progress).toBe(met / goal.requirements.length); expect(goal.progress).toBeLessThan(1);
  });
  it('keeps paid research working after its timer expires until the server completes it', () => {
    const snapshot = prepareResearch(); snapshot.company!.cash = 2; snapshot.resources = {};
    snapshot.business!.research.push({ key: researchRef.key, status: 'active', started_at: '2020-01-01T00:00:00Z', completes_at: '2020-01-01T00:05:00Z', completed_at: null });
    const goal = evaluateCompanyGoal(snapshot, researchRef)!;
    expect(goal.state).toBe('working'); expect(goal.completesAt).toBe('2020-01-01T00:05:00Z'); expect(goal.progress).toBe(0);
    expect(goal.requirements).toHaveLength(1); expect(goal.requirements[0]).toMatchObject({ kind: 'research', current: 0, target: 1 });
    expect(goal.blockers).toEqual([]);
  });
  it('uses confirmed research completion even after paid materials have been spent', () => {
    const snapshot = prepareResearch(); snapshot.resources = {}; snapshot.company!.cash = 0;
    snapshot.business!.research.push({ key: researchRef.key, status: 'completed', started_at: snapshot.server_now, completes_at: snapshot.server_now, completed_at: snapshot.server_now });
    expect(evaluateCompanyGoal(snapshot, researchRef)).toMatchObject({ state: 'complete', progress: 1, blockers: [], requirements: [{ current: 1, target: 1, kind: 'research' }] });
  });
  it('blocks a second research project without suppressing its actual material progress', () => {
    const snapshot = prepareResearch(); snapshot.business!.research.push({ key: 'geology_1', status: 'active', started_at: snapshot.server_now, completes_at: snapshot.server_now, completed_at: null });
    const goal = evaluateCompanyGoal(snapshot, researchRef)!;
    expect(goal.state).toBe('locked'); expect(goal.blockers).toContain('One research project can run at a time.');
    expect(goal.requirements.find(item => item.key === 'resource:stone')).toMatchObject({ current: 12, target: 12 });
    expect(goal.requirements.find(item => item.key === 'research:slot')).toMatchObject({ current: 0, target: 1 });
  });
  it('requires earlier orders, research and the actual Trading Post tier', () => {
    const snapshot = prepareOrder(); snapshot.resources = { bronze_bar: 4 };
    const ref = { kind: 'contract', key: 'alloy_stock' } as const;
    let goal = evaluateCompanyGoal(snapshot, ref)!;
    expect(goal.state).toBe('locked'); expect(goal.requirements.find(item => item.kind === 'building')).toMatchObject({ current: 1, target: 2 });
    snapshot.buildings.find(item => item.key === 'trading_post')!.level = 2;
    snapshot.business!.contracts.find(item => item.key === 'copper_fittings')!.status = 'completed';
    snapshot.business!.research.push({ key: 'processing_1', status: 'completed', started_at: snapshot.server_now, completes_at: snapshot.server_now, completed_at: snapshot.server_now });
    goal = evaluateCompanyGoal(snapshot, ref)!; expect(goal.state).toBe('ready'); expect(goal.reward).toBe(368);
  });
  it('does not count staged cargo or unfinished output as collected materials', () => {
    const snapshot = prepareOrder(); snapshot.resources = { stone: 19 };
    snapshot.expeditions = [{ ...snapshot.expeditions[0], cargo: { stone: 100 }, status: 'ready' } as DeepClaimSnapshot['expeditions'][number]];
    snapshot.production_jobs = [{ outputs: { stone: 100 }, status: 'active' } as NonNullable<DeepClaimSnapshot['production_jobs']>[number]];
    const goal = evaluateCompanyGoal(snapshot, orderRef)!;
    expect(goal.state).toBe('saving'); expect(goal.requirements.find(item => item.resourceId === 'stone')).toMatchObject({ current: 19, target: 20 });
  });
  it('keeps delivered orders complete after their inputs are consumed', () => {
    const snapshot = prepareOrder(); snapshot.resources = {}; snapshot.business!.contracts[0].status = 'completed';
    const goal = evaluateCompanyGoal(snapshot, orderRef)!;
    expect(goal.state).toBe('complete'); expect(goal.progress).toBe(1); expect(goal.reward).toBe(24);
    expect(goal.requirements).toEqual([expect.objectContaining({ kind: 'contract', current: 1, target: 1 })]);
  });
  it('does not claim development is available without its current authoritative report', () => {
    const snapshot = prepareResearch(); snapshot.business = undefined;
    expect(evaluateCompanyGoal(snapshot, researchRef)!.state).toBe('locked');
    expect(evaluateCompanyGoal(snapshot, researchRef)!.requirements.find(item => item.key === 'research:slot')!.current).toBe(0);
    expect(evaluateCompanyGoal(snapshot, orderRef)!.state).toBe('locked');
  });
});

describe('Recorded milestone goals and pure evaluation', () => {
  it('uses the milestone record rather than guessing lifetime progress from stats or bounded history', () => {
    const snapshot = phaseFourSnapshot(); snapshot.business!.stats.completed_mining_expeditions = 999;
    snapshot.business!.milestones.find(item => item.key === 'first_shift')!.progress = 0;
    let goal = evaluateCompanyGoal(snapshot, milestoneRef)!;
    expect(goal.state).toBe('saving'); expect(goal.requirements[0].current).toBe(0);
    snapshot.business!.milestones = snapshot.business!.milestones.filter(item => item.key !== 'first_shift');
    goal = evaluateCompanyGoal(snapshot, milestoneRef)!;
    expect(goal.state).toBe('locked'); expect(goal.progress).toBe(0); expect(goal.blockers[0]).toContain('recorded progress');
  });
  it('distinguishes ready-to-claim from actually claimed milestones', () => {
    const snapshot = phaseFourSnapshot(); const record = snapshot.business!.milestones.find(item => item.key === 'first_shift')!;
    record.progress = 1;
    expect(evaluateCompanyGoal(snapshot, milestoneRef)).toMatchObject({ state: 'ready', reward: 10, progress: 1 });
    record.claimed_at = snapshot.server_now;
    expect(evaluateCompanyGoal(snapshot, milestoneRef)).toMatchObject({ state: 'complete', reward: 10, progress: 1 });
    const batch = evaluateCompanyGoal(snapshot, { kind: 'milestone', key: 'first_batch' })!;
    expect(batch.detail).toBe('Collect 1 production batch'); expect(batch.requirements[0].label).toBe('Production batches collected');
  });
  it('resolves only current published refs and lists all current catalog goals once', () => {
    const snapshot = phaseFourSnapshot(); const goals = companyGoals(snapshot), catalog = snapshot.business_catalog!;
    for (const kind of ['research', 'contract', 'milestone'] as const) {
      expect(goals.filter(goal => goal.ref.kind === kind)).toHaveLength(catalog[kind === 'research' ? 'research' : kind === 'contract' ? 'contracts' : 'milestones'].length);
      expect(evaluateCompanyGoal(snapshot, { kind, key: 'unreleased_future_content' })).toBeNull();
    }
    expect(goals.filter(goal => goal.ref.kind === 'building')).toHaveLength(snapshot.buildings.length);
    expect(new Set(goals.map(goal => goal.id)).size).toBe(goals.length);
    expect(evaluateCompanyGoal(snapshot, { kind: 'purchase', key: 'fake' } as unknown as CompanyGoalRef)).toBeNull();
  });
  it('never mutates the save, catalog or caller preference and exposes no economic action', () => {
    const snapshot = phaseFourSnapshot(), before = structuredClone(snapshot), ref: CompanyGoalRef = { kind: 'building', key: 'warehouse', level: 2 };
    const goal = evaluateCompanyGoal(snapshot, ref)!; const goals = companyGoals(snapshot);
    expect(snapshot).toEqual(before); expect(goal.ref).not.toBe(ref); expect(ref).toEqual({ kind: 'building', key: 'warehouse', level: 2 });
    expect(goals.every(item => !Object.values(item).some(value => typeof value === 'function'))).toBe(true);
  });
});
