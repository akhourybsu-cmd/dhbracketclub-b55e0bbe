import {
  DEEP_CLAIM_BUILDING_IDS, DEEP_CLAIM_DAILY_ENERGY, DEEP_CLAIM_RESOURCE_IDS, DEEP_CLAIM_SPECIALTIES,
  DEEP_CLAIM_STAT_IDS, type DeepClaimExpedition, type DeepClaimPoint, type DeepClaimPreview, type DeepClaimResources,
  type DeepClaimSnapshot, type DeepClaimTile, type DeepClaimWorkerPosition, type DeepClaimWorld,
} from './types';
import { resourceTotal } from './catalog';

export class DeepClaimValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'DeepClaimValidationError'; }
}
function fail(message: string): never { throw new DeepClaimValidationError(message); }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
const text = (value: unknown, max = 128): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const memberOf = (value: unknown, choices: readonly string[]): value is string => typeof value === 'string' && choices.includes(value);
const stageKeys = ['travel','setup','work','haul','return'];
function point(value: unknown, allowSurface = true): value is DeepClaimPoint {
  return object(value) && keys(value, ['x','y']) && integer(value.x, 0, 95) && integer(value.y, allowSurface ? 0 : 1, 1_000_000);
}
export function validateDeepClaimResources(value: unknown): asserts value is DeepClaimResources {
  if (!object(value) || !keys(value, DEEP_CLAIM_RESOURCE_IDS) || Object.values(value).some(amount => !integer(amount))) fail('Invalid Deep Claim resource quantities.');
}
/** Rejects private world content rather than silently ignoring unknown keys. */
export function validateDeepClaimWorld(value: unknown): asserts value is DeepClaimWorld {
  if (!object(value) || !keys(value, ['width','chunk_size','max_depth','revision','tiles']) || value.width !== 96 || value.chunk_size !== 32
    || !integer(value.max_depth, 1, 1_000_000) || !integer(value.revision) || !Array.isArray(value.tiles)) fail('Invalid revealed mine world.');
  const seen = new Set<string>();
  for (const tile of value.tiles) {
    if (!object(tile) || !keys(tile, ['x','y','terrain','material','remaining','initial_amount'])
      || !integer(tile.x, 0, 95) || !integer(tile.y, 0, 1_000_000) || !memberOf(tile.terrain, ['soil','stone','excavated'])
      || tile.material !== null && !memberOf(tile.material, DEEP_CLAIM_RESOURCE_IDS)
      || !integer(tile.remaining) || !integer(tile.initial_amount) || tile.remaining > tile.initial_amount
      || tile.material === null && tile.remaining !== 0
      || tile.terrain === 'excavated' && tile.remaining !== 0 || seen.has(`${tile.x}:${tile.y}`)) fail('Invalid revealed terrain or deposit.');
    seen.add(`${tile.x}:${tile.y}`);
  }
}
function validateJob(value: unknown): asserts value is DeepClaimExpedition {
  const fields = ['id','mode','status','worker_ids','target','path','stages','stage','started_at','completes_at','duration_minutes','duration_seconds','tutorial','wages','energy_per_worker','config_version','cargo'];
  if (!object(value) || !keys(value, fields) || !text(value.id) || !memberOf(value.mode, ['explore','extract'])
    || !memberOf(value.status, ['active','ready','collected']) || !Array.isArray(value.worker_ids) || value.worker_ids.length < 1 || value.worker_ids.length > 3
    || value.worker_ids.some(id => !text(id)) || new Set(value.worker_ids).size !== value.worker_ids.length || !point(value.target, false)
    || !Array.isArray(value.path) || value.path.length < 1 || !value.path.every(entry => point(entry)) || !Array.isArray(value.stages) || value.stages.length !== 5
    || !timestamp(value.started_at) || !timestamp(value.completes_at) || ![20,60,180].includes(Number(value.duration_minutes))
    || !integer(value.duration_seconds, 1) || Date.parse(value.completes_at) - Date.parse(value.started_at) !== value.duration_seconds * 1000
    || typeof value.tutorial !== 'boolean' || !integer(value.wages) || !integer(value.energy_per_worker, 1, 3) || value.config_version !== 1) fail('Invalid expedition.');
  let cursor = Date.parse(value.started_at);
  for (let i = 0; i < value.stages.length; i++) {
    const stage = value.stages[i];
    if (!object(stage) || !keys(stage, ['key','starts_at','ends_at']) || stage.key !== stageKeys[i] || !timestamp(stage.starts_at)
      || !timestamp(stage.ends_at) || Date.parse(stage.starts_at) !== cursor || Date.parse(stage.ends_at) <= cursor) fail('Invalid expedition stage clock.');
    cursor = Date.parse(stage.ends_at);
  }
  if (cursor !== Date.parse(value.completes_at)) fail('Invalid expedition completion clock.');
  if (value.status === 'active') {
    if (!memberOf(value.stage, stageKeys) || value.cargo !== null) fail('Active expeditions must not reveal future cargo.');
  } else {
    if (value.stage !== value.status) fail('Invalid settled expedition stage.');
    validateDeepClaimResources(value.cargo);
  }
}
export function validateDeepClaimSnapshot(value: unknown, identity?: { userId: string; clubId: string }): asserts value is DeepClaimSnapshot {
  if (!object(value) || !keys(value, ['schema_version','server_now','revision','company','resources','workers','world','expeditions','buildings','log'])
    || value.schema_version !== 1 || !timestamp(value.server_now) || !integer(value.revision)
    || !Array.isArray(value.workers) || !Array.isArray(value.expeditions) || !Array.isArray(value.buildings) || !Array.isArray(value.log)) fail('Invalid Deep Claim save.');
  validateDeepClaimResources(value.resources);
  if (value.company === null) {
    if (value.world !== null || value.revision !== 0 || value.workers.length || value.expeditions.length || value.buildings.length || value.log.length || resourceTotal(value.resources)) fail('Invalid company setup state.');
    return;
  }
  const c = value.company;
  if (!object(c) || !keys(c, ['id','club_id','user_id','name','cash','timezone','energy_day','tutorial_used','warehouse_capacity','warehouse_used','crew_slots'])
    || !text(c.id) || !text(c.club_id) || !text(c.user_id) || !text(c.name, 64) || !integer(c.cash) || !text(c.timezone, 80)
    || typeof c.energy_day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.energy_day) || typeof c.tutorial_used !== 'boolean'
    || !integer(c.warehouse_capacity, 1) || !integer(c.warehouse_used) || c.warehouse_used > c.warehouse_capacity
    || c.warehouse_used !== resourceTotal(value.resources) || !integer(c.crew_slots, 1, 3)
    || identity && (c.user_id !== identity.userId || c.club_id !== identity.clubId)) fail('Invalid company identity or inventory.');
  validateDeepClaimWorld(value.world);
  const workerIds = new Set<string>();
  if (value.workers.length !== 3) fail('Invalid starter workforce.');
  for (const worker of value.workers) {
    if (!object(worker) || !keys(worker, ['id','name','specialty','traits','stats','xp','level','energy','assigned_job_id'])
      || !text(worker.id) || workerIds.has(worker.id) || !text(worker.name, 80) || !memberOf(worker.specialty, DEEP_CLAIM_SPECIALTIES)
      || !Array.isArray(worker.traits) || worker.traits.some(trait => !text(trait, 80)) || !object(worker.stats) || !keys(worker.stats, DEEP_CLAIM_STAT_IDS)
      || DEEP_CLAIM_STAT_IDS.some(id => !integer(worker.stats[id], 1, 100)) || !integer(worker.xp) || !integer(worker.level, 1, 10)
      || !integer(worker.energy, 0, DEEP_CLAIM_DAILY_ENERGY) || worker.assigned_job_id !== null && !text(worker.assigned_job_id)) fail('Invalid worker record.');
    workerIds.add(worker.id);
  }
  const jobs = new Set<string>(), activeWorkers = new Set<string>();
  for (const job of value.expeditions) {
    validateJob(job);
    if (jobs.has(job.id) || job.worker_ids.some(id => !workerIds.has(id))) fail('Invalid expedition crew.');
    jobs.add(job.id);
    if (job.status === 'active') for (const id of job.worker_ids) {
      if (activeWorkers.has(id) || !value.workers.some(worker => worker.id === id && worker.assigned_job_id === job.id)) fail('Overlapping worker assignments.');
      activeWorkers.add(id);
    }
  }
  const expeditions = value.expeditions as DeepClaimExpedition[];
  if (value.workers.some(worker => worker.assigned_job_id !== null && !expeditions.some(job => job.id === worker.assigned_job_id && job.status === 'active' && job.worker_ids.includes(worker.id)))) fail('Invalid active worker assignment.');
  if (new Set(value.buildings.map(building => object(building) ? building.key : null)).size !== 4 || value.buildings.length !== 4) fail('Invalid company buildings.');
  for (const building of value.buildings) if (!object(building) || !keys(building, ['key','level','max_level','upgrade_cost','effect'])
    || !memberOf(building.key, DEEP_CLAIM_BUILDING_IDS) || !integer(building.level, 1, 3) || building.max_level !== 3
    || building.upgrade_cost !== null && !integer(building.upgrade_cost, 1) || !text(building.effect, 240)) fail('Invalid building upgrade.');
  for (const entry of value.log) if (!object(entry) || !keys(entry, ['id','kind','title','created_at']) || !text(entry.id) || !text(entry.kind, 60) || !text(entry.title, 240) || !timestamp(entry.created_at)) fail('Invalid company log.');
}
export function validateDeepClaimPreview(value: unknown): asserts value is DeepClaimPreview {
  const fields = ['allowed','reasons','company_revision','server_now','wages','energy_per_worker','duration_seconds','estimated_yield','route','stages','cargo_capacity','risk_level','accessible_depth','expected_resources','projected_completion_at'];
  if (!object(value) || !keys(value, fields) || typeof value.allowed !== 'boolean' || !Array.isArray(value.reasons) || value.reasons.some(reason => !text(reason, 300))
    || !integer(value.company_revision) || !timestamp(value.server_now) || !integer(value.wages) || !integer(value.energy_per_worker, 0, 3) || !integer(value.duration_seconds)
    || !object(value.estimated_yield) || !keys(value.estimated_yield, ['min','max']) || !integer(value.estimated_yield.min) || !integer(value.estimated_yield.max)
    || value.estimated_yield.min > value.estimated_yield.max || !Array.isArray(value.route) || !value.route.every(entry => point(entry))
    || !integer(value.cargo_capacity) || !memberOf(value.risk_level, ['low','moderate','high']) || !integer(value.accessible_depth)
    || !Array.isArray(value.expected_resources) || value.expected_resources.some(id => !memberOf(id, DEEP_CLAIM_RESOURCE_IDS)) || !timestamp(value.projected_completion_at)
    || !Array.isArray(value.stages) || value.stages.some(stage => !object(stage) || !keys(stage, ['key','duration_seconds']) || !memberOf(stage.key, stageKeys) || !integer(stage.duration_seconds))) fail('Invalid expedition preview.');
  if (value.allowed && value.reasons.length || !value.allowed && !value.reasons.length) fail('Invalid expedition preview availability.');
}

