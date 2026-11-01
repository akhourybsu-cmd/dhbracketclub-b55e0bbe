import phase3Catalog from '../../../supabase/seed/deep-claim-phase3-catalog.json';
import phase2Catalog from '../../../supabase/seed/deep-claim-phase2-catalog.json';
import {
  DEEP_CLAIM_RESOURCE_IDS, type DeepClaimBuildingId, type DeepClaimDuration, type DeepClaimResourceId,
  type DeepClaimResources, type DeepClaimSpecialty, type DeepClaimStatId, type DeepClaimEquipmentDefinition, type DeepClaimRecipe, type DeepClaimFieldCatalog, type DeepClaimInfrastructureKey, type DeepClaimDiscoveryKind,
} from './types';

/** Public market/catalog data. Deposits, geography and future yields stay server-private. */
export interface DeepClaimResourceDefinition {
  id: DeepClaimResourceId;
  name: string;
  sell_price: number;
  color: string;
  description: string;
}
export const RESOURCE_CATALOG: readonly DeepClaimResourceDefinition[] = [
  { id: 'stone', name: 'Stone', sell_price: 1, color: '#909a9c', description: 'Common construction stone recovered from the shallow seams.' },
  { id: 'clay', name: 'Clay', sell_price: 2, color: '#be8066', description: 'Dense workable earth, valued by the surface yards.' },
  { id: 'coal', name: 'Coal', sell_price: 4, color: '#596a75', description: 'Dark fuel seams that power the frontier.' },
  { id: 'copper_ore', name: 'Copper ore', sell_price: 8, color: '#cc8b68', description: 'Raw copper-bearing rock, sold before refining.' },
  { id: 'tin_ore', name: 'Tin ore', sell_price: 10, color: '#b4c9c7', description: 'Pale raw ore sought by the metal traders.' },
  { id: 'iron_ore', name: 'Iron ore', sell_price: 14, color: '#bd7b64', description: 'Heavy industrial ore in the deeper Ironworks.' },
  { id: 'quartz', name: 'Quartz', sell_price: 12, color: '#d9c7e4', description: 'Clear crystalline material from narrow mineral seams.' },
  { id: 'silver_ore', name: 'Silver ore', sell_price: 30, color: '#bcd6e4', description: 'Scarce silver-bearing rock. This is raw ore, not refined silver.' },
  { id: 'amethyst', name: 'Amethyst', sell_price: 50, color: '#b38cdb', description: 'Raw purple crystal from the new deep seams.' },
  { id: 'gold_ore', name: 'Gold ore', sell_price: 45, color: '#d3b36a', description: 'Raw gold-bearing rock from the deep region.' },
  { id: 'copper_bar', name: 'Copper bar', sell_price: 55, color: '#d3936c', description: 'Smelted copper, ready for equipment crafting.' },
  { id: 'tin_bar', name: 'Tin bar', sell_price: 65, color: '#c4d8d3', description: 'A smelted tin ingot.' },
  { id: 'iron_bar', name: 'Iron bar', sell_price: 70, color: '#a0a9b2', description: 'A structural iron ingot.' },
  { id: 'silver_bar', name: 'Silver bar', sell_price: 145, color: '#d1e0ec', description: 'A smelted silver ingot.' },
  { id: 'polished_quartz', name: 'Polished quartz', sell_price: 28, color: '#f0e6ed', description: 'Finished quartz used in precision equipment.' },
  { id: 'cut_amethyst', name: 'Cut amethyst', sell_price: 125, color: '#cba6ed', description: 'A cut deep crystal for advanced instruments.' },

];
export const RESOURCE_BY_ID = Object.fromEntries(RESOURCE_CATALOG.map(resource => [resource.id, resource])) as Record<DeepClaimResourceId, DeepClaimResourceDefinition>;
export const STAT_INFO: Record<DeepClaimStatId, { name: string; description: string }> = {
  mining: { name: 'Mining', description: 'Raises extraction output.' },
  geology: { name: 'Geology', description: 'Improves exploration and mineral recovery.' },
  engineering: { name: 'Engineering', description: 'Improves setup and equipment efficiency.' },
  logistics: { name: 'Logistics', description: 'Improves carrying and hauling efficiency.' },
  safety: { name: 'Safety', description: 'Protects useful work from operational losses.' },
  endurance: { name: 'Endurance', description: 'Sustains productive work over longer expeditions.' },
  leadership: { name: 'Leadership', description: 'Improves coordinated crew productivity.' },
};
export const SPECIALTY_INFO: Record<DeepClaimSpecialty, { name: string; description: string }> = {
  miner: { name: 'Miner', description: 'An extraction specialist.' },
  geologist: { name: 'Geologist', description: 'Reads the ground and locates useful seams.' },
  hauler: { name: 'Hauler', description: 'Keeps cargo moving back to the warehouse.' },
  engineer: { name: 'Engineer', description: 'A specialist in setup and equipment.' },
  surveyor: { name: 'Surveyor', description: 'A specialist in underground reconnaissance.' },
  demolitionist: { name: 'Demolitionist', description: 'A specialist in difficult rock.' },
  safety_officer: { name: 'Safety Officer', description: 'A specialist in dependable operations.' },
};
export const BUILDING_INFO: Record<DeepClaimBuildingId, { name: string; description: string; x: number }> = {
  mine_office: { name: 'Mine Office', description: 'Coordinates additional simultaneous crews.', x: 24 },
  mine_shaft: { name: 'Mine Shaft', description: 'Extends the company’s supported mining depth.', x: 48 },
  warehouse: { name: 'Warehouse', description: 'Stores collected resources before sale.', x: 66 },
  tool_station: { name: 'Tool Station', description: 'Improves extraction and crafts owned equipment.', x: 77 },
  workers_quarters: { name: 'Workers’ Quarters', description: 'Houses additional hired workers.', x: 9 },
  smeltery: { name: 'Smeltery', description: 'Consumes ore and coal to produce refined bars.', x: 38 },
  gem_workshop: { name: 'Gem Workshop', description: 'Polishes quartz and cuts deep crystals.', x: 91 },
};
export const DURATION_OPTIONS: readonly { minutes: DeepClaimDuration; label: string; energy: number; description: string }[] = [
  { minutes: 20, label: 'Quick', energy: 1, description: 'A short trip. One energy per worker.' },
  { minutes: 60, label: 'Standard', energy: 2, description: 'A longer shift. Two energy per worker.' },
  { minutes: 180, label: 'Deep', energy: 3, description: 'A full expedition. Three energy per worker.' },
];
export function resourceQuantity(resources: DeepClaimResources, id: DeepClaimResourceId): number { return resources[id] ?? 0; }
export function resourceTotal(resources: DeepClaimResources): number { return DEEP_CLAIM_RESOURCE_IDS.reduce((total, id) => total + resourceQuantity(resources, id), 0); }
export function resourceSaleValue(resources: DeepClaimResources): number {
  return DEEP_CLAIM_RESOURCE_IDS.reduce((total, id) => total + resourceQuantity(resources, id) * RESOURCE_BY_ID[id].sell_price, 0);
}
export const TRAIT_INFO: Record<string, { name: string; positive: boolean; description: string }> = {
  sure_swing: { name: 'Sure Swing', positive: true, description: '10% more extraction output.' },
  heavy_boots: { name: 'Heavy Boots', positive: false, description: '10% longer travel.' },
  ore_eye: { name: 'Ore Eye', positive: true, description: 'Reveals one additional cell while exploring.' },
  deliberate: { name: 'Deliberate', positive: false, description: '5% less extraction output.' },
  pack_mule: { name: 'Pack Mule', positive: true, description: '20% more carrying capacity.' },
  short_stride: { name: 'Short Stride', positive: false, description: '10% longer return travel.' },
};
/** Public starter identities; individual persistent worker IDs are assigned only by the server. */
export const STARTER_WORKERS = [
  { name: 'Mara Flint', specialty: 'miner' as const, base_wage: 3, traits: ['sure_swing','heavy_boots'],
    stats: { mining: 72, geology: 34, engineering: 46, logistics: 38, safety: 61, endurance: 74, leadership: 46 } },
  { name: 'Ivo Vale', specialty: 'geologist' as const, base_wage: 2, traits: ['ore_eye','deliberate'],
    stats: { mining: 41, geology: 82, engineering: 42, logistics: 47, safety: 68, endurance: 55, leadership: 58 } },
  { name: 'Tessa Pike', specialty: 'hauler' as const, base_wage: 2, traits: ['pack_mule','short_stride'],
    stats: { mining: 48, geology: 45, engineering: 58, logistics: 83, safety: 56, endurance: 76, leadership: 51 } },
] as const;
export const BUILDING_UPGRADE_COSTS: Record<DeepClaimBuildingId, readonly number[]> = {
  mine_office: [90,1200], mine_shaft: [80,2000,5000,12000], warehouse: [60,1000], tool_station: [50,1600],
  workers_quarters: [90,450,1200], smeltery: [90,350,900], gem_workshop: [120,450,1100],
};
export function buildingBenefits(key: DeepClaimBuildingId, level: number): { crew_slots?: number; max_depth?: number; shaft_depth?: number; warehouse_capacity?: number; yield_bonus_percent?: number; worker_capacity?: number; processing_speed_percent?: number } {
  const added = ['workers_quarters','smeltery','gem_workshop'].includes(key);
  if (!Number.isInteger(level) || level < (added ? 0 : 1) || level > (key === 'mine_shaft' ? 5 : 3)) throw new Error('Invalid Deep Claim building level.');
  if (key === 'mine_office') return { crew_slots: level };
  if (key === 'mine_shaft') return { max_depth: [49,99,149,299,599][level - 1], shaft_depth: [6,56,106,256,556][level - 1] };
  if (key === 'warehouse') return { warehouse_capacity: 120 * 2 ** (level - 1) };
  if (key === 'tool_station') return { yield_bonus_percent: 25 * (level - 1), processing_speed_percent:[100,85,70][level-1] };
  if (key === 'workers_quarters') return { worker_capacity: 3 + level * 3 };
  if (key === 'smeltery' || key === 'gem_workshop') return { processing_speed_percent: level === 0 ? 0 : [100,85,70][level - 1] };
  throw new Error('Unknown Deep Claim building.');
}
export function buildingEffect(key: DeepClaimBuildingId, level: number): string {
  const benefit = buildingBenefits(key, level);
  if (key === 'mine_office') return `${benefit.crew_slots} simultaneous ${level === 1 ? 'crew' : 'crews'}`;
  if (key === 'mine_shaft') return `Access to ${benefit.max_depth} m · shaft corridor to ${benefit.shaft_depth} m`;
  if (key === 'warehouse') return `${benefit.warehouse_capacity} resource units of storage`;
  if (key === 'tool_station') return `${benefit.yield_bonus_percent}% extraction bonus · ${100-benefit.processing_speed_percent!}% shorter crafting times`;
  if (key === 'workers_quarters') return `${benefit.worker_capacity} worker capacity`;
  return level === 0 ? 'Build to open this production lane' : `One production lane · ${100 - benefit.processing_speed_percent!}% shorter processing times`;
}

