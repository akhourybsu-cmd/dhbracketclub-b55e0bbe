/** Deep Claim public v1 identities. World seeds and unrevealed plans are server-private. */
export const DEEP_CLAIM_RULES_VERSION = 1;
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
export const DEEP_CLAIM_RESOURCE_IDS = ['stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore'] as const;
export type DeepClaimResourceId = typeof DEEP_CLAIM_RESOURCE_IDS[number];
export type DeepClaimResources = Partial<Record<DeepClaimResourceId, number>>;
export const DEEP_CLAIM_BUILDING_IDS = ['mine_office','mine_shaft','warehouse','tool_station'] as const;
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
}
export type DeepClaimTerrain = 'soil' | 'stone' | 'excavated';
export interface DeepClaimTile extends DeepClaimPoint {
  terrain: DeepClaimTerrain;
  material: DeepClaimResourceId | null;
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
  config_version: 1;
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
  schema_version: 1;
  server_now: string;
  revision: number;
  company: DeepClaimCompany | null;
  resources: DeepClaimResources;
  workers: DeepClaimWorker[];
  world: DeepClaimWorld | null;
  expeditions: DeepClaimExpedition[];
  buildings: DeepClaimBuilding[];
  log: DeepClaimLogEntry[];
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
  expected_resources: DeepClaimResourceId[];
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
