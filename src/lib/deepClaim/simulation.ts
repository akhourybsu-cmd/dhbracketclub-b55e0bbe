/**
 * Explanatory/headless v1 arithmetic. SQL independently authorizes and freezes
 * every job; these pure helpers never generate geography or grant live rewards.
 */
import { railStageSeconds } from './field';
import { BUILDING_UPGRADE_COSTS, RESOURCE_BY_ID, STARTER_WORKERS, resourceSaleValue, resourceTotal } from './catalog';
import {
  DEEP_CLAIM_MINERAL_IDS, DEEP_CLAIM_RESOURCE_IDS, DEEP_CLAIM_STAT_IDS, DEEP_CLAIM_TIME_ZONE, type DeepClaimBuildingId,
  type DeepClaimDuration, type DeepClaimMode, type DeepClaimPoint, type DeepClaimResourceId, type DeepClaimMineralId, type DeepClaimResources,
  type DeepClaimStageKey, type DeepClaimStats, type DeepClaimWorker,
} from './types';

function whole(value: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('Invalid Deep Claim simulation input.');
  return value;
}
/** Integer-rational arithmetic avoids client floating-point ceil/floor drift against PostgreSQL numeric. */
function ratio(numerators: number[], denominators: number[], up = false): number {
  const top = numerators.reduce((product, value) => product * BigInt(whole(value)), 1n);
  const bottom = denominators.reduce((product, value) => product * BigInt(whole(value, 1)), 1n);
  const result = Number(up ? (top + bottom - 1n) / bottom : top / bottom);
  return whole(result);
}
const hardnessTenths: Record<DeepClaimMineralId, number> = { stone: 10, clay: 7, coal: 10, copper_ore: 12, tin_ore: 12, iron_ore: 15, quartz: 13, silver_ore: 18, amethyst: 20, gold_ore: 22, nickel_ore:26,sulfur:12 };
export const DEEP_CLAIM_HARDNESS = Object.fromEntries(DEEP_CLAIM_MINERAL_IDS.map(id => [id, hardnessTenths[id] / 10])) as Record<DeepClaimMineralId, number>;
export function workerLevel(xp: number): number { return Math.min(10, 1 + Math.floor(whole(xp) / 60)); }
export function effectiveWorkerStats(base: DeepClaimStats, xp: number): DeepClaimStats {
  const bonus = workerLevel(xp) - 1;
  return Object.fromEntries(DEEP_CLAIM_STAT_IDS.map(id => [id, Math.min(100, whole(base[id], 1, 100) + bonus)])) as DeepClaimStats;
}
export function energyCost(minutes: DeepClaimDuration): number {
  if (![20,60,180].includes(minutes)) throw new Error('Unsupported expedition duration.');
  return minutes === 20 ? 1 : minutes === 60 ? 2 : 3;
}
export function calendarEnergyDay(instant: string | number | Date, timeZone = DEEP_CLAIM_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(instant));
  return ['year','month','day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function routeEdges(path: readonly DeepClaimPoint[]): number {
  return path.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - path[index].x) + Math.abs(point.y - path[index].y), 0);
}
export interface DeepClaimCrewPlanInput {
  workers: readonly DeepClaimWorker[];
  mode: DeepClaimMode;
  duration_minutes: DeepClaimDuration;
  path_edges: number;
  target_depth: number;
  tool_level: number;
  material?: DeepClaimMineralId;
  remaining?: number;
  tutorial?: boolean;
  /** Already authorized strongest installed route coverage; config1/2 callers leave zero. */
  transport_bonus_percent?: number;
}
export interface DeepClaimCrewPlan {
  averages: DeepClaimStats;
  max_leadership: number;
  wages: number;
  energy_per_worker: number;
  duration_seconds: number;
  capacity: number;
  stages: { key: DeepClaimStageKey; duration_seconds: number }[];
  work_seconds: number;
  feasible_work_time: boolean;
  mining_capacity: number;
  quantity: number;
  reveal_count: number;
  risk_level: 'low' | 'moderate' | 'high';
  estimated_yield: { min: number; max: number };
}
/** Inputs use the public, ALREADY effective worker.stats. Levels are not applied twice. */
export function calculateCrewPlan(input: DeepClaimCrewPlanInput): DeepClaimCrewPlan {
  const crew = input.workers, n = crew.length;
  whole(n, 1, 3); whole(input.path_edges); whole(input.target_depth); whole(input.tool_level, 1, 3);
  if (new Set(crew.map(worker => worker.id)).size !== n || !['explore','extract','survey','infrastructure'].includes(input.mode)) throw new Error('Invalid crew selection.');
  const presetEnergy = energyCost(input.duration_minutes), energy = input.tutorial ? 1 : presetEnergy;
  const total = input.tutorial ? 30 : input.duration_minutes * 60;
  const averages = Object.fromEntries(DEEP_CLAIM_STAT_IDS.map(id => [id, Math.floor(crew.reduce((sum, worker) => sum + whole(worker.stats[id], 1, 100), 0) / n)])) as DeepClaimStats;
  const max_leadership = Math.max(...crew.map(worker => worker.stats.leadership));
  const count = (trait: string) => crew.filter(worker => worker.traits.includes(trait)).length;
  const heavy = count('heavy_boots'), short = count('short_stride'), swing = count('sure_swing'), deliberate = count('deliberate');
  const wages = crew.reduce((sum, worker) => {
    const template = STARTER_WORKERS.find(template => template.name === worker.name && template.specialty === worker.specialty);
    const wage = worker.wage ?? template?.base_wage;
    if (wage === undefined) throw new Error('A worker wage must be provided by the server.');
    return sum + whole(wage,1) * energy;
  }, 0);
  const capacity = crew.reduce((sum, worker) => sum + ratio([80 + worker.stats.logistics, worker.traits.includes('pack_mule') ? 6 : 5], [10]), 0);
  let travel: number, setup: number, work: number, haul: number, back: number, mining_capacity = 0, quantity: number;
  if (input.tutorial) {
    travel = 5; setup = 3; work = 15; haul = 3; back = 4; quantity = 22; mining_capacity = 22;
  } else {
    const baseout = ratio([input.path_edges, 6, 100, 100 * n + 10 * heavy], [60 + averages.logistics, 100 * n], true);
    travel = Math.max(20, baseout);
    back = Math.max(20, ratio([baseout, 100 * n + 10 * short], [100 * n], true));
    if(input.transport_bonus_percent !== undefined) {
      travel=railStageSeconds(travel,input.transport_bonus_percent); back=railStageSeconds(back,input.transport_bonus_percent);
    }
    setup = Math.max(20, ratio([total, 6], [70 + averages.engineering], true));
    haul = Math.max(20, ratio([total, 4], [70 + averages.logistics], true));
    work = total - travel - setup - haul - back;
    const material = input.material ?? 'stone';
    mining_capacity = calculateMiningCapacity({work_seconds:Math.max(0,work),crew_count:n,averages,max_leadership,energy,tool_level:input.tool_level,material,sure_swing:swing,deliberate});
    const raw = input.mode === 'explore'
      ? wages + 2 * n + Math.floor(averages.mining / 20) + Math.floor(averages.geology / 30) + Math.floor(averages.endurance / 30)
      : Math.max(1, mining_capacity);
    quantity = ['survey','infrastructure'].includes(input.mode) ? 0 : Math.min(capacity, raw, input.remaining === undefined ? Number.MAX_SAFE_INTEGER : whole(input.remaining));
    if(['survey','infrastructure'].includes(input.mode)) mining_capacity=0;
  }
  const risk = Math.floor(input.target_depth / 10) + Math.floor((100 - averages.safety) / 10);
  return { averages, max_leadership, wages, energy_per_worker: energy, duration_seconds: total, capacity,
    stages: [{ key: 'travel', duration_seconds: travel }, { key: 'setup', duration_seconds: setup }, { key: 'work', duration_seconds: Math.max(0,work) }, { key: 'haul', duration_seconds: haul }, { key: 'return', duration_seconds: back }],
    work_seconds: work, feasible_work_time: input.tutorial === true || work >= 30, mining_capacity, quantity,
    reveal_count: 3 + Math.floor(averages.geology / 20) + Math.floor(averages.safety / 30) + count('ore_eye'),
    risk_level: risk < 8 ? 'low' : risk < 16 ? 'moderate' : 'high',
    estimated_yield: { min: ratio([quantity,8],[10]), max: Math.min(ratio([quantity,12],[10],true), capacity, input.tutorial || input.remaining === undefined ? Number.MAX_SAFE_INTEGER : input.remaining) } };
}
export interface DeepClaimMiningCapacityInput {work_seconds:number;crew_count:number;averages:DeepClaimStats;max_leadership:number;energy:number;tool_level:number;material:DeepClaimMineralId;sure_swing:number;deliberate:number}
/** The exact legacy integer-rational yield calculation, reusable with newly frozen productive seconds. */
export function calculateMiningCapacity(input:DeepClaimMiningCapacityInput):number{
 const {work_seconds,crew_count:n,averages,max_leadership,energy,tool_level,material,sure_swing:swing,deliberate}=input;
 whole(work_seconds);whole(n,1,3);whole(energy,1,3);whole(tool_level,1,3);whole(swing,0,n);whole(deliberate,0,n);whole(max_leadership,1,100);
 if(!DEEP_CLAIM_MINERAL_IDS.includes(material))throw new Error('Unsupported mining material.');
 return ratio([
  work_seconds,n,20+averages.mining,70+averages.safety,360+averages.geology,
  500-(energy-1)*Math.max(0,80-averages.endurance),1000+max_leadership*(n-1),
  100+25*(tool_level-1),100*n+10*swing-5*deliberate,10,
 ],[60,100,100,400,500,1000,100,100*n,hardnessTenths[material]]);
}
/** A previously depleted deposit cannot be renewed by this operation. */
export function withdrawFinite(remaining: number, requested: number): { quantity: number; remaining: number } {
  whole(remaining); whole(requested);
  const quantity = Math.min(remaining, requested); return { quantity, remaining: remaining - quantity };
}
/** Safe partial collection in the same canonical resource order as the backend. */
export function collectCargo(inventory: DeepClaimResources, cargo: DeepClaimResources, capacity: number): { inventory: DeepClaimResources; remaining: DeepClaimResources; collected: DeepClaimResources; complete: boolean } {
  whole(capacity, 1);
  let space = capacity - resourceTotal(inventory);
  if (space < 0) throw new Error('Inventory exceeds warehouse capacity.');
  const next = { ...inventory }, remaining = { ...cargo }, collected: DeepClaimResources = {};
  for (const id of DEEP_CLAIM_RESOURCE_IDS) {
    const owned = whole(inventory[id] ?? 0), staged = whole(cargo[id] ?? 0), take = Math.min(space, staged);
    if (take) { next[id] = owned + take; remaining[id] = staged - take; collected[id] = take; space -= take; }
  }
  return { inventory: next, remaining, collected, complete: resourceTotal(remaining) === 0 };
}
export function sellResource(inventory: DeepClaimResources, cash: number, id: DeepClaimResourceId, quantity: number): { inventory: DeepClaimResources; cash: number; proceeds: number } {
  whole(cash); whole(quantity, 1);
  if (!DEEP_CLAIM_RESOURCE_IDS.includes(id) || quantity > (inventory[id] ?? 0)) throw new Error('Not enough resources to sell.');
  const proceeds = quantity * RESOURCE_BY_ID[id].sell_price;
  return { inventory: { ...inventory, [id]: (inventory[id] ?? 0) - quantity }, cash: cash + proceeds, proceeds };
}
/** Version-one bankruptcy protection: never grant funds; preserve a recoverable minimum shift. */
export function retainsOperatingCapital(cash: number, wages: number, inventory: DeepClaimResources, guaranteedCargo: DeepClaimResources): boolean {
  whole(cash); whole(wages);
  return cash >= wages && cash - wages + resourceSaleValue(inventory) + resourceSaleValue(guaranteedCargo) >= 2;
}
export function canUpgrade(cash: number, building: DeepClaimBuildingId, currentLevel: number): boolean {
  const added = ['workers_quarters','smeltery','gem_workshop','research_office','trading_post'].includes(building);
  whole(cash); whole(currentLevel, added ? 0 : 1, building === 'mine_shaft' ? 6 : building==='research_office'?2:3);
  const price = BUILDING_UPGRADE_COSTS[building]?.[added ? currentLevel : currentLevel - 1];
  return price !== undefined && cash - price >= 2;
}
