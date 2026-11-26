import type { MapId } from '../types';
import type { EnvironmentMotionState, EnvironmentRect } from './environmentMotion';

const swell = [0, 1, 1, 2, 1, 0, -1, -1] as const;
const spindle = [[0, -4], [3, -3], [4, 0], [3, 3], [0, 4], [-3, 3], [-4, 0], [-3, -3]] as const;

/** Authored world-space cels for the ferry and port. The caller caches, culls
 * and clips these marks with the rest of the native-pixel environment pass. */
export function paintExteriorLife(id: MapId, phase: number, state: EnvironmentMotionState, rect: EnvironmentRect): void {
  if (state.paused || state.reducedMotion) return;
  const water = swell[phase];
  if (id === 'ship') {
    // A little snatch block hangs from the reefed gaff above the port cabin.
    // Its attachment is fixed; the weighted lower half alone follows the roll.
    const pull = phase < 3 ? 0 : phase < 6 ? 1 : -1;
    rect(0x665d49, 1, 108, 59, 1, 7);
    rect(0x80745a, 1, 108 + pull, 65, 1, 5);
    rect(0x5b5946, 1, 107 + pull, 69, 4, 5);
    rect(0xcbb385, 1, 107 + pull, 69, 2, 3);
    rect(0x52615b, 1, 108 + pull, 73, 2, 2);
    // One glancing reflection crosses the three separate bridge windows.
    rect(0xc5d2b5, .65, 70 + phase, 83, 1, 2);
    rect(0xb3c5af, .55, 81 + phase, 83, 1, 2);
    // The tern loosens its folded wing, then tucks it against its back.
    // Its feet, face and breast belong to the cached rail artwork.
    const lift = [0, 0, 1, 3, 4, 2, 0, 0][phase];
    rect(0x849891, 1, 203, 119 - Math.floor(lift / 2), 4, 2);
    rect(0x8b9d92, 1, 206, 119 - lift, 4, 2);
    rect(0xc9ceb4, 1, 206, 118 - lift, 4, 1);
    rect(0x566c69, .95, 210, 118 - lift, 2, 1);
    if (phase === 7) rect(0xded9be, 1, 197, 117, 1, 1);
    // Reflected paint below the stern separates the wet red strake from its hull shadow.
    rect(0xac8668, .62, 98 - water, 215 + water, 9, 1);
    rect(0x7b8c78, .72, 109 + water, 218 + water, 6, 1);
    rect(0xd5bf96, .60, 155, 214 + water, 7, 1);
    rect(0x94b2a4, .65, 205 + water, 191 - water, 5, 1);
    // Water catches the near lugger's two-sided sail in short broken pieces.
    rect(0xb8b69a, .49, 229 + water, 132 + water, 3, 2);
    rect(0xacb39d, .5, 232 - water, 135, 5, 1);
    return;
  }
  if (id !== 'harbor') return;

  // The rope maker turns a jack in its fixed frame. Its cutout rim and pin
  // are on the foot-sorted foreground, its rotating spoke behind the hub.
  const [dx, dy] = spindle[phase];
  rect(0x4e5c51, 1, 388, 391, 9, 9);
  for (let i = 1; i <= 4; i++) {
    const sx = Math.round(dx * i / 4), sy = Math.round(dy * i / 4);
    rect(0xd0ad76, 1, 392 + sx, 395 + sy);
    rect(0xb7996b, 1, 392 - sx, 395 - sy);
  }
  rect(0xf0cf93, 1, 392 + dx, 395 + dy, 2, 1);
  // A float slides against the striped tide staff offshore of the east pier.
  rect(0x4a655e, 1, 482, 488, 7, 8);
  rect(0x4b6258, .9, 482, 491 + water, 6, 3);
  rect(0xbc8059, 1, 482, 489 + water, 5, 3);
  rect(0xe4bd85, 1, 483, 489 + water, 3, 1);
  rect(0xb6c0a3, .75, 481 - water, 495 + water, 10, 1);
  rect(0x86a390, .62, 485 + water, 498 + water, 6, 1);
  // The market bottler's cuff and hand reach out to the next amber jar.
  const reach = [0, 1, 2, 4, 5, 3, 1, 0][phase];
  rect(0x667d70, 1, 370, 200, 4, 3);
  rect(0xaaa987, 1, 372, 200, 2 + reach, 2);
  rect(0xd3a47b, 1, 374 + reach, 200 - Math.floor(reach / 3), 2, 2);
  rect(0xcbac77, .85, 380, 198 + (phase > 2 && phase < 5 ? 0 : 1), 2, 1);
  // Only the loose tips flutter. The ropes, ties and fixed flagroots stay put.
  rect(0x5b887c, .95, 481, 482 - Math.floor(water / 2), 4, 2);
  rect(0x8faaa0, .95, 482, 481 - water, 4, 1);
  rect(0x66938a, 1, 346, 325 + water, 4, 1);
  rect(0xb6baa0, .82, 349, 325 + water, 2, 1);
  // An amber return from the workshop glazing passes behind the moving stall.
  rect(0xceceb1, .64, 82 + phase, 200, 1, 2);
  rect(0xbbc5a9, .55, 90 + phase, 200, 1, 2);
  // Slanted braces and the foot of the passenger pier cast broken reflections
  // *below* the wet timbers; none of these strokes crosses a walking surface.
  rect(0x9c997b, .62, 273 + water, 478 + water, 8, 1);
  rect(0xbab191, .50, 281 - water, 481 + water, 4, 1);
  rect(0xb59c76, .63, 423 + water, 558 + water, 7, 1);
  rect(0x91a999, .57, 428 - water, 561 + water, 4, 1);
}
