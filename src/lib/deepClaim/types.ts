/** Deep Claim public v1 identities. World seeds and unrevealed plans are server-private. */
export const DEEP_CLAIM_RULES_VERSION = 7;
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
export const DEEP_CLAIM_LEGACY_MINERAL_IDS = ['stone','clay','coal','copper_ore','tin_ore','iron_ore','quartz','silver_ore','amethyst','gold_ore'] as const;
export const DEEP_CLAIM_MINERAL_IDS = [...DEEP_CLAIM_LEGACY_MINERAL_IDS,'nickel_ore','sulfur'] as const;
export type DeepClaimMineralId = typeof DEEP_CLAIM_MINERAL_IDS[number];
export const DEEP_CLAIM_RESOURCE_IDS = [...DEEP_CLAIM_LEGACY_MINERAL_IDS,'copper_bar','tin_bar','iron_bar','silver_bar','polished_quartz','cut_amethyst','bronze_bar','steel_bar','gold_bar','nickel_ore','sulfur','nickel_alloy'] as const;
export type DeepClaimResourceId = typeof DEEP_CLAIM_RESOURCE_IDS[number];
export type DeepClaimResources = Partial<Record<DeepClaimResourceId, number>>;
export const DEEP_CLAIM_BUILDING_IDS = ['mine_office','mine_shaft','warehouse','tool_station','workers_quarters','smeltery','gem_workshop','research_office','trading_post'] as const;
export type DeepClaimBuildingId = typeof DEEP_CLAIM_BUILDING_IDS[number];
export type DeepClaimBuildings = Record<DeepClaimBuildingId, number>;
export type DeepClaimDuration = 20 | 60 | 180;
export type DeepClaimMode = 'explore' | 'extract' | 'survey' | 'infrastructure';
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
export const DEEP_CLAIM_FORMATIONS = ['cavern','wet_cavern','crystal_cavern','ruins'] as const;
export type DeepClaimFormation = typeof DEEP_CLAIM_FORMATIONS[number];
export type DeepClaimTerrain = 'soil' | 'stone' | 'excavated';
export interface DeepClaimTile extends DeepClaimPoint {
  terrain: DeepClaimTerrain;
  material: DeepClaimMineralId | null;
  remaining: number;
  initial_amount: number;
  formation?: DeepClaimFormation | null;
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
  config_version: 1 | 2 | 3 | 7;
  deep_modifiers?: DeepClaimDeepModifiers;
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
  schema_version: 1 | 2 | 3 | 4 | 5;
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
  infrastructure?: DeepClaimInfrastructure[];
  discoveries?: DeepClaimDiscovery[];
  discovery_summary?: DeepClaimDiscoverySummary;
  field_reports?: DeepClaimFieldReport[];
  field_catalog?: DeepClaimFieldCatalog;
  business_catalog?: DeepClaimBusinessCatalog;
  business?: DeepClaimBusiness;
  deep_catalog?: DeepClaimDeepCatalog;
  deep_operations?: DeepClaimDeepOperations;
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
  operation_version?: 3 | 7;
  deep_modifiers?: DeepClaimDeepModifiers;
  operation_cost?: number;
  materials_cost?: DeepClaimResources;
  conditions?: DeepClaimConditions;
  survey?: DeepClaimSurvey | null;
  installation?: DeepClaimInstallation | null;
}
export interface DeepClaimDispatchInput {
  worker_ids: string[];
  mode: DeepClaimMode;
  target_x: number;
  target_y: number;
  duration_minutes: DeepClaimDuration;
  tutorial?: boolean;
  infrastructure_key?: DeepClaimInfrastructureKey | null;
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
  key: string; name: string; slot: DeepClaimEquipmentSlot; tier: 1 | 2 | 3; max_durability: number;
  bonuses: Partial<DeepClaimStats>; repair_rate: number; repair_materials: DeepClaimResources;
  thermal_reduction_percent?: number;
}
export interface DeepClaimEquipment {
  id: string; definition_key: string; worker_id: string | null; durability: number; max_durability: number;
  repair_cost: number; repair_materials: DeepClaimResources;
}
export interface DeepClaimRecipe {
  key: string; version: 1; name: string; station: DeepClaimProductionStation; required_station_level: number;
  duration_seconds: number; effective_duration_seconds: number; cash_cost: number; inputs: DeepClaimResources;
  outputs: DeepClaimResources; equipment_output: string | null; max_batches: 10;
  required_research?: string[]; research_speed_percent?: number; locked?: boolean;
}
export type DeepClaimRecipeSnapshot = Omit<DeepClaimRecipe,'effective_duration_seconds'|'research_speed_percent'|'locked'>;
export interface DeepClaimProductionJob {
  id: string; recipe_key: string; recipe_version: 1; batches: number; station: DeepClaimProductionStation;
  status: 'active' | 'ready' | 'collected'; started_at: string; completes_at: string; duration_seconds: number;
  cash_cost: number; inputs: DeepClaimResources; outputs: DeepClaimResources; equipment_outputs: string[];
  research_speed_percent?: number; recipe_snapshot?: DeepClaimRecipeSnapshot;
}
export interface DeepClaimHireInput { candidate_id: string }
export interface DeepClaimTrainInput { worker_id: string; stat: DeepClaimStatId }
export interface DeepClaimAssignEquipmentInput { item_id: string; worker_id: string | null }
export interface DeepClaimRepairEquipmentInput { item_id: string }
export interface DeepClaimStartProductionInput { recipe_key: string; batches: number }

