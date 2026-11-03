import { crewFootPoint, type CrewPresentation, type CrewWorkerPresentation } from '@/lib/deepClaim/crewPresentation';
import type { DeepClaimPoint } from '@/lib/deepClaim/types';
import { constrainCamera, mineToScreen, type DeepClaimCamera, type MineBounds, type ViewportSize } from './camera';

const FOLLOW_MIN_SCALE = 12;
const FOLLOW_MAX_SCALE = 34;
const MARKER_WIDTH = 54;
const MARKER_HEIGHT = 44;
const MARKER_PADDING = 6;
const MARKER_GAP = 6;
const MAX_MARKERS = 7;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const finitePoint = (point: DeepClaimPoint) => Number.isFinite(point.x) && Number.isFinite(point.y);

/** Follow the disclosed bodies, never the expedition's possibly unrevealed target. */
export function trackingCamera(crew: CrewPresentation, workers: readonly CrewWorkerPresentation[], current: DeepClaimCamera, viewport: ViewportSize, bounds: MineBounds): DeepClaimCamera {
  const size = { width: Math.max(0, Number.isFinite(viewport.width) ? viewport.width : 0), height: Math.max(0, Number.isFinite(viewport.height) ? viewport.height : 0) };
  const shown = workers.filter(worker => worker.job_id === crew.job_id && finitePoint(worker)).slice(0, 3);
  const fallback = finitePoint(crew) ? crew : finitePoint(current) ? current : { x: bounds.width / 2, y: 1 };
  const points = shown.length ? shown : [fallback];
  // Match the painter's ground-level feet and smooth 1→.7 size transition into
  // the shaft. Surface bodies extend above ground, not below their tile origin.
  const bodies = points.map(point => {
    const foot = crewFootPoint(point), height = 1.4 - .42 * clamp(point.y, 0, 1);
    return { left: foot.x - .5, right: foot.x + .5, top: foot.y - height, bottom: foot.y + .1 };
  });
  const left = Math.min(...bodies.map(body => body.left)), right = Math.max(...bodies.map(body => body.right));
  const top = Math.min(...bodies.map(body => body.top)), bottom = Math.max(...bodies.map(body => body.bottom));
  const horizontalMargin = Math.min(12, size.width / 8), verticalMargin = Math.min(12, size.height / 8);
  const safeLeft = horizontalMargin, safeRight = size.width - horizontalMargin - Math.min(50, size.width / 5);
  const safeTop = verticalMargin + Math.min(60, size.height / 3), safeBottom = size.height - verticalMargin;
  const scale = clamp(Math.min(FOLLOW_MAX_SCALE, (safeRight - safeLeft) / (right - left), (safeBottom - safeTop) / (bottom - top)), FOLLOW_MIN_SCALE, FOLLOW_MAX_SCALE);
  const minimumScale = current.minimumScale === undefined ? undefined
    : Number.isFinite(current.minimumScale) ? clamp(current.minimumScale, 1, FOLLOW_MIN_SCALE) : FOLLOW_MIN_SCALE;
  return constrainCamera({
    x: (left + right) / 2 - ((safeLeft + safeRight) / 2 - size.width / 2) / scale,
    y: (top + bottom) / 2 - ((safeTop + safeBottom) / 2 - size.height / 2) / scale,
    scale, ...(minimumScale === undefined ? {} : { minimumScale }),
  }, size, bounds);
}

export interface CrewMarkerLayout { crew: CrewPresentation; center: DeepClaimPoint }
export interface CrewMarkerReservedRect { left: number; top: number; right: number; bottom: number }
export interface CrewMarkerLayoutOptions { topInset?: number; reservedRects?: readonly CrewMarkerReservedRect[] }

function markerLanes(origin: number, minimum: number, maximum: number, spacing: number): number[] {
  const values = [clamp(origin, minimum, maximum)];
  for (let lane = 1; lane <= MAX_MARKERS; lane++) values.push(clamp(origin - lane * spacing, minimum, maximum), clamp(origin + lane * spacing, minimum, maximum));
  values.push(minimum, maximum);
  return [...new Set(values)];
}

/** Bounded DOM marker positions. The renderer may connect each label to its real foot point. */
export function layoutCrewMarkers(crews: readonly CrewPresentation[], camera: DeepClaimCamera, viewport: ViewportSize, options: CrewMarkerLayoutOptions = {}): CrewMarkerLayout[] {
  if (!Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width < MARKER_WIDTH + MARKER_PADDING * 2 || viewport.height < MARKER_HEIGHT + MARKER_PADDING * 2
    || !finitePoint(camera) || !Number.isFinite(camera.scale) || camera.scale <= 0) return [];
  const inset = clamp(Number.isFinite(options.topInset) ? options.topInset! : 0, 0, viewport.height - MARKER_HEIGHT - MARKER_PADDING * 2);
  const minX = MARKER_WIDTH / 2 + MARKER_PADDING, maxX = viewport.width - minX;
  const minY = inset + MARKER_HEIGHT / 2 + MARKER_PADDING, maxY = viewport.height - MARKER_HEIGHT / 2 - MARKER_PADDING;
  const reserved = (options.reservedRects ?? []).filter(rect => [rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite) && rect.right > rect.left && rect.bottom > rect.top);
  const ordered = [...crews].filter(finitePoint).sort((a, b) => a.number - b.number || (a.job_id < b.job_id ? -1 : a.job_id > b.job_id ? 1 : 0));
  const placed: CrewMarkerLayout[] = [], seen = new Set<string>();
  for (const crew of ordered) {
    if (placed.length >= MAX_MARKERS) break;
    if (seen.has(crew.job_id)) continue;
    seen.add(crew.job_id);
    const foot = mineToScreen(crewFootPoint(crew), camera, viewport);
    if (foot.x < -44 || foot.x > viewport.width + 44 || foot.y < -44 || foot.y > viewport.height + 44) continue;
    const origin = { x: clamp(foot.x, minX, maxX), y: clamp(foot.y - 30, minY, maxY) };
    const horizontal = markerLanes(origin.x, minX, maxX, MARKER_WIDTH + MARKER_GAP);
    const vertical = markerLanes(origin.y, minY, maxY, MARKER_HEIGHT + MARKER_GAP);
    let center: DeepClaimPoint | null = null, distance = Infinity;
    for (const x of horizontal) for (const y of vertical) {
      if (placed.some(other => Math.abs(x - other.center.x) < MARKER_WIDTH + MARKER_GAP && Math.abs(y - other.center.y) < MARKER_HEIGHT + MARKER_GAP)) continue;
      if (reserved.some(rect => x + MARKER_WIDTH / 2 + MARKER_GAP > rect.left && x - MARKER_WIDTH / 2 - MARKER_GAP < rect.right
        && y + MARKER_HEIGHT / 2 + MARKER_GAP > rect.top && y - MARKER_HEIGHT / 2 - MARKER_GAP < rect.bottom)) continue;
      const squared = (x - origin.x) ** 2 + (y - origin.y) ** 2;
      if (squared < distance || squared === distance && (!center || y < center.y || y === center.y && x < center.x)) { center = { x, y }; distance = squared; }
    }
    // A very short viewport may not fit every hit target. Never stack invisible
    // buttons over one another merely to retain a decorative label.
    if (center) placed.push({ crew, center });
  }
  return placed;
}
