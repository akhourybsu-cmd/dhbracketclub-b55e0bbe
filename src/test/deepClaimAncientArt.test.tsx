import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimAtlas } from '@/components/deepClaim/renderer/authoredAtlas';
import { DEEP_CLAIM_ADDON_METADATA as metadata, DEEP_CLAIM_ADDON_URL } from '@/components/deepClaim/renderer/ancientAtlas';
import * as addon from '@/components/deepClaim/renderer/ancientAtlas';
import { ancientTerrainKey, knownTerrainRegion, paintAncientTerrain, paintAncientTerrainSource } from '@/components/deepClaim/renderer/ancientArt';
import { DeepClaimEquipmentIcon, DeepClaimResourceIcon } from '@/components/deepClaim/renderer/DeepClaimIcons';
import { paintBuilding, paintTerrain, paintWorker } from '@/components/deepClaim/renderer/pixelArt';
import { DEEP_CLAIM_COMPOSITIONS } from '@/lib/deepClaim/audioScore';
import { DEEP_CLAIM_FORMATIONS, DEEP_CLAIM_MINERAL_IDS } from '@/lib/deepClaim/types';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function context() {
  const colors: string[] = [];
  return { fillStyle: '', fillRect: vi.fn(function (this: { fillStyle: string }) { colors.push(this.fillStyle); }), drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), strokeRect: vi.fn(), colors };
}

describe('Released v1 artwork and original score preservation', () => {
  it('preserves both released v1 runtime artifacts byte-for-byte', () => {
    expect(sha(readFileSync(resolve('public/deep-claim/atlas-v1.png')))).toBe('6bc1fbb52d3e1024d75917c5bfdc4f0ecd3ef53ad2d1220ed7a64db5a3a29180');
    expect(sha(readFileSync(resolve('src/components/deepClaim/renderer/generated/atlas-v1.json')))).toBe('702db8f28b67048f7f0823b5f2ee0df02b0eaaf545355e8fb198d1310a45695b');
  });
  it('retains every exact archived compiler input and the resolution-only dependency', () => {
    const base = resolve('art/deep-claim/v1-source'), archive = JSON.parse(readFileSync(resolve(base, 'archive.json'), 'utf8'));
    expect(archive.baseline).toBe('e2498e9a313a7d26c1b3eb4da6dbbf6548af42e9');
    expect(archive.sourceHash).toBe('bbba92feb41fc89a19c411dd33dd728a78a0e516fba0ba4a37d385ed84c5ece4');
    expect(archive.files).toHaveLength(12);
    for (const file of [...archive.files, ...archive.resolution_only_files]) expect(sha(readFileSync(resolve(base, file.path)))).toBe(file.sha256);
  });
  it('adds one score without changing any event, arrangement, name or timing in the five released themes', () => {
    const original = { surface: 'c96df0ebe9e86ddb3dc951939712f3a5f261fa231bfbef0e0009c085352a1c82', shallow: 'e233fce81703270342234d944a9d2ae2f00ca4e44ac81c6ed1703468ab37cfe9', ironworks: 'df324fbb2893c47e222c43fd6d3f70764a9a4f0bd9aba9ccfa422fb8c8921085', crystal: '47fca0492ab24d9bb49a972e0524295b6893878db1d189445f9950f830426ce6', forgotten: 'cc36d79dd43a2a6bf6ab72cda10787af17db87bee27428bb29b600750be2f530' };
    for (const [key, hash] of Object.entries(original)) expect(sha(JSON.stringify(DEEP_CLAIM_COMPOSITIONS[key]))).toBe(hash);
    expect(Object.keys(DEEP_CLAIM_COMPOSITIONS)).toHaveLength(6);
  });
});

