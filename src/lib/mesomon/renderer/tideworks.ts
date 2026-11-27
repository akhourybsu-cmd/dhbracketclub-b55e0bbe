import type { MapDefinition } from '../types';
import { bypassMain, intakeStrainer, scupperWall, stairCheeks, timberCrib } from '../data/tideObstacles';

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

  // Open thresholds have a clear recess, unlike the sealed iron grilles.
  // Trace the inner and outer stone arches on the same scanline so the
  // soffit remains visible all the way around the opening.
  const threshold = (cx: number, foot: number, radius: number, jambHeight: number) => {
    const spring = foot - jambHeight, opening = radius - 4;
    for (let row = -radius; row < jambHeight; row++) {
      const rise = Math.min(row, 0);
      const outer = Math.round(Math.sqrt(radius * radius - rise * rise));
      const y = spring + row;
      rect('#566b66', cx - outer, y, 2 * outer + 1, 1);
      rect('#9aa58d', cx - outer, y, Math.min(2, outer + 1), 1);
      if (rise < -opening) continue;
      const inner = Math.round(Math.sqrt(opening * opening - rise * rise));
      rect('#2d4245', cx - inner, y, 2 * inner + 1, 1);
      if (inner > 2) rect('#1c333a', cx - inner + 2, y, inner * 2 - 3, 1);
      rect('#79897b', cx + inner, y, 1, 1);
    }
    for (let i = 1; i < 8; i++) {
      const angle = Math.PI * i / 8;
      const sx = Math.cos(angle), sy = Math.sin(angle);
      line('#3e5553', cx + Math.round(sx * (opening + 1)), spring - Math.round(sy * (opening + 1)),
        cx + Math.round(sx * radius), spring - Math.round(sy * radius));
    }
    rect('#8c9885', cx - radius - 1, foot - 1, radius * 2 + 3, 2);
    rect('#405b5b', cx - radius, foot + 1, radius * 2 + 1, 2);
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
    // This level cross-landing has an opening through each balustrade.
    blocks(112, 96, 80, 32);
    rect('#95a298', 112, 96, 80, 14);
    rect('#99a69a', 112, 111, 80, 14);
    for (const [x, y] of [[133, 96], [171, 96], [151, 111]]) rect('#84968c', x, y, 1, 14);
    rect('#bbc1a6', 112, 125, 80, 2);
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
    // On the west sea-wall, the lift chain disappears into an open well.
    // A counterweight descends when the gate rises. Its dry ochre base and
    // dark band of kelp keep the level legible in a still frame.
    blocks(35, 127, 28, 52);
    rect('#263e44', 37, 130, 24, 46);
    rect('#172e37', 40, 131, 17, 40);
    rect('#425959', 39, 131, 2, 39);
    rect('#53665c', 54, 131, 3, 37);
    rect('#29474b', 40, 170, 17, 6);
    rect('#698880', 41, 171, 15, 1);
    const weightY = state.gateOpen ? 156 : 143;
    for (let y = 133; y < weightY; y += 4) {
      rect('#958a6e', 47, y, 3, 2);
      rect('#58645a', 48, y + 2, 1, 2);
    }
    rect('#293d3f', 42, weightY + 2, 14, 13);
    rect('#927351', 42, weightY, 12, 12);
    rect('#c0a076', 42, weightY, 12, 2);
    rect('#af8862', 43, weightY + 2, 3, 9);
    for (const sy of [3, 9]) rect('#535247', 42, weightY + sy, 12, 2);
    rect('#929581', 34, 126, 30, 3);
    rect('#c2ba96', 34, 125, 29, 1);
    for (const [x, y] of [[34, 147], [36, 160], [59, 174], [44, 179]]) {
      rect('#445c53', x, y, 3, 5);
      rect('#789080', x, y, 2, 1);
      rect('#344c48', x + 2, y + 5, 1, 3);
    }
    // The wheel's stone foundation is cut flush with the landing. A shallow
    // swept arc and two iron stops show the travel around the spindle.
    for (let x = 113; x <= 145; x++) {
      const dx = (x - 133) / 23;
      const y = 139 + Math.round(14 * Math.sqrt(1 - dx * dx));
      rect('#697670', x, y, 1, 2);
      rect('#a6a68e', x, y + 2, 1, 1);
    }
    for (const [x, y] of [[112, 146], [145, 148]]) {
      rect('#415351', x, y, 4, 4);
      rect('#b0a17a', x, y, 3, 1);
    }
    // Slabs radiate around the toe of the old public stair. The fan stops
    // cleanly against the timber service dock on its right.
    for (const [radius, depth] of [[39, 14], [51, 21], [63, 29]]) {
      for (let x = 143 - radius; x < 160; x++) {
        const dx = (x - 143) / radius;
        const y = 158 + Math.round(depth * Math.sqrt(1 - dx * dx));
        if (y < 160) continue;
        rect('#60736e', x, y, 1, 1);
        rect('#8b998a', x, y + 1, 1, 1);
      }
    }
    for (const [x, y, tx, ty] of [[93, 165, 83, 167], [117, 171, 112, 176],
      [104, 172, 96, 177], [130, 178, 128, 185], [150, 172, 151, 177]]) {
      line('#64776f', x, y, tx, ty);
    }
    // The east-facing returns and the little shadows underneath the rail posts
    // give the flight a continuous side face when seen from the lower landing.
    for (let tread = 0; tread < 12; tread++) {
      const y = 64 + tread * 8;
      const thickness = 5 - Math.floor(tread / 4);
      rect('#526b68', 192, y + 2, thickness, 5);
      rect('#3e595a', 192, y + 7, thickness, 2);
      line('#8c9a88', 192, y, 191 + thickness, y + 2);
      if (tread % 2 === 0) diagonal(115, y + 3, 123, y + 7, '#334c4d38', 2);
    }
    // The passage entrance is carved into the outside retaining pier. Its
    // jamb meets the walkable doorway at (16,5); the arch sits in the east bank.
    blocks(271, 58, 29, 43);
    threshold(282, 93, 10, 12);
    for (const [x, y, w] of [[267, 93, 9], [264, 95, 11], [260, 97, 11]]) {
      rect('#929784', x, y, w, 1);
      rect('#576c67', x, y + 1, w, 1);
    }
    rect('#566f69', 271, 98, 25, 2);
    rect('#ac9573', 269, 69, 3, 15);
    rect('#314549', 264, 69, 6, 8);
    rect('#e4bc7e', 265, 70, 4, 5);
    rect('#7a7962', 265, 72, 4, 1);
    // Shallow lamp light crosses the high landing in sparse widening strips.
    for (let r = 0; r < 18; r++) rect('#ebdba41b', 76 + r, 48 + r, 23, 1);

    // Solid cheeks follow each flight. Copper rails sit on the outer edges
    // so the feet of the fixed finial and handwheel stay in the masonry.
    for (const cheek of stairCheeks) {
      const x = cheek.x * 16, y = cheek.y * 16, height = cheek.height * 16;
      const rail = cheek.x === 7 ? x + 3 : x + 11;
      rect('#465c5940', x + 3, y + 2, 15, height);
      blocks(x + 1, y + 1, 14, height - 2);
      rect('#85968a', x + 1, y + 1, 12, height - 6);
      rect('#b6b9a1', x + 1, y, 12, 2);
      rect('#a1aa97', x + 1, y + 1, 2, height - 7);
      rect('#495f5c', x + 12, y + 3, 3, height - 7);
      for (const post of [y + 3, y + height - 7]) {
        rect('#485652', rail - 1, post + 1, 5, 7);
        rect('#b29d72', rail, post, 2, 6);
        rect('#d0b888', rail - 1, post - 1, 4, 2);
      }
      rect('#5b655a', rail + 1, y + 2, 2, height - 9);
      rect('#baaa7f', rail, y + 2, 2, height - 10);
      rect('#a9ad94', x + 2, y + height - 5, 11, 1);
    }
    // Flood pressure escapes through brick scuppers under the coping.
    // The rounded nose leaves a bypass between the wall and the main stair.
    const wallX = scupperWall.x * 16, wallY = scupperWall.y * 16, wallW = scupperWall.width * 16;
    blocks(wallX + 2, wallY + 2, wallW - 2, 13);
    rect('#768a82', wallX, wallY + 2, wallW, 5);
    rect('#a9ad97', wallX + 2, wallY, wallW - 2, 3);
    rect('#405a59', wallX + 1, wallY + 6, wallW - 1, 2);
    for (const offset of [9, 28, 47]) {
      rect('#344d50', wallX + offset, wallY + 10, 10, 4);
      rect('#253e42', wallX + offset + 2, wallY + 8, 6, 6);
      rect('#859287', wallX + offset + 3, wallY + 8, 5, 1);
      rect('#84958b', wallX + offset + 1, wallY + 14, 10, 1);
      rect('#687f75', wallX + offset + 7, wallY + 1, 1, 4);
    }
    // Spare sliding gate timbers sit in a pegged crib above the loose brace.
    const cribX = timberCrib.x * 16, cribY = timberCrib.y * 16;
    const length = timberCrib.width * 16 - 4;
    rect('#48574c', cribX, cribY + 3, length + 4, 13);
    for (const offset of [1, 5, 9]) {
      rect('#705c45', cribX + 2, cribY + offset, length, 4);
      rect('#bc9b70', cribX + 2, cribY + offset, length - 2, 1);
      rect('#a3845e', cribX + length - 1, cribY + offset + 1, 3, 2);
    }
    for (const offset of [2, length - 3]) {
      rect('#4c5144', cribX + offset, cribY + 2, 4, 13);
      rect('#a69a78', cribX + offset, cribY + 2, 2, 11);
    }
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
    // The copper delivery main terminates in a cast, snail-shaped pump on
    // the blocked north bank. The lower lip stands proud of the crossing.
    rect('#273a3d', 160, 155, 75, 19);
    for (const [x, y, w] of [[161, 159, 23], [186, 158, 19], [208, 159, 25]]) {
      rect('#504d42', x, y, w, 10);
      rect('#8e8066', x, y, w, 2);
      rect('#635947', x + 3, y + 5, w - 6, 1);
    }
    rect('#24353b', 166, 159, 23, 10);
    rect('#757c6e', 165, 158, 23, 2);
    for (const x of [166, 183]) {
      rect('#5c6b60', x, 157, 4, 10);
      rect('#ba9e71', x + 1, 159, 2, 1);
    }
    rect('#192f35', 161, 131, 8, 17);
    rect('#687567', 160, 130, 7, 17);
    rect('#94977c', 160, 131, 2, 12);
    rect('#6c644f', 158, 131, 11, 4);
    rect('#bd9f72', 158, 131, 10, 1);
    // Bolted rim, recessed cheeks and offset spindle make a distinct silhouette.
    ellipse('#1b3339', 177, 148, 16, 15);
    ellipse('#717e6c', 176, 146, 16, 15);
    ellipse('#ab9d7c', 176, 145, 15, 14);
    ellipse('#445f5a', 176, 146, 13, 13);
    ellipse('#2c4546', 177, 147, 10, 10);
    ellipse('#63766a', 175, 146, 8, 8);
    for (const [x, y] of [[166, 136], [181, 133], [189, 146], [181, 158], [164, 152]]) {
      rect('#364940', x, y + 1, 2, 2);
      rect('#ceb184', x, y, 2, 1);
    }
    // A flanged copper elbow connects the housing to the delivery main above.
    for (const [x, y, tx, ty] of [[185, 139, 197, 139], [197, 139, 206, 130], [206, 130, 219, 130]]) {
      diagonal(x, y, tx, ty, '#283e40', 8);
      diagonal(x, y, tx, ty, '#936c50', 6);
      line('#c6a278', x, y, tx, ty);
      line('#a7815d', x, y + 2, tx, ty + 2);
    }
    for (const [x, y] of [[192, 138], [215, 129]]) {
      rect('#44554c', x, y, 4, 9);
      rect('#aea380', x, y, 3, 2);
    }
    // The exposed shaft carries one radial witness mark even when motion is off.
    ellipse('#344a48', 175, 146, 6, 6);
    ellipse('#928269', 175, 145, 5, 5);
    line('#c3ae83', 175, 145, 178, 142);
    rect('#d4b27f', 174, 144, 3, 3);
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
        // Water has stripped the middle of the planks pale; the lower edge
        // still carries the wet band visible below water on the way in.
        const start = 167 + (plank * 7) % 6;
        rect('#bda17b', start, y + 2, 9, 1);
        rect('#756d58', start - 1, y + 5, 8, 1);
        rect('#6a7568', 160, y + 5, 3, 2);
      }
    } else {
      rect('#2e5660', 161, 179, 30, 57);
      for (let y = 179; y < 236; y += 8) {
        rect('#426868', 163, y + 1, 24, 2);
        rect('#344f56', 164, y + 4, 25, 2);
      }
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
    // The cross-gallery's gratings cast a slant of light across the dry approach.
    // A wide gap between the bars leaves the sign, lever and encounter silhouettes clear.
    for (let bar = 0; bar < 4; bar++) {
      for (let step = 0; step < 10; step++) {
        rect('#f4ca8d12', 77 + bar * 9 + step * 2, 169 + step * 3, 5, 3);
      }
    }
    // At the far end the chamber's arched head meets the actual door tile. Salt
    // bands trail down the recess, keeping the distant portal legible from the bend.
    blocks(286, 17, 48, 29);
    threshold(311, 44, 15, 7);
    rect('#b5ae8c', 295, 45, 33, 2);
    for (const x of [291, 329]) {
      rect('#395451', x, 30, 3, 10);
      rect('#a59b7b', x, 30, 2, 4);
    }
    // Daylight through the joints of the wharf roof picks out the threshold
    // and the turn beside the lantern. The broad joist shadows run underfoot.
    for (const [y, width] of [[76, 93], [138, 87]]) {
      for (let row = 0; row < 13; row++) {
        const x = 240 + Math.floor(row / 2);
        rect(row < 3 || row > 10 ? '#253d461a' : '#253d463d', x, y + row, width - Math.floor(row / 2), 1);
      }
    }
    for (const [x, y] of [[276, 56], [291, 59], [301, 105]]) {
      for (let row = 0; row < 17; row++) {
        rect('#efd29820', x + Math.floor(row / 2), y + row, 5, 1);
      }
    }
    // The west wall feeds twin removable reed baskets on the entry towpath.
    // Their raised brass rims and front drain lip distinguish them from floor drains.
    const bedX = intakeStrainer.x * 16, bedY = intakeStrainer.y * 16, bedW = intakeStrainer.width * 16;
    blocks(bedX, bedY + 3, bedW - 1, 12);
    rect('#344e50', bedX, bedY + 1, bedW - 1, 10);
    rect('#8c9d91', bedX + 1, bedY, bedW - 4, 2);
    rect('#688177', bedX + 1, bedY + 10, bedW - 3, 2);
    for (const offset of [12, bedW - 14]) {
      const cx = bedX + offset;
      ellipse('#263e41', cx, bedY + 6, 10, 5);
      ellipse('#b39d75', cx, bedY + 4, 9, 4);
      ellipse('#45615b', cx, bedY + 4, 7, 3);
      for (let x = cx - 3; x <= cx + 3; x += 3) line('#949d79', x - 2, bedY + 5, x + 1, bedY + 2);
      rect('#bb9668', cx - 1, bedY + 2, 4, 1);
      rect('#273f42', cx - 2, bedY + 12, 5, 2);
    }
    // A bypass main crosses the east gallery at ankle height. Its elbow runs
    // into the channel wall; the exposed flange is the free end to walk around.
    const mainX = bypassMain.x * 16, mainY = bypassMain.y * 16, mainW = bypassMain.width * 16;
    rect('#31464955', mainX + 2, mainY + 7, mainW, 9);
    for (const offset of [3, mainW - 13]) {
      rect('#3c5251', mainX + offset, mainY + 5, 9, 10);
      rect('#819185', mainX + offset, mainY + 12, 9, 2);
    }
    rect('#574e43', mainX + 2, mainY + 2, mainW, 10);
    rect('#987456', mainX + 3, mainY + 2, mainW - 1, 7);
    rect('#c09b73', mainX + 4, mainY + 3, mainW - 1, 2);
    rect('#779087', mainX + 13, mainY + 7, 9, 2);
    for (const offset of [0, mainW - 8]) {
      rect('#415554', mainX + offset, mainY, 6, 13);
      rect('#8e9480', mainX + offset, mainY, 5, 3);
      rect('#b8ab87', mainX + offset + 1, mainY + 1, 2, 1);
      rect('#647b71', mainX + offset + 1, mainY + 4, 2, 7);
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
