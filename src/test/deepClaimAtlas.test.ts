import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimAtlas, DEEP_CLAIM_ATLAS_METADATA as metadata, DEEP_CLAIM_ATLAS_URL } from '@/components/deepClaim/renderer/authoredAtlas';
import * as atlasModule from '@/components/deepClaim/renderer/authoredAtlas';
import { BUILDING_ART } from '@/components/deepClaim/renderer/artManifest';
import { paintBuilding, paintTerrain, paintWorker, terrainSpriteKey } from '@/components/deepClaim/renderer/pixelArt';
import { DEEP_CLAIM_DISCOVERY_KINDS, DEEP_CLAIM_DISCOVERY_QUALITIES, DEEP_CLAIM_FORMATIONS, DEEP_CLAIM_INFRASTRUCTURE_KEYS, DEEP_CLAIM_LEGACY_MINERAL_IDS, DEEP_CLAIM_SPECIALTIES } from '@/lib/deepClaim/types';

class ImageStub {
  naturalWidth = metadata.width; naturalHeight = metadata.height; decoding = ''; src = '';
  onload: (() => void) | null = null; onerror: (() => void) | null = null;
  decode = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
}
function setup(timeout = 1000) {
  const image = new ImageStub(), factory = vi.fn(() => image as unknown as HTMLImageElement);
  return { image, factory, atlas: new DeepClaimAtlas(factory, timeout) };
}
function context() {
  const colors: string[] = [];
  return { fillStyle: '', fillRect: vi.fn(function (this: { fillStyle: string }) { colors.push(this.fillStyle); }), drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), strokeRect: vi.fn(), colors };
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('Deep Claim authored atlas loading and fallback', () => {
  it('does not create or fetch an image before explicit preload and coalesces concurrent loads', async () => {
    const { atlas, image, factory } = setup();
    expect(factory).not.toHaveBeenCalled(); expect(atlas.getDiagnostics().state).toBe('idle');
    const first = atlas.preload(), second = atlas.preload();
    expect(first).toBe(second); expect(factory).toHaveBeenCalledOnce();
    expect(image.src).toBe(DEEP_CLAIM_ATLAS_URL); expect(image.decoding).toBe('async');
    image.onload!(); await expect(first).resolves.toBe('ready');
  });

  it('waits for actual image decode and notifies subscribers so reduced-motion canvases can redraw', async () => {
    const { atlas, image } = setup(), states: string[] = [];
    let decoded!: () => void; image.decode.mockImplementation(() => new Promise(resolve => { decoded = resolve; }));
    const unsubscribe = atlas.subscribe(() => states.push(atlas.getDiagnostics().state));
    const loaded = atlas.preload(); image.onload!();
    expect(atlas.getDiagnostics().state).toBe('loading'); expect(states).toEqual(['loading']);
    decoded(); await expect(loaded).resolves.toBe('ready');
    expect(states).toEqual(['loading', 'ready']);
    expect(atlas.getDiagnostics().decodedBytes).toBe(metadata.width * metadata.height * 4);
    unsubscribe();
    const broken = { drawImage: () => { throw new Error('Context lost'); } } as unknown as CanvasRenderingContext2D;
    atlas.draw(broken, 'building:mine_office:1', 0, 0);
    expect(states).toEqual(['loading', 'ready']);
  });

  it('returns graceful terminal failure for a blocked network request without an automatic retry loop', async () => {
    const { atlas, image, factory } = setup();
    const loaded = atlas.preload(); image.onerror!();
    await expect(loaded).resolves.toBe('failed');
    await expect(atlas.preload()).resolves.toBe('failed');
    expect(factory).toHaveBeenCalledOnce(); expect(atlas.getDiagnostics().decodedBytes).toBe(0);
    expect(atlas.draw(context() as unknown as CanvasRenderingContext2D, 'building:mine_office:1', 0, 0)).toBe(false);
    expect(image.onload).toBeNull(); expect(image.onerror).toBeNull();
  });

  it('falls back if decode rejects or a network response contains an incorrect image size', async () => {
    const badDecode = setup(); badDecode.image.decode.mockRejectedValue(new Error('Invalid PNG'));
    const decodeLoad = badDecode.atlas.preload(); badDecode.image.onload!(); await expect(decodeLoad).resolves.toBe('failed');
    const wrongSize = setup(); wrongSize.image.naturalWidth = 1;
    const wrongLoad = wrongSize.atlas.preload(); wrongSize.image.onload!(); await expect(wrongLoad).resolves.toBe('failed');
    expect(wrongSize.image.decode).not.toHaveBeenCalled();
  });

  it('bounds a stalled load and ignores a decode that resolves after its timeout', async () => {
    vi.useFakeTimers(); const { atlas, image } = setup(500);
    let decoded!: () => void; image.decode.mockImplementation(() => new Promise(resolve => { decoded = resolve; }));
    const loaded = atlas.preload(); image.onload!();
    await vi.advanceTimersByTimeAsync(500); await expect(loaded).resolves.toBe('failed');
    decoded(); await Promise.resolve(); expect(atlas.getDiagnostics().state).toBe('failed');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handles unavailable image APIs without throwing or starting timer retries', async () => {
    const atlas = new DeepClaimAtlas(() => { throw new Error('Image unavailable'); });
    await expect(atlas.preload()).resolves.toBe('failed');
    expect(atlas.getDiagnostics().state).toBe('failed');
  });

  it('uses bounded atlas source rectangles and logical destinations without enabling image smoothing', async () => {
    const { atlas, image } = setup(), rendered = context();
    const ready = atlas.preload(); image.onload!(); await ready;
    const key = 'worker:miner:walk:0:1', frame = metadata.frames[key];
    expect(atlas.draw(rendered as unknown as CanvasRenderingContext2D, key, -12, -28, 24, 32)).toBe(true);
    expect(rendered.drawImage).toHaveBeenCalledExactlyOnceWith(image, frame.x, frame.y, frame.width, frame.height, -12, -28, 24, 32);
    expect(atlas.draw(rendered as unknown as CanvasRenderingContext2D, 'unknown:sprite', 0, 0)).toBe(false);
    expect(atlas.draw(rendered as unknown as CanvasRenderingContext2D, key, Number.NaN, 0)).toBe(false);
    expect(atlas.getDiagnostics().draws).toBe(1);
  });

  it('keeps terminal state consistent after drawing fails even when an earlier preload resolved ready', async () => {
    const { atlas, image, factory } = setup(); const ready = atlas.preload(); image.onload!(); await expect(ready).resolves.toBe('ready');
    const failedContext = { drawImage: () => { throw new Error('Invalid image state'); } } as unknown as CanvasRenderingContext2D;
    expect(atlas.draw(failedContext, 'building:mine_office:1', 0, 0)).toBe(false);
    expect(atlas.getDiagnostics().state).toBe('failed');
    await expect(atlas.preload()).resolves.toBe('failed');
    expect(factory).toHaveBeenCalledOnce(); expect(atlas.getDiagnostics().draws).toBe(0);
  });
});

