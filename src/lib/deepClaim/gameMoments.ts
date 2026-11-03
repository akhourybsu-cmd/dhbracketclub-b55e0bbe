import type { DeepClaimBuildingId, DeepClaimDispatchInput, DeepClaimExpedition, DeepClaimPoint, DeepClaimSnapshot, DeepClaimWorker } from './types';
import { projectWorkers } from './world';

export interface CrewDepartureMoment { job: DeepClaimExpedition; workers: DeepClaimWorker[]; companyId: string }
export interface BuildingChangeMoment { key: DeepClaimBuildingId; fromLevel: number; toLevel: number; effect: string }
function sameCompany(before: DeepClaimSnapshot, after: DeepClaimSnapshot): boolean {
  return !!before.company && !!after.company && before.company.id === after.company.id && before.company.user_id === after.company.user_id && before.company.club_id === after.company.club_id;
}
const crewKey = (ids: readonly string[]) => [...ids].sort().join(':');

/** A preview, unchanged retry, or unrelated company update cannot commission a crew. */
export function commissionedCrew(before: DeepClaimSnapshot, after: DeepClaimSnapshot, input: DeepClaimDispatchInput): CrewDepartureMoment | null {
  if (!sameCompany(before, after) || after.revision <= before.revision) return null;
  const previous = new Set(before.expeditions.map(job => job.id));
  const matches = after.expeditions.filter(job => !previous.has(job.id) && job.status === 'active' && job.mode === input.mode
    && job.target.x === input.target_x && job.target.y === input.target_y && job.duration_minutes === input.duration_minutes
    && job.tutorial === input.tutorial && crewKey(job.worker_ids) === crewKey(input.worker_ids));
  if (matches.length !== 1) return null;
  const job = matches[0];
  const workers = after.workers.filter(worker => job.worker_ids.includes(worker.id) && worker.assigned_job_id === job.id);
  return workers.length === job.worker_ids.length && workers.length > 0 ? { job, workers, companyId: after.company!.id } : null;
}

/** Actual owned levels, not the level requested or a predicted upgrade result. */
export function confirmedBuildingChange(before: DeepClaimSnapshot, after: DeepClaimSnapshot, key: DeepClaimBuildingId): BuildingChangeMoment | null {
  if (!sameCompany(before, after) || after.revision <= before.revision) return null;
  const old = before.buildings.find(item => item.key === key), current = after.buildings.find(item => item.key === key);
  if (!old || !current || current.level <= old.level) return null;
  return { key, fromLevel: old.level, toLevel: current.level, effect: current.effect };
}

/** Follow public worker projection; if it enters fog, focus the disclosed approach. */
export function crewFocusPoint(snapshot: DeepClaimSnapshot, source: Pick<DeepClaimExpedition, 'id'>, now: number): DeepClaimPoint | null {
  const job = snapshot.expeditions.find(item => item.id === source.id), world = snapshot.world;
  if (!job || !world) return null;
  const known = new Set(world.tiles.map(tile => `${tile.x}:${tile.y}`));
  function visible(point: DeepClaimPoint): DeepClaimPoint | null {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    const cell = { x: Math.floor(point.x), y: Math.floor(point.y) };
    return cell.x >= 0 && cell.x < world!.width && cell.y >= 0 && (cell.y === 0 || known.has(`${cell.x}:${cell.y}`)) ? cell : null;
  }
  if (job.status === 'active') {
    const worker = projectWorkers(snapshot, now).find(worker => worker.job_id === job.id);
    const point = worker && visible(worker);
    if (point) return point;
  }
  const worksite = visible(job.target);
  if (worksite) return worksite;
  for (let index = job.path.length - 1; index >= 0; index--) {
    const approach = visible(job.path[index]);
    if (approach) return approach;
  }
  return null;
}
