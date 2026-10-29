export type CoreMode = "campaign" | "endless" | "challenge";
export type EnemyType =
  "drone" | "runner" | "swarm" | "tank" | "splitter" | "boss";
export type UpgradeId =
  | "damage"
  | "haste"
  | "range"
  | "multishot"
  | "critical"
  | "hull"
  | "shield"
  | "regen"
  | "armor"
  | "income"
  | "orbit"
  | "frost"
  | "arc"
  | "rail"
  | "mortar";
export type AuxiliaryId = "arc" | "rail" | "orbit" | "mortar";
export type ModuleId = "repair" | "siphon" | "stasis";
export type UnlockId = AuxiliaryId | ModuleId;
export interface CoreLoadout {
  weapons: AuxiliaryId[];
  module: ModuleId | null;
}
export type WeaponId = "pulse" | AuxiliaryId | "nova";
export interface CombatMetrics {
  damage: Record<WeaponId, number>;
  kills: Record<WeaponId, number>;
  shots: Record<WeaponId, number>;
  energyEarned: number;
  energySpent: number;
  shieldAbsorbed: number;
}
export type ResearchId =
  "weapons" | "reactor" | "plating" | "barrier" | "salvage" | "nova";
export type Levels = Partial<Record<UpgradeId, number>>;
export type Research = Partial<Record<ResearchId, number>>;
export type Targeting = "nearest" | "strongest" | "fastest";

export interface CoreScenario {
  id: string;
  mode: CoreMode;
  title: string;
  subtitle: string;
  description: string;
  waves: number | null;
  difficulty: number;
  reward: number;
  speed: number;
  hp: number;
  rule?: "rush" | "glass" | "siege" | "blackout";
}

export interface CoreEnemy {
  id: number;
  kind: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  bounty: number;
  attackCd: number;
  slowed: number;
  lastHit?: WeaponId;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  target: number;
  damage: number;
  critical: boolean;
}

export interface CoreEffect {
  id: number;
  kind: "hit" | "kill" | "nova" | "breach" | "shot" | "arc" | "rail" | "mortar";
  x: number;
  y: number;
  life: number;
  maxLife: number;
  value?: number;
  fromX?: number;
  fromY?: number;
}

export interface CoreRun {
  version: 2;
  rewardClaimed?: boolean;
  balanceVersion?: number;
  registered?: boolean;
  legacy?: boolean;
  retired?: boolean;
  id: string;
  scenarioId: string;
  seed: number;
  nextId: number;
  phase: "ready" | "wave" | "intermission" | "victory" | "defeat";
  time: number;
  wave: number;
  cleared: number;
  waveTime: number;
  toSpawn: EnemyType[];
  spawnCd: number;
  breakTime: number;
  hp: number;
  shield: number;
  energy: number;
  kills: number;
  score: number;
  damageTaken: number;
  upgrades: Levels;
  research: Research;
  loadout?: CoreLoadout;
  enemies: CoreEnemy[];
  projectiles: Projectile[];
  effects: CoreEffect[];
  fireCd: number;
  novaCd: number;
  overdriveCd: number;
  overdriveTime: number;
  orbitalCd: number;
  arcCd?: number;
  railCd?: number;
  mortarCd?: number;
  shells?: {
    id: number;
    x: number;
    y: number;
    delay: number;
    damage: number;
    radius: number;
  }[];
  shieldDelay?: number;
  energyRemainder?: number;
  metrics?: CombatMetrics;
  targeting: Targeting;
}

export interface CoreProfile {
  credits: number;
  research: Research;
  campaign: Record<string, number>;
  challenges: Record<string, number>;
  bestWave: number;
  totalRuns: number;
  totalWaves: number;
  unlocks: UnlockId[];
  loadout: CoreLoadout;
}

export interface CoreResult {
  run: CoreRun;
  reward: number;
  stars: number;
}
