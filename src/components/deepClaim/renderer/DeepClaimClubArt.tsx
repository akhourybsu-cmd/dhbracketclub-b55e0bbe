import { useId } from 'react';
import type { DeepClaimPublicSpecimen } from '@/lib/deepClaim/types';
import { DISCOVERY_ART, QUALITY_ART } from './fieldSprites';
import { PUBLIC_PROJECT_ART, type PublicProjectArtwork } from './clubSprites';
import './deepClaimPublicArt.css';

export type DeepClaimClubArtKind = 'club' | 'project' | 'standings' | 'showcase';
export interface DeepClaimClubIconProps { kind: DeepClaimClubArtKind; className?: string; decorative?: boolean }

/** Original public emblems. These identify a screen, never an earned trophy. */
export function DeepClaimClubIcon({ kind, className = '', decorative = false }: DeepClaimClubIconProps) {
  const label = { club: 'Club operations', project: 'Club projects', standings: 'Company standings', showcase: 'Company showcases' }[kind];
  let shape;
  if (kind === 'club') shape = <><path d="M3 8H29V12H3ZM5 12H27V29H5Z" fill="#536a59" /><path d="M7 5H25V8H7ZM11 2H21V5H11Z" fill="#baa370" /><path d="M8 14H13V20H8ZM19 14H24V20H19Z" fill="#d9cd9e" /><path d="M10 23H23V26H10Z" fill="#b9a66d" /><path d="M9 26H12V30H9ZM21 26H24V30H21Z" fill="#88724e" /><path d="M14 13H18V18H14ZM15 19H17V23H15Z" fill="#849e84" /><path d="M2 28H30V31H2Z" fill="#c0ab76" /></>;
  else if (kind === 'project') shape = <><path d="M4 5H28V28H4Z" fill="#3d5b57" /><path d="M6 7H26V26H6Z" fill="#6d9180" /><path d="M8 10H23V12H8ZM10 8H12V24H10ZM15 14H23V16H15ZM16 11H18V23H16Z" fill="#b2c1a0" /><path d="M6 25H26V28H6Z" fill="#c4b079" /><path d="M22 3H25V17H22ZM19 5H28V8H19Z" fill="#d1bc83" /><path d="M3 9H6V26H3Z" fill="#ac9563" /></>;
  else if (kind === 'standings') shape = <><path d="M3 27H30V30H3ZM5 15H11V26H5Z" fill="#6b8b75" /><path d="M13 7H19V26H13Z" fill="#c2ac72" /><path d="M21 19H27V26H21Z" fill="#8a9f8d" /><path d="M6 15H10V17H6ZM14 7H18V9H14ZM22 19H26V21H22Z" fill="#ded0a0" /><path d="M3 4H6V7H3ZM22 4H29V6H22ZM24 8H29V10H24Z" fill="#9aa98b" /></>;
  else shape = <><path d="M3 6H29V28H3Z" fill="#645b43" /><path d="M5 8H27V24H5Z" fill="#334e49" /><path d="M7 9H25V11H7ZM7 12H9V21H7Z" fill="#8ba89a" /><path d="M6 24H27V27H6ZM2 28H30V31H2Z" fill="#c4b079" /><path d="M12 13H20V16H23V22H10V17H12Z" fill="#8b7c9c" /><path d="M15 13H18V20H15Z" fill="#d9c6d7" /><path d="M10 22H24V24H10Z" fill="#a18d60" /></>;
  return <svg viewBox="0 0 32 32" className={`dc-club-icon ${className}`} shapeRendering="crispEdges" role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined} data-dc-club-art={kind} focusable="false">{shape}</svg>;
}

export interface DeepClaimProjectArtProps {
  projectKey: string;
  status: 'locked' | 'open' | 'completed';
  /** Presentation ratio derived from the server's committed project quantities. */
  progress?: number;
  className?: string;
  decorative?: boolean;
}
const projectArtwork = (key: string): PublicProjectArtwork | undefined => Object.prototype.hasOwnProperty.call(PUBLIC_PROJECT_ART, key) ? PUBLIC_PROJECT_ART[key as keyof typeof PUBLIC_PROJECT_ART] : undefined;

