import type { DeepClaimBuildingId, DeepClaimResourceId, DeepClaimSpecialty } from '@/lib/deepClaim/types';
import { BUILDING_ART, FRONTIER_PALETTE as P, RESOURCE_ART, SPECIALTY_ART } from './artManifest';

export type WorkerPose = 'idle' | 'walk' | 'mine' | 'haul' | 'setup';
const rect = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); };
/** Cosmetic grain only. This pattern never chooses terrain or resource contents. */
export function cosmeticGrain(x: number, y: number, variant = 0) { return ((Math.imul(x + 71, 1103515245) ^ Math.imul(y + 19, 12345) ^ variant * 7919) >>> 0) % 16; }

export function paintFog(c: CanvasRenderingContext2D, x: number, y: number) {
  rect(c, '#17191b', x, y, 16, 16);
  rect(c, '#1c1d1e', x + 1, y + 1, 14, 1); rect(c, '#101315', x, y + 15, 16, 1);
  if (cosmeticGrain(x, y) < 7) rect(c, '#202122', x + 4, y + 7, 5, 2);
}

export function paintTerrain(c: CanvasRenderingContext2D, x: number, y: number, resource: DeepClaimResourceId | null, dug = false, variant = 0, detailed = true, soilBase = false) {
  if (dug) {
    rect(c, '#242528', x, y, 16, 16); rect(c, '#2c2b2a', x + 1, y + 2, 14, 12);
    rect(c, '#39312b', x, y + 14, 16, 2);
    if (detailed && variant % 4 === 0) { rect(c, '#534332', x + 1, y, 2, 15); rect(c, '#68513a', x + 1, y + 1, 14, 2); rect(c, '#302923', x + 14, y + 3, 2, 12); }
    return;
  }
  const soil = soilBase || resource === 'clay';
  rect(c, soil ? '#5a4234' : '#414143', x, y, 16, 16);
  rect(c, soil ? '#73523a' : '#505456', x + 1, y + 1, 14, 3); rect(c, '#292829', x, y + 15, 16, 1); rect(c, '#292b2d', x + 15, y + 2, 1, 13);
  if (detailed) {
    const grain = cosmeticGrain(x, y, variant);
    rect(c, soil ? '#8b6546' : '#62686a', x + 2 + grain % 5, y + 5, 4, 2);
    rect(c, soil ? '#3c2f29' : '#33373b', x + 8, y + 9 + grain % 3, 5, 3);
    rect(c, '#25282a', x + 1, y + 10, 3, 1);
  }
  if (!resource) return;
  const art = RESOURCE_ART[resource];
  rect(c, art.dark, x + 4, y + 5, 8, 7);
  if (art.shape === 'crystal') {
    rect(c, art.mid, x + 7, y + 3, 3, 9); rect(c, art.light, x + 8, y + 3, 1, 6);
    rect(c, art.mid, x + 3, y + 8, 4, 4); rect(c, art.light, x + 3, y + 7, 2, 3);
    rect(c, art.dark, x + 10, y + 10, 3, 3);
  } else {
    for (const [dx, dy, w, h] of [[3, 5, 4, 3], [9, 8, 4, 4], [5, 11, 3, 2], [10, 3, 2, 2]]) {
      rect(c, art.mid, x + dx, y + dy, w, h); rect(c, art.light, x + dx, y + dy, Math.max(1, w - 1), 1);
    }
  }
}

export function paintSurface(c: CanvasRenderingContext2D, minX: number, maxX: number) {
  for (let x = minX; x <= maxX; x++) {
    rect(c, '#49382c', x * 16, 0, 16, 16); rect(c, '#78825a', x * 16, -2, 16, 3);
    rect(c, '#a0a474', x * 16 + 1, -3, 5, 2); rect(c, '#644b34', x * 16 + 3, 5, 7, 3);
    if (x % 7 === 0) { rect(c, '#4b5b43', x * 16 + 4, -6, 2, 5); rect(c, '#6c7c4e', x * 16 + 8, -5, 2, 4); }
  }
}

export function paintSky(c: CanvasRenderingContext2D, width: number, height: number, horizon: number, cameraX: number, time: number, motion: boolean) {
  rect(c, '#9d9f8b', 0, 0, width, Math.min(height, horizon));
  const bands = ['#aeb099', '#b8b196', '#c7b593', '#cfb98f'];
  bands.forEach((color, index) => rect(c, color, 0, Math.max(0, horizon - (4 - index) * 34), width, 36));
  const sunX = width * .76 - cameraX * .09;
  rect(c, '#d7c999', sunX - 17, Math.max(8, horizon - 117), 34, 24); rect(c, '#e3d2a0', sunX - 12, Math.max(3, horizon - 122), 24, 34);
  for (let index = -1; index < 9; index++) {
    const x = index * 115 - (cameraX * .65) % 115, h = 36 + (index * index % 5) * 8;
    rect(c, '#899780', x, horizon - h, 115, h + 4); rect(c, '#899780', x + 20, horizon - h - 10, 58, 12);
    rect(c, '#75856c', x + 47, horizon - 28, 93, 30);
  }
  const drift = motion ? time * .0008 % 70 : 0;
  for (let index = -1; index < 5; index++) {
    const x = index * 200 + drift - cameraX * .12, y = Math.max(12, horizon - 143 + index % 2 * 17);
    rect(c, '#d0c7a568', x, y, 70, 7); rect(c, '#d0c7a568', x + 15, y - 5, 36, 5);
  }
}

