/** Deep Claim public v1 identities. World seeds and unrevealed plans are server-private. */
export const DEEP_CLAIM_RULES_VERSION = 2;
export const DEEP_CLAIM_WORLD_WIDTH = 96;
export const DEEP_CLAIM_CHUNK_SIZE = 32;
export const DEEP_CLAIM_DAILY_ENERGY = 6;
export const DEEP_CLAIM_TIME_ZONE = 'America/New_York';
export const DEEP_CLAIM_TUTORIAL_SECONDS = 30;
export const DEEP_CLAIM_STAT_IDS = ['mining','geology','engineering','logistics','safety','endurance','leadership'] as const;
export type DeepClaimStatId = typeof DEEP_CLAIM_STAT_IDS[number];
export type DeepClaimStats = Record<DeepClaimStatId, number>;
export const DEEP_CLAIM_SPECIALTIES = ['miner','geologist','hauler','engineer','surveyor','demolitionist','safety_officer'] as const;
export type DeepClaimSpecialty = typeof DEEP_CLAIM_SPECIALTIES[number];
export const DEEP_CLAIM_MINERAL_IDS = ['stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore','amethyst','gold_ore'] as const;
export type DeepClaimMineralId = typeof DEEP_CLAIM_MINERAL_IDS[number];
export const DEEP_CLAIM_RESOURCE_IDS = [...DEEP_CLAIM_MINERAL_IDS,'copper_bar','tin_bar','iron_bar','silver_bar','polished_quartz','cut_amethyst'] as const;
export type DeepClaimResourceId = typeof DEEP_CLAIM_RESOURCE_IDS[number];
export type DeepClaimResources = Partial<Record<DeepClaimResourceId, number>>;
export const DEEP_CLAIM_BUILDING_IDS = ['mine_office','mine_shaft','warehouse','tool_station','workers_quarters','smeltery','gem_workshop'] as const;
export type DeepClaimBuildingId = typeof DEEP_CLAIM_BUILDING_IDS[number];
export type DeepClaimBuildings = Record<DeepClaimBuildingId, number>;
export type DeepClaimDuration = 20 | 60 | 180;
export type DeepClaimMode = 'explore' | 'extract';
export interface DeepClaimPoint { x: number; y: number }
export interface DeepClaimCompany {
  id: string;
  club_id: string;
  user_id: string;
  name: string;
  cash: number;
  timezone: string;
  energy_day: string;
  tutorial_used: boolean;
  warehouse_capacity: number;
  warehouse_used: number;
  crew_slots: number;
  worker_capacity?: number;
  equipment_capacity?: number;
}
export interface DeepClaimWorker {
  id: string;
  name: string;
  specialty: DeepClaimSpecialty;
  traits: string[];
  stats: DeepClaimStats;
  xp: number;
  level: number;
  energy: number;
  assigned_job_id: string | null;
  /** Schema2 only. stats above is already effective, including usable equipment. */
  wage?: number;
  base_stats?: DeepClaimStats;
  trained_day?: string | null;
  training_cost?: number;
  training_gain?: number;
  equipment_ids?: string[];
}
export type DeepClaimTerrain = 'soil' | 'stone' | 'excavated';
export interface DeepClaimTile extends DeepClaimPoint {
  terrain: DeepClaimTerrain;
  material: DeepClaimMineralId | null;
  remaining: number;
  initial_amount: number;
}
/** Only revealed, committed tiles; no hidden seed, undiscovered deposits or future work plans. */
export interface DeepClaimWorld {
  width: 96;
  chunk_size: 32;
  max_depth: number;
  revision: number;
  tiles: DeepClaimTile[];
}
export type DeepClaimStageKey = 'travel' | 'setup' | 'work' | 'haul' | 'return';
export interface DeepClaimStage { key: DeepClaimStageKey; starts_at: string; ends_at: string }
export interface DeepClaimExpedition {
  id: string;
  mode: DeepClaimMode;
  status: 'active' | 'ready' | 'collected';
  worker_ids: string[];
  target: DeepClaimPoint;
  path: DeepClaimPoint[];
  stages: DeepClaimStage[];
  stage: DeepClaimStageKey | 'ready' | 'collected';
  started_at: string;
  completes_at: string;
  duration_minutes: DeepClaimDuration;
  duration_seconds: number;
  tutorial: boolean;
  wages: number;
  energy_per_worker: number;
  config_version: 1 | 2;
  cargo: DeepClaimResources | null;
}
export interface DeepClaimBuilding {
  key: DeepClaimBuildingId;
  level: number;
  max_level: number;
  upgrade_cost: number | null;
  effect: string;
}
export interface DeepClaimLogEntry { id: string; kind: string; title: string; created_at: string }
export interface DeepClaimSnapshot {
  schema_version: 1 | 2;
  server_now: string;
  revision: number;
  company: DeepClaimCompany | null;
  resources: DeepClaimResources;
  workers: DeepClaimWorker[];
  world: DeepClaimWorld | null;
  expeditions: DeepClaimExpedition[];
  buildings: DeepClaimBuilding[];
  log: DeepClaimLogEntry[];
  candidates?: DeepClaimCandidate[];
  equipment?: DeepClaimEquipment[];
  production_jobs?: DeepClaimProductionJob[];
  recipes?: DeepClaimRecipe[];
  equipment_catalog?: DeepClaimEquipmentDefinition[];
}
export interface DeepClaimPreview {
  allowed: boolean;
  reasons: string[];
  company_revision: number;
  server_now: string;
  wages: number;
  energy_per_worker: number;
  duration_seconds: number;
  estimated_yield: { min: number; max: number };
  route: DeepClaimPoint[];
  cargo_capacity: number;
  risk_level: 'low' | 'moderate' | 'high';
  accessible_depth: number;
  expected_resources: DeepClaimMineralId[];
  projected_completion_at: string;
  stages: { key: DeepClaimStageKey; duration_seconds: number }[];
}
export interface DeepClaimDispatchInput {
  worker_ids: string[];
  mode: DeepClaimMode;
  target_x: number;
  target_y: number;
  duration_minutes: DeepClaimDuration;
  tutorial?: boolean;
}
export interface DeepClaimSellInput { resource_key: DeepClaimResourceId; quantity: number }
export interface DeepClaimUpgradeInput { building_key: DeepClaimBuildingId }
/** Renderer-only derived view; positions describe public route/stage state, never private future excavation. */
export interface DeepClaimWorkerPosition extends DeepClaimPoint {
  worker_id: string; stage: DeepClaimExpedition['stage'] | 'idle'; job_id: string | null;
  progress: number; elapsed_seconds: number; pose: 'idle' | 'walk' | 'work' | 'haul';
}
export type DeepClaimWorldView = DeepClaimWorld;
export type DeepClaimWorkerView = DeepClaimWorker;
export type DeepClaimBuildingView = DeepClaimBuilding;

