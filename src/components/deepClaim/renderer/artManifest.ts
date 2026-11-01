import type { DeepClaimBuildingId, DeepClaimFormation, DeepClaimResourceId, DeepClaimSpecialty } from '@/lib/deepClaim/types';
import { DEEP_CLAIM_MINERAL_IDS } from '@/lib/deepClaim/types';
import { BUILDING_INFO } from '@/lib/deepClaim/catalog';

/** Phases 1–5: original procedural pixel art, not a finished commercial sprite atlas. */
export const DEEP_CLAIM_ART_PROVENANCE = {
  author: 'Original DH Club / Deep Claim implementation',
  source: 'Authored pixel primitives and coordinate-only cosmetic texture patterns. No stock, emoji, external image requests, private world seeds or generated gameplay terrain.',
  grade: 'Phase 1–5 original procedural art; expanded hand-painted animation and commercial atlas polish are future work.',
  logicalTilePixels: 16,
} as const;
export const FORMATION_ART: Record<DeepClaimFormation, { label: string; dark: string; wall: string; detail: string }> = {
  cavern: { label: 'Cavern', dark: '#1d2526', wall: '#414b46', detail: '#687368' },
  wet_cavern: { label: 'Wet cavern', dark: '#1c2d30', wall: '#3b5755', detail: '#759c96' },
  crystal_cavern: { label: 'Crystal cavern', dark: '#272435', wall: '#514858', detail: '#89809a' },
  ruins: { label: 'Ruins', dark: '#282b26', wall: '#56574a', detail: '#8a8b6a' },
};
export const FRONTIER_PALETTE = {
  coal: '#17191b', soot: '#262627', earth: '#624536', clay: '#a36648', rust: '#a65e3c', brass: '#c49a50',
  brassLight: '#ead09a', moss: '#637957', slate: '#6b7882', cream: '#eadcba', wood: '#795539', woodDark: '#3d2d27',
  sky: '#b7ad8c', haze: '#9c9e87', lamp: '#f1c776', paper: '#d5c69d',
} as const;
export const RESOURCE_ART: Record<DeepClaimResourceId, { label: string; dark: string; mid: string; light: string; shape: 'rock' | 'clod' | 'crystal' | 'bar' | 'polished' | 'gem' }> = {
  stone: { label: 'Stone', dark: '#3b4142', mid: '#758080', light: '#a6af9c', shape: 'rock' },
  clay: { label: 'Clay', dark: '#6f3e32', mid: '#ad6b4e', light: '#d09b6e', shape: 'clod' },
  coal: { label: 'Coal', dark: '#0b1115', mid: '#303c42', light: '#626b69', shape: 'rock' },
  copper_ore: { label: 'Copper ore', dark: '#653b2c', mid: '#b8774d', light: '#e0b476', shape: 'rock' },
  tin_ore: { label: 'Tin ore', dark: '#3c5357', mid: '#91b4ae', light: '#d4e0ca', shape: 'rock' },
  iron_ore: { label: 'Iron ore', dark: '#663b32', mid: '#a66b4e', light: '#d6a775', shape: 'rock' },
  quartz: { label: 'Quartz', dark: '#716b79', mid: '#bab9c9', light: '#f4e8e0', shape: 'crystal' },
  silver_ore: { label: 'Silver ore', dark: '#3d5867', mid: '#a4b9c6', light: '#e2e5cf', shape: 'crystal' },
  amethyst: { label: 'Amethyst', dark: '#503e68', mid: '#9274ae', light: '#d0b7df', shape: 'crystal' },
  gold_ore: { label: 'Gold ore', dark: '#725332', mid: '#c49d50', light: '#f0d38b', shape: 'rock' },
  copper_bar: { label: 'Copper bar', dark: '#75472f', mid: '#c68b5b', light: '#f0bc88', shape: 'bar' },
  tin_bar: { label: 'Tin bar', dark: '#536967', mid: '#9fbab2', light: '#e3e8d4', shape: 'bar' },
  iron_bar: { label: 'Iron bar', dark: '#3d4d54', mid: '#849399', light: '#c1c8b9', shape: 'bar' },
  silver_bar: { label: 'Silver bar', dark: '#536775', mid: '#b8ced6', light: '#f2eed7', shape: 'bar' },
  polished_quartz: { label: 'Polished quartz', dark: '#706b82', mid: '#c5c5d2', light: '#fff0df', shape: 'polished' },
  cut_amethyst: { label: 'Cut amethyst', dark: '#57426f', mid: '#a188c1', light: '#e2c9e9', shape: 'gem' },
  bronze_bar: { label: 'Bronze bar', dark: '#765331', mid: '#b7904f', light: '#ddc18b', shape: 'bar' },
  steel_bar: { label: 'Steel bar', dark: '#364d58', mid: '#839ba4', light: '#d0ded9', shape: 'bar' },
  gold_bar: { label: 'Gold bar', dark: '#8c612e', mid: '#d3aa4f', light: '#f5dda0', shape: 'bar' },
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
  workers_quarters: { label: 'Workers’ quarters', x: BUILDING_INFO.workers_quarters.x - 5, y: -6, width: 10, height: 6 },
  smeltery: { label: 'Smeltery', x: BUILDING_INFO.smeltery.x - 4, y: -7, width: 8, height: 7 },
  gem_workshop: { label: 'Gem workshop', x: BUILDING_INFO.gem_workshop.x - 4, y: -5, width: 8, height: 5 },
  research_office: { label: 'Research office', x: BUILDING_INFO.research_office.x - 3, y: -5, width: 6, height: 5 },
  trading_post: { label: 'Trading post', x: BUILDING_INFO.trading_post.x - 3.5, y: -5, width: 7, height: 5 },
};
export type EquipmentSilhouette = 'pickaxe' | 'lantern' | 'helmet' | 'cargo' | 'survey';
export const EQUIPMENT_ART = {
  copper_pickaxe: { label: 'Copper pickaxe', kind: 'pickaxe', tier: 1 }, iron_pickaxe: { label: 'Iron pickaxe', kind: 'pickaxe', tier: 2 },
  miner_lantern: { label: 'Miner lantern', kind: 'lantern', tier: 1 }, prism_lantern: { label: 'Prism lantern', kind: 'lantern', tier: 2 },
  copper_helmet: { label: 'Copper helmet', kind: 'helmet', tier: 1 }, iron_helmet: { label: 'Iron helmet', kind: 'helmet', tier: 2 },
  cargo_pack: { label: 'Cargo pack', kind: 'cargo', tier: 1 }, hauler_frame: { label: 'Hauler frame', kind: 'cargo', tier: 2 },
  survey_kit: { label: 'Survey kit', kind: 'survey', tier: 1 }, prism_survey_kit: { label: 'Prism survey kit', kind: 'survey', tier: 2 },
  steel_pickaxe: { label: 'Steel pickaxe', kind: 'pickaxe', tier: 3 },
  steel_cargo_harness: { label: 'Steel cargo harness', kind: 'cargo', tier: 3 },
} satisfies Record<string, { label: string; kind: EquipmentSilhouette; tier: 1 | 2 | 3 }>;
export type EquipmentArtKey = keyof typeof EQUIPMENT_ART;
export const equipmentArtwork = (key: string) => EQUIPMENT_ART[key as EquipmentArtKey];
export const DEEP_CLAIM_ART_MANIFEST = {
  terrain: ['surface_grass', 'fog_rock', 'dug_tunnel', ...Object.keys(FORMATION_ART).map(id => `formation_${id}`), ...DEEP_CLAIM_MINERAL_IDS.map(id => `deposit_${id}`)],
  inventory: Object.keys(RESOURCE_ART).map(id => `stock_${id}`), equipment: Object.keys(EQUIPMENT_ART),
  workers: Object.keys(SPECIALTY_ART).map(id => `crew_${id}`), buildings: Object.keys(BUILDING_ART).map(id => `${id}_levels_${id === 'research_office' ? '0_2' : ['workers_quarters','smeltery','gem_workshop','trading_post'].includes(id) ? '0_3' : id === 'mine_shaft' ? '1_5' : '1_3'}`),
  business: ['research', 'contract', 'milestone', 'office'],
  club: ['club', 'project', 'standings', 'showcase', 'company_identity', 'empty_or_published_specimen_case'],
  projects: ['camp_supply', 'haul_extension', 'clean_air', 'assay_observatory', 'deep_freight', 'geological_pavilion'],
  infrastructure: ['supports', 'ventilation', 'pump', 'rail'].map(id => `${id}_building_installed_grades_1_3`),
  discoveries: ['banded_geode', 'fern_fossil', 'survey_journal', 'rail_relic', 'crystal_cluster', 'meteorite_fragment'],
  props: ['ore_cart', 'rail_track', 'lantern', 'supply_crates', 'chimney_smoke', 'headgear_wheel', 'survey_flag'],
  animations: ['idle', 'walk', 'mine', 'haul', 'survey', 'construction', 'surface_smoke', 'shaft_wheel', 'smeltery_work', 'gem_wheel_work', 'tool_station_work', 'research_work'],
} as const;
