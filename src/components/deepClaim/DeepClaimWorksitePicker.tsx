import { useId, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Search } from 'lucide-react';
import type { DeepClaimDuration, DeepClaimMode, DeepClaimPoint, DeepClaimTile, DeepClaimWorker, DeepClaimWorld } from '@/lib/deepClaim/types';
import { operationAdvice } from '@/lib/deepClaim/operationAdvice';
import { RESOURCE_ART, FRONTIER_PALETTE } from './renderer/artManifest';
import { DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { ClaimButton } from './DeepClaimPrimitives';
import { worksiteBranch, worksiteName } from './worksiteLabels';

const PAGE_SIZE = 4;
const NO_WORKERS: DeepClaimWorker[] = [];
const keyOf = (point: DeepClaimPoint) => `${point.x}:${point.y}`;
const same = (a: DeepClaimPoint | null, b: DeepClaimPoint) => a?.x === b.x && a.y === b.y;

function WorksiteArt({ point, tiles }: { point: DeepClaimPoint; tiles: ReadonlyMap<string, DeepClaimTile> }) {
  const tile = tiles.get(keyOf(point));
  return <span className="dcl-site-art" aria-hidden="true">
    <svg className="dcl-site-map" viewBox="0 0 70 50" shapeRendering="crispEdges">
      <rect width="70" height="50" fill={FRONTIER_PALETTE.coal} />
      {Array.from({ length: 35 }, (_, index) => {
        const x = index % 7, y = Math.floor(index / 7);
        const known = tiles.get(`${point.x + x - 3}:${point.y + y - 2}`);
        const color = !known ? FRONTIER_PALETTE.soot : known.remaining === 0 ? FRONTIER_PALETTE.woodDark : known.material ? RESOURCE_ART[known.material].mid : known.terrain === 'soil' ? FRONTIER_PALETTE.earth : FRONTIER_PALETTE.slate;
        return <rect key={index} x={x * 10 + 1} y={y * 10 + 1} width="8" height="8" fill={color} opacity={known ? 1 : .45} />;
      })}
      <path d="M30 19V16H34M40 19V16H36M30 31V34H34M40 31V34H36" fill="none" stroke={FRONTIER_PALETTE.brassLight} strokeWidth="2" />
    </svg>
    {tile?.material && tile.remaining > 0 && <DeepClaimResourceIcon resourceId={tile.material} decorative className="dcl-site-resource" />}
  </span>;
}

export function DeepClaimWorksitePicker({ world, sites, selected, mode, disabled, onSelect, surveyWorkers = NO_WORKERS, minutes = 20 }: {
  world: DeepClaimWorld | null; sites: DeepClaimPoint[]; selected: DeepClaimPoint | null; mode: DeepClaimMode;
  disabled: boolean; onSelect: (point: DeepClaimPoint) => void;
  surveyWorkers?: DeepClaimWorker[]; minutes?: DeepClaimDuration;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const tiles = useMemo(() => new Map(world?.tiles.map(tile => [keyOf(tile), tile]) ?? []), [world]);
  const filtered = useMemo(() => {
    const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return sites.length <= PAGE_SIZE || !words.length ? sites : sites.filter(point => {
      const text = `${worksiteName(point, mode, tiles)} ${point.y}m ${worksiteBranch(point)} ${keyOf(point)}`.toLocaleLowerCase();
      return words.every(word => text.includes(word));
    });
  }, [sites, search, mode, tiles]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = useMemo(() => filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE), [filtered, currentPage]);
  const pinned = selected && !visible.some(point => same(selected, point)) ? selected : null;
  // Parent display clocks tick every second. Recount only when the disclosed
  // map, visible sites or chosen survey plan changes, never for a clock tick.
  const surveyCounts = useMemo(() => new Map(mode === 'survey'
    ? (pinned ? [pinned, ...visible] : visible).map(point => [keyOf(point), operationAdvice({ mode, target: point, world, workers: surveyWorkers, minutes }).unknownCount])
    : []), [mode, pinned, visible, world, surveyWorkers, minutes]);
  function card(point: DeepClaimPoint) {
    const chosen = same(selected, point), tile = tiles.get(keyOf(point));
    const name = worksiteName(point, mode, tiles), branch = worksiteBranch(point);
    const unseen = surveyCounts.get(keyOf(point));
    const benefit = unseen !== undefined ? unseen ? `${unseen} unseen ${unseen === 1 ? 'tile' : 'tiles'}` : 'Already mapped'
      : tile?.material && tile.remaining > 0 ? `${tile.remaining.toLocaleString()} left` : mode === 'infrastructure' ? 'Local future shifts' : tile?.remaining === 0 ? 'Open passage' : 'Opens new ground';
    return <button type="button" className="dcl-worksite" key={keyOf(point)} data-dc-worksite={keyOf(point)} aria-pressed={chosen}
      aria-label={`${name}, ${point.y}m deep, ${branch}, ${benefit}`} disabled={disabled} onClick={() => { if (!disabled) onSelect(point); }}>
      <WorksiteArt point={point} tiles={tiles} />
      <span className="dcl-site-copy"><strong>{name}</strong><small>{point.y}m · {branch}</small>
        <span>{benefit}</span></span>
      {chosen && <Check className="dcl-site-check" size={14} aria-hidden="true" />}
    </button>;
  }
  return <section className="dcl-worksites" role="group" aria-label="Expedition worksite" data-dc-tutorial="dispatch-target">
    <header><h3>{mode === 'extract' ? 'Choose a deposit' : mode === 'explore' ? 'Choose a tunnel frontier' : mode === 'survey' ? 'Scout from' : 'Build at'}</h3><span>{sites.length} {sites.length === 1 ? 'site' : 'sites'}</span></header>
    {sites.length > PAGE_SIZE && <label className="dcl-site-search" htmlFor={id}><Search size={16} aria-hidden="true" /><span className="sr-only">Depth or material</span><input id={id} type="search" aria-label="Depth or material" placeholder="Material or depth" value={search} disabled={disabled} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label>}
    {pinned && <div className="dcl-site-pinned"><span>Selected</span>{card(pinned)}</div>}
    <div className="dcl-worksite-grid">{visible.map(card)}</div>
    {!sites.length ? <p className="dcl-note">{mode === 'extract' ? 'Expand tunnels to reach a deposit.' : 'No connected worksite.'}</p> : !filtered.length && <p className="dcl-note" role="status">No matching sites</p>}
    {sites.length > PAGE_SIZE && <div className="dcl-site-pagination" role="group" aria-label="Worksite pages">
      <ClaimButton className="is-small" aria-label="Previous worksite page" disabled={disabled || currentPage === 0} onClick={() => setPage(currentPage - 1)}><ArrowLeft size={16} aria-hidden="true" /></ClaimButton>
      <span aria-live="polite">{filtered.length ? `${currentPage * PAGE_SIZE + 1}–${Math.min(filtered.length, (currentPage + 1) * PAGE_SIZE)} / ${filtered.length}` : '0 sites'}</span>
      <ClaimButton className="is-small" aria-label="Next worksite page" disabled={disabled || currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}><ArrowRight size={16} aria-hidden="true" /></ClaimButton>
    </div>}
  </section>;
}
