import type { DeepClaimBuildingId, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { equipmentArtwork } from './artManifest';

export interface BuildingActivity { working: boolean; ready: boolean }
export interface WorkerEquipmentPaint {
  toolTier?: 1 | 2; toolBroken?: boolean; headTier?: 1 | 2; headBroken?: boolean;
  utility?: 'lantern' | 'cargo' | 'survey'; utilityTier?: 1 | 2; utilityBroken?: boolean;
}

/** A clock can stop a processing animation; only a server-ready DTO adds a crate. */
export function buildingActivity(snapshot: DeepClaimSnapshot, station: DeepClaimBuildingId, at = Date.parse(snapshot.server_now)): BuildingActivity {
  const jobs = (snapshot.production_jobs ?? []).filter(job => job.station === station);
  return { working: jobs.some(job => job.status === 'active' && at >= Date.parse(job.started_at) && at < Date.parse(job.completes_at)),
    ready: jobs.some(job => job.status === 'ready') };
}

/** Appearance reads actual owned assignments/durability, never invented equipment or bonuses. */
export function workerEquipmentPaint(snapshot: DeepClaimSnapshot, workerId: string): WorkerEquipmentPaint {
  const result: WorkerEquipmentPaint = {};
  for (const item of snapshot.equipment ?? []) {
    if (item.worker_id !== workerId) continue;
    const art = equipmentArtwork(item.definition_key); if (!art) continue;
    if (art.kind === 'pickaxe') { result.toolTier = art.tier; result.toolBroken = item.durability <= 0; }
    else if (art.kind === 'helmet') { result.headTier = art.tier; result.headBroken = item.durability <= 0; }
    else { result.utility = art.kind; result.utilityTier = art.tier; result.utilityBroken = item.durability <= 0; }
  }
  return result;
}