export interface DeepClaimRetireEquipmentInput { item_id: string }

/** Phase3 field data contains committed public state only, never hidden generation or event seeds. */
export const DEEP_CLAIM_INFRASTRUCTURE_KEYS = ['supports','ventilation','pump','rail'] as const;
export type DeepClaimInfrastructureKey = typeof DEEP_CLAIM_INFRASTRUCTURE_KEYS[number];
export const DEEP_CLAIM_DISCOVERY_KINDS = ['banded_geode','fern_fossil','survey_journal','rail_relic','crystal_cluster','meteorite_fragment'] as const;
export type DeepClaimDiscoveryKind = typeof DEEP_CLAIM_DISCOVERY_KINDS[number];
export const DEEP_CLAIM_DISCOVERY_QUALITIES = ['common','fine','exceptional','flawless'] as const;
export type DeepClaimDiscoveryQuality = typeof DEEP_CLAIM_DISCOVERY_QUALITIES[number];
export type DeepClaimDiscoveryChoice = 'keep' | 'sell' | 'salvage';
export interface DeepClaimSurvey { radius: number; tile_limit: number }
export interface DeepClaimInstallation { key: DeepClaimInfrastructureKey; grade: number; radius: number; strength: number }
export interface DeepClaimConditions {
  instability: number; gas: number; water: number; incident_chance_percent: number; max_delay_seconds: number;
  transport_bonus_percent: number; infrastructure_ids: string[];
}
export interface DeepClaimInfrastructure extends DeepClaimInstallation, DeepClaimPoint {
  id: string; status: 'building' | 'installed'; job_id: string; installed_at: string | null;
}
export interface DeepClaimDiscovery extends DeepClaimPoint {
  id: string; job_id: string; kind: DeepClaimDiscoveryKind; name: string; quality: DeepClaimDiscoveryQuality;
  detail: string; sale_value: number; salvage: DeepClaimResources;
  status: 'pending' | 'kept' | 'sold' | 'salvaged'; discovered_at: string; resolved_at: string | null;
}
export interface DeepClaimDiscoverySummary { pending: number; kept: number; sold: number; salvaged: number }
export interface DeepClaimFieldReport {
  id: string; job_id: string; kind: 'incident' | 'survey' | 'infrastructure' | 'discovery'; title: string;
  description: string; point: DeepClaimPoint; occurred_at: string; delay_seconds: number; tiles_revealed: number;
  infrastructure_id: string | null; discovery_id: string | null;
}
export interface DeepClaimInfrastructureDefinition {
  key: DeepClaimInfrastructureKey; name: string; description: string; cash_cost: number; materials: DeepClaimResources;
}
export interface DeepClaimDiscoveryDefinition {
  key: DeepClaimDiscoveryKind; name: string; description: string; min_depth: number;
  base_value: number; base_mass_grams: number; salvage: DeepClaimResources;
}
export interface DeepClaimQualityDefinition {
  key: DeepClaimDiscoveryQuality; name: string; weight: number; value_percent: number; mass_percent: number; salvage_multiplier: number;
}
export interface DeepClaimFieldCatalog {
  version: 3; infrastructure: DeepClaimInfrastructureDefinition[]; discoveries: DeepClaimDiscoveryDefinition[];
  qualities: DeepClaimQualityDefinition[]; caps: { infrastructure: number; pending_dispatch: number; pending_max: number; finds_per_job: number; kept_visible: number; resolved_visible: number; reports_visible: number };
  survey: { radius_cap: number; tile_limit_cap: number }; hazards: { chance_cap: number; delay_cap_seconds: number; safe_depth: number; kind_order: string[] };
  shaft: { max_level: 5; upgrade_cost: number; max_depth: number; corridor_depth: number };
  regions: { key: string; name: string; min_depth: number; max_depth: number }[];
  generation: { version: 3; min_chunk_y: number; macro_size: number; activation_percent: number; center_offset_min: number; center_offset_range: number; radius_x_min: number; radius_x_range: number; radius_y_min: number; radius_y_range: number };
}
export interface DeepClaimResolveDiscoveryInput { discovery_id: string; choice: DeepClaimDiscoveryChoice }

