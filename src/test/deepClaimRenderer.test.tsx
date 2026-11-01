import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeepClaimCanvas } from '@/components/deepClaim/renderer/DeepClaimCanvas';
import { DeepClaimEquipmentIcon, DeepClaimPortrait, DeepClaimResourceIcon } from '@/components/deepClaim/renderer/DeepClaimIcons';
import { BUILDING_ART, DEEP_CLAIM_ART_MANIFEST, EQUIPMENT_ART, RESOURCE_ART } from '@/components/deepClaim/renderer/artManifest';
import { constrainCamera, fitSurfaceCamera, mineToScreen, panMine, screenToMine, visibleMineCells, zoomMineAt } from '@/components/deepClaim/renderer/camera';
import { paintBuilding, paintWorker } from '@/components/deepClaim/renderer/pixelArt';
import { buildingActivity, workerEquipmentPaint } from '@/components/deepClaim/renderer/productionVisuals';
import { BUILDING_INFO, EQUIPMENT_CATALOG } from '@/lib/deepClaim/catalog';
import { DEEP_CLAIM_BUILDING_IDS, DEEP_CLAIM_MINERAL_IDS, DEEP_CLAIM_RESOURCE_IDS, DEEP_CLAIM_SPECIALTIES, type DeepClaimProductionJob, type DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { companySnapshot } from './fixtures/deepClaim';
import type { DeepClaimAudio } from '@/lib/deepClaim/audio';

const viewport = { width: 390, height: 500 }, bounds = { width: 96, depth: 149 };
const legacyBuildingArt = ['mine_office','mine_shaft','warehouse','tool_station'].map(key => BUILDING_ART[key as keyof typeof BUILDING_ART]);
const contexts: MockContext[] = [];
class MockContext {
  fillStyle: string | CanvasGradient | CanvasPattern = ''; strokeStyle = ''; lineWidth = 1; imageSmoothingEnabled = true;
  fills: string[] = []; images: unknown[] = [];
  setTransform = vi.fn(); save = vi.fn(); restore = vi.fn(); translate = vi.fn(); scale = vi.fn(); strokeRect = vi.fn(); fillText = vi.fn();
  fillRect = vi.fn(() => this.fills.push(String(this.fillStyle)));
  drawImage = vi.fn((image: unknown) => this.images.push(image));
  constructor() { contexts.push(this); }
}
const frames = new Map<number, FrameRequestCallback>();
let frameId = 0, visibility: DocumentVisibilityState = 'visible';
const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
const box = { ...viewport, x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 500, toJSON: () => ({}) };
function frame(at = 1000) { act(() => { const queue = [...frames.values()]; frames.clear(); queue.forEach(callback => callback(at)); }); }
function pointer(element: HTMLElement, type: string, x: number, y: number, pointerId = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId, clientX: x, clientY: y, pointerType: 'touch', isPrimary: pointerId === 1 }); fireEvent(element, event);
}
beforeEach(() => {
  contexts.length = 0; frames.clear(); frameId = 0; visibility = 'visible';
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(box);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () { return new MockContext() as unknown as CanvasRenderingContext2D; } as unknown as typeof HTMLCanvasElement.prototype.getContext);
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); frames.clear();
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
    root.rerender(<DeepClaimCanvas {...props} />); frame(); expect(frames.size).toBe(1);
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
  return { ...snapshot, schema_version: 2, buildings: DEEP_CLAIM_BUILDING_IDS.map(key => ({ key, level: ['workers_quarters','smeltery','gem_workshop'].includes(key) ? 0 : 1, max_level: key === 'mine_shaft' ? 4 : 3, upgrade_cost: 90, effect: 'Actual building effect.' })),
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
    for (const id of ['copper_bar','tin_bar','iron_bar','silver_bar','polished_quartz','cut_amethyst']) expect(DEEP_CLAIM_ART_MANIFEST.terrain).not.toContain(`deposit_${id}`);
    const { container } = render(<><DeepClaimResourceIcon resourceId="copper_ore" /><DeepClaimResourceIcon resourceId="copper_bar" /><DeepClaimResourceIcon resourceId="amethyst" /><DeepClaimResourceIcon resourceId="cut_amethyst" /></>);
    const silhouettes = [...container.querySelectorAll('svg')].map(svg => [...svg.querySelectorAll('path')].map(path => path.getAttribute('d')).join('|'));
    expect(silhouettes[0]).not.toBe(silhouettes[1]); expect(silhouettes[2]).not.toBe(silhouettes[3]);
  });
  it('covers every actual equipment definition with five original archetypes and a readable broken state', () => {
    expect(Object.keys(EQUIPMENT_ART).sort()).toEqual(EQUIPMENT_CATALOG.map(item => item.key).sort());
    const { container } = render(<>{EQUIPMENT_CATALOG.map(item => <DeepClaimEquipmentIcon key={item.key} archetype={item.key} tier={item.tier} durability={item.key === 'iron_pickaxe' ? 0 : 10} />)}</>);
    expect(container.querySelectorAll('svg')).toHaveLength(10);
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
      const camera = fitSurfaceCamera(size, { width: 96, depth: 299 }, Object.values(BUILDING_ART));
      for (const building of Object.values(BUILDING_ART)) {
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
