import type { BattleBeat, BattleState, MesomonSettings } from './types';

export function getBattleBeat(battle: BattleState): BattleBeat | null {
  return battle.playback?.beats[battle.playback.index] ?? null;
}

export function battleBeatDuration(battle: BattleState, speed: MesomonSettings['battleSpeed'], manual = false): number {
  const beat = getBattleBeat(battle);
  const playback = battle.playback;
  if (manual || !beat || !playback) return 0;
  const next = playback.beats[playback.index + 1];
  const fast = speed === 'fast';
  // Leave a full motion window between declaration and contact, even on Fast.
  if (beat.kind === 'action') return fast ? 340 : 520;
  // An uninterrupted second hit feels like part of the same attack.
  if (beat.kind === 'impact' && next?.kind === 'impact' && next.side === beat.side) return fast ? 300 : 440;
  // Give the last visible health change time to register before the result opens.
  if (!next && battle.phase !== 'choosing') return fast ? 690 : 1120;
  const duration = beat.kind === 'impact'
    ? Math.min(960, Math.max(740, beat.text.length * 21))
    : Math.min(1650, Math.max(840, beat.text.length * 25));
  return fast ? Math.round(duration * .65) : duration;
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
  if (beat.kind !== 'impact' || beat.cue === 'resonant-cry' || beat.cue === 'lantern-dust') return null;
  if (beat.enemyVitality < before.enemyVitality) return 'enemy';
  if (beat.allyVitality[beat.activeIndex] < before.allyVitality[beat.activeIndex]) return 'ally';
  return null;
}
