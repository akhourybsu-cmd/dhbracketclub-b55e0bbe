import {
  DEEP_CLAIM_FORMATIONS, DEEP_CLAIM_INFRASTRUCTURE_KEYS, DEEP_CLAIM_DISCOVERY_KINDS, DEEP_CLAIM_DISCOVERY_QUALITIES, DEEP_CLAIM_BUILDING_IDS, DEEP_CLAIM_DAILY_ENERGY, DEEP_CLAIM_MINERAL_IDS, DEEP_CLAIM_RESOURCE_IDS, DEEP_CLAIM_SPECIALTIES,
  DEEP_CLAIM_STAT_IDS, type DeepClaimExpedition, type DeepClaimPoint, type DeepClaimPreview, type DeepClaimResources,
  type DeepClaimSnapshot, type DeepClaimTile, type DeepClaimWorkerPosition, type DeepClaimWorld,
} from './types';
import { EQUIPMENT_BY_KEY, FIELD_CATALOG, RECIPE_BY_KEY, resourceTotal } from './catalog';
import { discoverySpecimen } from './field';
import { equipmentRepairQuote, workerStatsWithEquipment } from './production';

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
    if (!object(tile) || !keys(tile, ['x','y','terrain','material','remaining','initial_amount','formation'])
      || !integer(tile.x, 0, 95) || !integer(tile.y, 0, 1_000_000) || !memberOf(tile.terrain, ['soil','stone','excavated'])
      || tile.material !== null && !memberOf(tile.material, DEEP_CLAIM_MINERAL_IDS)
      || tile.formation !== undefined && tile.formation !== null && !memberOf(tile.formation, DEEP_CLAIM_FORMATIONS)
      || !integer(tile.remaining) || !integer(tile.initial_amount) || tile.remaining > tile.initial_amount
      || tile.material === null && tile.remaining !== 0
      || tile.terrain === 'excavated' && tile.remaining !== 0 || seen.has(`${tile.x}:${tile.y}`)) fail('Invalid revealed terrain or deposit.');
    seen.add(`${tile.x}:${tile.y}`);
  }
}
function validateJob(value: unknown): asserts value is DeepClaimExpedition {
  const fields = ['id','mode','status','worker_ids','target','path','stages','stage','started_at','completes_at','duration_minutes','duration_seconds','tutorial','wages','energy_per_worker','config_version','cargo'];
  if (!object(value) || !keys(value, fields) || !text(value.id) || !memberOf(value.mode, ['explore','extract','survey','infrastructure'])
    || !memberOf(value.status, ['active','ready','collected']) || !Array.isArray(value.worker_ids) || value.worker_ids.length < 1 || value.worker_ids.length > 3
    || value.worker_ids.some(id => !text(id)) || new Set(value.worker_ids).size !== value.worker_ids.length || !point(value.target, false)
    || !Array.isArray(value.path) || value.path.length < 1 || !value.path.every(entry => point(entry)) || !Array.isArray(value.stages) || value.stages.length !== 5
    || !timestamp(value.started_at) || !timestamp(value.completes_at) || ![20,60,180].includes(value.duration_minutes as number)
    || !integer(value.duration_seconds, 1) || Date.parse(value.completes_at) - Date.parse(value.started_at) !== value.duration_seconds * 1000
    || typeof value.tutorial !== 'boolean' || !integer(value.wages) || !integer(value.energy_per_worker, 1, 3) || ![1,2,3].includes(value.config_version as number)) fail('Invalid expedition.');
  if (['survey','infrastructure'].includes(String(value.mode)) && value.config_version !== 3) fail('Field operations require version-three rules.');
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
    if (['survey','infrastructure'].includes(String(value.mode)) && (value.status !== 'collected' || resourceTotal(value.cargo)>0)) fail('Field operations settle without staged cargo.');
  }
}
export function validateDeepClaimSnapshot(value: unknown, identity?: { userId: string; clubId: string }): asserts value is DeepClaimSnapshot {
  if (!object(value) || !keys(value, ['schema_version','server_now','revision','company','resources','workers','world','expeditions','buildings','log','candidates','equipment','production_jobs','recipes','equipment_catalog','infrastructure','discoveries','discovery_summary','field_reports','field_catalog'])
    || ![1,2,3].includes(value.schema_version as number) || !timestamp(value.server_now) || !integer(value.revision)
    || !Array.isArray(value.workers) || !Array.isArray(value.expeditions) || !Array.isArray(value.buildings) || !Array.isArray(value.log)) fail('Invalid Deep Claim save.');
  validateDeepClaimResources(value.resources);
  const v2 = Number(value.schema_version) >= 2, v3=value.schema_version===3;
  if(v3) validatePhaseThreeCollections(value);
  else if(['infrastructure','discoveries','discovery_summary','field_reports','field_catalog'].some(key=>value[key]!==undefined)) fail('Field records require a version-three save.');
  if (v2) validatePhaseTwoCollections(value);
  else if (['candidates','equipment','production_jobs','recipes','equipment_catalog'].some(key => value[key] !== undefined)) fail('Phase-two records require a version-two save.');
  if (value.company === null) {
    if (value.world !== null || value.revision !== 0 || value.workers.length || value.expeditions.length || value.buildings.length || value.log.length || resourceTotal(value.resources)
      || v3 && ((value.infrastructure as unknown[]).length || (value.discoveries as unknown[]).length || (value.field_reports as unknown[]).length || Object.values(value.discovery_summary as Record<string,number>).some(Boolean))
      || v2 && ['candidates','equipment','production_jobs'].some(key => (value[key] as unknown[]).length > 0)) fail('Invalid company setup state.');
    return;
  }
  const c = value.company;
  if (!object(c) || !keys(c, ['id','club_id','user_id','name','cash','timezone','energy_day','tutorial_used','warehouse_capacity','warehouse_used','crew_slots','worker_capacity','equipment_capacity'])
    || !text(c.id) || !text(c.club_id) || !text(c.user_id) || !text(c.name, 64) || !integer(c.cash) || !text(c.timezone, 80)
    || typeof c.energy_day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.energy_day) || typeof c.tutorial_used !== 'boolean'
    || !integer(c.warehouse_capacity, 1) || !integer(c.warehouse_used) || c.warehouse_used > c.warehouse_capacity
    || c.warehouse_used !== resourceTotal(value.resources) || !integer(c.crew_slots, 1, 3)
    || v2 && (!integer(c.worker_capacity,3,12) || c.equipment_capacity !== 48)
    || identity && (c.user_id !== identity.userId || c.club_id !== identity.clubId)) fail('Invalid company identity or inventory.');
  validateDeepClaimWorld(value.world);
  const workerIds = new Set<string>();
  if (value.workers.length < 3 || value.workers.length > (v2 ? Number(c.worker_capacity) : 3)) fail('Invalid company workforce.');
  for (const worker of value.workers) {
    if (!object(worker) || !keys(worker, ['id','name','specialty','traits','stats','xp','level','energy','assigned_job_id','wage','base_stats','trained_day','training_cost','training_gain','equipment_ids'])
      || !text(worker.id) || workerIds.has(worker.id) || !text(worker.name, 80) || !memberOf(worker.specialty, DEEP_CLAIM_SPECIALTIES)
      || !Array.isArray(worker.traits) || worker.traits.some(trait => !text(trait, 80)) || !object(worker.stats) || !keys(worker.stats, DEEP_CLAIM_STAT_IDS)
      || DEEP_CLAIM_STAT_IDS.some(id => !integer(worker.stats[id], 1, 100)) || !integer(worker.xp) || !integer(worker.level, 1, 10)
      || !integer(worker.energy, 0, DEEP_CLAIM_DAILY_ENERGY) || worker.assigned_job_id !== null && !text(worker.assigned_job_id)) fail('Invalid worker record.');
    if (v2 && (!integer(worker.wage,1) || !validStats(worker.base_stats) || worker.trained_day !== null && !day(worker.trained_day)
      || worker.training_cost !== 30 || worker.training_gain !== 3 || !Array.isArray(worker.equipment_ids)
      || worker.equipment_ids.length > 3 || worker.equipment_ids.some(id => !text(id)) || new Set(worker.equipment_ids).size !== worker.equipment_ids.length)) fail('Invalid worker training or equipment record.');
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
  if (new Set(value.buildings.map(building => object(building) ? building.key : null)).size !== (v2 ? 7 : 4) || value.buildings.length !== (v2 ? 7 : 4)) fail('Invalid company buildings.');
  for (const building of value.buildings) if (!object(building) || !keys(building, ['key','level','max_level','upgrade_cost','effect'])
    || !memberOf(building.key, v2 ? DEEP_CLAIM_BUILDING_IDS : DEEP_CLAIM_BUILDING_IDS.slice(0,4))
    || !integer(building.level, v2 && ['workers_quarters','smeltery','gem_workshop'].includes(String(building.key)) ? 0 : 1, v2 && building.key === 'mine_shaft' ? (v3 ? 5 : 4) : 3)
    || building.max_level !== (v2 && building.key === 'mine_shaft' ? (v3 ? 5 : 4) : 3)
    || building.upgrade_cost !== null && !integer(building.upgrade_cost, 1) || !text(building.effect, 240)) fail('Invalid building upgrade.');
  if (v2) validatePhaseTwoAssignments(value as unknown as DeepClaimSnapshot);
  for (const entry of value.log) if (!object(entry) || !keys(entry, ['id','kind','title','created_at']) || !text(entry.id) || !text(entry.kind, 60) || !text(entry.title, 240) || !timestamp(entry.created_at)) fail('Invalid company log.');
}
export function validateDeepClaimPreview(value: unknown): asserts value is DeepClaimPreview {
  const fields = ['allowed','reasons','company_revision','server_now','wages','energy_per_worker','duration_seconds','estimated_yield','route','stages','cargo_capacity','risk_level','accessible_depth','expected_resources','projected_completion_at','operation_version','operation_cost','materials_cost','conditions','survey','installation'];
  if (!object(value) || !keys(value, fields) || typeof value.allowed !== 'boolean' || !Array.isArray(value.reasons) || value.reasons.some(reason => !text(reason, 300))
    || !integer(value.company_revision) || !timestamp(value.server_now) || !integer(value.wages) || !integer(value.energy_per_worker, 0, 3) || !integer(value.duration_seconds)
    || !object(value.estimated_yield) || !keys(value.estimated_yield, ['min','max']) || !integer(value.estimated_yield.min) || !integer(value.estimated_yield.max)
    || value.estimated_yield.min > value.estimated_yield.max || !Array.isArray(value.route) || !value.route.every(entry => point(entry))
    || !integer(value.cargo_capacity) || !memberOf(value.risk_level, ['low','moderate','high']) || !integer(value.accessible_depth)
    || !Array.isArray(value.expected_resources) || value.expected_resources.some(id => !memberOf(id, DEEP_CLAIM_MINERAL_IDS)) || !timestamp(value.projected_completion_at)
    || !Array.isArray(value.stages) || value.stages.some(stage => !object(stage) || !keys(stage, ['key','duration_seconds']) || !memberOf(stage.key, stageKeys) || !integer(stage.duration_seconds))) fail('Invalid expedition preview.');
  if(value.operation_version!==undefined) validatePhaseThreePreview(value);
  else if(['operation_cost','materials_cost','conditions','survey','installation'].some(key=>value[key]!==undefined)) fail('Field quotes require version-three rules.');
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

const day = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
function validStats(value: unknown) { return object(value) && keys(value,DEEP_CLAIM_STAT_IDS) && DEEP_CLAIM_STAT_IDS.every(key => integer(value[key],1,100)); }
function sameAmounts(first: DeepClaimResources, second: DeepClaimResources) {
  return DEEP_CLAIM_RESOURCE_IDS.every(id => (first[id] ?? 0) === (second[id] ?? 0));
}
function validatePhaseTwoCollections(value: Record<string,unknown>) {
  for (const name of ['candidates','equipment','production_jobs','recipes','equipment_catalog']) if (!Array.isArray(value[name])) fail('A version-two save requires workforce and production catalogs.');
  const equipmentCatalog = value.equipment_catalog as unknown[], recipes = value.recipes as unknown[], candidates = value.candidates as unknown[], equipment = value.equipment as unknown[], jobs = value.production_jobs as unknown[];
  // A member without a company has no operational catalogs yet. Both may
  // be empty only at the exact revision-zero bootstrap boundary.
  if (value.company === null && value.revision === 0 && equipmentCatalog.length === 0 && recipes.length === 0
    && candidates.length === 0 && equipment.length === 0 && jobs.length === 0) return;
  if (equipmentCatalog.length !== Object.keys(EQUIPMENT_BY_KEY).length || recipes.length !== Object.keys(RECIPE_BY_KEY).length || candidates.length > 7) fail('Invalid workforce or recipe catalog.');
  const definitionKeys = new Set<string>(), recipeKeys = new Set<string>(), candidateIds = new Set<string>(), equipmentIds = new Set<string>(), jobIds = new Set<string>();
  for (const definition of equipmentCatalog) {
    if (!object(definition) || !keys(definition,['key','name','slot','tier','max_durability','bonuses','repair_rate','repair_materials']) || !text(definition.key)) fail('Invalid equipment catalog.');
    const canonical = EQUIPMENT_BY_KEY[definition.key];
    if (!canonical || definitionKeys.has(definition.key) || definition.name !== canonical.name || definition.slot !== canonical.slot || definition.tier !== canonical.tier || definition.max_durability !== canonical.max_durability || definition.repair_rate !== canonical.repair_rate || !object(definition.bonuses) || !keys(definition.bonuses,DEEP_CLAIM_STAT_IDS) || DEEP_CLAIM_STAT_IDS.some(stat => (definition.bonuses as Record<string,unknown>)[stat] !== undefined && !integer((definition.bonuses as Record<string,unknown>)[stat],0,30)) || DEEP_CLAIM_STAT_IDS.some(stat => ((definition.bonuses as Record<string,unknown>)[stat] ?? 0) !== (canonical.bonuses[stat] ?? 0))) fail('Unsupported equipment rules.');
    validateDeepClaimResources(definition.repair_materials);
    if (!sameAmounts(definition.repair_materials,canonical.repair_materials)) fail('Unsupported equipment repair materials.');
    definitionKeys.add(definition.key);
  }
  for (const recipe of recipes) {
    if (!object(recipe) || !keys(recipe,['key','version','name','station','required_station_level','duration_seconds','effective_duration_seconds','cash_cost','inputs','outputs','equipment_output','max_batches']) || !text(recipe.key)) fail('Invalid recipe catalog.');
    const canonical = RECIPE_BY_KEY[recipe.key];
    if (!canonical || recipeKeys.has(recipe.key) || recipe.version !== canonical.version || recipe.name !== canonical.name || recipe.station !== canonical.station || recipe.required_station_level !== canonical.required_station_level || recipe.duration_seconds !== canonical.duration_seconds || recipe.cash_cost !== canonical.cash_cost || recipe.equipment_output !== canonical.equipment_output || recipe.max_batches !== 10 || !integer(recipe.effective_duration_seconds,1)) fail('Unsupported production recipe.');
    validateDeepClaimResources(recipe.inputs); validateDeepClaimResources(recipe.outputs);
    if (!sameAmounts(recipe.inputs,canonical.inputs) || !sameAmounts(recipe.outputs,canonical.outputs)) fail('Unsupported recipe quantities.');
    recipeKeys.add(recipe.key);
  }
  for (const candidate of candidates) {
    if (!object(candidate) || !keys(candidate,['id','name','specialty','traits','stats','wage','hire_cost','operating_day','hired']) || !text(candidate.id) || candidateIds.has(candidate.id) || !text(candidate.name,80) || !memberOf(candidate.specialty,DEEP_CLAIM_SPECIALTIES) || !Array.isArray(candidate.traits) || candidate.traits.some(trait => !text(trait,80)) || !validStats(candidate.stats) || !integer(candidate.wage,1) || !integer(candidate.hire_cost,1) || !day(candidate.operating_day) || typeof candidate.hired !== 'boolean') fail('Invalid daily hiring candidate.');
    candidateIds.add(candidate.id);
  }
  for (const item of equipment) {
    if (!object(item) || !keys(item,['id','definition_key','worker_id','durability','max_durability','repair_cost','repair_materials']) || !text(item.id) || equipmentIds.has(item.id) || !text(item.definition_key) || item.worker_id !== null && !text(item.worker_id) || !integer(item.durability) || !integer(item.max_durability,1) || item.durability > item.max_durability || !integer(item.repair_cost)) fail('Invalid owned equipment.');
    const definition = EQUIPMENT_BY_KEY[item.definition_key];
    if (!definition || item.max_durability !== definition.max_durability) fail('Unsupported equipment durability.');
    validateDeepClaimResources(item.repair_materials);
    const repair=equipmentRepairQuote(definition,item.durability);
    if (item.repair_cost !== repair.cash_cost || !sameAmounts(item.repair_materials,repair.materials)) fail('Equipment repair quote does not match its condition.');
    equipmentIds.add(item.id);
  }
  for (const job of jobs) {
    if (!object(job) || !keys(job,['id','recipe_key','recipe_version','batches','station','status','started_at','completes_at','duration_seconds','cash_cost','inputs','outputs','equipment_outputs']) || !text(job.id) || jobIds.has(job.id) || !text(job.recipe_key) || !RECIPE_BY_KEY[job.recipe_key] || job.recipe_version !== 1 || !integer(job.batches,1,10) || job.station !== RECIPE_BY_KEY[job.recipe_key].station || !memberOf(job.status,['active','ready','collected']) || !timestamp(job.started_at) || !timestamp(job.completes_at) || !integer(job.duration_seconds,1) || Date.parse(job.completes_at)-Date.parse(job.started_at) !== job.duration_seconds*1000 || !integer(job.cash_cost) || !Array.isArray(job.equipment_outputs) || job.equipment_outputs.some(key => typeof key !== 'string' || !EQUIPMENT_BY_KEY[key]) || job.equipment_outputs.length > job.batches) fail('Invalid production job.');
    validateDeepClaimResources(job.inputs); validateDeepClaimResources(job.outputs);
    const recipe=RECIPE_BY_KEY[job.recipe_key];
    if (job.cash_cost !== recipe.cash_cost*job.batches
      || DEEP_CLAIM_RESOURCE_IDS.some(id=>(job.inputs as DeepClaimResources)[id] !== undefined && (job.inputs as DeepClaimResources)[id] !== (recipe.inputs[id]??0)*Number(job.batches))
      || DEEP_CLAIM_RESOURCE_IDS.some(id=>((job.inputs as DeepClaimResources)[id]??0) !== (recipe.inputs[id]??0)*Number(job.batches))
      || DEEP_CLAIM_RESOURCE_IDS.some(id=>((job.outputs as DeepClaimResources)[id]??0) > (recipe.outputs[id]??0)*Number(job.batches))
      || (job.equipment_outputs as string[]).some(key=>key!==recipe.equipment_output)) fail('Production quantities do not match the frozen recipe.');
    const possibleTimes=[1,2,3].filter(level=>level>=recipe.required_station_level).map(level=>Math.ceil(recipe.duration_seconds*[100,85,70][level-1]/100)*Number(job.batches));
    if (!possibleTimes.includes(Number(job.duration_seconds))) fail('Production timing does not match a supported station level.');
    if (job.status==='active' && (DEEP_CLAIM_RESOURCE_IDS.some(id=>((job.outputs as DeepClaimResources)[id]??0) !== (recipe.outputs[id]??0)*Number(job.batches)) || (job.equipment_outputs as string[]).length !== (recipe.equipment_output ? job.batches : 0))) fail('Active production must retain its complete uncollected outputs.');
    jobIds.add(job.id);
  }
  const pending = jobs.filter(job => (job as {status:string}).status !== 'collected');
  if (pending.length > 3 || equipment.length + pending.reduce<number>((sum,job) => sum + ((job as {equipment_outputs: unknown[]}).equipment_outputs.length),0) > 48) fail('Production queue or equipment capacity exceeded.');
}
function validatePhaseTwoAssignments(snapshot: DeepClaimSnapshot) {
  const equipment = snapshot.equipment!, recipes = snapshot.recipes!;
  const quarters = snapshot.buildings.find(building => building.key === 'workers_quarters')!.level;
  const office = snapshot.buildings.find(building => building.key === 'mine_office')!.level;
  const warehouse = snapshot.buildings.find(building => building.key === 'warehouse')!.level;
  const shaft = snapshot.buildings.find(building => building.key === 'mine_shaft')!.level;
  if (snapshot.company!.worker_capacity !== 3+3*quarters || snapshot.company!.crew_slots !== office
    || snapshot.company!.warehouse_capacity !== 120*2**(warehouse-1) || snapshot.world!.max_depth !== [49,99,149,299,599][shaft-1]) fail('Company capacity must match its actual buildings.');
  const usedSlots = new Set<string>();
  for (const item of equipment) if (item.worker_id !== null) {
    const worker = snapshot.workers.find(worker => worker.id === item.worker_id), slot = EQUIPMENT_BY_KEY[item.definition_key].slot;
    const key = `${item.worker_id}:${slot}`;
    if (!worker || !worker.equipment_ids!.includes(item.id) || usedSlots.has(key)) fail('Equipment must belong to exactly one worker slot.');
    usedSlots.add(key);
  }
  for (const worker of snapshot.workers) if (worker.equipment_ids!.some(id => !equipment.some(item => item.id === id && item.worker_id === worker.id))) fail('Invalid worker equipment assignment.');
  for (const worker of snapshot.workers) {
    const expected=workerStatsWithEquipment(worker.base_stats!,worker.xp,equipment.filter(item=>item.worker_id===worker.id));
    if (DEEP_CLAIM_STAT_IDS.some(stat=>worker.stats[stat]!==expected[stat])) fail('Worker effective stats must apply training, XP and usable gear once.');
  }
  for (const recipe of recipes) {
    const level = Math.max(1,snapshot.buildings.find(building => building.key === recipe.station)?.level ?? 1);
    const effective = Math.ceil(recipe.duration_seconds * [100,85,70][level-1] / 100);
    if (recipe.effective_duration_seconds !== effective) fail('Recipe timing does not match its operating station.');
  }
}

/** Canonical JSON comparison ignores transport object-key order while preserving array order. */
function semanticJSON(value:unknown):string {
  if(Array.isArray(value)) return `[${value.map(semanticJSON).join(',')}]`;
  if(object(value)) return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${semanticJSON(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function validatePhaseThreeCollections(value:Record<string,unknown>) {
  if(!Array.isArray(value.infrastructure) || value.infrastructure.length>128 || !Array.isArray(value.discoveries)
    || value.discoveries.length>84 || !Array.isArray(value.field_reports) || value.field_reports.length>24
    || semanticJSON(value.field_catalog)!==semanticJSON(FIELD_CATALOG)) fail('Unsupported underground operations catalog or collections.');
  const summary=value.discovery_summary;
  if(!object(summary) || !keys(summary,['pending','kept','sold','salvaged']) || !integer(summary.pending,0,48) || !integer(summary.kept) || !integer(summary.sold) || !integer(summary.salvaged)) fail('Invalid discovery summary.');
  const infrastructureIds=new Set<string>(), cells=new Set<string>(), discoveries=new Set<string>(), discoveryCells=new Set<string>(), reports=new Set<string>();
  const counts={pending:0,kept:0,sold:0,salvaged:0};
  for(const item of value.infrastructure) {
    if(!object(item) || !keys(item,['id','key','x','y','grade','radius','strength','status','job_id','installed_at']) || !text(item.id) || infrastructureIds.has(item.id)
      || !memberOf(item.key,DEEP_CLAIM_INFRASTRUCTURE_KEYS) || !integer(item.x,0,95) || !integer(item.y,1,599) || cells.has(`${item.x}:${item.y}`)
      || !integer(item.grade,1,3) || !integer(item.radius,6,12) || !integer(item.strength,5,40)
      || !memberOf(item.status,['building','installed']) || !text(item.job_id) || (item.status==='building' ? item.installed_at!==null : !timestamp(item.installed_at) || Date.parse(String(item.installed_at))>Date.parse(String(value.server_now)))) fail('Invalid installed infrastructure.');
    // Engineering was frozen when built, so it may differ from the current crew.
    const engineeringRadius=item.radius-(6+2*(item.grade-1));
    if(![0,1,2].includes(engineeringRadius) || item.key!=='rail' && (item.strength<3+2*item.grade || item.strength>7+2*item.grade)
      || item.key==='rail' && (item.strength<5+10*item.grade || item.strength>Math.min(40,10+10*item.grade))) fail('Invalid frozen infrastructure strength.');
    infrastructureIds.add(item.id);cells.add(`${item.x}:${item.y}`);
  }
  for(const item of value.discoveries) {
    if(!object(item) || !keys(item,['id','x','y','job_id','kind','name','quality','detail','sale_value','salvage','status','discovered_at','resolved_at'])
      || !text(item.id) || discoveries.has(item.id) || !integer(item.x,0,95) || !integer(item.y,1,599) || discoveryCells.has(`${item.x}:${item.y}`)
      || !text(item.job_id) || !memberOf(item.kind,DEEP_CLAIM_DISCOVERY_KINDS) || !memberOf(item.quality,DEEP_CLAIM_DISCOVERY_QUALITIES)
      || !text(item.name,100) || !text(item.detail,600) || !integer(item.sale_value,15,500) || !memberOf(item.status,['pending','kept','sold','salvaged'])
      || !timestamp(item.discovered_at) || Date.parse(item.discovered_at)>Date.parse(String(value.server_now))
      || (item.status==='pending' ? item.resolved_at!==null : !timestamp(item.resolved_at) || Date.parse(String(item.resolved_at))<Date.parse(item.discovered_at) || Date.parse(String(item.resolved_at))>Date.parse(String(value.server_now)))) fail('Invalid recovered discovery.');
    validateDeepClaimResources(item.salvage);
    const canonical=discoverySpecimen(item.kind as import('./types').DeepClaimDiscoveryKind,item.quality as import('./types').DeepClaimDiscoveryQuality);
    if(item.name!==canonical.name || item.detail!==canonical.detail || item.sale_value!==canonical.sale_value || !sameAmounts(item.salvage,canonical.salvage)) fail('Unsupported frozen discovery definition.');
    counts[item.status as keyof typeof counts]++;discoveries.add(item.id);discoveryCells.add(`${item.x}:${item.y}`);
  }
  if(counts.pending!==summary.pending || counts.kept!==Math.min(24,summary.kept) || counts.sold+counts.salvaged!==Math.min(12,summary.sold+summary.salvaged)
    || counts.sold>summary.sold || counts.salvaged>summary.salvaged) fail('Discovery history does not match its bounded summary.');
  for(const report of value.field_reports) {
    if(!object(report) || !keys(report,['id','job_id','kind','title','description','point','occurred_at','delay_seconds','tiles_revealed','infrastructure_id','discovery_id'])
      || !text(report.id) || reports.has(report.id) || !text(report.job_id) || !memberOf(report.kind,['incident','survey','infrastructure','discovery'])
      || !text(report.title,160) || !text(report.description,800) || !point(report.point,false) || !timestamp(report.occurred_at)
      || Date.parse(report.occurred_at)>Date.parse(String(value.server_now)) || !integer(report.delay_seconds,0,300) || !integer(report.tiles_revealed,0,41)
      || report.infrastructure_id!==null && !text(report.infrastructure_id) || report.discovery_id!==null && !text(report.discovery_id)) fail('Invalid committed field report.');
    reports.add(report.id);
  }
}
function validatePhaseThreePreview(value:Record<string,unknown>) {
  if(value.operation_version!==3 || !integer(value.operation_cost)) fail('Invalid operation quote version or cost.');
  validateDeepClaimResources(value.materials_cost);
  const conditions=value.conditions;
  if(!object(conditions) || !keys(conditions,['instability','gas','water','incident_chance_percent','max_delay_seconds','transport_bonus_percent','infrastructure_ids'])
    || !integer(conditions.instability,0,3) || !integer(conditions.gas,0,3) || !integer(conditions.water,0,3) || !integer(conditions.incident_chance_percent,0,25)
    || !integer(conditions.max_delay_seconds,0,300) || conditions.incident_chance_percent===0 && conditions.max_delay_seconds!==0
    || !integer(conditions.transport_bonus_percent,0,40) || !Array.isArray(conditions.infrastructure_ids) || conditions.infrastructure_ids.length>128
    || conditions.infrastructure_ids.some(id=>!text(id)) || new Set(conditions.infrastructure_ids).size!==conditions.infrastructure_ids.length) fail('Invalid public site conditions.');
  if(value.survey!==null && (!object(value.survey) || !keys(value.survey,['radius','tile_limit']) || !integer(value.survey.radius,1,4) || !integer(value.survey.tile_limit,1,41))) fail('Invalid survey quote.');
  if(value.installation!==null) {
    const installation=value.installation;
    if(!object(installation) || !keys(installation,['key','grade','radius','strength']) || !memberOf(installation.key,DEEP_CLAIM_INFRASTRUCTURE_KEYS)
      || !integer(installation.grade,1,3) || !integer(installation.radius,6,12) || !integer(installation.strength,5,40)) fail('Invalid infrastructure quote.');
  }
  if(value.survey!==null && value.installation!==null) fail('A quote cannot combine field operations.');
}
