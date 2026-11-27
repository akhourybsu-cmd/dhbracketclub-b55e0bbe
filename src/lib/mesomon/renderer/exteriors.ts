import type { MapDefinition } from '../types';
import { exteriorObstacles } from '../data/exteriorObstacles';

type Point = [number, number];

/** Native raster shapes keep the steep rigging and the shallow roof ridges equally crisp. */
function pixels(ctx: CanvasRenderingContext2D) {
  function rect(color: string, x: number, y: number, width: number, height: number) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  }
  function polygon(color: string, ...points: Point[]) {
    ctx.fillStyle = color;
    const ys = points.map(point => point[1]);
    for (let y = Math.min(...ys); y < Math.max(...ys); y++) {
      const cuts: number[] = [];
      points.forEach(([x1, y1], i) => {
        const [x2, y2] = points[(i + 1) % points.length];
        if ((y1 > y + .5) !== (y2 > y + .5)) cuts.push(x1 + (y + .5 - y1) * (x2 - x1) / (y2 - y1));
      });
      cuts.sort((a, b) => a - b);
      for (let i = 0; i + 1 < cuts.length; i += 2) {
        const left = Math.ceil(cuts[i] - .5);
        ctx.fillRect(left, y, Math.ceil(cuts[i + 1] - .5) - left, 1);
      }
    }
  }
  function line(color: string, ...points: Point[]) {
    ctx.fillStyle = color;
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i - 1], [endX, endY] = points[i];
      const steps = Math.max(Math.abs(endX - x), Math.abs(endY - y));
      for (let n = 0; n <= steps; n++) {
        const t = steps ? n / steps : 0;
        ctx.fillRect(Math.round(x + (endX - x) * t), Math.round(y + (endY - y) * t), 1, 1);
      }
    }
  }
  return { ctx, rect, polygon, line };
}
type Paint = ReturnType<typeof pixels>;

const deep = '#364446', darkWood = '#584b3d', brass = '#c4a16c', bright = '#dbc397';

// The near edge of each piece meets its collision footprint. Paint in local
// native pixels so art and movement stay aligned when a work bay is relocated.
function paintWorkingGear(p: Paint, zone: 'ship' | 'harbor') {
  for (const footprint of exteriorObstacles[zone]) {
    p.ctx.save();
    p.ctx.translate(footprint.x * 16, footprint.y * 16);
    switch (footprint.id) {
      case 'mail-locker': {
        // The bulged lid overhangs its cedar case. The straps follow the same arc.
        p.polygon('#343e3e55', [1, 12], [44, 11], [51, 16], [48, 18], [6, 17]);
        p.rect('#493d32', 2, 6, 44, 9);
        p.rect('#a27a51', 3, 7, 36, 6);
        p.rect('#7b563e', 4, 12, 35, 2);
        p.rect('#c6a06b', 3, 8, 35, 1);
        p.rect('#5a5646', 7, 12, 2, 3); p.rect('#5a5646', 37, 12, 2, 3);
        break;
      }
      case 'raised-hatch':
        // The raised coaming around the loaded grating has a visible toe and lip.
        p.rect('#624f3d', 1, 13, 31, 3);
        p.rect('#cbab78', 1, 13, 31, 1);
        break;
      case 'salt-store': {
        // Stacked salt boxes: lower boards, a split lid and white salt at the seams.
        p.polygon('#34474352', [2,8],[42,6],[52,13],[52,31],[46,35],[8,33]);
        for (const [x, y, w, h] of [[1, 2, 23, 15], [25, 2, 21, 15], [2, 15, 29, 16], [32, 16, 14, 14]]) {
          p.rect('#5d5748', x, y, w, h);
          p.rect('#be9d75', x + 1, y, w - 3, h - 8);
          p.rect('#a47d58', x + 1, y + h - 8, w - 3, 7);
          p.rect('#e0c699', x + 2, y + h - 9, w - 4, 2);
          p.rect('#77624b', x + 1, y + h - 4, w - 3, 1);
          for (const dx of [2, w - 5]) p.rect('#726854', x + dx, y, 2, h - 1);
          p.line('#d6c7a1', [x + 5, y + 2], [x + w - 7, y + h - 10]);
        }
        p.polygon('#463f3954',[5,8],[37,7],[46,14],[39,17],[19,18],[8,15]);
        break;
      }
      case 'timber-stocks': {
        // Two dark sleepers raise a bank of shipwright's spars above the wet quay.
        for (const x of [6, 37]) {
          p.rect('#4d4a3f', x, 2, 5, 30); p.rect('#968364', x, 3, 2, 27);
        }
        for (let i = 0; i < 5; i++) {
          const x = 1 + (i % 2) * 2, y = 2 + 5 * i;
          p.polygon('#625440', [x, y+1], [42, y], [46, y+2], [46,y+5], [4,y+6], [x,y+4]);
          p.line('#be9a6a', [x+1,y+2], [41,y+1]);
          p.line('#94724f', [x+2,y+4], [41,y+3]);
          p.rect('#d5af77', 43, y+1, 3, 3);
          p.rect('#94734d', 44, y+2, 1, 1);
        }
        for (const x of [9, 34]) p.line('#c1ac7d',[x,1],[x+2,15],[x+1,28]);
        break;
      }
      case 'barrel-dray': {
        // Broad iron wheels and three upright casks on the weighbridge.
        p.rect('#494d45', 0, 13, 5, 4);
        p.rect('#655640', 4, 7, 40, 20); p.rect('#b49569', 5, 7, 39, 2);
        p.rect('#99774e', 5, 22, 39, 5);
        p.rect('#60523e', 3, 25, 42, 3);
        for (const x of [7, 34]) {
          p.rect('#3a4844', x, 24, 6, 7); p.rect('#928976', x + 1, 25, 2, 5);
        }
        for (const [x,y] of [[8, 3], [27, 3], [18, 11]]) {
          p.polygon('#70553d',[x,y+2],[x+3,y],[x+9,y],[x+12,y+3],[x+12,y+10],[x+10,y+13],[x+3,y+13],[x,y+10]);
          p.rect('#ae865c',x+2,y+2,8,10); p.rect('#d0ad79',x+3,y+1,6,2);
          for (const dy of [4,10]) p.rect('#59675c',x+1,y+dy,11,2);
          p.rect('#c0b18a',x+3,y+4,2,1);
        }
        break;
      }
      case 'fish-trestle': {
        for (const x of [3, 22, 43]) p.rect('#5f5544', x, 8, 2, 7);
        p.rect('#5b5848', 0, 2, 47, 10); p.rect('#a89571', 1, 1, 45, 8);
        p.rect('#c8b48a', 0, 8, 47, 2);
        for (let i = 0; i < 4; i++) {
          const x = 3+i*11, y = i%2+3;
          p.polygon('#627b76',[x,y],[x+3,y+2],[x+6,y],[x+9,y+1],[x+8,y+3],[x+4,y+4],[x+2,y+3],[x,y+4]);
          p.rect('#b5c9b5',x+4,y+2,4,1); p.rect(deep,x+7,y+1,1,1);
        }
        break;
      }
      case 'oyster-tanks': {
        // Water sits below the stone coping and loose oyster baskets hang from cleats.
        p.rect('#546460', 1, 1, 46, 29); p.rect('#b2ae92', 1, 1, 45, 24);
        for (const x of [4, 25]) {
          p.rect('#586c65',x,4,17,17); p.rect('#507b78',x+1,6,15,14);
          p.rect('#88a79a',x+4,8,9,1); p.rect('#a4b6a1',x+6,17,5,1);
          p.rect('#756b4f',x+3,9,7,6);
          p.line('#b8ab7a',[x+1,3],[x+5,10],[x+8,12]);
          p.rect('#a59e80',x+5,11,2,2);
        }
        p.rect('#758779',2,24,44,4); p.rect('#c6c2a2',1,23,45,1);
        break;
      }
      case 'rope-drying-rack': {
        for (const x of [2, 30, 59]) {
          p.rect('#605640',x,1,3,14); p.rect('#bda274',x,2,1,12);
        }
        p.rect('#847153',1,1,62,3); p.rect('#d5ba8a',1,1,62,1);
        for (const x of [5, 15, 25, 35, 45, 54]) {
          p.line('#85704e',[x,3],[x+1,10],[x+4,13],[x+6,10],[x+6,3]);
          p.line('#d0b582',[x+1,3],[x+2,9],[x+4,11],[x+5,9],[x+5,3]);
        }
        break;
      }
      case 'upper-quay-curb':
      case 'lower-quay-curb':
      case 'east-quay-curb': {
        // Two stretches on Bram's side leave the break in the rail exactly
        // one walking tile wide. The high side overlooks the water.
        const length = footprint.height * 16;
        p.rect('#4d615e', 1, 0, 13, length);
        p.rect('#899486', 2, 0, 10, length - 2);
        p.rect('#bbbaa0', 2, 0, 2, length - 3);
        for (let y = 12; y < length - 5; y += 13) p.rect('#697971', 3, y, 9, 1);
        p.rect('#57645c', 6, 0, 3, length - 5);
        p.rect('#c2ad83', 6, 0, 1, length - 5);
        post(p, 7, 6, 6); post(p, 7, length - 3, 7);
        if (footprint.id === 'east-quay-curb') lamp(p, 7, 36);
        break;
      }
    }
    p.ctx.restore();
  }
}