describe('Deep Claim authored pack coverage and authoritative visual layers', () => {
  it('registers every real building upgrade, seven roles with four appearances and frames, and no inventory goods as terrain', () => {
    for (const id of Object.keys(BUILDING_ART)) {
      const minimum = ['mine_office','mine_shaft','warehouse','tool_station'].includes(id) ? 1 : 0;
      for (let level = minimum; level <= (id === 'mine_shaft' ? 5 : id === 'research_office' ? 2 : 3); level++) expect(metadata.frames[`building:${id}:${level}`]).toBeDefined();
    }
    for (const role of DEEP_CLAIM_SPECIALTIES) for (const pose of ['idle','walk','mine','haul','setup','survey','build']) for (let appearance = 0; appearance < 4; appearance++) for (let frame = 0; frame < 4; frame++) expect(metadata.frames[`worker:${role}:${pose}:${appearance}:${frame}`]).toMatchObject({ width: 24, height: 32 });
    expect(Object.keys(metadata.frames).filter(key => key.startsWith('worker:'))).toHaveLength(784);
    for (const material of DEEP_CLAIM_LEGACY_MINERAL_IDS) expect(metadata.frames[terrainSpriteKey(material, false, 0, true, false, null, 0)]).toBeDefined();
    expect(Object.keys(metadata.frames).some(key => key.startsWith('terrain:') && /_bar|cut_amethyst|polished_quartz/.test(key))).toBe(false);
  });

  it('covers all known room joins, construction/installed infrastructure grades, and actual find qualities', () => {
    for (const room of DEEP_CLAIM_FORMATIONS) for (let neighbors = 0; neighbors < 16; neighbors++) expect(metadata.frames[terrainSpriteKey(null, true, 0, true, false, room, neighbors)]).toBeDefined();
    for (const key of DEEP_CLAIM_INFRASTRUCTURE_KEYS) for (let grade = 1; grade <= 3; grade++) for (let installed = 0; installed <= 1; installed++) for (let frame = 0; frame <= 1; frame++) expect(metadata.frames[`infrastructure:${key}:${grade}:${installed}:${frame}`]).toBeDefined();
    for (const kind of DEEP_CLAIM_DISCOVERY_KINDS) for (const quality of DEEP_CLAIM_DISCOVERY_QUALITIES) expect(metadata.frames[`discovery:${kind}:${quality}`]).toMatchObject({ width: 18, height: 18 });
  });

  it('keeps every registered rectangle inside the declared image and its fixed decoded memory budget', () => {
    expect(metadata.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(metadata.width).toBe(1024); expect(metadata.height).toBeLessThanOrEqual(2048);
    expect(metadata.width * metadata.height * 4).toBeLessThanOrEqual(8 * 1024 * 1024);
    for (const frame of Object.values(metadata.frames)) {
      expect(frame.x).toBeGreaterThanOrEqual(1); expect(frame.y).toBeGreaterThanOrEqual(1);
      expect(frame.x + frame.width).toBeLessThan(metadata.width); expect(frame.y + frame.height).toBeLessThan(metadata.height);
    }
    expect(new DeepClaimAtlas().getDiagnostics().spriteCount).toBe(Object.keys(metadata.frames).length);
  });

  it('uses one image for static building bases while actual paid activity and ready status remain explicit overlays', () => {
    const draw = vi.spyOn(atlasModule, 'drawAuthoredSprite').mockReturnValue(true), idle = context(), working = context();
    paintBuilding(idle as unknown as CanvasRenderingContext2D, 'smeltery', 2, 1000, false);
    paintBuilding(working as unknown as CanvasRenderingContext2D, 'smeltery', 2, 1000, false, false, { working: true, ready: false });
    expect(draw).toHaveBeenCalledWith(expect.anything(), 'building:smeltery:2', expect.any(Number), expect.any(Number), 144, 136);
    expect(idle.colors).not.toContain('#eed08c'); expect(working.colors).toContain('#eed08c');
    expect(working.colors).not.toContain('#b59b60');
    expect(idle.fillRect.mock.calls.length).toBeLessThan(5);
  });

  it('layers actual assigned broken gear over the correct role and appearance without showing extraction debris for survey work', () => {
    const draw = vi.spyOn(atlasModule, 'drawAuthoredSprite').mockReturnValue(true), surveyed = context();
    paintWorker(surveyed as unknown as CanvasRenderingContext2D, 48, 20, 'geologist', 'survey', 660, -1, 3, true, { utility: 'survey', utilityTier: 2, utilityBroken: true });
    expect(draw).toHaveBeenCalledWith(expect.anything(), 'worker:geologist:survey:3:3', -12, -28, 24, 32);
    expect(surveyed.scale).toHaveBeenCalledWith(-1, 1);
    expect(surveyed.colors).toContain('#8a684a'); expect(surveyed.colors).not.toContain('#d2b374');
    const mining = context(); paintWorker(mining as unknown as CanvasRenderingContext2D, 48, 20, 'miner', 'mine', 0, 1, 0, false, { toolTier: 3, toolBroken: true });
    expect(mining.colors).toContain('#8c5a40');
  });

  it('keeps the same source-art fallback fully usable when the atlas is unavailable', () => {
    vi.spyOn(atlasModule, 'drawAuthoredSprite').mockReturnValue(false);
    const building = context(), terrain = context();
    paintBuilding(building as unknown as CanvasRenderingContext2D, 'research_office', 0, 0, false);
    paintTerrain(terrain as unknown as CanvasRenderingContext2D, 0, 0, 'gold_ore');
    expect(building.colors).toContain('#b29b68'); expect(terrain.fillRect).toHaveBeenCalled();
    expect(building.drawImage).not.toHaveBeenCalled(); expect(terrain.drawImage).not.toHaveBeenCalled();
  });
});
