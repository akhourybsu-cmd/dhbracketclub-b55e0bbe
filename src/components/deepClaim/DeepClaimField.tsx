import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Coins, Compass, FileText, HardHat, MapPin, Radar, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { RESOURCE_BY_ID, resourceTotal } from '@/lib/deepClaim/catalog';
import type { DeepClaimDiscoveryChoice, DeepClaimMode, DeepClaimPoint, DeepClaimResources, DeepClaimSnapshot } from '@/lib/deepClaim/types';
import { DeepClaimDiscoveryIcon, DeepClaimInfrastructureIcon, DeepClaimResourceIcon } from './renderer/DeepClaimIcons';
import { DeepClaimLog } from './DeepClaimPanels';
import { claimTargets } from './display';
import { CLAIM_OPERATION_NAMES, CLAIM_PROJECT_NAMES } from './fieldLabels';
import { ClaimBadge, ClaimButton, ClaimDialog, ClaimEmpty } from './DeepClaimPrimitives';

export type ClaimFieldView = 'finds' | 'reports' | 'ledger';

export function DeepClaimOperations({ snapshot, point, onClose, onDispatch, onLocate, onFinds, onReports }: {
  snapshot: DeepClaimSnapshot; point: DeepClaimPoint | null; onClose: () => void;
  onDispatch: (mode: DeepClaimMode, point: DeepClaimPoint | null) => void;
  onLocate: (point: DeepClaimPoint) => void; onFinds: () => void; onReports: () => void;
}) {
  const structures = snapshot.infrastructure ?? [];
  const knownDepths = useMemo(() => { const depths = new Map<number, DeepClaimPoint>(); for (const site of claimTargets({ world: snapshot.world }, 'survey')) if (!depths.has(site.y)) depths.set(site.y, site); return [...depths.entries()]; }, [snapshot.world]);
  const [chosenDepth, setChosenDepth] = useState(() => point?.y ?? knownDepths[knownDepths.length - 1]?.[0] ?? 0);
  const knownDepth = knownDepths.find(([depth]) => depth === chosenDepth) ?? knownDepths[knownDepths.length - 1];
  const capacity = snapshot.deep_operations?.infrastructure_capacity ?? snapshot.field_catalog?.caps.infrastructure ?? 128;
  const [projectPage, setProjectPage] = useState(0);
  const shownProjectPage = Math.min(projectPage, Math.max(0, Math.ceil(structures.length / 6) - 1));
  const selected = structures.find(item => item.x === point?.x && item.y === point?.y);
  const tile = snapshot.world?.tiles.find(item => item.x === point?.x && item.y === point?.y);
  return <ClaimDialog open onClose={onClose} title="Underground operations" description={point ? `Worksite x${point.x} · ${point.y}m. Only revealed and connected ground can support field projects.` : 'Explore, inspect and improve the mine your crew has actually uncovered.'}>
    {point && <div className="dcl-field-location"><MapPin size={19} aria-hidden="true" /><strong>{tile?.material && tile.remaining > 0 ? `${RESOURCE_BY_ID[tile.material].name} · ${tile.remaining} remaining` : tile ? 'Revealed passage' : 'Unknown ground'}</strong>{tile?.formation && <ClaimBadge>{tile.formation.replace(/_/g, ' ')}</ClaimBadge>}</div>}
    <section className="dcl-depth-navigation" aria-label="Known-ground navigation"><label>Known mine depth<select aria-label="Known mine depth" value={knownDepth?.[0] ?? ''} disabled={!knownDepths.length} onChange={event => setChosenDepth(Number(event.target.value))}>{!knownDepths.length && <option value="">No connected passage</option>}{knownDepths.map(([depth, site]) => <option key={depth} value={depth}>{depth}m · {site.x === 48 ? 'shaft passage' : `x${site.x} passage`}</option>)}</select></label><ClaimButton disabled={!knownDepth} onClick={() => { if (knownDepth) onLocate(knownDepth[1]); }}><MapPin size={14} aria-hidden="true" />Locate known depth</ClaimButton><p>Only connected, revealed passages appear here.</p></section>
    <div className="dcl-field-operation-grid" role="group" aria-label="Mine operations">{(['explore', 'extract', 'survey', 'infrastructure'] as const).map(mode => { const Icon = mode === 'survey' ? Radar : mode === 'infrastructure' ? HardHat : Compass; return <button type="button" key={mode} onClick={() => onDispatch(mode, point)}><Icon size={21} aria-hidden="true" /><strong>{CLAIM_OPERATION_NAMES[mode]}</strong><small>{mode === 'explore' ? 'Open the frontier' : mode === 'extract' ? 'Work a known seam' : mode === 'survey' ? 'Reveal without mining' : 'Install lasting protection'}</small></button>; })}</div>
    {!!snapshot.discovery_summary?.pending && <ClaimButton primary onClick={onFinds}><Sparkles size={15} aria-hidden="true" />Review finds · {snapshot.discovery_summary.pending}</ClaimButton>}
    {!!snapshot.field_reports?.length && <ClaimButton onClick={onReports}><BookOpen size={15} aria-hidden="true" />Read field reports</ClaimButton>}
    <section className="dcl-installed-list" aria-label="Mine infrastructure"><h3>Installed and building projects <small>{structures.length}/{capacity}</small></h3>{selected && <p className="dcl-note">Selected: {CLAIM_PROJECT_NAMES[selected.key]} · grade {selected.grade} · {selected.status}. Radius {selected.radius}; {selected.strength}{selected.key === 'rail' ? '% bonus on covered route segments' : ' percentage points protection at covered worksites'}.</p>}{structures.length ? structures.slice(shownProjectPage * 6, shownProjectPage * 6 + 6).map(item => <button type="button" key={item.id} onClick={() => onLocate(item)} aria-label={`Locate ${CLAIM_PROJECT_NAMES[item.key]} at x${item.x}, ${item.y} metres`}><DeepClaimInfrastructureIcon infrastructureKey={item.key} grade={item.grade} decorative /><span><strong>{CLAIM_PROJECT_NAMES[item.key]}</strong><small>Grade {item.grade} · x{item.x} · {item.y}m · radius {item.radius}</small></span><ClaimBadge tone={item.status === 'installed' ? 'green' : 'blue'}>{item.status}</ClaimBadge></button>) : <p className="dcl-note">No field projects yet. Dispatch a crew to install supports, ventilation, a pump or haul rail at a connected passage.</p>}{structures.length > 6 && <FieldPagination page={shownProjectPage} total={structures.length} label="projects" onPage={setProjectPage} />}</section>
  </ClaimDialog>;
}