/** Canonical public production/workforce data; no world seeds or daily candidate rolls. */
export const PHASE2_CATALOG = phase2Catalog;
export const EQUIPMENT_CATALOG = phase2Catalog.equipment as DeepClaimEquipmentDefinition[];
export const EQUIPMENT_BY_KEY = Object.fromEntries(EQUIPMENT_CATALOG.map(item => [item.key,item])) as Record<string, DeepClaimEquipmentDefinition>;
export const RECIPE_CATALOG = phase2Catalog.recipes.map(recipe => ({ ...recipe, effective_duration_seconds: recipe.duration_seconds })) as DeepClaimRecipe[];
export const RECIPE_BY_KEY = Object.fromEntries(RECIPE_CATALOG.map(recipe => [recipe.key,recipe])) as Record<string, DeepClaimRecipe>;
export const CANDIDATE_PROFILES = phase2Catalog.candidate_profiles;
export const TRAINING_COST = phase2Catalog.training.cash_cost;
export const TRAINING_GAIN = phase2Catalog.training.stat_gain;
export const EQUIPMENT_WEAR_PER_ENERGY = phase2Catalog.wear_per_energy;

export const EQUIPMENT_CAPACITY = phase2Catalog.equipment_capacity;

/** Frozen public field definitions; geography, incident rolls and unrecovered finds stay private. */
export const FIELD_CATALOG = phase3Catalog as DeepClaimFieldCatalog;
export const INFRASTRUCTURE_BY_KEY = Object.fromEntries(FIELD_CATALOG.infrastructure.map(item => [item.key,item])) as Record<DeepClaimInfrastructureKey, DeepClaimFieldCatalog['infrastructure'][number]>;
export const DISCOVERY_BY_KEY = Object.fromEntries(FIELD_CATALOG.discoveries.map(item => [item.key,item])) as Record<DeepClaimDiscoveryKind, DeepClaimFieldCatalog['discoveries'][number]>;
export const DISCOVERY_QUALITY_BY_KEY = Object.fromEntries(FIELD_CATALOG.qualities.map(item => [item.key,item])) as Record<import('./types').DeepClaimDiscoveryQuality, DeepClaimFieldCatalog['qualities'][number]>;