export function paintBuilding(c: CanvasRenderingContext2D, id: DeepClaimBuildingId, level: number, time: number, animate: boolean, selected = false) {
  const a = BUILDING_ART[id], x = a.x * 16, y = a.y * 16, w = a.width * 16, h = a.height * 16;
  const tier = Math.max(1, Math.min(3, Math.floor(level))), roof = tier >= 3 ? '#69756f' : '#664c3d';
  if (selected) { c.strokeStyle = '#ead09a'; c.lineWidth = 2; c.strokeRect(x - 4, y - 5, w + 8, h + 7); }
  rect(c, '#20232366', x - 5, -1, w + 10, 5); rect(c, '#302922', x + 1, -5, w - 2, 6);
  if (id === 'mine_shaft') {
    rect(c, '#292c29', x + 18, -17, w - 36, 17); rect(c, '#ad9260', x + 14, y + 5, 7, h - 8); rect(c, '#7c643f', x + w - 22, y + 5, 7, h - 8);
    for (let row = 0; row < 4; row++) { rect(c, '#8c744a', x + 20, y + 22 + row * 23, w - 42, 4); rect(c, '#493b2d', x + 22 + row * 10, y + 29 + row * 23, 5, 18); }
    rect(c, roof, x + 8, y + 5, w - 16, 10); rect(c, '#c1a06a', x + 3, y, w - 6, 5);
    rect(c, '#262a28', x + 32, y + 16, 46, 26); rect(c, '#b59962', x + 35, y + 18, 40, 20); rect(c, '#514834', x + 41, y + 22, 28, 12);
    const spin = animate ? Math.floor(time / 300) % 2 : 0;
    rect(c, '#d3bd86', x + 52, y + 17, 4, 23); rect(c, '#d3bd86', x + 36, y + 27 + spin * 2, 38, 3);
    rect(c, '#1d2222', x + 42, -27, 27, 25); rect(c, '#888d7b', x + 44, -25, 23, 3);
    if (tier >= 2) { rect(c, '#8a9590', x + 26, y + 44, 5, h - 48); rect(c, '#a5ada0', x + w - 32, y + 44, 5, h - 48); }
    if (tier >= 3) { rect(c, '#e2bd6c', x + 11, y + 49, 8, 10); rect(c, '#e2bd6c', x + w - 18, y + 49, 8, 10); }
  } else {
    rect(c, '#5e4635', x + 4, y + 16, w - 8, h - 20);
    for (let row = 0; row < h - 21; row += 8) { rect(c, '#8c6542', x + 5, y + 17 + row, w - 10, 2); rect(c, '#43352b', x + 5, y + 23 + row, w - 10, 1); }
    rect(c, roof, x, y + 10, w, 8); rect(c, roof, x + 9, y + 4, w - 18, 9); rect(c, tier >= 3 ? '#9ba58e' : '#9b7851', x + 8, y + 4, w - 16, 3);
    for (let index = 0; index < (id === 'warehouse' ? 3 : 2); index++) {
      const wx = x + 13 + index * 34;
      rect(c, '#302b26', wx, y + 29, 21, 21); rect(c, '#c1b17e', wx + 3, y + 32, 15, 14);
      rect(c, '#566555', wx + 10, y + 32, 2, 14); rect(c, '#7c8a6b', wx + 3, y + 38, 15, 2);
    }
    rect(c, '#302923', x + Math.floor(w / 2) - 10, -28, 21, 24); rect(c, '#906c43', x + Math.floor(w / 2) - 7, -26, 15, 22); rect(c, '#d6b76a', x + Math.floor(w / 2) + 3, -16, 2, 2);
    if (id === 'mine_office') {
      rect(c, '#d2c29a', x + 32, y + 18, 49, 8); rect(c, '#5d604c', x + 38, y + 20, 36, 3);
      rect(c, '#75634b', x + w - 19, y - 7, 7, 20); rect(c, '#3b3631', x + w - 21, y - 9, 11, 3);
      if (animate) for (let puff = 0; puff < 3; puff++) { const rise = (time / 150 + puff * 8) % 27; rect(c, '#d0c9aa66', x + w - 21 + puff * 3, y - 15 - rise, 7 + puff * 2, 5); }
    }
    if (id === 'warehouse') {
      for (let crate = 0; crate < tier + 1; crate++) { const cx = x + 7 + crate % 3 * 18, cy = -16 - Math.floor(crate / 3) * 15; rect(c, '#493b2b', cx, cy, 17, 15); rect(c, '#a17b4a', cx + 1, cy + 1, 15, 13); rect(c, '#655237', cx + 7, cy + 1, 2, 13); rect(c, '#c39d64', cx + 1, cy + 4, 15, 2); }
    }
    if (id === 'tool_station') { rect(c, '#343a38', x + 8, -22, 27, 14); rect(c, '#969989', x + 5, -26, 35, 6); rect(c, '#dbb974', x + 20, -35, 3, 10); rect(c, '#9ba58b', x + 16, -36, 13, 3); }
    if (tier >= 2) { rect(c, '#c19a62', x + 4, y + 16, 5, h - 21); rect(c, '#c19a62', x + w - 9, y + 16, 5, h - 21); }
    if (tier >= 3) { rect(c, '#8a9590', x + 3, -7, w - 6, 4); rect(c, '#cbb887', x + 14, y + 13, 3, h - 18); }
  }
  // A small lit exterior lantern is useful at every actual building level.
  rect(c, '#2f3028', x + w - 14, -24, 7, 11); rect(c, animate && Math.floor(time / 600) % 2 ? '#f0d48b' : '#d9b96a', x + w - 12, -22, 3, 6);
}