// Freestanding upper parts are sorted by their feet, so the rear aisle passes behind them.
function lockerLid(ctx: CanvasRenderingContext2D) {
  const p = pixels(ctx);
  ctx.save();
  ctx.translate(0, 5);
  p.polygon('#374e4e', [0,4],[2,0],[7,-3],[39,-3],[44,-1],[47,3],[47,7],[43,9],[2,9],[0,7]);
  p.polygon('#5f847d', [1,4],[3,0],[8,-2],[36,-2],[41,0],[41,4]);
  p.polygon('#87a899', [3,1],[8,-2],[36,-2],[39,-1],[9,0],[5,2]);
  p.rect('#4c706a', 2, 4, 38, 2);
  p.rect('#2e4c4d', 2, 7, 38, 2);
  p.polygon('#3c5d58', [39,-2],[44,0],[46,3],[46,7],[41,8],[41,3]);
  p.rect('#d4ac70', 3, 8, 36, 1);
  for (const x of [7, 37]) {
    p.polygon('#645840', [x+1,-2],[x+4,-2],[x+2,2],[x+2,8],[x+1,9],[x+1,14],[x-2,14],[x-2,8],[x-1,6],[x-1,2]);
    p.line('#ecc88b', [x+2,-2],[x,1],[x,4]);
    p.rect('#bb985d',x-1,5,2,4); p.rect('#9e804f',x-1,10,2,3);
    p.rect('#d4ad75',x-1,12,1,1);
  }
  p.rect('#574735', 21, 7, 6, 6);
  p.rect('#deb776', 21, 7, 5, 4); p.rect('#806440', 23, 8, 1, 2);
  ctx.restore();
}

function saltAwning(ctx: CanvasRenderingContext2D) {
  const p = pixels(ctx);
  // Two short masts carry the back rope; the front spar sags between them.
  p.rect('#514b40', 4, 0, 3, 27); p.rect('#b69a68', 4, 1, 1, 25);
  p.rect('#4f5146', 41, 2, 3, 23); p.rect('#89765a', 41, 3, 1, 20);
  p.polygon('#625e4d',[2,2],[12,3],[30,4],[40,2],[44,15],[42,19],[31,22],[17,22],[6,20]);
  p.polygon('#c49d70',[3,2],[13,4],[29,5],[39,3],[42,15],[30,18],[17,18],[6,16]);
  p.polygon('#d5b68a',[3,2],[13,4],[17,6],[17,17],[7,15]);
  p.polygon('#ab865e',[27,5],[36,4],[39,3],[42,15],[29,18],[32,13]);
  p.polygon('#9a7251',[6,16],[17,18],[30,18],[42,15],[42,18],[30,21],[18,21],[6,19]);
  p.line('#ead0a2',[3,2],[13,4],[25,5]); p.line('#82684e',[20,6],[21,11],[20,17]);
  p.line('#e2bd8a',[6,16],[17,18],[29,18]); p.line('#a0a391',[6,19],[7,23],[9,26]);
  p.line('#b5976c',[42,17],[43,19],[42,25]);
}

const locker = exteriorObstacles.ship.find(piece => piece.id === 'mail-locker')!;
const saltStore = exteriorObstacles.harbor.find(piece => piece.id === 'salt-store')!;
export const exteriorRelief = [
  { id: 'mail-locker-lid', mapId: 'ship', x: locker.x * 16, y: locker.y * 16 - 8,
    width: 48, height: 20, footY: (locker.y + locker.height) * 16 - 1, paint: lockerLid },
  { id: 'salt-store-canopy', mapId: 'harbor', x: saltStore.x * 16, y: saltStore.y * 16 - 8,
    width: 46, height: 28, footY: (saltStore.y + saltStore.height) * 16 - 1, paint: saltAwning },
] as const;

function post(p: Paint, x: number, foot: number, height: number) {
  p.polygon('#253e4188',[x-3,foot-1],[x+3,foot-1],[x+10,foot+3],[x+3,foot+4]);
  p.rect(darkWood,x-3,foot-height,6,height);
  p.rect('#a98a60',x-2,foot-height,2,height-1);
  p.rect('#7a6850',x,foot-height,2,height);
  p.rect('#4b5145',x-3,foot-4,6,2);
  p.polygon(brass,[x-4,foot-height],[x-2,foot-height-2],[x+2,foot-height-2],[x+4,foot-height],[x+2,foot-height+2],[x-2,foot-height+2]);
}

function lamp(p: Paint, x: number, base: number) {
  post(p,x,base,16);
  p.rect(deep,x-4,base-23,8,8);
  p.rect('#d6a562',x-3,base-22,6,5);
  p.rect('#f0ce84',x-2,base-22,3,4);
  p.rect('#91764e',x+1,base-22,1,5);
  p.polygon('#445953',[x-6,base-23],[x-2,base-28],[x+2,base-28],[x+6,base-23]);
  p.rect(brass,x-1,base-29,2,2);
}

function windowBank(p: Paint,x: number,y: number,panes: number) {
  const width=panes*8+3;
  p.rect('#7d705b',x+2,y+2,width,15);
  p.rect('#615d4e',x,y,width,15);
  for(let i=0;i<panes;i++) {
    const px=x+2+i*8;
    p.rect('#577879',px,y+2,6,10);
    p.rect('#79978c',px,y+2,6,4);
    p.line('#a8b6a0',[px,y+7],[px+4,y+3]);
    p.rect('#91856a',px,y+7,6,1);
  }
  p.rect('#ddc29a',x-1,y+13,width+2,2);
}

function sailboat(p: Paint,x: number,y: number) {
  // Across the water from the passenger ship, a small lugger is making port.
  p.polygon('#294d55',[x-2,y+2],[x+9,y+6],[x+27,y+4],[x+35,y-1],[x+29,y+7],[x+10,y+9]);
  p.polygon('#715942',[x-3,y-2],[x+7,y],[x+25,y-1],[x+36,y-6],[x+31,y+1],[x+24,y+4],[x+6,y+5]);
  p.line('#c8ad79',[x-2,y-2],[x+7,y+1],[x+23,y],[x+33,y-4]);
  p.line('#776e54',[x+13,y],[x+13,y-34]);
  p.polygon('#c7bd9a',[x+12,y-31],[x+11,y-6],[x-1,y-4]);
  p.polygon('#a5a58a',[x+16,y-27],[x+31,y-10],[x+15,y-6]);
  p.line('#ded0aa',[x+11,y-29],[x+4,y-10]);
}

