import { describe, expect, it } from 'vitest';
import { BUILDING_UPGRADE_COSTS, RESOURCE_CATALOG, STARTER_WORKERS, buildingBenefits, buildingEffect, resourceSaleValue } from '@/lib/deepClaim/catalog';
import { calculateCrewPlan, calendarEnergyDay, canUpgrade, collectCargo, effectiveWorkerStats, energyCost, retainsOperatingCapital, sellResource, withdrawFinite, workerLevel } from '@/lib/deepClaim/simulation';
import { DEEP_CLAIM_RESOURCE_IDS, DEEP_CLAIM_STAT_IDS, type DeepClaimWorker } from '@/lib/deepClaim/types';

function workers(): DeepClaimWorker[] {
  return STARTER_WORKERS.map((worker, index) => ({ id: `worker-${index}`, name: worker.name, specialty: worker.specialty,
    traits: [...worker.traits], stats: { ...worker.stats }, energy: 6, xp: 0, level: 1, assigned_job_id: null }));
}
const input = () => ({ workers: workers(), mode: 'extract' as const, duration_minutes: 180 as const, path_edges: 20, target_depth: 20, tool_level: 1, material: 'stone' as const, remaining: 10_000 });

describe('Deep Claim frozen v1 economy and crew rules', () => {
  it('has eight distinct priced resources and functional effects for every real building level', () => {
    expect(RESOURCE_CATALOG.slice(0,8).map(resource => resource.id)).toEqual([...DEEP_CLAIM_RESOURCE_IDS].slice(0,8));
    expect(RESOURCE_CATALOG.slice(0,8).map(resource => resource.sell_price)).toEqual([1,2,4,8,10,14,12,30]);
    expect(['mine_office','mine_shaft','warehouse','tool_station'].flatMap(key => BUILDING_UPGRADE_COSTS[key as keyof typeof BUILDING_UPGRADE_COSTS].slice(0,2)).reduce((sum,cost) => sum + cost,0)).toBe(6080);
    const starterAssay = { stone:12,clay:16,coal:10,copper_ore:18,tin_ore:12,iron_ore:15,quartz:8,silver_ore:3 };
    expect(resourceSaleValue(starterAssay)).toBe(744);
    // Even without wages, the entire permanent starter assay cannot purchase
    // the complete business: later progression must come from real exploration.
    expect(180 + resourceSaleValue(starterAssay)).toBeLessThan(6080);
    expect(buildingBenefits('mine_office', 3)).toEqual({ crew_slots: 3 });
    expect(buildingBenefits('mine_shaft', 3)).toEqual({ max_depth: 149, shaft_depth: 106 });
    expect([1,2,3].map(level => buildingBenefits('warehouse', level).warehouse_capacity)).toEqual([120,240,480]);
    expect([1,2,3].map(level => buildingBenefits('tool_station', level).yield_bonus_percent)).toEqual([0,25,50]);
    for (const key of Object.keys(BUILDING_UPGRADE_COSTS) as (keyof typeof BUILDING_UPGRADE_COSTS)[]) expect(buildingEffect(key, 2).length).toBeGreaterThan(10);
  });
  it('charges wages and energy per worker at exactly the20/60/180 minute presets', () => {
    for (const [duration_minutes,cost] of [[20,1],[60,2],[180,3]] as const) {
      const plan = calculateCrewPlan({ ...input(), duration_minutes });
      expect(energyCost(duration_minutes)).toBe(cost); expect(plan.wages).toBe(7 * cost); expect(plan.energy_per_worker).toBe(cost);
      expect(plan.duration_seconds).toBe(duration_minutes * 60);
      expect(plan.stages.reduce((sum, stage) => sum + stage.duration_seconds, 0)).toBe(plan.duration_seconds);
    }
    expect(() => energyCost(1 as never)).toThrow();
  });
  it('keeps the once-only tutorial clock truly30seconds with a finite22unit haul and normal quick wages', () => {
    const plan = calculateCrewPlan({ ...input(), workers: workers().slice(0,1), duration_minutes: 20, tutorial: true });
    expect(plan).toMatchObject({ duration_seconds: 30, energy_per_worker: 1, wages: 3, quantity: 22, feasible_work_time: true });
    expect(plan.stages.map(stage => stage.duration_seconds)).toEqual([5,3,15,3,4]);
    expect(plan.estimated_yield).toEqual({ min: 17, max: 27 });
    // SQL rejects non-quick tutorial presets; even their safe quote metadata
    // must retain the fixed tutorial energy/wages rather than charging deep cost.
    expect(calculateCrewPlan({ ...input(), workers: workers().slice(0,1), duration_minutes: 180, tutorial: true })).toMatchObject({ energy_per_worker: 1, wages: 3, duration_seconds: 30 });
  });
  it('uses all seven stats in their real timing, capacity, output or risk calculations', () => {
    const baseline = calculateCrewPlan(input());
    for (const stat of DEEP_CLAIM_STAT_IDS) {
      const increased = input(); increased.workers.forEach(worker => { worker.stats[stat] = Math.min(100, worker.stats[stat] + 20); });
      const result = calculateCrewPlan(increased);
      if (stat === 'engineering') expect(result.stages.find(stage => stage.key === 'setup')!.duration_seconds).toBeLessThan(baseline.stages.find(stage => stage.key === 'setup')!.duration_seconds);
      else if (stat === 'logistics') expect(result.capacity).toBeGreaterThan(baseline.capacity);
      else expect(result.mining_capacity).toBeGreaterThan(baseline.mining_capacity);
    }
  });
  it('applies positive and negative traits rather than displaying unused labels', () => {
    const [mara,ivo,tessa] = workers();
    const plan = (worker: DeepClaimWorker) => calculateCrewPlan({ ...input(), workers: [worker], path_edges: 40 });
    expect(plan(mara).mining_capacity).toBeGreaterThan(plan({ ...mara, traits: [] }).mining_capacity);
    expect(plan(mara).stages[0].duration_seconds).toBeGreaterThan(plan({ ...mara, traits: [] }).stages[0].duration_seconds);
    expect(plan(ivo).reveal_count).toBeGreaterThan(plan({ ...ivo, traits: [] }).reveal_count);
    expect(plan(ivo).mining_capacity).toBeLessThan(plan({ ...ivo, traits: [] }).mining_capacity);
    expect(plan(tessa).capacity).toBeGreaterThan(plan({ ...tessa, traits: [] }).capacity);
    expect(plan(tessa).stages[4].duration_seconds).toBeGreaterThan(plan({ ...tessa, traits: [] }).stages[4].duration_seconds);
  });
  it('makes deep travel consume real time and detects when a quick route cannot leave productive work', () => {
    const longRoute = calculateCrewPlan({ ...input(), workers: workers().slice(0,1), duration_minutes: 20, path_edges: 300 });
    expect(longRoute.feasible_work_time).toBe(false); expect(longRoute.work_seconds).toBeLessThan(30);
    const deep = calculateCrewPlan({ ...input(), workers: workers().slice(0,1), duration_minutes: 180, path_edges: 300 });
    expect(deep.feasible_work_time).toBe(true); expect(deep.work_seconds).toBeGreaterThan(30);
  });
  it('progresses workers on earned XP, caps level/stats and never reapplies a level to public effective stats', () => {
    expect([0,59,60,120,540,10_000].map(workerLevel)).toEqual([1,1,2,3,10,10]);
    const worker = workers()[0], base = { ...worker.stats, mining: 99 };
    expect(effectiveWorkerStats(base, 60).mining).toBe(100); expect(effectiveWorkerStats(base, 10_000).mining).toBe(100);
    const levelled = { ...worker, stats: effectiveWorkerStats(worker.stats, 60), level: 2, xp: 60 };
    const otherLevelMetadata = { ...levelled, level: 10, xp: 10_000 };
    expect(calculateCrewPlan({ ...input(), workers: [levelled] })).toEqual(calculateCrewPlan({ ...input(), workers: [otherLevelMetadata] }));
  });
  it('preserves finite deposits through repeated requests instead of recreating exhausted resources', () => {
    const first = withdrawFinite(11, 50); expect(first).toEqual({ quantity: 11, remaining: 0 });
    expect(withdrawFinite(first.remaining, 50)).toEqual({ quantity: 0, remaining: 0 });
    expect(calculateCrewPlan({ ...input(), remaining: 1 })).toMatchObject({ quantity: 1, estimated_yield: { min: 0, max: 1 } });
    const capped = calculateCrewPlan(input()); expect(capped.estimated_yield.max).toBeLessThanOrEqual(capped.capacity);
    expect(calculateCrewPlan({ ...input(), remaining: 0 }).quantity).toBe(0);
    expect(() => withdrawFinite(-1, 4)).toThrow(); expect(() => withdrawFinite(10, NaN)).toThrow();
  });
  it('partially collects a full haul without losing a unit and can finish safely after selling inventory', () => {
    const before = { stone: 119 }, cargo = { stone: 5, coal: 10 };
    const first = collectCargo(before, cargo, 120);
    expect(first).toEqual({ inventory: { stone: 120 }, remaining: { stone: 4, coal: 10 }, collected: { stone: 1 }, complete: false });
    const sold = sellResource(first.inventory, 0, 'stone', 120);
    const second = collectCargo(sold.inventory, first.remaining, 120);
    expect(second).toMatchObject({ inventory: { stone: 4, coal: 10 }, remaining: { stone: 0, coal: 0 }, complete: true });
    expect(before).toEqual({ stone: 119 }); expect(cargo).toEqual({ stone: 5, coal: 10 });
    expect(sold.cash + resourceSaleValue(second.inventory)).toBe(164);
  });
  it('prevents the cash2→one-stone extraction bankruptcy softlock without fabricating cash or blocking wealthy companies', () => {
    expect(retainsOperatingCapital(2, 2, {}, { stone: 1 })).toBe(false);
    expect(retainsOperatingCapital(2, 2, {}, { stone: 2 })).toBe(true);
    expect(retainsOperatingCapital(2, 2, { coal: 1 }, { stone: 1 })).toBe(true);
    expect(retainsOperatingCapital(180, 2, {}, { stone: 1 })).toBe(true);
    expect(retainsOperatingCapital(1, 2, {}, { silver_ore: 100 })).toBe(false);
    expect(canUpgrade(61, 'warehouse', 1)).toBe(false); expect(canUpgrade(62, 'warehouse', 1)).toBe(true);
    expect(canUpgrade(10_000, 'warehouse', 3)).toBe(false);
  });
  it('uses actual New York calendar boundaries through both23-hour and25-hour DST days', () => {
    expect(calendarEnergyDay('2026-03-08T04:59:59Z')).toBe('2026-03-07');
    expect(calendarEnergyDay('2026-03-08T05:00:00Z')).toBe('2026-03-08');
    expect(calendarEnergyDay('2026-03-09T04:00:00Z')).toBe('2026-03-09');
    expect(calendarEnergyDay('2026-11-01T03:59:59Z')).toBe('2026-10-31');
    expect(calendarEnergyDay('2026-11-01T04:00:00Z')).toBe('2026-11-01');
    expect(calendarEnergyDay('2026-11-02T04:59:59Z')).toBe('2026-11-01');
    expect(calendarEnergyDay('2026-11-02T05:00:00Z')).toBe('2026-11-02');
    expect(calendarEnergyDay('2026-11-02T05:00:00Z', 'UTC')).toBe('2026-11-02');
  });
});