export const tileKey = ({ x, y }: DeepClaimPoint) => `${x}:${y}`;
export function chunkAddress({ x, y }: DeepClaimPoint): { x: number; y: number; key: string } {
  const cx = Math.floor(x / 32), cy = Math.floor(y / 32); return { x: cx, y: cy, key: `${cx}:${cy}` };
}
export function revealedChunkMap(world: DeepClaimWorld): Map<string, DeepClaimTile[]> {
  const chunks = new Map<string, DeepClaimTile[]>();
  for (const tile of world.tiles) { const key = chunkAddress(tile).key; const group = chunks.get(key) ?? []; group.push(tile); chunks.set(key, group); }
  return chunks;
}
function alongPath(path: readonly DeepClaimPoint[], progress: number): DeepClaimPoint {
  if (!path.length) return { x: 48, y: 0 };
  const lengths = path.slice(1).map((point, index) => Math.abs(point.x - path[index].x) + Math.abs(point.y - path[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let distance = total * progress;
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i]) {
      const ratio = lengths[i] > 0 ? distance / lengths[i] : 0;
      return { x: path[i].x + (path[i + 1].x - path[i].x) * ratio, y: path[i].y + (path[i + 1].y - path[i].y) * ratio };
    }
    distance -= lengths[i];
  }
  return { ...path[path.length - 1] };
}
/** Pure visual projection: never advances the server-declared stage or commits terrain/rewards. */
export function projectWorkers(snapshot: DeepClaimSnapshot, estimatedServerNowMs = Date.parse(snapshot.server_now)): DeepClaimWorkerPosition[] {
  const at = Math.max(Date.parse(snapshot.server_now), Number.isFinite(estimatedServerNowMs) ? estimatedServerNowMs : 0);
  return snapshot.workers.map((worker, index) => {
    const job = snapshot.expeditions.find(job => job.id === worker.assigned_job_id && job.status === 'active');
    const stage = job?.stages.find(stage => stage.key === job.stage);
    if (!job || !stage) return { worker_id: worker.id, job_id: null, x: 22 + index * 2, y: 0, stage: 'idle', progress: 0, elapsed_seconds: 0, pose: 'idle' };
    const start = Date.parse(stage.starts_at), end = Date.parse(stage.ends_at);
    const elapsed_seconds = Math.max(0, Math.min(end - start, at - start)) / 1000;
    const progress = end > start ? elapsed_seconds * 1000 / (end - start) : 1;
    const position = job.stage === 'travel' ? alongPath(job.path, progress) : job.stage === 'return' ? alongPath([...job.path].reverse(), progress) : job.target;
    return { worker_id: worker.id, job_id: job.id, ...position, stage: job.stage, progress, elapsed_seconds,
      pose: job.stage === 'travel' || job.stage === 'return' ? 'walk' : job.stage === 'haul' ? 'haul' : 'work' };
  });
}
export const projectWorkerPositions = projectWorkers;