// Two deckhouses share a sill, but different footprints and fittings tell them apart.
// Their solid parts stay within the two blocked cabin pads, leaving the bridge and aisle open.
function deckhouses(p: Paint) {
  for (const [x, port] of [[65, true], [145, false]] as const) {
    const end = x + 44;
    p.polygon('#423f3955', [x + 1, 86], [end, 83], [end + 3, 94], [end + 1, 98], [x + 5, 98]);
    p.rect('#605343', x + 1, 76, 41, 18);
    p.rect(port ? '#b99d75' : '#a78962', x + 2, 77, 37, 14);
    p.rect('#817360', end - 5, 77, 5, 16);
    p.rect('#dfc297', x, 92, 42, 2);
    p.rect('#6c5b48', x + 1, 94, 42, 2);
    p.polygon('#3a504e', [x - 1, 77], [x + 4, 53], [x + 10, 47], [end - 8, 47], [end - 3, 52], [end + 1, 77], [end - 1, 80], [x, 80]);
    p.polygon(port ? '#77948a' : '#958b71', [x, 75], [x + 5, 54], [x + 10, 48], [end - 9, 48], [end - 5, 53], [end - 2, 75]);
    // The rolled shoulder turns out of the sun at the right edge of each roof.
    p.polygon(port ? '#496e69' : '#716e61',[end-12,48],[end-9,48],[end-5,53],[end-2,75],[end-8,75],[end-10,54]);
    p.polygon(port ? '#94aea0' : '#b8ac89',[x+2,72],[x+6,54],[x+11,49],[x+14,49],[x+9,56],[x+5,72]);
    p.rect('#4a4f43', x+1, 79, 40, 3);
    p.polygon('#615a455c',[x+1,81],[end-2,81],[end-1,85],[x+5,84]);
    p.line(port ? '#b3c0a9' : '#ccbd96', [x + 1, 74], [x + 6, 54], [x + 11, 49], [end - 10, 49]);
    p.line(brass, [x, 77], [end, 77]);
    if (port) {
      // Three forward windows reflect different pieces of sky; their brass mullions cast to starboard.
      for (let i = 0; i < 3; i++) {
        const wx = x + 4 + i * 11;
        p.rect('#515d55', wx, 81, 10, 9);
        p.rect('#567c7c', wx + 1, 82, 7, 6);
        p.rect('#a8bbaa', wx + 1, 82, 6, 2);
        p.line('#94aa9c', [wx + 1, 87], [wx + 5, 83]);
        p.rect('#c7aa7e', wx + 9, 81, 1, 9);
      }
      // Low chart skylight, with a deep return face under the port side of the mast.
      p.polygon('#506763', [x + 11, 63], [x + 17, 54], [x + 32, 54], [x + 31, 64], [x + 29, 67], [x + 11, 67]);
      p.polygon('#adc0ad', [x + 12, 62], [x + 17, 55], [x + 30, 55], [x + 28, 62]);
      p.line('#647d75', [x + 19, 62], [x + 23, 55]);
      p.rect('#c6b796', x + 11, 63, 19, 1);
    } else {
      // Roll-up canvas covers the freight hatch. Tied folds follow the roof slope.
      for (const off of [10, 19, 28, 37]) {
        p.line('#766f5f', [x + off, 54], [x + off - 2, 69]);
        p.line('#b8ad8c', [x + off - 1, 54], [x + off - 3, 69]);
      }
      p.rect('#776c55', x + 5, 68, 33, 5);
      p.rect('#beb28c', x + 6, 68, 31, 2);
      for (const tie of [11, 27]) p.rect('#5b6054', x + tie, 67, 2, 6);
      for (const px of [x + 10, x + 29]) {
        p.polygon('#615b49', [px - 4, 83], [px - 2, 80], [px + 2, 80], [px + 5, 83], [px + 5, 87], [px + 2, 90], [px - 2, 90], [px - 4, 87]);
        p.rect('#c5a56d', px - 2, 81, 5, 7);
        p.rect('#3d5c60', px - 1, 82, 4, 5);
        p.rect('#99b4a7', px - 1, 82, 3, 2);
      }
    }
  }
}

/** A partly furled tanbark staysail, seen from the after deck. The belly
 * swings to starboard; seams converge on the three corners under tension. */
function staysail(p: Paint) {
  p.line('#5a5848', [85, 17], [154, 44], [175, 45]);
  p.line('#c7b186', [85, 16], [153, 43], [175, 45]);
  p.polygon('#854f3e', [88, 20], [153, 45], [144, 51], [128, 54], [110, 53], [96, 48]);
  p.polygon('#bc7451', [89, 21], [150, 45], [142, 49], [128, 52], [113, 51], [98, 47]);
  p.polygon('#ca875e', [90, 22], [113, 31], [123, 46], [128, 51], [113, 50], [99, 46]);
  p.polygon('#d59a6d', [90, 22], [99, 26], [106, 41], [111, 49], [99, 46]);
  p.line('#a66449', [108, 29], [114, 43], [120, 51]);
  p.line('#aa694b', [126, 36], [132, 44], [137, 50]);
  p.line('#deae7b', [97, 47], [112, 52], [128, 53], [143, 50], [153, 45]);
  p.line('#675c48', [97, 48], [96, 55], [93, 58]);
  p.rect('#c1a071', 84, 16, 2, 10);
  p.rect('#dec193', 84, 15, 3, 2);
  p.rect('#7d684c', 151, 44, 3, 2);
}

/** The rescue boat hangs from two iron davits outside the passenger rail.
 * Show its benches from above and the strakes on the shaded, outboard side. */
function rescueBoat(p: Paint) {
  p.polygon('#21474dcc', [210, 139], [219, 145], [224, 160], [224, 175], [220, 187], [215, 192], [211, 186], [207, 172], [206, 151]);
  const outline: Point[] = [[208, 129], [214, 135], [218, 148], [219, 163], [216, 177], [212, 183], [207, 179], [203, 168], [201, 150], [203, 137]];
  p.polygon('#3e4944', ...outline);
  p.polygon('#895940', [209, 133], [216, 145], [218, 162], [215, 176], [212, 181], [208, 177], [204, 165], [203, 149]);
  p.polygon('#dfc79c', [208, 130], [213, 135], [216, 147], [217, 161], [214, 172], [210, 176], [206, 171], [203, 158], [203, 144]);
  p.polygon('#94714f', [208, 134], [212, 138], [214, 147], [215, 160], [213, 169], [210, 173], [207, 169], [205, 156], [205, 145]);
  p.polygon('#5d5846', [209, 138], [213, 150], [213, 161], [210, 170], [208, 166], [206, 152]);
  for (const [x, y, width] of [[205, 144, 8], [205, 154, 10], [207, 164, 7]]) {
    p.rect('#675641', x, y, width, 3);
    p.rect('#c19d6c', x, y, width, 2);
    p.rect('#dcc293', x, y, width - 1, 1);
  }
  p.line('#ddb183', [217, 164], [214, 175], [212, 178]);
  p.line('#e7cf9e', [206, 143], [209, 155], [212, 166]);
  p.rect('#cc9f62', 211, 164, 2, 4);
  for (const y of [140, 172]) {
    p.rect('#49534f', 193, y - 3, 5, 6);
    p.rect('#c2aa79', 193, y - 2, 2, 4);
    p.line('#435351', [195, y], [195, y - 9], [198, y - 13], [205, y - 13], [209, y - 10]);
    p.line('#b5b599', [196, y - 2], [196, y - 9], [199, y - 12], [205, y - 12]);
    p.line('#ae9270', [209, y - 9], [209, y - 4]);
    p.line('#d2b68b', [209, y - 4], [205, y + 1]);
    p.line('#8b7658', [209, y - 4], [214, y]);
  }
}

/** Fore-and-aft teak bends into the curved margin at the transom. A shipwright
 * staggers the butt joints between strakes; no joint runs across the whole deck. */
