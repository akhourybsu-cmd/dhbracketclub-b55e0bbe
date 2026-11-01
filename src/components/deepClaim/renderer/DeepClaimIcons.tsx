import type { DeepClaimDiscoveryKind, DeepClaimDiscoveryQuality, DeepClaimInfrastructureKey, DeepClaimResourceId, DeepClaimSpecialty } from '@/lib/deepClaim/types';
import { RESOURCE_ART, SPECIALTY_ART, equipmentArtwork, workerAppearanceVariant } from './artManifest';
import { DISCOVERY_ART, QUALITY_ART, infrastructureSprite } from './fieldSprites';

export function DeepClaimResourceIcon({ resourceId, className = '', decorative = false }: { resourceId: DeepClaimResourceId; className?: string; decorative?: boolean }) {
  const art = RESOURCE_ART[resourceId];
  if (art.shape === 'bar') return <svg viewBox="0 0 32 32" className={`dc-resource-icon ${className}`} shapeRendering="crispEdges" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : art.label} aria-hidden={decorative || undefined} focusable="false"><path d="M5 25H27V28H5Z" fill="#17191b" opacity=".24" /><path d="M3 22L7 11H24L29 22V26H3Z" fill={art.dark} /><path d="M7 11H24L26 17H5Z" fill={art.light} /><path d="M5 18H27V23H5Z" fill={art.mid} /><path d="M7 24H25V26H7Z" fill={art.dark} /><path d="M9 13H21V15H9Z" fill={art.mid} /><path d="M12 19H14V21H12ZM17 19H19V21H17Z" fill={art.dark} /></svg>;
  if (art.shape === 'polished' || art.shape === 'gem') return <svg viewBox="0 0 32 32" className={`dc-resource-icon ${className}`} shapeRendering="crispEdges" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : art.label} aria-hidden={decorative || undefined} focusable="false"><path d="M8 26H24V29H8Z" fill="#17191b" opacity=".24" /><path d={art.shape === 'gem' ? 'M8 5H24L29 12L16 28L3 12Z' : 'M9 3H23L29 9V23L23 29H9L3 23V9Z'} fill={art.dark} /><path d={art.shape === 'gem' ? 'M9 7H23L26 12H6ZM8 14H24L16 24Z' : 'M10 6H22L26 10V22L22 26H10L6 22V10Z'} fill={art.mid} /><path d={art.shape === 'gem' ? 'M10 7H15L11 12H6ZM12 14H16V23Z' : 'M10 7H20V10H10ZM7 11H10V20H7ZM21 21H24V24H21Z'} fill={art.light} /><path d={art.shape === 'gem' ? 'M16 7H20L22 12H13ZM17 14H24L17 22Z' : 'M11 12H20V20H11Z'} fill={art.light} opacity=".45" /></svg>;
  return <svg viewBox="0 0 32 32" className={`dc-resource-icon ${className}`} shapeRendering="crispEdges" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : art.label} aria-hidden={decorative || undefined} focusable="false"><path d="M8 25H25V28H8Z" fill="#17191b" opacity=".24" /><path d={art.shape === 'crystal' ? 'M5 24V17H9V9H13V4H18V9H22V15H27V25H5Z' : 'M5 23V14H9V8H22V12H27V24H23V27H10V24Z'} fill={art.dark} /><path d={art.shape === 'crystal' ? 'M9 22V16H13V7H17V12H20V22Z' : 'M8 21V15H12V11H21V15H24V21H20V24H12V21Z'} fill={art.mid} /><path d="M12 12H17V14H12ZM9 16H12V20H9ZM20 16H23V18H20Z" fill={art.light} /><path d="M17 21H23V23H17Z" fill={art.dark} opacity=".5" /></svg>;
}

