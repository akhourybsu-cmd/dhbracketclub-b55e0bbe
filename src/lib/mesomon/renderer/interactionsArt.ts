import type { MapObject } from '../types';

export const INTERACTION_ART_KEYS = [
  'rift-open', 'rift-scar', 'survey-page', 'eddy-flow', 'eddy-drained',
  'channel-pull', 'channel-calm', 'timber-brace', 'tincture-flask',
  'wayboard', 'survey-cuts', 'reed-tuft', 'stone-steps',
  'rope-coil', 'rest-lantern', 'sluice-closed', 'sluice-open',
] as const;
export type InteractionArtKey = typeof INTERACTION_ART_KEYS[number];
export interface InteractionArtState { sealed: boolean; sluiceOpen: boolean }
/** Every frame shares the actor's tile-center/feet anchor. Unpainted pixels stay transparent. */
export const INTERACTION_ART = { width: 16, height: 24, originX: 0.5, originY: 1, keys: INTERACTION_ART_KEYS } as const;

/** Baked architecture/workshop props and actors deliberately return null. */
export function interactionArtKey(data: Pick<MapObject, 'id'>, state: InteractionArtState): InteractionArtKey | null {
  switch (data.id) {
    case 'rift': return state.sealed ? 'rift-scar' : 'rift-open';
    case 'page': return 'survey-page';
    case 'sense-eddy': return state.sluiceOpen ? 'eddy-drained' : 'eddy-flow';
    case 'sense-channel': return state.sealed ? 'channel-calm' : 'channel-pull';
    case 'sluice': return state.sluiceOpen ? 'sluice-open' : 'sluice-closed';
    case 'gate-brace': return 'timber-brace';
    case 'pickup-tincture': return 'tincture-flask';
    case 'harbor-sign':
    case 'maintenance-plaque': return 'wayboard';
    case 'chamber-markings': return 'survey-cuts';
    case 'whistle-reeds': return 'reed-tuft';
    case 'stairs-exit':
    case 'passage-exit':
    case 'chamber-exit': return 'stone-steps';
    case 'ship-rail':
    case 'departure-pier': return 'rope-coil';
    case 'save-lamp': return 'rest-lantern';
    default: return null;
  }
}

/** Original native-pixel objects, drawn once into transparent cached textures.
 * No terrain tile is copied underneath them and no antialiased vector is used. */
