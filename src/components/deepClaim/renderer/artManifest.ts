import type { DeepClaimBuildingId, DeepClaimResourceId, DeepClaimSpecialty } from '@/lib/deepClaim/types';
import { BUILDING_INFO } from '@/lib/deepClaim/catalog';

/** Phase 1: original procedural pixel art, not a finished commercial sprite atlas. */
export const DEEP_CLAIM_ART_PROVENANCE = {
  author: 'Original DH Club / Deep Claim implementation',
  source: 'Authored pixel primitives and coordinate-only cosmetic texture patterns. No stock, emoji, external image requests, private world seeds or generated gameplay terrain.',
  grade: 'Phase 1 original procedural art; expanded hand-painted animation and commercial atlas polish are future work.',
  logicalTilePixels: 16,
} as const;
export const FRONTIER_PALETTE = {
  coal: '#17191b', soot: '#262627', earth: '#624536', clay: '#a36648', rust: '#a65e3c', brass: '#c49a50',
  brassLight: '#ead09a', moss: '#637957', slate: '#6b7882', cream: '#eadcba', wood: '#795539', woodDark: '#3d2d27',
  sky: '#b7ad8c', haze: '#9c9e87', lamp: '#f1c776', paper: '#d5c69d',
} as const;
export const RESOURCE_ART: Record<DeepClaimResourceId, { label: string; dark: string; mid: string; light: string; shape: 'rock' | 'clod' | 'crystal' }> = {
  stone: { label: 'Stone', dark: '#3b4142', mid: '#758080', light: '#a6af9c', shape: 'rock' },
  clay: { label: 'Clay', dark: '#6f3e32', mid: '#ad6b4e', light: '#d09b6e', shape: 'clod' },
  coal: { label: 'Coal', dark: '#0b1115', mid: '#303c42', light: '#626b69', shape: 'rock' },
  copper_ore: { label: 'Copper ore', dark: '#653b2c', mid: '#b8774d', light: '#e0b476', shape: 'rock' },
  tin_ore: { label: 'Tin ore', dark: '#3c5357', mid: '#91b4ae', light: '#d4e0ca', shape: 'rock' },
  iron_ore: { label: 'Iron ore', dark: '#663b32', mid: '#a66b4e', light: '#d6a775', shape: 'rock' },
  quartz: { label: 'Quartz', dark: '#716b79', mid: '#bab9c9', light: '#f4e8e0', shape: 'crystal' },
  silver_ore: { label: 'Silver ore', dark: '#3d5867', mid: '#a4b9c6', light: '#e2e5cf', shape: 'crystal' },
};
export const SPECIALTY_ART: Record<DeepClaimSpecialty, { coat: string; helmet: string; tool: 'pick' | 'map' | 'pack' | 'wrench' | 'scope' | 'charge' | 'lamp' }> = {
  miner: { coat: '#a66c43', helmet: '#d3b362', tool: 'pick' }, geologist: { coat: '#77836b', helmet: '#d5c6a0', tool: 'map' },
  hauler: { coat: '#657a82', helmet: '#c19a58', tool: 'pack' }, engineer: { coat: '#9a7d60', helmet: '#d1ae62', tool: 'wrench' },
  surveyor: { coat: '#a6a077', helmet: '#c1bc93', tool: 'scope' }, demolitionist: { coat: '#985c4a', helmet: '#be9260', tool: 'charge' },
  safety_officer: { coat: '#bbb076', helmet: '#e6ca75', tool: 'lamp' },
};
export const workerAppearanceVariant = (id: string) => [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
export const BUILDING_ART: Record<DeepClaimBuildingId, { label: string; x: number; y: number; width: number; height: number }> = {
  mine_office: { label: 'Mine office', x: BUILDING_INFO.mine_office.x - 3.5, y: -5, width: 7, height: 5 },
  mine_shaft: { label: 'Mine shaft', x: BUILDING_INFO.mine_shaft.x - 3.5, y: -8, width: 7, height: 8 },
  warehouse: { label: 'Warehouse', x: BUILDING_INFO.warehouse.x - 4.5, y: -5, width: 9, height: 5 },
  tool_station: { label: 'Tool station', x: BUILDING_INFO.tool_station.x - 3, y: -4, width: 6, height: 4 },
};
export const DEEP_CLAIM_ART_MANIFEST = {
  terrain: ['surface_grass', 'fog_rock', 'dug_tunnel', 'timber_shoring', ...Object.keys(RESOURCE_ART).map(id => `deposit_${id}`)],
  workers: Object.keys(SPECIALTY_ART).map(id => `crew_${id}`), buildings: Object.keys(BUILDING_ART).map(id => `${id}_levels_1_3`),
  props: ['ore_cart', 'rail_track', 'lantern', 'supply_crates', 'chimney_smoke', 'headgear_wheel', 'survey_flag'],
  animations: ['idle', 'walk', 'mine', 'haul', 'surface_smoke', 'shaft_wheel'],
} as const;