/** Schema2 workforce/production payloads; schema1 saves remain readable. */
export const DEEP_CLAIM_EQUIPMENT_SLOTS = ['tool','head','utility'] as const;
export type DeepClaimEquipmentSlot = typeof DEEP_CLAIM_EQUIPMENT_SLOTS[number];
export type DeepClaimProductionStation = 'smeltery' | 'gem_workshop' | 'tool_station';
export interface DeepClaimCandidate {
  id: string; name: string; specialty: DeepClaimSpecialty; traits: string[]; stats: DeepClaimStats;
  wage: number; hire_cost: number; operating_day: string; hired: boolean;
}
export interface DeepClaimEquipmentDefinition {
  key: string; name: string; slot: DeepClaimEquipmentSlot; tier: 1 | 2; max_durability: number;
  bonuses: Partial<DeepClaimStats>; repair_rate: number; repair_materials: DeepClaimResources;
}
export interface DeepClaimEquipment {
  id: string; definition_key: string; worker_id: string | null; durability: number; max_durability: number;
  repair_cost: number; repair_materials: DeepClaimResources;
}
export interface DeepClaimRecipe {
  key: string; version: 1; name: string; station: DeepClaimProductionStation; required_station_level: number;
  duration_seconds: number; effective_duration_seconds: number; cash_cost: number; inputs: DeepClaimResources;
  outputs: DeepClaimResources; equipment_output: string | null; max_batches: 10;
}
export interface DeepClaimProductionJob {
  id: string; recipe_key: string; recipe_version: 1; batches: number; station: DeepClaimProductionStation;
  status: 'active' | 'ready' | 'collected'; started_at: string; completes_at: string; duration_seconds: number;
  cash_cost: number; inputs: DeepClaimResources; outputs: DeepClaimResources; equipment_outputs: string[];
}
export interface DeepClaimHireInput { candidate_id: string }
export interface DeepClaimTrainInput { worker_id: string; stat: DeepClaimStatId }
export interface DeepClaimAssignEquipmentInput { item_id: string; worker_id: string | null }
export interface DeepClaimRepairEquipmentInput { item_id: string }
export interface DeepClaimStartProductionInput { recipe_key: string; batches: number }

export interface DeepClaimRetireEquipmentInput { item_id: string }
