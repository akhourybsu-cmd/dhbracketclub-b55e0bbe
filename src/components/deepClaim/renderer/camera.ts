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
export function visibleMineCells(camera: DeepClaimCamera, size: ViewportSize, bounds: MineBounds) {
  const a = screenToMine({ x: 0, y: 0 }, camera, size), b = screenToMine(size.width === 0 ? { x: 0, y: 0 } : { x: size.width, y: size.height }, camera, size);
  return { minX: Math.max(0, Math.floor(a.x) - 1), maxX: Math.min(bounds.width - 1, Math.ceil(b.x) + 1), minY: Math.max(1, Math.floor(a.y) - 1), maxY: Math.min(bounds.depth, Math.ceil(b.y) + 1) };
}
export function initialMineCamera(size: ViewportSize, bounds: MineBounds): DeepClaimCamera {
  const scale = clamp(size.width / 39, 8, 20);
  return constrainCamera({ x: 48, y: 2.2, scale }, size, bounds);
}

/** Fit the actual owned camp, rather than cropping the outer buildings on phones. */
export function fitSurfaceCamera(size: ViewportSize, bounds: MineBounds, buildings: readonly { x: number; width: number }[]): DeepClaimCamera {
  if (!buildings.length) return constrainCamera({ x: 48, y: -1.2, scale: 8 }, size, bounds);
  const left = Math.min(...buildings.map(building => building.x)), right = Math.max(...buildings.map(building => building.x + building.width));
  const scale = clamp((size.width - 24) / Math.max(1, right - left), 4, 21);
  return constrainCamera({ x: (left + right) / 2, y: -1.2, scale, minimumScale: 4 }, size, bounds);
}
