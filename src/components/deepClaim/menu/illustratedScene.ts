import { BUILDING_ART } from '../renderer/artManifest';
import { infrastructureSprite } from '../renderer/fieldSprites';
import { paintBuilding, paintRail, paintSky, paintTerrain, paintWorker } from '../renderer/pixelArt';
import type { DeepClaimBuildingId, DeepClaimMineralId } from '@/lib/deepClaim/types';

export interface MenuSceneGeometry { width: number; height: number; scale: number; x: number; y: number }
export const MENU_ART_WIDTH = 960, MENU_ART_HEIGHT = 760, MENU_GROUND = 300;
export const MENU_BACKING_PIXEL_LIMIT = 1_000_000;
const pixel = (c: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), width, height); };

export function menuSceneGeometry(width: number, height: number, variant: 'title' | 'founding'): MenuSceneGeometry {
  const scale = Math.max(width / MENU_ART_WIDTH, height / MENU_ART_HEIGHT) * (variant === 'founding' ? 1.14 : 1);
  return { width, height, scale, x: width / 2 - (variant === 'founding' ? 385 : 480) * scale, y: height / 2 - (variant === 'founding' ? 300 : 380) * scale };
}
function building(c: CanvasRenderingContext2D, id: DeepClaimBuildingId, level: number, center: number, scale = 1) {
  const art = BUILDING_ART[id]; c.save(); c.translate(center - (art.x + art.width / 2) * 16 * scale, MENU_GROUND); c.scale(scale, scale);
  paintBuilding(c, id, level, 0, false); c.restore();
}

/** Explicit title composition. These fixed illustrative seams are not a generated or saved mine. */
function illustrationCell(column: number, row: number): { dug: boolean; material: DeepClaimMineralId | null; crystal: boolean } {
  const shaft = column >= 30 && column <= 31;
  const upperTunnel = row >= 6 && row <= 7 && column >= 15 && column <= 48;
  const lowerTunnel = row >= 13 && row <= 14 && column >= 25 && column <= 54;
  const crystal = row >= 19 && row <= 23 && column >= 38 && column <= 45;
  const material: DeepClaimMineralId | null = column >= 19 && column <= 21 && row >= 2 && row <= 3 ? 'coal'
    : column >= 42 && column <= 44 && row >= 9 && row <= 11 ? 'copper_ore'
    : column >= 27 && column <= 29 && row >= 10 && row <= 11 ? 'iron_ore'
    : column >= 43 && column <= 45 && row === 18 ? 'quartz' : null;
  return { dug: shaft || upperTunnel || lowerTunnel || crystal, material, crystal };
}

export function paintMenuSkyLayer(c: CanvasRenderingContext2D) {
  pixel(c, '#151d1a', 0, 0, MENU_ART_WIDTH, MENU_ART_HEIGHT);
  paintSky(c, MENU_ART_WIDTH, MENU_GROUND, MENU_GROUND, 1800, 0, false);
  // Original distant silhouettes frame the camp without resembling functional buildings.
  for (const [x, y, width, height] of [[20, 201, 100, 55], [104, 222, 130, 50], [720, 203, 140, 64], [840, 230, 120, 40]]) {
    pixel(c, '#657965', x, y, width, height); pixel(c, '#657965', x + 18, y - 9, width - 38, 11);
  }
}

