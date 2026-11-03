import { beforeEach, describe, expect, it } from 'vitest';
import { companyPlanKey, readCompanyPlan, saveCompanyPlan } from '@/lib/deepClaim/companyPlan';
import { phaseFourSnapshot } from './fixtures/deepClaimPhase4';

beforeEach(() => localStorage.clear());
describe('Deep Claim company plan preference', () => {
  const ref = { kind: 'building' as const, key: 'warehouse' as const, level: 2 };
  function setup() { const data = phaseFourSnapshot(), owner = data.company!; return { data, scope: { userId: owner.user_id, clubId: owner.club_id, companyId: owner.id } }; }
  it('remembers only a goal identity and reevaluates all facts from the current company', () => {
    const { data, scope } = setup(); expect(saveCompanyPlan(scope, data, ref)).toBe(true);
    expect(readCompanyPlan(scope, data)).toEqual(ref);
    const stored = JSON.parse(localStorage.getItem(companyPlanKey(scope))!);
    expect(stored).toEqual({ version: 1, scope: companyPlanKey(scope), goal: ref });
    data.company!.cash = 0; expect(readCompanyPlan(scope, data)).toEqual(ref);
    data.buildings.find(item => item.key === 'warehouse')!.level = 2; expect(readCompanyPlan(scope, data)).toEqual(ref);
  });
  it.each(['userId', 'clubId', 'companyId'] as const)('isolates a plan when %s changes', field => {
    const { data, scope } = setup(); saveCompanyPlan(scope, data, ref);
    const other = { ...scope, [field]: 'someone-else' };
    expect(readCompanyPlan(other, data)).toBeNull(); expect(saveCompanyPlan(other, data, ref)).toBe(false);
  });
  it('rejects injected progress, unknown content and impossible upgrade targets', () => {
    const { data, scope } = setup();
    for (const goal of [{ ...ref, cash: 100000 }, { kind: 'research', key: 'free_money' }, { ...ref, level: 6 }]) {
      localStorage.setItem(companyPlanKey(scope), JSON.stringify({ version: 1, scope: companyPlanKey(scope), goal }));
      expect(readCompanyPlan(scope, data)).toBeNull();
    }
  });
  it('tolerates corrupt, oversized and blocked device storage without touching company state', () => {
    const { data, scope } = setup(), before = structuredClone(data);
    localStorage.setItem(companyPlanKey(scope), '{'); expect(readCompanyPlan(scope, data)).toBeNull();
    localStorage.setItem(companyPlanKey(scope), ' '.repeat(2050)); expect(readCompanyPlan(scope, data)).toBeNull();
    const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(readCompanyPlan(scope, data, blocked)).toBeNull(); expect(saveCompanyPlan(scope, data, ref, blocked)).toBe(false);
    expect(data).toEqual(before);
  });
});