function afterdeck(p: Paint) {
  const wood = ['#a7835c','#b08a60','#a78258','#b39068','#af8b63','#a7825d'];
  const left = 54, span = 146, count = 15;
  const section = (board: number, y: number) => {
    const inset = Math.max(0, y - 171) * .65;
    return Math.round(left + inset + (span - 2 * inset) * board / count);
  };
  for (let n = 0; n < count; n++) {
    const tip = n + 1;
    p.polygon(wood[n % wood.length], [section(n,87),87], [section(tip,87),87], [section(tip,171),171],
      [section(tip,186),186], [section(n,186),186], [section(n,171),171]);
    const caulk = n < 2 || n > 12 ? '#746049' : '#8b6e51';
    p.line(caulk, [section(n,87),87],[section(n,171),171],[section(n,185),185]);
    const joint = 98 + ((n * 37) % 71);
    const x = section(n, joint), width = section(tip, joint) - x;
    p.rect('#80654c', x + 1, joint, width - 1, 1);
    p.rect('#c19e70', x + 2, joint + 1, width - 4, 1);
    p.rect('#785f47', x + 2, joint - 1, 1, 1);
    if (n % 3 !== 1) {
      const y = 106 + (n * 13) % 39;
      p.line('#bf9c70', [x+4,y],[x+4,y+6],[x+5,y+9],[x+5,y+13]);
    }
  }
  // A narrow contrasting covering board turns with the rail; water-dark
  // seams end at it, instead of cut boards hanging over the side of the ship.
  p.polygon('#92724e',[54,87],[59,87],[59,168],[63,177],[75,186],[64,186],[54,179]);
  p.polygon('#8a6b4c',[196,89],[201,89],[201,179],[187,187],[176,187],[190,177],[195,167]);
  p.line('#c6a579',[58,92],[58,169],[62,178],[75,186]);
  p.line('#b0936a',[195,98],[195,167],[190,178],[177,186]);
  // The coaming and its hatch stand up from the planks.
  p.polygon('#3b403342',[65,143],[94,138],[103,148],[102,153],[73,151]);
}

function wayfarer(p: Paint) {
  // Build out from the existing collision rectangle. The pointed foredeck, colored
  // strakes and immersed stern lie in the surrounding water.
  p.ctx.save();
  p.ctx.beginPath();
  p.ctx.rect(0,0,256,224);
  p.ctx.rect(54,47,147,140);
  p.ctx.clip('evenodd');
  p.polygon('#294c52',[41,67],[53,37],[82,24],[125,8],[151,15],[193,31],[211,53],[218,157],[211,190],[189,205],[155,213],[85,213],[52,201],[39,179]);
  p.polygon('#3d4440',[42,63],[51,39],[79,23],[125,6],[157,15],[189,29],[207,45],[211,65],[211,177],[204,190],[183,200],[158,207],[80,207],[55,198],[43,186]);
  p.ctx.restore();
  p.polygon('#9d7955',[46,58],[56,39],[83,25],[125,10],[156,19],[186,33],[201,46],[205,61]);
  p.polygon('#c5a477',[53,53],[60,39],[84,27],[125,13],[153,21],[182,35],[196,46],[199,53]);
  for (const y of [28,34,40,46,52]) {
    const left = Math.max(55,125-(y-13)*3);
    p.rect('#a48664',left,y,Math.min(195,125+(y-13)*2)-left,1);
  }
  p.line('#f0cea0',[45,59],[53,40],[80,25],[125,8],[157,17],[188,31],[205,46]);
  p.line('#6c6650',[73,38],[83,31],[125,17],[167,30]);
  p.polygon('#5f4b3b',[42,60],[49,53],[54,53],[54,186],[65,193],[54,194],[43,183]);
  p.polygon('#6a4f3f',[201,52],[209,60],[209,180],[202,190],[191,195],[197,185]);
  p.polygon('#384c4a',[44,176],[61,185],[83,190],[166,191],[205,177],[202,190],[177,201],[157,205],[81,205],[54,197],[44,186]);
  p.polygon('#a76a48',[46,181],[62,188],[83,194],[163,195],[203,181],[201,185],[169,198],[157,200],[82,200],[55,192],[46,187]);
  p.polygon('#77503e',[158,195],[179,190],[203,180],[201,185],[179,194],[165,198],[158,200]);
  p.line('#cb8e60',[46,182],[63,189],[85,195],[124,195]);
  p.line('#536760',[53,194],[80,203],[155,203],[178,196]);
  p.line(brass,[46,179],[64,187],[83,191],[163,192],[201,178]);
  p.line('#d6b481',[47,58],[54,51],[54,175],[61,182],[83,187],[126,187]);
  p.line('#a18b6c',[146,188],[168,187],[196,177],[202,168],[202,57]);
  // A brass-capped capstan forward of the cabins, and a stowed spar above the roof.
  p.polygon('#796b50',[114,31],[128,29],[137,33],[126,37],[114,35]);
  p.rect('#895f40',117,23,11,10);
  p.rect('#c49a60',118,22,4,10);
  p.polygon(bright,[113,23],[117,19],[126,19],[131,22],[127,25],[118,26]);
  p.line(darkWood,[109,26],[133,19]);
  // Long deck planks and a teak hatch: flush fittings keep the crossing clear.
  afterdeck(p);
  p.polygon('#745c46',[65,125],[97,125],[100,128],[100,149],[66,149]);
  p.rect('#bd996b',64,123,33,24);
  p.rect('#594d3b',66,125,29,19);
  for(let x=68;x<95;x+=5) p.rect('#a28258',x,126,3,17);
  for(let y=127;y<144;y+=5) p.rect('#af926c',67,y,27,2);
  p.rect('#c3a175',65,144,31,1);
  // Rope rail and bundled canvas run along the blocked perimeter.
  for(const x of [53,202]) {
    for (const y of [54,93,132,171]) {
      p.line(darkWood,[x,y-4],[x+1,y+14],[x,y+29]);
      p.line(brass,[x-1,y-6],[x,y+12],[x-1,y+29]);
      post(p,x,y,8);
    }
  }
  p.polygon('#544e40',[47,147],[54,144],[61,146],[61,168],[56,174],[47,171]);
  p.polygon('#a29a7d',[47,146],[52,143],[58,145],[59,168],[55,171],[48,168]);
  for (const y of [151,164]) p.rect('#706c54',47,y,12,2);
  // The gangway extends over the hull into the water rather than ending at the deck edge.
  p.polygon('#343f3c',[126,178],[145,178],[149,210],[144,218],[124,215]);
  p.polygon('#ad916c',[128,179],[142,179],[145,214],[127,211]);
  for(let y=184;y<213;y+=5) p.rect('#78654c',128,y,15,1);
  p.line('#dec492',[126,176],[125,210]);
  p.line('#b79a6e',[144,177],[147,214]);
  post(p,125,185,9); post(p,145,185,9);
  // High mast on the port cabin, with a split pennant and rigging into the chainplates.
  p.line('#736e59',[53,116],[75,79],[85,29],[110,79]);
  p.line('#b7ae88',[53,115],[75,78],[85,28]);
  p.rect('#6c5944',83,26,4,43);
  p.rect('#c3a172',83,26,1,41);
  p.polygon('#385c60',[85,26],[97,26],[109,20],[106,26],[112,28],[98,32],[85,32]);
  p.line('#a5b69b',[86,27],[95,27],[103,24]);
  deckhouses(p);
  // The foot of the sail sits above the roofs. Its broken shadow ends at the
  // cabin coamings and leaves the captain's narrow fore-and-aft passage bright.
  p.polygon('#49483833', [72, 94], [108, 94], [119, 101], [98, 99], [77, 97]);
  p.polygon('#49483844', [148, 95], [183, 95], [197, 104], [164, 101]);
  staysail(p);
  p.rect('#6c5944',83,26,4,42);
  p.rect('#c3a172',83,26,1,41);
  // A reefed gaff leaves the working deck open. The nearby shadow, tackle and
  // individual ratlines explain the height of the spar without a large opaque sail.
  p.line('#665e4a', [52, 115], [71, 83], [85, 29]);
  p.line('#b7ab83', [55, 116], [74, 83], [85, 29]);
  for (let step = 0; step < 7; step++) {
    const y = 107 - step * 7, x = 58 + step * 3;
    p.line('#a29170', [x, y], [x + 4, y + 1]);
  }
  p.line('#5c5644', [84, 43], [108, 60], [110, 59]);
  p.line('#d0b88b', [85, 41], [109, 58]);
  for (let i = 0; i < 4; i++) {
    const x = 88 + i * 5, y = 44 + i * 4;
    p.polygon('#a7a183', [x - 2, y], [x + 3, y + 2], [x + 2, y + 6], [x - 1, y + 5]);
    p.line('#d6caa6', [x - 1, y + 1], [x + 2, y + 3]);
  }
  p.rect('#74684e', 108, 59, 1, 12);
  p.rect('#635e49', 107, 69, 3, 5);
  p.rect('#bda579', 107, 69, 1, 3);
  // Bronzed holding-down plates are flush to the deck. Their shadows run in
  // the same direction as the cabin eaves and stop well short of the gangway.
  p.polygon('#624e3d55', [53, 117], [56, 116], [103, 153], [109, 156], [105, 157]);
  p.line('#7b634b', [166, 104], [192, 121], [197, 123]);
  for (const [x, y] of [[59, 110], [193, 116], [59, 164], [195, 170]]) {
    p.rect('#695640', x, y, 6, 3);
    p.rect('#ba9e71', x + 1, y, 3, 1);
  }
  // A rolled heaving line rests on the closed grating, leaving the passenger lane clear.
  for (let loop = 0; loop < 3; loop++) {
    const x = 69 + loop * 3, y = 132 + loop;
    p.line('#665640', [x, y + 4], [x + 4, y], [x + 12, y - 1], [x + 14, y + 2], [x + 11, y + 5], [x + 2, y + 6], [x, y + 4]);
    p.line('#c8ab76', [x, y + 3], [x + 4, y - 1], [x + 11, y - 2], [x + 13, y]);
  }
  p.line('#bea578', [83, 139], [90, 141], [92, 145], [99, 145]);
  // The rose is an inlaid deck fitting. The dark and light halves read as a
  // compass in the walk surface without suggesting another object to talk to.
  p.polygon('#7d6249', [146, 153], [152, 149], [165, 149], [172, 153], [165, 157], [152, 157]);
  p.line('#b89b70', [146, 153], [152, 149], [164, 149], [170, 152]);
  p.polygon('#c5a978', [151, 153], [158, 152], [160, 146], [161, 152], [169, 153], [161, 154], [158, 160], [158, 154]);
  p.line('#665947', [160, 148], [159, 153], [153, 153]);
  p.rect('#dfc79b', 159, 152, 2, 2);
  for (const x of [76, 100, 158, 178]) {
    // Round scuppers on the stern strake.
    const y = x === 76 || x === 178 ? 195 : 199;
    p.rect('#504e41', x, y, 4, 2);
    p.rect('#cb9868', x, y + 2, 3, 1);
  }
  // A deck tern rides the capped rail facing the sea. Its folded wing and
  // black crown are present even when motion is turned off.
  p.rect('#9b6e4e', 201, 122, 1, 3);
  p.rect('#99694a', 204, 122, 1, 3);
  p.polygon('#d2d0b7', [196, 119], [198, 116], [201, 116], [203, 119], [210, 118], [213, 117], [210, 121], [205, 123], [199, 123]);
  p.rect('#515c58', 197, 116, 4, 1);
  p.rect('#dfd8bc', 196, 117, 5, 3);
  p.rect('#39464a', 197, 117, 1, 1);
  p.rect('#bf8c57', 193, 119, 4, 1);
  p.line('#82928a', [200, 120], [205, 119], [209, 119], [207, 121], [202, 121]);
  sailboat(p,216,122);
  rescueBoat(p);
}

