import { useEffect, useRef } from 'react';
import type { DeepClaimBuildingId } from '@/lib/deepClaim/types';
import { BUILDING_ART } from './artManifest';
import { paintBuilding } from './pixelArt';
import { preloadDeepClaimAtlas, subscribeDeepClaimAtlas } from './authoredAtlas';
import { preloadDeepClaimAddon, subscribeDeepClaimAddon } from './ancientAtlas';

/** Static view of the same owned building shown in the settlement. No animation loop. */
export function DeepClaimBuildingPortrait({ buildingId, level, decorative = false }: { buildingId: DeepClaimBuildingId; level: number; decorative?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (typeof window.CanvasRenderingContext2D === 'undefined') return;
    const surface = canvas.current;
    if (!surface) return;
    const context = surface.getContext('2d');
    if (!context) return;
    function draw() {
      if (!context || !surface) return;
      const art = BUILDING_ART[buildingId];
      const left = art.x * 16 - 8, top = level > 0 ? art.y * 16 - 16 : -40;
      const width = art.width * 16 + 16, height = level > 0 ? art.height * 16 + 24 : 50;
      const scale = Math.min((surface.width - 16) / width, (surface.height - 14) / height);
      context.clearRect(0, 0, surface.width, surface.height);
      context.imageSmoothingEnabled = false;
      context.save();
      context.translate((surface.width - width * scale) / 2 - left * scale, (surface.height - height * scale) / 2 - top * scale);
      context.scale(scale, scale);
      paintBuilding(context, buildingId, level, 0, false);
      context.restore();
    }
    draw();
    const unsubscribe = subscribeDeepClaimAtlas(draw);
    void preloadDeepClaimAtlas();
    const deep = buildingId === 'mine_shaft' && level >= 6;
    const unsubscribeDeep = deep ? subscribeDeepClaimAddon(draw) : undefined;
    if (deep) void preloadDeepClaimAddon();
    return () => { unsubscribe(); unsubscribeDeep?.(); };
  }, [buildingId, level]);
  return <canvas ref={canvas} width={192} height={136} className="dcl-building-portrait" role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : `${BUILDING_ART[buildingId].label} · ${level > 0 ? `level ${level}` : 'unbuilt plot'}`} data-dc-building-portrait={buildingId} data-level={level} />;
}
