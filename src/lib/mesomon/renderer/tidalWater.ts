import type { MapDefinition, TileKind } from '../types';

const isWater = (tile?: TileKind) => tile === 'water' || tile === 'dark-water';
const isBank = (tile?: TileKind) => tile === 'sand' || tile === 'reeds' || tile === 'grass';

/** Paint one body of water in world pixels. Crests can span many tiles, but
 * the water mask keeps them behind every quay, island and piece of dry land. */
export function paintTidalWater(ctx: CanvasRenderingContext2D, map: MapDefinition) {
  if (map.id === 'workshop') return;
  const openSea = map.ambience === 'harbor';
  const width = map.width * 16;
  const height = map.height * 16;
  ctx.save();
  ctx.beginPath();
  for (const [row, tiles] of map.tiles.entries()) {
    let start = -1;
    for (let col = 0; col <= tiles.length; col++) {
      if (isWater(tiles[col])) {
        if (start < 0) start = col;
      } else if (start >= 0) {
        ctx.rect(start * 16, row * 16, (col - start) * 16, 16);
        start = -1;
      }
    }
  }
  ctx.clip();
  ctx.fillStyle = openSea ? '#315e65' : '#29464e';
  ctx.fillRect(0, 0, width, height);

  // Offset successive swells and break the lit edge near the crest. Unequal
  // lengths and spacing avoid a checkerboard when the camera tracks the deck.
  for (let band = 0, y = 3; y < height; y += 8 + band % 5, band++) {
    for (let x = (band * 29) % 67 - 64, n = 0; x < width; n++) {
      const rhythm = (band * 31 + n * 17) % 23;
      const sy = y + (rhythm % 4);
      const span = 14 + rhythm;
      ctx.fillStyle = openSea ? '#2c565e' : '#263f49';
      ctx.fillRect(x + 1, sy + 1, span, 2);
      ctx.fillRect(x + span, sy, 7, 1);
      ctx.fillStyle = openSea ? '#3a6a6e' : '#325258';
      ctx.fillRect(x, sy, span - 4, 1);
      ctx.fillRect(x + span - 5, sy - 1, 7, 1);
      if (rhythm % 4 === 0) {
        ctx.fillStyle = openSea ? '#52817f' : '#456165';
        ctx.fillRect(x + span - 5, sy - 1, 4, 1);
        ctx.fillRect(x + span + 5, sy - 2, 2, 1);
      }
      x += span + 15 + rhythm % 11;
    }
  }

  // Sand and reed beds remain visible through the first few feet of water.
  // Clip to the same shoreline so wet sand never reads as extra walking room.
  for (const [row, tiles] of map.tiles.entries()) {
    for (let col = 0; col < tiles.length; col++) {
      if (!isWater(tiles[col]) || !isBank(map.tiles[row - 1]?.[col])) continue;
      const x = col * 16, y = row * 16;
      for (let offset = 0; offset < 16; offset += 2) {
        const depth = 4 + Math.round(2 * Math.sin((x + offset) / 6));
        ctx.fillStyle = '#66877d';
        ctx.fillRect(x + offset, y, 2, depth);
        ctx.fillStyle = '#4b7472';
        ctx.fillRect(x + offset, y + depth, 2, 3);
      }
      ctx.fillStyle = '#96a38a';
      ctx.fillRect(x + (col % 3) * 3, y + 2, 3, 1);
    }
  }
  ctx.restore();
}
