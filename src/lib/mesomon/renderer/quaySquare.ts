import type { MapDefinition } from '../types';

const bell = [
  '       ss       ',
  '      sbbs      ',
  '      shbs      ',
  '     sssssb     ',
  '    shhhbbds    ',
  '    shqhbdds    ',
  '    shqhbbds    ',
  '   sbbhhbbdds   ',
  '   shqhhbbbds   ',
  '  sbbhhbbbddds  ',
  '  shhbbbbbddds  ',
  ' shhhbbbbbbddds ',
  'sqqhhhhhhbbbbdds',
  'sbbbbbddddddddds',
  ' ssssssssssssss ',
  '       ds       ',
  '      sbds      ',
  '       ss       ',
];
const bellInk: Record<string, string> = {
  s: '#404441', d: '#785d41', b: '#b4864e', h: '#d8ae65', q: '#f9d989',
};

export const quayFixtures = [
  { id: 'quay-bell', x: 307, y: 322, width: 42, height: 57, footY: 378 },
  { id: 'rope-stock', x: 363, y: 384, width: 36, height: 25, footY: 408 },
] as const;
export type QuayFixture = typeof quayFixtures[number];

function pixelTools(ctx: CanvasRenderingContext2D) {
  const rect = (ink: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = ink;
    ctx.fillRect(x, y, w, h);
  };
  const line = (ink: string, x: number, y: number, x2: number, y2: number) => {
    const length = Math.max(Math.abs(x2 - x), Math.abs(y2 - y), 1);
    for (let n = 0; n <= length; n++) rect(ink, Math.round(x + (x2 - x) * n / length), Math.round(y + (y2 - y) * n / length), 1, 1);
  };

  return { rect, line };
}

export function paintQuaySquare(ctx: CanvasRenderingContext2D, map: MapDefinition) {
  if (map.id !== 'harbor') return;
  const { rect, line } = pixelTools(ctx);
  const [mast, stock] = quayFixtures;
  // The port surveyor's compass is set flush into the centre of the freight lane.
  const cx = mast.x - 9, cy = mast.footY - 26;
  // Four shallow rings form a worn civic seal. Their flat sides follow the
  // freight lane and the compass facets catch the light from the northwest.
  const octagon = (color: string, radius: number, height: number) => {
    for (let y = -height; y <= height; y++) {
      const chamfer = Math.max(0, Math.abs(y) - Math.floor(height / 3)) * 2;
      rect(color, cx - radius + chamfer, cy + y, (radius - chamfer) * 2 + 1, 1);
    }
  };
  octagon('#758079', 39, 13);
  octagon('#ada990', 38, 12);
  octagon('#8d9385', 36, 11);
  octagon('#829087', 28, 8);
  line('#bac0a7', cx - 38, cy - 3, cx - 23, cy - 12);
  line('#bac0a7', cx - 23, cy - 12, cx + 18, cy - 12);
  line('#6f7c73', cx + 25, cy + 11, cx + 37, cy + 4);
  for (const [x, y, x2, y2] of [[-31,-6,-24,-4], [-12,-11,-10,-8], [11,-11,9,-8], [31,-5,24,-3], [-31,6,-24,4], [-12,11,-10,8], [11,11,9,8], [31,5,24,3]]) {
    line('#758078', cx + x, cy + y, cx + x2, cy + y2);
  }
  for (const x of [-31, 31]) {
    rect('#c1b28d', cx + x - 1, cy - 1, 3, 2);
    rect('#dbca9e', cx + x - 1, cy - 1, 1, 1);
  }
  for (const [x, y, x2, y2] of [[-16, 0, -9, -6], [-9, -6, 8, -6], [8, -6, 16, 0], [16, 0, 9, 6], [9, 6, -9, 6], [-9, 6, -16, 0]]) {
    line('#aaa48b', cx + x, cy + y, cx + x2, cy + y2);
  }
  for (let i = 0; i < 8; i++) {
    rect('#b4ac8f', cx - 1, cy - 8 + i, 1 + Math.floor(i / 3), 1);
    rect('#67776e', cx, cy + i, 1 + Math.floor((7 - i) / 3), 1);
  }
  line('#b8ad8f', cx - 13, cy, cx + 12, cy);
  rect('#c8b997', cx - 1, cy - 1, 3, 3);

  // Contact and cast shadows belong on the paving under the moving cast.
  for (let i = 0; i < 14; i++) rect('#445b593d', mast.x + 25 + i, mast.footY - 1 + Math.floor(i / 3), 6, 2);
  rect('#59656355', stock.x + 8, stock.footY, 19, 3);
  // The rope jack's spindle sits behind the perforated brass rim. Those holes
  // keep the maker visible through the wheel. The crank rests here without motion.
  rect('#515e53', stock.x + 24, stock.y + 7, 10, 8);
  rect('#40514b', stock.x + 25, stock.y + 6, 8, 10);
  line('#b69a6c', stock.x + 25, stock.y + 14, stock.x + 32, stock.y + 7);
}

