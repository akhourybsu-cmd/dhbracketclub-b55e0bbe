import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpToLine, Crosshair, Minus, Plus } from 'lucide-react';
import { projectWorkers, revealedChunkMap, tileKey } from '@/lib/deepClaim/world';
import type { DeepClaimBuildingId, DeepClaimPoint, DeepClaimSnapshot, DeepClaimTile } from '@/lib/deepClaim/types';
import type { DeepClaimAudio } from '@/lib/deepClaim/audio';
import { BUILDING_ART, workerAppearanceVariant } from './artManifest';
import { constrainCamera, fitSurfaceCamera, initialMineCamera, mineToScreen, panMine, screenToMine, visibleMineCells, zoomMineAt, type DeepClaimCamera, type MineBounds, type ViewportSize } from './camera';
import { paintBuilding, paintFog, paintRail, paintSky, paintSurface, paintTerrain, paintWorker, type WorkerPose } from './pixelArt';
import './deepClaimCanvas.css';

export interface DeepClaimCanvasProps {
  snapshot: DeepClaimSnapshot;
  view: 'surface' | 'mine';
  selectedTile: DeepClaimPoint | null;
  onSelectTile: (point: DeepClaimPoint) => void;
  onSelectBuilding: (key: DeepClaimBuildingId) => void;
  active?: boolean;
  reducedMotion?: boolean;
  reducedGraphics?: boolean;
  audio?: DeepClaimAudio;
}
interface PointerState extends DeepClaimPoint { startX: number; startY: number }
interface Texture { canvas: HTMLCanvasElement; key: string }

/** Cosmetic tile texture cache. It never determines the contents of a world cell. */
class TerrainTextures {
  private cache = new Map<string, Texture>();
  draw(c: CanvasRenderingContext2D, tile: DeepClaimTile, detailed: boolean) {
    const resource = tile.remaining > 0 ? tile.material : null;
    const variant = (tile.x + tile.y) % 4, dug = tile.terrain === 'excavated';
    const key = `${tile.terrain}:${resource}:${variant}:${detailed}`;
    let texture = this.cache.get(key);
    if (!texture) {
      const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
      const context = canvas.getContext('2d');
      if (context) { paintTerrain(context, 0, 0, resource, dug, variant, detailed, tile.terrain === 'soil'); texture = { canvas, key }; this.cache.set(key, texture); }
    }
    if (texture) c.drawImage(texture.canvas, tile.x * 16, tile.y * 16, 16, 16);
    else paintTerrain(c, tile.x * 16, tile.y * 16, resource, dug, variant, detailed, tile.terrain === 'soil');
  }
  clear() { this.cache.clear(); }
}

