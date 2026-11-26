import type { MapDefinition, TileKind } from '../types';

const water = (tile?: TileKind) => tile === 'water' || tile === 'dark-water';
const raised = (tile?: TileKind) => tile === 'roof' || tile === 'wall';

/** Paint after the tile pass so faces, pilings and cast shadows cross tile seams. */
export function paintTerrainDepth(ctx: CanvasRenderingContext2D, map: MapDefinition) {
  const rect = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      const tile = map.tiles[row][col];
      const above = map.tiles[row - 1]?.[col], below = map.tiles[row + 1]?.[col];
      const left = map.tiles[row][col - 1], right = map.tiles[row][col + 1];
      const x = col * 16, y = row * 16;
      if (map.ambience === 'underwharf' && tile === 'wall') {
        const opensOnto = (neighbor?: TileKind) => neighbor !== undefined && neighbor !== 'wall';
        if (![above, below, left, right].some(opensOnto)) {
          rect('#253437', x, y, 16, 16);
        } else if (opensOnto(below)) {
          rect('#758178', x, y + 11, 16, 1);
          rect('#394a49', x, y + 12, 16, 3);
          rect('#213336', x, y + 15, 16, 1);
        }
      }
      if (water(tile)) continue;
      const wood = tile === 'wood' || (map.id === 'ship' && tile === 'wall');
      const bank = tile === 'sand' || tile === 'reeds' || tile === 'grass';
      const lip = bank ? '#a49a6e' : wood ? '#baa17b' : '#a3ad9a';
      const face = bank ? '#686f55' : wood ? '#544538' : '#4e6260';
      if (water(left)) rect(lip, x, y, 1, 16);
      if (water(right)) {
        rect(face, x + 15, y, 1, 16);
        rect('#213e4399', x + 16, y + 1, 2, 16);
      }
      if (water(above)) rect(lip, x, y, 16, 1);
      if (water(below)) {
        rect(lip, x, y + 14, 16, 1);
        rect(face, x, y + 15, 16, bank ? 2 : 4);
        rect('#213e43', x, y + (bank ? 17 : 19), 16, 1);
        if (wood && map.id !== 'ship' && col % 2 === 0) {
          rect('#443d35', x + 3, y + 16, 4, 9);
          rect('#897759', x + 3, y + 18, 1, 5);
          rect('#26494d', x + 2, y + 25, 7, 1);
        }
      }
      if (raised(above) && !raised(tile)) {
        rect('#182c2e55', x, y, 16, above === 'roof' ? 4 : 3);
        rect('#182c2e33', x + 1, y + (above === 'roof' ? 4 : 3), 15, 1);
      }
      if (raised(left) && !raised(tile)) rect('#182c2e33', x, y, 2, 16);
      if (tile === 'roof' && below !== 'roof' && map.id !== 'ship') {
        rect('#b78564', x, y + 12, 16, 1);
        rect('#453d37', x, y + 13, 16, 3);
      }
    }
  }
  if (map.ambience === 'underwharf') {
    rect(map.id === 'chamber' ? '#25203730' : '#10292e2c', 0, 0, map.width * 16, map.height * 16);
  }
  if (map.id === 'passage') {
    const lantern = map.objects.find(object => object.id === 'save-lamp');
    if (lantern) {
      const x = lantern.x * 16, y = lantern.y * 16;
      rect('#e2b66914', x - 7, y - 1, 30, 16);
      rect('#e2b66920', x - 3, y + 2, 22, 11);
      rect('#e2b66935', x + 1, y + 5, 14, 5);
    }
  }
  if (map.id === 'workshop') {
    // Late light falls between the two benches in short, stepped panes.
    for (let pane = 0; pane < 2; pane++) {
      for (let step = 0; step < 6; step++) {
        rect('#f3d79322', 106 + pane * 12 + step, 49 + step * 3, 9, 3);
      }
    }
  }
}
