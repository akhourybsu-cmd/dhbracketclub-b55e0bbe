import { inspectionRails, tongueStops } from '../data/interiorObstacles';
import { interiorBrushes } from './interiorBrushes';
import type { EnvironmentRect } from './environmentMotion';

// The chamber is an old tide station. Two float lines feed the pens of the
// same clockwork drum. They record an uneven second beat until the rift seals.
const tide = [0, -1, -2, -1, 0, 1, 2, 1] as const;
const echo = [2, 1, -1, 1, 0, -2, 0, 2] as const;
const caseInk = '#293d40', wood = '#795b48', bronze = '#b39a6b';

export function paintChamberInstrument(ctx: CanvasRenderingContext2D, sealed: boolean) {
  const rect = (color: string, x: number, y: number, width = 1, height = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
  };

  // The thick chamber walls meet the floor at projecting stone corbels.
  // Only their soft raking shadows reach into the accessible floor.
  for (const [x, y, side] of [[32, 104, 1], [32, 181, 1], [240, 82, -1], [240, 176, -1]]) {
    const inside = side > 0 ? x + 16 : x;
    for (let row = 0; row < 11; row++) {
      const run = 8 - Math.floor(row / 2);
      rect('#1f333c2b', side > 0 ? inside : inside - run, y + 16 + row, run, 1);
    }
    rect('#2f4246', x + 1, y - 3, 14, 27);
    rect('#657570', x + 3, y - 2, 10, 22);
    rect('#929a86', x + 2, y - 3, 11, 2);
    rect('#879282', x + 3, y - 1, 2, 18);
    rect('#465c5c', x + 11, y, 2, 20);
    rect('#a1a28b', x, y + 16, 15, 2);
    rect('#768378', x + 1, y + 18, 14, 4);
    rect('#455a5a', x + 2, y + 22, 13, 3);
  }
  // The float lines run in two chases in the north wall. Their sheaves,
  // paper roll and both pen tips stay behind the basin's inspection deck.
  for (const [x, width] of [[78, 48], [172, 61]]) {
    rect('#243b3f', x, 38, width, 3);
    rect('#939380', x, 38, width, 1);
    rect('#a0a38a', x, 40, width - 2, 1);
  }
  rect('#536865', 78, 41, 2, 12);
  rect('#a09b79', 78, 41, 1, 12);
  rect('#526663', 231, 41, 2, 89);
  rect('#899680', 233, 41, 1, 89);
  rect('#75867a', 220, 130, 14, 2);
  // The case projects below the lintel so its paper remains visible from
  // the foot of the dial. The mounting ledge casts a shadow onto the floor.
  const onCase = (color: string, x: number, y: number, width = 1, height = 1) =>
    rect(color, x, y + 10, width, height);
  // Oak case with stepped pediment, two stone corbels and a cast shadow.
  onCase('#26363a', 127, 18, 52, 30);
  onCase('#495955', 128, 44, 6, 5);
  onCase('#495955', 169, 44, 6, 5);
  onCase('#919582', 128, 44, 4, 2);
  onCase('#919582', 169, 44, 4, 2);
  onCase(caseInk, 124, 17, 53, 27);
  onCase(wood, 126, 18, 49, 23);
  onCase('#957e60', 126, 18, 49, 2);
  onCase('#263c41', 128, 21, 45, 19);
  onCase('#c1ac7d', 122, 15, 57, 2);
  onCase('#63594c', 123, 17, 55, 2);
  onCase('#948967', 126, 13, 49, 2);
  onCase('#b5a47c', 124, 41, 52, 2);
  onCase('#52574c', 125, 43, 50, 2);
  // Cylindrical paper catches the light along its shoulder and rolls
  // back into shade at the foot. The chart can be read with motion off.
  onCase('#786f5c', 134, 21, 30, 18);
  onCase('#c4b993', 135, 22, 28, 16);
  onCase('#ddd1aa', 135, 23, 28, 3);
  onCase('#d2c6a0', 135, 26, 28, 7);
  onCase('#afa98d', 135, 35, 28, 3);
  for (let x = 138; x < 162; x += 5) onCase('#b6b294', x, 26, 1, 9);
  for (let sample = 0; sample < 24; sample++) {
    onCase('#486963', 137 + sample, 27 + tide[(sample >> 1) % 8]);
    onCase('#81574d', 137 + sample, 33 + (sealed ? tide : echo)[(sample >> 1) % 8]);
  }
  // Brass bearings, separate pen spindles and the lower paper retaining lip.
  for (const x of [130, 165]) {
    onCase('#6e735f', x, 21, 3, 18);
    onCase(bronze, x, 22, 1, 15);
    onCase('#dcc18b', x, 24, 3, 1);
    onCase('#384847', x, 37, 3, 2);
  }
  onCase('#656655', 134, 38, 30, 2);
  onCase('#c9b586', 135, 38, 27, 1);
  for (const baseline of [27, 33]) {
    onCase('#4a5952', 162, baseline, 8, 2);
    onCase('#c3af80', 164, baseline, 5, 1);
  }

  // Two copper floats sit in the existing stilling wells. Each is fixed
  // to a guide rail inside the water, never on a walkable bank.
  for (const [x, y, level] of [[78, 48, sealed ? 17 : 14], [219, 128, sealed ? 17 : 21]]) {
    rect('#314e52', x - 1, y + 3, 4, 36);
    rect('#a09877', x, y + 3, 1, 34);
    const top = y + level - 3;
    rect('#293f43', x - 4, top + 1, 10, 5);
    rect('#a17453', x - 4, top, 9, 4);
    rect('#dab387', x - 3, top - 1, 7, 2);
    rect('#bf8462', x - 3, top + 1, 6, 2);
    rect('#536e6c', x - 6, top + 5, 13, 1);
    rect('#87a69a', x - 4, top + 5, 7, 1);
  }

  // The northwest viewing angle exposes the back of the copper liner.
  // Its wet lower edge runs several pixels below the raised stone bearing.
  // The water in front of it, and the walkway across it, stay unobstructed.
  for (let dx = -36; dx <= 36; dx++) {
    const x = 152 + dx;
    const curve = Math.sqrt(1 - (dx / 37) ** 2);
    const top = 91 - Math.round(22 * curve);
    const lower = 91 - Math.round(17 * curve);
    const western = dx < -7, eastern = dx > 17;
    rect(eastern ? '#55594e' : '#746247', x, top - 1, 1, lower - top + 2);
    rect(western ? '#f1c085' : eastern ? '#9c8a62' : '#d3a979', x, top - 1);
    rect(western ? '#b08059' : '#846951', x, top, 1, Math.max(1, lower - top - 2));
    rect(eastern ? '#3e5657' : '#617065', x, lower - 1, 1, 2);
    if (dx === -29 || dx === -16 || dx === 1 || dx === 20 || dx === 32) {
      rect('#454b45', x, top, 1, lower - top);
      rect('#bca67c', x + 1, top + 1);
    }
  }
  // The front arc stands on a foot ring. Each cast panel has a lit upper
  // chamfer, a shaded vertical face and a soft shadow on the existing paving.
  // Its two ends break at the boardwalk instead of crossing the walking lane.
  for (let dx = -46; dx <= 46; dx++) {
    if (Math.abs(dx) <= 9) continue;
    const curve = Math.sqrt(1 - (dx / 47) ** 2);
    const x = 152 + dx, y = Math.round(91 + 29 * curve);
    const depth = 2 + Math.round(curve * 6);
    if (dx < -11 || dx > 9) rect('#27393e36', x + 2, y + depth + 3, 1, 3);
    rect('#293e40', x, y + 2, 1, depth + 2);
    rect(dx < 0 ? '#7d7361' : '#485c5a', x, y + 1, 1, depth - 1);
    rect(dx < 0 ? '#ad9a77' : '#7a8977', x, y, 1, 2);
    rect(dx < -16 ? '#e5c78e' : '#a6a789', x, y);
    rect(dx < 0 ? '#866e50' : '#626850', x, y + depth, 1, 2);
    if ([-43, -36, -26, -16, 16, 26, 36, 43].includes(dx)) {
      rect('#40514f', x, y + 1, 1, depth);
      rect('#c6ab76', x + 1, y + 2);
    }
  }

  // The two bolted strike plates sit directly on the rim. Repeated knocks
  // have worn the left plate bright. The hammered bronze follows the
  // curve of the stone rather than protruding onto the inspection deck.
  for (const side of [-1, 1]) {
    for (let dy = -9; dy <= 8; dy++) {
      const outer = Math.round(46 * Math.sqrt(1 - (dy / 29) ** 2));
      const x = side < 0 ? 152 - outer : 152 + outer - 4;
      rect('#5b594d', x, 91 + dy, 5, 1);
      rect(side < 0 ? '#ba9e70' : '#a99a76', x + 1, 91 + dy, 3, 1);
      if (dy === -7 || dy === 6) rect('#5f6559', x + 2, 91 + dy);
      if (dy > -3 && dy < 2) rect(side < 0 ? '#d7c297' : '#bbc09d', x + 1, 91 + dy, 2, 1);
    }
  }
  // Brass handrails stand on continuous stone kerbs. The west gallery
  // turns at the end of its rail; the east one follows the stilling well.
  for (const rail of inspectionRails) {
    const x = rail.x * 16, y = rail.y * 16, length = rail.height * 16;
    // The base of each inspection lantern sits on its first stone coping.
    for (let row = 0; row < 7; row++) {
      rect('#26383e45', x + 6 + row, y + 3 + row, 6, 1);
    }
    rect('#273a412e', x + 14, y + 4, 3, length - 2);
    rect('#3b5154', x + 1, y + 1, 14, length - 1);
    rect('#71837c', x + 1, y + 1, 12, length - 4);
    rect('#a3a98e', x + 1, y + 1, 2, length - 4);
    rect('#859284', x + 3, y + 1, 9, 2);
    rect('#586f6a', x + 11, y + 3, 2, length - 6);
    for (let joint = 17; joint < length - 6; joint += 19) {
      rect('#596e68', x + 3, y + joint, 10, 1);
      rect('#879483', x + 3, y + joint + 1, 9, 1);
    }
    rect('#4b5b55', x + 7, y + 4, 3, length - 9);
    rect('#b39b70', x + 6, y + 3, 2, length - 9);
    rect('#cdb78b', x + 6, y + 4, 1, length - 11);
    for (const offset of [3, Math.floor(length / 2), length - 6]) {
      const post = y + offset;
      rect('#3d4f4e', x + 4, post, 7, 4);
      rect('#708079', x + 4, post, 6, 2);
      rect('#544e41', x + 5, post - 3, 4, 6);
      rect('#ae946a', x + 5, post - 3, 2, 5);
      rect('#494d43', x + 4, post - 4, 6, 3);
      rect('#c5ae7f', x + 4, post - 4, 5, 1);
      rect('#8b815e', x + 4, post - 3, 5, 1);
    }
  }

  // The bridge's old stop-stones carry two turned mooring rings. They
  // sit on either side of the one-tile plank and leave its boards exposed.
  for (const stop of tongueStops) {
    const x = stop.x * 16, y = stop.y * 16;
    rect('#384e4f', x + 1, y + 3, 14, 13);
    rect('#78857b', x + 1, y + 3, 13, 9);
    rect('#9a9e88', x + 1, y + 3, 13, 2);
    rect('#b2af93', x + 1, y + 3, 2, 8);
    rect('#64756d', x + 2, y + 12, 11, 2);
    rect('#555c51', x + 5, y + 6, 7, 4);
    rect('#bcaa80', x + 5, y + 2, 5, 2);
    rect('#cdb98a', x + 4, y + 3, 2, 4);
    rect('#9c8e6c', x + 9, y + 3, 2, 4);
    rect('#c7af81', x + 5, y + 7, 5, 1);
  }

  // Daylight reflected off the drum breaks at the second current. A long,
  // continuous reflection replaces the broken strips once the water settles.
  if (sealed) {
    rect('#839e90', 139, 81, 23, 1);
    rect('#75958d', 141, 82, 18, 1);
  } else {
    rect('#928594', 139, 80, 5, 1);
    rect('#746a7d', 145, 79, 5, 1);
    rect('#857889', 155, 82, 7, 1);
    rect('#766a80', 163, 83, 3, 1);
  }
}

