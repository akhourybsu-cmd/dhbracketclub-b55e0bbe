import type { BASE_POINTS } from './rules.ts';
import type { ArcadeSummary } from './contracts.ts';

export type EnemyKind = keyof typeof BASE_POINTS;
export type ShotKind = 'player' | 'shard' | 'heavy' | 'anchor';
export type TerminalReason = 'integrity' | 'line' | null;

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  hp: number;
  maxHp: number;
  // Both node sockets have to be opened before the central core can be hit.
  nodes: [number, number];
  tellUntil: number;
  diveStart: number;
  diveX: number;
  diveY: number;
  diveTargetX: number;
  dazedUntil: number;
}
export interface Projectile { id: number; kind: ShotKind; x: number; y: number; vx: number; vy: number }
export interface WardCell { x: number; y: number; hp: number }
export interface Telegraph { source: number; x: number; y: number; fireTick: number; kind: Exclude<ShotKind, 'player'>; vx: number }
export type EventKind = 'fire' | 'enemy-fire' | 'ward' | 'hit' | 'kill' | 'pulse' | 'wave-clear' | 'wave-start' | 'over' | 'node';
export interface RunEvent { kind: EventKind; x: number; y: number; value: number }
export type RunSummary = ArcadeSummary;
export interface RunState {
  tick: number; waveTick: number; wave: number; score: number; kills: number;
  phase: 'play' | 'tally' | 'over'; reason: TerminalReason;
  playerX: number; playerY: number; integrity: number; invulnerableUntil: number;
  pulse: number; pulseAt: number; lastFire: number; input: number;
  /** Number of consecutive kills in the current chain, capped at five. */
  chain: number; lastKill: number; waveHit: boolean;
  waveBonus: { clear: number; perfect: number; wards: number };
  rng: number; nextId: number; enemies: Enemy[]; projectiles: Projectile[];
  wards: WardCell[]; warnings: Telegraph[]; events: RunEvent[];
  originX: number; originY: number; direction: number; nextStep: number;
  nextShot: number; nextDive: number; population: number;
  stepInterval: number; drop: number; shotInterval: number; waveLimit: number;
  tallyStart: number;
}
