// Original native-resolution sprite drawings. Dots are transparent pixels.
const drawings = {
  skiff: [
    '....3...','...232..','1..242..','21.242.1','22124212','12333321','.121121.','..2..2..',
  ],
  bankLeft: [
    '...3....','..232...','1.242...','21242..1','21422112','12333221','.121.21.','..2...2.',
  ],
  bankRight: [
    '....3...','...232..','...242.1','1..24212','21122412','12233321','.12.121.','.2...2..',
  ],
  flicker: [
    '....22.','.1.231.','12.31..','.22.1..','..31.22','..2..1.','..1....',
  ],
  flickerFold: [
    '.....2.','...231.','12.31..','.22.1..','..31.2.','.2...12','.1.....',
  ],
  sliver: [
    '....223','...231.','..21...','.2..21.','...231.','..231..','.22....',
  ],
  sliverFold: [
    '.....23','...231.','..21...','1...21.','...23..','..231..','122....',
  ],
  herald: [
    '2.......2..','12..4...32.','.22.32.221.','..2233221..','...21422...','.221.1.122.','12..2.2..11',
  ],
  heraldFold: [
    '.2.....2...','.12.4..32..','..2.32.21..','..2233221..','...21422...','..21.1.12..','.12.2.2..21',
  ],
  diver: [
    '.2....1..','.12..32..','..2232.21','...24121.','...232...','....21...','....2....',
  ],
  diverFold: [
    '...2..1..','..12.32..','...232.2.','...2412..','...232...','....21...','....2....',
  ],
  anchor: [
    '.....11.............11.....','..12221.....222.....12221..',
    '.2231.....1233321.....1322.','123..1..11231113211..1..321',
    '12..12122321...12322121..21','.2.13..231.12221.132..31.2.',
    '..12...12.1233321.21...21..','..21...12..24342..21...12..',
    '...12...121.242.121...21...','....21..1231.1.1321..12....',
    '.....21..121...121..12.....','......11..21...12..11......',
    '...........1...1...........',
  ],
} as const;

export type SpriteName = keyof typeof drawings;
const paints = {
  skiff: ['#255467', '#45c4b0', '#c9f4d8', '#e1b44c'],
  flicker: ['#604076', '#c08dca', '#f3d3c2', '#e1b44c'],
  sliver: ['#6e498c', '#a7a2e2', '#eaebe0', '#e1b44c'],
  herald: ['#6d405c', '#c47792', '#f5beb2', '#f6d17c'],
  diver: ['#804763', '#de7883', '#f8c6a1', '#fff0af'],
  anchor: ['#684469', '#ad74a8', '#dfb8d4', '#f8d286'],
};
const contrastShip = ['#426d76', '#7af7d6', '#fffce2', '#ffc470'];
const contrastHostile = ['#835777', '#eca5c6', '#fff3db', '#ffd16e'];
const plates = new Map<string, HTMLCanvasElement>();

export function sprite(ctx: CanvasRenderingContext2D, name: SpriteName, cx: number, cy: number, contrast: boolean) {
  const key = (contrast ? 'bright-' : '') + name;
  let plate = plates.get(key);
  if (!plate) {
    const rows = drawings[name];
    const type = name.startsWith('bank') ? 'skiff' : name.replace('Fold', '') as keyof typeof paints;
    const colors = contrast ? (type === 'skiff' ? contrastShip : contrastHostile) : paints[type];
    plate = document.createElement('canvas');
    plate.width = rows[0].length;
    plate.height = rows.length;
    const pen = plate.getContext('2d');
    if (!pen) return;
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const pixel = rows[y][x];
        if (pixel === '.') continue;
        pen.fillStyle = colors[Number(pixel) - 1];
        pen.fillRect(x, y, 1, 1);
      }
    }
    plates.set(key, plate);
  }
  ctx.drawImage(plate, Math.round(cx) - Math.floor(plate.width / 2), Math.round(cy) - Math.floor(plate.height / 2));
}

// Three columns on a five-pixel cap height. Narrow counters stay open even on a 1× LCD.
const glyphs: Record<string, readonly number[]> = {
  '0':[7,5,5,5,7], '1':[2,6,2,2,7], '2':[7,1,7,4,7], '3':[7,1,3,1,7],
  '4':[5,5,7,1,1], '5':[7,4,6,1,6], '6':[3,4,7,5,7], '7':[7,1,2,2,2],
  '8':[7,5,7,5,7], '9':[7,5,7,1,6],
  A:[2,5,7,5,5], B:[6,5,6,5,6], C:[3,4,4,4,3], D:[6,5,5,5,6],
  E:[7,4,6,4,7], F:[7,4,6,4,4], G:[3,4,5,5,3], H:[5,5,7,5,5],
  I:[7,2,2,2,7], J:[1,1,1,5,2], K:[5,5,6,5,5], L:[4,4,4,4,7],
  M:[5,7,7,5,5], N:[5,7,7,7,5], O:[2,5,5,5,2], P:[6,5,6,4,4],
  Q:[2,5,5,7,3], R:[6,5,6,5,5], S:[3,4,2,1,6], T:[7,2,2,2,2],
  U:[5,5,5,5,7], V:[5,5,5,5,2], W:[5,5,7,7,5], X:[5,5,2,5,5],
  Y:[5,5,2,2,2], Z:[7,1,2,4,7], '+':[0,2,7,2,0], '-':[0,0,7,0,0],
  '.':[0,0,0,0,2], '/':[1,1,2,4,4], ' ':[0,0,0,0,0],
};
export function print(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  for (const character of text) {
    const glyph = glyphs[character];
    if (glyph) {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if (glyph[row] & (4 >> col)) ctx.fillRect(x + col, y + row, 1, 1);
        }
      }
    }
    x += 4;
  }
}