/** The ink tips ride independent pen arms. They settle into the same cadence
 * after sealing. The broad static traces remain legible with motion disabled. */
export function paintRecorderMotion(phase: number, sealed: boolean, rect: EnvironmentRect) {
  for (const [baseline, deflection] of [[37, tide[phase]], [43, (sealed ? tide : echo)[phase]]]) {
    const y = baseline + deflection;
    rect(0xcdb582, 1, 163, baseline + Math.sign(deflection), 3, 1);
    rect(0x4c5b56, 1, 161, y, 3, 1);
  }
}

const surveyLamp = [
  '     dd     ',
  '    dhdd    ',
  '    dbbd    ',
  '   dbbbdd   ',
  '  dhhbbbsd  ',
  ' dhhhhbbbsd ',
  'dqqhbbbbbssd',
  '  swwwwwsd  ',
  '  syyyhwsd  ',
  '  sqyyhwsd  ',
  '  sqyyhwsd  ',
  '  syyyhwsd  ',
  '  sbwwwwsd  ',
  ' dbbbbbbssd ',
  '  dhbbbsdd  ',
  '    dhds    ',
  '    dbds    ',
  '    dhds    ',
  '   dhhbds   ',
  '  ddbbbssd  ',
];

// The base is on the rail and the hood hangs over the walkable approach.
// Each lamp shares a housing; the two lenses identify the paired floats.
function paintSurveyLamp(ctx: CanvasRenderingContext2D, east: boolean) {
  const { rect } = interiorBrushes(ctx);
  const enamel: Record<string, string> = {
    d: '#263b3d', s: '#485753', b: '#90764f', h: '#bfa16d',
    w: east ? '#779c89' : '#c29660', y: east ? '#b2ceb0' : '#f0cc88',
    q: east ? '#e0edcb' : '#fff0bd',
  };
  surveyLamp.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] !== ' ') rect(enamel[row[x]], x, y, 1, 1);
  });
}

export const chamberRelief = inspectionRails.map((rail, index) => ({
  mapId: 'chamber' as const, id: rail.id + '-lamp', x: rail.x * 16 + 1, y: rail.y * 16 - 14,
  width: 12, height: surveyLamp.length, footY: rail.y * 16 + 5,
  paint: (ctx: CanvasRenderingContext2D) => paintSurveyLamp(ctx, index === 1),
}));
