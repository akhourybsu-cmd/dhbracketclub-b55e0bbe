import type { BattleBeat, BattleState, MesomonSettings } from './types';

export function getBattleBeat(battle: BattleState): BattleBeat | null {
  return battle.playback?.beats[battle.playback.index] ?? null;
}

export function battleBeatDuration(battle: BattleState, speed: MesomonSettings['battleSpeed']): number {
  const beat = getBattleBeat(battle);
  if (!beat) return 0;
  const readingTime = Math.min(1800, Math.max(1050, beat.text.length * 29));
  const normal = beat.kind === 'action' ? 850 : readingTime;
  return speed === 'fast' ? Math.round(normal * 0.55) : normal;
}

/** Automatic playback and the player's Next press can race on the same beat. */
export function advanceBattleBeat(battle: BattleState, turn: number, index: number): BattleState {
  const playback = battle.playback;
  if (!playback || battle.turn !== turn || playback.index !== index) return battle;
  if (index + 1 < playback.beats.length) return { ...battle, playback: { ...playback, index: index + 1 } };
  const resolved = { ...battle };
  delete resolved.playback;
  return resolved;
}

/** A dodge or calming move can have an impact beat without a physical hit. */
export function getBattleHitSide(battle: BattleState): 'ally' | 'enemy' | null {
  const playback = battle.playback;
  if (!playback || playback.index === 0) return null;
  const beat = playback.beats[playback.index];
  const before = playback.beats[playback.index - 1];
  if (beat.kind !== 'impact') return null;
  if (beat.enemyVitality < before.enemyVitality) return 'enemy';
  if (beat.allyVitality[beat.activeIndex] < before.allyVitality[beat.activeIndex]) return 'ally';
  return null;
}