export function paintInteractionArt(ctx: CanvasRenderingContext2D, key: InteractionArtKey): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, INTERACTION_ART.width, INTERACTION_ART.height);
  const r = (color: string, x: number, y: number, width = 1, height = 1) => {
    ctx.fillStyle = color; ctx.fillRect(x, y, width, height);
  };
  const line = (color: string, x: number, y: number, tx: number, ty: number) => {
    const dx = Math.abs(tx - x), dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1, sy = y < ty ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      r(color, x, y);
      if (x === tx && y === ty) return;
      const next = error * 2;
      if (next >= dy) { error += dy; x += sx; }
      if (next <= dx) { error += dx; y += sy; }
    }
  };
  const ink = '#24383d', shadow = '#142d365e', stone = '#859388', stoneLight = '#b9bda1';
  const brass = '#c7a76d', brassDark = '#8b704d', wood = '#8d694c';
  const foam = '#a6c8b6', water = '#587f7a';

  if (key === 'rift-open') {
    // A narrow tear grows from the instrument's water, not a square portal tile.
    const points = [[9, 3], [7, 7], [9, 10], [6, 14], [8, 17], [6, 21]];
    for (let index = 1; index < points.length; index++) {
      const [x, y] = points[index - 1], [tx, ty] = points[index];
      line('#b89dbe3b', x - 2, y, tx - 2, ty);
      line('#b89dbe3b', x + 2, y, tx + 2, ty);
      for (const offset of [-1, 0, 1]) line('#322f44', x + offset, y, tx + offset, ty);
      line('#9c89aa', x, y, tx, ty);
    }
    line('#615777', 8, 9, 13, 5);
    line('#9785a2', 8, 13, 3, 11);
    r('#ded0db', 8, 6, 1, 2); r('#d8c7d2', 7, 13); r('#c4bac9', 7, 18);
  } else if (key === 'rift-scar') {
    line('#354b50', 1, 20, 5, 18); line('#354b50', 5, 18, 10, 21); line('#354b50', 10, 21, 14, 19);
    line('#a5b6a1', 2, 21, 5, 19); line('#6d9389', 6, 20, 9, 22);
    r('#bac4a4', 10, 20, 2, 1); r('#778e80', 13, 20);
  } else if (key === 'survey-page') {
    // The curled waxed sheet sits under a small slate corner weight.
    r(shadow, 3, 21, 11, 2);
    r('#b69d76', 3, 12, 10, 9); r('#d8c49b', 2, 11, 10, 9);
    r('#f0ddb1', 3, 11, 8, 1); r('#efe0bd', 2, 12, 1, 6);
    r('#c4ac81', 10, 18, 3, 3); r('#ead4a4', 11, 19, 2, 1);
    line('#698984', 4, 14, 6, 16); line('#698984', 6, 16, 9, 13);
    r('#9e967b', 4, 18, 4, 1);
    r('#485d5e', 10, 10, 4, 3); r('#8a9588', 10, 10, 3, 1); r('#677b73', 12, 11, 2, 2);
  } else if (key === 'eddy-flow' || key === 'eddy-drained') {
    // Thin seams, a foaming drain lip and exposed pebbles reveal a current
    // below the boards while the existing floor remains visible between them.
    line('#3a5659', 2, 20, 6, 17); line('#3a5659', 6, 17, 12, 18);
    line('#3a5659', 12, 18, 13, 21); line('#698981', 3, 21, 6, 19);
    r('#8e9d8e', 10, 22, 3, 1);
    if (key === 'eddy-flow') {
      r(foam, 4, 18, 3, 1); r(water, 7, 16, 4, 1);
      r(foam, 11, 19, 2, 1); r(water, 7, 21, 4, 1); r(foam, 6, 22, 2, 1);
    } else {
      r('#a9ab8f', 5, 18, 2, 1); r('#879986', 9, 20); r('#b0ac8c', 3, 22);
    }
  } else if (key === 'channel-pull' || key === 'channel-calm') {
    line('#3a5659', 3, 22, 7, 18); line('#4c6e6a', 7, 18, 7, 13);
    line('#617d74', 11, 22, 13, 19);
    if (key === 'channel-pull') {
      r(foam, 7, 13, 2, 1); r(water, 9, 16, 4, 1);
      r(foam, 4, 19, 3, 1); r(water, 8, 21, 3, 1);
    } else {
      r(foam, 9, 22, 3, 1); r(water, 8, 18, 4, 1); r('#8ca99a', 6, 16, 2, 1);
    }
  } else if (key === 'timber-brace') {
    r(shadow, 2, 21, 12, 2);
    for (const offset of [0, 1, 2]) line('#55483c', 2 + offset, 20, 11 + offset, 10);
    line('#bd9a6b', 2, 20, 11, 10); line(wood, 4, 20, 13, 10);
    line('#d1b185', 3, 18, 5, 16); line('#b18b5e', 8, 14, 11, 11);
    r(ink, 2, 20, 4, 2); r('#8d9380', 2, 20, 3, 1); r(brassDark, 4, 21);
    r(ink, 10, 10, 3, 2); r('#a6a88c', 11, 10); r('#68533e', 13, 9);
  } else if (key === 'tincture-flask') {
    r(shadow, 5, 22, 7, 1);
    r(ink, 6, 9, 5, 3); r(wood, 7, 9, 3, 1); r('#cfb181', 7, 10, 3, 1);
    r(ink, 7, 12, 3, 3); r(brass, 7, 12, 3, 1);
    r(ink, 5, 14, 7, 7); r(ink, 6, 21, 5, 1);
    r('#827746', 6, 15, 5, 5); r('#b6a45e', 6, 18, 5, 2);
    r('#dfc881', 6, 15, 1, 4); r('#f0dda0', 7, 15); r('#d0b36a', 7, 20, 3, 1);
    r('#b6bf98', 8, 16, 2, 2); r('#536b5c', 9, 16, 1, 2);
  } else if (key === 'wayboard') {
    r(shadow, 2, 22, 12, 1);
    r('#53463c', 3, 13, 2, 10); r('#a78b62', 3, 14, 1, 8);
    r('#53463c', 11, 13, 2, 10); r('#8f7656', 11, 15, 1, 7);
    r(ink, 1, 6, 14, 11); r(wood, 2, 6, 12, 10); r('#c4a47a', 2, 6, 12, 1);
    r('#cbbb92', 3, 8, 10, 7); r('#ead5a2', 4, 8, 8, 1);
    line('#68847a', 4, 13, 7, 10); line('#68847a', 7, 10, 11, 12);
    r('#9a624c', 9, 12, 2, 1); r(brassDark, 2, 8); r(brassDark, 13, 14);
  } else if (key === 'survey-cuts') {
    for (const [x, y, height] of [[3, 16, 5], [7, 15, 7], [11, 17, 4]]) {
      r('#3d5657', x, y, 1, height); r('#a7b09b', x + 1, y + 1, 1, height - 1);
    }
    line('#526c67', 2, 20, 12, 18); r('#b0b39a', 12, 19);
  } else if (key === 'reed-tuft') {
    r(shadow, 2, 22, 12, 1);
    line('#425f4e', 7, 22, 2, 13); line('#8f9c60', 7, 21, 4, 14);
    line('#58734f', 7, 22, 8, 8); line('#9da36b', 8, 19, 9, 10);
    line('#688252', 8, 22, 13, 13); line('#a1a96d', 9, 21, 12, 15);
    r('#9c8055', 7, 7, 2, 4); r('#c2ab6c', 7, 7, 1, 2);
    r('#867650', 12, 11, 2, 4); r('#b4a76d', 12, 11, 1, 2);
    line('#385b4a', 9, 22, 14, 19);
  } else if (key === 'stone-steps') {
    // Worn shallow nosings; the unpainted gaps expose the real floor below.
    for (const [x, y, width] of [[5, 14, 6], [3, 17, 10], [1, 20, 14]]) {
      r('#4c6260', x, y + 1, width, 2); r(stone, x, y, width, 1);
      r(stoneLight, x + 1, y, Math.max(1, width - 3), 1);
    }
    r('#687e73', 13, 21); r('#9aab91', 2, 20);
  } else if (key === 'rope-coil') {
    r(shadow, 2, 22, 12, 1);
    r(brassDark, 3, 18, 10, 4); r('#c7aa76', 2, 19, 12, 2);
    r('#dcc18c', 4, 18, 8, 1); r('#a18b60', 4, 21, 8, 1);
    r('#826f53', 5, 19, 6, 2); r('#d7bd88', 5, 19, 5, 1); r('#3c5149', 7, 20, 3, 1);
    line('#baa374', 12, 19, 13, 15); line('#7e6c4e', 13, 15, 15, 14);
  } else if (key === 'rest-lantern') {
    r(shadow, 4, 22, 9, 1);
    line(ink, 5, 9, 6, 6); line(ink, 6, 6, 10, 6); line(ink, 10, 6, 11, 9);
    r(brassDark, 5, 9, 7, 2); r(brass, 6, 9, 5, 1);
    r(ink, 4, 11, 9, 9); r('#c5914f', 5, 12, 7, 6); r('#e4bb71', 6, 12, 5, 5);
    r('#fff0ba', 7, 13, 2, 3); r('#987647', 8, 11, 1, 8);
    r(brassDark, 4, 19, 9, 2); r(brass, 3, 21, 11, 1); r('#dcc18c', 5, 19, 6, 1);
  } else if (key === 'sluice-closed' || key === 'sluice-open') {
    // A hand-operated counterweight cabinet, distinct from the tide stair's
    // large wheel. The red grip moves down to drain; its weight rises inside.
    const open = key === 'sluice-open';
    r(shadow, 1, 22, 13, 1);
    r('#243b3f', 2, 4, 9, 18); r('#506c6b', 3, 5, 7, 16);
    r('#96a391', 3, 5, 1, 15); r('#6f8980', 4, 5, 5, 1);
    r('#203b40', 5, 8, 4, 12); r('#6b8379', 9, 8, 1, 12);
    // A little sheave and exposed chain remain visible through the open slot.
    r('#b49a67', 5, 7, 3, 3); r('#596d60', 6, 8); r('#d4bc85', 5, 7, 2, 1);
    r('#a9ac8d', 6, 10, 1, 9);
    const weightY = open ? 11 : 15;
    r('#303f40', 4, weightY, 5, 4); r('#899181', 5, weightY, 3, 3);
    r('#b4b49a', 5, weightY, 2, 1); r('#5b6f66', 7, weightY + 1, 1, 2);
    // Bolted feet and the pivot ground the machine on the existing stone.
    r('#2c4141', 1, 21, 11, 2); r('#7d8e7d', 2, 21, 3, 1); r('#7d8e7d', 8, 21, 3, 1);
    r('#b8ae84', 3, 22); r('#b8ae84', 9, 22);
    line('#263c40', 10, 15, 13, open ? 20 : 8);
    line('#8e9c89', 11, 15, 14, open ? 20 : 8);
    const gripY = open ? 20 : 7;
    r('#754f44', 12, gripY, 3, 3); r('#bb6f55', 12, gripY, 3, 2);
    r('#e0a17a', 12, gripY, 2, 1);
    r('#253d40', 9, 14, 3, 3); r('#b5b59a', 10, 15);
    r('#a4a58b', 3, 6); r('#85947e', 9, 6);
  }
  ctx.restore();
}
