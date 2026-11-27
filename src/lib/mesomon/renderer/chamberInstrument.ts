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

  // Exposed dressed joints follow the southern arc in perspective. Each
  // block shows a cool return face beneath its warm chamfer; the bronze-
  // edged deck occupies the opening at the middle.
  for (let x = -45; x <= 45; x++) {
    if (x >= -9 && x <= 9) continue;
    const curvature = Math.sqrt(1 - (x / 47) ** 2);
    const y = Math.round(91 + 29 * curvature);
    const height = 2 + Math.round(curvature * 3);
    rect('#354749', 152 + x, y + 3, 1, height);
    rect(x < 0 ? '#7d8980' : '#657671', 152 + x, y + 1, 1, height);
    rect(x < 0 ? '#b0ac90' : '#939981', 152 + x, y, 1, 1);
    if ([-42, -36, -26, -16, 16, 26, 36, 42].includes(x)) rect('#4c605c', 152 + x, y + 1, 1, height);
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