export interface DeepClaimPortraitProps {
  specialty?: DeepClaimSpecialty;
  worker?: { id?: string; name?: string; specialty: DeepClaimSpecialty };
  label?: string;
  className?: string;
}
export function DeepClaimPortrait({ worker, specialty = worker?.specialty ?? 'miner', label = worker?.name ?? specialty.replace(/_/g, ' '), className = '' }: DeepClaimPortraitProps) {
  const art = SPECIALTY_ART[specialty];
  const variant = workerAppearanceVariant(worker?.id ?? specialty);
  const skin = ['#c79c75', '#a87c5c', '#e0b48b', '#80604d'][variant];
  return <svg viewBox="0 0 48 48" className={`dc-worker-portrait ${className}`} shapeRendering="crispEdges" role="img" aria-label={label} focusable="false"><path d="M0 0H48V48H0Z" fill="#323b35" /><path d="M3 4H45V44H3Z" fill="#56624b" /><path d="M7 38H41V48H7Z" fill="#24302c" /><path d="M13 31H36V48H13Z" fill={art.coat} /><path d="M15 19H33V33H15Z" fill="#493b2e" /><path d="M17 17H34V29H30V34H20V29H17Z" fill={skin} /><path d="M12 13H37V20H12Z" fill="#665238" /><path d="M15 7H33V15H15Z" fill={art.helmet} /><path d="M17 7H28V9H17Z" fill="#ecdb9f" /><path d="M12 16H37V20H12Z" fill={art.helmet} /><path d="M31 17H38V23H31Z" fill="#343c33" /><path d="M34 18H38V21H34Z" fill="#eed48e" /><path d="M26 24H29V26H26Z" fill="#34302a" /><path d="M19 29H29V31H19Z" fill="#77543b" /><path d="M17 35H21V48H17ZM30 35H33V48H30Z" fill="#b79b62" /><path d="M20 42H30V45H20Z" fill="#594a35" /></svg>;
}

export interface DeepClaimEquipmentIconProps { archetype: string; tier?: 1 | 2; durability?: number; label?: string; className?: string; decorative?: boolean }
export function DeepClaimEquipmentIcon({ archetype, tier, durability, label, className = '', decorative = false }: DeepClaimEquipmentIconProps) {
  const art = equipmentArtwork(archetype), kind = art?.kind ?? 'cargo', grade = tier ?? art?.tier ?? 1;
  const broken = typeof durability === 'number' && durability <= 0;
  const metal = grade === 2 ? '#b9c8be' : '#bb9260', edge = grade === 2 ? '#566c70' : '#735139', light = grade === 2 ? '#e4e4c8' : '#e4c38a';
  let shape;
  if (kind === 'pickaxe') shape = <><path d="M7 25H10V20H13V15H16V10H19V7H22V12H19V17H16V22H13V27H7Z" fill="#795439" /><path d="M5 10V7H9V5H21V7H26V12H23V10H18V9H11V10Z" fill={edge} /><path d="M8 6H20V8H24V10H21V9H12V10H8Z" fill={metal} /><path d="M9 6H18V7H9ZM8 25H11V27H8Z" fill={light} />{grade === 2 && <path d="M13 10H18V13H13ZM20 10H24V12H20Z" fill="#c6a55e" />}</>;
  else if (kind === 'helmet') shape = <><path d="M5 23V15H8V9H12V6H22V9H26V15H28V24H4V21Z" fill={edge} /><path d="M8 17V12H11V9H22V12H25V20H7V17Z" fill={metal} /><path d="M5 21H28V24H5ZM12 9H17V11H12Z" fill={light} /><path d="M14 8H17V20H14Z" fill="#8b744d" /><path d="M23 15H29V21H23Z" fill="#46574e" /><path d="M25 16H29V19H25Z" fill="#edd491" />{grade === 2 && <path d="M8 17H11V20H8ZM19 17H22V20H19Z" fill={edge} />}</>;
  else if (kind === 'lantern') shape = <><path d="M11 5V2H21V5H24V10H21V6H12V10H9V5Z" fill={edge} /><path d="M8 10H25V13H23V25H26V28H6V25H9V13H7V10Z" fill={edge} /><path d="M12 13H21V24H12Z" fill={grade === 2 ? '#d7d2a4' : '#e5b96f'} /><path d="M15 14H19V22H15Z" fill="#fff0b7" /><path d="M8 11H25V13H8ZM7 25H26V27H7Z" fill={metal} /><path d="M10 13H12V25H10ZM20 13H22V25H20Z" fill={light} />{grade === 2 && <path d="M14 9H19V12H14ZM14 26H19V28H14Z" fill="#a892bf" />}</>;
  else if (kind === 'survey') shape = <><path d="M5 6H22V27H5Z" fill="#746744" /><path d="M7 5H23V25H7Z" fill="#d1c394" /><path d="M10 9H18V11H10ZM10 14H15V16H10ZM12 18H18V20H12Z" fill="#758268" /><path d="M19 13H28V16H31V25H28V28H19V25H16V16H19Z" fill={edge} /><path d="M20 16H27V25H20V23H18V18H20Z" fill={metal} /><path d="M22 16H25V20H27V22H24V25H22V22H19V20H22Z" fill={light} /><path d="M22 17H24V21H22Z" fill={grade === 2 ? '#a78bc0' : '#a6674b'} /></>;
  else shape = <><path d="M9 7V4H22V7H25V27H6V10H9Z" fill={edge} /><path d="M10 8H22V25H9V11H10Z" fill="#8a8053" /><path d="M7 12H25V16H7ZM10 20H22V25H10Z" fill="#ad9a61" /><path d="M11 8H13V27H11ZM19 8H21V27H19Z" fill={metal} /><path d="M11 16H14V19H11ZM19 16H22V19H19Z" fill={light} />{grade === 2 && <path d="M5 6H8V29H5ZM25 6H28V29H25ZM5 27H28V29H5Z" fill={metal} />}</>;
  return <svg viewBox="0 0 32 32" className={`dc-equipment-icon ${className}`} shapeRendering="crispEdges" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : `${broken ? 'Broken ' : ''}${label ?? art?.label ?? 'Equipment'}`} aria-hidden={decorative || undefined} data-dc-equipment-art={kind} data-dc-equipment-tier={grade} data-dc-equipment-broken={broken ? 'true' : undefined} focusable="false"><path d="M6 27H27V30H6Z" fill="#17191b" opacity=".25" />{shape}{broken && <path d="M17 3H20V9H17V13H14V18H17V23H14V29H11V22H14V18H11V12H14V8H17Z" fill="#a65e3c" />}</svg>;
}

