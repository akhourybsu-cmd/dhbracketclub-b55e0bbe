import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { CREATURES } from '../assets';
import { BATTLE_CELL, BATTLE_POSES } from './battleMotion';
import { prepareBattleShadows, shadowFrame } from './battleShadows';

describe('creature shadows on the encounter landings', () => {
  it('projects every pose in both directions while keeping the paws on the same ground line', () => {
    const ctx = { save: vi.fn(), restore: vi.fn(), transform: vi.fn(), translate: vi.fn(),
      drawImage: vi.fn(), fillRect: vi.fn(), globalCompositeOperation: '', fillStyle: '' };
    const sheet = { context: ctx, add: vi.fn(), refresh: vi.fn() };
    const source = {};
    const textures = { exists: vi.fn(() => false), createCanvas: vi.fn(() => sheet),
      get: () => ({ getSourceImage: () => source }) };
    const manager = textures as unknown as Phaser.Textures.TextureManager;
    expect(prepareBattleShadows(manager)).toBeTruthy();
    const count = CREATURES.length * BATTLE_POSES.length;
    expect(sheet.add).toHaveBeenCalledTimes(count * 2);
    for (let i = 0; i < count; i++) {
      const front = shadowFrame(i, false), back = shadowFrame(i, true);
      expect(ctx.drawImage.mock.calls[front]).toEqual(ctx.drawImage.mock.calls[back]);
      const [,, skewX, skewY, dx, dy] = ctx.transform.mock.calls[front];
      expect(skewX * 180 + dx).toBe(0);
      expect(skewY * 180 + dy).toBe(0);
      expect(skewX * 30 + dx).toBeGreaterThan(0);
      expect(skewY * 30 + dy).toBeGreaterThan(0);
      const [direction, ...projection] = ctx.transform.mock.calls[back];
      expect(direction).toBe(-1);
      expect(projection).toEqual(ctx.transform.mock.calls[front].slice(1));
      expect(ctx.drawImage.mock.calls[front]).toEqual([source, i % BATTLE_POSES.length * BATTLE_CELL,
        Math.floor(i / BATTLE_POSES.length) * BATTLE_CELL, BATTLE_CELL, BATTLE_CELL, 0, 0, BATTLE_CELL, BATTLE_CELL]);
    }
    expect(ctx.globalCompositeOperation).toBe('source-in');
    expect(sheet.refresh).toHaveBeenCalledOnce();
    textures.exists.mockReturnValue(true);
    prepareBattleShadows(manager);
    expect(textures.createCanvas).toHaveBeenCalledOnce();
  });
});