/** The workshop's sawtooth glass lantern, copper ridge and tall loading arch
 * occupy its contiguous roof/wall footprint. The doorway faces the south plaza. */
function workshopFacade(p: Paint, hearthLit: boolean) {
  p.polygon('#46504b88',[64,200],[224,191],[233,207],[232,232],[221,243],[74,244],[65,236]);
  p.rect('#a39273',66,167,153,70);
  p.rect('#c0ad87',67,175,142,59);
  p.rect('#967e61',209,172,12,62);
  p.rect('#876e52',67,222,152,12);
  p.rect('#c0a37c',68,222,142,3);
  for(const x of [67,125,176,206]) {
    p.rect('#78654e',x,174,4,58);
    p.rect('#b89971',x,174,1,57);
  }
  windowBank(p,77,196,5); windowBank(p,180,198,3);
  // One broad roof reads as a tall workshop instead of many tiled blocks.
  p.polygon('#655348',[60,182],[75,112],[102,92],[199,92],[218,112],[225,182],[219,189],[66,189]);
  p.polygon('#b67655',[63,177],[78,114],[102,95],[194,95],[207,113],[215,177]);
  // Hips turn away from the glazed central pitch. Their joints converge at the ridge.
  p.polygon('#c18a62',[63,177],[78,114],[102,95],[112,95],[91,124],[77,177]);
  p.polygon('#8d5949',[183,95],[196,95],[212,113],[222,179],[204,178],[196,129]);
  for(let y=119;y<177;y+=8) {
    const left=78-Math.floor((y-114)/4), right=207+Math.floor((y-114)/8);
    p.rect('#8e5d4d',left,y,right-left,1);
    for(let x=left+((y%3)*6);x<right-4;x+=16) p.rect('#bc8060',x,y+1,5,1);
  }
  p.line('#d3966c',[65,177],[79,114],[102,95],[194,95],[210,111]);
  p.line('#dca479',[69,176],[90,124],[111,96]);
  p.line('#be8664',[202,176],[194,129],[182,96]);
  // Cast shadows anchor the lantern and kiln to the tiled slope.
  p.polygon('#5e514957',[93,134],[178,128],[194,141],[189,147],[108,148]);
  p.polygon('#684e445c',[80,136],[90,126],[106,137],[102,141],[88,142]);
  p.rect('#644d41',62,179,161,7);
  p.rect('#cc9672',63,179,157,2);
  p.rect('#806250',65,187,155,3);
  p.polygon('#675b495c',[68,189],[219,189],[220,197],[78,195]);
  for (const x of [76, 104, 130, 174, 202]) {
    p.polygon('#6b5647',[x,185],[x+5,185],[x+5,190],[x+2,193],[x,192]);
    p.rect('#bd936b', x,186,2,4);
  }
  // Projecting zinc monitor, glazed to face the harbor.
  p.polygon('#755a49',[92,131],[102,108],[179,106],[188,132],[182,140],[96,142]);
  p.polygon('#506c69',[89,127],[101,104],[175,104],[184,125],[182,134],[91,134]);
  p.polygon('#7e9787',[91,125],[103,106],[173,106],[179,125]);
  p.polygon('#9bb3a2',[92,124],[104,107],[118,107],[109,123]);
  p.polygon('#94ab9b',[128,124],[140,107],[158,107],[148,124]);
  for (const x of [117, 140, 162]) {
    p.line('#4d6f68',[x,107],[x-6,124]);
    p.line('#b9c5aa',[x-1,107],[x-7,124]);
  }
  p.rect('#395d61',93,126,87,7);
  for(let x=94;x<180;x+=10) {
    p.rect('#96ada0',x,126,7,3);
    p.rect('#c5b99b',x,126,1,7);
  }
  p.rect('#c7b08a',90,134,93,2);
  // Kiln stack: exposed red face, shaded return and rolled metal flue.
  p.polygon('#715746',[74,138],[74,95],[83,90],[92,94],[92,133],[85,139]);
  p.rect('#bd8662',75,95,9,41);
  p.rect('#987254',84,95,7,39);
  for(let y=101;y<134;y+=7) p.rect('#a37557',75,y,9,1);
  p.rect('#685a48',73,91,20,4);
  p.rect('#c89872',74,90,18,3);
  p.rect('#53635b',78,79,9,11);
  p.rect('#879180',79,79,2,10);
  p.rect('#a3a38a',76,77,13,3);
  // Deep arch and the shell of the recessed door line up with its live object.
  p.polygon('#76694f',[132,240],[132,208],[137,198],[144,193],[158,193],[168,198],[172,208],[172,240]);
  p.polygon('#d5bd92',[134,240],[134,207],[138,200],[145,195],[157,195],[166,200],[169,207],[169,240]);
  p.polygon('#554f40',[138,240],[138,208],[144,202],[150,200],[157,201],[164,207],[165,240]);
  p.rect('#8e7051',141,211,21,26);
  p.rect('#5d5141',141,217,3,18);
  p.rect('#70583f',145,217,15,15);
  p.rect('#9d7956',146,218,12,12);
  p.line('#b48d61',[146,230],[158,230],[158,219]);
  p.rect('#cdb07b',157,225,4,1);
  p.rect('#68827b',142,208,19,7);
  p.rect('#b2a384',151,208,2,7);
  p.rect('#bc9872',139,235,25,3);
  p.rect('#c6b090',135,238,33,3);
  // Cut stones turn around the entrance arch. Carry the gutter all the way
  // from the workshop eaves to the downpipe and its drain at street level.
  for (const seam of [
    [[136, 209], [140, 210]], [[139, 201], [143, 204]], [[145, 196], [148, 201]],
    [[154, 196], [154, 200]], [[162, 198], [159, 203]], [[167, 204], [163, 206]],
  ] satisfies Point[][]) p.line('#aa9879', ...seam);
  p.rect('#534e42', 138, 209, 2, 27);
  p.rect('#d1b28c', 165, 207, 2, 29);
  p.rect('#8b7861', 137, 242, 30, 1);
  p.rect('#b29f80', 138, 243, 27, 1);
  if (hearthLit) {
    // On the walk home, light from Nia's stove reaches the transom and
    // escapes under the door. Keep the wooden mullion in silhouette.
    for (const x of [142, 153]) {
      p.rect('#c9a16d', x, 209, 8, 5);
      p.rect('#e1bc82', x + 1, 210, 6, 3);
      p.rect('#f3d198', x + 1, 212, 2, 1);
    }
    p.rect('#dfb57b', 142, 235, 19, 1);
    p.polygon('#ebbd7429', [141, 237], [162, 237], [167, 244], [138, 244]);
  }
  p.rect('#514f41', 213, 188, 4, 39);
  p.rect('#8d9c85', 214, 188, 2, 36);
  for (const y of [197, 216]) p.rect('#b2a485', 212, y, 5, 2);
  p.line('#656f5d', [215, 224], [215, 229], [219, 231]);
  p.rect('#817c66', 217, 232, 7, 3);
  p.rect('#585f51', 218, 233, 4, 1);
  // Suspended surveyor's sign: a brass divider above a tide line.
  p.line(darkWood,[170,193],[181,188],[195,188]);
  p.rect(brass,181,188,2,8); p.rect(brass,192,188,2,8);
  p.polygon('#475d57',[178,195],[197,195],[197,208],[187,213],[178,208]);
  p.line('#debd7a',[182,205],[187,198],[193,205]);
  p.line('#b3be9c',[181,207],[186,206],[192,207]);
}

