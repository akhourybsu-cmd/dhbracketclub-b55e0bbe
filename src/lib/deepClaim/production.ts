/** Public explanatory v2 workforce/production arithmetic. Authoritative company state mutates only through dc_* RPCs. */
import { EQUIPMENT_BY_KEY, EQUIPMENT_CAPACITY, EQUIPMENT_WEAR_PER_ENERGY, TRAINING_COST, TRAINING_GAIN, resourceSaleValue } from './catalog';
import { effectiveWorkerStats } from './simulation';
import { DEEP_CLAIM_RESOURCE_IDS, DEEP_CLAIM_STAT_IDS, type DeepClaimEquipment, type DeepClaimEquipmentDefinition, type DeepClaimRecipe, type DeepClaimResources, type DeepClaimStatId, type DeepClaimStats } from './types';

function integer(value: number, min = 0, max = Number.MAX_SAFE_INTEGER) { if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('Invalid workforce or production input.'); return value; }
export function housingCapacity(quartersLevel: number): number { return 3 + 3 * integer(quartersLevel,0,3); }
export function availableEquipmentCapacity(owned: number, pendingOutputs: number): number { return Math.max(0,EQUIPMENT_CAPACITY-integer(owned)-integer(pendingOutputs)); }
/** Timing can be displayed for a locked recipe; starting it separately requires its station level. */
export function recipeUnitDurationSeconds(recipe:DeepClaimRecipe,stationLevel:number,researchSpeed=recipe.research_speed_percent??0):number{
 integer(stationLevel,1,3);integer(researchSpeed,0,15);
 const stationSeconds=Math.ceil(recipe.duration_seconds*[100,85,70][stationLevel-1]/100);
 return Math.max(20,Math.ceil(stationSeconds*(100-researchSpeed)/100));
}
export function recipeDurationSeconds(recipe: DeepClaimRecipe, batches: number, stationLevel: number, researchSpeed=recipe.research_speed_percent??0): number {
  integer(batches,1,10); integer(stationLevel,1,3);
  if (stationLevel < recipe.required_station_level) throw new Error('Upgrade this station before using the recipe.');
  return recipeUnitDurationSeconds(recipe,stationLevel,researchSpeed)*batches;
}
export function scaleResources(resources: DeepClaimResources, batches: number): DeepClaimResources {
  integer(batches,1,10); const scaled: DeepClaimResources = {};
  for (const id of DEEP_CLAIM_RESOURCE_IDS) if (resources[id]) scaled[id] = integer(resources[id]!) * batches;
  return scaled;
}
export function productionQuote(recipe: DeepClaimRecipe, batches: number, stationLevel: number, researchSpeed=recipe.research_speed_percent??0) {
  const duration_seconds = recipeDurationSeconds(recipe,batches,stationLevel,researchSpeed);
  return { inputs:scaleResources(recipe.inputs,batches), outputs:scaleResources(recipe.outputs,batches), cash_cost:recipe.cash_cost*batches,
    equipment_outputs:recipe.equipment_output ? Array.from({length:batches},()=>recipe.equipment_output!) : [], duration_seconds };
}
export function recipeValueAdded(recipe: DeepClaimRecipe): number | null {
  return recipe.equipment_output ? null : resourceSaleValue(recipe.outputs)-resourceSaleValue(recipe.inputs)-recipe.cash_cost;
}
export function trainingQuote(base: DeepClaimStats, stat: DeepClaimStatId, trainedDay: string | null, operatingDay: string, assignedJobId: string | null = null) {
  if (assignedJobId !== null) throw new Error('Wait until this worker returns before training.');
  if (!DEEP_CLAIM_STAT_IDS.includes(stat) || !Number.isInteger(base[stat]) || base[stat]<1 || base[stat]>100) throw new Error('Choose a supported skill.');
  if (trainedDay === operatingDay) throw new Error('This worker already trained today.');
  const gain = Math.min(TRAINING_GAIN,100-base[stat]);
  if (gain === 0) throw new Error('This base skill is already at its cap.');
  return { cash_cost:TRAINING_COST, gain, stats:{...base,[stat]:base[stat]+gain} };
}
export function equipmentRepairQuote(definition: DeepClaimEquipmentDefinition, durability: number) {
  integer(durability,0,definition.max_durability);
  if (durability === definition.max_durability) return { cash_cost:0, materials:{} as DeepClaimResources, repaired_durability:durability };
  // Catalog rates are exact hundredths; integer math matches PostgreSQL numeric ceil.
  const rate = Math.round(definition.repair_rate*100);
  const cash_cost = Math.ceil((definition.max_durability-durability)*rate/100);
  return { cash_cost, materials:{...definition.repair_materials}, repaired_durability:definition.max_durability };
}
export function equipmentAfterCompletedJob(item: Pick<DeepClaimEquipment,'durability'>, energy: number, configVersion: 1 | 2 | 3 | 7): number {
  integer(item.durability); integer(energy,1,3);
  return configVersion === 1 ? item.durability : Math.max(0,item.durability-EQUIPMENT_WEAR_PER_ENERGY*energy);
}
export function workerStatsWithEquipment(base: DeepClaimStats, xp: number, equipment: readonly Pick<DeepClaimEquipment,'definition_key'|'durability'>[]): DeepClaimStats {
  const stats = effectiveWorkerStats(base,xp), slots = new Set<string>();
  for (const item of equipment) {
    const definition = EQUIPMENT_BY_KEY[item.definition_key];
    if (!definition) throw new Error('Unknown equipment definition.');
    if (slots.has(definition.slot)) throw new Error('Assign only one item to each worker slot.');
    slots.add(definition.slot);
    integer(item.durability,0,definition.max_durability);
    if (item.durability === 0) continue;
    for (const stat of DEEP_CLAIM_STAT_IDS) stats[stat] = Math.min(100,stats[stat]+(definition.bonuses[stat] ?? 0));
  }
  return stats;
}
