import type { MapDefinition, MapId } from '../types';

/** Only the native-pixel calls used by this layer; importing it never boots Phaser. */
export interface EnvironmentMotionGraphics {
  fillStyle(color: number, alpha?: number): unknown;
  fillRect(x: number, y: number, width: number, height: number): unknown;
}
export interface EnvironmentMotionView {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}
export interface EnvironmentMotionState {
  readonly gateOpened: boolean;
  readonly sluiceOpen: boolean;
  readonly riftSealed: boolean;
  readonly reducedMotion: boolean;
  readonly paused: boolean;
}

/** About two authored steps a second. There are no sprites, particles or timers. */
export const ENVIRONMENT_MOTION_FRAME_MS = 420;
export const MAX_ENVIRONMENT_MOTION_RECTS = 48;
const CACHE_LIMIT = 96;
type PixelRect = readonly [color: number, alpha: number, x: number, y: number, width: number, height: number];
const frames = new Map<string, readonly PixelRect[]>();
const shimmer = [0.12, 0.17, 0.21, 0.24, 0.24, 0.21, 0.17, 0.12] as const;
const sway = [0, 0, 1, 1, 0, 0, -1, -1] as const;
const water = 0x9ab9a6;
const foam = 0xb3c6b0;
const amber = 0xd4b37a;

function authoredFrame(id: MapId, phase: number, state: EnvironmentMotionState): readonly PixelRect[] {
  // Only rules that alter this map enter its key, so changing a distant gate
  // does not allocate another workshop/ship frame.
  const variant = id === 'tide-stairs' ? Number(state.gateOpened)
    : id === 'passage' ? Number(state.sluiceOpen) + Number(state.riftSealed) * 2
      : id === 'chamber' ? Number(state.riftSealed) : 0;
  const key = `${id}:${variant}:${phase}`;
  const cached = frames.get(key);
  if (cached) return cached;
  const pixels: PixelRect[] = [];
  const rect = (color: number, alpha: number, x: number, y: number, width = 1, height = 1) => {
    if (pixels.length < MAX_ENVIRONMENT_MOTION_RECTS) pixels.push([color, alpha, x, y, width, height]);
  };
  const ripple = (x: number, y: number, width: number, shift: number = sway[phase], color: number = water, alpha: number = shimmer[phase]) => {
    rect(color, alpha, x, y + shift, width, 1);
    rect(color, alpha * 0.6, x + 3, y + shift + 2, Math.max(2, width - 6), 1);
  };

  if (id === 'ship') {
    // The authored stern reaches y213. Leave the hull and its gangplank alone;
    // these short wakes sit below it and beside its water-facing flanks.
    ripple(81, 218, 18);
    ripple(157, 219, 17, -sway[phase]);
    ripple(21, 151, 12);
    ripple(220, 163, 11, -sway[phase]);
    // The small lugger occupies x212..252,y88..131, so its reflection is lower.
    ripple(224, 135, 18, sway[(phase + 2) % 8]);
  } else if (id === 'harbor') {
    // Skiff at x336..383,y496..527; the arrival pier starts at x384.
    ripple(347, 531, 20);
    ripple(356, 537, 11, -sway[phase]);
    // The lamp is on the west edge of the pier. Its broken reflection belongs
    // in the adjacent water, never on the walkable timber or mooring lines.
    const light = 0.14 + shimmer[phase] * 0.45;
    rect(amber, light, 378 + sway[phase], 470, 2, 2);
    rect(amber, light * 0.85, 376, 475 + sway[phase], 4, 1);
    rect(amber, light * 0.65, 377 - sway[phase], 480, 2, 1);
    ripple(252, 477, 11, -sway[phase]);
  } else if (id === 'workshop') {
    // Three fixed flecks inside the two existing stepped window panes.
    // Their single-pixel drift picks out that light; nothing drifts across
    // the room, its clues, the lamp or Tavian's walking lane.
    rect(0xf0d69c, 0.16 + shimmer[phase] * 0.4, 111 + sway[phase], 55);
    rect(0xf0d69c, 0.14 + shimmer[(phase + 3) % 8] * 0.4, 123, 58 + (phase >= 4 ? 1 : 0));
    rect(0xf0d69c, 0.12 + shimmer[(phase + 5) % 8] * 0.35, 116 - sway[phase], 65);
  } else if (id === 'tide-stairs') {
    ripple(155, 266, 13);
    ripple(235, 272, 15, -sway[phase]);
    if (state.gateOpened) {
      // Water falls through the working rack, x155..188,y160..167.
      const fall = phase % 3;
      rect(foam, 0.24, 158, 160 + fall, 1, 3);
      rect(foam, 0.18, 171, 162 + (fall + 1) % 3, 1, 2);
      rect(foam, 0.2, 184, 160 + (fall + 2) % 3, 1, 3);
    }
  } else if (id === 'passage') {
    if (!state.sluiceOpen) {
      // This crossing is explicitly flooded in the painted state. It becomes
      // completely dry when the sluice opens, so none of these marks remain.
      const rise = phase % 4;
      ripple(165, 186 - rise, 10, 0, foam, shimmer[phase]);
      ripple(178, 213 - rise, 9, 0, foam, shimmer[(phase + 3) % 8]);
      ripple(164, 231 - rise, 14, 0, water, 0.14);
    } else {
      // Drainage stays in the outfall mouth after the bridge is dry.
      ripple(126, 293, 15, sway[phase], water, 0.19);
      rect(foam, shimmer[phase], 132 + phase % 3, 296, 4, 1);
    }
    // Foam in the upper channel runs toward the rift before it is sealed,
    // then returns downhill. It never spills across the adjacent floor.
    const travel = state.riftSealed ? phase : 7 - phase;
    rect(foam, shimmer[phase], 340, 97 + travel, 5, 1);
    rect(water, shimmer[(phase + 4) % 8], 343, 153 + travel, 4, 1);
  } else if (id === 'chamber') {
    // The central basin is centered at152,92 (rx28,ry15). Small broken
    // reflections become gentler and sea-green once the rift is closed.
    if (!state.riftSealed) {
      rect(0xaca0ba, shimmer[phase], 133 + sway[phase], 88, 8, 1);
      rect(0x998ba9, shimmer[(phase + 3) % 8], 160, 100 - sway[phase], 8, 1);
      rect(water, 0.13, 135, 104, 5, 1);
    } else {
      const quiet = sway[Math.floor(phase / 2)];
      ripple(133, 91, 10, quiet, water, 0.17);
      ripple(163, 101, 10, -quiet, water, 0.12);
    }
    const travel = state.riftSealed ? Math.floor(phase / 2) : 3 - phase % 4;
    ripple(202, 153 + travel, 11, 0, water, 0.15);
    ripple(220, 174 + travel, 10, 0, water, shimmer[phase] * 0.65);
  }

  // Absolute time produces a reusable eight-frame sequence. The small global
  // cache is bounded even when repeatedly walking between rooms/state variants.
  if (frames.size >= CACHE_LIMIT) frames.delete(frames.keys().next().value!);
  frames.set(key, pixels);
  return pixels;
}

