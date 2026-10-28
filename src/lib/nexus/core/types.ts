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
  | "frost";
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
  kind: "hit" | "kill" | "nova" | "breach" | "shot";
  x: number;
  y: number;
  life: number;
  maxLife: number;
  value?: number;
}

export interface CoreRun {
  version: 2;
  rewardClaimed?: boolean;
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
  enemies: CoreEnemy[];
  projectiles: Projectile[];
  effects: CoreEffect[];
  fireCd: number;
  novaCd: number;
  overdriveCd: number;
  overdriveTime: number;
  orbitalCd: number;
  targeting: Targeting;
}

export interface CoreProfile {
  credits: number;
  research: Research;
  campaign: Record<string, number>;
  challenges: Record<string, number>;
  bestWave: number;
  totalRuns: number;
}

export interface CoreResult {
  run: CoreRun;
  reward: number;
  stars: number;
}
