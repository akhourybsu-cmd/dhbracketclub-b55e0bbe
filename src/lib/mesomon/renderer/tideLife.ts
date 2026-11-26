import type { MapId } from '../types';
import type { EnvironmentMotionState, EnvironmentRect } from './environmentMotion';

// World-space marks travel through the painted channels. The shared motion
// layer owns cadence, camera clipping, pause and reduced-motion behavior.
export function paintTideLife(id: MapId, phase: number, state: EnvironmentMotionState, rect: EnvironmentRect): void {
  const swell = [0, 1, 1, 1, 0, -1, -1, 0][phase];
  const pearl = 0xc0d8be;
  const silver = 0x85afac;
  if (id === 'tide-stairs') {
    // Water at the west quay lifts the reflection of the white tide staff.
    rect(silver, .23, 35 + swell, 112, 7, 1);
    rect(pearl, .19, 38 - swell, 115 + swell, 4, 1);
    rect(0xb0c1a4, .17, 30 - swell, 119, 8, 1);
    // Left-hand gallery light catches the worn nosings as the water shifts.
    rect(0xd3c59b, .17, 121 + swell, 96, 6, 1);
    rect(0xc6b992, .16, 125 - swell, 104, 5, 1);
    const glass = state.gateOpened ? 156 : 154;
    rect(0xc5d0ae, .28, 177, glass + (phase === 3 ? 1 : 0), 5, 1);
    if (!state.gateOpened) return;
    // Alternating flecks follow the rack around its elbow and over the grating.
    const run = phase * 4;
    rect(pearl, .26, 195 + run, 176, 3, 1);
    rect(silver, .23, 195 + (run + 16) % 32, 177, 2, 1);
    const bend = phase % 6;
    rect(pearl, .24, 232 + bend, 176 + bend, 2, 1);
    rect(silver, .25, 245 + (phase * 3) % 21, 188, 3, 1);
    const fall = phase % 4;
    rect(0xd2e4c5, .28, 276, 190 + fall, 1, 2);
    rect(pearl, .28, 281, 193 + (fall + 1) % 4, 1, 2);
    rect(silver, .21, 278 - fall, 199 + fall, 5 + fall, 1);
    rect(pearl, .23, 285 + fall, 199 + Math.floor(fall / 2), 3 + fall, 1);
    return;
  }
  if (id !== 'chamber') return;
  if (state.riftSealed) {
    // The fractured reflection joins into long bands. They drift with the
    // outer water instead of pulling in opposite directions around the tongue.
    const drift = Math.floor(phase / 3);
    rect(silver, .18, 130 + drift, 84, 7, 1);
    rect(pearl, .19, 158 + drift, 88, 10, 1);
    rect(0x8cbaae, .16, 164 + drift, 96, 7, 1);
  } else {
    const inner = [0, 1, 3, 4, 4, 3, 1, 0][phase];
    rect(0xd5b7d3, .29, 127 + inner, 87, 4, 1);
    rect(0xd9c2cf, .24, 135 + inner, 89 + swell, 3, 1);
    rect(0xafa0c6, .26, 168 - inner, 88, 4, 1);
    rect(0xc6aed1, .26, 163 - inner, 94 - swell, 3, 1);
  }
  // Wakes stay inside the two low side reservoirs and clear the sighting arm.
  const offset = state.riftSealed ? Math.floor(phase / 3) : phase % 4;
  rect(silver, .23, 58 - offset, 66 + offset, 7, 1);
  rect(pearl, .21, 63 + offset, 67 + offset, 4, 1);
  rect(silver, .22, 200 - offset, 150 + offset, 5, 1);
  rect(pearl, .20, 204 + offset, 151 + offset, 4, 1);
  // The calibrated brass line ends at the entry dial. A narrow reflection
  // of the basin crosses it, visible from the first steps into the room.
  rect(state.riftSealed ? 0xb1cab2 : 0xc7a7bd, .21, 137 + swell, 162, 3, 1);
}
