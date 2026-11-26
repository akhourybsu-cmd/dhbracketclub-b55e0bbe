import type { MapId } from '../types';
import type { EnvironmentMotionState, EnvironmentRect } from './environmentMotion';

const draft = [0, 1, 1, 2, 1, 0, -1, 0] as const;

/** Native-pixel movement confined to the loft's fittings and the wet side
 * of the sluice. The underlying map retains each landmark on a still frame. */
export function paintInteriorLife(id: MapId, phase: number, state: EnvironmentMotionState, rect: EnvironmentRect): void {
  if (id === 'workshop') {
    // Only the free end of the pennant stirs. The pin and top of the fold
    // stay attached to the rail, and the shadow moves against the vent.
    const lean = draft[phase];
    rect(0x323e3d, 1, 20, 108, 9, 12);
    rect(0xad6650, 1, 22, 108, 5, 3);
    rect(0xdba277, 1, 22, 108, 2, 3);
    const fold = Math.sign(lean);
    rect(0xad6650, 1, 22 + fold, 111, 5, 3);
    rect(0xdba277, 1, 22 + fold, 111, 2, 3);
    rect(0x955744, 1, 22 + lean, 114, 5, 2);
    rect(0xc88b68, 1, 22 + lean, 114, 2, 4);
    rect(0xad6650, 1, 26 + lean, 116);
    // A little harbor glare travels across the glass, behind the sash.
    rect(0xc9d7b1, 0.65, 107 + phase, 22, 4);
    rect(0xdde0b5, 0.5, 144 + Math.floor(phase / 2), 23, 3);
    if (state.pageFound) {
      // Nia has put the kettle back on. Two slow curls rise from its spout,
      // never from the handle or the player's tile.
      for (const offset of [0, 4]) {
        const age = (phase + offset) % 8, x = 79 - Math.floor(age / 3), y = 102 - age * 2;
        rect(0xf5dfb0, 0.82 - age / 15, x, y, 2, 2);
        if (age > 2) rect(0xf5dfb0, 0.6 - age / 15, x + 2, y - 1, 2);
      }
      rect(0xffdb8b, phase % 3 ? 0.5 : 1, 87, 120 + phase % 2, 2);
    }
  } else if (id === 'passage') {
    // The float and waterline are baked at the true level, including when
    // motion is off. Bubbles and reflected gauge ticks stay inside the tank.
    const level = state.sluiceOpen ? 272 : 255;
    rect(0xa8bca6, 0.68, 184 + Math.floor(phase / 2), level + 1, 7);
    rect(0x9ac1af, 0.5, 203 - Math.floor(phase / 3), level + 4, 4);
    if (state.sluiceOpen) {
      // The crossing drains into the three channels beneath the grille.
      for (const [x, offset] of [[126, 0], [136, 3], [146, 5]]) {
        const fall = (phase + offset) % 6;
        rect(0xadd1b9, 0.74, x, 284 + fall, 1, 2);
        rect(0xa4c4ad, 0.6, x - 1 - fall % 2, 291, 3 + fall % 3);
      }
    } else {
      const rise = phase % 4;
      rect(0x86aaa3, 0.61, 192, 272 - rise * 3, 1, 2);
      rect(0x86aaa3, 0.49, 190, 274 - rise * 3);
    }
  }
}