export function DeepClaimProjectArt({ projectKey, status, progress = 0, className = '', decorative = false }: DeepClaimProjectArtProps) {
  const clip = useId(), art = projectArtwork(projectKey);
  const ratio = status === 'completed' ? 1 : status === 'locked' || !Number.isFinite(progress) ? 0 : Math.max(0, Math.min(1, progress));
  const label = `${art?.label ?? 'Club project'}, ${status}${status === 'open' ? `, ${Math.round(ratio * 100)}% contributed` : ''}`;
  return <svg viewBox="0 0 96 76" className={`dc-project-art ${className}`} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined} shapeRendering="crispEdges" data-dc-project-art={art ? projectKey : 'unknown'} data-dc-project-status={status} data-dc-project-progress={ratio} focusable="false">
    <defs><clipPath id={clip}><rect x="5" y={68 - ratio * 62} width="86" height={ratio * 62} /></clipPath></defs>
    <path d="M5 0H91V4H96V72H91V76H5V72H0V4H5Z" fill="#2c3e35" /><path d="M5 4H91V69H5Z" fill="#3c5549" />
    <path d="M8 22H88V23H8ZM8 43H88V44H8ZM26 7H27V65H26ZM47 7H48V65H47ZM68 7H69V65H68Z" fill="#a8b395" opacity=".12" />
    {art && <><g opacity=".25" data-dc-project-blueprint="true">{art.blocks.map(([fill, x, y, width, height], index) => <rect key={index} {...{ fill, x, y, width, height }} />)}</g><g clipPath={`url(#${clip})`} data-dc-project-built="true">{art.blocks.map(([fill, x, y, width, height], index) => <rect key={index} {...{ fill, x, y, width, height }} />)}</g></>}
    {status === 'locked' && <g data-dc-project-lock="true"><path d="M39 29V24H43V20H53V24H57V32H53V25H43V32H39Z" fill="#c9c09a" /><path d="M37 30H59V48H37Z" fill="#776f4e" /><path d="M40 32H56V45H40Z" fill="#bfb180" /><path d="M46 35H50V39H49V42H47V39H46Z" fill="#4b5947" /></g>}
    <path d="M5 69H91V72H5Z" fill="#202f29" /><rect x="7" y="70" width={82 * ratio} height="2" fill="#c8b37b" />
    <path d="M4 4H7V7H4ZM89 4H92V7H89ZM4 68H7V71H4ZM89 68H92V71H89Z" fill="#b59e6b" />
  </svg>;
}

export interface DeepClaimShowcaseArtProps {
  specimens: readonly DeepClaimPublicSpecimen[];
  companyName?: string;
  className?: string;
  decorative?: boolean;
}

