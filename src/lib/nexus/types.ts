// Nexus Defense — shared type definitions

export type TowerKind = 'pulse' | 'arc' | 'cryo' | 'rail' | 'flak' | 'mortar' | 'amp';
export type AbilityKind = 'orbital' | 'emp' | 'overclock' | 'repair';
export type EnemyKind = 'drone' | 'walker' | 'shielded' | 'stealth' | 'boss' | 'runner' | 'brute' | 'flyer' | 'healer' | 'splitter';

/** Per-tower targeting priority — the player's live agency over what each
 *  tower shoots. 'first' (most path progress) is the default. */
export type TargetMode = 'first' | 'last' | 'strong' | 'close';

export interface TowerDef {
  kind: TowerKind;
  name: string;
  tagline: string;
  cost: number;
  damage: number;          // per shot
  range: number;           // grid cells
  fireRate: number;        // shots per second
  splash?: number;         // AoE radius (cells), 0/undefined = single
  chain?: number;          // arc: extra targets
  slow?: number;           // 0..1 slow strength
  slowDuration?: number;   // seconds
  armorPierce?: number;    // flat reduction of enemy armor
  /** Can this tower hit flying enemies? Only a few can — the anti-air answer. */
  canHitAir?: boolean;
  /** Splash-damage radius (cells) around the primary target (mortar/flak). */
  splashDamage?: number;
  /** Support tower: buffs nearby towers instead of shooting. */
  supportAura?: { range: number; damageMult: number; rangeBonus: number };
  upgradeCost: number;
  upgradeMultiplier: number; // damage scaling per level
  color: string;           // tailwind hsl token used for styling
  glyph: string;           // 1-2 char symbol drawn on the tower
}

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;           // cells per second
  armor: number;           // flat damage reduction
  shield?: number;         // hp absorbed before main hp
  bounty: number;          // energy granted on kill
  damage: number;          // base hp dealt to nexus on leak
  stealth?: boolean;       // invisible to non-detector towers
  /** Flying — only towers with canHitAir can target it. */
  flying?: boolean;
  /** Field medic: heals nearby enemies. */
  heal?: { radius: number; perSec: number };
  /** On death, spawns smaller enemies at its position. */
  splitInto?: { kind: EnemyKind; count: number };
  color: string;
  glyph: string;
}

export interface WaveSpawn {
  enemy: EnemyKind;
  count: number;
  intervalMs: number;
  delayMs?: number;        // delay before this group starts
}

export interface Wave {
  index: number;
  spawns: WaveSpawn[];
  rewardEnergy: number;
}

export interface MissionDef {
  id: number;
  name: string;
  sector: string;
  startEnergy: number;
  baseHp: number;
  waves: Wave[];
  /** Legacy single label — superseded by `modifierIds`. Kept for backwards compat. */
  modifier?: { label: string; description: string };
  /** Modifier ids resolved from src/lib/nexus/modifiers.ts */
  modifierIds?: string[];
  isBoss?: boolean;
  rewardCores: number;
}

export interface AbilityDef {
  kind: AbilityKind;
  name: string;
  tagline: string;
  cooldownMs: number;
  glyph: string;
  color: string;
}

// Runtime types
export interface PlacedTower {
  id: string;
  kind: TowerKind;
  level: number;            // 1, 2, 3
  cell: { col: number; row: number };
  cooldownMs: number;
  totalDamage: number;
  kills: number;
  /** Player-set targeting priority. Undefined = 'first' (legacy default). */
  targetPriority?: TargetMode;
}

export interface ActiveEnemy {
  id: string;
  kind: EnemyKind;
  hp: number;
  maxHp: number;             // spawned hp (after scaling) — for HP bar + heal cap
  shield: number;
  pathIndex: number;         // along the path cells
  progress: number;          // 0..1 between pathIndex and next
  slowMs: number;            // remaining ms slowed
  slowFactor: number;        // 0..1
  stunnedMs: number;
  /** Per-enemy speed multiplier baked at spawn time (e.g. endless wave-tier scaling). */
  speedMult?: number;
  /** Id of the last tower that landed HP damage on this enemy. Used to credit kills. */
  lastHitBy?: string;
}

