import type { DeepClaimFormation, DeepClaimMineralId } from '@/lib/deepClaim/types';
import source from '../../../../art/deep-claim/pack-v2.json';
import legacy from '../../../../art/deep-claim/pack-v1.json';
import { drawDeepClaimAddon } from './ancientAtlas';

export type DeepClaimTerrainRegion = 'legacy' | 'ancient_deep';
export const knownTerrainRegion = (tile: { y: number }): DeepClaimTerrainRegion => tile.y >= 600 && tile.y <= 999 ? 'ancient_deep' : 'legacy';
const rect = (context: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number) => { context.fillStyle = color; context.fillRect(Math.round(x), Math.round(y), width, height); };
export const ancientTerrainKey = (resource: DeepClaimMineralId | null, dug: boolean, variant: number, detailed: boolean, formation: DeepClaimFormation | null, neighbors: number) => `deep:terrain:${dug ? 'dug' : 'rock'}:${resource ?? 'none'}:${variant & 3}:${detailed ? 1 : 0}:${formation ?? 'none'}:${dug && formation ? neighbors & 15 : 0}`;

/** Source-authoring and load-failure path. Its inputs describe already revealed cells only. */
export function paintAncientTerrainSource(context: CanvasRenderingContext2D, x: number, y: number, resource: DeepClaimMineralId | null, dug = false, variant = 0, detailed = true, formation: DeepClaimFormation | null = null, neighbors = 0) {
  const rock = source.rock;
  if (dug) {
    const room = formation ? source.rooms[formation] : { dark: rock.void, wall: rock.mid, detail: rock.light };
    rect(context, room.dark, x, y, 16, 16);
    if (!(neighbors & 1)) { rect(context, room.wall, x, y, 16, 3); if (detailed) rect(context, room.detail, x + 3 + (variant & 3), y + 3, 2, 2); }
    if (!(neighbors & 2)) rect(context, room.wall, x + 14, y, 2, 16);
    if (!(neighbors & 4)) { rect(context, room.wall, x, y + 13, 16, 3); if (detailed) rect(context, rock.seam, x + 3, y + 12, 6, 1); }
    if (!(neighbors & 8)) rect(context, room.wall, x, y, 2, 16);
    if (formation === 'wet_cavern' && !(neighbors & 4)) { rect(context, '#426f73', x + 2, y + 11, 12, 2); if (detailed) rect(context, '#91b4a8', x + 4, y + 11, 5, 1); }
    if (formation === 'crystal_cavern' && detailed && !(neighbors & 1)) { rect(context, '#8589a8', x + 10, y + 2, 2, 5); rect(context, '#c0b6d0', x + 10, y + 3, 1, 3); }
    if (formation === 'ruins' && detailed && !(neighbors & 8)) { rect(context, '#9b977c', x + 1, y + 5, 2, 5); rect(context, '#c3b28b', x + 1, y + 7, 2, 1); }
    return;
  }
  rect(context, rock.dark, x, y, 16, 16); rect(context, rock.mid, x + 1, y + 1, 13, 13);
  rect(context, '#1c272e', x + 14, y + 1, 2, 15); rect(context, '#131e25', x, y + 15, 16, 1);
  if (detailed) {
    rect(context, rock.light, x + 3 + (variant & 1) * 4, y + 2, 1, 9);
    rect(context, '#53636b', x + 10, y + 6, 2, 8); rect(context, '#28353e', x + 2, y + 11, 7, 2);
    rect(context, rock.seam, x + 5 + (variant & 3), y + 4, 4, 1); rect(context, '#7c8172', x + 2, y + 13, 3, 1);
  }
  if (formation && detailed) { const room = source.rooms[formation]; rect(context, room.wall, x + 2, y + 7, 3, 2); rect(context, room.detail, x + 12, y + 4, 1, 3); }
  if (!resource) return;
  const palette = source.mineral_palettes[resource];
  const veins = (legacy.mineral_veins[resource] ?? source.new_veins[resource]) as [keyof typeof palette, number, number, number, number][] | undefined;
  if (!palette || !veins) return;
  for (const [shade, dx, dy, width, height] of detailed ? veins : veins.slice(0, 4)) rect(context, palette[shade], x + dx, y + dy, width, height);
}

export function paintAncientTerrain(context: CanvasRenderingContext2D, x: number, y: number, resource: DeepClaimMineralId | null, dug = false, variant = 0, detailed = true, formation: DeepClaimFormation | null = null, neighbors = 0) {
  if (!drawDeepClaimAddon(context, ancientTerrainKey(resource, dug, variant, detailed, formation, neighbors), x, y, 16, 16)) paintAncientTerrainSource(context, x, y, resource, dug, variant, detailed, formation, neighbors);
}
export function paintAncientShaftOverlay(context: CanvasRenderingContext2D, x: number, y: number) {
  for (const [color, dx, dy, width, height] of source.shaft6_overlay as [string, number, number, number, number][]) rect(context, color, x + dx, y + dy, width, height);
}
export function paintLiftEdgeSource(context: CanvasRenderingContext2D) { for (const [color, x, y, width, height] of source.lift_edge as [string, number, number, number, number][]) rect(context, color, x, y, width, height); }
export function paintLiftCabSource(context: CanvasRenderingContext2D) { for (const [color, x, y, width, height] of source.lift_cab as [string, number, number, number, number][]) rect(context, color, x, y, width, height); }
/** Caller must intersect the engine's eligible known-edge set with the viewport. */
export function paintKnownLiftEdge(context: CanvasRenderingContext2D, y: number) {
  if (drawDeepClaimAddon(context, 'deep:lift:edge', 48 * 16 - 8, y * 16, 16, 16)) return;
  context.save(); context.translate(48 * 16 - 8, y * 16); paintLiftEdgeSource(context); context.restore();
}
/** The car follows an actual projected travelling crew, never a local trip timer. */
export function paintKnownLiftCab(context: CanvasRenderingContext2D, x: number, y: number) {
  if (drawDeepClaimAddon(context, 'deep:lift:cab', Math.round(x * 16) - 12, Math.round(y * 16) - 28, 24, 32)) return;
  context.save(); context.translate(Math.round(x * 16) - 12, Math.round(y * 16) - 28); paintLiftCabSource(context); context.restore();
}
