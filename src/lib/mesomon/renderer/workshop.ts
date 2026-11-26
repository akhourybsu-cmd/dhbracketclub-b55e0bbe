// Map-space pixels. Furniture feet occupy the seven interactable cells. The
// surrounding wood remains a flat work surface for walking and laying out sailcloth.
type Stroke = (color: string, x: number, y: number, a: number, b: number) => void;

export function paintWorkshop(r: Stroke, line: Stroke, kettleWarm = false) {
  const ink = '#342e32', shadow = '#43383a', mahogany = '#754a41', cedar = '#956649';
  const lip = '#c29364', teal = '#4e736c', darkTeal = '#365456', sage = '#8da38b';
  const brass = '#d3ab69', brassDark = '#957746', parchment = '#e5ce99', cream = '#fff0bf';

  // Cutaway wall faces, continuous skirting and rafters enclose the loft.
  r('#293b3c', 0, 0, 256, 32);
  r('#394747', 0, 32, 32, 176);
  r('#394747', 224, 32, 32, 176);
  r('#272d32', 0, 208, 256, 16);
  r('#a99675', 23, 7, 210, 23);
  r('#d0b58b', 26, 9, 204, 16);
  for (const x of [24, 51, 94, 158, 201, 228]) {
    r(shadow, x - 1, 7, 6, 23);
    r(cedar, x, 8, 3, 21);
    r(lip, x, 9, 1, 19);
  }
  r(shadow, 21, 4, 214, 5);
  r(cedar, 21, 3, 214, 4);
  r(lip, 23, 3, 210, 1);
  r('#634d43', 29, 27, 198, 5);
  r(lip, 30, 27, 196, 1);
  r('#3d343833', 32, 32, 192, 4);

  for (const left of [true, false]) {
    const x = left ? 17 : 224;
    r(ink, x, 30, 15, 179);
    r('#a88e6d', x + 2, 31, 11, 176);
    r('#c1a680', x + 3, 32, 9, 174);
    for (const y of [32, 85, 137, 201]) {
      r(shadow, x, y, 15, 6);
      r(cedar, x + 1, y + 1, 13, 3);
      r(lip, x + 2, y + 1, 10, 1);
    }
    r('#665040', x + (left ? 12 : 0), 32, 3, 176);
  }
  // A long mullioned harbor window casts small panes of oblique light.
  const window = (x: number, y: number, w: number, h: number) => {
    r(ink, x, y, w, h);
    r('#7d6551', x + 1, y + 1, w - 2, h - 2);
    r('#65898d', x + 3, y + 2, w - 6, h - 5);
    r('#a3c6b3', x + 3, y + 2, w - 6, Math.floor(h / 3));
    r('#c8d7b3', x + 3, y + 2, w - 6, 2);
    if (w > 30) {
      // The loft looks across the quay. Keep the sea, sail and opposite roof
      // behind the sash so the glass reads as a view into a second space.
      r('#8da49b', 103, 20, 49, 4);
      r('#617d79', 103, 18, 9, 4);
      r('#778980', 104, 16, 5, 3);
      r('#71877e', 142, 19, 10, 3);
      line('#627971', 138, 12, 138, 23);
      for (let row = 0; row < 7; row++) r('#e1d7a9', 137 - row, 14 + row, row + 1, 1);
      r('#536d70', 131, 22, 11, 1);
      r('#b5c2a4', 111, 23, 7, 1);
    }
    const mid = x + Math.floor(w / 2);
    r(shadow, mid - 1, y + 1, 2, h - 3);
    r('#55635a', x + 2, y + Math.floor(h / 2), w - 4, 2);
    r(lip, x - 1, y + h - 2, w + 2, 2);
    r('#624b42', x - 2, y + h, w + 4, 2);
  };
  window(100, 8, 55, 20);
  window(224, 149, 12, 28);
  for (let y = 0; y < 38; y++) {
    if (y === 15 || y === 16) continue; // projected horizontal sash
    const x = 103 + Math.floor(y / 2);
    for (let pane = 0; pane < 4; pane++) r(y < 26 ? '#f5db953c' : '#f5db9524', x + pane * 10, 31 + y, 8, 1);
  }
  for (let y = 0; y < 26; y++) {
    const x = 218 - Math.floor(y * 1.45);
    r('#ffda981e', x, 155 + y, 7, 1);
    r('#ffdd9829', x, 160 + y, 7, 1);
  }

  // Books and pegged tools fill the north wall rather than the walking lane.
  for (const [x, w] of [[33, 56], [164, 56]]) {
    r(shadow, x, 13, w, 13);
    r('#5b5147', x + 1, 14, w - 2, 10);
    r(lip, x - 1, 23, w + 2, 2);
    r(cedar, x, 25, w, 3);
    r(shadow, x + 3, 28, 3, 2);
    r(shadow, x + w - 7, 28, 3, 2);
  }
  const bindings = ['#80524a', teal, '#b08355', '#738184', '#915c4d'];
  for (let i = 0; i < 5; i++) {
    const x = 36 + i * 5, h = 6 + ((i * 7) % 5);
    r(bindings[i % bindings.length], x, 23 - h, 4, h);
    r(brass, x, 21, 3, 1);
  }
  // The last half of the shelf is a carving bench. A half-hull hangs on
  // its mahogany backboard, with its chisel lying on the lip underneath.
  r('#734d40', 62, 10, 26, 12);
  r('#8c604b', 63, 11, 24, 10);
  r('#b09067', 64, 11, 21, 1);
  r('#4a3e39', 66, 15, 19, 2);
  r('#544139', 68, 17, 14, 3);
  r('#e0bc88', 65, 14, 20, 2);
  r('#bf996a', 67, 16, 16, 2);
  r('#a28158', 70, 18, 10, 1);
  r(brassDark, 71, 22, 9, 1);
  r('#d3cab0', 80, 22, 4, 1);
  for (let i = 0; i < 7; i++) {
    const x = 168 + i * 7;
    r('#d9c29a', x, 16 - i % 3, 4, 7 + i % 3);
    r('#af9171', x, 15 - i % 3, 4, 2);
    r(teal, x, 19, 4, 2);
  }

  // A wall niche holds Edda's sail thread on a bobbin rack. The recess,
  // turned dowels and projecting shelf are all on the solid west wall.
  r(ink, 16, 42, 15, 34);
  r('#654f41', 18, 44, 11, 27);
  r('#493d37', 19, 45, 10, 24);
  for (const [y, yarn, sheen] of [[49, '#a56352', '#d3916e'], [60, '#6f9288', '#a7b59c']] as const) {
    r(shadow, 20, y + 2, 10, 7);
    r(brass, 18, y + 2, 12, 2);
    r(yarn, 21, y, 6, 7);
    r(sheen, 21, y + 1, 5, 2);
    for (const end of [20, 27]) {
      r(cedar, end, y - 1, 2, 9);
      r(lip, end, y - 1, 1, 8);
    }
  }
  r(ink, 15, 71, 17, 5);
  r(lip, 15, 70, 16, 2);
  // The upper rail casts a stepped shadow over the knotting line below.
  for (let step = 0; step < 5; step++) r('#3d343824', 32, 74 + step, 6 - step, 1);
  // A test pennant hangs in the wall vent. Sailmakers can read the draft
  // here before laying out a full length of cloth on the floor.
  r(ink, 17, 97, 14, 27);
  r('#4f5149', 18, 98, 12, 24);
  r('#323e3d', 20, 100, 9, 20);
  r(lip, 18, 97, 11, 1);
  r(cedar, 18, 122, 12, 2);
  r(brass, 19, 101, 9, 2);
  r('#ad6650', 22, 103, 5, 13);
  r('#dba277', 22, 103, 2, 12);
  r('#b57a5b', 22, 116, 2, 2);
  r('#ad6650', 26, 116, 1, 1);

  // A knotted woven runner marks the work area without blocking a single tile.
  r('#594d4255', 107, 90, 53, 29);
  for (let x = 108; x < 158; x += 3) {
    r('#b4a17e', x, 86, 1, 3);
    r('#b4a17e', x, 116, 1, 3);
  }
  r(darkTeal, 106, 89, 54, 27);
  r(teal, 108, 91, 50, 23);
  for (const y of [92, 112]) {
    r('#b6af86', 110, y, 46, 1);
    for (let x = 111; x < 155; x += 6) r('#93a387', x, y + (y === 92 ? 2 : -2), 3, 1);
  }
  for (const x of [122, 143]) {
    line(sage, x - 4, 102, x, 99);
    line(sage, x, 99, x + 4, 102);
    line(sage, x + 4, 102, x, 105);
    line(sage, x, 105, x - 4, 102);
    r('#bdab7d', x, 102, 1, 1);
  }

  // A flat sail panel carries chalk construction lines, reinforcement and hand-sewn eyes.
  for (let row = 0; row < 34; row++) {
    const left = 93 + Math.floor(row / 4), right = 152 - Math.floor(row * 1.47);
    r('#553f3955', left + 2, 144 + row, right - left, 1);
    r(row < 3 ? '#9da497' : '#c4b398', left, 142 + row, right - left, 1);
  }
  line('#9c917b', 95, 145, 101, 172);
  line('#9c917b', 145, 146, 102, 172);
  line('#9c917b', 118, 145, 104, 169);
  for (let i = 0; i < 10; i++) r('#ead5aa', 95 + i * 5, 144, 2, 1);
  for (const [x, y] of [[96, 145], [145, 144], [101, 169]]) {
    r(brassDark, x, y, 3, 3);
    r(shadow, x + 1, y + 1, 1, 1);
  }
  line('#cbb677', 95, 145, 87, 141);
  line('#cbb677', 87, 141, 81, 144);

  // Bench tops project above their solid cells, with a shallow drawer and two feet.
  const bench = (x: number, y: number, stain: string) => {
    for (let row = 0; row < 7; row++) r('#44393635', x + 2 + Math.floor(row / 2), y + 10 + row, 17 - Math.floor(row / 3), 1);
    r(ink, x, y + 6, 16, 8);
    r(stain, x + 1, y + 6, 14, 6);
    r(lip, x + 2, y + 7, 12, 1);
    r(brass, x + 7, y + 9, 3, 1);
    r(shadow, x + 1, y + 12, 3, 4);
    r(shadow, x + 12, y + 12, 3, 4);
    r(ink, x - 2, y - 8, 20, 15);
    r('#b48b64', x - 1, y - 7, 18, 12);
    r('#c6a078', x, y - 7, 16, 1);
    r('#825c48', x - 1, y + 5, 18, 2);
    r('#55403b', x + 16, y + 7, 2, 4);
    r('#b78b67', x + 2, y + 13, 1, 2);
  };
  const paper = (x: number, y: number, w: number, h: number) => {
    r('#8b7558', x + 1, y + 1, w, h);
    r(parchment, x, y, w, h);
    r(cream, x + 1, y, w - 2, 1);
  };

  // Clue: the tide plot is bolted to its drafting board.
  bench(64, 64, mahogany);
  paper(63, 56, 18, 12);
  for (let x = 66; x < 80; x += 4) r('#c2b68c', x, 58, 1, 8);
  r('#bea97f', 65, 63, 15, 1);
  for (let i = 0; i < 2; i++) {
    line(darkTeal, 65 + i * 7, 63, 68 + i * 7, 59);
    line(darkTeal, 68 + i * 7, 59, 72 + i * 7, 65);
  }
  for (let i = 0; i < 5; i++) r(mahogany, 66 + i * 3, 66, 1, 1);
  r(brassDark, 63, 56, 2, 2);
  r(brassDark, 79, 56, 2, 2);

  // Clue: an unfolded map, damp at the coast, and one graphite pencil.
  bench(176, 64, darkTeal);
  paper(175, 56, 16, 12);
  for (let y = 0; y < 9; y++) r('#8fa49b', 176, 58 + y, 3 + Math.floor(y / 3), 1);
  line('#a47b66', 184, 58, 189, 64);
  line('#a47b66', 184, 64, 187, 61);
  r('#9a523d', 184, 63, 2, 2);
  line(ink, 191, 59, 192, 66);

  // Near the entrance: writing table with a split nib, stopped ink and loose note.
  bench(64, 144, darkTeal);
  paper(64, 138, 12, 10);
  for (let i = 0; i < 3; i++) r('#7f8070', 66, 140 + i * 2, 7 - i % 2, 1);
  r(ink, 77, 142, 4, 4);
  r('#748e85', 78, 142, 2, 1);
  line('#eee1b4', 78, 141, 82, 134);
  line('#c9b798', 80, 139, 83, 135);

  // The empty satchel pegs stand on the end of a freestanding chart chest.
  bench(192, 144, mahogany);
  r(shadow, 191, 127, 2, 16);
  r(shadow, 207, 127, 2, 16);
  r(ink, 190, 125, 20, 6);
  r(cedar, 191, 125, 18, 4);
  r(lip, 192, 125, 16, 1);
  for (const x of [195, 202]) {
    r(brassDark, x, 128, 2, 5);
    r(brass, x + 1, 128, 1, 3);
    r(brass, x + 2, 130, 1, 2);
  }
  r('#a18362', 193, 142, 13, 1);

  // Kettle on a small tiled hob. The curved handle encloses the lighter backsplash.
  r('#473b3655', 81, 124, 17, 5);
  r(ink, 80, 113, 16, 14);
  r(darkTeal, 81, 114, 14, 11);
  r(sage, 81, 115, 14, 1);
  r(ink, 84, 119, 8, 6);
  r('#916953', 85, 122, 5, 1);
  if (kettleWarm) {
    r('#a35f41', 85, 120, 6, 4);
    r('#db9453', 86, 120, 4, 3);
    r('#f6ca7d', 87, 121, 2, 2);
    r('#d89d6655', 83, 126, 11, 2);
  }
  r(shadow, 79, 111, 18, 4);
  r('#798982', 80, 111, 16, 1);
  r(ink, 84, 104, 10, 7);
  r('#ab8056', 85, 104, 8, 6);
  r('#d6a369', 85, 105, 2, 3);
  r(shadow, 85, 102, 8, 2);
  r(brass, 88, 101, 2, 1);
  line(ink, 84, 104, 85, 99);
  line(ink, 85, 99, 91, 99);
  line(ink, 91, 99, 93, 104);
  line('#ac8157', 84, 107, 80, 103);
  r(shadow, 79, 103, 3, 1);

  // A mending basket and a flat coil of line by the side window.
  r('#56463d55', 191, 186, 19, 5);
  r(shadow, 192, 180, 15, 10);
  r(cedar, 193, 179, 13, 10);
  for (const y of [181, 184, 187]) r(lip, 193, y, 13, 1);
  for (const x of [195, 200, 204]) r('#926c4e', x, 180, 1, 9);
  r(teal, 201, 177, 5, 6);
  for (let turn = 0; turn < 3; turn++) {
    const x = 191 + turn * 2, y = 176 + turn;
    const w = 13 - turn * 4;
    r(brassDark, x, y + 1, w, 3);
    r('#dfbd82', x + 1, y, w - 2, 1);
    r('#ead09b', x, y + 1, 1, 2);
  }

  // The lower cutaway has a single opening, aligned with the actual quay exit.
  r(ink, 16, 204, 112, 12);
  r(ink, 144, 204, 96, 12);
  for (const [x, w] of [[17, 110], [145, 94]]) {
    r(cedar, x, 204, w, 5);
    r(lip, x + 1, 204, w - 2, 1);
    r('#695345', x, 210, w, 3);
  }
  // Heavy cloth bolts lie on the cutaway wall's built-in rack, each with a
  // wound end and fastening band. Keep the doorway and passage in front free.
  for (const [x, y, len, body, edge] of [
    [44, 209, 25, '#80948c', '#adb3a0'], [70, 209, 23, '#9c886e', '#c5ac87'],
    [52, 203, 31, '#b99f7e', '#dfc5a0'],
  ] as const) {
    r(ink, x, y + 1, len, 6);
    r(body, x + 1, y, len - 3, 5);
    r(edge, x + 2, y, len - 4, 1);
    r(mahogany, x + 7, y, 2, 5);
    r('#b68862', x + 7, y, 1, 2);
    r(shadow, x + len - 3, y + 1, 4, 4);
    r(edge, x + len - 3, y + 1, 3, 3);
    r('#786758', x + len - 2, y + 2, 2, 1);
  }
  for (const x of [125, 144]) {
    r(ink, x, 197, 4, 17);
    r(cedar, x + 1, 197, 2, 15);
    r(lip, x + 1, 197, 1, 10);
  }
  r(shadow, 129, 204, 15, 12);
  r('#c8b095', 129, 203, 15, 2);
  r('#928678', 129, 207, 15, 2);
  r('#6c7776', 129, 211, 15, 2);
}
