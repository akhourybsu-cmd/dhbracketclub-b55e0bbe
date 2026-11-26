import { describe, expect, it } from 'vitest';
import { INTERACTION_ART, INTERACTION_ART_KEYS, interactionArtKey, paintInteractionArt, type InteractionArtKey } from './interactionsArt';

function canvas() {
  const pixels: (string | null)[] = Array(INTERACTION_ART.width * INTERACTION_ART.height).fill(null);
  const rects: number[][] = [];
  const saved: { fillStyle: string; globalAlpha: number; imageSmoothingEnabled: boolean }[] = [];
  const context = {
    fillStyle: '#123456', globalAlpha: 0.5, imageSmoothingEnabled: true,
    save() { saved.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha, imageSmoothingEnabled: this.imageSmoothingEnabled }); },
    restore() { Object.assign(this, saved.pop()); },
    clearRect(x: number, y: number, width: number, height: number) {
      for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) pixels[row * 16 + col] = null;
    },
    fillRect(x: number, y: number, width: number, height: number) {
      rects.push([x, y, width, height]);
      for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) pixels[row * 16 + col] = this.fillStyle;
    },
  };
  return { pixels, rects, context: context as unknown as CanvasRenderingContext2D };
}
function painted(key: InteractionArtKey) {
  const result = canvas();
  paintInteractionArt(result.context, key);
  return result;
}
const state = { sealed: false, sluiceOpen: false };

describe('transparent physical Mesomon interaction art', () => {
  it('selects state-specific physical marks without replacing actors or baked furniture', () => {
    expect(interactionArtKey({ id: 'rift' }, state)).toBe('rift-open');
    expect(interactionArtKey({ id: 'rift' }, { ...state, sealed: true })).toBe('rift-scar');
    expect(interactionArtKey({ id: 'sense-eddy' }, state)).toBe('eddy-flow');
    expect(interactionArtKey({ id: 'sense-eddy' }, { ...state, sluiceOpen: true })).toBe('eddy-drained');
    expect(interactionArtKey({ id: 'sense-channel' }, { ...state, sealed: true })).toBe('channel-calm');
    for (const id of ['captain', 'nia', 'tressel', 'chart', 'field-map', 'satchel-hook', 'workshop-note', 'kettle', 'workshop-door', 'gangplank', 'unknown-future-object'])
      expect(interactionArtKey({ id }, state)).toBeNull();
  });
  it('keeps all authored frames native, bounded and mostly transparent', () => {
    for (const key of INTERACTION_ART_KEYS) {
      const { pixels, rects, context } = painted(key);
      expect(rects.length).toBeGreaterThan(0);
      for (const [x, y, width, height] of rects) {
        expect([x, y, width, height].every(Number.isInteger)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0);
        expect(width).toBeGreaterThan(0); expect(height).toBeGreaterThan(0);
        expect(x + width).toBeLessThanOrEqual(16); expect(y + height).toBeLessThanOrEqual(24);
      }
      expect(pixels.filter(pixel => pixel === null).length).toBeGreaterThanOrEqual(384 * 0.45);
      for (const corner of [0, 15, 23 * 16, 24 * 16 - 1]) expect(pixels[corner]).toBeNull();
      expect(context.fillStyle).toBe('#123456');
      expect(context.globalAlpha).toBe(0.5);
      expect(context.imageSmoothingEnabled).toBe(true);
    }
  });
  it('clears reused texture pixels when an open rift becomes a sealed scar', () => {
    const result = painted('rift-open');
    paintInteractionArt(result.context, 'rift-scar');
    expect(result.pixels).toEqual(painted('rift-scar').pixels);
    expect(result.pixels.slice(0, 16 * 18).every(pixel => pixel === null)).toBe(true);
  });
  it('keeps a doorway genuinely open and stair returns separate from floor tiles', () => {
    const arch = painted('stone-doorway').pixels;
    for (const y of [8, 12, 16, 20]) expect(arch[y * 16 + 8]).toBeNull();
    expect(arch[21 * 16 + 8]).not.toBeNull();
    expect(interactionArtKey({ id: 'chamber-door' }, state)).toBe('stone-doorway');
    for (const id of ['passage-door', 'stairs-exit', 'passage-exit', 'chamber-exit']) expect(interactionArtKey({ id }, state)).toBe('stone-steps');
    const steps = painted('stone-steps').pixels;
    expect(steps.slice(0, 14 * 16).every(pixel => pixel === null)).toBe(true);
    expect(steps[14 * 16 + 1]).toBeNull();
  });
  it('removes active foam from the drained eddy while leaving its physical seam', () => {
    const active = painted('eddy-flow').pixels;
    const drained = painted('eddy-drained').pixels;
    expect(active).not.toEqual(drained);
    expect(active).toContain('#a6c8b6');
    expect(drained).not.toContain('#a6c8b6');
    expect(drained).toContain('#3a5659');
  });
  it('gives the underwharf sluice a counterweight cabinet with a state-aware red lever', () => {
    expect(interactionArtKey({ id: 'sluice' }, state)).toBe('sluice-closed');
    expect(interactionArtKey({ id: 'sluice' }, { ...state, sluiceOpen: true })).toBe('sluice-open');
    const closed = painted('sluice-closed').pixels;
    const open = painted('sluice-open').pixels;
    expect(open).not.toEqual(closed);
    expect(closed[7 * 16 + 12]).toBe('#e0a17a');
    expect(open[7 * 16 + 12]).toBeNull();
    expect(open[20 * 16 + 12]).toBe('#e0a17a');
    expect(closed[20 * 16 + 12]).toBeNull();
    expect(closed[15 * 16 + 5]).toBe('#b4b49a');
    expect(open[11 * 16 + 5]).toBe('#b4b49a');
    // The tide wheel retains its separate larger landmark; this is not reused.
    expect(interactionArtKey({ id: 'gate-wheel' }, state)).toBeNull();
  });
});