/** Draw into a transparent texture at local coordinates, sorted by the support's foot. */
export function paintQuayFixture(ctx: CanvasRenderingContext2D, piece: QuayFixture) {
  const { rect, line } = pixelTools(ctx);
  if (piece.id === 'quay-bell') {
    // The cantilever carries the bell left of the rigger's face.
    const x = 25, foot = 56, top = foot - 43;
    rect('#4d4a3f', x - 3, top - 2, 6, 44);
    rect('#ba986a', x - 2, top - 2, 2, 43);
    rect('#967451', x, top, 2, 41);
    rect('#495850', x - 3, foot - 5, 7, 5);
    rect('#b0a085', x - 3, foot - 5, 5, 1);
    rect('#4f4d41', x - 25, top + 3, 30, 4);
    rect('#cba575', x - 25, top + 2, 28, 2);
    for (let i = 0; i < 3; i++) line(i === 0 ? '#b89a73' : '#78644c', x - 12, top + 6 + i, x - 1, top + 17 + i);
    rect('#555c50', x - 18, top + 4, 3, 3);
    for (const [row, pixels] of bell.entries()) for (const [col, ink] of [...pixels].entries()) {
      if (ink !== ' ') rect(bellInk[ink], x - 24 + col, top + 7 + row, 1, 1);
    }
    line('#635945', x - 16, top + 23, x - 18, top + 32);
    line('#b69c71', x - 17, top + 24, x - 19, top + 32);
    rect('#564d40', x - 20, top + 32, 4, 2);
    rect('#504f43', x - 1, top - 12, 2, 11);
    rect('#d6b67e', x - 2, top - 13, 3, 2);
    for (let i = 0; i < 16; i++) {
      const sag = i === 0 ? 0 : i < 5 ? 1 : i < 9 ? 2 : 1;
      const height = 7 - Math.floor(i / 2.5);
      rect(i < 4 ? '#b65e43' : '#407877', x + 1 + i, top - 11 + sag, 1, height);
      rect(i < 4 ? '#df9e70' : '#8cbbb0', x + 1 + i, top - 11 + sag, 1, 1);
    }

    return;
  }
  // Three differently dressed hanks hang on brass pegs above the maker.
  const rx = 13, ry = 24;
  rect('#534c3f', rx - 7, ry - 24, 3, 25);
  rect('#bd9a68', rx - 7, ry - 24, 1, 24);
  rect('#534c3f', rx + 5, ry - 24, 3, 25);
  rect('#af8d61', rx + 5, ry - 24, 1, 24);
  rect('#62503f', rx - 13, ry - 24, 26, 4);
  rect('#d0ab77', rx - 13, ry - 24, 26, 1);
  for (const [dx, length, light] of [[-10, 11, '#d1ae79'], [-2, 8, '#c6a470'], [6, 14, '#aab29a']] as const) {
    const left = rx + dx, y = ry - 21;
    rect('#534d43', left, y, 5, length);
    rect(light, left, y + 1, 1, length - 2);
    rect('#74664e', left + 2, y + 3, 1, length - 5);
    rect(light, left + 4, y + 2, 1, length - 4);
    rect(light, left + 1, y + length - 1, 3, 1);
    rect('#e0bf79', left + 2, y - 1, 2, 2);
  }
  // The side-mounted turning jack winds the third hank, its axle and frame
  // standing at the same foot depth as the rope rack and its keeper.
  rect('#6e604c', 27, 15, 4, 8);
  rect('#b19971', 27, 15, 1, 7);
  rect('#555a4b', 24, 22, 10, 2);
  line('#574f40', 24, 8, 26, 5);
  line('#574f40', 26, 5, 32, 5);
  line('#574f40', 32, 5, 35, 8);
  line('#574f40', 35, 8, 35, 14);
  line('#574f40', 35, 14, 32, 17);
  line('#574f40', 32, 17, 26, 17);
  line('#574f40', 26, 17, 23, 14);
  line('#574f40', 23, 14, 23, 9);
  line('#ccaf7b', 24, 8, 27, 5);
  rect('#dcc295', 27, 5, 5, 1);
  line('#aa946d', 34, 13, 31, 16);
  rect('#cab076', 28, 10, 3, 3);
  rect('#f0d09c', 28, 10, 1, 1);

}