/** Phase4 company development is separate from the immutable terrain/field rules version3. */
export const DEEP_CLAIM_RESEARCH_BRANCHES = ['excavation','geology','processing','logistics','workforce','safety','deep_operations'] as const;
export type DeepClaimResearchBranch = typeof DEEP_CLAIM_RESEARCH_BRANCHES[number];
export const DEEP_CLAIM_BUSINESS_METRICS = ['completed_mining_expeditions','completed_surveys','total_surveyed_tiles','installed_infrastructure','max_completed_mining_depth','collected_production_batches','collected_processed_units','completed_research','completed_contracts','total_contract_credits','kept_discoveries'] as const;
export type DeepClaimBusinessMetric = typeof DEEP_CLAIM_BUSINESS_METRICS[number];
export type DeepClaimBusinessStats = Record<DeepClaimBusinessMetric,number>;
export interface DeepClaimResearchDefinition {
 key:string;name:string;branch:DeepClaimResearchBranch;tier:1|2;description:string;requires:string[];required_building_level:1|2;
 cash_cost:number;inputs:DeepClaimResources;duration_seconds:number;stat_bonuses:Partial<DeepClaimStats>;processing_speed_percent:number;unlocks_recipes:string[];
}
export interface DeepClaimContractDefinition {
 key:string;version:1;name:string;description:string;tier:1|2|3;requires_contracts:string[];required_research:string[];inputs:DeepClaimResources;reward:number;
}
export interface DeepClaimMilestoneDefinition { key:string;name:string;description:string;metric:DeepClaimBusinessMetric;target:number;reward:number }
export interface DeepClaimBusinessCatalog {
 version:4;research:DeepClaimResearchDefinition[];contracts:DeepClaimContractDefinition[];milestones:DeepClaimMilestoneDefinition[];
 caps:{active_research:1};buildings:{research_office:{costs:number[]};trading_post:{costs:number[]}};
 /** Public new industry definitions, independent from the unchanged Phase2 catalog. */
 resources:{id:DeepClaimResourceId;name:string;sell_price:number;color:string;description:string}[];
 equipment:DeepClaimEquipmentDefinition[];recipes:DeepClaimRecipeSnapshot[];
}
export interface DeepClaimResearchOrder {key:string;status:'active'|'completed';started_at:string;completes_at:string;completed_at:string|null}
export interface DeepClaimCompanyContract {key:string;status:'offered'|'completed';completed_at:string|null}
export interface DeepClaimMilestone {key:string;progress:number;claimed_at:string|null}
export interface DeepClaimBusiness {
 research:DeepClaimResearchOrder[];contracts:DeepClaimCompanyContract[];milestones:DeepClaimMilestone[];stats:DeepClaimBusinessStats;
 research_bonuses:Partial<DeepClaimStats>;processing_speed_percent:number;
}
export interface DeepClaimStartResearchInput {research_key:string}
export interface DeepClaimFulfillContractInput {contract_key:string}
export interface DeepClaimClaimMilestoneInput {milestone_key:string}

