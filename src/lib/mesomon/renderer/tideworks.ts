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
  // A flush, walkable apron steps into the opening at the corners. Clip
  // the wet surface against the same tiles that govern Tavian's footing.
  const wetEllipse = (color: string, rx: number, ry: number) => {
    for (let dy = -ry; dy <= ry; dy++) {
      const y = cy + 1 + dy;
      const half = Math.round(rx * Math.sqrt(1 - (dy / ry) ** 2));
      const left = cx - half, right = cx + half;
      for (let col = left >> 4; col <= right >> 4; col++) {
        if (map.tiles[y >> 4][col] !== 'dark-water') continue;
        const x = Math.max(left, col * 16);
        rect(color, x, y, Math.min(right + 1, col * 16 + 16) - x, 1);
      }
    }
  };
  wetEllipse('#344c50', 38, 22);
  wetEllipse(state.sealed ? '#557473' : '#424757', 36, 20);
  for (let tick = 0; tick < 16; tick++) {
    const angle = tick * Math.PI / 8;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    line(tick % 4 ? '#8f957f' : brass, cx + Math.round(dx * 41), cy + Math.round(dy * 25), cx + Math.round(dx * 46), cy + Math.round(dy * 28));
  }
  wetEllipse(state.sealed ? '#93b6a1' : '#9c88a6', 29, 16);
  wetEllipse(state.sealed ? '#597e7d' : '#51465d', 28, 15);
  const glint = state.sealed ? '#a5cab4' : '#c2a4bd';
  if (state.sealed) {
    for (const [x, y, w] of [[130, 91, 14], [151, 98, 17], [144, 85, 10]]) rect(glint, x, y, w, 1);
  } else {
    for (const [x, y, tx, ty] of [[124, 89, 136, 91], [136, 91, 142, 87], [142, 87, 154, 93], [154, 93, 164, 86], [164, 86, 174, 88]]) line(glint, x, y, tx, ty);
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
