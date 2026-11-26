import { CREATURES } from '../assets';
import type { SpeciesId } from '../types';

export const FIELD_SCREEN = { width: 160, height: 144 } as const;
// At 4× camera zoom, each 192px cel is drawn at its source resolution inside
// the same 48-unit footprint it occupies on the logical battle stage.
export const BATTLE_RENDER_SCALE = 4;
export const BATTLE_CELL = 192;
export const BATTLE_POSES = ['rest', 'ready', 'action', 'recoil'] as const;

export function battleFrame(species: SpeciesId, pose: typeof BATTLE_POSES[number]): number {
  return CREATURES.indexOf(species) * BATTLE_POSES.length + BATTLE_POSES.indexOf(pose);
}

type Pose = { x: number; y: number; spark: boolean; cel: typeof BATTLE_POSES[number] };

/** One-shot action poses follow the committed beat. Idle breathing stays anchored to the landing. */
export function battlePose(
  side: 'ally' | 'enemy',
  cue: 'ready' | 'act' | 'hit',
  elapsedMs: number,
  reducedMotion: boolean,
): Pose {
  const x = side === 'ally' ? 45 : 116;
  const y = side === 'ally' ? 98 : 67;
  const facing = side === 'ally' ? 1 : -1;
  const t = Math.max(0, elapsedMs);
  if (reducedMotion) {
    const cel = cue === 'act' ? 'action' : cue === 'hit' ? 'recoil' : 'rest';
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
  const recoil = t < 90 ? 4 : t < 155 ? 2 : 0;
  return { x: x - recoil * facing, y: y - (recoil ? 1 : 0), cel: recoil ? 'recoil' : 'rest', spark: t < 140 };
}