function market(p: Paint) {
  // A long fish hall faces the open market. Its returned gable is visible at the east end.
  p.polygon('#48534b77',[305,198],[460,188],[475,206],[475,227],[313,231]);
  p.rect('#b29b76',306,165,151,54);
  p.rect('#86775f',449,162,12,55);
  p.polygon('#4a6560',[300,173],[312,129],[328,111],[442,111],[457,126],[466,173],[463,179],[300,179]);
  p.polygon('#738e7e',[302,171],[314,130],[328,114],[440,114],[449,130],[457,171]);
  // Long copper sheets turn over the crown and fall into a cool east gable.
  p.polygon('#8da38a',[303,170],[315,130],[329,114],[345,114],[329,135],[318,171]);
  p.polygon('#637e71',[419,114],[441,114],[451,132],[460,172],[439,172],[430,136]);
  p.polygon('#496760',[441,114],[456,127],[465,172],[459,172],[450,132]);
  for(const x of [323,346,369,392,415,438]) {
    p.line('#a1ac94',[x,116],[x-9,170]);
    p.line('#617b70',[x+1,117],[x-8,170]);
  }
  p.rect('#c0bea0',301,172,161,2);
  p.rect('#526158',302,175,161,5);
  p.polygon('#3b514d8c',[306,179],[460,179],[466,190],[463,195],[313,191]);
  // Three trade bays have differentiated wares: fish baskets, jars, folded cloth.
  for(let bay=0;bay<3;bay++) {
    const x=308+bay*49;
    p.rect('#635e4d',x,181,43,33);
    p.rect('#435e59',x+3,184,36,25);
    p.polygon('#354d49',[x+3,183],[x+39,183],[x+39,197],[x+29,194],[x+4,195]);
    if (bay === 1) {
      // The bottler stands inside the existing stall, in shadow behind the counter.
      p.rect('#344d49', x + 6, 196, 13, 11);
      p.polygon('#82785c', [x+6, 201], [x+9, 198], [x+13, 197], [x+17, 200], [x+19, 207], [x+5, 207]);
      p.rect('#b7855f', x+9, 193, 6, 6);
      p.rect('#d0a67b', x+12, 194, 4, 3);
      p.rect('#bdc0a4', x+7, 192, 9, 2);
      p.rect('#b6b697', x+7, 191, 6, 1);
      p.rect('#658278', x+9, 201, 6, 6);
      p.rect('#c2b88e', x+10, 200, 2, 2);
    }
    for(let i=0;i<5;i++){
      const px=x+4+i*7;
      if(bay===0) {
        p.polygon('#a1b6a5',[px,203],[px+4,200],[px+7,201],[px+5,204],[px+2,204]);
      } else if(bay===1) {
        p.rect('#b27856',px+1,200-(i%2)*3,4,7+(i%2)*3);
        p.rect('#c79966',px+2,198-(i%2)*3,2,3);
      } else {
        p.rect(i%2?'#a89873':'#8aa294',px,202-i%3,6,5);
        p.rect('#c9b58e',px,202-i%3,6,1);
      }
    }
    p.rect('#b28e64',x,207,43,4);
    p.rect('#887052',x+2,211,39,6);
    p.rect('#75614b',x+3,217,3,4); p.rect('#75614b',x+37,217,3,4);
    const fabric=[['#b86548','#e8c18e'],['#408078','#decea7'],['#b89655','#ede0ac']][bay];
    for(let i=0;i<7;i++){
      const start=x-2+i*7;
      p.polygon(fabric[i%2],[start,177],[start+7,177],[start+6,190],[start-1,190]);
      p.rect(i%2?'#ab997a':bay===0?'#935a48':'#5e7061',start-1,190,7,3);
      p.rect(i%2?'#bbaa8d':bay===0?'#95573f':'#647768',start,193,4,1);
    }
    p.line('#544e413d',[x,194],[x+38,194],[x+41,196]);
  }
  // Ridge ventilators separate the hall silhouette from the workshop skyline.
  for(const x of [344,399]){
    p.rect('#59665b',x,103,14,11); p.rect('#8c9a83',x+1,103,3,10);
    p.polygon('#a3ae95',[x-4,103],[x+4,98],[x+10,98],[x+18,103]);
    p.rect('#acb298',x-2,103,18,1);
  }
  // The fish hall's maker cut this vane from a sheet of copper. A sunlit
  // belly and a verdigris back read at the same scale as the brass shop sign.
  p.rect('#5b6457', 377, 98, 3, 14);
  p.rect('#dbc292', 377, 99, 1, 11);
  p.polygon('#465f5a', [362, 88], [371, 91], [376, 87], [382, 86], [387, 89], [395, 92], [389, 97], [382, 99], [373, 98], [369, 95], [362, 100], [364, 94]);
  p.polygon('#86a79a', [364, 90], [370, 93], [377, 89], [383, 88], [391, 92], [383, 94], [373, 95], [365, 97]);
  p.polygon('#d2ba85', [372, 95], [382, 94], [392, 92], [388, 96], [379, 98]);
  p.rect('#3d5954', 386, 91, 2, 2);
  p.line('#d2c49c', [379, 88], [382, 88], [385, 89]);
}

function tideGauge(p: Paint, x: number, y: number) {
  p.polygon('#28474c', [x-2, y+31], [x+3, y+29], [x+14, y+35], [x+13, y+38], [x+1, y+34]);
  p.rect('#494c41', x, y, 5, 33);
  p.rect('#b29166', x, y+1, 2, 24);
  p.rect('#527063', x, y+26, 2, 7);
  p.polygon('#dec396', [x-2, y], [x, y-2], [x+4, y-2], [x+7, y], [x+4, y+2], [x, y+2]);
  p.rect('#d2c5a1', x+5, y+2, 4, 26);
  p.rect('#777b69', x+8, y+2, 1, 26);
  for (let i = 0; i < 6; i++) p.rect(i % 2 ? '#667a6f' : '#b16b4b', x+5, y+4+i*4, i % 2 ? 2 : 3, 2);
  p.rect('#4f6258', x+3, y+22, 3, 1);
  // The copper float remains readable at rest. Moving cels replace its dark
  // guide channel rather than stamping extra colored floats onto the water.
  p.rect('#4a655e', x+7, y+20, 7, 8);
  p.rect('#bc8059', x+7, y+21, 5, 3);
  p.rect('#e4bd85', x+8, y+21, 3, 1);
}

