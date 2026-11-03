import { crewFootPoint, type CrewPresentation, type CrewWorkerPresentation } from '@/lib/deepClaim/crewPresentation';
import type { DeepClaimPoint } from '@/lib/deepClaim/types';
import { paintWorker } from './pixelArt';
import type { WorkerEquipmentPaint } from './productionVisuals';

/** Underground bodies fit the existing single-cell passage; terrain stays untouched. */
export const UNDERGROUND_WORKER_SCALE = .7;
export const CREW_DETAIL_MIN_SCALE = 12;
export const CREW_MARKER_WIDTH = 54;
export const CREW_MARKER_HEIGHT = 22;

export interface CrewWorkerPaintOptions {
  underground: boolean;
  animate: boolean;
  focused?: boolean;
}

/**
 * Input positions are logical cell origins, including fractions along a public route.
 * Feet and sprite size blend through the entrance before settling into a single-cell passage.
 * Caller owns world transforms; no light wash is added on top of adjacent workers.
 */
export function paintCrewWorker(
  context: CanvasRenderingContext2D,
  worker: CrewWorkerPresentation,
  appearanceVariant: number,
  gear: WorkerEquipmentPaint,
  { underground, animate, focused = false }: CrewWorkerPaintOptions,
): void {
  const animated = animate && !worker.awaiting_sync && (worker.pose !== 'haul' || worker.moving);
  const animationTime = animated ? Math.max(0, worker.elapsed_seconds * 1000) + worker.animation_phase_ms : 0;
  const feet = crewFootPoint({ x: worker.x, y: underground ? worker.y : 0 });
  const undergroundFraction = underground ? Math.max(0, Math.min(1, worker.y)) : 0;
  const spriteScale = 1 - (1 - UNDERGROUND_WORKER_SCALE) * undergroundFraction;
  context.save();
  context.translate(Math.round(feet.x * 16), Math.round(feet.y * 16));
  if (spriteScale !== 1) context.scale(spriteScale, spriteScale);
  if (focused) {
    context.fillStyle = '#e6bd74';
    context.fillRect(-5, 1, 10, 1);
  }
  paintWorker(context, 0, 0, worker.specialty, worker.pose, animationTime, worker.facing, appearanceVariant, animated, gear);
  context.restore();
}

export interface CrewMarkerHitBounds {
  job_id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

type CrewMarkerTheme = 'dark' | 'light';
const MARKER_PALETTES = {
  dark: { background: '#1c2b28', edge: '#82917b', text: '#f0e6cb', accent: '#d2bc83', focused: '#e6bd74' },
  light: { background: '#f2e8cc', edge: '#7c8469', text: '#334139', accent: '#735c32', focused: '#79541f' },
} as const;

function pixel(context: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number): void {
  context.fillStyle = color;
  context.fillRect(x, y, width, height);
}

function objectiveGlyph(context: CanvasRenderingContext2D, mode: CrewPresentation['mode'], x: number, y: number, color: string): void {
  if (mode === 'extract') {
    pixel(context, color, x, y, 7, 2);
    pixel(context, color, x + 5, y + 2, 3, 2);
    pixel(context, color, x + 3, y + 2, 2, 3);
    pixel(context, color, x + 1, y + 5, 2, 3);
  } else if (mode === 'explore') {
    pixel(context, color, x, y, 2, 8);
    pixel(context, color, x + 2, y, 6, 2);
    pixel(context, color, x + 6, y + 2, 2, 6);
    pixel(context, color, x + 3, y + 4, 2, 2);
  } else if (mode === 'survey') {
    pixel(context, color, x, y, 6, 8);
    pixel(context, MARKER_PALETTES.dark.background, x + 1, y + 2, 4, 1);
    pixel(context, MARKER_PALETTES.dark.background, x + 1, y + 5, 2, 1);
    pixel(context, color, x + 6, y + 3, 2, 2);
  } else {
    pixel(context, color, x, y, 8, 2);
    pixel(context, color, x + 1, y + 2, 2, 6);
    pixel(context, color, x + 5, y + 2, 2, 6);
    pixel(context, color, x + 3, y + 5, 2, 1);
  }
}

/**
 * Paint in CSS screen coordinates after restoring the world transform. `center` is
 * the exact visual marker center; caller places/deconflicts it above the crew and
 * draws any connector. C2 + helmet + 3 means crew two with three assigned workers.
 * The visual remains compact while the returned target is at least 44px tall.
 */
export function paintCrewMarker(
  context: CanvasRenderingContext2D,
  crew: CrewPresentation,
  center: DeepClaimPoint,
  scale: number,
  focused: boolean,
  theme: CrewMarkerTheme = 'dark',
): CrewMarkerHitBounds {
  const palette = MARKER_PALETTES[theme];
  const left = Math.round(center.x - CREW_MARKER_WIDTH / 2);
  const top = Math.round(center.y - CREW_MARKER_HEIGHT / 2);
  const right = left + CREW_MARKER_WIDTH;
  const bottom = top + CREW_MARKER_HEIGHT;
  context.save();
  context.globalAlpha = focused || scale < CREW_DETAIL_MIN_SCALE ? 1 : .96;
  context.beginPath();
  context.moveTo(left + 3, top);
  context.lineTo(right - 3, top);
  context.lineTo(right, top + 3);
  context.lineTo(right, bottom - 3);
  context.lineTo(right - 3, bottom);
  context.lineTo(left + 3, bottom);
  context.lineTo(left, bottom - 3);
  context.lineTo(left, top + 3);
  context.closePath();
  context.fillStyle = palette.background;
  context.fill();
  context.strokeStyle = focused ? palette.focused : palette.edge;
  context.lineWidth = focused ? 2 : 1;
  context.stroke();

  objectiveGlyph(context, crew.mode, left + 5, top + 7, palette.accent);
  context.font = 'bold 9px monospace';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.fillStyle = palette.text;
  context.fillText(`C${crew.number}`, left + 17, top + 11);
  // Helmet silhouette distinguishes a head count from progress or a score.
  pixel(context, palette.accent, left + 34, top + 7, 5, 2);
  pixel(context, palette.accent, left + 33, top + 9, 7, 3);
  pixel(context, palette.accent, left + 32, top + 12, 9, 1);
  context.fillStyle = palette.text;
  context.fillText(String(crew.worker_ids.length), left + 43, top + 11);
  if (crew.awaiting_sync) pixel(context, palette.focused, right - 4, top + 3, 2, 2);
  context.restore();

  const hitHeight = Math.max(44, CREW_MARKER_HEIGHT);
  const hitTop = top - (hitHeight - CREW_MARKER_HEIGHT) / 2;
  return { job_id: crew.job_id, left, top: hitTop, right, bottom: hitTop + hitHeight, width: CREW_MARKER_WIDTH, height: hitHeight };
}