/** Public, consented museum case: no mine coordinates, ownership IDs or private snapshots. */
export function DeepClaimShowcaseArt({ specimens, companyName, className = '', decorative = false }: DeepClaimShowcaseArtProps) {
  const descriptionId = useId(), shown = specimens.slice(0, 3);
  const label = `${companyName ? `${companyName}: ` : ''}${shown.length ? `${shown.length} featured ${shown.length === 1 ? 'specimen' : 'specimens'}` : 'Empty specimen showcase'}`;
  return <svg viewBox="0 0 192 100" className={`dc-showcase-art ${className}`} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-describedby={decorative ? undefined : descriptionId} aria-hidden={decorative || undefined} shapeRendering="crispEdges" data-dc-showcase-art="true" data-dc-showcase-count={shown.length} focusable="false">
    {!decorative && <desc id={descriptionId}>{shown.length ? shown.map(item => `${QUALITY_ART[item.quality].label} ${item.name}. ${item.detail}`).join(' ') : 'No specimens have been published in this case.'}</desc>}
    <path d="M6 4H186V8H190V90H186V96H6V90H2V8H6Z" fill="#4c4937" /><path d="M8 8H184V88H8Z" fill="#978558" /><path d="M13 12H179V76H13Z" fill="#293e36" />
    <path d="M16 15H176V19H16ZM16 21H19V66H16Z" fill="#c3c8a2" opacity=".28" /><path d="M14 74H178V80H14Z" fill="#b7a26c" /><path d="M14 81H178V86H14Z" fill="#665c3e" />
    {[0, 1, 2].map(index => {
      const specimen = shown[index], x = 20 + index * 54;
      const art = specimen ? DISCOVERY_ART[specimen.kind] : null, quality = specimen ? QUALITY_ART[specimen.quality] : null;
      return <g key={index} data-dc-showcase-slot={index} data-dc-specimen-kind={specimen?.kind} data-dc-specimen-quality={specimen?.quality}>
        <path d={`M${x} 21H${x + 44}V69H${x}Z`} fill="#344b3f" /><path d={`M${x + 3} 23H${x + 41}V25H${x + 3}Z`} fill="#aebc98" opacity=".17" />
        {art && quality ? <><g transform={`translate(${x + 6} 30) scale(2)`}>{art.blocks.map(([fill, bx, by, width, height], block) => <rect key={block} x={bx} y={by} {...{ fill, width, height }} />)}</g><path d={`M${x + 4} 64H${x + 40}V69H${x + 4}Z`} fill="#8b794e" /><rect x={x + 10} y="66" width="24" height="1" fill={quality.color} />{Array.from({ length: quality.marks }, (_, mark) => <rect key={mark} x={x + 10 + mark * 7} y="71" width="3" height="1" fill={quality.color} data-dc-quality-mark="true" />)}</> : <path d={`M${x + 11} 64H${x + 33}V65H${x + 11}Z`} fill="#87977a" opacity=".25" />}
      </g>;
    })}
    <path d="M9 8H13V12H9ZM179 8H183V12H179ZM9 82H13V86H9ZM179 82H183V86H179Z" fill="#d1bd83" /><path d="M6 90H186V94H6Z" fill="#6d6343" /><path d="M14 94H25V100H14ZM167 94H178V100H167Z" fill="#494634" />
  </svg>;
}

export interface DeepClaimCompanyCrestProps { userId: string; companyName: string; className?: string; decorative?: boolean }
/** Identity pattern only: the public owner's ID chooses a mark, never a rank or reward. */
export function DeepClaimCompanyCrest({ userId, companyName, className = '', decorative = false }: DeepClaimCompanyCrestProps) {
  const variant = [...userId].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) % 4;
  const coat = ['#71866c', '#798c87', '#8e8061', '#7e7d8e'][variant];
  const initials = companyName.trim().split(/[\s&]+/u).filter(Boolean).slice(0, 2).map(word => [...word][0]).join('').toLocaleUpperCase() || 'DC';
  return <svg viewBox="0 0 48 48" className={`dc-company-crest ${className}`} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : `${companyName || 'Company'} identity`} aria-hidden={decorative || undefined} shapeRendering="crispEdges" data-dc-company-crest={variant} focusable="false"><path d="M8 2H40V6H44V38H40V42H33V46H15V42H8V38H4V6H8Z" fill="#4b513d" /><path d="M10 5H38V9H41V35H37V39H30V43H18V39H11V35H7V9H10Z" fill="#c3ae75" /><path d="M12 8H36V11H38V33H34V37H28V40H20V37H14V33H10V11H12Z" fill={coat} /><path d={variant % 2 ? 'M13 11H17V32H13ZM31 11H35V32H31Z' : 'M11 13H37V17H11ZM16 32H32V35H16Z'} fill="#b7b78b" opacity=".55" /><text x="24" y="28" textAnchor="middle" fontFamily="ui-monospace,monospace" fontSize="13" fontWeight="700" fill="#f0e3b9">{initials}</text></svg>;
}
