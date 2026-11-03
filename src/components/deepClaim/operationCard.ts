import { resourceTotal } from '@/lib/deepClaim/catalog';
import type { DeepClaimExpedition, DeepClaimMineralId, DeepClaimSnapshot, DeepClaimStageKey, DeepClaimWorker } from '@/lib/deepClaim/types';
import { indexRevealedWorld } from '@/lib/deepClaim/visualProjection';

export const OPERATION_STEPS: readonly { key: DeepClaimStageKey; label: string }[] = [
  { key: 'travel', label: 'Travel' }, { key: 'setup', label: 'Set-up' }, { key: 'work', label: 'Work' },
  { key: 'haul', label: 'Haul' }, { key: 'return', label: 'Return' },
];
const TITLES = { explore: 'Exploration crew', extract: 'Extraction crew', survey: 'Survey crew', infrastructure: 'Installation crew' } as const;
const STAGES = { travel: 'Traveling', setup: 'Preparing', work: 'Working', haul: 'Hauling', return: 'Returning' } as const;

export interface OperationCardModel {
  source: DeepClaimExpedition | null;
  crew: DeepClaimWorker[];
  crewCount: number;
  title: string;
  status: string;
  stageIndex: number;
  fraction: number;
  ready: boolean;
  canCheckReturn: boolean;
  units: number;
  material: DeepClaimMineralId | null;
}

/** Presentation of the current authorized DTO. Clocks cannot advance its stage or return state. */
export function operationCardModel(snapshot: DeepClaimSnapshot, requested: Pick<DeepClaimExpedition, 'id'>, now: number): OperationCardModel {
  const source = snapshot.company ? snapshot.expeditions.find(job => job.id === requested.id) ?? null : null;
  if (!source) return { source: null, crew: [], crewCount: 0, title: 'Shift unavailable', status: 'Sync needed', stageIndex: -1, fraction: 0, ready: false, canCheckReturn: false, units: 0, material: null };
  const start = Date.parse(source.started_at), end = Date.parse(source.completes_at);
  const clockValid = Number.isFinite(now) && Number.isFinite(start) && Number.isFinite(end) && end > start;
  const ready = source.status === 'ready', finished = ready || source.status === 'collected';
  const canCheckReturn = source.status === 'active' && (!clockValid || now >= end);
  const stageIndex = OPERATION_STEPS.findIndex(step => step.key === source.stage);
  const work = source.mode === 'extract' ? 'Mining' : source.mode === 'explore' ? 'Exploring' : source.mode === 'survey' ? 'Surveying' : 'Installing';
  const status = ready ? 'Haul ready' : source.status === 'collected' ? 'Shift complete'
    : !clockValid ? 'Sync needed' : canCheckReturn ? 'Awaiting report'
      : source.stage === 'work' ? work : stageIndex >= 0 ? STAGES[OPERATION_STEPS[stageIndex].key] : 'Working';
  const workerIds = [...new Set(source.worker_ids)].slice(0, 3);
  const crew = workerIds.flatMap(id => { const worker = snapshot.workers.find(item => item.id === id); return worker ? [worker] : []; });
  const tile = snapshot.world ? indexRevealedWorld(snapshot.world).known.get(`${source.target.x}:${source.target.y}`) : null;
  const total = resourceTotal(source.cargo ?? {});
  return {
    source, crew, crewCount: workerIds.length, title: TITLES[source.mode], status, stageIndex,
    fraction: finished ? 100 : clockValid ? Math.max(0, Math.min(100, 100 * (now - start) / (end - start))) : 0,
    ready, canCheckReturn, units: ready && Number.isSafeInteger(total) && total >= 0 ? total : 0,
    material: tile?.material ?? null,
  };
}
