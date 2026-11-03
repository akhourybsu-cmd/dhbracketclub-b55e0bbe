/** Editable planning only. The existing server preview and dispatch remain authoritative. */
import { claimTargets } from '@/components/deepClaim/display';
import { DURATION_OPTIONS } from './catalog';
import type { DeepClaimDuration, DeepClaimExpedition, DeepClaimPoint, DeepClaimSnapshot } from './types';

export interface DeepClaimDispatchDraft {
  workerIds: readonly string[];
  durationMinutes: DeepClaimDuration;
  /** A returned crew always plans an ordinary shift, never another induction. */
  ordinary?: boolean;
}

export interface NextShiftPlan extends DeepClaimDispatchDraft {
  sourceExpeditionId: string;
  mode: 'explore' | 'extract';
  target: DeepClaimPoint;
  tutorial: false;
  ordinary: true;
  targetChanged: boolean;
  crewChanged: boolean;
}

export interface NextShiftPlanResult {
  plan: NextShiftPlan | null;
  reasons: string[];
}

const samePoint = (a: DeepClaimPoint, b: DeepClaimPoint) => a.x === b.x && a.y === b.y;
const distance = (a: DeepClaimPoint, b: DeepClaimPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Uses the latest owned snapshot, not the stale pre-collection job or a client timer. */
export function deriveNextShiftPlan(snapshot: DeepClaimSnapshot, previous: DeepClaimExpedition): NextShiftPlanResult {
  const company = snapshot.company;
  if (!company || !snapshot.world) return { plan: null, reasons: ['Reconnect to your company before planning a shift.'] };
  const source = snapshot.expeditions.find(job => job.id === previous.id);
  if (!source || source.status !== 'collected' || (source.mode !== 'explore' && source.mode !== 'extract')) {
    return { plan: null, reasons: ['Collect this mining shift before planning the next one.'] };
  }

  const reasons: string[] = [];
  if (snapshot.expeditions.some(job => job.status === 'ready')) reasons.push('Collect the remaining haul first.');
  if (snapshot.production_jobs?.some(job => job.status === 'ready')) reasons.push('Collect the finished production first.');
  if (company.warehouse_used >= company.warehouse_capacity) reasons.push('Make room in the warehouse first.');
  if ((snapshot.discovery_summary?.pending ?? 0) >= (snapshot.field_catalog?.caps.pending_dispatch ?? 24)) reasons.push('Review pending finds before sending another crew.');
  if (snapshot.expeditions.filter(job => job.status === 'active').length >= company.crew_slots) reasons.push('Wait for an open crew slot.');

  // Tutorial timing is deliberately not copied. Its normal preset is a quick run.
  const durationMinutes = source.tutorial ? 20 : source.duration_minutes;
  const duration = DURATION_OPTIONS.find(option => option.minutes === durationMinutes);
  if (!duration) return { plan: null, reasons: [...reasons, 'Choose a current shift duration.'] };
  const eligible = snapshot.workers.filter(worker => !worker.assigned_job_id && worker.energy >= duration.energy);
  const availableIds = new Set(eligible.map(worker => worker.id));
  const previousIds = [...new Set(source.worker_ids)].slice(0, 3);
  const reusedIds = previousIds.filter(id => availableIds.has(id));
  const workerIds = reusedIds.length ? reusedIds : eligible.slice(0, 3).map(worker => worker.id);
  if (!workerIds.length) reasons.push('No rested crew is available for this shift.');

  const targets = claimTargets(snapshot, source.mode);
  const tiles = new Map(snapshot.world.tiles.map(tile => [`${tile.x}:${tile.y}`, tile]));
  const sourceMaterial = tiles.get(`${source.target.x}:${source.target.y}`)?.material;
  const orderedTargets = [...targets].sort((a, b) => distance(a, source.target) - distance(b, source.target) || a.y - b.y || a.x - b.x);
  const target = targets.find(point => samePoint(point, source.target))
    ?? (source.mode === 'extract' && sourceMaterial ? orderedTargets.find(point => tiles.get(`${point.x}:${point.y}`)?.material === sourceMaterial) : undefined)
    ?? orderedTargets[0];
  if (!target) reasons.push(source.mode === 'extract' ? 'Expand tunnels to find another workable deposit.' : 'No connected frontier is available.');
  if (reasons.length || !target) return { plan: null, reasons };

  return {
    plan: {
      sourceExpeditionId: source.id,
      mode: source.mode,
      target: { ...target },
      workerIds: [...workerIds],
      durationMinutes,
      tutorial: false,
      ordinary: true,
      targetChanged: !samePoint(target, source.target),
      crewChanged: previousIds.length !== workerIds.length || previousIds.some(id => !workerIds.includes(id)),
    },
    reasons: [],
  };
}
