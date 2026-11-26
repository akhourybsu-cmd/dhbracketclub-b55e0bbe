import type { MapDefinition } from '../types';

export interface TideworksState { gateOpen: boolean; sluiceOpen: boolean; sealed: boolean }

/** Static, integer-pixel architectural sections, painted below actors on the cached map. */
export function paintTideworks(ctx: CanvasRenderingContext2D, map: MapDefinition, state: TideworksState) {
  if (map.ambience !== 'underwharf') return;
  const rect = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const line = (c: string, x: number, y: number, tx: number, ty: number) => {
    const dx = Math.abs(tx - x), dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      rect(c, x, y, 1, 1);
      if (x === tx && y === ty) return;
      const next = 2 * error;
      if (next >= dy) { error += dy; x += sx; }
      if (next <= dx) { error += dx; y += sy; }
    }
  };
  const ellipse = (c: string, x: number, y: number, rx: number, ry: number) => {
    for (let offset = -ry; offset <= ry; offset++) {
      const half = Math.round(rx * Math.sqrt(1 - (offset / ry) ** 2));
      rect(c, x - half, y + offset, half * 2 + 1, 1);
    }
  };
  const dark = '#24383d', deep = '#183039', brass = '#b59b67', face = '#506665';
  const cap = '#a0aa96', wet = '#476768', foam = '#80aaa0', iron = '#405255';
  const blocks = (x: number, y: number, w: number, h: number) => {
    rect(dark, x, y, w, h);
    for (let course = 0; course * 8 < h; course++) {
      const sy = y + course * 8;
      const courseHeight = Math.min(8, y + h - sy);
      for (let col = x - (course % 2) * 9; col < x + w; col += 20) {
        const left = Math.max(col, x), right = Math.min(col + 19, x + w);
        if (right <= left) continue;
        rect(course % 2 ? '#516466' : '#596d6b', left, sy, right - left, courseHeight - 1);
        rect('#72807a', left + 1, sy, Math.max(1, right - left - 3), 1);
      }
    }
  };
  const diagonal = (x: number, y: number, tx: number, ty: number, c: string, w: number) => {
    for (let r = 0; r < w; r++) line(c, x, y + r, tx, ty + r);
  };
  const brace = (x: number, y: number, direction: number) => {
    diagonal(x + 1, y + 2, x + direction * 24 + 1, y - 18, dark, 5);
    diagonal(x, y, x + direction * 24, y - 20, '#735e4c', 5);
    line('#a58b68', x, y, x + direction * 24, y - 20);
    rect(brass, x + direction * 3, y - 1, 2, 2);
  };
  const landingFace = (x: number, y: number, w: number, h: number) => {
    blocks(x, y, w, h);
    rect('#415858', x, y + h - 5, w, 4);
    rect(deep, x, y + h, w, 2);
    rect(cap, x, y, w, 2);
    for (let pile = x + 11; pile < x + w - 4; pile += 38) {
      rect(dark, pile + 2, y + 3, 5, h + 3);
      rect('#798273', pile, y + 1, 5, h + 1);
      rect(face, pile + 3, y + 2, 2, h);
      rect(wet, pile, y + h - 3, 5, 4);
      rect('#6d9891', pile - 2, y + h + 5, 7, 1);
    }
  };
  // A vaulted opening is built course by course. The cut stones continue
  // around its spring line, with a brighter edge on the lit side of the jamb.
  const vault = (cx: number, foot: number, radius: number, height: number, lantern: boolean) => {
    const spring = foot - height;
    for (let y = -radius; y <= 0; y++) {
      const half = Math.floor(Math.sqrt(radius * radius - y * y));
      rect('#75847e', cx - half - 2, spring + y - 2, half * 2 + 5, 1);
      rect('#24383f', cx - half, spring + y, half * 2 + 1, 1);
    }
    rect('#23383f', cx - radius, spring, radius * 2 + 1, height);
    rect('#364d51', cx - radius + 2, spring + 1, radius * 2 - 4, height - 3);
    for (let x = cx - radius + 4; x < cx + radius - 2; x += 5) {
      rect('#1c323a', x, spring - 3, 2, height + 1);
      rect('#667775', x, spring - 3, 1, height);
    }
    for (let i = 1; i < 8; i++) {
      const angle = Math.PI * i / 8;
      line('#405457', cx + Math.round(Math.cos(angle) * radius), spring - Math.round(Math.sin(angle) * radius),
        cx + Math.round(Math.cos(angle) * (radius + 3)), spring - Math.round(Math.sin(angle) * (radius + 3)) - 1);
    }
    rect('#96a395', cx - radius - 3, spring, 2, height);
    rect('#344a50', cx + radius + 1, spring, 2, height + 1);
    rect('#8b9889', cx - radius - 2, foot - 1, radius * 2 + 5, 2);
    if (lantern) {
      rect('#172b32', cx - 2, spring + 1, 6, 6);
      rect('#98784e', cx - 1, spring, 4, 5);
      rect('#d8ad6f', cx, spring + 1, 2, 3);
      rect('#ffe1a0', cx, spring + 1, 1, 2);
    }
  };

  if (map.id === 'tide-stairs') {
    // The public stairs descend from a high stone quay into the service landing.
    landingFace(128, 240, 144, 19);
    landingFace(64, 256, 64, 16);
    // The north gallery is viewed front-on, with relieved arches under its parapet.
    blocks(47, 10, 225, 35);
    for (let x = 54; x < 258; x += 42) {
      rect('#263e45', x + 4, 22, 26, 21);
      rect('#263e45', x + 7, 18, 20, 5);
      rect('#354f54', x + 4, 34, 26, 8);
      rect(cap, x + 7, 17, 20, 1);
      rect('#788c85', x + 3, 23, 1, 19);
      rect('#879487', x + 13, 17, 6, 4);
    }
    for (const [x, lamp] of [[71, 0], [113, 1], [155, 0], [197, 0], [239, 1]]) {
      vault(x, 42, 10, 9, !!lamp);
    }
    rect('#9aa28e', 46, 8, 227, 2);
    rect('#596f6d', 46, 5, 227, 3);
    rect('#344c4e', 46, 0, 227, 5);
    rect('#263c3e', 47, 44, 226, 3);
    // Broad continuous nosings make the flight read as one volume, not 30 stair icons.
    for (let i = 0; i < 12; i++) {
      const y = 64 + i * 8;
      const tone = i < 4 ? '#99a499' : i < 8 ? '#8a998f' : '#7e9089';
      rect(tone, 112, y, 80, 5);
      rect('#657b76', 112, y + 5, 80, 1);
      rect('#485f60', 112, y + 6, 80, 2);
      rect('#bcc1a9', 114, y, 76, 1);
      rect('#788881', 119 + (i % 3) * 22, y + 1, 1, 3);
    }
    // Each stone wears away differently along the middle of the flight.
    for (let tread = 0; tread < 12; tread++) {
      const y = 64 + tread * 8;
      const seam = 116 + (tread * 17) % 34;
      rect('#768680', seam, y + 1, 1, 3);
      line('#89968b', seam + 1, y + 3, seam + 3, y + 4);
      rect('#c2c1a4', seam + 3, y + 1, 8, 1);
      rect('#6a827d', 178 - tread % 3, y + 2, 8 + tread % 3, 3);
      rect('#475b5a', 181, y + 6, 7, 2);
      if (tread % 3 === 1) rect('#8a9483', seam + 11, y, 4, 1);
    }
    // The west retaining wall stands in the channel. A ceramic tide staff
    // runs down its face; rust stops at the previous high-water mark.
    for (let y = 51; y < 234; y += 25) {
      blocks(48, y, 15, 22);
      rect('#879587', 46, y, 3, 18);
      rect('#364c50', 44, y + 3, 2, 19);
      rect('#52736e', 44, y + 14, 4, 6);
      rect('#83968a', 48, y + 20, 12, 1);
    }
    rect('#303e3e', 51, 87, 8, 37);
    rect('#cec5a4', 52, 87, 4, 34);
    for (let mark = 0; mark < 8; mark++) rect('#815a45', 52, 90 + mark * 4, mark % 2 ? 2 : 4, 1);
    rect('#788473', 49, 121, 10, 3);
    // Light through the gallery falls at an angle, breaking at each handrail.
    for (let pane = 0; pane < 3; pane++) {
      for (let step = 0; step < 12; step++) {
        rect('#f1dbc017', 66 + pane * 7 + step, 53 + step * 3, 5, 3);
      }
    }
    // Low masonry cheeks with bronze railings and breaks onto the cross landings.
    for (const x of [112, 188]) {
      for (const [y, h] of [[65, 39], [121, 35]]) {
        rect('#556860', x, y + 4, 4, h);
        rect('#b7a479', x, y, 2, h);
        for (let py = y; py < y + h; py += 16) {
          rect('#475345', x + 1, py, 3, 8);
          rect('#d5bd81', x, py, 4, 2);
        }
      }
    }
    // The iron rack works the lattice from beside the wheel. When Nia fits
    // the brace, its teeth climb and the spillway under the grating clears.
    rect(iron, 146, 145, 9, 24);
    rect('#293f42', 148, 146, 5, 21);
    const rackY = state.gateOpen ? 139 : 150;
    rect(brass, 149, rackY, 2, 16);
    for (let tooth = 0; tooth < 4; tooth++) rect('#d2bb86', 151, rackY + tooth * 4, 2, 2);
    rect('#36595e', 155, 160, 34, 8);
    rect('#9aa38c', 155, 167, 34, 2);
    for (let bar = 157; bar < 189; bar += 5) {
      rect(state.gateOpen ? '#91a89a' : '#525c56', bar, 160, 2, state.gateOpen ? 2 : 7);
    }
    if (state.gateOpen) {
      diagonal(141, 145, 151, 137, '#bd9c69', 3);
      rect('#90b5a2', 163, 164, 16, 1);
    }
    // A drive rod links the wheel and rising rack. Wear around its bed shows
    // which way the mechanism travels without adding an obstacle to the path.
    diagonal(132, 138, 151, 150, '#485953', 3);
    line(brass, 132, 138, 151, 150);
    ellipse('#374d4d', 150, 149, 4, 3);
    ellipse('#aaa073', 149, 148, 3, 2);
    rect('#c5ae7c', 148, 147, 1, 1);

    rect('#364c4a', 175, 152, 10, 8);
    rect('#aca47c', 175, 152, 10, 1);
    rect('#68817a', 177, 154, 6, 4);
    rect('#adc2a9', 177, state.gateOpen ? 156 : 154, 5, 1);

    // The service dock drains through a covered, walkable stone race into
    // a scupper in the east bank. The pressure changes at the gate, not at the steps.
    const runnels = [[186, 165, 195, 174], [195, 174, 231, 174], [231, 174, 243, 186], [243, 186, 269, 186]];
    for (const [x, y, tx, ty] of runnels) {
      diagonal(x, y, tx, ty, '#485953', 5);
      diagonal(x, y, tx, ty, '#a6a38a', 1);
      diagonal(x, y + 1, tx, ty + 1, state.gateOpen ? '#588489' : '#576359', 2);
      line(state.gateOpen ? '#85aaa0' : '#737964', x, y + 3, tx, ty + 3);
    }
    for (const [x, y] of [[197, 174], [206, 174], [215, 174], [224, 174], [247, 186], [256, 186]]) {
      rect('#687668', x, y, 2, 5);
      rect('#bcad84', x, y, 1, 4);
    }
    for (const [x, y] of [[169, 201], [185, 212], [230, 200], [247, 211]]) {
      rect('#544f40', x, y, 2, 2);
      rect('#ad9b72', x, y, 1, 1);
      rect('#655c47', x + 6, y - 2, 7, 1);
    }
    blocks(266, 172, 8, 28);
    rect('#344a4c', 271, 179, 9, 16);
    rect('#a2a892', 268, 176, 11, 3);
    rect('#273e43', 274, 180, 5, 11);
    rect('#456463', 273, 193, 7, 3);
    if (state.gateOpen) {
      for (let offset = 0; offset < 8; offset++) {
        rect(offset % 3 ? '#648f8c' : '#92b3a2', 275 + offset, 188 + Math.floor(offset / 2), 1, 6 - Math.floor(offset / 3));
      }
      ellipse('#597f7e', 284, 199, 9, 2);
      rect('#a0bbab', 281, 197, 6, 1);
      rect('#82a7a0', 289, 200, 4, 1);
    } else {
      rect('#6e9089', 276, 192, 1, 2);
      rect('#657c72', 269, 195, 7, 1);
    }
    brace(52, 58, 1);
    // Shallow lamp light crosses the high landing in sparse widening strips.
    for (let r = 0; r < 18; r++) rect('#ebdba41b', 76 + r, 48 + r, 23, 1);
    return;
  }

  if (map.id === 'passage') {
    // Backlit timber galleries are embedded in the solid banks flanking the corridor.
    for (const [x, y] of [[113, 236], [113, 316], [175, 153], [51, 141]]) {
      rect(deep, x, y - 17, 46, 20);
      brace(x + 1, y, 1);
      brace(x + 43, y, -1);
      rect('#453f38', x, y - 20, 46, 7);
      rect('#927f62', x, y - 20, 46, 2);
      rect('#b6a274', x + 4, y - 17, 2, 2);
      rect('#b6a274', x + 39, y - 17, 2, 2);
    }
    // A capped wall runs down the west side of the entry towpath.
    blocks(7, 183, 23, 144);
    rect('#9ba191', 29, 183, 3, 144);
    rect('#233e4155', 32, 183, 5, 144);
    for (let bay = 191; bay < 322; bay += 37) {
      rect('#526760', 10, bay, 19, 5);
      diagonal(11, bay + 22, 26, bay + 4, '#86795e', 3);
    }
    // Two flush grooves carry the flow to the wheel, turning with the walking route.
    for (const offset of [0, 5]) {
      rect('#536b69', 94 + offset, 211 + offset, 2, 111 - offset);
      rect('#8e9b88', 96 + offset, 211 + offset, 1, 109 - offset);
      rect('#536b69', 94 + offset, 211 + offset, 66 - offset, 2);
      rect('#90a08f', 94 + offset, 213 + offset, 66 - offset, 1);
    }
    // The crossing occupies exactly the four rows that the closed sluice blocks.
    // Open water drains below load-bearing planks, exposing a continuous walking surface.
    rect(deep, 160, 176, 32, 64);
    if (state.sluiceOpen) {
      for (let plank = 0; plank < 8; plank++) {
        const y = 176 + plank * 8;
        rect(plank % 3 === 0 ? '#9e896a' : '#a79070', 160, y, 32, 7);
        rect('#c9b38a', 160, y, 32, 1);
        rect('#514e41', 162, y + 3, 2, 2);
        rect('#514e41', 188, y + 3, 2, 2);
      }
    } else {
      rect('#2e5660', 161, 179, 30, 57);
      for (let y = 183; y < 233; y += 10) {
        rect('#518585', 162 + (y % 3) * 3, y, 13, 1);
        rect(foam, 176, y + 2, 8, 1);
      }
      for (let x = 162; x < 190; x += 7) {
        rect(dark, x, 176, 4, 64);
        rect('#9c8c6b', x, 176, 2, 62);
      }
      for (const y of [185, 224]) {
        rect('#464c45', 160, y, 32, 6);
        rect(brass, 160, y, 32, 1);
      }
    }
    rect(cap, 158, 175, 36, 2);
    rect(dark, 158, 239, 36, 3);
    return;
  }

  // Chamber: an inset tidal instrument at the rift and two sunken balancing pools.
  // The axial sight line carries the entrance view up to its engraved dial.
  landingFace(32, 224, 80, 13);
  landingFace(160, 224, 96, 13);
  // Three blind arches frame the instrument. Their piers stand on the
  // north wall's blocked tiles; their cast shadows reach the survey floor.
  blocks(32, 14, 224, 32);
  for (const center of [67, 142, 217]) {
    vault(center, 43, 17, 8, false);
    rect('#25343e', center - 25, 14, 4, 32);
    rect('#828b83', center - 26, 15, 2, 25);
    rect('#9a9e8b', center - 28, 40, 7, 2);
    rect('#516760', center - 28, 42, 8, 4);
  }
  rect('#384951', 32, 12, 224, 3);
  rect('#89948a', 32, 14, 224, 1);
  for (const x of [47, 106, 179, 236]) {
    for (let row = 0; row < 13; row++) rect('#1e2c3920', x + row, 46 + row, 4, 1);
  }
  for (const [x, y, w, h] of [[48, 48, 48, 48], [192, 128, 48, 64]]) {
    blocks(x, y, w, 11);
    rect(deep, x, y + 10, w, h - 10);
    rect('#30575e', x + 3, y + 15, w - 5, h - 17);
    rect('#395e63', x + 5, y + 20, w - 9, h - 25);
    rect(cap, x, y, w, 2);
    rect('#798e85', x, y, 2, h);
    rect('#527976', x + 3, y + 13, w - 5, 2);
    for (let ripple = 0; ripple < 3; ripple++) {
      rect('#648e89', x + 8 + ripple * 6, y + 22 + ripple * 9, 13, 1);
    }
  }
  // A balance pipe enters each pool through a recessed inspection throat.
  // One side runs high while the tear is open. Closing it levels the water.
  for (const [x, y, width] of [[48, 48, 48], [192, 128, 48]]) {
    const level = state.sealed ? 17 : x === 48 ? 14 : 21;
    rect('#36474c', x + 2, y + 11, width - 4, level - 10);
    rect('#65837d', x + 2, y + level + 1, width - 4, 1);
    rect('#465e60', x + 2, y + level, width - 4, 1);
    rect('#c0af86', x + width - 8, y + 5, 3, 18);
    for (let notch = 0; notch < 5; notch++) rect('#6f6d5a', x + width - 8, y + 6 + notch * 3, 2, 1);
    rect('#38565b', x + 8, y + 8, 11, 6);
    rect('#96a299', x + 8, y + 7, 11, 1);
    rect('#2a444b', x + 10, y + 9, 7, 4);
    rect('#5b8580', x + 12, y + 13, 3, level - 10);
    rect('#8ca89c', x + 13, y + 13, 1, level - 12);
  }
  for (const x of [131, 140]) {
    rect('#4f6766', x, 131, 2, 80);
    rect('#a7a486', x + 2, 131, 1, 80);
    line('#627973', x, 131, x + 7, 119);
  }
  for (const y of [151, 171, 191]) {
    rect('#73827a', 128, y, 17, 3);
    rect('#aaa583', 129, y, 15, 1);
  }
  // A low brass calibration plate sits flush with the entry floor. An inset
  // line connects its pointer to the water gauge in the eastern balance pool.
  for (const [x, y, tx, ty] of [[148, 165, 165, 165], [165, 165, 182, 148], [182, 148, 192, 148]]) {
    diagonal(x, y, tx, ty, '#435c5a', 3);
    line('#9e9e80', x, y, tx, ty);
  }
  ellipse('#4c6261', 137, 167, 19, 10);
  ellipse('#a8a283', 136, 165, 19, 10);
  ellipse('#536964', 136, 165, 16, 8);
  ellipse('#758780', 136, 165, 13, 6);
  for (const [x, y] of [[119, 165], [151, 165], [135, 156], [135, 172]]) rect('#d0ba87', x, y, 2, 2);
  const targetX = state.sealed ? 128 : 145;
  diagonal(136, 165, targetX, 161, '#d1c28e', 2);
  rect('#445856', 135, 164, 3, 3);

  const cx = 152, cy = 91;
  ellipse('#354c50', cx + 1, cy + 5, 48, 30);
  ellipse('#647873', cx, cy + 3, 48, 30);
  ellipse('#b0ae91', cx, cy, 48, 30);
  ellipse('#5c706c', cx, cy, 44, 27);
  ellipse('#869287', cx, cy - 1, 42, 25);
  // The lip curves between tile centers. The water covers every blocked
  // center and the projecting inspection deck carries the southern approach.
  ellipse('#344c50', cx, cy + 1, 37, 22);
  ellipse('#3b5254', cx, cy + 2, 36, 21);
  ellipse(state.sealed ? '#557473' : '#424757', cx, cy + 1, 35, 21);
  for (let tick = 0; tick < 16; tick++) {
    const angle = tick * Math.PI / 8;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    line(tick % 4 ? '#8f957f' : brass, cx + Math.round(dx * 41), cy + Math.round(dy * 25), cx + Math.round(dx * 46), cy + Math.round(dy * 28));
  }
  // The ring is built of individual dressed stones. Raised outer corners,
  // radial mortar cuts and a partly wetted inside lip give it weight.
  for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI / 12 + .075;
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const outerX = cx + Math.round(ux * 47), outerY = cy + Math.round(uy * 29);
    line('#53645f', cx + Math.round(ux * 40), cy + Math.round(uy * 24), outerX, outerY);
    if (uy > .25) line('#495a59', outerX, outerY + 2, outerX, outerY + 4);
    if (ux < 0) rect('#c2b89a', outerX, outerY - 1, 2, 1);
  }
  ellipse(state.sealed ? '#93b6a1' : '#9c88a6', cx, cy + 1, 29, 16);
  ellipse(state.sealed ? '#597e7d' : '#51465d', cx, cy + 1, 28, 15);
  const glint = state.sealed ? '#a5cab4' : '#c2a4bd';
  if (state.sealed) {
    for (const [x, y, w] of [[130, 91, 14], [151, 98, 17], [144, 85, 10]]) rect(glint, x, y, w, 1);
    rect('#709695', 127, 94, 11, 1);
    rect('#759a93', 159, 99, 10, 1);
    line('#829d91', 148, 89, 154, 91);
  } else {
    // The same two opposed currents distort a reflected arch on either
    // side of the fissure. Their jagged dark center stays readable in grayscale.
    for (const [x, y, tx, ty] of [[127, 86, 136, 83], [136, 83, 145, 82], [158, 101, 171, 97]]) {
      diagonal(x, y, tx, ty, '#74617b', 2);
    }
    for (const [x, y, tx, ty] of [[124, 89, 136, 91], [136, 91, 142, 87], [142, 87, 154, 93], [154, 93, 164, 86], [164, 86, 174, 88]]) {
      diagonal(x, y, tx, ty, '#292637', 3);
      line(glint, x, y, tx, ty);
    }
    line('#97849f', 140, 89, 136, 96);
    line('#b798b9', 160, 90, 164, 94);
  }
  // One dry landing reaches the rift from the south. The plank seams run
  // across the narrow deck, with bronze edge strips and a solid stop at its tip.
  rect('#435654', 144, 96, 16, 27);
  for (let y = 96; y < 122; y += 5) {
    rect('#a19378', 146, y, 12, 4);
    rect('#c3b294', 146, y, 12, 1);
  }
  rect('#c5ae79', 144, 96, 2, 26);
  rect('#aa986d', 158, 96, 2, 26);
  rect('#cfba86', 144, 96, 16, 2);
}
