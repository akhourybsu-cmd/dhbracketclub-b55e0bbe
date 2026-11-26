import type Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountBattleBackdrop } from './battleStage';

function stageFixture(cached = false) {
  const source = { naturalWidth: 640, naturalHeight: 576, src: '', onload: null as (() => void) | null,
    onerror: null as (() => void) | null, removeAttribute: vi.fn() };
  const loader = vi.fn(function () { return source; });
  vi.stubGlobal('Image', loader);
  let destroy = () => {};
  const fallback = { depth: 8000, fillStyle: vi.fn().mockReturnThis(), fillRect: vi.fn().mockReturnThis(),
    setVisible: vi.fn(), once: (_event: string, listener: () => void) => { destroy = listener; } };
  const plate = { setOrigin: vi.fn().mockReturnThis(), setDisplaySize: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(), destroy: vi.fn() };
  const scene = { add: { image: vi.fn(() => plate) }, game: {canvas: document.createElement('canvas')},
    textures: { exists: () => cached, addImage: vi.fn().mockReturnValue(true) } };
  mountBattleBackdrop(scene as unknown as Phaser.Scene, fallback as unknown as Phaser.GameObjects.Graphics, 'gleamwing-encounter', false);
  return { source, plate, scene, fallback, loader, destroy };
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('the loaded battle arena', () => {
  it('paints a field immediately, then mounts the plate at the same scale and removes it on departure', () => {
    const f = stageFixture();
    expect(f.fallback.fillRect).toHaveBeenCalled();
    expect(f.fallback.setVisible).not.toHaveBeenCalled();
    expect(f.source.src).toBe('/games/mesomon/battle-scenes-v1/gleamwing-encounter.webp');
    f.source.onload!();
    expect(f.plate.setDisplaySize).toHaveBeenCalledWith(160, 144);
    expect(f.scene.game.canvas.dataset.battleBackdrop).toBe('gleamwing-encounter');
    f.destroy();
    expect(f.plate.destroy).toHaveBeenCalledOnce();
    expect(f.scene.game.canvas.dataset.battleBackdrop).toBeUndefined();
  });

  it('retains the stage offline and cancels a pending image if the player leaves or it times out', () => {
    vi.useFakeTimers();
    for (const reason of ['offline', 'exit', 'timeout']) {
      const f = stageFixture();
      if (reason === 'offline') f.source.onerror!();
      if (reason === 'exit') f.destroy();
      if (reason === 'timeout') vi.advanceTimersByTime(12000);
      expect(f.source.onload).toBeNull();
      expect(f.fallback.setVisible).not.toHaveBeenCalled();
      expect(f.scene.add.image).not.toHaveBeenCalled();
    }
  });

  it('reuses the decoded plate when the fight is revisited', () => {
    const f = stageFixture(true);
    expect(f.loader).not.toHaveBeenCalled();
    expect(f.scene.add.image).toHaveBeenCalledOnce();
    f.destroy();
  });
});