/** Low, square-ended freight lighter moored along the south face of the quay.
 * The market onions ride under an open hatch and a partly rolled canvas. */
function onionLighter(p: Paint) {
  p.line('#776e57', [284, 478], [262, 472], [233, 457]);
  p.line('#b3a177', [374, 475], [381, 479], [385, 486]);
  p.polygon('#24494f', [277, 478], [295, 472], [356, 470], [378, 474], [377, 484], [363, 494], [303, 500], [282, 495]);
  p.polygon('#344641', [273, 475], [285, 468], [357, 465], [378, 469], [376, 482], [360, 490], [299, 495], [279, 491]);
  p.polygon('#46685e', [274, 476], [299, 483], [359, 479], [376, 470], [374, 481], [358, 488], [299, 493], [280, 489]);
  p.line('#a6b29a', [280, 486], [299, 490], [359, 485], [374, 478]);
  p.line('#a66c4c', [282, 490], [298, 493], [358, 488], [369, 484]);
  p.polygon('#d0b485', [273, 475], [286, 469], [357, 466], [376, 469], [359, 481], [298, 486], [278, 481]);
  p.polygon('#8b6f50', [278, 475], [287, 471], [357, 468], [371, 470], [357, 478], [299, 483], [281, 479]);
  p.polygon('#514f41', [294, 474], [350, 470], [358, 473], [350, 478], [301, 481], [293, 479]);
  // Closely packed hemp sacks have pinched necks. A mesh bag on the near
  // side of the hatch shows the papery skins of the onions inside.
  for (const [x, y] of [[305, 475], [315, 474], [325, 473], [335, 472], [344, 474], [313, 479], [325, 478], [336, 477]]) {
    p.polygon('#76634a', [x - 5, y], [x - 5, y - 4], [x - 1, y - 8], [x + 1, y - 8], [x + 5, y - 4], [x + 5, y], [x + 2, y + 1]);
    p.polygon('#ad9065', [x - 4, y - 1], [x - 4, y - 4], [x - 1, y - 7], [x + 1, y - 7], [x + 3, y - 4], [x + 1, y - 1]);
    p.rect('#d8b585', x - 1, y - 8, 3, 1);
    p.rect('#c8a876', x - 3, y - 4, 2, 2);
  }
  for (const [x, y] of [[322, 476], [325, 474], [327, 477]]) {
    p.rect('#a96d48', x, y, 3, 2);
    p.rect('#dca468', x, y - 1, 2, 2);
  }
  // A rolled sailcloth cover lies across the aft coaming, with two dark ties.
  p.polygon('#7c8e7e', [285, 469], [292, 467], [306, 477], [298, 481], [285, 473]);
  p.line('#cfca9f', [286, 469], [292, 468], [305, 477]);
  for (const x of [289, 296]) p.line('#585e50', [x + 3, 468 + (x - 289)], [x, 472 + (x - 289)]);
  p.line('#caad7e', [358, 471], [365, 472], [371, 470]);
  p.rect('#635944', 364, 467, 4, 3);
}

function waterfront(p: Paint) {
  // At high tide the eastern rubbing wale is still well above its reflection.
  // Leave the narrow water lane between the piling and the reeds visible.
  p.polygon('#203c4866',[462,465],[468,469],[472,484],[470,540],[465,550],[462,547]);
  p.polygon('#455954',[461,465],[464,465],[466,472],[466,536],[463,545],[461,542]);
  p.rect('#af9e76',461,467,2,75);
  p.rect('#706952',464,471,1,61);
  p.rect('#a5946e',383,466,3,76);
  p.rect('#d1b382',383,469,1,64);
  // Three lashed rope fenders hang over the outside of the arrival jetty.
  // The timber stays dry above its tide line and darkens where it meets the water.
  for (const [x, y] of [[465, 477], [465, 509], [381, 511]]) {
    p.polygon('#2d4a4888',[x-2,y+8],[x+3,y+7],[x+9,y+13],[x+7,y+17],[x+1,y+14]);
    p.polygon('#4e5a4c',[x-3,y-4],[x-1,y-7],[x+3,y-6],[x+5,y-2],[x+4,y+7],[x+2,y+10],[x-2,y+8],[x-3,y+4]);
    p.polygon('#8f7e5c',[x-2,y-4],[x,y-6],[x+2,y-5],[x+2,y+3],[x,y+7],[x-2,y+5]);
    p.line('#ceb383',[x-2,y-3],[x,y-6],[x+2,y-6]);
    p.line('#4c6358',[x-2,y+5],[x+1,y+6],[x+4,y+3]);
    p.line('#b8ac82',[x-2,y-1],[x+2,y],[x+4,y-2]);
    p.line('#697e70',[x,y+11],[x+3,y+12],[x+6,y+11]);
  }
  // The freight wharf sits higher than the water. Lower braces and alternating
  // wet/dry timbers attach to the *south* faces, leaving every deck tile clear.
  for (const [left, right, y] of [[146, 382, 464], [385, 463, 544], [49, 127, 512]]) {
    p.rect('#484b3d', left, y - 2, right - left, 6);
    p.rect('#a99065', left, y - 2, right - left, 1);
    p.rect('#6a604a', left, y, right - left, 2);
    p.rect('#304a47', left, y + 4, right - left, 2);
    for (let x = left + 9; x < right - 4; x += 28) {
      // A pair of battered scarf braces recede into the shade beneath each span.
      if (x + 18 < right) {
        p.polygon('#354d49',[x+2,y+9],[x+3,y+6],[x+15,y+2],[x+19,y+3],[x+6,y+11]);
        p.line('#8f8866',[x+4,y+8],[x+13,y+4]);
      }
      p.line('#62705c', [x - 7, y + 4], [x + 1, y + 10]);
      p.rect('#424738', x, y, 5, 13);
      p.rect('#9e865e', x, y + 1, 2, 7);
      p.rect('#78795c', x, y + 7, 2, 3);
      p.rect('#355350', x, y + 10, 5, 3);
      p.rect('#567369', x - 2, y + 13, 9, 1);
      p.rect('#c6ae7d', x, y, 3, 1);
    }
  }
  // A working tide staff on its own pile, just off the incoming pier. The
  // registering float lives in this channel, well away from the skiff's lines.
  tideGauge(p, 475, 468);
  // A ribbed wet edge makes the arrival jetty feel raised even while the
  // terminal and its skiff are below the bottom of the moving camera.
  for (const side of [383, 463]) {
    const offset = side === 383 ? -1 : 1;
    for (const y of [469, 492, 516]) {
      p.rect('#6f6650', side, y, 2, 11);
      p.rect('#b5a27c', side, y, 1, 5);
      p.rect('#34534f', side + offset, y + 6, 2, 7);
      p.rect('#657366', side + offset * 2, y + 12, 3, 1);
    }
  }
  // A customs painter once marked the cargo lane and the steel-grated scupper.
  // Both are flush: the gang can haul goods from the pier to the working square.
  p.line('#a49a79', [401, 411], [401, 436], [393, 448]);
  p.line('#827d64', [402, 411], [402, 436], [394, 448]);
  p.polygon('#686958', [409, 440], [440, 440], [442, 442], [440, 446], [409, 446], [407, 444]);
  p.rect('#aaa488', 409, 440, 30, 1);
  for (let x = 410; x < 440; x += 4) {
    p.rect('#444e49', x, 442, 2, 3);
    p.rect('#a19777', x + 2, 442, 1, 3);
  }
  onionLighter(p);
}

/** Freight is weighed flush with the road. Low inset ramps and running grooves
 * let travelers cross the existing timber scales on their way to the stairs. */
