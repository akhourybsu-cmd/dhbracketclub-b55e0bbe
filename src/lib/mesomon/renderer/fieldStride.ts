import type { Direction, MapId, SpeciesId, TileKind } from '../types';
import { WALK_STEP_MS } from '../input';
import type { EnvironmentMotionGraphics } from './environmentMotion';

/** Departure tile of a real step. The map, camera and command target stay on
 * the ground plane even when the walking sprite rises a pixel off its shadow. */
export interface FieldStep { x: number; y: number; surface: TileKind; direction: Direction }

export function strideLift(progress: number): number {
  return progress >= 0.25 && progress < 0.65 ? 1 : 0;
}

// Each direction has a settled drawing and a second pose. Hold the lifted
// paw long enough to read on a phone, then let the animal rest between gestures.
const idleCadence: Record<SpeciesId, { period: number; hold: number }> = {
  rillik: { period: 2080, hold: 440 },
  muddren: { period: 2840, hold: 640 },
  gleamwing: { period: 540, hold: 260 },
  tressel: { period: 1840, hold: 370 },
  'rift-wretch': { period: 1560, hold: 660 },
};

export function creatureIdleCel(species: SpeciesId, elapsedMs: number, reducedMotion: boolean): 0 | 1 {
  const { period, hold } = idleCadence[species];
  return !reducedMotion && elapsedMs % period >= period - hold ? 1 : 0;
}

// Light positions belong to the painted windows, gallery lanterns, rest lamp
// and basin. Each light has a limited reach in native map pixels.
const lights: Partial<Record<MapId, readonly (readonly [number, number, number])[]>> = {
  workshop: [[118, 32, 123], [217, 118, 72]],
  'tide-stairs': [[113, 27, 98], [239, 27, 88]],
  passage: [[312, 151, 93]],
  chamber: [[152, 91, 96]],
};

/** A short cast shadow on the ground, separate from the actor's contact
 * ellipse. Nearby interior lights change its bearing as the player passes. */
export function paintCastShadow(g: EnvironmentMotionGraphics, id: MapId, x: number, y: number) {
  let dx = 5, dy = 3, strength = 0.24;
  const sources = lights[id];
  if (sources) {
    strength = 0;
    for (const [lx, ly, reach] of sources) {
      const vx = x - lx, vy = y - ly;
      const distance = Math.hypot(vx, vy);
      const intensity = 0.36 * (1 - distance / reach);
      if (intensity <= strength || distance < 1) continue;
      strength = intensity;
      dx = Math.round(7 * vx / distance);
      dy = Math.round(4 * vy / distance);
    }
  }
  if (strength < 0.045) return;
  g.fillStyle(0x203133, strength * 0.65);
  g.fillRect(x + dx - 2, y + dy - 3, 5, 2);
  g.fillStyle(0x203133, strength);
  g.fillRect(x + Math.round(dx * 0.67) - 3, y + Math.round(dy * 0.67) - 2, 6, 2);
  g.fillRect(x + Math.round(dx * 0.33) - 2, y + Math.round(dy * 0.33) - 2, 5, 2);
}

export function paintFootfall(g: EnvironmentMotionGraphics, step: FieldStep, age: number) {
  if (age < 0 || age >= WALK_STEP_MS * 2) return;
  const { x, y, surface, direction } = step;
  const heel = (x + y) % 2 ? 2 : -2;
  const vertical = direction === 'up' || direction === 'down';
  const cx = x * 16 + 8 + (vertical ? heel : 0);
  const cy = y * 16 + 13 + (vertical ? 0 : Math.sign(heel));
  const fade = 1 - age / (WALK_STEP_MS * 2);

  if (surface === 'sand') {
    g.fillStyle(0x594d3b, 0.48 * fade);
    g.fillRect(cx - 1, cy - 1, vertical ? 2 : 4, vertical ? 3 : 2);
    g.fillStyle(0xe1c89a, 0.55 * fade);
    g.fillRect(cx, cy + 1, vertical ? 2 : 3, 1);
  } else if (surface === 'reeds' || surface === 'grass') {
    const side = direction === 'left' ? 1 : direction === 'right' ? -1 : Math.sign(heel);
    const bend = age < WALK_STEP_MS ? 2 : 1;
    g.fillStyle(0x364c41, 0.75 * fade);
    g.fillRect(cx, cy - 1, 1, 3);
    g.fillStyle(0xa5a266, 0.85 * fade);
    g.fillRect(cx + side, cy - 2, 1, 2);
    g.fillRect(cx + side * bend, cy - 3, 1, 1);
  }
}
