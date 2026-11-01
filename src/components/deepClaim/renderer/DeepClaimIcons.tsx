import type { DeepClaimResourceId, DeepClaimSpecialty } from '@/lib/deepClaim/types';
import { RESOURCE_ART, SPECIALTY_ART, workerAppearanceVariant } from './artManifest';

export function DeepClaimResourceIcon({ resourceId, className = '', decorative = false }: { resourceId: DeepClaimResourceId; className?: string; decorative?: boolean }) {
  const art = RESOURCE_ART[resourceId];
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
