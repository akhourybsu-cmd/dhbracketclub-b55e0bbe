import type { DeepClaimDiscovery, DeepClaimInfrastructure } from '@/lib/deepClaim/types';
import { DISCOVERY_ART, INFRASTRUCTURE_ART, QUALITY_ART, infrastructureSprite, type PixelBlock } from './fieldSprites';

const blocks = (context: CanvasRenderingContext2D, data: readonly PixelBlock[], offset = 0) => {
  for (const [color, x, y, width, height] of data) { context.fillStyle = color; context.fillRect(x + offset, y + offset, width, height); }
};
/** Small bounded original sprite cache. Keys contain asset style, never owner IDs or hidden world data. */
export class FieldAtlas {
  private cache = new Map<string, HTMLCanvasElement>();
  private asset(key: string, size: number, paint: (context: CanvasRenderingContext2D) => void) {
    const previous = this.cache.get(key); if (previous) return previous;
    const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const context = canvas.getContext('2d'); if (!context) return null;
    paint(context); this.cache.set(key, canvas); return canvas;
  }
  infrastructure(context: CanvasRenderingContext2D, entry: DeepClaimInfrastructure, installed: boolean, frame: number) {
    const sprite = infrastructureSprite(entry.key, entry.grade, installed, frame);
    const image = this.asset(`infrastructure:${entry.key}:${entry.grade}:${installed}:${frame}`, 16, c => blocks(c, sprite.blocks));
    if (image) context.drawImage(image, entry.x * 16, entry.y * 16, 16, 16);
    else { context.save(); context.translate(entry.x * 16, entry.y * 16); blocks(context, sprite.blocks); context.restore(); }
  }
  discovery(context: CanvasRenderingContext2D, entry: DeepClaimDiscovery, x: number, y: number, size: number) {
    const sprite = DISCOVERY_ART[entry.kind], quality = QUALITY_ART[entry.quality];
    const image = this.asset(`discovery:${entry.kind}:${entry.quality}`, 18, c => {
      c.fillStyle = '#27332f'; c.fillRect(0, 0, 18, 18); c.fillStyle = quality.color;
      c.fillRect(1, 0, 16, 1); c.fillRect(0, 1, 1, 16); c.fillRect(17, 1, 1, 16); c.fillRect(1, 17, 16, 1);
      blocks(c, sprite.blocks, 1);
    });
    context.save(); context.globalAlpha = ['sold', 'salvaged'].includes(entry.status) ? .6 : 1;
    if (image) context.drawImage(image, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    else {
      context.save(); context.translate(x - size / 2, y - size / 2); context.scale(size / 18, size / 18);
      context.fillStyle = '#27332f'; context.fillRect(0, 0, 18, 18); blocks(context, sprite.blocks, 1); context.restore();
    }
    context.fillStyle = entry.status === 'pending' ? '#e6c67f' : entry.status === 'kept' ? '#a1bd93' : '#8b9e95';
    context.fillRect(Math.round(x + size / 2 - 4), Math.round(y + size / 2 - 4), 4, 4); context.restore();
  }
  clear() { this.cache.clear(); }
}
export function paintInfrastructureCoverage(context: CanvasRenderingContext2D, entry: DeepClaimInfrastructure, scale: number) {
  if (entry.status !== 'installed') return;
  const color = INFRASTRUCTURE_ART[entry.key].color, x = (entry.x + .5) * 16, y = (entry.y + .5) * 16, radius = entry.radius * 16;
  context.save(); context.beginPath(); context.moveTo(x, y - radius); context.lineTo(x + radius, y); context.lineTo(x, y + radius); context.lineTo(x - radius, y); context.closePath();
  context.fillStyle = `${color}0c`; context.strokeStyle = `${color}99`; context.lineWidth = 16 / scale;
  context.setLineDash([48 / scale, 48 / scale]); context.fill(); context.stroke(); context.restore();
}