export function DeepClaimFieldLog({ snapshot, view, onView, selectedFindId, onSelectFind, onLocate, resolveDiscovery, readOnly, busy, onConfirmed }: {
  snapshot: DeepClaimSnapshot; view: ClaimFieldView; onView: (view: ClaimFieldView) => void;
  selectedFindId: string | null; onSelectFind: (id: string | null) => void; onLocate: (point: DeepClaimPoint) => void;
  resolveDiscovery: (id: string, choice: DeepClaimDiscoveryChoice, revision?: number) => Promise<DeepClaimSnapshot>;
  readOnly: boolean; busy: boolean; onConfirmed: (title: string, description: string) => void;
}) {
  const [findPage, setFindPage] = useState(0);
  const [reportPage, setReportPage] = useState(0);
  const [filter, setFilter] = useState<'pending' | 'kept' | 'resolved'>('pending');
  const [reportId, setReportId] = useState<string | null>(null);
  const [choice, setChoice] = useState<DeepClaimDiscoveryChoice | null>(null);
  const [reviewedRevision, setReviewedRevision] = useState<number | null>(null);
  const [error, setError] = useState('');
  const finds = snapshot.discoveries ?? [];
  const visibleFinds = finds.filter(item => filter === 'resolved' ? item.status === 'sold' || item.status === 'salvaged' : item.status === filter);
  const shownFindPage = Math.min(findPage, Math.max(0, Math.ceil(visibleFinds.length / 6) - 1));
  const reports = snapshot.field_reports ?? [];
  const shownReportPage = Math.min(reportPage, Math.max(0, Math.ceil(reports.length / 6) - 1));
  const selected = finds.find(item => item.id === selectedFindId);
  const report = snapshot.field_reports?.find(item => item.id === reportId);
  const summary = snapshot.discovery_summary ?? { pending: 0, kept: 0, sold: 0, salvaged: 0 };
  useEffect(() => { setChoice(null); setReviewedRevision(null); setError(''); }, [selectedFindId]);
  const stale = reviewedRevision !== null && reviewedRevision < snapshot.revision;
  const room = snapshot.company ? snapshot.company.warehouse_capacity - snapshot.company.warehouse_used : 0;
  const salvageFits = !!selected && resourceTotal(selected.salvage) <= room;
  function selectFind(id: string | null) { onSelectFind(id); setChoice(null); setReviewedRevision(null); setError(''); }
  async function resolve() {
    if (!selected || selected.status !== 'pending' || !choice || stale || reviewedRevision === null || busy || readOnly || choice === 'salvage' && !salvageFits) return;
    setError('');
    try {
      await resolveDiscovery(selected.id, choice, reviewedRevision);
      selectFind(null);
      onConfirmed(choice === 'keep' ? 'Added to the cabinet.' : choice === 'sell' ? 'Specimen sold.' : 'Materials recovered.', choice === 'keep' ? `${selected.name} is permanently recorded in your company’s collection.` : choice === 'sell' ? `${selected.name} sold for ${selected.sale_value} company credits.` : `The displayed materials from ${selected.name} are now in your warehouse.`);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'This decision could not be confirmed. Check the saved action.'); }
  }
  return <>
    <div className="dcl-segment" role="group" aria-label="Field log views"><button type="button" aria-pressed={view === 'finds'} onClick={() => onView('finds')}>Finds{summary.pending > 0 && <small>{summary.pending}</small>}</button><button type="button" aria-pressed={view === 'reports'} onClick={() => onView('reports')}>Reports</button><button type="button" aria-pressed={view === 'ledger'} onClick={() => onView('ledger')}>Ledger</button></div>
    {view === 'finds' ? <>
      <div className="dcl-section-heading"><div><h2>From the depths</h2><p>Finite finds. Permanent decisions.</p></div><Sparkles size={24} aria-hidden="true" /></div>
      <div className="dcl-find-summary"><span><strong>{summary.pending}</strong>Pending</span><span><strong>{summary.kept}</strong>Kept</span><span><strong>{summary.sold + summary.salvaged}</strong>Resolved</span></div>
      <div className="dcl-stock-filter dcl-find-filter" role="group" aria-label="Find collection"><button type="button" aria-pressed={filter === 'pending'} onClick={() => { setFilter('pending'); setFindPage(0); }}>Pending</button><button type="button" aria-pressed={filter === 'kept'} onClick={() => { setFilter('kept'); setFindPage(0); }}>Cabinet</button><button type="button" aria-pressed={filter === 'resolved'} onClick={() => { setFilter('resolved'); setFindPage(0); }}>Resolved</button></div>
      <div className="dcl-find-grid">{visibleFinds.slice(shownFindPage * 6, shownFindPage * 6 + 6).map(item => <button type="button" className="dcl-card dcl-find-card" key={item.id} aria-label={`Inspect ${item.name}`} onClick={() => selectFind(item.id)}><DeepClaimDiscoveryIcon kind={item.kind} quality={item.quality} decorative /><span><strong>{item.name}</strong><small>{item.quality} · x{item.x} · {item.y}m</small></span><ClaimBadge tone={item.status === 'pending' ? 'brass' : 'green'}>{item.status}</ClaimBadge><ArrowRight size={14} aria-hidden="true" /></button>)}</div>
      {visibleFinds.length > 6 && <FieldPagination page={shownFindPage} total={visibleFinds.length} label="finds" onPage={setFindPage} />}
      {!visibleFinds.length && <ClaimEmpty title={filter === 'pending' ? 'No decisions waiting.' : filter === 'kept' ? 'Your cabinet awaits.' : 'No resolved finds yet.'} icon={<Sparkles aria-hidden="true" />}>{filter === 'pending' ? 'A mining crew can recover a specimen after fully working a deposit and returning. Surveys reveal ground without recovering finds.' : filter === 'kept' ? 'Keep a recovered find to preserve it in your company’s collection.' : 'Sold and salvaged specimens will be recorded here.'}</ClaimEmpty>}
      <p className="dcl-note">{filter === 'kept' ? 'Showing the latest 24 kept finds. Your full cabinet count is preserved.' : filter === 'resolved' ? 'Showing the latest 12 sold or salvaged finds. Every decision stays in your company history.' : 'All pending decisions remain available. At 24 pending finds, review them before dispatching another crew.'}</p>
    </> : view === 'reports' ? <>
      <div className="dcl-section-heading"><div><h2>Field reports</h2><p>Committed events from the working mine.</p></div><BookOpen size={24} aria-hidden="true" /></div>
      <div className="dcl-field-reports">{reports.slice(shownReportPage * 6, shownReportPage * 6 + 6).map(item => <button type="button" className="dcl-card" key={item.id} aria-label={`Read report: ${item.title}`} onClick={() => setReportId(item.id)}>{item.kind === 'incident' ? <TriangleAlert size={20} aria-hidden="true" /> : item.kind === 'survey' ? <Radar size={20} aria-hidden="true" /> : item.kind === 'infrastructure' ? <HardHat size={20} aria-hidden="true" /> : <Sparkles size={20} aria-hidden="true" />}<span><strong>{item.title}</strong><small>{item.point.y}m · {new Date(item.occurred_at).toLocaleString()}</small><p>{item.description}</p></span><ArrowRight size={14} aria-hidden="true" /></button>)}</div>
      {reports.length > 6 && <FieldPagination page={shownReportPage} total={reports.length} label="reports" onPage={setReportPage} />}
      {!reports.length && <ClaimEmpty title="The field book is clear." icon={<FileText aria-hidden="true" />}>Survey, installation and incident reports arrive as the crew’s work is confirmed.</ClaimEmpty>}
      <p className="dcl-note">Latest 24 field reports. Jobs and permanent find decisions remain part of your company history.</p>
    </> : <DeepClaimLog snapshot={snapshot} />}
    <ClaimDialog open={!!selected} onClose={() => selectFind(null)} busy={busy} title={selected?.name ?? 'Recovered find'} description={selected ? `${selected.quality} specimen · x${selected.x} · ${selected.y}m` : undefined} className="dcl-discovery-dialog">{selected && <>
      <div className={`dcl-find-showcase is-${selected.quality}`}><DeepClaimDiscoveryIcon kind={selected.kind} quality={selected.quality} decorative /><ClaimBadge>{selected.quality}</ClaimBadge></div><p className="dcl-find-detail">{selected.detail}</p>
      <ClaimButton className="is-small" onClick={() => { selectFind(null); onLocate(selected); }}><MapPin size={14} aria-hidden="true" />Locate find site</ClaimButton>
      {selected.status === 'pending' ? <>
        <div className="dcl-find-choices" role="group" aria-label="Find decision">{([{ key: 'keep', name: 'Keep in cabinet', text: 'Permanent specimen record', icon: Sparkles }, { key: 'sell', name: 'Sell specimen', text: `${selected.sale_value} company credits`, icon: Coins }, { key: 'salvage', name: 'Salvage materials', text: `${resourceTotal(selected.salvage)} storage units`, icon: HardHat }] as const).map(item => <button type="button" key={item.key} aria-pressed={choice === item.key} disabled={readOnly || busy} onClick={() => { setChoice(item.key); setReviewedRevision(snapshot.revision); setError(''); }}><item.icon size={18} aria-hidden="true" /><strong>{item.name}</strong><small>{item.text}</small></button>)}</div>
        {choice && <section className="dcl-find-decision-review" aria-label="Reviewed find decision"><ShieldCheck size={17} aria-hidden="true" /><strong>{choice === 'keep' ? 'Keep this specimen permanently.' : choice === 'sell' ? `Sell once for ${selected.sale_value} company credits.` : 'Consume this specimen for these materials.'}</strong>{choice === 'salvage' && <><FieldMaterials resources={selected.salvage} /><p>Needs {resourceTotal(selected.salvage)} free units · {room} available. All materials must fit together.</p>{!salvageFits && <p className="dcl-error">Make room in Stores first. The find stays pending until the entire salvage fits.</p>}</>}<p>This decision is final. The server confirms it once; retries cannot duplicate the reward.</p></section>}
        {stale && <p className="dcl-note">Your company changed. Select the decision again to review the current storage and balance.</p>}{readOnly && <p className="dcl-note">Reconnect or confirm the saved action before deciding.</p>}{error && <p className="dcl-error" role="alert">{error}</p>}
        <ClaimButton primary pending={busy} disabled={!choice || stale || readOnly || choice === 'salvage' && !salvageFits} onClick={() => void resolve()}>{choice === 'keep' ? 'Confirm keep' : choice === 'sell' ? 'Confirm sale' : choice === 'salvage' ? 'Confirm salvage' : 'Choose a decision'}</ClaimButton>
      </> : <><ClaimBadge tone="green">{selected.status}</ClaimBadge><p className="dcl-note">{selected.status === 'kept' ? 'This specimen is preserved in your company’s cabinet.' : 'This specimen has already been resolved. Its reward cannot be claimed again.'}</p></>}
    </>}</ClaimDialog>
    <ClaimDialog open={!!report} onClose={() => setReportId(null)} title={report?.title ?? 'Field report'} description={report ? new Date(report.occurred_at).toLocaleString() : undefined}>{report && <><ClaimBadge tone={report.kind === 'incident' ? 'brass' : 'green'}>{report.kind}</ClaimBadge><p className="dcl-find-detail">{report.description}</p><div className="dcl-report-facts"><span><strong>{report.point.y}m</strong>Depth</span>{report.kind === 'incident' && <span><strong>{report.delay_seconds}s</strong>Setup delay</span>}{report.kind === 'survey' && <span><strong>{report.tiles_revealed}</strong>Tiles revealed</span>}</div><ClaimButton onClick={() => { setReportId(null); onLocate(report.point); }}><MapPin size={15} aria-hidden="true" />Locate report site</ClaimButton>{report.discovery_id && finds.some(item => item.id === report.discovery_id) && <ClaimButton onClick={() => { setReportId(null); onView('finds'); selectFind(report.discovery_id); }}>Inspect recovered find</ClaimButton>}</>}</ClaimDialog>
  </>;
}

function FieldMaterials({ resources }: { resources: DeepClaimResources }) {
  return <div className="dcl-material-costs">{Object.entries(resources).map(([key, count]) => <span key={key}><DeepClaimResourceIcon resourceId={key as keyof DeepClaimResources} decorative /><b>{count}</b>{RESOURCE_BY_ID[key as keyof DeepClaimResources].name}</span>)}</div>;
}

function FieldPagination({ page, total, label, onPage }: { page: number; total: number; label: string; onPage: (page: number) => void }) {
  const pages = Math.ceil(total / 6);
  return <div className="dcl-field-pagination" role="group" aria-label={`${label} pages`}><ClaimButton className="is-small" aria-label={`Previous ${label} page`} disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</ClaimButton><span aria-live="polite">{page * 6 + 1}–{Math.min(total, page * 6 + 6)} of {total}</span><ClaimButton className="is-small" aria-label={`Next ${label} page`} disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Next</ClaimButton></div>;
}