export interface AbilityRuntime {
  kind: AbilityKind;
  cooldownMs: number;        // remaining
}

export interface BattleState {
  tickMs: number;            // ms per tick
  elapsedMs: number;
  energy: number;
  baseHp: number;
  baseHpMax: number;
  waveIndex: number;         // 0-based, -1 = pre-wave
  totalWaves: number;        // from mission
  waveTimeMs: number;        // ms inside current wave
  spawnQueues: Array<{ enemy: EnemyKind; remaining: number; nextSpawnIn: number; intervalMs: number; }>;
  enemies: ActiveEnemy[];
  towers: PlacedTower[];
  abilities: AbilityRuntime[];
  status: 'pre' | 'in_wave' | 'between' | 'victory' | 'defeat';
  betweenWaveMs: number;     // countdown to next wave
  /** Overclock ability window — all towers fire faster/harder until this elapsedMs. */
  overclockUntilMs?: number;
  score: number;
  killedThisRun: number;
  events: BattleEvent[];     // recent visual events for UI
  // ---- telemetry counters (cheap, in-memory, sent on run end) ----
  towerBuilds: Record<TowerKind, number>;
  towerUpgrades: Record<TowerKind, number>;
  towerSells: Record<TowerKind, number>;
  abilityUses: Record<AbilityKind, number>;
  energyStarvedMs: number;   // ms spent unable to afford the cheapest tower during a wave
  leaks: number;             // count of enemies that reached the nexus
  bossDamageDealt: number;   // total damage dealt to boss enemies (used by co-op endless mode)
  // ---- calibration mods (applied at spawn / per-tick) ----
  enemyHpMult: Record<EnemyKind, number>;
  enemyShieldMult: Record<EnemyKind, number>;
  enemySpeedMult: number;
  // ---- mission modifier effects (composed on top of calibration) ----
  modifierIds: string[];
  modEnemyHpMult: Record<EnemyKind, number>;
  modEnemyShieldMult: Record<EnemyKind, number>;
  modEnemySpeedMult: number;
  modBountyMult: number;
  modTowerCostMult: Record<TowerKind, number>;
  modTowerDamageMult: Record<TowerKind, number>;
  modAbilityCooldownMult: Record<AbilityKind, number>;
  modShieldRegen: Partial<Record<EnemyKind, number>>;
  modBossHpMult: number;
  // ---- pre-run boost (Salvage-Token consumable) ----
  /** Boost code that was applied to this run, or null. Drives results-screen tag + server validation hooks. */
  boostCode?: string | null;
  /** Tower damage multiplier that decays after `boostExpiresAtMs`. */
  boostTowerDamageMult?: number;
  /** Build-cost multiplier that applies while boost is active. */
  boostBuildCostMult?: number;
  /** Energy regen multiplier (passive trickle), applied for the whole run. */
  boostEnergyRegenMult?: number;
  /** Co-op contribution points multiplier — read by battle page on submit. */
  boostOpPointsMult?: number;
  /** Cores multiplier — read by battle page when crediting cores. */
  boostCoresMult?: number;
  /** Number of upcoming wave previews exposed to UI (Tactical Recon). */
  boostReconWaves?: number;
  /** When the timed-window combat boost expires (engine elapsedMs). */
  boostExpiresAtMs?: number;
  /**
   * Engine path variant for this run. Optional for backwards compatibility
   * with persisted saves from before layout-aware routing — `getGridLayout()`
   * collapses any missing/unknown id to 'default' so legacy runs still play.
   */
  pathVariantId?: string;
}

export type BattleEvent =
  | { type: 'shot'; from: { col: number; row: number }; to: { x: number; y: number }; tower: TowerKind; damage: number; t: number }
  | { type: 'leak'; t: number }
  | { type: 'ability'; ability: AbilityKind; t: number }
  | { type: 'kill'; at: { x: number; y: number }; t: number };
