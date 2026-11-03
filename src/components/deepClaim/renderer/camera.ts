import type { DeepClaimPoint } from '@/lib/deepClaim/types';

export interface DeepClaimCamera { x: number; y: number; scale: number; minimumScale?: number }
export interface ViewportSize { width: number; height: number }
export interface MineBounds { width: number; depth: number; sky?: number }
export const MIN_MINE_SCALE = 6;
export const MAX_MINE_SCALE = 46;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function screenToMine(point: DeepClaimPoint, camera: DeepClaimCamera, size: ViewportSize): DeepClaimPoint {
  return { x: camera.x + (point.x - size.width / 2) / camera.scale, y: camera.y + (point.y - size.height / 2) / camera.scale };
}
export function mineToScreen(point: DeepClaimPoint, camera: DeepClaimCamera, size: ViewportSize): DeepClaimPoint {
  return { x: size.width / 2 + (point.x - camera.x) * camera.scale, y: size.height / 2 + (point.y - camera.y) * camera.scale };
}
export function constrainCamera(camera: DeepClaimCamera, size: ViewportSize, bounds: MineBounds): DeepClaimCamera {
  const minimumScale = camera.minimumScale ?? MIN_MINE_SCALE;
  const scale = clamp(Number.isFinite(camera.scale) ? camera.scale : 16, minimumScale, MAX_MINE_SCALE);
  const halfWidth = size.width / scale / 2, halfHeight = size.height / scale / 2;
  const left = Math.min(halfWidth - 3, bounds.width / 2), right = Math.max(bounds.width - halfWidth + 3, bounds.width / 2);
  const sky = bounds.sky ?? -13;
  const top = Math.min(sky + halfHeight, 1), bottom = Math.max(bounds.depth + 8 - halfHeight, 1);
  return { scale, x: clamp(Number.isFinite(camera.x) ? camera.x : bounds.width / 2, left, right), y: clamp(Number.isFinite(camera.y) ? camera.y : 2, top, bottom), ...(camera.minimumScale === undefined ? {} : { minimumScale }) };
}
/** A zoom preserves the world point beneath the finger before world-edge clamping. */
export function zoomMineAt(camera: DeepClaimCamera, factor: number, anchor: DeepClaimPoint, size: ViewportSize, bounds: MineBounds): DeepClaimCamera {
  const before = screenToMine(anchor, camera, size);
  const scale = clamp(camera.scale * (Number.isFinite(factor) && factor > 0 ? factor : 1), camera.minimumScale ?? MIN_MINE_SCALE, MAX_MINE_SCALE);
  const after = { ...camera, x: before.x - (anchor.x - size.width / 2) / scale, y: before.y - (anchor.y - size.height / 2) / scale, scale };
  return constrainCamera(after, size, bounds);
}
export function panMine(camera: DeepClaimCamera, movement: DeepClaimPoint, size: ViewportSize, bounds: MineBounds) {
  return constrainCamera({ ...camera, x: camera.x - movement.x / camera.scale, y: camera.y - movement.y / camera.scale }, size, bounds);
}
/** Preserve the mine point between both fingers as their midpoint moves and their distance changes. */
export function pinchMine(camera: DeepClaimCamera, before: readonly [DeepClaimPoint, DeepClaimPoint], after: readonly [DeepClaimPoint, DeepClaimPoint], size: ViewportSize, bounds: MineBounds): DeepClaimCamera {
  const midpoint = (pair: readonly [DeepClaimPoint, DeepClaimPoint]) => ({ x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 });
  const previous = midpoint(before), next = midpoint(after), anchored = screenToMine(previous, camera, size);
  const previousDistance = Math.hypot(before[0].x - before[1].x, before[0].y - before[1].y);
  const nextDistance = Math.hypot(after[0].x - after[1].x, after[0].y - after[1].y);
  const factor = previousDistance > 0 && nextDistance > 0 ? nextDistance / previousDistance : 1;
  const scale = clamp(camera.scale * factor, camera.minimumScale ?? MIN_MINE_SCALE, MAX_MINE_SCALE);
  return constrainCamera({ ...camera, scale, x: anchored.x - (next.x - size.width / 2) / scale, y: anchored.y - (next.y - size.height / 2) / scale }, size, bounds);
}
export function visibleMineCells(camera: DeepClaimCamera, size: ViewportSize, bounds: MineBounds) {
  const a = screenToMine({ x: 0, y: 0 }, camera, size), b = screenToMine(size.width === 0 ? { x: 0, y: 0 } : { x: size.width, y: size.height }, camera, size);
  return { minX: Math.max(0, Math.floor(a.x) - 1), maxX: Math.min(bounds.width - 1, Math.ceil(b.x) + 1), minY: Math.max(1, Math.floor(a.y) - 1), maxY: Math.min(bounds.depth, Math.ceil(b.y) + 1) };
}
export function initialMineCamera(size: ViewportSize, bounds: MineBounds): DeepClaimCamera {
  const scale = clamp(size.width / 39, 8, 20);
  return constrainCamera({ x: 48, y: 2.2, scale }, size, bounds);
}

/** Fit the actual owned camp, rather than cropping the outer buildings on phones. */
export function fitSurfaceCamera(size: ViewportSize, bounds: MineBounds, buildings: readonly { x: number; width: number; y?: number; height?: number }[]): DeepClaimCamera {
  if (!buildings.length) return constrainCamera({ x: 48, y: -1.2, scale: 8 }, size, bounds);
  const left = Math.min(...buildings.map(building => building.x)), right = Math.max(...buildings.map(building => building.x + building.width));
  const top = Math.min(...buildings.map(building => building.y ?? -8));
  const bottom = Math.max(...buildings.map(building => (building.y ?? -8) + (building.height ?? 8)));
  // The game shell reserves real rows for HUD and actions. Fit only the actual
  // remaining viewport; no building should sit behind a toolbar or be clipped.
  const verticalPadding = 12;
  const fitScale = Math.min((size.width - 24) / Math.max(1, right - left), (size.height - verticalPadding * 2) / Math.max(1, bottom - top));
  const minimumScale = fitScale < 4 ? 3 : 4;
  const scale = clamp(fitScale, minimumScale, 21);
  return constrainCamera({ x: (left + right) / 2, y: (top + bottom) / 2, scale, minimumScale }, size, bounds);
}