/** Optional shared club projection. It never contains another company's private state. */
export const DEEP_CLAIM_STANDING_METRICS=['weekly_mining_value','operational_depth','best_find'] as const;
export type DeepClaimStandingMetric=typeof DEEP_CLAIM_STANDING_METRICS[number];
export interface DeepClaimPublicSpecimen {kind:DeepClaimDiscoveryKind;name:string;quality:DeepClaimDiscoveryQuality;detail:string}
export interface DeepClaimPublicCompany {user_id:string;display_name:string;avatar_url:string|null;company_name:string;specimens:DeepClaimPublicSpecimen[]}
export interface DeepClaimPublicStanding {user_id:string;display_name:string;avatar_url:string|null;company_name:string;value:number;rank:number;is_you:boolean}
export const DEEP_CLAIM_CLUB_PROJECT_KEYS=['camp_supply','haul_extension','clean_air','assay_observatory','deep_freight','geological_pavilion'] as const;
export type DeepClaimClubProjectKey=typeof DEEP_CLAIM_CLUB_PROJECT_KEYS[number];
export interface DeepClaimClubProjectDefinition {key:DeepClaimClubProjectKey;name:string;description:string;requires:string[];goals:DeepClaimResources;reward_pool:number}
export interface DeepClaimSocialCatalog {
 version:5;projects:DeepClaimClubProjectDefinition[];
 standings:{key:DeepClaimStandingMetric;name:string;description:string;unit:string}[];
 caps:{standings_limit:50;showcase_page_size:24;showcase_max_page:19;featured_specimens:3;qualified_percent:5};
}
export interface DeepClaimClubProjectView {
 key:string;status:'locked'|'open'|'completed';goals:DeepClaimResources;progress:DeepClaimResources;own_contribution:DeepClaimResources;
 own_value:number;total_value:number;reward_pool:number;reward_amount:number;qualified:boolean;claimed_at:string|null;
 effective_cap_percent:40|60|100;contributors:number;completed_at:string|null;
}
export interface DeepClaimClubView {
 version:1;server_now:string;club_id:string;user_id:string;own_revision:number;catalog:DeepClaimSocialCatalog;
 own:{standings_enabled:boolean;showcase_enabled:boolean;featured_discovery_ids:string[];featured_specimens:DeepClaimPublicSpecimen[]};
 metric:DeepClaimStandingMetric;week:{starts_at:string;ends_at:string;timezone:string};
 standings:DeepClaimPublicStanding[];projects:DeepClaimClubProjectView[];
 showcases:{page:number;total:number;has_more:boolean;companies:DeepClaimPublicCompany[]};
}
export interface DeepClaimSocialPreferencesInput {standings_enabled:boolean;showcase_enabled:boolean;featured_discovery_ids:string[]}
export interface DeepClaimProjectContributionInput {project_key:string;resources:DeepClaimResources}
export interface DeepClaimProjectClaimInput {project_key:string}

/** Version7 field extension; previous catalogs and in-flight job configurations stay immutable. */
export interface DeepClaimDeepModifiers {
 lift_discount_percent:number;thermal_load_percent:number;engineering_mitigation_percent:number;ventilation_mitigation_percent:number;
 gear_mitigation_percent:number;heat_penalty_percent:number;raw_work_seconds:number;effective_work_seconds:number;
}
export interface DeepClaimDeepOperations {infrastructure_capacity:number;lift_discount_percent:number}
export interface DeepClaimDeepCatalog {
 version:7;name:string;
 shaft:{max_level:6;upgrade_cost:number;max_depth:number;corridor_depth:number;required_research:string[];lift_discount_percent:number};
 regions:{key:string;name:string;min_depth:number;max_depth:number;description:string}[];
 infrastructure:{base_capacity:number;deep_capacity:number};
 thermal:{min_depth:number;base_percent:number;step_depth:number;step_percent:number;cap_percent:number;engineering_divisor:number;ventilation_multiplier:number;gear_reduction_cap:number};
 generation:{version:4;min_chunk_y:number;cluster_width:number;cluster_height:number;nickel_percent:number;sulfur_percent:number;nickel_min_units:number;nickel_unit_range:number;sulfur_min_units:number;sulfur_unit_range:number};
 resources:{id:DeepClaimResourceId;name:string;sell_price:number;color:string;description:string;mineral:boolean;hardness_tenths?:number}[];
 equipment:DeepClaimEquipmentDefinition[];recipes:DeepClaimRecipeSnapshot[];
}

export type DeepClaimDeepSnapshot=DeepClaimSnapshot&{schema_version:5;deep_catalog:DeepClaimDeepCatalog;deep_operations:DeepClaimDeepOperations};
