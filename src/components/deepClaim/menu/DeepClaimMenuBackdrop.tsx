import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { CanvasFrameScheduler } from '../renderer/frameScheduler';
import { getDeepClaimAtlasDiagnostics, preloadDeepClaimAtlas, subscribeDeepClaimAtlas } from '../renderer/authoredAtlas';
import { MENU_BACKING_PIXEL_LIMIT, menuSceneGeometry, paintMenuActivity, paintMenuGroundLayer, paintMenuSkyLayer, type MenuSceneGeometry } from './illustratedScene';
import './menu.css';

export interface DeepClaimMenuDiagnostics {
  state: 'animated' | 'static' | 'inactive' | 'unsupported';
  paints: number;
  backingPixels: number;
  cachePixels: number;
  atlasState: ReturnType<typeof getDeepClaimAtlasDiagnostics>['state'];
}
export interface DeepClaimMenuBackdropProps {
  active?: boolean;
  reducedMotion?: boolean;
  reducedGraphics?: boolean;
  variant?: 'title' | 'founding';
  onDiagnostics?: (sample: DeepClaimMenuDiagnostics) => void;
}

/** A composed title illustration. It deliberately has no company, snapshot or world input. */
export function DeepClaimMenuBackdrop({ active = true, reducedMotion = false, reducedGraphics = false, variant = 'title', onDiagnostics }: DeepClaimMenuBackdropProps) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const context = useRef<CanvasRenderingContext2D | null>(null), scheduler = useRef<CanvasFrameScheduler | null>(null);
  const layers = useRef<{ sky: HTMLCanvasElement; ground: HTMLCanvasElement; dirty: boolean } | null>(null);
  const geometry = useRef<MenuSceneGeometry>(menuSceneGeometry(1, 1, variant));
  const ratio = useRef(1), sceneTime = useRef(0), previous = useRef<number | null>(null);
  const resizeCurrent = useRef<(() => void) | null>(null);
  const [supported, setSupported] = useState(true);
  const latest = useRef({ active, reducedMotion, reducedGraphics, variant, onDiagnostics });
  latest.current = { active, reducedMotion, reducedGraphics, variant, onDiagnostics };

  const report = useCallback((state: DeepClaimMenuDiagnostics['state']) => {
    if (host.current) host.current.dataset.dcMenuState = state;
    const element = canvas.current, cache = layers.current;
    const sample: DeepClaimMenuDiagnostics = { state, paints: scheduler.current?.paints ?? 0, backingPixels: element ? element.width * element.height : 0,
      cachePixels: cache ? cache.sky.width * cache.sky.height + cache.ground.width * cache.ground.height : 0, atlasState: getDeepClaimAtlasDiagnostics().state };
    try { latest.current.onDiagnostics?.(sample); } catch { /* Optional diagnostics never affect menu controls. */ }
  }, []);
  const invalidate = useCallback(() => {
    const data = latest.current, enabled = data.active && document.visibilityState !== 'hidden' && !!context.current;
    scheduler.current?.configure({ enabled, reducedMotion: data.reducedMotion, reducedGraphics: data.reducedGraphics });
    scheduler.current?.invalidate();
    if (!enabled) previous.current = null;
    report(!context.current ? 'unsupported' : !enabled ? 'inactive' : data.reducedMotion ? 'static' : 'animated');
  }, [report]);
  const paint = useCallback((time: number) => {
    const c = context.current, element = canvas.current, cache = layers.current, data = latest.current;
    if (!c || !element || !cache || !data.active || document.visibilityState === 'hidden') return;
    const g = geometry.current;
    try {
      if (cache.dirty) {
        const sky = cache.sky.getContext('2d'), ground = cache.ground.getContext('2d');
        if (!sky || !ground) throw new Error('Illustration cache unavailable');
        for (const layer of [sky, ground]) { layer.setTransform(1, 0, 0, 1, 0, 0); layer.clearRect(0, 0, element.width, element.height); layer.imageSmoothingEnabled = false; layer.setTransform(ratio.current * g.scale, 0, 0, ratio.current * g.scale, ratio.current * g.x, ratio.current * g.y); }
        paintMenuSkyLayer(sky); paintMenuGroundLayer(ground, data.reducedGraphics); cache.dirty = false;
      }
      if (!data.reducedMotion && previous.current !== null) sceneTime.current += Math.min(120, Math.max(0, time - previous.current));
      previous.current = time;
      const elapsed = data.reducedMotion ? 0 : sceneTime.current;
      const drift = data.reducedMotion ? 0 : Math.sin(elapsed / 11000) * 5;
      c.setTransform(ratio.current, 0, 0, ratio.current, 0, 0); c.imageSmoothingEnabled = false;
      c.fillStyle = '#17211b'; c.fillRect(0, 0, g.width, g.height);
      c.drawImage(cache.sky, drift * .25, 0, g.width, g.height); c.drawImage(cache.ground, drift * .65, 0, g.width, g.height);
      c.save(); c.translate(g.x + drift, g.y); c.scale(g.scale, g.scale); paintMenuActivity(c, elapsed, !data.reducedMotion, data.reducedGraphics); c.restore();
      report(data.reducedMotion ? 'static' : 'animated');
    } catch {
      context.current = null; scheduler.current?.configure({ enabled: false, reducedMotion: true, reducedGraphics: true });
      if (layers.current) for (const layer of [layers.current.sky, layers.current.ground]) { layer.width = 0; layer.height = 0; }
      setSupported(false); report('unsupported');
    }
  }, [report]);

  useLayoutEffect(() => {
    const element = canvas.current, parent = host.current;
    if (!element || !parent) return;
    try { context.current = element.getContext('2d', { alpha: false }); } catch { context.current = null; }
    setSupported(!!context.current);
    if (!context.current) { report('unsupported'); return; }
    layers.current = { sky: document.createElement('canvas'), ground: document.createElement('canvas'), dirty: true };
    scheduler.current = new CanvasFrameScheduler({ now: () => performance.now(), requestFrame: callback => requestAnimationFrame(callback), cancelFrame: id => cancelAnimationFrame(id), setTimer: (callback, delay) => window.setTimeout(callback, delay), clearTimer: id => clearTimeout(id) }, paint);
    const resize = () => {
      const bounds = parent.getBoundingClientRect(); if (bounds.width <= 0 || bounds.height <= 0) return;
      const data = latest.current;
      ratio.current = Math.min(data.reducedGraphics ? 1 : 2, window.devicePixelRatio || 1, Math.sqrt(MENU_BACKING_PIXEL_LIMIT / (bounds.width * bounds.height)));
      element.width = Math.max(1, Math.floor(bounds.width * ratio.current)); element.height = Math.max(1, Math.floor(bounds.height * ratio.current));
      for (const layer of [layers.current!.sky, layers.current!.ground]) { layer.width = element.width; layer.height = element.height; }
      layers.current!.dirty = true; geometry.current = menuSceneGeometry(bounds.width, bounds.height, data.variant); invalidate();
    };
    const atlasChanged = () => { if (layers.current) layers.current.dirty = true; invalidate(); };
    const unsubscribe = subscribeDeepClaimAtlas(atlasChanged);
    void preloadDeepClaimAtlas().catch(() => { /* The authored source painters remain available. */ });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    resizeCurrent.current = resize;
    observer?.observe(parent); window.addEventListener('resize', resize);
    const visibility = () => invalidate(); document.addEventListener('visibilitychange', visibility); resize();
    return () => {
      observer?.disconnect(); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', visibility); unsubscribe();
      scheduler.current?.dispose(); scheduler.current = null; context.current = null; previous.current = null;
      resizeCurrent.current = null;
      if (layers.current) for (const layer of [layers.current.sky, layers.current.ground]) { layer.width = 0; layer.height = 0; }
      layers.current = null; element.width = 0; element.height = 0;
    };
  }, [invalidate, paint, report]);
  useLayoutEffect(() => { invalidate(); }, [active, reducedMotion, invalidate]);
  useLayoutEffect(() => {
    if (layers.current) layers.current.dirty = true;
    const g = geometry.current; geometry.current = menuSceneGeometry(g.width, g.height, variant);
    // The shared resize path recalculates the DPR cap when graphics preferences change.
    resizeCurrent.current?.();
    invalidate();
  }, [reducedGraphics, variant, invalidate]);

  return <div ref={host} className="dc-title-backdrop" data-testid="deep-claim-menu-backdrop" data-dc-title-scene="illustrative" data-dc-menu-state={!supported ? 'unsupported' : !active ? 'inactive' : reducedMotion ? 'static' : 'animated'} role="img" aria-label="Illustrated mining frontier: a settlement above lantern-lit tunnels, workers and a moving lift. Title artwork, independent of your company.">
    <svg className="dc-title-art-fallback" viewBox="0 0 960 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" shapeRendering="crispEdges"><path d="M0 0H960V760H0Z" fill="#273b32" /><path d="M0 140H220V210H420V180H680V145H960V330H0Z" fill="#526b50" /><path d="M0 300H960V760H0Z" fill="#202a27" /><path d="M496 224H512V615H496ZM240 406H790V430H240ZM400 520H880V544H400Z" fill="#101c1a" /><path d="M450 165H556V173H450ZM461 172H469V300H461ZM540 172H548V300H540ZM469 205H540V209H469ZM469 247H540V251H469Z" fill="#a98e5b" /><path d="M290 243H395V300H290ZM660 250H788V300H660Z" fill="#776342" /><path d="M302 257H318V275H302ZM337 257H353V275H337ZM676 263H694V280H676Z" fill="#d7bf82" /></svg>
    <canvas ref={canvas} className="dc-title-art-canvas" aria-hidden="true" data-dc-art-supported={supported ? 'true' : 'false'} />
  </div>;
}
