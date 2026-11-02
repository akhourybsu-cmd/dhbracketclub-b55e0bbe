import type { DeepClaimDiscoveryKind, DeepClaimDiscoveryQuality, DeepClaimInfrastructureKey } from '@/lib/deepClaim/types';

/** Original 16px sprite rectangles; these describe artwork, never world generation. */
export type PixelBlock = readonly [color: string, x: number, y: number, width: number, height: number];
export interface FieldSprite { label: string; blocks: readonly PixelBlock[] }
export const INFRASTRUCTURE_ART: Record<DeepClaimInfrastructureKey, { label: string; color: string }> = {
  supports: { label: 'Supports', color: '#c5a56a' }, ventilation: { label: 'Ventilation', color: '#93b29a' },
  pump: { label: 'Pump', color: '#87b1bb' }, rail: { label: 'Rail', color: '#b1c0b6' },
};
export const DISCOVERY_ART: Record<DeepClaimDiscoveryKind, FieldSprite> = {
  banded_geode: { label: 'Banded geode', blocks: [
    ['#4c493e',3,4,10,9],['#80735a',2,6,12,6],['#b79d77',4,3,8,11],['#6d5a7c',5,4,7,9],['#b9a2c7',6,5,5,7],['#e0cfe0',7,6,3,5],['#6d5a7c',8,7,2,3],['#d0b78d',3,7,2,4],
  ] },
  fern_fossil: { label: 'Fern fossil', blocks: [
    ['#4b5146',2,3,12,11],['#858d75',3,2,10,12],['#b3b79c',4,3,8,9],['#596c4d',7,4,1,9],['#596c4d',5,4,2,1],['#596c4d',8,5,3,1],['#596c4d',4,6,3,1],['#596c4d',8,7,3,1],['#596c4d',5,8,2,1],['#596c4d',8,9,2,1],['#596c4d',6,10,1,1],
  ] },
  survey_journal: { label: 'Survey journal', blocks: [
    ['#3b3429',3,2,10,13],['#927048',4,2,9,11],['#d7c69b',5,3,7,9],['#9c8659',5,4,5,1],['#9c8659',5,7,6,1],['#9c8659',5,9,4,1],['#684e35',3,2,2,11],['#ad8a50',10,7,4,3],['#d5b979',11,8,2,1],['#eadab1',5,13,7,1],
  ] },
  rail_relic: { label: 'Rail relic', blocks: [
    ['#3c4749',4,2,8,3],['#8c9c98',3,3,10,2],['#73513d',6,5,4,7],['#9e7760',5,6,6,3],['#475754',3,11,10,3],['#9eada0',2,11,12,2],['#c7b687',7,4,2,2],['#c7b687',7,10,2,2],['#a76c46',10,6,2,2],
  ] },
  crystal_cluster: { label: 'Crystal cluster', blocks: [
    ['#4c5666',2,11,12,3],['#7f90a9',3,7,3,7],['#c4d7d8',4,6,2,6],['#8d83b2',7,2,3,12],['#d8c9e5',8,1,1,11],['#77899e',11,6,3,8],['#c4d7d8',12,5,1,6],['#596a83',6,9,2,5],
  ] },
  meteorite_fragment: { label: 'Meteorite fragment', blocks: [
    ['#293b40',3,5,10,9],['#596c68',4,3,7,11],['#8b8d72',2,8,12,3],['#455d57',3,6,10,6],['#202f37',5,5,3,3],['#b39758',9,5,2,2],['#b39758',4,10,2,2],['#7c9687',8,9,3,3],['#273f42',9,10,2,2],
  ] },
};
export const QUALITY_ART: Record<DeepClaimDiscoveryQuality, { label: string; color: string; marks: number }> = {
  common: { label: 'Common', color: '#a99c76', marks: 1 }, fine: { label: 'Fine', color: '#d1b778', marks: 2 },
  exceptional: { label: 'Exceptional', color: '#bda8d0', marks: 3 }, flawless: { label: 'Flawless', color: '#ecddae', marks: 4 },
};
const spriteCache = new Map<string, FieldSprite>();
export function infrastructureSprite(key: DeepClaimInfrastructureKey, grade = 1, installed = true, frame = 0): FieldSprite {
  const tier = Math.max(1, Math.min(3, Math.floor(grade))), cacheKey = `${key}:${tier}:${installed}:${frame % 2}`;
  const cached = spriteCache.get(cacheKey); if (cached) return cached;
  const wood = tier === 1 ? '#927047' : '#768b7b', metal = tier === 3 ? '#c8bc8e' : '#a2b39e';
  let blocks: PixelBlock[];
  if (!installed) blocks = [['#514732',1,13,14,2],['#8e7850',2,7,2,8],['#8e7850',12,7,2,8],['#c7ba8b',4,8,8,6],['#708671',5,10,6,1],['#708671',8,9,1,4],['#b6a174',1,6,3,2],['#b6a174',12,6,3,2]];
  else if (key === 'supports') blocks = [[wood,1,1,3,15],[wood,12,1,3,15],[wood,0,0,16,3],['#cfb27a',1,1,14,1],['#433b2d',4,3,8,1],['#514631',0,14,5,2],['#514631',11,14,5,2]];
  else if (key === 'ventilation') blocks = [['#46594d',0,1,16,4],[metal,1,1,14,1],['#536c59',4,5,9,9],['#b0bca0',5,6,7,7],['#2b4139',6,7,5,5],['#91a38a',frame % 2 ? 6 : 8,7,frame % 2 ? 5 : 1,frame % 2 ? 1 : 5],['#c4b67a',8,8,2,2],['#46594d',0,13,16,2]];
  else if (key === 'pump') blocks = [['#536666',3,7,10,8],[metal,4,7,8,2],['#88aeb5',1,3,3,10],['#b6c2ad',1,2,8,2],['#3e5354',6,9,5,4],['#c3ae73',7,frame % 2 ? 8 : 10,3,2],['#5a7f84',12,11,4,3],['#364a45',2,14,13,2]];
  else blocks = [['#796345',3,1,3,15],['#796345',11,1,3,15],['#a9b8ae',0,4,16,2],['#a9b8ae',0,12,16,2],['#d2d0ae',1,4,14,1],['#d2d0ae',1,12,14,1]];
  if (installed && tier >= 2) blocks.push([metal,1,4,2,2],[metal,13,4,2,2],[metal,1,11,2,2],[metal,13,11,2,2]);
  if (installed && tier >= 3) blocks.push(['#d8c28b',5,1,2,2],['#d8c28b',9,1,2,2],['#a8b69c',0,15,16,1]);
  const sprite = { label: INFRASTRUCTURE_ART[key].label, blocks }; spriteCache.set(cacheKey, sprite); return sprite;
}