export function DeepClaimCanvas(props: DeepClaimCanvasProps) {
  const { snapshot, view, selectedTile, onSelectTile, onSelectBuilding, active = true, reducedMotion = false, reducedGraphics = false, audio } = props;
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const context = useRef<CanvasRenderingContext2D | null>(null);
  const size = useRef<ViewportSize>({ width: 1, height: 1 });
  const camera = useRef<DeepClaimCamera>({ x: 48, y: 2, scale: 16 });
  const bounds = useRef<MineBounds>({ width: 96, depth: snapshot.world?.max_depth ?? 149 });
  bounds.current = { width: snapshot.world?.width ?? 96, depth: snapshot.world?.max_depth ?? 149 };
  const texture = useRef(new TerrainTextures());
  const cameraReady = useRef(false), lastView = useRef(view), lastCompany = useRef(snapshot.company?.id);
  const pointers = useRef(new Map<number, PointerState>()), gesture = useRef(false), pinch = useRef<number | null>(null);
  const raf = useRef<number | null>(null), previousFrame = useRef(-Infinity), mounted = useRef(false);
  const focusedCrew = useRef(-1), lastMiningSound = useRef(-Infinity);
  const observation = useRef({ time: snapshot.server_now, server: Date.parse(snapshot.server_now), at: performance.now() });
  const [supported, setSupported] = useState(true), [announcement, setAnnouncement] = useState('');
  const chunks = useMemo(() => snapshot.world ? revealedChunkMap(snapshot.world) : new Map<string, DeepClaimTile[]>(), [snapshot.world]);
  const latest = useRef({ snapshot, selectedTile, active, reducedMotion, reducedGraphics, audio, chunks, onSelectTile, onSelectBuilding });
  latest.current = { snapshot, selectedTile, active, reducedMotion, reducedGraphics, audio, chunks, onSelectTile, onSelectBuilding };
  if (observation.current.time !== snapshot.server_now) {
    const now = performance.now(), previousEstimate = observation.current.server + Math.max(0, now - observation.current.at);
    observation.current = { time: snapshot.server_now, server: Math.max(Date.parse(snapshot.server_now), previousEstimate), at: now };
  }

  const estimatedServerNow = useCallback(() => observation.current.server + (latest.current.reducedMotion ? 0 : Math.max(0, performance.now() - observation.current.at)), []);
  const focusSurface = useCallback(() => {
    camera.current = fitSurfaceCamera(size.current, bounds.current, latest.current.snapshot.buildings.map(building => BUILDING_ART[building.key]));
  }, []);
  const focusMine = useCallback(() => {
    const revealedDepth = Math.max(1, ...latest.current.snapshot.world?.tiles.map(tile => tile.y) ?? [1]);
    camera.current = constrainCamera({ x: 48, y: Math.max(4, Math.min(12, revealedDepth / 2)), scale: Math.min(27, Math.max(17, size.current.width / 26)) }, size.current, bounds.current);
  }, []);

  const draw = useCallback((timestamp: number) => {
    const c = context.current, element = canvas.current, data = latest.current;
    if (!c || !element || !mounted.current || !data.active || document.visibilityState === 'hidden') return;
    const viewport = size.current, cam = camera.current, dpr = element.width / Math.max(1, viewport.width);
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.imageSmoothingEnabled = false;
    c.fillStyle = '#17191b'; c.fillRect(0, 0, viewport.width, viewport.height);
    const horizon = mineToScreen({ x: 0, y: 0 }, cam, viewport).y;
    if (horizon > 0) paintSky(c, viewport.width, viewport.height, Math.min(viewport.height, horizon), cam.x * 16, timestamp, !data.reducedMotion && !data.reducedGraphics);
    c.save(); c.translate(viewport.width / 2, viewport.height / 2); c.scale(cam.scale / 16, cam.scale / 16); c.translate(-cam.x * 16, -cam.y * 16);
    const visible = visibleMineCells(cam, viewport, bounds.current), visibleTiles = new Map<string, DeepClaimTile>();
    // Only intersecting revealed chunks are visited. The fog has no resource data.
    for (let cx = Math.floor(visible.minX / 32); cx <= Math.floor(visible.maxX / 32); cx++) for (let cy = Math.floor(visible.minY / 32); cy <= Math.floor(visible.maxY / 32); cy++) {
      for (const tile of data.chunks.get(`${cx}:${cy}`) ?? []) if (tile.x >= visible.minX && tile.x <= visible.maxX && tile.y >= visible.minY && tile.y <= visible.maxY) visibleTiles.set(tileKey(tile), tile);
    }
    for (let y = visible.minY; y <= visible.maxY; y++) for (let x = visible.minX; x <= visible.maxX; x++) {
      const tile = visibleTiles.get(`${x}:${y}`);
      if (tile) texture.current.draw(c, tile, !data.reducedGraphics); else paintFog(c, x * 16, y * 16);
    }
    // Surface scenery and the rail are infrastructure art, never generated ore.
    if (horizon >= -180 && horizon <= viewport.height + 190) {
      paintSurface(c, visible.minX, visible.maxX);
      paintRail(c, 20, -1, 67);
      for (const building of data.snapshot.buildings) {
        const a = BUILDING_ART[building.key];
        if (a.x + a.width < visible.minX - 2 || a.x > visible.maxX + 2) continue;
        paintBuilding(c, building.key, building.level, timestamp, !data.reducedMotion && !data.reducedGraphics);
      }
    }
    const projected = projectWorkers(data.snapshot, estimatedServerNow());
    for (const [index, point] of projected.entries()) {
      const screen = mineToScreen(point, cam, viewport);
      if (screen.x < -40 || screen.x > viewport.width + 40 || screen.y < -35 || screen.y > viewport.height + 35) continue;
      const worker = data.snapshot.workers.find(worker => worker.id === point.worker_id);
      if (!worker) continue;
      const pose: WorkerPose = point.stage === 'work' ? 'mine' : point.pose === 'work' ? 'setup' : point.pose;
      const separation = point.job_id ? (index % 3 - 1) * .33 : 0;
      paintWorker(c, point.x + separation, point.y, worker.specialty, pose, point.elapsed_seconds * 1000, point.stage === 'return' ? -1 : 1, workerAppearanceVariant(worker.id), !data.reducedMotion && point.progress < 1);
      if (!data.reducedGraphics && point.y > 0) {
        c.fillStyle = '#ead09a15'; c.fillRect(point.x * 16 - 12, point.y * 16 - 27, 30, 25);
      }
    }
    if (data.selectedTile) {
      const { x, y } = data.selectedTile;
      c.strokeStyle = '#ead09a'; c.lineWidth = 16 / cam.scale * 2; c.strokeRect(x * 16 + 1, y * 16 + 1, 14, 14);
      c.fillStyle = '#ead09a2a'; c.fillRect(x * 16 + 2, y * 16 + 2, 12, 12);
    }
    c.restore();
    // Quiet, distance-attenuated mining cues reflect a current visible work
    // stage. No timer changes deposits, cargo, energy, XP or company balances.
    if (data.audio && timestamp - lastMiningSound.current > 1450) {
      const work = projected.find(worker => worker.stage === 'work' && worker.progress < 1 && worker.x >= visible.minX && worker.x <= visible.maxX && worker.y >= visible.minY && worker.y <= visible.maxY);
      if (work) { lastMiningSound.current = timestamp; data.audio.play('pickaxe', Math.hypot(work.x - cam.x, work.y - cam.y)); }
    }
    // A screen-space depth ruler remains readable at any zoom.
    c.font = '9px monospace'; c.textAlign = 'left'; c.textBaseline = 'middle';
    for (let depth = Math.max(10, Math.ceil(visible.minY / 10) * 10); depth <= visible.maxY; depth += 10) {
      const sy = mineToScreen({ x: 0, y: depth }, cam, viewport).y;
      c.fillStyle = '#101618a6'; c.fillRect(0, sy - 8, 38, 16); c.fillStyle = '#c9be9f'; c.fillText(`${depth}m`, 7, sy);
    }
  }, [estimatedServerNow]);

  const invalidate = useCallback(() => {
    if (!mounted.current || !context.current || !latest.current.active || document.visibilityState === 'hidden') return;
    if (raf.current !== null) return;
    const frame = (timestamp: number) => {
      raf.current = null;
      if (!mounted.current || !latest.current.active || document.visibilityState === 'hidden') return;
      const interval = latest.current.reducedGraphics ? 1000 / 12 : 1000 / 30;
      if (timestamp - previousFrame.current >= interval || latest.current.reducedMotion) { previousFrame.current = timestamp; draw(timestamp); }
      if (!latest.current.reducedMotion) raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  }, [draw]);

  useLayoutEffect(() => {
    mounted.current = true;
    const element = canvas.current, parent = host.current;
    if (!element || !parent) return;
    const textures = texture.current;
    let c: CanvasRenderingContext2D | null = null;
    try { c = element.getContext('2d', { alpha: false }); } catch { /* Operational lists stay available without Canvas2D. */ }
    context.current = c; setSupported(!!c);
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      size.current = { width: rect.width, height: rect.height };
      const ratio = Math.min(latest.current.reducedGraphics ? 1 : 2, window.devicePixelRatio || 1);
      element.width = Math.round(rect.width * ratio); element.height = Math.round(rect.height * ratio);
      if (!cameraReady.current) { camera.current = initialMineCamera(size.current, bounds.current); if (lastView.current === 'surface') focusSurface(); else focusMine(); cameraReady.current = true; }
      else if (camera.current.minimumScale === 4) focusSurface();
      camera.current = constrainCamera(camera.current, size.current, bounds.current); previousFrame.current = -Infinity; invalidate();
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(parent); window.addEventListener('resize', resize); resize();
    const wheel = (event: WheelEvent) => {
      event.preventDefault(); const rect = element.getBoundingClientRect();
      camera.current = zoomMineAt(camera.current, Math.exp(-Math.max(-500, Math.min(500, event.deltaY)) * .002), { x: event.clientX - rect.left, y: event.clientY - rect.top }, size.current, bounds.current);
      previousFrame.current = -Infinity; invalidate();
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => {
      mounted.current = false; observer?.disconnect(); window.removeEventListener('resize', resize); element.removeEventListener('wheel', wheel);
      if (raf.current !== null) cancelAnimationFrame(raf.current); raf.current = null; context.current = null; textures.clear();
    };
  }, [focusMine, focusSurface, invalidate]);

  useEffect(() => {
    if (lastCompany.current !== snapshot.company?.id) {
      lastCompany.current = snapshot.company?.id; texture.current.clear();
      if (view === 'surface') focusSurface(); else focusMine();
    }
    if (lastView.current !== view) { lastView.current = view; if (view === 'surface') focusSurface(); else focusMine(); }
    const element = canvas.current;
    if (element) {
      const ratio = Math.min(reducedGraphics ? 1 : 2, window.devicePixelRatio || 1);
      const width = Math.round(size.current.width * ratio), height = Math.round(size.current.height * ratio);
      if (element.width !== width || element.height !== height) { element.width = width; element.height = height; }
    }
    if (!active) { if (raf.current !== null) cancelAnimationFrame(raf.current); raf.current = null; }
    else { previousFrame.current = -Infinity; invalidate(); }
  }, [snapshot, view, selectedTile, active, reducedMotion, reducedGraphics, focusMine, focusSurface, invalidate]);
  useEffect(() => {
    const visibility = () => { if (document.visibilityState === 'hidden') { if (raf.current !== null) cancelAnimationFrame(raf.current); raf.current = null; } else { previousFrame.current = -Infinity; invalidate(); } };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [invalidate]);

  function local(event: { clientX: number; clientY: number }) { const rect = canvas.current!.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
  // A saved opt-in may resume on a new real interaction after reloading. It
  // never creates a context from mounting, polling or an animation frame.
  function resumeAudioFromGesture() { const controller = latest.current.audio; if (controller?.getSnapshot().master) void controller.unlock(); }
  function tap(point: DeepClaimPoint) {
    const world = screenToMine(point, camera.current, size.current), data = latest.current;
    for (const building of data.snapshot.buildings) {
      const a = BUILDING_ART[building.key], extraX = Math.max(0, 44 / camera.current.scale - a.width) / 2, extraY = Math.max(0, 44 / camera.current.scale - a.height) / 2;
      if (world.x >= a.x - extraX && world.x <= a.x + a.width + extraX && world.y >= a.y - extraY && world.y <= extraY) { data.audio?.play('building'); data.onSelectBuilding(building.key); return; }
    }
    const tile = { x: Math.floor(world.x), y: Math.floor(world.y) };
    if (tile.x < 0 || tile.x >= bounds.current.width || tile.y < 1 || tile.y > bounds.current.depth) return;
    data.onSelectTile(tile); setAnnouncement(`Mine tile ${tile.x}, depth ${tile.y} metres selected. Use the operation panel to inspect safe options.`);
  }
  function zoom(factor: number) { resumeAudioFromGesture(); camera.current = zoomMineAt(camera.current, factor, { x: size.current.width / 2, y: size.current.height / 2 }, size.current, bounds.current); previousFrame.current = -Infinity; invalidate(); }
  function crewFocus() {
    resumeAudioFromGesture();
    const positions = projectWorkers(latest.current.snapshot, estimatedServerNow());
    const activeCrew = positions.filter(worker => worker.job_id), pool = activeCrew.length ? activeCrew : positions;
    if (!pool.length) return;
    focusedCrew.current = (focusedCrew.current + 1) % pool.length; const worker = pool[focusedCrew.current];
    camera.current = constrainCamera({ x: worker.x, y: worker.y + 2, scale: Math.max(camera.current.scale, 25) }, size.current, bounds.current);
    const name = latest.current.snapshot.workers.find(entry => entry.id === worker.worker_id)?.name ?? 'Worker';
    setAnnouncement(`${name}, ${worker.stage}, depth ${Math.round(worker.y)} metres.`); previousFrame.current = -Infinity; invalidate();
  }

  return <div className="dc-mine-renderer" ref={host} data-testid="deep-claim-map" data-dc-view={view} data-dc-active={active ? 'true' : 'false'}>
    <canvas ref={canvas} className="dc-mine-canvas" data-testid="deep-claim-canvas" tabIndex={0} role="img" aria-label="Your Deep Claim mine. Drag to pan, pinch or scroll to zoom. Arrow keys pan, plus and minus zoom, Home focuses the surface, C focuses crew. Operation lists provide an accessible alternative."
      onPointerDown={event => { if (!active) return; resumeAudioFromGesture(); event.currentTarget.focus({ preventScroll: true }); const point = local(event); if (pointers.current.size === 0) gesture.current = false; pointers.current.set(event.pointerId, { ...point, startX: point.x, startY: point.y }); event.currentTarget.setPointerCapture?.(event.pointerId); if (pointers.current.size > 1) { gesture.current = true; const [a, b] = [...pointers.current.values()]; pinch.current = Math.hypot(a.x - b.x, a.y - b.y); } }}
      onPointerMove={event => {
        const before = pointers.current.get(event.pointerId); if (!before) return;
        const point = local(event); pointers.current.set(event.pointerId, { ...before, ...point });
        if (pointers.current.size > 1) { const [a, b] = [...pointers.current.values()], distance = Math.hypot(a.x - b.x, a.y - b.y); if (pinch.current && distance > 0) camera.current = zoomMineAt(camera.current, distance / pinch.current, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, size.current, bounds.current); pinch.current = distance; gesture.current = true; }
        else if (gesture.current || Math.hypot(point.x - before.startX, point.y - before.startY) > 6) { gesture.current = true; camera.current = panMine(camera.current, { x: point.x - before.x, y: point.y - before.y }, size.current, bounds.current); }
        previousFrame.current = -Infinity; invalidate();
      }}
      onPointerUp={event => { const before = pointers.current.get(event.pointerId); pointers.current.delete(event.pointerId); if (before && !gesture.current && pointers.current.size === 0) tap(local(event)); if (pointers.current.size < 2) pinch.current = null; if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId); }}
      onPointerCancel={event => { pointers.current.delete(event.pointerId); pinch.current = null; gesture.current = true; }}
      onKeyDown={event => { const step = event.shiftKey ? 4 : 1; if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); const movement = { x: event.key === 'ArrowLeft' ? step * camera.current.scale : event.key === 'ArrowRight' ? -step * camera.current.scale : 0, y: event.key === 'ArrowUp' ? step * camera.current.scale : event.key === 'ArrowDown' ? -step * camera.current.scale : 0 }; camera.current = panMine(camera.current, movement, size.current, bounds.current); } else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.22); } else if (event.key === '-') { event.preventDefault(); zoom(1 / 1.22); } else if (event.key === 'Home') { event.preventDefault(); focusSurface(); } else if (event.key.toLowerCase() === 'c') { event.preventDefault(); crewFocus(); } else return; resumeAudioFromGesture(); previousFrame.current = -Infinity; invalidate(); }} />
    {!supported && <p className="dc-canvas-unavailable" role="status">The illustrated mine is unavailable on this device. Your company and operation controls remain available.</p>}
    <div className="dc-mine-controls" role="group" aria-label="Mine view controls"><button type="button" aria-label="Focus surface buildings" onClick={() => { resumeAudioFromGesture(); focusSurface(); previousFrame.current = -Infinity; invalidate(); }}><ArrowUpToLine size={18} aria-hidden="true" /></button><button type="button" aria-label="Focus crew" disabled={snapshot.workers.length === 0} onClick={crewFocus}><Crosshair size={18} aria-hidden="true" /></button><button type="button" aria-label="Zoom into mine" onClick={() => zoom(1.28)}><Plus size={19} aria-hidden="true" /></button><button type="button" aria-label="Zoom out of mine" onClick={() => zoom(1 / 1.28)}><Minus size={19} aria-hidden="true" /></button></div>
    <p className="sr-only" aria-live="polite">{announcement}</p>
  </div>;
}
