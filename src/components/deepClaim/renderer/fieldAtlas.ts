import type { DeepClaimDiscovery, DeepClaimDiscoveryKind, DeepClaimDiscoveryQuality, DeepClaimInfrastructure } from '@/lib/deepClaim/types';
import { DISCOVERY_ART, INFRASTRUCTURE_ART, QUALITY_ART, infrastructureSprite, type PixelBlock } from './fieldSprites';
import { drawAuthoredSprite } from './authoredAtlas';

const blocks = (context: CanvasRenderingContext2D, data: readonly PixelBlock[], offset = 0) => {
  for (const [color, x, y, width, height] of data) { context.fillStyle = color; context.fillRect(x + offset, y + offset, width, height); }
};
/** Small bounded original sprite cache. Keys contain asset style, never owner IDs or hidden world data. */
export class FieldAtlas {
  private cache = new Map<string, HTMLCanvasElement>();
  get size() { return this.cache.size; }
  private asset(key: string, size: number, paint: (context: CanvasRenderingContext2D) => void) {
    const previous = this.cache.get(key); if (previous) return previous;
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const context = canvas.getContext('2d'); if (!context) return null;
    paint(context); if (this.cache.size >= 72) this.cache.delete(this.cache.keys().next().value!); this.cache.set(key, canvas); return canvas;
  }
  infrastructure(context: CanvasRenderingContext2D, entry: DeepClaimInfrastructure, installed: boolean, frame: number) {
    const grade = Math.max(1, Math.min(3, Math.floor(entry.grade))), motionFrame = Math.abs(frame) % 2;
    if (drawAuthoredSprite(context, `infrastructure:${entry.key}:${grade}:${installed ? 1 : 0}:${motionFrame}`, entry.x * 16, entry.y * 16, 16, 16)) return;
    const sprite = infrastructureSprite(entry.key, entry.grade, installed, frame);
    const image = this.asset(`infrastructure:${entry.key}:${grade}:${installed}:${motionFrame}`, 16, c => blocks(c, sprite.blocks));
    if (image) context.drawImage(image, entry.x * 16, entry.y * 16, 16, 16);
    else { context.save(); context.translate(entry.x * 16, entry.y * 16); blocks(context, sprite.blocks); context.restore(); }
  }
  discovery(context: CanvasRenderingContext2D, entry: DeepClaimDiscovery, x: number, y: number, size: number) {
    context.save(); context.globalAlpha = ['sold', 'salvaged'].includes(entry.status) ? .6 : 1;
    if (!drawAuthoredSprite(context, `discovery:${entry.kind}:${entry.quality}`, Math.round(x - size / 2), Math.round(y - size / 2), size, size)) {
      const image = this.asset(`discovery:${entry.kind}:${entry.quality}`, 18, c => paintDiscoverySource(c, entry.kind, entry.quality));
      if (image) context.drawImage(image, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
      else { context.save(); context.translate(x - size / 2, y - size / 2); context.scale(size / 18, size / 18); paintDiscoverySource(context, entry.kind, entry.quality); context.restore(); }
    }
    context.fillStyle = entry.status === 'pending' ? '#e6c67f' : entry.status === 'kept' ? '#a1bd93' : '#8b9e95';
    context.fillRect(Math.round(x + size / 2 - 4), Math.round(y + size / 2 - 4), 4, 4); context.restore();
  }
  clear() { this.cache.clear(); }
}
/** Shared source for the offline PNG and the load-failure fallback. */
export function paintDiscoverySource(context: CanvasRenderingContext2D, kind: DeepClaimDiscoveryKind, quality: DeepClaimDiscoveryQuality) {
  const sprite = DISCOVERY_ART[kind], frame = QUALITY_ART[quality];
  context.fillStyle = '#27332f'; context.fillRect(0, 0, 18, 18); context.fillStyle = frame.color;
  context.fillRect(1, 0, 16, 1); context.fillRect(0, 1, 1, 16); context.fillRect(17, 1, 1, 16); context.fillRect(1, 17, 16, 1);
  blocks(context, sprite.blocks, 1);
}
export function paintInfrastructureCoverage(context: CanvasRenderingContext2D, entry: DeepClaimInfrastructure, scale: number) {
  if (entry.status !== 'installed') return;
  const color = INFRASTRUCTURE_ART[entry.key].color, x = (entry.x + .5) * 16, y = (entry.y + .5) * 16, radius = entry.radius * 16;
  context.save(); context.beginPath(); context.moveTo(x, y - radius); context.lineTo(x + radius, y); context.lineTo(x, y + radius); context.lineTo(x - radius, y); context.closePath();
  context.fillStyle = `${color}0c`; context.strokeStyle = `${color}99`; context.lineWidth = 16 / scale;
  context.setLineDash([48 / scale, 48 / scale]); context.fill(); context.stroke(); context.restore();
}
