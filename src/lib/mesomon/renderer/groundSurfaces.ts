import type { MapDefinition, TileKind } from '../types';

type Rect = (color: string, x: number, y: number, w: number, h: number) => void;
type Bounds = { left: number; top: number; right: number; bottom: number };

function grain(row: number, piece: number) {
  const n = Math.imul(row + 41, 7417) ^ Math.imul(piece + 73, 2851);
  return (Math.imul(n ^ (n >>> 8), 1597334677) >>> 0);
}

/** Clip a whole piece of ground before laying its courses. A long board or a
 * chipped flagstone carries on across every gameplay tile it happens to cover. */
function cover(ctx: CanvasRenderingContext2D, map: MapDefinition, accepts: (tile: TileKind) => boolean,
  paint: (bounds: Bounds) => void) {
  const bounds = { left: map.width * 16, top: map.height * 16, right: 0, bottom: 0 };
  ctx.save();
  ctx.beginPath();
  map.tiles.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      if (!accepts(row[x])) { x++; continue; }
      const start = x++;
      while (x < row.length && accepts(row[x])) x++;
      ctx.rect(start * 16, y * 16, (x - start) * 16, 16);
      bounds.left = Math.min(bounds.left, start * 16);
      bounds.top = Math.min(bounds.top, y * 16);
      bounds.right = Math.max(bounds.right, x * 16);
      bounds.bottom = (y + 1) * 16;
    }
  });
  if (bounds.right > bounds.left) {
    ctx.clip();
    paint(bounds);
  }
  ctx.restore();
}

// The light faces the northwest. Dry limestone at the head of the quay gives
// way to cooler stones near the loading piers. Joints taper where feet polish them.
function paving(rect: Rect, bounds: Bounds) {
  const dry = ['#a4a895', '#a8ac9a', '#a0a593', '#a2a894', '#acae99'];
  const cool = ['#93a094', '#98a398', '#939d91', '#9ca69a', '#97a194'];
  const joint = '#7f8b80';
  rect(joint, bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  for (let row = 0, y = 0; y < bounds.bottom; row++) {
    const height = 10 + grain(row, 0) % 6;
    if (y + height > bounds.top) {
      for (let col = 0, x = -(grain(row, 1) % 27); x < bounds.right; col++) {
        const mark = grain(row, col);
        const width = 17 + mark % 24;
        if (x + width > bounds.left) {
          const seaward = y + 12 * Math.sin(x / 36) + ((mark >>> 8) % 20) > 357;
          const palette = seaward ? cool : dry;
          const body = palette[(mark >>> 12) % palette.length];
          const chip = 1 + ((mark >>> 19) % 3);
          rect(body, x + 1, y + 1, width - 1, height - 2);
          rect(body, x + 1 + chip, y, width - 2 - chip, 1);
          rect(body, x + 2, y + height - 1, width - 4 - chip, 1);
          rect(seaward ? '#a2aea1' : '#b4b5a0', x + chip + 2, y + 1, 4 + (mark >>> 6) % (width - 9), 1);
          if ((mark & 3) === 0) {
            rect(seaward ? '#8b988d' : '#98a08e', x + width - 6, y + height - 3, 3, 1);
            rect(seaward ? '#8b988d' : '#98a08e', x + width - 3, y + height - 4, 2, 1);
          }
        }
        x += width;
      }
    }
    y += height;
  }
}

function laidTimber(rect: Rect, bounds: Bounds, damp: boolean) {
  const boards = damp ? ['#786b54', '#82755c', '#786e57', '#84775f', '#7c725b']
    : ['#9a805e', '#a28764', '#a38b68', '#9b8362', '#a88a65'];
  const caulk = damp ? '#54564b' : '#77664f';
  const worn = damp ? '#96886a' : '#b79c78';
  rect(caulk, bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  for (let row = 0, y = 0; y < bounds.bottom; row++) {
    const height = 7 + grain(row, 5) % 4;
    if (y + height > bounds.top) {
      for (let col = 0, x = -(grain(row, 6) % 51); x < bounds.right; col++) {
        const mark = grain(row, col + 1);
        const width = 36 + mark % 38;
        if (x + width > bounds.left) {
          rect(boards[(mark >>> 6) % boards.length], x + 1, y, width - 1, height - 1);
          rect(worn, x + 2, y, 7 + ((mark >>> 12) % (width - 10)), 1);
          rect(caulk, x + 3, y + 2, 1, 1);
          if ((mark & 3) === 0) {
            const knot = x + 9 + (mark >>> 16) % (width - 21);
            const grainInk = damp ? '#716b54' : '#917857';
            rect(grainInk, knot - 4, y + 4, 5, 1);
            rect(grainInk, knot + 1, y + 3, 5, 1);
            rect(grainInk, knot + 6, y + 4, 8, 1);
            rect(worn, knot + 2, y + 5, 4, 1);
          }
        }
        x += width;
      }
    }
    y += height;
  }
}

export const isTidalBank = (tile?: TileKind) => tile === 'sand' || tile === 'reeds';

function shore(rect: Rect, map: MapDefinition, bounds: Bounds) {
  rect('#b9ae8a', bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  for (let x = bounds.left; x < bounds.right; x += 2) {
    const tide = bounds.top + 32 + Math.round(8 * Math.sin(x / 29) + 3 * Math.sin(x / 11));
    rect('#a8a586', x, tide, 2, bounds.bottom - tide);
    rect('#98a086', x, tide + 9, 2, bounds.bottom - tide);
  }
  for (let row = bounds.top / 16; row < bounds.bottom / 16; row++) {
    for (let col = bounds.left / 16; col < bounds.right / 16; col++) {
      const tile = map.tiles[row]?.[col];
      if (!isTidalBank(tile)) continue;
      const mark = grain(row, col);
      const x = col * 16 + 2 + mark % 11, y = row * 16 + 5 + (mark >>> 9) % 9;
      rect('#939579', x, y, 4, 1);
      rect('#c9bf9b', x + 1, y - 1, 2, 1);
      if (tile !== 'reeds') continue;
      // Leaning rushes have a dark base, a sunlit blade and soft mud beneath.
      rect('#828e76', x - 2, y + 1, 8, 1);
      rect('#6c8069', x, y - 2, 3, 3);
      rect('#768970', x - 1, y - 4, 1, 3);
      rect('#77896f', x + 2, y - 5, 1, 4);
      rect('#b3b186', x + 3, y - 6, 1, 3);
      if (mark & 1) rect('#8f7759', x + 2, y - 7, 1, 2);
    }
  }
}

/** Native map art baked once with the location. No additional runtime layer. */
export function paintGroundSurfaces(ctx: CanvasRenderingContext2D, map: MapDefinition) {
  if (map.id === 'ship' || map.id === 'workshop') return;
  const rect: Rect = (color, x, y, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  if (map.id === 'harbor') {
    cover(ctx, map, tile => tile === 'stone', bounds => paving(rect, bounds));
    cover(ctx, map, isTidalBank, bounds => shore(rect, map, bounds));
  }
  cover(ctx, map, tile => tile === 'wood', bounds => laidTimber(rect, bounds, map.ambience === 'underwharf'));
}