/** Draw after the map's state-dependent water/floor pass, below actors/markers.
 * The caller owns clearing the Graphics layer. Paused/reduced-motion calls are
 * empty; no clock, tween, update callback or gameplay state is owned here. */
export function paintEnvironmentMotion(
  graphics: EnvironmentMotionGraphics,
  map: Pick<MapDefinition, 'id' | 'width' | 'height'>,
  view: EnvironmentMotionView,
  time: number,
  state: EnvironmentMotionState,
): number {
  if (state.paused || state.reducedMotion) return 0;
  if (![view.left, view.top, view.right, view.bottom].every(Number.isFinite)) return 0;
  const left = Math.max(0, Math.ceil(view.left));
  const top = Math.max(0, Math.ceil(view.top));
  const right = Math.min(map.width * 16, Math.floor(view.right));
  const bottom = Math.min(map.height * 16, Math.floor(view.bottom));
  if (right <= left || bottom <= top) return 0;
  const phase = Math.floor((Number.isFinite(time) ? Math.max(0, time) : 0) / ENVIRONMENT_MOTION_FRAME_MS) % 8;
  let count = 0, previousColor = -1, previousAlpha = -1;
  for (const [color, alpha, x, y, width, height] of authoredFrame(map.id, phase, state)) {
    const px = Math.max(left, x), py = Math.max(top, y);
    const pw = Math.min(right, x + width) - px, ph = Math.min(bottom, y + height) - py;
    if (pw <= 0 || ph <= 0) continue;
    if (color !== previousColor || alpha !== previousAlpha) {
      graphics.fillStyle(color, alpha);
      previousColor = color; previousAlpha = alpha;
    }
    graphics.fillRect(px, py, pw, ph);
    count++;
  }
  return count;
}
