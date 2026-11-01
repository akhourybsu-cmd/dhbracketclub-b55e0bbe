import type { DeepClaimBuildingId, DeepClaimFormation, DeepClaimMineralId, DeepClaimSpecialty } from '@/lib/deepClaim/types';
import { BUILDING_ART, FORMATION_ART, FRONTIER_PALETTE as P, RESOURCE_ART, SPECIALTY_ART } from './artManifest';
import type { BuildingActivity, WorkerEquipmentPaint } from './productionVisuals';

export type WorkerPose = 'idle' | 'walk' | 'mine' | 'haul' | 'setup' | 'survey' | 'build';
const rect = (c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); };
/** Cosmetic grain only. This pattern never chooses terrain or resource contents. */
export function cosmeticGrain(x: number, y: number, variant = 0) { return ((Math.imul(x + 71, 1103515245) ^ Math.imul(y + 19, 12345) ^ variant * 7919) >>> 0) % 16; }

export function paintFog(c: CanvasRenderingContext2D, x: number, y: number) {
  rect(c, '#17191b', x, y, 16, 16);
  rect(c, '#1c1d1e', x + 1, y + 1, 14, 1); rect(c, '#101315', x, y + 15, 16, 1);
  if (cosmeticGrain(x, y) < 7) rect(c, '#202122', x + 4, y + 7, 5, 2);
}

