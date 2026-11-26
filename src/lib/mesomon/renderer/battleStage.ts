import type Phaser from 'phaser';

/** The rear landing, flooded channel and near landing share a receding waterline. */
export function paintBattleStage(stage: Phaser.GameObjects.Graphics, boss: boolean, harbor: boolean) {
  const rect = (color: number, x: number, y: number, w: number, h: number) => {
    stage.fillStyle(color).fillRect(x, y, w, h);
  };
  const deep = boss ? 0x242131 : harbor ? 0x33595d : 0x20363c;
  const wall = boss ? 0x484052 : harbor ? 0x718b86 : 0x435c5b;
  const edge = boss ? 0x807083 : harbor ? 0xbaab87 : 0x81918a;
  const water = boss ? 0x393447 : harbor ? 0x477a7b : 0x304f53;
  const deck = boss ? 0x625669 : harbor ? 0x94765a : 0x596f6c;
  rect(deep, 0, 0, 160, 144);
  if (harbor && !boss) {
    rect(0xa1b9aa, 0, 0, 160, 31);
    for (const [x, y, w] of [[0, 19, 26], [29, 21, 18], [52, 15, 23], [80, 23, 25], [110, 17, 40]]) rect(wall, x, y, w, 31 - y);
    rect(edge, 0, 31, 160, 2);
  } else {
    rect(wall, 0, 0, 160, 32);
    // Recessed stone arches have stepped crowns, lit voussoirs and shared piers.
    for (const x of [-13, 30, 73, 116]) {
      rect(edge, x + 8, 5, 16, 2);
      rect(deep, x + 7, 8, 18, 24);
      rect(deep, x + 3, 11, 26, 21);
      rect(deep, x, 16, 32, 16);
      rect(edge, x - 2, 16, 2, 15);
      rect(wall, x + 12, 16, 1, 16);
    }
    rect(deep, 0, 32, 160, 3);
  }
  rect(water, 0, 35, 160, 109);
  for (const [x, y, w] of [[4, 42, 16], [46, 39, 7], [63, 48, 13], [10, 61, 9], [116, 88, 18], [95, 99, 11], [145, 83, 8]]) rect(wall, x, y, w, 1);
  // Offset stone courses create a shelf edge that turns toward the viewer.
  const landing = (x: number, y: number, width: number, near: boolean) => {
    for (let course = 0; course < 4; course++) {
      rect(deep, x - course * 4 + 2, y + course * 3 + 6, width + course * 5, 6);
      rect(wall, x - course * 4, y + course * 3 + 2, width + course * 5, 6);
      rect(deck, x - course * 4, y + course * 3, width + course * 5, 3);
    }
    rect(edge, x - 12, y + 11, width + 15, 1);
    for (let joint = x + 5; joint < x + width; joint += near ? 22 : 15) rect(deep, joint, y + 13, 1, 4);
  };
  landing(89, 57, 72, false);
  landing(-2, 88, 81, true);
  rect(deep, 0, 115, 160, 29);
  rect(wall, 0, 115, 160, 2);
  for (const [x, y, w] of [[99, 64, 34], [104, 63, 24], [26, 95, 39], [30, 94, 30]]) rect(deep, x, y, w, 2);
  if (boss) {
    for (const [x, y, w, h] of [[82, 0, 2, 7], [80, 6, 2, 6], [78, 10, 2, 5], [80, 15, 2, 4], [76, 14, 2, 3]]) rect(0xaa89ac, x, y, w, h);
  }
}
