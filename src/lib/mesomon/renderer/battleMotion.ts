import { CREATURES } from '../assets';
import type { BattleBeat, SpeciesId } from '../types';

export const FIELD_SCREEN = { width: 160, height: 144 } as const;
// At 4× camera zoom, each 192px cel is drawn at its source resolution inside
// the same 48-unit footprint it occupies on the logical battle stage.
export const BATTLE_RENDER_SCALE = 4;
export const BATTLE_CELL = 192;
export const BATTLE_POSES = ['rest', 'ready', 'action', 'recoil'] as const;

export function battleFrame(species: SpeciesId, pose: typeof BATTLE_POSES[number]): number {
  return CREATURES.indexOf(species) * BATTLE_POSES.length + BATTLE_POSES.indexOf(pose);
}

export const BATTLE_LANDING = { ally: { x: 45, y: 98 }, enemy: { x: 116, y: 67 } } as const;
export type FighterSide = keyof typeof BATTLE_LANDING;
type Motion = 'ready' | 'act' | 'hit' | 'cast' | 'brace' | 'dodge' | 'arrive' | 'withdraw';
type Pose = { x: number; y: number; spark: boolean; cel: typeof BATTLE_POSES[number] };

export function fighterMotion(side: FighterSide, beat: BattleBeat | null, hit: FighterSide | null): Motion {
  if (!beat) return 'ready';
  if (hit === side) return 'hit';
  if (beat.cue === 'dodge') return side !== beat.side ? 'dodge' : 'ready';
  if (beat.cue === 'flee' && beat.side === 'field') return side === 'ally' ? 'withdraw' : 'ready';
  if (beat.cue === 'switch' && beat.side === 'field') return side === 'ally' ? 'arrive' : 'ready';
  if (beat.side !== side || beat.kind === 'impact') return 'ready';
  switch (beat.cue) {
    case 'resonant-cry':
    case 'lantern-dust':
      return beat.kind === 'action' ? 'cast' : 'ready';
    case 'resonate':
      return 'cast';
    case 'tincture':
      return 'ready';
    case 'guard':
    case 'tidal-veil':
    case 'mud-wrap':
    case 'reedstep':
      return 'brace';
    case 'switch':
      return 'arrive';
    default:
      return beat.kind === 'action' ? 'act' : 'ready';
  }
}

/** Show the last blow before fading a defeated fighter. Never fade a reserve that just stepped forward. */
export function battleOpacity(conscious: boolean, hit: boolean, elapsedMs: number, reduced: boolean): number {
  if (conscious) return 1;
  if (!hit || reduced) return 0.35;
  return 1 - 0.65 * Math.min(1, Math.max(0, (elapsedMs - 110) / 170));
}

/** One-shot action poses follow the committed beat. Idle breathing stays anchored to the landing. */
export function battlePose(side: FighterSide, cue: Motion, elapsedMs: number, reducedMotion: boolean): Pose {
  const { x, y } = BATTLE_LANDING[side];
  const facing = side === 'ally' ? 1 : -1;
  const t = Math.max(0, elapsedMs);
  if (reducedMotion) {
    const cel = cue === 'act' || cue === 'cast' ? 'action' : cue === 'hit' ? 'recoil' : cue === 'brace' || cue === 'dodge' ? 'ready' : 'rest';
    return { x, y, cel, spark: false };
  }
  if (cue === 'ready') {
    // The two fighters do not breathe in unison.
    const breath = (t + (side === 'enemy' ? 460 : 0)) % 2100;
    return { x, y, cel: breath >= 900 && breath < 1460 ? 'ready' : 'rest', spark: false };
  }
  if (cue === 'act') {
    const stride = t < 65 ? -2 : t < 140 ? 5 : t < 210 ? 3 : t < 260 ? 1 : 0;
    const cel = t < 65 ? 'ready' : t < 210 ? 'action' : t < 260 ? 'ready' : 'rest';
    return { x: x + stride * facing, y: y - (stride > 2 ? 2 : 0), cel, spark: false };
  }
  if (cue === 'hit') {
    const recoil = t < 90 ? 4 : t < 155 ? 2 : 0;
    return { x: x - recoil * facing, y: y - (recoil ? 1 : 0), cel: recoil ? 'recoil' : 'rest', spark: t < 140 };
  }
  if (cue === 'cast') return { x, y, cel: t < 65 ? 'ready' : t < 265 ? 'action' : 'rest', spark: false };
  if (cue === 'brace') return { x, y: y + (t < 180 ? 1 : 0), cel: 'ready', spark: false };
  if (cue === 'dodge') {
    const step = t < 55 ? 1 : t < 165 ? 5 : t < 245 ? 2 : 0;
    return { x: x - step * facing, y: y - (step > 2 ? 3 : 0), cel: step ? 'ready' : 'rest', spark: false };
  }
  const distance = cue === 'arrive' ? Math.max(0, 1 - t / 240) : Math.min(1, t / 240);
  return { x: x - facing * Math.round(6 * distance), y, cel: distance > 0 && distance < 1 ? 'ready' : 'rest', spark: false };
}