export function paintWorker(c: CanvasRenderingContext2D, x: number, y: number, specialty: DeepClaimSpecialty, pose: WorkerPose, elapsedMs: number, facing = 1, variant = 0, animate = true) {
  const a = SPECIALTY_ART[specialty], px = Math.round(x * 16), py = Math.round(y * 16);
  const frame = animate ? Math.floor(elapsedMs / 220) % 4 : 0, walking = pose === 'walk' || pose === 'haul';
  const leg = walking ? frame % 2 * 2 : 0, bob = walking && frame % 2 ? -1 : 0;
  const skin = ['#c79c75', '#a87c5c', '#e0b48b', '#80604d'][Math.abs(variant) % 4];
  c.save(); c.translate(px, py); c.scale(facing < 0 ? -1 : 1, 1);
  rect(c, '#00000042', -5, 0, 11, 2); rect(c, '#24282a', -3, -4, 3, 4 - leg); rect(c, '#24282a', 1, -4 + leg, 3, 4 - leg);
  rect(c, '#2b3031', -4, -2 + leg, 4, 2); rect(c, '#2b3031', 1, -2, 5, 2);
  rect(c, a.coat, -4, -11 + bob, 8, 8); rect(c, '#493e32', -4, -5 + bob, 8, 2); rect(c, '#d1ba80', -1, -5 + bob, 2, 2);
  rect(c, skin, -3, -17 + bob, 7, 6); rect(c, '#45382e', 2, -15 + bob, 1, 1); rect(c, '#5b4936', -4, -17 + bob, 2, 5);
  rect(c, '#5b4b33', -5, -19 + bob, 11, 4); rect(c, a.helmet, -4, -21 + bob, 8, 4); rect(c, '#e0c881', -3, -21 + bob, 5, 1);
  rect(c, '#34413c', 4, -18 + bob, 3, 3); rect(c, '#f0da8e', 5, -18 + bob, 2, 2);
  rect(c, skin, 3, -10 + bob, 3, 4);
  if (pose === 'mine') {
    const swing = frame < 2 ? -1 : 1;
    rect(c, '#9f7b4d', 5, -13 - swing * 3, 2, 12); rect(c, '#a4b0a2', 2, -15 - swing * 3, 11, 3); rect(c, '#d1cfaa', 9, -16 - swing * 3, 4, 2);
    if (animate && frame === 3) { rect(c, '#d2b374', 15, -5, 2, 1); rect(c, '#9c7953', 12, -8, 1, 2); }
  } else if (pose === 'haul') {
    rect(c, '#433c2e', -9, -12, 7, 11); rect(c, '#9a8054', -8, -11, 5, 9); rect(c, '#544a36', -7, -11, 1, 9);
  } else if (a.tool === 'map' || a.tool === 'scope') {
    rect(c, '#d0bd8e', 4, -10, 6, 6); rect(c, '#778465', 6, -9, 3, 1);
  } else if (a.tool === 'lamp') { rect(c, '#4a4934', 5, -5, 5, 6); rect(c, '#e3c273', 6, -4, 3, 3); }
  else if (a.tool === 'pack') { rect(c, '#7f6b45', -8, -12, 5, 10); rect(c, '#b69a5e', -7, -11, 3, 2); }
  else { rect(c, '#80603d', 5, -9, 1, 10); rect(c, '#a3a998', 3, -10, 7, 2); }
  c.restore();
}

export function paintRail(c: CanvasRenderingContext2D, x: number, y: number, length: number) {
  for (let index = 0; index < length; index++) { rect(c, P.woodDark, (x + index) * 16 + 3, y * 16 + 11, 5, 4); }
  rect(c, '#69736b', x * 16, y * 16 + 11, length * 16, 1); rect(c, '#9b9e85', x * 16, y * 16 + 14, length * 16, 1);
}
