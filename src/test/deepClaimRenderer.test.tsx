import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimCanvas } from '@/components/deepClaim/renderer/DeepClaimCanvas';
import { DeepClaimBusinessIcon, DeepClaimDiscoveryIcon, DeepClaimEquipmentIcon, DeepClaimInfrastructureIcon, DeepClaimPortrait, DeepClaimResourceIcon } from '@/components/deepClaim/renderer/DeepClaimIcons';
import { BUILDING_ART, DEEP_CLAIM_ART_MANIFEST, EQUIPMENT_ART, RESOURCE_ART } from '@/components/deepClaim/renderer/artManifest';
import { constrainCamera, fitSurfaceCamera, mineToScreen, panMine, screenToMine, visibleMineCells, zoomMineAt } from '@/components/deepClaim/renderer/camera';
import { paintBuilding, paintTerrain, paintWorker } from '@/components/deepClaim/renderer/pixelArt';
import { buildingActivity, workerEquipmentPaint } from '@/components/deepClaim/renderer/productionVisuals';
import { fieldMarkerAt, indexPublicField, infrastructureInstalled, knownRoomNeighbors, visibleFieldEntries } from '@/components/deepClaim/renderer/fieldVisuals';
import { DISCOVERY_ART, infrastructureSprite } from '@/components/deepClaim/renderer/fieldSprites';
import { paintInfrastructureCoverage } from '@/components/deepClaim/renderer/fieldAtlas';
import { ALL_EQUIPMENT_CATALOG, BUILDING_INFO, EQUIPMENT_CATALOG, FIELD_CATALOG } from '@/lib/deepClaim/catalog';
import { DEEP_CLAIM_BUILDING_IDS, DEEP_CLAIM_DISCOVERY_KINDS, DEEP_CLAIM_FORMATIONS, DEEP_CLAIM_INFRASTRUCTURE_KEYS, DEEP_CLAIM_MINERAL_IDS, DEEP_CLAIM_RESOURCE_IDS, DEEP_CLAIM_SPECIALTIES, type DeepClaimDiscovery, type DeepClaimExpedition, type DeepClaimInfrastructure, type DeepClaimProductionJob, type DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { companySnapshot } from './fixtures/deepClaim';
import type { DeepClaimAudio } from '@/lib/deepClaim/audio';

vi.mock('@/components/deepClaim/renderer/authoredAtlas', () => ({ preloadDeepClaimAtlas: () => Promise.resolve('failed'), subscribeDeepClaimAtlas: () => () => {}, getDeepClaimAtlasDiagnostics: () => ({ state: 'failed', width: 0, height: 0, spriteCount: 0, decodedBytes: 0, draws: 0 }), drawAuthoredSprite: () => false }));

const viewport = { width: 390, height: 500 }, bounds = { width: 96, depth: 149 };
const legacyBuildingArt = ['mine_office','mine_shaft','warehouse','tool_station'].map(key => BUILDING_ART[key as keyof typeof BUILDING_ART]);
const phase2BuildingKeys = ['mine_office','mine_shaft','warehouse','tool_station','workers_quarters','smeltery','gem_workshop'] as const;
const contexts: MockContext[] = [];
class MockContext {
  fillStyle: string | CanvasGradient | CanvasPattern = ''; strokeStyle = ''; lineWidth = 1; imageSmoothingEnabled = true;
  fills: string[] = []; images: unknown[] = [];
  setTransform = vi.fn(); save = vi.fn(); restore = vi.fn(); translate = vi.fn(); scale = vi.fn(); strokeRect = vi.fn(); fillText = vi.fn();
  beginPath = vi.fn(); moveTo = vi.fn(); lineTo = vi.fn(); closePath = vi.fn(); fill = vi.fn(); stroke = vi.fn(); setLineDash = vi.fn();
  fillRect = vi.fn(() => this.fills.push(String(this.fillStyle)));
  drawImage = vi.fn((image: unknown) => this.images.push(image));
  constructor() { contexts.push(this); }
}
const frames = new Map<number, FrameRequestCallback>();
let frameTime = 0;
let frameId = 0, visibility: DocumentVisibilityState = 'visible';
const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
const box = { ...viewport, x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 500, toJSON: () => ({}) };
function frame(at = 1000) { act(() => { const elapsed = Math.max(0, at - frameTime); frameTime = at; vi.advanceTimersByTime(elapsed); const queue = [...frames.values()]; frames.clear(); queue.forEach(callback => callback(at)); }); }
function pointer(element: HTMLElement, type: string, x: number, y: number, pointerId = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId, clientX: x, clientY: y, pointerType: 'touch', isPrimary: pointerId === 1 }); fireEvent(element, event);
}
beforeEach(() => {
  contexts.length = 0; frames.clear(); frameId = 0; frameTime = 0; visibility = 'visible';
  vi.useFakeTimers({ toFake: ['setTimeout','clearTimeout'] });
  vi.spyOn(performance, 'now').mockImplementation(() => frameTime);
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(box);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () { return new MockContext() as unknown as CanvasRenderingContext2D; } as unknown as typeof HTMLCanvasElement.prototype.getContext);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); frames.clear();
  if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility); else delete (document as unknown as Record<string, unknown>).visibilityState;
});

describe('Deep Claim viewport geometry', () => {
  it('keeps zoom anchored beneath a finger and round-trips logical coordinates independently of pixels', () => {
    const camera = { x: 48, y: 40, scale: 18 }, anchor = { x: 80, y: 190 };
    const before = screenToMine(anchor, camera, viewport), next = zoomMineAt(camera, 1.6, anchor, viewport, bounds);
    expect(screenToMine(anchor, next, viewport)).toEqual(before);
    const rendered = mineToScreen({ x: 52, y: 37 }, next, viewport);
    expect(screenToMine(rendered, next, viewport).x).toBeCloseTo(52);
    expect(screenToMine(rendered, next, viewport).y).toBeCloseTo(37);
  });
  it('bounds camera panning and visits only viewport cells, with expandable deep coordinates', () => {
    const camera = constrainCamera({ x: -500, y: 100_000, scale: 90 }, viewport, { width: 96, depth: 20_000 });
    expect(camera.scale).toBe(46); expect(camera.x).toBeGreaterThanOrEqual(0); expect(camera.y).toBeLessThanOrEqual(20_008);
    const cells = visibleMineCells({ x: 48, y: 60, scale: 25 }, viewport, bounds);
    expect(cells.maxX - cells.minX).toBeLessThan(20); expect(cells.maxY - cells.minY).toBeLessThan(25);
    expect(panMine({ x: 48, y: 40, scale: 20 }, { x: 40, y: -40 }, viewport, bounds)).toMatchObject({ x: 46, y: 42 });
  });
  it('fits all four owned buildings inside twelve-pixel margins on a small phone and desktop, preserving the closer mine zoom floor', () => {
    const buildings = legacyBuildingArt;
    for (const size of [{ width: 320, height: 440 }, { width: 1440, height: 800 }]) {
      const camera = fitSurfaceCamera(size, bounds, buildings);
      for (const building of buildings) {
        expect(mineToScreen({ x: building.x, y: 0 }, camera, size).x).toBeGreaterThanOrEqual(12 - .001);
        expect(mineToScreen({ x: building.x + building.width, y: 0 }, camera, size).x).toBeLessThanOrEqual(size.width - 12 + .001);
      }
      expect(zoomMineAt(camera, .001, { x: size.width / 2, y: size.height / 2 }, size, bounds).scale).toBe(4);
    }
    expect(zoomMineAt({ x: 48, y: 6, scale: 25 }, .001, { x: 160, y: 220 }, { width: 320, height: 440 }, bounds).scale).toBe(6);
  });
});

