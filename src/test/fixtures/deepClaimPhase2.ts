import { companySnapshot } from './deepClaim';
import { EQUIPMENT_CATALOG, RECIPE_CATALOG, BUILDING_UPGRADE_COSTS } from '@/lib/deepClaim/catalog';
import type { DeepClaimBuildingId, DeepClaimSnapshot } from '@/lib/deepClaim/types';

/** Schema2 fixture preserves the exact Phase1 company, worker IDs and revealed terrain. */
export function phaseTwoSnapshot(revision = 2): DeepClaimSnapshot {
  const snapshot = companySnapshot(revision);
  snapshot.schema_version = 2;
  snapshot.company!.worker_capacity = 3; snapshot.company!.equipment_capacity = 48;
  snapshot.workers = snapshot.workers.map(worker => ({ ...worker, wage:2, base_stats:{...worker.stats}, trained_day:null, training_cost:30, training_gain:3, equipment_ids:[] }));
  snapshot.buildings = snapshot.buildings.map(building => ({ ...building, max_level:building.key==='mine_shaft'?4:3 }));
  for (const key of ['workers_quarters','smeltery','gem_workshop'] as DeepClaimBuildingId[]) snapshot.buildings.push({key,level:0,max_level:3,upgrade_cost:BUILDING_UPGRADE_COSTS[key][0],effect:'Build an operational station.'});
  snapshot.candidates=[]; snapshot.equipment=[]; snapshot.production_jobs=[];
  snapshot.equipment_catalog=structuredClone(EQUIPMENT_CATALOG); snapshot.recipes=structuredClone(RECIPE_CATALOG);
  return snapshot;
}