export function paintMenuGroundLayer(c: CanvasRenderingContext2D, reducedGraphics: boolean) {
  pixel(c, '#171b1b', 0, MENU_GROUND, MENU_ART_WIDTH, MENU_ART_HEIGHT - MENU_GROUND);
  for (let row = 0; row < 29; row++) for (let column = 0; column < 60; column++) {
    const tile = illustrationCell(column, row);
    paintTerrain(c, column * 16, MENU_GROUND + row * 16, tile.material, tile.dug, (column + row) % 4, !reducedGraphics, row < 2, tile.crystal ? 'crystal_cavern' : null, tile.crystal ? 15 : 0);
  }
  pixel(c, '#58624a', 0, MENU_GROUND - 2, MENU_ART_WIDTH, 3); pixel(c, '#b5b18a', 0, MENU_GROUND - 3, MENU_ART_WIDTH, 1);
  paintRail(c, 8, (MENU_GROUND - 14) / 16, 46);
  building(c, 'smeltery', 1, 140, .92); building(c, 'mine_office', 1, 340); building(c, 'mine_shaft', 2, 500);
  building(c, 'warehouse', 1, 700); building(c, 'tool_station', 1, 862, .94);
  for (const column of [17, 24, 39, 46]) {
    c.save(); c.translate(column * 16, MENU_GROUND + 6 * 16); c.scale(1, 2);
    for (const [color, x, y, width, height] of infrastructureSprite('supports', 1, true).blocks) pixel(c, color, x, y, width, height);
    c.restore();
  }
  for (const [x, y] of [[365, 407], [664, 407], [548, 519], [806, 519]]) { pixel(c, '#393b2e', x - 3, y - 6, 7, 12); pixel(c, '#d9b86c', x - 1, y - 3, 3, 6); }
  pixel(c, '#5a6a5c', 493, MENU_GROUND, 2, 246); pixel(c, '#5a6a5c', 509, MENU_GROUND, 2, 246); pixel(c, '#8f9275', 502, MENU_GROUND - 91, 1, 337);
}

export function paintMenuActivity(c: CanvasRenderingContext2D, elapsed: number, motion: boolean, reducedGraphics: boolean) {
  const time = motion ? Math.max(0, elapsed) : 0;
  const walkX = 290 + (time * .012 % 190);
  paintWorker(c, walkX / 16, MENU_GROUND / 16, 'hauler', 'haul', time, 1, 3, motion);
  paintWorker(c, 591 / 16, 428 / 16, 'miner', 'mine', time, 1, 0, motion);
  const liftY = MENU_GROUND + 72 + Math.sin(time * .00022) * 58;
  pixel(c, '#293e38', 492, liftY, 20, 30); pixel(c, '#b2b89a', 492, liftY, 20, 3);
  pixel(c, '#71876f', 492, liftY + 3, 3, 24); pixel(c, '#71876f', 509, liftY + 3, 3, 24); pixel(c, '#9c9e7b', 494, liftY + 26, 16, 4);
  pixel(c, '#e0c27e', 499, liftY + 4, 7, 2);
  const cartX = 230 + time * .021 % 540;
  pixel(c, '#26342e', cartX + 3, MENU_GROUND - 7, 6, 6); pixel(c, '#26342e', cartX + 24, MENU_GROUND - 7, 6, 6);
  pixel(c, '#726341', cartX, MENU_GROUND - 20, 34, 13); pixel(c, '#b4a577', cartX - 2, MENU_GROUND - 22, 38, 4);
  pixel(c, '#323a37', cartX + 4, MENU_GROUND - 26, 10, 5); pixel(c, '#4a5350', cartX + 15, MENU_GROUND - 27, 12, 6);
  const lamp = motion && Math.floor(time / 700) % 3 === 1 ? '#f0d59b' : '#d9b86c';
  for (const [x, y] of [[365, 407], [664, 407], [548, 519], [806, 519]]) {
    pixel(c, lamp, x - 1, y - 3, 3, 6);
    if (!reducedGraphics) { pixel(c, '#e9c47b0a', x - 17, y - 12, 34, 26); pixel(c, '#e9c47b0a', x - 10, y - 9, 20, 20); }
  }
  if (motion && !reducedGraphics) {
    for (let puff = 0; puff < 3; puff++) { const rise = (time / 240 + puff * 13) % 49; pixel(c, '#c3c5a847', 111 + puff * 5, MENU_GROUND - 116 - rise, 10 + puff * 3, 7); }
    for (let grain = 0; grain < 4; grain++) { const fall = (time / 80 + grain * 9) % 28; pixel(c, '#c3ab7550', 612 + grain * 3, 403 + fall, 1, 2); }
    if (Math.floor(time / 1900) % 7 === 2) pixel(c, '#efd9aa', 700, 459, 2, 1);
  }
}