describe('Original pixel artwork and authoritative viewport', () => {
  it('renders each launch resource and all seven specialty portraits as local, named pixel art', () => {
    const { container } = render(<>{DEEP_CLAIM_RESOURCE_IDS.map(resourceId => <DeepClaimResourceIcon resourceId={resourceId} key={resourceId} />)}{DEEP_CLAIM_SPECIALTIES.map(specialty => <DeepClaimPortrait specialty={specialty} key={specialty} />)}</>);
    const total = DEEP_CLAIM_RESOURCE_IDS.length + DEEP_CLAIM_SPECIALTIES.length;
    expect(screen.getAllByRole('img')).toHaveLength(total);
    expect(new Set(screen.getAllByRole('img').map(image => image.getAttribute('aria-label'))).size).toBe(total);
    expect(container.querySelector('image,img')).toBeNull();
    for (const id of Object.keys(BUILDING_ART) as (keyof typeof BUILDING_ART)[]) expect(BUILDING_ART[id].x + BUILDING_ART[id].width / 2).toBe(BUILDING_INFO[id].x);
  });
  it('changes the actual pixel silhouette/materials at each supported building upgrade level', () => {
    const first = new MockContext(), second = new MockContext(), third = new MockContext();
    paintBuilding(first as unknown as CanvasRenderingContext2D, 'mine_office', 1, 0, false);
    paintBuilding(second as unknown as CanvasRenderingContext2D, 'mine_office', 2, 0, false);
    paintBuilding(third as unknown as CanvasRenderingContext2D, 'mine_office', 3, 0, false);
    expect(first.fills).not.toContain('#c19a62'); expect(second.fills).toContain('#c19a62'); expect(third.fills).toContain('#8a9590');
    expect(second.fillRect.mock.calls.length).toBeGreaterThan(first.fillRect.mock.calls.length);
  });
  it('paints only revealed in-view mineral textures and never creates offscreen or hidden deposits', () => {
    const snapshot = companySnapshot();
    snapshot.world!.tiles.push({ x: 48, y: 4, terrain: 'stone', material: 'copper_ore', remaining: 10, initial_amount: 10 }, { x: 0, y: 48, terrain: 'stone', material: 'quartz', remaining: 10, initial_amount: 10 });
    const original = JSON.stringify(snapshot);
    render(<DeepClaimCanvas snapshot={snapshot} view="mine" selectedTile={null} onSelectTile={vi.fn()} onSelectBuilding={vi.fn()} />);
    frame(); frame(2000);
    const colors = contexts.flatMap(context => context.fills);
    expect(colors).toContain(RESOURCE_ART.copper_ore.mid); expect(colors).not.toContain(RESOURCE_ART.quartz.mid);
    expect(JSON.stringify(snapshot)).toBe(original);
    expect(screen.getByTestId('deep-claim-canvas').tagName).toBe('CANVAS');
    expect(document.querySelectorAll('canvas')).toHaveLength(1);
  });
  it('selects logical mine coordinates, suppresses selection during a drag and uses shared building hitboxes', () => {
    const tile = vi.fn(), building = vi.fn();
    render(<DeepClaimCanvas snapshot={companySnapshot()} view="mine" selectedTile={null} onSelectTile={tile} onSelectBuilding={building} reducedMotion />);
    const canvas = screen.getByTestId('deep-claim-canvas');
    pointer(canvas, 'pointerdown', 195, 250); pointer(canvas, 'pointerup', 195, 250);
    expect(tile).toHaveBeenCalledExactlyOnceWith({ x: 48, y: 4 });
    pointer(canvas, 'pointerdown', 195, 250); pointer(canvas, 'pointermove', 240, 260); pointer(canvas, 'pointerup', 240, 260);
    expect(tile).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Focus surface buildings' }));
    const office = mineToScreen({ x: 24, y: -2 }, fitSurfaceCamera(viewport, { width: 96, depth: 49 }, legacyBuildingArt), viewport);
    pointer(canvas, 'pointerdown', office.x, office.y); pointer(canvas, 'pointerup', office.x, office.y);
    expect(building).toHaveBeenCalledExactlyOnceWith('mine_office');
  });
  it('offers keyboard and full-size focus/zoom controls while never dispatching work from an animation', () => {
    const tile = vi.fn(), building = vi.fn();
    render(<DeepClaimCanvas snapshot={companySnapshot()} view="mine" selectedTile={null} onSelectTile={tile} onSelectBuilding={building} />);
    const canvas = screen.getByTestId('deep-claim-canvas');
    fireEvent.keyDown(canvas, { key: 'ArrowDown' }); fireEvent.keyDown(canvas, { key: '+' }); fireEvent.keyDown(canvas, { key: 'Home' });
    fireEvent.click(screen.getByRole('button', { name: 'Focus crew' }));
    expect(screen.getByText(/Worker a, idle, depth 0 metres/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom into mine' })); fireEvent.click(screen.getByRole('button', { name: 'Zoom out of mine' }));
    frame(); expect(tile).not.toHaveBeenCalled(); expect(building).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Mine view controls' }).querySelectorAll('button')).toHaveLength(4);
  });
  it('stops animation frames when hidden/inactive and paints one frame per update under reduced motion', () => {
    const snapshot = companySnapshot(), props = { snapshot, view: 'mine' as const, selectedTile: null, onSelectTile: vi.fn(), onSelectBuilding: vi.fn() };
    const root = render(<DeepClaimCanvas {...props} reducedMotion />);
    frame(); expect(frames.size).toBe(0);
    root.rerender(<DeepClaimCanvas {...props} reducedMotion selectedTile={{ x: 48, y: 2 }} />);
    expect(frames.size).toBe(1); frame(); expect(frames.size).toBe(0);
    root.rerender(<DeepClaimCanvas {...props} />); frame(); expect(frames.size + vi.getTimerCount()).toBe(1);
    act(() => { visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
    expect(frames.size).toBe(0);
    root.rerender(<DeepClaimCanvas {...props} active={false} />);
    act(() => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
    expect(frames.size).toBe(0);
    root.rerender(<DeepClaimCanvas {...props} active />); expect(frames.size).toBe(1);
    root.unmount(); expect(frames.size).toBe(0);
  });
  it('provides a truthful operational fallback without running an animation loop when Canvas2D is unavailable', () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    render(<DeepClaimCanvas snapshot={companySnapshot()} view="mine" selectedTile={null} onSelectTile={vi.fn()} onSelectBuilding={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Your company and operation controls remain available.');
    expect(frames.size).toBe(0);
  });
  it('resumes a saved audio opt-in only from an explicit map interaction, never a rendered frame', () => {
    let enabled = true;
    const audio = { getSnapshot: () => ({ master: enabled }), unlock: vi.fn().mockResolvedValue(true), play: vi.fn() };
    render(<DeepClaimCanvas snapshot={companySnapshot()} view="mine" selectedTile={null} onSelectTile={vi.fn()} onSelectBuilding={vi.fn()} audio={audio as unknown as DeepClaimAudio} />);
    frame(); expect(audio.unlock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom into mine' })); expect(audio.unlock).toHaveBeenCalledTimes(1);
    enabled = false;
    const canvas = screen.getByTestId('deep-claim-canvas'); pointer(canvas, 'pointerdown', 195, 250); pointer(canvas, 'pointerup', 195, 250);
    expect(audio.unlock).toHaveBeenCalledTimes(1);
  });
});

function phase2Snapshot(): DeepClaimSnapshot {
  const snapshot = companySnapshot();
  return { ...snapshot, schema_version: 2, buildings: phase2BuildingKeys.map(key => ({ key, level: ['workers_quarters','smeltery','gem_workshop'].includes(key) ? 0 : 1, max_level: key === 'mine_shaft' ? 4 : 3, upgrade_cost: 90, effect: 'Actual building effect.' })),
    equipment: [], production_jobs: [], equipment_catalog: [...EQUIPMENT_CATALOG], recipes: [], candidates: [] };
}
function processing(status: DeepClaimProductionJob['status'] = 'active'): DeepClaimProductionJob {
  return { id: 'production-a', recipe_key: 'smelt_copper', recipe_version: 1, station: 'smeltery', batches: 1, status,
    started_at: '2026-11-01T12:00:00Z', completes_at: '2026-11-01T12:05:00Z', duration_seconds: 300,
    cash_cost: 2, inputs: { copper_ore: 4, coal: 1 }, outputs: { copper_bar: 1 }, equipment_outputs: [] };
}

describe('Deep Claim Phase 2 industry artwork and compatibility', () => {
  it('keeps processed stock out of the mineral manifest and gives refined bars and cut gems distinct silhouettes', () => {
    for (const id of DEEP_CLAIM_MINERAL_IDS) expect(DEEP_CLAIM_ART_MANIFEST.terrain).toContain(`deposit_${id}`);
    for (const id of ['copper_bar','tin_bar','iron_bar','silver_bar','polished_quartz','cut_amethyst','bronze_bar','steel_bar','gold_bar']) expect(DEEP_CLAIM_ART_MANIFEST.terrain).not.toContain(`deposit_${id}`);
    const { container } = render(<><DeepClaimResourceIcon resourceId="copper_ore" /><DeepClaimResourceIcon resourceId="copper_bar" /><DeepClaimResourceIcon resourceId="amethyst" /><DeepClaimResourceIcon resourceId="cut_amethyst" /></>);
    const silhouettes = [...container.querySelectorAll('svg')].map(svg => [...svg.querySelectorAll('path')].map(path => path.getAttribute('d')).join('|'));
    expect(silhouettes[0]).not.toBe(silhouettes[1]); expect(silhouettes[2]).not.toBe(silhouettes[3]);
  });
  it('covers every actual equipment definition with five original archetypes and a readable broken state', () => {
    expect(Object.keys(EQUIPMENT_ART).sort()).toEqual(ALL_EQUIPMENT_CATALOG.map(item => item.key).sort());
    const { container } = render(<>{ALL_EQUIPMENT_CATALOG.map(item => <DeepClaimEquipmentIcon key={item.key} archetype={item.key} tier={item.tier} durability={item.key === 'iron_pickaxe' ? 0 : 10} />)}</>);
    expect(container.querySelectorAll('svg')).toHaveLength(ALL_EQUIPMENT_CATALOG.length);
    expect(new Set([...container.querySelectorAll('[data-dc-equipment-art]')].map(svg => svg.getAttribute('data-dc-equipment-art'))).size).toBe(5);
    expect(screen.getByRole('img', { name: 'Broken Iron pickaxe' })).toHaveAttribute('data-dc-equipment-broken', 'true');
    expect(container.querySelector('image,img')).toBeNull();
  });
  it('shows an unbuilt factory as a marked plot and changes each new building through its actual levels', () => {
    for (const key of ['workers_quarters','smeltery','gem_workshop'] as const) {
      const plot = new MockContext(), one = new MockContext(), two = new MockContext(), three = new MockContext();
      paintBuilding(plot as unknown as CanvasRenderingContext2D, key, 0, 1000, true, false, { working: true, ready: true });
      paintBuilding(one as unknown as CanvasRenderingContext2D, key, 1, 1000, false);
      paintBuilding(two as unknown as CanvasRenderingContext2D, key, 2, 1000, false);
      paintBuilding(three as unknown as CanvasRenderingContext2D, key, 3, 1000, false);
      expect(plot.fills).toContain('#b29b68'); expect(plot.fills).not.toContain('#eed08c');
      expect(one.fills).not.toEqual(plot.fills); expect(one.fills).not.toContain('#b29b68');
      expect(two.fillRect.mock.calls.length).toBeGreaterThan(one.fillRect.mock.calls.length);
      expect(three.fillRect.mock.calls.length).toBeGreaterThan(two.fillRect.mock.calls.length);
    }
    const third = new MockContext(), fourth = new MockContext();
    paintBuilding(third as unknown as CanvasRenderingContext2D, 'mine_shaft', 3, 0, false);
    paintBuilding(fourth as unknown as CanvasRenderingContext2D, 'mine_shaft', 4, 0, false);
    expect(third.fills).not.toContain('#adbbb0'); expect(fourth.fills).toContain('#adbbb0');
  });
  it('fits all seven owned buildings on phone and desktop while preserving the close mine zoom floor', () => {
    for (const size of [{ width: 320, height: 440 }, { width: 390, height: 600 }, { width: 1440, height: 800 }]) {
      const buildings = phase2BuildingKeys.map(key => BUILDING_ART[key]);
      const camera = fitSurfaceCamera(size, { width: 96, depth: 299 }, buildings);
      for (const building of buildings) {
        expect(mineToScreen({ x: building.x, y: 0 }, camera, size).x).toBeGreaterThanOrEqual(11.999);
        expect(mineToScreen({ x: building.x + building.width, y: 0 }, camera, size).x).toBeLessThanOrEqual(size.width - 11.999);
      }
    }
    expect(zoomMineAt({ x: 48, y: 6, scale: 25 }, .001, { x: 160, y: 220 }, { width: 320, height: 440 }, bounds).scale).toBe(6);
  });
  it('keeps plot clicks functional, then reframes a newly owned building into the actual Surface overview', () => {
    const snapshot = phase2Snapshot(), selected = vi.fn();
    const root = render(<DeepClaimCanvas snapshot={snapshot} view="surface" selectedTile={null} onSelectTile={vi.fn()} onSelectBuilding={selected} reducedMotion />);
    const canvas = screen.getByTestId('deep-claim-canvas');
    const initial = fitSurfaceCamera(viewport, bounds, legacyBuildingArt), plot = mineToScreen({ x: 38, y: -1 }, initial, viewport);
    pointer(canvas, 'pointerdown', plot.x, plot.y); pointer(canvas, 'pointerup', plot.x, plot.y);
    expect(selected).toHaveBeenLastCalledWith('smeltery');
    const built = { ...snapshot, revision: 2, buildings: snapshot.buildings.map(building => building.key === 'gem_workshop' ? { ...building, level: 1 } : building) };
    root.rerender(<DeepClaimCanvas snapshot={built} view="surface" selectedTile={null} onSelectTile={vi.fn()} onSelectBuilding={selected} reducedMotion />);
    const fit = fitSurfaceCamera(viewport, bounds, built.buildings.filter(building => building.level > 0).map(building => BUILDING_ART[building.key]));
    const gem = mineToScreen({ x: 91, y: -2 }, fit, viewport);
    pointer(canvas, 'pointerdown', gem.x, gem.y); pointer(canvas, 'pointerup', gem.x, gem.y);
    expect(selected).toHaveBeenLastCalledWith('gem_workshop');
  });
  it('never invents ready production from elapsed local time or changes the original snapshot', () => {
    const snapshot = phase2Snapshot(); snapshot.production_jobs = [processing()];
    const saved = JSON.stringify(snapshot), start = Date.parse(snapshot.server_now);
    expect(buildingActivity(snapshot, 'smeltery', start - 1)).toEqual({ working: false, ready: false });
    expect(buildingActivity(snapshot, 'smeltery', start + 120_000)).toEqual({ working: true, ready: false });
    expect(buildingActivity(snapshot, 'smeltery', start + 999_999)).toEqual({ working: false, ready: false });
    expect(JSON.stringify(snapshot)).toBe(saved);
    expect(buildingActivity({ ...snapshot, production_jobs: [processing('ready')] }, 'smeltery', start + 999_999)).toEqual({ working: false, ready: true });
    expect(buildingActivity(companySnapshot(), 'smeltery', start)).toEqual({ working: false, ready: false });
  });
  it('renders gear only from actual owned worker assignments and preserves a hired candidate’s original portrait', () => {
    const snapshot = phase2Snapshot(); snapshot.equipment = [{ id: 'item-a', definition_key: 'iron_pickaxe', worker_id: 'worker-a', durability: 0, max_durability: 100, repair_cost: 5, repair_materials: { iron_bar: 1 } }, { id: 'item-b', definition_key: 'iron_helmet', worker_id: 'worker-b', durability: 50, max_durability: 100, repair_cost: 2, repair_materials: { stone: 1 } }];
    const saved = JSON.stringify(snapshot);
    expect(workerEquipmentPaint(snapshot, 'worker-a')).toEqual({ toolTier: 2, toolBroken: true });
    expect(workerEquipmentPaint(snapshot, 'worker-c')).toEqual({});
    const sprite = new MockContext(); paintWorker(sprite as unknown as CanvasRenderingContext2D, 48, 4, 'miner', 'mine', 1000, 1, 0, false, workerEquipmentPaint(snapshot, 'worker-a'));
    expect(sprite.fills).toContain('#8c5a40'); expect(JSON.stringify(snapshot)).toBe(saved);
    const person = { id: 'candidate-persistent-id', name: 'Ada Voss', specialty: 'engineer' as const };
    const root = render(<DeepClaimPortrait worker={person} />), before = root.container.innerHTML;
    root.rerender(<DeepClaimPortrait worker={{ ...snapshot.workers[0], ...person }} />);
    expect(root.container.innerHTML).toBe(before);
  });
});

function phase3Snapshot(): DeepClaimSnapshot {
  const snapshot = phase2Snapshot();
  return { ...snapshot, schema_version: 3, world: { ...snapshot.world!, max_depth: 599, tiles: [
    ...snapshot.world!.tiles, { x: 48, y: 4, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0, formation: 'cavern' },
    { x: 49, y: 4, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0, formation: 'wet_cavern' },
    { x: 60, y: 580, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0, formation: 'ruins' },
  ] }, infrastructure: [], discoveries: [], discovery_summary: { pending: 0, kept: 0, sold: 0, salvaged: 0 }, field_reports: [], field_catalog: FIELD_CATALOG };
}
function structure(status: DeepClaimInfrastructure['status'] = 'building'): DeepClaimInfrastructure {
  return { id: 'structure-a', key: 'supports', x: 48, y: 4, grade: 2, radius: 8, strength: 8, status, job_id: 'field-job', installed_at: status === 'installed' ? '2026-11-01T11:59:00Z' : null };
}
function discovery(overrides: Partial<DeepClaimDiscovery> = {}): DeepClaimDiscovery {
  return { id: 'find-a', x: 48, y: 4, job_id: 'mining-job', kind: 'banded_geode', name: 'Banded geode', quality: 'fine', detail: 'A layered specimen recovered by the returning crew.', sale_value: 60,
    salvage: { stone: 2, quartz: 1 }, status: 'pending', discovered_at: '2026-11-01T11:59:00Z', resolved_at: null, ...overrides };
}

function phase4Snapshot(): DeepClaimSnapshot {
  return { ...phase3Snapshot(), schema_version: 4,
    buildings: DEEP_CLAIM_BUILDING_IDS.map(key => ({ key, level: key === 'research_office' || key === 'trading_post' ? 0 : 1, max_level: key === 'mine_shaft' ? 5 : key === 'research_office' ? 2 : 3, upgrade_cost: 80, effect: 'Actual building effect.' })),
    business: { research: [], contracts: [], milestones: [], research_bonuses: {}, processing_speed_percent: 0,
      stats: { completed_mining_expeditions: 0, completed_surveys: 0, total_surveyed_tiles: 0, installed_infrastructure: 0, max_completed_mining_depth: 0, collected_production_batches: 0, collected_processed_units: 0, completed_research: 0, completed_contracts: 0, total_contract_credits: 0, kept_discoveries: 0 } } };
}

describe('Deep Claim Phase 4 company artwork', () => {
  it('distinguishes company alloys by both stamped geometry and material without adding hidden mineral textures', () => {
    const keys = ['bronze_bar','steel_bar','gold_bar'] as const;
    const { container } = render(<>{keys.map(resourceId => <DeepClaimResourceIcon key={resourceId} resourceId={resourceId} />)}</>);
    const stamps = [...container.querySelectorAll('svg')].map(svg => svg.querySelector('path:last-child')?.getAttribute('d'));
    expect(new Set(stamps).size).toBe(3);
    for (const key of keys) {
      expect(screen.getByRole('img', { name: RESOURCE_ART[key].label })).toBeInTheDocument();
      expect(DEEP_CLAIM_ART_MANIFEST.inventory).toContain(`stock_${key}`);
      expect(DEEP_CLAIM_ART_MANIFEST.terrain).not.toContain(`deposit_${key}`);
    }
    expect(DEEP_CLAIM_MINERAL_IDS).toHaveLength(10);
    expect(DEEP_CLAIM_RESOURCE_IDS).toHaveLength(19);
  });
  it('gives steel tools and cargo a reinforced silhouette while retaining a clearly named broken state', () => {
    const { container } = render(<><DeepClaimEquipmentIcon archetype="iron_pickaxe" /><DeepClaimEquipmentIcon archetype="steel_pickaxe" /><DeepClaimEquipmentIcon archetype="hauler_frame" /><DeepClaimEquipmentIcon archetype="steel_cargo_harness" durability={0} /></>);
    const icons = [...container.querySelectorAll('svg')];
    expect(icons[1]).toHaveAttribute('data-dc-equipment-tier', '3');
    expect(icons[1].querySelectorAll('path').length).toBeGreaterThan(icons[0].querySelectorAll('path').length);
    expect(icons[3].querySelectorAll('path').length).toBeGreaterThan(icons[2].querySelectorAll('path').length);
    expect(screen.getByRole('img', { name: 'Broken Steel cargo harness' })).toHaveAttribute('data-dc-equipment-broken', 'true');
  });
  it('paints research and trade as unfinished plots until built, with distinct structural upgrades at each supported level', () => {
    for (const key of ['research_office','trading_post'] as const) {
      const stages = Array.from({ length: key === 'research_office' ? 3 : 4 }, (_, level) => {
        const context = new MockContext();
        paintBuilding(context as unknown as CanvasRenderingContext2D, key, level, 1000, false);
        return context;
      });
      expect(stages[0].fills).toContain('#b29b68');
      expect(stages[1].fills).not.toContain('#b29b68');
      for (let level = 2; level < stages.length; level++) expect(stages[level].fillRect.mock.calls.length).toBeGreaterThan(stages[level - 1].fillRect.mock.calls.length);
    }
    expect(DEEP_CLAIM_ART_MANIFEST.buildings).toContain('research_office_levels_0_2');
    expect(DEEP_CLAIM_ART_MANIFEST.buildings).toContain('trading_post_levels_0_3');
  });
  it('fits all nine non-overlapping building footprints at 320px, wider phones, and desktop without moving the existing camp', () => {
    const ordered = Object.values(BUILDING_ART).sort((a, b) => a.x - b.x);
    for (let index = 1; index < ordered.length; index++) expect(ordered[index].x).toBeGreaterThanOrEqual(ordered[index - 1].x + ordered[index - 1].width);
    expect(BUILDING_ART.research_office.x + BUILDING_ART.research_office.width / 2).toBe(17);
    expect(BUILDING_ART.trading_post.x + BUILDING_ART.trading_post.width / 2).toBe(57);
    expect(phase2BuildingKeys.map(key => BUILDING_INFO[key].x)).toEqual([24,48,66,77,9,38,91]);
    for (const size of [{ width: 320, height: 440 }, { width: 390, height: 600 }, { width: 1440, height: 800 }]) {
      const camera = fitSurfaceCamera(size, { width: 96, depth: 599 }, ordered);
      for (const building of ordered) {
        expect(mineToScreen({ x: building.x, y: 0 }, camera, size).x).toBeGreaterThanOrEqual(11.999);
        expect(mineToScreen({ x: building.x + building.width, y: 0 }, camera, size).x).toBeLessThanOrEqual(size.width - 11.999);
      }
    }
  });
  it('resolves small-phone plot and built-building taps to their actual named callback despite enlarged adjacent touch areas', () => {
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({ ...box, width: 320, right: 320 });
    const snapshot = phase4Snapshot(), select = vi.fn();
    const root = render(<DeepClaimCanvas snapshot={snapshot} view="surface" selectedTile={null} onSelectTile={vi.fn()} onSelectBuilding={select} reducedMotion />);
    const size = { width: 320, height: 500 }, camera = fitSurfaceCamera(size, { width: 96, depth: 599 }, Object.values(BUILDING_ART));
    const canvas = screen.getByTestId('deep-claim-canvas');
    for (const key of ['research_office','trading_post'] as const) {
      const point = mineToScreen({ x: BUILDING_INFO[key].x, y: -1 }, camera, size);
      pointer(canvas, 'pointerdown', point.x, point.y); pointer(canvas, 'pointerup', point.x, point.y);
      expect(select).toHaveBeenLastCalledWith(key);
    }
    const built = { ...snapshot, revision: 2, buildings: snapshot.buildings.map(building => ({ ...building, level: 1 })) };
    root.rerender(<DeepClaimCanvas snapshot={built} view="surface" selectedTile={null} onSelectTile={vi.fn()} onSelectBuilding={select} reducedMotion />);
    for (const key of DEEP_CLAIM_BUILDING_IDS) {
      const point = mineToScreen({ x: BUILDING_INFO[key].x, y: -2 }, camera, size);
      pointer(canvas, 'pointerdown', point.x, point.y); pointer(canvas, 'pointerup', point.x, point.y);
      expect(select).toHaveBeenLastCalledWith(key);
    }
  });
  it('animates only actual paid research during its public timestamps and never invents completion or a collection crate', () => {
    const snapshot = phase4Snapshot(), start = Date.parse(snapshot.server_now);
    snapshot.business!.research = [{ key: 'excavation_1', status: 'active', started_at: '2026-11-01T12:00:00Z', completes_at: '2026-11-01T12:05:00Z', completed_at: null }];
    const original = JSON.stringify(snapshot);
    expect(buildingActivity(snapshot, 'research_office', start - 1)).toEqual({ working: false, ready: false });
    expect(buildingActivity(snapshot, 'research_office', start + 150_000)).toEqual({ working: true, ready: false });
    expect(buildingActivity(snapshot, 'research_office', start + 300_000)).toEqual({ working: false, ready: false });
    snapshot.business!.contracts = [{ key: 'foundry_1', status: 'offered', completed_at: null }];
    expect(buildingActivity(snapshot, 'trading_post', start)).toEqual({ working: false, ready: false });
    snapshot.business!.contracts = [];
    expect(JSON.stringify(snapshot)).toBe(original);
    const active = new MockContext(), idle = new MockContext();
    paintBuilding(active as unknown as CanvasRenderingContext2D, 'research_office', 1, 0, false, false, buildingActivity(snapshot, 'research_office', start));
    paintBuilding(idle as unknown as CanvasRenderingContext2D, 'research_office', 1, 0, false);
    expect(active.fills).toContain('#ddc68d'); expect(idle.fills).not.toContain('#ddc68d');
    expect(active.fills).not.toContain('#b59b60');
    expect(buildingActivity(companySnapshot(), 'research_office', start)).toEqual({ working: false, ready: false });
  });
  it('shows steel equipment only on its assigned worker, including damaged equipment, without changing public ownership', () => {
    const snapshot = phase4Snapshot();
    snapshot.equipment = [{ id: 'steel-tool', definition_key: 'steel_pickaxe', worker_id: 'worker-a', durability: 100, max_durability: 180, repair_cost: 8, repair_materials: { steel_bar: 1 } }, { id: 'steel-pack', definition_key: 'steel_cargo_harness', worker_id: 'worker-a', durability: 0, max_durability: 180, repair_cost: 8, repair_materials: { steel_bar: 1 } }];
    const original = JSON.stringify(snapshot), equipment = workerEquipmentPaint(snapshot, 'worker-a');
    expect(equipment).toEqual({ toolTier: 3, toolBroken: false, utility: 'cargo', utilityTier: 3, utilityBroken: true });
    expect(workerEquipmentPaint(snapshot, 'worker-b')).toEqual({});
    const sprite = new MockContext();
    paintWorker(sprite as unknown as CanvasRenderingContext2D, 48, 4, 'miner', 'mine', 0, 1, 0, false, equipment);
    expect(sprite.fills).toContain('#c1d8d7'); expect(sprite.fills).toContain('#80674b');
    expect(JSON.stringify(snapshot)).toBe(original);
  });
  it('provides distinct named company icons with decorative presentation available to their parent controls', () => {
    const { container } = render(<>{(['research','contract','milestone','office'] as const).map(kind => <DeepClaimBusinessIcon key={kind} kind={kind} />)}<DeepClaimBusinessIcon kind="research" decorative /></>);
    expect(screen.getAllByRole('img')).toHaveLength(4);
    const shapes = [...container.querySelectorAll('[role="img"]')].map(svg => svg.innerHTML);
    expect(new Set(shapes).size).toBe(4);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveAttribute('data-dc-business-art', 'research');
    expect(container.querySelector('image,img')).toBeNull();
  });
});

describe('Deep Claim Phase 3 committed underground artwork', () => {
  it('gives surveying and construction their own work poses without extraction debris', () => {
    const survey = new MockContext(), build = new MockContext(), mine = new MockContext();
    paintWorker(survey as unknown as CanvasRenderingContext2D, 48, 4, 'geologist', 'survey', 660, 1, 0, true);
    paintWorker(build as unknown as CanvasRenderingContext2D, 48, 4, 'engineer', 'build', 660, 1, 0, true);
    paintWorker(mine as unknown as CanvasRenderingContext2D, 48, 4, 'miner', 'mine', 660, 1, 0, true);
    expect(survey.fills).toContain('#ccbc8b'); expect(build.fills).toContain('#aebcac');
    expect(survey.fills).not.toContain('#d2b374'); expect(build.fills).not.toContain('#d2b374'); expect(mine.fills).toContain('#d2b374');
  });
  it('emits mining audio only for public extraction/exploration work, never surveying or construction', () => {
    const snapshot = phase3Snapshot(); snapshot.server_now = '2026-11-01T12:06:00Z';
    snapshot.workers = snapshot.workers.map(worker => worker.id === 'worker-a' ? { ...worker, assigned_job_id: 'operation-a' } : worker);
    const job: DeepClaimExpedition = { id: 'operation-a', mode: 'survey', status: 'active', worker_ids: ['worker-a'], target: { x: 48, y: 4 }, path: [{ x: 48, y: 0 }, { x: 48, y: 1 }, { x: 48, y: 4 }],
      stages: [ { key: 'travel', starts_at: '2026-11-01T12:00:00Z', ends_at: '2026-11-01T12:02:00Z' }, { key: 'setup', starts_at: '2026-11-01T12:02:00Z', ends_at: '2026-11-01T12:03:00Z' }, { key: 'work', starts_at: '2026-11-01T12:03:00Z', ends_at: '2026-11-01T12:17:00Z' }, { key: 'haul', starts_at: '2026-11-01T12:17:00Z', ends_at: '2026-11-01T12:19:00Z' }, { key: 'return', starts_at: '2026-11-01T12:19:00Z', ends_at: '2026-11-01T12:20:00Z' } ],
      stage: 'work', started_at: '2026-11-01T12:00:00Z', completes_at: '2026-11-01T12:20:00Z', duration_minutes: 20, duration_seconds: 1200, tutorial: false, wages: 3, energy_per_worker: 1, config_version: 3, cargo: null };
    snapshot.expeditions = [job];
    const audio = { getSnapshot: () => ({ master: false }), unlock: vi.fn(), play: vi.fn() };
    const props = { view: 'mine' as const, selectedTile: null, onSelectTile: vi.fn(), onSelectBuilding: vi.fn(), audio: audio as unknown as DeepClaimAudio };
    const root = render(<DeepClaimCanvas {...props} snapshot={snapshot} />);
    frame(1000); expect(audio.play).not.toHaveBeenCalled();
    root.rerender(<DeepClaimCanvas {...props} snapshot={{ ...snapshot, expeditions: [{ ...job, mode: 'infrastructure' }] }} />);
    frame(2000); expect(audio.play).not.toHaveBeenCalled();
    root.rerender(<DeepClaimCanvas {...props} snapshot={{ ...snapshot, expeditions: [{ ...job, mode: 'extract' }] }} />);
    frame(3000); expect(audio.play).toHaveBeenCalledWith('pickaxe', expect.any(Number), undefined);
  });
  it('provides four infrastructure silhouettes and six original specimen icons with named qualities', () => {
    const { container } = render(<>{DEEP_CLAIM_INFRASTRUCTURE_KEYS.map(infrastructureKey => <DeepClaimInfrastructureIcon key={infrastructureKey} infrastructureKey={infrastructureKey} grade={2} />)}{DEEP_CLAIM_DISCOVERY_KINDS.map(kind => <DeepClaimDiscoveryIcon key={kind} kind={kind} quality="exceptional" />)}</>);
    expect(screen.getAllByRole('img')).toHaveLength(10);
    expect(screen.getByRole('img', { name: 'Supports, grade 2' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Exceptional fern fossil' })).toBeVisible();
    expect(new Set(DEEP_CLAIM_DISCOVERY_KINDS.map(kind => JSON.stringify(DISCOVERY_ART[kind].blocks))).size).toBe(6);
    expect(container.querySelector('image,img')).toBeNull();
    expect(infrastructureSprite('supports', 1, true).blocks).not.toEqual(infrastructureSprite('supports', 3, true).blocks);
    expect(infrastructureSprite('supports', 3, false).blocks).not.toEqual(infrastructureSprite('supports', 3, true).blocks);
  });
  it('joins only known open neighbors and removes cosmetic timbers from legacy empty tunnels', () => {
    const snapshot = phase3Snapshot(), tile = snapshot.world!.tiles.find(tile => tile.x === 48 && tile.y === 4)!;
    const known = new Map(snapshot.world!.tiles.map(tile => [`${tile.x}:${tile.y}`, tile]));
    expect(knownRoomNeighbors(tile, known)).toBe(2);
    known.set('48:3', { x: 48, y: 3, terrain: 'excavated', material: null, remaining: 0, initial_amount: 0 });
    expect(knownRoomNeighbors(tile, known)).toBe(3);
    const legacy = new MockContext(); paintTerrain(legacy as unknown as CanvasRenderingContext2D, 0, 0, null, true, 0, true);
    expect(legacy.fills).not.toContain('#68513a'); expect(legacy.fills).not.toContain('#534332');
    const appearances = DEEP_CLAIM_FORMATIONS.map(formation => {
      const context = new MockContext(); paintTerrain(context as unknown as CanvasRenderingContext2D, 0, 0, null, true, 0, true, false, formation);
      return context.fills.join('|');
    });
    expect(new Set(appearances).size).toBe(4);
  });
  it('invalidates a changed formation texture and installed structure overlay without rewriting stock or terrain', () => {
    const first = phase3Snapshot(); first.infrastructure = [structure()];
    const root = render(<DeepClaimCanvas snapshot={first} view="mine" selectedTile={null} selectedInfrastructureId="structure-a" onSelectTile={vi.fn()} onSelectBuilding={vi.fn()} reducedMotion />);
    frame();
    expect(contexts.flatMap(context => context.fills)).toContain('#c7ba8b');
    expect(contexts[0].stroke).not.toHaveBeenCalled();
    const before = contexts.length;
    const next = { ...first, revision: 2, infrastructure: [structure('installed')], world: { ...first.world!, revision: 2, tiles: first.world!.tiles.map(tile => tile.x === 48 && tile.y === 4 ? { ...tile, formation: 'crystal_cavern' as const } : tile) } };
    const saved = JSON.stringify(next);
    root.rerender(<DeepClaimCanvas snapshot={next} view="mine" selectedTile={null} selectedInfrastructureId="structure-a" onSelectTile={vi.fn()} onSelectBuilding={vi.fn()} reducedMotion />);
    frame(2000);
    const added = contexts.slice(before).flatMap(context => context.fills);
    expect(added).toContain('#272435'); expect(added).toContain('#768b7b');
    expect(contexts[0].stroke).toHaveBeenCalled(); expect(JSON.stringify(next)).toBe(saved);
    // A subsequent structure-only update must also work with the same world object.
    const count = contexts.length, graded = { ...next, infrastructure: [{ ...structure('installed'), grade: 3 }] };
    root.rerender(<DeepClaimCanvas snapshot={graded} view="mine" selectedTile={null} onSelectTile={vi.fn()} onSelectBuilding={vi.fn()} reducedMotion />);
    frame(3000);
    expect(contexts.slice(count).flatMap(context => context.fills)).toContain('#d8c28b');
  });
  it('indexes only published recovered finds on known depleted cells and culls overlays by chunk', () => {
    const snapshot = phase3Snapshot(); snapshot.infrastructure = [structure('installed')];
    snapshot.discoveries = [discovery(), discovery({ id: 'future-find', kind: 'fern_fossil', discovered_at: '2026-11-02T12:00:00Z' }), discovery({ id: 'unrevealed-find', x: 2, y: 100 }), discovery({ id: 'deep-find', x: 60, y: 580, status: 'kept', resolved_at: '2026-11-01T11:59:30Z' })];
    const saved = JSON.stringify(snapshot), index = indexPublicField(snapshot);
    const shallow = { minX: 40, maxX: 55, minY: 1, maxY: 20 }, deep = { minX: 55, maxX: 65, minY: 570, maxY: 590 };
    expect(visibleFieldEntries(index.discoveries, shallow).map(entry => entry.id)).toEqual(['find-a']);
    expect(visibleFieldEntries(index.discoveries, deep).map(entry => entry.id)).toEqual(['deep-find']);
    expect(visibleFieldEntries(index.infrastructure, deep)).toEqual([]);
    expect(indexPublicField(companySnapshot()).discoveries.size).toBe(0);
    expect(JSON.stringify(snapshot)).toBe(saved);
  });
  it('keeps infrastructure effects inactive through construction and uses the exact public Manhattan radius', () => {
    const building = structure(), installed = structure('installed'), context = new MockContext();
    expect(infrastructureInstalled(building, '2026-11-02T00:00:00Z')).toBe(false);
    expect(infrastructureInstalled({ ...installed, installed_at: '2026-11-02T00:00:00Z' }, '2026-11-01T12:00:00Z')).toBe(false);
    paintInfrastructureCoverage(context as unknown as CanvasRenderingContext2D, building, 24); expect(context.beginPath).not.toHaveBeenCalled();
    paintInfrastructureCoverage(context as unknown as CanvasRenderingContext2D, installed, 24);
    expect(context.moveTo).toHaveBeenCalledWith((48 + .5) * 16, (4 + .5 - 8) * 16);
    expect(context.lineTo).toHaveBeenCalledWith((48 + .5 + 8) * 16, (4 + .5) * 16);
    expect(context.fill).toHaveBeenCalledOnce(); expect(context.stroke).toHaveBeenCalledOnce();
  });
  it('locates deep known sites by explicit nonce and keeps polling or duplicate tokens from stealing the camera', () => {
    const snapshot = phase3Snapshot(), select = vi.fn();
    snapshot.infrastructure = [{ ...structure('installed'), x: 60, y: 580 }];
    const props = { snapshot, view: 'mine' as const, selectedTile: null, onSelectTile: select, onSelectBuilding: vi.fn(), reducedMotion: true };
    const root = render(<DeepClaimCanvas {...props} focusRequest={{ id: 'locate-a', point: { x: 60, y: 580 }, scale: 24 }} />);
    const canvas = screen.getByTestId('deep-claim-canvas');
    frame(); expect(screen.getByText('Located mine tile 60, depth 580 metres.')).toBeInTheDocument();
    pointer(canvas, 'pointerdown', 195, 214); pointer(canvas, 'pointerup', 195, 214);
    expect(select).toHaveBeenLastCalledWith({ x: 60, y: 580 });
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    root.rerender(<DeepClaimCanvas {...props} snapshot={{ ...snapshot, server_now: '2026-11-01T12:00:02Z' }} focusRequest={{ id: 'locate-a', point: { x: 1, y: 1 } }} />);
    pointer(canvas, 'pointerdown', 195, 250); pointer(canvas, 'pointerup', 195, 250);
    expect(select).toHaveBeenLastCalledWith({ x: 61, y: 582 });
    root.rerender(<DeepClaimCanvas {...props} focusRequest={{ id: 'locate-b', point: { x: 60, y: 580 }, scale: 24 }} />);
    pointer(canvas, 'pointerdown', 195, 250); pointer(canvas, 'pointerup', 195, 250);
    expect(select).toHaveBeenLastCalledWith({ x: 60, y: 582 });
  });
  it('keeps larger specimen markers selectable at their true cell with a full-size nearest-site hit target', () => {
    expect(fieldMarkerAt({ x: 60, y: 60 }, [{ point: { x: 48, y: 4 }, screen: { x: 50, y: 50 } }, { point: { x: 49, y: 4 }, screen: { x: 80, y: 80 } }])).toEqual({ x: 48, y: 4 });
    expect(fieldMarkerAt({ x: 200, y: 200 }, [{ point: { x: 48, y: 4 }, screen: { x: 50, y: 50 } }])).toBeNull();
    const snapshot = phase3Snapshot(); snapshot.discoveries = [discovery()]; const select = vi.fn();
    render(<DeepClaimCanvas snapshot={snapshot} view="surface" selectedTile={null} onSelectTile={select} onSelectBuilding={vi.fn()} reducedMotion />);
    const camera = fitSurfaceCamera(viewport, { width: 96, depth: 599 }, legacyBuildingArt), point = mineToScreen({ x: 48.5, y: 4.5 }, camera, viewport);
    // The marker extends outside its tiny logical tile in a camp overview.
    pointer(screen.getByTestId('deep-claim-canvas'), 'pointerdown', point.x + 9, point.y + 7);
    pointer(screen.getByTestId('deep-claim-canvas'), 'pointerup', point.x + 9, point.y + 7);
    expect(select).toHaveBeenCalledExactlyOnceWith({ x: 48, y: 4 });
  });
  it('adds an actual fifth shaft silhouette without altering any public world cells', () => {
    const four = new MockContext(), five = new MockContext();
    paintBuilding(four as unknown as CanvasRenderingContext2D, 'mine_shaft', 4, 0, false);
    paintBuilding(five as unknown as CanvasRenderingContext2D, 'mine_shaft', 5, 0, false);
    expect(four.fills).not.toContain('#d2d9bf'); expect(five.fills).toContain('#d2d9bf');
    expect(five.fillRect.mock.calls.length).toBeGreaterThan(four.fillRect.mock.calls.length);
  });
});


describe('Deep Claim runtime lifetime safeguards', () => {
  it('ignores inactive/lost pointer gestures and cancels every pending renderer timer on unmount', () => {
    const select = vi.fn(), props = { snapshot: companySnapshot(), view: 'mine' as const, selectedTile: null, onSelectTile: select, onSelectBuilding: vi.fn() };
    const root = render(<DeepClaimCanvas {...props} />), map = screen.getByTestId('deep-claim-canvas'); frame();
    pointer(map, 'pointerdown', 195, 250); pointer(map, 'lostpointercapture', 195, 250); pointer(map, 'pointerup', 195, 250);
    expect(select).not.toHaveBeenCalled();
    pointer(map, 'pointerdown', 195, 250); root.rerender(<DeepClaimCanvas {...props} active={false} />);
    pointer(map, 'pointermove', 220, 250); pointer(map, 'pointerup', 220, 250); fireEvent.keyDown(map, { key: 'ArrowRight' });
    expect(select).not.toHaveBeenCalled(); expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
    root.unmount(); expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });
  it('exposes only aggregate diagnostics after a paint and isolates callback failures', () => {
    const samples: Parameters<NonNullable<React.ComponentProps<typeof DeepClaimCanvas>['onDiagnostics']>>[0][] = [];
    const diagnostics = vi.fn(sample => { samples.push(sample); throw new Error('Optional QA callback failed'); });
    const props = { snapshot: companySnapshot(), view: 'mine' as const, selectedTile: null, onSelectTile: vi.fn(), onSelectBuilding: vi.fn(), reducedMotion: true, onDiagnostics: diagnostics };
    const root = render(<DeepClaimCanvas {...props} />); expect(diagnostics).not.toHaveBeenCalled(); expect(() => frame()).not.toThrow();
    expect(samples[0]).toMatchObject({ paint_count: 1, scheduled_wakeups: 1, mode: 'static', active: true, visible: true, world_index_builds: 1 });
    expect(samples[0].terrain_cache_entries).toBeLessThanOrEqual(384); expect(samples[0].field_cache_entries).toBeLessThanOrEqual(72);
    expect(samples[0].visible_tiles).toBeLessThanOrEqual(samples[0].visible_cells); expect(JSON.stringify(samples[0])).not.toMatch(/worker_id|company_id|material|inventory|cargo|server_now/);
    expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
    root.rerender(<DeepClaimCanvas {...props} selectedTile={{ x: 48, y: 3 }} />); expect(() => frame(2000)).not.toThrow(); expect(diagnostics).toHaveBeenCalledTimes(2);
  });
  it('uses elapsed server position for explicit reduced-motion crew focus without advancing a recorded stage', () => {
    const snapshot = companySnapshot(), start = snapshot.server_now;
    const job = { id: 'focus-travel', mode: 'extract', status: 'active', stage: 'travel', worker_ids: [snapshot.workers[0].id], path: [{ x:48,y:0 },{ x:48,y:1 },{ x:47,y:1 }], target: { x:47,y:1 }, stages: [{ key:'travel',starts_at:start,ends_at:new Date(Date.parse(start)+5000).toISOString() }] } as DeepClaimExpedition;
    snapshot.expeditions = [job]; snapshot.workers[0].assigned_job_id = job.id;
    const diagnostics = vi.fn(); render(<DeepClaimCanvas snapshot={snapshot} view="mine" selectedTile={null} onSelectTile={vi.fn()} onSelectBuilding={vi.fn()} reducedMotion onDiagnostics={diagnostics} />);
    frame(2500); fireEvent.click(screen.getByRole('button', { name:'Focus crew' })); frame(2500);
    expect(diagnostics.mock.calls.at(-1)![0].camera).toMatchObject({ x:48,y:3 });
    expect(job.stage).toBe('travel'); expect(job.status).toBe('active'); expect(frames.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });
});