function weighbridge(p: Paint) {
  p.polygon('#667169', [399, 306], [443, 306], [448, 311], [448, 328], [443, 334], [400, 334], [397, 330], [397, 310]);
  p.polygon('#b3a483', [399, 308], [442, 308], [445, 311], [445, 327], [441, 331], [400, 331], [399, 329]);
  p.rect('#625b4b', 401, 310, 41, 19);
  for (let x = 402; x < 440; x += 5) {
    p.rect('#987d5e', x, 311, 4, 16);
    p.rect('#b59a73', x, 311, 1, 15);
  }
  for (const y of [312, 324]) {
    p.rect('#655f50', 399, y, 46, 3);
    p.rect('#abac96', 399, y, 46, 1);
    for (const x of [401, 413, 430, 441]) p.rect('#d4c093', x, y + 1, 1, 1);
  }
  // A diagonal trolley approach is worn into the paving beside the bell.
  // Keep the polished stripes subtle so the compass and staff remain legible.
  for (const off of [0, 11]) {
    p.line('#7f8b80', [398, 313 + off], [373, 313 + off], [353, 333 + off], [340, 340 + off]);
    p.line('#a3a891', [397, 313 + off], [374, 313 + off], [365, 322 + off]);
  }
  p.rect('#605f51', 417, 331, 10, 2);
  p.rect('#d7b47c', 419, 331, 5, 1);
}

/** Reused salt-worn landing flags, in warmer stone than the surrounding setts.
 * Joint lines follow the shape of each masonry apron instead of repeating the tile atlas. */
function harborCourts(p: Paint) {
  // Edda’s broad old delivery threshold changes material right at the door.
  p.polygon('#8c9587', [69, 231], [211, 231], [217, 239], [213, 248], [181, 248], [173, 255], [132, 255], [124, 249], [76, 249], [69, 245]);
  p.polygon('#a6a58e', [71, 232], [209, 232], [214, 239], [209, 246], [179, 246], [172, 252], [133, 252], [126, 246], [78, 246], [71, 243]);
  p.line('#c0baa0', [72, 243], [79, 246], [123, 246], [132, 252], [171, 252]);
  for (const [x, y, x2, y2] of [[91, 236, 89, 245], [113, 235, 115, 245], [137, 242, 132, 250], [161, 242, 163, 251], [181, 235, 183, 245], [202, 235, 200, 245]]) {
    p.line('#899183', [x, y], [x2, y2]);
  }
  // Recessed stone trough in the plinth catches runoff from the workshop pipe.
  p.line('#7c857a', [217, 234], [222, 239], [221, 246], [212, 254], [205, 254]);
  p.line('#b4b49d', [219, 234], [224, 238], [223, 246], [215, 254]);
  p.rect('#66756d', 200, 253, 7, 2);

  // The fish hall's long unloading apron turns the edge of the square. The
  // front is gently downhill; small joints and a worn iron channel carry water east.
  p.polygon('#747f74', [286, 221], [464, 220], [475, 229], [475, 245], [467, 253], [300, 253], [285, 241]);
  p.polygon('#a2a38d', [287, 221], [462, 221], [473, 229], [473, 243], [465, 250], [302, 250], [286, 239]);
  p.line('#bdbaa1', [286, 237], [302, 249], [464, 249]);
  p.line('#849082', [292, 233], [467, 233], [471, 231]);
  for (const x of [307, 334, 361, 388, 416, 444]) {
    p.line('#8a9280', [x, 221], [x - 2, 232]);
    p.line('#949782', [x + 11, 234], [x + 14, 248]);
  }
  p.line('#707f72', [297, 238], [309, 245], [455, 245]);
  p.line('#bbc0a8', [298, 238], [309, 244], [452, 244]);
  for (const x of [318, 376, 435]) {
    p.rect('#68786e', x, 243, 7, 4);
    for (const dx of [1, 3, 5]) p.rect('#a6ac95', x + dx, 243, 1, 3);
  }
}

function harbor(p: Paint, map: MapDefinition, hearthLit: boolean) {
  // Swept stone carriage lanes meet at the district map. Narrow brick gutters and
  // flush brass route studs guide travel without implying new collision bounds.
  p.ctx.save();
  p.ctx.beginPath();
  for(let y=0;y<map.height;y++) for(let x=0;x<map.width;x++) {
    if(map.tiles[y][x]==='stone') p.ctx.rect(x*16,y*16,16,16);
  }
  p.ctx.clip();
  const lane=(x:number,y:number,w:number,h:number) => {
    p.rect('#879189',x,y,w,h);
    for(let row=y;row<y+h;row+=11){
      p.rect('#78867e',x,row,w,1);
      for(let col=x+((row-y)%22?8:23);col<x+w;col+=34) {
        p.rect('#77847d',col,row+1,1,Math.min(10,y+h-row-1));
      }
    }
  };
  lane(132,237,39,132); lane(132,336,401,32); lane(404,354,38,70);
  p.rect('#b3ad94',133,239,2,94); p.rect('#b3ad94',171,239,2,97);
  p.rect('#adab93',133,367,269,2); p.rect('#adab93',173,335,354,2);
  p.rect('#ada68a',403,371,2,49); p.rect('#ada68a',442,370,2,55);
  p.ctx.restore();
  harborCourts(p);
  workshopFacade(p, hearthLit); market(p);
  waterfront(p);
  weighbridge(p);
  // The stairhead's working rails are drawn from the actual ground footprints.
  p.polygon('#506a65',[547,329],[547,313],[550,307],[557,301],[571,301],[577,306],[581,312],[581,329]);
  p.polygon('#adaf97',[549,331],[549,313],[553,307],[559,304],[570,304],[576,309],[579,314],[579,331]);
  p.polygon('#445654',[553,332],[553,315],[558,310],[564,308],[571,311],[575,315],[575,332]);
  p.line('#c2b591',[558,305],[559,310]);
  p.line('#c2b591',[570,305],[569,310]);
  // Piers, mooring stations and a ferry pennant distinguish arrival from the fish landing.
  for(const [x,y] of [[385,487],[463,488],[385,538],[463,538],[50,505],[124,506],[232,458],[324,459]]) post(p,x,y,8);
  const flagX=464,flagY=510;
  p.line('#615744',[flagX,flagY+11],[flagX,flagY-30]);
  p.line('#c7b28b',[flagX-1,flagY+10],[flagX-1,flagY-30]);
  p.polygon('#547e77',[flagX,flagY-29],[flagX+11,flagY-27],[flagX+21,flagY-29],[flagX+17,flagY-24],[flagX+20,flagY-21],[flagX+9,flagY-20],[flagX,flagY-22]);
  p.line('#dfc596',[flagX+3,flagY-26],[flagX+9,flagY-24],[flagX+15,flagY-25]);
  // Brass-strapped loading strips remain flush with the planking.
  for(const y of [467,495,524]) {
    p.rect('#7b654f',394,y,59,3); p.rect('#ac936c',394,y,59,1);
    for(const x of [396,449]) p.rect('#d1b183',x,y+1,2,1);
  }
  // Hanging nets below the fish landing, in the water beyond the walkable edge.
  for(let i=0;i<10;i++) {
    const x=55+i*6;
    p.line('#8c9177',[x,514],[x+5,522],[x+10,525],[x+15,514]);
    p.line('#748574',[x,521],[x+5,515]);
  }
  lamp(p,387,465);
  // Cleats and mooring lines attach the existing moored skiff to actual pier hardware.
  p.line('#aa9471',[380,503],[383,493],[386,488]);
  p.line('#9f8a6c',[349,522],[367,529],[384,536]);
  // North passage gate piers continue the wall while leaving its road visible.
  for (const x of [254,326]) {
    p.rect('#736f5e',x,50,9,27);
    p.rect('#ada58a',x,50,3,25);
    p.rect('#c5b899',x-2,47,13,4);
  }
  p.line('#66776b',[263,50],[283,56],[305,55],[326,49]);
  for (const [x,y] of [[271,53],[283,55],[296,54],[309,53]]) {
    p.polygon('#a27f59',[x,y],[x+5,y+1],[x+2,y+7]);
  }
}

/** Painted once into the terrain texture, before world objects and travelers. */
export function paintExteriors(ctx: CanvasRenderingContext2D,map: MapDefinition, hearthLit = false) {
  if (map.id !== 'ship' && map.id !== 'harbor') return;
  const p = pixels(ctx);
  if (map.id === 'ship') wayfarer(p);
  else harbor(p, map, hearthLit);
  paintWorkingGear(p, map.id);
}