describe('Bounded Ancient Deep authored add-on', () => {
  it('covers real minerals and all known room joins without a future shaft or processed-alloy terrain', () => {
    for (const material of DEEP_CLAIM_MINERAL_IDS) expect(metadata.frames[ancientTerrainKey(material, false, 0, true, null, 0)]).toBeDefined();
    for (const room of DEEP_CLAIM_FORMATIONS) for (let neighbors = 0; neighbors < 16; neighbors++) expect(metadata.frames[ancientTerrainKey(null, true, 0, true, room, neighbors)]).toBeDefined();
    expect(metadata.frames['deep:building:mine_shaft:6']).toBeDefined();
    expect(metadata.frames['deep:building:mine_shaft:7']).toBeUndefined();
    expect(Object.keys(metadata.frames).some(key => /nickel_alloy|1499/.test(key))).toBe(false);
  });
  it('keeps every frame in a separate compact image within the two-MiB decoded budget', () => {
    expect(metadata.version).toBe(2); expect(metadata.width).toBe(512); expect(metadata.height).toBeLessThanOrEqual(1024);
    expect(metadata.width * metadata.height * 4).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(metadata.pngBytes).toBeLessThanOrEqual(64 * 1024); expect(metadata.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    for (const frame of Object.values(metadata.frames)) {
      expect(frame.x).toBeGreaterThanOrEqual(1); expect(frame.y).toBeGreaterThanOrEqual(1);
      expect(frame.x + frame.width).toBeLessThan(metadata.width); expect(frame.y + frame.height).toBeLessThan(metadata.height);
    }
  });
  it('decodes and reports the add-on independently and emits ready/failure events without automatic retries', async () => {
    const image = { naturalWidth: metadata.width, naturalHeight: metadata.height, src: '', decode: vi.fn().mockResolvedValue(undefined), onload: null as (() => void) | null, onerror: null as (() => void) | null };
    const factory = vi.fn(() => image as unknown as HTMLImageElement), atlas = new DeepClaimAtlas(factory, 500, { metadata, url: DEEP_CLAIM_ADDON_URL }), states: string[] = [];
    const off = atlas.subscribe(() => states.push(atlas.getDiagnostics().state));
    const ready = atlas.preload(); expect(image.src).toBe('/deep-claim/atlas-v2.png'); image.onload!(); await expect(ready).resolves.toBe('ready');
    expect(states).toEqual(['loading', 'ready']); expect(atlas.getDiagnostics().decodedBytes).toBe(metadata.width * metadata.height * 4);
    const broken = { drawImage: () => { throw new Error('Lost image'); } } as unknown as CanvasRenderingContext2D;
    expect(atlas.draw(broken, 'deep:lift:cab', 0, 0)).toBe(false); expect(states).toEqual(['loading', 'ready', 'failed']);
    await expect(atlas.preload()).resolves.toBe('failed'); expect(factory).toHaveBeenCalledOnce(); off();
  });
  it('selects the new regional treatment only for a known public cell within the shipped depth band', () => {
    expect([0, 599, 600, 607, 608, 999, 1000].map(y => knownTerrainRegion({ y }))).toEqual(['legacy', 'legacy', 'ancient_deep', 'ancient_deep', 'ancient_deep', 'ancient_deep', 'legacy']);
    const old = context(), deep = context();
    vi.spyOn(addon, 'drawDeepClaimAddon').mockReturnValue(false);
    paintTerrain(old as unknown as CanvasRenderingContext2D, 0, 0, null);
    paintTerrain(deep as unknown as CanvasRenderingContext2D, 0, 0, null, false, 0, true, false, null, 0, 'ancient_deep');
    expect(old.colors).toContain('#414143'); expect(old.colors).not.toContain('#242b31'); expect(deep.colors).toContain('#242b31');
  });
  it('keeps unknown ore absent and joins only public open room faces in the load-failure fallback', () => {
    const empty = context(), nickel = context(), joined = context();
    paintAncientTerrainSource(empty as unknown as CanvasRenderingContext2D, 0, 0, null);
    paintAncientTerrainSource(nickel as unknown as CanvasRenderingContext2D, 0, 0, 'nickel_ore');
    expect(empty.colors).not.toContain('#829e88'); expect(nickel.colors).toContain('#829e88');
    paintAncientTerrainSource(joined as unknown as CanvasRenderingContext2D, 0, 0, null, true, 0, true, 'cavern', 15);
    expect(joined.fillRect).toHaveBeenCalledTimes(1);
  });
  it('uses the v2 image when ready and retains functional shaft and mineral artwork if loading fails', () => {
    const draw = vi.spyOn(addon, 'drawDeepClaimAddon').mockReturnValue(true), image = context();
    paintAncientTerrain(image as unknown as CanvasRenderingContext2D, 1, 2, 'sulfur');
    expect(draw).toHaveBeenCalledWith(expect.anything(), ancientTerrainKey('sulfur', false, 0, true, null, 0), 1, 2, 16, 16);
    expect(image.fillRect).not.toHaveBeenCalled();
    draw.mockReturnValue(false); const fallback = context(); paintBuilding(fallback as unknown as CanvasRenderingContext2D, 'mine_shaft', 6, 0, false);
    expect(fallback.colors).toContain('#526f70'); expect(fallback.colors).toContain('#d2d9bf');
  });
  it('gives the actual new goods and specialized heat shield readable identities including broken headgear', () => {
    render(<><DeepClaimResourceIcon resourceId="nickel_ore" /><DeepClaimResourceIcon resourceId="sulfur" /><DeepClaimResourceIcon resourceId="nickel_alloy" /><DeepClaimEquipmentIcon archetype="nickel_heatshield" durability={0} /></>);
    expect(screen.getAllByRole('img')).toHaveLength(4); expect(screen.getByRole('img', { name: 'Nickel alloy' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Broken Nickel heat shield' })).toHaveAttribute('data-dc-equipment-broken', 'true');
    const worker = context(); paintWorker(worker as unknown as CanvasRenderingContext2D, 48, 800, 'miner', 'idle', 0, 1, 0, false, { headTier: 3, headBroken: true });
    expect(worker.colors).toContain('#8c7655'); expect(worker.colors).toContain('#a65e3c');
  });
});
