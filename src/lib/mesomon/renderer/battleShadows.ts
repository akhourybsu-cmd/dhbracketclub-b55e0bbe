import type Phaser from 'phaser';
import { CREATURES } from '../assets';
import { BATTLE_CELL, BATTLE_POSES, BATTLE_RENDER_SCALE } from './battleMotion';

const KEY = 'ms:battle-shadows';
const WIDTH = 240, HEIGHT = 32;
const BASELINE = 180; // Paw line used by build-mesomon-creature-art.py.
const GROUND = 4;
const PROJECTION = 0.125;
const POSES = BATTLE_POSES.length;
const FACING_FRAMES = CREATURES.length * POSES;

export const BATTLE_SHADOW_FOOT = (BATTLE_CELL - BASELINE + GROUND) / BATTLE_RENDER_SCALE;

/** Project each actual pose onto the planks. Both landing shadows fall down
 * and to the right, including when the animal faces the other way. */
export function prepareBattleShadows(textures: Phaser.Textures.TextureManager): string | undefined {
  if (textures.exists(KEY)) return KEY;
  const sheet = textures.createCanvas(KEY, POSES * WIDTH, CREATURES.length * 2 * HEIGHT);
  if (!sheet) return;
  const source = textures.get('ms:battle').getSourceImage() as HTMLImageElement;
  const ctx = sheet.context;
  for (let frame = 0; frame < FACING_FRAMES * 2; frame++) {
    const mirrored = frame >= FACING_FRAMES;
    const column = frame % POSES, row = Math.floor(frame / POSES);
    const x = column * WIDTH, y = row * HEIGHT;
    ctx.save();
    // Initial offset centers the PNG's foot line inside the wider shadow cel.
    ctx.translate(x + (WIDTH - BATTLE_CELL) / 2 + (mirrored ? BATTLE_CELL : 0), y + GROUND);
    ctx.transform(mirrored ? -1 : 1, 0, -PROJECTION, -PROJECTION, BASELINE * PROJECTION, BASELINE * PROJECTION);
    ctx.drawImage(source, column * BATTLE_CELL, row % CREATURES.length * BATTLE_CELL, BATTLE_CELL, BATTLE_CELL,
      0, 0, BATTLE_CELL, BATTLE_CELL);
    ctx.restore();
    sheet.add(frame, 0, x, y, WIDTH, HEIGHT);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#17272d';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.restore();
  sheet.refresh();
  return KEY;
}

export function shadowFrame(frame: number, mirrored: boolean): number {
  return frame + (mirrored ? FACING_FRAMES : 0);
}
