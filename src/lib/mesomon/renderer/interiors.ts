import type { MapDefinition, MapId } from '../types';
import { paintWorkshop } from './workshop';

/** Courses run across tile boundaries. Only the collision map's floor tiles expose them. */
export function paintInteriorFloor(ctx: CanvasRenderingContext2D, map: MapDefinition) {
  const timber = map.id === 'workshop';
  if (!timber && map.ambience !== 'underwharf') return;
  ctx.save();
  ctx.beginPath();
  for (let row = 0; row < map.height; row++) {
    map.tiles[row].forEach((tile, col) => {
      if (tile === 'floor' || tile === 'stone' || (timber && tile === 'wood')) ctx.rect(col * 16, row * 16, 16, 16);
    });
  }
  ctx.clip();
  const colors = timber ? ['#997c60', '#96785c', '#987b5f', '#9f8061'] : ['#70817c', '#73837c', '#76867e', '#70817d'];
  const course = timber ? 9 : 13;
  for (let row = 0; row * course < map.height * 16; row++) {
    let x = -(row % 3) * 13;
    for (let col = 0; x < map.width * 16; col++) {
      const hash = row * 37 + col * 23 + (row ^ col) * 7;
      const width = (timber ? 40 : 26) + hash % 17;
      const y = row * course;
      ctx.fillStyle = colors[(hash >>> 2) % colors.length];
      ctx.fillRect(x, y, width, course);
      ctx.fillStyle = timber ? '#80664f' : '#606f6c';
      ctx.fillRect(x, y + course - 1, width, 1);
      ctx.fillRect(x, y + 1, 1, course - 2);
      ctx.fillStyle = timber ? '#ab8b69' : '#89958b';
      ctx.fillRect(x + 2, y, width - (hash % 8) - 6, 1);
      if (hash % 5 === 0) {
        ctx.fillStyle = timber ? '#7d654f' : '#687b75';
        ctx.fillRect(x + 3, y + 4, timber ? 1 : 3, 1);
      }
      x += width;
    }
  }
  ctx.restore();
}

/** All coordinates are map pixels. These illustrations are baked once per map. */
export function paintInterior(ctx: CanvasRenderingContext2D, id: MapId) {
  if (!['workshop', 'passage', 'tide-stairs', 'chamber'].includes(id)) return;
  const rect = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  // Integer raster lines keep ropes, tools and curved stonework on the same pixel grid as actors.
  const line = (color: string, x: number, y: number, tx: number, ty: number) => {
    const dx = Math.abs(tx - x), dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1;
    let error = dx + dy;
    while (true) {
      rect(color, x, y, 1, 1);
      if (x === tx && y === ty) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
  };

  const iron = '#34464a', brass = '#b19864', timber = '#705a48';
  const post = (x: number, y: number, height: number) => {
    rect('#1e3036', x + 2, y + 2, 9, height);
    rect('#4e4941', x, y, 8, height);
    rect('#8a7a60', x + 1, y, 2, height - 1);
    rect('#68614f', x + 3, y, 3, height);
    for (const band of [4, height - 9]) {
      rect(iron, x - 1, y + band, 10, 4);
      rect('#8b9481', x, y + band, 8, 1);
      rect(brass, x + 2, y + band + 2, 1, 1);
    }
    rect('#47645e', x, y + height - 4, 8, 3);
  };
  const crossbeam = (x: number, y: number, w: number) => {
    rect('#1b2b30', x + 1, y + 2, w, 8);
    rect(timber, x, y, w, 7);
    rect('#938067', x, y, w, 1);
    rect('#524a40', x + 1, y + 5, w - 2, 2);
    for (const bolt of [4, w - 7]) {
      rect(iron, x + bolt, y, 4, 7);
      rect('#9a9c87', x + bolt + 1, y + 2, 1, 1);
    }
  };
  if (id === 'workshop') {
    paintWorkshop(rect, line);
    return;
  }

  if (id === 'passage') {
    // The incoming service corridor skirts a barred tidal outfall. Its mouth,
    // damp apron and tide staff occupy the masonry east of the walking lane.
    const x = 113, y = 258;
    rect('#334a4d', x, y, 47, 49);
    for (let course = 0; course < 6; course++) {
      const row = y + course * 8;
      rect('#465a58', x, row, 47, 1);
      for (let joint = x + (course % 2 ? 6 : 15); joint < x + 47; joint += 19) rect('#293c40', joint, row + 1, 1, 7);
    }
    for (let row = 0; row < 25; row++) {
      const inset = [11, 8, 6, 4, 3, 2, 1][row] ?? 0;
      rect('#839089', x + 5 + inset, y + 7 + row, 34 - inset * 2, 1);
      if (row < 3) continue;
      const inner = [9, 6, 4, 2, 1][row - 3] ?? 0;
      rect('#172c34', x + 9 + inner, y + 7 + row, 26 - inner * 2, 1);
    }
    for (const [start, top] of [[11, 16], [16, 13], [21, 11], [26, 12], [31, 15]]) {
      rect('#586661', x + start, y + top, 2, 31 - top);
      rect('#899182', x + start, y + top + 1, 1, 30 - top);
    }
    rect('#436968', x + 7, y + 32, 31, 5);
    rect('#81a396', x + 10, y + 32, 22, 1);
    rect('#496664', x + 3, y + 37, 36, 2);
    rect('#6a8880', x + 17, y + 38, 13, 1);
    rect('#bdad85', x + 41, y + 9, 3, 24);
    for (let tick = 0; tick < 5; tick++) rect(iron, x + 41, y + 11 + tick * 4, tick % 2 + 1, 1);
    post(20, 252, 48);
    post(114, 219, 35);
    crossbeam(113, 248, 45);
    crossbeam(112, 166, 44);
    post(226, 108, 60);
    crossbeam(225, 100, 15);
  } else if (id === 'tide-stairs') {
    post(51, 46, 44);
    post(139, 32, 14);
    crossbeam(49, 33, 117);
    // Sheaves and a bright measuring chain above the first descent.
    for (const x of [67, 81]) {
      rect('#323e3b', x + 2, 38, 7, 9);
      rect(brass, x + 3, 40, 5, 5);
      rect(iron, x + 4, 41, 3, 3);
    }
    line('#c0a579', 70, 44, 70, 53);
    line('#a0855e', 70, 53, 83, 45);
    rect('#b9ac89', 60, 51, 3, 24);
    for (let i = 0; i < 5; i++) rect(iron, 60, 53 + i * 4, i % 2 + 1, 1);
  } else {
    // Iron tie rods and worn brackets anchor the chamber to the pier above it.
    post(36, 69, 51);
    post(243, 122, 58);
    crossbeam(35, 35, 79);
    crossbeam(180, 35, 71);
    rect('#426268', 193, 153, 45, 3);
    rect('#88a79b', 199, 153, 13, 1);
    rect('#78968d', 218, 154, 8, 1);
  }
}