export interface DeepClaimInfrastructureIconProps { infrastructureKey: DeepClaimInfrastructureKey; grade?: number; status?: 'building' | 'installed'; className?: string; decorative?: boolean }
export function DeepClaimInfrastructureIcon({ infrastructureKey, grade = 1, status = 'installed', className = '', decorative = false }: DeepClaimInfrastructureIconProps) {
  const sprite = infrastructureSprite(infrastructureKey, grade, status === 'installed');
  return <svg viewBox="0 0 16 16" className={`dc-infrastructure-icon ${className}`} shapeRendering="crispEdges" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : `${sprite.label}, grade ${grade}${status === 'building' ? ', under construction' : ''}`} aria-hidden={decorative || undefined} focusable="false">{sprite.blocks.map(([color, x, y, width, height], index) => <rect key={index} x={x} y={y} width={width} height={height} fill={color} />)}</svg>;
}
export interface DeepClaimDiscoveryIconProps { kind: DeepClaimDiscoveryKind; quality?: DeepClaimDiscoveryQuality; className?: string; decorative?: boolean }
export function DeepClaimDiscoveryIcon({ kind, quality = 'common', className = '', decorative = false }: DeepClaimDiscoveryIconProps) {
  const sprite = DISCOVERY_ART[kind], frame = QUALITY_ART[quality];
  return <svg viewBox="0 0 18 18" className={`dc-discovery-icon ${className}`} shapeRendering="crispEdges" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : `${frame.label} ${sprite.label.toLowerCase()}`} aria-hidden={decorative || undefined} focusable="false"><path d="M0 2H2V0H16V2H18V16H16V18H2V16H0Z" fill="#27332f" /><path d="M2 1H16V2H2ZM1 2H2V16H1ZM16 2H17V16H16ZM2 16H16V17H2Z" fill={frame.color} /><g transform="translate(1 1)">{sprite.blocks.map(([color, x, y, width, height], index) => <rect key={index} x={x} y={y} width={width} height={height} fill={color} />)}</g>{Array.from({ length: frame.marks }, (_, index) => <rect key={index} x={4 + index * 3} y={16} width={2} height={1} fill={frame.color} />)}</svg>;
}