export function paintTerrain(c: CanvasRenderingContext2D, x: number, y: number, resource: DeepClaimMineralId | null, dug = false, variant = 0, detailed = true, soilBase = false, formation: DeepClaimFormation | null = null, neighbors = 0) {
  if (dug) {
    const room = formation ? FORMATION_ART[formation] : null;
    rect(c, room?.dark ?? '#242528', x, y, 16, 16);
    if (!room) { rect(c, '#2c2b2a', x + 1, y + 2, 14, 12); rect(c, '#39312b', x, y + 14, 16, 2); return; }
    // Only connect faces whose neighboring public cells are already known.
    if (!(neighbors & 1)) { rect(c, room.wall, x, y, 16, 3); if (detailed) rect(c, room.detail, x + 3 + variant, y + 3, 2, 3); }
    if (!(neighbors & 2)) rect(c, room.wall, x + 14, y, 2, 16);
    if (!(neighbors & 4)) { rect(c, room.wall, x, y + 13, 16, 3); if (detailed) rect(c, room.detail, x + 3, y + 12, 5, 1); }
    if (!(neighbors & 8)) rect(c, room.wall, x, y, 2, 16);
    if (formation === 'wet_cavern' && !(neighbors & 4)) { rect(c, '#3d7477', x + 2, y + 11, 12, 3); if (detailed) rect(c, '#83a9a0', x + 4, y + 11, 6, 1); }
    else if (formation === 'crystal_cavern' && detailed && !(neighbors & 1)) { rect(c, '#6d617e', x + 9, y + 2, 3, 5); rect(c, '#9a8fa8', x + 10, y + 3, 1, 3); }
    else if (formation === 'ruins' && detailed) { if (!(neighbors & 8)) rect(c, '#8a8b6a', x + 1, y + 5, 2, 5); if (!(neighbors & 4)) rect(c, '#696c52', x + 8, y + 11, 5, 2); }
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
  if (formation && detailed) { const room = FORMATION_ART[formation]; rect(c, room.wall, x + 2, y + 8, 3, 2); rect(c, room.detail, x + 11, y + 5, 2, 1); }
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

export function paintBuilding(c: CanvasRenderingContext2D, id: DeepClaimBuildingId, level: number, time: number, animate: boolean, selected = false, activity: BuildingActivity = { working: false, ready: false }) {
  const a = BUILDING_ART[id], x = a.x * 16, y = a.y * 16, w = a.width * 16, h = a.height * 16;
  if (level <= 0) {
    // Level zero is an actual unbuilt plot, never a completed factory façade.
    rect(c, '#3e3c2d', x + 2, -3, w - 4, 4);
    for (let marker = 0; marker < w - 8; marker += 10) rect(c, '#b8ae7b', x + 5 + marker, -5, 5, 1);
    for (const edge of [x + 4, x + w - 7]) { rect(c, '#654c33', edge, -15, 3, 16); rect(c, '#cbb77f', edge, -14, 3, 3); }
    rect(c, '#614932', x + w / 2 - 2, -22, 3, 23); rect(c, '#b29b68', x + w / 2 - 12, -27, 24, 13);
    rect(c, '#53533b', x + w / 2 - 7, -22, 14, 2); rect(c, '#53533b', x + w / 2 - 1, -25, 2, 8);
    if (selected) { c.strokeStyle = '#cbb77f'; c.lineWidth = 2; c.strokeRect(x, -30, w, 32); }
    return;
  }
  const tier = Math.max(1, Math.min(id === 'mine_shaft' ? 5 : id === 'research_office' ? 2 : 3, Math.floor(level))), roof = tier >= 3 ? '#69756f' : '#664c3d';
  if (selected) { c.strokeStyle = '#ead09a'; c.lineWidth = 2; c.strokeRect(x - 4, y - 5, w + 8, h + 7); }
  rect(c, '#20232366', x - 5, -1, w + 10, 5); rect(c, '#302922', x + 1, -5, w - 2, 6);
  if (id === 'workers_quarters') {
    const floors = tier >= 2 ? 2 : 1, top = -28 - floors * 24;
    rect(c, '#5b513a', x + 4, top + 9, w - 8, -top - 12); rect(c, '#8d8056', x, top + 5, w, 9); rect(c, '#b3a477', x + 9, top, w - 18, 6);
    for (let floor = 0; floor < floors; floor++) for (let room = 0; room < 5; room++) { const wx = x + 13 + room * 27, wy = -29 - floor * 25; rect(c, '#34382d', wx, wy, 17, 17); rect(c, '#c3bd8d', wx + 3, wy + 3, 11, 10); rect(c, '#7b8664', wx + 8, wy + 3, 2, 11); }
    rect(c, '#3d352a', x + w / 2 - 9, -27, 18, 25); rect(c, '#93825a', x + w / 2 - 6, -24, 12, 22);
    rect(c, '#6f6445', x + 5, -7, w - 10, 4);
    if (tier >= 3) { rect(c, '#68785c', x + 6, top - 11, 3, 20); rect(c, '#c5ac70', x + 9, top - 11, 20, 9); rect(c, '#9c9d74', x + w - 16, top - 9, 6, 19); }
  } else if (id === 'smeltery') {
    rect(c, '#454943', x + 5, y + 36, w - 10, h - 39); rect(c, '#73786a', x + 2, y + 30, w - 4, 9);
    for (let row = 0; row < 7; row++) { rect(c, '#636153', x + 8, y + 43 + row * 8, w - 16, 2); rect(c, '#343b36', x + 13 + row % 2 * 12, y + 43 + row * 8, 2, 8); }
    const stacks = tier >= 2 ? 2 : 1;
    for (let stack = 0; stack < stacks; stack++) { const sx = x + 14 + stack * 74; rect(c, '#444b44', sx, y + 2, 17, 43); rect(c, '#9b9d83', sx - 3, y, 23, 5); rect(c, '#76806b', sx + 3, y + 5, 3, 33); }
    rect(c, '#292c27', x + 37, -43, 54, 39); rect(c, '#30352e', x + 31, -34, 66, 29);
    if (activity.working) { rect(c, '#8f5333', x + 40, -34, 48, 26); rect(c, '#d1984f', x + 47, -28, 34, 18); rect(c, '#eed08c', x + 57, -22 - (animate ? Math.floor(time / 240) % 2 * 3 : 0), 14, 11); }
    rect(c, '#88907a', x + 29, -7, 70, 5);
    if (tier >= 3) { rect(c, '#c3aa6e', x + 4, y + 39, w - 8, 4); rect(c, '#899b88', x + w - 16, y + 19, 10, 62); rect(c, '#bac1a3', x + 30, y + 17, w - 36, 4); }
    if (activity.working && animate) for (let puff = 0; puff < 3; puff++) { const rise = (time / 130 + puff * 7) % 26; rect(c, '#b9b49a66', x + 13 + puff * 3, y - 7 - rise, 10 + puff, 6); }
  } else if (id === 'gem_workshop') {
    rect(c, '#57665b', x + 4, y + 22, w - 8, h - 25); rect(c, '#b7bea0', x + 8, y + 28, w - 16, 24);
    rect(c, '#76978a', x + 12, y + 32, w - 24, 16); rect(c, '#d0d5b4', x + 15, y + 33, w - 30, 3);
    rect(c, '#526a5b', x, y + 15, w, 9); rect(c, '#b6ba95', x + 12, y + 7, w - 24, 8); rect(c, '#d6d1ac', x + 22, y + 2, w - 44, 6);
    for (let post = 0; post < 4; post++) rect(c, '#4d6659', x + 23 + post * 26, y + 28, 3, 23);
    rect(c, '#715f42', x + 9, -15, w - 18, 6); rect(c, '#b9ad7b', x + 7, -18, w - 14, 4);
    const gx = x + w / 2 - 11; rect(c, '#4b5146', gx, -36, 22, 20); rect(c, '#9aa68d', gx + 3, -38, 16, 22); rect(c, '#cbd0af', gx + 7, -34, 8, 12);
    rect(c, '#5b6c5a', gx + (activity.working && animate ? Math.floor(time / 180) % 2 * 7 + 4 : 5), -35, 2, 16);
    if (activity.working) { rect(c, '#a58bbd', gx + 23, -23, 7, 5); rect(c, '#dfcbea', gx + 24, -25, 4, 3); }
    if (tier >= 2) { rect(c, '#d1c493', x + 5, y + 23, 4, h - 27); rect(c, '#d1c493', x + w - 9, y + 23, 4, h - 27); }
    if (tier >= 3) { rect(c, '#a6b599', x + 19, y + 11, 4, h - 15); rect(c, '#a6b599', x + w - 23, y + 11, 4, h - 15); rect(c, '#cbbb88', x + 17, y + 4, w - 34, 3); }
  } else if (id === 'research_office') {
    // Compact study room: all structural detail stays within its actual camp footprint.
    rect(c, '#465347', x + 4, y + 24, w - 8, h - 28); rect(c, '#829178', x + 7, y + 29, w - 14, h - 34);
    for (let board = 0; board < 4; board++) rect(c, '#60735c', x + 9, y + 36 + board * 9, w - 18, 2);
    rect(c, '#394f4b', x, y + 16, w, 9); rect(c, '#7f927e', x + 8, y + 10, w - 16, 7); rect(c, '#bac5a0', x + 17, y + 6, w - 34, 5);
    rect(c, '#30483f', x + 12, y + 35, w - 24, 26); rect(c, '#91aba0', x + 15, y + 38, w - 30, 19);
    rect(c, '#cfdbc0', x + 17, y + 39, w - 34, 3);
    for (let pane = 0; pane < 3; pane++) rect(c, '#526b5c', x + 24 + pane * 21, y + 38, 3, 20);
    rect(c, '#a9a67a', x + 11, -16, w - 22, 6); rect(c, '#d3c69c', x + 20, -20, 24, 4); rect(c, '#7d8f72', x + 23, -19, 15, 1);
    rect(c, '#526d69', x + w - 36, -22, 18, 12); rect(c, '#b1c0a4', x + w - 32, -24, 11, 11); rect(c, '#3c594e', x + w - 29, -19, 6, 2);
    if (tier >= 2) {
      rect(c, '#a8bfb0', x + 19, y + 3, w - 38, 13); rect(c, '#d3debd', x + 22, y + 4, w - 44, 3);
      for (let pane = 0; pane < 3; pane++) rect(c, '#607d70', x + 25 + pane * 15, y + 4, 2, 12);
      rect(c, '#c0b37e', x + 5, y + 25, 4, h - 29); rect(c, '#c0b37e', x + w - 9, y + 25, 4, h - 29);
      rect(c, '#435b54', x + 9, y + 4, 7, 13); rect(c, '#b9b990', x + 7, y + 1, 12, 5);
      rect(c, '#8b9e86', x + 14, -9, w - 28, 3);
    }
    // Active light represents the paid server research order, never local completion.
    if (activity.working) { rect(c, '#c9b878', x + 28, y + 43, 13, 9); rect(c, animate && Math.floor(time / 450) % 2 ? '#ead7a2' : '#ddc68d', x + 31, y + 44, 7, 6); }
  } else if (id === 'trading_post') {
    rect(c, '#5c5140', x + 5, y + 22, w - 10, h - 26); rect(c, '#8b7955', x + 9, y + 28, w - 18, h - 32);
    rect(c, '#4a4939', x + 3, y + 13, w - 6, 11); rect(c, '#b19a67', x + 11, y + 8, w - 22, 6);
    rect(c, '#3d4236', x + 12, y + 31, w - 24, 31); rect(c, '#6d7a5e', x + 16, y + 34, w - 32, 24);
    // The striped awning and balance scales identify a trading counter at low zoom.
    for (let stripe = 0; stripe < 7; stripe++) { const ax = x + 7 + stripe * 14; rect(c, stripe % 2 ? '#c0b17e' : '#916449', ax, y + 23, 14, 10); rect(c, stripe % 2 ? '#a6986e' : '#785641', ax, y + 33, 14, 4); }
    rect(c, '#493e2e', x + 9, -23, w - 18, 20); rect(c, '#b49a66', x + 7, -26, w - 14, 5); rect(c, '#d2be88', x + 10, -27, w - 20, 2);
    rect(c, '#c5b17c', x + 37, -44, 2, 17); rect(c, '#c5b17c', x + 25, -40, 26, 2); rect(c, '#9d8f63', x + 25, -37, 2, 7); rect(c, '#9d8f63', x + 49, -37, 2, 7); rect(c, '#cdbd88', x + 22, -31, 8, 2); rect(c, '#cdbd88', x + 46, -31, 8, 2);
    rect(c, '#d1c49b', x + 63, -32, 22, 5); rect(c, '#768166', x + 67, -31, 14, 1);
    if (tier >= 2) { rect(c, '#b6a773', x + 7, y + 17, 4, h - 21); rect(c, '#b6a773', x + w - 11, y + 17, 4, h - 21); rect(c, '#6c7964', x + 13, y + 6, w - 26, 3); rect(c, '#a9b18c', x + 21, y + 2, w - 42, 4); }
    if (tier >= 3) { rect(c, '#8ba18d', x + 4, y + 16, 3, h - 19); rect(c, '#8ba18d', x + w - 7, y + 16, 3, h - 19); rect(c, '#d1bd85', x + 10, y + 17, w - 20, 3); rect(c, '#94a489', x + w - 18, y + 1, 2, 18); rect(c, '#ba9c61', x + w - 34, y + 1, 16, 7); rect(c, '#ddcd97', x + w - 31, y + 3, 8, 2); }
  } else if (id === 'mine_shaft') {
    rect(c, '#292c29', x + 18, -17, w - 36, 17); rect(c, '#ad9260', x + 14, y + 5, 7, h - 8); rect(c, '#7c643f', x + w - 22, y + 5, 7, h - 8);
    for (let row = 0; row < 4; row++) { rect(c, '#8c744a', x + 20, y + 22 + row * 23, w - 42, 4); rect(c, '#493b2d', x + 22 + row * 10, y + 29 + row * 23, 5, 18); }
    rect(c, roof, x + 8, y + 5, w - 16, 10); rect(c, '#c1a06a', x + 3, y, w - 6, 5);
    rect(c, '#262a28', x + 32, y + 16, 46, 26); rect(c, '#b59962', x + 35, y + 18, 40, 20); rect(c, '#514834', x + 41, y + 22, 28, 12);
    const spin = animate ? Math.floor(time / 300) % 2 : 0;
    rect(c, '#d3bd86', x + 52, y + 17, 4, 23); rect(c, '#d3bd86', x + 36, y + 27 + spin * 2, 38, 3);
    rect(c, '#1d2222', x + 42, -27, 27, 25); rect(c, '#888d7b', x + 44, -25, 23, 3);
    if (tier >= 2) { rect(c, '#8a9590', x + 26, y + 44, 5, h - 48); rect(c, '#a5ada0', x + w - 32, y + 44, 5, h - 48); }
    if (tier >= 3) { rect(c, '#e2bd6c', x + 11, y + 49, 8, 10); rect(c, '#e2bd6c', x + w - 18, y + 49, 8, 10); }
    if (tier >= 4) { rect(c, '#adbbb0', x + 9, y + 11, 4, h - 15); rect(c, '#adbbb0', x + w - 13, y + 11, 4, h - 15); rect(c, '#b8c4b3', x + 19, y + 47, w - 38, 4); rect(c, '#4c6560', x + 72, -35, 22, 33); rect(c, '#b5c1b0', x + 73, -34, 20, 4); rect(c, '#cbb376', x + 80, y + 32, 2, h - 50); }
    if (tier >= 5) { rect(c, '#d2d9bf', x + 16, y + 15, 3, h - 20); rect(c, '#d2d9bf', x + w - 19, y + 15, 3, h - 20); rect(c, '#93a9a0', x + 20, -39, 18, 37); rect(c, '#d2d9bf', x + 21, -38, 16, 4); rect(c, '#b6c3ae', x + 21, -18, 16, 2); rect(c, '#d7bd7e', x + 23, y + 9, 7, 7); rect(c, '#5d7971', x + 25, y + 11, 3, 3); }
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
    if (id === 'tool_station') { rect(c, '#343a38', x + 8, -22, 27, 14); rect(c, '#969989', x + 5, -26, 35, 6); rect(c, '#dbb974', x + 20, -35, 3, 10); rect(c, '#9ba58b', x + 16, -36, 13, 3); if (activity.working) { rect(c, '#d6b169', x + 34, -31, 5, 2); if (animate && Math.floor(time / 200) % 2) { rect(c, '#f0d69c', x + 40, -36, 2, 2); rect(c, '#d6b169', x + 43, -29, 2, 1); } } }
    if (tier >= 2) { rect(c, '#c19a62', x + 4, y + 16, 5, h - 21); rect(c, '#c19a62', x + w - 9, y + 16, 5, h - 21); }
    if (tier >= 3) { rect(c, '#8a9590', x + 3, -7, w - 6, 4); rect(c, '#cbb887', x + 14, y + 13, 3, h - 18); }
  }
  // A small lit exterior lantern is useful at every actual building level.
  rect(c, '#2f3028', x + w - 14, -24, 7, 11); rect(c, animate && Math.floor(time / 600) % 2 ? '#f0d48b' : '#d9b96a', x + w - 12, -22, 3, 6);
  if (activity.ready) { rect(c, '#635332', x + w - 34, -20, 18, 19); rect(c, '#b59b60', x + w - 33, -19, 16, 16); rect(c, '#594f34', x + w - 27, -19, 3, 16); rect(c, '#e4d398', x + w - 30, -15, 9, 3); }
}

export function paintWorker(c: CanvasRenderingContext2D, x: number, y: number, specialty: DeepClaimSpecialty, pose: WorkerPose, elapsedMs: number, facing = 1, variant = 0, animate = true, gear: WorkerEquipmentPaint = {}) {
  const a = SPECIALTY_ART[specialty], px = Math.round(x * 16), py = Math.round(y * 16);
  const frame = animate ? Math.floor(elapsedMs / 220) % 4 : 0, walking = pose === 'walk' || pose === 'haul';
  const leg = walking ? frame % 2 * 2 : 0, bob = walking && frame % 2 ? -1 : 0;
  const skin = ['#c79c75', '#a87c5c', '#e0b48b', '#80604d'][Math.abs(variant) % 4];
  c.save(); c.translate(px, py); c.scale(facing < 0 ? -1 : 1, 1);
  rect(c, '#00000042', -5, 0, 11, 2); rect(c, '#24282a', -3, -4, 3, 4 - leg); rect(c, '#24282a', 1, -4 + leg, 3, 4 - leg);
  rect(c, '#2b3031', -4, -2 + leg, 4, 2); rect(c, '#2b3031', 1, -2, 5, 2);
  rect(c, a.coat, -4, -11 + bob, 8, 8); rect(c, '#493e32', -4, -5 + bob, 8, 2); rect(c, '#d1ba80', -1, -5 + bob, 2, 2);
  rect(c, skin, -3, -17 + bob, 7, 6); rect(c, '#45382e', 2, -15 + bob, 1, 1); rect(c, '#5b4936', -4, -17 + bob, 2, 5);
  rect(c, '#5b4b33', -5, -19 + bob, 11, 4); rect(c, gear.headTier === 2 ? '#b1c0b5' : gear.headTier === 1 ? '#c09361' : a.helmet, -4, -21 + bob, 8, 4); rect(c, '#e0c881', -3, -21 + bob, 5, 1);
  if (gear.headTier === 2) rect(c, '#667d79', -5, -17 + bob, 3, 4);
  if (gear.headBroken) rect(c, '#a65e3c', -1, -21 + bob, 1, 5);
  rect(c, '#34413c', 4, -18 + bob, 3, 3); rect(c, '#f0da8e', 5, -18 + bob, 2, 2);
  rect(c, skin, 3, -10 + bob, 3, 4);
  if (pose === 'survey') {
    rect(c, '#ccbc8b', 4, -12 + bob, 8, 7); rect(c, '#75886c', 5, -10 + bob, 5, 1); rect(c, '#75886c', 7, -11 + bob, 1, 5);
    rect(c, '#7b8e83', -7, -8, 3, 8); rect(c, '#c5cbaa', -9, -10, 7, 3); if (animate && frame % 2) rect(c, '#d4c797', -7, -11, 3, 1);
  } else if (pose === 'build') {
    const lift = animate && frame % 2 ? 3 : 0;
    rect(c, '#a58754', 5, -9 - lift, 2, 9); rect(c, '#aebcac', 3, -11 - lift, 7, 3); rect(c, '#89724a', 7, -4, 5, 4);
  } else if (pose === 'mine') {
    const swing = frame < 2 ? -1 : 1;
    rect(c, '#9f7b4d', 5, -13 - swing * 3, 2, 12); rect(c, gear.toolBroken ? '#8c5a40' : gear.toolTier === 3 ? '#c1d8d7' : gear.toolTier === 2 ? '#bfccc0' : gear.toolTier === 1 ? '#c19361' : '#a4b0a2', 2, -15 - swing * 3, gear.toolBroken ? 6 : 11, 3); rect(c, '#d1cfaa', 9, -16 - swing * 3, gear.toolBroken ? 1 : 4, 2);
    if (gear.toolTier === 2 && !gear.toolBroken) rect(c, '#607d77', 3, -13 - swing * 3, 5, 2);
    if (gear.toolTier === 3 && !gear.toolBroken) { rect(c, '#3f5c69', 2, -13 - swing * 3, 7, 2); rect(c, '#c1d8d7', 12, -14 - swing * 3, 2, 3); rect(c, '#3f5c69', 4, -7 - swing * 3, 4, 2); }
    if (animate && frame === 3) { rect(c, '#d2b374', 15, -5, 2, 1); rect(c, '#9c7953', 12, -8, 1, 2); }
  } else if (pose === 'haul') {
    rect(c, '#433c2e', -9, -12, 7, 11); rect(c, '#9a8054', -8, -11, 5, 9); rect(c, '#544a36', -7, -11, 1, 9);
  } else if (a.tool === 'map' || a.tool === 'scope') {
    rect(c, '#d0bd8e', 4, -10, 6, 6); rect(c, '#778465', 6, -9, 3, 1);
  } else if (a.tool === 'lamp') { rect(c, '#4a4934', 5, -5, 5, 6); rect(c, '#e3c273', 6, -4, 3, 3); }
  else if (a.tool === 'pack') { rect(c, '#7f6b45', -8, -12, 5, 10); rect(c, '#b69a5e', -7, -11, 3, 2); }
  else { rect(c, '#80603d', 5, -9, 1, 10); rect(c, gear.toolBroken ? '#8c5a40' : gear.toolTier === 3 ? '#c1d8d7' : gear.toolTier === 2 ? '#bfccc0' : gear.toolTier === 1 ? '#c19361' : '#a3a998', 3, -10, gear.toolBroken ? 4 : 7, 2); if (gear.toolTier === 3 && !gear.toolBroken) { rect(c, '#3f5c69', 4, -8, 4, 2); rect(c, '#c1d8d7', 9, -9, 2, 3); } }
  if (gear.utility === 'cargo') {
    rect(c, '#544b35', -9, -13, 6, 12); rect(c, gear.utilityBroken ? '#80674b' : '#ad9e65', -8, -12, 4, 10);
    if (gear.utilityTier === 2) { rect(c, '#a8b8ac', -10, -14, 2, 14); rect(c, '#a8b8ac', -10, -2, 9, 2); }
    if (gear.utilityTier === 3) { const metal = gear.utilityBroken ? '#80674b' : '#b5cdd0'; rect(c, metal, -11, -15, 2, 15); rect(c, metal, -11, -15, 9, 2); rect(c, metal, -11, -2, 10, 2); rect(c, '#3f5c69', -9, -11, 3, 3); rect(c, '#3f5c69', -6, -8, 3, 3); }
  }
  else if (gear.utility === 'lantern') { rect(c, '#6d6544', 7, -6, 5, 7); rect(c, gear.utilityBroken ? '#6e6650' : gear.utilityTier === 2 ? '#d4c29a' : '#edc77e', 8, -5, 3, 4); if (gear.utilityTier === 2) rect(c, '#ab8dc1', 9, -5, 1, 3); }
  else if (gear.utility === 'survey') { rect(c, '#b8ac7b', -8, -10, 4, 7); rect(c, gear.utilityBroken ? '#8a684a' : '#718c77', -7, -9, 2, 3); if (gear.utilityTier === 2) rect(c, '#b69bcb', -8, -4, 3, 2); }
  c.restore();
}

export function paintRail(c: CanvasRenderingContext2D, x: number, y: number, length: number) {
  for (let index = 0; index < length; index++) { rect(c, P.woodDark, (x + index) * 16 + 3, y * 16 + 11, 5, 4); }
  rect(c, '#69736b', x * 16, y * 16 + 11, length * 16, 1); rect(c, '#9b9e85', x * 16, y * 16 + 14, length * 16, 1);
}
